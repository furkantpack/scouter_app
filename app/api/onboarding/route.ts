import { NextResponse } from 'next/server';

import { enqueueThesisEngineJob } from '@/lib/engine-jobs';
import { scheduleEngineWorkerDispatch } from '@/lib/engine-worker-dispatch';
import {
  validateAnswer,
  type OnboardingQuestion,
} from '@/lib/onboarding-model';
import {
  ApiError,
  bodyOf,
  dbError,
  requireWorkspaceRole,
  withWorkspace,
} from '@/lib/product-api';
import {
  acquireProductActionRun,
  finishProductActionRun,
} from '@/lib/product-throttle';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWorkspace } from '@/lib/supabase/workspace';
import { normalizePublicWebsite } from '@/lib/thesis/url';

export async function GET() {
  try {
    const { supabase, user, membership } = await getWorkspace();
    if (!user)
      return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    const { data: questions, error } = await supabase
      .from('onboarding_questions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    dbError(error);
    const [answers, state] = membership
      ? await Promise.all([
          supabase
            .from('onboarding_answers')
            .select('question_id,answer_value')
            .eq('organization_id', membership.organization_id),
          supabase
            .from('organization_onboarding')
            .select('*')
            .eq('organization_id', membership.organization_id)
            .maybeSingle(),
        ])
      : [
          { data: [], error: null },
          { data: null, error: null },
        ];
    dbError(answers.error);
    dbError(state.error);
    return NextResponse.json(
      {
        questions: questions || [],
        answers: answers.data || [],
        state: state.data,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ApiError
            ? error.message
            : 'Onboarding could not be loaded.',
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    const body = await bodyOf(request);
    if (
      typeof body.sectionKey !== 'string' ||
      !body.answers ||
      typeof body.answers !== 'object' ||
      Array.isArray(body.answers) ||
      typeof body.completed !== 'boolean'
    )
      throw new ApiError('Invalid onboarding request.');
    if (body.completed) requireWorkspaceRole(membership);
    const { data, error } = await supabase
      .from('onboarding_questions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    dbError(error);
    const questions = (data || []) as OnboardingQuestion[];
    const sections = Array.from(new Set(questions.map((q) => q.section_key)));
    const index = sections.indexOf(body.sectionKey);
    if (index < 0) throw new ApiError('Unknown onboarding section.');
    const section = questions.filter((q) => q.section_key === body.sectionKey);
    const answers = body.answers as Record<string, unknown>;
    if (
      Object.keys(answers).some(
        (key) => !section.some((q) => q.question_key === key),
      ) ||
      section.some((q) => !validateAnswer(q, answers[q.question_key]))
    )
      throw new ApiError('Complete the required questions with valid answers.');
    const { data: saved, error: savedError } = await supabase
      .from('onboarding_answers')
      .select('question_id,answer_value')
      .eq('organization_id', membership!.organization_id);
    dbError(savedError);
    const merged = new Map(
      (saved || []).map((a) => [a.question_id, a.answer_value]),
    );
    for (const q of section) merged.set(q.id, answers[q.question_key] ?? '');
    const required = questions.filter(
      (q) => body.completed || sections.indexOf(q.section_key) < index,
    );
    if (required.some((q) => !validateAnswer(q, merged.get(q.id))))
      throw new ApiError('Complete the earlier sections first.', 409);
    if (body.completed && index !== sections.length - 1)
      throw new ApiError('Complete the final section first.');
    const rows = section.map((q) => ({
      organization_id: membership!.organization_id,
      question_id: q.id,
      answer_value: answers[q.question_key] ?? '',
      answered_by: user!.id,
    }));
    const savedResult = await supabase
      .from('onboarding_answers')
      .upsert(rows, { onConflict: 'organization_id,question_id' });
    dbError(savedResult.error);
    const stateResult = await supabase.from('organization_onboarding').upsert(
      {
        organization_id: membership!.organization_id,
        status: body.completed ? 'completed' : 'in_progress',
        current_step: index + 2,
        completed_at: body.completed ? new Date().toISOString() : null,
      },
      { onConflict: 'organization_id' },
    );
    dbError(stateResult.error);
    if (body.completed) {
      const websiteQuestion = questions.find(
        (question) => question.question_key === 'portfolio_url',
      );
      const website = websiteQuestion ? merged.get(websiteQuestion.id) : null;
      if (typeof website === 'string' && website.trim()) {
        const normalizedWebsite = normalizePublicWebsite(website.trim());
        const admin = createAdminClient();
        const actionRunId = await acquireProductActionRun(admin, {
          organizationId: membership!.organization_id,
          userId: user!.id,
          actionType: 'thesis_generation',
          resourceKey: normalizedWebsite,
        });
        try {
          const queued = await enqueueThesisEngineJob(admin, {
            organizationId: membership!.organization_id,
            userId: user!.id,
            resourceKey: normalizedWebsite,
            sourceUrl: normalizedWebsite,
            actionRunId,
          });
          if (queued.reused)
            await finishProductActionRun(admin, actionRunId, 'completed');
          else scheduleEngineWorkerDispatch(request);
        } catch (error) {
          await finishProductActionRun(admin, actionRunId, 'failed');
          throw error;
        }
      }
    }
    return { ok: true };
  });
}
