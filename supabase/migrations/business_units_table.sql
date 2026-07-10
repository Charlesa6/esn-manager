-- ══ Business Units : table relationnelle (remplace l'arbre JSON company_settings.buTree) ══
-- Appliquée en prod via Supabase MCP. Option « robuste » : l'arbre BU devient une
-- vraie table, ce qui permet un cloisonnement RLS efficace (CTE récursif) — voir
-- business_units_rls_bu_scope.sql. Les ids restent les ids historiques (bu_<ts>_<rand>).

create table if not exists public.business_units (
  id         text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_id  text,                       -- id d'un autre nœud (pas de FK : parenté souple, comme l'ancien JSON)
  name       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_business_units_company on public.business_units(company_id);
create index if not exists idx_business_units_parent  on public.business_units(parent_id);

alter table public.business_units enable row level security;

-- Lecture : tout membre de l'entreprise (nécessaire pour afficher l'arbre partout).
drop policy if exists bu_select on public.business_units;
create policy bu_select on public.business_units for select
  using (company_id = public.my_company_id());

-- Écriture : super_admin / admin de la même entreprise.
drop policy if exists bu_write on public.business_units;
create policy bu_write on public.business_units for all
  using (
    company_id = public.my_company_id()
    and (select role from public.profiles where id = auth.uid()) in ('super_admin','admin')
  )
  with check (
    company_id = public.my_company_id()
    and (select role from public.profiles where id = auth.uid()) in ('super_admin','admin')
  );

-- Migration des données : aplatit company_settings.settings->'buTree' en lignes.
-- Idempotent : ré-exécutable sans doublon.
insert into public.business_units (id, company_id, parent_id, name)
select node->>'id', cs.company_id, nullif(node->>'parentId',''), coalesce(node->>'name','')
from public.company_settings cs
cross join lateral jsonb_array_elements(cs.settings->'buTree') as node
where jsonb_typeof(cs.settings->'buTree') = 'array'
on conflict (id) do nothing;
