import 'server-only';

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { collectThesisSources } from '@/lib/firecrawl/thesis-source';
import { analyzeThesis } from '@/lib/gemini/thesis-analysis';
import type {
  SourcePage,
  ThesisAnalysis,
  ThesisValue,
} from '@/lib/thesis/types';
import { normalizePublicWebsite } from '@/lib/thesis/url';

type GenerateInput = {
  supabase: SupabaseClient;
  organizationId: string;
  userId: string;
  sourceUrl: string;
  force?: boolean;
};

export type PreparedThesisGeneration = {
  thesisId: string;
  sourceUrl: string;
  generationId: string;
  status: string;
  queued: boolean;
};

function assertDatabase(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function sourceRows(
  thesisId: string,
  generationId: string,
  sourceUrl: string,
  pages: SourcePage[],
) {
  return pages.map((page) => ({
    thesis_id: thesisId,
    claim: `Source page: ${page.title}`.slice(0, 500),
    source_url: page.url,
    evidence_text: page.content,
    confidence: page.relevance,
    metadata: {
      record_type: 'source_page',
      generation_id: generationId,
      source_url: sourceUrl,
      page_url: page.url,
      page_title: page.title,
      page_type: page.pageType,
      content_hash: page.contentHash,
      crawled_at: page.crawledAt,
      source_relevance: page.relevance,
      firecrawl: page.metadata,
    },
  }));
}

function dimensionRows(
  thesisId: string,
  generationId: string,
  analysis: ThesisAnalysis,
  geminiModel: string,
) {
  const rows: Record<string, unknown>[] = [];
  for (const [dimensionType, values] of Object.entries(analysis.dimensions) as [
    string,
    ThesisValue[],
  ][]) {
    for (const item of values)
      rows.push({
        thesis_id: thesisId,
        dimension_type: dimensionType,
        value: item.value,
        weight: item.weight,
        confidence: item.confidence,
        metadata: { generation_id: generationId, claim_type: item.claim_type },
      });
  }
  for (const item of analysis.anti_thesis || [])
    rows.push({
      thesis_id: thesisId,
      dimension_type: 'anti_thesis',
      value: item.value,
      weight: item.weight,
      confidence: item.confidence,
      metadata: { generation_id: generationId, claim_type: item.claim_type },
    });
  rows.push({
    thesis_id: thesisId,
    dimension_type: 'generation_meta',
    value: generationId,
    weight: 1,
    confidence: analysis.quality.overall_confidence,
    metadata: {
      generation_id: generationId,
      fund_summary: analysis.fund_summary,
      stated_thesis: analysis.stated_thesis,
      observed_thesis: analysis.observed_thesis,
      investment_preferences: analysis.investment_preferences,
      portfolio_patterns: analysis.portfolio_patterns,
      quality: analysis.quality,
      gemini_model: geminiModel,
      completed_at: new Date().toISOString(),
    },
  });
  return rows;
}

function analysisEvidenceRows(
  thesisId: string,
  generationId: string,
  analysis: ThesisAnalysis,
) {
  const evidence = analysis.evidence.map((item) => ({
    thesis_id: thesisId,
    claim: `${item.dimension}: ${item.value}`.slice(0, 500),
    source_url: item.source_url,
    evidence_text: item.evidence_text,
    confidence: item.confidence,
    metadata: {
      record_type: 'analysis_evidence',
      generation_id: generationId,
      dimension: item.dimension,
      value: item.value,
      claim_type: item.claim_type,
      source_title: item.source_title,
    },
  }));
  const companies = (analysis.portfolio_companies || []).map((company) => ({
    thesis_id: thesisId,
    claim: `Portfolio company: ${company.company_name}`.slice(0, 500),
    source_url: company.source_url,
    evidence_text: company.description || company.company_name,
    confidence: 0.8,
    metadata: {
      record_type: 'portfolio_company',
      generation_id: generationId,
      ...company,
    },
  }));
  return [...evidence, ...companies];
}

async function insertInChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  size = 50,
) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase
      .from(table)
      .insert(rows.slice(index, index + size));
    assertDatabase(error, `Could not persist ${table}`);
  }
}

