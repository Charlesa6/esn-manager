-- ══ Historisation des engagements par revue ══════════════════════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- À chaque comité, on fige l'état des engagements (verdict de tenue par action)
-- et le taux de tenue du compte, pour tracer une courbe de fiabilité dans le temps.
alter table public.account_reviews add column if not exists engagements jsonb;   -- [{id,title,assigned_to,verdict,due,done}]
alter table public.account_reviews add column if not exists reliability numeric; -- taux de tenue (%) au moment de la revue
