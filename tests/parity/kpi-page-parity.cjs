// Harnais de parité — pagination serveur des cartes KPI (brique 2, montée en charge).
// Vérifie deux fonctions déployées (kpi_consultant_page.sql) :
//   • konsilys_top_clients_agg  == clientRev() de js/06-kpis.js (top clients par CA
//     sur la fenêtre : somme des CA de mission où jours > 0, par client, tri desc) ;
//   • konsilys_consultant_kpis_page_agg — total filtré + tri/pagination attendus.
//
// Les CA par client et les métriques par consultant sont choisis DISTINCTS pour
// lever toute ambiguïté de tie-break entre JS et SQL.
//
// Usage : node tests/parity/kpi-page-parity.cjs  → requête de contrôle (0 écart attendu).

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
function kpi(c,miss,lvs,y,H,ro){
  var ys=ro[0],ye=ro[1];
  var cs=(c.arrive&&c.arrive>ys)?c.arrive:ys;
  var ce=(c.depart&&c.depart<ye)?c.depart:ye;
  var lds=lvSet(c.id,lvs,H,cs,ce);
  var bill=0,rev=0;
  var pm=miss.filter(function(m){return m.cid===c.id;}).map(function(m){
    var mS=m.sd<cs?cs:m.sd,mE=(!m.ed||m.ed>ce)?ce:m.ed;
    if(mS>mE)return{cli:m.cli,days:0,rev:0};
    var d=0;
    if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){m.manualDays.forEach(function(day){if(day>=mS&&day<=mE&&!lds.has(day))d++;});}
    else{var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];var cur=mS;while(cur<=mE){if(isWD(cur,H)&&!lds.has(cur)&&wd.indexOf(pD(cur).getDay())>=0)d++;cur=nxt(cur);}}
    var r;
    if(m.btype==='forfait'){var deal=+m.deal||0;var totD=m.ed?missWD(m,m.sd,m.ed,lvs):0;r=(m.ed&&totD>0)?deal*(d/totD):(m.ed?0:deal);}
    else{r=d*m.tjm;}
    bill+=d;rev+=r;
    return{cli:m.cli,days:d,rev:r};
  });
  var avgT=bill>0?rev/bill:0;
  var sr=0; // non requis ici pour le tri (on trie sur ca/marge/nom)
  var om=bill>0&&avgT>0?(avgT-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/avgT*100:null;
  return{bill:bill,rev:rev,avgT:avgT,om:om,pm:pm};
}
function clientRev(ks){var map={};ks.forEach(function(x){x.k.pm.forEach(function(m){if(m.days>0)map[m.cli]=(map[m.cli]||0)+m.rev;});});return Object.keys(map).map(function(k){return{name:k,rev:map[k]};}).sort(function(a,b){return b.rev-a.rev||(a.name<b.name?-1:1);});}

var ys='2025-10-01',ye='2026-09-30',y=2026,H=fyHols(y);
// 6 consultants, CA par client distincts, tjm distincts → tri sans ambiguïté.
var F=[
 {c:{id:'p1',name:'Alice Durand',title:'Consultante',scr:300,contract:'salarie',arrive:null,depart:null},miss:[{cid:'p1',cli:'BNP',name:'M1',sd:'2025-10-01',ed:'2026-09-30',tjm:600,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}]},
 {c:{id:'p2',name:'Bruno Lefevre',title:'Architecte',scr:350,contract:'salarie',arrive:null,depart:null},miss:[{cid:'p2',cli:'AXA',name:'M2',sd:'2025-10-01',ed:'2026-09-30',tjm:520,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}]},
 {c:{id:'p3',name:'Chloe Martin',title:'Data',scr:400,contract:'salarie',arrive:null,depart:null},miss:[{cid:'p3',cli:'SNCF',name:'M3',sd:'2026-01-05',ed:'2026-06-30',tjm:0,btype:'forfait',deal:90000,wmode:'rec',wdays:[1,2,3,4,5]}]},
 {c:{id:'p4',name:'David Nguyen',title:'Dev',scr:420,contract:'freelance',arrive:null,depart:null},miss:[{cid:'p4',cli:'BNP',name:'M4',sd:'2025-10-01',ed:'2026-09-30',tjm:710,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}]},
 {c:{id:'p5',name:'Elodie Robert',title:'PMO',scr:380,contract:'salarie',arrive:'2026-02-01',depart:null},miss:[{cid:'p5',cli:'EDF',name:'M5',sd:'2025-10-01',ed:'2026-09-30',tjm:640,btype:'at',wmode:'rec',wdays:[1,2,3,4,5]}]},
 {c:{id:'p6',name:'Farid Benali',title:'Lead',scr:450,contract:'salarie',arrive:null,depart:null},miss:[]}
];
var ALLM=[],ALLL=[];F.forEach(function(f){f.miss.forEach(function(m){ALLM.push(m);});});
var ks=F.map(function(f){return{c:f.c,k:kpi(f.c,ALLM,ALLL,y,H,[ys,ye])};});
function r4(x){return x==null?null:Number(Number(x).toFixed(4));}

