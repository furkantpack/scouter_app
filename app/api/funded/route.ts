import { chunkFounderIds } from '@/lib/founder-filter-pages';
import {
  isFounderCompanyRole,
  linkCanonicalCompanyFounders,
  resolvePortfolioCompany,
  type CanonicalCompanyIdentity,
} from '@/lib/portfolio-company-resolution';
import {
  rankRelatedFounders,
  type RelatedFounderCandidate,
} from '@/lib/portfolio-related-founders';
import { dbError, withWorkspace } from '@/lib/product-api';

const PAGE_SIZE = 24;
type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === 'string' && Boolean(item.trim()),
  );
}

function topValue(values: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const value of values)
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return (
    Array.from(counts.entries()).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0]?.[0] || null
  );
}

async function loadCanonicalCompanies(
  supabase: Parameters<Parameters<typeof withWorkspace>[1]>[0]['supabase'],
) {
  const rows: CanonicalCompanyIdentity[] = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const result = await supabase
      .from('companies')
      .select('id,name,url')
      .order('id')
      .range(from, from + pageSize - 1);
    dbError(result.error);
    rows.push(...((result.data || []) as CanonicalCompanyIdentity[]));
    if ((result.data || []).length < pageSize) break;
  }
  return rows;
}

function embeddedTagNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (!item || typeof item !== 'object') return [];
    const tag = (item as JsonRecord).tag;
    return typeof tag === 'string' && tag.trim() ? [tag.trim()] : [];
  });
}

async function loadRelatedFounderCandidates(
  supabase: Parameters<Parameters<typeof withWorkspace>[1]>[0]['supabase'],
) {
  const profilesResult = await supabase
    .from('founder_product_profile')
    .select(
      'id,name,company_id,company_name,category_l1,category_path,tags,founder_role,timing_label,scouter_score,unresolved_identity_conflict',
    )
    .eq('unresolved_identity_conflict', false)
    .order('scouter_score', { ascending: false, nullsFirst: false })
    .limit(400);
  dbError(profilesResult.error);
  const profiles = profilesResult.data || [];
  const ids = profiles.map((profile) => profile.id);
  const pages = chunkFounderIds(ids, 100);
  const [tagPages, flagPages] = await Promise.all([
    Promise.all(
      pages.map((page) =>
        supabase
          .from('founder_tags')
          .select('founder_id,tags(tag)')
          .in('founder_id', page),
      ),
    ),
    Promise.all(
      pages.map((page) =>
        supabase
          .from('founder_filter_flags')
          .select(
            'founder_id,sector_ai_ml_infra,sector_fintech,sector_b2b_saas,sector_deeptech,sector_climate,sector_health,sector_defense,sector_consumer,sector_hrtech',
          )
          .in('founder_id', page),
      ),
    ),
  ]);
  for (const result of [...tagPages, ...flagPages]) dbError(result.error);

  const tagsByFounder = new Map<string, string[]>();
  for (const row of tagPages.flatMap((result) => result.data || [])) {
    const joined = row.tags as unknown as { tag?: string } | null;
    if (joined?.tag)
      tagsByFounder.set(row.founder_id, [
        ...(tagsByFounder.get(row.founder_id) || []),
        joined.tag,
      ]);
  }
  const flagsByFounder = new Map(
    flagPages
      .flatMap((result) => result.data || [])
      .map((row) => [
        row.founder_id,
        Object.entries(row)
          .filter(([key, value]) => key !== 'founder_id' && value === true)
          .map(([key]) => key),
      ]),
  );

  return profiles.map((profile): RelatedFounderCandidate => ({
    id: profile.id,
    name: profile.name,
    companyId: profile.company_id,
    companyName: profile.company_name,
    category: [profile.category_l1, profile.category_path].filter(
      (value): value is string => typeof value === 'string' && Boolean(value),
    ),
    tags: Array.from(
      new Set([
        ...embeddedTagNames(profile.tags),
        ...(tagsByFounder.get(profile.id) || []),
      ]),
    ),
    flags: flagsByFounder.get(profile.id) || [],
    founderRole: profile.founder_role,
    timingLabel: profile.timing_label,
    scouterScore:
      profile.scouter_score == null ? null : Number(profile.scouter_score),
    unresolvedIdentityConflict: profile.unresolved_identity_conflict === true,
  }));
}

