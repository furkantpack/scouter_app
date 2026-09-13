'use client';

import type * as React from 'react';
import {
  RiBriefcase4Fill,
  RiCheckboxCircleFill,
  RiLinkedinFill,
  RiShareForwardLine,
  RiTwitterXFill,
  RiUserSharedLine,
  RiVerifiedBadgeLine,
} from '@remixicon/react';
import { useAtomValue } from 'jotai';

import { ThemedImage } from '@/components/themed-image';

import { investorOnboardingAtom } from './store-investor-onboarding';

const labels: Record<string, string> = {
  'pre-seed': 'Pre-seed',
  seed: 'Seed',
  'series-a': 'Series A',
  'all-stages': 'All stages',
  ai: 'AI',
  fintech: 'Fintech',
  'deep-tech': 'Deep Tech',
  climate: 'Climate',
  saas: 'SaaS',
  consumer: 'Consumer',
  'sector-agnostic': 'Sector Agnostic',
  other: 'Other',
  '25k-100k': '$25K-$100K',
  '100k-500k': '$100K-$500K',
  '500k-2m': '$500K-$2M',
  '2m-plus': '$2M+',
  '1-5': '1-5/year',
  '5-15': '5-15/year',
  '15-30': '15-30/year',
  '30-plus': '30+/year',
  'warm-intros': 'Warm intros',
  events: 'Events',
  'cold-outreach': 'Cold outreach',
  databases: 'Databases',
  'founders-find-me': 'Founders find me',
  'too-late': 'Too late to deals',
  'too-much-noise': 'Too much noise',
  'no-warm-path': 'No warm path',
  'weak-signal-quality': 'Weak signal quality',
  'prior-exit': 'Prior exit',
  'big-tech-background': 'Big tech',
  'top-university': 'Top university',
  'stealth-filing': 'Stealth filing',
  layoff: 'Layoff',
  'serial-founder': 'Serial founder',
};

function labelFor(value: string) {
  return labels[value] ?? value;
}

function compactList(values: string[], fallback: string) {
  return values.length > 0 ? values.map(labelFor).join(', ') : fallback;
}

