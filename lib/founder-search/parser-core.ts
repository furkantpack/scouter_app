import {
  FOUNDER_FILTER_FLAG_NAMES,
  normalizeRuleText,
} from '../founder-filter-flags.ts';
import type { FounderSearchIntent, FounderSearchSortIntent } from './types.ts';

export const KNOWN_COMPANIES = [
  'Meta',
  'Google',
  'Apple',
  'Amazon',
  'Netflix',
  'Microsoft',
  'Stripe',
  'Revolut',
  'Wise',
  'Brex',
  'Nubank',
  'Adyen',
  'OpenAI',
  'DeepMind',
  'Anthropic',
  'Mistral AI',
  'Cohere',
  'xAI',
  'Notion',
  'Linear',
  'Figma',
  'HubSpot',
  'Salesforce',
  'McKinsey',
  'Bain',
  'BCG',
  'Goldman Sachs',
  'Trendyol',
  'Peak Games',
  'Getir',
] as const;

export const KNOWN_INSTITUTIONS = [
  'MIT',
  'Stanford',
  'Harvard',
  'Oxford',
  'Cambridge',
  'ETH Zurich',
  'Imperial College London',
  'Caltech',
  'CMU',
  'METU',
  'Bogazici',
  'Bilkent',
  'AUB',
  'KAUST',
  'HBS',
  'Wharton',
  'INSEAD',
] as const;

export const CAREER_FLAGS = [
  'big_tech_alumni',
  'fintech_alumni',
  'ai_alumni',
  'saas_alumni',
  'top_consulting',
  'regional_alumni',
] as const;

export const EDUCATION_FLAGS = [
  'global_tier_1',
  'technical_tier_1',
  'regional_tier_1',
  'stem_focus',
  'top_mba',
] as const;

export const SECTOR_FLAGS = FOUNDER_FILTER_FLAG_NAMES.filter((flag) =>
  flag.startsWith('sector_'),
);

export const KNOWN_TAGS = [
  'Recently Left',
  'Recent Transition',
  'Career → Founder Transition',
  'Low Public Footprint',
  'Stealth',
  'Stealth / Building Something New',
  'Technical Founder',
  'Infrastructure Engineer',
  'Researcher→Founder',
  'Repeat Founder',
  'Serial Founder',
  'First-Time Founder',
  'Founder Formation',
  'Pre-Seed / Raising',
  'Prior Raise',
  'Exit History',
  'Acquired Founder',
  'Prior Startup',
  'PhD',
  'CS Graduate',
  'Top Research Network',
] as const;

export const KNOWN_GEOGRAPHIES = [
  'Europe',
  'United Kingdom',
  'United States',
  'Turkey',
  'MENA',
  'Nordics',
  'DACH',
  'Iberia',
  'London',
  'New York',
  'San Francisco',
] as const;

export const KNOWN_ROLES = [
  'Founder',
  'Co-Founder',
  'CEO',
  'CTO',
  'Founding Engineer',
  'Researcher',
] as const;

export const TIMING_SIGNALS = [
  'Recently Left',
  'Recent Transition',
  'Career → Founder Transition',
  '0–3 Month Signal',
  '0–6 Month Signal',
  '0–12 Month Signal',
  'Pre-Seed / Raising',
] as const;

export const VISIBILITY_SIGNALS = [
  'Low Public Footprint',
  'Stealth',
  'Stealth / Building Something New',
  'Building in Public',
] as const;

export const FOUNDER_ARCHETYPES = [
  'Technical Founder',
  'Repeat Founder',
  'Serial Founder',
  'First-Time Founder',
  'Founder Formation',
  'Researcher→Founder',
] as const;

export const SORT_INTENTS = [
  'search_match',
  'scouter_score',
  'recent',
] as const;

