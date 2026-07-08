// retry-seats : relance le provisioning des sièges restés en attente ou en
// erreur pour l'entreprise de l'appelant (email déjà pris, incident réseau…).
// Réservé aux rôles d'administration. Mêmes opérations que le webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

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

const SEAT_GRADE: Record<string, string> = { sales: "sales_grade" };
const SEAT_TITLE: Record<string, string> = {
  sales: "Business Manager", recruteur: "Recruteur", gestionnaire: "Gestionnaire",
  admin: "Admin", super_admin: "Super Admin", utilisateur: "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const asUser = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: ures } = await asUser.auth.getUser();
    const user = ures?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const svc = createClient(SUPA_URL, SERVICE);
    const { data: prof } = await svc.from("profiles")
      .select("company_id, role").eq("id", user.id).maybeSingle();
    if (!prof?.company_id) return json({ error: "Profil introuvable" }, 400);
    if (!["admin", "gestionnaire", "super_admin"].includes(prof.role)) {
      return json({ error: "Droits insuffisants." }, 403);
    }

    const companyId = prof.company_id;
    const { data: seats, error } = await svc.from("pending_seats")
      .select("*").eq("company_id", companyId).in("status", ["pending", "error"]);
    if (error) return json({ error: error.message }, 500);

    let ok = 0, ko = 0;
    for (const seat of seats || []) {
      try {
        const invite = await svc.auth.admin.inviteUserByEmail(seat.email, {
          data: { role: seat.role, company_id: companyId, first_name: seat.first_name, last_name: seat.last_name },
          redirectTo: "https://konsilys.fr/login",
        });
        if (invite.error) throw invite.error;
        const newUserId = invite.data?.user?.id || null;
        const fullName = ((seat.first_name || "") + " " + (seat.last_name || "")).trim() || seat.email;
        const { data: fiche } = await svc.from("consultants").insert({
          company_id: companyId, name: fullName,
          title: SEAT_TITLE[seat.role] ?? "", grade: SEAT_GRADE[seat.role] ?? "",
          email: seat.email, manager_id: seat.invited_by_id || null, scr: 0, contract: "salarie",
        }).select("id").single();
        if (newUserId) {
          await svc.from("profiles").update({
            manager_id: seat.invited_by_id || null,
            cons_id: fiche?.id ? String(fiche.id) : null,
          }).eq("id", newUserId);
        }
        await svc.from("pending_seats").update({ status: "provisioned", error: null }).eq("id", seat.id);
        ok++;
      } catch (e) {
        await svc.from("pending_seats")
          .update({ status: "error", error: String((e as Error).message).slice(0, 300) })
          .eq("id", seat.id);
        ko++;
      }
    }
    return json({ ok, ko, total: (seats || []).length });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
