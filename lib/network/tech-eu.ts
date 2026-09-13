import 'server-only';

import { dedupeAndSortFundingRounds } from './funding-feed';

const BASE_URL = 'https://funding.tech.eu/api/v1';
const PUBLIC_BASE_URL = 'https://funding.tech.eu';
const ATTRIBUTION = 'Tech.eu Funding Explorer';

export class TechEuError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public retries: number,
  ) {
    super(message);
  }
}

export type TechEuRound = {
  id: string;
  url: string;
  date: string | null;
  stage: string | null;
  rawRoundType: string | null;
  amountEur: number | null;
  amountNative: number | null;
  currency: string | null;
  company: {
    id: string;
    name: string;
    country: string | null;
    city: string | null;
    founded: number | null;
    sectors: string[];
  };
  investors: string[];
  source: { domain?: string; tier?: string } | null;
  confidence: string | null;
};

export type TechEuCompany = {
  id: string;
  url: string;
  name: string;
  description: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  founded: number | null;
  sectors: string[];
  totalEur: number | null;
  roundsCount: number;
  rounds: Array<{
    id: string;
    url: string;
    date: string | null;
    stage: string | null;
    amountEur: number | null;
    investors: string[];
  }>;
  investors: string[];
  founders: Array<Record<string, unknown>>;
  exit: unknown;
  signals: unknown;
  source: string;
  methodology: string;
  requestMeta?: { retries: number };
};

export type FundingFilters = {
  dateFrom?: string;
  dateTo?: string;
  country?: string;
  sector?: string;
  stage?: string;
  minAmount?: number;
  cursor?: string;
  sort?: 'newest' | 'largest';
};

function absoluteTechEuUrl(value: string) {
  return new URL(value, PUBLIC_BASE_URL).toString();
}

function retryDelay(response: Response) {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) return 750;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds))
    return Math.min(3_000, Math.max(250, seconds * 1_000));
  const date = Date.parse(retryAfter);
  return Number.isFinite(date)
    ? Math.min(3_000, Math.max(250, date - Date.now()))
    : 750;
}

async function techEuJson<T>(
  path: string,
  params?: URLSearchParams,
): Promise<{ data: T; retries: number }> {
  const url = `${BASE_URL}${path}${params?.size ? `?${params}` : ''}`;
  let retries = 0;
  while (true) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
    } catch (cause) {
      if (retries === 0) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      throw new TechEuError(
        cause instanceof Error && cause.name === 'TimeoutError'
          ? 'Tech.eu request timed out.'
          : 'Tech.eu request failed.',
        null,
        retries,
      );
    }
    if (!response.ok) {
      const transient = response.status === 429 || response.status >= 500;
      if (transient && retries === 0) {
        retries++;
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay(response)),
        );
        continue;
      }
      throw new TechEuError(
        `Tech.eu Funding Explorer request failed (${response.status}).`,
        response.status,
        retries,
      );
    }
    try {
      return { data: (await response.json()) as T, retries };
    } catch {
      throw new TechEuError(
        'Tech.eu returned a malformed response.',
        response.status,
        retries,
      );
    }
  }
}

export async function getTechEuRounds(filters: FundingFilters) {
  const params = new URLSearchParams({ limit: '25' });
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.country) params.set('country', filters.country);
  if (filters.sector) params.set('sector', filters.sector);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.minAmount != null)
    params.set('minAmount', String(filters.minAmount));
  if (filters.cursor) params.set('cursor', filters.cursor);
  const response = await techEuJson<{
    data?: TechEuRound[];
    nextCursor?: string | null;
    count?: number;
    appliedFilters?: Record<string, unknown>;
    source?: string;
    methodology?: string;
  }>('/rounds', params);
  const result = response.data;
  if (!Array.isArray(result?.data))
    throw new TechEuError(
      'Tech.eu returned a malformed funding feed.',
      200,
      response.retries,
    );
  const deduplicated = dedupeAndSortFundingRounds(
    result.data.map((round) => ({
      ...round,
      url: absoluteTechEuUrl(round.url),
    })),
    filters.sort || 'newest',
  );
  return {
    rounds: deduplicated.slice(0, 25),
    nextCursor: result.nextCursor || null,
    count: Number(result.count || 0),
    appliedFilters: result.appliedFilters || {},
    source: result.source || ATTRIBUTION,
    methodology: result.methodology || 'https://funding.tech.eu/methodology',
    retries: response.retries,
  };
}

export async function getTechEuCompany(companyId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(companyId))
    throw new Error('Invalid Tech.eu company id.');
  const response = await techEuJson<TechEuCompany>(
    `/companies/${encodeURIComponent(companyId)}`,
  );
  const company = response.data;
  if (!company?.id || !company?.name)
    throw new Error('Tech.eu returned an incomplete company profile.');
  return { ...company, requestMeta: { retries: response.retries } };
}

export const TECH_EU_ATTRIBUTION = ATTRIBUTION;
