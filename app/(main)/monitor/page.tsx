'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

import { DashedDivider } from '@/components/dashed-divider';
import Header from '@/components/header';
import { MonitorFounderTable } from '@/components/monitor-founder-table';

export default function MonitorPage() {
  const [count, setCount] = useState<number | null>(null);
  const handleCountChange = useCallback(
    (nextCount: number | null) => setCount(nextCount),
    [],
  );

  return (
    <>
      <Header
        title='Founder Monitor'
        description='Founders monitored by your active organization.'
      >
        <span className='rounded-10 bg-bg-weak-50 px-3 py-2 text-label-sm text-text-sub-600'>
          {count == null ? 'Loading count…' : `${count} founders`}
        </span>
        <Link
          href='/all-founders'
          className='rounded-10 bg-primary-base px-4 py-2 text-label-sm text-static-white'
        >
          Add profile
        </Link>
      </Header>
      <div className='flex flex-1 flex-col gap-6 px-4 pb-8 lg:px-8'>
        <DashedDivider />
        <MonitorFounderTable onCountChange={handleCountChange} />
      </div>
    </>
  );
}
