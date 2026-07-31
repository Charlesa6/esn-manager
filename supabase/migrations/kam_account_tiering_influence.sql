-- ══ Comptes stratégiques & à potentiel : typologie, BR typée, influence, biz ══
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Adaptation au besoin CGI (ateliers KAM/CAE) : deux niveaux de plan de compte
-- (stratégique / à potentiel), Business Reviews cadencées et typées, plan
-- d'influence/lobbying (hauteur d'accès aux décideurs), actions orientées business.

-- Typologie du compte + prochaine Business Review stratégique (S1).
alter table public.account_plans   add column if not exists type          text default 'potentiel'; -- 'strategique' | 'potentiel'
alter table public.account_plans   add column if not exists next_br_strat date;

-- Business Review typée + instantanés (pour un compte-rendu structuré).
alter table public.account_reviews  add column if not exists review_type text default 'operationnelle'; -- 'strategique' | 'operationnelle'
alter table public.account_reviews  add column if not exists pipeline    numeric;
alter table public.account_reviews  add column if not exists landing_er  numeric;
alter table public.account_reviews  add column if not exists landing_dr  numeric;

-- Plan d'influence : hauteur hiérarchique du décideur + récence de contact.
alter table public.crm_contacts     add column if not exists hierarchy_level  text; -- 'c_level'|'n1'|'n2'|'operationnel'
alter table public.crm_contacts     add column if not exists last_contact_date date;

-- Action orientée business : cible de CA quand aucune opportunité n'est encore liée.
alter table public.crm_activities   add column if not exists biz_target numeric;
