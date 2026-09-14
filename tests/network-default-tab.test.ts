import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../components/network-mode-view.tsx', import.meta.url),
  'utf8',
);

test('/network opens its first Recent Funding tab by default', () => {
  assert.match(source, /useState<'company' \| 'funding'>\('funding'\)/);
  assert.ok(
    source.indexOf('Recent Funding') < source.indexOf('Analyze Company'),
  );
  assert.match(source, /entryMode === 'funding'/);
});
