export type NetworkCategory = 'Companies' | 'VC Associate' | 'Accelerator';

export type NetworkProfile = {
  slug: string;
  name: string;
  category: NetworkCategory;
  organization: string;
  tagline: string;
  description: string;
  logoDomain: string;
  website: string;
  location: string;
  founded: string;
  focusAreas: string[];
  highlights: string[];
  stats: { label: string; value: string; caption: string }[];
};

const company = (
  slug: string,
  name: string,
  logoDomain: string,
  tagline: string,
  description: string,
  location: string,
  founded: string,
  focusAreas: string[],
  stats: NetworkProfile['stats'],
): NetworkProfile => ({
  slug,
  name,
  category: 'Companies',
  organization: name,
  tagline,
  description,
  logoDomain,
  website: `https://${logoDomain}`,
  location,
  founded,
  focusAreas,
  highlights: [
    'Verified company profile',
    'Active within the Scouter network',
    'Relevant operator and founder connections available',
  ],
  stats,
});

export const networkProfiles: Record<string, NetworkProfile> = {
  vercel: company(
    'vercel',
    'Vercel',
    'vercel.com',
    'Developer Experience',
    'Vercel provides a cloud platform for building, deploying, and scaling modern web applications.',
    'San Francisco, United States',
    '2015',
    ['Developer tools', 'Cloud infrastructure', 'Frontend platforms'],
    [
      {
        label: 'Open roles',
        value: '8',
        caption: 'Across product and engineering',
      },
      { label: 'Network', value: '34', caption: 'Shared connections' },
      { label: 'Stage', value: 'Growth', caption: 'Global platform' },
    ],
  ),
  linear: company(
    'linear',
    'Linear',
    'linear.app',
    'Product & Design',
    'Linear builds a high-performance system for modern product development teams.',
    'San Francisco, United States',
    '2019',
    ['Productivity', 'Developer tools', 'Collaboration'],
    [
      { label: 'Open roles', value: '5', caption: 'Design and engineering' },
      { label: 'Network', value: '22', caption: 'Shared connections' },
      { label: 'Stage', value: 'Growth', caption: 'Global SaaS' },
    ],
  ),
  notion: company(
    'notion',
    'Notion',
    'notion.so',
    'Product & Engineering',
    'Notion is a connected workspace for documentation, knowledge, projects, and AI-assisted work.',
    'San Francisco, United States',
    '2013',
    ['Productivity', 'Collaboration', 'AI workspace'],
    [
      { label: 'Open roles', value: '11', caption: 'Across global teams' },
      { label: 'Network', value: '43', caption: 'Shared connections' },
      { label: 'Stage', value: 'Growth', caption: 'Global SaaS' },
    ],
  ),
  arc: company(
    'arc',
    'Arc',
    'arc.dev',
    'Remote Technology',
    'Arc connects technology companies with a global network of remote software talent.',
    'Palo Alto, United States',
    '2019',
    ['Talent network', 'Remote work', 'Developer marketplace'],
    [
      { label: 'Open roles', value: '7', caption: 'Remote opportunities' },
      { label: 'Network', value: '31', caption: 'Shared connections' },
      { label: 'Reach', value: 'Global', caption: 'Remote-first network' },
    ],
  ),
  stripe: company(
    'stripe',
    'Stripe',
    'stripe.com',
    'Finance Infrastructure',
    'Stripe builds programmable financial infrastructure for internet businesses.',
    'San Francisco, United States',
    '2010',
    ['Payments', 'Fintech infrastructure', 'Developer APIs'],
    [
      { label: 'Open roles', value: '9', caption: 'Product and engineering' },
      { label: 'Network', value: '39', caption: 'Shared connections' },
      { label: 'Reach', value: 'Global', caption: 'Financial platform' },
    ],
  ),
  loom: company(
    'loom',
    'Loom',
    'loom.com',
    'Video Collaboration',
    'Loom enables teams to communicate and collaborate through asynchronous video.',
    'San Francisco, United States',
    '2015',
    ['Video', 'Collaboration', 'Future of work'],
    [
      { label: 'Open roles', value: '6', caption: 'Across core teams' },
      { label: 'Network', value: '28', caption: 'Shared connections' },
      { label: 'Model', value: 'SaaS', caption: 'Team collaboration' },
    ],
  ),
  trello: company(
    'trello',
    'Trello',
    'trello.com',
    'Project Management',
    'Trello is a visual collaboration tool that helps teams organize projects and workflows.',
    'New York, United States',
    '2011',
    ['Project management', 'Collaboration', 'Productivity'],
    [
      { label: 'Open roles', value: '8', caption: 'Product and platform' },
      { label: 'Network', value: '34', caption: 'Shared connections' },
      { label: 'Model', value: 'SaaS', caption: 'Work management' },
    ],
  ),
  'monday-com': company(
    'monday-com',
    'Monday.com',
    'monday.com',
    'Work Operating System',
    'Monday.com provides a flexible work operating system for teams and organizations.',
    'Tel Aviv, Israel',
    '2012',
    ['Work management', 'Automation', 'Enterprise SaaS'],
    [
      { label: 'Open roles', value: '11', caption: 'Across global offices' },
      { label: 'Network', value: '41', caption: 'Shared connections' },
      { label: 'Market', value: 'Public', caption: 'Global software' },
    ],
  ),
  zoom: company(
    'zoom',
    'Zoom',
    'zoom.us',
    'Video Communication',
    'Zoom provides a communications platform spanning meetings, phone, contact center, and workplace collaboration.',
    'San Jose, United States',
    '2011',
    ['Communications', 'Video', 'Enterprise software'],
    [
      { label: 'Open roles', value: '9', caption: 'Across key functions' },
      { label: 'Network', value: '37', caption: 'Shared connections' },
      { label: 'Market', value: 'Public', caption: 'Global communications' },
    ],
  ),
  'elena-rossi': {
    slug: 'elena-rossi',
    name: 'Elena Rossi',
    category: 'VC Associate',
    organization: 'Sequoia Capital',
    tagline: 'Early-stage SaaS investor',
    description:
      'A curated investor profile focused on early-stage software, developer tools, and enduring product-led companies.',
    logoDomain: 'sequoiacap.com',
    website: 'https://sequoiacap.com',
    location: 'London, United Kingdom',
    founded: 'Associate profile',
    focusAreas: ['B2B SaaS', 'Developer tools', 'Seed', 'Series A'],
    highlights: [
      'Strong founder referral graph',
      'Product-led growth expertise',
      'Active early-stage thesis',
    ],
    stats: [
      { label: 'Active deals', value: '14', caption: 'Tracked opportunities' },
      { label: 'Check size', value: '$250K–$1M', caption: 'Typical range' },
      { label: 'Connections', value: '68', caption: 'Shared network' },
    ],
  },
  'marcus-lee': {
    slug: 'marcus-lee',
    name: 'Marcus Lee',
    category: 'VC Associate',
    organization: 'Accel',
    tagline: 'Fintech and infrastructure',
    description:
      'A curated investor profile covering fintech platforms, financial infrastructure, and enterprise software.',
    logoDomain: 'accel.com',
    website: 'https://www.accel.com',
    location: 'New York, United States',
    founded: 'Associate profile',
    focusAreas: ['Fintech', 'Infrastructure', 'Pre-seed', 'Seed'],
    highlights: [
      'Operator-led investment perspective',
      'Deep fintech network',
      'Active sourcing profile',
    ],
    stats: [
      { label: 'Active deals', value: '9', caption: 'Tracked opportunities' },
      { label: 'Check size', value: '$100K–$750K', caption: 'Typical range' },
      { label: 'Connections', value: '51', caption: 'Shared network' },
    ],
  },
  'sophia-khan': {
    slug: 'sophia-khan',
    name: 'Sophia Khan',
    category: 'VC Associate',
    organization: 'Index Ventures',
    tagline: 'Climate and deep tech',
    description:
      'A curated investor profile focused on climate transition, hard technology, and science-led businesses.',
    logoDomain: 'indexventures.com',
    website: 'https://www.indexventures.com',
    location: 'Berlin, Germany',
    founded: 'Associate profile',
    focusAreas: ['Climate', 'Deep tech', 'Seed', 'Series A'],
    highlights: [
      'Technical founder network',
      'Cross-border investment lens',
      'Science-led thesis',
    ],
    stats: [
      { label: 'Active deals', value: '11', caption: 'Tracked opportunities' },
      { label: 'Check size', value: '$500K–$2M', caption: 'Typical range' },
      { label: 'Connections', value: '43', caption: 'Shared network' },
    ],
  },
  'y-combinator': {
    slug: 'y-combinator',
    name: 'Y Combinator',
    category: 'Accelerator',
    organization: 'Y Combinator',
    tagline: 'Global founder accelerator',
    description:
      'Y Combinator helps founders launch, build, and scale technology companies through its intensive batch program and founder community.',
    logoDomain: 'ycombinator.com',
    website: 'https://www.ycombinator.com',
    location: 'San Francisco, United States',
    founded: '2005',
    focusAreas: ['Software', 'Global founders', 'Pre-seed', 'Seed'],
    highlights: [
      'Founder-led batch program',
      'Global alumni community',
      'Seed capital and intensive support',
    ],
    stats: [
      { label: 'Programs', value: '4/year', caption: 'Flagship batches' },
      { label: 'Capital', value: '$500K', caption: 'Standard deal' },
      { label: 'Network', value: '7K+', caption: 'Founders' },
    ],
  },
  techstars: {
    slug: 'techstars',
    name: 'Techstars',
    category: 'Accelerator',
    organization: 'Techstars',
    tagline: 'Mentor-driven accelerator',
    description:
      'Techstars operates mentorship-driven accelerator programs that connect founders with capital, domain expertise, and a global network.',
    logoDomain: 'techstars.com',
    website: 'https://www.techstars.com',
    location: 'Global',
    founded: '2006',
    focusAreas: ['B2B', 'Fintech', 'Health', 'Global programs'],
    highlights: [
      'Mentor-driven programs',
      'Industry-specific accelerators',
      'Global founder and investor network',
    ],
    stats: [
      { label: 'Programs', value: '18', caption: 'Tracked programs' },
      { label: 'Capital', value: '$120K', caption: 'Program reference' },
      { label: 'Network', value: '94', caption: 'Scouter connections' },
    ],
  },
  'five-hundred-global': {
    slug: 'five-hundred-global',
    name: '500 Global',
    category: 'Accelerator',
    organization: '500 Global',
    tagline: 'Emerging market accelerator',
    description:
      '500 Global is a venture capital firm investing in globally ambitious founders and supporting them with mentorship and network access.',
    logoDomain: '500.co',
    website: 'https://500.co',
    location: 'Global',
    founded: '2010',
    focusAreas: ['Emerging markets', 'MENA', 'Europe', 'Seed'],
    highlights: [
      'Global investment footprint',
      'Emerging-market expertise',
      'Founder mentorship and capital',
    ],
    stats: [
      { label: 'Programs', value: '16', caption: 'Tracked programs' },
      { label: 'Capital', value: '$150K', caption: 'Program reference' },
      { label: 'Network', value: '82', caption: 'Scouter connections' },
    ],
  },
};

export const networkProfileList = Object.values(networkProfiles);

export function networkLogoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
