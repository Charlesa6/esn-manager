'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - DASHBOARD
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function tDash(){
  var Hy=fyHols(S.year);
  var dateStr=pD(TODAY).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  /* ── Helpers ── */
  function daysSince(d){return Math.round((pD(TODAY)-pD(d))/86400000);}
  function daysUntil(d){return Math.round((pD(d)-pD(TODAY))/86400000);}
  function urgentCol(j){return j<=7?'#b91c1c':j<=14?'#b45309':'#15803d';}
  function urgentBg(j){return j<=7?'#fff1f2':j<=14?'#fffbeb':'#f0fdf4';}
  function urgentBd(j){return j<=7?'#fecdd3':j<=14?'#fde68a':'#bbf7d0';}

  /* Carte rétractable (details/summary) — fermée par défaut */
  function card(title, icon, rows, emptyMsg, count){
    var cntBadge=count!==undefined?'<span style="margin-left:8px;background:#e2e8f0;color:#475569;font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px">'+count+'</span>':'';
    var hasAlert=count>0;
    return '<details style="background:#fff;border:1px solid '+(hasAlert?'#fde68a':'#e2e8f0')+';border-radius:12px;margin-bottom:10px;overflow:hidden">'
      +'<summary style="display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:14px;font-weight:800;color:#0f172a;list-style:none;user-select:none"'
      +' onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
      +'<span>'+icon+'</span><span style="flex:1">'+title+'</span>'+cntBadge
      +'<span style="font-size:11px;color:#94a3b8;margin-left:8px">&#x25be;</span>'
      +'</summary>'
      +'<div style="padding:0 18px 16px">'
      +(rows||'<div style="font-size:13px;color:#94a3b8;padding:8px 0">'+emptyMsg+'</div>')
      +'</div></details>';
  }

  /* ══ 1. EN INTER-CONTRAT ══
     Consultants actifs, sans mission aujourd'hui, sans congé aujourd'hui */
  var icRows='';
  var icCons=S.cons.filter(function(c){
    if(isGone(c))return false;
    if(c.arrive&&c.arrive>TODAY)return false; /* futur arrivant : pas encore en inter-contrat */
    if(leaveOnDay(c.id,TODAY))return false;
    if(missOnDay(c.id,TODAY))return false;
    return true;
  });
  if(icCons.length){
    icRows=icCons.map(function(c){
      /* Date d'entrée en IC = fin de la dernière mission, ou date d'arrivée */
      var pastMiss=S.miss.filter(function(m){return m.cid===c.id&&m.ed&&m.ed<TODAY;})
        .sort(function(a,b){return b.ed.localeCompare(a.ed);});
      var icSince=pastMiss.length?pastMiss[0].ed:c.arrive||TODAY;
      var jours=daysSince(icSince);
      var jCol=jours<=30?'#15803d':jours<=60?'#b45309':'#b91c1c';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:#fff1f2;border:1px solid #fecdd3;margin-bottom:8px">'
        +'<div style="display:flex;align-items:center;gap:10px">'+av(c.name,32)
        +'<div><div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(c.name)+'</div>'
        +'<div style="font-size:11px;color:#94a3b8">'+esc(c.title)+'</div></div></div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:18px;font-weight:900;color:'+jCol+'">'+jours+'j</div>'
        +'<div style="font-size:10px;color:#94a3b8">sans mission</div></div></div>';
    }).join('');
  }

  /* ══ 2. PROCHAINES MISSIONS QUI DÉMARRENT ══ */
  var startRows='';
  var startMiss=S.miss
    .filter(function(m){return m.sd>TODAY;})
    .map(function(m){
      var c=S.cons.find(function(c){return c.id===m.cid;})||{name:'?',title:''};
      return {m:m,c:c,j:daysUntil(m.sd)};
    })
    .sort(function(a,b){return a.j-b.j;})
    .slice(0,5);
  if(startMiss.length){
    startRows=startMiss.map(function(x){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:'+urgentBg(x.j)+';border:1px solid '+urgentBd(x.j)+';margin-bottom:8px">'
        +'<div style="display:flex;align-items:center;gap:10px">'+av(x.c.name,32)
        +'<div><div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(x.c.name)+'</div>'
        +'<div style="font-size:11px;color:#64748b">'+esc(x.m.client||x.m.cli||'')+' \u00b7 TJM '+fEur(x.m.tjm)+'</div></div></div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:18px;font-weight:900;color:'+urgentCol(x.j)+'">J\u2212'+x.j+'</div>'
        +'<div style="font-size:10px;color:#94a3b8">'+fDt(x.m.sd)+'</div></div></div>';
    }).join('');
  }

  /* ══ 3. PROCHAINES MISSIONS QUI SE TERMINENT ══ */
  var endRows='';
  var endMiss=S.miss
    .filter(function(m){return m.sd<=TODAY&&m.ed&&m.ed>=TODAY;})
    .map(function(m){
      var c=S.cons.find(function(c){return c.id===m.cid;})||{name:'?',title:''};
      return {m:m,c:c,j:daysUntil(m.ed)};
    })
    .sort(function(a,b){return a.j-b.j;})
    .slice(0,5);
  if(endMiss.length){
    endRows=endMiss.map(function(x){
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:'+urgentBg(x.j)+';border:1px solid '+urgentBd(x.j)+';margin-bottom:8px">'
        +'<div style="display:flex;align-items:center;gap:10px">'+av(x.c.name,32)
        +'<div><div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(x.c.name)+'</div>'
        +'<div style="font-size:11px;color:#64748b">'+esc(x.m.client||x.m.cli||'')+'</div></div></div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:18px;font-weight:900;color:'+urgentCol(x.j)+'">J\u2212'+x.j+'</div>'
        +'<div style="font-size:10px;color:#94a3b8">'+fDt(x.m.ed)+'</div></div></div>';
    }).join('');
  }

  /* ══ 4. PROCHAINS RETOURS DE CONGÉS / MALADIE ══
     Personnes actuellement en congé (aujourd'hui compris), retour à venir */
  var retourRows='';
  var retours=[];
  S.cons.filter(function(c){return !isGone(c);}).forEach(function(c){
    var lvNow=leaveOnDay(c.id,TODAY);
    if(lvNow&&lvNow.type!=='Inter-contrat'&&lvNow.type!=='Mission interne'){
      var retDate=nxt(lvNow.e); /* lendemain de fin = jour de retour */
      retours.push({c:c,lv:lvNow,ret:retDate,j:daysUntil(lvNow.e)});
    }
  });
  retours.sort(function(a,b){return a.j-b.j;});
  if(retours.length){
    retourRows=retours.map(function(x){
      var typeCol={'Maladie':'#b91c1c','Congé maternité':'#9d174d','Congé sans solde':'#475569'}[x.lv.type]||'#b45309';
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;margin-bottom:8px">'
        +'<div style="display:flex;align-items:center;gap:10px">'+av(x.c.name,32)
        +'<div><div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(x.c.name)+'</div>'
        +'<div style="display:flex;align-items:center;gap:6px;margin-top:2px">'
        +'<span style="font-size:11px;font-weight:700;color:'+typeCol+';background:#ffe4e6;padding:1px 8px;border-radius:99px">'+esc(x.lv.type)+'</span>'
        +'<span style="font-size:11px;color:#94a3b8">retour le '+fDt(x.ret)+'</span></div></div></div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:18px;font-weight:900;color:#b45309">J\u2212'+x.j+'</div>'
        +'<div style="font-size:10px;color:#94a3b8">fin d\'absence</div></div></div>';
    }).join('');
  }

  /* ── Compteur IC et approbations ── */
  var icCount=icCons.length;
  /* Absences Recruteur/Business Manager en attente */
  var pendingLvAppr=S.lvs.filter(function(lv){return lv.approval_role&&lv.approved===false;});
  var myPendingLvAppr=S.role==='super_admin'?pendingLvAppr.filter(function(lv){return lv.approval_role==='super_admin';}):
    S.role==='gestionnaire'?pendingLvAppr.filter(function(lv){return lv.approval_role==='gestionnaire';}):
    [];
  var pendingAppr=(S.approvals||[]).filter(function(r){
    return r.status==='pending'&&_isMyApprovalRec(r);
  });
  var approvedAppr=(S.approvals||[]).filter(function(r){
    return r.status==='approved'&&_isMyApprovalRec(r);
  });
  var rejectedAppr=(S.approvals||[]).filter(function(r){
    return r.status==='rejected'&&_isMyApprovalRec(r);
  });
  var pCount=pendingAppr.length;

  /* Futurs arrivants = consultants dont l'arrivée est > aujourd'hui ET dans la période sélectionnée */
  var futursArrivants=S.cons.filter(function(c){
    return c.arrive&&c.arrive>TODAY&&!isGone(c);
  }).sort(function(a,b){return a.arrive.localeCompare(b.arrive);});
  var futurCount=futursArrivants.length;

  /* Lien candidat → consultant pour expertise/secteur */
  function getCandForCons(cid){
    return S.cands.find(function(cd){return cd.consId===cid||cd.id===cid;});
  }

  /* ── Section approbations complète (bas de page) ── */
  function apprRow(r,showReject){
    var dt=r.createdAt?new Date(r.createdAt).toLocaleDateString('fr-FR'):'';
    var isP=r.status==='pending',isA=r.status==='approved',isR=r.status==='rejected';
    var bg=isA?'#f0fdf4':isR?'#fff1f2':'#fffbeb';
    var bd=isA?'#bbf7d0':isR?'#fecdd3':'#fde68a';
    return '<div style="background:'+bg+';border:1px solid '+bd+';border-radius:10px;padding:12px 16px;margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
      +'<div style="flex:1">'
      +'<div style="font-size:13px;font-weight:700;color:#0f172a">'+esc(r.consName||'')+' \u2014 '+esc(APPROVAL_LABELS[r.type]||r.type)+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-top:2px">'+esc(r.applyDesc||'')+'</div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-top:2px">'+dt+'</div>'
      +(isR&&r.rejectionReason?'<div style="margin-top:6px;font-size:12px;color:#b91c1c;font-style:italic">\u26a0 Motif\u00a0: '+esc(r.rejectionReason)+'</div>':'')
      +'</div>'
      +(isP&&showReject
        ?'<div style="display:flex;gap:8px;flex-shrink:0">'
          +'<button class="bp" style="padding:5px 12px;font-size:12px" data-act="appr-ok" data-id="'+r.id+'">Approuver</button>'
          +'<button class="bg" style="padding:5px 12px;font-size:12px;color:#b91c1c;border-color:#fecdd3" data-act="appr-ko" data-id="'+r.id+'">Refuser</button>'
          +'</div>'
        :'<div style="font-size:18px">'+(isA?'\u2705':isR?'\u274c':'\u23f3')+'</div>')
      +'</div></div>';
  }

  var apprSection='<details style="background:#fff;border:1px solid '+(pCount>0?'#fbbf24':'#e2e8f0')+';border-radius:12px;margin-bottom:10px;overflow:hidden" id="approvals-section"'+(pCount>0?' open':'')+'>'  
    +'<summary style="display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:14px;font-weight:800;color:#0f172a;list-style:none;user-select:none"'
    +' onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'  
    +'\uD83D\uDD14<span style="flex:1;margin-left:8px">Demandes d\u2019approbation</span>'
    +'<span style="background:'+(pCount>0?'#fef3c7':'#e2e8f0')+';color:'+(pCount>0?'#92400e':'#475569')+';font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px;margin-right:6px">'+pCount+' en attente</span>'
    +'<span style="font-size:11px;color:#94a3b8">&#x25be;</span>'
    +'</summary>'
    +'<div style="padding:0 18px 16px">'
    +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#92400e;margin:10px 0 8px">\u23f3 En attente ('+pCount+')</div>'
    +(pendingAppr.length
      ?pendingAppr.map(function(r){return apprRow(r,S.role==='gestionnaire');}).join('')
      :'<div style="font-size:13px;color:#94a3b8;padding:6px 0 12px">Aucune demande en attente.</div>')
    +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#15803d;margin:12px 0 8px">\u2705 Approuv\u00e9es ('+approvedAppr.length+')</div>'
    +(approvedAppr.length
      ?approvedAppr.map(function(r){return apprRow(r,false);}).join('')
      :'<div style="font-size:13px;color:#94a3b8;padding:6px 0 12px">Aucune.</div>')
    +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#b91c1c;margin:12px 0 8px">\u274c Refus\u00e9es ('+rejectedAppr.length+')</div>'
    +(rejectedAppr.length
      ?rejectedAppr.map(function(r){return apprRow(r,false);}).join('')
      :'<div style="font-size:13px;color:#94a3b8;padding:6px 0">Aucune.</div>')
    +'</div></details>';

  return '<div class="vw">'
    +'<div style="margin-bottom:20px">'
    +'<h1 style="font-size:22px;font-weight:700;color:#0f172a">Tableau de bord</h1>'
    +'<p style="font-size:13px;color:#64748b;margin-top:4px">'+dateStr+'</p></div>'

    /* Cartes résumé — Approbations EN PREMIER, cliquable */
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">'


    +'<a href="#futurs-section" style="background:'+(futurCount>0?'#f0fdf4':'#f8fafc')+';border:1px solid '+(futurCount>0?'#bbf7d0':'#e2e8f0')+';border-radius:14px;padding:16px 18px;text-decoration:none;cursor:pointer;display:block;transition:box-shadow .15s,transform .15s" '
    +'onmouseover="this.style.boxShadow=\'0 8px 20px rgba(0,0,0,.08)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.boxShadow=\'\';this.style.transform=\'\'">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div style="font-size:30px;font-weight:900;line-height:1;color:'+(futurCount>0?'#15803d':'#64748b')+'">'+futurCount+'</div>'
    +'<div style="width:38px;height:38px;border-radius:11px;background:'+(futurCount>0?'#dcfce7':'#eef2f7')+';display:flex;align-items:center;justify-content:center;font-size:19px">\ud83d\udc65</div></div>'
    +'<div style="font-size:12px;font-weight:700;color:#374151;margin-top:10px">Recrutements</div>'
    +'<div style="font-size:11px;color:#94a3b8">arriv\u00e9es \u00e0 venir</div></a>'

    +'<div style="background:'+(icCount>0?'#fff1f2':'#f0fdf4')+';border:1px solid '+(icCount>0?'#fecdd3':'#bbf7d0')+';border-radius:14px;padding:16px 18px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div style="font-size:30px;font-weight:900;line-height:1;color:'+(icCount>0?'#b91c1c':'#15803d')+'">'+icCount+'</div>'
    +'<div style="width:38px;height:38px;border-radius:11px;background:'+(icCount>0?'#ffe4e6':'#dcfce7')+';display:flex;align-items:center;justify-content:center;font-size:19px">\u23f3</div></div>'
    +'<div style="font-size:12px;font-weight:700;color:#374151;margin-top:10px">En inter-contrat</div>'
    +'<div style="font-size:11px;color:#94a3b8">aujourd\'hui</div></div>'

    +'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:16px 18px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div style="font-size:30px;font-weight:900;line-height:1;color:#1e40af">'+startMiss.length+'</div>'
    +'<div style="width:38px;height:38px;border-radius:11px;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:19px">\ud83d\ude80</div></div>'
    +'<div style="font-size:12px;font-weight:700;color:#374151;margin-top:10px">Prochains d\u00e9marrages</div>'
    +'<div style="font-size:11px;color:#94a3b8">missions \u00e0 venir</div></div>'

    +'<div style="background:'+(endMiss.filter(function(x){return x.j<=30;}).length>0?'#fffbeb':'#f8fafc')+';border:1px solid '+(endMiss.filter(function(x){return x.j<=30;}).length>0?'#fde68a':'#e2e8f0')+';border-radius:14px;padding:16px 18px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div style="font-size:30px;font-weight:900;line-height:1;color:#b45309">'+endMiss.length+'</div>'
    +'<div style="width:38px;height:38px;border-radius:11px;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-size:19px">\ud83d\udcc5</div></div>'
    +'<div style="font-size:12px;font-weight:700;color:#374151;margin-top:10px">Fins de mission</div>'
    +'<div style="font-size:11px;color:#94a3b8">missions en cours</div></div>'
    +'</div>'

    /* ── Layout 2 colonnes ── */
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">'
    /* Colonne gauche */
    +'<div>'
    +card('En inter-contrat aujourd\'hui','\uD83D\uDD34',icRows||null,'Toute l\'\u00e9quipe est en mission. \uD83C\uDF89',icCount)
    +card('Prochaines missions qui d\u00e9marrent','\uD83D\uDE80',startRows||null,'Aucune mission \u00e0 venir planifi\u00e9e.',startMiss.length)
    +'</div>'
    /* Colonne droite */
    +'<div>'
    +card('Prochaines missions qui se terminent','\uD83D\uDCC5',endRows||null,'Aucune mission active en cours.',endMiss.length)
    +card('Retours de cong\u00e9s / maladie','\uD83C\uDFD6\uFE0F',retourRows||null,'Personne en cong\u00e9 ou arr\u00eat en ce moment.',retours.length)
    +'</div>'
    +'</div>'
    /* ── Section futurs arrivants ── */
    +(function(){
      var futurRows=futursArrivants.map(function(c){
        var cand=getCandForCons(c.id);
        /* Priorité : champs directs du consultant, fallback sur candidat lié */
        var expArr=(c.expertise&&c.expertise.length)?c.expertise
          :(cand&&cand.expertise&&cand.expertise.length)?cand.expertise:[];
        var secArr=(c.sectors&&c.sectors.length)?c.sectors
          :(cand&&cand.sectors&&cand.sectors.length)?cand.sectors:[];
        var exp=expArr.length?expArr.slice(0,3).join(', '):'\u2014';
        var sec=secArr.length?secArr.slice(0,2).join(', '):'\u2014';
        var j=Math.round((pD(c.arrive)-pD(TODAY))/86400000);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;margin-bottom:8px">'
          +'<div style="display:flex;align-items:center;gap:10px">'+av(c.name,32)
          +'<div>'
          +'<div style="font-weight:700;font-size:13px;color:#0f172a">'+esc(c.name)+'</div>'
          +'<div style="font-size:11px;color:#64748b;margin-top:2px">'+esc(exp)+'</div>'
          +(sec!=='\u2014'?'<div style="font-size:11px;color:#94a3b8">'+esc(sec)+'</div>':'')
          +'</div></div>'
          +'<div style="text-align:right;flex-shrink:0">'
          +'<div style="font-size:16px;font-weight:900;color:#15803d">J\u2212'+j+'</div>'
          +'<div style="font-size:11px;color:#94a3b8">'+fDt(c.arrive)+'</div>'
          +'</div></div>';
      }).join('');
      return '<details style="background:#fff;border:1px solid '+(futurCount>0?'#bbf7d0':'#e2e8f0')+';border-radius:12px;margin-bottom:10px;overflow:hidden" id="futurs-section">'
        +'<summary style="display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:14px;font-weight:800;color:#0f172a;list-style:none;user-select:none" '
        +'onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
        +'\uD83D\uDCC5<span style="flex:1;margin-left:8px">Prochaines arriv\u00e9es</span>'
        +'<span style="background:'+(futurCount>0?'#dcfce7':'#e2e8f0')+';color:'+(futurCount>0?'#15803d':'#475569')+';font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px;margin-right:6px">'+futurCount+' \u00e0 venir</span>'
        +'<span style="font-size:11px;color:#94a3b8">&#x25be;</span>'
        +'</summary>'
        +'<div style="padding:0 18px 16px">'
        +(futurRows||'<div style="font-size:13px;color:#94a3b8;padding:8px 0">Aucune arriv\u00e9e planifi\u00e9e.</div>')
        +'</div></details>';
    }())

    +'</div>';
}
function tTeams(){
  var fyS=fyStart(S.year),fyE=fyEnd(S.year);
  /* Respecte le filtre gestionnaire/VP de la barre latérale (S.fdir / S.fvp) :
     on ne montre dans l'Équipe que les consultants visibles selon le filtre en
     cours — sinon filtrer sur un gestionnaire n'affectait pas la liste. */
  var _vids=visibleConsIds();
  var allC=((S._all&&S._all.cons)||S.cons).filter(function(c){return _vids[c.id];});

  var inFY=allC.filter(function(c){
    if(c.arrive&&c.arrive>fyE)return false;
    if(c.depart&&c.depart<fyS)return false;
    return true;
  });

  /* ── Filtres expertise / secteur ── */
  var allExp=[],allSec=[];
  inFY.forEach(function(c){
    (c.expertise||[]).forEach(function(e){if(allExp.indexOf(e)<0)allExp.push(e);});
    (c.sectors||[]).forEach(function(s){if(allSec.indexOf(s)<0)allSec.push(s);});
  });
  allExp.sort();allSec.sort();

  function applyFilters(list){
    return list.filter(function(c){
      if(S.fexp&&S.fexp.length&&!(c.expertise||[]).some(function(e){return S.fexp.indexOf(e)>=0;}))return false;
      if(S.fsec&&S.fsec.length&&!(c.sectors||[]).some(function(s){return S.fsec.indexOf(s)>=0;}))return false;
      return true;
    });
  }

  function filterPills(arr,sel,act){
    if(!arr.length)return '';
    return arr.map(function(v){
      var on=(sel||[]).indexOf(v)>=0;
      return '<button data-act="'+act+'" data-id="'+esc(v)+'" style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid '+(on?'#84CC16':'#e2e8f0')+';background:'+(on?'#84CC16':'#fff')+';color:'+(on?'#1B2B3A':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(v)+'</button>';
    }).join('');
  }

  var expPills=filterPills(allExp,S.fexp,'fexp-tog');
  var secPills=filterPills(allSec,S.fsec,'fsec-tog');
  var hasFilters=(S.fexp&&S.fexp.length)||(S.fsec&&S.fsec.length);

  var filtersHtml=allExp.length||allSec.length
    ?'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:14px">'
      +(expPills?'<div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-right:8px">Expertise</span>'+expPills+'</div>':'')
      +(secPills?'<div"><span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-right:8px">Secteur</span>'+secPills+'</div>':'')
      +(hasFilters?'<button data-act="fteams-reset" style="font-size:11px;color:#94a3b8;background:none;border:none;cursor:pointer;text-decoration:underline;margin-top:4px">\u00d7 Effacer les filtres</button>':'')
      +'</div>':'';

  /* ── Futurs arrivants : arrive > aujourd'hui ET dans la période sélectionnée ──
     Ex : consultant arrivant le 15/07/2026 :
     - visible en FY2026 (oct25-sep26) et Q4 FY2026 (jul-sep26) ✓
     - invisible en FY2027 (oct26-sep27) car il sera déjà arrivé avant ✓ */
  var _rT=curRange(S.year);var rTS=_rT[0],rTE=_rT[1];
  var futurs=applyFilters(inFY.filter(function(c){
    return c.arrive&&c.arrive>TODAY&&c.arrive>=rTS&&c.arrive<=rTE;
  })).sort(function(a,b){return a.arrive.localeCompare(b.arrive);});
  var actifs=applyFilters(inFY.filter(function(c){return !isGone(c)&&!(c.arrive&&c.arrive>TODAY&&c.arrive>=rTS&&c.arrive<=rTE);}));
  var partis=applyFilters(inFY.filter(function(c){return isGone(c);}));

  function makeRow(c,gone,futur){
    var am=getAct(c.id);var st=am?mSt(am):'none';
    /* Fiche de l'utilisateur connecté : on l'identifie pour afficher « moi ». */
    var isMe=(S.consId&&c.id===S.consId)||(c.email&&S._userEmail&&c.email.toLowerCase()===String(S._userEmail).toLowerCase());
    var meTag=isMe?'<span style="font-size:10px;font-weight:800;background:#dbeafe;color:#1e40af;padding:1px 7px;border-radius:99px;margin-left:6px">moi</span>':'';
    var rs=gone?'opacity:.4;background:#f8fafc;':futur?'background:#f0fdf4;':'';
    var ns=gone?'text-decoration:line-through;':'';
    var tag=gone
      ?'<span style="font-size:10px;background:#f1f5f9;color:#94a3b8;padding:2px 6px;border-radius:4px;margin-left:6px">Parti'+(c.depart?' '+fDt(c.depart):'')+'</span>'
      :futur
        ?'<span style="font-size:10px;background:#bbf7d0;color:#15803d;padding:2px 8px;border-radius:4px;margin-left:6px;font-weight:700">\uD83D\uDCC5 Arrive le '+fDt(c.arrive)+'</span>'
        :'';
    return '<tr style="'+rs+'"><td><div style="display:flex;align-items:center;gap:10px">'+av(c.name,32)
      +'<div><div style="font-weight:600;font-size:13px;'+ns+'">'+esc(c.name)+meTag+tag+(c.contract==='freelance'?'<span style="font-size:10px;font-weight:800;background:#ede9fe;color:#7c3aed;padding:1px 6px;border-radius:99px">Freelance</span>':'')+'</div>'
      +'<div style="font-size:11px;color:#94a3b8">'+esc(c.email)+'</div></div></div></td>'
      +'<td>'+esc(c.title)+'</td>'
      +'<td style="font-weight:700;'+(gone?'color:#cbd5e1':'')+'">'+fEur(c.scr)+'</td>'
      +'<td>'+(am?'<div style="font-weight:600;font-size:13px">'+esc(am.cli)+'</div><div style="font-size:11px;color:#94a3b8">'+esc(am.name)+'</div>':futur?'<span style="color:#22c55e;font-size:12px">Recrutement</span>':'<span style="color:#cbd5e1">\u2014</span>')+'</td>'
      +'<td>'+(gone?'<span style="font-size:11px;color:#94a3b8">Inactif</span>':futur?'<span style="background:#dcfce7;color:#15803d;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">À venir</span>':badge(st,am&&am.ed?dL(am.ed):null))+'</td>'
      +'<td class="tr"><button class="lb" style="margin-right:10px" data-act="ec" data-id="'+c.id+'">Modifier</button>'
      +'<button class="lr" data-act="dc" data-id="'+c.id+'">Suppr.</button></td></tr>';
  }

  var sepFutur=futurs.length?'<tr><td colspan="6" style="padding:4px 12px;background:#f0fdf4;border-bottom:1px solid #bbf7d0"><span style="font-size:11px;color:#15803d;font-weight:700">\uD83D\uDCC5 Prochaines arriv\u00e9es ('+futurs.length+')</span></td></tr>':'';
  var sepActif=actifs.length&&futurs.length?'<tr><td colspan="6" style="padding:4px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0"><span style="font-size:11px;color:#64748b;font-weight:600">Consultants actifs ('+actifs.length+')</span></td></tr>':'';
  var sepParti=partis.length?'<tr><td colspan="6" style="padding:4px 12px;background:#f8fafc;border-top:1px solid #e2e8f0"><span style="font-size:11px;color:#94a3b8;font-weight:600">Partis ce FY ('+partis.length+')</span></td></tr>':'';

  var rows=sepFutur+futurs.map(function(c){return makeRow(c,false,true);}).join('')
    +sepActif+actifs.map(function(c){return makeRow(c,false,false);}).join('')
    +sepParti+partis.map(function(c){return makeRow(c,true,false);}).join('');

  var sub=actifs.length+' actif'+(actifs.length!==1?'s':'')
    +(futurs.length?' \u00b7 '+futurs.length+' \u00e0 venir':'')
    +' \u00b7 '+fyLbl(S.year)
    +(partis.length?' \u00b7 '+partis.length+' parti'+(partis.length!==1?'s':'')+' ce FY':'');

  return '<div><div class="ph"><div><div class="pt">\u00c9quipe</div><div class="ps">'+sub+'</div></div>'
    +'<div style="display:flex;gap:8px;flex-shrink:0">'
    +'<button class="bg" data-act="import-cons-open" title="Importer votre \u00e9quipe depuis un fichier Excel ou CSV">\ud83d\udce5 Importer (Excel/CSV)</button>'
    +'<button class="bp" data-act="ac">+ Ajouter un membre</button></div></div>'
    +filtersHtml
    +'<div class="card ov"><table style="min-width:640px">'
    +'<thead><tr><th>'+rLabel('utilisateur')+'</th><th>Poste</th><th>SCR/j</th><th>Mission actuelle</th><th>Statut</th><th class="tr">Actions</th></tr></thead>'
    +'<tbody>'+rows+(inFY.length?'':'<tr><td colspan="6" class="emp">Aucun consultant sur ce FY.</td></tr>')
    +'</tbody></table></div></div>';
}

