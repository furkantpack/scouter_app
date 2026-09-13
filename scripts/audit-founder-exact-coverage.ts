import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { normalizeRuleText } from '../lib/founder-filter-flags.ts';
import {
  exactEmployerEvidence,
  exactInstitutionEvidence,
} from '../lib/founder-search/exact-evidence.ts';
import {
  companyAliases,
  institutionAliases,
  KNOWN_COMPANIES,
  KNOWN_INSTITUTIONS,
} from '../lib/founder-search/parser-core.ts';
import { proposedExactEntityBackfill } from './backfill-founder-exact-entities.ts';

async function fetchAll<T>(db: SupabaseClient, table: string, columns: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = db
      .from(table)
      .select(columns)
      .order(
        table === 'founder_tags' || table === 'founder_filter_flags'
          ? 'founder_id'
          : 'id',
      );
    if (table === 'founder_tags') query = query.order('tag_id');
    const result = await query.range(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...((result.data || []) as T[]));
    if ((result.data || []).length < 1000) break;
  }
  return rows;
}

const difference = (source: Set<string>, ...excluded: Set<string>[]) =>
  new Set(
    Array.from(source).filter((id) => excluded.every((set) => !set.has(id))),
  );

const EMPLOYER_PARENT: Record<string, string> = {
  Meta: 'big_tech_alumni',
  Google: 'big_tech_alumni',
  Apple: 'big_tech_alumni',
  Amazon: 'big_tech_alumni',
  Netflix: 'big_tech_alumni',
  Microsoft: 'big_tech_alumni',
  Stripe: 'fintech_alumni',
  Revolut: 'fintech_alumni',
  Wise: 'fintech_alumni',
  Brex: 'fintech_alumni',
  Nubank: 'fintech_alumni',
  Adyen: 'fintech_alumni',
  OpenAI: 'ai_alumni',
  DeepMind: 'ai_alumni',
  Anthropic: 'ai_alumni',
  'Mistral AI': 'ai_alumni',
  Cohere: 'ai_alumni',
  xAI: 'ai_alumni',
  Notion: 'saas_alumni',
  Linear: 'saas_alumni',
  Figma: 'saas_alumni',
  HubSpot: 'saas_alumni',
  Salesforce: 'saas_alumni',
};
const INSTITUTION_PARENT: Record<string, string> = {
  MIT: 'global_tier_1',
  Stanford: 'global_tier_1',
  Harvard: 'global_tier_1',
  Oxford: 'global_tier_1',
  Cambridge: 'global_tier_1',
  'ETH Zurich': 'technical_tier_1',
  'Imperial College London': 'technical_tier_1',
  Caltech: 'technical_tier_1',
  CMU: 'technical_tier_1',
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [rawRows, roles, companies, founderTags, tags, flags, provenance] =
    await Promise.all([
      fetchAll<any>(db, 'raw_master_rows', 'id,canonical_founder_id,raw_json'),
      fetchAll<any>(
        db,
        'founder_company_roles',
        'founder_id,company_id,is_current',
      ),
      fetchAll<any>(db, 'companies', 'id,name'),
      fetchAll<any>(db, 'founder_tags', 'founder_id,tag_id,source'),
      fetchAll<any>(db, 'tags', 'id,tag,tag_family,is_taxonomy_tag'),
      fetchAll<any>(db, 'founder_filter_flags', '*'),
      fetchAll<any>(
        db,
        'field_provenance',
        'field_name,value_source,source_columns',
      ),
    ]);
  const proposed = proposedExactEntityBackfill(rawRows);
  const companyById = new Map(
    companies.map((company) => [company.id, company.name]),
  );
  const tagById = new Map(tags.map((tag) => [tag.id, tag.tag]));
  const employerTagEvidence = new Map<string, Set<string>>();
  const institutionTagEvidence = new Map<string, Set<string>>();
  for (const link of founderTags) {
    const tag = tagById.get(link.tag_id) || '';
    for (const match of exactEmployerEvidence(tag)) {
      const ids = employerTagEvidence.get(match.canonical) || new Set<string>();
      ids.add(link.founder_id);
      employerTagEvidence.set(match.canonical, ids);
    }
    for (const match of exactInstitutionEvidence(tag)) {
      const ids =
        institutionTagEvidence.get(match.canonical) || new Set<string>();
      ids.add(link.founder_id);
      institutionTagEvidence.set(match.canonical, ids);
    }
  }
  const coverage: Record<string, unknown> = {};

  for (const canonical of KNOWN_COMPANIES) {
    const aliases = new Set(companyAliases(canonical).map(normalizeRuleText));
    const structured = new Set<string>(
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
    const tagEvidence = employerTagEvidence.get(canonical) || new Set<string>();
    const rawEvidence = new Set<string>(
      proposed.employers
        .filter((item) => item.company === canonical)
        .map((item) => item.founder_id),
    );
    const exact = new Set<string>(
      Array.from(structured).concat(
        Array.from(tagEvidence),
        Array.from(rawEvidence),
      ),
    );
    const parent = EMPLOYER_PARENT[canonical];
    const broad = new Set<string>(
      parent
        ? flags
            .filter((row) => row[parent] === true)
            .map((row) => row.founder_id)
        : [],
    );
    coverage[canonical] = {
      structured_history: structured.size,
      tags_only: difference(tagEvidence, structured, rawEvidence).size,
      raw_only: difference(rawEvidence, structured, tagEvidence).size,
      exact_evidence_total: exact.size,
      broad_flag_only_no_exact: difference(broad, exact).size,
    };
  }

  for (const canonical of KNOWN_INSTITUTIONS) {
    const aliases = new Set(
      institutionAliases(canonical).map(normalizeRuleText),
    );
    const directTagEvidence = new Set<string>(
      founderTags
        .filter((link) =>
          aliases.has(normalizeRuleText(tagById.get(link.tag_id) || '')),
        )
        .map((link) => link.founder_id),
    );
    const tagEvidence = new Set<string>(
      Array.from(directTagEvidence).concat(
        Array.from(institutionTagEvidence.get(canonical) || []),
      ),
    );
    const rawEvidence = new Set<string>(
      proposed.institutions
        .filter((item) => item.institution === canonical)
        .map((item) => item.founder_id),
    );
    const exact = new Set<string>(
      Array.from(tagEvidence).concat(Array.from(rawEvidence)),
    );
    const parent = INSTITUTION_PARENT[canonical];
    const broad = new Set<string>(
      parent
        ? flags
            .filter((row) => row[parent] === true)
            .map((row) => row.founder_id)
        : [],
    );
    coverage[canonical] = {
      structured_history: 0,
      tags_only: difference(tagEvidence, rawEvidence).size,
      raw_only: difference(rawEvidence, tagEvidence).size,
      exact_evidence_total: exact.size,
      broad_flag_only_no_exact: difference(broad, exact).size,
    };
  }

  const provenanceSummary: Record<string, number> = {};
  for (const row of provenance) {
    if (!/career|history|tag|education/i.test(row.field_name || '')) continue;
    const key = `${row.field_name}:${row.value_source}`;
    provenanceSummary[key] = (provenanceSummary[key] || 0) + 1;
  }
  console.log(
    JSON.stringify(
      { coverage, provenance_summary: provenanceSummary },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
