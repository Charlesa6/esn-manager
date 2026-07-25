-- Bug : la seule policy sur directeur_invites (invites_gestionnaire) restreint
-- TOUTES les opérations au rôle `gestionnaire`. Or le Super Admin (BU Leader) et
-- l'Admin (VP Secteur) doivent LIRE cette table pour construire vpDirMap
-- (correspondance VP → Directeurs) qui alimente le filtre par VP de la barre
-- latérale et le regroupement KPI « par VP ». Sans lecture, vpDirMap est vide et
-- sélectionner un VP ne filtre rien.
--
-- On ajoute une policy PERMISSIVE de SELECT pour les rôles d'encadrement
-- (super_admin, admin, gestionnaire), scopée à l'entreprise. Les écritures
-- restent régies par la policy existante (gestionnaire). Rollback : DROP.

create policy directeur_invites_read_management on public.directeur_invites
  as permissive for select to authenticated
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
        in ('super_admin','admin','gestionnaire')
  );
