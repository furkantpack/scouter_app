import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { searchExaEvidence } from '@/lib/network/exa';
import type { NetworkEvidence } from '@/lib/network/types';

import { fundedGeminiJson } from './gemini';
import type { ReferenceRecord } from './orchestrator';

export type SourceQuality =
  | 'FIRST_PARTY_HIGH'
  | 'PRIMARY_PROFILE'
  | 'REGISTRY'
  | 'INVESTOR_SOURCE'
  | 'REPUTABLE_PRESS'
  | 'SECONDARY_DATABASE'
  | 'WEAK_DISCOVERY';

export type DeepEvidence = NetworkEvidence & {
  source_quality: SourceQuality;
  source_type: string;
  query_intent: string;
  primary: boolean;
};

export type EvidenceFact = {
  value: string;
  source_urls: string[];
  conflict: string | null;
};

export type EvidenceClaim = {
  field: string;
  value: string;
  source_urls: string[];
  conflict: string | null;
};

export type ReferenceEvidencePack = {
  company_identity: {
    exact_name: EvidenceFact;
    website: EvidenceFact;
    founded_date: EvidenceFact;
    hq: EvidenceFact;
    current_status: EvidenceFact;
  };
  founders: Array<{
    name: string;
    prior_employers: string[];
    prior_startups: string[];
    exits: string[];
    domain_experience: string[];
    background: string;
    role_start_date: string;
    source_urls: string[];
    conflict: string | null;
  }>;
  product: EvidenceClaim[];
  customer: EvidenceClaim[];
  traction: EvidenceClaim[];
  funding: EvidenceClaim[];
  outcome: EvidenceClaim[];
  conflicts: Array<{
    field: string;
    accounts: string[];
    source_urls: string[];
  }>;
  sources: DeepEvidence[];
};

type JsonRecord = Record<string, unknown>;

const UNKNOWN = 'Unknown';
const QUALITY_ORDER: Record<SourceQuality, number> = {
  FIRST_PARTY_HIGH: 7,
  PRIMARY_PROFILE: 6,
  REGISTRY: 5,
  INVESTOR_SOURCE: 4,
  REPUTABLE_PRESS: 3,
  SECONDARY_DATABASE: 2,
  WEAK_DISCOVERY: 1,
};

const EVIDENCE_SYSTEM = `You are Scouter's evidence extraction layer. Extract facts only from the supplied source excerpts and persisted data. Never use outside knowledge. Unknown stays exactly "Unknown". Every non-Unknown fact or founder must cite one or more exact source URLs supplied in sources. Prefer one FIRST_PARTY_HIGH source or two independent credible sources. Preserve disagreements in conflict/conflicts; never resolve conflicts by guessing. Product claims should cover original product, current product, core workflow, integrations, and software/infrastructure classification. Customer claims should cover initial archetype, current types, design partners, named customers, and pain. Traction claims should cover growth, usage, customers, geography, retention, pilots, and adoption. Funding claims should cover amount, date, stage, investors, accelerator, and strategic investors. Outcome claims should cover current state, acquisition/partnership, and strategic positioning. Return JSON exactly matching the contract.`;

export const REFERENCE_EVIDENCE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    company_identity: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        ['exact_name', 'website', 'founded_date', 'hq', 'current_status'].map(
          (key) => [key, factSchema()],
        ),
      ),
      required: [
        'exact_name',
        'website',
        'founded_date',
        'hq',
        'current_status',
      ],
    },
    founders: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          prior_employers: stringArraySchema(),
          prior_startups: stringArraySchema(),
          exits: stringArraySchema(),
          domain_experience: stringArraySchema(),
          background: { type: 'STRING' },
          role_start_date: { type: 'STRING' },
          source_urls: stringArraySchema(),
          conflict: { type: 'STRING', nullable: true },
        },
        required: [
          'name',
          'prior_employers',
          'prior_startups',
          'exits',
          'domain_experience',
          'background',
          'role_start_date',
          'source_urls',
          'conflict',
        ],
      },
    },
    product: claimArraySchema(),
    customer: claimArraySchema(),
    traction: claimArraySchema(),
    funding: claimArraySchema(),
    outcome: claimArraySchema(),
    conflicts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          field: { type: 'STRING' },
          accounts: stringArraySchema(),
          source_urls: stringArraySchema(),
        },
        required: ['field', 'accounts', 'source_urls'],
      },
    },
  },
  required: [
    'company_identity',
    'founders',
    'product',
    'customer',
    'traction',
    'funding',
    'outcome',
    'conflicts',
  ],
} as const;

