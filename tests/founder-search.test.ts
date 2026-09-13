import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createFounderSearchClient,
  FOUNDER_SEARCH_ENDPOINT,
  isFullFounderSearchMode,
  shouldSubmitFounderSearchKey,
} from '../lib/founder-search/client.ts';
import {
  canonicalEntityForAlias,
  exactEmployerEvidence,
  exactInstitutionEvidence,
} from '../lib/founder-search/exact-evidence.ts';
import {
  fallbackFounderSearchIntent,
  normalizeFounderSearchIntent,
} from '../lib/founder-search/parser-core.ts';
import {
  intersectEligibilitySets,
  normalizeFounderSearchPlan,
} from '../lib/founder-search/plan.ts';
import {
  getPresetSearchCache,
  PRESET_SEARCH_CACHE_TTL_MS,
  presetSearchCacheKey,
  setPresetSearchCache,
} from '../lib/founder-search/preset-cache.ts';
import {
  FOUNDER_SEARCH_PRESETS,
  founderSearchPreset,
} from '../lib/founder-search/presets.ts';
import {
  calculateSearchMatchScore,
  SEARCH_MATCH_WEIGHTS,
} from '../lib/founder-search/scoring.ts';
import type { FounderSearchResponse } from '../lib/founder-search/types.ts';
import { proposedExactEntityBackfill } from '../scripts/backfill-founder-exact-entities.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('parses Stripe alumni and fintech into exact supported filters', () => {
  const parsed = fallbackFounderSearchIntent(
    'Stripe alumni founders in fintech',
  );
  assert.deepEqual(parsed.companies, ['Stripe']);
  assert.deepEqual(parsed.sector_flags, ['sector_fintech']);
});

test('parses OR employer alumni with AI infrastructure', () => {
  const parsed = fallbackFounderSearchIntent(
    'Ex-OpenAI or DeepMind founders building AI infrastructure',
  );
  assert.deepEqual(parsed.companies, ['OpenAI', 'DeepMind']);
  assert.deepEqual(parsed.sector_flags, ['sector_ai_ml_infra']);
});

test('parses timing, technical-founder and low-visibility signals', () => {
  const parsed = fallbackFounderSearchIntent(
    'Recently left technical founders with low visibility',
  );
  assert.ok(parsed.timing_signals.includes('Recently Left'));
  assert.ok(parsed.visibility_signals.includes('Low Public Footprint'));
  assert.ok(parsed.founder_archetypes.includes('Technical Founder'));
});

test('parses repeat founders in B2B SaaS', () => {
  const parsed = fallbackFounderSearchIntent('Repeat founders in B2B SaaS');
  assert.ok(parsed.founder_archetypes.includes('Repeat Founder'));
  assert.deepEqual(parsed.sector_flags, ['sector_b2b_saas']);
});

test('parses supported education and climate taxonomy', () => {
  const parsed = fallbackFounderSearchIntent(
    'Founders from MIT or Stanford in climate',
  );
  assert.ok(parsed.education_flags.includes('global_tier_1'));
  assert.deepEqual(parsed.sector_flags, ['sector_climate']);
});

test('normalizes mocked Gemini output and rejects invented filters', () => {
  const parsed = normalizeFounderSearchIntent(
    {
      companies: ['Stripe', 'Imaginary Corp'],
      career_flags: ['fintech_alumni', 'invented_flag'],
      education_flags: [],
      sector_flags: ['sector_fintech'],
      tags: ['Repeat Founder', 'Made Up Tag'],
      geographies: [],
      roles: ['Founder'],
      timing_signals: [],
      visibility_signals: [],
      founder_archetypes: ['Repeat Founder'],
      semantic_query: 'unsupported nuance',
      sort_intent: 'search_match',
    },
    'raw query',
  );
  assert.deepEqual(parsed.companies, ['Stripe']);
  assert.deepEqual(parsed.career_flags, ['fintech_alumni']);
  assert.deepEqual(parsed.tags, ['Repeat Founder']);
  assert.equal(parsed.semantic_query, 'unsupported nuance');
});

