'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   PERSISTENCE - localStorage auto + JSON export / import
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
var SKEY='esn_cgi_v1';

function saveLocal(){
  try{localStorage.setItem(SKEY,JSON.stringify({cons:S.cons,miss:S.miss,lvs:S.lvs,cands:S.cands}));}
  catch(e){console.warn('localStorage indisponible',e);}
}

function loadLocal(){
  try{
    var raw=localStorage.getItem(SKEY);
    if(!raw)return false;
    var d=JSON.parse(raw);
    if(d&&d.cons&&d.cons.length){S.cons=d.cons;S.miss=d.miss||[];S.lvs=d.lvs||[];S.cands=d.cands||[];return true;}
  }catch(e){}
  return false;
}

function exportJSON(){
  var d={version:1,exported:new Date().toISOString().slice(0,10),cons:S.cons,miss:S.miss,lvs:S.lvs};
  var blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download='esn_manager_'+d.exported+'.json';
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
}

function importJSON(file){
  if(!file)return;
  var r=new FileReader();
  r.onload=function(e){
    try{
      var d=JSON.parse(e.target.result);
      if(d&&d.cons&&d.miss){
        if(!confirm('Importer '+d.cons.length+' consultants et '+d.miss.length+' missions ?\n(Les données actuelles seront remplacées)'))return;
        S.cons=d.cons;S.miss=d.miss;S.lvs=d.lvs||[];
        saveLocal();render();
        alert('\u2705 Import r\u00e9ussi - '+d.cons.length+' consultants, '+d.miss.length+' missions'+(d.exported?' (sauvegarde du '+d.exported+')':'')+'.');
      }else{alert('\u274c Fichier invalide : structure non reconnue.');}
    }catch(err){alert('\u274c Erreur de lecture : '+err.message);}
  };
  r.readAsText(file);
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   SUPABASE - helpers (synchronisation non-bloquante)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function mapC(r){return{id:r.id,name:r.name,title:r.title||'',scr:r.scr||0,email:r.email||'',dir:r.directeur||'',managerId:r.manager_id||null,buId:r.bu_id||null,region:r.region||'',mobility:Array.isArray(r.mobility)?r.mobility:[],arrive:r.arrive||null,depart:r.depart||null,expertise:r.expertise||[],sectors:r.sectors||[],contract:r.contract||'salarie',grade:r.grade||''};}
function mapM(r){return{id:r.id,cid:r.consultant_id,name:r.name,cli:r.client_name||'',tjm:r.tjm||0,sd:r.start_date,ed:r.end_date||null,loc:r.location||'',mgr:r.manager_name||'',ccn:r.client_contact_name||'',ccr:r.client_contact_role||'',pcode:r.code_projet||'',btype:r.billing_type||'at',wdays:(Array.isArray(r.work_days)?r.work_days:(r.work_days?String(r.work_days).split(',').map(Number):[1,2,3,4,5])),wmode:r.wmode||'rec',manualDays:(Array.isArray(r.manual_days)?r.manual_days:[]),deal:r.deal_amount||0,tmar:(r.target_margin!=null?r.target_margin:null),team:r.team||[]};}
function mapL(r){return{id:r.id,cid:r.consultant_id,type:r.type||'Congé payé',s:r.start_date,e:r.end_date};}
function mapCand(r){return{
  id:r.id,name:r.name,email:r.email||'',phone:r.phone||'',
  locations:Array.isArray(r.locations)?r.locations:[],nationality:r.nationality||'',
  locTarget:r.loc_target||'',locSecondary:Array.isArray(r.loc_secondary)?r.loc_secondary:[],mobileFrance:!!r.mobile_france,
  availDate:r.avail_date||'',reqSalary:r.req_salary||0,
  yearsExp:r.years_exp||0,expertise:Array.isArray(r.expertise)?r.expertise:[],
  sectors:Array.isArray(r.sectors)?r.sectors:[],
  cvFiles:Array.isArray(r.cv_files)?r.cv_files:[],
  compteRendu:r.compte_rendu||'',compteRenduFilePath:r.compte_rendu_file_path||'',compteRenduFileName:r.compte_rendu_file_name||'',
  /* Comptes rendus multiples ; migration one-shot de l'ancien compte rendu unique */
  comptesRendus:(function(){
    var arr=Array.isArray(r.comptes_rendus)?r.comptes_rendus.slice():[];
    if(!arr.length&&(r.compte_rendu||r.compte_rendu_file_path)){
      arr=[{id:'cr_legacy',date:(r.created_at?String(r.created_at).slice(0,10):''),author:r.created_by||'',
        text:r.compte_rendu||'',fileName:r.compte_rendu_file_name||'',filePath:r.compte_rendu_file_path||''}];
    }
    return arr;
  })(),
  cgiMeetings:Array.isArray(r.cgi_meetings)?r.cgi_meetings:[],
  marginPct:(r.margin_pct!=null?r.margin_pct:25),
  /* Migrer anciens IDs vers nouveaux si nécessaire */
  status:(function(s){var m={'dmr_a':'rh_a','dmr_ec':'rh_ec','nogo_cgi':'nogo','offre':'pipe','recrute(e)':'recrute'};return m[s]||s||'rh_a';})( r.status||'rh_a'),
  createdBy:r.created_by||'',feedbacks:Array.isArray(r.feedbacks)?r.feedbacks:[],
  recruiter:r.recruiter||'',
  recruited:!!r.recruited,recruitStart:r.recruit_start||'',recruitPoste:r.recruit_poste||'',recruitDir:r.recruit_dir||'',consId:r.cons_id||null,
  buId:r.bu_id||null,
  experiences:Array.isArray(r.experiences)?r.experiences:[],
  cvProfile:(r.cv_profile&&typeof r.cv_profile==='object')?r.cv_profile:{}
};}

/* Écran plein affiché quand l'entreprise n'est pas encore payée (inactive).
   Propose de finaliser le paiement en rejouant le panier mémorisé (pending_cart)
   via seats-checkout, ou de se déconnecter. */
function showPaywall(co){
  var cart=(co&&co.pending_cart)||null;
  var canFinish=!!(cart&&cart.items&&cart.items.length);
  var canceled=!!(co&&co.canceled_at); // abonnement annulé : accès suspendu, données conservées
  var title=canceled?'Abonnement annulé':'Paiement à finaliser';
  var msg=canceled
    ? 'Votre abonnement a été annulé : l\'accès à votre espace est suspendu. Vos données sont conservées pendant 1 an. Pour réactiver votre espace, contactez contact@konsilys.fr.'
    : ('Votre espace Konsilys s\'ouvre dès que votre abonnement est réglé. '
       +(canFinish?'Finalisez votre paiement pour activer votre accès.':'Aucun paiement en attente n\'a été trouvé pour votre entreprise — contactez contact@konsilys.fr.'));
  var html=''
    +'<div style="position:fixed;inset:0;background:#0f1720;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;z-index:99999;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">'
    +'<div style="max-width:460px;text-align:center">'
    +'<div style="font-size:40px;margin-bottom:12px">🔒</div>'
    +'<h1 style="font-size:22px;font-weight:800;margin:0 0 10px">'+title+'</h1>'
    +'<p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin:0 0 22px">'+msg+'</p>'
    +((canFinish&&!canceled)?'<button id="pw-go" style="background:#84CC16;color:#0f1720;border:none;border-radius:10px;padding:14px 22px;font-size:15px;font-weight:800;cursor:pointer">Finaliser mon paiement →</button>':'')
    +'<div id="pw-msg" style="font-size:13px;color:#fca5a5;margin-top:12px;min-height:16px"></div>'
    +'<div style="margin-top:22px"><a href="#" id="pw-out" style="color:#94a3b8;font-size:13px;text-decoration:underline">Se déconnecter</a></div>'
    +'</div></div>';
  var host=document.createElement('div');host.innerHTML=html;document.body.appendChild(host);
  var out=document.getElementById('pw-out');
  if(out)out.onclick=function(e){e.preventDefault();try{sb.auth.signOut().then(function(){location.href='/login';});}catch(_e){location.href='/login';}};
  var go=document.getElementById('pw-go');
  if(go)go.onclick=async function(){
    go.disabled=true;go.textContent='Redirection…';
    var msg=document.getElementById('pw-msg');msg.textContent='';
    try{
      var ses=await sb.auth.getSession();
      var tok=ses&&ses.data&&ses.data.session&&ses.data.session.access_token;
      var r=await fetch('https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/seats-checkout',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify({items:cart.items,seats:cart.seats||[],success_url:location.origin+'/login?checkout=success',cancel_url:location.origin+'/app'})});
      var d=await r.json();
      if(d&&d.url){location.href=d.url;return;}
      msg.textContent=(d&&d.error)||'Erreur — réessayez.';go.disabled=false;go.textContent='Finaliser mon paiement →';
    }catch(e){msg.textContent='Erreur réseau — réessayez.';go.disabled=false;go.textContent='Finaliser mon paiement →';}
  };
}

/* Définit le N+1 d'un membre (via RPC sécurisée : vérifie rôle + même entreprise). */
function setNplus1(memberId, mgrId){
  if(!sb)return;
  var val=mgrId||null;
  sb.rpc('set_member_manager',{p_member:memberId,p_manager:val}).then(function(r){
    if(r&&r.error){if(typeof toast==='function')toast('Hiérarchie : '+r.error.message,'error');else alert('Hiérarchie : '+r.error.message);return;}
    var m=(S.orgProfiles||[]).find(function(p){return p.id===memberId;});
    if(m)m.manager_id=val;
    if(typeof toast==='function')toast(val?'Responsable (N+1) enregistré':'Responsable (N+1) retiré');
  });
}

/* Charge les sièges achetés (en attente/provisionnés) pour Gestion des accès. */
async function loadPendingSeats(){
  if(!sb||!SB_CID)return;
  try{
    var r=await sb.from('pending_seats').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false});
    if(r&&r.data)S.pendingSeats=r.data;
  }catch(e){console.warn('pendingSeats load:',e);}
}

/* Charge l'abonnement de l'entreprise (statut + date de fin) pour Gestion des accès. */
async function loadSubscription(){
  if(!sb||!SB_CID)return;
  try{
    var r=await sb.from('subscriptions').select('status,current_period_end,lines,created_at')
      .eq('company_id',SB_CID).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(r&&r.data)S.subscription=r.data;
  }catch(e){console.warn('subscription load:',e);}
}

/* ── Lecture paginée « tout » ───────────────────────────────────────────────
   PostgREST plafonne SILENCIEUSEMENT chaque `.select()` à 1000 lignes. À grande
   échelle (ex : CGI), les consultants/missions/absences seraient tronqués sans
   erreur. sbFetchAll rejoue la requête par pages de 1000 via `.range()` jusqu'à
   épuisement et renvoie l'ensemble complet — même forme {data,error} qu'un await
   de requête. `makeQuery` DOIT reconstruire une requête neuve à chaque appel (les
   builders Supabase ne sont pas réutilisables) et porter un tri déterministe
   (…order(...).order('id')) pour que la pagination soit stable.
   Pour <1000 lignes (cas courant), un seul aller-retour : comportement inchangé. */
async function sbFetchAll(makeQuery, pageSize){
  pageSize=pageSize||1000;
  var all=[], from=0;
  for(;;){
    var r=await makeQuery().range(from, from+pageSize-1);
    if(r.error)return {data:(all.length?all:null), error:r.error};
    var batch=r.data||[];
    all=all.concat(batch);
    if(batch.length<pageSize)break;      /* dernière page atteinte */
    from+=pageSize;
    if(from>500000)break;                /* garde-fou anti-boucle */
  }
  return {data:all, error:null};
}

/* Instantané d'agrégats exacts (montée en charge) — RPC company_kpi_snapshot.
   Cloisonné par entreprise côté serveur. Ne remplace aucun KPI calculé côté
   client ; alimente seulement S.kpiSnapshot quand KPI_SERVER_AGG est activé. */
async function loadKpiSnapshot(){
  if(!sb||!SB_CID)return null;
  try{
    var r=await sb.rpc('company_kpi_snapshot');
    if(!r.error&&r.data){S.kpiSnapshot=r.data;return r.data;}
  }catch(e){console.warn('kpi snapshot:',e);}
  return null;
}

/* Agrégat KPI entreprise calculé côté serveur (montée en charge), reproduisant
   tKPIs() — parité prouvée (exercice complet ET trimestre). Alimente S.companyKpis
   quand KPI_SERVER_AGG est activé ; ne remplace rien tant que le drapeau est off.
   En vue trimestre (S.quarter), la fenêtre borne tWD/CA/facturation mais le coût
   salarial reste proratisé sur l'exercice complet — d'où konsilys_company_kpis_range. */
async function loadCompanyKpis(){
  if(!sb||!SB_CID)return null;
  try{
    var fy=S.year||CFY;
    var r;
    if(S.quarter){
      var win=qRange(fy,S.quarter);
      r=await sb.rpc('konsilys_company_kpis_range',{p_win_start:win[0],p_win_end:win[1],p_fy_start:fyStart(fy),p_fy_end:fyEnd(fy)});
    }else{
      r=await sb.rpc('konsilys_company_kpis',{p_fy_start:fyStart(fy),p_fy_end:fyEnd(fy)});
    }
    if(!r.error&&r.data){
      S.companyKpis=r.data;
      /* Mémoriser la fenêtre calculée (exercice+trimestre) : tKPIs n'utilise
         l'agrégat serveur que s'il correspond à la vue courante. */
      S.companyKpisKey=fy+'|'+(S.quarter||'');
      return r.data;
    }
  }catch(e){console.warn('company kpis:',e);}
  return null;
}

/* Recharge l'agrégat serveur pour la fenêtre courante puis rafraîchit la vue.
   Appelé quand l'utilisateur change d'exercice ou de trimestre (sans effet si
   le drapeau est off — on garde le rendu synchrone habituel). */
function refreshServerKpis(){
  if(typeof KPI_SERVER_AGG!=='undefined'&&KPI_SERVER_AGG){loadCompanyKpis().then(function(){render();});}
}

async function loadSB(){
  if(!sb||!SB_CID)return false;
  try{
    /* ── Charger les paramètres de l'entreprise (pour tous les rôles) ── */
    try{
      /* Cache localStorage d\'abord pour un affichage immédiat */
      var _lsv=localStorage.getItem('esn_settings_'+SB_CID);
      if(_lsv)S.settings=Object.assign(S.settings,JSON.parse(_lsv));
      /* Puis Supabase pour avoir la version partagée à jour */
      var csr=await sb.from('company_settings').select('settings').eq('company_id',SB_CID).single();
      if(csr.data&&csr.data.settings){
        S.settings=Object.assign(S.settings,csr.data.settings);
        localStorage.setItem('esn_settings_'+SB_CID,JSON.stringify(S.settings));
      }
    }catch(e){/* table pas encore créée : utiliser les defaults */}

    /* ── Flags modules : source de vérité = table `companies` (lecture seule,
       non modifiable par les membres). Écrase toute valeur venue du JSON settings
       pour empêcher l'activation via la console. ── */
    try{
      var cmod=await sb.from('companies').select('has_business_module,has_recrutement_module').eq('id',SB_CID).single();
      if(cmod&&cmod.data){
        S.settings.hasBusinessModule=!!cmod.data.has_business_module;
        S.settings.hasRecrutementModule=!!cmod.data.has_recrutement_module;
      }
    }catch(e){/* colonnes pas encore présentes : conserver les defaults */}

    /* ── Business Units : source de vérité = table `business_units` (option
       robuste). On reconstruit S.settings.buTree au format historique
       [{id,name,parentId}] pour ne rien changer aux helpers buNodes()/buById()/
       buChildren(). Repli silencieux sur le buTree JSON tant que la table est vide
       (transition / entreprise sans BU). */
    try{
      var bur=await sb.from('business_units').select('id,name,parent_id').eq('company_id',SB_CID);
      if(bur&&bur.data&&bur.data.length){
        S.settings.buTree=bur.data.map(function(r){return {id:r.id,name:r.name,parentId:r.parent_id||null};});
      }
    }catch(e){/* table pas encore créée : repli sur le buTree JSON */}

    /* ── Charger l'annuaire des profils de l'organisation ──
       Nécessaire pour : résoudre le N+1, lister les pairs (délégation),
       remonter au N+2 si l'approbateur est absent. */
    try{
      var opr=await sbFetchAll(function(){return sb.from('profiles').select('id,first_name,last_name,role,manager_id,cons_id,bu_id,approval_delegate_to,approval_delegate_until').eq('company_id',SB_CID).order('id');});
      if(opr.data)S.orgProfiles=opr.data;
    }catch(e){console.warn('orgProfiles load:',e);S.orgProfiles=[];}

    /* Recalculer CFY avec le bon mois de départ */
    CFY=currentFY();
    rebuildQuarters(); /* T1/T2/T3/T4 selon le nouveau mois fiscal */
    applyRecStatuses(); /* Statuts recrutement custom */
    H=fyHols(S.year=S.year||CFY); /* réinitialiser les jours fériés avec le bon FY */
    /* un directeur ne charge que les consultants de son équipe (puis leurs missions/absences) */
    var cr=await sbFetchAll(function(){return sb.from('consultants').select('*').eq('company_id',SB_CID).order('name').order('id');});
    var cons=(cr.data||[]).map(mapC);

    /* ── Migration douce : peupler consultants.manager_id ──
       Fiches rattachées par nom (directeur === mon nom) sans manager_id → reçoivent mon id. */
    if((S.role==='gestionnaire'||S.role==='admin')&&S._userId&&S.dirName){
      try{
        var toFix=cons.filter(function(cc){return !cc.managerId && cc.dir===S.dirName && cc.id!==S.consId;});
        for(var _i=0;_i<toFix.length;_i++){
          await sb.from('consultants').update({manager_id:S._userId}).eq('id',toFix[_i].id);
          toFix[_i].managerId=S._userId;
        }
        if(toFix.length)console.log('[migration] '+toFix.length+' fiche(s) rattachée(s) par identifiant');
      }catch(e){console.warn('migration manager_id:',e);}
    }

    /* Gestionnaire : son équipe = ceux qu'il a invités (directeur = son nom) OU sa propre fiche.
       Le filtrage se fait côté client pour inclure sa propre fiche (self-service absences/missions). */
    if(S.role==='gestionnaire'){
      cons=cons.filter(function(cc){
        return cc.managerId===S._userId
          || (!cc.managerId && cc.dir===S.dirName)
          || cc.id===S.consId
          || cc.email===S._userEmail;
      });
    }
    /* Sales (Business Manager), Recruteur, Utilisateur : ne voient QUE leur propre fiche.
       Ils n'ont aucune visibilité sur les consultants de l'organisation. */
    if(S.role==='sales'||S.role==='recruteur'||S.role==='utilisateur'){
      cons=cons.filter(function(cc){ return cc.id===S.consId || cc.email===S._userEmail; });
    }
    /* Gestionnaire : missions/absences limitees a son equipe (ids). */
    var idsG=null;
    if(S.role==='gestionnaire'){
      idsG=cons.map(function(c){return c.id;});
      if(!idsG.length){S.cons=[];S.miss=[];S.lvs=[];return false;}
    }
    var _missB=function(){var q=sb.from('missions').select('*').eq('company_id',SB_CID);if(idsG)q=q.in('consultant_id',idsG);return q.order('id');};
    var _lvB=function(){var q=sb.from('leaves').select('*').eq('company_id',SB_CID);if(idsG)q=q.in('consultant_id',idsG);return q.order('id');};
    /* Recrutement : TOUJOURS visible pour toute l'entreprise, quel que soit le rôle
       ou le directeur connecté \u2014 jamais filtré par équipe */
    var _candB=function(){return sb.from('candidates').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false}).order('id',{ascending:false});};
    /* P&L Budget (Pilotage financier) : company-wide \u00e9galement */
    var res=await Promise.all([sbFetchAll(_missB),sbFetchAll(_lvB),sbFetchAll(_candB)]);
    S.cons=cons;
    if(res[0].data)S.miss=res[0].data.map(mapM);
    if(res[1].data)S.lvs=res[1].data.map(mapL);
    if(res[2].data)S.cands=res[2].data.map(mapCand);
    /* Charger les invites SVP directement dans loadSB pour senior_vp */
    if(S.role==='super_admin'){
      try{
        var rv=await sb.from('vp_invites').select('*').eq('company_id',SB_CID).order('created_at');
        if(rv.data)S.svpInvites=rv.data;
        var rd=await sb.from('directeur_invites').select('directeur_name,vp_name').eq('company_id',SB_CID).not('vp_name','is',null);
        if(rd.data){
          S.vpDirMap={};
          rd.data.forEach(function(r){
            if(r.vp_name){
              if(!S.vpDirMap[r.vp_name])S.vpDirMap[r.vp_name]=[];
              if(r.directeur_name&&S.vpDirMap[r.vp_name].indexOf(r.directeur_name)<0)
                S.vpDirMap[r.vp_name].push(r.directeur_name);
            }
          });
        }
      }catch(e){console.warn('SVP invites load:',e);}
    }
    /* Recruteurs : chargés pour tous les rôles (utilisé dans le modal candidat) */
    try{
      var rr=await sb.from('recruteur_invites').select('*').eq('company_id',SB_CID).order('created_at');
      if(rr.data)S.recruteurInvites=rr.data;
    }catch(e){console.warn('recruteur invites load:',e);}
    /* Invites unifiés (Sales, Gestionnaire, etc.) */
    try{
      var ri=await sb.from('invites').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false});
      if(ri.data)S.allInvites=ri.data;
    }catch(e){console.warn('invites load:',e);}
    /* Charger les données CRM Business */
    await loadBiz();
    await loadActivityLog();
    /* Agrégats serveur (montée en charge) — sans effet tant que le drapeau est off. */
    if(KPI_SERVER_AGG){await loadKpiSnapshot();await loadCompanyKpis();}
    return true;
  }catch(e){console.warn('Supabase load error:',e);return false;}
}

