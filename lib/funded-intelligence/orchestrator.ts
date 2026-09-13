import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { discoverFundedCandidatesWithExa } from '@/lib/network/exa';
import { discoverWithScout } from '@/lib/network/scout-adapter';
import { discoverInScouter } from '@/lib/network/scouter-source';
import type { NetworkCandidate, NetworkEvidence } from '@/lib/network/types';

import {
  buildEvidencePack,
  collectMarketEvidence,
  collectReferenceEvidence,
  loadPersistedInstantContext,
  reclassifyDeepEvidence,
  sourceQualityCounts,
  type DeepEvidence,
  type ReferenceEvidencePack,
} from './deep-research';
import {
  FUNDED_CANDIDATE_BATCH_SIZE,
  fundedCandidateAssessmentJson,
  fundedGeminiJson,
  safeGeminiDiagnostic,
} from './gemini';
import {
  normalizeMissingLayers,
  recoverHistoricalValidators,
} from './post-processing';
import { passesReferenceGates, referencePatternScore } from './scoring';
import type { CandidateAssessment, ReferenceIntelligence } from './types';

export const FUNDED_INTELLIGENCE_ENGINE_VERSION = 'reference-pattern-v2.1.2';

const REFERENCE_SYSTEM = `You are the Scouter Reference Company Pattern Intelligence Agent. The VC and portfolio relationship are already known: never rediscover them. Produce venture-intelligence research, not a startup summary. Reason only from the supplied structured evidence pack and historical/category source excerpts. Never use outside knowledge or invent a fact. Unknown stays Unknown. Conflicts must remain visible. Every named company, event, customer, founder-history statement, financing, acquisition, partnership, or traction claim must be supported by an exact supplied URL.

Reconstruct: what problem the reference company saw early; why the wedge worked; founder DNA; investor and customer patterns; category evolution; value-chain structure; maturity; historical validators; strategic/M&A patterns; missing layers; reusable founder archetypes; the strongest pre-announcement signal; and why contact now. Historical validators must be OTHER companies/events, not the reference company's own milestones, and should contain 2-5 entries when evidence supports them. Similarity must be Strong, Medium, or Weak.

Value-chain branches are BUSINESS-MODEL / MARKET-LAYER branches dynamically derived from evidence. Never organize them by funding stage. Keep maturity as a separate tree using Pre-announcement / Stealth, Alpha / Pre-launch, Very Early, Pre-seed, Seed, Series A, Growth, and Acquired / Consolidator where relevant. For an acquisition, explain incumbent-owned layers + target-owned missing layer + combined structure. Without an exit, discuss only evidenced comparable outcomes and strategic complementarity; never predict an acquisition as fact.

Category evolution must answer: "What is the current version of the problem this company originally solved?" Follow EARLY MARKET -> REFERENCE COMPANY WEDGE -> NEXT CATEGORY FORM -> CURRENT SCALE-STAGE VALIDATORS -> NEXT OPPORTUNITY LAYER. Founder archetypes must express domain/workflow/company-formation patterns and must not substitute prestige for founder-market fit. Also produce network_reference exactly in its supplied contract for downstream candidate discovery. Return JSON exactly matching the contract.`;

const CANDIDATE_SYSTEM = `You are Scouter's Reference Pattern candidate analyst. Use only supplied candidate and reference evidence. Never invent identity, founder status, dates, traction, customers, funding, or citations. Scouter Score is immutable context and is separate from Reference Pattern Match. Score each component 0-100: historical_pattern_fit, founder_dna, early_signal_strength, commercial_validation, strategic_complementarity, alpha_discoverability. Verification confidence is separate. Prefer founders started within six months, stealth/pre-launch/alpha, teams of 1-10, design partners/pilots, recent career moves, repeat founders, exits, domain depth, technical founder-market fit and low visibility. Mark Noise and add exclusion_reasons for mature/Series A+, acquired, old-company rebrands, consultancies, employees without building evidence, unresolved identity, unrelated keyword matches, or weak founder signal. Zero passing candidates is acceptable. Signals must use a URL already present in that candidate's evidence. Return JSON exactly matching the contract.`;

const EXTERNAL_SYSTEM = `Extract real founder/company candidates only from supplied Exa evidence. Do not infer missing identities or founder status. Omit results without a specific person and building signal. Return JSON {"candidates":[{"name":"","company":null,"role":null,"profileText":"","linkedinUrl":null,"companyUrl":null,"evidenceUrls":[]}]}.`;

