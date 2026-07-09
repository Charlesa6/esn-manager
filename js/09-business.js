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
    var [ra,rc,ro,rk]=await Promise.all([
      sb.from('crm_accounts').select('*').eq('company_id',SB_CID).order('name'),
      sb.from('crm_contacts').select('*').eq('company_id',SB_CID).order('last_name'),
      sb.from('crm_opportunities').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false}),
      sb.from('crm_activities').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false}),
    ]);
    if(ra.data)S.bizAccounts=ra.data;
    if(rc.data)S.bizContacts=rc.data;
    if(ro.data)S.bizOpps=ro.data;
    if(rk.data)S.bizActivities=rk.data;
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
    else{S.bizOpps=S.bizOpps.concat([o]);}sbUpsertOpp(o);}
  S.bizApprovals=S.bizApprovals.map(function(x){
    return x.id===id?Object.assign({},x,{status:approved?'approved':'rejected',reviewed_by:S._userEmail,motif_rejet:motif||null}):x;
  });
  if(sb&&SB_CID){await sb.from('crm_approvals').update({status:approved?'approved':'rejected',reviewed_by:S._userEmail||'',motif_rejet:motif||null}).eq('id',id);}
  render();
}
async function sbUpsertAcc(a){if(!sb||!SB_CID)return;return sb.from('crm_accounts').upsert(Object.assign({},a,{company_id:SB_CID}),{onConflict:'id'});}
async function sbUpsertCt(c){if(!sb||!SB_CID)return;return sb.from('crm_contacts').upsert(Object.assign({},c,{company_id:SB_CID}),{onConflict:'id'});}
async function sbUpsertOpp(o){
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
    req_min_years:+gv('biz-opp-minyears')||null,
    req_sector:gv('biz-opp-sector')||null,
    owner_email:it?(it.owner_email||S._userEmail||''):S._userEmail||'',
    owner_name:it?(it.owner_name||S.profileFirstName||''):S.profileFirstName||'',
    owner_role:it?(it.owner_role||S.role):S.role,
    owner_dir:it?(it.owner_dir||S.dirName||''):S.dirName||'', /* Gestionnaire du créateur */
    owner_vp:it?(it.owner_vp||S.vpName||''):S.vpName||'',   /* Admin du créateur */
    /* Unité : BU (niveau le plus fin) du créateur. Conservée telle quelle en édition. */
    bu_id:it?(it.bu_id||myBuId()):myBuId(),
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
  sbUpsertOpp(o);S.bizModal=null;render();
}
function bizSaveAct(){
  var it=S.bizModal&&S.bizModal.item;
  var k={
    id:it?it.id:uid2(),
    type:gv('biz-act-type')||'appel',
    title:gv('biz-act-title'),
    account_id:gv('biz-act-acc')||null,
    opportunity_id:gv('biz-act-opp')||null,
    contact_id:gv('biz-act-ct')||null,
    date_realised:gv('biz-act-date')||new Date().toISOString().slice(0,10),
    status:gv('biz-act-status')||'realise',
    next_action:gv('biz-act-next'),
    next_action_date:gv('biz-act-next-date')||null,
    assigned_to:gv('biz-act-assign'),
    notes:gv('biz-act-notes'),
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
  sbUpsertOpp(S.bizOpps.find(function(x){return x.id===oppId;}));
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
    +'<div><div class="pt">Business</div><div class="ps">CRM — Comptes · Contacts · Pipeline · Activités</div></div>'
    +addBtn()+'</div>'
    +subNav+content+'</div>';

  function addBtn(){
    var labels={pipeline:'+ Opportunité',comptes:'+ Compte',contacts:'+ Contact',activites:'+ Activité',kpis_biz:''};
    var lb=labels[S.bizTab||'pipeline']||'';
    if(!lb)return '';
    return '<button class="bp" data-act="biz-new" style="white-space:nowrap">'+lb+'</button>';
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

  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
    +'<div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
    +kbCard('Pipeline pondéré',fEur(pipeline_pond),'∑ CA × probabilité','#1B2B3A')
    +kbCard('Win Rate',total?Math.round(won.length/total*100)+'%':'—','Opportunités gagnées','#065f46')
    +kbCard('Durée moy. pipeline',pipeline.length?Math.round(pipeline.reduce(function(s,o){return s+(o.duree_mois||0);},0)/pipeline.length)+' mois':'—','','#5b21b6')
    +kbCard('CA gagné total',won.length?fEur(won.reduce(function(s,o){return s+caPot(o);},0)):'—','','#c2410c')
    +'</div>'+topHtml+'</div>'
    +'<div>'+funnelHtml+'</div></div>';
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
    /* Matching recrutement : expertise recherchée + localisation → candidats suggérés */
    if(S.bizModal.reqExp==null)S.bizModal.reqExp=((it.req_expertise)||[]).slice();
    if(S.bizModal.loc==null)S.bizModal.loc=(it.location||'');
    if(S.bizModal.minYears==null)S.bizModal.minYears=(+it.req_min_years||0);
    if(S.bizModal.sector==null)S.bizModal.sector=(it.req_sector||'');
    var _reqExp=S.bizModal.reqExp,_oppLoc=S.bizModal.loc,_minYears=+S.bizModal.minYears||0,_sector=S.bizModal.sector||'';
    var _expU={};(S.cands||[]).forEach(function(c){(c.expertise||[]).forEach(function(e){if(e)_expU[e]=1;});});((S._all&&S._all.cons)||S.cons||[]).forEach(function(c){(c.expertise||[]).forEach(function(e){if(e)_expU[e]=1;});});
    var _expList=Object.keys(_expU).sort();
    var _expChips=_expList.length?_expList.map(function(e){var on=_reqExp.indexOf(e)>=0;return '<button type="button" data-act="opp-exp-tog" data-id="'+esc(e)+'" style="padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid '+(on?'#0891b2':'#e2e8f0')+';background:'+(on?'#0891b2':'#fff')+';color:'+(on?'#fff':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(e)+'</button>';}).join(''):'<span style="font-size:12px;color:#94a3b8">Renseignez des expertises sur vos candidats/consultants pour activer le matching.</span>';
    var _locOpts='<option value="">— Indifférent —</option>'+REC_LOCATIONS.map(function(l){return '<option value="'+esc(l)+'"'+(_oppLoc===l?' selected':'')+'>'+esc(l)+'</option>';}).join('');
    var _secOpts='<option value="">— Indifférent —</option>'+SECTOR_LIST.map(function(s){return '<option value="'+esc(s)+'"'+(_sector===s?' selected':'')+'>'+esc(s)+'</option>';}).join('');
    var _nbActive=(_reqExp.length?1:0)+(_oppLoc?1:0)+(_minYears>0?1:0)+(_sector?1:0);
    /* Chip d'indicateur d'un critère : vert si satisfait, gris pâle sinon ; masqué si le critère n'est pas renseigné (ok===null) */
    var _chip=function(lb,tip,ok){return ok==null?'':'<span title="'+tip+'" style="color:'+(ok?'#16a34a':'#cbd5e1')+'">'+lb+'</span>';};
    var _sugg=oppMatches(_reqExp,_oppLoc,_minYears,_sector,+(it.tjm_cible||0),it.date_start||null);
    var _locStr=function(c){
      if(c.mobileFrance)return 'France entière';
      var t=c.locTarget||'';var n=(c.locSecondary||[]).length;
      if(t)return t+(n?' +'+n:'');
      return (c.locations||[]).join(', ')||'—';
    };
    var _card=function(mm){var c=mm.c;
      return '<div data-act="opp-see-cand" data-id="'+c.id+'" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;cursor:pointer;background:#fff">'
        +'<div style="min-width:0"><div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(c.name)+'</div>'
        +'<div style="font-size:11px;color:#64748b">'+esc(_locStr(c))+' · '+(c.yearsExp?c.yearsExp+' an'+(c.yearsExp>1?'s':''):'exp ?')+' · '+(mm.tjmC?mm.tjmC.toFixed(0)+' €/j':'TJM ?')+' · dispo '+(c.availDate?fDt(c.availDate):'?')+'</div></div>'
        +'<div style="display:flex;gap:7px;flex-shrink:0;font-size:11px;font-weight:700;align-items:center">'
        +_chip('💡'+mm.overlap.length,'Expertises en commun',mm.expOk)
        +(mm.locKind==='france'?_chip('🇫🇷','Mobile France entière',true):_chip('📍',mm.locKind==='secondary'?'Localisation secondaire (prêt à aller)':'Localisation cible (priorité)',mm.locOk))
        +_chip('⏳','Années d\'expérience',mm.yrsOk)
        +_chip('🏭','Secteur',mm.secOk)
        +'<span title="Prix (TJM revente ≤ cible)" style="color:'+(mm.priceOk===true?'#16a34a':mm.priceOk===false?'#dc2626':'#cbd5e1')+'">💶</span>'
        +'<span title="Disponible avant démarrage" style="color:'+(mm.availOk===true?'#16a34a':mm.availOk===false?'#dc2626':'#cbd5e1')+'">📅</span>'
        +'</div></div>';
    };
    var _suggHtml;
    if(!_nbActive){_suggHtml='<div style="font-size:12px;color:#94a3b8;padding:6px 0">Renseignez au moins un critère (expertise, localisation, années d\'expérience ou secteur) pour voir des candidats suggérés.</div>';}
    else if(!_sugg.length){_suggHtml='<div style="font-size:12px;color:#94a3b8;padding:6px 0">Aucun candidat ne correspond aux critères pour l\'instant.</div>';}
    else{
      var _grp={};_sugg.forEach(function(mm){(_grp[mm.matchCount]=_grp[mm.matchCount]||[]).push(mm);});
      var _ks=Object.keys(_grp).map(Number).sort(function(a,b){return b-a;});
      _suggHtml=_ks.map(function(k){
        var full=(k===_nbActive);
        var head='<div style="font-size:11px;font-weight:800;color:'+(full?'#16a34a':'#64748b')+';margin:10px 0 5px;display:flex;align-items:center;gap:6px">'
          +(full?'✅':'•')+' '+k+'/'+_nbActive+' critère'+(k>1?'s':'')+' <span style="font-weight:600;color:#94a3b8">('+_grp[k].length+' candidat'+(_grp[k].length>1?'s':'')+')</span></div>';
        return head+_grp[k].map(_card).join('');
      }).join('');
    }
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
      +'<div class="fd"><label class="fl">Localisation recherchée</label><select class="ic" id="biz-opp-loc" onchange="S.bizModal.loc=this.value;render()">'+_locOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Années d\'expérience (min.)</label><input class="ic" type="number" min="0" step="0.5" id="biz-opp-minyears" value="'+(_minYears||'')+'" placeholder="Ex : 5" onchange="S.bizModal.minYears=+this.value||0;render()"></div>'
      +'<div class="fd"><label class="fl">Secteur recherché</label><select class="ic" id="biz-opp-sector" onchange="S.bizModal.sector=this.value;render()">'+_secOpts+'</select></div>'
      +'<div class="fd cs2"><label class="fl">Expertise / compétences recherchées</label><div style="margin-top:4px">'+_expChips+'</div><p class="fh">Sert à suggérer des candidats du pipeline recrutement.</p></div>'
      +'<div class="fd cs2"><label class="fl">🎯 Candidats suggérés</label><div style="margin-top:4px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px">'+_suggHtml+'</div><p class="fh">Classés par nombre de critères satisfaits (expertise, localisation, années d\'expérience, secteur) ; 💶 prix et 📅 disponibilité servent de départage.</p></div>'
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
      +'<div class="fd"><label class="fl">Opportunité</label><select class="ic" id="biz-act-opp">'+oppOpts+'</select></div>'
      +'<div class="fd"><label class="fl">Date</label><input class="ic" type="date" id="biz-act-date" value="'+(it.date_realised||new Date().toISOString().slice(0,10))+'"></div>'
      +'<div class="fd"><label class="fl">Assigné à</label><input class="ic" id="biz-act-assign" value="'+esc(it.assigned_to||'')+'"></div>'
      +'<div class="fd"><label class="fl">Prochaine action</label><input class="ic" id="biz-act-next" value="'+esc(it.next_action||'')+'" placeholder="Ex: Envoyer proposition"></div>'
      +'<div class="fd"><label class="fl">Date prochaine action</label><input class="ic" type="date" id="biz-act-next-date" value="'+(it.next_action_date||'')+'"></div>'
      +'<div class="fd cs2"><label class="fl">Notes</label><textarea class="ic" id="biz-act-notes" rows="2">'+esc(it.notes||'')+'</textarea></div>'
      +'</div>';
  }

  return '<div class="mov"><div class="mob" style="max-width:680px">'
    +'<div class="moh"><div class="mot">'+title+'</div>'
    +'<button class="moc" onclick="S.bizModal=null;render()">✕</button></div>'
    +'<div class="mody" style="padding:20px">'+body
    +'<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">'
    +'<button class="bsec" onclick="S.bizModal=null;render()">Annuler</button>'
    +'<button class="bp" onclick="'+saveAction+'">Enregistrer</button>'
    +'</div></div></div></div>';
}




