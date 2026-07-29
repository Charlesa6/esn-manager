-- ══ Plan de compte : objectif DR distinct ═══════════════════════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Deux objectifs pilotés séparément sur un compte :
--   ca_objectif    = objectif External Revenue (tout le CA gagné) — déjà existant.
--   ca_objectif_dr = objectif Delivery Revenue (délivré par mes consultants).
alter table public.account_plans add column if not exists ca_objectif_dr numeric;
