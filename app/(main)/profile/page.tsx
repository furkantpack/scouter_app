'use client';

import * as React from 'react';
import {
  RiArrowRightUpLine,
  RiCheckLine,
  RiMapPin2Line,
  RiMoreLine,
} from '@remixicon/react';

const experience = [
  { mark: 'C', role: 'Lead Product Designer', company: 'ContrastAI', date: 'May 2020 – Present', tone: 'bg-violet-600' },
  { mark: 'S', role: 'Product Designer', company: 'Sisyphus', date: 'Jan 2018 – May 2020', tone: 'bg-emerald-600' },
  { mark: 'E', role: 'UX Designer', company: 'Ephemeral', date: 'Mar 2017 – Jan 2018', tone: 'bg-indigo-600' },
];

export default function ProfilePage() {
  const [following, setFollowing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [tab, setTab] = React.useState('Product design');

  return (
    <div className='min-h-screen bg-bg-white-0 pb-16'>
      <div className='h-44 bg-[linear-gradient(110deg,rgba(16,24,40,.18),rgba(16,24,40,.02)),url("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80")] bg-cover bg-center' />
      <div className='px-6 lg:px-10'>
        <header className='relative flex flex-wrap items-start gap-5 border-b border-stroke-soft-200 pb-8'>
          <div className='relative -mt-16 shrink-0'>
            <img
              className='size-36 rounded-full border-[5px] border-white object-cover shadow-regular-md'
              src='https://www.untitledui.com/images/avatars/amelie-laurent?fm=webp&q=80'
              alt='Amélie Laurent'
            />
            <span className='absolute bottom-2 right-1 grid size-9 place-items-center rounded-full border-[3px] border-white bg-blue-500 text-white'>
              <RiCheckLine className='size-5' />
            </span>
          </div>
          <div className='pt-5'>
            <h1 className='text-title-h4 text-text-strong-950'>Amélie Laurent</h1>
            <p className='mt-1 text-paragraph-lg text-text-sub-600'>I&apos;m a Product Designer based in Melbourne.</p>
          </div>
          <div className='ml-auto flex gap-2 pt-5'>
            <button className='grid size-10 place-items-center rounded-lg border border-stroke-soft-200 bg-white shadow-regular-xs'>
              <RiMoreLine className='size-5' />
            </button>
            <button className='rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs'>View portfolio</button>
            <button
              onClick={() => setFollowing((value) => !value)}
              className='rounded-lg bg-primary-base px-5 text-label-sm text-white shadow-regular-xs'
            >
              {following ? 'Following' : 'Follow'}
            </button>
          </div>
        </header>

        <section className='border-b border-stroke-soft-200 py-7'>
          <div className='flex items-start'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>Experience</h2>
              <p className='mt-1 text-paragraph-md text-text-sub-600'>I specialize in UX/UI design, brand strategy, and Webflow development.</p>
            </div>
            <RiMoreLine className='ml-auto size-5 text-text-soft-400' />
          </div>
        </section>

        <section className='py-8'>
          <div className='grid gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>About me</h2>
              <div className='mt-3 max-w-3xl space-y-4 text-paragraph-md leading-7 text-text-sub-600'>
                <p>I&apos;m a Product Designer based in Melbourne, Australia. I enjoy working on product design, design systems, and Webflow projects.</p>
                <p>I&apos;ve worked with some of the world&apos;s most exciting companies, including Coinbase, Stripe, and Linear. I&apos;m passionate about helping startups grow and improve their customer experience.</p>
                {expanded && <p>My work has been featured on Typewolf, Mindsparkle Magazine, Webflow, Fonts In Use, CSS Winner, Httpster, Siteinspire, and Best Website Gallery.</p>}
              </div>
              <button onClick={() => setExpanded((value) => !value)} className='mt-4 text-label-sm text-primary-base'>
                {expanded ? 'Read less' : 'Read more'}
              </button>
            </div>
            <dl className='grid grid-cols-2 gap-7'>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Location</dt><dd className='mt-2 flex items-center gap-2 text-label-md'><RiMapPin2Line className='size-5' />Melbourne, AU</dd></div>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Website</dt><dd className='mt-2 text-label-md text-primary-base'>amelielaurent.com ↗</dd></div>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Portfolio</dt><dd className='mt-2 text-label-md text-primary-base'>@amelielaurent ↗</dd></div>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Email</dt><dd className='mt-2 text-label-md text-primary-base'>hello@amelie.com ↗</dd></div>
            </dl>
          </div>

          <div className='mt-8 grid gap-5 xl:grid-cols-3'>
            {experience.map((item) => (
              <article key={item.company} className='overflow-hidden rounded-xl border border-stroke-soft-200 bg-white shadow-regular-xs'>
                <div className='p-5'>
                  <div className='flex items-center gap-3'>
                    <span className={`grid size-12 place-items-center rounded-full text-title-h6 text-white ${item.tone}`}>{item.mark}</span>
                    <div><h3 className='text-label-lg'>{item.role}</h3><p className='text-paragraph-sm text-text-sub-600'>{item.company}</p></div>
                  </div>
                  <p className='mt-6 text-paragraph-sm text-text-sub-600'>{item.date}</p>
                </div>
                <button className='flex w-full items-center justify-end gap-1 border-t border-stroke-soft-200 px-5 py-4 text-label-sm text-primary-base'>
                  View project <RiArrowRightUpLine className='size-4' />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className='border-t border-stroke-soft-200 pt-8'>
          <div className='flex flex-wrap items-center gap-4'>
            <h2 className='text-label-lg'>Projects</h2>
            <div className='ml-auto flex rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-1'>
              {['View all', 'Web design', 'Product design', 'Branding'].map((item) => (
                <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-label-sm ${tab === item ? 'bg-white text-text-strong-950 shadow-regular-xs' : 'text-text-sub-600'}`}>{item}</button>
              ))}
            </div>
          </div>
          <div className='mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            {['from-violet-100 to-blue-50', 'from-emerald-100 to-white', 'from-zinc-300 to-zinc-100', 'from-orange-100 to-emerald-50'].map((tone, index) => (
              <div key={tone} className={`aspect-[1.4] overflow-hidden rounded-xl border border-stroke-soft-200 bg-gradient-to-br ${tone} p-5`}>
                <div className='h-full rounded-lg border border-stroke-soft-200 bg-white/90 p-4 shadow-regular-md'>
                  <div className='h-2 w-1/3 rounded bg-bg-soft-200' />
                  <div className='mt-3 h-2 w-2/3 rounded bg-bg-soft-200' />
                  <div className='mt-5 h-1/2 rounded-lg bg-bg-weak-50' />
                  <span className='sr-only'>Project {index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
