'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RiArrowLeftLine,
  RiGroupLine,
  RiLink,
  RiLockLine,
  RiTeamLine,
  RiTimeLine,
  RiUserLine,
} from '@remixicon/react';

import type { FounderList, FounderProfile } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import { DashedDivider } from '@/components/dashed-divider';
import { FounderPreviewDrawer } from '@/components/founder-preview-drawer';
import Header from '@/components/header';
import { ListEditorModal } from '@/components/lists/list-editor-modal';
import type { ScoreSortDirection } from '@/components/sortable-score-head';

type ListFounder = FounderProfile & { signal_tags?: string[] };
const visibilityLabel = {
  private: 'Private',
  organization: 'Organization',
  public_link: 'Public link',
};
const visibilityIcon = {
  private: RiLockLine,
  organization: RiTeamLine,
  public_link: RiLink,
};
const visibilityTheme = {
  private: { accent: '#7C3AED', soft: '#F5F3FF' },
  organization: { accent: '#2563EB', soft: '#EFF6FF' },
  public_link: { accent: '#059669', soft: '#ECFDF5' },
};
const dateLabel = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : 'Recently';
const whyNow = (founder: ListFounder) =>
  founder.timing_label ||
  founder.score_rationale?.split(/[.;]/)[0] ||
  'Current signal is being verified.';

