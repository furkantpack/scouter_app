'use client';

import type * as React from 'react';
import Link from 'next/link';
import {
  RiBriefcase4Fill,
  RiLink,
  RiLinkedinFill,
  RiSparkling2Fill,
  RiTwitterXFill,
} from '@remixicon/react';
import { useAtomValue } from 'jotai';

import * as Button from '@/components/ui/button';
import { DashedDivider } from '@/components/dashed-divider';

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
  '1-5': '1-5 investments/year',
  '5-15': '5-15 investments/year',
  '15-30': '15-30 investments/year',
  '30-plus': '30+ investments/year',
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
  'big-tech-background': 'Big tech background',
  'top-university': 'Top university',
  'stealth-filing': 'Stealth filing',
  layoff: 'Layoff',
  'serial-founder': 'Serial founder',
};

function labelFor(value: string) {
  return labels[value] ?? value;
}

function listFor(values: string[], fallback = 'Not selected yet') {
  return values.length > 0 ? values.map(labelFor).join(', ') : fallback;
}

export default function StepSummary() {
  const answers = useAtomValue(investorOnboardingAtom);

  return (
    <div className='mx-auto flex w-full max-w-[680px] flex-col gap-6 md:gap-8'>
      <div className='flex w-full flex-col gap-6'>
        <RiBriefcase4Fill className='size-7 text-orange-500' />
        <div>
          <div className='text-title-h5 text-text-strong-950'>
            Investor card ready
          </div>
          <div className='mt-2 text-paragraph-md text-text-sub-600'>
            Review the founder discovery profile before sharing it.
          </div>
        </div>
      </div>

      <div className='flex flex-col gap-5 pt-2'>
        <SummarySection
          title='Your Fund'
          items={[
            [
              'Primary stage',
              answers.stage ? labelFor(answers.stage) : 'Not selected yet',
            ],
            ['Active sectors', listFor(answers.sectors)],
            [
              'Typical check size',
              answers.checkSize
                ? labelFor(answers.checkSize)
                : 'Not selected yet',
            ],
            [
              'New investments/year',
              answers.investmentsPerYear
                ? labelFor(answers.investmentsPerYear)
                : 'Not selected yet',
            ],
          ]}
        />

        <DashedDivider />

        <SummarySection
          title='Your Sourcing'
          items={[
            [
              'Current source',
              answers.sourcing
                ? labelFor(answers.sourcing)
                : 'Not selected yet',
            ],
            [
              'Biggest frustration',
              answers.frustration
                ? labelFor(answers.frustration)
                : 'Not selected yet',
            ],
            ['Important signals', listFor(answers.signals)],
          ]}
        />

        <DashedDivider />

        <SummarySection
          title='Your Thesis'
          items={[
            [
              'Thesis source URL',
              answers.thesisUrl.trim() || 'Not provided yet',
            ],
          ]}
        />
      </div>

      <div className='rounded-2xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200'>
        <div className='flex items-center gap-2 text-label-md text-text-strong-950'>
          <RiSparkling2Fill className='size-4 text-orange-500' />
          Share this card
        </div>
        <div className='mt-3 grid grid-cols-3 gap-2'>
          <ShareButton icon={<RiTwitterXFill className='size-4' />} label='X' />
          <ShareButton
            icon={<RiLinkedinFill className='size-4' />}
            label='LinkedIn'
          />
          <ShareButton icon={<RiLink className='size-4' />} label='Copy link' />
        </div>
      </div>

      <Button.Root className='w-full' asChild>
        <Link href='/dashboard'>Finish investor card</Link>
      </Button.Root>
    </div>
  );
}

function SummarySection({
  title,
  items,
}: {
  title: string;
  items: [string, string][];
}) {
  return (
    <div>
      <div className='text-label-md text-text-strong-950'>{title}</div>
      <div className='mt-3 grid gap-3 md:grid-cols-2'>
        {items.map(([label, value]) => (
          <div
            key={label}
            className='rounded-xl bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200'
          >
            <div className='text-label-xs text-text-soft-400'>{label}</div>
            <div className='mt-1 text-label-sm text-text-strong-950'>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type='button'
      className='inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-bg-white-0 px-3 text-label-sm text-text-sub-600 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
    >
      {icon}
      <span className='truncate'>{label}</span>
    </button>
  );
}
