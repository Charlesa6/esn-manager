-- Garde serveur sur les modifications de fiche consultant :
--  • rattachement d'équipe (directeur / manager_id) → grade gestionnaire et au-dessus ;
--  • BU (bu_id) → uniquement le N+1 (manager_id = l'appelant) ou admin/super_admin.
-- Le service role (auth.uid() nul) n'est pas contraint (provisioning, imports).
-- Appliquée en prod via Supabase MCP.
create or replace function public.guard_consultant_team_bu() returns trigger
language plpgsql security definer set search_path=public as $$
declare _role text;
begin
  if auth.uid() is null then return NEW; end if;
  select role into _role from public.profiles where id = auth.uid();

  if (NEW.directeur is distinct from OLD.directeur)
     or (NEW.manager_id is distinct from OLD.manager_id) then
    if coalesce(_role,'') not in ('gestionnaire','admin','super_admin') then
      raise exception 'Seul un gestionnaire ou au-dessus peut modifier le rattachement d''équipe';
    end if;
  end if;

  if NEW.bu_id is distinct from OLD.bu_id then
    if coalesce(_role,'') in ('admin','super_admin') then return NEW; end if;
    if OLD.manager_id is not null and OLD.manager_id = auth.uid() then return NEW; end if;
    if NEW.manager_id is not null and NEW.manager_id = auth.uid() then return NEW; end if;
    raise exception 'Seul le N+1 (ou un admin) peut modifier la BU du consultant';
  end if;

  return NEW;
end $$;
drop trigger if exists trg_guard_consultant on public.consultants;
create trigger trg_guard_consultant before update on public.consultants
  for each row execute function public.guard_consultant_team_bu();
