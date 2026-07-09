-- Expériences structurées d'un candidat (pour générer le CV au format entreprise) :
-- liste d'objets { poste, client, date_start, date_end, current, description, technos }.
alter table public.candidates add column if not exists experiences jsonb default '[]'::jsonb;