const REPORT_SYSTEM = `Write a detailed investor-facing Markdown venture-intelligence report from the supplied verified structured analysis. Do not add facts, private reasoning, or citations not present in evidence_urls. Do not collapse sections. Use these sections exactly and in this order: Executive Summary; Verified Reference Company; Original Wedge; Founder DNA; Investor Pattern; Customer Pattern; Strategic Outcome / Exit; Value-Chain Tree; Maturity Tree; Historical Pattern Validation; Category Evolution; Missing-Layer Map; Emerging Candidate Ranking; Candidate Detail Cards; Excluded Candidates; Founder Archetypes; Strategic Complementarity; Repeating Historical Pattern; Market Layer Becoming Interesting Now; Strongest Pre-Announcement Founder Signal; Why Contact Now; Final Scouter Insight. Return JSON {"report_markdown":"..."}.`;

type ReferenceRecord = {
  id: string;
  thesisId: string;
  investorName: string;
  name: string;
  companyUrl: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  geography: string | null;
  investmentTiming: string | null;
  investmentAmount: string | null;
  sourceUrl: string;
  founders: string[];
  founderPattern: string | null;
  existingPortfolioEvidence: Record<string, unknown>;
};

function number(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function candidateKey(candidate: NetworkCandidate) {
  return (
    candidate.founderId ||
    candidate.linkedinUrl ||
    candidate.companyUrl ||
    `${candidate.name}|${candidate.company || ''}`
  ).toLowerCase();
}

function dedupe(candidates: NetworkCandidate[]) {
  const result = new Map<string, NetworkCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const previous = result.get(key);
    if (!previous) result.set(key, candidate);
    else
      result.set(key, {
        ...previous,
        founderId: previous.founderId || candidate.founderId,
        scouterScore: previous.scouterScore ?? candidate.scouterScore,
        sourceMix: Array.from(
          new Set([...previous.sourceMix, ...candidate.sourceMix]),
        ),
        evidence: Array.from(
          new Map(
            [...previous.evidence, ...candidate.evidence].map((item) => [
              item.url,
              item,
            ]),
          ).values(),
        ),
        profileText: `${previous.profileText} · ${candidate.profileText}`.slice(
          0,
          5000,
        ),
        identityStatus:
          previous.identityStatus === 'confirmed' ||
          candidate.identityStatus === 'confirmed'
            ? 'confirmed'
            : 'probable',
      });
  }
  return Array.from(result.values());
}

async function extractExternal(evidence: NetworkEvidence[]) {
  if (!evidence.length) return [] as NetworkCandidate[];
  const response = await fundedGeminiJson<{
    candidates?: Array<Record<string, unknown>>;
  }>(
    EXTERNAL_SYSTEM,
    { evidence },
    'funded-company external candidate extraction',
  );
  return (response.data.candidates || []).flatMap((row): NetworkCandidate[] => {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const urls = Array.isArray(row.evidenceUrls)
      ? row.evidenceUrls.filter((url): url is string => typeof url === 'string')
      : [];
    const related = evidence.filter((item) => urls.includes(item.url));
    if (!name || !related.length) return [];
    return [
      {
        founderId: null,
        name,
        company: typeof row.company === 'string' ? row.company : null,
        role: typeof row.role === 'string' ? row.role : null,
        profileText:
          typeof row.profileText === 'string'
            ? row.profileText.slice(0, 4000)
            : '',
        linkedinUrl:
          typeof row.linkedinUrl === 'string' ? row.linkedinUrl : null,
        companyUrl: typeof row.companyUrl === 'string' ? row.companyUrl : null,
        scouterScore: null,
        sourceMix: ['exa'],
        evidence: related,
        identityStatus:
          row.linkedinUrl || row.companyUrl ? 'probable' : 'ambiguous',
      },
    ];
  });
}

