'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RiBriefcase4Line,
  RiCpuLine,
  RiExternalLinkLine,
  RiMapPin2Line,
  RiRefreshLine,
  RiRocketLine,
  RiShapesLine,
  RiUserStarLine,
} from '@remixicon/react';

import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';

type Dimension = {
  id: string;
  dimension_type: string;
  value: string;
  weight: number;
  confidence: number;
  metadata: Record<string, unknown> | null;
};
type Evidence = {
  id: string;
  claim: string;
  source_url: string;
  evidence_text: string;
  confidence: number;
  metadata: Record<string, unknown> | null;
};
type ThesisResponse = {
  status: 'not_started' | 'crawling' | 'analyzing' | 'ready' | 'failed';
  processingError?: string | null;
  thesis: {
    id: string;
    name: string;
    source_url: string;
    status: string;
    updated_at: string;
  } | null;
  summary: {
    fund_summary?: {
      name?: string;
      website?: string;
      thesis_summary?: string;
      confidence?: number;
    };
    stated_thesis?: { summary?: string; confidence?: number };
    observed_thesis?: { summary?: string; confidence?: number };
    investment_preferences?: Record<string, unknown>;
    portfolio_patterns?: { pattern: string; confidence: number }[];
    quality?: {
      source_coverage?: number;
      evidence_strength?: number;
      portfolio_coverage?: number;
      overall_confidence?: number;
    };
  } | null;
  dimensions: Dimension[];
  evidence: Evidence[];
  sources: {
    url: string;
    title: string;
    pageType: string;
    crawledAt?: string;
    relevance?: number;
  }[];
  portfolioCompanies: Record<string, unknown>[];
};

const GROUPS = [
  {
    key: 'stages',
    label: 'Stage',
    hint: 'Investment timing',
    icon: RiRocketLine,
    accent: '#7C3AED',
    soft: '#F5F3FF',
  },
  {
    key: 'sectors',
    label: 'Sector',
    hint: 'Market preference',
    icon: RiShapesLine,
    accent: '#2563EB',
    soft: '#EFF6FF',
  },
  {
    key: 'founder_traits',
    label: 'Founder Profile',
    hint: 'Team characteristics',
    icon: RiUserStarLine,
    accent: '#059669',
    soft: '#ECFDF5',
  },
  {
    key: 'business_models',
    label: 'Business Model',
    hint: 'Commercial structure',
    icon: RiBriefcase4Line,
    accent: '#D97706',
    soft: '#FFFBEB',
  },
  {
    key: 'geographies',
    label: 'Geography',
    hint: 'Regional focus',
    icon: RiMapPin2Line,
    accent: '#DC2626',
    soft: '#FEF2F2',
  },
  {
    key: 'technologies',
    label: 'Technology',
    hint: 'Technical themes',
    icon: RiCpuLine,
    accent: '#0891B2',
    soft: '#ECFEFF',
  },
] as const;

function percent(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round((value <= 1 ? value : value / 100) * 100)}%`;
}

function StatusBadge({ data }: { data: ThesisResponse }) {
  const confidence = data.summary?.quality?.overall_confidence || 0;
  const lowEvidence =
    data.status === 'ready' && (confidence < 0.45 || data.sources.length < 2);
  const label =
    data.status === 'crawling'
      ? 'Analyzing website…'
      : data.status === 'analyzing'
        ? 'Analyzing evidence…'
        : data.status === 'failed'
          ? 'Failed / Retry'
          : data.status === 'ready'
            ? lowEvidence
              ? 'Needs more evidence'
              : 'Ready'
            : 'Not started';
  const tone =
    data.status === 'failed'
      ? 'bg-error-lighter text-error-base'
      : data.status === 'ready' && !lowEvidence
        ? 'bg-success-lighter text-success-base'
        : 'bg-warning-lighter text-warning-base';
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-label-sm ${tone}`}
    >
      {label}
    </span>
  );
}

