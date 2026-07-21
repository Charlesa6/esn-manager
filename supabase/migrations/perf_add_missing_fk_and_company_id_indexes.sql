-- P1 (audit perf) : index manquants sur les colonnes de filtrage dominantes
-- (company_id sur quasi toutes les tables + FK signalées par l'advisor Supabase).
-- Évite les scans séquentiels sur les requêtes multi-tenant.
-- NB : à appliquer en prod via MCP apply_migration (ou psql). Idempotent.
create index if not exists idx_missions_company            on public.missions(company_id);
create index if not exists idx_leaves_company              on public.leaves(company_id);
create index if not exists idx_consultants_company         on public.consultants(company_id);
create index if not exists idx_candidates_company_created  on public.candidates(company_id, created_at desc);
create index if not exists idx_invites_company             on public.invites(company_id);
create index if not exists idx_subscriptions_company       on public.subscriptions(company_id);
create index if not exists idx_activity_logs_company       on public.activity_logs(company_id);
create index if not exists idx_profiles_company            on public.profiles(company_id);
create index if not exists idx_profiles_manager            on public.profiles(manager_id);
create index if not exists idx_crm_opps_company            on public.crm_opportunities(company_id);
create index if not exists idx_crm_opps_account            on public.crm_opportunities(account_id);
create index if not exists idx_crm_opps_contact            on public.crm_opportunities(contact_id);
create index if not exists idx_crm_contacts_company        on public.crm_contacts(company_id);
create index if not exists idx_crm_contacts_account        on public.crm_contacts(account_id);
create index if not exists idx_crm_accounts_company        on public.crm_accounts(company_id);
create index if not exists idx_crm_activities_company      on public.crm_activities(company_id);
create index if not exists idx_crm_activities_account      on public.crm_activities(account_id);
create index if not exists idx_crm_activities_contact      on public.crm_activities(contact_id);
create index if not exists idx_crm_activities_opportunity  on public.crm_activities(opportunity_id);
