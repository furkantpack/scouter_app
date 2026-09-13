import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOUNDER_FILTER_PAGE_FLAGS,
  chunkFounderIds,
  founderFilterFlagForPage,
} from '../lib/founder-filter-pages.ts';

test('maps every deterministic founder page to its persisted flag', () => {
  assert.deepEqual(FOUNDER_FILTER_PAGE_FLAGS, {
    'faang-big-tech': 'big_tech_alumni',
    'fintech-alumni': 'fintech_alumni',
    'ai-alumni': 'ai_alumni',
    'saas-alumni': 'saas_alumni',
    'top-consulting': 'top_consulting',
    'regional-alumni': 'regional_alumni',
    'global-tier-1': 'global_tier_1',
    'technical-tier-1': 'technical_tier_1',
    'regional-tier-1': 'regional_tier_1',
    'stem-focus': 'stem_focus',
    'top-mba': 'top_mba',
    'ai-ml-infrastructure': 'sector_ai_ml_infra',
    'fintech-payments': 'sector_fintech',
    'b2b-saas': 'sector_b2b_saas',
    'deep-tech': 'sector_deeptech',
    'climate-greentech': 'sector_climate',
    'healthtech-biotech': 'sector_health',
    'defense-govtech': 'sector_defense',
    'consumer-creator': 'sector_consumer',
    'hr-future-work': 'sector_hrtech',
  });
});

test('rejects arbitrary database column names', () => {
  assert.equal(founderFilterFlagForPage('big_tech_alumni'), null);
  assert.equal(founderFilterFlagForPage('unknown'), null);
  assert.equal(founderFilterFlagForPage(null), null);
});

test('chunks large filtered founder sets without loss or duplication', () => {
  const ids = Array.from({ length: 485 }, (_, index) => `founder-${index}`);
  const chunks = chunkFounderIds(ids, 100);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 100, 100, 85]);
  assert.deepEqual(chunks.flat(), ids);
});
