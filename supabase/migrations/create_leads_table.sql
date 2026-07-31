-- Table des leads issus du formulaire de contact public du hub konsilys.fr.
-- Données NON liées à un tenant (leads globaux du site).
--   • Insertion : publique (formulaire), avec garde-fous.
--   • Lecture / mise à jour : réservées au propriétaire du site (email dans
--     l'allowlist ci-dessous), pour la page admin /admin-leads.
--
-- À appliquer en prod via le MCP Supabase (apply_migration). Le formulaire du hub
-- bascule automatiquement sur un envoi par email tant que la table n'existe pas,
-- donc la mise en ligne du front ne dépend pas de cette migration.

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text,                       -- 'offre' | 'projet' | 'contact'
  subject     text,                       -- offre/produit concerné
  name        text,
  email       text not null,
  company     text,
  message     text,
  source      text,                       -- section/page d'origine
  status      text not null default 'new' -- 'new' | 'done'
);

comment on table public.leads is 'Leads du formulaire de contact public (konsilys.fr). Insertion publique, lecture/maj réservées au propriétaire.';

create index if not exists leads_created_at_idx on public.leads (created_at desc);

alter table public.leads enable row level security;

-- Insertion publique (formulaire) avec garde-fous anti-abus (longueurs, format
-- d'email minimal). Le client insère en mode 'minimal' (pas de RETURNING).
drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert on public.leads
  for insert to anon, authenticated
  with check (
    email is not null
    and email like '%_@_%.__%'
    and char_length(email)   between 5 and 200
    and char_length(coalesce(name,''))    <= 200
    and char_length(coalesce(subject,'')) <= 200
    and char_length(coalesce(company,'')) <= 200
    and char_length(coalesce(message,'')) <= 5000
    and char_length(coalesce(kind,''))    <= 40
    and char_length(coalesce(source,''))  <= 120
  );

-- Lecture réservée au(x) propriétaire(s) : email du JWT dans l'allowlist.
-- Pour ajouter un lecteur : compléter la liste ci-dessous puis réappliquer.
drop policy if exists leads_owner_select on public.leads;
create policy leads_owner_select on public.leads
  for select to authenticated
  using ( lower(auth.jwt() ->> 'email') in ('charles.allouard@gmail.com') );

-- Mise à jour du statut (marquer traité) — mêmes propriétaires.
drop policy if exists leads_owner_update on public.leads;
create policy leads_owner_update on public.leads
  for update to authenticated
  using ( lower(auth.jwt() ->> 'email') in ('charles.allouard@gmail.com') )
  with check ( lower(auth.jwt() ->> 'email') in ('charles.allouard@gmail.com') );

grant insert on public.leads to anon, authenticated;
grant select, update on public.leads to authenticated;
