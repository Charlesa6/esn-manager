'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - KPIs (with top clients, avg TJM, net contribution)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* ═══ Agrégat entreprise côté serveur (montée en charge) ═══
   L'agrégat serveur (S.companyKpis) reproduit exactement le calcul JS ci-dessous
   — parité prouvée (voir tests/parity/). On ne l'utilise QUE derrière le drapeau
   KPI_SERVER_AGG et QUE s'il correspond à la fenêtre affichée (même exercice +
   trimestre), sinon on retombe sur le calcul local. */
function serverCompanyKpis(){
  if(typeof KPI_SERVER_AGG==='undefined'||!KPI_SERVER_AGG||!S.companyKpis)return null;
  var key=(S.year||(typeof CFY!=='undefined'?CFY:S.year))+'|'+(S.quarter||'');
  return S.companyKpisKey===key?S.companyKpis:null;
}
/* Fusion pure : si un agrégat serveur est fourni, ses scalaires priment sur le
   calcul JS local. Testable en isolation (tests/parity/kpi-merge-parity.cjs). */
function mergeCompanyAgg(js, srv){
  if(!srv)return js;
  return {
    avgSr: srv.avgSr!=null?+srv.avgSr:js.avgSr,
    totR: +srv.totR,
    totBill: +srv.totBill,
    avgTJM: +srv.avgTJM,
    avgM: srv.avgM==null?null:+srv.avgM,
    totSalary: +srv.totSalary,
    netC: +srv.netC,
    nCons: srv.nCons!=null?+srv.nCons:js.nCons
  };
}
function tKPIs(){
  var ks=buildKS();
  var totR=ks.reduce(function(s,x){return s+x.k.rev;},0);
  var totBill=ks.reduce(function(s,x){return s+x.k.bill;},0);
  var _aktWD=ks.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var avgSr=_aktWD>0?ks.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/_aktWD:0;
  var mArr=ks.filter(function(x){return x.k.om!=null;});
  var avgM=mArr.length?mArr.reduce(function(s,x){return s+x.k.om;},0)/mArr.length:null;
  var avgTJMv=totBill>0?totR/totBill:0;
  /* Coût employeur = SCR × 113.35 (brut annuel) × 1.25 (charges patronales) × (jours présents / jours FY)
     SCR × 113.35 = salaire brut employé · × 1.25 = coût réel employeur · proratisé sur la période */
  var fyTotalWD=wDays(fyStart(S.year),fyEnd(S.year),H);
  var totSalary=fyTotalWD>0
    ?ks.reduce(function(s,x){return s+(x.c.contract==='freelance'?x.c.scr*x.k.bill:x.c.scr*SCR_FACTOR*EMPLOYER_FACTOR*(x.k.tWD/fyTotalWD));},0)
    :0;
  var netC=totR-totSalary;
  /* Montée en charge : derrière le drapeau, les scalaires de la hero-bande sont
     lus depuis l'agrégat serveur (identique au JS par parité). Les cartes par
     consultant restent locales (pagination = brique suivante). */
  var _agg=mergeCompanyAgg(
    {avgSr:avgSr,totR:totR,totBill:totBill,avgTJM:avgTJMv,avgM:avgM,totSalary:totSalary,netC:netC,nCons:ks.length},
    serverCompanyKpis()
  );
  avgSr=_agg.avgSr;totR=_agg.totR;totBill=_agg.totBill;avgTJMv=_agg.avgTJM;
  avgM=_agg.avgM;totSalary=_agg.totSalary;netC=_agg.netC;
  var top3=clientRev(ks).slice(0,3);
  var totRevP=Math.max(totR,1);
  var srBars=svgBars(ks.map(function(x){return{n:x.c.name.split(' ')[0],v:parseFloat(x.k.sr.toFixed(1))};}),function(v){return v>=80?'#16a34a':v>=50?'#d97706':'#dc2626';},'%');

  function srCol(v){return v>=80?'#16a34a':v>=50?'#d97706':'#dc2626';}
  function srBg(v){return v>=80?'#f0fdf4':v>=50?'#fffbeb':'#fff1f2';}
  function ini(n){return n.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();}

  var srLabel=avgSr>=80?'Excellent':avgSr>=60?'Correct':'À surveiller';
  /* totSalary (période) utilisé pour la carte KPI — calcul dans tModal salary_detail */

  /* Deltas vs exercice precedent (masques en vue trimestre pour rester comparable) */
  var _showDelta=!S.quarter;
  var _prev=_showDelta?(function(){
    var yr=S.year-1,Hp=holRange(fyStart(yr),fyEnd(yr)),fyWDp=wDays(fyStart(yr),fyEnd(yr),Hp);
    var ca=0,bill=0,twd=0,srw=0,sal=0;
    S.cons.forEach(function(c){var k=kpi(c,S.miss,S.lvs,yr,Hp,null);ca+=k.rev;bill+=k.bill;twd+=k.tWD||0;srw+=k.sr*(k.tWD||0);sal+=(c.contract==='freelance'?c.scr*k.bill:c.scr*SCR_FACTOR*EMPLOYER_FACTOR*(k.tWD/(fyWDp||1)));});
    return {sr:twd>0?srw/twd:0,ca:ca,tjm:bill>0?ca/bill:0,netC:ca-sal,sal:sal};
  })():null;
  function _delta(cur,prev,goodUp){
    if(!_showDelta||prev==null||!isFinite(prev)||Math.abs(prev)<1e-9)return '';
    var d=(cur-prev)/Math.abs(prev)*100;if(!isFinite(d))return '';
    var flat=Math.abs(d)<0.5,up=d>=0,good=goodUp?up:!up;
    var col=flat?'rgba(255,255,255,.4)':(good?'#86efac':'#fca5a5');
    var ar=flat?'→':(up?'▲':'▼');
    return '<div style="margin-top:9px"><span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:800;color:'+col+';background:rgba(255,255,255,.09);border-radius:99px;padding:3px 9px">'+ar+' '+(d>=0?'+':'')+d.toFixed(0)+'% <span style="font-weight:600;opacity:.6">vs N-1</span></span></div>';
  }
  function _kl(t){return '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#84CC16;margin-bottom:9px">'+t+'</div>';}
  var _kpad='padding:22px 18px 20px';
  var hero='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:linear-gradient(135deg,#84CC16,#5f9e0c);border-radius:16px;overflow:hidden;margin-bottom:24px;box-shadow:0 12px 32px rgba(27,43,58,.18)">'
    +'<div style="background:#1B2B3A;'+_kpad+'">'
    +_kl('Staffing moyen')
    +'<div style="font-size:34px;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1">'+avgSr.toFixed(1)+'<span style="font-size:17px;font-weight:600">%</span></div>'
    +'<div style="font-size:11px;font-weight:700;color:'+srCol(avgSr)+';margin-top:7px">'+srLabel+'</div>'
    +'<div style="margin-top:9px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+Math.min(avgSr,100).toFixed(0)+'%;background:#84CC16;border-radius:2px"></div></div>'
    +_delta(avgSr,_prev&&_prev.sr,true)
    +'</div>'
    +'<div style="background:#1B2B3A;'+_kpad+'">'
    +_kl('CA Total')
    +'<div style="font-size:29px;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1">'+fEur(totR)+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px">'+ks.length+' consultants &middot; '+fyLbl(S.year)+'</div>'
    +_delta(totR,_prev&&_prev.ca,true)
    +'</div>'
    +'<div style="background:#1B2B3A;'+_kpad+'">'
    +_kl('TJM moyen')
    +'<div style="font-size:29px;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1">'+(avgTJMv>0?fEur(Math.round(avgTJMv)):'&mdash;')+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px">'+(avgM!=null?'Marge moy. : '+avgM.toFixed(1)+'%':'Données insuffisantes')+'</div>'
    +_delta(avgTJMv,_prev&&_prev.tjm,true)
    +'</div>'
    +'<div style="background:#1B2B3A;'+_kpad+'">'
    +_kl('Contribution nette')
    +'<div style="font-size:29px;font-weight:900;color:'+(netC>=0?'#86efac':'#fca5a5')+';letter-spacing:-.03em;line-height:1">'+fEur(netC)+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px">CA &minus; salaires période ('+fEur(totSalary)+')</div>'
    +_delta(netC,_prev&&_prev.netC,true)
    +'</div>'
    +'<div style="background:#1B2B3A;'+_kpad+';cursor:pointer" data-act="open-salary-detail">'
    +_kl('Coût salarial')
    +'<div style="font-size:29px;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1">'+fEur(Math.round(totSalary))+'</div>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px">'+S.cons.length+' membres &middot; période en cours</div>'
    +(_delta(totSalary,_prev&&_prev.sal,false)||'<div style="margin-top:9px;font-size:9px;font-weight:800;color:#84CC16">▶ Détail par personne</div>')
    +'</div>'
    +'</div>';

  var clientHtml='<div style="display:flex;flex-direction:column;gap:16px">'
    +(top3.length?top3.map(function(cl,i){
      var pct=Math.round(cl.rev/totRevP*100);
      var rc=['#f59e0b','#94a3b8','#b45309'][i];
      var rk=['1er','2eme','3eme'][i];
      return '<div style="display:flex;align-items:center;gap:14px">'
        +'<div style="width:32px;height:32px;border-radius:8px;background:'+rc+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">'+rk+'</div>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
        +'<span style="font-weight:700;font-size:13px;color:#0f172a">'+esc(cl.name)+'</span>'
        +'<span style="font-weight:800;font-size:13px;color:#0f172a">'+fEur(cl.rev)+'</span>'
        +'</div>'
        +'<div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:'+rc+';border-radius:3px"></div>'
        +'</div>'
        +'<div style="font-size:11px;color:#94a3b8;margin-top:4px">'+pct+'% du CA total</div>'
        +'</div></div>';
    }).join(''):'<div style="font-size:13px;color:#94a3b8;text-align:center;padding:20px">Aucune donn\u00e9e</div>')
    +'</div>';

  var cards='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px">'
    +ks.map(function(x){
      var k=x.k,c=x.c;
      var col=srCol(k.sr),bg=srBg(k.sr);
      var ms=k.pm.filter(function(m){return m.days>0;});
      var msStr=ms.length?ms.map(function(m){return m.cli+' \u2014 '+m.name;}).join(' / '):'Inter-contrat';
      var marCol=k.om!=null?(k.om>=30?'#16a34a':k.om>=15?'#d97706':'#dc2626'):'#94a3b8';
      return '<div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 12px rgba(0,0,0,.07);border-top:3px solid '+col+'">'
        +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
        +'<div style="width:42px;height:42px;border-radius:10px;background:'+bg+';color:'+col+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0">'+ini(c.name)+'</div>'
        +'<div style="min-width:0;flex:1">'
        +'<div style="font-weight:700;font-size:13px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name)+'</div>'
        +'<div style="font-size:11px;color:#94a3b8;margin-top:1px">'+esc(c.title)+'</div>'
        +'</div>'
        +'<div style="text-align:right;flex-shrink:0">'
        +'<div style="font-size:20px;font-weight:900;color:'+col+'">'+k.sr.toFixed(0)+'%</div>'
        +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">staffing</div>'
        +(k.cs&&k.cs>fyStart(S.year)?'<div style="font-size:9px;color:#f59e0b;font-weight:600;margin-top:2px">\u25B6 depuis '+fDt(k.cs)+'</div>':'')
        +'</div></div>'
        +'<div style="height:4px;background:#f1f5f9;border-radius:2px;margin-bottom:12px;overflow:hidden">'
        +'<div style="height:100%;width:'+Math.min(k.sr,100).toFixed(0)+'%;background:'+col+'"></div></div>'
        +'<div style="font-size:11px;color:#64748b;margin-bottom:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(msStr)+'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'
        +'<div style="text-align:center;padding:8px 4px;background:#f8fafc;border-radius:8px">'
        +'<div style="font-size:13px;font-weight:800;color:#0f172a">'+fEur(k.rev)+'</div>'
        +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-top:2px">CA</div></div>'
        +'<div style="text-align:center;padding:8px 4px;background:#f8fafc;border-radius:8px">'
        +'<div style="font-size:13px;font-weight:800;color:'+marCol+'">'+(k.om!=null?k.om.toFixed(1)+'%':'&mdash;')+'</div>'
        +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-top:2px">Marge</div></div>'
        +'<div style="text-align:center;padding:8px 4px;background:#f8fafc;border-radius:8px">'
        +'<div style="font-size:13px;font-weight:800;color:#374151">'+(k.avgT>0?fEur(k.avgT):'&mdash;')+'</div>'
        +'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;margin-top:2px">TJM</div></div>'
        +'</div></div>';
    }).join('')+'</div>';

  var pmR=ks.map(function(x){
    var pm=x.k.pm.filter(function(m){return m.days>0;});
    if(!pm.length)return '';
    return '<div style="border-bottom:1px solid #f1f5f9">'
      +'<div style="padding:10px 20px;background:#f8fafc;display:flex;align-items:center;gap:10px">'
      +'<div style="width:24px;height:24px;border-radius:6px;background:'+srBg(x.k.sr)+';color:'+srCol(x.k.sr)+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0">'+ini(x.c.name)+'</div>'
      +'<span style="font-size:12px;font-weight:700;color:#374151">'+esc(x.c.name)+'</span>'
      +'<span style="font-size:11px;color:#94a3b8">'+pm.length+' mission'+(pm.length>1?'s':'')+'</span></div>'
      +pm.map(function(m){
        var mc=m.mar>=30?'#16a34a':m.mar>=0?'#d97706':'#dc2626';
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-top:1px solid #f1f5f9;font-size:12px">'
          +'<div style="flex:1;min-width:0"><span style="font-weight:600;color:#0f172a">'+esc(m.cli)+'</span> <span style="color:#94a3b8">&mdash; '+esc(m.name)+'</span></div>'
          +'<span style="color:#64748b;flex-shrink:0">'+m.days+'j</span>'
          +'<span style="color:#374151;flex-shrink:0">'+fEur(m.tjm)+'/j</span>'
          +'<span style="font-weight:700;color:#0f172a;flex-shrink:0">'+fEur(m.rev)+'</span>'
          +'<span style="font-weight:800;color:'+mc+';flex-shrink:0">'+m.mar.toFixed(1)+'%</span></div>';
      }).join('')+'</div>';
  }).join('');

  /* ── KPIs par consultant : tableau déroulable ── */
  /* ── KPIs par consultant : tableau déroulable + tri par colonne ── */
  var kSort=S.kpiSort||null,kAsc=S.kpiSortAsc||false;
  var ksSorted=ks.slice().sort(function(a,b){
    if(!kSort)return 0;
    var va=kSort==='ca'?a.k.rev:kSort==='marge'?(a.k.om!=null?a.k.om:-999):kSort==='tjm'?(a.k.avgT||0):a.k.sr;
    var vb=kSort==='ca'?b.k.rev:kSort==='marge'?(b.k.om!=null?b.k.om:-999):kSort==='tjm'?(b.k.avgT||0):b.k.sr;
    return kAsc?va-vb:vb-va;
  });
  function sortTh(col,label){
    var active=kSort===col;
    var arrow=active?(kAsc?' ▲':' ▼'):'';
    return '<th class="tc" style="cursor:pointer;user-select:none;color:'+(active?'#84CC16':'#94a3b8')+';font-weight:'+(active?800:600)+'" data-act="kpi-sort" data-id="'+col+'">'+label+arrow+'</th>';
  }
  var consKpiRows=ksSorted.map(function(x){
    var k=x.k,c=x.c;
    var mc=k.om!=null?(k.om>=30?'#16a34a':k.om>=15?'#d97706':'#dc2626'):'#94a3b8';
    return '<tr>'
      +'<td><div style="font-weight:600;font-size:13px;color:#0f172a">'+esc(c.name)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8">'+esc(c.title)+'</div></td>'
      +'<td class="tc" style="font-weight:800;font-size:13px;color:#0f172a">'+fEur(k.rev)+'</td>'
      +'<td class="tc" style="font-weight:800;color:'+mc+'">'+(k.om!=null?k.om.toFixed(1)+'%':'&mdash;')+'</td>'
      +'<td class="tc" style="font-weight:700;color:#374151">'+(k.avgT>0?fEur(k.avgT):'&mdash;')+'</td>'
      +'<td class="tc"><div style="display:inline-block;background:'+(k.sr>=80?'#f0fdf4':k.sr>=50?'#fffbeb':'#fff1f2')+';color:'+(k.sr>=80?'#16a34a':k.sr>=50?'#d97706':'#dc2626')+';padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">'+k.sr.toFixed(0)+'%</div></td>'
      +'</tr>';
  }).join('');

  var consKpiSection='<details style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;overflow:hidden"'+(kSort?' open':'')+'>'  
    +'<summary style="display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:14px;font-weight:800;color:#0f172a;list-style:none;user-select:none" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'  
    +'\uD83D\uDCCB<span style="flex:1;margin-left:8px">KPIs par Consultant</span>'
    +'<span style="font-size:11px;font-weight:700;background:#e2e8f0;color:#475569;padding:1px 8px;border-radius:99px;margin-right:6px">'+ks.length+' consultants</span>'
    +'<span style="font-size:11px;color:#94a3b8">&#x25be;</span></summary>'
    +'<div style="padding:0 0 4px"><table>'
    +'<thead><tr><th>'+rLabel('utilisateur')+'</th>'+sortTh('ca','CA')+sortTh('marge','Marge')+sortTh('tjm','TJM moy.')+sortTh('sr','Staffing')+'</tr></thead>'
    +'<tbody>'+consKpiRows+(consKpiRows?'':'<tr><td colspan="5" class="emp">Aucune donn\u00e9e sur la p\u00e9riode</td></tr>')
    +'</tbody></table></div></details>';

  return '<div class="vw">'
    +'<div style="margin-bottom:24px"><div class="pt">KPIs &mdash; '+fyLbl(S.year)+(S.quarter?' \u00b7 '+curRangeLbl():'')+'</div></div>'
    +hero
    +tForecastSection()
    +'<div style="display:grid;grid-template-columns:3fr 200px;gap:16px;margin-bottom:16px">'
    +'<div class="card" style="padding:20px">'
    +'<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px">Staffing par consultant (%)</div>'
    +srBars+'</div>'
    +'<div class="card" style="padding:16px"><div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:12px">Top clients &mdash; CA</div>'+clientHtml+'</div>'
    +'</div>'
    +(S.role==='admin'?tKPIsDirSection():S.role==='super_admin'?tKPIsSVPSection():consKpiSection)
    +'</div>';
}


