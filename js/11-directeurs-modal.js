'use strict';
/* ═══════════════════════════════════════════════════════════════
   TEMPLATE - DIRECTEURS (gestion des comptes, gestionnaire uniquement)
═══════════════════════════════════════════════════════════════ */
function tAdmin(){
  if(S.role!=='gestionnaire')return '<div class="emp">Acc\u00e8s r\u00e9serv\u00e9 au directeur.</div>';
  var sbOn=!!(sb&&SB_CID);
  var allC=(S._all&&S._all.cons)||S.cons;
  var myConsList=allC.filter(function(c){return c.managerId===S._userId || (!c.managerId && (c.dir||'')===S.dirName);});
  /* Datalist des consultants de l'\u00e9quipe */
  var dlOpts=myConsList.map(function(c){return '<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>';}).join('');

  /* Tableau des invitations */
  var invRows=(S.consInvites||[]).map(function(iv){
    var st=iv.status==='active'
      ?'<span class="badge bgrn">✓ Compte créé</span>'
      :'<span class="badge bamb">⏳ En attente</span>';
    return '<tr><td>'+esc(iv.email||'')+'</td>'
      +'<td style="font-weight:600">'+esc(iv.consName||'')+'</td>'
      +'<td>'+st+'</td>'
      +'<td class="tr"><button class="lr" data-act="admin-cons-del" data-id="'+esc(iv.id||iv.code||'')+'">Suppr.</button></td></tr>';
  }).join('');

  return '<div class="vw">'
    +'<div><div class="pt">Consultants & acc\u00e8s</div><div class="ps">G\u00e9rez les comptes consultants de votre \u00e9quipe &middot; chaque consultant acc\u00e8de uniquement \u00e0 ses propres donn\u00e9es</div></div>'
    +'<div class="card" style="padding:20px">'
    +'<h3 style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:14px">Inviter un consultant</h3>'
    +(sbOn?'':'<div class="ac acs" style="margin-bottom:14px"><div style="font-size:12px">Connectez Supabase pour envoyer des invitations. En mode d\u00e9mo, cette section est en pr\u00e9visualisation.</div></div>')
    +'<div class="g2">'
    +'<div class="fd"><label class="fl">Email du consultant *</label><input class="ic" id="admin-cons-email" type="email" placeholder="prenom.nom@exemple.com"></div>'
    +'<div class="fd"><label class="fl">Nom du consultant *</label><input class="ic" id="admin-cons-name" list="esn-cons-list" placeholder="ex\u00a0: Sophie Martin"><datalist id="esn-cons-list">'+dlOpts+'</datalist><p class="fh">Doit correspondre exactement au consultant dans votre \u00e9quipe</p></div>'
    +'</div>'
    +'<button class="bp" data-act="admin-cons-add"'+(sbOn?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>+ Inviter ce consultant</button>'
    +'<p class="fh" style="margin-top:8px">Le consultant cr\u00e9era son compte avec cet email sur la page de connexion \u2014 il sera rattach\u00e9 automatiquement \u00e0 votre \u00e9quipe.</p>'
    +'</div>'
    +'<div class="card ov"><div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:700;color:#0f172a">Comptes consultants</div>'
    +'<table><thead><tr><th>Email</th><th>Consultant</th><th>Statut</th><th class="tr">Actions</th></tr></thead>'
    +'<tbody>'+invRows+(!invRows?'<tr><td colspan="4" class="emp">Aucun consultant invit\u00e9 pour le moment.</td></tr>':'')
    +'</tbody></table></div>'
    +'</div>';
}


/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - MODAL
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function tActivite(){
  if(!S.cons.length)return '<div class="emp">Aucun consultant.</div>';
  if(!S.actCid||!S.cons.find(function(c){return c.id===S.actCid;}))S.actCid=S.cons[0].id;
  if(!S.actMonth)S.actMonth=TODAY.slice(0,7);
  var cid=S.actCid,c=S.cons.find(function(x){return x.id===cid;});
  var ym=S.actMonth.split('-'),year=+ym[0],mon=+ym[1];
  var hset=frHols(year);
  var Hy=fyHols(S.year);
  var _r=curRange(S.year);var rS=_r[0],rE=_r[1];
  var period=curLbl();

  /* ── Stats sur la période sélectionnée (FY ou trimestre) ── */
  var kc=kpi(c,S.miss,S.lvs,S.year,Hy,_r);

  /* Jours intercontrat sur la période = jours ouvrés sans mission ET sans congé
     (même logique que le planning : "Disponible" = ni mission ni congé enregistré) */
  var icDays=0;
  (function(){
    var d=rS;
    while(d<=rE){
      if(isWD(d,Hy)){
        var pres=true;
        if(c.arrive&&d<c.arrive)pres=false;
        if(c.depart&&d>c.depart)pres=false;
        if(pres&&!leaveOnDay(cid,d)&&!missOnDay(cid,d))icDays++;
      }
      d=nxt(d);
    }
  }());

  /* Jours congés/arrêts sur la période (hors Inter-contrat) */
  var lvCp=S.lvs.filter(function(l){return l.cid===cid&&l.type!=='Inter-contrat'&&l.type!=='Mission interne'&&l.e>=rS&&l.s<=rE;});
  var cpDays=lvCp.reduce(function(s,l){return s+wDays(l.s>rS?l.s:rS,l.e<rE?l.e:rE,Hy);},0);

  /* Jours mission interne */
  var lvInt=S.lvs.filter(function(l){return l.cid===cid&&l.type==='Mission interne'&&l.e>=rS&&l.s<=rE;});
  var intDays=lvInt.reduce(function(s,l){return s+wDays(l.s>rS?l.s:rS,l.e<rE?l.e:rE,Hy);},0);

  /* Marge sur les missions de la période */
  var marg=kc.om!=null?kc.om.toFixed(1)+'%':'\u2014';

  function statCard(label,val,sub,col){
    return '<div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0">'
      +'<div style="font-size:22px;font-weight:800;color:'+(col||'#0f172a')+'">'+val+'</div>'
      +'<div style="font-size:12px;font-weight:700;color:#374151;margin-top:3px">'+label+'</div>'
      +(sub?'<div style="font-size:11px;color:#94a3b8;margin-top:2px">'+sub+'</div>':'')
      +'</div>';
  }

  var statsGrid='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">'
    +statCard('Jours facturés', kc.bill+'j', period, '#2563eb')
    +statCard('Jours internes', intDays+'j', 'non facturés', '#0f766e')
    +statCard('Congés &amp; arrêts', cpDays+'j', period, '#b45309')
    +statCard('Inter-contrat', icDays+'j', period, icDays>0?'#b91c1c':'#15803d')
    +statCard('Staffing', kc.sr.toFixed(0)+'%', 'marge : '+marg, kc.sr>=75?'#15803d':kc.sr>=50?'#b45309':'#b91c1c')
    +'</div>';

  /* ── Calendrier mensuel ── */
  var firstDow=(new Date(year,mon-1,1).getDay()+6)%7;
  var dim=new Date(year,mon,0).getDate();
  var MNAMES=['Janvier','F\u00e9vrier','Mars','Avril','Mai','Juin','Juillet','Ao\u00fbt','Septembre','Octobre','Novembre','D\u00e9cembre'];
  var consSortedM=S.cons.slice().sort(function(a,b){if(a.id===S.consId)return -1;if(b.id===S.consId)return 1;return 0;});
  var co=consSortedM.map(function(x){var lbl=(x.id===S.consId)?('\u2605 Moi \u2014 '+x.name):x.name;return '<option value="'+x.id+'"'+(x.id===cid?' selected':'')+'>'+esc(lbl)+'</option>';}).join('');
  var cells='',billed=0,leaveD=0,internD=0;
  for(var i=0;i<firstDow;i++)cells+='<div style="background:#f8fafc;border-radius:8px;min-height:62px"></div>';
  for(var d=1;d<=dim;d++){
    var ds=fD(new Date(year,mon-1,d));
    var we=isWE(ds),hol=hset.has(ds);
    var bg='#fff',bd='#e2e8f0',main='',sub='',txt='#0f172a',clk=false;
    if(we||hol){bg='#f8fafc';bd='#eef2f7';main=hol?'Férié':'';txt='#cbd5e1';}
    else{
      var lv=leaveOnDay(cid,ds);
      if(lv){
        var intern=(lv.type==='Mission interne'||lv.type==='Inter-contrat');
        bg=intern?'#f0fdfa':'#fffbeb';bd=intern?'#99f6e4':'#fde68a';
        main=lv.type;sub=intern?'Non facturé':'Absence';clk=true;
        if(intern)internD++;else leaveD++;
      }else{
        var mm=missOnDay(cid,ds);
        if(mm){bg='#eff6ff';bd='#bfdbfe';main=mm.client||mm.cli;sub=mm.name;billed++;clk=true;}
        else{main='Disponible';txt='#94a3b8';clk=true;}
      }
    }
    var isToday=(ds===TODAY);
    var style='background:'+bg+';border:'+(isToday?'2px solid #2563eb':'1px solid '+bd)+';border-radius:8px;min-height:62px;padding:5px 7px;overflow:hidden;'+(clk?'cursor:pointer':'');
    cells+='<div'+(clk?' data-act="day" data-day="'+ds+'"':'')+' style="'+style+'">'
      +'<div style="font-size:11px;font-weight:700;color:'+txt+'">'+d+'</div>'
      +(main?'<div style="font-size:10px;font-weight:600;color:#0f172a;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(main)+'</div>':'')
      +(sub?'<div style="font-size:9px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(sub)+'</div>':'')
      +'</div>';
  }
  var dows=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(function(x){return '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-align:center;text-transform:uppercase">'+x+'</div>';}).join('');
  var lg=function(b,bd2,t){return '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:'+b+';border:1px solid '+bd2+'"></span>'+t+'</span>';};

  return '<div class="vw">'
    +'<div class="ph"><div><div class="pt">Activit\u00e9 \u2014 '+esc(c.name)+'</div>'
    +'<div class="ps">Stats : '+period+' \u00b7 Planning : '+MNAMES[mon-1]+' '+year+'</div></div></div>'

    +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">'
    +'<select class="ic" style="max-width:240px" id="act-cid">'+co+'</select>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-left:auto">'
    +'<button class="bg" data-act="act-prev" style="padding:6px 12px">\u2039</button>'
    +'<div style="font-weight:700;min-width:150px;text-align:center">'+MNAMES[mon-1]+' '+year+'</div>'
    +'<button class="bg" data-act="act-next" style="padding:6px 12px">\u203a</button>'
    +'<button class="bg" data-act="act-today" style="padding:6px 12px">Aujourd\u2019hui</button>'
    +'</div></div>'

    +statsGrid

    +'<div class="card" style="padding:16px">'
    +'<div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px">Planning \u2014 '+MNAMES[mon-1]+' '+year
    +'<span style="font-weight:400;color:#94a3b8;margin-left:10px">('+billed+'j facturés ce mois \u00b7 cliquez un jour pour le marquer)</span></div>'
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px">'+dows+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">'+cells+'</div>'
    +'<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;font-size:11px;color:#64748b">'
    +lg('#eff6ff','#bfdbfe','Mission client')+lg('#fffbeb','#fde68a','Cong\u00e9/absence')+lg('#f0fdfa','#99f6e4','Interne (non factur\u00e9)')
    +'</div></div></div>';
}

