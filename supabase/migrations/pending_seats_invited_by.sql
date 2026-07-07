-- pending_seats_invited_by
-- Mémorise l'acheteur d'un siège pour le définir comme N+1 de la personne
-- provisionnée au paiement. Appliquée en prod via Supabase MCP.
ALTER TABLE public.pending_seats ADD COLUMN IF NOT EXISTS invited_by_id uuid;
