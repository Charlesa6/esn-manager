-- Fiche de poste ↔ candidats : assignation manuelle (relation N-N portée côté fiche).
-- Source unique de vérité : la liste des candidats assignés vit sur la fiche de poste.
-- « Fiches assignées à un candidat » = fiches dont candidate_ids contient l'id du candidat.
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
alter table public.job_postings add column if not exists candidate_ids text[] not null default '{}';
