'use strict';
/* ══════════════════════════════════════════════════════════════════
   MODULE CRM BUSINESS — Comptes · Contacts · Pipeline · Activités
══════════════════════════════════════════════════════════════════ */

/* ── Constantes CRM ── */

var OPP_STATUS=[
  {id:'identification',lb:'Identification', bg:'#f0f9ff',fg:'#0369a1'},
  {id:'qualification',  lb:'Qualification',  bg:'#fef3c7',fg:'#92400e'},
  {id:'proposition',    lb:'Proposition',    bg:'#ede9fe',fg:'#5b21b6'},
  {id:'negociation',    lb:'Négociation',    bg:'#fff7ed',fg:'#c2410c'},
  {id:'gagne',          lb:'Gagné ✓',        bg:'#d1fae5',fg:'#065f46'},
  {id:'perdu',          lb:'Perdu ✗',        bg:'#fee2e2',fg:'#b91c1c'},
];
var ACT_TYPES=[
  {id:'appel',   lb:'📞 Appel'},
  {id:'email',   lb:'📧 Email'},
  {id:'reunion', lb:'🤝 Réunion'},
  {id:'relance', lb:'🔔 Relance'},
  {id:'demo',    lb:'💻 Démo'},
];
var ACCOUNT_STATUS=[
  {id:'prospect',        lb:'Prospect'},
  {id:'client_actif',    lb:'Client actif'},
  {id:'client_inactif',  lb:'Client inactif'},
];
var CONTACT_ROLES=[
  {id:'decideur',      lb:'Décideur'},
  {id:'prescripteur',  lb:'Prescripteur'},
  {id:'utilisateur',   lb:'Utilisateur'},
];
var SECTORS_BIZ=['Banque/Finance','Assurance','Industrie','Énergie','Retail','Santé','Télécom','Media','Transport','Administration','Conseil','Technologie','Immobilier','Autre'];

/* ── Helpers CRM ── */
function oppStLb(id){var s=OPP_STATUS.find(function(x){return x.id===id;});return s?s.lb:id;}
function oppStStyle(id){var s=OPP_STATUS.find(function(x){return x.id===id;});return s?'background:'+s.bg+';color:'+s.fg+';':'';}
function accName(id){var a=S.bizAccounts.find(function(x){return x.id===id;});return a?a.name:'';}
function ctName(id){var c=S.bizContacts.find(function(x){return x.id===id;});return c?(c.first_name+' '+c.last_name).trim():'';}
/* CA potentiel d'une opportunité (valeur totale du deal).
   - Forfait : montant du deal.
   - AT : TJM × jours. Si les jours ne sont pas saisis, on les déduit des dates
     (jours ouvrés entre démarrage et fin) ou de la durée en mois (~20 j/mois),
     pour qu'un TJM + une probabilité suffisent à alimenter le pipeline pondéré. */
function caPot(opp){
  if(!opp)return 0;
  if(opp.btype==='forfait')return +opp.deal_amount||0;
  var jours=+opp.jours_estimes||0;
  if(!jours){
    if(opp.date_start&&opp.date_end)jours=wDays(opp.date_start,opp.date_end,H);
    else if(+opp.duree_mois)jours=Math.round((+opp.duree_mois)*20);
  }
  return (+opp.tjm_cible||0)*jours;
}
function uid2(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:r&0x3|0x8).toString(16);});}

/* ── Supabase CRM CRUD ── */
async function loadBiz(){
  if(!sb||!SB_CID)return;
  try{
    var [ra,rc,ro,rk,rp,rv,rt,rn]=await Promise.all([
      sb.from('crm_accounts').select('*').eq('company_id',SB_CID).order('name'),
      sb.from('crm_contacts').select('*').eq('company_id',SB_CID).order('last_name'),
      sb.from('crm_opportunities').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false}),
      sb.from('crm_activities').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false}),
      sb.from('account_plans').select('*').eq('company_id',SB_CID),
      sb.from('account_reviews').select('*').eq('company_id',SB_CID).order('review_date',{ascending:false}),
      sb.from('account_team').select('*').eq('company_id',SB_CID),
      sb.from('notification_settings').select('*').eq('company_id',SB_CID).maybeSingle(),
    ]);
    if(ra.data)S.bizAccounts=ra.data;
    if(rc.data)S.bizContacts=rc.data;
    if(ro.data)S.bizOpps=ro.data;
    if(rk.data)S.bizActivities=rk.data;
    if(rp.data)S.accountPlans=rp.data;
    if(rv.data)S.accountReviews=rv.data;
    if(rt.data)S.accountTeam=rt.data;
    if(rn&&rn.data)S.notifSettings=rn.data;
  }catch(e){console.warn('CRM load:',e);}
}
function visibleOpps(){
  var all=S.bizOpps,me=S._userEmail||'';
  /* Super Admin : voit TOUTES les opportunités */
  if(S.role==='super_admin')return all;
  /* Admin : voit ses opps + celles de ses Gestionnaires + tout le dessous */
  if(S.role==='admin'){
    var myVpName=S.vpName||me;
    return all.filter(function(o){
      if(!o.owner_email)return true;
      if(o.owner_email===me)return true;
      if(o.owner_vp===myVpName)return true; /* Gestionnaires sous cet Admin */
      return false;
    });
  }
  /* Gestionnaire : ses opps + opps des Business Manager/Utilisateurs de son équipe */
  if(S.role==='gestionnaire'){
    var myTeamEmails=((S._all&&S._all.cons)||S.cons).map(function(c){return c.email||'';}).filter(Boolean);
    return all.filter(function(o){
      if(!o.owner_email)return true;
      if(o.owner_email===me)return true;
      if(myTeamEmails.indexOf(o.owner_email)>=0)return true;
      if(o.owner_dir===S.dirName)return true; /* Business Manager rattachés à ce Gestionnaire */
      return false;
    });
  }
  /* Business Manager / Utilisateur : uniquement leurs propres opportunités */
  return all.filter(function(o){return !o.owner_email||o.owner_email===me;});
}
function pendingBizApprovals(){
  if(S.role==='utilisateur')return [];
  if(S.role==='gestionnaire'){
    var myEmails=((S._all&&S._all.cons)||S.cons).map(function(c){return c.email||'';});
    return S.bizApprovals.filter(function(a){return a.status==='pending'&&myEmails.indexOf(a.submitted_by_email)>=0;});
  }
  return S.bizApprovals.filter(function(a){return a.status==='pending';});
}
async function bizApproveRequest(id,approved,motif){
  var ap=S.bizApprovals.find(function(x){return x.id===id;});if(!ap)return;
  if(approved){var o=ap.data;var ex=S.bizOpps.find(function(x){return x.id===o.id;});
    if(ex){S.bizOpps=S.bizOpps.map(function(x){return x.id===o.id?o:x;});}
    else{S.bizOpps=S.bizOpps.concat([o]);}sbUpsertCrmOpp(o);}
  S.bizApprovals=S.bizApprovals.map(function(x){
    return x.id===id?Object.assign({},x,{status:approved?'approved':'rejected',reviewed_by:S._userEmail,motif_rejet:motif||null}):x;
  });
  if(sb&&SB_CID){await sb.from('crm_approvals').update({status:approved?'approved':'rejected',reviewed_by:S._userEmail||'',motif_rejet:motif||null}).eq('id',id);}
  render();
}
async function sbUpsertAcc(a){if(!sb||!SB_CID)return;return sb.from('crm_accounts').upsert(Object.assign({},a,{company_id:SB_CID}),{onConflict:'id'});}
async function sbUpsertCt(c){if(!sb||!SB_CID)return;return sb.from('crm_contacts').upsert(Object.assign({},c,{company_id:SB_CID}),{onConflict:'id'});}
async function sbUpsertCrmOpp(o){
  if(!sb||!SB_CID)return;
  var payload={
    id:o.id,company_id:SB_CID,
    name:o.name,account_id:o.account_id||null,contact_id:o.contact_id||null,
    status:o.status||'identification',
    btype:o.btype||'at',
    tjm_cible:o.tjm_cible||null,jours_estimes:o.jours_estimes||null,
    deal_amount:o.deal_amount||null,
    date_start:o.date_start||null,date_end:o.date_end||null,
    duree_mois:o.duree_mois||null,probability:o.probability||20,
    date_closing:o.date_closing||null,assigned_to:o.assigned_to||null,
    motif_perte:o.motif_perte||null,
    consultant_ids:o.consultant_ids||[],
    notes:o.notes||null,
    owner_email:o.owner_email||null,owner_name:o.owner_name||null,
    owner_role:o.owner_role||null,owner_dir:o.owner_dir||null,owner_vp:o.owner_vp||null,
    linked_mission_id:o.linked_mission_id||null,
    opp_team:o.opp_team||null,
    req_expertise:o.req_expertise||[],
    location:o.location||null,
    req_seniority:o.req_seniority||null,
    req_min_years:o.req_min_years||null,
    req_sector:o.req_sector||null,
    bu_id:o.bu_id||null
  };
  return sb.from('crm_opportunities').upsert(payload,{onConflict:'id'});
}
async function sbUpsertAct(k){if(!sb||!SB_CID)return;return sb.from('crm_activities').upsert(Object.assign({},k,{company_id:SB_CID}),{onConflict:'id'});}

/* ── Matching Business → Recrutement ──────────────────────────────────
   Suggère les candidats du pipeline recrutement susceptibles de répondre à
   une opportunité. Les 4 critères — expertise, localisation, années
   d'expérience (minimum) et secteur — sont connectés : chaque candidat est
   noté par le NOMBRE de critères (parmi ceux renseignés) qu'il satisfait, puis
   classé du plus complet au moins complet (ceux qui cochent les 3/3 d'abord,
   puis 2/3, puis 1/3…). Prix (TJM revente ≤ cible) et disponibilité restent des
   indicateurs secondaires servant uniquement de départage. */
function oppMatches(reqExp,loc,minYears,sector,tjmCible,dateStart){
  reqExp=reqExp||[];minYears=+minYears||0;sector=sector||'';
  var act={exp:reqExp.length>0,loc:!!loc,yrs:minYears>0,sec:!!sector};
  var nbActive=(act.exp?1:0)+(act.loc?1:0)+(act.yrs?1:0)+(act.sec?1:0);
  var res=(S.cands||[]).map(function(c){
    var cexp=c.expertise||[];
    var overlap=reqExp.filter(function(e){return cexp.indexOf(e)>=0;});
    var expOk=act.exp?(overlap.length>0):null;
    /* Localisation classifiée : cible (priorité) > secondaire > France entière.
       On garde `locations` en repli pour les anciennes fiches. */
    var locKind=null,locOk=null;
    if(act.loc){
      if((c.locTarget||'')===loc)locKind='target';
      else if((c.locSecondary||[]).indexOf(loc)>=0)locKind='secondary';
      else if(c.mobileFrance)locKind='france';
      else if((c.locations||[]).indexOf(loc)>=0)locKind='target';
      locOk=!!locKind;
    }
    var yrsOk=act.yrs?((+c.yearsExp||0)>=minYears):null;
    var secOk=act.sec?((c.sectors||[]).indexOf(sector)>=0):null;
    var matchCount=(expOk===true?1:0)+(locOk===true?1:0)+(yrsOk===true?1:0)+(secOk===true?1:0);
    var tjmC=recTjm(c.reqSalary,c.marginPct);
    var priceOk=(!tjmCible||!tjmC)?null:(tjmC<=tjmCible*1.05);
    var availOk=(!dateStart||!c.availDate)?null:(c.availDate<=dateStart);
    return {c:c,overlap:overlap,expOk:expOk,locOk:locOk,locKind:locKind,yrsOk:yrsOk,secOk:secOk,
      matchCount:matchCount,nbActive:nbActive,tjmC:tjmC,priceOk:priceOk,availOk:availOk};
  }).filter(function(m){return nbActive>0&&m.matchCount>0;});
  function _lr(k){return k==='target'?2:k==='secondary'?1:k==='france'?0:-1;}
  res.sort(function(a,b){
    if(b.matchCount!==a.matchCount)return b.matchCount-a.matchCount;           /* + de critères d'abord */
    if(_lr(b.locKind)!==_lr(a.locKind))return _lr(b.locKind)-_lr(a.locKind);   /* cible > secondaire > France */
    if(b.overlap.length!==a.overlap.length)return b.overlap.length-a.overlap.length; /* + d'expertises en commun */
    var ea=(a.priceOk===true?1:0)+(a.availOk===true?1:0);
    var eb=(b.priceOk===true?1:0)+(b.availOk===true?1:0);
    return eb-ea;                                                              /* départage prix + dispo */
  });
  return res.slice(0,15);
}
async function sbDelBiz(table,id){if(!sb||!SB_CID)return;return sb.from(table).delete().eq('id',id).eq('company_id',SB_CID);}

/* ── Modal opportunité : expertises + candidats suggérés (rafraîchis SANS
   re-render global pour éviter le « clignotement » à chaque saisie) ── */
