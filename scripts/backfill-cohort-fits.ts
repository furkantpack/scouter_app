import fs from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { loadScouterCohortProfile } from '../lib/cohort-engine/profile-mapper.ts';
import { runCohortEngine } from '../lib/cohort-engine/runner.ts';
import type { CohortEngineResult, CurrentProgramFit } from '../lib/cohort-engine/types.ts';

type FailureStage = 'fetch' | 'mapping' | 'Python execution' | 'validation' | 'persistence';
type FounderRow = { id: string; name: string; scouter_score: number | null };
type Failure = { founder_id: string; founder_name: string; stage: FailureStage; message: string };

const PAGE_SIZE = 100;
const VALIDATION_PAGE_SIZE = 1_000;
const DEFAULT_CONCURRENCY = 2;
const EXPECTED_PROGRAM_COUNT = 21;

function loadLocalEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index);
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '');
  }
}

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function shortError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function persistableRows(
  founderId: string,
  companyId: string | null,
  result: CohortEngineResult,
) {
  const calculatedAt = new Date().toISOString();
  return result.current_program_ranking.map((row) => ({
    founder_id: founderId,
    company_id: companyId,
    program_id: row.program_id,
    program_name: row.program,
    fit_score: row.current_program_fit,
    fit_band: row.fit_band,
    historical_fit: row.historical_latest_cohort_fit,
    intent_fit: row.current_intent_fit,
    market_fit: row.market_regime_fit,
    overall_confidence: row.overall_confidence,
    evidence_confidence: row.evidence_confidence,
    component_scores: row.historical_component_scores,
    top_matches: {
      historical: row.historical_top_matches,
      current_intent: row.intent_top_matches || [],
    },
    top_gaps: {
      historical: row.historical_top_gaps,
      current_intent: row.intent_top_gaps || [],
    },
    warnings: unique([
      ...result.verification.warnings,
      ...row.verification_warnings,
    ]),
    sources: row.sources,
    engine_version: result.version,
    engine_as_of: result.as_of,
    calculated_at: calculatedAt,
    is_current: true,
  }));
}