export default function PreviewCard() {
  const answers = useAtomValue(investorOnboardingAtom);

  const sectors = compactList(answers.sectors, 'AI, SaaS');
  const signals = compactList(answers.signals, 'Prior exit, Big tech');
  const stage = answers.stage ? labelFor(answers.stage) : 'Seed';
  const checkSize = answers.checkSize
    ? labelFor(answers.checkSize)
    : '$100K-$500K';
  const pace = answers.investmentsPerYear
    ? labelFor(answers.investmentsPerYear)
    : '5-15/year';
  const sourcing = answers.sourcing
    ? labelFor(answers.sourcing)
    : 'Warm intros';
  const thesisSource = answers.thesisUrl.trim()
    ? 'Thesis generated from your portfolio URL.'
    : 'Add your portfolio URL and Scouter will generate your thesis.';
  const signalScore = Math.min(
    100,
    54 +
      (answers.stage ? 8 : 0) +
      Math.min(answers.sectors.length, 3) * 4 +
      (answers.sourcing ? 8 : 0) +
      Math.min(answers.signals.length, 3) * 4 +
      (answers.thesisUrl.trim() ? 6 : 0),
  );
  const insightChips = [
    {
      label: sourcing,
      icon: RiUserSharedLine,
    },
    {
      label: signals,
      icon: RiVerifiedBadgeLine,
    },
  ];

  return (
    <div className='relative w-full min-w-0 min-[400px]:w-[370px] min-[400px]:shrink-0'>
      <ThemedImage
        src='/images/add-product-bg-pattern.png'
        srcDark='/images/add-product-bg-pattern-dark.png'
        alt=''
        width={532}
        height={511}
        className='pointer-events-none absolute h-[420px] w-[438px] max-w-none object-contain object-left-top opacity-70'
        style={{ left: 76, bottom: -250 }}
      />

      <div className='relative z-10 flex w-full flex-col gap-4 overflow-hidden rounded-3xl bg-bg-white-0 p-4 pb-5 shadow-custom-md ring-1 ring-inset ring-stroke-soft-200'>
        <div className='pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_48%,#ECFDF5_100%)]' />

        <div className='relative flex items-center justify-between gap-3'>
          <div className='flex items-center gap-2.5'>
            <div className='flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100'>
              <RiBriefcase4Fill className='size-5' />
            </div>
            <div className='text-title-h6 text-text-strong-950'>
              Investor Profile
            </div>
          </div>
          <button
            type='button'
            className='inline-flex h-10 items-center gap-2 rounded-xl bg-bg-white-0 px-3 text-label-md text-text-sub-600 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
          >
            <RiShareForwardLine className='size-4' />
            Share
          </button>
        </div>

        <div className='relative grid grid-cols-3 rounded-2xl bg-bg-weak-50 p-1 text-center text-label-md text-text-soft-400'>
          <div className='rounded-xl bg-bg-white-0 py-2 text-text-strong-950 shadow-regular-xs'>
            Overview
          </div>
          <div className='py-2'>Thesis</div>
          <div className='py-2'>Signals</div>
        </div>

        <div className='relative flex flex-col items-center text-center'>
          <div className='relative'>
            <div className='grid size-[82px] place-items-center rounded-[22px] bg-[linear-gradient(145deg,#fff7ed,#ffffff)] shadow-regular-sm ring-1 ring-inset ring-orange-100'>
              <img
                src='/images/brand/scouter-mark.webp'
                alt='Scouter'
                className='h-8 w-auto object-contain'
              />
            </div>
            <div className='absolute -right-1 top-1 flex size-7 items-center justify-center rounded-full bg-success-base text-text-white-0 ring-4 ring-bg-white-0'>
              <RiCheckboxCircleFill className='size-5' />
            </div>
          </div>
          <div className='mt-3 text-title-h5 text-text-strong-950'>
            Founder Signal Card
          </div>
          <div className='mt-1 max-w-[290px] text-paragraph-sm text-text-sub-600'>
            {stage} investor focused on {sectors}.
          </div>
        </div>

        <div className='relative grid grid-cols-2 gap-3'>
          <MetricCard label='Check size' value={checkSize} />
          <MetricCard label='New deals' value={pace} />
        </div>

        <div className='relative py-1'>
          <div className='flex items-center justify-between gap-3'>
            <div className='text-label-xs text-text-sub-600'>Match score</div>
            <div className='text-label-xs font-medium text-text-strong-950'>
              {signalScore}/100
            </div>
          </div>
          <div className='mt-2 h-1 rounded-full bg-bg-soft-200'>
            <div
              className='h-full rounded-full bg-orange-500'
              style={{ width: `${signalScore}%` }}
            />
          </div>
        </div>

        <div className='relative flex flex-wrap gap-2'>
          {insightChips.map(({ label, icon: Icon }, index) => (
            <span
              key={`${label}-${index}`}
              className='inline-flex items-center gap-1.5 rounded-full bg-bg-weak-50 px-2.5 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
            >
              <Icon className='size-3.5 text-text-soft-400' />
              {label}
            </span>
          ))}
        </div>

        <div className='relative rounded-2xl bg-bg-white-0 p-3 text-paragraph-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'>
          {thesisSource}
        </div>

        <div className='relative flex items-center justify-center gap-2 border-t border-stroke-soft-200 pt-3'>
          <SharePill icon={<RiTwitterXFill className='size-4' />} label='X' />
          <SharePill
            icon={<RiLinkedinFill className='size-4' />}
            label='LinkedIn'
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-2xl bg-bg-white-0 p-3 text-center shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
      <div className='text-label-xs text-text-soft-400'>{label}</div>
      <div className='mt-1 truncate text-label-md text-text-strong-950'>
        {value}
      </div>
    </div>
  );
}

function SharePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type='button'
      className='inline-flex h-9 items-center gap-2 rounded-full bg-bg-weak-50 px-3 text-label-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
    >
      {icon}
      {label}
    </button>
  );
}
