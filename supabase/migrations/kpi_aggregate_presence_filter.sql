-- Parité KPI serveur/client (montée en charge) — filtre de présence sur l'effectif.
-- Appliquée en prod via Supabase MCP. Fonctions non branchées à l'app tant que le
-- drapeau KPI_SERVER_AGG est off ; ce correctif prépare son activation.
--
-- Le client (buildKS, js/01-core.js) ne compte QUE les consultants présents sur la
-- fenêtre (un futur arrivant / un parti hors période est exclu). L'agrégat serveur,
-- lui, comptait TOUS les consultants → l'effectif nCons divergeait dès qu'une
-- entreprise avait un futur arrivant. Les autres agrégats (CA, staffing, marge,
-- coût, contribution) sont insensibles : un consultant hors période contribue 0.
--
-- On aligne donc le périmètre au niveau du wrapper qui lit les tables (la logique
-- d'agrégat pure konsilys_company_kpis_agg reste intacte et testée par parité).
create or replace function public.konsilys_company_kpis_range(
  p_win_start date, p_win_end date, p_fy_start date, p_fy_end date
) returns jsonb language sql stable security definer set search_path = public as $$
  select public.konsilys_company_kpis_agg(
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'scr', scr, 'contract', contract,
        'arrive', arrive, 'depart', depart, 'bu_id', bu_id))
      from public.consultants
      where company_id = public.my_company_id()
        and (arrive is null or arrive <= p_win_end)     -- pas encore arrivé après la fin de fenêtre
        and (depart is null or depart >= p_win_start)   -- ni parti avant le début → présent sur la fenêtre
      ), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('cid', consultant_id, 'sd', start_date, 'ed', end_date,
        'tjm', tjm, 'btype', billing_type, 'wmode', wmode, 'wdays', to_jsonb(work_days),
        'manual_days', case when manual_days is null or manual_days = '' then '[]'::jsonb
                            when left(manual_days, 1) = '[' then manual_days::jsonb
                            else to_jsonb(string_to_array(manual_days, ',')) end,
        'deal', deal_amount))
      from public.missions where company_id = public.my_company_id()), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('cid', consultant_id, 's', start_date, 'e', end_date, 'type', type))
      from public.leaves where company_id = public.my_company_id()), '[]'::jsonb),
    p_win_start, p_win_end, public.konsilys_working_days(p_fy_start, p_fy_end)
  );
$$;
