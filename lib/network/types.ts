export type NetworkRunStatus =
  | 'queued'
  | 'building_reference'
  | 'sourcing'
  | 'enriching'
  | 'scoring'
  | 'ready'
  | 'failed';

export type NetworkInput = {
  companyName: string;
  companyUrl?: string | null;
  fundingUrl?: string | null;
  techEu?: {
    companyId: string;
    roundId: string;
    round?: {
      url: string;
      date: string | null;
      stage: string | null;
      amountEur: number | null;
      investors: string[];
      company: {
        id: string;
        name: string;
        country: string | null;
        sectors: string[];
      };
      source: { domain?: string; tier?: string } | null;
      confidence: string | null;
    };
  } | null;
};

export type NetworkEvidence = {
  source: 'scouter_db' | 'scout' | 'exa' | 'tech_eu' | 'user';
  url: string;
  title?: string | null;
  excerpt: string;
  publishedAt?: string | null;
};

export type NetworkReferenceProfile = {
  company: {
    name: string;
    description: string;
    website: string | null;
    funding_stage: string | null;
    funding_amount: string | null;
    funding_date: string | null;
    investors: string[];
  };
  company_pattern: {
    sector: string;
    sub_sector: string[];
    product_type: string;
    business_model: string;
    customer_type: string;
    technical_theme: string;
    market_type: string;
    commercialization_model: string;
    company_stage: string;
    geography: string;
    capital_intensity: string;
    gtm_motion: string;
    product_maturity: string;
    traction_type: string;
  };
  founder_pattern: {
    archetypes: string[];
    technical_balance: string;
    research_background: string;
    prior_founder_history: string;
    previous_exit: string;
    career_background: string;
    domain_expertise: string;
    technical_ownership: string;
    founder_market_fit: string;
    formation_pattern: string;
  };
  timing: {
    company_age: string;
    trigger_events: string[];
    transition: string;
    commercial_intent: string;
  };
  validated_pattern: string[];
  validated_capital_signal: string;
  search_thesis: {
    summary: string;
    must_have: string[];
    should_have: string[];
    disqualifiers: string[];
    candidate_archetypes: string[];
    semantic_queries: string[];
  };
  unknowns: string[];
};

export type NetworkCandidate = {
  founderId: string | null;
  name: string;
  company: string | null;
  role: string | null;
  profileText: string;
  scouterScore: number | null;
  linkedinUrl?: string | null;
  companyUrl?: string | null;
  sourceMix: Array<'scouter_db' | 'scout' | 'exa'>;
  evidence: NetworkEvidence[];
  identityStatus: 'confirmed' | 'probable' | 'ambiguous';
};

export type NetworkAssessment = {
  candidate_name: string;
  founder_state:
    'Founder Now' | 'Founder Formation' | 'Future Founder' | 'Noise';
  founder_archetype: string;
  dimensions: {
    structural_pattern_fit: number;
    founder_quality: number;
    founder_transition: number;
    timing: number;
    evidence_confidence: number;
  };
  visibility: 'very_low' | 'low' | 'emerging' | 'visible';
  why_now: string;
  pattern_match_summary: string;
  match_reasons: string[];
  key_difference: string;
  risks: string[];
  supporting_evidence: string[];
};

export type RankedNetworkCandidate = NetworkCandidate &
  NetworkAssessment & {
    networkMatch: number;
    visibilityAdvantage: number;
    rank: number;
  };
