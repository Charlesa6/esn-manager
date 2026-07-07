// Edge Function : webhook Stripe.
// A chaque évènement de paiement :
//   1) provisionne l'accès dans Supabase (enregistre l'abonnement + active les
//      modules de l'entreprise),
//   2) émet la facture correspondante depuis Qonto (API Qonto).
// Pas de JWT : Stripe appelle sans token, on vérifie la SIGNATURE Stripe.
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Qonto (facturation)
const QONTO_BASE = "https://thirdparty.qonto.com/v2";
const QONTO_AUTH = `${Deno.env.get("QONTO_LOGIN") ?? ""}:${Deno.env.get("QONTO_SECRET_KEY") ?? ""}`;
const QONTO_IBAN = Deno.env.get("QONTO_IBAN") ?? "";

// price_id -> nature de la ligne
type Ent = { kind: "licence" | "module"; ref: string; label: string };
const PRICE_MAP: Record<string, Ent> = {
  price_1TqUYFA6guMn7iZUAYWbMGfR: { kind: "licence", ref: "utilisateur", label: "Licence Consultant" },
  price_1TqUYGA6guMn7iZUzeoBFm9V: { kind: "licence", ref: "utilisateur", label: "Licence Consultant" },
  price_1TqUYHA6guMn7iZUhwKFDqQQ: { kind: "licence", ref: "recruteur", label: "Licence Recruteur" },
  price_1TqUYJA6guMn7iZUIzsPv23E: { kind: "licence", ref: "recruteur", label: "Licence Recruteur" },
  price_1TqUYKA6guMn7iZUBf840s9D: { kind: "licence", ref: "sales", label: "Licence Business Manager" },
  price_1TqUYLA6guMn7iZUKzu8PByk: { kind: "licence", ref: "sales", label: "Licence Business Manager" },
  price_1TqUYNA6guMn7iZUW0TAySfr: { kind: "licence", ref: "gestionnaire", label: "Licence Directeur" },
  price_1TqUYPA6guMn7iZUGUuT6aaP: { kind: "licence", ref: "gestionnaire", label: "Licence Directeur" },
  price_1TqUYQA6guMn7iZUdOwh2sri: { kind: "licence", ref: "admin", label: "Licence Admin" },
  price_1TqUYRA6guMn7iZU0VqsQlIt: { kind: "licence", ref: "admin", label: "Licence Admin" },
  price_1TqUYTA6guMn7iZUVdiYjBhI: { kind: "licence", ref: "super_admin", label: "Licence Super Admin" },
  price_1TqUYUA6guMn7iZUtB7aYGuq: { kind: "licence", ref: "super_admin", label: "Licence Super Admin" },
  price_1TqUYVA6guMn7iZUr72z01vh: { kind: "module", ref: "business", label: "Module Business Développement" },
  price_1TqUYXA6guMn7iZUllYZc79I: { kind: "module", ref: "business", label: "Module Business Développement" },
  price_1TqUYYA6guMn7iZUkwyVkWpb: { kind: "module", ref: "recrutement", label: "Module Recrutement" },
  price_1TqUYZA6guMn7iZUwngF93eZ: { kind: "module", ref: "recrutement", label: "Module Recrutement" },
};

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let evt: Stripe.Event;
  try {
    evt = await stripe.webhooks.constructEventAsync(body, sig!, WH_SECRET);
  } catch (e) {
    return new Response("Signature invalide: " + (e as Error).message, { status: 400 });
  }

  try {
    switch (evt.type) {
      case "checkout.session.completed": {
        const s = evt.data.object as Stripe.Checkout.Session;
        const companyId = s.metadata?.company_id || "";
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string, {
            expand: ["items.data.price"],
          });
          await recordSubscription(sub, companyId, s.customer_details?.email || s.customer_email || "");
          await applyModules(sub, companyId, true);
        }
        // Facture Qonto pour cette 1re échéance
        if (s.invoice) await safeQontoInvoice(s.invoice as string);
        break;
      }
      case "invoice.paid": {
        const inv = evt.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string, {
            expand: ["items.data.price"],
          });
          await recordSubscription(sub, sub.metadata?.company_id || "", inv.customer_email || "");
          await applyModules(sub, sub.metadata?.company_id || "", true);
          await safeQontoInvoice(inv.id);
        }
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = evt.data.object as Stripe.Subscription;
        if (evt.type === "customer.subscription.deleted" || sub.status === "canceled") {
          await recordSubscription(sub, sub.metadata?.company_id || "", "");
          await applyModules(sub, sub.metadata?.company_id || "", false); // coupe les modules
        }
        break;
      }
    }
    return new Response("ok");
  } catch (e) {
    console.error("webhook:", e);
    return new Response("Erreur: " + String((e as Error).message), { status: 500 });
  }
});

