/* ══════════════════════════════════════════════════════════════════════════
   Tests de bout-en-bout Konsilys (Playwright, sans build/npm)
   ---------------------------------------------------------------------------
   Objectif : détecter les régressions sur les parcours critiques sans dépendre
   de Supabase (réseau). On charge les pages en file:// et on intercepte les CDN
   (@supabase, xlsx) avec un stub, pour que l'app démarre hors-ligne. L'app
   produit est testée en MODE DÉMO (?demo=true) : données fictives, pas d'auth.

   Lancer :  node tests/e2e.cjs
   Playwright est attendu dans l'environnement (voir tests/README.md).
   Sortie : liste PASS/FAIL + code de sortie non-nul si un test échoue.
   ═══════════════════════════════════════════════════════════════════════════ */
const path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; }
  catch (e2) { console.error('Playwright introuvable. Voir tests/README.md'); process.exit(2); }
}
const EXEC = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '..');
const fileUrl = (f) => 'file://' + path.join(ROOT, f);

/* Stub minimal de @supabase/supabase-js : createClient renvoie un client dont
   les méthodes ne font rien (chaînables), suffisant pour que les pages bootent. */
const SUPABASE_STUB = `
window.supabase = (function(){
  function qb(){ var o={}; ['select','insert','update','upsert','delete','eq','neq','in','is','not','order','limit','single','maybeSingle','gte','lte','gt','lt','like','ilike','range','filter','contains','or'].forEach(function(m){ o[m]=function(){ return o; }; }); o.then=function(res){ return Promise.resolve({data:[],error:null}).then(res); }; return o; }
  return { createClient: function(){ return {
    auth:{ getSession:function(){return Promise.resolve({data:{session:null},error:null});},
           getUser:function(){return Promise.resolve({data:{user:null},error:null});},
           onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}};},
           signInWithPassword:function(){return Promise.resolve({data:{},error:{message:'stub'}});},
           signUp:function(){return Promise.resolve({data:{},error:{message:'stub'}});},
           signOut:function(){return Promise.resolve({error:null});},
           updateUser:function(){return Promise.resolve({data:{},error:null});},
           setSession:function(){return Promise.resolve({data:{},error:null});} },
    from:function(){return qb();},
    rpc:function(){return Promise.resolve({data:null,error:null});},
    functions:{ invoke:function(){return Promise.resolve({data:null,error:null});} },
    channel:function(){return {on:function(){return this;},subscribe:function(){return this;}};}
  }; } };
})();
`;

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: detail || '' });
  console.log((cond ? '  \x1b[32mPASS\x1b[0m ' : '  \x1b[31mFAIL\x1b[0m ') + name + (cond ? '' : '  → ' + (detail || '')));
}