// Attendu top clients (top 3).
var topExp=clientRev(ks).slice(0,3).map(function(t){return{name:t.name,rev:r4(t.rev)};});

// Attendu tri consultants (ids) selon plusieurs clés.
function sortIds(key,dir){
  var arr=ks.map(function(x){return x;});
  arr.sort(function(a,b){
    var va,vb;
    if(key==='ca'){va=a.k.rev;vb=b.k.rev;}
    else if(key==='marge'){va=a.k.om;vb=b.k.om;}
    else {va=a.c.name.toLowerCase();vb=b.c.name.toLowerCase();}
    // nulls last pour métriques
    if(key==='ca'||key==='marge'){
      var an=va==null,bn=vb==null;
      if(an&&bn)return a.c.name.toLowerCase()<b.c.name.toLowerCase()?-1:1;
      if(an)return 1; if(bn)return -1;
      if(va!==vb)return dir==='asc'?va-vb:vb-va;
      return a.c.name.toLowerCase()<b.c.name.toLowerCase()?-1:1; // tie-break lower(name)
    }
    if(va!==vb)return dir==='asc'?(va<vb?-1:1):(va<vb?1:-1);
    return a.c.id<b.c.id?-1:1;
  });
  return arr.map(function(x){return x.c.id;});
}

function cJson(){return JSON.stringify(F.map(function(f){return{id:f.c.id,name:f.c.name,title:f.c.title,scr:f.c.scr,contract:f.c.contract,arrive:f.c.arrive,depart:f.c.depart};}));}
function mJson(){return JSON.stringify(ALLM.map(function(m){return{cid:m.cid,cli:m.cli,name:m.name,sd:m.sd,ed:m.ed||null,tjm:m.tjm||0,btype:m.btype,wmode:m.wmode||'rec',wdays:m.wdays||[1,2,3,4,5],manual_days:m.manualDays||[],deal:m.deal||0};}));}
var CJ=cJson(),MJ=mJson(),LJ='[]';

// Cas de page : [sort, dir, limit, offset] → ids attendus (tranche).
var PAGES=[
  {sort:'name', dir:'asc',  limit:10, offset:0},
  {sort:'ca',   dir:'desc', limit:3,  offset:0},
  {sort:'ca',   dir:'desc', limit:2,  offset:2},
  {sort:'marge',dir:'desc', limit:10, offset:0}
];
var pageParts=PAGES.map(function(pg,i){
  var full=sortIds(pg.sort,pg.dir);
  var slice=full.slice(pg.offset, pg.offset+pg.limit);
  var exp={total:F.length, ids:slice};
  return "select "+i+" caseid, '"+pg.sort+"/"+pg.dir+" o"+pg.offset+"' scope, "
    +"public.konsilys_consultant_kpis_page_agg('"+CJ+"'::jsonb,'"+MJ+"'::jsonb,'"+LJ+"'::jsonb,'"+ys+"'::date,'"+ye+"'::date,"+pg.limit+","+pg.offset+",null,'"+pg.sort+"','"+pg.dir+"') pg, "
    +"'"+JSON.stringify(exp)+"'::jsonb exp";
});

var sql=
"with top as (\n"+
"  select public.konsilys_top_clients_agg('"+CJ+"'::jsonb,'"+MJ+"'::jsonb,'"+LJ+"'::jsonb,'"+ys+"'::date,'"+ye+"'::date,3) k,\n"+
"    '"+JSON.stringify(topExp)+"'::jsonb exp\n"+
"),\n"+
"top_chk as (\n"+
"  select count(*) filter (where\n"+
"    coalesce(k->i->>'name','') is distinct from coalesce(exp->i->>'name','')\n"+
"    or round(coalesce((k->i->>'rev')::numeric,-1e9),4) is distinct from round(coalesce((exp->i->>'rev')::numeric,-1e9),4)\n"+
"  ) ecarts\n"+
"  from top, generate_series(0, greatest(jsonb_array_length(k),jsonb_array_length(exp))-1) i\n"+
"),\n"+
"pages(caseid,scope,pg,exp) as (\n  "+pageParts.join("\n  union all\n  ")+"\n),\n"+
"page_chk as (\n"+
"  select scope,\n"+
"    (pg->>'total')::int is distinct from (exp->>'total')::int as total_ko,\n"+
"    coalesce((select jsonb_agg(e->>'id' order by ord) from jsonb_array_elements(pg->'rows') with ordinality t(e,ord)),'[]'::jsonb)\n"+
"      is distinct from coalesce(exp->'ids','[]'::jsonb) as ids_ko\n"+
"  from pages\n"+
")\n"+
"select 'top clients' scope, (select ecarts from top_chk)::text detail\n"+
"union all\n"+
"select scope, ('total_ko='||total_ko||' ids_ko='||ids_ko) from page_chk;";
console.log(sql);
