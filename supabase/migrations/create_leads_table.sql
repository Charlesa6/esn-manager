-- Table des leads issus du formulaire de contact public du hub konsilys.fr.
-- Données NON liées à un tenant (leads globaux du site). Insertion publique
-- autorisée (formulaire), aucune lecture côté client (RLS bloque par défaut :
-- seul le service_role / dashboard peut lire).
--
-- ⚠ À appliquer en prod via le MCP Supabase (apply_migration) — le formulaire du
--   hub bascule automatiquement sur un envoi par email tant que la table n'existe
--   pas, donc la mise en ligne du front ne dépend pas de cette migration.

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
  status      text not null default 'new'
);

comment on table public.leads is 'Leads du formulaire de contact public (konsilys.fr). Insertion publique, lecture réservée au service_role.';

create index if not exists leads_created_at_idx on public.leads (created_at desc);

alter table public.leads enable row level security;

-- Insertion publique (formulaire) avec garde-fous anti-abus (longueurs, format
-- d'email minimal). Le client insère en mode 'minimal' (pas de RETURNING), donc
-- aucun privilège SELECT n'est accordé.
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

-- Autoriser uniquement l'INSERT (pas de SELECT → lecture bloquée côté client).
grant insert on public.leads to anon, authenticated;
