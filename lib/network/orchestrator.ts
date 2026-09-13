import 'server-only';

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { discoverWithExa, referenceEvidence } from './exa';
import { networkGeminiJson } from './gemini';
import { networkMatch, passesNetworkGates } from './scoring';
import { discoverWithScout } from './scout-adapter';
import { discoverInScouter } from './scouter-source';
import { getTechEuCompany, TECH_EU_ATTRIBUTION, TechEuError } from './tech-eu';
import type {
  NetworkAssessment,
  NetworkCandidate,
  NetworkEvidence,
  NetworkInput,
  NetworkReferenceProfile,
  RankedNetworkCandidate,
} from './types';

const REFERENCE_PROMPT = `You are Scouter's Funding Reference Analyst. Use only the supplied evidence. Do not browse or use recalled facts. Unknown stays unknown. Analyze the structural company + founder formation pattern that capital validated, then express what an earlier-stage version looks like. Return JSON only using exactly the requested contract. Keep validated_pattern to 5-8 concise tags and generate several narrow semantic_queries.`;

const ASSESSMENT_PROMPT = `You are Scouter's Founder Network Match analyst. Use only supplied reference and candidate evidence. Do not invent identity, company, funding, role, timing, traction, ownership or background. This is a reference-specific Network Match assessment, never a replacement for Scouter Score. Return JSON only. Score structural_pattern_fit, founder_quality, founder_transition, timing and evidence_confidence from 0-100. Set founder_state to Founder Now, Founder Formation, Future Founder, or Noise. Set visibility to very_low, low, emerging, or visible. Each assessment must include concise why_now, pattern_match_summary, 2-5 match_reasons, a useful key_difference, up to 3 risks, and 1-5 supporting_evidence facts. If identity or formation is unsupported, use Noise and low evidence confidence.`;

const EXTERNAL_PROMPT = `Extract founder/company candidate leads only from the supplied Exa evidence. Do not infer missing names or founder status. One result per real person. Return JSON {"candidates":[{"name":"","company":null,"role":null,"profileText":"","linkedinUrl":null,"companyUrl":null,"evidenceUrls":[]}]} and omit pages that do not identify a specific builder/founder.`;

const empty = 'unknown';

function normalizeUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function networkFingerprint(
  organizationId: string,
  input: NetworkInput,
) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        organizationId,
        input.companyName.trim().toLowerCase(),
        normalizeUrl(input.companyUrl),
        normalizeUrl(input.fundingUrl),
        input.techEu?.companyId || null,
        input.techEu?.roundId || null,
      ]),
    )
    .digest('hex');
}

async function canonicalReferenceEvidence(input: NetworkInput) {
  if (!input.techEu) {
    return {
      evidence: await referenceEvidence(
        input.companyName,
        input.companyUrl,
        input.fundingUrl,
      ),
      provider: 'Exa + supplied URLs',
      companyLookupSucceeded: null,
      retries: 0,
      companyLookupError: null,
    };
  }
  let company: Awaited<ReturnType<typeof getTechEuCompany>> | null = null;
  let companyLookupError: string | null = null;
  let companyLookupRetries = 0;
  try {
    company = await getTechEuCompany(input.techEu.companyId);
  } catch (error) {
    companyLookupError =
      error instanceof Error
        ? error.message.slice(0, 240)
        : 'Unknown Tech.eu company profile error';
    companyLookupRetries = error instanceof TechEuError ? error.retries : 0;
    if (!input.techEu.round)
      throw new Error(
        'Tech.eu company profile is unavailable and the selected funding event is incomplete.',
      );
  }
  const companyRound = company?.rounds.find(
    (item) => item.id.toLowerCase() === input.techEu!.roundId.toLowerCase(),
  );
  const round = companyRound || input.techEu.round;
  if (!round)
    throw new Error('The selected Tech.eu funding round is unavailable.');
  const companyName =
    company?.name || input.techEu.round?.company.name || input.companyName;
  const companyUrl =
    company?.url ||
    `https://funding.tech.eu/companies/${input.techEu.companyId}`;
  const founderFacts = company?.founders.length
    ? ` Available founder facts: ${JSON.stringify(company.founders).slice(0, 1800)}.`
    : '';
  const evidence: NetworkEvidence[] = [
    {
      source: 'tech_eu',
      url: round.url,
      title: `${companyName} funding round — ${TECH_EU_ATTRIBUTION}`,
      excerpt: `Tech.eu round ${input.techEu.roundId}. ${companyName} announced a ${round.stage || 'stage unknown'} funding round on ${round.date || 'date unknown'} for ${round.amountEur == null ? 'an undisclosed amount' : `EUR ${round.amountEur}`}. Investors: ${round.investors.length ? round.investors.join(', ') : 'not listed'}.`,
      publishedAt: round.date,
    },
    {
      source: 'tech_eu',
      url: companyUrl,
      title: `${companyName} company profile — ${TECH_EU_ATTRIBUTION}`,
      excerpt: `Tech.eu company ${input.techEu.companyId}. ${company?.description || 'Company profile details unavailable; using the canonical funding event.'} Website: ${company?.website || 'unknown'}. Location: ${[company?.city, company?.country || input.techEu.round?.company.country].filter(Boolean).join(', ') || 'unknown'}. Sectors: ${(company?.sectors || input.techEu.round?.company.sectors || []).join(', ') || 'unknown'}. Founded: ${company?.founded || 'unknown'}.${founderFacts}`,
    },
  ];
  return {
    evidence,
    provider: TECH_EU_ATTRIBUTION,
    companyLookupSucceeded: Boolean(company),
    retries: company?.requestMeta?.retries || companyLookupRetries,
    companyLookupError,
  };
}

