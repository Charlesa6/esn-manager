#!/bin/bash
# Hook SessionStart — Konsilys (Claude Code on the web)
#
# Ce projet est du HTML/CSS/JS vanilla : pas de package.json, pas d'étape de
# build, aucune dépendance npm. L'image web embarque déjà la chaîne d'outils dont
# les tests et le lint ont besoin (Node 22, plus playwright / eslint / http-server
# installés globalement, et un Chromium pré-installé). Il n'y a donc RIEN à
# installer — le rôle du hook est de rendre cette chaîne d'outils fiablement
# accessible dans chaque shell de la session :
#   - mettre Node 22 sur le PATH,
#   - exporter NODE_PATH pour que `require('playwright')` se résolve depuis
#     n'importe quel dossier (tests/e2e.cjs dépend sinon d'un chemin de secours
#     codé en dur).
#
# Idempotent et réexécutable sans risque. Synchrone (la session attend sa fin).
set -euo pipefail

# Ne s'exécute que dans Claude Code on the web (environnement distant).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ENV_FILE="${CLAUDE_ENV_FILE:-/dev/null}"

# Node 22 (avec playwright/eslint/http-server globaux) dans l'image web.
NODE_BIN="/opt/node22/bin"
if [ -d "$NODE_BIN" ]; then
  case ":${PATH}:" in
    *":$NODE_BIN:"*) ;;                       # déjà présent
    *) export PATH="$NODE_BIN:$PATH" ;;
  esac
  echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$ENV_FILE"
fi

# Rend les modules installés globalement (playwright, …) résolvables par require()
# partout, pour que `node tests/e2e.cjs` fonctionne quel que soit le dossier courant.
GLOBAL_MODULES="/opt/node22/lib/node_modules"
if [ -d "$GLOBAL_MODULES" ]; then
  export NODE_PATH="$GLOBAL_MODULES"
  echo "export NODE_PATH=\"$GLOBAL_MODULES\"" >> "$ENV_FILE"
fi

# Vérifie que la chaîne d'outils est présente (échoue franchement si l'image change).
node --version >/dev/null
echo "session-start : Node $(node --version) prêt · aucun build/deps npm · e2e via 'node tests/e2e.cjs'"