function _oppExpUniverse(){
  var u={};
  (S.cands||[]).forEach(function(c){(c.expertise||[]).forEach(function(e){if(e)u[e]=1;});});
  ((S._all&&S._all.cons)||S.cons||[]).forEach(function(c){(c.expertise||[]).forEach(function(e){if(e)u[e]=1;});});
  return Object.keys(u).sort();
}
function oppExpChipsHTML(){
  var reqExp=(S.bizModal&&S.bizModal.reqExp)||[];
  var list=_oppExpUniverse();
  if(!list.length)return '<span style="font-size:12px;color:#94a3b8">Renseignez des expertises sur vos candidats/consultants pour activer le matching.</span>';
  return list.map(function(e){var on=reqExp.indexOf(e)>=0;return '<button type="button" data-act="opp-exp-tog" data-id="'+esc(e)+'" style="padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid '+(on?'#0891b2':'#e2e8f0')+';background:'+(on?'#0891b2':'#fff')+';color:'+(on?'#fff':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(e)+'</button>';}).join('');
}
function oppSuggHTML(){
  var m=S.bizModal||{},it=m.item||{};
  var reqExp=m.reqExp||[],loc=m.loc||'',sen=m.seniority||'',sector=m.sector||'';
  var minYears=senMinYears(sen);
  var nbActive=(reqExp.length?1:0)+(loc?1:0)+(sen?1:0)+(sector?1:0);
  var chip=function(lb,tip,ok){return ok==null?'':'<span title="'+tip+'" style="color:'+(ok?'#16a34a':'#cbd5e1')+'">'+lb+'</span>';};
  var locStr=function(c){if(c.mobileFrance)return 'France entière';var t=c.locTarget||'';var n=(c.locSecondary||[]).length;if(t)return t+(n?' +'+n:'');return (c.locations||[]).join(', ')||'—';};
  var card=function(mm){var c=mm.c;
    return '<div data-act="opp-see-cand" data-id="'+c.id+'" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;cursor:pointer;background:#fff">'
      +'<div style="min-width:0"><div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(c.name)+'</div>'
      +'<div style="font-size:11px;color:#64748b">'+esc(locStr(c))+' · '+(c.yearsExp?c.yearsExp+' an'+(c.yearsExp>1?'s':''):'exp ?')+' · '+(mm.tjmC?mm.tjmC.toFixed(0)+' €/j':'TJM ?')+' · dispo '+(c.availDate?fDt(c.availDate):'?')+'</div></div>'
      +'<div style="display:flex;gap:7px;flex-shrink:0;font-size:11px;font-weight:700;align-items:center">'
      +chip('💡'+mm.overlap.length,'Expertises en commun',mm.expOk)
      +(mm.locKind==='france'?chip('🇫🇷','Mobile France entière',true):chip('📍',mm.locKind==='secondary'?'Localisation secondaire (prêt à aller)':'Localisation cible (priorité)',mm.locOk))
      +chip('⏳','Séniorité / années d\'expérience',mm.yrsOk)
      +chip('🏭','Secteur',mm.secOk)
      +'<span title="Prix (TJM revente ≤ cible)" style="color:'+(mm.priceOk===true?'#16a34a':mm.priceOk===false?'#dc2626':'#cbd5e1')+'">💶</span>'
      +'<span title="Disponible avant démarrage" style="color:'+(mm.availOk===true?'#16a34a':mm.availOk===false?'#dc2626':'#cbd5e1')+'">📅</span>'
      +'</div></div>';
  };
  if(!nbActive)return '<div style="font-size:12px;color:#94a3b8;padding:6px 0">Renseignez au moins un critère (expertise, localisation, séniorité ou secteur) pour voir des candidats suggérés.</div>';
  var sugg=oppMatches(reqExp,loc,minYears,sector,+(it.tjm_cible||0),it.date_start||null);
  if(!sugg.length)return '<div style="font-size:12px;color:#94a3b8;padding:6px 0">Aucun candidat ne correspond aux critères pour l\'instant.</div>';
  var grp={};sugg.forEach(function(mm){(grp[mm.matchCount]=grp[mm.matchCount]||[]).push(mm);});
  var ks=Object.keys(grp).map(Number).sort(function(a,b){return b-a;});
  return ks.map(function(k){
    var full=(k===nbActive);
    var head='<div style="font-size:11px;font-weight:800;color:'+(full?'#16a34a':'#64748b')+';margin:10px 0 5px;display:flex;align-items:center;gap:6px">'+(full?'✅':'•')+' '+k+'/'+nbActive+' critère'+(k>1?'s':'')+' <span style="font-weight:600;color:#94a3b8">('+grp[k].length+' candidat'+(grp[k].length>1?'s':'')+')</span></div>';
    return head+grp[k].map(card).join('');
  }).join('');
}
/* Refresh partiel des puces expertises + de la liste des candidats suggérés. */
function bizOppRefresh(){
  var ec=document.getElementById('opp-exp-chips');if(ec)ec.innerHTML=oppExpChipsHTML();
  var sg=document.getElementById('opp-sugg');if(sg)sg.innerHTML=oppSuggHTML();
}

/* ── Actions CRM ── */
function bizSaveAcc(){
  var it=S.bizModal&&S.bizModal.item;
  var a={
    id:it?it.id:uid2(),
    name:gv('biz-acc-name'),
    status:gv('biz-acc-status')||'prospect',
    sector:gv('biz-acc-sector'),
    size:gv('biz-acc-size'),
    website:gv('biz-acc-website'),
    siret:gv('biz-acc-siret'),
    address:gv('biz-acc-address'),
    notes:gv('biz-acc-notes'),
  };
  if(!a.name){alert('Nom requis');return;}
  if(it){S.bizAccounts=S.bizAccounts.map(function(x){return x.id===it.id?a:x;});}
  else{S.bizAccounts=S.bizAccounts.concat([a]);}
  sbUpsertAcc(a);
  S.bizModal=null;render();
}
function bizSaveCt(){
  var it=S.bizModal&&S.bizModal.item;
  var ct={
    id:it?it.id:uid2(),
    account_id:gv('biz-ct-acc'),
    first_name:gv('biz-ct-fn'),
    last_name:gv('biz-ct-ln'),
    email:gv('biz-ct-email'),
    phone:gv('biz-ct-phone'),
    role_type:gv('biz-ct-role')||'decideur',
    position:gv('biz-ct-position'),
    notes:gv('biz-ct-notes'),
    influence:gv('biz-ct-influence')||null,
    relation:gv('biz-ct-relation')||null,
    hierarchy_level:gv('biz-ct-hier')||null,
    last_contact_date:gv('biz-ct-lastcontact')||null,
    a_rencontrer:!!(document.getElementById('biz-ct-arenc')&&document.getElementById('biz-ct-arenc').checked),
  };
  if(!ct.first_name&&!ct.last_name){alert('Nom requis');return;}
  if(it){S.bizContacts=S.bizContacts.map(function(x){return x.id===it.id?ct:x;});}
  else{S.bizContacts=S.bizContacts.concat([ct]);}
  sbUpsertCt(ct);
  S.bizModal=null;render();
}
function bizSaveOpp(){
  var it=S.bizModal&&S.bizModal.item;
  var o={
    id:it?it.id:uid2(),
    name:gv('biz-opp-name'),
    account_id:gv('biz-opp-acc'),
    contact_id:gv('biz-opp-ct')||null,
    status:gv('biz-opp-status')||'identification',
    btype:gv('biz-opp-btype')||'at',
    tjm_cible:+gv('biz-opp-tjm')||0,
    jours_estimes:+gv('biz-opp-jours')||0,
    deal_amount:+gv('biz-opp-deal')||0,
    date_start:gv('biz-opp-start')||null,
    date_end:gv('biz-opp-end')||null,
    probability:+gv('biz-opp-prob')||20,
    date_closing:gv('biz-opp-closing')||null,
    assigned_to:gv('biz-opp-assign'),
    motif_perte:gv('biz-opp-motif')||null,
    consultant_ids:(function(){var bt=S.bizModal&&S.bizModal.btype||'at';if(bt==='forfait'){return (S.bizModal.oppTeam||[]).filter(function(t){return t.cid;}).map(function(t){return t.cid;});}return (S.bizModal&&S.bizModal.consPickerSel)||it.consultant_ids||[];})(),opp_team:(S.bizModal&&S.bizModal.btype==='forfait'?S.bizModal.oppTeam||[]:null),
    notes:gv('biz-opp-notes'),
    req_expertise:(S.bizModal&&S.bizModal.reqExp)||(it&&it.req_expertise)||[],
    location:gv('biz-opp-loc')||null,
    req_seniority:(S.bizModal&&S.bizModal.seniority)||gv('biz-opp-sen')||null,
    /* Années min. dérivées de la séniorité (source de vérité = séniorité) — conservées
       pour le matching et la compatibilité. */
    req_min_years:(senMinYears((S.bizModal&&S.bizModal.seniority)||gv('biz-opp-sen'))||null),
    req_sector:gv('biz-opp-sector')||null,
    owner_email:it?(it.owner_email||S._userEmail||''):S._userEmail||'',
    owner_name:it?(it.owner_name||S.profileFirstName||''):S.profileFirstName||'',
    owner_role:it?(it.owner_role||S.role):S.role,
    owner_dir:it?(it.owner_dir||S.dirName||''):S.dirName||'', /* Gestionnaire du créateur */
    owner_vp:it?(it.owner_vp||S.vpName||''):S.vpName||'',   /* Admin du créateur */
    /* Unité : BU (niveau le plus fin) du créateur. Conservée telle quelle en édition. */
    bu_id:it?(it.bu_id||myBuId()):myBuId(),
    /* Délivrée par mes consultants ? true → compte en DR (=ER) ; false → ER seul. */
    delivery_own:(document.getElementById('biz-opp-own')?!!document.getElementById('biz-opp-own').checked:(it?it.delivery_own!==false:true)),
  };
  if(!o.name){alert('Nom requis');return;}
  if(S.role==='utilisateur'){
    var ap={id:uid2(),action:it?'update':'create',entity_id:o.id,data:o,status:'pending',submitted_by_email:S._userEmail||'',submitted_by_name:S.profileFirstName||''};
    S.bizApprovals=S.bizApprovals.concat([ap]);
    if(sb&&SB_CID)sb.from('crm_approvals').insert(Object.assign({},ap,{company_id:SB_CID})).then(function(){});
    S.bizModal=null;alert('Demande soumise pour approbation a votre gestionnaire.');render();return;
  }
  if(it){S.bizOpps=S.bizOpps.map(function(x){return x.id===it.id?o:x;});}
  else{S.bizOpps=S.bizOpps.concat([o]);}
  sbUpsertCrmOpp(o);S.bizModal=null;render();
}
function bizSaveAct(){
  var it=S.bizModal&&S.bizModal.item;
  var k={
    id:it?it.id:uid2(),
    type:gv('biz-act-type')||'appel',
    title:gv('biz-act-title'),
    account_id:gv('biz-act-acc')||null,
    opportunity_id:gv('biz-act-opp')||null,
    biz_target:+gv('biz-act-biztarget')||null,
    contact_id:gv('biz-act-ct')||null,
    date_realised:gv('biz-act-date')||new Date().toISOString().slice(0,10),
    status:gv('biz-act-status')||'realise',
    next_action:gv('biz-act-next'),
    next_action_date:gv('biz-act-next-date')||null,
    assigned_to:gv('biz-act-assign'),
    notes:gv('biz-act-notes'),
    reported_count:it?(+it.reported_count||0):0,
    committed_at:(it&&it.committed_at)||new Date().toISOString().slice(0,10),
    abandoned:it?!!it.abandoned:false,
  };
  if(!k.title){alert('Titre requis');return;}
  if(it){S.bizActivities=S.bizActivities.map(function(x){return x.id===it.id?k:x;});}
  else{S.bizActivities=S.bizActivities.concat([k]);}
  sbUpsertAct(k);
  S.bizModal=null;render();
}
function bizDelItem(table,id,arr){
  if(!confirm('Supprimer cet élément ?'))return;
  if(table==='crm_accounts')S.bizAccounts=S.bizAccounts.filter(function(x){return x.id!==id;});
  if(table==='crm_contacts')S.bizContacts=S.bizContacts.filter(function(x){return x.id!==id;});
  if(table==='crm_opportunities')S.bizOpps=S.bizOpps.filter(function(x){return x.id!==id;});
  if(table==='crm_activities')S.bizActivities=S.bizActivities.filter(function(x){return x.id!==id;});
  sbDelBiz(table,id);render();
}
/* Ouvre le modal d'édition d'une opportunité CRM par son id (navigation depuis
   ailleurs, ex. une fiche de poste). Reproduit le handler data-act 'biz-edit-opp'. */
function openOppById(oppId){
  var o=(S.bizOpps||[]).find(function(x){return x.id===oppId;});
  if(!o){alert('Opportunité introuvable (elle a peut-être été supprimée).');return;}
  S.tab='business';S.jobSel=null;S.recSel=null;
  S.bizModal={type:'opp',item:o,btype:(o.btype)||'at',consPickerSel:(o.consultant_ids)||[],
    oppTeam:(o.opp_team&&o.opp_team.length?o.opp_team:(o.consultant_ids||[]).map(function(cid){return {cid:cid,taux:Math.round(100/Math.max((o.consultant_ids||[]).length,1)),wdays:[1,2],tmar:25};}))||[{cid:'',taux:100,wdays:[1,2],tmar:25}]};
  render();
}
/* Opportunité gagnée → créer mission */
function bizOppToMission(oppId){
  var o=S.bizOpps.find(function(x){return x.id===oppId;});
  if(!o){alert('Opportunité non trouvée.');return;}
  var acc=S.bizAccounts.find(function(x){return x.id===o.account_id;})||{};
  var isFor=o.btype==='forfait';
  var missions=[];
  var mName=o.name+(acc.name?'\u00a0\u2014 '+acc.name:'');
  var sd=o.date_start||new Date().toISOString().slice(0,10);

  if(isFor){
    /* Forfait : utiliser opp_team si disponible */
    var team=o.opp_team&&o.opp_team.length?o.opp_team
      :(o.consultant_ids||[]).map(function(cid){
        return {cid:cid,taux:Math.round(100/Math.max((o.consultant_ids||[]).length,1)),wdays:[1,2],tmar:25};
      });
    var allConsForCalc=S.cons.concat([]); /* ref locale pour calculs */
    team.filter(function(t){return t.cid;}).forEach(function(tm){
      var cons=S.cons.find(function(x){return x.id===tm.cid;})||{scr:0,name:'?'};
      /* Calcul automatique : poids = SCR × jours_staffing */
      var cons_for_weight=allConsForCalc.find(function(x){return x.id===tm.cid;})||{scr:1};
      var sdays=(tm.wdays&&tm.wdays.length?tm.wdays:[1,2]).length;
      var tmWeight=(cons_for_weight.scr||1)*sdays;
      var totalWeight=team.filter(function(t){return t.cid;}).reduce(function(s,t){
        var tc=allConsForCalc.find(function(x){return x.id===t.cid;})||{scr:1};
        return s+(tc.scr||1)*((t.wdays&&t.wdays.length?t.wdays:[1,2]).length);
      },0)||1;
      var dealPortion=(o.deal_amount||0)*tmWeight/totalWeight;
      var tmar=tm.tmar!=null?tm.tmar:25;
      var wdays=tm.wdays&&tm.wdays.length?tm.wdays:[1,2];
      /* TJM = SCR × 113.35 × 1.25 / (1 - marge) */
      var tjm=cons.scr>0?Math.round(cons.scr*113.35*1.25/(1-Math.min(tmar,99)/100)):0;
      var days=tjm>0?Math.round(dealPortion/tjm):0;
      missions.push({
        id:uid2(),name:mName,btype:'forfait',cid:tm.cid,cli:acc.name||'',
        tjm:tjm,deal:dealPortion,tmar:tmar,wdays:wdays,days:days,
        sd:sd,ed:null,notes:o.notes||''
      });
    });
  }else{
    /* AT */
    var cid1=(o.consultant_ids||[])[0]||null;
    missions.push({
      id:uid2(),name:mName,btype:'at',cid:cid1,cli:acc.name||'',
      tjm:o.tjm_cible||0,days:o.jours_estimes||0,deal:0,
      sd:sd,ed:o.date_end||null,notes:o.notes||''
    });
  }

  if(!missions.length){alert('Aucun consultant associé à cette opportunité. Ajoutez au moins un consultant avant de créer la mission.');return;}
  S.miss=S.miss.concat(missions);
  var firstId=missions[0].id;
  S.bizOpps=S.bizOpps.map(function(x){return x.id===oppId?Object.assign({},x,{linked_mission_id:firstId,status:'gagne'}):x;});
  sbUpsertCrmOpp(S.bizOpps.find(function(x){return x.id===oppId;}));
  if(sb&&SB_CID){
    missions.forEach(function(m){
      sb.from('missions').insert({
        id:m.id,company_id:SB_CID,consultant_id:m.cid,
        name:m.name,client_name:m.cli,
        tjm:m.tjm||0,start_date:m.sd,end_date:m.ed||null,
        billing_type:m.btype||'at',deal_amount:m.deal||null,
        target_margin:m.tmar!=null?m.tmar:null,
        work_days:m.wdays||[1,2,3,4,5]
      }).then(function(r){if(r&&r.error)console.warn('Mission insert error:',r.error.message);});
    });
  }
  S.bizModal=null;S.tab='missions';
  alert(missions.length+' mission'+(missions.length>1?'s':'')+' créée'+(missions.length>1?'s':'')+' dans l\'onglet Missions.');
  render();
}

/* ═══════════════════════════════════════════════════════════
   TEMPLATE PRINCIPAL — tBusiness()
═══════════════════════════════════════════════════════════ */
function tBizApprovals(){
  if(S.role==='utilisateur'){
    var myApps=S.bizApprovals.filter(function(a){return a.submitted_by_email===S._userEmail;});
    if(!myApps.length)return '<div class="emp">Aucune demande en cours.</div>';
    return '<div class="ov"><table><thead><tr><th>Opportunit\u00e9</th><th>Action</th><th>Statut</th><th>Motif rejet</th></tr></thead><tbody>'
      +myApps.map(function(a){
        var st=a.status==='pending'?'En attente':a.status==='approved'?'Approuv\u00e9':'Refus\u00e9';
        var bg=a.status==='pending'?'#fef3c7':a.status==='approved'?'#d1fae5':'#fee2e2';
        var fg=a.status==='pending'?'#92400e':a.status==='approved'?'#065f46':'#b91c1c';
        return '<tr><td style="font-weight:600">'+(a.data&&a.data.name?esc(a.data.name):'?')+'</td>'
          +'<td style="font-size:12px">'+(a.action==='create'?'Cr\u00e9ation':'Modification')+'</td>'
          +'<td><span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:'+bg+';color:'+fg+'">'+st+'</span></td>'
          +'<td style="font-size:12px;color:#dc2626">'+esc(a.motif_rejet||'')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
  var pending=pendingBizApprovals();
  var done=S.bizApprovals.filter(function(a){return a.status!=='pending';}).slice(0,20);
  var pHtml=pending.length?'<div class="card" style="padding:20px;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:12px">\uD83D\uDD14 En attente ('+pending.length+')</div>'
    +pending.map(function(a){
      var ca=(a.data&&a.data.tjm_cible&&a.data.jours_estimes)?a.data.tjm_cible*a.data.jours_estimes:0;
      return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:12px">'
        +'<div style="flex:1">'
        +'<div style="font-weight:700;color:#0f172a">'+esc(a.data&&a.data.name?a.data.name:'Opportunit\u00e9')+'</div>'
        +'<div style="font-size:12px;color:#64748b;margin-top:2px">Par '+esc(a.submitted_by_name||a.submitted_by_email||'?')
          +' \u00b7 '+(a.action==='create'?'Nouvelle opportunit\u00e9':'Modification')+'</div>'
        +(ca>0?'<div style="font-size:12px;font-weight:700;color:#1B2B3A;margin-top:4px">CA potentiel : '+fEur(ca)+'</div>':'')
        +'</div>'
        +'<div style="display:flex;gap:8px;flex-shrink:0">'
        +'<button class="bp" style="background:#16a34a;font-size:12px;padding:7px 14px" onclick="bizApproveRequest(\''+a.id+'\',true,null)">\u2713 Approuver</button>'
        +'<button class="bp" style="background:#dc2626;font-size:12px;padding:7px 14px" onclick="var m=prompt(\'Motif de refus :\');bizApproveRequest(\''+a.id+'\',false,m)">\u2717 Refuser</button>'
        +'</div></div>';
    }).join('')+'</div>':'<div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:#15803d">\u2713 Aucune demande en attente.</div>';
  var dHtml=done.length?'<div class="card" style="padding:20px"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:12px">Historique</div>'
    +'<div class="ov"><table><thead><tr><th>Opportunit\u00e9</th><th>Demand\u00e9 par</th><th>Statut</th><th>Trait\u00e9 par</th></tr></thead><tbody>'
    +done.map(function(a){
      var st=a.status==='approved'?'Approuv\u00e9':'Refus\u00e9';var bg=a.status==='approved'?'#d1fae5':'#fee2e2';var fg=a.status==='approved'?'#065f46':'#b91c1c';
      return '<tr><td style="font-weight:600">'+(a.data&&a.data.name?esc(a.data.name):'?')+'</td>'
        +'<td style="font-size:12px">'+esc(a.submitted_by_name||'')+'</td>'
        +'<td><span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:'+bg+';color:'+fg+'">'+st+'</span></td>'
        +'<td style="font-size:12px;color:#64748b">'+esc(a.reviewed_by||'')+'</td></tr>';
    }).join('')+'</tbody></table></div></div>':'';
  return pHtml+dHtml;
}

function tBusinessPaywall(){
  return '<div class="vw"><div style="max-width:560px;margin:60px auto;text-align:center">'
    +'<div style="font-size:48px;margin-bottom:16px">💼</div>'
    +'<div style="font-size:26px;font-weight:900;color:#1B2B3A;margin-bottom:10px">Business Développement</div>'
    +'<div style="font-size:15px;color:#64748b;margin-bottom:28px;line-height:1.6">Gérez vos comptes clients, votre pipeline et vos activités commerciales dans Konsilys.</div>'
    +'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:24px;text-align:left">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:12px">Ce module inclut :</div>'
    +['CRM Comptes & Contacts','Pipeline opportunités avec probabilités','Suivi activités commerciales','KPIs Business & entonnoir de vente','Workflow d’approbation','Mission créée auto à la signature'].map(function(f){return '<div style="display:flex;gap:8px;margin-bottom:6px"><span style="color:#84CC16;font-weight:800">✓</span><span style="font-size:13px;color:#374151">'+f+'</span></div>';}).join('')
    +'</div>'
    +'<a href="mailto:contact@konsilys.fr?subject=Activation module Business Développement" style="display:inline-block;background:#1B2B3A;color:#fff;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none">Contacter pour activer →</a>'
    +'<div style="font-size:12px;color:#94a3b8;margin-top:12px">contact@konsilys.fr · Activation sous 24h</div>'
    +'</div></div>';
}
function tBusiness(){
  /* Business Manager a toujours accès au Business ; les autres ont besoin du module */
  /* Business Manager a toujours accès ; TOUS les autres (y compris Super Admin) ont besoin du module */
  if(S.role!=='sales'&&!(S.settings&&S.settings.hasBusinessModule))return tBusinessPaywall();
  var subTabs=[
    {id:'pipeline',  lb:'📋 Pipeline',    n:S.bizOpps.filter(function(o){return o.status!=='gagne'&&o.status!=='perdu';}).length},
    {id:'plans',     lb:'📁 Plans de compte', n:S.bizAccounts.length},
    {id:'comptes',   lb:'🏢 Comptes',     n:S.bizAccounts.length},
    {id:'contacts',  lb:'👤 Contacts',    n:S.bizContacts.length},
    {id:'activites', lb:'📅 Activités',   n:S.bizActivities.length},
    {id:'kpis_biz',  lb:'📊 KPIs',        n:null},
  ];
  var subNav='<div style="display:flex;gap:4px;margin-bottom:20px;background:#f1f5f9;padding:4px;border-radius:10px;flex-wrap:wrap">'
    +subTabs.map(function(t){
      var act=S.bizTab===t.id;
      return '<button data-act="biz-tab" data-biz-tab="'+t.id+'" style="flex:1;min-width:80px;padding:8px 14px;border:none;border-radius:7px;font-family:Nunito,sans-serif;font-size:13px;font-weight:700;cursor:pointer;background:'+(act?'#fff':'transparent')+';color:'+(act?'#1B2B3A':'#64748b')+';box-shadow:'+(act?'0 1px 4px rgba(0,0,0,.1)':'')+'">'
        +t.lb+(t.n!=null?' <span style="background:'+(act?'#84CC16':'#cbd5e1')+';color:'+(act?'#1B2B3A':'#475569')+';border-radius:99px;padding:1px 7px;font-size:11px">'+t.n+'</span>':'')+'</button>';
    }).join('')+'</div>';

  var content='';
  switch(S.bizTab){
    case 'plans':     content=(S.comiteQueue?tComite():(S.planView?tPlanDetail(S.planView):tBizPlans()));break;
    case 'comptes':   content=tBizComptes();break;
    case 'contacts':  content=tBizContacts();break;
    case 'activites': content=tBizActivites();break;
    case 'kpis_biz':    content=tBizKpis();break;
    case 'approvals':   content=tBizApprovals();break;
    default:            content=tBizPipeline();
  }

  var modal='';

  return '<div class="vw">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
    +'<div><div class="pt">Opportunités</div><div class="ps">CRM — Comptes · Contacts · Pipeline · Activités</div></div>'
    +addBtn()+'</div>'
    +subNav+content+'</div>';

  function addBtn(){
    var labels={pipeline:'+ Opportunité',comptes:'+ Compte',contacts:'+ Contact',activites:'+ Activité',kpis_biz:''};
    var tab=S.bizTab||'pipeline';
    var lb=labels[tab]||'';
    /* Import d'opportunités disponible sur le Pipeline (hors rôle utilisateur, qui passe par approbation). */
    var imp=(tab==='pipeline'&&S.role!=='utilisateur')?'<button class="bg" data-act="import2-open" data-id="opportunity" style="white-space:nowrap" title="Importer des opportunités depuis un fichier Excel ou CSV">📥 Importer</button>':'';
    if(!lb&&!imp)return '';
    return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+imp+(lb?'<button class="bp" data-act="biz-new" style="white-space:nowrap">'+lb+'</button>':'')+'</div>';
  }
}

/* ── Pipeline (liste) ── */
function tBizPipeline(){
  var fst=S.bizFilter.status||'all';
  var facc=S.bizFilter.account||'';
  var fexp=S.bizFilter.exp||'';
  var opps=visibleOpps().filter(function(o){
    if(fst!=='all'&&o.status!==fst)return false;
    if(facc&&o.account_id!==facc)return false;
    if(fexp&&(o.req_expertise||[]).indexOf(fexp)<0)return false;
    return true;
  });
  /* KPI mini-bar */
  var active=visibleOpps().filter(function(o){return o.status!=='gagne'&&o.status!=='perdu';});
  var pipeline_val=active.reduce(function(s,o){return s+caPot(o)*(o.probability||0)/100;},0);
  var total_pot=active.reduce(function(s,o){return s+caPot(o);},0);
  var won=visibleOpps().filter(function(o){return o.status==='gagne';});
  var ca_won=won.reduce(function(s,o){return s+caPot(o);},0);

  var kbar='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">'
    +kbCard('Pipeline pondéré',fEur(pipeline_val),'Probabilité × CA potentiel','#1B2B3A')
    +kbCard('CA potentiel total',fEur(total_pot),active.length+' opportunités actives','#243447')
    +kbCard('CA gagné',fEur(ca_won),won.length+' opportunités gagnées','#065f46')
    +kbCard('Taux de conv.',visibleOpps().length?Math.round(won.length/visibleOpps().length*100)+'%':'—','Total opportunités','#5b21b6')
    +'</div>';

  /* Filtres */
  var accOpts='<option value="">Tous les comptes</option>'+S.bizAccounts.map(function(a){return '<option value="'+a.id+'"'+(facc===a.id?' selected':'')+'>'+esc(a.name)+'</option>';}).join('');
  var stOpts='<option value="all">Tous statuts</option>'+OPP_STATUS.map(function(s){return '<option value="'+s.id+'"'+(fst===s.id?' selected':'')+'>'+s.lb+'</option>';}).join('');
  /* Filtre expertise : dérivé des expertises portées par les opportunités visibles */
  var expSet={};visibleOpps().forEach(function(o){(o.req_expertise||[]).forEach(function(e){if(e)expSet[e]=1;});});
  var expList=Object.keys(expSet).sort();
  var expOpts='<option value="">Toutes expertises</option>'+expList.map(function(e){return '<option value="'+esc(e)+'"'+(fexp===e?' selected':'')+'>'+esc(e)+'</option>';}).join('');
  var filters='<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">'
    +'<select class="ic" id="biz-fst" style="min-width:160px;font-size:13px">'+stOpts+'</select>'
    +'<select class="ic" id="biz-facc" style="min-width:180px;font-size:13px">'+accOpts+'</select>'
    +(expList.length?'<select class="ic" id="biz-fexp" style="min-width:180px;font-size:13px">'+expOpts+'</select>':'')
    +'</div>';

  if(!opps.length)return kbar+filters+((fst!=='all'||facc||fexp)?'<div class="emp">Aucune opportunité avec ces filtres</div>':tEmpty('💼','Aucune opportunité','Créez votre première opportunité pour alimenter le pipeline commercial et le prévisionnel.','<button class="bp" data-act="biz-new">+ Nouvelle opportunité</button>'));

  var thead='<thead><tr>'
    +'<th>Opportunité</th><th>Compte</th><th>Contact</th>'
    +'<th class="tc">TJM</th><th class="tc">Jours</th><th class="tc">CA pot.</th>'
    +'<th class="tc">Proba</th><th>Statut</th><th>Closing</th><th>Assigné</th>'
    +'<th class="tr">Actions</th></tr></thead>';
  var tbody=opps.map(function(o){
    var won=o.status==='gagne',lost=o.status==='perdu';
    var ca=caPot(o);
    return '<tr style="opacity:'+(lost?0.6:1)+'">'
      +'<td><div style="font-weight:700;color:#0f172a">'+esc(o.name)+'</div>'+(o.notes?'<div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">'+esc(o.notes.slice(0,50))+'</div>':'')+'</td>'
      +'<td><span style="font-size:12px;background:#f1f5f9;padding:2px 8px;border-radius:99px">'+esc(accName(o.account_id))+'</span></td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(ctName(o.contact_id))+'</td>'
      +'<td class="tc" style="font-size:13px;font-weight:700">'+(o.tjm_cible?fEur(o.tjm_cible):'—')+'</td>'
      +'<td class="tc" style="font-size:13px">'+(o.jours_estimes||'—')+'</td>'
      +'<td class="tc" style="font-size:13px;font-weight:800;color:#1B2B3A">'+(ca>0?fEur(ca):'—')+'</td>'
      +'<td class="tc"><div style="display:flex;align-items:center;gap:4px;justify-content:center">'
        +'<div style="height:4px;width:40px;background:#e2e8f0;border-radius:2px"><div style="height:100%;width:'+(o.probability||0)+'%;background:'+(o.probability>=70?'#16a34a':o.probability>=40?'#d97706':'#dc2626')+';border-radius:2px"></div></div>'
        +'<span style="font-size:11px;font-weight:700">'+(o.probability||0)+'%</span></div></td>'
      +'<td><span style="padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;'+oppStStyle(o.status)+'">'+oppStLb(o.status)+'</span></td>'
      +'<td style="font-size:12px;color:#64748b">'+(o.date_closing?o.date_closing.slice(0,10):'—')+'</td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(o.assigned_to||'')+'</td>'
      +'<td class="tr" style="white-space:nowrap">'
      +(won&&!o.linked_mission_id?'<button class="lr" style="background:#d1fae5;color:#065f46;border-color:#bbf7d0;margin-right:4px" data-act="biz-opp-mission" data-id="'+o.id+'">→ Mission</button>':'')
      +'<button class="lr" data-act="biz-edit-opp" data-id="'+o.id+'" style="margin-right:4px">✏️</button>'
      +'<button class="lr" data-act="biz-del" data-table="crm_opportunities" data-id="'+o.id+'">✕</button>'
      +'</td></tr>';
  }).join('');

  return kbar+filters+'<div class="ov"><table>'+thead+'<tbody>'+tbody+'</tbody></table></div>';
}

function kbCard(l,v,s,bg){
  return '<div style="background:'+bg+';border-radius:12px;padding:14px 16px">'
    +'<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+l+'</div>'
    +'<div style="font-size:20px;font-weight:900;color:#fff">'+v+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px">'+s+'</div>'
    +'</div>';
}

/* ── Comptes ── */
function tBizComptes(){
  if(!S.bizAccounts.length)return '<div class="emp">Aucun compte. Cliquez "+ Compte" pour commencer.</div>';
  var thead='<thead><tr><th>Compte</th><th>Statut</th><th>Secteur</th><th>Taille</th><th class="tc">Opportunités</th><th class="tc">CA potentiel</th><th class="tr">Actions</th></tr></thead>';
  var tbody=S.bizAccounts.map(function(a){
    var opps=S.bizOpps.filter(function(o){return o.account_id===a.id;});
    var ca=opps.reduce(function(s,o){return s+caPot(o);},0);
    var st=ACCOUNT_STATUS.find(function(x){return x.id===a.status;})||{lb:a.status||'Prospect'};
    var stbg=a.status==='client_actif'?'#d1fae5':a.status==='client_inactif'?'#f1f5f9':'#fef3c7';
    var stfg=a.status==='client_actif'?'#065f46':a.status==='client_inactif'?'#475569':'#92400e';
    return '<tr>'
      +'<td><div style="font-weight:700;color:#0f172a">'+esc(a.name)+'</div>'+(a.website?'<div style="font-size:10px;color:#94a3b8">'+esc(a.website)+'</div>':'')+'</td>'
      +'<td><span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:'+stbg+';color:'+stfg+'">'+st.lb+'</span></td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(a.sector||'—')+'</td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(a.size||'—')+'</td>'
      +'<td class="tc" style="font-size:13px;font-weight:700">'+opps.length+'</td>'
      +'<td class="tc" style="font-size:13px;font-weight:700">'+(ca>0?fEur(ca):'—')+'</td>'
      +'<td class="tr"><button class="lr" data-act="biz-edit-acc" data-id="'+a.id+'" style="margin-right:4px">✏️</button>'
      +'<button class="lr" data-act="biz-del" data-table="crm_accounts" data-id="'+a.id+'">✕</button></td></tr>';
  }).join('');
  return '<div class="ov"><table>'+thead+'<tbody>'+tbody+'</tbody></table></div>';
}

/* ── Contacts ── */
function tBizContacts(){
  if(!S.bizContacts.length)return '<div class="emp">Aucun contact. Cliquez "+ Contact" pour commencer.</div>';
  var thead='<thead><tr><th>Nom</th><th>Rôle</th><th>Poste</th><th>Compte</th><th>Email</th><th>Téléphone</th><th class="tr">Actions</th></tr></thead>';
  var tbody=S.bizContacts.map(function(ct){
    var rl=CONTACT_ROLES.find(function(x){return x.id===ct.role_type;})||{lb:ct.role_type||''};
    var rlbg=ct.role_type==='decideur'?'#eff6ff':ct.role_type==='prescripteur'?'#fef3c7':'#f0fdf4';
    var rlfg=ct.role_type==='decideur'?'#1e40af':ct.role_type==='prescripteur'?'#92400e':'#15803d';
    return '<tr>'
      +'<td><div style="font-weight:700;color:#0f172a">'+esc((ct.first_name||'')+' '+(ct.last_name||''))+'</div></td>'
      +'<td><span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:'+rlbg+';color:'+rlfg+'">'+rl.lb+'</span></td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(ct.position||'—')+'</td>'
      +'<td style="font-size:12px">'+esc(accName(ct.account_id))+'</td>'
      +'<td style="font-size:12px"><a href="mailto:'+esc(ct.email||'')+'" style="color:#1B2B3A">'+esc(ct.email||'—')+'</a></td>'
      +'<td style="font-size:12px">'+esc(ct.phone||'—')+'</td>'
      +'<td class="tr"><button class="lr" data-act="biz-edit-ct" data-id="'+ct.id+'" style="margin-right:4px">✏️</button>'
      +'<button class="lr" data-act="biz-del" data-table="crm_contacts" data-id="'+ct.id+'">✕</button></td></tr>';
  }).join('');
  return '<div class="ov"><table>'+thead+'<tbody>'+tbody+'</tbody></table></div>';
}

/* ── Activités ── */
function tBizActivites(){
  if(!S.bizActivities.length)return '<div class="emp">Aucune activité. Cliquez "+ Activité" pour commencer.</div>';
  var thead='<thead><tr><th>Date</th><th>Type</th><th>Titre</th><th>Compte</th><th>Contact</th><th>Opportunité</th><th>Statut</th><th>Prochaine action</th><th class="tr">Actions</th></tr></thead>';
  var tbody=S.bizActivities.map(function(k){
    var tp=ACT_TYPES.find(function(x){return x.id===k.type;})||{lb:k.type||''};
    var oppName='';if(k.opportunity_id){var o=S.bizOpps.find(function(x){return x.id===k.opportunity_id;});oppName=o?o.name:'';}
    return '<tr>'
      +'<td style="font-size:12px;white-space:nowrap">'+esc(k.date_realised||'')+'</td>'
      +'<td><span style="font-size:11px;font-weight:700;background:#f1f5f9;padding:2px 8px;border-radius:99px">'+tp.lb+'</span></td>'
      +'<td style="font-weight:600;color:#0f172a">'+esc(k.title||'')+'</td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(accName(k.account_id))+'</td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(ctName(k.contact_id))+'</td>'
      +'<td style="font-size:12px;color:#64748b">'+esc(oppName)+'</td>'
      +'<td><span style="font-size:11px;font-weight:700;background:'+(k.status==='realise'?'#d1fae5':'#fef3c7')+';color:'+(k.status==='realise'?'#065f46':'#92400e')+';padding:2px 8px;border-radius:99px">'+(k.status==='realise'?'Réalisé':'Planifié')+'</span></td>'
      +'<td style="font-size:11px;color:#64748b">'+(k.next_action?esc(k.next_action)+(k.next_action_date?' ('+k.next_action_date.slice(0,10)+')':''):'—')+'</td>'
      +'<td class="tr"><button class="lr" data-act="biz-edit-act" data-id="'+k.id+'" style="margin-right:4px">✏️</button>'
      +'<button class="lr" data-act="biz-del" data-table="crm_activities" data-id="'+k.id+'">✕</button></td></tr>';
  }).join('');
  return '<div class="ov"><table>'+thead+'<tbody>'+tbody+'</tbody></table></div>';
}

/* ── KPIs Business ── */
function tBizKpis(){
  var vo=visibleOpps(); /* périmètre limité au rôle courant */
  var byStatus={};OPP_STATUS.forEach(function(s){byStatus[s.id]={count:0,ca:0};});
  vo.forEach(function(o){if(byStatus[o.status]){byStatus[o.status].count++;byStatus[o.status].ca+=caPot(o);}});
  var total=vo.length;
  var pipeline=vo.filter(function(o){return o.status!=='gagne'&&o.status!=='perdu';});
  var won=vo.filter(function(o){return o.status==='gagne';});
  var pipeline_pond=pipeline.reduce(function(s,o){return s+caPot(o)*(o.probability||0)/100;},0);

  var funnelHtml='<div class="card" style="padding:24px;margin-bottom:16px"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:16px">Entonnoir de conversion</div>'
    +OPP_STATUS.map(function(s){
      var d=byStatus[s.id]||{count:0,ca:0};
      var pct=total>0?d.count/total*100:0;
      return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">'
        +'<span style="font-weight:700">'+s.lb+'</span>'
        +'<span style="color:#64748b">'+d.count+' opp. · '+(d.ca>0?fEur(d.ca):'—')+'</span></div>'
        +'<div style="height:10px;background:#f1f5f9;border-radius:5px">'
        +'<div style="height:100%;width:'+pct.toFixed(0)+'%;background:'+s.fg+';border-radius:5px"></div></div>';
    }).join('')
    +'</div>';

  /* Top comptes par CA potentiel */
  var accCA={};vo.forEach(function(o){accCA[o.account_id]=(accCA[o.account_id]||0)+caPot(o);});
  var topAcc=Object.keys(accCA).sort(function(a,b){return accCA[b]-accCA[a];}).slice(0,5);
  var topHtml=topAcc.length?'<div class="card" style="padding:24px"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:14px">Top 5 comptes — CA potentiel</div>'
    +topAcc.map(function(aid,i){
      var name=accName(aid)||'Inconnu';
      return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
        +'<span style="font-size:11px;font-weight:700;color:#94a3b8;width:18px">#'+(i+1)+'</span>'
        +'<span style="flex:1;font-weight:600;color:#0f172a">'+esc(name)+'</span>'
        +'<span style="font-size:13px;font-weight:800;color:#1B2B3A">'+fEur(accCA[aid])+'</span></div>';
    }).join('')+'</div>':'';

  /* ── Performance par commercial ──────────────────────────────────────
     Chaque opportunité porte son créateur (owner_email/owner_name/owner_role).
     Une opportunité gagnée = une mission générée (bizOppToMission). On agrège
     donc, par personne : affaires gagnées (missions), CA gagné, pipeline
     pondéré et win rate. Le périmètre suit déjà le rôle via visibleOpps(). */
  var byOwner={};
  vo.forEach(function(o){
    var key=(o.owner_email||o.owner_name||'—').toLowerCase();
    if(!byOwner[key])byOwner[key]={name:o.owner_name||o.owner_email||'Non attribué',role:o.owner_role||'',total:0,won:0,caWon:0,pipe:0,miss:0};
    var b=byOwner[key];
    b.total++;
    if(o.status==='gagne'){b.won++;b.caWon+=caPot(o);if(o.linked_mission_id)b.miss++;}
    else if(o.status!=='perdu'){b.pipe+=caPot(o)*(o.probability||0)/100;}
  });
  var owners=Object.keys(byOwner).map(function(k){return byOwner[k];})
    .sort(function(a,b){return b.caWon-a.caWon||b.won-a.won||b.total-a.total;});
  var maxCaOwn=owners.reduce(function(m,o){return Math.max(m,o.caWon);},0)||1;
  var totMiss=owners.reduce(function(s,o){return s+o.won;},0);
  var totCaWon=owners.reduce(function(s,o){return s+o.caWon;},0);
  var ownerHtml=owners.length?'<div class="card" style="padding:24px;margin-top:16px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
      +'<div style="font-size:13px;font-weight:800;color:#0f172a">Performance par commercial</div>'
      +'<div style="font-size:12px;color:#64748b">'+totMiss+' mission'+(totMiss>1?'s':'')+' générée'+(totMiss>1?'s':'')+' · '+fEur(totCaWon)+' de CA gagné</div>'
    +'</div>'
    +'<div style="font-size:12px;color:#64748b;margin-bottom:16px">Affaires gagnées (chaque opportunité gagnée génère une mission) et chiffre d\'affaires, par créateur d\'opportunité.</div>'
    +'<div class="ov"><table><thead><tr><th>Commercial</th>'
      +'<th class="tc">Missions gagnées</th><th class="tc">CA gagné</th>'
      +'<th class="tc">Pipeline pondéré</th><th class="tc">Opp. total</th><th class="tc">Win rate</th></tr></thead><tbody>'
    +owners.map(function(o){
      var wr=o.total?Math.round(o.won/o.total*100):0;
      var caPctBar=Math.round(o.caWon/maxCaOwn*100);
      return '<tr>'
        +'<td><div style="font-weight:700;color:#0f172a">'+esc(o.name)+'</div>'+(o.role?'<div style="font-size:10px;color:#94a3b8">'+esc(rLabel(o.role))+'</div>':'')+'</td>'
        +'<td class="tc"><span style="font-weight:800;color:#065f46">'+o.won+'</span></td>'
        +'<td class="tc"><div style="font-weight:800;color:#1B2B3A">'+(o.caWon>0?fEur(o.caWon):'—')+'</div>'
          +(o.caWon>0?'<div style="height:4px;width:90px;margin:3px 0 0 auto;background:#e2e8f0;border-radius:2px"><div style="height:100%;width:'+caPctBar+'%;background:#84CC16;border-radius:2px"></div></div>':'')+'</td>'
        +'<td class="tc" style="font-size:13px;color:#64748b">'+(o.pipe>0?fEur(o.pipe):'—')+'</td>'
        +'<td class="tc" style="font-size:13px">'+o.total+'</td>'
        +'<td class="tc" style="font-size:13px;font-weight:700;color:'+(wr>=50?'#16a34a':wr>=25?'#d97706':'#64748b')+'">'+wr+'%</td>'
        +'</tr>';
    }).join('')+'</tbody></table></div></div>':'';

  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
    +'<div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
    +kbCard('Pipeline pondéré',fEur(pipeline_pond),'∑ CA × probabilité','#1B2B3A')
    +kbCard('Win Rate',total?Math.round(won.length/total*100)+'%':'—','Opportunités gagnées','#065f46')
    +kbCard('Durée moy. pipeline',pipeline.length?Math.round(pipeline.reduce(function(s,o){return s+(o.duree_mois||0);},0)/pipeline.length)+' mois':'—','','#5b21b6')
    +kbCard('CA gagné total',won.length?fEur(won.reduce(function(s,o){return s+caPot(o);},0)):'—','','#c2410c')
    +'</div>'+topHtml+'</div>'
    +'<div>'+funnelHtml+'</div></div>'
    +ownerHtml;
}

/* ── Modals ── */

/* oppTeam = [{cid, taux, staffing, tmar}] stocké dans S.bizModal.oppTeam */
function oppConsPickerHTML(){
  var bt=S.bizModal&&S.bizModal.btype||'at';
  var team=S.bizModal&&S.bizModal.oppTeam||[];
  
  if(bt==='at'){
    /* AT : sélection simple d'un consultant */
    var sel=(S.bizModal&&S.bizModal.consPickerSel)||[];
    var selSet=new Set(sel);
    var chips=sel.map(function(cid){
      var cc=S.cons.find(function(x){return x.id===cid;})||{name:cid};
      return '<span class="_opp-chip" data-rm="'+cid+'" style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#dbeafe;color:#1e40af;margin:0 5px 5px 0;cursor:pointer">'+esc(cc.name)+' <span style="font-weight:900;opacity:.65">×</span></span>';
    }).join('')||'<span style="font-size:12px;color:#94a3b8">Aucun consultant sélectionné</span>';
    var checks=S.cons.filter(function(c){return c.grade!=='sales_grade';}).map(function(cc){
      return '<label style="display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:12px;color:#334155;cursor:pointer;border-radius:5px">'
        +'<input type="checkbox" class="_oppck" data-v="'+cc.id+'"'+(selSet.has(cc.id)?' checked':'')+' style="accent-color:#84CC16">'+esc(cc.name)+'</label>';
    }).join('');
    return '<div id="opp-cons-chips" style="margin-bottom:8px">'+chips+'</div>'
      +'<div style="max-height:120px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff">'+checks+'</div>';
  }
  
  /* FORFAIT : builder avec staffing + marge par consultant */
  var allCons=S.cons.filter(function(c){return c.grade!=='sales_grade';});
  var rows=team.map(function(tm,idx){
    var wdSel=tm.wdays&&tm.wdays.length?tm.wdays:[1,2]; /* défaut lun+mar */
    var wdChks=['Lun','Mar','Mer','Jeu','Ven'].map(function(lb,di){
      var dv=di+1;
      return '<label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;white-space:nowrap">'
        +'<input type="checkbox" class="_oppwd" data-idx="'+idx+'" data-dv="'+dv+'"'+(wdSel.indexOf(dv)>=0?' checked':'')+' style="accent-color:#84CC16;width:13px;height:13px">'+lb+'</label>';
    }).join('');
    var consOpts='<option value="">— Consultant —</option>'+allCons.map(function(cc){
      return '<option value="'+cc.id+'"'+(cc.id===tm.cid?' selected':'')+'>'+esc(cc.name)+'</option>';
    }).join('')+'<option value="__new__">✚ Nouveau consultant...</option>';
    /* Calcul indicatif nb jours */
    var cons=allCons.find(function(x){return x.id===tm.cid;});
    var indDays='—';
    if(cons&&cons.scr>0&&S.bizModal&&S.bizModal.item){
      var deal=(S.bizModal.item.deal_amount||0)/Math.max(team.length,1); /* CA distribué par poids */
      if(deal>0&&tm.tmar>=0){
        var tjm=cons.scr*113.35*1.25/(1-Math.min(tm.tmar||25,99)/100);
        indDays=Math.round(deal/tjm)+'j';
      }
    }
    return '<div class="opp-team-row" data-idx="'+idx+'" style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#f8fafc">'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      +'<select class="ic" style="flex:2;min-width:140px;font-size:12px" onchange="oppTeamUpdate('+idx+',\'cid\',this.value)"><option value="">'+consOpts+'</select>'
      +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:5px 8px">'+wdChks+'</div>'
      +'<div style="display:flex;align-items:center;gap:4px"><label style="font-size:11px;color:#64748b;white-space:nowrap">Marge</label>'
        +'<input class="ic" type="number" min="0" max="100" placeholder="%" style="width:60px;font-size:12px" value="'+(tm.tmar!=null?tm.tmar:25)+'" onchange="oppTeamUpdate('+idx+',\'tmar\',+this.value)"><span style="font-size:11px;color:#64748b">%</span></div>'
      +'<span style="font-size:11px;font-weight:700;color:#1B2B3A;background:#e2e8f0;padding:2px 8px;border-radius:99px;white-space:nowrap">'+indDays+'</span>'
      +'<button type="button" onclick="oppTeamRemove('+idx+')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:4px 9px;cursor:pointer;font-weight:700;font-size:13px">✕</button>'
      +'</div>'
      /* Mini-form nouveau consultant */
      +'<div id="opp-new-cons-'+idx+'" style="display:none;margin-top:10px;background:#f0fdf4;border-radius:6px;padding:10px;border:1px solid #bbf7d0">'
        +'<div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px">✚ Nouveau consultant</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 100px;gap:8px">'
          +'<input class="ic" placeholder="Nom complet *" id="opp-nc-name-'+idx+'" style="font-size:12px">'
          +'<input class="ic" placeholder="Poste *" id="opp-nc-title-'+idx+'" style="font-size:12px">'
          +'<input class="ic" type="number" placeholder="SCR €" id="opp-nc-scr-'+idx+'" style="font-size:12px">'
        +'</div>'
        +'<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">'
          +'<button type="button" onclick="oppNewConsCancel('+idx+')" style="background:#f1f5f9;color:#374151;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px">Annuler</button>'
          +'<button type="button" onclick="oppNewConsSave('+idx+')" style="background:#15803d;color:#fff;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:700">Créer &amp; ajouter</button>'
        +'</div>'
      +'</div>'
      +'</div>';
  }).join('');

  return rows
    /* ── Synthèse par consultant ── */
    +(team.filter(function(t){return t.cid;}).length>0?(function(){
      var totalDeal=S.bizModal&&S.bizModal.item&&S.bizModal.item.deal_amount||0;
      var allC=S.cons;
      var teamActive=team.filter(function(t){return t.cid;});
      var weights=teamActive.map(function(tm){
        var cc=allC.find(function(x){return x.id===tm.cid;})||{scr:1,name:'?'};
        return (cc.scr||1)*((tm.wdays&&tm.wdays.length?tm.wdays:[1,2]).length);
      });
      var totalW=weights.reduce(function(s,w){return s+w;},0)||1;
      var lines=teamActive.map(function(tm,i){
        var cc=allC.find(function(x){return x.id===tm.cid;})||{scr:1,name:tm.cid};
        var pct=Math.round(weights[i]/totalW*100);
        var dealPortion=totalDeal*weights[i]/totalW;
        var tmar=tm.tmar!=null?tm.tmar:25;
        var tjm=cc.scr>0?Math.round(cc.scr*113.35*1.25/(1-Math.min(tmar,99)/100)):0;
        var days=tjm>0?Math.round(dealPortion/tjm):0;
        var wdayLabel=(tm.wdays&&tm.wdays.length?tm.wdays:[1,2]).map(function(d){return['Lun','Mar','Mer','Jeu','Ven'][d-1];}).join('+');
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:7px;background:'+(i%2===0?'#f0fdf4':'#eff6ff')+';font-size:12px">'
          +'<span style="font-weight:700;color:#0f172a;flex:1">'+esc(cc.name)+'</span>'
          +'<span style="background:#1B2B3A;color:#84CC16;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:800">'+pct+'% du deal</span>'
          +(totalDeal>0?'<span style="color:#64748b">'+fEur(Math.round(dealPortion))+'</span>':'')
          +'<span style="color:#64748b">'+days+'j</span>'
          +'<span style="color:#94a3b8;font-size:11px">'+wdayLabel+'</span>'
          +'</div>';
      }).join('');
      return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px">'
        +'<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Synthèse</div>'
        +lines+'</div>';
    }()):'')
    +'<div style="display:flex;gap:8px;margin-top:6px">'
    +'<button type="button" onclick="oppTeamAdd()" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:7px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:700">+ Ajouter un membre</button>'
    +'</div>';
}

function oppTeamUpdate(idx,key,val){
  if(!S.bizModal)return;
  S.bizModal.oppTeam=S.bizModal.oppTeam||[];
  if(!S.bizModal.oppTeam[idx])return;
  /* Si "nouveau consultant" sélectionné : montrer le mini-form */
  if(key==='cid'&&val==='__new__'){
    S.bizModal.oppTeam[idx].cid='';
    var nf=document.getElementById('opp-new-cons-'+idx);
    if(nf)nf.style.display='block';
    return;
  }
  S.bizModal.oppTeam[idx][key]=val;
  oppConsRefresh();
}
function oppTeamAdd(){
  if(!S.bizModal)return;
  S.bizModal.oppTeam=S.bizModal.oppTeam||[];
  S.bizModal.oppTeam.push({cid:'',wdays:[1,2],tmar:25});
  oppConsRefresh();
}
function oppTeamRemove(idx){
  if(!S.bizModal)return;
  S.bizModal.oppTeam=(S.bizModal.oppTeam||[]).filter(function(_,i){return i!==idx;});
  oppConsRefresh();
}
function oppNewConsCancel(idx){
  var nf=document.getElementById('opp-new-cons-'+idx);if(nf)nf.style.display='none';
}
function oppNewConsSave(idx){
  var nameEl=document.getElementById('opp-nc-name-'+idx);
  var titleEl=document.getElementById('opp-nc-title-'+idx);
  var scrEl=document.getElementById('opp-nc-scr-'+idx);
  var n=nameEl&&nameEl.value.trim();var t=titleEl&&titleEl.value.trim();var scr=+(scrEl&&scrEl.value)||0;
  if(!n||!t){alert('Nom et poste requis.');return;}
  var newC={id:uid(),name:n,title:t,scr:scr,email:'',dir:S.dirName||'',arrive:null,depart:null,expertise:[],sectors:[],contract:'salarie',grade:''};
  S.cons=S.cons.concat([newC]);
  sbUpsertCons(newC);
  if(S.bizModal&&S.bizModal.oppTeam&&S.bizModal.oppTeam[idx]){S.bizModal.oppTeam[idx].cid=newC.id;}
  oppConsRefresh();
}

function oppConsRefresh(){var w=document.getElementById('opp-cons-wrap');if(w){w.innerHTML=oppConsPickerHTML();bindOppConsPicker();}}
function bindOppConsPicker(){
  var wrap=document.getElementById('opp-cons-wrap');if(!wrap)return;
  wrap.onclick=function(e){
    var chip=e.target.closest('._opp-chip');
    if(chip){var v=chip.getAttribute('data-rm');S.bizModal.consPickerSel=(S.bizModal.consPickerSel||[]).filter(function(x){return x!==v;});oppConsRefresh();}
  };
  wrap.onchange=function(e){
    if(e.target.classList.contains('_oppck')){
      var v=e.target.getAttribute('data-v');
      S.bizModal.consPickerSel=S.bizModal.consPickerSel||[];
      if(e.target.checked){if(S.bizModal.consPickerSel.indexOf(v)<0)S.bizModal.consPickerSel.push(v);}
      else{S.bizModal.consPickerSel=S.bizModal.consPickerSel.filter(function(x){return x!==v;});}
      oppConsRefresh();
    }
    if(e.target.classList.contains('_oppwd')){
      var idx2=+e.target.getAttribute('data-idx');
      var dv=+e.target.getAttribute('data-dv');
      if(!S.bizModal.oppTeam[idx2])return;
      S.bizModal.oppTeam[idx2].wdays=S.bizModal.oppTeam[idx2].wdays||[1,2];
      if(e.target.checked){if(S.bizModal.oppTeam[idx2].wdays.indexOf(dv)<0)S.bizModal.oppTeam[idx2].wdays.push(dv);}
      else{S.bizModal.oppTeam[idx2].wdays=S.bizModal.oppTeam[idx2].wdays.filter(function(x){return x!==dv;});}
      S.bizModal.oppTeam[idx2].wdays.sort();
      oppConsRefresh();
    }
  };
}

function tBizModal(){
  var m=S.bizModal;if(!m)return '';
  var body='';
  var title='';
  var saveAction='';

  var accOpts='<option value="">— Compte —</option>'+S.bizAccounts.map(function(a){return '<option value="'+a.id+'"'+(m.item&&m.item.account_id===a.id?' selected':'')+'>'+esc(a.name)+'</option>';}).join('');
  var ctOpts='<option value="">— Contact —</option>'+S.bizContacts.map(function(c){return '<option value="'+c.id+'"'+(m.item&&m.item.contact_id===c.id?' selected':'')+'>'+esc((c.first_name||'')+' '+(c.last_name||''))+'</option>';}).join('');
  var oppOpts='<option value="">— Opportunité —</option>'+S.bizOpps.map(function(o){return '<option value="'+o.id+'"'+(m.item&&m.item.opportunity_id===o.id?' selected':'')+'>'+esc(o.name)+'</option>';}).join('');
  var sectOpts=SECTORS_BIZ.map(function(s){return '<option value="'+s+'"'+(m.item&&m.item.sector===s?' selected':'')+'>'+s+'</option>';}).join('');

  if(m.type==='acc'){
    var it=m.item||{};
    title=it.id?'Modifier le compte':'Nouveau compte';
    saveAction='bizSaveAcc()';
    body='<div class="g2">'
      +'<div class="fd cs2"><label class="fl">Nom du compte *</label><input class="ic" id="biz-acc-name" value="'+esc(it.name||'')+'" placeholder="Ex: Société Générale"></div>'
      +'<div class="fd"><label class="fl">Statut</label><select class="ic" id="biz-acc-status">'
        +ACCOUNT_STATUS.map(function(s){return '<option value="'+s.id+'"'+(it.status===s.id?' selected':'')+'>'+s.lb+'</option>';}).join('')
        +'</select></div>'
      +'<div class="fd"><label class="fl">Secteur</label><select class="ic" id="biz-acc-sector"><option value="">—</option>'+sectOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Taille</label><select class="ic" id="biz-acc-size">'
        +['TPE (<10)','PME (10-250)','ETI (250-5000)','GE (>5000)'].map(function(s){return '<option value="'+s+'"'+(it.size===s?' selected':'')+'>'+s+'</option>';}).join('')
        +'</select></div>'
      +'<div class="fd"><label class="fl">Site web</label><input class="ic" id="biz-acc-website" value="'+esc(it.website||'')+'" placeholder="https://..."></div>'
      +'<div class="fd"><label class="fl">SIRET</label><input class="ic" id="biz-acc-siret" value="'+esc(it.siret||'')+'" placeholder="123 456 789"></div>'
      +'<div class="fd cs2"><label class="fl">Adresse</label><input class="ic" id="biz-acc-address" value="'+esc(it.address||'')+'"></div>'
      +'<div class="fd cs2"><label class="fl">Notes</label><textarea class="ic" id="biz-acc-notes" rows="2">'+esc(it.notes||'')+'</textarea></div>'
      +'</div>';
  }
  else if(m.type==='ct'){
    var it=m.item||{};
    title=it.id?'Modifier le contact':'Nouveau contact';
    saveAction='bizSaveCt()';
    body='<div class="g2">'
      +'<div class="fd"><label class="fl">Prénom *</label><input class="ic" id="biz-ct-fn" value="'+esc(it.first_name||'')+'" placeholder="Marie"></div>'
      +'<div class="fd"><label class="fl">Nom *</label><input class="ic" id="biz-ct-ln" value="'+esc(it.last_name||'')+'" placeholder="Dupont"></div>'
      +'<div class="fd"><label class="fl">Compte</label><select class="ic" id="biz-ct-acc">'+accOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Rôle</label><select class="ic" id="biz-ct-role">'
        +CONTACT_ROLES.map(function(r){return '<option value="'+r.id+'"'+(it.role_type===r.id?' selected':'')+'>'+r.lb+'</option>';}).join('')
        +'</select></div>'
      +'<div class="fd"><label class="fl">Poste</label><input class="ic" id="biz-ct-position" value="'+esc(it.position||'')+'" placeholder="DSI, DRH..."></div>'
      +'<div class="fd"><label class="fl">Email</label><input class="ic" type="email" id="biz-ct-email" value="'+esc(it.email||'')+'"></div>'
      +'<div class="fd"><label class="fl">Téléphone</label><input class="ic" id="biz-ct-phone" value="'+esc(it.phone||'')+'"></div>'
      +'<div class="fd"><label class="fl">Influence</label><select class="ic" id="biz-ct-influence"><option value="">—</option>'
        +INFLUENCE.map(function(x){return '<option value="'+x.id+'"'+(it.influence===x.id?' selected':'')+'>'+x.lb+'</option>';}).join('')+'</select></div>'
      +'<div class="fd"><label class="fl">Relation</label><select class="ic" id="biz-ct-relation"><option value="">—</option>'
        +RELATION.map(function(x){return '<option value="'+x.id+'"'+(it.relation===x.id?' selected':'')+'>'+x.lb+'</option>';}).join('')+'</select></div>'
      +'<div class="fd"><label class="fl">Niveau hiérarchique</label><select class="ic" id="biz-ct-hier"><option value="">—</option>'
        +HIER_LEVELS.map(function(x){return '<option value="'+x.id+'"'+(it.hierarchy_level===x.id?' selected':'')+'>'+x.lb+'</option>';}).join('')+'</select><p class="fh">« Plus haut » : vise le COMEX / C-level pour vendre de la valeur.</p></div>'
      +'<div class="fd"><label class="fl">Dernier contact</label><input class="ic" type="date" id="biz-ct-lastcontact" value="'+(it.last_contact_date||'')+'"><p class="fh">« Plus souvent » : entretenez la relation régulièrement.</p></div>'
      +'<div class="fd cs2"><label class="cx" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="biz-ct-arenc"'+(it.a_rencontrer?' checked':'')+'> À rencontrer (interlocuteur clé non encore rencontré)</label></div>'
      +'<div class="fd cs2"><label class="fl">Notes</label><textarea class="ic" id="biz-ct-notes" rows="2">'+esc(it.notes||'')+'</textarea></div>'
      +'</div>';
  }
  else if(m.type==='opp'){
    var it=m.item||{};
    title=it.id?'Modifier l\'opportunit\u00e9':'Nouvelle opportunit\u00e9';
    saveAction='bizSaveOpp()';
    var stOpts=OPP_STATUS.map(function(s){return '<option value="'+s.id+'"'+(it.status===s.id?' selected':(!it.id&&s.id==='identification'?' selected':''))+'>'+s.lb+'</option>';}).join('');
    var btOpp=m.btype||it.btype||'at';
    var consOpts='<option value="">-- Aucun --</option>'+S.cons.map(function(cc){return '<option value="'+cc.id+'"'+((it.consultant_ids||[]).indexOf(cc.id)>=0?' selected':'')+'>'+esc(cc.name)+'</option>';}).join('');
    /* Matching recrutement : expertise + localisation + séniorité + secteur → candidats.
       État conservé sur S.bizModal ; les puces et la liste se rafraîchissent en
       partiel (bizOppRefresh) sans re-render global. */
    if(S.bizModal.reqExp==null)S.bizModal.reqExp=((it.req_expertise)||[]).slice();
    if(S.bizModal.loc==null)S.bizModal.loc=(it.location||'');
    if(S.bizModal.seniority==null)S.bizModal.seniority=(it.req_seniority||'');
    if(S.bizModal.sector==null)S.bizModal.sector=(it.req_sector||'');
    var _oppLoc=S.bizModal.loc,_sector=S.bizModal.sector||'',_sen=S.bizModal.seniority||'';
    var _locOpts='<option value="">— Indifférent —</option>'+REC_LOCATIONS.map(function(l){return '<option value="'+esc(l)+'"'+(_oppLoc===l?' selected':'')+'>'+esc(l)+'</option>';}).join('');
    var _secOpts='<option value="">— Indifférent —</option>'+SECTOR_LIST.map(function(s){return '<option value="'+esc(s)+'"'+(_sector===s?' selected':'')+'>'+esc(s)+'</option>';}).join('');
    var _senOpts='<option value="">— Indifférent —</option>'+JOB_SENIORITY.map(function(s){return '<option value="'+s.id+'"'+(_sen===s.id?' selected':'')+'>'+esc(s.lb)+'</option>';}).join('');
    body='<div class="g2">'
      +'<div class="fd cs2"><label class="fl">Nom de l\'opportunit\u00e9 *</label><input class="ic" id="biz-opp-name" value="'+esc(it.name||'')+'" placeholder="Ex: Refonte SI DSI BNP"></div>'
      +'<div class="fd"><label class="fl">Compte</label><select class="ic" id="biz-opp-acc">'+accOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Contact</label><select class="ic" id="biz-opp-ct">'+ctOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Type de mission</label><select class="ic" id="biz-opp-btype" onchange="S.bizModal.btype=this.value;render()">'
        +'<option value="at"'+(btOpp==='at'?' selected':'')+'>AT \u2014 Assistance Technique</option>'
        +'<option value="forfait"'+(btOpp==='forfait'?' selected':'')+'>Forfait</option>'
        +'</select></div>'
      +'<div class="fd"><label class="fl">Statut</label><select class="ic" id="biz-opp-status">'+stOpts+'</select></div>'
      /* AT fields */
      +(btOpp==='at'?
        '<div class="fd"><label class="fl">TJM cible (\u20ac)</label><input class="ic" type="number" id="biz-opp-tjm" value="'+(it.tjm_cible||'')+'" placeholder="700"></div>'
        +'<div class="fd"><label class="fl">Jours estim\u00e9s</label><input class="ic" type="number" id="biz-opp-jours" value="'+(it.jours_estimes||'')+'" placeholder="20"></div>'
        :'<input type="hidden" id="biz-opp-tjm"><input type="hidden" id="biz-opp-jours">')
      /* Forfait fields */
      +(btOpp==='forfait'?
        '<div class="fd"><label class="fl">Montant deal (\u20ac)</label><input class="ic" type="number" id="biz-opp-deal" value="'+(it.deal_amount||'')+'" placeholder="150000"></div>'
        :'<input type="hidden" id="biz-opp-deal">')
      /* Date démarrage toujours visible, date fin seulement pour AT */
      +'<div class="fd"><label class="fl">Date d\u00e9marrage</label><input class="ic" type="date" id="biz-opp-start" value="'+(it.date_start||'')+'"></div>'
      +(btOpp==='at'?
        '<div class="fd"><label class="fl">Date fin</label><input class="ic" type="date" id="biz-opp-end" value="'+(it.date_end||'')+'"></div>'
        :'<input type="hidden" id="biz-opp-end">')
      +'<div class="fd"><label class="fl">Probabilit\u00e9 (%)</label><input class="ic" type="number" id="biz-opp-prob" min="0" max="100" value="'+(it.probability!=null?it.probability:20)+'"></div>'
      +'<div class="fd"><label class="fl">Date closing estim\u00e9e</label><input class="ic" type="date" id="biz-opp-closing" value="'+(it.date_closing||'')+'"></div>'
      +'<div class="fd"><label class="fl">Assign\u00e9 \u00e0</label><input class="ic" id="biz-opp-assign" value="'+esc(it.assigned_to||'')+'" placeholder="Commercial responsable"></div>'
      /* Consultant(s) pr\u00e9sent\u00e9(s) */
      +'<div class="fd cs2"><label class="fl">Consultant(s) pr\u00e9sent\u00e9(s)</label><div id="opp-cons-wrap">'+oppConsPickerHTML()+'</div></div>'
      +(it.status==='perdu'?'<div class="fd cs2"><label class="fl">Motif de perte</label><input class="ic" id="biz-opp-motif" value="'+esc(it.motif_perte||'')+'"></div>':'<input type="hidden" id="biz-opp-motif">')
      +'<div class="fd"><label class="fl">Localisation recherchée</label><select class="ic" id="biz-opp-loc" onchange="S.bizModal.loc=this.value;bizOppRefresh()">'+_locOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Séniorité recherchée</label><select class="ic" id="biz-opp-sen" onchange="S.bizModal.seniority=this.value;bizOppRefresh()">'+_senOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Secteur recherché</label><select class="ic" id="biz-opp-sector" onchange="S.bizModal.sector=this.value;bizOppRefresh()">'+_secOpts+'</select></div>'
      +'<div class="fd cs2"><label class="fl">Expertise / compétences recherchées</label><div id="opp-exp-chips" style="margin-top:4px">'+oppExpChipsHTML()+'</div><p class="fh">Sert à suggérer des candidats du pipeline recrutement.</p></div>'
      +'<div class="fd cs2"><label class="fl">🎯 Candidats suggérés</label><div id="opp-sugg" style="margin-top:4px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px">'+oppSuggHTML()+'</div><p class="fh">Classés par nombre de critères satisfaits (expertise, localisation, séniorité, secteur) ; 💶 prix et 📅 disponibilité servent de départage.</p></div>'
      +'<div class="fd cs2"><label class="cx" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="biz-opp-own"'+((it.delivery_own!==false)?' checked':'')+'> Délivrée par <b>mes consultants</b> (compte en Delivery Revenue). Décochez si l\'affaire est délivrée par d\'autres (External Revenue seul).</label></div>'
      +'<div class="fd cs2"><label class="fl">Notes</label><textarea class="ic" id="biz-opp-notes" rows="2">'+esc(it.notes||'')+'</textarea></div>'
      +'</div>';
  }
  else if(m.type==='act'){
    var it=m.item||{};
    title=it.id?'Modifier l\'activité':'Nouvelle activité';
    saveAction='bizSaveAct()';
    var tpOpts=ACT_TYPES.map(function(t){return '<option value="'+t.id+'"'+(it.type===t.id?' selected':(!it.id&&t.id==='appel'?' selected':''))+'>'+t.lb+'</option>';}).join('');
    body='<div class="g2">'
      +'<div class="fd"><label class="fl">Type</label><select class="ic" id="biz-act-type">'+tpOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Statut</label><select class="ic" id="biz-act-status">'
        +'<option value="realise"'+(it.status!=='planifie'?' selected':'')+'>Réalisé</option>'
        +'<option value="planifie"'+(it.status==='planifie'?' selected':'')+'>Planifié</option>'
        +'</select></div>'
      +'<div class="fd cs2"><label class="fl">Titre *</label><input class="ic" id="biz-act-title" value="'+esc(it.title||'')+'" placeholder="Ex: Appel découverte avec DSI"></div>'
      +'<div class="fd"><label class="fl">Compte</label><select class="ic" id="biz-act-acc">'+accOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Contact</label><select class="ic" id="biz-act-ct">'+ctOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Pour quel biz — opportunité</label><select class="ic" id="biz-act-opp">'+oppOpts+'</select></div>'
      +'<div class="fd"><label class="fl">…ou cible de CA (€)</label><input class="ic" type="number" id="biz-act-biztarget" value="'+(it.biz_target||'')+'" placeholder="Ex: 250000"><p class="fh">À défaut d\'opportunité déjà créée, chiffrez le business visé par cette action.</p></div>'
      +'<div class="fd"><label class="fl">Date</label><input class="ic" type="date" id="biz-act-date" value="'+(it.date_realised||new Date().toISOString().slice(0,10))+'"></div>'
      +'<div class="fd"><label class="fl">Assigné à</label><input class="ic" id="biz-act-assign" value="'+esc(it.assigned_to||'')+'"></div>'
      +'<div class="fd"><label class="fl">Prochaine action</label><input class="ic" id="biz-act-next" value="'+esc(it.next_action||'')+'" placeholder="Ex: Envoyer proposition"></div>'
      +'<div class="fd"><label class="fl">Date prochaine action</label><input class="ic" type="date" id="biz-act-next-date" value="'+(it.next_action_date||'')+'"></div>'
      +'<div class="fd cs2"><label class="fl">Notes</label><textarea class="ic" id="biz-act-notes" rows="2">'+esc(it.notes||'')+'</textarea></div>'
      +'</div>';
  }
  else if(m.type==='plan'){
    var it=m.item||{};
    title='Plan de compte — '+esc(accName(m.accId));
    saveAction='planSave()';
    body='<div class="g2">'
      +'<div class="fd"><label class="fl">Responsable de compte</label><input class="ic" id="plan-owner" value="'+esc(it.owner_name||'')+'" placeholder="Nom du responsable"></div>'
      +'<div class="fd"><label class="fl">Typologie du compte</label><select class="ic" id="plan-type">'
        +ACCOUNT_TYPES.map(function(t){return '<option value="'+t.id+'"'+((it.type||'potentiel')===t.id?' selected':'')+'>'+t.ic+' '+t.lb+'</option>';}).join('')+'</select><p class="fh">Stratégique = compte majeur (double Business Review S1 + Q1). À potentiel = à formaliser et développer.</p></div>'
      +'<div class="fd"><label class="fl">Statut / posture</label><select class="ic" id="plan-statut">'
        +PLAN_STATUS.map(function(s){return '<option value="'+s.id+'"'+(it.statut===s.id?' selected':'')+'>'+s.lb+'</option>';}).join('')+'</select></div>'
      +'<div class="fd"><label class="fl">Objectif ER — External Revenue (€)</label><input class="ic" type="number" id="plan-obj" value="'+(it.ca_objectif||'')+'" placeholder="1500000"></div>'
      +'<div class="fd"><label class="fl">Objectif DR — Delivery Revenue (€)</label><input class="ic" type="number" id="plan-obj-dr" value="'+(it.ca_objectif_dr||'')+'" placeholder="900000"></div>'
      +'<div class="fd"><label class="fl">⚙️ Cadence BR opérationnelle</label><select class="ic" id="plan-cadence"><option value="">— Ponctuel —</option>'
        +CADENCES.map(function(cd){return '<option value="'+cd.id+'"'+(it.revue_cadence===cd.id?' selected':'')+'>'+cd.lb+'</option>';}).join('')+'</select></div>'
      +'<div class="fd"><label class="fl">Prochaine BR opérationnelle</label><input class="ic" type="date" id="plan-revue" value="'+(it.prochaine_revue||'')+'"></div>'
      +'<div class="fd cs2"><label class="fl">🎯 Prochaine BR stratégique <span style="color:#94a3b8;font-weight:500">(comptes stratégiques — semestrielle)</span></label><input class="ic" type="date" id="plan-br-strat" value="'+(it.next_br_strat||'')+'"></div>'
      +'<div class="fd cs2"><label class="fl">🎯 Enjeux</label><textarea class="ic" id="plan-enjeux" rows="3" placeholder="Ambition sur le compte, périmètres à conquérir…">'+esc(it.enjeux||'')+'</textarea></div>'
      +'<div class="fd cs2"><label class="fl">🧭 Stratégie de développement</label><textarea class="ic" id="plan-strat" rows="3" placeholder="Leviers, relations à renforcer, plan d\'attaque…">'+esc(it.strategie||'')+'</textarea></div>'
      +'</div>';
  }
  else if(m.type==='team'){
    var it=m.item||{};
    title=it.id?'Modifier le membre':'Membre de l\'équipe du compte';
    saveAction='teamSave()';
    var consOpts='<option value="">— Saisie libre (hors Konsilys) —</option>'+(S.cons||[]).slice().sort(function(x,y){return (x.name||'').localeCompare(y.name||'');}).map(function(c){return '<option value="'+c.id+'"'+(it.consultant_id===c.id?' selected':'')+'>'+esc(c.name)+(c.bu_id?' — '+esc(buName(c.bu_id)):'')+'</option>';}).join('');
    var buOpts='<option value="">— BU —</option>'+((typeof buNodes==='function'?buNodes():[])||[]).map(function(b){return '<option value="'+b.id+'"'+(it.bu_id===b.id?' selected':'')+'>'+esc(b.name)+'</option>';}).join('');
    body='<div class="g2">'
      +'<div class="fd cs2"><label class="fl">Membre Konsilys</label><select class="ic" id="team-cons" onchange="var c=(S.cons||[]).find(function(x){return x.id===this.value;});if(c){var n=document.getElementById(\'team-name\');if(n)n.value=c.name;var e=document.getElementById(\'team-email\');if(e&&c.email)e.value=c.email;}">'+consOpts+'</select><p class="fh">Choisissez un membre existant (nom & BU pré-remplis) ou laissez « saisie libre » pour un intervenant hors Konsilys.</p></div>'
      +'<div class="fd"><label class="fl">Nom *</label><input class="ic" id="team-name" value="'+esc(it.member_name||'')+'" placeholder="Prénom Nom"></div>'
      +'<div class="fd"><label class="fl">Rôle</label><select class="ic" id="team-role">'+TEAM_ROLES.map(function(r){return '<option value="'+r.id+'"'+(it.role===r.id?' selected':'')+'>'+r.lb+'</option>';}).join('')+'</select></div>'
      +'<div class="fd"><label class="fl">BU de rattachement</label><select class="ic" id="team-bu">'+buOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Email</label><input class="ic" type="email" id="team-email" value="'+esc(it.member_email||'')+'"></div>'
      +'</div>';
  }
  else if(m.type==='notif'){
    var ns=S.notifSettings||{};
    title='🔔 Notifications de rappel d\'échéance';
    saveAction='notifSave()';
    body='<p class="fh" style="margin:0 0 14px">Chaque matin, Konsilys relance automatiquement les responsables dont un engagement de comité arrive à échéance (≤ 3 jours) ou est en retard — par email et/ou Microsoft Teams. L\'email part au responsable de l\'action (résolu via l\'équipe du compte, puis le responsable du plan, puis l\'adresse de repli ci-dessous).</p>'
      +'<div class="g2">'
      +'<div class="fd cs2"><label class="cx" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="notif-email"'+(ns.email_enabled!==false?' checked':'')+'> <b>Rappels par email</b> (via Resend)</label></div>'
      +'<div class="fd cs2"><label class="fl">Adresse de repli (digest)</label><input class="ic" type="email" id="notif-digest" value="'+esc(ns.digest_email||'')+'" placeholder="business@ma-esn.fr"><p class="fh">Utilisée quand le responsable d\'une action n\'a pas d\'email connu.</p></div>'
      +'<div class="fd cs2" style="border-top:1px solid #eef2f6;padding-top:10px"><label class="cx" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="notif-teams"'+(ns.teams_enabled!==false?' checked':'')+'> <b>Rappels Microsoft Teams</b></label></div>'
      +'<div class="fd cs2"><label class="fl">URL du webhook entrant Teams</label><input class="ic" id="notif-teams-url" value="'+esc(ns.teams_webhook_url||'')+'" placeholder="https://outlook.office.com/webhook/..."><p class="fh">Teams → canal cible → Connecteurs → « Incoming Webhook » → copiez l\'URL générée.</p></div>'
      +'</div>';
  }

  /* Pont Business → Recrutement : depuis une opportunité enregistrée, générer une
     fiche de poste pré-remplie (profil, client, TJM, dates). Disponible dès qu'un
     deal est prometteur — pas seulement gagné — pour que les recruteurs sachent
     quoi recruter quand un profil manque. */
  var jobBtn=(m.type==='opp'&&m.item&&m.item.id)
    ? '<button class="bsec" data-act="jfromopp" data-id="'+esc(m.item.id)+'" title="Créer un besoin de recrutement à partir de ce deal" style="margin-right:auto;border-color:#84CC16;color:#3f6212">📋 Créer une fiche de poste</button>'
    : '';
  return '<div class="mov"><div class="mob" style="max-width:680px">'
    +'<div class="moh"><div class="mot">'+title+'</div>'
    +'<button class="moc" onclick="S.bizModal=null;render()">✕</button></div>'
    +'<div class="mody" style="padding:20px">'+body
    +'<div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:18px">'
    +jobBtn
    +'<button class="bsec" onclick="S.bizModal=null;render()">Annuler</button>'
    +'<button class="bp" onclick="'+saveAction+'">Enregistrer</button>'
    +'</div></div></div></div>';
}




/* ══════════════════════════════════════════════════════════════
   OPPORTUNITÉS — PILOTAGE DES INTERCONTRATS
   Onglet dédié (rôles encadrants) : consultants en intercontrat ou en
   approche d'atterrissage, triés par date ; opportunités pressenties par
   consultant (client, démarrage, durée, TJM) concrétisables en mission ;
   timeline semaine/mois du nombre et du taux d'intercontrat.
   Données : S.staffOpps (table staffing_opportunities, RLS entreprise + BU).
══════════════════════════════════════════════════════════════ */
/* Ajoute n mois à une date AAAA-MM-JJ (fin de mission = veille du jour anniversaire). */
function oppAddMonths(s,n){
  var d=pD(s);var t=new Date(d.getFullYear(),d.getMonth()+Math.round(+n||0),d.getDate());
  t.setDate(t.getDate()-1);
  return fD(t);
}
/* Opportunités ouvertes (pressenties) d'un consultant. */
function oppsOf(cid){return (S.staffOpps||[]).filter(function(o){return o.cid===cid&&o.status==='pressentie';});}

/* Timeline : périodes à venir (12 semaines à partir du lundi courant, ou 6 mois
   à partir du 1er du mois) avec nb de consultants en intercontrat et taux. */
function oppTimeline(cons,view){
  var out=[],now=pD(TODAY);
  if(view==='month'){
    for(var i=0;i<6;i++){
      var d=new Date(now.getFullYear(),now.getMonth()+i,1);
      var day=i===0?TODAY:fD(d); /* mois courant : état à aujourd'hui, pas au 1er passé */
      var mEnd=fD(new Date(now.getFullYear(),now.getMonth()+i+1,0)); /* dernier jour du mois */
      out.push({day:day,end:mEnd,lb:MLB_OPP[d.getMonth()]+' '+String(d.getFullYear()).slice(2)});
    }
  }else{
    var dow=(now.getDay()+6)%7;
    var monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow);
    for(var w=0;w<12;w++){
      var wd=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+w*7);
      var wday=w===0?TODAY:fD(wd); /* semaine courante : état à aujourd'hui */
      var wEnd=fD(new Date(wd.getFullYear(),wd.getMonth(),wd.getDate()+6)); /* dimanche */
      out.push({day:wday,end:wEnd,lb:String(wd.getDate()).padStart(2,'0')+'/'+String(wd.getMonth()+1).padStart(2,'0')});
    }
  }
  out.forEach(function(p){
    /* Jours-homme sur TOUTE la période (pas un jour de mesure unique) : une
       semaine dont l'intercontrat démarre le mardi n'affiche plus 100 %.
       p.ic = consultants avec ≥1 j ouvré d'IC (cohérent avec le focus). */
    var st=icPeriodStats(cons,S.miss,S.lvs,p.day,p.end);
    p.total=st.act;p.ic=st.icN;p.icDays=st.icDays;p.dispo=st.dispo;
    p.staffed=st.staffed;
  });
  return out;
}
var MLB_OPP=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

function tOpps(){
  if(!['super_admin','admin','gestionnaire','sales'].includes(S.role))return '<div class="emp">Accès non autorisé.</div>';
  /* Consultants du périmètre (S.cons est déjà la vue filtrée par rôle), actifs
     ou à venir — les partis sont exclus. Hors profils Business Manager. */
  var cons=S.cons.filter(function(c){return c.grade!=='sales_grade'&&!(c.depart&&c.depart<TODAY);});
  var rows=cons.map(function(c){
    var st=icStatus(c,S.miss);
    /* Clé de tri : IC aujourd'hui d'abord, puis par date d'atterrissage, missions
       sans fin en dernier. */
    var key=!st.onMission?'0':(st.open?'9999-99-99':st.landing||'9999-99-98');
    return {c:c,st:st,key:key,opps:oppsOf(c.id)};
  }).sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:(a.c.name||'').localeCompare(b.c.name||'','fr');});

  /* Taux d'intercontrat = 100 % − staffing moyen de l'onglet KPIs, PAR
     CONSTRUCTION : même moteur (buildKS/kpi), même population, même période
     sélectionnée (exercice ou trimestre). Une seule lecture dans toute l'app —
     les deux indicateurs sont exactement complémentaires. */
  var _ks=buildKS();
  var _aktWD=_ks.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var _avgSr=_aktWD>0?_ks.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/_aktWD:0;
  var icRateFY=Math.max(0,100-_avgSr);
  /* Arrivées en intercontrat sous 30 jours : atterrissages de mission ET fins
     d'absence — ceux qui ne sont PAS en IC aujourd'hui mais le seront. */
  var _in30=fD(new Date(pD(TODAY).getFullYear(),pD(TODAY).getMonth(),pD(TODAY).getDate()+30));
  var arrivals30=icArrivals(cons,S.miss,S.lvs,TODAY,_in30).length;
  var nOpps=(S.staffOpps||[]).filter(function(o){return o.status==='pressentie';}).length;

  function tile(lb,val,sub,color){
    return '<div style="flex:1;min-width:150px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px">'
      +'<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">'+lb+'</div>'
      +'<div style="font-size:26px;font-weight:900;color:'+(color||'#0f172a')+';margin-top:2px">'+val+'</div>'
      +(sub?'<div style="font-size:11px;color:#94a3b8;margin-top:1px">'+sub+'</div>':'')+'</div>';
  }

  /* ── Timeline semaine / mois ── */
  var view=S.oppView==='month'?'month':'week';
  var tl=oppTimeline(cons,view);
  var maxIc=Math.max.apply(null,tl.map(function(p){return p.ic;}).concat([1]));
  var focus=S.oppFocus&&S.oppFocus.day&&S.oppFocus.end?S.oppFocus:null;
  var bars=tl.map(function(p){
    var h=Math.max(Math.round(p.ic/maxIc*90),p.ic>0?6:2);
    /* Couleur par taux EN CONTRAT : ≥90 % vert, ≥75 % orange, sinon rouge. */
    var col=p.staffed>=90?'#84CC16':p.staffed>=75?'#d97706':'#dc2626';
    var sel=focus&&focus.day===p.day&&focus.end===p.end;
    /* Clic sur la période : filtre le tableau du dessous sur ses intercontrats. */
    return '<div data-act="opp-focus" data-id="'+p.day+'|'+p.end+'" title="Cliquer pour voir les consultants en intercontrat sur cette période" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;cursor:pointer;border-radius:8px;padding:2px 0'+(sel?';box-shadow:0 0 0 2px #84CC16;background:#f7fdef':'')+'">'
      +'<div style="font-size:10px;font-weight:800;color:#334155;height:14px">'+(p.ic||'')+'</div>'
      +'<div style="display:flex;flex-direction:column;justify-content:flex-end;height:92px;width:60%;max-width:26px">'
      +'<div title="'+p.ic+' consultant(s) avec de l\'intercontrat sur la période · '+p.icDays+' j ouvrés IC / '+p.dispo+' disponibles — '+p.staffed.toFixed(0)+'% en contrat" style="height:'+h+'px;background:'+col+';border-radius:3px 3px 0 0"></div></div>'
      +'<div style="font-size:9px;color:#94a3b8;white-space:nowrap">'+p.lb+'</div>'
      +'<div style="font-size:9px;font-weight:700;color:'+col+'">'+p.staffed.toFixed(0)+'%</div>'
      +'</div>';
  }).join('');
  function segBtn(id,lb){
    var on=view===id;
    return '<button data-act="opp-view" data-id="'+id+'" style="padding:5px 14px;border-radius:7px;font-size:11px;font-weight:800;border:1px solid '+(on?'#84CC16':'#e2e8f0')+';background:'+(on?'#84CC16':'#fff')+';color:'+(on?'#1B2B3A':'#64748b')+';cursor:pointer">'+lb+'</button>';
  }

  /* ── Tableau des consultants par atterrissage ──
     mkTr construit une ligne ; badgeOverride (mode focus) remplace le statut
     « aujourd'hui » par le statut CALCULÉ SUR LA PÉRIODE sélectionnée. */
  var mkTr=function(r,badgeOverride){
    var c=r.c,st=r.st;
    var badge;
    if(badgeOverride!=null)badge=badgeOverride;
    else if(!st.onMission&&lvOnDay(c,S.lvs,TODAY)){
      /* En congé/arrêt aujourd'hui : pas compté en intercontrat. */
      var _lvC=(S.lvs||[]).filter(function(l){return l.cid===c.id&&l.type!=='Inter-contrat'&&l.s<=TODAY&&TODAY<=l.e;})
        .reduce(function(mx,l){return !mx||l.e>mx.e?l:mx;},null);
      badge='<span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">Absence'+(_lvC?' jusqu\'au '+fDt(_lvC.e):'')+'</span>';
    }
    else if(!st.onMission)badge='<span style="background:#fee2e2;color:#b91c1c;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:800">En intercontrat</span>';
    else if(st.open)badge='<span style="background:#f1f5f9;color:#64748b;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">Mission sans date de fin</span>';
    else{
      var dl=dL(st.landing);
      var col=dl<=15?'#b91c1c':dl<=45?'#b45309':'#15803d',bg=dl<=15?'#fee2e2':dl<=45?'#fffbeb':'#f0fdf4';
      badge='<span style="background:'+bg+';color:'+col+';padding:2px 10px;border-radius:99px;font-size:11px;font-weight:800">Atterrit le '+fDt(st.landing)+' (J-'+dl+')</span>';
    }
    /* Aperçu au survol : détail complet de chaque opportunité pressentie. */
    var oppTip=r.opps.map(function(o){
      return o.cli+' — '+(o.sd?fDt(o.sd):'?')+(o.dur?' · '+o.dur+' mois':'')+(o.tjm?' · '+Math.round(o.tjm)+' €/j':'')+(o.details?' · '+o.details:'');
    }).join('\n');
    /* Cellule cliquable : ouvre le popup des opportunités du consultant (même
       action que « + Opportunité ») ; le survol garde l'aperçu détaillé. */
    var oppTxt=r.opps.length
      ?'<span data-act="opp-add" data-id="'+c.id+'" title="'+esc(oppTip)+'" style="cursor:pointer;border-bottom:1px dotted #94a3b8"><span style="font-weight:800;color:#1B2B3A">'+r.opps.length+'</span> <span style="font-size:11px;color:#94a3b8">'+esc(r.opps.map(function(o){return o.cli;}).join(', '))+'</span></span>'
      :'<span style="color:#cbd5e1">—</span>';
    return '<tr>'
      +'<td><div data-act="opp-add" data-id="'+c.id+'" title="Voir le profil (compétences, secteurs) et les opportunités" style="display:flex;align-items:center;gap:10px;cursor:pointer">'+av(c.name,30)
      +'<div><div style="font-weight:600;font-size:13px;border-bottom:1px dotted #cbd5e1;display:inline-block">'+esc(c.name)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8">'+esc(c.title||'')+'</div></div></div></td>'
      +'<td>'+badge+'</td>'
      +'<td>'+oppTxt+'</td>'
      +'<td class="tr"><button class="bp" style="font-size:11px;padding:6px 12px" data-act="opp-add" data-id="'+c.id+'">+ Opportunité</button></td>'
      +'</tr>';
  };
  var trs=rows.map(function(r){return mkTr(r,null);}).join('');

  /* ── Focus période (clic sur une barre) : consultants en intercontrat ≥ 1 jour
     ouvré sur la fenêtre. Le statut évolue avec la période choisie :
     « Intercontrat depuis/dès le X » (début réel de la période d'IC), jours IC
     de la fenêtre + cumul depuis le début de l'intercontrat. ── */
  var focusBanner='';
  if(focus){
    rows.forEach(function(r){r.icDays=icDaysInRange(r.c,S.miss,S.lvs,focus.day,focus.end);});
    var _tot=rows.length;
    rows=rows.filter(function(r){return r.icDays>0;});
    focusBanner='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:12.5px">'
      +'<span>🔎 <strong>Focus du '+fDt(focus.day)+' au '+fDt(focus.end)+'</strong> — '
      +'<strong>'+rows.length+'</strong> consultant'+(rows.length>1?'s':'')+' en intercontrat sur la période <span style="color:#94a3b8">(sur '+_tot+')</span></span>'
      +'<button class="bg" style="font-size:11px;padding:5px 12px" data-act="opp-focus-clear">✕ Tout afficher</button></div>';
    trs=rows.map(function(r){
      var _start=icStretchStart(r.c,S.miss,S.lvs,focus.day,focus.end);
      var _cum=_start?icDaysInRange(r.c,S.miss,S.lvs,_start,focus.end):r.icDays;
      var _lbl=_start?('Intercontrat '+(_start<=TODAY?'depuis':'dès')+' le '+fDt(_start)):'En intercontrat';
      var fBadge='<span style="background:#fee2e2;color:#b91c1c;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:800">'+_lbl+'</span>'
        +' <span title="Jours ouvrés en intercontrat (congés/arrêts et fériés exclus)'+(_start?' — cumul du '+fDt(_start)+' au '+fDt(focus.end):'')+'" style="font-size:10px;font-weight:800;color:#b45309;white-space:nowrap">'+r.icDays+' j IC sur la période · '+_cum+' j au total</span>';
      return mkTr(r,fBadge);
    }).join('');
  }

  return '<div class="vw">'
    +'<div class="ph"><div><div class="pt">🛬 Intercontrats — pilotage du staffing</div>'
    +'<div class="ps">Consultants par date d\'atterrissage · opportunités pressenties · concrétisation en mission</div></div></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">'
    +tile('Taux d\'intercontrat '+fyLbl(S.year)+(S.quarter?' · '+curRangeLbl():''),icRateFY.toFixed(1)+'%','= 100 % − staffing moyen (KPIs)',icRateFY<=10?'#15803d':icRateFY<=25?'#b45309':'#b91c1c')
    +tile('Arrivées en intercontrat ≤ 30 j',arrivals30,'atterrissages + fins d\'absence',arrivals30>0?'#b45309':'#15803d')
    +tile('Opportunités en cours',nOpps,'missions pressenties','#1B2B3A')
    +'</div>'
    +'<div class="card" style="padding:18px 20px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">Taux en contrat à venir <span style="font-weight:500;color:#94a3b8;font-size:12px">— % en contrat et nb d\'intercontrats par '+(view==='month'?'mois':'semaine')+' (hors congés/arrêts)</span></div>'
    +'<div style="display:flex;gap:6px">'+segBtn('week','Semaines')+segBtn('month','Mois')+'</div></div>'
    +'<div style="display:flex;align-items:flex-end;gap:4px;padding-top:4px">'+bars+'</div>'
    +'</div>'
    +focusBanner
    +'<div class="card ov"><table style="min-width:640px">'
    +'<thead><tr><th>'+rLabel('utilisateur')+'</th><th>Statut / atterrissage</th><th>Opportunités pressenties</th><th class="tr"></th></tr></thead>'
    +'<tbody>'+(trs||'<tr><td colspan="4" class="emp">Aucun consultant sur ce périmètre.</td></tr>')+'</tbody></table></div>'
    +'</div>';
}

