export type InstantDimensionScores = {
  sector_category_fit: number;
  product_technology_fit: number;
  customer_workflow_fit: number;
  business_model_fit: number;
  founder_formation_relevance: number;
  stage_timing_fit: number;
  founder_quality: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function instantReferenceMatchScore(scores: InstantDimensionScores) {
  return Math.round(
    clamp(scores.sector_category_fit) * 0.25 +
      clamp(scores.product_technology_fit) * 0.25 +
      clamp(scores.customer_workflow_fit) * 0.15 +
      clamp(scores.business_model_fit) * 0.1 +
      clamp(scores.founder_formation_relevance) * 0.1 +
      clamp(scores.stage_timing_fit) * 0.1 +
      clamp(scores.founder_quality) * 0.05,
  );
}
