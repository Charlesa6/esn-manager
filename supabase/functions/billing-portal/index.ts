// billing-portal : ouvre le Portail Client Stripe pour l'entreprise de
// l'appelant (résilier, prolonger/réactiver, changer de carte, voir les
// factures). Réservé aux rôles d'administration (propriétaire de la facturation).
// Bootstrap : si aucune configuration de portail n'existe côté Stripe, on en
// crée une (résiliation en fin de période) et on la marque par défaut.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const STRIPE_KEY = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

const safeBack = (u: unknown, fallback: string): string => {
  try {
    const p = new URL(String(u));
    const ok = p.protocol === "https:" &&
      (p.hostname === "konsilys.fr" || p.hostname.endsWith(".konsilys.fr") ||
       p.hostname.endsWith(".vercel.app"));
    return ok ? p.toString() : fallback;
  } catch { return fallback; }
};

async function stripe(path: string, form: URLSearchParams) {
  const r = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  return { ok: r.ok, data: await r.json() };
}

// Crée (une fois) une configuration de portail et la définit par défaut.
async function ensureConfig(): Promise<void> {
  const f = new URLSearchParams();
  f.set("business_profile[headline]", "Konsilys — Gérez votre abonnement");
  f.set("default_return_url", "https://konsilys.fr/app");
  f.set("features[invoice_history][enabled]", "true");
  f.set("features[payment_method_update][enabled]", "true");
  f.set("features[customer_update][enabled]", "true");
  f.set("features[customer_update][allowed_updates][]", "email");
  f.append("features[customer_update][allowed_updates][]", "address");
  f.append("features[customer_update][allowed_updates][]", "tax_id");
  f.set("features[subscription_cancel][enabled]", "true");
  f.set("features[subscription_cancel][mode]", "at_period_end");
  f.set("is_default", "true");
  await stripe("billing_portal/configurations", f);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    if (!STRIPE_KEY) return json({ error: "STRIPE_SECRET_KEY manquant côté serveur" }, 500);

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const asUser = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: ures } = await asUser.auth.getUser();
    const user = ures?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const svc = createClient(SUPA_URL, SERVICE);
    const { data: prof } = await svc.from("profiles")
      .select("company_id, role").eq("id", user.id).maybeSingle();
    if (!prof?.company_id) return json({ error: "Profil introuvable" }, 400);
    if (!["admin", "super_admin"].includes(prof.role)) {
      return json({ error: "Seul un administrateur peut gérer l'abonnement." }, 403);
    }

    // Identifiant client Stripe de l'entreprise (via l'abonnement enregistré).
    const { data: sub } = await svc.from("subscriptions")
      .select("stripe_customer_id, created_at").eq("company_id", prof.company_id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const customer = sub?.stripe_customer_id;
    if (!customer) return json({ error: "Aucun abonnement Stripe trouvé pour votre entreprise." }, 400);

    const body = await req.json().catch(() => ({}));
    const return_url = safeBack(body?.return_url, "https://konsilys.fr/app");

    const mk = () => {
      const f = new URLSearchParams();
      f.set("customer", String(customer));
      f.set("return_url", return_url);
      return stripe("billing_portal/sessions", f);
    };

    let res = await mk();
    // Si aucune configuration de portail n'existe encore, on la crée puis on réessaie.
    if (!res.ok && String(res.data?.error?.message || "").toLowerCase().includes("configuration")) {
      await ensureConfig();
      res = await mk();
    }
    if (!res.ok) return json({ error: res.data?.error?.message || "Erreur Stripe" }, 502);
    return json({ url: res.data.url });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
