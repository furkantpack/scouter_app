create table if not exists public.network_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  input_fingerprint text not null,
  input jsonb not null default '{}'::jsonb,
  reference_company jsonb not null default '{}'::jsonb,
  reference_evidence jsonb not null default '[]'::jsonb,
  reference_profile jsonb,
  search_thesis jsonb,
  status text not null default 'queued' check (status in ('queued','building_reference','sourcing','enriching','scoring','ready','failed')),
  metrics jsonb not null default '{}'::jsonb,
  error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists network_runs_one_active_reference
  on public.network_runs (organization_id, input_fingerprint)
  where status in ('queued','building_reference','sourcing','enriching','scoring');
create index if not exists network_runs_org_created on public.network_runs (organization_id, created_at desc);

create table if not exists public.network_candidates (
  id uuid primary key default gen_random_uuid(),
  network_run_id uuid not null references public.network_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  founder_id uuid references public.founders(id) on delete set null,
  external_identity jsonb,
  founder_name text not null,
  current_company text,
  current_role text,
  founder_state text not null check (founder_state in ('Founder Now','Founder Formation','Future Founder','Noise')),
  source_mix text[] not null default '{}',
  scouter_score numeric,
  network_match numeric not null check (network_match between 0 and 100),
  score_breakdown jsonb not null,
  why_now text not null,
  match_reasons jsonb not null default '[]'::jsonb,
  pattern_match_summary text not null,
  key_difference text,
  visibility text not null check (visibility in ('very_low','low','emerging','visible')),
  risks jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  rank integer not null check (rank between 1 and 10),
  created_at timestamptz not null default now(),
  unique (network_run_id, rank)
);

create index if not exists network_candidates_run_rank on public.network_candidates (network_run_id, rank);
create index if not exists network_candidates_org on public.network_candidates (organization_id);

alter table public.network_runs enable row level security;
alter table public.network_candidates enable row level security;

drop policy if exists "network_runs_org_select" on public.network_runs;
create policy "network_runs_org_select" on public.network_runs for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = network_runs.organization_id and m.user_id = auth.uid() and m.status = 'active'));
drop policy if exists "network_runs_org_insert" on public.network_runs;
create policy "network_runs_org_insert" on public.network_runs for insert to authenticated
with check (created_by = auth.uid() and exists (select 1 from public.organization_members m where m.organization_id = network_runs.organization_id and m.user_id = auth.uid() and m.status = 'active'));
drop policy if exists "network_runs_org_update" on public.network_runs;
create policy "network_runs_org_update" on public.network_runs for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = network_runs.organization_id and m.user_id = auth.uid() and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = network_runs.organization_id and m.user_id = auth.uid() and m.status = 'active'));

drop policy if exists "network_candidates_org_select" on public.network_candidates;
create policy "network_candidates_org_select" on public.network_candidates for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = network_candidates.organization_id and m.user_id = auth.uid() and m.status = 'active'));
drop policy if exists "network_candidates_org_insert" on public.network_candidates;
create policy "network_candidates_org_insert" on public.network_candidates for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = network_candidates.organization_id and m.user_id = auth.uid() and m.status = 'active'));

revoke all on public.network_runs from anon;
revoke all on public.network_candidates from anon;
grant select, insert, update on public.network_runs to authenticated;
grant select, insert on public.network_candidates to authenticated;

