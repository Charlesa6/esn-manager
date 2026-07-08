'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - PARAMÉTRAGE & PRÉCONISATIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* ══════════════════════════════════════════════════════════════
   TEMPLATE - SVP ACCÈS (Sénior VP : invite VP + Recruteurs)
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TEMPLATE - PARAMÈTRES (Sénior VP uniquement)
══════════════════════════════════════════════════════════════ */
function tSettings(){
  if(S.role!=='super_admin')return '<div class="emp">Accès réservé au Sénior VP.</div>';
  var st=S.settings||{};
  var currencies=[
    {code:'EUR',sym:'\u20ac',lbl:'Euro (€)'},
    {code:'USD',sym:'$',lbl:'Dollar US ($)'},
    {code:'GBP',sym:'£',lbl:'Livre sterling (£)'},
    {code:'CHF',sym:'CHF',lbl:'Franc suisse (CHF)'},
    {code:'CAD',sym:'CA$',lbl:'Dollar canadien (CA$)'},
    {code:'MAD',sym:'DH',lbl:'Dirham marocain (DH)'},
  ];
  var months=[
    {v:1,lbl:'Janvier'},{v:2,lbl:'Février'},{v:3,lbl:'Mars'},{v:4,lbl:'Avril'},
    {v:5,lbl:'Mai'},{v:6,lbl:'Juin'},{v:7,lbl:'Juillet'},{v:8,lbl:'Août'},
    {v:9,lbl:'Septembre'},{v:10,lbl:'Octobre'},{v:11,lbl:'Novembre'},{v:12,lbl:'Décembre'}
  ];
  var roleKeys=['super_admin','admin','gestionnaire','utilisateur','recruteur'];
  var roleDefaults=JSON.parse(JSON.stringify(_ROLE_DEFAULTS)); /* utilise les defaults globaux */
  var curOpts=currencies.map(function(cr){return '<option value="'+cr.code+'"'+(st.currency===cr.code?' selected':'')+'>'+cr.lbl+'</option>';}).join('');
  var moOpts=months.map(function(m){return '<option value="'+m.v+'"'+((st.fyStartMonth||10)===m.v?' selected':'')+'>'+m.lbl+'</option>';}).join('');
  var roleFlds=roleKeys.map(function(k){return '<div class="fd"><label class="fl">'+roleDefaults[k]+'</label><input class="ic" id="rol-'+k+'" value="'+esc((st.roleLabels&&st.roleLabels[k])||'')+'\" placeholder="'+roleDefaults[k]+'"></div>';}).join('');

  return '<div class="vw">'
    +'<div style="margin-bottom:20px"><div class="pt">Param\u00e8tres Konsilys</div>'
    +'<div class="ps">Configurez les pr\u00e9f\u00e9rences de votre organisation</div></div>'

    /* ── Devise ── */
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:14px">💱 Devise</h3>'
    +'<div class="fd"><label class="fl">Devise affich\u00e9e</label>'
    +'<select class="ic" id="set-currency">'+curOpts+'</select>'
    +'<p class="fh">S\'applique \u00e0 tous les montants CA, TJM, SCR de l\'application</p></div>'
    +'</div>'

    /* ── Exercice fiscal ── */
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:14px">📅 Exercice fiscal</h3>'
    +'<div class="fd"><label class="fl">Mois de d\u00e9but du FY</label>'
    +'<select class="ic" id="set-fystart">'+moOpts+'</select>'
    +'<p class="fh">Ex : Octobre = FY commençant en oct. (FY2026 = oct.2025 → sept.2026)</p></div>'
    +'<div id="fy-preview" style="margin-top:10px;font-size:13px;color:#64748b;font-style:italic"></div>'
    +'</div>'

    /* ── Noms des rôles ── */
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:14px"> Noms des r\u00f4les</h3>'
    +'<p style="font-size:12px;color:#94a3b8;margin-bottom:16px">Personnalisez les labels affich\u00e9s. Laisser vide pour garder les noms par d\u00e9faut.</p>'
    +'<div class="g2">'+roleFlds+'</div>'
    +'</div>'

    /* ── Labels statuts recrutement ── */
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px"> Statuts du pipeline recrutement</h3>'
    +'<p style="font-size:12px;color:#94a3b8;margin-bottom:14px">Renommez, ajoutez ou supprimez des statuts. Le dernier statut est toujours le statut "Recruté".</p>'
    /* Liste des statuts actuels */
    +'<div id="rec-status-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">'
    +REC_STATUS.map(function(s,idx){
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">'
        +'<span style="min-width:14px;text-align:center;color:#94a3b8;font-size:11px;font-weight:700">'+(idx+1)+'</span>'
        +'<span style="padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:'+s.bg+';color:'+s.fg+';white-space:nowrap">'+esc(s.lb)+'</span>'
        +'<input class="ic" id="rec-st-'+s.id+'" value="'+esc(s.lb)+'" style="flex:1;min-width:0;font-size:13px">'
        +'<button onclick="delRecStatus(\''+esc(s.id)+'\')" style="background:#fff;border:1px solid #e2e8f0;color:#dc2626;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap">✕ Suppr.</button>'
        +'</div>';
    }).join('')
    +'</div>'
    /* Formulaire ajout nouveau statut */
    +'<div style="display:flex;gap:8px;align-items:center;padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">'
    +'<input class="ic" id="rec-st-new-lb" placeholder="Nom du nouveau statut..." style="flex:1;font-size:13px">'
    +'<select id="rec-st-new-color" style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:Calibri,sans-serif;font-size:12px">'
    +'<option value="blue">🔵 Bleu</option><option value="orange">🟠 Orange</option>'
    +'<option value="purple">🟣 Violet</option><option value="teal">🟢 Vert</option>'
    +'<option value="red">🔴 Rouge</option><option value="pink">🩷 Rose</option>'
    +'</select>'
    +'<button onclick="addRecStatus()" style="background:#84CC16;color:#1B2B3A;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:800;font-size:13px;white-space:nowrap">+ Ajouter</button>'
    +'</div></div>'

    /* ── Business Units (hiérarchie) ── */
    +tBUTreeCard()

    /* ── Régions & villes de mobilité ── */
    +tRegionsCard()

    /* ── Bouton sauvegarder ── */
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:14px">📌 Modules &amp; Add-ons</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +[{k:'hasBusinessModule',lb:'Business Développement',desc:'Onglet Business pour Admin/Gestionnaire/Utilisateur + Licence Business Manager'},
      {k:'hasRecrutementModule',lb:'Add-on Recruteur',desc:'Comptes recruteur, pipeline candidats'}].map(function(m){
        var on=!!(st[m.k]);
        return '<div style="border:1px solid '+(on?'#bbf7d0':'#e2e8f0')+';border-radius:10px;padding:12px 14px;background:'+(on?'#f0fdf4':'#f8fafc')+'">'
          +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
          +'<span>'+(on?'🟢':'⚪')+'</span>'
          +'<span style="font-weight:700;font-size:13px;color:#0f172a">'+m.lb+'</span>'
          +'<span style="margin-left:auto;font-size:10px;font-weight:700;color:'+(on?'#15803d':'#94a3b8')+'">'+(on?'ACTIF':'INACTIF')+'</span></div>'
          +'<div style="font-size:11px;color:#94a3b8">'+m.desc+'</div>'
          +(!on?'<a href="mailto:contact@konsilys.fr" style="font-size:11px;color:#1B2B3A;font-weight:700;margin-top:4px;display:block">Activer ce module →</a>':'')
          +'</div>';
      }).join('')+'</div></div>'
    +'<button class="bp" onclick="saveSettings()" style="min-width:180px">💾 Enregistrer les paramètres</button>'
    +'<div id="set-msg" style="font-size:13px;margin-top:12px;display:none"></div>'
    +'</div>';
}

