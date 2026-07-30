-- ══ Boucle d'engagement : suivi de la tenue des actions d'un comité à l'autre ══
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Chaque action engagée en comité est confrontée à un verdict au comité suivant
-- (Tenu / Reporté / Abandonné), pour un taux de tenue des engagements par compte
-- et par personne — rien ne glisse en silence.
--
--  reported_count : nombre de reports d'échéance (glissement chronique).
--  committed_at   : date de la dernière prise d'engagement.
--  abandoned      : action explicitement abandonnée en comité.
alter table public.crm_activities add column if not exists reported_count int not null default 0;
alter table public.crm_activities add column if not exists committed_at    date;
alter table public.crm_activities add column if not exists abandoned       boolean not null default false;
