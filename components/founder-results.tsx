'use client';

import { useEffect, useState } from 'react';

import type { FounderProfile, FounderResults } from '@/lib/product-types';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';
import * as Table from '@/components/ui/table';
import { FounderDetailModal } from '@/components/founder-detail';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import { SortableScoreHead, type ScoreSortDirection } from '@/components/sortable-score-head';

function founderSignals(founder: FounderProfile) {
  const normalized = Array.isArray(founder.tags)
    ? founder.tags
        .map((tag) => {
          if (typeof tag === 'string') return tag;
          if (!tag || Array.isArray(tag) || typeof tag !== 'object')
            return null;
          const value = tag.name || tag.label || tag.value;
          return typeof value === 'string' ? value : null;
        })
        .filter((tag): tag is string => Boolean(tag))
    : [];
  return (
    normalized.length
      ? normalized
      : [founder.timing_label, founder.category_l1].filter(
          (tag): tag is string => Boolean(tag),
        )
  ).slice(0, 4);
}

function whyNow(founder: FounderProfile) {
  const source = founder.score_rationale || '';
  const evidence = source
    .match(/signals such as\s+(.+?)(?:;|\.|$)/i)?.[1]
    ?.split(/,| · /)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
  if (/recently left/i.test(`${founder.timing_label} ${source}`))
    return `Recently left signal · ${evidence || founder.timing_label || 'new founder activity'}`;
  return (
    evidence || founder.timing_label || 'Current Scouter signal available.'
  );
}

