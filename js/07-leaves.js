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
    +'<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">Prise CP &amp; RTT Q1 : '+esc(cpP.lb)+' (AC / CD 210 → 31 mars A+1) · Q2 : jusqu\'au 31 déc. '
    +'Quota CP ajusté par l\'ancienneté (CPA) et la présence (prorata entrants/sortants) ; RTT selon la modalité de chaque personne.</div>'
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

