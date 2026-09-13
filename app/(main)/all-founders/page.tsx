'use client';

import { useCallback, useState } from 'react';
import Header from '@/components/header';
import { DashedDivider } from '@/components/dashed-divider';
import { TopFounderTable } from '@/components/top-founder-table';

export default function TopFoundersPage() {
  const [count, setCount] = useState<number | null>(null);
  const handleCountChange = useCallback((nextCount: number | null) => setCount(nextCount), []);

  return (
    <>
      <Header title='Top Founders' description='Highest-conviction founders identified by Scouter.'>
        <span className='rounded-10 bg-bg-weak-50 px-3 py-2 text-label-sm text-text-sub-600'>
          {count == null ? 'Loading count…' : `${count} founders`}
        </span>
      </Header>
      <div className='flex flex-1 flex-col gap-6 px-4 pb-8 lg:px-8'>
        <DashedDivider />
        <TopFounderTable onCountChange={handleCountChange} />
      </div>
    </>
  );
}
