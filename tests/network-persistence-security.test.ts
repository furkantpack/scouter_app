import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202609130004_network_persistence_service_role.sql',
    import.meta.url,
  ),
  'utf8',
);
const route = readFileSync(
  new URL('../app/api/network/route.ts', import.meta.url),
  'utf8',
);

test('Network tables keep authenticated reads and remove direct writes', () => {
  for (const table of ['network_runs', 'network_candidates']) {
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from public`,
        'i',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from anon`,
        'i',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all privileges on table public\\.${table} from authenticated`,
        'i',
      ),
    );
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
    'network_runs_org_insert',
    'network_runs_org_update',
    'network_candidates_org_insert',
  ]) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists "${policy}"`, 'i'),
    );
  }

  assert.doesNotMatch(migration, /drop policy[^;]+_org_select/i);
  assert.doesNotMatch(
    migration,
    /grant[^;]*(?:insert|update|delete|all)[^;]*to authenticated/i,
  );
  assert.doesNotMatch(migration, /create\s+(?:function|policy)|grant execute/i);
});

test('Network POST authorizes before using server-only persistence', () => {
  const post = route.slice(route.indexOf('export async function POST'));
  const guard = post.indexOf('requireWorkspaceRole(membership)');
  const admin = post.indexOf('const networkAdmin = createAdminClient()');

  assert.ok(guard >= 0 && admin > guard);
  assert.match(post, /await enqueueNetworkEngineJob\(networkAdmin,/);
  assert.match(post, /await recoverStaleEngineJobs\(networkAdmin\)/);
  assert.doesNotMatch(post, /processNetworkRun\(/);
  assert.doesNotMatch(
    post,
    /const created = await supabase\s*\.from\('network_runs'\)/,
  );
});
