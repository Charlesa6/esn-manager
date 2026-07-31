// Assemble le dossier www/ de l'app iOS à partir de l'app web (racine du repo).
// - copie les fichiers nécessaires (login = point d'entrée, app, js, icônes, manifest)
// - réécrit les routes web (/login, /app gérées par les rewrites Vercel) en fichiers
//   locaux, puisque le bundle natif n'a pas de serveur de réécriture
// - injecte le shell natif (native.js) + le drapeau window.__NATIVE__
//
// Aucun bundler : simple copie + remplacements de chaînes. Exécuter : `npm run sync-web`.
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');   // racine du repo
const WWW = join(here, '..', 'www');

// 1. Repartir d'un www/ propre.
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });

// 2. Réécriture des routes web → fichiers locaux du bundle.
function rewrite(text) {
  return text
    .replaceAll('"/app"', '"esn_manager_cgi.html"')
    .replaceAll("'/app'", "'esn_manager_cgi.html'")
    .replaceAll('"/login"', '"esn_login.html"')
    .replaceAll("'/login'", "'esn_login.html'");
}

// 3. Injecte le shell natif : drapeau __NATIVE__ tôt + script natif en fin de body.
function injectNative(html) {
  html = html.replace(/<body([^>]*)>/i, '<body$1>\n<script>window.__NATIVE__=true;</script>');
  html = html.replace(/<\/body>/i, '<script src="native.js"></script>\n</body>');
  return html;
}

function copyHtml(srcName, destName, withNative) {
  let html = readFileSync(join(ROOT, srcName), 'utf8');
  html = rewrite(html);
  if (withNative) html = injectNative(html);
  writeFileSync(join(WWW, destName), html);
  console.log('  html →', destName);
}

// Point d'entrée = page de connexion (index.html), + copie nommée pour les redirections.
copyHtml('esn_login.html', 'index.html', true);
copyHtml('esn_login.html', 'esn_login.html', true);
copyHtml('esn_manager_cgi.html', 'esn_manager_cgi.html', true);
if (existsSync(join(ROOT, 'cgu.html'))) copyHtml('cgu.html', 'cgu.html', false);

// 4. Assets : les modules JS (avec réécriture des routes), icônes, manifest.
mkdirSync(join(WWW, 'js'), { recursive: true });
cpSync(join(ROOT, 'js'), join(WWW, 'js'), { recursive: true });
// Réécrit les routes dans les modules JS copiés.
import('node:fs').then(({ readdirSync }) => {
  for (const f of readdirSync(join(WWW, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const p = join(WWW, 'js', f);
    writeFileSync(p, rewrite(readFileSync(p, 'utf8')));
  }
  console.log('  js  → réécrits');
});

cpSync(join(ROOT, 'icons'), join(WWW, 'icons'), { recursive: true });
if (existsSync(join(ROOT, 'manifest.webmanifest')))
  cpSync(join(ROOT, 'manifest.webmanifest'), join(WWW, 'manifest.webmanifest'));

// 5. Shell natif.
cpSync(join(here, '..', 'src', 'native.js'), join(WWW, 'native.js'));

console.log('✓ www/ assemblé pour Capacitor (' + WWW + ')');