function stringArraySchema() {
  return { type: 'ARRAY', items: { type: 'STRING' } };
}

function factSchema() {
  return {
    type: 'OBJECT',
    properties: {
      value: { type: 'STRING' },
      source_urls: stringArraySchema(),
      conflict: { type: 'STRING', nullable: true },
    },
    required: ['value', 'source_urls', 'conflict'],
  };
}

function claimArraySchema() {
  return {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        field: { type: 'STRING' },
        value: { type: 'STRING' },
        source_urls: stringArraySchema(),
        conflict: { type: 'STRING', nullable: true },
      },
      required: ['field', 'value', 'source_urls', 'conflict'],
    },
  };
}

function hostname(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function rootDomain(value: string | null | undefined) {
  const host = hostname(value);
  if (!host) return null;
  const parts = host.split('.');
  return parts.slice(-2).join('.');
}

function sameDomain(left: string | null, right: string | null) {
  return Boolean(
    left && right && (left === right || left.endsWith(`.${right}`)),
  );
}

function exactTerm(value: string) {
  return new RegExp(
    `(^|[^a-z0-9])${value.replace(/[^a-z0-9]+/gi, '[^a-z0-9]+')}([^a-z0-9]|$)`,
    'i',
  );
}

function classifySource(
  url: string,
  officialDomain: string | null,
  investorDomain: string | null,
): SourceQuality {
  const host = hostname(url);
  if (sameDomain(host, officialDomain)) return 'FIRST_PARTY_HIGH';
  if (/linkedin\.com$/.test(host || '')) return 'PRIMARY_PROFILE';
  if (sameDomain(host, investorDomain)) return 'INVESTOR_SOURCE';
  if (
    /(^|\.)(ycombinator\.com|companieshouse\.gov\.uk|prh\.fi|europa\.eu|sec\.gov|crunchbase\.com)$/.test(
      host || '',
    )
  )
    return 'REGISTRY';
  if (
    /(^|\.)(reuters\.com|bloomberg\.com|techcrunch\.com|sifted\.eu|forbes\.com|wsj\.com|ft\.com|venturebeat\.com)$/.test(
      host || '',
    )
  )
    return 'REPUTABLE_PRESS';
  if (
    /(^|\.)(dealroom\.co|pitchbook\.com|tracxn\.com|cbinsights\.com|wellfound\.com)$/.test(
      host || '',
    )
  )
    return 'SECONDARY_DATABASE';
  return 'WEAK_DISCOVERY';
}

function dedupe(evidence: DeepEvidence[]) {
  const rows = new Map<string, DeepEvidence>();
  for (const item of evidence) {
    const key = item.url.replace(/\/$/, '').toLowerCase();
    const existing = rows.get(key);
    if (
      !existing ||
      QUALITY_ORDER[item.source_quality] >
        QUALITY_ORDER[existing.source_quality]
    )
      rows.set(key, item);
  }
  return Array.from(rows.values());
}

function referenceRelevant(item: DeepEvidence, reference: ReferenceRecord) {
  if (
    item.url.replace(/\/$/, '').toLowerCase() ===
    reference.sourceUrl.replace(/\/$/, '').toLowerCase()
  )
    return true;
  const body = `${item.title || ''} ${item.url} ${item.excerpt}`;
  if (!exactTerm(reference.name).test(body)) return false;
  const context = [
    reference.description,
    reference.sector,
    reference.geography,
    reference.investorName,
    'phone assistant',
    'voice ai',
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter(
      (value) => value.length >= 4 && !['company', 'funded'].includes(value),
    );
  const normalized = body.toLowerCase();
  return (
    Array.from(new Set(context)).filter((term) => normalized.includes(term))
      .length >= 2
  );
}

export function reclassifyDeepEvidence(
  evidence: DeepEvidence[],
  officialWebsite: string | null,
  investorUrl: string | null,
) {
  const officialDomain = rootDomain(officialWebsite);
  const investorDomain = rootDomain(investorUrl);
  return evidence.map((item) => {
    const sourceQuality = classifySource(
      item.url,
      officialDomain,
      investorDomain,
    );
    return {
      ...item,
      source_quality: sourceQuality,
      primary: [
        'FIRST_PARTY_HIGH',
        'PRIMARY_PROFILE',
        'REGISTRY',
        'INVESTOR_SOURCE',
      ].includes(sourceQuality),
    };
  });
}

function cleanQueryValue(value: unknown) {
  return typeof value === 'string'
    ? value
        .replace(/["\r\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

async function executeQueries(
  queries: Array<{ query: string; intent: string; count?: number }>,
  reference: ReferenceRecord,
) {
  const officialDomain = rootDomain(reference.companyUrl);
  const investorDomain = rootDomain(reference.sourceUrl);
  const batches = await Promise.allSettled(
    queries.map(async ({ query, intent, count }) => {
      const rows = await searchExaEvidence(query, count || 4);
      return rows.map((row): DeepEvidence => {
        const sourceQuality = classifySource(
          row.url,
          officialDomain,
          investorDomain,
        );
        return {
          ...row,
          source_quality: sourceQuality,
          source_type: intent,
          query_intent: query,
          primary: [
            'FIRST_PARTY_HIGH',
            'PRIMARY_PROFILE',
            'REGISTRY',
            'INVESTOR_SOURCE',
          ].includes(sourceQuality),
        };
      });
    }),
  );
  return dedupe(
    batches.flatMap((batch) =>
      batch.status === 'fulfilled' ? batch.value : [],
    ),
  );
}

export async function collectReferenceEvidence(reference: ReferenceRecord) {
  const company = cleanQueryValue(reference.name);
  const officialDomain = rootDomain(reference.companyUrl);
  const investorDomain = rootDomain(reference.sourceUrl);
  const founderQueries = reference.founders.flatMap((founder) => [
    {
      query: `"${cleanQueryValue(founder)}" "${company}" founder`,
      intent: 'founder_profile',
    },
    {
      query: `"${cleanQueryValue(founder)}" "${company}" launch interview`,
      intent: 'founder_history',
    },
  ]);
  const queries = [
    { query: `"${company}" founder`, intent: 'founder_profile' },
    { query: `"${company}" funding`, intent: 'funding' },
    { query: `"${company}" launch`, intent: 'launch' },
    { query: `"${company}" customers`, intent: 'customers' },
    { query: `"${company}" product integrations`, intent: 'product' },
    { query: `"${company}" interview`, intent: 'founder_interview' },
    ...(officialDomain && officialDomain !== investorDomain
      ? [
          {
            query: `site:${officialDomain} product`,
            intent: 'official_product',
          },
          {
            query: `site:${officialDomain} blog launch customers`,
            intent: 'official_blog',
          },
        ]
      : []),
    ...(investorDomain
      ? [
          {
            query: `site:${investorDomain} "${company}"`,
            intent: 'investor_case',
          },
        ]
      : []),
    ...founderQueries,
  ];
  const searched = await executeQueries(queries, reference);
  const direct = [reference.companyUrl, reference.sourceUrl]
    .filter((url): url is string => Boolean(url))
    .map((url): DeepEvidence => ({
      source: 'user',
      url,
      title: reference.name,
      excerpt:
        url === reference.sourceUrl && reference.description
          ? reference.description
          : `Persisted reference URL for ${reference.name}.`,
      publishedAt: null,
      source_quality: classifySource(url, officialDomain, investorDomain),
      source_type:
        url === reference.companyUrl && officialDomain !== investorDomain
          ? 'official_website'
          : 'investor_case',
      query_intent: 'persisted_reference',
      primary: true,
    }));
  const collected = dedupe([
    ...direct,
    ...searched.filter((item) => referenceRelevant(item, reference)),
  ]).slice(0, 45);
  const normalizedName = reference.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const likelyOfficial = collected.find((item) => {
    const host = hostname(item.url)?.replace(/[^a-z0-9]/g, '') || '';
    return (
      normalizedName.length >= 4 &&
      host.includes(normalizedName) &&
      !/linkedin|dealroom|crunchbase|startup/.test(host) &&
      ['funding', 'launch', 'customers', 'product'].includes(item.source_type)
    );
  });
  return reclassifyDeepEvidence(
    collected,
    likelyOfficial?.url ||
      (officialDomain && officialDomain !== investorDomain
        ? reference.companyUrl
        : null),
    reference.sourceUrl,
  );
}

function factValue(
  pack: ReferenceEvidencePack,
  field: keyof ReferenceEvidencePack,
) {
  const values: string[] = [];
  const value = pack[field];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object') {
        const row = item as unknown as JsonRecord;
        if (typeof row.value === 'string') values.push(row.value);
        if (typeof row.name === 'string') values.push(row.name);
      }
    }
  }
  return values.filter((item) => item && item !== UNKNOWN).slice(0, 4);
}

export async function collectMarketEvidence(
  reference: ReferenceRecord,
  pack: ReferenceEvidencePack,
  instantProfile: JsonRecord | null,
) {
  const themes = [
    reference.sector,
    instantProfile?.sector,
    instantProfile?.subcategory,
    instantProfile?.product_type,
    ...factValue(pack, 'product'),
    ...factValue(pack, 'customer'),
  ]
    .map((value) => cleanQueryValue(value).slice(0, 80))
    .filter(Boolean)
    .slice(0, 5);
  const market = themes.slice(0, 3).join(' ');
  return executeQueries(
    [
      {
        query: `${market} competitors alternatives`,
        intent: 'historical_validator',
      },
      {
        query: `${market} acquisition partnership category`,
        intent: 'strategic_outcome',
      },
      {
        query: `${market} acquisition consolidation`,
        intent: 'category_consolidation',
      },
      {
        query: `${market} market evolution startups`,
        intent: 'category_evolution',
      },
      {
        query: `${market} strategic partnership incumbent`,
        intent: 'strategic_complementarity',
      },
      {
        query: `${market} scale-stage company funding`,
        intent: 'scale_stage_validator',
      },
    ],
    reference,
  );
}

function allowedUrls(evidence: DeepEvidence[]) {
  return new Set(evidence.map((item) => item.url));
}

function filterUrls(value: unknown, allowed: Set<string>) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === 'string' && allowed.has(item),
      )
    : [];
}

