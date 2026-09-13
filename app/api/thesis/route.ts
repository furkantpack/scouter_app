import { withWorkspace, dbError } from '@/lib/product-api';

type JsonRecord = Record<string, unknown>;

export async function GET(request: Request) {
  return withWorkspace(request, async ({ supabase, membership }) => {
    const thesisResult = await supabase
      .from('vc_theses')
      .select('*')
      .eq('organization_id', membership!.organization_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    dbError(thesisResult.error);
    const thesis = thesisResult.data;
    if (!thesis) return { status: 'not_started', thesis: null, dimensions: [], evidence: [], sources: [], portfolioCompanies: [], summary: null };

    const [dimensionsResult, evidenceResult] = await Promise.all([
      supabase.from('vc_thesis_dimensions').select('*').eq('thesis_id', thesis.id).order('created_at', { ascending: false }),
      supabase.from('vc_thesis_evidence').select('*').eq('thesis_id', thesis.id).order('created_at', { ascending: false }),
    ]);
    dbError(dimensionsResult.error); dbError(evidenceResult.error);
    const dimensions = dimensionsResult.data || [];
    const evidence = evidenceResult.data || [];
    const latestStatus = dimensions.find((row) => row.dimension_type === 'generation_status');
    const generationMeta = dimensions.find((row) => row.dimension_type === 'generation_meta');
    const generationId = generationMeta?.value as string | undefined;
    const matchesGeneration = (row: { metadata?: unknown }) => !generationId || (row.metadata as JsonRecord | null)?.generation_id === generationId;
    const currentDimensions = dimensions.filter((row) => row.dimension_type !== 'generation_meta' && matchesGeneration(row));
    const currentEvidence = evidence.filter(matchesGeneration);
    const sources = currentEvidence.filter((row) => (row.metadata as JsonRecord | null)?.record_type === 'source_page').map((row) => {
      const metadata = (row.metadata || {}) as JsonRecord;
      return { url: row.source_url, title: metadata.page_title || row.claim, pageType: metadata.page_type || 'general', crawledAt: metadata.crawled_at, relevance: metadata.source_relevance };
    });
    const analysisEvidence = currentEvidence.filter((row) => (row.metadata as JsonRecord | null)?.record_type === 'analysis_evidence').map((row) => ({ ...row, evidence_text: String(row.evidence_text || '').slice(0, 500) }));
    const portfolioCompanies = currentEvidence.filter((row) => (row.metadata as JsonRecord | null)?.record_type === 'portfolio_company').map((row) => row.metadata);
    return {
      status: latestStatus?.value || (thesis.status === 'active' ? 'ready' : 'not_started'),
      processingError: latestStatus?.value === 'failed' ? ((latestStatus.metadata as JsonRecord | null)?.error_message || 'Analysis failed.') : null,
      thesis,
      generationId: generationId || null,
      summary: (generationMeta?.metadata || null) as JsonRecord | null,
      dimensions: currentDimensions,
      evidence: analysisEvidence,
      sources,
      portfolioCompanies,
    };
  });
}
