alter table public.candidates add column if not exists comptes_rendus jsonb default '[]'::jsonb;
