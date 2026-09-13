import Header from '@/components/header';
import { DashedDivider } from '@/components/dashed-divider';
import { NetworkModeView } from '@/components/network-mode-view';

export default function NetworkPage({ searchParams }: { searchParams: { runId?: string } }) {
  return <><Header title='Network Mode' description='Funding-to-Founder Discovery' /><div className='flex flex-1 flex-col gap-6 px-4 pb-8 lg:px-8'><DashedDivider /><NetworkModeView initialRunId={searchParams.runId} /></div></>;
}
