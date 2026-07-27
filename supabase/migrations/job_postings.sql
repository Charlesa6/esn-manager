-- ══ Fiches de poste — besoins de recrutement (pont Business → Recrutement) ══
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
-- Une fiche de poste = un BESOIN à pourvoir : profil recherché, dates, attendus,
-- déclinable en version interne (client + tarifs visibles) et externe (annonce
-- anonymisée). Elle peut naître à la main dans Recrutement OU être générée depuis
-- une opportunité CRM gagnée / bien partie (colonne `opp_id`), pour que les
-- recruteurs sachent quoi recruter dès qu'un deal manque de profil.
--
-- Visibilité : comme la table `candidates`, le recrutement est partagé par TOUTE
-- l'entreprise (pas de cloisonnement BU en lecture) — l'isolation multi-tenant
-- reste assurée par my_company_id().

create table if not exists public.job_postings (
  id             text primary key,
  company_id     uuid not null references public.companies(id) on delete cascade,
  title          text not null default '',
  seniority      text,                         -- junior | confirme | senior | lead
  req_expertise  text[] not null default '{}', -- expertises requises (EXPERTISE_LIST)
  req_sector     text,                         -- secteur recherché (SECTOR_LIST)
  req_min_years  integer,                      -- années d'expérience minimum
  location       text,                         -- localisation du poste
  start_date     date,                         -- démarrage souhaité
  nb_positions   integer not null default 1,   -- nombre de postes
  contract_kind  text,                         -- CDI | CDD | Freelance | Alternance
  mission_desc   text,                         -- missions / attendus du poste
  expectations   text,                         -- compétences & qualités attendues
  salary_min     integer,                      -- fourchette rémunération (interne)
  salary_max     integer,
  tjm_target     numeric,                      -- TJM cible de revente (interne)
  client_name    text,                         -- client final (interne, masqué en externe)
  status         text not null default 'ouvert'
                 check (status in ('ouvert','en_cours','pourvu','annule')),
  recruiter      text,                         -- recruteur assigné
  assigned_to    text,                         -- commercial référent
  opp_id         text,                         -- opportunité CRM d'origine (crm_opportunities.id)
  ext_body       text,                         -- corps de l'annonce externe (généré / IA)
  bu_id          text,                          -- BU du créateur (business_units.id est du texte)
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_jobpost_company on public.job_postings(company_id);
create index if not exists idx_jobpost_status  on public.job_postings(status);
create index if not exists idx_jobpost_opp     on public.job_postings(opp_id);

alter table public.job_postings enable row level security;

-- Isolation entreprise (lecture + écritures) — recrutement partagé, pas de BU scope.
drop policy if exists jobpost_all on public.job_postings;
create policy jobpost_all on public.job_postings for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- Journal d'activité (comme les autres tables sensibles).
drop trigger if exists trg_audit on public.job_postings;
create trigger trg_audit after insert or update or delete on public.job_postings
  for each row execute function public.audit_trigger();
