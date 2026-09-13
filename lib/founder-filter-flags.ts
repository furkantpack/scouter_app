export const FOUNDER_FILTER_FLAG_NAMES = [
  'big_tech_alumni',
  'fintech_alumni',
  'ai_alumni',
  'saas_alumni',
  'top_consulting',
  'regional_alumni',
  'global_tier_1',
  'technical_tier_1',
  'regional_tier_1',
  'stem_focus',
  'top_mba',
  'sector_ai_ml_infra',
  'sector_fintech',
  'sector_b2b_saas',
  'sector_deeptech',
  'sector_climate',
  'sector_health',
  'sector_defense',
  'sector_consumer',
  'sector_hrtech',
] as const;

export type FounderFilterFlag = (typeof FOUNDER_FILTER_FLAG_NAMES)[number];
export type FounderFilterValues = Record<FounderFilterFlag, boolean>;
export type FlagEvidence = {
  flag: FounderFilterFlag;
  source: string;
  value: string;
  normalized_match: string;
};

type Row = Record<string, unknown>;
export type FounderFilterInput = {
  founderId: string;
  currentCompanyName?: string | null;
  profileCompanyHistory?: unknown;
  profileCategories?: unknown[];
  companyCategories?: unknown[];
  tags?: Array<{
    tag: string;
    isTaxonomyTag?: boolean | null;
    tagFamily?: string | null;
    source?: string | null;
  }>;
  roles?: Array<{
    companyName?: string | null;
    isCurrent?: boolean | null;
    relationshipType?: string | null;
  }>;
};

const EMPLOYERS: Record<FounderFilterFlag, Record<string, string[]>> = {
  big_tech_alumni: {
    Meta: ['meta', 'meta platforms', 'facebook'],
    Google: ['google', 'alphabet'],
    Apple: ['apple', 'apple inc'],
    Amazon: ['amazon', 'amazon web services', 'aws'],
    Netflix: ['netflix'],
    Microsoft: ['microsoft'],
  },
  fintech_alumni: {
    Stripe: ['stripe'], Revolut: ['revolut'], Wise: ['wise', 'transferwise'],
    Brex: ['brex'], Nubank: ['nubank', 'nu bank'], Adyen: ['adyen'],
  },
  ai_alumni: {
    OpenAI: ['openai'], Anthropic: ['anthropic'], DeepMind: ['deepmind', 'google deepmind'],
    'Mistral AI': ['mistral ai'], Cohere: ['cohere'], xAI: ['xai'],
  },
  saas_alumni: {
    Notion: ['notion'], Linear: ['linear'], Figma: ['figma'], HubSpot: ['hubspot'],
    Salesforce: ['salesforce'],
  },
  top_consulting: {
    McKinsey: ['mckinsey', 'mckinsey company'], Bain: ['bain', 'bain company'],
    BCG: ['bcg', 'boston consulting group'], 'Goldman Sachs': ['goldman sachs'],
  },
  regional_alumni: {
    Trendyol: ['trendyol'], 'Peak Games': ['peak', 'peak games'], Getir: ['getir'],
  },
  global_tier_1: {}, technical_tier_1: {}, regional_tier_1: {}, stem_focus: {}, top_mba: {},
  sector_ai_ml_infra: {}, sector_fintech: {}, sector_b2b_saas: {}, sector_deeptech: {},
  sector_climate: {}, sector_health: {}, sector_defense: {}, sector_consumer: {}, sector_hrtech: {},
};

export const NORMALIZATION_ALIASES = {
  employers: EMPLOYERS,
  education: {
    MIT: ['mit', 'massachusetts institute of technology'],
    Stanford: ['stanford', 'stanford university'],
    Harvard: ['harvard', 'harvard university'],
    Oxford: ['oxford', 'university of oxford'],
    Cambridge: ['cambridge', 'university of cambridge'],
    'ETH Zurich': ['eth zurich', 'eth zurich swiss federal institute of technology'],
    'Imperial College London': ['imperial college', 'imperial college london'],
    Caltech: ['caltech', 'california institute of technology'],
    CMU: ['cmu', 'carnegie mellon', 'carnegie mellon university'],
    METU: ['metu', 'middle east technical university', 'orta dogu teknik universitesi'],
    Bogazici: ['bogazici', 'bogazici university'],
    Bilkent: ['bilkent', 'bilkent university'],
    AUB: ['aub', 'american university of beirut'],
    KAUST: ['kaust', 'king abdullah university of science and technology'],
    HBS: ['hbs', 'harvard business school'],
    Wharton: ['wharton', 'the wharton school'],
    INSEAD: ['insead'],
  },
} as const;

