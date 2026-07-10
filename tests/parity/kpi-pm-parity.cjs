// Harnais de parité — détail par mission (pm) du cœur KPI (brique 2, montée en
// charge). Exécute le VRAI kpi() de js/01-core.js (copié verbatim, avec pm) et
// compare, mission par mission, à public.konsilys_kpi_core(...)->'pm' (migration
// kpi_core_pm.sql) : jours, CA, marge. Vérifie aussi le CA/bill agrégé.
//
// Cas couverts : AT + forfait actifs, congé chevauchant, mode manuel, ET le cas
// de bord corrigé — forfait SANS date de fin commençant après le départ du
// consultant (fenêtre effective vide → jours/CA/marge = 0, l'ancienne version
// retombait à tort sur le deal entier).
//
// Usage : node tests/parity/kpi-pm-parity.cjs  → imprime la requête de contrôle
// (0 écart attendu), à exécuter via Supabase MCP execute_sql.

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
// kpi() copié verbatim de js/01-core.js (partie pm incluse).
function kpi(c,miss,lvs,y,H,ro){
  var ys=ro[0],ye=ro[1];
  var cs=(c.arrive&&c.arrive>ys)?c.arrive:ys;
  var ce=(c.depart&&c.depart<ye)?c.depart:ye;
  var tWD=cs<=ce?wDays(cs,ce,H):0;
  var lds=lvSet(c.id,lvs,H,cs,ce);
  var bill=0,rev=0;
  var pm=miss.filter(function(m){return m.cid===c.id;}).map(function(m){
    var mS=m.sd<cs?cs:m.sd,mE=(!m.ed||m.ed>ce)?ce:m.ed;
    if(mS>mE)return Object.assign({},m,{days:0,rev:0,mar:0});
    var d=0;
    if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){
      m.manualDays.forEach(function(day){if(day>=mS&&day<=mE&&!lds.has(day))d++;});
    }else{
      var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];
      var cur=mS;while(cur<=mE){if(isWD(cur,H)&&!lds.has(cur)&&wd.indexOf(pD(cur).getDay())>=0)d++;cur=nxt(cur);}
    }
    var r,mar;
    if(m.btype==='forfait'){
      var deal=+m.deal||0;var totD=m.ed?missWD(m,m.sd,m.ed,lvs):0;
      r=(m.ed&&totD>0)?deal*(d/totD):(m.ed?0:deal);
      mar=r>0?(r-d*c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/r*100:0;
    }else{
      r=d*m.tjm;
      mar=m.tjm>0?(m.tjm-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/m.tjm*100:0;
    }
    bill+=d;rev+=r;
    return Object.assign({},m,{days:d,rev:r,mar:mar});
  });
  return{bill:bill,rev:rev,pm:pm};
}

var ys='2025-10-01',ye='2026-09-30',y=2026,H=fyHols(y);
function r6(x){return x==null?null:Number(Number(x).toFixed(6));}
// Cas de test : consultant + missions (avec cli/name pour vérifier le passthrough).
var CASES=[
  { scr:400, contract:'salarie', arrive:null, depart:null,
    miss:[
      {cid:'x',cli:'BNP',name:'TMA',sd:'2025-10-01',ed:'2026-09-30',tjm:600,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]},
      {cid:'x',cli:'AXA',name:'Forfait A',sd:'2026-01-05',ed:'2026-06-30',tjm:0,btype:'forfait',deal:120000,wmode:'rec',wdays:[1,2,3,4,5]}
    ], lvs:[{cid:'x',s:'2025-12-22',e:'2026-01-02',type:'Congé payé'}] },
  // Cas de bord : forfait SANS date de fin, démarrant après le départ → fenêtre vide.
  { scr:450, contract:'salarie', arrive:null, depart:'2026-04-30',
    miss:[
      {cid:'x',cli:'SG',name:'Run',sd:'2025-10-01',ed:'2026-03-31',tjm:550,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]},
      {cid:'x',cli:'EDF',name:'Forfait tardif',sd:'2026-06-01',ed:null,tjm:0,btype:'forfait',deal:90000,wmode:'rec',wdays:[1,2,3,4,5]}
    ], lvs:[] },
  // Mode manuel + congé chevauchant.
  { scr:500, contract:'freelance', arrive:null, depart:null,
    miss:[
      {cid:'x',cli:'SNCF',name:'Manuel',sd:'2026-02-02',ed:'2026-02-27',tjm:700,btype:'at',wmode:'man',manualDays:['2026-02-03','2026-02-05','2026-02-10','2026-02-12','2026-02-17']}
    ], lvs:[{cid:'x',s:'2026-02-10',e:'2026-02-10',type:'Congé payé'}] }
];

