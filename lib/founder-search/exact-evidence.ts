import { normalizeRuleText } from '../founder-filter-flags.ts';
import {
  companyAliases,
  institutionAliases,
  KNOWN_COMPANIES,
  KNOWN_INSTITUTIONS,
} from './parser-core.ts';

export type ExactEntityKind = 'employer' | 'institution';

export type ExactEntityEvidence = {
  canonical: string;
  kind: ExactEntityKind;
  matched_alias: string;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function canonicalEntityForAlias(value: string, kind: ExactEntityKind) {
  const normalized = normalizeRuleText(value);
  const entities = kind === 'employer' ? KNOWN_COMPANIES : KNOWN_INSTITUTIONS;
  const aliases = kind === 'employer' ? companyAliases : institutionAliases;
  for (const entity of entities) {
    if (
      aliases(entity).some((alias) => normalizeRuleText(alias) === normalized)
    ) {
      return entity;
    }
  }
  return null;
}

function exactAliasPattern(alias: string) {
  return escapeRegExp(normalizeRuleText(alias)).replace(/\\ /g, '\\s+');
}

function evidence(
  canonical: string,
  kind: ExactEntityKind,
  matchedAlias: string,
): ExactEntityEvidence {
  return { canonical, kind, matched_alias: matchedAlias };
}

export function exactEmployerEvidence(text: unknown) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const normalized = normalizeRuleText(text);
  const matches: ExactEntityEvidence[] = [];
  for (const company of KNOWN_COMPANIES) {
    for (const alias of companyAliases(company)) {
      const entity = exactAliasPattern(alias);
      const patterns = [
        new RegExp(`(?:^|\\s)ex\\s+${entity}(?:$|\\s)`),
        new RegExp(`(?:^|\\s)${entity}\\s+alumn(?:i|us|a)(?:$|\\s)`),
        new RegExp(
          `(?:former|formerly|previously|previous roles|worked|experience)[a-z0-9\\s]{0,90}(?:at|with|of)\\s+${entity}(?:$|\\s)`,
        ),
        new RegExp(`(?:^|\\s)left\\s+${entity}(?:$|\\s)`),
      ];
      if (patterns.some((pattern) => pattern.test(normalized))) {
        matches.push(evidence(company, 'employer', alias));
        break;
      }
    }
  }
  return matches;
}

export function exactInstitutionEvidence(text: unknown) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const normalized = normalizeRuleText(text);
  const segments = text
    .split(/[·|;\n]/)
    .map(normalizeRuleText)
    .filter(Boolean);
  const matches: ExactEntityEvidence[] = [];
  for (const institution of KNOWN_INSTITUTIONS) {
    for (const alias of institutionAliases(institution)) {
      const entity = exactAliasPattern(alias);
      const patterns = [
        new RegExp(`^${entity}$`),
        new RegExp(
          `(?:studied|postdoc|coursework|researcher|candidate|graduate|graduated|degree|phd|mba|msc|bsc|alumn(?:i|us|a))\\s+(?:at|from|of|in)?\\s*${entity}(?:$|\\s)`,
        ),
        new RegExp(
          `(?:^|\\s)${entity}[a-z0-9\\s]{0,30}\\s(?:graduate|alumn(?:i|us|a)|phd|mba|msc|bsc|bs|ms|meng|coursework|research|dropout)(?:$|\\s)`,
        ),
      ];
      const exactSegment = segments.some(
        (segment) => segment === normalizeRuleText(alias),
      );
      if (
        exactSegment ||
        patterns.some((pattern) => pattern.test(normalized))
      ) {
        matches.push(evidence(institution, 'institution', alias));
        break;
      }
    }
  }
  return matches;
}
