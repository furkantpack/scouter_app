export type CohortSignalMap = Record<string, number | null>;

export interface CohortEvidence {
  field: string;
  status:
    | 'verified'
    | 'corroborated'
    | 'likely'
    | 'inferred'
    | 'unresolved'
    | 'contradicted';
  source_type: string;
  confidence?: number;
  freshness_days?: number | null;
  url?: string | null;
  source_value?: string;
}

export interface CohortProfile {
  founder: CohortSignalMap;
  company: CohortSignalMap;
  categories: string[];
  stage?: string | null;
  geographies: string[];
  evidence?: CohortEvidence[];
}

export interface CohortFeatureMatch {
  feature: string;
  observed: number;
  target: number;
  similarity: number;
  importance: number;
}

export interface CurrentProgramFit {
  program: string;
  program_id: string;
  current_program_fit: number;
  fit_band: string;
  historical_latest_cohort_fit: number;
  current_intent_fit: number | null;
  market_regime_fit: number | null;
  overall_confidence: number;
  evidence_confidence: number;
  historical_component_scores: Record<string, number | null>;
  historical_top_matches: CohortFeatureMatch[];
  historical_top_gaps: CohortFeatureMatch[];
  intent_top_matches: CohortFeatureMatch[];
  intent_top_gaps: CohortFeatureMatch[];
  verification_warnings: string[];
  sources: Record<string, string[]>;
  score_semantics: string;
}

export interface HistoricalBatchFit {
  program: string;
  program_id: string;
  year: string;
  historical_cohort_fit: number;
  dna_confidence: number;
  warnings: string[];
  sources: string[];
  [key: string]: unknown;
}

export interface ProgramSubcohortFit {
  program: string;
  program_id: string;
  cohort_id: string;
  subcohort_dna_fit: number;
  dna_confidence: number;
  warnings: string[];
  sources: string[];
  [key: string]: unknown;
}

export interface CohortEngineResult {
  engine: string;
  version: string;
  as_of: string | null;
  semantics: Record<string, string>;
  verification: {
    evidence_confidence: number;
    warnings: string[];
    [key: string]: unknown;
  };
  current_program_ranking: CurrentProgramFit[];
  historical_nearest_batches: HistoricalBatchFit[];
  program_subcohort_ranking: ProgramSubcohortFit[];
}

export interface MappedCohortProfile {
  profile: CohortProfile;
  companyId: string | null;
  unmappedTaxonomy: string[];
}
