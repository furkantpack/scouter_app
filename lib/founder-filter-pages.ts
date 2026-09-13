import type { FounderFilterFlag } from './founder-filter-flags';

export const FOUNDER_FILTER_PAGE_FLAGS = {
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
} as const satisfies Record<string, FounderFilterFlag>;

export type FounderFilterPageId = keyof typeof FOUNDER_FILTER_PAGE_FLAGS;

export function founderFilterFlagForPage(value: string | null) {
  if (!value || !(value in FOUNDER_FILTER_PAGE_FLAGS)) return null;
  return FOUNDER_FILTER_PAGE_FLAGS[value as FounderFilterPageId];
}

export function chunkFounderIds(ids: string[], size = 100) {
  if (!Number.isInteger(size) || size < 1) throw new Error('Chunk size must be a positive integer.');
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size)
    chunks.push(ids.slice(index, index + size));
  return chunks;
}