async function sbUpsertCons(c){
  if(!sb||!SB_CID)return;
  var res=await sb.from('consultants').upsert({id:c.id,company_id:SB_CID,name:c.name,title:c.title,scr:c.scr,email:c.email,directeur:c.dir||null,manager_id:c.managerId||null,bu_id:c.buId||null,region:c.region||null,mobility:c.mobility||[],arrive:c.arrive||null,depart:c.depart||null,expertise:c.expertise||[],sectors:c.sectors||[],contract:c.contract||'salarie',grade:c.grade||null});
  if(res.error)throw new Error(c.name+': '+res.error.message);
}
async function sbUpsertMiss(m){
  if(!sb)return;
  if(!SB_CID)throw new Error('SB_CID null — reconnectez-vous');
  var res=await sb.from('missions').upsert({id:m.id,company_id:SB_CID,consultant_id:m.cid,name:m.name,client_name:m.cli,tjm:m.tjm,start_date:m.sd,end_date:m.ed||null,location:m.loc,manager_name:m.mgr,client_contact_name:m.ccn,client_contact_role:m.ccr,billing_type:m.btype||'at',work_days:(m.wdays&&m.wdays.length?m.wdays:[1,2,3,4,5]),wmode:m.wmode||'rec',manual_days:(Array.isArray(m.manualDays)?m.manualDays:[]),deal_amount:(m.deal||null),target_margin:((m.tmar!=null&&m.tmar!=='')?m.tmar:null),code_projet:m.pcode||null,team:m.team||null});
  if(res.error)throw new Error(m.name+': '+res.error.message);
}
async function sbUpsertLeave(l){
  if(!sb||!SB_CID)return;
  var res=await sb.from('leaves').upsert({id:l.id,company_id:SB_CID,consultant_id:l.cid,type:l.type,start_date:l.s,end_date:l.e,approval_role:l.approval_role||null,approved:(l.approved!=null?l.approved:true)});
  if(res.error)throw new Error('Absence: '+res.error.message);
}
async function sbUpsertCand(c){
  if(!sb)return;
  if(!SB_CID)throw new Error('SB_CID null — reconnectez-vous');
  var res=await sb.from('candidates').upsert({
    id:c.id,company_id:SB_CID,name:c.name,email:c.email||null,phone:c.phone||null,
    locations:c.locations||[],nationality:c.nationality||null,
    loc_target:c.locTarget||null,loc_secondary:c.locSecondary||[],mobile_france:!!c.mobileFrance,
    avail_date:c.availDate||null,req_salary:c.reqSalary||0,years_exp:c.yearsExp||0,
    expertise:c.expertise||[],sectors:c.sectors||[],cv_files:c.cvFiles||[],
    /* Legacy nullifié : la source de vérité est désormais comptes_rendus (évite une re-migration) */
    compte_rendu:null,compte_rendu_file_path:null,compte_rendu_file_name:null,
    comptes_rendus:Array.isArray(c.comptesRendus)?c.comptesRendus:[],
    cgi_meetings:c.cgiMeetings||[],
    margin_pct:(c.marginPct!=null?c.marginPct:25),status:c.status||'nouveau',
    created_by:c.createdBy||null,feedbacks:c.feedbacks||[],
    recruiter:c.recruiter||null,
    recruited:!!c.recruited,recruit_start:c.recruitStart||null,recruit_poste:c.recruitPoste||null,recruit_dir:c.recruitDir||null,cons_id:c.consId||null,
    bu_id:c.buId||null,
    experiences:Array.isArray(c.experiences)?c.experiences:[],
    cv_profile:(c.cvProfile&&typeof c.cvProfile==='object')?c.cvProfile:{}
  });
  if(res.error)throw new Error(c.name+': '+res.error.message);
}

function toggleRecruited(){
  var cb=document.getElementById('rc-recruited');
  var fields=document.getElementById('rc-recruit-fields');
  if(fields)fields.style.display=(cb&&cb.checked)?'grid':'none';
}
function recCalcRefresh(){
  var sal=+gv('rcsal')||0;
  var marEl=document.getElementById('rcmar');
  var mar=marEl?+marEl.value:25;
  var scr=recScr(sal),tjm=recTjm(sal,mar);
  var mv=document.getElementById('rcMarVal');if(mv)mv.textContent=mar+'%';
  var out=document.getElementById('rcCalcOut');
  if(out)out.innerHTML='SCR journalier : <strong>'+scr.toFixed(0)+' \u20ac</strong> &nbsp;\u00b7&nbsp; TJM de revente (marge '+mar+'%) : <strong>'+tjm.toFixed(0)+' \u20ac</strong>';
}
async function sbDel(tbl,id){
  if(!sb)return;
  var res=await sb.from(tbl).delete().eq('id',id);
  if(res.error)console.warn('SB del:',res.error.message);
}

/* ── Directeurs : invitations (le gestionnaire pré-enregistre, le trigger rattache à l'inscription) ── */
async function loadInvites(){
  if(!sb||!SB_CID||(S.role!=='admin'&&S.role!=='super_admin'))return;
  try{var r=await sb.from('directeur_invites').select('*').eq('company_id',SB_CID).order('created_at');if(r.data)S.invites=r.data;}
  catch(e){console.warn('invites load:',e);}
}
async function sbInvite(email,name){
  if(!sb||!SB_CID)return{error:{message:'Supabase non configuré'}};
  return await sb.from('directeur_invites').insert({company_id:SB_CID,email:email,directeur_name:name,vp_name:S.vpName||null,status:'pending'});
}
async function sbDelInvite(id){
  if(!sb)return;
  var r=await sb.from('directeur_invites').delete().eq('id',id);
  if(r.error)console.warn('invite del:',r.error.message);
}
/* ── SVP : invitations Vice Présidents + Recruteurs ── */
async function loadSVPInvites(){
  if(!sb||!SB_CID||S.role!=='super_admin')return;
  try{
    var rv=await sb.from('vp_invites').select('*').eq('company_id',SB_CID).order('created_at');
    if(rv.data)S.svpInvites=rv.data;
    var rr=await sb.from('recruteur_invites').select('*').eq('company_id',SB_CID).order('created_at');
    if(rr.data)S.recruteurInvites=rr.data;
    /* Charger le mapping VP → directeurs (via directeur_invites.vp_name) */
    var rd=await sb.from('directeur_invites').select('directeur_name,vp_name').eq('company_id',SB_CID).not('vp_name','is',null);
    if(rd.data){
      S.vpDirMap={};
      rd.data.forEach(function(r){
        if(r.vp_name){
          if(!S.vpDirMap[r.vp_name])S.vpDirMap[r.vp_name]=[];
          if(r.directeur_name&&S.vpDirMap[r.vp_name].indexOf(r.directeur_name)<0)
            S.vpDirMap[r.vp_name].push(r.directeur_name);
        }
      });
    }
  }catch(e){console.warn('svp invites load:',e);}
}
async function sbSVPInviteVP(email,name){
  if(!sb||!SB_CID)return{error:{message:'Supabase non configur\u00e9'}};
  return await sb.from('vp_invites').insert({company_id:SB_CID,email:email,vp_name:name,status:'pending'});
}
async function sbSVPDelVP(id){
  if(!sb)return;
  await sb.from('vp_invites').delete().eq('id',id);
}
async function sbSVPInviteRec(email,name){
  if(!sb||!SB_CID)return{error:{message:'Supabase non configur\u00e9'}};
  return await sb.from('recruteur_invites').insert({company_id:SB_CID,email:email,recruteur_name:name,status:'pending'});
}
async function sbSVPDelRec(id){
  if(!sb)return;
  await sb.from('recruteur_invites').delete().eq('id',id);
}
/* Même mécanisme pour les consultants */
async function loadConsInvites(){
  if(!sb||!SB_CID||S.role!=='gestionnaire')return;
  try{
    var allC=(S._all&&S._all.cons)||S.cons;
    var r=await sb.from('consultant_invites').select('*').eq('company_id',SB_CID).eq('dir_name',S.dirName).order('created_at');
    if(r.data)S.consInvites=r.data;
  }catch(e){console.warn('consInvites load:',e);}
}

async function loadApprovals(){
  if(!sb||!SB_CID)return;
  try{
    var q=sb.from('approvals').select('*').eq('company_id',SB_CID);
    if(S.role==='gestionnaire')q=q.eq('dir_name',S.dirName);
    else if(S.role==='utilisateur'&&S.consId)q=q.eq('cons_id',S.consId);
    var r=await q.order('created_at',{ascending:false});
    if(r.error){
      console.error('[Approvals] Erreur:',r.error.message,'(table approvals existe-t-elle ?)');
      return;
    }
    if(r.data){
      S.approvals=r.data.map(function(d){
        return {
          id:d.id, type:d.type, status:d.status,
          consId:d.cons_id, consName:d.cons_name,
          dirName:d.dir_name, payload:d.payload,
          applyDesc:d.apply_desc, rejectionReason:d.rejection_reason||'',
          createdAt:d.created_at, resolvedAt:d.resolved_at
        };
      });
    }
  }catch(e){console.warn('[Approvals] Exception:',e.message);}
}
async function sbDelConsInvite(id){
  if(!sb)return;
  var r=await sb.from('consultant_invites').delete().eq('id',id);
  if(r.error)console.warn('consInvite del:',r.error.message);
}

async function syncToSB(){
  if(!sb){alert('Supabase non configuré.');return;}
  if(!SB_CID){alert('Session expirée - rechargez la page et reconnectez-vous via esn_login.html');return;}
  var btn=document.querySelector('[data-act="sync"]');
  if(btn){btn.textContent='Sync en cours...';btn.disabled=true;}
  try{
    for(var i=0;i<S.cons.length;i++) await sbUpsertCons(S.cons[i]);
    for(var i=0;i<S.miss.length;i++) await sbUpsertMiss(S.miss[i]);
    for(var i=0;i<S.lvs.length;i++) await sbUpsertLeave(S.lvs[i]);
    S.sbSync=false;
    S.sbSt='Supabase connecte - '+S.cons.length+' consultants';
    render();
  }catch(e){
    alert('Erreur sync : ' + e.message);
  }
  if(btn){btn.textContent='Synchroniser vers Supabase';btn.disabled=false;}
}

async function initApp(){
  /* ── Mode démo : ?demo=true dans l'URL → données fictives, pas de Supabase ── */
  if(new URLSearchParams(window.location.search).get('demo')==='true'){
    loadDemoData();
    render();
    return;
  }
  if(sb){
    try{
      /* ── 1. V\u00e9rifier la session (avec retry si timing issue) ── */
      var sess=await sb.auth.getSession();

      /* Si pas de session au 1er essai, attendre 1s et r\u00e9essayer
         (le token peut mettre un instant \u00e0 \u00eatre \u00e9crit dans localStorage apr\u00e8s redirect) */
      if(!sess.data||!sess.data.session){
        await new Promise(function(r){setTimeout(r,1000);});
        sess=await sb.auth.getSession();
      }

      if(!sess.data||!sess.data.session){
        window.location.href="/login";return;
      }

      /* ── 2. R\u00e9cup\u00e9rer company_id + r\u00f4le ── */
      var uid2=sess.data.session.user.id;
      S._userId=uid2;
      S._userEmail=sess.data.session.user.email||'';
      var pr=await sb.from('profiles').select('*').eq('id',uid2).single();
      if(pr.data&&pr.data.company_id){
        SB_CID=pr.data.company_id;
        S.role=pr.data.role==='gestionnaire'?'gestionnaire':pr.data.role==='directeur'?'gestionnaire':pr.data.role==='utilisateur'?'utilisateur':pr.data.role==='super_admin'?'super_admin':pr.data.role==='recruteur'?'recruteur':pr.data.role==='sales'?'sales':'admin';
          /* Nom du VP pour l'étiqueter dans directeur_invites */
          if(S.role==='admin'&&pr.data.first_name){S.vpName=(pr.data.first_name+' '+(pr.data.last_name||'')).trim();}
          S.profileFirstName=pr.data.first_name||'';
          S.profileLastName=pr.data.last_name||'';
          S.profileTitle=pr.data.title||''; 
        /* Pour un Gestionnaire/Admin, l'identité = prénom + nom du profil (source unique).
           dirName sert d'étiquette ET de clé de rattachement de son équipe. */
        var _fullName=((pr.data.first_name||'')+' '+(pr.data.last_name||'')).trim();
        if((S.role==='gestionnaire'||S.role==='admin')&&_fullName){
          S.dirName=_fullName;
        }else{
          S.dirName=pr.data.directeur_name||_fullName||'';
        }
        S.consId=pr.data.cons_id||null;
        S.managerId=pr.data.manager_id||null;              /* mon N+1 (identifiant) */
        S.approvalDelegateTo=pr.data.approval_delegate_to||null;   /* si J'AI délégué à quelqu'un */
        S.approvalDelegateUntil=pr.data.approval_delegate_until||null; /* date fin délégation (null=advitam) */
        S.leaveApprovalRole=pr.data.leave_approval_role||'super_admin'; /* legacy, conservé en fallback */
        if(S.role==='utilisateur'&&S.consId)S.tab='activite';

        /* Aligner directeur_name en base sur le nom réel (cohérence rattachements) */
        if((S.role==='gestionnaire'||S.role==='admin')&&_fullName&&pr.data.directeur_name!==_fullName){
          try{ await sb.from('profiles').update({directeur_name:_fullName}).eq('id',uid2); }catch(e){}
        }

        /* ── Synchronisation nom : la fiche équipe reflète TOUJOURS le profil ──
           Le nom/prénom du profil est la source de vérité unique. Si la fiche
           liée porte un nom différent, on la corrige silencieusement. */
        if(S.consId){
          try{
            var _profName=((pr.data.first_name||'')+' '+(pr.data.last_name||'')).trim();
            if(_profName){
              var _fc=await sb.from('consultants').select('name').eq('id',S.consId).maybeSingle();
              if(_fc&&_fc.data&&_fc.data.name!==_profName){
                await sb.from('consultants').update({name:_profName}).eq('id',S.consId);
              }
            }
          }catch(e){console.warn('sync nom fiche:',e);}
        }

        /* ── Auto-réparation : Admin/Gestionnaire sans fiche équipe liée ──
           Les comptes créés avant la refonte n'ont pas de cons_id. On retrouve
           leur fiche par email, sinon on la crée, puis on relie le profil.
           → Ils apparaissent alors dans les sélecteurs (moi) pour absences/missions. */
        if((S.role==='admin'||S.role==='gestionnaire')&&!S.consId){
          try{
            var selfName=((pr.data.first_name||'')+' '+(pr.data.last_name||'')).trim();
            var roleTitle=(S.role==='admin')?'Admin':'Gestionnaire';
            /* 1. Chercher une fiche existante par email */
            var exC=await sb.from('consultants').select('*').eq('company_id',SB_CID).eq('email',S._userEmail).maybeSingle();
            var myCons=(exC&&exC.data)?exC.data:null;
            /* 2. Sinon la créer */
            if(!myCons){
              var insC=await sb.from('consultants').insert({
                company_id:SB_CID,name:selfName||S._userEmail,title:roleTitle,
                email:S._userEmail,directeur:selfName,scr:0,contract:'salarie'
              }).select().single();
              if(insC&&insC.data)myCons=insC.data;
            }
            /* 3. Relier le profil à la fiche + SYNCHRONISER le nom (le profil fait foi) */
            if(myCons&&myCons.id){
              S.consId=myCons.id;
              await sb.from('profiles').update({cons_id:myCons.id}).eq('id',uid2);
              if(selfName && myCons.name!==selfName){
                await sb.from('consultants').update({name:selfName}).eq('id',myCons.id);
              }
            }
          }catch(e){console.warn('auto-réparation cons_id:',e);}
        }
      }else if(pr.data&&['sales','recruteur'].includes(pr.data.role)&&!pr.data.manager_id){
        /* Sales/Recruteur sans N+1 : récupérer l'inviteur depuis la table invites */
        try{
          var sinv=await sb.from('invites').select('invited_by_id,company_id,cons_id').eq('email',S._userEmail).maybeSingle();
          if(sinv&&sinv.data){
            if(sinv.data.invited_by_id){
              S.managerId=sinv.data.invited_by_id;
              await sb.from('profiles').update({manager_id:sinv.data.invited_by_id}).eq('id',uid2).catch(function(e){});
            }
            if(sinv.data.cons_id&&!S.consId){S.consId=sinv.data.cons_id;await sb.from('profiles').update({cons_id:sinv.data.cons_id}).eq('id',uid2).catch(function(e){});}
          }
        }catch(e){console.warn('sales manager resolve:',e);}
      }else if(pr.data&&pr.data.role==='utilisateur'){
        /* Consultant sans company_id : résoudre via le flux unifié 'invites',
           puis via l'ancien 'consultant_invites' en secours (comptes historiques). */
        try{
          /* 1. Nouveau flux : table invites (matching par email) */
          var uinv=await sb.from('invites').select('*').eq('email',S._userEmail).maybeSingle();
          if(uinv&&uinv.data&&uinv.data.company_id){
            SB_CID=uinv.data.company_id;
            S.role='utilisateur';
            S.consId=uinv.data.cons_id||pr.data.cons_id||null;
            S.managerId=uinv.data.invited_by_id||null;
            sb.from('profiles').update({company_id:uinv.data.company_id,cons_id:S.consId,manager_id:S.managerId}).eq('id',uid2).catch(function(e){});
            if(S.consId)S.tab='activite';
          }else{
            /* 2. Secours legacy : consultant_invites */
            var ci=await sb.from('consultant_invites').select('*').eq('email',S._userEmail).maybeSingle();
            if(ci&&ci.data&&ci.data.company_id){
              SB_CID=ci.data.company_id;
              S.role='utilisateur';
              S.dirName=ci.data.dir_name||pr.data.directeur_name||'';
              S.consId=ci.data.cons_id||pr.data.cons_id||null;
              sb.from('profiles').update({company_id:ci.data.company_id,directeur_name:S.dirName,cons_id:S.consId}).eq('id',uid2).catch(function(e){});
              if(S.consId)S.tab='activite';
            }
          }
        }catch(e){console.warn('user company resolve:',e);}
      }else{
        /* Fallback : chercher company_id directement dans companies */
        var cq=await sb.from('companies').select('id').eq('owner_id',uid2).single();
        if(cq.data)SB_CID=cq.data.id;
      }

      /* ── 3. Charger les donn\u00e9es depuis Supabase ── */
      try{ await sb.rpc('claim_subscription'); }catch(e){console.warn('claim_subscription:',e);}

      /* ── Verrou d'accès : une entreprise n'est utilisable qu'une fois payée.
         Les entreprises existantes sont actives (grandfathering). Une entreprise
         inactive = paiement non finalisé → écran de finalisation, on stoppe. ── */
      try{
        var _actv=await sb.from('companies').select('active,pending_cart,name,canceled_at').eq('id',SB_CID).maybeSingle();
        if(_actv&&_actv.data&&_actv.data.active===false){ showPaywall(_actv.data); return; }
      }catch(e){console.warn('active check:',e);}

      var ok=await loadSB();
      if(!ok){
        /* Supabase connecté mais sans données : nouvelle entreprise, pas de fallback localStorage */
        S.sbSt = 'Supabase connecté — aucune donnée pour cette entreprise';
      }else{
        S.sbSt='Supabase connect\u00e9';
        /* Fusionner le localStorage : r\u00e9cup\u00e9rer les entr\u00e9es locales non encore sync\u00e9es */
        try{
          var _raw=localStorage.getItem(SKEY);
          if(_raw){
            var _d=JSON.parse(_raw);
            if(_d){
              var _sbMids=new Set(S.miss.map(function(m){return m.id;}));
              var _localMiss=(_d.miss||[]).filter(function(m){return !_sbMids.has(m.id);});
              if(_localMiss.length){
                S.miss=S.miss.concat(_localMiss);
                _localMiss.forEach(function(m){sbUpsertMiss(m).catch(function(e){console.warn('merge-sync miss:',e);});});
              }
              var _sbCids=new Set(S.cons.map(function(c){return c.id;}));
              var _localCons=(_d.cons||[]).filter(function(c){return !_sbCids.has(c.id);});
              if(_localCons.length){
                S.cons=S.cons.concat(_localCons);
                _localCons.forEach(function(c){sbUpsertCons(c).catch(function(e){console.warn('merge-sync cons:',e);});});
              }
              var _sbLids=new Set(S.lvs.map(function(l){return l.id;}));
              var _localLvs=(_d.lvs||[]).filter(function(l){return !_sbLids.has(l.id);});
              if(_localLvs.length){
                S.lvs=S.lvs.concat(_localLvs);
                _localLvs.forEach(function(l){sbUpsertLeave(l).catch(function(e){console.warn('merge-sync lv:',e);});});
              }
              var _sbCandIds=new Set(S.cands.map(function(c){return c.id;}));
              var _localCands=(_d.cands||[]).filter(function(c){return !_sbCandIds.has(c.id);});
              if(_localCands.length){
                S.cands=S.cands.concat(_localCands);
                _localCands.forEach(function(c){sbUpsertCand(c).catch(function(e){console.warn('merge-sync cand:',e);});});
              }
            }
          }
        }catch(_e){console.warn('localStorage merge:',_e);}
      }

      await loadInvites();
      await loadConsInvites();
      await loadApprovals();

      /* ── 4. Listener pour d\u00e9connexion / expiration de token ── */
      sb.auth.onAuthStateChange(function(event){
        if(event==='SIGNED_OUT'){window.location.href="/login";}
      });

    }catch(err){
      console.error('initApp error:',err);
      /* En cas d\u2019erreur inattendue, charger en mode local plut\u00f4t que boucler */
      loadLocal();
    }
  }else{
    /* Supabase non configur\u00e9 - mode local */
    loadLocal();
  }
  render();
  /* Teams sync désactivé - intégration Azure Portal abandonnée */
}
/* FY helper : 'FY26' pour toute date Oct2025-Sep2026 */
function dateToFY(dateStr){
  if(!dateStr||dateStr.length<7)return null;
  var yr=parseInt(dateStr.substring(0,4));
  var mo=parseInt(dateStr.substring(5,7));
  return 'FY'+(mo>=10?yr+1:yr).toString().substring(2);
}
function fyLabelToYear(lbl){
  /* 'FY26' -> 2026 */
  return parseInt('20'+lbl.substring(2));
}


