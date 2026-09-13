import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFounderSignalPresentation } from '../lib/founder-signal-presentation.ts';
import type { FounderDetail, FounderProfile, Json } from '../lib/product-types.ts';

function founder(
  name: string,
  role: string | null,
  timing: string | null,
  tags: string[],
  roles: Record<string, Json>[] = [],
): FounderDetail {
  const profile: FounderProfile = {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    founder_role: role,
    timing_label: timing,
    company_id: null,
    company_name: null,
    category_l1: null,
    category_path: null,
    company_history: null,
    tags: null,
    scouter_score: 99,
    score_status: 'researched',
    score_rationale: '99/100 based on confidence and internal model weighting.',
    score_confidence: 0.99,
    score_model_version: 'internal-model',
  };
  return {
    profile,
    social: { linkedin_url: null, twitter_url: null },
    roles,
    tags: tags.map((tag) => ({ tags: { tag } })),
    program_fits: [],
  };
}

function labels(detail: FounderDetail) {
  return Object.fromEntries(
    buildFounderSignalPresentation(detail).groups.map((group) => [
      group.key,
      group.signals,
    ]),
  );
}

test('maps exact persisted signals into investor-readable categories', () => {
  const result = labels(
    founder(
      'Signal Founder',
      'Co-Founder / CTO',
      'Recently Left',
      ['Repeat Founder', 'High Ownership', '$2M+ ARR', 'YC', 'Stanford PhD'],
    ),
  );
  assert.deepEqual(result.career, ['Repeat Founder', 'Co-Founder']);
  assert.deepEqual(result.timing, ['Recently Left']);
  assert.deepEqual(result.founder_quality, ['High Ownership', 'Technical Founder']);
  assert.deepEqual(result.traction, ['$2M+ ARR']);
  assert.deepEqual(result.network, ['YC']);
  assert.deepEqual(result.education, ['Stanford']);
});

test('deduplicates role and AI alumni signals in favor of clearer labels', () => {
  const result = labels(
    founder('AI Founder', 'Co-Founder', null, [
      'Founder',
      'Co-Founder',
      'AI Alumni',
      'Ex-OpenAI',
      'Ex-OpenAI',
    ]),
  );
  assert.deepEqual(result.career, ['Co-Founder', 'Ex-OpenAI']);
});

test('selects deterministic Why Now templates without score math', () => {
  const result = buildFounderSignalPresentation(
    founder('Transition Founder', 'Founder', null, [
      'Fresh Venture',
      'Previous Exit',
      '$2M+ ARR',
    ]),
  );
  assert.equal(
    result.whyNow,
    'Repeat founder entering a fresh company-building phase, backed by prior founder experience and early commercial traction.',
  );
  assert.doesNotMatch(result.whyNow || '', /\d+\/100|confidence|model/i);
});

test('sparse founder omits Why Now and unsupported groups', () => {
  const result = buildFounderSignalPresentation(
    founder('Laurie Nicol', 'Founder & CEO', null, [
      'Tidal Ventures',
      'Team 6',
      'Tendl',
      'AI Tendering',
    ]),
  );
  assert.equal(result.whyNow, null);
  assert.deepEqual(result.groups, [
    { key: 'career', label: 'Career', signals: ['Founder'] },
  ]);
});

test('does not expose internal metadata or generate unsupported signals', () => {
  const result = buildFounderSignalPresentation(
    founder('Sparse Founder', null, null, [
      'Stanford AI researcher',
      'Possible Sequoia connection',
      'Fast-looking project',
    ]),
  );
  const output = JSON.stringify(result);
  assert.deepEqual(result.groups, []);
  assert.equal(result.whyNow, null);
  assert.doesNotMatch(output, /confidence|model|score|sequoia|stanford/i);
});

test('real drawer profiles produce only labels supported by their displayed source data', () => {
  const realProfiles = [
    {
      name: 'Aleksa Mitrović',
      detail: founder('Aleksa Mitrović', 'Founder', 'Very Early / Post-Discovery', [
        'Repeat Founder',
        'Ex - Hyperaktiv',
        'Ex - N26',
        'Ex - Contentful',
      ]),
      groups: {
        career: ['Repeat Founder', 'Ex-Hyperaktiv', 'Ex-N26', 'Ex-Contentful', 'Founder'],
        timing: ['Very Early / Post-Discovery'],
      },
      whyNow: 'Experienced founder entering a timely new company-building phase.',
    },
    {
      name: 'Erik Reppel',
      detail: founder('Erik Reppel', 'Founder', 'Days/Weeks-Old Founder Transition / Stealth', [
        'Stealth',
        'ex-Coinbase Head of Engineering',
        'Coinbase Developer Platform',
      ]),
      groups: {
        career: ['Ex-Coinbase Head of Engineering', 'Founder'],
        timing: ['Days/Weeks-Old Founder Transition / Stealth'],
      },
      whyNow: 'An explicit early company-building signal is active.',
    },
    {
      name: 'Seema Lakhani',
      detail: founder('Seema Lakhani', 'Co-Founder & COO', null, [
        'Piffle Acquired',
        '$1.5M Raised',
      ]),
      groups: {
        career: ['Previous Exit', 'Co-Founder'],
        network: ['$1.5M Raised'],
      },
      whyNow: 'Prior founder experience makes this a relevant company-building profile.',
    },
    {
      name: 'Rachel Olney',
      detail: founder('Rachel Olney', 'Co-Founder / CTO', null, [
        'Stanford PhD',
        'Repeat Founder',
      ]),
      groups: {
        career: ['Repeat Founder', 'Co-Founder'],
        founder_quality: ['Technical Founder'],
        education: ['Stanford'],
      },
      whyNow: 'Prior founder experience makes this a relevant company-building profile.',
    },
    {
      name: 'Rohit Nallapeta',
      detail: founder('Rohit Nallapeta', 'Co-Founder / CEO', null, [
        'No Funding Found',
        'Open Source',
        'Repeat Founder',
        'AI Agent Governance',
      ]),
      groups: {
        career: ['Repeat Founder', 'Co-Founder'],
      },
      whyNow: 'Prior founder experience makes this a relevant company-building profile.',
    },
  ];

  for (const profile of realProfiles) {
    const result = buildFounderSignalPresentation(profile.detail);
    assert.deepEqual(labels(profile.detail), profile.groups, profile.name);
    assert.equal(result.whyNow, profile.whyNow, profile.name);
  }
});
