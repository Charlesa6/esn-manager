-- Brique 2 (montée en charge) — extension ADDITIVE du cœur KPI.
--
-- konsilys_kpi_core renvoie désormais, en plus des agrégats existants (inchangés),
-- le détail par mission `pm` (client, intitulé, jours, TJM, CA, marge, type) et les
-- bornes clampées `cs`/`ce` — pour alimenter les cartes/pagination par consultant
-- côté serveur, sans dupliquer la logique de comptage des jours.
--
-- Correctif inclus : pour une mission dont la fenêtre effective est vide (mS > mE,
-- ex. forfait SANS date de fin commençant après la fin de fenêtre / le départ),
-- le CA doit être 0 (comme kpi() de js/01-core.js qui court-circuite à 0). L'ancienne
-- version retombait sur `r := deal` dans ce cas de bord — corrigé ici.

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
  mS date; mE date; d int; r numeric; totD int; deal numeric; mar numeric;
  sr numeric; avgT numeric; om numeric;
  v_pm jsonb := '[]'::jsonb;
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
      -- Fenêtre effective vide : mission hors période (comme kpi() → 0, y compris
      -- forfait sans date de fin). On émet quand même l'entrée pm à 0.
      d := 0; r := 0; mar := 0;
    else
      if mm_wmode = 'man' and array_length(v_manual, 1) is not null then
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
        mar := case when r > 0 then (r - d * p_scr * factor) / r * 100 else 0 end;
      else
        r := d * mm_tjm;
        mar := case when mm_tjm > 0 then (mm_tjm - p_scr * factor) / mm_tjm * 100 else 0 end;
      end if;

      bill := bill + d;
      rev := rev + r;
    end if;

    v_pm := v_pm || jsonb_build_object(
      'cli', mm->>'cli', 'name', mm->>'name', 'days', d, 'tjm', mm_tjm,
      'rev', r, 'mar', mar, 'btype', mm_btype
    );
  end loop;

  sr := case when tWD > 0 then (bill + sickD)::numeric / tWD * 100 else 0 end;
  avgT := case when bill > 0 then rev / bill else 0 end;
  om := case when bill > 0 and avgT > 0 then (avgT - p_scr * factor) / avgT * 100 else null end;

  return jsonb_build_object(
    'tWD', tWD, 'lvD', lvD, 'avD', tWD - lvD, 'sickD', sickD, 'bill', bill,
    'rev', rev, 'sr', sr, 'avgT', avgT, 'om', om,
    'pm', v_pm, 'cs', cs, 'ce', ce
  );
end $$;
