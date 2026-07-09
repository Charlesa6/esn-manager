# IndexNow — indexation instantanée (Bing, Yandex, ChatGPT Search)

**IndexNow** est un protocole qui permet de **notifier les moteurs dès qu'une page
change**, au lieu d'attendre le prochain passage de leur robot. Bing l'utilise
(et Bing alimente ChatGPT Search et l'assistant Windows), Yandex aussi.

## Ce qui est en place

- **Clé** : `3d01b637c6697996e572ab04d5b2e3db`
- **Fichier de clé** : `3d01b637c6697996e572ab04d5b2e3db.txt` à la racine du dépôt →
  servi à `https://konsilys.fr/3d01b637c6697996e572ab04d5b2e3db.txt`.
- **Script de soumission** : `scripts/indexnow-submit.sh`.

Le fichier de clé prouve que vous possédez le domaine : IndexNow le lit avant
d'accepter vos soumissions. Il doit rester en ligne.

## Comment soumettre des URL

Une fois le site déployé (le fichier `.txt` doit être accessible en ligne) :

```bash
# Soumettre la liste par défaut (accueil + blog + articles)
./scripts/indexnow-submit.sh

# Soumettre une page précise (ex : un nouvel article)
./scripts/indexnow-submit.sh https://konsilys.fr/blog/mon-nouvel-article.html
```

Réponse `HTTP 200` ou `202` = accepté. `403` = la clé n'est pas trouvée en ligne
(vérifiez que `https://konsilys.fr/3d01b637c6697996e572ab04d5b2e3db.txt`
s'affiche bien et contient la clé).

## Quand l'utiliser

- À chaque **publication** d'un nouvel article ou **modification importante**
  d'une page. Une seule soumission par changement suffit.
- Inutile de soumettre en boucle : cela n'accélère rien de plus.

## Alternative sans terminal

Vous pouvez aussi soumettre une URL depuis un navigateur (méthode « ping ») :

```
https://api.indexnow.org/indexnow?url=https://konsilys.fr/&key=3d01b637c6697996e572ab04d5b2e3db
```

## Note

IndexNow concerne Bing/Yandex. Pour **Google**, l'équivalent est le sitemap +
« Demander une indexation » dans Google Search Console (déjà en place).
