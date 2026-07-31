-- ══ Cadence de la Business Review stratégique (choisissable) ══════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- La BR opérationnelle a déjà sa cadence (revue_cadence, hebdo → annuel). On
-- rend la BR stratégique tout aussi choisissable (défaut : semestrielle), pour
-- coller aux rituels CGI où la temporalité des Business Reviews est libre.
alter table public.account_plans add column if not exists cadence_strat text default 'semestriel';
