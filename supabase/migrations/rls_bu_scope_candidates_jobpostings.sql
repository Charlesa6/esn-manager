-- ══ Cloisonnement BU au niveau base (candidates + job_postings) ══
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Jusqu'ici la RLS n'assurait que l'isolation entreprise (company_id). Le
-- cloisonnement par BU (un gestionnaire/admin ne voit que son unité + ses
-- sous-unités) n'existait que côté app (candVisibleForRole / jobVisibleForRole).
-- On le rend étanche côté Postgres, avec EXACTEMENT la même logique de rôles.
--
-- ⚠ Conséquence : pour un admin/gestionnaire, les lectures RLS (donc S.cands /
-- S.jobs chargés par l'app) ne renvoient plus que son sous-arbre BU — les
-- comptages/KPIs basés dessus reflètent désormais son périmètre (cohérent avec
-- le cloisonnement déjà appliqué à l'affichage). Les autres rôles sont inchangés.

-- Un bu donné est-il dans le périmètre de l'utilisateur courant ?
--   • admin & gestionnaire : oui si target_bu = ma BU ou l'une de ses descendantes
--     (repli permissif si l'utilisateur n'a pas de BU ; une ligne sans BU est
--      masquée, comme candVisibleForRole).
--   • tous les autres rôles (recruteur, super_admin, sales, utilisateur) : oui
--     (inchangé — l'isolation entreprise suffit ; le module/onglet reste géré par l'app).
create or replace function public.bu_in_my_scope(target_bu text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r    text := public.my_role();
  mybu text := public.my_bu_id();
  cid  uuid := public.my_company_id();
begin
  if r is null or r not in ('admin','gestionnaire') then
    return true;                 -- non cloisonné
  end if;
  if mybu is null then
    return true;                 -- manager sans BU : repli permissif
  end if;
  if target_bu is null then
    return false;                -- manager : une fiche sans BU n'est pas dans son périmètre
  end if;
  return exists (
    with recursive sub(id) as (
      select id from public.business_units
        where id = mybu and company_id = cid
      union all
      select b.id from public.business_units b
        join sub on b.parent_id = sub.id
        where b.company_id = cid
    )
    select 1 from sub where id = target_bu
  );
end;
$$;

-- ── candidates : ajout du scope BU en lecture/màj/suppression (insert inchangé) ──
drop policy if exists "company members can view candidates"   on public.candidates;
drop policy if exists "company members can update candidates"  on public.candidates;
drop policy if exists "company members can delete candidates"  on public.candidates;

create policy "company members can view candidates" on public.candidates for select
  using (company_id = public.my_company_id() and public.bu_in_my_scope(bu_id));
create policy "company members can update candidates" on public.candidates for update
  using (company_id = public.my_company_id() and public.bu_in_my_scope(bu_id));
create policy "company members can delete candidates" on public.candidates for delete
  using (company_id = public.my_company_id() and public.bu_in_my_scope(bu_id));

-- ── job_postings : idem (la policy FOR ALL garde WITH CHECK = entreprise seule) ──
drop policy if exists jobpost_all on public.job_postings;
create policy jobpost_all on public.job_postings for all
  using (company_id = public.my_company_id() and public.bu_in_my_scope(bu_id))
  with check (company_id = public.my_company_id());
