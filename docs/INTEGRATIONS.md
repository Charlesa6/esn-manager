# Intégrations (connecteurs API)

Konsilys peut se brancher sur les outils du marché : **Microsoft 365 / Entra ID**
(l'écosystème CGI), les **SIRH**, la **Paie** et la **Facturation**. Cette page
documente l'architecture, la sécurité et la procédure de branchement.

## Où ça se trouve dans l'app

Onglet **🔌 Intégrations** de la barre latérale — visible uniquement pour le
**super administrateur (Sénior VP)**. Chaque connecteur y est **désactivé par
défaut** : rien n'est envoyé à un tiers tant que le super admin n'a pas saisi ses
identifiants et cliqué sur **Tester la connexion**.

## Connecteurs livrés

| Catégorie | Connecteurs |
|-----------|-------------|
| Identité / annuaire (CGI) | **Microsoft 365 / Entra ID** (Azure AD) |
| SIRH (RH) | **Workday**, **SAP SuccessFactors**, **Lucca**, **BambooHR** |
| Paie | **Silae**, **PayFit**, **ADP** |
| Facturation | **Pennylane**, **Sage Business Cloud**, **Sellsy**, **QuickBooks Online** |

## Architecture

- **Front** : `js/15-integrations.js` — la vue `tIntegrations()` (catalogue,
  formulaires, boutons Tester / Aperçu / Activer). Aucune clé n'est stockée côté
  navigateur ; tout passe par l'Edge Function.
- **Edge Function** : `supabase/functions/integrations` (`verify_jwt=true`).
  Actions `POST { action }` :
  - `list` — catalogue + connecteurs enregistrés (secrets **masqués**) + journal ;
  - `save` — enregistre la configuration (fusion : un secret laissé vide conserve
    l'ancienne valeur) ;
  - `test` — teste la connexion avec les identifiants stockés ;
  - `sync` — **aperçu en lecture seule** : récupère un échantillon (5 lignes) pour
    prouver que la connexion fonctionne, **sans écrire** dans l'application ;
  - `remove` — supprime le connecteur.
  La fonction exige le rôle `super_admin` et cloisonne tout par `company_id`
  (service role côté serveur).
- **Base** : migration `supabase/migrations/company_integrations.sql` — tables
  `company_integrations` (une ligne par entreprise × connecteur) et
  `integration_logs` (journal). RLS : lecture réservée au `super_admin` de
  l'entreprise ; **aucune** écriture directe côté client (tout via l'Edge Function).

## Sécurité

- Les **clés secrètes** (client secret, tokens, mots de passe) sont stockées dans
  `company_integrations.config` (jsonb) et **ne sont jamais renvoyées** au
  navigateur : l'API les remplace par `""` + un booléen `secretsSet` indiquant
  qu'une valeur existe. Le formulaire affiche `••••••` et ne réécrit le secret que
  si l'utilisateur en saisit un nouveau.
- La synchronisation livrée est **en lecture seule**. Aucun connecteur ne modifie
  les données de l'application. L'import (mapping vers `consultants` / `missions` /
  facturation) est une phase ultérieure à concevoir explicitement.
- **RGPD** : ces connecteurs transmettent des données RH/paie à des tiers. Vérifier
  la base légale et la localisation des traitements avant activation en production.

### Renforcement recommandé (production)

Pour un déploiement à grande échelle (ex : CGI), chiffrer les secrets au repos
(Supabase Vault / `pgsodium`) plutôt que de les stocker en clair dans le jsonb, et
utiliser les flux OAuth avec *refresh tokens* gérés côté serveur pour les
fournisseurs qui les supportent (Sage, QuickBooks, Sellsy).

## Ce que chaque client doit fournir

Chaque connecteur attend les identifiants **de l'entreprise cliente** (créés dans
la console du fournisseur). Exemples :

- **Microsoft / Entra ID** : App registration Azure AD → `Tenant ID`, `Client ID`,
  `Client secret`, avec la permission applicative `User.Read.All` (consentement
  admin) sur Microsoft Graph.
- **Lucca** : clé API (Administration → API) + sous-domaine `*.ilucca.net`.
- **BambooHR** : clé API utilisateur + sous-domaine.
- **Workday** : compte ISU + endpoint REST (`host`, `tenant`).
- **SuccessFactors** : `api_server`, `company_id`, utilisateur OData + mot de passe.
- **Silae** : URL de base + token API (le chemin de test dépend de l'offre).
- **PayFit** : `company_id` + clé API (Bearer).
- **ADP** : `client_id` / `client_secret` — ⚠ le flux ADP requiert un certificat
  **mTLS** (configuration réseau dédiée, hors périmètre de l'aperçu).
- **Pennylane / Sage / QuickBooks** : token OAuth2 (+ `realm_id` pour QuickBooks).
- **Sellsy** : `client_id` / `client_secret` (client credentials v2).

## Déploiement

- Edge Function : déployée en prod via Supabase MCP (`verify_jwt=true`).
- Migration : appliquée en prod via Supabase MCP.
- Aucune variable d'environnement supplémentaire n'est requise : les identifiants
  des fournisseurs sont saisis par chaque entreprise dans l'écran Intégrations.
