'use client';

import { RiFocus3Line } from '@remixicon/react';

import { DashedDivider } from '@/components/dashed-divider';
import Header from '@/components/header';
import { ThesisView } from '@/components/thesis-view';

export default function ThesisPage() {
  return (
    <>
      <Header
        title='Investment Thesis'
        description="Scouter's understanding of what your organization is most likely to invest in."
        icon={
          <div className='flex size-12 items-center justify-center rounded-full bg-bg-white-0 text-text-sub-600 shadow-xs ring-1 ring-inset ring-stroke-soft-200'>
            <RiFocus3Line className='size-6' />
          </div>
        }
      />
      <DashedDivider />
      <div className='flex flex-1 flex-col px-4 pb-10 lg:px-8'>
        <ThesisView />
      </div>
    </>
  );
}
