
'use strict';

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   SUPABASE CONFIG - copiez les mêmes valeurs que dans esn_login.html
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
var SUPABASE_URL = 'https://rwmstlesxnglpblrurqj.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bXN0bGVzeG5nbHBibHJ1cnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjcyNTMsImV4cCI6MjA5NzEwMzI1M30.9SrsA1sYjdsqdPCnZ_sc2iTl01NKXsl7gAu2Y_VYgSQ';
/* Garde : si le CDN Supabase n'a pas pu être chargé (réseau), on dégrade
   proprement (sb=null) au lieu de planter toute l'app sur un ReferenceError. */
var sb = (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.indexOf('supabase.co') > 0)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/* Drapeau — agrégation KPI côté serveur (montée en charge, cf. docs/SCALE_100K.md).
   Désactivé par défaut : n'a AUCUN effet tant qu'il vaut false. Quand activé,
   loadSB() charge en plus un instantané d'agrégats exacts (effectifs/missions
   actifs, forfaits, effectif par BU) via la RPC company_kpi_snapshot, sans rien
   remplacer des KPIs calculés jour-par-jour côté client. */
var KPI_SERVER_AGG = false;
var SB_CID = null; // company_id de l'utilisateur connecté (rempli après auth)

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   DATE UTILITIES
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function pD(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function fD(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function nxt(s){var d=pD(s);d.setDate(d.getDate()+1);return fD(d);}
function addD(s,n){var d=pD(s);d.setDate(d.getDate()+n);return fD(d);}
function isWE(s){var w=pD(s).getDay();return w===0||w===6;}
function isWD(s,H){return !isWE(s)&&!H.has(s);}
function wDays(a,b,H){var n=0,c=a;while(c<=b){if(isWD(c,H))n++;c=nxt(c);}return n;}
function lvSet(cid,lvs,H,ys,ye){
  var S=new Set();
  lvs.filter(function(l){return l.cid===cid;}).forEach(function(l){
    var c=l.s<ys?ys:l.s,e=l.e>ye?ye:l.e;
    while(c<=e){if(isWD(c,H))S.add(c);c=nxt(c);}
  });
  return S;
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   FRENCH HOLIDAYS (Easter - Meeus/Jones/Butcher)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
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
var HOLS_N=['Jour de l\u2019An','Lundi de P\u00e2ques','F\u00eate du Travail','Victoire 1945','Ascension','Lundi de Pentec\u00f4te','F\u00eate Nationale','Assomption','Toussaint','Armistice','No\u00ebl'];

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   FISCAL YEAR  (1 oct \u2192 30 sept)
   FY26 = 1 oct 2025 \u2192 30 sept 2026
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function fyStart(fy){
  var m=((S&&S.settings&&S.settings.fyStartMonth)||10);
  var ms=String(m).padStart(2,'0');
  var sy=(m===1)?fy:(fy-1); /* FY janvier = même année; sinon année précédente */
  return sy+'-'+ms+'-01';
}
function fyEnd(fy){
  var m=((S&&S.settings&&S.settings.fyStartMonth)||10);
  var em=m===1?12:m-1;var ems=String(em).padStart(2,'0');
  var lastDay=new Date(fy,em,0).getDate(); /* dernier jour du mois em de l'année fy */
  return fy+'-'+ems+'-'+String(lastDay).padStart(2,'0');
}
function fyHols(fy){
  var h1=frHols(fy-1),h2=frHols(fy),c=new Set();
  h1.forEach(function(d){c.add(d);});
  h2.forEach(function(d){c.add(d);});
  return c;
}
function currentFY(){
  var d=new Date();
  var cm=d.getMonth()+1;
  var fm=((S&&S.settings&&S.settings.fyStartMonth)||10);
  if(fm===1)return d.getFullYear();
  return cm>=fm?d.getFullYear()+1:d.getFullYear();
}
var CFY=currentFY(); /* recalculé après chargement des settings dans loadSB */
var TODAY=(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}());
function fyLbl(fy){return 'FY'+String(fy).slice(2);}
function fyRange(fy){return 'oct. '+(fy-1)+' \u2192 sept. '+fy;}

/* \u2550\u2550\u2550 TRIMESTRES FISCAUX : Q1=Oct-D\u00e9c, Q2=Janv-Mars, Q3=Avr-Juin, Q4=Juil-Sept \u2550\u2550\u2550 */
/* QUARTERS : recalculé dynamiquement selon fyStartMonth (via rebuildQuarters()) */
var QUARTERS=[
  {id:1,lb:'T1',months:[10,11,12]},
  {id:2,lb:'T2',months:[1,2,3]},
  {id:3,lb:'T3',months:[4,5,6]},
  {id:4,lb:'T4',months:[7,8,9]}
];
var MOIS_ABR=['','Janv','F\u00e9vr','Mars','Avr','Mai','Juin','Juil','Ao\u00fbt','Sept','Oct','Nov','D\u00e9c'];
var LTYPES=['Cong\u00e9 pay\u00e9','RTT','Formation','Inter-contrat','Maladie','Cong\u00e9 maternit\u00e9','Cong\u00e9 sans solde','Mission interne','Autre'];
/* Reconstruire QUARTERS selon le mois de début du FY */
function rebuildQuarters(){
  var fm=((S&&S.settings&&S.settings.fyStartMonth)||10);
  /* Générer les 12 mois dans l'ordre fiscal */
  var ms=[];for(var i=0;i<12;i++)ms.push(((fm-1+i)%12)+1);
  QUARTERS=[
    {id:1,lb:'T1',months:[ms[0],ms[1],ms[2]]},
    {id:2,lb:'T2',months:[ms[3],ms[4],ms[5]]},
    {id:3,lb:'T3',months:[ms[6],ms[7],ms[8]]},
    {id:4,lb:'T4',months:[ms[9],ms[10],ms[11]]}
  ];
  QUARTERS.forEach(function(q){
    q.lbFull=q.lb+' ('+MOIS_ABR[q.months[0]]+'\u2013'+MOIS_ABR[q.months[2]]+')';
  });
}
rebuildQuarters(); /* initialisation par défaut */


/* Bornes ISO d'un trimestre donn\u00e9 \u00e0 l'int\u00e9rieur d'un exercice fiscal fy */
function qRange(fy,q){
  var qd=QUARTERS.find(function(x){return x.id===q;});
  if(!qd)return [fyStart(fy),fyEnd(fy)];
  var firstM=qd.months[0],lastM=qd.months[2];
  var firstY=firstM>=10?fy-1:fy;
  var lastY=lastM>=10?fy-1:fy;
  var lastDay=new Date(lastY,lastM,0).getDate();
  var s=firstY+'-'+String(firstM).padStart(2,'0')+'-01';
  var e=lastY+'-'+String(lastM).padStart(2,'0')+'-'+String(lastDay).padStart(2,'0');
  return [s,e];
}
/* P\u00e9riode actuellement s\u00e9lectionn\u00e9e dans la barre lat\u00e9rale : ann\u00e9e enti\u00e8re si S.quarter est null,
   sinon born\u00e9e au trimestre choisi. Utilis\u00e9e par Dashboard / KPIs / Absences. */
function curRange(fy){return S.quarter?qRange(fy,S.quarter):[fyStart(fy),fyEnd(fy)];}
function curRangeLbl(){return S.quarter?(QUARTERS.find(function(q){return q.id===S.quarter;})||{}).lbFull||'':'';}
/* Libell\u00e9 combin\u00e9 \u00ab FY26 \u00bb ou \u00ab FY26 \u00b7 T2 (Janv-Mars) \u00bb selon le trimestre actif */
function curLbl(){return fyLbl(S.year)+(S.quarter?' \u00b7 '+curRangeLbl():'');}
/* Mois fiscaux dans l'ordre Oct\u2192Sept, et bornes ISO d'un mois donn\u00e9 dans un FY */
/* Liste des mois \u00e0 afficher selon la s\u00e9lection courante (ann\u00e9e enti\u00e8re ou trimestre) */
function fEur(n){
  var cur=(S&&S.settings&&S.settings.currency)||'EUR';
  try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:cur,maximumFractionDigits:0}).format(n);}
  catch(e){return n.toFixed(0)+' '+((S&&S.settings&&S.settings.currencySymbol)||'€');}
}
function fDt(s){return s?pD(s).toLocaleDateString('fr-FR'):'Sans \u00e9ch\u00e9ance';}
function uid(){return Math.random().toString(36).slice(2,9);}
function fromT(n){var d=new Date();d.setDate(d.getDate()+n);return fD(d);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function gv(id){var el=document.getElementById(id);return el?el.value.trim():'';}
function dL(e){if(!e)return null;return Math.round((pD(e)-pD(TODAY))/86400000);}
function mSt(m){
  if(m.sd>TODAY)return'future';
  if(!m.ed)return'active';
  var d=dL(m.ed);
  if(d<0)return'ended';if(d<=14)return'critical';if(d<=30)return'soon';return'active';
}
function badge(st,dl){
  var mp={
    active:['bgrn','En mission'],critical:['bred','Fin imminente'],
    soon:['bamb','Fin proche'],future:['bblu','\u00c0 venir'],
    ended:['bgry','Termin\u00e9e'],none:['bgry','Sans mission']
  };
  if(st==='critical'&&dl!=null)mp.critical[1]='Fin J\u2212'+dl;
  if(st==='soon'&&dl!=null)mp.soon[1]='Fin J\u2212'+dl;
  var v=mp[st]||mp.none;
  return '<span class="badge '+v[0]+'">'+esc(v[1])+'</span>';
}
function av(name,sz){
  sz=sz||32;
  var init=(name||'?').split(' ').map(function(n){return n[0]||'';}).join('').slice(0,2).toUpperCase();
  return '<div class="av" style="width:'+sz+'px;height:'+sz+'px;font-size:'+(sz<30?11:13)+'px">'+init+'</div>';
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   KPI - MARGE = (TJM \u2212 SCR) / TJM × 100
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function kpi(c,miss,lvs,y,H,rangeOverride){
  var ys,ye;
  if(rangeOverride){ys=rangeOverride[0];ye=rangeOverride[1];}
  else{ys=fyStart(y);ye=fyEnd(y);}
  /* Borner sur la période d'activité réelle du consultant dans le FY */
  var cs=(c.arrive&&c.arrive>ys)?c.arrive:ys;
  var ce=(c.depart&&c.depart<ye)?c.depart:ye;
  var tWD=cs<=ce?wDays(cs,ce,H):0;
  var lds=lvSet(c.id,lvs,H,cs,ce);
  var lvD=lds.size,avD=tWD-lvD,bill=0,rev=0;

  /* Toutes les absences comptent dans le staffing (sauf Inter-contrat) */
  var sickSet=new Set();
  lvs.filter(function(l){return l.cid===c.id&&l.type!=='Inter-contrat';}).forEach(function(l){
    var a=l.s<cs?cs:l.s,b=l.e>ce?ce:l.e;
    while(a<=b){if(isWD(a,H))sickSet.add(a);a=nxt(a);}
  });
  var sickD=sickSet.size;
  var pm=miss.filter(function(m){return m.cid===c.id;}).map(function(m){
    var mS=m.sd<cs?cs:m.sd,mE=(!m.ed||m.ed>ce)?ce:m.ed;
    if(mS>mE)return Object.assign({},m,{days:0,rev:0,mar:0});
    var d=0;
    if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){
      /* Mode manuel : compter uniquement les jours explicitement sélectionnés */
      m.manualDays.forEach(function(day){
        if(day>=mS&&day<=mE&&!lds.has(day))d++;
      });
    }else{
      var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];
      var cur=mS;
      while(cur<=mE){if(isWD(cur,H)&&!lds.has(cur)&&wd.indexOf(pD(cur).getDay())>=0)d++;cur=nxt(cur);}
    }
    var r,mar;
    if(m.btype==='forfait'){
      var deal=+m.deal||0;
      var totD=m.ed?missWD(m,m.sd,m.ed,lvs):0;          /* jours travaill\u00e9s sur toute la mission */
      r=(m.ed&&totD>0)?deal*(d/totD):(m.ed?0:deal);     /* CA au prorata des jours ; sans date de fin \u2192 deal entier */
      mar=r>0?(r-d*c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/r*100:0;
    }else{
      r=d*m.tjm;
      mar=m.tjm>0?(m.tjm-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/m.tjm*100:0;
    }
    bill+=d;rev+=r;
    return Object.assign({},m,{days:d,rev:r,mar:mar});
  });
  var sr=tWD>0?(bill+sickD)/tWD*100:0,avgT=bill>0?rev/bill:0;
  var om=bill>0&&avgT>0?(avgT-c.scr*(c.contract==='freelance'?1:EMPLOYER_FACTOR))/avgT*100:null; /* freelance : pas de charges patronales */
  return{tWD:tWD,lvD:lvD,avD:avD,sickD:sickD,bill:bill,rev:rev,sr:sr,avgT:avgT,om:om,pm:pm,cs:cs,ce:ce};
}

/* \u2550\u2550\u2550 JOURS TRAVAILL\u00c9S sur une p\u00e9riode quelconque (jours coch\u00e9s, hors f\u00e9ri\u00e9s/cong\u00e9s) \u2550\u2550\u2550 */
function holRange(a,b){
  var sY=pD(a).getFullYear(),eY=pD(b).getFullYear(),HS=new Set();
  for(var y=sY-1;y<=eY;y++){frHols(y).forEach(function(d){HS.add(d);});}
  return HS;
}
function missWD(m,a,b,lvs){
  if(!a||!b||a>b)return 0;
  /* Mode manuel : compter uniquement les jours s\u00e9lectionn\u00e9s dans la plage a\u2192b */
  if(m.wmode==='man'&&m.manualDays&&m.manualDays.length){
    var HHm=holRange(a,b);
    var ldsm=lvSet(m.cid,lvs,HHm,a,b);
    return m.manualDays.filter(function(d){return d>=a&&d<=b&&!ldsm.has(d);}).length;
  }
  /* Mode r\u00e9current (d\u00e9faut) */
  var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];
  var HH=holRange(a,b);
  var lds=lvSet(m.cid,lvs,HH,a,b);
  var n=0,c=a;
  while(c<=b){if(isWD(c,HH)&&!lds.has(c)&&wd.indexOf(pD(c).getDay())>=0)n++;c=nxt(c);}
  return n;
}
/* \u2550\u2550\u2550 FORFAIT : budget de jours (selon marge cible + SCR), jours travaill\u00e9s, jours restants \u2550\u2550\u2550 */
function forfaitInfo(m,scr,lvs){
  var deal=+m.deal||0,tmar=(m.tmar!=null&&m.tmar!=='')?+m.tmar:0;
  var budget=scr>0?deal*(1-tmar/100)/scr:0;
  var end=(m.ed&&m.ed<TODAY)?m.ed:TODAY;
  var worked=missWD(m,m.sd,end,lvs);
  var left=budget-worked;
  /* jours réellement disponibles d'ici la date de fin (capacité restante) */
  var startAvail=m.sd>TODAY?m.sd:TODAY;
  var avail=m.ed?missWD(m,startAvail,m.ed,lvs):null;
  var slack=(avail!=null)?avail-left:null;
  return{deal:deal,tmar:tmar,budget:budget,worked:worked,left:left,avail:avail,slack:slack};
}

/* ═══ ACTIVITÉ JOUR PAR JOUR ═══ */
function missOnDay(cid,day){
  return S.miss.find(function(m){
    if(m.cid!==cid||m.sd>day||(m.ed&&day>m.ed))return false;
    if(m.wmode==='man'&&m.manualDays&&m.manualDays.length)
      return m.manualDays.indexOf(day)>=0;
    var wd=(m.wdays&&m.wdays.length)?m.wdays:[1,2,3,4,5];
    return wd.indexOf(pD(day).getDay())>=0;
  });
}
function leaveOnDay(cid,day){
  return S.lvs.find(function(l){return l.cid===cid&&l.s<=day&&day<=l.e;});
}
/* ═══ INTERCONTRATS — statut d'atterrissage d'un consultant ═══
   Renvoie {onMission, open, landing} au jour `today` (défaut : aujourd'hui) :
   - onMission : une mission couvre le jour (sd<=j et fin absente ou >=j) ;
   - open      : au moins une mission en cours/à venir SANS date de fin
                 → pas d'atterrissage prévisible ;
   - landing   : date d'atterrissage = fin la plus tardive des missions en
                 cours/à venir (null si aucune → en intercontrat, ou si open). */
function icStatus(c,miss,today){
  today=today||TODAY;
  var mine=(miss||[]).filter(function(m){return m.cid===c.id;});
  var onNow=mine.some(function(m){return m.sd<=today&&(!m.ed||m.ed>=today);});
  var cur=mine.filter(function(m){return !m.ed||m.ed>=today;});
  var open=cur.some(function(m){return !m.ed;});
  var landing=null;
  if(cur.length&&!open)landing=cur.reduce(function(mx,m){return m.ed>mx?m.ed:mx;},cur[0].ed);
  return {onMission:onNow,open:open,landing:landing};
}
/* Un consultant est-il en intercontrat au jour donné ? (actif dans l'effectif
   ET aucune mission ne couvre ce jour). Sert à la timeline semaine/mois. */
function icOnDay(c,miss,day){
  if(c.arrive&&c.arrive>day)return false;
  if(c.depart&&c.depart<day)return false;
  return !(miss||[]).some(function(m){return m.cid===c.id&&m.sd<=day&&(!m.ed||m.ed>=day);});
}
function shiftMonth(ym,delta){
  var p=ym.split('-'),dd=new Date(+p[0],+p[1]-1+delta,1);
  return dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0');
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   SAMPLE DATA
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* \u2500\u2500 Données réelles CGI Business Conseil \u2500\u2500 */
var IC=[];
var IM=[];
var IL=[];

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   STATE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
var S={
  tab:'kpis',
  cons:IC.map(function(c){return Object.assign({},c);}),
  miss:IM.map(function(m){return Object.assign({},m);}),
  lvs:IL.map(function(l){return Object.assign({},l);}),
  cands:[],
  staffOpps:[],   /* opportunités staffing (pilotage des intercontrats) */
  oppView:'week', /* granularité de la timeline intercontrats : 'week' | 'month' */
  approvals:[],   /* demandes d'approbation des consultants */
  consInvites:[], /* codes d'accès générés pour les consultants */
  adminCode:null, /* dernier code généré (affiché dans Admin) */
  year:CFY,quarter:null,modal:null,fmc:'all',fms:'all',fmt:'all',flc:'all',precs:{},
  role:'admin',dirName:'',consId:null,fdir:[],fexp:[],fsec:[],kpiSort:null,kpiSortAsc:false,kpiDirSort:null,kpiDirSortAsc:false,kpiDirOpen:{},invites:[],svpInvites:[],recruteurInvites:[],vpDirMap:{},vpName:'',profileFirstName:'',profileLastName:'',profileTitle:'',fvp:[],settings:{currency:'EUR',currencySymbol:'€',fyStartMonth:10,fyStartDay:1,roleLabels:{},hasBusinessModule:false,hasRecrutementModule:false},kpiVPOpen:{},kpiDirDirOpen:{},actCid:'',actMonth:'',_all:null,leaveApprovalRole:'super_admin',allInvites:[],managerId:null,approvalDelegateTo:null,approvalDelegateUntil:null,orgProfiles:[],
  /* CRM Business */
  bizTab:'pipeline',bizAccounts:[],bizContacts:[],bizOpps:[],bizActivities:[],bizApprovals:[],bizModal:null,bizFilter:{status:'all',account:'',exp:''},
  sbSt:'\uD83D\uDFE2 Sauvegarde locale active',
  sbSync:false,
  imp:null,
  impHistory:[],
  impSelFY:'all',
  missImp:null,
  recSel:null,recF:{status:'all',q:'',loc:[],rec:'all',mine:true,exp:[]},recAddMeet:false,recAddCgi:false,recAddCv:false,
  recEditMeetId:null,recEditCgiId:null,
  activityLog:[]
};
var H=fyHols(CFY);

/* ══════════════════════════════════════════════════════════════════════════
   MODE DÉMO — données fictives pour présentation commerciale
══════════════════════════════════════════════════════════════════════════ */
function loadDemoData(){
  S.demo=true;
  S._userEmail='demo@esn-manager.fr';
  S.role='admin';
  S.year=2026;
  S.quarter=null;
  S.tab=S.role==='utilisateur'?'activite':S.role==='recruteur'?'recrutement':S.role==='sales'?'business':'kpis';
  S.cons=[
    {id:'d1',name:'Sophie Martin',   title:'Consultante Senior',scr:520,email:'s.martin@demo.fr',   dir:'Thomas Bernard',arrive:'2024-10-01',depart:null},
    {id:'d2',name:'Lucas Dupont',    title:'Architecte Cloud',  scr:610,email:'l.dupont@demo.fr',   dir:'Thomas Bernard',arrive:'2024-10-01',depart:null},
    {id:'d3',name:'Inès Rousseau',   title:'Data Engineer',     scr:480,email:'i.rousseau@demo.fr', dir:'Marie Lefebvre',arrive:'2025-01-06',depart:null},
    {id:'d4',name:'Karim Belhaj',    title:'Chef de projet',    scr:560,email:'k.belhaj@demo.fr',   dir:'Marie Lefebvre',arrive:'2024-10-01',depart:null},
    {id:'d5',name:'Claire Morin',    title:'Développeuse BI',   scr:450,email:'c.morin@demo.fr',    dir:'Thomas Bernard',arrive:'2025-04-01',depart:null}
  ];
  /* Format aligné sur mapM (cli/name/btype/wdays…) pour un rendu correct partout. */
  S.miss=[
    {id:'m1',cid:'d1',cli:'BNP Paribas',       name:'TMA SI Risques',   pcode:'300100001',tjm:780,sd:'2025-10-01',ed:'2026-03-31',btype:'at',     wdays:[1,2,3,4,5]},
    {id:'m2',cid:'d2',cli:'Société Générale',  name:'Migration Cloud',  pcode:'300100002',tjm:920,sd:'2025-10-01',ed:'2026-09-30',btype:'at',     wdays:[1,2,3,4,5]},
    {id:'m3',cid:'d3',cli:'AXA',               name:'Data Platform',    pcode:'300100003',tjm:720,sd:'2025-10-01',ed:'2026-06-30',btype:'at',     wdays:[1,2,3,4,5]},
    {id:'m4',cid:'d4',cli:'SNCF',              name:'Pilotage forfait', pcode:'300100004',tjm:840,sd:'2025-10-01',ed:'2026-03-31',btype:'forfait',deal:180000,wdays:[1,2,3,4,5]},
    {id:'m5',cid:'d5',cli:'TotalEnergies',     name:'Reporting BI',     pcode:'300100005',tjm:680,sd:'2025-10-01',ed:'2026-09-30',btype:'at',     wdays:[1,2,3,4,5]},
    {id:'m6',cid:'d1',cli:'BNP Paribas',       name:'Phase 2 Risques',  pcode:'300100006',tjm:800,sd:'2026-04-01',ed:'2026-09-30',btype:'at',     wdays:[1,2,3,4,5]}
  ];
  S.lvs=[
    {id:'v1',cid:'d1',type:'Congé payé',s:'2025-12-22',e:'2026-01-03'},
    {id:'v2',cid:'d2',type:'RTT',       s:'2025-11-10',e:'2025-11-10'},
    {id:'v3',cid:'d3',type:'Congé payé',s:'2026-02-17',e:'2026-02-21'},
    {id:'v4',cid:'d4',type:'Maladie',   s:'2026-01-13',e:'2026-01-17'},
    {id:'v5',cid:'d5',type:'RTT',       s:'2025-12-29',e:'2025-12-31'}
  ];
  S.cands=[
    {id:'c1',name:'Maxime Guillot',expertise:['React','TypeScript'],sectors:['Banque & Finance'],locations:['Lyon'],nationality:'Française',reqSalary:48000,yearsExp:4,status:'entretien',marginPct:28,createdBy:'demo',feedbacks:[],cgiMeetings:[],cvFiles:[]}
  ];
  H=fyHols(2026);
}
var SCR_FACTOR=113.35;   /* SCR × coeff = salaire brut annuel employé */
var EMPLOYER_FACTOR=1.25; /* Charges patronales : coût réel employeur = brut × 1.25 */

/* Statuts recrutement — modifiables par le Super Admin */
var _DEFAULT_REC_STATUS=[
  {id:'rh_a',      lb:'A rencontrer RH',           bg:'#eff6ff',fg:'#1e40af'},
  {id:'rh_ec',     lb:'En cours de rencontre RH',  bg:'#dbeafe',fg:'#1d4ed8'},
  {id:'op_a',      lb:'A rencontrer OP',            bg:'#fff7ed',fg:'#c2410c'},
  {id:'op_ec',     lb:'En cours de rencontre OP',   bg:'#ffedd5',fg:'#ea580c'},
  {id:'nogo_cand', lb:'NoGo candidat',              bg:'#fce7f3',fg:'#9d174d'},
  {id:'nogo',      lb:'NoGo',                       bg:'#fee2e2',fg:'#b91c1c'},
  {id:'pipe',      lb:'Pipe',                       bg:'#ede9fe',fg:'#5b21b6'},
  {id:'recrute',   lb:'Recruté',               bg:'#d1fae5',fg:'#065f46'}
];
var REC_STATUS=_DEFAULT_REC_STATUS.slice();
function applyRecStatuses(){
  if(S.settings&&S.settings.recStatuses&&S.settings.recStatuses.length){
    REC_STATUS=S.settings.recStatuses;
  }else{
    REC_STATUS=_DEFAULT_REC_STATUS.slice();
  }
}
/* Label d'un statut — lit dans REC_STATUS courant (peut être custom) */
function recStLb(id){var s=REC_STATUS.find(function(x){return x.id===id;});return s?s.lb:id;}
function recStLbD(id){return recStLb(id);}
/* Label avec renommage custom (retro-compat) — délègue à recStLb */
function recStCol(id){var s=REC_STATUS.find(function(x){return x.id===id;});return s?[s.bg,s.fg]:['#f1f5f9','#475569'];}
function recScr(sal){return sal>0?sal/SCR_FACTOR:0;}
function recTjm(sal,mar){var scr=recScr(sal);return scr>0?scr/(1-(mar||25)/100):0;}

/* \u2550\u2550\u2550 RECRUTEMENT : listes pr\u00e9d\u00e9finies (Expertises + Secteurs), tri\u00e9es alphab\u00e9tiquement (FR) \u2550\u2550\u2550 */
var EXPERTISE_LIST=[
  '.NET','Agile / Scrum','AI / Machine Learning','Angular','Architecture logicielle','AWS',
  'Azure','Big Data','Blockchain','Business Analyst','C#','C++','Change Management',
  'Cloud Computing','COBOL','Cybers\u00e9curit\u00e9','Data Engineering','Data Science','DevOps',
  'Docker','Finance','GCP (Google Cloud)','Gestion de portefeuille','Gestion de projet',
  'Gestion des risques','Go','ITIL','Java','JavaScript','Kotlin','Kubernetes','Linux',
  'Marketing digital','Microservices','MuleSoft','Node.js','Oracle','PHP','Power BI','PMP',
  'Product Management','Python','QA / Tests logiciels','React','Ressources Humaines','Ruby',
  'Salesforce','SAP','Scrum Master','SEO / SEA','SQL','Strat\u00e9gie d\u2019entreprise','Supply Chain',
  'Swift','Terraform','Transformation digitale','TypeScript','UX / UI Design','VBA','Vue.js'
].sort(function(a,b){return a.localeCompare(b,'fr');});

var SECTOR_LIST=[
  'A\u00e9ronautique & D\u00e9fense','Agroalimentaire','Assurance','Automobile','Banque & Finance',
  'BTP & Construction','Distribution & Retail','\u00c9nergie','Industrie / Manufacturing','Luxe',
  'M\u00e9dias & T\u00e9l\u00e9communications','Pharma & Sant\u00e9','Public / Administration','Services',
  'Tourisme & H\u00f4tellerie','Transport & Logistique'
].sort(function(a,b){return a.localeCompare(b,'fr');});

var REC_LOCATIONS=['Lyon','Grenoble','Clermont-Ferrand','Dijon'];

/* Grandes villes de France (fiche candidat : localisation cible / secondaires,
   avec recherche). Liste triée alphabétiquement. */
var FR_CITIES=['Aix-en-Provence','Ajaccio','Amiens','Angers','Annecy','Antibes','Argenteuil','Avignon',
  'Bayonne','Besançon','Biarritz','Bordeaux','Boulogne-Billancourt','Bourges','Brest','Caen','Cannes',
  'Chambéry','Clermont-Ferrand','Colmar','Créteil','Dijon','Dunkerque','Grenoble','La Rochelle','Le Havre',
  'Le Mans','Lille','Limoges','Lorient','Lyon','Marseille','Metz','Montpellier','Mulhouse','Nancy','Nantes',
  'Nice','Nîmes','Niort','Orléans','Paris','Pau','Perpignan','Poitiers','Quimper','Reims','Rennes','Roubaix',
  'Rouen','Saint-Étienne','Saint-Nazaire','Strasbourg','Toulon','Toulouse','Tours','Troyes','Valence',
  'Vannes','Versailles','Villeurbanne'].sort(function(a,b){return a.localeCompare(b,'fr');});

/* Régions (villes de mobilité des consultants) : définies par le super_admin
   dans les Paramètres. Stockées dans S.settings.regions = [{id,name,cities:[]}]. */
function regionNodes(){return (S.settings&&S.settings.regions)||[];}
function regionByName(nm){if(!nm)return null;return regionNodes().find(function(r){return r.name===nm;})||null;}
function regionCities(nm){var r=regionByName(nm);return (r&&r.cities)||[];}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   SVG BAR CHART
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function svgBars(items,cfn,unit){
  var n=items.length;if(!n)return '';
  var h=185,pad=32;
  var max=Math.max.apply(null,items.map(function(d){return d.v;}).concat([1]));
  var cw=100/n,bw=cw*0.55,trackH=h-pad-20;
  var bars=items.map(function(d,i){
    var bh=Math.max(2,d.v/max*trackH);
    var x=i*cw+cw*0.225,y=h-pad-bh;
    var fill=cfn?cfn(d.v):'#3b82f6';
    var lbl=unit==='%'?d.v.toFixed(0)+'%':unit==='k'?d.v.toFixed(1)+'k\u20ac':String(d.v);
    return '<rect x="'+x+'%" y="'+y+'" width="'+bw+'%" height="'+bh+'" fill="'+fill+'" rx="3"/>'
      +'<text x="'+(x+bw/2)+'%" y="'+(h-pad+13)+'" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">'+esc(d.n)+'</text>'
      +'<text x="'+(x+bw/2)+'%" y="'+(y-4)+'" text-anchor="middle" font-size="10" fill="#374151" font-weight="600" font-family="system-ui">'+lbl+'</text>';
  }).join('');
  return '<svg width="100%" height="'+h+'" style="display:block;overflow:visible">'+bars+'</svg>';
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   HELPERS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function getAct(cid){
  return S.miss.find(function(m){var s=mSt(m);return m.cid===cid&&(s==='active'||s==='critical'||s==='soon');});
}
/* Consultant ayant quitté l'entreprise avant aujourd'hui */
function isGone(c){return !!(c.depart&&c.depart<TODAY);}
/* Absence active aujourd'hui (hors inter-contrat) */
function getActiveLv(cid){
  return S.lvs.find(function(l){
    return l.cid===cid&&l.type!=='Inter-contrat'&&l.s<=TODAY&&l.e>=TODAY;
  });
}
/* ── Libellé d'un rôle (avec personnalisation via Paramètres SVP) ── */
var _ROLE_DEFAULTS={
  'super_admin':'Super Admin',
  'admin':'Admin',
  'gestionnaire':'Gestionnaire',
  'utilisateur':'Utilisateur',
  'recruteur':'Recruteur',
  'sales':'Business Manager'
};
function rLabel(role){
  var custom=S.settings&&S.settings.roleLabels&&S.settings.roleLabels[role];
  return custom||_ROLE_DEFAULTS[role]||role;
}

function buildKS(){
  /* Cache par render — évite de recalculer pour chaque template */
  if(S._ks&&S._ks._valid)return S._ks.data;
  var _rng=S.quarter?curRange(S.year):null;
  /* On ne compte que les consultants présents durant la période sélectionnée :
     un consultant qui arrive après la fin de la période (pas encore embauché sur
     l'exercice) ou parti avant son début ne doit ni figurer dans les KPIs ni peser
     sur le taux de staffing — sinon un futur arrivant à 0 % fausse la moyenne de
     l'année. Même règle de présence que l'onglet Équipe. */
  var _pS=_rng?_rng[0]:fyStart(S.year);
  var _pE=_rng?_rng[1]:fyEnd(S.year);
  var _present=function(c){
    if(c.arrive&&c.arrive>_pE)return false;
    if(c.depart&&c.depart<_pS)return false;
    return true;
  };
  var data=S.cons.filter(_present).map(function(c){return{c:c,k:kpi(c,S.miss,S.lvs,S.year,H,_rng)};});
  S._ks={data:data,_valid:true};
  return data;
}
function clientRev(ks){
  var map={};
  ks.forEach(function(x){x.k.pm.forEach(function(m){if(m.days>0){map[m.cli]=(map[m.cli]||0)+m.rev;}});});
  return Object.keys(map).map(function(k){return{name:k,rev:map[k]};}).sort(function(a,b){return b.rev-a.rev;});
}

/* ═══ PÉRIMÈTRE DE VISIBILITÉ — DOCTRINE UNIQUE ═══
   Trois couches, chacune à sa place, pour éviter que les onglets divergent :
   1. Cloisonnement par Business Unit → AU NIVEAU BASE (RLS). Un compte rattaché à
      une BU ne LIT déjà que sa BU + les fiches non rattachées (cf.
      business_units_rls_bu_scope.sql). S.cons/S.miss/S.lvs arrivent donc déjà
      filtrés par BU — on ne duplique PAS ce filtre côté client.
   2. Périmètre par rôle / sélection → consInScope(c) : LA définition canonique de
      « ce consultant fait-il partie de mon périmètre ». visibleConsIds()/
      visibleData() s'en servent pour bâtir la vue ; TOUTES les vues consomment ce
      même périmètre (KPIs, missions, planning, absences…).
   3. Masquage des supérieurs → consIsAboveMe(c), appliqué EN PLUS par les vues
      « équipe » via consInTeamScope(c) : on ne montre pas la hiérarchie au-dessus
      de soi (ex. le salaire de son patron).
   NB : le prévisionnel KPI agrège par nœud BU (vue « par unité ») — cohérent car
   alimenté par les mêmes données déjà filtrées en (1).
   Rappel : les données maîtres restent dans S._all (sauvegarde/mutations). */
function consInScope(c){
  if(!c)return false;
  if(S.role==='gestionnaire')return c.managerId===S._userId || (!c.managerId && (c.dir||'')===S.dirName) || c.id===S.consId;
  if(S.role==='utilisateur'||S.role==='sales'||S.role==='recruteur')return c.id===S.consId||c.email===S._userEmail;
  if(S.role==='super_admin'&&S.fvp&&S.fvp.length){
    /* Filtre par VP sélectionné : directeurs rattachés aux VPs cochés. */
    var allowedDirs=[];
    S.fvp.forEach(function(vpName){((S.vpDirMap||{})[vpName]||[]).forEach(function(d){if(allowedDirs.indexOf(d)<0)allowedDirs.push(d);});});
    return allowedDirs.length?allowedDirs.indexOf(c.dir||'')>=0:true;
  }
  if(S.fdir&&S.fdir.length)return S.fdir.indexOf(c.dir||'')>=0; /* admin : filtre directeur sélectionné */
  return true; /* admin / super_admin sans filtre : tout le périmètre déjà chargé */
}
/* Périmètre « équipe » : le périmètre visible MOINS ses supérieurs hiérarchiques. */
function consInTeamScope(c){return consInScope(c)&&!consIsAboveMe(c);}

function visibleConsIds(){
  var base=(S._all&&S._all.cons)||S.cons;
  var s={};base.forEach(function(c){if(consInScope(c))s[c.id]=1;});return s;
}
function visibleData(){
  var ids=visibleConsIds(),src=S._all||{cons:S.cons,miss:S.miss,lvs:S.lvs};
  return{
    cons:src.cons.filter(function(c){return ids[c.id];}),
    miss:src.miss.filter(function(m){return ids[m.cid];}),
    lvs:src.lvs.filter(function(l){return ids[l.cid];})
  };
}


/* ═══ BUSINESS UNITS (hiérarchie) ═══
   Arbre stocké dans S.settings.buTree : [{id, name, parentId}]. Racine = parentId
   nul/absent. Profondeur limitée à 6 niveaux côté UI (ex : Monde > Europe >
   France > AURA > Lyon > Équipe 1). bu_id d'un membre = id d'un nœud. */
function buNodes(){return (S.settings&&S.settings.buTree)||[];}
function buById(id){if(!id)return null;return buNodes().find(function(n){return n.id===id;})||null;}
function buChildren(pid){return buNodes().filter(function(n){return (n.parentId||null)===(pid||null);});}
function buPath(id){var out=[],guard=0,n=buById(id);while(n&&guard<12){out.unshift(n);n=n.parentId?buById(n.parentId):null;guard++;}return out;}
function buLevel(id){return buPath(id).length;}
function buLabel(id){var n=buById(id);return n?n.name:'';}
function buPathLabel(id){var p=buPath(id);return p.length?p.map(function(n){return n.name;}).join(' › '):'';}

/* Permissions équipe / BU des consultants.
   - Rattachement d'équipe (directeur / N+1) : grade gestionnaire et au-dessus.
   - BU d'un consultant : uniquement son N+1 (gestionnaire direct) ; admin et
     super_admin sont au-dessus de la hiérarchie et peuvent donc aussi. */
function canEditTeam(){return ['gestionnaire','admin','super_admin'].indexOf(S.role)>=0;}
function mgrAccountByName(nm){nm=(nm||'').trim().toLowerCase();if(!nm)return null;return (S.orgProfiles||[]).find(function(p){return ((p.first_name||'')+' '+(p.last_name||'')).trim().toLowerCase()===nm;})||null;}
function isConsMyReport(c){
  if(!c)return false;
  if(S.role==='admin'||S.role==='super_admin')return true;
  if(S.role==='gestionnaire')return c.managerId===S._userId || (!!S.dirName && (c.dir||'')===S.dirName);
  return false;
}

/* BU d'un consultant : BU stockée sur la fiche si présente, sinon via le profil
   lié (cons_id), sinon via son directeur (gestionnaire) s'il a une BU. */
/* BU (niveau le plus fin) de l'utilisateur connecté, d'après son profil. */
function myBuId(){
  var p=(S.orgProfiles||[]).find(function(x){return x.id===S._userId;});
  return (p&&p.bu_id)||null;
}
/* Visibilité d'un candidat selon le rôle :
   - recruteur & super_admin : tous les candidats de l'entreprise ;
   - business manager (sales) : tous, uniquement si le module Recrutement est activé ;
   - gestionnaire & admin : candidats de leur unité (BU) et de ses sous-unités.
   Sans unité configurée pour l'utilisateur, aucune restriction (repli). */
function candVisibleForRole(c){
  if(S.role==='recruteur'||S.role==='super_admin')return true;
  if(S.role==='sales')return !!(S.settings&&S.settings.hasRecrutementModule);
  if(S.role==='admin'||S.role==='gestionnaire'){
    var my=myBuId();
    if(!my)return true;
    var cb=c&&c.buId;
    if(!cb)return false;
    return buPath(cb).some(function(n){return n.id===my;});
  }
  return true;
}
/* memberId est-il un subordonné hiérarchique (N+1 transitif) de ancestorId ? */
function isHierDescendant(memberId,ancestorId){
  if(!memberId||!ancestorId)return false;
  var byId={};(S.orgProfiles||[]).forEach(function(x){byId[x.id]=x;});
  var cur=byId[memberId],guard=0;
  while(cur&&cur.manager_id&&guard<20){
    if(cur.manager_id===ancestorId)return true;
    cur=byId[cur.manager_id];guard++;
  }
  return false;
}
/* Qui peut modifier l'unité (BU) d'un membre — miroir exact du RPC set_member_bu :
   super_admin = tout le monde (soi compris) ; admin = ses subordonnés non-admin ;
   autres rôles = personne. */
function canEditMemberBU(p){
  if(!p)return false;
  if(S.role==='super_admin')return true;
  if(S.role==='admin'){
    if(p.id===S._userId)return false;
    if(p.role==='admin'||p.role==='super_admin')return false;
    return isHierDescendant(p.id,S._userId);
  }
  return false;
}
function consBU(c){
  if(!c)return null;
  if(c.buId)return c.buId;
  var pr=(S.orgProfiles||[]).find(function(p){return p.cons_id===c.id&&p.bu_id;});
  if(pr)return pr.bu_id;
  var dn=(c.dir||'').trim().toLowerCase();
  if(dn){
    var mgr=(S.orgProfiles||[]).find(function(p){return p.bu_id&&((p.first_name||'')+' '+(p.last_name||'')).trim().toLowerCase()===dn;});
    if(mgr)return mgr.bu_id;
  }
  return null;
}

/* ═══ RÔLE & HIÉRARCHIE D'UNE FICHE CONSULTANT ═══
   Le rôle (super_admin / admin / gestionnaire / sales / recruteur / utilisateur)
   vit sur le compte (profiles / S.orgProfiles), la fiche vit dans S.cons. On relie
   une fiche à son compte par cons_id, sinon par nom. */
function consProfile(c){
  if(!c)return null;
  var p=(S.orgProfiles||[]).find(function(x){return x.cons_id===c.id;});
  if(p)return p;
  var nm=(c.name||'').trim().toLowerCase();
  if(nm)return (S.orgProfiles||[]).find(function(x){return ((x.first_name||'')+' '+(x.last_name||'')).trim().toLowerCase()===nm;})||null;
  return null;
}
/* Rôle effectif d'une fiche : rôle du compte lié, « utilisateur » par défaut
   (fiche sans compte : consultant importé, freelance non provisionné…). */
function consRole(c){var p=consProfile(c);return (p&&p.role)||'utilisateur';}
/* La fiche c correspond-elle au compte connecté ? */
function consIsSelf(c){
  if(!c)return false;
  if(S.consId&&c.id===S.consId)return true;
  var p=consProfile(c);
  return !!(p&&p.id===S._userId);
}
/* La fiche c reporte-t-elle (N+1 transitif) au compte ancestorPid ? On part du N+1
   de la fiche (compte lié, sinon managerId de la fiche) puis on remonte la chaîne
   manager_id des profils. */
function consReportsToAccount(c,ancestorPid){
  if(!c||!ancestorPid)return false;
  var cp=consProfile(c);
  var cur=(cp&&cp.manager_id)||c.managerId||null;
  var byId={};(S.orgProfiles||[]).forEach(function(x){byId[x.id]=x;});
  var guard=0;
  while(cur&&guard<20){
    if(cur===ancestorPid)return true;
    cur=byId[cur]?byId[cur].manager_id:null;guard++;
  }
  return false;
}
/* Le compte connecté est-il le propriétaire au sommet ? (super_admin sans N+1) */
function isRootOwner(){
  if(S.role!=='super_admin')return false;
  var p=(S.orgProfiles||[]).find(function(x){return x.id===S._userId;});
  return !(p&&p.manager_id);
}
/* Périmètre « équipe » de l'utilisateur connecté : lui-même + tous ses subordonnés
   (N+1 transitif). Le propriétaire voit tout ; tout compte ayant un N+1 (y compris
   un Sénior VP rattaché à un autre) ne voit que sa descendance — jamais sa
   hiérarchie au-dessus (donc ni le salaire de son patron). Repli legacy : fiches
   rattachées par nom de directeur (dir === mon nom) sans manager_id. */
function consInMyTeam(c){
  if(!c)return false;
  if(isRootOwner())return true;
  if(consIsSelf(c))return true;
  if(consReportsToAccount(c,S._userId))return true;
  if(!c.managerId&&S.dirName&&(c.dir||'')===S.dirName)return true;
  return false;
}
/* Le compte lié à la fiche c est-il un supérieur hiérarchique (ancêtre) du compte
   connecté ? Sert à masquer, dans l'Équipe, les personnes SITUÉES AU-DESSUS de soi
   (ex. son patron et son salaire) sans restreindre le reste de la visibilité — on
   part donc de ce que l'utilisateur voit déjà (visibleConsIds) et on n'en retire
   QUE ses supérieurs. Une fiche sans compte lié n'est jamais « au-dessus ». */
function consIsAboveMe(c){
  var p=consProfile(c);
  if(!p||p.id===S._userId)return false;
  return isHierDescendant(S._userId,p.id);
}
/* Rang de tri par grade : Manager < Sénior < Confirmé < Junior. Business Manager
   en tête, grades inconnus en fin. */
function gradeRank(g){
  g=(g||'').toString().toLowerCase();
  if(g.indexOf('business')>=0)return 0;
  if(g.indexOf('manager')>=0)return 1;
  if(g.indexOf('senior')>=0||g.indexOf('sénior')>=0)return 2;
  if(g.indexOf('confirm')>=0)return 3;
  if(g.indexOf('junior')>=0)return 4;
  return 5;
}

/* État vide illustré et cohérent (icône + titre + sous-texte + CTA optionnel).
   Remplace les placeholders « .emp » ternes sur les écrans clés. */
function tEmpty(icon,title,sub,ctaHtml){
  return '<div style="text-align:center;padding:48px 24px;display:flex;flex-direction:column;align-items:center;gap:6px">'
    +'<div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#eef7dd,#e2f0cf);display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:8px;box-shadow:inset 0 0 0 1px rgba(132,204,22,.25)">'+icon+'</div>'
    +'<div style="font-size:15px;font-weight:800;color:#0f172a;letter-spacing:-.01em">'+esc(title)+'</div>'
    +'<div style="font-size:13px;color:#94a3b8;max-width:360px;line-height:1.55">'+esc(sub||'')+'</div>'
    +(ctaHtml?'<div style="margin-top:12px">'+ctaHtml+'</div>':'')
    +'</div>';
}

/* Notification légère et non bloquante (confirmation d'enregistrement, erreur…).
   toast('Unité enregistrée')  ·  toast('Échec…','error') */
function toast(msg,type){
  var box=document.getElementById('toasts');
  if(!box){box=document.createElement('div');box.id='toasts';
    box.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none';
    document.body.appendChild(box);}
  var ok=type!=='error';
  var t=document.createElement('div');
  t.setAttribute('role','status');
  t.style.cssText='pointer-events:auto;display:flex;align-items:center;gap:8px;background:'+(ok?'#1B2B3A':'#7f1d1d')+';color:#fff;font-size:13px;font-weight:600;padding:10px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(2,6,23,.28);opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;max-width:90vw';
  t.innerHTML='<span style="font-size:15px">'+(ok?'✅':'⚠️')+'</span><span>'+esc(msg)+'</span>';
  box.appendChild(t);
  requestAnimationFrame(function(){t.style.opacity='1';t.style.transform='none';});
  setTimeout(function(){t.style.opacity='0';t.style.transform='translateY(8px)';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},240);},2400);
}

/* ══════════════════════════════════════════════════════════════
   THÈME SOMBRE — moteur de transformation des couleurs INLINE
   ══════════════════════════════════════════════════════════════
   Les templates produisent des couleurs claires codées en dur. Une feuille CSS
   ne peut pas surcharger un style inline ; on transforme donc chaque couleur
   inline SELON SON RÔLE (la propriété CSS) :
     • color        → toujours rendu clair et lisible ;
     • background   → toujours rendu sombre ;
     • bordure      → sombre discrète ;
     • accents saturés (lime, rouge, ambre, bleu) → teinte préservée, luminosité
       ajustée pour le contraste.
   Cela lève l'ambiguïté #fff-texte / #fff-fond sans migration manuelle. Les
   couleurs passant déjà par var(--x) sont gérées par les tokens [data-theme=dark]. */
var _themeCache={};
function isDark(){return document.documentElement.getAttribute('data-theme')==='dark';}
function _cparse(c){
  if(!c)return null;c=(''+c).trim().toLowerCase();var m;
  if(m=c.match(/^#([0-9a-f]{3})$/))return{r:parseInt(m[1][0]+m[1][0],16),g:parseInt(m[1][1]+m[1][1],16),b:parseInt(m[1][2]+m[1][2],16),a:1};
  if(m=c.match(/^#([0-9a-f]{6})$/))return{r:parseInt(m[1].substr(0,2),16),g:parseInt(m[1].substr(2,2),16),b:parseInt(m[1].substr(4,2),16),a:1};
  if(m=c.match(/^rgba?\(([^)]+)\)$/)){var p=m[1].split(',').map(function(x){return parseFloat(x);});return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
  return null;
}
function _rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h,s,l=(mx+mn)/2;if(mx===mn){h=s=0;}else{var d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h/=6;}return[h,s,l];}
function _hsl2rgb(h,s,l){var r,g,b;function hue(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}if(s===0){r=g=b=l;}else{var q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;r=hue(p,q,h+1/3);g=hue(p,q,h);b=hue(p,q,h-1/3);}return{r:r*255,g:g*255,b:b*255};}
function _cfmt(o){o.r=Math.max(0,Math.min(255,Math.round(o.r)));o.g=Math.max(0,Math.min(255,Math.round(o.g)));o.b=Math.max(0,Math.min(255,Math.round(o.b)));return o.a<1?'rgba('+o.r+','+o.g+','+o.b+','+o.a+')':'rgb('+o.r+','+o.g+','+o.b+')';}
function darkColor(c,role){
  var key=role+'|'+c;if(_themeCache[key]!==undefined)return _themeCache[key];
  var o=_cparse(c);if(!o){_themeCache[key]=c;return c;}
  var hsl=_rgb2hsl(o.r,o.g,o.b),h=hsl[0],s=hsl[1],l=hsl[2];
  var spread=Math.abs(o.r-o.g)+Math.abs(o.g-o.b)+Math.abs(o.r-o.b);
  var out,nl,ns=s;
  if(s>0.28&&spread>60){
    /* Accent saturé : garder teinte, ajuster luminosité selon le rôle. */
    if(role==='text'){nl=Math.max(l,0.62);}
    else if(role==='bg'){nl=Math.min(l,0.32);ns=Math.min(s,0.6);}
    else{nl=Math.min(Math.max(l,0.34),0.5);}
  }else{
    /* Neutre : luminosité pilotée par le rôle, très légère teinte conservée. */
    if(role==='text'){nl=Math.max(1-l,0.60);}
    else if(role==='bg'){nl=Math.min(1-l,0.13);}
    else{nl=0.24;}
    ns=Math.min(s,0.14);
  }
  var rr=_hsl2rgb(h,ns,nl);out={r:rr.r,g:rr.g,b:rr.b,a:o.a};
  var res=_cfmt(out);_themeCache[key]=res;return res;
}
/* Applique la transformation sombre aux couleurs inline d'une racine DOM. */
function themify(root){
  if(!root||!isDark())return;
  var els=root.querySelectorAll('[style]'),i,st;
  for(i=0;i<els.length;i++){
    st=els[i].style;
    if(st.color)st.color=darkColor(st.color,'text');
    if(st.backgroundColor)st.backgroundColor=darkColor(st.backgroundColor,'bg');
    if(st.borderTopColor)st.borderTopColor=darkColor(st.borderTopColor,'border');
    if(st.borderRightColor)st.borderRightColor=darkColor(st.borderRightColor,'border');
    if(st.borderBottomColor)st.borderBottomColor=darkColor(st.borderBottomColor,'border');
    if(st.borderLeftColor)st.borderLeftColor=darkColor(st.borderLeftColor,'border');
    if(st.backgroundImage&&st.backgroundImage.indexOf('gradient')>=0){
      st.backgroundImage=st.backgroundImage.replace(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g,function(m){return darkColor(m,'bg');});
    }
  }
}
/* Bascule clair / sombre (persistée). */
function setTheme(mode){
  document.documentElement.setAttribute('data-theme',mode);
  try{localStorage.setItem('theme',mode);}catch(e){}
}
function toggleTheme(){setTheme(isDark()?'light':'dark');}
