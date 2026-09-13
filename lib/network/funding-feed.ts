export type FundingFeedRound = {
  id: string;
  date: string | null;
  stage: string | null;
  amountEur: number | null;
  company: { id: string };
};

export function fundingRoundKey(round: FundingFeedRound) {
  return (
    round.id ||
    `${round.company.id}|${round.date || ''}|${round.stage || ''}|${round.amountEur ?? ''}`
  ).toLowerCase();
}

export function dedupeAndSortFundingRounds<T extends FundingFeedRound>(
  rounds: T[],
  sort: 'newest' | 'largest',
) {
  const unique = Array.from(
    new Map(rounds.map((round) => [fundingRoundKey(round), round])).values(),
  );
  return unique.sort(
    sort === 'largest'
      ? (left, right) =>
          (right.amountEur ?? -1) - (left.amountEur ?? -1) ||
          String(right.date || '').localeCompare(String(left.date || ''))
      : (left, right) =>
          String(right.date || '').localeCompare(String(left.date || '')) ||
          (right.amountEur ?? -1) - (left.amountEur ?? -1),
  );
}

export function relativeFundingAge(value: string | null, now = new Date()) {
  if (!value) return 'Freshness unknown';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return 'Freshness unknown';
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dateUtc = Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
  const days = Math.max(0, Math.floor((todayUtc - dateUtc) / 86_400_000));
  if (days === 0) return 'Today';
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  if (days < 56) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
