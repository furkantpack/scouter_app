import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FUNDED_CANDIDATE_BATCH_SIZE,
  FUNDED_CANDIDATE_RESPONSE_SCHEMA,
  validateCandidateAssessmentResponse,
} from '../lib/funded-intelligence/candidate-validation.ts';
import { instantReferenceMatchScore } from '../lib/funded-intelligence/instant-scoring.ts';
import {
  normalizeMissingLayers,
  recoverHistoricalValidators,
} from '../lib/funded-intelligence/post-processing.ts';
import {
  passesReferenceGates,
  referencePatternScore,
} from '../lib/funded-intelligence/scoring.ts';

const validAssessment = {
  candidate_id: 'founder-1',
  candidate_name: 'Ada Founder',
  founder_state: 'Founder Formation',
  pattern_branch: 'AI voice operations',
  historical_comparable: 'Reference company',
  component_scores: {
    historical_pattern_fit: 80,
    founder_dna: 75,
    early_signal_strength: 70,
    commercial_validation: 60,
    strategic_complementarity: 85,
    alpha_discoverability: 90,
  },
  verification_confidence: 78,
  why_now: 'Verified recent formation signal.',
  visibility: 'low',
  key_evidence: ['https://example.com/evidence'],
  red_flags: [],
  exclusion_reasons: [],
  signals: [],
};

test('uses the approved Reference Pattern Match weights', () => {
  assert.equal(
    referencePatternScore({
      historical_pattern_fit: 100,
      founder_dna: 90,
      early_signal_strength: 80,
      commercial_validation: 70,
      strategic_complementarity: 60,
      alpha_discoverability: 50,
    }),
    79,
  );
});

test('keeps Instant Reference Match separate with deterministic weighted dimensions', () => {
  assert.equal(
    instantReferenceMatchScore({
      sector_category_fit: 100,
      product_technology_fit: 100,
      customer_workflow_fit: 80,
      business_model_fit: 60,
      founder_formation_relevance: 90,
      stage_timing_fit: 70,
      founder_quality: 80,
    }),
    88,
  );
});

