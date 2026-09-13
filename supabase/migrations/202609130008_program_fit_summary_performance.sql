create index if not exists founder_program_fits_current_summary
  on public.founder_program_fits (program_id)
  include (program_name, fit_score)
  where is_current = true;

create or replace function public.get_program_fit_summary()
returns table (
  program_id text,
  program_name text,
  scored_founders bigint,
  fit_90_plus bigint,
  average_fit numeric
)
language sql
stable
set search_path = public
as $$
  select
    fit.program_id,
    max(fit.program_name) as program_name,
    count(*) as scored_founders,
    count(*) filter (where fit.fit_score >= 90) as fit_90_plus,
    round(avg(fit.fit_score)::numeric, 1) as average_fit
  from public.founder_program_fits fit
  where fit.is_current = true
  group by fit.program_id
  order by max(fit.program_name);
$$;

revoke all on function public.get_program_fit_summary() from public;
grant execute on function public.get_program_fit_summary() to authenticated;
