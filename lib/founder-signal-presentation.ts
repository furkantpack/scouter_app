import type { FounderDetail, Json } from './product-types.ts';

export type FounderSignalGroupKey =
  | 'career'
  | 'timing'
  | 'founder_quality'
  | 'traction'
  | 'network'
  | 'education';

export type FounderSignalGroup = {
  key: FounderSignalGroupKey;
  label: string;
  signals: string[];
};

export type FounderSignalPresentation = {
  whyNow: string | null;
  groups: FounderSignalGroup[];
};

type DataRecord = Record<string, Json>;

const GROUP_LABELS: Record<FounderSignalGroupKey, string> = {
  career: 'Career',
  timing: 'Timing',
  founder_quality: 'Founder Quality',
  traction: 'Traction',
  network: 'Capital & Network',
  education: 'Education',
};

const GROUP_ORDER = Object.keys(GROUP_LABELS) as FounderSignalGroupKey[];

const EXACT_SIGNALS: Record<string, [FounderSignalGroupKey, string]> = {
  'previous exit': ['career', 'Previous Exit'],
  'prior exit': ['career', 'Previous Exit'],
  'repeat founder': ['career', 'Repeat Founder'],
  'serial founder': ['career', 'Repeat Founder'],
  founder: ['career', 'Founder'],
  'co founder': ['career', 'Co-Founder'],
  'big tech alumni': ['career', 'Big Tech Alumni'],
  'ai alumni': ['career', 'AI Alumni'],
  'elite career origin': ['career', 'Elite Career Origin'],
  'recently left': ['timing', 'Recently Left'],
  'fresh venture': ['timing', 'Fresh Venture'],
  'fresh stealth': ['timing', 'Fresh Venture'],
  'founder formation': ['timing', 'Founder Formation'],
  'building something new': ['timing', 'Building Something New'],
  '0 3 months': ['timing', '0–3 Months'],
  '4 6 months': ['timing', '4–6 Months'],
  'top priority': ['timing', 'Top Priority'],
  'low public footprint': ['timing', 'Low Public Footprint'],
  'very low visibility': ['timing', 'Low Public Footprint'],
  'technical founder': ['founder_quality', 'Technical Founder'],
  'high ownership': ['founder_quality', 'High Ownership'],
  'solo builder': ['founder_quality', 'Solo Builder'],
  'high ownership engineer': ['founder_quality', 'High-Ownership Engineer'],
  'repeat commercial founder': ['founder_quality', 'Repeat Commercial Founder'],
  'github first founder': ['founder_quality', 'GitHub-First Founder'],
  'rapid growth': ['traction', 'Rapid Growth'],
  'enterprise customers': ['traction', 'Enterprise Customers'],
  'rapid hiring': ['traction', 'Rapid Hiring'],
  hiring: ['traction', 'Rapid Hiring'],
  'github breakout': ['traction', 'GitHub Breakout'],
  'high star velocity': ['traction', 'High Star Velocity'],
  'commercial intent': ['traction', 'Commercial Intent'],
  sequoia: ['network', 'Sequoia'],
  'sequoia capital': ['network', 'Sequoia'],
  yc: ['network', 'YC'],
  'y combinator': ['network', 'YC'],
  'entrepreneur first': ['network', 'Entrepreneur First'],
  'the bridge': ['network', 'The Bridge'],
  antler: ['network', 'Antler'],
  techstars: ['network', 'Techstars'],
  'top tier vc angel backing': ['network', 'Top-Tier VC / Angel Backing'],
  'known investor signal': ['network', 'Known Investor Signal'],
  'angel investor': ['network', 'Angel Investor'],
};

