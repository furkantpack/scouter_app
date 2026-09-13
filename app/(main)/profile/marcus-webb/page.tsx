import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiBuilding2Line,
  RiCheckLine,
  RiFileTextLine,
  RiMapPin2Line,
  RiMoreLine,
  RiShieldStarLine,
  RiTeamLine,
  RiUserStarLine,
} from '@remixicon/react';

import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';

const referrals = [
  {
    label: 'YC Alumni Network',
    icon: RiTeamLine,
    tone: 'text-orange-600 bg-orange-50',
  },
  {
    label: 'Sequoia Scout',
    icon: RiShieldStarLine,
    tone: 'text-blue-600 bg-blue-50',
  },
  {
    label: 'James Brown (angel)',
    icon: RiUserStarLine,
    tone: 'text-violet-600 bg-violet-50',
  },
  {
    label: 'Lena B. (your network)',
    icon: RiUserStarLine,
    tone: 'text-pink-600 bg-pink-50',
  },
];

const scoreSignals = [
  { label: 'Background', value: 82 },
  { label: 'Behavioral', value: 91 },
  { label: 'Timing', value: 97 },
];

const thesisMatches = [
  'Fintech / Payments — your core sector',
  'Prior exit on record',
  '2nd degree — via James Brown',
  'TR/MENA geography',
  'Pre-seed window open',
];

const timeline = [
  ['3w ago', 'Delaware entity filed'],
  ['8mo ago', 'Left Stripe'],
  ['2y ago', 'Prior company acquired ($42M)'],
  ['4y ago', 'Joined Stripe post-exit'],
];

