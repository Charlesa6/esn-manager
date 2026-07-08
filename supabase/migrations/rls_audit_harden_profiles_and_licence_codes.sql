-- ══ Audit RLS (table par table) — durcissements ══
-- Appliquée en prod via Supabase MCP.
--
-- Contexte : passe systématique sur les 24 tables `public`. Toutes ont RLS
-- activé et sont cloisonnées par company_id, SAUF les trois cas ci-dessous.

-- 1) Helper : rôle du compte courant (SECURITY DEFINER STABLE → dans un WITH
--    CHECK d'UPDATE, il renvoie la valeur AVANT modification).
create or replace function public.my_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 2) profiles.UPDATE — FAILLE : escalade de privilèges. La policy n'avait aucun
--    WITH CHECK, donc un utilisateur pouvait modifier son propre `role`
--    (→ super_admin) ou son `company_id` (→ accès aux données d'une autre
--    entreprise). On verrouille ces deux colonnes à leur valeur d'origine.
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles
  for update to public
  using (id = auth.uid())
  with check (id = auth.uid()
              and company_id = public.my_company_id()
              and role = public.my_role());

-- 3) profiles.INSERT — trop permissif (WITH CHECK true). Limité à sa propre
--    ligne. Le signup passe par handle_new_user (SECURITY DEFINER, bypass RLS).
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles
  for insert to public
  with check (id = auth.uid());

-- 4) licence_codes — FAILLE : policies anonymes `true` (SELECT + UPDATE) →
--    n'importe qui pouvait énumérer et falsifier les codes. Table legacy, plus
--    utilisée côté client (flux paiement-only). Lecture limitée à l'entreprise.
drop policy if exists "Lecture publique des codes" on public.licence_codes;
drop policy if exists "Mise à jour publique (marquer comme utilisé)" on public.licence_codes;
create policy licence_codes_read_own_company on public.licence_codes
  for select to authenticated
  using (company_id = public.my_company_id());