var _REC_COLORS={
  blue:{bg:'#eff6ff',fg:'#1e40af'},orange:{bg:'#fff7ed',fg:'#c2410c'},
  purple:{bg:'#ede9fe',fg:'#5b21b6'},teal:{bg:'#d1fae5',fg:'#065f46'},
  red:{bg:'#fee2e2',fg:'#b91c1c'},pink:{bg:'#fce7f3',fg:'#9d174d'}
};
function addRecStatus(){
  var lb=(document.getElementById('rec-st-new-lb')||{}).value||'';
  var col=(document.getElementById('rec-st-new-color')||{}).value||'blue';
  if(!lb.trim()){alert('Saisissez un nom de statut.');return;}
  var colors=_REC_COLORS[col]||_REC_COLORS.blue;
  var id='st_'+Date.now();
  REC_STATUS.push({id:id,lb:lb.trim(),bg:colors.bg,fg:colors.fg});
  if(S.settings)S.settings.recStatuses=REC_STATUS.slice();
  render();
}
function delRecStatus(id){
  if(REC_STATUS.length<=2){alert('Il faut au moins 2 statuts.');return;}
  if(!confirm('Supprimer ce statut ? Les candidats avec ce statut garderont l\'ancien statut.'))return;
  REC_STATUS=REC_STATUS.filter(function(s){return s.id!==id;});
  if(S.settings)S.settings.recStatuses=REC_STATUS.slice();
  render();
}
function saveSettings(){
  var cur=document.getElementById('set-currency');
  var fym=document.getElementById('set-fystart');
  var currencies={EUR:'\u20ac',USD:'$',GBP:'\u00a3',CHF:'CHF',CAD:'CA$',MAD:'DH'};
  var roleKeys=['super_admin','admin','gestionnaire','utilisateur','recruteur'];
  var labels={};
  roleKeys.forEach(function(k){var el=document.getElementById('rol-'+k);if(el&&el.value.trim())labels[k]=el.value.trim();});
  /* Lire les statuts actuels depuis les inputs */
  var newStatuses=REC_STATUS.map(function(s){
    var el=document.getElementById('rec-st-'+s.id);
    var lb=el&&el.value.trim()?el.value.trim():s.lb;
    return Object.assign({},s,{lb:lb});
  });
  S.settings.recStatuses=newStatuses;
  S.settings.recStatusLabels={}; /* déprécié — on utilise recStatuses désormais */
  applyRecStatuses();
  S.settings.currency=cur?cur.value:'EUR';
  S.settings.currencySymbol=currencies[S.settings.currency]||S.settings.currency;
  S.settings.fyStartMonth=fym?parseInt(fym.value):10;
  S.settings.roleLabels=labels;
  /* Sauvegarder en localStorage (cache local) */
  try{localStorage.setItem('esn_settings_'+SB_CID,JSON.stringify(S.settings));}catch(e){}
  rebuildQuarters(); /* Recalculer T1/T2/T3/T4 si le FY a changé */
  applyRecStatuses();
  var msg=document.getElementById('set-msg');
  if(msg){msg.style.display='block';msg.style.color='#94a3b8';msg.textContent='Enregistrement...';}
  /* Sauvegarder dans Supabase pour toute l\'entreprise */
  if(sb&&SB_CID){
    /* Ne jamais persister les flags modules dans le JSON modifiable :
       leur source de vérité est la table `companies` (back-office uniquement). */
    var _persist=Object.assign({},S.settings);
    delete _persist.hasBusinessModule;delete _persist.hasRecrutementModule;
    sb.from('company_settings').upsert({
      company_id:SB_CID,
      settings:_persist,
      updated_at:new Date().toISOString()
    },{onConflict:'company_id'}).then(function(r){
      if(msg){
        if(r.error){msg.style.color='#ef4444';msg.textContent='\u26a0 Erreur Supabase : '+r.error.message+' (sauvegard\u00e9 localement)';}
        else{msg.style.color='#16a34a';msg.textContent='\u2713 Param\u00e8tres enregistr\u00e9s pour toute l\'entreprise. Rechargez la page.';}
      }
    });
  }else{
    if(msg){msg.style.color='#16a34a';msg.textContent='\u2713 Enregistr\u00e9 localement (Supabase non connect\u00e9).';}
  }
}

