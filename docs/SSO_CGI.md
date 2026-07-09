# SSO entreprise (CGI / Microsoft Entra)

Permet aux collaborateurs d'un client (ex : **CGI**) de se connecter à Konsilys
avec leur **compte Microsoft Entra ID** (Azure AD), sans mot de passe dédié.

> **État actuel : désactivé par défaut.** Le socle est livré côté app
> (`esn_login.html`, constante `SSO_CONFIG`) mais **le login email/mot de passe
> reste strictement inchangé** tant que `SSO_CONFIG.enabled` vaut `false` — le
> bouton SSO n'apparaît même pas. Aucun risque pour la démo.

## Deux protocoles possibles

| Protocole | Quand | Add-on Supabase |
|-----------|-------|-----------------|
| **OIDC** (`provider: 'azure'`) | Le plus simple. Login Microsoft standard. | Aucun (inclus) |
| **SAML** (`signInWithSSO({domain})`) | Exigé par la DSI (SSO d'entreprise par domaine) | **Enterprise SSO (payant)** |

Par défaut le socle est réglé sur **OIDC** (`SSO_CONFIG.protocol = 'oidc'`).

## Activation — OIDC (recommandé pour démarrer)

1. **Côté Azure (CGI)** — App registration dans Entra ID :
   - Rediriger vers `https://rwmstlesxnglpblrurqj.supabase.co/auth/v1/callback`.
   - Récupérer **Application (client) ID**, **Directory (tenant) ID**, créer un
     **client secret**.
2. **Côté Supabase** — Authentication → Providers → **Azure** :
   - Coller Client ID / Secret, renseigner l'**Azure Tenant URL**
     (`https://login.microsoftonline.com/<TENANT_ID>`), activer le provider.
   - Ajouter `https://konsilys.fr/app` (et l'URL de préprod) dans les **Redirect
     URLs** autorisées.
3. **Côté app** — dans `esn_login.html`, passer :
   ```js
   var SSO_CONFIG = { enabled: true, protocol: 'oidc', provider: 'azure',
                      label: 'Se connecter avec CGI', scopes: 'email openid profile' };
   ```
   Merger sur `main` (Vercel déploie le front).

## Activation — SAML (SSO d'entreprise par domaine)

1. Souscrire l'**add-on Enterprise SSO** de Supabase.
2. Enregistrer les métadonnées SAML de l'IdP CGI côté Supabase (CLI/API SSO), en
   associant le **domaine** (ex : `cgi.com`).
3. Côté app :
   ```js
   var SSO_CONFIG = { enabled: true, protocol: 'saml', domain: 'cgi.com',
                      label: 'Se connecter avec CGI' };
   ```

## Provisioning / rôles (JIT) — à décider avant activation prod

Un invariant central de Konsilys est : **« la création de compte se fait
uniquement via paiement »** (`companies.active`, `handle_new_user` lit le rôle
depuis les métadonnées de signup). Le SSO introduit un **premier login sans
passer par le tunnel Stripe**. Il faut donc trancher, côté produit, l'un de :

- **SSO réservé aux membres déjà provisionnés** (recommandé au départ) : on
  n'autorise le login SSO que si un `profiles`/`pending_seats` existe déjà pour
  l'email — sinon on refuse. Zéro impact sur l'invariant de facturation.
- **JIT provisioning** : créer automatiquement le `profiles` au premier login SSO
  (mapping domaine → `company_id` + rôle par défaut `utilisateur`). Nécessite
  d'adapter `handle_new_user` et de rattacher la licence — **décision de
  facturation** à valider explicitement.

Tant que ce point n'est pas tranché, garder le SSO **désactivé** en production.

## Ce que CGI doit fournir

- Le **Tenant ID** Entra et une **App registration** (OIDC) ou les **métadonnées
  SAML** de leur IdP.
- La liste des **domaines** email (ex : `cgi.com`) et la politique de rôles
  souhaitée (qui est admin / gestionnaire / utilisateur).
