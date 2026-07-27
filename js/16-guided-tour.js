/* ══════════════════════════════════════════════════════════════════════════
   VISITE GUIDÉE (mode démo) — parcours auto-joué de ~10 min.
   Navigue dans tous les onglets et déroule un scénario vivant : création d'un
   candidat, d'une opportunité, assignation à une fiche, poste pourvu → mission
   forfait, opportunité gagnée → mission. Overlay narratif (ajouté au <body>, il
   survit aux render() qui n'écrivent que #sb/#mc/#md), avec pause / suivant /
   précédent / arrêt et barre de progression sur 10:00.
   Tout est piloté par des mutations de S + render() (pas de saisie simulée).
   ══════════════════════════════════════════════════════════════════════════ */

var TOUR_TOTAL_MS=600000;            /* 10 minutes pile (somme des durées d'étapes) */
var _tourTimer=null, _tourTick=null; /* timers : avance d'étape + rafraîchissement barre */
var _tourSteps=null, _tourCum=null;  /* étapes + durées cumulées (pour la progression) */
var _tourStepStart=0, _tourRemaining=0;
var _tourSavedConfirm=null, _tourSavedAlert=null;

/* Décalage de dates relatives (démo toujours « à venir »). */
function _tourDate(n){var d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

/* ── Actions scénarisées (idempotentes : ré-exécutables via Précédent/Suivant) ── */
function _tourAddCandidate(){
  if(!(S.cands||[]).some(function(c){return c.id==='tour_cand';})){
    S.cands=(S.cands||[]).concat([{id:'tour_cand',name:'Nadia El Amrani',expertise:['Java','Spring','Microservices'],sectors:['Banque & Finance'],locations:['Lyon'],locTarget:'Lyon',nationality:'Française',reqSalary:52000,yearsExp:6,status:'rh_a',marginPct:29,createdBy:'demo',feedbacks:[],cgiMeetings:[],cvFiles:[]}]);
  }
}
function _tourAddOpp(){
  if(!(S.bizOpps||[]).some(function(o){return o.id==='tour_opp';})){
    S.bizOpps=(S.bizOpps||[]).concat([{id:'tour_opp',name:'Build Data Platform',account_id:'a1',contact_id:'ct1',status:'proposition',btype:'at',
      tjm_cible:720,jours_estimes:180,deal_amount:null,date_start:_tourDate(45),date_end:_tourDate(285),date_closing:_tourDate(15),probability:60,
      consultant_ids:['d3'],opp_team:null,req_expertise:['Python','Data'],location:'Lyon',req_seniority:'senior',req_sector:'Banque & Finance',
      assigned_to:'Marie Lefebvre',owner_name:'Marie Lefebvre',bu_id:null,notes:'Construction d\'une data platform pour la BU Risques.',linked_mission_id:null}]);
  }
}
function _tourAssignCand(){
  var j=(S.jobs||[]).find(function(x){return x.id==='j1';});
  if(j&&(j.candidateIds||[]).indexOf('tour_cand')<0){
    var ids=(j.candidateIds||[]).concat(['tour_cand']);
    S.jobs=(S.jobs||[]).map(function(x){return x.id==='j1'?Object.assign({},x,{candidateIds:ids}):x;});
  }
}
function _tourFillJob(){
  var j=(S.jobs||[]).find(function(x){return x.id==='j2';});
  if(j&&j.status!=='pourvu'){
    var nj=Object.assign({},j,{status:'pourvu'});
    S.jobs=(S.jobs||[]).map(function(x){return x.id==='j2'?nj:x;});
    jobFillToMissions(nj); /* confirm/alert neutralisés pendant la visite */
  }
}
function _tourWinOpp(){
  var o=(S.bizOpps||[]).find(function(x){return x.id==='tour_opp';});
  if(o&&o.status!=='gagne')bizOppToMission('tour_opp');
}

/* ── Étapes (title/text/dur + act de navigation). Durées : somme = 600 000 ms ── */
function _tourBuildSteps(){
  return [
    {title:'Bienvenue sur Konsilys',text:'Konsilys pilote toute l\'activité d\'une ESN : staffing, marge, recrutement et CRM. Cette visite de 10 minutes parcourt chaque onglet et crée en direct un candidat, une opportunité et des missions.',dur:25000,act:function(){S.tab='kpis';}},
    {title:'KPIs — le pilotage',text:'La barre de tête agrège CA, marge et taux de staffing sur l\'exercice. C\'est la photo instantanée de la performance, déclinable par BU et par manager.',dur:30000,act:function(){S.tab='kpis';S.quarter=null;}},
    {title:'Dashboard',text:'Vue d\'ensemble : prochaines arrivées, missions en cours, alertes. Le tableau de bord opérationnel du quotidien.',dur:30000,act:function(){S.tab='dashboard';}},
    {title:'Équipe & hiérarchie',text:'Les consultants, leur rattachement N+1 et leur BU. Le cloisonnement par BU s\'applique partout (chaque manager ne voit que son périmètre).',dur:25000,act:function(){S.tab='teams';}},
    {title:'Opportunités — le CRM',text:'Le pipeline commercial : comptes, contacts, deals pondérés par leur probabilité. Ici, deux affaires en cours chez BNP Paribas et TotalEnergies.',dur:30000,act:function(){S.tab='business';S.bizTab='pipeline';S.bizModal=null;}},
    {title:'On crée une opportunité',text:'Nouveau deal « Build Data Platform » chez BNP Paribas (720 €/j, 180 jours). Il vient enrichir le pipeline pondéré — on le gagnera plus loin dans la visite.',dur:40000,act:function(){_tourAddOpp();S.tab='business';S.bizTab='pipeline';S.bizModal=null;}},
    {title:'Vivier candidats',text:'Le recrutement partagé de l\'entreprise : chaque profil porte ses expertises, sa localisation et son TJM de revente calculé automatiquement.',dur:25000,act:function(){S.tab='recrutement';S.recTab='cands';S.recSel=null;S.jobSel=null;}},
    {title:'On crée un candidat',text:'Nadia El Amrani (Java / Spring, 6 ans, Lyon) entre dans le vivier. Sa fiche récapitule expertises, secteurs et marge cible.',dur:40000,act:function(){_tourAddCandidate();S.tab='recrutement';S.recTab='cands';S.jobSel=null;S.recSel='tour_cand';}},
    {title:'Postes à pourvoir',text:'Les besoins de recrutement, souvent issus d\'un deal CRM (icône 🔗). On clique une fiche pour voir les candidats suggérés par matching d\'expertises.',dur:30000,act:function(){S.tab='recrutement';S.recTab='jobs';S.recSel=null;S.jobSel=null;}},
    {title:'On assigne le candidat',text:'Nadia est assignée à la fiche « Développeur Fullstack ». L\'assignation se retrouve des deux côtés — fiche et candidat — et prépare la mission.',dur:35000,act:function(){_tourAssignCand();S.tab='recrutement';S.recTab='jobs';S.recSel=null;S.jobSel='j1';}},
    {title:'Poste pourvu → mission auto',text:'On marque « Architecte Cloud » pourvu : le candidat assigné est recruté à la volée (devient consultant) et une mission FORFAIT est créée automatiquement, le montant du deal réparti au prorata.',dur:40000,act:function(){_tourFillJob();S.tab='recrutement';S.recTab='jobs';S.recSel=null;S.jobSel='j2';}},
    {title:'Opportunité gagnée → mission',text:'On gagne le deal « Build Data Platform » : une mission AT est générée pour le consultant positionné, et l\'opportunité passe au vert. Du prospect à la mission, sans ressaisie.',dur:40000,act:function(){_tourWinOpp();S.tab='business';S.bizTab='pipeline';S.bizModal=null;}},
    {title:'Intercontrats',text:'Le pilotage du staffing : consultants par date d\'atterrissage, opportunités pressenties, concrétisation en mission. Anticiper les intercontrats, c\'est protéger la marge.',dur:30000,act:function(){S.tab='opportunites';}},
    {title:'Missions',text:'Toutes les missions, dont les deux créées à l\'instant. Chacune porte son TJM, ses dates, son type (AT ou forfait) et son consultant.',dur:35000,act:function(){S.tab='missions';}},
    {title:'Planning de charge',text:'La charge par consultant semaine après semaine : missions, disponibilités et absences, pour repérer d\'un coup d\'œil les creux et les sur-staffings.',dur:30000,act:function(){S.tab='planning';}},
    {title:'Activité',text:'Le suivi d\'activité individuel : jours facturés, internes, congés — la base du calcul de marge.',dur:20000,act:function(){S.tab='activite';}},
    {title:'Time Sheet (CRA)',text:'Les comptes rendus d\'activité hebdomadaires, avec workflow de soumission et de validation.',dur:20000,act:function(){S.tab='timesheet';}},
    {title:'Absences',text:'Congés et RTT avec quotas, posés par les consultants et validés par le N+1. La cohérence avec le CRA est vérifiée automatiquement.',dur:20000,act:function(){S.tab='leaves';}},
    {title:'Approbations',text:'Le point d\'entrée du manager : absences et CRA en attente, approuvés en un clic selon la hiérarchie N+1.',dur:20000,act:function(){S.tab='approvals';}},
    {title:'À vous de jouer',text:'Vous avez vu le cycle complet : commercial → recrutement → staffing → mission → marge, dans un espace isolé par entreprise. Créez votre compte pour démarrer. Merci !',dur:35000,act:function(){S.tab='help';}}
  ];
}

/* ── Contrôle du minuteur ── */
function _tourClearTimers(){if(_tourTimer){clearTimeout(_tourTimer);_tourTimer=null;}if(_tourTick){clearInterval(_tourTick);_tourTick=null;}}
function _tourSchedule(ms){
  _tourClearTimers();
  _tourStepStart=Date.now();_tourRemaining=ms;
  _tourTimer=setTimeout(function(){_tourGoto(S.tour.idx+1);},ms);
  _tourTick=setInterval(_tourRenderOverlay,500);
}
function _tourGoto(i){
  if(!S.tour)return;
  _tourClearTimers();
  if(i>=_tourSteps.length){_tourFinish();return;}
  if(i<0)i=0;
  S.tour.idx=i;
  var step=_tourSteps[i];
  try{step.act();}catch(e){console.warn('tour act:',e);}
  render();
  if(S.tour.playing)_tourSchedule(step.dur);else{_tourStepStart=Date.now();_tourRemaining=step.dur;}
  _tourRenderOverlay();
}

/* ── Commandes exposées (appelées en inline onclick depuis l'overlay/bannière) ── */
function startGuidedTour(){
  if(!S.demo)return;
  _tourEndTimers();
  if(typeof loadDemoData==='function')loadDemoData(); /* repart d'un état propre à chaque lancement */
  /* Neutralise les confirm()/alert() des actions scénarisées pendant toute la visite. */
  _tourSavedConfirm=window.confirm;_tourSavedAlert=window.alert;
  window.confirm=function(){return true;};window.alert=function(){};
  _tourSteps=_tourBuildSteps();
  _tourCum=[];var acc=0;for(var k=0;k<_tourSteps.length;k++){_tourCum[k]=acc;acc+=_tourSteps[k].dur;}
  S.tour={active:true,playing:true,idx:0,finished:false};
  _tourGoto(0);
}
function tourToggle(){
  if(!S.tour||S.tour.finished)return;
  var step=_tourSteps[S.tour.idx];
  if(S.tour.playing){
    _tourRemaining=Math.max(0,step.dur-(Date.now()-_tourStepStart));
    S.tour.playing=false;_tourClearTimers();
  }else{
    S.tour.playing=true;_tourSchedule(_tourRemaining>0?_tourRemaining:step.dur);
  }
  _tourRenderOverlay();
}
function tourNext(){if(S.tour&&!S.tour.finished)_tourGoto(S.tour.idx+1);}
function tourPrev(){if(S.tour&&!S.tour.finished)_tourGoto(S.tour.idx-1);}
function _tourEndTimers(){_tourClearTimers();}
function _tourRestoreDialogs(){if(_tourSavedConfirm){window.confirm=_tourSavedConfirm;_tourSavedConfirm=null;}if(_tourSavedAlert){window.alert=_tourSavedAlert;_tourSavedAlert=null;}}
function tourStop(){
  _tourEndTimers();_tourRestoreDialogs();
  S.tour=null;_tourUnmount();
  if(typeof render==='function')render();
}
function tourRestart(){startGuidedTour();}
function _tourFinish(){
  _tourEndTimers();_tourRestoreDialogs();
  if(S.tour){S.tour.finished=true;S.tour.playing=false;}
  _tourRenderOverlay();
}

/* ── Overlay ── */
function _tourMount(){
  var ov=document.getElementById('tour-ov');
  if(!ov){ov=document.createElement('div');ov.id='tour-ov';document.body.appendChild(ov);}
  return ov;
}
function _tourUnmount(){var ov=document.getElementById('tour-ov');if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);}
function _tourFmt(ms){var s=Math.max(0,Math.round(ms/1000));var m=Math.floor(s/60);var r=s%60;return m+':'+String(r).padStart(2,'0');}
function _tourElapsed(){
  if(!S.tour)return 0;
  var base=_tourCum[S.tour.idx]||0;var step=_tourSteps[S.tour.idx];
  var into=S.tour.playing?Math.min(step.dur,Date.now()-_tourStepStart):(step.dur-(_tourRemaining||step.dur));
  return Math.min(TOUR_TOTAL_MS,base+Math.max(0,into));
}
function _tourRenderOverlay(){
  if(!S.tour){_tourUnmount();return;}
  var ov=_tourMount();
  var n=_tourSteps.length, i=S.tour.idx, step=_tourSteps[i];
  var pct=Math.min(100,Math.round(_tourElapsed()/TOUR_TOTAL_MS*100));
  var btn=function(label,onclick,primary){return '<button onclick="'+onclick+'" style="font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer;border:1px solid '+(primary?'#7c3aed':'#e2e8f0')+';background:'+(primary?'#7c3aed':'#fff')+';color:'+(primary?'#fff':'#334155')+'">'+label+'</button>';};
  var head, body, controls;
  if(S.tour.finished){
    head='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><span style="font-size:11px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:.05em">✓ Visite terminée</span></div>';
    body='<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:4px">Merci d\'avoir suivi la visite</div><div style="font-size:12.5px;color:#475569;line-height:1.5">Vous avez parcouru tous les onglets et créé un candidat, une opportunité et deux missions. Relancez-la ou explorez librement.</div>';
    controls=btn('↻ Recommencer','tourRestart()',true)+btn('Fermer','tourStop()');
    pct=100;
  }else{
    head='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">'
      +'<span style="font-size:11px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.05em">▶ Visite guidée · étape '+(i+1)+'/'+n+'</span>'
      +'<span style="font-size:11px;font-weight:700;color:#94a3b8">'+_tourFmt(_tourElapsed())+' / '+_tourFmt(TOUR_TOTAL_MS)+'</span></div>';
    body='<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">'+esc(step.title)+'</div>'
      +'<div style="font-size:12.5px;color:#475569;line-height:1.5">'+esc(step.text)+'</div>';
    controls=btn(S.tour.playing?'⏸ Pause':'▶ Reprendre','tourToggle()',true)
      +btn('⏮','tourPrev()')+btn('⏭ Suivant','tourNext()')+btn('✕ Quitter','tourStop()');
  }
  ov.innerHTML=''
    +'<div style="position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100000;width:min(620px,calc(100vw - 28px));'
    +'background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 18px 50px rgba(15,23,42,.28);padding:16px 18px;font-family:inherit">'
    +'<div style="height:5px;border-radius:99px;background:#ede9fe;overflow:hidden;margin-bottom:12px"><div style="height:100%;width:'+pct+'%;background:#7c3aed;transition:width .5s linear"></div></div>'
    +head+body
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+controls+'</div>'
    +'</div>';
}
