import { enqueueThesisEngineJob } from '@/lib/engine-jobs';
import { scheduleEngineWorkerDispatch } from '@/lib/engine-worker-dispatch';
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
import { normalizePublicWebsite } from '@/lib/thesis/url';

export async function POST(request: Request) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    requireWorkspaceRole(membership);
    const body = await bodyOf(request);
    let sourceUrl =
      typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    if (!sourceUrl) {
      const question = await supabase
        .from('onboarding_questions')
        .select('id')
        .eq('question_key', 'portfolio_url')
        .eq('is_active', true)
        .maybeSingle();
      dbError(question.error);
      if (question.data) {
        const answer = await supabase
          .from('onboarding_answers')
          .select('answer_value')
          .eq('organization_id', membership!.organization_id)
          .eq('question_id', question.data.id)
          .maybeSingle();
        dbError(answer.error);
        sourceUrl =
          typeof answer.data?.answer_value === 'string'
            ? answer.data.answer_value
            : '';
      }
    }
    if (!sourceUrl) {
      const existing = await supabase
        .from('vc_theses')
        .select('source_url')
        .eq('organization_id', membership!.organization_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      dbError(existing.error);
      sourceUrl = existing.data?.source_url || '';
    }
    const normalized = normalizePublicWebsite(sourceUrl);
    const throttleAdmin = createAdminClient();
    const actionRunId = await acquireProductActionRun(throttleAdmin, {
      organizationId: membership!.organization_id,
      userId: user!.id,
      actionType: 'thesis_generation',
      resourceKey: normalized,
    });
    let queued;
    try {
      queued = await enqueueThesisEngineJob(throttleAdmin, {
        organizationId: membership!.organization_id,
        userId: user!.id,
        resourceKey: normalized,
        sourceUrl: normalized,
        actionRunId,
      });
    } catch {
      await finishProductActionRun(throttleAdmin, actionRunId, 'failed');
      throw new ApiError('Thesis generation could not be queued.', 503);
    }
    if (queued.reused)
      await finishProductActionRun(throttleAdmin, actionRunId, 'completed');
    else scheduleEngineWorkerDispatch(request);
    return {
      queued: !queued.reused,
      status: queued.status,
      sourceUrl: normalized,
    };
  });
}
