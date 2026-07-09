-- Persistance du mode de planning des missions (récurrent vs jours choisis manuellement).
-- Sans ces colonnes, une mission enregistrée en « choix manuel » retombait en récurrent
-- après rechargement (le moteur KPI lit m.wmode / m.manualDays).
alter table public.missions add column if not exists wmode text;
alter table public.missions add column if not exists manual_days jsonb;

-- Persistance des informations de recrutement d'un candidat.
-- Sans ces colonnes, recocher « recruté » sur un candidat déjà recruté recréait une
-- fiche consultant en double, et le lien candidat↔consultant (cons_id) était perdu.
alter table public.candidates add column if not exists recruited boolean default false;
alter table public.candidates add column if not exists recruit_start date;
alter table public.candidates add column if not exists recruit_poste text;
alter table public.candidates add column if not exists recruit_dir text;
alter table public.candidates add column if not exists cons_id text;