const EDUCATION_SIGNALS: Array<[RegExp, string]> = [
  [/^(?:mit|massachusetts institute of technology)(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'MIT'],
  [/^stanford(?: university)?(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'Stanford'],
  [/^harvard(?: university)?(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'Harvard'],
  [/^(?:university of )?oxford(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'Oxford'],
  [/^(?:university of )?cambridge(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'Cambridge'],
  [/^eth(?: zurich)?(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'ETH Zurich'],
  [/^(?:cmu|carnegie mellon(?: university)?)(?:$|\s+(?:phd|ms|msc|mba|bs|bsc|alum|alumni|alumnus|alumna|graduate))/i, 'CMU'],
];

const AI_EMPLOYERS = new Set(['openai', 'anthropic', 'deepmind', 'google deepmind', 'mistral ai', 'cohere', 'xai']);

function recordOf(value: Json | undefined): DataRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as DataRecord)
    : null;
}

function textOf(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstText(record: DataRecord | null, keys: string[]) {
  for (const key of keys) {
    const value = textOf(record?.[key]);
    if (value) return value;
  }
  return null;
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9$+.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagNames(detail: FounderDetail) {
  return detail.tags
    .map((row) => firstText(recordOf(row.tags), ['tag', 'name', 'label']))
    .filter((value): value is string => Boolean(value));
}

function roleSignal(role: string | null) {
  const value = normalize(role || '');
  if (/^co founder(?: (?:and )?(?:ceo|cto|coo))?$/.test(value)) return 'Co-Founder';
  if (/^founder(?: (?:and )?(?:ceo|cto|coo))?$/.test(value)) return 'Founder';
  return null;
}

function addSignal(
  groups: Map<FounderSignalGroupKey, string[]>,
  key: FounderSignalGroupKey,
  label: string,
) {
  const values = groups.get(key) || [];
  if (!values.some((value) => normalize(value) === normalize(label))) values.push(label);
  groups.set(key, values);
}

function classifyExplicitTag(
  tag: string,
  groups: Map<FounderSignalGroupKey, string[]>,
) {
  const normalized = normalize(tag);
  const exact = EXACT_SIGNALS[normalized];
  if (exact) {
    addSignal(groups, exact[0], exact[1]);
    return;
  }

  const exEmployer = tag.match(/^ex\s*[-–—]\s*(.+)$/i);
  if (exEmployer?.[1]?.trim()) {
    addSignal(groups, 'career', `Ex-${exEmployer[1].trim()}`);
    return;
  }

  const arr = tag.match(/^\$?([\d.]+)\s*([mk])?\+?\s*arr$/i);
  if (arr) {
    addSignal(groups, 'traction', tag.trim().replace(/\s+/g, ' '));
    return;
  }

  if (/^(?:.+\s+)?(?:previous|prior )?exit(?:\s+to\s+.+)?$/i.test(tag) || /^.+\s+acquired$/i.test(tag)) {
    addSignal(groups, 'career', 'Previous Exit');
    return;
  }

  if (/^\$?[\d.]+\s*[mk]?\+?\s+raised$/i.test(tag)) {
    addSignal(groups, 'network', tag.trim().replace(/\s+/g, ' '));
    return;
  }

  for (const [pattern, label] of EDUCATION_SIGNALS) {
    if (pattern.test(tag)) {
      addSignal(groups, 'education', label);
      return;
    }
  }
}

function deduplicate(groups: Map<FounderSignalGroupKey, string[]>) {
  const career = groups.get('career') || [];
  if (career.includes('Co-Founder')) {
    groups.set('career', career.filter((signal) => signal !== 'Founder'));
  }

  const exEmployers = new Set(
    (groups.get('career') || [])
      .filter((signal) => signal.startsWith('Ex-'))
      .map((signal) => normalize(signal.slice(3))),
  );
  if (Array.from(exEmployers).some((employer) => AI_EMPLOYERS.has(employer))) {
    groups.set('career', (groups.get('career') || []).filter((signal) => signal !== 'AI Alumni'));
  }
}

function has(groups: Map<FounderSignalGroupKey, string[]>, key: FounderSignalGroupKey, labels: string[]) {
  return (groups.get(key) || []).some((signal) => labels.includes(signal));
}

function buildWhyNow(groups: Map<FounderSignalGroupKey, string[]>) {
  const timing = (groups.get('timing') || []).length > 0;
  const previous = has(groups, 'career', ['Previous Exit', 'Repeat Founder']);
  const technical = has(groups, 'founder_quality', [
    'Technical Founder',
    'High Ownership',
    'Solo Builder',
    'High-Ownership Engineer',
    'GitHub-First Founder',
  ]);
  const lowVisibility = has(groups, 'timing', ['Low Public Footprint']);
  const traction = (groups.get('traction') || []).length > 0;
  const aiExperience = has(groups, 'career', ['AI Alumni']) ||
    (groups.get('career') || []).some((signal) =>
      AI_EMPLOYERS.has(normalize(signal.replace(/^Ex-/, ''))),
    );
  const highOwnership = has(groups, 'founder_quality', ['High Ownership', 'High-Ownership Engineer']);
  const github = has(groups, 'traction', ['GitHub Breakout', 'High Star Velocity']);
  const commercial = has(groups, 'traction', ['Commercial Intent']);

  if (timing && previous && traction) {
    return 'Repeat founder entering a fresh company-building phase, backed by prior founder experience and early commercial traction.';
  }
  if (timing && technical && aiExperience && lowVisibility) {
    return 'Technical founder in an early transition window, combining strong AI experience with low current market visibility.';
  }
  if (highOwnership && github && commercial) {
    return 'High-ownership builder showing clear project-to-company transition signals alongside strong technical momentum.';
  }
  if (timing && previous) {
    return 'Experienced founder entering a timely new company-building phase.';
  }
  if (timing && technical) {
    return 'Technical founder showing an active early company-building signal.';
  }
  if (previous && traction) {
    return 'Experienced founder combining prior company-building history with explicit commercial traction.';
  }
  if (timing) return 'An explicit early company-building signal is active.';
  if (previous) return 'Prior founder experience makes this a relevant company-building profile.';
  if (technical && traction) return 'Technical founder showing explicit early traction signals.';
  if (traction) return 'The profile shows explicit early commercial traction.';
  return null;
}

export function buildFounderSignalPresentation(
  detail: FounderDetail,
): FounderSignalPresentation {
  const groups = new Map<FounderSignalGroupKey, string[]>();

  for (const tag of tagNames(detail)) classifyExplicitTag(tag, groups);

  const role = roleSignal(detail.profile.founder_role);
  if (role) addSignal(groups, 'career', role);
  if (/^(?:co )?founder(?: and)? cto$|^cto$|^founding engineer$/.test(normalize(detail.profile.founder_role || ''))) {
    addSignal(groups, 'founder_quality', 'Technical Founder');
  }

  for (const roleRow of detail.roles) {
    if (roleRow.is_current !== false) continue;
    const company = recordOf(roleRow.companies);
    const companyName = firstText(company, ['name', 'company_name']);
    if (companyName) addSignal(groups, 'career', `Ex-${companyName}`);
  }

  const timing = detail.profile.timing_label?.trim();
  if (timing && !/^(not available|unknown|n\/a)$/i.test(timing)) {
    addSignal(groups, 'timing', timing);
  }

  deduplicate(groups);

  return {
    whyNow: buildWhyNow(groups),
    groups: GROUP_ORDER.flatMap((key) => {
      const signals = groups.get(key) || [];
      return signals.length ? [{ key, label: GROUP_LABELS[key], signals }] : [];
    }),
  };
}
