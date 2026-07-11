/* ═══════════════════════════════════════════════════════════════════════════
   Tests UNITAIRES de la logique métier pure (js/01-core.js), sans DOM ni réseau.
   On charge le module dans un contexte `vm` (la garde `typeof supabase` évite tout
   accès réseau) puis on exerce les fonctions de calcul directement.
   Ces tests couvrent des cas qui ont réellement régressé lors du développement :
   bornage du staffing à la présence, filtre de période des KPIs, masquage des
   supérieurs hiérarchiques, tri par grade.
   Sortie : PASS/FAIL + code de sortie non-nul si un test échoue.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const core = fs.readFileSync(path.join(__dirname, '..', 'js', '01-core.js'), 'utf8');

// Contexte minimal : intrinsèques fournis par le vm ; on NE définit PAS `supabase`
// (→ sb=null via la garde de 01-core), et des stubs no-op pour window/document.
const ctx = {
  console,
  window: {},
  document: { createElement: () => ({}), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
vm.createContext(ctx);
vm.runInContext(core, ctx, { filename: '01-core.js' });

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (detail ? '  → ' + detail : '')); }
}
function eq(name, a, b) { ok(name + '  (' + a + ' === ' + b + ')', a === b); }

// ── 1. gradeRank : Manager < Sénior < Confirmé < Junior (Business Manager en tête) ──
console.log('\n▶ gradeRank');
const gr = ctx.gradeRank;
ok('Business Manager en tête', gr('Business Manager') < gr('Manager'));
ok('Manager < Sénior', gr('Manager') < gr('Consultant Sénior'));
ok('Sénior < Confirmé', gr('Consultant Sénior') < gr('Consultant Confirmé'));
ok('Confirmé < Junior', gr('Consultant Confirmé') < gr('Consultant Junior'));
ok('grade inconnu classé en dernier', gr('') > gr('Consultant Junior'));

// ── 2. kpi : bornage des jours travaillables à la présence réelle ──
console.log('\n▶ kpi (bornage présence + prorata)');
const H = ctx.fyHols(2026), fyS = ctx.fyStart(2026), fyE = ctx.fyEnd(2026);
const anneeWD = ctx.wDays(fyS, fyE, H);
// Consultant présent partiellement (arrivée + départ en cours d'exercice).
const cPart = { id: 'x', scr: 494, contract: 'salarie', arrive: '2026-04-20', depart: '2026-06-12' };
const mPart = [{ cid: 'x', sd: '2026-04-30', ed: '2026-06-11', tjm: 750, btype: 'at', wdays: [1,2,3,4,5], wmode: 'rec', manualDays: null }];
const kPart = ctx.kpi(cPart, mPart, [], 2026, H, null);
ok('tWD borné à la présence (< année entière)', kPart.tWD > 0 && kPart.tWD < anneeWD, 'tWD=' + kPart.tWD + ' / année=' + anneeWD);
ok('staffing individuel proraté > 0', kPart.sr > 0, 'sr=' + kPart.sr);
// Consultant hors période : arrive après la fin de l'exercice → n'impacte rien.
const cOut = { id: 'y', scr: 400, contract: 'salarie', arrive: '2026-10-02', depart: null };
const kOut = ctx.kpi(cOut, [], [], 2026, H, null);
eq('consultant hors période : tWD = 0', kOut.tWD, 0);
eq('consultant hors période : sr = 0', kOut.sr, 0);

// ── 3. consIsAboveMe : masque UNIQUEMENT les supérieurs hiérarchiques ──
console.log('\n▶ consIsAboveMe');
ctx.S.orgProfiles = [
  { id: 'OWNER', role: 'super_admin', manager_id: null,    cons_id: 'cOwner' },
  { id: 'ADMIN', role: 'admin',       manager_id: 'OWNER',  cons_id: 'cAdmin' },
  { id: 'USER',  role: 'utilisateur', manager_id: 'ADMIN',  cons_id: 'cUser' },
];
ctx.S._userId = 'ADMIN'; ctx.S.role = 'admin';
ok('le patron (super_admin) est au-dessus de moi', ctx.consIsAboveMe({ id: 'cOwner' }) === true);
ok("un subordonné n'est pas au-dessus",            ctx.consIsAboveMe({ id: 'cUser' }) === false);
ok('moi-même : pas au-dessus',                      ctx.consIsAboveMe({ id: 'cAdmin' }) === false);
ok('fiche sans compte lié : jamais au-dessus',      ctx.consIsAboveMe({ id: 'zzz', name: 'X Y' }) === false);
// Cas mode démo : ni userId ni annuaire → personne n'est « au-dessus ».
ctx.S.orgProfiles = []; ctx.S._userId = undefined;
ok('mode démo : aucune fiche masquée', ctx.consIsAboveMe({ id: 'cOwner' }) === false);

// ── 4. buildKS : ne retient que les consultants présents sur la période ──
console.log('\n▶ buildKS (filtre de présence)');
ctx.S.year = 2026; ctx.S.quarter = null; ctx.S._ks = null; ctx.H = ctx.fyHols(2026);
ctx.S.cons = [
  { id: 'in',     scr: 400, contract: 'salarie', arrive: '2025-11-01', depart: null }, // présent en FY26
  { id: 'future', scr: 400, contract: 'salarie', arrive: '2026-10-02', depart: null }, // arrive en FY27
];
ctx.S.miss = []; ctx.S.lvs = [];
const ks = ctx.buildKS();
eq('buildKS exclut le futur arrivant (FY27)', ks.length, 1);
ok('buildKS conserve le consultant présent', !!ks[0] && ks[0].c.id === 'in');

// ── 5. consInScope / consInTeamScope : périmètre canonique par rôle ──
console.log('\n▶ consInScope / consInTeamScope');
function resetS() { ctx.S.fdir = []; ctx.S.fvp = []; ctx.S.vpDirMap = {}; ctx.S.consId = null; ctx.S._userEmail = ''; ctx.S.dirName = ''; ctx.S._userId = undefined; ctx.S.orgProfiles = []; }
// gestionnaire → son équipe uniquement
resetS(); ctx.S.role = 'gestionnaire'; ctx.S._userId = 'G'; ctx.S.dirName = 'Chef'; ctx.S.consId = 'cG';
ok('gestionnaire : voit une fiche de son équipe (managerId)', ctx.consInScope({ id: 'a', managerId: 'G' }) === true);
ok('gestionnaire : voit une fiche rattachée par nom de directeur', ctx.consInScope({ id: 'b', dir: 'Chef' }) === true);
ok('gestionnaire : ne voit pas une fiche hors équipe', ctx.consInScope({ id: 'c', managerId: 'X', dir: 'Autre' }) === false);
// utilisateur → sa seule fiche
resetS(); ctx.S.role = 'utilisateur'; ctx.S.consId = 'cU'; ctx.S._userEmail = 'u@x';
ok('utilisateur : voit sa propre fiche (consId)', ctx.consInScope({ id: 'cU' }) === true);
ok('utilisateur : voit sa fiche (email)', ctx.consInScope({ id: 'z', email: 'u@x' }) === true);
ok('utilisateur : ne voit pas les autres', ctx.consInScope({ id: 'z2', email: 'v@x' }) === false);
// admin → tout, sauf filtre directeur actif
resetS(); ctx.S.role = 'admin';
ok('admin sans filtre : voit tout', ctx.consInScope({ id: 'q', dir: 'Peu importe' }) === true);
ctx.S.fdir = ['Chef'];
ok('admin + filtre directeur : garde le directeur sélectionné', ctx.consInScope({ id: 'q', dir: 'Chef' }) === true);
ok('admin + filtre directeur : exclut les autres', ctx.consInScope({ id: 'q2', dir: 'Autre' }) === false);
// consInTeamScope = périmètre visible MOINS les supérieurs
resetS(); ctx.S.role = 'admin'; ctx.S._userId = 'ADMIN';
ctx.S.orgProfiles = [{ id: 'OWNER', role: 'super_admin', manager_id: null, cons_id: 'cOwner' }, { id: 'ADMIN', role: 'admin', manager_id: 'OWNER', cons_id: 'cAdmin' }];
ok('consInTeamScope : exclut le supérieur (patron)', ctx.consInTeamScope({ id: 'cOwner' }) === false);
ok('consInTeamScope : garde un consultant du périmètre', ctx.consInTeamScope({ id: 'other', dir: 'X' }) === true);

console.log('\n' + '─'.repeat(58));
console.log(pass + '/' + (pass + fail) + ' tests unitaires réussis' + (fail ? ' — \x1b[31m' + fail + ' échec(s)\x1b[0m' : ' — \x1b[32mtout est vert\x1b[0m'));
process.exit(fail ? 1 : 0);