/* Corps du modal « Opportunités du consultant » (branché dans tModal, type 'staffopp'). */
function tStaffOppModal(){
  var cid=S.modal&&S.modal.cid;
  var c=S.cons.find(function(x){return x.id===cid;})||{name:'—'};
  var st=icStatus(c,S.miss);
  var stTxt=!st.onMission?'En intercontrat aujourd\'hui':(st.open?'En mission (sans date de fin)':'Atterrit le '+fDt(st.landing));
  var opps=(S.staffOpps||[]).filter(function(o){return o.cid===cid;});
  /* Mode édition : le formulaire est pré-rempli avec l'opportunité ciblée. */
  var editing=S.modal.editId?opps.find(function(o){return o.id===S.modal.editId;}):null;
  var rows=opps.map(function(o){
    var stBadge=o.status==='gagnee'?'<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:800">Gagnée</span>'
      :o.status==='perdue'?'<span style="background:#f1f5f9;color:#94a3b8;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">Perdue</span>'
      :'<span style="background:#fffbeb;color:#b45309;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:800">Pressentie</span>';
    /* Actions compactes sur deux lignes : évite tout défilement horizontal. */
    var acts=o.status==='pressentie'
      ?'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
        +'<button class="bp" style="font-size:10px;padding:4px 9px;white-space:nowrap" data-act="opp-win" data-id="'+o.id+'" title="Créer la mission correspondante">✓ Concrétiser</button>'
        +'<div style="display:flex;gap:8px;white-space:nowrap">'
        +'<button class="lb" style="font-size:10px" data-act="opp-edit" data-id="'+o.id+'">Modifier</button>'
        +'<button class="lb" style="font-size:10px" data-act="opp-lost" data-id="'+o.id+'">Perdue</button>'
        +'<button class="lr" style="font-size:10px" data-act="opp-del" data-id="'+o.id+'">Suppr.</button>'
        +'</div></div>'
      :'<button class="lr" style="font-size:10px" data-act="opp-del" data-id="'+o.id+'">Suppr.</button>';
    return '<tr'+(editing&&editing.id===o.id?' style="background:#f0fdf4"':'')+'><td style="font-weight:600;font-size:12px">'+esc(o.cli)
      +(o.details?'<div style="font-size:10px;font-weight:400;color:#94a3b8;max-width:150px">'+esc(o.details)+'</div>':'')+'</td>'
      +'<td style="font-size:12px">'+(o.sd?fDt(o.sd):'—')+'</td>'
      +'<td style="font-size:12px">'+(o.dur!=null?o.dur+' mois':'—')+'</td>'
      +'<td style="font-size:12px;font-weight:600">'+(o.tjm?fEur(o.tjm):'—')+'</td>'
      +'<td>'+stBadge+'</td>'
      +'<td class="tr">'+acts+'</td></tr>';
  }).join('');
  /* Compétences (expertise) et secteurs du consultant — chips. */
  var _chips=function(arr,bg,fg){
    arr=arr||[];
    return arr.length?arr.map(function(t){return '<span style="display:inline-block;background:'+bg+';color:'+fg+';padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;margin:0 5px 5px 0">'+esc(t)+'</span>';}).join(''):'<span style="color:#cbd5e1;font-size:11px">Non renseigné</span>';
  };
  return '<div style="margin-bottom:14px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;font-size:12px">'
    +'<div><strong>'+esc(c.name)+'</strong> · '+esc(c.title||'')+' · <span style="color:#64748b">'+stTxt+'</span></div>'
    +'<div style="margin-top:10px"><div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">🧩 Compétences</div>'+_chips(c.expertise,'#eef2ff','#3730a3')+'</div>'
    +'<div style="margin-top:8px"><div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">🏢 Secteurs</div>'+_chips(c.sectors,'#ecfeff','#155e75')+'</div>'
    +'</div>'
    +'<div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px">'
    +(editing?'✏️ Modifier l\'opportunité — '+esc(editing.cli):'➕ Nouvelle opportunité pressentie')+'</div>'
    +'<div class="g2">'
    +'<div class="fd"><label class="fl">Client *</label><input class="ic" id="opp-cli" value="'+(editing?esc(editing.cli):'')+'" placeholder="ex : BNP Paribas"></div>'
    +'<div class="fd"><label class="fl">Date de démarrage *</label><input class="ic" id="opp-sd" type="date" value="'+(editing?(editing.sd||''):(st.landing||TODAY))+'"></div>'
    +'<div class="fd"><label class="fl">Durée (mois)</label><input class="ic" id="opp-dur" type="number" min="1" step="1" value="'+(editing&&editing.dur!=null?editing.dur:'')+'" placeholder="6"></div>'
    +'<div class="fd"><label class="fl">TJM pressenti (€)</label><input class="ic" id="opp-tjm" type="number" min="0" value="'+(editing&&editing.tjm?editing.tjm:'')+'" placeholder="650"></div>'
    +'<div class="fd cs2"><label class="fl">Détail</label><input class="ic" id="opp-det" value="'+(editing?esc(editing.details||''):'')+'" placeholder="quelques mots : contexte, contact, prochaine étape…"></div>'
    +'</div>'
    +'<button class="bp" style="margin-top:4px" data-act="opp-save">'+(editing?'Enregistrer la modification':'Ajouter l\'opportunité')+'</button>'
    +(editing?' <button class="bg" style="margin-top:4px" data-act="opp-edit-cancel">Annuler</button>':'')
    +(rows?('<div style="font-size:12px;font-weight:800;color:#0f172a;margin:18px 0 8px">Opportunités de '+esc(c.name)+'</div>'
      +'<div class="ov"><table><thead><tr><th>Client</th><th>Démarrage</th><th>Durée</th><th>TJM</th><th>Statut</th><th class="tr"></th></tr></thead><tbody>'+rows+'</tbody></table></div>'):'')
    +'<p class="fh" style="margin-top:12px">« Concrétiser » crée la mission (AT, lun-ven) dans l\'onglet Missions et ouvre sa fiche pour compléter les informations manquantes.</p>';
}

