import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  isFounderCompanyRole,
  linkCanonicalCompanyFounders,
  normalizeCompanyDomain,
  normalizeCompanyUrl,
  resolvePortfolioCompany,
  type CanonicalCompanyIdentity,
} from '../lib/portfolio-company-resolution.ts';

const companies: CanonicalCompanyIdentity[] = [
  { id: 'gamma', name: 'Gamma Inc.', url: 'https://www.gamma.app/' },
  { id: 'alpha-product', name: 'Alpha', url: 'https://alpha.test/product/' },
  { id: 'alpha-home', name: 'Alpha Home', url: 'https://alpha.test/' },
  { id: 'name-only', name: 'Canonical Company', url: null },
];

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('www, scheme, trailing slash, and case normalize deterministically', () => {
  assert.equal(normalizeCompanyDomain('HTTP://WWW.Gamma.App/'), 'gamma.app');
  assert.equal(normalizeCompanyUrl('HTTP://WWW.Gamma.App/'), 'gamma.app');
  assert.equal(
    normalizeCompanyUrl('https://gamma.app/product///'),
    'gamma.app/product',
  );
});

test('company resolution prioritizes exact domain then exact URL', () => {
  const domain = resolvePortfolioCompany(
    { name: 'Different display name', url: 'http://gamma.app' },
    companies,
  );
  assert.equal(domain.status, 'resolved');
  assert.equal(domain.matchedBy, 'domain');
  assert.equal(domain.company?.id, 'gamma');

  const url = resolvePortfolioCompany(
    { name: 'Different display name', url: 'https://alpha.test/product' },
    companies,
  );
  assert.equal(url.status, 'resolved');
  assert.equal(url.matchedBy, 'url');
  assert.equal(url.company?.id, 'alpha-product');
});

test('exact normalized name is the safe fallback', () => {
  const result = resolvePortfolioCompany(
    { name: '  CANONICAL   COMPANY ', url: null },
    companies,
  );
  assert.equal(result.status, 'resolved');
  assert.equal(result.matchedBy, 'name');
  assert.equal(result.company?.id, 'name-only');
});

test('fuzzy and ambiguous names never resolve', () => {
  assert.equal(
    resolvePortfolioCompany({ name: 'Canonical', url: null }, companies).status,
    'unresolved',
  );
  assert.equal(
    resolvePortfolioCompany({ name: 'Reap', url: 'https://reap.global' }, [
      { id: 'reap-one', name: 'Reap', url: 'https://getreap.com' },
      { id: 'reap-two', name: 'REAP', url: 'https://reapitnow.ai' },
    ]).status,
    'unresolved',
  );
});

test('only explicit founder and cofounder role semantics are accepted', () => {
  assert.equal(isFounderCompanyRole({ relationship_type: 'founder' }), true);
  assert.equal(isFounderCompanyRole({ relationship_type: 'co-founder' }), true);
  assert.equal(
    isFounderCompanyRole({
      relationship_type: null,
      role_title: 'Co-Founder & CEO',
    }),
    true,
  );
  assert.equal(
    isFounderCompanyRole({
      relationship_type: 'employee',
      role_title: 'Founder',
    }),
    false,
  );
  assert.equal(
    isFounderCompanyRole({
      relationship_type: null,
      role_title: 'Founding Engineer',
    }),
    false,
  );
});

test('unresolved and resolved-with-zero remain distinct', () => {
  assert.deepEqual(
    linkCanonicalCompanyFounders(
      { status: 'unresolved', company: null, matchedBy: null },
      [],
      [],
    ),
    { founderCount: null, founders: [] },
  );
  assert.deepEqual(
    linkCanonicalCompanyFounders(
      { status: 'resolved', company: companies[0], matchedBy: 'domain' },
      [],
      [],
    ),
    { founderCount: 0, founders: [] },
  );
});

test('resolved companies link multiple canonical founders without employees or duplicates', () => {
  const result = linkCanonicalCompanyFounders(
    { status: 'resolved', company: companies[0], matchedBy: 'domain' },
    [
      {
        founder_id: 'one',
        company_id: 'gamma',
        relationship_type: 'founder',
        role_title: 'Founder & CEO',
      },
      {
        founder_id: 'one',
        company_id: 'gamma',
        relationship_type: 'founder',
        role_title: 'Founder',
      },
      {
        founder_id: 'two',
        company_id: 'gamma',
        relationship_type: 'cofounder',
        role_title: 'Co-Founder & CTO',
      },
      {
        founder_id: 'employee',
        company_id: 'gamma',
        relationship_type: 'employee',
        role_title: 'Engineer',
      },
    ],
    [
      { id: 'one', name: 'Ada Founder', scouter_score: 91 },
      { id: 'two', name: 'Grace Founder', scouter_score: null },
      { id: 'employee', name: 'Regular Employee', scouter_score: 99 },
    ],
  );
  assert.equal(result.founderCount, 2);
  assert.deepEqual(
    result.founders.map((founder) => founder.name),
    ['Ada Founder', 'Grace Founder'],
  );
});

test('/portfolio loads canonical roles directly and reuses FounderPreviewDrawer', () => {
  const api = read('../app/api/funded/route.ts');
  const page = read('../app/(main)/products/products-page.tsx');
  assert.match(api, /from\('companies'\)/);
  assert.match(api, /from\('founder_company_roles'\)/);
  assert.match(api, /from\('founder_product_profile'\)/);
  assert.match(api, /companyResolutionStatus: resolution\.status/);
  assert.match(api, /linkCanonicalCompanyFounders/);
  assert.match(page, /FounderPreviewDrawer/);
  assert.match(page, /Exact founders/);
  assert.match(page, /Related founders/);
  assert.doesNotMatch(api, /Firecrawl|Gemini|\bExa\b|\bScout\b/);
});
