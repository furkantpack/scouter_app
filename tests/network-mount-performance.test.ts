import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const view = readFileSync(
  new URL('../components/network-mode-view.tsx', import.meta.url),
  'utf8',
);
const fundingRoute = readFileSync(
  new URL('../app/api/network/funding/route.ts', import.meta.url),
  'utf8',
);

test('Network mount opens the first funding tab without an automatic provider request', () => {
  assert.match(
    view,
    /useState<'company' \| 'funding'>\('funding'\)/,
  );
  assert.match(view, /useEffect\(\(\) => \{[\s\S]*?void load\(initialRunId\);[\s\S]*?\}, \[initialRunId\]\);/);
  assert.doesNotMatch(
    view,
    /useEffect\(\(\) => \{[\s\S]*?\/api\/network\/funding[\s\S]*?\}, \[entryMode\]\);/,
  );
});

test('Funding discovery makes one guarded request only after an explicit user action', () => {
  assert.match(view, /onClick=\{openFunding\}/);
  assert.match(view, /function openFunding\(\) \{[\s\S]*?setEntryMode\('funding'\);[\s\S]*?loadFunding\(new URLSearchParams\('sort=newest'\)\)/);
  assert.match(view, /if \(fundingRequestInFlight\.current\) return;/);
  assert.match(view, /fundingRequestInFlight\.current = true;/);
  assert.match(view, /fundingRequestInFlight\.current = false;/);
  assert.equal(
    Array.from(
      view.matchAll(
        /requestJson<FundingResponse>\(`\/api\/network\/funding\?\$\{params\}`\)/g,
      ),
    ).length,
    1,
  );
});

test('Funding provider errors remain sanitized by the API and isolated from history loading', () => {
  assert.match(fundingRoute, /if \(error instanceof TechEuError\)/);
  assert.match(
    fundingRoute,
    /Funding feed temporarily unavailable\. Please try again shortly\./,
  );
  assert.match(view, /Funding feed temporarily unavailable\./);
  assert.match(view, /await requestJson<Response>\([\s\S]*?`\/api\/network/);
});
