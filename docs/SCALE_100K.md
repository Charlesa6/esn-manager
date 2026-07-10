# Monter en charge jusqu'à 100 000 utilisateurs

Plan de montée en charge de Konsilys, avec l'impact sur le parcours utilisateur et
un ordre de travaux **progressif, derrière un drapeau, sans régression** pour les
clients actuels.

## 1. Deux scénarios très différents

| Scénario | Modèle actuel | Verdict |
|----------|---------------|---------|
| **100 000 utilisateurs répartis sur beaucoup d'entreprises** (chacune < quelques centaines de personnes) | tient bien | dimensionner Supabase (Phase A) suffit |
| **100 000 utilisateurs dans UNE entreprise** (CGI en tenant unique) | ne tient pas | nécessite la refonte du chargement (Phase B) |

La différence : aujourd'hui l'app charge **les tables de l'entreprise entière** dans
le navigateur. Pour une entreprise de 100 000 personnes, chaque connexion tirerait
des centaines de milliers de lignes — d'où la refonte pour un méga-tenant.

## 2. Où sont les limites aujourd'hui

- **Front (Vercel/CDN)** : aucun problème, sert la page à un nombre illimité d'utilisateurs.
- **Chargement des données** : `loadSB()` charge des tables entières en mémoire
  (consultants, missions, absences, candidats, profils). La pagination `sbFetchAll`
  lève le plafond des 1 000 lignes mais **récupère quand même tout**.
- **KPIs** : recalculés **côté navigateur** sur l'ensemble des lignes.
- **Base de données (Postgres)** : le vrai goulot de concurrence — pool de connexions
  et compute de l'instance.
- **RLS** : policies évaluées par ligne ; à l'échelle, les appels de fonction
  (`my_company_id()`) non mis en cache coûtent cher.
- **Realtime** : les abonnements ont des limites de connexions simultanées.

Ordre de grandeur actuel (à confirmer par test de charge) : quelques **centaines**
d'utilisateurs actifs simultanés en lecture sur une petite instance ; **milliers**
avec une instance dédiée + pooler ; **100 000** seulement avec Phase A **et** B.

## 3. Impact sur le parcours utilisateur

Globalement, la refonte **accélère** l'expérience à l'échelle. Ce qui change :

| Aspect | Avant | Après |
|--------|-------|-------|
| Connexion / 1er écran | tout charge d'un coup (lent si gros) | s'affiche tout de suite (périmètre de l'utilisateur) ✅ |
| KPIs / tableaux de bord | recalculés dans le navigateur | pré-agrégés en base, quasi instantanés ✅ |
| Listes (Équipe, Missions) | tout affiché | pagination / défilement infini par lots |
| Recherche & filtres | instantanés (local) | côté serveur → micro-latence (~100–300 ms) |
| Mémoire / mobile | lourd | léger et fluide ✅ |

**Seule vraie contrepartie** : la recherche et certains filtres passent côté serveur
(petit délai au lieu de zéro). On le rend imperceptible : *debounce*, indicateur de
chargement discret, cache des dernières requêtes.

**Ce qui ne change pas** : l'interface (mêmes écrans, même design), les rôles et
permissions. C'est de la plomberie sous le capot.

**Compatibilité descendante** : pour une ESN de taille normale, on peut **garder le
comportement actuel** (tout en local) et n'activer le **mode paginé/serveur que
pour les très gros tenants** (drapeau par entreprise, ex. seuil de N collaborateurs).
Chacun garde la meilleure expérience selon sa taille.

## 4. Plan de travaux

### Phase A — Dimensionner l'infrastructure (rapide, sans refonte)
- [ ] Plan Supabase adapté + **instance de calcul dédiée** (RAM/CPU).
- [ ] **Connection pooler** (Supavisor, mode transaction) côté client.
- [ ] **Réplicas de lecture** pour les écrans de reporting/KPIs.
- [ ] **Index** vérifiés sur `company_id`, `consultant_id`, dates, et colonnes de filtre.
- [ ] **Optimiser les RLS** : envelopper les helpers en `(select my_company_id())`
      pour une évaluation par requête, pas par ligne.
- [ ] Relever les **limites d'auth** (logins/minute) au niveau attendu.

### Phase B — Refondre le chargement (le vrai chantier méga-tenant)
À faire **écran par écran, derrière un drapeau**, avec E2E à chaque étape :
1. [x] **KPIs agrégés en SQL** — fait et **prouvé identique au JS** (calendrier,
       cœur par consultant, agrégat entreprise **exercice complet ET trimestre** ;
       parité 0 écart, y compris sur données réelles de prod — voir `tests/parity/`).
       Subtilité trimestre gérée : la fenêtre borne tWD/CA/facturation mais le coût
       salarial reste proratisé sur l'exercice complet (dénominateur explicite).
       Fonctions déployées (`konsilys_kpi_core`, `konsilys_company_kpis`,
       `konsilys_company_kpis_range`) ; `loadCompanyKpis()` choisit la fenêtre selon
       `S.quarter`. Drapeau `KPI_SERVER_AGG` encore off. Reste : découpage par BU,
       refonte de l'écran pour lire l'agrégat (au lieu de `buildKS`), puis activation.
2. [ ] **Équipe** : pagination + recherche serveur, liste virtualisée.
3. [ ] **Missions** : idem + filtres serveur.
4. [ ] **Planning** : chargement par période/fenêtre visible.
5. [ ] **Chargement au login** : ne charger que le périmètre de l'utilisateur
       (son équipe, ses missions, période courante) au lieu de tout l'org.
6. [ ] **Realtime** sélectif : s'abonner au strict nécessaire.

### Phase C — Valider par un test de charge
- [ ] Scénario **k6** (ou équivalent) simulant N utilisateurs simultanés
      (login + navigation + KPIs + écriture).
- [ ] Mesurer p95/p99 de latence et le point de saturation.
- [ ] Rejouer après chaque optimisation pour chiffrer le gain.
- [ ] **Observabilité** : logs Supabase, métriques DB, alertes.

## 5. Principe directeur

Refonte **transparente pour l'utilisateur** : gain de vitesse au démarrage et en
fluidité, seule « perte » = le zéro-latence sur la recherche (rendu imperceptible).
Tout est fait **progressivement, derrière un drapeau, écran par écran**, avec les
tests E2E — donc **zéro régression** pour les clients actuels pendant qu'on prépare
l'échelle CGI.

## 6. Prochaine brique

**KPIs agrégés en SQL** (Phase B.1) : créer des fonctions/vues qui renvoient les
indicateurs déjà consolidés (staffing, CA, TJM, marge, contribution) par entreprise,
BU, exercice et trimestre, et faire lire l'app dessus derrière un drapeau. Invisible
pour l'utilisateur, gros gain de charge — le bon point de départ.
