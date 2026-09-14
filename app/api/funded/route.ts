import { dbError, withWorkspace } from '@/lib/product-api';

const PAGE_SIZE = 24;
type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
    const allCompanies = (portfolioResult.data || []).map((row) => {
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
        founders: Array.isArray(metadata.founders)
          ? metadata.founders.filter(
              (item): item is string =>
                typeof item === 'string' && Boolean(item.trim()),
            )
          : [],
        founderPattern: text(metadata.founder_pattern),
      };
    });
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
    const metadata = (generationMeta.metadata || {}) as JsonRecord;
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
