-- Prospection commerciale de Konsilys (agent business-developer).
-- Données globales, NON liées à un tenant : aucun accès client (anon/authenticated).
-- Seuls le rôle service (Edge Function bd-unsubscribe) et l'accès SQL d'administration
-- (MCP) lisent/écrivent ces tables.

create table if not exists public.bd_prospects (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  company           text not null,
  website           text,
  city              text,
  size_estimate     text,                 -- ex. '50-100 consultants'
  buying_signal     text,                 -- signal d'achat détecté
  signal_url        text,                 -- source publique du signal
  contact_name      text,
  contact_role      text,
  email             text,                 -- adresse PROFESSIONNELLE uniquement
  email_source      text,                 -- où l'adresse a été trouvée (URL)
  linkedin_url      text,
  status            text not null default 'a_contacter'
                    check (status in ('a_contacter','sequence','repondu','rdv','gagne','perdu','desinscrit','bounce')),
  step              int  not null default 0,  -- nb d'emails déjà envoyés dans la séquence (0..3)
  next_action_at    date,
  unsub_token       uuid not null default gen_random_uuid() unique,
  opted_out_at      timestamptz,
  notes             text
);
create unique index if not exists bd_prospects_email_uidx on public.bd_prospects (lower(email)) where email is not null;
create index if not exists bd_prospects_next_idx on public.bd_prospects (status, next_action_at);

create table if not exists public.bd_emails (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references public.bd_prospects(id) on delete cascade,
  sent_at      timestamptz not null default now(),
  step         int not null,              -- 1 = premier contact, 2-3 = relances, 0 = réponse à un lead entrant
  subject      text not null,
  body         text not null,
  resend_id    text,
  status       text not null default 'sent'
);
create index if not exists bd_emails_prospect_idx on public.bd_emails (prospect_id, sent_at desc);

-- Liste d'opposition : survit à la suppression d'un prospect. À consulter AVANT tout envoi.
create table if not exists public.bd_suppression (
  email       text primary key,           -- toujours en minuscules
  reason      text not null default 'desinscription',
  created_at  timestamptz not null default now()
);

alter table public.bd_prospects   enable row level security;
alter table public.bd_emails      enable row level security;
alter table public.bd_suppression enable row level security;
revoke all on public.bd_prospects, public.bd_emails, public.bd_suppression from anon, authenticated;

comment on table public.bd_prospects   is 'Prospection Konsilys (agent business-developer). Aucun accès client.';
comment on table public.bd_emails      is 'Emails de prospection envoyés via Resend. Aucun accès client.';
comment on table public.bd_suppression is 'Opposition à la prospection (désinscriptions, bounces). Vérifier avant tout envoi.';