function referenceContract(
  reference: ReferenceRecord,
  evidencePack: ReferenceEvidencePack,
  historicalEvidence: DeepEvidence[],
  instantProfile: Record<string, unknown> | null,
  instantTags: Record<string, unknown>[],
) {
  return {
    input: {
      fundedCompanyId: reference.id,
      referenceCompanyName: reference.name,
      referenceCompanyUrl: reference.companyUrl,
      investorId: reference.thesisId,
      investorName: reference.investorName,
      investmentStage: reference.stage,
      investmentDate: reference.investmentTiming,
      investmentAmount: reference.investmentAmount,
      existingPortfolioEvidence: reference.existingPortfolioEvidence,
      emergingFounderWindowMonths: 6,
    },
    structured_evidence_pack: evidencePack,
    historical_and_category_sources: historicalEvidence,
    persisted_instant_profile_read_only: instantProfile,
    persisted_instant_tags_read_only: instantTags,
    contract: {
      executive_summary: '',
      reference_company: {},
      original_wedge: { problem: '', wedge: '', buyer: '', why_it_worked: '' },
      founder_dna: {},
      investor_pattern: {},
      customer_pattern: {},
      strategic_outcome: {},
      category_evolution: {
        original_problem: '',
        reference_wedge: '',
        category_evolution: '',
        current_opportunity_layer: '',
      },
      value_chain: { branches: [] },
      maturity_map: { stages: [] },
      historical_validators: [],
      missing_layers: [],
      founder_archetypes: [],
      strategic_complementarity: {},
      repeating_historical_pattern: '',
      market_layer_becoming_interesting_now: '',
      strongest_pre_announcement_founder_signal: '',
      why_contact_now: '',
      final_scouter_insight: {
        summary: '',
        repeating_pattern: '',
        missing_layer: '',
        why_now: '',
      },
      network_reference: {
        company: {
          name: reference.name,
          description: reference.description || '',
          website: reference.companyUrl,
          funding_stage: reference.stage,
          funding_amount: reference.investmentAmount,
          funding_date: reference.investmentTiming,
          investors: [reference.investorName],
        },
        company_pattern: {
          sector: reference.sector || 'unknown',
          sub_sector: [],
          product_type: 'unknown',
          business_model: 'unknown',
          customer_type: 'unknown',
          technical_theme: 'unknown',
          market_type: 'unknown',
          commercialization_model: 'unknown',
          company_stage: reference.stage || 'unknown',
          geography: reference.geography || 'unknown',
          capital_intensity: 'unknown',
          gtm_motion: 'unknown',
          product_maturity: 'unknown',
          traction_type: 'unknown',
        },
        founder_pattern: {
          archetypes: [],
          technical_balance: 'unknown',
          research_background: 'unknown',
          prior_founder_history: 'unknown',
          previous_exit: 'unknown',
          career_background: 'unknown',
          domain_expertise: 'unknown',
          technical_ownership: 'unknown',
          founder_market_fit: reference.founderPattern || 'unknown',
          formation_pattern: 'unknown',
        },
        timing: {
          company_age: 'unknown',
          trigger_events: [],
          transition: 'unknown',
          commercial_intent: 'unknown',
        },
        validated_pattern: [],
        validated_capital_signal: '',
        search_thesis: {
          summary: '',
          must_have: [],
          should_have: [],
          disqualifiers: [],
          candidate_archetypes: [],
          semantic_queries: [],
        },
        unknowns: [],
      },
    },
  };
}

function deterministicExclusions(candidate: NetworkCandidate) {
  const value = `${candidate.role || ''} ${candidate.profileText}`;
  const reasons: string[] = [];
  if (candidate.identityStatus === 'ambiguous')
    reasons.push('Unresolved identity');
  if (/\bseries\s+[a-z]\+?|late[- ]stage|acquired\b/i.test(value))
    reasons.push('Mature, late-stage, or acquired company signal');
  if (
    /consultant|consultancy|agency/i.test(value) &&
    !/founder|building|stealth/i.test(value)
  )
    reasons.push('Consultancy without separate venture evidence');
  if (!/founder|co-founder|building|stealth|formation|pre-company/i.test(value))
    reasons.push('No verified founder-building signal');
  return reasons;
}

function sourceLabel(candidate: NetworkCandidate) {
  return candidate.sourceMix.length > 1
    ? 'combined'
    : candidate.sourceMix[0] || 'scouter_db';
}

