-- ══ Modèle de rôles d'animation de compte (Account Operating Model) ═══════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Catalogue de rôles + fiches de poste + seuils, éditable par entreprise.
-- Konsilys fournit un modèle best-practice par défaut (dans le front) ; cette
-- table stocke les personnalisations de l'ESN (un blob JSON par entreprise).

create table if not exists public.account_role_catalog (
  company_id uuid primary key references public.companies(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.account_role_catalog enable row level security;

drop policy if exists role_catalog_rw on public.account_role_catalog;
create policy role_catalog_rw on public.account_role_catalog
  for all
  using  (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