test('Search Match Score stays separate and centrally weighted', () => {
  assert.deepEqual(SEARCH_MATCH_WEIGHTS, {
    text_relevance: 35,
    structured_exact_matches: 30,
    signal_matches: 15,
    scouter_score: 10,
    timing_relevance: 10,
  });
  assert.equal(
    calculateSearchMatchScore({
      textRelevance: 1,
      structuredCoverage: 1,
      signalCoverage: 1,
      scouterScore: 90,
      timingRelevance: 1,
    }),
    99,
  );
});

test('API is authenticated, bounded, paginated and uses existing RPCs', () => {
  const route = read('../app/api/founder-search/route.ts');
  assert.match(route, /withWorkspace\(request/);
  assert.match(route, /MAX_CANDIDATES = 250/);
  assert.match(route, /pageSize < 1 \|\| pageSize > 50/);
  assert.match(route, /rpc\('search_founders_text'/);
  assert.match(route, /rpc\('search_founders_by_tag'/);
  assert.match(route, /ranked\.slice\(offset, offset \+ pageSize\)/);
  assert.doesNotMatch(route, /score_confidence|embedding|model_version/);
  assert.doesNotMatch(route, /Exa|Firecrawl|Tech\.eu|web search/i);
});

test('API whitelists presets, bypasses Gemini only for them, and caches after auth', () => {
  const route = read('../app/api/founder-search/route.ts');

  assert.match(route, /founderSearchPreset\(requestedPresetId\)/);
  assert.match(route, /Unknown founder search preset\./);
  assert.match(
    route,
    /const parsed = preset[\s\S]*parser_mode: 'preset'[\s\S]*: await parseFounderSearchQuery\(rawQuery\)/,
  );
  assert.ok(
    route.indexOf('withWorkspace(request') <
      route.indexOf('getPresetSearchCache(preset.id'),
  );
  assert.match(route, /getPresetSearchCache\(preset\.id, page, pageSize\)/);
  assert.match(route, /setPresetSearchCache\(preset\.id, page, pageSize/);
  assert.doesNotMatch(route, /list_state|monitor_state|organization_id/);
});

test('parser uses one Gemini request and has a deterministic fallback', () => {
  const parser = read('../lib/founder-search/parser.ts');
  assert.equal((parser.match(/await fetch\(/g) || []).length, 1);
  assert.match(parser, /responseSchema/);
  assert.match(parser, /fallbackFounderSearchIntent/);
  assert.match(parser, /CACHE_TTL_MS/);
});

test('dashboard connects the free-text box and preserves founder drawer actions', () => {
  const page = read('../app/(main)/dashboard/page.tsx');
  const results = read('../components/founder-free-text-results.tsx');
  const client = read('../lib/founder-search/client.ts');
  assert.match(page, /createFounderSearchClient/);
  assert.match(client, /'\/api\/founder-search'/);
  assert.match(results, /Search Match/);
  assert.match(results, /Scouter Score/);
  assert.match(results, /Why matched/);
  assert.match(results, /FounderPreviewDrawer/);
  assert.match(results, /Add to List/);
  assert.match(results, /No founders matched this search\./);
  assert.doesNotMatch(page, /No dashboard sections match your search\./);
  assert.doesNotMatch(results, /parser_mode|confidence|embedding|raw Gemini/i);
});

test('dashboard shows compact ready prompts and removes Late Mode', () => {
  const page = read('../app/(main)/dashboard/page.tsx');
  const presets = read('../lib/founder-search/presets.ts');

  assert.match(
    presets,
    /Find ex-OpenAI or DeepMind founders building AI infrastructure/,
  );
  assert.match(
    presets,
    /Find repeat founders with a previous exit who recently started a new company/,
  );
  assert.match(
    presets,
    /Find MIT or Stanford technical founders in B2B SaaS with high Scouter Scores/,
  );
  assert.match(page, /Try an example/);
  assert.match(page, /setSearchValue\(preset\.query\)/);
  assert.match(page, /runFounderSearch\([\s\S]*preset\.id/);
  assert.match(page, /grid-cols-3/);
  assert.doesNotMatch(page, /Late Mode|late-mode/);
});

test('preset registry contains canonical intents without duplicating them in the UI', () => {
  assert.equal(FOUNDER_SEARCH_PRESETS.length, 3);

  const ai = founderSearchPreset('ex-ai-infrastructure');
  assert.deepEqual(ai?.intent.companies, ['OpenAI', 'DeepMind']);
  assert.deepEqual(ai?.intent.sector_flags, ['sector_ai_ml_infra']);

  const repeat = founderSearchPreset('repeat-founder-new-company');
  assert.deepEqual(repeat?.intent.tags, ['Previous Exit']);
  assert.deepEqual(repeat?.intent.timing_signals, ['Recently Started']);
  assert.deepEqual(repeat?.intent.founder_archetypes, ['Repeat Founder']);
  assert.equal(repeat?.intent.sort_intent, 'recent');
  assert.deepEqual(
    normalizeFounderSearchPlan(repeat!.intent).hard_filters.signals,
    {
      values: ['Previous Exit', 'Recently Started', 'Repeat Founder'],
      operator: 'and',
    },
  );

  const technical = founderSearchPreset('technical-b2b-saas');
  assert.deepEqual(technical?.intent.institutions, ['MIT', 'Stanford']);
  assert.deepEqual(technical?.intent.sector_flags, ['sector_b2b_saas']);
  assert.deepEqual(technical?.intent.founder_archetypes, ['Technical Founder']);
  assert.equal(technical?.intent.sort_intent, 'scouter_score');
  assert.equal(founderSearchPreset('unknown-preset'), null);

  const page = read('../app/(main)/dashboard/page.tsx');
  assert.doesNotMatch(page, /companies:\s*\['OpenAI'/);
  assert.doesNotMatch(page, /sector_ai_ml_infra|sector_b2b_saas/);
});

test('Full Search submits the expected authenticated API payload once while in flight', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let resolveRequest: ((value: any) => void) | undefined;
  const response = new Promise<any>((resolve) => {
    resolveRequest = resolve;
  });
  const client = createFounderSearchClient(async (url, init) => {
    calls.push({ url, init });
    return response;
  });

  const first = client.search('  find ex-open ai founders  ');
  const duplicate = client.search('find ex-open ai founders');
  assert.ok(first);
  assert.equal(duplicate, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, FOUNDER_SEARCH_ENDPOINT);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    query: 'find ex-open ai founders',
    page: 1,
    page_size: 25,
  });

  resolveRequest?.({
    parsed_query: {},
    results: [],
    total: 0,
    page: 1,
    page_size: 25,
  });
  await first;
});

test('preset client request sends only the whitelisted preset id, not filter JSON', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createFounderSearchClient(async (url, init) => {
    calls.push({ url, init });
    return {
      parsed_query: {
        ...FOUNDER_SEARCH_PRESETS[0].intent,
        parser_mode: 'preset',
      },
      results: [],
      total: 0,
      page: 2,
      page_size: 25,
    };
  });

  await client.search(
    FOUNDER_SEARCH_PRESETS[0].query,
    2,
    FOUNDER_SEARCH_PRESETS[0].id,
  );
  const body = JSON.parse(String(calls[0].init.body)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(body, {
    query: FOUNDER_SEARCH_PRESETS[0].query,
    preset_id: 'ex-ai-infrastructure',
    page: 2,
    page_size: 25,
  });
  assert.equal(Object.hasOwn(body, 'intent'), false);
  assert.equal(Object.hasOwn(body, 'filters'), false);
});

test('preset cache varies by preset and pagination while preserving shared scores', () => {
  assert.notEqual(
    presetSearchCacheKey('ex-ai-infrastructure', 1, 25),
    presetSearchCacheKey('ex-ai-infrastructure', 2, 25),
  );
  assert.notEqual(
    presetSearchCacheKey('ex-ai-infrastructure', 1, 25),
    presetSearchCacheKey('technical-b2b-saas', 1, 25),
  );

  const preset = FOUNDER_SEARCH_PRESETS[0];
  const response = {
    parsed_query: { ...preset.intent, parser_mode: 'preset' },
    results: [{ id: 'shared-founder', scouter_score: 91 }],
    total: 1,
    page: 1,
    page_size: 7,
  } as unknown as FounderSearchResponse;
  setPresetSearchCache(preset.id, 1, 7, response, 1_000);

  const cached = getPresetSearchCache(preset.id, 1, 7, 1_001);
  assert.equal(cached?.results[0].scouter_score, 91);
  assert.equal((cached?.results[0] as any).list_state, undefined);
  assert.equal((cached?.results[0] as any).monitor_state, undefined);
  assert.equal(
    getPresetSearchCache(preset.id, 1, 7, 1_000 + PRESET_SEARCH_CACHE_TTL_MS),
    null,
  );
});

test('submit behavior is isolated to Full Search and keeps Shift+Enter as a newline', () => {
  assert.equal(isFullFounderSearchMode('full-search'), true);
  assert.equal(isFullFounderSearchMode('stealth-mode'), false);
  assert.equal(isFullFounderSearchMode('unsupported-mode'), false);
  assert.equal(isFullFounderSearchMode('network'), false);
  assert.equal(shouldSubmitFounderSearchKey('Enter', false), true);
  assert.equal(shouldSubmitFounderSearchKey('Enter', true), false);
  assert.equal(shouldSubmitFounderSearchKey('a', false), false);
});

test('the requested acceptance queries produce supported local structured intent', () => {
  const exOpenAi = fallbackFounderSearchIntent('find ex-open ai founders');
  assert.deepEqual(exOpenAi.companies, ['OpenAI']);

  const stripe = fallbackFounderSearchIntent('Stripe alumni founders');
  assert.deepEqual(stripe.companies, ['Stripe']);

  const technicalRecent = fallbackFounderSearchIntent(
    'technical founders recently left',
  );
  assert.ok(technicalRecent.founder_archetypes.includes('Technical Founder'));
  assert.ok(technicalRecent.timing_signals.includes('Recently Left'));

  const aiInfrastructure = fallbackFounderSearchIntent(
    'AI infrastructure founders',
  );
  assert.deepEqual(aiInfrastructure.sector_flags, ['sector_ai_ml_infra']);
});

test('specific employer and institution filters subsume their parent taxonomy gates', () => {
  const parsed = normalizeFounderSearchIntent(
    {
      companies: ['OpenAI', 'Stripe'],
      institutions: ['Stanford'],
      career_flags: ['ai_alumni', 'fintech_alumni', 'big_tech_alumni'],
      education_flags: ['global_tier_1', 'stem_focus'],
      sector_flags: ['sector_ai_ml_infra'],
    },
    'ex OpenAI or Stripe, Stanford, AI infrastructure',
  );
  const plan = normalizeFounderSearchPlan(parsed);

  assert.deepEqual(plan.hard_filters.companies.values, ['OpenAI', 'Stripe']);
  assert.deepEqual(plan.hard_filters.institutions.values, ['Stanford']);
  assert.deepEqual(plan.hard_filters.flags.values, [
    'big_tech_alumni',
    'stem_focus',
    'sector_ai_ml_infra',
  ]);
  assert.deepEqual(plan.derived_signals, [
    'ai_alumni',
    'fintech_alumni',
    'global_tier_1',
  ]);
});

test('same-dimension entities are OR while independent dimensions remain AND gates', () => {
  const parsed = fallbackFounderSearchIntent(
    'ex OpenAI or DeepMind founders in Europe',
  );
  const plan = normalizeFounderSearchPlan(parsed);

  assert.deepEqual(plan.hard_filters.companies, {
    values: ['OpenAI', 'DeepMind'],
    operator: 'or',
  });
  assert.deepEqual(plan.hard_filters.signals, {
    values: ['Europe'],
    operator: 'and',
  });
  assert.deepEqual(plan.hard_filters.roles.values, []);
  assert.deepEqual(
    Array.from(
      intersectEligibilitySets([
        new Set(['openai-founder', 'deepmind-founder']),
        new Set(['deepmind-founder']),
      ]),
    ),
    ['deepmind-founder'],
  );
});

test('OpenAI spelling variants normalize without broadening the employer', () => {
  for (const query of ['ex OpenAI', 'ex Open AI', 'ex open-ai']) {
    assert.deepEqual(fallbackFounderSearchIntent(query).companies, ['OpenAI']);
  }
  assert.deepEqual(fallbackFounderSearchIntent('ex OpenTable').companies, []);
});

test('an exact employer with no DB match remains an empty eligibility set', () => {
  const plan = normalizeFounderSearchPlan(
    normalizeFounderSearchIntent(
      {
        companies: ['OpenAI'],
        career_flags: ['ai_alumni'],
      },
      'ex OpenAI',
    ),
  );
  assert.deepEqual(plan.hard_filters.flags.values, []);
  assert.equal(intersectEligibilitySets([new Set()]).size, 0);

  const route = read('../app/api/founder-search/route.ts');
  assert.match(route, /!candidateIds\.size && !gateSets\.length/);
});

test('exact entity aliases canonicalize deterministically', () => {
  assert.equal(canonicalEntityForAlias('Open AI', 'employer'), 'OpenAI');
  assert.equal(canonicalEntityForAlias('open-ai', 'employer'), 'OpenAI');
  assert.equal(
    canonicalEntityForAlias('Google DeepMind', 'employer'),
    'DeepMind',
  );
  assert.equal(canonicalEntityForAlias('Facebook', 'employer'), 'Meta');
  assert.equal(
    canonicalEntityForAlias('Carnegie Mellon University', 'institution'),
    'CMU',
  );
});

test('extractors require exact persisted evidence and reject broad or adjacent concepts', () => {
  assert.deepEqual(exactEmployerEvidence('AI Alumni'), []);
  assert.deepEqual(exactEmployerEvidence('Fintech Alumni'), []);
  assert.deepEqual(exactEmployerEvidence('competes with OpenAI'), []);
  assert.deepEqual(exactInstitutionEvidence('Global Tier 1'), []);
  assert.deepEqual(exactInstitutionEvidence('MIT Climate Prize'), []);
  assert.deepEqual(
    exactEmployerEvidence('EX-OPENAI').map((item) => item.canonical),
    ['OpenAI'],
  );
  assert.deepEqual(
    exactInstitutionEvidence('Stanford PhD').map((item) => item.canonical),
    ['Stanford'],
  );
});

test('backfill proposals deduplicate and retain raw-row provenance', () => {
  const raw = JSON.stringify({
    'Uzmanlık / Pattern Etiketleri': 'Founder · EX-OPENAI · Stanford PhD',
  });
  const proposal = proposedExactEntityBackfill([
    { id: 'source-1', canonical_founder_id: 'founder-1', raw_json: raw },
    { id: 'source-2', canonical_founder_id: 'founder-1', raw_json: raw },
  ]);
  assert.equal(proposal.employers.length, 1);
  assert.equal(proposal.employers[0].source_row_id, 'source-1');
  assert.equal(
    proposal.employers[0].source_field,
    'Uzmanlık / Pattern Etiketleri',
  );
  assert.equal(proposal.institutions.length, 1);
  assert.equal(proposal.institutions[0].source_row_id, 'source-1');
});
