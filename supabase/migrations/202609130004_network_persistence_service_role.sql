drop policy if exists "network_runs_org_insert" on public.network_runs;
drop policy if exists "network_runs_org_update" on public.network_runs;
drop policy if exists "network_candidates_org_insert" on public.network_candidates;

revoke all privileges on table public.network_runs from public;
revoke all privileges on table public.network_runs from anon;
revoke all privileges on table public.network_runs from authenticated;

revoke all privileges on table public.network_candidates from public;
revoke all privileges on table public.network_candidates from anon;
revoke all privileges on table public.network_candidates from authenticated;

grant select on table public.network_runs to authenticated;
grant select on table public.network_candidates to authenticated;

grant select, insert, update, delete on table public.network_runs to service_role;
grant select, insert, update, delete on table public.network_candidates to service_role;
