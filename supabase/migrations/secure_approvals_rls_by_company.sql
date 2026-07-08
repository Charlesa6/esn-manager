-- Cloisonne la table approvals par entreprise (au lieu de USING(true)).
-- Corrige une fuite multi-tenant : la clé publique anon pouvait lire/écrire
-- les approbations (absences, modifications) de toutes les entreprises.
-- Appliquée en prod via Supabase MCP.
drop policy if exists select_approvals on public.approvals;
drop policy if exists insert_approvals on public.approvals;
drop policy if exists update_approvals on public.approvals;
drop policy if exists delete_approvals on public.approvals;

create policy approvals_select_own_company on public.approvals
  for select to authenticated
  using (company_id = public.my_company_id());

create policy approvals_insert_own_company on public.approvals
  for insert to authenticated
  with check (company_id = public.my_company_id());

create policy approvals_update_own_company on public.approvals
  for update to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

create policy approvals_delete_own_company on public.approvals
  for delete to authenticated
  using (company_id = public.my_company_id());
