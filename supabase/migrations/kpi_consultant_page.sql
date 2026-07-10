-- Brique 2 (montée en charge) — pagination serveur des cartes KPI par consultant.
--
-- Deux fonctions (chacune : version PURE testable + wrapper « données réelles ») :
--   • konsilys_top_clients      — top clients par CA sur la fenêtre (reproduit
--     clientRev() de js/06-kpis.js : somme des CA de mission où jours > 0, par
--     client, tri décroissant). N'exclut PAS le client vide (fidèle au JS).
--   • konsilys_consultant_kpis_page — une page de consultants (filtrés/triés) avec
--     leur KPI complet (via konsilys_kpi_core, pm compris) + total filtré.
--
-- Objectif : sortir le calcul KPI du navigateur pour les gros tenants. Le calcul
-- reste set-based côté serveur ; le navigateur ne reçoit qu'une page.
-- NB : ce premier jet calcule kpi_core pour tous les consultants filtrés (tri par
-- métrique possible). Optimisation ultérieure : ne calculer que la page pour un
-- tri alphabétique, ou s'appuyer sur un snapshot matérialisé.

-- ─────────────────────────── TOP CLIENTS ───────────────────────────
create or replace function public.konsilys_top_clients_agg(
  p_consultants jsonb, p_missions jsonb, p_leaves jsonb,
  p_win_start date, p_win_end date, p_limit int default 3
) returns jsonb language sql immutable as $$
  with cons as (
    select c->>'id' id, coalesce((c->>'scr')::numeric,0) scr, coalesce(c->>'contract','salarie') contract,
           nullif(c->>'arrive','')::date arrive, nullif(c->>'depart','')::date depart
    from jsonb_array_elements(coalesce(p_consultants,'[]'::jsonb)) c
  ),
  k as (
    select public.konsilys_kpi_core(f.scr, f.contract, f.arrive, f.depart, p_win_start, p_win_end,
        coalesce((select jsonb_agg(m) from jsonb_array_elements(coalesce(p_missions,'[]'::jsonb)) m where m->>'cid'=f.id),'[]'::jsonb),
        coalesce((select jsonb_agg(l) from jsonb_array_elements(coalesce(p_leaves,'[]'::jsonb)) l where l->>'cid'=f.id),'[]'::jsonb)
      ) kk
    from cons f
  ),
  pm as (
    select coalesce(pm_el->>'cli','') cli, (pm_el->>'rev')::numeric rev, (pm_el->>'days')::int days
    from k, jsonb_array_elements(k.kk->'pm') pm_el
  ),
  agg as (
    select cli, sum(rev) rev from pm where days > 0 group by cli
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', cli, 'rev', rev) order by rev desc, cli), '[]'::jsonb)
  from (select cli, rev from agg order by rev desc, cli limit greatest(p_limit,0)) t;
$$;

create or replace function public.konsilys_top_clients(
  p_win_start date, p_win_end date, p_limit int default 3
) returns jsonb language sql stable security definer set search_path = public as $$
  select public.konsilys_top_clients_agg(
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'scr', scr, 'contract', contract, 'arrive', arrive, 'depart', depart))
      from public.consultants where company_id = public.my_company_id()), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('cid', consultant_id, 'cli', client_name, 'name', name, 'sd', start_date, 'ed', end_date,
        'tjm', tjm, 'btype', billing_type, 'wmode', wmode, 'wdays', to_jsonb(work_days),
        'manual_days', case when manual_days is null or manual_days = '' then '[]'::jsonb
                            when left(manual_days, 1) = '[' then manual_days::jsonb
                            else to_jsonb(string_to_array(manual_days, ',')) end,
        'deal', deal_amount))
      from public.missions where company_id = public.my_company_id()), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('cid', consultant_id, 's', start_date, 'e', end_date, 'type', type))
      from public.leaves where company_id = public.my_company_id()), '[]'::jsonb),
    p_win_start, p_win_end, p_limit
  );
$$;

