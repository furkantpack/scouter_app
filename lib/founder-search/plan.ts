import type { FounderSearchIntent } from './types.ts';

const COMPANY_PARENT_FLAGS: Record<string, string> = {
  Meta: 'big_tech_alumni',
  Google: 'big_tech_alumni',
  Apple: 'big_tech_alumni',
  Amazon: 'big_tech_alumni',
  Netflix: 'big_tech_alumni',
  Microsoft: 'big_tech_alumni',
  Stripe: 'fintech_alumni',
  Revolut: 'fintech_alumni',
  Wise: 'fintech_alumni',
  Brex: 'fintech_alumni',
  Nubank: 'fintech_alumni',
  Adyen: 'fintech_alumni',
  OpenAI: 'ai_alumni',
  DeepMind: 'ai_alumni',
  Anthropic: 'ai_alumni',
  'Mistral AI': 'ai_alumni',
  Cohere: 'ai_alumni',
  xAI: 'ai_alumni',
  Notion: 'saas_alumni',
  Linear: 'saas_alumni',
  Figma: 'saas_alumni',
  HubSpot: 'saas_alumni',
  Salesforce: 'saas_alumni',
  McKinsey: 'top_consulting',
  Bain: 'top_consulting',
  BCG: 'top_consulting',
  'Goldman Sachs': 'top_consulting',
  Trendyol: 'regional_alumni',
  'Peak Games': 'regional_alumni',
  Getir: 'regional_alumni',
};

const INSTITUTION_PARENT_FLAGS: Record<string, string> = {
  MIT: 'global_tier_1',
  Stanford: 'global_tier_1',
  Harvard: 'global_tier_1',
  Oxford: 'global_tier_1',
  Cambridge: 'global_tier_1',
  'ETH Zurich': 'technical_tier_1',
  'Imperial College London': 'technical_tier_1',
  Caltech: 'technical_tier_1',
  CMU: 'technical_tier_1',
  METU: 'regional_tier_1',
  Bogazici: 'regional_tier_1',
  Bilkent: 'regional_tier_1',
  AUB: 'regional_tier_1',
  KAUST: 'regional_tier_1',
  HBS: 'top_mba',
  Wharton: 'top_mba',
  INSEAD: 'top_mba',
};

type OrFilter = { values: string[]; operator: 'or' };
type AndFilter = { values: string[]; operator: 'and' };

export type FounderSearchPlan = {
  hard_filters: {
    companies: OrFilter;
    institutions: OrFilter;
    flags: AndFilter;
    signals: AndFilter;
    roles: OrFilter;
  };
  derived_signals: string[];
  ranking_signals: string[];
};

export function intersectEligibilitySets(sets: Set<string>[]) {
  if (!sets.length) return new Set<string>();
  return new Set(
    Array.from(sets[0]).filter((id) => sets.every((set) => set.has(id))),
  );
}

export function normalizeFounderSearchPlan(
  intent: FounderSearchIntent,
): FounderSearchPlan {
  const subsumed = new Set<string>();
  for (const company of intent.companies) {
    const parent = COMPANY_PARENT_FLAGS[company];
    if (parent) subsumed.add(parent);
  }
  for (const institution of intent.institutions) {
    const parent = INSTITUTION_PARENT_FLAGS[institution];
    if (parent) subsumed.add(parent);
  }

  const requestedFlags = Array.from(
    new Set([
      ...intent.career_flags,
      ...intent.education_flags,
      ...intent.sector_flags,
    ]),
  );
  const signals = Array.from(
    new Set([
      ...intent.tags,
      ...intent.timing_signals,
      ...intent.visibility_signals,
      ...intent.founder_archetypes,
      ...intent.geographies,
    ]),
  ).slice(0, 6);
  const derivedSignals = Array.from(subsumed);

  return {
    hard_filters: {
      companies: { values: [...intent.companies], operator: 'or' },
      institutions: { values: [...intent.institutions], operator: 'or' },
      flags: {
        values: requestedFlags.filter((flag) => !subsumed.has(flag)),
        operator: 'and',
      },
      signals: { values: signals, operator: 'and' },
      roles: {
        values: intent.roles.filter((role) => role !== 'Founder'),
        operator: 'or',
      },
    },
    derived_signals: derivedSignals,
    ranking_signals: Array.from(
      new Set([
        ...derivedSignals,
        ...(intent.semantic_query ? [intent.semantic_query] : []),
      ]),
    ),
  };
}
