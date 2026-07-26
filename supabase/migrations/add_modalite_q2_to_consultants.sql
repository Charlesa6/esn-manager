-- Soldes congés & RTT (règles CGI / Syntec) : deux attributs par consultant.
-- modalite : pilote le quota de RTT Q1 et la date limite de prise
--   (MS=12, RM/AC≈10, CD=0, CD210=5 ; AC & CD210 → prise jusqu'au 31 mars A+1).
-- q2_days  : jours Q2 (repos complémentaires financés) souscrits pour l'année.
-- Appliqué en prod via MCP (apply_migration) ; ce fichier en tient le registre.
alter table consultants add column if not exists modalite text;
alter table consultants add column if not exists q2_days numeric;
comment on column consultants.modalite is 'Modalité temps de travail Syntec/CGI : MS, RM, AC, CD, CD210 (pilote le quota RTT Q1 et la date limite de prise).';
comment on column consultants.q2_days is 'Jours Q2 (repos complémentaires financés) souscrits pour l''année en cours.';
