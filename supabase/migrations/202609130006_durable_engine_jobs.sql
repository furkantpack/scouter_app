begin;

create table if not exists public.engine_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  engine_type text not null check (engine_type in (
    'network',
    'funded_company_analysis',
    'thesis_generation'
  )),
  resource_key text not null,
  engine_run_id uuid not null,
  action_run_id uuid references public.product_action_runs(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in (
    'queued',
    'running',
    'completed',
    'partial',
    'failed'
  )),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 1 check (max_attempts >= 1),
  lease_owner text,
  lease_expires_at timestamptz not null default (now() + interval '4 hours'),
  heartbeat_at timestamptz,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists engine_jobs_one_active_resource
  on public.engine_jobs (organization_id, engine_type, resource_key)
  where status in ('queued', 'running');

create index if not exists engine_jobs_claim_queue
  on public.engine_jobs (available_at, created_at)
  where status = 'queued';

create index if not exists engine_jobs_expired_lease
  on public.engine_jobs (lease_expires_at)
  where status in ('queued', 'running');

alter table public.engine_jobs enable row level security;
revoke all privileges on table public.engine_jobs from public;
revoke all privileges on table public.engine_jobs from anon;
revoke all privileges on table public.engine_jobs from authenticated;
revoke all privileges on table public.engine_jobs from service_role;
grant select, insert, update, delete on table public.engine_jobs to service_role;

create or replace function public.recover_stale_engine_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_job public.engine_jobs%rowtype;
  v_recovered integer := 0;
  v_generation_id text;
  v_thesis record;
begin
  for v_job in
    update public.engine_jobs
    set
      status = 'failed',
      completed_at = v_now,
      error_code = case
        when status = 'running' then 'worker_lease_expired'
        else 'queue_lease_expired'
      end,
      lease_owner = null,
      heartbeat_at = coalesce(heartbeat_at, v_now),
      updated_at = v_now
    where status in ('queued', 'running')
      and lease_expires_at <= v_now
    returning *
  loop
    v_recovered := v_recovered + 1;

    update public.product_action_runs
    set status = 'failed', completed_at = v_now
    where id = v_job.action_run_id and status = 'active';

    if v_job.engine_type = 'network' then
      update public.network_runs
      set
        status = 'failed',
        error = 'worker_lease_expired',
        completed_at = v_now,
        updated_at = v_now
      where id = v_job.engine_run_id
        and status in ('queued', 'building_reference', 'sourcing', 'enriching', 'scoring');
    elsif v_job.engine_type = 'funded_company_analysis' then
      update public.funded_company_analyses
      set
        status = 'failed',
        error = 'worker_lease_expired',
        completed_at = v_now,
        updated_at = v_now
      where id = v_job.engine_run_id and status in ('queued', 'running');
    elsif v_job.engine_type = 'thesis_generation' then
      v_generation_id := v_job.payload->>'generation_id';
      insert into public.vc_thesis_dimensions (
        thesis_id,
        dimension_type,
        value,
        weight,
        confidence,
        metadata
      ) values (
        v_job.engine_run_id,
        'generation_status',
        'failed',
        1,
        1,
        jsonb_build_object(
          'generation_id', v_generation_id,
          'status', 'failed',
          'error_code', 'worker_lease_expired',
          'recorded_at', v_now
        )
      );
      update public.vc_theses
      set status = 'draft', updated_at = v_now
      where id = v_job.engine_run_id;
    end if;
  end loop;

  update public.network_runs run
  set
    status = 'failed',
    error = 'orphaned_without_durable_job',
    completed_at = v_now,
    updated_at = v_now
  where run.status in ('queued', 'building_reference', 'sourcing', 'enriching', 'scoring')
    and not exists (
      select 1 from public.engine_jobs job
      where job.engine_type = 'network'
        and job.engine_run_id = run.id
        and job.status in ('queued', 'running')
    );

  update public.funded_company_analyses analysis
  set
    status = 'failed',
    error = 'orphaned_without_durable_job',
    completed_at = v_now,
    updated_at = v_now
  where analysis.status in ('queued', 'running')
    and not exists (
      select 1 from public.engine_jobs job
      where job.engine_type = 'funded_company_analysis'
        and job.engine_run_id = analysis.id
        and job.status in ('queued', 'running')
    );

  for v_thesis in
    select
      thesis.id as thesis_id,
      status_row.value as status,
      status_row.metadata->>'generation_id' as generation_id
    from public.vc_theses thesis
    cross join lateral (
      select dimension.value, dimension.metadata
      from public.vc_thesis_dimensions dimension
      where dimension.thesis_id = thesis.id
        and dimension.dimension_type = 'generation_status'
      order by dimension.created_at desc
      limit 1
    ) status_row
    where status_row.value in ('crawling', 'analyzing')
      and not exists (
        select 1 from public.engine_jobs job
        where job.engine_type = 'thesis_generation'
          and job.engine_run_id = thesis.id
          and job.payload->>'generation_id' = status_row.metadata->>'generation_id'
          and job.status in ('queued', 'running')
      )
  loop
    insert into public.vc_thesis_dimensions (
      thesis_id,
      dimension_type,
      value,
      weight,
      confidence,
      metadata
    ) values (
      v_thesis.thesis_id,
      'generation_status',
      'failed',
      1,
      1,
      jsonb_build_object(
        'generation_id', v_thesis.generation_id,
        'status', 'failed',
        'error_code', 'orphaned_without_durable_job',
        'recorded_at', v_now
      )
    );
    update public.vc_theses
    set status = 'draft', updated_at = v_now
    where id = v_thesis.thesis_id;
  end loop;

  return v_recovered;
