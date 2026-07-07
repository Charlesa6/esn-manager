// Edge Function : webhook Stripe.
// A chaque évènement de paiement, provisionne l'accès dans Supabase
// (enregistre l'abonnement + active les modules de l'entreprise achetés).
// La facturation est gérée par Stripe (factures automatiques) — pas de Qonto.
// Pas de JWT : Stripe appelle sans token, on vérifie la SIGNATURE Stripe.
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const stripe = new Stripe((Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim(), {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
// .trim() : un secret collé avec un espace/retour-ligne parasite casse la vérif.
const WH_SECRET = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim();
// Deno : la vérification de signature Stripe nécessite le provider SubtleCrypto.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

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
    evt = await stripe.webhooks.constructEventAsync(body, sig!, WH_SECRET, undefined, cryptoProvider);
  } catch (e) {
    console.error("SIG_FAIL msg=", (e as Error).message,
      "| sigHeader=", sig ? "present" : "MISSING",
      "| secret=", WH_SECRET ? ("set:len" + WH_SECRET.length + ":" + WH_SECRET.slice(0, 6)) : "MISSING");
    return new Response("Signature invalide: " + (e as Error).message, { status: 400 });
  }

  try {
    switch (evt.type) {
      case "checkout.session.completed": {
        const s = evt.data.object as Stripe.Checkout.Session;
        const companyId = s.metadata?.company_id || "";
        const batchId = s.metadata?.batch_id || "";
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string, {
            expand: ["items.data.price"],
          });
          await recordSubscription(sub, companyId, s.customer_details?.email || s.customer_email || "");
          await applyModules(sub, companyId, true);
        }
        // Le paiement débloque l'accès : l'entreprise devient active et les
        // comptes des collègues achetés (sièges) sont provisionnés.
        if (companyId) await activateCompany(companyId);
        if (companyId && batchId) await provisionSeats(companyId, batchId);
        // Facturation gérée par Stripe (factures automatiques). Qonto désactivé.
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

// ── Activation & provisioning des comptes ──────────────────────────
// Le paiement est la SEULE façon d'ouvrir un accès : on active l'entreprise
// et on efface le panier mémorisé (utilisé pour finaliser un paiement abandonné).
async function activateCompany(companyId: string) {
  const { error } = await supa.from("companies")
    .update({ active: true, pending_cart: null }).eq("id", companyId);
  if (error) console.error("activateCompany:", error.message);
}

// Crée les comptes des personnes pour qui l'admin a payé une licence. Chacune
// reçoit un email avec un lien pour définir son mot de passe. Le trigger
// handle_new_user crée le profil (rôle + entreprise) à partir des métadonnées.
async function provisionSeats(companyId: string, batchId: string) {
  const { data: seats, error } = await supa.from("pending_seats")
    .select("*").eq("batch_id", batchId).eq("company_id", companyId).eq("status", "pending");
  if (error) { console.error("provisionSeats read:", error.message); return; }
  for (const seat of seats || []) {
    try {
      const { error: invErr } = await supa.auth.admin.inviteUserByEmail(seat.email, {
        data: {
          role: seat.role,
          company_id: companyId,
          first_name: seat.first_name,
          last_name: seat.last_name,
        },
        redirectTo: "https://konsilys.fr/login",
      });
      if (invErr) throw invErr;
      await supa.from("pending_seats").update({ status: "provisioned" }).eq("id", seat.id);
    } catch (e) {
      await supa.from("pending_seats")
        .update({ status: "error", error: String((e as Error).message).slice(0, 300) })
        .eq("id", seat.id);
    }
  }
}

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
