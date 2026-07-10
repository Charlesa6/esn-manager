// Harnais de parité — cœur du calcul KPI (brique 2, montée en charge).
//
// Exécute le VRAI kpi() de js/01-core.js (copié verbatim) sur une batterie de cas
// et émet une requête SQL comparant, champ par champ, à public.konsilys_kpi_core
// (migration kpi_core_function.sql). Cas couverts : assistance technique, forfait
// (avec/sans date de fin), mode manuel, congés (dont Inter-contrat), arrivée/
// départ en cours d'exercice, freelance, multi-missions à jours travaillés partiels.
//
// Usage : node tests/parity/kpi-core-parity.cjs  → imprime la requête de contrôle,
// à exécuter sur la base (Supabase MCP execute_sql). Résultat attendu : 0 écart.
// Validé le 2026-07-10 : 8 cas × 9 indicateurs = 72 comparaisons, 0 écart.

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
var EMPLOYER_FACTOR=1.25;
function kpi(c,miss,lvs,y,H,rangeOverride){
  var ys=rangeOverride[0],ye=rangeOverride[1];
  var cs=(c.arrive&&c.arrive>ys)?c.arrive:ys;
  var ce=(c.depart&&c.depart<ye)?c.depart:ye;
  var tWD=cs<=ce?wDays(cs,ce,H):0;
  var lds=lvSet(c.id,lvs,H,cs,ce);
  var lvD=lds.size,avD=tWD-lvD,bill=0,rev=0;
  var sickSet=new Set();
  lvs.filter(function(l){return l.cid===c.id&&l.type!=='Inter-contrat';}).forEach(function(l){var a=l.s<cs?cs:l.s,b=l.e>ce?ce:l.e;while(a<=b){if(isWD(a,H))sickSet.add(a);a=nxt(a);}});
  var sickD=sickSet.size;
  miss.filter(function(m){return m.cid===c.id;}).forEach(function(m){
    var mS=m.sd<cs?cs:m.sd,mE=(!m.ed||m.ed>ce)?ce:m.ed;
    if(mS>mE)return;
    var d=0;
    if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){m.manualDays.forEach(function(day){if(day>=mS&&day<=mE&&!lds.has(day))d++;});}
    else{var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];var cur=mS;while(cur<=mE){if(isWD(cur,H)&&!lds.has(cur)&&wd.indexOf(pD(cur).getDay())>=0)d++;cur=nxt(cur);}}
    var r;
    if(m.btype==='forfait'){var deal=+m.deal||0;var totD=m.ed?missWD(m,m.sd,m.ed,lvs):0;r=(m.ed&&totD>0)?deal*(d/totD):(m.ed?0:deal);}
    else{r=d*m.tjm;}
    bill+=d;rev+=r;
  });
  var sr=tWD>0?(bill+sickD)/tWD*100:0,avgT=bill>0?rev/bill:0;
  var om=bill>0&&avgT>0?(avgT-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/avgT*100:null;
  return{tWD:tWD,lvD:lvD,avD:avD,sickD:sickD,bill:bill,rev:rev,sr:sr,avgT:avgT,om:om};
}

var ys='2025-10-01',ye='2026-09-30',y=2026;
function L(cid,s,e,type){return{cid:cid,s:s,e:e,type:type};}
var F=[
 {c:{id:'c1',scr:300,contract:'salarie',arrive:null,depart:null},miss:[{cid:'c1',sd:'2025-10-01',ed:'2026-09-30',tjm:600,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c2',scr:350,contract:'salarie',arrive:null,depart:null},miss:[{cid:'c2',sd:'2025-10-01',ed:'2026-09-30',tjm:500,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[L('c2','2025-12-22','2026-01-02','Congé payé'),L('c2','2026-03-02','2026-03-13','Inter-contrat')]},
 {c:{id:'c3',scr:400,contract:'salarie',arrive:null,depart:null},miss:[{cid:'c3',sd:'2026-01-05',ed:'2026-06-30',tjm:0,btype:'forfait',deal:120000,wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c4',scr:400,contract:'salarie',arrive:null,depart:null},miss:[{cid:'c4',sd:'2026-02-01',ed:null,tjm:0,btype:'forfait',deal:80000,wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c5',scr:450,contract:'salarie',arrive:null,depart:null},miss:[{cid:'c5',sd:'2026-02-02',ed:'2026-02-27',tjm:700,btype:'at',wmode:'man',manualDays:['2026-02-03','2026-02-05','2026-02-10','2026-02-12','2026-02-17']}],lvs:[L('c5','2026-02-10','2026-02-10','Congé payé')]},
 {c:{id:'c6',scr:380,contract:'salarie',arrive:'2026-02-01',depart:'2026-07-15'},miss:[{cid:'c6',sd:'2025-10-01',ed:'2026-09-30',tjm:550,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c7',scr:500,contract:'freelance',arrive:null,depart:null},miss:[{cid:'c7',sd:'2025-10-01',ed:'2026-09-30',tjm:700,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[]},
 {c:{id:'c8',scr:600,contract:'salarie',arrive:null,depart:null},miss:[{cid:'c8',sd:'2025-10-01',ed:'2026-03-31',tjm:600,btype:'at',wmode:'rec',wdays:[1,2,3]},{cid:'c8',sd:'2026-04-01',ed:'2026-09-30',tjm:650,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}],lvs:[L('c8','2025-11-10','2025-11-14','RTT')]}
];

function r6(x){return x==null?null:Number(Number(x).toFixed(6));}
function missJson(miss){return JSON.stringify(miss.map(function(m){return{sd:m.sd,ed:m.ed||null,tjm:m.tjm||0,btype:m.btype,wmode:m.wmode||'rec',wdays:m.wdays||[1,2,3,4,5],manual_days:m.manualDays||[],deal:m.deal||0};}));}
function lvsJson(lvs){return JSON.stringify(lvs.map(function(l){return{s:l.s,e:l.e,type:l.type};}));}

var rows=F.map(function(f,idx){
  var k=kpi(f.c,f.miss,f.lvs,y,fyHols(y),[ys,ye]);
  var exp={tWD:k.tWD,lvD:k.lvD,avD:k.avD,sickD:k.sickD,bill:k.bill,rev:r6(k.rev),sr:r6(k.sr),avgT:r6(k.avgT),om:r6(k.om)};
  var arrive=f.c.arrive?("'"+f.c.arrive+"'::date"):'null::date';
  var depart=f.c.depart?("'"+f.c.depart+"'::date"):'null::date';
  return "("+(idx+1)+", public.konsilys_kpi_core("+f.c.scr+",'"+f.c.contract+"',"+arrive+","+depart+",'"+ys+"'::date,'"+ye+"'::date,'"+missJson(f.miss)+"'::jsonb,'"+lvsJson(f.lvs)+"'::jsonb), '"+JSON.stringify(exp)+"'::jsonb)";
});
var sql="with res(fid,k,exp) as (values\n  "+rows.join(",\n  ")+"\n)\n"
 +"select fid, key, (k->>key) as sql_val, (exp->>key) as js_val\n"
 +"from res, lateral (values('tWD'),('lvD'),('avD'),('sickD'),('bill'),('rev'),('sr'),('avgT'),('om')) t(key)\n"
 +"where round(coalesce((k->>key)::numeric,-1e9),6) is distinct from round(coalesce((exp->>key)::numeric,-1e9),6)\n"
 +"order by fid, key;";
console.log(sql);
