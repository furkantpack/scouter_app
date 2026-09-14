'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { RiCloseLine, RiExternalLinkLine } from '@remixicon/react';

import { relativeFundingAge } from '@/lib/network/funding-feed';
import { requestJson } from '@/lib/request-json';
import * as Button from '@/components/ui/button';
import * as Divider from '@/components/ui/divider';
import Drawer from '@/components/ui/drawer';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';

type Run = {
  id: string;
  status: string;
  input: {
    companyName: string;
    techEu?: { companyId: string; roundId: string; round?: TechEuRound };
  };
  reference_company: Record<string, any>;
  reference_profile: any;
  search_thesis: any;
  metrics: Record<string, any> | null;
  error: string | null;
  created_at: string;
};
type Candidate = {
  id: string;
  founder_id: string | null;
  external_identity: { linkedin_url?: string; company_url?: string } | null;
  founder_name: string;
  current_company: string | null;
  current_role: string | null;
  founder_state: string;
  source_mix: string[];
  scouter_score: number | null;
  network_match: number;
  score_breakdown: Record<string, number>;
  why_now: string;
  match_reasons: string[];
  pattern_match_summary: string;
  key_difference: string;
  visibility: string;
  risks: string[];
  evidence: Array<{ url: string; title?: string; excerpt: string }>;
  rank: number;
};
type RunHistoryItem = Pick<
  Run,
  'id' | 'status' | 'input' | 'reference_company' | 'created_at'
> & { candidate_count: number };
type Response = {
  run: Run | null;
  candidates: Candidate[];
  runs: RunHistoryItem[];
};
type TechEuRound = {
  id: string;
  url: string;
  date: string | null;
  stage: string | null;
  amountEur: number | null;
  company: {
    id: string;
    name: string;
    country: string | null;
    city: string | null;
    sectors: string[];
  };
  investors: string[];
  source: { domain?: string; tier?: string } | null;
  confidence: string | null;
};
type FundingResponse = {
  rounds: TechEuRound[];
  nextCursor: string | null;
  count: number;
  source: string;
  methodology: string;
  retries: number;
};
const activeStatuses = new Set([
  'queued',
  'building_reference',
  'sourcing',
  'enriching',
  'scoring',
]);
const statusLabels: Record<string, string> = {
  queued: 'Queued',
  building_reference: 'Building reference profile',
  sourcing: 'Searching Scouter, Scout and Exa',
  enriching: 'Verifying evidence',
  scoring: 'Scoring candidates',
  ready: 'Ready',
  failed: 'Failed',
};

function roundDate(value: string | null) {
  if (!value) return 'Unknown';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
}

function amountLabel(value: number | null) {
  return value == null
    ? 'Undisclosed'
    : new Intl.NumberFormat('en', {
        style: 'currency',
        currency: 'EUR',
        notation: 'compact',
      }).format(value);
}

function runDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsed);
}

function runLabel(run: Pick<Run, 'input' | 'reference_company'>) {
  return run.input?.companyName || run.reference_company?.name || 'Network run';
}

function verified(round: TechEuRound) {
  return (
    round.confidence?.toLowerCase() === 'high' &&
    round.source?.domain === 'tech.eu'
  );
}

