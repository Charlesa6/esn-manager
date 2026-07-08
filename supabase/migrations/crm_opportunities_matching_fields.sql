-- Connexion Business ↔ Recrutement : une opportunité porte l'expertise
-- recherchée et une localisation, pour suggérer des candidats du pipeline
-- recrutement (matching expertise / localisation / prix / disponibilité).
-- Appliquée en prod via Supabase MCP.
alter table public.crm_opportunities add column if not exists req_expertise text[] default '{}';
alter table public.crm_opportunities add column if not exists location text;
