import { FundedCompanyIntelligenceView } from '@/components/funded-company-intelligence-view';

export default function FundedCompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <FundedCompanyIntelligenceView id={params.id} />;
}