async function recordStatus(
  supabase: SupabaseClient,
  thesisId: string,
  generationId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('vc_thesis_dimensions').insert({
    thesis_id: thesisId,
    dimension_type: 'generation_status',
    value: status,
    weight: 1,
    confidence: 1,
    metadata: {
      generation_id: generationId,
      status,
      recorded_at: new Date().toISOString(),
      ...extra,
    },
  });
  assertDatabase(error, 'Could not persist thesis status');
}

export async function prepareThesisGeneration(
  input: GenerateInput,
): Promise<PreparedThesisGeneration> {
  const sourceUrl = normalizePublicWebsite(input.sourceUrl);
  const generationId = randomUUID();
  const existing = await input.supabase
    .from('vc_theses')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('source_url', sourceUrl)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  assertDatabase(existing.error, 'Could not load thesis');
  if (existing.data) {
    const latestStatus = await input.supabase
      .from('vc_thesis_dimensions')
      .select('value')
      .eq('thesis_id', existing.data.id)
      .eq('dimension_type', 'generation_status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    assertDatabase(latestStatus.error, 'Could not load thesis status');
    if (['crawling', 'analyzing'].includes(latestStatus.data?.value))
      return {
        thesisId: existing.data.id as string,
        sourceUrl,
        generationId,
        status: latestStatus.data!.value as string,
        queued: false,
      };
  }
  const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  const thesisResult = existing.data
    ? await input.supabase
        .from('vc_theses')
        .update({
          status: 'draft',
          name: host,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.data.id)
        .select('*')
        .single()
    : await input.supabase
        .from('vc_theses')
        .insert({
          organization_id: input.organizationId,
          name: host,
          source_url: sourceUrl,
          status: 'draft',
          created_by: input.userId,
        })
        .select('*')
        .single();
  assertDatabase(thesisResult.error, 'Could not start thesis');
  const thesisId = thesisResult.data.id as string;
  await recordStatus(input.supabase, thesisId, generationId, 'crawling');
  return {
    thesisId,
    sourceUrl,
    generationId,
    status: 'crawling',
    queued: true,
  };
}

export async function processPreparedThesisGeneration(
  input: GenerateInput,
  prepared: PreparedThesisGeneration,
) {
  const { thesisId, sourceUrl, generationId } = prepared;
  const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  try {
    const pages = await collectThesisSources(sourceUrl);
    await insertInChunks(
      input.supabase,
      'vc_thesis_evidence',
      sourceRows(thesisId, generationId, sourceUrl, pages),
    );
    await recordStatus(input.supabase, thesisId, generationId, 'analyzing', {
      page_count: pages.length,
    });
    const { analysis, model: geminiModel } = await analyzeThesis(
      sourceUrl,
      pages,
    );
    await insertInChunks(
      input.supabase,
      'vc_thesis_dimensions',
      dimensionRows(thesisId, generationId, analysis, geminiModel),
    );
    await insertInChunks(
      input.supabase,
      'vc_thesis_evidence',
      analysisEvidenceRows(thesisId, generationId, analysis),
    );
    await recordStatus(input.supabase, thesisId, generationId, 'ready', {
      page_count: pages.length,
    });
    const ready = await input.supabase
      .from('vc_theses')
      .update({
        status: 'active',
        name: analysis.fund_summary.name || host,
        updated_at: new Date().toISOString(),
      })
      .eq('id', thesisId);
    assertDatabase(ready.error, 'Could not complete thesis');
    return {
      thesisId,
      generationId,
      status: 'ready',
      pageCount: pages.length,
      selectedPages: pages.map((page) => page.url),
      analysis,
    };
  } catch (error) {
    await recordStatus(input.supabase, thesisId, generationId, 'failed', {
      error_message:
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Unknown processing error',
    }).catch(() => undefined);
    await input.supabase
      .from('vc_theses')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', thesisId);
    throw error;
  }
}

export async function generateThesis(input: GenerateInput) {
  const prepared = await prepareThesisGeneration(input);
  if (!prepared.queued) return prepared;
  return processPreparedThesisGeneration(input, prepared);
}
