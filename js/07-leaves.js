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

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TIME SHEET (CRA) \u2014 document mensuel par consultant, valid\u00e9 par le N+1
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Un Time Sheet = un (consultant, mois) avec un cycle de vie
   brouillon \u2192 soumis \u2192 approuv\u00e9/refus\u00e9. Le contenu est AUTO-D\u00c9RIV\u00c9 du calendrier
   (missions + planning + cong\u00e9s) : le consultant relit son mois et le soumet, le
   N+1 le valide dans \u00ab Approbations \u00bb. Un mois approuv\u00e9 est VERROUILL\u00c9 (plus de
   modif des missions/absences de ce mois) tant que le N+1 ne l'a pas d\u00e9-valid\u00e9.
   \u2192 \u00ab r\u00e9alis\u00e9 & approuv\u00e9 \u00bb vs \u00ab r\u00e9alis\u00e9 non approuv\u00e9 \u00bb = le STATUT du TS du mois. */
var TS_MNAMES=['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'];
function tsMonthLabel(month){var y=month.slice(0,4),m=+month.slice(5,7);return TS_MNAMES[m-1]+' '+y;}
var TS_STATUS={
  none:     {lb:'\u00c0 soumettre',bg:'#f1f5f9',fg:'#475569'},
  draft:    {lb:'Brouillon',      bg:'#f1f5f9',fg:'#475569'},
  submitted:{lb:'En attente',     bg:'#fef3c7',fg:'#92400e'},
  approved: {lb:'Valid\u00e9',     bg:'#dcfce7',fg:'#15803d'},
  rejected: {lb:'Refus\u00e9',     bg:'#fee2e2',fg:'#b91c1c'}
};
function tsPill(status){var s=TS_STATUS[status]||TS_STATUS.none;return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:'+s.bg+';color:'+s.fg+'">'+(status==='approved'?'\uD83D\udd12 ':'')+esc(s.lb)+'</span>';}

/* Le TS d'un (consultant, mois), ou null. */
function tsFor(cid,month){return (S.timesheets||[]).find(function(t){return t.cid===cid&&t.month===month;})||null;}
function tsById(id){return (S.timesheets||[]).find(function(t){return t.id===id;})||null;}
function tsStatus(cid,month){var t=tsFor(cid,month);return t?t.status:'none';}
function tsApprovedMonth(cid,month){return tsStatus(cid,month)==='approved';}

/* R\u00e9partition auto-d\u00e9riv\u00e9e d'un mois pour un consultant (m\u00eame classification que
   le calendrier Activit\u00e9) : jours factur\u00e9s / interne / cong\u00e9s-arr\u00eats / dispo. */
function tsMonthBreakdown(cid,month){
  var y=+month.slice(0,4),m=+month.slice(5,7);
  var dim=new Date(y,m,0).getDate();
  var hset=frHols(y);
  var c=((S._all&&S._all.cons)||S.cons||[]).find(function(x){return x.id===cid;})||{};
  var billed=0,internal=0,leave=0,avail=0,workdays=0;
  for(var d=1;d<=dim;d++){
    var ds=fD(new Date(y,m-1,d));
    if(isWE(ds)||hset.has(ds))continue;
    if(c.arrive&&ds<c.arrive)continue;
    if(c.depart&&ds>c.depart)continue;
    workdays++;
    var lv=leaveOnDay(cid,ds);
    if(lv){ if(lv.type==='Mission interne'||lv.type==='Inter-contrat')internal++; else leave++; }
    else if(missOnDay(cid,ds))billed++;
    else avail++;
  }
  return {billed:billed,internal:internal,leave:leave,avail:avail,workdays:workdays};
}

/* \u2500\u2500 Verrouillage : un mois approuv\u00e9 bloque toute modif de missions/absences \u2500\u2500 */
/* L'intervalle [s,e] (dates 'YYYY-MM-DD') touche-t-il un mois approuv\u00e9 du consultant ?
   e nul = mission en cours (sans fin) \u2192 verrou d\u00e8s qu'un mois approuv\u00e9 \u2265 mois de d\u00e9but. */
function tsRangeLocked(cid,s,e){
  if(!cid||!s)return false;
  var ms=s.slice(0,7),me=e?e.slice(0,7):null;
  return (S.timesheets||[]).some(function(t){
    if(t.cid!==cid||t.status!=='approved')return false;
    if(t.month<ms)return false;
    if(me&&t.month>me)return false;
    return true;
  });
}
/* Une liste de jours 'YYYY-MM-DD' touche-t-elle un mois approuv\u00e9 du consultant ? */
function tsDaysLocked(cid,days){
  if(!cid||!days||!days.length)return false;
  return days.some(function(d){return tsApprovedMonth(cid,String(d).slice(0,7));});
}
function tsLockAlert(){
  alert('Ce mois a un Time Sheet approuv\u00e9 : il est verrouill\u00e9.\n\n'
    +'Le N+1 doit le d\u00e9-valider (onglet Time Sheet) avant toute modification des '
    +'missions ou absences de ce mois.');
}

/* Qui peut valider / d\u00e9-valider un TS ? Son approbateur d\u00e9sign\u00e9, ou \u00e0 d\u00e9faut un
   r\u00f4le encadrant (fallback d\u00e9mo / TS appliqu\u00e9 directement sans N+1). */
function canValidateTs(t){
  if(t&&t.approverId&&S._userId)return t.approverId===S._userId;
  return S.role==='super_admin'||S.role==='admin'||S.role==='gestionnaire';
}

/* Suite de mois 'YYYY-MM' couvrant l'intervalle de dates [s,e]. */
function tsMonthsInRange(s,e){
  var out=[],y=+s.slice(0,4),m=+s.slice(5,7),ey=+e.slice(0,4),em=+e.slice(5,7);
  while(y<ey||(y===ey&&m<=em)){out.push(y+'-'+String(m).padStart(2,'0'));m++;if(m>12){m=1;y++;}}
  return out;
}

function tTimesheet(){
  var _pc=personalCons();
  if(!_pc.length)return '<div class="emp">Aucun consultant.</div>';
  if(!_pc.find(function(x){return x.id===S.tsCid;}))S.tsCid=(_pc.find(function(x){return x.id===S.consId;})||_pc[0]).id;
  var cid=S.tsCid,c=_pc.find(function(x){return x.id===cid;})||{};
  var isSelf=(cid===S.consId);
  var curMonth=TODAY.slice(0,7);
  var _r=curRange(S.year);
  var months=tsMonthsInRange(_r[0],_r[1]).filter(function(m){return m<=curMonth;}).reverse(); /* \u00e9coul\u00e9s + en cours, plus r\u00e9cent en t\u00eate */

  var consSorted=_pc.slice().sort(function(a,b){if(a.id===S.consId)return -1;if(b.id===S.consId)return 1;return 0;});
  var co=consSorted.map(function(x){var lbl=(x.id===S.consId)?('\u2605 Moi \u2014 '+x.name):x.name;return '<option value="'+x.id+'"'+(x.id===cid?' selected':'')+'>'+esc(lbl)+'</option>';}).join('');

  function bCell(v,col){return '<td class="tc" style="font-weight:700;color:'+(v>0?col:'#cbd5e1')+'">'+v+'</td>';}
  var rows=months.map(function(month){
    var t=tsFor(cid,month);
    var st=t?t.status:'none';
    /* R\u00e9alis\u00e9 : snapshot fig\u00e9 si le TS est soumis/valid\u00e9, sinon calcul live. */
    var bd=(t&&t.days&&(st==='submitted'||st==='approved'))?t.days:tsMonthBreakdown(cid,month);
    var future=month>curMonth;
    var act='';
    if(future){act='<span style="color:#cbd5e1;font-size:12px">\u00e0 venir</span>';}
    else if(st==='approved'){
      act=canValidateTs(t)
        ?'<button class="lb" data-act="ts-reopen" data-id="'+t.id+'" title="Rouvrir le mois pour modification">D\u00e9-valider</button>'
        :'<span style="color:#15803d;font-size:12px;font-weight:700">\u2713 Valid\u00e9</span>';
    }else if(st==='submitted'){
      act=isSelf
        ?'<button class="lb" data-act="ts-cancel" data-id="'+(t?t.id:'')+'" data-month="'+month+'" title="Retirer la demande">Annuler</button>'
        :'<span style="color:#92400e;font-size:12px;font-weight:700">\u23f3 En attente</span>';
    }else{ /* none | draft | rejected */
      act=isSelf
        ?'<button class="bp" style="padding:5px 12px;font-size:12px" data-act="ts-submit" data-id="'+cid+'" data-month="'+month+'">'+(st==='rejected'?'Re-soumettre':'Soumettre')+'</button>'
        :'<span style="color:#94a3b8;font-size:12px">\u2014</span>';
    }
    var mainRow='<tr>'
      +'<td style="font-weight:600;color:#0f172a">'+esc(tsMonthLabel(month))+'</td>'
      +bCell(bd.billed,'#2563eb')+bCell(bd.internal,'#0f766e')+bCell(bd.leave,'#b45309')+bCell(bd.avail,bd.avail>0?'#b91c1c':'#15803d')
      +'<td class="tc">'+tsPill(st)+'</td>'
      +'<td class="tr">'+act+'</td></tr>';
    var reasonRow=(st==='rejected'&&t&&t.rejectionReason)
      ?'<tr><td colspan="7" style="padding-top:0"><div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:6px 10px;font-size:12px;color:#b91c1c"><strong>Motif du refus :</strong> '+esc(t.rejectionReason)+'</div></td></tr>'
      :'';
    return mainRow+reasonRow;
  }).join('');

  /* \u2500\u2500 Vue \u00e9quipe (encadrants) : statut des 3 derniers mois par consultant \u2500\u2500 */
  var teamCard='';
  var isManager=(S.role==='super_admin'||S.role==='admin'||S.role==='gestionnaire');
  if(isManager&&_pc.length>1){
    var last3=[];(function(){var y=+curMonth.slice(0,4),m=+curMonth.slice(5,7);for(var k=0;k<3;k++){last3.push(y+'-'+String(m).padStart(2,'0'));m--;if(m<1){m=12;y--;}}}());
    var head=last3.map(function(mm){return '<th class="tc">'+esc(tsMonthLabel(mm))+'</th>';}).join('');
    var trows=_pc.map(function(cc){
      var cells=last3.map(function(mm){return '<td class="tc">'+tsPill(tsStatus(cc.id,mm))+'</td>';}).join('');
      return '<tr><td style="font-weight:600;color:#0f172a">'+esc(cc.name)+'</td>'+cells+'</tr>';
    }).join('');
    teamCard='<details class="card" style="padding:0;margin-bottom:16px;overflow:hidden"><summary style="padding:14px 20px;font-size:13px;font-weight:800;color:#0f172a;cursor:pointer">\uD83D\udc65 Vue \u00e9quipe \u2014 statut des Time Sheet (3 derniers mois)</summary>'
      +'<div class="ov" style="padding:0 6px 6px"><table><thead><tr><th>Consultant</th>'+head+'</tr></thead><tbody>'+trows+'</tbody></table></div></details>';
  }

  return '<div class="vw">'
    +'<div class="ph"><div><div class="pt">\uD83D\udd52 Time Sheet</div>'
    +'<div class="ps">Compte rendu d\u2019activit\u00e9 mensuel \u2014 soumis pour validation \u00e0 votre N+1 \u00b7 '+esc(curLbl())+'</div></div></div>'
    +'<div class="ac acs" style="margin-bottom:16px;display:flex;gap:10px;align-items:flex-start"><div style="font-size:18px">\u2139\ufe0f</div>'
    +'<div style="font-size:12px;color:#334155;line-height:1.5">Le Time Sheet reprend automatiquement votre activit\u00e9 d\u00e9j\u00e0 saisie (missions, planning, cong\u00e9s). '
    +'Relisez le mois puis <strong>soumettez-le</strong> : votre N+1 le valide dans l\u2019onglet <strong>Approbations</strong>. '
    +'Une fois <strong>Valid\u00e9</strong> \uD83D\udd12, le mois est verrouill\u00e9 (plus de modification des missions/absences) jusqu\u2019\u00e0 une \u00e9ventuelle d\u00e9-validation.</div></div>'
    +teamCard
    +'<div style="margin-bottom:16px"><select class="ic" style="max-width:280px" id="ts-cid">'+co+'</select></div>'
    +'<div class="card ov"><table><thead><tr><th>Mois</th>'
    +'<th class="tc">Factur\u00e9s</th><th class="tc">Interne</th><th class="tc">Cong\u00e9s</th><th class="tc">Dispo</th>'
    +'<th class="tc">Statut</th><th class="tr">Action</th></tr></thead>'
    +'<tbody>'+(rows||'<tr><td colspan="7" class="emp">Aucun mois \u00e0 afficher sur '+esc(curLbl())+'.</td></tr>')+'</tbody></table></div>'
    +'</div>';
}

