import type { SupabaseClient } from '@supabase/supabase-js';

export type ProgramFitSummary = {
  program_id: string;
  program_name: string;
  fit_score: number;
  fit_band: string | null;
};

export type ProgramFitDetail = ProgramFitSummary & {
  historical_fit: number | null;
  intent_fit: number | null;
  market_fit: number | null;
  top_matches: unknown;
  top_gaps: unknown;
};

export async function loadBestProgramFits(
  supabase: SupabaseClient,
  founderIds: string[],
) {
  const best = new Map<string, ProgramFitSummary>();
  if (!founderIds.length) return best;
  const { data, error } = await supabase
    .from('founder_program_fits')
    .select('founder_id,program_id,program_name,fit_score,fit_band')
    .in('founder_id', founderIds)
    .eq('is_current', true)
    .order('fit_score', { ascending: false });
  if (error) throw error;
  for (const row of data || []) {
    if (!best.has(row.founder_id)) {
      best.set(row.founder_id, {
        program_id: row.program_id,
        program_name: row.program_name,
        fit_score: Number(row.fit_score),
        fit_band: row.fit_band,
      });
    }
  }
  return best;
}

export async function loadFounderProgramFits(
  supabase: SupabaseClient,
  founderId: string,
) {
  const { data, error } = await supabase
    .from('founder_program_fits')
    .select('program_id,program_name,fit_score,fit_band,historical_fit,intent_fit,market_fit,top_matches,top_gaps')
    .eq('founder_id', founderId)
    .eq('is_current', true)
    .order('fit_score', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    fit_score: Number(row.fit_score),
    historical_fit: row.historical_fit == null ? null : Number(row.historical_fit),
    intent_fit: row.intent_fit == null ? null : Number(row.intent_fit),
    market_fit: row.market_fit == null ? null : Number(row.market_fit),
  })) as ProgramFitDetail[];
}

export function programFitLabels(value: unknown, limit = 3): string[] {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const candidates = Array.isArray(value)
    ? value
    : [...(Array.isArray(root.historical) ? root.historical : []), ...(Array.isArray(root.current_intent) ? root.current_intent : [])];
  const labels = candidates.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const raw = typeof row.label === 'string' ? row.label : typeof row.feature === 'string' ? row.feature : null;
    return raw ? [raw.replace(/^(founder|company)\./, '').replaceAll('_', ' ')] : [];
  });
  return Array.from(new Set(labels)).slice(0, limit);
}