const COMPANY_ALIASES: Record<string, string[]> = {
  Meta: ['meta', 'facebook'],
  Google: ['google', 'alphabet'],
  Apple: ['apple'],
  Amazon: ['amazon', 'aws'],
  Netflix: ['netflix'],
  Microsoft: ['microsoft'],
  Stripe: ['stripe'],
  Revolut: ['revolut'],
  Wise: ['wise', 'transferwise'],
  Brex: ['brex'],
  Nubank: ['nubank'],
  Adyen: ['adyen'],
  OpenAI: ['openai', 'open ai', 'open-ai'],
  DeepMind: ['deepmind', 'google deepmind'],
  Anthropic: ['anthropic'],
  'Mistral AI': ['mistral ai'],
  Cohere: ['cohere'],
  xAI: ['xai'],
  Notion: ['notion'],
  Linear: ['linear'],
  Figma: ['figma'],
  HubSpot: ['hubspot'],
  Salesforce: ['salesforce'],
  McKinsey: ['mckinsey'],
  Bain: ['bain'],
  BCG: ['bcg', 'boston consulting group'],
  'Goldman Sachs': ['goldman sachs'],
  Trendyol: ['trendyol'],
  'Peak Games': ['peak games'],
  Getir: ['getir'],
};

export function companyAliases(company: string) {
  return COMPANY_ALIASES[company] || [company];
}

const INSTITUTION_ALIASES: Record<string, string[]> = {
  MIT: ['mit', 'massachusetts institute of technology'],
  Stanford: ['stanford', 'stanford university'],
  Harvard: ['harvard', 'harvard university'],
  Oxford: ['oxford', 'university of oxford'],
  Cambridge: ['cambridge', 'university of cambridge'],
  'ETH Zurich': ['eth zurich'],
  'Imperial College London': ['imperial college', 'imperial college london'],
  Caltech: ['caltech', 'california institute of technology'],
  CMU: ['cmu', 'carnegie mellon', 'carnegie mellon university'],
  METU: ['metu', 'middle east technical university'],
  Bogazici: ['bogazici', 'bogazici university'],
  Bilkent: ['bilkent', 'bilkent university'],
  AUB: ['aub', 'american university of beirut'],
  KAUST: ['kaust', 'king abdullah university of science and technology'],
  HBS: ['hbs', 'harvard business school'],
  Wharton: ['wharton', 'the wharton school'],
  INSEAD: ['insead'],
};

export function institutionAliases(institution: string) {
  return INSTITUTION_ALIASES[institution] || [institution];
}

const SECTOR_PHRASES: Record<string, string[]> = {
  sector_ai_ml_infra: [
    'ai infrastructure',
    'ai infra',
    'ml infrastructure',
    'mlops',
    'inference infrastructure',
  ],
  sector_fintech: ['fintech', 'payments', 'banking infrastructure'],
  sector_b2b_saas: ['b2b saas', 'enterprise software', 'workflow automation'],
  sector_deeptech: ['deeptech', 'deep tech', 'hard tech', 'robotics'],
  sector_climate: ['climate', 'climate tech', 'clean energy'],
  sector_health: ['healthtech', 'health tech', 'biotech', 'digital health'],
  sector_defense: ['defense', 'defence', 'dual use', 'govtech'],
  sector_consumer: ['consumer', 'creator economy', 'consumer software'],
  sector_hrtech: ['hrtech', 'hr tech', 'future of work'],
};

function emptyIntent(query: string): FounderSearchIntent {
  return {
    companies: [],
    institutions: [],
    career_flags: [],
    education_flags: [],
    sector_flags: [],
    tags: [],
    geographies: [],
    roles: [],
    timing_signals: [],
    visibility_signals: [],
    founder_archetypes: [],
    semantic_query: query,
    sort_intent: null,
  };
}

function whitelist(values: unknown, allowed: readonly string[]) {
  if (!Array.isArray(values)) return [];
  const canonical = new Map(
    allowed.map((value) => [normalizeRuleText(value), value]),
  );
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => canonical.get(normalizeRuleText(value)))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function normalizeFounderSearchIntent(
  value: unknown,
  rawQuery: string,
): FounderSearchIntent {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const sort = whitelist(
    typeof record.sort_intent === 'string' ? [record.sort_intent] : [],
    SORT_INTENTS,
  )[0] as FounderSearchSortIntent | undefined;

  return {
    companies: whitelist(record.companies, KNOWN_COMPANIES),
    institutions: whitelist(record.institutions, KNOWN_INSTITUTIONS),
    career_flags: whitelist(record.career_flags, CAREER_FLAGS),
    education_flags: whitelist(record.education_flags, EDUCATION_FLAGS),
    sector_flags: whitelist(record.sector_flags, SECTOR_FLAGS),
    tags: whitelist(record.tags, KNOWN_TAGS),
    geographies: whitelist(record.geographies, KNOWN_GEOGRAPHIES),
    roles: whitelist(record.roles, KNOWN_ROLES),
    timing_signals: whitelist(record.timing_signals, TIMING_SIGNALS),
    visibility_signals: whitelist(
      record.visibility_signals,
      VISIBILITY_SIGNALS,
    ),
    founder_archetypes: whitelist(
      record.founder_archetypes,
      FOUNDER_ARCHETYPES,
    ),
    semantic_query:
      typeof record.semantic_query === 'string' && record.semantic_query.trim()
        ? record.semantic_query.trim().slice(0, 500)
        : rawQuery,
    sort_intent: sort || null,
  };
}

