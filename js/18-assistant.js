/* ═══════════════════════════════════════════════════════════════════════════
   ASSISTANT — « Crée-moi une mission pour X du … au … à … € »
   100 % LOCAL : la phrase est analysée dans le navigateur par des règles
   (intention, consultant, client, dates en français, montants). AUCUNE donnée
   n'est envoyée à un service externe (pas d'IA tierce).
   L'assistant produit des ACTIONS PROPOSÉES affichées en cartes ; rien n'est
   écrit tant que l'utilisateur n'a pas cliqué « Créer ». L'application passe
   par les mêmes règles que les formulaires : droits par rôle, validation N+1
   (submitApproval), soldes de congés, verrou Time Sheet.
   Dialogue : s'il manque une information, l'assistant la demande et garde un
   brouillon (S.ai.draft) que les messages suivants complètent ; une correction
   (« plutôt à 700 € ») modifie la dernière proposition.
   Le panneau vit hors de #mc (non reconstruit par render()) et utilise ses
   propres attributs data-ai (pas le dispatcher data-act global).
   ═══════════════════════════════════════════════════════════════════════════ */
var AI_MISSION_ROLES=['super_admin','admin','gestionnaire','utilisateur'];

function aiState(){
  if(!S.ai)S.ai={open:false,busy:false,msgs:[],draft:null};
  return S.ai;
}
/* Disponible partout (y compris en démo) : tout se passe localement. */
function aiAvailable(){return !!(S&&S.role);}

/* Consultants que l'assistant peut cibler : ceux que l'utilisateur voit déjà. */
function aiConsList(){
  var base=(S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales')?personalCons():visibleData().cons;
  return (base||[]).filter(function(c){return c&&c.id;});
}
function aiClients(){
  var cl={};
  (visibleData().miss||[]).forEach(function(m){if(m.cli)cl[m.cli]=1;});
  (S.bizAccounts||[]).forEach(function(a){if(a&&a.name)cl[a.name]=1;});
  return Object.keys(cl);
}

/* ═══════════════════════ ANALYSE DU LANGAGE (locale) ═══════════════════════ */

/* Minuscules + sans accents, caractère par caractère : la chaîne garde la même
   longueur, donc les positions trouvées s'appliquent au texte original. */
function aiN(s){
  return String(s==null?'':s).split('').map(function(ch){
    var n=ch.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    return n.length===1?n:ch.toLowerCase().charAt(0);
  }).join('');
}
function aiPad(n){return (n<10?'0':'')+n;}
function aiISO(d){return d.getFullYear()+'-'+aiPad(d.getMonth()+1)+'-'+aiPad(d.getDate());}
function aiAddDays(iso,n){var d=pD(iso);d.setDate(d.getDate()+n);return aiISO(d);}
function aiAddMonths(iso,n){var d=pD(iso),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);
  var last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return aiISO(d);}
function aiLastDay(y,m){return new Date(y,m,0).getDate();} /* m : 1-12 */
function aiLev1(a,b){ /* distance d'édition ≤ 1 ? */
  if(a===b)return true;var la=a.length,lb=b.length;if(Math.abs(la-lb)>1)return false;
  var i=0,j=0,diff=0;
  while(i<la&&j<lb){if(a[i]===b[j]){i++;j++;continue;}if(++diff>1)return false;if(la>lb)i++;else if(lb>la)j++;else{i++;j++;}}
  return diff+(la-i)+(lb-j)<=1;
}

var AI_MONTHS=[['janvier','janv','jan'],['fevrier','fevr','fev'],['mars'],['avril','avr'],['mai'],['juin'],['juillet','juil'],['aout'],['septembre','sept','sep'],['octobre','oct'],['novembre','nov'],['decembre','dec']];
var AI_MRE=(function(){var all=[];AI_MONTHS.forEach(function(v){all=all.concat(v);});all.sort(function(a,b){return b.length-a.length;});return '('+all.join('|')+')(?![a-z])\\.?';})();
function aiMonthNum(w){for(var i=0;i<AI_MONTHS.length;i++)if(AI_MONTHS[i].indexOf(w)>=0)return i+1;return 0;}
var AI_WD=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
var AI_NUMW={un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,onze:11,douze:12,quinze:15,vingt:20};
var AI_STOP={le:1,la:1,les:1,de:1,du:1,des:1,au:1,aux:1,a:1,et:1,en:1,pour:1,chez:1,sur:1,un:1,une:1,mission:1,missions:1,conge:1,conges:1,cree:1,creer:1,cree:1,moi:1,me:1,mon:1,ma:1,mes:1,je:1,client:1,jusqu:1,mois:1,jours:1,jour:1,semaine:1,semaines:1,prochain:1,prochaine:1,fin:1,debut:1,tjm:1,forfait:1,marge:1,rtt:1,formation:1,maladie:1,absence:1,pose:1,poser:1,ajoute:1,ajouter:1,staffe:1,staffer:1,place:1,placer:1,avec:1,par:1,puis:1,plutot:1,euros:1,euro:1,eur:1,partir:1,compter:1,des:1,dans:1,lui:1,elle:1,il:1};

/* Résout jour/mois(/année) en date ISO ; sans année : l'occurrence à venir
   (une date passée de plus de 30 jours est placée l'année suivante). */
function aiResolve(d,m,y){
  var today=pD(TODAY);
  if(y){if(y<100)y+=2000;}
  else{y=today.getFullYear();var c=new Date(y,m-1,d);if(c<new Date(today.getTime()-30*864e5))y++;}
  if(m<1||m>12||d<1||d>aiLastDay(y,m))return null;
  return y+'-'+aiPad(m)+'-'+aiPad(d);
}

