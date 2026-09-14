'use client';

import Link from 'next/link';
import {
  RiArrowRightUpLongLine,
  RiGlobalLine,
  RiMedalLine,
  RiTeamLine,
} from '@remixicon/react';

import { useProductData } from '@/hooks/use-product-data';
import { DashedDivider } from '@/components/dashed-divider';
import Header from '@/components/header';

type Program = {
  id: string;
  program_id: string;
  name: string;
  program_name: string;
  region: string;
  archetype: string;
  fit_90_plus: number;
  average_fit: number;
  logoDomain?: string;
};

const palette = [
  ['#F97316', '#FFF7ED'],
  ['#2563EB', '#EFF6FF'],
  ['#059669', '#ECFDF5'],
  ['#7C3AED', '#F5F3FF'],
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function programLabels(program: Program) {
  const labels = program.region
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
  const archetype = program.archetype.toLowerCase();
  if (/technical|technologist|builder/.test(archetype))
    labels.push('Technical');
  else if (/enterprise|b2b/.test(archetype)) labels.push('B2B');
  else if (/pre-seed|day-zero|before a fixed company/.test(archetype))
    labels.push('Pre-seed');
  return Array.from(new Set(labels)).slice(0, 3);
}

export default function ProgramsPage() {
  const result = useProductData<{ programs: Program[] }>('/api/programs');

  return (
    <>
      <Header
        title='Program Fit'
        description='Discover founders whose current profile most closely matches leading accelerator and early-stage program DNA.'
      />
      <main className='px-4 pb-10 lg:px-8'>
        <DashedDivider />
        <div className='py-6'>
          <h2 className='text-label-lg text-text-strong-950'>Programs</h2>
          <p className='mt-1 text-label-sm text-text-soft-400'>
            Strong founder matches with a persisted Program Fit of 90 or above.
          </p>
        </div>

        {result.loading ? (
          <p
            role='status'
            className='py-12 text-center text-paragraph-sm text-text-sub-600'
          >
            Loading Program Fit…
          </p>
        ) : result.error ? (
          <div
            role='alert'
            className='rounded-xl border border-error-lighter p-4 text-error-base'
          >
            {result.error}
            <button
              className='ml-3 underline'
              onClick={() => void result.reload()}
            >
              Retry
            </button>
          </div>
        ) : result.data?.programs.length ? (
          <div className='grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3'>
            {result.data.programs.map((program, index) => {
              const name = program.name || program.program_name;
              const [accent, soft] = palette[index % palette.length];
              const labels = programLabels(program);
              return (
                <Link
                  key={program.program_id}
                  href={`/programs/${program.program_id}`}
                  className='group relative flex min-h-[330px] flex-col overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-regular-md'
                >
                  <span
                    className='pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80'
                    style={{
                      background: `linear-gradient(180deg, ${soft} 0%, rgba(255,255,255,0) 100%)`,
                    }}
                  />
                  <div className='relative flex items-start justify-between gap-4'>
                    <div className='flex min-w-0 items-center gap-3'>
                      <span
                        className='flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-14 text-label-md font-medium ring-1 ring-inset'
                        style={{
                          backgroundColor: soft,
                          color: accent,
                          boxShadow: `inset 0 0 0 1px ${accent}24`,
                        }}
                      >
                        {program.logoDomain ? (
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${program.logoDomain}&sz=128`}
                            alt={`${name} logo`}
                            className='size-7 rounded-md object-contain'
                          />
                        ) : (
                          initials(name)
                        )}
                      </span>
                      <div className='min-w-0'>
                        <h3 className='truncate text-label-lg text-text-strong-950'>
                          {name}
                        </h3>
                        <p className='mt-1 truncate text-label-sm text-text-soft-400'>
                          {program.region || 'Global program'}
                        </p>
                      </div>
                    </div>
                    <RiArrowRightUpLongLine
                      className='size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                      style={{ color: accent }}
                    />
                  </div>

                  <div className='relative mt-6 flex-1 border-y border-stroke-soft-200 py-4'>
                    <div
                      className='mb-3 flex items-center gap-2 text-label-xs font-medium'
                      style={{ color: accent }}
                    >
                      <RiMedalLine className='size-4' />
                      Program DNA
                    </div>
                    <p className='line-clamp-3 text-paragraph-sm leading-6 text-text-sub-600'>
                      {program.archetype}
                    </p>
                    {labels.length > 0 && (
                      <div className='mt-4 flex flex-wrap gap-2'>
                        {labels.map((label) => (
                          <span
                            key={label}
                            className='rounded-lg bg-bg-weak-50 px-2.5 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className='mt-5 grid grid-cols-3 divide-x divide-stroke-soft-200'>
                    <div className='pr-3'>
                      <RiTeamLine
                        className='mb-2 size-4'
                        style={{ color: accent }}
                      />
                      <strong className='block text-label-md text-text-strong-950'>
                        {program.fit_90_plus}
                      </strong>
                      <span className='text-label-xs text-text-soft-400'>
                        Matching founders
                      </span>
                    </div>
                    <div className='px-3'>
                      <RiMedalLine
                        className='mb-2 size-4'
                        style={{ color: accent }}
                      />
                      <strong
                        className='block text-label-md'
                        style={{ color: accent }}
                      >
                        90+
                      </strong>
                      <span className='text-label-xs text-text-soft-400'>
                        Fit threshold
                      </span>
                    </div>
                    <div className='pl-3'>
                      <RiGlobalLine
                        className='mb-2 size-4'
                        style={{ color: accent }}
                      />
                      <strong className='block truncate text-label-md text-text-strong-950'>
                        {labels[0] || 'Global'}
                      </strong>
                      <span className='text-label-xs text-text-soft-400'>
                        Scope
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className='rounded-2xl border border-dashed border-stroke-soft-200 p-12 text-center'>
            <h2 className='text-label-lg text-text-strong-950'>
              Program Fit data has not been generated yet.
            </h2>
            <p className='mt-2 text-paragraph-sm text-text-sub-600'>
              Programs will appear here after current founder fits are
              persisted.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
