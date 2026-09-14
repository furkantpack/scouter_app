import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('funded page remains implemented but is hidden from product navigation', () => {
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
});
