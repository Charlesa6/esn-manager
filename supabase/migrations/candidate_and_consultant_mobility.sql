-- Localisation classifiée du candidat : ville cible (priorité), villes secondaires
-- (prêt à aller), mobilité France entière. Mobilité régionale du consultant :
-- région de rattachement + villes de mobilité (villes définies par le super_admin
-- dans les Paramètres). Appliquée en prod via Supabase MCP.
alter table public.candidates add column if not exists loc_target text;
alter table public.candidates add column if not exists loc_secondary text[] default '{}';
alter table public.candidates add column if not exists mobile_france boolean default false;
alter table public.consultants add column if not exists region text;
alter table public.consultants add column if not exists mobility text[] default '{}';
