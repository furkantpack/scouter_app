import { createClient } from '@supabase/supabase-js';

import { normalizeRuleText } from '../lib/founder-filter-flags.ts';
import {
  companyAliases,
  institutionAliases,
} from '../lib/founder-search/parser-core.ts';
import {
  intersectEligibilitySets,
  normalizeFounderSearchPlan,
} from '../lib/founder-search/plan.ts';
import {
  getPresetSearchCache,
  setPresetSearchCache,
} from '../lib/founder-search/preset-cache.ts';
import { FOUNDER_SEARCH_PRESETS } from '../lib/founder-search/presets.ts';
import type { FounderSearchResponse } from '../lib/founder-search/types.ts';

const MAX_CANDIDATES = 250;
type FounderIdRow = { founder_id: string };
type TagSearchRow = FounderIdRow & {
  tag?: string | null;
  similarity?: number | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials.');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const measurements = [];
  for (const preset of FOUNDER_SEARCH_PRESETS) {
    let dbCalls = 0;
    const startedAt = performance.now();
    const plan = normalizeFounderSearchPlan(preset.intent);
    const gateSets: Set<string>[] = [];

    if (plan.hard_filters.companies.values.length) {
      const founderIds = new Set<string>();
      await Promise.all(
        plan.hard_filters.companies.values.map(async (company) => {
          const companyIds: string[] = [];
          for (const alias of companyAliases(company)) {
            dbCalls += 1;
            const result = await db
              .from('companies')
              .select('id,name')
              .ilike('name', alias.replace(/[%_,().]/g, ' '))
              .limit(20);
            if (result.error) throw result.error;
            companyIds.push(...(result.data || []).map((row) => row.id));
          }
          if (!companyIds.length) return;
          dbCalls += 1;
          const roles = await db
            .from('founder_company_roles')
            .select('founder_id')
            .in('company_id', companyIds)
            .eq('is_current', false)
            .limit(MAX_CANDIDATES);
          if (roles.error) throw roles.error;
          for (const role of roles.data || []) founderIds.add(role.founder_id);
        }),
      );
      gateSets.push(founderIds);
    }

    if (plan.hard_filters.institutions.values.length) {
      const founderIds = new Set<string>();
      await Promise.all(
        plan.hard_filters.institutions.values.map(async (institution) => {
          const aliases = new Set(
            institutionAliases(institution).map(normalizeRuleText),
          );
          dbCalls += 1;
          const result = await db.rpc('search_founders_by_tag', {
            tag_query: institution,
            tag_type_filter: null,
            only_taxonomy_tags: false,
            match_count: MAX_CANDIDATES,
          });
          if (result.error) throw result.error;
          for (const row of result.data || []) {
            if (row.tag && aliases.has(normalizeRuleText(row.tag))) {
              founderIds.add(row.founder_id);
            }
          }
        }),
      );
      gateSets.push(founderIds);
    }

    const flags = plan.hard_filters.flags.values;
    if (flags.length) {
      dbCalls += 1;
      let query = db
        .from('founder_filter_flags')
        .select(`founder_id,${flags.join(',')}`);
      for (const flag of flags) query = query.eq(flag, true);
      const result = await query.limit(MAX_CANDIDATES);
      if (result.error) throw result.error;
      gateSets.push(
        new Set(
          ((result.data || []) as unknown as FounderIdRow[]).map(
            (row) => row.founder_id,
          ),
        ),
      );
    }

    for (const signal of plan.hard_filters.signals.values) {
      dbCalls += 1;
      const result = await db.rpc('search_founders_by_tag', {
        tag_query: signal,
        tag_type_filter: null,
        only_taxonomy_tags: false,
        match_count: MAX_CANDIDATES,
      });
      if (result.error) throw result.error;
      gateSets.push(
        new Set(
          ((result.data || []) as TagSearchRow[])
            .filter(
              (row) =>
                String(row.tag || '').toLowerCase() === signal.toLowerCase() ||
                Number(row.similarity || 0) >= 0.45,
            )
            .map((row) => row.founder_id),
        ),
      );
    }

    dbCalls += 1;
    const textResult = await db.rpc('search_founders_text', {
      q: preset.intent.semantic_query || preset.query,
      match_count: MAX_CANDIDATES,
    });
    if (textResult.error) throw textResult.error;
    const candidateIds = gateSets.length
      ? intersectEligibilitySets(gateSets)
      : new Set(
          ((textResult.data || []) as FounderIdRow[]).map(
            (row) => row.founder_id,
          ),
        );

    let profiles: Array<{ id: string; name: string }> = [];
    if (candidateIds.size) {
      dbCalls += 1;
      const result = await db
        .from('founder_product_profile')
        .select('id,name')
        .in('id', Array.from(candidateIds).slice(0, MAX_CANDIDATES))
        .limit(MAX_CANDIDATES);
      if (result.error) throw result.error;
      profiles = result.data || [];
    }
    const coldMs = performance.now() - startedAt;

    const cacheValue = {
      parsed_query: { ...preset.intent, parser_mode: 'preset' },
      results: [],
      total: profiles.length,
      page: 1,
      page_size: 25,
    } satisfies FounderSearchResponse;
    setPresetSearchCache(preset.id, 1, 25, cacheValue);
    const warmStartedAt = performance.now();
    const cached = getPresetSearchCache(preset.id, 1, 25);
    const warmMs = performance.now() - warmStartedAt;

    measurements.push({
      preset_id: preset.id,
      parser_calls: 0,
      db_calls: dbCalls,
      cold_db_execution_ms: Number(coldMs.toFixed(2)),
      warm_cache_lookup_ms: Number(warmMs.toFixed(4)),
      result_count: profiles.length,
      top_founders: profiles.slice(0, 5).map((profile) => profile.name),
      cache_hit: Boolean(cached),
    });
  }

  console.log(JSON.stringify({ measurements }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
