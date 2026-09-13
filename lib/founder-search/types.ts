import type { FounderProfile } from '@/lib/product-types';

export type FounderSearchSortIntent =
  'search_match' | 'scouter_score' | 'recent' | null;

export type FounderSearchIntent = {
  companies: string[];
  institutions: string[];
  career_flags: string[];
  education_flags: string[];
  sector_flags: string[];
  tags: string[];
  geographies: string[];
  roles: string[];
  timing_signals: string[];
  visibility_signals: string[];
  founder_archetypes: string[];
  semantic_query: string;
  sort_intent: FounderSearchSortIntent;
};

export type ParsedFounderSearch = FounderSearchIntent & {
  parser_mode: 'gemini' | 'fallback' | 'preset';
};

export type FounderSearchResult = Pick<
  FounderProfile,
  | 'id'
  | 'name'
  | 'founder_role'
  | 'timing_label'
  | 'company_id'
  | 'company_name'
  | 'category_l1'
  | 'category_path'
  | 'company_history'
  | 'tags'
  | 'scouter_score'
  | 'score_status'
  | 'score_rationale'
> & {
  signal_tags: string[];
  search_match_score: number;
  why_matched: string[];
  text_relevance: number;
};

export type FounderSearchResponse = {
  parsed_query: ParsedFounderSearch;
  results: FounderSearchResult[];
  total: number;
  page: number;
  page_size: number;
};
