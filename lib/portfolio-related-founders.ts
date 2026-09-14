export const RELATED_FOUNDER_MATCH_THRESHOLD = 55;
export const FUND_THESIS_MATCH_CAP = 68;
export const SPARSE_COMPANY_EVIDENCE_CAP = 75;

export type RelatedFounderMatchClassification =
  'related_founder' | 'fund_thesis_match';

export type RelatedFounderReference = {
  company: {
    sector: string | null;
    description: string | null;
    thesisSignals: string[];
    stage: string | null;
    geography: string | null;
    founderPattern: string | null;
  };
  fund: {
    name: string | null;
    thesisSignals: string[];
    founderPatterns: string[];
  };
  diversityKey: string;
};

export type RelatedFounderCandidate = {
  id: string;
  name: string;
  companyId: string | null;
  companyName: string | null;
  category: string[];
  tags: string[];
  flags: string[];
  founderRole: string | null;
  timingLabel: string | null;
  scouterScore: number | null;
  unresolvedIdentityConflict?: boolean;
};

export type RelatedFounderMatch = {
  id: string;
  name: string;
  companyName: string | null;
  role: string | null;
  scouterScore: number | null;
  relatedMatchScore: number;
  classification: RelatedFounderMatchClassification;
  companyEvidenceWeight: number;
  whyMatched: string[];
};

type SignalRule = { label: string; pattern: RegExp; reason: string };

const SECTOR_RULES: SignalRule[] = [
  {
    label: 'ai',
    pattern: /\bartificial intelligence\b|\bai\b|machine learning|\bml\b/i,
    reason: 'Artificial Intelligence overlap',
  },
  {
    label: 'ai-infra',
    pattern:
      /ai infrastructure|ml infrastructure|mlops|inference|model infrastructure/i,
    reason: 'AI infrastructure overlap',
  },
  {
    label: 'fintech',
    pattern: /fintech|payments?|banking|treasury|financial services/i,
    reason: 'Fintech overlap',
  },
  {
    label: 'b2b-saas',
    pattern:
      /b2b saas|enterprise software|workflow automation|business software/i,
    reason: 'B2B SaaS overlap',
  },
  {
    label: 'aerospace',
    pattern: /aerospace|space tech|satellite|aviation|supersonic/i,
    reason: 'Aerospace overlap',
  },
  {
    label: 'deeptech',
    pattern: /deep ?tech|hard ?tech|robotics|hardware|semiconductor/i,
    reason: 'Deep tech overlap',
  },
  {
    label: 'consumer',
    pattern: /consumer|creator economy|social|media|commerce/i,
    reason: 'Consumer overlap',
  },
  {
    label: 'health',
    pattern: /healthcare|health ?tech|biotech|life sciences/i,
    reason: 'Healthcare overlap',
  },
  {
    label: 'hrtech',
    pattern: /hr ?tech|future of work|recruiting|talent|workforce/i,
    reason: 'HR tech overlap',
  },
  {
    label: 'climate',
    pattern: /climate|clean energy|carbon|greentech/i,
    reason: 'Climate overlap',
  },
  {
    label: 'defense',
    pattern: /defen[cs]e|gov ?tech|dual use/i,
    reason: 'Defense overlap',
  },
  {
    label: 'marketplace',
    pattern: /marketplace|market network/i,
    reason: 'Marketplace overlap',
  },
];

const ARCHETYPE_RULES: SignalRule[] = [
  {
    label: 'repeat',
    pattern: /repeat founder|serial founder|previous exit|prior exit|acquired/i,
    reason: 'Repeat founder pattern',
  },
  {
    label: 'technical',
    pattern:
      /technical founder|engineer|engineering|\bcto\b|researcher|computer science/i,
    reason: 'Technical founder pattern',
  },
  {
    label: 'operator',
    pattern: /operator|operations|\bgtm\b|sales|growth/i,
    reason: 'Operator founder pattern',
  },
  {
    label: 'hustle',
    pattern: /hustle|speed|execution|ambitious|nerve to start/i,
    reason: 'Hustle founder pattern',
  },
];

const FLAG_LABELS: Record<string, string[]> = {
  sector_ai_ml_infra: ['ai', 'ai-infra'],
  sector_fintech: ['fintech'],
  sector_b2b_saas: ['b2b-saas'],
  sector_deeptech: ['deeptech'],
  sector_climate: ['climate'],
  sector_health: ['health'],
  sector_defense: ['defense'],
  sector_consumer: ['consumer'],
  sector_hrtech: ['hrtech'],
};

