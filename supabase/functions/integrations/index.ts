// integrations : couche de connecteurs API vers les outils du marché.
//
// Objectif — permettre à une ESN (ex : CGI) de brancher Konsilys sur :
//   • Microsoft 365 / Entra ID (Azure AD)     — annuaire & SSO (écosystème CGI)
//   • les SIRH leaders (Workday, SuccessFactors, Lucca, BambooHR)
//   • la Paie (Silae, PayFit, ADP)
//   • la Facturation (Pennylane, Sage, Sellsy, QuickBooks)
//
// Chaque connecteur est DÉSACTIVÉ par défaut. Rien ne part vers un tiers tant que
// le super_admin n'a pas saisi ses identifiants et testé la connexion.
//
// Actions (POST JSON { action, ... }) :
//   list    → catalogue + connecteurs enregistrés (secrets masqués) + journal
//   save    → enregistre la config (fusion des secrets)
//   test    → teste la connexion (identifiants stockés)
//   sync    → aperçu lecture seule (échantillon d'enregistrements)
//   people  → renvoie les collaborateurs normalisés {name,email,title,start} pour
//             l'import (SIRH / annuaire). L'écriture des consultants est faite côté
//             app (RLS), après aperçu + confirmation.
//   remove  → supprime le connecteur
//
// Sécurité : verify_jwt=true, rôle super_admin exigé, cloisonné par company_id.
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

type Field = { key: string; label: string; secret?: boolean; ph?: string; help?: string };
type Provider = { id: string; category: string; name: string; vendor: string; icon: string; desc: string; docs: string; fields: Field[]; resource: string; canImport?: boolean };

// Les catégories dont on peut importer des collaborateurs vers les consultants.
const IMPORT_CATS = ["sso_directory", "hr"];

