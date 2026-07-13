-- ══ Opportunités staffing — pilotage des intercontrats ══
-- Appliquée en prod via Supabase MCP. Une opportunité = une mission PRESSENTIE
-- pour un consultant en intercontrat (ou en approche d'atterrissage) : client,
-- date de démarrage, durée (mois), TJM, statut pressentie/gagnee/perdue.
-- La concrétisation crée une vraie ligne dans `missions` côté app.

create table if not exists public.staffing_opportunities (
  id              text primary key,
  company_id      uuid not null references public.companies(id) on delete cascade,
  consultant_id   text not null references public.consultants(id) on delete cascade,
  client_name     text not null default '',
  start_date      date,
  duration_months numeric,
  tjm             numeric,
  status          text not null default 'pressentie' check (status in ('pressentie','gagnee','perdue')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_staffopp_company    on public.staffing_opportunities(company_id);
create index if not exists idx_staffopp_consultant on public.staffing_opportunities(consultant_id);

alter table public.staffing_opportunities enable row level security;

-- Isolation entreprise (lecture + écritures).
drop policy if exists staffopp_all on public.staffing_opportunities;
create policy staffopp_all on public.staffing_opportunities for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- Cloisonnement BU en lecture, dérivé du consultant (même modèle que missions/leaves).
drop policy if exists bu_scope_staffopp on public.staffing_opportunities;
create policy bu_scope_staffopp on public.staffing_opportunities
  as restrictive for select
  using (public.bu_consultant_visible(consultant_id));

-- Journal d'activité (comme les autres tables sensibles).
drop trigger if exists trg_audit on public.staffing_opportunities;
create trigger trg_audit after insert or update or delete on public.staffing_opportunities
  for each row execute function public.audit_trigger();
