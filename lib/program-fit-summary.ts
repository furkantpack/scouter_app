import 'server-only';

import { unstable_cache } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';

export type ProgramFitSummaryRow = {
  program_id: string;
  program_name: string;
  scored_founders: number;
  fit_90_plus: number;
  average_fit: number | null;
};

const getCachedProgramFitSummary = unstable_cache(
  async () => {
    const result = await createAdminClient().rpc('get_program_fit_summary');
    if (result.error) throw result.error;
    return (result.data || []) as ProgramFitSummaryRow[];
  },
  ['program-fit-summary-v1'],
  { revalidate: 600, tags: ['program-fit-summary'] },
);

export async function loadProgramFitSummary() {
  return getCachedProgramFitSummary();
}
