begin;

create policy "founder_scores_authenticated_current_select"
on public.founder_scores
as permissive
for select
to authenticated
using (is_current = true);

commit;
