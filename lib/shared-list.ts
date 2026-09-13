export interface PublicSharedFounder {
  name: string;
  company_name: string | null;
  founder_role: string | null;
  scouter_score: number | null;
  signal_tags: string[];
  why_now: string | null;
}

export interface PublicSharedListRow {
  list_name: string;
  list_description: string | null;
  founder: PublicSharedFounder;
}

export const isShareToken = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const score = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const tags = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 3)
    : [];

export function sanitizeSharedList(data: unknown): PublicSharedListRow[] {
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => {
      const nested = row.founder;
      const founder = nested && typeof nested === 'object'
        ? (nested as Record<string, unknown>)
        : row;
      return {
        list_name: text(row.list_name ?? row.name) || '',
        list_description: text(row.list_description ?? row.description),
        founder: {
          name: text(founder.name ?? founder.founder_name) || '',
          company_name: text(founder.company_name ?? founder.company),
          founder_role: text(founder.founder_role ?? founder.role),
          scouter_score: score(founder.scouter_score ?? founder.score),
          signal_tags: tags(founder.signal_tags),
          why_now: text(founder.why_now ?? founder.timing_label),
        },
      };
    });
}
