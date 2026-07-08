-- Matching Business ↔ Recrutement : critères supplémentaires portés par
-- l'opportunité (années d'expérience minimum et secteur recherché), pour
-- classer les candidats du pipeline par nombre de critères satisfaits
-- (expertise / localisation / années d'expérience / secteur).
-- Appliquée en prod via Supabase MCP.
alter table public.crm_opportunities add column if not exists req_min_years integer;
alter table public.crm_opportunities add column if not exists req_sector text;
