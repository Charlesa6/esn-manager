-- add_set_member_manager_rpc
-- Permet à un admin/gestionnaire/super_admin de définir le N+1 (manager_id) d'un
-- membre de SON entreprise, sans ouvrir l'UPDATE complet des profils (la RLS
-- profiles reste limitée à soi-même). Ne modifie que manager_id.
-- Appliquée en prod via Supabase MCP (conservée ici pour référence).
create or replace function public.set_member_manager(p_member uuid, p_manager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _mrole text; _mcompany uuid; _tgt_company uuid; _mgr_company uuid;
begin
  select role, company_id into _mrole, _mcompany from public.profiles where id = auth.uid();
  if _mrole is null then raise exception 'Non authentifié'; end if;
  if _mrole not in ('admin','gestionnaire','super_admin') then
    raise exception 'Rôle insuffisant pour modifier la hiérarchie';
  end if;
  select company_id into _tgt_company from public.profiles where id = p_member;
  if _tgt_company is null or _tgt_company is distinct from _mcompany then
    raise exception 'Membre hors de votre entreprise';
  end if;
  if p_member = p_manager then raise exception 'Un membre ne peut pas être son propre N+1'; end if;
  if p_manager is not null then
    select company_id into _mgr_company from public.profiles where id = p_manager;
    if _mgr_company is null or _mgr_company is distinct from _mcompany then
      raise exception 'Responsable hors de votre entreprise';
    end if;
  end if;
  update public.profiles set manager_id = p_manager where id = p_member;
end $$;

grant execute on function public.set_member_manager(uuid, uuid) to authenticated;
