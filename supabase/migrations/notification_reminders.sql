-- ══ Notifications de rappel d'échéance (email + Microsoft Teams) ═══════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Une entreprise règle ses canaux de notification (email de digest + webhook Teams)
-- pour recevoir les rappels d'échéance des engagements pris en comité de compte.
-- La fonction Edge `engagement-reminders` (cron quotidien) lit ces réglages.

create table if not exists public.notification_settings (
  company_id        uuid primary key references public.companies(id) on delete cascade,
  teams_webhook_url text,     -- URL du connecteur entrant Teams (canal cible)
  digest_email      text,     -- adresse de repli si le responsable n'a pas d'email
  email_enabled     boolean not null default true,
  teams_enabled     boolean not null default true,
  updated_at        timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists notif_settings_rw on public.notification_settings;
create policy notif_settings_rw on public.notification_settings
  for all
  using  (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- Idempotence : on ne renvoie pas le même rappel plusieurs fois le même jour.
alter table public.crm_activities add column if not exists reminded_on date;
