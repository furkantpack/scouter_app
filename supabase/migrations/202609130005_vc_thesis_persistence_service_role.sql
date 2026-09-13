begin;

drop policy if exists "vc_theses_insert" on public.vc_theses;
drop policy if exists "vc_theses_update" on public.vc_theses;
drop policy if exists "vc_theses_delete" on public.vc_theses;

drop policy if exists "thesis_dimensions_write" on public.vc_thesis_dimensions;
drop policy if exists "thesis_evidence_write" on public.vc_thesis_evidence;

revoke all privileges on table public.vc_theses from public;
revoke all privileges on table public.vc_theses from anon;
revoke all privileges on table public.vc_theses from authenticated;
revoke all privileges on table public.vc_theses from service_role;

revoke all privileges on table public.vc_thesis_dimensions from public;
revoke all privileges on table public.vc_thesis_dimensions from anon;
revoke all privileges on table public.vc_thesis_dimensions from authenticated;
revoke all privileges on table public.vc_thesis_dimensions from service_role;

revoke all privileges on table public.vc_thesis_evidence from public;
revoke all privileges on table public.vc_thesis_evidence from anon;
revoke all privileges on table public.vc_thesis_evidence from authenticated;
revoke all privileges on table public.vc_thesis_evidence from service_role;

grant select on table public.vc_theses to authenticated;
grant select on table public.vc_thesis_dimensions to authenticated;
grant select on table public.vc_thesis_evidence to authenticated;

grant select, insert, update, delete on table public.vc_theses to service_role;
grant select, insert, update, delete on table public.vc_thesis_dimensions to service_role;
grant select, insert, update, delete on table public.vc_thesis_evidence to service_role;

commit;
