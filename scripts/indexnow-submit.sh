#!/usr/bin/env bash
# IndexNow — notifie instantanément Bing/Yandex (et donc ChatGPT Search) qu'une
# ou plusieurs pages ont changé, sans attendre le prochain passage du robot.
#
# Prérequis : la clé doit être en ligne à
#   https://konsilys.fr/3d01b637c6697996e572ab04d5b2e3db.txt
# (déjà déposée à la racine du site, déployée par Vercel).
#
# Usage :
#   ./scripts/indexnow-submit.sh                 # soumet la liste par défaut
#   ./scripts/indexnow-submit.sh https://konsilys.fr/blog/mon-article.html
#                                                # soumet une (ou plusieurs) URL précises
set -euo pipefail

HOST="konsilys.fr"
KEY="3d01b637c6697996e572ab04d5b2e3db"
KEYLOC="https://${HOST}/${KEY}.txt"

# URLs par défaut (mettre à jour quand vous ajoutez des pages) :
DEFAULT_URLS=(
  "https://konsilys.fr/"
  "https://konsilys.fr/blog/"
  "https://konsilys.fr/blog/logiciel-staffing-esn.html"
  "https://konsilys.fr/blog/suivre-marge-mission-esn.html"
  "https://konsilys.fr/blog/integrations-sirh-paie-facturation.html"
)

if [ "$#" -gt 0 ]; then
  URLS=("$@")
else
  URLS=("${DEFAULT_URLS[@]}")
fi

# Construit le tableau JSON urlList
json_urls=$(printf '"%s",' "${URLS[@]}")
json_urls="[${json_urls%,}]"

body=$(cat <<JSON
{"host":"${HOST}","key":"${KEY}","keyLocation":"${KEYLOC}","urlList":${json_urls}}
JSON
)

echo "Soumission IndexNow de ${#URLS[@]} URL(s)…"
curl -sS -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "${body}" -w "\nHTTP %{http_code}\n"

# 200 ou 202 = accepté. 403 = clé introuvable/invalide (vérifiez que le .txt est en ligne).
