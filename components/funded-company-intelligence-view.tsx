'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiBuildingLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiFileChartLine,
  RiFlashlightLine,
  RiGroupLine,
  RiPulseLine,
} from '@remixicon/react';

import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';

type JsonRecord = Record<string, unknown>;
type Company = {
  id: string;
  thesisId: string;
  investorName: string;
  name: string;
  companyUrl: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  geography: string | null;
  investmentTiming: string | null;
  investmentAmount: string | null;
  sourceUrl: string;
  founders: string[];
  founderPattern: string | null;
};
type Analysis = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  original_wedge_json: JsonRecord;
  founder_dna_json: JsonRecord;
  investor_pattern_json: JsonRecord;
  customer_pattern_json: JsonRecord;
  category_evolution_json: JsonRecord;
  value_chain_json: JsonRecord;
  maturity_map_json: JsonRecord;
  historical_validators_json: JsonRecord[];
  missing_layers_json: JsonRecord[];
  final_insight_json: JsonRecord;
  provider_status: JsonRecord;
  error: string | null;
  report_markdown: string | null;
};
type Candidate = {
  id: string;
  founder_id: string | null;
  external_identity: JsonRecord | null;
  founder_name: string;
  company_name: string | null;
  current_role: string | null;
  source: string;
  founder_state: string;
  pattern_branch: string | null;
  historical_comparable: string | null;
  pattern_match_score: number;
  component_scores: JsonRecord;
  verification_confidence: number;
  scouter_score: number | null;
  why_now: string;
  visibility: string;
  evidence: JsonRecord[];
  red_flags: string[];
  rank: number;
};
type Signal = {
  id: string;
  signal_type: string;
  signal_date: string | null;
  explanation: string;
  why_it_matters: string;
  source_url: string;
};
type Response = {
  company: Company;
  analysis: Analysis | null;
  candidates: Candidate[];
  signals: Signal[];
  migrationRequired?: boolean;
};
type InstantProfile = {
  sector: string | null;
  subcategory: string | null;
  business_model: string | null;
  customer_type: string | null;
  product_type: string | null;
  technology_themes: string[];
  market_problem_themes: string[];
  workflow_themes: string[];
  geography: string | null;
  stage: string | null;
  company_maturity: string | null;
  vertical: string | null;
  enterprise_orientation: string | null;
  system_orientation: string | null;
  founder_archetype: string | null;
  software_orientation: string | null;
  reference_tags: Array<{
    label: string;
    dimension: string;
    weight: number;
  }>;
};
type InstantMatch = {
  founder_id: string;
  company_id: string | null;
  founder_name: string;
  company_name: string | null;
  current_state: string;
  scouter_score: number | null;
  instant_match_score: number;
  shared_tags: string[];
  strongest_dimensions: string[];
  why_matched: string;
  visibility: string;
  source: 'scouter_db';
};
type InstantResponse = {
  profile: InstantProfile | null;
  matches: InstantMatch[];
  count: number;
  persisted: boolean;
  needsRefresh?: boolean;
  migrationRequired?: boolean;
};

const text = (
  record: JsonRecord | null | undefined,
  keys: string[],
  fallback = 'Not enough verified evidence yet.',
) => {
  for (const key of keys)
    if (typeof record?.[key] === 'string' && String(record[key]).trim())
      return String(record[key]);
  return fallback;
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
        new Date(value),
      )
    : 'Date not verified';