async function newPage(browser) {
  const ctx = await browser.newContext();
  // Interception CDN : renvoie le stub pour @supabase, un no-op pour le reste.
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('@supabase') || url.includes('supabase-js')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: SUPABASE_STUB });
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      // autres CDN (xlsx, polices…) : no-op pour rester hors-ligne
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stubbed */' });
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page._appErrors = errors;
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });

  // ── 1. Landing (index.html) ───────────────────────────────────────────────
  console.log('\n▶ Landing — index.html');
  try {
    const p = await newPage(browser);
    await p.goto(fileUrl('index.html'), { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(1200);
    const txt = await p.evaluate(() => document.body.innerText);
    check('la landing se charge (titre Konsilys présent)', /konsilys/i.test(txt));
    check('tunnel d’abonnement présent', /abonnement|licence|s’abonner|abonner/i.test(txt));
    check('aucune erreur JS fatale', p._appErrors.length === 0, p._appErrors.join(' | '));
    await p.context().close();
  } catch (e) { check('landing charge sans exception', false, e.message); }

  // ── 2. Login (esn_login.html) ─────────────────────────────────────────────
  console.log('\n▶ Login — esn_login.html');
  try {
    const p = await newPage(browser);
    await p.goto(fileUrl('esn_login.html'), { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(1200);
    const nInputs = await p.$$eval('input', (els) => els.length);
    check('la page login se charge avec des champs', nInputs >= 2, nInputs + ' champ(s)');
    check('aucune erreur JS fatale', p._appErrors.length === 0, p._appErrors.join(' | '));
    await p.context().close();
  } catch (e) { check('login charge sans exception', false, e.message); }

  // ── 3. App produit en mode démo (esn_manager_cgi.html?demo=true) ──────────
  console.log('\n▶ App (mode démo) — esn_manager_cgi.html');
  try {
    const p = await newPage(browser);
    await p.goto(fileUrl('esn_manager_cgi.html') + '?demo=true', { waitUntil: 'load', timeout: 30000 });
    await p.waitForTimeout(2500);
    const role = await p.evaluate(() => window.S && S.role);
    check('l’app démarre (état S initialisé, rôle=' + role + ')', !!role);

    // Navigation : chaque onglet principal se rend sans planter
    const tabs = ['kpis', 'dashboard', 'teams', 'missions', 'planning', 'leaves'];
    for (const t of tabs) {
      const btn = await p.$('[data-nav="' + t + '"]');
      if (!btn) { check('onglet ' + t + ' présent', false, 'bouton nav absent'); continue; }
      await btn.click();
      await p.waitForTimeout(500);
      const errCount = p._appErrors.length;
      check('navigation vers « ' + t +' » sans erreur JS', errCount === 0, p._appErrors.join(' | '));
    }

    // Feature : Prévisionnel + marge consolidée BU/Practice (onglet KPIs)
    const kb = await p.$('[data-nav="kpis"]'); if (kb) { await kb.click(); await p.waitForTimeout(800); }
    const bodyTxt = await p.evaluate(() => document.body.innerText);
    check('KPIs : prévisionnel de CA affiché', /Prévisionnel de CA/.test(bodyTxt));
    check('KPIs : marge consolidée par unité affichée', /Marge consolidée par unité/.test(bodyTxt));

    // Force l'activation des modules Business + Recrutement pour exercer ces
    // écrans (sinon masqués en démo) — couvre les modules js/09 et js/12.
    await p.evaluate(() => { S.settings = S.settings || {}; S.settings.hasBusinessModule = true; S.settings.hasRecrutementModule = true; render(); });
    await p.waitForTimeout(400);
    for (const t of ['business', 'recrutement']) {
      const btn = await p.$('[data-nav="' + t + '"]');
      if (!btn) { check('onglet ' + t + ' présent (module activé)', false, 'bouton nav absent'); continue; }
      const before = p._appErrors.length;
      await btn.click(); await p.waitForTimeout(500);
      check('navigation vers « ' + t + ' » sans erreur JS', p._appErrors.length === before, p._appErrors.slice(before).join(' | '));
    }
    // Ouverture d'un modal (nouveau candidat) — exerce tModal + widgets recrutement
    const arec = await p.$('[data-act="arec"]');
    if (arec) {
      const before = p._appErrors.length;
      await arec.click(); await p.waitForTimeout(400);
      const modalOpen = await p.evaluate(() => !!document.querySelector('.mov,.mob,.mbody,.mody'));
      check('ouverture du modal « Nouveau candidat » sans erreur', modalOpen && p._appErrors.length === before, p._appErrors.slice(before).join(' | '));
    }

    // Montée en charge : la hero-bande KPIs lit l'agrégat serveur derrière le
    // drapeau KPI_SERVER_AGG. On injecte un agrégat distinctif (staffing 87,6 %)
    // pour la fenêtre courante et on vérifie que la hero l'affiche, puis on remet
    // le drapeau à off (état par défaut).
    const beforeFlag = await p.evaluate(() => {
      S.modal = null; S.tab = 'kpis'; render();       // ferme un éventuel modal ouvert et va sur KPIs
      return document.body.innerText;
    });
    check('KPIs (drapeau off) : n’affiche pas la valeur serveur injectée', !/87[.,]6\s*%/.test(beforeFlag));
    const afterFlag = await p.evaluate(() => {
      window.KPI_SERVER_AGG = true;
      S.companyKpis = { avgSr: 87.6, totR: 9123456, totBill: 1234, avgTJM: 543, avgM: 21.7, totSalary: 6111222, netC: 3012234, nCons: 99 };
      S.companyKpisKey = (S.year || CFY) + '|' + (S.quarter || '');
      render();
      return document.body.innerText;
    });
    check('KPIs (drapeau on) : la hero lit l’agrégat serveur (staffing 87,6 %)', /87[.,]6\s*%/.test(afterFlag));
    const restored = await p.evaluate(() => { window.KPI_SERVER_AGG = false; render(); return document.body.innerText; });
    check('KPIs : retour au calcul local quand le drapeau repasse off', !/87[.,]6\s*%/.test(restored));

    check('aucune erreur JS fatale sur tout le parcours app', p._appErrors.length === 0, p._appErrors.join(' | '));
    await p.context().close();
  } catch (e) { check('app démo charge sans exception', false, e.message); }

  await browser.close();

  // ── Bilan ─────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '─'.repeat(60));
  console.log(`${results.length - failed.length}/${results.length} tests réussis` + (failed.length ? ` — \x1b[31m${failed.length} échec(s)\x1b[0m` : ' — \x1b[32mtout est vert\x1b[0m'));
  process.exit(failed.length ? 1 : 0);
})();
