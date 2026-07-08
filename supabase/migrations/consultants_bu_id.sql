-- BU stockée directement sur la fiche consultant (rattachement robuste, renseigné
-- à la BU du gestionnaire au moment du recrutement, éditable ensuite en Équipe).
-- Appliquée en prod via Supabase MCP.
alter table public.consultants add column if not exists bu_id text;