export function FundedCompanyIntelligenceView({ id }: { id: string }) {
  const {
    data,
    error: loadError,
    loading,
    reload,
  } = useProductData<Response>(`/api/funded/${id}`);
  const instant = useProductData<InstantResponse>(`/api/funded/${id}/instant`);
  const instantRefreshAttempt = useRef<string | null>(null);
  const [instantRefreshing, setInstantRefreshing] = useState(false);
  const [instantRefreshError, setInstantRefreshError] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [instantSelected, setInstantSelected] = useState<InstantMatch | null>(
    null,
  );
  const analysis = data?.analysis;
  const processing =
    analysis?.status === 'queued' || analysis?.status === 'running';

  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [processing, reload]);

  useEffect(() => {
    if (
      !instant.data?.needsRefresh ||
      instant.data.migrationRequired ||
      instantRefreshAttempt.current === id
    )
      return;
    instantRefreshAttempt.current = id;
    setInstantRefreshing(true);
    setInstantRefreshError('');
    void requestJson<InstantResponse>(`/api/funded/${id}/instant`, {
      method: 'POST',
    })
      .then(() => instant.reload())
      .catch((cause) =>
        setInstantRefreshError(
          cause instanceof Error
            ? cause.message
            : 'Internal reference profile could not be refreshed.',
        ),
      )
      .finally(() => setInstantRefreshing(false));
  }, [
    id,
    instant.data?.migrationRequired,
    instant.data?.needsRefresh,
    instant.reload,
  ]);

  async function analyze() {
    if (pending || data?.migrationRequired) return;
    setPending(true);
    setError('');
    try {
      await requestJson(`/api/funded/${id}`, { method: 'POST' });
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Analysis could not be started.',
      );
    } finally {
      setPending(false);
    }
  }

  if (loading && !data)
    return (
      <div className='p-8 text-paragraph-sm text-text-sub-600'>
        Loading investment context…
      </div>
    );
  if (loadError && !data)
    return (
      <div
        role='alert'
        className='m-6 rounded-2xl bg-error-lighter p-5 text-error-base'
      >
        {loadError}
      </div>
    );
  if (!data) return null;
  const company = data.company;
  const candidates = data.candidates || [];
  const strongest = candidates[0];
  const highConviction = candidates.filter(
    (candidate) => Number(candidate.pattern_match_score) >= 85,
  ).length;
  const evolution = analysis?.category_evolution_json;

  return (
    <div className='min-h-full bg-bg-white-0 pb-12'>
      <div className='px-4 lg:px-8'>
        <section className='border-b border-stroke-soft-200 pb-7 pt-7'>
          <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
            <Link
              href='/funded'
              className='inline-flex items-center gap-2 text-label-sm text-text-sub-600 hover:text-primary-base'
            >
              <RiArrowLeftLine className='size-4' />
              Back to Funded
            </Link>
            {analysis &&
              (analysis.status === 'completed' ||
                analysis.status === 'partial') && (
                <a
                  href={`/api/funded/${id}/report`}
                  className='inline-flex items-center gap-2 rounded-10 bg-bg-white-0 px-3.5 py-2 text-label-sm text-text-strong-950 shadow-xs ring-1 ring-inset ring-stroke-soft-200'
                >
                  <RiDownloadLine className='size-4 text-primary-base' />
                  Detail Report
                </a>
              )}
          </div>
          <div className='flex flex-col gap-5 md:flex-row md:items-end md:justify-between'>
            <div className='flex items-start gap-4'>
              <div className='flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-alpha-10 text-title-h6 font-medium text-primary-base ring-1 ring-inset ring-primary-base/10'>
                {company.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <h1 className='text-title-h4 font-medium text-text-strong-950'>
                    {company.name}
                  </h1>
                  <span className='rounded-full bg-bg-weak-50 px-2.5 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'>
                    Portfolio Company
                  </span>
                </div>
                <p className='mt-1 text-paragraph-md text-text-sub-600'>
                  {company.sector || 'Category not verified'}
                </p>
              </div>
            </div>
            {!analysis || analysis.status === 'failed' ? (
              <Button.Root
                disabled={pending || data.migrationRequired}
                onClick={() => void analyze()}
              >
                <RiFlashlightLine className='size-4' />
                {pending ? 'Starting…' : 'Run Detailed Analysis'}
              </Button.Root>
            ) : processing ? (
              <span className='rounded-full bg-warning-lighter px-3 py-1.5 text-label-sm text-warning-base'>
                Analysis running…
              </span>
            ) : (
              <span className='rounded-full bg-success-lighter px-3 py-1.5 text-label-sm text-success-base'>
                {analysis.status === 'partial'
                  ? 'Partial analysis ready'
                  : 'Analysis ready'}
              </span>
            )}
          </div>
        </section>

        {(data.migrationRequired || error || analysis?.error) && (
          <div
            role='alert'
            className='mt-5 rounded-2xl bg-error-lighter/40 p-4 text-paragraph-sm text-error-base'
          >
            {data.migrationRequired
              ? 'The funded-company intelligence migration must be applied before analysis can run.'
              : error || analysis?.error}
          </div>
        )}

        <section className='grid grid-cols-2 border-b border-stroke-soft-200 lg:grid-cols-4'>
          {[
            ['Investor', company.investorName],
            ['Investment stage', company.stage || 'Not verified'],
            ['Investment timing', company.investmentTiming || 'Not verified'],
            ['Amount', company.investmentAmount || 'Not disclosed'],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`px-4 py-6 ${index % 2 === 0 ? 'border-r' : ''} border-stroke-soft-200 lg:border-r lg:last:border-r-0`}
            >
              <p className='text-label-xs text-text-soft-400'>{label}</p>
              <p className='mt-2 text-label-md text-text-strong-950'>{value}</p>
            </div>
          ))}
        </section>

        <section className='py-7'>
          <div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
            <div>
              <h2 className='text-title-h5 font-medium text-text-strong-950'>
                Reference Company Profile
              </h2>
              <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                Deterministic profile built only from Scouter&apos;s persisted
                company, taxonomy and portfolio evidence.
              </p>
            </div>
            <span className='rounded-full bg-primary-alpha-10 px-3 py-1.5 text-label-xs text-primary-base'>
              Internal intelligence
            </span>
          </div>
          {(instant.loading && !instant.data) || instantRefreshing ? (
            <div className='rounded-3xl bg-bg-weak-50 p-6 text-paragraph-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'>
              Building internal reference profile…
            </div>
          ) : (instant.error && !instant.data) || instantRefreshError ? (
            <div className='rounded-3xl bg-error-lighter/40 p-5 text-paragraph-sm text-error-base'>
              {instantRefreshError || instant.error}
            </div>
          ) : instant.data?.profile ? (
            <>
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                {[
                  ['Sector', instant.data.profile.sector],
                  ['Subcategory', instant.data.profile.subcategory],
                  ['Product', instant.data.profile.product_type],
                  ['Customer', instant.data.profile.customer_type],
                  ['Business model', instant.data.profile.business_model],
                  ['Stage', instant.data.profile.stage],
                  ['Maturity', instant.data.profile.company_maturity],
                  ['Orientation', instant.data.profile.software_orientation],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className='rounded-2xl bg-bg-white-0 p-4 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
                  >
                    <p className='text-label-xs uppercase tracking-wide text-text-soft-400'>
                      {label}
                    </p>
                    <p className='mt-2 text-label-sm text-text-strong-950'>
                      {value || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
              <div className='mt-4 rounded-2xl bg-bg-weak-50 p-5 ring-1 ring-inset ring-stroke-soft-200'>
                <p className='text-label-xs uppercase tracking-wide text-text-soft-400'>
                  Reference Tags
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {instant.data.profile.reference_tags.map((tag) => (
                    <span
                      key={`${tag.dimension}-${tag.label}`}
                      className='rounded-full bg-bg-white-0 px-3 py-1.5 text-label-xs text-text-sub-600 shadow-xs ring-1 ring-inset ring-stroke-soft-200'
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
                {instant.data.migrationRequired && (
                  <p className='mt-3 text-paragraph-xs text-warning-base'>
                    Profile is available now; apply the instant-intelligence
                    migration to persist its cache and tag links.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </section>

        <section className='overflow-hidden rounded-3xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
          <div className='flex flex-wrap items-center justify-between gap-3 border-b border-stroke-soft-200 px-6 py-5'>
            <div>
              <h2 className='text-title-h6 font-medium text-text-strong-950'>
                Instant Scouter Matches
              </h2>
              <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                Internal deterministic matches. Scouter Score and Instant
                Reference Match remain separate.
              </p>
            </div>
            <span className='rounded-full bg-success-lighter px-3 py-1.5 text-label-xs text-success-base'>
              Scouter DB Match
            </span>
          </div>
          {(instant.loading && !instant.data) || instantRefreshing ? (
            <div className='p-8 text-center text-paragraph-sm text-text-sub-600'>
              Matching against the internal graph…
            </div>
          ) : instant.data?.matches.length ? (
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[1000px] text-left'>
                <thead className='bg-bg-weak-50 text-subheading-xs uppercase tracking-wide text-text-soft-400'>
                  <tr>
                    {[
                      'Founder',
                      'Company',
                      'State',
                      'Scouter Score',
                      'Instant Match',
                      'Why Matched',
                      'Visibility',
                      'Actions',
                    ].map((item) => (
                      <th key={item} className='px-4 py-3'>
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instant.data.matches.map((match) => (
                    <tr
                      key={match.founder_id}
                      className='border-t border-stroke-soft-200 align-top hover:bg-bg-weak-50/60'
                    >
                      <td className='px-4 py-4 text-label-sm text-text-strong-950'>
                        {match.founder_name}
                      </td>
                      <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                        {match.company_name}
                      </td>
                      <td className='px-4 py-4 text-label-sm text-text-sub-600'>
                        {match.current_state}
                      </td>
                      <td className='px-4 py-4 text-label-md text-text-strong-950'>
                        {match.scouter_score ?? '—'}
                      </td>
                      <td className='px-4 py-4'>
                        <span className='rounded-xl bg-success-lighter px-2.5 py-1.5 text-label-md text-success-base'>
                          {match.instant_match_score}
                        </span>
                      </td>
                      <td className='max-w-72 px-4 py-4 text-paragraph-sm text-text-sub-600'>
                        {match.why_matched}
                      </td>
                      <td className='px-4 py-4 text-label-sm capitalize text-text-sub-600'>
                        {match.visibility.replace('_', ' ')}
                      </td>
                      <td className='px-4 py-4'>
                        <button
                          className='text-label-sm text-primary-base'
                          onClick={() => setInstantSelected(match)}
                        >
                          View Founder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className='p-8 text-center'>
              <p className='text-label-md text-text-strong-950'>
                No strong internal match found.
              </p>
              <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                Broad category overlap alone is not enough to create a match.
              </p>
            </div>
          )}
        </section>

        <section className='mt-7 rounded-3xl bg-bg-weak-50 p-5 ring-1 ring-inset ring-stroke-soft-200'>
          <p className='text-label-md text-text-strong-950'>
            Detailed external analysis
          </p>
          <p className='mt-1 text-paragraph-sm text-text-sub-600'>
            Expand beyond Scouter&apos;s internal graph using external research,
            historical pattern analysis and emerging-founder discovery.
          </p>
        </section>

        <div className='py-7'>
          <div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
            <div>
              <h2 className='text-title-h5 font-medium text-text-strong-950'>
                What this investment tells Scouter
              </h2>
              <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                The strategic pattern reconstructed from persisted investment
                evidence.
              </p>
            </div>
            <div className='flex gap-3'>
              {company.companyUrl && (
                <a
                  href={company.companyUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1 text-label-sm text-primary-base'
                >
                  Website
                  <RiExternalLinkLine className='size-4' />
                </a>
              )}
              <a
                href={company.sourceUrl}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1 text-label-sm text-primary-base'
              >
                Source
                <RiExternalLinkLine className='size-4' />
              </a>
            </div>
          </div>
          {analysis && !processing ? (
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
              {[
                [
                  'Original Wedge',
                  text(analysis.original_wedge_json, ['wedge']),
                ],
                [
                  'Founder Archetype',
                  text(
                    analysis.founder_dna_json,
                    ['archetype', 'summary'],
                    company.founderPattern || 'Not verified',
                  ),
                ],
                [
                  'Market Insight',
                  text(analysis.final_insight_json, [
                    'repeating_pattern',
                    'summary',
                  ]),
                ],
                [
                  'Timing Insight',
                  text(analysis.final_insight_json, ['why_now']),
                ],
              ].map(([label, value], index) => (
                <article
                  key={label}
                  className='rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
                >
                  <div className='mb-5 flex size-10 items-center justify-center rounded-xl bg-primary-alpha-10 text-label-sm text-primary-base'>
                    {index + 1}
                  </div>
                  <p className='text-label-sm text-text-strong-950'>{label}</p>
                  <p className='mt-2 text-paragraph-sm leading-6 text-text-sub-600'>
                    {value}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className='rounded-3xl bg-bg-weak-50 p-8 text-center ring-1 ring-inset ring-stroke-soft-200'>
              <p className='text-label-md text-text-strong-950'>
                {processing
                  ? 'Reconstructing the investment pattern…'
                  : 'No reference-company analysis yet.'}
              </p>
              <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                Analysis starts only when you request it.
              </p>
            </div>
          )}
        </div>

        {analysis && !processing && (
          <>
            <section className='rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
              <div className='mb-5'>
                <h2 className='text-title-h6 font-medium text-text-strong-950'>
                  Pattern Evolution
                </h2>
                <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                  From the original market problem to the layer becoming
                  actionable now.
                </p>
              </div>
              <div className='grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]'>
                {[
                  ['Original problem', text(evolution, ['original_problem'])],
                  [
                    'Reference company wedge',
                    text(evolution, ['reference_wedge']),
                  ],
                  [
                    'Category evolution',
                    text(evolution, ['category_evolution']),
                  ],
                  [
                    'Current opportunity layer',
                    text(evolution, ['current_opportunity_layer']),
                  ],
                ].map(([label, value], index) => (
                  <div key={label} className='contents'>
                    <div className='rounded-2xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200'>
                      <p className='text-label-xs uppercase tracking-wide text-text-soft-400'>
                        {label}
                      </p>
                      <p className='mt-2 text-paragraph-sm text-text-strong-950'>
                        {value}
                      </p>
                    </div>
                    {index < 3 && (
                      <RiArrowRightLine className='hidden size-5 self-center text-text-soft-400 lg:block' />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className='grid grid-cols-2 border-b border-stroke-soft-200 py-7 lg:grid-cols-4'>
              {[
                ['Deep Pattern Matches', String(candidates.length)],
                ['High-Conviction Matches', String(highConviction)],
                [
                  'Strongest Founder Match',
                  strongest?.founder_name || 'None verified',
                ],
                [
                  'Strongest Company Pattern',
                  strongest?.company_name || 'None verified',
                ],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`px-4 py-3 ${index % 2 === 0 ? 'border-r' : ''} border-stroke-soft-200 lg:border-r lg:last:border-r-0`}
                >
                  <p className='text-label-xs text-text-soft-400'>{label}</p>
                  <p className='mt-2 text-title-h6 font-medium text-text-strong-950'>
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <div className='grid gap-5 py-7 xl:grid-cols-[minmax(0,1fr)_320px]'>
              <section className='overflow-hidden rounded-3xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                <div className='border-b border-stroke-soft-200 px-6 py-5'>
                  <h2 className='text-title-h6 font-medium text-text-strong-950'>
                    Deep Pattern Matches
                  </h2>
                  <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                    Scouter Score and Reference Pattern Match remain
                    independent.
                  </p>
                </div>
                {candidates.length ? (
                  <div className='overflow-x-auto'>
                    <table className='w-full min-w-[1100px] text-left'>
                      <thead className='bg-bg-weak-50 text-subheading-xs uppercase tracking-wide text-text-soft-400'>
                        <tr>
                          {[
                            'Founder',
                            'Company / Project',
                            'State',
                            'Scouter Score',
                            'Pattern Match',
                            'Why Now',
                            'Visibility',
                            'Source',
                            'Actions',
                          ].map((item) => (
                            <th key={item} className='px-4 py-3'>
                              {item}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((candidate) => (
                          <tr
                            key={candidate.id}
                            className='border-t border-stroke-soft-200 align-top hover:bg-bg-weak-50/60'
                          >
                            <td className='px-4 py-4'>
                              <p className='text-label-sm text-text-strong-950'>
                                {candidate.founder_name}
                              </p>
                              <p className='mt-1 text-label-xs text-text-soft-400'>
                                #{candidate.rank}
                              </p>
                            </td>
                            <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                              {candidate.company_name ||
                                'Pre-company / undisclosed'}
                            </td>
                            <td className='px-4 py-4'>
                              <span className='rounded-lg bg-bg-weak-50 px-2 py-1 text-label-xs text-text-sub-600'>
                                {candidate.founder_state}
                              </span>
                            </td>
                            <td className='px-4 py-4 text-label-md text-text-strong-950'>
                              {candidate.scouter_score ?? '—'}
                            </td>
                            <td className='px-4 py-4'>
                              <span className='rounded-xl bg-primary-alpha-10 px-2.5 py-1.5 text-label-md text-primary-base'>
                                {candidate.pattern_match_score}
                              </span>
                            </td>
                            <td className='max-w-64 px-4 py-4 text-paragraph-sm text-text-sub-600'>
                              {candidate.why_now}
                            </td>
                            <td className='px-4 py-4 text-label-sm capitalize text-text-sub-600'>
                              {candidate.visibility.replace('_', ' ')}
                            </td>
                            <td className='px-4 py-4 text-label-sm text-text-sub-600'>
                              {candidate.source}
                            </td>
                            <td className='px-4 py-4'>
                              <button
                                className='text-label-sm text-primary-base'
                                onClick={() => setSelected(candidate)}
                              >
                                {candidate.founder_id
                                  ? 'View Founder'
                                  : 'View Candidate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className='p-10 text-center'>
                    <p className='text-label-md text-text-strong-950'>
                      No candidate passed the hard gates.
                    </p>
                    <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                      Scouter does not pad the result set with weak matches.
                    </p>
                  </div>
                )}
              </section>

              <aside className='rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                <div className='flex items-center gap-3'>
                  <div className='flex size-10 items-center justify-center rounded-xl bg-primary-alpha-10 text-primary-base'>
                    <RiPulseLine className='size-5' />
                  </div>
                  <div>
                    <h2 className='text-label-md text-text-strong-950'>
                      Signals from this pattern
                    </h2>
                    <p className='text-paragraph-xs text-text-soft-400'>
                      Evidence-backed only
                    </p>
                  </div>
                </div>
                <div className='mt-5 divide-y divide-stroke-soft-200'>
                  {data.signals.length ? (
                    data.signals.map((signal) => (
                      <article key={signal.id} className='py-4 first:pt-0'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-label-xs text-primary-base'>
                            {signal.signal_type}
                          </span>
                          <span className='text-label-xs text-text-soft-400'>
                            {date(signal.signal_date)}
                          </span>
                        </div>
                        <p className='mt-2 text-paragraph-sm text-text-strong-950'>
                          {signal.explanation}
                        </p>
                        <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                          {signal.why_it_matters}
                        </p>
                        <a
                          href={signal.source_url}
                          target='_blank'
                          rel='noreferrer'
                          className='mt-2 inline-flex items-center gap-1 text-label-xs text-primary-base'
                        >
                          Evidence
                          <RiExternalLinkLine className='size-3' />
                        </a>
                      </article>
                    ))
                  ) : (
                    <p className='rounded-2xl bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600'>
                      No sufficiently supported recent signal was found.
                    </p>
                  )}
                </div>
              </aside>
            </div>

            <section className='grid gap-4 md:grid-cols-3'>
              <article className='rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                <RiBuildingLine className='size-5 text-primary-base' />
                <h3 className='mt-4 text-label-md text-text-strong-950'>
                  Historical Validators
                </h3>
                <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                  {analysis.historical_validators_json.length} evidence-backed
                  validators identified.
                </p>
              </article>
              <article className='rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                <RiGroupLine className='size-5 text-primary-base' />
                <h3 className='mt-4 text-label-md text-text-strong-950'>
                  Missing Layers
                </h3>
                <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                  {analysis.missing_layers_json.length} value-chain
                  opportunities remain open.
                </p>
              </article>
              <article className='rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                <RiFileChartLine className='size-5 text-primary-base' />
                <h3 className='mt-4 text-label-md text-text-strong-950'>
                  Full Analysis
                </h3>
                <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                  Download the evidence-backed investor report from the page
                  header.
                </p>
              </article>
            </section>
          </>
        )}
      </div>

      {instantSelected && (
        <FounderPreviewDrawer
          id={instantSelected.founder_id}
          onClose={() => setInstantSelected(null)}
        />
      )}
      {selected?.founder_id && (
        <FounderPreviewDrawer
          id={selected.founder_id}
          onClose={() => setSelected(null)}
          referencePattern={{
            score: Number(selected.pattern_match_score),
            historicalComparable:
              selected.historical_comparable || 'No verified comparable',
            whyNow: selected.why_now,
            patternBranch: selected.pattern_branch || 'Unclassified branch',
            keyEvidence: selected.evidence
              .map((item) => String(item.excerpt || ''))
              .filter(Boolean)
              .slice(0, 5),
            redFlags: selected.red_flags || [],
          }}
        />
      )}
      {selected && !selected.founder_id && (
        <Modal.Root open onOpenChange={(open) => !open && setSelected(null)}>
          <Modal.Content className='max-w-[560px] rounded-3xl'>
            <Modal.Header
              title={selected.founder_name}
              description='External candidate · read-only'
            />
            <Modal.Body className='space-y-5'>
              <div>
                <p className='text-label-xs text-text-soft-400'>
                  Company / project
                </p>
                <p className='mt-1 text-label-md text-text-strong-950'>
                  {selected.company_name || 'Pre-company / undisclosed'}
                </p>
              </div>
              <div>
                <p className='text-label-xs text-text-soft-400'>
                  Reference Pattern Match
                </p>
                <p className='mt-1 text-title-h5 text-primary-base'>
                  {selected.pattern_match_score}
                </p>
              </div>
              <div>
                <p className='text-label-xs text-text-soft-400'>Why now</p>
                <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                  {selected.why_now}
                </p>
              </div>
              <div>
                <p className='text-label-xs text-text-soft-400'>Red flags</p>
                <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                  {selected.red_flags?.join(' · ') ||
                    'No verified red flags recorded.'}
                </p>
              </div>
            </Modal.Body>
          </Modal.Content>
        </Modal.Root>
      )}
    </div>
  );
}
