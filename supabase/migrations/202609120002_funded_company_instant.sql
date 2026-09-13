create table if not exists public.funded_company_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funded_company_id uuid not null references public.vc_thesis_evidence(id) on delete cascade,
  canonical_company_id uuid references public.companies(id) on delete set null,
  sector text,
  subcategory text,
  business_model text,
  customer_type text,
  product_type text,
  technology_themes text[] not null default '{}',
  market_problem_themes text[] not null default '{}',
  workflow_themes text[] not null default '{}',
  geography text,
  stage text,
  company_maturity text,
  vertical text,
  enterprise_orientation text,
  system_orientation text,
  founder_archetype text,
  software_orientation text,
  reference_tags jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  profile_version text not null,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, funded_company_id)
);

create table if not exists public.funded_company_profile_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funded_company_id uuid not null references public.vc_thesis_evidence(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  weight numeric not null check (weight between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, funded_company_id, tag_id)
);

create index if not exists funded_company_profiles_lookup
  on public.funded_company_profiles (organization_id, funded_company_id);
create index if not exists funded_company_profile_tags_lookup
  on public.funded_company_profile_tags (organization_id, funded_company_id);

alter table public.funded_company_profiles enable row level security;
alter table public.funded_company_profile_tags enable row level security;

drop policy if exists "funded_company_profiles_org_select" on public.funded_company_profiles;
create policy "funded_company_profiles_org_select" on public.funded_company_profiles
for select to authenticated using (exists (
  select 1 from public.organization_members member
  where member.organization_id = funded_company_profiles.organization_id
    and member.user_id = auth.uid() and member.status = 'active'
));

drop policy if exists "funded_company_profile_tags_org_select" on public.funded_company_profile_tags;
create policy "funded_company_profile_tags_org_select" on public.funded_company_profile_tags
for select to authenticated using (exists (
  select 1 from public.organization_members member
  where member.organization_id = funded_company_profile_tags.organization_id
    and member.user_id = auth.uid() and member.status = 'active'
));

revoke all on public.funded_company_profiles from anon, authenticated;
revoke all on public.funded_company_profile_tags from anon, authenticated;
grant select on public.funded_company_profiles to authenticated;
grant select on public.funded_company_profile_tags to authenticated;