function referenceContract(input: NetworkInput, evidence: NetworkEvidence[]) {
  return {
    input,
    evidence,
    contract: {
      company: {
        name: '',
        description: '',
        website: null,
        funding_stage: null,
        funding_amount: null,
        funding_date: null,
        investors: [],
      },
      company_pattern: {
        sector: empty,
        sub_sector: [],
        product_type: empty,
        business_model: empty,
        customer_type: empty,
        technical_theme: empty,
        market_type: empty,
        commercialization_model: empty,
        company_stage: empty,
        geography: empty,
        capital_intensity: empty,
        gtm_motion: empty,
        product_maturity: empty,
        traction_type: empty,
      },
      founder_pattern: {
        archetypes: [],
        technical_balance: empty,
        research_background: empty,
        prior_founder_history: empty,
        previous_exit: empty,
        career_background: empty,
        domain_expertise: empty,
        technical_ownership: empty,
        founder_market_fit: empty,
        formation_pattern: empty,
      },
      timing: {
        company_age: empty,
        trigger_events: [],
        transition: empty,
        commercial_intent: empty,
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
  };
}

function validateReference(
  value: NetworkReferenceProfile,
  input: NetworkInput,
) {
  if (
    !value?.company_pattern ||
    !value?.founder_pattern ||
    !value?.search_thesis?.summary
  )
    throw new Error('Gemini returned an incomplete Reference Profile.');
  value.company.name = value.company.name?.trim() || input.companyName;
  value.company.website =
    normalizeUrl(value.company.website) || normalizeUrl(input.companyUrl);
  value.validated_pattern = Array.isArray(value.validated_pattern)
    ? value.validated_pattern.filter(Boolean).slice(0, 8)
    : [];
  for (const key of [
    'must_have',
    'should_have',
    'disqualifiers',
    'candidate_archetypes',
    'semantic_queries',
  ] as const) {
    value.search_thesis[key] = Array.isArray(value.search_thesis[key])
      ? value.search_thesis[key].filter(Boolean).slice(0, 10)
      : [];
  }
  return value;
}

function candidateKey(candidate: NetworkCandidate) {
  return (
    candidate.linkedinUrl ||
    candidate.companyUrl ||
    `${candidate.name}|${candidate.company || ''}`
  )
    .replace(/\/$/, '')
    .toLowerCase();
}

function dedupeCandidates(candidates: NetworkCandidate[]) {
  const merged = new Map<string, NetworkCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      continue;
    }
    merged.set(key, {
      ...existing,
      ...candidate,
      founderId: existing.founderId || candidate.founderId,
      scouterScore: existing.scouterScore ?? candidate.scouterScore,
      profileText: `${existing.profileText} · ${candidate.profileText}`.slice(
        0,
        4000,
      ),
      sourceMix: Array.from(
        new Set([...existing.sourceMix, ...candidate.sourceMix]),
      ),
      evidence: Array.from(
        new Map(
          [...existing.evidence, ...candidate.evidence].map((item) => [
            item.url,
            item,
          ]),
        ).values(),
      ),
      identityStatus:
        existing.identityStatus === 'confirmed' ||
        candidate.identityStatus === 'confirmed'
          ? 'confirmed'
          : 'probable',
    });
  }
  return Array.from(merged.values());
}

