-- ══ Journalisation (audit log) au niveau base ══
-- Appliquée en prod via Supabase MCP.
--
-- Capture INSERT/UPDATE/DELETE sur les tables sensibles, quelle que soit la
-- source (client, edge function, SQL) — approche robuste/inviolable vs un log
-- applicatif que le client peut contourner. Écrit dans la table existante
-- activity_logs (lue par l'app dans « Gestion des accès › Journal d'activité »).
-- SECURITY DEFINER → l'insertion contourne la RLS ; la LECTURE reste cloisonnée
-- par company_id (policy rls_activity_logs).

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  j jsonb; jold jsonb; jnew jsonb;
  _cid uuid; _rid text; _label text;
  _email text; _name text; _role text; _details text; _changed text[];
begin
  if TG_OP='DELETE' then j := to_jsonb(OLD); else j := to_jsonb(NEW); end if;
  _cid := coalesce(nullif(j->>'company_id','')::uuid, nullif(j->>'id','')::uuid);
  _rid := j->>'id';
  _label := coalesce(nullif(j->>'name',''), nullif(j->>'title',''),
                     nullif(btrim(coalesce(j->>'first_name','')||' '||coalesce(j->>'last_name','')),''), '');
  select email into _email from auth.users where id = auth.uid();
  select nullif(btrim(coalesce(first_name,'')||' '||coalesce(last_name,'')),''), role
    into _name, _role from public.profiles where id = auth.uid();

  if TG_OP='UPDATE' then
    jold := to_jsonb(OLD); jnew := to_jsonb(NEW);
    _changed := array(select key from jsonb_object_keys(jnew) key
                      where (jnew->key) is distinct from (jold->key)
                        and key not in ('updated_at'));
    if _changed is null or array_length(_changed,1) is null then
      return NEW;
    end if;
    _details := (case when _label<>'' then _label||' — ' else '' end)
                ||'champs modifiés: '||array_to_string(_changed, ', ');
  else
    _details := _label;
  end if;

  insert into public.activity_logs(
    id, company_id, user_email, user_name, user_role,
    action, entity_type, entity_id, details, created_at)
  values (
    gen_random_uuid(), _cid,
    coalesce(_email,'système'), coalesce(_name,'système'), coalesce(_role,'system'),
    TG_OP, TG_TABLE_NAME, _rid, left(_details, 500), now());

  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

do $$ declare t text;
begin
  foreach t in array array['consultants','missions','leaves','candidates',
      'crm_opportunities','crm_accounts','crm_contacts',
      'profiles','companies','settings','company_settings']
  loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
