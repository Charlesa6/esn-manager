# Konsilys iOS (App Store)

App iOS native **Capacitor** qui embarque l'app web Konsilys. Fidèle à l'esprit du
repo : **pas de bundler** — `scripts/copy-web.mjs` assemble simplement les fichiers
web dans `www/`, et `src/native.js` (injecté dans le bundle) ajoute les fonctions
natives. L'app web à la racine du repo **reste inchangée**.

- **Bundle id** : `fr.konsilys.app`
- **Chargement** : embarqué (les fichiers web sont dans l'app) — robuste pour la revue Apple.
- **Point d'entrée** : la page de connexion → puis le produit. Session Supabase gérée dans la WebView.
- **Fonctions natives** (valeur ajoutée requise par Apple, règle 4.2) : verrou **Face ID / Touch ID**,
  **notifications push** (inscription du jeton APNs), splash + barre de statut, retour haptique.

> ⚠️ **Abonnement** : l'app iOS ne vend **rien** en interne. Apple impose l'achat in-app
> pour les abonnements numériques ; on l'évite en gardant la souscription sur le **web**
> (konsilys.fr). L'app se contente de la **connexion + usage**. Le testeur Apple utilise
> un compte déjà actif → aucun paywall.

---

## Ce que tu dois avoir (une fois)

1. **Compte Apple Developer** (99 $/an) — https://developer.apple.com/programs/
2. Dans **App Store Connect** : crée l'app (Bundle ID `fr.konsilys.app`, nom « Konsilys »).
3. Dans **Certificates, Identifiers & Profiles** : l'App ID `fr.konsilys.app` avec la
   capacité **Push Notifications** activée.
4. Une **clé API App Store Connect** (rôle *App Manager*) : télécharge le fichier `.p8`,
   note le **Key ID** et l'**Issuer ID**.
5. Un **dépôt git privé** pour `fastlane match` (stocke les certificats/profils chiffrés)
   + un mot de passe `MATCH_PASSWORD`.

Aucun Mac n'est nécessaire : tout se compile sur un **runner GitHub Actions macOS**.

---

## Secrets GitHub à créer

Repo → *Settings* → *Secrets and variables* → *Actions* :

| Secret | Contenu |
|---|---|
| `APPLE_ID` | e-mail du compte Apple Developer |
| `APPLE_TEAM_ID` | Team ID (Developer Portal) |
| `ITC_TEAM_ID` | Team ID App Store Connect (souvent identique) |
| `ASC_KEY_ID` | Key ID de la clé API |
| `ASC_ISSUER_ID` | Issuer ID de la clé API |
| `ASC_KEY_P8_BASE64` | contenu du `.p8` encodé base64 (`base64 -i AuthKey_XXX.p8`) |
| `MATCH_GIT_URL` | URL du dépôt git privé des certificats |
| `MATCH_GIT_BASIC_AUTH` | `base64("user:token_github")` pour cloner ce dépôt |
| `MATCH_PASSWORD` | phrase secrète de chiffrement match |

---

## Publier une version (TestFlight → App Store)

1. Pousse un tag **`ios-v1.0.0`** (ou lance le workflow *iOS · TestFlight* à la main).
2. Le workflow `.github/workflows/ios-testflight.yml` : assemble `www/`, génère le projet
   iOS (`cap add ios`), installe les pods, puis **fastlane** compile, signe (via `match`)
   et **envoie sur TestFlight**.
3. Dans **App Store Connect** : le build apparaît sous *TestFlight* (teste-le sur ton iPhone
   via l'app TestFlight), puis *Distribution* → **Soumettre pour revue**.

> Premier build : `match` crée les certificats/profils dans ton dépôt privé. Si un réglage
> de signature manque, l'erreur fastlane est explicite (souvent Team ID ou capacité Push).

---

## Notes de revue App Store (à remplir dans App Store Connect)

- **Compte de démonstration** : fournis un identifiant + mot de passe d'un compte **actif**
  (sinon le testeur ne peut pas dépasser la connexion).
- **Champ « Notes »** : « B2B SaaS de pilotage pour ESN. L'abonnement est souscrit sur
  konsilys.fr (usage professionnel hors app) ; l'app fournit connexion, tableaux de bord,
  validation de congés, plans de compte et notifications. »
- **Confidentialité (privacy labels)** : données de compte (e-mail), contenu métier ;
  usage : fonctionnement de l'app ; pas de traçage publicitaire.
- **Chiffrement export (ITSAppUsesNonExemptEncryption)** : `NO` (HTTPS standard).

---

## Développer / tester sur un Mac (optionnel)

```bash
cd mobile
npm install
npm run sync          # assemble www/ + cap sync ios
npx cap add ios       # la première fois
npx cap open ios      # ouvre Xcode
```

`npm run sync-web` régénère `www/` après toute modif de l'app web à la racine.

---

## Activer les notifications push (branchement ultérieur)

L'inscription côté app est déjà là (`native.js` récupère le jeton APNs). Pour **envoyer**
des push (ex. rappels d'engagement) il reste, quand tu voudras :

1. Créer la table de jetons (SQL, à appliquer via Supabase) :
   ```sql
   create table if not exists public.device_tokens (
     token text primary key,
     user_id uuid not null references auth.users(id) on delete cascade,
     company_id uuid references public.companies(id) on delete set null,
     platform text not null default 'ios',
     updated_at timestamptz not null default now()
   );
   alter table public.device_tokens enable row level security;
   create policy device_tokens_rw on public.device_tokens for all
     using (user_id = auth.uid()) with check (user_id = auth.uid());
   ```
2. Créer une **clé APNs** (.p8) dans le Developer Portal.
3. Étendre la fonction Edge `engagement-reminders` pour envoyer aussi vers APNs
   (en plus d'email/Teams), en lisant `device_tokens`.

Tant que la table n'existe pas, `native.js` ignore proprement la persistance du jeton.

---

## Architecture des fichiers

```
mobile/
  package.json              # dépendances Capacitor (plugins natifs)
  capacitor.config.json     # id app, splash, push
  scripts/copy-web.mjs      # assemble www/ (copie + réécriture routes + injection native.js)
  src/native.js             # shell natif : Face ID, push, splash, status bar
  fastlane/                 # Fastfile (lane beta) + Appfile
  www/                      # généré (git-ignoré)
  ios/                      # généré par cap add ios (git-ignoré)
.github/workflows/ios-testflight.yml   # build cloud macOS → TestFlight
```
