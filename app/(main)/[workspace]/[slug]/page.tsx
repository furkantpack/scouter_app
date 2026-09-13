import Link from 'next/link';
import { notFound } from 'next/navigation';

import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiExternalLinkLine,
  RiFlashlightLine,
  RiUserStarLine,
} from '@remixicon/react';

import { networkLogoUrl } from '../../products/network-data';

const portfolio = {
  notion: {
    name: 'Notion',
    focus: 'Productivity Software',
    domain: 'notion.so',
    matches: [
      [
        'Ex-Figma PM, 6 yrs',
        94,
        "Product background overlaps with Notion's workflow thesis",
      ],
      [
        'Ex-Notion engineering lead',
        91,
        'Second-time founder pattern with deep collaboration expertise',
      ],
    ],
    signals: [
      [
        '2d ago',
        'Career Move',
        'Senior workflow eng departed after 4 years — pattern matches prior founder exits at this company',
      ],
      [
        '5d ago',
        'Hiring Surge',
        'Notion opened 3 new senior roles in AI tooling — thesis expansion signal',
      ],
      [
        '1w ago',
        'Team Formation',
        'Two ex-Notion employees connected within the same week — possible team formation',
      ],
    ],
  },
  verkada: {
    name: 'Verkada',
    focus: 'Enterprise Security / IoT',
    domain: 'verkada.com',
    matches: [
      [
        'Ex-Ring hardware lead',
        91,
        'Security hardware experience matches the physical-cloud thesis',
      ],
      [
        'Ex-Verkada sales director',
        86,
        'Career move signal with enterprise GTM depth',
      ],
    ],
    signals: [
      [
        '3d ago',
        'Stealth Filing',
        'Former hardware leader associated with a newly filed entity',
      ],
      [
        '1w ago',
        'Career Move',
        'Senior commercial operator left with no new role listed',
      ],
    ],
  },
  clay: {
    name: 'Clay',
    focus: 'AI Sales Automation',
    domain: 'clay.com',
    matches: [
      [
        'Ex-Clay GTM engineer',
        95,
        'Technical GTM background aligns with AI workflow expansion',
      ],
      [
        'Ex-HubSpot growth lead',
        92,
        'New entity filing and strong sales automation overlap',
      ],
    ],
    signals: [
      ['1d ago', 'Career Move', 'GTM engineer left Clay three weeks ago'],
      [
        '4d ago',
        'Stealth Filing',
        'Growth operator linked to a newly registered entity',
      ],
    ],
  },
  'k2-space': {
    name: 'K2 Space',
    focus: 'Satellite Manufacturing',
    domain: 'k2space.com',
    matches: [
      [
        'Ex-SpaceX propulsion engineer',
        88,
        'Aerospace systems depth fits the satellite manufacturing thesis',
      ],
      [
        'Ex-K2 Space ops lead',
        84,
        'Exploring a new venture after an operating leadership role',
      ],
    ],
    signals: [
      ['3d ago', 'Career Move', 'Propulsion engineer updated role status'],
      [
        '2w ago',
        'Exec Departure',
        'Operations lead departed after a scaling cycle',
      ],
    ],
  },
  'pomelo-care': {
    name: 'Pomelo Care',
    focus: 'Virtual Maternal Health',
    domain: 'pomelocare.com',
    matches: [
      [
        'Ex-Maven Clinic clinical ops lead',
        89,
        'Maternal health operations experience matches the care thesis',
      ],
      [
        'Ex-Pomelo engineer',
        85,
        'Stealth activity paired with healthcare product depth',
      ],
    ],
    signals: [
      ['4d ago', 'Career Move', 'Clinical operations leader left current role'],
      [
        '1w ago',
        'Stealth Filing',
        'Former engineer linked to a new healthcare entity',
      ],
    ],
  },
  reducto: {
    name: 'Reducto',
    focus: 'AI Document Parsing',
    domain: 'reducto.ai',
    matches: [
      [
        'Ex-Reducto research engineer',
        93,
        'Document intelligence expertise and prior founder history',
      ],
      [
        'Ex-Google DeepMind researcher',
        90,
        'Research background overlaps with multimodal parsing',
      ],
    ],
    signals: [
      ['2d ago', 'Career Move', 'Research engineer changed employment status'],
      [
        '6d ago',
        'Funding Signal',
        'Related document AI category activity increased',
      ],
    ],
  },
  rillet: {
    name: 'Rillet',
    focus: 'Finance & Accounting Software',
    domain: 'rillet.com',
    matches: [
      [
        'Ex-Ramp finance engineer',
        87,
        'Fintech infrastructure background fits accounting automation',
      ],
      [
        'Ex-Rillet account executive',
        82,
        'Exploring a founding role with category GTM knowledge',
      ],
    ],
    signals: [
      [
        '5d ago',
        'Career Move',
        'Finance engineer left current role this month',
      ],
      [
        '2w ago',
        'Team Formation',
        'Former commercial operators formed a new connection cluster',
      ],
    ],
  },
  omnea: {
    name: 'Omnea',
    focus: 'Enterprise Procurement Software',
    domain: 'omnea.co',
    matches: [
      [
        'Ex-Coupa product lead',
        89,
        'Procurement product depth aligns with enterprise workflow thesis',
      ],
      [
        'Ex-Omnea engineer',
        84,
        'New entity activity after a technical operating role',
      ],
    ],
    signals: [
      [
        '2d ago',
        'Career Move',
        'Procurement product leader updated role status',
      ],
      [
        '1w ago',
        'Stealth Filing',
        'Former engineer linked to a newly filed entity',
      ],
    ],
  },
  ownwell: {
    name: 'Ownwell',
    focus: 'PropTech / Tax Automation',
    domain: 'ownwell.com',
    matches: [
      [
        'Ex-Opendoor data engineer',
        86,
        'Property data experience matches tax automation workflows',
      ],
      [
        'Ex-Ownwell ops lead',
        80,
        'Career move signal with category operating knowledge',
      ],
    ],
    signals: [
      [
        '3d ago',
        'Stealth Filing',
        'Property data operator associated with stealth activity',
      ],
      ['9d ago', 'Career Move', 'Operations lead left current position'],
    ],
  },
  persona: {
    name: 'Persona',
    focus: 'Identity Verification',
    domain: 'withpersona.com',
    matches: [
      [
        'Ex-Persona security engineer',
        92,
        'Identity infrastructure expertise and venture exploration',
      ],
      [
        'Ex-Stripe identity lead',
        89,
        'Payments identity experience overlaps with verification thesis',
      ],
    ],
    signals: [
      [
        '1d ago',
        'Career Move',
        'Security engineer began exploring a new venture',
      ],
      [
        '1w ago',
        'Exec Departure',
        'Identity product leader exited an operating role',
      ],
    ],
  },
} as const;

