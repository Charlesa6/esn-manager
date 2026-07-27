-- Fiche de poste : type de facturation (AT / forfait) pour la mission auto-créée au
-- passage « pourvu ». Pour un forfait, on stocke le montant du deal et la marge cible,
-- pré-remplis depuis l'opportunité liée quand la fiche vient d'un deal CRM.
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
alter table public.job_postings add column if not exists billing_type text not null default 'at';
alter table public.job_postings add column if not exists deal_amount numeric;
alter table public.job_postings add column if not exists target_margin numeric;
