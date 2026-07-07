// Edge Function : crée une session Stripe Checkout (abonnement) pour l'ESN.
// Appelée par la page pricing du site. Pas de JWT (checkout public) — on
// n'accepte que nos price_id (allowlist), donc aucune donnée sensible exposée.
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

// Prix autorisés (mensuel + annuel) — mêmes IDs que le catalogue Stripe.
const ALLOWED = new Set<string>([
  "price_1TqUYFA6guMn7iZUAYWbMGfR", "price_1TqUYGA6guMn7iZUzeoBFm9V", // Consultant m/a
  "price_1TqUYHA6guMn7iZUhwKFDqQQ", "price_1TqUYJA6guMn7iZUIzsPv23E", // Recruteur
  "price_1TqUYKA6guMn7iZUBf840s9D", "price_1TqUYLA6guMn7iZUKzu8PByk", // Business Manager
  "price_1TqUYNA6guMn7iZUW0TAySfr", "price_1TqUYPA6guMn7iZUGUuT6aaP", // Directeur
  "price_1TqUYQA6guMn7iZUdOwh2sri", "price_1TqUYRA6guMn7iZU0VqsQlIt", // Admin
  "price_1TqUYTA6guMn7iZUVdiYjBhI", "price_1TqUYUA6guMn7iZUtB7aYGuq", // Super Admin
  "price_1TqUYVA6guMn7iZUr72z01vh", "price_1TqUYXA6guMn7iZUllYZc79I", // Module Business
  "price_1TqUYYA6guMn7iZUkwyVkWpb", "price_1TqUYZA6guMn7iZUwngF93eZ", // Module Recrutement
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    const { items, company_id, email, success_url, cancel_url } = await req.json();
    if (!Array.isArray(items) || !items.length) return json({ error: "items requis" }, 400);

    const line_items = items
      .filter((i) => ALLOWED.has(i?.price_id) && Number(i?.quantity) > 0)
      .map((i) => ({ price: i.price_id, quantity: Math.floor(Number(i.quantity)) }));
    if (!line_items.length) return json({ error: "aucune ligne valide" }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      customer_email: email || undefined,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      // Récupère le n° SIREN/TVA pour la facture Qonto :
      tax_id_collection: { enabled: true },
      success_url: success_url || "https://konsilys.fr/app?checkout=success",
      cancel_url: cancel_url || "https://konsilys.fr/#tarifs",
      metadata: { company_id: company_id || "" },
      subscription_data: { metadata: { company_id: company_id || "" } },
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("create-checkout:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
