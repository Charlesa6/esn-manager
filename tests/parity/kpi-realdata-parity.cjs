// Harnais de parité sur DONNÉES RÉELLES — agrégat KPI entreprise (brique 2).
//
// Prouve que public.konsilys_company_kpis_agg (SQL) == l'agrégation tKPIs() (JS)
// sur les vraies données d'une entreprise, pour un exercice donné.
//
// 1) Générer le jeu de données (adapter la company_id), sauver le champ "data"
//    dans tests/parity/realdata.json (NON versionné — données métier) :
//
//    with cid as (select company_id from public.consultants limit 1)
//    select jsonb_build_object(
//      'cons',(select jsonb_agg(jsonb_build_object('id',id,'scr',coalesce(scr,0),'contract',coalesce(contract,'salarie'),'arrive',arrive,'depart',depart)) from public.consultants where company_id=(select company_id from cid)),
//      'miss',(select jsonb_agg(jsonb_build_object('cid',consultant_id,'sd',start_date,'ed',end_date,'tjm',coalesce(tjm,0),'btype',coalesce(billing_type,'at'),'wmode',coalesce(wmode,'rec'),'wdays',to_jsonb(work_days),'manual_days',manual_days,'deal',coalesce(deal_amount,0))) from public.missions where company_id=(select company_id from cid)),
//      'lvs',(select jsonb_agg(jsonb_build_object('cid',consultant_id,'s',start_date,'e',end_date,'type',coalesce(type,'Congé payé'))) from public.leaves where company_id=(select company_id from cid))
//    );
//
// 2) node tests/parity/kpi-realdata-parity.cjs   → imprime deux agrégats JS :
//    - exercice complet  → comparer à konsilys_company_kpis(fy_start, fy_end)
//    - trimestre T2       → comparer à
//      konsilys_company_kpis_range(win_start, win_end, fy_start, fy_end)
//    En vue trimestre, tWD/bill/rev sont bornés à la fenêtre mais le coût salarial
//    reste proratisé sur les jours ouvrés de l'EXERCICE COMPLET (comme tKPIs()).
// 3) Comparer aux nombres SQL (même company). NB : appeler la fonction PURE
//    (konsilys_company_kpis_agg) ou passer par un contexte authentifié — les
//    wrappers SECURITY DEFINER renvoient 0 sans JWT (my_company_id() nul).
//    Validé le 2026-07-10 : 9 indicateurs, 0 écart (exercice complet ET trimestre).
//
// FY par défaut : 2025-10-01 → 2026-09-30 (adapter ys/ye si besoin).

var D = require('./realdata.json');
function pD(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function fD(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function nxt(s){var d=pD(s);d.setDate(d.getDate()+1);return fD(d);}
function addD(s,n){var d=pD(s);d.setDate(d.getDate()+n);return fD(d);}
function isWE(s){var w=pD(s).getDay();return w===0||w===6;}
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4;var f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);var h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;var l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);var mo=Math.floor((h+l-7*m+114)/31),dy=((h+l-7*m+114)%31)+1;return fD(new Date(y,mo-1,dy));}
function frHols(y){var e=easter(y);return new Set([y+'-01-01',addD(e,1),y+'-05-01',y+'-05-08',addD(e,39),addD(e,50),y+'-07-14',y+'-08-15',y+'-11-01',y+'-11-11',y+'-12-25']);}
function fyHols(fy){var h1=frHols(fy-1),h2=frHols(fy),c=new Set();h1.forEach(function(d){c.add(d);});h2.forEach(function(d){c.add(d);});return c;}
function holRange(a,b){var sY=pD(a).getFullYear(),eY=pD(b).getFullYear(),HS=new Set();for(var y=sY-1;y<=eY;y++){frHols(y).forEach(function(d){HS.add(d);});}return HS;}
function isWD(s,H){return !isWE(s)&&!H.has(s);}
function wDays(a,b,H){var n=0,c=a;while(c<=b){if(isWD(c,H))n++;c=nxt(c);}return n;}
function lvSet(cid,lvs,H,ys,ye){var S=new Set();lvs.filter(function(l){return l.cid===cid;}).forEach(function(l){var c=l.s<ys?ys:l.s,e=l.e>ye?ye:l.e;while(c<=e){if(isWD(c,H))S.add(c);c=nxt(c);}});return S;}
function missWD(m,a,b,lvs){if(!a||!b||a>b)return 0;if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){var HHm=holRange(a,b);var ldsm=lvSet(m.cid,lvs,HHm,a,b);return m.manualDays.filter(function(d){return d>=a&&d<=b&&!ldsm.has(d);}).length;}var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];var HH=holRange(a,b);var lds=lvSet(m.cid,lvs,HH,a,b);var n=0,c=a;while(c<=b){if(isWD(c,HH)&&!lds.has(c)&&wd.indexOf(pD(c).getDay())>=0)n++;c=nxt(c);}return n;}
var EMPLOYER_FACTOR=1.25,SCR_FACTOR=113.35;
function kpi(c,miss,lvs,y,H,ro){var ys=ro[0],ye=ro[1];var cs=(c.arrive&&c.arrive>ys)?c.arrive:ys;var ce=(c.depart&&c.depart<ye)?c.depart:ye;var tWD=cs<=ce?wDays(cs,ce,H):0;var lds=lvSet(c.id,lvs,H,cs,ce);var bill=0,rev=0;var sickSet=new Set();lvs.filter(function(l){return l.cid===c.id&&l.type!=='Inter-contrat';}).forEach(function(l){var a=l.s<cs?cs:l.s,b=l.e>ce?ce:l.e;while(a<=b){if(isWD(a,H))sickSet.add(a);a=nxt(a);}});var sickD=sickSet.size;miss.filter(function(m){return m.cid===c.id;}).forEach(function(m){var mS=m.sd<cs?cs:m.sd,mE=(!m.ed||m.ed>ce)?ce:m.ed;if(mS>mE)return;var d=0;if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){m.manualDays.forEach(function(day){if(day>=mS&&day<=mE&&!lds.has(day))d++;});}else{var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];var cur=mS;while(cur<=mE){if(isWD(cur,H)&&!lds.has(cur)&&wd.indexOf(pD(cur).getDay())>=0)d++;cur=nxt(cur);}}var r;if(m.btype==='forfait'){var deal=+m.deal||0;var totD=m.ed?missWD(m,m.sd,m.ed,lvs):0;r=(m.ed&&totD>0)?deal*(d/totD):(m.ed?0:deal);}else{r=d*m.tjm;}bill+=d;rev+=r;});var sr=tWD>0?(bill+sickD)/tWD*100:0;var avgT=bill>0?rev/bill:0;var om=bill>0&&avgT>0?(avgT-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/avgT*100:null;return{tWD:tWD,bill:bill,rev:rev,sr:sr,avgT:avgT,om:om};}

