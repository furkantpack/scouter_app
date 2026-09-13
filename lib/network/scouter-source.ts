import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NetworkCandidate, NetworkReferenceProfile } from './types';

function safeTerm(value: string) {
  return value.replace(/[,().%_]/g, ' ').trim().slice(0, 80);
}

export async function discoverInScouter(supabase: SupabaseClient, reference: NetworkReferenceProfile, limit = 40) {
  const terms = Array.from(new Set([
    reference.company_pattern.sector,
    ...reference.company_pattern.sub_sector,
    reference.company_pattern.technical_theme,
    ...reference.search_thesis.must_have,
  ].map(safeTerm).filter((term) => term.length >= 3))).slice(0, 6);
  const filters = terms.flatMap((term) => [
    `category_l1.ilike.%${term}%`,
    `founder_role.ilike.%${term}%`,
    `company_name.ilike.%${term}%`,
    `score_rationale.ilike.%${term}%`,
  ]).join(',');
  let query = supabase.from('founder_product_profile').select('*');
  if (filters) query = query.or(filters);
  const result = await query.order('scouter_score', { ascending: false, nullsFirst: false }).limit(limit);
  if (result.error) throw new Error(`Scouter candidate retrieval failed: ${result.error.message}`);
  return (result.data || []).map((row): NetworkCandidate => ({
    founderId: row.id,
    name: row.name,
    company: row.company_name || null,
    role: row.founder_role || null,
    profileText: [row.category_l1, row.founder_role, row.company_name, row.timing_label, row.score_rationale].filter(Boolean).join(' · '),
    scouterScore: row.scouter_score == null ? null : Number(row.scouter_score),
    sourceMix: ['scouter_db'],
    evidence: [],
    identityStatus: 'confirmed',
  }));
}

