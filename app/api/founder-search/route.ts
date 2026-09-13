import { normalizeRuleText } from '@/lib/founder-filter-flags';
import { parseFounderSearchQuery } from '@/lib/founder-search/parser';
import {
  companyAliases,
  institutionAliases,
} from '@/lib/founder-search/parser-core';
import {
  intersectEligibilitySets,
  normalizeFounderSearchPlan,
} from '@/lib/founder-search/plan';
import {
  getPresetSearchCache,
  setPresetSearchCache,
} from '@/lib/founder-search/preset-cache';
import { founderSearchPreset } from '@/lib/founder-search/presets';
import { calculateSearchMatchScore } from '@/lib/founder-search/scoring';
import type { FounderSearchResponse } from '@/lib/founder-search/types';
import { ApiError, bodyOf, dbError, withWorkspace } from '@/lib/product-api';
import type { Json } from '@/lib/product-types';

const MAX_QUERY_LENGTH = 500;
const MAX_CANDIDATES = 250;
const FLAG_LABELS: Record<string, string> = {
  big_tech_alumni: 'Big Tech alumni',
  fintech_alumni: 'Fintech alumni',
  ai_alumni: 'AI alumni',
  saas_alumni: 'SaaS alumni',
  top_consulting: 'Top consulting alumni',
  regional_alumni: 'Regional alumni',
  global_tier_1: 'Global Tier 1 education',
  technical_tier_1: 'Technical Tier 1 education',
  regional_tier_1: 'Regional Tier 1 education',
  stem_focus: 'STEM background',
  top_mba: 'Top MBA',
  sector_ai_ml_infra: 'AI/ML Infrastructure',
  sector_fintech: 'Fintech',
  sector_b2b_saas: 'B2B SaaS',
  sector_deeptech: 'Deep Tech',
  sector_climate: 'Climate',
  sector_health: 'Health',
  sector_defense: 'Defense',
  sector_consumer: 'Consumer',
  sector_hrtech: 'HR Tech',
};

type SearchRpcRow = {
  founder_id: string;
  name?: string;
  company_name?: string | null;
  rank?: number | null;
  tag?: string | null;
  similarity?: number | null;
};

type FounderRow = {
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
  founder_tags?: Array<{
    tags: { tag: string | null } | Array<{ tag: string | null }> | null;
  }>;
};

function idsOf(rows: SearchRpcRow[]) {
  return new Set(rows.map((row) => row.founder_id).filter(Boolean));
}

function addReason(map: Map<string, Set<string>>, id: string, reason: string) {
  const reasons = map.get(id) || new Set<string>();
  reasons.add(reason);
  map.set(id, reasons);
}

function strongestTags(founder: FounderRow) {
  const joined = (founder.founder_tags || []).flatMap((relation) => {
    const values = Array.isArray(relation.tags)
      ? relation.tags
      : [relation.tags];
    return values
      .map((item) => item?.tag?.trim())
      .filter((item): item is string => Boolean(item));
  });
  const embedded = Array.isArray(founder.tags)
    ? founder.tags
        .map((item) => {
          if (typeof item === 'string') return item;
          if (!item || typeof item !== 'object' || Array.isArray(item))
            return null;
          const record = item as Record<string, Json>;
          const value =
            record.name || record.label || record.tag || record.value;
          return typeof value === 'string' ? value : null;
        })
        .filter((item): item is string => Boolean(item))
    : [];
  return Array.from(new Set([...joined, ...embedded]))
    .filter((tag) => !/^scouter\s+\d+|^\d+\s*\/\s*100/i.test(tag))
    .slice(0, 4);
}

function tokenRelevance(query: string, founder: FounderRow, tags: string[]) {
  const tokens = Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 3),
    ),
  ).slice(0, 12);
  if (!tokens.length) return 0;
  const haystack = [
    founder.name,
    founder.company_name,
    founder.founder_role,
    founder.category_l1,
    founder.timing_label,
    founder.score_rationale,
    ...tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    tokens.filter((token) => haystack.includes(token)).length / tokens.length
  );
}

