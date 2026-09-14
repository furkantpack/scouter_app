import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANONICAL_PORTFOLIO_PATH,
  canonicalizePortfolioPath,
} from '../lib/portfolio-route.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const canonicalPage = read('../app/(main)/portfolio/page.tsx');
const legacyPage = read('../app/(main)/portföy/page.tsx');
const middleware = read('../middleware.ts');
const sidebar = read('../components/sidebar.tsx');
const search = read('../components/search.tsx');
const userButton = read('../components/user-button.tsx');

test('/portfolio is the explicit canonical portfolio page', () => {
  assert.match(canonicalPage, /return <PageProducts portfolio \/>/);
});

test('legacy unicode and encoded URLs redirect permanently to /portfolio', () => {
  assert.equal(CANONICAL_PORTFOLIO_PATH, '/portfolio');
  assert.equal(canonicalizePortfolioPath('/portföy'), '/portfolio');
  assert.equal(canonicalizePortfolioPath('/portf%C3%B6y'), '/portfolio');
  assert.equal(canonicalizePortfolioPath('/portföy/'), '/portfolio/');
  assert.equal(
    canonicalizePortfolioPath('/portf%C3%B6y/notion'),
    '/portfolio/notion',
  );
  assert.equal(canonicalizePortfolioPath('/portfolio'), null);
  assert.match(legacyPage, /permanentRedirect\('\/portfolio'\)/);
  assert.match(middleware, /canonicalizePortfolioPath/);
  assert.match(middleware, /NextResponse\.redirect\(destination, 308\)/);
});

test('portfolio navigation uses only the canonical ASCII route', () => {
  for (const source of [sidebar, search, userButton]) {
    assert.match(source, /\/portfolio/);
    assert.doesNotMatch(source, /portföy|portf%C3%B6y|portfÃ¶y/);
  }
  assert.match(sidebar, /label: 'Portfolio'/);
});

test('broken mojibake portfolio spelling is absent from route sources', () => {
  for (const source of [
    canonicalPage,
    legacyPage,
    middleware,
    sidebar,
    search,
    userButton,
  ]) {
    assert.doesNotMatch(source, /portfÃ¶y/);
  }
});
