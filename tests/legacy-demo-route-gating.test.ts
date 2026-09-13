import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isLegacyDemoRoute } from '../lib/legacy-demo-routes.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const middleware = read('../middleware.ts');
const staticCatchAll = read('../app/[...staticPage]/route.ts');
const exitCompanies = read('../app/(main)/exit-companies/page.tsx');
const portfolioIndex = read('../app/(main)/[workspace]/page.tsx');
const legacyPortfolio = read('../app/(main)/[workspace]/[slug]/page.tsx');
const userButton = read('../components/user-button.tsx');
const sidebar = read('../components/sidebar.tsx');
const founderDrawer = read('../components/founder-preview-drawer.tsx');

test('production demo gate covers every known renderable legacy route', () => {
  for (const pathname of [
    '/exit-companies',
    '/exit-companies/index.html',
    '/pages',
    '/pages/index.html',
    '/profile',
    '/profile/marcus-webb',
    '/profile/danny-chmaytelli',
    '/profile/vadim-axelrod',
    '/portf%C3%B6y/notion',
    '/portföy/stripe',
    '/dashboard/index.html',
    '/company/vercel',
    '/company/vercel/index.html',
    '/shared/person-company-detail.js',
    '/shared/unified-catalyst-theme.css',
  ]) {
    assert.equal(isLegacyDemoRoute(pathname), true, pathname);
  }
});

test('canonical product routes and the API-backed founder profile remain available', () => {
  for (const pathname of [
    '/portf%C3%B6y',
    '/portföy/',
    '/funded',
    '/funded/0f92e4b2-84da-4d31-90dd-79fd92775f60',
    '/network',
    '/thesis',
    '/programs',
    '/lists',
    '/ef',
    '/dashboard',
    '/profile/abhi-tanwar',
  ]) {
    assert.equal(isLegacyDemoRoute(pathname), false, pathname);
  }

  assert.match(portfolioIndex, /return <PageProducts portfolio \/>/);
  assert.match(founderDrawer, /'88264496-cf9f-4423-80fd-067c92fc070d': '\/profile\/abhi-tanwar'/);
});

test('middleware returns a non-indexable production 404 before auth or rendering', () => {
  const gate = middleware.indexOf('isLegacyDemoRoute(request.nextUrl.pathname)');
  const authBypass = middleware.indexOf("request.nextUrl.pathname.startsWith('/api/')");

  assert.ok(gate >= 0 && authBypass > gate);
  assert.match(middleware, /!legacyDemoRoutesEnabled\(\)/);
  assert.match(middleware, /status: 404/);
  assert.match(middleware, /'X-Robots-Tag': 'noindex, nofollow'/);
});

test('legacy server routes have defense-in-depth production notFound gates', () => {
  for (const route of [
    exitCompanies,
    legacyPortfolio,
    read('../app/(main)/pages/page.tsx'),
    read('../app/(main)/profile/marcus-webb/page.tsx'),
    read('../app/(main)/profile/danny-chmaytelli/page.tsx'),
    read('../app/(main)/profile/vadim-axelrod/page.tsx'),
  ]) {
    assert.match(route, /if \(!legacyDemoRoutesEnabled\(\)\) notFound\(\)/);
  }

  assert.match(staticCatchAll, /if \(!legacyDemoRoutesEnabled\(\)\)/);
  assert.match(staticCatchAll, /status: 404/);
});

test('production navigation no longer points to retired demo pages', () => {
  assert.doesNotMatch(userButton, /href=['"]\/profile['"]/);
  assert.doesNotMatch(sidebar, /exit-companies|profile\/marcus-webb/);
  assert.match(sidebar, /label: 'Portfolio', href: '\/portföy'/);
  assert.match(portfolioIndex, /<PageProducts portfolio \/>/);
  assert.match(read('../app/(main)/products/products-page.tsx'), /href: `\/funded\/\$\{company\.id\}`/);
});