var cons=D.cons.map(function(r){return{id:r.id,scr:r.scr||0,contract:r.contract||'salarie',arrive:r.arrive||null,depart:r.depart||null};});
var miss=D.miss.map(function(r){return{cid:r.cid,sd:r.sd,ed:r.ed||null,tjm:r.tjm||0,btype:r.btype||'at',wmode:r.wmode||'rec',wdays:Array.isArray(r.wdays)?r.wdays:[1,2,3,4,5],manualDays:Array.isArray(r.manual_days)?r.manual_days:[],deal:r.deal||0};});
var lvs=D.lvs.map(function(r){return{cid:r.cid,s:r.s,e:r.e,type:r.type||'Congé payé'};});
var ys='2025-10-01',ye='2026-09-30',y=2026,H=fyHols(y);
var fyTotalWD=wDays(ys,ye,H); /* dénominateur salaire = jours ouvrés de l'EXERCICE COMPLET */

/* Agrégat entreprise sur une fenêtre [ws,we], salaire proratisé sur fyTotalWD.
   Reproduit tKPIs() : en vue trimestre, la fenêtre borne tWD/bill/rev mais le
   coût salarial reste proratisé sur l'exercice entier. */
function agg(ws,we){
  var ks=cons.map(function(c){return{c:c,k:kpi(c,miss,lvs,y,H,[ws,we])};});
  var totR=ks.reduce(function(s,x){return s+x.k.rev;},0);
  var totBill=ks.reduce(function(s,x){return s+x.k.bill;},0);
  var aktWD=ks.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var avgSr=aktWD>0?ks.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/aktWD:0;
  var mArr=ks.filter(function(x){return x.k.om!=null;});
  var avgM=mArr.length?mArr.reduce(function(s,x){return s+x.k.om;},0)/mArr.length:null;
  var avgTJM=totBill>0?totR/totBill:0;
  var totSalary=ks.reduce(function(s,x){return s+(x.c.contract==='freelance'?x.c.scr*x.k.bill:x.c.scr*SCR_FACTOR*EMPLOYER_FACTOR*(x.k.tWD/fyTotalWD));},0);
  return{nCons:ks.length,totR:totR,totBill:totBill,tWD:aktWD,avgSr:avgSr,avgM:avgM,avgTJM:avgTJM,totSalary:totSalary,netC:totR-totSalary};
}

console.log('Exercice complet — à comparer à konsilys_company_kpis(\''+ys+'\',\''+ye+'\') :');
console.log(JSON.stringify(agg(ys,ye),null,2));
console.log('\nTrimestre T2 (janv.–mars) — à comparer à');
console.log('konsilys_company_kpis_range(\'2026-01-01\',\'2026-03-31\',\''+ys+'\',\''+ye+'\') :');
console.log(JSON.stringify(agg('2026-01-01','2026-03-31'),null,2));
