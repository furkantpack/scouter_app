import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  fundedPageEnabled,
  isFundedPagePath,
} from '../lib/funded-page-visibility.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('funded index remains implemented but is server-gated and hidden', () => {
  assert.equal(
    existsSync(new URL('../app/(main)/funded/page.tsx', import.meta.url)),
    true,
  );
  assert.equal(
    existsSync(new URL('../app/(main)/funded/[id]/page.tsx', import.meta.url)),
    true,
  );
  assert.doesNotMatch(read('../components/sidebar.tsx'), /href: '\/funded'/);
  assert.doesNotMatch(
    read('../components/search.tsx'),
    /navigate\('\/funded'\)/,
  );
  assert.match(
    read('../app/(main)/funded/page.tsx'),
    /if \(!fundedPageEnabled\(\)\) notFound\(\)/,
  );
  assert.doesNotMatch(
    read('../app/(main)/funded/[id]/page.tsx'),
    /fundedPageEnabled|notFound/,
  );
  const middleware = read('../middleware.ts');
  assert.match(middleware, /isFundedPagePath\(request\.nextUrl\.pathname\)/);
  assert.match(middleware, /!fundedPageEnabled\(\)/);
  assert.match(middleware, /status: 404/);
});

test('funded page visibility defaults off and never covers its API', () => {
  const previous = process.env.ENABLE_FUNDED_PAGE;
  delete process.env.ENABLE_FUNDED_PAGE;
  assert.equal(fundedPageEnabled(), false);
  process.env.ENABLE_FUNDED_PAGE = 'true';
  assert.equal(fundedPageEnabled(), true);
  if (previous === undefined) delete process.env.ENABLE_FUNDED_PAGE;
  else process.env.ENABLE_FUNDED_PAGE = previous;

  assert.equal(isFundedPagePath('/funded'), true);
  assert.equal(isFundedPagePath('/funded/'), true);
  assert.equal(isFundedPagePath('/funded/company-id'), false);
  assert.equal(isFundedPagePath('/api/funded'), false);
  assert.equal(isFundedPagePath('/portfolio'), false);
});