export async function POST(request: Request) {
  return withWorkspace(request, async ({ supabase }) => {
    const body = await bodyOf(request);
    const requestedPresetId = body.preset_id;
    if (
      requestedPresetId !== undefined &&
      typeof requestedPresetId !== 'string'
    ) {
      throw new ApiError('Invalid founder search preset.');
    }
    const preset =
      typeof requestedPresetId === 'string'
        ? founderSearchPreset(requestedPresetId)
        : null;
    if (typeof requestedPresetId === 'string' && !preset) {
      throw new ApiError('Unknown founder search preset.');
    }

    const submittedQuery =
      typeof body.query === 'string' ? body.query.trim() : '';
    const rawQuery = preset?.query || submittedQuery;
    if (!rawQuery) throw new ApiError('Enter a founder search query.');
    if (rawQuery.length > MAX_QUERY_LENGTH) {
      throw new ApiError(
        `Founder search query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
      );
    }
    const page = Number.isInteger(body.page) ? Number(body.page) : 1;
    const pageSize = Number.isInteger(body.page_size)
      ? Number(body.page_size)
      : 25;
    if (page < 1 || page > 1000 || pageSize < 1 || pageSize > 50) {
      throw new ApiError('Invalid founder search pagination.');
    }

    if (preset) {
      const cached = getPresetSearchCache(preset.id, page, pageSize);
      if (cached) return cached;
    }

    const parsed = preset
      ? ({ ...preset.intent, parser_mode: 'preset' } as const)
      : await parseFounderSearchQuery(rawQuery);
    const plan = normalizeFounderSearchPlan(parsed);
    const reasons = new Map<string, Set<string>>();
    const gateSets: Set<string>[] = [];

    if (plan.hard_filters.companies.values.length) {
      const companyFounderIds = new Set<string>();
      await Promise.all(
        plan.hard_filters.companies.values.map(async (company) => {
          const companyIds: string[] = [];
          for (const alias of companyAliases(company)) {
            const safeAlias = alias.replace(/[%_,().]/g, ' ');
            const companyResult = await supabase
              .from('companies')
              .select('id,name')
              .ilike('name', safeAlias)
              .limit(20);
            dbError(companyResult.error);
            companyIds.push(...(companyResult.data || []).map((row) => row.id));
          }
          if (!companyIds.length) return;
          const roleResult = await supabase
            .from('founder_company_roles')
            .select('founder_id')
            .in('company_id', companyIds)
            .eq('is_current', false)
            .limit(MAX_CANDIDATES);
          dbError(roleResult.error);
          for (const row of roleResult.data || []) {
            companyFounderIds.add(row.founder_id);
            addReason(reasons, row.founder_id, `${company} alumni`);
          }
        }),
      );
      gateSets.push(companyFounderIds);
    }

    if (plan.hard_filters.institutions.values.length) {
      const institutionFounderIds = new Set<string>();
      await Promise.all(
        plan.hard_filters.institutions.values.map(async (institution) => {
          const aliases = new Set(
            institutionAliases(institution).map(normalizeRuleText),
          );
          const institutionResult = await supabase.rpc(
            'search_founders_by_tag',
            {
              tag_query: institution,
              tag_type_filter: null,
              only_taxonomy_tags: false,
              match_count: MAX_CANDIDATES,
            },
          );
          dbError(institutionResult.error);
          for (const row of (institutionResult.data || []) as SearchRpcRow[]) {
            if (row.tag && aliases.has(normalizeRuleText(row.tag))) {
              institutionFounderIds.add(row.founder_id);
              addReason(reasons, row.founder_id, institution);
            }
          }
        }),
      );
      gateSets.push(institutionFounderIds);
    }

    const flags = plan.hard_filters.flags.values;
    if (flags.length) {
      let flagQuery = supabase
        .from('founder_filter_flags')
        .select(`founder_id,${flags.join(',')}`);
      for (const flag of flags) flagQuery = flagQuery.eq(flag, true);
      const flagResult = await flagQuery.limit(MAX_CANDIDATES);
      dbError(flagResult.error);
      const flagIds = new Set<string>();
      for (const row of (flagResult.data || []) as unknown as Array<{
        founder_id: string;
      }>) {
        flagIds.add(row.founder_id);
        for (const flag of flags)
          addReason(reasons, row.founder_id, FLAG_LABELS[flag]);
      }
      gateSets.push(flagIds);
    }

    const requestedSignals = plan.hard_filters.signals.values;
    for (const signal of requestedSignals) {
      const signalResult = await supabase.rpc('search_founders_by_tag', {
        tag_query: signal,
        tag_type_filter: null,
        only_taxonomy_tags: false,
        match_count: MAX_CANDIDATES,
      });
      dbError(signalResult.error);
      const rows = ((signalResult.data || []) as SearchRpcRow[]).filter(
        (row) =>
          String(row.tag || '').toLowerCase() === signal.toLowerCase() ||
          Number(row.similarity || 0) >= 0.45,
      );
      const signalIds = idsOf(rows);
      for (const id of Array.from(signalIds)) addReason(reasons, id, signal);
      gateSets.push(signalIds);
    }

    if (plan.hard_filters.roles.values.length) {
      const roleFilters = plan.hard_filters.roles.values.map(
        (role) => `founder_role.ilike.%${role.replace(/[%_,().]/g, ' ')}%`,
      );
      const roleResult = await supabase
        .from('founder_product_profile')
        .select('id')
        .or(roleFilters.join(','))
        .limit(MAX_CANDIDATES);
      dbError(roleResult.error);
      const roleIds = new Set<string>(
        (roleResult.data || []).map((row) => row.id),
      );
      for (const id of Array.from(roleIds)) {
        addReason(reasons, id, plan.hard_filters.roles.values.join(' / '));
      }
      gateSets.push(roleIds);
    }

    const textResult = await supabase.rpc('search_founders_text', {
      q: parsed.semantic_query || rawQuery,
      match_count: MAX_CANDIDATES,
    });
    dbError(textResult.error);
    const textRows = (textResult.data || []) as SearchRpcRow[];
    const textRanks = new Map(
      textRows.map((row) => [row.founder_id, Number(row.rank || 0)]),
    );
    const maxTextRank = Math.max(0, ...Array.from(textRanks.values()));

    let candidateIds = gateSets.length
      ? intersectEligibilitySets(gateSets)
      : idsOf(textRows);

    if (!candidateIds.size && !gateSets.length) {
      const terms = (parsed.semantic_query || rawQuery)
        .replace(/[%_,().]/g, ' ')
        .split(/\s+/)
        .filter((term) => term.length >= 3)
        .slice(0, 5);
      if (terms.length) {
        const filters = terms.flatMap((term) => [
          `name.ilike.%${term}%`,
          `company_name.ilike.%${term}%`,
          `founder_role.ilike.%${term}%`,
          `category_l1.ilike.%${term}%`,
        ]);
        const fallbackResult = await supabase
          .from('founder_product_profile')
          .select('id')
          .or(filters.join(','))
          .order('scouter_score', { ascending: false, nullsFirst: false })
          .limit(MAX_CANDIDATES);
        dbError(fallbackResult.error);
        candidateIds = new Set(
          (fallbackResult.data || []).map((row) => row.id),
        );
      }
    }

    if (!candidateIds.size) {
      const empty: FounderSearchResponse = {
        parsed_query: parsed,
        results: [],
        total: 0,
        page,
        page_size: pageSize,
      };
      if (preset) setPresetSearchCache(preset.id, page, pageSize, empty);
      return empty;
    }

    const profileResult = await supabase
      .from('founder_product_profile')
      .select(
        'id,name,founder_role,timing_label,company_id,company_name,category_l1,category_path,company_history,tags,scouter_score,score_status,score_rationale,founder_tags(tags(tag))',
      )
      .in('id', Array.from(candidateIds).slice(0, MAX_CANDIDATES))
      .limit(MAX_CANDIDATES);
    dbError(profileResult.error);

    const structuredGateCount =
      (plan.hard_filters.companies.values.length ? 1 : 0) +
      (plan.hard_filters.institutions.values.length ? 1 : 0) +
      flags.length +
      (plan.hard_filters.roles.values.length ? 1 : 0);
    const signalGateCount = requestedSignals.length;

    const ranked = ((profileResult.data || []) as FounderRow[]).map(
      (founder) => {
        const tags = strongestTags(founder);
        const rpcRank = textRanks.get(founder.id) || 0;
        const rankRelevance = maxTextRank > 0 ? rpcRank / maxTextRank : 0;
        const textRelevance = Math.max(
          rankRelevance,
          tokenRelevance(parsed.semantic_query || rawQuery, founder, tags),
        );
        const matchedReasons = Array.from(reasons.get(founder.id) || []);
        const timingRelevance = parsed.timing_signals.length
          ? parsed.timing_signals.some((signal) =>
              `${founder.timing_label || ''} ${tags.join(' ')}`
                .toLowerCase()
                .includes(signal.toLowerCase()),
            )
            ? 1
            : 0
          : 0;
        const searchMatchScore = calculateSearchMatchScore({
          textRelevance,
          structuredCoverage: structuredGateCount ? 1 : 0,
          signalCoverage: signalGateCount ? 1 : 0,
          scouterScore: founder.scouter_score,
          timingRelevance,
        });
        if (textRelevance > 0) {
          matchedReasons.push(
            `Text relevance ${Math.round(textRelevance * 100)}%`,
          );
        }
        const { founder_tags: _founderTags, ...publicFounder } = founder;
        return {
          ...publicFounder,
          signal_tags: tags,
          search_match_score: searchMatchScore,
          why_matched: Array.from(new Set(matchedReasons)).slice(0, 6),
          text_relevance: Math.round(textRelevance * 100),
        };
      },
    );

    ranked.sort((left, right) => {
      if (parsed.sort_intent === 'scouter_score') {
        return (right.scouter_score || 0) - (left.scouter_score || 0);
      }
      if (parsed.sort_intent === 'recent') {
        const leftRecent = /recent|0–[03612]+ month/i.test(
          left.timing_label || '',
        )
          ? 1
          : 0;
        const rightRecent = /recent|0–[03612]+ month/i.test(
          right.timing_label || '',
        )
          ? 1
          : 0;
        if (rightRecent !== leftRecent) return rightRecent - leftRecent;
      }
      return (
        right.search_match_score - left.search_match_score ||
        (right.scouter_score || 0) - (left.scouter_score || 0) ||
        left.name.localeCompare(right.name)
      );
    });

    const offset = (page - 1) * pageSize;
    const response: FounderSearchResponse = {
      parsed_query: parsed,
      results: ranked.slice(offset, offset + pageSize),
      total: ranked.length,
      page,
      page_size: pageSize,
    };
    if (preset) setPresetSearchCache(preset.id, page, pageSize, response);
    return response;
  });
}
