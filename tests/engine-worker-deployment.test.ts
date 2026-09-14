import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { hasValidCronAuthorization } from '../lib/cron-auth.ts';
import { resolveEngineWorkerUrl } from '../lib/engine-worker-url.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const vercel = JSON.parse(read('../vercel.json')) as {
  crons: Array<{ path: string; schedule: string }>;
};
const workerRoute = read('../app/api/internal/engine-worker/route.ts');

test('Vercel invokes the engine worker on a Hobby-compatible daily schedule', () => {
  assert.deepEqual(vercel.crons, [
    { path: '/api/internal/engine-worker', schedule: '0 0 * * *' },
  ]);
  assert.match(workerRoute, /export async function GET\(request: Request\)/);
});

test('cron authorization rejects missing, incorrect, and user-only requests', () => {
  const secret = 'test-cron-secret-at-least-16-chars';
  assert.equal(hasValidCronAuthorization(null, secret), false);
  assert.equal(hasValidCronAuthorization('Bearer incorrect', secret), false);
  assert.equal(
    hasValidCronAuthorization('Bearer user-access-token', secret),
    false,
  );
  assert.equal(hasValidCronAuthorization(`Bearer ${secret}`, secret), true);
  assert.equal(hasValidCronAuthorization(`Bearer ${secret}`, ''), false);
  assert.match(
    workerRoute,
    /if \(!process\.env\.CRON_SECRET\)[\s\S]*?\{ status: 503 \}/,
  );
  assert.match(
    workerRoute,
    /if \(!hasValidCronAuthorization\([\s\S]*?\{ status: 401 \}/,
  );
});

test('an authorized worker invocation remains bounded to one job', () => {
  const auth = workerRoute.indexOf('hasValidCronAuthorization(');
  const admin = workerRoute.indexOf('const admin = createAdminClient()');
  assert.ok(auth >= 0 && admin > auth);
  assert.match(workerRoute, /export const runtime = 'nodejs'/);
  assert.match(workerRoute, /export const maxDuration = 300/);
  assert.match(workerRoute, /claimEngineJobs\(admin, leaseOwner, 1,/);
  assert.match(
    workerRoute,
    /export async function POST\(request: Request\)[\s\S]*waitUntil\(/,
  );
  assert.match(workerRoute, /status: 202/);
});

test('immediate dispatch prefers the canonical production deployment', () => {
  assert.deepEqual(
    resolveEngineWorkerUrl('https://request.example/api/onboarding', {
      NODE_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'app.scouter.so',
      VERCEL_BRANCH_URL: 'main.scouter.vercel.app',
      VERCEL_URL: 'protected-deployment.vercel.app',
    }),
    {
      url: 'https://app.scouter.so/api/internal/engine-worker',
      source: 'production',
    },
  );
});

test('dispatch URL resolution has deterministic safe fallbacks', () => {
  assert.equal(
    resolveEngineWorkerUrl('https://request.example/api/onboarding', {
      NODE_ENV: 'production',
      VERCEL_URL: 'not/a/host',
    }),
    null,
  );
  assert.deepEqual(
    resolveEngineWorkerUrl('http://localhost:3000/api/onboarding', {
      NODE_ENV: 'development',
    }),
    {
      url: 'http://localhost:3000/api/internal/engine-worker',
      source: 'local',
    },
  );
});
