import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightUpLine,
  RiBuilding2Line,
  RiCheckLine,
  RiExternalLinkLine,
  RiGraduationCapLine,
  RiMapPin2Line,
  RiRocket2Line,
  RiSignalTowerLine,
} from '@remixicon/react';

import { networkLogoUrl } from '../../products/network-data';
import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';

const experience = [
  {
    domain: 'tryradiant.ai',
    role: 'Founder & CEO',
    company: 'Radiant',
    date: '2026 — Present',
    description:
      'Building an AI agent that autonomously launches and operates companies.',
  },
  {
    domain: 'bloom.inc',
    role: 'Co-Founder',
    company: 'Bloom',
    date: '2024 — Present',
    description: 'Screen-time product featured on Shark Tank Season 17.',
  },
  {
    domain: 'amazon.com',
    role: 'Hardware Engineering Intern',
    company: 'Amazon',
    date: '2024',
    description: 'Hardware reliability testing and failure analysis.',
  },
  {
    domain: 'nasa.gov',
    role: 'Mechanical Engineering Intern',
    company: 'NASA',
    date: '2023',
    description:
      'Inverse kinematics work for EXCLAIM Telescope mirror alignment.',
  },
];

const categories = [
  'Twitter',
  'Big Tech Alumni',
  'Founder History',
  'Top University · UCLA',
  'AI/ML',
];

