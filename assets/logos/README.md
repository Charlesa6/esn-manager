# Logos des intégrations

La section « Intégrations API » de la landing (`index.html`, `#integrations`)
affiche pour chaque connecteur une **pastille de marque maison** (monogramme aux
couleurs de l'éditeur) tant qu'aucun logo officiel n'est présent.

Pour afficher le **logo officiel** d'un éditeur, déposez son fichier ici sous le
nom exact ci-dessous, au format **SVG** (fond transparent de préférence). Le logo
remplace alors automatiquement la pastille ; si le fichier est absent, la pastille
reste affichée (aucune image cassée).

| Fichier attendu | Éditeur |
|-----------------|---------|
| `microsoft.svg` | Microsoft 365 / Entra ID |
| `workday.svg` | Workday |
| `successfactors.svg` | SAP SuccessFactors |
| `lucca.svg` | Lucca |
| `bamboohr.svg` | BambooHR |
| `silae.svg` | Silae |
| `payfit.svg` | PayFit |
| `adp.svg` | ADP |
| `pennylane.svg` | Pennylane |
| `sage.svg` | Sage |
| `sellsy.svg` | Sellsy |
| `quickbooks.svg` | QuickBooks (Intuit) |

## Où récupérer les logos officiels

Chaque éditeur publie ses logos sur une page « brand assets » / « presse » /
« media kit », ou les fournit via son programme partenaire. **Respectez les
conditions d'usage de chaque marque** (les logos sont des marques déposées) :
n'utilisez que des fichiers que vous êtes autorisé à afficher.

## Détails techniques

- Rendu : `36–38 px`, fond blanc arrondi (`.intg-logo` dans `index.html`).
- Le fichier doit s'appeler exactement comme dans le tableau (minuscules, `.svg`).
- Pour utiliser un PNG à la place, remplacez l'extension `.svg` par `.png` dans le
  tableau de données du script de rendu (`#integrations` dans `index.html`).