end;
$$;

create or replace function public.enqueue_network_engine_job(
  p_organization_id uuid,
  p_user_id uuid,
  p_resource_key text,
  p_input jsonb,
  p_reference_company jsonb,
  p_action_run_id uuid
)
returns table (job_id uuid, run_id uuid, reused boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_run_id uuid;
begin
  perform public.recover_stale_engine_jobs();
  perform pg_advisory_xact_lock(hashtextextended(
    'engine_job:network:' || p_organization_id::text || ':' || p_resource_key,
    0
  ));

  select job.id, run.id
  into v_job_id, v_run_id
  from public.engine_jobs job
  join public.network_runs run on run.id = job.engine_run_id
  where job.organization_id = p_organization_id
    and job.engine_type = 'network'
    and job.resource_key = p_resource_key
    and job.status in ('queued', 'running')
    and run.status in ('queued', 'building_reference', 'sourcing', 'enriching', 'scoring')
  order by job.created_at desc
  limit 1;

  if found then
    return query select v_job_id, v_run_id, true;
    return;
  end if;

  insert into public.network_runs (
    organization_id,
    created_by,
    input_fingerprint,
    input,
    reference_company,
    status
  ) values (
    p_organization_id,
    p_user_id,
    p_resource_key,
    p_input,
    p_reference_company,
    'queued'
  ) returning id into v_run_id;

  insert into public.engine_jobs (
    organization_id,
    user_id,
    engine_type,
    resource_key,
    engine_run_id,
    action_run_id,
    payload
  ) values (
    p_organization_id,
    p_user_id,
    'network',
    p_resource_key,
    v_run_id,
    p_action_run_id,
    jsonb_build_object('input', p_input)
  ) returning id into v_job_id;

  update public.product_action_runs
  set expires_at = greatest(expires_at, clock_timestamp() + interval '4 hours')
  where id = p_action_run_id and status = 'active';

  return query select v_job_id, v_run_id, false;
end;
$$;

create or replace function public.enqueue_funded_engine_job(
  p_organization_id uuid,
  p_user_id uuid,
  p_resource_key text,
  p_funded_company_id uuid,
  p_investor_id uuid,
  p_reference jsonb,
  p_engine_version text,
  p_action_run_id uuid
)
returns table (job_id uuid, analysis_id uuid, reused boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_analysis_id uuid;
begin
  perform public.recover_stale_engine_jobs();
  perform pg_advisory_xact_lock(hashtextextended(
    'engine_job:funded:' || p_organization_id::text || ':' || p_resource_key,
    0
  ));

  select job.id, analysis.id
  into v_job_id, v_analysis_id
  from public.engine_jobs job
  join public.funded_company_analyses analysis on analysis.id = job.engine_run_id
  where job.organization_id = p_organization_id
    and job.engine_type = 'funded_company_analysis'
    and job.resource_key = p_resource_key
    and job.status in ('queued', 'running')
    and analysis.status in ('queued', 'running')
  order by job.created_at desc
  limit 1;

  if found then
    return query select v_job_id, v_analysis_id, true;
    return;
  end if;

  insert into public.funded_company_analyses (
    organization_id,
    created_by,
    funded_company_id,
    investor_id,
    status,
    reference_company_json,
    engine_version
  ) values (
    p_organization_id,
    p_user_id,
    p_funded_company_id,
    p_investor_id,
    'queued',
    p_reference,
    p_engine_version
  ) returning id into v_analysis_id;

  insert into public.engine_jobs (
    organization_id,
    user_id,
    engine_type,
    resource_key,
    engine_run_id,
    action_run_id,
    payload
  ) values (
    p_organization_id,
    p_user_id,
    'funded_company_analysis',
    p_resource_key,
    v_analysis_id,
    p_action_run_id,
    jsonb_build_object('reference', p_reference)
  ) returning id into v_job_id;

  update public.product_action_runs
  set expires_at = greatest(expires_at, clock_timestamp() + interval '4 hours')
  where id = p_action_run_id and status = 'active';

  return query select v_job_id, v_analysis_id, false;
end;
$$;

create or replace function public.enqueue_thesis_engine_job(
  p_organization_id uuid,
  p_user_id uuid,
  p_resource_key text,
  p_source_url text,
  p_action_run_id uuid
)
returns table (
  job_id uuid,
  thesis_id uuid,
  generation_id uuid,
  status text,
  reused boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job_id uuid;
  v_thesis_id uuid;
  v_generation_id uuid;
  v_status text;
begin
  perform public.recover_stale_engine_jobs();
  perform pg_advisory_xact_lock(hashtextextended(
    'engine_job:thesis:' || p_organization_id::text || ':' || p_resource_key,
    0
  ));

  select job.id, job.engine_run_id, (job.payload->>'generation_id')::uuid
  into v_job_id, v_thesis_id, v_generation_id
  from public.engine_jobs job
  where job.organization_id = p_organization_id
    and job.engine_type = 'thesis_generation'
    and job.resource_key = p_resource_key
    and job.status in ('queued', 'running')
  order by job.created_at desc
  limit 1;

  if found then
    v_status := 'crawling';
    return query
      select v_job_id, v_thesis_id, v_generation_id, v_status, true;
    return;
  end if;

  select thesis.id
  into v_thesis_id
  from public.vc_theses thesis
  where thesis.organization_id = p_organization_id
    and thesis.source_url = p_source_url
  order by thesis.updated_at desc
  limit 1;

  if v_thesis_id is null then
    insert into public.vc_theses (
      organization_id,
      name,
      source_url,
      status,
      created_by
    ) values (
      p_organization_id,
      regexp_replace(split_part(regexp_replace(p_source_url, '^https?://', ''), '/', 1), '^www\.', ''),
      p_source_url,
      'draft',
      p_user_id
    ) returning id into v_thesis_id;
  else
    update public.vc_theses
    set status = 'draft', updated_at = clock_timestamp()
    where id = v_thesis_id;
  end if;

  v_generation_id := gen_random_uuid();
  insert into public.vc_thesis_dimensions (
    thesis_id,
    dimension_type,
    value,
    weight,
    confidence,
    metadata
  ) values (
    v_thesis_id,
    'generation_status',
    'crawling',
    1,
    1,
    jsonb_build_object(
      'generation_id', v_generation_id,
      'status', 'crawling',
      'recorded_at', clock_timestamp()
    )
  );

  insert into public.engine_jobs (
    organization_id,
    user_id,
    engine_type,
    resource_key,
    engine_run_id,
    action_run_id,
    payload
  ) values (
    p_organization_id,
    p_user_id,
    'thesis_generation',
    p_resource_key,
    v_thesis_id,
    p_action_run_id,
    jsonb_build_object(
      'source_url', p_source_url,
      'generation_id', v_generation_id
    )
  ) returning id into v_job_id;

  update public.product_action_runs
  set expires_at = greatest(expires_at, clock_timestamp() + interval '4 hours')
  where id = p_action_run_id and status = 'active';

  v_status := 'crawling';
  return query
    select v_job_id, v_thesis_id, v_generation_id, v_status, false;
end;
$$;

create or replace function public.claim_engine_jobs(
  p_lease_owner text,
  p_limit integer default 1,
  p_lease_seconds integer default 600
)
returns setof public.engine_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(p_lease_owner), '') is null
    or length(p_lease_owner) > 200
    or p_limit < 1
    or p_limit > 5
    or p_lease_seconds < 60
    or p_lease_seconds > 3600 then
    raise exception 'Invalid engine worker claim configuration';
  end if;

  perform public.recover_stale_engine_jobs();

  return query
  with picked as (
    select job.id
    from public.engine_jobs job
    where job.status = 'queued'
      and job.available_at <= clock_timestamp()
      and job.lease_expires_at > clock_timestamp()
    order by job.available_at, job.created_at
    for update skip locked
    limit p_limit
  )
  update public.engine_jobs job
  set
    status = 'running',
    attempts = job.attempts + 1,
    lease_owner = p_lease_owner,
    lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
    heartbeat_at = clock_timestamp(),
    started_at = coalesce(job.started_at, clock_timestamp()),
    updated_at = clock_timestamp()
  from picked
  where job.id = picked.id
  returning job.*;
end;
$$;

create or replace function public.heartbeat_engine_job(
  p_job_id uuid,
  p_lease_owner text,
  p_lease_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
  v_action_run_id uuid;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'Invalid engine worker heartbeat configuration';
  end if;
  update public.engine_jobs
  set
    heartbeat_at = clock_timestamp(),
    lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
    updated_at = clock_timestamp()
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_lease_owner
  returning action_run_id into v_action_run_id;
  get diagnostics v_updated = row_count;
  if v_updated = 1 and v_action_run_id is not null then
    update public.product_action_runs
    set expires_at = greatest(
      expires_at,
      clock_timestamp() + make_interval(secs => p_lease_seconds)
    )
    where id = v_action_run_id and status = 'active';
  end if;
  return v_updated = 1;
end;
$$;

create or replace function public.finish_engine_job(
  p_job_id uuid,
  p_lease_owner text,
  p_status text,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action_run_id uuid;
  v_updated integer;
begin
  if p_status not in ('completed', 'partial', 'failed') then
    raise exception 'Invalid engine job terminal status';
  end if;

  update public.engine_jobs
  set
    status = p_status,
    completed_at = clock_timestamp(),
    error_code = case when p_status = 'failed' then coalesce(p_error_code, 'engine_failed') else null end,
    lease_owner = null,
    lease_expires_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_lease_owner
  returning action_run_id into v_action_run_id;

  get diagnostics v_updated = row_count;
  if v_updated = 1 and v_action_run_id is not null then
    update public.product_action_runs
    set status = p_status, completed_at = clock_timestamp()
    where id = v_action_run_id and status = 'active';
  end if;
  return v_updated = 1;
end;
$$;

revoke all on function public.recover_stale_engine_jobs() from public, anon, authenticated;
revoke all on function public.enqueue_network_engine_job(uuid, uuid, text, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_funded_engine_job(uuid, uuid, text, uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.enqueue_thesis_engine_job(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_engine_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_engine_job(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.finish_engine_job(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.recover_stale_engine_jobs() to service_role;
grant execute on function public.enqueue_network_engine_job(uuid, uuid, text, jsonb, jsonb, uuid) to service_role;
grant execute on function public.enqueue_funded_engine_job(uuid, uuid, text, uuid, uuid, jsonb, text, uuid) to service_role;
grant execute on function public.enqueue_thesis_engine_job(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.claim_engine_jobs(text, integer, integer) to service_role;
grant execute on function public.heartbeat_engine_job(uuid, text, integer) to service_role;
grant execute on function public.finish_engine_job(uuid, text, text, text) to service_role;

commit;
