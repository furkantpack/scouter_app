alter view public.founder_profile
  set (security_invoker = true);

revoke all privileges on table public.founder_profile from public;
revoke all privileges on table public.founder_profile from anon;

grant select on table public.founder_profile to authenticated;
grant select on table public.founder_profile to service_role;
