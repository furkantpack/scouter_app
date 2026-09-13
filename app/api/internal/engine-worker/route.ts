import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';

import { hasValidCronAuthorization } from '@/lib/cron-auth';
import {
  claimEngineJobs,
  finishEngineJob,
  hasClaimableEngineJob,
  heartbeatEngineJob,
  type EngineJob,
} from '@/lib/engine-jobs';
import { scheduleEngineWorkerDispatch } from '@/lib/engine-worker-dispatch';
import {
  processFundedCompanyAnalysis,
  type ReferenceRecord,
} from '@/lib/funded-intelligence/orchestrator';
import { processNetworkRun } from '@/lib/network/orchestrator';
import type { NetworkInput } from '@/lib/network/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPreparedThesisGeneration } from '@/lib/thesis/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const LEASE_SECONDS = 10 * 60;
const HEARTBEAT_MS = 60_000;

class InvalidJobPayloadError extends Error {}

function safeErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('429') || message.includes('rate limit'))
    return 'provider_rate_limited';
  if (message.includes('timeout') || message.includes('timed out'))
    return 'provider_timeout';
  if (message.includes('503') || message.includes('unavailable'))
    return 'provider_unavailable';
  if (message.includes('malformed') || message.includes('invalid json'))
    return 'provider_invalid_response';
  if (message.includes('payload')) return 'invalid_job_payload';
  return 'engine_failed';
}

function startHeartbeat(
  supabase: ReturnType<typeof createAdminClient>,
  job: EngineJob,
  leaseOwner: string,
) {
  let stopped = false;
  let pending = false;
  const timer = setInterval(async () => {
    if (stopped || pending) return;
    pending = true;
    try {
      await heartbeatEngineJob(supabase, job.id, leaseOwner, LEASE_SECONDS);
    } finally {
      pending = false;
    }
  }, HEARTBEAT_MS);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function failInvalidJob(
  supabase: ReturnType<typeof createAdminClient>,
  job: EngineJob,
  errorCode: string,
) {
  const now = new Date().toISOString();
  if (job.engine_type === 'network') {
    await supabase
      .from('network_runs')
      .update({
        status: 'failed',
        error: errorCode,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', job.engine_run_id)
      .in('status', [
        'queued',
        'building_reference',
        'sourcing',
        'enriching',
        'scoring',
      ]);
  } else if (job.engine_type === 'funded_company_analysis') {
    await supabase
      .from('funded_company_analyses')
      .update({
        status: 'failed',
        error: errorCode,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', job.engine_run_id)
      .in('status', ['queued', 'running']);
  } else {
    const generationId = record(job.payload)?.generation_id;
    await supabase.from('vc_thesis_dimensions').insert({
      thesis_id: job.engine_run_id,
      dimension_type: 'generation_status',
      value: 'failed',
      weight: 1,
      confidence: 1,
      metadata: {
        generation_id: typeof generationId === 'string' ? generationId : null,
        status: 'failed',
        error_code: errorCode,
        recorded_at: now,
      },
    });
    await supabase
      .from('vc_theses')
      .update({ status: 'draft', updated_at: now })
      .eq('id', job.engine_run_id);
  }
}

async function executeJob(
  supabase: ReturnType<typeof createAdminClient>,
  job: EngineJob,
) {
  const payload = record(job.payload);
  if (!payload) throw new InvalidJobPayloadError('Invalid job payload.');

  if (job.engine_type === 'network') {
    const input = record(payload.input) as NetworkInput | null;
    if (!input || typeof input.companyName !== 'string')
      throw new InvalidJobPayloadError('Invalid job payload.');
    return processNetworkRun({
      supabase,
      runId: job.engine_run_id,
      organizationId: job.organization_id,
      input,
    });
  }

  if (job.engine_type === 'funded_company_analysis') {
    const reference = record(payload.reference) as ReferenceRecord | null;
    if (!reference) throw new InvalidJobPayloadError('Invalid job payload.');
    return processFundedCompanyAnalysis({
      supabase,
      analysisId: job.engine_run_id,
      organizationId: job.organization_id,
      reference,
    });
  }

  const sourceUrl = payload.source_url;
  const generationId = payload.generation_id;
  if (typeof sourceUrl !== 'string' || typeof generationId !== 'string')
    throw new InvalidJobPayloadError('Invalid job payload.');
  await processPreparedThesisGeneration(
    {
      supabase,
      organizationId: job.organization_id,
      userId: job.user_id,
      sourceUrl,
    },
    {
      thesisId: job.engine_run_id,
      sourceUrl,
      generationId,
      status: 'crawling',
      queued: true,
    },
  );
  return 'completed' as const;
}

function authorizeWorker(request: Request) {
  if (!process.env.CRON_SECRET)
    return NextResponse.json(
      { error: 'Worker authentication is not configured.' },
      { status: 503 },
    );
  if (!hasValidCronAuthorization(request.headers.get('authorization')))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  return null;
}

async function scheduleNextWorkerIfQueued(
  request: Request,
  admin: ReturnType<typeof createAdminClient>,
) {
  try {
    if (await hasClaimableEngineJob(admin))
      scheduleEngineWorkerDispatch(request);
  } catch {
    // The queued job remains durable for the next immediate dispatch or cron.
  }
}

async function runWorker(request: Request) {
  const admin = createAdminClient();
  const leaseOwner = `engine-worker:${randomUUID()}`;
  const jobs = await claimEngineJobs(admin, leaseOwner, 1, LEASE_SECONDS);
  const job = jobs[0];
  if (!job)
    return NextResponse.json(
      { claimed: 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    );

  const stopHeartbeat = startHeartbeat(admin, job, leaseOwner);
  try {
    await heartbeatEngineJob(admin, job.id, leaseOwner, LEASE_SECONDS);
    const result = await executeJob(admin, job);
    const status =
      result === 'partial'
        ? 'partial'
        : result === 'failed'
          ? 'failed'
          : 'completed';
    await finishEngineJob(
      admin,
      job.id,
      leaseOwner,
      status,
      status === 'failed' ? 'engine_failed' : undefined,
    );
    return NextResponse.json(
      { claimed: 1, jobId: job.id, engineType: job.engine_type, status },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (
      error instanceof InvalidJobPayloadError ||
      job.engine_type !== 'thesis_generation'
    )
      await failInvalidJob(admin, job, errorCode);
    await finishEngineJob(admin, job.id, leaseOwner, 'failed', errorCode);
    return NextResponse.json(
      {
        claimed: 1,
        jobId: job.id,
        engineType: job.engine_type,
        status: 'failed',
        error: errorCode,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    stopHeartbeat();
    await scheduleNextWorkerIfQueued(request, admin);
  }
}

async function runWorkerInBackground(request: Request) {
  try {
    await runWorker(request);
  } catch {
    // The durable job remains queued (or leased for recovery) if dispatch fails.
  }
}

export async function GET(request: Request) {
  const denied = authorizeWorker(request);
  if (denied) return denied;
  return runWorker(request);
}

export async function POST(request: Request) {
  const denied = authorizeWorker(request);
  if (denied) return denied;
  waitUntil(runWorkerInBackground(request));
  return NextResponse.json(
    { accepted: true },
    { status: 202, headers: { 'Cache-Control': 'no-store' } },
  );
}
