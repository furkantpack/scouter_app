import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const migration = read(
  '../supabase/migrations/202609130007_founder_scores_authenticated_current_select.sql',
);

test('authenticated users can read only current founder score rows', () => {
  assert.match(
    migration,
    /create policy "founder_scores_authenticated_current_select"[\s\S]*on public\.founder_scores[\s\S]*for select[\s\S]*to authenticated[\s\S]*using \(is_current = true\)/i,
  );
  assert.doesNotMatch(migration, /to (?:anon|public)\b/i);
  assert.doesNotMatch(migration, /alter view|founder_product_profile|founder_profile/i);
  assert.doesNotMatch(migration, /\b(?:grant|revoke)\b/i);
  assert.doesNotMatch(migration, /disable row level security|no force row level security/i);
  assert.doesNotMatch(migration, /insert|update|delete|score_confidence/i);
});

test('product founder surfaces keep reading the canonical profile score', () => {
  const surfaceQueries = [
    '../app/api/top-founders/route.ts',
    '../app/api/founders/route.ts',
    '../app/api/ef/route.ts',
    '../app/api/lists/[id]/route.ts',
    '../app/api/monitor/route.ts',
    '../app/api/founders/[id]/route.ts',
  ];

  for (const path of surfaceQueries) {
    assert.match(
      read(path),
      /from\('founder_product_profile'\)/,
      `${path} must use the canonical founder product profile`,
    );
  }

  assert.match(read('../app/api/top-founders/route.ts'), /gte\('scouter_score'/);
  assert.match(read('../components/founder-results.tsx'), /founder\.scouter_score \?\? '—'/);
  assert.match(read('../components/ef-founder-table.tsx'), /founder\.scouter_score \?\? '—'/);
  assert.match(read('../components/founder-preview-drawer.tsx'), /profile\?\.scouter_score \?\? '—'/);
});
