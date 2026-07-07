// create-checkout : crée une session Stripe Checkout (abonnement).
// Appel direct API Stripe via fetch (aucun SDK à charger) -> surface d'erreur
// minimale, CORS garanti sur tous les chemins.
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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "STRIPE_SECRET_KEY manquant côté serveur" }, 500);

    const { items, company_id, email, success_url, cancel_url } = await req.json();
    const valid = (Array.isArray(items) ? items : [])
      .filter((i) => ALLOWED.has(i?.price_id) && Number(i?.quantity) > 0);
    if (!valid.length) return json({ error: "aucune ligne valide" }, 400);

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", success_url || "https://konsilys.fr/login?checkout=success");
    form.set("cancel_url", cancel_url || "https://konsilys.fr/#abonnement");
    form.set("billing_address_collection", "required");
    form.set("allow_promotion_codes", "true");
    form.set("tax_id_collection[enabled]", "true");
    if (email) form.set("customer_email", String(email));
    form.set("metadata[company_id]", company_id || "");
    form.set("subscription_data[metadata][company_id]", company_id || "");
    valid.forEach((it, i) => {
      form.set(`line_items[${i}][price]`, it.price_id);
      form.set(`line_items[${i}][quantity]`, String(Math.floor(Number(it.quantity))));
    });

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const d = await r.json();
    if (!r.ok) return json({ error: d?.error?.message || "Erreur Stripe" }, 502);
    return json({ url: d.url });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
