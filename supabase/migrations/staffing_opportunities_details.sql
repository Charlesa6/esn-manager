-- ══ Opportunités staffing — champ « détail » ══
-- Appliquée en prod via Supabase MCP. Quelques mots libres sur l'opportunité
-- (contexte, contact, prochaine étape…), affichés dans la liste et au survol.
alter table public.staffing_opportunities add column if not exists details text;
