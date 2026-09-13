'use client';

import { useState } from 'react';

import type { FounderList } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { useProductData } from '@/hooks/use-product-data';
import * as Button from '@/components/ui/button';

import { ListEditorModal } from './list-editor-modal';

export function AddToListPicker({
  founderId,
  onChanged,
}: {
  founderId: string;
  onChanged?: () => void;
}) {
  const lists = useProductData<FounderList[]>('/api/lists');
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function toggle(list: FounderList, forceAdd?: boolean) {
    if (pendingId) return;
    const member =
      list.list_founders?.some((row) => row.founder_id === founderId) || false;
    const adding = forceAdd || !member;
    setPendingId(list.id);
    setError('');
    setMessage('');
    try {
      await requestJson(
        `/api/lists/${list.id}/founders${adding ? '' : `?founderId=${encodeURIComponent(founderId)}`}`,
        {
          method: adding ? 'POST' : 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: adding ? JSON.stringify({ founderId }) : undefined,
        },
      );
      setMessage(
        adding ? `Added to ${list.name}.` : `Removed from ${list.name}.`,
      );
      await lists.reload();
      onChanged?.();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update the list.',
      );
    } finally {
      setPendingId('');
    }
  }

  return (
    <div className='space-y-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-3'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-label-sm text-text-strong-950'>Add to List</span>
        <button
          type='button'
          className='text-label-xs text-primary-base hover:underline'
          onClick={() => setCreating(true)}
        >
          + New List
        </button>
      </div>
      {lists.loading && (
        <p role='status' className='text-paragraph-xs text-text-sub-600'>
          Loading lists…
        </p>
      )}
      {lists.data?.length === 0 && (
        <p className='text-paragraph-xs text-text-sub-600'>
          No lists yet. Create one here.
        </p>
      )}
      <div className='max-h-48 space-y-2 overflow-y-auto'>
        {lists.data?.map((list) => {
          const member =
            list.list_founders?.some((row) => row.founder_id === founderId) ||
            false;
          return (
            <div
              key={list.id}
              className='flex items-center justify-between gap-3 rounded-lg bg-bg-white-0 px-3 py-2'
            >
              <div className='min-w-0'>
                <div className='truncate text-label-sm text-text-strong-950'>
                  {list.name}
                </div>
                <div className='text-paragraph-xs text-text-soft-400'>
                  {member
                    ? 'Already in list'
                    : list.visibility.replaceAll('_', ' ')}
                </div>
              </div>
              <Button.Root
                size='xxsmall'
                variant={member ? 'neutral' : 'primary'}
                mode={member ? 'stroke' : 'filled'}
                disabled={Boolean(pendingId) || !list.can_edit}
                onClick={() => void toggle(list)}
              >
                {pendingId === list.id ? 'Saving…' : member ? 'Remove' : 'Add'}
              </Button.Root>
            </div>
          );
        })}
      </div>
      {(error || lists.error) && (
        <p role='alert' className='text-paragraph-xs text-error-base'>
          {error || lists.error}
        </p>
      )}
      {message && (
        <p role='status' className='text-paragraph-xs text-success-base'>
          {message}
        </p>
      )}
      <ListEditorModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async (list) => {
          await lists.reload();
          await toggle({ ...list, can_edit: true }, true);
        }}
      />
    </div>
  );
}
