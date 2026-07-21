-- P2 (audit sécurité M3) : journal des évènements Stripe traités, pour rendre le
-- webhook idempotent (une double livraison / un rejeu Stripe ne re-provisionne
-- plus les sièges ni ne ré-invite). Le webhook insère event_id en tête ; un
-- conflit (23505) => évènement déjà traité => on acquitte sans re-traiter.
create table if not exists public.stripe_events (
  event_id    text primary key,
  type        text,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- Aucune policy => seul le service_role (bypass RLS, utilisé par le webhook) y
-- accède. Aucun accès client (anon/authenticated).
