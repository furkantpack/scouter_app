import 'server-only';
import { createHash } from 'crypto';
import type { SourcePage } from '@/lib/thesis/types';

const HIGH_VALUE = /(?:^|\/)(?:thesis|investment-thesis|strategy|approach|what-we-invest-in|investment|investments|about|portfolio|companies|case|team|people|sectors|focus|manifesto|lets)(?:\/|$|-)/i;
const PORTFOLIO = /(?:^|\/)(?:portfolio|companies|investments|case)(?:\/|$|-)/i;
const LOW_VALUE = /(?:privacy|terms|cookie|legal|login|sign-in|careers?|jobs?|press|media|contact|events?|podcasts?|tag|author|search|news)(?:\/|$|-)/i;
const RELEVANT_EDITORIAL = /investment thesis|how we invest|what we invest|vc fundable|venture strategy|portfolio strategy|founder guide|seed investing/i;
const STAFF_ANNOUNCEMENT = /analyst|associate|principal|partner joins|new hire|welcome.*team/i;

type MapLink = string | { url?: string; title?: string; description?: string };

function key() {
  const value = process.env.FIRECRAWL_API_KEY;
  if (!value) throw new Error('Firecrawl is not configured.');
  return value;
}

async function firecrawl(path: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.firecrawl.dev/v2/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65_000),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(`Firecrawl ${path} failed (${response.status}).`);
  return result;
}

function pageType(url: string) {
  if (PORTFOLIO.test(url)) return 'portfolio';
  if (/thesis|strategy|approach|focus|what-we-invest-in/i.test(url)) return 'thesis';
  if (/about|team/i.test(url)) return 'about';
  if (/sector|industr/i.test(url)) return 'sector';
  if (/manifesto/i.test(url)) return 'manifesto';
  return 'general';
}

function relevance(url: string, source: string) {
  if (url === source || `${url}/` === `${source}/`) return 1;
  if (PORTFOLIO.test(url)) return 0.98;
  if (HIGH_VALUE.test(url)) return 0.9;
  return 0.45;
}

function selectUrls(sourceUrl: string, links: MapLink[]) {
  const root = new URL(sourceUrl);
  const candidates = links.flatMap((link) => {
    const raw = typeof link === 'string' ? link : link.url;
    if (!raw) return [];
    try {
      const url = new URL(raw, sourceUrl);
      url.hash = '';
      if (url.hostname !== root.hostname && !url.hostname.endsWith(`.${root.hostname}`)) return [];
      if (LOW_VALUE.test(url.pathname) || /\.(?:pdf|jpg|jpeg|png|gif|svg|zip)$/i.test(url.pathname)) return [];
      const descriptor = typeof link === 'string' ? '' : `${link.title || ''} ${link.description || ''}`;
      if (STAFF_ANNOUNCEMENT.test(descriptor)) return [];
      if (url.pathname !== '/' && !HIGH_VALUE.test(url.pathname) && !RELEVANT_EDITORIAL.test(descriptor)) return [];
      return [{ url: url.toString().replace(/\/$/, ''), title: typeof link === 'string' ? '' : link.title || '', description: typeof link === 'string' ? '' : link.description || '' }];
    } catch { return []; }
  });
  candidates.push({ url: sourceUrl, title: '', description: '' });
  const unique = Array.from(new Map(candidates.map((item) => [item.url, item])).values());
  return unique
    .sort((left, right) => relevance(right.url, sourceUrl) - relevance(left.url, sourceUrl) || left.url.length - right.url.length)
    .slice(0, 24);
}

export async function collectThesisSources(sourceUrl: string): Promise<SourcePage[]> {
  const mapped = await firecrawl('map', { url: sourceUrl, sitemap: 'include', includeSubdomains: false, ignoreQueryParameters: true, limit: 500, timeout: 60_000 });
  const selected = selectUrls(sourceUrl, Array.isArray(mapped.links) ? mapped.links : []);
  const pages: SourcePage[] = [];
  for (let index = 0; index < selected.length; index += 4) {
    const batch = selected.slice(index, index + 4);
    const scraped = await Promise.all(batch.map(async (candidate) => {
      try {
        const result = await firecrawl('scrape', { url: candidate.url, formats: ['markdown'], onlyMainContent: true, timeout: 45_000 });
        const data = result.data || result;
        const content = typeof data.markdown === 'string' ? data.markdown.trim() : '';
        if (content.length < 120) return null;
        const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
        return {
          url: candidate.url,
          title: String(metadata.title || candidate.title || new URL(candidate.url).pathname || new URL(candidate.url).hostname).slice(0, 300),
          pageType: pageType(candidate.url),
          content: content.slice(0, 30_000),
          crawledAt: new Date().toISOString(),
          relevance: relevance(candidate.url, sourceUrl),
          metadata,
          contentHash: createHash('sha256').update(content).digest('hex'),
        } satisfies SourcePage;
      } catch { return null; }
    }));
    pages.push(...scraped.filter((page): page is SourcePage => page !== null));
  }
  if (!pages.length) throw new Error('No useful investment evidence could be collected from this website.');
  return pages;
}
