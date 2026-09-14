import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const page = read('../app/(main)/programs/page.tsx');
const detail = read('../app/(main)/programs/[programId]/page.tsx');
const registry = read('../lib/program-registry.ts');

test('program cards use the portfolio card visual language', () => {
  assert.match(page, /rounded-3xl/);
  assert.match(page, /shadow-regular-xs/);
  assert.match(page, /linear-gradient/);
  assert.match(page, /Program DNA/);
  assert.match(page, /RiArrowRightUpLongLine/);
});

test('program cards show only strong matching founder counts', () => {
  assert.match(page, /program\.fit_90_plus/);
  assert.match(page, /Matching founders/);
  assert.match(page, /Fit threshold/);
  assert.doesNotMatch(page, /program\.scored_founders|Scored founders/);
  assert.match(detail, /useState<'90' \| '85' \| '75'>\('90'\)/);
  assert.doesNotMatch(detail, /\['all', 'All'\]/);
});

test('program logos use existing registry metadata with an initials fallback', () => {
  assert.match(registry, /logoDomain\?: string/);
  assert.match(page, /program\.logoDomain/);
  assert.match(page, /initials\(name\)/);
  assert.match(page, /programLabels\(program\)/);
});
