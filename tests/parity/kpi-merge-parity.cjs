// Test unitaire — sélection de l'agrégat entreprise serveur (brique 2, montée en
// charge). Charge les VRAIES fonctions serverCompanyKpis()/mergeCompanyAgg() de
// js/06-kpis.js dans un bac à sable et vérifie :
//   1. drapeau off  → serverCompanyKpis() = null (calcul local conservé) ;
//   2. mauvaise fenêtre (exercice/trimestre) → null (pas de valeurs périmées) ;
//   3. bonne fenêtre → l'agrégat serveur prime, scalaires bien recopiés ;
//   4. srv absent → mergeCompanyAgg renvoie l'objet JS tel quel ;
//   5. avgM null géré (pas de 0 fantôme).
// Usage : node tests/parity/kpi-merge-parity.cjs   (exit != 0 si régression).

var fs = require('fs'), vm = require('vm'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', '06-kpis.js'), 'utf8');

// Extraire uniquement les deux fonctions ciblées (elles ne référencent que
// S / KPI_SERVER_AGG / CFY), pour les évaluer isolément.
function grab(name){
  var re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  var m = re.exec(src); if(!m) throw new Error('introuvable : ' + name);
  var i = m.index + m[0].length - 1, depth = 0;
  for(var j = i; j < src.length; j++){
    if(src[j] === '{') depth++;
    else if(src[j] === '}'){ depth--; if(depth === 0) return src.slice(m.index, j + 1); }
  }
  throw new Error('accolade non fermée : ' + name);
}

var sandbox = { S: {}, KPI_SERVER_AGG: false, CFY: 2026 };
vm.createContext(sandbox);
vm.runInContext(
  grab('serverCompanyKpis') + '\n' + grab('mergeCompanyAgg') +
  '\nthis.serverCompanyKpis = serverCompanyKpis; this.mergeCompanyAgg = mergeCompanyAgg;',
  sandbox
);
var serverCompanyKpis = sandbox.serverCompanyKpis, mergeCompanyAgg = sandbox.mergeCompanyAgg;

var SRV = { avgSr: 55.5, totR: 1000000, totBill: 2000, avgTJM: 500, avgM: 20, totSalary: 600000, netC: 400000, nCons: 30 };
var JSV = { avgSr: 11.1, totR: 1, totBill: 2, avgTJM: 3, avgM: 4, totSalary: 5, netC: 6, nCons: 7 };
var fails = [];
function ok(cond, label){ if(!cond) fails.push(label); }

// 1. drapeau off → null
sandbox.KPI_SERVER_AGG = false;
sandbox.S = { year: 2026, quarter: null, companyKpis: SRV, companyKpisKey: '2026|' };
ok(serverCompanyKpis() === null, 'drapeau off doit donner null');

// 2. drapeau on, mauvaise fenêtre → null
sandbox.KPI_SERVER_AGG = true;
sandbox.S = { year: 2026, quarter: 2, companyKpis: SRV, companyKpisKey: '2026|' }; // clé exercice complet, vue trimestre
ok(serverCompanyKpis() === null, 'fenêtre trimestre non concordante doit donner null');
sandbox.S = { year: 2025, quarter: null, companyKpis: SRV, companyKpisKey: '2026|' }; // mauvais exercice
ok(serverCompanyKpis() === null, 'exercice non concordant doit donner null');

// 3. drapeau on, bonne fenêtre → l'agrégat serveur
sandbox.S = { year: 2026, quarter: 2, companyKpis: SRV, companyKpisKey: '2026|2' };
var got = serverCompanyKpis();
ok(got === SRV, 'fenêtre concordante (trimestre) doit renvoyer l\'agrégat serveur');
var merged = mergeCompanyAgg(JSV, got);
ok(merged.avgSr === 55.5 && merged.totR === 1000000 && merged.totBill === 2000 &&
   merged.avgTJM === 500 && merged.avgM === 20 && merged.totSalary === 600000 &&
   merged.netC === 400000 && merged.nCons === 30, 'les scalaires serveur doivent primer');

// 4. srv absent → JS inchangé
var passthru = mergeCompanyAgg(JSV, null);
ok(passthru === JSV, 'srv null doit renvoyer l\'objet JS tel quel');

// 5. avgM null géré
var m2 = mergeCompanyAgg(JSV, { avgSr: 1, totR: 2, totBill: 3, avgTJM: 4, avgM: null, totSalary: 5, netC: 6, nCons: 8 });
ok(m2.avgM === null, 'avgM null doit rester null (pas 0)');

if(fails.length){ console.error('ÉCHECS :\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('kpi-merge-parity : 7 assertions OK (sélection agrégat serveur).');
