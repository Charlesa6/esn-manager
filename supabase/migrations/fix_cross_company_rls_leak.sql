-- FUITE RGPD : la policy "dir_isolation" (ALL) sur consultants/leaves/missions,
-- héritée du rôle "directeur", ne filtrait PAS par entreprise. Les policies
-- permissives se combinant en OR, et les rôles actuels n'étant pas "directeur",
-- sa clause (role IS DISTINCT FROM 'directeur') était toujours vraie → accès à
-- toutes les entreprises. On la supprime ; les policies cons_/leave_/miss_
-- restantes cloisonnent déjà par company_id = my_company_id().
-- Appliquée en prod via Supabase MCP.
drop policy if exists dir_isolation on public.consultants;
drop policy if exists dir_isolation on public.leaves;
drop policy if exists dir_isolation on public.missions;

-- Tables d'invitations legacy : accès public (anon) / lecture "true" → cloisonner.
drop policy if exists "Delete consultant_invites" on public.consultant_invites;
drop policy if exists "Insert consultant_invites" on public.consultant_invites;
drop policy if exists "Lecture consultant_invites par company" on public.consultant_invites;
create policy consultant_invites_own_company on public.consultant_invites
  for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

drop policy if exists public_read_recruteur_invites on public.recruteur_invites;
drop policy if exists public_read_sales_invites on public.sales_invites;
drop policy if exists public_read_vp_invites on public.vp_invites;
