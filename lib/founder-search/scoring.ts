export const SEARCH_MATCH_WEIGHTS = {
  text_relevance: 35,
  structured_exact_matches: 30,
  signal_matches: 15,
  scouter_score: 10,
  timing_relevance: 10,
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function calculateSearchMatchScore({
  textRelevance,
  structuredCoverage,
  signalCoverage,
  scouterScore,
  timingRelevance,
}: {
  textRelevance: number;
  structuredCoverage: number;
  signalCoverage: number;
  scouterScore: number | null;
  timingRelevance: number;
}) {
  return Math.round(
    clamp01(textRelevance) * SEARCH_MATCH_WEIGHTS.text_relevance +
      clamp01(structuredCoverage) *
        SEARCH_MATCH_WEIGHTS.structured_exact_matches +
      clamp01(signalCoverage) * SEARCH_MATCH_WEIGHTS.signal_matches +
      clamp01((scouterScore || 0) / 100) *
        SEARCH_MATCH_WEIGHTS.scouter_score +
      clamp01(timingRelevance) * SEARCH_MATCH_WEIGHTS.timing_relevance,
  );
}
