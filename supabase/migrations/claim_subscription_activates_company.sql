-- claim_subscription_activates_company
-- Renforce claim_subscription : active l'entreprise (companies.active) dès qu'un
-- abonnement payé lui est rattaché. Évite la course avec le webhook juste après
-- paiement (l'utilisateur pourrait atteindre l'app avant l'activation).
-- N'active jamais sans abonnement et ne désactive jamais.
-- Appliquée en prod via Supabase MCP (conservée ici pour référence).
create or replace function public.claim_subscription()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  usr_email text;
  cid uuid;
  sub record;
  biz boolean := false;
  rec boolean := false;
  activated boolean := false;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'reason', 'no_auth'); end if;

  select email into usr_email from auth.users where id = auth.uid();
  select company_id into cid from public.profiles where id = auth.uid();
  if cid is null then return jsonb_build_object('ok', false, 'reason', 'no_company'); end if;

  -- 1) Rattacher un abonnement payé au même email mais pas encore rattaché.
  select * into sub from public.subscriptions
    where lower(customer_email) = lower(coalesce(usr_email, ''))
      and company_id is null
      and status in ('active', 'trialing', 'past_due')
    order by created_at desc limit 1;
  if found then
    update public.subscriptions set company_id = cid, updated_at = now() where id = sub.id;
  end if;

  -- 2) Activer l'entreprise + modules dès qu'un abonnement payé lui est rattaché.
  select * into sub from public.subscriptions
    where company_id = cid and status in ('active', 'trialing', 'past_due')
    order by created_at desc limit 1;
  if found then
    biz := exists (select 1 from jsonb_array_elements(sub.lines) l
                   where l->>'kind' = 'module' and l->>'ref' = 'business');
    rec := exists (select 1 from jsonb_array_elements(sub.lines) l
                   where l->>'kind' = 'module' and l->>'ref' = 'recrutement');
    update public.companies set active = true where id = cid and active = false;
    if biz then update public.companies set has_business_module = true where id = cid; end if;
    if rec then update public.companies set has_recrutement_module = true where id = cid; end if;
    activated := true;
  end if;

  return jsonb_build_object('ok', activated, 'business', biz, 'recrutement', rec);
end;
$function$;
