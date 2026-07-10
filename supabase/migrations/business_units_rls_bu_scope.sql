-- ══ Cloisonnement par Business Unit (RLS) ══
-- Appliquée en prod via Supabase MCP. Dépend de business_units_table.sql.
--
-- Règle : tout compte rattaché à une BU ne LIT que les données de son unité et de
-- ses sous-unités. Les comptes sans BU (propriétaire au sommet) voient tout. Les
-- lignes non rattachées à une BU (bu_id null) restent visibles de tous : elles ne
-- sont pas encore cloisonnées, on ne les fait donc disparaître de personne.
--
-- Portée : SELECT uniquement (visibilité). Les écritures gardent l'isolation par
-- entreprise existante — on ne peut de toute façon pas modifier une ligne qu'on ne
-- lit pas. Le service_role (Edge Functions) contourne la RLS et n'est pas affecté.
--
-- Rollback : DROP des 4 policies bu_scope_* ci-dessous restaure la visibilité pleine.

-- BU du compte connecté.
create or replace function public.my_bu_id()
returns text language sql stable security definer set search_path = public as $$
  select bu_id from public.profiles where id = auth.uid();
$$;

-- p_bu appartient-il au sous-arbre de p_ancestor (lui-même inclus) ?
-- Remonte la chaîne des parents depuis p_bu ; UNION (dédup) => insensible aux cycles.
create or replace function public.bu_in_subtree(p_bu text, p_ancestor text)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive up as (
    select id, parent_id from public.business_units where id = p_bu
    union
    select b.id, b.parent_id from public.business_units b join up on b.id = up.parent_id
  )
  select exists (select 1 from up where id = p_ancestor);
$$;

-- Visibilité d'une ligne portant directement un bu_id, pour le compte connecté.
create or replace function public.bu_row_visible(row_bu text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.my_bu_id() is null
    or public.my_bu_id() = ''
    or row_bu is null
    or row_bu = ''
    or public.bu_in_subtree(row_bu, public.my_bu_id());
$$;

-- consultants : bu_id porté directement.
drop policy if exists bu_scope_consultants on public.consultants;
create policy bu_scope_consultants on public.consultants
  as restrictive for select
  using (public.bu_row_visible(bu_id));

-- crm_opportunities : bu_id porté directement.
drop policy if exists bu_scope_opportunities on public.crm_opportunities;
create policy bu_scope_opportunities on public.crm_opportunities
  as restrictive for select
  using (public.bu_row_visible(bu_id));

-- missions : pas de bu_id → BU dérivée du consultant rattaché. Les missions
-- orphelines (consultant introuvable) restent visibles.
drop policy if exists bu_scope_missions on public.missions;
create policy bu_scope_missions on public.missions
  as restrictive for select
  using (
    public.my_bu_id() is null or public.my_bu_id() = ''
    or not exists (select 1 from public.consultants c where c.id = missions.consultant_id)
    or exists (select 1 from public.consultants c where c.id = missions.consultant_id and public.bu_row_visible(c.bu_id))
  );

-- leaves : idem, BU dérivée du consultant.
drop policy if exists bu_scope_leaves on public.leaves;
create policy bu_scope_leaves on public.leaves
  as restrictive for select
  using (
    public.my_bu_id() is null or public.my_bu_id() = ''
    or not exists (select 1 from public.consultants c where c.id = leaves.consultant_id)
    or exists (select 1 from public.consultants c where c.id = leaves.consultant_id and public.bu_row_visible(c.bu_id))
  );
