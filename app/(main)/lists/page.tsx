'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RiArrowRightLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFileCopyLine,
  RiGroupLine,
  RiLink,
  RiLockLine,
  RiTeamLine,
  RiTimeLine,
} from '@remixicon/react';

import type { FounderList } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import Header from '@/components/header';
import { DashedDivider } from '@/components/dashed-divider';
import { ListEditorModal } from '@/components/lists/list-editor-modal';

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

export default function ListsPage() {
  const lists = useProductData<FounderList[]>('/api/lists');
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FounderList | null>(null);
  const [deleting, setDeleting] = useState<FounderList | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const visible = useMemo(
    () =>
      (lists.data || []).filter((list) =>
        `${list.name} ${list.description || ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [lists.data, query],
  );
  const founderCount = (lists.data || []).reduce(
    (total, list) => total + (list.list_founders?.length || 0),
    0,
  );
  const sharedCount = (lists.data || []).filter(
    (list) => list.visibility !== 'private',
  ).length;

  async function copy(list: FounderList) {
    if (list.visibility !== 'public_link' || !list.share_token) {
      setMessage('Change visibility to Public Link before sharing.');
      setEditing(list);
      setEditorOpen(true);
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
  async function remove() {
    if (!deleting || pending) return;
    setPending(true);
    setError('');
    try {
      await requestJson(`/api/lists/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      setMessage('List deleted.');
      await lists.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete the list.',
      );
    } finally {
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
        title='Lists'
        description='Curated founder collections for your team.'
      >
        <Button.Root
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          New List
        </Button.Root>
      </Header>
      <div className='px-4 pb-10 lg:px-8'>
        <DashedDivider />
        <section className='grid grid-cols-1 border-b border-stroke-soft-200 sm:grid-cols-3'>
          {[
            { label: 'Collections', value: lists.data?.length || 0, detail: 'Across your workspace' },
            { label: 'Founder placements', value: founderCount, detail: 'Saved across all lists' },
            { label: 'Shared lists', value: sharedCount, detail: 'Team or public access' },
          ].map((item, index) => (
            <div key={item.label} className={`px-4 py-6 lg:px-6 ${index ? 'border-t border-stroke-soft-200 sm:border-l sm:border-t-0' : ''}`}>
              <p className='text-label-sm text-text-sub-600'>{item.label}</p>
              <div className='mt-2 flex items-end gap-2'>
                <p className='text-title-h5 font-medium text-text-strong-950'>{lists.loading ? '—' : item.value}</p>
                <p className='pb-1 text-label-xs text-text-soft-400'>{item.detail}</p>
              </div>
            </div>
          ))}
        </section>

        <div className='flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h2 className='text-label-lg text-text-strong-950'>Founder collections</h2>
            <p className='mt-1 text-label-sm text-text-soft-400'>Organize profiles for research, comparison, and team review.</p>
          </div>
          <div className='relative w-full lg:w-72'>
            <input
              aria-label='Search lists'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search collections by name or purpose…'
              className='h-10 w-full rounded-10 bg-bg-white-0 px-3 text-label-sm text-text-strong-950 shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 transition placeholder:text-text-soft-400 focus:ring-primary-base'
            />
          </div>
        </div>
        {message && <p role='status' className='mb-5 text-paragraph-sm text-success-base'>{message}</p>}
        {(lists.error || error) && (
          <p
            role='alert'
            className='rounded-xl bg-red-alpha-10 p-3 text-paragraph-sm text-error-base'
          >
            {lists.error || error}
          </p>
        )}
        {lists.loading ? (
          <p role='status' className='text-paragraph-sm text-text-sub-600'>
            Loading lists…
          </p>
        ) : lists.error ? null : visible.length ? (
          <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
            {visible.map((list) => {
              const VisibilityIcon = visibilityIcon[list.visibility];
              const theme = visibilityTheme[list.visibility];
              return (
              <article key={list.id} className='group relative flex min-h-[310px] flex-col overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-regular-md'>
                <div className='pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80' style={{ background: `linear-gradient(180deg, ${theme.soft} 0%, rgba(255,255,255,0) 100%)` }} />
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <div className='relative flex size-12 shrink-0 items-center justify-center rounded-14 text-label-lg ring-1 ring-inset' style={{ backgroundColor: theme.soft, color: theme.accent, boxShadow: `inset 0 0 0 1px ${theme.accent}24` }}>
                      {list.name.trim().charAt(0).toUpperCase() || 'L'}
                    </div>
                    <div className='relative min-w-0'>
                    <h2 className='truncate text-label-lg text-text-strong-950'>
                      {list.name}
                    </h2>
                    <div className='mt-1 flex items-center gap-1.5 text-label-xs text-text-soft-400'><RiTimeLine className='size-3.5' />Updated {dateLabel(list.updated_at || list.created_at)}</div>
                    </div>
                  </div>
                  <span className='relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-label-xs' style={{ backgroundColor: theme.soft, color: theme.accent }}>
                    <VisibilityIcon className='size-3.5' />
                    {visibilityLabel[list.visibility]}
                  </span>
                </div>
                <div className='relative mt-6 flex-1 border-y border-stroke-soft-200 py-4'>
                  <p className='line-clamp-2 min-h-12 text-paragraph-sm leading-6 text-text-sub-600'>
                    {list.description || 'A focused collection ready for founder research, comparison, and review.'}
                  </p>
                  <div className='flex min-h-8 items-center'>
                  <div className='flex -space-x-1.5'>
                  {(list.founder_preview || []).map((founder, index) => (
                    <span
                      key={founder.id}
                      title={founder.name}
                      className='flex size-8 items-center justify-center rounded-full border-2 border-bg-white-0 text-label-xs'
                      style={{ zIndex: 3 - index, backgroundColor: theme.soft, color: theme.accent }}
                    >
                      {founder.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </span>
                  ))}
                  </div>
                  <span className='ml-3 flex items-center gap-1.5 text-label-xs text-text-sub-600'>
                    <RiGroupLine className='size-4' />
                    {list.list_founders?.length || 0} founders
                  </span>
                  </div>
                  <p className='mt-2 text-paragraph-xs text-text-soft-400'>Created by {list.creator_label || 'Team member'}</p>
                </div>
                <div className='mt-5 flex items-center justify-between gap-3'>
                  <div className='flex gap-1'>
                    {list.can_edit && (
                      <>
                        <button
                          type='button'
                          aria-label={`Rename ${list.name}`}
                          className='rounded-lg p-2 text-text-sub-600 hover:bg-bg-weak-50'
                          onClick={() => {
                            setEditing(list);
                            setEditorOpen(true);
                          }}
                        >
                          <RiEditLine className='size-4' />
                        </button>
                        <button
                          type='button'
                          aria-label={`Delete ${list.name}`}
                          className='rounded-lg p-2 text-text-sub-600 hover:bg-red-alpha-10 hover:text-error-base'
                          onClick={() => setDeleting(list)}
                        >
                          <RiDeleteBinLine className='size-4' />
                        </button>
                      </>
                    )}
                    <button
                      type='button'
                      aria-label={`Share ${list.name}`}
                      className='rounded-lg p-2 text-text-sub-600 hover:bg-bg-weak-50'
                      onClick={() => void copy(list)}
                    >
                      <RiFileCopyLine className='size-4' />
                    </button>
                  </div>
                  <Link href={`/lists/${list.id}`} className='flex items-center gap-1.5 text-label-sm' style={{ color: theme.accent }}>Open collection <RiArrowRightLine className='size-4 transition group-hover:translate-x-0.5' /></Link>
                </div>
              </article>
            );})}
          </div>
        ) : lists.data?.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-stroke-soft-200 p-10 text-center'>
            <h2 className='text-label-lg'>No lists yet.</h2>
            <p className='mt-2 text-paragraph-sm text-text-sub-600'>
              Create a list to organize founders you want to track, compare, or
              share.
            </p>
            <Button.Root className='mt-5' onClick={() => setEditorOpen(true)}>
              Create your first list
            </Button.Root>
          </div>
        ) : (
          <p className='text-paragraph-sm text-text-sub-600'>
            No lists match your search.
          </p>
        )}
      </div>
      <ListEditorModal
        open={editorOpen}
        list={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setMessage(editing ? 'List updated.' : 'List created.');
          void lists.reload();
        }}
      />
      <Modal.Root
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && !pending && setDeleting(null)}
      >
        <Modal.Content>
          <Modal.Header
            title='Delete list?'
            description={`This removes “${deleting?.name || ''}” and its memberships. Founders will not be deleted.`}
          />
          <Modal.Footer className='justify-end'>
            <Button.Root
              variant='neutral'
              mode='stroke'
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button.Root>
            <Button.Root
              variant='error'
              disabled={pending}
              onClick={() => void remove()}
            >
              {pending ? 'Deleting…' : 'Delete List'}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
