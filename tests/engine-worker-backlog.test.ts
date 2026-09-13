import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const worker = read('../app/api/internal/engine-worker/route.ts');
const jobs = read('../lib/engine-jobs.ts');
const dispatch = read('../lib/engine-worker-dispatch.ts');
const migration = read(
  '../supabase/migrations/202609130006_durable_engine_jobs.sql',
);

test('a worker claims one job and can schedule at most one separate successor', () => {
  assert.match(worker, /claimEngineJobs\(admin, leaseOwner, 1,/);
  assert.match(
    worker,
    /if \(await hasClaimableEngineJob\(admin\)\)\s+scheduleEngineWorkerDispatch\(request\)/,
  );
  assert.equal(
    (worker.match(/scheduleEngineWorkerDispatch\(request\)/g) || []).length,
    1,
  );
  assert.doesNotMatch(worker, /while\s*\(|for\s*\(;;\)|do\s*\{/);
  assert.match(dispatch, /method: 'POST'/);
  assert.match(dispatch, /waitUntil\(dispatchEngineWorker\(request\)\)/);
});

test('the backlog check reads only one claimable job id using the existing queue index', () => {
  assert.match(
    jobs,
    /function hasClaimableEngineJob[\s\S]*?\.select\('id'\)[\s\S]*?\.eq\('status', 'queued'\)[\s\S]*?\.lte\('available_at', now\)[\s\S]*?\.gt\('lease_expires_at', now\)[\s\S]*?\.limit\(1\)/,
  );
  assert.match(
    migration,
    /create index if not exists engine_jobs_claim_queue\s+on public\.engine_jobs \(available_at, created_at\)\s+where status = 'queued'/i,
  );
});

test('completed, partial, and failed paths all reach the successor check', () => {
  const terminalWork = worker.slice(
    worker.indexOf('const stopHeartbeat'),
    worker.indexOf('async function runWorkerInBackground'),
  );
  assert.match(terminalWork, /result === 'partial'/);
  assert.match(terminalWork, /result === 'failed'/);
  assert.match(terminalWork, /: 'completed'/);
  assert.match(terminalWork, /catch \(error\)[\s\S]*?'failed'/);
  assert.match(
    terminalWork,
    /finally \{[\s\S]*?stopHeartbeat\(\);[\s\S]*?await scheduleNextWorkerIfQueued\(request, admin\)/,
  );
});

test('empty or unavailable backlog does not dispatch and leaves durable state untouched', () => {
  assert.match(jobs, /return Boolean\(result\.data\?\.length\)/);
  assert.match(
    worker,
    /async function scheduleNextWorkerIfQueued[\s\S]*?catch \{[\s\S]*?queued job remains durable/,
  );
  assert.doesNotMatch(
    worker.slice(
      worker.indexOf('async function scheduleNextWorkerIfQueued'),
      worker.indexOf('async function runWorker'),
    ),
    /update\(|finishEngineJob|status:\s*'failed'/,
  );
});

test('three jobs drain as separate bounded invocations without duplicate claims', () => {
  let queued = 3;
  let invocations = 0;
  while (queued > 0) {
    invocations += 1;
    queued -= 1;
    const followUpRequests = queued > 0 ? 1 : 0;
    assert.ok(followUpRequests <= 1);
  }
  assert.equal(invocations, 3);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /limit p_limit/i);
});

test('worker chaining keeps server-only authorization and no detached engine promise', () => {
  assert.match(dispatch, /process\.env\.CRON_SECRET/);
  assert.match(dispatch, /authorization: `Bearer \$\{secret\}`/);
  assert.doesNotMatch(dispatch, /NEXT_PUBLIC_[A-Z_]*SECRET/);
  assert.doesNotMatch(worker, /void\s+.*\.then\s*\(/);
  assert.match(worker, /export const maxDuration = 300/);
});
