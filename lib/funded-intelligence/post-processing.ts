import type { ReferenceIntelligence } from './types';

type JsonRecord = Record<string, unknown>;
type EvidenceSource = {
  url: string;
  title?: string | null;
  excerpt: string;
  source_type: string;
  source_quality?: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nonEmptyText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function allowedUrls(value: unknown, allowed?: Set<string>) {
  const values = stringArray(value);
  if (!values) return undefined;
  const filtered = allowed ? values.filter((url) => allowed.has(url)) : values;
  return filtered.length ? filtered : undefined;
}

function reconstructLegacySpreadString(value: JsonRecord) {
  const numericKeys = Object.keys(value)
    .filter((key) => /^\d+$/.test(key))
    .map(Number)
    .sort((a, b) => a - b);
  if (!numericKeys.length || numericKeys.some((key, index) => key !== index))
    return undefined;
  const characters = numericKeys.map((key) => value[String(key)]);
  return characters.every(
    (character) => typeof character === 'string' && character.length === 1,
  )
    ? (characters as string[]).join('').trim() || undefined
    : undefined;
}

export function normalizeMissingLayers(
  value: unknown,
  evidenceUrls?: Iterable<string>,
): ReferenceIntelligence['missing_layers'] {
  if (!Array.isArray(value)) return [];
  const allowed = evidenceUrls ? new Set(evidenceUrls) : undefined;

  return value.flatMap((item) => {
    const directText = nonEmptyText(item);
    if (directText) return [{ valuable_missing_layer: directText }];
    const record = asRecord(item);
    if (!record) return [];

    const normalized: ReferenceIntelligence['missing_layers'][number] = {};
    const incumbent = nonEmptyText(record.incumbent);
    const owns = stringArray(record.owns);
    const doesNotOwn = nonEmptyText(record.does_not_own);
    const missingLayer =
      nonEmptyText(record.valuable_missing_layer) ||
      nonEmptyText(record.layer) ||
      reconstructLegacySpreadString(record);
    const archetype = nonEmptyText(record.startup_archetype);
    const urls = allowedUrls(record.source_urls, allowed);
    if (incumbent) normalized.incumbent = incumbent;
    if (owns?.length) normalized.owns = owns;
    if (doesNotOwn) normalized.does_not_own = doesNotOwn;
    if (missingLayer) normalized.valuable_missing_layer = missingLayer;
    if (archetype) normalized.startup_archetype = archetype;
    if (urls?.length) normalized.source_urls = urls;
    return Object.keys(normalized).length ? [normalized] : [];
  });
}

const VALIDATOR_SOURCE_TYPES = new Set([
  'historical_validator',
  'strategic_outcome',
  'category_consolidation',
  'scale_stage_validator',
]);
const TRUSTED_SOURCE_QUALITIES = new Set([
  'FIRST_PARTY_HIGH',
  'PRIMARY_PROFILE',
  'REGISTRY',
  'INVESTOR_SOURCE',
  'REPUTABLE_PRESS',
  'SECONDARY_DATABASE',
]);
const VALIDATOR_PATTERNS: Record<string, string> = {
  historical_validator: 'Comparable company evolution',
  strategic_outcome: 'Strategic partnership or outcome',
  category_consolidation: 'Voice AI category consolidation',
  scale_stage_validator: 'Voice AI scale-stage validation',
};

function isReferenceNameCollision(title: string, referenceName: string) {
  const escaped = referenceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    /\bsonos\b|\bsono motors\b|\bsono international\b/i.test(title) ||
    new RegExp(`^${escaped}(?:\\s|$)`, 'i').test(title)
  );
}

export function recoverHistoricalValidators(
  current: unknown,
  evidence: EvidenceSource[],
  referenceName: string,
): ReferenceIntelligence['historical_validators'] {
  const allowed = new Set(evidence.map((item) => item.url));
  const existing = Array.isArray(current)
    ? current.flatMap((item) => {
        const record = asRecord(item);
        if (!record) return [];
        const name = nonEmptyText(record.name);
        const event = nonEmptyText(record.event);
        const pattern = nonEmptyText(record.pattern);
        const whatItProves = nonEmptyText(record.what_it_proves);
        const similarity = nonEmptyText(record.similarity);
        const urls = allowedUrls(
          record.source_urls ||
            (typeof record.source_url === 'string'
              ? [record.source_url]
              : undefined),
          allowed,
        );
        if (
          !name ||
          !event ||
          !pattern ||
          !whatItProves ||
          !similarity ||
          !['Strong', 'Medium', 'Weak'].includes(similarity) ||
          !urls?.length
        )
          return [];
        return [
          {
            name,
            event,
            pattern,
            similarity: similarity as 'Strong' | 'Medium' | 'Weak',
            what_it_proves: whatItProves,
            source_urls: urls,
          },
        ];
      })
    : [];
  if (existing.length >= 2) return existing.slice(0, 5);

  const recovered = [...existing];
  const usedUrls = new Set(existing.flatMap((item) => item.source_urls));
  for (const source of evidence) {
    const title = nonEmptyText(source.title);
    const excerpt = nonEmptyText(source.excerpt);
    if (
      !title ||
      !excerpt ||
      !source.url ||
      usedUrls.has(source.url) ||
      !VALIDATOR_SOURCE_TYPES.has(source.source_type) ||
      !source.source_quality ||
      !TRUSTED_SOURCE_QUALITIES.has(source.source_quality) ||
      isReferenceNameCollision(title, referenceName)
    )
      continue;
    recovered.push({
      name: title,
      event: title,
      pattern: VALIDATOR_PATTERNS[source.source_type],
      similarity:
        source.source_type === 'category_consolidation' ? 'Strong' : 'Medium',
      what_it_proves: excerpt.slice(0, 500),
      source_urls: [source.url],
    });
    usedUrls.add(source.url);
    if (recovered.length === 5) break;
  }
  return recovered.length >= 2 ? recovered : [];
}
