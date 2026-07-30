// engagement-reminders : rappels d'échéance des engagements pris en comité de
// compte (KAM). Balaie chaque entreprise ayant configuré ses notifications et
// prévient le responsable de chaque action imminente (≤ 3 j) ou en retard, par
// email (Resend) et/ou Microsoft Teams (webhook entrant), selon ses réglages.
//
// Déclenchée par un cron quotidien (pg_cron + pg_net) — PAS de JWT utilisateur :
// déployer avec verify_jwt=false. L'accès est protégé par l'en-tête x-cron-secret
// comparé au secret CRON_SECRET. No-op sûr quand rien n'est configuré.
//
// Secrets attendus : CRON_SECRET, RESEND_API_KEY, RESEND_FROM (email et Teams
// sont chacun optionnels : sans clé Resend on saute l'email, sans webhook Teams
// on saute Teams).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Konsilys <notifications@konsilys.fr>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

// ── Miroir des règles front (js/09-business.js) ──────────────────────────────
const isAbandoned = (k: any) => !!k.abandoned;
const isDone = (k: any) =>
  !isAbandoned(k) && (k.status === "realise" || (!!k.date_realised && k.status !== "planifie"));
const isPlanned = (k: any) => !isDone(k) && !isAbandoned(k);
const daysUntil = (d: string | null, today: Date) =>
  d ? Math.round((Date.parse(d) - today.getTime()) / 86400000) : null;

const esc = (s: string) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const eur = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0));

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: "no_resend_key" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!r.ok) return { error: `resend ${r.status}: ${await r.text()}` };
  return { ok: true };
}