/* ══════ Fichiers candidats — Supabase Storage (bucket: candidate-files) ══════ */
async function uploadCandFile(file,candId,kind){
  if(!sb||!SB_CID)throw new Error('Supabase non connect\u00e9');
  if(!file)throw new Error('Aucun fichier');
  if(file.size>10*1024*1024)throw new Error('Fichier trop volumineux (max 10 Mo)');
  var safeName=String(file.name||'fichier').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80);
  var path=SB_CID+'/'+candId+'/'+kind+'_'+Date.now()+'_'+safeName;
  var r=await sb.storage.from('candidate-files').upload(path,file,{upsert:false});
  if(r.error)throw new Error('Upload \u00e9chou\u00e9 : '+r.error.message);
  return path;
}
function downloadCandFile(path,name){
  if(!sb){alert('Supabase non connect\u00e9');return;}
  sb.storage.from('candidate-files').createSignedUrl(path,3600).then(function(r){
    if(r.error||!r.data||!r.data.signedUrl){alert('T\u00e9l\u00e9chargement impossible : '+(r.error?r.error.message:'lien indisponible'));return;}
    var a=document.createElement('a');
    a.href=r.data.signedUrl;a.download=name||'fichier';a.target='_blank';a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
  });
}
function deleteCandFile(path){
  if(!sb||!path)return Promise.resolve();
  return sb.storage.from('candidate-files').remove([path]);
}
/* Aperçu d'un CV sans téléchargement : lien signé affiché dans une visionneuse
   (iframe pour PDF, image pour les images, message + téléchargement sinon). */
function closeCvPreview(){var b=document.getElementById('cvprev');if(b)b.innerHTML='';}
function openCvPreview(path,name){
  if(!sb){alert('Supabase non connecté');return;}
  sb.storage.from('candidate-files').createSignedUrl(path,3600).then(function(r){
    if(r.error||!r.data||!r.data.signedUrl){alert('Aperçu impossible : '+(r.error?r.error.message:'lien indisponible'));return;}
    var url=r.data.signedUrl, lc=(name||path||'').toLowerCase();
    var isPdf=/\.pdf(\?|#|$)/.test(lc), isImg=/\.(png|jpe?g|gif|webp)(\?|#|$)/.test(lc);
    var inner=isPdf?'<iframe src="'+url+'" title="CV" style="flex:1;width:100%;border:none;background:#fff"></iframe>'
      :isImg?'<div style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:16px"><img src="'+url+'" alt="CV" style="max-width:100%;max-height:100%;border-radius:8px"></div>'
      :'<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#94a3b8;padding:24px;text-align:center"><div style="font-size:40px">📄</div><div>Aperçu non disponible pour ce format (Word, etc.).<br>Utilisez « Télécharger » pour l\'ouvrir.</div></div>';
    var box=document.getElementById('cvprev');
    if(!box){box=document.createElement('div');box.id='cvprev';document.body.appendChild(box);}
    box.innerHTML='<div style="position:fixed;inset:0;background:rgba(2,6,23,.6);z-index:1600;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeCvPreview()">'
      +'<div style="background:#0f1720;border-radius:14px;width:min(920px,100%);height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)">'
      +'<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08)">'
      +'<span style="flex:1;color:#e8eef6;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(name||'CV')+'</span>'
      +'<a href="'+url+'" target="_blank" rel="noopener" download="'+esc(name||'cv')+'" style="background:#84CC16;color:#16240a;font-size:12px;font-weight:800;padding:7px 14px;border-radius:8px;text-decoration:none">⬇ Télécharger</a>'
      +'<button onclick="closeCvPreview()" aria-label="Fermer" style="background:rgba(255,255,255,.08);color:#e8eef6;border:none;border-radius:8px;width:32px;height:32px;font-size:15px;cursor:pointer">✕</button>'
      +'</div>'+inner+'</div></div>';
  });
}

/* ══ CV Entreprise : expériences structurées + génération au format de l'entreprise ══ */
function cvExpAdd(candId){var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;if(!Array.isArray(c.experiences))c.experiences=[];c.experiences.push({poste:'',client:'',dateStart:'',dateEnd:'',current:false,description:'',technos:''});render();}
function cvExpDel(candId,idx){var c=S.cands.find(function(x){return x.id===candId;});if(!c||!Array.isArray(c.experiences))return;c.experiences.splice(idx,1);render();}
function cvExpSet(candId,idx,field,val){var c=S.cands.find(function(x){return x.id===candId;});if(!c||!Array.isArray(c.experiences)||!c.experiences[idx])return;c.experiences[idx][field]=val;}
function cvExpSave(candId){var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;
  if(sb){sbUpsertCand(c).then(function(){toast('Expériences enregistrées');}).catch(function(e){toast('Échec : '+e.message,'error');});}
  else{toast('Expériences enregistrées (démo)');}
}
/* Profil du dossier de compétences (structure CGI) : titre, résumé, outils,
   environnements, langues, formation, spécialisations, et tableau « Résumé des
   compétences » (compétence / nombre d'années / niveau 1-4). Stocké dans cv_profile. */
function cvProf(c){if(!c.cvProfile||typeof c.cvProfile!=='object')c.cvProfile={};return c.cvProfile;}
function cvProfSet(candId,field,val){var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;cvProf(c)[field]=val;}
function cvSkillAdd(candId){var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;var p=cvProf(c);if(!Array.isArray(p.skills))p.skills=[];p.skills.push({skill:'',years:'',level:3});render();}
function cvSkillDel(candId,idx){var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;var p=cvProf(c);if(!Array.isArray(p.skills))return;p.skills.splice(idx,1);render();}
function cvSkillSet(candId,idx,field,val){var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;var p=cvProf(c);if(!Array.isArray(p.skills)||!p.skills[idx])return;p.skills[idx][field]=(field==='level'||field==='years')?(val===''?'':+val):val;}
function _lvlLbl(n){return['','Notions','Intermédiaire','Confirmé','Expert'][+n||3]||'Confirmé';}
function cvProfileFields(c){
  var p=cvProf(c);
  var skills=Array.isArray(p.skills)?p.skills:[];
  var q="'"+c.id+"'";
  function ta(field,label,ph,rows){return '<div style="margin-top:10px"><label class="fl">'+label+'</label><textarea class="ic" rows="'+(rows||2)+'" placeholder="'+ph+'" onchange="cvProfSet('+q+',\''+field+'\',this.value)">'+esc(p[field]||'')+'</textarea></div>';}
  function ip(field,label,ph){return '<div style="flex:1;min-width:200px"><label class="fl">'+label+'</label><input class="ic" value="'+esc(p[field]||'')+'" placeholder="'+ph+'" onchange="cvProfSet('+q+',\''+field+'\',this.value)"></div>';}
  var skillRows=skills.map(function(s,i){
    var lv=+s.level||3;
    var opts=[1,2,3,4].map(function(n){return '<option value="'+n+'"'+(lv===n?' selected':'')+'>'+n+' — '+_lvlLbl(n)+'</option>';}).join('');
    return '<tr>'
      +'<td style="padding:4px"><input class="ic" style="margin:0" value="'+esc(s.skill||'')+'" placeholder="Java, Gestion de projet…" onchange="cvSkillSet('+q+','+i+',\'skill\',this.value)"></td>'
      +'<td style="padding:4px;width:110px"><input class="ic" style="margin:0" type="number" min="0" step="1" value="'+esc(s.years===0||s.years?String(s.years):'')+'" placeholder="ans" onchange="cvSkillSet('+q+','+i+',\'years\',this.value)"></td>'
      +'<td style="padding:4px;width:190px"><select class="ic" style="margin:0" onchange="cvSkillSet('+q+','+i+',\'level\',this.value)">'+opts+'</select></td>'
      +'<td style="padding:4px;width:36px;text-align:center"><button class="lr" onclick="cvSkillDel('+q+','+i+')" title="Supprimer" style="padding:4px 8px">✕</button></td>'
      +'</tr>';
  }).join('');
  return '<details style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#fafbfc">'
    +'<summary style="cursor:pointer;font-size:13px;font-weight:800;color:#0f172a">🗂️ Profil du dossier de compétences <span style="font-weight:500;color:#94a3b8">(titre, synthèse, outils, langues, formation, niveaux)</span></summary>'
    +'<div style="margin-top:12px">'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'+ip('title','Titre / fonction','Consultant Data — Chef de projet')+ip('sectorExp','Secteur(s) d\'expérience','Banque, Assurance, Secteur public')+'</div>'
    +ta('summary','Profil (synthèse)','Résumé du parcours, points forts, posture…',3)
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">'+ip('tools','Outils & logiciels','Jira, Power BI, SAP, Office…')+ip('environments','Environnements techniques','Java, Spring, Azure, Docker…')+'</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">'+ip('languages','Langues','Français (natif), Anglais (courant)…')+ip('specializations','Spécialisations techniques','Data engineering, DevOps…')+'</div>'
    +ta('formation','Formation','Diplômes, écoles, années, certifications…',2)
    +'<div style="margin-top:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><label class="fl" style="margin:0">Résumé des compétences (niveau 1 à 4)</label><button class="bg" onclick="cvSkillAdd('+q+')" style="padding:5px 12px">+ Compétence</button></div>'
    +(skills.length?'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;color:#64748b"><th style="padding:4px;font-weight:700">Compétence</th><th style="padding:4px;font-weight:700">Années</th><th style="padding:4px;font-weight:700">Niveau</th><th></th></tr></thead><tbody>'+skillRows+'</tbody></table>':'<div style="font-size:12px;color:#94a3b8">Aucune compétence notée. Ajoutez-en pour la grille de synthèse du CV.</div>')
    +'</div>'
    +'</div></details>';
}
function cvExpSection(c){
  var exps=Array.isArray(c.experiences)?c.experiences:[];
  var cards=exps.map(function(e,i){
    var cid="'"+c.id+"',"+i;
    return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;background:#fafbfc">'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:180px"><label class="fl">Poste</label><input class="ic" value="'+esc(e.poste||'')+'" placeholder="Développeur Full-Stack" onchange="cvExpSet('+cid+',\'poste\',this.value)"></div>'
      +'<div style="flex:1;min-width:180px"><label class="fl">Client / entreprise</label><input class="ic" value="'+esc(e.client||'')+'" placeholder="BNP Paribas" onchange="cvExpSet('+cid+',\'client\',this.value)"></div>'
      +'</div>'
      +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;align-items:flex-end">'
      +'<div><label class="fl">Début</label><input class="ic" type="month" value="'+esc(e.dateStart||'')+'" onchange="cvExpSet('+cid+',\'dateStart\',this.value)"></div>'
      +'<div><label class="fl">Fin</label><input class="ic" type="month" value="'+esc(e.dateEnd||'')+'"'+(e.current?' disabled':'')+' onchange="cvExpSet('+cid+',\'dateEnd\',this.value)"></div>'
      +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;padding-bottom:9px;cursor:pointer"><input type="checkbox"'+(e.current?' checked':'')+' onchange="cvExpSet('+cid+',\'current\',this.checked);render()"> En poste</label>'
      +'</div>'
      +'<div style="margin-top:8px"><label class="fl">Description / missions</label><textarea class="ic" rows="3" placeholder="Missions, réalisations, contexte..." onchange="cvExpSet('+cid+',\'description\',this.value)">'+esc(e.description||'')+'</textarea></div>'
      +'<div style="margin-top:8px"><label class="fl">Technologies / compétences</label><input class="ic" value="'+esc(e.technos||'')+'" placeholder="React, Node.js, AWS..." onchange="cvExpSet('+cid+',\'technos\',this.value)"></div>'
      +'<div style="text-align:right;margin-top:8px"><button class="lr" data-act="cvexp-del" data-id="'+c.id+'" data-fb="'+i+'">Supprimer</button></div>'
      +'</div>';
  }).join('');
  var tpl=(S.settings&&S.settings.cvTemplate)||{};
  var hasTpl=!!tpl.docxPath;
  return '<div class="card" style="padding:24px;margin-top:18px;margin-bottom:18px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">Expériences ('+exps.length+') — dossier de compétences</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="bg" data-act="cvexp-ai" data-id="'+c.id+'" title="Analyse le CV PDF joint et pré-remplit les expériences (IA)">✨ Pré-remplir depuis le CV (IA)</button>'
    +'<button class="bg" data-act="cvexp-add" data-id="'+c.id+'">+ Ajouter</button>'
    +'<button class="bg" data-act="cvexp-save" data-id="'+c.id+'">💾 Enregistrer</button>'
    +(hasTpl?('<button class="bp" data-act="cv-word" data-id="'+c.id+'" title="Génère le CV au format du modèle Word de l\'entreprise">📄 CV Entreprise (Word)</button>'
      +'<button class="bp" data-act="cv-pdf" data-id="'+c.id+'" title="Aperçu / export PDF au format du modèle" style="background:#334155">📄 PDF</button>')
      :'<button class="bg" data-act="cv-entreprise" data-id="'+c.id+'" title="Aperçu générique (aucun modèle configuré)">📄 Aperçu CV</button>')
    +'</div></div>'
    +(hasTpl?'':'<div style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠ Aucun template CV configuré. Le super admin peut le définir dans Paramètres → Template CV entreprise.</div>')
    +cvProfileFields(c)
    +(cards||'<div class="emp">Aucune expérience. Ajoutez-en pour générer le CV Entreprise.</div>')
    +'</div>';
}
function _cvExpDate(e){
  var mm=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  function m(v){if(!v)return '';var p=(''+v).split('-');return (mm[(+p[1]||1)-1]||'')+' '+(p[0]||'');}
  var s=m(e.dateStart), en=e.current?'aujourd\'hui':m(e.dateEnd);
  return s&&en?(s+' → '+en):(s||en||'');
}
/* Génère le CV « Entreprise » au format dossier de compétences (structure inspirée
   du modèle CGI) : synthèse, expérience sectorielle, compétences, outils,
   environnements, langues, profil, expériences détaillées, formation /
   spécialisations, et grille « Résumé des compétences » (niveau 1 à 4). */
function _csv(v){return String(v||'').split(/[,;\n]/).map(function(s){return s.trim();}).filter(Boolean);}
function cvEntrepriseDoc(c){
  var t=(S.settings&&S.settings.cvTemplate)||{}, color=t.color||'#E2001A';
  var p=(c.cvProfile&&typeof c.cvProfile==='object')?c.cvProfile:{};
  var exps=Array.isArray(c.experiences)?c.experiences:[];
  var title=p.title||c.recruitPoste||(exps[0]&&exps[0].poste)||'';
  var sectors=(c.sectors&&c.sectors.length)?c.sectors:_csv(p.sectorExp);
  function chips(arr){return arr.map(function(x){return '<span class="chip">'+esc(x)+'</span>';}).join('');}
  function bullets(arr){return '<ul class="bl">'+arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>';}
  function block(t2,inner){return inner?'<section class="sec"><h2>'+t2+'</h2>'+inner+'</section>':'';}

  var expHtml=exps.map(function(e){
    var head=[e.client,e.poste].filter(Boolean).map(esc).join(' — ')||'Expérience';
    return '<div class="exp">'
      +'<div class="exp-h"><span class="exp-t">'+head+'</span><span class="exp-d">'+esc(_cvExpDate(e))+'</span></div>'
      +(e.description?'<div class="exp-b">'+esc(e.description)+'</div>':'')
      +(e.technos?'<div class="exp-tech"><strong>Environnement technique :</strong> '+esc(e.technos)+'</div>':'')
      +'</div>';
  }).join('')||'<div class="muted">Aucune expérience renseignée.</div>';

  var skills=Array.isArray(p.skills)?p.skills:[];
  var skillTable=skills.length?('<table class="skt"><thead><tr><th>Compétence</th><th>Années</th><th>Niveau de compétence*</th></tr></thead><tbody>'
    +skills.map(function(s){
      var lv=Math.max(1,Math.min(4,+s.level||3));
      var dots='';for(var i=1;i<=4;i++){dots+='<span class="dot'+(i<=lv?' on':'')+'"></span>';}
      return '<tr><td>'+esc(s.skill||'')+'</td><td class="ctr">'+(s.years===0||s.years?esc(String(s.years)):'—')+'</td><td><span class="lvl">'+dots+'</span> <span class="lvl-n">'+lv+' — '+_lvlLbl(lv)+'</span></td></tr>';
    }).join('')
    +'</tbody></table><div class="skt-note">* Niveau : 1 Notions · 2 Intermédiaire · 3 Confirmé · 4 Expert</div>'):'';

  var metaBits=[];
  if(c.yearsExp)metaBits.push('<strong>'+esc(String(c.yearsExp))+'</strong> ans d\'expérience');
  if(sectors.length)metaBits.push('secteur '+esc(sectors.join(', ')));
  var metaLine=metaBits.length?'<div class="years">'+metaBits.join(' — ')+'</div>':'';

  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier de compétences — '+esc(c.name||'')+'</title><style>'
    +'*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Calibri,Arial,sans-serif;color:#222;font-size:12.5px;line-height:1.5;background:#eef1f4}'
    +'.pg{max-width:820px;margin:24px auto;background:#fff;box-shadow:0 6px 30px rgba(0,0,0,.12)}'
    +'.hd{background:'+color+';color:#fff;padding:22px 34px;display:flex;align-items:center;gap:18px}'
    +'.hd img{max-height:46px;background:#fff;padding:4px 8px;border-radius:4px}.hd .co{font-size:22px;font-weight:800;letter-spacing:.5px}'
    +'.hd .co small{display:block;font-size:11px;font-weight:400;opacity:.85;letter-spacing:.06em;text-transform:uppercase}'
    +'.id{padding:24px 34px 6px}.id .name{font-size:24px;font-weight:800;color:#111}.id .role{font-size:14px;color:'+color+';font-weight:700;margin-top:2px}'
    +'.years{margin-top:6px;color:#555;font-size:12.5px}'
    +'.body{padding:6px 34px 30px}'
    +'.sec{margin-top:20px;page-break-inside:avoid}.sec h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:'+color+';padding-bottom:5px;border-bottom:2px solid '+color+';margin-bottom:10px}'
    +'.chip{display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:3px 9px;font-size:11.5px;margin:0 5px 5px 0}'
    +'.bl{margin:0;padding-left:18px}.bl li{margin:2px 0}'
    +'.two{display:flex;gap:26px;flex-wrap:wrap}.two>div{flex:1;min-width:220px}'
    +'.kv{margin:0;font-size:12.5px;white-space:pre-line}'
    +'.exp{margin-bottom:15px;padding-bottom:12px;border-bottom:1px dashed #e5e7eb}.exp:last-child{border-bottom:none}'
    +'.exp-h{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.exp-t{font-weight:800;color:#111}.exp-d{color:#666;font-size:11.5px;white-space:nowrap}'
    +'.exp-b{margin-top:4px;white-space:pre-line}.exp-tech{margin-top:5px;color:#444;font-size:11.5px}'
    +'.skt{width:100%;border-collapse:collapse;font-size:12px}.skt th{background:'+color+';color:#fff;text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}'
    +'.skt td{padding:6px 10px;border-bottom:1px solid #eee}.skt tr:nth-child(even) td{background:#fafafa}.skt .ctr{text-align:center}'
    +'.lvl{display:inline-flex;gap:3px;vertical-align:middle}.dot{width:11px;height:11px;border-radius:2px;background:#e5e7eb;display:inline-block}.dot.on{background:'+color+'}'
    +'.lvl-n{font-size:11px;color:#555;margin-left:6px}.skt-note{margin-top:6px;font-size:10.5px;color:#888}'
    +'.muted{color:#999}'
    +'.foot{margin-top:26px;border-top:1px solid #eee;padding-top:10px;color:#999;font-size:10px;text-align:center}'
    +'.bar{position:sticky;top:0;z-index:5;background:#111827;color:#fff;padding:10px;text-align:center;font-size:13px;font-weight:600}'
    +'.bar button{background:'+color+';color:#fff;border:none;border-radius:6px;padding:6px 16px;font-weight:800;cursor:pointer;margin-left:10px}'
    +'@media print{.bar{display:none}.pg{margin:0;box-shadow:none;max-width:none}body{background:#fff}}'
    +'</style></head><body>'
    +'<div class="bar">Aperçu du CV Entreprise — vérifiez avant diffusion <button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>'
    +'<div class="pg">'
    +'<div class="hd">'+(t.logo?'<img src="'+t.logo+'" alt="logo">':'')+'<span class="co">'+esc(t.name||'Dossier de compétences')+'<small>Dossier de compétences</small></span></div>'
    +'<div class="id"><div class="name">'+esc(c.name||'Candidat')+'</div>'
    +(title?'<div class="role">'+esc(title)+'</div>':'')
    +metaLine+'</div>'
    +'<div class="body">'
    +block('Profil',p.summary?'<div class="kv">'+esc(p.summary)+'</div>':'')
    +block('Expérience sectorielle',sectors.length?chips(sectors):'')
    +block('Compétences',(c.expertise&&c.expertise.length)?bullets(c.expertise):'')
    +block('Outils et logiciels',_csv(p.tools).length?chips(_csv(p.tools)):'')
    +block('Environnements techniques',_csv(p.environments).length?chips(_csv(p.environments)):'')
    +block('Langues',_csv(p.languages).length?chips(_csv(p.languages)):'')
    +block('Expériences professionnelles',expHtml)
    +((p.formation||p.specializations)?('<section class="sec"><h2>Formation & spécialisations</h2><div class="two">'
        +'<div><strong>Formation</strong><div class="kv">'+esc(p.formation||'—')+'</div></div>'
        +'<div><strong>Spécialisations techniques</strong><div class="kv">'+(_csv(p.specializations).length?chips(_csv(p.specializations)):'—')+'</div></div>'
        +'</div></section>'):'')
    +block('Résumé des compétences',skillTable)
    +(t.footer?'<div class="foot">'+esc(t.footer)+'</div>':'')
    +'</div></div></body></html>';
}
function openCvEntreprise(candId){
  var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;
  var w=window.open('','_blank');
  if(!w){alert('Autorisez les pop-ups pour afficher le CV Entreprise.');return;}
  w.document.open();w.document.write(cvEntrepriseDoc(c));w.document.close();
}

/* ══ Génération du CV au format du template Word de l'entreprise ══
   Le super admin dépose un modèle .docx contenant des balises ({nom}, {titre},
   {#experiences}…{/experiences}, etc.). On télécharge ce modèle, on le remplit
   avec les données du candidat via docxtemplater (CDN), et on renvoie soit le
   .docx rempli (fidèle à 100 %), soit un aperçu PDF (rendu via docx-preview). */
function _loadScriptChain(urls,cb,err){
  var i=0;
  (function tryOne(){
    if(i>=urls.length){if(err)err();return;}
    var s=document.createElement('script');s.src=urls[i++];
    s.onload=function(){cb();};
    s.onerror=function(){tryOne();};
    document.head.appendChild(s);
  })();
}
function loadDocxLibs(cb,err){
  if(window.PizZip&&window.docxtemplater){cb();return;}
  _loadScriptChain(['https://cdn.jsdelivr.net/npm/pizzip@3.1.7/dist/pizzip.min.js','https://cdnjs.cloudflare.com/ajax/libs/pizzip/3.1.7/pizzip.min.js'],function(){
    _loadScriptChain(['https://cdn.jsdelivr.net/npm/docxtemplater@3.50.0/build/docxtemplater.js','https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.50.0/docxtemplater.js'],function(){cb();},err);
  },err);
}
function _downloadBlob(blob,name){
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove();URL.revokeObjectURL(url);},1500);
}
/* Construit l'objet de données injecté dans le template Word. Les clés = les
   balises disponibles côté modèle (voir la référence affichée dans Paramètres). */
