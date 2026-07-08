-- ══ Hiérarchie de Business Units (BU) ══
-- Appliquée en prod via Supabase MCP.
--
-- Chaque membre porte une BU (bu_id = id d'un nœud de l'arbre, arbre stocké dans
-- company_settings.settings.buTree côté app). Héritée automatiquement de
-- l'inviteur à la création du compte (via pending_seats.invited_by_id).

alter table public.profiles add column if not exists bu_id text;

-- Affectation d'une BU à un membre (super_admin / admin, même entreprise).
create or replace function public.set_member_bu(p_member uuid, p_bu text)
returns void language plpgsql security definer set search_path=public as $$
declare _mrole text; _mcompany uuid; _tgt uuid;
begin
  select role, company_id into _mrole, _mcompany from public.profiles where id=auth.uid();
  if _mrole is null then raise exception 'Non authentifié'; end if;
  if _mrole not in ('admin','super_admin') then raise exception 'Rôle insuffisant pour affecter une BU'; end if;
  select company_id into _tgt from public.profiles where id=p_member;
  if _tgt is null or _tgt is distinct from _mcompany then raise exception 'Membre hors de votre entreprise'; end if;
  update public.profiles set bu_id = nullif(p_bu,'') where id=p_member;
end $$;

-- Héritage automatique : à la création du profil, si aucune BU n'est fournie,
-- on reprend celle de l'inviteur (pending_seats.invited_by_id).
create or replace function public.inherit_bu() returns trigger
language plpgsql security definer set search_path=public as $$
declare _email text; _inviter uuid; _bu text;
begin
  if NEW.bu_id is not null then return NEW; end if;
  select email into _email from auth.users where id = NEW.id;
  if _email is null then return NEW; end if;
  select invited_by_id into _inviter from public.pending_seats
    where company_id = NEW.company_id and lower(email)=lower(_email)
    order by created_at desc limit 1;
  if _inviter is not null then
    select bu_id into _bu from public.profiles where id=_inviter;
    if _bu is not null then NEW.bu_id := _bu; end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_inherit_bu on public.profiles;
create trigger trg_inherit_bu before insert on public.profiles
  for each row execute function public.inherit_bu();
