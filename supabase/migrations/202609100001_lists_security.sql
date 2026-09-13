alter table public.lists enable row level security;
alter table public.list_founders enable row level security;

do $$
declare policy_name text;
begin
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'lists'
  loop
    execute format('drop policy %I on public.lists', policy_name);
  end loop;
  for policy_name in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'list_founders'
  loop
    execute format('drop policy %I on public.list_founders', policy_name);
  end loop;
end $$;

create policy "lists_member_select" on public.lists
for select to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = lists.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
  and (lists.visibility <> 'private' or lists.created_by = auth.uid())
);

create policy "lists_creator_insert" on public.lists
for insert to authenticated
with check (
  lists.created_by = auth.uid()
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = lists.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

create policy "lists_creator_update" on public.lists
for update to authenticated
using (
  lists.created_by = auth.uid()
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = lists.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
)
with check (
  lists.created_by = auth.uid()
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = lists.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

create policy "lists_creator_delete" on public.lists
for delete to authenticated
using (
  lists.created_by = auth.uid()
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = lists.organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

create policy "list_founders_visible_select" on public.list_founders
for select to authenticated
using (
  exists (
    select 1
    from public.lists list
    join public.organization_members member
      on member.organization_id = list.organization_id
    where list.id = list_founders.list_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and (list.visibility <> 'private' or list.created_by = auth.uid())
  )
);

create policy "list_founders_creator_insert" on public.list_founders
for insert to authenticated
with check (
  list_founders.added_by = auth.uid()
  and exists (
    select 1
    from public.lists list
    join public.organization_members member
      on member.organization_id = list.organization_id
    where list.id = list_founders.list_id
      and list.created_by = auth.uid()
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

create policy "list_founders_creator_update" on public.list_founders
for update to authenticated
using (
  exists (
    select 1 from public.lists list
    where list.id = list_founders.list_id and list.created_by = auth.uid()
  )
)
with check (
  list_founders.added_by = auth.uid()
  and exists (
    select 1 from public.lists list
    where list.id = list_founders.list_id and list.created_by = auth.uid()
  )
);

create policy "list_founders_creator_delete" on public.list_founders
for delete to authenticated
using (
  exists (
    select 1
    from public.lists list
    join public.organization_members member
      on member.organization_id = list.organization_id
    where list.id = list_founders.list_id
      and list.created_by = auth.uid()
      and member.user_id = auth.uid()
      and member.status = 'active'
  )
);

revoke all on public.lists from anon;
revoke all on public.list_founders from anon;
grant select, insert, update, delete on public.lists to authenticated;
grant select, insert, update, delete on public.list_founders to authenticated;

drop function if exists public.get_shared_list(text);
drop function if exists public.get_shared_list(uuid);

create function public.get_shared_list(p_share_token uuid)
returns table (
  list_name text,
  list_description text,
  founder_name text,
  company_name text,
  founder_role text,
  scouter_score numeric,
  signal_tags text[],
  why_now text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    list.name as list_name,
    list.description as list_description,
    profile.name as founder_name,
    profile.company_name,
    profile.founder_role,
    profile.scouter_score,
    coalesce(tags.signal_tags, '{}'::text[]) as signal_tags,
    profile.timing_label as why_now
  from public.lists list
  join public.list_founders item on item.list_id = list.id
  join public.founder_product_profile profile on profile.id = item.founder_id
  left join lateral (
    select array_agg(tag.tag order by tag.tag) filter (where tag.tag is not null) as signal_tags
    from public.founder_tags founder_tag
    join public.tags tag on tag.id = founder_tag.tag_id
    where founder_tag.founder_id = item.founder_id
  ) tags on true
  where list.visibility = 'public_link'
    and list.share_token = p_share_token;
$$;

revoke all on function public.get_shared_list(uuid) from public;
grant execute on function public.get_shared_list(uuid) to anon, authenticated;
