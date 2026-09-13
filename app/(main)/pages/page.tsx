import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  RiArrowRightUpLine,
  RiDashboardLine,
  RiDoorOpenLine,
  RiFolderUserLine,
} from '@remixicon/react';

import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';

const groups = [
  {
    title: 'Main application',
    description: 'Primary connected product pages using the shared sidebar.',
    icon: RiDashboardLine,
    links: [
      ['/monitor', 'Candidate list'],
      ['/profile', 'Profile'],
      ['/projects', 'AI projects'],
    ],
  },
  {
    title: 'Account & onboarding',
    description: 'Authentication and account setup flows.',
    icon: RiDoorOpenLine,
    links: [
      ['/login', 'Login'],
      ['/register', 'Register'],
      ['/reset-password', 'Reset password'],
      ['/verification', 'Verification'],
    ],
  },
  {
    title: 'Product flow',
    description: 'Investor profile setup flow.',
    icon: RiFolderUserLine,
    links: [['/add-product', 'AI add-product flow']],
  },
];

export default function PagesDirectory() {
  if (!legacyDemoRoutesEnabled()) notFound();

  return (
    <div className='min-h-screen bg-bg-weak-50 px-5 py-8 lg:px-10'>
      <header className='mx-auto max-w-6xl'>
        <p className='text-label-sm text-primary-base'>Project navigation</p>
        <h1 className='mt-1 text-title-h4 text-text-strong-950'>All pages</h1>
        <p className='mt-2 max-w-2xl text-paragraph-md text-text-sub-600'>
          Every active route in the unified project, organized by product flow.
        </p>
      </header>

      <main className='mx-auto mt-7 grid max-w-6xl gap-5 xl:grid-cols-2'>
        {groups.map(({ title, description, icon: Icon, links }) => (
          <section
            key={title}
            className='overflow-hidden rounded-2xl border border-stroke-soft-200 bg-white shadow-regular-xs'
          >
            <div className='flex items-start gap-3 border-b border-stroke-soft-200 p-5'>
              <span className='grid size-10 place-items-center rounded-xl bg-primary-alpha-10 text-primary-base'>
                <Icon className='size-5' />
              </span>
              <div>
                <h2 className='text-label-lg text-text-strong-950'>{title}</h2>
                <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                  {description}
                </p>
              </div>
            </div>
            <div className='divide-y divide-stroke-soft-200'>
              {links.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className='group flex items-center gap-4 px-5 py-3.5 hover:bg-bg-weak-50'
                >
                  <span className='min-w-0 flex-1'>
                    <strong className='block text-label-sm text-text-strong-950'>
                      {label}
                    </strong>
                    <span className='mt-0.5 block truncate font-mono text-paragraph-xs text-text-soft-400'>
                      {href}
                    </span>
                  </span>
                  <RiArrowRightUpLine className='size-4 shrink-0 text-text-soft-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-base' />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
