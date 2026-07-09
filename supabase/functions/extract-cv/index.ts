// extract-cv : extrait les expériences professionnelles du CV (PDF) d'un candidat
// via l'API Anthropic (Claude lit le PDF nativement) et renvoie une liste structurée
// que l'app pré-remplit dans la fiche (l'utilisateur relit avant d'enregistrer).
//
// Prérequis (secrets Supabase Edge Functions) :
//   ANTHROPIC_API_KEY  — clé API Anthropic de l'entreprise (obligatoire)
//   CV_MODEL           — id du modèle (optionnel, défaut ci-dessous)
//
// ⚠ RGPD : le contenu du CV est transmis à l'API Anthropic (hors UE). À n'activer
// qu'avec le consentement approprié et une base légale.
//
// Déployer avec verify_jwt=true (appelée par l'app authentifiée).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const CV_MODEL = Deno.env.get("CV_MODEL") || "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

// Schéma imposé au modèle → sortie JSON déterministe (tool use forcé).
// Remplit à la fois les expériences ET le profil du dossier de compétences
// (structure inspirée du modèle CGI).
const TOOL = {
  name: "save_cv",
  description: "Enregistre les expériences ET le profil (dossier de compétences) extraits du CV.",
  input_schema: {
    type: "object",
    properties: {
      experiences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            poste: { type: "string", description: "Intitulé du poste" },
            client: { type: "string", description: "Client final ou entreprise" },
            dateStart: { type: "string", description: "Début au format YYYY-MM (vide si inconnu)" },
            dateEnd: { type: "string", description: "Fin au format YYYY-MM (vide si en cours)" },
            current: { type: "boolean", description: "true si le poste est en cours" },
            description: { type: "string", description: "Missions et réalisations, concises" },
            technos: { type: "string", description: "Technologies/compétences, séparées par des virgules" },
          },
          required: ["poste"],
        },
      },
      profile: {
        type: "object",
        description: "Profil synthétique du candidat pour le dossier de compétences.",
        properties: {
          title: { type: "string", description: "Titre / fonction principale (ex: Consultant Data)" },
          summary: { type: "string", description: "Résumé du parcours en 2-4 phrases" },
          sectorExp: { type: "string", description: "Secteurs d'activité, séparés par des virgules" },
          tools: { type: "string", description: "Outils et logiciels, séparés par des virgules" },
          environments: { type: "string", description: "Environnements/technologies techniques, séparés par des virgules" },
          languages: { type: "string", description: "Langues parlées avec niveau, séparées par des virgules" },
          formation: { type: "string", description: "Formation : diplômes, écoles, années, certifications" },
          specializations: { type: "string", description: "Spécialisations techniques, séparées par des virgules" },
          skills: {
            type: "array",
            description: "Compétences clés notées pour la grille de synthèse.",
            items: {
              type: "object",
              properties: {
                skill: { type: "string", description: "Nom de la compétence" },
                years: { type: "number", description: "Nombre d'années d'expérience sur cette compétence (0 si inconnu)" },
                level: { type: "number", description: "Niveau de 1 (notions) à 4 (expert)" },
              },
              required: ["skill"],
            },
          },
        },
      },
    },
    required: ["experiences"],
  },
};

function b64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    if (!ANTHROPIC_KEY) {
      return json({ error: "Extraction IA non configurée : ajoutez le secret ANTHROPIC_API_KEY dans Supabase." }, 400);
    }
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const asUser = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: ures } = await asUser.auth.getUser();
    const user = ures?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const svc = createClient(SUPA_URL, SERVICE);
    const { data: prof } = await svc.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    if (!prof?.company_id) return json({ error: "Profil introuvable" }, 400);

    const body = await req.json().catch(() => ({}));
    const candId = body?.candId;
    if (!candId) return json({ error: "candId requis" }, 400);

    // Candidat de la même entreprise uniquement.
    const { data: cand } = await svc.from("candidates")
      .select("id, company_id, cv_files").eq("id", candId).maybeSingle();
    if (!cand || cand.company_id !== prof.company_id) return json({ error: "Candidat introuvable" }, 404);

    const files: Array<{ filePath?: string; fileName?: string }> = Array.isArray(cand.cv_files) ? cand.cv_files : [];
    const pdf = files.find((f) => (f.fileName || f.filePath || "").toLowerCase().endsWith(".pdf")) || files[0];
    if (!pdf?.filePath) return json({ error: "Aucun CV joint à ce candidat." }, 400);
    if (!(pdf.fileName || pdf.filePath || "").toLowerCase().endsWith(".pdf")) {
      return json({ error: "L'extraction automatique ne gère que les CV au format PDF pour l'instant." }, 400);
    }

    // Télécharge le fichier depuis Storage (droits service role).
    const dl = await svc.storage.from("candidate-files").download(pdf.filePath);
    if (dl.error || !dl.data) return json({ error: "Lecture du CV impossible : " + (dl.error?.message || "") }, 400);
    const data64 = b64(new Uint8Array(await dl.data.arrayBuffer()));

    const prompt =
      "Tu es un assistant RH. Analyse ce CV et produis un dossier de compétences. " +
      "1) Les EXPÉRIENCES professionnelles : pour chacune poste, client/entreprise, dates " +
      "début/fin au format YYYY-MM (current=true si en cours), une description concise des " +
      "missions, et les technologies. " +
      "2) Le PROFIL de synthèse : title (fonction principale), summary (résumé du parcours), " +
      "sectorExp (secteurs), tools (outils/logiciels), environments (technologies), languages " +
      "(langues + niveau), formation (diplômes/certifications), specializations, et skills " +
      "(compétences clés notées de 1 à 4 avec le nombre d'années). " +
      "N'invente rien ; laisse un champ vide ou omets-le si l'information est absente. " +
      "Renvoie le tout via l'outil save_cv.";

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CV_MODEL,
        max_tokens: 3000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_cv" },
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: data64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return json({ error: "Erreur IA (" + aiResp.status + ") : " + t.slice(0, 300) }, 502);
    }
    const out = await aiResp.json();
    const block = (out.content || []).find((b: { type?: string }) => b.type === "tool_use");
    const experiences = block?.input?.experiences;
    if (!Array.isArray(experiences)) return json({ error: "Aucune expérience détectée dans le CV." }, 422);

    // Nettoyage défensif des champs.
    const clean = experiences.map((e: Record<string, unknown>) => ({
      poste: String(e.poste || ""),
      client: String(e.client || ""),
      dateStart: String(e.dateStart || ""),
      dateEnd: String(e.dateEnd || ""),
      current: !!e.current,
      description: String(e.description || ""),
      technos: String(e.technos || ""),
    }));

    const pr = (block?.input?.profile || {}) as Record<string, unknown>;
    const str = (v: unknown) => String(v || "");
    const rawSkills = Array.isArray(pr.skills) ? (pr.skills as Record<string, unknown>[]) : [];
    const profile = {
      title: str(pr.title),
      summary: str(pr.summary),
      sectorExp: str(pr.sectorExp),
      tools: str(pr.tools),
      environments: str(pr.environments),
      languages: str(pr.languages),
      formation: str(pr.formation),
      specializations: str(pr.specializations),
      skills: rawSkills.map((s) => ({
        skill: str(s.skill),
        years: Number(s.years) || 0,
        level: Math.max(1, Math.min(4, Number(s.level) || 3)),
      })).filter((s) => s.skill),
    };
    return json({ experiences: clean, profile });
  } catch (e) {
    return json({ error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
