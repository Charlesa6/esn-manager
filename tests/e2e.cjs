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
    // Plans de compte (KAM) : portefeuille, détail, comité de revue
    {
      const before = p._appErrors.length;
      const porto = await p.evaluate(() => {
        S.tab = 'business'; S.bizTab = 'plans'; S.planView = null; S.comiteQueue = null; render();
        const txt = document.body.innerText;
        return { hasBtn: !!document.querySelector('[data-act="comite-start"]'),
                 hasAcc: /BNP Paribas/.test(txt) && /Plans de compte/.test(txt),
                 nPlans: (S.accountPlans || []).length };
      });
      check('Plans de compte : portefeuille + bouton comité', porto.hasBtn && porto.hasAcc);
      check('Plans de compte : plans de démo chargés (' + porto.nPlans + ')', porto.nPlans >= 2);

      const detail = await p.evaluate(() => {
        S.planView = 'a1'; render();
        const txt = document.body.innerText;
        return { enjeux: /Enjeux/.test(txt), power: /grille de pouvoir/i.test(txt),
                 champion: /Champion/.test(txt), erDr: /external revenue/i.test(txt) && /delivery revenue/i.test(txt),
                 objDr: /objectif dr/i.test(txt), er: accER('a1'), dr: accDR('a1') };
      });
      check('Plan de compte : détail (enjeux + power map + relation Champion)', detail.enjeux && detail.power && detail.champion);
      check('Plan de compte : métriques ER + DR + objectif DR affichés', detail.erDr && detail.objDr);
      check('Plan de compte : ER (' + detail.er + ') > DR (' + detail.dr + ') — un deal délivré en externe', detail.er > detail.dr && detail.dr > 0);

      const feats = await p.evaluate(() => {
        S.tab = 'business'; S.bizTab = 'plans'; S.planView = null; S.comiteQueue = null; S.planFilter = { mine: false, statut: '', sante: '' }; render();
        const txt = document.body.innerText;
        const hasEch = /Mes échéances/i.test(txt), hasAlert = /point.*attention/i.test(txt);
        const lateAct = (S.bizActivities || []).find(function (k) { return k.account_id === 'a2' && actIsLate(k); });
        var doneWorked = false;
        if (lateAct) { actMarkDone(lateAct.id); doneWorked = !actIsLate((S.bizActivities || []).find(function (k) { return k.id === lateAct.id; })); }
        return { hasEch: hasEch, hasAlert: hasAlert, doneWorked: doneWorked, land: accLandingER('a1'), er: accER('a1') };
      });
      check('Plans de compte : bloc « Mes échéances » + bandeau d\'alertes', feats.hasEch && feats.hasAlert);
      check('Actions : ✓ marque une action faite (act-done)', feats.doneWorked);
      check('Atterrissage ER = réalisé + pipeline (' + feats.land + ' ≥ ER ' + feats.er + ')', feats.land >= feats.er && feats.land > 0);

      const teamF = await p.evaluate(() => {
        S.planView = 'a1'; render();
        const txt = document.body.innerText;
        return { team: /Équipe du compte/i.test(txt), kam: /Key Account Manager/i.test(txt),
                 cadence: /BR ope\./i.test(txt) && /trimestriel/i.test(txt),
                 n: (typeof accTeam === 'function') ? accTeam('a1').length : 0 };
      });
      check('Équipe du compte : section + membres (' + teamF.n + ') + rôle KAM', teamF.team && teamF.kam && teamF.n >= 2);
      check('Comité récurrent : cadence BR affichée dans le plan', teamF.cadence);

      const eng = await p.evaluate(() => {
        S.planView = 'a1'; render();
        const txt = document.body.innerText;
        const rel = accReliability('a1');
        const hebdo = (typeof CADENCES !== 'undefined') && CADENCES.some(function (c) { return c.id === 'hebdomadaire'; });
        const rk = (S.bizActivities || []).find(function (k) { return k.account_id === 'a1' && actIsPlanned(k); });
        var beforeRep = rk ? (+rk.reported_count || 0) : -1, afterRep = beforeRep;
        if (rk) { actReport(rk.id); afterRep = (+((S.bizActivities || []).find(function (x) { return x.id === rk.id; }).reported_count) || 0); }
        const spark = (typeof reliabSparkline === 'function') ? reliabSparkline('a1') : '';
        const alerts = (typeof accAlertList === 'function') ? accAlertList('a1').join(' | ') : '';
        return { relCard: /Tenue des engagements/i.test(txt), pct: rel.pct, total: rel.total, hebdo: hebdo, reported: afterRep > beforeRep,
                 spark: /<svg/.test(spark), histReliab: /tenue \d+%/i.test(txt), reminder: /échéance sous 3 j|en retard/i.test(alerts) };
      });
      check('Engagements : taux de tenue calculé (' + eng.pct + '% sur ' + eng.total + ') + carte', eng.relCard && eng.pct != null && eng.total >= 2);
      check('Engagements : « Reporter » incrémente le glissement', eng.reported);
      check('Comité : cadence hebdomadaire disponible', eng.hebdo);
      check('Historique de tenue : sparkline + % par revue', eng.spark && eng.histReliab);
      check('Rappels d\'échéance : alerte engagement imminent/en retard', eng.reminder);

      const notif = await p.evaluate(() => {
        S.tab = 'business'; S.bizTab = 'plans'; S.planView = null; S.comiteQueue = null; render();
        const hasBtn = !!document.querySelector('[data-act="notif-open"]');
        S.bizModal = { type: 'notif' }; render();
        const txt = document.body.innerText;
        const modal = /Notifications de rappel/i.test(txt) && /Microsoft Teams/i.test(txt);
        const dg = document.getElementById('notif-digest'); if (dg) dg.value = 'business@ma-esn.fr';
        const tu = document.getElementById('notif-teams-url'); if (tu) tu.value = 'https://outlook.office.com/webhook/xyz';
        notifSave();
        return { hasBtn: hasBtn, modal: modal,
                 saved: !!(S.notifSettings && S.notifSettings.digest_email === 'business@ma-esn.fr' && S.notifSettings.teams_webhook_url) };
      });
      check('Notifications : bouton config visible (admin) + modale email/Teams', notif.hasBtn && notif.modal);
      check('Notifications : enregistrement des réglages (digest + webhook Teams)', notif.saved);

      // Besoin CGI : typologie compte, BR double cadence, influence/lobbying, « pour quel biz »
      const cgi = await p.evaluate(() => {
        S.tab = 'business'; S.bizTab = 'plans'; S.planView = null; S.comiteQueue = null;
        S.planFilter = { mine: false, statut: '', sante: '', type: '' }; render();
        const porto = document.body.innerText;
        const typeChip = /stratégique/i.test(porto) && /à potentiel/i.test(porto);
        const typeFilter = !!document.querySelector('[data-act="planf-type"]');
        // filtre par type stratégique
        S.planFilter.type = 'strategique'; render();
        const filtered = (typeof portfolioAccounts === 'function');
        const strat = (typeof isStrategic === 'function') && isStrategic('a1') && !isStrategic('a2');
        S.planFilter.type = '';
        // détail : plan d'influence + KPIs couverture + biz label
        S.planView = 'a1'; render();
        const txt = document.body.innerText;
        const cov = (typeof execCoverage === 'function') ? execCoverage('a1') : null;
        const bizLabel = (typeof actBizLabel === 'function') ? actBizLabel({ opportunity_id: 'o1' }) : '';
        const bizTarget = (typeof actBizLabel === 'function') ? actBizLabel({ biz_target: 500000 }) : '';
        return {
          typeChip, typeFilter, strat,
          influence: /Plan d'influence/i.test(txt) && /lobbying/i.test(txt),
          coverage: /Couverture exécutive/i.test(txt),
          highDeciders: cov ? cov.high : 0,
          toMeet: cov ? cov.toMeet : 0,
          pourQuelBiz: /pour quel biz/i.test(txt) || /💶/.test(txt),
          bizLabelOk: /./.test(bizLabel) && /cible/i.test(bizTarget),
          brStrat: /BR strat/i.test(txt),
        };
      });
      check('Typologie : chips Stratégique / À potentiel + filtre', cgi.typeChip && cgi.typeFilter && cgi.strat);
      check('Double Business Review : BR stratégique affichée sur compte stratégique', cgi.brStrat);
      check('Plan d\'influence / lobbying : section + KPI couverture exécutive (' + cgi.highDeciders + ' décideurs haut niveau)', cgi.influence && cgi.coverage && cgi.highDeciders >= 2);
      check('Actions « pour quel biz » : lien opportunité / cible de CA', cgi.pourQuelBiz && cgi.bizLabelOk);

      const br = await p.evaluate(() => {
        S.planView = null; comiteStartOne('a1'); render();
        const txt = document.body.innerText;
        const hasSelector = !!document.getElementById('com-brtype');
        const hasPipe = /Pipeline/i.test(txt), hasRel = /Relations clés/i.test(txt);
        const bt = document.getElementById('com-brtype'); if (bt) bt.value = 'strategique';
        const dec = document.getElementById('com-dec'); if (dec) dec.value = 'Décision BR stratégique';
        const n0 = (S.accountReviews || []).length;
        comiteSaveNext();
        const last = (S.accountReviews || [])[(S.accountReviews || []).length - 1];
        return { hasSelector, hasPipe, hasRel, grew: (S.accountReviews || []).length > n0,
                 typed: last && last.review_type === 'strategique', landing: last && last.landing_er != null };
      });
      check('Business Review structurée : sélecteur type + pipeline + relations clés', br.hasSelector && br.hasPipe && br.hasRel);
      check('Business Review : revue typée stratégique + atterrissage snapshoté', br.grew && br.typed && br.landing);
      await p.evaluate(() => { comiteClose(); S.planView = null; render(); });

      const cad = await p.evaluate(() => {
        // BR opérationnelle à temporalité choisie : TotalEnergies en hebdomadaire.
        S.planView = 'a2'; render();
        const weekly = /hebdomadaire/i.test(document.body.innerText);
        // modale plan : sélecteurs de cadence op. ET stratégique (temporalité libre)
        S.bizModal = { type: 'plan', accId: 'a2', item: (S.accountPlans || []).find(function (p) { return p.account_id === 'a2'; }) }; render();
        const opSel = document.getElementById('plan-cadence');
        const stratSel = document.getElementById('plan-cadence-strat');
        const hasWeeklyOpt = !!opSel && Array.prototype.some.call(opSel.options, function (o) { return o.value === 'hebdomadaire'; });
        const bothSelectors = !!opSel && !!stratSel;
        S.bizModal = null; render();
        return { weekly: weekly, hasWeeklyOpt: hasWeeklyOpt, bothSelectors: bothSelectors };
      });
      check('BR opérationnelle : temporalité choisie (hebdomadaire affichée)', cad.weekly && cad.hasWeeklyOpt);
      check('Plan : cadences BR opérationnelle + stratégique choisissables', cad.bothSelectors);
      await p.evaluate(() => { S.planView = null; render(); });

      // CDP : alignement Client Development Plan (4 briques)
      const cdp = await p.evaluate(() => {
        S.planView = 'a1'; render();
        const txt = document.body.innerText;
        return {
          execSummary: /executive summary/i.test(txt) && /ambition fy\+1/i.test(txt) && /partenaire IT de référence/i.test(txt),
          client360: /budget IT/i.test(txt) && /concurrents/i.test(txt),
          rag: /critical/i.test(txt) && /escalade/i.test(txt),         // Brique A
          mustWin: /must-win/i.test(txt) && /RFPs stratégiques/i.test(txt), // Brique C
          cxo: /cxo mapping/i.test(txt) && /preference/i.test(txt),    // Brique B
          hasExport: !!document.querySelector('[data-act="cdp-export"]'),
        };
      });
      check('CDP — Executive Summary (ambition FY+1/FY+3) + Client 360', cdp.execSummary && cdp.client360);
      check('CDP — Execution Plan & Accountability (statut Critical + escalade)', cdp.rag);
      check('CDP — Pipeline & Strategic RFPs (must-win)', cdp.mustWin);
      check('CDP — Powermap & CxO plan (Power/Preference)', cdp.cxo);
      check('CDP — bouton d\'export du plan complet', cdp.hasExport);

      const cdpExp = await p.evaluate(() => {
        // Génère le HTML du CDP sans ouvrir de fenêtre (stub window.open).
        var captured = '';
        var _open = window.open;
        window.open = function () { return { document: { open: function () {}, write: function (h) { captured = h; }, close: function () {} } }; };
        try { cdpExport('a1'); } catch (e) { captured = 'ERR:' + e.message; }
        window.open = _open;
        return {
          ok: /Client Development Plan/i.test(captured) && /Executive Summary/i.test(captured)
            && /Powermap/i.test(captured) && /Strategic RFPs/i.test(captured) && /Execution Plan/i.test(captured),
          len: captured.length,
        };
      });
      check('CDP — export document complet (5 sections, ' + cdpExp.len + ' o)', cdpExp.ok);

      const cdp2 = await p.evaluate(() => {
        S.planView = 'a1'; render();
        const txt = document.body.innerText;
        // Resources & Governance : % de temps sur l'équipe
        const pctTime = /25%|40%|100%/.test(txt.replace(/\s/g, ''));
        // Key takeaways & call to action
        const takeaways = /key messages/i.test(txt) && /call to action/i.test(txt);
        // export : sections Resources & Governance + Key Takeaways présentes
        var captured = '';
        var _open = window.open;
        window.open = function () { return { document: { open: function () {}, write: function (h) { captured = h; }, close: function () {} } }; };
        cdpExport('a1');
        window.open = _open;
        const exportOk = /Resources &amp; Governance/i.test(captured) && /Key Takeaways/i.test(captured) && /Priority actions/i.test(captured);
        return { pctTime: pctTime, takeaways: takeaways, exportOk: exportOk };
      });
      check('CDP — Resources & Governance (% de temps alloué)', cdp2.pctTime);
      check('CDP — Key takeaways & call to action (plan)', cdp2.takeaways);
      check('CDP — export : Resources & Governance + Key Takeaways + Priority actions', cdp2.exportOk);
      await p.evaluate(() => { S.planView = null; render(); });

      // Modèle de rôles par compte (Account Operating Model)
      const roles = await p.evaluate(() => {
        const stratModel = recommendedModel('a1');
        const potModel = recommendedModel('a2');
        S.planView = 'a1'; render();
        const txt1 = document.body.innerText;
        S.planView = 'a2'; render();
        const txt2 = document.body.innerText;
        // création d'une fiche de poste depuis un rôle → ouvre le module recrutement avec prefill
        roleJobPost('a1', 'kam');
        const jobPrefill = S.modal && S.modal.type === 'job' && S.modal.prefill && /Key Account Manager/i.test(S.modal.prefill.title) && /Responsabilités/i.test(S.modal.prefill.missionDesc || '');
        S.modal = null; S.tab = 'business';
        return {
          stratTier: stratModel.tier.id,                       // 'strategique'
          stratRoles: stratModel.roles.map(r => r.role),
          potHasAM: potModel.roles.some(r => r.role === 'account_manager'),
          section: /Modèle de rôles/i.test(txt1) && /modèle cible/i.test(txt1),
          gapAffiche: /à pourvoir/i.test(txt1),
          recoWarn: /aucun rôle d'animation dédié/i.test(txt2),   // TotalEnergies animé par un directeur
          jobPrefill: jobPrefill,
        };
      });
      check('Modèle de rôles : compte stratégique → modèle KAM dédié + IA + Directeur + Sponsor',
        roles.stratTier === 'strategique' && roles.stratRoles.indexOf('kam') >= 0 && roles.stratRoles.indexOf('sponsor') >= 0);
      check('Modèle de rôles : compte à potentiel → Account Manager', roles.potHasAM);
      check('Modèle de rôles : section + écart (rôle à pourvoir)', roles.section && roles.gapAffiche);
      check('Modèle de rôles : alerte « animé sans rôle dédié » (reconnaissance)', roles.recoWarn);
      check('Modèle de rôles : « Fiche de poste » préremplit une vraie offre (Recrutement)', roles.jobPrefill);
      await p.evaluate(() => { S.tab = 'business'; S.bizTab = 'plans'; S.planView = null; render(); });

      // PWA : balises d'installation + deep-link onglet
      const pwa = await p.evaluate(() => ({
        manifest: !!document.querySelector('link[rel="manifest"]'),
        theme: !!document.querySelector('meta[name="theme-color"]'),
        appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
        installBtn: !!document.getElementById('pwa-install'),
        deepLink: typeof applyDeepLinkTab === 'function',
      }));
      check('PWA : balises manifest + theme-color + apple-touch-icon', pwa.manifest && pwa.theme && pwa.appleIcon);
      check('PWA : bouton d\'installation + deep-link onglet (?tab=)', pwa.installBtn && pwa.deepLink);

      // « Plans de compte » = onglet principal, en tête + écran d'accueil
      const plansTab = await p.evaluate(() => {
        const navs = Array.prototype.map.call(document.querySelectorAll('.snv [data-nav]'), function (b) { return b.getAttribute('data-nav'); });
        S.tab = 'plans'; S.planView = null; S.comiteQueue = null; render();
        const txt = document.body.innerText;
        return {
          firstNav: navs[0] === 'plans',
          hasNav: navs.indexOf('plans') >= 0,
          renders: /Plans de compte/i.test(txt) && /portefeuille/i.test(txt),
        };
      });
      check('Plans de compte : onglet principal en tête de la navigation', plansTab.firstNav && plansTab.hasNav);
      check('Plans de compte : l\'onglet rend le portefeuille de comptes', plansTab.renders);
      await p.evaluate(() => { S.tab = 'plans'; S.planView = null; render(); });
      await p.evaluate(() => { S.tab = 'business'; S.bizTab = 'plans'; S.planView = null; render(); });

      const com = await p.evaluate(() => {
        S.planView = null; comiteStart();
        const n0 = (S.accountReviews || []).length;
        const dec = document.getElementById('com-dec'); if (dec) dec.value = 'Décision de test';
        comiteSaveNext();
        return { started: (S.comiteQueue || []).length > 0, grew: (S.accountReviews || []).length > n0,
                 ui: /Comité de revue/.test(document.body.innerText) };
      });
      check('Comité de revue : séance + revue historisée', com.ui && com.started && com.grew);
      await p.evaluate(() => { comiteClose(); S.bizTab = 'pipeline'; S.planView = null; render(); });
      check('Plans de compte : aucun crash sur le parcours KAM', p._appErrors.length === before);
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

    // Assignation candidat ↔ fiche + lien opportunité + mission auto au passage « pourvu ».
    const flow = await p.evaluate(async () => {
      const oc = window.confirm, oa = window.alert;
      window.confirm = () => true; window.alert = () => {};
      const save = { role: S.role, jobs: S.jobs, cands: S.cands, opps: S.bizOpps, miss: S.miss, cons: S.cons };
      S.settings = Object.assign({}, S.settings, { hasRecrutementModule: true });
      S.role = 'super_admin';
      S.cands = [{ id: 'cQA', name: 'Cand QA', reqSalary: 45000, expertise: ['Java'], status: 'pipe', buId: null, consId: null, email: 'qa@x.fr' }];
      S.bizOpps = (S.bizOpps || []).concat([{ id: 'oppQA', name: 'Deal QA', account_id: null, tjm_cible: 600, date_start: '2026-09-01', date_end: '2027-03-01', status: 'identification', btype: 'at' }]);
      S.jobs = [{ id: 'jQA', title: 'Poste QA', status: 'ouvert', candidateIds: [], oppId: 'oppQA', clientName: 'ClientQA', tjmTarget: 650, startDate: '2026-09-01', buId: null, reqExpertise: ['Java'], nbPositions: 1 }];
      S.tab = 'recrutement'; S.recTab = 'jobs'; S.jobSel = 'jQA'; S.recSel = null;

      jobToggleCand('jQA', 'cQA', true);
      const assignedJobSide = (S.jobs.find(j => j.id === 'jQA').candidateIds || []).indexOf('cQA') >= 0;
      const candSideSees = jobsForCand('cQA').some(j => j.id === 'jQA');

      openOppById('oppQA');
      const oppOpened = S.tab === 'business' && !!(S.bizModal && S.bizModal.type === 'opp' && S.bizModal.item && S.bizModal.item.id === 'oppQA');
      S.bizModal = null; S.tab = 'recrutement'; S.recTab = 'jobs'; S.jobSel = 'jQA';

      const jobPourvu = Object.assign({}, S.jobs.find(j => j.id === 'jQA'), { status: 'pourvu' });
      S.jobs = S.jobs.map(j => j.id === 'jQA' ? jobPourvu : j);
      await jobFillToMissions(jobPourvu);
      const cand = S.cands.find(c => c.id === 'cQA');
      const newMiss = (S.miss || []).find(m => m.name && m.name.indexOf('Poste QA') >= 0);
      const consCreated = !!cand.consId && (S.cons || []).some(cn => cn.id === cand.consId);
      const missionOk = !!newMiss && newMiss.cid === cand.consId && newMiss.cli === 'ClientQA' && newMiss.tjm === 650;
      const recruited = cand.recruited === true && cand.status === 'recrute';
      const opp = S.bizOpps.find(o => o.id === 'oppQA');
      const oppWon = opp.status === 'gagne' && !!opp.linked_mission_id;

      S.role = save.role; S.jobs = save.jobs; S.cands = save.cands; S.bizOpps = save.opps; S.miss = save.miss; S.cons = save.cons;
      S.jobSel = null; S.recSel = null; S.bizModal = null; S.tab = 'kpis';
      window.confirm = oc; window.alert = oa;
      return { assignedJobSide, candSideSees, oppOpened, missionOk, consCreated, recruited, oppWon };
    });
    check('Assignation depuis la fiche : candidat ajouté', flow.assignedJobSide);
    check('Assignation visible côté candidat (jobsForCand)', flow.candSideSees);
    check('Lien fiche → opportunité : ouvre le modal opp CRM', flow.oppOpened);
    check('Poste pourvu : mission auto (bon consultant, client, TJM)', flow.missionOk);
    check('Poste pourvu : candidat recruté + consultant créé à la volée', flow.consCreated && flow.recruited);
    check('Poste pourvu : opportunité liée passée « gagné »', flow.oppWon);

    // Poste pourvu en FORFAIT : le type est dérivé de l'OPPORTUNITÉ liée (deal forfait),
    // pas de la fiche. Une mission forfait par candidat, deal réparti au prorata SCR.
    const forfait = await p.evaluate(async () => {
      const oc = window.confirm, oa = window.alert; window.confirm = () => true; window.alert = () => {};
      const save = { role: S.role, jobs: S.jobs, cands: S.cands, miss: S.miss, cons: S.cons, opps: S.bizOpps };
      S.role = 'super_admin';
      S.cands = [{ id: 'cF1', name: 'F One', reqSalary: 48000, consId: null }, { id: 'cF2', name: 'F Two', reqSalary: 48000, consId: null }];
      S.bizOpps = (S.bizOpps || []).concat([{ id: 'oppF', name: 'Deal Forfait', account_id: null, btype: 'forfait', deal_amount: 200000, opp_team: [{ cid: 'x', tmar: 30 }], status: 'gagne' }]);
      const job = { id: 'jF', title: 'Poste Forfait', status: 'ouvert', candidateIds: ['cF1', 'cF2'], oppId: 'oppF', clientName: 'ClientF', startDate: '2026-10-01', buId: null, reqExpertise: [], nbPositions: 2 };
      S.jobs = [job]; S.tab = 'recrutement'; S.recTab = 'jobs'; S.jobSel = 'jF';
      const jobPourvu = Object.assign({}, job, { status: 'pourvu' });
      S.jobs = [jobPourvu];
      await jobFillToMissions(jobPourvu);
      const ms = (S.miss || []).filter(m => m.name && m.name.indexOf('Poste Forfait') >= 0);
      const twoForfait = ms.length === 2 && ms.every(m => m.btype === 'forfait' && m.deal > 0 && m.tmar === 30 && m.tjm > 0);
      const splitOk = Math.abs(ms.reduce((s, m) => s + (m.deal || 0), 0) - 200000) <= 2;
      S.role = save.role; S.jobs = save.jobs; S.cands = save.cands; S.miss = save.miss; S.cons = save.cons; S.bizOpps = save.opps;
      S.jobSel = null; S.tab = 'kpis';
      window.confirm = oc; window.alert = oa;
      return { twoForfait, splitOk };
    });
    check('Poste pourvu forfait : type dérivé du deal lié, une mission forfait par candidat', forfait.twoForfait);
    check('Poste pourvu forfait : montant du deal réparti au prorata (≈ total)', forfait.splitOk);
    await p.evaluate(() => { S.modal = null; S.bizModal = null; S.recTab = 'cands'; S.jobSel = null; S.tab = 'kpis'; render(); });

    // Montée en charge : la hero-bande KPIs lit l'agrégat serveur derrière le
    // drapeau KPI_SERVER_AGG. On injecte un agrégat distinctif (staffing 87,6 %)
    // pour la fenêtre courante et on vérifie que la hero l'affiche, puis on remet
    // le drapeau à off (état par défaut).
    const beforeFlag = await p.evaluate(() => {
      S.calMode = 'cal'; // l'agrégat serveur (montée en charge) est calendaire → mode calendaire pour ce bloc
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

    // Calendrier fiscal 4-4-5 (CGI) : bornes d'exercice, 12 périodes et trimestres.
    const fis = await p.evaluate(() => {
      S.calMode = '445';
      const ends = fMonths445(2026).map(m => m.me);
      const labels = fMonths445(2026).map(m => m.lb);
      return {
        start: fyStart(2026), end: fyEnd(2026),
        ends, labels,
        q1: qRange(2026, 1)[1], q2: qRange(2026, 2)[1], q3: qRange(2026, 3)[1], q4: qRange(2026, 4)[1],
        n27: fyStart(2027)
      };
    });
    const EXP = ['2025-10-18','2025-11-15','2025-12-13','2026-01-17','2026-02-14','2026-03-21','2026-04-18','2026-05-16','2026-06-20','2026-07-18','2026-08-22','2026-09-19'];
    check('4-4-5 : exercice E2026 = 21 sept. 2025 → 19 sept. 2026', fis.start === '2025-09-21' && fis.end === '2026-09-19');
    check('4-4-5 : les 12 fins de période collent aux cases rouges', JSON.stringify(fis.ends) === JSON.stringify(EXP));
    check('4-4-5 : trimestres = 3 périodes (Q1 13/12, Q2 21/03, Q3 20/06, Q4 19/09)',
      fis.q1 === '2025-12-13' && fis.q2 === '2026-03-21' && fis.q3 === '2026-06-20' && fis.q4 === '2026-09-19');
    check('4-4-5 : périodes libellées par mois de fin (Oct, Nov… Sept)',
      fis.labels[0].startsWith('Oct') && fis.labels[3].startsWith('Janv') && fis.labels[11].startsWith('Sept'));
    check('4-4-5 : exercice suivant décalé de 52 semaines (E2027 = 20 sept. 2026)', fis.n27 === '2026-09-20');

    // Bascule 4-4-5 ⇄ calendaire : les bornes et périodes s'adaptent au mode.
    const modes = await p.evaluate(() => {
      S.calMode = 'cal';
      const cal = { start: fyStart(2026), end: fyEnd(2026), q1: qRange(2026, 1)[1], m: fMonths(2026).map(x => x.me) };
      S.calMode = '445';
      const f445 = { start: fyStart(2026), end: fyEnd(2026), q1: qRange(2026, 1)[1], m0end: fMonths(2026)[0].me };
      return { cal, f445 };
    });
    check('Calendaire : exercice = 1 oct. 2025 → 30 sept. 2026, T1 fin 31/12',
      modes.cal.start === '2025-10-01' && modes.cal.end === '2026-09-30' && modes.cal.q1 === '2025-12-31' && modes.cal.m[0] === '2025-10-31');
    check('Bascule : retour en 4-4-5 rebascule les bornes (fin exercice 19/09, P1 18/10)',
      modes.f445.start === '2025-09-21' && modes.f445.end === '2026-09-19' && modes.f445.q1 === '2025-12-13' && modes.f445.m0end === '2025-10-18');

    // Export reporting KPIs (contrôle de gestion) : génération + réconciliation + périmètre restauré.
    const rep = await p.evaluate(() => {
      const consRef = S.cons, missRef = S.miss;
      const d = _kpiReportData();
      const restored = S.cons === consRef && S.miss === missRef;
      S._ks = null; S._ksSig = null;
      const expR = buildKS().reduce((s, x) => s + x.k.rev, 0);
      const html = buildKpiReportHTML(Object.assign({}, d, { csv: buildKpiReportCSV(d) }));
      const csv = buildKpiReportCSV(d);
      return {
        totR: d.agg.totR, nCons: d.agg.nCons, nMiss: d.missRows.length,
        reconcile: Math.abs(expR - d.agg.totR) < 1,
        htmlOk: /Taux de staffing/.test(html) && /Détail des missions/.test(html) && /dlCSV/.test(html),
        csvOk: /SYNTHÈSE/.test(csv) && /DÉTAIL DES MISSIONS/.test(csv),
        restored
      };
    });
    check('Export reporting : données produites (CA, missions, effectif)', rep.totR > 0 && rep.nMiss > 0 && rep.nCons > 0);
    check('Export reporting : CA de l’export = moteur KPI (réconciliation)', rep.reconcile);
    check('Export reporting : HTML (synthèse + détail + CSV) et CSV bien formés', rep.htmlOk && rep.csvOk);
    check('Export reporting : périmètre de calcul restauré après génération', rep.restored);

    // Export .xlsx (OOXML) : classeur zip valide ; en-tête (nom + logo) configurable.
    const xl = await p.evaluate(() => {
      const d = _kpiReportData();
      const bytes = buildKpiReportXLSX(d);
      const okSig = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04; // "PK\x03\x04"
      const b64 = _b64(bytes);
      return { len: bytes.length, okSig, b64ok: b64.length > 100 };
    });
    check('Export Excel : classeur .xlsx généré (signature zip OOXML valide)', xl.okSig && xl.len > 800 && xl.b64ok);
    const hdr = await p.evaluate(() => {
      S.settings = S.settings || {};
      const bN = S.settings.reportOrgName, bL = S.settings.reportLogo;
      S.settings.reportOrgName = 'CGI Test'; S.settings.reportLogo = 'data:image/png;base64,iVBORw0KGgo=';
      const d = _kpiReportData(); d.csv = buildKpiReportCSV(d); d.xlsxB64 = '';
      const html = buildKpiReportHTML(d);
      S.settings.reportOrgName = bN; S.settings.reportLogo = bL;
      return { org: d.orgName, hasName: /CGI Test/.test(html), hasLogo: /data:image\/png;base64,iVBORw0KGgo=/.test(html) };
    });
    check('En-tête reporting : nom d’organisation + logo repris dans le rapport', hdr.org === 'CGI Test' && hdr.hasName && hdr.hasLogo);

    // Charte de marque configurable (ex. rouge CGI) : couleur reprise dans le HTML et le .xlsx.
    const brand = await p.evaluate(() => {
      S.settings = S.settings || {};
      const bC = S.settings.reportBrandColor;
      // défaut (marine Konsilys) quand rien n'est réglé
      S.settings.reportBrandColor = '';
      const dDef = _kpiReportData();
      const defOk = dDef.brand === '14202B' && /--brand:#14202B/.test(buildKpiReportHTML(dDef));
      // charte CGI (rouge) : pilote HTML (en-tête/boutons/tableaux) et remplissage xlsx
      S.settings.reportBrandColor = 'E4002B';
      const dCgi = _kpiReportData();
      const htmlCgi = buildKpiReportHTML(dCgi);
      const xlsxStyles = _xStyles(dCgi.brand);
      S.settings.reportBrandColor = bC;
      return {
        defOk,
        brandCgi: dCgi.brand === 'E4002B',
        htmlBrand: /--brand:#E4002B/.test(htmlCgi),
        xlsxFill: /FFE4002B/.test(xlsxStyles),
        stylesInBook: /FFE4002B/.test(new TextDecoder().decode(buildKpiReportXLSX(dCgi)).replace(/[^\x20-\x7e]/g, ''))
      };
    });
    check('Charte reporting : couleur par défaut (marine Konsilys) appliquée', brand.defOk);
    check('Charte reporting : couleur CGI reprise dans le HTML (en-tête/boutons/tableaux)', brand.brandCgi && brand.htmlBrand);
    check('Charte reporting : couleur CGI reprise dans le remplissage d’en-tête .xlsx', brand.xlsxFill);

    // Mission — TJM libre vs marge sur SCR : coût journalier (charges patronales) + TJM déduit.
    const mtjm = await p.evaluate(() => {
      var sal = { scr: 400, contract: 'cdi' };       // salarié : coût = SCR × 1,25 = 500
      var frl = { scr: 400, contract: 'freelance' };  // freelance : coût = SCR = 400
      var vide = { scr: 0, contract: 'cdi' };
      return {
        factor: EMPLOYER_FACTOR,
        costSal: consDailyCost(sal), costFrl: consDailyCost(frl), costVide: consDailyCost(vide),
        // marge 25 % sur salarié : 500 / (1 − 0,25) = 666,67 → 667
        tjmSal25: tjmFromScr(sal, 25),
        // marge 20 % sur freelance : 400 / 0,8 = 500
        tjmFrl20: tjmFromScr(frl, 20),
        // marge 0 % : TJM = coût
        tjmSal0: tjmFromScr(sal, 0),
        // SCR absent : pas de calcul possible
        tjmVide: tjmFromScr(vide, 25),
        // borne : marge ≥ 99 clampée (pas de division par ~0)
        tjmClamp: tjmFromScr(sal, 150)
      };
    });
    check('Mission TJM : coût journalier = SCR × charges (salarié) / SCR seul (freelance)',
      mtjm.factor === 1.25 && mtjm.costSal === 500 && mtjm.costFrl === 400 && mtjm.costVide === 0);
    check('Mission TJM : marge sur SCR déduit le TJM (500→667 à 25 %, 400→500 à 20 %)',
      mtjm.tjmSal25 === 667 && mtjm.tjmFrl20 === 500 && mtjm.tjmSal0 === 500);
    check('Mission TJM : SCR absent = pas de calcul (0) ; marge extrême bornée',
      mtjm.tjmVide === 0 && Number.isFinite(mtjm.tjmClamp) && mtjm.tjmClamp > 0);

    // Import générique — Candidats : modèle .xlsx, auto-mapping, dédoublonnage, commit.
    const impC = await p.evaluate(() => {
      // Modèle .xlsx (zip OOXML valide, en-tête + exemple)
      var tpl = _impXlsxTemplate('Candidats', IMPORT_SPECS.candidate.fields.map(f => f.lb), IMPORT_SPECS.candidate.example);
      var tplOk = tpl[0] === 0x50 && tpl[1] === 0x4B && tpl.length > 500;
      // Auto-mapping sur en-têtes libres
      var headers = ['Nom', 'E-mail', 'Compétences', 'Statut', 'Ville'];
      var am = _impAutoMap(headers, IMPORT_SPECS.candidate.fields);
      var mapOk = am.name === 0 && am.email === 1 && am.expertise === 2 && am.status === 3 && am.location === 4;
      // Simule un fichier chargé : 3 lignes dont 1 doublon (même email qu'un candidat existant) et 1 sans nom
      var before = S.cands.length;
      var dupEmail = (S.cands[0] && S.cands[0].email) || 'dup@exists.test';
      if (!S.cands[0] || !S.cands[0].email) { S.cands = S.cands.concat([{ id: 'x', name: 'Exist', email: dupEmail }]); }
      S.imp2 = { kind: 'candidate', file: 't.xlsx', headers: headers,
        raw: [['Alice Nouvelle', 'alice@new.test', 'Java;Python', 'A rencontrer RH', 'Lyon'],
              ['Bob Doublon', dupEmail, 'Go', 'Pipe', 'Paris'],
              ['', 'noname@x.test', '', '', '']],
        map: am, rows: [], step: 'map', results: null };
      applyImport2Map();
      var rows = S.imp2.rows;
      var nNew = rows.filter(o => !o._invalid && !o._dup).length;
      var nDup = rows.filter(o => o._dup).length;
      var nInv = rows.filter(o => o._invalid).length;
      var alice = rows.find(o => o.name === 'Alice Nouvelle');
      var parseOk = alice && alice.status === 'rh_a' && alice.expertise.length === 2 && alice.locTarget === 'Lyon';
      return { tplOk, mapOk, nNew, nDup, nInv, parseOk, before };
    });
    check('Import candidats : modèle .xlsx généré (signature zip OOXML)', impC.tplOk);
    check('Import candidats : colonnes libres auto-mappées (Nom/E-mail/Compétences/Statut/Ville)', impC.mapOk);
    check('Import candidats : aperçu = 1 nouveau, 1 doublon, 1 invalide', impC.nNew === 1 && impC.nDup === 1 && impC.nInv === 1);
    check('Import candidats : parsing (statut résolu, expertises listées, localisation)', impC.parseOk);

    // Import Candidats — commit (offline : mutation de S.cands, sbUpsertCand no-op sans sb).
    const impCc = await p.evaluate(() => {
      var before = S.cands.length;
      return Promise.resolve(commitImport2()).then(() => new Promise(r => setTimeout(r, 30))).then(() => {
        return { added: S.cands.length - before, step: S.imp2 && S.imp2.step, ok: S.imp2 && S.imp2.results && S.imp2.results.ok };
      });
    });
    check('Import candidats : commit ajoute le candidat valide à S.cands', impCc.added === 1 && impCc.ok === 1);

    // Import générique — Opportunités : mapping, résolution/création de compte client, commit.
    const impO = await p.evaluate(() => {
      var headers = ['Affaire', 'Client', 'Statut', 'TJM', 'Probabilité'];
      var am = _impAutoMap(headers, IMPORT_SPECS.opportunity.fields);
      var mapOk = am.name === 0 && am.client === 1 && am.status === 2 && am.tjm_cible === 3 && am.probability === 4;
      var accBefore = S.bizAccounts.length, oppBefore = S.bizOpps.length;
      var newClient = 'ClientImportTest ' + accBefore; // sûrement absent
      S.imp2 = { kind: 'opportunity', file: 'o.xlsx', headers: headers,
        raw: [['Grande affaire', newClient, 'Qualification', '650', '40']],
        map: am, rows: [], step: 'map', results: null };
      applyImport2Map();
      var o0 = S.imp2.rows[0];
      var parseOk = o0 && o0.status === 'qualification' && o0.tjm_cible === 650 && o0.probability === 40 && o0._client === newClient;
      return Promise.resolve(commitImport2()).then(() => new Promise(r => setTimeout(r, 40))).then(() => {
        var acc = S.bizAccounts.find(a => a.name === newClient);
        var opp = S.bizOpps.find(o => o.name === 'Grande affaire');
        return { mapOk, parseOk,
          accCreated: !!acc,
          oppLinked: !!(opp && acc && opp.account_id === acc.id),
          accAdded: S.bizAccounts.length - accBefore, oppAdded: S.bizOpps.length - oppBefore };
      });
    });
    check('Import opportunités : colonnes libres auto-mappées (Affaire/Client/Statut/TJM/Proba)', impO.mapOk);
    check('Import opportunités : parsing (statut, TJM, probabilité, client)', impO.parseOk);
    check('Import opportunités : compte client absent créé automatiquement', impO.accCreated && impO.accAdded === 1);
    check('Import opportunités : opportunité rattachée au compte créé', impO.oppLinked && impO.oppAdded === 1);

    // Diffusion offre publique : publication d'une fiche de poste (jeton + URL), dépublication.
    const pub = await p.evaluate(() => {
      S.jobs = S.jobs || [];
      var j = { id: 'jpub1', title: 'Dev Fullstack', status: 'ouvert', candidateIds: [], reqExpertise: ['React'], isPublic: false, publicToken: null };
      S.jobs = S.jobs.concat([j]);
      jobPublish('jpub1');
      var jp = S.jobs.find(x => x.id === 'jpub1');
      var tokenOk = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jp.publicToken || '');
      var url = jobPublicUrl(jp);
      var urlOk = url.indexOf('/postuler?j=' + jp.publicToken) >= 0;
      var cardPub = jobPublishCard(jp, []).indexOf('Offre publiée') >= 0 && jobPublishCard(jp, []).indexOf(jp.publicToken) >= 0;
      jp.isPublic = false;
      var cardUnpub = jobPublishCard(jp, []).indexOf('Publier l’offre') >= 0 || jobPublishCard(jp, []).indexOf("Publier l'offre") >= 0;
      // badge candidature publique
      var badge = jobPublishCard(Object.assign({}, jp, { isPublic: true }), [{ id: 'x', name: 'Ada', source: 'offre_publique' }]).indexOf('1 candidature') >= 0;
      return { tokenOk, urlOk, cardPub, cardUnpub, badge };
    });
    check('Offre publique : publication génère un jeton UUID + URL /postuler', pub.tokenOk && pub.urlOk);
    check('Offre publique : carte affiche le lien public quand publiée', pub.cardPub);
    check('Offre publique : bouton « Publier » affiché quand non publiée', pub.cardUnpub);
    check('Offre publique : compteur de candidatures reçues (badge)', pub.badge);

    // Montée en charge : pagination serveur des cartes KPI (rôle à périmètre org).
    const paged = await p.evaluate(() => {
      S.calMode = 'cal'; // montée en charge serveur = calendaire
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
    await p.evaluate(() => { window.KPI_SERVER_AGG = false; S.role = S._roleBak; S.kpiCards = null; S.calMode = '445'; render(); });

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
