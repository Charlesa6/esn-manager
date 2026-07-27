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
const fs = require('fs');
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
  // En local/web on cible le Chromium pré-installé ; en CI (binaire absent) on
  // laisse Playwright utiliser le sien (installé via `playwright install`).
  const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {});

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

    // Navigation via la barre latérale groupée en pôles : un sous-onglet peut être
    // dans un pôle replié (donc masqué). goTab déclenche le vrai handler de nav
    // (navGo), qu'il s'agisse d'un onglet simple ou d'un sous-onglet de pôle.
    async function goTab(t) {
      const ok = await p.evaluate((tab) => {
        var b = document.querySelector('[data-nav="' + tab + '"]');
        if (!b) return false;
        b.click(); // déclenche navGo(tab) — fonctionne même si le pôle est replié
        return true;
      }, t);
      await p.waitForTimeout(500);
      return ok;
    }

    // Navigation : chaque onglet principal se rend sans planter
    const tabs = ['kpis', 'dashboard', 'teams', 'missions', 'planning', 'leaves', 'opportunites'];
    for (const t of tabs) {
      const ok = await goTab(t);
      if (!ok) { check('onglet ' + t + ' présent', false, 'bouton nav absent'); continue; }
      const errCount = p._appErrors.length;
      check('navigation vers « ' + t +' » sans erreur JS', errCount === 0, p._appErrors.join(' | '));
    }

    // Barre latérale groupée : les pôles sont REPLIÉS par défaut ; cliquer l'en-tête
    // (data-navtoggle) déplie ce pôle et expose ses sous-onglets.
    const poleOk = await p.evaluate(() => {
      S.navOpen = {}; render();                                          // état plié par défaut
      var foldedBefore = document.querySelectorAll('.nsub:not([hidden])').length;
      var head = document.querySelector('[data-navtoggle]');
      if (!head) return { ok:false, why:'aucun pôle' };
      head.click();                                                       // déplie CE pôle
      var openAfter = document.querySelectorAll('.nsub:not([hidden])').length;
      var subVisible = !!document.querySelector('.nsub:not([hidden]) .nsb');
      return { ok: foldedBefore === 0 && openAfter === 1 && subVisible, foldedBefore: foldedBefore, openAfter: openAfter };
    });
    check('Sidebar : pôles repliés par défaut, l’en-tête les déplie', poleOk.ok, JSON.stringify(poleOk));

    // Feature : Prévisionnel + marge consolidée BU/Practice (onglet KPIs)
    await goTab('kpis'); await p.waitForTimeout(300);
    const bodyTxt = await p.evaluate(() => document.body.innerText);
    check('KPIs : prévisionnel de CA affiché', /Prévisionnel de CA/.test(bodyTxt));
    check('KPIs : marge consolidée par unité affichée', /Marge consolidée par unité/.test(bodyTxt));
    check('KPIs : Top clients affiché', /Top clients/.test(bodyTxt));

    // Garde-fou anti-régression du PÉRIMÈTRE : l'onglet Équipe ne doit PAS être vide
    // (un filtre de visibilité trop agressif l'avait vidé — cf. sanity check). On
    // compte les lignes consultant (bouton « Modifier » = data-act="ec").
    await goTab('teams');
    const teamRows = await p.evaluate(() => document.querySelectorAll('button[data-act="ec"]').length);
    check('Équipe : consultants affichés (' + teamRows + ' ligne(s), attendu > 0)', teamRows > 0, 'onglet Équipe vide');

    // Intercontrats (pilotage du staffing) : contenu + modal + onglets masqués
    await goTab('opportunites');
    const oppTxt = await p.evaluate(() => document.body.innerText);
    check('Intercontrats : en-tête « pilotage du staffing » affiché', /Intercontrats\s*—\s*pilotage du staffing/i.test(oppTxt));
    check('Opportunités : timeline semaine/mois présente', /Semaines/.test(oppTxt) && /Mois/.test(oppTxt));
    const oppAddBtn = await p.$('[data-act="opp-add"]');
    check('Opportunités : bouton « + Opportunité » présent', !!oppAddBtn);
    if (oppAddBtn) {
      await oppAddBtn.click(); await p.waitForTimeout(400);
      const modalTxt = await p.evaluate(() => document.getElementById('md') ? document.getElementById('md').innerText : '');
      check('Opportunités : modal du consultant s\'ouvre', /Nouvelle opportunité pressentie/.test(modalTxt));
      await p.evaluate(() => { S.modal = null; render(); }); await p.waitForTimeout(300);
    }
    // Gestion des accès & Paramètres : temporairement masqués sur toutes les licences
    const hiddenTabs = await p.evaluate(() =>
      !!document.querySelector('[data-nav="svp_acces"]') || !!document.querySelector('[data-nav="svp_settings"]'));
    check('Sidebar : Gestion des accès & Paramètres masqués', hiddenTabs === false);

    // Time Sheet (CRA hebdo) : onglet, statuts, cohérence congé, soumission, verrou
    {
      const before = p._appErrors.length;
      const okTab = await goTab('timesheet');
      check('onglet Time Sheet présent', okTab, 'bouton nav absent');
      if (okTab) {
        const tsTxt = await p.evaluate(() => document.body.innerText);
        check('Time Sheet : en-tête hebdomadaire affiché', /Time Sheet/.test(tsTxt) && /hebdomadaire/.test(tsTxt));
        check('Time Sheet : navigation sans erreur JS', p._appErrors.length === before, p._appErrors.slice(before).join(' | '));
        // d1 : semaine validée (2026-07-20) et soumise (2026-07-13) en démo → historique
        const statusTxt = await p.evaluate(() => {
          S.tsCid = 'd1'; S.tsWeek = ''; render();
          return document.body.innerText;
        });
        check('Time Sheet : statut « Validé » affiché (semaine approuvée)', /Validé/.test(statusTxt));
        check('Time Sheet : statut « En attente » affiché (semaine soumise)', /En attente/.test(statusTxt));
        // Cohérence congé : semaine 2026-07-13 de d1 (congés couverts par un congé validé)
        const okBadge = await p.evaluate(() => {
          S.tsCid = 'd1'; S.tsWeek = '2026-07-13'; render();
          return document.body.innerText;
        });
        check('Time Sheet : congé imputé validé en amont (✓ Congé validé)', /Congé validé/.test(okBadge));
        // Cohérence congé : semaine 2026-07-13 de d3 (jeudi en congé SANS demande posée)
        const koBadge = await p.evaluate(() => {
          S.tsCid = 'd3'; S.tsWeek = '2026-07-13'; render();
          return document.body.innerText;
        });
        check('Time Sheet : congé sans demande signalé (⚠ Aucune demande)', /Aucune demande/.test(koBadge));
        // Pop-up de cohérence à la saisie : mettre un jour en « Congé » ouvre ts_leavecheck
        const popupType = await p.evaluate(() => {
          S.consId = 'd1'; S.tsCid = 'd1'; var wk = tsWeekMonday('2026-06-15'); S.tsWeek = wk; S.tsEdit = null; render();
          tsEnsureEdit('d1', wk);
          var day = tsWeekDays(wk)[3]; // jeudi
          tsSetDay(day, 'leave');
          return S.modal && S.modal.type;
        });
        check('Time Sheet : pop-up cohérence congé à la saisie', popupType === 'ts_leavecheck');
        // Soumission d'une semaine → validée (pas de N+1 en démo) sans erreur
        const subStatus = await p.evaluate(() => {
          S.modal = null; var wk = tsWeekMonday('2026-06-15'); S.consId = 'd1'; S.tsCid = 'd1'; S.tsWeek = wk; render();
          submitTimesheet('d1', wk);
          var t = (S.timesheets || []).find(x => x.cid === 'd1' && x.week === wk);
          return t ? t.status : 'none';
        });
        check('Time Sheet : soumission d\'une semaine (statut = ' + subStatus + ')', subStatus !== 'none');
        // Verrouillage : la semaine approuvée marque ses jours 🔒 dans le calendrier
        const lockTxt = await p.evaluate(() => {
          S.tab = 'activite'; S.actCid = 'd1'; S.actMonth = '2026-06'; render();
          return document.body.innerText;
        });
        check('Time Sheet : semaine approuvée verrouillée (🔒) dans le calendrier', /🔒/.test(lockTxt));
        // Imputation par mission : le sélecteur d'un jour liste les missions du consultant
        const hasMissionOpt = await p.evaluate(() => {
          S.consId = 'd1'; S.tsCid = 'd1'; S.tsWeek = tsWeekMonday('2026-07-06'); S.tsEdit = null; S.tab = 'timesheet'; render();
          return Array.from(document.querySelectorAll('select option')).some(o => /Facturé — /.test(o.textContent));
        });
        check('Time Sheet : sélecteur d\'imputation par mission (client)', hasMissionOpt);
        // Validation N+1 : récap de la facturation par client (t1 = 3j BNP + 2j Orange)
        const billTxt = await p.evaluate(() => { S.modal = { type: 'ts_approve', id: 't1' }; render(); return document.getElementById('md').innerText; });
        check('Time Sheet : facturation par client dans la validation N+1', /BNP Paribas 3j/.test(billTxt) && /Orange 2j/.test(billTxt));
        // Révision acceptée : la semaine validée repasse en brouillon (déverrouillée)
        const revStatus = await p.evaluate(() => {
          S.modal = null; applyApproval({ type: 'ts_revision', payload: { tsId: 't1' } });
          return (S.timesheets.find(x => x.id === 't1') || {}).status;
        });
        check('Time Sheet : révision acceptée rouvre la semaine (draft)', revStatus === 'draft');
        // Détail par jour dans le pop-up de validation (imputation de chaque jour)
        const dayDetail = await p.evaluate(() => { S.modal = { type: 'ts_approve', id: 't4' }; render(); return document.getElementById('md').innerText; });
        check('Time Sheet : détail par jour dans la validation N+1', /Détail par jour/.test(dayDetail) && /Facturé · Société Générale/.test(dayDetail));
        // Écart prévu vs imputé : t1 (d1) imputé 2j Orange alors que prévu BNP → alerte
        const devInfo = await p.evaluate(() => {
          var n = tsDeviations('d1', (S.timesheets.find(x => x.id === 't1') || {}).days).length;
          S.modal = { type: 'ts_approve', id: 't1' }; render();
          return { n: n, txt: document.getElementById('md').innerText };
        });
        check('Time Sheet : écart planning détecté (2 jours)', devInfo.n === 2);
        check('Time Sheet : approbateur averti de l\'écart au planning', /modifié\(s\) par rapport au planning/.test(devInfo.txt) && /≠ prévu/.test(devInfo.txt));
        // CA piloté par le réalisé validé : dé-facturer 1 jour (m5, TJM 680) → CA -680
        const caDrop = await p.evaluate(() => {
          var c = S.cons.find(x => x.id === 'd5'), H = fyHols(2026), r = curRange(2026);
          var base = kpi(c, S.miss, S.lvs, 2026, H, r).rev;
          var wk = tsWeekMonday('2026-06-08'), days = tsWeekDays(wk), dmap = {};
          days.forEach(function (d, i) { dmap[d] = (i === 4) ? 'available' : 'm:m5'; });
          S.timesheets.push({ id: 'tz', cid: 'd5', week: wk, status: 'approved', days: dmap });
          var after = kpi(c, S.miss, S.lvs, 2026, H, r).rev;
          S.timesheets = S.timesheets.filter(x => x.id !== 'tz');
          return Math.round(base - after);
        });
        check('Time Sheet validé → CA : 1 jour dé-facturé retire le TJM (−680€)', caDrop === 680);
        // Réallocation client (BNP→Orange) : le TS validé change le CA vs plan
        const caReallocated = await p.evaluate(() => {
          var c = S.cons.find(x => x.id === 'd1'), H = fyHols(2026), r = curRange(2026);
          var t1 = S.timesheets.find(x => x.id === 't1'), old = t1.status;
          t1.status = 'approved'; var withTs = kpi(c, S.miss, S.lvs, 2026, H, r).rev;
          t1.status = 'draft'; var without = kpi(c, S.miss, S.lvs, 2026, H, r).rev;
          t1.status = old;
          return Math.round(withTs) !== Math.round(without);
        });
        check('Time Sheet validé → CA : réallocation client impacte le CA', caReallocated);
        // Onglet Activité piloté par le réalisé : jour validé « dispo » s'affiche Disponible
        const actReal = await p.evaluate(() => {
          var wk = tsWeekMonday('2026-06-08'), days = tsWeekDays(wk), dmap = {};
          days.forEach(function (d, i) { dmap[d] = (i === 4) ? 'available' : 'm:m5'; });
          S.timesheets.push({ id: 'tz2', cid: 'd5', week: wk, status: 'approved', days: dmap });
          S.tab = 'activite'; S.actCid = 'd5'; S.actMonth = '2026-06'; render();
          var ea = effActivity('d5', days[4]);
          S.timesheets = S.timesheets.filter(x => x.id !== 'tz2');
          return ea.kind;
        });
        check('Activité : jour validé en « dispo » piloté par le réalisé', actReal === 'available');
        // Sélecteur de date de semaine (passé/futur) présent côté demandeur
        const hasDatePicker = await p.evaluate(() => {
          S.modal = null; S.consId = 'd1'; S.tsCid = 'd1'; S.tab = 'timesheet'; render();
          return !!document.querySelector('input[type="date"][onchange^="tsPickWeek"]');
        });
        check('Time Sheet : sélecteur de date de semaine présent', hasDatePicker);
        // Saut vers une semaine FUTURE via le sélecteur de date
        const futureWeek = await p.evaluate(() => { tsPickWeek('2027-01-15'); return S.tsWeek === tsWeekMonday('2027-01-15'); });
        check('Time Sheet : saut vers une semaine future', futureWeek);
        // Côté approbateur : bouton « Examiner / Valider » sur une semaine soumise
        const canExamine = await p.evaluate(() => {
          S.tsCid = 'd1'; S.tsWeek = '2026-07-13'; S.tsEdit = null; render(); // semaine soumise (t2)
          return /Examiner \/ Valider/.test(document.body.innerText);
        });
        check('Time Sheet : approbateur peut examiner/valider une semaine choisie', canExamine);
        await p.evaluate(() => { S.consId = null; S.modal = null; S.tab = 'kpis'; render(); });
      }
    }

    // Force l'activation des modules Business + Recrutement pour exercer ces
    // écrans (sinon masqués en démo) — couvre les modules js/09 et js/12.
    await p.evaluate(() => { S.settings = S.settings || {}; S.settings.hasBusinessModule = true; S.settings.hasRecrutementModule = true; render(); });
    await p.waitForTimeout(400);
    for (const t of ['business', 'recrutement']) {
      const before = p._appErrors.length;
      const ok = await goTab(t);
      if (!ok) { check('onglet ' + t + ' présent (module activé)', false, 'bouton nav absent'); continue; }
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

    // ── Fiches de poste (besoins de recrutement, pont Business → Recrutement) ──
    const beforeJobs = p._appErrors.length;
    const jobList = await p.evaluate(() => {
      S.modal = null; S.bizModal = null; S.tab = 'recrutement'; S.recTab = 'jobs'; S.jobSel = null; render();
      return document.body.innerText;
    });
    check('Postes à pourvoir : bascule + liste des fiches de démo',
      /Postes à pourvoir/.test(jobList) && /Développeur Fullstack React\/Node/.test(jobList) && p._appErrors.length === beforeJobs,
      p._appErrors.slice(beforeJobs).join(' | '));

    const jobDetail = await p.evaluate(() => { S.jobSel = 'j1'; render(); return document.body.innerText; });
    check('Fiche de poste : détail (version interne + externe) sans erreur',
      /Version interne/.test(jobDetail) && /Annonce externe/.test(jobDetail) && /Candidats suggérés/.test(jobDetail));

    // Anonymisation : le client final apparaît en interne mais JAMAIS dans l'annonce externe.
    const anon = await p.evaluate(() => {
      const j = S.jobs.find(x => x.id === 'j1');
      return { ext: jobExternalText(j), intt: jobInternalText(j) };
    });
    check('Annonce externe anonymisée : client masqué', !/BNP Paribas/.test(anon.ext));
    check('Fiche interne : client présent (confidentiel)', /BNP Paribas/.test(anon.intt));

    // Ouverture du modal « Nouveau poste » — exerce la branche tp==='job' + widget expertises.
    const jobModalOpen = await p.evaluate(() => {
      S.jobSel = null; S.modal = { type: 'job', item: null, expSel: [] }; render();
      return !!document.getElementById('jbn') && !!document.getElementById('exp-wrap');
    });
    check('Modal « Nouveau poste » : formulaire rendu (intitulé + expertises)', jobModalOpen);

    // Pont CRM → Recrutement : le bouton « Créer une fiche de poste » pré-remplit le modal depuis le deal.
    const hasJobBtn = await p.evaluate(() => {
      S.modal = null;
      S.bizAccounts = [{ id: 'accX', name: 'ClientDemoSA' }];
      S.bizOpps = [{ id: 'oppX', name: 'Besoin Data Engineer', account_id: 'accX', req_expertise: ['Python', 'SQL'], location: 'Lyon', req_min_years: 5, req_sector: 'Banque & Finance', tjm_cible: 600, date_start: '2026-09-01', assigned_to: 'Marie', notes: 'Contexte projet data' }];
      S.bizModal = { type: 'opp', item: S.bizOpps[0] }; render();
      return !!document.querySelector('[data-act="jfromopp"]');
    });
    check('CRM : bouton « Créer une fiche de poste » sur une opportunité', hasJobBtn);
    await p.evaluate(() => { const b = document.querySelector('[data-act="jfromopp"]'); if (b) b.click(); });
    await p.waitForTimeout(300);
    const prefilled = await p.evaluate(() => {
      const v = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
      return { isJob: !!(S.modal && S.modal.type === 'job'), title: v('jbn'), client: v('jbcli'), loc: v('jbloc') };
    });
    check('CRM → fiche de poste : modal pré-rempli (intitulé + client + localisation)',
      prefilled.isJob && /Besoin Data Engineer/.test(prefilled.title) && /ClientDemoSA/.test(prefilled.client) && /Lyon/.test(prefilled.loc));

    // Cohérence Business/Recrutement : l'opportunité utilise « Séniorité » (plus
    // « années d'expérience »), et le rafraîchissement des candidats suggérés est
    // PARTIEL (bizOppRefresh) — pas un re-render global qui ferait « clignoter » la page.
    const oppSen = await p.evaluate(() => {
      S.modal = null; S.bizModal = { type: 'opp', item: null }; S.tab = 'business'; render();
      const hasSen = !!document.getElementById('biz-opp-sen');
      const noYears = !document.getElementById('biz-opp-minyears');
      S.bizModal.seniority = 'senior';
      let threw = false;
      try { if (typeof bizOppRefresh === 'function') bizOppRefresh(); } catch (e) { threw = true; }
      const stillOpen = !!(S.bizModal && document.getElementById('biz-opp-name'));
      return { hasSen, noYears, stillOpen, threw };
    });
    check('Opportunité : champ Séniorité présent (remplace années d’expérience)', oppSen.hasSen && oppSen.noYears);
    check('Opportunité : refresh candidats partiel, modal conservé (pas de re-render)', oppSen.stillOpen && !oppSen.threw);

    // Cloisonnement BU des fiches de poste, identique aux candidats : un gestionnaire
    // ne voit que sa BU + ses sous-BU ; super_admin voit tout ; poste sans BU masqué.
    const buScope = await p.evaluate(() => {
      const save = { role: S.role, uid: S._userId, prof: S.orgProfiles, set: S.settings };
      S.settings = Object.assign({}, S.settings, { buTree: [
        { id: 'root',  name: 'Monde',  parentId: null },
        { id: 'fr',    name: 'France', parentId: 'root' },
        { id: 'lyon',  name: 'Lyon',   parentId: 'fr' },
        { id: 'paris', name: 'Paris',  parentId: 'fr' }
      ]});
      S._userId = 'u1';
      S.orgProfiles = [{ id: 'u1', bu_id: 'fr' }];
      const jobs = [
        { id: 'jLyon', buId: 'lyon' }, { id: 'jParis', buId: 'paris' },
        { id: 'jMonde', buId: 'root' }, { id: 'jNone', buId: null }
      ];
      S.role = 'gestionnaire';
      const gest = jobs.filter(jobVisibleForRole).map(j => j.id);
      S.role = 'super_admin';
      const sa = jobs.filter(jobVisibleForRole).map(j => j.id);
      S.role = save.role; S._userId = save.uid; S.orgProfiles = save.prof; S.settings = save.set;
      return { gest, sa };
    });
    check('Postes : gestionnaire ne voit que sa BU + sous-BU (Lyon, Paris)',
      buScope.gest.length === 2 && buScope.gest.indexOf('jLyon') >= 0 && buScope.gest.indexOf('jParis') >= 0
      && buScope.gest.indexOf('jMonde') < 0 && buScope.gest.indexOf('jNone') < 0);
    check('Postes : super_admin voit toutes les fiches (aucun cloisonnement BU)', buScope.sa.length === 4);
    await p.evaluate(() => { S.modal = null; S.bizModal = null; S.recTab = 'cands'; S.jobSel = null; S.tab = 'kpis'; render(); });

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

    // Montée en charge : pagination serveur des cartes KPI (rôle à périmètre org).
    const paged = await p.evaluate(() => {
      var wk = (S.year || CFY) + '|' + (S.quarter || '');
      window.KPI_SERVER_AGG = true;
      S._roleBak = S.role; S.role = 'super_admin';
      S.companyKpis = { avgSr: 50, totR: 1000000, totBill: 2000, avgTJM: 500, avgM: 20, totSalary: 600000, netC: 400000, nCons: 120 };
      S.companyKpisKey = wk;
      S.kpiCards = { total: 120, limit: 24, page: 0, sort: 'name', dir: 'asc', search: '',
        top: [{ name: 'ClientAlphaXYZ', rev: 987654 }, { name: 'ClientBeta', rev: 123456 }],
        key: wk + '|0|name|asc|',
        rows: [
          { id: 'z1', name: 'Zoe TestConsultant', title: 'Consultante', scr: 400, contract: 'salarie', arrive: null, depart: null, k: { tWD: 200, bill: 180, rev: 108000, sr: 90, avgT: 600, om: 25, pm: [{ cli: 'ClientAlphaXYZ', name: 'M', days: 180, tjm: 600, rev: 108000, mar: 25 }], cs: null, ce: null } },
          { id: 'z2', name: 'Yann DemoConsultant', title: 'Dev', scr: 420, contract: 'salarie', arrive: null, depart: null, k: { tWD: 200, bill: 150, rev: 97500, sr: 75, avgT: 650, om: 20, pm: [], cs: null, ce: null } }
        ] };
      S.tab = 'kpis'; render();
      return document.body.innerText;
    });
    check('KPIs paginé : consultant de la page serveur affiché', /Zoe TestConsultant/.test(paged));
    check('KPIs paginé : total serveur affiché (120 consultants)', /120\s*consultants/.test(paged));
    check('KPIs paginé : barre de pagination présente (Page 1 / 5)', /Page\s*1\s*\/\s*5/.test(paged));
    check('KPIs paginé : top clients serveur affiché', /ClientAlphaXYZ/.test(paged));
    // Restaurer l'état par défaut (drapeau off, rôle initial).
    await p.evaluate(() => { window.KPI_SERVER_AGG = false; S.role = S._roleBak; S.kpiCards = null; render(); });

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
