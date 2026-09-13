import assert from 'node:assert/strict';
import test from 'node:test';

import { mapScouterCohortProfile } from '../lib/cohort-engine/profile-mapper.ts';
import { runCohortEngine } from '../lib/cohort-engine/runner.ts';

test('maps only supported deterministic Scouter taxonomy', () => {
  const mapped = mapScouterCohortProfile({
    profile: {
      company_id: 'company-1',
      category_l1: 'AI / ML Infrastructure',
      category_path: ['Developer Tools'],
    },
    founderTags: ['Technical Founder', 'Repeat Founder', 'Unmapped Trait'],
    roles: [{
      company_id: 'company-1',
      companies: {
        stage: 'Pre-Seed',
        country: 'United States',
        tags: ['Enterprise', 'Hardware'],
      },
    }],
  });
  assert.equal(mapped.profile.founder.technical_depth, 0.9);
  assert.equal(mapped.profile.founder.repeat_founder, 1);
  assert.equal(mapped.profile.company.enterprise_b2b, 0.95);
  assert.equal(mapped.profile.company.capital_intensive, 0.9);
  assert.deepEqual(mapped.profile.categories.sort(), ['ai_infra', 'developer_tools', 'hardware']);
  assert.equal(mapped.profile.stage, 'pre_seed');
  assert.deepEqual(mapped.profile.geographies, ['us']);
  assert.equal(mapped.companyId, 'company-1');
  assert.deepEqual(mapped.unmappedTaxonomy, ['unmapped trait']);
});

test('does not infer founder traits from role or name', () => {
  const mapped = mapScouterCohortProfile({
    profile: { name: 'Technical Founder', founder_role: 'Research Founder' },
    founderTags: [],
    roles: [],
  });
  assert.deepEqual(mapped.profile.founder, {});
  assert.equal(mapped.companyId, null);
});

test('uses canonical company and only actual profile tag values', () => {
  const mapped = mapScouterCohortProfile({
    profile: {
      company_id: 'canonical-company',
      tags: [
        { tag: 'Repeat Founder', tag_type: 'discovery' },
        { tag: 'Prior Startup Exit', tag_type: 'pattern' },
        { metadata: 'Technical Founder', type: 'pattern' },
      ],
    },
    founderTags: [],
    roles: [],
    canonicalCompany: {
      id: 'canonical-company',
      category: 'Enterprise Software',
      stage: 'Seed',
      country: 'United States',
    },
  });
  assert.equal(mapped.companyId, 'canonical-company');
  assert.equal(mapped.profile.founder.repeat_founder, 1);
  assert.equal(mapped.profile.founder.prior_exit, 1);
  assert.equal(mapped.profile.founder.technical_depth, undefined);
  assert.deepEqual(mapped.profile.categories, ['enterprise_saas']);
  assert.equal(mapped.profile.stage, 'seed');
  assert.deepEqual(mapped.profile.geographies, ['us']);
  assert.equal(mapped.unmappedTaxonomy.includes('discovery'), false);
  assert.equal(mapped.unmappedTaxonomy.includes('pattern'), false);
  assert.equal(mapped.unmappedTaxonomy.includes('technical founder'), false);
});

test('maps confirmed pilot categories and conservative traction evidence', () => {
  const mapped = mapScouterCohortProfile({
    profile: {
      company_id: 'company-1',
      category_l1: 'Enterprise Software',
      category_path: 'Enterprise Software > MarTech > AI Social Media Operating System',
      tags: [
        { tag: 'AI Social OS', tag_type: 'pattern' },
        { tag: '500+ Waitlist', tag_type: 'discovery' },
        { tag: '55 Paid Prelaunch', tag_type: 'pattern' },
      ],
    },
    founderTags: [],
    roles: [],
  });
  assert.deepEqual(mapped.profile.categories.sort(), ['enterprise_saas', 'vertical_ai']);
  assert.equal(mapped.profile.company.traction, 0.75);
  assert.equal(mapped.profile.company.revenue, 0.65);
  assert.equal(mapped.profile.stage, null);
  assert.equal(mapped.unmappedTaxonomy.includes('pattern'), false);
  assert.equal(
    mapped.profile.evidence?.find((item) => item.field === 'revenue')?.source_value,
    '55 Paid Prelaunch',
  );
});

test('maps autonomous-system terms without treating generic mobility as robotics', () => {
  const autonomous = mapScouterCohortProfile({
    profile: { category_l1: 'Mobility', category_path: 'Mobility > Safety / ADAS > AI Rider Copilot' },
    founderTags: [],
    roles: [],
  });
  const generic = mapScouterCohortProfile({
    profile: { category_l1: 'Mobility' },
    founderTags: [],
    roles: [],
  });
  assert.deepEqual(autonomous.profile.categories, ['physical_ai_robotics']);
  assert.deepEqual(generic.profile.categories, []);
});

test('maps only explicit stage tags and keeps editorial timing labels out', () => {
  const mapped = mapScouterCohortProfile({
    profile: {
      timing_label: 'Ultra-Early / PRIORITY',
      tags: [{ tag: 'Pre-Launch', tag_type: 'pattern' }],
    },
    founderTags: [],
    roles: [],
  });
  assert.equal(mapped.profile.stage, 'prototype');
});

test('server adapter executes the fixed Python engine and validates its result', async () => {
  const result = await runCohortEngine({
    founder: { technical_depth: 0.9, product_builder: 0.8 },
    company: { ai_native: 0.9, enterprise_b2b: 0.8 },
    categories: ['ai_infra', 'developer_tools'],
    stage: 'pre_seed',
    geographies: ['europe'],
    evidence: [],
  });
  assert.equal(result.engine, 'Scouter Cohort DNA Engine');
  assert.equal(result.version, '1.5.0');
  assert.equal(result.current_program_ranking.length, 21);
  assert.equal('acceptance_probability' in result, false);
});
