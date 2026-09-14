import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const route = read('../app/api/onboarding/route.ts');
const dispatch = read('../lib/engine-worker-dispatch.ts');

test('a successfully queued onboarding job cannot be invalidated by dispatch registration', () => {
  const enqueue = route.indexOf('queued = await enqueueThesisEngineJob');
  const enqueueFailure = route.indexOf(
    "throw new ApiError('Thesis generation could not be queued.', 503)",
    enqueue,
  );
  const dispatchCall = route.indexOf(
    'scheduleEngineWorkerDispatch(request)',
    enqueueFailure,
  );
  const success = route.indexOf(
    "console.info('[onboarding] response', { status: 200 })",
  );

  assert.ok(enqueue >= 0);
  assert.ok(enqueueFailure > enqueue);
  assert.ok(dispatchCall > enqueueFailure);
  assert.ok(success > dispatchCall);
  assert.doesNotMatch(
    route.slice(dispatchCall, success),
    /finishProductActionRun\([\s\S]*?'failed'|throw\s+/,
  );
});

test('durable enqueue failure finalizes only its throttle run and returns a safe 503', () => {
  const enqueue = route.indexOf('queued = await enqueueThesisEngineJob');
  const dispatchCall = route.indexOf('scheduleEngineWorkerDispatch(request)');
  const enqueueBlock = route.slice(enqueue, dispatchCall);

  assert.match(
    enqueueBlock,
    /finishProductActionRun\([\s\S]*?actionRunId,[\s\S]*?'failed'/,
  );
  assert.match(
    enqueueBlock,
    /new ApiError\('Thesis generation could not be queued\.', 503\)/,
  );
});

test('dispatch configuration and waitUntil failures are non-throwing and secret-safe', () => {
  assert.match(dispatch, /reason: 'cron_secret_missing'/);
  assert.match(dispatch, /reason: 'worker_url_unavailable'/);
  assert.match(dispatch, /reason: 'wait_until_registration_failed'/);
  assert.match(
    dispatch,
    /try \{\s*waitUntil\(dispatchEngineWorker\(request\)\);[\s\S]*?catch \{/,
  );
  assert.doesNotMatch(
    dispatch,
    /console\.(?:info|warn|error)\([^\n]*(?:secret|authorization):/i,
  );
});

test('provider work remains outside POST onboarding and cron fallback remains configured', () => {
  assert.doesNotMatch(
    route,
    /Firecrawl|Gemini|Exa|processPreparedThesisGeneration/i,
  );
  assert.match(dispatch, /waitUntil\(dispatchEngineWorker\(request\)\)/);
  assert.match(dispatch, /authorization: `Bearer \$\{secret\}`/);

  const worker = read('../app/api/internal/engine-worker/route.ts');
  const vercel = read('../vercel.json');
  assert.match(worker, /export async function GET\(request: Request\)/);
  assert.match(vercel, /\/api\/internal\/engine-worker/);
});

test('onboarding emits lifecycle logs without provider data or secrets', () => {
  for (const event of [
    'persistence succeeded',
    'throttle acquired',
    'durable thesis enqueue succeeded',
    'immediate dispatch attempted',
    'immediate dispatch scheduled',
    'response',
  ]) {
    assert.match(route, new RegExp(`\\[onboarding\\] ${event}`));
  }
  assert.doesNotMatch(
    route,
    /console\.[^(]+\([^\n]*(?:CRON_SECRET|authorization)/,
  );
});