/* ═══ Business Units — éditeur d'arbre (Paramètres super_admin) ═══ */
function persistBUTree(){
  if(!S.settings)S.settings={};
  try{localStorage.setItem('esn_settings_'+SB_CID,JSON.stringify(S.settings));}catch(e){}
  if(sb&&SB_CID){
    var _p=Object.assign({},S.settings);delete _p.hasBusinessModule;delete _p.hasRecrutementModule;
    sb.from('company_settings').upsert({company_id:SB_CID,settings:_p,updated_at:new Date().toISOString()},{onConflict:'company_id'}).then(function(){});
  }
}
function buAddNode(parentId){
  parentId=parentId||null;
  if(parentId&&buLevel(parentId)>=6){alert('6 niveaux maximum.');return;}
  var name=prompt(parentId?('Nouvelle sous-BU sous « '+buLabel(parentId)+' » :'):'Nom de la BU racine (ex : Monde) :');
  if(!name||!name.trim())return;
  if(!S.settings)S.settings={};
  if(!S.settings.buTree)S.settings.buTree=[];
  S.settings.buTree.push({id:'bu_'+Date.now()+'_'+Math.floor(Math.random()*10000),name:name.trim(),parentId:parentId});
  persistBUTree();render();
}
function buRenameNode(id,name){
  var n=buById(id);if(!n)return;n.name=(name||'').trim()||n.name;persistBUTree();
}
function buDelNode(id){
  var toDel={};(function rec(x){toDel[x]=1;buChildren(x).forEach(function(c){rec(c.id);});})(id);
  var nKids=Object.keys(toDel).length-1;
  var nMemb=(S.orgProfiles||[]).filter(function(p){return toDel[p.bu_id];}).length;
  var msg='Supprimer la BU « '+buLabel(id)+' »'+(nKids?' et ses '+nKids+' sous-BU':'');
  if(nMemb)msg+=' ? '+nMemb+' membre(s) affecté(s) seront détaché(s)';
  if(!confirm(msg+' ?'))return;
  (S.orgProfiles||[]).forEach(function(p){if(toDel[p.bu_id])setMemberBU(p.id,'',true);});
  S.settings.buTree=buNodes().filter(function(n){return !toDel[n.id];});
  persistBUTree();render();
}
/* Affecte une BU à un membre (RPC serveur : super_admin/admin, même entreprise) */
function setMemberBU(memberId,buId,silent){
  var p=(S.orgProfiles||[]).find(function(x){return x.id===memberId;});
  var prev=p?p.bu_id:null;
  if(p)p.bu_id=buId||null; /* optimiste */
  if(sb&&SB_CID){sb.rpc('set_member_bu',{p_member:memberId,p_bu:buId||null}).then(function(r){
    if(r&&r.error){if(p)p.bu_id=prev;render();if(!silent)toast('Échec de l\'enregistrement : '+r.error.message,'error');}
    else if(!silent)toast(buId?('Unité enregistrée : '+(buLabel(buId)||'')):'Unité retirée');
  });}
  if(!silent)render();
}
function buTreeRows(parentId,depth){
  return buChildren(parentId).map(function(n){
    var canChild=depth<6, nMemb=(S.orgProfiles||[]).filter(function(p){return p.bu_id===n.id;}).length;
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;padding-left:'+((depth-1)*20)+'px">'
      +'<span style="font-size:10px;font-weight:700;color:#cbd5e1;min-width:20px">N'+depth+'</span>'
      +'<input class="ic" value="'+esc(n.name)+'" onchange="buRenameNode(\''+n.id+'\',this.value)" style="max-width:240px;font-size:13px">'
      +(nMemb?'<span style="font-size:10px;color:#94a3b8">'+nMemb+' membre'+(nMemb>1?'s':'')+'</span>':'')
      +(canChild?'<button onclick="buAddNode(\''+n.id+'\')" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;border-radius:6px;padding:3px 9px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap">+ sous-BU</button>':'')
      +'<button onclick="buDelNode(\''+n.id+'\')" style="background:#fff;border:1px solid #e2e8f0;color:#dc2626;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700">✕</button>'
      +'</div>'
      +buTreeRows(n.id,depth+1);
  }).join('');
}
function tBUTreeCard(){
  var tree=buTreeRows(null,1);
  return '<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px">🏢 Business Units (hiérarchie)</h3>'
    +'<p style="font-size:12px;color:#94a3b8;margin-bottom:14px">Jusqu\'à 6 niveaux (ex : Monde › Europe › France › AURA › Lyon › Équipe 1). '
      +'Rattachez chaque membre à une BU dans « Gestion des accès » ; <strong>les nouveaux comptes héritent automatiquement de la BU de leur créateur</strong>.</p>'
    +'<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;background:#f8fafc;margin-bottom:12px">'
    +(tree||'<div style="font-size:12px;color:#94a3b8">Aucune BU définie. Créez le niveau racine ci-dessous.</div>')
    +'</div>'
    +'<button onclick="buAddNode(null)" class="bp">+ Ajouter une BU racine</button>'
    +'</div>';
}

