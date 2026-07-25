-- Le Business Manager (rôle `sales`) doit voir les consultants de sa Business
-- Unit — SCR/TJM/marges inclus — car connaître le coût (SCR) d'un consultant est
-- un pré-requis pour le chiffrer et le proposer à un client.
--
-- Jusqu'ici la policy RESTRICTIVE `cons_limited_roles_self_only`
-- (rls_consultants_hide_salaries_from_limited_roles.sql) limitait sales,
-- recruteur et utilisateur à leur SEULE fiche (pour cacher les salaires). On en
-- RETIRE `sales` : il n'est alors plus borné que par `bu_scope_consultants`
-- (business_units_rls_bu_scope.sql), c'est-à-dire sa BU et ses sous-unités.
-- Recruteur et Utilisateur restent, eux, limités à leur propre fiche.
--
-- Portée : SELECT sur consultants. Missions/leaves sont déjà cloisonnés par BU
-- pour tous (bu_scope_*), donc rien à changer côté serveur pour eux.
-- Rollback : réappliquer rls_consultants_hide_salaries_from_limited_roles.sql
-- (remet 'sales' dans la liste).

drop policy if exists cons_limited_roles_self_only on public.consultants;
create policy cons_limited_roles_self_only on public.consultants
  as restrictive for select to authenticated
  using (
    coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
      not in ('recruteur','utilisateur')
    or id::text = (select p.cons_id from public.profiles p where p.id = auth.uid())
    or lower(coalesce(email,'')) = lower(coalesce(public.my_email(), '\x00'))
  );
