-- ══ Plans de compte (Key Account Management) ══════════════════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Anime le développement des comptes clients stratégiques d'une ESN : un
-- responsable de compte, un objectif de CA, des enjeux/une stratégie, une
-- cartographie des interlocuteurs (influence + relation), un plan d'actions
-- (réutilise crm_activities rattachées au compte) et un rituel de comité de
-- revue historisé — là où tout vivait dans un PowerPoint mort.
--
-- Additif uniquement. RLS company_id = my_company_id() + audit, exactement
-- comme staffing_opportunities / les autres tables sensibles.

-- Plan de compte : 1 par compte CRM (unicité company_id + account_id).
create table if not exists public.account_plans (
  id             text primary key,
  company_id     uuid not null references public.companies(id) on delete cascade,
  account_id     uuid not null references public.crm_accounts(id) on delete cascade,
  owner_name     text default '',
  owner_email    text default '',
  statut         text not null default 'developper'
                 check (statut in ('strategique','developper','defendre','dormant')),
  ca_objectif    numeric,
  enjeux         text default '',
  strategie      text default '',
  prochaine_revue date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, account_id)
);
create index if not exists idx_accplan_company on public.account_plans(company_id);
create index if not exists idx_accplan_account on public.account_plans(account_id);

-- Comité de revue de compte : un enregistrement horodaté par séance (historique
-- qui remplace la collection de PowerPoint).
create table if not exists public.account_reviews (
  id             text primary key,
  company_id     uuid not null references public.companies(id) on delete cascade,
  account_id     uuid not null references public.crm_accounts(id) on delete cascade,
  review_date    date not null default current_date,
  participants   text default '',
  sante          text default '',
  ca_objectif    numeric,
  ca_realise     numeric,
  decisions      text default '',
  next_steps     text default '',
  created_by     text default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_accreview_company on public.account_reviews(company_id);
create index if not exists idx_accreview_account on public.account_reviews(account_id, review_date desc);

-- Cartographie des interlocuteurs (power map) sur les contacts existants.
alter table public.crm_contacts add column if not exists influence     text;    -- fort | moyen | faible
alter table public.crm_contacts add column if not exists relation      text;    -- champion | neutre | opposant
alter table public.crm_contacts add column if not exists a_rencontrer  boolean not null default false;

-- RLS : isolation entreprise (lecture + écritures).
alter table public.account_plans enable row level security;
drop policy if exists accplan_all on public.account_plans;
create policy accplan_all on public.account_plans for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

alter table public.account_reviews enable row level security;
drop policy if exists accreview_all on public.account_reviews;
create policy accreview_all on public.account_reviews for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- Journal d'activité (comme les autres tables sensibles).
drop trigger if exists trg_audit on public.account_plans;
create trigger trg_audit after insert or update or delete on public.account_plans
  for each row execute function public.audit_trigger();
drop trigger if exists trg_audit on public.account_reviews;
create trigger trg_audit after insert or update or delete on public.account_reviews
  for each row execute function public.audit_trigger();
