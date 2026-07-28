-- ══ Offre publique + candidatures externes (page « Postuler ») ══════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Objectif : chaque fiche de poste peut être PUBLIÉE sous une URL publique
-- (konsilys.fr/postuler?j=<token>) où un candidat postule (formulaire + CV).
-- La candidature crée un `candidates` rattaché à la fiche (job_postings.candidate_ids),
-- via l'Edge Function `job-apply` (verify_jwt=false, service role) : AUCUN accès
-- anonyme direct aux tables — l'isolation multi-tenant reste intacte (RLS inchangée).
--
-- Colonnes additives uniquement — pas de nouvelle policy RLS (l'accès public passe
-- exclusivement par la fonction, jamais par le client anon).

-- Fiche de poste : drapeau de publication + jeton public non devinable.
alter table public.job_postings add column if not exists is_public    boolean not null default false;
alter table public.job_postings add column if not exists public_token  uuid;
alter table public.job_postings add column if not exists published_at   timestamptz;

-- Jeton unique (lookup public par token). Index partiel : seules les offres publiées.
create unique index if not exists idx_jobpost_public_token
  on public.job_postings(public_token) where public_token is not null;

-- Candidat : provenance de la fiche + traçabilité de l'offre d'origine.
alter table public.candidates add column if not exists source          text;      -- 'manuel' | 'import' | 'offre_publique'
alter table public.candidates add column if not exists applied_job_id  text;      -- job_postings.id d'origine (candidature publique)
