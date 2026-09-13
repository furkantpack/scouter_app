import type { PatternComponents } from './types';

export function clamp(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function referencePatternScore(scores: PatternComponents) {
  return Math.round(
    clamp(scores.historical_pattern_fit) * 0.2 +
      clamp(scores.founder_dna) * 0.2 +
      clamp(scores.early_signal_strength) * 0.2 +
      clamp(scores.commercial_validation) * 0.15 +
      clamp(scores.strategic_complementarity) * 0.15 +
      clamp(scores.alpha_discoverability) * 0.1,
  );
}

export function passesReferenceGates(
  state: string,
  confidence: number,
  score: number,
  exclusions: string[],
) {
  return (
    state !== 'Noise' &&
    clamp(confidence) >= 45 &&
    score >= 60 &&
    exclusions.length === 0
  );
}
