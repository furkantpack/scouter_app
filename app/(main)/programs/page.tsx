'use client';

import Link from 'next/link';

import Header from '@/components/header';
import { useProductData } from '@/hooks/use-product-data';

type Program = { id: string; program_id: string; name: string; program_name: string; region: string; archetype: string; scored_founders: number; fit_90_plus: number; average_fit: number };

export default function ProgramsPage() {
  const result = useProductData<{ programs: Program[] }>('/api/programs');
  return (
    <>
      <Header title='Program Fit' description='Discover founders whose current profile most closely matches leading accelerator and early-stage program DNA.' />
      <main className='px-4 pb-8 lg:px-8'>
        {result.loading ? <p role='status' className='py-12 text-center text-paragraph-sm text-text-sub-600'>Loading Program Fit…</p> : result.error ? <div role='alert' className='rounded-xl border border-error-lighter p-4 text-error-base'>{result.error}<button className='ml-3 underline' onClick={() => void result.reload()}>Retry</button></div> : result.data?.programs.length ? (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {result.data.programs.map((program) => <Link key={program.program_id} href={`/programs/${program.program_id}`} className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 transition hover:border-primary-base/30 hover:shadow-regular-sm'><div className='flex items-start justify-between gap-4'><div><h2 className='text-label-lg text-text-strong-950'>{program.name || program.program_name}</h2><p className='mt-1 text-label-xs text-text-soft-400'>{program.region}</p></div><span className='rounded-lg bg-primary-alpha-10 px-2 py-1 text-label-sm text-primary-base'>{program.average_fit}</span></div><p className='mt-4 line-clamp-2 text-paragraph-sm text-text-sub-600'>{program.archetype}</p><dl className='mt-5 grid grid-cols-2 gap-3 border-t border-stroke-soft-200 pt-4'><div><dt className='text-label-xs text-text-soft-400'>Scored founders</dt><dd className='mt-1 text-label-md'>{program.scored_founders}</dd></div><div><dt className='text-label-xs text-text-soft-400'>90+ Fit</dt><dd className='mt-1 text-label-md'>{program.fit_90_plus}</dd></div></dl></Link>)}
          </div>
        ) : <div className='rounded-2xl border border-dashed border-stroke-soft-200 p-12 text-center'><h2 className='text-label-lg text-text-strong-950'>Program Fit data has not been generated yet.</h2><p className='mt-2 text-paragraph-sm text-text-sub-600'>Programs will appear here after current founder fits are persisted.</p></div>}
      </main>
    </>
  );
}
