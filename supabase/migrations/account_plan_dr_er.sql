-- ══ Plans de compte : DR / ER ═══════════════════════════════════════════════
-- Appliquée en prod via Supabase MCP ; ce fichier est le record.
--
-- Deux mesures du CA réalisé sur un compte :
--  • ER (External Revenue)  = tout le CA gagné sur le compte, AVEC OU SANS mes
--    consultants (= somme des opportunités gagnées).
--  • DR (Delivery Revenue)  = le CA délivré par MES consultants sur le compte.
-- Une affaire gagnée délivrée par mes consultants : ER = DR. Délivrée par
-- d'autres : ER seulement, DR = 0.
--
-- delivery_own porte l'information au niveau de l'opportunité (défaut true =
-- interne). Les revues de comité snapshotent DR et ER.

alter table public.crm_opportunities
  add column if not exists delivery_own boolean not null default true;

alter table public.account_reviews add column if not exists dr numeric;
alter table public.account_reviews add column if not exists er numeric;
