'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Button from '@/components/ui/button';
import * as Table from '@/components/ui/table';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import { useProductData } from '@/hooks/use-product-data';
import { requestJson } from '@/lib/request-json';
import type { FounderProfile } from '@/lib/product-types';
import { SortableScoreHead, type ScoreSortDirection } from '@/components/sortable-score-head';

type TopFounder = FounderProfile & { signal_tags: string[] };
type TopFounderResults = { founders: TopFounder[]; count: number; page: number; pageSize: number; score: '95' | '90' | 'all' };

function whyNow(founder: TopFounder) {
  const source = founder.score_rationale || '';
  const evidence = source.match(/signals such as\s+(.+?)(?:;|\.|$)/i)?.[1]?.split(/,| · /).map((item) => item.trim()).filter(Boolean).slice(0, 2).join(' · ');
  if (/recently left/i.test(`${founder.timing_label} ${source}`)) return `Recently left signal · ${evidence || founder.timing_label || 'new founder activity'}`;
  return evidence || founder.timing_label || 'Current Scouter signal available.';
}

function fundingLabel(founder: TopFounder) {
  const source = `${founder.timing_label || ''} ${founder.score_rationale || ''} ${founder.signal_tags.join(' ')}`;
  if (/no (?:public )?funding|no funding found|unfunded/i.test(source)) return 'No funding found';
  if (/seed.raising|raising.*seed/i.test(source)) return 'Seed raising';
  if (/pre-seed/i.test(source)) return 'Pre-seed';
  if (/funded|raised|funding/i.test(source)) return 'Funding visible';
  return 'Not available';
}

