-- Règle métier : super_admin peut modifier le N+1 de tout le monde ;
-- admin & gestionnaire uniquement de leurs subordonnés (jamais eux-mêmes ni une
-- personne au-dessus). Imposé côté serveur (l'UI le reflète via canEditMemberManager).
create or replace function public.set_member_manager(p_member uuid, p_manager uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare _mrole text; _mcompany uuid; _tgt_company uuid; _mgr_company uuid; _tgt_role text;
begin
  select role, company_id into _mrole, _mcompany from public.profiles where id = auth.uid();
  if _mrole is null then raise exception 'Non authentifié'; end if;
  if _mrole not in ('admin','gestionnaire','super_admin') then
    raise exception 'Rôle insuffisant pour modifier la hiérarchie';
  end if;
  select company_id, role into _tgt_company, _tgt_role from public.profiles where id = p_member;
  if _tgt_company is null or _tgt_company is distinct from _mcompany then
    raise exception 'Membre hors de votre entreprise';
  end if;
  if p_member = p_manager then raise exception 'Un membre ne peut pas être son propre N+1'; end if;

  if _mrole in ('admin','gestionnaire') then
    if p_member = auth.uid() then
      raise exception 'Vous ne pouvez pas modifier votre propre hiérarchie';
    end if;
    if _tgt_role in ('admin','super_admin') then
      raise exception 'Vous ne pouvez pas modifier la hiérarchie d''une personne au-dessus de vous';
    end if;
    if not exists (
      with recursive anc as (
        select manager_id as mid from public.profiles where id = p_member
        union all
        select pr.manager_id from public.profiles pr join anc on pr.id = anc.mid
          where pr.manager_id is not null
      )
      select 1 from anc where mid = auth.uid()
    ) then
      raise exception 'Vous ne pouvez modifier que la hiérarchie de votre équipe';
    end if;
  end if;

  if p_manager is not null then
    select company_id into _mgr_company from public.profiles where id = p_manager;
    if _mgr_company is null or _mgr_company is distinct from _mcompany then
      raise exception 'Responsable hors de votre entreprise';
    end if;
  end if;
  update public.profiles set manager_id = p_manager where id = p_member;
end $function$;
