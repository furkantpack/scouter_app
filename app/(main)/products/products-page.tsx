'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RiArrowRightUpLongLine,
  RiBriefcase4Line,
  RiBuildingLine,
  RiCpuLine,
  RiMapPin2Line,
  RiMoneyDollarCircleLine,
  RiRocket2Line,
  RiSearchLine,
  RiShapesLine,
  RiTeamLine,
  RiUserStarLine,
} from '@remixicon/react';

import { useProductData } from '@/hooks/use-product-data';
import * as Modal from '@/components/ui/modal';
import { DashedDivider } from '@/components/dashed-divider';
import Header from '@/components/header';

import { networkLogoUrl, networkProfiles } from './network-data';

type FundedCompany = {
  id: string;
  name: string;
  companyUrl: string | null;
  description: string | null;
  sector: string | null;
  stage: string | null;
  geography: string | null;
  investmentTiming: string | null;
  sourceUrl: string | null;
  founders: string[];
  founderPattern: string | null;
  thesisMatch: string[];
  whyFit: string | null;
};

type FundedResponse = {
  thesis: { id: string; name: string; updatedAt: string } | null;
  companies: FundedCompany[];
  count: number;
  totalCount: number;
  patterns: {
    sectors: string[];
    stages: string[];
    geographies: string[];
    founderTraits: string[];
    portfolio: Array<string | { pattern?: string }>;
  } | null;
};

type ThesisDimension = {
  id: string;
  dimension_type: string;
  value: string;
  weight: number;
  confidence: number;
};

type ThesisResponse = {
  summary: {
    fund_summary?: { thesis_summary?: string };
    stated_thesis?: { summary?: string };
    observed_thesis?: { summary?: string };
    portfolio_patterns?: Array<{ pattern?: string }>;
  } | null;
  dimensions: ThesisDimension[];
};

const portfolioPalette = [
  ['#9B51E0', '#F7EEFF'],
  ['#2563EB', '#EFF6FF'],
  ['#F97316', '#FFF7ED'],
  ['#0EA5A8', '#EAFBFA'],
  ['#DB2777', '#FDF2F8'],
  ['#6E5AE6', '#F1EFFF'],
  ['#059669', '#ECFDF5'],
] as const;

const thesisGroups = [
  {
    key: 'stages',
    label: 'Stage',
    icon: RiRocket2Line,
    accent: '#7C3AED',
    soft: '#F5F3FF',
  },
  {
    key: 'sectors',
    label: 'Sector',
    icon: RiShapesLine,
    accent: '#2563EB',
    soft: '#EFF6FF',
  },
  {
    key: 'founder_traits',
    label: 'Founder Profile',
    icon: RiUserStarLine,
    accent: '#059669',
    soft: '#ECFDF5',
  },
  {
    key: 'business_models',
    label: 'Business Model',
    icon: RiBriefcase4Line,
    accent: '#D97706',
    soft: '#FFFBEB',
  },
  {
    key: 'geographies',
    label: 'Geography',
    icon: RiMapPin2Line,
    accent: '#E11D48',
    soft: '#FFF1F2',
  },
  {
    key: 'technologies',
    label: 'Technology',
    icon: RiCpuLine,
    accent: '#0EA5A8',
    soft: '#EAFBFA',
  },
] as const;

