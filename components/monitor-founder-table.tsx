'use client';

import { useEffect, useMemo, useState } from 'react';

import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import * as Button from '@/components/ui/button';
import * as Table from '@/components/ui/table';
import { useProductData } from '@/hooks/use-product-data';
import type { FounderProfile, Json } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { SortableScoreHead, type ScoreSortDirection } from '@/components/sortable-score-head';

type MonitorRecord = {
  founder_id: string;
  status?: string;
  priority?: string;
};

type MonitorResults = {
  founders: FounderProfile[];
  monitors: MonitorRecord[];
};

function signalTags(value: Json) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, Json>;
      const label = record.name || record.label || record.tag || record.value;
      return typeof label === 'string' ? label : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);
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

  if (/recently left/i.test(`${founder.timing_label} ${source}`)) {
    return `Recently left signal · ${evidence || founder.timing_label || 'new founder activity'}`;
  }

  return evidence || founder.timing_label || 'Current Scouter signal available.';
}

function fundingLabel(founder: FounderProfile, tags: string[]) {
  const source = `${founder.timing_label || ''} ${founder.score_rationale || ''} ${tags.join(' ')}`;
  if (/no (?:public )?funding|no funding found|unfunded/i.test(source)) {
    return 'No funding found';
  }
  if (/seed.raising|raising.*seed/i.test(source)) return 'Seed raising';
  if (/pre-seed/i.test(source)) return 'Pre-seed';
  if (/funded|raised|funding/i.test(source)) return 'Funding visible';
  return 'Not available';
}

export function MonitorFounderTable({
  onCountChange,
}: {
  onCountChange: (count: number | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [score, setScore] = useState<'95' | '90' | 'all'>('all');
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<ScoreSortDirection>('desc');
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const result = useProductData<MonitorResults>('/api/monitor');

  useEffect(() => {
    onCountChange(result.data?.founders.length ?? null);
  }, [onCountChange, result.data?.founders.length]);

  const filteredFounders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minimumScore = score === 'all' ? 0 : Number(score);

    return (result.data?.founders || []).filter((founder) => {
      const matchesScore = (founder.scouter_score || 0) >= minimumScore;
      const matchesQuery =
        !normalizedQuery ||
        [
          founder.name,
          founder.company_name,
          founder.founder_role,
          founder.timing_label,
          founder.score_rationale,
          ...signalTags(founder.tags),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesScore && matchesQuery;
    }).sort((left, right) => {
      const leftScore = left.scouter_score ?? -1;
      const rightScore = right.scouter_score ?? -1;
      return sortDirection === 'desc'
        ? rightScore - leftScore || left.name.localeCompare(right.name)
        : leftScore - rightScore || left.name.localeCompare(right.name);
    });
  }, [query, result.data?.founders, score, sortDirection]);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredFounders.length / pageSize));
  const founders = filteredFounders.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  async function removeFromMonitor(founderId: string) {
    if (pendingRemove) return;
    setPendingRemove(founderId);
    setActionError('');

    try {
      await requestJson(`/api/monitor?founderId=${encodeURIComponent(founderId)}`, {
        method: 'DELETE',
      });
      if (selected === founderId) setSelected(null);
      await result.reload();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not remove founder from Monitor.',
      );
    } finally {
      setPendingRemove(null);
    }
  }

  return (
    <section className='space-y-5' aria-label='Monitored founder results'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <input
          aria-label='Search monitored founders'
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder='Search founders, companies, roles, or signals…'
          className='h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 lg:max-w-md'
        />
        <div
          className='flex items-center gap-1 rounded-xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200'
          aria-label='Score filter'
        >
          {([
            ['95', '95+'],
            ['90', '90+'],
            ['all', 'All'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type='button'
              aria-pressed={score === value}
              onClick={() => {
                setScore(value);
                setPage(0);
              }}
              className={`rounded-lg px-4 py-2 text-label-sm transition ${
                score === value
                  ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-xs'
                  : 'text-text-sub-600 hover:text-text-strong-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <p role='alert' className='text-paragraph-sm text-error-base'>
          {actionError}
        </p>
      )}

      {result.loading ? (
        <p
          role='status'
          className='py-10 text-center text-paragraph-sm text-text-sub-600'
        >
          Loading Monitor…
        </p>
      ) : result.error ? (
        <div
          role='alert'
          className='rounded-xl border border-error-lighter bg-error-lighter/20 p-4'
        >
          {result.error}
          <button className='ml-3 underline' onClick={() => void result.reload()}>
            Retry
          </button>
        </div>
      ) : founders.length ? (
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
                    onToggle={() => {
                      setSortDirection((current) => current === 'desc' ? 'asc' : 'desc');
                      setPage(0);
                    }}
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
                  const tags = signalTags(founder.tags);
                  return (
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
                          {tags.length ? (
                            tags.map((tag) => (
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
                        {fundingLabel(founder, tags)}
                      </Table.Cell>
                      <Table.Cell className='min-w-[190px]'>
                        <div className='flex justify-end gap-3 text-label-sm'>
                          <button
                            type='button'
                            disabled={pendingRemove === founder.id}
                            className='hover:underline disabled:text-text-soft-400'
                            onClick={(event) => {
                              event.stopPropagation();
                              void removeFromMonitor(founder.id);
                            }}
                          >
                            {pendingRemove === founder.id ? 'Removing…' : 'Remove'}
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

          <div className='flex items-center justify-between gap-4'>
            <p className='text-paragraph-sm text-text-sub-600'>
              Page {page + 1} of {totalPages}
            </p>
            <div className='flex gap-2'>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={page === 0}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button.Root>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button.Root>
            </div>
          </div>
        </>
      ) : (
        <p className='rounded-xl border border-stroke-soft-200 p-8 text-center text-paragraph-sm text-text-sub-600'>
          {result.data?.founders.length
            ? 'No monitored founders match this score filter and search.'
            : 'No founders are being monitored yet. Add founders from discovery.'}
        </p>
      )}

      {selected && (
        <FounderPreviewDrawer
          key={selected}
          id={selected}
          wide
          onClose={() => setSelected(null)}
          onChanged={() => void result.reload()}
        />
      )}
    </section>
  );
}
