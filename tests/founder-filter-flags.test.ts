import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyFounderFilterFlags, normalizeRuleText } from '../lib/founder-filter-flags.ts';

test('normalizes documented aliases deterministically', () => {
  assert.equal(normalizeRuleText('Boğaziçi University'), 'bogazici university');
  assert.equal(normalizeRuleText('Google DeepMind'), 'google deepmind');
});

test('classifies multiple independent explicit signals', () => {
  const result = classifyFounderFilterFlags({
    founderId: 'founder-1',
    currentCompanyName: 'New AI Co',
    profileCompanyHistory: [{ company_name: 'Stripe', is_current: false }],
    companyCategories: ['AI & Data > AI / ML Infrastructure > Inference Infrastructure'],
    tags: [{ tag: 'Stanford University', isTaxonomyTag: true }],
  });
  assert.equal(result.flags.fintech_alumni, true);
  assert.equal(result.flags.global_tier_1, true);
  assert.equal(result.flags.sector_ai_ml_infra, true);
});

test('does not count current founder company as alumni', () => {
  const result = classifyFounderFilterFlags({
    founderId: 'founder-2',
    currentCompanyName: 'Stripe',
    profileCompanyHistory: [{ company_name: 'Stripe', is_current: true }],
    roles: [{ companyName: 'Stripe', isCurrent: true, relationshipType: 'founder' }],
  });
  assert.equal(result.flags.fintech_alumni, false);
});

test('requires an explicit prior-employment marker for raw tags', () => {
  const plain = classifyFounderFilterFlags({
    founderId: 'founder-3', tags: [{ tag: 'Amazon ML', isTaxonomyTag: false }],
  });
  const prior = classifyFounderFilterFlags({
    founderId: 'founder-3', tags: [{ tag: 'ex-Amazon ML', isTaxonomyTag: false }],
  });
  assert.equal(plain.flags.big_tech_alumni, false);
  assert.equal(prior.flags.big_tech_alumni, true);
});

test('does not infer education or STEM from job titles and vague text', () => {
  const result = classifyFounderFilterFlags({
    founderId: 'founder-4',
    tags: [
      { tag: 'Stanford AI researcher', isTaxonomyTag: false },
      { tag: 'Software Engineer', isTaxonomyTag: false },
    ],
  });
  assert.equal(result.flags.global_tier_1, false);
  assert.equal(result.flags.stem_focus, false);
});

test('does not promote broad AI categories into AI infrastructure', () => {
  const result = classifyFounderFilterFlags({
    founderId: 'founder-5', companyCategories: ['AI & Data > Applied AI > Sales Copilot'],
  });
  assert.equal(result.flags.sector_ai_ml_infra, false);
});

test('supports direct structured taxonomy over reconstruction', () => {
  const result = classifyFounderFilterFlags({
    founderId: 'founder-6',
    tags: [
      { tag: 'Career Origin → Big Tech', isTaxonomyTag: true, tagFamily: 'Career Origin' },
      { tag: 'Top MBA', isTaxonomyTag: true, tagFamily: 'Education' },
      { tag: 'HR Tech', isTaxonomyTag: true, tagFamily: 'Sectors' },
    ],
  });
  assert.equal(result.flags.big_tech_alumni, true);
  assert.equal(result.flags.top_mba, true);
  assert.equal(result.flags.sector_hrtech, true);
});
