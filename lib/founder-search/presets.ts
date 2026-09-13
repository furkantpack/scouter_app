import type { FounderSearchIntent } from './types.ts';

export type FounderSearchPreset = {
  id: string;
  label: string;
  query: string;
  intent: FounderSearchIntent;
};

export const FOUNDER_SEARCH_PRESETS = [
  {
    id: 'ex-ai-infrastructure',
    label: 'Ex-OpenAI / DeepMind AI Infra',
    query: 'Find ex-OpenAI or DeepMind founders building AI infrastructure',
    intent: {
      companies: ['OpenAI', 'DeepMind'],
      institutions: [],
      career_flags: [],
      education_flags: [],
      sector_flags: ['sector_ai_ml_infra'],
      tags: [],
      geographies: [],
      roles: [],
      timing_signals: [],
      visibility_signals: [],
      founder_archetypes: [],
      semantic_query: 'AI infrastructure',
      sort_intent: null,
    },
  },
  {
    id: 'repeat-founder-new-company',
    label: 'Repeat Founder + Previous Exit',
    query:
      'Find repeat founders with a previous exit who recently started a new company',
    intent: {
      companies: [],
      institutions: [],
      career_flags: [],
      education_flags: [],
      sector_flags: [],
      tags: ['Previous Exit'],
      geographies: [],
      roles: [],
      timing_signals: ['Recently Started'],
      visibility_signals: [],
      founder_archetypes: ['Repeat Founder'],
      semantic_query: 'repeat founder previous exit recently started',
      sort_intent: 'recent',
    },
  },
  {
    id: 'technical-b2b-saas',
    label: 'MIT / Stanford Technical B2B SaaS',
    query:
      'Find MIT or Stanford technical founders in B2B SaaS with high Scouter Scores',
    intent: {
      companies: [],
      institutions: ['MIT', 'Stanford'],
      career_flags: [],
      education_flags: [],
      sector_flags: ['sector_b2b_saas'],
      tags: [],
      geographies: [],
      roles: [],
      timing_signals: [],
      visibility_signals: [],
      founder_archetypes: ['Technical Founder'],
      semantic_query: 'technical founders B2B SaaS',
      sort_intent: 'scouter_score',
    },
  },
] as const satisfies readonly FounderSearchPreset[];

export type FounderSearchPresetId =
  (typeof FOUNDER_SEARCH_PRESETS)[number]['id'];

const PRESETS_BY_ID = new Map<string, FounderSearchPreset>(
  FOUNDER_SEARCH_PRESETS.map((preset) => [preset.id, preset]),
);

export function founderSearchPreset(id: string) {
  return PRESETS_BY_ID.get(id) || null;
}
