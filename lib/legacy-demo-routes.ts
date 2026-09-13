const DEVELOPMENT_ONLY_ROUTE_ROOTS = [
  '/exit-companies',
  '/pages',
];

const CANONICAL_PROFILE_ROUTES = new Set(['/profile/abhi-tanwar']);

function normalizePathname(pathname: string) {
  let decoded = pathname;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Keep the original pathname; malformed URLs should never bypass the gate.
  }

  const normalized = decoded.replace(/\/+$/, '') || '/';
  return normalized.toLowerCase();
}

export function isLegacyDemoRoute(pathname: string) {
  const normalized = normalizePathname(pathname);

  if (
    DEVELOPMENT_ONLY_ROUTE_ROOTS.some(
      (route) => normalized === route || normalized.startsWith(`${route}/`),
    )
  ) {
    return true;
  }

  if (normalized === '/profile' || normalized.startsWith('/profile/')) {
    return !CANONICAL_PROFILE_ROUTES.has(normalized);
  }

  if (normalized === '/dashboard/index.html') {
    return true;
  }

  if (normalized === '/company' || normalized.startsWith('/company/')) {
    return true;
  }

  if (normalized === '/shared' || normalized.startsWith('/shared/')) {
    return true;
  }

  // The portfolio index is backed by /api/funded. Its old slug details are
  // static fixtures and have no verified UUID mapping to a canonical company.
  return normalized.startsWith('/portföy/');
}

export function legacyDemoRoutesEnabled() {
  return process.env.NODE_ENV !== 'production';
}