function _cvTemplateData(c){
  var p=(c.cvProfile&&typeof c.cvProfile==='object')?c.cvProfile:{};
  var exps=Array.isArray(c.experiences)?c.experiences:[];
  var sectors=(c.sectors&&c.sectors.length)?c.sectors:_csv(p.sectorExp);
  var comps=Array.isArray(p.skills)?p.skills:[];
  return {
    nom:c.name||'',
    titre:p.title||c.recruitPoste||(exps[0]&&exps[0].poste)||'',
    annees:c.yearsExp?String(c.yearsExp):'',
    profil:p.summary||'',
    secteurs:sectors.join(', '),
    competencesCles:(c.expertise||[]).join(', '),
    competencesListe:(c.expertise||[]).slice(),
    outils:p.tools||'',
    environnements:p.environments||'',
    langues:p.languages||'',
    formation:p.formation||'',
    specialisations:p.specializations||'',
    email:c.email||'',
    telephone:c.phone||'',
    localisation:c.locTarget||((c.locations||[])[0])||'',
    experiences:exps.map(function(e){return {
      poste:e.poste||'',client:e.client||'',dates:_cvExpDate(e),
      debut:e.dateStart||'',fin:e.current?'aujourd\'hui':(e.dateEnd||''),
      description:e.description||'',technos:e.technos||''
    };}),
    competences:comps.map(function(s){var lv=Math.max(1,Math.min(4,+s.level||3));return {
      competence:s.skill||'',nbAnnees:(s.years===0||s.years)?String(s.years):'',niveau:String(lv),niveauLabel:_lvlLbl(lv)
    };})
  };
}
function _docxErrMsg(e){
  try{
    if(e&&e.properties&&Array.isArray(e.properties.errors)&&e.properties.errors.length){
      return e.properties.errors.map(function(x){return (x.properties&&x.properties.explanation)||x.message;}).join(' ; ');
    }
  }catch(_){}
  return (e&&e.message)||String(e);
}
/* Télécharge le modèle .docx, le remplit, renvoie un Blob .docx (Promise). */
function _buildCvDocxBlob(c){
  return new Promise(function(resolve,reject){
    var t=(S.settings&&S.settings.cvTemplate)||{};
    if(!t.docxPath){reject(new Error('Aucun modèle Word configuré. Paramètres → Template CV entreprise.'));return;}
    if(!sb){reject(new Error('Indisponible en mode démo.'));return;}
    sb.storage.from('candidate-files').download(t.docxPath).then(function(dl){
      if(dl.error||!dl.data){reject(new Error('Modèle introuvable : '+(dl.error?dl.error.message:'')));return;}
      dl.data.arrayBuffer().then(function(buf){
        loadDocxLibs(function(){
          try{
            var zip=new window.PizZip(buf);
            var doc=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true});
            doc.render(_cvTemplateData(c));
            var blob=doc.getZip().generate({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
            resolve(blob);
          }catch(e){reject(new Error(_docxErrMsg(e)));}
        },function(){reject(new Error('Bibliothèque Word inaccessible (CDN).'));});
      },function(){reject(new Error('Lecture du modèle impossible.'));});
    },function(e){reject(new Error(e&&e.message||'Téléchargement du modèle impossible.'));});
  });
}
function genCvWord(candId){
  var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;
  toast('Génération du CV Word…');
  _buildCvDocxBlob(c).then(function(blob){
    _downloadBlob(blob,'CV_'+String(c.name||'candidat').replace(/[^\w-]+/g,'_')+'.docx');
    toast('CV Word généré ✓');
  }).catch(function(e){toast('Échec : '+(e&&e.message||e),'error');});
}
function genCvPdf(candId){
  var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;
  toast('Génération du CV (PDF)…');
  _buildCvDocxBlob(c).then(function(blob){
    window.__cvPdfBlob=blob;
    var w=window.open('','_blank');
    if(!w){toast('Autorisez les pop-ups pour l\'aperçu PDF.','error');return;}
    var nm=esc(c.name||'CV');
    var html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>CV — '+nm+'</title>'
      +'<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"><\/script>'
      +'<script src="https://cdn.jsdelivr.net/npm/docx-preview@0.3.5/dist/docx-preview.min.js"><\/script>'
      +'<style>*{box-sizing:border-box}body{margin:0;background:#e9edf2;font-family:Arial,sans-serif}'
      +'.bar{position:sticky;top:0;z-index:9;background:#111827;color:#fff;padding:10px;text-align:center;font-size:13px}'
      +'.bar button{background:#E2001A;color:#fff;border:none;border-radius:6px;padding:7px 16px;font-weight:800;cursor:pointer;margin-left:10px}'
      +'#c{padding:16px;display:flex;justify-content:center}#c .docx-wrapper{background:transparent;padding:0}'
      +'#msg{padding:30px;text-align:center;color:#475569}'
      +'@media print{.bar{display:none}body{background:#fff}#c{padding:0}}</style></head><body>'
      +'<div class="bar">Aperçu du CV — vérifiez avant diffusion <button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>'
      +'<div id="msg">Rendu du document…</div><div id="c"></div>'
      +'<script>(function(){var n=0;function go(){n++;if(!window.docx||!window.JSZip){if(n>60){document.getElementById("msg").textContent="Aperçu indisponible. Téléchargez le Word et exportez-le en PDF.";return;}return setTimeout(go,100);}var b=window.opener&&window.opener.__cvPdfBlob;if(!b){document.getElementById("msg").textContent="Document indisponible (rouvrez depuis la fiche).";return;}window.docx.renderAsync(b,document.getElementById("c"),null,{inWrapper:true,ignoreWidth:false,ignoreHeight:false}).then(function(){document.getElementById("msg").style.display="none";}).catch(function(e){document.getElementById("msg").textContent="Erreur de rendu : "+e;});}go();})();<\/script>'
      +'</body></html>';
    w.document.open();w.document.write(html);w.document.close();
    toast('Aperçu PDF ouvert');
  }).catch(function(e){toast('Échec : '+(e&&e.message||e),'error');});
}
/* Extraction IA : envoie le CV PDF à l'Edge Function extract-cv, qui interroge le
   modèle et renvoie des expériences structurées. Elles sont AJOUTÉES à la fiche
   (l'utilisateur relit puis enregistre). Nécessite ANTHROPIC_API_KEY côté serveur. */
async function extractCvIA(candId){
  var c=S.cands.find(function(x){return x.id===candId;});if(!c)return;
  if(!sb){toast('Extraction IA indisponible en mode démo','error');return;}
  var files=(c.cvFiles||[]);
  if(!files.length){toast('Aucun CV joint à ce candidat. Ajoutez d\'abord le CV (PDF) dans la fiche, puis réessayez.','error');return;}
  var hasPdf=files.some(function(f){return /\.pdf(\?|#|$)/i.test(f.fileName||f.filePath||'');});
  if(!hasPdf){toast('L\'extraction IA nécessite un CV au format PDF. Fichier(s) joint(s) : '+files.map(function(f){return f.fileName||f.filePath||'?';}).join(', '),'error');return;}
  toast('Analyse du CV en cours…');
  try{
    var ses=await sb.auth.getSession();
    var tok=(ses&&ses.data&&ses.data.session)?ses.data.session.access_token:'';
    var r=await fetch('https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/extract-cv',{
      method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({candId:candId})
    });
    var d=await r.json().catch(function(){return{};});
    if(!r.ok||d.error){toast('Extraction : '+(d.error||('erreur '+r.status)),'error');return;}
    var exps=Array.isArray(d.experiences)?d.experiences:[];
    var prof=(d.profile&&typeof d.profile==='object')?d.profile:null;
    if(!exps.length&&!prof){toast('Aucune expérience détectée dans le CV','error');return;}
    c.experiences=(Array.isArray(c.experiences)?c.experiences:[]).concat(exps);
    if(prof){
      var p=cvProf(c);
      ['title','summary','sectorExp','tools','environments','languages','formation','specializations'].forEach(function(k){if(prof[k]&&!p[k])p[k]=prof[k];});
      if(Array.isArray(prof.skills)&&prof.skills.length){if(!Array.isArray(p.skills))p.skills=[];p.skills=p.skills.concat(prof.skills);}
    }
    render();
    toast(exps.length+' expérience(s)'+(prof?' + profil':'')+' pré-remplies — relisez puis « Enregistrer »');
  }catch(e){toast('Erreur réseau : '+(e&&e.message||e),'error');}
}

function loadXLSX(cb){
  if(window.XLSX){cb();return;}
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload=function(){cb();};
  s.onerror=function(){
    /* Fallback sur un autre CDN */
    var s2=document.createElement('script');
    s2.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s2.onload=function(){cb();};
    s2.onerror=function(){
      alert('Impossible de charger la bibliothèque Excel.\n\nVérifiez votre connexion internet et rechargez la page.\n(CDN Cloudflare et jsDelivr tous deux inaccessibles)');
    };
    document.head.appendChild(s2);
  };
  document.head.appendChild(s);
}

function handleImpFile(file){
  if(!file)return;
  var ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].indexOf(ext)<0){alert('Format non support\u00e9. Utilisez .xlsx, .xls ou .csv');return;}
  loadXLSX(function(){
    var r=new FileReader();
    r.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        var data=rows.filter(function(row){return row.some(function(c){return c!=='';});});
        if(data.length<2){alert('Fichier vide ou non reconnu.');return;}
        var headers=data[0].map(function(h){return String(h||'').trim();});
        var am={};
        headers.forEach(function(h,i){
          var l=h.toLowerCase().replace(/\s+/g,' ').trim();
          if(am.cons===undefined&&(l==='nom'||l.includes('collaborateur')||l.includes('utilisateur')||l.includes('salarie')||l.includes('employe')))am.cons=i;
          if(am.typeAnal===undefined&&(l==='type anal.'||l==='type anal'||l.includes('type anal')))am.typeAnal=i;
          if(am.date===undefined&&(l==='trans date'||l==='trans. date'||l.includes('trans date')||l.includes('date')||l.includes('mois')||l.includes('periode')))am.date=i;
          if(am.montant===undefined&&(l==='foreign amount'||l.includes('foreign amount')||l.includes('montant')||l.includes('total')||l.includes('amount')||l.includes('facture')))am.montant=i;
          if(am.projet===undefined&&(l==='projet'||l==='project'||l.includes('projet')||l.includes('project code')))am.projet=i;
          if(am.nbj===undefined&&(l==='nbr of days'||l==='nb jours'||l.includes('nbr of days')||l.includes('nombre de jour')||l.includes('nb jour')||l==='qt\u00e9'||l==='qte'))am.nbj=i;
        });
        S.imp={file:file.name,sheet:wb.SheetNames[0],headers:headers,raw:data.slice(1),map:am,rows:[],results:null,selYear:'all'};
        render();
      }catch(err){alert('Erreur de lecture : '+err.message);}
    };
    r.readAsArrayBuffer(file);
  });
}

