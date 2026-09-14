import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const page = read('../app/(main)/products/products-page.tsx');
const thesisApi = read('../app/api/thesis/route.ts');
const fundedApi = read('../app/api/funded/route.ts');
const generation = read('../lib/thesis/generate.ts');

test('/portfolio reads persisted thesis and portfolio evidence', () => {
  assert.match(page, /\/api\/funded\?page=0&pageSize=100/);
  assert.match(page, /\/api\/thesis/);
  assert.match(fundedApi, /record_type.*portfolio_company/);
  assert.match(thesisApi, /record_type[\s\S]*portfolio_company/);
  assert.match(thesisApi, /from\('engine_jobs'\)/);
  assert.match(
    thesisApi,
    /\.eq\('organization_id', membership!\.organization_id\)/,
  );
});

test('/portfolio reports queue progress without presenting zero as completed data', () => {
  assert.match(page, /\['queued', 'crawling', 'analyzing'\]/);
  assert.match(page, /Building your Portfolio Intelligence/);
  assert.match(page, /value: portfolioBuilding \? '—'/);
  assert.match(
    page,
    /setInterval[\s\S]*reloadThesis\(\)[\s\S]*reloadFunded\(\)/,
  );
  assert.match(
    thesisApi,
    /!\['generation_meta', 'generation_status'\]\.includes\(/,
  );
});

test('/portfolio separates companies, inline thesis detail, and portfolio patterns into tabs', () => {
  assert.match(page, /id: 'Companies', label: 'Companies'/);
  assert.match(page, /id: 'Thesis',[\s\S]*label: 'Thesis'/);
  assert.match(page, /id: 'Patterns', label: 'Patterns'/);
  assert.match(
    page,
    /activeTab === 'Thesis'[\s\S]*Thesis summary[\s\S]*Thesis DNA/,
  );
  assert.match(page, /activeTab === 'Patterns'[\s\S]*Portfolio Patterns/);
  assert.match(page, /activeTab === 'Companies'/);
  assert.doesNotMatch(
    page,
    /thesisOpen|<Modal\.|from '@\/components\/ui\/modal'/,
  );
});

test('portfolio extraction remains asynchronous and persists exact extracted companies', () => {
  assert.match(generation, /collectThesisSources/);
  assert.match(generation, /analyzeThesis/);
  assert.match(generation, /portfolio_companies/);
  assert.match(generation, /record_type: 'portfolio_company'/);
  assert.doesNotMatch(
    page,
    /Firecrawl|Gemini|generateThesis|collectThesisSources/,
  );
  assert.doesNotMatch(
    thesisApi,
    /Firecrawl|Gemini|generateThesis|collectThesisSources/,
  );
  assert.doesNotMatch(
    fundedApi,
    /Firecrawl|Gemini|generateThesis|collectThesisSources/,
  );
});
