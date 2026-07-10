-- Brique 2 (montée en charge) — cœur du calcul KPI en SQL, reproduisant kpi()
-- de js/01-core.js. Fonctions PURES (paramétriques : missions/congés en jsonb),
-- non appelées par l'app → testables par parité sans écrire dans les tables.
-- Le facteur charges patronales (EMPLOYER_FACTOR=1.25) et la logique forfait/AT,
-- récurrent/manuel, congés (tous types pour l'exclusion ; hors Inter-contrat pour
-- le staffing) sont reproduits à l'identique.

-- Jours de congé (jours ouvrés) d'un jeu de congés, bornés à [a,b].
-- p_exclude_type : si non nul, exclut ce type (ex : 'Inter-contrat' pour le staffing).
create or replace function public.konsilys_leave_days(p_leaves jsonb, a date, b date, p_exclude_type text default null)
returns date[] language sql immutable as $$
  select coalesce(array_agg(distinct d order by d), '{}')
  from (
    select g::date d
    from jsonb_array_elements(coalesce(p_leaves,'[]'::jsonb)) lv,
         generate_series(greatest((lv->>'s')::date, a), least((lv->>'e')::date, b), interval '1 day') g
    where public.konsilys_is_workday(g::date)
      and (p_exclude_type is null or coalesce(lv->>'type','') <> p_exclude_type)
  ) x;
$$;

create or replace function public.konsilys_kpi_core(
  p_scr numeric, p_contract text, p_arrive date, p_depart date,
  p_fy_start date, p_fy_end date, p_missions jsonb, p_leaves jsonb
) returns jsonb language plpgsql immutable as $$
declare
  cs date; ce date;
  tWD int; lvD int; sickD int; bill int := 0;
  rev numeric := 0;
  lds date[]; mleaves date[];
  factor numeric;
  mm jsonb;
  mm_sd date; mm_ed date; mm_tjm numeric; mm_btype text; mm_wmode text;
  v_wd int[]; v_manual date[];
  mS date; mE date; d int; r numeric; totD int; deal numeric;
  sr numeric; avgT numeric; om numeric;
begin
  factor := case when p_contract = 'freelance' then 1 else 1.25 end;
  cs := case when p_arrive is not null and p_arrive > p_fy_start then p_arrive else p_fy_start end;
  ce := case when p_depart is not null and p_depart < p_fy_end   then p_depart else p_fy_end   end;
  tWD := public.konsilys_working_days(cs, ce);
  lds := public.konsilys_leave_days(p_leaves, cs, ce, null);
  lvD := coalesce(array_length(lds, 1), 0);
  sickD := coalesce(array_length(public.konsilys_leave_days(p_leaves, cs, ce, 'Inter-contrat'), 1), 0);

  for mm in select * from jsonb_array_elements(coalesce(p_missions, '[]'::jsonb)) loop
    mm_sd := nullif(mm->>'sd', '')::date;
    if mm_sd is null then continue; end if;
    mm_ed := nullif(mm->>'ed', '')::date;
    mm_tjm := coalesce((mm->>'tjm')::numeric, 0);
    mm_btype := coalesce(mm->>'btype', 'at');
    mm_wmode := coalesce(mm->>'wmode', 'rec');
    v_wd := case when jsonb_typeof(mm->'wdays') = 'array' and jsonb_array_length(mm->'wdays') > 0
              then array(select (jsonb_array_elements_text(mm->'wdays'))::int)
              else array[1,2,3,4,5] end;
    v_manual := case when jsonb_typeof(mm->'manual_days') = 'array'
              then array(select (jsonb_array_elements_text(mm->'manual_days'))::date)
              else array[]::date[] end;

    mS := greatest(mm_sd, cs);
    mE := case when mm_ed is null or mm_ed > ce then ce else mm_ed end;

    if mS > mE then
      d := 0;
    elsif mm_wmode = 'man' and array_length(v_manual, 1) is not null then
      select count(*) into d from unnest(v_manual) md where md between mS and mE and md <> all(lds);
    else
      select count(*) into d from generate_series(mS, mE, interval '1 day') g
        where public.konsilys_is_workday(g::date)
          and extract(dow from g)::int = any(v_wd)
          and g::date <> all(lds);
    end if;

    if mm_btype = 'forfait' then
      deal := coalesce((mm->>'deal')::numeric, 0);
      if mm_ed is not null then
        mleaves := public.konsilys_leave_days(p_leaves, mm_sd, mm_ed, null);
        if mm_wmode = 'man' and array_length(v_manual, 1) is not null then
          select count(*) into totD from unnest(v_manual) md where md between mm_sd and mm_ed and md <> all(mleaves);
        else
          select count(*) into totD from generate_series(mm_sd, mm_ed, interval '1 day') g
            where public.konsilys_is_workday(g::date)
              and extract(dow from g)::int = any(v_wd)
              and g::date <> all(mleaves);
        end if;
        r := case when totD > 0 then deal * d::numeric / totD else 0 end;
      else
        r := deal;
      end if;
    else
      r := d * mm_tjm;
    end if;

    bill := bill + d;
    rev := rev + r;
  end loop;

  sr := case when tWD > 0 then (bill + sickD)::numeric / tWD * 100 else 0 end;
  avgT := case when bill > 0 then rev / bill else 0 end;
  om := case when bill > 0 and avgT > 0 then (avgT - p_scr * factor) / avgT * 100 else null end;

  return jsonb_build_object(
    'tWD', tWD, 'lvD', lvD, 'avD', tWD - lvD, 'sickD', sickD, 'bill', bill,
    'rev', rev, 'sr', sr, 'avgT', avgT, 'om', om
  );
end $$;