function domainFromUrl(value: string | null) {
  if (!value) return '';
  try {
    return new URL(
      value.startsWith('http') ? value : `https://${value}`,
    ).hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function dimensionPercent(value: number) {
  return Math.max(
    0,
    Math.min(100, Math.round(value <= 1 ? value * 100 : value)),
  );
}

export const companies = [
  {
    slug: 'vercel',
    category: 'Companies',
    name: 'Vercel',
    focus: 'Developer Experience',
    initials: 'V',
    logo: '/images/major-brands/vercel.svg',
    roles: ['Senior Frontend Engineer', 'Developer Experience Engineer'],
    openRoles: 8,
    reward: '$1,800',
    network: 34,
    accent: '#335CFF',
    soft: '#EEF3FF',
  },
  {
    slug: 'linear',
    category: 'Companies',
    name: 'Linear',
    focus: 'Product & Design',
    initials: 'L',
    logo: '/images/major-brands/linear.svg',
    roles: ['Senior Product Designer', 'UI Engineer'],
    openRoles: 5,
    reward: '$1,200',
    network: 22,
    accent: '#6E5AE6',
    soft: '#F1EFFF',
  },
  {
    slug: 'notion',
    category: 'Companies',
    name: 'Notion',
    focus: 'Product & Engineering',
    initials: 'N',
    logo: '/images/major-brands/notion.svg',
    roles: ['Product Manager, Growth', 'Backend Engineer'],
    openRoles: 11,
    reward: '$2,000',
    network: 43,
    accent: '#9B51E0',
    soft: '#F7EEFF',
  },
  {
    slug: 'arc',
    category: 'Companies',
    name: 'Arc',
    focus: 'Remote Technology',
    initials: 'A',
    logo: '/images/major-brands/arc.svg',
    roles: ['Data Platform Engineer', 'Support Specialist'],
    openRoles: 7,
    reward: '$1,500',
    network: 31,
    accent: '#F97316',
    soft: '#FFF2E8',
  },
  {
    slug: 'stripe',
    category: 'Companies',
    name: 'Stripe',
    focus: 'Finance Infrastructure',
    initials: 'S',
    logo: '/images/major-brands/stripe.svg',
    roles: ['Payments Engineer', 'Research Analyst'],
    openRoles: 9,
    reward: '$2,200',
    network: 39,
    accent: '#635BFF',
    soft: '#F0EFFF',
  },
  {
    slug: 'loom',
    category: 'Companies',
    name: 'Loom',
    focus: 'Video Collaboration',
    initials: 'L',
    logo: '/images/major-brands/loom.svg',
    roles: ['Growth Manager', 'Media Engineer'],
    openRoles: 6,
    reward: '$1,700',
    network: 28,
    accent: '#F43F8C',
    soft: '#FFF0F6',
  },
  {
    slug: 'trello',
    category: 'Companies',
    name: 'Trello',
    focus: 'Project Management',
    initials: 'T',
    logo: '/images/major-brands/trello.svg',
    roles: ['Product Manager', 'Software Engineer'],
    openRoles: 8,
    reward: '$1,800',
    network: 34,
    accent: '#0EA5A8',
    soft: '#EAFBFA',
  },
  {
    slug: 'monday-com',
    category: 'Companies',
    name: 'Monday.com',
    focus: 'Work Operating System',
    initials: 'M',
    logo: '/images/major-brands/monday.svg',
    roles: ['UI/UX Designer', 'Platform Engineer'],
    openRoles: 11,
    reward: '$2,000',
    network: 41,
    accent: '#EAB308',
    soft: '#FFF9DD',
  },
  {
    slug: 'zoom',
    category: 'Companies',
    name: 'Zoom',
    focus: 'Video Communication',
    initials: 'Z',
    logo: '/images/major-brands/zoom.svg',
    roles: ['Product Designer', 'Software Engineer'],
    openRoles: 9,
    reward: '$1,900',
    network: 37,
    accent: '#1885F2',
    soft: '#EAF5FF',
  },
  {
    slug: 'elena-rossi',
    category: 'VC Associate',
    name: 'Elena Rossi',
    focus: 'Early-stage SaaS investor',
    initials: 'ER',
    logo: null,
    roles: ['B2B SaaS · Seed', 'Developer tools · Series A'],
    openRoles: 14,
    reward: '$250K–$1M',
    network: 68,
    accent: '#7C3AED',
    soft: '#F5F3FF',
  },
  {
    slug: 'marcus-lee',
    category: 'VC Associate',
    name: 'Marcus Lee',
    focus: 'Fintech and infrastructure',
    initials: 'ML',
    logo: null,
    roles: ['Fintech · Pre-seed', 'Infrastructure · Seed'],
    openRoles: 9,
    reward: '$100K–$750K',
    network: 51,
    accent: '#2563EB',
    soft: '#EFF6FF',
  },
  {
    slug: 'sophia-khan',
    category: 'VC Associate',
    name: 'Sophia Khan',
    focus: 'Climate and deep tech',
    initials: 'SK',
    logo: null,
    roles: ['Climate · Seed', 'Deep tech · Series A'],
    openRoles: 11,
    reward: '$500K–$2M',
    network: 43,
    accent: '#059669',
    soft: '#ECFDF5',
  },
  {
    slug: 'y-combinator',
    category: 'Accelerator',
    name: 'Y Combinator',
    focus: 'Global founder accelerator',
    initials: 'YC',
    logo: null,
    roles: ['Software · Global', 'Pre-seed · Seed'],
    openRoles: 24,
    reward: '$500K',
    network: 126,
    accent: '#F97316',
    soft: '#FFF7ED',
  },
  {
    slug: 'techstars',
    category: 'Accelerator',
    name: 'Techstars',
    focus: 'Mentor-driven accelerator',
    initials: 'TS',
    logo: null,
    roles: ['B2B · Fintech', 'Global programs'],
    openRoles: 18,
    reward: '$120K',
    network: 94,
    accent: '#6E5AE6',
    soft: '#F1EFFF',
  },
  {
    slug: 'five-hundred-global',
    category: 'Accelerator',
    name: '500 Global',
    focus: 'Emerging market accelerator',
    initials: '5G',
    logo: null,
    roles: ['MENA · Europe', 'Pre-seed · Series A'],
    openRoles: 16,
    reward: '$150K',
    network: 82,
    accent: '#DB2777',
    soft: '#FDF2F8',
  },
];

const portfolioCompanies = [
  {
    slug: 'notion',
    category: 'Companies',
    name: 'Notion',
    focus: 'Productivity Software',
    logoDomain: 'notion.so',
    roles: [
      'Ex-Figma PM, building async-collab tooling',
      'Ex-Notion eng lead, 2nd-time founder signal',
    ],
    openRoles: 24,
    reward: '6',
    network: 91,
    accent: '#9B51E0',
    soft: '#F7EEFF',
  },
  {
    slug: 'verkada',
    category: 'Companies',
    name: 'Verkada',
    focus: 'Enterprise Security / IoT',
    logoDomain: 'verkada.com',
    roles: [
      'Ex-Ring hardware lead, stealth filing detected',
      'Ex-Verkada sales director, career move signal',
    ],
    openRoles: 19,
    reward: '5',
    network: 88,
    accent: '#2563EB',
    soft: '#EFF6FF',
  },
  {
    slug: 'clay',
    category: 'Companies',
    name: 'Clay',
    focus: 'AI Sales Automation',
    logoDomain: 'clay.com',
    roles: [
      'Ex-Clay GTM eng, left 3 weeks ago',
      'Ex-HubSpot growth lead, new entity filed',
    ],
    openRoles: 31,
    reward: '8',
    network: 93,
    accent: '#F97316',
    soft: '#FFF7ED',
  },
  {
    slug: 'k2-space',
    category: 'Companies',
    name: 'K2 Space',
    focus: 'Satellite Manufacturing',
    logoDomain: 'k2space.com',
    roles: [
      'Ex-SpaceX propulsion eng, career move signal',
      'Ex-K2 Space ops lead, exploring new venture',
    ],
    openRoles: 12,
    reward: '3',
    network: 85,
    accent: '#0EA5A8',
    soft: '#EAFBFA',
  },
  {
    slug: 'pomelo-care',
    category: 'Companies',
    name: 'Pomelo Care',
    focus: 'Virtual Maternal Health',
    logoDomain: 'pomelocare.com',
    roles: [
      'Ex-Maven Clinic clinical ops lead',
      'Ex-Pomelo eng, stealth mode detected',
    ],
    openRoles: 17,
    reward: '4',
    network: 87,
    accent: '#DB2777',
    soft: '#FDF2F8',
  },
  {
    slug: 'reducto',
    category: 'Companies',
    name: 'Reducto',
    focus: 'AI Document Parsing',
    logoDomain: 'reducto.ai',
    roles: [
      'Ex-Reducto research eng, 2nd-time founder',
      'Ex-Google DeepMind researcher, career move',
    ],
    openRoles: 22,
    reward: '5',
    network: 90,
    accent: '#6E5AE6',
    soft: '#F1EFFF',
  },
  {
    slug: 'rillet',
    category: 'Companies',
    name: 'Rillet',
    focus: 'Finance & Accounting Software',
    logoDomain: 'rillet.com',
    roles: [
      'Ex-Ramp finance eng, left this month',
      'Ex-Rillet AE, exploring founding role',
    ],
    openRoles: 14,
    reward: '2',
    network: 84,
    accent: '#059669',
    soft: '#ECFDF5',
  },
  {
    slug: 'omnea',
    category: 'Companies',
    name: 'Omnea',
    focus: 'Enterprise Procurement Software',
    logoDomain: 'omnea.co',
    roles: [
      'Ex-Coupa product lead, career move signal',
      'Ex-Omnea eng, new entity filed',
    ],
    openRoles: 16,
    reward: '3',
    network: 86,
    accent: '#335CFF',
    soft: '#EEF3FF',
  },
  {
    slug: 'ownwell',
    category: 'Companies',
    name: 'Ownwell',
    focus: 'PropTech / Tax Automation',
    logoDomain: 'ownwell.com',
    roles: [
      'Ex-Opendoor data eng, stealth signal',
      'Ex-Ownwell ops lead, career move',
    ],
    openRoles: 11,
    reward: '2',
    network: 82,
    accent: '#EAB308',
    soft: '#FFF9DD',
  },
  {
    slug: 'persona',
    category: 'Companies',
    name: 'Persona',
    focus: 'Identity Verification',
    logoDomain: 'withpersona.com',
    roles: [
      'Ex-Persona security eng, exploring new venture',
      'Ex-Stripe identity lead, career move signal',
    ],
    openRoles: 21,
    reward: '4',
    network: 89,
    accent: '#F43F8C',
    soft: '#FFF0F6',
  },
];

const portfolioRationale: Record<
  string,
  { basis: string; reasons: [string, string] }
> = {
  notion: {
    basis:
      'Seed, 2013 · Async-collaboration tooling · Design-led technical founder pattern',
    reasons: [
      'sector (productivity/collab) + role overlap',
      'founder pattern (alumni + repeat founder)',
    ],
  },
  verkada: {
    basis:
      'Seed, 2017 · Hardware-enabled enterprise security · Hardware + enterprise-sales co-founder pattern',
    reasons: [
      'sector (hardware/security) + stealth signal',
      'founder pattern (enterprise GTM alumni)',
    ],
  },
  clay: {
    basis:
      'Seed, 2023 · AI-native GTM tooling · Technical + GTM co-founder pattern',
    reasons: [
      'sector (AI/GTM) + early career-move timing',
      'sector (GTM tooling) + founder pattern (2nd-time)',
    ],
  },
  'k2-space': {
    basis: 'Pre-seed, 2021 · Deep-tech hardware, ex-SpaceX founder pattern',
    reasons: [
      'sector (aerospace hardware) + technical pedigree',
      'founder pattern (alumni network)',
    ],
  },
  'pomelo-care': {
    basis: 'Seed, 2021 · Clinical + digital-health hybrid founder pattern',
    reasons: [
      'sector (digital health) + clinical background',
      'founder pattern (alumni) + stealth signal',
    ],
  },
  reducto: {
    basis: 'Seed, 2023 · Applied-AI research founder pattern',
    reasons: [
      'founder pattern (alumni + repeat founder)',
      'sector (applied AI) + research pedigree',
    ],
  },
  rillet: {
    basis: 'Seed, 2023 · Fintech infra, ex-finance-operator founder pattern',
    reasons: [
      'sector (fintech infra) + early career-move timing',
      'founder pattern (alumni)',
    ],
  },
  omnea: {
    basis: 'Seed, 2022 · Enterprise workflow SaaS founder pattern',
    reasons: [
      'sector (procurement/enterprise SaaS)',
      'founder pattern (alumni) + stealth signal',
    ],
  },
  ownwell: {
    basis: 'Seed, 2022 · Data-driven proptech founder pattern',
    reasons: ['sector (proptech) + stealth signal', 'founder pattern (alumni)'],
  },
  persona: {
    basis: 'Seed, 2018 · Security/infra founder pattern',
    reasons: ['founder pattern (alumni)', 'sector (identity/security infra)'],
  },
};

const summary = [
  { label: 'Verified companies', value: '12', caption: '+3 this month' },
  { label: 'Open positions', value: '74', caption: 'Across trusted teams' },
  { label: 'Active referrals', value: '26', caption: '+8 this week' },
  { label: 'Available rewards', value: '$18.4K', caption: 'Across open roles' },
];

const networkTabs = [
  { id: 'Companies', label: 'Companies', icon: RiBuildingLine },
  { id: 'VC Associate', label: 'VC Associate', icon: RiUserStarLine },
  { id: 'Accelerator', label: 'Accelerator', icon: RiRocket2Line },
] as const;

const portfolioTabs = [
  { id: 'Companies', label: 'Companies', icon: RiBuildingLine, count: 10 },
  {
    id: 'Thesis Matches',
    label: 'Thesis Matches',
    icon: RiUserStarLine,
    count: 187,
  },
  { id: 'Signals', label: 'Signals', icon: RiRocket2Line, count: 34 },
] as const;

const portfolioSummary = [
  {
    label: 'Portfolio companies',
    value: '10',
    caption: '+2 this month',
  },
  {
    label: 'Thesis-matched profiles',
    value: '187',
    caption: 'Derived from your 10 investments',
  },
  { label: 'Active signals', value: '34', caption: '+11 this week' },
  {
    label: 'High-fit candidates',
    value: '22',
    caption: "Score 85+, matched to your portfolio's pattern",
  },
];

const portfolioContent = {
  title: "First Round Capital's portfolio",
  description:
    "Each investment below trains a thesis. Select a company to see what it's surfacing and why.",
  search: 'Search portfolio companies or profiles...',
  featuredLabel: 'Top thesis matches',
  metricLabels: ['Thesis matches', 'Active signals', 'Avg fit score'],
  summary: portfolioSummary,
};

const tabContent = {
  Companies: {
    title: 'Companies in your network',
    description:
      'Select a company to view open positions and exact referral rewards.',
    search: 'Search companies or roles...',
    featuredLabel: 'Featured positions',
    metricLabels: ['Open roles', 'Top reward', 'In network'],
    summary,
  },
  'VC Associate': {
    title: 'VC associates in your network',
    description:
      'Explore investment professionals by thesis, check size, and shared connections.',
    search: 'Search associates or investment focus...',
    featuredLabel: 'Investment focus',
    metricLabels: ['Active deals', 'Check size', 'Connections'],
    summary: [
      {
        label: 'Verified associates',
        value: '3',
        caption: 'High-signal profiles',
      },
      { label: 'Active theses', value: '6', caption: 'Across key sectors' },
      { label: 'Warm paths', value: '162', caption: 'Shared connections' },
      {
        label: 'Check range',
        value: '$100K–$2M',
        caption: 'Pre-seed to Series A',
      },
    ],
  },
  Accelerator: {
    title: 'Accelerators in your network',
    description:
      'Compare programs by sector, geography, capital, and network reach.',
    search: 'Search accelerators or programs...',
    featuredLabel: 'Program focus',
    metricLabels: ['Programs', 'Capital', 'In network'],
    summary: [
      { label: 'Accelerators', value: '3', caption: 'Global programs' },
      { label: 'Active programs', value: '58', caption: 'Across regions' },
      { label: 'Network reach', value: '302', caption: 'Founders and mentors' },
      {
        label: 'Capital offered',
        value: '$770K+',
        caption: 'Combined entry capital',
      },
    ],
  },
};

export function PageProducts({ portfolio = false }: { portfolio?: boolean }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('Companies');
  const [thesisOpen, setThesisOpen] = useState(false);
  const funded = useProductData<FundedResponse>(
    portfolio ? '/api/funded?page=0&pageSize=100' : null,
  );
  const thesis = useProductData<ThesisResponse>(
    portfolio ? '/api/thesis' : null,
  );

  const livePortfolioCompanies = useMemo(
    () =>
      (funded.data?.companies || []).map((company, index) => {
        const [accent, soft] =
          portfolioPalette[index % portfolioPalette.length];
        const matches = company.thesisMatch.filter(Boolean).slice(0, 2);
        const roles = matches.length
          ? matches
          : [company.founderPattern, company.whyFit]
              .filter((value): value is string => Boolean(value))
              .slice(0, 2);
        const basis = [
          company.stage,
          company.investmentTiming,
          company.sector,
          company.geography,
        ]
          .filter(Boolean)
          .join(' · ');

        return {
          slug: company.id,
          category: 'Companies',
          name: company.name,
          focus: company.sector || company.description || 'Portfolio company',
          logoDomain: domainFromUrl(company.companyUrl),
          roles: roles.length ? roles : ['No structured thesis match yet'],
          openRoles: company.thesisMatch.length,
          reward: String(company.founders.length),
          network: company.stage || '—',
          accent,
          soft,
          href: `/funded/${company.id}`,
          rationale: {
            basis:
              basis || company.description || 'Persisted portfolio evidence',
            reasons: roles.map(() => 'persisted thesis signal'),
          },
        };
      }),
    [funded.data?.companies],
  );

  const thesisSummary =
    thesis.data?.summary?.fund_summary?.thesis_summary ||
    thesis.data?.summary?.stated_thesis?.summary ||
    thesis.data?.summary?.observed_thesis?.summary ||
    'Your thesis summary will appear here once the current thesis is generated.';
  const thesisDimensions = thesis.data?.dimensions || [];
  const allPatterns = funded.data?.patterns;
  const portfolioPatternItems = (allPatterns?.portfolio || [])
    .map((item) => (typeof item === 'string' ? item : item.pattern))
    .filter((item): item is string => Boolean(item));
  const signalCount = new Set([
    ...(allPatterns?.sectors || []),
    ...(allPatterns?.stages || []),
    ...(allPatterns?.geographies || []),
    ...(allPatterns?.founderTraits || []),
    ...portfolioPatternItems,
  ]).size;
  const thesisMatchCount = livePortfolioCompanies.reduce(
    (total, company) => total + company.openRoles,
    0,
  );

  const livePortfolioSummary = [
    {
      label: 'Portfolio companies',
      value: String(funded.data?.totalCount ?? '—'),
      caption: 'From funded-company intelligence',
    },
    {
      label: 'Thesis matches',
      value: String(thesisMatchCount),
      caption: 'Across current investments',
    },
    {
      label: 'Portfolio patterns',
      value: String(signalCount),
      caption: 'Deterministic thesis signals',
    },
    {
      label: 'Thesis dimensions',
      value: String(thesisDimensions.length),
      caption: 'In the current Thesis DNA',
    },
  ];

  const livePortfolioContent = {
    ...portfolioContent,
    title: funded.data?.thesis?.name
      ? `${funded.data.thesis.name}'s portfolio`
      : portfolioContent.title,
    metricLabels: ['Thesis matches', 'Founders', 'Stage'],
    summary: livePortfolioSummary,
  };

  const tabs = portfolio
    ? portfolioTabs.map((tab) => ({
        ...tab,
        count:
          tab.id === 'Companies'
            ? funded.data?.totalCount || 0
            : tab.id === 'Thesis Matches'
              ? thesisMatchCount
              : signalCount,
      }))
    : networkTabs;
  const activeContent = portfolio
    ? livePortfolioContent
    : tabContent[activeTab as keyof typeof tabContent];

  const visibleCompanies = useMemo(() => {
    const value = query.trim().toLowerCase();
    const categoryItems = portfolio
      ? livePortfolioCompanies
      : companies.filter((company) => company.category === activeTab);
    if (!value) return categoryItems;

    return categoryItems.filter((company) =>
      [company.name, company.focus, ...company.roles]
        .join(' ')
        .toLowerCase()
        .includes(value),
    );
  }, [activeTab, livePortfolioCompanies, portfolio, query]);

  return (
    <>
      <Header
        icon={
          <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <RiBuildingLine className='size-6 text-text-sub-600' />
          </div>
        }
        title={portfolio ? 'Portfolio' : 'Network'}
        description={
          portfolio
            ? 'See how your past investments shape what Scouter surfaces next — matched profiles and live signals, grounded in your own portfolio.'
            : 'Explore companies, investors, and accelerator programs in one place.'
        }
      />

      <div className='px-4 pb-10 lg:px-8'>
        <DashedDivider />

        <div className='border-b border-stroke-soft-200 py-5'>
          <div
            role='tablist'
            aria-label={portfolio ? 'Portfolio view' : 'Network type'}
            className='inline-flex w-full gap-1 rounded-2xl bg-bg-weak-50 p-1.5 ring-1 ring-inset ring-stroke-soft-200 sm:w-auto'
          >
            {tabs.map(({ id, label, icon: Icon, ...tab }) => {
              const isActive = activeTab === id;
              const count =
                'count' in tab
                  ? tab.count
                  : companies.filter((company) => company.category === id)
                      .length;

              return (
                <button
                  key={id}
                  type='button'
                  role='tab'
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveTab(id);
                    setQuery('');
                  }}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-label-sm font-medium transition sm:flex-none sm:justify-start sm:px-4 ${
                    isActive
                      ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
                      : 'text-text-soft-400 hover:text-text-sub-600'
                  }`}
                >
                  <Icon
                    className={`size-[18px] shrink-0 ${isActive ? 'text-primary-base' : ''}`}
                  />
                  <span className='truncate'>{label}</span>
                  <span className='rounded-full bg-bg-weak-50 px-1.5 py-0.5 text-label-xs text-text-soft-400'>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className='grid grid-cols-2 border-b border-stroke-soft-200 lg:grid-cols-4'>
          {activeContent.summary.map((item, index) => (
            <div
              key={item.label}
              className={`px-4 py-6 lg:px-6 ${index % 2 === 0 ? 'border-r border-stroke-soft-200' : ''} lg:border-r lg:last:border-r-0`}
            >
              <div className='text-label-sm text-text-sub-600'>
                {item.label}
              </div>
              <div className='mt-2 flex items-end gap-2'>
                <strong className='text-title-h5 text-text-strong-950 font-medium'>
                  {item.value}
                </strong>
                <span className='pb-1 text-label-xs text-text-soft-400'>
                  {item.caption}
                </span>
              </div>
            </div>
          ))}
        </section>

        {portfolio && (
          <section className='border-b border-stroke-soft-200 py-6'>
            <div className='relative overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 lg:p-8'>
              <span className='pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-50 to-transparent' />
              <div className='relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
                <div className='max-w-3xl'>
                  <div className='mb-3 flex items-center gap-2 text-label-xs font-medium text-violet-600'>
                    <RiUserStarLine className='size-4' />
                    Investment Thesis
                  </div>
                  <h2 className='text-title-h5 font-medium text-text-strong-950'>
                    Thesis summary
                  </h2>
                  <p className='mt-3 text-label-sm leading-6 text-text-sub-600'>
                    {thesisSummary}
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => setThesisOpen(true)}
                  className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-text-strong-950 px-4 text-label-sm font-medium text-bg-white-0 transition hover:opacity-90'
                >
                  Detail
                  <RiArrowRightUpLongLine className='size-4' />
                </button>
              </div>
            </div>

            <div className='mt-5'>
              <div className='mb-4'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Portfolio Patterns
                </h2>
                <p className='mt-1 text-label-sm text-text-soft-400'>
                  Patterns derived from the current funded-company evidence and
                  Thesis DNA.
                </p>
              </div>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
                {[
                  {
                    label: 'Sector Concentration',
                    values: allPatterns?.sectors || [],
                    accent: '#2563EB',
                    soft: '#EFF6FF',
                  },
                  {
                    label: 'Founder Pattern',
                    values: allPatterns?.founderTraits || [],
                    accent: '#059669',
                    soft: '#ECFDF5',
                  },
                  {
                    label: 'Geography',
                    values: allPatterns?.geographies || [],
                    accent: '#E11D48',
                    soft: '#FFF1F2',
                  },
                  {
                    label: 'Stage',
                    values: allPatterns?.stages || [],
                    accent: '#7C3AED',
                    soft: '#F5F3FF',
                  },
                ].map((group) => (
                  <article
                    key={group.label}
                    className='relative min-h-48 overflow-hidden rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
                  >
                    <span
                      className='pointer-events-none absolute inset-x-0 top-0 h-20 opacity-80'
                      style={{
                        background: `linear-gradient(180deg, ${group.soft} 0%, rgba(255,255,255,0) 100%)`,
                      }}
                    />
                    <h3 className='relative text-label-md font-medium text-text-strong-950'>
                      {group.label}
                    </h3>
                    <div className='relative mt-4 space-y-2.5'>
                      {group.values.length ? (
                        group.values.map((value) => (
                          <div
                            key={value}
                            className='flex items-center gap-2 text-label-sm text-text-sub-600'
                          >
                            <span
                              className='size-1.5 shrink-0 rounded-full'
                              style={{ backgroundColor: group.accent }}
                            />
                            <span>{value}</span>
                          </div>
                        ))
                      ) : (
                        <p className='text-label-sm text-text-soft-400'>
                          No confirmed pattern yet.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {portfolioPatternItems.length > 0 && (
                <div className='mt-4 flex flex-wrap gap-2'>
                  {portfolioPatternItems.map((pattern) => (
                    <span
                      key={pattern}
                      className='rounded-full bg-bg-weak-50 px-3 py-1.5 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200'
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <div className='flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h2 className='text-label-lg text-text-strong-950'>
              {activeContent.title}
            </h2>
            <p className='mt-1 text-label-sm text-text-soft-400'>
              {activeContent.description}
            </p>
          </div>
          <label className='flex h-10 w-full items-center gap-2 rounded-10 bg-bg-white-0 px-3 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 lg:w-72'>
            <RiSearchLine className='size-5 text-text-soft-400' />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className='min-w-0 flex-1 bg-transparent text-label-sm text-text-strong-950 outline-none placeholder:text-text-soft-400'
              placeholder={activeContent.search}
            />
          </label>
        </div>

        <section className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3'>
          {visibleCompanies.map((company) => (
            <Link
              key={company.slug}
              href={
                'href' in company ? company.href : `/products/${company.slug}`
              }
              className='group relative flex min-h-[310px] flex-col overflow-hidden rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-regular-md'
            >
              <span
                className='pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80'
                style={{
                  background: `linear-gradient(180deg, ${company.soft} 0%, rgba(255,255,255,0) 100%)`,
                }}
              />
              <div className='flex items-start justify-between'>
                <div className='flex items-center gap-3'>
                  <span
                    className='relative flex size-12 items-center justify-center rounded-14 text-label-lg ring-1 ring-inset'
                    style={{
                      backgroundColor: company.soft,
                      color: company.accent,
                      boxShadow: `inset 0 0 0 1px ${company.accent}24`,
                    }}
                  >
                    <img
                      src={networkLogoUrl(
                        'logoDomain' in company
                          ? company.logoDomain || company.name
                          : networkProfiles[company.slug].logoDomain,
                      )}
                      alt={`${company.name} logo`}
                      className='size-7 rounded-md object-contain'
                    />
                  </span>
                  <div className='relative'>
                    <h3 className='text-label-lg text-text-strong-950'>
                      {company.name}
                    </h3>
                    <p className='mt-1 text-label-sm text-text-soft-400'>
                      {company.focus}
                    </p>
                  </div>
                </div>
                <RiArrowRightUpLongLine
                  className='relative size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                  style={{ color: company.accent }}
                />
              </div>

              <div className='relative mt-6 flex-1 border-y border-stroke-soft-200 py-4'>
                {portfolio && (
                  <div className='mb-4 rounded-xl bg-bg-weak-50 p-3'>
                    <div className='text-label-xs font-medium text-orange-600'>
                      Based on this investment
                    </div>
                    <p className='mt-1 text-label-xs leading-5 text-text-sub-600'>
                      {'rationale' in company
                        ? company.rationale.basis
                        : portfolioRationale[company.slug].basis}
                    </p>
                  </div>
                )}
                <div
                  className='mb-3 flex items-center gap-2 text-label-xs'
                  style={{ color: company.accent }}
                >
                  <RiBriefcase4Line className='size-4' />
                  {portfolio
                    ? 'Why these matches'
                    : activeContent.featuredLabel}
                </div>
                {portfolio && (
                  <div className='mb-2 text-label-xs font-medium text-text-soft-400'>
                    {activeContent.featuredLabel}
                  </div>
                )}
                <div className='divide-y divide-stroke-soft-200'>
                  {company.roles.map((role, roleIndex) => (
                    <div
                      key={role}
                      className={`flex min-h-10 justify-center gap-1 py-2 text-label-sm text-text-sub-600 ${portfolio ? 'flex-col' : 'items-center justify-between'}`}
                    >
                      <span>
                        {portfolio ? '· ' : ''}
                        {role}
                      </span>
                      {portfolio && (
                        <span className='pl-3 text-label-xs text-text-soft-400'>
                          → Matches:{' '}
                          {'rationale' in company
                            ? company.rationale.reasons[roleIndex] ||
                              'persisted thesis signal'
                            : portfolioRationale[company.slug].reasons[
                                roleIndex
                              ]}
                        </span>
                      )}
                      {!portfolio && (
                        <span
                          className='size-1.5 shrink-0 rounded-full'
                          style={{ backgroundColor: company.accent }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className='mt-5 grid grid-cols-3 divide-x divide-stroke-soft-200'>
                <div className='pr-3'>
                  <RiBriefcase4Line
                    className='mb-2 size-4'
                    style={{ color: company.accent }}
                  />
                  <strong className='block text-label-md text-text-strong-950'>
                    {company.openRoles}
                  </strong>
                  <span className='text-label-xs text-text-soft-400'>
                    {activeContent.metricLabels[0]}
                  </span>
                </div>
                <div className='px-3'>
                  <RiMoneyDollarCircleLine
                    className='mb-2 size-4'
                    style={{ color: company.accent }}
                  />
                  <strong
                    className='block text-label-md'
                    style={{ color: company.accent }}
                  >
                    {company.reward}
                  </strong>
                  <span className='text-label-xs text-text-soft-400'>
                    {activeContent.metricLabels[1]}
                  </span>
                </div>
                <div className='pl-3'>
                  <RiTeamLine
                    className='mb-2 size-4'
                    style={{ color: company.accent }}
                  />
                  <strong className='block text-label-md text-text-strong-950'>
                    {company.network}
                  </strong>
                  <span className='text-label-xs text-text-soft-400'>
                    {activeContent.metricLabels[2]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {visibleCompanies.length === 0 && (
          <div className='py-20 text-center text-label-sm text-text-soft-400'>
            {portfolio
              ? query
                ? 'No portfolio companies or roles match your search.'
                : funded.loading
                  ? 'Loading portfolio intelligence…'
                  : funded.error ||
                    'No portfolio companies yet. Add your first investment — Scouter will use it to start matching profiles and surfacing signals.'
              : 'No companies or positions match your search.'}
          </div>
        )}
      </div>

      {portfolio && (
        <Modal.Root open={thesisOpen} onOpenChange={setThesisOpen}>
          <Modal.Content className='max-h-[92vh] max-w-[1120px] overflow-hidden'>
            <Modal.Header
              icon={RiUserStarLine}
              title='Thesis DNA'
              description='The current structured thesis behind portfolio patterns and matching.'
            />
            <Modal.Body className='max-h-[calc(92vh-73px)] overflow-y-auto bg-bg-weak-50/50 p-5 lg:p-6'>
              <div className='mb-5 rounded-2xl bg-bg-white-0 p-5 ring-1 ring-inset ring-stroke-soft-200'>
                <div className='text-label-xs font-medium text-violet-600'>
                  Thesis summary
                </div>
                <p className='mt-2 text-label-sm leading-6 text-text-sub-600'>
                  {thesisSummary}
                </p>
              </div>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {thesisGroups.map(
                  ({ key, label, icon: Icon, accent, soft }) => {
                    const dimensions = thesisDimensions
                      .filter((dimension) => dimension.dimension_type === key)
                      .sort((left, right) => right.weight - left.weight);

                    return (
                      <section
                        key={key}
                        className='relative min-h-64 overflow-hidden rounded-3xl bg-bg-white-0 p-5 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'
                      >
                        <span
                          className='pointer-events-none absolute inset-x-0 top-0 h-20 opacity-80'
                          style={{
                            background: `linear-gradient(180deg, ${soft} 0%, rgba(255,255,255,0) 100%)`,
                          }}
                        />
                        <div className='relative flex items-center gap-2.5 border-b border-stroke-soft-200 pb-4'>
                          <span
                            className='flex size-9 items-center justify-center rounded-xl'
                            style={{ backgroundColor: soft, color: accent }}
                          >
                            <Icon className='size-[18px]' />
                          </span>
                          <h3 className='text-label-md font-medium text-text-strong-950'>
                            {label}
                          </h3>
                        </div>
                        <div className='relative mt-4 space-y-4'>
                          {dimensions.length ? (
                            dimensions.map((dimension) => {
                              const percent = dimensionPercent(
                                dimension.weight,
                              );
                              return (
                                <div key={dimension.id}>
                                  <div className='mb-2 flex items-center justify-between gap-3 text-label-sm'>
                                    <span className='truncate text-text-sub-600'>
                                      {dimension.value}
                                    </span>
                                    <span className='shrink-0 font-medium text-text-strong-950'>
                                      {percent}%
                                    </span>
                                  </div>
                                  <div className='h-1.5 overflow-hidden rounded-full bg-bg-weak-50'>
                                    <div
                                      className='h-full rounded-full'
                                      style={{
                                        width: `${percent}%`,
                                        backgroundColor: accent,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className='text-label-sm text-text-soft-400'>
                              No confirmed dimensions.
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            </Modal.Body>
          </Modal.Content>
        </Modal.Root>
      )}
    </>
  );
}

export default function ProductsPage() {
  return <PageProducts />;
}
