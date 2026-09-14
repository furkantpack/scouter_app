import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

const onboardingPage = read('../app/add-product/database-onboarding.tsx');
const onboardingRoute = read('../app/api/onboarding/route.ts');
const organizationRoute = read('../app/api/organizations/route.ts');
const callbackRoute = read('../app/auth/callback/route.ts');
const loginPage = read('../app/(auth)/login/page.tsx');
const registerPage = read('../app/(auth)/register/page.tsx');
const policies = read(
  '../supabase/migrations/202609140001_onboarding_owner_write_policies.sql',
);

test('first workspace is created through the authenticated canonical RPC before onboarding saves', () => {
  assert.match(organizationRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(organizationRoute, /rpc\('create_organization'/);
  assert.match(organizationRoute, /scouter_active_organization/);
  assert.doesNotMatch(organizationRoute, /createAdminClient|service_role/);

  const create = onboardingPage.indexOf(
    'createOnboardingOrganization(name.trim())',
  );
  const refresh = onboardingPage.indexOf('await refresh()', create);
  const save = onboardingPage.indexOf("requestJson('/api/onboarding'", refresh);
  assert.ok(create > -1 && refresh > create && save > refresh);
});

test('Google and email authentication converge on auth continue', () => {
  assert.match(callbackRoute, /\/auth\/continue\?next=/);
  assert.match(loginPage, /\/auth\/continue\?next=/);
  assert.match(registerPage, /\/auth\/continue\?next=/);
});

test('every onboarding write requires an owner or admin membership', () => {
  const post = onboardingRoute.slice(
    onboardingRoute.indexOf('export async function POST'),
  );
  const guard = post.indexOf('requireWorkspaceRole(membership)');
  const answerWrite = post.indexOf("from('onboarding_answers')");
  assert.ok(guard > -1 && answerWrite > guard);
});

test('onboarding RLS permits only authenticated active owner/admin mutations', () => {
  assert.match(policies, /to authenticated/g);
  assert.match(policies, /member\.user_id = auth\.uid\(\)/g);
  assert.match(policies, /member\.status = 'active'/g);
  assert.match(policies, /member\.role in \('owner', 'admin'\)/g);
  assert.match(policies, /answered_by = auth\.uid\(\)/g);
  assert.doesNotMatch(
    policies,
    /to anon|disable row level security|service_role/i,
  );
  assert.doesNotMatch(policies, /grant[^;]*delete/i);
});

test('the original sidebar and preview composition use the current form state', () => {
  const sidebar = read('../app/add-product/sidebar.tsx');
  const preview = read('../app/add-product/preview-card.tsx');
  assert.match(
    onboardingPage,
    /xl:grid-cols-\[minmax\(0,550px\)_minmax\(0,1fr\)\]/,
  );
  assert.match(onboardingPage, /<AddProductSidebar/);
  assert.match(onboardingPage, /<PreviewCard answers=\{preview\}/);
  assert.match(sidebar, /w-\[262px\]/);
  assert.match(sidebar, /Step \{index \+ 1\}\/\{steps\.length\}/);
  assert.match(preview, /add-product-bg-pattern/);
  assert.match(preview, /answers\.organizationName/);
  assert.doesNotMatch(onboardingPage, /investorOnboardingAtom|useAtom/);
});