export default function ListDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const result = useProductData<{ list: FounderList; founders: ListFounder[] }>(
    `/api/lists/${params.id}`,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<ScoreSortDirection>('desc');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const list = result.data?.list;
  const sortedFounders = useMemo(
    () => [...(result.data?.founders || [])].sort((left, right) => {
      const leftScore = left.scouter_score ?? -1;
      const rightScore = right.scouter_score ?? -1;
      return sortDirection === 'desc'
        ? rightScore - leftScore || left.name.localeCompare(right.name)
        : leftScore - rightScore || left.name.localeCompare(right.name);
    }),
    [result.data?.founders, sortDirection],
  );

  async function copy() {
    if (!list) return;
    if (list.visibility !== 'public_link' || !list.share_token) {
      setMessage('Change visibility to Public Link before sharing.');
      if (list.can_edit) setEditing(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/shared-list/${encodeURIComponent(list.share_token)}`,
      );
      setMessage('Link copied');
    } catch {
      setError('Could not copy the share link.');
    }
  }
  async function removeFounder(founderId: string) {
    setPending(true);
    setError('');
    try {
      await requestJson(
        `/api/lists/${params.id}/founders?founderId=${encodeURIComponent(founderId)}`,
        { method: 'DELETE' },
      );
      await result.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not remove founder.',
      );
    } finally {
      setPending(false);
    }
  }
  async function removeList() {
    setPending(true);
    setError('');
    try {
      await requestJson(`/api/lists/${params.id}`, { method: 'DELETE' });
      router.push('/lists');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete list.',
      );
      setPending(false);
    }
  }

  return (
    <>
      <Header
        icon={
          <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <RiGroupLine className='size-6 text-text-sub-600' />
          </div>
        }
        title={list?.name || 'List'}
        description={list?.description || 'Curated founder collection.'}
      >
        {list?.can_edit && (
          <Button.Root
            variant='neutral'
            mode='stroke'
            onClick={() => setEditing(true)}
          >
            Rename
          </Button.Root>
        )}
        <Button.Root
          variant='neutral'
          mode='stroke'
          disabled={!list}
          onClick={() => void copy()}
        >
          {message === 'Link copied' ? 'Link copied' : 'Share'}
        </Button.Root>
        {list?.can_edit && (
          <Button.Root
            variant='error'
            mode='stroke'
            onClick={() => setDeleting(true)}
          >
            Delete
          </Button.Root>
        )}
      </Header>
      <div className='px-4 pb-10 lg:px-8'>
        <DashedDivider />
        <div className='flex flex-wrap items-center justify-between gap-3 py-5'>
          <Link
            href='/lists'
            className='flex items-center gap-2 text-label-sm text-text-sub-600 transition hover:text-primary-base'
          >
            <RiArrowLeftLine className='size-4' /> Back to collections
          </Link>
          {message && message !== 'Link copied' && (
            <p role='status' className='text-paragraph-sm text-success-base'>
              {message}
            </p>
          )}
        </div>
        {result.loading && (
          <p role='status' className='text-paragraph-sm text-text-sub-600'>
            Loading list…
          </p>
        )}
        {(result.error || error) && (
          <p
            role='alert'
            className='rounded-xl bg-red-alpha-10 p-3 text-paragraph-sm text-error-base'
          >
            {result.error || error}
          </p>
        )}
        <div className='space-y-6'>
          {list &&
            (() => {
              const VisibilityIcon = visibilityIcon[list.visibility];
              const theme = visibilityTheme[list.visibility];
              return (
                <section className='overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
                  <div
                    className='flex min-h-40 items-end rounded-2xl bg-gradient-to-br from-white px-6 py-6'
                    style={{ backgroundColor: theme.soft }}
                  >
                    <div className='flex min-w-0 items-start gap-4'>
                      <div
                        className='flex size-14 shrink-0 items-center justify-center rounded-2xl bg-bg-white-0 text-title-h6 font-medium shadow-xs ring-1 ring-inset ring-stroke-soft-200'
                        style={{ color: theme.accent }}
                      >
                        {list.name.trim().charAt(0).toUpperCase() || 'L'}
                      </div>
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h2 className='text-title-h5 font-medium text-text-strong-950'>
                            {list.name}
                          </h2>
                          <span
                            className='flex items-center gap-1.5 rounded-full bg-bg-white-0 px-2.5 py-1 text-label-xs shadow-xs ring-1 ring-inset ring-stroke-soft-200'
                            style={{ color: theme.accent }}
                          >
                            <VisibilityIcon className='size-3.5' />
                            {visibilityLabel[list.visibility]}
                          </span>
                        </div>
                        <p className='mt-2 max-w-3xl text-paragraph-sm leading-6 text-text-sub-600'>
                          {list.description ||
                            'A focused founder collection for research and review.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='mt-6 grid grid-cols-1 border-y border-stroke-soft-200 sm:grid-cols-3'>
                    <div className='py-5 sm:pr-5'>
                      <p className='text-label-xs text-text-soft-400'>
                        Founders
                      </p>
                      <p className='mt-1 text-title-h6 font-medium text-text-strong-950'>
                        {result.data?.founders.length || 0}
                      </p>
                      <p className='mt-1 text-paragraph-xs text-text-soft-400'>
                        Profiles in this collection
                      </p>
                    </div>
                    <div className='border-t border-stroke-soft-200 py-5 sm:border-l sm:border-t-0 sm:px-5'>
                      <p className='text-label-xs text-text-soft-400'>Owner</p>
                      <p className='mt-1 truncate text-label-md text-text-strong-950'>
                        {list.creator_label || 'Team member'}
                      </p>
                      <p className='mt-1 text-paragraph-xs text-text-soft-400'>
                        Collection creator
                      </p>
                    </div>
                    <div className='border-t border-stroke-soft-200 py-5 sm:border-l sm:border-t-0 sm:pl-5'>
                      <p className='text-label-xs text-text-soft-400'>
                        Last updated
                      </p>
                      <p className='mt-1 whitespace-nowrap text-label-md text-text-strong-950'>
                        {dateLabel(list.updated_at || list.created_at)}
                      </p>
                      <p className='mt-1 text-paragraph-xs text-text-soft-400'>
                        Most recent list activity
                      </p>
                    </div>
                  </div>
                </section>
              );
            })()}
          {result.data?.founders.length ? (
            <section className='overflow-hidden rounded-3xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
              <div className='flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-bg-weak-50 to-bg-white-0 px-6 py-5'>
                <div>
                  <h2 className='text-title-h6 font-medium text-text-strong-950'>
                    Founder intelligence
                  </h2>
                  <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                    Compare conviction, program fit, and current signals across
                    this collection.
                  </p>
                </div>
                <span className='flex items-center gap-1.5 rounded-full bg-bg-white-0 px-3 py-1.5 text-label-xs text-text-sub-600 shadow-xs ring-1 ring-inset ring-stroke-soft-200'>
                  <RiGroupLine className='size-4' />
                  {result.data.founders.length} profiles
                </span>
              </div>
              <div className='overflow-x-auto border-t border-stroke-soft-200'>
                <table className='w-full min-w-[1000px] text-left'>
                  <thead className='bg-bg-weak-50/80 text-subheading-xs uppercase tracking-wide text-text-soft-400'>
                    <tr>
                      <th className='px-4 py-3'>Founder</th>
                      <th className='px-4 py-3'>Current Company</th>
                      <th className='px-4 py-3'>Current Role</th>
                      <th
                        className='px-4 py-3'
                        aria-sort={sortDirection === 'desc' ? 'descending' : 'ascending'}
                      >
                        <button
                          type='button'
                          className='inline-flex items-center gap-1.5 hover:text-text-strong-950'
                          onClick={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')}
                        >
                          Scouter Score
                          <span aria-hidden='true' className='text-primary-base'>
                            {sortDirection === 'desc' ? '↓' : '↑'}
                          </span>
                        </button>
                      </th>
                      <th className='px-4 py-3'>Best Program Fit</th>
                      <th className='px-4 py-3'>Strongest Signals</th>
                      <th className='px-4 py-3'>Why Now</th>
                      <th className='px-4 py-3'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFounders.map((founder) => (
                      <tr
                        key={founder.id}
                        className='group cursor-pointer border-t border-stroke-soft-200 align-middle transition hover:bg-primary-alpha-10/40'
                        onClick={() => setSelected(founder.id)}
                      >
                        <td className='px-4 py-4'>
                          <div className='flex items-center gap-3'>
                            <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-alpha-10 text-label-xs text-primary-base ring-1 ring-inset ring-primary-base/10'>
                              {founder.name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join('')}
                            </div>
                            <div>
                              <p className='text-label-sm text-text-strong-950'>
                                {founder.name}
                              </p>
                              <p className='mt-0.5 text-paragraph-xs text-text-soft-400'>
                                Founder profile
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                          {founder.company_name || 'Stealth / pre-company'}
                        </td>
                        <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                          {founder.founder_role || 'Founder'}
                        </td>
                        <td className='px-4 py-4'>
                          <span className='inline-flex size-10 items-center justify-center rounded-xl bg-primary-alpha-10 text-label-sm text-primary-base ring-1 ring-inset ring-primary-base/10'>
                            {founder.scouter_score ?? '—'}
                          </span>
                        </td>
                        <td className='px-4 py-4'>
                          {founder.best_program_fit ? (
                            <div className='min-w-36'>
                              <div className='flex items-center justify-between gap-3'>
                                <span className='text-label-sm text-text-strong-950'>
                                  {founder.best_program_fit.program_name}
                                </span>
                                <span className='text-label-xs text-primary-base'>
                                  {founder.best_program_fit.fit_score}
                                </span>
                              </div>
                              <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-bg-soft-200'>
                                <div
                                  className='h-full rounded-full bg-primary-base'
                                  style={{
                                    width: `${Math.min(100, founder.best_program_fit.fit_score)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className='text-text-soft-400'>—</span>
                          )}
                        </td>
                        <td className='px-4 py-4'>
                          <div className='flex max-w-60 flex-wrap gap-1'>
                            {(founder.signal_tags || [])
                              .slice(0, 3)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className='rounded-md border border-primary-base/10 bg-primary-alpha-10 px-2 py-1 text-label-xs text-primary-base'
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className='px-4 py-4'>
                          <p className='line-clamp-2 max-w-64 text-paragraph-sm text-text-sub-600'>
                            {whyNow(founder)}
                          </p>
                        </td>
                        <td className='px-4 py-4'>
                          <button
                            type='button'
                            className='rounded-lg bg-primary-alpha-10 px-2.5 py-1.5 text-label-sm text-primary-base transition hover:bg-primary-alpha-16'
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(founder.id);
                            }}
                          >
                            View
                          </button>
                          {list?.can_edit && (
                            <button
                              type='button'
                              disabled={pending}
                              className='ml-3 rounded-lg px-2 py-1 text-label-sm text-error-base transition hover:bg-red-alpha-10'
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeFounder(founder.id);
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            !result.loading &&
            !result.error && (
              <div className='rounded-3xl border border-dashed border-stroke-soft-200 bg-bg-white-0 p-12 text-center shadow-regular-xs'>
                <div className='mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-alpha-10'>
                  <RiUserLine className='size-5 text-primary-base' />
                </div>
                <h2 className='mt-4 text-label-lg'>
                  No founders in this collection yet.
                </h2>
                <p className='mx-auto mt-2 max-w-md text-paragraph-sm text-text-sub-600'>
                  Browse founder intelligence and add the profiles you want to
                  compare, monitor, or share.
                </p>
                <Button.Root className='mt-5' asChild>
                  <Link href='/all-founders'>Discover Founders</Link>
                </Button.Root>
              </div>
            )
          )}
        </div>
      </div>
      {list && (
        <ListEditorModal
          open={editing}
          list={list}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setMessage('List updated.');
            void result.reload();
          }}
        />
      )}
      <Modal.Root
        open={deleting}
        onOpenChange={(open) => !open && !pending && setDeleting(false)}
      >
        <Modal.Content>
          <Modal.Header
            title='Delete list?'
            description='Memberships will be removed, but founder records will remain untouched.'
          />
          <Modal.Footer className='justify-end'>
            <Button.Root
              variant='neutral'
              mode='stroke'
              disabled={pending}
              onClick={() => setDeleting(false)}
            >
              Cancel
            </Button.Root>
            <Button.Root
              variant='error'
              disabled={pending}
              onClick={() => void removeList()}
            >
              {pending ? 'Deleting…' : 'Delete List'}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
      {selected && (
        <FounderPreviewDrawer
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => void result.reload()}
        />
      )}
    </>
  );
}
