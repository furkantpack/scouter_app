import {
  enqueueNetworkEngineJob,
  recoverStaleEngineJobs,
} from '@/lib/engine-jobs';
import { scheduleEngineWorkerDispatch } from '@/lib/engine-worker-dispatch';
import { networkFingerprint } from '@/lib/network/orchestrator';
import type { NetworkInput } from '@/lib/network/types';
import {
  ApiError,
  bodyOf,
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

const ACTIVE = [
  'queued',
  'building_reference',
  'sourcing',
  'enriching',
  'scoring',
];
const HISTORY_LIMIT = 20;

function optionalUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new ApiError('Enter a valid public URL.');
  }
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

function techEuRoundSnapshot(
  value: unknown,
  companyId: string,
  roundId: string,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const row = value as Record<string, unknown>;
  const company =
    row.company &&
    typeof row.company === 'object' &&
    !Array.isArray(row.company)
      ? (row.company as Record<string, unknown>)
      : null;
  const url = optionalUrl(row.url);
  if (
    !url ||
    new URL(url).hostname !== 'funding.tech.eu' ||
    !company ||
    String(company.id).toLowerCase() !== companyId.toLowerCase()
  )
    return undefined;
  const date = text(row.date, 32);
  if (date && !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date)) return undefined;
  const amount = row.amountEur == null ? null : Number(row.amountEur);
  if (amount != null && (!Number.isFinite(amount) || amount < 0))
    return undefined;
  const strings = (input: unknown, max = 20) =>
    Array.isArray(input)
      ? input
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim().slice(0, 160))
          .filter(Boolean)
          .slice(0, max)
      : [];
  return {
    url,
    date,
    stage: text(row.stage, 80),
    amountEur: amount,
    investors: strings(row.investors),
    company: {
      id: companyId,
      name: text(company.name, 160) || '',
      country: text(company.country, 80),
      sectors: strings(company.sectors, 12),
    },
    source:
      row.source && typeof row.source === 'object' && !Array.isArray(row.source)
        ? {
            domain:
              text((row.source as Record<string, unknown>).domain, 160) ||
              undefined,
            tier:
              text((row.source as Record<string, unknown>).tier, 40) ||
              undefined,
          }
        : null,
    confidence: text(row.confidence, 40),
  };
}

export async function GET(request: Request) {
  return withWorkspace(request, async ({ supabase, membership }) => {
    const url = new URL(request.url);
    const requestedId = url.searchParams.get('runId');
    if (requestedId && !uuid(requestedId))
      throw new ApiError('Invalid Network run id.');

    const historyResult = await supabase
      .from('network_runs')
      .select('id,status,input,reference_company,created_at')
      .eq('organization_id', membership!.organization_id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    dbError(historyResult.error);

    const latestId = historyResult.data?.[0]?.id;
    const selectedId = requestedId || latestId;
    if (!selectedId) return { run: null, candidates: [], runs: [] };

    const runResult = await supabase
      .from('network_runs')
      .select('*')
      .eq('organization_id', membership!.organization_id)
      .eq('id', selectedId)
      .maybeSingle();
    dbError(runResult.error);
    if (!runResult.data) throw new ApiError('Network run not found.', 404);

    const recentRuns = historyResult.data || [];
    const history = recentRuns.some((run) => run.id === runResult.data.id)
      ? recentRuns
      : [runResult.data, ...recentRuns.slice(0, HISTORY_LIMIT - 1)];
    const historyIds = history.map((run) => run.id);
    const [candidateCountsResult, candidatesResult] = await Promise.all([
      supabase
        .from('network_candidates')
        .select('network_run_id')
        .eq('organization_id', membership!.organization_id)
        .in('network_run_id', historyIds),
      supabase
        .from('network_candidates')
        .select('*')
        .eq('organization_id', membership!.organization_id)
        .eq('network_run_id', runResult.data.id)
        .order('rank', { ascending: true }),
    ]);
    dbError(candidateCountsResult.error);
    dbError(candidatesResult.error);
    const candidateCounts = new Map<string, number>();
    for (const candidate of candidateCountsResult.data || []) {
      candidateCounts.set(
        candidate.network_run_id,
        (candidateCounts.get(candidate.network_run_id) || 0) + 1,
      );
    }
    return {
      run: runResult.data,
      candidates: candidatesResult.data || [],
      runs: history.map((run) => ({
        id: run.id,
        status: run.status,
        input: run.input,
        reference_company: run.reference_company,
        created_at: run.created_at,
        candidate_count: candidateCounts.get(run.id) || 0,
      })),
    };
  });
}

export async function POST(request: Request) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    requireWorkspaceRole(membership);
    const body = await bodyOf(request);
    const companyName =
      typeof body.companyName === 'string'
        ? body.companyName.trim().slice(0, 160)
        : '';
    if (!companyName) throw new ApiError('Company name is required.');
    const input: NetworkInput = {
      companyName,
      companyUrl: optionalUrl(body.companyUrl),
      fundingUrl: optionalUrl(body.fundingUrl),
    };
    if (
      body.techEu &&
      typeof body.techEu === 'object' &&
      !Array.isArray(body.techEu)
    ) {
      const techEu = body.techEu as Record<string, unknown>;
      if (!uuid(techEu.companyId) || !uuid(techEu.roundId))
        throw new ApiError('Invalid Tech.eu funding selection.');
      input.techEu = {
        companyId: techEu.companyId,
        roundId: techEu.roundId,
        round: techEuRoundSnapshot(
          techEu.round,
          techEu.companyId,
          techEu.roundId,
        ),
      };
      input.fundingUrl = null;
    }
    const fingerprint = networkFingerprint(membership!.organization_id, input);
    const networkAdmin = createAdminClient();
    await recoverStaleEngineJobs(networkAdmin);
    const active = await supabase
      .from('network_runs')
      .select('*')
      .eq('organization_id', membership!.organization_id)
      .eq('input_fingerprint', fingerprint)
      .in('status', ACTIVE)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    dbError(active.error);
    if (active.data) return { run: active.data, reused: true };
    const actionRunId = await acquireProductActionRun(networkAdmin, {
      organizationId: membership!.organization_id,
      userId: user!.id,
      actionType: 'network_analysis',
      resourceKey: fingerprint,
    });
    let queued;
    try {
      queued = await enqueueNetworkEngineJob(networkAdmin, {
        organizationId: membership!.organization_id,
        userId: user!.id,
        resourceKey: fingerprint,
        networkInput: input,
        referenceCompany: {
          name: companyName,
          website: input.companyUrl || null,
        },
        actionRunId,
      });
    } catch {
      await finishProductActionRun(networkAdmin, actionRunId, 'failed');
      throw new ApiError('Network analysis could not be queued.', 503);
    }
    if (queued.reused)
      await finishProductActionRun(networkAdmin, actionRunId, 'completed');
    else scheduleEngineWorkerDispatch(request);
    const created = await networkAdmin
      .from('network_runs')
      .select('*')
      .eq('id', queued.run_id)
      .single();
    if (created.error || !created.data)
      throw new ApiError(
        'Network analysis was queued but could not be loaded.',
        503,
      );
    return { run: created.data, reused: queued.reused };
  });
}
