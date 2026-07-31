-- ══ CDP : Resources & Governance + Key takeaways & call to action ═════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Complète l'alignement sur le template CGI (slides 19-20) : allocation des
-- ressources (% de temps + rôles support) et synthèse « key takeaways ».

-- Resources & Governance : % d'allocation + distinction ressource / rôle support.
alter table public.account_team  add column if not exists pct_time   int;
alter table public.account_team  add column if not exists is_support boolean not null default false;

-- Key takeaways & call to action (niveau plan).
alter table public.account_plans add column if not exists key_messages   text;
alter table public.account_plans add column if not exists call_to_action text;
