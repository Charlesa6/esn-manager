// seats-checkout : crée une session Stripe Checkout pour l'achat de licences,
// et enregistre les personnes (sièges) à provisionner après paiement.
//
// Deux usages, même code :
//   • 1re inscription : l'admin vient de créer son compte (entreprise inactive).
//     → une licence propriétaire (Admin ou Super Admin) est obligatoire.
//   • Ajout de sièges : une entreprise déjà active achète des licences pour
//     d'autres personnes. → pas de licence Admin requise.
//
// L'appelant doit être authentifié (JWT). Les écritures DB passent par le
// service role. Les comptes des collègues sont créés APRÈS paiement (webhook).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const STRIPE_KEY = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED = new Set<string>([
  "price_1TqUYFA6guMn7iZUAYWbMGfR", "price_1TqUYGA6guMn7iZUzeoBFm9V",
  "price_1TqUYHA6guMn7iZUhwKFDqQQ", "price_1TqUYJA6guMn7iZUIzsPv23E",
  "price_1TqUYKA6guMn7iZUBf840s9D", "price_1TqUYLA6guMn7iZUKzu8PByk",
  "price_1TqUYNA6guMn7iZUW0TAySfr", "price_1TqUYPA6guMn7iZUGUuT6aaP",
  "price_1TqUYQA6guMn7iZUdOwh2sri", "price_1TqUYRA6guMn7iZU0VqsQlIt",
  "price_1TqUYTA6guMn7iZUVdiYjBhI", "price_1TqUYUA6guMn7iZUtB7aYGuq",
  "price_1TqUYVA6guMn7iZUr72z01vh", "price_1TqUYXA6guMn7iZUllYZc79I",
  "price_1TqUYYA6guMn7iZUkwyVkWpb", "price_1TqUYZA6guMn7iZUwngF93eZ",
]);
// Licences « propriétaire » acceptées pour créer l'espace à la 1re inscription :
// Admin ou Super Admin (mensuel + annuel).
const OWNER_PRICES = new Set<string>([
  "price_1TqUYQA6guMn7iZUdOwh2sri", "price_1TqUYRA6guMn7iZU0VqsQlIt", // Admin
  "price_1TqUYTA6guMn7iZUVdiYjBhI", "price_1TqUYUA6guMn7iZUtB7aYGuq", // Super Admin
]);
const SEAT_ROLES = new Set<string>([
  "utilisateur", "recruteur", "sales", "gestionnaire", "admin", "super_admin",
]);

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    if (!STRIPE_KEY) return json({ error: "STRIPE_SECRET_KEY manquant côté serveur" }, 500);

    // Identifier l'appelant à partir de son JWT.
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const asUser = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: ures } = await asUser.auth.getUser();
    const user = ures?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const svc = createClient(SUPA_URL, SERVICE);
    const { data: prof } = await svc.from("profiles")
      .select("company_id, role").eq("id", user.id).maybeSingle();
    if (!prof?.company_id) return json({ error: "Profil introuvable" }, 400);
    const { data: co } = await svc.from("companies")
      .select("id, active").eq("id", prof.company_id).maybeSingle();

    const body = await req.json();
    const items = (Array.isArray(body?.items) ? body.items : [])
      .filter((i: any) => ALLOWED.has(i?.price_id) && Number(i?.quantity) > 0)
      .map((i: any) => ({ price_id: i.price_id, quantity: Math.floor(Number(i.quantity)) }));
    if (!items.length) return json({ error: "Aucune ligne valide" }, 400);

    const initial = !co?.active; // entreprise pas encore active => 1re inscription
    if (initial) {
      if (!["admin", "super_admin"].includes(prof.role)) return json({ error: "Seul un administrateur peut initier la création de l'entreprise." }, 403);
      if (!items.some((i: any) => OWNER_PRICES.has(i.price_id))) {
        return json({ error: "Ajoutez votre licence Admin ou Super Admin : elle donne les droits d'administration de votre espace ESN." }, 400);
      }
    } else if (!["admin", "gestionnaire", "super_admin"].includes(prof.role)) {
      return json({ error: "Droits insuffisants pour acheter des licences." }, 403);
    }

    // Personnes à provisionner (hors admin, déjà créé lors de l'inscription).
    const seats = (Array.isArray(body?.seats) ? body.seats : [])
      .map((s: any) => ({
        first_name: String(s?.first_name || "").trim(),
        last_name: String(s?.last_name || "").trim(),
        email: String(s?.email || "").trim().toLowerCase(),
        role: String(s?.role || ""),
      }))
      .filter((s: any) => s.email.includes("@") && SEAT_ROLES.has(s.role));

    const batchId = crypto.randomUUID();
    if (seats.length) {
      // invited_by_id = l'acheteur : il devient le N+1 de chaque personne provisionnée.
      const rows = seats.map((s: any) => ({ batch_id: batchId, company_id: prof.company_id, invited_by_id: user.id, ...s }));
      const { error: seatErr } = await svc.from("pending_seats").insert(rows);
      if (seatErr) return json({ error: "Enregistrement des sièges impossible : " + seatErr.message }, 500);
    }
    // Mémoriser le panier pour permettre de finaliser un paiement abandonné.
    await svc.from("companies").update({ pending_cart: { items, seats, batch_id: batchId } })
      .eq("id", prof.company_id);

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", safeBack(body?.success_url, "https://konsilys.fr/login?checkout=success"));
    form.set("cancel_url", safeBack(body?.cancel_url, "https://konsilys.fr/app"));
    form.set("billing_address_collection", "required");
    form.set("allow_promotion_codes", "true");
    form.set("tax_id_collection[enabled]", "true");
    form.set("customer_email", user.email || "");
    form.set("metadata[company_id]", prof.company_id);
    form.set("metadata[batch_id]", batchId);
    form.set("subscription_data[metadata][company_id]", prof.company_id);
    form.set("subscription_data[metadata][batch_id]", batchId);
    items.forEach((it: any, i: number) => {
      form.set(`line_items[${i}][price]`, it.price_id);
      form.set(`line_items[${i}][quantity]`, String(it.quantity));
    });

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message || "Erreur Stripe" }, 502);
    return json({ url: d.url });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