/* Extrait les dates : renvoie {sd, ed} (ISO ou null). */
function aiParseDates(n){
  var today=TODAY,marks=[],re,mm;
  /* « 3 novembre [2026] », « 1er déc. » */
  re=new RegExp('\\b(1er|\\d{1,2})\\s+'+AI_MRE+'(?:\\s+(\\d{4}))?','g');
  while((mm=re.exec(n))){var d0=mm[1]==='1er'?1:+mm[1];var iso=aiResolve(d0,aiMonthNum(mm[2]),mm[3]?+mm[3]:0);if(iso)marks.push({pos:mm.index,end:re.lastIndex,iso:iso,m:aiMonthNum(mm[2])});}
  /* « 03/11[/2026] » */
  re=/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/g;
  while((mm=re.exec(n))){var iso2=aiResolve(+mm[1],+mm[2],mm[3]?+mm[3]:0);if(iso2)marks.push({pos:mm.index,end:re.lastIndex,iso:iso2,m:+mm[2]});}
  /* « fin décembre », « début janvier », « mi-mars » */
  re=new RegExp('\\b(fin|debut|mi)[\\s-]+'+AI_MRE+'(?:\\s+(\\d{4}))?','g');
  while((mm=re.exec(n))){var mo=aiMonthNum(mm[2]),yy=mm[3]?+mm[3]:0;
    var tmp=aiResolve(1,mo,yy),yv=tmp?+tmp.slice(0,4):0;
    var dd=mm[1]==='fin'?aiLastDay(yv,mo):(mm[1]==='mi'?15:1);
    var iso3=aiResolve(dd,mo,yv);if(iso3)marks.push({pos:mm.index,end:re.lastIndex,iso:iso3,m:mo});}
  /* Mots relatifs */
  var rel=[[/\bapres[\s-]demain\b/g,2],[/\bdemain\b/g,1],[/\baujourd'?hui\b|\bce jour\b/g,0]];
  rel.forEach(function(r){var x;while((x=r[0].exec(n))){if(r[1]===1&&/apres[\s-]$/.test(n.slice(0,x.index)))continue;marks.push({pos:x.index,end:r[0].lastIndex,iso:aiAddDays(today,r[1])});}});
  re=/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?\b/g;
  while((mm=re.exec(n))){
    if(/\d\s*$/.test(n.slice(0,mm.index)))continue;
    var t=pD(today),wd=AI_WD.indexOf(mm[1]),delta=(wd-t.getDay()+7)%7;if(delta===0)delta=7;
    marks.push({pos:mm.index,end:re.lastIndex,iso:aiAddDays(today,delta)});}
  /* « la semaine prochaine » → du lundi au vendredi suivants */
  var wk=/\bsemaine prochaine\b/.exec(n),weekRange=null;
  if(wk){var t2=pD(today),dl=(1-t2.getDay()+7)%7;if(dl===0)dl=7;var mon=aiAddDays(today,dl);weekRange={sd:mon,ed:aiAddDays(mon,4)};}
  /* Jour seul en début de période : « du 3 au 28 novembre » */
  re=/\b(?:du|le|entre le|entre)\s+(1er|\d{1,2})\s*(?:au|a|-|et le|et|jusqu)\b/g;
  while((mm=re.exec(n))){
    var p=mm.index,taken=marks.some(function(k){return k.pos<=p+mm[0].length&&k.end>p+3;});
    if(taken)continue;
    var next=marks.filter(function(k){return k.pos>p&&k.m;}).sort(function(a,b){return a.pos-b.pos;})[0];
    if(!next)continue;
    var dS=mm[1]==='1er'?1:+mm[1],ny=+next.iso.slice(0,4),nm=next.m;
    if(dS>+next.iso.slice(8,10)){nm--;if(nm<1){nm=12;ny--;}}
    var iso4=aiResolve(dS,nm,ny);if(iso4)marks.push({pos:p,end:p+mm[0].length,iso:iso4});
  }
  marks.sort(function(a,b){return a.pos-b.pos;});
  /* dédoublonnage des marques qui se chevauchent */
  var ms=[];marks.forEach(function(k){if(!ms.some(function(x){return k.pos<x.end&&k.end>x.pos;}))ms.push(k);});
  var sd=null,ed=null;
  var isEnd=function(k){return /jusqu'?(?:au|a|a la|en)?\s*$|\b(?:au|fin)\s*$/.test(n.slice(Math.max(0,k.pos-14),k.pos));};
  var isStart=function(k){return /(?:a partir|a compter|des|depuis)(?: du| de| le| d')?\s*$|\b(?:du|debut)\s*$/.test(n.slice(Math.max(0,k.pos-16),k.pos));};
  /* Chaque date est classée par le mot qui la précède (« jusqu'au » → fin,
     « à partir de » → début) ; les autres complètent dans l'ordre du texte. */
  var starts=ms.filter(isStart),ends=ms.filter(function(k){return !isStart(k)&&isEnd(k);});
  var rest=ms.filter(function(k){return starts.indexOf(k)<0&&ends.indexOf(k)<0;});
  if(starts.length)sd=starts[0].iso;
  if(ends.length)ed=ends[0].iso;
  rest.forEach(function(k){if(!sd)sd=k.iso;else if(!ed)ed=k.iso;});
  if(sd&&ed&&ed<sd){var y2=+ed.slice(0,4)+1;ed=y2+ed.slice(4);}
  if(!sd&&!ed&&weekRange){sd=weekRange.sd;ed=weekRange.ed;}
  /* Durée : « pour 3 mois », « pendant 2 semaines », « sur 10 jours » */
  var du=/\b(?:pour|pendant|sur|duree(?: de)?|d'une duree de)\s+(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt)\s+(mois|semaines?|jours?|ans?|annees?)\b/.exec(n);
  var dur=null;
  if(du){var q=AI_NUMW[du[1]]||+du[1];dur={q:q,u:du[2]};}
  if(dur&&sd&&!ed){
    if(/^mois/.test(dur.u))ed=aiAddDays(aiAddMonths(sd,dur.q),-1);
    else if(/^(an|annee)/.test(dur.u))ed=aiAddDays(aiAddMonths(sd,12*dur.q),-1);
    else if(/^semaine/.test(dur.u))ed=aiAddDays(sd,7*dur.q-1);
    else ed=aiAddDays(sd,dur.q-1);
  }
  return {sd:sd,ed:ed,dur:!!dur};
}

/* Montants : TJM, montant de forfait, marge cible. */
function aiParseMoney(n){
  var res={amounts:[],tmar:null,forfait:/\bforfait/.test(n)};
  var num=function(s,k){var v=parseFloat(String(s).replace(/[\s  ]/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.'));if(isNaN(v))return null;if(k==='k')v*=1000;if(k==='m')v*=1e6;return v;};
  var mg=/\bmarge[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?marge/.exec(n);
  if(mg)res.tmar=num(mg[1]||mg[2]);
  var re=/(\d+(?:[\s  .]\d{3})*(?:[.,]\d+)?)\s*(k|m)?\s*(?:€|euros?\b|eur\b)/g,mm;
  while((mm=re.exec(n))){var v=num(mm[1],mm[2]);if(v!=null)res.amounts.push({pos:mm.index,v:v});}
  re=/\b(?:tjm|taux(?: journalier)?|tarif|prix)\s*(?:de|a|:|=)?\s*(\d+(?:[.,]\d+)?)\s*(k)?/g;
  while((mm=re.exec(n))){var v2=num(mm[1],mm[2]);if(v2!=null&&!res.amounts.some(function(a){return a.v===v2;}))res.amounts.push({pos:mm.index,v:v2});}
  re=/(\d+(?:[.,]\d+)?)\s*(k)?\s*(?:€)?\s*\/\s*j(?:our)?\b/g;
  while((mm=re.exec(n))){var v3=num(mm[1],mm[2]);if(v3!=null&&!res.amounts.some(function(a){return a.v===v3;}))res.amounts.push({pos:mm.index,v:v3});}
  if(!res.amounts.length){ /* « à 650 » sans devise : nombre ≥ 100 qui n'est ni une date ni une durée */
    re=new RegExp('\\b(?:a|pour|de)\\s+(\\d{3,6})(?!\\s*(?:[\\/.]\\d|%|'+AI_MRE+'|mois|jours?|semaines?|ans?))\\b','g');
    while((mm=re.exec(n))){var y=+mm[1];if(y>=1900&&y<=2100)continue;res.amounts.push({pos:mm.index,v:y});}
  }
  return res;
}

/* Type d'absence à partir des mots-clés. */
function aiLeaveType(n){
  if(/\bmission interne\b/.test(n))return 'Mission interne';
  if(/\brtt\s*q2\b/.test(n))return 'RTT Q2';
  if(/\brtt\b/.test(n))return 'RTT';
  if(/\bformation\b/.test(n))return 'Formation';
  if(/\b(maladie|arret)\b/.test(n))return 'Maladie';
  if(/\bmaternite\b/.test(n))return 'Congé maternité';
  if(/\bsans solde\b/.test(n))return 'Congé sans solde';
  if(/\binter[\s-]?contrat\b/.test(n))return 'Inter-contrat';
  if(/\b(conges? payes?|cp|vacances|conges?)\b/.test(n))return 'Congé payé';
  return null;
}
function aiIntent(n){
  if(/\bmission interne\b/.test(n))return 'leave';
  if(/\b(ajoute[rz]?|cree[rz]?|creation|nouvel(?:le)?|nouveau|embauche[rz]?|integre[rz]?|enregistre[rz]?|recrute[rz]?)\b/.test(n)
    &&/\b(consultante?s?|collaborat(?:eur|rice)s?|salariee?s?|recrue|freelance)\b/.test(n)
    &&!/\b(missions?|staff\w*|conges?|rtt|absences?)\b/.test(n))return 'consultant';
  if(/\b(missions?|staff(?:e|er|ing)?|placer?|positionne[rz]?)\b/.test(n))return 'mission';
  if(aiLeaveType(n)||/\b(absences?|absent|off|repos)\b/.test(n))return 'leave';
  return null;
}

/* Client : d'abord les clients connus présents dans la phrase, sinon « chez X ». */
function aiParseClient(text,n){
  var known=aiClients().map(function(c){return {c:c,k:aiN(c)};}).filter(function(x){return x.k.length>=2;})
    .sort(function(a,b){return b.k.length-a.k.length;});
  for(var i=0;i<known.length;i++){
    var idx=n.search(new RegExp('(^|[^a-z0-9])'+known[i].k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z0-9])'));
    if(idx>=0){var st=n.indexOf(known[i].k,idx);return {name:known[i].c,pos:st,end:st+known[i].k.length};}
  }
  var re=new RegExp("\\b(?:chez|client|aupres de|pour le compte de|pour le client)\\s+(.+?)(?=\\s+(?:du|des|de la|depuis|a partir|au|a|le|la|pour|pendant|sur|en|jusqu|avec|tjm|taux|forfait|marge|\\d)\\b|[,.;!?]|$)");
  var mm=re.exec(n);
  if(mm&&mm[1]){var s0=mm.index+mm[0].length-mm[1].length;var raw=text.substr(s0,mm[1].length).trim();
    if(raw&&raw.length<=80)return {name:raw.charAt(0).toUpperCase()+raw.slice(1),pos:s0,end:s0+mm[1].length};}
  return null;
}

/* Consultants : correspondance nom complet / nom / prénom, tolérante à une faute.
   Renvoie {ids:[…], ambig:[[ids…]…]} — un groupe ambigu par mot trouvé. */
function aiParseCons(n,mask){
  var words=[];var re=/[a-z0-9']+/g,mm;
  while((mm=re.exec(n))){if(mask&&mm.index>=mask.pos&&mm.index<mask.end)continue;var w=mm[0].replace(/^[ld]'/,'');if(w.length>=2&&!AI_STOP[w]&&!aiMonthNum(w)&&AI_WD.indexOf(w)<0&&!/^\d/.test(w))words.push(w);}
  var nm=mask?n.slice(0,mask.pos)+' '.repeat(mask.end-mask.pos)+n.slice(mask.end):n;
  var cands=[];
  aiConsList().forEach(function(c){
    var full=aiN(c.name).trim();if(!full)return;
    var toks=full.split(/[\s-]+/).filter(function(t){return t.length>=2;});if(!toks.length)return;
    var first=toks[0],last=toks.length>1?toks.slice(1):[];
    var best=0,key='';
    if(new RegExp('(^|[^a-z])'+full.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z])').test(nm)){best=10;key='full:'+full;}
    else{
      var hasL=last.filter(function(t){return words.indexOf(t)>=0;}),hasF=words.indexOf(first)>=0;
      if(hasL.length&&hasF){best=10;key='full:'+full;}
      else if(hasL.length){best=6;key=hasL[0];}
      else if(hasF){best=4;key=first;}
      else{
        var fz=null;words.forEach(function(w){if(w.length<4||fz)return;last.concat([first]).forEach(function(t){if(!fz&&t.length>=4&&aiLev1(w,t))fz={w:w,s:last.indexOf(t)>=0?3:2};});});
        if(fz){best=fz.s;key=fz.w;}
      }
    }
    if(best)cands.push({id:c.id,s:best,key:key});
  });
  if(!cands.length)return {ids:[],ambig:[]};
  var top=Math.max.apply(null,cands.map(function(c){return c.s;}));
  /* Les correspondances faibles (prénom, faute) sont ignorées s'il existe un nom complet. */
  var keep=cands.filter(function(c){return top>=10?c.s>=6:c.s>=Math.min(top,4)||c.s===top;});
  var groups={};keep.forEach(function(c){(groups[c.key]=groups[c.key]||[]).push(c);});
  var ids=[],ambig=[];
  Object.keys(groups).forEach(function(k){
    var g=groups[k],gm=Math.max.apply(null,g.map(function(c){return c.s;}));
    var b=g.filter(function(c){return c.s===gm;});
    if(b.length===1)ids.push(b[0].id);else ambig.push(b.map(function(c){return c.id;}));
  });
  /* un consultant déjà retenu ne reste pas dans un groupe ambigu */
  ambig=ambig.map(function(a){return a.filter(function(id){return ids.indexOf(id)<0;});}).filter(function(a){return a.length>1;});
  return {ids:ids.filter(function(id,i,arr){return arr.indexOf(id)===i;}),ambig:ambig};
}

/* Fiche consultant : « Ajoute le consultant Julie Martin, Data Engineer, SCR 450 €, julie@esn.fr » */
function aiParseNewCons(text,n){
  var r={name:null,title:null,scr:null,email:null};
  var em=/[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}/i.exec(text);if(em)r.email=em[0].toLowerCase();
  var sc=/\b(?:scr|cjm|cout(?: de revient)?(?: journalier)?|salaire journalier)\s*(?:de|a|:|=)?\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?\s*(?:de\s+)?(?:scr|cjm)\b/.exec(n);
  if(sc)r.scr=parseFloat((sc[1]||sc[2]).replace(',','.'));
  var k=/\b(consultante?|collaborat(?:eur|rice)|salariee?|recrue|freelance)\s+(?:(?:nomme|appele|qui s'appelle)e?\s+)?/.exec(n);
  if(k){
    var start=k.index+k[0].length,rest=text.slice(start);
    /* Nom : mots jusqu'à une virgule ou un mot-clé (poste, SCR, email…), 4 mots max. */
    var cut=aiN(rest).search(/,|;|\(|\s(?:comme|en tant que|au poste|poste|scr|cjm|cout|email|e-mail|mail|avec|qui|chez|a|au|de scr)\b|\s\S+@|\s\d/);
    var nm=(cut>=0?rest.slice(0,cut):rest).trim().split(/\s+/).slice(0,4).join(' ');
    if(nm&&!/^\d/.test(nm))r.name=nm.split(' ').map(function(w){return /^(de|du|des|le|la|van|von|d'\S*)$/i.test(w)?w:w.charAt(0).toUpperCase()+w.slice(1);}).join(' ');
    /* Poste : « comme … », « en tant que … », « poste … » ou segment après la virgule. */
    var tm=/\b(?:comme|en tant que|au poste de|poste\s*(?:de|:)?)\s+([^,;]+)/.exec(aiN(rest));
    var seg=null;
    if(tm){var off=tm.index+tm[0].length-tm[1].length;seg=rest.substr(off,tm[1].length);}
    else{var parts=rest.split(/[,;]/).slice(1);for(var i=0;i<parts.length;i++){var pp=parts[i].trim();if(pp&&!/\d|@/.test(pp)&&!/\b(scr|cjm|email|mail)\b/i.test(pp)){seg=pp;break;}}}
    if(seg){seg=seg.replace(/\s+(?:avec|scr|cjm|email|e-mail|mail)\b.*$/i,'').trim();if(seg)r.title=seg.charAt(0).toUpperCase()+seg.slice(1);}
  }
  return r;
}

/* Intitulé explicite : texte entre guillemets ou « mission <nom> chez … ». */
function aiParseName(text,n){
  var q=/[«"“]\s*([^»"”]{2,80}?)\s*[»"”]/.exec(text);if(q)return q[1].trim();
  return null;
}

/* Analyse complète d'un message. */
function aiParse(text){
  var n=aiN(text);
  var cli=aiParseClient(text,n);
  var cons=aiParseCons(n,cli);
  var dates=aiParseDates(n);
  var money=aiParseMoney(n);
  var self=/\b(moi|me|m'|mon|ma|mes|je|j')\b|\bpose[\s-]?moi\b/.test(n);
  var op=aiOp(n);
  if(op)return aiParseOp(text,n,op,cli,cons,dates,money,self);
  var intent=aiIntent(n);
  if(intent==='consultant')return {intent:intent,nc:aiParseNewCons(text,n),cids:[],ambig:[],amounts:[],raw:text.trim(),help:false,ltype:null,self:false,cli:null,name:null,sd:null,ed:null,forfait:false,tmar:null};
  return {
    intent:intent,ltype:aiLeaveType(n),self:self,
    cids:cons.ids,ambig:cons.ambig,
    cli:cli?cli.name:null,name:aiParseName(text,n),
    sd:dates.sd,ed:dates.ed,
    forfait:money.forfait,amounts:money.amounts.map(function(a){return a.v;}),tmar:money.tmar,
    help:/^\s*(aide|help|\?|que sais[- ]tu faire|comment (ca|ça) marche)/.test(n),
    raw:text.trim()
  };
}

/* ═══════════════════════ DIALOGUE ═══════════════════════ */
function aiConsName(id){var c=aiConsList().find(function(k){return String(k.id)===String(id);});return c?c.name:'?';}

/* Fusionne une analyse dans le brouillon (les nouvelles valeurs l'emportent). */
function aiMerge(d,p){
  if(p.intent&&!d.intent)d.intent=p.intent;
  if(d.intent==='consultant'){
    d.nc=d.nc||{};
    if(p.nc){['name','title','scr','email'].forEach(function(k){if(p.nc[k]!=null&&p.nc[k]!=='')d.nc[k]=p.nc[k];});}
    else{
      var raw=p.raw||'',e=/[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}/i.exec(raw),num=parseFloat(raw.replace(',','.'));
      if(e)d.nc.email=e[0].toLowerCase();
      else if(d.ask==='name'&&raw.length<=60)d.nc.name=raw;
      else if(/\bscr|cjm|cout\b/i.test(aiN(raw))&&p.amounts.length)d.nc.scr=p.amounts[0];
      else if(!isNaN(num)&&/^\s*\d/.test(raw))d.nc.scr=num;
      else if(raw.length<=60&&!/\d/.test(raw))d.nc.title=raw.charAt(0).toUpperCase()+raw.slice(1);
    }
    return d;
  }
  if(p.ltype)d.ltype=p.ltype;
  if(p.cids.length){d.cids=d.multiAdd?d.cids.concat(p.cids):p.cids.slice();}
  if(p.ambig.length)d.ambig=p.ambig;else if(p.cids.length)d.ambig=[];
  if(p.cli)d.cli=p.cli;
  if(p.name)d.name=p.name;
  if(p.sd)d.sd=p.sd;
  if(p.ed)d.ed=p.ed;
  if(p.sd&&!p.ed&&d.ed&&d.ed<p.sd)d.ed=null;
  if(p.forfait)d.bt='forfait';
  if(p.tmar!=null)d.tmar=p.tmar;
  if(p.amounts.length){
    if(d.bt==='forfait'){var big=Math.max.apply(null,p.amounts);if(big>=2000||!d.deal)d.deal=big;}
    else d.tjm=p.amounts[0];
  }
  if(p.self&&!p.cids.length&&!d.cids.length&&S.consId)d.cids=[S.consId];
  /* Réponse brute à une question précise (« BNP Paribas », « 650 ») */
  if(d.ask==='cli'&&!p.cli&&!p.cids.length&&!p.sd&&!p.amounts.length&&p.raw.length<=80)d.cli=p.raw.charAt(0).toUpperCase()+p.raw.slice(1);
  if((d.ask==='tjm'||d.ask==='deal')&&!p.amounts.length){var v=parseFloat(p.raw.replace(/\s/g,'').replace(',','.'));if(v>0){if(d.ask==='tjm')d.tjm=v;else d.deal=v;}}
  if(d.ask==='tmar'&&p.tmar==null){var t=parseFloat(p.raw.replace(',','.'));if(!isNaN(t))d.tmar=t;}
  return d;
}

/* Évalue le brouillon : question à poser, ou action prête. */
function aiEvaluate(d){
  if(d.op)return aiEvaluateOp(d);
  var sAsk=function(field,msg,extra){d.ask=field;return {text:msg,choices:extra||null};};
  var personal=(S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales');
  if(!d.intent)return {text:'Je sais créer des consultants, des missions et des absences. Essayez par exemple « Crée une mission pour Sophie Martin chez BNP Paribas du 3 au 28 novembre à 650 € ».',quick:aiStartQuick(),reset:true};
  if(d.intent==='consultant'){
    if(!canEditTeam())return {text:'Votre rôle ne permet pas d’ajouter des consultants.',reset:true};
    var nc=d.nc||{};
    if(!nc.name)return sAsk('name','Quel est le nom du consultant à ajouter ?');
    return {action:{tool:'create_consultant',input:{name:nc.name,title:nc.title||'',scr:nc.scr!=null?nc.scr:null,email:nc.email||''}},
      text:'Voici la fiche que je vous propose'+(nc.title?'':' (vous pouvez préciser le poste : « comme Data Engineer »)')+'. Vérifiez puis cliquez sur « Créer ».'};
  }
  if(d.intent==='mission'&&AI_MISSION_ROLES.indexOf(S.role)<0)return {text:'Votre rôle ne permet pas de créer des missions.',reset:true};
  if(!aiConsList().length)return {text:'Vous n’avez pas encore de consultant. Commencez par en ajouter un — par exemple « Ajoute le consultant Julie Martin, Data Engineer, SCR 450 € » — ou importez votre fichier Excel.',quick:aiStartQuick(),reset:true};
  if(d.ambig&&d.ambig.length){
    var g=d.ambig[0];
    return sAsk('cons','Plusieurs consultants correspondent. Lequel ?',g.map(function(id){return {id:id,label:aiConsName(id)};}));
  }
  if(!d.cids.length&&d.intent==='leave'&&personal&&S.consId)d.cids=[S.consId];
  if(!d.cids.length&&S.role==='utilisateur'&&S.consId)d.cids=[S.consId];
  if(!d.cids.length)return sAsk('cons',d.intent==='leave'?'Pour quel consultant ?':'Pour quel consultant (ou quels consultants) ?');
  if(d.intent==='mission'){
    var miss=[];
    if(!d.cli)miss.push(['cli','pour quel client']);
    if(!d.sd)miss.push(['sd','à partir de quelle date']);
    if(S.role!=='utilisateur'){
      if(d.bt==='forfait'){if(!d.deal)miss.push(['deal','quel est le montant du forfait']);if(d.tmar==null)miss.push(['tmar','quelle marge cible (%)']);}
      else if(!(d.tjm>0))miss.push(['tjm','à quel TJM (€ HT / jour)']);
    }
    if(miss.length){var q=miss.map(function(m){return m[1];});q[0]=q[0].charAt(0).toUpperCase()+q[0].slice(1);
      return sAsk(miss[0][0],(miss.length>1?'Il me manque quelques informations : ':'')+q.join(', ')+' ?');}
    return {action:{tool:'create_mission',input:{consultant_ids:d.cids.map(String),name:d.name||('Mission '+d.cli),client:d.cli,
      start_date:d.sd,end_date:d.ed||null,billing_type:d.bt==='forfait'?'forfait':'at',
      tjm:d.bt==='forfait'?null:(d.tjm||null),deal_amount:d.bt==='forfait'?d.deal:null,target_margin:d.bt==='forfait'?d.tmar:null}},
      text:'Voici la mission que je vous propose. Vérifiez puis cliquez sur « Créer ».'};
  }
  if(d.cids.length>1)return sAsk('cons','Une absence concerne un seul consultant. Lequel ?',d.cids.map(function(id){return {id:id,label:aiConsName(id)};}));
  if(!d.sd&&d.ed)d.sd=d.ed;
  if(!d.sd)return sAsk('sd','Pour quelles dates ? (ex. « du 22 au 26 décembre »)');
  return {action:{tool:'create_leave',input:{consultant_id:String(d.cids[0]),type:d.ltype||'Congé payé',start_date:d.sd,end_date:d.ed||d.sd}},
    text:'Voici l’absence que je vous propose'+(d.ltype?'':' (type par défaut : congé payé, dites « plutôt RTT » pour changer)')+'. Vérifiez puis cliquez sur « Créer ».'};
}

/* Brouillon reconstitué depuis une carte en attente (pour les corrections). */
function aiDraftFromAction(ac){
  var x=ac.input||{};
  if(ac.tool==='create_consultant')return {intent:'consultant',cids:[],ambig:[],nc:{name:x.name,title:x.title,scr:x.scr,email:x.email}};
  if(ac.tool==='create_mission')return {intent:'mission',cids:(x.consultant_ids||[]).slice(),ambig:[],cli:x.client,name:x.name,sd:x.start_date,ed:x.end_date,bt:x.billing_type,tjm:x.tjm,deal:x.deal_amount,tmar:x.target_margin};
  return {intent:'leave',cids:[x.consultant_id],ambig:[],ltype:x.type,sd:x.start_date,ed:x.end_date};
}
function aiLastPending(){
  var ms=aiState().msgs;
  for(var i=ms.length-1;i>=0;i--){var a=(ms[i].actions||[]).filter(function(x){return x.status==='pending';});if(a.length)return a[a.length-1];if(ms[i].role==='user')continue;}
  return null;
}

/* Traite un message utilisateur et renvoie la réponse de l'assistant. */
/* Correction d'une fiche consultant proposée : « plutôt comme Product Owner »,
   « SCR 480 », « email julie@esn.fr », « nom Julie Marin ». */
function aiConsCorrection(text){
  var n=aiN(text),c={};
  var em=/[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}/i.exec(text);if(em)c.email=em[0].toLowerCase();
  var sc=/\b(?:scr|cjm|cout(?: de revient)?(?: journalier)?)\s*(?:de|a|:|=)?\s*(\d+(?:[.,]\d+)?)/.exec(n);if(sc)c.scr=parseFloat(sc[1].replace(',','.'));
  var nm=/\bnom\s*(?::|=)?\s+(.+)$/.exec(n);if(nm){var off=nm.index+nm[0].length-nm[1].length;c.name=text.substr(off,nm[1].length).trim();}
  var tm=/\b(?:comme|en tant que|au poste de|poste\s*(?:de|:)?)\s+([^,;]+)/.exec(n);
  if(tm){var o2=tm.index+tm[0].length-tm[1].length,t=text.substr(o2,tm[1].length).replace(/\s+(?:avec|scr|cjm|email|e-mail|mail)\b.*$/i,'').trim();if(t)c.title=t.charAt(0).toUpperCase()+t.slice(1);}
  return c;
}

/* Traite un message utilisateur et renvoie la réponse de l'assistant. */
function aiRespond(text){
  var st=aiState(),p=aiParse(text),n=aiN(text);
  if(p.help)return {role:'assistant',text:'Je peux créer pour vous :\n• un consultant — « Ajoute le consultant Julie Martin, Data Engineer, SCR 450 € »\n• une mission — « Crée une mission pour Julie Martin chez BNP Paribas du 3 au 28 novembre à 650 € »\n• une absence — « Pose-moi un congé du 22 au 26 décembre », « RTT vendredi pour Thomas »\nJe peux aussi modifier ou supprimer :\n• « Prolonge la mission de Julie Martin chez BNP jusqu’au 31 décembre », « Passe son TJM à 700 € »\n• « Transforme le congé de Thomas du 22 décembre en RTT », « Supprime l’absence de Thomas du 22 décembre »\n• « Change le SCR de Julie Martin à 480 », « Supprime le consultant Paul Durand »\nJe vous demande ce qui manque, et rien n’est créé sans votre confirmation.',quick:aiStartQuick()};
  if(p.op){var dop=aiDraftFromOp(p);var rop=aiEvaluateOp(dop);return aiReply(st,dop,rop,null);}
  if(st.draft&&st.draft.op&&!(p.intent&&AI_CREATE_RE.test(n))){aiMergeOp(st.draft,p);return aiReply(st,st.draft,aiEvaluateOp(st.draft),null);}
  var startNew=!!(p.intent&&(p.intent==='consultant'||p.cids.length||p.cli||p.sd||/\b(cree|creer|ajoute|ajouter|pose|poser|nouvelle?|staffe|staffer|place|placer)\b/.test(n)));
  var d=null,replaced=null,lp=null;
  if(startNew)d={cids:[],ambig:[]};
  else if(st.draft)d=st.draft;
  else if((lp=aiLastPending())&&/^create_/.test(lp.tool)){
    if(lp.tool==='create_consultant'){
      var c=aiConsCorrection(text);
      if(Object.keys(c).length){d=aiDraftFromAction(lp);replaced=lp;Object.keys(c).forEach(function(k){d.nc[k]=c[k];});p=null;}
    }else if(p.cids.length||p.cli||p.sd||p.ed||p.amounts.length||p.ltype||p.tmar!=null||p.forfait){d=aiDraftFromAction(lp);replaced=lp;}
  }
  if(!d)d={cids:[],ambig:[]};
  if(p)aiMerge(d,p);
  var r=aiEvaluate(d);
  if(r.action){
    if(replaced){replaced.status='cancel';replaced.result='Remplacée par la version corrigée';}
    st.draft=null;
    return {role:'assistant',text:r.text,actions:[{tool:r.action.tool,input:r.action.input,status:'pending'}]};
  }
  st.draft=r.reset?null:d;
  return {role:'assistant',text:r.text,choices:r.choices||null,quick:r.quick||null};
}

/* Raccourcis de démarrage (boutons) : exemples à envoyer ou actions de l'app. */
function aiStartQuick(){
  var q=[];
  if(canEditTeam()){
    q.push({label:'📥 Importer mes consultants (Excel)',go:'import-cons'});
    q.push({label:'👤 Ajouter un consultant',prompt:'Ajoute le consultant Julie Martin, Data Engineer, SCR 450 €'});
  }
  if(AI_MISSION_ROLES.indexOf(S.role)>=0)q.push({label:'💼 Créer une mission',prompt:'Crée une mission pour '+(((aiConsList()[0]||{}).name)||'Julie Martin')+' chez BNP Paribas du 3 au 28 novembre à 650 €'});
  q.push({label:'🌴 Poser une absence',prompt:'Pose-moi un congé payé du 22 au 26 décembre'});
  return q;
}

/* ═══════════════════════ ESSAI GRATUIT : GUIDE DE DÉMARRAGE ═══════════════════════
   Pour un administrateur dont l'abonnement est en essai (S.subscription.status
   === 'trialing'), l'assistant s'ouvre une fois automatiquement avec un guide :
   jours restants, étapes cochées au fur et à mesure, raccourcis. */
function aiTrial(){
  var sub=S.subscription;
  if(S.demo||!sub||sub.status!=='trialing'||(S.role!=='admin'&&S.role!=='super_admin'))return null;
  var te=sub.current_period_end?new Date(sub.current_period_end):null;
  var left=te&&!isNaN(te)?Math.max(0,Math.ceil((te-Date.now())/864e5)):null;
  return {left:left};
}
function aiTrialSteps(){
  var all=(S._all&&S._all.cons)||S.cons||[],miss=(S._all&&S._all.miss)||S.miss||[],lvs=(S._all&&S._all.lvs)||S.lvs||[];
  /* La fiche de l'administrateur est créée automatiquement : on compte au-delà. */
  var others=all.filter(function(c){return String(c.id)!==String(S.consId);}).length;
  return [
    {done:others>0,label:'Ajouter vos consultants'},
    {done:miss.length>0,label:'Créer une première mission'},
    {done:lvs.length>0,label:'Poser une absence'}
  ];
}
function aiTrialGuideHtml(t){
  var steps=aiTrialSteps(),n=steps.filter(function(x){return x.done;}).length;
  return '<div class="ai-guide"><div class="ai-guide-h">🎁 Essai gratuit'+(t.left!=null?' — '+(t.left<=1?'dernier jour':'encore '+t.left+' jours'):'')+'</div>'
    +'<div class="ai-guide-p">Démarrage : '+n+'/'+steps.length+'</div>'
    +steps.map(function(x){return '<div class="ai-step'+(x.done?' ok':'')+'">'+(x.done?'✓':'○')+' '+esc(x.label)+'</div>';}).join('')
    +'</div>';
}
function aiTrialAutoOpen(){
  var t=aiTrial();if(!t)return;
  var key='ks-ai-trial-'+(SB_CID||'');
  try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1');}catch(e){return;}
  var st=aiState();st.open=true;
  if(!st.msgs.length)st.msgs.push({role:'assistant',text:'Bienvenue dans votre essai gratuit de Konsilys ! Je suis votre assistant : écrivez-moi ce que vous voulez faire, je prépare la fiche et vous n’avez plus qu’à confirmer.\nPour bien démarrer : ajoutez vos consultants (un par un ou par import Excel), créez une mission, puis posez une absence.',quick:aiStartQuick()});
}

/* ═══════════════════════ INTERFACE ═══════════════════════ */

/* ── Montage du bouton + panneau (appelé à la fin de render()) ── */
function aiMount(){
  var btn=document.getElementById('ai-fab');
  if(!aiAvailable()){if(btn)btn.style.display='none';var p0=document.getElementById('ai-panel');if(p0)p0.style.display='none';return;}
  if(!btn){
    btn=document.createElement('button');btn.id='ai-fab';btn.type='button';
    btn.setAttribute('aria-label','Ouvrir l’assistant Konsilys');btn.setAttribute('data-ai','toggle');
    btn.innerHTML='<span aria-hidden="true">✨</span><span class="ai-fab-t">Assistant</span>';
    document.body.appendChild(btn);
    var panel=document.createElement('div');panel.id='ai-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Assistant Konsilys');
    document.body.appendChild(panel);
    document.addEventListener('click',aiOnClick);
    document.addEventListener('keydown',function(e){
      if(e.target&&e.target.id==='ai-in'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiSend();}
      else if(e.key==='Escape'&&aiState().open){aiState().open=false;aiRender();}
    });
  }else{
    btn.style.display='';
    /* déjà monté : on ne re-rend le panneau que s'il s'ouvre (guide d'essai) — évite de voler le focus */
    var was=aiState().open;aiTrialAutoOpen();if(!was&&aiState().open)aiRender();
    return;
  }
  btn.style.display='';
  aiTrialAutoOpen();
  aiRender();
}

function aiRender(){
  var st=aiState(),panel=document.getElementById('ai-panel'),btn=document.getElementById('ai-fab');
  if(!panel)return;
  if(btn)btn.classList.toggle('on',st.open);
  panel.style.display=st.open?'flex':'none';
  if(!st.open)return;
  var keep=document.getElementById('ai-in'),draft=keep?keep.value:'';
  var ex1=(aiConsList()[0]||{}).name||'Julie Martin';
  var trial=aiTrial();
  var intro=(trial?'<div class="ai-msg a" style="max-width:100%;align-self:stretch">'+aiTrialGuideHtml(trial)+'</div>':'')
    +(st.msgs.length?'':'<div class="ai-msg a"><div class="ai-b">Bonjour ! Dites-moi ce que vous voulez créer, par exemple :'
    +(canEditTeam()?'<button class="ai-ex" data-ai="ex">Ajoute le consultant Julie Martin, Data Engineer, SCR 450 €</button>':'')
    +(AI_MISSION_ROLES.indexOf(S.role)>=0&&aiConsList().length?'<button class="ai-ex" data-ai="ex">Crée une mission pour '+esc(ex1)+' chez BNP Paribas du 3 au 28 novembre à 650 €</button>':'')
    +'<button class="ai-ex" data-ai="ex">Pose-moi un congé payé du 22 au 26 décembre</button></div></div>');
  var last=st.msgs.length-1;
  var body=st.msgs.map(function(m,i){
    var h='<div class="ai-msg '+(m.role==='user'?'u':'a')+'">';
    if(m.text)h+='<div class="ai-b">'+esc(m.text).replace(/\n/g,'<br>')+'</div>';
    if(m.quick)h+='<div class="ai-choices">'+m.quick.map(function(q,k){return '<button class="ai-ex ai-q" data-ai="quick" data-i="'+i+'" data-k="'+k+'">'+esc(q.label)+'</button>';}).join('')+'</div>';
    if(m.choices&&i===last)h+='<div class="ai-choices">'+m.choices.map(function(c){return '<button class="ai-ex" data-ai="'+(c.act||'pick')+'" data-cid="'+esc(c.id)+'">'+esc(c.label)+'</button>';}).join('')+'</div>';
    (m.actions||[]).forEach(function(ac,j){h+=aiCard(ac,i,j);});
    return h+'</div>';
  }).join('');
  panel.innerHTML='<div class="ai-hd"><b>✨ Assistant Konsilys</b><span class="ai-beta">Bêta</span>'
    +'<button class="ai-x" data-ai="close" aria-label="Fermer">✕</button></div>'
    +'<div class="ai-body" id="ai-body">'+intro+body+'</div>'
    +'<div class="ai-ft"><textarea id="ai-in" rows="1" placeholder="Ex. : crée une mission pour…" aria-label="Votre demande"></textarea>'
    +'<button class="ai-send" data-ai="send" aria-label="Envoyer">➤</button></div>'
    +'<div class="ai-note">Analyse locale : vos données ne quittent pas Konsilys. Rien n’est créé sans votre confirmation.</div>';
  var inp=document.getElementById('ai-in');if(inp){inp.value=draft;inp.focus();}
  var b=document.getElementById('ai-body');if(b)b.scrollTop=b.scrollHeight;
}

/* Carte récapitulative d'une action proposée. */
function aiCard(ac,i,j){
  var x=ac.input||{},rows=[],title='';
  var cname=function(id){var c=aiConsList().find(function(k){return String(k.id)===String(id);});return c?c.name:'⚠ consultant inconnu';};
  if(ac.tool==='create_mission'){
    title='💼 Nouvelle mission';
    rows.push(['Consultant'+((x.consultant_ids||[]).length>1?'s':''),(x.consultant_ids||[]).map(cname).join(', ')]);
    rows.push(['Mission',x.name]);rows.push(['Client',x.client]);
    rows.push(['Période',fDt(x.start_date)+' → '+(x.end_date?fDt(x.end_date):'sans date de fin')]);
    if(x.billing_type==='forfait')rows.push(['Forfait',(x.deal_amount!=null?Number(x.deal_amount).toLocaleString('fr-FR')+' € HT':'—')+(x.target_margin!=null?' · marge '+x.target_margin+' %':'')]);
    else rows.push(['TJM',x.tjm!=null?Number(x.tjm).toLocaleString('fr-FR')+' € HT / jour':'—']);
  }else if(ac.tool==='create_consultant'){
    title='👤 Nouveau consultant';
    rows.push(['Nom',x.name]);rows.push(['Poste',x.title||'—']);
    rows.push(['SCR',x.scr!=null?Number(x.scr).toLocaleString('fr-FR')+' € / jour':'—']);
    rows.push(['Email',x.email||'—']);
    if(aiConsDup(x.name))rows.push(['⚠','Un consultant porte déjà ce nom']);
  }else if(/^(delete|update)_/.test(ac.tool)){
    return aiOpCard(ac,i,j);
  }else if(ac.tool==='create_leave'){
    title='🌴 Nouvelle absence';
    rows.push(['Consultant',cname(x.consultant_id)]);rows.push(['Type',x.type]);
    rows.push(['Période',fDt(x.start_date)+' → '+fDt(x.end_date)]);
  }
  var st=ac.status;
  var foot=st==='done'?'<div class="ai-st ok">✓ '+esc(ac.result||'Créé')+'</div>'
    :st==='cancel'?'<div class="ai-st">'+esc(ac.result||'Annulé')+'</div>'
    :st==='error'?'<div class="ai-st err">⚠ '+esc(ac.result||'Erreur')+'</div>'
      +'<div class="ai-act"><button class="ai-ok" data-ai="apply" data-i="'+i+'" data-j="'+j+'">Réessayer</button></div>'
    :'<div class="ai-act"><button class="ai-ok" data-ai="apply" data-i="'+i+'" data-j="'+j+'">Créer</button><button class="ai-no" data-ai="cancel" data-i="'+i+'" data-j="'+j+'">Annuler</button></div>';
  return '<div class="ai-card"><div class="ai-ct">'+title+'</div>'
    +rows.map(function(r){return '<div class="ai-row"><span>'+esc(r[0])+'</span><b>'+esc(r[1]==null?'—':r[1])+'</b></div>';}).join('')
    +foot+'</div>';
}

function aiOnClick(e){
  var t=e.target.closest&&e.target.closest('[data-ai]');if(!t)return;
  var a=t.getAttribute('data-ai'),st=aiState();
  if(a==='toggle'){st.open=!st.open;aiRender();}
  else if(a==='close'){st.open=false;aiRender();}
  else if(a==='send'){aiSend();}
  else if(a==='ex'){var inp=document.getElementById('ai-in');if(inp){inp.value=t.textContent;aiSend();}}
  else if(a==='quick'){
    var qm=st.msgs[+t.getAttribute('data-i')],q=qm&&qm.quick&&qm.quick[+t.getAttribute('data-k')];if(!q)return;
    if(q.go==='import-cons'){st.open=false;aiRender();if(typeof openImportCons==='function')openImportCons();}
    else if(q.prompt){var inp2=document.getElementById('ai-in');if(inp2){inp2.value=q.prompt;inp2.focus();}}
  }
  else if(a==='pick-item'||a==='pick-ent'){
    var dd=st.draft;if(!dd||!dd.op)return;
    var v=t.getAttribute('data-cid');
    st.msgs.push({role:'user',text:t.textContent});
    if(a==='pick-item')dd.targetId=v;else dd.ent=v;
    st.msgs.push(aiReply(st,dd,aiEvaluateOp(dd),null));
    aiRender();
  }
  else if(a==='pick'){
    var d=st.draft;if(!d)return;
    var cid=t.getAttribute('data-cid'),c=aiConsList().find(function(k){return String(k.id)===cid;});if(!c)return;
    st.msgs.push({role:'user',text:c.name});
    if(d.ambig&&d.ambig.length){d.ambig.shift();d.cids=d.cids.concat([c.id]);}else d.cids=[c.id];
    var r=aiEvaluate(d);
    if(r.action){st.draft=null;st.msgs.push({role:'assistant',text:r.text,actions:[{tool:r.action.tool,input:r.action.input,status:'pending'}]});}
    else st.msgs.push({role:'assistant',text:r.text,choices:r.choices||null});
    aiRender();
  }
  else if(a==='apply'||a==='cancel'){
    var m=st.msgs[+t.getAttribute('data-i')],ac=m&&m.actions&&m.actions[+t.getAttribute('data-j')];
    if(!ac||ac.status==='done'||ac.status==='cancel')return;
    if(a==='cancel'){ac.status='cancel';ac.result='Annulé';aiRender();return;}
    var r2=aiApply(ac);
    ac.status=r2.ok?'done':'error';ac.result=r2.msg;
    aiRender();
    if(r2.ok)render();
  }
}

function aiSend(){
  var st=aiState(),inp=document.getElementById('ai-in');
  var q=inp?(inp.value||'').trim():'';
  if(!q)return;
  if(inp)inp.value='';
  st.msgs.push({role:'user',text:q.slice(0,2000)});
  try{st.msgs.push(aiRespond(q.slice(0,2000)));}
  catch(err){console.warn('assistant:',err);st.draft=null;st.msgs.push({role:'assistant',text:'Je n’ai pas compris cette demande. Reformulez, par exemple « Crée une mission pour … chez … du … au … à … € ».'});}
  aiRender();
}

/* ── Application d'une action (mêmes règles que les formulaires) ── */
function aiIsDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(new Date(s+'T00:00:00'));}
function aiApply(ac){
  try{
    if(ac.tool==='create_mission')return aiApplyMission(ac.input||{});
    if(ac.tool==='create_leave')return aiApplyLeave(ac.input||{});
    if(ac.tool==='create_consultant')return aiApplyConsultant(ac.input||{});
    if(/^(delete|update)_/.test(ac.tool))return aiApplyOp(ac);
    return {ok:false,msg:'Action non prise en charge.'};
  }catch(e){console.warn('assistant apply:',e);return {ok:false,msg:'Erreur inattendue.'};}
}

function aiApplyMission(x){
  if(AI_MISSION_ROLES.indexOf(S.role)<0)return {ok:false,msg:'Votre rôle ne permet pas de créer des missions.'};
  var allowed={};aiConsList().forEach(function(c){allowed[String(c.id)]=c;});
  var cids=(x.consultant_ids||[]).map(String).filter(function(id,k,arr){return arr.indexOf(id)===k;});
  if(!cids.length)return {ok:false,msg:'Aucun consultant indiqué.'};
  if(cids.some(function(id){return !allowed[id];}))return {ok:false,msg:'Consultant introuvable ou hors de votre périmètre.'};
  var name=String(x.name||'').trim(),cli=String(x.client||'').trim();
  if(!name||!cli)return {ok:false,msg:'Intitulé et client requis.'};
  if(!aiIsDate(x.start_date))return {ok:false,msg:'Date de début invalide.'};
  var ed=x.end_date?String(x.end_date):null;
  if(ed&&(!aiIsDate(ed)||ed<x.start_date))return {ok:false,msg:'Date de fin invalide.'};
  var bt=x.billing_type==='forfait'?'forfait':'at';
  var tjm=Number(x.tjm)||0,deal=Number(x.deal_amount)||0,tmar=(x.target_margin==null||x.target_margin==='')?null:Number(x.target_margin);
  if(S.role==='utilisateur'){
    if(cids.length!==1||cids[0]!==String(S.consId))return {ok:false,msg:'Vous pouvez proposer une mission uniquement pour vous-même.'};
  }else if(bt==='forfait'){
    if(!deal||tmar==null||isNaN(tmar))return {ok:false,msg:'Forfait : montant et marge cible requis.'};
  }else if(!(tjm>0))return {ok:false,msg:'TJM requis pour une mission en assistance technique.'};
  var targets=bt==='forfait'?[cids[0]]:cids;
  if(targets.some(function(c){return tsRangeLocked(allowed[c].id,x.start_date,ed);}))return {ok:false,msg:'Période verrouillée par un Time Sheet approuvé.'};
  var d={name:name,cli:cli,tjm:bt==='forfait'?0:tjm,sd:x.start_date,ed:ed,loc:'',mgr:'',ccn:'',ccr:'',btype:bt,wdays:[1,2,3,4,5],
    deal:bt==='forfait'?deal:0,tmar:bt==='forfait'?tmar:null,pcode:'',wmode:'rec',manualDays:[]};
  if(S.role==='utilisateur'){
    var desc='Ajout de mission — '+esc(cli)+' · '+esc(name)+' début '+fDt(d.sd)+(ed?' fin '+fDt(ed):'');
    submitApproval('miss_add',Object.assign({id:uid(),approver_id:resolveApprover(S._userId)},d,{cid:allowed[cids[0]].id}),desc);
    return {ok:true,msg:'Demande envoyée à votre N+1 pour validation'};
  }
  targets.forEach(function(c){
    var nm=Object.assign({id:uid()},d,{cid:allowed[c].id});
    S.miss=S.miss.concat([nm]);
    sbUpsertMiss(nm).catch(function(e){console.warn('assistant mission:',e);});
  });
  return {ok:true,msg:targets.length>1?targets.length+' missions créées':'Mission créée'};
}

function aiApplyLeave(x){
  var allowed={};aiConsList().forEach(function(c){allowed[String(c.id)]=c;});
  var cid=String(x.consultant_id||'');
  if(!allowed[cid])return {ok:false,msg:'Consultant introuvable ou hors de votre périmètre.'};
  if(LTYPES.indexOf(x.type)<0)return {ok:false,msg:'Type d’absence inconnu.'};
  if(!aiIsDate(x.start_date)||!aiIsDate(x.end_date)||x.end_date<x.start_date)return {ok:false,msg:'Dates invalides.'};
  /* Un consultant / recruteur / BM ne pose des absences que pour lui-même. */
  if((S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales')&&cid!==String(S.consId))return {ok:false,msg:'Vous pouvez poser une absence uniquement pour vous-même.'};
  var rcid=allowed[cid].id;
  if(tsRangeLocked(rcid,x.start_date,x.end_date))return {ok:false,msg:'Période verrouillée par un Time Sheet approuvé.'};
  var bal=checkLeaveBalance(rcid,x.type,x.start_date,x.end_date,null);
  if(bal.capped&&!bal.ok)return {ok:false,msg:'Solde insuffisant ('+bal.label+' : '+fmtJ(bal.remaining)+' restants, '+fmtJ(bal.need)+' demandés).'};
  var approverId=resolveApprover(S._userId),isSelf=!!(S.consId&&cid===String(S.consId));
  var nl={id:uid(),cid:rcid,type:x.type,s:x.start_date,e:x.end_date};
  if(!approverId||!isSelf){
    S.lvs=S.lvs.concat([nl]);
    sbUpsertLeave(nl);
    return {ok:true,msg:'Absence enregistrée'};
  }
  submitApproval('leave_add',Object.assign({},nl,{approver_id:approverId}),'Ajout d’absence — '+esc(x.type)+' du '+fDt(x.start_date)+' au '+fDt(x.end_date));
  return {ok:true,msg:'Demande envoyée à votre N+1 pour validation'};
}

/* ── Création d'un consultant (mêmes valeurs par défaut que le formulaire « Équipe ») ── */
function aiConsDup(name){
  var k=aiN(name||'').trim();if(!k)return false;
  return ((S._all&&S._all.cons)||S.cons||[]).some(function(c){return aiN(c.name).trim()===k;});
}
function aiApplyConsultant(x){
  if(!canEditTeam())return {ok:false,msg:'Votre rôle ne permet pas d’ajouter des consultants.'};
  var name=String(x.name||'').trim();
  if(!name||name.length>120)return {ok:false,msg:'Nom invalide.'};
  if(aiConsDup(name))return {ok:false,msg:'Un consultant porte déjà ce nom.'};
  var email=String(x.email||'').trim().toLowerCase();
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return {ok:false,msg:'Email invalide.'};
  var scr=Number(x.scr);if(!(scr>0))scr=0;
  /* Rattachement : un directeur crée dans son périmètre (comme le formulaire). */
  var rdir=(S.role==='gestionnaire')?(S.dirName||''):'';
  var mgr=rdir?mgrAccountByName(rdir):null;
  var nc={id:uid(),name:name,title:String(x.title||'').trim().slice(0,120),scr:scr,email:email,dir:rdir,
    managerId:mgr?mgr.id:(S.role==='gestionnaire'?S._userId||null:null),buId:(mgr&&mgr.bu_id)||null,
    region:'',mobility:[],arrive:null,depart:null,expertise:[],sectors:[],contract:'salarie',grade:'',modalite:'MS',q2Days:0};
  S.cons=S.cons.concat([nc]);
  if(S._all&&S._all.cons&&S._all.cons!==S.cons)S._all.cons=S._all.cons.concat([nc]);
  try{var pr=sbUpsertCons(nc);if(pr&&pr.catch)pr.catch(function(e){console.warn('assistant consultant:',e);});}catch(e){console.warn('assistant consultant:',e);}
  return {ok:true,msg:'Consultant ajouté'+(scr?'':' — pensez à renseigner son SCR pour le calcul des marges')};
}

/* ═══════════════════════ MODIFIER / SUPPRIMER ═══════════════════════
   « Supprime la mission de Julie chez BNP », « Prolonge la mission de Julie chez
   BNP jusqu'au 31 décembre », « Transforme le congé de Thomas du 22/12 en RTT »,
   « Change le SCR de Julie Martin à 480 », « Supprime le consultant Paul Durand ».
   Ciblage : consultant (+ client pour une mission, + type / dates pour une
   absence) ; plusieurs candidats → boutons de choix. Pour une MODIFICATION, les
   dates et montants de la phrase sont les NOUVELLES valeurs (sauf changement de
   type d'absence « … en RTT », où les dates servent à retrouver l'absence).
   Application : mêmes règles que les boutons de l'app (droits, verrou Time
   Sheet, validation N+1 pour un consultant, solde de congés). */
var AI_LEAVE_RE='(?:un |une |le |la |en )?(?:rtt|formation|conges?|cp|maladie|arret|mission interne|inter[\\s-]?contrat|sans solde|maternite|absence)';
var AI_CREATE_RE=/\b(cree[rz]?|creer|creation|ajoute[rz]?|pose[rz]?|nouvel(?:le)?|nouveau|staffe[rz]?|embauche[rz]?)\b/;
function aiOp(n){
  if(AI_CREATE_RE.test(n))return null; /* une demande de création n'est jamais une modification */
  if(/\b(supprime[rz]?|efface[rz]?|retire[rz]?|enleve[rz]?|annule[rz]?|suppression|vire[rz]?)\b/.test(n))return 'delete';
  if(/\b(modifie[rz]?|modification|change[rz]?|decale[rz]?|deplace[rz]?|prolonge[rz]?|raccourci[rstz]*|avance[rz]?|repousse[rz]?|corrige[rz]?|mets? a jour|mettre a jour|met a jour|transforme[rz]?|renomme[rz]?|augmente[rz]?|baisse[rz]?|passe[rz]? (?:le|la|les|son|sa|ses)|termine[rz]?|arrete[rz]?|stoppe[rz]?)\b/.test(n))return 'update';
  return null;
}
function aiOpEntity(n){
  if(/\bmissions?\b/.test(n)&&!/\bmission interne\b/.test(n))return 'mission';
  if(aiLeaveType(n)||/\b(absences?|conges?)\b/.test(n))return 'leave';
  if(/\b(consultante?s?|collaborat(?:eur|rice)s?|salariee?s?|fiche|scr|cjm|poste|email|e-mail)\b/.test(n))return 'consultant';
  if(/\b(tjm|client)\b/.test(n))return 'mission';
  return null;
}
function aiParseOp(text,n,op,cli,cons,dates,money,self){
  var p={op:op,ent:aiOpEntity(n),cids:cons.ids,ambig:cons.ambig,cli:cli?cli.name:null,sd:dates.sd,ed:dates.ed,
    amounts:money.amounts.map(function(a){return a.v;}),tmar:money.tmar,forfait:money.forfait,self:self,raw:text.trim(),
    ltTarget:null,ltNew:null,consCh:null,endNow:/\b(termine[rz]?|arrete[rz]?|stoppe[rz]?)\b/.test(n)&&!dates.ed};
  /* Type d'absence : « transforme le congé … en RTT » → cible = congé, nouveau type = RTT */
  var sp=new RegExp('\\s(?:en|par)\\s+(?='+AI_LEAVE_RE+'\\b)').exec(n);
  if(sp&&op==='update'){p.ltTarget=aiLeaveType(n.slice(0,sp.index));p.ltNew=aiLeaveType(n.slice(sp.index));}
  else p.ltTarget=aiLeaveType(n);
  if(p.ent==='consultant'&&op==='update')p.consCh=aiConsEdits(text,n);
  return p;
}
/* Nouvelles valeurs d'une fiche consultant (poste, SCR, email, nom). */
function aiConsEdits(text,n){
  var c=aiConsCorrection(text);
  if(c.scr==null&&/\b(scr|cjm|cout)\b/.test(n)){var m=/(\d+(?:[.,]\d+)?)\s*(?:€|euros?)?\s*$/.exec(n.replace(/[.!]+\s*$/,''))||/\b(?:a|de|en)\s+(\d+(?:[.,]\d+)?)/.exec(n.slice(n.search(/\b(scr|cjm|cout)\b/)));if(m)c.scr=parseFloat(m[1].replace(',','.'));}
  if(!c.title){var t=/\bposte\b.*?\b(?:devient|en|par|a|:)\s+([^,;]+)$/.exec(n);if(t){var off=t.index+t[0].length-t[1].length;var v=text.substr(off,t[1].length).trim();if(v)c.title=v.charAt(0).toUpperCase()+v.slice(1);}}
  if(!c.name){var r=/\brenomme[rz]?\b.*?\ben\s+(.+)$/.exec(n);if(r){var o2=r.index+r[0].length-r[1].length;c.name=text.substr(o2,r[1].length).trim();}}
  return c;
}
function aiDraftFromOp(p){
  var d={op:p.op,ent:p.ent,cids:p.cids.slice(),ambig:p.ambig.slice(),cli:p.cli,sd:p.sd,ed:p.ed,amounts:p.amounts.slice(),tmar:p.tmar,
    forfait:p.forfait,ltTarget:p.ltTarget,ltNew:p.ltNew,consCh:p.consCh||{},endNow:p.endNow,targetId:null,ask:null};
  if(!d.cids.length&&p.self&&S.consId)d.cids=[S.consId];
  return d;
}
/* Réponse à une question posée pendant une modification/suppression. */
function aiMergeOp(d,p){
  if(p.op){return;}
  if(p.cids&&p.cids.length){d.cids=p.cids.slice();d.ambig=p.ambig||[];d.targetId=null;}
  else if(p.ambig&&p.ambig.length){d.ambig=p.ambig;}
  if(p.cli)d.cli=p.cli;
  if(d.ent==='consultant'&&d.op==='update'){var c=aiConsEdits(p.raw,aiN(p.raw));
    if(!Object.keys(c).length&&d.ask==='consCh'&&p.raw.length<=60&&!/\d/.test(p.raw))c.title=p.raw.charAt(0).toUpperCase()+p.raw.slice(1);
    Object.keys(c).forEach(function(k){d.consCh[k]=c[k];});}
  if(p.sd)d.sd=p.sd;if(p.ed)d.ed=p.ed;
  if(p.amounts&&p.amounts.length)d.amounts=p.amounts.slice();
  if(p.tmar!=null)d.tmar=p.tmar;
  if(p.ltype){if(d.op==='update'&&d.ask==='lchanges')d.ltNew=p.ltype;else if(!d.ltTarget)d.ltTarget=p.ltype;}
  if(d.ask==='mchanges'&&!(p.amounts&&p.amounts.length)){var v=parseFloat(String(p.raw).replace(/\s/g,'').replace(',','.'));if(v>0)d.amounts=[v];}
}
function aiReply(st,d,r,replaced){
  if(r.action){if(replaced){replaced.status='cancel';replaced.result='Remplacée par la version corrigée';}st.draft=null;
    return {role:'assistant',text:r.text,actions:[{tool:r.action.tool,input:r.action.input,status:'pending'}]};}
  st.draft=r.reset?null:d;
  return {role:'assistant',text:r.text,choices:r.choices||null,quick:r.quick||null};
}
function aiAllCons(){return (S._all&&S._all.cons)||S.cons||[];}
function aiMissLabel(m){return aiConsName(m.cid)+' · '+(m.cli||'—')+' · '+fDt(m.sd)+' → '+(m.ed?fDt(m.ed):'…')+(m.btype==='forfait'?' · forfait':(m.tjm?' · '+m.tjm+' €':''));}
function aiLeaveLabel(l){return aiConsName(l.cid)+' · '+l.type+' · '+fDt(l.s)+(l.e&&l.e!==l.s?' → '+fDt(l.e):'');}
function aiOverlap(s1,e1,s2,e2){return (s1||'0000')<=(e2||'9999')&&(s2||'0000')<=(e1||'9999');}
function aiFindMissions(d,useDates){
  var ids={};d.cids.forEach(function(c){ids[String(c)]=1;});
  var k=d.cli?aiN(d.cli):null;
  return (visibleData().miss||[]).filter(function(m){
    if(d.cids.length&&!ids[String(m.cid)])return false;
    if(k&&aiN(m.cli||'').indexOf(k)<0&&k.indexOf(aiN(m.cli||''))<0)return false;
    if(useDates&&(d.sd||d.ed)&&!aiOverlap(m.sd,m.ed,d.sd||d.ed,d.ed||d.sd))return false;
    return true;
  }).sort(function(a,b){return (b.sd||'').localeCompare(a.sd||'');});
}
function aiFindLeaves(d,useDates){
  var ids={};d.cids.forEach(function(c){ids[String(c)]=1;});
  return (visibleData().lvs||[]).filter(function(l){
    if(d.cids.length&&!ids[String(l.cid)])return false;
    if(d.ltTarget&&l.type!==d.ltTarget&&!(d.ltTarget==='Congé payé'&&/cong/i.test(l.type)))return false;
    if(useDates&&(d.sd||d.ed)&&!aiOverlap(l.s,l.e,d.sd||d.ed,d.ed||d.sd))return false;
    return true;
  }).sort(function(a,b){return (b.s||'').localeCompare(a.s||'');});
}
function aiPickList(items,label){return items.slice(0,6).map(function(x){return {id:x.id,label:label(x),act:'pick-item'};});}

function aiEvaluateOp(d){
  var ask=function(field,msg,choices){d.ask=field;return {text:msg,choices:choices||null};};
  var verb=d.op==='delete'?'supprimer':'modifier';
  var personal=(S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales');
  if(!d.ent){
    if(d.cids.length||d.ambig.length)return ask('ent','Que voulez-vous '+verb+' ?',[{id:'consultant',label:'👤 Le consultant',act:'pick-ent'},{id:'mission',label:'💼 Une mission',act:'pick-ent'},{id:'leave',label:'🌴 Une absence',act:'pick-ent'}]);
    return {text:'Que voulez-vous '+verb+' : un consultant, une mission ou une absence ? Par exemple « '+(d.op==='delete'?'Supprime la mission de Julie Martin chez BNP':'Prolonge la mission de Julie Martin chez BNP jusqu’au 31 décembre')+' ».',reset:true};
  }
  if(d.ambig&&d.ambig.length)return ask('cons','Plusieurs consultants correspondent. Lequel ?',d.ambig[0].map(function(id){return {id:id,label:aiConsName(id)};}));
  /* ── Consultant ── */
  if(d.ent==='consultant'){
    if(!canEditTeam())return {text:'Votre rôle ne permet pas de '+verb+' des consultants.',reset:true};
    if(!d.cids.length)return ask('cons','Quel consultant voulez-vous '+verb+' ?');
    if(d.cids.length>1)return ask('cons','Lequel ?',d.cids.map(function(id){return {id:id,label:aiConsName(id)};}));
    var cid=String(d.cids[0]);
    if(d.op==='delete')return {action:{tool:'delete_consultant',input:{id:cid}},text:'Voici la fiche à supprimer. Vérifiez puis cliquez sur « Supprimer ».'};
    var ch=d.consCh||{};
    if(!Object.keys(ch).length)return ask('consCh','Que voulez-vous modifier pour '+aiConsName(cid)+' ? (ex. « poste Product Owner », « SCR 480 », « email julie@esn.fr »)');
    return {action:{tool:'update_consultant',input:{id:cid,changes:ch}},text:'Voici la modification proposée. Vérifiez puis cliquez sur « Modifier ».'};
  }
  /* ── Mission ── */
  if(d.ent==='mission'){
    if(AI_MISSION_ROLES.indexOf(S.role)<0)return {text:'Votre rôle ne permet pas de '+verb+' des missions.',reset:true};
    if(S.role==='utilisateur'&&!d.cids.length&&S.consId)d.cids=[S.consId];
    var target=d.targetId?(S.miss||[]).find(function(m){return String(m.id)===String(d.targetId);}):null;
    if(!target){
      var ms=aiFindMissions(d,d.op==='delete');
      if(!ms.length&&d.op==='delete'&&(d.sd||d.ed))ms=aiFindMissions(d,false);
      if(!ms.length)return {text:'Je ne trouve aucune mission correspondante'+(d.cids.length?' pour '+d.cids.map(aiConsName).join(', '):'')+(d.cli?' chez '+d.cli:'')+'.',reset:true};
      if(ms.length>1)return ask('item',ms.length+' missions correspondent. Laquelle ?',aiPickList(ms,aiMissLabel));
      target=ms[0];d.targetId=target.id;
    }
    if(d.op==='delete')return {action:{tool:'delete_mission',input:{id:String(target.id)}},text:'Voici la mission à supprimer. Vérifiez puis cliquez sur « Supprimer ».'};
    var mc={};
    if(d.sd)mc.sd=d.sd;if(d.ed)mc.ed=d.ed;
    if(d.endNow&&!d.ed)mc.ed=TODAY;
    if(d.amounts&&d.amounts.length){if(target.btype==='forfait'){mc.deal=Math.max.apply(null,d.amounts);}else mc.tjm=d.amounts[0];}
    if(d.tmar!=null&&target.btype==='forfait')mc.tmar=d.tmar;
    if(!Object.keys(mc).length)return ask('mchanges','Que voulez-vous modifier pour cette mission ('+aiMissLabel(target)+') ? Les dates (« du 10 au 30 novembre », « jusqu’au 31 décembre ») ou le '+(target.btype==='forfait'?'montant':'TJM')+' (« 700 € ») ?');
    return {action:{tool:'update_mission',input:{id:String(target.id),changes:mc}},text:'Voici la modification proposée. Vérifiez puis cliquez sur « Modifier ».'};
  }
  /* ── Absence ── */
  if(!d.cids.length&&personal&&S.consId)d.cids=[S.consId];
  var lvT=d.targetId?(S.lvs||[]).find(function(l){return String(l.id)===String(d.targetId);}):null;
  /* Les dates identifient l'absence pour une suppression, ou pour un simple changement de type. */
  var datesIdentify=d.op==='delete'||!!d.ltNew;
  if(!lvT){
    var ls=aiFindLeaves(d,datesIdentify);
    if(!ls.length&&datesIdentify&&(d.sd||d.ed))ls=aiFindLeaves(d,false);
    if(!ls.length)return {text:'Je ne trouve aucune absence correspondante'+(d.cids.length?' pour '+d.cids.map(aiConsName).join(', '):'')+'.',reset:true};
    if(ls.length>1)return ask('item',ls.length+' absences correspondent. Laquelle ?',aiPickList(ls,aiLeaveLabel));
    lvT=ls[0];d.targetId=lvT.id;
  }
  if(d.op==='delete')return {action:{tool:'delete_leave',input:{id:String(lvT.id)}},text:'Voici l’absence à supprimer. Vérifiez puis cliquez sur « Supprimer ».'};
  var lc={};
  if(d.ltNew&&d.ltNew!==lvT.type)lc.type=d.ltNew;
  if(!datesIdentify){if(d.sd)lc.s=d.sd;if(d.ed)lc.e=d.ed;if(lc.s&&!lc.e&&lvT.e<lc.s)lc.e=lc.s;}
  if(!Object.keys(lc).length)return ask('lchanges','Que voulez-vous modifier pour cette absence ('+aiLeaveLabel(lvT)+') ? Les dates (« du 29 au 31 décembre ») ou le type (« en RTT ») ?');
  return {action:{tool:'update_leave',input:{id:String(lvT.id),changes:lc}},text:'Voici la modification proposée. Vérifiez puis cliquez sur « Modifier ».'};
}

/* Carte d'une suppression / modification : état actuel et, pour une modification, avant → après. */
function aiOpCard(ac,i,j){
  var x=ac.input||{},ch=x.changes||{},rows=[],title='',kind=ac.tool.split('_')[1],del=/^delete/.test(ac.tool);
  var it=kind==='consultant'?aiAllCons().find(function(c){return String(c.id)===String(x.id);})
    :kind==='mission'?(S.miss||[]).find(function(m){return String(m.id)===String(x.id);})
    :(S.lvs||[]).find(function(l){return String(l.id)===String(x.id);});
  var arrow=function(a,b){return b===undefined?a:(a+' → '+b);};
  var eur=function(v){return v!=null&&v!==''?Number(v).toLocaleString('fr-FR')+' €':'—';};
  if(!it&&ac.status!=='done')rows.push(['⚠','Élément introuvable (déjà supprimé ?)']);
  else if(it&&kind==='consultant'){
    title=del?'🗑 Supprimer le consultant':'✏️ Modifier le consultant';
    rows.push(['Nom',arrow(it.name,ch.name)]);rows.push(['Poste',arrow(it.title||'—',ch.title)]);
    rows.push(['SCR',arrow(eur(it.scr),ch.scr!=null?eur(ch.scr):undefined)]);rows.push(['Email',arrow(it.email||'—',ch.email)]);
    if(del){var nm=(S.miss||[]).filter(function(m){return String(m.cid)===String(it.id);}).length;if(nm)rows.push(['⚠',nm+' mission(s) rattachée(s) à ce consultant']);}
  }else if(it&&kind==='mission'){
    title=del?'🗑 Supprimer la mission':'✏️ Modifier la mission';
    rows.push(['Consultant',aiConsName(it.cid)]);rows.push(['Mission',it.name]);rows.push(['Client',it.cli]);
    rows.push(['Début',arrow(fDt(it.sd),ch.sd?fDt(ch.sd):undefined)]);
    rows.push(['Fin',arrow(it.ed?fDt(it.ed):'sans date de fin',ch.ed?fDt(ch.ed):undefined)]);
    if(it.btype==='forfait')rows.push(['Forfait',arrow(eur(it.deal),ch.deal!=null?eur(ch.deal):undefined)+(ch.tmar!=null?' · marge '+ch.tmar+' %':'')]);
    else rows.push(['TJM',arrow(eur(it.tjm),ch.tjm!=null?eur(ch.tjm):undefined)]);
  }else if(it){
    title=del?'🗑 Supprimer l’absence':'✏️ Modifier l’absence';
    rows.push(['Consultant',aiConsName(it.cid)]);rows.push(['Type',arrow(it.type,ch.type)]);
    rows.push(['Du',arrow(fDt(it.s),ch.s?fDt(ch.s):undefined)]);rows.push(['Au',arrow(fDt(it.e),ch.e?fDt(ch.e):undefined)]);
  }
  if(!title)title=del?'🗑 Suppression':'✏️ Modification';
  var st=ac.status;
  var foot=st==='done'?'<div class="ai-st ok">✓ '+esc(ac.result||'Fait')+'</div>'
    :st==='cancel'?'<div class="ai-st">'+esc(ac.result||'Annulé')+'</div>'
    :st==='error'?'<div class="ai-st err">⚠ '+esc(ac.result||'Erreur')+'</div>'
      +'<div class="ai-act"><button class="ai-ok" data-ai="apply" data-i="'+i+'" data-j="'+j+'">Réessayer</button></div>'
    :'<div class="ai-act"><button class="'+(del?'ai-del':'ai-ok')+'" data-ai="apply" data-i="'+i+'" data-j="'+j+'">'+(del?'Supprimer':'Modifier')+'</button><button class="ai-no" data-ai="cancel" data-i="'+i+'" data-j="'+j+'">Annuler</button></div>';
  return '<div class="ai-card'+(del?' del':'')+'"><div class="ai-ct">'+title+'</div>'
    +rows.map(function(r){return '<div class="ai-row"><span>'+esc(r[0])+'</span><b>'+esc(r[1]==null?'—':r[1])+'</b></div>';}).join('')
    +foot+'</div>';
}

/* ── Application (mêmes règles que les boutons de l'app) ── */
function aiApplyOp(ac){
  var x=ac.input||{},id=String(x.id||''),ch=x.changes||{};
  var inScope=function(cid){return aiConsList().some(function(c){return String(c.id)===String(cid);});};
  if(ac.tool==='delete_consultant'||ac.tool==='update_consultant'){
    if(!canEditTeam())return {ok:false,msg:'Votre rôle ne permet pas de modifier les consultants.'};
    var c=aiAllCons().find(function(k){return String(k.id)===id;});
    if(!c||!inScope(c.id))return {ok:false,msg:'Consultant introuvable ou hors de votre périmètre.'};
    if(ac.tool==='delete_consultant'){
      if(S.consId&&String(c.id)===String(S.consId))return {ok:false,msg:'Vous ne pouvez pas supprimer votre propre fiche.'};
      S.cons=S.cons.filter(function(k){return String(k.id)!==id;});
      if(S._all&&S._all.cons&&S._all.cons!==S.cons)S._all.cons=S._all.cons.filter(function(k){return String(k.id)!==id;});
      try{var p1=sbDel('consultants',c.id);if(p1&&p1.catch)p1.catch(function(e){console.warn('assistant del cons:',e);});}catch(e){}
      return {ok:true,msg:'Consultant supprimé'};
    }
    var f={};
    if(ch.name!=null){var nn=String(ch.name).trim();if(!nn)return {ok:false,msg:'Nom invalide.'};
      if(aiN(nn)!==aiN(c.name)&&aiConsDup(nn))return {ok:false,msg:'Un consultant porte déjà ce nom.'};f.name=nn;}
    if(ch.title!=null)f.title=String(ch.title).trim().slice(0,120);
    if(ch.scr!=null){var sc=Number(ch.scr);if(!(sc>=0))return {ok:false,msg:'SCR invalide.'};f.scr=sc;}
    if(ch.email!=null){var em=String(ch.email).trim().toLowerCase();if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em))return {ok:false,msg:'Email invalide.'};f.email=em;}
    if(!Object.keys(f).length)return {ok:false,msg:'Aucune modification.'};
    var nc;S.cons=S.cons.map(function(k){return String(k.id)===id?(nc=Object.assign({},k,f)):k;});
    if(S._all&&S._all.cons&&S._all.cons!==S.cons)S._all.cons=S._all.cons.map(function(k){return String(k.id)===id?nc:k;});
    if(nc){try{var p2=sbUpsertCons(nc);if(p2&&p2.catch)p2.catch(function(e){console.warn('assistant upd cons:',e);});}catch(e){}}
    return {ok:true,msg:'Consultant modifié'};
  }
  if(ac.tool==='delete_mission'||ac.tool==='update_mission'){
    if(AI_MISSION_ROLES.indexOf(S.role)<0)return {ok:false,msg:'Votre rôle ne permet pas de modifier les missions.'};
    var m=(S.miss||[]).find(function(k){return String(k.id)===id;});
    if(!m||!inScope(m.cid))return {ok:false,msg:'Mission introuvable ou hors de votre périmètre.'};
    if(S.role==='utilisateur'&&String(m.cid)!==String(S.consId))return {ok:false,msg:'Vous pouvez seulement agir sur vos propres missions.'};
    var lockedOld=(m.wmode==='man')?tsDaysLocked(m.cid,m.manualDays):tsRangeLocked(m.cid,m.sd,m.ed);
    if(lockedOld)return {ok:false,msg:'Mission verrouillée par un Time Sheet approuvé.'};
    if(ac.tool==='delete_mission'){
      if(S.role==='utilisateur'){submitApproval('miss_del',{id:m.id,approver_id:resolveApprover(S._userId)},'Suppression de mission — '+esc(m.cli)+' · '+esc(m.name));return {ok:true,msg:'Demande de suppression envoyée à votre N+1'};}
      S.miss=S.miss.filter(function(k){return String(k.id)!==id;});
      try{var p3=sbDel('missions',m.id);if(p3&&p3.catch)p3.catch(function(e){console.warn('assistant del miss:',e);});}catch(e){}
      return {ok:true,msg:'Mission supprimée'};
    }
    var nm2=Object.assign({},m);
    if(ch.sd!=null){if(!aiIsDate(ch.sd))return {ok:false,msg:'Date de début invalide.'};nm2.sd=ch.sd;}
    if(ch.ed!=null){if(!aiIsDate(ch.ed))return {ok:false,msg:'Date de fin invalide.'};nm2.ed=ch.ed;}
    if(nm2.ed&&nm2.ed<nm2.sd)return {ok:false,msg:'La date de fin précède la date de début.'};
    if(ch.tjm!=null){if(!(Number(ch.tjm)>0))return {ok:false,msg:'TJM invalide.'};nm2.tjm=Number(ch.tjm);}
    if(ch.deal!=null){if(!(Number(ch.deal)>0))return {ok:false,msg:'Montant invalide.'};nm2.deal=Number(ch.deal);}
    if(ch.tmar!=null)nm2.tmar=Number(ch.tmar);
    if(nm2.wmode!=='man'&&tsRangeLocked(nm2.cid,nm2.sd,nm2.ed))return {ok:false,msg:'Nouvelle période verrouillée par un Time Sheet approuvé.'};
    if(S.role==='utilisateur'){submitApproval('miss_edit',Object.assign({},nm2,{approver_id:resolveApprover(S._userId)}),'Modification de mission — '+esc(m.cli)+' · '+esc(m.name));return {ok:true,msg:'Demande de modification envoyée à votre N+1'};}
    S.miss=S.miss.map(function(k){return String(k.id)===id?nm2:k;});
    sbUpsertMiss(nm2).catch(function(e){console.warn('assistant upd miss:',e);});
    return {ok:true,msg:'Mission modifiée'};
  }
  if(ac.tool==='delete_leave'||ac.tool==='update_leave'){
    var l=(S.lvs||[]).find(function(k){return String(k.id)===id;});
    if(!l||!inScope(l.cid))return {ok:false,msg:'Absence introuvable ou hors de votre périmètre.'};
    if((S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales')&&String(l.cid)!==String(S.consId))return {ok:false,msg:'Vous pouvez seulement agir sur vos propres absences.'};
    if(tsRangeLocked(l.cid,l.s,l.e))return {ok:false,msg:'Absence verrouillée par un Time Sheet approuvé.'};
    if(ac.tool==='delete_leave'){
      if(S.role==='utilisateur'){submitApproval('leave_del',{id:l.id,approver_id:resolveApprover(S._userId)},'Suppression d’absence — '+esc(l.type)+' du '+fDt(l.s)+' au '+fDt(l.e));return {ok:true,msg:'Demande de suppression envoyée à votre N+1'};}
      S.lvs=S.lvs.filter(function(k){return String(k.id)!==id;});
      try{var p4=sbDel('leaves',l.id);if(p4&&p4.catch)p4.catch(function(e){console.warn('assistant del lv:',e);});}catch(e){}
      return {ok:true,msg:'Absence supprimée'};
    }
    var nl=Object.assign({},l);
    if(ch.type!=null){if(LTYPES.indexOf(ch.type)<0)return {ok:false,msg:'Type d’absence inconnu.'};nl.type=ch.type;}
    if(ch.s!=null){if(!aiIsDate(ch.s))return {ok:false,msg:'Date invalide.'};nl.s=ch.s;}
    if(ch.e!=null){if(!aiIsDate(ch.e))return {ok:false,msg:'Date invalide.'};nl.e=ch.e;}
    if(nl.e<nl.s)return {ok:false,msg:'La date de fin précède la date de début.'};
    if(tsRangeLocked(nl.cid,nl.s,nl.e))return {ok:false,msg:'Nouvelle période verrouillée par un Time Sheet approuvé.'};
    var bal=checkLeaveBalance(nl.cid,nl.type,nl.s,nl.e,l.id);
    if(bal.capped&&!bal.ok)return {ok:false,msg:'Solde insuffisant ('+bal.label+' : '+fmtJ(bal.remaining)+' restants, '+fmtJ(bal.need)+' demandés).'};
    var approverId=resolveApprover(S._userId),isSelf=!!(S.consId&&String(nl.cid)===String(S.consId));
    if(approverId&&isSelf){submitApproval('leave_edit',Object.assign({},nl,{approver_id:approverId}),'Modification d’absence — '+esc(nl.type)+' du '+fDt(nl.s)+' au '+fDt(nl.e));return {ok:true,msg:'Demande de modification envoyée à votre N+1'};}
    S.lvs=S.lvs.map(function(k){return String(k.id)===id?nl:k;});
    sbUpsertLeave(nl);
    return {ok:true,msg:'Absence modifiée'};
  }
  return {ok:false,msg:'Action non prise en charge.'};
}
