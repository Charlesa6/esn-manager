-- ══ Alignement Client Development Plan (CDP « BFIRST » CGI) ═══════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Champs additionnels pour rapprocher le plan de compte du template CGI :
-- Execution Plan & Accountability, Pipeline & Strategic RFPs, Powermap & CxO,
-- Executive Summary + Client 360.

-- Brique A — Execution Plan & Accountability
alter table public.crm_activities   add column if not exists exec_status text;    -- 'on_track' | 'at_risk' | 'critical'
alter table public.crm_activities   add column if not exists escalation  text;    -- décision / escalade attendue
alter table public.crm_activities   add column if not exists bu_id       text;    -- BU porteuse de l'action

-- Brique C — Pipeline & Strategic RFPs
alter table public.crm_opportunities add column if not exists must_win     boolean not null default false;
alter table public.crm_opportunities add column if not exists tcv          numeric;   -- Total Contract Value
alter table public.crm_opportunities add column if not exists renewal_type text;      -- 'new' | 'renewal'
alter table public.crm_opportunities add column if not exists win_strategy text;      -- stratégie pour gagner

-- Brique B — Powermap & CxO plan
alter table public.crm_contacts add column if not exists power          int;   -- -5..+5 (pouvoir)
alter table public.crm_contacts add column if not exists preference     int;   -- -50..+50 (préférence CGI)
alter table public.crm_contacts add column if not exists pain_gain      text;  -- douleur/gain que l'on peut affecter
alter table public.crm_contacts add column if not exists elevate_action text;  -- action pour élever la préférence
alter table public.crm_contacts add column if not exists cgi_owner      text;  -- porteur côté ESN

-- Brique D — Executive Summary
alter table public.account_plans add column if not exists ambition     text;    -- ambition en une phrase
alter table public.account_plans add column if not exists ambition_fy1 text;
alter table public.account_plans add column if not exists ambition_fy3 text;
alter table public.account_plans add column if not exists gm_pct       numeric; -- marge brute cible (%)
alter table public.account_plans add column if not exists csap         numeric; -- satisfaction client /10
alter table public.account_plans add column if not exists n_eie        int;     -- nb d'EIE
alter table public.account_plans add column if not exists n_voc        int;     -- nb d'entretiens VOC

-- Brique D — Client 360 (nutshell)
alter table public.crm_accounts add column if not exists it_spend            numeric; -- budget IT total
alter table public.crm_accounts add column if not exists it_spend_ext_pct    numeric; -- part externalisée (%)
alter table public.crm_accounts add column if not exists competitors         text;
alter table public.crm_accounts add column if not exists strategic_priorities text;