const CATALOG: Provider[] = [
  { id: "microsoft_graph", category: "sso_directory", name: "Microsoft 365 / Entra ID", vendor: "Microsoft (CGI)", icon: "🟦", desc: "Annuaire Entra ID (Azure AD) : utilisateurs, groupes, SSO — le socle d'identité de CGI.", docs: "https://learn.microsoft.com/graph/auth-v2-service", resource: "utilisateurs", fields: [ { key: "tenant_id", label: "Tenant ID (Directory ID)", ph: "contoso.onmicrosoft.com ou GUID" }, { key: "client_id", label: "Client ID (App registration)" }, { key: "client_secret", label: "Client secret", secret: true } ] },
  { id: "workday", category: "hr", name: "Workday HCM", vendor: "Workday", icon: "🟠", desc: "SIRH global : collaborateurs, organisations, postes. Standard des grands groupes.", docs: "https://community.workday.com/rest-api", resource: "collaborateurs", fields: [ { key: "host", label: "Hôte API", ph: "wd3-services1.workday.com" }, { key: "tenant", label: "Tenant", ph: "acme" }, { key: "username", label: "Utilisateur ISU", ph: "isu_konsilys@acme" }, { key: "password", label: "Mot de passe / secret", secret: true } ] },
  { id: "successfactors", category: "hr", name: "SAP SuccessFactors", vendor: "SAP", icon: "🔵", desc: "SIRH SAP (OData) : Employee Central, collaborateurs et données RH.", docs: "https://help.sap.com/docs/SAP_SUCCESSFACTORS_PLATFORM", resource: "collaborateurs", fields: [ { key: "api_server", label: "Serveur API", ph: "api4.successfactors.com" }, { key: "company_id", label: "Company ID", ph: "acmeCorp" }, { key: "api_user", label: "Utilisateur API", ph: "sfadmin" }, { key: "password", label: "Mot de passe", secret: true } ] },
  { id: "lucca", category: "hr", name: "Lucca", vendor: "Lucca", icon: "🟣", desc: "SIRH français leader ESN : collaborateurs, congés, entretiens (API v3).", docs: "https://developers.lucca.fr/", resource: "collaborateurs", fields: [ { key: "subdomain", label: "Sous-domaine", ph: "acme (→ acme.ilucca.net)" }, { key: "api_key", label: "Clé API", secret: true } ] },
  { id: "bamboohr", category: "hr", name: "BambooHR", vendor: "BambooHR", icon: "🟢", desc: "SIRH : annuaire des employés, données RH (API REST).", docs: "https://documentation.bamboohr.com/reference", resource: "employés", fields: [ { key: "subdomain", label: "Sous-domaine", ph: "acme (→ .bamboohr.com)" }, { key: "api_key", label: "Clé API", secret: true } ] },
  { id: "silae", category: "payroll", name: "Silae", vendor: "Silae", icon: "🟡", desc: "Paie française leader : dossiers, bulletins, éléments variables (API bearer).", docs: "https://www.silae.fr/", resource: "dossiers", fields: [ { key: "base_url", label: "URL de base API", ph: "https://api.silae.fr" }, { key: "api_key", label: "Clé API / token", secret: true }, { key: "probe_path", label: "Chemin de test", ph: "/v1/dossiers", help: "À confirmer auprès de Silae." } ] },
  { id: "payfit", category: "payroll", name: "PayFit", vendor: "PayFit", icon: "🔷", desc: "Paie & RH : collaborateurs, contrats, absences (Public API).", docs: "https://developers.payfit.com/", resource: "collaborateurs", fields: [ { key: "company_id", label: "Company ID PayFit" }, { key: "api_key", label: "Clé API (Bearer)", secret: true } ] },
  { id: "adp", category: "payroll", name: "ADP", vendor: "ADP", icon: "🔴", desc: "Paie & HCM : workers, rémunérations (OAuth2). Requiert un certificat mTLS.", docs: "https://developers.adp.com/", resource: "workers", fields: [ { key: "client_id", label: "Client ID" }, { key: "client_secret", label: "Client secret", secret: true, help: "Le mTLS ADP nécessite une configuration réseau dédiée." } ] },
  { id: "pennylane", category: "billing", name: "Pennylane", vendor: "Pennylane", icon: "🟩", desc: "Facturation & compta française : factures clients, devis (API externe v1).", docs: "https://pennylane.readme.io/", resource: "factures clients", fields: [ { key: "api_token", label: "Token API", secret: true } ] },
  { id: "sage_accounting", category: "billing", name: "Sage Business Cloud", vendor: "Sage", icon: "🟢", desc: "Compta & facturation : factures de vente (API v3.1, OAuth2 bearer).", docs: "https://developer.sage.com/accounting/", resource: "factures de vente", fields: [ { key: "access_token", label: "Access token (OAuth2)", secret: true } ] },
  { id: "sellsy", category: "billing", name: "Sellsy", vendor: "Sellsy", icon: "🟠", desc: "CRM & facturation français : factures, clients (API v2, client credentials).", docs: "https://api.sellsy.com/doc/v2/", resource: "factures", fields: [ { key: "client_id", label: "Client ID" }, { key: "client_secret", label: "Client secret", secret: true } ] },
  { id: "quickbooks", category: "billing", name: "QuickBooks Online", vendor: "Intuit", icon: "🟩", desc: "Compta & facturation : factures (API v3, OAuth2 bearer).", docs: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice", resource: "factures", fields: [ { key: "realm_id", label: "Realm ID (Company ID)" }, { key: "access_token", label: "Access token (OAuth2)", secret: true } ] },
].map((p) => ({ ...p, canImport: IMPORT_CATS.includes(p.category) }));
const byId = (id: string) => CATALOG.find((p) => p.id === id);

type Person = { name: string; email: string; title: string; start: string };
type Pull = { count: number; items: string[]; records?: Person[] };
type Cfg = Record<string, string>;

async function timedFetch(url: string, init: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
function need(cfg: Cfg, keys: string[]) { const m = keys.filter((k) => !cfg[k]); if (m.length) throw new Error("Champs manquants : " + m.join(", ")); }
async function txt(r: Response) { return (await r.text()).slice(0, 300); }
function sageItems(d: Record<string, unknown>): Record<string, string>[] { if (Array.isArray(d)) return d as Record<string, string>[]; return (d["$items"] as Record<string, string>[]) || (d.sales_invoices as Record<string, string>[]) || []; }
const P = (name: unknown, email: unknown, title: unknown = "", start: unknown = ""): Person => ({ name: String(name || "").trim(), email: String(email || "").trim(), title: String(title || "").trim(), start: String(start || "").trim() });
const peopleItems = (recs: Person[]) => recs.map((r) => r.name + (r.email ? " <" + r.email + ">" : ""));

const PULL: Record<string, (cfg: Cfg, limit: number) => Promise<Pull>> = {
  async microsoft_graph(cfg, limit) {
    need(cfg, ["tenant_id", "client_id", "client_secret"]);
    const tok = await timedFetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant_id)}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cfg.client_id, client_secret: cfg.client_secret, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }) });
    if (!tok.ok) throw new Error("Auth Entra ID échouée (" + tok.status + ") : " + await txt(tok));
    const at = (await tok.json()).access_token;
    const r = await timedFetch(`https://graph.microsoft.com/v1.0/users?$top=${Math.min(limit, 999)}&$select=displayName,mail,userPrincipalName,jobTitle`, { headers: { Authorization: "Bearer " + at } });
    if (!r.ok) throw new Error("Graph /users (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const records = (d.value || []).map((u: Record<string, string>) => P(u.displayName, u.mail || u.userPrincipalName, u.jobTitle));
    return { count: records.length, items: peopleItems(records), records };
  },
  async workday(cfg, limit) {
    need(cfg, ["host", "tenant", "username", "password"]);
    const r = await timedFetch(`https://${cfg.host}/ccx/api/v1/${encodeURIComponent(cfg.tenant)}/workers?limit=${limit}`, { headers: { Authorization: "Basic " + b64(cfg.username + ":" + cfg.password) } });
    if (!r.ok) throw new Error("Workday /workers (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const records = (d.data || []).map((w: Record<string, string>) => P(w.descriptor || w.id, "", ""));
    return { count: d.total ?? records.length, items: peopleItems(records), records };
  },
  async successfactors(cfg, limit) {
    need(cfg, ["api_server", "company_id", "api_user", "password"]);
    const r = await timedFetch(`https://${cfg.api_server}/odata/v2/User?$top=${limit}&$format=json&$select=defaultFullName,email,title`, { headers: { Authorization: "Basic " + b64(`${cfg.api_user}@${cfg.company_id}:${cfg.password}`), Accept: "application/json" } });
    if (!r.ok) throw new Error("SuccessFactors /User (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = d?.d?.results || [];
    const records = rows.map((u: Record<string, string>) => P(u.defaultFullName, u.email, u.title));
    return { count: records.length, items: peopleItems(records), records };
  },
  async lucca(cfg, limit) {
    need(cfg, ["subdomain", "api_key"]);
    const r = await timedFetch(`https://${cfg.subdomain}.ilucca.net/api/v3/users?paging=0,${limit}&fields=name,mail,jobTitle,dtContractStart`, { headers: { Authorization: "lucca application=" + cfg.api_key } });
    if (!r.ok) throw new Error("Lucca /users (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = d?.data?.items || [];
    const records = rows.map((u: Record<string, string>) => P(u.name, u.mail, u.jobTitle, (u.dtContractStart || "").slice(0, 10)));
    return { count: d?.data?.count ?? records.length, items: peopleItems(records), records };
  },
  async bamboohr(cfg, limit) {
    need(cfg, ["subdomain", "api_key"]);
    const r = await timedFetch(`https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(cfg.subdomain)}/v1/employees/directory`, { headers: { Authorization: "Basic " + b64(cfg.api_key + ":x"), Accept: "application/json" } });
    if (!r.ok) throw new Error("BambooHR /directory (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = (d.employees || []).slice(0, limit);
    const records = rows.map((e: Record<string, string>) => P(e.displayName || (e.firstName + " " + e.lastName), e.workEmail, e.jobTitle));
    return { count: (d.employees || []).length, items: peopleItems(records), records };
  },
  async silae(cfg, limit) {
    need(cfg, ["base_url", "api_key"]);
    const path = cfg.probe_path || "/v1/dossiers";
    const r = await timedFetch(cfg.base_url.replace(/\/$/, "") + path, { headers: { Authorization: "Bearer " + cfg.api_key, Accept: "application/json" } });
    if (!r.ok) throw new Error("Silae " + path + " (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = Array.isArray(d) ? d : (d.items || d.data || []);
    const items = rows.slice(0, limit).map((x: Record<string, string>) => x.name || x.label || x.id || "?");
    return { count: rows.length, items };
  },
  async payfit(cfg, limit) {
    need(cfg, ["company_id", "api_key"]);
    const r = await timedFetch(`https://partner-api.payfit.com/companies/${encodeURIComponent(cfg.company_id)}/collaborators`, { headers: { Authorization: "Bearer " + cfg.api_key, Accept: "application/json" } });
    if (!r.ok) throw new Error("PayFit /collaborators (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = (Array.isArray(d) ? d : (d.collaborators || d.data || [])).slice(0, limit);
    const records = rows.map((c: Record<string, string>) => P((c.firstName || "") + " " + (c.lastName || ""), c.email, c.jobTitle || c.job));
    return { count: rows.length, items: peopleItems(records), records };
  },
  async adp(cfg, limit) {
    need(cfg, ["client_id", "client_secret"]);
    const tok = await timedFetch("https://accounts.adp.com/auth/oauth/v2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.client_id, client_secret: cfg.client_secret }) });
    if (!tok.ok) throw new Error("Auth ADP échouée (" + tok.status + ") : " + await txt(tok) + " — le mTLS ADP peut être requis.");
    const at = (await tok.json()).access_token;
    const r = await timedFetch(`https://api.adp.com/hr/v2/workers?$top=${limit}`, { headers: { Authorization: "Bearer " + at } });
    if (!r.ok) throw new Error("ADP /workers (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = (d.workers || []).slice(0, limit);
    // deno-lint-ignore no-explicit-any
    const items = rows.map((w: any) => w.person?.legalName?.formattedName || "?");
    return { count: (d.workers || []).length, items };
  },
  async pennylane(cfg, limit) {
    need(cfg, ["api_token"]);
    const r = await timedFetch("https://app.pennylane.com/api/external/v1/customer_invoices?page=1", { headers: { Authorization: "Bearer " + cfg.api_token, Accept: "application/json" } });
    if (!r.ok) throw new Error("Pennylane /customer_invoices (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = (d.invoices || d.customer_invoices || []).slice(0, limit);
    const items = rows.map((i: Record<string, string>) => (i.invoice_number || i.label || i.id) + " — " + (i.currency_amount || i.amount || ""));
    return { count: rows.length, items };
  },
  async sage_accounting(cfg, limit) {
    need(cfg, ["access_token"]);
    const r = await timedFetch(`https://api.accounting.sage.com/v3.1/sales_invoices?items_per_page=${limit}`, { headers: { Authorization: "Bearer " + cfg.access_token, Accept: "application/json" } });
    if (!r.ok) throw new Error("Sage /sales_invoices (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = sageItems(d).slice(0, limit);
    const items = rows.map((i: Record<string, string>) => (i.displayed_as || i.reference || i.id) + " — " + (i.total_amount || ""));
    return { count: rows.length, items };
  },
  async sellsy(cfg, limit) {
    need(cfg, ["client_id", "client_secret"]);
    const tok = await timedFetch("https://login.sellsy.com/oauth2/access-tokens", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", Authorization: "Basic " + b64(cfg.client_id + ":" + cfg.client_secret) }, body: new URLSearchParams({ grant_type: "client_credentials" }) });
    if (!tok.ok) throw new Error("Auth Sellsy échouée (" + tok.status + ") : " + await txt(tok));
    const at = (await tok.json()).access_token;
    const r = await timedFetch(`https://api.sellsy.com/v2/invoices?limit=${limit}`, { headers: { Authorization: "Bearer " + at } });
    if (!r.ok) throw new Error("Sellsy /invoices (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = (d.data || []).slice(0, limit);
    // deno-lint-ignore no-explicit-any
    const items = rows.map((i: any) => (i.number || i.id) + " — " + (i.amounts?.total || i.total || ""));
    return { count: d.pagination?.count ?? rows.length, items };
  },
  async quickbooks(cfg, limit) {
    need(cfg, ["realm_id", "access_token"]);
    const q = encodeURIComponent(`select * from Invoice maxresults ${limit}`);
    const r = await timedFetch(`https://quickbooks.api.intuit.com/v3/company/${encodeURIComponent(cfg.realm_id)}/query?query=${q}`, { headers: { Authorization: "Bearer " + cfg.access_token, Accept: "application/json" } });
    if (!r.ok) throw new Error("QuickBooks /query (" + r.status + ") : " + await txt(r));
    const d = await r.json();
    const rows = (d.QueryResponse?.Invoice || []).slice(0, limit);
    const items = rows.map((i: Record<string, string>) => (i.DocNumber || i.Id) + " — " + (i.TotalAmt || ""));
    return { count: rows.length, items };
  },
};

function maskConfig(provider: string, config: Cfg) {
  const p = byId(provider); if (!p) return { config: {}, secretsSet: {} };
  const out: Record<string, unknown> = {};
  for (const f of p.fields) out[f.key] = f.secret ? "" : (config[f.key] || "");
  const secretsSet: Record<string, boolean> = {};
  for (const f of p.fields) if (f.secret) secretsSet[f.key] = !!config[f.key];
  return { config: out, secretsSet };
}

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
    const { data: prof } = await svc.from("profiles").select("company_id, role").eq("id", user.id).maybeSingle();
    if (!prof?.company_id) return json({ error: "Profil introuvable" }, 400);
    if (prof.role !== "super_admin") return json({ error: "Réservé au super administrateur." }, 403);
    const cid = prof.company_id;
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "list";

    if (action === "list") {
      const { data: rows } = await svc.from("company_integrations").select("*").eq("company_id", cid);
      const { data: logs } = await svc.from("integration_logs").select("provider, action, ok, message, created_at").eq("company_id", cid).order("created_at", { ascending: false }).limit(50);
      const saved = (rows || []).map((r: Record<string, unknown>) => { const m = maskConfig(r.provider as string, (r.config || {}) as Cfg); return { provider: r.provider, category: r.category, enabled: r.enabled, status: r.status, last_test_at: r.last_test_at, last_sync_at: r.last_sync_at, last_error: r.last_error, config: m.config, secretsSet: m.secretsSet }; });
      return json({ catalog: CATALOG, saved, logs: logs || [] });
    }

    const provider = body?.provider;
    const p = provider && byId(provider);
    if (!p) return json({ error: "Connecteur inconnu." }, 400);

    if (action === "save") {
      const incoming = (body?.config || {}) as Cfg;
      const { data: cur } = await svc.from("company_integrations").select("config").eq("company_id", cid).eq("provider", provider).maybeSingle();
      const merged: Cfg = { ...((cur?.config || {}) as Cfg) };
      for (const f of p.fields) {
        if (!Object.prototype.hasOwnProperty.call(incoming, f.key)) continue;
        const v = incoming[f.key];
        if (f.secret) { if (typeof v === "string" && v !== "") merged[f.key] = v; }
        else merged[f.key] = String(v ?? "");
      }
      const enabled = !!body?.enabled;
      const { error } = await svc.from("company_integrations").upsert({ company_id: cid, provider, category: p.category, enabled, config: merged, status: "configured", updated_at: new Date().toISOString() }, { onConflict: "company_id,provider" });
      if (error) return json({ error: "Enregistrement échoué : " + error.message }, 500);
      const m = maskConfig(provider, merged);
      return json({ ok: true, saved: { provider, category: p.category, enabled, status: "configured", config: m.config, secretsSet: m.secretsSet } });
    }

    if (action === "remove") { await svc.from("company_integrations").delete().eq("company_id", cid).eq("provider", provider); return json({ ok: true }); }

    // Lecture de la config stockée pour test / sync / people.
    const { data: rowData } = await svc.from("company_integrations").select("config").eq("company_id", cid).eq("provider", provider).maybeSingle();
    const cfg = (rowData?.config || {}) as Cfg;
    const puller = PULL[provider];
    if (!puller) return json({ error: "Connecteur non implémenté." }, 400);

    if (action === "people") {
      if (!p.canImport) return json({ error: "Ce connecteur ne fournit pas de collaborateurs importables." }, 400);
      try {
        const res = await puller(cfg, 200);
        const records = (res.records || []).filter((x) => x.name || x.email);
        await svc.from("integration_logs").insert({ company_id: cid, provider, action: "people", ok: true, message: `${records.length} collaborateurs récupérés (aperçu import)` });
        return json({ ok: true, records });
      } catch (e) {
        const emsg = e instanceof Error ? e.message : String(e);
        await svc.from("integration_logs").insert({ company_id: cid, provider, action: "people", ok: false, message: emsg });
        return json({ ok: false, error: emsg });
      }
    }

    if (action === "test" || action === "sync") {
      const now = new Date().toISOString();
      try {
        const res = await puller(cfg, action === "test" ? 1 : 5);
        const msg = action === "test" ? "Connexion réussie." : `${res.count} ${p.resource} — aperçu : ${res.items.slice(0, 5).join(", ") || "aucun"}`;
        const upd = action === "test" ? { status: "connected", last_test_at: now, last_error: null } : { status: "connected", last_sync_at: now, last_error: null };
        await svc.from("company_integrations").update({ ...upd, updated_at: now }).eq("company_id", cid).eq("provider", provider);
        await svc.from("integration_logs").insert({ company_id: cid, provider, action, ok: true, message: msg });
        return json({ ok: true, message: msg, count: res.count, sample: res.items.slice(0, 5) });
      } catch (e) {
        const emsg = e instanceof Error ? e.message : String(e);
        await svc.from("company_integrations").update({ status: "error", last_error: emsg, updated_at: now }).eq("company_id", cid).eq("provider", provider);
        await svc.from("integration_logs").insert({ company_id: cid, provider, action, ok: false, message: emsg });
        return json({ ok: false, error: emsg });
      }
    }
    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
