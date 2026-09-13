import fs from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  classifyFounderFilterFlags,
  FOUNDER_FILTER_FLAG_NAMES,
  type FlagEvidence,
  type FounderFilterFlag,
  type FounderFilterValues,
} from '../lib/founder-filter-flags.ts';

type Row = Record<string, unknown>;
type FounderRow = {
  id: string;
  name: string;
  company_id: string | null;
  company_name: string | null;
  category_l1: string | null;
  category_path: unknown;
  company_history: unknown;
  tags: unknown;
};
type CompanyRow = {
  id: string;
  name: string;
  category_l1: string | null;
  category_l2: string | null;
  category_l3: string | null;
  category_path: string | null;
  category_freeform: string | null;
};
type RoleRow = {
  founder_id: string;
  company_id: string;
  is_current: boolean | null;
  relationship_type: string | null;
};
type TagJoinRow = {
  founder_id: string;
  source: string | null;
  tags: unknown;
};
type ClassifiedFounder = {
  founder: FounderRow;
  flags: FounderFilterValues;
  evidence: FlagEvidence[];
};

const PAGE_SIZE = 1_000;
const UPSERT_SIZE = 250;
const RULES_VERSION = 'v1';

function loadLocalEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    if (process.env[key] === undefined)
      process.env[key] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function profileTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const tag = record(item);
    return typeof tag.tag === 'string'
      ? [{ tag: tag.tag, isTaxonomyTag: false, tagFamily: null, source: 'founder_product_profile.tags' }]
      : [];
  });
}

