'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  RiCloseLine,
  RiExternalLinkLine,
  RiFileCopyLine,
} from '@remixicon/react';

import { validWebUrl } from '@/lib/auth-validation';
import type { FounderDetail, Json } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';
import * as Divider from '@/components/ui/divider';
import Drawer from '@/components/ui/drawer';
import { FounderDetailModal } from '@/components/founder-detail';
import { AddToListPicker } from '@/components/lists/add-to-list-picker';
import { ProgramFitPanel } from '@/components/program-fit-panel';
import { buildFounderSignalPresentation } from '@/lib/founder-signal-presentation';

type DataRecord = Record<string, Json>;

const FULL_PROFILE_PATHS: Record<string, string> = {
  '88264496-cf9f-4423-80fd-067c92fc070d': '/profile/abhi-tanwar',
};

function recordOf(value: Json | undefined): DataRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as DataRecord)
    : null;
}

function textOf(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstText(record: DataRecord | null, keys: string[]) {
  for (const key of keys) {
    const value = textOf(record?.[key]);
    if (value) return value;
  }
  return null;
}

function shortText(value: string | null | undefined, max = 220) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function getTagNames(detail: FounderDetail | null) {
  if (!detail) return [];
  return unique(
    detail.tags.map((row) =>
      firstText(recordOf(row.tags), ['tag', 'name', 'label']),
    ),
  );
}

const TAG_PRIORITY = [
  /entrepreneur first|^ef$|ef founder|ef s26|ef bridge|the bridge/i,
  /recently left/i,
  /previous exit|prior exit|acquired|repeat founder|serial founder/i,
  /technical founder|founding engineer|cto|research/i,
  /low public footprint|stealth|pre-reveal/i,
  /raising|raise|pre-seed|seed/i,
  /high ownership/i,
];

function strongestTags(tags: string[]) {
  const ranked = tags
    .filter(
      (tag) =>
        !/^scouter\s+\d+|^\d+\s*\/\s*100|based on role|main risk:/i.test(tag),
    )
    .sort((a, b) => {
      const aRank = TAG_PRIORITY.findIndex((pattern) => pattern.test(a));
      const bRank = TAG_PRIORITY.findIndex((pattern) => pattern.test(b));
      return (aRank < 0 ? 99 : aRank) - (bRank < 0 ? 99 : bRank);
    });
  return ranked.slice(0, 4);
}

function evidenceFrom(rationale: string | null, tags: string[]) {
  const evidence = rationale?.match(/signals such as\s+(.+?)(?:;|\.|$)/i)?.[1];
  if (evidence) {
    return unique(
      evidence.split(/,| · /).map((item) => shortText(item, 80)),
    ).slice(0, 5);
  }
  return strongestTags(tags).slice(0, 5);
}

export function FounderPreviewDrawer({
  id,
  onClose,
  onChanged,
  network,
  referencePattern,
  wide = false,
}: {
  id: string;
  onClose: () => void;
  onChanged?: () => void;
  wide?: boolean;
  network?: {
    score: number;
    whyNow: string;
    matchReasons: string[];
    keyDifference: string;
    patternSummary: string;
    breakdown: {
      structural_pattern_fit?: number;
      founder_quality?: number;
      founder_transition?: number;
      timing?: number;
      visibility_advantage?: number;
    };
  };
  referencePattern?: {
    score: number;
    historicalComparable: string;
    whyNow: string;
    patternBranch: string;
    keyEvidence: string[];
    redFlags: string[];
  };
}) {
  const detail = useProductData<FounderDetail>(`/api/founders/${id}`);
  const monitor = useProductData<{ monitors: { founder_id: string }[] }>(
    '/api/monitor',
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showListPicker, setShowListPicker] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [fullProfileTab, setFullProfileTab] = useState<
    'overview' | 'program-fit'
  >('overview');

  const profile = detail.data?.profile;
  const tagNames = useMemo(() => getTagNames(detail.data), [detail.data]);
  const topTags = useMemo(() => strongestTags(tagNames), [tagNames]);
  const signalPresentation = useMemo(
    () => (detail.data ? buildFounderSignalPresentation(detail.data) : null),
    [detail.data],
  );
  const evidence = useMemo(
    () => evidenceFrom(profile?.score_rationale || null, tagNames),
    [profile?.score_rationale, tagNames],
  );
  const monitored =
    monitor.data?.monitors.some((item) => item.founder_id === id) || false;

  const roles = detail.data?.roles || [];
  const currentRole =
    roles.find((role) => role.company_id === profile?.company_id) || roles[0];
  const company = recordOf(currentRole?.companies);
  const companyWebsite = firstText(company, [
    'website_url',
    'website',
    'url',
    'domain',
  ]);
  const websiteUrl =
    companyWebsite && validWebUrl(companyWebsite)
      ? companyWebsite
      : companyWebsite && validWebUrl(`https://${companyWebsite}`)
        ? `https://${companyWebsite}`
        : null;
  const companyDescription = firstText(company, [
    'one_liner',
    'description',
    'summary',
    'about',
    'company_description',
  ]);
  const funding = firstText(company, [
    'funding_visibility',
    'funding_status',
    'funding_stage',
    'funding',
  ]);
  const teamSize = firstText(company, [
    'team_size',
    'employee_count',
    'headcount',
    'size',
  ]);
  const companyAge = firstText(company, [
    'signal_age',
    'company_age',
    'founded_at',
    'founded_year',
  ]);

  const careerHighlights = unique(
    roles.map((role) => {
      const roleCompany = recordOf(role.companies);
      const companyName = firstText(roleCompany, ['name', 'company_name']);
      const title = firstText(role, [
        'role',
        'title',
        'position',
        'founder_role',
      ]);
      return companyName && title
        ? `${companyName} — ${title}`
        : companyName || title;
    }),
  ).slice(0, 4);

  const networkStep = topTags.find((tag) =>
    /entrepreneur first|\bef\b|the bridge/i.test(tag),
  )
    ? 'Entrepreneur First'
    : null;
  const founderPattern = unique([
    careerHighlights[1] || careerHighlights[0],
    networkStep,
    [profile?.founder_role, profile?.company_name].filter(Boolean).join(' — '),
  ]).join(' → ');

  const risks = unique([
    profile?.score_rationale?.match(/main risk:\s*(.+?)(?:\.|$)/i)?.[1],
    /stealth|pre-reveal/i.test(
      `${profile?.company_name} ${profile?.timing_label}`,
    )
      ? 'Product or company remains stealth.'
      : null,
    /verification|unknown/i.test(
      `${profile?.timing_label} ${profile?.score_rationale}`,
    )
      ? 'Founder or company details still need verification.'
      : null,
    /late|established|too mature/i.test(profile?.timing_label || '')
      ? 'Company may be mature for the current thesis.'
      : null,
  ])
    .filter(
      (risk) => !/no major structural penalty|no material risk/i.test(risk),
    )
    .slice(0, 3);

  async function mutate(url: string, options: RequestInit, success: string) {
    if (pending) return false;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await requestJson(url, options);
      setMessage(success);
      await monitor.reload();
      onChanged?.();
      return true;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Could not save.',
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Drawer
        open
        onOpenChange={(open) => !open && onClose()}
        contentClassName={wide ? 'max-w-[1120px]' : 'max-w-[560px]'}
      >
        <div className='flex items-start gap-4 p-5'>
          <div className='min-w-0 flex-1'>
            <DialogPrimitive.Title className='truncate text-label-lg text-text-strong-950'>
              {profile?.name || 'Founder preview'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className='mt-1 text-paragraph-sm text-text-sub-600'>
              {[
                profile?.founder_role,
                profile?.company_name || 'Stealth / pre-company',
              ]
                .filter(Boolean)
                .join(' · ')}
            </DialogPrimitive.Description>
            {profile && (
              <div className='mt-3 flex flex-wrap gap-2'>
                {topTags.map((tag) => (
                  <span
                    key={tag}
                    className='rounded-lg bg-bg-weak-50 px-2 py-1 text-label-xs text-text-sub-600'
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className='text-right'>
            <div className='text-title-h5 text-primary-base'>
              {profile?.scouter_score ?? '—'}
            </div>
            <div className='text-subheading-2xs uppercase text-text-soft-400'>
              Scouter score
            </div>
          </div>
          <DialogPrimitive.Close asChild>
            <Button.Root
              variant='neutral'
              mode='ghost'
              size='xxsmall'
              aria-label='Close founder preview'
            >
              <Button.Icon as={RiCloseLine} />
            </Button.Root>
          </DialogPrimitive.Close>
        </div>

        {detail.loading && (
          <p role='status' className='p-5 text-paragraph-sm text-text-sub-600'>
            Loading founder signal…
          </p>
        )}
        {detail.error && (
          <p role='alert' className='p-5 text-paragraph-sm text-error-base'>
            {detail.error}
          </p>
        )}

        {profile && (
          <div className='flex flex-col'>
            <div className='flex flex-wrap gap-3 px-5 pb-5 text-label-sm'>
              {validWebUrl(detail.data?.social.linkedin_url) && (
                <a
                  className='text-primary-base hover:underline'
                  href={detail.data?.social.linkedin_url || ''}
                  target='_blank'
                  rel='noreferrer'
                >
                  LinkedIn
                </a>
              )}
              {validWebUrl(detail.data?.social.twitter_url) && (
                <a
                  className='text-primary-base hover:underline'
                  href={detail.data?.social.twitter_url || ''}
                  target='_blank'
                  rel='noreferrer'
                >
                  X
                </a>
              )}
              {websiteUrl && (
                <a
                  className='text-primary-base hover:underline'
                  href={websiteUrl}
                  target='_blank'
                  rel='noreferrer'
                >
                  Website
                </a>
              )}
            </div>

            {signalPresentation?.whyNow && (
              <>
                <Divider.Root variant='solid-text'>WHY NOW</Divider.Root>
                <p className='p-5 text-paragraph-sm text-text-strong-950'>
                  {signalPresentation.whyNow}
                </p>
              </>
            )}

            {network && (
              <>
                <Divider.Root variant='solid-text'>NETWORK MATCH</Divider.Root>
                <div className='space-y-4 p-5'>
                  <div>
                    <span className='text-title-h4 text-primary-base'>
                      {network.score}%
                    </span>
                    <span className='ml-2 text-label-sm text-text-sub-600'>
                      Network Match
                    </span>
                  </div>
                  <dl className='grid grid-cols-2 gap-3 text-paragraph-xs'>
                    {[
                      [
                        'Structural Pattern',
                        network.breakdown.structural_pattern_fit,
                      ],
                      ['Founder Quality', network.breakdown.founder_quality],
                      [
                        'Founder Transition',
                        network.breakdown.founder_transition,
                      ],
                      ['Timing', network.breakdown.timing],
                      [
                        'Visibility Advantage',
                        network.breakdown.visibility_advantage,
                      ],
                    ].map(([label, score]) => (
                      <div key={String(label)}>
                        <dt className='text-text-soft-400'>{label}</dt>
                        <dd className='mt-0.5 font-medium text-text-strong-950'>
                          {score == null ? '—' : `${score}%`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <Divider.Root variant='solid-text'>
                  REFERENCE PATTERN MATCH
                </Divider.Root>
                <div className='space-y-3 p-5'>
                  <div className='flex flex-wrap gap-2'>
                    {network.matchReasons.slice(0, 5).map((reason) => (
                      <span
                        key={reason}
                        className='rounded-lg bg-primary-alpha-10 px-2.5 py-1.5 text-label-xs text-primary-base'
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                  <p className='text-paragraph-sm text-text-sub-600'>
                    {network.patternSummary}
                  </p>
                  {network.keyDifference && (
                    <p className='rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm text-text-sub-600'>
                      <span className='font-medium text-text-strong-950'>
                        Key difference:{' '}
                      </span>
                      {network.keyDifference}
                    </p>
                  )}
                </div>
              </>
            )}

            {referencePattern && (
              <>
                <Divider.Root variant='solid-text'>
                  REFERENCE PATTERN
                </Divider.Root>
                <div className='space-y-4 p-5'>
                  <div>
                    <span className='text-title-h4 text-primary-base'>
                      {referencePattern.score}%
                    </span>
                    <span className='ml-2 text-label-sm text-text-sub-600'>
                      Pattern Match
                    </span>
                  </div>
                  <dl className='grid gap-3 text-paragraph-xs sm:grid-cols-2'>
                    <div>
                      <dt className='text-text-soft-400'>
                        Historical Comparable
                      </dt>
                      <dd className='mt-1 text-text-strong-950'>
                        {referencePattern.historicalComparable}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-text-soft-400'>Pattern Branch</dt>
                      <dd className='mt-1 text-text-strong-950'>
                        {referencePattern.patternBranch}
                      </dd>
                    </div>
                  </dl>
                  <div>
                    <p className='text-label-xs text-text-soft-400'>Why Now</p>
                    <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                      {referencePattern.whyNow}
                    </p>
                  </div>
                  <div>
                    <p className='text-label-xs text-text-soft-400'>
                      Key Evidence
                    </p>
                    <ul className='mt-2 space-y-1 text-paragraph-xs text-text-sub-600'>
                      {referencePattern.keyEvidence.length ? (
                        referencePattern.keyEvidence.map((item) => (
                          <li key={item}>• {item}</li>
                        ))
                      ) : (
                        <li>No candidate-specific public evidence recorded.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className='text-label-xs text-text-soft-400'>
                      Red Flags
                    </p>
                    <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                      {referencePattern.redFlags.length
                        ? referencePattern.redFlags.join(' · ')
                        : 'No verified red flags recorded.'}
                    </p>
                  </div>
                </div>
              </>
            )}

            {signalPresentation && signalPresentation.groups.length > 0 && (
              <>
                <Divider.Root variant='solid-text'>
                  SCOUTER SIGNAL SUMMARY
                </Divider.Root>
                <div className='space-y-4 p-5'>
                  {signalPresentation.groups.map((group) => (
                    <div key={group.key}>
                      <p className='text-subheading-2xs uppercase tracking-wide text-text-soft-400'>
                        {group.label}
                      </p>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        {group.signals.map((signal) => (
                          <span
                            key={signal}
                            className='rounded-lg bg-primary-alpha-10 px-2.5 py-1.5 text-label-xs text-primary-base'
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Divider.Root variant='solid-text'>FOUNDER PATTERN</Divider.Root>
            <p className='p-5 text-label-sm text-text-strong-950'>
              {founderPattern ||
                'Current founder pattern is still being verified.'}
            </p>

            <Divider.Root variant='solid-text'>PROGRAM FIT</Divider.Root>
            <div className='p-5'>
              <ProgramFitPanel
                fits={detail.data?.program_fits || []}
                mode='preview'
                onViewFull={() => {
                  setFullProfileTab('program-fit');
                  setFullProfileOpen(true);
                }}
              />
            </div>

            <Divider.Root variant='solid-text'>CURRENT COMPANY</Divider.Root>
            <div className='space-y-3 p-5'>
              <div>
                <div className='text-label-md text-text-strong-950'>
                  {profile.company_name || 'Stealth / pre-company'}
                </div>
                <p className='mt-1 line-clamp-2 text-paragraph-sm text-text-sub-600'>
                  {shortText(companyDescription, 180) ||
                    'No public company description in the normalized profile.'}
                </p>
              </div>
              <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-paragraph-xs'>
                <div>
                  <dt className='text-text-soft-400'>Stage / timing</dt>
                  <dd className='mt-0.5 text-text-strong-950'>
                    {profile.timing_label || 'Not available'}
                  </dd>
                </div>
                <div>
                  <dt className='text-text-soft-400'>Funding visibility</dt>
                  <dd className='mt-0.5 text-text-strong-950'>
                    {funding || 'Not available'}
                  </dd>
                </div>
                <div>
                  <dt className='text-text-soft-400'>Team size</dt>
                  <dd className='mt-0.5 text-text-strong-950'>
                    {teamSize || 'Not available'}
                  </dd>
                </div>
                <div>
                  <dt className='text-text-soft-400'>Company / signal age</dt>
                  <dd className='mt-0.5 text-text-strong-950'>
                    {companyAge || 'Not available'}
                  </dd>
                </div>
              </dl>
            </div>

            <Divider.Root variant='solid-text'>KEY EVIDENCE</Divider.Root>
            <ul className='space-y-2 p-5'>
              {evidence.map((point) => (
                <li
                  key={point}
                  className='flex gap-2 text-paragraph-sm text-text-sub-600'
                >
                  <span className='text-primary-base'>•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <Divider.Root variant='solid-text'>CAREER HIGHLIGHTS</Divider.Root>
            <ul className='space-y-2 p-5'>
              {careerHighlights.length ? (
                careerHighlights.map((highlight) => (
                  <li
                    key={highlight}
                    className='text-paragraph-sm text-text-sub-600'
                  >
                    {highlight}
                  </li>
                ))
              ) : (
                <li className='text-paragraph-sm text-text-sub-600'>
                  No verified prior roles available.
                </li>
              )}
            </ul>

            <Divider.Root variant='solid-text'>
              RISK / OPEN QUESTIONS
            </Divider.Root>
            <ul className='space-y-2 p-5'>
              {risks.length ? (
                risks.map((risk) => (
                  <li
                    key={risk}
                    className='flex gap-2 text-paragraph-sm text-text-sub-600'
                  >
                    <span className='text-warning-base'>•</span>
                    <span>{risk}</span>
                  </li>
                ))
              ) : (
                <li className='text-paragraph-sm text-text-sub-600'>
                  No material open question is recorded.
                </li>
              )}
            </ul>

            <Divider.Root variant='solid-text'>ACTIONS</Divider.Root>
            <div className='space-y-3 p-5'>
              <div className='grid grid-cols-2 gap-2'>
                <Button.Root
                  disabled={pending || monitored}
                  onClick={() =>
                    void mutate(
                      '/api/monitor',
                      {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ founderId: id }),
                      },
                      'Added to Monitor.',
                    )
                  }
                >
                  {monitored ? 'Monitored' : 'Monitor'}
                </Button.Root>
                <Button.Root
                  variant='neutral'
                  mode='stroke'
                  onClick={() => setShowListPicker((shown) => !shown)}
                >
                  Add to List
                </Button.Root>
                {FULL_PROFILE_PATHS[id] ? (
                  <Button.Root variant='neutral' mode='stroke' asChild>
                    <Link href={FULL_PROFILE_PATHS[id]}>Open Full Profile</Link>
                  </Button.Root>
                ) : (
                  <Button.Root
                    variant='neutral'
                    mode='stroke'
                    onClick={() => setFullProfileOpen(true)}
                  >
                    Open Full Profile
                  </Button.Root>
                )}
                <Button.Root
                  variant='neutral'
                  mode='stroke'
                  disabled={!validWebUrl(detail.data?.social.linkedin_url)}
                  onClick={async () => {
                    const url = detail.data?.social.linkedin_url;
                    if (url) {
                      await navigator.clipboard.writeText(url);
                      setMessage('LinkedIn copied.');
                    }
                  }}
                >
                  <Button.Icon as={RiFileCopyLine} />
                  Copy LinkedIn
                </Button.Root>
                <Button.Root
                  variant='neutral'
                  mode='stroke'
                  disabled={!websiteUrl}
                  asChild={Boolean(websiteUrl)}
                >
                  {websiteUrl ? (
                    <a href={websiteUrl} target='_blank' rel='noreferrer'>
                      <Button.Icon as={RiExternalLinkLine} />
                      Visit Company
                    </a>
                  ) : (
                    <span>
                      <Button.Icon as={RiExternalLinkLine} />
                      Visit Company
                    </span>
                  )}
                </Button.Root>
                <Button.Root
                  variant='neutral'
                  mode='stroke'
                  onClick={() => setShowNote((shown) => !shown)}
                >
                  Add Note
                </Button.Root>
              </div>

              {showListPicker && (
                <AddToListPicker founderId={id} onChanged={onChanged} />
              )}

              {showNote && (
                <form
                  className='space-y-2'
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const saved = await mutate(
                      '/api/notes',
                      {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ founderId: id, body: note }),
                      },
                      'Note added.',
                    );
                    if (saved) {
                      setNote('');
                      setShowNote(false);
                    }
                  }}
                >
                  <textarea
                    aria-label='Founder note'
                    required
                    maxLength={10_000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder='Add a short investor note…'
                    className='min-h-20 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 p-3 text-paragraph-sm'
                  />
                  <Button.Root type='submit' disabled={pending || !note.trim()}>
                    Save Note
                  </Button.Root>
                </form>
              )}

              {error && (
                <p role='alert' className='text-paragraph-sm text-error-base'>
                  {error}
                </p>
              )}
              {message && (
                <p
                  role='status'
                  className='text-paragraph-sm text-success-base'
                >
                  {message}
                </p>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {fullProfileOpen && (
        <FounderDetailModal
          id={id}
          onClose={() => setFullProfileOpen(false)}
          onChanged={onChanged}
          initialTab={fullProfileTab}
        />
      )}
    </>
  );
}
