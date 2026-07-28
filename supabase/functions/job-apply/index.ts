// job-apply : page « Postuler » publique (offre externe d'une fiche de poste).
//
//   GET  ?token=<uuid>   → renvoie l'annonce PUBLIQUE (anonymisée : ni client,
//                          ni salaire, ni TJM) si la fiche est publiée.
//   POST {token, name, email, phone, location, yearsExp, message, cv:{name,type,dataB64}, hp}
//                        → crée un `candidates` (source=offre_publique) rattaché à
//                          la fiche (candidate_ids), avec le CV déposé dans le
//                          bucket candidate-files. Renvoie {ok:true}.
//
// Sécurité : verify_jwt=false (page publique, aucun compte). AUCUN accès anon
// direct aux tables — tout passe par le service role ici, borné au strict
// nécessaire. Anti-abus : honeypot, champs requis, e-mail valide, taille/type de
// CV plafonnés, dédoublonnage par (offre + e-mail). L'isolation multi-tenant est
// préservée : company_id est LU depuis la fiche, jamais fourni par le visiteur.
//
// ⚠ Déployer avec verify_jwt=false (comme stripe-webhook). Le défaut verify_jwt=true
//   casserait la page publique (le candidat n'a pas de JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CV_MAX = 5 * 1024 * 1024;                       // 5 Mo
const CV_EXT = ["pdf", "doc", "docx", "odt"];
const SENIORITY_LB: Record<string, string> = {
  junior: "Junior", confirme: "Confirmé", senior: "Sénior", lead: "Lead / Manager",
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function clean(s: unknown, max = 500): string {
  return String(s == null ? "" : s).trim().slice(0, max);
}

// Récupère une fiche publiée par son jeton (colonnes minimales).
async function jobByToken(token: string) {
  const { data, error } = await supa
    .from("job_postings")
    .select("id,company_id,title,seniority,location,contract_kind,req_expertise,mission_desc,ext_body,is_public,public_token,candidate_ids,status")
    .eq("public_token", token)
    .eq("is_public", true)
    .maybeSingle();
  if (error) return null;
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Lecture de l'annonce publique ─────────────────────────────────────
    if (req.method === "GET") {
      const token = clean(new URL(req.url).searchParams.get("token"), 40);
      if (!UUID_RE.test(token)) return json({ ok: false, error: "Lien invalide." }, 400);
      const job = await jobByToken(token);
      if (!job) return json({ ok: false, error: "Cette offre n'est plus disponible." }, 404);
      // Nom d'affichage de l'organisation (facultatif).
      let orgName = "";
      try {
        const { data: co } = await supa.from("companies").select("name").eq("id", job.company_id).maybeSingle();
        orgName = (co && co.name) || "";
      } catch (_) { /* colonne absente : on ignore */ }
      return json({
        ok: true,
        closed: job.status === "pourvu" || job.status === "annule",
        job: {
          title: job.title || "",
          seniority: SENIORITY_LB[job.seniority as string] || "",
          location: job.location || "",
          contractKind: job.contract_kind || "",
          reqExpertise: Array.isArray(job.req_expertise) ? job.req_expertise : [],
          body: job.ext_body || job.mission_desc || "",
          orgName,
        },
      });
    }

    // ── Dépôt d'une candidature ───────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = clean(body.token, 40);
      if (!UUID_RE.test(token)) return json({ ok: false, error: "Lien invalide." }, 400);

      // Honeypot : un champ caché rempli = bot → on répond OK sans rien créer.
      if (clean(body.hp, 100)) return json({ ok: true });

      const name = clean(body.name, 120);
      const email = clean(body.email, 160).toLowerCase();
      if (!name) return json({ ok: false, error: "Nom requis." }, 400);
      if (!EMAIL_RE.test(email)) return json({ ok: false, error: "E-mail invalide." }, 400);

      const job = await jobByToken(token);
      if (!job) return json({ ok: false, error: "Cette offre n'est plus disponible." }, 404);
      if (job.status === "pourvu" || job.status === "annule")
        return json({ ok: false, error: "Cette offre est clôturée." }, 409);

      const companyId = job.company_id as string;

      // Dédoublonnage : même e-mail déjà candidat sur cette offre → succès idempotent.
      const { data: dup } = await supa
        .from("candidates").select("id").eq("company_id", companyId)
        .eq("applied_job_id", job.id).eq("email", email).limit(1);
      if (dup && dup.length) return json({ ok: true, already: true });

      const phone = clean(body.phone, 40);
      const location = clean(body.location, 120);
      const message = clean(body.message, 4000);
      const yearsExp = Math.max(0, Math.min(60, parseFloat(String(body.yearsExp || 0)) || 0));

      const candId = crypto.randomUUID().slice(0, 8);

      // CV (facultatif) → bucket candidate-files, chemin aligné sur l'app.
      const cvFiles: Array<{ id: string; fileName: string; filePath: string }> = [];
      if (body.cv && body.cv.dataB64) {
        const rawName = clean(body.cv.name, 120) || "cv.pdf";
        const ext = (rawName.split(".").pop() || "").toLowerCase();
        if (CV_EXT.indexOf(ext) < 0) return json({ ok: false, error: "Format de CV non supporté (PDF, DOC, DOCX, ODT)." }, 400);
        let bytes: Uint8Array;
        try { bytes = b64ToBytes(String(body.cv.dataB64)); }
        catch (_) { return json({ ok: false, error: "CV illisible." }, 400); }
        if (bytes.length > CV_MAX) return json({ ok: false, error: "CV trop volumineux (max 5 Mo)." }, 400);
        const safe = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `${companyId}/${candId}/cv_${Date.now()}_${safe}`;
        const up = await supa.storage.from("candidate-files").upload(path, bytes, {
          contentType: String(body.cv.type || "application/octet-stream"), upsert: false,
        });
        if (up.error) return json({ ok: false, error: "Dépôt du CV impossible." }, 500);
        cvFiles.push({ id: "cv_" + candId, fileName: rawName, filePath: path });
      }

      // Création du candidat (statut initial « à rencontrer RH »).
      const cr = message
        ? [{ id: "cr_" + candId, date: new Date().toISOString().slice(0, 10), author: email, text: message, fileName: "", filePath: "" }]
        : [];
      const ins = await supa.from("candidates").insert({
        id: candId, company_id: companyId, name, email, phone: phone || null,
        locations: location ? [location] : [], loc_target: location || null,
        years_exp: yearsExp, expertise: [], sectors: [],
        status: "rh_a", source: "offre_publique", applied_job_id: job.id,
        recruiter: job.recruiter || null, bu_id: job.bu_id || null,
        margin_pct: 25, feedbacks: [], comptes_rendus: cr, cgi_meetings: [],
        cv_files: cvFiles, created_by: "candidature publique",
      }).select("id").single();
      if (ins.error) return json({ ok: false, error: "Enregistrement impossible." }, 500);

      // Rattachement à la fiche (candidate_ids) — source de vérité de l'assignation.
      const ids = Array.isArray(job.candidate_ids) ? job.candidate_ids.slice() : [];
      if (ids.indexOf(candId) < 0) ids.push(candId);
      await supa.from("job_postings").update({ candidate_ids: ids, updated_at: new Date().toISOString() }).eq("id", job.id);

      return json({ ok: true });
    }

    return json({ ok: false, error: "Méthode non supportée." }, 405);
  } catch (e) {
    return json({ ok: false, error: (e && (e as Error).message) || "Erreur serveur." }, 500);
  }
});
