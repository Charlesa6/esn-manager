-- P2 (audit perf, advisor auth_rls_initplan) : enveloppe les appels
-- auth.uid()/auth.role()/auth.jwt()/my_company_id()/my_role()/my_email() dans un
-- sous-select (SELECT ...) au sein des policies RLS, pour qu'ils soient évalués
-- UNE fois par requête (InitPlan) au lieu d'une fois par ligne.
-- Transactionnel : si une ALTER échoue, tout est annulé. Idempotent : ne
-- ré-enveloppe pas un appel déjà enveloppé.
do $$
declare
  r record;
  nq text;
  nc text;
  fns text[] := array['auth.uid()','auth.role()','auth.jwt()',
                      'my_company_id()','my_role()','my_email()'];
  f text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    nq := r.qual;
    nc := r.with_check;
    foreach f in array fns loop
      if nq is not null and position('(SELECT '||f||')' in nq) = 0 then
        nq := replace(nq, f, '(SELECT '||f||')');
      end if;
      if nc is not null and position('(SELECT '||f||')' in nc) = 0 then
        nc := replace(nc, f, '(SELECT '||f||')');
      end if;
    end loop;

    if nq is distinct from r.qual or nc is distinct from r.with_check then
      if r.qual is not null and r.with_check is not null then
        execute format('alter policy %I on public.%I using (%s) with check (%s)',
                       r.policyname, r.tablename, nq, nc);
      elsif r.qual is not null then
        execute format('alter policy %I on public.%I using (%s)',
                       r.policyname, r.tablename, nq);
      elsif r.with_check is not null then
        execute format('alter policy %I on public.%I with check (%s)',
                       r.policyname, r.tablename, nc);
      end if;
    end if;
  end loop;
end $$;
