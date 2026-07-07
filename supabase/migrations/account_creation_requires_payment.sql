-- account_creation_requires_payment
-- Le paiement devient la seule façon d'ouvrir un accès Konsilys.
-- Appliquée en prod via Supabase MCP (conservée ici pour référence).

-- 1) Verrou d'accès : une entreprise n'est utilisable qu'une fois payée.
--    Les entreprises déjà existantes sont conservées actives (grandfathering).
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT false;
UPDATE public.companies SET active = true WHERE active = false;  -- grandfather l'existant

-- Panier prévu au moment de l'inscription (permet de finaliser un paiement
-- abandonné sans re-saisir le tunnel).
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pending_cart jsonb;

-- 2) Sièges achetés pour d'autres personnes, en attente de provisionnement.
CREATE TABLE IF NOT EXISTS public.pending_seats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  first_name  text NOT NULL DEFAULT '',
  last_name   text NOT NULL DEFAULT '',
  email       text NOT NULL,
  role        text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',  -- pending | provisioned | error
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pending_seats_batch_idx   ON public.pending_seats(batch_id);
CREATE INDEX IF NOT EXISTS pending_seats_company_idx ON public.pending_seats(company_id);

ALTER TABLE public.pending_seats ENABLE ROW LEVEL SECURITY;

-- Les membres d'une entreprise peuvent lire les sièges en attente de leur société.
-- Les écritures se font uniquement via le service role (webhook / edge functions).
DROP POLICY IF EXISTS pending_seats_read_own_company ON public.pending_seats;
CREATE POLICY pending_seats_read_own_company ON public.pending_seats
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
