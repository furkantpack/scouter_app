import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { chunkFounderIds } from '@/lib/founder-filter-pages';

import { instantReferenceMatchScore } from './instant-scoring';
import type { ReferenceRecord } from './orchestrator';

export const FUNDED_PROFILE_VERSION = 'funded-internal-v1';

type JsonRecord = Record<string, unknown>;
type CanonicalCompany = {
  id: string;
  name: string;
  description: string | null;
  category_l1: string | null;
  category_l2: string | null;
  category_l3: string | null;
  category_path: string | null;
  category_freeform: string | null;
  venture_age_min_months: number | null;
  venture_age_max_months: number | null;
  is_stealth_placeholder: boolean | null;
};
type ReferenceTag = {
  tag_id: string | null;
  label: string;
  dimension: string;
  weight: number;
  evidence: string;
};
export type FundedCompanyProfile = {
  funded_company_id: string;
  canonical_company_id: string | null;
  sector: string | null;
  subcategory: string | null;
  business_model: string | null;
  customer_type: string | null;
  product_type: string | null;
  technology_themes: string[];
  market_problem_themes: string[];
  workflow_themes: string[];
  geography: string | null;
  stage: string | null;
  company_maturity: string | null;
  vertical: string | null;
  enterprise_orientation: string | null;
  system_orientation: string | null;
  founder_archetype: string | null;
  software_orientation: string | null;
  reference_tags: ReferenceTag[];
  evidence: Array<{ source: string; value: string; url?: string | null }>;
  profile_version: string;
};

export type InstantMatch = {
  founder_id: string;
  company_id: string | null;
  founder_name: string;
  company_name: string | null;
  current_state: 'Founder Now' | 'Founder Formation' | 'Future Founder';
  scouter_score: number | null;
  instant_match_score: number;
  shared_tags: string[];
  strongest_dimensions: string[];
  why_matched: string;
  visibility: 'very_low' | 'low' | 'emerging' | 'visible';
  source: 'scouter_db';
};

const TAG_RULES = [
  {
    label: 'Voice AI',
    dimension: 'technology',
    weight: 1,
    pattern: /voice ai|ai phone assistant|voice agent/i,
  },
  {
    label: 'Conversational AI',
    dimension: 'technology',
    weight: 0.9,
    pattern: /conversational|phone assistant|voice agent/i,
  },
  {
    label: 'Customer Service Automation',
    dimension: 'workflow',
    weight: 0.95,
    pattern: /customer service|customer call|support call|\bfaqs?\b/i,
  },
  {
    label: 'Workflow Automation',
    dimension: 'workflow',
    weight: 0.85,
    pattern: /workflow|booking|routing|scheduling/i,
  },
] as const;

const clean = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const unique = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
const lower = (values: unknown[]) =>
  values.filter(Boolean).join(' · ').toLowerCase();
const safeFilter = (value: string) => value.replace(/[,().%_]/g, ' ').trim();

