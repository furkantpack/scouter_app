import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiGraduationCapLine,
  RiMapPin2Line,
  RiRocket2Line,
  RiSignalTowerLine,
  RiUserLine,
} from '@remixicon/react';

import { networkLogoUrl } from '../../products/network-data';
import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';

const experience = [
  [
    'linkedin.com',
    'Chief Technology Officer',
    'Stealth Startup',
    'Dec 2025 — Present · 9 months',
    'Revolutionizing aging support using computer vision.',
  ],
  [
    'eve.com',
    'Co-Founder & Technical Advisor',
    'EVE',
    'Dec 2025 — Present · 9 months',
    'Technical and product advisor for the ongoing team.',
  ],
  [
    'eve.com',
    'Co-Founder & CTO',
    'EVE',
    'Nov 2024 — Dec 2025 · 14 months',
    'Built an AI inbox revenue engine that helps SMBs recover missed sales opportunities.',
  ],
  [
    'inceptionstudio.org',
    'Inceptioneer',
    'Inception Studio',
    'Mar 2025 — Present · 15 months',
    'Member of an AI startup community and accelerator.',
  ],
  [
    'theareamethod.com',
    'Technical Advisor',
    'The Area Method',
    'Jan 2017 — Present · 15 months',
    'Advising technology that helps users make informed decisions.',
  ],
  [
    'purf.ai',
    'Chief Technology Officer',
    'Purf AI',
    'Jan 2024 — Nov 2024 · 11 months',
    'Built a connected, hyper-personalized prioritization digital twin.',
  ],
];

export default function VadimAxelrodProfilePage() {
  if (!legacyDemoRoutesEnabled()) notFound();

  return (
    <div className='min-h-screen bg-bg-white-0 pb-16'>
      <div className='px-6 lg:px-10'>
        <header className='flex flex-wrap items-center gap-4 border-b border-stroke-soft-200 py-7'>
          <div className='relative grid size-16 shrink-0 place-items-center rounded-2xl bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <RiUserLine className='size-8 text-primary-base' />
            <span className='absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-white bg-blue-500 text-white'>
              <RiCheckLine className='size-3.5' />
            </span>
          </div>
          <div>
            <h1 className='text-title-h5 text-text-strong-950'>
              Vadim Axelrod
            </h1>
            <p className='mt-1 text-label-sm text-text-sub-600'>
              CTO at Stealth Startup · Co-Founder at EVE · Stanford alumnus
            </p>
            <p className='mt-1 flex items-center gap-2 text-label-xs text-text-soft-400'>
              <RiMapPin2Line className='size-4' /> Palo Alto, California
            </p>
          </div>
          <div className='ml-auto flex flex-wrap gap-2'>
            <Link
              href='/monitor'
              className='inline-flex h-10 items-center gap-2 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs hover:bg-bg-weak-50'
            >
              <RiAddLine className='size-4' /> Add to Monitor
            </Link>
            <a
              href='https://www.linkedin.com/in/vadim1/'
              target='_blank'
              rel='noreferrer'
              className='inline-flex h-10 items-center gap-2 rounded-lg bg-primary-base px-5 text-label-sm text-white shadow-regular-xs'
            >
              LinkedIn Profile <RiExternalLinkLine className='size-4' />
            </a>
          </div>
        </header>

        <section className='border-b border-stroke-soft-200 py-7'>
          <Link
            href='/dashboard/stanford'
            className='inline-flex items-center gap-2 text-label-sm text-text-sub-600 hover:text-text-strong-950'
          >
            <RiArrowLeftLine className='size-4' /> Back to Stanford category
          </Link>
          <div className='mt-5 flex flex-wrap gap-2'>
            {[
              'Stanford',
              'AI & Computer Vision',
              'Founder History',
              'B2B SaaS',
            ].map((label, index) => (
              <span
                key={label}
                className={`rounded-full px-3 py-1.5 text-label-xs ${index === 0 ? 'bg-orange-50 text-orange-700' : 'bg-bg-weak-50 text-text-sub-600'}`}
              >
                {label}
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
                  Technical founder and repeat CTO building computer-vision
                  products, AI-native business systems, and revenue automation.
                </p>
                <p>
                  Co-founded EVE and led its product and technology strategy.
                  His background combines Stanford computer science with
                  extensive startup advisory experience.
                </p>
              </div>
            </div>
            <dl className='grid grid-cols-2 gap-7'>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Current role
                </dt>
                <dd className='mt-2 text-label-md'>Chief Technology Officer</dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Primary sector
                </dt>
                <dd className='mt-2 text-label-md text-orange-600'>
                  AI & Computer Vision
                </dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Education
                </dt>
                <dd className='mt-2 flex items-center gap-2 text-label-md'>
                  <RiGraduationCapLine className='size-5' /> Stanford · MS
                  Computer Science
                </dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Location
                </dt>
                <dd className='mt-2 text-label-md'>Palo Alto, CA</dd>
              </div>
            </dl>
          </div>

          <div className='mt-8'>
            <h2 className='text-label-lg text-text-strong-950'>Experience</h2>
            <p className='mt-2 max-w-3xl text-paragraph-md leading-7 text-text-sub-600'>
              Founder, technology executive, and advisor roles across AI,
              computer vision, revenue automation, and consumer products.
            </p>
          </div>
          <div className='mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
            {experience.map(([domain, role, company, date, description]) => (
              <article
                key={`${company}-${role}`}
                className='rounded-xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'
              >
                <div className='flex items-center gap-3'>
                  <span className='grid size-12 shrink-0 place-items-center rounded-full bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                    <img
                      src={networkLogoUrl(domain)}
                      alt={`${company} logo`}
                      className='size-7 rounded-md object-contain'
                    />
                  </span>
                  <div>
                    <h3 className='text-label-md'>{role}</h3>
                    <p className='text-paragraph-sm text-text-sub-600'>
                      {company}
                    </p>
                  </div>
                </div>
                <p className='mt-5 text-label-xs text-text-soft-400'>{date}</p>
                <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                  {description}
                </p>
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
                'Repeat CTO and technical co-founder',
                'Stanford MS in Computer Science',
                'Deep AI and computer-vision expertise',
                'Strong investor and operator network',
                'Active founder timing at a stealth startup',
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
                  'Joined a stealth startup as CTO in December 2025.',
                ],
                [
                  'Advisory Signal',
                  'Transitioned at EVE from operating CTO to technical advisor.',
                ],
                [
                  'Capital Network',
                  'Connected to Firsthand.VC, Founders Future, and a16z Scout Fund.',
                ],
                [
                  'Accelerator',
                  'Active in the Inception Studio AI founder community.',
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
          <h2 className='text-label-lg text-text-strong-950'>Education</h2>
          <div className='mt-5 grid gap-5 md:grid-cols-2'>
            {[
              [
                'stanford.edu',
                'Stanford University',
                'MS, Computer Science · 1991–1993',
              ],
              [
                'pomona.edu',
                'Pomona College',
                'BA, Economics & Computer Science · 1987–1991',
              ],
            ].map(([domain, school, degree]) => (
              <article
                key={school}
                className='flex items-center gap-3 rounded-2xl border border-stroke-soft-200 bg-white p-5 shadow-regular-xs'
              >
                <img
                  src={networkLogoUrl(domain)}
                  alt={`${school} logo`}
                  className='size-10 rounded-lg object-contain'
                />
                <div>
                  <h3 className='text-label-lg'>{school}</h3>
                  <p className='text-label-sm text-text-soft-400'>{degree}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