-- ───────────────────── PAGE DE CONSULTANTS ─────────────────────
create or replace function public.konsilys_consultant_kpis_page_agg(
  p_consultants jsonb, p_missions jsonb, p_leaves jsonb,
  p_win_start date, p_win_end date,
  p_limit int default 24, p_offset int default 0,
  p_search text default null, p_sort text default 'name', p_dir text default 'asc'
) returns jsonb language sql immutable as $$
  with cons as (
    select c->>'id' id, coalesce(c->>'name','') name, coalesce(c->>'title','') title,
           coalesce((c->>'scr')::numeric,0) scr, coalesce(c->>'contract','salarie') contract,
           nullif(c->>'arrive','')::date arrive, nullif(c->>'depart','')::date depart
    from jsonb_array_elements(coalesce(p_consultants,'[]'::jsonb)) c
  ),
  flt as (
    select * from cons
    where p_search is null or p_search = '' or name ilike '%'||p_search||'%'
  ),
  k as (
    select f.*,
      public.konsilys_kpi_core(f.scr, f.contract, f.arrive, f.depart, p_win_start, p_win_end,
        coalesce((select jsonb_agg(m) from jsonb_array_elements(coalesce(p_missions,'[]'::jsonb)) m where m->>'cid'=f.id),'[]'::jsonb),
        coalesce((select jsonb_agg(l) from jsonb_array_elements(coalesce(p_leaves,'[]'::jsonb)) l where l->>'cid'=f.id),'[]'::jsonb)
      ) kk
    from flt f
  ),
  ord as (
    select *, row_number() over (order by
      case when p_sort='ca'    and p_dir='asc'  then (kk->>'rev')::numeric end asc  nulls last,
      case when p_sort='ca'    and p_dir<>'asc' then (kk->>'rev')::numeric end desc nulls last,
      case when p_sort='sr'    and p_dir='asc'  then (kk->>'sr')::numeric  end asc  nulls last,
      case when p_sort='sr'    and p_dir<>'asc' then (kk->>'sr')::numeric  end desc nulls last,
      case when p_sort='marge' and p_dir='asc'  then (kk->>'om')::numeric  end asc  nulls last,
      case when p_sort='marge' and p_dir<>'asc' then (kk->>'om')::numeric  end desc nulls last,
      case when p_sort='title' and p_dir<>'asc' then lower(title) end desc,
      case when p_sort='title' and p_dir='asc'  then lower(title) end asc,
      case when p_sort='name'  and p_dir<>'asc' then lower(name) end desc,
      lower(name), id
    ) rn
    from k
  )
  select jsonb_build_object(
    'total', (select count(*) from flt),
    'limit', p_limit, 'offset', p_offset, 'sort', p_sort, 'dir', p_dir,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'title', title, 'scr', scr, 'contract', contract,
        'arrive', arrive, 'depart', depart, 'k', kk) order by rn)
      from ord where rn > p_offset and rn <= p_offset + p_limit), '[]'::jsonb)
  );
$$;

create or replace function public.konsilys_consultant_kpis_page(
  p_win_start date, p_win_end date,
  p_limit int default 24, p_offset int default 0,
  p_search text default null, p_sort text default 'name', p_dir text default 'asc'
) returns jsonb language sql stable security definer set search_path = public as $$
  select public.konsilys_consultant_kpis_page_agg(
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'title', title, 'scr', scr,
        'contract', contract, 'arrive', arrive, 'depart', depart))
      from public.consultants where company_id = public.my_company_id()), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('cid', consultant_id, 'cli', client_name, 'name', name, 'sd', start_date, 'ed', end_date,
        'tjm', tjm, 'btype', billing_type, 'wmode', wmode, 'wdays', to_jsonb(work_days),
        'manual_days', case when manual_days is null or manual_days = '' then '[]'::jsonb
                            when left(manual_days, 1) = '[' then manual_days::jsonb
                            else to_jsonb(string_to_array(manual_days, ',')) end,
        'deal', deal_amount))
      from public.missions where company_id = public.my_company_id()), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('cid', consultant_id, 's', start_date, 'e', end_date, 'type', type))
      from public.leaves where company_id = public.my_company_id()), '[]'::jsonb),
    p_win_start, p_win_end, p_limit, p_offset, p_search, p_sort, p_dir
  );
$$;

grant execute on function public.konsilys_top_clients(date, date, int) to authenticated;
grant execute on function public.konsilys_consultant_kpis_page(date, date, int, int, text, text, text) to authenticated;
