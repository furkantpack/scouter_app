import { founderFilterFlagForPage } from '@/lib/founder-filter-pages';
import { ApiError, dbError, withWorkspace } from '@/lib/product-api';
import { loadBestProgramFits } from '@/lib/program-fit';

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  return withWorkspace(request, async ({ supabase }) => {
    const url = new URL(request.url);
    const page = Math.max(
      0,
      Math.min(10000, Number(url.searchParams.get('page')) || 0),
    );
    const ascending = url.searchParams.get('sort') === 'asc';
    const q = (url.searchParams.get('q') || '')
      .trim()
      .slice(0, 100)
      .replace(/[,().%_]/g, ' ');
    const requestedFilter = url.searchParams.get('filter');
    const filter = founderFilterFlagForPage(requestedFilter);
    if (requestedFilter && !filter)
      throw new ApiError('Invalid founder filter.');
    if (filter) {
      const result = await supabase.rpc('get_taxonomy_founders_page', {
        p_filter: filter,
        p_query: q || null,
        p_offset: page * PAGE_SIZE,
        p_limit: PAGE_SIZE,
      });
      dbError(result.error);
      const payload = result.data as {
        founders?: Record<string, unknown>[];
        total_count?: number;
      } | null;
      const data = (Array.isArray(payload?.founders) ? payload.founders : []).sort((left, right) => {
        const leftScore = Number(left.scouter_score ?? -1);
        const rightScore = Number(right.scouter_score ?? -1);
        return ascending ? leftScore - rightScore : rightScore - leftScore;
      });
      const bestFits = await loadBestProgramFits(
        supabase,
        data.map((founder) => String(founder.id)),
      );
      return {
        founders: data.map((founder) => ({
          ...founder,
          best_program_fit: bestFits.get(String(founder.id)) || null,
        })),
        count: Number(payload?.total_count || 0),
        page,
      };
    }
    let query = supabase
      .from('founder_product_profile')
      .select('*', { count: 'exact' });
    if (q)
      query = query.or(
        'name.ilike.%' +
          q +
          '%,company_name.ilike.%' +
          q +
          '%,category_l1.ilike.%' +
          q +
          '%,founder_role.ilike.%' +
          q +
          '%',
      );
    const category = url.searchParams.get('category');
    if (category) query = query.eq('category_l1', category);
    const { data, error, count } = await query
      .order('scouter_score', { ascending, nullsFirst: false })
      .order('name')
      .order('id')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    dbError(error);
    const bestFits = await loadBestProgramFits(
      supabase,
      (data || []).map((founder) => founder.id),
    );
    return {
      founders: (data || []).map((founder) => ({
        ...founder,
        best_program_fit: bestFits.get(founder.id) || null,
      })),
      count: count || 0,
      page,
    };
  });
}
