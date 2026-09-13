import type { NetworkAssessment, NetworkCandidate } from './types';

const visibilityScores = { very_low: 100, low: 80, emerging: 60, visible: 20 } as const;

export function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function networkMatch(assessment: NetworkAssessment) {
  const d = assessment.dimensions;
  return Math.round(
    clampScore(d.structural_pattern_fit) * 0.3 +
    clampScore(d.founder_quality) * 0.25 +
    clampScore(d.founder_transition) * 0.2 +
    clampScore(d.timing) * 0.1 +
    clampScore(d.evidence_confidence) * 0.1 +
    visibilityScores[assessment.visibility] * 0.05,
  );
}

export function passesNetworkGates(assessment: NetworkAssessment, candidate: NetworkCandidate) {
  const d = assessment.dimensions;
  if (assessment.founder_state === 'Noise') return false;
  if (candidate.identityStatus === 'ambiguous') return false;
  if (clampScore(d.structural_pattern_fit) < 60) return false;
  if (clampScore(d.founder_quality) < 55) return false;
  if (clampScore(d.evidence_confidence) < 50) return false;
  if (clampScore(d.founder_transition) < 45 && assessment.founder_state !== 'Founder Now') return false;
  if (assessment.visibility === 'visible' && clampScore(d.timing) < 60) return false;
  return networkMatch(assessment) >= 60;
}

export function networkMatchLabel(score: number) {
  if (score >= 90) return 'Exceptional Match';
  if (score >= 80) return 'Strong Match';
  if (score >= 70) return 'Potential Match';
  return 'Watch';
}

