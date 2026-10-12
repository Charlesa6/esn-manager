-- Mémoire du sourcing automatique de l'agent business-developer (prospection Konsilys). Appliquée via MCP le 12/10/2026.
-- Tables globales (pas de données tenant), RLS activée, aucun accès client : SQL d'administration uniquement.
create table if not exists public.bd_sourcing_vus (
  siren text primary key,
  company text,
  verdict text not null,          -- retenu | hors_cible | sans_adresse | site_introuvable | doublon | exclu
  motif text,
  examined_at timestamptz not null default now()
);
create table if not exists public.bd_sourcing_curseur (
  naf text primary key,           -- code NAF parcouru
  ordre int not null,             -- ordre de parcours
  derniere_page int not null default 0,
  termine boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.bd_sourcing_vus enable row level security;
alter table public.bd_sourcing_curseur enable row level security;
revoke all on public.bd_sourcing_vus, public.bd_sourcing_curseur from anon, authenticated;
insert into public.bd_sourcing_curseur (naf, ordre, derniere_page) values
  ('62.02A', 1, 4), ('62.01Z', 2, 0), ('62.03Z', 3, 0), ('62.09Z', 4, 0), ('70.22Z', 5, 0)
on conflict (naf) do nothing;
