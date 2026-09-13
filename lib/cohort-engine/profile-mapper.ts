import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CohortEvidence,
  CohortProfile,
  MappedCohortProfile,
} from './types';

type Row = Record<string, unknown>;

const FOUNDER_TAGS: Record<string, string> = {
  'technical founder': 'technical_founder',
  'research founder': 'frontier_researcher',
  phd: 'phd',
  'repeat founder': 'repeat_founder',
  'previous exit': 'prior_exit',
  'prior startup exit': 'prior_exit',
  'prior exit': 'prior_exit',
  'founding engineer': 'founding_engineer',
  'open source': 'open_source_builder',
  'open source builder': 'open_source_builder',
  'enterprise sales': 'enterprise_sales',
  'domain expert': 'domain_expert',
  'student founder': 'student_founder',
  'recent grad': 'recent_grad',
};

const CATEGORY_TAGS: Array<[RegExp, string]> = [
  [/\bai\s*\/\s*ml infrastructure\b|\bai infrastructure\b/i, 'ai_infra'],
  [/\bdeveloper tools?\b|\bdevtools?\b/i, 'developer_tools'],
  [/\brobotics\b|\bphysical ai\b/i, 'physical_ai_robotics'],
  [/\bautonomous vehicles?\b|\badas\b|\bai rider copilot\b/i, 'physical_ai_robotics'],
  [/\bcybersecurity\b|\bcyber security\b/i, 'cyber_security'],
  [/\bfintech\b|\bfinancial technology\b/i, 'fintech'],
  [/\bhealth\b|\bbiotech\b|\bbio tech\b/i, 'health_bio'],
  [/\bdeep tech\b|\bdeeptech\b|\bindustrial tech\b/i, 'industrial_deeptech'],
  [/\bhardware\b/i, 'hardware'],
  [/\benterprise saas\b/i, 'enterprise_saas'],
  [/\benterprise software\b/i, 'enterprise_saas'],
  [/\bai hiring\b|\bsmb ai enablement\b|\bai social media operating system\b|\bai social os\b/i, 'vertical_ai'],
  [/\bclimate\b|\benergy\b/i, 'climate_energy'],
  [/\bsemiconductor/i, 'semiconductors'],
  [/\bdefen[cs]e\b|\bdual use\b/i, 'defense_dualuse'],
  [/\bconsumer\b/i, 'consumer'],
  [/\bgaming\b/i, 'gaming'],
  [/\bmarketplace\b/i, 'marketplace'],
  [/\bweb3\b|\bcrypto\b/i, 'web3'],
];

const COMPANY_TAGS: Array<[RegExp, string]> = [
  [/\bai native\b/i, 'ai_native'],
  [/\bhard tech\b|\bdeep tech\b|\bdeeptech\b/i, 'hard_tech'],
  [/\bpatent(ed)?\b/i, 'patented'],
  [/\bsoftware\b|\bsaas\b/i, 'software'],
  [/\bhardware\b/i, 'hardware'],
  [/\benterprise\b|\bb2b\b/i, 'enterprise'],
  [/\bconsumer\b|\bb2c\b/i, 'consumer'],
  [/\bdeveloper\b|\bdevtools?\b/i, 'developer_product'],
  [/\bregulated\b/i, 'regulated'],
  [/\brevenue\b/i, 'has_revenue'],
  [/\btraction\b/i, 'has_traction'],
  [/\bglobal\b/i, 'global_market'],
  [/\bproprietary data\b/i, 'proprietary_data'],
];

const ENGINE_FOUNDER_SIGNALS = new Set([
  'technical_depth', 'research_depth', 'elite_academic', 'elite_employer',
  'repeat_founder', 'prior_exit', 'early_career', 'product_builder',
  'enterprise_gtm', 'domain_expertise', 'speed', 'global_ambition',
  'cofounder_complementarity', 'customer_obsession',
]);
const ENGINE_COMPANY_SIGNALS = new Set([
  'ai_native', 'technical_differentiation', 'defensible_ip',
  'software_high_margin', 'capital_intensive', 'enterprise_b2b', 'consumer',
  'developer_facing', 'regulated_market', 'traction', 'revenue', 'speed_ship',
  'global_market', 'local_market_fit', 'team_small', 'proprietary_data',
]);

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

function profileTagTexts(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
    const row = record(item);
    for (const key of ['tag', 'value']) {
      const tag = row[key];
      if (typeof tag === 'string' && tag.trim()) return [tag.trim()];
    }
    return [];
  });
}

