import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  rankRelatedFounders,
  scoreRelatedFounder,
  type RelatedFounderCandidate,
  type RelatedFounderReference,
} from '../lib/portfolio-related-founders.ts';

const reference: RelatedFounderReference = {
  company: {
    sector: 'Artificial Intelligence / B2B SaaS',
    description: 'AI workflow automation for business teams',
    stage: 'Pre-seed',
    geography: null,
    founderPattern: 'Technical repeat founders',
    thesisSignals: ['AI infrastructure', 'B2B SaaS', 'Technical founders'],
  },
  fund: {
    name: 'Example Fund',
    thesisSignals: ['AI infrastructure', 'B2B SaaS'],
    founderPatterns: ['Technical founders'],
  },
  diversityKey: 'company-one',
};

const candidate: RelatedFounderCandidate = {
  id: 'founder-one',
  name: 'Ada Founder',
  companyId: 'company-one',
  companyName: 'Example AI',
  category: ['Enterprise Software', 'AI Infrastructure'],
  tags: ['Technical Founder', 'Repeat Founder'],
  flags: ['sector_ai_ml_infra', 'sector_b2b_saas'],
  founderRole: 'Co-Founder & CTO',
  timingLabel: 'Recently started / early',
  scouterScore: 88,
};

test('related founder score is deterministic with persisted reasons', () => {
  const first = scoreRelatedFounder(reference, candidate);
  const second = scoreRelatedFounder(reference, candidate);
  assert.deepEqual(first, second);
  assert.ok(first);
  assert.ok(first.relatedMatchScore >= 55);
  assert.equal(first.classification, 'related_founder');
  assert.ok(first.whyMatched.length >= 1 && first.whyMatched.length <= 3);
  assert.match(first.whyMatched.join(' '), /AI|B2B SaaS|Technical founder/);
});

test('unresolved portfolio companies can still receive related founders', () => {
  const matches = rankRelatedFounders(reference, [candidate]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, candidate.id);
});

test('known-sector mismatch and low evidence stay below the result threshold', () => {
  const unrelated = {
    ...candidate,
    id: 'unrelated',
    category: ['Healthcare'],
    tags: ['Clinical operator'],
    flags: ['sector_health'],
    founderRole: 'CEO',
    timingLabel: null,
  };
  assert.equal(scoreRelatedFounder(reference, unrelated), null);
});

test('known company sector suppresses unrelated fund-wide thesis sectors', () => {
  const fintechReference: RelatedFounderReference = {
    ...reference,
    company: {
      ...reference.company,
      sector: 'Fintech',
      description: null,
      thesisSignals: [],
    },
    fund: {
      ...reference.fund,
      thesisSignals: ['Artificial Intelligence', 'Fintech'],
    },
  };
  const match = scoreRelatedFounder(fintechReference, {
    ...candidate,
    category: ['Fintech'],
    tags: ['Fintech', 'Technical Founder'],
    flags: ['sector_fintech'],
  });
  assert.ok(match);
  assert.match(match.whyMatched.join(' '), /Fintech overlap/);
  assert.doesNotMatch(match.whyMatched.join(' '), /Artificial Intelligence/);
});

test('fund-only evidence is classified separately and capped', () => {
  const fundOnlyReference: RelatedFounderReference = {
    company: {
      sector: 'Software',
      description: 'Company name only',
      thesisSignals: [],
      stage: null,
      geography: null,
      founderPattern: null,
    },
    fund: {
      name: 'Hustle Fund',
      thesisSignals: ['Artificial Intelligence', 'Fintech'],
      founderPatterns: ['Technical founders'],
    },
    diversityKey: 'weak-company',
  };
  const match = scoreRelatedFounder(fundOnlyReference, candidate);
  assert.ok(match);
  assert.equal(match.classification, 'fund_thesis_match');
  assert.ok(match.relatedMatchScore <= 68);
  assert.deepEqual(match.whyMatched, ['Matches Hustle Fund thesis']);
});

test('strong company-specific evidence can score above the sparse evidence cap', () => {
  const match = scoreRelatedFounder(reference, candidate);
  assert.ok(match);
  assert.ok(match.relatedMatchScore > 75);
});

test('near-identical ties use a deterministic company-specific diversity key', () => {
  const candidates = [
    candidate,
    { ...candidate, id: 'founder-two', name: 'Grace Founder' },
    { ...candidate, id: 'founder-three', name: 'Lin Founder' },
    { ...candidate, id: 'founder-four', name: 'Katherine Founder' },
  ];
  const first = rankRelatedFounders(reference, candidates);
  const repeated = rankRelatedFounders(reference, candidates);
  const anotherCompany = rankRelatedFounders(
    { ...reference, diversityKey: 'company-two' },
    candidates,
  );
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(
    first.map((match) => match.id),
    anotherCompany.map((match) => match.id),
  );
});

test('ranking excludes exact founders and duplicate founder IDs', () => {
  const matches = rankRelatedFounders(
    reference,
    [
      candidate,
      { ...candidate },
      { ...candidate, id: 'founder-two', name: 'Grace Founder' },
    ],
    ['founder-one'],
  );
  assert.deepEqual(
    matches.map((match) => match.id),
    ['founder-two'],
  );
});

test('Related Match remains separate from the unchanged Scouter Score', () => {
  const match = scoreRelatedFounder(reference, candidate);
  assert.ok(match);
  assert.equal(match.scouterScore, 88);
  assert.notEqual(match.relatedMatchScore, match.scouterScore);
});

test('exact founders take precedence and page code never calls a provider', () => {
  const route = readFileSync(
    new URL('../app/api/funded/route.ts', import.meta.url),
    'utf8',
  );
  const page = readFileSync(
    new URL('../app/(main)/products/products-page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    route,
    /const relatedFounders = founderLinks\.founderCount\s*\? \[\]/,
  );
  assert.match(page, /Exact founders/);
  assert.match(page, /Related founders/);
  assert.match(page, /relatedMatchScore/);
  assert.doesNotMatch(route, /Firecrawl|Gemini|\bExa\b|\bScout\b/);
  assert.doesNotMatch(page, /Firecrawl|Gemini|\bExa\b|\bScout\b/);
});
