begin;

grant select, insert, update on table public.onboarding_answers to authenticated;
grant select, insert, update on table public.organization_onboarding to authenticated;

drop policy if exists "onboarding_answers_active_member_select" on public.onboarding_answers;
create policy "onboarding_answers_active_member_select"
on public.onboarding_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = onboarding_answers.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

drop policy if exists "onboarding_answers_owner_admin_insert" on public.onboarding_answers;
create policy "onboarding_answers_owner_admin_insert"
on public.onboarding_answers
for insert
to authenticated
with check (
  answered_by = auth.uid()
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = onboarding_answers.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  )
);

drop policy if exists "onboarding_answers_owner_admin_update" on public.onboarding_answers;
create policy "onboarding_answers_owner_admin_update"
on public.onboarding_answers
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = onboarding_answers.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  )
)
with check (
  answered_by = auth.uid()
  and exists (
    select 1
    from public.organization_members member
    where member.organization_id = onboarding_answers.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  )
);

drop policy if exists "organization_onboarding_active_member_select" on public.organization_onboarding;
create policy "organization_onboarding_active_member_select"
on public.organization_onboarding
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_onboarding.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

drop policy if exists "organization_onboarding_owner_admin_insert" on public.organization_onboarding;
create policy "organization_onboarding_owner_admin_insert"
on public.organization_onboarding
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_onboarding.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  )
);

drop policy if exists "organization_onboarding_owner_admin_update" on public.organization_onboarding;
create policy "organization_onboarding_owner_admin_update"
on public.organization_onboarding
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_onboarding.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = organization_onboarding.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  )
);

commit;
