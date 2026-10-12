/* ═══════════════════════════════════════════════════════════════════════════
   ACCUEIL (S.tab === 'home') — page d'accueil simple, ouverte en cliquant sur
   le logo « Konsilys » en haut à gauche. Bienvenue, chiffres clés du périmètre
   visible, prochaines absences, demandes à valider et raccourcis vers les
   onglets autorisés pour le rôle.
   ═══════════════════════════════════════════════════════════════════════════ */
var HOME_SHORTCUTS=[
  {tab:'kpis',ico:'📊',label:'KPIs',desc:'Staffing, CA, marge',roles:['super_admin','admin','gestionnaire']},
  {tab:'missions',ico:'💼',label:'Missions',desc:'Missions et marge',roles:['super_admin','admin','gestionnaire','utilisateur']},
  {tab:'planning',ico:'📅',label:'Planning',desc:'Vue Gantt des missions',roles:['super_admin','admin','gestionnaire','utilisateur']},
  {tab:'teams',ico:'👥',label:'Équipe',desc:'Consultants et hiérarchie',roles:['super_admin','admin','gestionnaire']},
  {tab:'leaves',ico:'🌴',label:'Absences',desc:'Congés, RTT, validations',roles:['super_admin','admin','gestionnaire','utilisateur','recruteur','sales']},
  {tab:'business',ico:'🤝',label:'Commercial',desc:'Opportunités et comptes',roles:['super_admin','admin','gestionnaire','sales']},
  {tab:'recrutement',ico:'🎯',label:'Recrutement',desc:'Candidats et postes',roles:['super_admin','admin','gestionnaire','recruteur','sales']},
  {tab:'activite',ico:'🗂️',label:'Mon activité',desc:'Mes missions et mon temps',roles:['super_admin','admin','gestionnaire','utilisateur','recruteur','sales']}
];

