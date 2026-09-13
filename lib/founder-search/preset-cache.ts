import type { FounderSearchResponse } from './types.ts';

export const PRESET_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const PRESET_SEARCH_CACHE_MAX = 100;

type CacheEntry = {
  expiresAt: number;
  value: FounderSearchResponse;
};

const presetSearchCache = new Map<string, CacheEntry>();

export function presetSearchCacheKey(
  presetId: string,
  page: number,
  pageSize: number,
) {
  return `${presetId}:${page}:${pageSize}`;
}

export function getPresetSearchCache(
  presetId: string,
  page: number,
  pageSize: number,
  now = Date.now(),
) {
  const key = presetSearchCacheKey(presetId, page, pageSize);
  const cached = presetSearchCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) presetSearchCache.delete(key);
  return null;
}

export function setPresetSearchCache(
  presetId: string,
  page: number,
  pageSize: number,
  value: FounderSearchResponse,
  now = Date.now(),
) {
  if (presetSearchCache.size >= PRESET_SEARCH_CACHE_MAX) {
    const oldest = presetSearchCache.keys().next().value;
    if (oldest) presetSearchCache.delete(oldest);
  }
  presetSearchCache.set(presetSearchCacheKey(presetId, page, pageSize), {
    expiresAt: now + PRESET_SEARCH_CACHE_TTL_MS,
    value,
  });
}
