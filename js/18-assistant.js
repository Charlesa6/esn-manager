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
  return {
    intent:aiIntent(n),ltype:aiLeaveType(n),self:self,
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
  var sAsk=function(field,msg,extra){d.ask=field;return {text:msg,choices:extra||null};};
  var personal=(S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales');
  if(!d.intent)return {text:'Je sais créer des missions et des absences. Essayez par exemple « Crée une mission pour Sophie Martin chez BNP Paribas du 3 au 28 novembre à 650 € ».'};
  if(d.intent==='mission'&&AI_MISSION_ROLES.indexOf(S.role)<0)return {text:'Votre rôle ne permet pas de créer des missions.',reset:true};
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
  if(ac.tool==='create_mission')return {intent:'mission',cids:(x.consultant_ids||[]).slice(),ambig:[],cli:x.client,name:x.name,sd:x.start_date,ed:x.end_date,bt:x.billing_type,tjm:x.tjm,deal:x.deal_amount,tmar:x.target_margin};
  return {intent:'leave',cids:[x.consultant_id],ambig:[],ltype:x.type,sd:x.start_date,ed:x.end_date};
}
function aiLastPending(){
  var ms=aiState().msgs;
  for(var i=ms.length-1;i>=0;i--){var a=(ms[i].actions||[]).filter(function(x){return x.status==='pending';});if(a.length)return a[a.length-1];if(ms[i].role==='user')continue;}
  return null;
}

/* Traite un message utilisateur et renvoie la réponse de l'assistant. */
function aiRespond(text){
  var st=aiState(),p=aiParse(text);
  if(p.help)return {role:'assistant',text:'Je peux créer pour vous :\n• une mission — « Crée une mission pour Julie Martin chez BNP Paribas du 3 au 28 novembre à 650 € »\n• une absence — « Pose-moi un congé du 22 au 26 décembre », « RTT vendredi pour Thomas »\nJe vous demande ce qui manque, et rien n’est créé sans votre confirmation.'};
  var startNew=!!(p.intent&&(p.cids.length||p.cli||p.sd||/\b(cree|creer|ajoute|ajouter|pose|poser|nouvelle?|staffe|staffer|place|placer)\b/.test(aiN(text))));
  var d=null,replaced=null;
  if(startNew)d={cids:[],ambig:[]};
  else if(st.draft)d=st.draft;
  else{var lp=aiLastPending();if(lp&&(p.cids.length||p.cli||p.sd||p.ed||p.amounts.length||p.ltype||p.tmar!=null||p.forfait)){d=aiDraftFromAction(lp);replaced=lp;}}
  if(!d)d={cids:[],ambig:[]};
  aiMerge(d,p);
  var r=aiEvaluate(d);
  if(r.action){
    if(replaced){replaced.status='cancel';replaced.result='Remplacée par la version corrigée';}
    st.draft=null;
    return {role:'assistant',text:r.text,actions:[{tool:r.action.tool,input:r.action.input,status:'pending'}]};
  }
  st.draft=r.reset?null:d;
  return {role:'assistant',text:r.text,choices:r.choices||null};
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
  }else{btn.style.display='';return;} /* déjà monté : on ne re-rend pas le panneau (évite de voler le focus) */
  btn.style.display='';
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
  var intro='<div class="ai-msg a"><div class="ai-b">Bonjour ! Dites-moi ce que vous voulez créer, par exemple :'
    +(AI_MISSION_ROLES.indexOf(S.role)>=0?'<button class="ai-ex" data-ai="ex">Crée une mission pour '+esc(ex1)+' chez BNP Paribas du 3 au 28 novembre à 650 €</button>':'')
    +'<button class="ai-ex" data-ai="ex">Pose-moi un congé payé du 22 au 26 décembre</button></div></div>';
  var last=st.msgs.length-1;
  var body=st.msgs.map(function(m,i){
    var h='<div class="ai-msg '+(m.role==='user'?'u':'a')+'">';
    if(m.text)h+='<div class="ai-b">'+esc(m.text).replace(/\n/g,'<br>')+'</div>';
    if(m.choices&&i===last)h+='<div class="ai-choices">'+m.choices.map(function(c){return '<button class="ai-ex" data-ai="pick" data-cid="'+esc(c.id)+'">'+esc(c.label)+'</button>';}).join('')+'</div>';
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