function applyImpMap(){
  try{
    var imp=S.imp;
    if(!imp){alert('Aucun fichier charg\u00e9.');return;}
    var cm={};
    ['cons','typeAnal','date','montant','projet'].forEach(function(f){
      var el=document.getElementById('im-'+f);
      if(el&&el.value!=='')cm[f]=parseInt(el.value);
    });
    if(cm.cons===undefined){alert('Colonne Consultant non s\u00e9lectionn\u00e9e.');return;}
    if(cm.montant===undefined){alert('Colonne Montant non s\u00e9lectionn\u00e9e.');return;}
    function parseName(raw){var s=String(raw||'').trim();var p=s.split(',');return p.length>=2?p[1].trim()+' '+p[0].trim():s;}
    function parseDate(v){if(!v)return '';if(v instanceof Date)return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');return String(v);}
    imp.rows=imp.raw.map(function(row){
      var tAnal=cm.typeAnal!==undefined?String(row[cm.typeAnal]||'').trim().toUpperCase():'SHR';
      var nom=parseName(row[cm.cons]);
      var montant=parseFloat(String(row[cm.montant]||'0').replace(',','.'))||0;
      var date=parseDate(cm.date!==undefined?row[cm.date]:null);
      var projet=cm.projet!==undefined?String(row[cm.projet]||'').trim():'';
      return{cons:nom,typeAnal:tAnal,montant:montant,date:date,projet:projet};
    }).filter(function(r){
      if(!r.cons)return false;
      if(cm.typeAnal!==undefined)return(r.typeAnal==='SHR'||r.typeAnal==='CST')&&r.montant!==0;
      return r.montant!==0;
    });
    if(imp.rows.length===0){alert('Aucune ligne SHR ou CST trouv\u00e9e.\nV\u00e9rifiez la colonne "Type ANAL".');return;}
    /* Pousser dans l\u2019historique */
    S.impHistory.push({id:uid(),file:imp.file,addedAt:fD(new Date()),rows:imp.rows,map:cm});
    S.imp=null;
    S.impView='pl';
    S.impSelFY='all';
    render();
  }catch(err){
    console.error('applyImpMap:',err);
    alert('Erreur :\n'+err.message+'\n\nF12 \u2192 Console pour le d\u00e9tail.');
  }
}

function clearImp(){S.imp=null;S.impView=S.impHistory.length>0?'pl':'import';render();}
function removeImpHistory(id){S.impHistory=S.impHistory.filter(function(h){return h.id!==id;});if(S.impHistory.length===0)S.impView='import';render();}
function clearAllImports(){if(confirm('Vider tout l\'historique des imports ?')){S.impHistory=[];S.impView='import';render();}}

/* ══════════════════════════════════
   IMPORT CONSULTANTS (Excel / CSV) — onboarding équipe
══════════════════════════════════ */
var CONS_IMPORT_FIELDS=[
  {k:'name',lb:'Nom complet',req:true,hint:'Ou renseignez Prénom + Nom séparés ci-dessous'},
  {k:'firstName',lb:'Prénom (si colonne séparée)'},
  {k:'lastName',lb:'Nom (si colonne séparée)'},
  {k:'email',lb:'Email'},
  {k:'title',lb:'Poste / Fonction'},
  {k:'dir',lb:'Directeur / N+1',hint:'Rattache automatiquement au manager si le nom correspond'},
  {k:'grade',lb:'Grade'},
  {k:'contract',lb:'Contrat'},
  {k:'scr',lb:'SCR (coût journalier)'},
  {k:'arrive',lb:'Date d\'arrivée'},
  {k:'depart',lb:'Date de départ'},
  {k:'expertise',lb:'Expertise'},
  {k:'sectors',lb:'Secteurs'}
];
function autoMapCons(headers){
  var am={},norm=headers.map(function(h){return String(h||'').toLowerCase().replace(/\s+/g,' ').trim();});
  function used(i){for(var kk in am){if(am[kk]===i)return true;}return false;}
  function exact(k,vals){if(am[k]!==undefined)return;for(var i=0;i<norm.length;i++){if(vals.indexOf(norm[i])>=0&&!used(i)){am[k]=i;return;}}}
  function inc(k,vals){if(am[k]!==undefined)return;for(var i=0;i<norm.length;i++){for(var j=0;j<vals.length;j++){if(norm[i].indexOf(vals[j])>=0&&!used(i)){am[k]=i;return;}}}}
  exact('firstName',['prénom','prenom','first name','firstname']);
  exact('lastName',['nom','last name','lastname','nom de famille']);
  exact('name',['nom complet','nom et prénom','collaborateur','consultant','name','full name']);
  inc('email',['email','mail','courriel']);
  inc('name',['collaborateur','consultant','salarié','salarie']);
  inc('title',['poste','fonction','titre','intitulé','intitule','title','job']);
  inc('dir',['directeur','manager','responsable','n+1','référent','referent','superviseur']);
  inc('grade',['grade','niveau','séniorité','seniorite','seniority','échelon','echelon']);
  inc('contract',['contrat','contract','statut']);
  inc('scr',['scr','coût','cout','cjm','salaire','daily cost']);
  inc('arrive',['arrivée','arrivee','entrée','entree','embauche','hire','début','debut']);
  inc('depart',['départ','depart','sortie','fin de contrat','fin contrat','end date']);
  inc('expertise',['expertise','compétence','competence','skill','techno','stack']);
  inc('sectors',['secteur','sector','industrie','industry','domaine']);
  return am;
}
/* ── Préréglages de mapping (par nom de colonne, réutilisables / partagés entreprise) ── */
function consPresets(){return (S.settings&&S.settings.importPresets)||[];}
function presetToMap(preset,headers){
  var norm=headers.map(function(h){return String(h||'').toLowerCase().trim();}),map={};
  Object.keys(preset.fields||{}).forEach(function(f){
    var idx=norm.indexOf(String(preset.fields[f]||'').toLowerCase().trim());
    if(idx>=0)map[f]=idx;
  });
  return map;
}
function bestPreset(headers){
  var norm=headers.map(function(h){return String(h||'').toLowerCase().trim();}),best=null,bestScore=0;
  consPresets().forEach(function(p){
    var sig=(p.headers||[]).map(function(h){return String(h||'').toLowerCase().trim();});
    if(!sig.length)return;
    var inter=sig.filter(function(h){return norm.indexOf(h)>=0;}).length,score=inter/sig.length;
    if(score>bestScore&&score>=0.6){bestScore=score;best=p;}
  });
  return best;
}
function persistImportPresets(){
  try{localStorage.setItem('esn_settings_'+SB_CID,JSON.stringify(S.settings));}catch(e){}
  if(!sb||!SB_CID)return;
  var _p=Object.assign({},S.settings);delete _p.hasBusinessModule;delete _p.hasRecrutementModule;
  sb.from('company_settings').upsert({company_id:SB_CID,settings:_p,updated_at:new Date().toISOString()},{onConflict:'company_id'}).then(function(){});
}
function readConsMap(){
  var cm={};CONS_IMPORT_FIELDS.forEach(function(f){var el=document.getElementById('cim-'+f.k);if(el&&el.value!=='')cm[f.k]=parseInt(el.value);});
  return cm;
}
function saveConsPreset(){
  var ci=S.consImp;if(!ci)return;
  var cm=readConsMap();
  if(!Object.keys(cm).length){alert('Configurez au moins une colonne avant d\'enregistrer un préréglage.');return;}
  var name=prompt('Nom du préréglage (ex : « Export RH — Client X », « Mon Excel interne ») :','');
  if(!name||!name.trim())return;
  name=name.trim();
  var fields={};Object.keys(cm).forEach(function(f){fields[f]=ci.headers[cm[f]];});
  if(!S.settings.importPresets)S.settings.importPresets=[];
  S.settings.importPresets=S.settings.importPresets.filter(function(p){return p.name!==name;});
  var id='ip_'+uid();
  S.settings.importPresets.push({id:id,name:name,fields:fields,headers:ci.headers.slice()});
  ci.presetId=id;ci.map=cm;ci.presetAuto=false;
  persistImportPresets();render();
}
function applyConsPreset(){
  var el=document.getElementById('cons-preset-sel'),id=el&&el.value;
  if(!id){alert('Choisissez un préréglage dans la liste.');return;}
  var p=consPresets().find(function(x){return x.id===id;});if(!p)return;
  var m=presetToMap(p,S.consImp.headers);
  var missing=Object.keys(p.fields||{}).filter(function(f){return m[f]===undefined;}).length;
  S.consImp.map=m;S.consImp.presetId=id;S.consImp.presetAuto=false;render();
  if(missing)alert('Préréglage appliqué. '+missing+' colonne(s) du préréglage absente(s) de ce fichier — vérifiez le mapping.');
}
function delConsPreset(){
  var el=document.getElementById('cons-preset-sel'),id=el&&el.value;
  if(!id){alert('Choisissez le préréglage à supprimer.');return;}
  var p=consPresets().find(function(x){return x.id===id;});
  if(!p||!confirm('Supprimer le préréglage « '+p.name+' » ?'))return;
  S.settings.importPresets=consPresets().filter(function(x){return x.id!==id;});
  if(S.consImp&&S.consImp.presetId===id)S.consImp.presetId=null;
  persistImportPresets();render();
}
function openImportCons(){S.consImp={file:'',headers:[],raw:[],map:{},rows:[],step:'upload',results:null};S.modal={type:'import_cons'};render();}
function handleConsImpFile(file){
  if(!file)return;
  var ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].indexOf(ext)<0){alert('Format non supporté. Utilisez .xlsx, .xls ou .csv');return;}
  loadXLSX(function(){
    var r=new FileReader();
    r.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        var data=rows.filter(function(row){return row.some(function(c){return String(c).trim()!=='';});});
        if(data.length<2){alert('Fichier vide ou sans lignes de données.');return;}
        var headers=data[0].map(function(h){return String(h||'').replace(/\s*\*/g,'').trim();});
        var _am=autoMapCons(headers),_bp=bestPreset(headers);
        if(_bp)_am=presetToMap(_bp,headers);
        S.consImp={file:file.name,headers:headers,raw:data.slice(1),map:_am,presetId:_bp?_bp.id:null,presetAuto:!!_bp,rows:[],step:'map',results:null};
        if(!S.modal||S.modal.type!=='import_cons')S.modal={type:'import_cons'};
        render();
      }catch(err){alert('Erreur de lecture : '+err.message);}
    };
    r.readAsArrayBuffer(file);
  });
}
function applyConsImp(){
  var ci=S.consImp;if(!ci)return;
  var cm={};
  CONS_IMPORT_FIELDS.forEach(function(f){var el=document.getElementById('cim-'+f.k);if(el&&el.value!=='')cm[f.k]=parseInt(el.value);});
  if(cm.name===undefined&&cm.firstName===undefined&&cm.lastName===undefined){alert('Sélectionnez au moins la colonne du nom.');return;}
  var existEmail={},existName={};
  ((S._all&&S._all.cons)||S.cons).forEach(function(c){if(c.email)existEmail[String(c.email).toLowerCase()]=true;if(c.name)existName[String(c.name).toLowerCase().trim()]=true;});
  function val(row,k){return cm[k]!==undefined?row[cm[k]]:'';}
  function parseName(raw){var s=String(raw||'').trim();if(s.indexOf(',')>=0){var p=s.split(',');return ((p[1]||'').trim()+' '+(p[0]||'').trim()).trim();}return s;}
  function toList(v){return String(v||'').split(/[,;/]+/).map(function(x){return x.trim();}).filter(Boolean);}
  function toNum(v){var n=parseFloat(String(v||'').replace(/[^\d.,-]/g,'').replace(',','.'));return isNaN(n)?0:n;}
  function pad(x){return String(x).length<2?'0'+x:String(x);}
  function toDate(v){
    if(!v)return '';
    if(v instanceof Date)return v.getFullYear()+'-'+pad(v.getMonth()+1)+'-'+pad(v.getDate());
    var s=String(v).trim();
    var m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(m){var y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+pad(m[2])+'-'+pad(m[1]);}
    var m2=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if(m2)return m2[1]+'-'+pad(m2[2])+'-'+pad(m2[3]);
    return '';
  }
  function normContract(v){var l=String(v||'').toLowerCase();if(l.indexOf('free')>=0||l.indexOf('indép')>=0||l.indexOf('indep')>=0)return 'freelance';if(l.indexOf('sous')>=0||l.indexOf('trait')>=0)return 'sous-traitant';if(l.indexOf('portage')>=0)return 'portage';return 'salarie';}
  var rows=ci.raw.map(function(row){
    var name=(cm.firstName!==undefined||cm.lastName!==undefined)
      ?((String(val(row,'firstName')||'').trim()+' '+String(val(row,'lastName')||'').trim()).trim())
      :parseName(val(row,'name'));
    var email=String(val(row,'email')||'').trim().toLowerCase();
    var o={name:name,email:email,title:String(val(row,'title')||'').trim(),dir:String(val(row,'dir')||'').trim(),
      grade:String(val(row,'grade')||'').trim(),contract:normContract(val(row,'contract')),scr:toNum(val(row,'scr')),
      arrive:toDate(val(row,'arrive')),depart:toDate(val(row,'depart')),expertise:toList(val(row,'expertise')),sectors:toList(val(row,'sectors'))};
    o._invalid=!o.name;
    o._dup=(email&&existEmail[email])||(!email&&!!o.name&&existName[o.name.toLowerCase().trim()]);
    return o;
  }).filter(function(o){return o.name||o.email;});
  ci.map=cm;ci.rows=rows;ci.step='preview';render();
}
function commitConsImp(){
  var ci=S.consImp;if(!ci||!ci.rows)return;
  if(!sb||!SB_CID){alert('Connexion Supabase requise pour importer.');return;}
  var toIns=ci.rows.filter(function(o){return !o._invalid&&!o._dup;});
  if(!toIns.length){alert('Aucune ligne à importer.');return;}
  var profByName={};
  (S.orgProfiles||[]).forEach(function(p){var n=((p.first_name||'')+' '+(p.last_name||'')).trim().toLowerCase();if(n)profByName[n]=p.id;});
  var payload=toIns.map(function(o){
    var mgr=o.dir?profByName[o.dir.toLowerCase().trim()]:null;
    return {company_id:SB_CID,name:o.name,title:o.title||null,email:o.email||null,directeur:o.dir||null,
      manager_id:mgr||null,scr:o.scr||0,arrive:o.arrive||null,depart:o.depart||null,
      expertise:o.expertise||[],sectors:o.sectors||[],contract:o.contract||'salarie',grade:o.grade||null};
  });
  ci.step='importing';render();
  sb.from('consultants').insert(payload).select().then(function(r){
    if(r.error){ci.results={ok:0,err:r.error.message};ci.step='result';render();return;}
    if(r.data){var mapped=r.data.map(mapC);S.cons=S.cons.concat(mapped);if(S._all&&S._all.cons)S._all.cons=S._all.cons.concat(mapped);}
    ci.results={ok:(r.data?r.data.length:payload.length),
      dup:ci.rows.filter(function(o){return o._dup;}).length,
      invalid:ci.rows.filter(function(o){return o._invalid;}).length};
    ci.step='result';render();
  });
}
function downloadConsTemplate(){
  var headers=['Nom complet','Email','Poste','Directeur','Grade','Contrat','SCR','Arrivée','Départ','Expertise','Secteurs'];
  var ex=['Sophie Martin','sophie.martin@exemple.com','Consultante Senior','Charles Allouard','Senior','salarie','450','2024-01-15','','Java; Spring','Banque, Assurance'];
  var csv=headers.join(';')+'\n'+ex.join(';')+'\n';
  var a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
  a.download='modele_import_consultants.csv';
  document.body.appendChild(a);a.click();a.remove();
}
function tImportConsBody(){
  var ci=S.consImp||{step:'upload'};var st=ci.step||'upload';
  if(st==='upload'){
    return '<div style="font-size:13px;color:#475569;margin-bottom:14px">Importez votre équipe depuis un export Excel (.xlsx) ou CSV — par ex. depuis Boond, un tableur RH, ou notre modèle. Les colonnes sont reconnues automatiquement, vous pourrez ajuster.</div>'
      +'<label style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer">📥 Choisir un fichier'
      +'<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleConsImpFile(this.files[0]);this.value=\'\'"></label>'
      +'<div style="margin-top:14px"><button class="bg" data-act="import-cons-tpl" style="font-size:12px">⬇ Télécharger le modèle</button></div>'
      +'<div style="margin-top:16px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:11px;color:#64748b">Colonnes reconnues : Nom, Email, Poste, Directeur/N+1, Grade, Contrat, SCR, Arrivée, Départ, Expertise, Secteurs. Seul le <strong>nom</strong> est obligatoire.</div>'
      +'<div class="br"><button class="bg" data-act="mc">Fermer</button></div>';
  }
  if(st==='map'){
    var opts=function(sel){return '<option value="">— Ignorer —</option>'+ci.headers.map(function(h,i){return '<option value="'+i+'"'+(sel===i?' selected':'')+'>'+esc(h||('Colonne '+(i+1)))+'</option>';}).join('');};
    var flds=CONS_IMPORT_FIELDS.map(function(f){
      return '<div class="fd"><label class="fl">'+esc(f.lb)+(f.req?' *':'')+'</label>'
        +'<select class="ic" id="cim-'+f.k+'">'+opts(ci.map[f.k])+'</select>'
        +(f.hint?'<p class="fh">'+esc(f.hint)+'</p>':'')+'</div>';
    }).join('');
    var presets=consPresets();
    var curName=ci.presetId&&(presets.find(function(p){return p.id===ci.presetId;})||{}).name;
    var presetBar=presets.length
      ?'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px">'
        +'<span style="font-size:12px;font-weight:700;color:#1e40af">📋 Préréglage :</span>'
        +'<select class="ic" id="cons-preset-sel" style="flex:1;min-width:160px;max-width:280px">'
        +'<option value="">— Choisir un préréglage —</option>'
        +presets.map(function(p){return '<option value="'+esc(p.id)+'"'+(ci.presetId===p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')
        +'</select>'
        +'<button class="bg" data-act="import-cons-preset-apply" style="font-size:12px">Appliquer</button>'
        +'<button class="bg" data-act="import-cons-preset-del" style="font-size:12px;color:#b91c1c;border-color:#fecaca">Suppr.</button>'
        +'</div>'
      :'';
    var autoBanner=(ci.presetAuto&&curName)
      ?'<div style="margin-bottom:12px;padding:9px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#15803d">✨ Préréglage « '+esc(curName)+' » reconnu et appliqué automatiquement. Vérifiez puis prévisualisez.</div>'
      :'';
    return '<div style="font-size:13px;color:#475569;margin-bottom:4px">Fichier : <strong>'+esc(ci.file)+'</strong> · '+ci.raw.length+' ligne'+(ci.raw.length>1?'s':'')+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-bottom:14px">Associez chaque champ à une colonne de votre fichier (pré-rempli automatiquement). Enregistrez ce mapping pour réimporter ce format en un clic la prochaine fois.</div>'
      +presetBar+autoBanner
      +'<div class="g2">'+flds+'</div>'
      +'<div style="margin-top:10px"><button class="bg" data-act="import-cons-preset-save" style="font-size:12px">💾 Enregistrer ce mapping comme préréglage</button></div>'
      +'<div class="br"><button class="bg" data-act="mc">Annuler</button><button class="bp" data-act="import-cons-map">Prévisualiser →</button></div>';
  }
  if(st==='preview'){
    var valid=ci.rows.filter(function(o){return !o._invalid&&!o._dup;});
    var dup=ci.rows.filter(function(o){return o._dup;});
    var inval=ci.rows.filter(function(o){return o._invalid;});
    var tr=ci.rows.slice(0,200).map(function(o){
      var tag=o._invalid?'<span style="color:#b91c1c">✕ sans nom</span>':o._dup?'<span style="color:#b45309">↔ doublon</span>':'<span style="color:#15803d">✓ nouveau</span>';
      var bg=o._invalid?'#fff1f2':o._dup?'#fffbeb':'#f0fdf4';
      return '<tr style="background:'+bg+'"><td style="padding:4px 8px;white-space:nowrap">'+tag+'</td><td style="padding:4px 8px">'+esc(o.name||'—')+'</td><td style="padding:4px 8px">'+esc(o.email||'')+'</td><td style="padding:4px 8px">'+esc(o.title||'')+'</td><td style="padding:4px 8px">'+esc(o.dir||'')+'</td><td style="padding:4px 8px">'+esc(o.contract||'')+'</td><td style="padding:4px 8px">'+(o.scr||'')+'</td></tr>';
    }).join('');
    return '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
      +'<span style="background:#f0fdf4;color:#15803d;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700">✓ '+valid.length+' à importer</span>'
      +'<span style="background:#fffbeb;color:#b45309;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700">↔ '+dup.length+' doublon(s)</span>'
      +'<span style="background:#fff1f2;color:#b91c1c;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700">✕ '+inval.length+' invalide(s)</span></div>'
      +'<div style="max-height:340px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="position:sticky;top:0;background:#f8fafc"><th style="padding:6px 8px;text-align:left">Statut</th><th style="padding:6px 8px;text-align:left">Nom</th><th style="padding:6px 8px;text-align:left">Email</th><th style="padding:6px 8px;text-align:left">Poste</th><th style="padding:6px 8px;text-align:left">Directeur</th><th style="padding:6px 8px;text-align:left">Contrat</th><th style="padding:6px 8px;text-align:left">SCR</th></tr></thead><tbody>'+tr+'</tbody></table></div>'
      +(ci.rows.length>200?'<div style="font-size:11px;color:#94a3b8;margin-top:6px">Aperçu limité à 200 lignes — toutes les valides seront importées.</div>':'')
      +'<div class="br"><button class="bg" data-act="import-cons-back">← Mapping</button><button class="bp" data-act="import-cons-commit"'+(valid.length?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>Importer '+valid.length+' consultant'+(valid.length>1?'s':'')+'</button></div>';
  }
  if(st==='importing'){
    return '<div style="text-align:center;padding:30px 0"><div style="font-size:40px">⏳</div><div style="margin-top:10px;font-size:14px;color:#0f172a;font-weight:700">Import en cours…</div></div>';
  }
  if(st==='result'){
    var rz=ci.results||{};
    if(rz.err)return '<div style="padding:16px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;color:#b91c1c;font-size:13px">✕ Erreur Supabase : '+esc(rz.err)+'</div><div class="br"><button class="bg" data-act="import-cons-back">← Retour</button><button class="bp" data-act="mc">Fermer</button></div>';
    return '<div style="text-align:center;padding:16px 0"><div style="font-size:44px">✅</div>'
      +'<div style="margin-top:8px;font-size:16px;font-weight:800;color:#0f172a">'+(rz.ok||0)+' consultant'+((rz.ok||0)>1?'s':'')+' importé'+((rz.ok||0)>1?'s':'')+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-top:6px">'+(rz.dup||0)+' doublon(s) ignoré(s) · '+(rz.invalid||0)+' invalide(s)</div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-top:8px">Les fiches apparaissent dans l\'onglet Équipe. Invitez maintenant les membres à créer leur compte, ou plus tard.</div></div>'
      +'<div class="br"><button class="bg" data-act="mc">Terminer</button><button class="bp" data-act="import-cons-invite">📨 Inviter en masse</button></div>';
  }
  return '';
}


/* ══════════════════════════════════
   IMPORT MISSIONS EN MASSE
══════════════════════════════════ */
function handleMissImpFile(file){
  if(!file)return;
  var ext=file.name.split('.').pop().toLowerCase();
  if(['xlsx','xls','csv'].indexOf(ext)<0){alert('Format non support\u00e9. Utilisez le template .xlsx fourni.');return;}
  loadXLSX(function(){
    var r=new FileReader();
    r.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
        var ws=wb.Sheets[wb.SheetNames[0]];
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        var hdrIdx=-1;
        for(var i=0;i<Math.min(rows.length,6);i++){
          if(rows[i].some(function(c){return String(c).toLowerCase().includes('utilisateur');})){hdrIdx=i;break;}
        }
        if(hdrIdx<0){alert('En-t\u00eate non trouv\u00e9. Utilisez le template fourni.');return;}
        var headers=rows[hdrIdx].map(function(h){return String(h||'').replace(/\s*\*/g,'').trim();});
        var data=rows.slice(hdrIdx+1).filter(function(r){return r.some(function(c){return String(c).trim()!=='';});});
        if(data.length===0){alert('Aucune ligne de donn\u00e9es trouv\u00e9e.');return;}
        var am={};
        headers.forEach(function(h,i){
          var l=h.toLowerCase();
          if(am.cons===undefined&&(l.includes('utilisateur')||l.includes('collaborateur')))am.cons=i;
          if(am.name===undefined&&(l.includes('nom')&&l.includes('mission')||l.includes('libell')))am.name=i;
          if(am.pcode===undefined&&(l.includes('code projet')||l.includes('psa')||l.includes('projet')))am.pcode=i;
          if(am.cli===undefined&&l.includes('client'))am.cli=i;
          if(am.tjm===undefined&&(l==='tjm'||l.includes('tjm')||l.includes('taux journal')))am.tjm=i;
          if(am.sd===undefined&&(l.includes('d\u00e9but')||l.includes('debut')||l.includes('start')))am.sd=i;
          if(am.ed===undefined&&(l.includes('date fin')||l.includes('end date')))am.ed=i;
          if(am.btype===undefined&&(l.includes('type')&&(l.includes('factu')||l.includes('billing')||l.includes('contract'))))am.btype=i;
          if(am.deal===undefined&&(l.includes('budget')||l.includes('forfait')&&l.includes('\u20ac')||l.includes('montant')))am.deal=i;
          if(am.wdays===undefined&&(l.includes('jours/sem')||l.includes('jour/sem')||l.includes('jours sem')||l.includes('working day')))am.wdays=i;
          if(am.loc===undefined&&(l.includes('lieu')||l==='location'))am.loc=i;
          if(am.mgr===undefined&&(l.includes('responsable')||l.includes('manager')))am.mgr=i;
          if(am.ccn===undefined&&(l.includes('contact')&&l.includes('nom')))am.ccn=i;
          if(am.ccr===undefined&&(l.includes('contact')&&(l.includes('r\u00f4le')||l.includes('role')||l.includes('poste'))))am.ccr=i;
        });
        S.missImp={file:file.name,headers:headers,raw:data,map:am,rows:[]};
        render();
      }catch(err){alert('Erreur de lecture : '+err.message);}
    };
    r.readAsArrayBuffer(file);
  });
}

function applyMissImp(){
  var mi=S.missImp;if(!mi)return;
  var cm={};
  ['cons','name','pcode','cli','tjm','sd','ed','btype','deal','wdays','loc','mgr','ccn','ccr'].forEach(function(f){
    var el=document.getElementById('mim-'+f);
    if(el&&el.value!=='')cm[f]=parseInt(el.value);
  });
  if(cm.cons===undefined){alert('Colonne Consultant obligatoire.');return;}
  if(cm.name===undefined){alert('Colonne Nom de mission obligatoire.');return;}
  if(cm.sd===undefined){alert('Colonne Date d\u00e9but obligatoire.');return;}

  function fmtDate(v){
    if(!v)return null;
    if(v instanceof Date)return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
    var s=String(v).trim();
    var m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    return s||null;
  }
  function norm(n){return String(n||'').toLowerCase().trim();}

  /* Parser les jours travaill\u00e9s
   * Entr\u00e9e : 5, 4, 3, 2, 1  ou  "L,M,Me,J,V"  ou  "Lun,Mar,..."
   * Sortie : tableau d\u2019entiers 1=Lun...5=Ven (0=Dim exclu par d\u00e9faut)
   */
  function parseWdays(v){
    if(!v&&v!==0)return [1,2,3,4,5];
    var s=String(v).trim().toLowerCase();
    var n=parseInt(s);
    if(!isNaN(n)&&n>=1&&n<=7)return [1,2,3,4,5].slice(0,n);
    var dayMap={l:1,lu:1,lun:1,lundi:1,m:2,ma:2,mar:2,mardi:2,me:3,mer:3,merc:3,mercredi:3,j:4,je:4,jeu:4,jeudi:4,v:5,ve:5,ven:5,vendredi:5,s:6,sa:6,sam:6,samedi:6};
    var parts=s.split(/[,;\s]+/).map(function(p){return p.trim();}).filter(Boolean);
    var res=[];
    parts.forEach(function(p){var d=dayMap[p];if(d&&res.indexOf(d)<0)res.push(d);});
    return res.length?res.sort():[1,2,3,4,5];
  }

  var created=0,skipped=[];
  mi.raw.forEach(function(row){
    var consName=String(row[cm.cons]||'').trim();
    var missName=String(row[cm.name]||'').trim();
    if(!consName||!missName)return;

    var consNorm=norm(consName);
    var found=S.cons.find(function(c){
      var cn=norm(c.name);var cp=cn.split(' ');var kp=consNorm.split(' ');
      var score=0;cp.forEach(function(p){if(p.length>2&&kp.indexOf(p)>=0)score++;});
      return score>=1||cn===consNorm;
    });
    if(!found){skipped.push(consName+' (consultant non trouv\u00e9)');return;}

    var sd=fmtDate(cm.sd!==undefined?row[cm.sd]:null);
    if(!sd){skipped.push(missName+' (date d\u00e9but manquante)');return;}

    /* Type facturation */
    var btypeRaw=cm.btype!==undefined?String(row[cm.btype]||'').toLowerCase().trim():'';
    var btype=btypeRaw.includes('forfait')?'forfait':'at';

    /* TJM */
    var tjm=cm.tjm!==undefined?parseFloat(String(row[cm.tjm]||'0').replace(',','.'))||0:0;

    /* Budget forfait */
    var deal=cm.deal!==undefined?parseFloat(String(row[cm.deal]||'').replace(',','.'))||null:null;

    /* Jours travaill\u00e9s */
    var wdaysRaw=cm.wdays!==undefined?row[cm.wdays]:5;
    var wdays=parseWdays(wdaysRaw);

    if(btype==='forfait'&&!deal){skipped.push(missName+' (forfait sans budget)');return;}
    if(btype==='at'&&tjm===0){skipped.push(missName+' (AT sans TJM)');return;}

    var pcode2=cm.pcode!==undefined?String(row[cm.pcode]||'').trim():'';

    /* D\u00e9doublon : ignorer si une mission identique existe d\u00e9j\u00e0
     * Crit\u00e8res :
     *   1. M\u00eame code projet (pcode) non vide
     *   2. M\u00eame consultant + m\u00eame nom de mission + m\u00eame date de d\u00e9but
     */
    var isDuplicate=S.miss.some(function(m){
      if(pcode2&&m.pcode&&m.pcode.trim().toLowerCase()===pcode2.toLowerCase())return true;
      return m.cid===found.id&&norm(m.name)===norm(missName)&&m.sd===sd;
    });
    if(isDuplicate){skipped.push(missName+' (d\u00e9j\u00e0 existante)');return;}

    var m2={
      id:uid(),cid:found.id,
      name:missName,
      pcode:cm.pcode!==undefined?String(row[cm.pcode]||'').trim():'',
      cli:cm.cli!==undefined?String(row[cm.cli]||'').trim():'',
      tjm:tjm,
      sd:sd,
      ed:fmtDate(cm.ed!==undefined?row[cm.ed]:null),
      btype:btype,
      deal:deal,
      tmar:null,
      wdays:wdays,
      loc:cm.loc!==undefined?String(row[cm.loc]||'').trim():'',
      mgr:cm.mgr!==undefined?String(row[cm.mgr]||'').trim():'',
      ccn:cm.ccn!==undefined?String(row[cm.ccn]||'').trim():'',
      ccr:cm.ccr!==undefined?String(row[cm.ccr]||'').trim():''
    };
    S.miss.push(m2);
    created++;
  });

  S.missImp=null;
  saveLocal();  /* sauvegarde locale imm\u00e9diate */
  var msg=created+' mission(s) ajout\u00e9e(s)';
  if(skipped.length)msg+='. Ignor\u00e9(s) :\n'+skipped.join('\n');

  /* Diagnostic */

  if(!sb){alert(msg+'\nLocalStorage uniquement (Supabase non configuré).');render();return;}
  if(!SB_CID){
    alert(msg+'\n\n⚠ SB_CID manquant (profil Supabase non chargé).\nLes missions sont sauvegardées localement.\nDéconnectez-vous et reconnectez-vous, puis cliquez "Synchroniser".');
    render();return;
  }

  var newMissions=S.miss.slice(-created);
  Promise.all(newMissions.map(function(m2){
    return sbUpsertMiss(m2);
  }))
  .then(function(){
    alert(msg+' - synchronisées dans Supabase ✓');
  })
  .catch(function(err){
    console.error('[import] Sync KO:', err);
    alert(msg+'\n\n⚠ Erreur Supabase : '+err.message+'\nCliquez "Synchroniser" dans la barre latérale pour réessayer.');
  });
  render();
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   PILOTAGE FINANCIER \u2014 Budget P&L (import + comparaison au r\u00e9el)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* ══════════════════════════════════════════════════════════════════════════════
   SYSTÈME D'APPROBATION — rôle consultant
   Flux : consultant soumet une demande → directeur approuve/refuse → notification
══════════════════════════════════════════════════════════════════════════════ */

/* Libellés lisibles pour les types d'approbation */
var APPROVAL_LABELS={
  'leave_add':'Ajout d\u2019absence',
  'leave_edit':'\u00c9dition d\u2019absence',
  'leave_del':'Suppression d\u2019absence',
  'miss_add':'Ajout de mission',
  'miss_edit':'\u00c9dition de mission',
  'miss_del':'Suppression de mission'
};

/* Créer et stocker une demande d'approbation au lieu d'appliquer directement */

/* ══════ Hiérarchie & approbation par identité (N+1) ══════ */
/* Profil d'un membre par id */
function profById(pid){ return (S.orgProfiles||[]).find(function(p){return p.id===pid;})||null; }
/* Nom lisible d'un profil */
function profName(p){ if(!p)return ''; return ((p.first_name||'')+' '+(p.last_name||'')).trim()||'(sans nom)'; }

/* Un enregistrement d'approbation (mission OU absence) m'est-il destiné ? (par identité) */
function _isMyApprovalRec(rec){
  var aid=rec.approver_id||rec.approverId||(rec.payload&&rec.payload.approver_id);
  if(aid)return aid===S._userId;
  /* Fallback legacy */
  if(rec.approval_role){var mr=S.role==='super_admin'?'super_admin':S.role==='admin'?'admin':S.role==='gestionnaire'?'gestionnaire':'';return rec.approval_role===mr;}
  if(rec.dirName!==undefined)return rec.dirName===S.dirName;
  return false;
}

/* Résout l'approbateur EFFECTIF d'un demandeur (remonte au N+2 si N+1 absent,
   suit la délégation active si l'approbateur a délégué). */
function resolveApprover(requesterId){
  var me=profById(requesterId); if(!me)return null;
  var mgrId=me.manager_id;
  /* Fallback : si pas de manager_id, le déduire de la fiche équipe (directeur → profil du gestionnaire) */
  if(!mgrId){
    var myCard=(S.cons||[]).find(function(cc){return cc.id===me.cons_id;});
    var dirName=myCard?myCard.dir:null;
    if(dirName){
      var mgrProf=(S.orgProfiles||[]).find(function(p){
        return ((p.first_name||'')+' '+(p.last_name||'')).trim()===dirName;
      });
      if(mgrProf)mgrId=mgrProf.id;
    }
  }
  /* Remonter tant que le manager n'existe plus dans l'org (parti) */
  var guard=0;
  while(mgrId && !profById(mgrId) && guard<10){ mgrId=null; guard++; }
  if(!mgrId)return null; /* pas de N+1 → Super Admin, pas d'approbation */
  /* Suivre la délégation active de l'approbateur */
  var mgr=profById(mgrId); guard=0;
  while(mgr && mgr.approval_delegate_to && guard<10){
    var stillValid = !mgr.approval_delegate_until || (mgr.approval_delegate_until >= new Date().toISOString().slice(0,10));
    if(!stillValid)break;
    var deleg=profById(mgr.approval_delegate_to);
    if(!deleg)break;
    mgrId=deleg.id; mgr=deleg; guard++;
  }
  return mgrId;
}
/* Mes pairs = membres ayant le même N+1 que moi (pour déléguer) */
function myPeers(){
  if(!S.managerId)return [];
  return (S.orgProfiles||[]).filter(function(p){
    return p.manager_id===S.managerId && p.id!==S._userId;
  });
}
/* Candidats à qui JE peux déléguer : mes pairs + mon N+1 */
function delegationCandidates(){
  var out=myPeers();
  var mgr=profById(S.managerId);
  if(mgr)out=out.concat([mgr]);
  return out;
}

function submitApproval(type, payload, applyDesc){
  var myC=(S._all||S).cons.find(function(c){return c.id===S.consId;})||{};
  var req={
    id:uid(),
    type:type,
    consId:S.consId,
    consName:myC.name||S._userEmail||'',
    dirName:myC.dir||'',
    requesterId:S._userId||null,                    /* qui demande (identité) */
    approverId:(payload&&payload.approver_id)||null, /* qui doit approuver (N+1 effectif) */
    payload:payload,
    applyDesc:applyDesc||'',
    status:'pending',
    rejectionReason:'',
    createdAt:new Date().toISOString(),
    resolvedAt:null
  };
  S.approvals=S.approvals.concat([req]);
  saveLocal();
  sbUpsertApproval(req).catch(function(e){console.warn('sbUpsertApproval:',e);});
  /* Pop-up de confirmation */
  S.modal={type:'approval_sent',desc:applyDesc};
  render();
}

/* Appliquer concrètement une modification après approbation */
function applyApproval(req){
  if(req.type==='leave_add'){
    var nl=Object.assign({},req.payload);
    S.lvs=S.lvs.concat([nl]);
    sbUpsertLeave(nl).catch(function(e){console.warn(e);});
  }else if(req.type==='leave_edit'){
    S.lvs=S.lvs.map(function(l){return l.id===req.payload.id?Object.assign({},req.payload):l;});
    sbUpsertLeave(req.payload).catch(function(e){console.warn(e);});
  }else if(req.type==='leave_del'){
    S.lvs=S.lvs.filter(function(l){return l.id!==req.payload.id;});
    sbDel('leaves',req.payload.id).catch(function(e){console.warn(e);});
  }else if(req.type==='miss_add'){
    var nm=Object.assign({},req.payload);
    S.miss=S.miss.concat([nm]);
    sbUpsertMiss(nm).catch(function(e){console.warn(e);});
  }else if(req.type==='miss_edit'){
    S.miss=S.miss.map(function(m){return m.id===req.payload.id?Object.assign({},req.payload):m;});
    sbUpsertMiss(req.payload).catch(function(e){console.warn(e);});
  }else if(req.type==='miss_del'){
    S.miss=S.miss.filter(function(m){return m.id!==req.payload.id;});
    sbDel('missions',req.payload.id).catch(function(e){console.warn(e);});
  }
}

/* Supabase : upsert d\'une approbation */
async function sbUpsertApproval(req){
  if(!sb||!SB_CID){console.warn('[Approval] SB_CID manquant');return;}
  var res=await sb.from('approvals').upsert({
    id:req.id,company_id:SB_CID,type:req.type,
    cons_id:req.consId,cons_name:req.consName,dir_name:req.dirName,
    payload:req.payload,apply_desc:req.applyDesc,
    status:req.status,rejection_reason:req.rejectionReason,
    created_at:req.createdAt,resolved_at:req.resolvedAt
  },{onConflict:'id'});
  if(res.error)console.error('[Approval] Erreur:',res.error.message);
}

/* ─── Vue Approbations pour le CONSULTANT ─── */
function tApprovals(){
  var myApprovalRoles=S.role==='super_admin'?['super_admin']:S.role==='admin'?['admin']:S.role==='gestionnaire'?['gestionnaire']:[];
  function _isMyApproval(rec){
    var aid=rec.approver_id||rec.approverId||(rec.payload&&rec.payload.approver_id);
    if(aid)return aid===S._userId;
    if(rec.approval_role)return myApprovalRoles.indexOf(rec.approval_role)>=0;
    return false;
  }
  var isValidator=myApprovalRoles.length>0;

  /* ── Bloc VALIDATEUR : demandes que je dois valider ── */
  var validatorHtml='';
  if(isValidator){
    var allLvs=(S._all&&S._all.lvs)||S.lvs;
    var pendingLv=allLvs.filter(function(lv){return _isMyApproval(lv)&&lv.approved===false;});
    var pending=S.approvals.filter(function(r){return r.status==='pending'&&_isMyApproval(r);}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
    var lvRows=pendingLv.map(function(lv){
      var who=((S._all&&S._all.cons)||S.cons).find(function(c){return c.id===lv.cid;});
      var roleLabel=lv.user_role?rLabel(lv.user_role):'?';
      return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:12px">'
        +'<div style="flex:1"><div style="font-size:13px;font-weight:700;color:#0f172a">Absence '+esc(roleLabel)+' — '+esc(lv.type)+'</div>'
        +'<div style="font-size:12px;color:#64748b;margin-top:3px">'+esc(who?who.name:lv.user_name||'?')+' · du '+fDt(lv.s)+' au '+fDt(lv.e)+'</div></div>'
        +'<div style="display:flex;gap:8px">'
        +'<button class="bp" style="background:#16a34a;font-size:12px;padding:6px 12px" onclick="approveLv(\''+lv.id+'\',true)">✓ Approuver</button>'
        +'<button class="bp" style="background:#dc2626;font-size:12px;padding:6px 12px" onclick="approveLv(\''+lv.id+'\',false)">✗ Refuser</button>'
        +'</div></div>';
    }).join('');
    var apprRows=pending.map(function(r){
      var dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('fr-FR'):'';
      return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
        +'<div style="flex:1">'
        +'<div style="font-size:13px;font-weight:700;color:#0f172a">'+esc(r.consName||'')+' — '+esc(APPROVAL_LABELS[r.type]||r.type)+'</div>'
        +'<div style="font-size:12px;color:#64748b;margin-top:3px">'+esc(r.applyDesc||'')+'</div>'
        +(dt?'<div style="font-size:11px;color:#94a3b8;margin-top:2px">Soumise le '+dt+'</div>':'')
        +'</div>'
        +'<div style="display:flex;gap:8px;flex-shrink:0">'
        +'<button class="bp" style="padding:6px 14px;font-size:12px" data-act="appr-ok" data-id="'+r.id+'">Approuver</button>'
        +'<button class="bg" style="padding:6px 14px;font-size:12px;color:#b91c1c;border-color:#fecdd3" data-act="appr-ko" data-id="'+r.id+'">Refuser</button>'
        +'</div></div></div>';
    }).join('');
    validatorHtml=
      (lvRows?'<div class="card" style="padding:20px;margin-bottom:16px"><div style="font-weight:700;color:#0f172a;margin-bottom:12px">⏳ Absences en attente ('+pendingLv.length+')</div>'+lvRows+'</div>':'')
      +(apprRows?'<div class="card" style="padding:20px;margin-bottom:16px"><div style="font-weight:700;color:#0f172a;margin-bottom:12px">⏳ Demandes en attente ('+pending.length+')</div>'+apprRows+'</div>':'')
      +((!lvRows&&!apprRows)?'<div class="emp" style="margin-bottom:8px">Aucune demande en attente de votre validation.</div>':'');
  }

  /* ── Bloc DEMANDEUR : mes propres demandes (tous rôles, y compris validateurs) ── */
  var mine=S.approvals.filter(function(r){return r.consId===S.consId;})
    .sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);});
  var pending2=mine.filter(function(r){return r.status==='pending';});
  var approved=mine.filter(function(r){return r.status==='approved';});
  var rejected=mine.filter(function(r){return r.status==='rejected';});

  function apRow(r){
    var bgCol=r.status==='approved'?'#f0fdf4':r.status==='rejected'?'#fff1f2':'#fffbeb';
    var bdCol=r.status==='approved'?'#bbf7d0':r.status==='rejected'?'#fecdd3':'#fde68a';
    var icon=r.status==='approved'?'✓':r.status==='rejected'?'✕':'⏳';
    var ic2=r.status==='approved'?'#15803d':r.status==='rejected'?'#b91c1c':'#92400e';
    var dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('fr-FR'):'';
    return '<div style="background:'+bgCol+';border:1px solid '+bdCol+';border-radius:10px;padding:14px 16px;margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<div><div style="font-size:13px;font-weight:700;color:#0f172a">'+esc(APPROVAL_LABELS[r.type]||r.type)+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-top:3px">'+esc(r.applyDesc)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-top:2px">Envoyée le '+dt+'</div>'
      +(r.status==='rejected'&&r.rejectionReason?'<div style="margin-top:8px;padding:8px 12px;background:#ffe4e6;border-radius:6px;font-size:12px;color:#b91c1c"><strong>Motif du refus :</strong> '+esc(r.rejectionReason)+'</div>':'')
      +'</div>'
      +'<div style="font-size:22px;font-weight:900;color:'+ic2+'">'+icon+'</div></div></div>';
  }
  function section(title,list,emptyMsg){
    return '<div style="margin-bottom:24px">'
      +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:12px">'+title+' ('+list.length+')</div>'
      +(list.length?list.map(apRow).join(''):'<div style="color:#94a3b8;font-size:13px;padding:8px 0">'+emptyMsg+'</div>')
      +'</div>';
  }
  var mineHtml='<div class="card" style="padding:24px">'
    +section('⏳ En cours d’analyse',pending2,'Aucune demande en attente.')
    +section('✓ Approuvées',approved,'Aucune demande approuvée.')
    +section('✕ Refusées',rejected,'Aucune demande refusée.')
    +'</div>';

  return '<div class="vw">'
    +'<div class="ph"><div><div class="pt">🔔 Approbations</div>'
    +'<div class="ps">'+(isValidator?'Demandes à valider, et suivi de vos propres demandes':'Suivi de vos demandes (en cours, approuvées, refusées)')+'</div></div></div>'
    +(isValidator?'<div style="font-size:14px;font-weight:800;color:#0f172a;margin:6px 0 12px">À valider</div>'+validatorHtml
        +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin:24px 0 12px">Mes demandes</div>':'')
    +mineHtml
    +'</div>';
}

/* ─── Modal "demande envoyée" ─── */
/* (ajouté dans tModal via le type 'approval_sent') */

/* ─── Vue Dashboard directeur — demandes en attente ─── */

function approveLv(lvId,approved){
  if(!approved&&!confirm('Refuser cette absence ?'))return;
  S.lvs=S.lvs.map(function(lv){
    if(lv.id!==lvId)return lv;
    return Object.assign({},lv,{approved:approved,approval_role:approved?null:'super_admin'});
  });
  if(S._all)S._all.lvs=S._all.lvs.map(function(lv){
    if(lv.id!==lvId)return lv;
    return Object.assign({},lv,{approved:approved,approval_role:approved?null:'super_admin'});
  });
  if(sb&&SB_CID){
    var lv=S.lvs.find(function(x){return x.id===lvId;})||{};
    sb.from('leaves').update({approved:approved,approval_role:approved?null:'super_admin'}).eq('id',lvId).then(function(){});
  }
  render();
}
function tDashApprovals(){
  var pending=S.approvals.filter(function(r){
    return r.status==='pending'&&_isMyApprovalRec(r);
  }).sort(function(a,b){return a.createdAt.localeCompare(b.createdAt);});
  if(!pending.length)return '';

  var rows=pending.map(function(r){
    var dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('fr-FR'):'';
    return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
      +'<div style="flex:1">'
      +'<div style="font-size:13px;font-weight:700;color:#0f172a">'+esc(r.consName)+' \u2014 '+esc(APPROVAL_LABELS[r.type]||r.type)+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-top:3px">'+esc(r.applyDesc)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-top:2px">Soumise le '+dt+'</div>'
      +'</div>'
      +'<div style="display:flex;gap:8px;flex-shrink:0">'
      +'<button class="bp" style="padding:6px 14px;font-size:12px" data-act="appr-ok" data-id="'+r.id+'">Approuver</button>'
      +'<button class="bg" style="padding:6px 14px;font-size:12px;color:#b91c1c;border-color:#fecdd3" data-act="appr-ko" data-id="'+r.id+'">Refuser</button>'
      +'</div></div></div>';
  }).join('');

  return '<div class="card" style="padding:20px;margin-bottom:16px;border-left:4px solid #f59e0b">'
    +'<div style="font-size:14px;font-weight:800;color:#92400e;margin-bottom:14px">'
    +'\u23f3 Demandes en attente de vos consultants ('+pending.length+')</div>'
    +rows+'</div>';
}

function toggleSB(){
  document.body.classList.toggle('sb-col');
  localStorage.setItem('sb-col',document.body.classList.contains('sb-col'));
}

/* ================================================================
   INT\u00c9GRATION MICROSOFT TEAMS \u2014 Graph API + MSAL
   ================================================================ */

var TEAMS_KEY='esn_teams_cfg';
var _teamsTimer=null;
var _msalApp=null;

function loadTeamsCfg(){
  try{var r=localStorage.getItem(TEAMS_KEY);return r?JSON.parse(r):{clientId:'',tenantId:'',fileUrl:'',sheetName:'',interval:30,enabled:false,lastSync:''};}
  catch(e){return{clientId:'',tenantId:'',fileUrl:'',sheetName:'',interval:30,enabled:false,lastSync:''};}
}
function saveTeamsCfg(c){
  try{localStorage.setItem(TEAMS_KEY,JSON.stringify(c));}catch(e){}
}

function loadMSALScript(cb){
  if(window.msal){cb();return;}
  var s=document.createElement('script');
  s.src='https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
  s.onload=function(){cb();};
  s.onerror=function(){console.warn('MSAL non disponible (Teams non configuré).');};
  document.head.appendChild(s);
}

function getOrCreateMSAL(cfg){
  if(_msalApp)return _msalApp;
  _msalApp=new msal.PublicClientApplication({
    auth:{
      clientId:cfg.clientId,
      authority:'https://login.microsoftonline.com/'+(cfg.tenantId||'common'),
      redirectUri:window.location.origin+'/'
    },
    cache:{cacheLocation:'localStorage',storeAuthStateInCookie:false}
  });
  return _msalApp;
}

async function getTeamsToken(){
  var cfg=loadTeamsCfg();
  if(!cfg.clientId||!cfg.tenantId)throw new Error('Configurez Client ID et Tenant ID dans Param\u00e8tres \u2192 Onglet Teams.');
  var app=getOrCreateMSAL(cfg);
  await app.initialize();
  var scopes=['Files.Read','Sites.Read.All'];
  var accounts=app.getAllAccounts();
  if(accounts.length>0){
    try{var r=await app.acquireTokenSilent({scopes:scopes,account:accounts[0]});return r.accessToken;}
    catch(e){/* popup fallback */}
  }
  var result=await app.loginPopup({scopes:scopes,prompt:'select_account'});
  return result.accessToken;
}

function encodeShareUrl(url){
  var b64=btoa('u!'+url);
  return b64.replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

async function fetchExcelValues(token,fileUrl,sheetName){
  /* 1. R\u00e9soudre le fichier via sharing link */
  var encoded=encodeShareUrl(fileUrl);
  var res1=await fetch('https://graph.microsoft.com/v1.0/shares/'+encoded+'/driveItem',
    {headers:{'Authorization':'Bearer '+token,'Accept':'application/json'}});
  if(!res1.ok)throw new Error('Fichier non trouv\u00e9 (HTTP '+res1.status+'). V\u00e9rifiez le lien de partage Teams.');
  var item=await res1.json();
  var driveId=item.parentReference.driveId;
  var fileId=item.id;

  /* 2. Lire la plage utilis\u00e9e */
  var sheet=sheetName?encodeURIComponent(sheetName):'0';
  var url='https://graph.microsoft.com/v1.0/drives/'+driveId+'/items/'+fileId
    +'/workbook/worksheets/'+sheet+'/usedRange?$select=values,numberFormat';
  var res2=await fetch(url,{headers:{'Authorization':'Bearer '+token,'Accept':'application/json'}});
  if(!res2.ok)throw new Error('Feuille "'+(sheetName||'1\u00e8re')+'\" illisible (HTTP '+res2.status+').');
  var data=await res2.json();
  return data.values||[];
}


/* ══════ Import Excel local des absences (r\u00e9utilise parseLeaveMatrix) ══════ */
function importStaffingXLS(file){
  if(!file)return;
  loadXLSX(function(){
    var reader=new FileReader();
    reader.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:false});
        var ws=wb.Sheets[wb.SheetNames[0]];
        if(!ws)throw new Error('Aucune feuille trouv\u00e9e dans le fichier.');
        var rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
        var newLeaves=parseLeaveMatrix(rows);
        var added=0;
        newLeaves.forEach(function(lv){
          var exists=S.lvs.find(function(x){return x.cid===lv.cid&&x.type===lv.type&&x.s===lv.s&&x.e===lv.e;});
          if(!exists){
            var entry=Object.assign({id:uid()},lv);
            S.lvs.push(entry);
            if(sb&&SB_CID)sbUpsertLeave(entry).catch(function(err){console.warn('[XLS] SB leave:',err);});
            added++;
          }
        });
        saveLocal();
        alert('Import Excel : '+newLeaves.length+' absences lues \u2014 '+added+' ajout\u00e9e(s).');
        render();
      }catch(err){
        console.error('[XLS] Erreur import :',err);
        alert('Erreur d\u2019import :\n'+err.message);
      }
    };
    reader.onerror=function(){alert('Lecture du fichier impossible.');};
    reader.readAsArrayBuffer(file);
  });
}

