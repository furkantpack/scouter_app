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

type RawRow = {
  id: string;
  canonical_founder_id: string | null;
  raw_json: unknown;
};

type ProposedEmployer = {
  founder_id: string;
  company: string;
  source_row_id: string;
  source_field: string;
  evidence: string;
};

type ProposedInstitution = {
  founder_id: string;
  institution: string;
  source_row_id: string;
  source_field: string;
  evidence: string;
};

const RAW_CAREER_FIELDS = [
  'Mini LinkedIn / Kariyer Geçmişi',
  'Uzmanlık / Pattern Etiketleri',
  'Neden Takıldı Etiketleri',
  'Neden takıldı',
];

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

function parseRaw(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function evidencePreview(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function proposedExactEntityBackfill(rawRows: RawRow[]) {
  const employers = new Map<string, ProposedEmployer>();
  const institutions = new Map<string, ProposedInstitution>();
  for (const row of rawRows) {
    if (!row.canonical_founder_id) continue;
    const raw = parseRaw(row.raw_json);
    if (!raw) continue;
    for (const field of RAW_CAREER_FIELDS) {
      const value = raw[field];
      if (typeof value !== 'string') continue;
      for (const match of exactEmployerEvidence(value)) {
        const key = `${row.canonical_founder_id}:${match.canonical}`;
        if (!employers.has(key)) {
          employers.set(key, {
            founder_id: row.canonical_founder_id,
            company: match.canonical,
            source_row_id: row.id,
            source_field: field,
            evidence: evidencePreview(value),
          });
        }
      }
      for (const match of exactInstitutionEvidence(value)) {
        const key = `${row.canonical_founder_id}:${match.canonical}`;
        if (!institutions.has(key)) {
          institutions.set(key, {
            founder_id: row.canonical_founder_id,
            institution: match.canonical,
            source_row_id: row.id,
            source_field: field,
            evidence: evidencePreview(value),
          });
        }
      }
    }
  }
  return {
    employers: Array.from(employers.values()),
    institutions: Array.from(institutions.values()),
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const apply = process.argv.includes('--apply');
  const rawRows = await fetchAll<RawRow>(
    db,
    'raw_master_rows',
    'id,canonical_founder_id,raw_json',
  );
  const proposed = proposedExactEntityBackfill(rawRows);

  const companies = await fetchAll<{ id: string; name: string }>(
    db,
    'companies',
    'id,name',
  );
  const roles = await fetchAll<{
    founder_id: string;
    company_id: string;
    is_current: boolean;
  }>(db, 'founder_company_roles', 'founder_id,company_id,is_current');
  const companyByCanonical = new Map<string, string>();
  for (const canonical of KNOWN_COMPANIES) {
    const aliases = new Set(companyAliases(canonical).map(normalizeRuleText));
    const found = companies.find((company) =>
      aliases.has(normalizeRuleText(company.name)),
    );
    if (found) companyByCanonical.set(canonical, found.id);
  }
  const existingRoles = new Set(
    roles
      .filter((role) => !role.is_current)
      .map((role) => `${role.founder_id}:${role.company_id}`),
  );
  const employerInserts = proposed.employers.filter((item) => {
    const companyId = companyByCanonical.get(item.company);
    return !companyId || !existingRoles.has(`${item.founder_id}:${companyId}`);
  });

  const tagRows = await fetchAll<{ id: string; tag: string }>(
    db,
    'tags',
    'id,tag',
  );
  const founderTags = await fetchAll<{ founder_id: string; tag_id: string }>(
    db,
    'founder_tags',
    'founder_id,tag_id',
  );
  const tagByInstitution = new Map<string, string>();
  const existingInstitutionFounders = new Map<string, Set<string>>();
  for (const canonical of KNOWN_INSTITUTIONS) {
    const aliases = new Set(
      institutionAliases(canonical).map(normalizeRuleText),
    );
    const matchingTags = tagRows.filter((tag) =>
      aliases.has(normalizeRuleText(tag.tag)),
    );
    const found = matchingTags[0];
    if (found) tagByInstitution.set(canonical, found.id);
    const matchingTagIds = new Set(matchingTags.map((tag) => tag.id));
    existingInstitutionFounders.set(
      canonical,
      new Set(
        founderTags
          .filter((item) => matchingTagIds.has(item.tag_id))
          .map((item) => item.founder_id),
      ),
    );
  }
  const existingFounderTags = new Set(
    founderTags.map((item) => `${item.founder_id}:${item.tag_id}`),
  );
  const institutionInserts = proposed.institutions.filter((item) => {
    return !existingInstitutionFounders
      .get(item.institution)
      ?.has(item.founder_id);
  });

  const founders = await fetchAll<{ id: string; name: string }>(
    db,
    'founders',
    'id,name',
  );
  const founderNames = new Map(
    founders.map((founder) => [founder.id, founder.name]),
  );
  const summarize = <T extends { founder_id: string }>(
    items: T[],
    entity: (item: T) => string,
  ) =>
    Object.fromEntries(
      Array.from(new Set(items.map(entity)))
        .sort()
        .map((name) => [
          name,
          items
            .filter((item) => entity(item) === name)
            .map((item) => founderNames.get(item.founder_id) || item.founder_id)
            .sort(),
        ]),
    );

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    raw_rows_scanned: rawRows.length,
    proposed_employer_role_count: employerInserts.length,
    proposed_employer_roles: summarize(employerInserts, (item) => item.company),
    proposed_institution_tag_count: institutionInserts.length,
    proposed_institution_tags: summarize(
      institutionInserts,
      (item) => item.institution,
    ),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;

  for (const item of employerInserts) {
    let companyId = companyByCanonical.get(item.company);
    if (!companyId) {
      const inserted = await db
        .from('companies')
        .insert({
          name: item.company,
          company_key_type: 'name',
          source_row_count: employerInserts.filter(
            (candidate) => candidate.company === item.company,
          ).length,
          primary_source_row_id: item.source_row_id,
          is_stealth_placeholder: false,
        })
        .select('id')
        .single();
      if (inserted.error) throw inserted.error;
      const insertedCompanyId = inserted.data?.id as string | undefined;
      if (!insertedCompanyId)
        throw new Error(`Could not create ${item.company}`);
      companyId = insertedCompanyId;
      companyByCanonical.set(item.company, insertedCompanyId);
    }
    if (!companyId) throw new Error(`Could not resolve ${item.company}`);
    if (existingRoles.has(`${item.founder_id}:${companyId}`)) continue;
    const inserted = await db.from('founder_company_roles').insert({
      founder_id: item.founder_id,
      company_id: companyId,
      relationship_type: 'employee',
      is_current: false,
      source_row_id: item.source_row_id,
      confidence: 'High',
      notes: `Exact persisted evidence: raw_master_rows.${item.source_field}`,
    });
    if (inserted.error) throw inserted.error;
    existingRoles.add(`${item.founder_id}:${companyId}`);
  }

  for (const item of institutionInserts) {
    let tagId = tagByInstitution.get(item.institution);
    if (!tagId) {
      const inserted = await db
        .from('tags')
        .insert({
          tag: item.institution,
          is_taxonomy_tag: true,
          tag_family: 'Education',
        })
        .select('id')
        .single();
      if (inserted.error) throw inserted.error;
      const insertedTagId = inserted.data?.id as string | undefined;
      if (!insertedTagId)
        throw new Error(`Could not create ${item.institution} tag`);
      tagId = insertedTagId;
      tagByInstitution.set(item.institution, insertedTagId);
    }
    if (!tagId) throw new Error(`Could not resolve ${item.institution}`);
    if (existingFounderTags.has(`${item.founder_id}:${tagId}`)) continue;
    const inserted = await db.from('founder_tags').insert({
      founder_id: item.founder_id,
      tag_id: tagId,
      tag_type: 'pattern',
      source: `raw_master_rows:${item.source_row_id}:${item.source_field}`,
      confidence: 'High',
    });
    if (inserted.error) throw inserted.error;
    existingFounderTags.add(`${item.founder_id}:${tagId}`);
    const institutionFounders =
      existingInstitutionFounders.get(item.institution) || new Set<string>();
    institutionFounders.add(item.founder_id);
    existingInstitutionFounders.set(item.institution, institutionFounders);
  }
}

const isDirectRun = process.argv[1]
  ?.replace(/\\/g, '/')
  .endsWith('/backfill-founder-exact-entities.ts');
if (isDirectRun) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
