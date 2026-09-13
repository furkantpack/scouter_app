'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/sidebar-context';
import {
  RiArrowRightUpLongLine,
  RiArrowUpLine,
  RiBankCardLine,
  RiBrainLine,
  RiBriefcase4Line,
  RiBuilding2Line,
  RiCloseLine,
  RiFlaskLine,
  RiFlowChart,
  RiFocus3Line,
  RiGhostLine,
  RiGlobalLine,
  RiGraduationCapLine,
  RiHeartPulseLine,
  RiLeafLine,
  RiMapPin2Line,
  RiMenu3Line,
  RiRocket2Line,
  RiShieldLine,
  RiSparkling2Line,
  RiTeamLine,
  RiUserLine,
  RiUserStarLine,
} from '@remixicon/react';

import {
  createFounderSearchClient,
  isFullFounderSearchMode,
  shouldSubmitFounderSearchKey,
} from '@/lib/founder-search/client';
import {
  FOUNDER_SEARCH_PRESETS,
  type FounderSearchPresetId,
} from '@/lib/founder-search/presets';
import type { FounderSearchResponse } from '@/lib/founder-search/types';
import { requestJson } from '@/lib/request-json';
import * as Button from '@/components/ui/button';
import { FounderFreeTextResults } from '@/components/founder-free-text-results';
import NotificationButton from '@/components/notification-button';
import { SearchMenuButton } from '@/components/search';

interface Project {
  id: string;
  title: string;
  description: string;
}

interface ProjectSection {
  title: string;
  subtitle: string;
  projects: Project[];
}

interface ProjectsPageData {
  header: {
    icon: string;
    title: string;
    description: string;
    createButtonText: string;
  };
  search: {
    placeholder: string;
  };
  sections: ProjectSection[];
}