function missJson(miss){return JSON.stringify(miss.map(function(m){return{cli:m.cli,name:m.name,sd:m.sd,ed:m.ed||null,tjm:m.tjm||0,btype:m.btype,wmode:m.wmode||'rec',wdays:m.wdays||[1,2,3,4,5],manual_days:m.manualDays||[],deal:m.deal||0};}));}
function lvsJson(lvs){return JSON.stringify(lvs.map(function(l){return{s:l.s,e:l.e,type:l.type};}));}

var rows=CASES.map(function(f,idx){
  var c={id:'x',scr:f.scr,contract:f.contract,arrive:f.arrive,depart:f.depart};
  var k=kpi(c,f.miss,f.lvs,y,H,[ys,ye]);
  // pm attendu : liste [{i,days,rev,mar,cli,name}] par ordre de mission.
  var pmExp=k.pm.map(function(m,i){return{i:i,days:m.days,rev:r6(m.rev),mar:r6(m.mar),cli:m.cli,name:m.name};});
  var exp={bill:k.bill,rev:r6(k.rev),pm:pmExp};
  var arrive=f.arrive?("'"+f.arrive+"'::date"):'null::date';
  var depart=f.depart?("'"+f.depart+"'::date"):'null::date';
  return "("+(idx+1)+", public.konsilys_kpi_core("+f.scr+",'"+f.contract+"',"+arrive+","+depart+",'"+ys+"'::date,'"+ye+"'::date,'"+missJson(f.miss)+"'::jsonb,'"+lvsJson(f.lvs)+"'::jsonb), '"+JSON.stringify(exp)+"'::jsonb)";
});

// Contrôle : agrégat (bill,rev) + chaque entrée pm (days,rev,mar,cli,name) alignée par index.
var sql=
"with res(fid,k,exp) as (values\n  "+rows.join(",\n  ")+"\n),\n"+
"agg as (\n"+
"  select fid, key, (k->>key) sqlv, (exp->>key) jsv\n"+
"  from res, lateral (values('bill'),('rev')) t(key)\n"+
"  where round(coalesce((k->>key)::numeric,-1e9),6) is distinct from round(coalesce((exp->>key)::numeric,-1e9),6)\n"+
"),\n"+
"pm as (\n"+
"  select r.fid, (e->>'i') idx, f.key,\n"+
"    (k_el->>f.key) sqlv, (e->>f.key) jsv\n"+
"  from res r,\n"+
"    lateral jsonb_array_elements(r.exp->'pm') with ordinality ex(e,eo),\n"+
"    lateral (select (r.k->'pm')->((e->>'i')::int) k_el) kk,\n"+
"    lateral (values('days'),('rev'),('mar'),('cli'),('name')) f(key)\n"+
"  where case when f.key in ('cli','name')\n"+
"             then coalesce(k_el->>f.key,'') is distinct from coalesce(e->>f.key,'')\n"+
"             else round(coalesce((k_el->>f.key)::numeric,-1e9),6) is distinct from round(coalesce((e->>f.key)::numeric,-1e9),6) end\n"+
")\n"+
"select 'agregat' scope, count(*) ecarts from agg\n"+
"union all\n"+
"select 'pm detail', count(*) from pm;";
console.log(sql);