function preScore(
  candidate: NetworkCandidate,
  reference: NetworkReferenceProfile,
) {
  const haystack =
    `${candidate.name} ${candidate.company || ''} ${candidate.role || ''} ${candidate.profileText}`.toLowerCase();
  const terms = [
    ...reference.search_thesis.must_have,
    ...reference.search_thesis.should_have,
    reference.company_pattern.sector,
    ...reference.company_pattern.sub_sector,
  ]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter((value) => value.length > 3);
  const overlap = new Set(terms.filter((term) => haystack.includes(term))).size;
  return (
    overlap * 8 +
    Math.min(20, (candidate.scouterScore || 0) / 5) +
    Math.min(15, candidate.evidence.length * 3)
  );
}

async function externalCandidates(evidence: NetworkEvidence[]) {
  if (!evidence.length)
    return {
      candidates: [] as NetworkCandidate[],
      model: null as string | null,
    };
  const result = await networkGeminiJson<{
    candidates?: Array<Record<string, unknown>>;
  }>(EXTERNAL_PROMPT, { evidence });
  const candidates = (result.data.candidates || []).flatMap(
    (row): NetworkCandidate[] => {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) return [];
      const urls = Array.isArray(row.evidenceUrls)
        ? row.evidenceUrls.filter(
            (url): url is string => typeof url === 'string',
          )
        : [];
      const related = evidence.filter((item) => urls.includes(item.url));
      return [
        {
          founderId: null,
          name,
          company: typeof row.company === 'string' ? row.company : null,
          role: typeof row.role === 'string' ? row.role : null,
          profileText:
            typeof row.profileText === 'string'
              ? row.profileText.slice(0, 3000)
              : '',
          scouterScore: null,
          linkedinUrl: normalizeUrl(
            typeof row.linkedinUrl === 'string' ? row.linkedinUrl : null,
          ),
          companyUrl: normalizeUrl(
            typeof row.companyUrl === 'string' ? row.companyUrl : null,
          ),
          sourceMix: ['exa'],
          evidence: related,
          identityStatus:
            related.length && (row.linkedinUrl || row.companyUrl)
              ? 'probable'
              : 'ambiguous',
        },
      ];
    },
  );
  return { candidates, model: result.model };
}

function parseAssessments(value: { assessments?: NetworkAssessment[] }) {
  return Array.isArray(value.assessments) ? value.assessments : [];
}

function matchAssessment(
  candidate: NetworkCandidate,
  assessments: NetworkAssessment[],
) {
  const normalized = candidate.name.toLowerCase();
  return assessments.find(
    (assessment) =>
      assessment.candidate_name?.trim().toLowerCase() === normalized,
  );
}

async function updateRun(
  supabase: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>,
) {
  const result = await supabase
    .from('network_runs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', runId);
  if (result.error) throw new Error(result.error.message);
}

