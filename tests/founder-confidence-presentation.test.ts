import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const founderSurfaces = [
  '../components/top-founder-table.tsx',
  '../components/founder-results.tsx',
  '../components/ef-founder-table.tsx',
  '../components/founder-preview-drawer.tsx',
  '../components/founder-detail.tsx',
  '../app/(main)/profile/abhi-tanwar/page.tsx',
  '../app/(main)/profile/marcus-webb/page.tsx',
  '../app/(main)/lists/[id]/page.tsx',
  '../app/(main)/monitor/page.tsx',
  '../app/(main)/programs/[programId]/page.tsx',
  '../components/network-mode-view.tsx',
  '../components/funded-company-intelligence-view.tsx',
];

test('founder product surfaces do not present score confidence', () => {
  for (const path of founderSurfaces) {
    const source = read(path);
    assert.doesNotMatch(source, /score_confidence/i, `${path} renders score_confidence`);
    assert.doesNotMatch(
      source,
      /confidence unavailable|not available confidence|% confidence/i,
      `${path} renders founder confidence copy`,
    );
  }
});

test('shared founder surfaces keep Scouter Score presentation without a Confidence column', () => {
  for (const path of [
    '../components/top-founder-table.tsx',
    '../components/founder-results.tsx',
    '../components/ef-founder-table.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /Scouter Score/i, `${path} must retain the score heading`);
    assert.match(source, /founder\.scouter_score \?\? '—'/, `${path} must retain the score value`);
    assert.doesNotMatch(source, /<Table\.Head>Confidence<\/Table\.Head>/i);
  }

  const drawer = read('../components/founder-preview-drawer.tsx');
  assert.match(drawer, /profile\?\.scouter_score \?\? '—'/);
  assert.match(drawer, /Scouter score/i);
});
