// Harnais de parité — agrégat KPI entreprise (brique 2, montée en charge).
// Exécute le vrai tKPIs() (agrégation JS de js/06-kpis.js) sur 8 consultants et
// compare au SQL public.konsilys_company_kpis_agg (migration kpi_company_aggregate.sql).
// Indicateurs : staffing moyen (Σ sr·tWD / Σ tWD), CA total, TJM moyen, marge
// moyenne, coût salarial (SCR·113,35·1,25·jours/joursFY), contribution nette.
// Usage : node tests/parity/kpi-aggregate-parity.cjs -> requete de controle (0 ecart attendu).
// Valide le 2026-07-10 : 9 indicateurs, 0 ecart.
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
var EMPLOYER_FACTOR=1.25, SCR_FACTOR=113.35;
function kpi(c,miss,lvs,y,H,ro){var ys=ro[0],ye=ro[1];var cs=(c.arrive&&c.arrive>ys)?c.arrive:ys;var ce=(c.depart&&c.depart<ye)?c.depart:ye;var tWD=cs<=ce?wDays(cs,ce,H):0;var lds=lvSet(c.id,lvs,H,cs,ce);var lvD=lds.size,bill=0,rev=0;var sickSet=new Set();lvs.filter(function(l){return l.cid===c.id&&l.type!=='Inter-contrat';}).forEach(function(l){var a=l.s<cs?cs:l.s,b=l.e>ce?ce:l.e;while(a<=b){if(isWD(a,H))sickSet.add(a);a=nxt(a);}});var sickD=sickSet.size;miss.filter(function(m){return m.cid===c.id;}).forEach(function(m){var mS=m.sd<cs?cs:m.sd,mE=(!m.ed||m.ed>ce)?ce:m.ed;if(mS>mE)return;var d=0;if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){m.manualDays.forEach(function(day){if(day>=mS&&day<=mE&&!lds.has(day))d++;});}else{var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];var cur=mS;while(cur<=mE){if(isWD(cur,H)&&!lds.has(cur)&&wd.indexOf(pD(cur).getDay())>=0)d++;cur=nxt(cur);}}var r;if(m.btype==='forfait'){var deal=+m.deal||0;var totD=m.ed?missWD(m,m.sd,m.ed,lvs):0;r=(m.ed&&totD>0)?deal*(d/totD):(m.ed?0:deal);}else{r=d*m.tjm;}bill+=d;rev+=r;});var sr=tWD>0?(bill+sickD)/tWD*100:0,avgT=bill>0?rev/bill:0;var om=bill>0&&avgT>0?(avgT-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/avgT*100:null;return{tWD:tWD,bill:bill,rev:rev,sr:sr,avgT:avgT,om:om};}

