import { dbError, withWorkspace } from '@/lib/product-api';
import { ENTREPRENEUR_FIRST_TAGS } from '@/lib/ef-taxonomy';
import { loadBestProgramFits } from '@/lib/program-fit';

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  return withWorkspace(request, async ({ supabase }) => {
    const url = new URL(request.url);
    const page = Math.max(
      0,
      Math.min(10_000, Number(url.searchParams.get('page')) || 0),
    );
    const q = (url.searchParams.get('q') || '')
      .trim()
      .slice(0, 100)
      .replace(/[,().%_]/g, ' ');
    const sort = url.searchParams.get('sort') || 'score_desc';

    let query = supabase
      .from('founder_product_profile')
      .select('*,founder_tags!inner(tags!inner(tag))', { count: 'exact' })
      .in('founder_tags.tags.tag', [...ENTREPRENEUR_FIRST_TAGS]);

    if (q) {
      query = query.or(
        `name.ilike.%${q}%,company_name.ilike.%${q}%,founder_role.ilike.%${q}%,category_l1.ilike.%${q}%,timing_label.ilike.%${q}%,score_rationale.ilike.%${q}%`,
      );
    }

    if (sort === 'score_asc') {
      query = query.order('scouter_score', {
        ascending: true,
        nullsFirst: false,
      });
    } else if (sort === 'name_asc') {
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('scouter_score', {
        ascending: false,
        nullsFirst: false,
      });
    }

    const { data, error, count } = await query
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    dbError(error);

    const bestFits = await loadBestProgramFits(supabase, (data || []).map((row) => row.id));
    const founders = (data || []).map(({ founder_tags: _founderTags, ...founder }) => ({ ...founder, best_program_fit: bestFits.get(founder.id) || null }));

    return {
      founders,
      count: count || 0,
      page,
      pageSize: PAGE_SIZE,
    };
  });
}
