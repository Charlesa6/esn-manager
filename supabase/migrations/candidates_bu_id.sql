-- Rattachement d'un candidat à une unité (BU), pour la visibilité par rôle :
-- gestionnaires/admins ne voient que les candidats de leur unité et sous-unités,
-- tandis que recruteurs et business managers (module recrutement) voient tout.
-- Renseigné à la création avec l'unité du créateur, puis avec l'unité du directeur
-- assigné au moment du recrutement.
alter table public.candidates add column if not exists bu_id text;
