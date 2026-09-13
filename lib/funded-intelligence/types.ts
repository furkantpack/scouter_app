import type {
  NetworkEvidence,
  NetworkReferenceProfile,
} from '@/lib/network/types';

export type PatternComponents = {
  historical_pattern_fit: number;
  founder_dna: number;
  early_signal_strength: number;
  commercial_validation: number;
  strategic_complementarity: number;
  alpha_discoverability: number;
};

export type ReferenceIntelligence = {
  executive_summary: string;
  reference_company: Record<string, unknown>;
  original_wedge: {
    problem: string;
    wedge: string;
    buyer: string;
    why_it_worked: string;
  };
  founder_dna: Record<string, unknown>;
  investor_pattern: Record<string, unknown>;
  customer_pattern: Record<string, unknown>;
  strategic_outcome: Record<string, unknown>;
  category_evolution: {
    original_problem: string;
    reference_wedge: string;
    category_evolution: string;
    current_opportunity_layer: string;
    early_market?: string;
    next_category_form?: string;
    current_scale_stage_validators?: string[];
    next_opportunity_layer?: string;
  };
  value_chain: {
    branches: Array<{
      branch: string;
      market_layer: string;
      historical_benchmark: string;
      scale_stage_validator: string;
      emerging_company: string;
      pre_announcement_founder: string;
      source_urls: string[];
    }>;
  };
  maturity_map: {
    stages: Array<{
      stage: string;
      companies: string[];
      source_urls: string[];
    }>;
  };
  historical_validators: Array<{
    name: string;
    event: string;
    pattern: string;
    similarity: 'Strong' | 'Medium' | 'Weak';
    what_it_proves: string;
    source_urls: string[];
  }>;
  missing_layers: Array<{
    incumbent?: string;
    owns?: string[];
    does_not_own?: string;
    valuable_missing_layer?: string;
    startup_archetype?: string;
    source_urls?: string[];
  }>;
  founder_archetypes: Array<{
    name: string;
    components: string[];
    resulting_founder_type: string;
    evidence: string;
  }>;
  strategic_complementarity: Record<string, unknown>;
  repeating_historical_pattern: string;
  market_layer_becoming_interesting_now: string;
  strongest_pre_announcement_founder_signal: string;
  why_contact_now: string;
  final_scouter_insight: {
    summary: string;
    repeating_pattern: string;
    missing_layer: string;
    why_now: string;
  };
  network_reference: NetworkReferenceProfile;
  evidence: NetworkEvidence[];
};

export type CandidateAssessment = {
  candidate_id: string;
  candidate_name: string;
  founder_state:
    'Founder Now' | 'Founder Formation' | 'Future Founder' | 'Noise';
  pattern_branch: string;
  historical_comparable: string;
  component_scores: PatternComponents;
  verification_confidence: number;
  why_now: string;
  visibility: 'very_low' | 'low' | 'emerging' | 'visible';
  key_evidence: string[];
  red_flags: string[];
  exclusion_reasons: string[];
  signals?: Array<{
    signal_type: string;
    date: string | null;
    explanation: string;
    why_it_matters: string;
    source_url: string;
  }>;
};
