/* ═══ Shell natif Konsilys (Capacitor) ═══════════════════════════════════════
   Injecté uniquement dans le bundle iOS (par scripts/copy-web.mjs). Sur le web,
   ce fichier n'existe pas → l'app web reste inchangée.

   Fonctions natives (valeur ajoutée vs simple WebView, requis Apple 4.2) :
   - masquage du splash + barre de statut adaptée au thème,
   - verrouillage Face ID / Touch ID à l'ouverture et au retour d'arrière-plan,
   - inscription aux notifications push (jeton APNs persisté pour l'envoi serveur),
   - retour haptique léger, gestion du bouton retour.
   Tout est défensif : chaque appel plugin est optionnel et encapsulé. */
(function () {
  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;
  var P = C.Plugins || {};
  var LS = window.localStorage;
  function get(k, d) { try { return LS.getItem(k) == null ? d : LS.getItem(k); } catch (e) { return d; } }

  /* ── Barre de statut : suit le thème clair/sombre de l'app ── */
  function applyStatusBar() {
    try {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark'
        || (window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches);
      if (P.StatusBar) {
        P.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(function () {});
      }
    } catch (e) {}
  }

  /* ── Verrou biométrique (Face ID / Touch ID) ──
     Un voile plein écran masque le contenu tant que l'utilisateur n'est pas
     authentifié. Activé par défaut ; désactivable via localStorage faceid=off. */
  var locked = false;
  function makeVeil() {
    if (document.getElementById('kf-veil')) return document.getElementById('kf-veil');
    var v = document.createElement('div');
    v.id = 'kf-veil';
    v.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#1B2B3A;display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#e8eef6;'
      + 'font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:24px';
    v.innerHTML = '<div style="display:flex;align-items:flex-end;gap:4px;height:38px">'
      + '<div style="width:7px;border-radius:3px;height:45%;background:#e9eef5"></div>'
      + '<div style="width:7px;border-radius:3px;height:68%;background:#e9eef5"></div>'
      + '<div style="width:7px;border-radius:3px;height:100%;background:#84CC16"></div></div>'
      + '<div style="font-size:17px;font-weight:700">Konsilys verrouillé</div>'
      + '<button id="kf-unlock" style="margin-top:6px;background:#84CC16;color:#16240a;border:none;'
      + 'border-radius:12px;padding:12px 22px;font:inherit;font-weight:700;font-size:15px">Déverrouiller</button>';
    document.body.appendChild(v);
    v.querySelector('#kf-unlock').addEventListener('click', unlock);
    return v;
  }
  async function unlock() {
    try {
      if (!P.BiometricAuth) { hideVeil(); return; }
      var avail = await P.BiometricAuth.checkBiometry();
      if (avail && avail.isAvailable === false) { hideVeil(); return; } // pas de biométrie → on n'enferme pas
      await P.BiometricAuth.authenticate({
        reason: 'Déverrouiller Konsilys',
        cancelTitle: 'Annuler',
        iosFallbackTitle: 'Utiliser le code',
        allowDeviceCredential: true
      });
      hideVeil();
    } catch (e) { /* échec/annulation : le voile reste */ }
  }
  function showVeil() { if (get('faceid', 'on') === 'off') return; locked = true; makeVeil().style.display = 'flex'; }
  function hideVeil() { locked = false; var v = document.getElementById('kf-veil'); if (v) v.style.display = 'none'; }

  /* ── Notifications push : inscription + persistance du jeton APNs ── */
  function persistToken(token) {
    try { LS.setItem('apns_token', token); } catch (e) {}
    // Best-effort : si le client Supabase et une session existent, on enregistre le jeton.
    try {
      var sb = window.sb, cid = window.SB_CID;
      if (sb && sb.auth && sb.from) {
        sb.auth.getUser().then(function (r) {
          var u = r && r.data && r.data.user;
          if (!u) return;
          sb.from('device_tokens').upsert({
            token: token, platform: 'ios', user_id: u.id, company_id: cid || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'token' }).then(function () {}, function () {});
        }, function () {});
      }
    } catch (e) {}
  }
  async function initPush() {
    try {
      if (!P.PushNotifications) return;
      var perm = await P.PushNotifications.requestPermissions();
      if (!perm || perm.receive !== 'granted') return;
      P.PushNotifications.addListener('registration', function (t) { if (t && t.value) persistToken(t.value); });
      P.PushNotifications.addListener('registrationError', function () {});
      await P.PushNotifications.register();
    } catch (e) {}
  }

  /* ── Bouton retour matériel (iPad avec clavier / gestes) → historique web ── */
  function initApp() {
    try {
      if (P.App) {
        P.App.addListener('backButton', function () { if (window.history.length > 1) window.history.back(); });
        P.App.addListener('resume', function () { applyStatusBar(); showVeil(); if (locked) unlock(); });
      }
    } catch (e) {}
  }

  /* ── Amorçage ── */
  function boot() {
    applyStatusBar();
    initApp();
    // Verrou à l'ouverture puis tentative d'authentification immédiate.
    showVeil(); unlock();
    initPush();
    // Le splash natif se retire une fois l'app peinte.
    setTimeout(function () { try { if (P.SplashScreen) P.SplashScreen.hide(); } catch (e) {} }, 400);
    // Suivre les changements de thème de l'app.
    try {
      new MutationObserver(applyStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}
  }

  // Expose un minimum pour l'app (activer/désactiver Face ID depuis les réglages).
  window.KonsilysNative = {
    setFaceId: function (on) { try { LS.setItem('faceid', on ? 'on' : 'off'); } catch (e) {} },
    isNative: true
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
