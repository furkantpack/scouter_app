import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read(
  '../supabase/migrations/202609130006_durable_engine_jobs.sql',
);
const networkRoute = read('../app/api/network/route.ts');
const fundedRoute = read('../app/api/funded/[id]/route.ts');
const thesisRoute = read('../app/api/thesis/generate/route.ts');
const onboardingRoute = read('../app/api/onboarding/route.ts');
const workerRoute = read('../app/api/internal/engine-worker/route.ts');
const workerDispatch = read('../lib/engine-worker-dispatch.ts');
const cronAuth = read('../lib/cron-auth.ts');

test('engine queue is private and every browser engine POST durably enqueues work', () => {
  assert.match(migration, /create table if not exists public\.engine_jobs/i);
  for (const role of ['public', 'anon', 'authenticated'])
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.engine_jobs from ${role}`,
        'i',
      ),
    );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.engine_jobs to service_role/i,
  );

  assert.match(networkRoute, /await enqueueNetworkEngineJob\(networkAdmin,/);
  assert.match(fundedRoute, /await enqueueFundedEngineJob\(admin,/);
  assert.match(thesisRoute, /await enqueueThesisEngineJob\(throttleAdmin,/);
  assert.match(onboardingRoute, /await enqueueThesisEngineJob\(admin,/);

  for (const route of [
    networkRoute,
    fundedRoute,
    thesisRoute,
    onboardingRoute,
  ]) {
    assert.doesNotMatch(route, /void\s+[\w.]+\.then\s*\(/);
    assert.doesNotMatch(route, /queueThesisGeneration\s*\(/);
  }
});

test('new durable jobs schedule an immediate worker request without duplicating reused work', () => {
  for (const [name, route, enqueue] of [
    ['network', networkRoute, 'enqueueNetworkEngineJob'],
    ['funded', fundedRoute, 'enqueueFundedEngineJob'],
    ['thesis', thesisRoute, 'enqueueThesisEngineJob'],
    ['onboarding thesis', onboardingRoute, 'enqueueThesisEngineJob'],
  ] as const) {
    const queued = route.indexOf(`await ${enqueue}`);
    const reused = route.indexOf('if (queued.reused)', queued);
    const dispatch = route.indexOf('else scheduleEngineWorkerDispatch(request)', reused);
    assert.ok(queued >= 0 && reused > queued && dispatch > reused, `${name} dispatch ordering`);
  }

  assert.match(workerDispatch, /waitUntil\(dispatchEngineWorker\(request\)\)/);
  assert.match(workerDispatch, /method: 'POST'/);
  assert.match(workerDispatch, /authorization: `Bearer \$\{secret\}`/);
  assert.match(workerDispatch, /return response\.status === 202/);
  assert.match(workerDispatch, /catch \{[\s\S]*return false/);
  assert.doesNotMatch(workerDispatch, /NEXT_PUBLIC_[A-Z_]*SECRET|void\s+.*\.then\s*\(/);
});

test('enqueue functions serialize resource creation and create run plus job atomically', () => {
  for (const name of [
    'enqueue_network_engine_job',
    'enqueue_funded_engine_job',
    'enqueue_thesis_engine_job',
  ]) {
    const start = migration.indexOf(`function public.${name}`);
    assert.ok(start >= 0, `${name} is missing`);
    const body = migration.slice(start, migration.indexOf('$$;', start) + 3);
    assert.match(body, /pg_advisory_xact_lock/i);
    assert.match(body, /insert into public\.engine_jobs/i);
  }
  assert.match(
    migration,
    /unique index if not exists engine_jobs_one_active_resource[\s\S]*where status in \('queued', 'running'\)/i,
  );
});

test('worker claims atomically and two workers cannot claim the same job', () => {
  const start = migration.indexOf('function public.claim_engine_jobs');
  const claim = migration.slice(start, migration.indexOf('$$;', start) + 3);
  assert.match(claim, /for update skip locked/i);
  assert.match(claim, /status = 'running'/i);
  assert.match(claim, /lease_owner = p_lease_owner/i);
  assert.match(claim, /attempts = job\.attempts \+ 1/i);
});

test('expired and orphaned engine states are terminalized with throttle cleanup', () => {
  const start = migration.indexOf('function public.recover_stale_engine_jobs');
  const recovery = migration.slice(start, migration.indexOf('$$;', start) + 3);
  assert.match(recovery, /lease_expires_at <= v_now/i);
  assert.match(recovery, /worker_lease_expired/i);
  assert.match(recovery, /queue_lease_expired/i);
  assert.match(recovery, /update public\.product_action_runs/i);
  assert.match(recovery, /update public\.network_runs/i);
  assert.match(recovery, /update public\.funded_company_analyses/i);
  assert.match(recovery, /insert into public\.vc_thesis_dimensions/i);
  assert.match(recovery, /orphaned_without_durable_job/i);
});

test('terminal jobs finalize completed, partial, or failed throttle state', () => {
  const start = migration.indexOf('function public.finish_engine_job');
  const finish = migration.slice(start, migration.indexOf('$$;', start) + 3);
  assert.match(finish, /p_status not in \('completed', 'partial', 'failed'\)/i);
  assert.match(finish, /update public\.product_action_runs/i);
  assert.match(finish, /where id = v_action_run_id and status = 'active'/i);
});

test('enqueue and heartbeat keep the throttle lease aligned with durable work', () => {
  assert.equal(
    (
      migration.match(
        /set expires_at = greatest\(expires_at, clock_timestamp\(\) \+ interval '4 hours'\)/gi,
      ) || []
    ).length,
    3,
  );
  const start = migration.indexOf('function public.heartbeat_engine_job');
  const heartbeat = migration.slice(start, migration.indexOf('$$;', start) + 3);
  assert.match(heartbeat, /returning action_run_id into v_action_run_id/i);
  assert.match(heartbeat, /update public\.product_action_runs/i);
  assert.match(heartbeat, /make_interval\(secs => p_lease_seconds\)/i);
});

test('worker is secret-protected, bounded, heartbeating, and reuses existing engines', () => {
  const admin = workerRoute.indexOf('const admin = createAdminClient()');
  const cronAuthCheck = workerRoute.indexOf('hasValidCronAuthorization(');
  assert.ok(cronAuthCheck >= 0 && admin > cronAuthCheck);
  assert.match(cronAuth, /process\.env\.CRON_SECRET/);
  assert.match(cronAuth, /timingSafeEqual/);
  assert.match(workerRoute, /claimEngineJobs\(admin, leaseOwner, 1,/);
  assert.match(workerRoute, /heartbeatEngineJob/);
  assert.match(workerRoute, /processNetworkRun/);
  assert.match(workerRoute, /processFundedCompanyAnalysis/);
  assert.match(workerRoute, /processPreparedThesisGeneration/);
  assert.match(workerRoute, /finishEngineJob/);
  assert.match(workerRoute, /waitUntil\(runWorkerInBackground\(request\)\)/);
  assert.match(workerRoute, /\{ accepted: true \}/);
  assert.match(workerRoute, /status: 202/);
});

test('member and viewer authorization remains before queue or service-role use', () => {
  for (const [name, route, enqueue] of [
    ['network', networkRoute, 'enqueueNetworkEngineJob'],
    ['funded', fundedRoute, 'enqueueFundedEngineJob'],
    ['thesis', thesisRoute, 'enqueueThesisEngineJob'],
  ] as const) {
    const post = route.slice(route.indexOf('export async function POST'));
    const guard = post.indexOf('requireWorkspaceRole(membership)');
    const admin = post.indexOf('createAdminClient()');
    const queued = post.indexOf(enqueue);
    assert.ok(
      guard >= 0 && admin > guard && queued > admin,
      `${name} ordering`,
    );
  }
});
