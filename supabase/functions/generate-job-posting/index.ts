// generate-job-posting : rédige une ANNONCE DE RECRUTEMENT externe (anonymisée)
// à partir des champs structurés d'une fiche de poste, via l'API Anthropic.
// L'app envoie uniquement des données NON confidentielles (intitulé, séniorité,
// localisation, secteur, expertises, missions, attendus) — jamais le client, le
// salaire ni le TJM — de sorte que la sortie est directement diffusable.
//
// Prérequis (secrets Supabase Edge Functions) :
//   ANTHROPIC_API_KEY  — clé API Anthropic de l'entreprise (obligatoire)
//   JOB_MODEL          — id du modèle (optionnel, défaut ci-dessous)
//
// ⚠ RGPD : le contenu est transmis à l'API Anthropic (hors UE). Les données envoyées
// ne contiennent aucune donnée personnelle candidat ni le nom du client final.
//
// Déployer avec verify_jwt=true (appelée par l'app authentifiée).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const JOB_MODEL = Deno.env.get("JOB_MODEL") || "claude-sonnet-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });

const str = (v: unknown) => (v == null ? "" : String(v)).trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  try {
    if (!ANTHROPIC_KEY) {
      return json({ error: "Rédaction IA non configurée : ajoutez le secret ANTHROPIC_API_KEY dans Supabase." }, 400);
    }
    // Authentification : réservé aux utilisateurs connectés (maîtrise du coût API).
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const asUser = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: ures } = await asUser.auth.getUser();
    if (!ures?.user) return json({ error: "Non authentifié" }, 401);

    const b = await req.json().catch(() => ({}));
    const title = str(b.title);
    if (!title) return json({ error: "Intitulé du poste requis" }, 400);

    const expertise = Array.isArray(b.expertise) ? b.expertise.map(str).filter(Boolean) : [];
    const facts: string[] = [];
    facts.push(`Intitulé : ${title}`);
    if (str(b.seniority)) facts.push(`Séniorité : ${str(b.seniority)}`);
    if (str(b.location)) facts.push(`Localisation : ${str(b.location)}`);
    if (str(b.contract)) facts.push(`Type de contrat : ${str(b.contract)}`);
    if (str(b.sector)) facts.push(`Secteur : ${str(b.sector)}`);
    if (b.minYears) facts.push(`Expérience minimum : ${str(b.minYears)} an(s)`);
    if (b.nbPositions && Number(b.nbPositions) > 1) facts.push(`Nombre de postes : ${str(b.nbPositions)}`);
    if (str(b.startDate)) facts.push(`Démarrage souhaité : ${str(b.startDate)}`);
    if (expertise.length) facts.push(`Compétences / technologies : ${expertise.join(", ")}`);
    if (str(b.missions)) facts.push(`Missions décrites : ${str(b.missions)}`);
    if (str(b.expectations)) facts.push(`Profil attendu : ${str(b.expectations)}`);

    const prompt =
      "Tu es un chargé de recrutement dans une ESN (société de conseil en informatique). " +
      "Rédige une ANNONCE DE RECRUTEMENT attractive, professionnelle et prête à publier " +
      "(site carrière, LinkedIn, jobboards) EN FRANÇAIS, à partir des informations ci-dessous.\n\n" +
      "Contraintes :\n" +
      "- Anonymise : ne mentionne jamais le nom d'un client final, un salaire ou un TJM ; " +
      "parle de « notre client » ou « nos projets » si besoin.\n" +
      "- Structure claire avec des sections : accroche, Vos missions, Profil recherché, " +
      "Compétences techniques, Ce que nous offrons.\n" +
      "- Ton engageant mais sobre, sans superlatifs excessifs, sans emojis.\n" +
      "- N'invente pas d'informations factuelles absentes ; reste fidèle aux éléments fournis " +
      "tout en soignant la formulation.\n" +
      "- Termine par une invitation à candidater.\n" +
      "- Rends UNIQUEMENT le texte de l'annonce, sans commentaire ni préambule.\n\n" +
      "INFORMATIONS :\n" + facts.join("\n");

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: JOB_MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return json({ error: "Erreur IA (" + aiResp.status + ") : " + t.slice(0, 300) }, 502);
    }
    const out = await aiResp.json();
    const text = (out.content || [])
      .filter((c: { type?: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text || "")
      .join("\n")
      .trim();
    if (!text) return json({ error: "Réponse IA vide" }, 422);
    return json({ body: text });
  } catch (e) {
    return json({ error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
