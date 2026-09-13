create or replace function public.get_taxonomy_founders_page(
  p_filter text,
  p_query text default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_filter is null or p_filter <> all (array[
    'big_tech_alumni',
    'fintech_alumni',
    'ai_alumni',
    'saas_alumni',
    'top_consulting',
    'regional_alumni',
    'global_tier_1',
    'technical_tier_1',
    'regional_tier_1',
    'stem_focus',
    'top_mba',
    'sector_ai_ml_infra',
    'sector_fintech',
    'sector_b2b_saas',
    'sector_deeptech',
    'sector_climate',
    'sector_health',
    'sector_defense',
    'sector_consumer',
    'sector_hrtech'
  ]::text[]) then
    raise exception 'Unsupported founder taxonomy filter.' using errcode = '22023';
  end if;
  if p_query is not null and length(p_query) > 100 then
    raise exception 'Founder search query is too long.' using errcode = '22023';
  end if;
  if p_offset < 0 or p_offset > 500000 or p_limit < 1 or p_limit > 50 then
    raise exception 'Invalid founder pagination.' using errcode = '22023';
  end if;

  with matching as materialized (
    select profile.id, profile.name
    from public.founder_filter_flags flags
    join public.founder_product_profile profile
      on profile.id = flags.founder_id
    where case p_filter
      when 'big_tech_alumni' then flags.big_tech_alumni
      when 'fintech_alumni' then flags.fintech_alumni
      when 'ai_alumni' then flags.ai_alumni
      when 'saas_alumni' then flags.saas_alumni
      when 'top_consulting' then flags.top_consulting
      when 'regional_alumni' then flags.regional_alumni
      when 'global_tier_1' then flags.global_tier_1
      when 'technical_tier_1' then flags.technical_tier_1
      when 'regional_tier_1' then flags.regional_tier_1
      when 'stem_focus' then flags.stem_focus
      when 'top_mba' then flags.top_mba
      when 'sector_ai_ml_infra' then flags.sector_ai_ml_infra
      when 'sector_fintech' then flags.sector_fintech
      when 'sector_b2b_saas' then flags.sector_b2b_saas
      when 'sector_deeptech' then flags.sector_deeptech
      when 'sector_climate' then flags.sector_climate
      when 'sector_health' then flags.sector_health
      when 'sector_defense' then flags.sector_defense
      when 'sector_consumer' then flags.sector_consumer
      when 'sector_hrtech' then flags.sector_hrtech
      else false
    end
    and (
      coalesce(p_query, '') = ''
      or profile.name ilike '%' || p_query || '%'
      or profile.company_name ilike '%' || p_query || '%'
      or profile.category_l1 ilike '%' || p_query || '%'
      or profile.founder_role ilike '%' || p_query || '%'
    )
  ),
  page_ids as (
    select id, name
    from matching
    order by name, id
    offset p_offset
    limit p_limit
  )
  select jsonb_build_object(
    'total_count', (select count(*) from matching),
    'founders', coalesce((
      select jsonb_agg(
        to_jsonb(profile) - 'score_confidence'
        order by page_ids.name, page_ids.id
      )
      from page_ids
      join public.founder_product_profile profile
        on profile.id = page_ids.id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_taxonomy_founders_page(text, text, integer, integer)
  from public, anon;
grant execute on function public.get_taxonomy_founders_page(text, text, integer, integer)
  to authenticated, service_role;
