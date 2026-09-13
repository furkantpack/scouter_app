begin;

create table if not exists public.product_action_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in (
    'network_analysis',
    'funded_company_analysis',
    'thesis_generation',
    'funded_instant_refresh',
    'cohort_fit_test'
  )),
  resource_key text,
  status text not null default 'active' check (status in (
    'active',
    'completed',
    'failed',
    'partial'
  )),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists product_action_runs_org_active_idx
  on public.product_action_runs (organization_id, action_type, expires_at)
  where status = 'active';

create index if not exists product_action_runs_user_recent_idx
  on public.product_action_runs (user_id, action_type, started_at desc);

create unique index if not exists product_action_runs_resource_active_idx
  on public.product_action_runs (organization_id, action_type, resource_key)
  where status = 'active' and resource_key is not null;

alter table public.product_action_runs enable row level security;
revoke all privileges on table public.product_action_runs from public;
revoke all privileges on table public.product_action_runs from anon, authenticated;
grant select, insert, update, delete on table public.product_action_runs to service_role;

create or replace function public.acquire_product_action_run(
  p_organization_id uuid,
  p_user_id uuid,
  p_action_type text,
  p_resource_key text,
  p_user_cooldown_seconds integer,
  p_organization_cooldown_seconds integer,
  p_max_concurrent_organization integer,
  p_lease_seconds integer
)
returns table (
  allowed boolean,
  action_run_id uuid,
  retry_after_seconds integer,
  reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_retry integer;
  v_active_count integer;
  v_run_id uuid;
begin
  if p_action_type not in (
    'network_analysis',
    'funded_company_analysis',
    'thesis_generation',
    'funded_instant_refresh',
    'cohort_fit_test'
  ) then
    raise exception 'Unsupported product action type';
  end if;
  if p_user_cooldown_seconds < 0
    or p_organization_cooldown_seconds < 0
    or p_max_concurrent_organization < 1
    or p_lease_seconds < 1 then
    raise exception 'Invalid product action throttle configuration';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('product_action_runs:' || p_organization_id::text, 0)
  );

  update public.product_action_runs
  set status = 'failed', completed_at = v_now
  where organization_id = p_organization_id
    and status = 'active'
    and expires_at <= v_now;

  if p_resource_key is not null then
    select greatest(
      1,
      ceil(extract(epoch from (run.expires_at - v_now)))::integer
    )
    into v_retry
    from public.product_action_runs run
    where run.organization_id = p_organization_id
      and run.action_type = p_action_type
      and run.resource_key = p_resource_key
      and run.status = 'active'
      and run.expires_at > v_now
    order by run.expires_at
    limit 1;
    if found then
      return query select false, null::uuid, v_retry, 'resource_active'::text;
      return;
    end if;
  end if;

  select greatest(
    1,
    ceil(extract(epoch from (
      run.started_at
      + make_interval(secs => p_user_cooldown_seconds)
      - v_now
    )))::integer
  )
  into v_retry
  from public.product_action_runs run
  where run.user_id = p_user_id
    and run.action_type = p_action_type
    and run.started_at
      + make_interval(secs => p_user_cooldown_seconds) > v_now
  order by run.started_at desc
  limit 1;
  if found then
    return query select false, null::uuid, v_retry, 'user_cooldown'::text;
    return;
  end if;

  select greatest(
    1,
    ceil(extract(epoch from (
      run.started_at
      + make_interval(secs => p_organization_cooldown_seconds)
      - v_now
    )))::integer
  )
  into v_retry
  from public.product_action_runs run
  where run.organization_id = p_organization_id
    and run.action_type = p_action_type
    and run.started_at
      + make_interval(secs => p_organization_cooldown_seconds) > v_now
  order by run.started_at desc
  limit 1;
  if found then
    return query select false, null::uuid, v_retry, 'organization_cooldown'::text;
    return;
  end if;

  select count(*)::integer
  into v_active_count
  from public.product_action_runs run
  where run.organization_id = p_organization_id
    and run.status = 'active'
    and run.expires_at > v_now;
  if v_active_count >= p_max_concurrent_organization then
    select greatest(
      1,
      ceil(extract(epoch from (min(run.expires_at) - v_now)))::integer
    )
    into v_retry
    from public.product_action_runs run
    where run.organization_id = p_organization_id
      and run.status = 'active'
      and run.expires_at > v_now;
    return query select false, null::uuid, v_retry, 'organization_concurrency'::text;
    return;
  end if;

  insert into public.product_action_runs (
    organization_id,
    user_id,
    action_type,
    resource_key,
    expires_at
  ) values (
    p_organization_id,
    p_user_id,
    p_action_type,
    p_resource_key,
    v_now + make_interval(secs => p_lease_seconds)
  )
  returning id into v_run_id;

  return query select true, v_run_id, 0, null::text;
end;
$$;

revoke all on function public.acquire_product_action_run(
  uuid, uuid, text, text, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.acquire_product_action_run(
  uuid, uuid, text, text, integer, integer, integer, integer
) to service_role;

commit;