export function ThesisView() {
  const result = useProductData<ThesisResponse>('/api/thesis');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [showSources, setShowSources] = useState(false);
  const data = result.data;
  const processingStatus = data?.status;
  const reload = result.reload;

  useEffect(() => {
    if (
      !processingStatus ||
      !['crawling', 'analyzing'].includes(processingStatus)
    )
      return;
    const timer = setInterval(() => void reload(), 4_000);
    return () => clearInterval(timer);
  }, [processingStatus, reload]);

  const grouped = useMemo(
    () =>
      new Map(
        GROUPS.map(({ key }) => [
          key,
          (data?.dimensions || [])
            .filter((item) => item.dimension_type === key)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5),
        ]),
      ),
    [data?.dimensions],
  );

  async function generate(force: boolean) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await requestJson('/api/thesis/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      await result.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Thesis generation could not be started.',
      );
    } finally {
      setPending(false);
    }
  }

  if (result.loading && !data)
    return (
      <div
        role='status'
        className='mt-6 rounded-3xl bg-bg-white-0 p-8 text-paragraph-sm text-text-sub-600 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
      >
        Loading investment thesis…
      </div>
    );
  if (result.error && !data)
    return (
      <div
        role='alert'
        className='mt-6 rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-error-lighter'
      >
        {result.error}
        <button
          className='ml-3 text-label-sm text-primary-base underline'
          onClick={() => void result.reload()}
        >
          Retry
        </button>
      </div>
    );
  if (!data) return null;

  if (data.status === 'not_started')
    return (
      <section className='mt-6 overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
        <div className='rounded-2xl bg-gradient-to-br from-white via-primary-alpha-10 to-bg-white-0 px-6 py-12 text-center'>
          <h2 className='text-title-h5 font-medium text-text-strong-950'>
            Build your Thesis DNA
          </h2>
          <p className='mx-auto mt-2 max-w-xl text-paragraph-sm text-text-sub-600'>
            Scouter will analyze the portfolio website saved during onboarding
            and separate stated thesis, observed patterns, and inferred
            preferences.
          </p>
          {error && (
            <p role='alert' className='mt-4 text-paragraph-sm text-error-base'>
              {error}
            </p>
          )}
          <button
            disabled={pending}
            onClick={() => void generate(false)}
            className='mt-5 rounded-10 bg-primary-base px-4 py-2 text-label-sm text-static-white shadow-xs disabled:opacity-60'
          >
            {pending ? 'Starting…' : 'Generate Thesis'}
          </button>
        </div>
      </section>
    );

  const meta = data.summary;
  const patterns = meta?.portfolio_patterns || [];
  const processing = ['crawling', 'analyzing'].includes(data.status);

  return (
    <div className='space-y-6'>
      <section className='grid border-b border-stroke-soft-200 sm:grid-cols-3'>
        <div className='px-4 py-6 sm:border-r sm:border-stroke-soft-200'>
          <p className='text-label-sm text-text-sub-600'>Analysis status</p>
          <div className='mt-2'>
            <StatusBadge data={data} />
          </div>
          <p className='mt-2 text-paragraph-xs text-text-soft-400'>
            {processing
              ? 'Analysis is running in the background'
              : 'Current thesis state'}
          </p>
        </div>
        <div className='border-t border-stroke-soft-200 px-4 py-6 sm:border-r sm:border-t-0'>
          <p className='text-label-sm text-text-sub-600'>Source pages</p>
          <p className='mt-2 text-title-h5 font-medium text-text-strong-950'>
            {data.sources.length}
          </p>
          <p className='mt-1 text-paragraph-xs text-text-soft-400'>
            Pages supporting the analysis
          </p>
        </div>
        <div className='border-t border-stroke-soft-200 px-4 py-6 sm:border-t-0'>
          <p className='text-label-sm text-text-sub-600'>Evidence claims</p>
          <p className='mt-2 text-title-h5 font-medium text-text-strong-950'>
            {data.evidence.length}
          </p>
          <p className='mt-1 text-paragraph-xs text-text-soft-400'>
            Structured supporting signals
          </p>
        </div>
      </section>

      <div className='flex flex-col gap-2 px-1 md:flex-row md:items-center md:justify-between'>
        <p className='min-w-0 truncate text-paragraph-sm text-text-sub-600'>
          Source:{' '}
          <a
            href={data.thesis?.source_url}
            target='_blank'
            rel='noreferrer'
            className='text-primary-base hover:underline'
          >
            {data.thesis?.source_url}
          </a>
        </p>
        {processing && (
          <p className='text-paragraph-sm text-text-sub-600'>
            Evidence collection and analysis are running.
          </p>
        )}
      </div>

      {data.status === 'failed' && (
        <div
          role='alert'
          className='rounded-2xl border border-error-lighter bg-error-lighter/20 p-5'
        >
          <p className='text-label-md text-text-strong-950'>
            Analysis could not be completed.
          </p>
          <p className='mt-1 text-paragraph-sm text-text-sub-600'>
            {data.processingError ||
              'Collected source evidence is preserved. Retry when the website is available.'}
          </p>
        </div>
      )}
      {error && (
        <p role='alert' className='text-paragraph-sm text-error-base'>
          {error}
        </p>
      )}

      {meta ? (
        <>
          <section className='overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <div className='rounded-2xl bg-gradient-to-br from-white via-primary-alpha-10 to-bg-white-0 p-6'>
              <p className='text-label-xs uppercase tracking-wider text-text-soft-400'>
                Thesis Summary
              </p>
              <h2 className='mt-3 max-w-4xl text-title-h4 font-medium text-text-strong-950'>
                {meta.fund_summary?.thesis_summary ||
                  'Thesis summary is still being prepared.'}
              </h2>
              <p className='mt-4 text-label-sm text-text-sub-600'>
                Overall Confidence{' '}
                <span className='ml-2 text-text-strong-950'>
                  {percent(meta.quality?.overall_confidence)}
                </span>
              </p>
            </div>
          </section>

          <section>
            <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
              <div>
                <h2 className='text-title-h6 font-medium text-text-strong-950'>
                  Thesis DNA
                </h2>
                <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                  The strongest recurring signals across six investment
                  dimensions.
                </p>
              </div>
              <span className='w-fit rounded-full bg-bg-white-0 px-3 py-1.5 text-label-xs text-text-sub-600 shadow-xs ring-1 ring-inset ring-stroke-soft-200'>
                6 dimensions
              </span>
            </div>
            <div className='grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3'>
              {GROUPS.map((group) => {
                const items = grouped.get(group.key) || [];
                const Icon = group.icon;
                const strongest = items[0];

                return (
                  <article
                    key={group.key}
                    className='group overflow-hidden rounded-3xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-regular-md'
                  >
                    <div
                      className='flex items-center justify-between gap-4 px-5 py-5'
                      style={{
                        background: `linear-gradient(135deg, ${group.soft} 0%, #FFFFFF 88%)`,
                      }}
                    >
                      <div className='flex min-w-0 items-center gap-3'>
                        <div
                          className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-bg-white-0 shadow-xs ring-1 ring-inset ring-stroke-soft-200'
                          style={{ color: group.accent }}
                        >
                          <Icon className='size-5' />
                        </div>
                        <div className='min-w-0'>
                          <h3 className='text-label-md text-text-strong-950'>
                            {group.label}
                          </h3>
                          <p className='mt-0.5 text-paragraph-xs text-text-soft-400'>
                            {group.hint}
                          </p>
                        </div>
                      </div>
                      <div className='shrink-0 text-right'>
                        <p
                          className='text-title-h6 font-medium'
                          style={{ color: group.accent }}
                        >
                          {strongest ? percent(strongest.weight) : '—'}
                        </p>
                        <p className='text-label-xs text-text-soft-400'>
                          Top signal
                        </p>
                      </div>
                    </div>

                    <div className='border-t border-stroke-soft-200 px-5 py-5'>
                      {items.length ? (
                        <div className='space-y-4'>
                          {items.map((item, index) => (
                            <div key={item.id}>
                              <div className='mb-2 flex items-center gap-2.5'>
                                <span
                                  className='flex size-6 shrink-0 items-center justify-center rounded-lg text-label-xs font-medium'
                                  style={{
                                    backgroundColor: group.soft,
                                    color: group.accent,
                                  }}
                                >
                                  {index + 1}
                                </span>
                                <span className='min-w-0 flex-1 truncate text-paragraph-sm text-text-sub-600'>
                                  {item.value}
                                </span>
                                <span className='shrink-0 text-label-sm text-text-strong-950'>
                                  {percent(item.weight)}
                                </span>
                              </div>
                              <div
                                className='h-2 overflow-hidden rounded-full'
                                style={{ backgroundColor: group.soft }}
                              >
                                <div
                                  className='h-full rounded-full transition-all duration-500'
                                  style={{
                                    width: percent(item.weight),
                                    backgroundColor: group.accent,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className='rounded-2xl bg-bg-weak-50 px-4 py-6 text-center ring-1 ring-inset ring-stroke-soft-200'>
                          <p className='text-paragraph-sm text-text-soft-400'>
                            Not enough evidence yet.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className='flex items-center justify-between border-t border-stroke-soft-200 px-5 py-4'>
                      <span className='text-label-xs text-text-soft-400'>
                        Signals identified
                      </span>
                      <span className='text-label-sm text-text-strong-950'>
                        {items.length}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className='grid gap-4 lg:grid-cols-2'>
            <div className='rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
              <p className='text-label-xs uppercase tracking-wider text-primary-base'>
                Stated Thesis
              </p>
              <p className='mt-3 text-paragraph-md text-text-strong-950'>
                {meta.stated_thesis?.summary ||
                  'No explicit thesis statement found.'}
              </p>
              <p className='mt-5 border-t border-stroke-soft-200 pt-4 text-paragraph-xs text-text-soft-400'>
                Confidence {percent(meta.stated_thesis?.confidence)}
              </p>
            </div>
            <div className='rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
              <p className='text-label-xs uppercase tracking-wider text-warning-base'>
                Observed Pattern
              </p>
              <p className='mt-3 text-paragraph-md text-text-strong-950'>
                {meta.observed_thesis?.summary ||
                  'Not enough portfolio evidence found.'}
              </p>
              <p className='mt-5 border-t border-stroke-soft-200 pt-4 text-paragraph-xs text-text-soft-400'>
                Confidence {percent(meta.observed_thesis?.confidence)}
              </p>
            </div>
          </section>

          <section className='rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <h2 className='text-title-h6 font-medium text-text-strong-950'>
              Portfolio Patterns
            </h2>
            {patterns.length ? (
              <ul className='mt-4 grid gap-3 md:grid-cols-2'>
                {patterns.slice(0, 6).map((item) => (
                  <li
                    key={item.pattern}
                    className='rounded-2xl bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
                  >
                    {item.pattern}
                    <span className='ml-2 text-label-xs text-text-soft-400'>
                      {percent(item.confidence)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='mt-3 text-paragraph-sm text-text-soft-400'>
                No sufficiently supported portfolio patterns yet.
              </p>
            )}
          </section>

          <section className='rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <div className='flex items-center justify-between'>
              <h2 className='text-title-h6 font-medium text-text-strong-950'>
                Evidence
              </h2>
              <span className='text-label-sm text-text-soft-400'>
                {data.evidence.length} claims
              </span>
            </div>
            <div className='mt-4 divide-y divide-stroke-soft-200'>
              {data.evidence.slice(0, 12).map((item) => (
                <div key={item.id} className='py-4'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-label-sm text-text-strong-950'>
                      {item.claim}
                    </p>
                    <span className='rounded-md bg-bg-weak-50 px-2 py-0.5 text-label-xs text-text-sub-600'>
                      {String(item.metadata?.claim_type || 'observed')}
                    </span>
                    <span className='text-label-xs text-text-soft-400'>
                      {percent(item.confidence)}
                    </span>
                  </div>
                  <p className='mt-1 line-clamp-2 text-paragraph-sm text-text-sub-600'>
                    {item.evidence_text}
                  </p>
                  <a
                    href={item.source_url}
                    target='_blank'
                    rel='noreferrer'
                    className='mt-1 inline-flex items-center gap-1 text-label-xs text-primary-base hover:underline'
                  >
                    Open source <RiExternalLinkLine className='size-3.5' />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className='rounded-3xl bg-bg-white-0 p-8 text-center shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
          <p className='text-title-h6 font-medium text-text-strong-950'>
            {processing ? 'Building Thesis DNA…' : 'No completed analysis yet.'}
          </p>
          <p className='mt-2 text-paragraph-sm text-text-sub-600'>
            {data.sources.length
              ? `${data.sources.length} source pages preserved.`
              : 'Waiting for source evidence.'}
          </p>
        </section>
      )}

      {showSources && (
        <section className='rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
          <h2 className='text-title-h6 font-medium text-text-strong-950'>
            Source Pages
          </h2>
          <div className='mt-3 divide-y divide-stroke-soft-200'>
            {data.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target='_blank'
                rel='noreferrer'
                className='flex items-center justify-between gap-4 py-3 text-paragraph-sm hover:text-primary-base'
              >
                <span>
                  <span className='block text-text-strong-950'>
                    {String(source.title)}
                  </span>
                  <span className='text-text-soft-400'>{source.pageType}</span>
                </span>
                <RiExternalLinkLine className='size-4 shrink-0' />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className='flex flex-wrap gap-3 rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
        <button
          disabled={pending || processing}
          onClick={() => void generate(true)}
          className='inline-flex items-center gap-2 rounded-10 bg-primary-base px-4 py-2 text-label-sm text-static-white disabled:opacity-60'
        >
          <RiRefreshLine className='size-4' />
          {pending ? 'Starting…' : 'Refresh Thesis'}
        </button>
        <Link
          href='/add-product'
          className='rounded-10 border border-stroke-soft-200 px-4 py-2 text-label-sm text-text-strong-950'
        >
          Edit Thesis
        </Link>
        <button
          onClick={() => setShowSources((current) => !current)}
          className='rounded-10 border border-stroke-soft-200 px-4 py-2 text-label-sm text-text-strong-950'
        >
          {showSources
            ? 'Hide Sources'
            : `View Sources (${data.sources.length})`}
        </button>
      </section>
    </div>
  );
}
