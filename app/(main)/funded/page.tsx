'use client';

import Header from '@/components/header';
import { DashedDivider } from '@/components/dashed-divider';
import { FundedCompaniesView } from '@/components/funded-companies-view';

export default function FundedPage() {
  return <>
    <Header title='Funded Companies' description='Companies this investor has backed, organized by thesis fit and founder pattern.' />
    <div className='flex flex-1 flex-col gap-6 px-4 pb-8 lg:px-8'>
      <DashedDivider />
      <FundedCompaniesView />
    </div>
  </>;
}

