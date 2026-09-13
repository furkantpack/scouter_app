import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL(
    '../supabase/migrations/202609130003_founder_profile_anon_lockdown.sql',
    import.meta.url,
  ),
  'utf8',
);

test('founder profile rejects anonymous access without removing intended reads', () => {
  assert.match(
    sql,
    /alter view public\.founder_profile\s+set \(security_invoker = true\)/i,
  );
  assert.match(
    sql,
    /revoke all privileges on table public\.founder_profile from public/i,
  );
  assert.match(
    sql,
    /revoke all privileges on table public\.founder_profile from anon/i,
  );
  assert.match(
    sql,
    /grant select on table public\.founder_profile to authenticated/i,
  );
  assert.match(
    sql,
    /grant select on table public\.founder_profile to service_role/i,
  );
  assert.doesNotMatch(sql, /founder_product_profile/i);
  assert.doesNotMatch(sql, /create policy|drop policy|alter table/i);
});
