export type PortfolioCompanyIdentity = {
  name: string | null;
  url: string | null;
};

export type CanonicalCompanyIdentity = {
  id: string;
  name: string | null;
  url: string | null;
};

export type CompanyResolution =
  | {
      status: 'resolved';
      company: CanonicalCompanyIdentity;
      matchedBy: 'domain' | 'url' | 'name';
    }
  | { status: 'unresolved'; company: null; matchedBy: null };

function asUrl(value: string | null | undefined) {
  const clean = value?.trim();
  if (!clean) return null;
  try {
    return new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
  } catch {
    return null;
  }
}

export function normalizeCompanyDomain(value: string | null | undefined) {
  const url = asUrl(value);
  return (
    url?.hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/\.$/, '') || null
  );
}

export function normalizeCompanyUrl(value: string | null | undefined) {
  const url = asUrl(value);
  if (!url) return null;
  const domain = normalizeCompanyDomain(value);
  if (!domain) return null;
  const path = url.pathname.replace(/\/+$/, '') || '';
  return `${domain}${path}`.toLowerCase();
}

export function normalizeCompanyName(value: string | null | undefined) {
  const clean = value?.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return clean ? clean.toLocaleLowerCase('en-US') : null;
}

function uniqueMatch(
  companies: CanonicalCompanyIdentity[],
  predicate: (company: CanonicalCompanyIdentity) => boolean,
) {
  const matches = companies.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

export function resolvePortfolioCompany(
  portfolio: PortfolioCompanyIdentity,
  companies: CanonicalCompanyIdentity[],
): CompanyResolution {
  const domain = normalizeCompanyDomain(portfolio.url);
  if (domain) {
    const company = uniqueMatch(
      companies,
      (candidate) => normalizeCompanyDomain(candidate.url) === domain,
    );
    if (company) return { status: 'resolved', company, matchedBy: 'domain' };
  }

  const normalizedUrl = normalizeCompanyUrl(portfolio.url);
  if (normalizedUrl) {
    const company = uniqueMatch(
      companies,
      (candidate) => normalizeCompanyUrl(candidate.url) === normalizedUrl,
    );
    if (company) return { status: 'resolved', company, matchedBy: 'url' };
  }

  const name = normalizeCompanyName(portfolio.name);
  if (name) {
    const company = uniqueMatch(
      companies,
      (candidate) => normalizeCompanyName(candidate.name) === name,
    );
    if (company) return { status: 'resolved', company, matchedBy: 'name' };
  }

  return { status: 'unresolved', company: null, matchedBy: null };
}

export function isFounderCompanyRole(role: {
  relationship_type?: string | null;
  role_title?: string | null;
}) {
  const relationship = role.relationship_type
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (relationship === 'founder' || relationship === 'cofounder') return true;
  if (relationship) return false;
  return /(?:^|\b)co[-\s]?founder(?:\b|$)|(?:^|\b)founder(?:\b|$)/i.test(
    role.role_title || '',
  );
}

export type CanonicalFounderRole = {
  founder_id: string;
  company_id: string;
  relationship_type?: string | null;
  role_title?: string | null;
};

export type CanonicalFounder = {
  id: string;
  name: string;
  scouter_score: number | null;
};

export function linkCanonicalCompanyFounders(
  resolution: CompanyResolution,
  roles: CanonicalFounderRole[],
  founders: CanonicalFounder[],
) {
  if (resolution.status === 'unresolved')
    return { founderCount: null, founders: [] };

  const founderById = new Map(founders.map((founder) => [founder.id, founder]));
  const linked = roles
    .filter(
      (role) =>
        role.company_id === resolution.company.id && isFounderCompanyRole(role),
    )
    .flatMap((role) => {
      const founder = founderById.get(role.founder_id);
      return founder
        ? [
            {
              id: founder.id,
              name: founder.name,
              role: role.role_title || null,
              scouterScore: founder.scouter_score,
            },
          ]
        : [];
    })
    .filter(
      (founder, index, rows) =>
        rows.findIndex((candidate) => candidate.id === founder.id) === index,
    );

  return { founderCount: linked.length, founders: linked };
}