function safeFact(value: unknown, allowed: Set<string>): EvidenceFact {
  const row = value && typeof value === 'object' ? (value as JsonRecord) : {};
  const urls = filterUrls(row.source_urls, allowed);
  const fact = typeof row.value === 'string' ? row.value.trim() : UNKNOWN;
  return {
    value: fact !== UNKNOWN && !urls.length ? UNKNOWN : fact || UNKNOWN,
    source_urls: urls,
    conflict: typeof row.conflict === 'string' ? row.conflict : null,
  };
}

function safeClaims(value: unknown, allowed: Set<string>) {
  return Array.isArray(value)
    ? value.flatMap((item): EvidenceClaim[] => {
        if (!item || typeof item !== 'object') return [];
        const row = item as JsonRecord;
        const urls = filterUrls(row.source_urls, allowed);
        const claimValue =
          typeof row.value === 'string' ? row.value.trim() : '';
        if (!claimValue || claimValue === UNKNOWN || !urls.length) return [];
        return [
          {
            field: typeof row.field === 'string' ? row.field : 'claim',
            value: claimValue,
            source_urls: urls,
            conflict: typeof row.conflict === 'string' ? row.conflict : null,
          },
        ];
      })
    : [];
}

export async function buildEvidencePack(args: {
  reference: ReferenceRecord;
  evidence: DeepEvidence[];
  instantProfile: JsonRecord | null;
  instantTags: JsonRecord[];
}) {
  const { reference, evidence, instantProfile, instantTags } = args;
  const result = await fundedGeminiJson<Omit<ReferenceEvidencePack, 'sources'>>(
    EVIDENCE_SYSTEM,
    {
      persisted_reference: reference,
      persisted_instant_profile_read_only: instantProfile,
      persisted_instant_tags_read_only: instantTags,
      sources: evidence,
      contract: {
        company_identity: {
          exact_name: factSchema(),
          website: factSchema(),
          founded_date: factSchema(),
          hq: factSchema(),
          current_status: factSchema(),
        },
        founders: [],
        product: [],
        customer: [],
        traction: [],
        funding: [],
        outcome: [],
        conflicts: [],
      },
    },
    'funded-company reference evidence extraction',
    REFERENCE_EVIDENCE_SCHEMA as unknown as Record<string, unknown>,
  );
  const raw = result.data as unknown as JsonRecord;
  const allowed = allowedUrls(evidence);
  const identity =
    raw.company_identity && typeof raw.company_identity === 'object'
      ? (raw.company_identity as JsonRecord)
      : {};
  const founders = Array.isArray(raw.founders)
    ? raw.founders.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as JsonRecord;
        const urls = filterUrls(row.source_urls, allowed);
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        if (!name || !urls.length) return [];
        const strings = (value: unknown) =>
          Array.isArray(value)
            ? value.filter(
                (entry): entry is string => typeof entry === 'string',
              )
            : [];
        return [
          {
            name,
            prior_employers: strings(row.prior_employers),
            prior_startups: strings(row.prior_startups),
            exits: strings(row.exits),
            domain_experience: strings(row.domain_experience),
            background:
              typeof row.background === 'string' ? row.background : UNKNOWN,
            role_start_date:
              typeof row.role_start_date === 'string'
                ? row.role_start_date
                : UNKNOWN,
            source_urls: urls,
            conflict: typeof row.conflict === 'string' ? row.conflict : null,
          },
        ];
      })
    : [];
  const conflicts = Array.isArray(raw.conflicts)
    ? raw.conflicts.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as JsonRecord;
        const urls = filterUrls(row.source_urls, allowed);
        return [
          {
            field: typeof row.field === 'string' ? row.field : 'Unknown field',
            accounts: Array.isArray(row.accounts)
              ? row.accounts.filter(
                  (entry): entry is string => typeof entry === 'string',
                )
              : [],
            source_urls: urls,
          },
        ];
      })
    : [];
  return {
    pack: {
      company_identity: {
        exact_name: safeFact(identity.exact_name, allowed),
        website: safeFact(identity.website, allowed),
        founded_date: safeFact(identity.founded_date, allowed),
        hq: safeFact(identity.hq, allowed),
        current_status: safeFact(identity.current_status, allowed),
      },
      founders,
      product: safeClaims(raw.product, allowed),
      customer: safeClaims(raw.customer, allowed),
      traction: safeClaims(raw.traction, allowed),
      funding: safeClaims(raw.funding, allowed),
      outcome: safeClaims(raw.outcome, allowed),
      conflicts,
      sources: evidence,
    } satisfies ReferenceEvidencePack,
    model: result.model,
  };
}

export async function loadPersistedInstantContext(
  supabase: SupabaseClient,
  organizationId: string,
  fundedCompanyId: string,
) {
  const [profile, tags] = await Promise.all([
    supabase
      .from('funded_company_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('funded_company_id', fundedCompanyId)
      .maybeSingle(),
    supabase
      .from('funded_company_profile_tags')
      .select('tag_id,weight,evidence,tags(tag)')
      .eq('organization_id', organizationId)
      .eq('funded_company_id', fundedCompanyId),
  ]);
  return {
    profile: profile.error
      ? null
      : ((profile.data || null) as JsonRecord | null),
    tags: tags.error ? [] : ((tags.data || []) as JsonRecord[]),
    status: {
      profile: profile.error
        ? `unavailable:${profile.error.message}`
        : Boolean(profile.data),
      tags: tags.error
        ? `unavailable:${tags.error.message}`
        : (tags.data || []).length,
    },
  };
}

export function sourceQualityCounts(evidence: DeepEvidence[]) {
  return evidence.reduce<Record<string, number>>((counts, item) => {
    counts[item.source_quality] = (counts[item.source_quality] || 0) + 1;
    return counts;
  }, {});
}