function sanitizeReferenceIntelligence(
  value: ReferenceIntelligence,
  evidence: DeepEvidence[],
  referenceName: string,
) {
  type JsonRecord = Record<string, unknown>;
  const record = (item: unknown): JsonRecord =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? (item as JsonRecord)
      : {};
  const text = (item: unknown, fallback = 'Unknown') =>
    typeof item === 'string' && item.trim() ? item.trim() : fallback;
  const strings = (items: unknown) =>
    Array.isArray(items)
      ? items.filter((item): item is string => typeof item === 'string')
      : [];
  const allowed = new Set(evidence.map((item) => item.url));
  const urls = (items: unknown) =>
    Array.isArray(items)
      ? items.filter(
          (item): item is string =>
            typeof item === 'string' && allowed.has(item),
        )
      : [];
  const historical = Array.isArray(value.historical_validators)
    ? value.historical_validators
        .map((item) => {
          const row = record(item);
          const similarity = text(row.similarity, 'Medium');
          return {
            name: text(row.name),
            event: text(row.event, text(row.validation)),
            pattern: text(row.pattern, text(row.validation)),
            similarity: ['Strong', 'Medium', 'Weak'].includes(similarity)
              ? (similarity as 'Strong' | 'Medium' | 'Weak')
              : ('Medium' as const),
            what_it_proves: text(row.what_it_proves, text(row.validation)),
            source_urls: urls(
              row.source_urls ||
                (typeof row.source_url === 'string' ? [row.source_url] : []),
            ),
          };
        })
        .filter((item) => item.name && item.source_urls.length)
        .slice(0, 5)
    : [];
  const fallbackPatterns: Record<string, string> = {
    historical_validator: 'Comparable company evolution',
    strategic_outcome: 'Strategic partnership or outcome',
    category_consolidation: 'Category consolidation',
    scale_stage_validator: 'Scale-stage market validation',
  };
  if (historical.length < 2) {
    const seen = new Set(historical.map((item) => item.source_urls[0]));
    for (const item of evidence) {
      if (!fallbackPatterns[item.source_type] || seen.has(item.url)) continue;
      const title = item.title?.trim();
      if (
        !title ||
        /\bsonos\b|\bsono motors\b|\bsono international\b/i.test(title) ||
        new RegExp(
          `^${referenceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        ).test(title)
      )
        continue;
      historical.push({
        name: title,
        event: title,
        pattern: fallbackPatterns[item.source_type],
        similarity:
          item.source_type === 'category_consolidation' ? 'Strong' : 'Medium',
        what_it_proves: item.excerpt.slice(0, 500),
        source_urls: [item.url],
      });
      seen.add(item.url);
      if (historical.length === 5) break;
    }
  }
  const normalizedHistorical = recoverHistoricalValidators(
    value.historical_validators,
    evidence,
    referenceName,
  );
  const branches = Array.isArray(value.value_chain?.branches)
    ? value.value_chain.branches.map((item) => {
        const row = record(item);
        return {
          branch: text(row.branch, text(row.layer)),
          market_layer: text(row.market_layer, text(row.status)),
          historical_benchmark: text(row.historical_benchmark),
          scale_stage_validator: text(row.scale_stage_validator),
          emerging_company: text(row.emerging_company),
          pre_announcement_founder: text(row.pre_announcement_founder),
          source_urls: urls(row.source_urls),
        };
      })
    : [];
  const stages = Array.isArray(value.maturity_map?.stages)
    ? value.maturity_map.stages.map((item) => {
        const row = record(item);
        return {
          stage: text(row.stage, text(item)),
          companies: strings(row.companies),
          source_urls: urls(row.source_urls),
        };
      })
    : [];
  const missing = normalizeMissingLayers(value.missing_layers, allowed);
  const archetypes = Array.isArray(value.founder_archetypes)
    ? value.founder_archetypes.map((item) => {
        const row = record(item);
        return {
          name: text(row.name, text(item)),
          components: strings(row.components),
          resulting_founder_type: text(row.resulting_founder_type, text(item)),
          evidence: text(row.evidence),
        };
      })
    : [];
  const evolution = record(value.category_evolution);
  return {
    ...value,
    historical_validators: normalizedHistorical,
    value_chain: { branches },
    maturity_map: { stages },
    missing_layers: missing,
    founder_archetypes: archetypes,
    category_evolution: {
      original_problem: text(
        evolution.original_problem,
        text(evolution.early_market),
      ),
      reference_wedge: text(
        evolution.reference_wedge,
        text(evolution.reference_company_wedge),
      ),
      category_evolution: text(evolution.category_evolution),
      current_opportunity_layer: text(
        evolution.current_opportunity_layer,
        text(evolution.next_opportunity_layer),
      ),
      early_market: text(evolution.early_market),
      next_category_form: text(evolution.next_category_form),
      current_scale_stage_validators: strings(
        evolution.current_scale_stage_validators,
      ),
      next_opportunity_layer: text(
        evolution.next_opportunity_layer,
        text(evolution.current_opportunity_layer),
      ),
    },
  };
}

function localStructuredReport(
  intelligence: ReferenceIntelligence,
  ranked: Array<{
    candidate: NetworkCandidate;
    assessment: CandidateAssessment;
    score: number;
  }>,
  excluded: Array<Record<string, unknown>>,
) {
  const section = (title: string, value: unknown) =>
    `## ${title}\n\n${typeof value === 'string' ? value : `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``}`;
  return [
    section('Executive Summary', intelligence.executive_summary),
    section('Verified Reference Company', intelligence.reference_company),
    section('Original Wedge', intelligence.original_wedge),
    section('Founder DNA', intelligence.founder_dna),
    section('Investor Pattern', intelligence.investor_pattern),
    section('Customer Pattern', intelligence.customer_pattern),
    section('Strategic Outcome / Exit', intelligence.strategic_outcome),
    section('Value-Chain Tree', intelligence.value_chain),
    section('Maturity Tree', intelligence.maturity_map),
    section(
      'Historical Pattern Validation',
      intelligence.historical_validators,
    ),
    section('Category Evolution', intelligence.category_evolution),
    section('Missing-Layer Map', intelligence.missing_layers),
    section(
      'Emerging Candidate Ranking',
      ranked.map(({ candidate, assessment, score }, index) => ({
        rank: index + 1,
        founder: candidate.name,
        company: candidate.company,
        pattern_match_score: score,
        why_now: assessment.why_now,
      })),
    ),
    section(
      'Candidate Detail Cards',
      ranked.map(({ candidate, assessment, score }) => ({
        founder: candidate.name,
        company: candidate.company,
        pattern_match_score: score,
        assessment,
      })),
    ),
    section('Excluded Candidates', excluded),
    section('Founder Archetypes', intelligence.founder_archetypes),
    section(
      'Strategic Complementarity',
      intelligence.strategic_complementarity,
    ),
    section(
      'Repeating Historical Pattern',
      intelligence.repeating_historical_pattern,
    ),
    section(
      'Market Layer Becoming Interesting Now',
      intelligence.market_layer_becoming_interesting_now,
    ),
    section(
      'Strongest Pre-Announcement Founder Signal',
      intelligence.strongest_pre_announcement_founder_signal,
    ),
    section('Why Contact Now', intelligence.why_contact_now),
    section('Final Scouter Insight', intelligence.final_scouter_insight),
  ].join('\n\n');
}

export async function processFundedCompanyAnalysis(args: {
  supabase: SupabaseClient;
  analysisId: string;
  organizationId: string;
  reference: ReferenceRecord;
}) {
  const { supabase, analysisId, organizationId, reference } = args;
  const providerStatus: Record<string, unknown> = {
    scouter_db: 'pending',
    exa: 'pending',
    scout: 'pending',
    gemini: 'pending',
    gemini_web_grounding: false,
    firecrawl: 'not_used',
  };
  try {
    await supabase
      .from('funded_company_analyses')
      .update({
        status: 'running',
        provider_status: providerStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    const instantContext = await loadPersistedInstantContext(
      supabase,
      organizationId,
      reference.id,
    );
    providerStatus.instant_profile_reuse = instantContext.status;
    let deepEvidence: DeepEvidence[] = [];
    try {
      deepEvidence = await collectReferenceEvidence(reference);
      providerStatus.exa = `reference_sources:${deepEvidence.length}`;
    } catch (error) {
      providerStatus.exa = `partial: ${error instanceof Error ? error.message : 'failed'}`;
    }
    if (!deepEvidence.length)
      throw new Error('No reference-company source evidence was collected.');
    const rawEvidencePersist = await supabase
      .from('funded_company_analyses')
      .update({
        evidence: {
          status: 'reference_sources_collected',
          sources: deepEvidence,
        },
        provider_status: providerStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    if (rawEvidencePersist.error)
      throw new Error(rawEvidencePersist.error.message);
    const evidenceResult = await buildEvidencePack({
      reference,
      evidence: deepEvidence,
      instantProfile: instantContext.profile,
      instantTags: instantContext.tags,
    });
    const discoveredWebsite =
      evidenceResult.pack.company_identity.website.value === 'Unknown'
        ? null
        : evidenceResult.pack.company_identity.website.value;
    deepEvidence = reclassifyDeepEvidence(
      deepEvidence,
      discoveredWebsite,
      reference.sourceUrl,
    );
    evidenceResult.pack.sources = deepEvidence;
    providerStatus.gemini = `evidence:${evidenceResult.model}`;
    providerStatus.reference_source_quality = sourceQualityCounts(deepEvidence);
    let marketEvidence: DeepEvidence[] = [];
    try {
      marketEvidence = await collectMarketEvidence(
        reference,
        evidenceResult.pack,
        instantContext.profile,
      );
      deepEvidence = Array.from(
        new Map(
          [...deepEvidence, ...marketEvidence].map((item) => [
            item.url.toLowerCase().replace(/\/$/, ''),
            item,
          ]),
        ).values(),
      );
      providerStatus.exa = `reference:${evidenceResult.pack.sources.length};market:${marketEvidence.length}`;
      providerStatus.reference_source_quality =
        sourceQualityCounts(deepEvidence);
    } catch (error) {
      providerStatus.exa = `partial:${error instanceof Error ? error.message : 'market research failed'}`;
    }
    const evidencePack = {
      ...evidenceResult.pack,
      sources: deepEvidence,
    };
    const evidencePersist = await supabase
      .from('funded_company_analyses')
      .update({
        evidence: evidencePack,
        provider_status: providerStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    if (evidencePersist.error) throw new Error(evidencePersist.error.message);
    const referenceResult = await fundedGeminiJson<ReferenceIntelligence>(
      REFERENCE_SYSTEM,
      referenceContract(
        reference,
        evidencePack,
        marketEvidence,
        instantContext.profile,
        instantContext.tags,
      ),
      'funded-company reference analysis',
    );
    providerStatus.gemini = `available:${referenceResult.model}`;
    const intelligence = sanitizeReferenceIntelligence(
      referenceResult.data,
      deepEvidence,
      reference.name,
    );
    if (
      !intelligence?.network_reference?.search_thesis ||
      !intelligence.original_wedge ||
      !intelligence.category_evolution
    )
      throw new Error(
        'Gemini returned an incomplete reference-company analysis.',
      );

    let internal: NetworkCandidate[] = [];
    try {
      internal = await discoverInScouter(
        supabase,
        intelligence.network_reference,
        60,
      );
      providerStatus.scouter_db = `available:${internal.length}`;
    } catch (error) {
      providerStatus.scouter_db = `failed:${error instanceof Error ? error.message : 'unknown'}`;
    }

    const [scoutResult, exaResult] = await Promise.allSettled([
      discoverWithScout(intelligence.network_reference, 25),
      discoverFundedCandidatesWithExa(intelligence.network_reference),
    ]);
    const scout =
      scoutResult.status === 'fulfilled'
        ? scoutResult.value
        : { candidates: [], method: 'failed' as const };
    providerStatus.scout =
      scoutResult.status === 'fulfilled'
        ? `${scout.method}:${scout.candidates.length}`
        : `failed:${scoutResult.reason}`;
    const exaDiscovery =
      exaResult.status === 'fulfilled'
        ? exaResult.value
        : { evidence: [], queries: [] };
    if (exaResult.status === 'rejected')
      providerStatus.exa = `partial:${exaResult.reason}`;
    const external = await extractExternal(exaDiscovery.evidence).catch(
      (error) => {
        providerStatus.exa = `partial:${error instanceof Error ? error.message : 'candidate extraction failed'}`;
        return [] as NetworkCandidate[];
      },
    );
    const candidates = dedupe([
      ...internal,
      ...scout.candidates,
      ...external,
    ]).slice(0, 30);

    const candidateInputs = candidates.map((candidate, index) => ({
      candidate_id: candidate.founderId || `external-${index + 1}`,
      name: candidate.name,
      company: candidate.company,
      role: candidate.role,
      profile_text: candidate.profileText,
      scouter_score_context_only: candidate.scouterScore,
      source_mix: candidate.sourceMix,
      identity_status: candidate.identityStatus,
      evidence: candidate.evidence.slice(0, 8),
    }));
    const assessments: CandidateAssessment[] = [];
    const assessmentFailures: Array<Record<string, unknown>> = [];
    const rejectedAssessments: Array<Record<string, unknown>> = [];
    let successfulBatches = 0;
    for (
      let offset = 0;
      offset < candidateInputs.length;
      offset += FUNDED_CANDIDATE_BATCH_SIZE
    ) {
      const batch = candidateInputs.slice(
        offset,
        offset + FUNDED_CANDIDATE_BATCH_SIZE,
      );
      const batchNumber = Math.floor(offset / FUNDED_CANDIDATE_BATCH_SIZE) + 1;
      let completed = false;
      for (let attempt = 1; attempt <= 2 && !completed; attempt += 1) {
        try {
          const result = await fundedCandidateAssessmentJson(CANDIDATE_SYSTEM, {
            reference_intelligence: intelligence,
            candidates: batch,
          });
          const allowedIds = new Set(
            batch.map((candidate) => candidate.candidate_id),
          );
          for (const assessment of result.valid) {
            if (allowedIds.has(assessment.candidate_id))
              assessments.push(assessment);
            else
              rejectedAssessments.push({
                batch: batchNumber,
                candidate_id: assessment.candidate_id,
                reason: 'candidate_id was not present in this batch',
              });
          }
          rejectedAssessments.push(
            ...result.rejected.map((item) => ({
              batch: batchNumber,
              ...item,
            })),
          );
          successfulBatches += 1;
          completed = true;
        } catch (error) {
          if (attempt === 2)
            assessmentFailures.push({
              batch: batchNumber,
              candidate_ids: batch.map((candidate) => candidate.candidate_id),
              error:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : 'Unknown candidate assessment error',
              diagnostic: safeGeminiDiagnostic(error),
            });
        }
      }
    }
    providerStatus.candidate_assessment = {
      batch_size: FUNDED_CANDIDATE_BATCH_SIZE,
      total_batches: Math.ceil(
        candidateInputs.length / FUNDED_CANDIDATE_BATCH_SIZE,
      ),
      successful_batches: successfulBatches,
      failed_batches: assessmentFailures,
      rejected_assessments: rejectedAssessments,
    };
    const assessmentsById = new Map(
      assessments.map((assessment) => [assessment.candidate_id, assessment]),
    );
    const excluded: Array<Record<string, unknown>> = [];
    const ranked = candidates
      .flatMap((candidate, index) => {
        const candidateId = candidate.founderId || `external-${index + 1}`;
        const assessment = assessmentsById.get(candidateId);
        if (!assessment?.component_scores) {
          excluded.push({
            candidate_id: candidateId,
            name: candidate.name,
            company: candidate.company,
            reasons: ['No valid candidate assessment was returned'],
          });
          return [];
        }
        const deterministic = deterministicExclusions(candidate);
        const exclusions = [
          ...deterministic,
          ...(assessment.exclusion_reasons || []),
        ];
        const score = referencePatternScore(assessment.component_scores);
        if (
          !passesReferenceGates(
            assessment.founder_state,
            assessment.verification_confidence,
            score,
            exclusions,
          )
        ) {
          excluded.push({
            name: candidate.name,
            company: candidate.company,
            reasons: exclusions.length
              ? exclusions
              : ['Did not pass minimum score or confidence gates'],
            score,
          });
          return [];
        }
        return [{ candidate, assessment, score }];
      })
      .sort((a, b) => b.score - a.score);

    let insertedCandidates: Array<{ id: string; rank: number }> = [];
    if (ranked.length) {
      const inserted = await supabase
        .from('funded_company_candidates')
        .insert(
          ranked.map(({ candidate, assessment, score }, index) => ({
            analysis_id: analysisId,
            organization_id: organizationId,
            founder_id: candidate.founderId,
            external_identity: candidate.founderId
              ? null
              : {
                  name: candidate.name,
                  linkedin_url: candidate.linkedinUrl || null,
                  company_url: candidate.companyUrl || null,
                },
            founder_name: candidate.name,
            company_name: candidate.company,
            current_role: candidate.role,
            source: sourceLabel(candidate),
            founder_state: assessment.founder_state,
            pattern_branch: assessment.pattern_branch,
            historical_comparable: assessment.historical_comparable,
            pattern_match_score: score,
            component_scores: assessment.component_scores,
            verification_confidence: number(assessment.verification_confidence),
            scouter_score: candidate.scouterScore,
            why_now: assessment.why_now,
            visibility: assessment.visibility,
            evidence: candidate.evidence,
            red_flags: assessment.red_flags || [],
            rank: index + 1,
          })),
        )
        .select('id,rank');
      if (inserted.error) throw new Error(inserted.error.message);
      insertedCandidates = inserted.data || [];
    }

    const signalRows = ranked.flatMap(({ candidate, assessment }, index) => {
      const allowedUrls = new Set(candidate.evidence.map((item) => item.url));
      const candidateId = insertedCandidates.find(
        (item) => item.rank === index + 1,
      )?.id;
      return (assessment.signals || [])
        .filter(
          (signal) => signal.source_url && allowedUrls.has(signal.source_url),
        )
        .map((signal) => ({
          analysis_id: analysisId,
          organization_id: organizationId,
          candidate_id: candidateId || null,
          signal_type: signal.signal_type,
          signal_date: signal.date || null,
          explanation: signal.explanation,
          why_it_matters: signal.why_it_matters,
          source_url: signal.source_url,
        }));
    });
    if (signalRows.length) {
      const insertedSignals = await supabase
        .from('funded_company_signals')
        .insert(signalRows);
      if (insertedSignals.error) throw new Error(insertedSignals.error.message);
    }

    let reportMarkdown = localStructuredReport(intelligence, ranked, excluded);
    try {
      const report = await fundedGeminiJson<{ report_markdown: string }>(
        REPORT_SYSTEM,
        {
          reference_intelligence: intelligence,
          ranked_candidates: ranked.map(
            ({ candidate, assessment, score }, index) => ({
              rank: index + 1,
              name: candidate.name,
              company: candidate.company,
              scouter_score: candidate.scouterScore,
              pattern_match_score: score,
              assessment,
            }),
          ),
          excluded_candidates: excluded,
          evidence_urls: Array.from(
            new Set(
              [
                ...deepEvidence,
                ...ranked.flatMap((item) => item.candidate.evidence),
              ].map((item) => item.url),
            ),
          ),
        },
        'funded-company detail report',
      );
      reportMarkdown = report.data.report_markdown || reportMarkdown;
      providerStatus.gemini = `available:${report.model}`;
    } catch (error) {
      providerStatus.report_generation = `partial:local-structured-fallback:${error instanceof Error ? error.message.slice(0, 300) : 'unknown error'}`;
    }
    const completedStatus =
      assessmentFailures.length ||
      rejectedAssessments.length ||
      Object.values(providerStatus).some(
        (value) =>
          String(value).startsWith('failed') ||
          String(value).startsWith('partial'),
      )
        ? 'partial'
        : 'completed';
    const update = await supabase
      .from('funded_company_analyses')
      .update({
        status: completedStatus,
        reference_company_json: {
          ...(intelligence.reference_company || {}),
          executive_summary: intelligence.executive_summary || '',
          evidence_pack: evidencePack,
        },
        original_wedge_json: intelligence.original_wedge || {},
        founder_dna_json: {
          ...(intelligence.founder_dna || {}),
          archetypes: intelligence.founder_archetypes || [],
        },
        investor_pattern_json: {
          ...(intelligence.investor_pattern || {}),
          strategic_complementarity:
            intelligence.strategic_complementarity || {},
        },
        customer_pattern_json: intelligence.customer_pattern || {},
        category_evolution_json: intelligence.category_evolution || {},
        value_chain_json: intelligence.value_chain || {},
        maturity_map_json: intelligence.maturity_map || {},
        historical_validators_json: intelligence.historical_validators || [],
        missing_layers_json: intelligence.missing_layers || [],
        final_insight_json: {
          ...(intelligence.final_scouter_insight || {}),
          repeating_historical_pattern:
            intelligence.repeating_historical_pattern || '',
          market_layer_becoming_interesting_now:
            intelligence.market_layer_becoming_interesting_now || '',
          strongest_pre_announcement_founder_signal:
            intelligence.strongest_pre_announcement_founder_signal || '',
          why_contact_now: intelligence.why_contact_now || '',
        },
        excluded_candidates_json: excluded,
        evidence: evidencePack,
        provider_status: providerStatus,
        report_markdown: reportMarkdown,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    if (update.error) throw new Error(update.error.message);
    return completedStatus;
  } catch (error) {
    await supabase
      .from('funded_company_analyses')
      .update({
        status: 'failed',
        error:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : 'Unknown analysis error',
        provider_status: providerStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
    return 'failed' as const;
  }
}

export type { ReferenceRecord };
