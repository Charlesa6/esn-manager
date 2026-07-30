-- ══ Cron quotidien des rappels d'engagement (email + Teams) ═══════════════════
-- Appliqué en prod via Supabase MCP ; ce fichier est le record.
--
-- Appelle chaque jour la fonction Edge `engagement-reminders` (déployée avec
-- verify_jwt=false), qui balaie les engagements dont l'échéance approche/est
-- dépassée et prévient les responsables. Le secret partagé (x-cron-secret) est
-- rangé dans Vault — JAMAIS committé — et doit être recopié dans le secret
-- CRON_SECRET de la fonction Edge (dashboard Supabase → Edge Functions → Secrets).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- Le secret est créé hors-migration via Vault :
--   select vault.create_secret('<valeur aléatoire>', 'engagement_reminders_cron_secret');
-- (recopier la même valeur dans CRON_SECRET côté Edge Function).

select cron.schedule(
  'engagement-reminders-daily',
  '0 7 * * *',                                    -- tous les jours à 07:00 UTC
  $job$
  select net.http_post(
    url     := 'https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/engagement-reminders',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                        where name='engagement_reminders_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