/* ══════════════════════════════════════════════════════════════
   TEMPLATE - KPIs DIRECTEURS (gestionnaire)
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TEMPLATE - KPIs SVP (3 niveaux : VP → Directeur → Consultant)
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   PRÉVISIONNEL DE CA (12 mois) + MARGE CONSOLIDÉE PAR BU / PRACTICE
   Backlog sécurisé = missions en cours/à venir projetées mois par mois
   (jours travaillés × TJM, ou forfait proraté). Pipeline pondéré = valeur des
   opportunités ouvertes × probabilité, étalée sur leur durée à partir de la date
   de démarrage. BU = Vice-Président (vpDirMap) ; Practice = directeur.
══════════════════════════════════════════════════════════════ */
function eShortEur(n){n=Math.round(n||0);var neg=n<0;n=Math.abs(n);var s=n>=1000?(Math.round(n/100)/10)+'k':String(n);return (neg?'-':'')+s+'€';}
function tForecastSection(){
  var HN=12;
  var consById={};(S.cons||[]).forEach(function(c){consById[c.id]=c;});
  var MLB=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  /* Fenêtre = exercice fiscal sélectionné (S.year). Si un trimestre est choisi, les
     mois hors trimestre restent affichés mais grisés (inPeriod=false). Un mois
     entièrement écoulé (isPast) compte comme CA réalisé, sans pipeline pondéré. */
  var fsD=pD(fyStart(S.year));
  var qDef=S.quarter?QUARTERS.find(function(q){return q.id===S.quarter;}):null;
  var months=[];
  for(var i=0;i<HN;i++){
    var d=new Date(fsD.getFullYear(),fsD.getMonth()+i,1);
    var meS=fD(new Date(d.getFullYear(),d.getMonth()+1,0)), msS=fD(d);
    months.push({ms:msS,me:meS,sec:0,secCost:0,weighted:0,
      inPeriod:!qDef||qDef.months.indexOf(d.getMonth()+1)>=0,
      isPast:meS<TODAY, isCurrent:msS<=TODAY&&TODAY<=meS,
      lb:MLB[d.getMonth()]+' '+String(d.getFullYear()).slice(2)});
  }
  function buOf(dir){
    var vp='(Sans BU)';
    Object.keys(S.vpDirMap||{}).forEach(function(v){if((S.vpDirMap[v]||[]).indexOf(dir)>=0)vp=v;});
    if(vp==='(Sans BU)'&&Object.keys(S.vpDirMap||{}).length===0&&S.svpInvites&&S.svpInvites.length===1)
      vp=S.svpInvites[0].vp_name||S.svpInvites[0].email||'(Sans BU)';
    return vp;
  }
  var buMap={};
  /* Contributions DIRECTES par nœud BU (pour l'arbre hiérarchique repliable) :
     CA sécurisé (missions) et pipeline pondéré (opportunités), sur la période. */
  var secByNode={}, secNoBu={ca:0,cost:0}, pipeByNode={}, pipeNoBu=0;
  /* ── Backlog sécurisé (missions) ── */
  (S.miss||[]).forEach(function(m){
    var c=consById[m.cid];if(!c)return;
    /* BU : hiérarchie configurée (bu_id du consultant) si disponible — BU racine
       comme niveau haut, chemin complet comme practice. Sinon repli sur l'ancien
       système VP → directeur. */
    var bkey,bname,bpath,_bid=consBU(c);
    if(_bid){var _p=buPath(_bid);
      bname=_p.length?_p[_p.length-1].name:'(Sans BU)';
      bpath=_p.length>1?_p.slice(0,-1).map(function(n){return n.name;}).join(' › '):'';
      bkey='bu:'+_bid;}
    else{var _d=(c.dir||'').trim();bname=_d||'(Sans BU)';bpath='';bkey='dir:'+(_d||'none');}
    months.forEach(function(mo){
      /* Tout le mois : le passé est compté comme réalisé (aucun clamp à aujourd'hui). */
      var a=mo.ms; if(m.sd>a)a=m.sd;
      var b=mo.me; if(m.ed&&m.ed<b)b=m.ed;
      if(a>b)return;
      var days=missWD(m,a,b,S.lvs); if(days<=0)return;
      var rev;
      if(m.btype==='forfait'){
        var totD=m.ed?missWD(m,m.sd,m.ed,S.lvs):0;
        if(!m.ed||totD<=0)return;               /* forfait sans date de fin : non projetable */
        rev=(+m.deal||0)*(days/totD);
      }else{rev=days*(m.tjm||0);}
      var cost=days*(c.scr||0)*(c.contract==='freelance'?1:EMPLOYER_FACTOR);
      mo.sec+=rev; mo.secCost+=cost;
      if(mo.inPeriod){ /* les totaux et la consolidation ne comptent que la période choisie */
        if(!buMap[bkey])buMap[bkey]={name:bname,path:bpath,ca:0,cost:0};
        buMap[bkey].ca+=rev; buMap[bkey].cost+=cost;
        if(_bid){if(!secByNode[_bid])secByNode[_bid]={ca:0,cost:0};secByNode[_bid].ca+=rev;secByNode[_bid].cost+=cost;}
        else{secNoBu.ca+=rev;secNoBu.cost+=cost;}
      }
    });
  });
  /* ── Pipeline pondéré (opportunités ouvertes) ── */
  (S.bizOpps||[]).forEach(function(o){
    if(o.status==='gagne'||o.status==='perdu')return;
    var val=caPot(o)*(+o.probability||0)/100; if(val<=0)return;
    /* Durée d'étalement : durée en mois, sinon écart démarrage→fin, sinon 1. */
    var dur=+o.duree_mois||0;
    if(!dur&&o.date_start&&o.date_end){var a=pD(o.date_start),b=pD(o.date_end);dur=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth())+1;}
    dur=Math.max(dur||1,1);
    var sd=pD(o.date_start||o.date_closing||TODAY);
    var per=val/dur;
    var obu=o.bu_id||null;
    for(var k=0;k<dur;k++){
      var dd=new Date(sd.getFullYear(),sd.getMonth()+k,1);
      for(var mi=0;mi<months.length;mi++){
        var mm=pD(months[mi].ms);
        if(mm.getFullYear()===dd.getFullYear()&&mm.getMonth()===dd.getMonth()){
          if(!months[mi].isPast){ /* pas de pipeline pondéré sur le passé */
            months[mi].weighted+=per;
            if(months[mi].inPeriod){ /* ventilation par unité, sur la période */
              if(obu)pipeByNode[obu]=(pipeByNode[obu]||0)+per; else pipeNoBu+=per;
            }
          }
          break;
        }
      }
    }
  });
  var inP=months.filter(function(m){return m.inPeriod;});
  var totSec=inP.reduce(function(s,m){return s+m.sec;},0);
  var totSecCost=inP.reduce(function(s,m){return s+m.secCost;},0);
  var totW=inP.reduce(function(s,m){return s+m.weighted;},0);
  var secMarge=totSec>0?(totSec-totSecCost)/totSec*100:null;
  var allPast=inP.length>0&&inP.every(function(m){return m.isPast;});
  var maxM=Math.max.apply(null,months.map(function(m){return m.sec+m.weighted;}).concat([1]));
  var bars=months.map(function(m){
    var tot=m.sec+m.weighted;
    var hSec=Math.round(m.sec/maxM*110),hW=Math.round(m.weighted/maxM*110);
    var dim=!m.inPeriod; /* mois hors période sélectionnée : grisé */
    var cSec=dim?'#d7dde5':'#1B2B3A', cW=dim?'#e8eef0':'#bef264';
    var cLbl=dim?'#cbd5e1':(m.isCurrent?'#65a30d':'#94a3b8');
    var cVal=dim?'#cbd5e1':'#64748b';
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0"'+(m.isCurrent?' title="Mois en cours"':'')+'>'
      +'<div style="font-size:9px;color:'+cVal+';font-weight:700;white-space:nowrap;height:12px">'+(tot>0?eShortEur(tot):'')+'</div>'
      +'<div style="display:flex;flex-direction:column;justify-content:flex-end;height:112px;width:70%;max-width:24px">'
      +(hW>0?'<div title="Pipeline pondéré : '+eShortEur(m.weighted)+'" style="height:'+hW+'px;background:'+cW+';border-radius:3px 3px 0 0"></div>':'')
      +(hSec>0?'<div title="'+(m.isPast?'CA réalisé':'Backlog sécurisé')+' : '+eShortEur(m.sec)+'" style="height:'+hSec+'px;background:'+cSec+';border-radius:'+(hW>0?'0':'3px 3px 0 0')+'"></div>':'')
      +((hW+hSec)===0?'<div style="height:2px;background:#e2e8f0"></div>':'')
      +'</div>'
      +'<div style="font-size:9px;color:'+cLbl+';font-weight:'+(m.isCurrent?'800':'400')+';white-space:nowrap">'+m.lb+'</div>'
      +'</div>';
  }).join('');
  function tile(lb,val,sub,color){
    return '<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">'
      +'<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em">'+lb+'</div>'
      +'<div style="font-size:19px;font-weight:900;color:'+(color||'#0f172a')+';margin-top:2px">'+val+'</div>'
      +(sub?'<div style="font-size:11px;color:#94a3b8;margin-top:1px">'+sub+'</div>':'')+'</div>';
  }
  /* ── Marge consolidée par unité (CA sécurisé + pipeline pondéré) ── */
  function mCol(m){return m==null?'#94a3b8':(m>=30?'#16a34a':m>=15?'#d97706':'#dc2626');}
  var _round=function(n){return Math.round(n||0);};
  var _hasBU=buNodes().length>0;
  var consTable='', consSub='';
  if(_hasBU){
    /* Arbre hiérarchique repliable : chaque nœud agrège son propre sous-arbre. */
    if(!S.buFcOpen)S.buFcOpen={};
    var aggr=function(id){
      var s=secByNode[id]||{ca:0,cost:0};
      var ca=s.ca,cost=s.cost,pipe=pipeByNode[id]||0;
      buChildren(id).forEach(function(ch){var a=aggr(ch.id);ca+=a.ca;cost+=a.cost;pipe+=a.pipe;});
      return {ca:ca,cost:cost,pipe:pipe};
    };
    var maxNodeVal=1;
    buChildren(null).forEach(function(n){var a=aggr(n.id);if(a.ca+a.pipe>maxNodeVal)maxNodeVal=a.ca+a.pipe;});
    var renderNodes=function(nodes,depth){
      return nodes.map(function(n){
        var a=aggr(n.id); if(a.ca===0&&a.pipe===0)return '';
        var kids=buChildren(n.id).filter(function(ch){var x=aggr(ch.id);return x.ca||x.pipe;});
        var hasKids=kids.length>0, open=!!S.buFcOpen[n.id];
        var marge=a.ca>0?(a.ca-a.cost)/a.ca*100:null;
        var pct=Math.max(Math.round((a.ca+a.pipe)/maxNodeVal*100),2);
        var row='<tr'+(hasKids?' data-act="bu-fc-toggle" data-id="'+n.id+'" style="cursor:pointer"':'')+'>'
          +'<td style="padding:9px 14px 9px '+(14+depth*20)+'px">'
          +'<div style="display:flex;align-items:center;gap:7px">'
          +(hasKids?'<span style="font-size:10px;color:#94a3b8;width:12px;display:inline-block;transform:rotate('+(open?'90':'0')+'deg);transition:transform .15s">▶</span>':'<span style="width:12px;display:inline-block"></span>')
          +'<span style="font-size:13px;font-weight:'+(depth===0?800:600)+';color:'+(depth===0?'#1B2B3A':'#334155')+'">'+(depth===0?'🏢 ':'')+esc(n.name)+'</span>'
          +'</div>'
          +'<div style="height:5px;background:#f1f5f9;border-radius:3px;margin-top:7px;max-width:240px;margin-left:19px"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#84CC16,#65a30d);border-radius:3px"></div></div>'
          +'</td>'
          +'<td class="tr" style="font-weight:'+(depth===0?900:700)+';color:#0f172a;white-space:nowrap;vertical-align:middle">'+fEur(_round(a.ca))+'</td>'
          +'<td class="tr" style="font-weight:'+(depth===0?800:600)+';color:#65a30d;white-space:nowrap;vertical-align:middle">'+(a.pipe>0?fEur(_round(a.pipe)):'—')+'</td>'
          +'<td class="tr" style="font-weight:800;color:'+mCol(marge)+';vertical-align:middle">'+(marge!=null?marge.toFixed(1)+'%':'—')+'</td></tr>';
        return row+(open?renderNodes(buChildren(n.id),depth+1):'');
      }).join('');
    };
    /* Chaque licence ne voit que son unité de rattachement et ses sous-unités —
       jamais les unités au-dessus d'elle ni les unités sœurs. La visibilité dépend
       UNIQUEMENT de la BU affectée (bu_id), pas du rôle : un Sénior VP rattaché à une
       unité ne voit que son sous-arbre, même quand il reporte à un autre Sénior VP.
       Seul un compte sans BU (typiquement le propriétaire au sommet) voit tout. */
    var _my=myBuId();
    var roots=!_my?buChildren(null):[buById(_my)].filter(Boolean);
    var treeRows=renderNodes(roots,0);
    /* La ligne « Sans unité » agrège des données hors hiérarchie : réservée à la vue
       globale (compte sans BU), sinon elle fuiterait au-delà du périmètre de l'unité. */
    if(!_my&&(secNoBu.ca>0||pipeNoBu>0)){
      var mN=secNoBu.ca>0?(secNoBu.ca-secNoBu.cost)/secNoBu.ca*100:null;
      treeRows+='<tr><td style="padding:9px 14px 9px 33px;color:#94a3b8;font-style:italic">Sans unité</td>'
        +'<td class="tr" style="font-weight:700;color:#64748b">'+fEur(_round(secNoBu.ca))+'</td>'
        +'<td class="tr" style="color:#94a3b8">'+(pipeNoBu>0?fEur(_round(pipeNoBu)):'—')+'</td>'
        +'<td class="tr" style="color:'+mCol(mN)+'">'+(mN!=null?mN.toFixed(1)+'%':'—')+'</td></tr>';
    }
    consSub='hiérarchie dépliable · cliquez une unité pour voir ses sous-unités';
    consTable=treeRows?('<div class="ov"><table><thead><tr><th>Unité</th><th class="tr">CA sécurisé</th><th class="tr">Pipeline pondéré</th><th class="tr">Marge nette</th></tr></thead><tbody>'+treeRows+'</tbody></table></div>'):'';
  } else {
    /* Fallback : aucune hiérarchie configurée → liste plate par unité/directeur. */
    var buList=Object.keys(buMap).map(function(k){var x=buMap[k];
      return {name:x.name,path:x.path,ca:x.ca,cost:x.cost,marge:x.ca>0?(x.ca-x.cost)/x.ca*100:null};
    }).sort(function(a,b){return b.ca-a.ca;});
    var maxBuCa=Math.max.apply(null,buList.map(function(b){return b.ca;}).concat([1]));
    var flatRows=buList.map(function(bu){
      var pct=Math.max(Math.round(bu.ca/maxBuCa*100),2);
      return '<tr><td style="padding:10px 14px">'
        +'<div style="font-size:13px;font-weight:800;color:#1B2B3A">🏢 '+esc(bu.name)+'</div>'
        +(bu.path?'<div style="font-size:10px;color:#94a3b8;margin-top:1px">'+esc(bu.path)+'</div>':'')
        +'<div style="height:5px;background:#f1f5f9;border-radius:3px;margin-top:7px;max-width:240px"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#84CC16,#65a30d);border-radius:3px"></div></div>'
        +'</td>'
        +'<td class="tr" style="font-weight:900;color:#0f172a;white-space:nowrap;vertical-align:middle">'+fEur(Math.round(bu.ca))+'</td>'
        +'<td class="tr" style="font-weight:800;color:'+mCol(bu.marge)+';vertical-align:middle">'+(bu.marge!=null?bu.marge.toFixed(1)+'%':'—')+'</td></tr>';
    }).join('');
    consSub='dernier niveau, comparables entre elles';
    consTable=flatRows?('<div class="ov"><table><thead><tr><th>Unité</th><th class="tr">CA sécurisé</th><th class="tr">Marge nette</th></tr></thead><tbody>'+flatRows+'</tbody></table></div>'):'';
  }

  var winLbl=qDef?(qDef.lb+' · '+fyLbl(S.year)):fyLbl(S.year);
  var sub=allPast
    ? 'Période écoulée : CA réalisé (missions). Aucun pipeline pondéré sur le passé.'
    : 'Backlog sécurisé (missions projetées) + pipeline pondéré (opportunités × probabilité)'+(qDef?'. Les mois hors '+qDef.lb+' sont grisés.':'');
  return '<div class="card" style="padding:18px 20px;margin-bottom:16px">'
    +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px">🔮 Prévisionnel de CA — '+esc(winLbl)+'</div>'
    +'<div style="font-size:12px;color:#94a3b8;margin-bottom:14px">'+sub+'</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">'
    +tile('CA sécurisé'+(qDef?' ('+qDef.lb+')':''),fEur(Math.round(totSec)),'Marge nette '+(secMarge!=null?secMarge.toFixed(1)+'%':'—'),'#1B2B3A')
    +tile('Pipeline pondéré',allPast?'—':fEur(Math.round(totW)),allPast?'Aucun sur le passé':'Opportunités × probabilité','#65a30d')
    +tile(allPast?'Total réalisé':'Total prévisionnel',fEur(Math.round(totSec+totW)),allPast?'CA réalisé sur la période':'Sécurisé + pondéré','#0f172a')
    +'</div>'
    +'<div style="display:flex;align-items:flex-end;gap:4px;padding:6px 2px 0;border-top:1px solid #f1f5f9">'+bars+'</div>'
    +'<div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:#64748b;flex-wrap:wrap">'
    +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;background:#1B2B3A;border-radius:2px;display:inline-block"></span>Sécurisé / réalisé</span>'
    +'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;background:#bef264;border-radius:2px;display:inline-block"></span>Pipeline pondéré</span>'
    +(qDef?'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;background:#d7dde5;border-radius:2px;display:inline-block"></span>Hors '+esc(qDef.lb)+'</span>':'')
    +'</div>'
    +(consTable?('<div style="margin-top:18px"><div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px">Marge consolidée par unité <span style="font-weight:500;color:#94a3b8">— '+consSub+' · '+esc(winLbl)+'</span></div>'
      +consTable+'</div>'):'')
    +'</div>';
}