// ── Provisioning Supabase ──────────────────────────────────────────
function linesFromSub(sub: Stripe.Subscription) {
  return sub.items.data.map((it) => {
    const priceId = (it.price as Stripe.Price).id;
    const ent = PRICE_MAP[priceId];
    return {
      price_id: priceId,
      kind: ent?.kind || "licence",
      ref: ent?.ref || "utilisateur",
      quantity: it.quantity || 1,
      unit_amount: (it.price as Stripe.Price).unit_amount ?? 0,
    };
  });
}

async function recordSubscription(sub: Stripe.Subscription, companyId: string, email: string) {
  const row: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    status: sub.status,
    lines: linesFromSub(sub),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (companyId) row.company_id = companyId;
  if (email) row.customer_email = email;
  const { error } = await supa.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) console.error("upsert subscription:", error.message);
}

async function applyModules(sub: Stripe.Subscription, companyId: string, active: boolean) {
  if (!companyId) return; // prospect sans entreprise encore : appliqué à l'inscription (à venir)
  const refs = new Set(
    linesFromSub(sub).filter((l) => l.kind === "module").map((l) => l.ref),
  );
  const patch: Record<string, boolean> = {};
  if (refs.has("business")) patch.has_business_module = active;
  if (refs.has("recrutement")) patch.has_recrutement_module = active;
  if (!Object.keys(patch).length) return;
  const { error } = await supa.from("companies").update(patch).eq("id", companyId);
  if (error) console.error("update company modules:", error.message);
}

// ── Facturation Qonto ──────────────────────────────────────────────
async function safeQontoInvoice(stripeInvoiceId: string) {
  try {
    if (!QONTO_IBAN || QONTO_AUTH === ":") {
      console.warn("Qonto non configuré (secrets manquants) — facture ignorée.");
      return;
    }
    const inv = await stripe.invoices.retrieve(stripeInvoiceId, { expand: ["lines.data.price"] });
    await createQontoInvoice(inv);
  } catch (e) {
    // Une erreur de facturation ne doit pas casser le provisioning.
    console.error("Qonto invoice:", (e as Error).message);
  }
}

async function qonto(path: string, method: string, payload?: unknown) {
  const res = await fetch(QONTO_BASE + path, {
    method,
    headers: { Authorization: QONTO_AUTH, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) throw new Error(`Qonto ${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function getOrCreateQontoClient(inv: Stripe.Invoice): Promise<string> {
  const cd = inv.customer_address;
  const name = inv.customer_name || inv.customer_email || "Client";
  const email = inv.customer_email || undefined;
  // Réutiliser un client déjà enregistré pour cet abonnement
  if (inv.subscription) {
    const { data } = await supa.from("subscriptions")
      .select("qonto_client_id").eq("stripe_subscription_id", inv.subscription).maybeSingle();
    if (data?.qonto_client_id) return data.qonto_client_id as string;
  }
  const created = await qonto("/clients", "POST", {
    client: {
      kind: "company",
      name,
      email,
      currency: "EUR",
      locale: "FR",
      billing_address: {
        street_address: cd?.line1 || "N/A",
        city: cd?.city || "N/A",
        zip_code: cd?.postal_code || "00000",
        country_code: cd?.country || "FR",
      },
    },
  });
  const clientId = created?.client?.id;
  if (inv.subscription && clientId) {
    await supa.from("subscriptions").update({ qonto_client_id: clientId })
      .eq("stripe_subscription_id", inv.subscription);
  }
  return clientId;
}

async function createQontoInvoice(inv: Stripe.Invoice) {
  const clientId = await getOrCreateQontoClient(inv);
  const today = new Date().toISOString().slice(0, 10);
  const items = (inv.lines?.data || []).map((l) => {
    const priceId = (l.price as Stripe.Price | null)?.id || "";
    const label = PRICE_MAP[priceId]?.label || l.description || "Abonnement Konsilys";
    const qty = l.quantity || 1;
    const unit = ((l.price as Stripe.Price | null)?.unit_amount ?? Math.round((l.amount || 0) / qty)) / 100;
    return {
      title: label,
      quantity: String(qty),
      unit_price: { value: unit.toFixed(2), currency: "EUR" },
      vat_rate: "0",
    };
  });
  await qonto("/client_invoices", "POST", {
    client_id: clientId,
    currency: "EUR",
    issue_date: today,
    due_date: today,
    status: "unpaid",
    items,
    payment_methods: { iban: QONTO_IBAN },
    terms_and_conditions:
      "TVA non applicable, art. 293 B du CGI. Paiement encaissé via Stripe (réf. " + inv.id + ").",
  });
}