export default function DannyChmaytelliProfilePage() {
  if (!legacyDemoRoutesEnabled()) notFound();

  return (
    <div className='min-h-screen bg-bg-white-0 pb-16'>
      <div className='px-6 lg:px-10'>
        <div className='flex flex-wrap items-center gap-4 border-b border-stroke-soft-200 py-7'>
          <div className='relative grid size-16 shrink-0 place-items-center rounded-2xl bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <img
              src={networkLogoUrl('tryradiant.ai')}
              alt='Radiant logo'
              className='size-10 rounded-lg object-contain'
            />
            <span className='absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-white bg-blue-500 text-white'>
              <RiCheckLine className='size-3.5' />
            </span>
          </div>
          <div>
            <h1 className='text-title-h5 text-text-strong-950'>
              Danny Chmaytelli
            </h1>
            <p className='mt-1 text-label-sm text-text-sub-600'>
              Founder at Radiant · Co-Founder at Bloom · Amazon & NASA alumni
            </p>
            <p className='mt-1 flex items-center gap-2 text-label-xs text-text-soft-400'>
              <RiMapPin2Line className='size-4' /> Los Angeles, California
            </p>
          </div>
          <div className='ml-auto flex flex-wrap gap-2'>
            <Link
              href='/monitor'
              className='inline-flex h-10 items-center gap-2 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm text-text-strong-950 shadow-regular-xs transition hover:bg-bg-weak-50'
            >
              <RiAddLine className='size-4' /> Add to Monitor
            </Link>
            <a
              href='https://x.com/DChmaytelli'
              target='_blank'
              rel='noreferrer'
              className='inline-flex h-10 items-center gap-2 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs'
            >
              @DChmaytelli <RiExternalLinkLine className='size-4' />
            </a>
            <a
              href='https://tryradiant.ai/'
              target='_blank'
              rel='noreferrer'
              className='inline-flex h-10 items-center gap-2 rounded-lg bg-primary-base px-5 text-label-sm text-white shadow-regular-xs'
            >
              Visit Radiant <RiArrowRightUpLine className='size-4' />
            </a>
          </div>
        </div>

        <section className='border-b border-stroke-soft-200 py-7'>
          <Link
            href='/dashboard/twitter'
            className='inline-flex items-center gap-2 text-label-sm text-text-sub-600 hover:text-text-strong-950'
          >
            <RiArrowLeftLine className='size-4' /> Back to Twitter category
          </Link>
          <div className='mt-5 flex flex-wrap gap-2'>
            {categories.map((category, index) => (
              <span
                key={category}
                className={`rounded-full px-3 py-1.5 text-label-xs ${index === 0 ? 'bg-orange-50 text-orange-700' : 'bg-bg-weak-50 text-text-sub-600'}`}
              >
                {category}
              </span>
            ))}
          </div>
        </section>

        <section className='py-8'>
          <div className='grid gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>About</h2>
              <div className='mt-3 max-w-3xl space-y-4 text-paragraph-md leading-7 text-text-sub-600'>
                <p>
                  Technical founder building Radiant, an AI-native company
                  creation and operations platform. Previously co-founded Bloom,
                  a physical and software system designed to reduce distracting
                  screen time.
                </p>
                <p>
                  Computer Science student and UCLA Regents Scholar with
                  hands-on hardware and research experience at Amazon, NASA, and
                  UCLA Engineering.
                </p>
              </div>
            </div>
            <dl className='grid grid-cols-2 gap-7'>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>Company</dt>
                <dd className='mt-2 text-label-md'>Radiant</dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Company URL
                </dt>
                <dd className='mt-2'>
                  <a
                    href='https://tryradiant.ai/'
                    target='_blank'
                    rel='noreferrer'
                    className='text-label-md text-primary-base'
                  >
                    tryradiant.ai ↗
                  </a>
                </dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Education
                </dt>
                <dd className='mt-2 flex items-center gap-2 text-label-md'>
                  <RiGraduationCapLine className='size-5' /> UCLA · Computer
                  Science
                </dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Primary category
                </dt>
                <dd className='mt-2 text-label-md text-orange-600'>Twitter</dd>
              </div>
            </dl>
          </div>

          <div className='mt-8'>
            <h2 className='text-label-lg text-text-strong-950'>Experience</h2>
            <p className='mt-2 max-w-3xl text-paragraph-md leading-7 text-text-sub-600'>
              Founder and operator experience across AI, consumer technology,
              hardware engineering, and aerospace research.
            </p>
          </div>

          <div className='mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            {experience.map((item) => (
              <article
                key={item.company}
                className='overflow-hidden rounded-xl border border-stroke-soft-200 bg-white shadow-regular-xs'
              >
                <div className='p-5'>
                  <div className='flex items-center gap-3'>
                    <span className='grid size-12 shrink-0 place-items-center rounded-full bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                      <img
                        src={networkLogoUrl(item.domain)}
                        alt={`${item.company} logo`}
                        className='size-7 rounded-md object-contain'
                      />
                    </span>
                    <div>
                      <h3 className='text-label-md'>{item.role}</h3>
                      <p className='text-paragraph-sm text-text-sub-600'>
                        {item.company}
                      </p>
                    </div>
                  </div>
                  <p className='mt-5 text-label-xs text-text-soft-400'>
                    {item.date}
                  </p>
                  <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className='grid gap-6 border-t border-stroke-soft-200 pt-8 lg:grid-cols-2'>
          <article className='rounded-2xl border border-stroke-soft-200 bg-white p-6 shadow-regular-xs'>
            <h2 className='flex items-center gap-2 text-label-lg text-text-strong-950'>
              <RiRocket2Line className='size-5 text-orange-500' /> Why this
              profile stands out
            </h2>
            <ul className='mt-5 space-y-3 text-paragraph-sm text-text-sub-600'>
              {[
                'Repeat founder: Radiant and Bloom',
                'Big Tech and aerospace operator history: Amazon and NASA',
                'Top university signal: UCLA Regents Scholar',
                'Public founder signal through X and Shark Tank',
                'Technical range across AI, hardware, and consumer products',
              ].map((item) => (
                <li key={item} className='flex gap-2'>
                  <RiCheckLine className='mt-0.5 size-4 shrink-0 text-orange-500' />{' '}
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <article className='rounded-2xl border border-stroke-soft-200 bg-white p-6 shadow-regular-xs'>
            <h2 className='flex items-center gap-2 text-label-lg text-text-strong-950'>
              <RiSignalTowerLine className='size-5 text-orange-500' /> Active
              signals
            </h2>
            <div className='mt-5 space-y-4'>
              {[
                [
                  'Founder Move',
                  'Radiant launched with an autonomous AI-company thesis.',
                ],
                ['Traction', 'Profile materials report 3,000+ Radiant users.'],
                ['Media Signal', 'Bloom featured on Shark Tank Season 17.'],
                [
                  'Network',
                  'Amazon, NASA, UCLA, and consumer-founder connections.',
                ],
              ].map(([label, text]) => (
                <div key={label} className='rounded-xl bg-bg-weak-50 p-4'>
                  <span className='text-label-xs text-orange-600'>{label}</span>
                  <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className='mt-8 border-t border-stroke-soft-200 pt-8'>
          <h2 className='flex items-center gap-2 text-label-lg text-text-strong-950'>
            <RiBuilding2Line className='size-5 text-orange-500' /> Companies
          </h2>
          <div className='mt-5 grid gap-5 md:grid-cols-2'>
            <a
              href='https://tryradiant.ai/'
              target='_blank'
              rel='noreferrer'
              className='group rounded-2xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'
            >
              <div className='flex items-center gap-3'>
                <span className='grid size-11 place-items-center rounded-xl bg-white ring-1 ring-stroke-soft-200'>
                  <img
                    src={networkLogoUrl('tryradiant.ai')}
                    alt='Radiant logo'
                    className='size-7 rounded-md object-contain'
                  />
                </span>
                <div>
                  <h3 className='text-label-lg'>Radiant</h3>
                  <p className='text-label-sm text-text-soft-400'>
                    AI-native company creation and operations
                  </p>
                </div>
                <RiArrowRightUpLine className='ml-auto size-5 text-orange-500' />
              </div>
            </a>
            <a
              href='https://bloom.inc/'
              target='_blank'
              rel='noreferrer'
              className='group rounded-2xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'
            >
              <div className='flex items-center gap-3'>
                <span className='grid size-11 place-items-center rounded-xl bg-white ring-1 ring-stroke-soft-200'>
                  <img
                    src={networkLogoUrl('bloom.inc')}
                    alt='Bloom logo'
                    className='size-7 rounded-md object-contain'
                  />
                </span>
                <div>
                  <h3 className='text-label-lg'>Bloom</h3>
                  <p className='text-label-sm text-text-soft-400'>
                    Screen-time reduction product
                  </p>
                </div>
                <RiArrowRightUpLine className='ml-auto size-5 text-violet-500' />
              </div>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
