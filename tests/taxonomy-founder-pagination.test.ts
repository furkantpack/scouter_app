import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const route = read('../app/api/founders/route.ts');
const migration = read(
  '../supabase/migrations/202609130009_taxonomy_founder_pagination.sql',
);

test('taxonomy API uses one paginated RPC instead of loading all IDs', () => {
  assert.match(route, /rpc\('get_taxonomy_founders_page'/);
  assert.match(route, /p_offset:\s*page \* PAGE_SIZE/);
  assert.match(route, /p_limit:\s*PAGE_SIZE/);
  assert.doesNotMatch(route, /loadFlaggedFounderIds|loadFilteredProfiles/);
  assert.doesNotMatch(route, /\.in\('id',\s*ids\)|chunkFounderIds/);
});

test('unsupported client filters are rejected before the RPC', () => {
  assert.match(route, /requestedFilter && !filter/);
  assert.match(route, /Invalid founder filter/);
});

test('RPC whitelists every canonical flag without dynamic SQL', () => {
  const expectedFlags = [
    'big_tech_alumni',
    'fintech_alumni',
    'ai_alumni',
    'saas_alumni',
    'top_consulting',
    'regional_alumni',
    'global_tier_1',
    'technical_tier_1',
    'regional_tier_1',
    'stem_focus',
    'top_mba',
    'sector_ai_ml_infra',
    'sector_fintech',
    'sector_b2b_saas',
    'sector_deeptech',
    'sector_climate',
    'sector_health',
    'sector_defense',
    'sector_consumer',
    'sector_hrtech',
  ];
  for (const flag of expectedFlags) {
    assert.match(migration, new RegExp(`when '${flag}' then flags\\.${flag}`));
  }
  assert.doesNotMatch(migration, /execute\s+(?:immediate|format)|format\s*\(/i);
});

test('RPC keeps search, ordering, exact count and bounded pagination in SQL', () => {
  for (const field of ['name', 'company_name', 'category_l1', 'founder_role'])
    assert.match(migration, new RegExp(`profile\\.${field} ilike`));
  assert.match(migration, /order by name, id/);
  assert.match(
    migration,
    /'total_count', \(select count\(\*\) from matching\)/,
  );
  assert.match(migration, /p_limit < 1 or p_limit > 50/);
  assert.match(migration, /to_jsonb\(profile\) - 'score_confidence'/);
});

test('RPC is security-invoker and anonymous execution stays denied', () => {
  assert.match(migration, /security invoker/i);
  assert.match(
    migration,
    /revoke all on function public\.get_taxonomy_founders_page[\s\S]*from public, anon/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_taxonomy_founders_page[\s\S]*to authenticated, service_role/i,
  );
});
