import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PRODUCT_ACTION_LIMITS } from '../lib/product-throttle-policy.ts';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202609130002_product_action_throttling.sql',
    import.meta.url,
  ),
  'utf8',
);
const productApi = readFileSync(
  new URL('../lib/product-api.ts', import.meta.url),
  'utf8',
);

test('expensive action limits use the approved persistent cooldown policy', () => {
  assert.deepEqual(PRODUCT_ACTION_LIMITS.network_analysis, {
    userCooldownSeconds: 60,
    organizationCooldownSeconds: 20,
    maxConcurrentOrganization: 2,
    leaseSeconds: 2700,
  });
  assert.equal(
    PRODUCT_ACTION_LIMITS.funded_company_analysis.userCooldownSeconds,
    60,
  );
  assert.equal(
    PRODUCT_ACTION_LIMITS.funded_company_analysis.maxConcurrentOrganization,
    2,
  );
  assert.equal(
    PRODUCT_ACTION_LIMITS.thesis_generation.userCooldownSeconds,
    120,
  );
  assert.equal(
    PRODUCT_ACTION_LIMITS.thesis_generation.maxConcurrentOrganization,
    1,
  );
  assert.equal(
    PRODUCT_ACTION_LIMITS.funded_instant_refresh.userCooldownSeconds,
    20,
  );
  assert.equal(
    PRODUCT_ACTION_LIMITS.cohort_fit_test.maxConcurrentOrganization,
    1,
  );
});

test('atomic acquisition serializes by organization and inserts only after every check', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  const lock = migration.indexOf('pg_advisory_xact_lock');
  const userCooldown = migration.indexOf("'user_cooldown'::text");
  const organizationCooldown = migration.indexOf(
    "'organization_cooldown'::text",
  );
  const concurrency = migration.indexOf("'organization_concurrency'::text");
  const insert = migration.indexOf('insert into public.product_action_runs');
  assert.ok(lock >= 0 && lock < userCooldown);
  assert.ok(userCooldown < organizationCooldown);
  assert.ok(organizationCooldown < concurrency);
  assert.ok(concurrency < insert);
});

test('resource concurrency and orphan expiry prevent duplicate active work without permanent blocks', () => {
  assert.match(
    migration,
    /unique index[\s\S]*organization_id, action_type, resource_key[\s\S]*status = 'active'/i,
  );
  assert.match(
    migration,
    /set status = 'failed', completed_at = v_now[\s\S]*expires_at <= v_now/i,
  );
  assert.match(migration, /'resource_active'::text/);
  assert.match(
    migration,
    /status in \([\s\S]*'completed'[\s\S]*'failed'[\s\S]*'partial'/i,
  );
});

test('throttle storage and RPC are inaccessible to browser roles', () => {
  assert.match(
    migration,
    /revoke all privileges on table public\.product_action_runs from anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.acquire_product_action_run\([\s\S]*from public, anon, authenticated/i,
  );
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
});

test('429 responses expose a stable public body and Retry-After header', () => {
  assert.match(productApi, /error: apiError\.code/);
  assert.match(productApi, /message: apiError\.message/);
  assert.match(productApi, /retry_after_seconds: apiError\.retryAfterSeconds/);
  assert.match(
    productApi,
    /'Retry-After': String\(apiError\.retryAfterSeconds\)/,
  );
});

test('protected POST routes authorize before acquiring a throttle lease', () => {
  for (const routePath of [
    '../app/api/network/route.ts',
    '../app/api/funded/[id]/route.ts',
    '../app/api/funded/[id]/instant/route.ts',
    '../app/api/thesis/generate/route.ts',
    '../app/api/onboarding/route.ts',
    '../app/api/internal/cohort-fit/test/route.ts',
  ]) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');
    const post = source.slice(source.indexOf('export async function POST'));
    assert.ok(
      post.indexOf('requireWorkspaceRole(membership)') <
        post.indexOf('acquireProductActionRun('),
      routePath,
    );
  }
});

test('GET routes do not acquire or finish throttle leases', () => {
  for (const routePath of [
    '../app/api/network/route.ts',
    '../app/api/funded/[id]/route.ts',
    '../app/api/funded/[id]/instant/route.ts',
  ]) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');
    const getStart = source.indexOf('export async function GET');
    const postStart = source.indexOf('export async function POST');
    assert.doesNotMatch(
      source.slice(getStart, postStart),
      /acquireProductActionRun|finishProductActionRun/,
    );
  }
});
