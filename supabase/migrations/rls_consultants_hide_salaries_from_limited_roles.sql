-- P0-2 (audit sécurité) : empêcher les rôles limités (sales / recruteur /
-- utilisateur) de lire les fiches consultants d'autres personnes via l'API REST
-- (donc les salaires scr, TJM, marges). Le cloisonnement par rôle n'existait
-- jusqu'ici que côté client (js/14-data-boot.js:333) ; l'app limite déjà ces
-- rôles à leur propre fiche, cette policy RESTRICTIVE est donc cohérente.

-- Helper : email de l'utilisateur courant (auth.users non lisible par authenticated).
create or replace function public.my_email()
  returns text language sql stable security definer set search_path = public
as $$ select email from auth.users where id = auth.uid() $$;
revoke execute on function public.my_email() from anon;

drop policy if exists cons_limited_roles_self_only on public.consultants;
create policy cons_limited_roles_self_only on public.consultants
  as restrictive for select to authenticated
  using (
    coalesce((select p.role from public.profiles p where p.id = auth.uid()), '')
      not in ('sales','recruteur','utilisateur')
    or id::text = (select p.cons_id from public.profiles p where p.id = auth.uid())
    or lower(coalesce(email,'')) = lower(coalesce(public.my_email(), '\x00'))
  );