const DIRECT_TAGS: Partial<Record<FounderFilterFlag, string[]>> = {
  big_tech_alumni: ['big tech', 'big tech alumni', 'ex bigtech', 'career origin big tech'],
  fintech_alumni: ['fintech alumni', 'career origin fintech'],
  ai_alumni: ['ai alumni', 'career origin ai alumni'],
  saas_alumni: ['saas alumni', 'career origin saas'],
  top_consulting: ['top consulting', 'top consulting alumni'],
  regional_alumni: ['regional alumni', 'tr mena alumni', 'career origin regional'],
  global_tier_1: ['global tier 1'],
  technical_tier_1: ['technical tier 1'],
  regional_tier_1: ['regional tier 1'],
  stem_focus: ['stem', 'stem focus'],
  top_mba: ['top mba'],
  sector_ai_ml_infra: ['ai ml infrastructure', 'ai infrastructure'],
  sector_fintech: ['fintech'],
  sector_b2b_saas: ['b2b saas'],
  sector_deeptech: ['deep tech', 'deeptech'],
  sector_climate: ['climate'],
  sector_health: ['health'],
  sector_defense: ['defense'],
  sector_consumer: ['consumer'],
  sector_hrtech: ['hr tech', 'hrtech'],
};

const EDUCATION: Partial<Record<FounderFilterFlag, string[]>> = {
  global_tier_1: Object.values(NORMALIZATION_ALIASES.education).slice(0, 5).flat(),
  technical_tier_1: Object.values(NORMALIZATION_ALIASES.education).slice(5, 9).flat(),
  regional_tier_1: Object.values(NORMALIZATION_ALIASES.education).slice(9, 14).flat(),
  top_mba: Object.values(NORMALIZATION_ALIASES.education).slice(14).flat(),
};

const STEM_FIELDS = [
  'computer science', 'software engineering', 'engineering', 'electrical engineering',
  'electronic engineering', 'electrical and electronic engineering', 'mechanical engineering',
  'physics', 'mathematics', 'applied mathematics', 'statistics', 'machine learning',
  'artificial intelligence', 'data science', 'computer engineering', 'aerospace engineering',
  'chemical engineering', 'biomedical engineering', 'robotics',
];

const SECTORS: Partial<Record<FounderFilterFlag, string[]>> = {
  sector_ai_ml_infra: [
    'ai ml infrastructure', 'ai infrastructure', 'ml infrastructure', 'mlops', 'inference',
    'inference infrastructure', 'compute infrastructure', 'model infrastructure',
    'agents infrastructure', 'agent infrastructure', 'ai data tooling', 'data tooling for ai',
  ],
  sector_fintech: [
    'fintech', 'payments', 'payment infrastructure', 'banking infrastructure', 'open finance',
    'treasury', 'treasury infrastructure', 'risk infrastructure',
  ],
  sector_b2b_saas: [
    'b2b saas', 'enterprise software', 'workflow automation', 'vertical saas',
    'enterprise tools', 'enterprise workflows', 'enterprise copilots',
  ],
  sector_deeptech: [
    'deep tech', 'hard tech', 'robotics', 'semiconductors', 'advanced materials', 'hardware',
    'industrial deep tech', 'industrial technology', 'autonomous systems',
  ],
  sector_climate: [
    'climate', 'climate tech', 'greentech', 'green tech', 'energy', 'carbon', 'climate data',
    'circular economy', 'clean energy', 'energy mobility',
  ],
  sector_health: [
    'healthtech', 'health tech', 'biotech', 'bio tech', 'digital health', 'diagnostics',
    'drug discovery', 'life sciences', 'healthcare',
  ],
  sector_defense: [
    'defense', 'defence', 'govtech', 'gov tech', 'defense autonomy', 'defence autonomy',
    'defense cyber', 'defence cyber', 'government digital infrastructure', 'dual use',
  ],
  sector_consumer: [
    'consumer', 'creator economy', 'social', 'media', 'consumer marketplaces',
    'consumer marketplace', 'commerce', 'creator tools', 'consumer software',
  ],
  sector_hrtech: [
    'hr tech', 'hrtech', 'future of work', 'recruiting', 'talent intelligence',
    'workforce learning', 'workplace productivity', 'employee tooling', 'culture tooling',
  ],
};

