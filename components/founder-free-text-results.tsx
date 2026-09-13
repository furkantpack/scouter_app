'use client';

import { useMemo, useState } from 'react';

import type { FounderSearchResponse } from '@/lib/founder-search/types';
import * as Button from '@/components/ui/button';
import * as Table from '@/components/ui/table';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import {
  SortableScoreHead,
  type ScoreSortDirection,
} from '@/components/sortable-score-head';

const FILTER_LABELS: Record<string, string> = {
  big_tech_alumni: 'Big Tech alumni',
  fintech_alumni: 'Fintech alumni',
  ai_alumni: 'AI alumni',
  saas_alumni: 'SaaS alumni',
  global_tier_1: 'Global Tier 1',
  technical_tier_1: 'Technical Tier 1',
  regional_tier_1: 'Regional Tier 1',
  stem_focus: 'STEM',
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

function parsedChips(response: FounderSearchResponse) {
  const parsed = response.parsed_query;
  return Array.from(
    new Set([
      ...parsed.companies,
      ...(parsed.institutions || []),
      ...parsed.career_flags.flatMap((value) =>
        FILTER_LABELS[value] ? [FILTER_LABELS[value]] : [],
      ),
      ...parsed.education_flags.flatMap((value) =>
        FILTER_LABELS[value] ? [FILTER_LABELS[value]] : [],
      ),
      ...parsed.sector_flags.flatMap((value) =>
        FILTER_LABELS[value] ? [FILTER_LABELS[value]] : [],
      ),
      ...parsed.tags,
      ...parsed.geographies,
      ...parsed.roles,
      ...parsed.timing_signals,
      ...parsed.visibility_signals,
      ...parsed.founder_archetypes,
    ]),
  );
}

export function FounderFreeTextResults({
  response,
  loading,
  error,
  onRetry,
  onPageChange,
}: {
  response: FounderSearchResponse | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'search_match' | 'scouter'>(
    'search_match',
  );
  const [sortDirection, setSortDirection] =
    useState<ScoreSortDirection>('desc');

  const sortedResults = useMemo(() => {
    if (!response) return [];
    return [...response.results].sort((left, right) => {
      const leftScore =
        sortKey === 'search_match'
          ? left.search_match_score
          : (left.scouter_score ?? -1);
      const rightScore =
        sortKey === 'search_match'
          ? right.search_match_score
          : (right.scouter_score ?? -1);
      return sortDirection === 'desc'
        ? rightScore - leftScore || left.name.localeCompare(right.name)
        : leftScore - rightScore || left.name.localeCompare(right.name);
    });
  }, [response, sortDirection, sortKey]);

  const toggleSort = (key: 'search_match' | 'scouter') => {
    if (sortKey === key)
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  if (loading) {
    return (
      <section
        aria-label='Founder search results'
        className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 py-14 text-center'
      >
        <p role='status' className='text-label-sm text-text-sub-600'>
          Parsing your search and matching Scouter founders…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label='Founder search results'
        className='rounded-2xl border border-error-lighter bg-error-lighter/20 p-5 text-paragraph-sm text-error-base'
      >
        {error}
        <button className='ml-3 underline' onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }

  if (!response) return null;
  const chips = parsedChips(response);
  const totalPages = Math.max(
    1,
    Math.ceil(response.total / response.page_size),
  );

  return (
    <section className='space-y-5' aria-label='Founder search results'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <h2 className='text-label-lg text-text-strong-950'>
            Founder search results
          </h2>
          <p className='mt-1 text-paragraph-sm text-text-sub-600'>
            {response.total} database matches · Search Match is separate from
            Scouter Score
          </p>
        </div>
      </div>

      {chips.length > 0 && (
        <div
          className='flex flex-wrap gap-2'
          aria-label='Parsed search filters'
        >
          {chips.map((chip) => (
            <span
              key={chip}
              className='rounded-lg bg-bg-weak-50 px-2.5 py-1.5 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {response.results.length ? (
        <>
          <div className='overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-white-0'>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Founder</Table.Head>
                  <Table.Head>Company / Role</Table.Head>
                  <SortableScoreHead
                    label='Search Match'
                    active={sortKey === 'search_match'}
                    direction={sortDirection}
                    onToggle={() => toggleSort('search_match')}
                  />
                  <SortableScoreHead
                    label='Scouter Score'
                    active={sortKey === 'scouter'}
                    direction={sortDirection}
                    onToggle={() => toggleSort('scouter')}
                  />
                  <Table.Head>Why matched</Table.Head>
                  <Table.Head>Signals</Table.Head>
                  <Table.Head className='text-right'>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedResults.map((founder) => (
                  <Table.Row
                    key={founder.id}
                    tabIndex={0}
                    onClick={() => setSelected(founder.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        setSelected(founder.id);
                      }
                    }}
                    className='cursor-pointer [&>td]:border-b [&>td]:border-stroke-soft-200/70 last:[&>td]:border-b-0 focus:outline-none focus:ring-2 focus:ring-primary-base/30'
                  >
                    <Table.Cell className='min-w-44'>
                      <span className='text-label-sm text-text-strong-950'>
                        {founder.name}
                      </span>
                    </Table.Cell>
                    <Table.Cell className='min-w-52'>
                      <div className='text-label-sm text-text-strong-950'>
                        {founder.company_name || 'Stealth / pre-company'}
                      </div>
                      <div className='mt-0.5 text-paragraph-xs text-text-soft-400'>
                        {founder.founder_role || 'Role under review'}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <strong className='inline-flex min-w-12 justify-center rounded-lg bg-orange-50 px-2 py-1 text-label-sm text-orange-600'>
                        {founder.search_match_score}
                      </strong>
                    </Table.Cell>
                    <Table.Cell>
                      <strong className='inline-flex min-w-10 justify-center rounded-lg bg-primary-alpha-10 px-2 py-1 text-label-sm text-primary-base'>
                        {founder.scouter_score ?? '—'}
                      </strong>
                    </Table.Cell>
                    <Table.Cell className='min-w-64'>
                      <div className='flex flex-wrap gap-1.5'>
                        {founder.why_matched.length ? (
                          founder.why_matched.map((reason) => (
                            <span
                              key={reason}
                              className='rounded-md bg-success-lighter px-2 py-1 text-label-xs text-success-dark'
                            >
                              {reason}
                            </span>
                          ))
                        ) : (
                          <span className='text-paragraph-xs text-text-soft-400'>
                            Matched by database text relevance
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className='min-w-56'>
                      <div className='flex flex-wrap gap-1.5'>
                        {founder.signal_tags.length ? (
                          founder.signal_tags.map((tag) => (
                            <span
                              key={tag}
                              className='rounded-md bg-bg-weak-50 px-2 py-1 text-label-xs text-text-sub-600'
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className='text-text-soft-400'>—</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className='min-w-[150px]'>
                      <div className='flex justify-end gap-3 text-label-sm'>
                        <button
                          type='button'
                          className='hover:underline'
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(founder.id);
                          }}
                        >
                          View
                        </button>
                        <button
                          type='button'
                          className='text-primary-base hover:underline'
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(founder.id);
                          }}
                        >
                          Add to List
                        </button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </div>

          <div className='flex items-center justify-between gap-4'>
            <p className='text-paragraph-sm text-text-sub-600'>
              Page {response.page} of {totalPages}
            </p>
            <div className='flex gap-2'>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={response.page <= 1}
                onClick={() => onPageChange(response.page - 1)}
              >
                Previous
              </Button.Root>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={response.page >= totalPages}
                onClick={() => onPageChange(response.page + 1)}
              >
                Next
              </Button.Root>
            </div>
          </div>
        </>
      ) : (
        <p className='rounded-2xl border border-stroke-soft-200 p-10 text-center text-paragraph-sm text-text-sub-600'>
          No founders matched this search.
        </p>
      )}

      {selected && (
        <FounderPreviewDrawer
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