/* ═══ Régions & villes de mobilité (Paramètres super_admin) ═══ */
function regionAdd(){
  var name=prompt('Nom de la région (ex : Auvergne-Rhône-Alpes) :');
  if(!name||!name.trim())return;
  if(!S.settings)S.settings={};
  if(!S.settings.regions)S.settings.regions=[];
  S.settings.regions.push({id:'rg_'+Date.now()+'_'+Math.floor(Math.random()*10000),name:name.trim(),cities:[]});
  persistBUTree();render();
}
function regionDel(rid){
  var r=(S.settings.regions||[]).find(function(x){return x.id===rid;});
  if(!r)return;
  if(!confirm('Supprimer la région « '+r.name+' » et ses villes ?'))return;
  S.settings.regions=(S.settings.regions||[]).filter(function(x){return x.id!==rid;});
  persistBUTree();render();
}
function regionAddCity(rid){
  var el=document.getElementById('rg-city-'+rid);
  var city=el&&el.value?el.value.trim():'';
  if(!city)return;
  var r=(S.settings.regions||[]).find(function(x){return x.id===rid;});
  if(!r)return;
  if(!r.cities)r.cities=[];
  if(r.cities.indexOf(city)<0)r.cities.push(city);
  persistBUTree();render();
}
function regionDelCityIdx(rid,idx){
  var r=(S.settings.regions||[]).find(function(x){return x.id===rid;});
  if(!r||!r.cities)return;
  r.cities.splice(idx,1);
  persistBUTree();render();
}
function tRegionsCard(){
  var regions=regionNodes();
  var rows=regions.map(function(r){
    var chips=(r.cities||[]).map(function(c,i){
      return '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:12px;font-weight:600;background:#ede9fe;color:#5b21b6;margin:0 5px 5px 0">'+esc(c)
        +' <button onclick="regionDelCityIdx(\''+r.id+'\','+i+')" style="background:none;border:none;color:#7c3aed;cursor:pointer;font-weight:800;padding:0">✕</button></span>';
    }).join('');
    return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#fff">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-weight:800;font-size:13px;color:#0f172a">📍 '+esc(r.name)+'</span>'
      +'<button onclick="regionDel(\''+r.id+'\')" style="margin-left:auto;background:#fff;border:1px solid #e2e8f0;color:#dc2626;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700">Supprimer la région</button></div>'
      +'<div style="margin-bottom:8px">'+(chips||'<span style="font-size:12px;color:#94a3b8">Aucune ville</span>')+'</div>'
      +'<div style="display:flex;gap:6px"><input class="ic" id="rg-city-'+r.id+'" placeholder="Ajouter une ville…" style="max-width:220px;font-size:13px" onkeydown="if(event.key===\'Enter\'){event.preventDefault();regionAddCity(\''+r.id+'\');}">'
      +'<button onclick="regionAddCity(\''+r.id+'\')" style="background:#84CC16;color:#1B2B3A;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:800;font-size:12px">+ Ville</button></div>'
      +'</div>';
  }).join('');
  return '<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px">🗺️ Régions &amp; villes de mobilité</h3>'
    +'<p style="font-size:12px;color:#94a3b8;margin-bottom:14px">Définissez vos régions et leurs villes. Elles alimentent la <strong>mobilité des consultants</strong> (fiche Équipe).</p>'
    +(rows||'<div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Aucune région définie.</div>')
    +'<button onclick="regionAdd()" class="bp">+ Ajouter une région</button>'
    +'</div>';
}

