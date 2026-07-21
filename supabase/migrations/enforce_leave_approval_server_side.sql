-- P1 (audit sécurité E1) : impose CÔTÉ SERVEUR que seul un approbateur légitime
-- (supérieur hiérarchique, admin, directeur par nom, ou délégué actif) puisse
-- passer une absence à approved=true. Jusqu'ici la vérif N+1 n'existait que côté
-- client (js/14 approveLv) => auto-approbation possible via l'API REST.
--
-- ⚠️ NON APPLIQUÉ en prod (à valider avant application). Garde-fou intégré :
--    en cas de schéma inattendu le trigger échoue OUVERT (return NEW) pour ne pas
--    casser la fonctionnalité absences ; il ne bloque qu'une approbation
--    réellement non autorisée. Recommandé : peupler fiablement profiles.manager_id
--    avant d'activer, et tester une approbation légitime + une tentative REST.
create or replace function public.enforce_leave_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean := false; _dir text;
begin
  if coalesce(NEW.approved,false) = true
     and (TG_OP = 'INSERT' or coalesce(OLD.approved,false) is distinct from true) then
    if auth.role() = 'service_role' or auth.uid() is null then return NEW; end if;
    begin
      -- 1) admin / super_admin de l'entreprise
      if exists(select 1 from public.profiles p
                where p.id = auth.uid() and p.company_id = NEW.company_id
                  and p.role in ('admin','super_admin')) then ok := true; end if;
      -- 2) supérieur hiérarchique du demandeur (chaîne profiles.manager_id)
      if not ok then
        with recursive anc as (
          select manager_id as mid from public.profiles where cons_id = NEW.consultant_id::text
          union all
          select p.manager_id from public.profiles p join anc on p.id = anc.mid
            where p.manager_id is not null
        )
        select exists(select 1 from anc where mid = auth.uid()) into ok;
      end if;
      -- 3) fallback : directeur de la fiche par nom
      if not ok then
        select directeur into _dir from public.consultants where id = NEW.consultant_id;
        if _dir is not null and _dir <> '' and exists(
             select 1 from public.profiles p
             where p.id = auth.uid() and p.company_id = NEW.company_id
               and trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) = _dir)
        then ok := true; end if;
      end if;
      -- 4) délégué actif
      if not ok then
        if exists(
             select 1 from public.profiles d
             where d.company_id = NEW.company_id
               and d.approval_delegate_to::text = auth.uid()::text
               and (d.approval_delegate_until is null or d.approval_delegate_until::date >= current_date))
        then ok := true; end if;
      end if;
    exception when others then
      return NEW; -- schéma inattendu : pas de régression fonctionnelle
    end;
    if not ok then
      raise exception 'Approbation refusée : vous n''êtes pas l''approbateur de cette absence.'
        using errcode = '42501';
    end if;
  end if;
  return NEW;
end $$;
revoke execute on function public.enforce_leave_approval() from anon, authenticated;

drop trigger if exists trg_enforce_leave_approval on public.leaves;
create trigger trg_enforce_leave_approval
  before insert or update on public.leaves
  for each row execute function public.enforce_leave_approval();
