import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dedupeAndSortFundingRounds,
  relativeFundingAge,
} from '../lib/network/funding-feed.ts';

const rounds = [
  {
    id: 'round-1',
    date: '2026-09-09',
    stage: 'Seed',
    amountEur: 3_000_000,
    company: { id: 'company-1' },
  },
  {
    id: 'round-1',
    date: '2026-09-09',
    stage: 'Seed',
    amountEur: 3_000_000,
    company: { id: 'company-1' },
  },
  {
    id: 'round-2',
    date: '2026-08-01',
    stage: 'Pre-Seed',
    amountEur: 5_000_000,
    company: { id: 'company-1' },
  },
];

test('deduplicates exact rounds but keeps separate rounds for the same company', () => {
  const result = dedupeAndSortFundingRounds(rounds, 'newest');
  assert.deepEqual(
    result.map((round) => round.id),
    ['round-1', 'round-2'],
  );
});

test('sorts funding rounds by largest amount', () => {
  const result = dedupeAndSortFundingRounds(rounds, 'largest');
  assert.deepEqual(
    result.map((round) => round.id),
    ['round-2', 'round-1'],
  );
});

test('formats funding freshness from the canonical funding date', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  assert.equal(relativeFundingAge('2026-09-10', now), 'Today');
  assert.equal(relativeFundingAge('2026-09-08', now), '2 days ago');
  assert.equal(relativeFundingAge('2026-08-20', now), '3 weeks ago');
});