/* ══════════════════════════════════════════════════════════════════
   PLANS DE COMPTE (Key Account Management) — animation des comptes
   stratégiques : portefeuille, plan de compte (enjeux, power map,
   plan d'actions, opportunités) et rituel de comité de revue.
══════════════════════════════════════════════════════════════════ */
var PLAN_STATUS=[
  {id:'strategique',lb:'Stratégique',bg:'#ede9fe',fg:'#5b21b6'},
  {id:'developper', lb:'À développer',bg:'#dbeafe',fg:'#1e40af'},
  {id:'defendre',   lb:'À défendre', bg:'#fef3c7',fg:'#92400e'},
  {id:'dormant',    lb:'Dormant',    bg:'#f1f5f9',fg:'#475569'},
];
var INFLUENCE=[{id:'fort',lb:'Fort'},{id:'moyen',lb:'Moyen'},{id:'faible',lb:'Faible'}];
var RELATION=[
  {id:'champion',lb:'Champion',bg:'#d1fae5',fg:'#065f46'},
  {id:'neutre',  lb:'Neutre',  bg:'#f1f5f9',fg:'#475569'},
  {id:'opposant',lb:'Opposant',bg:'#fee2e2',fg:'#b91c1c'},
];
var SANTE={green:{lb:'Sain',color:'#16a34a'},amber:{lb:'À surveiller',color:'#d97706'},red:{lb:'En risque',color:'#dc2626'}};
/* Typologie du compte (besoin CGI) : Stratégique (Top comptes, double revue) vs À potentiel. */
var ACCOUNT_TYPES=[
  {id:'strategique',lb:'Stratégique',bg:'#f5f3ff',fg:'#6d28d9',ic:'⭐'},
  {id:'potentiel',  lb:'À potentiel',bg:'#eff6ff',fg:'#1d4ed8',ic:'🌱'},
];
function accTypeObj(id){return ACCOUNT_TYPES.find(function(x){return x.id===id;})||ACCOUNT_TYPES[1];}
/* Types de Business Review : stratégique (semestrielle, S1) & opérationnelle (trimestrielle, Q1). */
var BR_TYPES=[
  {id:'strategique',  lb:'BR Stratégique',  short:'BR Strat.', cadence:'semestriel', ic:'🎯', c:'#6d28d9'},
  {id:'operationnelle',lb:'BR Opérationnelle',short:'BR Ope.',  cadence:'trimestriel',ic:'⚙️', c:'#0891b2'},
];
function brTypeObj(id){return BR_TYPES.find(function(x){return x.id===id;})||BR_TYPES[1];}
/* Niveaux hiérarchiques côté client (plan d'influence : « plus haut »). rank↑ = plus haut. */
var HIER_LEVELS=[
  {id:'c_level',     lb:'C-level / COMEX', short:'C-level', rank:3},
  {id:'n1',          lb:'N-1 (Directeur)', short:'N-1',     rank:2},
  {id:'n2',          lb:'N-2 (Manager)',   short:'N-2',     rank:1},
  {id:'operationnel',lb:'Opérationnel',    short:'Opé.',    rank:0},
];
function hierObj(id){return HIER_LEVELS.find(function(x){return x.id===id;})||null;}

