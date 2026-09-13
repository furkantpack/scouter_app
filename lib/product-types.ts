export type Json =
  string | number | boolean | null | Json[] | { [key: string]: Json };
export interface FounderProfile {
  id: string;
  name: string;
  founder_role: string | null;
  timing_label: string | null;
  company_id: string | null;
  company_name: string | null;
  category_l1: string | null;
  category_path: Json;
  company_history: Json;
  tags: Json;
  scouter_score: number | null;
  score_status: 'researched' | 'calibrated_backfill' | null;
  score_rationale: string | null;
  score_confidence: number | null;
  score_model_version: string | null;
  best_program_fit?: import('./program-fit').ProgramFitSummary | null;
}
export interface FounderList {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  visibility: 'private' | 'organization' | 'public_link';
  share_token: string | null;
  created_at?: string;
  updated_at?: string;
  creator_label?: string;
  can_edit?: boolean;
  list_founders?: { founder_id: string }[];
  founder_preview?: Array<{
    id: string;
    name: string;
    company_name: string | null;
  }>;
}
export interface FounderNote {
  id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  [key: string]: unknown;
}
export interface FounderDetail {
  profile: FounderProfile;
  social: { linkedin_url: string | null; twitter_url: string | null };
  roles: Record<string, Json>[];
  tags: Record<string, Json>[];
  program_fits: import('./program-fit').ProgramFitDetail[];
}
export interface FounderResults {
  founders: FounderProfile[];
  count: number;
  page: number;
}
