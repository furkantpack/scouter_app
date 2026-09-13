'use client';

import { useState } from 'react';

import { validWebUrl } from '@/lib/auth-validation';
import type { FounderDetail, FounderNote, Json } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import { AddToListPicker } from '@/components/lists/add-to-list-picker';
import { ProgramFitPanel } from '@/components/program-fit-panel';

export function readable(value: Json | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(readable).join(', ');
  if (typeof value === 'object')
    return Object.entries(value)
      .filter(([key]) => !key.endsWith('_id') && key !== 'id')
      .map(([key, v]) => key.replaceAll('_', ' ') + ': ' + readable(v))
      .join(' · ');
  return String(value);
}
export function FounderDetailModal({
  id,
  onClose,
  onChanged,
  initialTab = 'overview',
}: {
  id: string;
  onClose: () => void;
  onChanged?: () => void;
  initialTab?: 'overview' | 'program-fit';
}) {
  const detail = useProductData<FounderDetail>('/api/founders/' + id);
  const notes = useProductData<FounderNote[]>('/api/notes?founderId=' + id);
  const monitor = useProductData<{ monitors: { founder_id: string }[] }>(
    '/api/monitor',
  );
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'overview' | 'program-fit'>(initialTab);
  const monitored =
    monitor.data?.monitors.some((m) => m.founder_id === id) ?? false;
  async function mutate(url: string, method: string, data?: unknown) {
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await requestJson(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
      await Promise.all([notes.reload(), monitor.reload()]);
      onChanged?.();
      setMessage('Saved.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      return false;
    } finally {
      setPending(false);
    }
  }
  const profile = detail.data?.profile;
  return (
    <Modal.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content className='max-h-[90vh] max-w-[1000px] overflow-y-auto'>
        <Modal.Header
          title={profile?.name || 'Founder details'}
          description={
            profile
              ? [profile.founder_role, profile.company_name]
                  .filter(Boolean)
                  .join(' · ')
              : 'Loading founder profile'
          }
        />
        <div className='flex gap-1 border-b border-stroke-soft-200 px-6'>
          {([['overview', 'Overview'], ['program-fit', 'Program Fit']] as const).map(([value, label]) => <button key={value} type='button' onClick={() => setTab(value)} className={`border-b-2 px-3 py-3 text-label-sm ${tab === value ? 'border-primary-base text-primary-base' : 'border-transparent text-text-sub-600'}`}>{label}</button>)}
        </div>
        {tab === 'program-fit' ? (
          <section className='space-y-5 p-6'>
            <div><h2 className='text-title-h5 text-text-strong-950'>Program Fit</h2><p className='mt-1 max-w-3xl text-paragraph-sm text-text-sub-600'>Similarity to current and historical accelerator/program DNA based on founder, company, category, stage and geography signals.</p><p className='mt-1 text-label-xs text-text-soft-400'>Program Fit is not an acceptance probability.</p></div>
            {detail.loading ? <p role='status'>Loading Program Fit…</p> : detail.error ? <p role='alert'>{detail.error}</p> : <ProgramFitPanel fits={detail.data?.program_fits || []} />}
          </section>
        ) : (
        <div className='grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_300px]'>
          <div className='space-y-5'>
            {detail.loading && <p role='status'>Loading profile…</p>}
            {detail.error && <p role='alert'>{detail.error}</p>}
            {profile && (
              <>
                <div className='flex items-center justify-between rounded-xl bg-bg-weak-50 p-4'>
                  <span>Scouter score</span>
                  <strong
                    title={profile.score_status || undefined}
                    className='text-title-h5'
                  >
                    {profile.scouter_score ?? '—'}
                  </strong>
                </div>
                <p>
                  {profile.score_rationale || 'No score rationale available.'}
                </p>
                <p className='text-label-sm text-text-sub-600'>
                  {profile.timing_label || 'Timing not available'} ·{' '}
                  {profile.category_l1 || 'Category not available'}
                </p>
                <div className='flex gap-4'>
                  {Object.entries(detail.data?.social || {}).map(
                    ([key, value]) =>
                      validWebUrl(value) ? (
                        <a
                          key={key}
                          href={value}
                          target='_blank'
                          rel='noreferrer'
                          className='text-primary-base underline'
                        >
                          {key === 'linkedin_url' ? 'LinkedIn' : 'X'}
                        </a>
                      ) : null,
                  )}
                </div>
                <h3 className='text-label-lg'>Company history</h3>
                {detail.data?.roles.length ? (
                  detail.data.roles.map((role, index) => (
                    <p
                      key={index}
                      className='rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm'
                    >
                      {readable(role)}
                    </p>
                  ))
                ) : (
                  <p>{readable(profile.company_history)}</p>
                )}
                <h3 className='text-label-lg'>Tags</h3>
                <p>
                  {detail.data?.tags.length
                    ? detail.data.tags.map((t) => readable(t.tags)).join(', ')
                    : readable(profile.tags)}
                </p>
              </>
            )}
            <h3 className='text-label-lg'>Organization notes</h3>
            {notes.error && <p role='alert'>{notes.error}</p>}
            {notes.loading && <p role='status'>Loading notes…</p>}
            {notes.data?.length === 0 && <p>No notes yet.</p>}
            {notes.data?.map((note) => (
              <article
                key={note.id}
                className='space-y-2 rounded-xl bg-bg-weak-50 p-3'
              >
                <p className='whitespace-pre-wrap'>{note.body}</p>
                <time className='text-label-xs text-text-soft-400'>
                  {new Date(note.created_at).toLocaleString()}
                </time>
                <div className='flex gap-3'>
                  <button
                    disabled={pending}
                    className='text-label-sm underline'
                    onClick={() => {
                      setEditing(note.id);
                      setBody(note.body);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={pending}
                    className='text-label-sm underline'
                    onClick={() =>
                      void mutate('/api/notes/' + note.id, 'DELETE')
                    }
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await mutate(
                    editing ? '/api/notes/' + editing : '/api/notes',
                    editing ? 'PATCH' : 'POST',
                    { founderId: id, body },
                  )
                ) {
                  setBody('');
                  setEditing(null);
                }
              }}
              className='space-y-3'
            >
              <textarea
                aria-label='Note'
                required
                maxLength={10000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className='min-h-24 w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-3'
              />
              <Button.Root disabled={pending || !body.trim()} type='submit'>
                {editing ? 'Save changes' : 'Add note'}
              </Button.Root>
              {editing && (
                <button
                  type='button'
                  onClick={() => {
                    setEditing(null);
                    setBody('');
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
          <aside className='space-y-4'>
            <Button.Root
              className='w-full'
              disabled={pending || monitor.loading || !!monitor.error}
              onClick={() =>
                void mutate(
                  '/api/monitor' + (monitored ? '?founderId=' + id : ''),
                  monitored ? 'DELETE' : 'POST',
                  { founderId: id },
                )
              }
            >
              {monitored ? 'Remove from Monitor' : 'Add to Monitor'}
            </Button.Root>
            {monitor.error && <p role='alert'>{monitor.error}</p>}
            <AddToListPicker founderId={id} onChanged={onChanged} />
            <a className='block text-label-sm underline' href='/lists'>
              Manage lists
            </a>
            {error && (
              <p role='alert' className='text-error-base'>
                {error}
              </p>
            )}
            {message && <p role='status'>{message}</p>}
          </aside>
        </div>
        )}
      </Modal.Content>
    </Modal.Root>
  );
}
