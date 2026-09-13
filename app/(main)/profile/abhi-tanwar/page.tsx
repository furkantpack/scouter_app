'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RiArrowLeftLine,
  RiArrowRightUpLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiMapPin2Line,
} from '@remixicon/react';
import { useProductData } from '@/hooks/use-product-data';
import { validWebUrl } from '@/lib/auth-validation';
import { requestJson } from '@/lib/request-json';
import type { FounderDetail, Json } from '@/lib/product-types';

const ABHI_TANWAR_ID = '88264496-cf9f-4423-80fd-067c92fc070d';

type DataRecord = Record<string, Json>;

function recordOf(value: Json | undefined): DataRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as DataRecord)
    : null;
}

function firstText(record: DataRecord | null, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function short(value: string | null | undefined, max = 320) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date);
}

export default function AbhiTanwarProfilePage() {
  const detail = useProductData<FounderDetail>(`/api/founders/${ABHI_TANWAR_ID}`);
  const monitor = useProductData<{ monitors: { founder_id: string }[] }>('/api/monitor');
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const profile = detail.data?.profile;
  const roles = detail.data?.roles || [];
  const currentRole = roles.find((role) => role.company_id === profile?.company_id) || roles[0];
  const currentCompany = recordOf(currentRole?.companies);
  const companyDescription = firstText(currentCompany, [
    'one_liner',
    'description',
    'summary',
    'about',
    'company_description',
  ]);
  const companyWebsiteValue = firstText(currentCompany, ['website_url', 'website', 'url', 'domain']);
  const companyWebsite = companyWebsiteValue && validWebUrl(companyWebsiteValue)
    ? companyWebsiteValue
    : companyWebsiteValue && validWebUrl(`https://${companyWebsiteValue}`)
      ? `https://${companyWebsiteValue}`
      : null;
  const location = firstText(currentCompany, ['location', 'headquarters', 'hq_location']);
  const monitored = monitor.data?.monitors.some((item) => item.founder_id === ABHI_TANWAR_ID) || false;

  const tags = useMemo(() => {
    const values = (detail.data?.tags || [])
      .map((row) => firstText(recordOf(row.tags), ['tag', 'name', 'label']))
      .filter((value): value is string => Boolean(value))
      .filter((value) => !/^scouter\s+\d+|^\d+\s*\/\s*100|based on role/i.test(value));
    return Array.from(new Set(values));
  }, [detail.data?.tags]);

  const evidence = useMemo(() => {
    const raw = profile?.score_rationale?.match(/signals such as\s+(.+?)(?:;|\.|$)/i)?.[1];
    return raw
      ? raw.split(/,| · /).map((item) => item.trim()).filter(Boolean).slice(0, 5)
      : tags.slice(0, 5);
  }, [profile?.score_rationale, tags]);

  async function addToMonitor() {
    if (pending || monitored) return;
    setPending(true);
    setError('');
    try {
      await requestJson('/api/monitor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ founderId: ABHI_TANWAR_ID }),
      });
      await monitor.reload();
      setMessage('Added to Monitor.');
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not add to Monitor.');
    } finally {
      setPending(false);
    }
  }

  if (detail.loading) {
    return <p role='status' className='p-10 text-paragraph-sm text-text-sub-600'>Loading Abhi Tanwar’s profile…</p>;
  }

  if (detail.error || !profile) {
    return <p role='alert' className='p-10 text-paragraph-sm text-error-base'>{detail.error || 'Profile unavailable.'}</p>;
  }

  const initials = profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('');

  return (
    <div className='min-h-screen bg-bg-white-0 pb-16'>
      <div className='h-44 bg-[linear-gradient(110deg,rgba(249,115,22,.32),rgba(255,255,255,.04)),url("https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=80")] bg-cover bg-center' />

      <div className='px-6 lg:px-10'>
        <header className='relative flex flex-wrap items-start gap-5 border-b border-stroke-soft-200 pb-8'>
          <div className='relative -mt-16 shrink-0'>
            <div className='grid size-36 place-items-center rounded-full border-[5px] border-white bg-gradient-to-br from-orange-100 to-orange-50 text-title-h3 text-orange-700 shadow-regular-md'>
              {initials}
            </div>
            <span className='absolute bottom-2 right-1 grid size-9 place-items-center rounded-full border-[3px] border-white bg-blue-500 text-white'>
              <RiCheckLine className='size-5' />
            </span>
          </div>

          <div className='pt-5'>
            <h1 className='text-title-h4 text-text-strong-950'>{profile.name}</h1>
            <p className='mt-1 text-paragraph-lg text-text-sub-600'>
              {[profile.founder_role, profile.company_name].filter(Boolean).join(' · ')}
            </p>
            <p className='mt-2 flex items-center gap-1.5 text-paragraph-sm text-text-soft-400'>
              <RiMapPin2Line className='size-4' />
              {location || `${profile.category_l1 || 'Founder'} · ${profile.timing_label || 'Timing under review'}`}
            </p>
          </div>

          <div className='ml-auto flex flex-wrap gap-2 pt-5'>
            <button
              disabled={pending || monitored}
              onClick={() => void addToMonitor()}
              className='h-10 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs disabled:text-text-soft-400'
            >
              {monitored ? 'Monitored' : 'Add to Monitor'}
            </button>
            {validWebUrl(detail.data?.social.linkedin_url) && (
              <a href={detail.data?.social.linkedin_url || ''} target='_blank' rel='noreferrer' className='inline-flex h-10 items-center gap-2 rounded-lg border border-stroke-soft-200 bg-white px-4 text-label-sm shadow-regular-xs'>
                LinkedIn <RiExternalLinkLine className='size-4' />
              </a>
            )}
            {companyWebsite && (
              <a href={companyWebsite} target='_blank' rel='noreferrer' className='inline-flex h-10 items-center gap-2 rounded-lg bg-primary-base px-5 text-label-sm text-white shadow-regular-xs'>
                Visit {profile.company_name || 'company'} <RiArrowRightUpLine className='size-4' />
              </a>
            )}
          </div>
        </header>

        {(message || error) && <p role={error ? 'alert' : 'status'} className={`pt-4 text-paragraph-sm ${error ? 'text-error-base' : 'text-success-base'}`}>{error || message}</p>}

        <section className='border-b border-stroke-soft-200 py-7'>
          <div className='grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>Founder signals</h2>
              <div className='mt-4 flex flex-wrap gap-2'>
                {tags.slice(0, 6).map((tag) => <span key={tag} className='rounded-full bg-bg-weak-50 px-3 py-1.5 text-label-xs text-text-sub-600'>{tag}</span>)}
              </div>
            </div>
            <div>
              <div className='flex items-center justify-between'>
                <div>
                  <h2 className='text-label-lg text-text-strong-950'>Scouter Score</h2>
                  <p className='mt-1 text-paragraph-xs text-text-soft-400'>{profile.score_status || 'Status unavailable'}</p>
                </div>
                <strong className='text-title-h4 font-medium text-primary-base'>{profile.scouter_score ?? '—'}</strong>
              </div>
              <div className='mt-4 h-2 overflow-hidden rounded-full bg-bg-soft-200'>
                <div className='h-full rounded-full bg-primary-base' style={{ width: `${Math.max(0, Math.min(100, profile.scouter_score || 0))}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className='py-8'>
          <div className='grid gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>About</h2>
              <div className='mt-3 max-w-3xl space-y-4 text-paragraph-md leading-7 text-text-sub-600'>
                <p>{short(companyDescription, expanded ? 1200 : 430) || `${profile.name} is ${profile.founder_role || 'a founder'} at ${profile.company_name || 'a stealth company'}.`}</p>
                {expanded && <p>{profile.score_rationale || 'No additional Scouter assessment is available.'}</p>}
              </div>
              <button onClick={() => setExpanded((value) => !value)} className='mt-4 text-label-sm text-primary-base'>{expanded ? 'Read less' : 'Read more'}</button>
            </div>

            <dl className='grid grid-cols-2 gap-7'>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Company</dt><dd className='mt-2 text-label-md'>{profile.company_name || 'Stealth / pre-company'}</dd></div>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Category</dt><dd className='mt-2 text-label-md'>{profile.category_l1 || 'Not available'}</dd></div>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Founder role</dt><dd className='mt-2 text-label-md'>{profile.founder_role || 'Not available'}</dd></div>
              <div><dt className='text-paragraph-sm text-text-sub-600'>Timing</dt><dd className='mt-2 text-label-md text-primary-base'>{profile.timing_label || 'Not available'}</dd></div>
            </dl>
          </div>

          <div className='mt-8'>
            <h2 className='text-label-lg text-text-strong-950'>Experience</h2>
            <p className='mt-2 max-w-3xl text-paragraph-md leading-7 text-text-sub-600'>Verified founder and company roles from the normalized Scouter profile.</p>
          </div>

          <div className='mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
            {roles.slice(0, 4).map((role, index) => {
              const company = recordOf(role.companies);
              const companyName = firstText(company, ['name', 'company_name']) || 'Company unavailable';
              const title = firstText(role, ['role', 'title', 'position', 'founder_role']) || (index === 0 ? profile.founder_role : null) || 'Role unavailable';
              const start = formatDate(firstText(role, ['start_date', 'started_at', 'start_at']));
              const end = formatDate(firstText(role, ['end_date', 'ended_at', 'end_at'])) || 'Present';
              const description = firstText(role, ['description', 'role_description', 'summary']);
              return (
                <article key={`${companyName}-${index}`} className='overflow-hidden rounded-xl border border-stroke-soft-200 bg-white shadow-regular-xs'>
                  <div className='p-5'>
                    <div className='flex items-center gap-3'>
                      <span className='grid size-12 shrink-0 place-items-center rounded-full bg-orange-50 text-title-h6 text-orange-700'>{companyName[0]}</span>
                      <div><h3 className='text-label-md'>{title}</h3><p className='text-paragraph-sm text-text-sub-600'>{companyName}</p></div>
                    </div>
                    {(start || end) && <p className='mt-5 text-label-xs text-text-soft-400'>{start || 'Start unavailable'} — {end}</p>}
                    {description && <p className='mt-2 line-clamp-3 text-paragraph-sm text-text-sub-600'>{description}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className='grid gap-6 border-t border-stroke-soft-200 pt-8 lg:grid-cols-2'>
          <article className='rounded-2xl border border-stroke-soft-200 bg-white p-6 shadow-regular-xs'>
            <h2 className='text-label-lg text-text-strong-950'>Why this profile stands out</h2>
            <ul className='mt-5 space-y-3 text-paragraph-sm text-text-sub-600'>
              {evidence.map((item) => <li key={item} className='flex gap-2'><RiCheckLine className='mt-0.5 size-4 shrink-0 text-orange-500' />{item}</li>)}
            </ul>
          </article>

          <article className='rounded-2xl border border-stroke-soft-200 bg-white p-6 shadow-regular-xs'>
            <h2 className='text-label-lg text-text-strong-950'>Scouter view</h2>
            <p className='mt-5 text-paragraph-md leading-7 text-text-sub-600'>{profile.score_rationale || 'Scouter assessment is not yet available.'}</p>
          </article>
        </section>

        <div className='mt-8 border-t border-stroke-soft-200 pt-6'>
          <Link href='/ef' className='inline-flex items-center gap-2 text-label-sm text-text-sub-600 hover:text-text-strong-950'><RiArrowLeftLine className='size-4' />Back to EF Founders</Link>
        </div>
      </div>
    </div>
  );
}
