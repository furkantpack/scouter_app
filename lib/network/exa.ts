import 'server-only';

import type { NetworkEvidence, NetworkReferenceProfile } from './types';

type ExaResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
};

function apiKey() {
  const value = process.env.EXA_API_KEY;
  if (!value) throw new Error('Exa is not configured.');
  return value;
}

export async function searchExaEvidence(
  query: string,
  numResults: number,
): Promise<NetworkEvidence[]> {
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'content-type': 'application/json' },
    body: JSON.stringify({
      query,
      type: 'auto',
      numResults,
      moderation: true,
      contents: {
        text: { maxCharacters: 4000 },
        highlights: { numSentences: 3 },
        livecrawl: 'preferred',
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Exa search failed (${response.status}).`);
  return ((body?.results || []) as ExaResult[]).flatMap((item) => {
    if (!item.url) return [];
    const excerpt = (item.highlights?.join(' ') || item.text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1800);
    if (!excerpt) return [];
    return [
      {
        source: 'exa' as const,
        url: item.url,
        title: item.title || null,
        excerpt,
        publishedAt: item.publishedDate || null,
      },
    ];
  });
}

export async function referenceEvidence(
  companyName: string,
  companyUrl?: string | null,
  fundingUrl?: string | null,
) {
  const direct: NetworkEvidence[] = [companyUrl, fundingUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => ({
      source: 'user',
      url,
      excerpt: `Reference URL supplied for ${companyName}.`,
    }));
  const queries = [
    `\"${companyName}\" company product founders official`,
    `\"${companyName}\" funding round investors announcement`,
  ];
  const discovered = await Promise.all(
    queries.map((query) => searchExaEvidence(query, 5)),
  );
  return dedupeEvidence([...direct, ...discovered.flat()]).slice(0, 10);
}

export async function discoverWithExa(reference: NetworkReferenceProfile) {
  const sector = reference.company_pattern.sector;
  const technical = reference.company_pattern.technical_theme;
  const archetype =
    reference.founder_pattern.archetypes[0] || 'technical founder';
  const queries = Array.from(
    new Set([
      `new ${sector} founder ${technical} startup`,
      `recently left engineer researcher founder ${sector}`,
      `site:github.com ${technical} founder new company`,
      `researcher launching ${sector} startup`,
      `stealth pre-seed ${sector} ${archetype}`,
      ...reference.search_thesis.semantic_queries.slice(0, 2),
    ]),
  )
    .filter(Boolean)
    .slice(0, 6);
  const batches = await Promise.allSettled(
    queries.map((query) => searchExaEvidence(query, 5)),
  );
  return {
    queries,
    evidence: dedupeEvidence(
      batches.flatMap((batch) =>
        batch.status === 'fulfilled' ? batch.value : [],
      ),
    ).slice(0, 24),
  };
}

export async function discoverFundedCandidatesWithExa(
  reference: NetworkReferenceProfile,
) {
  const sector = reference.company_pattern.sector;
  const technical = reference.company_pattern.technical_theme;
  const archetype =
    reference.founder_pattern.archetypes[0] || 'domain expert founder';
  const queries = Array.from(
    new Set([
      `last 6 months stealth pre-launch founder ${sector} ${technical}`,
      `recently started founder role ${sector} design partners alpha`,
      `recently left ${sector} engineer researcher building startup`,
      `repeat founder prior exit new company ${sector}`,
      `1-10 employees pre-seed ${sector} ${archetype}`,
      `new company formation founding engineer ${technical}`,
      ...reference.search_thesis.semantic_queries.slice(0, 4),
    ]),
  )
    .filter(Boolean)
    .slice(0, 8);
  const batches = await Promise.allSettled(
    queries.map((query) => searchExaEvidence(query, 5)),
  );
  return {
    queries,
    evidence: dedupeEvidence(
      batches.flatMap((batch) =>
        batch.status === 'fulfilled' ? batch.value : [],
      ),
    ).slice(0, 32),
  };
}

function dedupeEvidence(evidence: NetworkEvidence[]) {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = item.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
