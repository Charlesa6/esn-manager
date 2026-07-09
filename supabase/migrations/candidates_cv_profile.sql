-- Dossier de compétences structuré (format ESN type CGI) : au-delà des expériences,
-- on stocke le profil/résumé, les outils, environnements, langues, formation,
-- spécialisations et un tableau de compétences notées (skill/years/level).
alter table public.candidates add column if not exists cv_profile jsonb default '{}'::jsonb;
