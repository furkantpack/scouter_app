import { dbError, withWorkspace } from '@/lib/product-api';
import { loadBestProgramFits } from '@/lib/program-fit';

const PAGE_SIZE = 25;
const SCORE_THRESHOLDS = new Set(['95', '90', 'all']);
const SIGNAL_PRIORITY = [
  /recently left/i,
  /previous exit|prior exit|acquired|repeat founder|serial founder/i,
  /technical founder|founding engineer|cto|research/i,
  /low public footprint|stealth|pre-reveal/i,
  /raising|raise|pre-seed|seed/i,
  /high ownership/i,
  /entrepreneur first|^ef$|ef founder|ef s26|ef bridge|the bridge|\byc\b|antler/i,
  /ex-|palantir|google|meta|mit|cambridge|imperial|cornell|technion/i,
];

type TagJoin = { tags: { tag: string | null } | { tag: string | null }[] | null };

function strongestTags(founderTags: TagJoin[]) {
  const tags = Array.from(new Set(founderTags.flatMap((relation) => {
    const joined = Array.isArray(relation.tags) ? relation.tags : [relation.tags];
    return joined.map((tag) => tag?.tag?.trim()).filter((tag): tag is string => Boolean(tag)).filter((tag) => !/^scouter\s+\d+|^\d+\s*\/\s*100|based on role|main risk:/i.test(tag));
  })));
  return tags.sort((left, right) => {
    const leftRank = SIGNAL_PRIORITY.findIndex((pattern) => pattern.test(left));
    const rightRank = SIGNAL_PRIORITY.findIndex((pattern) => pattern.test(right));
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
  }).slice(0, 3);
}

export async function GET(request: Request) {
  return withWorkspace(request, async ({ supabase }) => {
    const url = new URL(request.url);
    const page = Math.max(0, Math.min(10_000, Number(url.searchParams.get('page')) || 0));
    const requestedThreshold = url.searchParams.get('score') || '95';
    const score = SCORE_THRESHOLDS.has(requestedThreshold) ? requestedThreshold : '95';
    const ascending = url.searchParams.get('sort') === 'asc';
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100).replace(/[,().%_]/g, ' ');
    let query = supabase.from('founder_product_profile').select('*,founder_tags(tags(tag))', { count: 'exact' });
    if (score !== 'all') query = query.gte('scouter_score', Number(score));
    if (q) query = query.or(`name.ilike.%${q}%,company_name.ilike.%${q}%,founder_role.ilike.%${q}%,category_l1.ilike.%${q}%,timing_label.ilike.%${q}%,score_rationale.ilike.%${q}%`);
    const { data, error, count } = await query
      .order('scouter_score', { ascending, nullsFirst: false })
      .order('score_confidence', { ascending: false, nullsFirst: false })
      .order('timing_label', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    dbError(error);
    const bestFits = await loadBestProgramFits(supabase, (data || []).map((row) => row.id));
    const founders = (data || []).map((row) => {
      const { founder_tags: founderTags, ...founder } = row as typeof row & { founder_tags: TagJoin[] };
      return { ...founder, signal_tags: strongestTags(founderTags || []), best_program_fit: bestFits.get(founder.id) || null };
    });
    return { founders, count: count || 0, page, pageSize: PAGE_SIZE, score };
  });
}
