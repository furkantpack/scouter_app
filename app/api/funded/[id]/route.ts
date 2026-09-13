import {
  enqueueFundedEngineJob,
  recoverStaleEngineJobs,
} from '@/lib/engine-jobs';
import { scheduleEngineWorkerDispatch } from '@/lib/engine-worker-dispatch';
import { FUNDED_INTELLIGENCE_ENGINE_VERSION } from '@/lib/funded-intelligence/orchestrator';
import { loadFundedReference } from '@/lib/funded-intelligence/reference';
import {
  ApiError,
  dbError,
  requireWorkspaceRole,
  uuid,
  withWorkspace,
} from '@/lib/product-api';
import {
  acquireProductActionRun,
  finishProductActionRun,
} from '@/lib/product-throttle';
import { createAdminClient } from '@/lib/supabase/admin';

const ACTIVE = ['queued', 'running'];

function isMissingIntelligenceSchema(
  error: { code?: string; message?: string } | null,
) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('funded_company_analyses')),
  );
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, membership }) => {
    if (!uuid(params.id)) throw new ApiError('Invalid funded company id.');
    const company = await loadFundedReference(
      supabase,
      membership!.organization_id,
      params.id,
    );
    if (!company) throw new ApiError('Funded company not found.', 404);
    const analysisResult = await supabase
      .from('funded_company_analyses')
      .select('*')
      .eq('organization_id', membership!.organization_id)
      .eq('funded_company_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (isMissingIntelligenceSchema(analysisResult.error)) {
      return {
        company,
        analysis: null,
        candidates: [],
        signals: [],
        migrationRequired: true,
      };
    }
    dbError(analysisResult.error);
    const analysis = analysisResult.data;
    if (!analysis)
      return { company, analysis: null, candidates: [], signals: [] };
    const [candidates, signals] = await Promise.all([
      supabase
        .from('funded_company_candidates')
        .select('*')
        .eq('analysis_id', analysis.id)
        .order('rank', { ascending: true }),
      supabase
        .from('funded_company_signals')
        .select('*')
        .eq('analysis_id', analysis.id)
        .order('signal_date', { ascending: false, nullsFirst: false }),
    ]);
    dbError(candidates.error);
    dbError(signals.error);
    return {
      company,
      analysis,
      candidates: candidates.data || [],
      signals: signals.data || [],
    };
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, membership, user }) => {
    requireWorkspaceRole(membership);
    if (!uuid(params.id)) throw new ApiError('Invalid funded company id.');
    const company = await loadFundedReference(
      supabase,
      membership!.organization_id,
      params.id,
    );
    if (!company) throw new ApiError('Funded company not found.', 404);
    const admin = createAdminClient();
    await recoverStaleEngineJobs(admin);
    const active = await admin
      .from('funded_company_analyses')
      .select('*')
      .eq('organization_id', membership!.organization_id)
      .eq('funded_company_id', params.id)
      .in('status', ACTIVE)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active.error) throw new ApiError(active.error.message, 503);
    if (active.data) return { analysis: active.data, reused: true };
    const actionRunId = await acquireProductActionRun(admin, {
      organizationId: membership!.organization_id,
      userId: user!.id,
      actionType: 'funded_company_analysis',
      resourceKey: params.id,
    });
    let queued;
    try {
      queued = await enqueueFundedEngineJob(admin, {
        organizationId: membership!.organization_id,
        userId: user!.id,
        resourceKey: params.id,
        fundedCompanyId: params.id,
        investorId: company.thesisId,
        reference: company,
        engineVersion: FUNDED_INTELLIGENCE_ENGINE_VERSION,
        actionRunId,
      });
    } catch {
      await finishProductActionRun(admin, actionRunId, 'failed');
      throw new ApiError('Funded Intelligence could not be queued.', 503);
    }
    if (queued.reused)
      await finishProductActionRun(admin, actionRunId, 'completed');
    else scheduleEngineWorkerDispatch(request);
    const created = await admin
      .from('funded_company_analyses')
      .select('*')
      .eq('id', queued.analysis_id)
      .single();
    if (created.error || !created.data)
      throw new ApiError(
        'Funded Intelligence was queued but could not be loaded.',
        503,
      );
    return { analysis: created.data, reused: queued.reused };
  });
}