function includesPhrase(query: string, values: readonly string[]) {
  return values.some((value) => query.includes(normalizeRuleText(value)));
}

export function fallbackFounderSearchIntent(
  rawQuery: string,
): FounderSearchIntent {
  const intent = emptyIntent(rawQuery);
  const query = normalizeRuleText(rawQuery);
  const careerContext = /\b(ex|former|formerly|alumni|worked at|left)\b/.test(
    query,
  );

  if (careerContext) {
    for (const [company, aliases] of Object.entries(COMPANY_ALIASES)) {
      if (includesPhrase(query, aliases)) intent.companies.push(company);
    }
  }

  const paddedQuery = ` ${query} `;
  for (const [institution, aliases] of Object.entries(INSTITUTION_ALIASES)) {
    if (
      aliases.some((alias) =>
        paddedQuery.includes(` ${normalizeRuleText(alias)} `),
      )
    ) {
      intent.institutions.push(institution);
    }
  }

  for (const [flag, phrases] of Object.entries(SECTOR_PHRASES)) {
    if (includesPhrase(query, phrases)) intent.sector_flags.push(flag);
  }

  if (includesPhrase(query, ['big tech alumni']))
    intent.career_flags.push('big_tech_alumni');
  if (includesPhrase(query, ['fintech alumni']))
    intent.career_flags.push('fintech_alumni');
  if (includesPhrase(query, ['ai alumni']))
    intent.career_flags.push('ai_alumni');
  if (includesPhrase(query, ['saas alumni']))
    intent.career_flags.push('saas_alumni');
  if (includesPhrase(query, ['top university', 'mit', 'stanford']))
    intent.education_flags.push('global_tier_1');

  const tagPhrases: Array<[string, string[]]> = [
    ['Recently Left', ['recently left']],
    ['Recent Transition', ['recent transition']],
    ['Low Public Footprint', ['low visibility', 'low public footprint']],
    ['Stealth', ['stealth']],
    ['Technical Founder', ['technical founder', 'technical founders']],
    ['Repeat Founder', ['repeat founder', 'repeat founders']],
    ['Serial Founder', ['serial founder', 'serial founders']],
    ['First-Time Founder', ['first time founder', 'first-time founder']],
    ['Pre-Seed / Raising', ['raising', 'pre seed', 'pre-seed']],
  ];
  for (const [tag, phrases] of tagPhrases) {
    if (includesPhrase(query, phrases)) intent.tags.push(tag);
  }

  if (includesPhrase(query, ['recently left']))
    intent.timing_signals.push('Recently Left');
  if (includesPhrase(query, ['low visibility', 'low public footprint']))
    intent.visibility_signals.push('Low Public Footprint');
  if (includesPhrase(query, ['stealth']))
    intent.visibility_signals.push('Stealth');
  if (includesPhrase(query, ['technical founder', 'technical founders']))
    intent.founder_archetypes.push('Technical Founder');
  if (includesPhrase(query, ['repeat founder', 'repeat founders']))
    intent.founder_archetypes.push('Repeat Founder');

  for (const geography of KNOWN_GEOGRAPHIES) {
    if (query.includes(normalizeRuleText(geography))) {
      intent.geographies.push(geography);
    }
  }
  for (const role of KNOWN_ROLES) {
    if (query.includes(normalizeRuleText(role))) intent.roles.push(role);
  }

  if (/highest|top scouter|best score/.test(query)) {
    intent.sort_intent = 'scouter_score';
  } else if (/recent|newest/.test(query)) {
    intent.sort_intent = 'recent';
  }

  intent.tags = Array.from(new Set(intent.tags));
  intent.timing_signals = Array.from(new Set(intent.timing_signals));
  intent.visibility_signals = Array.from(new Set(intent.visibility_signals));
  intent.founder_archetypes = Array.from(new Set(intent.founder_archetypes));
  return intent;
}