export async function processNetworkRun(args: {
  supabase: SupabaseClient;
  runId: string;
  organizationId: string;
  input: NetworkInput;
}) {
  const { supabase, runId, organizationId, input } = args;
  let metrics: Record<string, unknown> = {};
  try {
    await updateRun(supabase, runId, { status: 'building_reference' });
    const canonical = await canonicalReferenceEvidence(input);
    const refEvidence = canonical.evidence;
    const referenceResult = await networkGeminiJson<NetworkReferenceProfile>(
      REFERENCE_PROMPT,
      referenceContract(input, refEvidence),
    );
    const reference = validateReference(referenceResult.data, input);
    await updateRun(supabase, runId, {
      reference_company: reference.company,
      reference_evidence: refEvidence,
      reference_profile: reference,
      search_thesis: reference.search_thesis,
      status: 'sourcing',
    });

    const [internalResult, scoutResult, exaResult] = await Promise.allSettled([
      discoverInScouter(supabase, reference, 40),
      discoverWithScout(reference, 20),
      discoverWithExa(reference),
    ]);
    const internal =
      internalResult.status === 'fulfilled' ? internalResult.value : [];
    const scout =
      scoutResult.status === 'fulfilled'
        ? scoutResult.value
        : { candidates: [], method: 'failed' as const };
    const exa =
      exaResult.status === 'fulfilled'
        ? exaResult.value
        : { evidence: [], queries: [] };
    await updateRun(supabase, runId, { status: 'enriching' });
    const external = await externalCandidates(exa.evidence);
    const unique = dedupeCandidates([
      ...internal,
      ...scout.candidates,
      ...external.candidates,
    ]).sort(
      (left, right) => preScore(right, reference) - preScore(left, reference),
    );
    const evaluationPool = unique.slice(0, 20);
    await updateRun(supabase, runId, { status: 'scoring' });
    const assessmentResult = await networkGeminiJson<{
      assessments?: NetworkAssessment[];
    }>(ASSESSMENT_PROMPT, {
      reference_profile: reference,
      candidates: evaluationPool.map((candidate) => ({
        name: candidate.name,
        company: candidate.company,
        role: candidate.role,
        profile_text: candidate.profileText,
        scouter_score_context_only: candidate.scouterScore,
        source_mix: candidate.sourceMix,
        evidence: candidate.evidence.slice(0, 6),
        identity_status: candidate.identityStatus,
      })),
      output_contract: {
        assessments: [
          {
            candidate_name: '',
            founder_state: 'Founder Formation',
            founder_archetype: '',
            dimensions: {
              structural_pattern_fit: 0,
              founder_quality: 0,
              founder_transition: 0,
              timing: 0,
              evidence_confidence: 0,
            },
            visibility: 'low',
            why_now: '',
            pattern_match_summary: '',
            match_reasons: [],
            key_difference: '',
            risks: [],
            supporting_evidence: [],
          },
        ],
      },
    });
    const assessments = parseAssessments(assessmentResult.data);
    const ranked: RankedNetworkCandidate[] = evaluationPool
      .flatMap((candidate) => {
        const assessment = matchAssessment(candidate, assessments);
        if (!assessment || !passesNetworkGates(assessment, candidate))
          return [];
        return [
          {
            ...candidate,
            ...assessment,
            networkMatch: networkMatch(assessment),
            visibilityAdvantage: (
              { very_low: 100, low: 80, emerging: 60, visible: 20 } as const
            )[assessment.visibility],
            rank: 0,
          },
        ];
      })
      .sort((a, b) => b.networkMatch - a.networkMatch)
      .slice(0, 10)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

    if (ranked.length) {
      const insert = await supabase.from('network_candidates').insert(
        ranked.map((candidate) => ({
          network_run_id: runId,
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
          current_company: candidate.company,
          current_role: candidate.role,
          founder_state: candidate.founder_state,
          source_mix: candidate.sourceMix,
          scouter_score: candidate.scouterScore,
          network_match: candidate.networkMatch,
          score_breakdown: {
            ...candidate.dimensions,
            visibility_advantage: candidate.visibilityAdvantage,
          },
          why_now: candidate.why_now,
          match_reasons: candidate.match_reasons,
          pattern_match_summary: candidate.pattern_match_summary,
          key_difference: candidate.key_difference,
          visibility: candidate.visibility,
          risks: candidate.risks,
          evidence: candidate.evidence,
          rank: candidate.rank,
        })),
      );
      if (insert.error) throw new Error(insert.error.message);
    }
    metrics = {
      scouter_db_candidates: internal.length,
      scout_candidates: scout.candidates.length,
      scout_method: scout.method,
      exa_evidence_pages: exa.evidence.length,
      exa_queries: exa.queries,
      deduplicated_candidates: unique.length,
      candidates_sent_to_gemini: evaluationPool.length,
      candidates_passing_hard_gates: ranked.length,
      gemini_reference_model: referenceResult.model,
      gemini_candidate_model: assessmentResult.model,
      reference_source_pages: refEvidence.map((item) => item.url),
      reference_funding_provider: canonical.provider,
      tech_eu_company_profile_succeeded: canonical.companyLookupSucceeded,
      tech_eu_retries: canonical.retries,
      tech_eu_company_profile_error: canonical.companyLookupError,
      tech_eu_reference: input.techEu
        ? {
            company_id: input.techEu.companyId,
            round_id: input.techEu.roundId,
            amount_eur: input.techEu.round?.amountEur ?? null,
            stage: input.techEu.round?.stage ?? null,
            round_date: input.techEu.round?.date ?? null,
            investors: input.techEu.round?.investors || [],
            funding_source: input.techEu.round?.url || null,
            api_provenance: 'https://funding.tech.eu/api/v1',
          }
        : null,
    };
    await updateRun(supabase, runId, {
      status: 'ready',
      metrics,
      completed_at: new Date().toISOString(),
    });
    return 'completed' as const;
  } catch (error) {
    await updateRun(supabase, runId, {
      status: 'failed',
      metrics,
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : 'Unknown Network Mode failure',
      completed_at: new Date().toISOString(),
    }).catch(() => undefined);
    return 'failed' as const;
  }
}
