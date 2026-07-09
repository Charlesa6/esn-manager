-- ══ Intégrations externes (connecteurs API) ══
-- Une ligne par (entreprise, provider). Stocke la configuration de connexion
-- (endpoints, identifiants) et l'état du connecteur. TOUTES les écritures passent
-- par l'Edge Function `integrations` (service role) : les secrets ne repartent
-- jamais vers le client (masqués en lecture). Désactivé par défaut (enabled=false)
-- → aucun effet tant que le super_admin n'a pas configuré ET activé un connecteur.
--
-- Catégories : sso_directory (Microsoft/Entra — outils CGI), hr (SIRH),
-- payroll (Paie), billing (Facturation).
--
-- Appliquée en prod via Supabase MCP (apply_migration).

create table if not exists public.company_integrations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  provider     text not null,
  category     text not null,
  enabled      boolean not null default false,
  config       jsonb not null default '{}'::jsonb,
  status       text not null default 'disconnected',
  last_test_at timestamptz,
  last_sync_at timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists company_integrations_company_idx
  on public.company_integrations(company_id);

alter table public.company_integrations enable row level security;

-- Lecture réservée au super_admin de l'entreprise (transparence côté app ; les
-- secrets ne sont de toute façon jamais renvoyés au client par l'Edge Function).
drop policy if exists company_integrations_select on public.company_integrations;
create policy company_integrations_select on public.company_integrations
  for select to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

-- Aucune policy INSERT/UPDATE/DELETE côté client : toutes les écritures passent
-- par l'Edge Function `integrations` (service role, bypass RLS) après contrôle
-- d'authentification et du rôle super_admin.

-- ── Journal des synchronisations (aperçu lecture seule) — même cloisonnement ──
create table if not exists public.integration_logs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  provider    text not null,
  action      text not null,
  ok          boolean not null default true,
  message     text,
  created_at  timestamptz not null default now()
);
create index if not exists integration_logs_company_idx
  on public.integration_logs(company_id, created_at desc);

alter table public.integration_logs enable row level security;
drop policy if exists integration_logs_select on public.integration_logs;
create policy integration_logs_select on public.integration_logs
  for select to authenticated
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');