function tSalesInvitePaywall(){
  return '<div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px">'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<span style="font-size:24px">&#x1F4BC;</span>'
    +'<div style="flex:1"><div style="font-weight:700;color:#1B2B3A;font-size:13px">Licence Business Manager — Business Développement requis</div>'
    +'<div style="font-size:12px;color:#64748b">Activez le module Business pour inviter des Business Manager.</div></div>'
    +'<a href="mailto:contact@konsilys.fr?subject=Business Développement" style="background:#84CC16;color:#1B2B3A;padding:8px 14px;border-radius:8px;font-weight:800;font-size:12px;text-decoration:none">Activer</a>'
    +'</div></div>';
}
function tRecruteurPaywall(){
  return '<div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:14px;padding:24px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:center;gap:14px">'
    +'<div style="font-size:36px">🎯</div>'
    +'<div style="flex:1">'
    +'<div style="font-weight:800;color:#1B2B3A;font-size:15px">Add-on Recruteur — non activé</div>'
    +'<div style="font-size:13px;color:#64748b;margin-top:4px">Pipeline candidats, 8 statuts personnalisables, suivi par recruteur, conversion automatique en Utilisateur.</div>'
    +'</div>'
    +'<a href="mailto:contact@konsilys.fr?subject=Activation add-on Recruteur" style="background:#84CC16;color:#1B2B3A;padding:10px 20px;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;white-space:nowrap">Activer →</a>'
    +'</div></div>';
}
function tSVPAcces(){
  if(!['super_admin','admin','gestionnaire'].includes(S.role))return '<div class="emp">Accès non autorisé.</div>';
  var sbOn=!!(sb&&SB_CID);
  var role=S.role;
  var members=(S.orgProfiles||[]);
  var draft=(S.seatDraft=S.seatDraft||[]);
  var pend=(S.pendingSeats||[]);

  /* Carte « Mon abonnement » (facturation) — réservée aux administrateurs. */
  var subCard='';
  if(role==='admin'||role==='super_admin'){
    var sub=S.subscription||null;
    var endTxt='—',statusTxt='Non trouvé',statusColor='#64748b',nLic=0,cancelAtEnd=false;
    if(sub){
      if(sub.current_period_end){var _d=new Date(sub.current_period_end);if(!isNaN(_d))endTxt=_d.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});}
      var _sm={active:['Actif','#16a34a'],trialing:['Période d\'essai','#16a34a'],past_due:['Paiement en retard','#d97706'],canceled:['Annulé','#dc2626'],unpaid:['Impayé','#dc2626']}[sub.status]||[sub.status||'—','#64748b'];
      statusTxt=_sm[0];statusColor=_sm[1];
      nLic=(sub.lines||[]).filter(function(l){return l.kind==='licence';}).reduce(function(s,l){return s+(l.quantity||0);},0);
    }
    subCard='<div class="card" style="padding:20px;margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">'
      +'<div><h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:10px">💳 Mon abonnement</h3>'
      +'<div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px">'
      +'<div><div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">Statut</div><span style="font-weight:700;color:'+statusColor+'">'+statusTxt+'</span></div>'
      +'<div><div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">'+(sub&&sub.status==='canceled'?'Fin d\'accès':'Prochaine échéance')+'</div><span style="font-weight:700;color:#0f172a">'+endTxt+'</span></div>'
      +'<div><div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">Licences</div><span style="font-weight:700;color:#0f172a">'+(nLic||'—')+'</span></div>'
      +'</div></div>'
      +'<button class="bp" data-act="billing-open"'+(sbOn?'':' disabled style="opacity:.5"')+' title="Résilier, réactiver, changer de carte, voir les factures">Gérer mon abonnement →</button>'
      +'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-top:12px;line-height:1.5">Depuis le portail sécurisé Stripe : <strong>résilier</strong> (effet en fin de période payée), <strong>réactiver</strong>, mettre à jour la carte et télécharger les factures. Pour <strong>ajouter des licences ou des modules</strong>, utilisez « Ajouter des membres » ci-dessous.</div>'
      +'</div>';
  }

  /* Rôles que ce rôle peut ajouter (chacun = une licence payée). */
  var canAdd={
    super_admin:['admin','gestionnaire','utilisateur','recruteur','sales'],
    admin:['gestionnaire','utilisateur','recruteur','sales'],
    gestionnaire:['utilisateur','sales']
  }[role]||[];
  var addRoleOpts=canAdd.map(function(r){return '<option value="'+r+'">'+rLabel(r)+'</option>';}).join('');

  var PRICE_M={utilisateur:8,gestionnaire:29,admin:39,super_admin:49,sales:22,recruteur:22};
  var draftTotal=draft.reduce(function(s,x){return s+(PRICE_M[x.role]||0);},0);
  var draftRows=draft.map(function(x,i){
    return '<tr><td>'+esc((x.first_name+' '+x.last_name).trim())+'</td><td>'+esc(x.email)+'</td><td>'+rLabel(x.role)+'</td>'
      +'<td class="tr"><button class="lr" data-act="seat-del-row" data-idx="'+i+'">Retirer</button></td></tr>';
  }).join('');

  /* Hiérarchie : pour chaque membre existant, choix de son N+1 parmi les autres. */
  /* Options BU (chemin complet), triées par profondeur/label pour la lisibilité */
  var _buOpts=buNodes().slice().sort(function(a,b){return buPathLabel(a.id).localeCompare(buPathLabel(b.id),'fr');});
  var _canBU=(S.role==='super_admin'||S.role==='admin');
  var hierRows=members.map(function(p){
    var opts='<option value="">— Aucun —</option>'+members.filter(function(q){return q.id!==p.id;}).map(function(q){
      var nmq=((q.first_name||'')+' '+(q.last_name||'')).trim()||q.id;
      return '<option value="'+q.id+'"'+(p.manager_id===q.id?' selected':'')+'>'+esc(nmq)+' ('+rLabel(q.role)+')</option>';
    }).join('');
    var buOpts='<option value="">— Aucune —</option>'+_buOpts.map(function(n){
      return '<option value="'+n.id+'"'+(p.bu_id===n.id?' selected':'')+'>'+esc(buPathLabel(n.id))+'</option>';
    }).join('');
    var nm=((p.first_name||'')+' '+(p.last_name||'')).trim()||p.id;
    return '<tr><td>'+esc(nm)+'</td><td>'+rLabel(p.role)+'</td>'
      +'<td><select class="ic" onchange="setNplus1(\''+p.id+'\',this.value)"'+(sbOn?'':' disabled')+'>'+opts+'</select></td>'
      +'<td><select class="ic" onchange="setMemberBU(\''+p.id+'\',this.value)"'+(sbOn&&_canBU?'':' disabled title="Réservé Admin / Super Admin"')+'>'+buOpts+'</select></td></tr>';
  }).join('');

  var retryable=pend.filter(function(s){return s.status==='error'||s.status==='pending';}).length;
  var pendRows=pend.map(function(s){
    var st=s.status==='provisioned'?'<span class="badge bgrn">✓ Compte créé</span>'
      :(s.status==='error'?'<span class="badge bamb" title="'+esc(s.error||'Erreur')+'">⚠ Erreur</span>':'<span class="badge bamb">⏳ Après paiement</span>');
    return '<tr><td>'+esc(((s.first_name||'')+' '+(s.last_name||'')).trim())+'</td><td>'+esc(s.email)+'</td><td>'+rLabel(s.role)+'</td><td>'+st+'</td></tr>';
  }).join('');

  return '<div class="vw">'
    +'<div class="ph"><div class="pt">🔑 Gestion des accès</div>'
    +'<div class="ps">Ajoutez des membres (une licence chacun) et définissez la hiérarchie</div></div>'

    +'<div class="card" style="padding:16px;margin-bottom:16px;background:#f0fdf4;border:1px solid #bbf7d0">'
    +'<div style="font-size:12px;color:#374151;line-height:1.6">Chaque membre de votre organisation possède une licence. Pour donner un accès à quelqu\'un, ajoutez-le ci-dessous puis payez sa licence : il recevra un email pour définir son mot de passe. L\'invitation ne crée plus de compte — elle sert uniquement à définir la hiérarchie (N+1).</div></div>'

    +subCard

    /* A. Ajouter des membres (payant) */
    +'<div class="card" style="padding:20px;margin-bottom:16px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:6px">➕ Ajouter des membres</h3>'
    +'<p class="fh" style="margin-bottom:14px">Renseignez la personne : après paiement de sa licence, son compte est créé et elle reçoit un lien pour définir son mot de passe.</p>'
    +'<div class="g2">'
    +'<div class="fd"><label class="fl">Prénom</label><input class="ic" id="seat-fn" placeholder="Marie"></div>'
    +'<div class="fd"><label class="fl">Nom</label><input class="ic" id="seat-ln" placeholder="Dupont"></div>'
    +'<div class="fd"><label class="fl">Email</label><input class="ic" id="seat-email" type="email" placeholder="prenom.nom@exemple.com"></div>'
    +'<div class="fd"><label class="fl">Rôle (licence)</label><select class="ic" id="seat-role">'+addRoleOpts+'</select></div>'
    +'</div>'
    +'<button class="bp" data-act="seat-add-row"'+(sbOn?'':' disabled style="opacity:.5"')+'>+ Ajouter à la commande</button>'
    +(draft.length?('<div class="ov" style="margin-top:14px"><table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th class="tr"></th></tr></thead><tbody>'+draftRows+'</tbody></table></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:10px">'
      +'<div style="font-size:13px;color:#64748b">'+draft.length+' licence(s) · <strong>'+draftTotal+' € /mois</strong></div>'
      +'<button class="bp" data-act="seats-buy">Payer et créer les comptes →</button></div>'):'')
    +'</div>'

    /* B. Hiérarchie */
    +'<div class="card ov" style="margin-bottom:16px"><div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
    +'<span style="font-size:13px;font-weight:700;color:#0f172a">🏢 Hiérarchie (N+1) &amp; Business Unit</span>'
    +'<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:99px;padding:3px 10px">✅ Enregistrement automatique</span></div>'
    +'<table><thead><tr><th>Membre</th><th>Rôle</th><th>Responsable (N+1)</th><th>Business Unit</th></tr></thead><tbody>'
    +(hierRows||'<tr><td colspan="4" class="emp">Aucun membre pour le moment.</td></tr>')+'</tbody></table></div>'

    /* C. Sièges en attente */
    +(pend.length?('<div class="card ov"><div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<span style="font-size:13px;font-weight:700;color:#0f172a">Sièges achetés</span>'
      +(retryable?('<button class="bs" data-act="seats-retry"'+(sbOn?'':' disabled')+' title="Relance la création des comptes restés en attente ou en erreur (ex : email déjà utilisé)">↻ Relancer le provisioning</button>'):'')
      +'</div>'
      +'<table><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th></tr></thead><tbody>'+pendRows+'</tbody></table></div>'):'')

    /* D. Journal d'activité (audit log) */
    +tAuditSection()
    +'</div>';
}