function fundingLabel(founder: FounderProfile, signals: string[]) {
  const source = `${founder.timing_label || ''} ${founder.score_rationale || ''} ${signals.join(' ')}`;
  if (/no (?:public )?funding|no funding found|unfunded/i.test(source))
    return 'No funding found';
  if (/seed.raising|raising.*seed/i.test(source)) return 'Seed raising';
  if (/pre-seed/i.test(source)) return 'Pre-seed';
  if (/funded|raised|funding/i.test(source)) return 'Funding visible';
  return 'Not available';
}
export function FounderCards({
  founders,
  onChanged,
}: {
  founders: FounderProfile[];
  onChanged?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {founders.map((founder) => (
          <button
            type='button'
            key={founder.id}
            onClick={() => setSelected(founder.id)}
            className='relative rounded-[20px] border border-stroke-soft-200 bg-bg-white-0 p-5 text-left shadow-regular-xs transition hover:bg-bg-weak-50'
          >
            <div className='flex items-center justify-between'>
              <span className='grid size-11 place-items-center rounded-full bg-primary-alpha-10 text-label-sm text-primary-base'>
                {founder.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')}
              </span>
              <strong
                title='Scouter score'
                data-score-status={founder.score_status}
                className='text-title-h6'
              >
                {founder.scouter_score ?? '—'}
              </strong>
            </div>
            <h3 className='mt-4 text-label-lg'>{founder.name}</h3>
            <p className='mt-1 text-paragraph-sm text-text-sub-600'>
              {[founder.founder_role, founder.company_name]
                .filter(Boolean)
                .join(' · ') || 'Company information unavailable'}
            </p>
            {founder.best_program_fit && (
              <p className='mt-2 text-label-xs text-primary-base'>
                Best Program Fit · {founder.best_program_fit.program_name}{' '}
                {founder.best_program_fit.fit_score}
              </p>
            )}
            <p className='mt-3 line-clamp-3 text-paragraph-sm text-text-soft-400'>
              {founder.score_rationale || 'No score rationale available.'}
            </p>
            <div className='mt-4 flex flex-wrap gap-2 text-label-xs text-text-sub-600'>
              {[founder.timing_label, founder.category_l1]
                .filter(Boolean)
                .map((value) => (
                  <span
                    key={value}
                    className='rounded-lg bg-bg-weak-50 px-2 py-1'
                  >
                    {value}
                  </span>
                ))}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <FounderDetailModal
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

export function FounderTable({
  founders,
  onChanged,
  sortDirection,
  onSortDirectionChange,
}: {
  founders: FounderProfile[];
  onChanged?: () => void;
  sortDirection: ScoreSortDirection;
  onSortDirectionChange: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className='overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-white-0'>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Founder</Table.Head>
              <Table.Head>Company / Role</Table.Head>
              <SortableScoreHead
                label='Scouter Score'
                direction={sortDirection}
                onToggle={onSortDirectionChange}
              />
              <Table.Head>Best Program Fit</Table.Head>
              <Table.Head>Strongest Signals</Table.Head>
              <Table.Head>Why Now</Table.Head>
              <Table.Head>Timing</Table.Head>
              <Table.Head>Funding / Stage</Table.Head>
              <Table.Head className='text-right'>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {founders.map((founder) => {
              const signals = founderSignals(founder);
              return (
                <Table.Row
                  key={founder.id}
                  tabIndex={0}
                  onClick={() => setSelected(founder.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ')
                      setSelected(founder.id);
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
                    <strong className='inline-flex min-w-10 justify-center rounded-lg bg-primary-alpha-10 px-2 py-1 text-label-sm text-primary-base'>
                      {founder.scouter_score ?? '—'}
                    </strong>
                  </Table.Cell>
                  <Table.Cell className='min-w-28'>
                    {founder.best_program_fit ? (
                      <div>
                        <div className='text-label-sm text-text-strong-950'>
                          {founder.best_program_fit.program_name}
                        </div>
                        <div className='text-label-xs text-primary-base'>
                          {founder.best_program_fit.fit_score}
                        </div>
                      </div>
                    ) : (
                      <span className='text-text-soft-400'>—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className='min-w-64'>
                    <div className='flex flex-wrap gap-1.5'>
                      {signals.length ? (
                        signals.map((tag) => (
                          <span
                            key={tag}
                            className='rounded-md bg-bg-weak-50 px-2 py-1 text-label-xs text-text-sub-600'
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className='text-paragraph-xs text-text-soft-400'>
                          No normalized signal tag
                        </span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell className='max-w-[260px] min-w-52'>
                    <p className='line-clamp-2 text-paragraph-sm text-text-sub-600'>
                      {whyNow(founder)}
                    </p>
                  </Table.Cell>
                  <Table.Cell className='max-w-[220px] min-w-44'>
                    <p className='line-clamp-2 text-paragraph-xs text-text-sub-600'>
                      {founder.timing_label || 'Not available'}
                    </p>
                  </Table.Cell>
                  <Table.Cell className='min-w-32 text-paragraph-xs text-text-sub-600'>
                    {fundingLabel(founder, signals)}
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
              );
            })}
          </Table.Body>
        </Table.Root>
      </div>
      {selected && (
        <FounderPreviewDrawer
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

export function FounderSearchResults({
  query = '',
  category,
  filter,
  view = 'cards',
}: {
  query?: string;
  category?: string;
  filter?: string;
  view?: 'cards' | 'table';
}) {
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<ScoreSortDirection>('desc');
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useProductData<FounderResults>(
    '/api/founders?q=' +
      encodeURIComponent(debounced) +
      '&page=' +
      page +
      '&sort=' +
      sortDirection +
      (category ? '&category=' + encodeURIComponent(category) : '') +
      (filter ? '&filter=' + encodeURIComponent(filter) : ''),
  );
  const count = result.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(count / 50));
  return (
    <section className='space-y-5' aria-label='Founder results'>
      {result.loading ? (
        <p
          role='status'
          className='py-10 text-center text-paragraph-sm text-text-sub-600'
        >
          Loading founders…
        </p>
      ) : result.error ? (
        <div
          role='alert'
          className='rounded-xl border border-error-lighter bg-error-lighter/20 p-4'
        >
          {result.error}
          <button
            className='ml-3 underline'
            onClick={() => void result.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <p className='text-label-sm text-text-sub-600'>{count} founders</p>
          {result.data?.founders.length ? (
            view === 'table' ? (
              <FounderTable
                founders={result.data.founders}
                onChanged={() => void result.reload()}
                sortDirection={sortDirection}
                onSortDirectionChange={() => {
                  setSortDirection((current) => current === 'desc' ? 'asc' : 'desc');
                  setPage(0);
                }}
              />
            ) : (
              <FounderCards
                founders={result.data.founders}
                onChanged={() => void result.reload()}
              />
            )
          ) : (
            <p className='rounded-xl border border-stroke-soft-200 p-8 text-center text-paragraph-sm text-text-sub-600'>
              No founders match your search.
            </p>
          )}
          <div className='flex items-center justify-between gap-4'>
            <p className='text-paragraph-sm text-text-sub-600'>
              Page {page + 1} of {totalPages}
            </p>
            <div className='flex gap-2'>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button.Root>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={(page + 1) * 50 >= count}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button.Root>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
