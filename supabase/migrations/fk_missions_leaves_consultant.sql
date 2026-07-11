-- ══ Intégrité référentielle : missions/leaves → consultants ══
-- Appliquée en prod via Supabase MCP. Avant cette migration, aucune FK ne reliait
-- missions.consultant_id / leaves.consultant_id à consultants.id : supprimer un
-- consultant laissait des missions/congés ORPHELINS (inexploitables, et sources de
-- confusion). On nettoie l'existant puis on pose les contraintes en CASCADE :
-- désormais supprimer un consultant supprime proprement ses missions et congés.
-- Idempotent (drop constraint if exists + create index if not exists).

-- 1. Purge des orphelins existants (consultant référencé mais absent).
delete from public.missions m
  where m.consultant_id is not null
    and not exists (select 1 from public.consultants c where c.id = m.consultant_id);
delete from public.leaves l
  where l.consultant_id is not null
    and not exists (select 1 from public.consultants c where c.id = l.consultant_id);

-- 2. Index sur la colonne référençante (les FK n'en créent pas ; utile pour les
--    jointures et les suppressions en cascade).
create index if not exists idx_missions_consultant on public.missions(consultant_id);
create index if not exists idx_leaves_consultant   on public.leaves(consultant_id);

-- 3. Contraintes de clé étrangère, suppression en cascade.
alter table public.missions drop constraint if exists missions_consultant_fk;
alter table public.missions add constraint missions_consultant_fk
  foreign key (consultant_id) references public.consultants(id) on delete cascade;

alter table public.leaves drop constraint if exists leaves_consultant_fk;
alter table public.leaves add constraint leaves_consultant_fk
  foreign key (consultant_id) references public.consultants(id) on delete cascade;
