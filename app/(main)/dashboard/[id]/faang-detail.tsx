'use client';

import { useState } from 'react';

import { DashedDivider } from '@/components/dashed-divider';
import { FounderSearchResults } from '@/components/founder-results';
import Header from '@/components/header';

export default function FaangDetail({
  title = 'Founders',
  description = 'Founder discovery',
  categoryId = '',
  sources = [],
}: {
  title?: string;
  description?: string;
  categoryId?: string;
  sources?: string[];
} = {}) {
  const [query, setQuery] = useState('');
  return (
    <>
      <Header title={title} description={description} />
      <div className='flex flex-1 flex-col gap-6 px-4 pb-8 lg:px-8'>
        <DashedDivider />
        <input
          aria-label='Search founders'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search founders, companies, roles or sectors'
          className='h-10 rounded-10 border border-stroke-soft-200 bg-bg-white-0 px-3'
        />
        <FounderSearchResults query={query} filter={categoryId} view='table' />
      </div>
    </>
  );
}
