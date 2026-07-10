-- Brique 2 (montée en charge) — agrégation KPI entreprise, reproduisant tKPIs()
-- de js/06-kpis.js sur l'exercice complet :
--   avgSr (staffing moyen) = Σ(sr·tWD)/Σ tWD      (moyenne pondérée par jours ouvrés)
--   avgTJM = Σ CA / Σ jours facturés
--   avgM   = moyenne des marges d'occupation (om) des consultants qui en ont une
--   totSalary = Σ [ freelance ? scr·bill : scr·113.35·1.25·(tWD/fyTotalWD) ]
--   netC = Σ CA − totSalary
-- SCR_FACTOR=113.35, EMPLOYER_FACTOR=1.25. Fonctions non branchées à l'app.

-- Agrégat PUR : consultants/missions/congés en jsonb (testable par parité).
create or replace function public.konsilys_company_kpis_agg(
  p_consultants jsonb, p_missions jsonb, p_leaves jsonb, p_fy_start date, p_fy_end date
) returns jsonb language plpgsql immutable as $$
declare
  fy_wd int := public.konsilys_working_days(p_fy_start, p_fy_end);
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
    k := public.konsilys_kpi_core(scr, contract, arrive, depart, p_fy_start, p_fy_end, cmiss, cleaves);
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

-- Wrapper « données réelles » : lit les tables de l'entreprise (RLS via
-- my_company_id) et appelle l'agrégat. SECURITY DEFINER + cloisonné.
-- NB : missions.manual_days est stocké en texte ; parsing best-effort (json ou
-- liste séparée par virgules). À confirmer sur des missions manuelles réelles
-- avant d'activer le drapeau côté app.
create or replace function public.konsilys_company_kpis(p_fy_start date, p_fy_end date)
returns jsonb language sql stable security definer set search_path = public as $$
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
    p_fy_start, p_fy_end
  );
$$;

grant execute on function public.konsilys_company_kpis(date, date) to authenticated;