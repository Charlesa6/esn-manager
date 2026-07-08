-- Rattachement d'une opportunité à une unité (BU).
-- bu_id = id d'un nœud de l'arbre BU (arbre stocké en JSON dans company_settings).
-- Renseigné à la création avec la BU du créateur (son niveau le plus fin).
-- Nullable pour les opportunités historiques créées avant cette colonne.
alter table public.crm_opportunities add column if not exists bu_id text;