const fakeProjectsData: ProjectsPageData = {
  header: {
    icon: 'RiFolder2Fill',
    title: 'Projects',
    description:
      'Easily manage and explore all your active projects in one place',
    createButtonText: 'Create project',
  },
  search: {
    placeholder: 'Search projects...',
  },
  sections: [
    {
      title: 'Big Tech Alumni',
      subtitle: 'Where they came from',
      projects: [
        {
          id: 'faang-big-tech',
          title: 'FAANG & Big Tech',
          description: 'Meta, Google, Apple, Amazon, Netflix, Microsoft',
        },
        {
          id: 'fintech-alumni',
          title: 'Fintech Alumni',
          description: 'Stripe, Revolut, Wise, Brex, Nubank',
        },
        {
          id: 'ai-alumni',
          title: 'AI Alumni',
          description: 'OpenAI, Anthropic, DeepMind, Mistral, Cohere',
        },
        {
          id: 'saas-alumni',
          title: 'SaaS Alumni',
          description: 'Notion, Linear, Figma, HubSpot, Salesforce',
        },
        {
          id: 'top-consulting',
          title: 'Top Consulting',
          description: 'McKinsey, Bain, BCG, Goldman Sachs',
        },
        {
          id: 'regional-alumni',
          title: 'Regional Alumni',
          description: 'Trendyol, Peak, Getir — TR/MENA',
        },
      ],
    },
    {
      title: 'Top University',
      subtitle: 'Education × domain alignment',
      projects: [
        {
          id: 'global-tier-1',
          title: 'Global Tier 1',
          description: 'MIT, Stanford, Harvard, Oxford, Cambridge',
        },
        {
          id: 'technical-tier-1',
          title: 'Technical Tier 1',
          description: 'ETH Zurich, Imperial, Caltech, CMU',
        },
        {
          id: 'regional-tier-1',
          title: 'Regional Tier 1',
          description: 'METU, Bogazici, Bilkent, AUB, KAUST',
        },
        {
          id: 'stem-focus',
          title: 'STEM Focus',
          description: 'CS, Engineering, Physics, Mathematics',
        },
        {
          id: 'top-mba',
          title: 'Top MBA',
          description: 'HBS, Wharton, INSEAD',
        },
      ],
    },
    {
      title: 'Founder History',
      subtitle: 'Past performance is the strongest signal',
      projects: [
        {
          id: 'serial-founder',
          title: 'Serial Founder',
          description: '2+ companies built',
        },
        {
          id: 'prior-exit',
          title: 'Prior Exit',
          description: '$10M+ / $50M+ / $100M+',
        },
        {
          id: 'failed-founder',
          title: 'Failed Founder',
          description: 'Built and learned',
        },
        {
          id: 'accelerator-alumni',
          title: 'Accelerator Alumni',
          description: 'YC, Techstars, 500 Startups',
        },
        {
          id: 'active-angel-investor',
          title: 'Active Angel Investor',
          description: 'Actively investing in startups',
        },
        {
          id: 'startup-advisor',
          title: 'Startup Advisor',
          description: 'Advising early-stage companies',
        },
      ],
    },
    {
      title: 'Sectors',
      subtitle: 'Thesis alignment',
      projects: [
        {
          id: 'ai-ml-infrastructure',
          title: 'AI / ML Infrastructure',
          description: 'Models, tooling and compute',
        },
        {
          id: 'fintech-payments',
          title: 'Fintech / Payments',
          description: 'Financial infrastructure and payments',
        },
        {
          id: 'b2b-saas',
          title: 'B2B SaaS / Workflow Automation',
          description: 'Enterprise software and automation',
        },
        {
          id: 'deep-tech',
          title: 'Deep Tech / Hard Tech',
          description: 'Science-led technology companies',
        },
        {
          id: 'climate-greentech',
          title: 'Climate / GreenTech',
          description: 'Climate and sustainability solutions',
        },
        {
          id: 'healthtech-biotech',
          title: 'HealthTech / BioTech',
          description: 'Healthcare and life sciences',
        },
        {
          id: 'defense-govtech',
          title: 'Defense / Gov Tech',
          description: 'Defense and government technology',
        },
        {
          id: 'consumer-creator',
          title: 'Consumer / Creator Economy',
          description: 'Consumer products and creator tools',
        },
        {
          id: 'hr-future-work',
          title: 'HR Tech / Future of Work',
          description: 'Talent and workplace technology',
        },
      ],
    },
    {
      title: 'Geography',
      subtitle: 'Where they are',
      projects: [
        {
          id: 'turkey',
          title: 'Turkey',
          description: 'Turkey-based founders and investors',
        },
        {
          id: 'mena',
          title: 'MENA',
          description: 'Dubai, Riyadh, Cairo, Tel Aviv',
        },
        {
          id: 'nordics',
          title: 'Nordics',
          description: 'Helsinki, Stockholm, Oslo',
        },
        { id: 'dach', title: 'DACH', description: 'Berlin, Vienna, Zurich' },
        { id: 'iberia', title: 'Iberia', description: 'Madrid, Lisbon' },
        { id: 'london', title: 'London', description: 'London ecosystem' },
        {
          id: 'new-york-san-francisco',
          title: 'New York / San Francisco',
          description: 'Leading US startup hubs',
        },
      ],
    },
  ],
};

const sectionIcons = {
  'Big Tech Alumni': RiBuilding2Line,
  'Top University': RiGraduationCapLine,
  'Founder History': RiRocket2Line,
  Sectors: RiFocus3Line,
  Geography: RiMapPin2Line,
};

const categoryThemes = {
  'Big Tech Alumni': { accent: '#059669', soft: '#ECFDF5' },
  'Top University': { accent: '#F97316', soft: '#FFF7ED' },
  'Founder History': { accent: '#F97316', soft: '#FFF7ED' },
  Sectors: { accent: '#2563EB', soft: '#EFF6FF' },
  Geography: { accent: '#DB2777', soft: '#FDF2F8' },
};

const geographyMarks: Record<string, string> = {
  turkey: '🇹🇷',
  mena: '🌍',
  nordics: '❄',
  dach: '⛰',
  iberia: '☀',
  london: '🇬🇧',
  'new-york-san-francisco': '🇺🇸',
};

const researchModes = [
  {
    id: 'full-search',
    label: 'Full Search',
    description: 'Search every signal',
    icon: RiGlobalLine,
  },
  {
    id: 'stealth-mode',
    label: 'Stealth Mode',
    description: 'Surface hidden profiles',
    icon: RiGhostLine,
  },
  {
    id: 'network',
    label: 'Network Mode',
    description: 'Explore warm connections',
    icon: RiTeamLine,
  },
];

