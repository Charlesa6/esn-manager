// bd-unsubscribe : lien de désinscription des emails de prospection Konsilys.
// GET  ?t=<unsub_token> → page de confirmation (lien cliqué dans l'email)
// POST ?t=<unsub_token> → désinscription en un clic (en-tête List-Unsubscribe-Post)
// Public (pas de JWT) : le jeton aléatoire par prospect fait office d'autorisation.
// ⚠️ Déployer avec verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (s: string, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return text("Méthode non autorisée", 405);
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!UUID.test(t)) return text("Lien de désinscription invalide.", 400);

  const { data: p, error } = await svc.from("bd_prospects")
    .select("id, email, opted_out_at").eq("unsub_token", t).maybeSingle();
  if (error) return text("Erreur temporaire, merci de réessayer ou d'écrire à contact@konsilys.fr.", 500);
  if (!p) return text("Lien de désinscription invalide.", 404);

  if (!p.opted_out_at) {
    await svc.from("bd_prospects")
      .update({ status: "desinscrit", opted_out_at: new Date().toISOString(), next_action_at: null, updated_at: new Date().toISOString() })
      .eq("id", p.id);
  }
  if (p.email) {
    await svc.from("bd_suppression").upsert({ email: p.email.toLowerCase(), reason: "desinscription" }, { onConflict: "email" });
  }
  return text("Votre désinscription est confirmée : vous ne recevrez plus d'emails de prospection de Konsilys.\n\nKonsilys · contact@konsilys.fr");
});