function parseLeaveMatrix(rows){
  /* Tableau crois\u00e9 :
   * Ligne 0 (header) : [vide/titre, date1, date2, ...]  \u2190 dates des colonnes
   * Lignes 1+ : [Pr\u00e9nom NOM, type|vide, type|vide, ...]
   * Types accept\u00e9s : CP, RTT, Maladie, CM, Maternit\u00e9, Formation, IC, etc.
   */
  if(!rows||rows.length<2)throw new Error('Tableau Excel vide ou incomplet.');
  function norm(n){return String(n||'').toLowerCase().replace(/[^a-z0-9 ]/gi,'').trim();}
  function toISO(v){
    if(!v&&v!==0)return null;
    if(typeof v==='number'){
      /* S\u00e9rie Excel : jours depuis 1900-01-01 (avec bug Lotus +2) */
      var d=new Date((v-25569)*86400*1000);
      if(isNaN(d.getTime()))return null;
      return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    }
    var s=String(v).trim();
    var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(m){var y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');}
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    return null;
  }
  var TYPE_MAP={
    'cp':'Cong\u00e9 pay\u00e9','conge':'Cong\u00e9 pay\u00e9','rtt':'RTT',
    'maladie':'Maladie','am':'Maladie','arretmaladie':'Maladie',
    'cm':'Cong\u00e9 maternit\u00e9','maternite':'Cong\u00e9 maternit\u00e9','maternite':'Cong\u00e9 maternit\u00e9',
    'formation':'Formation','css':'Cong\u00e9 sans solde',
    'ic':'Inter-contrat','intercontrat':'Inter-contrat',
    'interne':'Mission interne','autre':'Autre'
  };
  function parseType(v){
    if(!v||String(v).trim()==='')return null;
    var k=String(v).trim().toLowerCase().replace(/[^a-z]/g,'');
    return TYPE_MAP[k]||String(v).trim();
  }

  var headerRow=rows[0];
  var dates=headerRow.slice(1).map(toISO);
  var leaves=[];

  for(var ri=1;ri<rows.length;ri++){
    var row=rows[ri];
    var rawName=String(row[0]||'').trim();
    if(!rawName)continue;
    var rn=norm(rawName);var rp=rn.split(' ');
    var cons=S.cons.find(function(c){
      var cn=norm(c.name);var cp=cn.split(' ');var score=0;
      rp.forEach(function(p){if(p.length>2&&cp.indexOf(p)>=0)score++;});
      return score>=1||cn===rn;
    });
    if(!cons){console.warn('[Teams] Consultant non trouv\u00e9 :',rawName);continue;}

    var curType=null,startD=null,lastD=null;
    for(var ci=0;ci<dates.length;ci++){
      var date=dates[ci];
      if(!date)continue;
      var cell=ci+1<row.length?row[ci+1]:null;
      var t=parseType(cell);
      if(t&&t===curType){lastD=date;}
      else{
        if(curType&&startD)leaves.push({cid:cons.id,type:curType,s:startD,e:lastD||startD});
        curType=t||null;startD=t?date:null;lastD=t?date:null;
      }
    }
    if(curType&&startD)leaves.push({cid:cons.id,type:curType,s:startD,e:lastD||startD});
  }
  return leaves;
}

async function syncTeamsNow(silent){
  var cfg=loadTeamsCfg();
  if(!cfg.fileUrl){if(!silent)alert('Configurez le lien du fichier Teams dans Param\u00e8tres.');return;}
  var statusEl=document.getElementById('teams-sync-status');
  if(statusEl)statusEl.textContent='Synchronisation en cours...';
  try{
    var token=await getTeamsToken();
    var rows=await fetchExcelValues(token,cfg.fileUrl,cfg.sheetName);
    var newLeaves=parseLeaveMatrix(rows);

    /* Fusionner : ajouter uniquement les absences absentes */
    var added=0;
    newLeaves.forEach(function(lv){
      var exists=S.lvs.find(function(x){
        return x.cid===lv.cid&&x.type===lv.type&&x.s===lv.s&&x.e===lv.e;
      });
      if(!exists){
        var entry=Object.assign({id:uid()},lv);
        S.lvs.push(entry);
        if(sb&&SB_CID)sbUpsertLeave(entry).catch(function(e){console.warn('[Teams] SB leave:',e);});
        added++;
      }
    });
    saveLocal();
    cfg.lastSync=new Date().toISOString();
    saveTeamsCfg(cfg);
    var msg='Teams : '+newLeaves.length+' absences lues \u2014 '+added+' ajout\u00e9e(s)';
    if(statusEl)statusEl.textContent=msg+' (\u00e0 '+new Date().toLocaleTimeString()+')';
    if(!silent)alert(msg);
    render();
  }catch(err){
    console.error('[Teams] Erreur sync :',err);
    if(statusEl)statusEl.textContent='\u26a0 '+err.message;
    if(!silent)alert('Erreur Teams :\n'+err.message);
  }
}

function startTeamsAutoSync(){
  if(_teamsTimer){clearInterval(_teamsTimer);_teamsTimer=null;}
  var cfg=loadTeamsCfg();
  if(!cfg.enabled||!cfg.fileUrl||!cfg.clientId)return;
  var ms=(parseInt(cfg.interval)||30)*60*1000;
  syncTeamsNow(true);  /* sync imm\u00e9diate au d\u00e9marrage */
  _teamsTimer=setInterval(function(){syncTeamsNow(true);},ms);
}
function stopTeamsAutoSync(){
  if(_teamsTimer){clearInterval(_teamsTimer);_teamsTimer=null;}
}

function saveTeamsSettings(){
  var cfg={
    clientId:(document.getElementById('t-cid')||{}).value||'',
    tenantId:(document.getElementById('t-tid')||{}).value||'',
    fileUrl:(document.getElementById('t-url')||{}).value||'',
    sheetName:(document.getElementById('t-sheet')||{}).value||'',
    interval:parseInt((document.getElementById('t-int')||{}).value)||30,
    enabled:(document.getElementById('t-on')||{}).checked||false,
    lastSync:loadTeamsCfg().lastSync||''
  };
  _msalApp=null; /* reset pour recr\u00e9er avec nouveaux params */
  saveTeamsCfg(cfg);
  stopTeamsAutoSync();
  if(cfg.enabled)loadMSALScript(function(){startTeamsAutoSync();});
  alert('Configuration Teams sauvegard\u00e9e.');
  render();
}

function tTeamsPanel(){
  var cfg=loadTeamsCfg();
  var TH='padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:left;';
  return '<div class="card" style="padding:24px;margin-top:20px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:4px">Synchronisation Microsoft Teams</div>'
    +'<div style="font-size:12px;color:#64748b;margin-bottom:20px">Importe automatiquement les cong\u00e9s depuis un fichier Excel stock\u00e9 dans Teams / SharePoint.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">'
    +'<div class="fd"><label class="fl">Application (Client) ID *</label>'
    +'<input class="ic" id="t-cid" value="'+esc(cfg.clientId)+'" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></div>'
    +'<div class="fd"><label class="fl">Directory (Tenant) ID *</label>'
    +'<input class="ic" id="t-tid" value="'+esc(cfg.tenantId)+'" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></div>'
    +'<div class="fd" style="grid-column:1/-1"><label class="fl">Lien de partage du fichier Excel (Teams \u2192 Copier le lien) *</label>'
    +'<input class="ic" id="t-url" value="'+esc(cfg.fileUrl)+'" placeholder="https://entreprise.sharepoint.com/sites/.../Conges.xlsx?..."></div>'
    +'<div class="fd"><label class="fl">Nom de la feuille (laisser vide = 1\u00e8re)</label>'
    +'<input class="ic" id="t-sheet" value="'+esc(cfg.sheetName)+'" placeholder="Cong\u00e9s 2025-2026"></div>'
    +'<div class="fd"><label class="fl">Fr\u00e9quence de sync</label>'
    +'<select class="ic" id="t-int">'
    +'<option value="15"'+(cfg.interval===15?' selected':'')+'>Toutes les 15 minutes</option>'
    +'<option value="30"'+(cfg.interval===30||!cfg.interval?' selected':'')+'>Toutes les 30 minutes</option>'
    +'<option value="60"'+(cfg.interval===60?' selected':'')+'>Toutes les heures</option>'
    +'<option value="240"'+(cfg.interval===240?' selected':'')+'>Toutes les 4 heures</option>'
    +'</select></div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'
    +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:#0f172a">'
    +'<input type="checkbox" id="t-on"'+(cfg.enabled?' checked':'')+' style="width:16px;height:16px;accent-color:#84CC16"> Synchronisation automatique activ\u00e9e</label>'
    +'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="bp" onclick="saveTeamsSettings()">Enregistrer la configuration</button>'
    +'<button class="bg" onclick="loadMSALScript(function(){syncTeamsNow(false);})">Synchroniser maintenant</button>'
    +'</div>'
    +(cfg.lastSync?'<div style="font-size:11px;color:#94a3b8;margin-top:10px">Derni\u00e8re sync : '+new Date(cfg.lastSync).toLocaleString()+'</div>':'')
    +'<div id="teams-sync-status" style="font-size:12px;color:#2563eb;margin-top:6px"></div>'
    +'<div style="margin-top:16px;padding:12px 14px;background:#eff6ff;border-radius:8px;font-size:12px;color:#1e40af">'
    +'<strong>Format Excel attendu :</strong> Ligne 1 = dates (colonnes), Colonne A = Pr\u00e9nom NOM des consultants, cellules = type d\u2019absence (CP, RTT, Maladie, CM, Formation...) ou vide.'
    +'</div>'
    +'</div>';
}




/* ═══════════════════════════════════════════════════════════
   CALENDRIER MANUEL DE MISSION (forfait \u2014 choix manuel des jours)
═══════════════════════════════════════════════════════════ */
var MO=['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'];
var DOW=['Di','Lu','Ma','Me','Je','Ve','Sa'];

function mCalToggle(iso){
  if(!S.modal)return;
  var md=S.modal.manualDays=S.modal.manualDays||[];
  var i=md.indexOf(iso);if(i>=0)md.splice(i,1);else md.push(iso);
  mCalRefresh();
}
function mCalNav(dir){
  if(!S.modal)return;
  var m=(S.modal.calMonth!=null?S.modal.calMonth:new Date().getMonth())+dir,y=(S.modal.calYear!=null?S.modal.calYear:new Date().getFullYear());
  if(m<0){m=11;y--;}else if(m>11){m=0;y++;}
  S.modal.calMonth=m;S.modal.calYear=y;mCalRefresh();
}
function mWmodeSet(v){if(!S.modal)return;S.modal.wmode=v;mCalRefresh();}
function mCalRefresh(){
  var el=document.getElementById('mcal-wrap');
  if(el){el.innerHTML=mCalHTML();}
}
function mCalHTML(){
  if(!S.modal)return '';
  var wmode=S.modal.wmode||'rec';
  var selDays=S.modal.manualDays||[];
  var sdEl=document.getElementById('msd'),edEl=document.getElementById('med');
  var startISO=sdEl?sdEl.value:S.modal._sd||'';
  var endISO=edEl?edEl.value:S.modal._ed||'';
  var today=fD(new Date());
  var modeBar='<div style="display:flex;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">'
    +'<button type="button" onclick="mWmodeSet(\'rec\')" style="flex:1;padding:7px 4px;font-size:11px;font-weight:700;border:none;cursor:pointer;'+(wmode==='rec'?'background:#2563eb;color:#fff':'background:#fff;color:#64748b')+'">R\u00e9current (jours/sem.)</button>'
    +'<button type="button" onclick="mWmodeSet(\'man\')" style="flex:1;padding:7px 4px;font-size:11px;font-weight:700;border:none;cursor:pointer;'+(wmode==='man'?'background:#2563eb;color:#fff':'background:#fff;color:#64748b')+'">Choix manuel</button>'
    +'</div>';
  if(wmode==='rec'){
    var wdsel=S.modal._wdsel||[1,2,3,4,5];
    var WLBL2=[[1,'Lun'],[2,'Mar'],[3,'Mer'],[4,'Jeu'],[5,'Ven']];
    return modeBar
      +'<div style="display:flex;gap:12px;flex-wrap:wrap;padding:4px 0">'
      +WLBL2.map(function(w){return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="mwd" value="'+w[0]+'"'+(wdsel.indexOf(+w[0])>=0?' checked':'')+' style="accent-color:#84CC16">'+w[1]+'</label>';}).join('')
      +'</div><p class="fh">D\u00e9cochez les jours non travaill\u00e9s</p>';
  }
  /* ── Mode manuel : calendrier mensuel ── */
  var yr=S.modal.calYear!=null?S.modal.calYear:new Date().getFullYear();
  var mo=S.modal.calMonth!=null?S.modal.calMonth:new Date().getMonth();
  var selSet=new Set(selDays);
  var firstDow=new Date(yr,mo,1).getDay();
  var lastDayN=new Date(yr,mo+1,0).getDate();
  var calHdr='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    +'<button type="button" onclick="mCalNav(-1)" style="background:none;border:1px solid #e2e8f0;border-radius:5px;padding:3px 9px;cursor:pointer">\u2039</button>'
    +'<span style="font-weight:700;font-size:12px;color:#0f172a">'+MO[mo]+' '+yr+'</span>'
    +'<button type="button" onclick="mCalNav(1)" style="background:none;border:1px solid #e2e8f0;border-radius:5px;padding:3px 9px;cursor:pointer">\u203a</button>'
    +'</div>';
  var tbl='<table style="width:100%;border-collapse:collapse;font-size:11px">'
    +'<tr>'+DOW.map(function(d){return '<th style="padding:2px;text-align:center;color:#94a3b8;font-size:9px;font-weight:700">'+d+'</th>';}).join('')+'</tr>';
  var d=1,row='';
  for(var c0=0;c0<firstDow;c0++)row+='<td></td>';
  for(;d<=lastDayN;){
    var dow=(firstDow+d-1)%7;
    if(dow===0&&d>1){tbl+='<tr>'+row+'</tr>';row='';}
    var iso=yr+'-'+String(mo+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isSel=selSet.has(iso),isWD=dow>=1&&dow<=5;
    var inRange=(!startISO||iso>=startISO)&&(!endISO||iso<=endISO);
    var isPast=iso<today;
    var bg='',cl='',cur='default',oc='';
    if(!isWD){bg='#f8fafc';cl='#e2e8f0';}          /* week-end */
    else if(!inRange){bg='#fff';cl='#e2e8f0';}       /* hors plage mission */
    else{
      /* jour ouvrable dans la plage : toujours cliquable */
      cur='pointer';oc="mCalToggle('"+iso+"')";
      if(isSel){bg='#2563eb';cl='#fff';}             /* sélectionné */
      else{bg=isPast?'#dbeafe':'#dcfce7';cl=isPast?'#1e40af':'#15803d';}
    }
    row+='<td onclick="'+oc+'" title="'+iso+'" style="text-align:center;padding:3px 1px;border-radius:3px;cursor:'+cur+';background:'+bg+';color:'+cl+';font-weight:'+(isSel?'800':'500')+'">'+d+'</td>';
    d++;if(dow===6){tbl+='<tr>'+row+'</tr>';row='';}
  }
  while((firstDow+d-1)%7!==0){row+='<td></td>';d++;}
  if(row)tbl+='<tr>'+row+'</tr>';
  tbl+='</table>';
  return modeBar
    +'<p class="fh" style="margin-bottom:6px">'+selDays.length+' jour(s) s\u00e9lectionn\u00e9(s). <span style="color:#1e40af">\u25a0 pass\u00e9</span> <span style="color:#15803d">\u25a0 futur</span> <span style="color:#2563eb">\u25a0 s\u00e9lectionn\u00e9</span></p>'
    +calHdr+tbl;
}

function tProfile(){
  var userEmail=S._userEmail||'';
  var roleLabels={directeur:rLabel('gestionnaire'),gestionnaire:rLabel('admin'),senior_vp:rLabel('super_admin'),consultant:rLabel('utilisateur'),recruteur:rLabel('recruteur')};
  var userRole=roleLabels[S.role]||S.role;
  var fn=S.profileFirstName||'';
  var ln=S.profileLastName||'';
  var titre=S.profileTitle||'';
  if(S.role==='utilisateur'&&S.consId){
    var myC=((S._all&&S._all.cons)||S.cons).find(function(c){return c.id===S.consId;})||{};
    if(!titre)titre=myC.title||'';
  }
  return '<div>'
    +'<div class="ph"><div><div class="pt">Mon Profil</div>'
    +'<div class="ps">Informations de compte et sécurité</div></div></div>'
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:16px">Informations personnelles</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
    +'<div class="fd"><label class="fl">Prénom</label><div style="padding:9px 12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;border:1px solid #e2e8f0">'+esc(fn||'—')+'</div></div>'
    +'<div class="fd"><label class="fl">Nom</label><div style="padding:9px 12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;border:1px solid #e2e8f0">'+esc(ln||'—')+'</div></div>'
    +'<div class="fd"><label class="fl">Titre / Poste</label><input class="ic" id="prof-title" value="'+esc(titre)+'" placeholder="ex : Directeur de pôle"></div>'
    +'<div class="fd"><label class="fl">Email</label><div style="padding:9px 12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#64748b;border:1px solid #e2e8f0">'+esc(userEmail||'—')+'</div></div>'
    +'<div class="fd"><label class="fl">Rôle</label><div style="padding:9px 12px;background:#f8fafc;border-radius:8px;font-size:13px;font-weight:700;color:#0f172a;border:1px solid #e2e8f0">'+esc(userRole)+'</div></div>'
    +(function(){
        var apprId=resolveApprover(S._userId);
        var apprP=apprId?profById(apprId):null;
        var apprTxt=apprP?profName(apprP)+' ('+rLabel(apprP.role)+')':'\u2014 Aucun (vos demandes s\'appliquent directement)';
        return '<div class="fd"><label class="fl">Responsable (N+1) \u2014 approuve mes demandes</label><div style="padding:9px 12px;background:#f0fdf4;border-radius:8px;font-size:13px;font-weight:600;color:#15803d;border:1px solid #bbf7d0">'+esc(apprTxt)+'</div></div>';
      })()
    +'</div>'
    +'<p style="font-size:11px;color:#94a3b8;margin-top:10px">Le prénom et le nom sont définis par votre organisation à l\'invitation et ne peuvent pas être modifiés ici.</p>'
    +'<div id="prof-info-msg" style="font-size:12px;margin-top:6px;display:none"></div>'
    +'<button class="bp" style="margin-top:10px" onclick="saveProfileInfo()">Enregistrer le titre</button>'
    +'</div>'


    /* ── Délégation d'approbation (rôles approbateurs uniquement) ── */
    +((S.role==='super_admin'||S.role==='admin'||S.role==='gestionnaire')?(function(){
      var cand=delegationCandidates();
      var curDeleg=S.approvalDelegateTo;
      var curUntil=S.approvalDelegateUntil;
      var opts='<option value="">— Personne (j\'approuve moi-même) —</option>'+cand.map(function(p){
        return '<option value="'+p.id+'"'+(p.id===curDeleg?' selected':'')+'>'+esc(profName(p))+' \u2014 '+esc(rLabel(p.role))+'</option>';
      }).join('');
      return '<div class="card" style="padding:24px;margin-bottom:16px">'
        +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:6px">\uD83D\uDD01 Délégation d\'approbation</div>'
        +'<p style="font-size:12px;color:#64748b;margin:0 0 16px">Transférez temporairement ou définitivement la validation de vos demandes à un pair (même responsable que vous) ou à votre responsable.</p>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
        +'<div class="fd"><label class="fl">Déléguer mes approbations à</label><select class="ic" id="deleg-to">'+opts+'</select></div>'
        +'<div class="fd"><label class="fl">Jusqu\'au (vide = permanent)</label><input class="ic" id="deleg-until" type="date" value="'+esc(curUntil||'')+'"></div>'
        +'</div>'
        +(curDeleg?'<div style="font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-top:10px">\u26a0 Vos approbations sont actuellement déléguées'+(curUntil?' jusqu\'au '+fDt(curUntil):' de façon permanente')+'.</div>':'')
        +'<div id="deleg-msg" style="font-size:12px;margin-top:10px;display:none"></div>'
        +'<button class="bp" style="margin-top:12px" onclick="saveDelegation()">Enregistrer la délégation</button>'
        +'</div>';
    })():'')

    /* ── Changer le mot de passe ── */
    +'<div class="card" style="padding:24px;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:16px">Changer le mot de passe</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
    +'<div class="fd"><label class="fl">Nouveau mot de passe *</label>'
    +'<input class="ic" type="password" id="prof-pw1" placeholder="Minimum 8 caract\u00e8res" autocomplete="new-password"></div>'
    +'<div class="fd"><label class="fl">Confirmer le mot de passe *</label>'
    +'<input class="ic" type="password" id="prof-pw2" placeholder="Retapez le mot de passe" autocomplete="new-password"></div>'
    +'</div>'
    +'<div id="prof-pw-msg" style="font-size:12px;margin-top:10px;display:none"></div>'
    +'<button class="bp" style="margin-top:14px" onclick="changePassword()">Mettre \u00e0 jour le mot de passe</button>'
    +'</div>'

    /* ── D\u00e9connexion ── */
    +'<div class="card" style="padding:24px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px">Session</div>'
    +'<p style="font-size:12px;color:#64748b;margin:0 0 14px">Vous serez redirig\u00e9 vers la page de connexion.</p>'
    +'<button onclick="doLogout()" style="background:#fff;color:#ef4444;border:1px solid #fca5a5;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer">\u2192 Se d\u00e9connecter</button>'
    +'</div>'
    +'</div>';
}


async function saveDelegation(){
  var to=(document.getElementById('deleg-to')||{}).value||'';
  var until=(document.getElementById('deleg-until')||{}).value||'';
  var msg=document.getElementById('deleg-msg');
  if(msg){msg.style.display='block';msg.style.color='#64748b';msg.textContent='Enregistrement...';}
  S.approvalDelegateTo=to||null;
  S.approvalDelegateUntil=until||null;
  if(sb&&SB_CID){
    try{
      var u=await sb.auth.getUser();
      if(u.data&&u.data.user){
        await sb.from('profiles').update({
          approval_delegate_to:to||null,
          approval_delegate_until:until||null
        }).eq('id',u.data.user.id);
      }
      /* Rafraîchir l'annuaire pour refléter la délégation */
      try{var opr=await sb.from('profiles').select('id,first_name,last_name,role,manager_id,cons_id,bu_id,approval_delegate_to,approval_delegate_until').eq('company_id',SB_CID);if(opr.data)S.orgProfiles=opr.data;}catch(e){}
      if(msg){msg.style.color='#16a34a';msg.textContent=to?'\u2713 Délégation enregistrée.':'\u2713 Délégation retirée.';}
      setTimeout(render,900);
    }catch(e){if(msg){msg.style.color='#ef4444';msg.textContent='Erreur : '+e.message;}}
  }
}

async function saveProfileInfo(){
  /* Nom/prénom verrouillés : seul le titre est modifiable ici. */
  var title=(document.getElementById('prof-title')||{}).value||'';
  var msg=document.getElementById('prof-info-msg');
  if(msg){msg.style.display='block';msg.style.color='#64748b';msg.textContent='Enregistrement...';}
  S.profileTitle=title;
  if(sb&&SB_CID){
    try{
      var uid=await sb.auth.getUser();
      if(uid.data&&uid.data.user){
        await sb.from('profiles').update({title:title}).eq('id',uid.data.user.id);
      }
      if(msg){msg.style.color='#16a34a';msg.textContent='✓ Titre mis à jour.';}
    }catch(e){if(msg){msg.style.color='#ef4444';msg.textContent='Erreur : '+e.message;}}
  }else{
    if(msg){msg.style.color='#16a34a';msg.textContent='✓ Profil mis à jour (mode local).';}
  }
}
async function changePassword(){
  var pw1=(document.getElementById('prof-pw1')||{}).value||'';
  var pw2=(document.getElementById('prof-pw2')||{}).value||'';
  var msg=document.getElementById('prof-pw-msg');
  if(!msg)return;
  msg.style.display='block';
  if(!pw1||pw1.length<8){msg.style.color='#ef4444';msg.textContent='Le mot de passe doit contenir au moins 8 caract\u00e8res.';return;}
  if(pw1!==pw2){msg.style.color='#ef4444';msg.textContent='Les mots de passe ne correspondent pas.';return;}
  msg.style.color='#64748b';msg.textContent='Mise \u00e0 jour en cours...';
  try{
    var res=await sb.auth.updateUser({password:pw1});
    if(res.error)throw res.error;
    msg.style.color='#16a34a';
    msg.textContent='\u2713 Mot de passe mis \u00e0 jour avec succ\u00e8s.';
    document.getElementById('prof-pw1').value='';
    document.getElementById('prof-pw2').value='';
  }catch(e){
    msg.style.color='#ef4444';
    msg.textContent='\u26a0 Erreur : '+(e.message||'impossible de mettre \u00e0 jour le mot de passe.');
  }
}

async function doLogout(){
  if(sb)await sb.auth.signOut().catch(function(){});
  window.location.href="/login";
}

initApp();