function _today(){var d=new Date();d.setHours(0,0,0,0);return d;}
function planStObj(id){return PLAN_STATUS.find(function(x){return x.id===id;})||PLAN_STATUS[1];}
function relObj(id){return RELATION.find(function(x){return x.id===id;});}
function cEur(n){n=Math.round(+n||0);if(Math.abs(n)>=1e6)return (n/1e6).toFixed(n%1e6===0?0:1).replace('.',',')+' M€';if(Math.abs(n)>=1000)return Math.round(n/1000)+' k€';return fEur(n);}
function planForAccount(accId){return (S.accountPlans||[]).find(function(p){return p.account_id===accId;})||null;}
function planOrDefault(accId){return planForAccount(accId)||{id:null,account_id:accId,owner_name:'',owner_email:'',statut:'developper',type:'potentiel',ca_objectif:null,ca_objectif_dr:null,enjeux:'',strategie:'',prochaine_revue:null,next_br_strat:null,revue_cadence:null};}
/* Typologie du compte (défaut : à potentiel). */
function planType(accId){return planOrDefault(accId).type||'potentiel';}
function isStrategic(accId){return planType(accId)==='strategique';}
/* Équipe de gouvernance du compte + cadence des comités. */
var TEAM_ROLES=[{id:'kam',lb:'KAM',bg:'#dcfce7',fg:'#166534'},{id:'ingenieur_affaires',lb:'Ingénieur d\'affaires',bg:'#dbeafe',fg:'#1e40af'},{id:'directeur',lb:'Directeur',bg:'#ede9fe',fg:'#5b21b6'},{id:'sponsor',lb:'Sponsor',bg:'#fef3c7',fg:'#92400e'},{id:'membre',lb:'Membre',bg:'#f1f5f9',fg:'#475569'}];
var CADENCES=[{id:'hebdomadaire',lb:'Hebdomadaire',days:7},{id:'mensuel',lb:'Mensuel',months:1},{id:'trimestriel',lb:'Trimestriel',months:3},{id:'semestriel',lb:'Semestriel',months:6},{id:'annuel',lb:'Annuel',months:12}];
function teamRoleObj(id){return TEAM_ROLES.find(function(x){return x.id===id;})||TEAM_ROLES[4];}
function cadenceObj(id){return CADENCES.find(function(x){return x.id===id;})||null;}
function accTeam(accId){var order={kam:0,ingenieur_affaires:1,directeur:2,sponsor:3,membre:4};return (S.accountTeam||[]).filter(function(m){return m.account_id===accId;}).sort(function(a,b){return (order[a.role]||9)-(order[b.role]||9);});}
function buName(id){return (id&&typeof buLabel==='function'&&buLabel(id))||(id||'');}
/* Prochaine échéance de comité selon la cadence (à partir d'aujourd'hui). */
function _dPlusMonths(m){var d=new Date();d.setMonth(d.getMonth()+m);return d.toISOString().slice(0,10);}
function _dPlusCadence(cad){if(!cad)return _dPlus(90);return cad.days?_dPlus(cad.days):_dPlusMonths(cad.months||3);}
async function sbUpsertTeam(m){if(!sb||!SB_CID)return;return sb.from('account_team').upsert(Object.assign({},m,{company_id:SB_CID}),{onConflict:'id'});}
/* Réglages de notification (rappels d'échéance email + Teams) par entreprise. */
function notifSave(){
  var mm=S.bizModal;if(!mm||mm.type!=='notif')return;
  var ns={
    company_id:SB_CID,
    email_enabled:!!(document.getElementById('notif-email')&&document.getElementById('notif-email').checked),
    teams_enabled:!!(document.getElementById('notif-teams')&&document.getElementById('notif-teams').checked),
    digest_email:(gv('notif-digest')||'').trim()||null,
    teams_webhook_url:(gv('notif-teams-url')||'').trim()||null
  };
  S.notifSettings=ns;
  if(sb&&SB_CID)sb.from('notification_settings').upsert(ns,{onConflict:'company_id'}).then(function(r){if(r&&r.error)console.warn('notif save:',r.error);});
  S.bizModal=null;render();
}
function teamSave(){
  var mm=S.bizModal;if(!mm||mm.type!=='team')return;var accId=mm.accId;
  var consId=gv('team-cons');
  var m={id:(mm.item&&mm.item.id)||uid2(),account_id:accId,role:gv('team-role')||'membre',member_name:gv('team-name'),member_email:gv('team-email'),bu_id:gv('team-bu')||null,consultant_id:consId||null};
  if(consId){var c=(S.cons||[]).find(function(x){return x.id===consId;});if(c){m.member_name=c.name;m.member_email=c.email||m.member_email;if(!m.bu_id)m.bu_id=c.bu_id||null;}}
  if(!m.member_name){alert('Nom requis');return;}
  if(mm.item&&mm.item.id){S.accountTeam=S.accountTeam.map(function(x){return x.id===m.id?m:x;});}
  else{S.accountTeam=(S.accountTeam||[]).concat([m]);}
  sbUpsertTeam(m);S.bizModal=null;render();
}
function teamDel(id){
  if(!confirm('Retirer ce membre de l\'équipe du compte ?'))return;
  S.accountTeam=(S.accountTeam||[]).filter(function(x){return x.id!==id;});
  if(sb&&SB_CID)sb.from('account_team').delete().eq('id',id).then(function(){});
  render();
}
/* Exercice fiscal d'une date (aligné sur le sélecteur S.year du reste de l'app). */
function _fyOfDate(dstr){if(!dstr)return null;var t=String(dstr).slice(0,10);for(var fy=(S.year||currentFY())-2;fy<=(S.year||currentFY())+2;fy++){if(t>=fyStart(fy)&&t<=fyEnd(fy))return fy;}return null;}
/* Une opportunité est rattachée à l'exercice courant si sa date (closing → début →
   création) tombe dedans ; sans aucune date, on la garde (repli) pour ne rien masquer. */
