import FaangDetail from './faang-detail';

const categoryIds = [
  'faang-big-tech',
  'twitter',
  'stanford',
  'bogazici-university',
  'other',
  'fintech-alumni',
  'ai-alumni',
  'saas-alumni',
  'top-consulting',
  'regional-alumni',
  'global-tier-1',
  'technical-tier-1',
  'regional-tier-1',
  'stem-focus',
  'top-mba',
  'serial-founder',
  'prior-exit',
  'failed-founder',
  'accelerator-alumni',
  'active-angel-investor',
  'startup-advisor',
  'ai-ml-infrastructure',
  'fintech-payments',
  'b2b-saas',
  'deep-tech',
  'climate-greentech',
  'healthtech-biotech',
  'defense-govtech',
  'consumer-creator',
  'hr-future-work',
  'turkey',
  'mena',
  'nordics',
  'dach',
  'iberia',
  'london',
  'new-york-san-francisco',
] as const;

const titleOverrides: Record<string, string> = {
  'faang-big-tech': 'FAANG & Big Tech',
  twitter: 'Twitter',
  stanford: 'Stanford',
  'bogazici-university': 'Boğaziçi University',
  other: 'Other Sources',
  'ai-alumni': 'AI Alumni',
  'saas-alumni': 'SaaS Alumni',
  'top-mba': 'Top MBA',
  'ai-ml-infrastructure': 'AI/ML Infrastructure',
  'b2b-saas': 'B2B SaaS',
  'healthtech-biotech': 'HealthTech & BioTech',
  'defense-govtech': 'Defense & GovTech',
  'consumer-creator': 'Consumer & Creator',
  'hr-future-work': 'HR & Future of Work',
  mena: 'MENA',
  dach: 'DACH',
  'new-york-san-francisco': 'New York & San Francisco',
};

const descriptions: Record<string, string> = {
  'faang-big-tech': 'Big tech alumni cluster',
  'fintech-alumni': 'Operators shaped by leading fintech companies',
  'ai-alumni': 'AI research and product alumni cluster',
  'saas-alumni': 'High-growth SaaS operator network',
  'top-consulting': 'Alumni from leading global consulting firms',
  'serial-founder': 'Repeat founders with company-building experience',
  'prior-exit': 'Founders with a verified prior exit',
  'failed-founder': 'Resilient founders returning after a previous venture',
  'accelerator-alumni': 'Founders from high-signal accelerator programs',
  'active-angel-investor': 'Operators actively investing in startups',
  'startup-advisor': 'Experienced startup advisors and mentors',
  turkey: 'Founders connected to the Turkish ecosystem',
  mena: 'Founders building across the MENA region',
  nordics: 'Founders from the Nordic ecosystem',
  dach: 'Founders across Germany, Austria, and Switzerland',
  iberia: 'Founders across Spain and Portugal',
  london: 'Founders connected to the London ecosystem',
  'new-york-san-francisco': 'Founders across two major startup hubs',
};

function titleFor(id: string) {
  if (titleOverrides[id]) return titleOverrides[id];
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function generateStaticParams() {
  return categoryIds.map((id) => ({ id }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const title = titleFor(id);

  return (
    <FaangDetail
      categoryId={id}
      title={title}
      description={descriptions[id] ?? `${title} founder intelligence cluster`}
      sources={[title, 'Verified profiles', 'High-signal matches']}
    />
  );
}