function tHome(){
  var cons=S.cons||[],miss=S.miss||[],lvs=S.lvs||[];
  var today=TODAY,in30=(function(){var d=pD(TODAY);d.setDate(d.getDate()+30);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  var manager=['super_admin','admin','gestionnaire'].indexOf(S.role)>=0;
  var first=S.profileFirstName||((S._userEmail||'').split('@')[0].split(/[._-]/)[0]||'');
  if(first)first=first.charAt(0).toUpperCase()+first.slice(1);
  var dateTxt=pD(TODAY).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  dateTxt=dateTxt.charAt(0).toUpperCase()+dateTxt.slice(1);

  /* ── Chiffres clés ── */
  var ongoing=miss.filter(function(m){return m.sd<=today&&(!m.ed||m.ed>=today);});
  var staffed={};ongoing.forEach(function(m){staffed[m.cid]=1;});
  var offToday={};lvs.forEach(function(l){if(l.s<=today&&l.e>=today)offToday[l.cid]=1;});
  var available=cons.filter(function(c){return !staffed[c.id]&&!offToday[c.id]&&(!c.depart||c.depart>=today);});
  var upcomingLv=lvs.filter(function(l){return l.e>=today&&l.s<=in30;}).sort(function(a,b){return a.s.localeCompare(b.s);});
  var pending=(S.approvals||[]).filter(function(a){return a.status==='pending'&&a.approverId&&a.approverId===S._userId;});
  var ending=ongoing.filter(function(m){return m.ed&&m.ed<=in30;});
  var stat=function(ico,val,lbl,tab){return '<button class="hm-stat" data-nav="'+tab+'"><span class="hm-ico">'+ico+'</span><b>'+val+'</b><span>'+lbl+'</span></button>';};
  var stats=manager
    ?stat('👥',cons.length,'consultant'+(cons.length>1?'s':''),'teams')
      +stat('💼',ongoing.length,'mission'+(ongoing.length>1?'s':'')+' en cours','missions')
      +stat('🟢',available.length,'disponible'+(available.length>1?'s':'')+' aujourd’hui','planning')
      +stat('⏳',ending.length,'fin'+(ending.length>1?'s':'')+' de mission sous 30 j','missions')
    :stat('💼',ongoing.filter(function(m){return String(m.cid)===String(S.consId);}).length,'mission(s) en cours','activite')
      +stat('🌴',upcomingLv.filter(function(l){return String(l.cid)===String(S.consId);}).length,'absence(s) à venir','leaves');

  /* ── Prochaines absences (30 jours) ── */
  var cname=function(id){var c=cons.find(function(k){return String(k.id)===String(id);});return c?c.name:'';};
  var lvRows=upcomingLv.slice(0,5).map(function(l){
    return '<div class="hm-row"><span>'+esc(manager?cname(l.cid):l.type)+'</span><span class="hm-muted">'+(manager?esc(l.type)+' · ':'')+fDt(l.s)+(l.e!==l.s?' → '+fDt(l.e):'')+'</span></div>';
  }).join('')||'<div class="hm-muted" style="padding:6px 0">Aucune absence dans les 30 prochains jours.</div>';

  /* ── Raccourcis autorisés pour le rôle ── */
  var shortcuts=HOME_SHORTCUTS.filter(function(s){
    if(s.roles.indexOf(S.role)<0)return false;
    if(s.tab==='business'&&S.role!=='sales'&&!(S.settings&&S.settings.hasBusinessModule))return false;
    return true;
  }).map(function(s){return '<button class="hm-tile" data-nav="'+s.tab+'"><span class="hm-ico">'+s.ico+'</span><b>'+s.label+'</b><span>'+s.desc+'</span></button>';}).join('');

  return '<div class="hm">'
    +'<div class="hm-hero"><div><div class="hm-date">'+esc(dateTxt)+'</div>'
    +'<h1>Bonjour'+(first?' '+esc(first):'')+' 👋</h1>'
    +'<p>Bienvenue sur Konsilys'+(S.role?' — '+esc(typeof rLabel==='function'?rLabel(S.role):S.role):'')+'.</p></div>'
    +'<button class="hm-ai" data-ai="toggle">✨ Demander à l’assistant</button></div>'
    +homeTrialCard()
    +'<div class="hm-stats">'+stats+'</div>'
    +(pending.length?'<button class="hm-alert" data-nav="approvals">🔔 '+pending.length+' demande'+(pending.length>1?'s':'')+' en attente de votre validation →</button>':'')
    +'<div class="hm-grid">'
    +'<div class="card hm-card"><h3>Accès rapide</h3><div class="hm-tiles">'+shortcuts+'</div></div>'
    +'<div class="card hm-card"><h3>'+(manager?'Absences à venir (30 jours)':'Mes prochaines absences')+'</h3>'+(manager?lvRows:(upcomingLv.filter(function(l){return String(l.cid)===String(S.consId);}).length?upcomingLv.filter(function(l){return String(l.cid)===String(S.consId);}).slice(0,5).map(function(l){return '<div class="hm-row"><span>'+esc(l.type)+'</span><span class="hm-muted">'+fDt(l.s)+(l.e!==l.s?' → '+fDt(l.e):'')+'</span></div>';}).join(''):'<div class="hm-muted" style="padding:6px 0">Aucune absence prévue.</div>'))+'</div>'
    +'</div></div>';
}

/* Carte « Votre essai gratuit » (admin d'un espace en essai) : jours restants,
   progression du démarrage avec une action par étape, ajout du moyen de paiement.
   S'appuie sur aiTrial() / aiTrialSteps() (js/18-assistant.js). */
function homeTrialCard(){
  var t=(typeof aiTrial==='function')?aiTrial():null;
  if(!t)return '';
  var steps=aiTrialSteps(),done=steps.filter(function(x){return x.done;}).length;
  var acts=[
    '<button class="hm-tbtn" data-act="import-cons-open">📥 Importer (Excel)</button><button class="hm-tbtn" data-ai="toggle">✨ Via l’assistant</button>',
    '<button class="hm-tbtn" data-nav="missions">💼 Ouvrir les missions</button>',
    '<button class="hm-tbtn" data-nav="leaves">🌴 Ouvrir les absences</button>'
  ];
  var left=t.left;
  return '<div class="card hm-trial">'
    +'<div class="hm-trial-h"><div><h3>🎁 Votre essai gratuit'+(left!=null?' — '+(left<=1?'dernier jour':'encore '+left+' jours'):'')+'</h3>'
    +'<p>Démarrage : '+done+'/'+steps.length+' étapes. Ajoutez un moyen de paiement pour continuer sans interruption à la fin de l’essai.</p></div>'
    +'<button class="hm-pay" data-act="billing-open">💳 Ajouter un moyen de paiement</button></div>'
    +'<div class="hm-prog"><span style="width:'+Math.round(done/steps.length*100)+'%"></span></div>'
    +'<div class="hm-steps">'+steps.map(function(x,i){
      return '<div class="hm-step'+(x.done?' ok':'')+'"><span class="hm-chk">'+(x.done?'✓':(i+1))+'</span><b>'+esc(x.label)+'</b>'
        +(x.done?'<span class="hm-muted">Fait</span>':'<span class="hm-sacts">'+acts[i]+'</span>')+'</div>';
    }).join('')+'</div></div>';
}
