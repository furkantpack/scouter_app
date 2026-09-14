'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/header';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import * as Button from '@/components/ui/button';
import * as Table from '@/components/ui/table';
import { useProductData } from '@/hooks/use-product-data';
import { programFitLabels } from '@/lib/program-fit';
import type { FounderProfile } from '@/lib/product-types';

type RankedFounder = FounderProfile & { signal_tags: string[]; program_fit: { fit_score: number; fit_band: string | null; top_matches: unknown } };
type Result = { program: { id: string; name: string; region: string; archetype: string }; founders: RankedFounder[]; count: number; page: number; pageSize: number; fit: string };

export default function ProgramDetailPage({ params }: { params: { programId: string } }) {
  const [page, setPage] = useState(0);
  const [fit, setFit] = useState<'90' | '85' | '75'>('90');
  const [selected, setSelected] = useState<string | null>(null);
  const url = useMemo(() => `/api/programs/${encodeURIComponent(params.programId)}?page=${page}&fit=${fit}`, [fit, page, params.programId]);
  const result = useProductData<Result>(url);
  const totalPages = Math.max(1, Math.ceil((result.data?.count || 0) / (result.data?.pageSize || 25)));
  const program = result.data?.program;
  return <>
    <Header title={program?.name || 'Program Fit'} description={program?.archetype || 'Founders ranked by similarity to this program’s current cohort DNA.'} />
    <main className='space-y-5 px-4 pb-8 lg:px-8'>
      {program?.region && <p className='text-label-sm text-text-sub-600'>{program.region} · Program Fit is not an acceptance probability.</p>}
      <div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-label-lg text-text-strong-950'>Top Matching Founders</h2><div className='flex items-center gap-1 rounded-xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200'>{([['90', '90+'], ['85', '85+'], ['75', '75+']] as const).map(([value, label]) => <button key={value} type='button' aria-pressed={fit === value} onClick={() => { setFit(value); setPage(0); }} className={`rounded-lg px-3 py-2 text-label-sm ${fit === value ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-xs' : 'text-text-sub-600'}`}>{label}</button>)}</div></div>
      {result.loading ? <p role='status' className='py-10 text-center text-paragraph-sm text-text-sub-600'>Loading founder ranking…</p> : result.error ? <div role='alert' className='rounded-xl border border-error-lighter p-4 text-error-base'>{result.error}<button className='ml-3 underline' onClick={() => void result.reload()}>Retry</button></div> : result.data?.founders.length ? <><div className='overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-white-0'><Table.Root><Table.Header><Table.Row><Table.Head>Founder</Table.Head><Table.Head>Current Company</Table.Head><Table.Head>Scouter Score</Table.Head><Table.Head>{program?.name || 'Program'} Fit</Table.Head><Table.Head>Strongest Signals</Table.Head><Table.Head>Why Now</Table.Head><Table.Head className='text-right'>Actions</Table.Head></Table.Row></Table.Header><Table.Body>{result.data.founders.map((founder) => <Table.Row key={founder.id} className='cursor-pointer' onClick={() => setSelected(founder.id)}><Table.Cell className='min-w-44 text-label-sm text-text-strong-950'>{founder.name}</Table.Cell><Table.Cell className='min-w-44'><div className='text-label-sm text-text-strong-950'>{founder.company_name || 'Stealth / pre-company'}</div><div className='text-paragraph-xs text-text-soft-400'>{founder.founder_role || 'Founder'}</div></Table.Cell><Table.Cell><strong className='rounded-lg bg-bg-weak-50 px-2 py-1 text-label-sm text-text-strong-950'>{founder.scouter_score ?? '—'}</strong></Table.Cell><Table.Cell><div className='text-label-md text-primary-base'>{founder.program_fit.fit_score}</div><div className='text-label-xs text-text-soft-400'>{founder.program_fit.fit_band || 'Program Fit'}</div></Table.Cell><Table.Cell className='min-w-52'><p className='line-clamp-2 text-paragraph-xs capitalize text-text-sub-600'>{programFitLabels(founder.program_fit.top_matches, 3).join(' · ') || founder.signal_tags.slice(0, 3).join(' · ') || '—'}</p></Table.Cell><Table.Cell className='max-w-64'><p className='line-clamp-2 text-paragraph-sm text-text-sub-600'>{founder.timing_label || founder.score_rationale?.split(/[.;]/)[0] || 'Current signal under review.'}</p></Table.Cell><Table.Cell className='text-right'><button type='button' className='text-label-sm text-primary-base hover:underline' onClick={(event) => { event.stopPropagation(); setSelected(founder.id); }}>View / Add to List</button></Table.Cell></Table.Row>)}</Table.Body></Table.Root></div><div className='flex items-center justify-between'><p className='text-paragraph-sm text-text-sub-600'>Page {page + 1} of {totalPages}</p><div className='flex gap-2'><Button.Root variant='neutral' mode='stroke' disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button.Root><Button.Root variant='neutral' mode='stroke' disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button.Root></div></div></> : <div className='rounded-2xl border border-dashed border-stroke-soft-200 p-10 text-center'><h2 className='text-label-lg text-text-strong-950'>No Program Fit data yet.</h2><p className='mt-2 text-paragraph-sm text-text-sub-600'>No founders match this program and filter.</p></div>}
    </main>
    {selected && <FounderPreviewDrawer key={selected} id={selected} onClose={() => setSelected(null)} onChanged={() => void result.reload()} />}
  </>;
}