test('instant route is internal-only and never calls external discovery providers', () => {
  const source = readFileSync(
    new URL('../lib/funded-intelligence/instant.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /discoverWithExa|discoverWithScout|networkGeminiJson|Firecrawl/i,
  );
  assert.match(source, /founder_product_profile/);
  assert.match(source, /founder_tags/);
  assert.match(source, /founder_filter_flags/);
});

test('instant route keeps GET read-only and performs refreshes through protected POST', () => {
  const route = readFileSync(
    new URL('../app/api/funded/[id]/instant/route.ts', import.meta.url),
    'utf8',
  );
  const getStart = route.indexOf('export async function GET');
  const postStart = route.indexOf('export async function POST');
  const getSource = route.slice(getStart, postStart);
  const postSource = route.slice(postStart);

  assert.ok(getStart >= 0 && postStart > getStart);
  assert.match(getSource, /withWorkspace/);
  assert.match(getSource, /uuid\(params\.id\)/);
  assert.match(getSource, /from\('funded_company_profiles'\)/);
  assert.match(getSource, /instantScouterMatches\(supabase, profile\)/);
  assert.doesNotMatch(
    getSource,
    /createAdminClient|buildInternalFundedProfile|persistInternalProfile|\.insert\(|\.upsert\(|\.update\(|\.delete\(/,
  );

  assert.match(postSource, /withWorkspace/);
  assert.match(postSource, /uuid\(params\.id\)/);
  assert.match(postSource, /loadFundedReference/);
  assert.match(postSource, /createAdminClient/);
  assert.match(postSource, /persistInternalProfile/);

  const component = readFileSync(
    new URL(
      '../components/funded-company-intelligence-view.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    component,
    /requestJson<InstantResponse>\(`\/api\/funded\/\$\{id\}\/instant`,\s*\{\s*method: 'POST'/,
  );
});

test('instant persistence uses unique profile and tag keys', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202609120002_funded_company_instant.sql',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(migration, /unique \(organization_id, funded_company_id\)/);
  assert.match(
    migration,
    /primary key \(organization_id, funded_company_id, tag_id\)/,
  );
});

test('deep reference research uses intentional first-party and market queries', () => {
  const source = readFileSync(
    new URL('../lib/funded-intelligence/deep-research.ts', import.meta.url),
    'utf8',
  );
  for (const intent of [
    'founder_profile',
    'funding',
    'launch',
    'customers',
    'official_product',
    'investor_case',
    'historical_validator',
    'category_evolution',
  ])
    assert.match(source, new RegExp(`intent: '${intent}'`));
  assert.match(source, /source_quality: SourceQuality/);
  assert.match(source, /FIRST_PARTY_HIGH/);
  assert.match(source, /filterUrls\(row\.source_urls, allowed\)/);
});

test('phase-two orchestration persists evidence before deep reasoning and reuses instant context read-only', () => {
  const source = readFileSync(
    new URL('../lib/funded-intelligence/orchestrator.ts', import.meta.url),
    'utf8',
  );
  const evidencePersist = source.indexOf('const evidencePersist');
  const referenceAnalysis = source.indexOf(
    "'funded-company reference analysis'",
  );
  assert.ok(evidencePersist > 0);
  assert.ok(referenceAnalysis > evidencePersist);
  assert.match(source, /loadPersistedInstantContext/);
  assert.doesNotMatch(source, /persistInternalProfile/);
  assert.match(source, /discoverFundedCandidatesWithExa/);
});

test('deep report retains all required analytical sections', () => {
  const source = readFileSync(
    new URL('../lib/funded-intelligence/orchestrator.ts', import.meta.url),
    'utf8',
  );
  for (const section of [
    'Strategic Outcome / Exit',
    'Category Evolution',
    'Founder Archetypes',
    'Strategic Complementarity',
    'Repeating Historical Pattern',
    'Market Layer Becoming Interesting Now',
    'Strongest Pre-Announcement Founder Signal',
    'Why Contact Now',
  ])
    assert.match(source, new RegExp(section.replace(/[ /]/g, '.')));
});

test('keeps confidence and exclusions as hard gates outside the score', () => {
  assert.equal(passesReferenceGates('Founder Now', 80, 79, []), true);
  assert.equal(passesReferenceGates('Noise', 80, 79, []), false);
  assert.equal(passesReferenceGates('Founder Now', 44, 79, []), false);
  assert.equal(passesReferenceGates('Founder Now', 80, 59, []), false);
  assert.equal(
    passesReferenceGates('Founder Now', 80, 79, ['identity conflict']),
    false,
  );
});

test('uses four-candidate batches and a stable candidate_id response schema', () => {
  assert.equal(FUNDED_CANDIDATE_BATCH_SIZE, 4);
  const assessmentSchema = FUNDED_CANDIDATE_RESPONSE_SCHEMA.properties
    .assessments.items as { required: readonly string[] };
  assert.ok(assessmentSchema.required.includes('candidate_id'));
});

test('runtime validation keeps valid assessments and rejects malformed individuals', () => {
  const result = validateCandidateAssessmentResponse({
    assessments: [
      validAssessment,
      { ...validAssessment, candidate_id: 'founder-2', visibility: 'unknown' },
      {
        ...validAssessment,
        candidate_id: 'founder-3',
        component_scores: {
          ...validAssessment.component_scores,
          founder_dna: 'high',
        },
      },
    ],
  });
  assert.equal(result.rootValid, true);
  assert.deepEqual(
    result.valid.map((item) => item.candidate_id),
    ['founder-1'],
  );
  assert.equal(result.rejected.length, 2);
});

test('runtime validation rejects a missing assessments root', () => {
  const result = validateCandidateAssessmentResponse({ candidates: [] });
  assert.equal(result.rootValid, false);
  assert.equal(result.valid.length, 0);
});

test('runtime validation drops malformed signals without discarding a valid candidate', () => {
  const result = validateCandidateAssessmentResponse({
    assessments: [
      {
        ...validAssessment,
        signals: [
          {
            signal_type: 'launch',
            date: null,
            explanation: 'Verified launch.',
            why_it_matters: 'Recent formation signal.',
            source_url: 'https://example.com/evidence',
          },
          {
            signal_type: 'launch',
            date: null,
            explanation: '',
            why_it_matters: '',
            source_url: '',
          },
        ],
      },
    ],
  });
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].signals?.length, 1);
  assert.equal(result.rejected.length, 0);
});

test('migration exposes organization-scoped reads but no client writes', () => {
  const sql = readFileSync(
    new URL(
      '../supabase/migrations/202609120001_funded_company_intelligence.sql',
      import.meta.url,
    ),
    'utf8',
  );

  for (const table of [
    'funded_company_analyses',
    'funded_company_candidates',
    'funded_company_signals',
  ]) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      sql,
      new RegExp(`revoke all on public\\.${table} from anon, authenticated`),
    );
    assert.match(
      sql,
      new RegExp(`grant select on public\\.${table} to authenticated`),
    );
  }

  assert.doesNotMatch(sql, /grant (insert|update|delete|all).*authenticated/i);
});

test('normalizes string missing layers without spreading characters or inventing fields', () => {
  assert.deepEqual(normalizeMissingLayers(['Sovereign voice infrastructure']), [
    { valuable_missing_layer: 'Sovereign voice infrastructure' },
  ]);
});

test('validates object fields and repairs legacy character-spread rows', () => {
  assert.deepEqual(
    normalizeMissingLayers(
      [
        {
          incumbent: 'Platform',
          owns: ['Routing'],
          valuable_missing_layer: 'Vertical workflow layer',
          unsupported: 'drop me',
          source_urls: ['https://example.com/allowed', 'https://bad.test'],
        },
        { 0: 'A', 1: 'I', source_urls: [] },
      ],
      ['https://example.com/allowed'],
    ),
    [
      {
        incumbent: 'Platform',
        owns: ['Routing'],
        valuable_missing_layer: 'Vertical workflow layer',
        source_urls: ['https://example.com/allowed'],
      },
      { valuable_missing_layer: 'AI' },
    ],
  );
});

test('recovers validators only from trusted relevant persisted evidence', () => {
  const result = recoverHistoricalValidators(
    [],
    [
      {
        title: 'Voice AI consolidation event',
        url: 'https://example.com/voice-ai',
        excerpt: 'A verified voice AI acquisition joined complementary layers.',
        source_type: 'category_consolidation',
        source_quality: 'REPUTABLE_PRESS',
      },
      {
        title: 'Voice AI scale-stage round',
        url: 'https://example.com/scale',
        excerpt: 'A verified voice AI company reached scale-stage financing.',
        source_type: 'scale_stage_validator',
        source_quality: 'REPUTABLE_PRESS',
      },
      {
        title: 'Top Sonos competitors',
        url: 'https://example.com/sonos',
        excerpt: 'Unrelated consumer audio evidence.',
        source_type: 'historical_validator',
        source_quality: 'SECONDARY_DATABASE',
      },
      {
        title: 'Weak result',
        url: 'https://example.com/weak',
        excerpt: 'Weak discovery result.',
        source_type: 'historical_validator',
        source_quality: 'WEAK_DISCOVERY',
      },
    ],
    'SONO',
  );
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.source_urls[0]),
    ['https://example.com/voice-ai', 'https://example.com/scale'],
  );
});

test('keeps validators empty when persisted evidence is insufficient', () => {
  assert.deepEqual(
    recoverHistoricalValidators(
      [],
      [
        {
          title: 'Single validator',
          url: 'https://example.com/one',
          excerpt: 'Only one supported event.',
          source_type: 'historical_validator',
          source_quality: 'REPUTABLE_PRESS',
        },
      ],
      'SONO',
    ),
    [],
  );
});
