export const CANONICAL_PORTFOLIO_PATH = '/portfolio';

export function canonicalizePortfolioPath(pathname: string) {
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const legacyMatch = decodedPathname.match(/^\/portföy(?=\/|$)/i);
  if (!legacyMatch) return null;
  return decodedPathname.replace(legacyMatch[0], CANONICAL_PORTFOLIO_PATH);
}
