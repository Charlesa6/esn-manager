-- ============================================================================
-- Konsilys — jeu de données de charge (≈100k consultants + missions + absences)
-- ============================================================================
-- OBJECTIF : remplir une base de TEST pour le test de charge k6 (tests/load/).
--
-- ⚠️  NE JAMAIS EXÉCUTER SUR LA PRODUCTION.
--     À lancer uniquement sur une BRANCHE Supabase ou un projet de STAGING.
--     Toutes les lignes créées ont un id préfixé « load_ » → nettoyage trivial
--     (voir la section CLEANUP en bas).
--
-- USAGE (psql, connexion admin de la branche/staging) :
--   psql "$BRANCH_DB_URL" -v cid="'<UUID_ENTREPRISE_DE_TEST>'" -v n=100000 \
--        -f tests/load/seed-large-dataset.sql
--
--   -v cid : UUID de l'entreprise de test (OBLIGATOIRE, entre quotes simples).
--   -v n   : nombre de consultants (défaut 100000 ci-dessous).
-- ============================================================================

\set ON_ERROR_STOP on
-- Nombre de consultants (surchargé par -v n=...). cid n'a PAS de défaut : s'il
-- n'est pas fourni, la substitution échoue et le script s'arrête — voulu.
\if :{?n} \else \set n 100000 \endif

\echo 'Seed Konsilys — cid=' :cid ' n=' :n

-- Désactive triggers (audit) et allège les écritures le temps du bulk insert.
-- Nécessite un rôle élevé (connexion admin de la branche) — normal pour un seed.
set session_replication_role = replica;

begin;

-- ── Consultants ──────────────────────────────────────────────────────────────
insert into public.consultants
  (id, company_id, name, title, scr, email, arrive, depart, bu_id, contract, directeur)
select
  'load_c_' || g,
  :cid::uuid,
  'Consultant ' || g,
  (array['Développeur','Consultant','Chef de projet','Data Engineer','Architecte'])[1 + (g % 5)],
  350 + (g % 300),
  'load' || g || '@test.local',
  date '2024-01-01' + ((g * 7) % 400),
  case when g % 20 = 0 then date '2026-01-01' + (g % 200) else null end,
  'bu_' || (1 + (g % 12)),
  case when g % 10 = 0 then 'freelance' else 'salarie' end,
  'Directeur ' || (1 + (g % 30))
from generate_series(1, :n) g;

-- ── Missions (1 par consultant + 1 pour un sur deux ≈ 1,5·n) ─────────────────
insert into public.missions
  (id, company_id, consultant_id, name, client_name, tjm, start_date, end_date, billing_type, work_days, deal_amount, wmode)
select
  'load_m_' || g || '_1',
  :cid::uuid,
  'load_c_' || g,
  'Mission ' || g,
  'Client ' || (1 + (g % 50)),
  450 + (g % 400),
  date '2025-10-01' + (g % 120),
  case when g % 4 = 0 then null else date '2026-06-01' + (g % 200) end,
  case when g % 6 = 0 then 'forfait' else 'at' end,
  '{1,2,3,4,5}',
  case when g % 6 = 0 then 20000 + (g % 80000) else null end,
  'rec'
from generate_series(1, :n) g;

insert into public.missions
  (id, company_id, consultant_id, name, client_name, tjm, start_date, end_date, billing_type, work_days, wmode)
select
  'load_m_' || g || '_2',
  :cid::uuid,
  'load_c_' || g,
  'Mission ' || g || ' bis',
  'Client ' || (1 + (g % 50)),
  500 + (g % 350),
  date '2026-01-01' + (g % 120),
  date '2026-09-01' + (g % 120),
  'at',
  '{1,2,3,4,5}',
  'rec'
from generate_series(1, :n) g
where g % 2 = 0;

-- ── Absences (1 congé par consultant) ────────────────────────────────────────
insert into public.leaves
  (id, company_id, consultant_id, type, start_date, end_date, approved)
select
  'load_l_' || g || '_1',
  :cid::uuid,
  'load_c_' || g,
  'Congé payé',
  date '2026-08-01' + (g % 20),
  date '2026-08-05' + (g % 20),
  true
from generate_series(1, :n) g;

commit;

reset session_replication_role;

analyze public.consultants;
analyze public.missions;
analyze public.leaves;

select
  (select count(*) from public.consultants where id like 'load_%') as consultants,
  (select count(*) from public.missions   where id like 'load_%') as missions,
  (select count(*) from public.leaves     where id like 'load_%') as absences;

-- ============================================================================
-- CLEANUP (à exécuter pour tout retirer) :
--   delete from public.leaves      where id like 'load_%';
--   delete from public.missions    where id like 'load_%';
--   delete from public.consultants where id like 'load_%';
-- ============================================================================
