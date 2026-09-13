import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReferenceRecord } from '@/lib/funded-intelligence/orchestrator';
import type { NetworkInput } from '@/lib/network/types';

export type EngineJobStatus =
  'queued' | 'running' | 'completed' | 'partial' | 'failed';

export type EngineJob = {
  id: string;
  organization_id: string;
  user_id: string;
  engine_type: 'network' | 'funded_company_analysis' | 'thesis_generation';
  resource_key: string;
  engine_run_id: string;
  action_run_id: string | null;
  payload: Record<string, unknown>;
  status: EngineJobStatus;
  attempts: number;
  max_attempts: number;
  lease_owner: string | null;
  lease_expires_at: string;
};

function firstRow<T>(data: unknown, context: string) {
  const row = (Array.isArray(data) ? data[0] : data) as T | null;
  if (!row) throw new Error(`${context} returned no row.`);
  return row;
}

export async function recoverStaleEngineJobs(supabase: SupabaseClient) {
  const result = await supabase.rpc('recover_stale_engine_jobs');
  if (result.error) throw new Error('Durable engine recovery is unavailable.');
  return Number(result.data) || 0;
}

export async function enqueueNetworkEngineJob(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    resourceKey: string;
    networkInput: NetworkInput;
    referenceCompany: Record<string, unknown>;
    actionRunId: string;
  },
) {
  const result = await supabase.rpc('enqueue_network_engine_job', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_resource_key: input.resourceKey,
    p_input: input.networkInput,
    p_reference_company: input.referenceCompany,
    p_action_run_id: input.actionRunId,
  });
  if (result.error) throw new Error('Network job could not be queued.');
  return firstRow<{ job_id: string; run_id: string; reused: boolean }>(
    result.data,
    'Network enqueue',
  );
}

export async function enqueueFundedEngineJob(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    resourceKey: string;
    fundedCompanyId: string;
    investorId: string | null;
    reference: ReferenceRecord;
    engineVersion: string;
    actionRunId: string;
  },
) {
  const result = await supabase.rpc('enqueue_funded_engine_job', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_resource_key: input.resourceKey,
    p_funded_company_id: input.fundedCompanyId,
    p_investor_id: input.investorId,
    p_reference: input.reference,
    p_engine_version: input.engineVersion,
    p_action_run_id: input.actionRunId,
  });
  if (result.error)
    throw new Error('Funded Intelligence job could not be queued.');
  return firstRow<{
    job_id: string;
    analysis_id: string;
    reused: boolean;
  }>(result.data, 'Funded enqueue');
}

export async function enqueueThesisEngineJob(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    resourceKey: string;
    sourceUrl: string;
    actionRunId: string;
  },
) {
  const result = await supabase.rpc('enqueue_thesis_engine_job', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_resource_key: input.resourceKey,
    p_source_url: input.sourceUrl,
    p_action_run_id: input.actionRunId,
  });
  if (result.error) throw new Error('Thesis job could not be queued.');
  return firstRow<{
    job_id: string;
    thesis_id: string;
    generation_id: string;
    status: string;
    reused: boolean;
  }>(result.data, 'Thesis enqueue');
}

export async function claimEngineJobs(
  supabase: SupabaseClient,
  leaseOwner: string,
  limit = 1,
  leaseSeconds = 600,
) {
  const result = await supabase.rpc('claim_engine_jobs', {
    p_lease_owner: leaseOwner,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });
  if (result.error)
    throw new Error('Durable engine queue could not be claimed.');
  return (result.data || []) as EngineJob[];
}

export async function hasClaimableEngineJob(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const result = await supabase
    .from('engine_jobs')
    .select('id')
    .eq('status', 'queued')
    .lte('available_at', now)
    .gt('lease_expires_at', now)
    .limit(1);
  if (result.error)
    throw new Error('Durable engine queue availability is unavailable.');
  return Boolean(result.data?.length);
}

export async function heartbeatEngineJob(
  supabase: SupabaseClient,
  jobId: string,
  leaseOwner: string,
  leaseSeconds = 600,
) {
  const result = await supabase.rpc('heartbeat_engine_job', {
    p_job_id: jobId,
    p_lease_owner: leaseOwner,
    p_lease_seconds: leaseSeconds,
  });
  return !result.error && result.data === true;
}

export async function finishEngineJob(
  supabase: SupabaseClient,
  jobId: string,
  leaseOwner: string,
  status: Extract<EngineJobStatus, 'completed' | 'partial' | 'failed'>,
  errorCode?: string,
) {
  const result = await supabase.rpc('finish_engine_job', {
    p_job_id: jobId,
    p_lease_owner: leaseOwner,
    p_status: status,
    p_error_code: errorCode || null,
  });
  return !result.error && result.data === true;
}
