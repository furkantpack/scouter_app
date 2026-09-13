import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const route = read('../app/api/programs/route.ts');
const cache = read('../lib/program-fit-summary.ts');
const migration = read(
  '../supabase/migrations/202609130008_program_fit_summary_performance.sql',
);

test('program summary uses one cached RPC after workspace authorization', () => {
  assert.match(route, /withWorkspace\(request,[\s\S]*loadProgramFitSummary\(\)/);
  assert.doesNotMatch(route, /Promise\.all\(PROGRAMS/);
  assert.doesNotMatch(route, /founder_program_fits/);
  assert.match(route, /Program summaries are temporarily unavailable/);
  assert.match(cache, /unstable_cache/);
  assert.match(cache, /revalidate:\s*600/);
  assert.match(cache, /createAdminClient\(\)\.rpc\('get_program_fit_summary'\)/);
});

test('summary migration adds one current-row covering index', () => {
  assert.match(
    migration,
    /on public\.founder_program_fits \(program_id\)[\s\S]*include \(program_name, fit_score\)[\s\S]*where is_current = true/i,
  );
  assert.equal(
    (migration.match(/create index/gi) || []).length,
    1,
    'the migration should add exactly one index',
  );
});

test('summary RPC preserves current-row aggregates without distinct sorting', () => {
  assert.match(migration, /count\(\*\) as scored_founders/i);
  assert.match(
    migration,
    /count\(\*\) filter \(where fit\.fit_score >= 90\) as fit_90_plus/i,
  );
  assert.match(migration, /round\(avg\(fit\.fit_score\)::numeric, 1\)/i);
  assert.match(migration, /where fit\.is_current = true/i);
  assert.doesNotMatch(migration, /count\(distinct/i);
});