function ExternalCandidateDrawer({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const linkedin = candidate.external_identity?.linkedin_url;
  const company = candidate.external_identity?.company_url;
  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      contentClassName='max-w-[560px]'
    >
      <div className='flex items-start gap-4 p-5'>
        <div className='min-w-0 flex-1'>
          <DialogPrimitive.Title className='text-label-lg text-text-strong-950'>
            {candidate.founder_name}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className='mt-1 text-paragraph-sm text-text-sub-600'>
            {candidate.current_role || candidate.founder_state} ·{' '}
            {candidate.current_company || 'External discovery lead'}
          </DialogPrimitive.Description>
          <div className='mt-3 flex flex-wrap gap-2'>
            {candidate.match_reasons.slice(0, 4).map((reason) => (
              <span
                key={reason}
                className='rounded-lg bg-bg-weak-50 px-2 py-1 text-label-xs text-text-sub-600'
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
        <div className='text-right'>
          <div className='text-title-h5 text-primary-base'>
            {candidate.network_match}%
          </div>
          <div className='text-subheading-2xs uppercase text-text-soft-400'>
            Network Match
          </div>
        </div>
        <DialogPrimitive.Close asChild>
          <Button.Root variant='neutral' mode='ghost' size='xxsmall'>
            <Button.Icon as={RiCloseLine} />
          </Button.Root>
        </DialogPrimitive.Close>
      </div>
      <Divider.Root variant='solid-text'>WHY NOW</Divider.Root>
      <p className='p-5 text-paragraph-sm text-text-strong-950'>
        {candidate.why_now}
      </p>
      <Divider.Root variant='solid-text'>NETWORK MATCH</Divider.Root>
      <dl className='grid grid-cols-2 gap-3 p-5 text-paragraph-xs'>
        {Object.entries(candidate.score_breakdown)
          .filter(([key]) => key !== 'evidence_confidence')
          .map(([key, value]) => (
            <div key={key}>
              <dt className='capitalize text-text-soft-400'>
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className='mt-0.5 font-medium text-text-strong-950'>
                {value}%
              </dd>
            </div>
          ))}
      </dl>
      <Divider.Root variant='solid-text'>REFERENCE PATTERN MATCH</Divider.Root>
      <div className='space-y-3 p-5'>
        <p className='text-paragraph-sm text-text-sub-600'>
          {candidate.pattern_match_summary}
        </p>
        <p className='rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm text-text-sub-600'>
          <b>Key difference: </b>
          {candidate.key_difference || 'Not enough verified evidence.'}
        </p>
      </div>
      <Divider.Root variant='solid-text'>KEY EVIDENCE</Divider.Root>
      <ul className='space-y-3 p-5'>
        {candidate.evidence.slice(0, 5).map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              target='_blank'
              rel='noreferrer'
              className='text-label-sm text-primary-base hover:underline'
            >
              {item.title || new URL(item.url).hostname}
              <RiExternalLinkLine className='ml-1 inline size-4' />
            </a>
            <p className='mt-1 line-clamp-2 text-paragraph-xs text-text-sub-600'>
              {item.excerpt}
            </p>
          </li>
        ))}
      </ul>
      <Divider.Root variant='solid-text'>RISK / OPEN QUESTIONS</Divider.Root>
      <ul className='space-y-2 p-5'>
        {candidate.risks.slice(0, 3).map((risk) => (
          <li key={risk} className='text-paragraph-sm text-text-sub-600'>
            • {risk}
          </li>
        ))}
      </ul>
      <Divider.Root variant='solid-text'>ACTIONS</Divider.Root>
      <div className='grid grid-cols-2 gap-2 p-5'>
        {linkedin && (
          <Button.Root asChild>
            <a href={linkedin} target='_blank' rel='noreferrer'>
              LinkedIn
            </a>
          </Button.Root>
        )}
        {company && (
          <Button.Root variant='neutral' mode='stroke' asChild>
            <a href={company} target='_blank' rel='noreferrer'>
              Visit Company
            </a>
          </Button.Root>
        )}
        <p className='col-span-2 text-paragraph-xs text-text-soft-400'>
          External discovery lead. Monitor, Lists and Notes become available
          after canonical identity review.
        </p>
      </div>
    </Drawer>
  );
}

export function NetworkModeView({ initialRunId }: { initialRunId?: string }) {
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [entryMode, setEntryMode] = useState<'company' | 'funding'>('funding');
  const [funding, setFunding] = useState<FundingResponse | null>(null);
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundingError, setFundingError] = useState('');
  const [lastFundingQuery, setLastFundingQuery] = useState('sort=newest');
  const fundingRequestInFlight = useRef(false);
  const [selectedFunding, setSelectedFunding] = useState<TechEuRound | null>(
    null,
  );
  const activeRunId = data?.run?.id;
  const activeRunStatus = data?.run?.status;
  async function load(runId?: string) {
    try {
      setData(
        await requestJson<Response>(
          `/api/network${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`,
        ),
      );
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Network Mode could not load.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setData(null);
    setLoading(true);
    if (
      initialRunId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        initialRunId,
      )
    ) {
      setSelectionError('That Network run link is invalid. Showing the latest run.');
      void load();
      return;
    }
    setSelectionError('');
    void load(initialRunId);
  }, [initialRunId]);
  useEffect(() => {
    if (
      !activeRunId ||
      !activeRunStatus ||
      !activeStatuses.has(activeRunStatus)
    )
      return;
    const timer = window.setInterval(() => void load(activeRunId), 3000);
    return () => window.clearInterval(timer);
  }, [activeRunId, activeRunStatus]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError('');
    try {
      const result = await requestJson<{ run: Run }>('/api/network', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyName: form.get('companyName'),
          companyUrl: form.get('companyUrl'),
          fundingUrl: form.get('fundingUrl'),
        }),
      });
      selectRun(result.run.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Network analysis could not start.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  async function loadFunding(params: URLSearchParams) {
    if (fundingRequestInFlight.current) return;
    fundingRequestInFlight.current = true;
    setLastFundingQuery(params.toString());
    setFundingLoading(true);
    setFundingError('');
    try {
      setFunding(
        await requestJson<FundingResponse>(`/api/network/funding?${params}`),
      );
    } catch (cause) {
      setFundingError(
        cause instanceof Error
          ? cause.message
          : 'Funding feed temporarily unavailable. Please try again shortly.',
      );
    } finally {
      fundingRequestInFlight.current = false;
      setFundingLoading(false);
    }
  }
  function openFunding() {
    setEntryMode('funding');
    if (funding || fundingError || fundingRequestInFlight.current) return;
    void loadFunding(new URLSearchParams('sort=newest'));
  }
  function searchFunding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      sort: String(form.get('sort') || 'newest'),
    });
    for (const key of [
      'dateFrom',
      'dateTo',
      'country',
      'sector',
      'stage',
      'minAmount',
    ]) {
      const value = String(form.get(key) || '').trim();
      if (value) params.set(key, value);
    }
    void loadFunding(params);
  }
  async function selectFunding(round: TechEuRound) {
    if (submitting) return;
    setSelectedFunding(round);
    setSubmitting(true);
    setError('');
    try {
      const result = await requestJson<{ run: Run }>('/api/network', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyName: round.company.name,
          techEu: { companyId: round.company.id, roundId: round.id, round },
        }),
      });
      selectRun(result.run.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Funding signal analysis could not start.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  const run = data?.run;
  const reference = run?.reference_profile;
  const candidates = data?.candidates || [];
  const history = data?.runs || [];
  const latestReadyRun = history.find((item) => item.status === 'ready');
  const fundingReference = selectedFunding || run?.input.techEu?.round || null;
  const progress = useMemo(
    () =>
      [
        'queued',
        'building_reference',
        'sourcing',
        'enriching',
        'scoring',
        'ready',
      ].indexOf(run?.status || 'queued'),
    [run?.status],
  );
  function selectRun(runId: string) {
    setSelected(null);
    setSelectedFunding(null);
    setSelectionError('');
    setError('');
    setData(null);
    setLoading(true);
    router.push(`/network?runId=${encodeURIComponent(runId)}`, {
      scroll: false,
    });
  }
  return (
    <div className='space-y-7'>
      <section className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-regular-xs'>
        <div className='mb-5'>
          <h2 className='text-title-h6 text-text-strong-950'>
            Start from a funded company
          </h2>
          <p className='mt-1 text-paragraph-sm text-text-sub-600'>
            Understand what capital validated, then find the earlier-stage
            founder pattern.
          </p>
        </div>
        <div className='mb-5 inline-flex rounded-10 bg-bg-weak-50 p-1'>
          <button
            type='button'
            onClick={openFunding}
            className={`rounded-lg px-3 py-2 text-label-sm ${entryMode === 'funding' ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-xs' : 'text-text-sub-600'}`}
          >
            Recent Funding
          </button>
          <button
            type='button'
            onClick={() => setEntryMode('company')}
            className={`rounded-lg px-3 py-2 text-label-sm ${entryMode === 'company' ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-xs' : 'text-text-sub-600'}`}
          >
            Analyze Company
          </button>
        </div>
        {entryMode === 'company' ? (
          <form
            onSubmit={submit}
            className='grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end'
          >
            <label className='text-label-sm text-text-sub-600'>
              Company name
              <input
                name='companyName'
                required
                maxLength={160}
                placeholder='Cosmic Robotics'
                className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm text-text-strong-950'
              />
            </label>
            <label className='text-label-sm text-text-sub-600'>
              Company URL
              <input
                name='companyUrl'
                inputMode='url'
                placeholder='https://company.com'
                className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm text-text-strong-950'
              />
            </label>
            <label className='text-label-sm text-text-sub-600'>
              Funding source{' '}
              <span className='text-text-soft-400'>(optional)</span>
              <input
                name='fundingUrl'
                inputMode='url'
                placeholder='Funding announcement URL'
                className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm text-text-strong-950'
              />
            </label>
            <Button.Root
              type='submit'
              disabled={
                submitting || Boolean(run && activeStatuses.has(run.status))
              }
            >
              {submitting ? 'Starting…' : 'Analyze Funding Signal'}
            </Button.Root>
          </form>
        ) : (
          <div className='space-y-5'>
            <form
              onSubmit={searchFunding}
              className='grid gap-3 md:grid-cols-3 xl:grid-cols-7 xl:items-end'
            >
              <label className='text-label-xs text-text-sub-600'>
                From
                <input
                  name='dateFrom'
                  type='date'
                  className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                />
              </label>
              <label className='text-label-xs text-text-sub-600'>
                To
                <input
                  name='dateTo'
                  type='date'
                  className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                />
              </label>
              <label className='text-label-xs text-text-sub-600'>
                Country
                <input
                  name='country'
                  placeholder='UK'
                  className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                />
              </label>
              <label className='text-label-xs text-text-sub-600'>
                Sector
                <input
                  name='sector'
                  placeholder='AI'
                  className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                />
              </label>
              <label className='text-label-xs text-text-sub-600'>
                Stage
                <input
                  name='stage'
                  placeholder='Seed'
                  className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                />
              </label>
              <label className='text-label-xs text-text-sub-600'>
                Sort
                <select
                  name='sort'
                  defaultValue='newest'
                  className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                >
                  <option value='newest'>Newest</option>
                  <option value='largest'>Largest Round</option>
                </select>
              </label>
              <div className='flex items-end gap-2'>
                <label className='min-w-0 flex-1 text-label-xs text-text-sub-600'>
                  Min EUR
                  <input
                    name='minAmount'
                    type='number'
                    min='0'
                    step='1000'
                    placeholder='1000000'
                    className='mt-1 h-10 w-full rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm'
                  />
                </label>
                <Button.Root type='submit' disabled={fundingLoading}>
                  {fundingLoading ? 'Loading…' : 'Search'}
                </Button.Root>
              </div>
            </form>
            {fundingError && (
              <div className='flex items-center justify-between gap-4 rounded-xl bg-red-alpha-10 p-4'>
                <div>
                  <p className='text-label-sm text-error-base'>
                    Funding feed temporarily unavailable.
                  </p>
                  <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                    Please try again shortly.
                  </p>
                </div>
                <Button.Root
                  variant='neutral'
                  mode='stroke'
                  size='small'
                  disabled={fundingLoading}
                  onClick={() =>
                    void loadFunding(new URLSearchParams(lastFundingQuery))
                  }
                >
                  Retry
                </Button.Root>
              </div>
            )}
            {funding && (
              <div>
                <div className='mb-3 flex items-center justify-between gap-3'>
                  <p className='text-paragraph-sm text-text-sub-600'>
                    {funding.count} recent rounds returned
                  </p>
                  <a
                    href={funding.methodology}
                    target='_blank'
                    rel='noreferrer'
                    className='text-label-xs text-primary-base hover:underline'
                  >
                    {funding.source}
                  </a>
                </div>
                <div className='overflow-x-auto rounded-xl border border-stroke-soft-200'>
                  <table className='w-full min-w-[1050px] text-left'>
                    <thead className='bg-bg-weak-50 text-subheading-xs uppercase text-text-soft-400'>
                      <tr>
                        <th className='px-3 py-2.5'>Company</th>
                        <th className='px-3 py-2.5'>Country</th>
                        <th className='px-3 py-2.5'>Sector</th>
                        <th className='px-3 py-2.5'>Stage</th>
                        <th className='px-3 py-2.5'>Amount EUR</th>
                        <th className='px-3 py-2.5'>Funding Date</th>
                        <th className='px-3 py-2.5'>Verification</th>
                        <th className='px-3 py-2.5'>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funding.rounds.map((round) => (
                        <tr
                          key={round.id}
                          className='border-t border-stroke-soft-200'
                        >
                          <td className='px-3 py-3'>
                            <p className='text-label-sm text-text-strong-950'>
                              {round.company.name}
                            </p>
                            <p className='mt-0.5 line-clamp-1 text-paragraph-xs text-text-soft-400'>
                              {round.investors.slice(0, 3).join(', ') ||
                                'Investors not listed'}
                            </p>
                          </td>
                          <td className='px-3 py-3 text-paragraph-sm text-text-sub-600'>
                            {round.company.country || '—'}
                          </td>
                          <td className='px-3 py-3 text-paragraph-sm text-text-sub-600'>
                            {round.company.sectors.join(', ') || '—'}
                          </td>
                          <td className='px-3 py-3 text-paragraph-sm text-text-sub-600'>
                            {round.stage || '—'}
                          </td>
                          <td className='px-3 py-3 text-label-sm text-text-strong-950'>
                            {amountLabel(round.amountEur)}
                          </td>
                          <td className='px-3 py-3'>
                            <p className='text-paragraph-sm text-text-sub-600'>
                              {roundDate(round.date)}
                            </p>
                            <p className='mt-0.5 text-label-xs text-text-soft-400'>
                              {relativeFundingAge(round.date)}
                            </p>
                          </td>
                          <td className='px-3 py-3'>
                            {verified(round) && (
                              <span className='rounded-lg bg-green-alpha-10 px-2 py-1 text-label-xs text-success-base'>
                                Verified Funding
                              </span>
                            )}
                            {round.url && (
                              <a
                                href={round.url}
                                target='_blank'
                                rel='noreferrer'
                                className='mt-2 block text-label-xs text-primary-base hover:underline'
                              >
                                View Funding Source
                              </a>
                            )}
                          </td>
                          <td className='px-3 py-3'>
                            <button
                              type='button'
                              disabled={
                                submitting ||
                                Boolean(run && activeStatuses.has(run.status))
                              }
                              onClick={() => void selectFunding(round)}
                              className='text-label-sm text-primary-base hover:underline disabled:opacity-40'
                            >
                              Find Emerging Founders
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {fundingReference && (
          <div className='mt-5 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-4'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div>
                <p className='text-subheading-xs uppercase text-text-soft-400'>
                  Selected funding reference
                </p>
                <h3 className='mt-1 text-label-md text-text-strong-950'>
                  {fundingReference.company.name}
                </h3>
                <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                  {fundingReference.stage || 'Stage unknown'} ·{' '}
                  {amountLabel(fundingReference.amountEur)}
                </p>
              </div>
              <span className='rounded-lg bg-bg-white-0 px-2.5 py-1.5 text-label-xs text-text-sub-600'>
                Tech.eu Funding Explorer
              </span>
            </div>
            <dl className='mt-4 grid gap-3 text-paragraph-xs sm:grid-cols-3'>
              <div>
                <dt className='text-text-soft-400'>Funding date</dt>
                <dd className='mt-1 text-text-strong-950'>
                  {roundDate(fundingReference.date)} ·{' '}
                  {relativeFundingAge(fundingReference.date)}
                </dd>
              </div>
              <div>
                <dt className='text-text-soft-400'>Investors</dt>
                <dd className='mt-1 line-clamp-2 text-text-strong-950'>
                  {fundingReference.investors.slice(0, 3).join(', ') ||
                    'Unknown'}
                </dd>
              </div>
              <div>
                <dt className='text-text-soft-400'>Sector</dt>
                <dd className='mt-1 text-text-strong-950'>
                  {fundingReference.company.sectors.join(', ') || 'Unknown'}
                </dd>
              </div>
            </dl>
            {fundingReference.url && (
              <a
                href={fundingReference.url}
                target='_blank'
                rel='noreferrer'
                className='mt-3 inline-block text-label-xs text-primary-base hover:underline'
              >
                View Funding Source
              </a>
            )}
            {(submitting || Boolean(run && activeStatuses.has(run.status))) && (
              <p role='status' className='mt-3 text-label-sm text-primary-base'>
                Analyzing validated funding pattern...
              </p>
            )}
          </div>
        )}
        {error && (
          <p role='alert' className='mt-4 text-paragraph-sm text-error-base'>
            {error}
          </p>
        )}
      </section>
      {loading && (
        <p role='status' className='text-paragraph-sm text-text-sub-600'>
          Loading Network Mode…
        </p>
      )}
      {selectionError && (
        <p role='alert' className='text-paragraph-sm text-warning-base'>
          {selectionError}
        </p>
      )}
      {history.length > 0 && (
        <section className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-label-lg text-text-strong-950'>Analysis history</h2>
              <p className='mt-1 text-paragraph-xs text-text-soft-400'>Most recent 20 persisted runs</p>
            </div>
          </div>
          <div className='mt-4 flex gap-2 overflow-x-auto pb-1'>
            {history.map((item) => (
              <button
                key={item.id}
                type='button'
                aria-pressed={run?.id === item.id}
                onClick={() => selectRun(item.id)}
                className={`min-w-52 rounded-xl border p-3 text-left transition ${run?.id === item.id ? 'border-primary-base bg-primary-alpha-10' : 'border-stroke-soft-200 hover:bg-bg-weak-50'}`}
              >
                <span className='block truncate text-label-sm text-text-strong-950'>
                  {runLabel(item)}
                </span>
                <span className='mt-1 block text-paragraph-xs text-text-soft-400'>
                  {runDate(item.created_at)}
                </span>
                <span className='mt-2 flex items-center justify-between gap-3 text-label-xs'>
                  <span className={item.status === 'failed' ? 'text-error-base' : item.status === 'ready' ? 'text-success-base' : 'text-primary-base'}>
                    {statusLabels[item.status] || item.status}
                  </span>
                  <span className='text-text-sub-600'>{item.candidate_count} candidates</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {run && (
        <section className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <p className='text-subheading-xs uppercase text-text-soft-400'>
                Run status
              </p>
              <h2 className='mt-1 text-title-h6 text-text-strong-950'>
                {statusLabels[run.status] || run.status}
              </h2>
            </div>
            <div className='flex gap-1.5'>
              {[0, 1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 w-10 rounded-full ${step <= progress ? 'bg-primary-base' : 'bg-bg-soft-200'}`}
                />
              ))}
            </div>
          </div>
          {run.status === 'failed' && (
            <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
              <p role='alert' className='text-paragraph-sm text-error-base'>
                This analysis could not be completed. Previous successful results remain available in Analysis history.
              </p>
              {latestReadyRun && latestReadyRun.id !== run.id && (
                <Button.Root
                  variant='neutral'
                  mode='stroke'
                  size='small'
                  onClick={() => selectRun(latestReadyRun.id)}
                >
                  View latest successful run
                </Button.Root>
              )}
            </div>
          )}
        </section>
      )}
      {reference && (
        <section className='grid gap-4 lg:grid-cols-2'>
          <article className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5'>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-subheading-xs uppercase text-text-soft-400'>
                Reference Company
              </p>
              {run?.input.techEu && (
                <a
                  href='https://funding.tech.eu/'
                  target='_blank'
                  rel='noreferrer'
                  className='text-label-xs text-primary-base hover:underline'
                >
                  Tech.eu Funding Explorer
                </a>
              )}
            </div>
            <h2 className='mt-2 text-title-h5 text-text-strong-950'>
              {reference.company?.name}
            </h2>
            <p className='mt-2 text-paragraph-sm text-text-sub-600'>
              {reference.company?.description}
            </p>
            <div className='mt-4 flex flex-wrap gap-2'>
              {reference.validated_pattern?.slice(0, 8).map((tag: string) => (
                <span
                  key={tag}
                  className='rounded-lg bg-primary-alpha-10 px-2.5 py-1.5 text-label-xs text-primary-base'
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className='mt-5 grid grid-cols-3 gap-3 text-paragraph-xs'>
              <div>
                <p className='text-text-soft-400'>Stage</p>
                <p className='mt-1 text-text-strong-950'>
                  {reference.company?.funding_stage || 'Unknown'}
                </p>
              </div>
              <div>
                <p className='text-text-soft-400'>Amount</p>
                <p className='mt-1 text-text-strong-950'>
                  {reference.company?.funding_amount || 'Unknown'}
                </p>
              </div>
              <div>
                <p className='text-text-soft-400'>Date</p>
                <p className='mt-1 text-text-strong-950'>
                  {reference.company?.funding_date || 'Unknown'}
                </p>
              </div>
            </div>
          </article>
          <article className='rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5'>
            <p className='text-subheading-xs uppercase text-text-soft-400'>
              Founder Pattern
            </p>
            <p className='mt-2 text-label-md text-text-strong-950'>
              {reference.founder_pattern?.archetypes?.join(' → ') || 'Unknown'}
            </p>
            <p className='mt-5 text-subheading-xs uppercase text-text-soft-400'>
              Search Thesis
            </p>
            <p className='mt-2 text-paragraph-sm text-text-sub-600'>
              {reference.search_thesis?.summary}
            </p>
          </article>
        </section>
      )}
      {run?.status === 'ready' && (
        <section>
          <div className='mb-4'>
            <h2 className='text-title-h6 text-text-strong-950'>
              Qualified Founders
            </h2>
            <p className='mt-1 text-paragraph-sm text-text-sub-600'>
              Earlier-stage founders matching the pattern capital just
              validated. {candidates.length} passed deterministic hard gates.
            </p>
          </div>
          {candidates.length ? (
            <div className='overflow-x-auto rounded-2xl border border-stroke-soft-200 bg-bg-white-0'>
              <table className='w-full min-w-[1120px] text-left'>
                <thead className='border-b border-stroke-soft-200 bg-bg-weak-50 text-subheading-xs uppercase text-text-soft-400'>
                  <tr>
                    <th className='px-4 py-3'>Founder</th>
                    <th className='px-4 py-3'>Company / Project</th>
                    <th className='px-4 py-3'>State</th>
                    <th className='px-4 py-3'>Scouter</th>
                    <th className='px-4 py-3'>Network Match</th>
                    <th className='px-4 py-3'>Why Now</th>
                    <th className='px-4 py-3'>Visibility</th>
                    <th className='px-4 py-3'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      onClick={() => setSelected(candidate)}
                      className='cursor-pointer border-b border-stroke-soft-200 last:border-0 hover:bg-bg-weak-50'
                    >
                      <td className='px-4 py-4'>
                        <p className='text-label-sm text-text-strong-950'>
                          {candidate.founder_name}
                        </p>
                        <p className='mt-1 text-paragraph-xs text-text-soft-400'>
                          {candidate.source_mix.join(' + ')}
                        </p>
                      </td>
                      <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                        {candidate.current_company || 'Stealth / pre-company'}
                      </td>
                      <td className='px-4 py-4 text-label-xs text-text-sub-600'>
                        {candidate.founder_state}
                      </td>
                      <td className='px-4 py-4 text-label-sm text-text-strong-950'>
                        {candidate.scouter_score ?? '—'}
                      </td>
                      <td className='px-4 py-4'>
                        <span className='text-label-md text-primary-base'>
                          {candidate.network_match}%
                        </span>
                      </td>
                      <td className='max-w-[320px] px-4 py-4'>
                        <p className='line-clamp-2 text-paragraph-sm text-text-sub-600'>
                          {candidate.why_now}
                        </p>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {candidate.match_reasons.slice(0, 3).map((reason) => (
                            <span
                              key={reason}
                              className='rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-subheading-2xs text-text-soft-400'
                            >
                              {reason}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className='px-4 py-4 capitalize text-label-xs text-text-sub-600'>
                        {candidate.visibility.replace('_', ' ')}
                      </td>
                      <td className='px-4 py-4'>
                        <button
                          type='button'
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(candidate);
                          }}
                          className='text-label-sm text-primary-base hover:underline'
                        >
                          View Founder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className='rounded-2xl border border-stroke-soft-200 p-8 text-center text-paragraph-sm text-text-sub-600'>
              No candidates passed the hard gates. Scouter does not pad weak
              results.
            </p>
          )}
        </section>
      )}
      {selected?.founder_id ? (
        <FounderPreviewDrawer
          id={selected.founder_id}
          onClose={() => setSelected(null)}
          network={{
            score: selected.network_match,
            whyNow: selected.why_now,
            matchReasons: selected.match_reasons,
            keyDifference: selected.key_difference,
            patternSummary: selected.pattern_match_summary,
            breakdown: selected.score_breakdown,
          }}
        />
      ) : selected ? (
        <ExternalCandidateDrawer
          candidate={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
