-- Time Sheet (CRA) HEBDOMADAIRE par consultant, avec workflow de validation N+1.
-- Un TS = un (company_id, consultant_id, week) où `week` = date du lundi de la
-- semaine ('YYYY-MM-DD'), avec un cycle de vie draft -> submitted -> approved/
-- rejected. `days` (jsonb) fige la catégorie SAISIE par jour (éditable par le
-- consultant, pré-remplie depuis le calendrier). Un jour facturé est imputé sur
-- une mission précise du consultant (lien avec ses missions) :
--   { 'YYYY-MM-DD': 'm:<missionId>' | 'internal' | 'leave' | 'available' }.
-- Appliqué en prod via MCP (apply_migration) — ce fichier est le record.
-- NB : la colonne a d'abord été créée sous le nom `month` (version mensuelle)
-- puis renommée en `week` (migration timesheets_weekly).
create table if not exists public.timesheets (
  id text primary key default (gen_random_uuid())::text,
  company_id uuid not null,
  consultant_id text not null references public.consultants(id) on delete cascade,
  week text not null,
  status text not null default 'draft',
  days jsonb,
  approver_id uuid,
  requester_id uuid,
  submitted_at timestamptz,
  resolved_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (company_id, consultant_id, week)
);

create index if not exists timesheets_company_idx on public.timesheets(company_id);
create index if not exists timesheets_cons_idx on public.timesheets(consultant_id);

alter table public.timesheets enable row level security;

-- Isolation multi-tenant (permissive), calquée sur la table leaves.
create policy ts_select on public.timesheets for select
  using (company_id = ( select my_company_id() ));
create policy ts_insert on public.timesheets for insert
  with check (company_id = ( select my_company_id() ));
create policy ts_update on public.timesheets for update
  using (company_id = ( select my_company_id() ));
create policy ts_delete on public.timesheets for delete
  using (company_id = ( select my_company_id() ));

-- Périmètre BU en lecture (restrictive), identique à bu_scope_leaves.
create policy bu_scope_timesheets on public.timesheets as restrictive for select
  using (bu_consultant_visible(consultant_id));
