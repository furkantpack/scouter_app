'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiExternalLinkLine,
} from '@remixicon/react';

import { safeFormatDate } from '@/lib/funded-intelligence/safe-date';
import { useProductData } from '@/hooks/use-product-data';

type Company = {
  id: string;
  name: string;
  companyUrl: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  geography: string | null;
  investmentTiming: string | null;
  sourceUrl: string | null;
  founders: string[];
  founderPattern: string | null;
  thesisMatch: string[];
  whyFit: string | null;
};
type FundedResponse = {
  thesis: {
    id: string;
    name: string;
    sourceUrl: string;
    updatedAt: string | null;
  } | null;
  companies: Company[];
  count: number;
  totalCount?: number;
  page: number;
  pageSize: number;
  filters: { sectors: string[]; stages: string[]; geographies: string[] };
  summary: {
    topSector: string | null;
    primaryStage: string | null;
    primaryGeography: string | null;
  } | null;
  patterns: {
    sectors: string[];
    stages: string[];
    geographies: string[];
    founderTraits: string[];
    portfolio: { pattern?: string; confidence?: number }[];
  } | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className='text-label-xs uppercase tracking-wide text-text-soft-400'>
        {label}
      </dt>
      <dd className='mt-1 text-paragraph-sm text-text-strong-950'>{value}</dd>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  if (!values.length) return null;
  return (
    <label className='flex flex-col gap-1 text-label-xs text-text-soft-400'>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='h-10 min-w-40 rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-label-sm text-text-strong-950'
      >
        <option value=''>All</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FundedCompaniesView() {
  const [sector, setSector] = useState('');
  const [stage, setStage] = useState('');
  const [geography, setGeography] = useState('');
  const [page, setPage] = useState(0);
  const url = useMemo(
    () =>
      `/api/funded?page=${page}&sector=${encodeURIComponent(sector)}&stage=${encodeURIComponent(stage)}&geography=${encodeURIComponent(geography)}`,
    [geography, page, sector, stage],
  );
  const result = useProductData<FundedResponse>(url);
  const data = result.data;
  const setFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };

  if (result.loading && !data)
    return (
      <p role='status' className='py-10 text-paragraph-sm text-text-sub-600'>
        Loading funded companies…
      </p>
    );
  if (result.error && !data)
    return (
      <div role='alert' className='rounded-2xl border border-error-lighter p-5'>
        {result.error}
        <button className='ml-3 underline' onClick={() => void result.reload()}>
          Retry
        </button>
      </div>
    );
  if (!data?.thesis)
    return (
      <div className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-8 text-center'>
        <h2 className='text-title-h6 text-text-strong-950'>
          No persisted portfolio yet
        </h2>
        <p className='mt-2 text-paragraph-sm text-text-sub-600'>
          Generate an Investment Thesis first to discover source-backed
          portfolio companies.
        </p>
      </div>
    );

  const totalPages = Math.max(1, Math.ceil(data.count / data.pageSize));
  const summaryCards = [
    ['Portfolio Companies', String(data.totalCount ?? data.count)],
    ['Top Sector', data.summary?.topSector],
    ['Primary Stage', data.summary?.primaryStage],
    ['Primary Geography', data.summary?.primaryGeography],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className='space-y-7'>
      <section className='flex flex-col gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 md:flex-row md:items-center md:justify-between'>
        <div>
          <h2 className='text-title-h6 text-text-strong-950'>
            {data.thesis.name}
          </h2>
          <a
            href={data.thesis.sourceUrl}
            target='_blank'
            rel='noreferrer'
            className='mt-1 inline-flex items-center gap-1 text-paragraph-sm text-primary-base hover:underline'
          >
            {data.thesis.sourceUrl}
            <RiExternalLinkLine className='size-4' />
          </a>
        </div>
        <div className='text-paragraph-sm text-text-sub-600'>
          <p>{data.totalCount ?? data.count} portfolio companies</p>
          <p>
            Last analyzed{' '}
            {safeFormatDate(data.thesis.updatedAt, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
      </section>

      <section>
        <h2 className='mb-3 text-title-h6 text-text-strong-950'>
          Portfolio Summary
        </h2>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {summaryCards.map(([label, value]) => (
            <div
              key={label}
              className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5'
            >
              <p className='text-label-xs uppercase tracking-wide text-text-soft-400'>
                {label}
              </p>
              <p className='mt-2 text-title-h5 text-text-strong-950'>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className='mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <h2 className='text-title-h6 text-text-strong-950'>
              Portfolio Companies
            </h2>
            <p className='mt-1 text-paragraph-sm text-text-sub-600'>
              {data.count} companies match the current filters.
            </p>
          </div>
          <div className='flex flex-wrap gap-3'>
            <SelectFilter
              label='Sector'
              value={sector}
              values={data.filters.sectors}
              onChange={setFilter(setSector)}
            />
            <SelectFilter
              label='Stage'
              value={stage}
              values={data.filters.stages}
              onChange={setFilter(setStage)}
            />
            <SelectFilter
              label='Geography'
              value={geography}
              values={data.filters.geographies}
              onChange={setFilter(setGeography)}
            />
          </div>
        </div>
        {data.companies.length ? (
          <div className='grid gap-4 lg:grid-cols-2'>
            {data.companies.map((company) => (
              <article
                key={company.id}
                className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-regular-xs'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <Link
                      href={`/funded/${company.id}`}
                      className='text-title-h6 text-text-strong-950 transition hover:text-primary-base'
                    >
                      {company.name}
                    </Link>
                    {company.description && (
                      <p className='mt-2 line-clamp-2 text-paragraph-sm text-text-sub-600'>
                        {company.description}
                      </p>
                    )}
                  </div>
                  {company.companyUrl && (
                    <a
                      href={company.companyUrl}
                      target='_blank'
                      rel='noreferrer'
                      aria-label={`Open ${company.name} website`}
                      className='text-text-soft-400 hover:text-primary-base'
                    >
                      <RiExternalLinkLine className='size-5' />
                    </a>
                  )}
                </div>
                <dl className='mt-5 grid grid-cols-2 gap-4'>
                  <Field label='Sector' value={company.sector} />
                  <Field label='Stage' value={company.stage} />
                  <Field label='Geography' value={company.geography} />
                  <Field
                    label='Investment Timing'
                    value={company.investmentTiming}
                  />
                </dl>
                <div className='mt-5'>
                  <p className='text-label-xs uppercase tracking-wide text-text-soft-400'>
                    Thesis Match
                  </p>
                  <div className='mt-2 flex flex-wrap gap-2'>
                    {company.thesisMatch.length ? (
                      company.thesisMatch.map((match) => (
                        <span
                          key={match}
                          className='rounded-lg bg-bg-weak-50 px-2.5 py-1 text-label-xs text-text-sub-600'
                        >
                          {match}
                        </span>
                      ))
                    ) : (
                      <span className='text-paragraph-sm text-text-soft-400'>
                        No direct persisted match available
                      </span>
                    )}
                  </div>
                </div>
                <div className='mt-5 rounded-xl bg-bg-weak-50 p-3'>
                  <p className='text-label-xs uppercase tracking-wide text-text-soft-400'>
                    Why This Fit
                  </p>
                  <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                    {company.whyFit ||
                      'No evidence-backed interpretation available yet.'}
                  </p>
                </div>
                <div className='mt-5 grid gap-4 sm:grid-cols-2'>
                  <Field
                    label='Founder Pattern'
                    value={
                      company.founderPattern || 'Founder data not yet enriched'
                    }
                  />
                  <Field
                    label='Founders'
                    value={
                      company.founders.length
                        ? company.founders.join(', ')
                        : 'Founder data not yet enriched'
                    }
                  />
                </div>
                <div className='mt-5 flex items-center justify-between border-t border-stroke-soft-200 pt-4'>
                  {company.sourceUrl ? (
                    <a
                      href={company.sourceUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex items-center gap-1 text-label-sm text-text-sub-600 hover:text-primary-base'
                    >
                      View source
                      <RiExternalLinkLine className='size-4' />
                    </a>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/funded/${company.id}`}
                    className='text-label-sm text-primary-base'
                  >
                    Open intelligence →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className='rounded-2xl border border-stroke-soft-200 p-8 text-center text-paragraph-sm text-text-sub-600'>
            No persisted companies match these filters.
          </p>
        )}
        {totalPages > 1 && (
          <div className='mt-5 flex items-center justify-between'>
            <p className='text-paragraph-sm text-text-sub-600'>
              Page {page + 1} of {totalPages}
            </p>
            <div className='flex gap-2'>
              <button
                disabled={page === 0}
                onClick={() => setPage((current) => current - 1)}
                className='rounded-10 border border-stroke-soft-200 p-2 disabled:opacity-40'
                aria-label='Previous page'
              >
                <RiArrowLeftSLine className='size-5' />
              </button>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className='rounded-10 border border-stroke-soft-200 p-2 disabled:opacity-40'
                aria-label='Next page'
              >
                <RiArrowRightSLine className='size-5' />
              </button>
            </div>
          </div>
        )}
      </section>

      {data.patterns && (
        <section>
          <h2 className='mb-3 text-title-h6 text-text-strong-950'>
            Portfolio Patterns
          </h2>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            {(
              [
                ['Sector Concentration', data.patterns.sectors],
                ['Founder Pattern', data.patterns.founderTraits],
                ['Geography', data.patterns.geographies],
                ['Stage', data.patterns.stages],
              ] as [string, string[]][]
            )
              .filter(([, values]) => values.length)
              .map(([label, values]) => (
                <div
                  key={label}
                  className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5'
                >
                  <h3 className='text-label-md text-text-strong-950'>
                    {label}
                  </h3>
                  <ul className='mt-3 space-y-2'>
                    {values.map((value) => (
                      <li
                        key={value}
                        className='text-paragraph-sm text-text-sub-600'
                      >
                        • {value}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