export default function MarcusWebbProfilePage() {
  if (!legacyDemoRoutesEnabled()) notFound();

  return (
    <div className='min-h-screen bg-bg-white-0 pb-16'>
      <div className='h-44 bg-[linear-gradient(110deg,rgba(16,24,40,.28),rgba(16,24,40,.04)),url("https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=80")] bg-cover bg-center' />

      <div className='px-6 lg:px-10'>
        <header className='relative flex flex-wrap items-start gap-5 border-b border-stroke-soft-200 pb-8'>
          <div className='relative -mt-16 shrink-0'>
            <img
              className='size-36 rounded-full border-[5px] border-white object-cover shadow-regular-md'
              src='https://www.untitledui.com/images/avatars/joshua-wilson?fm=webp&q=80'
              alt='Marcus Webb'
            />
            <span className='absolute bottom-2 right-1 grid size-9 place-items-center rounded-full border-[3px] border-white bg-blue-500 text-white'>
              <RiCheckLine className='size-5' />
            </span>
          </div>

          <div className='pt-5'>
            <h1 className='text-title-h4 text-text-strong-950'>Marcus Webb</h1>
            <p className='mt-1 text-paragraph-lg text-text-sub-600'>
              Second-time founder · ex-Stripe
            </p>
            <p className='mt-2 flex items-center gap-1.5 text-paragraph-sm text-text-soft-400'>
              <RiMapPin2Line className='size-4' />
              Istanbul, TR
            </p>
          </div>

          <div className='ml-auto flex flex-wrap gap-2 pt-5'>
            <button className='grid size-10 place-items-center rounded-lg border border-stroke-soft-200 bg-white shadow-regular-xs'>
              <RiMoreLine className='size-5' />
            </button>
            <button className='h-10 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs'>
              Follow
            </button>
            <button className='h-10 rounded-lg bg-primary-base px-5 text-label-sm text-white shadow-regular-xs'>
              Request Intro
            </button>
            <button className='inline-flex h-10 items-center gap-2 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs'>
              <RiFileTextLine className='size-4' />
              Field Report
            </button>
          </div>
        </header>

        <section className='border-b border-stroke-soft-200 py-7'>
          <div className='grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>
                Referred by
              </h2>
              <div className='mt-4 flex flex-wrap gap-2'>
                {referrals.map(({ label, icon: Icon, tone }) => (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-label-sm ${tone}`}
                  >
                    <Icon className='size-4' />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className='flex items-center justify-between'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Scouter Score
                </h2>
                <strong className='text-title-h5 font-medium text-primary-base'>
                  91
                </strong>
              </div>
              <div className='mt-4 space-y-3'>
                {scoreSignals.map((signal) => (
                  <div key={signal.label}>
                    <div className='mb-1.5 flex justify-between text-paragraph-sm'>
                      <span className='text-text-sub-600'>{signal.label}</span>
                      <strong className='text-text-strong-950'>
                        {signal.value}%
                      </strong>
                    </div>
                    <div className='h-2 overflow-hidden rounded-full bg-bg-soft-200'>
                      <div
                        className='h-full rounded-full bg-primary-base'
                        style={{ width: `${signal.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className='py-8'>
          <div className='grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]'>
            <div className='space-y-8'>
              <section>
                <h2 className='text-label-lg text-text-strong-950'>
                  Experience
                </h2>
                <article className='mt-4 overflow-hidden rounded-xl border border-stroke-soft-200 bg-white shadow-regular-xs'>
                  <div className='p-5'>
                    <div className='flex items-center gap-3'>
                      <span className='grid size-12 place-items-center rounded-full bg-violet-600 text-title-h6 text-white'>
                        S
                      </span>
                      <div>
                        <h3 className='text-label-lg'>Head of Product</h3>
                        <p className='text-paragraph-sm text-text-sub-600'>
                          Stripe · 2019–2023
                        </p>
                      </div>
                    </div>
                    <div className='mt-6 space-y-2 text-paragraph-sm text-text-sub-600'>
                      <p>→ Left 8 months ago</p>
                      <p>→ Prior exit: $42M acquisition (2018)</p>
                      <p>→ Now: Stealth · entity filed 3 weeks ago</p>
                    </div>
                  </div>
                </article>
              </section>

              <section className='border-t border-stroke-soft-200 pt-8'>
                <h2 className='text-label-lg text-text-strong-950'>About</h2>
                <p className='mt-3 max-w-3xl text-paragraph-md leading-7 text-text-sub-600'>
                  Serial founder with one exit. Built payments infrastructure at
                  Stripe for four years. Now building in the fintech
                  infrastructure space.
                </p>
                <button className='mt-4 text-label-sm text-primary-base'>
                  Read more
                </button>
              </section>

              <section className='border-t border-stroke-soft-200 pt-8'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Why this fits your thesis
                </h2>
                <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                  {thesisMatches.map((match) => (
                    <div
                      key={match}
                      className='flex items-center gap-3 rounded-xl border border-stroke-soft-200 bg-white p-4 shadow-regular-xs'
                    >
                      <span className='grid size-7 shrink-0 place-items-center rounded-full bg-success-lighter text-success-base'>
                        <RiCheckLine className='size-4' />
                      </span>
                      <span className='text-label-sm text-text-sub-600'>
                        {match}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className='space-y-6'>
              <section className='rounded-xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Signal Timeline
                </h2>
                <div className='mt-5'>
                  {timeline.map(([date, event], index) => (
                    <div
                      key={event}
                      className='relative grid grid-cols-[70px_16px_minmax(0,1fr)] gap-3 pb-6 last:pb-0'
                    >
                      <span className='pt-0.5 text-paragraph-xs text-text-soft-400'>
                        {date}
                      </span>
                      <span className='relative grid size-4 place-items-center rounded-full bg-primary-alpha-10 ring-1 ring-primary-base/30'>
                        <span className='size-1.5 rounded-full bg-primary-base' />
                        {index < timeline.length - 1 && (
                          <span className='absolute top-4 h-8 w-px bg-stroke-soft-200' />
                        )}
                      </span>
                      <span className='text-label-sm text-text-sub-600'>
                        {event}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className='rounded-xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Network context
                </h2>
                <div className='mt-4 flex items-center gap-3'>
                  <span className='grid size-10 place-items-center rounded-full bg-violet-50 text-label-sm font-medium text-violet-600'>
                    JB
                  </span>
                  <div>
                    <strong className='text-label-sm text-text-strong-950'>
                      James Brown
                    </strong>
                    <p className='text-paragraph-xs text-text-soft-400'>
                      Met at Scouter Day Istanbul
                    </p>
                  </div>
                </div>
                <blockquote className='mt-4 rounded-xl bg-bg-weak-50 p-4 text-paragraph-sm italic leading-6 text-text-sub-600'>
                  “Sharp on payments infra, still early on GTM”
                </blockquote>
                <button className='mt-4 flex items-center gap-2 text-label-sm text-primary-base'>
                  Field Report · 2 days ago
                  <RiArrowRightLine className='size-4' />
                </button>
              </section>

              <section className='rounded-xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Similar profiles you&apos;ve backed
                </h2>
                <div className='mt-4 divide-y divide-stroke-soft-200'>
                  {[
                    ['Anonim', 'Fintech exit · 2022 · $38M'],
                    ['Anonim', 'Payments · seed · active'],
                  ].map(([name, description]) => (
                    <div
                      key={description}
                      className='flex items-center gap-3 py-3'
                    >
                      <span className='grid size-9 place-items-center rounded-full bg-bg-weak-50 text-label-xs text-text-sub-600'>
                        A
                      </span>
                      <div className='min-w-0 flex-1'>
                        <strong className='text-label-sm text-text-strong-950'>
                          {name}
                        </strong>
                        <p className='truncate text-paragraph-xs text-text-soft-400'>
                          {description}
                        </p>
                      </div>
                      <RiArrowRightLine className='size-4 text-text-soft-400' />
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>

        <div className='border-t border-stroke-soft-200 pt-6'>
          <Link
            href='/network-mode'
            className='inline-flex items-center gap-2 text-label-sm text-text-sub-600'
          >
            <RiArrowLeftLine className='size-4' />
            Back to Network Mode
          </Link>
        </div>
      </div>
    </div>
  );
}