function firstText(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function stage(value: string | null): string | null {
  if (!value) return null;
  const key = normalized(value);
  const stages: Record<string, string> = {
    'pre idea': 'pre_idea', idea: 'idea', prototype: 'prototype',
    'pre launch': 'prototype', launched: 'launched',
    'pre seed': 'pre_seed', seed: 'seed', 'series a': 'series_a',
  };
  return stages[key] || null;
}

function geographies(values: string[]): string[] {
  const result = new Set<string>();
  for (const value of values) {
    const key = normalized(value);
    if (/san francisco|\bsf\b|bay area/.test(key)) result.add('sf');
    if (/united states|\busa\b|\bus\b/.test(key)) result.add('us');
    if (/europe|united kingdom|\buk\b|germany|france|netherlands|turkey|türkiye/.test(key)) result.add('europe');
    if (/middle east|\bmena\b|uae|dubai|abu dhabi/.test(key)) result.add('mena');
    if (/latin america|\blatam\b|brazil|mexico|chile|colombia/.test(key)) result.add('latam');
    if (/asia|india|singapore|japan|korea|china/.test(key)) result.add('asia');
    if (/global|worldwide|remote/.test(key)) result.add('global');
    if (/abu dhabi/.test(key)) result.add('abu_dhabi');
  }
  return Array.from(result);
}

function numericSignals(row: Row, allowed: Set<string>) {
  const result: Record<string, number | null> = {};
  for (const key of Array.from(allowed)) {
    const value = row[key];
    if (value === null) result[key] = null;
    else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
      result[key] = value;
  }
  return result;
}

function evidenceFor(fields: string[], sources: Map<string, string>): CohortEvidence[] {
  return Array.from(new Set(fields)).map((field) => ({
    field,
    status: 'verified',
    source_type: 'database',
    confidence: 0.85,
    freshness_days: null,
    url: null,
    ...(sources.has(field) ? { source_value: sources.get(field) } : {}),
  }));
}

export function mapScouterCohortProfile(input: {
  profile: Row;
  founderTags: string[];
  roles: Row[];
  canonicalCompany?: Row | null;
}): MappedCohortProfile {
  const currentRole =
    input.roles.find((role) => role.company_id === input.profile.company_id) ||
    input.roles[0] ||
    {};
  const canonicalCompanyId =
    typeof input.profile.company_id === 'string' && input.profile.company_id.trim()
      ? input.profile.company_id.trim()
      : null;
  const relatedCompany = record(currentRole.companies);
  const company = Object.keys(record(input.canonicalCompany)).length
    ? record(input.canonicalCompany)
    : relatedCompany;
  const roleCompanyId =
    typeof currentRole.company_id === 'string' && currentRole.company_id.trim()
      ? currentRole.company_id.trim()
      : null;
  const companyId = canonicalCompanyId || roleCompanyId;
  const rawProfileTags = profileTagTexts(input.profile.tags);
  const rawFounderTags = Array.from(new Set([...input.founderTags, ...rawProfileTags]));
  const founderTagValues = rawFounderTags.map(normalized);
  const mappedFounderTags = new Set<string>();
  const unmapped = new Set<string>();
  const evidenceSources = new Map<string, string>();
  for (let index = 0; index < founderTagValues.length; index += 1) {
    const tag = founderTagValues[index];
    const mapped = FOUNDER_TAGS[tag];
    if (mapped) {
      mappedFounderTags.add(mapped);
      evidenceSources.set(mapped, rawFounderTags[index]);
    }
    else if (tag) unmapped.add(tag);
  }

  const taxonomy = [
    ...strings(input.profile.category_l1),
    ...strings(input.profile.category_path),
    ...rawProfileTags,
    ...strings(company.category),
    ...strings(company.categories),
    ...strings(company.tags),
    ...strings(company.sector),
    ...strings(company.industry),
  ];
  const categories = new Set<string>();
  const companyTags = new Set<string>();
  for (const value of taxonomy) {
    let matched = Boolean(FOUNDER_TAGS[normalized(value)]);
    for (const [pattern, mapped] of CATEGORY_TAGS)
      if (pattern.test(value)) {
        categories.add(mapped);
        evidenceSources.set(mapped, value);
        matched = true;
      }
    for (const [pattern, mapped] of COMPANY_TAGS)
      if (pattern.test(value)) {
        companyTags.add(mapped);
        evidenceSources.set(mapped, value);
        matched = true;
      }
    if (!matched && value.trim()) unmapped.add(normalized(value));
  }

  const founder = numericSignals(input.profile, ENGINE_FOUNDER_SIGNALS);
  const companySignals = numericSignals(company, ENGINE_COMPANY_SIGNALS);
  const founderTagSignals: Record<string, Record<string, number>> = {
    technical_founder: { technical_depth: 0.9 },
    frontier_researcher: { technical_depth: 0.95, research_depth: 0.95 },
    phd: { research_depth: 0.8 },
    repeat_founder: { repeat_founder: 1 },
    prior_exit: { prior_exit: 1, repeat_founder: 1 },
    founding_engineer: { product_builder: 0.95, technical_depth: 0.85 },
    open_source_builder: { product_builder: 0.95, technical_depth: 0.85 },
    enterprise_sales: { enterprise_gtm: 0.95 },
    domain_expert: { domain_expertise: 0.95 },
    student_founder: { early_career: 1 },
    recent_grad: { early_career: 0.9 },
  };
  const companyTagSignals: Record<string, Record<string, number>> = {
    ai_native: { ai_native: 1 }, hard_tech: { technical_differentiation: 0.95, defensible_ip: 0.85, capital_intensive: 0.75 },
    patented: { defensible_ip: 1 }, software: { software_high_margin: 0.9 }, hardware: { capital_intensive: 0.9, software_high_margin: 0.2 },
    enterprise: { enterprise_b2b: 0.95 }, consumer: { consumer: 0.95 }, developer_product: { developer_facing: 0.95 },
    regulated: { regulated_market: 0.95 }, has_traction: { traction: 0.85 }, has_revenue: { revenue: 0.8 },
    global_market: { global_market: 0.95 }, proprietary_data: { proprietary_data: 0.95 },
  };
  for (const tag of Array.from(mappedFounderTags))
    for (const [key, value] of Object.entries(founderTagSignals[tag] || {}))
      founder[key] = Math.max(founder[key] || 0, value);
  for (const tag of Array.from(companyTags))
    for (const [key, value] of Object.entries(companyTagSignals[tag] || {}))
      companySignals[key] = Math.max(companySignals[key] || 0, value);

  for (const rawTag of rawProfileTags) {
    const tag = normalized(rawTag);
    if (/^\d+\+\s+waitlist$/.test(tag)) {
      companySignals.traction = Math.max(companySignals.traction || 0, 0.65);
      evidenceSources.set('traction', rawTag);
      unmapped.delete(tag);
    }
    if (/^\d+\s+(?:pre launch paid|paid prelaunch)$/.test(tag)) {
      companySignals.traction = Math.max(companySignals.traction || 0, 0.75);
      companySignals.revenue = Math.max(companySignals.revenue || 0, 0.65);
      evidenceSources.set('traction', rawTag);
      evidenceSources.set('revenue', rawTag);
      unmapped.delete(tag);
    }
  }

  const structuredStage = stage(firstText(company, ['stage', 'funding_stage', 'company_stage']));
  const explicitTagStage = rawProfileTags
    .map((tag) => stage(tag))
    .find((value): value is string => Boolean(value)) || null;
  const mappedStage = structuredStage || explicitTagStage;
  if (mappedStage) evidenceSources.set('stage', structuredStage ? `companies.${mappedStage}` : rawProfileTags.find((tag) => stage(tag) === mappedStage) || mappedStage);
  if (explicitTagStage) {
    for (const tag of rawProfileTags.filter((value) => stage(value) === explicitTagStage))
      unmapped.delete(normalized(tag));
  }

  const profile: CohortProfile = {
    founder,
    company: companySignals,
    categories: Array.from(categories),
    stage: mappedStage,
    geographies: geographies([
      ...strings(company.location), ...strings(company.headquarters),
      ...strings(company.hq_location), ...strings(company.country),
      ...strings(company.city),
    ]),
    evidence: evidenceFor([
      ...Object.keys(founder), ...Object.keys(companySignals),
      ...Array.from(categories), ...Array.from(mappedFounderTags),
      ...(mappedStage ? ['stage'] : []),
    ], evidenceSources),
  };
  return {
    profile,
    companyId,
    unmappedTaxonomy: Array.from(unmapped).sort(),
  };
}

export async function loadScouterCohortProfile(
  supabase: SupabaseClient,
  founderId: string,
): Promise<MappedCohortProfile | null> {
  const profileResult = await supabase
    .from('founder_product_profile')
    .select('*')
    .eq('id', founderId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) return null;
  const canonicalCompanyId =
    typeof profileResult.data.company_id === 'string' && profileResult.data.company_id.trim()
      ? profileResult.data.company_id.trim()
      : null;
  const [companyResult, roleResult, tagResult] = await Promise.all([
    canonicalCompanyId
      ? supabase.from('companies').select('*').eq('id', canonicalCompanyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('founder_company_roles').select('*,companies(*)').eq('founder_id', founderId),
    supabase.from('founder_tags').select('tags(tag)').eq('founder_id', founderId),
  ]);
  const error = companyResult.error || roleResult.error || tagResult.error;
  if (error) throw error;
  const founderTags = (tagResult.data || [])
    .map((row) => record(row.tags).tag)
    .filter((tag): tag is string => typeof tag === 'string');
  return mapScouterCohortProfile({
    profile: profileResult.data as Row,
    roles: (roleResult.data || []) as Row[],
    founderTags,
    canonicalCompany: companyResult.data as Row | null,
  });
}