function row(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

export function normalizeRuleText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function exact(value: string, aliases: readonly string[]) {
  const normalized = normalizeRuleText(value);
  return aliases.find((alias) => normalized === normalizeRuleText(alias)) || null;
}

function phrase(value: string, aliases: readonly string[]) {
  const normalized = ` ${normalizeRuleText(value)} `;
  return aliases.find((alias) => normalized.includes(` ${normalizeRuleText(alias)} `)) || null;
}

function previousEmploymentText(value: string) {
  const normalized = normalizeRuleText(value);
  return /^(ex|former|formerly|previously at|worked at|alumni of)\b/.test(normalized) ? normalized : null;
}

function flagsFalse(): FounderFilterValues {
  return Object.fromEntries(FOUNDER_FILTER_FLAG_NAMES.map((flag) => [flag, false])) as FounderFilterValues;
}

export function classifyFounderFilterFlags(input: FounderFilterInput) {
  const flags = flagsFalse();
  const evidence: FlagEvidence[] = [];
  const add = (flag: FounderFilterFlag, source: string, value: string, match: string) => {
    flags[flag] = true;
    if (!evidence.some((item) => item.flag === flag && item.source === source && item.value === value))
      evidence.push({ flag, source, value, normalized_match: match });
  };

  const taxonomyTags = (input.tags || []).filter((tag) => tag.isTaxonomyTag);
  for (const tag of taxonomyTags) {
    for (const flag of FOUNDER_FILTER_FLAG_NAMES) {
      const match = exact(tag.tag, DIRECT_TAGS[flag] || []);
      if (match) add(flag, `founder_tags → tags${tag.tagFamily ? ` (${tag.tagFamily})` : ''}`, tag.tag, match);
    }
  }

  const currentCompany = normalizeRuleText(input.currentCompanyName || '');
  const previousEmployers: Array<{ source: string; value: string }> = [];
  for (const item of Array.isArray(input.profileCompanyHistory) ? input.profileCompanyHistory : []) {
    const history = row(item);
    const companyName = typeof history.company_name === 'string' ? history.company_name.trim() : '';
    if (companyName && history.is_current === false && normalizeRuleText(companyName) !== currentCompany)
      previousEmployers.push({ source: 'founder_product_profile.company_history', value: companyName });
  }
  for (const role of input.roles || []) {
    if (role.companyName && role.isCurrent === false && normalizeRuleText(role.companyName) !== currentCompany)
      previousEmployers.push({ source: 'founder_company_roles → companies.name', value: role.companyName });
  }
  for (const tag of input.tags || []) {
    if (previousEmploymentText(tag.tag))
      previousEmployers.push({ source: 'founder_tags → tags (explicit prior-employer marker)', value: tag.tag });
  }
  for (const employer of previousEmployers) {
    for (const flag of ['big_tech_alumni', 'fintech_alumni', 'ai_alumni', 'saas_alumni', 'top_consulting', 'regional_alumni'] as FounderFilterFlag[]) {
      for (const [canonical, aliases] of Object.entries(EMPLOYERS[flag])) {
        const match = phrase(employer.value, aliases);
        if (match && normalizeRuleText(canonical) !== currentCompany)
          add(flag, employer.source, employer.value, canonical);
      }
    }
  }

  for (const tag of input.tags || []) {
    for (const flag of ['global_tier_1', 'technical_tier_1', 'regional_tier_1', 'top_mba'] as FounderFilterFlag[]) {
      const match = exact(tag.tag, EDUCATION[flag] || []);
      if (match) add(flag, 'founder_tags → tags (explicit education institution)', tag.tag, match);
    }
    const stem = exact(tag.tag, STEM_FIELDS);
    if (stem) add('stem_focus', 'founder_tags → tags (explicit degree/field)', tag.tag, stem);
  }

  const categoryValues = [...(input.companyCategories || []), ...(input.profileCategories || [])]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  for (const value of categoryValues) {
    for (const flag of Object.keys(SECTORS) as FounderFilterFlag[]) {
      const match = phrase(value, SECTORS[flag] || []);
      if (match) add(flag, 'current company canonical category', value, match);
    }
  }
  for (const tag of taxonomyTags) {
    for (const flag of Object.keys(SECTORS) as FounderFilterFlag[]) {
      const match = exact(tag.tag, SECTORS[flag] || []);
      if (match) add(flag, 'founder_tags → tags (explicit sector taxonomy)', tag.tag, match);
    }
  }

  return { flags, evidence };
}