/* Journal d'activité : lecture de activity_logs (alimentée par les triggers SQL
   audit_trigger sur les tables sensibles). Cloisonné par entreprise via la RLS. */
var AUDIT_ENTITY_LB={consultants:'Consultant',missions:'Mission',leaves:'Absence',candidates:'Candidat',crm_opportunities:'Opportunité',crm_accounts:'Compte',crm_contacts:'Contact',profiles:'Membre',companies:'Entreprise',settings:'Paramètres',company_settings:'Paramètres'};
var AUDIT_ACTION_STYLE={INSERT:['Création','#dcfce7','#166534'],UPDATE:['Modification','#dbeafe','#1e40af'],DELETE:['Suppression','#fee2e2','#991b1b']};
function tAuditSection(){
  var logs=(S.activityLog||[]);
  var q=(S.auditQ||'').toLowerCase().trim();
  var fa=S.auditAction||'all';
  var filtered=logs.filter(function(l){
    if(fa!=='all'&&l.action!==fa)return false;
    if(q){
      var hay=((l.user_email||'')+' '+(l.user_name||'')+' '+(l.details||'')+' '+(AUDIT_ENTITY_LB[l.entity_type]||l.entity_type||'')).toLowerCase();
      if(hay.indexOf(q)<0)return false;
    }
    return true;
  });
  function actBadge(a){var s=AUDIT_ACTION_STYLE[a]||[a,'#f1f5f9','#475569'];return '<span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:'+s[1]+';color:'+s[2]+'">'+s[0]+'</span>';}
  var rows=filtered.slice(0,200).map(function(l){
    var d=l.created_at?new Date(l.created_at):null;
    var dTxt=d&&!isNaN(d)?d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
    var who=(l.user_name&&l.user_name!=='système')?l.user_name:(l.user_email||'système');
    return '<tr>'
      +'<td style="white-space:nowrap;font-size:11px;color:#64748b">'+esc(dTxt)+'</td>'
      +'<td style="font-size:12px"><div style="font-weight:600;color:#0f172a">'+esc(who)+'</div><div style="font-size:10px;color:#94a3b8">'+esc(l.user_role||'')+'</div></td>'
      +'<td>'+actBadge(l.action)+'</td>'
      +'<td style="font-size:12px;color:#475569">'+esc(AUDIT_ENTITY_LB[l.entity_type]||l.entity_type||'—')+'</td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(l.details||'—')+'</td>'
      +'</tr>';
  }).join('');
  var actOpts=['all','INSERT','UPDATE','DELETE'].map(function(a){
    var lb=a==='all'?'Toutes actions':(AUDIT_ACTION_STYLE[a]?AUDIT_ACTION_STYLE[a][0]:a);
    return '<option value="'+a+'"'+(fa===a?' selected':'')+'>'+lb+'</option>';
  }).join('');
  return '<div class="card ov" style="margin-top:16px">'
    +'<div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'
    +'<span style="font-size:13px;font-weight:700;color:#0f172a">📜 Journal d\'activité <span style="font-weight:500;color:#94a3b8;font-size:12px">— traçabilité des créations, modifications et suppressions</span></span>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<input class="ic" id="audit-q" placeholder="Rechercher (acteur, détail…)" value="'+esc(S.auditQ||'')+'" style="font-size:12px;min-width:180px">'
    +'<select class="ic" id="audit-action" style="font-size:12px;min-width:140px">'+actOpts+'</select>'
    +'</div></div>'
    +'<table><thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Type</th><th>Détail</th></tr></thead>'
    +'<tbody>'+(rows||'<tr><td colspan="5" class="emp">Aucune activité enregistrée'+(q||fa!=='all'?' pour ces filtres':' pour le moment')+'.</td></tr>')+'</tbody></table>'
    +(filtered.length>200?'<div style="padding:8px 20px;font-size:11px;color:#94a3b8">200 entrées les plus récentes affichées sur '+filtered.length+'.</div>':'')
    +'</div>';
}

