'use client';

import * as React from 'react';
import * as DialogPrimitives from '@radix-ui/react-dialog';
import { useSetAtom } from 'jotai';

import * as Button from '@/components/ui/button';
import * as TabMenuHorizontal from '@/components/ui/tab-menu-horizontal';
import { settingsModalOpenAtom } from '@/components/settings-modal';

import CurrencySettings from './currency-settings';
import PaymentMethod from './payment-method';
import TaxSettings from './tax-settings';

export default function PaymentBilling() {
  const setSettingsModalOpen = useSetAtom(settingsModalOpenAtom);

  return (
    <div className=''>
      <div className='flex w-full flex-col gap-3.5 px-5 py-4 sm:flex-row sm:items-center'>
        <div className='flex-1'>
          <DialogPrimitives.Title className='text-label-md text-text-strong-950'>
            Credits & Billing
          </DialogPrimitives.Title>
          <DialogPrimitives.Description className='mt-1 text-paragraph-sm text-text-sub-600'>
            Manage Scouter credits, payment methods, and billing preferences
          </DialogPrimitives.Description>
        </div>
        <div className='grid grid-cols-2 items-center gap-3 sm:flex'>
          <Button.Root
            variant='neutral'
            mode='stroke'
            size='small'
            className='rounded-10'
            onClick={() => setSettingsModalOpen(false)}
          >
            Discard
          </Button.Root>
          <Button.Root size='small' className='rounded-10'>
            Save Changes
          </Button.Root>
        </div>
      </div>

      <div className='border-y border-stroke-soft-200 bg-bg-weak-50/50 px-5 py-5'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <p className='text-label-xs text-text-sub-600'>Available credits</p>
            <p className='mt-1 text-title-h5 text-text-strong-950'>2,480</p>
            <p className='mt-1 text-paragraph-xs text-text-soft-400'>
              Credits are used for founder searches and profile enrichment.
            </p>
          </div>
          <span className='rounded-full bg-success-lighter px-3 py-1.5 text-label-xs text-success-base'>
            Active workspace
          </span>
        </div>

        <div className='mt-5 grid gap-3 sm:grid-cols-3'>
          {[
            ['Starter', '1,000 credits', '$29'],
            ['Growth', '5,000 credits', '$99'],
            ['Scale', '15,000 credits', '$249'],
          ].map(([name, credits, price], index) => (
            <div
              key={name}
              className='rounded-xl bg-bg-white-0 p-4 ring-1 ring-inset ring-stroke-soft-200'
            >
              <div className='flex items-start justify-between gap-2'>
                <div>
                  <p className='text-label-sm text-text-strong-950'>{name}</p>
                  <p className='mt-1 text-paragraph-xs text-text-sub-600'>
                    {credits}
                  </p>
                </div>
                <strong className='text-label-md text-text-strong-950'>
                  {price}
                </strong>
              </div>
              <Button.Root
                variant={index === 1 ? 'primary' : 'neutral'}
                mode={index === 1 ? 'filled' : 'stroke'}
                size='xsmall'
                className='mt-4 w-full rounded-lg'
              >
                Buy credits
              </Button.Root>
            </div>
          ))}
        </div>
      </div>

      <TabMenuHorizontal.Root defaultValue='payment-mehod'>
        <TabMenuHorizontal.List className='px-5'>
          <TabMenuHorizontal.Trigger value='payment-mehod'>
            Payment Method
          </TabMenuHorizontal.Trigger>
          <TabMenuHorizontal.Trigger value='currency-settings'>
            Currency Settings
          </TabMenuHorizontal.Trigger>
          <TabMenuHorizontal.Trigger value='tax-settings'>
            Tax Settings
          </TabMenuHorizontal.Trigger>
        </TabMenuHorizontal.List>

        <TabMenuHorizontal.Content
          value='payment-mehod'
          className='animate-setting-tab'
        >
          <PaymentMethod />
        </TabMenuHorizontal.Content>
        <TabMenuHorizontal.Content
          value='currency-settings'
          className='animate-setting-tab'
        >
          <CurrencySettings />
        </TabMenuHorizontal.Content>
        <TabMenuHorizontal.Content
          value='tax-settings'
          className='animate-setting-tab'
        >
          <TaxSettings />
        </TabMenuHorizontal.Content>
      </TabMenuHorizontal.Root>
    </div>
  );
}
