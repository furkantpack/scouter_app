import type { CandidateAssessment } from './types';

const STATE_VALUES = [
  'Founder Now',
  'Founder Formation',
  'Future Founder',
  'Noise',
] as const;
const VISIBILITY_VALUES = ['very_low', 'low', 'emerging', 'visible'] as const;
const STATES = new Set<string>(STATE_VALUES);
const VISIBILITIES = new Set<string>(VISIBILITY_VALUES);
const SCORE_KEYS = [
  'historical_pattern_fit',
  'founder_dna',
  'early_signal_strength',
  'commercial_validation',
  'strategic_complementarity',
  'alpha_discoverability',
] as const;

export const FUNDED_CANDIDATE_BATCH_SIZE = 4;

export const FUNDED_CANDIDATE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['assessments'],
  properties: {
    assessments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: [
          'candidate_id',
          'candidate_name',
          'founder_state',
          'pattern_branch',
          'historical_comparable',
          'component_scores',
          'verification_confidence',
          'why_now',
          'visibility',
          'key_evidence',
          'red_flags',
          'exclusion_reasons',
          'signals',
        ],
        properties: {
          candidate_id: { type: 'STRING' },
          candidate_name: { type: 'STRING' },
          founder_state: { type: 'STRING', enum: STATE_VALUES },
          pattern_branch: { type: 'STRING' },
          historical_comparable: { type: 'STRING' },
          component_scores: {
            type: 'OBJECT',
            required: [...SCORE_KEYS],
            properties: Object.fromEntries(
              SCORE_KEYS.map((key) => [key, { type: 'NUMBER' }]),
            ),
          },
          verification_confidence: { type: 'NUMBER' },
          why_now: { type: 'STRING' },
          visibility: { type: 'STRING', enum: VISIBILITY_VALUES },
          key_evidence: { type: 'ARRAY', items: { type: 'STRING' } },
          red_flags: { type: 'ARRAY', items: { type: 'STRING' } },
          exclusion_reasons: { type: 'ARRAY', items: { type: 'STRING' } },
          signals: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              required: [
                'signal_type',
                'date',
                'explanation',
                'why_it_matters',
                'source_url',
              ],
              properties: {
                signal_type: { type: 'STRING' },
                date: { type: 'STRING', nullable: true },
                explanation: { type: 'STRING' },
                why_it_matters: { type: 'STRING' },
                source_url: { type: 'STRING' },
              },
            },
          },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

type ValidationResult =
  { ok: true; value: CandidateAssessment } | { ok: false; reason: string };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function validSignal(signal: unknown) {
  return (
    record(signal) &&
    nonEmpty(signal.signal_type) &&
    (signal.date === null || typeof signal.date === 'string') &&
    nonEmpty(signal.explanation) &&
    nonEmpty(signal.why_it_matters) &&
    nonEmpty(signal.source_url)
  );
}

function validateAssessment(value: unknown): ValidationResult {
  if (!record(value))
    return { ok: false, reason: 'assessment is not an object' };
  if (!nonEmpty(value.candidate_id))
    return { ok: false, reason: 'candidate_id is empty' };
  if (!nonEmpty(value.candidate_name))
    return { ok: false, reason: 'candidate_name is empty' };
  if (!nonEmpty(value.founder_state) || !STATES.has(value.founder_state))
    return { ok: false, reason: 'founder_state is invalid' };
  if (!record(value.component_scores))
    return { ok: false, reason: 'component_scores is not an object' };
  const componentScores = value.component_scores;
  if (
    SCORE_KEYS.some(
      (key) =>
        typeof componentScores[key] !== 'number' ||
        !Number.isFinite(componentScores[key]),
    )
  )
    return { ok: false, reason: 'component score is not numeric' };
  if (
    typeof value.verification_confidence !== 'number' ||
    !Number.isFinite(value.verification_confidence)
  )
    return { ok: false, reason: 'verification_confidence is not numeric' };
  if (!nonEmpty(value.visibility) || !VISIBILITIES.has(value.visibility))
    return { ok: false, reason: 'visibility is invalid' };
  for (const key of ['key_evidence', 'red_flags', 'exclusion_reasons'])
    if (!stringArray(value[key]))
      return { ok: false, reason: `${key} is not a string array` };
  if (value.signals !== undefined && !Array.isArray(value.signals))
    return { ok: false, reason: 'signals is not an array' };
  const sanitized = {
    ...value,
    signals: Array.isArray(value.signals)
      ? value.signals.filter(validSignal)
      : [],
  };
  return { ok: true, value: sanitized as CandidateAssessment };
}

export function validateCandidateAssessmentResponse(value: unknown) {
  if (!record(value) || !Array.isArray(value.assessments))
    return {
      valid: [] as CandidateAssessment[],
      rejected: [{ index: -1, reason: 'assessments is not an array' }],
      rootValid: false,
    };
  const valid: CandidateAssessment[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  value.assessments.forEach((assessment, index) => {
    const result = validateAssessment(assessment);
    if (result.ok) valid.push(result.value);
    else rejected.push({ index, reason: result.reason });
  });
  return { valid, rejected, rootValid: true };
}
