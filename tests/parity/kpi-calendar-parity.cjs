// Harnais de parité — calendrier KPI (brique 2, montée en charge).
//
// Vérifie que les primitives SQL (public.konsilys_fr_holidays / konsilys_working_days,
// migration kpi_calendar_primitives.sql) donnent EXACTEMENT les mêmes jours ouvrés
// que le moteur JS (js/01-core.js). Principe : on copie les primitives JS VERBATIM,
// on calcule la référence pour une batterie de plages, et on émet une requête SQL
// qui compte les écarts. 0 écart = parité.
//
// Usage :
//   node tests/parity/kpi-calendar-parity.cjs   # imprime la requête SQL de contrôle
// puis exécuter cette requête sur la base (Supabase MCP execute_sql, ou psql).
// Résultat attendu : ecarts = 0.

// ── Primitives JS copiées verbatim de js/01-core.js ──────────────────────────
function pD(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function fD(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function nxt(s){var d=pD(s);d.setDate(d.getDate()+1);return fD(d);}
function addD(s,n){var d=pD(s);d.setDate(d.getDate()+n);return fD(d);}
function isWE(s){var w=pD(s).getDay();return w===0||w===6;}
function easter(y){
  var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4;
  var f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  var h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
  var l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  var mo=Math.floor((h+l-7*m+114)/31),dy=((h+l-7*m+114)%31)+1;
  return fD(new Date(y,mo-1,dy));
}
function frHols(y){
  var e=easter(y);
  return new Set([y+'-01-01',addD(e,1),y+'-05-01',y+'-05-08',addD(e,39),addD(e,50),y+'-07-14',y+'-08-15',y+'-11-01',y+'-11-11',y+'-12-25']);
}
// Jour ouvré, fériés de l'année de la date (équivalent SQL konsilys_is_workday).
var HOLcache={};
function holsOf(y){return HOLcache[y]||(HOLcache[y]=frHols(y));}
function isWDy(s){var y=+s.slice(0,4);return !isWE(s)&&!holsOf(y).has(s);}
function wDaysY(a,b){var n=0,c=a;while(c<=b){if(isWDy(c))n++;c=nxt(c);}return n;}

// ── Cas de test : FY complets, trimestres, mois à fériés, année croisée,
//    jours isolés (férié/we/Ascension/Pentecôte) et plage inversée. ───────────
var ranges=[
  ['2024-10-01','2025-09-30'],['2025-10-01','2026-09-30'],['2026-10-01','2027-09-30'],
  ['2025-10-01','2025-12-31'],['2026-01-01','2026-03-31'],['2026-04-01','2026-06-30'],['2026-07-01','2026-09-30'],
  ['2025-05-01','2025-05-31'],['2026-05-01','2026-05-31'],['2025-04-01','2025-06-30'],
  ['2025-12-15','2026-01-15'],['2024-12-20','2025-01-10'],
  ['2025-01-01','2025-12-31'],['2026-01-01','2026-12-31'],['2027-01-01','2027-12-31'],
  ['2025-08-15','2025-08-15'],['2025-08-16','2025-08-16'],['2025-08-18','2025-08-18'],
  ['2026-04-06','2026-04-06'],['2026-05-25','2026-05-25'],
  ['2025-11-01','2025-11-11'],['2026-07-13','2026-07-15'],
  ['2025-09-30','2025-10-01'],['2026-06-01','2026-06-08'],
  ['2026-05-05','2026-05-05'],['2025-06-09','2025-06-09'],
  ['2026-09-30','2026-01-01']  // inversée -> 0
];
var rows=ranges.map(function(r){return "('"+r[0]+"'::date,'"+r[1]+"'::date,"+wDaysY(r[0],r[1])+")";});
var sql="select count(*) as cas_testes, count(*) filter (where public.konsilys_working_days(a,b) <> exp) as ecarts\n"
  +"from (values\n  "+rows.join(",\n  ")+"\n) t(a,b,exp);";
console.log(sql);
