import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { safeFormatDate } from '../lib/funded-intelligence/safe-date.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('safeFormatDate formats valid ISO and Date values', () => {
  assert.notEqual(safeFormatDate('2026-09-14T08:23:25.346709+00:00'), '—');
  assert.notEqual(safeFormatDate(new Date('2026-09-14T08:23:25Z')), '—');
});

test('safeFormatDate returns its fallback for every invalid input shape', () => {
  assert.equal(safeFormatDate(null), '—');
  assert.equal(safeFormatDate(undefined), '—');
  assert.equal(safeFormatDate(''), '—');
  assert.equal(safeFormatDate('   '), '—');
  assert.equal(safeFormatDate('not-a-date'), '—');
  assert.equal(safeFormatDate(new Date(Number.NaN)), '—');
  assert.equal(
    safeFormatDate(null, { dateStyle: 'medium' }, 'Unknown'),
    'Unknown',
  );
});

test('/funded normalizes thesis dates on every response branch', () => {
  const route = read('../app/api/funded/route.ts');
  const list = read('../components/funded-companies-view.tsx');
  const detail = read('../components/funded-company-intelligence-view.tsx');

  assert.match(route, /const thesisSummary = \{/);
  assert.equal((route.match(/thesis: thesisSummary/g) || []).length, 2);
  assert.match(list, /safeFormatDate\(data\.thesis\.updatedAt/);
  assert.doesNotMatch(list, /\.format\(new Date\(data\.thesis\.updatedAt\)\)/);
  assert.match(detail, /safeFormatDate\(value\)/);
});
