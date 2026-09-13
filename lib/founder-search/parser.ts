import 'server-only';

import {
  CAREER_FLAGS,
  EDUCATION_FLAGS,
  fallbackFounderSearchIntent,
  FOUNDER_ARCHETYPES,
  KNOWN_COMPANIES,
  KNOWN_GEOGRAPHIES,
  KNOWN_INSTITUTIONS,
  KNOWN_ROLES,
  KNOWN_TAGS,
  normalizeFounderSearchIntent,
  SECTOR_FLAGS,
  SORT_INTENTS,
  TIMING_SIGNALS,
  VISIBILITY_SIGNALS,
} from '@/lib/founder-search/parser-core';
import type { ParsedFounderSearch } from '@/lib/founder-search/types';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<
  string,
  { expiresAt: number; value: ParsedFounderSearch }
>();

const arraySchema = (values: readonly string[]) => ({
  type: 'ARRAY',
  items: { type: 'STRING', enum: values },
});

const responseSchema = {
  type: 'OBJECT',
  required: [
    'companies',
    'institutions',
    'career_flags',
    'education_flags',
    'sector_flags',
    'tags',
    'geographies',
    'roles',
    'timing_signals',
    'visibility_signals',
    'founder_archetypes',
    'semantic_query',
    'sort_intent',
  ],
  properties: {
    companies: arraySchema(KNOWN_COMPANIES),
    institutions: arraySchema(KNOWN_INSTITUTIONS),
    career_flags: arraySchema(CAREER_FLAGS),
    education_flags: arraySchema(EDUCATION_FLAGS),
    sector_flags: arraySchema(SECTOR_FLAGS),
    tags: arraySchema(KNOWN_TAGS),
    geographies: arraySchema(KNOWN_GEOGRAPHIES),
    roles: arraySchema(KNOWN_ROLES),
    timing_signals: arraySchema(TIMING_SIGNALS),
    visibility_signals: arraySchema(VISIBILITY_SIGNALS),
    founder_archetypes: arraySchema(FOUNDER_ARCHETYPES),
    semantic_query: { type: 'STRING' },
    sort_intent: {
      type: 'STRING',
      enum: [...SORT_INTENTS, 'none'],
    },
  },
};

const systemInstruction = `You are Scouter's founder-search intent parser. Convert one natural-language query into the supplied strict JSON schema. You never select, name, rank, or invent founders. Use only enum values supplied by the schema. Exact prior-employer language such as "ex-Stripe", "Stripe alumni", or "former OpenAI" must populate companies. Exact education names such as "MIT" or "Stanford" must populate institutions. Put broad supported concepts in their matching flag/signal arrays. Keep unsupported or ambiguous concepts in semantic_query. Use "none" when there is no sort intent. Do not browse or call tools.`;

function normalizedCacheKey(query: string) {
  return query.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function setCache(key: string, value: ParsedFounderSearch) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export async function parseFounderSearchQuery(
  query: string,
): Promise<ParsedFounderSearch> {
  const cacheKey = normalizedCacheKey(query);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(cacheKey);

  const fallback: ParsedFounderSearch = {
    ...fallbackFounderSearchIntent(query),
    parser_mode: 'fallback',
  };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    setCache(cacheKey, fallback);
    return fallback;
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: query }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0,
            maxOutputTokens: 1200,
          },
        }),
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = String(
        payload?.error?.message || 'Unknown response',
      ).slice(0, 300);
      throw new Error(`Parser unavailable (${response.status}): ${detail}`);
    }
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('');
    if (!text) throw new Error('Parser returned no intent.');
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (raw.sort_intent === 'none') raw.sort_intent = null;
    const parsed: ParsedFounderSearch = {
      ...normalizeFounderSearchIntent(raw, query),
      parser_mode: 'gemini',
    };
    setCache(cacheKey, parsed);
    return parsed;
  } catch (error) {
    console.warn(
      '[founder-search] Gemini parser unavailable; using fallback.',
      error instanceof Error ? error.message : 'Unknown parser error.',
    );
    setCache(cacheKey, fallback);
    return fallback;
  }
}