function oppInYear(o){var d=o.date_closing||o.date_start||(o.created_at&&String(o.created_at).slice(0,10));if(!d)return true;return _fyOfDate(d)===(S.year||currentFY());}
function accWonOpps(accId){return (S.bizOpps||[]).filter(function(o){return o.account_id===accId&&o.status==='gagne'&&oppInYear(o);});}
function accOpenOpps(accId){return (S.bizOpps||[]).filter(function(o){return o.account_id===accId&&o.status!=='gagne'&&o.status!=='perdu';});}
function oppIsOwnDelivery(o){return o.delivery_own!==false;}
/* ER (External Revenue) : tout le CA gagné sur le compte (avec ou sans mes consultants), exercice courant. */
function accER(accId){return accWonOpps(accId).reduce(function(s,o){return s+caPot(o);},0);}
/* DR (Delivery Revenue) : CA gagné délivré par MES consultants (ER=DR si interne, 0 sinon). */
function accDR(accId){return accWonOpps(accId).reduce(function(s,o){return s+(oppIsOwnDelivery(o)?caPot(o):0);},0);}
/* Pipeline pondéré total et part délivrable en interne (DR potentiel). */
function accPipelineDR(accId){return accOpenOpps(accId).reduce(function(s,o){return s+(oppIsOwnDelivery(o)?caPot(o)*((+o.probability||0)/100):0);},0);}
/* Atterrissage = réalisé + pipeline pondéré ; écart = objectif − atterrissage. */
function accLandingER(accId){return accER(accId)+accPipelineCA(accId);}
function accLandingDR(accId){return accDR(accId)+accPipelineDR(accId);}
/* « Mon portefeuille » : responsable du plan = utilisateur courant (nom). */
function meName(){return ((S.profileFirstName||'')+' '+(S.profileLastName||'')).trim();}
/* « Mes comptes » : je suis responsable OU membre de l'équipe de gouvernance du compte. */
function accIsMine(accId){
  var me=meName().toLowerCase(),meEmail=(S._userEmail||'').toLowerCase();
  if(me&&(planOrDefault(accId).owner_name||'').toLowerCase().indexOf(me)>=0)return true;
  return accTeam(accId).some(function(m){
    return (me&&(m.member_name||'').toLowerCase().indexOf(me)>=0)||(meEmail&&(m.member_email||'').toLowerCase()===meEmail);
  });
}
/* Toutes les actions planifiées (non faites), toutes fiches confondues, triées par échéance. */
function allPlannedActions(accIds){
  var set=accIds?null:null,out=[];
  (S.bizAccounts||[]).forEach(function(a){
    if(accIds&&accIds.indexOf(a.id)<0)return;
    accActions(a.id).filter(actIsPlanned).forEach(function(k){out.push({k:k,acc:a});});
  });
  return out.sort(function(x,y){return (x.k.next_action_date||'9999-99-99').localeCompare(y.k.next_action_date||'9999-99-99');});
}
/* Alertes de pilotage sur un compte (compte stratégique sans action, revue en retard, atterrissage < objectif). */
function accAlertList(accId){
  var pl=planOrDefault(accId),acts=accActions(accId),msgs=[];
  var strat=pl.statut==='strategique'||pl.statut==='defendre';
  if(strat&&!acts.filter(actIsPlanned).length)msgs.push('Compte '+planStObj(pl.statut).lb.toLowerCase()+' sans action planifiée');
  if(pl.prochaine_revue&&pD(pl.prochaine_revue)<_today())msgs.push('Revue en retard ('+fDt(pl.prochaine_revue)+')');
  var lateA=acts.filter(actIsLate),immA=acts.filter(actIsImminent);
  if(lateA.length)msgs.push(lateA.length+' engagement(s) en retard'+(lateA[0].assigned_to?' (resp. '+lateA[0].assigned_to+')':''));
  if(immA.length)msgs.push('⏰ '+immA.length+' engagement(s) à échéance sous 3 j'+(immA[0].assigned_to?' (resp. '+immA[0].assigned_to+')':''));
  if((+pl.ca_objectif||0)>0&&accLandingER(accId)<(+pl.ca_objectif))msgs.push('Atterrissage ER sous l\'objectif ('+cEur((+pl.ca_objectif)-accLandingER(accId))+' à combler)');
  if((+pl.ca_objectif_dr||0)>0&&accLandingDR(accId)<(+pl.ca_objectif_dr))msgs.push('Atterrissage DR sous l\'objectif ('+cEur((+pl.ca_objectif_dr)-accLandingDR(accId))+' à combler)');
  return msgs;
}
/* Marque une action comme faite (1 clic). */
function actMarkDone(id){
  var k=(S.bizActivities||[]).find(function(x){return x.id===id;});if(!k)return;
  k.status='realise';if(!k.date_realised)k.date_realised=new Date().toISOString().slice(0,10);
  S.bizActivities=S.bizActivities.map(function(x){return x.id===id?k:x;});
  if(typeof sbUpsertAct==='function')sbUpsertAct(k);
  render();
}
/* Rétro-compat : le « CA réalisé » historique correspond à l'ER. */
function accWonCA(accId){return accER(accId);}
function accPipelineCA(accId){return accOpenOpps(accId).reduce(function(s,o){return s+caPot(o)*((+o.probability||0)/100);},0);}
function accActions(accId){return (S.bizActivities||[]).filter(function(k){return k.account_id===accId;});}
/* « Pour quel biz » : opportunité liée (prioritaire) ou cible de CA saisie sur l'action. */
function actBizLabel(k){
  if(!k)return '';
  if(k.opportunity_id){var o=(S.bizOpps||[]).find(function(x){return x.id===k.opportunity_id;});if(o)return o.name||'Opportunité';}
  if(+k.biz_target>0)return cEur(+k.biz_target)+' (cible)';
  return '';
}
function actIsAbandoned(k){return !!k.abandoned;}
function actIsDone(k){return !actIsAbandoned(k)&&(k.status==='realise'||(!!k.date_realised&&k.status!=='planifie'));}
function actIsPlanned(k){return !actIsDone(k)&&!actIsAbandoned(k);}
function actIsLate(k){return actIsPlanned(k)&&k.next_action_date&&pD(k.next_action_date)<_today();}
/* ── Boucle d'engagement : verdict de tenue d'une action, d'un comité à l'autre ── */
var VERDICTS={
  tenu:{lb:'Tenu',c:'#16a34a',bg:'#dcfce7'},tenu_retard:{lb:'Tenu en retard',c:'#b45309',bg:'#fef3c7'},
  non_tenu:{lb:'Non tenu',c:'#b91c1c',bg:'#fee2e2'},reporte:{lb:'Reporté',c:'#c2410c',bg:'#ffedd5'},
  abandonne:{lb:'Abandonné',c:'#64748b',bg:'#f1f5f9'},a_venir:{lb:'À venir',c:'#1e40af',bg:'#dbeafe'}
};
function actVerdict(k){
  if(actIsAbandoned(k))return 'abandonne';
  if(actIsDone(k)){var due=k.next_action_date;if(due&&k.date_realised&&pD(k.date_realised)>pD(due))return 'tenu_retard';return 'tenu';}
  if(actIsLate(k))return 'non_tenu';
  if((+k.reported_count||0)>0)return 'reporte';
  return 'a_venir';
}
/* Taux de tenue : engagements tenus / engagements arrivés à échéance (tenus, non tenus, abandonnés). */
function _reliab(acts){var kept=0,total=0;acts.forEach(function(k){var v=actVerdict(k);if(v==='tenu'||v==='tenu_retard'){kept++;total++;}else if(v==='non_tenu'||v==='abandonne'){total++;}});return {kept:kept,total:total,pct:total?Math.round(kept/total*100):null};}
function accReliability(accId){return _reliab(accActions(accId));}
function personReliability(name){var n=(name||'').toLowerCase();return _reliab((S.bizActivities||[]).filter(function(k){return (k.assigned_to||'').toLowerCase()===n;}));}
function reliabColor(pct){return pct==null?'#94a3b8':pct>=80?'#16a34a':pct>=50?'#d97706':'#dc2626';}
/* Rappels d'échéance : jours restants (négatif = dépassé), imminence ≤ 3 jours. */
function _daysUntil(dstr){if(!dstr)return null;return Math.round((pD(dstr)-_today())/86400000);}
function actIsImminent(k){var d=_daysUntil(k.next_action_date);return actIsPlanned(k)&&d!=null&&d>=0&&d<=3;}
/* Sparkline SVG du taux de tenue au fil des revues (historique + valeur courante). */
function reliabSparkline(accId){
  var revs=accReviews(accId).slice().filter(function(r){return r.reliability!=null;}).reverse();
  var pts=revs.map(function(r){return +r.reliability;});
  var cur=accReliability(accId).pct;if(cur!=null)pts.push(cur);
  if(pts.length<2)return '';
  var W=150,Hh=34,n=pts.length,x=function(i){return 3+(n<=1?0:i/(n-1)*(W-6));},y=function(v){return Hh-3-(v/100)*(Hh-6);};
  var d='';pts.forEach(function(v,i){d+=(i?' L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1);});
  var dots=pts.map(function(v,i){return '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.4" fill="'+reliabColor(v)+'"/>';}).join('');
  return '<svg width="'+W+'" height="'+Hh+'" style="vertical-align:middle" aria-label="Historique de tenue"><path d="'+d+'" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>'+dots+'</svg>';
}
/* Verdicts posés en comité : Tenu (actMarkDone), Reporté (+1 semaine, glissement compté), Abandonné. */
function actReport(id){
  var k=(S.bizActivities||[]).find(function(x){return x.id===id;});if(!k)return;
  var base=(k.next_action_date&&pD(k.next_action_date)>_today())?pD(k.next_action_date):_today();
  var d=new Date(base);d.setDate(d.getDate()+7);
  k.next_action_date=d.toISOString().slice(0,10);k.reported_count=(+k.reported_count||0)+1;k.status='planifie';k.abandoned=false;k.committed_at=new Date().toISOString().slice(0,10);
  S.bizActivities=S.bizActivities.map(function(x){return x.id===id?k:x;});if(typeof sbUpsertAct==='function')sbUpsertAct(k);render();
}
function actAbandon(id){
  var k=(S.bizActivities||[]).find(function(x){return x.id===id;});if(!k)return;
  var why=prompt('Motif d\'abandon (optionnel) :','');if(why===null)return;
  k.abandoned=true;if(why)k.notes=(k.notes?k.notes+' · ':'')+'Abandon : '+why;
  S.bizActivities=S.bizActivities.map(function(x){return x.id===id?k:x;});if(typeof sbUpsertAct==='function')sbUpsertAct(k);render();
}
function accContacts(accId){return (S.bizContacts||[]).filter(function(c){return c.account_id===accId;});}
/* ── Plan d'influence / lobbying : accès aux décideurs (« plus haut, plus tôt, plus souvent ») ── */
function ctFullName(c){return ((c.first_name||'')+' '+(c.last_name||'')).trim()||'—';}
function ctRank(c){var h=hierObj(c.hierarchy_level);return h?h.rank:-1;}
/* Prochaine action de relation planifiée liée à cet interlocuteur. */
function contactNextAction(ctId){
  return (S.bizActivities||[]).filter(function(k){return k.contact_id===ctId&&actIsPlanned(k)&&k.next_action_date;})
    .sort(function(a,b){return (a.next_action_date||'').localeCompare(b.next_action_date||'');})[0]||null;
}
/* Récence de contact en jours (via last_contact_date ou dernière action réalisée liée). */
function contactRecencyDays(c){
  var dates=[];if(c.last_contact_date)dates.push(c.last_contact_date);
  (S.bizActivities||[]).forEach(function(k){if(k.contact_id===c.id&&actIsDone(k)&&k.date_realised)dates.push(k.date_realised);});
  if(!dates.length)return null;
  var last=dates.sort().reverse()[0];
  return Math.round((_today()-pD(last))/86400000);
}
/* Indicateurs de couverture exécutive du compte. */
function execCoverage(accId){
  var cts=accContacts(accId);
  var deciders=cts.filter(function(c){return c.role_type==='decideur'||ctRank(c)>=2;}); /* décideurs ou N-1/C-level */
  var high=cts.filter(function(c){return ctRank(c)>=2;});                                /* C-level + N-1 */
  var met=high.filter(function(c){return !c.a_rencontrer&&(c.relation||contactRecencyDays(c)!=null);});
  var toMeet=cts.filter(function(c){return c.a_rencontrer;});
  var champions=cts.filter(function(c){return c.relation==='champion';});
  var recs=cts.map(contactRecencyDays).filter(function(d){return d!=null;});
  var avgRec=recs.length?Math.round(recs.reduce(function(s,d){return s+d;},0)/recs.length):null;
  return {n:cts.length,deciders:deciders.length,high:high.length,met:met.length,
    coverage:high.length?Math.round(met.length/high.length*100):null,
    toMeet:toMeet.length,champions:champions.length,avgRec:avgRec};
}
function accReviews(accId){return (S.accountReviews||[]).filter(function(r){return r.account_id===accId;}).sort(function(a,b){return (b.review_date||'').localeCompare(a.review_date||'');});}
function accSante(accId){
  var acts=accActions(accId), late=acts.filter(actIsLate).length, openA=acts.filter(actIsPlanned).length;
  var pl=planForAccount(accId), strat=pl&&(pl.statut==='strategique'||pl.statut==='defendre');
  var revLate=pl&&pl.prochaine_revue&&pD(pl.prochaine_revue)<_today();
  var code;
  if(late>=2||(strat&&openA===0))code='red';
  else if(late===1||openA===0||revLate)code='amber';
  else code='green';
  return Object.assign({code:code},SANTE[code]);
}
function santeDot(code){return '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+SANTE[code].color+';vertical-align:middle"></span>';}
function planStChip(id){var s=planStObj(id);return '<span style="background:'+s.bg+';color:'+s.fg+';font-size:11px;font-weight:800;padding:2px 9px;border-radius:99px;white-space:nowrap">'+s.lb+'</span>';}

/* Comptes du portefeuille, triés pour l'animation : gravité de santé, puis
   priorité de statut, puis nom. Les comptes dormants passent en fin. */
function portfolioAccounts(){
  var order={red:0,amber:1,green:2},spri={strategique:0,defendre:1,developper:2,dormant:3};
  return (S.bizAccounts||[]).slice().sort(function(a,b){
    var sa=accSante(a.id).code, sb2=accSante(b.id).code;
    if(order[sa]!==order[sb2])return order[sa]-order[sb2];
    var pa=spri[(planOrDefault(a.id).statut)]||2, pb=spri[(planOrDefault(b.id).statut)]||2;
    if(pa!==pb)return pa-pb;
    return (a.name||'').localeCompare(b.name||'');
  });
}

/* ── Supabase : plans + revues ── */
async function sbUpsertPlan(pl){if(!sb||!SB_CID)return;return sb.from('account_plans').upsert(Object.assign({},pl,{company_id:SB_CID,updated_at:new Date().toISOString()}),{onConflict:'id'});}
async function sbUpsertReview(rv){if(!sb||!SB_CID)return;return sb.from('account_reviews').upsert(Object.assign({},rv,{company_id:SB_CID}),{onConflict:'id'});}

/* Enregistre le plan depuis la modale (crée en base au premier enregistrement). */
function planSave(){
  var m=S.bizModal;if(!m||m.type!=='plan')return;
  var accId=m.accId;
  var ex=planForAccount(accId);
  var pl={
    id:(ex&&ex.id)||uid2(),
    account_id:accId,
    owner_name:gv('plan-owner'),
    owner_email:(ex&&ex.owner_email)||'',
    statut:gv('plan-statut')||'developper',
    type:gv('plan-type')||'potentiel',
    ca_objectif:+gv('plan-obj')||null,
    ca_objectif_dr:+gv('plan-obj-dr')||null,
    revue_cadence:gv('plan-cadence')||null,
    enjeux:gv('plan-enjeux'),
    strategie:gv('plan-strat'),
    prochaine_revue:gv('plan-revue')||null,
    next_br_strat:gv('plan-br-strat')||null,
  };
  if(ex){S.accountPlans=S.accountPlans.map(function(x){return x.account_id===accId?pl:x;});}
  else{S.accountPlans=(S.accountPlans||[]).concat([pl]);}
  sbUpsertPlan(pl);
  S.bizModal=null;render();
}

/* ── Portefeuille de comptes ── */
function tBizPlans(){
  var allAccs=portfolioAccounts();
  if(!allAccs.length)return tEmpty('📁','Aucun compte','Créez d\'abord des comptes clients dans l\'onglet « Comptes » pour bâtir leurs plans de compte.','');
  var pf=S.planFilter||(S.planFilter={mine:false,statut:'',sante:''});
  /* KAM / Business Manager : par défaut on cadre sur « Mes comptes » (équipe). */
  if(!pf._init){pf._init=true;pf.mine=(S.role==='sales'||S.role==='utilisateur');}
  var accs=allAccs.filter(function(a){
    if(pf.mine&&!accIsMine(a.id))return false;
    if(pf.type&&planType(a.id)!==pf.type)return false;
    if(pf.statut&&planOrDefault(a.id).statut!==pf.statut)return false;
    if(pf.sante&&accSante(a.id).code!==pf.sante)return false;
    return true;
  });
  var nRevue=accs.filter(function(a){var pl=planForAccount(a.id);return pl&&pl.prochaine_revue&&pD(pl.prochaine_revue)<=_today();}).length;
  var head='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div style="font-size:13px;color:#64748b">Animez le développement de vos comptes stratégiques : responsable, objectif, actions et rituel de comité.'
      +(nRevue?' <b style="color:#b45309">'+nRevue+' compte'+(nRevue>1?'s':'')+' à revoir.</b>':'')+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +(['admin','super_admin','gestionnaire'].indexOf(S.role)>=0?'<button class="lb" data-act="notif-open" title="Configurer les rappels d\'échéance par email et Microsoft Teams">🔔 Notifications</button>':'')
    +'<button class="bp" data-act="comite-start" title="Dérouler les comptes un par un en séance de comité">▶ Lancer un comité de revue</button></div></div>';
  /* Bandeau d'alertes de pilotage. */
  var alerts=[];accs.forEach(function(a){accAlertList(a.id).forEach(function(m){alerts.push({a:a,m:m});});});
  var alertBox=alerts.length?('<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;margin-bottom:14px">'
    +'<div style="font-size:12px;font-weight:800;color:#92400e;margin-bottom:6px">⚠️ '+alerts.length+' point(s) d\'attention</div>'
    +alerts.slice(0,6).map(function(x){return '<div data-act="plan-open" data-id="'+x.a.id+'" style="cursor:pointer;font-size:12.5px;color:#78350f;padding:2px 0"><b>'+esc(x.a.name)+'</b> — '+esc(x.m)+'</div>';}).join('')
    +(alerts.length>6?'<div style="font-size:11px;color:#b45309;margin-top:4px">+ '+(alerts.length-6)+' autre(s)…</div>':'')+'</div>'):'';
  /* Filtres. */
  function fbtn(lb,on,act,val){return '<button data-act="'+act+'" data-id="'+esc(val)+'" style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:700;border:1px solid '+(on?'#1B2B3A':'#e2e8f0')+';background:'+(on?'#1B2B3A':'#fff')+';color:'+(on?'#fff':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+lb+'</button>';}
  var filterBar='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px">'
    +fbtn((pf.mine?'✓ ':'')+'Mon portefeuille',pf.mine,'planf-mine','')
    +'<span style="width:1px;height:20px;background:#e2e8f0;margin:0 4px"></span>'
    +fbtn('Tous types',!pf.type,'planf-type','')+ACCOUNT_TYPES.map(function(t){return fbtn(t.ic+' '+t.lb,pf.type===t.id,'planf-type',t.id);}).join('')
    +'<span style="width:1px;height:20px;background:#e2e8f0;margin:0 4px"></span>'
    +fbtn('Tous statuts',!pf.statut,'planf-statut','')+PLAN_STATUS.map(function(s){return fbtn(s.lb,pf.statut===s.id,'planf-statut',s.id);}).join('')
    +'<span style="width:1px;height:20px;background:#e2e8f0;margin:0 4px"></span>'
    +fbtn('Toute santé',!pf.sante,'planf-sante','')+[['red','🔴 En risque'],['amber','🟠 À surveiller'],['green','🟢 Sain']].map(function(x){return fbtn(x[1],pf.sante===x[0],'planf-sante',x[0]);}).join('')
    +'</div>';
  /* Mes échéances : actions planifiées (retards en tête) sur les comptes filtrés. */
  var acts=allPlannedActions(accs.map(function(a){return a.id;}));
  var echeances=acts.length?('<div style="background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:12px 14px;margin-bottom:16px">'
    +'<div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px">🗓️ Mes échéances <span style="color:#94a3b8;font-weight:600">— '+acts.length+' action(s) à mener</span></div>'
    +acts.slice(0,8).map(function(it){var k=it.k,late=actIsLate(k),imm=actIsImminent(k),dn=_daysUntil(k.next_action_date);
      var col=late?'#dc2626':imm?'#c2410c':'#64748b';
      var when=k.next_action_date?(fDt(k.next_action_date)+(late?' · en retard de '+Math.abs(dn)+' j ⚠':dn===0?' · aujourd\'hui':dn!=null&&dn>0?' · dans '+dn+' j'+(imm?' ⏰':''):'')):'—';
      return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-top:1px solid #f1f5f9">'
        +'<button class="lb" data-act="act-done" data-id="'+k.id+'" title="Marquer comme fait" style="padding:2px 8px;font-size:12px">✓</button>'
        +'<div data-act="plan-open" data-id="'+it.acc.id+'" style="flex:1;cursor:pointer;min-width:0"><span style="font-weight:700;color:#0f172a">'+esc(k.title||'')+'</span> <span style="color:#94a3b8;font-size:12px">· '+esc(it.acc.name)+(k.assigned_to?' · '+esc(k.assigned_to):'')+'</span>'+(actBizLabel(k)?' <span style="font-size:10px;font-weight:800;color:#0e7490">💶 '+esc(actBizLabel(k))+'</span>':'')+'</div>'
        +'<span style="font-size:12px;white-space:nowrap;color:'+col+';font-weight:'+(late||imm?'800':'600')+'">'+when+'</span></div>';
    }).join('')
    +(acts.length>8?'<div style="font-size:11px;color:#94a3b8;margin-top:6px">+ '+(acts.length-8)+' autre(s) échéance(s)…</div>':'')+'</div>'):'';
  var rows=accs.map(function(a){
    var pl=planOrDefault(a.id), st=accSante(a.id);
    var obj=+pl.ca_objectif||0, objDr=+pl.ca_objectif_dr||0, er=accER(a.id), dr=accDR(a.id), pip=accPipelineCA(a.id);
    var pct=obj>0?Math.min(100,Math.round(er/obj*100)):0;
    var late=accActions(a.id).filter(actIsLate).length;
    var bar='<div style="background:#eef2f6;border-radius:6px;height:8px;overflow:hidden;margin-top:4px"><div style="height:100%;width:'+pct+'%;background:'+(pct>=70?'#16a34a':pct>=40?'#d97706':'#dc2626')+'"></div></div>';
    var to=accTypeObj(pl.type);
    return '<tr data-act="plan-open" data-id="'+a.id+'" style="cursor:pointer">'
      +'<td><div style="font-weight:800;color:#0f172a">'+esc(a.name)+'</div><div style="font-size:11px;color:#94a3b8">'+esc(a.sector||'—')+'</div></td>'
      +'<td><span title="'+to.lb+'" style="background:'+to.bg+';color:'+to.fg+';font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap">'+to.ic+' '+to.lb+'</span></td>'
      +'<td>'+esc(pl.owner_name||'—')+'</td>'
      +'<td>'+planStChip(pl.statut)+'</td>'
      +'<td title="'+st.lb+'">'+santeDot(st.code)+' <span style="font-size:12px;color:'+st.color+';font-weight:700">'+st.lb+'</span></td>'
      +'<td style="min-width:150px"><div style="font-size:12px"><b>'+cEur(er)+'</b> <span style="color:#94a3b8">/ '+(obj?cEur(obj):'—')+'</span></div>'+bar+'</td>'
      +'<td class="tr" title="Delivery Revenue — délivré par mes consultants"><b>'+cEur(dr)+'</b>'+(objDr?'<span style="color:#94a3b8"> / '+cEur(objDr)+'</span>':'')+'</td>'
      +'<td class="tr">'+cEur(pip)+'</td>'
      +'<td class="tr">'+(late?'<span style="color:#dc2626;font-weight:800">'+late+'</span>':'<span style="color:#94a3b8">0</span>')+'</td>'
      +'<td class="tr" style="white-space:nowrap;font-size:12px;color:'+(pl.prochaine_revue&&pD(pl.prochaine_revue)<=_today()?'#b45309':'#64748b')+'">'+(pl.prochaine_revue?fDt(pl.prochaine_revue):'—')+'</td>'
      +'</tr>';
  }).join('');
  var table=accs.length?('<div class="ov"><table><thead><tr><th>Compte</th><th>Type</th><th>Responsable</th><th>Statut</th><th>Santé</th><th title="External Revenue : tout le CA gagné">ER / objectif</th><th class="tr" title="Delivery Revenue : délivré par mes consultants">DR</th><th class="tr">Pipeline</th><th class="tr">Actions ⚠</th><th class="tr">Prochaine BR</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<p class="fh" style="margin-top:10px"><b>ER</b> (External Revenue) = tout le CA gagné sur le compte (exercice courant) · <b>DR</b> (Delivery Revenue) = délivré par vos consultants · Pipeline = opportunités ouvertes pondérées. Cliquez une ligne pour ouvrir le plan de compte.</p>')
    :'<div class="emp">Aucun compte ne correspond à ces filtres.</div>';
  return '<div class="vw">'+head+alertBox+filterBar+echeances+table+'</div>';
}

/* ── Détail d'un plan de compte ── */
function tPlanDetail(accId){
  var a=S.bizAccounts.find(function(x){return x.id===accId;});
  if(!a)return tBizPlans();
  var pl=planOrDefault(accId), st=accSante(accId);
  var obj=+pl.ca_objectif||0, objDr=+pl.ca_objectif_dr||0, er=accER(accId), dr=accDR(accId), pip=accPipelineCA(accId);
  var pct=obj>0?Math.min(100,Math.round(er/obj*100)):0;
  var pctDr=objDr>0?Math.min(100,Math.round(dr/objDr*100)):0;
  var back='<button class="bg" data-act="plan-close" style="margin-bottom:12px">← Portefeuille</button>';
  var tObj=accTypeObj(pl.type);
  var typeChip='<span style="background:'+tObj.bg+';color:'+tObj.fg+';font-size:11px;font-weight:800;padding:2px 10px;border-radius:99px">'+tObj.ic+' '+tObj.lb+'</span>';
  var brInfo=(pl.revue_cadence?' · BR ope. <b>'+esc((cadenceObj(pl.revue_cadence)||{}).lb||pl.revue_cadence).toLowerCase()+'</b>':'')
    +(pl.prochaine_revue?' → <b>'+fDt(pl.prochaine_revue)+'</b>':'')
    +(pl.type==='strategique'&&pl.next_br_strat?' · 🎯 BR strat. → <b>'+fDt(pl.next_br_strat)+'</b>':'');
  var header='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
    +'<div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div class="pt">'+esc(a.name)+'</div>'+typeChip+planStChip(pl.statut)+'<span title="'+st.lb+'">'+santeDot(st.code)+' <span style="font-size:12px;font-weight:700;color:'+st.color+'">'+st.lb+'</span></span></div>'
      +'<div class="ps">'+esc(a.sector||'—')+' · Responsable : <b>'+esc(pl.owner_name||'—')+'</b>'+brInfo+'</div></div>'
    +'<div style="display:flex;gap:8px"><button class="bg" data-act="plan-edit" data-id="'+accId+'">✏️ Éditer le plan</button><button class="bp" data-act="comite-start-one" data-id="'+accId+'">▶ Revue de compte</button></div></div>';
  /* Métriques */
  function metric(lb,val,sub,col){return '<div style="flex:1;min-width:150px;background:#fff;border:1px solid #e5e9ee;border-top:3px solid '+(col||'#1B2B3A')+';border-radius:12px;padding:14px 16px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8">'+lb+'</div><div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px">'+val+'</div>'+(sub?'<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+sub+'</div>':'')+'</div>';}
  /* Deux barres : ER vs objectif ER (vert), DR vs objectif DR (violet). */
  function progBar(p,col){return '<div style="background:#eef2f6;border-radius:7px;height:9px;overflow:hidden;margin-top:6px"><div style="height:100%;width:'+p+'%;background:'+col+'"></div></div>';}
  var bars='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">'
    +'<div style="flex:1;min-width:220px"><div style="font-size:11px;color:#94a3b8;display:flex;justify-content:space-between"><span>ER / objectif</span><span>'+(obj?pct+'%':'—')+'</span></div>'+progBar(pct,pct>=70?'#16a34a':pct>=40?'#d97706':'#dc2626')+'</div>'
    +'<div style="flex:1;min-width:220px"><div style="font-size:11px;color:#94a3b8;display:flex;justify-content:space-between"><span>DR / objectif</span><span>'+(objDr?pctDr+'%':'—')+'</span></div>'+progBar(pctDr,'#7c3aed')+'</div></div>';
  var metrics='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">'
    +metric('Objectifs',(obj?cEur(obj):'—'),'ER · DR '+(objDr?cEur(objDr):'—'),'#1B2B3A')
    +metric('ER — External Revenue',cEur(er),(obj?pct+'% de l\'objectif ER':'tout le CA gagné'),'#16a34a')
    +metric('DR — Delivery Revenue',cEur(dr),(objDr?pctDr+'% de l\'objectif DR':(er>0?Math.round(dr/er*100)+'% délivré en interne':'délivré par mes consultants')),'#7c3aed')
    +metric('Pipeline pondéré',cEur(pip),accOpenOpps(accId).length+' opportunité(s)','#0891b2')
    +'</div>'+bars;
  /* Atterrissage = réalisé + pipeline pondéré, vs objectif (écart à combler). */
  function landCell(lb,obj2,land,col){
    var gap=obj2-land, atteint=obj2>0&&gap<=0;
    return '<div style="flex:1;min-width:240px;background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:12px 16px">'
      +'<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8">Atterrissage '+lb+'</div>'
      +'<div style="display:flex;align-items:baseline;gap:8px;margin-top:2px"><span style="font-size:20px;font-weight:800;color:'+col+'">'+cEur(land)+'</span><span style="font-size:12px;color:#94a3b8">réalisé + pipeline pondéré</span></div>'
      +(obj2>0?'<div style="font-size:12px;margin-top:4px;color:'+(atteint?'#16a34a':'#b45309')+';font-weight:700">'+(atteint?'✓ Objectif couvert ('+cEur(-gap)+' au-delà)':'Écart à combler : '+cEur(gap))+'</div>':'<div style="font-size:12px;margin-top:4px;color:#94a3b8">Objectif non défini</div>')+'</div>';
  }
  var landing='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">'
    +landCell('ER',obj,accLandingER(accId),'#16a34a')
    +landCell('DR',objDr,accLandingDR(accId),'#7c3aed')+'</div>';
  metrics+=landing;
  /* Enjeux & stratégie */
  function block(t,txt){return '<div style="background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:14px 16px;flex:1;min-width:260px"><div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px">'+t+'</div><div style="font-size:13px;color:#475569;line-height:1.55;white-space:pre-wrap">'+(txt?esc(txt):'<span style="color:#94a3b8">Non renseigné.</span>')+'</div></div>';}
  var strat='<div style="display:flex;gap:12px;flex-wrap:wrap;margin:18px 0">'+block('🎯 Enjeux',pl.enjeux)+block('🧭 Stratégie de développement',pl.strategie)+'</div>';
  /* Power map interlocuteurs */
  var cts=accContacts(accId);
  /* Grille de pouvoir : influence (lignes) × relation (colonnes). */
  var INF_ROWS=[{id:'fort',lb:'Influence forte'},{id:'moyen',lb:'Influence moyenne'},{id:'faible',lb:'Influence faible'}];
  var REL_COLS=[{id:'opposant',lb:'Opposant',c:'#b91c1c'},{id:'neutre',lb:'Neutre',c:'#475569'},{id:'champion',lb:'Champion',c:'#065f46'}];
  function ctChip(c){return '<span data-act="biz-edit-ct" data-id="'+c.id+'" title="Modifier l\'interlocuteur" style="display:inline-block;cursor:pointer;background:#fff;border:1px solid #cbd5e1;border-radius:99px;padding:2px 9px;font-size:11px;font-weight:700;color:#0f172a;margin:0 4px 4px 0">'+esc(((c.first_name||' ')[0]||'').toUpperCase()+'. '+(c.last_name||c.first_name||''))+(c.a_rencontrer?' 🎯':'')+'</span>';}
  var qual=cts.filter(function(c){return c.influence&&c.relation;});
  var unq=cts.filter(function(c){return !(c.influence&&c.relation);});
  var matrix='<div style="overflow-x:auto"><div style="min-width:540px;display:grid;grid-template-columns:130px repeat(3,1fr);gap:6px">'
    +'<div></div>'+REL_COLS.map(function(r){return '<div style="text-align:center;font-size:11px;font-weight:800;color:'+r.c+'">'+r.lb+'</div>';}).join('')
    +INF_ROWS.map(function(inf){
      return '<div style="display:flex;align-items:center;font-size:11px;font-weight:800;color:#475569">'+inf.lb+'</div>'
        +REL_COLS.map(function(r){
          var inCell=qual.filter(function(c){return c.influence===inf.id&&c.relation===r.id;});
          var hot=inf.id==='fort'&&r.id==='champion',risk=inf.id==='fort'&&r.id==='opposant';
          return '<div style="min-height:52px;border:1px solid '+(hot?'#a7f3d0':risk?'#fecaca':'#e5e9ee')+';border-radius:8px;padding:6px;background:'+(hot?'#ecfdf5':risk?'#fef2f2':'#fff')+'">'+(inCell.map(ctChip).join('')||'<span style="color:#cbd5e1;font-size:11px">—</span>')+'</div>';
        }).join('');
    }).join('')
    +'</div></div>';
  var unqNote=unq.length?('<div style="margin-top:8px;font-size:12px;color:#94a3b8">'+unq.length+' interlocuteur(s) à qualifier : '+unq.map(function(c){return '<span data-act="biz-edit-ct" data-id="'+c.id+'" style="cursor:pointer;text-decoration:underline dotted">'+esc((c.first_name||'')+' '+(c.last_name||''))+'</span>';}).join(', ')+'</div>'):'';
  var powerMap='<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:800;color:#0f172a">🗺️ Grille de pouvoir <span style="color:#94a3b8;font-weight:600">— influence × relation</span></div>'
    +'<button class="bp" data-act="plan-ct-new" data-id="'+accId+'" style="font-size:12px;padding:6px 12px">+ Interlocuteur</button></div>'
    +(cts.length?matrix+unqNote:'<div class="emp">Aucun interlocuteur. Cartographiez les décideurs et prescripteurs du compte.</div>')+'</div>';
  /* Plan d'actions */
  var acts=accActions(accId).slice().sort(function(x,y){return (x.next_action_date||x.date_realised||'').localeCompare(y.next_action_date||y.date_realised||'');});
  var actRows=acts.length?acts.map(function(k){
    var done=actIsDone(k), late=actIsLate(k), open=actIsPlanned(k), tp=(ACT_TYPES.find(function(t){return t.id===k.type;})||{}).lb||k.type;
    var when=done?('Fait le '+(k.date_realised?fDt(k.date_realised):'—')):(k.next_action_date?fDt(k.next_action_date):'—');
    var vd=VERDICTS[actVerdict(k)], rep=+k.reported_count||0;
    var badge='<span style="background:'+vd.bg+';color:'+vd.c+';font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px">'+vd.lb+'</span>'
      +(rep?' <span title="Reporté '+rep+' fois" style="background:#ffedd5;color:#c2410c;font-size:10px;font-weight:800;padding:2px 6px;border-radius:99px">×'+rep+'</span>':'');
    var biz=actBizLabel(k);
    return '<tr><td>'+esc(tp)+'</td><td><b>'+esc(k.title||'')+'</b>'+(biz?' <span title="Business visé par cette action" style="font-size:10px;font-weight:800;color:#0e7490;background:#ecfeff;border:1px solid #a5f3fc;border-radius:99px;padding:1px 7px;white-space:nowrap">💶 '+esc(biz)+'</span>':'')+(k.next_action&&open?'<div style="font-size:11px;color:#94a3b8">→ '+esc(k.next_action)+'</div>':'')+'</td>'
      +'<td>'+badge+'</td><td style="white-space:nowrap;color:'+(late?'#dc2626':'#475569')+'">'+when+'</td><td>'+esc(k.assigned_to||'—')+'</td>'
      +'<td class="tr" style="white-space:nowrap">'+(open?'<button class="lb" data-act="act-done" data-id="'+k.id+'" title="Tenu" style="padding:2px 7px;margin-right:2px">✓</button><button class="lb" data-act="act-report" data-id="'+k.id+'" title="Reporter" style="padding:2px 7px;margin-right:2px">⟳</button>':'')+'<button class="lr" data-act="biz-edit-act" data-id="'+k.id+'">✏️</button></td></tr>';
  }).join(''):'<tr><td colspan="6" class="emp">Aucune action. Planifiez prospection, rencontres et relances.</td></tr>';
  /* Taux de tenue des engagements du compte + par personne. */
  var rel=accReliability(accId);
  var teamRel=(function(){var names={};accActions(accId).forEach(function(k){if(k.assigned_to)names[k.assigned_to]=1;});return Object.keys(names).map(function(n){var r=personReliability(n);return {n:n,r:r};}).filter(function(x){return x.r.total>0;}).sort(function(a,b){return (b.r.pct||0)-(a.r.pct||0);});})();
  var spark=reliabSparkline(accId);
  var reliabCard='<div style="background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:14px 16px;margin-bottom:18px">'
    +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="font-size:13px;font-weight:800;color:#0f172a">🎯 Tenue des engagements</div>'
    +'<div style="font-size:26px;font-weight:800;color:'+reliabColor(rel.pct)+'">'+(rel.pct!=null?rel.pct+'%':'—')+'</div>'
    +'<div style="font-size:12px;color:#94a3b8">'+rel.kept+' tenu(s) / '+rel.total+' engagement(s) arrivé(s) à échéance</div>'
    +(spark?'<div style="margin-left:auto;text-align:right"><div style="font-size:10px;color:#94a3b8;font-weight:700">HISTORIQUE</div>'+spark+'</div>':'')+'</div>'
    +(teamRel.length?'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+teamRel.map(function(x){return '<span style="font-size:11px;background:#f8fafc;border:1px solid #e5e9ee;border-radius:99px;padding:3px 10px"><b>'+esc(x.n)+'</b> · <b style="color:'+reliabColor(x.r.pct)+'">'+(x.r.pct!=null?x.r.pct+'%':'—')+'</b> <span style="color:#94a3b8">('+x.r.kept+'/'+x.r.total+')</span></span>';}).join('')+'</div>':'')
    +'<p class="fh" style="margin-top:8px">Chaque engagement pris en comité est confronté à un verdict au comité suivant (Tenu / Reporté / Abandonné). Le taux mesure la fiabilité d\'exécution.</p></div>';
  var actions='<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:800;color:#0f172a">✅ Plan d\'actions</div>'
    +'<button class="bp" data-act="plan-act-new" data-id="'+accId+'" style="font-size:12px;padding:6px 12px">+ Action</button></div>'
    +'<div class="ov"><table><thead><tr><th>Type</th><th>Action</th><th>Statut</th><th>Échéance</th><th>Responsable</th><th class="tr"></th></tr></thead><tbody>'+actRows+'</tbody></table></div></div>';
  /* Opportunités du compte */
  var opps=accOpenOpps(accId).concat(accWonOpps(accId));
  var oppRows=opps.length?opps.map(function(o){
    return '<tr data-act="biz-open-opp" data-id="'+o.id+'" style="cursor:pointer"><td><b>'+esc(o.name||'')+'</b></td>'
      +'<td><span style="'+oppStStyle(o.status)+'font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px">'+oppStLb(o.status)+'</span></td>'
      +'<td class="tr">'+cEur(caPot(o))+'</td><td class="tr">'+(o.probability!=null?o.probability+'%':'—')+'</td></tr>';
  }).join(''):'<tr><td colspan="4" class="emp">Aucune opportunité sur ce compte.</td></tr>';
  var oppsBlock='<div style="margin-bottom:18px"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px">💼 Opportunités</div>'
    +'<div class="ov"><table><thead><tr><th>Opportunité</th><th>Statut</th><th class="tr">CA potentiel</th><th class="tr">Prob.</th></tr></thead><tbody>'+oppRows+'</tbody></table></div></div>';
  /* Historique des revues */
  var revs=accReviews(accId);
  var revBlock=revs.length?('<div style="margin-bottom:8px"><div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px">🗓️ Historique des comités</div>'
    +revs.map(function(r){return '<div style="background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:10px 12px;margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:12px">'+(function(){var bt=brTypeObj(r.review_type);return '<span style="color:'+bt.c+'">'+bt.ic+' '+bt.short+'</span> · ';})()+'Revue du '+fDt(r.review_date)+(r.reliability!=null?' · <span style="color:'+reliabColor(r.reliability)+'">tenue '+r.reliability+'%</span>':'')+'</b><span style="font-size:11px;color:#94a3b8">'+esc(r.participants||'')+'</span></div>'
      +(r.decisions?'<div style="font-size:12px;color:#475569;margin-top:4px"><b>Décisions :</b> '+esc(r.decisions)+'</div>':'')
      +(r.next_steps?'<div style="font-size:12px;color:#475569;margin-top:2px"><b>Prochaines étapes :</b> '+esc(r.next_steps)+'</div>':'')
      +'</div>';}).join('')+'</div>'):'';
  /* Équipe de gouvernance du compte (KAM, IA, directeurs… éventuellement multi-BU). */
  var team=accTeam(accId);
  var teamCards=team.length?team.map(function(m){var ro=teamRoleObj(m.role);
    return '<div style="background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:10px 12px;min-width:200px;flex:1">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="font-weight:800;color:#0f172a;font-size:13px">'+esc(m.member_name||'—')+'</div>'
      +'<div style="white-space:nowrap"><button class="lr" data-act="plan-team-edit" data-id="'+m.id+'" style="padding:2px 6px">✏️</button><button class="lr" data-act="plan-team-del" data-id="'+m.id+'" style="padding:2px 6px">✕</button></div></div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">'
      +'<span style="background:'+ro.bg+';color:'+ro.fg+';font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px">'+ro.lb+'</span>'
      +(m.bu_id?'<span style="background:#f1f5f9;color:#475569;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px">'+esc(buName(m.bu_id))+'</span>':'')
      +(m.consultant_id?'<span title="Membre Konsilys" style="font-size:10px;color:#16a34a;font-weight:700">● Konsilys</span>':'')+'</div>'
      +(m.member_email?'<div style="font-size:11px;color:#94a3b8;margin-top:4px">'+esc(m.member_email)+'</div>':'')+'</div>';
  }).join(''):'<div class="emp" style="flex:1">Aucun membre. Constituez l\'équipe qui anime ce compte (KAM, ingénieur d\'affaires, directeur…).</div>';
  var teamBlock='<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div style="font-size:13px;font-weight:800;color:#0f172a">🧑‍💼 Équipe du compte <span style="color:#94a3b8;font-weight:600">— gouvernance & comité</span></div>'
    +'<button class="bp" data-act="plan-team-new" data-id="'+accId+'" style="font-size:12px;padding:6px 12px">+ Membre</button></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'+teamCards+'</div></div>';
  var influence=tInfluencePlan(accId);
  return '<div class="vw">'+back+header+metrics+strat+teamBlock+powerMap+influence+reliabCard+actions+oppsBlock+revBlock+'</div>';
}

/* ── Plan d'influence / lobbying : cartographie actionnable des décideurs ── */
function tInfluencePlan(accId){
  var cts=accContacts(accId).slice().sort(function(a,b){return ctRank(b)-ctRank(a)||(a.a_rencontrer===b.a_rencontrer?0:(a.a_rencontrer?-1:1));});
  var cov=execCoverage(accId);
  function kpi(lb,val,col){return '<div style="flex:1;min-width:130px;background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:10px 12px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#94a3b8">'+lb+'</div><div style="font-size:18px;font-weight:800;color:'+(col||'#0f172a')+';margin-top:2px">'+val+'</div></div>';}
  var covCol=cov.coverage==null?'#94a3b8':cov.coverage>=70?'#16a34a':cov.coverage>=40?'#d97706':'#dc2626';
  var recCol=cov.avgRec==null?'#94a3b8':cov.avgRec<=30?'#16a34a':cov.avgRec<=90?'#d97706':'#dc2626';
  var kpis='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    +kpi('Couverture exécutive',cov.coverage!=null?cov.coverage+'%':'—',covCol)
    +kpi('Décideurs haut niveau',cov.high+' <span style="font-size:11px;color:#94a3b8">C-level/N-1</span>','#6d28d9')
    +kpi('À rencontrer',String(cov.toMeet),cov.toMeet>0?'#b45309':'#16a34a')
    +kpi('Champions',String(cov.champions),cov.champions>0?'#16a34a':'#94a3b8')
    +kpi('Récence moyenne',cov.avgRec!=null?cov.avgRec+' j':'—',recCol)
    +'</div>';
  function recBadge(c){var d=contactRecencyDays(c);if(d==null)return '<span style="color:#cbd5e1">jamais</span>';var col=d<=30?'#16a34a':d<=90?'#d97706':'#dc2626';return '<span style="color:'+col+';font-weight:700">'+(d===0?'aujourd\'hui':'il y a '+d+' j')+'</span>';}
  var rows=cts.map(function(c){
    var h=hierObj(c.hierarchy_level),rel=relObj(c.relation),inf=(INFLUENCE.find(function(x){return x.id===c.influence;})||{}).lb;
    var na=contactNextAction(c.id);
    var relChip=rel?'<span style="background:'+rel.bg+';color:'+rel.fg+';font-size:10px;font-weight:800;padding:1px 8px;border-radius:99px">'+rel.lb+'</span>':'<span style="color:#cbd5e1">—</span>';
    var hChip=h?'<span style="background:#f5f3ff;color:#6d28d9;font-size:10px;font-weight:800;padding:1px 8px;border-radius:99px">'+h.short+'</span>':'<span style="color:#cbd5e1">—</span>';
    return '<tr>'
      +'<td><div style="font-weight:700;color:#0f172a">'+esc(ctFullName(c))+(c.a_rencontrer?' <span title="À rencontrer" style="font-size:11px">🎯</span>':'')+'</div><div style="font-size:11px;color:#94a3b8">'+esc(c.position||'')+'</div></td>'
      +'<td>'+hChip+'</td>'
      +'<td style="font-size:12px;color:#475569">'+esc((CONTACT_ROLES.find(function(x){return x.id===c.role_type;})||{}).lb||'—')+'</td>'
      +'<td style="font-size:12px;color:#475569">'+esc(inf||'—')+'</td>'
      +'<td>'+relChip+'</td>'
      +'<td style="font-size:12px;white-space:nowrap">'+recBadge(c)+'</td>'
      +'<td style="font-size:12px;color:#475569">'+(na?'<b>'+esc(na.title||'')+'</b> <span style="color:#94a3b8">· '+fDt(na.next_action_date)+'</span>':'<span style="color:#cbd5e1">—</span>')+'</td>'
      +'<td class="tr" style="white-space:nowrap"><button class="lb" data-act="plan-lobby-new" data-id="'+accId+'" data-ct="'+c.id+'" title="Planifier une action de relation" style="padding:2px 7px;margin-right:2px">📅</button><button class="lr" data-act="biz-edit-ct" data-id="'+c.id+'">✏️</button></td>'
      +'</tr>';
  }).join('');
  var table=cts.length
    ?'<div class="ov"><table><thead><tr><th>Interlocuteur</th><th>Niveau</th><th>Rôle</th><th>Influence</th><th>Relation</th><th>Dernier contact</th><th>Prochaine action de relation</th><th class="tr"></th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    :'<div class="emp">Aucun interlocuteur cartographié. Identifiez les décideurs et bâtissez le plan d\'accès.</div>';
  return '<div style="margin-bottom:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">🎯 Plan d\'influence / lobbying <span style="color:#94a3b8;font-weight:600">— accès aux décideurs : plus haut, plus tôt, plus souvent</span></div>'
    +'<button class="bp" data-act="plan-ct-new" data-id="'+accId+'" style="font-size:12px;padding:6px 12px">+ Interlocuteur</button></div>'
    +kpis+table+'</div>';
}

/* ── Comité de revue de compte (le rituel) ── */
function _dPlus(days){var d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function comiteStart(){var q=portfolioAccounts().filter(function(a){return planOrDefault(a.id).statut!=='dormant';}).map(function(a){return a.id;});if(!q.length){alert('Aucun compte à revoir.');return;}S.comiteQueue=q;S.comiteIdx=0;S.comiteDone=[];S.bizTab='plans';S.planView=null;render();}
function comiteStartOne(accId){S.comiteQueue=[accId];S.comiteIdx=0;S.comiteDone=[];S.bizTab='plans';S.planView=null;render();}
function comiteNext(){S.comiteIdx=(S.comiteIdx||0)+1;render();}
function comiteClose(){S.comiteQueue=null;S.comiteIdx=0;render();}
function comiteSaveNext(){
  var q=S.comiteQueue||[],idx=S.comiteIdx||0,accId=q[idx];if(!accId)return;
  var st=accSante(accId),pl=planForAccount(accId);
  /* Snapshot des engagements + taux de tenue figés à cette revue (courbe de fiabilité). */
  var engSnap=accActions(accId).map(function(k){return {id:k.id,title:k.title||'',assigned_to:k.assigned_to||'',verdict:actVerdict(k),due:k.next_action_date||null,done:actIsDone(k),biz:actBizLabel(k)};});
  var brType=gv('com-brtype')||'operationnelle';
  var rv={id:uid2(),account_id:accId,review_date:new Date().toISOString().slice(0,10),
    review_type:brType,participants:gv('com-part'),sante:st.code,ca_objectif:(pl?+pl.ca_objectif||null:null),
    er:accER(accId),dr:accDR(accId),ca_realise:accER(accId),pipeline:accPipelineCA(accId),
    landing_er:accLandingER(accId),landing_dr:accLandingDR(accId),
    engagements:engSnap,reliability:accReliability(accId).pct,
    decisions:gv('com-dec'),next_steps:gv('com-next'),created_by:S._userEmail||S.profileFirstName||''};
  S.accountReviews=(S.accountReviews||[]).concat([rv]);sbUpsertReview(rv);
  S.comiteDone=(S.comiteDone||[]).concat([rv.id]);
  /* Transformer les prochaines étapes en action de suivi planifiée. */
  var ns=gv('com-next'),mk=document.getElementById('com-mkact');
  if(ns&&mk&&mk.checked){
    var ka={id:uid2(),type:'relance',title:ns.slice(0,90),account_id:accId,contact_id:null,opportunity_id:null,status:'planifie',next_action:'',next_action_date:_dPlus(14),date_realised:null,assigned_to:(pl&&pl.owner_name)||'',notes:'Créée en comité du '+new Date().toISOString().slice(0,10)};
    S.bizActivities=(S.bizActivities||[]).concat([ka]);if(typeof sbUpsertAct==='function')sbUpsertAct(ka);
  }
  if(pl){
    /* Reprogramme la prochaine occurrence selon le type de BR revue. */
    if(brType==='strategique'){pl.next_br_strat=_dPlusMonths(6);}
    else{pl.prochaine_revue=_dPlusCadence(cadenceObj(pl.revue_cadence));}
    S.accountPlans=S.accountPlans.map(function(x){return x.account_id===accId?pl:x;});sbUpsertPlan(pl);
  }
  S.comiteIdx=idx+1;render();
}
function tComite(){
  var q=S.comiteQueue||[],idx=S.comiteIdx||0;
  if(idx>=q.length){
    var done=(S.comiteDone||[]);
    var recap=done.map(function(id){var r=(S.accountReviews||[]).find(function(x){return x.id===id;});if(!r)return '';var a=S.bizAccounts.find(function(x){return x.id===r.account_id;});
      return '<div style="background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:10px 12px;margin-bottom:8px"><b>'+esc(a?a.name:'')+'</b> '+santeDot(r.sante||'green')
        +(r.decisions?'<div style="font-size:12px;color:#475569;margin-top:3px">'+esc(r.decisions)+'</div>':'')+'</div>';}).join('');
    return '<div class="vw"><div class="pt">Comité de revue — terminé ✓</div><div class="ps">'+done.length+' revue(s) enregistrée(s) et historisée(s).</div>'
      +'<div style="margin:16px 0;display:flex;gap:10px;flex-wrap:wrap">'+(done.length?'<button class="bp" data-act="comite-export">📄 Exporter le compte rendu</button>':'')+'<button class="bg" data-act="comite-close">Terminer</button></div>'
      +recap+'</div>';
  }
  var accId=q[idx],a=S.bizAccounts.find(function(x){return x.id===accId;});
  if(!a){return '<div class="vw"><button class="bg" data-act="comite-close">Fermer</button></div>';}
  var pl=planOrDefault(accId),st=accSante(accId),obj=+pl.ca_objectif||0,er=accER(accId),dr=accDR(accId),pip=accPipelineCA(accId);
  var acts=accActions(accId),lateActs=acts.filter(actIsLate),openActs=acts.filter(actIsPlanned),doneActs=acts.filter(actIsDone);
  var rel=accReliability(accId);
  var lastRev=accReviews(accId)[0];
  var delta='';
  if(lastRev&&lastRev.er!=null){var dEr=er-(+lastRev.er||0),dDr=dr-(lastRev.dr!=null?+lastRev.dr:0);
    delta='<div style="margin-top:8px;font-size:12px;color:#a3e635;font-weight:700">Depuis la dernière revue : ER '+(dEr>=0?'+':'')+cEur(dEr)+' · DR '+(dDr>=0?'+':'')+cEur(dDr)+'</div>';}
  var prog='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">'
    +'<div class="pt">Comité de revue</div><div style="font-size:13px;color:#64748b;font-weight:700">Compte '+(idx+1)+' / '+q.length+'</div></div>';
  var hd='<div style="background:#1B2B3A;color:#fff;border-radius:12px;padding:16px 18px;margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div style="font-size:20px;font-weight:800">'+esc(a.name)+'</div>'+planStChip(pl.statut)
    +'<span style="margin-left:auto;font-size:13px;font-weight:800;color:'+st.color+';background:#fff;padding:3px 10px;border-radius:99px">'+st.lb+'</span></div>'
    +'<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:10px;font-size:13px;color:#cbd5e1">'
    +'<span>Objectif : <b style="color:#fff">'+(obj?cEur(obj):'—')+'</b></span><span>ER : <b style="color:#a3e635">'+cEur(er)+'</b></span><span>DR : <b style="color:#fff">'+cEur(dr)+'</b></span><span>Pipeline : <b style="color:#fff">'+cEur(pip)+'</b></span>'
    +'<span>Tenue : <b style="color:'+(rel.pct!=null&&rel.pct>=80?'#a3e635':rel.pct!=null&&rel.pct>=50?'#fcd34d':'#fca5a5')+'">'+(rel.pct!=null?rel.pct+'%':'—')+'</b>'+((lastRev&&lastRev.reliability!=null&&rel.pct!=null)?' <span style="color:'+(rel.pct-lastRev.reliability>=0?'#a3e635':'#fca5a5')+'">('+(rel.pct-lastRev.reliability>=0?'+':'')+(rel.pct-lastRev.reliability)+' pts)</span>':'')+'</span>'
    +(lastRev?'<span>Dernière revue : <b style="color:#fff">'+fDt(lastRev.review_date)+'</b></span>':'<span style="color:#94a3b8">Première revue</span>')+'</div>'+delta+'</div>';
  /* Boucle d'engagement : chaque action ouverte reçoit un verdict en séance. */
  var actLines=openActs.length?openActs.slice().sort(function(x,y){return (x.next_action_date||'9999').localeCompare(y.next_action_date||'9999');}).map(function(k){var late=actIsLate(k),rep=+k.reported_count||0;
    return '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid #f1f5f9;flex-wrap:wrap">'
      +'<span style="flex:1;min-width:150px;font-size:12px;color:#0f172a">'+esc(k.title||'')+(rep?' <span title="Reporté '+rep+' fois" style="background:#ffedd5;color:#c2410c;font-size:10px;font-weight:800;padding:1px 6px;border-radius:99px">×'+rep+'</span>':'')+'</span>'
      +'<span style="font-size:11px;white-space:nowrap;color:'+(late?'#dc2626':'#94a3b8')+';font-weight:'+(late?'800':'600')+'">'+(k.next_action_date?fDt(k.next_action_date):'—')+(late?' ⚠':'')+'</span>'
      +'<span style="display:flex;gap:4px">'
        +'<button class="lb" data-act="act-done" data-id="'+k.id+'" title="Tenu" style="padding:2px 8px;font-size:11px;color:#166534;border-color:#bbf7d0;background:#f0fdf4">✓ Tenu</button>'
        +'<button class="lb" data-act="act-report" data-id="'+k.id+'" title="Reporter d\'une semaine" style="padding:2px 8px;font-size:11px;color:#c2410c;border-color:#fed7aa;background:#fff7ed">⟳ Reporter</button>'
        +'<button class="lb" data-act="act-abandon" data-id="'+k.id+'" title="Abandonner" style="padding:2px 8px;font-size:11px;color:#64748b">✕</button>'
      +'</span></div>';
  }).join(''):'<div style="font-size:12px;color:#16a34a;margin-top:6px">Aucun engagement en cours. 👍</div>';
  var situ='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
    +'<div style="flex:2;min-width:300px;background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:12px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><div style="font-size:12px;font-weight:800;color:#0f172a">Engagements à valider <span style="color:#94a3b8;font-weight:600">— tenue '+(rel.pct!=null?rel.pct+'% ('+rel.kept+'/'+rel.total+')':'—')+'</span></div>'
      +'<button class="lb" data-act="plan-act-new" data-id="'+accId+'" style="font-size:11px;padding:3px 9px">+ Engagement</button></div>'+actLines+'</div>'
    +'<div style="flex:1;min-width:160px;background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:12px"><div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:4px">🎯 Relations clés</div>'
      +(function(){var cv=execCoverage(accId);return '<div style="font-size:12px;color:#475569">Couverture exécutive <b style="color:'+(cv.coverage==null?'#94a3b8':cv.coverage>=70?'#16a34a':cv.coverage>=40?'#d97706':'#dc2626')+'">'+(cv.coverage!=null?cv.coverage+'%':'—')+'</b> · Champions <b>'+cv.champions+'</b></div>'
        +'<div style="font-size:11px;color:#94a3b8;margin-top:4px">À rencontrer : '+(accContacts(accId).filter(function(c){return c.a_rencontrer;}).map(function(c){return esc(ctFullName(c));}).join(', ')||'—')+'</div>';})()+'</div>'
    +'</div>';
  /* Pipeline : opportunités ouvertes pondérées (bilan business de la BR). */
  var oppOpen=accOpenOpps(accId);
  var pipeBlock='<div style="background:#fff;border:1px solid #e5e9ee;border-radius:10px;padding:12px;margin-bottom:14px"><div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:4px">💼 Pipeline — '+cEur(pip)+' pondéré <span style="color:#94a3b8;font-weight:600">('+oppOpen.length+' opportunité(s))</span></div>'
    +(oppOpen.length?'<div style="font-size:12px;color:#475569">'+oppOpen.slice(0,6).map(function(o){return esc(o.name||'')+' <span style="color:#94a3b8">('+cEur(caPot(o))+' · '+(o.probability!=null?o.probability+'%':'—')+')</span>';}).join(' · ')+(oppOpen.length>6?' …':'')+'</div>':'<div style="font-size:12px;color:#94a3b8">Aucune opportunité ouverte.</div>')+'</div>';
  /* Type de Business Review par défaut : stratégique si compte stratégique et BR strat. due. */
  var dueStrat=pl.type==='strategique'&&(!pl.next_br_strat||pD(pl.next_br_strat)<=_today());
  var defBr=dueStrat?'strategique':'operationnelle';
  var brOpts=BR_TYPES.map(function(t){return '<option value="'+t.id+'"'+(t.id===defBr?' selected':'')+'>'+t.ic+' '+t.lb+' ('+t.cadence+')</option>';}).join('');
  var form='<div style="background:#fff;border:1px solid #e5e9ee;border-radius:12px;padding:14px 16px">'
    +'<div class="fd"><label class="fl">Type de Business Review</label><select class="ic" id="com-brtype">'+brOpts+'</select><p class="fh">Stratégique = revue semestrielle de fond (S1). Opérationnelle = revue trimestrielle d\'exécution (Q1).</p></div>'
    +'<div class="fd"><label class="fl">Participants</label><input class="ic" id="com-part" value="'+esc((lastRev&&lastRev.participants)||accTeam(accId).map(function(m){return m.member_name;}).join(', ')||pl.owner_name||'')+'" placeholder="Responsable de compte, direction commerciale…"></div>'
    +'<div class="fd"><label class="fl">Décisions prises en séance</label><textarea class="ic" id="com-dec" rows="3" placeholder="Ex : investir sur le programme conformité, staffer un architecte senior…"></textarea></div>'
    +'<div class="fd"><label class="fl">Prochaines étapes</label><textarea class="ic" id="com-next" rows="2" placeholder="Ex : RDV DSI avant fin de mois, proposition sous 3 semaines…"></textarea></div>'
    +'<div class="fd"><label class="cx" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="com-mkact" checked> Créer une <b>action de suivi</b> depuis « Prochaines étapes » (échéance +2 semaines)</label></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="bp" data-act="comite-save-next">✓ Enregistrer la revue &amp; suivant</button>'
    +'<button class="bg" data-act="comite-next">Passer</button><button class="bg" data-act="comite-close" style="margin-left:auto">Terminer le comité</button></div></div>';
  return '<div class="vw">'+prog+hd+situ+pipeBlock+form+'</div>';
}
/* Compte rendu de comité (imprimable / PDF via le navigateur). */
function comiteExport(){
  var ids=S.comiteDone||[];
  var revs=ids.map(function(id){return (S.accountReviews||[]).find(function(x){return x.id===id;});}).filter(Boolean);
  if(!revs.length){alert('Aucune revue à exporter.');return;}
  var org=(S.settings&&(S.settings.orgName||S.settings.companyName))||'';
  var today=new Date().toLocaleDateString('fr-FR');
  var rows=revs.map(function(r){var a=S.bizAccounts.find(function(x){return x.id===r.account_id;});var sc=SANTE[r.sante]||SANTE.green;
    var bt=brTypeObj(r.review_type);
    var engs=(r.engagements||[]);
    var kept=engs.filter(function(e){return e.verdict==='tenu'||e.verdict==='tenu_retard';}).length;
    var resolved=engs.filter(function(e){return e.verdict!=='a_venir';}).length;
    var engHtml=engs.length?('<table class="eng"><thead><tr><th>Engagement</th><th>Responsable</th><th>Pour quel biz</th><th>Verdict</th></tr></thead><tbody>'
      +engs.map(function(e){var v=(VERDICTS[e.verdict]||VERDICTS.a_venir);return '<tr><td>'+esc(e.title||'')+'</td><td>'+esc(e.assigned_to||'—')+'</td><td>'+esc(e.biz||'—')+'</td><td><span class="vv" style="background:'+v.bg+';color:'+v.c+'">'+v.lb+'</span></td></tr>';}).join('')
      +'</tbody></table>'):'<div class="sec">Aucun engagement suivi.</div>';
    return '<div class="card"><div class="ch"><div class="cn">'+esc(a?a.name:'')+' <span class="brt" style="color:'+bt.c+'">'+bt.ic+' '+bt.lb+'</span></div><div class="sd" style="background:'+sc.color+'">'+esc(sc.lb)+'</div></div>'
      +'<div class="mt">Revue du '+fDt(r.review_date)+(r.participants?' · Participants : '+esc(r.participants):'')+'</div>'
      +'<div class="sec"><span>Bilan business</span>Objectif ER <b>'+(r.ca_objectif?cEur(r.ca_objectif):'—')+'</b> · ER réalisé <b>'+cEur((r.er!=null?r.er:r.ca_realise)||0)+'</b> · DR <b>'+cEur(r.dr||0)+'</b>'
        +(r.pipeline!=null?' · Pipeline <b>'+cEur(r.pipeline)+'</b>':'')
        +((r.landing_er!=null||r.landing_dr!=null)?'<br>Atterrissage : ER <b>'+cEur(r.landing_er||0)+'</b>'+(r.ca_objectif?' (écart '+cEur((r.ca_objectif||0)-(r.landing_er||0))+')':'')+' · DR <b>'+cEur(r.landing_dr||0)+'</b>':'')+'</div>'
      +'<div class="sec"><span>Engagements — tenue '+(r.reliability!=null?r.reliability+'%':(resolved?Math.round(kept/resolved*100)+'%':'—'))+' ('+kept+'/'+resolved+')</span>'+engHtml+'</div>'
      +(r.decisions?'<div class="sec"><span>Décisions</span>'+esc(r.decisions)+'</div>':'')
      +(r.next_steps?'<div class="sec"><span>Prochaines étapes</span>'+esc(r.next_steps)+'</div>':'')+'</div>';}).join('');
  var html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Compte rendu de comité — '+esc(org||'Konsilys')+'</title><style>'
    +'*{box-sizing:border-box}body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111823;background:#f6f7f9;font-size:14px}'
    +'.wrap{max-width:860px;margin:0 auto;padding:28px}.bar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px}'
    +'.bar button{font:inherit;font-weight:700;font-size:13px;padding:8px 14px;border-radius:8px;border:1px solid #d9e0e6;background:#fff;cursor:pointer}.bar .p{background:#1B2B3A;color:#fff;border-color:#1B2B3A}'
    +'.hd{background:#1B2B3A;color:#fff;border-radius:14px;padding:20px 24px;margin-bottom:18px}.hd h1{margin:4px 0 0;font-size:22px}.hd .k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a3e635;font-weight:800}'
    +'.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:14px 16px;margin-bottom:12px}.ch{display:flex;justify-content:space-between;align-items:center}.cn{font-weight:800;font-size:16px}'
    +'.sd{color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:99px}.mt{font-size:12px;color:#64748b;margin-top:4px}'
    +'.sec{margin-top:8px;font-size:13px;color:#334155}.sec span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-bottom:2px}'
    +'.brt{font-size:12px;font-weight:800;margin-left:8px}'
    +'.eng{width:100%;border-collapse:collapse;margin-top:4px}.eng th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#94a3b8;padding:3px 6px;border-bottom:1px solid #e4e7ec}.eng td{font-size:12px;color:#334155;padding:4px 6px;border-bottom:1px solid #f1f5f9}'
    +'.vv{font-size:10px;font-weight:800;padding:1px 8px;border-radius:99px;white-space:nowrap}'
    +'@media print{.bar{display:none}body{background:#fff}}'
    +'</style></head><body><div class="wrap"><div class="bar"><button class="p" onclick="window.print()">🖨 Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div>'
    +'<div class="hd"><div class="k">'+(org?esc(org)+' · ':'')+'Comité de revue de comptes</div><h1>Compte rendu — '+esc(today)+'</h1></div>'
    +rows+'<div style="text-align:right;font-size:11px;color:#94a3b8;margin-top:14px">Généré via Konsilys · konsilys.fr</div></div></body></html>';
  var w=null;try{w=window.open('','_blank');}catch(e){}
  if(w&&w.document){w.document.open();w.document.write(html);w.document.close();}
  else{try{var b=new Blob([html],{type:'text/html;charset=utf-8'});var u=URL.createObjectURL(b);var el=document.createElement('a');el.href=u;el.download='compte-rendu-comite.html';document.body.appendChild(el);el.click();el.remove();URL.revokeObjectURL(u);}catch(e){alert('Autorisez les pop-ups pour ouvrir le compte rendu.');}}
}
