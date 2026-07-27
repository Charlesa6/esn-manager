-- Opportunité CRM : séniorité recherchée (remplace la saisie « années d'expérience »
-- dans le formulaire, pour cohérence avec la fiche de poste). Le matching candidats
-- dérive un seuil d'années minimum de la séniorité (voir senMinYears côté app).
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
alter table public.crm_opportunities add column if not exists req_seniority text;
