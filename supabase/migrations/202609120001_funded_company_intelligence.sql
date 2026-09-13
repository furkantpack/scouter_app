create table if not exists public.funded_company_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  funded_company_id uuid not null references public.vc_thesis_evidence(id) on delete cascade,
  investor_id uuid references public.vc_theses(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed')),
  reference_company_json jsonb not null default '{}'::jsonb,
  original_wedge_json jsonb not null default '{}'::jsonb,
  founder_dna_json jsonb not null default '{}'::jsonb,
  investor_pattern_json jsonb not null default '{}'::jsonb,
  customer_pattern_json jsonb not null default '{}'::jsonb,
  category_evolution_json jsonb not null default '{}'::jsonb,
  value_chain_json jsonb not null default '{}'::jsonb,
  maturity_map_json jsonb not null default '{}'::jsonb,
  historical_validators_json jsonb not null default '[]'::jsonb,
  missing_layers_json jsonb not null default '[]'::jsonb,
  final_insight_json jsonb not null default '{}'::jsonb,
  excluded_candidates_json jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  provider_status jsonb not null default '{}'::jsonb,
  report_markdown text,
  engine_version text not null,
  error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists funded_company_analysis_one_active
  on public.funded_company_analyses (organization_id, funded_company_id)
  where status in ('queued','running');
create index if not exists funded_company_analysis_lookup
  on public.funded_company_analyses (organization_id, funded_company_id, created_at desc);

create table if not exists public.funded_company_candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.funded_company_analyses(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  founder_id uuid references public.founders(id) on delete set null,
  company_id uuid,
  external_identity jsonb,
  founder_name text not null,
  company_name text,
  current_role text,
  source text not null check (source in ('scouter_db','exa','scout','combined')),
  founder_state text not null check (founder_state in ('Founder Now','Founder Formation','Future Founder')),
  pattern_branch text,
  historical_comparable text,
  pattern_match_score numeric not null check (pattern_match_score between 0 and 100),
  component_scores jsonb not null,
  verification_confidence numeric not null check (verification_confidence between 0 and 100),
  scouter_score numeric,
  why_now text not null,
  visibility text not null check (visibility in ('very_low','low','emerging','visible')),
  evidence jsonb not null default '[]'::jsonb,
  red_flags jsonb not null default '[]'::jsonb,
  rank integer not null check (rank > 0),
  created_at timestamptz not null default now(),
  unique (analysis_id, rank)
);

create index if not exists funded_company_candidates_rank
  on public.funded_company_candidates (analysis_id, rank);

create table if not exists public.funded_company_signals (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.funded_company_analyses(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid references public.funded_company_candidates(id) on delete cascade,
  signal_type text not null,
  signal_date timestamptz,
  explanation text not null,
  why_it_matters text not null,
  source_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists funded_company_signals_analysis
  on public.funded_company_signals (analysis_id, signal_date desc nulls last);

alter table public.funded_company_analyses enable row level security;
alter table public.funded_company_candidates enable row level security;
alter table public.funded_company_signals enable row level security;

drop policy if exists "funded_company_analyses_org_select" on public.funded_company_analyses;
create policy "funded_company_analyses_org_select" on public.funded_company_analyses
for select to authenticated using (exists (
  select 1 from public.organization_members member
  where member.organization_id = funded_company_analyses.organization_id
    and member.user_id = auth.uid() and member.status = 'active'
));

drop policy if exists "funded_company_candidates_org_select" on public.funded_company_candidates;
create policy "funded_company_candidates_org_select" on public.funded_company_candidates
for select to authenticated using (exists (
  select 1 from public.organization_members member
  where member.organization_id = funded_company_candidates.organization_id
    and member.user_id = auth.uid() and member.status = 'active'
));

drop policy if exists "funded_company_signals_org_select" on public.funded_company_signals;
create policy "funded_company_signals_org_select" on public.funded_company_signals
for select to authenticated using (exists (
  select 1 from public.organization_members member
  where member.organization_id = funded_company_signals.organization_id
    and member.user_id = auth.uid() and member.status = 'active'
));

revoke all on public.funded_company_analyses from anon, authenticated;
revoke all on public.funded_company_candidates from anon, authenticated;
revoke all on public.funded_company_signals from anon, authenticated;
grant select on public.funded_company_analyses to authenticated;
grant select on public.funded_company_candidates to authenticated;
grant select on public.funded_company_signals to authenticated;
