create or replace function public.replace_founder_program_fits(
  p_founder_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_inserted integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one program fit is required.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) row
    where nullif(row->>'program_id', '') is null
      or nullif(row->>'program_name', '') is null
      or (row->>'founder_id')::uuid <> p_founder_id
  ) then
    raise exception 'Invalid founder program-fit payload.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) row
    group by row->>'program_id'
    having count(*) > 1
  ) then
    raise exception 'Duplicate program IDs are not allowed.';
  end if;

  update public.founder_program_fits
  set is_current = false, superseded_at = v_now
  where founder_id = p_founder_id and is_current = true;

  insert into public.founder_program_fits (
    founder_id,
    company_id,
    program_id,
    program_name,
    fit_score,
    fit_band,
    historical_fit,
    intent_fit,
    market_fit,
    overall_confidence,
    evidence_confidence,
    component_scores,
    top_matches,
    top_gaps,
    warnings,
    sources,
    engine_version,
    engine_as_of,
    calculated_at,
    is_current
  )
  select
    p_founder_id,
    nullif(row->>'company_id', '')::uuid,
    row->>'program_id',
    row->>'program_name',
    (row->>'fit_score')::numeric,
    row->>'fit_band',
    (row->>'historical_fit')::numeric,
    nullif(row->>'intent_fit', '')::numeric,
    nullif(row->>'market_fit', '')::numeric,
    (row->>'overall_confidence')::numeric,
    (row->>'evidence_confidence')::numeric,
    coalesce(row->'component_scores', '{}'::jsonb),
    coalesce(row->'top_matches', '{}'::jsonb),
    coalesce(row->'top_gaps', '{}'::jsonb),
    coalesce(row->'warnings', '[]'::jsonb),
    coalesce(row->'sources', '{}'::jsonb),
    row->>'engine_version',
    nullif(row->>'engine_as_of', '')::date,
    coalesce(nullif(row->>'calculated_at', '')::timestamptz, v_now),
    true
  from jsonb_array_elements(p_rows) row;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.replace_founder_program_fits(uuid, jsonb) from public;
grant execute on function public.replace_founder_program_fits(uuid, jsonb) to service_role;