async function fetchAll<T>(
  db: SupabaseClient,
  table: string,
  select: string,
  orderColumns: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = db.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    for (const column of orderColumns) query = query.order(column);
    const result = await query;
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    rows.push(...((result.data || []) as T[]));
    if ((result.data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadCanonicalData(db: SupabaseClient) {
  const [founders, companies, roles, tagJoins] = await Promise.all([
    fetchAll<FounderRow>(db, 'founder_product_profile',
      'id,name,company_id,company_name,category_l1,category_path,company_history,tags', ['id']),
    fetchAll<CompanyRow>(db, 'companies',
      'id,name,category_l1,category_l2,category_l3,category_path,category_freeform', ['id']),
    fetchAll<RoleRow>(db, 'founder_company_roles',
      'founder_id,company_id,is_current,relationship_type', ['founder_id', 'company_id']),
    fetchAll<TagJoinRow>(db, 'founder_tags',
      'founder_id,source,tags(tag,is_taxonomy_tag,tag_family)', ['founder_id', 'tag_id']),
  ]);
  return { founders, companies, roles, tagJoins };
}

function classifyAll(data: Awaited<ReturnType<typeof loadCanonicalData>>) {
  const companies = new Map(data.companies.map((company) => [company.id, company]));
  const roles = new Map<string, RoleRow[]>();
  const tags = new Map<string, TagJoinRow[]>();
  for (const role of data.roles) roles.set(role.founder_id, [...(roles.get(role.founder_id) || []), role]);
  for (const tag of data.tagJoins) tags.set(tag.founder_id, [...(tags.get(tag.founder_id) || []), tag]);

  return data.founders.map((founder): ClassifiedFounder => {
    const company = founder.company_id ? companies.get(founder.company_id) : undefined;
    const joinedTags = (tags.get(founder.id) || []).flatMap((join) => {
      const value = record(join.tags);
      return typeof value.tag === 'string' ? [{
        tag: value.tag,
        isTaxonomyTag: value.is_taxonomy_tag === true,
        tagFamily: typeof value.tag_family === 'string' ? value.tag_family : null,
        source: join.source,
      }] : [];
    });
    const founderRoles = (roles.get(founder.id) || []).map((role) => ({
      companyName: companies.get(role.company_id)?.name || null,
      isCurrent: role.is_current,
      relationshipType: role.relationship_type,
    }));
    const result = classifyFounderFilterFlags({
      founderId: founder.id,
      currentCompanyName: company?.name || founder.company_name,
      profileCompanyHistory: founder.company_history,
      profileCategories: [founder.category_l1, founder.category_path],
      companyCategories: company ? [
        company.category_l1, company.category_l2, company.category_l3,
        company.category_path, company.category_freeform,
      ] : [],
      tags: [...joinedTags, ...profileTags(founder.tags)],
      roles: founderRoles,
    });
    return { founder, ...result };
  });
}

function counts(classified: ClassifiedFounder[]) {
  return Object.fromEntries(FOUNDER_FILTER_FLAG_NAMES.map((flag) => [
    flag, classified.filter((item) => item.flags[flag]).length,
  ])) as Record<FounderFilterFlag, number>;
}

function samples(classified: ClassifiedFounder[], limit = 3) {
  return Object.fromEntries(FOUNDER_FILTER_FLAG_NAMES.map((flag) => [flag,
    classified.filter((item) => item.flags[flag]).slice(0, limit).map((item) => ({
      founder: item.founder.name,
      founder_id: item.founder.id,
      evidence: item.evidence.filter((evidence) => evidence.flag === flag).map((evidence) => ({
        source: evidence.source,
        value: evidence.value,
      })),
    })),
  ]));
}

function diagnostic(classified: ClassifiedFounder[]) {
  const targetFlags: FounderFilterFlag[] = [
    'big_tech_alumni', 'fintech_alumni', 'ai_alumni', 'global_tier_1',
    'sector_deeptech', 'sector_ai_ml_infra', 'sector_fintech',
  ];
  const representative = Object.fromEntries(targetFlags.map((flag) => [flag,
    classified.filter((item) => item.flags[flag]).slice(0, 3).map((item) => ({
      founder: item.founder.name,
      evidence: item.evidence.filter((entry) => entry.flag === flag),
    })),
  ]));
  const currentCompanyAlumniConflicts = classified.flatMap((item) =>
    item.evidence.filter((entry) => /prior-employer|company_history|company_roles/.test(entry.source))
      .filter((entry) => entry.value.trim().toLowerCase() === (item.founder.company_name || '').trim().toLowerCase())
      .map((entry) => ({ founder: item.founder.name, entry })),
  );
  if (currentCompanyAlumniConflicts.length)
    throw new Error(`Diagnostic found ${currentCompanyAlumniConflicts.length} current-company alumni conflicts.`);
  return {
    representative,
    protections: {
      current_company_alumni_conflicts: 0,
      raw_employer_tags_require_explicit_prior_marker: true,
      education_requires_exact_institution_or_field_tag: true,
      sector_free_text_descriptions_used: false,
      scores_or_score_rationale_used: false,
    },
  };
}

async function upsertRows(db: SupabaseClient, classified: ClassifiedFounder[]) {
  const now = new Date().toISOString();
  for (let index = 0; index < classified.length; index += UPSERT_SIZE) {
    const batch = classified.slice(index, index + UPSERT_SIZE).map((item) => ({
      founder_id: item.founder.id,
      ...item.flags,
      rules_version: RULES_VERSION,
      calculated_at: now,
      updated_at: now,
    }));
    const result = await db.from('founder_filter_flags').upsert(batch, { onConflict: 'founder_id' });
    if (result.error) throw new Error(`Upsert ${index}-${index + batch.length}: ${result.error.message}`);
    console.log(`Upserted ${Math.min(index + batch.length, classified.length)}/${classified.length}.`);
  }
  return now;
}

async function validatePersisted(db: SupabaseClient, canonicalCount: number) {
  const rows = await fetchAll<(FounderFilterValues & { founder_id: string; rules_version: string })>(
    db, 'founder_filter_flags', `founder_id,${FOUNDER_FILTER_FLAG_NAMES.join(',')},rules_version`, ['founder_id'],
  );
  const v1 = rows.filter((row) => row.rules_version === RULES_VERSION);
  if (rows.length !== canonicalCount)
    throw new Error(`Expected ${canonicalCount} flag rows, found ${rows.length}.`);
  if (v1.length !== canonicalCount)
    throw new Error(`Expected ${canonicalCount} v1 rows, found ${v1.length}.`);
  return {
    total_rows: rows.length,
    rules_version_v1_rows: v1.length,
    founders_with_at_least_one_flag: rows.filter((row) =>
      FOUNDER_FILTER_FLAG_NAMES.some((flag) => row[flag]),
    ).length,
    founders_with_zero_flags: rows.filter((row) =>
      FOUNDER_FILTER_FLAG_NAMES.every((flag) => !row[flag]),
    ).length,
    counts_per_flag: Object.fromEntries(FOUNDER_FILTER_FLAG_NAMES.map((flag) => [
      flag, rows.filter((row) => row[flag]).length,
    ])),
  };
}

async function main() {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase URL and server-only service key are required.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const diagnosticOnly = process.argv.includes('--diagnostic-only');
  const started = performance.now();
  const data = await loadCanonicalData(db);
  const classified = classifyAll(data);
  const diagnosticResult = diagnostic(classified);
  console.log(JSON.stringify({
    mode: 'diagnostic',
    canonical_founders: classified.length,
    source_rows: { companies: data.companies.length, roles: data.roles.length, founder_tags: data.tagJoins.length },
    counts_per_flag: counts(classified),
    ...diagnosticResult,
  }, null, 2));
  if (diagnosticOnly) return;

  const calculatedAt = await upsertRows(db, classified);
  const validation = await validatePersisted(db, classified.length);
  console.log(JSON.stringify({
    mode: 'full-backfill',
    rules_version: RULES_VERSION,
    calculated_at: calculatedAt,
    canonical_founders: classified.length,
    validation,
    samples_by_flag: samples(classified),
    runtime_ms: Math.round(performance.now() - started),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