const preparedFounderPromptIcons = {
  'ex-ai-infrastructure': RiBrainLine,
  'repeat-founder-new-company': RiRocket2Line,
  'technical-b2b-saas': RiGraduationCapLine,
} satisfies Record<FounderSearchPresetId, typeof RiBrainLine>;

const featuredCards = {
  'faang-big-tech': {
    icon: RiBuilding2Line,
    subtitle: 'Big tech alumni cluster',
    groups: ['Meta · Google · Apple', 'Amazon · Netflix · Microsoft'],
    logoDomains: [
      ['meta.com', 'google.com', 'apple.com'],
      ['amazon.com', 'netflix.com', 'microsoft.com'],
    ],
    count: '6',
    reach: 'Global',
    signal: 'Tier 1',
    accent: '#059669',
    soft: '#ECFDF5',
  },
  'fintech-alumni': {
    icon: RiBuilding2Line,
    subtitle: 'Fintech operator cluster',
    groups: ['Stripe · Revolut · Wise', 'Brex · Nubank · Adyen'],
    logoDomains: [
      ['stripe.com', 'revolut.com', 'wise.com'],
      ['brex.com', 'nubank.com.br', 'adyen.com'],
    ],
    count: '6',
    reach: 'Global',
    signal: 'Fintech',
    accent: '#635BFF',
    soft: '#F0EFFF',
  },
  'ai-alumni': {
    icon: RiBuilding2Line,
    subtitle: 'Frontier AI alumni cluster',
    groups: ['OpenAI · Anthropic · DeepMind', 'Mistral · Cohere · xAI'],
    logoDomains: [
      ['openai.com', 'anthropic.com', 'deepmind.google'],
      ['mistral.ai', 'cohere.com', 'x.ai'],
    ],
    count: '6',
    reach: 'Frontier',
    signal: 'AI',
    accent: '#F97316',
    soft: '#FFF2E8',
  },
  'saas-alumni': {
    icon: RiBuilding2Line,
    subtitle: 'SaaS operator cluster',
    groups: ['Notion · Linear · Figma', 'HubSpot · Salesforce'],
    logoDomains: [
      ['notion.so', 'linear.app', 'figma.com'],
      ['hubspot.com', 'salesforce.com'],
    ],
    count: '5',
    reach: 'Global',
    signal: 'SaaS',
    accent: '#0EA5A8',
    soft: '#EAFBFA',
  },
  'top-consulting': {
    icon: RiBuilding2Line,
    subtitle: 'Strategy and finance alumni',
    groups: ['McKinsey · Bain · BCG', 'Goldman Sachs'],
    logoDomains: [
      ['mckinsey.com', 'bain.com', 'bcg.com'],
      ['goldmansachs.com'],
    ],
    count: '4',
    reach: 'Global',
    signal: 'Elite',
    accent: '#335CFF',
    soft: '#EEF3FF',
  },
  'regional-alumni': {
    icon: RiBuilding2Line,
    subtitle: 'TR and MENA operator cluster',
    groups: ['Trendyol · Peak · Getir', 'Turkey · MENA ecosystem'],
    logoDomains: [['trendyol.com', 'peak.com', 'getir.com'], []],
    count: '3',
    reach: 'TR/MENA',
    signal: 'Regional',
    accent: '#E11D48',
    soft: '#FFF1F2',
  },
  'global-tier-1': {
    icon: RiGraduationCapLine,
    subtitle: 'Global academic signal',
    groups: ['MIT · Stanford · Harvard', 'Oxford · Cambridge'],
    logoDomains: [
      ['mit.edu', 'stanford.edu', 'harvard.edu'],
      ['ox.ac.uk', 'cam.ac.uk'],
    ],
    count: '5',
    reach: 'Global',
    signal: 'Tier 1',
    accent: '#7C3AED',
    soft: '#F5F3FF',
  },
  'technical-tier-1': {
    icon: RiGraduationCapLine,
    subtitle: 'Technical academic signal',
    groups: ['ETH Zurich · Imperial', 'Caltech · CMU'],
    logoDomains: [
      ['ethz.ch', 'imperial.ac.uk'],
      ['caltech.edu', 'cmu.edu'],
    ],
    count: '4',
    reach: 'Global',
    signal: 'Technical',
    accent: '#2563EB',
    soft: '#EFF6FF',
  },
  'regional-tier-1': {
    icon: RiGraduationCapLine,
    subtitle: 'Regional academic signal',
    groups: ['METU · Bogazici · Bilkent', 'AUB · KAUST'],
    logoDomains: [
      ['metu.edu.tr', 'boun.edu.tr', 'bilkent.edu.tr'],
      ['aub.edu.lb', 'kaust.edu.sa'],
    ],
    count: '5',
    reach: 'TR/MENA',
    signal: 'Tier 1',
    accent: '#DB2777',
    soft: '#FDF2F8',
  },
  'stem-focus': {
    icon: RiGraduationCapLine,
    subtitle: 'Core technical disciplines',
    groups: ['Computer Science · Engineering', 'Physics · Mathematics'],
    count: '4',
    reach: 'STEM',
    signal: 'Domain',
    accent: '#0891B2',
    soft: '#ECFEFF',
  },
  'top-mba': {
    icon: RiGraduationCapLine,
    subtitle: 'Top business school signal',
    groups: ['Harvard Business School', 'Wharton · INSEAD'],
    logoDomains: [['hbs.edu'], ['wharton.upenn.edu', 'insead.edu']],
    count: '3',
    reach: 'Global',
    signal: 'MBA',
    accent: '#D97706',
    soft: '#FFFBEB',
  },
  'serial-founder': {
    icon: RiRocket2Line,
    subtitle: 'Repeat builder signal',
    groups: ['2+ companies built', 'Zero-to-one operating experience'],
    count: '2+',
    reach: 'Repeat',
    signal: 'Strong',
    entityLabel: 'Founder evidence',
    countLabel: 'Companies',
    accent: '#F97316',
    soft: '#FFF7ED',
  },
  'ai-ml-infrastructure': {
    icon: RiBrainLine,
    subtitle: 'Intelligence infrastructure thesis',
    groups: ['Models · inference · agents', 'Data tooling · compute · MLOps'],
    count: '6',
    reach: 'Global',
    signal: 'AI/ML',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#7C3AED',
    soft: '#F5F3FF',
  },
  'fintech-payments': {
    icon: RiBankCardLine,
    subtitle: 'Financial infrastructure thesis',
    groups: [
      'Payments · banking infrastructure',
      'Open finance · treasury · risk',
    ],
    count: '6',
    reach: 'Global',
    signal: 'Fintech',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#2563EB',
    soft: '#EFF6FF',
  },
  'b2b-saas': {
    icon: RiFlowChart,
    subtitle: 'Enterprise workflow thesis',
    groups: [
      'Workflow automation · copilots',
      'Vertical SaaS · enterprise tools',
    ],
    count: '6',
    reach: 'B2B',
    signal: 'SaaS',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#0D9488',
    soft: '#F0FDFA',
  },
  'deep-tech': {
    icon: RiFlaskLine,
    subtitle: 'Science-led technology thesis',
    groups: ['Robotics · semiconductors', 'Advanced materials · hardware'],
    count: '4',
    reach: 'Global',
    signal: 'Deep Tech',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#4F46E5',
    soft: '#EEF2FF',
  },
  'climate-greentech': {
    icon: RiLeafLine,
    subtitle: 'Climate transition thesis',
    groups: ['Energy · carbon · climate data', 'Mobility · circular economy'],
    count: '6',
    reach: 'Global',
    signal: 'Climate',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#16A34A',
    soft: '#F0FDF4',
  },
  'healthtech-biotech': {
    icon: RiHeartPulseLine,
    subtitle: 'Health and life sciences thesis',
    groups: ['Digital health · diagnostics', 'BioTech · drug discovery'],
    count: '4',
    reach: 'Global',
    signal: 'Health',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#E11D48',
    soft: '#FFF1F2',
  },
  'defense-govtech': {
    icon: RiShieldLine,
    subtitle: 'Resilience and public systems thesis',
    groups: ['Autonomy · cyber · defense', 'Government digital infrastructure'],
    count: '4',
    reach: 'Gov',
    signal: 'Defense',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#475569',
    soft: '#F8FAFC',
  },
  'consumer-creator': {
    icon: RiUserStarLine,
    subtitle: 'Consumer behavior thesis',
    groups: ['Social · creator tools', 'Marketplaces · media · commerce'],
    count: '6',
    reach: 'Consumer',
    signal: 'Creator',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#DB2777',
    soft: '#FDF2F8',
  },
  'hr-future-work': {
    icon: RiTeamLine,
    subtitle: 'Workforce transformation thesis',
    groups: [
      'Recruiting · talent intelligence',
      'Learning · productivity · culture',
    ],
    count: '6',
    reach: 'Work',
    signal: 'HR Tech',
    entityLabel: 'Core themes',
    countLabel: 'Themes',
    accent: '#EA580C',
    soft: '#FFF7ED',
  },
};