async function canonicalCompany(supabase: SupabaseClient, name: string) {
  const result = await supabase
    .from('companies')
    .select('*')
    .ilike('name', name)
    .order('source_row_count', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return (result.data || null) as CanonicalCompany | null;
}

export async function buildInternalFundedProfile(
  supabase: SupabaseClient,
  reference: ReferenceRecord,
) {
  const company = await canonicalCompany(supabase, reference.name);
  const sourceText = lower([
    reference.sector,
    reference.description,
    company?.description,
    company?.category_l1,
    company?.category_l2,
    company?.category_l3,
    company?.category_path,
    company?.category_freeform,
  ]);
  const inferred = TAG_RULES.filter((rule) => rule.pattern.test(sourceText));
  const categoryLabels = unique([
    company?.category_l1,
    company?.category_l2,
    company?.category_l3,
  ]);
  const labels = unique([
    ...categoryLabels,
    ...inferred.map((rule) => rule.label),
  ]);
  const tagRows = labels.length
    ? await supabase.from('tags').select('id,tag').in('tag', labels)
    : { data: [], error: null };
  if (tagRows.error) throw new Error(tagRows.error.message);
  const tagIdByLabel = new Map(
    (tagRows.data || []).map((row) => [String(row.tag), String(row.id)]),
  );
  const referenceTags: ReferenceTag[] = labels.map((label) => {
    const rule = inferred.find((item) => item.label === label);
    return {
      tag_id: tagIdByLabel.get(label) || null,
      label,
      dimension: rule?.dimension || 'category',
      weight:
        rule?.weight ||
        (label === company?.category_l2
          ? 1
          : label === company?.category_l3
            ? 0.95
            : 0.65),
      evidence:
        company?.category_path ||
        company?.description ||
        reference.description ||
        reference.sector ||
        'Persisted funded-company evidence',
    };
  });
  const description = lower([reference.description, company?.description]);
  const workflowThemes = unique([
    /customer service|customer call|support call|faq/i.test(description)
      ? 'Customer Service Automation'
      : null,
    /booking|scheduling/i.test(description) ? 'Scheduling' : null,
    /routing/i.test(description) ? 'Call Routing' : null,
    /inbound|outbound|phone operations/i.test(description)
      ? 'Customer Operations'
      : null,
  ]);
  const enterprise =
    /enterprise|service-business|business/i.test(description) ||
    company?.category_l1 === 'Enterprise Software';
  const maturity =
    company?.venture_age_max_months != null
      ? `Early (${company.venture_age_min_months ?? company.venture_age_max_months}–${company.venture_age_max_months} months)`
      : reference.stage || null;
  const profile: FundedCompanyProfile = {
    funded_company_id: reference.id,
    canonical_company_id: company?.id || null,
    sector: company?.category_l1 || reference.sector,
    subcategory: company?.category_l2 || null,
    business_model:
      company?.category_l1 === 'Enterprise Software'
        ? 'Enterprise Software'
        : null,
    customer_type: /service-business/i.test(description)
      ? 'Enterprise / service businesses'
      : enterprise
        ? 'Enterprise'
        : null,
    product_type: /voice ai agent|ai phone assistant/i.test(description)
      ? 'Voice AI agents'
      : null,
    technology_themes: inferred
      .filter((rule) => rule.dimension === 'technology')
      .map((rule) => rule.label),
    market_problem_themes: unique([
      /phone operations|customer call|support call/i.test(description)
        ? 'Phone-based customer operations'
        : null,
      /booking|routing|faq/i.test(description)
        ? 'Repetitive service workflows'
        : null,
    ]),
    workflow_themes: workflowThemes,
    geography: reference.geography,
    stage: reference.stage,
    company_maturity: maturity,
    vertical: company?.category_l3 || null,
    enterprise_orientation: enterprise ? 'Enterprise-oriented' : null,
    system_orientation: /backend-integrated|integration/i.test(description)
      ? 'Backend-integrated workflow'
      : null,
    founder_archetype: reference.founderPattern,
    software_orientation:
      company?.category_l1 === 'Enterprise Software' ? 'Software-first' : null,
    reference_tags: referenceTags,
    evidence: [
      {
        source: 'funded_company',
        value: reference.description || reference.sector || reference.name,
        url: reference.sourceUrl,
      },
      ...(company
        ? [
            {
              source: 'canonical_company',
              value:
                company.description || company.category_path || company.name,
              url: null,
            },
          ]
        : []),
    ],
    profile_version: FUNDED_PROFILE_VERSION,
  };
  return profile;
}

async function collectCandidateIds(
  supabase: SupabaseClient,
  profile: FundedCompanyProfile,
) {
  const tagIds = profile.reference_tags.flatMap((tag) =>
    tag.tag_id ? [tag.tag_id] : [],
  );
  const tagFounders = tagIds.length
    ? await supabase
        .from('founder_tags')
        .select('founder_id,tag_id')
        .in('tag_id', tagIds)
    : { data: [], error: null };
  if (tagFounders.error) throw new Error(tagFounders.error.message);
  const categoryParts = unique([
    profile.sector,
    profile.subcategory,
    profile.vertical,
  ])
    .map(safeFilter)
    .filter(Boolean);
  const companyFilters = categoryParts
    .flatMap((value) => [
      `category_l1.eq.${value}`,
      `category_l2.eq.${value}`,
      `category_l3.eq.${value}`,
    ])
    .join(',');
  const categoryCompanies = companyFilters
    ? await supabase
        .from('companies')
        .select('id')
        .or(companyFilters)
        .limit(800)
    : { data: [], error: null };
  if (categoryCompanies.error) throw new Error(categoryCompanies.error.message);
  const companyIds = (categoryCompanies.data || []).map((row) =>
    String(row.id),
  );
  const categoryFounderPages = await Promise.all(
    chunkFounderIds(companyIds, 100).map((page) =>
      supabase
        .from('founder_product_profile')
        .select('id')
        .in('company_id', page),
    ),
  );
  const categoryFounderError = categoryFounderPages.find(
    (page) => page.error,
  )?.error;
  if (categoryFounderError) throw new Error(categoryFounderError.message);
  const flagged =
    profile.business_model === 'Enterprise Software'
      ? await supabase
          .from('founder_filter_flags')
          .select('founder_id')
          .eq('sector_b2b_saas', true)
      : { data: [], error: null };
  if (flagged.error) throw new Error(flagged.error.message);
  return unique([
    ...(tagFounders.data || []).map((row) => String(row.founder_id)),
    ...categoryFounderPages.flatMap((page) =>
      (page.data || []).map((row) => String(row.id)),
    ),
    ...(flagged.data || []).map((row) => String(row.founder_id)),
  ]);
}

function candidateTagLabels(row: JsonRecord) {
  return Array.isArray(row.tags)
    ? row.tags.flatMap((item) =>
        item && typeof item === 'object' && clean((item as JsonRecord).tag)
          ? [String((item as JsonRecord).tag)]
          : [],
      )
    : [];
}

export async function instantScouterMatches(
  supabase: SupabaseClient,
  profile: FundedCompanyProfile,
) {
  const ids = await collectCandidateIds(supabase, profile);
  if (!ids.length) return [] as InstantMatch[];
  const profilePages = await Promise.all(
    chunkFounderIds(ids, 100).map((page) =>
      supabase.from('founder_product_profile').select('*').in('id', page),
    ),
  );
  const error = profilePages.find((page) => page.error)?.error;
  if (error) throw new Error(error.message);
  const rows = profilePages.flatMap((page) => page.data || []) as JsonRecord[];
  const refTags = new Map(
    profile.reference_tags.map((tag) => [tag.label.toLowerCase(), tag]),
  );
  return rows
    .flatMap((row): InstantMatch[] => {
      const role = clean(row.founder_role) || '';
      const companyName = clean(row.company_name);
      const tags = candidateTagLabels(row);
      const candidateText = lower([
        row.category_l1,
        row.category_path,
        role,
        row.timing_label,
        ...tags,
      ]);
      if (!companyName || Boolean(row.unresolved_identity_conflict)) return [];
      if (
        profile.canonical_company_id &&
        clean(row.company_id) === profile.canonical_company_id
      )
        return [];
      if (!/founder|co-founder|building/i.test(role)) return [];
      if (/acquired|series\s+[a-z]\+?|late.stage/i.test(candidateText))
        return [];
      const sharedTags = profile.reference_tags
        .filter((tag) => candidateText.includes(tag.label.toLowerCase()))
        .map((tag) => tag.label);
      const highSignal = sharedTags.filter(
        (label) => (refTags.get(label.toLowerCase())?.weight || 0) >= 0.85,
      );
      const categoryExact = Boolean(
        profile.subcategory &&
        candidateText.includes(profile.subcategory.toLowerCase()),
      );
      const sectorExact = Boolean(
        profile.sector && candidateText.includes(profile.sector.toLowerCase()),
      );
      const categoryFit = categoryExact
        ? 100
        : sectorExact
          ? 65
          : highSignal.length
            ? 75
            : 0;
      const technologyFit = Math.round(
        Math.max(
          0,
          ...sharedTags
            .filter(
              (label) =>
                refTags.get(label.toLowerCase())?.dimension === 'technology',
            )
            .map(
              (label) => (refTags.get(label.toLowerCase())?.weight || 0) * 100,
            ),
        ),
      );
      const workflowFit = Math.round(
        Math.max(
          0,
          ...sharedTags
            .filter(
              (label) =>
                refTags.get(label.toLowerCase())?.dimension === 'workflow',
            )
            .map(
              (label) => (refTags.get(label.toLowerCase())?.weight || 0) * 100,
            ),
        ),
      );
      const businessFit =
        sectorExact || candidateText.includes('b2b saas') ? 90 : 0;
      const formationFit = /pre-reveal|stealth|formation|early|priority/i.test(
        candidateText,
      )
        ? 100
        : 70;
      const stageFit = /pre-reveal|stealth|0[-– ]?6m|early/i.test(candidateText)
        ? 100
        : 55;
      const scouterScore =
        row.scouter_score == null ? null : Number(row.scouter_score);
      const quality = Number.isFinite(scouterScore) ? Number(scouterScore) : 50;
      if (!highSignal.length && categoryFit <= 65) return [];
      const score = instantReferenceMatchScore({
        sector_category_fit: categoryFit,
        product_technology_fit: technologyFit,
        customer_workflow_fit: workflowFit,
        business_model_fit: businessFit,
        founder_formation_relevance: formationFit,
        stage_timing_fit: stageFit,
        founder_quality: quality,
      });
      if (score < 55) return [];
      const dimensions = [
        [categoryFit, 'Sector / category'],
        [technologyFit, 'Product / technology'],
        [workflowFit, 'Customer / workflow'],
        [businessFit, 'Business model'],
        [formationFit, 'Founder formation'],
        [stageFit, 'Stage / timing'],
      ] as Array<[number, string]>;
      const strongest = dimensions
        .filter(([value]) => value >= 70)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 3)
        .map(([, label]) => label);
      const timing = clean(row.timing_label) || '';
      return [
        {
          founder_id: String(row.id),
          company_id: clean(row.company_id),
          founder_name: clean(row.name) || 'Unknown founder',
          company_name: companyName,
          current_state: /formation|pre-reveal/i.test(timing)
            ? 'Founder Formation'
            : 'Founder Now',
          scouter_score: scouterScore,
          instant_match_score: score,
          shared_tags: sharedTags,
          strongest_dimensions: strongest,
          why_matched: `${strongest.join(', ')}${sharedTags.length ? ` · ${sharedTags.slice(0, 3).join(', ')}` : ''}`,
          visibility: Boolean(row.is_stealth_placeholder)
            ? 'very_low'
            : /pre-reveal|stealth/i.test(timing)
              ? 'low'
              : 'visible',
          source: 'scouter_db',
        },
      ];
    })
    .sort(
      (left, right) =>
        right.instant_match_score - left.instant_match_score ||
        (right.scouter_score || 0) - (left.scouter_score || 0),
    );
}

export async function persistInternalProfile(
  supabase: SupabaseClient,
  organizationId: string,
  profile: FundedCompanyProfile,
) {
  const payload = {
    organization_id: organizationId,
    ...profile,
    calculated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const saved = await supabase
    .from('funded_company_profiles')
    .upsert(payload, { onConflict: 'organization_id,funded_company_id' });
  if (saved.error) return { persisted: false, error: saved.error };
  const removed = await supabase
    .from('funded_company_profile_tags')
    .delete()
    .eq('organization_id', organizationId)
    .eq('funded_company_id', profile.funded_company_id);
  if (removed.error) throw new Error(removed.error.message);
  const rows = profile.reference_tags.flatMap((tag) =>
    tag.tag_id
      ? [
          {
            organization_id: organizationId,
            funded_company_id: profile.funded_company_id,
            tag_id: tag.tag_id,
            weight: tag.weight,
            evidence: { source: 'internal_profile', value: tag.evidence },
          },
        ]
      : [],
  );
  if (rows.length) {
    const inserted = await supabase
      .from('funded_company_profile_tags')
      .insert(rows);
    if (inserted.error) throw new Error(inserted.error.message);
  }
  return { persisted: true, error: null };
}
