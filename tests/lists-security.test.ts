import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isShareToken, sanitizeSharedList } from '../lib/shared-list.ts';

test('public shared-list serialization is an explicit safe-field allowlist', () => {
  const result = sanitizeSharedList([{
    list_name: 'Public founders',
    list_description: 'Safe description',
    organization_id: 'org-secret',
    created_by: 'user-secret',
    share_token: 'token-secret',
    internal_metadata: { secret: true },
    founder: {
      id: 'founder-secret',
      name: 'Ada Founder',
      company_name: 'Safe Co',
      founder_role: 'CEO',
      scouter_score: 91,
      signal_tags: ['Technical', 'Repeat founder', 'Hiring', 'ignored'],
      why_now: 'Recently incorporated',
      founder_notes: [{ body: 'private note' }],
      score_rationale: 'internal rationale',
      raw_research_rationale: 'private research',
      private_evidence: [{ source: 'private' }],
      network_mode: { private: true },
      thesis: { private: true },
    },
  }]);

  assert.deepEqual(result, [{
    list_name: 'Public founders',
    list_description: 'Safe description',
    founder: {
      name: 'Ada Founder',
      company_name: 'Safe Co',
      founder_role: 'CEO',
      scouter_score: 91,
      signal_tags: ['Technical', 'Repeat founder', 'Hiring'],
      why_now: 'Recently incorporated',
    },
  }]);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('rationale'), false);
  assert.equal(JSON.stringify(result).includes('private note'), false);
});

test('share URLs accept only generated UUID tokens', () => {
  assert.equal(isShareToken('55e9a4db-72cf-4d8c-89a5-976e3912ccaf'), true);
  assert.equal(isShareToken('private-list-id'), false);
  assert.equal(isShareToken('../lists/secret'), false);
  assert.equal(isShareToken(''), false);
});

test('Lists RLS migration is creator-only for private data and anonymous writes', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/202609100001_lists_security.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /lists\.visibility <> 'private' or lists\.created_by = auth\.uid\(\)/);
  assert.match(sql, /list\.visibility <> 'private' or list\.created_by = auth\.uid\(\)/);
  assert.match(sql, /create policy "lists_creator_update"[\s\S]*lists\.created_by = auth\.uid\(\)/);
  assert.match(sql, /create policy "lists_creator_delete"[\s\S]*lists\.created_by = auth\.uid\(\)/);
  assert.match(sql, /create policy "list_founders_creator_insert"[\s\S]*list\.created_by = auth\.uid\(\)/);
  assert.match(sql, /create policy "list_founders_creator_delete"[\s\S]*list\.created_by = auth\.uid\(\)/);
  assert.match(sql, /revoke all on public\.lists from anon/);
  assert.match(sql, /revoke all on public\.list_founders from anon/);
});

test('public RPC is token-gated, public-link-only, and returns an explicit column set', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/202609100001_lists_security.sql', import.meta.url),
    'utf8',
  );
  const publicFunction = sql.slice(sql.indexOf('create function public.get_shared_list'));
  assert.match(publicFunction, /p_share_token uuid/);
  assert.match(publicFunction, /list\.visibility = 'public_link'/);
  assert.match(publicFunction, /list\.share_token = p_share_token/);
  assert.doesNotMatch(publicFunction, /select\s+\*/i);
  for (const forbidden of [
    'founder_notes',
    'score_rationale',
    'raw_research_rationale',
    'private_evidence',
    'organization_id',
    'created_by',
    'network_runs',
    'network_candidates',
    'vc_theses',
  ]) {
    assert.equal(publicFunction.includes(forbidden), false, `${forbidden} must not be public`);
  }
});
