-- P2 (audit sécurité, advisors Supabase) : durcissement des fonctions.
-- 1) Fige search_path=public sur les fonctions KPI/calendrier signalées
--    (function_search_path_mutable) — via ALTER, sans toucher au corps.
-- 2) Révoque EXECUTE aux rôles anon/authenticated sur les fonctions de trigger
--    et gardes internes exposées inutilement en RPC (anon_/authenticated_
--    security_definer_function_executable). Elles restent appelées par les
--    triggers (owner), pas besoin d'EXECUTE pour anon/authenticated.
-- Idempotent : parcourt pg_proc par nom, quelle que soit la signature.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('konsilys_easter','konsilys_fr_holidays','konsilys_is_workday',
                      'konsilys_working_days','konsilys_leave_days','konsilys_kpi_core',
                      'konsilys_company_kpis_agg','konsilys_top_clients_agg',
                      'konsilys_consultant_kpis_page_agg')
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;

  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('audit_trigger','guard_consultant_team_bu','inherit_bu','handle_new_user')
  loop
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
  end loop;
end $$;