export async function GET(request: Request) {
  return withWorkspace(request, async ({ supabase, membership }) => {
    const url = new URL(request.url);
    const page = Math.max(
      0,
      Math.min(10_000, Number(url.searchParams.get('page')) || 0),
    );
    const requestedPageSize = Number(url.searchParams.get('pageSize'));
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.max(1, Math.min(100, Math.trunc(requestedPageSize)))
      : PAGE_SIZE;
    const selected = {
      sector: (url.searchParams.get('sector') || '').trim().slice(0, 100),
      stage: (url.searchParams.get('stage') || '').trim().slice(0, 100),
      geography: (url.searchParams.get('geography') || '').trim().slice(0, 100),
    };
    const thesisResult = await supabase
      .from('vc_theses')
      .select('*')
      .eq('organization_id', membership!.organization_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    dbError(thesisResult.error);
    const thesis = thesisResult.data;
    if (!thesis)
      return {
        thesis: null,
        companies: [],
        count: 0,
        page,
        pageSize,
        filters: { sectors: [], stages: [], geographies: [] },
        summary: null,
        patterns: null,
      };

    const thesisSummary = {
      id: thesis.id,
      name: thesis.name,
      sourceUrl: thesis.source_url,
      updatedAt: thesis.updated_at,
    };

    const dimensionsResult = await supabase
      .from('vc_thesis_dimensions')
      .select('*')
      .eq('thesis_id', thesis.id)
      .order('created_at', { ascending: false });
    dbError(dimensionsResult.error);
    const dimensions = dimensionsResult.data || [];
    const generationMeta = dimensions.find(
      (row) => row.dimension_type === 'generation_meta',
    );
    const generationId = generationMeta?.value as string | undefined;
    if (!generationId)
      return {
        thesis: thesisSummary,
        companies: [],
        count: 0,
        page,
        pageSize,
        filters: { sectors: [], stages: [], geographies: [] },
        summary: null,
        patterns: null,
      };

    const portfolioResult = await supabase
      .from('vc_thesis_evidence')
      .select(
        'id,claim,source_url,evidence_text,confidence,metadata,created_at',
      )
      .eq('thesis_id', thesis.id)
      .contains('metadata', {
        record_type: 'portfolio_company',
        generation_id: generationId,
      })
      .order('created_at', { ascending: true });
    dbError(portfolioResult.error);
    const extractedCompanies = (portfolioResult.data || []).map((row) => {
      const metadata = (row.metadata || {}) as JsonRecord;
      return {
        id: row.id,
        name:
          text(metadata.company_name) ||
          row.claim.replace(/^Portfolio company:\s*/i, ''),
        companyUrl: text(metadata.company_url),
        description: text(metadata.description) || text(row.evidence_text),
        sector: text(metadata.sector),
        stage: text(metadata.stage),
        geography: text(metadata.geography),
        investmentTiming: text(metadata.investment_timing),
        sourceUrl: text(metadata.source_url) || row.source_url,
        founderPattern: text(metadata.founder_pattern),
        companyThesisSignals: [
          ...textList(metadata.thesis_matches),
          ...textList(metadata.company_tags),
          ...textList(metadata.company_signals),
          ...textList(metadata.tags),
          ...textList(metadata.signals),
        ],
      };
    });
    const canonicalCompanies = await loadCanonicalCompanies(supabase);
    const resolutions = extractedCompanies.map((company) => ({
      company,
      resolution: resolvePortfolioCompany(
        { name: company.name, url: company.companyUrl },
        canonicalCompanies,
      ),
    }));
    const canonicalCompanyIds = Array.from(
      new Set(
        resolutions.flatMap(({ resolution }) =>
          resolution.status === 'resolved' ? [resolution.company.id] : [],
        ),
      ),
    );
    const rolesResult = canonicalCompanyIds.length
      ? await supabase
          .from('founder_company_roles')
          .select('founder_id,company_id,role_title,relationship_type')
          .in('company_id', canonicalCompanyIds)
      : { data: [], error: null };
    dbError(rolesResult.error);
    const founderRoles = rolesResult.data || [];
    const founderIds = Array.from(
      new Set(
        founderRoles
          .filter(isFounderCompanyRole)
          .map((role) => role.founder_id),
      ),
    );
    const foundersResult = founderIds.length
      ? await supabase
          .from('founder_product_profile')
          .select('id,name,scouter_score')
          .in('id', founderIds)
      : { data: [], error: null };
    dbError(foundersResult.error);
    const currentDimensions = dimensions.filter(
      (row) =>
        !['generation_meta', 'generation_status', 'anti_thesis'].includes(
          row.dimension_type,
        ) &&
        (row.metadata as JsonRecord | null)?.generation_id === generationId,
    );
    const topDimensions = (type: string) =>
      currentDimensions
        .filter((row) => row.dimension_type === type)
        .sort(
          (left, right) => Number(right.weight || 0) - Number(left.weight || 0),
        )
        .map((row) => row.value)
        .filter((value): value is string => Boolean(value));
    const metadata = (generationMeta.metadata || {}) as JsonRecord;
    const portfolioPatterns = Array.isArray(metadata.portfolio_patterns)
      ? metadata.portfolio_patterns.flatMap((pattern) => {
          if (typeof pattern === 'string') return [pattern];
          if (!pattern || typeof pattern !== 'object') return [];
          const value = (pattern as JsonRecord).pattern;
          return typeof value === 'string' ? [value] : [];
        })
      : [];
    const thesisSignals = [
      ...currentDimensions.map((row) => row.value),
      ...portfolioPatterns,
    ].filter((value): value is string => Boolean(value));
    const linkedCompanies = resolutions.map(({ company, resolution }) => ({
      company,
      resolution,
      founderLinks: linkCanonicalCompanyFounders(
        resolution,
        founderRoles,
        foundersResult.data || [],
      ),
    }));
    const relatedCandidates = linkedCompanies.some(
      ({ founderLinks }) => !founderLinks.founderCount,
    )
      ? await loadRelatedFounderCandidates(supabase)
      : [];
    const allCompanies = linkedCompanies.map(
      ({ company, resolution, founderLinks }) => {
        const canonicalCompanyId =
          resolution.status === 'resolved' ? resolution.company.id : null;
        const relatedFounders = founderLinks.founderCount
          ? []
          : rankRelatedFounders(
              {
                company: {
                  sector: company.sector,
                  description: company.description,
                  thesisSignals: company.companyThesisSignals,
                  stage: company.stage,
                  geography: company.geography,
                  founderPattern: company.founderPattern,
                },
                fund: {
                  name: thesis.name,
                  thesisSignals,
                  founderPatterns: topDimensions('founder_traits'),
                },
                diversityKey: company.id,
              },
              relatedCandidates,
              founderLinks.founders.map((founder) => founder.id),
            );
        return {
          ...company,
          canonicalCompanyId,
          companyResolutionStatus: resolution.status,
          companyResolutionMatch: resolution.matchedBy,
          ...founderLinks,
          relatedFounderCount: relatedFounders.length,
          relatedFounderClassification:
            relatedFounders[0]?.classification || null,
          relatedFounders,
        };
      },
    );
    const filters = {
      sectors: Array.from(
        new Set(
          allCompanies
            .map((company) => company.sector)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
      stages: Array.from(
        new Set(
          allCompanies
            .map((company) => company.stage)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
      geographies: Array.from(
        new Set(
          allCompanies
            .map((company) => company.geography)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    };
    const companyTrait = topDimensions('company_traits')[0] || null;
    const matches = (company: (typeof allCompanies)[number]) => {
      const values = [company.sector, company.stage, company.geography].filter(
        (value): value is string => Boolean(value),
      );
      if (companyTrait) values.push(companyTrait);
      return Array.from(new Set(values)).slice(0, 4);
    };
    const filtered = allCompanies.filter(
      (company) =>
        (!selected.sector || company.sector === selected.sector) &&
        (!selected.stage || company.stage === selected.stage) &&
        (!selected.geography || company.geography === selected.geography),
    );
    const companies = filtered
      .slice(page * pageSize, page * pageSize + pageSize)
      .map((company) => ({
        ...company,
        thesisMatch: matches(company),
        whyFit: matches(company).length
          ? `Scouter interpretation: This company aligns with the persisted ${matches(company).join(', ')} thesis signals.`
          : null,
      }));
    return {
      thesis: thesisSummary,
      companies,
      count: filtered.length,
      totalCount: allCompanies.length,
      page,
      pageSize,
      filters,
      summary: {
        topSector: topValue(allCompanies.map((company) => company.sector)),
        primaryStage: topValue(allCompanies.map((company) => company.stage)),
        primaryGeography: topValue(
          allCompanies.map((company) => company.geography),
        ),
      },
      patterns: {
        sectors: filters.sectors.slice(0, 6),
        stages: filters.stages.slice(0, 6),
        geographies: filters.geographies.slice(0, 6),
        founderTraits: topDimensions('founder_traits').slice(0, 6),
        portfolio: Array.isArray(metadata.portfolio_patterns)
          ? metadata.portfolio_patterns
          : [],
      },
    };
  });
}
