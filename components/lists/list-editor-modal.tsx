'use client';

import { useEffect, useState } from 'react';
import {
  RiLink,
  RiListSettingsLine,
  RiLockLine,
  RiTeamLine,
} from '@remixicon/react';

import type { FounderList } from '@/lib/product-types';
import { requestJson } from '@/lib/request-json';
import { cn } from '@/utils/cn';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';

const accessOptions = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only you can find, open, and update this list.',
    detail: 'Creator-only access',
    icon: RiLockLine,
  },
  {
    value: 'organization',
    label: 'Organization',
    description: 'Everyone in your active workspace can view the list.',
    detail: 'Team visibility',
    icon: RiTeamLine,
  },
  {
    value: 'public_link',
    label: 'Public link',
    description: 'Anyone with the link can view a safe, read-only version.',
    detail: 'Read-only sharing',
    icon: RiLink,
  },
] as const;

type Visibility = (typeof accessOptions)[number]['value'];

export function ListEditorModal({
  open,
  list,
  onClose,
  onSaved,
}: {
  open: boolean;
  list?: FounderList | null;
  onClose: () => void;
  onSaved: (list: FounderList) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(list?.name || '');
    setDescription(list?.description || '');
    setVisibility(list?.visibility || 'private');
  }, [list, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError('');
    try {
      const saved = await requestJson<FounderList>(
        list ? `/api/lists/${list.id}` : '/api/lists',
        {
          method: list ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        },
      );
      onSaved(saved);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save the list.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal.Root
      open={open}
      onOpenChange={(value) => !value && !pending && onClose()}
    >
      <Modal.Content className='max-h-[92vh] max-w-[780px] overflow-y-auto rounded-3xl shadow-regular-md ring-1 ring-inset ring-stroke-soft-200'>
        <Modal.Header className='m-3 min-h-32 items-end rounded-2xl bg-gradient-to-br from-white via-primary-alpha-10 to-bg-white-0 px-6 py-6 pr-16 before:hidden'>
          <div className='flex min-w-0 items-start gap-4'>
            <div className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-bg-white-0 shadow-xs ring-1 ring-inset ring-stroke-soft-200'>
              <RiListSettingsLine className='size-6 text-primary-base' />
            </div>
            <div className='min-w-0'>
              <div className='mb-1 flex flex-wrap items-center gap-2'>
                <Modal.Title className='text-title-h6 font-medium'>
                  {list ? 'Edit collection' : 'Create a founder list'}
                </Modal.Title>
                {!list && (
                  <span className='rounded-full bg-bg-weak-50 px-2 py-0.5 text-label-xs text-text-sub-600'>
                    Private by default
                  </span>
                )}
              </div>
              <Modal.Description className='max-w-xl text-paragraph-sm'>
                Build a focused founder collection for review, collaboration, or
                safe external sharing.
              </Modal.Description>
            </div>
          </div>
        </Modal.Header>

        <form onSubmit={submit}>
          <Modal.Body className='space-y-7 px-6 pb-7 pt-4'>
            <section aria-labelledby='collection-details-title'>
              <div className='mb-4'>
                <div>
                  <h3
                    id='collection-details-title'
                    className='text-label-md text-text-strong-950'
                  >
                    Collection details
                  </h3>
                  <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                    Give the list a clear purpose so it stays useful as it
                    grows.
                  </p>
                </div>
              </div>

              <div className='rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 sm:p-6'>
                <div className='space-y-5'>
                  <label className='block text-label-sm text-text-strong-950'>
                    List name
                    <input
                      name='name'
                      required
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                      placeholder='e.g. Frontier AI — Q4 review'
                      className='mt-2 h-11 w-full rounded-10 bg-bg-white-0 px-3.5 text-paragraph-sm shadow-xs ring-1 ring-inset ring-stroke-soft-200 outline-none transition placeholder:text-text-soft-400 focus:ring-2 focus:ring-primary-base'
                    />
                    <span className='mt-1.5 block text-right text-paragraph-xs font-normal text-text-soft-400'>
                      {name.length}/100
                    </span>
                  </label>
                  <label className='block text-label-sm text-text-strong-950'>
                    Description{' '}
                    <span className='font-normal text-text-soft-400'>
                      (optional)
                    </span>
                    <textarea
                      name='description'
                      maxLength={1000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder='What belongs in this list, and what decision will it support?'
                      className='mt-2 min-h-32 w-full resize-y rounded-10 bg-bg-white-0 p-3.5 text-paragraph-sm leading-6 shadow-xs ring-1 ring-inset ring-stroke-soft-200 outline-none transition placeholder:text-text-soft-400 focus:ring-2 focus:ring-primary-base'
                    />
                    <span className='mt-1.5 block text-right text-paragraph-xs font-normal text-text-soft-400'>
                      {description.length}/1000
                    </span>
                  </label>
                </div>
              </div>
            </section>

            <section aria-labelledby='list-access-title'>
              <div className='mb-4'>
                <h3
                  id='list-access-title'
                  className='text-label-md text-text-strong-950'
                >
                  Access and sharing
                </h3>
                <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                  Choose who can discover this collection. You can change this
                  later.
                </p>
              </div>
              <div className='grid gap-3 md:grid-cols-3'>
                {accessOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = visibility === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'relative cursor-pointer rounded-3xl p-5 shadow-regular-xs ring-1 ring-inset transition',
                        selected
                          ? 'bg-primary-alpha-10 ring-primary-base/30'
                          : 'bg-bg-white-0 ring-stroke-soft-200 hover:-translate-y-0.5 hover:shadow-regular-md',
                      )}
                    >
                      <input
                        type='radio'
                        name='visibility'
                        value={option.value}
                        checked={selected}
                        onChange={() => setVisibility(option.value)}
                        className='sr-only'
                      />
                      <div className='flex items-start justify-between gap-3'>
                        <div
                          className={cn(
                            'flex size-9 items-center justify-center rounded-lg',
                            selected
                              ? 'bg-primary-base text-white'
                              : 'bg-bg-weak-50 text-text-sub-600',
                          )}
                        >
                          <Icon className='size-4' />
                        </div>
                        <span
                          className={cn(
                            'mt-1 size-4 rounded-full border-2',
                            selected
                              ? 'border-[5px] border-primary-base bg-white'
                              : 'border-stroke-soft-200',
                          )}
                        />
                      </div>
                      <p className='mt-4 text-label-sm text-text-strong-950'>
                        {option.label}
                      </p>
                      <p className='mt-1 min-h-[54px] text-paragraph-xs leading-[18px] text-text-sub-600'>
                        {option.description}
                      </p>
                      <p className='mt-3 border-t border-stroke-soft-200 pt-3 text-label-xs text-text-soft-400'>
                        {option.detail}
                      </p>
                    </label>
                  );
                })}
              </div>
              {visibility === 'public_link' && (
                <div className='mt-3 flex gap-3 rounded-xl border border-primary-base/20 bg-primary-alpha-10 p-3.5'>
                  <RiLink className='mt-0.5 size-4 shrink-0 text-primary-base' />
                  <p className='text-paragraph-xs leading-[18px] text-text-sub-600'>
                    The public view exposes only approved founder and list
                    fields. Editing always remains restricted to the list
                    creator.
                  </p>
                </div>
              )}
            </section>

            {error && (
              <p
                role='alert'
                className='rounded-xl border border-error-lighter bg-red-alpha-10 p-3.5 text-paragraph-sm text-error-base'
              >
                {error}
              </p>
            )}
          </Modal.Body>

          <Modal.Footer className='sticky bottom-0 justify-between bg-bg-white-0/95 px-6 py-4 backdrop-blur'>
            <p className='hidden text-paragraph-xs text-text-soft-400 sm:block'>
              {list
                ? 'Changes apply immediately after saving.'
                : 'You can add founders from any founder profile.'}
            </p>
            <div className='ml-auto flex items-center gap-3'>
              <Button.Root
                type='button'
                variant='neutral'
                mode='stroke'
                disabled={pending}
                onClick={onClose}
              >
                Cancel
              </Button.Root>
              <Button.Root type='submit' disabled={pending || !name.trim()}>
                {pending ? 'Saving…' : list ? 'Save Changes' : 'Create List'}
              </Button.Root>
            </div>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