function labelsFor(parts: Array<string | null>, rules: SignalRule[]) {
  const value = parts.filter(Boolean).join(' · ');
  return rules
    .filter((rule) => rule.pattern.test(value))
    .map((rule) => rule.label);
}

function candidateSectorLabels(candidate: RelatedFounderCandidate) {
  return Array.from(
    new Set([
      ...labelsFor([...candidate.category, ...candidate.tags], SECTOR_RULES),
      ...candidate.flags.flatMap((flag) => FLAG_LABELS[flag] || []),
    ]),
  );
}

function candidateArchetypeLabels(candidate: RelatedFounderCandidate) {
  return labelsFor(
    [candidate.founderRole, candidate.timingLabel, ...candidate.tags],
    ARCHETYPE_RULES,
  );
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter((value) => rightSet.has(value))));
}

function reasonFor(label: string, rules: SignalRule[], suffix = '') {
  const reason = rules.find((rule) => rule.label === label)?.reason || label;
  return suffix ? `${reason.replace(/ overlap$/, '')} ${suffix}` : reason;
}

function timingCompatibility(
  reference: string | null,
  candidate: string | null,
) {
  if (
    !reference ||
    !candidate ||
    !/pre.?seed|seed|early|angel/i.test(reference)
  )
    return null;
  return /recent|new|formation|pre.?reveal|stealth|early|0[-– ]?6m/i.test(
    candidate,
  )
    ? 100
    : 40;
}

function exactGeography(reference: string | null, candidateParts: string[]) {
  if (!reference?.trim()) return null;
  return candidateParts
    .join(' · ')
    .toLowerCase()
    .includes(reference.trim().toLowerCase())
    ? 100
    : 0;
}