export function TopFounderTable({ onCountChange }: { onCountChange: (count: number | null) => void }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [score, setScore] = useState<'95' | '90' | 'all'>('95');
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<ScoreSortDirection>('desc');
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingMonitor, setPendingMonitor] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(query); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const resultUrl = useMemo(() => `/api/top-founders?page=${page}&score=${score}&sort=${sortDirection}&q=${encodeURIComponent(debouncedQuery)}`, [debouncedQuery, page, score, sortDirection]);
  const result = useProductData<TopFounderResults>(resultUrl);
  const monitor = useProductData<{ monitors: { founder_id: string }[] }>('/api/monitor');
  const monitoredIds = useMemo(() => new Set((monitor.data?.monitors || []).map((item) => item.founder_id)), [monitor.data]);

  useEffect(() => { onCountChange(result.data?.count ?? null); }, [onCountChange, result.data?.count]);

  async function addToMonitor(founderId: string) {
    if (pendingMonitor || monitoredIds.has(founderId)) return;
    setPendingMonitor(founderId); setActionError('');
    try {
      await requestJson('/api/monitor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ founderId }) });
      await monitor.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not add founder to Monitor.');
    } finally { setPendingMonitor(null); }
  }

  const pageSize = result.data?.pageSize || 25;
  const totalPages = Math.max(1, Math.ceil((result.data?.count || 0) / pageSize));

  return (
    <section className='space-y-5' aria-label='Top founder results'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <input aria-label='Search top founders' value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search founders, companies, roles, or signals…' className='h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 lg:max-w-md' />
        <div className='flex items-center gap-1 rounded-xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200' aria-label='Score filter'>
          {([['95', '95+'], ['90', '90+'], ['all', 'All']] as const).map(([value, label]) => (
            <button key={value} type='button' aria-pressed={score === value} onClick={() => { setScore(value); setPage(0); }} className={`rounded-lg px-4 py-2 text-label-sm transition ${score === value ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-xs' : 'text-text-sub-600 hover:text-text-strong-950'}`}>{label}</button>
          ))}
        </div>
      </div>

      {actionError && <p role='alert' className='text-paragraph-sm text-error-base'>{actionError}</p>}
      {result.loading ? (
        <p role='status' className='py-10 text-center text-paragraph-sm text-text-sub-600'>Loading Top Founders…</p>
      ) : result.error ? (
        <div role='alert' className='rounded-xl border border-error-lighter bg-error-lighter/20 p-4'>{result.error}<button className='ml-3 underline' onClick={() => void result.reload()}>Retry</button></div>
      ) : result.data?.founders.length ? (
        <>
          <div className='overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-white-0'>
            <Table.Root>
              <Table.Header><Table.Row><Table.Head>Founder</Table.Head><Table.Head>Company / Role</Table.Head><SortableScoreHead label='Scouter Score' direction={sortDirection} onToggle={() => { setSortDirection((current) => current === 'desc' ? 'asc' : 'desc'); setPage(0); }} /><Table.Head>Best Program Fit</Table.Head><Table.Head>Strongest Signals</Table.Head><Table.Head>Why Now</Table.Head><Table.Head>Timing</Table.Head><Table.Head>Funding / Stage</Table.Head><Table.Head className='text-right'>Actions</Table.Head></Table.Row></Table.Header>
              <Table.Body>
                {result.data.founders.map((founder) => {
                  const monitored = monitoredIds.has(founder.id);
                  return (
                    <Table.Row key={founder.id} tabIndex={0} onClick={() => setSelected(founder.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(founder.id); }} className='cursor-pointer [&>td]:border-b [&>td]:border-stroke-soft-200/70 last:[&>td]:border-b-0 focus:outline-none focus:ring-2 focus:ring-primary-base/30'>
                      <Table.Cell className='min-w-44'><span className='text-label-sm text-text-strong-950'>{founder.name}</span></Table.Cell>
                      <Table.Cell className='min-w-52'><div className='text-label-sm text-text-strong-950'>{founder.company_name || 'Stealth / pre-company'}</div><div className='mt-0.5 text-paragraph-xs text-text-soft-400'>{founder.founder_role || 'Role under review'}</div></Table.Cell>
                      <Table.Cell><strong className='inline-flex min-w-10 justify-center rounded-lg bg-primary-alpha-10 px-2 py-1 text-label-sm text-primary-base'>{founder.scouter_score ?? '—'}</strong></Table.Cell>
                      <Table.Cell className='min-w-28'>{founder.best_program_fit ? <div><div className='text-label-sm text-text-strong-950'>{founder.best_program_fit.program_name}</div><div className='text-label-xs text-primary-base'>{founder.best_program_fit.fit_score}</div></div> : <span className='text-text-soft-400'>—</span>}</Table.Cell>
                      <Table.Cell className='min-w-64'><div className='flex flex-wrap gap-1.5'>{founder.signal_tags.length ? founder.signal_tags.map((tag) => <span key={tag} className='rounded-md bg-bg-weak-50 px-2 py-1 text-label-xs text-text-sub-600'>{tag}</span>) : <span className='text-paragraph-xs text-text-soft-400'>No normalized signal tag</span>}</div></Table.Cell>
                      <Table.Cell className='max-w-[260px] min-w-52'><p className='line-clamp-2 text-paragraph-sm text-text-sub-600'>{whyNow(founder)}</p></Table.Cell>
                      <Table.Cell className='max-w-[220px] min-w-44'><p className='line-clamp-2 text-paragraph-xs text-text-sub-600'>{founder.timing_label || 'Not available'}</p></Table.Cell>
                      <Table.Cell className='min-w-32 text-paragraph-xs text-text-sub-600'>{fundingLabel(founder)}</Table.Cell>
                      <Table.Cell className='min-w-[190px]'><div className='flex justify-end gap-3 text-label-sm'>
                        <button type='button' disabled={monitored || pendingMonitor === founder.id || monitor.loading} className='hover:underline disabled:text-text-soft-400' onClick={(event) => { event.stopPropagation(); void addToMonitor(founder.id); }}>{monitored ? 'Monitored' : 'Monitor'}</button>
                        <button type='button' className='text-primary-base hover:underline' onClick={(event) => { event.stopPropagation(); setSelected(founder.id); }}>Add to List</button>
                      </div></Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          </div>
          <div className='flex items-center justify-between gap-4'><p className='text-paragraph-sm text-text-sub-600'>Page {page + 1} of {totalPages}</p><div className='flex gap-2'><Button.Root variant='neutral' mode='stroke' disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button.Root><Button.Root variant='neutral' mode='stroke' disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button.Root></div></div>
        </>
      ) : <p className='rounded-xl border border-stroke-soft-200 p-8 text-center text-paragraph-sm text-text-sub-600'>No founders match this score filter and search.</p>}

      {selected && <FounderPreviewDrawer key={selected} id={selected} onClose={() => setSelected(null)} onChanged={() => { void result.reload(); void monitor.reload(); }} />}
    </section>
  );
}
