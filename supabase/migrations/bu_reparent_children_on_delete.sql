-- P2 (audit DB) : intégrité des sous-arbres BU. business_units.parent_id est un
-- text sans FK ni ON DELETE ; supprimer une BU parente laissait ses enfants avec
-- un parent_id pointant dans le vide -> visibilité RLS (bu_in_subtree) cassée.
-- Ce trigger re-rattache les enfants au parent du noeud supprimé (grand-parent),
-- préservant la chaîne. Robuste même via un DELETE REST direct.
create or replace function public.bu_reparent_children()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.business_units
     set parent_id = old.parent_id
   where parent_id = old.id
     and company_id = old.company_id;
  return old;
end $$;
revoke execute on function public.bu_reparent_children() from anon, authenticated;

drop trigger if exists trg_bu_reparent on public.business_units;
create trigger trg_bu_reparent
  before delete on public.business_units
  for each row execute function public.bu_reparent_children();
