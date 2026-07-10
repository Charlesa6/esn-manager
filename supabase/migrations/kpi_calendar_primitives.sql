-- Brique 2 (montée en charge) — fondation : primitives de calendrier en SQL,
-- reproduisant à l'identique le moteur JS (js/01-core.js) :
--   easter()  → Meeus/Jones/Butcher (grégorien)
--   frHols(y) → 11 jours fériés français (fixes + décalages de Pâques)
--   isWD/wDays → jours ouvrés (lun–ven hors fériés), bornes incluses
-- Fonctions PURES (immutable), non appelées par l'app : elles servent de socle au
-- port SQL des KPIs, validé par test de parité avant toute activation.

create or replace function public.konsilys_easter(y int)
returns date language plpgsql immutable as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mo int; dy int;
begin
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19*a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
  l := (32 + 2*e + 2*i - h - k) % 7; m := (a + 11*h + 22*l) / 451;
  mo := (h + l - 7*m + 114) / 31; dy := ((h + l - 7*m + 114) % 31) + 1;
  return make_date(y, mo, dy);
end $$;

create or replace function public.konsilys_fr_holidays(y int)
returns date[] language sql immutable as $$
  select array[
    make_date(y,1,1),               -- Jour de l'An
    public.konsilys_easter(y) + 1,  -- Lundi de Pâques
    make_date(y,5,1),               -- Fête du Travail
    make_date(y,5,8),               -- Victoire 1945
    public.konsilys_easter(y) + 39, -- Ascension
    public.konsilys_easter(y) + 50, -- Lundi de Pentecôte
    make_date(y,7,14),              -- Fête Nationale
    make_date(y,8,15),              -- Assomption
    make_date(y,11,1),              -- Toussaint
    make_date(y,11,11),             -- Armistice
    make_date(y,12,25)              -- Noël
  ];
$$;

-- Jour ouvré = ni week-end (dow 0=dim, 6=sam) ni férié de son année.
create or replace function public.konsilys_is_workday(d date)
returns boolean language sql immutable as $$
  select extract(dow from d) not in (0, 6)
     and d <> all (public.konsilys_fr_holidays(extract(year from d)::int));
$$;

-- Nombre de jours ouvrés sur [a, b] (bornes incluses ; 0 si a > b).
create or replace function public.konsilys_working_days(a date, b date)
returns int language sql immutable as $$
  select coalesce(count(*) filter (where public.konsilys_is_workday(g::date)), 0)::int
  from generate_series(a, b, interval '1 day') g;
$$;