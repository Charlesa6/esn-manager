'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   RENDER
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function render(){
  /* La fenêtre ne scrolle pas (html,body{overflow:hidden}) : le scroll réel vit
     dans #mc (contenu), .snv (nav) et le modal (.mob/.mbody). Reconstruire leur
     innerHTML remet leur scrollTop à 0 → « saut vers le haut » quand on clique un
     bouton/chip/sous-onglet. On sauvegarde et on restaure ces positions. Le
     contenu ne se remet en haut que lors d'un vrai changement d'onglet principal. */
  var _mcEl=document.getElementById('mc');
  var _mcScroll=_mcEl?_mcEl.scrollTop:0;
  var _snvEl=document.querySelector('#sb .snv');
  var _snvScroll=_snvEl?_snvEl.scrollTop:0;
  var _mdBox=document.querySelector('#md .mob,#md .mbox');
  var _mdBoxScroll=_mdBox?_mdBox.scrollTop:0;
  var _mdBody=document.querySelector('#md .mody,#md .mbody');
  var _mdBodyScroll=_mdBody?_mdBody.scrollTop:0;
  var _tabChanged=(S.tab!==S._lastTab);
  if(S._ks)S._ks._valid=false;
  if(!S.demo)saveLocal(); /* sauvegarde automatique — désactivée en mode démo */
  /* ═══ filtrage par rôle / directeur : on bascule sur la vue filtrée le temps du rendu ═══ */
  S._all={cons:S.cons,miss:S.miss,lvs:S.lvs};
  var _vis=visibleData();S.cons=_vis.cons;S.miss=_vis.miss;S.lvs=_vis.lvs;
  document.getElementById('sb').innerHTML=tSB();
  /* ── Contrôle d'accès central : chaque rôle a ses onglets autorisés ── */
  var _allowedTabs={
    super_admin:['kpis','dashboard','teams','recrutement','missions','planning','leaves','business','approvals','svp_acces','svp_settings','param','help','profile','kpis_dir'],
    admin:['kpis','dashboard','teams','recrutement','missions','planning','leaves','business','approvals','svp_acces','param','help','profile','kpis_dir'],
    gestionnaire:['kpis','dashboard','teams','recrutement','missions','planning','leaves','business','approvals','svp_acces','help','profile','kpis_dir'],
    utilisateur:['activite','missions','planning','leaves','approvals','business','help','profile'],
    recruteur:['recrutement','activite','leaves','help','profile'],
    sales:['business','activite','leaves','help','profile']
  };
  var _myTabs=_allowedTabs[S.role]||_allowedTabs.admin;
  if(_myTabs.indexOf(S.tab)<0){
    /* Onglet non autorisé pour ce rôle → rediriger vers son onglet d'accueil */
    S.tab=(S.role==='sales')?'business':(S.role==='recruteur')?'recrutement':(S.role==='utilisateur')?'activite':'kpis';
  }
  var v=S.tab==='dashboard'?tDash():S.tab==='teams'?tTeams():S.tab==='recrutement'?tRecrut():S.tab==='missions'?tMiss():S.tab==='planning'?tPlan():S.tab==='kpis'?tKPIs():S.tab==='leaves'?tLeaves():S.tab==='activite'?tActivite():S.tab==='directeurs'?tSVPAcces():S.tab==='approvals'?tApprovals():S.tab==='admin'?tAdmin():S.tab==='profile'?tProfile():S.tab==='kpis_dir'?tKPIsDirSection():S.tab==='svp_acces'?tSVPAcces():S.tab==='svp_settings'?tSettings():S.tab==='business'?tBusiness():S.tab==='help'?tHelp():tParam();
  var _ini=function(n){return n.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();};
  var _av=S._userEmail?_ini(S._userEmail.split('@')[0].replace(/[._]/g,' ')):'?';
  var _pfBtn=''; /* Profil déplacé dans la sidebar gauche */
  /* Bannière démo */
  var _demoBanner=S.demo
    ?'<div style="background:#7c3aed;color:#fff;text-align:center;padding:9px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:16px;flex-shrink:0">'
    +'\uD83C\uDFAE MODE D\u00c9MO — donn\u00e9es fictives, aucune modification sauvegard\u00e9e'
    +'<a href="/login" style="color:#e9d5ff;font-size:12px;font-weight:600;background:rgba(255,255,255,.15);padding:4px 12px;border-radius:6px;text-decoration:none">'
    +'Cr\u00e9er un compte \u2192</a></div>'
    :'';
  document.getElementById('mc').innerHTML=_demoBanner+'<div class="inn" style="position:relative">'+_pfBtn+v+'</div>';
  document.getElementById('md').innerHTML=tModal()+(S.bizModal?tBizModal():'');
  /* on restaure les données maîtres (les handlers de bind() mutent l'ensemble complet) */
  S.cons=S._all.cons;S.miss=S._all.miss;S.lvs=S._all.lvs;
  bind();
  /* Restauration des scrolls (voir en tête de render) */
  var _mc2=document.getElementById('mc');
  if(_mc2)_mc2.scrollTop=_tabChanged?0:_mcScroll; /* nouvel onglet → haut ; sinon on garde la position */
  var _snv2=document.querySelector('#sb .snv');
  if(_snv2)_snv2.scrollTop=_snvScroll; /* on ne perd jamais sa place dans la nav */
  var _mdBox2=document.querySelector('#md .mob,#md .mbox');
  if(_mdBox2&&_mdBoxScroll)_mdBox2.scrollTop=_mdBoxScroll; /* modal : garde la position dans le formulaire */
  var _mdBody2=document.querySelector('#md .mody,#md .mbody');
  if(_mdBody2&&_mdBodyScroll)_mdBody2.scrollTop=_mdBodyScroll;
  S._lastTab=S.tab;
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   EVENT BINDING
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function bind(){
  var el=function(id){return document.getElementById(id);};
  var yr=el('yrs');if(yr)yr.onchange=function(){S.year=+this.value;H=fyHols(S.year);S.precs={};render();};
  /* nav */
  var nbs=document.querySelectorAll('[data-nav]');
  for(var i=0;i<nbs.length;i++){(function(b){b.onclick=function(){
    var nv=b.getAttribute('data-nav');
    if(nv==='recrutement'){S.recSel=null;S.recAddMeet=false;S.recAddCgi=false;S.recAddCv=false;S.recEditMeetId=null;S.recEditCgiId=null;}
    S.tab=nv;
    /* Mobile : refermer la sidebar (overlay) après navigation */
    if(window.innerWidth<=767)document.body.classList.add('sb-col');
    /* Rafraîchir les données en temps réel sur les onglets sensibles */
    if(nv==='admin'){loadConsInvites().then(function(){render();});}
    else if(nv==='svp_acces'){loadPendingSeats().then(function(){render();});loadSubscription().then(function(){render();});loadSVPInvites().then(function(){render();});}
    else if(nv==='dashboard'&&S.role==='gestionnaire'){loadApprovals().then(function(){render();});}
    else{render();}
  };})(nbs[i]);}
  /* filters */
  var fc=el('fmc');if(fc)fc.onchange=function(){S.fmc=this.value;render();};
  var fs=el('fms');if(fs)fs.onchange=function(){S.fms=this.value;render();};
  var ftf=el('fmt');if(ftf)ftf.onchange=function(){S.fmt=this.value;render();};
  var acc=el('act-cid');if(acc)acc.onchange=function(){S.actCid=this.value;render();};
  var lc=el('flc');if(lc)lc.onchange=function(){S.flc=this.value;render();};
  var rq=el('recq');
  if(rq){
    rq.oninput=function(){
      S.recF.q=this.value;
      recListRefresh(); /* met à jour uniquement la liste — l'input n\'est jamais recréé, le focus reste intact */
    };
  }
  /* délégation : les clics sur les pastilles de statut/localisation (recréées à chaque recListRefresh)
     sont capturés sur le conteneur stable, qui lui n\'est jamais détruit pendant la frappe */
  var rlw=el('rec-list-wrap');
  if(rlw){
    rlw.onclick=function(e){
      var t=e.target.closest('[data-act]');
      if(!t)return;
      var ra=t.getAttribute('data-act'),rid=t.getAttribute('data-id');
      if(ra==='recf-st'){S.recF.status=rid;recListRefresh();}
      else if(ra==='recf-rec'){S.recF.rec=rid;recListRefresh();}
      /* ── CRM Business handlers ── */
      else if(ra==='biz-new'){
        var types={pipeline:'opp',comptes:'acc',contacts:'ct',activites:'act'};
        var t=types[S.bizTab||'pipeline']||'opp';
        S.bizModal={type:t,item:null,btype:'at',consPickerSel:[],oppTeam:[{cid:'',taux:100,wdays:[1,2],tmar:25}]};render();
      }
      else if(ra==='biz-edit-acc'){var a=S.bizAccounts.find(function(x){return x.id===rid;});S.bizModal={type:'acc',item:a};render();}
      else if(ra==='biz-edit-ct'){var c=S.bizContacts.find(function(x){return x.id===rid;});S.bizModal={type:'ct',item:c};render();}
      else if(ra==='biz-edit-opp'){var o=S.bizOpps.find(function(x){return x.id===rid;});S.bizModal={type:'opp',item:o,btype:(o&&o.btype)||'at',consPickerSel:(o&&o.consultant_ids)||[],oppTeam:(o&&o.opp_team&&o.opp_team.length?o.opp_team:(o&&o.consultant_ids||[]).map(function(cid){return {cid:cid,taux:Math.round(100/Math.max((o.consultant_ids||[]).length,1)),wdays:[1,2],tmar:25};})||[])||[{cid:'',taux:100,wdays:[1,2],tmar:25}]};render();}
      else if(ra==='biz-edit-act'){var k=S.bizActivities.find(function(x){return x.id===rid;});S.bizModal={type:'act',item:k};render();}
      else if(ra==='biz-del'){var tbl=el.getAttribute('data-table')||'';bizDelItem(tbl,rid);}
      else if(ra==='biz-opp-mission'){bizOppToMission(rid);}
      else if(ra==='recf-loc'){
        var la=S.recF.loc||[];
        var li=la.indexOf(rid);
        if(li>=0)la.splice(li,1);else la.push(rid);
        S.recF.loc=la;
        recListRefresh();
      }
      else if(ra==='recf-mine'){S.recF.mine=!S.recF.mine;recListRefresh();}
      else if(ra==='recf-exp'){
        var ea=S.recF.exp||[];
        var ei=ea.indexOf(rid);
        if(ei>=0)ea.splice(ei,1);else ea.push(rid);
        S.recF.exp=ea;
        recListRefresh();
      }
      else if(ra==='opp-exp-tog'){
        var oe=(S.bizModal&&S.bizModal.reqExp)||[];
        var oi=oe.indexOf(rid);
        if(oi>=0)oe.splice(oi,1);else oe.push(rid);
        if(S.bizModal)S.bizModal.reqExp=oe;
        render();
      }
      else if(ra==='opp-see-cand'){S.bizModal=null;S.tab='recrutement';S.recSel=rid;render();}
      else if(ra==='recopen'){S.recSel=rid;S.recAddMeet=false;S.recAddCgi=false;S.recAddCv=false;S.recEditMeetId=null;S.recEditCgiId=null;render();}
    };
  }
  /* widgets multi-sélection Expertises / Secteurs (uniquement si le modal candidat est ouvert) */
  if(S.modal&&(S.modal.type==='candidate'||S.modal.type==='utilisateur')){bindExpWidget();bindSecWidget();}
  if(S.modal&&S.modal.type==='candidate'){bindCandLoc();}
  if(S.modal&&S.modal.type==='utilisateur'){bindConsMobility();}


  /* filtre directeur (gestionnaire) */
  var rcb=document.querySelectorAll('[data-dir]');
  for(var rk=0;rk<rcb.length;rk++){(function(cb){cb.onchange=function(){
    var r=cb.getAttribute('data-dir');
    if(!S.fdir)S.fdir=[];
    if(cb.checked){if(S.fdir.indexOf(r)<0)S.fdir.push(r);}
    else{S.fdir=S.fdir.filter(function(x){return x!==r;});}
    render();
  };})(rcb[rk]);}
  var rclr=document.querySelector('[data-dir-clear]');
  if(rclr)rclr.onclick=function(){S.fdir=[];render();};
  /* Biz sub-tabs */
  var biztabs=document.querySelectorAll('[data-biz-tab]');
  for(var bi=0;bi<biztabs.length;bi++){(function(b){b.onclick=function(){S.bizTab=b.getAttribute('data-biz-tab');render();};})(biztabs[bi]);}
  bindOppConsPicker(); /* picker consultants opportunité */
  /* Biz pipeline filters */
  var bfst=document.getElementById('biz-fst');
  if(bfst)bfst.onchange=function(){S.bizFilter.status=this.value;render();};
  var bfacc=document.getElementById('biz-facc');
  if(bfacc)bfacc.onchange=function(){S.bizFilter.account=this.value;render();};
  var bfexp=document.getElementById('biz-fexp');
  if(bfexp)bfexp.onchange=function(){S.bizFilter.exp=this.value;render();};
  /* Filtres du journal d'activité (Gestion des accès) */
  var auq=document.getElementById('audit-q');
  if(auq)auq.onchange=function(){S.auditQ=this.value;render();};
  var aua=document.getElementById('audit-action');
  if(aua)aua.onchange=function(){S.auditAction=this.value;render();};
  var vpcb=document.querySelectorAll('[data-vp]');
  for(var vi=0;vi<vpcb.length;vi++){(function(cb){cb.onchange=function(){
    var v=cb.getAttribute('data-vp');
    if(!S.fvp)S.fvp=[];
    if(cb.checked){if(S.fvp.indexOf(v)<0)S.fvp.push(v);}
    else{S.fvp=S.fvp.filter(function(x){return x!==v;});}
    render();
  };})(vpcb[vi]);}
  var vpclr=document.querySelector('[data-vp-clear]');
  if(vpclr)vpclr.onclick=function(){S.fvp=[];render();};
  /* all data-act */
  /* Les pastilles de filtre recrutement vivent dans #rec-list-wrap et sont gérées
     UNIQUEMENT par le handler délégué (rlw.onclick). On les exclut du binding direct
     ci-dessous : sinon son e.stopPropagation() intercepte le clic sans branche
     correspondante → le filtre « clique dans le vide » tant que la liste n'a pas été
     régénérée par un premier clic sur Statut. */
  var bs=document.querySelectorAll('[data-act]:not([data-act="recopen"]):not([data-act="recf-st"]):not([data-act="recf-rec"]):not([data-act="recf-loc"]):not([data-act="recf-mine"]):not([data-act="recf-exp"])');
  for(var j=0;j<bs.length;j++){(function(b){
    var a=b.getAttribute('data-act'),id=b.getAttribute('data-id'),fb=b.getAttribute('data-fb');
    b.onclick=async function(e){
      e.stopPropagation();
      if(a==='export'){exportJSON();return;}
      else if(a==='qsel'){S.quarter=id?+id:null;render();}
      else if(a==='lvc'){S.flc=id;render();return;}
      else if(a==='gen-ca'){genRecs('ca');}
      else if(a==='gen-util'){genRecs('util');}
      else if(a==='gen-tjm'){genRecs('tjm');}
      else if(a==='ac'){S.modal={type:'utilisateur',item:null,expSel:[],secSel:[],region:'',mobility:[]};render();}
      /* Chips expertise + suggestions candidats du formulaire d'opportunité (modal,
         hors #rec-list-wrap) : gérés ici dans le binding direct global. */
      else if(a==='opp-exp-tog'){
        var oe=(S.bizModal&&S.bizModal.reqExp)||[];
        var oi=oe.indexOf(id);
        if(oi>=0)oe.splice(oi,1);else oe.push(id);
        if(S.bizModal)S.bizModal.reqExp=oe;
        render();
      }
      else if(a==='opp-see-cand'){S.bizModal=null;S.tab='recrutement';S.recSel=id;render();}
      else if(a==='fexp-tog'){
        S.fexp=S.fexp||[];
        var ei=S.fexp.indexOf(id);
        if(ei>=0)S.fexp=S.fexp.filter(function(x){return x!==id;});
        else S.fexp=S.fexp.concat([id]);
        render();
      }
      else if(a==='fsec-tog'){
        S.fsec=S.fsec||[];
        var si=S.fsec.indexOf(id);
        if(si>=0)S.fsec=S.fsec.filter(function(x){return x!==id;});
        else S.fsec=S.fsec.concat([id]);
        render();
      }
      else if(a==='fteams-reset'){S.fexp=[];S.fsec=[];render();}
      else if(a==='kpi-sort'){
        if(S.kpiSort===id){S.kpiSortAsc=!S.kpiSortAsc;}
        else{S.kpiSort=id;S.kpiSortAsc=false;}
        render();
      }
      else if(a==='kpi-dir-sort'){
        if(S.kpiDirSort===id){S.kpiDirSortAsc=!S.kpiDirSortAsc;}
        else{S.kpiDirSort=id;S.kpiDirSortAsc=false;}
        render();
      }
      else if(a==='am'){
      var _now=new Date();
      S.modal={type:'mission',item:null,wmode:'rec',manualDays:[],
        calYear:_now.getFullYear(),calMonth:_now.getMonth()};
      render();}
      else if(a==='al'){S.modal={type:'leave',item:null};render();}
      else if(a==='mc'){S.modal=null;render();}
      else if(a==='ec'){var _ec=S.cons.find(function(c){return c.id===id;});S.modal={type:'utilisateur',item:_ec,expSel:(_ec&&_ec.expertise)?_ec.expertise.slice():[],secSel:(_ec&&_ec.sectors)?_ec.sectors.slice():[],region:(_ec&&_ec.region)||'',mobility:(_ec&&_ec.mobility)?_ec.mobility.slice():[]};render();}
      else if(a==='em'){
      var _it=S.miss.find(function(m){return m.id===id;});
      var _now2=new Date();
      S.modal={type:'mission',item:_it,
        wmode:(_it&&_it.wmode)||'rec',
        manualDays:(_it&&_it.manualDays)?_it.manualDays.slice():[],
        calYear:_now2.getFullYear(),calMonth:_now2.getMonth()};
      render();}
      else if(a==='el'){S.modal={type:'leave',item:S.lvs.find(function(l){return l.id===id;})};render();}
      else if(a==='dc'){var c=S.cons.find(function(c){return c.id===id;});if(c&&confirm('Supprimer '+c.name+' ?')){S.cons=S.cons.filter(function(c){return c.id!==id;});sbDel('consultants',id);render();}}
      else if(a==='dm'){
        if(S.role==='utilisateur'){
          var mDel=S.miss.find(function(m){return m.id===id;});
          if(mDel&&confirm('Soumettre une demande de suppression de cette mission ?')){
            submitApproval('miss_del',{id:id,approver_id:resolveApprover(S._userId)},'Suppression de mission \u2014 '+esc(mDel.cli)+' \u00b7 '+esc(mDel.name));
          }
        }else{
          if(confirm('Supprimer cette mission ?')){S.miss=S.miss.filter(function(m){return m.id!==id;});sbDel('missions',id);render();}
        }
      }
      else if(a==='dl'){
        if(S.role==='utilisateur'){
          var lvDel=S.lvs.find(function(l){return l.id===id;});
          if(lvDel&&confirm('Soumettre une demande de suppression de cette absence ?')){
            submitApproval('leave_del',{id:id,approver_id:resolveApprover(S._userId)},'Suppression d\u2019absence \u2014 '+esc(lvDel.type)+' du '+fDt(lvDel.s)+' au '+fDt(lvDel.e));
          }
        }else{
          if(confirm('Supprimer cette absence ?')){S.lvs=S.lvs.filter(function(l){return l.id!==id;});sbDel('leaves',id);render();}
        }
      }
      /* ── Approbations directeur ── */
      else if(a==='appr-ok'){
        var req=S.approvals.find(function(r){return r.id===id;});
        if(!req)return;
        req.status='approved';req.resolvedAt=new Date().toISOString();
        applyApproval(req);
        S.approvals=S.approvals.map(function(r){return r.id===id?req:r;});
        sbUpsertApproval(req).catch(function(e){console.warn(e);});
        saveLocal();render();
      }
      else if(a==='appr-ko'){
        var reqKo=S.approvals.find(function(r){return r.id===id;});
        if(!reqKo)return;
        S.modal={type:'appr_reject',reqId:id,consName:reqKo.consName,applyDesc:reqKo.applyDesc};render();
      }
      else if(a==='appr-ko-confirm'){
        var reason=gv('appr-reason');
        if(!reason){alert('Veuillez saisir un motif de refus.');return;}
        var reqKo2=S.approvals.find(function(r){return r.id===id;});
        if(!reqKo2)return;
        reqKo2.status='rejected';reqKo2.rejectionReason=reason;reqKo2.resolvedAt=new Date().toISOString();
        S.approvals=S.approvals.map(function(r){return r.id===id?reqKo2:r;});
        sbUpsertApproval(reqKo2).catch(function(e){console.warn(e);});
        saveLocal();S.modal=null;render();
      }
      else if(a==='sc'){
        var n=gv('mn'),t=gv('mti'),s=+gv('ms'),em=gv('me');
        var arr=gv('marr')||null,dep=gv('mdep')||null;
        var it=S.modal.item;
        /* Rattachement d'équipe (directeur/N+1) : réservé au grade gestionnaire et
           au-dessus. Sinon on conserve l'existant. On résout aussi le managerId. */
        var rdir,mgrId;
        if(canEditTeam()){
          rdir=(S.role==='gestionnaire')?S.dirName:gv('mdir');
          var _mgr=mgrAccountByName(rdir);
          mgrId=_mgr?_mgr.id:(it?it.managerId:null);
        }else{rdir=it?(it.dir||''):'';mgrId=it?it.managerId:null;}
        /* BU : réservée au N+1 du consultant (admin/super_admin au-dessus). En
           création ou si vide, hérite de la BU du N+1. */
        var _canBU=it?isConsMyReport(it):canEditTeam();
        var buId;
        if(_canBU){
          buId=gv('mbu')||'';
          if(!buId){var _m2=mgrAccountByName(rdir);if(_m2&&_m2.bu_id)buId=_m2.bu_id;}
        }else{buId=it?(it.buId||null):null;}
        var expArr=(S.modal.expSel||[]).slice();
        var secArr=(S.modal.secSel||[]).slice();
        var ctrct=gv('mcontract')||'salarie';var grade=gv('mgrade')||'';
        if(!n){alert('Le nom est obligatoire.');return;}
        if(!s||s<0)s=0;
        var nc;
        var _fields={name:n,title:t,scr:s,email:em,dir:rdir,managerId:mgrId,buId:buId||null,region:(S.modal.region||''),mobility:(S.modal.mobility||[]).slice(),arrive:arr,depart:dep,expertise:expArr,sectors:secArr,contract:ctrct,grade:grade};
        if(it){S.cons=S.cons.map(function(c){return c.id===it.id?(nc=Object.assign({},c,_fields)):c;});}
        else{nc=Object.assign({id:uid()},_fields);S.cons=S.cons.concat([nc]);}
        sbUpsertCons(nc);
        S.modal=null;render();
      }
      /* save mission */
      else if(a==='sm'){
        var cid=gv('mcid'),mn=gv('mmn'),cl=gv('mcl'),tj=+gv('mtj'),sd=gv('msd'),ed=gv('med')||null;
        var lo=gv('mlo'),mg=gv('mmg'),cc=gv('mcc'),cr=gv('mcr');
        var btEl=document.querySelector('input[name="mbt"]:checked');
        var bt=btEl?btEl.value:'at';
        var wdays=[];var wdEls=document.querySelectorAll('.mwd:checked');
        for(var wi=0;wi<wdEls.length;wi++)wdays.push(+wdEls[wi].value);
        var wmode2=(S.modal&&S.modal.wmode==='man')?'man':'rec';
        var manualDays2=(wmode2==='man'&&S.modal&&S.modal.manualDays)?S.modal.manualDays.slice():[];
        var deal=+gv('mdeal')||0,tmar=(gv('mtmar')===''?null:+gv('mtmar'));var missTeam=readMissTeam();
        if(!cid||!mn||!cl||!sd){alert('Veuillez remplir les champs obligatoires (*).');return;}
        /* Consultant : TJM saisi à 0, le directeur le renseigne lors de l'approbation */
        if(S.role!=='utilisateur'){
          if(bt==='forfait'){
            if(!deal||tmar==null){alert('Pour un forfait : indiquez le montant du deal (CA) et la marge recherchée.');return;}
          }else if(!tj){alert('Pour une mission en Assistance technique : indiquez le TJM.');return;}
        }
        if(!wdays.length&&wmode2!=='man'){alert('Sélectionnez au moins un jour travaillé.');return;}
        if(wmode2==='man'&&!manualDays2.length){alert('Sélectionnez au moins un jour dans le calendrier.');return;}
        var pcode=gv('mpcd')||'';
        var d={cid:cid,name:mn,cli:cl,tjm:tj,sd:sd,ed:ed,loc:lo,mgr:mg,ccn:cc,ccr:cr,btype:bt,wdays:wdays,deal:deal,tmar:tmar,pcode:pcode,wmode:wmode2,manualDays:manualDays2};
        var it=S.modal.item;
        if(S.role==='utilisateur'){
          var mDesc=(it?'Modification':'Ajout')+' de mission — '+esc(cl)+' · '+esc(mn)+' début '+fDt(sd)+(ed?' fin '+fDt(ed):'');
          var mPl=it?Object.assign({},it,d,{approver_id:resolveApprover(S._userId)}):Object.assign({id:uid(),approver_id:resolveApprover(S._userId)},d);
          submitApproval(it?'miss_edit':'miss_add',mPl,mDesc);
        }else{
          var nm;
          if(it){S.miss=S.miss.map(function(m){if(m.id===it.id){nm=Object.assign({},m,d);return nm;}return m;});}
          else{nm=Object.assign({id:uid()},d);S.miss=S.miss.concat([nm]);}
          sbUpsertMiss(nm);
          S.modal=null;render();
        }
      }
      /* save leave — MODÈLE PAR IDENTITÉ (N+1) */
      else if(a==='sl'){
        var lci=gv('mlc'),lt=gv('mlt'),ls=gv('mls'),le=gv('mle');
        if(!lci||!ls||!le){alert('Veuillez remplir les champs obligatoires (*).');return;}
        var it=S.modal.item;
        /* Qui est mon approbateur ? = mon N+1 effectif (suit délégation, remonte au N+2 si absent) */
        var approverId=resolveApprover(S._userId);
        var descL=(it?'Modification':'Ajout')+' d\u2019absence \u2014 '+esc(lt)+' du '+fDt(ls)+' au '+fDt(le);
        if(!approverId){
          /* Pas de N+1 (Super Admin tout en haut) → application directe, sans validation */
          var nl;
          if(it){S.lvs=S.lvs.map(function(l){if(l.id===it.id){nl=Object.assign({},l,{cid:lci,type:lt,s:ls,e:le});return nl;}return l;});}
          else{nl={id:uid(),cid:lci,type:lt,s:ls,e:le};S.lvs=S.lvs.concat([nl]);}
          sbUpsertLeave(nl);
          S.modal=null;render();
        }else{
          /* Soumettre à l'approbateur désigné (par identifiant) */
          var plL=it?Object.assign({},it,{cid:lci,type:lt,s:ls,e:le}):{id:uid(),cid:lci,type:lt,s:ls,e:le};
          submitApproval(it?'leave_edit':'leave_add',Object.assign({},plL,{approver_id:approverId}),descL);
        }
      }
      /* ════════════════════ RECRUTEMENT ════════════════════ */
      else if(a==='arec'){S.modal={type:'candidate',item:null,expSel:[],secSel:[],locSel:[],locTarget:'',locSecondary:[],mobileFrance:false,locSecQ:''};render();}
      else if(a==='erec'){
        var itEd=S.cands.find(function(c){return c.id===id;});
        S.modal={type:'candidate',item:itEd,
          expSel:(itEd&&itEd.expertise)?itEd.expertise.slice():[],
          secSel:(itEd&&itEd.sectors)?itEd.sectors.slice():[],
          locSel:(itEd&&itEd.locations)?itEd.locations.slice():[],
          locTarget:(itEd&&itEd.locTarget)||'',
          locSecondary:(itEd&&itEd.locSecondary)?itEd.locSecondary.slice():[],
          mobileFrance:!!(itEd&&itEd.mobileFrance),locSecQ:''};
        render();
      }
      else if(a==='drec'){
        var cdDel=S.cands.find(function(c){return c.id===id;});
        if(cdDel&&confirm('Supprimer le candidat '+cdDel.name+' ?\nCette action supprime aussi tous ses retours clients. Irr\u00e9versible.')){
          S.cands=S.cands.filter(function(c){return c.id!==id;});
          if(S.recSel===id)S.recSel=null;
          sbDel('candidates',id);
          render();
        }
      }
      else if(a==='screc'){
        var rn=gv('rcn');
        if(!rn){alert('Le nom du candidat est obligatoire.');return;}
        var expArr=(S.modal.expSel||[]).slice();
        var secArr=(S.modal.secSel||[]).slice();
        var marEl=document.getElementById('rcmar');
        var itC=S.modal.item;
        var candId=itC?itC.id:uid();

        var crFilePath=itC?(itC.compteRenduFilePath||null):null;
        var crFileName=itC?(itC.compteRenduFileName||null):null;
        var crFileEl=document.getElementById('rccrfile');
        var crFile=(crFileEl&&crFileEl.files&&crFileEl.files[0])?crFileEl.files[0]:null;
        if(crFile){
          try{
            crFilePath=await uploadCandFile(crFile,candId,'cr');
            crFileName=crFile.name;
          }catch(upErr){alert('\u26a0 '+upErr.message);return;}
        }

        /* CV : un ou plusieurs fichiers, s'ajoutent aux CV déjà présents */
        var cvArr=(itC&&itC.cvFiles)?itC.cvFiles.slice():[];
        var cvFileEl=document.getElementById('rccv');
        var cvFiles=(cvFileEl&&cvFileEl.files)?Array.from(cvFileEl.files):[];
        for(var cvi=0;cvi<cvFiles.length;cvi++){
          try{
            var cvId=uid();
            var cvPath=await uploadCandFile(cvFiles[cvi],candId,'cv_'+cvId);
            cvArr.push({id:cvId,fileName:cvFiles[cvi].name,filePath:cvPath});
          }catch(upErr){alert('\u26a0 Erreur upload CV ('+cvFiles[cvi].name+') : '+upErr.message);return;}
        }

        /* Localisation classifiée : cible (priorité), secondaires, mobilité France.
           On lit aussi la valeur en direct de l'input cible (au cas où non encore
           propagée à l'état). `locations` est maintenu (= cible + secondaires) pour
           la compatibilité (filtres, tableau, anciennes fiches). */
        var _mobFr=!!S.modal.mobileFrance;
        var _locTarget=(gv('cloc-target')||S.modal.locTarget||'').trim();
        var _locSec=(S.modal.locSecondary||[]).slice();
        var locArr=_mobFr?[]:([_locTarget].concat(_locSec).filter(Boolean));

        /* Recruteur assigné : valeur choisie dans le formulaire. Si laissée vide,
           assignation automatique au créateur pour un NOUVEAU candidat (nom
           d'affichage, sinon email). En édition, une valeur vide = « — Aucun — »
           volontaire, donc on désassigne réellement. */
        var _selRec=gv('rcrec');
        var _creatorName=((S.profileFirstName||'')+' '+(S.profileLastName||'')).trim()||S._userEmail||'';
        var _recruiter=_selRec||(itC?'':_creatorName);
        var cfields={
          name:rn,email:gv('rce'),phone:gv('rcph'),recruiter:_recruiter,
          locations:locArr,locTarget:_mobFr?'':_locTarget,locSecondary:_mobFr?[]:_locSec,mobileFrance:_mobFr,nationality:gv('rcnat')||'',
          availDate:gv('rcav')||'',reqSalary:+gv('rcsal')||0,
          yearsExp:+gv('rcyrs')||0,expertise:expArr,sectors:secArr,cvFiles:cvArr,
          compteRendu:gv('rccr'),compteRenduFilePath:crFilePath,compteRenduFileName:crFileName,
          marginPct:marEl?+marEl.value:25,status:gv('rcst')||'nouveau'
        };
        var ncand;
        if(itC){
          ncand=Object.assign({},itC,cfields);
          S.cands=S.cands.map(function(c){return c.id===itC.id?ncand:c;});
        }else{
          ncand=Object.assign({id:candId,createdBy:S._userEmail||'',feedbacks:[],cgiMeetings:[]},cfields);
          S.cands=S.cands.concat([ncand]);
        }

        /* ── Recrutement : créer le consultant dans l'équipe ── */
        var rcCb=document.getElementById('rc-recruited');
        var wasRecruited=itC&&itC.recruited;
        if(rcCb&&rcCb.checked){
          var rcStart=gv('rc-start');
          var rcPoste=gv('rc-poste');
          /* rc-dir = id du compte gestionnaire (N+1) s\u00e9lectionn\u00e9 \u2192 nom + managerId + BU h\u00e9rit\u00e9e */
          var rcDirId=gv('rc-dir');
          var _mgrAcc=(S.orgProfiles||[]).find(function(p){return p.id===rcDirId;});
          var rcDirName=_mgrAcc?(((_mgrAcc.first_name||'')+' '+(_mgrAcc.last_name||'')).trim()):'';
          if(!rcStart||!rcPoste){alert('La date de d\u00e9marrage et le poste sont obligatoires pour int\u00e9grer le consultant dans l\'\u00e9quipe.');return;}
          /* Stocker les champs recrutement sur le candidat */
          ncand.recruited=true;
          ncand.recruitStart=rcStart;
          ncand.recruitPoste=rcPoste;
          ncand.recruitDir=rcDirName;
          ncand.status='recrute';
          /* Créer ou mettre à jour le profil consultant (ne crée qu'une seule fois) */
          if(!wasRecruited){
            var newCons={
              id:uid(),
              name:rn,
              title:rcPoste,
              scr:Math.round(recScr(cfields.reqSalary||0)),
              email:cfields.email||'',
              dir:rcDirName||'',
              managerId:_mgrAcc?_mgrAcc.id:null,
              buId:_mgrAcc?(_mgrAcc.bu_id||null):null, /* héritage BU du gestionnaire */
              arrive:rcStart,
              depart:null,
              phone:cfields.phone||''
            };
            S.cons=S.cons.concat([newCons]);
            sbUpsertCons(newCons).catch(function(err){console.warn('sbUpsertCons (recrutement):',err);});
            ncand.consId=newCons.id; /* lien entre candidat et consultant */
          }
        }

        sbUpsertCand(ncand).catch(function(err){console.warn('sbUpsertCand:',err);alert('\u26a0 Erreur de synchronisation : '+err.message);});
        S.modal=null;render();
        if(rcCb&&rcCb.checked&&!wasRecruited){
          setTimeout(function(){alert('\u2713 '+rn+' a \u00e9t\u00e9 ajout\u00e9(e) \u00e0 l\'\u00e9quipe.\nRetrouvez le profil dans l\'onglet \u00c9quipe pour compl\u00e9ter les informations (SCR, missions...).');},100);
        }
      }
      else if(a==='recback'){S.recSel=null;S.recAddMeet=false;S.recAddCgi=false;S.recAddCv=false;S.recEditMeetId=null;S.recEditCgiId=null;render();}
      else if(a==='recmtoggle'){S.recAddMeet=true;S.recEditMeetId=null;render();}
      else if(a==='recmcancel'){S.recAddMeet=false;S.recEditMeetId=null;render();}
      else if(a==='recmedit'){S.recEditMeetId=fb;S.recAddMeet=false;render();}
      else if(a==='recmsave'){
        var mtCli=gv('mtcli'),mtCon=gv('mtcon'),mtDate=gv('mtdate')||fD(new Date()),mtTxt=gv('mttext');
        var mtFileEl=document.getElementById('mtfile');
        var mtFile=(mtFileEl&&mtFileEl.files&&mtFileEl.files[0])?mtFileEl.files[0]:null;
        if(!mtCli&&!mtCon&&!mtTxt&&!mtFile){alert('Renseignez au moins le client, l\u2019opérationnel, un compte rendu ou un fichier.');return;}
        var cdM=S.cands.find(function(c){return c.id===id;});
        if(!cdM)return;
        if(fb){
          /* édition d\'une rencontre existante */
          var existing=(cdM.feedbacks||[]).find(function(f){return f.id===fb;});
          if(!existing)return;
          existing.client=mtCli;existing.contact=mtCon;existing.date=mtDate;existing.text=mtTxt||'';
          if(mtFile){
            try{
              var epath=await uploadCandFile(mtFile,id,fb);
              existing.filePath=epath;existing.fileName=mtFile.name;
            }catch(upErr){alert('\u26a0 '+upErr.message);return;}
          }
          cdM.feedbacks=(cdM.feedbacks||[]).map(function(f){return f.id===fb?existing:f;});
          S.recEditMeetId=null;
        }else{
          /* nouvelle rencontre */
          var mtId=uid();
          var entry={id:mtId,date:mtDate,client:mtCli,contact:mtCon,author:S._userEmail||'',text:mtTxt||''};
          if(mtFile){
            try{
              var mpath=await uploadCandFile(mtFile,id,mtId);
              entry.filePath=mpath;entry.fileName=mtFile.name;
            }catch(upErr){alert('\u26a0 '+upErr.message);return;}
          }
          cdM.feedbacks=(cdM.feedbacks||[]).concat([entry]);
          S.recAddMeet=false;
        }
        S.cands=S.cands.map(function(c){return c.id===id?cdM:c;});
        sbUpsertCand(cdM).catch(function(err){console.warn('sbUpsertCand meet:',err);alert('\u26a0 Erreur de synchronisation : '+err.message);});
        render();
      }
      else if(a==='recmdel'){
        if(!confirm('Supprimer cette rencontre client ?'))return;
        var cdMd=S.cands.find(function(c){return c.id===id;});
        if(!cdMd)return;
        cdMd.feedbacks=(cdMd.feedbacks||[]).filter(function(f){return f.id!==fb;});
        S.cands=S.cands.map(function(c){return c.id===id?cdMd:c;});
        if(S.recEditMeetId===fb)S.recEditMeetId=null;
        sbUpsertCand(cdMd).catch(function(err){console.warn('sbUpsertCand meetdel:',err);});
        render();
      }
      else if(a==='recmdl'){
        var cdMv=S.cands.find(function(c){return c.id===id;});
        if(!cdMv)return;
        if(fb==='__cr'){
          if(cdMv.compteRenduFilePath)downloadCandFile(cdMv.compteRenduFilePath,cdMv.compteRenduFileName);
          return;
        }
        var mtEntry=(cdMv.feedbacks||[]).find(function(f){return f.id===fb;});
        if(mtEntry&&mtEntry.filePath)downloadCandFile(mtEntry.filePath,mtEntry.fileName);
      }
      else if(a==='recgtoggle'){S.recAddCgi=true;S.recEditCgiId=null;render();}
      else if(a==='recgcancel'){S.recAddCgi=false;S.recEditCgiId=null;render();}
      else if(a==='recgedit'){S.recEditCgiId=fb;S.recAddCgi=false;render();}
      else if(a==='recgsave'){
        var cgPerson=gv('cgperson'),cgDate=gv('cgdate')||fD(new Date()),cgTxt=gv('cgtext');
        var cgFileEl=document.getElementById('cgfile');
        var cgFile=(cgFileEl&&cgFileEl.files&&cgFileEl.files[0])?cgFileEl.files[0]:null;
        if(!cgPerson&&!cgTxt&&!cgFile){alert('Renseignez au moins la personne rencontrée, un compte rendu ou un fichier.');return;}
        var cdG=S.cands.find(function(c){return c.id===id;});
        if(!cdG)return;
        if(fb){
          /* édition d\'une rencontre CGI existante */
          var existingG=(cdG.cgiMeetings||[]).find(function(f){return f.id===fb;});
          if(!existingG)return;
          existingG.person=cgPerson;existingG.date=cgDate;existingG.text=cgTxt||'';
          if(cgFile){
            try{
              var gepath=await uploadCandFile(cgFile,id,fb);
              existingG.filePath=gepath;existingG.fileName=cgFile.name;
            }catch(upErr){alert('\u26a0 '+upErr.message);return;}
          }
          cdG.cgiMeetings=(cdG.cgiMeetings||[]).map(function(f){return f.id===fb?existingG:f;});
          S.recEditCgiId=null;
        }else{
          var cgId=uid();
          var gentry={id:cgId,date:cgDate,person:cgPerson,author:S._userEmail||'',text:cgTxt||''};
          if(cgFile){
            try{
              var gpath=await uploadCandFile(cgFile,id,cgId);
              gentry.filePath=gpath;gentry.fileName=cgFile.name;
            }catch(upErr){alert('\u26a0 '+upErr.message);return;}
          }
          cdG.cgiMeetings=(cdG.cgiMeetings||[]).concat([gentry]);
          S.recAddCgi=false;
        }
        S.cands=S.cands.map(function(c){return c.id===id?cdG:c;});
        sbUpsertCand(cdG).catch(function(err){console.warn('sbUpsertCand cgi:',err);alert('\u26a0 Erreur de synchronisation : '+err.message);});
        render();
      }
      else if(a==='recgdel'){
        if(!confirm('Supprimer cette rencontre CGI ?'))return;
        var cdGd=S.cands.find(function(c){return c.id===id;});
        if(!cdGd)return;
        cdGd.cgiMeetings=(cdGd.cgiMeetings||[]).filter(function(f){return f.id!==fb;});
        S.cands=S.cands.map(function(c){return c.id===id?cdGd:c;});
        if(S.recEditCgiId===fb)S.recEditCgiId=null;
        sbUpsertCand(cdGd).catch(function(err){console.warn('sbUpsertCand cgidel:',err);});
        render();
      }
      else if(a==='recgdl'){
        var cdGv=S.cands.find(function(c){return c.id===id;});
        if(!cdGv)return;
        var gEntry=(cdGv.cgiMeetings||[]).find(function(f){return f.id===fb;});
        if(gEntry&&gEntry.filePath)downloadCandFile(gEntry.filePath,gEntry.fileName);
      }
      else if(a==='reccvtoggle'){S.recAddCv=true;render();}
      else if(a==='reccvcancel'){S.recAddCv=false;render();}
      else if(a==='reccvadd'){
        var cvFileEl2=document.getElementById('cvfile');
        var cvFiles2=(cvFileEl2&&cvFileEl2.files)?Array.from(cvFileEl2.files):[];
        if(!cvFiles2.length){alert('S\u00e9lectionnez au moins un fichier.');return;}
        var cdCv=S.cands.find(function(c){return c.id===id;});
        if(!cdCv)return;
        var newCvs=(cdCv.cvFiles||[]).slice();
        for(var cvj=0;cvj<cvFiles2.length;cvj++){
          try{
            var cvId2=uid();
            var cvPath2=await uploadCandFile(cvFiles2[cvj],id,'cv_'+cvId2);
            newCvs.push({id:cvId2,fileName:cvFiles2[cvj].name,filePath:cvPath2});
          }catch(upErr){alert('\u26a0 Erreur upload CV ('+cvFiles2[cvj].name+') : '+upErr.message);return;}
        }
        cdCv.cvFiles=newCvs;
        S.cands=S.cands.map(function(c){return c.id===id?cdCv:c;});
        S.recAddCv=false;
        sbUpsertCand(cdCv).catch(function(err){console.warn('sbUpsertCand cv:',err);alert('\u26a0 Erreur de synchronisation : '+err.message);});
        render();
      }
      else if(a==='reccvdel'){
        if(!confirm('Supprimer ce CV ?'))return;
        var cdCvD=S.cands.find(function(c){return c.id===id;});
        if(!cdCvD)return;
        cdCvD.cvFiles=(cdCvD.cvFiles||[]).filter(function(f){return f.id!==fb;});
        S.cands=S.cands.map(function(c){return c.id===id?cdCvD:c;});
        sbUpsertCand(cdCvD).catch(function(err){console.warn('sbUpsertCand cvdel:',err);});
        render();
      }
      else if(a==='reccvdl'){
        var cdCvV=S.cands.find(function(c){return c.id===id;});
        if(!cdCvV)return;
        var cvEntry=(cdCvV.cvFiles||[]).find(function(f){return f.id===fb;});
        if(cvEntry&&cvEntry.filePath)downloadCandFile(cvEntry.filePath,cvEntry.fileName);
      }
      /* inviter / supprimer un directeur */
      else if(a==='svp-add-vp'){
        alert('La création de compte se fait désormais en payant la licence.\nAllez dans « Gestion des accès → Ajouter des membres » pour créer cet accès.');
      }
      else if(a==='svp-del-vp'){
        if(confirm('Supprimer cette invitation '+rLabel('admin')+' ?')){sbSVPDelVP(id).then(function(){loadSVPInvites().then(render);});}
      }
      else if(a==='svp-add-rec'){
        alert('La création de compte se fait désormais en payant la licence.\nAllez dans « Gestion des accès → Ajouter des membres » pour créer cet accès.');
      }
      else if(a==='svp-del-rec'){
        if(confirm('Supprimer cette invitation Recruteur ?')){sbSVPDelRec(id).then(function(){loadSVPInvites().then(render);});}
      }
      else if(a==='admin-cons-add'){
        alert('La cr\u00e9ation de compte se fait d\u00e9sormais en payant la licence.\nAllez dans \u00ab Gestion des acc\u00e8s \u2192 Ajouter des membres \u00bb pour cr\u00e9er cet acc\u00e8s.');
      }
      else if(a==='admin-cons-del'){
        if(confirm('Supprimer cette invitation ?')){
          sbDelConsInvite(id).then(function(){loadConsInvites().then(render);});
        }
      }
      /* activité jour par jour */
      else if(a==='day'){S.modal={type:'dayexc',day:b.getAttribute('data-day'),cid:S.actCid};render();}
      else if(a==='day-set'){
        var dt=gv('dexc-type'),dd=S.modal.day,dcid=S.modal.cid;
        if(S.role==='utilisateur'){
          submitApproval('leave_add',{id:uid(),cid:dcid,type:dt,s:dd,e:dd,approver_id:resolveApprover(S._userId)},
            'Ajout d\u2019absence \u2014 '+esc(dt)+' le '+fDt(dd));
        }else{
          var nl={id:uid(),cid:dcid,type:dt,s:dd,e:dd};
          S.lvs=S.lvs.concat([nl]);sbUpsertLeave(nl);S.modal=null;render();
        }
      }
      else if(a==='day-clear'){
        if(S.role==='utilisateur'){
          var lvClr=S.lvs.find(function(l){return l.id===id;});
          submitApproval('leave_del',{id:id,approver_id:resolveApprover(S._userId)},'Suppression d\u2019absence'+(lvClr?' \u2014 '+esc(lvClr.type)+' le '+fDt(lvClr.s):''));
        }else{
          S.lvs=S.lvs.filter(function(l){return l.id!==id;});sbDel('leaves',id);S.modal=null;render();
        }
      }
      else if(a==='act-prev'){S.actMonth=shiftMonth(S.actMonth||TODAY.slice(0,7),-1);render();}
      else if(a==='act-next'){S.actMonth=shiftMonth(S.actMonth||TODAY.slice(0,7),1);render();}
      else if(a==='act-today'){S.actMonth=TODAY.slice(0,7);render();}
      /* ── CRM Business handlers ── */
      else if(a==='biz-new'){
        var types={pipeline:'opp',comptes:'acc',contacts:'ct',activites:'act'};
        var t=types[S.bizTab||'pipeline']||'opp';
        S.bizModal={type:t,item:null,btype:'at',consPickerSel:[]};render();
      }
      else if(a==='biz-edit-acc'){var _a=S.bizAccounts.find(function(x){return x.id===id;});S.bizModal={type:'acc',item:_a};render();}
      else if(a==='biz-edit-ct'){var _ct=S.bizContacts.find(function(x){return x.id===id;});S.bizModal={type:'ct',item:_ct};render();}
      else if(a==='biz-edit-opp'){var _o=S.bizOpps.find(function(x){return x.id===id;});S.bizModal={type:'opp',item:_o,btype:(_o&&_o.btype)||'at',consPickerSel:(_o&&_o.consultant_ids)||[],oppTeam:(_o&&_o.opp_team&&_o.opp_team.length?_o.opp_team:(_o&&_o.consultant_ids||[]).map(function(cid){return {cid:cid,taux:Math.round(100/Math.max((_o.consultant_ids||[]).length,1)),wdays:[1,2],tmar:25};})||[])||[{cid:'',taux:100,wdays:[1,2],tmar:25}]};render();}
      else if(a==='biz-edit-act'){var _k=S.bizActivities.find(function(x){return x.id===id;});S.bizModal={type:'act',item:_k};render();}
      else if(a==='biz-del'){var _tbl=b.getAttribute('data-table')||'';bizDelItem(_tbl,id);}
      else if(a==='biz-opp-mission'){bizOppToMission(id);}
      else if(a==='restart-onboarding'){restartOnboarding();}
      else if(a==='import-cons-open'){openImportCons();}
      else if(a==='import-cons-tpl'){downloadConsTemplate();}
      else if(a==='import-cons-map'){applyConsImp();}
      else if(a==='import-cons-back'){if(S.consImp){S.consImp.step='map';render();}}
      else if(a==='import-cons-commit'){commitConsImp();}
      else if(a==='import-cons-preset-apply'){applyConsPreset();}
      else if(a==='import-cons-preset-save'){saveConsPreset();}
      else if(a==='import-cons-preset-del'){delConsPreset();}
      else if(a==='bulk-invite-open'||a==='bulk-invite-send'||a==='import-cons-invite'){
        alert('La création de compte se fait désormais en payant les licences.\nAllez dans « Gestion des accès → Ajouter des membres » pour créer les accès (une licence par personne).');
      }
      else if(a==='open-salary-detail'){S.modal={type:'salary_detail'};render();}
      /* ── Invites unifiés ── */
      else if(a==='seat-add-row'){
        var sfn=(gv('seat-fn')||'').trim(),sln=(gv('seat-ln')||'').trim();
        var sem=(gv('seat-email')||'').toLowerCase().trim(),srole=gv('seat-role')||'utilisateur';
        if(!sfn||!sln||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sem)){alert('Prénom, nom et email valides requis.');return;}
        S.seatDraft=S.seatDraft||[];
        S.seatDraft.push({first_name:sfn,last_name:sln,email:sem,role:srole});
        render();
      }
      else if(a==='seat-del-row'){
        var sidx=parseInt(b.getAttribute('data-idx'),10);
        if(!isNaN(sidx)&&S.seatDraft){S.seatDraft.splice(sidx,1);render();}
      }
      else if(a==='seats-buy'){
        if(!sb||!SB_CID){alert('Connexion requise.');return;}
        var dr=(S.seatDraft||[]);if(!dr.length){alert('Ajoutez au moins un membre.');return;}
        var PM={utilisateur:'price_1TqUYFA6guMn7iZUAYWbMGfR',gestionnaire:'price_1TqUYNA6guMn7iZUW0TAySfr',admin:'price_1TqUYQA6guMn7iZUdOwh2sri',super_admin:'price_1TqUYTA6guMn7iZUVdiYjBhI',sales:'price_1TqUYKA6guMn7iZUBf840s9D',recruteur:'price_1TqUYHA6guMn7iZUhwKFDqQQ'};
        var cnts={};dr.forEach(function(x){cnts[x.role]=(cnts[x.role]||0)+1;});
        var items=Object.keys(cnts).map(function(r){return {price_id:PM[r],quantity:cnts[r]};}).filter(function(x){return x.price_id;});
        if(!items.length){alert('Rôles invalides.');return;}
        b.disabled=true;b.textContent='Redirection…';
        sb.auth.getSession().then(function(ses){
          var tok=ses&&ses.data&&ses.data.session&&ses.data.session.access_token;
          return fetch('https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/seats-checkout',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({items:items,seats:dr,success_url:location.origin+'/app',cancel_url:location.origin+'/app'})});
        }).then(function(r){return r.json();}).then(function(d){
          if(d&&d.url){location.href=d.url;return;}
          b.disabled=false;b.textContent='Payer et créer les comptes →';alert((d&&d.error)||'Erreur — réessayez.');
        }).catch(function(){b.disabled=false;b.textContent='Payer et créer les comptes →';alert('Erreur réseau.');});
      }
      else if(a==='billing-open'){
        if(!sb||!SB_CID){alert('Connexion requise.');return;}
        b.disabled=true;var _bo=b.textContent;b.textContent='Ouverture…';
        sb.auth.getSession().then(function(ses){
          var tok=ses&&ses.data&&ses.data.session&&ses.data.session.access_token;
          return fetch('https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/billing-portal',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({return_url:location.origin+'/app'})});
        }).then(function(r){return r.json();}).then(function(d){
          if(d&&d.url){location.href=d.url;return;}
          b.disabled=false;b.textContent=_bo;alert((d&&d.error)||'Erreur — réessayez.');
        }).catch(function(){b.disabled=false;b.textContent=_bo;alert('Erreur réseau.');});
      }
      else if(a==='seats-retry'){
        if(!sb||!SB_CID){alert('Connexion requise.');return;}
        b.disabled=true;var _bt=b.textContent;b.textContent='Relance\u2026';
        sb.auth.getSession().then(function(ses){
          var tok=ses&&ses.data&&ses.data.session&&ses.data.session.access_token;
          return fetch('https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/retry-seats',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({})});
        }).then(function(r){return r.json();}).then(function(d){
          if(d&&typeof d.ok==='number'){
            alert(d.ok+' compte(s) cr\u00e9\u00e9(s)'+(d.ko?', '+d.ko+' encore en erreur (email d\u00e9j\u00e0 utilis\u00e9 ?)':'')+'.');
            loadPendingSeats().then(function(){render();});
          }else{b.disabled=false;b.textContent=_bt;alert((d&&d.error)||'Erreur \u2014 r\u00e9essayez.');}
        }).catch(function(){b.disabled=false;b.textContent=_bt;alert('Erreur r\u00e9seau.');});
      }
      else if(a==='inv-del'){
        if(!confirm('Supprimer cette invitation ? La fiche \u00e9quipe associ\u00e9e sera aussi retir\u00e9e si le compte n\u2019a pas encore \u00e9t\u00e9 activ\u00e9.'))return;
        var invToDel=(S.allInvites||[]).find(function(iv){return iv.id===id;});
        var delCons=(invToDel&&!invToDel.used&&invToDel.cons_id)
          ?sb.from('consultants').delete().eq('id',invToDel.cons_id)
          :Promise.resolve();
        Promise.resolve(delCons).then(function(){
          return sb.from('invites').delete().eq('id',id);
        }).then(function(){
          S.allInvites=(S.allInvites||[]).filter(function(iv){return iv.id!==id;});
          if(invToDel&&invToDel.cons_id)S.cons=S.cons.filter(function(cc){return cc.id!==invToDel.cons_id;});
          S._ks&&(S._ks._valid=false);
          render();
        });
      }
      else if(a==='open-tutorial'){var tid=b.getAttribute('data-tutid');if(tid&&TUTORIALS[tid]){S.modal={type:'tutorial',tutId:tid,tutStep:0};render();}}
      else if(a==='biz-tab'){S.bizTab=b.getAttribute('data-biz-tab')||'pipeline';render();}
    };
  })(bs[j]);}
  /* overlay */
  var ov=el('mov');if(ov)ov.onclick=function(e){if(e.target===ov){S.modal=null;render();}};
  /* mission : afficher/masquer le bloc forfait selon le type choisi */
  var mbtEls=document.querySelectorAll('input[name="mbt"]');
  for(var mb=0;mb<mbtEls.length;mb++){mbtEls[mb].onchange=function(){
    var ft=document.getElementById('ft-fields');
    var sel=document.querySelector('input[name="mbt"]:checked');
    if(ft)ft.style.display=(sel&&sel.value==='forfait')?'block':'none';
  };}
  /* import file input */
  var impFile=el('imp-file');
  if(impFile)impFile.onchange=function(){importJSON(this.files[0]);this.value='';};
  /* logout & sync */
  /* Imputations + Missions : file inputs */
  var missImpFi=el('miss-imp-fi');
  if(missImpFi)missImpFi.onchange=function(){if(this.files[0])handleMissImpFile(this.files[0]);this.value='';};
  var missImpDz=el('miss-imp-dz');
  if(missImpDz){
    missImpDz.addEventListener('dragover',function(e){e.preventDefault();missImpDz.style.borderColor='#2563eb';});
    missImpDz.addEventListener('dragleave',function(){missImpDz.style.borderColor='#e2e8f0';});
    missImpDz.addEventListener('drop',function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleMissImpFile(f);});
    missImpDz.addEventListener('click',function(e){if(e.target.tagName!=='LABEL'&&e.target.tagName!=='INPUT'){var fi2=el('miss-imp-fi');if(fi2)fi2.click();}});
  }
  if(impFile)impFile.onchange=function(){if(this.files[0])handleImpFile(this.files[0]);this.value='';};
  var impDz=el('imp-dz');
  if(impDz){
    impDz.addEventListener('dragover',function(e){e.preventDefault();impDz.style.borderColor='#2563eb';impDz.style.background='#eff6ff';});
    impDz.addEventListener('dragleave',function(){impDz.style.borderColor='#e2e8f0';impDz.style.background='#fff';});
    impDz.addEventListener('drop',function(e){
      e.preventDefault();impDz.style.borderColor='#e2e8f0';impDz.style.background='#fff';
      var f=e.dataTransfer.files[0];if(f)handleImpFile(f);
    });
    impDz.addEventListener('click',function(e){if(e.target.tagName!=='LABEL'&&e.target.tagName!=='INPUT'){var fi=el('imp-fi');if(fi)fi.click();}});
  }
  var logoutBtn=el('sb-logout');
  if(document.querySelector('[data-act="logout"]')){
    document.querySelector('[data-act="logout"]').onclick=function(){
      if(sb){sb.auth.signOut().then(function(){window.location.href="/login";});}
      else{window.location.href="/login";}
    };
  }
  /* sync */
  if(document.querySelector('[data-act="sync"]')){
    document.querySelector('[data-act="sync"]').onclick=function(){syncToSB();};
  }
}

