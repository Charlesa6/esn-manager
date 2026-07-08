-- Durcissement des droits de modification d'unité (BU) :
--   • super_admin : n'importe qui, y compris lui-même
--   • admin       : uniquement ses subordonnés hiérarchiques (descendants via
--                   manager_id) qui ne sont PAS admin/super_admin — donc ses
--                   gestionnaires / business managers / recruteurs et les
--                   consultants de ses gestionnaires ; jamais lui-même
--   • autres rôles : interdit
create or replace function public.set_member_bu(p_member uuid, p_bu text)
returns void language plpgsql security definer set search_path=public as $$
declare _mrole text; _mcompany uuid; _tgt uuid; _trole text; _ok boolean := false;
begin
  select role, company_id into _mrole, _mcompany from public.profiles where id=auth.uid();
  if _mrole is null then raise exception 'Non authentifié'; end if;
  select company_id, role into _tgt, _trole from public.profiles where id=p_member;
  if _tgt is null or _tgt is distinct from _mcompany then raise exception 'Membre hors de votre entreprise'; end if;

  if _mrole = 'super_admin' then
    _ok := true;
  elsif _mrole = 'admin' then
    if p_member <> auth.uid() and _trole not in ('admin','super_admin') then
      with recursive sub as (
        select id from public.profiles where manager_id = auth.uid()
        union
        select p.id from public.profiles p join sub s on p.manager_id = s.id
      )
      select exists(select 1 from sub where id = p_member) into _ok;
    end if;
  end if;

  if not _ok then raise exception 'Droits insuffisants pour modifier cette unité'; end if;
  update public.profiles set bu_id = nullif(p_bu,'') where id=p_member;
end $$;
