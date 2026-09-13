import type { FounderSearchResponse } from '@/lib/founder-search/types';

export const FOUNDER_SEARCH_ENDPOINT = '/api/founder-search';
export const FOUNDER_SEARCH_PAGE_SIZE = 25;

type FounderSearchRequest = (
  url: string,
  init: RequestInit,
) => Promise<FounderSearchResponse>;

export function isFullFounderSearchMode(mode: string) {
  return mode === 'full-search';
}

export function shouldSubmitFounderSearchKey(key: string, shiftKey: boolean) {
  return key === 'Enter' && !shiftKey;
}

export function createFounderSearchClient(request: FounderSearchRequest) {
  let inFlightKey: string | null = null;

  return {
    search(query: string, page = 1, presetId?: string) {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) return null;

      const requestKey = `${presetId || 'free-text'}:${normalizedQuery}:${page}`;
      if (inFlightKey === requestKey) return null;
      inFlightKey = requestKey;

      const pending = request(FOUNDER_SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: normalizedQuery,
          ...(presetId ? { preset_id: presetId } : {}),
          page,
          page_size: FOUNDER_SEARCH_PAGE_SIZE,
        }),
      });

      const clearInFlight = () => {
        if (inFlightKey === requestKey) inFlightKey = null;
      };
      void pending.then(clearInFlight, clearInFlight);
      return pending;
    },
  };
}
