-- ══ Équipe de gouvernance du compte + cadence de comité ══════════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Organisation propre à chaque compte client : KAM, ingénieurs d'affaires,
-- directeurs, sponsors — parfois de BU différentes — qui animent des comités
-- récurrents. account_team porte l'équipe (rôle + BU + lien optionnel vers un
-- consultant/membre Konsilys ou saisie libre). account_plans.revue_cadence porte
-- la fréquence du comité (la prochaine revue s'avance automatiquement).

create table if not exists public.account_team (
  id            text primary key,
  company_id    uuid not null references public.companies(id) on delete cascade,
  account_id    uuid not null references public.crm_accounts(id) on delete cascade,
  member_name   text not null default '',
  member_email  text default '',
  role          text not null default 'membre'
                check (role in ('kam','ingenieur_affaires','directeur','sponsor','membre')),
  bu_id         text,
  consultant_id text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_accteam_company on public.account_team(company_id);
create index if not exists idx_accteam_account on public.account_team(account_id);

alter table public.account_plans add column if not exists revue_cadence text; -- mensuel|trimestriel|semestriel|annuel

alter table public.account_team enable row level security;
drop policy if exists accteam_all on public.account_team;
create policy accteam_all on public.account_team for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

drop trigger if exists trg_audit on public.account_team;
create trigger trg_audit after insert or update or delete on public.account_team
  for each row execute function public.audit_trigger();
