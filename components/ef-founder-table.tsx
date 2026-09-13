'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Button from '@/components/ui/button';
import * as Table from '@/components/ui/table';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import { useProductData } from '@/hooks/use-product-data';
import { requestJson } from '@/lib/request-json';
import type { FounderProfile } from '@/lib/product-types';

type EfFounderResults = {
  founders: FounderProfile[];
  count: number;
  page: number;
  pageSize: number;
};

export function EfFounderTable({ onCountChange }: { onCountChange: (count: number | null) => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState('score_desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingMonitor, setPendingMonitor] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const resultUrl = useMemo(
    () =>
      `/api/ef?page=${page}&sort=${encodeURIComponent(sort)}&q=${encodeURIComponent(debouncedQuery)}`,
    [debouncedQuery, page, sort],
  );
  const result = useProductData<EfFounderResults>(resultUrl);
  const monitor = useProductData<{ monitors: { founder_id: string }[] }>('/api/monitor');
  const monitoredIds = useMemo(
    () => new Set((monitor.data?.monitors || []).map((item) => item.founder_id)),
    [monitor.data],
  );

  useEffect(() => {
    onCountChange(result.data?.count ?? null);
  }, [onCountChange, result.data?.count]);

  async function addToMonitor(founderId: string) {
    if (pendingMonitor || monitoredIds.has(founderId)) return;
    setPendingMonitor(founderId);
    setActionError('');
    try {
      await requestJson('/api/monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ founderId }),
      });
      await monitor.reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not add founder to Monitor.',
      );
    } finally {
      setPendingMonitor(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil((result.data?.count || 0) / 25));

  return (
    <section className='space-y-5' aria-label='EF founder results'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <input
          aria-label='Search EF founders'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search EF founders…'
          className='h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 md:max-w-md'
        />
        <label className='flex items-center gap-2 text-label-sm text-text-sub-600'>
          Sort
          <select
            aria-label='Sort EF founders'
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(0);
            }}
            className='h-10 rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-text-strong-950'
          >
            <option value='score_desc'>Highest score</option>
            <option value='score_asc'>Lowest score</option>
            <option value='name_asc'>Founder name</option>
          </select>
        </label>
      </div>

      {actionError && <p role='alert' className='text-paragraph-sm text-error-base'>{actionError}</p>}

      {result.loading ? (
        <p role='status' className='py-10 text-center text-paragraph-sm text-text-sub-600'>Loading EF founders…</p>
      ) : result.error ? (
        <div role='alert' className='rounded-xl border border-error-lighter bg-error-lighter/20 p-4'>
          {result.error}
          <button className='ml-3 underline' onClick={() => void result.reload()}>Retry</button>
        </div>
      ) : result.data?.founders.length ? (
        <>
          <div className='overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-white-0'>
            <Table.Root className='w-full'>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Founder</Table.Head>
                  <Table.Head>Company</Table.Head>
                  <Table.Head>Founder Role</Table.Head>
                  <Table.Head>Category</Table.Head>
                  <Table.Head>Timing</Table.Head>
                  <Table.Head>Scouter Score</Table.Head>
                  <Table.Head>Best Program Fit</Table.Head>
                  <Table.Head>Why Flagged</Table.Head>
                  <Table.Head className='text-right'>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {result.data.founders.map((founder) => {
                  const monitored = monitoredIds.has(founder.id);
                  return (
                    <Table.Row key={founder.id}>
                      <Table.Cell className='min-w-44'>
                        <button
                          type='button'
                          onClick={() => setSelected(founder.id)}
                          className='text-left text-label-sm text-primary-base hover:underline'
                        >
                          {founder.name}
                        </button>
                      </Table.Cell>
                      <Table.Cell className='min-w-36 text-paragraph-sm'>{founder.company_name || '—'}</Table.Cell>
                      <Table.Cell className='min-w-40 text-paragraph-sm text-text-sub-600'>{founder.founder_role || '—'}</Table.Cell>
                      <Table.Cell className='min-w-36 text-paragraph-sm text-text-sub-600'>{founder.category_l1 || '—'}</Table.Cell>
                      <Table.Cell className='min-w-32 text-paragraph-sm text-text-sub-600'>{founder.timing_label || '—'}</Table.Cell>
                      <Table.Cell>
                        <strong
                          title={[founder.score_status, founder.score_rationale].filter(Boolean).join(' · ')}
                          data-score-status={founder.score_status || undefined}
                          className='inline-flex min-w-10 justify-center rounded-lg bg-primary-alpha-10 px-2 py-1 text-label-sm text-primary-base'
                        >
                          {founder.scouter_score ?? '—'}
                        </strong>
                      </Table.Cell>
                      <Table.Cell className='min-w-32'>
                        {founder.best_program_fit ? <div><div className='text-label-sm text-text-strong-950'>{founder.best_program_fit.program_name}</div><div className='text-label-xs text-primary-base'>{founder.best_program_fit.fit_score}</div></div> : <span className='text-text-soft-400'>—</span>}
                      </Table.Cell>
                      <Table.Cell className='max-w-[280px] min-w-56'>
                        <p className='line-clamp-2 text-paragraph-sm text-text-sub-600'>{founder.score_rationale || 'No score rationale available.'}</p>
                      </Table.Cell>
                      <Table.Cell className='min-w-[260px]'>
                        <div className='flex justify-end gap-3 text-label-sm'>
                          <button className='text-primary-base hover:underline' onClick={() => setSelected(founder.id)}>View Founder</button>
                          <button
                            disabled={monitored || pendingMonitor === founder.id || monitor.loading}
                            className='hover:underline disabled:text-text-soft-400'
                            onClick={() => void addToMonitor(founder.id)}
                          >
                            {monitored ? 'Monitored' : 'Monitor'}
                          </button>
                          <button className='hover:underline' onClick={() => setSelected(founder.id)}>Add to List</button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </div>

          <div className='flex items-center justify-between gap-4'>
            <p className='text-paragraph-sm text-text-sub-600'>Page {page + 1} of {totalPages}</p>
            <div className='flex gap-2'>
              <Button.Root variant='neutral' mode='stroke' disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button.Root>
              <Button.Root variant='neutral' mode='stroke' disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button.Root>
            </div>
          </div>
        </>
      ) : (
        <p className='rounded-xl border border-stroke-soft-200 p-8 text-center text-paragraph-sm text-text-sub-600'>No EF founders match your search.</p>
      )}

      {selected && (
        <FounderPreviewDrawer
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void result.reload();
            void monitor.reload();
          }}
        />
      )}
    </section>
  );
}
