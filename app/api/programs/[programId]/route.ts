import { ApiError, dbError, withWorkspace } from '@/lib/product-api';
import { PROGRAM_BY_ID } from '@/lib/program-registry';

const PAGE_SIZE = 25;

export async function GET(request: Request, { params }: { params: { programId: string } }) {
  return withWorkspace(request, async ({ supabase }) => {
    const programId = params.programId.trim().slice(0, 100);
    if (!/^[a-z0-9_-]+$/i.test(programId)) throw new ApiError('Invalid program id.');
    const url = new URL(request.url);
    const page = Math.max(0, Math.min(10_000, Number(url.searchParams.get('page')) || 0));
    const threshold = ['90', '85', '75', 'all'].includes(url.searchParams.get('fit') || '') ? url.searchParams.get('fit')! : 'all';
    let query = supabase
      .from('founder_program_fits')
      .select('founder_id,program_id,program_name,fit_score,fit_band,top_matches', { count: 'exact' })
      .eq('program_id', programId)
      .eq('is_current', true);
    if (threshold !== 'all') query = query.gte('fit_score', Number(threshold));
    const fits = await query.order('fit_score', { ascending: false }).order('founder_id').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    dbError(fits.error);
    const ids = (fits.data || []).map((fit) => fit.founder_id);
    const [profiles, tags] = ids.length ? await Promise.all([
      supabase.from('founder_product_profile').select('*').in('id', ids),
      supabase.from('founder_tags').select('founder_id,tags(tag)').in('founder_id', ids),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    dbError(profiles.error);
    dbError(tags.error);
    const profileById = new Map((profiles.data || []).map((profile) => [profile.id, profile]));
    const tagsByFounder = new Map<string, string[]>();
    for (const row of tags.data || []) {
      const joined = Array.isArray(row.tags) ? row.tags[0] : row.tags;
      const tag = joined?.tag;
      if (typeof tag === 'string') tagsByFounder.set(row.founder_id, [...(tagsByFounder.get(row.founder_id) || []), tag]);
    }
    return {
      program: PROGRAM_BY_ID.get(programId) || (fits.data?.[0] ? { id: fits.data[0].program_id, name: fits.data[0].program_name, region: '', archetype: '' } : { id: programId, name: programId.replaceAll('_', ' '), region: '', archetype: '' }),
      founders: (fits.data || []).flatMap((fit) => {
        const profile = profileById.get(fit.founder_id);
        return profile ? [{ ...profile, signal_tags: tagsByFounder.get(profile.id) || [], program_fit: { fit_score: Number(fit.fit_score), fit_band: fit.fit_band, top_matches: fit.top_matches } }] : [];
      }),
      count: fits.count || 0,
      page,
      pageSize: PAGE_SIZE,
      fit: threshold,
    };
  });
}
