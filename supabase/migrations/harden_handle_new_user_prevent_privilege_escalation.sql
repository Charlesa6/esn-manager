-- P0-1 (audit sécurité) : durcissement de handle_new_user contre l'escalade de
-- privilèges et la prise de contrôle cross-tenant.
-- Avant : le trigger faisait confiance au company_id ET au role fournis par le
-- client à l'inscription (index.html / esn_login.html signUp). Un membre pouvait
-- se créer un compte super_admin sans payer, et rejoindre n'importe quelle
-- entreprise dont le company_id fuit.
-- Après : les métadonnées ne sont fiables que si le compte vient de l'API admin
-- (inviteUserByEmail => invited_at posé = sièges payés). Pour un self-signup vers
-- une entreprise EXISTANTE, le rattachement n'est autorisé que si une invitation
-- valide existe (table invites) et le rôle vient de l'invitation, jamais du client.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _company uuid;
  _co_name text;
  _provided uuid;
  _exists boolean;
  _invite_role text;
BEGIN
  _co_name := coalesce(NEW.raw_user_meta_data->>'company_name', 'Entreprise');
  _role := coalesce(NEW.raw_user_meta_data->>'role', 'gestionnaire');
  IF _role NOT IN ('gestionnaire','admin','utilisateur','super_admin','recruteur','sales') THEN
    _role := 'gestionnaire';
  END IF;

  BEGIN _provided := (NEW.raw_user_meta_data->>'company_id')::uuid;
  EXCEPTION WHEN others THEN _provided := NULL; END;

  IF NEW.invited_at IS NOT NULL THEN
    -- Créé par l'API admin (inviteUserByEmail) : sièges payés provisionnés par le
    -- webhook. Métadonnées posées côté serveur => fiables.
    _company := coalesce(_provided, gen_random_uuid());
    INSERT INTO public.companies (id, name) VALUES (_company, _co_name) ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Self-signup : company_id/role du client NON fiables.
    _exists := _provided IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE id = _provided);
    IF _exists THEN
      -- Rejoindre une entreprise existante uniquement via une invitation valide.
      SELECT role INTO _invite_role FROM public.invites
        WHERE lower(email) = lower(NEW.email) AND used = false AND company_id = _provided
        ORDER BY created_at DESC LIMIT 1;
      IF _invite_role IS NOT NULL THEN
        _company := _provided;
        IF _invite_role IN ('gestionnaire','admin','utilisateur','super_admin','recruteur','sales') THEN
          _role := _invite_role; -- rôle depuis l'invitation serveur, jamais du client
        ELSE
          _role := 'gestionnaire';
        END IF;
      ELSE
        -- Aucune invitation => interdit de rejoindre. Espace neuf (vide, non payé).
        _company := gen_random_uuid();
        INSERT INTO public.companies (id, name) VALUES (_company, _co_name);
      END IF;
    ELSE
      -- Nouvelle entreprise (owner fondateur).
      _company := coalesce(_provided, gen_random_uuid());
      INSERT INTO public.companies (id, name) VALUES (_company, _co_name) ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, company_id, role, first_name, last_name, directeur_name, cons_id)
  VALUES (NEW.id, _company, _role, coalesce(NEW.raw_user_meta_data->>'first_name',''),
          coalesce(NEW.raw_user_meta_data->>'last_name',''), '', null)
  ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id, role=EXCLUDED.role,
    first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name;
  RETURN NEW;
END;
$function$;
