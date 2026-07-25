-- Cloisonnement CRM par rôle : les rôles Recruteur et Utilisateur (Consultant)
-- n'ont pas d'onglet Business/Opportunités dans l'app, mais rien ne les empêchait
-- de LIRE le pipeline commercial (opportunités, comptes, contacts — noms de deals,
-- montants, TJM) directement via l'API REST : les tables CRM n'avaient qu'un scope
-- entreprise (+ BU pour les opportunités), sans filtre de rôle.
--
-- On ajoute une policy RESTRICTIVE de SELECT sur les 3 tables CRM qui exclut
-- `recruteur` et `utilisateur`. Les rôles Business (super_admin/admin/gestionnaire/
-- sales) restent inchangés, toujours bornés par leur BU. La soumission d'opportunité
-- par un utilisateur passe par `crm_approvals` (table distincte, non affectée).
--
-- Portée : SELECT uniquement. Rollback : DROP des 3 policies ci-dessous.

create policy crm_opps_hide_from_limited_roles on public.crm_opportunities
  as restrictive for select to authenticated
  using (coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
         not in ('recruteur','utilisateur'));

create policy crm_accounts_hide_from_limited_roles on public.crm_accounts
  as restrictive for select to authenticated
  using (coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
         not in ('recruteur','utilisateur'));

create policy crm_contacts_hide_from_limited_roles on public.crm_contacts
  as restrictive for select to authenticated
  using (coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
         not in ('recruteur','utilisateur'));