async function sendTeams(webhook: string, title: string, text: string, facts: any[]) {
  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "b91c1c",
    summary: title,
    sections: [{ activityTitle: title, text, facts }],
  };
  const r = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!r.ok) return { error: `teams ${r.status}: ${await r.text()}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET)
    return json({ error: "Interdit" }, 403);

  const svc = createClient(SUPA_URL, SERVICE);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const todayStr = today.toISOString().slice(0, 10);
  const horizon = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);

  const { data: settings, error: sErr } = await svc
    .from("notification_settings")
    .select("company_id, teams_webhook_url, digest_email, email_enabled, teams_enabled");
  if (sErr) return json({ error: sErr.message }, 500);

  const report: any = { companies: 0, emails: 0, teams: 0, activities: 0, errors: [] as string[] };

  for (const cfg of settings || []) {
    const emailOn = cfg.email_enabled !== false;
    const teamsOn = cfg.teams_enabled !== false && !!cfg.teams_webhook_url;
    if (!emailOn && !teamsOn) continue;

    // Actions candidates : échéance ≤ horizon (imminentes ou en retard), non
    // abandonnées, pas déjà relancées aujourd'hui.
    const { data: acts, error: aErr } = await svc
      .from("crm_activities")
      .select("id, title, account_id, next_action_date, assigned_to, status, date_realised, abandoned, reported_count, reminded_on")
      .eq("company_id", cfg.company_id)
      .eq("abandoned", false)
      .not("next_action_date", "is", null)
      .lte("next_action_date", horizon);
    if (aErr) { report.errors.push(aErr.message); continue; }

    const due = (acts || []).filter(
      (k) => isPlanned(k) && k.reminded_on !== todayStr && (daysUntil(k.next_action_date, today) ?? 99) <= 3,
    );
    if (!due.length) continue;
    report.companies++;

    // Contexte : noms de comptes + équipe (pour résoudre l'email du responsable).
    const accIds = [...new Set(due.map((k) => k.account_id).filter(Boolean))];
    const [{ data: accs }, { data: team }, { data: plans }] = await Promise.all([
      svc.from("crm_accounts").select("id, name").in("id", accIds),
      svc.from("account_team").select("account_id, member_name, member_email").in("account_id", accIds),
      svc.from("account_plans").select("account_id, owner_email").in("account_id", accIds),
    ]);
    const accName: Record<string, string> = {};
    (accs || []).forEach((a) => (accName[a.id] = a.name));
    const planEmail: Record<string, string> = {};
    (plans || []).forEach((p) => { if (p.owner_email) planEmail[p.account_id] = p.owner_email; });
    const teamEmail = (accId: string, who: string) => {
      const m = (team || []).find(
        (t) => t.account_id === accId && (t.member_name || "").trim() === (who || "").trim() && t.member_email,
      );
      return m?.member_email || "";
    };
    const resolveEmail = (k: any) =>
      teamEmail(k.account_id, k.assigned_to || "") || planEmail[k.account_id] || cfg.digest_email || "";

    const line = (k: any) => {
      const d = daysUntil(k.next_action_date, today) ?? 0;
      const when = d < 0 ? `en retard de ${-d} j` : d === 0 ? "aujourd'hui" : `dans ${d} j`;
      const acc = accName[k.account_id] || "Compte";
      return { k, d, when, acc };
    };

    // ── Email : un digest par personne responsable ────────────────────────────
    if (emailOn) {
      const byEmail: Record<string, any[]> = {};
      for (const k of due) {
        const to = resolveEmail(k);
        if (!to) continue;
        (byEmail[to] = byEmail[to] || []).push(k);
      }
      for (const [to, list] of Object.entries(byEmail)) {
        list.sort((a, b) => (daysUntil(a.next_action_date, today)! - daysUntil(b.next_action_date, today)!));
        const rows = list.map((k) => {
          const L = line(k);
          const col = L.d < 0 ? "#b91c1c" : "#b45309";
          return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(L.acc)}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(k.title || "Action")}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${col};font-weight:600;white-space:nowrap">${esc(L.when)}</td>
          </tr>`;
        }).join("");
        const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#0f172a;font-size:18px">Vos engagements à tenir</h2>
          <p style="color:#475569;font-size:14px">Vous avez ${list.length} action(s) dont l'échéance approche ou est dépassée&nbsp;:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead><tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase">
              <th style="padding:6px 10px">Compte</th><th style="padding:6px 10px">Action</th><th style="padding:6px 10px">Échéance</th>
            </tr></thead><tbody>${rows}</tbody>
          </table>
          <p style="margin-top:18px"><a href="https://konsilys.fr/app" style="background:#2563eb;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-size:14px">Ouvrir Konsilys</a></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px">Konsilys — Plans de compte</p>
        </div>`;
        const r = await sendEmail(to, `Konsilys — ${list.length} engagement(s) à tenir`, html);
        if (r.ok) report.emails++;
        else if (r.error) report.errors.push(r.error);
      }
    }

    // ── Teams : une carte par entreprise récapitulant les échéances ───────────
    if (teamsOn) {
      const sorted = due.slice().sort(
        (a, b) => (daysUntil(a.next_action_date, today)! - daysUntil(b.next_action_date, today)!),
      );
      const facts = sorted.slice(0, 20).map((k) => {
        const L = line(k);
        return { name: `${L.acc} — ${k.title || "Action"}`, value: `${L.when}${k.assigned_to ? " · " + k.assigned_to : ""}` };
      });
      const late = due.filter((k) => (daysUntil(k.next_action_date, today) ?? 0) < 0).length;
      const text = `**${due.length}** engagement(s) à surveiller${late ? ` · **${late}** en retard` : ""}.`;
      const r = await sendTeams(cfg.teams_webhook_url!, "⏰ Rappels d'engagements — Konsilys", text, facts);
      if (r.ok) report.teams++;
      else if (r.error) report.errors.push(r.error);
    }

    // ── Idempotence : marque relancé aujourd'hui ──────────────────────────────
    const ids = due.map((k) => k.id);
    const { error: uErr } = await svc.from("crm_activities").update({ reminded_on: todayStr }).in("id", ids);
    if (uErr) report.errors.push(uErr.message);
    report.activities += ids.length;
  }

  return json(report);
});