var ys='2025-10-01',ye='2026-09-30',y=2026,H=fyHols(y);
function L(cid,s,e,type){return{cid:cid,s:s,e:e,type:type};}
var F=[
 {c:{id:'c1',scr:300,contract:'salarie',arrive:null,depart:null,bu:'bu_1'},miss:[{cid:'c1',sd:'2025-10-01',ed:'2026-09-30',tjm:600,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c2',scr:350,contract:'salarie',arrive:null,depart:null,bu:'bu_1'},miss:[{cid:'c2',sd:'2025-10-01',ed:'2026-09-30',tjm:500,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[L('c2','2025-12-22','2026-01-02','Congé payé'),L('c2','2026-03-02','2026-03-13','Inter-contrat')]},
 {c:{id:'c3',scr:400,contract:'salarie',arrive:null,depart:null,bu:'bu_2'},miss:[{cid:'c3',sd:'2026-01-05',ed:'2026-06-30',tjm:0,btype:'forfait',deal:120000,wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c4',scr:400,contract:'salarie',arrive:null,depart:null,bu:'bu_2'},miss:[{cid:'c4',sd:'2026-02-01',ed:null,tjm:0,btype:'forfait',deal:80000,wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c5',scr:450,contract:'salarie',arrive:null,depart:null,bu:'bu_2'},miss:[{cid:'c5',sd:'2026-02-02',ed:'2026-02-27',tjm:700,btype:'at',wmode:'man',manualDays:['2026-02-03','2026-02-05','2026-02-10','2026-02-12','2026-02-17']}],lvs:[L('c5','2026-02-10','2026-02-10','Congé payé')]},
 {c:{id:'c6',scr:380,contract:'salarie',arrive:'2026-02-01',depart:'2026-07-15',bu:'bu_1'},miss:[{cid:'c6',sd:'2025-10-01',ed:'2026-09-30',tjm:550,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c7',scr:500,contract:'freelance',arrive:null,depart:null,bu:'bu_3'},miss:[{cid:'c7',sd:'2025-10-01',ed:'2026-09-30',tjm:700,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c8',scr:600,contract:'salarie',arrive:null,depart:null,bu:'bu_3'},miss:[{cid:'c8',sd:'2025-10-01',ed:'2026-03-31',tjm:600,btype:'at',wmode:'rec',wdays:[1,2,3]},{cid:'c8',sd:'2026-04-01',ed:'2026-09-30',tjm:650,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[L('c8','2025-11-10','2025-11-14','RTT')]}
];
var ALLM=[],ALLL=[];F.forEach(function(f){f.miss.forEach(function(m){ALLM.push(m);});f.lvs.forEach(function(l){ALLL.push(l);});});
var fyTotalWD=wDays(ys,ye,H); /* dénominateur salaire = jours ouvrés de l'exercice complet */
function r4(x){return x==null?null:Number(Number(x).toFixed(4));}

/* Agrégat JS sur une fenêtre [ws,we] ; le coût salarial reste proratisé sur
   l'exercice complet (fyTotalWD) — comme tKPIs() en vue trimestre. */
function agg(ws,we){
  var ks=F.map(function(f){return{c:f.c,k:kpi(f.c,ALLM,ALLL,y,H,[ws,we])};});
  var totR=ks.reduce(function(s,x){return s+x.k.rev;},0);
  var totBill=ks.reduce(function(s,x){return s+x.k.bill;},0);
  var aktWD=ks.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var avgSr=aktWD>0?ks.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/aktWD:0;
  var mArr=ks.filter(function(x){return x.k.om!=null;});
  var avgM=mArr.length?mArr.reduce(function(s,x){return s+x.k.om;},0)/mArr.length:null;
  var avgTJM=totBill>0?totR/totBill:0;
  var totSalary=ks.reduce(function(s,x){return s+(x.c.contract==='freelance'?x.c.scr*x.k.bill:x.c.scr*SCR_FACTOR*EMPLOYER_FACTOR*(x.k.tWD/fyTotalWD));},0);
  return{nCons:ks.length,totR:r4(totR),totBill:totBill,tWD:aktWD,avgSr:r4(avgSr),avgM:r4(avgM),avgTJM:r4(avgTJM),totSalary:r4(totSalary),netC:r4(totR-totSalary)};
}
function cJson(){return JSON.stringify(F.map(function(f){return{id:f.c.id,scr:f.c.scr,contract:f.c.contract,arrive:f.c.arrive,depart:f.c.depart,bu_id:f.c.bu};}));}
function mJson(){return JSON.stringify(ALLM.map(function(m){return{cid:m.cid,sd:m.sd,ed:m.ed||null,tjm:m.tjm||0,btype:m.btype,wmode:m.wmode||'rec',wdays:m.wdays||[1,2,3,4,5],manual_days:m.manualDays||[],deal:m.deal||0};}));}
function lJson(){return JSON.stringify(ALLL.map(function(l){return{cid:l.cid,s:l.s,e:l.e,type:l.type};}));}

/* Deux fenêtres : exercice complet + trimestre T2 (janv.–mars). En T2, le SQL
   reçoit le dénominateur salaire explicite = jours ouvrés de l'exercice complet. */
var salFyWd=wDays(ys,ye,H);
var CASES=[
  {lbl:'exercice complet', ws:ys, we:ye, salWd:'null'},
  {lbl:'trimestre T2 (janv.-mars)', ws:'2026-01-01', we:'2026-03-31', salWd:salFyWd}
];
var parts=CASES.map(function(cs,i){
  var exp=agg(cs.ws,cs.we);
  return "select "+i+" as caseid, '"+cs.lbl+"' as scope, "
    +"public.konsilys_company_kpis_agg('"+cJson()+"'::jsonb,'"+mJson()+"'::jsonb,'"+lJson()+"'::jsonb,'"+cs.ws+"'::date,'"+cs.we+"'::date,"+cs.salWd+") as k, "
    +"'"+JSON.stringify(exp)+"'::jsonb as exp";
});
var sql="with r as (\n  "+parts.join("\n  union all\n  ")+"\n)\n"
 +"select scope, count(*) filter (where round(coalesce((k->>key)::numeric,-1e9),4) is distinct from round(coalesce((exp->>key)::numeric,-1e9),4)) as ecarts\n"
 +"from r, lateral (values('nCons'),('totR'),('totBill'),('tWD'),('avgSr'),('avgM'),('avgTJM'),('totSalary'),('netC')) t(key)\n"
 +"group by caseid, scope order by caseid;";
console.log(sql);
