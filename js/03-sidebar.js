'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATES - SIDEBAR
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* Un segment du sélecteur de période (Année / T1…T4), style « segmented control ». */
function qSeg(id,lb,active,title){
  return '<button data-act="qsel" data-id="'+id+'"'+(title?' title="'+esc(title)+'"':'')
    +' style="flex:1;min-width:0;padding:6px 2px;border:none;border-radius:6px;font-size:10.5px;font-weight:800;cursor:pointer;transition:all .14s;'
    +(active?'background:#84CC16;color:#16240a;box-shadow:0 1px 4px rgba(132,204,22,.35)':'background:transparent;color:#9fb0c2')+'">'+lb+'</button>';
}
function tSB(){
  var NAV;
  if(S.role==='recruteur'){
    NAV=[
      {id:'recrutement',ic:'\uD83C\uDFAF',lb:'Recrutement'},
      {id:'activite',   ic:'\uD83D\uDDD3\uFE0F',lb:'Activit\u00e9'},
      {id:'leaves',     ic:'\uD83C\uDFD6\uFE0F',lb:'Absences'},
      {id:'help',      ic:'\u2753',lb:'Aide'}
    ];
  }else if(S.role==='sales'){
    /* Licence Business Manager : Business + Activité + Absences */
    NAV=[
      {id:'business',   ic:'\uD83D\uDCBC',lb:'Business'},
      {id:'recrutement',ic:'\uD83C\uDFAF',lb:'Recrutement'},
      {id:'activite',   ic:'\uD83D\uDDD3\uFE0F',lb:'Activit\u00e9'},
      {id:'leaves',     ic:'\uD83C\uDFD6\uFE0F',lb:'Absences'},
      {id:'help',      ic:'\u2753',lb:'Aide'}
    ];
  }else if(S.role==='utilisateur'){
    NAV=[
      {id:'activite',   ic:'\uD83D\uDCC5',lb:'Activit\u00e9'},
      {id:'missions',   ic:'\uD83D\uDCCB',lb:'Missions'},
      {id:'planning',   ic:'\uD83D\uDCC5',lb:'Planning'},
      {id:'leaves',     ic:'\uD83C\uDFD6\uFE0F',lb:'Absences'},
      {id:'approvals',  ic:'\uD83D\uDD14',lb:'Approbations'},
      {id:'business',   ic:'\uD83D\uDCBC',lb:'Business'},
      {id:'help',      ic:'\u2753',lb:'Aide'}
    ];
  }else{
    /* Ordre demand\u00e9 : KPIs, Dashboard, Business (remont\u00e9), Recrutement, puis les
       autres. \u00c9quipe et Activit\u00e9 (non cit\u00e9es) sont conserv\u00e9es juste apr\u00e8s
       Recrutement. Gestion des acc\u00e8s se place juste avant Aide. */
    NAV=[
      {id:'kpis',      ic:'\uD83D\uDCC8',lb:'KPIs'},
      {id:'dashboard', ic:'\uD83D\uDCCA',lb:'Dashboard'},
      {id:'business',  ic:'\uD83D\uDCBC',lb:'Business'},
      {id:'opportunites',ic:'\uD83D\uDEEC',lb:'Opportunit\u00E9s'},
      {id:'recrutement',ic:'\uD83C\uDFAF',lb:'Recrutement'},
      {id:'teams',     ic:'\uD83D\uDC65',lb:'\u00c9quipe'},
      {id:'activite',  ic:'\uD83D\uDDD3\uFE0F',lb:'Activit\u00e9'},
      {id:'missions',  ic:'\uD83D\uDCCB',lb:'Missions'},
      {id:'planning',  ic:'\uD83D\uDCC5',lb:'Planning'},
      {id:'leaves',    ic:'\uD83C\uDFD6\uFE0F',lb:'Absences'},
      {id:'approvals',  ic:'\uD83D\uDD14',lb:'Approbations'},
      {id:'param',     ic:'\uD83D\uDCA1',lb:'Pr\u00e9conisations'}
    ];
    /* \u00ab Gestion des acc\u00e8s \u00bb et \u00ab Param\u00e8tres \u00bb : TEMPORAIREMENT MASQU\u00c9S sur toutes
       les licences (la hi\u00e9rarchie N+1 vit d\u00e9sormais dans \u00ab Mon Profil \u00bb). Pour les
       r\u00e9activer : d\u00e9commenter ces deux lignes ET remettre 'svp_acces'/'svp_settings'
       dans _allowedTabs (js/13-render-events.js).
    if(S.role==='admin'||S.role==='gestionnaire'||S.role==='super_admin')NAV.push({id:'svp_acces',ic:'\ud83d\uDD11',lb:'Gestion des acc\u00e8s'});
    if(S.role==='super_admin')NAV.push({id:'svp_settings',ic:'\u2699',lb:'Param\u00e8tres'});
    */
    if(S.role==='super_admin')NAV.push({id:'svp_integrations',ic:'\ud83d\udd0c',lb:'Int\u00e9grations'});
    NAV.push({id:'help',ic:'\u2753',lb:'Aide'});
  }
  var alC=(function(){
    /* Compteur unifié par identité : demandes (approvals + leaves) dont JE suis l'approbateur */
    function _mine(rec){var aid=rec.approver_id||rec.approverId||(rec.payload&&rec.payload.approver_id);if(aid)return aid===S._userId;if(rec.approval_role){var mr=S.role==='super_admin'?'super_admin':S.role==='admin'?'admin':S.role==='gestionnaire'?'gestionnaire':'';return rec.approval_role===mr;}if(rec.dirName!==undefined)return rec.dirName===S.dirName;return false;}
    var a1=(S.approvals||[]).filter(function(r){return r.status==='pending'&&_mine(r);}).length;
    var a2=(S.lvs||[]).filter(function(lv){return _mine(lv)&&lv.approved===false;}).length;
    return a1+a2;
  })();
  var fyOpts=[CFY-2,CFY-1,CFY,CFY+1].map(function(fy){return '<option value="'+fy+'"'+(fy===S.year?' selected':'')+'>'+fyLbl(fy)+'</option>';}).join('');
  /* Onglets modules masqués tant que le module n'est pas payé (actif au niveau
     entreprise). Exceptions : le rôle recruteur (Recrutement) et le rôle sales /
     Business Manager (Business) dont la licence inclut l'accès. */
  NAV=NAV.filter(function(n){
    if(n.id==='recrutement')return S.role==='recruteur'||!!(S.settings&&S.settings.hasRecrutementModule);
    if(n.id==='business')return S.role==='sales'||!!(S.settings&&S.settings.hasBusinessModule);
    return true;
  });
  var nav=NAV.map(function(n){
    return '<button class="nb'+(S.tab===n.id?' act':'')+'" data-nav="'+n.id+'"'+(S.tab===n.id?' aria-current="page"':'')+'>'
      +'<span class="nbi" aria-hidden="true">'+n.ic+'</span><span>'+n.lb+'</span>'
      +(n.id==='approvals'&&alC>0?'<span class="nbb" aria-label="'+alC+' en attente">'+alC+'</span>':'')+'</button>';
  }).join('');
  /* ── bloc filtre directeur (gestionnaire) / libellé équipe (directeur) ── */
  var _allC=(S._all&&S._all.cons)||S.cons;
  /* Filtre « Directeur » (licence admin) : lister les directeurs des consultants
     visibles, en retirant UNIQUEMENT ceux qui sont un supérieur hiérarchique de
     l'utilisateur (ex. son super_admin) — pour ne pas exposer sa hiérarchie
     au-dessus. En l'absence d'annuaire (mode démo), rien n'est retiré. */
  var _dirs=[];_allC.forEach(function(c){
    var r=c.dir||'';if(!r||_dirs.indexOf(r)>=0)return;
    var _pr=mgrAccountByName(r);
    if(_pr&&_pr.id!==S._userId&&isHierDescendant(S._userId,_pr.id))return;
    _dirs.push(r);
  });_dirs.sort();
  var dirBlock;
  if(S.role==='gestionnaire'){
    dirBlock='<div class="syr"><div class="syr-lbl">Mon \u00e9quipe</div>'
      +'<div style="color:#cbd5e1;font-size:12px;padding:3px 2px;font-weight:600">'+esc(S.dirName||'\u2014')+'</div></div>';
  }else if(S.role==='utilisateur'){
    var myC=(S._all||S).cons.find(function(c){return c.id===S.consId;})||{};
    dirBlock='<div class="syr"><div class="syr-lbl">Mon profil</div>'
      +'<div style="color:#a5b4fc;font-size:12px;padding:3px 2px;font-weight:600">'+esc(myC.name||S._userEmail||'\u2014')+'</div>'
      +'<div style="color:#64748b;font-size:11px;padding:1px 2px">'+esc(myC.title||'')+'</div></div>';
  }else if(S.role==='super_admin'){
    /* Filtre par Vice Président */
    var _vps=(S.svpInvites||[]).map(function(iv){return iv.vp_name||iv.email||'';}).filter(Boolean);
    var _vNone=(!S.fvp||!S.fvp.length);
    var _vItems=_vps.map(function(vp){
      var on=S.fvp&&S.fvp.indexOf(vp)>=0;
      return '<label style="display:flex;align-items:center;gap:7px;padding:2px;color:#cbd5e1;font-size:12px;cursor:pointer">'
        +'<input type="checkbox" data-vp="'+esc(vp)+'"'+(on?' checked':'')+' style="accent-color:#84CC16;flex-shrink:0">'+esc(vp)+'</label>';
    }).join('');
    dirBlock='<div class="syr"><div class="syr-lbl">'+rLabel('admin')+(_vNone?'':' ('+S.fvp.length+')')+'</div>'
      +(_vps.length?_vItems+(_vNone
          ?'<div style="font-size:10px;color:#475569;margin-top:3px">Tous affichés</div>'
          :'<div data-vp-clear style="font-size:10px;color:#60a5fa;margin-top:3px;cursor:pointer;text-decoration:underline">Tout afficher</div>')
        :'<div style="font-size:11px;color:#475569">Aucun VP invité</div>')
      +'</div>';
  }else{
    var _none=(!S.fdir||!S.fdir.length);
    var _items=_dirs.map(function(r){
      var on=S.fdir&&S.fdir.indexOf(r)>=0;
      return '<label style="display:flex;align-items:center;gap:7px;padding:2px;color:#cbd5e1;font-size:12px;cursor:pointer">'
        +'<input type="checkbox" data-dir="'+esc(r)+'"'+(on?' checked':'')+' style="accent-color:#84CC16;flex-shrink:0">'+esc(r)+'</label>';
    }).join('');
    dirBlock='<div class="syr"><div class="syr-lbl">'+rLabel('gestionnaire')+(_none?'':' ('+S.fdir.length+')')+'</div>'
      +(_dirs.length?_items+(_none
          ?'<div style="font-size:10px;color:#475569;margin-top:3px">Tous affichés</div>'
          :'<div data-dir-clear style="font-size:10px;color:#60a5fa;margin-top:3px;cursor:pointer;text-decoration:underline">Tout afficher</div>')
        :'<div style="font-size:11px;color:#475569">Aucun directeur défini</div>')
      +'</div>';
  }
  return '<div class="sbl" style="display:flex;align-items:flex-start;justify-content:space-between"><div style="display:flex;align-items:center;gap:10px">'+'<div style="display:flex;align-items:flex-end;gap:3px;height:28px">'+'<div style="width:5px;border-radius:2px;height:45%;background:#f8fafc"></div>'+'<div style="width:5px;border-radius:2px;height:68%;background:#f8fafc"></div>'+'<div style="width:5px;border-radius:2px;height:100%;background:#84CC16"></div>'+'</div>'+'<div><div class="sbn" style="font-family:\'Nunito\',sans-serif;letter-spacing:-0.3px">Konsilys</div></div></div>'
    +'<button onclick="toggleSB()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:16px;padding:2px 0 0;line-height:1;flex-shrink:0" aria-label="R\u00e9duire">&#8592;</button></div>'
    /* ── Profil utilisateur juste sous le logo ── */
    +'<button data-nav="profile" title="Voir mon profil" style="width:100%;display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.06);cursor:pointer;text-align:left;margin:8px 0;transition:background .14s,border-color .14s" onmouseover="this.style.background=\'rgba(255,255,255,.12)\';this.style.borderColor=\'rgba(132,204,22,.35)\'" onmouseout="this.style.background=\'rgba(255,255,255,.06)\';this.style.borderColor=\'rgba(255,255,255,.06)\'">'
    +'<div style="width:26px;height:26px;border-radius:50%;background:#84CC16;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#1B2B3A;flex-shrink:0">'+(S.profileFirstName?S.profileFirstName[0].toUpperCase():'?')+'</div>'
    +'<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:700;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(S.profileFirstName||S._userEmail||'Profil')+'</div>'
    +'<div style="font-size:10px;color:#84CC16;font-weight:600">'+rLabel(S.role)+' · Mon profil</div></div>'
    +'<span style="font-size:14px;color:#84CC16;font-weight:800;line-height:1">›</span></button>'
    +'<div class="syr"><div class="syr-lbl">Exercice fiscal</div>'
    /* Stepper d'exercice : \u2039 FY26 \u203a \u2014 plus direct qu'un menu d\u00e9roulant */
    +'<div style="display:flex;align-items:center;gap:4px">'
    +'<button data-act="yr-prev"'+(S.year<=CFY-2?' disabled':'')+' aria-label="Exercice pr\u00e9c\u00e9dent" style="width:30px;height:30px;flex-shrink:0;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#cbd5e1;font-size:15px;font-weight:800;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s'+(S.year<=CFY-2?';opacity:.3;cursor:default':'')+'">\u2039</button>'
    +'<div style="flex:1;text-align:center;font-size:13px;font-weight:800;color:#f8fafc">'+fyLbl(S.year)+'</div>'
    +'<button data-act="yr-next"'+(S.year>=CFY+1?' disabled':'')+' aria-label="Exercice suivant" style="width:30px;height:30px;flex-shrink:0;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#cbd5e1;font-size:15px;font-weight:800;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .14s'+(S.year>=CFY+1?';opacity:.3;cursor:default':'')+'">\u203a</button>'
    +'</div>'
    /* P\u00e9riode : segmented control tenant sur une seule ligne */
    +'<div style="display:flex;margin-top:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:9px;padding:3px;gap:2px">'
    +qSeg('','An',!S.quarter,'Exercice complet')
    +QUARTERS.map(function(q){return qSeg(q.id,q.lb,S.quarter===q.id,q.lbFull);}).join('')
    +'</div>'
    +'</div>'
    +dirBlock
    +'<nav class="snv" aria-label="Navigation principale">'+nav+'</nav>'
    +'<div class="sft">'
    +'<div style="font-size:10px;color:#475569;padding:0 2px">'+S.cons.length+' collab. \u00b7 '+S.miss.length+' missions</div>'
    +'</div>';
}

