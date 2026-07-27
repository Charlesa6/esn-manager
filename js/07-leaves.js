'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - LEAVES
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* ═══ Soldes Congés payés & RTT Q1 (règles CGI — mémo Congés Payés) ═══
   Décompte en jours ouvrés (lun–ven, hors fériés). Fenêtres de PRISE (calendaires,
   indépendantes du FY) — identiques pour CP et RTT Q1 (modalités MS/RM) :
     du 1er janvier de l'année A au 31 janvier A+1 (reliquats perdus au-delà).
   Quotas plein temps par défaut : CP 27 j ouvrés (acquis 1 juin A-1 → 31 mai A),
   RTT Q1 12 j (modalité Standard). Éditables (accord d'entreprise / modalité).
   Année de campagne A = année courante ; en janvier on reste sur la campagne A-1
   (sa prise court jusqu'au 31 jan). NB : CPA ancienneté et jours Q2 non modélisés. */
function leaveCampaignYear(){var d=pD(TODAY);return d.getMonth()===0?d.getFullYear()-1:d.getFullYear();}
function cpPeriod(){var A=leaveCampaignYear();return {s:A+'-01-01',e:(A+1)+'-01-31',N:A,lb:'prise 1 jan '+A+' → 31 jan '+(A+1)};}
function rttPeriod(){return cpPeriod();}
function cpQuota(){return (S.settings&&S.settings.cpQuota!=null)?+S.settings.cpQuota:27;}
function rttQuota(){return (S.settings&&S.settings.rttQuota!=null)?+S.settings.rttQuota:12;}
/* Jours ouvrés posés d'un type d'absence pour un consultant, dans une fenêtre. */
function leaveDaysTaken(cid,type,p){
  var HS=holRange(p.s,p.e),sum=0;
  (S.lvs||[]).forEach(function(l){
    if(l.cid!==cid||l.type!==type)return;
    if(l.e<p.s||l.s>p.e)return;                 /* hors fenêtre */
    var a=l.s>p.s?l.s:p.s,b=l.e<p.e?l.e:p.e;    /* clamp à la fenêtre */
    sum+=wDays(a,b,HS);
  });
  return sum;
}
/* Réglage global des quotas (admin/super_admin) — persisté dans company_settings. */
function setLeaveQuota(kind,val){
  var n=parseFloat(val);if(isNaN(n)||n<0)n=0;
  if(!S.settings)S.settings={};
  if(kind==='cp')S.settings.cpQuota=n;else S.settings.rttQuota=n;
  if(typeof persistImportPresets==='function')persistImportPresets();
  render();
}
/* Formatage d'un nombre de jours (entiers ou demi-journées) avec l'unité. */
function fmtJ(n){n=Math.round((n||0)*2)/2;return (n%1===0?String(n):n.toFixed(1))+' j';}
function round2(n){return Math.round((n||0)*2)/2;}

/* ── Ancienneté (CPA) : jours de CP supplémentaires selon le barème CGI ── */
function seniorityYears(c){
  if(!c||!c.arrive)return 0;
  var a=pD(c.arrive),t=pD(TODAY),y=t.getFullYear()-a.getFullYear();
  if(t.getMonth()<a.getMonth()||(t.getMonth()===a.getMonth()&&t.getDate()<a.getDate()))y--;
  return Math.max(0,y);
}
function cpaDays(years){return years>=8?4:years>=5?3:years>=3?2:years>=2?1:0;}

/* ── Modalité temps de travail → quota RTT Q1 et date limite de prise ── */
var MODALITE_LB={MS:'Standard',RM:'Réalisation de mission',AC:'Autonomie complète',CD:'Cadre dirigeant',CD210:'Cadre dirigeant 210'};
function rttBaseForModalite(m){switch(m){case 'RM':return 10;case 'AC':return 10;case 'CD':return 0;case 'CD210':return 5;default:return rttQuota();/* MS = quota éditable */}}
/* Fenêtre de prise RTT Q1 : 31 jan A+1 (MS/RM) ou 31 mars A+1 (AC / CD210). */
function rttPeriodFor(c){var A=leaveCampaignYear();var late=c&&(c.modalite==='AC'||c.modalite==='CD210');return {s:A+'-01-01',e:(A+1)+(late?'-03-31':'-01-31'),N:A};}
/* Fenêtre de prise des jours Q2 : jusqu'au 31 décembre A. */
function q2Period(){var A=leaveCampaignYear();return {s:A+'-01-01',e:A+'-12-31',N:A};}

/* ── Proration entrants / sortants : fraction de présence sur une fenêtre ── */
function presenceFraction(c,rs,re){
  var a=(c.arrive&&c.arrive>rs)?c.arrive:rs;
  var d=(c.depart&&c.depart<re)?c.depart:re;
  if(a>d)return 0;                                  /* aucune présence sur la fenêtre */
  var dm=86400000;
  var total=Math.round((pD(re)-pD(rs))/dm)+1;
  var pres=Math.round((pD(d)-pD(a))/dm)+1;
  return Math.max(0,Math.min(1,pres/total));
}

/* Quotas annualisés d'un consultant (CP avec ancienneté + proration, RTT selon
   modalité + proration, Q2 souscrits). */
function leaveQuotasFor(c){
  var A=leaveCampaignYear();
  var sen=seniorityYears(c);
  var cpFrac=presenceFraction(c,(A-1)+'-06-01',A+'-05-31');   /* acquisition CP */
  var rttFrac=presenceFraction(c,A+'-01-01',A+'-12-31');       /* acquisition RTT */
  var cpBase=cpQuota()+cpaDays(sen);
  return {
    sen:sen, cpa:cpaDays(sen), modalite:c.modalite||'MS',
    cpFrac:cpFrac, rttFrac:rttFrac,
    cp:round2(cpBase*cpFrac), cpBase:cpBase,
    rtt:round2(rttBaseForModalite(c.modalite)*rttFrac),
    q2:(c.q2Days!=null?+c.q2Days:0)
  };
}

/* ═══ Contrôle de solde avant demande de congé (CP / RTT Q1 / Q2) ═══
   Renvoie {capped:false} pour un type non plafonné (maladie, formation…), sinon
   {capped:true, ok, need, remaining, quota, taken, label, period}. `excludeLvId`
   exclut la demande en cours d'édition pour ne pas la compter deux fois. */
function checkLeaveBalance(cid,type,s,e,excludeLvId){
  if(type!=='Congé payé'&&type!=='RTT'&&type!=='RTT Q2')return {capped:false};
  var c=((S._all&&S._all.cons)||S.cons||[]).find(function(x){return x.id===cid;});
  if(!c)return {capped:false};
  var Q=leaveQuotasFor(c),period,quota,label;
  if(type==='Congé payé'){period=cpPeriod();quota=Q.cp;label='congés payés';}
  else if(type==='RTT'){period=rttPeriodFor(c);quota=Q.rtt;label='RTT Q1';}
  else{period=q2Period();quota=Q.q2;label='jours Q2';}
  var HS=holRange(period.s,period.e),taken=0;
  ((S._all&&S._all.lvs)||S.lvs||[]).forEach(function(l){
    if(l.cid!==cid||l.type!==type)return;
    if(excludeLvId&&l.id===excludeLvId)return;
    if(l.e<period.s||l.s>period.e)return;
    var a=l.s>period.s?l.s:period.s,b=l.e<period.e?l.e:period.e;
    taken+=wDays(a,b,HS);
  });
  var need=0;
  if(s&&e&&!(e<period.s||s>period.e)){var na=s>period.s?s:period.s,nb=e<period.e?e:period.e;need=wDays(na,nb,HS);}
  var remaining=round2(quota-taken);
  return {capped:true,ok:need<=remaining+1e-9,need:round2(need),remaining:remaining,quota:round2(quota),taken:round2(taken),label:label,period:period};
}
/* Indicateur de solde affiché dans le modal de demande d'absence. */
function leaveBalanceHintHTML(cid,type,s,e,excludeLvId){
  var r=checkLeaveBalance(cid,type,s,e,excludeLvId);
  if(!r.capped)return '';
  var remCol=r.remaining<0?'#dc2626':'#15803d';
  var h='<div style="font-size:12px;color:#475569">Solde '+r.label+' : <strong style="color:'+remCol+'">'+fmtJ(r.remaining)+'</strong> restants / '+fmtJ(r.quota)+' ('+fmtJ(r.taken)+' déjà posés) · '+esc(r.period.lb)+'</div>';
  if(s&&e&&r.need>0){
    h+='<div style="font-size:12px;font-weight:800;margin-top:3px;color:'+(r.ok?'#15803d':'#dc2626')+'">Cette demande : '+fmtJ(r.need)+' ouvrés → '+(r.ok?'✓ dans le solde':'✗ dépasse le solde de '+fmtJ(r.need-r.remaining))+'</div>';
  }
  return h;
}
function updateLeaveBalanceHint(){
  var el=document.getElementById('lv-bal-hint');if(!el)return;
  var g=function(id){var x=document.getElementById(id);return x?x.value:'';};
  var exclude=(S.modal&&S.modal.item)?S.modal.item.id:null;
  var html=leaveBalanceHintHTML(g('mlc'),g('mlt'),g('mls'),g('mle'),exclude);
  el.innerHTML=html;el.style.display=html?'block':'none';
}
/* Carte tableau de bord des soldes CP / RTT Q1 / Q2 pour une liste de consultants. */
function leaveBalanceCard(consList){
  var canEdit=(S.role==='admin'||S.role==='super_admin');
  var cpP=cpPeriod();
  function qFld(kind,q){
    return canEdit
      ?'<input type="number" min="0" step="0.5" value="'+q+'" onchange="setLeaveQuota(\''+kind+'\',this.value)" style="width:52px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:800;text-align:center">'
      :'<strong>'+q+'</strong>';
  }
  function bar(taken,q,col){
    var pct=q>0?Math.min(Math.round(taken/q*100),100):0;
    return '<div style="height:5px;background:#eef2f6;border-radius:3px;margin-top:5px;max-width:120px"><div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:3px"></div></div>';
  }
  function balCells(taken,q,col,title){
    if(q<=0&&taken<=0)return '<td class="tc" style="color:#cbd5e1">—</td><td class="tc" style="color:#cbd5e1">—</td>';
    var rem=q-taken;var remCol=rem<0?'#dc2626':'#0f172a';
    return '<td class="tc" style="white-space:nowrap"'+(title?' title="'+esc(title)+'"':'')+'><span style="font-weight:800;color:#0f172a">'+fmtJ(taken)+'</span><span style="color:#94a3b8;font-size:11px"> / '+fmtJ(q)+'</span>'+bar(taken,q,col)+'</td>'
      +'<td class="tc" style="font-weight:800;color:'+remCol+'">'+fmtJ(rem)+'</td>';
  }
  var rows=consList.map(function(c){
    var Q=leaveQuotasFor(c);
    var cpT=leaveDaysTaken(c.id,'Congé payé',cpP);
    var rttT=leaveDaysTaken(c.id,'RTT',rttPeriodFor(c));
    var q2T=leaveDaysTaken(c.id,'RTT Q2',q2Period());
    var prorata=(Q.cpFrac<0.999||Q.rttFrac<0.999);
    var sub=(MODALITE_LB[Q.modalite]||Q.modalite)+(Q.sen>0?' · '+Q.sen+' an'+(Q.sen>1?'s':''):'')+(prorata?' · prorata':'');
    var cpTitle='CP plein temps '+fmtJ(cpQuota())+(Q.cpa?' + '+fmtJ(Q.cpa)+' ancienneté':'')+(Q.cpFrac<0.999?' × '+Math.round(Q.cpFrac*100)+'% présence':'');
    var rttTitle='RTT Q1 modalité '+(MODALITE_LB[Q.modalite]||Q.modalite)+(Q.rttFrac<0.999?' × '+Math.round(Q.rttFrac*100)+'% présence':'');
    return '<tr><td><div style="font-weight:600;color:#0f172a">'+esc(c.name)+'</div>'
      +'<div style="font-size:10px;color:#94a3b8">'+esc(sub)+'</div></td>'
      +balCells(cpT,Q.cp,'#2563eb',cpTitle)
      +balCells(rttT,Q.rtt,'#7c3aed',rttTitle)
      +balCells(q2T,Q.q2,'#c026d3','Jours Q2 souscrits (financés)')
      +'</tr>';
  }).join('');
  return '<div class="card" style="padding:18px 20px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">'
    +'<div style="font-size:14px;font-weight:800;color:#0f172a">🏖️ Soldes congés &amp; RTT <span style="font-weight:500;color:#94a3b8;font-size:12px">— règles CGI · cadres · jours ouvrés</span></div>'
    +'<div style="font-size:12px;color:#475569;display:flex;gap:16px;flex-wrap:wrap">'
    +'<span>Quota CP plein temps : '+qFld('cp',cpQuota())+' j</span><span>Quota RTT (Standard) : '+qFld('rtt',rttQuota())+' j</span></div></div>'
    +'<div style="height:6px"></div>'
    +'<div class="ov"><table><thead><tr><th>'+rLabel('utilisateur')+'</th>'
    +'<th class="tc">CP posés</th><th class="tc">CP restants</th>'
    +'<th class="tc">RTT posés</th><th class="tc">RTT restants</th>'
    +'<th class="tc">Q2 posés</th><th class="tc">Q2 restants</th></tr></thead>'
    +'<tbody>'+(rows||'<tr><td colspan="7" class="emp">Aucun consultant.</td></tr>')+'</tbody></table></div>'
    +'</div>';
}
function tLeaves(){
  var H=fyHols(S.year);
  var _r=curRange(S.year);var fyS=_r[0],fyE=_r[1];

  var fil=S.lvs.filter(function(l){
    if(S.flc!=='all'&&l.cid!==S.flc)return false;
    return l.e>=fyS&&l.s<=fyE;
  }).sort(function(a,b){return a.s.localeCompare(b.s);});

  var _pc=personalCons();
  var co='<option value="all">Tous les consultants</option>'+_pc.map(function(c){
    return '<option value="'+c.id+'"'+(c.id===S.flc?' selected':'')+'>'+esc(c.name)+'</option>';
  }).join('');

  var TCC={
    'Cong\u00e9 pay\u00e9':'#dbeafe|#1e40af','RTT':'#ede9fe|#5b21b6','RTT Q2':'#fae8ff|#86198f',
    'Formation':'#dcfce7|#15803d','Inter-contrat':'#ffedd5|#c2410c',
    'Maladie':'#fee2e2|#b91c1c','Cong\u00e9 maternit\u00e9':'#fce7f3|#9d174d',
    'Cong\u00e9 sans solde':'#f1f5f9|#475569','Mission interne':'#ccfbf1|#0f766e','Autre':'#f1f5f9|#475569'
  };
  function isArret(t){return t==='Maladie'||t==='Cong\u00e9 maternit\u00e9'||t==='Cong\u00e9 sans solde';}

  var bodyHtml='';

  if(S.flc==='all'){
    /* ── Vue synth\u00e8se : indicateur par consultant ── */
    var sumRows=_pc.map(function(c){
      var clvs=S.lvs.filter(function(l){return l.cid===c.id&&l.e>=fyS&&l.s<=fyE;});
      if(!clvs.length)return '';
      var cpJ=0,arJ=0;
      clvs.forEach(function(l){
        /* Clamp à la période sélectionnée */
        var effS=l.s>fyS?l.s:fyS;
        var effE=l.e<fyE?l.e:fyE;
        var wd=wDays(effS,effE,H);
        if(isArret(l.type))arJ+=wd;
        else if(l.type!=='Inter-contrat')cpJ+=wd;
      });
      if(!cpJ&&!arJ)return '';
      var tot=cpJ+arJ;
      return '<tr>'
        +'<td style="font-weight:600;color:#0f172a">'+esc(c.name)+'</td>'
        +'<td class="tc"><span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">'+cpJ+'j</span></td>'
        +'<td class="tc"><span style="background:#fee2e2;color:#b91c1c;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">'+arJ+'j</span></td>'
        +'<td class="tc" style="font-weight:800;color:#0f172a;font-size:14px">'+tot+'j</td>'
        +'<td class="tr"><button class="lb" data-act="lvc" data-id="'+c.id+'">\u2192 D\u00e9tail</button></td>'
        +'</tr>';
    }).filter(Boolean).join('');
    bodyHtml='<table><thead><tr><th>'+rLabel('utilisateur')+'</th><th class="tc">Cong\u00e9s &amp; RTT</th>'
      +'<th class="tc">Arr\u00eats / Mat.</th><th class="tc">Total '+curLbl()+'</th><th></th></tr></thead>'
      +'<tbody>'+sumRows+(sumRows?'':'<tr><td colspan="5" class="emp">Aucune absence enregistr\u00e9e sur le '+curLbl()+'</td></tr>')
      +'</tbody></table>';
  } else {
    /* ── Vue d\u00e9tail consultant ── */
    var detRows=fil.map(function(l){
      /* Clamp à la période pour n'afficher que les jours dans la fenêtre */
      var effS=l.s>fyS?l.s:fyS;
      var effE=l.e<fyE?l.e:fyE;
      var wd=wDays(effS,effE,H);
      var tc=(TCC[l.type]||'#f1f5f9|#475569').split('|');
      return '<tr>'
        +'<td><span style="display:inline-flex;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:'+tc[0]+';color:'+tc[1]+'">'+esc(l.type)+'</span></td>'
        +'<td>'+fDt(l.s)+'</td><td>'+fDt(l.e)+'</td>'
        +'<td class="tc" style="font-weight:700">'+wd+'j</td>'
        +'<td class="tr"><button class="lb" style="margin-right:10px" data-act="el" data-id="'+l.id+'">Modifier</button>'
        +'<button class="lr" data-act="dl" data-id="'+l.id+'">Suppr.</button></td>'
        +'</tr>';
    }).join('');
    var totCP=0,totAr=0;
    fil.forEach(function(l){
      var effS=l.s>fyS?l.s:fyS;
      var effE=l.e<fyE?l.e:fyE;
      var wd=wDays(effS,effE,H);
      if(isArret(l.type))totAr+=wd;
      else if(l.type!=='Inter-contrat')totCP+=wd;
    });
    var tot=totCP+totAr;
    var totRow=fil.length
      ?'<tr style="background:#f8fafc;border-top:2px solid #e2e8f0">'
        +'<td colspan="3" style="font-weight:700;color:#0f172a">TOTAL '+curLbl()+'</td>'
        +'<td class="tc" style="font-weight:800;color:#0f172a;font-size:15px">'+tot+'j</td><td></td></tr>'
      :'';
    bodyHtml='<div style="display:flex;gap:8px;margin-bottom:12px">'
      +'<span style="background:#dbeafe;color:#1e40af;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:700">Cong\u00e9s &amp; RTT : '+totCP+'j</span>'
      +'<span style="background:#fee2e2;color:#b91c1c;padding:3px 12px;border-radius:99px;font-size:12px;font-weight:700">Arr\u00eats : '+totAr+'j</span>'
      +'</div>'
      +'<table><thead><tr><th>Type</th><th>Du</th><th>Au</th>'
      +'<th class="tc">Jours ouvrés</th><th class="tr">Actions</th></tr></thead>'
      +'<tbody>'+detRows+totRow+(fil.length?'':'<tr><td colspan="5" class="emp">Aucune absence sur le '+curLbl()+'</td></tr>')
      +'</tbody></table>';
  }

  var hols=HOLS_N.map(function(h){
    return '<div style="font-size:11px;color:#374151;display:flex;gap:5px;align-items:center"><span style="color:#16a34a">\u2713</span>'+esc(h)+'</div>';
  }).join('');
  var sub=S.flc==='all'
    ?fil.length+' p\u00e9riode'+(fil.length!==1?'s':'')+' \u00b7 '+curLbl()
    :esc((S.cons.find(function(c){return c.id===S.flc;})||{name:''}).name)+' \u00b7 '+curLbl();

  /* Tableau de bord des soldes CP/RTT : tous les consultants du p\u00e9rim\u00e8tre en vue
     synth\u00e8se, la personne s\u00e9lectionn\u00e9e en vue d\u00e9tail. */
  var balList=S.flc==='all'?_pc:_pc.filter(function(c){return c.id===S.flc;});

  return '<div><div class="ph"><div><div class="pt">Absences &amp; Cong\u00e9s</div><div class="ps">'+sub+'</div></div>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<button class="bp" data-act="al">+ Ajouter une absence</button>'
    +'<button class="bg" onclick="document.getElementById(\'lv-xls-inp\').click()">\u2191 Importer un fichier</button>'
    +'<input type="file" id="lv-xls-inp" accept=".xlsx" style="display:none" onchange="importStaffingXLS(this.files[0]);this.value=\'\'"></div></div>'
    +leaveBalanceCard(balList)
    +'<div style="margin-bottom:16px"><select class="ic" style="max-width:240px" id="flc">'+co+'</select></div>'
    +'<div class="card ov" style="margin-bottom:16px">'+bodyHtml+'</div>'
    +'<details><summary>\uD83D\uDCC5 Jours f\u00e9ri\u00e9s fran\u00e7ais int\u00e9gr\u00e9s dans les calculs</summary>'
    +'<div style="margin-top:8px;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px 16px">'+hols+'</div></details></div>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIME SHEET (CRA) — document HEBDOMADAIRE par consultant, validé par le N+1
   ────────────────────────────────────────────────────────────────────────────
   Un Time Sheet = un (consultant, semaine) où `week` = date du lundi. Cycle de
   vie brouillon → soumis → approuvé/refusé. Le contenu est PRÉ-REMPLI depuis le
   calendrier (missions + planning + congés) mais RESTE ÉDITABLE jour par jour :
   le consultant peut corriger chaque jour (ex. « finalement jeudi = congé »).
   Quand un jour est mis en « Congé », un pop-up indique si une demande de congé
   a bien été posée en parallèle (et si elle est validée). À la validation, le
   N+1 revoit ce même récapitulatif de cohérence des congés imputés.
   Une semaine approuvée est VERROUILLÉE (plus de modif des missions/absences de
   ses jours) tant que le N+1 ne l'a pas dé-validée.
   → « réalisé & approuvé » vs « réalisé non approuvé » = le STATUT du TS. */

/* ── Utilitaires semaine (clé = date du lundi 'YYYY-MM-DD') ── */
function tsWeekMonday(dateStr){var d=pD(dateStr);var dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return fD(d);}
function tsWeekDays(monday){var out=[],d=pD(monday);for(var i=0;i<5;i++){out.push(fD(d));d.setDate(d.getDate()+1);}return out;}
function tsWeekEnd(monday){var d=pD(monday);d.setDate(d.getDate()+6);return fD(d);}          /* dimanche */
function tsShiftWeek(monday,delta){var d=pD(monday);d.setDate(d.getDate()+7*delta);return fD(d);}
function tsWeekLabel(monday){var ds=tsWeekDays(monday);return 'Semaine du '+fDt(ds[0])+' au '+fDt(ds[4]);}
var TS_DOW=['Lun','Mar','Mer','Jeu','Ven'];

var TS_STATUS={
  none:     {lb:'À soumettre',bg:'#f1f5f9',fg:'#475569'},
  draft:    {lb:'Brouillon',  bg:'#f1f5f9',fg:'#475569'},
  submitted:{lb:'En attente', bg:'#fef3c7',fg:'#92400e'},
  approved: {lb:'Validé',     bg:'#dcfce7',fg:'#15803d'},
  rejected: {lb:'Refusé',     bg:'#fee2e2',fg:'#b91c1c'}
};
function tsPill(status){var s=TS_STATUS[status]||TS_STATUS.none;return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:'+s.bg+';color:'+s.fg+'">'+(status==='approved'?'🔒 ':'')+esc(s.lb)+'</span>';}

/* Catégories saisissables d'un jour (miroir du calendrier Activité). */
var TS_CAT={
  billed:   {lb:'Facturé',        bg:'#eff6ff',fg:'#1e40af'},
  internal: {lb:'Interne',        bg:'#f0fdfa',fg:'#0f766e'},
  leave:    {lb:'Congé / Absence',bg:'#fffbeb',fg:'#92400e'},
  available:{lb:'Disponible',     bg:'#fef2f2',fg:'#b91c1c'}
};
var TS_CAT_ORDER=['billed','internal','leave','available'];
function tsCatBadge(cat){var c=TS_CAT[cat]||TS_CAT.available;return '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:'+c.bg+';color:'+c.fg+'">'+esc(c.lb)+'</span>';}

/* Le TS d'un (consultant, semaine), ou null. */
function tsFor(cid,week){return (S.timesheets||[]).find(function(t){return t.cid===cid&&t.week===week;})||null;}
function tsById(id){return (S.timesheets||[]).find(function(t){return t.id===id;})||null;}
function tsStatus(cid,week){var t=tsFor(cid,week);return t?t.status:'none';}
function tsApprovedWeek(cid,week){return tsStatus(cid,week)==='approved';}

/* Catégorie auto-dérivée d'un jour (ou null si non travaillé : week-end/férié/hors présence). */
function tsDayAuto(cid,dateStr){
  var y=+dateStr.slice(0,4),hset=frHols(y);
  if(isWE(dateStr)||hset.has(dateStr))return null;
  var c=((S._all&&S._all.cons)||S.cons||[]).find(function(x){return x.id===cid;})||{};
  if(c.arrive&&dateStr<c.arrive)return null;
  if(c.depart&&dateStr>c.depart)return null;
  var lv=leaveOnDay(cid,dateStr);
  if(lv)return (lv.type==='Mission interne'||lv.type==='Inter-contrat')?'internal':'leave';
  if(missOnDay(cid,dateStr))return 'billed';
  return 'available';
}
/* Carte des jours travaillés d'une semaine, auto-dérivée. */
function tsAutoDays(cid,monday){var map={};tsWeekDays(monday).forEach(function(d){var c=tsDayAuto(cid,d);if(c)map[d]=c;});return map;}
/* Répartition (compteurs) depuis une carte de jours. */
function tsBreakdown(daysMap){
  var b={billed:0,internal:0,leave:0,avail:0,workdays:0};
  Object.keys(daysMap||{}).forEach(function(d){var c=daysMap[d];if(!c)return;b.workdays++;if(c==='billed')b.billed++;else if(c==='internal')b.internal++;else if(c==='leave')b.leave++;else b.avail++;});
  return b;
}

/* ── Cohérence des congés : une demande de congé a-t-elle été posée pour ce jour ? ──
   'ok'      : congé enregistré ET validé (dans S.lvs, approved!==false)
   'pending' : demande posée mais pas encore validée (S.lvs approved===false, ou
               demande en attente dans la file d'approbation leave_add/leave_edit)
   'missing' : aucune demande de congé posée pour ce jour. */
function tsPendingLeaveOnDay(cid,dateStr){
  return (S.approvals||[]).find(function(r){
    if(r.status!=='pending')return false;
    if(r.type!=='leave_add'&&r.type!=='leave_edit')return false;
    var p=r.payload||{};
    return p.cid===cid&&p.s<=dateStr&&p.e>=dateStr;
  })||null;
}
function tsLeaveCheck(cid,dateStr){
  var lv=leaveOnDay(cid,dateStr);
  var isAbs=lv&&lv.type!=='Mission interne'&&lv.type!=='Inter-contrat';
  if(isAbs&&lv.approved!==false)return {state:'ok',lv:lv};
  if(isAbs&&lv.approved===false)return {state:'pending',lv:lv};
  var pend=tsPendingLeaveOnDay(cid,dateStr);
  if(pend)return {state:'pending',req:pend};
  return {state:'missing'};
}
var TS_LEAVE_BADGE={ok:['#dcfce7','#15803d','✓ Congé validé'],pending:['#fef3c7','#92400e','⏳ Congé en attente'],missing:['#fee2e2','#b91c1c','⚠ Aucune demande']};
function tsLeaveBadge(cid,date){
  var x=TS_LEAVE_BADGE[tsLeaveCheck(cid,date).state];
  return '<div style="margin-top:5px;font-size:10px;font-weight:700;background:'+x[0]+';color:'+x[1]+';border-radius:6px;padding:2px 5px;text-align:center">'+x[2]+'</div>';
}

/* ── Verrouillage : une semaine approuvée bloque toute modif de ses jours ── */
function tsRangeLocked(cid,s,e){
  if(!cid||!s)return false;
  var e2=e||'9999-12-31';                 /* mission sans fin → verrou dès qu'une semaine approuvée ≥ début */
  return (S.timesheets||[]).some(function(t){
    if(t.cid!==cid||t.status!=='approved')return false;
    var wm=t.week,we=tsWeekEnd(t.week);
    return !(e2<wm||s>we);                 /* intersection [s,e2] ∩ [lundi,dimanche] */
  });
}
function tsDaysLocked(cid,days){
  if(!cid||!days||!days.length)return false;
  return days.some(function(d){return tsApprovedWeek(cid,tsWeekMonday(String(d).slice(0,10)));});
}
function tsLockAlert(){
  alert('Cette semaine a un Time Sheet approuvé : elle est verrouillée.\n\n'
    +'Le N+1 doit la dé-valider (onglet Time Sheet) avant toute modification des '
    +'missions ou absences de ces jours.');
}

/* Qui peut valider / dé-valider un TS ? Son approbateur désigné, ou à défaut un rôle encadrant. */
function canValidateTs(t){
  if(t&&t.approverId&&S._userId)return t.approverId===S._userId;
  return S.role==='super_admin'||S.role==='admin'||S.role==='gestionnaire';
}

/* ── Tampon d'édition local de la semaine en cours (avant soumission) ── */
function tsEnsureEdit(cid,week){
  if(!S.tsEdit||S.tsEdit.cid!==cid||S.tsEdit.week!==week){
    var saved=tsFor(cid,week);
    var days=(saved&&saved.days&&Object.keys(saved.days).length)?Object.assign({},saved.days):tsAutoDays(cid,week);
    S.tsEdit={cid:cid,week:week,days:days};
  }
  return S.tsEdit;
}
/* Modifie la catégorie d'un jour ; en « Congé » → pop-up de cohérence de la demande. */
function tsSetDay(date,cat){
  if(!S.tsEdit)return;
  S.tsEdit.days[date]=cat;
  if(cat==='leave')S.modal={type:'ts_leavecheck',cid:S.tsEdit.cid,day:date};
  render();
}

function tTimesheet(){
  var _pc=personalCons();
  if(!_pc.length)return '<div class="emp">Aucun consultant.</div>';
  if(!_pc.find(function(x){return x.id===S.tsCid;}))S.tsCid=(_pc.find(function(x){return x.id===S.consId;})||_pc[0]).id;
  var cid=S.tsCid,c=_pc.find(function(x){return x.id===cid;})||{};
  var isSelf=(cid===S.consId);
  var curWeek=tsWeekMonday(TODAY);
  if(!S.tsWeek)S.tsWeek=curWeek;
  var week=S.tsWeek;
  var st=tsStatus(cid,week);
  var savedTs=tsFor(cid,week);
  var editable=isSelf&&st!=='approved'&&st!=='submitted';

  /* Source des jours affichés : tampon d'édition si éditable, sinon snapshot enregistré (ou auto). */
  var daysMap;
  if(editable){daysMap=tsEnsureEdit(cid,week).days;}
  else{daysMap=(savedTs&&savedTs.days&&Object.keys(savedTs.days).length)?savedTs.days:tsAutoDays(cid,week);}
  var bd=tsBreakdown(daysMap);

  /* Sélecteur consultant */
  var consSorted=_pc.slice().sort(function(a,b){if(a.id===S.consId)return -1;if(b.id===S.consId)return 1;return 0;});
  var co=consSorted.map(function(x){var lbl=(x.id===S.consId)?('★ Moi — '+x.name):x.name;return '<option value="'+x.id+'"'+(x.id===cid?' selected':'')+'>'+esc(lbl)+'</option>';}).join('');

  /* ── Grille éditable de la semaine ── */
  var wdays=tsWeekDays(week);
  var cards=wdays.map(function(d,i){
    var auto=tsDayAuto(cid,d);
    var cat=daysMap[d]||auto;
    var lockedDay=tsApprovedWeek(cid,tsWeekMonday(d));
    var head='<div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase">'+TS_DOW[i]+'</div>'
      +'<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px">'+fDt(d)+'</div>';
    if(!auto&&!cat){
      return '<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:10px">'+head
        +'<div style="font-size:11px;color:#cbd5e1">Non travaillé</div></div>';
    }
    var body;
    if(editable){
      body='<select onchange="tsSetDay(\''+d+'\',this.value)" style="width:100%;padding:5px 6px;border:1px solid #cbd5e1;border-radius:7px;font-size:12px;font-weight:600;color:#0f172a">'
        +TS_CAT_ORDER.map(function(k){return '<option value="'+k+'"'+(k===cat?' selected':'')+'>'+TS_CAT[k].lb+'</option>';}).join('')+'</select>';
    }else{
      body=tsCatBadge(cat);
    }
    return '<div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px">'+head
      +body
      +(cat==='leave'?tsLeaveBadge(cid,d):'')
      +'</div>';
  }).join('');

  /* ── Barre d'action de la semaine ── */
  var actionBar='';
  if(st==='approved'){
    actionBar='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+tsPill(st)
      +(canValidateTs(savedTs)?'<button class="bg" data-act="ts-reopen" data-id="'+savedTs.id+'">Dé-valider la semaine</button>':'<span style="font-size:12px;color:#15803d;font-weight:700">Semaine validée et verrouillée</span>')
      +'</div>';
  }else if(st==='submitted'){
    actionBar='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+tsPill(st)
      +(isSelf?'<button class="bg" data-act="ts-cancel" data-id="'+(savedTs?savedTs.id:'')+'" data-week="'+week+'">Annuler la demande</button>':'<span style="font-size:12px;color:#92400e;font-weight:700">En attente de validation N+1</span>')
      +'</div>';
  }else{
    actionBar='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+tsPill(st)
      +(isSelf?'<button class="bp" data-act="ts-submit" data-id="'+cid+'" data-week="'+week+'">Soumettre la semaine</button>':'<span style="font-size:12px;color:#94a3b8">Seul le consultant soumet sa semaine</span>')
      +(st==='rejected'&&savedTs&&savedTs.rejectionReason?'<span style="font-size:12px;color:#b91c1c">Refusée : '+esc(savedTs.rejectionReason)+'</span>':'')
      +'</div>';
  }

  var editorCard='<div class="card" style="padding:18px 20px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">'
    +'<button class="bg" data-act="ts-week-prev" style="padding:6px 12px">‹</button>'
    +'<div style="font-weight:800;min-width:250px;text-align:center;color:#0f172a">'+esc(tsWeekLabel(week))+'</div>'
    +'<button class="bg" data-act="ts-week-next" style="padding:6px 12px">›</button>'
    +'<button class="bg" data-act="ts-week-cur" style="padding:6px 12px">Cette semaine</button>'
    +'<div style="margin-left:auto;font-size:12px;color:#475569">'+bd.billed+'j fact. · '+bd.internal+'j int. · '+bd.leave+'j congés · '+bd.avail+'j dispo</div>'
    +'</div>'
    +(editable?'<div style="font-size:12px;color:#64748b;margin-bottom:10px">Pré-rempli depuis votre planning — <strong>modifiable</strong> jour par jour. Mettre un jour en « Congé / Absence » vérifie la demande de congé associée.</div>':'')
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">'+cards+'</div>'
    +actionBar
    +'</div>';

  /* ── Historique des semaines récentes ── */
  var histWeeks=[];for(var k=0;k<8;k++)histWeeks.push(tsShiftWeek(curWeek,-k));
  var histRows=histWeeks.map(function(wk){
    var t=tsFor(cid,wk);
    var s=t?t.status:'none';
    var b=tsBreakdown((t&&t.days)?t.days:tsAutoDays(cid,wk));
    var isCur=(wk===week);
    return '<tr'+(isCur?' style="background:#f8fafc"':'')+'>'
      +'<td style="font-weight:600;color:#0f172a">'+esc(tsWeekLabel(wk))+'</td>'
      +'<td class="tc" style="font-weight:700;color:'+(b.billed?'#2563eb':'#cbd5e1')+'">'+b.billed+'</td>'
      +'<td class="tc" style="font-weight:700;color:'+(b.internal?'#0f766e':'#cbd5e1')+'">'+b.internal+'</td>'
      +'<td class="tc" style="font-weight:700;color:'+(b.leave?'#b45309':'#cbd5e1')+'">'+b.leave+'</td>'
      +'<td class="tc" style="font-weight:700;color:'+(b.avail?'#b91c1c':'#cbd5e1')+'">'+b.avail+'</td>'
      +'<td class="tc">'+tsPill(s)+'</td>'
      +'<td class="tr">'+(isCur?'<span style="font-size:12px;color:#94a3b8">en cours</span>':'<button class="lb" data-act="ts-week" data-week="'+wk+'">Ouvrir</button>')+'</td>'
      +'</tr>';
  }).join('');
  var histCard='<div class="card ov" style="margin-bottom:16px"><table><thead><tr><th>Semaine</th>'
    +'<th class="tc">Facturés</th><th class="tc">Interne</th><th class="tc">Congés</th><th class="tc">Dispo</th>'
    +'<th class="tc">Statut</th><th class="tr">Action</th></tr></thead><tbody>'+histRows+'</tbody></table></div>';

  /* ── Vue équipe (encadrants) : statut des 3 dernières semaines par consultant ── */
  var teamCard='';
  var isManager=(S.role==='super_admin'||S.role==='admin'||S.role==='gestionnaire');
  if(isManager&&_pc.length>1){
    var last3=[tsShiftWeek(curWeek,0),tsShiftWeek(curWeek,-1),tsShiftWeek(curWeek,-2)];
    var head=last3.map(function(wk){return '<th class="tc">'+esc(fDt(wk))+'</th>';}).join('');
    var trows=_pc.map(function(cc){
      var cells=last3.map(function(wk){return '<td class="tc">'+tsPill(tsStatus(cc.id,wk))+'</td>';}).join('');
      return '<tr><td style="font-weight:600;color:#0f172a">'+esc(cc.name)+'</td>'+cells+'</tr>';
    }).join('');
    teamCard='<details class="card" style="padding:0;margin-bottom:16px;overflow:hidden"><summary style="padding:14px 20px;font-size:13px;font-weight:800;color:#0f172a;cursor:pointer">👥 Vue équipe — statut des Time Sheet (3 dernières semaines, par lundi)</summary>'
      +'<div class="ov" style="padding:0 6px 6px"><table><thead><tr><th>Consultant</th>'+head+'</tr></thead><tbody>'+trows+'</tbody></table></div></details>';
  }

  return '<div class="vw">'
    +'<div class="ph"><div><div class="pt">🕒 Time Sheet</div>'
    +'<div class="ps">Compte rendu d’activité hebdomadaire — soumis pour validation à votre N+1</div></div></div>'
    +'<div class="ac acs" style="margin-bottom:16px;display:flex;gap:10px;align-items:flex-start"><div style="font-size:18px">ℹ️</div>'
    +'<div style="font-size:12px;color:#334155;line-height:1.5">Chaque semaine est pré-remplie depuis votre planning, mais vous pouvez <strong>corriger chaque jour</strong> (ex. « finalement jeudi = congé »). '
    +'Un jour mis en « Congé » affiche si une demande de congé a bien été <strong>posée en parallèle</strong>. '
    +'Puis <strong>soumettez la semaine</strong> : votre N+1 la valide dans <strong>Approbations</strong> (il revoit la cohérence des congés). '
    +'Une fois <strong>Validée</strong> 🔒, la semaine est verrouillée.</div></div>'
    +teamCard
    +'<div style="margin-bottom:16px"><select class="ic" style="max-width:280px" id="ts-cid">'+co+'</select></div>'
    +editorCard
    +histCard
    +'</div>';
}
