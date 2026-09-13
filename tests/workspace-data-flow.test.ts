import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const context = read('../contexts/organization-context.tsx');
const hook = read('../hooks/use-product-data.ts');
const listPage = read('../app/(main)/lists/[id]/page.tsx');

test('workspace context starts once and does not refresh for every pathname', () => {
  assert.match(context, /const started = React\.useRef\(false\)/);
  assert.match(context, /if \(started\.current\) return/);
  assert.match(context, /started\.current = true/);
});

test('product GET starts independently and depends on stable workspace scope', () => {
  assert.match(hook, /const \{\s*dataScope\s*\} = useWorkspace\(\)/);
  assert.doesNotMatch(hook, /workspaceLoading/);
  assert.doesNotMatch(hook, /\[[\s\S]*membership[\s\S]*\]/);
  assert.match(hook, /requestIdentity:\s*`product:\$\{dataScope\}`/);
});

test('same resolved user and organization do not advance product scope', () => {
  assert.match(
    context,
    /hasResolved\.current && resolvedIdentity\.current !== nextIdentity/,
  );
  assert.match(context, /next\.membership\?\.organization_id/);
});

test('Lists detail has one logical product data subscription', () => {
  assert.equal((listPage.match(/useProductData</g) || []).length, 1);
});
