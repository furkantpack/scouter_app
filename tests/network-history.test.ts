import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(
  new URL('../app/api/network/route.ts', import.meta.url),
  'utf8',
);
const view = readFileSync(
  new URL('../components/network-mode-view.tsx', import.meta.url),
  'utf8',
);
const page = readFileSync(
  new URL('../app/(main)/network/page.tsx', import.meta.url),
  'utf8',
);

test('Network GET returns bounded organization-scoped history and one run candidate set', () => {
  const get = route.slice(
    route.indexOf('export async function GET'),
    route.indexOf('export async function POST'),
  );
  assert.match(get, /const HISTORY_LIMIT = 20|limit\(HISTORY_LIMIT\)/);
  assert.match(get, /\.from\('network_runs'\)[\s\S]*\.eq\('organization_id', membership!\.organization_id\)/);
  assert.match(get, /if \(requestedId && !uuid\(requestedId\)\)/);
  assert.match(get, /const selectedId = requestedId \|\| latestId/);
  assert.match(get, /Network run not found\.', 404/);
  assert.match(get, /\.from\('network_candidates'\)[\s\S]*\.eq\('organization_id', membership!\.organization_id\)[\s\S]*\.eq\('network_run_id', runResult\.data\.id\)/);
  assert.match(get, /candidate_count: candidateCounts\.get\(run\.id\) \|\| 0/);
});

test('Network history uses URL run selection and keeps failed and ready runs accessible', () => {
  assert.match(page, /searchParams: \{ runId\?: string \}/);
  assert.match(page, /initialRunId=\{searchParams\.runId\}/);
  assert.match(view, /Analysis history/);
  assert.match(view, /Most recent 20 persisted runs/);
  assert.match(view, /router\.push\(`\/network\?runId=/);
  assert.match(view, /View latest successful run/);
  assert.match(view, /This analysis could not be completed/);
  assert.doesNotMatch(view, /\{run\.error \|\|/);
});

test('historical candidates preserve canonical and external rendering', () => {
  assert.match(view, /candidate\.scouter_score \?\? '—'/);
  assert.match(view, /candidate\.network_match/);
  assert.match(view, /selected\?\.founder_id \? \(/);
  assert.match(view, /<FounderPreviewDrawer/);
  assert.match(view, /<ExternalCandidateDrawer/);
  assert.match(view, /External discovery lead/);
});
