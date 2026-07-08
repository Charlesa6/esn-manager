-- ══ Audit RLS — durcissement des fonctions SECURITY DEFINER ══
-- Appliquée en prod via Supabase MCP.
--
-- L'advisor sécurité Supabase (lint 0011) signale un search_path mutable sur ces
-- fonctions SECURITY DEFINER : sans search_path fixe, un schéma malveillant placé
-- sur le search_path du rôle appelant peut détourner leur exécution. On le fige.
alter function public.my_company_id() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.use_invite(text) set search_path = public;
alter function public.get_invite_by_token(text) set search_path = public;
alter function public.accept_invite(text, text, text) set search_path = public;
alter function public.get_invite_by_email(text) set search_path = public;
alter function public.accept_invite_by_email(text, text) set search_path = public;

-- handle_new_user est une fonction de TRIGGER : elle n'a pas à être exposée en
-- RPC (le trigger s'exécute en tant que propriétaire de la table).
revoke execute on function public.handle_new_user() from anon, authenticated;
