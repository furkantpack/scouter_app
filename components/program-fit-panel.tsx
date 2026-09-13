'use client';

import { useState } from 'react';

import type { ProgramFitDetail } from '@/lib/program-fit';
import { programFitLabels } from '@/lib/program-fit';

function score(value: number | null) {
  return value == null ? '—' : Number(value.toFixed(1));
}

export function ProgramFitPanel({ fits, mode = 'full', onViewFull }: { fits: ProgramFitDetail[]; mode?: 'preview' | 'full'; onViewFull?: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = mode === 'preview' ? fits.slice(0, 5) : fits;
  if (!fits.length) return <p className='rounded-xl border border-dashed border-stroke-soft-200 p-5 text-paragraph-sm text-text-sub-600'>No Program Fit data yet.</p>;
  const bestMatches = programFitLabels(fits[0].top_matches, 3);
  return (
    <div className='space-y-4'>
      {mode === 'full' && (
        <div className='rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-5'>
          <p className='text-subheading-xs uppercase text-text-soft-400'>Best Fit</p>
          <div className='mt-2 flex items-end justify-between gap-4'>
            <div><h3 className='text-title-h5 text-text-strong-950'>{fits[0].program_name}</h3><p className='mt-1 text-label-sm text-text-sub-600'>{fits[0].fit_band || 'Program Fit'}</p></div>
            <strong className='text-title-h3 text-primary-base'>{score(fits[0].fit_score)}</strong>
          </div>
          {bestMatches.length > 0 && <p className='mt-3 text-paragraph-sm capitalize text-text-sub-600'>{bestMatches.join(' · ')}</p>}
        </div>
      )}
      <div className='overflow-hidden rounded-xl border border-stroke-soft-200'>
        {mode === 'full' && <div className='grid grid-cols-[minmax(150px,1.2fr)_minmax(100px,2fr)_56px] gap-3 bg-bg-weak-50 px-4 py-2 text-subheading-xs uppercase text-text-soft-400'><span>Program / Fit Band</span><span>Why It Fits / Key Gap</span><span className='text-right'>Fit</span></div>}
        {visible.map((fit) => {
          const matches = programFitLabels(fit.top_matches, mode === 'preview' ? 3 : 2);
          const gaps = programFitLabels(fit.top_gaps, 1);
          const open = expanded === fit.program_id;
          return (
            <div key={fit.program_id} className='border-b border-stroke-soft-200 last:border-b-0'>
              <button type='button' disabled={mode === 'preview'} onClick={() => setExpanded(open ? null : fit.program_id)} className='grid w-full grid-cols-[minmax(150px,1.2fr)_minmax(100px,2fr)_56px] items-center gap-3 px-4 py-3 text-left disabled:cursor-default'>
                <div><div className='text-label-sm text-text-strong-950'>{fit.program_name}</div>{fit.fit_band && <div className='mt-0.5 text-label-xs text-text-soft-400'>{fit.fit_band}</div>}</div>
                <div>{matches.length > 0 && <p className='truncate text-paragraph-xs capitalize text-text-sub-600'>{matches.join(' · ')}</p>}{mode === 'full' && gaps.length > 0 && <p className='mt-0.5 truncate text-paragraph-xs capitalize text-text-soft-400'>Gap: {gaps[0]}</p>}</div>
                <div className='text-right'><strong className='text-label-md text-primary-base'>{score(fit.fit_score)}</strong>{mode === 'full' && <div className='text-[10px] text-text-soft-400'>{open ? 'Hide' : 'Details'}</div>}</div>
              </button>
              {mode === 'full' && open && (
                <div className='grid gap-4 border-t border-stroke-soft-200 bg-bg-weak-50 px-4 py-4 md:grid-cols-4'>
                  {[['Current Program Fit', fit.fit_score], ['Historical Cohort Fit', fit.historical_fit], ['Current Intent Fit', fit.intent_fit], ['Market Regime Fit', fit.market_fit]].map(([label, value]) => <div key={String(label)}><div className='text-label-xs text-text-soft-400'>{label}</div><div className='mt-1 text-label-md text-text-strong-950'>{score(value as number | null)}</div></div>)}
                  <div className='md:col-span-2'><div className='text-label-xs text-text-soft-400'>Top Matches</div><p className='mt-1 text-paragraph-sm capitalize text-text-sub-600'>{programFitLabels(fit.top_matches, 5).join(' · ') || '—'}</p></div>
                  <div className='md:col-span-2'><div className='text-label-xs text-text-soft-400'>Top Gaps</div><p className='mt-1 text-paragraph-sm capitalize text-text-sub-600'>{programFitLabels(fit.top_gaps, 5).join(' · ') || '—'}</p></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {mode === 'preview' && onViewFull && <button type='button' className='text-label-sm text-primary-base hover:underline' onClick={onViewFull}>View Full Program Fit</button>}
    </div>
  );
}
