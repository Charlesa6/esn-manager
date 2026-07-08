-- Suivi de l'annulation d'abonnement : quand une entreprise est désactivée
-- suite à annulation, on horodate pour conserver ses données 1 an puis purger.
-- Appliquée en prod via Supabase MCP.
alter table public.companies add column if not exists canceled_at timestamptz;
comment on column public.companies.canceled_at is
  'Date de désactivation suite à annulation Stripe. Données conservées 1 an à partir de cette date, puis purgeables. NULL = entreprise non annulée.';
