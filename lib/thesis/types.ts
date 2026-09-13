export type ClaimType = 'stated' | 'observed' | 'inferred';

export type ThesisValue = {
  value: string;
  weight: number;
  confidence: number;
  claim_type: ClaimType;
};

export type SourcePage = {
  url: string;
  title: string;
  pageType: string;
  content: string;
  crawledAt: string;
  relevance: number;
  metadata: Record<string, unknown>;
  contentHash: string;
};

export type PortfolioCompany = {
  company_name: string;
  company_url: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  geography: string | null;
  source_url: string;
};

export type ThesisAnalysis = {
  fund_summary: { name: string; website: string; thesis_summary: string; confidence: number };
  stated_thesis: { summary: string; confidence: number };
  observed_thesis: { summary: string; confidence: number };
  dimensions: {
    stages: ThesisValue[];
    sectors: ThesisValue[];
    business_models: ThesisValue[];
    geographies: ThesisValue[];
    founder_traits: ThesisValue[];
    company_traits: ThesisValue[];
    technologies: ThesisValue[];
  };
  investment_preferences: {
    check_size: { min: number | null; max: number | null; currency: string; confidence: number };
    ownership_preference: string | null;
    lead_or_follow: string | null;
    primary_stage: string | null;
  };
  anti_thesis: ThesisValue[];
  portfolio_patterns: { pattern: string; confidence: number }[];
  portfolio_companies: PortfolioCompany[];
  evidence: {
    dimension: string;
    value: string;
    claim_type: ClaimType;
    source_url: string;
    source_title: string;
    evidence_text: string;
    confidence: number;
  }[];
  quality: {
    source_coverage: number;
    evidence_strength: number;
    portfolio_coverage: number;
    overall_confidence: number;
  };
};