const investmentContext: Record<string, { meta: string; thesis: string }> = {
  notion: {
    meta: 'Seed, 2013',
    thesis:
      'Sector: async-collaboration tooling · Stage: Seed · Founder pattern: design-led technical founders · Timing: early workflow platform signal window',
  },
  verkada: {
    meta: 'Seed, 2017',
    thesis:
      'Sector: hardware-enabled enterprise security · Stage: Seed · Founder pattern: hardware + enterprise-sales co-founders · Timing: early category expansion',
  },
  clay: {
    meta: 'Seed, 2023',
    thesis:
      'Sector: AI-native GTM tooling · Stage: Seed · Founder pattern: technical + GTM co-founder pairs · Timing: entered pre-Series A signal window',
  },
  'k2-space': {
    meta: 'Pre-seed, 2021',
    thesis:
      'Sector: deep-tech aerospace hardware · Stage: Pre-seed · Founder pattern: ex-SpaceX technical operators · Timing: early manufacturing signal window',
  },
  'pomelo-care': {
    meta: 'Seed, 2021',
    thesis:
      'Sector: virtual maternal health · Stage: Seed · Founder pattern: clinical + digital-health hybrid teams · Timing: early care-platform expansion',
  },
  reducto: {
    meta: 'Seed, 2023',
    thesis:
      'Sector: applied AI document intelligence · Stage: Seed · Founder pattern: research-led technical founders · Timing: early infrastructure adoption',
  },
  rillet: {
    meta: 'Seed, 2023',
    thesis:
      'Sector: fintech infrastructure · Stage: Seed · Founder pattern: ex-finance operators · Timing: early accounting automation window',
  },
  omnea: {
    meta: 'Seed, 2022',
    thesis:
      'Sector: enterprise procurement workflows · Stage: Seed · Founder pattern: enterprise SaaS operators · Timing: early workflow replacement cycle',
  },
  ownwell: {
    meta: 'Seed, 2022',
    thesis:
      'Sector: data-driven proptech · Stage: Seed · Founder pattern: property data operators · Timing: early tax automation adoption',
  },
  persona: {
    meta: 'Seed, 2018',
    thesis:
      'Sector: identity and security infrastructure · Stage: Seed · Founder pattern: security-first technical teams · Timing: early verification platform window',
  },
};

