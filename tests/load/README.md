# Test de charge (k6)

Mesure le comportement de Konsilys sous charge concurrente (voir
`docs/SCALE_100K.md`, Phase C). Le script `k6-konsilys.js` simule N utilisateurs
simultanés qui exécutent le parcours de lecture principal (équivalent de
`loadSB`) plus l'agrégat serveur `company_kpi_snapshot`.

## ⚠️ Avant tout : ne pas bombarder la prod

Un test de charge génère beaucoup de trafic. **Ne le pointez pas sur le projet de
production** (`rwmstlesxnglpblrurqj`) : le script le refuse sauf `ALLOW_PROD=1`.
Préférez :
- une **branche Supabase** (base de test isolée), ou
- un **projet de staging** avec un jeu de données représentatif.

Pour un test réaliste « façon CGI », chargez d'abord la base de test avec un
**gros volume** (par ex. 100 000 consultants + missions/absences) — sinon vous
mesurez une base vide. Le script **`seed-large-dataset.sql`** le fait :

```bash
# Sur une BRANCHE Supabase ou un staging — JAMAIS la prod.
psql "$BRANCH_DB_URL" \
  -v cid="'<UUID_ENTREPRISE_DE_TEST>'" -v n=100000 \
  -f tests/load/seed-large-dataset.sql
```

- `cid` = UUID d'une entreprise de test (obligatoire). `n` = nombre de consultants.
- Génère ≈ n consultants, ≈ 1,5·n missions, ≈ n absences — tous préfixés `load_`.
- **Nettoyage** : les 3 `delete ... where id like 'load_%'` en bas du fichier.
- ⚠️ Le script désactive les triggers le temps de l'insert (rôle admin requis) et
  refuse de tourner sans `cid` explicite. Ne le lancez pas sur la production.

## Prérequis

- Installer **k6** : https://k6.io/docs/get-started/installation/
- Une **URL Supabase** + sa **clé anon** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- Un moyen d'**authentifier les utilisateurs virtuels**, au choix :
  - `TEST_JWT` : un jeton d'accès valide (le plus simple pour un essai) ;
    récupérable dans le navigateur (DevTools → Application → Local Storage →
    clé `sb-...-auth-token` → champ `access_token`) ;
  - ou `TEST_EMAIL` + `TEST_PASSWORD` d'un compte de test : le script se connecte
    lui-même (recommandé pour une vraie campagne).

## Lancer

```bash
SUPABASE_URL=https://VOTRE-BRANCHE.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
TEST_EMAIL=demo@exemple.com TEST_PASSWORD=•••• \
VUS=50 RAMP=30s HOLD=2m THINK=1 \
k6 run tests/load/k6-konsilys.js
```

### Variables

| Variable | Rôle | Défaut |
|----------|------|--------|
| `SUPABASE_URL` | URL du projet/branche cible | — (requis) |
| `SUPABASE_ANON_KEY` | clé anon | — (requis) |
| `TEST_JWT` | jeton d'accès (sinon email/mot de passe) | — |
| `TEST_EMAIL` / `TEST_PASSWORD` | compte de test à connecter | — |
| `VUS` | utilisateurs virtuels simultanés | 20 |
| `RAMP` / `HOLD` | durée de montée / de palier | 30s / 1m |
| `THINK` | temps de réflexion entre itérations (s) | 1 |
| `ALLOW_PROD` | autorise la cible prod (à éviter) | — |

Montez `VUS` par paliers (20 → 100 → 500 …) pour trouver le point de saturation.

## Lire les résultats

k6 affiche notamment :
- **`http_req_duration`** — latence des requêtes ; regardez surtout **p(95)** et
  **p(99)** (les seuils sont fixés à 1500 ms / 3000 ms).
- **`http_req_failed`** — taux d'erreurs (seuil < 1 %). S'il grimpe, vous avez
  dépassé la capacité (pool DB saturé, timeouts).
- **`konsilys_read_ms`** / **`konsilys_rpc_ms`** — latences dédiées lectures / RPC.
- **`iterations` / `http_reqs`** — débit (req/s).

Le **point de saturation** = le niveau de VUs à partir duquel la latence p95
explose ou le taux d'erreurs franchit 1 %. C'est votre capacité réelle, à
comparer à l'objectif, puis à repousser (Phase A : compute + pooler + réplicas ;
Phase B : agrégation SQL + pagination serveur).

## Bon usage

- Prévenez si la cible est partagée (une branche l'est rarement).
- Commencez petit (`VUS=10`) pour valider le script et l'auth, puis montez.
- Relancez le **même scénario** après chaque optimisation pour chiffrer le gain.
