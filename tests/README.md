# Tests de bout-en-bout (E2E)

Suite de tests Playwright **sans build ni npm**, cohérente avec l'architecture du
projet (HTML/JS statique). Elle détecte les régressions sur les parcours critiques
sans dépendre de Supabase : les pages sont chargées en `file://` et les CDN
(`@supabase`, `xlsx`) sont interceptés par un stub, pour que l'app démarre
hors-ligne. L'application produit est testée en **mode démo** (`?demo=true`).

## Ce qui est couvert

- **Landing** (`index.html`) : chargement, présence du tunnel d'abonnement, absence d'erreur JS.
- **Login** (`esn_login.html`) : chargement, présence des champs, absence d'erreur JS.
- **App produit** (`esn_manager_cgi.html?demo=true`) :
  - démarrage (état `S` initialisé) ;
  - navigation sans erreur sur les onglets KPIs, Dashboard, Équipe, Missions, Planning, Absences ;
  - présence du **prévisionnel de CA** et de la **marge consolidée par BU/Practice** dans les KPIs.

## Lancer les tests

```bash
node tests/e2e.cjs
```

Le script renvoie un code de sortie non-nul si un test échoue (utilisable en CI).

### Environnement

- **Playwright** doit être disponible (résolu via `require('playwright')`, avec repli
  sur l'installation globale de l'environnement de dev).
- Le binaire Chromium est cherché via la variable `PW_CHROMIUM`, sinon au chemin
  pré-installé de l'environnement. Exemple :
  ```bash
  PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/e2e.cjs
  ```

## Étendre la suite

Ajouter un scénario = ajouter un bloc dans `tests/e2e.cjs` et des appels `check(nom, condition)`.
Pour tester un parcours qui écrit dans Supabase, enrichir le stub `SUPABASE_STUB`
(méthodes `from().insert()/update()`…) ou pointer vers un projet Supabase de test.