function validateResult(result: CohortEngineResult) {
  const rows = result.current_program_ranking;
  if (!rows.length) throw new Error('Engine returned no current program fits.');
  if (rows.length !== EXPECTED_PROGRAM_COUNT)
    throw new Error(`Engine returned ${rows.length}/${EXPECTED_PROGRAM_COUNT} current program fits.`);
  const ids = rows.map((row) => row.program_id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
    throw new Error('Engine returned missing or duplicate program IDs.');
  if (rows.some((row) => row.current_program_fit < 0 || row.current_program_fit > 100))
    throw new Error('Engine returned a fit outside 0–100.');
}

async function replaceFounderRows(
  db: SupabaseClient,
  founderId: string,
  rows: ReturnType<typeof persistableRows>,
) {
  const result = await db.rpc('replace_founder_program_fits', {
    p_founder_id: founderId,
    p_rows: rows,
  });
  if (result.error) throw result.error;
  if (Number(result.data) !== rows.length)
    throw new Error(`Atomic persistence inserted ${result.data ?? 0}/${rows.length} rows.`);
}

async function processFounder(
  db: SupabaseClient,
  founder: FounderRow,
  dryRun: boolean,
): Promise<{ ok: true; durationMs: number; programs: number } | { ok: false; failure: Failure }> {
  const started = performance.now();
  let stage: FailureStage = 'fetch';
  try {
    stage = 'mapping';
    const mapped = await loadScouterCohortProfile(db, founder.id);
    if (!mapped) throw new Error('Canonical founder was not found.');
    stage = 'Python execution';
    const result = await runCohortEngine(mapped.profile);
    stage = 'validation';
    validateResult(result);
    const rows = persistableRows(founder.id, mapped.companyId, result);
    if (!dryRun) {
      stage = 'persistence';
      await replaceFounderRows(db, founder.id, rows);
    }
    return { ok: true, durationMs: performance.now() - started, programs: rows.length };
  } catch (error) {
    return {
      ok: false,
      failure: {
        founder_id: founder.id,
        founder_name: founder.name,
        stage,
        message: shortError(error),
      },
    };
  }
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

async function fetchFounderPage(db: SupabaseClient, from: number, limit: number) {
  const result = await db
    .from('founder_product_profile')
    .select('id,name,scouter_score')
    .order('id')
    .range(from, from + limit - 1);
  if (result.error) throw result.error;
  return (result.data || []) as FounderRow[];
}

async function runRange(
  db: SupabaseClient,
  limit: number | null,
  concurrency: number,
  dryRun: boolean,
) {
  let offset = 0;
  let succeeded = 0;
  let programRows = 0;
  let durationTotal = 0;
  const failures: Failure[] = [];
  while (limit === null || offset < limit) {
    const pageLimit = limit === null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - offset);
    const founders = await fetchFounderPage(db, offset, pageLimit);
    if (!founders.length) break;
    const results = await mapConcurrent(founders, concurrency, (founder) =>
      processFounder(db, founder, dryRun),
    );
    for (const result of results) {
      if (result.ok) {
        succeeded += 1;
        programRows += result.programs;
        durationTotal += result.durationMs;
      } else failures.push(result.failure);
    }
    offset += founders.length;
    console.log(`Progress: ${offset} founders read, ${succeeded} scored, ${failures.length} failed.`);
    if (founders.length < pageLimit) break;
  }
  return { foundersRead: offset, succeeded, programRows, durationTotal, failures };
}

type CurrentFit = { founder_id: string; program_id: string; program_name: string; fit_score: number; engine_version: string | null; calculated_at: string | null };

async function validation(db: SupabaseClient) {
  const founderCountResult = await db.from('founder_product_profile').select('*', { count: 'exact', head: true });
  if (founderCountResult.error) throw founderCountResult.error;
  const rows: CurrentFit[] = [];
  for (let offset = 0; ; offset += VALIDATION_PAGE_SIZE) {
    const result = await db
      .from('founder_program_fits')
      .select('founder_id,program_id,program_name,fit_score,engine_version,calculated_at')
      .eq('is_current', true)
      .order('founder_id')
      .range(offset, offset + VALIDATION_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    rows.push(...((result.data || []) as CurrentFit[]));
    if ((result.data || []).length < VALIDATION_PAGE_SIZE) break;
  }
  const duplicateKeys = new Map<string, number>();
  const rowsPerFounder = new Map<string, number>();
  const programs = new Map<string, { name: string; count: number; sum: number; over90: number; over85: number }>();
  for (const row of rows) {
    const key = `${row.founder_id}|${row.program_id}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
    rowsPerFounder.set(row.founder_id, (rowsPerFounder.get(row.founder_id) || 0) + 1);
    const program = programs.get(row.program_id) || { name: row.program_name, count: 0, sum: 0, over90: 0, over85: 0 };
    program.count += 1;
    program.sum += Number(row.fit_score);
    if (row.fit_score >= 90) program.over90 += 1;
    if (row.fit_score >= 85) program.over85 += 1;
    programs.set(row.program_id, program);
  }
  const distribution = Array.from(programs, ([program_id, value]) => ({
    program_id,
    program_name: value.name,
    current_rows: value.count,
    fit_gte_90: value.over90,
    fit_gte_85: value.over85,
    average_fit: value.count ? Number((value.sum / value.count).toFixed(2)) : 0,
  }));
  const founderRowCounts = Array.from(rowsPerFounder.values());
  return {
    canonical_founder_count: founderCountResult.count || 0,
    total_current_program_fit_rows: rows.length,
    distinct_founders_with_current_fits: new Set(rows.map((row) => row.founder_id)).size,
    distinct_program_ids: programs.size,
    expected_program_count: EXPECTED_PROGRAM_COUNT,
    min_fit_score: rows.length ? Math.min(...rows.map((row) => Number(row.fit_score))) : null,
    max_fit_score: rows.length ? Math.max(...rows.map((row) => Number(row.fit_score))) : null,
    average_fit_score: rows.length ? Number((rows.reduce((sum, row) => sum + Number(row.fit_score), 0) / rows.length).toFixed(2)) : null,
    duplicate_current_rows: Array.from(duplicateKeys.values()).filter((count) => count > 1).length,
    min_current_program_rows_per_scored_founder: founderRowCounts.length ? Math.min(...founderRowCounts) : null,
    max_current_program_rows_per_scored_founder: founderRowCounts.length ? Math.max(...founderRowCounts) : null,
    founders_with_21_current_rows: founderRowCounts.filter((count) => count === EXPECTED_PROGRAM_COUNT).length,
    founders_with_fewer_than_21_current_rows: founderRowCounts.filter((count) => count < EXPECTED_PROGRAM_COUNT).length,
    invalid_score_rows: rows.filter((row) => row.fit_score < 0 || row.fit_score > 100).length,
    missing_required_metadata_rows: rows.filter((row) => !row.engine_version || !row.calculated_at || !row.program_id || !row.program_name).length,
    rows_by_program: distribution.sort((a, b) => a.program_id.localeCompare(b.program_id)),
    top10_fit_gte_90: [...distribution].sort((a, b) => b.fit_gte_90 - a.fit_gte_90).slice(0, 10),
    top10_fit_gte_85: [...distribution].sort((a, b) => b.fit_gte_85 - a.fit_gte_85).slice(0, 10),
    top10_average_fit: [...distribution].sort((a, b) => b.average_fit - a.average_fit).slice(0, 10),
  };
}

async function sampleFounders(db: SupabaseClient) {
  const morgan = await db.from('founder_product_profile').select('id,name,scouter_score').eq('name', 'Morgan Brewster').limit(1);
  const others = await db.from('founder_product_profile').select('id,name,scouter_score').order('scouter_score', { ascending: false, nullsFirst: false }).limit(5);
  if (morgan.error || others.error) throw morgan.error || others.error;
  const founders = Array.from(new Map([...(morgan.data || []), ...(others.data || [])].map((row) => [row.id, row])).values()).slice(0, 5) as FounderRow[];
  const ids = founders.map((founder) => founder.id);
  const fits = await db.from('founder_program_fits').select('founder_id,program_name,fit_score').eq('is_current', true).in('founder_id', ids).order('fit_score', { ascending: false });
  if (fits.error) throw fits.error;
  return founders.map((founder) => ({
    founder: founder.name,
    founder_id: founder.id,
    scouter_score: founder.scouter_score,
    top_5_program_fits: (fits.data || []).filter((fit) => fit.founder_id === founder.id).slice(0, 5),
  }));
}

async function main() {
  loadLocalEnv();
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run backfill:cohort-fits -- --pilot=10 [--continue-all] [--dry-run] [--concurrency=2]');
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const key = serviceKey || (dryRun ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);
  if (!url || !key)
    throw new Error(
      dryRun
        ? 'Supabase URL and anon key are required for a dry run.'
        : 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required.',
    );
  const concurrency = Math.max(1, Math.min(4, Number(option('concurrency') || DEFAULT_CONCURRENCY)));
  const pilot = Math.max(1, Number(option('pilot') || 10));
  const continueAll = process.argv.includes('--continue-all');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const started = performance.now();

  console.log(`Pilot: ${pilot} founders, concurrency ${concurrency}, dry-run ${dryRun}.`);
  const pilotResult = await runRange(db, pilot, concurrency, dryRun);
  console.log(JSON.stringify({ pilot: pilotResult }, null, 2));
  const blockingPilotFailures = pilotResult.failures.filter(
    (failure) => !failure.message.includes('Profile contains no scoreable information.'),
  );
  if (blockingPilotFailures.length)
    throw new Error('Pilot failed; full backfill was not started.');

  let fullResult = pilotResult;
  if (continueAll && !dryRun) {
    console.log('Pilot clean. Starting full backfill.');
    fullResult = await runRange(db, null, concurrency, false);
  }

  const checks = dryRun ? null : await validation(db);
  const samples = dryRun ? null : await sampleFounders(db);
  const totalDurationMs = Math.round(performance.now() - started);
  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : continueAll ? 'pilot+full' : 'pilot',
    founders_successfully_scored: fullResult.succeeded,
    founders_failed: fullResult.failures.length,
    failures: fullResult.failures,
    total_batch_duration_ms: totalDurationMs,
    average_founder_processing_ms: fullResult.succeeded ? Math.round(fullResult.durationTotal / fullResult.succeeded) : null,
    python_process_strategy: 'one fixed local Python process per founder, bounded by worker concurrency',
    concurrency,
    validation: checks,
    sample_founders: samples,
  }, null, 2));
}

main().catch((error) => {
  console.error(`Cohort backfill failed: ${shortError(error)}`);
  process.exitCode = 1;
});
