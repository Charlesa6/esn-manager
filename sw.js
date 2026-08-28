/* Service worker Konsilys (PWA).
   - Shell same-origin en cache-first (mise à jour en arrière-plan).
   - Navigations en network-first (repli sur le shell mis en cache, utile hors-ligne).
   - Requêtes API (Supabase, Microsoft, Stripe) et autres cross-origin : réseau direct,
     jamais mises en cache (données fraîches + confidentialité).
   Bump CACHE à chaque déploiement pour purger l'ancien shell. */
const CACHE = 'konsilys-shell-v3';
const SHELL = [
  '/app',
  '/esn_manager_cgi.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/js/01-core.js', '/js/03-sidebar.js', '/js/04-dashboard.js', '/js/05-missions-planning.js',
  '/js/06-kpis.js', '/js/07-leaves.js', '/js/08-access-admin.js', '/js/09-business.js',
  '/js/10-help-tutorials.js', '/js/11-directeurs-modal.js', '/js/12-recrutement.js',
  '/js/13-render-events.js', '/js/15-integrations.js', '/js/16-imports.js', '/js/14-data-boot.js',
  '/vendor/supabase-js.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Best-effort : un asset indisponible ne fait pas échouer l'installation.
    await Promise.allSettled(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Ne jamais mettre en cache les appels API / auth (données sensibles, fraîcheur).
  if (!sameOrigin && !/cdn\.jsdelivr\.net/.test(url.host) && !/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    return; // réseau direct géré par le navigateur
  }

  // Navigations : network-first avec repli sur le shell.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/app', net.clone()).catch(() => {});
        return net;
      } catch (_) {
        return (await caches.match('/app')) || (await caches.match('/esn_manager_cgi.html')) || Response.error();
      }
    })());
    return;
  }

  // Assets (same-origin + CDN/fonts) : cache-first, revalidation en arrière-plan.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchAndCache = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => cached);
    return cached || fetchAndCache;
  })());
});
