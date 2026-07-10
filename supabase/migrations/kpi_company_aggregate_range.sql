-- Brique 2 (montée en charge) — agrégat KPI entreprise « par fenêtre » (trimestre).
--
-- Subtilité de parité (tKPIs de js/06-kpis.js) : en vue trimestre, tWD/bill/rev
-- sont bornés au trimestre (range override passé à kpi()), MAIS le coût salarial
-- reste proratisé sur les jours ouvrés de l'EXERCICE COMPLET :
--   totSalary = Σ [ freelance ? scr·bill : scr·113.35·1.25·(tWD_fenêtre / fyTotalWD) ]
-- où fyTotalWD = jours ouvrés de l'exercice entier, pas de la fenêtre.
--
-- On généralise donc l'agrégat avec un dénominateur de proratisation explicite
-- (p_salary_fy_wd). Quand il est null, on retombe sur working_days(fenêtre) —
-- donc l'appel « exercice complet » existant reste identique (fenêtre = exercice).

-- Agrégat PUR, fenêtre + dénominateur salaire explicites.
create or replace function public.konsilys_company_kpis_agg(
  p_consultants jsonb, p_missions jsonb, p_leaves jsonb,
  p_win_start date, p_win_end date, p_salary_fy_wd int default null
) returns jsonb language plpgsql immutable as $$
declare
  fy_wd int := coalesce(p_salary_fy_wd, public.konsilys_working_days(p_win_start, p_win_end));
  cc jsonb; cid text; scr numeric; contract text; arrive date; depart date;
  cmiss jsonb; cleaves jsonb; k jsonb;
  tWD int; bill int; rev numeric; sr numeric; om numeric; salary numeric;
  aR numeric:=0; aBill numeric:=0; aTWD numeric:=0; aSrW numeric:=0; aSal numeric:=0;
  aOmSum numeric:=0; aOmN int:=0; aN int:=0;
begin
  for cc in select * from jsonb_array_elements(coalesce(p_consultants,'[]'::jsonb)) loop
    cid := cc->>'id';
    scr := coalesce((cc->>'scr')::numeric, 0);
    contract := coalesce(cc->>'contract', 'salarie');
    arrive := nullif(cc->>'arrive','')::date;
    depart := nullif(cc->>'depart','')::date;
    cmiss := coalesce((select jsonb_agg(m) from jsonb_array_elements(coalesce(p_missions,'[]'::jsonb)) m where m->>'cid' = cid), '[]'::jsonb);
    cleaves := coalesce((select jsonb_agg(l) from jsonb_array_elements(coalesce(p_leaves,'[]'::jsonb)) l where l->>'cid' = cid), '[]'::jsonb);
    k := public.konsilys_kpi_core(scr, contract, arrive, depart, p_win_start, p_win_end, cmiss, cleaves);
    tWD := (k->>'tWD')::int; bill := (k->>'bill')::int; rev := (k->>'rev')::numeric;
    sr := (k->>'sr')::numeric;
    om := case when k->>'om' is null then null else (k->>'om')::numeric end;
    salary := case when contract = 'freelance' then scr * bill
                   else case when fy_wd > 0 then scr * 113.35 * 1.25 * (tWD::numeric / fy_wd) else 0 end end;
    aR := aR + rev; aBill := aBill + bill; aTWD := aTWD + tWD; aSrW := aSrW + sr * tWD; aSal := aSal + salary; aN := aN + 1;
    if om is not null then aOmSum := aOmSum + om; aOmN := aOmN + 1; end if;
  end loop;
  return jsonb_build_object(
    'nCons', aN, 'totR', aR, 'totBill', aBill, 'tWD', aTWD,
    'avgSr', case when aTWD > 0 then aSrW / aTWD else 0 end,
    'avgM', case when aOmN > 0 then aOmSum / aOmN else null end,
    'avgTJM', case when aBill > 0 then aR / aBill else 0 end,
    'totSalary', aSal, 'netC', aR - aSal
  );
end $$;

-- Wrapper « données réelles » générique : fenêtre [p_win_start, p_win_end],
-- proratisation salaire sur l'exercice [p_fy_start, p_fy_end]. Lit les tables de
-- l'entreprise (RLS via my_company_id), SECURITY DEFINER cloisonné.
create or replace function public.konsilys_company_kpis_range(
  p_win_start date, p_win_end date, p_fy_start date, p_fy_end date
) returns jsonb language sql stable security definer set search_path = public as $$
  select public.konsilys_company_kpis_agg(
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'scr', scr, 'contract', contract,
        'arrive', arrive, 'depart', depart, 'bu_id', bu_id))
      from public.consultants where company_id = public.my_company_id()), '[]'::jsonb),
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

-- Wrapper exercice complet (compatibilité) : fenêtre = exercice, dénominateur =
-- exercice → strictement identique à l'ancien konsilys_company_kpis.
create or replace function public.konsilys_company_kpis(p_fy_start date, p_fy_end date)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.konsilys_company_kpis_range(p_fy_start, p_fy_end, p_fy_start, p_fy_end);
$$;

-- L'ancienne signature à 5 arguments n'est plus référencée (les wrappers passent
-- désormais par la 6-arg). On la supprime pour éviter toute surcharge ambiguë.
drop function if exists public.konsilys_company_kpis_agg(jsonb, jsonb, jsonb, date, date);

grant execute on function public.konsilys_company_kpis_range(date, date, date, date) to authenticated;
grant execute on function public.konsilys_company_kpis(date, date) to authenticated;