const monitorCandidates = [
  [
    'Deniz Akin',
    'DA',
    'Frontend Engineer',
    'Vercel',
    'Interviewing',
    '$1,800',
    '2h ago',
  ],
  [
    'Maya Ortiz',
    'MO',
    'Product Designer',
    'Linear',
    'Introduced',
    '$1,200',
    '5h ago',
  ],
  [
    'Amara Khan',
    'AK',
    'Product Manager',
    'Notion',
    'Offer',
    '$2,000',
    'Yesterday',
  ],
  ['Theo Nguyen', 'TN', 'Growth Manager', 'Loom', 'Hired', '$1,300', 'Jul 22'],
  [
    'Lena Müller',
    'LM',
    'Product Designer',
    'Notion',
    'Screening',
    '$1,400',
    'Jul 21',
  ],
];

export default function PortfolioCompanyPage({
  params,
}: {
  params: { workspace: string; slug: string };
}) {
  if (!legacyDemoRoutesEnabled()) notFound();

  if (
    decodeURIComponent(params.workspace).toLocaleLowerCase('tr-TR') !==
    'portföy'
  )
    notFound();
  const company = portfolio[params.slug as keyof typeof portfolio];
  if (!company) notFound();
  const context = investmentContext[params.slug];

  return (
    <div className='min-h-screen bg-bg-white-0 pb-16'>
      <div className='px-6 lg:px-10'>
        <section className='border-b border-stroke-soft-200 py-7 pt-10'>
          <div className='mb-7'>
            <Link
              href='/portföy'
              className='inline-flex items-center gap-2 text-label-sm text-text-sub-600 hover:text-text-strong-950'
            >
              <RiArrowLeftLine className='size-4' /> Back to portfolio
            </Link>
            <div className='mt-6 flex items-center gap-4'>
              <div className='grid size-14 place-items-center rounded-2xl bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                <img
                  src={networkLogoUrl(company.domain)}
                  alt={`${company.name} logo`}
                  className='size-8 rounded-md object-contain'
                />
              </div>
              <div>
                <h1 className='text-title-h5 text-text-strong-950'>
                  {company.name}
                </h1>
                <p className='mt-1 text-label-sm text-text-sub-600'>
                  {company.focus} · Portfolio Company
                </p>
              </div>
            </div>
          </div>
          <h2 className='text-label-lg text-text-strong-950'>
            Investment thesis
          </h2>
          <p className='mt-1 text-paragraph-md text-text-sub-600'>
            Invested by First Round Capital · {context.meta} · Your stake: —
          </p>
        </section>

        <section className='py-8'>
          <div className='grid gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>
                What this investment tells Scouter
              </h2>
              <p className='mt-3 max-w-3xl text-paragraph-md leading-7 text-text-sub-600'>
                {context.thesis}
              </p>
              <p className='mt-4 text-label-sm text-orange-600'>
                This is the reasoning basis for every match and signal below.
              </p>
            </div>
            <dl className='grid grid-cols-2 gap-7'>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Investor
                </dt>
                <dd className='mt-2 text-label-md'>First Round Capital</dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Investment
                </dt>
                <dd className='mt-2 text-label-md'>{context.meta}</dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>
                  Category
                </dt>
                <dd className='mt-2 text-label-md'>{company.focus}</dd>
              </div>
              <div>
                <dt className='text-paragraph-sm text-text-sub-600'>Website</dt>
                <dd className='mt-2 text-label-md text-primary-base'>
                  {company.domain} ↗
                </dd>
              </div>
            </dl>
          </div>

          {params.slug !== 'notion' && (
            <div className='mt-8 grid gap-5 md:grid-cols-2'>
              {company.matches.map(([name, score, reason]) => (
                <article
                  key={name}
                  className='overflow-hidden rounded-xl border border-stroke-soft-200 bg-white shadow-regular-xs'
                >
                  <div className='p-5'>
                    <div className='flex items-start gap-3'>
                      <span className='grid size-12 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600'>
                        <RiUserStarLine className='size-5' />
                      </span>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-start justify-between gap-3'>
                          <h3 className='text-label-lg text-text-strong-950'>
                            {name}
                          </h3>
                          <span className='rounded-full bg-orange-50 px-2.5 py-1 text-label-xs text-orange-700'>
                            {score}/100
                          </span>
                        </div>
                        <p className='mt-2 text-paragraph-sm text-text-sub-600'>
                          {reason}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Link
                    href='/profile/marcus-webb'
                    className='flex w-full items-center justify-end gap-1 border-t border-stroke-soft-200 px-5 py-4 text-label-sm text-primary-base'
                  >
                    View profile <RiArrowRightLine className='size-4' />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className='grid gap-6 border-t border-stroke-soft-200 pt-8 xl:grid-cols-[minmax(0,1fr)_330px]'>
          <div className='min-w-0'>
            <h2 className='text-label-lg text-text-strong-950'>
              Monitor overview
            </h2>
            <div className='mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-stroke-soft-200 lg:grid-cols-4'>
              {[
                ['Total candidates', '48', '+6 this month'],
                ['In progress', '14', '5 interviewing'],
                [
                  company.matches[0][0],
                  `${company.matches[0][1]}/100`,
                  company.matches[0][2],
                ],
                [
                  company.matches[1][0],
                  `${company.matches[1][1]}/100`,
                  company.matches[1][2],
                ],
              ].map(([label, value, caption], index) => (
                <article
                  key={label}
                  className={`p-4 ${index < 3 ? 'border-r border-stroke-soft-200' : ''}`}
                >
                  <span className='text-label-xs text-text-sub-600'>
                    {label}
                  </span>
                  <strong className='mt-2 block text-title-h6 font-medium text-text-strong-950'>
                    {value}
                  </strong>
                  <span className='mt-1 block text-label-xs text-text-soft-400'>
                    {caption}
                  </span>
                </article>
              ))}
            </div>

            <div className='mt-5 overflow-hidden rounded-2xl bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
              <div className='flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4'>
                <div>
                  <h3 className='text-label-md text-text-strong-950'>
                    Candidates
                  </h3>
                  <p className='mt-1 text-label-xs text-text-soft-400'>
                    Latest profiles from Monitor
                  </p>
                </div>
                <Link
                  href='/monitor'
                  className='text-label-sm text-primary-base'
                >
                  View monitor
                </Link>
              </div>
              <div className='max-w-full overflow-x-auto [scrollbar-width:thin]'>
                <table className='w-full min-w-[1640px] text-left'>
                  <thead>
                    <tr className='border-b border-stroke-soft-200 bg-bg-weak-50 text-label-xs text-text-soft-400'>
                      <th className='px-5 py-3 font-normal'>Name</th>
                      <th className='px-4 py-3 font-normal'>
                        Why They Stood Out
                      </th>
                      <th className='px-4 py-3 font-normal'>Expertise</th>
                      <th className='px-4 py-3 font-normal'>Profile Link</th>
                      <th className='px-4 py-3 font-normal'>
                        Company Description
                      </th>
                      <th className='px-4 py-3 font-normal'>Tenure</th>
                      <th className='px-4 py-3 font-normal'>
                        Additional Info URL
                      </th>
                      <th className='px-4 py-3 font-normal'>
                        Startup Experience
                      </th>
                      <th className='px-5 py-3 font-normal'>Capital Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitorCandidates.map(
                      ([
                        name,
                        initials,
                        position,
                        candidateCompany,
                        stage,
                        reward,
                        updated,
                      ]) => (
                        <tr
                          key={name}
                          className='border-b border-stroke-soft-200 last:border-0'
                        >
                          <td className='px-5 py-4'>
                            <div className='flex items-center gap-3'>
                              <span className='grid size-9 place-items-center rounded-full bg-primary-alpha-10 text-label-xs text-primary-base'>
                                {initials}
                              </span>
                              <strong className='text-label-sm text-text-strong-950'>
                                {name}
                              </strong>
                            </div>
                          </td>
                          <td className='max-w-72 px-4 py-4 text-label-sm text-text-sub-600'>
                            {stage} candidate with a recent {candidateCompany}{' '}
                            signal.
                          </td>
                          <td className='max-w-64 break-words px-4 py-4 text-label-sm leading-6 text-text-sub-600'>
                            {position}
                          </td>
                          <td className='px-4 py-4'>
                            <a
                              href={`mailto:${name.toLowerCase().replaceAll(' ', '.')}@sample.com`}
                              className='inline-flex items-center gap-1 whitespace-nowrap text-label-sm text-primary-base'
                            >
                              Contact profile{' '}
                              <RiExternalLinkLine className='size-4' />
                            </a>
                          </td>
                          <td className='max-w-80 px-4 py-4 text-label-sm text-text-sub-600'>
                            {candidateCompany} opportunity connected to the
                            Notion portfolio thesis.
                          </td>
                          <td className='whitespace-nowrap px-4 py-4 text-label-sm text-text-sub-600'>
                            {`${3 + (name.length % 13)} months`}
                          </td>
                          <td className='px-4 py-4'>
                            <Link
                              href='/dashboard'
                              className='inline-flex items-center gap-1 whitespace-nowrap text-label-sm text-primary-base'
                            >
                              Company info{' '}
                              <RiExternalLinkLine className='size-4' />
                            </Link>
                          </td>
                          <td className='max-w-72 px-4 py-4 text-label-sm text-text-sub-600'>
                            Active candidate in the Scouter monitoring pipeline.
                          </td>
                          <td className='max-w-64 px-5 py-4 text-label-sm font-medium text-text-strong-950'>
                            {reward} potential reward
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className='self-start overflow-hidden rounded-2xl bg-white shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <div className='border-b border-stroke-soft-200 p-5'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <h2 className='text-label-lg text-text-strong-950'>
                    Signals from this company
                  </h2>
                  <p className='mt-1 text-label-sm text-text-sub-600'>
                    {company.signals.length} recent activities
                  </p>
                </div>
                <RiFlashlightLine className='size-5 text-orange-500' />
              </div>
              <div className='mt-4 flex gap-2'>
                <span className='rounded-lg bg-orange-50 px-3 py-1.5 text-label-xs text-orange-600'>
                  Latest
                </span>
                <span className='rounded-lg bg-bg-weak-50 px-3 py-1.5 text-label-xs text-text-sub-600'>
                  This week
                </span>
              </div>
            </div>
            <div className='divide-y divide-stroke-soft-200'>
              {company.signals.map(([time, type, description]) => (
                <article key={description} className='relative px-5 py-5 pl-14'>
                  <span className='absolute left-5 top-5 grid size-7 place-items-center rounded-full bg-white text-orange-500 ring-1 ring-stroke-soft-200'>
                    <RiFlashlightLine className='size-4' />
                  </span>
                  <div className='flex items-center justify-between gap-3'>
                    <span className='text-label-sm text-text-strong-950'>
                      {type}
                    </span>
                    <span className='text-label-xs text-text-soft-400'>
                      {time}
                    </span>
                  </div>
                  <p className='mt-2 text-label-xs leading-5 text-text-sub-600'>
                    {description}
                  </p>
                  <p className='mt-2 text-label-xs text-orange-600'>
                    Fit score for related profiles increased
                  </p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
