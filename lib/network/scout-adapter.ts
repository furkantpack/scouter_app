import 'server-only';
import type { NetworkCandidate, NetworkReferenceProfile } from './types';

type ScoutResponse = { candidates?: NetworkCandidate[]; results?: NetworkCandidate[] };

export async function discoverWithScout(reference: NetworkReferenceProfile, limit = 20) {
  const bridge = process.env.SCOUT_BRIDGE_URL;
  if (!bridge) return { candidates: [] as NetworkCandidate[], method: 'unavailable' as const };
  const response = await fetch(bridge, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      thesis: reference.search_thesis,
      limit,
      sources: ['github', 'hackernews', 'arxiv'],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Scout bridge failed (${response.status}).`);
  const body = await response.json() as ScoutResponse;
  const candidates = (body.candidates || body.results || []).slice(0, limit).map((candidate) => ({
    ...candidate,
    founderId: candidate.founderId || null,
    sourceMix: Array.from(new Set([...(candidate.sourceMix || []), 'scout' as const])),
  }));
  return { candidates, method: 'http_bridge' as const };
}

