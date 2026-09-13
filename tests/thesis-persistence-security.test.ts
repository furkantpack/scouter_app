import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202609130005_vc_thesis_persistence_service_role.sql',
    import.meta.url,
  ),
  'utf8',
);
const generateRoute = readFileSync(
  new URL('../app/api/thesis/generate/route.ts', import.meta.url),
  'utf8',
);
const onboardingRoute = readFileSync(
  new URL('../app/api/onboarding/route.ts', import.meta.url),
  'utf8',
);

const tables = ['vc_theses', 'vc_thesis_dimensions', 'vc_thesis_evidence'];

test('VC Thesis tables preserve isolated reads and remove browser writes', () => {
  for (const table of tables) {
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      assert.match(
        migration,
        new RegExp(
          `revoke all privileges on table public\\.${table} from ${role}`,
          'i',
        ),
      );
    }
    assert.match(
      migration,
      new RegExp(
        `grant select on table public\\.${table} to authenticated`,
        'i',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant select, insert, update, delete on table public\\.${table} to service_role`,
        'i',
      ),
    );
  }

  for (const policy of [
    'vc_theses_insert',
    'vc_theses_update',
    'vc_theses_delete',
    'thesis_dimensions_write',
    'thesis_evidence_write',
  ]) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists "${policy}"`, 'i'),
    );
  }

  assert.doesNotMatch(migration, /drop policy[^;]+(?:_read|_select)/i);
  assert.doesNotMatch(
    migration,
    /grant[^;]*(?:insert|update|delete|all)[^;]*to authenticated/i,
  );
  assert.doesNotMatch(migration, /create\s+(?:function|policy)|grant execute/i);
});

test('thesis generation authorizes and throttles before durable service-role enqueue', () => {
  const post = generateRoute.slice(
    generateRoute.indexOf('export async function POST'),
  );
  const guard = post.indexOf('requireWorkspaceRole(membership)');
  const admin = post.indexOf('const throttleAdmin = createAdminClient()');
  const throttle = post.indexOf('await acquireProductActionRun(throttleAdmin');
  const generation = post.indexOf('await enqueueThesisEngineJob(throttleAdmin');

  assert.ok(
    guard >= 0 && admin > guard && throttle > admin && generation > throttle,
  );
  assert.match(
    post.slice(generation),
    /enqueueThesisEngineJob\(throttleAdmin,\s*\{/,
  );
  assert.doesNotMatch(
    post.slice(generation),
    /enqueueThesisEngineJob\(supabase,/,
  );
});

test('completed onboarding authorizes and throttles before durable thesis enqueue', () => {
  const post = onboardingRoute.slice(
    onboardingRoute.indexOf('export async function POST'),
  );
  const guard = post.indexOf(
    'if (body.completed) requireWorkspaceRole(membership)',
  );
  const admin = post.indexOf('const admin = createAdminClient()');
  const throttle = post.indexOf('await acquireProductActionRun(admin');
  const generation = post.indexOf('await enqueueThesisEngineJob(admin');

  assert.ok(
    guard >= 0 && admin > guard && throttle > admin && generation > throttle,
  );
  assert.match(post.slice(generation), /enqueueThesisEngineJob\(admin,\s*\{/);
  assert.doesNotMatch(
    post.slice(generation),
    /enqueueThesisEngineJob\(supabase,/,
  );
});