function stableTieBreak(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function scoreRelatedFounder(
  reference: RelatedFounderReference,
  candidate: RelatedFounderCandidate,
): RelatedFounderMatch | null {
  if (candidate.unresolvedIdentityConflict || !candidate.name.trim())
    return null;

  const candidateSectors = candidateSectorLabels(candidate);
  const candidateArchetypes = candidateArchetypeLabels(candidate);
  const companySectors = labelsFor(
    [reference.company.sector, reference.company.description],
    SECTOR_RULES,
  );
  const companyThesis = labelsFor(
    reference.company.thesisSignals,
    SECTOR_RULES,
  );
  const companyArchetypes = labelsFor(
    [reference.company.founderPattern, ...reference.company.thesisSignals],
    ARCHETYPE_RULES,
  );
  const sectorMatches = overlap(companySectors, candidateSectors);
  const companyThesisMatches = overlap(companyThesis, candidateSectors);
  const companyArchetypeMatches = overlap(
    companyArchetypes,
    candidateArchetypes,
  );
  if (companySectors.length > 0 && sectorMatches.length === 0) return null;

  const stageFit = timingCompatibility(
    reference.company.stage,
    candidate.timingLabel,
  );
  const geographyFit = exactGeography(reference.company.geography, [
    ...candidate.category,
    ...candidate.tags,
  ]);
  const fundSectors = labelsFor(reference.fund.thesisSignals, SECTOR_RULES);
  const fundArchetypes = labelsFor(
    [...reference.fund.founderPatterns, ...reference.fund.thesisSignals],
    ARCHETYPE_RULES,
  );
  const fundMatch =
    overlap(fundSectors, candidateSectors).length > 0 ||
    overlap(fundArchetypes, candidateArchetypes).length > 0;
  const scouterScore =
    candidate.scouterScore != null && Number.isFinite(candidate.scouterScore)
      ? Math.max(0, Math.min(100, candidate.scouterScore))
      : null;

  const availableCompanyEvidenceWeight =
    (companySectors.length ? 30 : 0) +
    (companyThesis.length ? 25 : 0) +
    (companyArchetypes.length ? 15 : 0) +
    (stageFit == null ? 0 : 10) +
    (geographyFit == null ? 0 : 5);
  const companyEvidenceWeight =
    (sectorMatches.length ? 30 : 0) +
    (companyThesisMatches.length
      ? 25 * Math.min(1, companyThesisMatches.length / companyThesis.length)
      : 0) +
    (companyArchetypeMatches.length
      ? 15 *
        Math.min(1, companyArchetypeMatches.length / companyArchetypes.length)
      : 0) +
    (stageFit === 100 ? 10 : 0) +
    (geographyFit === 100 ? 5 : 0);
  const companySemanticMatches =
    sectorMatches.length +
    companyThesisMatches.length +
    companyArchetypeMatches.length;
  const classification: RelatedFounderMatchClassification =
    companySemanticMatches > 0 ? 'related_founder' : 'fund_thesis_match';
  if (companySemanticMatches === 0 && !fundMatch) return null;

  const dimensions = [
    companySectors.length && candidateSectors.length
      ? { weight: 30, value: sectorMatches.length ? 100 : 0 }
      : null,
    companyThesis.length && candidateSectors.length
      ? { weight: 25, value: Math.min(100, companyThesisMatches.length * 60) }
      : null,
    companyArchetypes.length && candidateArchetypes.length
      ? { weight: 15, value: companyArchetypeMatches.length ? 100 : 0 }
      : null,
    stageFit == null ? null : { weight: 10, value: stageFit },
    geographyFit == null ? null : { weight: 5, value: geographyFit },
    fundSectors.length || fundArchetypes.length
      ? { weight: 10, value: fundMatch ? 100 : 0 }
      : null,
    scouterScore == null ? null : { weight: 10, value: scouterScore },
  ].filter((item): item is { weight: number; value: number } => Boolean(item));
  if (!dimensions.length) return null;

  const uncalibratedScore = Math.round(
    dimensions.reduce((total, item) => total + item.weight * item.value, 0) /
      dimensions.reduce((total, item) => total + item.weight, 0),
  );
  const evidenceCap =
    classification === 'fund_thesis_match'
      ? FUND_THESIS_MATCH_CAP
      : availableCompanyEvidenceWeight < 45
        ? SPARSE_COMPANY_EVIDENCE_CAP
        : availableCompanyEvidenceWeight < 70
          ? 88
          : 100;
  const relatedMatchScore = Math.min(uncalibratedScore, evidenceCap);
  if (relatedMatchScore < RELATED_FOUNDER_MATCH_THRESHOLD) return null;

  const companyReasons = [
    ...sectorMatches.map((label) => reasonFor(label, SECTOR_RULES)),
    ...companyThesisMatches.map((label) =>
      reasonFor(label, SECTOR_RULES, 'company signal'),
    ),
    ...companyArchetypeMatches.map((label) =>
      reasonFor(label, ARCHETYPE_RULES),
    ),
    ...(stageFit === 100 ? ['Early-stage company pattern'] : []),
    ...(geographyFit === 100 ? ['Same geography'] : []),
  ];
  const fundReason = fundMatch
    ? [`Matches ${reference.fund.name || 'fund'} thesis`]
    : [];
  const whyMatched = Array.from(
    new Set([...companyReasons, ...fundReason]),
  ).slice(0, 3);

  return {
    id: candidate.id,
    name: candidate.name,
    companyName: candidate.companyName,
    role: candidate.founderRole,
    scouterScore,
    relatedMatchScore,
    classification,
    companyEvidenceWeight,
    whyMatched,
  };
}

export function rankRelatedFounders(
  reference: RelatedFounderReference,
  candidates: RelatedFounderCandidate[],
  excludedFounderIds: string[] = [],
  limit = 3,
) {
  const excluded = new Set(excludedFounderIds);
  const seen = new Set<string>();
  return candidates
    .flatMap((candidate) => {
      if (excluded.has(candidate.id) || seen.has(candidate.id)) return [];
      seen.add(candidate.id);
      const match = scoreRelatedFounder(reference, candidate);
      return match ? [{ match, candidate }] : [];
    })
    .sort((left, right) => {
      const scoreDifference =
        right.match.relatedMatchScore - left.match.relatedMatchScore;
      if (Math.abs(scoreDifference) > 2) return scoreDifference;
      const evidenceDifference =
        right.match.companyEvidenceWeight - left.match.companyEvidenceWeight;
      if (evidenceDifference) return evidenceDifference;
      const leftTie = stableTieBreak(
        `${reference.diversityKey}|${left.candidate.id}|${left.candidate.category.join('|')}`,
      );
      const rightTie = stableTieBreak(
        `${reference.diversityKey}|${right.candidate.id}|${right.candidate.category.join('|')}`,
      );
      return (
        leftTie - rightTie ||
        scoreDifference ||
        (right.match.scouterScore || 0) - (left.match.scouterScore || 0) ||
        left.match.name.localeCompare(right.match.name)
      );
    })
    .slice(0, Math.max(0, limit))
    .map(({ match }) => match);
}
