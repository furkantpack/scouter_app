import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { normalizeRuleText } from '../lib/founder-filter-flags.ts';
import {
  companyAliases,
  fallbackFounderSearchIntent,
  institutionAliases,
} from '../lib/founder-search/parser-core.ts';
import {
  intersectEligibilitySets,
  normalizeFounderSearchPlan,
} from '../lib/founder-search/plan.ts';

const MAX = 250;

async function fetchAll<T>(db: SupabaseClient, table: string, columns: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db
      .from(table)
      .select(columns)
      .order(table === 'founder_tags' ? 'founder_id' : 'id');
    if (table === 'founder_tags') query = query.order('tag_id');
    const result = await query.range(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...((result.data || []) as T[]));
    if ((result.data || []).length < 1000) break;
  }
  return rows;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [companies, roles, tags, founderTags] = await Promise.all([
    fetchAll<any>(db, 'companies', 'id,name'),
    fetchAll<any>(
      db,
      'founder_company_roles',
      'founder_id,company_id,is_current,source_row_id,notes',
    ),
    fetchAll<any>(db, 'tags', 'id,tag'),
    fetchAll<any>(db, 'founder_tags', 'founder_id,tag_id,source'),
  ]);
  const companyById = new Map(companies.map((row) => [row.id, row.name]));
  const tagById = new Map(tags.map((row) => [row.id, row.tag]));

  const companySet = (canonical: string) => {
    const aliases = new Set(companyAliases(canonical).map(normalizeRuleText));
    return new Set<string>(
      roles
        .filter(
          (role) =>
            !role.is_current &&
            aliases.has(
              normalizeRuleText(companyById.get(role.company_id) || ''),
            ),
        )
        .map((role) => role.founder_id),
    );
  };
  const institutionSet = (canonical: string) => {
    const aliases = new Set(
      institutionAliases(canonical).map(normalizeRuleText),
    );
    const tagIds = new Set(
      tags
        .filter((tag) => aliases.has(normalizeRuleText(tag.tag)))
        .map((tag) => tag.id),
    );
    return new Set<string>(
      founderTags
        .filter((link) => tagIds.has(link.tag_id))
        .map((link) => link.founder_id),
    );
  };

  const exactCounts = Object.fromEntries(
    [
      'OpenAI',
      'DeepMind',
      'Anthropic',
      'Stripe',
      'Revolut',
      'Google',
      'Meta',
      'Microsoft',
    ].map((entity) => [entity, companySet(entity).size]),
  );
  exactCounts.Stanford = institutionSet('Stanford').size;
  exactCounts.MIT = institutionSet('MIT').size;

  async function search(rawQuery: string) {
    const parsed = fallbackFounderSearchIntent(rawQuery);
    const plan = normalizeFounderSearchPlan(parsed);
    const gates: Set<string>[] = [];
    if (plan.hard_filters.companies.values.length) {
      const ids = new Set<string>();
      for (const company of plan.hard_filters.companies.values) {
        for (const id of Array.from(companySet(company))) ids.add(id);
      }
      gates.push(ids);
    }
    if (plan.hard_filters.institutions.values.length) {
      const ids = new Set<string>();
      for (const institution of plan.hard_filters.institutions.values) {
        for (const id of Array.from(institutionSet(institution))) ids.add(id);
      }
      gates.push(ids);
    }
    const flags = plan.hard_filters.flags.values;
    if (flags.length) {
      let query = db
        .from('founder_filter_flags')
        .select(`founder_id,${flags.join(',')}`);
      for (const flag of flags) query = query.eq(flag, true);
      const result = await query.limit(MAX);
      if (result.error) throw result.error;
      gates.push(
        new Set((result.data || []).map((row: any) => row.founder_id)),
      );
    }
    for (const signal of plan.hard_filters.signals.values) {
      const result = await db.rpc('search_founders_by_tag', {
        tag_query: signal,
        tag_type_filter: null,
        only_taxonomy_tags: false,
        match_count: MAX,
      });
      if (result.error) throw result.error;
      gates.push(
        new Set(
          (result.data || [])
            .filter(
              (row: any) =>
                String(row.tag || '').toLowerCase() === signal.toLowerCase() ||
                Number(row.similarity || 0) >= 0.45,
            )
            .map((row: any) => row.founder_id),
        ),
      );
    }
    if (plan.hard_filters.roles.values.length) {
      const filters = plan.hard_filters.roles.values.map(
        (role) => `founder_role.ilike.%${role.replace(/[%_,().]/g, ' ')}%`,
      );
      const result = await db
        .from('founder_product_profile')
        .select('id')
        .or(filters.join(','))
        .limit(MAX);
      if (result.error) throw result.error;
      gates.push(new Set((result.data || []).map((row) => row.id)));
    }
    const ids = intersectEligibilitySets(gates);
    if (!ids.size) {
      return { query: rawQuery, result_count: 0, top_5: [] };
    }
    const profiles = await db
      .from('founder_product_profile')
      .select('id,name,scouter_score')
      .in('id', Array.from(ids))
      .order('scouter_score', { ascending: false, nullsFirst: false })
      .limit(5);
    if (profiles.error) throw profiles.error;
    return {
      query: rawQuery,
      result_count: ids.size,
      top_5: (profiles.data || []).map((profile) => {
        const employerEvidence = roles.find(
          (role) =>
            role.founder_id === profile.id &&
            !role.is_current &&
            plan.hard_filters.companies.values.some((company) =>
              new Set(companyAliases(company).map(normalizeRuleText)).has(
                normalizeRuleText(companyById.get(role.company_id) || ''),
              ),
            ),
        );
        const institutionEvidence = founderTags.find(
          (link) =>
            link.founder_id === profile.id &&
            plan.hard_filters.institutions.values.some((institution) =>
              new Set(
                institutionAliases(institution).map(normalizeRuleText),
              ).has(normalizeRuleText(tagById.get(link.tag_id) || '')),
            ),
        );
        return {
          name: profile.name,
          scouter_score: profile.scouter_score,
          exact_evidence_source:
            employerEvidence?.notes ||
            institutionEvidence?.source ||
            'canonical persisted record',
        };
      }),
    };
  }

  const searches = [];
  for (const query of [
    'ex OpenAI',
    'ex DeepMind',
    'Stripe alumni',
    'former Google founder',
    'MIT or Stanford founders',
  ]) {
    searches.push(await search(query));
  }
  console.log(JSON.stringify({ exact_counts: exactCounts, searches }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