export default function ProjectsPage() {
  const router = useRouter();
  const { onMenuClick } = useSidebar();
  const [searchValue, setSearchValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [submittedPresetId, setSubmittedPresetId] =
    useState<FounderSearchPresetId>();
  const [searchResult, setSearchResult] =
    useState<FounderSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeMode, setActiveMode] = useState('full-search');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<
    'Founder History' | 'Geography' | null
  >(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const founderSearchClient = useRef(
    createFounderSearchClient((url, init) =>
      requestJson<FounderSearchResponse>(url, init),
    ),
  );

  useEffect(() => {
    const category = new URLSearchParams(window.location.search).get(
      'category',
    );

    if (category === 'Founder History' || category === 'Geography') {
      setActiveCategoryFilter(category);
    }
  }, []);

  const handleClearSearch = () => {
    setSearchValue('');
    setSubmittedQuery('');
    setSubmittedPresetId(undefined);
    setSearchResult(null);
    setSearchError('');
  };

  const runFounderSearch = async (
    query: string,
    page = 1,
    presetId?: FounderSearchPresetId,
  ) => {
    const pending = founderSearchClient.current.search(query, page, presetId);
    if (!pending) return;
    setSearchLoading(true);
    setSearchError('');
    setSubmittedQuery(query.trim());
    setSubmittedPresetId(presetId);
    try {
      const response = await pending;
      setSearchResult(response);
    } catch {
      setSearchError(
        'Founder search could not be completed. Please try again.',
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRunSearch = () => {
    if (activeMode === 'network') {
      router.push('/network');
      return;
    }
    if (isFullFounderSearchMode(activeMode)) {
      void runFounderSearch(searchValue);
    }
  };

  const filteredSections = fakeProjectsData.sections;

  const visibleSections = activeCategoryFilter
    ? filteredSections.filter(
        (section) => section.title === activeCategoryFilter,
      )
    : filteredSections.filter(
        (section) =>
          section.title !== 'Founder History' && section.title !== 'Geography',
      );

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((current) =>
      current.includes(sectionTitle)
        ? current.filter((title) => title !== sectionTitle)
        : [...current, sectionTitle],
    );
  };

  return (
    <div className='flex min-h-screen flex-col px-4 py-px lg:min-h-0 lg:flex-1 lg:px-0 lg:py-1.5 lg:pr-1.5'>
      <div className='border-stroke-soft-200 flex items-center border-b px-5 py-4 pl-4 lg:hidden'>
        <Button.Root
          variant='neutral'
          mode='ghost'
          onClick={onMenuClick}
          className='size-8 cursor-pointer rounded-lg p-0'
        >
          <Button.Icon as={RiMenu3Line} className='text-text-soft-400 size-5' />
        </Button.Root>
      </div>
      <div
        className='flex min-h-[calc(100vh-2px)] flex-col overflow-auto rounded-[24px] border border-stroke-soft-200 bg-bg-white-0 px-5 py-7 lg:min-h-[calc(100vh-12px)] lg:px-[72px] lg:py-10'
        style={{ scrollbarWidth: 'none' }}
      >
        <header className='mx-auto mb-8 flex w-full items-center justify-between border-b border-stroke-soft-200 pb-5 lg:max-w-[1120px]'>
          <div className='min-w-0'>
            <p className='text-label-xs text-text-soft-400'>
              Scouter Workspace
            </p>
            <h1 className='mt-0.5 truncate text-label-md text-text-strong-950'>
              Founder Intelligence
            </h1>
          </div>

          <div className='flex items-center gap-2'>
            <div className='hidden h-9 items-center gap-2 rounded-lg bg-bg-weak-50 px-3 ring-1 ring-inset ring-stroke-soft-200 sm:flex'>
              <RiSparkling2Line className='size-4 text-orange-500' />
              <span className='text-label-xs text-text-sub-600'>Credits</span>
              <strong className='text-label-sm text-text-strong-950'>
                2,480
              </strong>
            </div>
            <SearchMenuButton
              aria-label='Search'
              className='size-9 ring-1 ring-inset ring-stroke-soft-200'
            />
            <NotificationButton
              aria-label='Notifications'
              className='size-9 ring-1 ring-inset ring-stroke-soft-200'
            />
            <div className='grid size-9 place-items-center rounded-full bg-primary-alpha-10 text-primary-base ring-1 ring-inset ring-primary-alpha-16'>
              <RiUserLine className='size-[18px]' />
            </div>
          </div>
        </header>

        <div className='mx-auto w-full lg:max-w-[1120px]'>
          <div className='mb-8'>
            <div>
              <div className='flex items-start justify-between gap-6 pb-4'>
                <div>
                  <h2 className='text-lg font-semibold tracking-[-0.02em] text-text-strong-950'>
                    Find your next investor signal
                  </h2>
                  <p className='mt-1 text-sm text-text-soft-400'>
                    Describe a profile and explore matching alumni, sectors,
                    founder history, and geography.
                  </p>
                </div>
                {searchValue && (
                  <button
                    type='button'
                    onClick={handleClearSearch}
                    aria-label='Clear prompt'
                    className='grid size-8 shrink-0 place-items-center rounded-full text-text-sub-600 transition hover:bg-bg-weak-50 hover:text-text-strong-950'
                  >
                    <RiCloseLine className='size-5' />
                  </button>
                )}
              </div>

              <div>
                <div className='relative z-10 rounded-[24px] border border-stroke-sub-300 bg-bg-white-0 px-5 pb-4 pt-5 shadow-regular-sm transition duration-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 sm:px-6'>
                  <textarea
                    aria-label='Describe a founder search'
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        isFullFounderSearchMode(activeMode) &&
                        shouldSubmitFounderSearchKey(event.key, event.shiftKey)
                      ) {
                        event.preventDefault();
                        handleRunSearch();
                      }
                    }}
                    placeholder='Describe any founder profile, background, signal, sector, or geography...'
                    rows={5}
                    className='min-h-[156px] w-full resize-none bg-transparent text-lg leading-7 text-text-strong-950 outline-none placeholder:text-text-soft-400'
                  />
                </div>

                <div className='relative mx-3 -mt-4 flex flex-col gap-2 overflow-hidden rounded-b-[24px] bg-bg-weak-50 px-2.5 pb-2.5 pt-7 ring-1 ring-inset ring-stroke-soft-200 sm:mx-5'>
                  <div className='flex items-center gap-2'>
                    <div
                      role='tablist'
                      aria-label='Research mode'
                      className='grid min-w-0 flex-1 grid-cols-3 items-center gap-1 overflow-x-auto rounded-[18px] bg-bg-weak-50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                    >
                      {researchModes.map(({ id, label, icon: Icon }) => {
                        const isActive = activeMode === id;

                        return (
                          <button
                            key={id}
                            type='button'
                            role='tab'
                            aria-selected={isActive}
                            onClick={() => {
                              setActiveMode(id);
                              if (id === 'network') router.push('/network');
                            }}
                            className={`flex h-12 min-w-max items-center justify-center gap-2 rounded-[14px] px-3 text-label-sm font-medium transition-all duration-200 ${
                              isActive
                                ? 'bg-bg-white-0 text-text-strong-950 shadow-regular-sm ring-1 ring-inset ring-stroke-soft-200'
                                : 'text-text-soft-400 hover:bg-bg-white-0/60 hover:text-text-sub-600'
                            }`}
                          >
                            <Icon
                              className={`size-[18px] ${isActive ? 'text-primary-base' : 'text-text-soft-400'}`}
                            />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type='button'
                      aria-label='Run founder search'
                      onClick={handleRunSearch}
                      disabled={!searchValue.trim() || searchLoading}
                      className='grid size-12 shrink-0 place-items-center rounded-[14px] bg-bg-surface-800 text-white shadow-fancy-buttons-neutral transition hover:-translate-y-0.5 hover:bg-stroke-strong-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0'
                    >
                      <RiArrowUpLine className='size-5' />
                    </button>
                  </div>

                  <div
                    aria-label='Ready founder search prompts'
                    className='flex flex-col gap-1 px-1'
                  >
                    <p className='px-2.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-text-soft-400'>
                      Try an example
                    </p>
                    {FOUNDER_SEARCH_PRESETS.map((preset) => {
                      const PromptIcon = preparedFounderPromptIcons[preset.id];

                      return (
                        <button
                          key={preset.id}
                          type='button'
                          aria-label={`Try example: ${preset.label}`}
                          onClick={() => {
                            setActiveMode('full-search');
                            setSearchValue(preset.query);
                            void runFounderSearch(preset.query, 1, preset.id);
                          }}
                          className='flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-4 text-text-sub-600 transition hover:bg-bg-white-0 hover:text-text-strong-950'
                        >
                          <PromptIcon className='mt-px size-4 shrink-0 text-text-soft-400' />
                          <span>{preset.query}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {searchResult || searchLoading || searchError ? (
            <FounderFreeTextResults
              response={searchResult}
              loading={searchLoading}
              error={searchError}
              onRetry={() =>
                void runFounderSearch(
                  submittedQuery || searchValue.trim(),
                  1,
                  submittedPresetId,
                )
              }
              onPageChange={(page) =>
                void runFounderSearch(submittedQuery, page, submittedPresetId)
              }
            />
          ) : (
            <>
              <div className='mb-6 flex flex-wrap items-center justify-end gap-2'>
                {(['Founder History', 'Geography'] as const).map((category) => (
                  <button
                    key={category}
                    type='button'
                    onClick={() =>
                      setActiveCategoryFilter((current) =>
                        current === category ? null : category,
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-label-xs ring-1 ring-inset transition ${
                      activeCategoryFilter === category
                        ? 'bg-bg-strong-950 text-text-white-0 ring-bg-strong-950'
                        : 'bg-bg-white-0 text-text-sub-600 ring-stroke-soft-200 hover:bg-bg-weak-50'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className='space-y-10'>
                {visibleSections.map((section) => {
                  const SectionIcon =
                    sectionIcons[section.title as keyof typeof sectionIcons] ??
                    RiBriefcase4Line;
                  const theme =
                    categoryThemes[
                      section.title as keyof typeof categoryThemes
                    ] ?? categoryThemes.Sectors;
                  const expanded = expandedSections.includes(section.title);
                  const projects = expanded
                    ? section.projects
                    : section.projects.slice(0, 3);
                  const sectionId = section.title
                    .toLowerCase()
                    .replaceAll(' ', '-');

                  return (
                    <section key={section.title} id={sectionId}>
                      <div className='mb-4 flex items-end justify-between gap-4'>
                        <div className='flex items-center gap-3'>
                          <span
                            className='grid size-10 place-items-center rounded-xl'
                            style={{
                              backgroundColor: theme.soft,
                              color: theme.accent,
                            }}
                          >
                            <SectionIcon className='size-5' />
                          </span>
                          <div>
                            <h2 className='text-label-lg text-text-strong-950'>
                              {section.title}
                            </h2>
                            <p className='text-paragraph-sm text-text-soft-400'>
                              {section.subtitle}
                            </p>
                          </div>
                        </div>
                        {section.projects.length > 3 && (
                          <button
                            type='button'
                            onClick={() => toggleSection(section.title)}
                            className='text-label-sm text-text-sub-600 hover:text-text-strong-950'
                          >
                            {expanded ? 'Show less' : 'View all'}
                          </button>
                        )}
                      </div>

                      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                        {projects.map((project) => {
                          const card =
                            featuredCards[
                              project.id as keyof typeof featuredCards
                            ];
                          const CardIcon = card?.icon ?? SectionIcon;
                          const accent = card?.accent ?? theme.accent;
                          const soft = card?.soft ?? theme.soft;
                          const logoRows =
                            card && 'logoDomains' in card
                              ? card.logoDomains
                              : undefined;
                          const entityLabel =
                            card && 'entityLabel' in card
                              ? card.entityLabel
                              : section.title === 'Top University'
                                ? 'Academic institutions'
                                : 'Organizations';
                          const countLabel =
                            card && 'countLabel' in card
                              ? card.countLabel
                              : section.title === 'Top University'
                                ? 'Universities'
                                : section.title === 'Sectors'
                                  ? 'Themes'
                                  : 'Companies';

                          return (
                            <Link
                              key={project.id}
                              href={`/dashboard/${project.id}`}
                              className='group flex min-h-[292px] flex-col overflow-hidden rounded-[20px] border border-stroke-soft-200 bg-bg-white-0 shadow-regular-xs transition hover:-translate-y-0.5 hover:shadow-regular-md'
                            >
                              <div className='flex flex-1 flex-col p-5'>
                                <div className='flex items-start justify-between gap-4'>
                                  <span
                                    className='grid size-11 place-items-center rounded-xl ring-1 ring-inset ring-black/[0.04]'
                                    style={{
                                      backgroundColor: soft,
                                      color: accent,
                                    }}
                                  >
                                    {section.title === 'Geography' &&
                                    geographyMarks[project.id] ? (
                                      <span className='text-xl'>
                                        {geographyMarks[project.id]}
                                      </span>
                                    ) : (
                                      <CardIcon className='size-5' />
                                    )}
                                  </span>
                                  <span className='grid size-8 place-items-center rounded-lg text-text-soft-400 transition group-hover:bg-bg-weak-50 group-hover:text-text-strong-950'>
                                    <RiArrowRightUpLongLine className='size-5' />
                                  </span>
                                </div>

                                <h3 className='mt-5 text-label-md text-text-strong-950'>
                                  {project.title}
                                </h3>
                                <p className='mt-1 text-paragraph-sm text-text-sub-600'>
                                  {card?.subtitle ?? project.description}
                                </p>

                                {card?.groups && (
                                  <div className='mt-5 space-y-3'>
                                    <p className='text-subheading-2xs uppercase text-text-soft-400'>
                                      {entityLabel}
                                    </p>
                                    {card.groups.map((group, rowIndex) => (
                                      <div
                                        key={group}
                                        className='flex min-h-8 items-center gap-3 text-label-xs text-text-sub-600'
                                      >
                                        {logoRows?.[rowIndex]?.length ? (
                                          <span className='flex shrink-0 -space-x-2'>
                                            {logoRows[rowIndex].map(
                                              (domain) => (
                                                <span
                                                  key={domain}
                                                  className='grid size-7 place-items-center overflow-hidden rounded-full bg-bg-white-0 ring-2 ring-bg-white-0 shadow-regular-xs'
                                                >
                                                  <img
                                                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                                    alt=''
                                                    className='size-4 object-contain'
                                                  />
                                                </span>
                                              ),
                                            )}
                                          </span>
                                        ) : (
                                          <span
                                            className='size-1.5 shrink-0 rounded-full'
                                            style={{ backgroundColor: accent }}
                                          />
                                        )}
                                        <span>{group}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {card && (
                                <div className='grid grid-cols-3 border-t border-stroke-soft-200 bg-bg-weak-50/50'>
                                  {[
                                    [countLabel, card.count],
                                    ['Reach', card.reach],
                                    ['Signal', card.signal],
                                  ].map(([label, value], index) => (
                                    <div
                                      key={label}
                                      className={`px-4 py-3 ${
                                        index > 0
                                          ? 'border-l border-stroke-soft-200'
                                          : ''
                                      }`}
                                    >
                                      <p className='text-subheading-2xs uppercase text-text-soft-400'>
                                        {label}
                                      </p>
                                      <p className='mt-1 truncate text-label-xs text-text-strong-950'>
                                        {value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