function tKPIsSVPSection(){
  var allKS=buildKS();
  var dSort=S.kpiDirSort||null,dAsc=S.kpiDirSortAsc||false;
  var colDef='display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 24px;align-items:center;gap:8px';

  function sortBtn(col,label){
    var active=dSort===col;
    var arrow=active?(dAsc?' \u25b2':' \u25bc'):'';
    return '<button style="background:none;border:none;cursor:pointer;font-weight:'+(active?800:600)+';color:'+(active?'#84CC16':'#94a3b8')+';font-size:11px;padding:0;font-family:\'Nunito\',sans-serif;text-transform:uppercase;letter-spacing:.04em" data-act="kpi-dir-sort" data-id="'+col+'">'+label+arrow+'</button>';
  }
  function srBadge(v){
    return '<span style="background:'+(v>=80?'#f0fdf4':v>=50?'#fffbeb':'#fff1f2')+';color:'+(v>=80?'#16a34a':v>=50?'#d97706':'#dc2626')+';padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">'+v.toFixed(0)+'%</span>';
  }
  function aggKS(list){
    var ca=list.reduce(function(s,x){return s+x.k.rev;},0);
    var bills=list.reduce(function(s,x){return s+x.k.bill;},0);
    var mars=list.filter(function(x){return x.k.om!=null;}).map(function(x){return x.k.om;});
    var twd=list.reduce(function(s,x){return s+(x.k.tWD||0);},0);
    var sr=twd>0?list.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/twd:0;
    return{ca:ca,tjm:bills>0?ca/bills:0,marge:mars.length?mars.reduce(function(s,v){return s+v;},0)/mars.length:null,sr:sr};
  }
  function sortList(list,keyFn){
    if(!dSort)return list;
    return list.slice().sort(function(a,b){
      var va=keyFn(a),vb=keyFn(b);
      return dAsc?va-vb:vb-va;
    });
  }
  function kpiVal(agg,col){
    return col==='ca'?agg.ca:col==='marge'?(agg.marge!=null?agg.marge:-999):col==='sr'?agg.sr:agg.tjm;
  }
  function fmtMarge(m){return m!=null?(m>=30?'#16a34a':m>=15?'#d97706':'#dc2626'):'#94a3b8';}

  /* ── Grouper par VP → Directeur ── */
  var vpMap={};
  allKS.forEach(function(x){
    var dir=x.c.dir||'(Sans directeur)';
    var vp='(Sans VP)';
    /* Cherche dans vpDirMap si ce directeur y est référencé */
    Object.keys(S.vpDirMap||{}).forEach(function(v){if((S.vpDirMap[v]||[]).indexOf(dir)>=0)vp=v;});
    /* Fallback : si vpDirMap vide et un seul VP invité, tout lui appartient */
    if(vp==='(Sans VP)'&&Object.keys(S.vpDirMap||{}).length===0&&S.svpInvites&&S.svpInvites.length===1){
      vp=S.svpInvites[0].vp_name||S.svpInvites[0].email||'(Sans VP)';
    }
    if(!vpMap[vp])vpMap[vp]={};
    if(!vpMap[vp][dir])vpMap[vp][dir]=[];
    vpMap[vp][dir].push(x);
  });

  /* ── VP list triée ── */
  var vpList=Object.keys(vpMap).map(function(vpName){
    var all=[];Object.keys(vpMap[vpName]).forEach(function(d){all=all.concat(vpMap[vpName][d]);});
    var agg=aggKS(all);
    return{name:vpName,agg:agg,count:all.length,dirs:vpMap[vpName]};
  });
  vpList=sortList(vpList,function(v){return kpiVal(v.agg,dSort);});

  /* ── HTML VP cards ── */
  var vpCards=vpList.map(function(vp){
    var a=vp.agg,mc=fmtMarge(a.marge);
    var vpOpen=!!(S.kpiVPOpen&&S.kpiVPOpen[vp.name]);
    var vKey=vp.name.replace(/'/g,"\\'");

    /* Directeurs dans ce VP */
    var dirList=Object.keys(vp.dirs).map(function(dirName){
      var dKS=vp.dirs[dirName];
      var da=aggKS(dKS);
      return{name:dirName,agg:da,cons:dKS};
    });
    dirList=sortList(dirList,function(d){return kpiVal(d.agg,dSort);});

    var dirCards=dirList.map(function(dir){
      var da=dir.agg,dmc=fmtMarge(da.marge);
      var dirKey=(vp.name+'|||'+dir.name).replace(/'/g,"\\'");
      var dirOpen=!!(S.kpiDirDirOpen&&S.kpiDirDirOpen[vp.name+'|||'+dir.name]);

      /* Consultants dans ce directeur */
      var sortedCons=sortList(dir.cons,function(x){
        return dSort==='ca'?x.k.rev:dSort==='marge'?(x.k.om!=null?x.k.om:-999):dSort==='sr'?x.k.sr:(x.k.avgT||0);
      });
      var consRows=sortedCons.map(function(x){
        var k=x.k,c=x.c;
        var cmc=k.om!=null?(k.om>=30?'#16a34a':k.om>=15?'#d97706':'#dc2626'):'#94a3b8';
        return '<div style="'+colDef+';padding:8px 14px 8px 44px;border-top:1px solid #f1f5f9;background:#f8fafc">'
          +'<div><div style="font-weight:600;font-size:12px;color:#374151">'+esc(c.name)+'</div>'
          +'<div style="font-size:10px;color:#94a3b8">'+esc(c.title)+'</div></div>'
          +'<div style="text-align:center;font-size:12px;font-weight:700;color:#0f172a">'+fEur(k.rev)+'</div>'
          +'<div style="text-align:center;font-size:12px;font-weight:700;color:'+cmc+'">'+(k.om!=null?k.om.toFixed(1)+'%':'&mdash;')+'</div>'
          +'<div style="text-align:center;font-size:12px;color:#374151">'+(k.avgT>0?fEur(k.avgT):'&mdash;')+'</div>'
          +'<div style="text-align:center">'+srBadge(k.sr)+'</div>'
          +'<div></div></div>';
      }).join('');

      return '<details'+(dirOpen?' open':'')+' ontoggle="if(!S.kpiDirDirOpen)S.kpiDirDirOpen={};S.kpiDirDirOpen[\''+dirKey+'\']=this.open">'
        +'<summary style="'+colDef+';padding:11px 14px 11px 28px;cursor:pointer;list-style:none;border-top:1px solid #e2e8f0;background:#fafafa" onmouseover="this.style.background=\'#f0f0f0\'" onmouseout="this.style.background=\'#fafafa\'">'
        +'<div><div style="font-weight:700;color:#0f172a;font-size:12px">\uD83D\uDC64 '+esc(dir.name)+'</div>'
        +'<div style="font-size:10px;color:#94a3b8">'+dir.cons.length+' consultant'+(dir.cons.length>1?'s':'')+'</div></div>'
        +'<div style="text-align:center;font-weight:800;font-size:13px;color:#0f172a">'+fEur(da.ca)+'</div>'
        +'<div style="text-align:center;font-weight:700;color:'+dmc+'">'+(da.marge!=null?da.marge.toFixed(1)+'%':'&mdash;')+'</div>'
        +'<div style="text-align:center;font-weight:700;color:#374151">'+(da.tjm>0?fEur(Math.round(da.tjm)):'&mdash;')+'</div>'
        +'<div style="text-align:center">'+srBadge(da.sr)+'</div>'
        +'<div style="text-align:right;font-size:12px;color:#94a3b8">\u25be</div></summary>'
        +consRows
        +'</details>';
    }).join('');

    return '<details'+(vpOpen?' open':'')+' ontoggle="if(!S.kpiVPOpen)S.kpiVPOpen={};S.kpiVPOpen[\''+vKey+'\']=this.open">'
      +'<summary style="'+colDef+';padding:14px 16px;cursor:pointer;list-style:none;border-top:1px solid #e2e8f0" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
      +'<div><div style="font-weight:700;color:#0f172a;font-size:13px">\uD83D\uDC54 '+esc(vp.name)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8">'+vp.count+' consultant'+(vp.count>1?'s':'')+'</div></div>'
      +'<div style="text-align:center;font-weight:900;font-size:14px;color:#0f172a">'+fEur(a.ca)+'</div>'
      +'<div style="text-align:center;font-weight:800;color:'+mc+'">'+(a.marge!=null?a.marge.toFixed(1)+'%':'&mdash;')+'</div>'
      +'<div style="text-align:center;font-weight:700;color:#374151">'+(a.tjm>0?fEur(Math.round(a.tjm)):'&mdash;')+'</div>'
      +'<div style="text-align:center">'+srBadge(a.sr)+'</div>'
      +'<div style="text-align:right;font-size:14px;color:#94a3b8">\u25be</div></summary>'
      +dirCards
      +'</details>';
  }).join('');

  /* ── Total ESN ── */
  var totA=aggKS(allKS);
  var totMc=fmtMarge(totA.marge);
  var totalRow='<div style="'+colDef+';padding:14px 16px;background:#f0fdf4;border-top:2px solid #84CC16">'
    +'<div style="font-weight:800;color:#1B2B3A">\u03a3 Total ESN</div>'
    +'<div style="text-align:center;font-weight:900;font-size:14px;color:#1B2B3A">'+fEur(totA.ca)+'</div>'
    +'<div style="text-align:center;font-weight:800;color:'+totMc+'">'+(totA.marge!=null?totA.marge.toFixed(1)+'%':'&mdash;')+'</div>'
    +'<div style="text-align:center;font-weight:700;color:#1B2B3A">'+(totA.tjm>0?fEur(Math.round(totA.tjm)):'&mdash;')+'</div>'
    +'<div style="text-align:center">'+srBadge(totA.sr)+'</div>'
    +'<div></div></div>';

  return '<details style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;overflow:hidden"'+(dSort?' open':'')+'>'
    +'<summary style="display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:14px;font-weight:800;color:#0f172a;list-style:none;user-select:none" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
    +'\uD83D\uDCCA<span style="flex:1;margin-left:8px">KPIs VP</span>'
    +'<span style="font-size:11px;font-weight:700;background:#e2e8f0;color:#475569;padding:1px 8px;border-radius:99px;margin-right:6px">'+vpList.length+' VP</span>'
    +'<span style="font-size:11px;color:#94a3b8">&#x25be;</span></summary>'
    +'<div style="'+colDef+';padding:10px 16px;background:#f8fafc;border-top:1px solid #e2e8f0">'
    +'<div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">'+rLabel('admin')+'</div>'
    +'<div style="text-align:center">'+sortBtn('ca','CA')+'</div>'
    +'<div style="text-align:center">'+sortBtn('marge','Marge')+'</div>'
    +'<div style="text-align:center">'+sortBtn('tjm','TJM moy.')+'</div>'
    +'<div style="text-align:center">'+sortBtn('sr','Staffing')+'</div>'
    +'<div></div></div>'
    +vpCards
    +totalRow
    +'</details>';
}

function tKPIsDirSection(){
  var allKS=buildKS();
  var dSort=S.kpiDirSort||null,dAsc=S.kpiDirSortAsc||false;

  /* Grouper par directeur */
  var dirs={};
  allKS.forEach(function(x){
    var dir=x.c.dir||'(Sans directeur)';
    if(!dirs[dir])dirs[dir]={ca:0,bills:0,margins:[],cons:[]};
    var d=dirs[dir];
    d.ca+=x.k.rev;d.bills+=x.k.bill;
    if(x.k.om!=null)d.margins.push(x.k.om);
    d.cons.push(x);
  });

  var dirList=Object.keys(dirs).map(function(dir){
    var d=dirs[dir];
    var totTWD=d.cons.reduce(function(s,x){return s+(x.k.tWD||0);},0);
    var avgSrDir=totTWD>0?d.cons.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/totTWD:0;
    return{name:dir,ca:d.ca,
      tjm:d.bills>0?d.ca/d.bills:0,
      marge:d.margins.length?d.margins.reduce(function(s,v){return s+v;},0)/d.margins.length:null,
      sr:avgSrDir,
      count:d.cons.length,cons:d.cons};
  });

  /* Tri directeurs */
  if(dSort)dirList.sort(function(a,b){
    var va=dSort==='ca'?a.ca:dSort==='marge'?(a.marge!=null?a.marge:-999):dSort==='sr'?a.sr:a.tjm;
    var vb=dSort==='ca'?b.ca:dSort==='marge'?(b.marge!=null?b.marge:-999):dSort==='sr'?b.sr:b.tjm;
    return dAsc?va-vb:vb-va;
  });

  function dSortBtn(col,label){
    var active=dSort===col;
    var arrow=active?(dAsc?' \u25b2':' \u25bc'):'';
    return '<button style="background:none;border:none;cursor:pointer;font-weight:'+(active?800:600)+';color:'+(active?'#84CC16':'#94a3b8')+';font-size:11px;padding:0;font-family:\'Nunito\',sans-serif;text-transform:uppercase;letter-spacing:.04em" data-act="kpi-dir-sort" data-id="'+col+'">'+label+arrow+'</button>';
  }

  /* Colonnes header */
  var colDef='display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 24px;align-items:center;gap:8px';

  /* Lignes par directeur */
  var dirCards=dirList.map(function(d){
    var mc=d.marge!=null?(d.marge>=30?'#16a34a':d.marge>=15?'#d97706':'#dc2626'):'#94a3b8';
    /* Consultants triés par même colonne */
    var sortedCons=d.cons.slice().sort(function(a,b){
      if(!dSort)return 0;
      var va=dSort==='ca'?a.k.rev:dSort==='marge'?(a.k.om!=null?a.k.om:-999):dSort==='sr'?a.k.sr:(a.k.avgT||0);
      var vb=dSort==='ca'?b.k.rev:dSort==='marge'?(b.k.om!=null?b.k.om:-999):dSort==='sr'?b.k.sr:(b.k.avgT||0);
      return dAsc?va-vb:vb-va;
    });
    var consRows=sortedCons.map(function(x){
      var k=x.k,c=x.c;
      var cmc=k.om!=null?(k.om>=30?'#16a34a':k.om>=15?'#d97706':'#dc2626'):'#94a3b8';
      return '<div style="'+colDef+';padding:10px 16px 10px 28px;border-top:1px solid #f1f5f9;background:#f8fafc">'
        +'<div><div style="font-weight:600;font-size:12px;color:#374151">'+esc(c.name)+'</div>'
        +'<div style="font-size:10px;color:#94a3b8">'+esc(c.title)+'</div></div>'
        +'<div style="text-align:center;font-size:12px;font-weight:700;color:#0f172a">'+fEur(k.rev)+'</div>'
        +'<div style="text-align:center;font-size:12px;font-weight:700;color:'+cmc+'">'+(k.om!=null?k.om.toFixed(1)+'%':'&mdash;')+'</div>'
        +'<div style="text-align:center;font-size:12px;color:#374151">'+(k.avgT>0?fEur(k.avgT):'&mdash;')+'</div>'
        +'<div style="text-align:center"><span style="background:'+(k.sr>=80?'#f0fdf4':k.sr>=50?'#fffbeb':'#fff1f2')+';color:'+(k.sr>=80?'#16a34a':k.sr>=50?'#d97706':'#dc2626')+';padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700">'+k.sr.toFixed(0)+'%</span></div>'
        +'<div></div>'
        +'</div>';
    }).join('');
    var isOpen=!!(S.kpiDirOpen&&S.kpiDirOpen[d.name]);
    var srBg2=d.sr>=80?'#f0fdf4':d.sr>=50?'#fffbeb':'#fff1f2';
    var srFg2=d.sr>=80?'#16a34a':d.sr>=50?'#d97706':'#dc2626';
    var dKey=d.name.replace(/'/g,"\\'");
    return '<details'+(isOpen?' open':'')+' ontoggle="if(!S.kpiDirOpen)S.kpiDirOpen={};S.kpiDirOpen[\''+dKey+'\']=this.open">'
      +'<summary style="'+colDef+';padding:14px 16px;cursor:pointer;list-style:none;border-top:1px solid #e2e8f0" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
      +'<div><div style="font-weight:700;color:#0f172a;font-size:13px">'+esc(d.name)+'</div>'
      +'<div style="font-size:11px;color:#94a3b8">'+d.count+' consultant'+(d.count>1?'s':'')+'</div></div>'
      +'<div style="text-align:center;font-weight:900;font-size:14px;color:#0f172a">'+fEur(d.ca)+'</div>'
      +'<div style="text-align:center;font-weight:800;color:'+mc+'">'+(d.marge!=null?d.marge.toFixed(1)+'%':'&mdash;')+'</div>'
      +'<div style="text-align:center;font-weight:700;color:#374151">'+(d.tjm>0?fEur(Math.round(d.tjm)):'&mdash;')+'</div>'
      +'<div style="text-align:center"><span style="background:'+srBg2+';color:'+srFg2+';padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">'+d.sr.toFixed(0)+'%</span></div>'
      +'<div style="text-align:right;font-size:14px;color:#94a3b8">\u25be</div>'
      +'</summary>'
      +consRows
      +'</details>';
  }).join('');

  /* Totaux */
  var totCA=allKS.reduce(function(s,x){return s+x.k.rev;},0);
  var totBill=allKS.reduce(function(s,x){return s+x.k.bill;},0);
  var allMar=allKS.filter(function(x){return x.k.om!=null;});
  var totTJM=totBill>0?totCA/totBill:0;
  var totMar=allMar.length?allMar.reduce(function(s,x){return s+x.k.om;},0)/allMar.length:null;
  var totMc=totMar!=null?(totMar>=30?'#16a34a':totMar>=15?'#d97706':'#dc2626'):'#94a3b8';
  var totTWDAll=allKS.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var totSrAll=totTWDAll>0?allKS.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/totTWDAll:0;
  var totSrBg=totSrAll>=80?'#f0fdf4':totSrAll>=50?'#fffbeb':'#fff1f2';
  var totSrFg=totSrAll>=80?'#16a34a':totSrAll>=50?'#d97706':'#dc2626';
  var totalRow='<div style="'+colDef+';padding:14px 16px;background:#f0fdf4;border-top:2px solid #84CC16">'
    +'<div style="font-weight:800;color:#1B2B3A">\u03a3 Total ESN</div>'
    +'<div style="text-align:center;font-weight:900;font-size:14px;color:#1B2B3A">'+fEur(totCA)+'</div>'
    +'<div style="text-align:center;font-weight:800;color:'+totMc+'">'+(totMar!=null?totMar.toFixed(1)+'%':'&mdash;')+'</div>'
    +'<div style="text-align:center;font-weight:700;color:#1B2B3A">'+(totTJM>0?fEur(Math.round(totTJM)):'&mdash;')+'</div>'
    +'<div style="text-align:center"><span style="background:'+totSrBg+';color:'+totSrFg+';padding:2px 10px;border-radius:99px;font-size:12px;font-weight:700">'+totSrAll.toFixed(0)+'%</span></div>'
    +'<div></div></div>';

  return '<details style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;overflow:hidden"'+(dSort?' open':'')+'>'
    +'<summary style="display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:14px;font-weight:800;color:#0f172a;list-style:none;user-select:none" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'\'">'
    +'\uD83D\uDCCA<span style="flex:1;margin-left:8px">KPIs par '+rLabel('gestionnaire')+'</span>'
    +'<span style="font-size:11px;font-weight:700;background:#e2e8f0;color:#475569;padding:1px 8px;border-radius:99px;margin-right:6px">'+dirList.length+' directeurs</span>'
    +'<span style="font-size:11px;color:#94a3b8">&#x25be;</span></summary>'
    +'<div style="'+colDef+';padding:10px 16px;background:#f8fafc;border-top:1px solid #e2e8f0">'
    +'<div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">'+rLabel('gestionnaire')+'</div>'
    +'<div style="text-align:center">'+dSortBtn('ca','CA')+'</div>'
    +'<div style="text-align:center">'+dSortBtn('marge','Marge')+'</div>'
    +'<div style="text-align:center">'+dSortBtn('tjm','TJM moy.')+'</div>'
    +'<div style="text-align:center">'+dSortBtn('sr','Staffing')+'</div>'
    +'<div></div></div>'
    +dirCards
    +totalRow
    +'</details>';
}


