'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - MISSIONS
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* Noms de missions distincts (autocomplétion + filtre) */
function missNamesDistinct(){
  var seen={},out=[];
  (S.miss||[]).forEach(function(m){var n=(m.name||'').trim();if(n&&!seen[n.toLowerCase()]){seen[n.toLowerCase()]=1;out.push(n);}});
  out.sort(function(a,b){return a.localeCompare(b);});
  return out;
}
function missNameDatalistOpts(){
  return missNamesDistinct().map(function(n){return '<option value="'+esc(n)+'"></option>';}).join('');
}
/* Pré-remplit les champs vides du formulaire mission à partir d'une mission existante de même nom */
function missPrefillFromName(){
  var el=document.getElementById('mmn');if(!el)return;
  var nm=(el.value||'').trim().toLowerCase();if(!nm)return;
  var m=(S.miss||[]).find(function(x){return (x.name||'').trim().toLowerCase()===nm;});
  if(!m)return;
  function setIfEmpty(id,val){var e=document.getElementById(id);if(e&&!e.value&&val!=null&&val!=='')e.value=String(val);}
  setIfEmpty('mcl',m.cli);setIfEmpty('mpcd',m.pcode);setIfEmpty('mtj',m.tjm?m.tjm:'');
  setIfEmpty('mlo',m.loc);setIfEmpty('mmg',m.mgr);setIfEmpty('mcc',m.ccn);setIfEmpty('mcr',m.ccr);
  setIfEmpty('msd',m.sd);setIfEmpty('med',m.ed);
}
function tMiss(){
  var ORD=['critical','soon','active','future','ended'];
  var fil=S.miss.filter(function(m){return(S.fmc==='all'||m.cid===S.fmc)&&(S.fms==='all'||mSt(m)===S.fms)&&(S.fmt==='all'||(m.btype||'at')===S.fmt)&&(!S.fmn||S.fmn==='all'||(m.name||'')===S.fmn);}).sort(function(a,b){return ORD.indexOf(mSt(a))-ORD.indexOf(mSt(b));});
  var co='<option value="all">Tous les consultants</option>'+S.cons.map(function(c){return '<option value="'+c.id+'"'+(c.id===S.fmc?' selected':'')+'>'+esc(c.name)+'</option>';}).join('');
  var cards=fil.map(function(m){
    var c=S.cons.find(function(c){return c.id===m.cid;});
    var st=mSt(m);var dl=m.ed?dL(m.ed):null;
    var isFf=m.btype==='forfait';
    var WJ=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    var wdLbl=(m.wdays&&m.wdays.length&&m.wdays.length<5)?m.wdays.slice().sort().map(function(x){return WJ[x];}).join(' '):'Tous (L\u2192V)';
    var flds=[['Client',m.cli],[rLabel('utilisateur'),c?c.name:'\u2014'],['Type',isFf?'Forfait':'Assistance technique']];
    if(isFf){flds.push(['CA deal',fEur((+m.deal)||0)]);flds.push(['Marge cible',(m.tmar!=null?m.tmar:0)+'%']);}
    else if(S.role!=='utilisateur'){flds.push(['TJM',fEur(m.tjm)]);}  /* TJM masqué pour les consultants */
    flds.push(['D\u00e9but',fDt(m.sd)]);flds.push(['Fin',fDt(m.ed)]);flds.push(['Jours/sem.',wdLbl]);
    flds.push(['Lieu',m.loc||'\u2014']);flds.push(['Resp. mission',m.mgr||'\u2014']);flds.push(['Contact client',m.ccn||'\u2014']);flds.push(['Poste contact',m.ccr||'\u2014']);
    var ffBlock='';
    if(isFf){
      var fi=forfaitInfo(m,c?c.scr:0,S.lvs);
      var leftCol=fi.left<0?'#b91c1c':fi.left<=5?'#b45309':'#15803d';
      var feas='';
      if(st!=='ended'){
        if(!m.ed){feas='<div style="color:#b45309;font-weight:600">\u26a0 date de fin manquante \u2014 faisabilit\u00e9 non \u00e9valuable</div>';}
        else{var okF=fi.slack>=0;
          feas='<div><span style="color:#94a3b8">Jours dispo d\'ici la fin : </span><strong>'+fi.avail+'</strong></div>'
            +'<div style="font-weight:700;color:'+(okF?'#15803d':'#b91c1c')+'">'+(okF?'\u2713 Faisable \u2014 marge '+fi.slack.toFixed(1)+' j':'\u2717 D\u00e9lai insuffisant \u2014 manque '+Math.abs(fi.slack).toFixed(1)+' j')+'</div>';}
      }
      ffBlock='<div style="margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:flex;gap:18px;flex-wrap:wrap;font-size:12px">'
        +'<div><span style="color:#94a3b8">Budget jours : </span><strong>'+fi.budget.toFixed(1)+'</strong></div>'
        +'<div><span style="color:#94a3b8">Travaill\u00e9s \u00e0 ce jour : </span><strong>'+fi.worked+'</strong></div>'
        +'<div><span style="color:#94a3b8">Jours restants : </span><strong style="color:'+leftCol+'">'+fi.left.toFixed(1)+'</strong></div>'
        +feas
        +(fi.left<0?'<div style="color:#b91c1c;font-weight:600">\u26a0 budget d\u00e9pass\u00e9 \u2014 marge sous la cible</div>':'')
        +'</div>';
    }
    return '<div class="card" style="padding:18px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">'
      +'<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
      +'<span style="font-weight:700;font-size:14px;color:#0f172a">'+esc(m.name)+'</span>'+badge(st,dl!=null&&dl>=0?dl:null)
      +'<span class="badge '+(isFf?'bblu':'bgry')+'">'+(isFf?'Forfait':'AT')+'</span>'
      +(!m.ed?'<span style="font-size:11px;color:#94a3b8;font-style:italic">sans date de fin</span>':'')+'</div>'
      +'<div class="gc3">'+flds.map(function(f){return '<div><span style="color:#94a3b8">'+esc(f[0])+' : </span><span style="font-weight:600;color:#243447">'+esc(f[1]||'\u2014')+'</span></div>';}).join('')+'</div>'+ffBlock+'</div>'
      +'<div style="display:flex;gap:10px;flex-shrink:0"><button class="lb" data-act="em" data-id="'+m.id+'">Modifier</button>'
      +'<button class="lr" data-act="dm" data-id="'+m.id+'">Suppr.</button></div></div></div>';
  }).join('');
  if(S.missImp!==null){
    var mi=S.missImp;
    if(!mi.headers){
      return '<div class="vw"><div class="ph"><div><div class="pt">Import de missions en masse</div>'
        +'<div class="ps">Utilisez le template Excel fourni — les consultants doivent exister dans l\'app</div></div>'
        +'<button class="bg" onclick="S.missImp=null;render()">← Retour</button></div>'
        +'<div class="card" style="padding:60px 32px;text-align:center;border:2px dashed #e2e8f0;background:#fff;border-radius:16px" id="miss-imp-dz">'
        +'<div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:8px">Glissez votre fichier Excel ici</div>'
        +'<div style="font-size:12px;color:#64748b;margin-bottom:24px">Une ligne = une mission — utilisez le template fourni</div>'
        +'<label style="display:inline-block;background:#84CC16;color:#1B2B3A;padding:11px 28px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer">'
        +'Choisir un fichier<input type="file" id="miss-imp-fi" accept=".xlsx,.xls,.csv" style="display:none"></label>'
        +'</div></div>';
    }
    var MFLDS=[[rLabel('utilisateur')+' *','Consultant *','Doit correspondre \u00e0 un consultant existant'],['name','Nom de la mission *','Libell\u00e9 de la mission'],['pcode','Code projet','Code PSA/SAP'],['cli','Client *','Soci\u00e9t\u00e9 cliente'],['tjm','TJM','TJM en \u20ac \u2014 vide si Forfait'],['sd','Date d\u00e9but *','AAAA-MM-JJ'],['ed','Date fin','Vide si mission ouverte'],['btype','Type facturation *','Valeur : AT ou Forfait'],['deal','Budget forfait (\u20ac)','Montant total \u2014 vide si AT'],['wdays','Jours/sem. *','5=L-V, 4=L-J, 3=L-Me ou codes L,M,Me,J,V'],['loc','Lieu','Ex : Paris'],['mgr','Responsable','Manager de mission'],['ccn','Contact client (Nom)','Nom du contact'],['ccr','Contact client (R\u00f4le)','Poste du contact']];
    var opts2='<option value="">-- Ignorer --</option>'+mi.headers.map(function(h,i){return '<option value="'+i+'">'+(i+1)+'. '+esc(h)+'</option>';}).join('');
    var form2=MFLDS.map(function(f){var s2='<select class="ic" id="mim-'+f[0]+'">'+opts2.replace(new RegExp('value="'+mi.map[f[0]]+'"'),'value="'+mi.map[f[0]]+'" selected')+'</select>';return '<div class="fd" style="margin-bottom:9px"><label class="fl">'+f[1]+'</label>'+s2+'<p style="font-size:11px;color:#94a3b8;margin-top:3px">'+f[2]+'</p></div>';}).join('');
    var prev2=mi.raw.slice(0,3).map(function(row){return '<tr>'+mi.headers.map(function(h,i){return '<td style="padding:4px 8px;font-size:11px;border-bottom:1px solid #f1f5f9;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(row[i]||''))+'</td>';}).join('')+'</tr>';}).join('');
    return '<div class="vw"><div class="ph"><div><div class="pt">Import missions \u2014 Mapping</div>'
      +'<div class="ps">'+esc(mi.file)+' \u00b7 '+mi.raw.length+' ligne(s)</div></div>'
      +'<button class="bg" onclick="S.missImp=null;render()">Annuler</button></div>'
      +'<div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">'
      +'<div class="card" style="padding:20px"><div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px">Association des colonnes</div>'+form2
      +'<button class="bp" style="width:100%;margin-top:8px" onclick="applyMissImp()">Importer les missions</button></div>'
      +'<div class="card" style="padding:20px"><div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px">Aper\u00e7u (3 lignes)</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'+mi.headers.map(function(h){return '<th style="padding:4px 8px;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;text-align:left">'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+prev2+'</tbody></table></div></div>'
      +'</div></div>';
  }

  return '<div><div class="ph"><div><div class="pt">Missions</div><div class="ps">'+fil.length+' r\u00e9sultat'+(fil.length!==1?'s':'')+'</div></div>'
    +'<div style="display:flex;gap:8px">'
    +'<button class="bp" data-act="am">+ Ajouter une mission</button>'
    +'<button class="bg" onclick="S.missImp={};render()">↑ Importer en masse</button>'
    +'</div></div>'
    +'<div style="display:flex;gap:10px;margin-bottom:16px">'
    +'<select class="ic" style="max-width:220px" id="fmc">'+co+'</select>'
    +'<select class="ic" style="max-width:180px" id="fms">'
    +'<option value="all"'+(S.fms==='all'?' selected':'')+'>Tous statuts</option>'
    +'<option value="critical"'+(S.fms==='critical'?' selected':'')+'>Fin &lt;14j</option>'
    +'<option value="soon"'+(S.fms==='soon'?' selected':'')+'>Fin &lt;30j</option>'
    +'<option value="active"'+(S.fms==='active'?' selected':'')+'>En mission</option>'
    +'<option value="future"'+(S.fms==='future'?' selected':'')+'>À venir</option>'
    +'<option value="ended"'+(S.fms==='ended'?' selected':'')+'>Termin\u00e9es</option></select>'
    +'<select class="ic" style="max-width:170px" id="fmt">'
    +'<option value="all"'+(S.fmt==='all'?' selected':'')+'>Tous types</option>'
    +'<option value="at"'+(S.fmt==='at'?' selected':'')+'>Assistance technique</option>'
    +'<option value="forfait"'+(S.fmt==='forfait'?' selected':'')+'>Forfait</option></select>'
    +'<select class="ic" style="max-width:220px" id="fmn">'
    +'<option value="all"'+((!S.fmn||S.fmn==='all')?' selected':'')+'>Toutes les missions</option>'
    +missNamesDistinct().map(function(n){return '<option value="'+esc(n)+'"'+(S.fmn===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')
    +'</select></div>'
    +'<div style="display:flex;flex-direction:column;gap:12px">'+(cards||'<div class="card" style="padding:48px;text-align:center;color:#94a3b8;font-size:13px">Aucune mission pour cette s\u00e9lection</div>')+'</div></div>';
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - PLANNING (Gantt)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function tPlan(){
  var fyS=pD(fyStart(S.year)),fyE=pD(fyEnd(S.year));
  var ysT=fyS.getTime(),yeT=fyE.getTime(),dur=yeT-ysT;
  var nowP=((new Date().getTime()-ysT)/dur)*100;
  /* Mois planification dynamiques selon fyStartMonth */
  var ALL_MONTHS=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  var _fm=((S.settings&&S.settings.fyStartMonth)||10)-1;
  var fyMonths=ALL_MONTHS.slice(_fm).concat(ALL_MONTHS.slice(0,_fm));
  var COL={active:'#22c55e',critical:'#ef4444',soon:'#f59e0b',future:'#22c55e',ended:'#d1d5db'};
  var LVC={'Maladie':'#1d4ed8','Cong\u00e9 maternit\u00e9':'#1d4ed8','Cong\u00e9 pay\u00e9':'#fbbf24','RTT':'#a78bfa','Formation':'#34d399','Cong\u00e9 sans solde':'#cbd5e1','Mission interne':'#60a5fa','Autre':'#d1d5db'};

  var activeCons=S.cons.filter(function(c){return !isGone(c);});

  var rows=activeCons.map(function(c,ci){
    var cm=S.miss.filter(function(m){return m.cid===c.id;});
    var cl=S.lvs.filter(function(l){return l.cid===c.id&&l.type!=='Inter-contrat';});
    var grid='';for(var i=0;i<11;i++)grid+='<div style="position:absolute;top:0;bottom:0;width:1px;background:#f1f5f9;left:'+((i+1)/12*100)+'%"></div>';
    var todayLine=nowP>=0&&nowP<=100?'<div style="position:absolute;top:0;bottom:0;width:2px;background:#3b82f6;z-index:10;left:'+nowP+'%"></div>':'';

    var bars=cm.map(function(m){
      var s=Math.max(pD(m.sd).getTime(),ysT);
      var e=Math.min(m.ed?pD(m.ed).getTime():yeT,yeT);
      if(s>yeT||e<ysT)return '';
      var left=Math.max(0,(s-ysT)/dur*100);
      var wid=Math.max(0.6,Math.min(100-left,(e-s)/dur*100));
      var st=mSt(m);var dl=m.ed?dL(m.ed):null;
      var tip=esc(m.name+'\n'+m.cli+'\nTJM : '+fEur(m.tjm)+'\nDu '+fDt(m.sd)+' au '+fDt(m.ed)+(dl!=null&&dl>=0?'\n\u26a0 J\u2212'+dl:''));
      return '<div class="gbar" style="left:'+left+'%;width:'+wid+'%;background:'+(COL[st]||'#22c55e')+'" title="'+tip+'"><span>'+esc(m.cli)+'</span></div>';
    }).join('');

    var lvBars=cl.map(function(l){
      /* Ne pas afficher visuellement les absences de moins de 3 jours ouvrés */
      if(wDays(l.s,l.e,H)<3)return '';
      var ls=Math.max(pD(l.s).getTime(),ysT);
      var le=Math.min(pD(l.e).getTime(),yeT);
      if(ls>yeT||le<ysT)return '';
      var left=Math.max(0,(ls-ysT)/dur*100);
      var wid=Math.max(0.4,Math.min(100-left,(le-ls)/dur*100));
      var col=LVC[l.type]||'#d1d5db';
      var tip=esc(l.type+' : du '+fDt(l.s)+' au '+fDt(l.e));
      return '<div class="gbar" style="left:'+left+'%;width:'+wid+'%;background:'+col+';opacity:.88;z-index:5;" title="'+tip+'"><span>'+esc(l.type)+'</span></div>';
    }).join('');

    /* ── Périodes inter-contrat : ni mission ni absence ── */
    function tsToISO(ts){var d=new Date(ts);return fD(d);}

    /* Borne de d\u00e9but IC = max(fyS, date d'arriv\u00e9e du consultant) */
    var arriveTs=c.arrive&&c.arrive>=fyStart(S.year)?pD(c.arrive).getTime():ysT;

    var covered=[];
    cm.forEach(function(m){
      var ms=Math.max(pD(m.sd).getTime(),arriveTs);
      var me=Math.min(m.ed?pD(m.ed).getTime():yeT,yeT);
      if(ms<=me)covered.push([ms,me]);
    });
    cl.forEach(function(l){
      var ls2=Math.max(pD(l.s).getTime(),arriveTs);
      var le2=Math.min(pD(l.e).getTime(),yeT);
      if(ls2<=le2)covered.push([ls2,le2]);
    });
    covered.sort(function(a,b){return a[0]-b[0];});
    var merged=[];
    covered.forEach(function(iv){
      if(!merged.length||iv[0]>merged[merged.length-1][1]+86400001)
        merged.push([iv[0],iv[1]]);
      else merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],iv[1]);
    });
    /* Les IC ne commencent qu'à partir de la date d'arrivée */
    var icGaps=[],cur=arriveTs;
    merged.forEach(function(iv){
      if(iv[0]>cur+86400001)icGaps.push([cur,iv[0]-86400000]);
      if(iv[1]+86400000>cur)cur=iv[1]+86400000;
    });
    if(cur<yeT)icGaps.push([cur,yeT]);
    var icBars=icGaps.map(function(g){
      var wd=wDays(tsToISO(g[0]),tsToISO(g[1]),H);
      if(wd<=0)return '';
      var left=Math.max(0,(g[0]-ysT)/dur*100);
      var wid=Math.max(0.4,Math.min(100-left,(g[1]-g[0])/dur*100));
      return '<div class="gbar" style="left:'+left+'%;width:'+wid+'%;background:#fca5a5;opacity:.55;z-index:1;" title="Inter-contrat : '+wd+' j ouvr\u00e9s">'
        +(wid>2.5?'<span style="color:#7f1d1d;font-weight:700;font-size:10px">IC '+wd+'j</span>':'')+'</div>';
    }).join('');

    /* ── Marqueur d'arrivée (si dans le FY) ── */
    var arriveMarker='';
    if(c.arrive&&c.arrive>fyStart(S.year)&&c.arrive<=fyEnd(S.year)){
      var arrLeft=(pD(c.arrive).getTime()-ysT)/dur*100;
      if(arrLeft>=0&&arrLeft<=100){
        arriveMarker='<div style="position:absolute;top:0;bottom:0;width:2px;background:#f59e0b;z-index:12;left:'+arrLeft+'%">'
          +'<div style="position:absolute;top:1px;left:3px;background:#f59e0b;color:#fff;font-size:9px;font-weight:800;padding:1px 4px;border-radius:3px;white-space:nowrap">'
          +'\u25B6 '+fDt(c.arrive)+'</div></div>';
      }
    }

    return '<div class="grw" style="background:'+(ci%2===0?'#fff':'#f8fafc')+'">'
      +'<div class="glb">'+av(c.name,28)+'<div style="min-width:0">'
      +'<div style="font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name.split(' ')[0])+'</div>'
      +'<div style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.title.split(' ')[0])+'</div>'
      +'</div></div><div class="gtr">'+grid+todayLine+arriveMarker+icBars+bars+lvBars+'</div></div>';
  }).join('');

  var mths=fyMonths.map(function(m){return '<div class="gm">'+m+'</div>';}).join('');
  var lgd=[
    ['#22c55e','En mission'],['#ef4444','Fin &lt;14j'],['#f59e0b','Fin &lt;30j'],['#d1d5db','Termin\u00e9e'],['#fbbf24','Cong\u00e9s pay\u00e9s'],['#1d4ed8','Arr\u00eat / Maternit\u00e9'],['#a78bfa','RTT'],['#34d399','Formation'],['#60a5fa','Mission interne'],['#fca5a5','Inter-contrat'],['#f59e0b','▶ Date d\'arrivée']].map(function(x){return '<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#64748b"><div style="width:12px;height:12px;border-radius:3px;background:'+x[0]+'"></div>'+x[1]+'</div>';}).join('');

  return '<div><div class="ph"><div><div class="pt">Planning '+fyLbl(S.year)+'</div>'
    +'<div class="ps">'+fyRange(S.year)+' \u00b7 ligne bleue = aujourd\'hui</div></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'+lgd+'</div></div>'
    +'<div class="card gwp"><div class="gin"><div class="ghd"><div class="glh">Consultant</div><div class="gms">'+mths+'</div></div>'
    +rows+(activeCons.length?'':'<div class="emp">Aucun consultant</div>')+'</div></div></div>';
}

