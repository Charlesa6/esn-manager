'use strict';
/* ════════════════════════════════════════════════════════════
   RECRUTEMENT — pipeline partagé, visible par toute l'entreprise
   ════════════════════════════════════════════════════════════ */
function tRecrutementPaywall(){
  return '<div class="vw"><div style="max-width:560px;margin:60px auto;text-align:center">'
    +'<div style="font-size:48px;margin-bottom:16px">&#x1F3AF;</div>'
    +'<div style="font-size:26px;font-weight:900;color:#1B2B3A;margin-bottom:10px">Module Recrutement</div>'
    +'<div style="font-size:15px;color:#64748b;margin-bottom:28px;line-height:1.6">Gérez votre pipeline de candidats avec 8 statuts, suivi par recruteur et conversion automatique en Utilisateur.</div>'
    +'<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:24px;text-align:left">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:12px">Ce module inclut :</div>'
    +['Pipeline candidats 8 statuts personnalisables','Recruteur assigné par candidat','Filtre & suivi par recruteur','Statuts renommables dans les Paramètres','Conversion automatique Recruté → Utilisateur'].map(function(f){return '<div style="display:flex;gap:8px;margin-bottom:6px"><span style="color:#84CC16;font-weight:800">✓</span><span style="font-size:13px;color:#374151">'+f+'</span></div>';}).join('')
    +'</div>'
    +'<a href="mailto:contact@konsilys.fr?subject=Activation module Recrutement" style="display:inline-block;background:#1B2B3A;color:#fff;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none">Contacter pour activer →</a>'
    +'<div style="font-size:12px;color:#94a3b8;margin-top:12px">contact@konsilys.fr · Activation sous 24h</div>'
    +'</div></div>';
}
function tRecrut(){
  /* Recruteur et Business Manager ont toujours accès ; les autres doivent avoir le module */
  /* Recruteur a toujours accès ; TOUS les autres (y compris Super Admin) ont besoin du module */
  if(S.role!=='recruteur'&&!(S.settings&&S.settings.hasRecrutementModule))return tRecrutementPaywall();
  if(S.recSel){
    var cand=S.cands.find(function(c){return c.id===S.recSel;});
    if(cand)return tCandDetail(cand);
    S.recSel=null;
  }
  return tRecList();
}

function recListBody(){
  var q=(S.recF.q||'').toLowerCase().trim();
  var stF=S.recF.status||'all';
  var locF=S.recF.loc||[];
  var recF=S.recF.rec||'all';
  /* Pipeline entreprise : tous les rôles ayant accès au module (recruteur,
     gestionnaire, admin, super_admin…) voient l'ensemble des candidats de
     l'entreprise. Le cloisonnement inter-entreprises est assuré par la RLS.
     L'affinage se fait via les filtres ci-dessous (Mes candidats, localisation,
     expertise) — un recruteur de Nice voit et filtre les candidats de Lyon. */
  var visibleCands=S.cands.filter(candVisibleForRole);
  var _myName=(S.profileFirstName+' '+(S.profileLastName||'')).trim();
  var expF=S.recF.exp||[];
  var list=visibleCands.filter(function(c){
    if(stF!=='all'&&c.status!==stF)return false;
    if(locF.length&&!(c.locations||[]).some(function(l){return locF.indexOf(l)>=0;}))return false;
    if(recF!=='all'&&(c.recruiter||'')!==recF)return false;
    if(S.recF.mine&&(c.recruiter||'')!==_myName&&(c.recruiter||'')!==S._userEmail&&(c.createdBy||'')!==S._userEmail)return false;
    if(expF.length&&!(c.expertise||[]).some(function(e){return expF.indexOf(e)>=0;}))return false;
    if(q){
      var hay=(c.name+' '+(c.expertise||[]).join(' ')+' '+(c.email||'')).toLowerCase();
      if(hay.indexOf(q)<0)return false;
    }
    return true;
  });

  var counts={};REC_STATUS.forEach(function(s){counts[s.id]=0;});
  S.cands.forEach(function(c){if(counts[c.status]!=null)counts[c.status]++;});

  /* Style « doux » aligné sur l'onglet Équipe : pastilles compactes, libellé de
     groupe inline (petite majuscule grise) sur la même ligne que les pastilles. */
  function fLabel(txt){return '<span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-right:8px">'+txt+'</span>';}
  function pill(id,label,count){
    var active=stF===id;
    return '<button data-act="recf-st" data-id="'+id+'" style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid '+(active?'#2563eb':'#e2e8f0')+';background:'+(active?'#2563eb':'#fff')+';color:'+(active?'#fff':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(label)+' <span style="opacity:.6">'+count+'</span></button>';
  }
  var recList=(S.recruteurInvites||[]).filter(function(r){return r.recruteur_name||r.email;});
  function recPill(rec,label){
    var active=recF===rec;
    return '<button data-act="recf-rec" data-id="'+esc(rec)+'" style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid '+(active?'#84CC16':'#e2e8f0')+';background:'+(active?'#84CC16':'#fff')+';color:'+(active?'#1B2B3A':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(label)+'</button>';
  }
  var recPills=recList.length?('<div style="margin-bottom:6px">'+fLabel('Recruteur')
    +recPill('all','Tous')
    +recList.map(function(r){return recPill(r.recruteur_name||r.email,r.recruteur_name||r.email);}).join('')+'</div>'):'';
  var pills='<div style="margin-bottom:6px">'+fLabel('Statut')
    +pill('all','Tous',S.cands.length)+REC_STATUS.map(function(s){return pill(s.id,recStLbD(s.id),counts[s.id]);}).join('')+'</div>';

  var locCounts={};REC_LOCATIONS.forEach(function(l){locCounts[l]=0;});
  S.cands.forEach(function(c){(c.locations||[]).forEach(function(l){if(locCounts[l]!=null)locCounts[l]++;});});
  function locPill(loc){
    var active=locF.indexOf(loc)>=0;
    return '<button data-act="recf-loc" data-id="'+esc(loc)+'" style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid '+(active?'#7c3aed':'#e2e8f0')+';background:'+(active?'#7c3aed':'#fff')+';color:'+(active?'#fff':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(loc)+' <span style="opacity:.6">'+locCounts[loc]+'</span></button>';
  }
  var locPills='<div style="margin-bottom:6px">'+fLabel('Localisation'+(locF.length?' · '+locF.length:''))
    +REC_LOCATIONS.map(locPill).join('')+'</div>';

  /* Filtre Expertise (dynamique : dérivé des expertises présentes) */
  var expCounts={};S.cands.forEach(function(c){(c.expertise||[]).forEach(function(e){if(e)expCounts[e]=(expCounts[e]||0)+1;});});
  var expKeys=Object.keys(expCounts).sort();
  function expPill(e){
    var active=expF.indexOf(e)>=0;
    return '<button data-act="recf-exp" data-id="'+esc(e)+'" style="padding:4px 12px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid '+(active?'#0891b2':'#e2e8f0')+';background:'+(active?'#0891b2':'#fff')+';color:'+(active?'#fff':'#475569')+';cursor:pointer;margin:0 4px 4px 0">'+esc(e)+' <span style="opacity:.6">'+expCounts[e]+'</span></button>';
  }
  var expPills=expKeys.length?('<div>'+fLabel('Expertise'+(expF.length?' · '+expF.length:''))+expKeys.map(expPill).join('')+'</div>'):'';

  /* Bascule « Mes candidats » (recruteur assigné = moi, ou candidat créé par moi) */
  var minePill='<button data-act="recf-mine" style="padding:5px 14px;border-radius:99px;font-size:11px;font-weight:800;border:1px solid '+(S.recF.mine?'#84CC16':'#e2e8f0')+';background:'+(S.recF.mine?'#84CC16':'#fff')+';color:'+(S.recF.mine?'#1B2B3A':'#475569')+';cursor:pointer">'+(S.recF.mine?'★ Mes candidats':'☆ Mes candidats')+'</button>'
    +'<span style="font-size:11px;color:#94a3b8;margin-left:10px">'+list.length+' résultat'+(list.length!==1?'s':'')+' sur '+S.cands.length+'</span>';

  function tag(t){return '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:#f1f5f9;color:#475569;margin:0 4px 2px 0">'+esc(t)+'</span>';}

  var rows=list.map(function(c){
    var col=recStCol(c.status);
    var scr=recScr(c.reqSalary);
    var tjm=recTjm(c.reqSalary,c.marginPct);
    var exp=(c.expertise||[]);
    var expHtml=exp.slice(0,3).map(tag).join('')+(exp.length>3?'<span style="font-size:11px;color:#94a3b8">+'+(exp.length-3)+'</span>':'');
    var sec=(c.sectors||[]);
    var secHtml=sec.slice(0,2).map(tag).join('')+(sec.length>2?'<span style="font-size:11px;color:#94a3b8">+'+(sec.length-2)+'</span>':'');
    return '<tr data-act="recopen" data-id="'+c.id+'" style="cursor:pointer">'
      +'<td style="font-weight:700;color:#0f172a">'+esc(c.name)+'</td>'
      +'<td>'+(expHtml||'<span style="color:#cbd5e1">—</span>')+'</td>'
      +'<td>'+(secHtml||'<span style="color:#cbd5e1">—</span>')+'</td>'
      +'<td>'+esc((c.locations&&c.locations.length)?c.locations.join(', '):'—')+'</td>'
      +'<td>'+(c.availDate?fDt(c.availDate):'—')+'</td>'
      +'<td class="tr">'+(c.reqSalary?c.reqSalary.toLocaleString('fr-FR')+' €':'—')+'</td>'
      +'<td class="tr">'+(scr?scr.toFixed(0)+' €/j':'—')+'</td>'
      +'<td class="tr" style="font-weight:700;color:#2563eb">'+(tjm?tjm.toFixed(0)+' €/j':'—')+'</td>'
      +'<td><span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:'+col[0]+';color:'+col[1]+'">'+esc(recStLbD(c.status))+'</span></td>'
      +'<td style="font-size:11px;color:#94a3b8">'+esc(c.createdBy?c.createdBy.split('@')[0]:'—')+'</td>'
      +'</tr>';
  }).join('');

  return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">'+minePill+'</div>'
    +pills+recPills+locPills+expPills
    +'</div>'
    +'<div class="card ov" style="margin-top:14px">'
    +'<table><thead><tr><th>Nom</th><th>Expertise</th><th>Secteurs</th><th>Localisation</th><th>Disponibilité</th><th class="tr">Rém. demandée</th><th class="tr">SCR/j</th><th class="tr">TJM revente</th><th>Statut</th><th>Ajouté par</th></tr></thead>'
    +'<tbody>'+rows+(rows?'':'<tr><td colspan="10">'+((q||stF!=='all'||locF.length||expF.length||S.recF.mine)?tEmpty('🔍','Aucun candidat pour ces filtres','Ajustez le statut, la localisation ou l\u2019expertise — ou décochez « Mes candidats ».'):tEmpty('🎯','Votre vivier est vide','Ajoutez un premier candidat pour construire votre pipeline de recrutement.','<button class="bp" data-act="arec">+ Nouveau candidat</button>'))+'</td></tr>')
    +'</tbody></table></div>';
}
/* Rafraîchit uniquement les pills + le tableau, sans toucher au champ de recherche
   (évite de recréer l'input et donc de lui faire perdre le focus à chaque frappe) */
function recListRefresh(){
  var wrap=document.getElementById('rec-list-wrap');
  if(wrap)wrap.innerHTML=recListBody();
}

function tRecList(){
  return '<div><div class="ph"><div><div class="pt">Recrutement</div>'
    +'<div class="ps">'+S.cands.length+' candidat'+(S.cands.length!==1?'s':'')+' · pipeline partagé de toute l\'entreprise — chaque recruteur voit et filtre l\'ensemble des candidats</div></div>'
    +'<button class="bp" data-act="arec">+ Nouveau candidat</button></div>'
    +'<div style="margin-bottom:10px"><input class="ic" id="recq" placeholder="Rechercher un candidat, une expertise, un email..." value="'+esc(S.recF.q||'')+'" style="max-width:360px"></div>'
    +'<div id="rec-list-wrap">'+recListBody()+'</div></div>';
}

function tCandDetail(c){
  var col=recStCol(c.status);
  var scr=recScr(c.reqSalary);
  var tjm=recTjm(c.reqSalary,c.marginPct);

  function tag(t){return '<span style="display:inline-block;padding:3px 10px;border-radius:7px;font-size:12px;font-weight:600;background:#f1f5f9;color:#475569;margin:0 5px 5px 0">'+esc(t)+'</span>';}
  var expHtml=(c.expertise&&c.expertise.length)?c.expertise.map(tag).join(''):'<span style="color:#94a3b8;font-size:12px">Aucune expertise renseignée</span>';
  var secHtml=(c.sectors&&c.sectors.length)?c.sectors.map(tag).join(''):'<span style="color:#94a3b8;font-size:12px">Aucun secteur renseigné</span>';

  function info(label,val){
    return '<div><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">'+label+'</div><div style="font-size:13px;color:#0f172a;font-weight:600">'+val+'</div></div>';
  }
  var infoGrid='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px 24px">'
    +info('Email',esc(c.email||'—'))
    +info('Téléphone',esc(c.phone||'—'))
    +info('Localisation',(c.mobileFrance?'🇫🇷 Mobile France entière':((c.locTarget?'<strong>'+esc(c.locTarget)+'</strong> (priorité)':'')+((c.locSecondary&&c.locSecondary.length)?(c.locTarget?' · ':'')+esc(c.locSecondary.join(', '))+' (secondaire)':'')||(c.locations&&c.locations.length?esc(c.locations.join(', ')):'—'))))
    +info('Nationalité',esc(c.nationality||'—'))
    +info('Expérience',c.yearsExp?c.yearsExp+' an'+(c.yearsExp>1?'s':''):'—')
    +info('Disponibilité',c.availDate?fDt(c.availDate):'—')
    +'</div>';

  var compCard='<div style="display:flex;gap:32px;flex-wrap:wrap;margin-top:18px;padding-top:18px;border-top:1px solid #e2e8f0">'
    +'<div><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase">Rémunération demandée</div><div style="font-size:18px;font-weight:800;color:#0f172a">'+(c.reqSalary?c.reqSalary.toLocaleString('fr-FR')+' € /an':'—')+'</div></div>'
    +'<div><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase">SCR journalier</div><div style="font-size:18px;font-weight:800;color:#0f172a">'+(scr?scr.toFixed(0)+' €':'—')+'</div></div>'
    +'<div><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase">TJM de revente (marge '+(c.marginPct!=null?c.marginPct:25)+'%)</div><div style="font-size:18px;font-weight:800;color:#2563eb">'+(tjm?tjm.toFixed(0)+' €':'—')+'</div></div>'
    +'</div>';

  /* ── Comptes rendus : entrées multiples (date + texte + fichier), éditables ── */
  var crMeets=(c.comptesRendus||[]).slice().reverse();
  var crMeetsHtml=crMeets.map(function(cr){
    var hdr=cr.date?fDt(cr.date):'Compte rendu';
    return '<div style="padding:14px 16px;background:#f8fafc;border-radius:10px;margin-bottom:10px;border:1px solid #e2e8f0">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:10px">'
      +'<div style="font-size:12px;color:#0f172a;font-weight:700">'+esc(hdr)+'</div>'
      +'<div style="display:flex;gap:10px;flex-shrink:0">'
      +'<button class="lb" data-act="recredit" data-id="'+c.id+'" data-fb="'+cr.id+'">Modifier</button>'
      +'<button class="lr" data-act="recrdel" data-id="'+c.id+'" data-fb="'+cr.id+'">Suppr.</button>'
      +'</div></div>'
      +(cr.text?'<div style="font-size:13px;color:#334155;white-space:pre-wrap;line-height:1.5">'+esc(cr.text)+'</div>':'')
      +(cr.filePath?'<div style="margin-top:8px"><button class="lb" data-act="recrdl" data-id="'+c.id+'" data-fb="'+cr.id+'">📎 '+esc(cr.fileName||'Fichier joint')+'</button></div>':'')
      +'</div>';
  }).join('');
  var editingCr=S.recEditCrId?(c.comptesRendus||[]).find(function(f){return f.id===S.recEditCrId;}):null;
  var crFormOpen=S.recAddCr||!!editingCr;
  var addCrForm=crFormOpen
    ? '<div style="padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px">'
      +(editingCr?'<div style="font-size:11px;color:#2563eb;font-weight:700;margin-bottom:10px">✐ Modification d’un compte rendu</div>':'')
      +'<div class="fd"><label class="fl">Date</label><input class="ic" id="crf-date" type="date" value="'+esc(editingCr?editingCr.date||'':fD(new Date()))+'" style="max-width:220px"></div>'
      +'<div class="fd"><label class="fl">Compte rendu</label><textarea class="ic" id="crf-text" rows="4" placeholder="Notes générales, échange, retour...">'+esc(editingCr?editingCr.text||'':'')+'</textarea></div>'
      +'<div class="fd"><label class="fl">Joindre un fichier (Word, PDF...) — optionnel</label><input class="ic" type="file" id="crf-file" accept=".doc,.docx,.pdf,.txt,.odt,.eml,.msg">'
      +(editingCr&&editingCr.fileName?'<p class="fh">Fichier actuel : '+esc(editingCr.fileName)+' — sélectionnez un nouveau fichier pour le remplacer.</p>':'')+'</div>'
      +'<div class="br"><button class="bg" data-act="recrcancel">Annuler</button><button class="bp" data-act="recrsave" data-id="'+c.id+'"'+(editingCr?' data-fb="'+editingCr.id+'"':'')+'>'+(editingCr?'Enregistrer les modifications':'Enregistrer le compte rendu')+'</button></div>'
      +'</div>'
    : '';

  /* ── Rencontre CGI : entrées multiples (personne CGI + date + compte rendu + fichier), éditables ── */
  var cgiMeets=(c.cgiMeetings||[]).slice().reverse();
  var cgiMeetsHtml=cgiMeets.map(function(mt){
    var hdr=[];
    if(mt.date)hdr.push(fDt(mt.date));
    if(mt.person)hdr.push(esc(mt.person));
    return '<div style="padding:14px 16px;background:#f8fafc;border-radius:10px;margin-bottom:10px;border:1px solid #e2e8f0">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:10px">'
      +'<div style="font-size:12px;color:#0f172a;font-weight:700">'+(hdr.join(' · ')||'Rencontre CGI')+'</div>'
      +'<div style="display:flex;gap:10px;flex-shrink:0">'
      +'<button class="lb" data-act="recgedit" data-id="'+c.id+'" data-fb="'+mt.id+'">Modifier</button>'
      +'<button class="lr" data-act="recgdel" data-id="'+c.id+'" data-fb="'+mt.id+'">Suppr.</button>'
      +'</div></div>'
      +(mt.text?'<div style="font-size:13px;color:#334155;white-space:pre-wrap;line-height:1.5">'+esc(mt.text)+'</div>':'')
      +(mt.filePath?'<div style="margin-top:8px"><button class="lb" data-act="recgdl" data-id="'+c.id+'" data-fb="'+mt.id+'">\uD83D\uDCCE '+esc(mt.fileName||'Fichier joint')+'</button></div>':'')
      +'</div>';
  }).join('');

  var editingCgi=S.recEditCgiId?(c.cgiMeetings||[]).find(function(f){return f.id===S.recEditCgiId;}):null;
  var cgiFormOpen=S.recAddCgi||!!editingCgi;
  var addCgiForm=cgiFormOpen
    ? '<div style="padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px">'
      +(editingCgi?'<div style="font-size:11px;color:#2563eb;font-weight:700;margin-bottom:10px">\u2710 Modification d\u2019une rencontre existante</div>':'')
      +'<div class="g2">'
      +'<div class="fd"><label class="fl">Personne CGI rencontrée</label><input class="ic" id="cgperson" value="'+esc(editingCgi?editingCgi.person||'':'')+'" placeholder="Prénom Nom"></div>'
      +'<div class="fd cs2"><label class="fl">Date de la rencontre</label><input class="ic" id="cgdate" type="date" value="'+esc(editingCgi?editingCgi.date||'':fD(new Date()))+'" style="max-width:220px"></div>'
      +'</div>'
      +'<div class="fd"><label class="fl">Compte rendu rencontre CGI</label><textarea class="ic" id="cgtext" rows="4" placeholder="Notes, retour de l\u2019échange...">'+esc(editingCgi?editingCgi.text||'':'')+'</textarea></div>'
      +'<div class="fd"><label class="fl">Joindre un fichier (Word, e-mail, PDF...) — optionnel</label><input class="ic" type="file" id="cgfile" accept=".doc,.docx,.pdf,.txt,.odt,.eml,.msg">'
      +(editingCgi&&editingCgi.fileName?'<p class="fh">Fichier actuel : '+esc(editingCgi.fileName)+' — sélectionnez un nouveau fichier pour le remplacer.</p>':'')+'</div>'
      +'<div class="br"><button class="bg" data-act="recgcancel">Annuler</button><button class="bp" data-act="recgsave" data-id="'+c.id+'"'+(editingCgi?' data-fb="'+editingCgi.id+'"':'')+'>'+(editingCgi?'Enregistrer les modifications':'Enregistrer la rencontre')+'</button></div>'
      +'</div>'
    : '';

  /* ── Rencontre client : liste fusionnée (info de rencontre + compte-rendu + fichier), entrées multiples, éditables ── */
  var meets=(c.feedbacks||[]).slice().reverse();
  var meetsHtml=meets.map(function(mt){
    var hdr=[];
    if(mt.date)hdr.push(fDt(mt.date));
    if(mt.client)hdr.push(esc(mt.client));
    if(mt.contact)hdr.push(esc(mt.contact));
    return '<div style="padding:14px 16px;background:#f8fafc;border-radius:10px;margin-bottom:10px;border:1px solid #e2e8f0">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:10px">'
      +'<div style="font-size:12px;color:#0f172a;font-weight:700">'+(hdr.join(' · ')||'Rencontre')+'</div>'
      +'<div style="display:flex;gap:10px;flex-shrink:0">'
      +'<button class="lb" data-act="recmedit" data-id="'+c.id+'" data-fb="'+mt.id+'">Modifier</button>'
      +'<button class="lr" data-act="recmdel" data-id="'+c.id+'" data-fb="'+mt.id+'">Suppr.</button>'
      +'</div></div>'
      +(mt.text?'<div style="font-size:13px;color:#334155;white-space:pre-wrap;line-height:1.5">'+esc(mt.text)+'</div>':'')
      +(mt.filePath?'<div style="margin-top:8px"><button class="lb" data-act="recmdl" data-id="'+c.id+'" data-fb="'+mt.id+'">\uD83D\uDCCE '+esc(mt.fileName||'Fichier joint')+'</button></div>':'')
      +'</div>';
  }).join('');

  var editingMeet=S.recEditMeetId?(c.feedbacks||[]).find(function(f){return f.id===S.recEditMeetId;}):null;
  var meetFormOpen=S.recAddMeet||!!editingMeet;
  var addMeetForm=meetFormOpen
    ? '<div style="padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px">'
      +(editingMeet?'<div style="font-size:11px;color:#2563eb;font-weight:700;margin-bottom:10px">\u2710 Modification d\u2019une rencontre existante</div>':'')
      +'<div class="g2">'
      +'<div class="fd"><label class="fl">Client rencontré</label><input class="ic" id="mtcli" value="'+esc(editingMeet?editingMeet.client||'':'')+'" placeholder="Nom du client"></div>'
      +'<div class="fd"><label class="fl">Opérationnel rencontré</label><input class="ic" id="mtcon" value="'+esc(editingMeet?editingMeet.contact||'':'')+'" placeholder="Prénom Nom"></div>'
      +'<div class="fd cs2"><label class="fl">Date de la rencontre</label><input class="ic" id="mtdate" type="date" value="'+esc(editingMeet?editingMeet.date||'':fD(new Date()))+'" style="max-width:220px"></div>'
      +'</div>'
      +'<div class="fd"><label class="fl">Compte rendu</label><textarea class="ic" id="mttext" rows="4" placeholder="Notes, retour de l\u2019entretien...">'+esc(editingMeet?editingMeet.text||'':'')+'</textarea></div>'
      +'<div class="fd"><label class="fl">Joindre un fichier (Word, PDF...) — optionnel</label><input class="ic" type="file" id="mtfile" accept=".doc,.docx,.pdf,.txt,.odt">'
      +(editingMeet&&editingMeet.fileName?'<p class="fh">Fichier actuel : '+esc(editingMeet.fileName)+' — sélectionnez un nouveau fichier pour le remplacer.</p>':'')+'</div>'
      +'<div class="br"><button class="bg" data-act="recmcancel">Annuler</button><button class="bp" data-act="recmsave" data-id="'+c.id+'"'+(editingMeet?' data-fb="'+editingMeet.id+'"':'')+'>'+(editingMeet?'Enregistrer les modifications':'Enregistrer la rencontre')+'</button></div>'
      +'</div>'
    : '';

  /* ── CV : un ou plusieurs fichiers, importables depuis la fiche également ── */
  var cvHtml=(c.cvFiles||[]).map(function(cv){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-radius:8px;margin-bottom:6px;border:1px solid #e2e8f0">'
      +'<button class="lb" data-act="reccvview" data-id="'+c.id+'" data-fb="'+cv.id+'" style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Aper\u00E7u">\uD83D\uDCCE '+esc(cv.fileName)+'</button>'
      +'<button class="lb" data-act="reccvview" data-id="'+c.id+'" data-fb="'+cv.id+'">\uD83D\uDC41 Voir</button>'
      +'<button class="lb" data-act="reccvdl" data-id="'+c.id+'" data-fb="'+cv.id+'">\u2B07 T\u00E9l\u00E9charger</button>'
      +'<button class="lr" data-act="reccvdel" data-id="'+c.id+'" data-fb="'+cv.id+'">Suppr.</button>'
      +'</div>';
  }).join('');
  var addCvForm=S.recAddCv
    ? '<div style="padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px">'
      +'<div class="fd"><label class="fl">Ajouter un ou plusieurs CV</label><input class="ic" type="file" id="cvfile" accept=".pdf,.doc,.docx,.odt" multiple></div>'
      +'<div class="br"><button class="bg" data-act="reccvcancel">Annuler</button><button class="bp" data-act="reccvadd" data-id="'+c.id+'">Importer</button></div>'
      +'</div>'
    : '';

  return '<div>'
    +'<button class="lb" data-act="recback" style="margin-bottom:14px">\u2190 Retour au pipeline</button>'
    +'<div class="ph"><div><div class="pt">'+esc(c.name)+'</div>'
    +'<div class="ps"><span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:'+col[0]+';color:'+col[1]+'">'+esc(recStLbD(c.status))+'</span>'
    +(c.createdBy?' · Ajouté par '+esc(c.createdBy.split('@')[0]):'')+'</div></div>'
    +'<div style="display:flex;gap:8px"><button class="bg" data-act="erec" data-id="'+c.id+'">Modifier</button>'
    +'<button class="bg" style="color:#dc2626;border-color:#fca5a5" data-act="drec" data-id="'+c.id+'">Supprimer</button></div></div>'

    +'<div class="card" style="padding:24px;margin-bottom:18px">'+infoGrid
    +'<div style="margin-top:18px"><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Expertises</div>'+expHtml+'</div>'
    +'<div style="margin-top:14px"><div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Connaissance secteur</div>'+secHtml+'</div>'
    +compCard+'</div>'

    +'<div class="card" style="padding:24px;margin-bottom:18px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">Comptes rendus ('+(c.comptesRendus||[]).length+')</div>'
    +(!crFormOpen?'<button class="bp" data-act="recrtoggle">+ Ajouter un compte rendu</button>':'')
    +'</div>'
    +addCrForm
    +(crMeetsHtml||'<div class="emp">Aucun compte rendu pour le moment.</div>')
    +'</div>'

    +'<div class="card" style="padding:24px;margin-bottom:18px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">CV ('+(c.cvFiles||[]).length+')</div>'
    +(!S.recAddCv?'<button class="bp" data-act="reccvtoggle">+ Ajouter un CV</button>':'')
    +'</div>'
    +addCvForm
    +(cvHtml||'<div class="emp">Aucun CV importé pour le moment.</div>')
    +'</div>'
    +cvExpSection(c)

    +'<div class="card" style="padding:24px;margin-bottom:18px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">Rencontre CGI ('+(c.cgiMeetings||[]).length+')</div>'
    +(!cgiFormOpen?'<button class="bp" data-act="recgtoggle">+ Ajouter une rencontre</button>':'')
    +'</div>'
    +addCgiForm
    +(cgiMeetsHtml||'<div class="emp">Aucune rencontre CGI enregistrée pour le moment.</div>')
    +'</div>'

    +'<div class="card" style="padding:24px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    +'<div style="font-size:13px;font-weight:800;color:#0f172a">Rencontre client ('+(c.feedbacks||[]).length+')</div>'
    +(!meetFormOpen?'<button class="bp" data-act="recmtoggle">+ Ajouter une rencontre</button>':'')
    +'</div>'
    +addMeetForm
    +(meetsHtml||'<div class="emp">Aucune rencontre client enregistrée pour le moment.</div>')
    +'</div>'
    +'</div>';
}

/* ════════════════════════════════════════════════════════════
   WIDGET : sélection multiple (Expertises / Secteurs) + ajout libre
   Utilise la délégation d'événements (pas d'onclick inline avec
   valeurs dynamiques) pour éviter tout souci d'échappement de guillemets.
   ════════════════════════════════════════════════════════════ */
function expPickerHTML(){
  var sel=(S.modal&&S.modal.expSel)||[];
  var selSet=new Set(sel);
  var chips=sel.map(function(v){
    return '<span class="_tagchip" data-rm="'+esc(v)+'" style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#dbeafe;color:#1e40af;margin:0 5px 5px 0;cursor:pointer">'+esc(v)+' <span style="font-weight:900;opacity:.65">\u00d7</span></span>';
  }).join('')||'<span style="font-size:12px;color:#94a3b8">Aucune expertise sélectionnée</span>';
  var checks=EXPERTISE_LIST.map(function(opt){
    var checked=selSet.has(opt);
    return '<label style="display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:12px;color:#334155;cursor:pointer;border-radius:5px">'
      +'<input type="checkbox" class="_expck" data-v="'+esc(opt)+'"'+(checked?' checked':'')+' style="accent-color:#84CC16">'+esc(opt)+'</label>';
  }).join('');
  return '<div style="margin-bottom:8px">'+chips+'</div>'
    +'<div style="max-height:140px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff">'+checks+'</div>'
    +'<div style="display:flex;gap:6px;margin-top:8px">'
    +'<input class="ic" id="exp-custom" placeholder="Ajouter une expertise non listée..." style="flex:1">'
    +'<button type="button" class="bg" id="exp-addbtn">+ Ajouter</button></div>';
}
function expRefresh(){var w=document.getElementById('exp-wrap');if(w){w.innerHTML=expPickerHTML();bindExpWidget();}}
function bindExpWidget(){
  var wrap=document.getElementById('exp-wrap');
  if(!wrap)return;
  wrap.onclick=function(e){
    var chip=e.target.closest('._tagchip');
    if(chip){
      var v=chip.getAttribute('data-rm');
      S.modal.expSel=(S.modal.expSel||[]).filter(function(x){return x!==v;});
      expRefresh();
    }
  };
  wrap.onchange=function(e){
    if(e.target.classList.contains('_expck')){
      var v=e.target.getAttribute('data-v');
      var a=S.modal.expSel=S.modal.expSel||[];
      var i=a.indexOf(v);
      if(e.target.checked){if(i<0)a.push(v);}else if(i>=0)a.splice(i,1);
    }
  };
  var btn=document.getElementById('exp-addbtn');
  if(btn)btn.onclick=function(){
    var inp=document.getElementById('exp-custom');if(!inp)return;
    var v=inp.value.trim();if(!v)return;
    var a=S.modal.expSel=S.modal.expSel||[];
    if(a.indexOf(v)<0)a.push(v);
    inp.value='';expRefresh();
  };
}

function secPickerHTML(){
  var sel=(S.modal&&S.modal.secSel)||[];
  var selSet=new Set(sel);
  var chips=sel.map(function(v){
    return '<span class="_tagchip2" data-rm="'+esc(v)+'" style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#ede9fe;color:#5b21b6;margin:0 5px 5px 0;cursor:pointer">'+esc(v)+' <span style="font-weight:900;opacity:.65">\u00d7</span></span>';
  }).join('')||'<span style="font-size:12px;color:#94a3b8">Aucun secteur sélectionné</span>';
  var checks=SECTOR_LIST.map(function(opt){
    var checked=selSet.has(opt);
    return '<label style="display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:12px;color:#334155;cursor:pointer;border-radius:5px">'
      +'<input type="checkbox" class="_secck" data-v="'+esc(opt)+'"'+(checked?' checked':'')+' style="accent-color:#7c3aed">'+esc(opt)+'</label>';
  }).join('');
  return '<div style="margin-bottom:8px">'+chips+'</div>'
    +'<div style="max-height:140px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff">'+checks+'</div>'
    +'<div style="display:flex;gap:6px;margin-top:8px">'
    +'<input class="ic" id="sec-custom" placeholder="Ajouter un secteur non listé..." style="flex:1">'
    +'<button type="button" class="bg" id="sec-addbtn">+ Ajouter</button></div>';
}
function secRefresh(){var w=document.getElementById('sec-wrap');if(w){w.innerHTML=secPickerHTML();bindSecWidget();}}
function bindSecWidget(){
  var wrap=document.getElementById('sec-wrap');
  if(!wrap)return;
  wrap.onclick=function(e){
    var chip=e.target.closest('._tagchip2');
    if(chip){
      var v=chip.getAttribute('data-rm');
      S.modal.secSel=(S.modal.secSel||[]).filter(function(x){return x!==v;});
      secRefresh();
    }
  };
  wrap.onchange=function(e){
    if(e.target.classList.contains('_secck')){
      var v=e.target.getAttribute('data-v');
      var a=S.modal.secSel=S.modal.secSel||[];
      var i=a.indexOf(v);
      if(e.target.checked){if(i<0)a.push(v);}else if(i>=0)a.splice(i,1);
    }
  };
  var btn=document.getElementById('sec-addbtn');
  if(btn)btn.onclick=function(){
    var inp=document.getElementById('sec-custom');if(!inp)return;
    var v=inp.value.trim();if(!v)return;
    var a=S.modal.secSel=S.modal.secSel||[];
    if(a.indexOf(v)<0)a.push(v);
    inp.value='';secRefresh();
  };
}

/* ── Localisation(s) : pastilles à bascule, multi-sélection (liste fixe, pas d'ajout libre) ── */
function locPickerHTML(){
  var sel=(S.modal&&S.modal.locSel)||[];
  return REC_LOCATIONS.map(function(loc){
    var active=sel.indexOf(loc)>=0;
    return '<button type="button" class="_locbtn" data-v="'+esc(loc)+'" style="padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;border:1px solid '+(active?'#7c3aed':'#e2e8f0')+';background:'+(active?'#7c3aed':'#fff')+';color:'+(active?'#fff':'#475569')+';cursor:pointer;margin:0 6px 6px 0">'+esc(loc)+'</button>';
  }).join('');
}
function locRefresh(){var w=document.getElementById('loc-wrap');if(w){w.innerHTML=locPickerHTML();bindLocWidget();}}
function bindLocWidget(){
  var wrap=document.getElementById('loc-wrap');
  if(!wrap)return;
  wrap.onclick=function(e){
    var btn=e.target.closest('._locbtn');
    if(!btn)return;
    var v=btn.getAttribute('data-v');
    var a=S.modal.locSel=S.modal.locSel||[];
    var i=a.indexOf(v);
    if(i>=0)a.splice(i,1);else a.push(v);
    locRefresh();
  };
}


/* ── Localisation candidat classifiée : cible (priorité) + secondaires + mobilité
   France entière. Recherche sur les grandes villes de France (FR_CITIES). ── */
function candLocMatchesHTML(){
  var m=S.modal||{},q=(m.locSecQ||'').toLowerCase().trim(),sec=m.locSecondary||[],target=m.locTarget||'';
  if(!q)return '';
  var matches=FR_CITIES.filter(function(c){return c.toLowerCase().indexOf(q)>=0&&sec.indexOf(c)<0&&c!==target;}).slice(0,12);
  return matches.length
    ? matches.map(function(c){return '<button type="button" class="_csecadd" data-v="'+esc(c)+'" style="padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;margin:0 5px 5px 0">+ '+esc(c)+'</button>';}).join('')
    : '<span style="font-size:12px;color:#94a3b8">Aucune ville</span>';
}
function candLocHTML(){
  var m=S.modal||{},mob=!!m.mobileFrance,target=m.locTarget||'',sec=m.locSecondary||[];
  var h='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">';
  h+='<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#0f172a;cursor:pointer'+(mob?'':';margin-bottom:12px')+'">'
    +'<input type="checkbox" id="cloc-france"'+(mob?' checked':'')+' style="accent-color:#7c3aed;width:16px;height:16px"> 🇫🇷 Mobile sur toute la France</label>';
  if(!mob){
    h+='<datalist id="fr-cities-dl">'+FR_CITIES.map(function(c){return '<option value="'+esc(c)+'">';}).join('')+'</datalist>';
    h+='<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">📍 Localisation cible (priorité)</div>'
      +'<input class="ic" id="cloc-target" list="fr-cities-dl" value="'+esc(target)+'" placeholder="Rechercher une ville…" style="max-width:280px"></div>';
    h+='<div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Localisations secondaires (prêt à aller)</div>';
    if(sec.length)h+='<div style="margin-bottom:6px">'+sec.map(function(city){return '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:99px;font-size:12px;font-weight:600;background:#ede9fe;color:#5b21b6;margin:0 5px 5px 0">'+esc(city)+' <button type="button" class="_csecdel" data-v="'+esc(city)+'" style="background:none;border:none;color:#7c3aed;cursor:pointer;font-weight:800;padding:0">✕</button></span>';}).join('')+'</div>';
    h+='<input class="ic" id="cloc-sec-q" value="'+esc(m.locSecQ||'')+'" placeholder="Rechercher une ville à ajouter…" style="max-width:280px;margin-bottom:6px">';
    h+='<div id="cloc-sec-matches">'+candLocMatchesHTML()+'</div>';
    h+='</div>';
  }
  h+='</div>';
  return h;
}
function candLocRefresh(){var w=document.getElementById('cloc-wrap');if(w){w.innerHTML=candLocHTML();bindCandLoc();}}
function bindCandLoc(){
  var fr=document.getElementById('cloc-france');
  if(fr)fr.onchange=function(){S.modal.mobileFrance=this.checked;candLocRefresh();};
  var tg=document.getElementById('cloc-target');
  if(tg)tg.oninput=function(){S.modal.locTarget=this.value;};
  var q=document.getElementById('cloc-sec-q');
  if(q)q.oninput=function(){S.modal.locSecQ=this.value;var c=document.getElementById('cloc-sec-matches');if(c)c.innerHTML=candLocMatchesHTML();};
  var w=document.getElementById('cloc-wrap');
  if(w)w.onclick=function(e){
    var add=e.target.closest('._csecadd');
    if(add){var v=add.getAttribute('data-v');var a=S.modal.locSecondary=S.modal.locSecondary||[];if(a.indexOf(v)<0)a.push(v);candLocRefresh();return;}
    var del=e.target.closest('._csecdel');
    if(del){var dv=del.getAttribute('data-v');S.modal.locSecondary=(S.modal.locSecondary||[]).filter(function(x){return x!==dv;});candLocRefresh();return;}
  };
}

/* ── Mobilité régionale du consultant : région de rattachement + villes de la
   région (définies par le super_admin dans Paramètres). Refresh partiel pour ne
   pas perdre les autres champs saisis. ── */
function consMobInner(){
  var m=S.modal||{},regions=regionNodes(),reg=m.region||'',mob=m.mobility||[];
  if(!regions.length)return '<label class="fl">Mobilité régionale</label><input class="ic" disabled value="Aucune région définie" style="background:#f1f5f9;color:#94a3b8"><p class="fh">Le super_admin définit les régions et leurs villes dans Paramètres.</p>';
  var regOpts='<option value="">— Région —</option>'+regions.map(function(r){return '<option value="'+esc(r.name)+'"'+(reg===r.name?' selected':'')+'>'+esc(r.name)+'</option>';}).join('');
  var cities=regionCities(reg);
  var pills=cities.length?cities.map(function(city){var on=mob.indexOf(city)>=0;return '<button type="button" class="_cmob" data-v="'+esc(city)+'" style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid '+(on?'#7c3aed':'#e2e8f0')+';background:'+(on?'#7c3aed':'#fff')+';color:'+(on?'#fff':'#475569')+';cursor:pointer;margin:0 5px 5px 0">'+esc(city)+'</button>';}).join(''):(reg?'<span style="font-size:12px;color:#94a3b8">Aucune ville dans cette région (à ajouter dans Paramètres).</span>':'<span style="font-size:12px;color:#94a3b8">Choisissez d\'abord une région.</span>');
  return '<label class="fl">Région de rattachement &amp; mobilité</label>'
    +'<select class="ic" id="cons-region" style="max-width:280px;margin-bottom:10px">'+regOpts+'</select>'
    +'<div id="cons-mob-pills">'+pills+'</div>'
    +'<p class="fh">Villes de mobilité au sein de la région (liste gérée par le super_admin).</p>';
}
function consMobRefresh(){var w=document.getElementById('cons-mob-block');if(w){w.innerHTML=consMobInner();bindConsMobility();}}
function bindConsMobility(){
  var rs=document.getElementById('cons-region');
  if(rs)rs.onchange=function(){S.modal.region=this.value;S.modal.mobility=[];consMobRefresh();};
  var w=document.getElementById('cons-mob-pills');
  if(w)w.onclick=function(e){var b=e.target.closest('._cmob');if(!b)return;var v=b.getAttribute('data-v');var a=S.modal.mobility=S.modal.mobility||[];var i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);consMobRefresh();};
}

function addMissTeamRow(){
  var wrap=document.getElementById('miss-team');
  if(!wrap)return;
  var idx=wrap.querySelectorAll('.miss-team-row').length;
  var tCons=S.cons.filter(function(c){return c.grade!=='sales_grade';});
  var cOpts=tCons.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('');
  var row=document.createElement('div');
  row.className='miss-team-row';row.style.cssText='display:flex;gap:8px;align-items:center';
  row.innerHTML='<select class="ic" style="flex:2" data-team-cid="'+idx+'"><option value="">— Consultant —</option>'+cOpts+'</select>'
    +'<div style="display:flex;align-items:center;gap:4px;flex:1"><input class="ic" type="number" min="1" max="100" placeholder="%" style="width:60px" value="100" data-team-taux="'+idx+'"><span style="color:#64748b;font-size:12px">%</span></div>'
    +'<button onclick="this.closest(\'.miss-team-row\').remove()" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-weight:700">✕</button>';
  wrap.appendChild(row);
}
function readMissTeam(){
  var wrap=document.getElementById('miss-team');
  if(!wrap)return null;
  var rows=wrap.querySelectorAll('.miss-team-row');
  var team=[];
  rows.forEach(function(row){
    var csel=row.querySelector('[data-team-cid]');
    var tinp=row.querySelector('[data-team-taux]');
    var cid=csel?csel.value:'';
    var taux=tinp?+tinp.value||100:100;
    if(cid)team.push({cid:cid,taux:taux});
  });
  return team;
}

function tModal(){
  var m=S.modal;if(!m)return '';
  var tp=m.type,it=m.item,title='',body='',wide=false;
  var defCid=(it&&it.cid)||(S.cons[0]&&S.cons[0].id)||'';
  var co=S.cons.filter(function(c){return c.grade!=='sales_grade';}).map(function(c){return '<option value="'+c.id+'"'+(c.id===defCid?' selected':'')+'>'+esc(c.name)+'</option>';}).join('');

  if(tp==='candidate'){
    title=it?'Modifier le candidat':'Nouveau candidat';wide=true;
    var stOpts=REC_STATUS.map(function(s){return '<option value="'+s.id+'"'+(it&&it.status===s.id?' selected':'')+'>'+esc(recStLbD(s.id))+'</option>';}).join('');
    var mar0=(it&&it.marginPct!=null)?it.marginPct:25;
    var sal0=it?(it.reqSalary||0):0;
    var scr0=recScr(sal0),tjm0=recTjm(sal0,mar0);
    body='<div class="g2">'
      +'<div class="fd"><label class="fl">Nom complet *</label><input class="ic" id="rcn" value="'+esc(it?it.name:'')+'" placeholder="Prénom Nom"></div>'
      +'<div class="fd"><label class="fl">Statut</label><select class="ic" id="rcst">'+stOpts+'</select></div>'
      +(function(){
        /* Options = recruteurs invités + moi (pour qu'un gestionnaire/admin puisse
           s'assigner) + le recruteur déjà enregistré s'il n'est dans aucune liste
           (ex. assignation auto au créateur). Doublons éliminés. */
        var _me=((S.profileFirstName||'')+' '+(S.profileLastName||'')).trim()||S._userEmail||'';
        var _names=[];
        (S.recruteurInvites||[]).forEach(function(r){var nm=r.recruteur_name||r.email||'';if(nm&&_names.indexOf(nm)<0)_names.push(nm);});
        if(_me&&_names.indexOf(_me)<0)_names.push(_me);
        if(it&&it.recruiter&&_names.indexOf(it.recruiter)<0)_names.push(it.recruiter);
        var _opts='<option value="">— Aucun —</option>'+_names.map(function(nm){
          return '<option value="'+esc(nm)+'"'+(it&&it.recruiter===nm?' selected':'')+'>'+esc(nm)+(nm===_me?' (moi)':'')+'</option>';
        }).join('');
        return '<div class="fd"><label class="fl">Recruteur assigné</label><select class="ic" id="rcrec">'+_opts+'</select>'
          +'<div style="font-size:10px;color:#94a3b8;margin-top:3px">Laissé vide → vous êtes assigné automatiquement</div></div>';
      })()
      +'<div class="fd"><label class="fl">Email</label><input class="ic" id="rce" type="email" value="'+esc(it?it.email:'')+'" placeholder="candidat@email.com"></div>'
      +'<div class="fd"><label class="fl">Téléphone</label><input class="ic" id="rcph" value="'+esc(it?it.phone:'')+'" placeholder="06 12 34 56 78"></div>'
      +'<div class="fd cs2"><label class="fl">Localisation &amp; mobilité</label><div id="cloc-wrap">'+candLocHTML()+'</div></div>'
      +'<div class="fd"><label class="fl">Nationalité</label><input class="ic" id="rcnat" value="'+esc(it?it.nationality||'':'')+'" placeholder="Française"></div>'
      +'<div class="fd"><label class="fl">Date de disponibilité</label><input class="ic" id="rcav" type="date" value="'+(it?esc(it.availDate||''):'')+'"></div>'
      +'<div class="fd"><label class="fl">Années d\u2019expérience</label><input class="ic" id="rcyrs" type="number" min="0" step="0.5" value="'+(it&&it.yearsExp?esc(String(it.yearsExp)):'')+'" placeholder="5"></div>'
      +'<div class="fd cs2"><label class="fl">Unité cible <span style="font-weight:400;color:#94a3b8">(optionnel)</span></label><select class="ic" id="rc-bu"><option value="">— Non définie —</option>'+buNodes().slice().sort(function(a,b){return buPathLabel(a.id).localeCompare(buPathLabel(b.id),'fr');}).map(function(n){var cur=it?(it.buId||''):(myBuId()||'');return '<option value="'+n.id+'"'+(cur===n.id?' selected':'')+'>'+esc(buPathLabel(n.id))+'</option>';}).join('')+'</select><p class="fh">Par défaut votre unité ; à l\'affectation d\'un directeur, elle devient la sienne.</p></div>'
      +'<div class="fd cs2"><label class="fl">Expertises</label><div id="exp-wrap">'+expPickerHTML()+'</div></div>'
      +'<div class="fd cs2"><label class="fl">Connaissance secteur</label><div id="sec-wrap">'+secPickerHTML()+'</div></div>'
      +'<div class="fd cs2"><label class="fl">CV — un ou plusieurs fichiers</label><input class="ic" type="file" id="rccv" accept=".pdf,.doc,.docx,.odt" multiple>'
      +(it&&it.cvFiles&&it.cvFiles.length?'<p class="fh">'+it.cvFiles.length+' CV déjà joint(s) — les nouveaux fichiers s\u2019ajouteront aux existants (gérable depuis la fiche).</p>':'<p class="fh">Plusieurs fichiers peuvent être sélectionnés en même temps.</p>')+'</div>'
      +(it
        ? '<div class="fd cs2"><label class="fl">Comptes rendus</label><p class="fh" style="margin-top:0">Gérez les comptes rendus (ajout / suppression) directement depuis la fiche du candidat.</p></div>'
        : '<div class="fd cs2"><label class="fl">Compte rendu (optionnel)</label><textarea class="ic" id="rccr" rows="4" placeholder="Notes générales sur le candidat (CV, premier échange...)">'+'</textarea></div>'
          +'<div class="fd cs2"><label class="fl">Joindre un fichier (Word, PDF...) — optionnel</label><input class="ic" type="file" id="rccrfile" accept=".doc,.docx,.pdf,.txt,.odt">'
          +'<p class="fh">Vous pourrez en ajouter d’autres depuis la fiche.</p></div>')
      +'<div class="fd"><label class="fl">Rémunération annuelle demandée (€)</label><input class="ic" id="rcsal" type="number" min="0" step="500" value="'+(sal0||'')+'" oninput="recCalcRefresh()" placeholder="45000"></div>'
      +'<div class="fd"><label class="fl">Marge cible TJM revente : <span id="rcMarVal" style="color:#2563eb;font-weight:800">'+mar0+'%</span></label>'
      +'<input type="range" id="rcmar" min="15" max="50" step="1" value="'+mar0+'" oninput="recCalcRefresh()" style="width:100%;accent-color:#84CC16;margin-top:8px"></div>'
      +'<div class="fd cs2" id="rcCalcOut" style="background:#eff6ff;border-radius:8px;padding:10px 14px;font-size:13px;color:#1e40af">'
      +'SCR journalier : <strong>'+scr0.toFixed(0)+' \u20ac</strong> &nbsp;\u00b7&nbsp; TJM de revente (marge '+mar0+'%) : <strong>'+tjm0.toFixed(0)+' \u20ac</strong>'
      +'</div>'

      /* ── Section Recrutement ── */
      +'<div class="fd cs2" style="border-top:2px solid #e2e8f0;padding-top:16px;margin-top:4px">'
      +'<label class="fl" style="margin-bottom:10px">Recrutement</label>'
      +'<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;font-weight:600;color:#0f172a">'
      +'<input type="checkbox" id="rc-recruited" style="width:18px;height:18px;accent-color:#84CC16;cursor:pointer" onchange="toggleRecruited()"'+(it&&it.recruited?' checked':'')+'>'
      +'\u2713 Candidat recrut\u00e9(e) \u2014 int\u00e9grer dans l\'\u00e9quipe</label>'
      +'<p style="font-size:12px;color:#94a3b8;margin-top:4px;margin-left:28px">Si coch\u00e9, un profil consultant sera cr\u00e9\u00e9 automatiquement \u00e0 la sauvegarde.</p>'
      +'</div>'

      +'<div id="rc-recruit-fields" class="g2" style="display:'+(it&&it.recruited?'grid':'none')+'">'
      +'<div class="fd"><label class="fl">Date de d\u00e9marrage *</label>'
      +'<input class="ic" type="date" id="rc-start" value="'+(it&&it.recruitStart?it.recruitStart:'')+'">'
      +'</div>'

      +'<div class="fd"><label class="fl">Grade *</label>'
      +'<select class="ic" id="rc-poste"><option value="">-- Sélectionner --</option>'+['Consultant Junior','Consultant Confirmé','Consultant Sénior','Manager','Business Manager'].map(function(g){return '<option value="'+g+'"'+(it&&it.recruitPoste===g?' selected':'')+'>'+g+'</option>';}).join('')+'</select>'
      +'</div>'

      +'<div class="fd cs2"><label class="fl">'+rLabel('gestionnaire')+' (N+1)</label>'
      +'<select class="ic" id="rc-dir"><option value="">— Sélectionner un gestionnaire —</option>'+(function(){
        var _pre=mgrAccountByName(it&&it.recruitDir);
        return (S.orgProfiles||[]).filter(function(p){return ['gestionnaire','admin','super_admin'].indexOf(p.role)>=0;}).map(function(p){
          var nm=((p.first_name||'')+' '+(p.last_name||'')).trim()||p.id;
          return '<option value="'+p.id+'"'+((_pre&&_pre.id===p.id)?' selected':'')+'>'+esc(nm)+' ('+rLabel(p.role)+')'+(p.bu_id?' — '+esc(buLabel(p.bu_id)):'')+'</option>';
        }).join('');
      }())+'</select>'
      +'<p class="fh">Le consultant rejoint l\'équipe de ce gestionnaire et <strong>hérite de sa Business Unit</strong>.</p></div>'
      +'</div>'

      +'</div>'
      +'<div class="br"><button class="bg" data-act="mc">Annuler</button><button class="bp" data-act="screc">'+(it?'Enregistrer':'Cr\u00e9er le candidat')+'</button></div>';
  }

  if(tp==='utilisateur'){
    title=it?'Modifier le membre':'Ajouter un membre';wide=true;
    var _rl=[];((S._all&&S._all.cons)||S.cons).forEach(function(c){var r=c.dir||'';if(r&&_rl.indexOf(r)<0)_rl.push(r);});_rl.sort();
    /* Grades disponibles selon le rôle du créateur */
    var availGrades=['Consultant Junior','Consultant Confirmé','Consultant Sénior','Manager','Business Manager'];
    /* Les comptes à rôle (Admin/Gestionnaire/Recruteur/Sales) se créent via Gestion des accès — une seule porte d'entrée */
    /* Managers \u00e9ligibles comme N+1 : les membres \u00e0 licence de management
       (moi inclus) + les responsables d\u00e9j\u00e0 existants. Liste d\u00e9roulante, plus
       de saisie libre. */
    var _mgrNames=[];
    (S.orgProfiles||[]).forEach(function(p){
      if(['gestionnaire','admin','super_admin'].indexOf(p.role)<0)return;
      var nm=((p.first_name||'')+' '+(p.last_name||'')).trim();
      var me=(p.id===S._userId);
      if(!nm&&me)nm=(S.profileFirstName+' '+S.profileLastName).trim()||S._userEmail||'Moi';
      if(nm&&_mgrNames.indexOf(nm)<0)_mgrNames.push(nm+(me?' me':''));
    });
    _mgrNames=_mgrNames.map(function(x){return x.replace(' me','');});
    _rl.forEach(function(r){if(_mgrNames.indexOf(r)<0)_mgrNames.push(r);});
    var _curDir=it?(it.dir||''):'';
    if(_curDir&&_mgrNames.indexOf(_curDir)<0)_mgrNames.push(_curDir);
    var dirFld=(S.role==='gestionnaire')
      ? '<div class="fd"><label class="fl">Responsable (N+1)</label><input class="ic" id="mdir" value="'+esc(S.dirName)+'" disabled style="background:#f1f5f9;color:#64748b"><p class="fh">Membre rattach\u00e9 automatiquement \u00e0 votre \u00e9quipe</p></div>'
      : '<div class="fd"><label class="fl">Responsable (N+1)</label><select class="ic" id="mdir"><option value="">\u2014 Aucun \u2014</option>'+_mgrNames.map(function(n){return '<option value="'+esc(n)+'"'+(n===_curDir?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select><p class="fh">Vous ou un gestionnaire de votre organisation</p></div>';
    /* Champ Business Unit : modifiable uniquement par le N+1 du consultant
       (admin/super_admin au-dessus). En cr\u00e9ation, h\u00e9rite du N+1 choisi. */
    var _canBU=it?isConsMyReport(it):canEditTeam();
    var _curBU=it?(it.buId||''):'';
    var buFld=buNodes().length
      ? '<div class="fd"><label class="fl">Business Unit</label><select class="ic" id="mbu"'+(_canBU?'':' disabled title="Seul le N+1 (gestionnaire direct) peut modifier la BU"')+'>'
        +'<option value="">\u2014 Aucune \u2014</option>'
        +buNodes().slice().sort(function(a,b){return buPathLabel(a.id).localeCompare(buPathLabel(b.id),'fr');}).map(function(n){return '<option value="'+n.id+'"'+(_curBU===n.id?' selected':'')+'>'+esc(buPathLabel(n.id))+'</option>';}).join('')
        +'</select><p class="fh">'+(_canBU?'Laissez vide pour h\u00e9riter de la BU du N+1.':'Rattachement r\u00e9serv\u00e9 au N+1 (gestionnaire direct).')+'</p></div>'
      : '<div class="fd"><label class="fl">Business Unit</label><input class="ic" disabled value="Aucune BU d\u00e9finie" style="background:#f1f5f9;color:#94a3b8"><p class="fh">Le super_admin cr\u00e9e les BU dans Param\u00e8tres.</p></div>';
    body='<div class="g2">'
      +'<div class="fd"><label class="fl">Nom complet *</label><input class="ic" id="mn" value="'+esc(it?it.name:'')+'" placeholder="Prénom Nom"></div>'
      +'<div class="fd"><label class="fl">Grade / Rôle</label><select class="ic" id="mti"><option value="">— Aucun / non applicable —</option>'+availGrades.map(function(g){return '<option value="'+g+'"'+(it&&it.title===g?' selected':'')+'>'+esc(g)+'</option>';}).join('')+'</select><p class="fh">'+'Optionnel. Les grades concernent les consultants ; un Admin peut le laisser vide. Pour créer un compte Admin/Gestionnaire/Recruteur/Business Manager : utilisez Gestion des accès.'+'</p></div>'
      +'<div class="fd"><label class="fl">SCR journalier (€)</label><input class="ic" id="ms" type="number" min="0" value="'+esc(it?String(it.scr):'')+'" placeholder="450"><p class="fh">Coût journalier (calculé automatiquement si salaire annuel connu)</p></div>'
      +'<div class="fd"><label class="fl">Type de contrat</label><select class="ic" id="mcontract">'
      +'<option value="salarie"'+(it&&it.contract==='salarie'?' selected':(!it?' selected':''))+'>\uD83D\uDC54 Salari\u00e9</option>'
      +'<option value="freelance"'+(it&&it.contract==='freelance'?' selected':'')+'>\uD83D\uDD17 Freelance</option>'
      +'</select><p class="fh">Salari\u00e9\u00a0: co\u00fbt = SCR \u00d7 113.35 \u00d7 1.25 \u00b7 Freelance\u00a0: co\u00fbt = SCR \u00d7 jours</p></div>'
      +'<input type="hidden" id="mgrade" value="'+(it?esc(it.grade||''):'')+'">'
      +'<div class="fd"><label class="fl">Email</label><input class="ic" id="me" type="email" value="'+esc(it?it.email:'')+'" placeholder="prenom.nom@exemple.com"></div>'
      +'<div class="fd"><label class="fl">Date d\'arriv\u00e9e</label><input class="ic" id="marr" type="date" value="'+esc(it&&it.arrive?it.arrive:'')+'"><p class="fh">Laissez vide si pr\u00e9sent depuis le d\u00e9but du FY</p></div>'
      +'<div class="fd"><label class="fl">Date de d\u00e9part</label><input class="ic" id="mdep" type="date" value="'+esc(it&&it.depart?it.depart:'')+'"><p class="fh">Laissez vide si toujours en poste</p></div>'
      +'<div class="fd cs2">'+dirFld+'</div>'
      +buFld
      +'<div class="fd cs2" id="cons-mob-block">'+consMobInner()+'</div>'
      +'<div class="fd cs2"><label class="fl">Expertises</label><div id="exp-wrap">'+expPickerHTML()+'</div></div>'
      +'<div class="fd cs2"><label class="fl">Connaissance secteur</label><div id="sec-wrap">'+secPickerHTML()+'</div></div>'
      +'</div>'
      +'<div class="br"><button class="bg" data-act="mc">Annuler</button><button class="bp" data-act="sc">'+(it?'Enregistrer':'Ajouter')+'</button></div>';
  }
  if(tp==='mission'){
    title=it?'Modifier la mission':'Nouvelle mission';wide=true;
    var bt=(it&&it.btype)||'at';
    var wdsel=(it&&it.wdays&&it.wdays.length)?it.wdays:[1,2,3,4,5];
    var WLBL=[['1','Lun'],['2','Mar'],['3','Mer'],['4','Jeu'],['5','Ven']];
    body='<div class="g2"><div class="cs2"><div class="fd"><label class="fl">Consultant *</label>'
      +(it?'<select class="ic" id="mcid">'+co+'</select>'
          :'<select class="ic" id="mcid" multiple size="5" style="min-height:118px">'+co+'</select><p class="fh">S\u00e9lectionnez un ou plusieurs consultants (Ctrl/Cmd pour en choisir plusieurs) \u2014 une mission (Assistance technique) sera cr\u00e9\u00e9e pour chacun.</p>')
      +'</div></div>'
      +'<div class="cs2"><div class="fd"><label class="fl">Nom de la mission *</label><input class="ic" id="mmn" list="mmn-list" value="'+esc(it?it.name:'')+'" placeholder="ex\u00a0: Transformation Digitale SI" onchange="missPrefillFromName()"><datalist id="mmn-list">'+missNameDatalistOpts()+'</datalist><p class="fh">Choisissez une mission existante pour affecter un consultant \u00e0 la m\u00eame mission \u2014 le client et les d\u00e9tails se pr\u00e9-remplissent.</p></div></div>'
      +'<div class="cs2"><div class="fd"><label class="fl">Code projet</label><input class="ic" id="mpcd" value="'+(it&&it.pcode?esc(it.pcode):'')+'" placeholder="ex\u00a0: 300000000106376"><p class="fh">Code de facturation PSA/SAP \u2014 utilis\u00e9 pour le recoupement des imputations import\u00e9es</p></div></div>'
      +'<div class="cs2"><div class="fd"><label class="fl">Nom du client *</label><input class="ic" id="mcl" value="'+esc(it?it.cli:'')+'" placeholder="ex\u00a0: BNP Paribas"></div></div>'
      +(S.role!=='utilisateur'?'<div class="fd"><label class="fl">TJM factur\u00e9 (\u20ac)</label><input class="ic" id="mtj" type="number" min="0" value="'+esc(it?String(it.tjm):'')+'" placeholder="750"><p class="fh">Prix journalier de vente (Assistance technique)</p></div>':'<input type="hidden" id="mtj" value="0">')
      +'<div class="cs2"><div class="fd"><label class="fl">Type de mission *</label>'
      +'<div style="display:flex;gap:18px;padding:4px 0">'
      +'<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:500"><input type="radio" name="mbt" value="at"'+(bt!=='forfait'?' checked':'')+' style="accent-color:#84CC16"> Assistance technique</label>'
      +'<label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:500"><input type="radio" name="mbt" value="forfait"'+(bt==='forfait'?' checked':'')+' style="accent-color:#84CC16"> Forfait</label>'
      +'</div><p class="fh">AT : CA = jours travaill\u00e9s \u00d7 TJM \u00b7 Forfait : montant fixe + marge cible</p></div></div>'
      +(bt==='forfait'?
        '<div class="cs2" id="ft-fields"><div class="g2">'
        +'<div class="fd"><label class="fl">Montant du deal \u2014 CA (\u20ac) *</label><input class="ic" id="mdeal" type="number" min="0" value="'+esc(it&&it.deal?String(it.deal):'')+'" placeholder="120000"></div>'
        +'<div class="fd"><label class="fl">Marge recherch\u00e9e (%) *</label><input class="ic" id="mtmar" type="number" min="0" max="100" value="'+((it&&it.tmar!=null&&it.tmar!=='')?esc(String(it.tmar)):'')+'" placeholder="30"><p class="fh">Sert \u00e0 calculer les jours restants \u00e0 travailler</p></div>'
        +'<div class="fd cs2"><label class="fl">Consultants sur le forfait</label>'
        +'<div id="miss-team" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">'
        +((it&&it.team&&it.team.length?it.team:S.modal&&S.modal.team&&S.modal.team.length?S.modal.team:[{cid:defCid,taux:100}]).map(function(tm,idx){
          var tCons=S.cons.filter(function(c){return c.grade!=='sales_grade';});
          var cOpts=tCons.map(function(c){return '<option value="'+c.id+'"'+(c.id===tm.cid?' selected':'')+'>'+esc(c.name)+'</option>';}).join('');
          return '<div class="miss-team-row" style="display:flex;gap:8px;align-items:center">'
            +'<select class="ic" style="flex:2" data-team-cid="'+idx+'"><option value="">— Consultant —</option>'+cOpts+'</select>'
            +'<button onclick="this.closest(\'.miss-team-row\').remove()" style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-weight:700">✕</button>'
            +'</div>';
        }).join(''))
        +'</div>'
        +'<button onclick="addMissTeamRow()" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:7px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:700">+ Ajouter un membre</button>'
        +'</div></div></div>' /* closes fd cs2 + g2 + cs2 ft-fields */
        :'<input type="hidden" id="mdeal"><input type="hidden" id="mtmar">')
      +'<div class="cs2"><div class="fd"><label class="fl">Jours travaillés</label>'
      +'<div id="mcal-wrap">'+mCalHTML()+'</div></div></div>'
      +'<div class="fd"><label class="fl">Localisation</label><input class="ic" id="mlo" value="'+esc(it?it.loc:'')+'" placeholder="Paris (75009)"></div>'
      +'<div class="fd"><label class="fl">Date de d\u00e9marrage *</label><input class="ic" id="msd" type="date" value="'+esc(it?it.sd:'')+'"></div>'
      +'<div class="fd"><label class="fl">Date de fin</label><input class="ic" id="med" type="date" value="'+esc(it&&it.ed?it.ed:'')+'"><p class="fh">Laisser vide si inconnue</p></div>'
      +'<div class="cs2"><div class="fd"><label class="fl">Responsable de mission</label><input class="ic" id="mmg" value="'+esc(it?it.mgr:'')+'" placeholder="Nom du responsable de cette mission (peut varier selon la mission)"></div></div>'
      +'<div class="fd"><label class="fl">Contact client - Nom</label><input class="ic" id="mcc" value="'+esc(it?it.ccn:'')+'" placeholder="Nom du contact"></div>'
      +'<div class="fd"><label class="fl">Contact client - Poste</label><input class="ic" id="mcr" value="'+esc(it?it.ccr:'')+'" placeholder="ex\u00a0: DSI, DAF, CDO"></div></div>'
      +'<div class="br"><button class="bg" data-act="mc">Annuler</button><button class="bp" data-act="sm">'+(it?'Enregistrer':'Ajouter')+'</button></div>';
  }

  if(tp==='onboarding'){
    var steps=(ONBOARDING_STEPS[S.role]||ONBOARDING_STEPS.utilisateur);
    var step=(m.step||0);
    var st=steps[step]||steps[0];
    var isLast=step===steps.length-1;
    title=st.icon+' '+st.title;
    body='<div style="text-align:center;padding:10px 0">'
      +'<div style="font-size:52px;margin-bottom:12px">'+st.icon+'</div>'
      +'<div style="font-size:15px;color:#374151;line-height:1.6;margin-bottom:16px">'+st.desc+'</div>'
      /* Progress dots */
      +'<div style="display:flex;justify-content:center;gap:6px;margin-bottom:20px">'
      +steps.map(function(_,i){return '<div style="width:8px;height:8px;border-radius:50%;background:'+(i===step?'#1B2B3A':'#e2e8f0')+'"></div>';}).join('')
      +'</div></div>';
    saveAction=null;
    return '<div class="mov"><div class="mob" style="max-width:480px">'
      +'<div class="moh"><div class="mot">'+title+'</div></div>'
      +'<div class="mody">'+body
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">'
      +(step>0?'<button class="bsec" onclick="S.modal.step='+(step-1)+';render()">\u2190 Pr\u00e9c\u00e9dent</button>':'<span></span>')
      +(isLast
        ?'<button class="bp" onclick="markOnboardingDone()">\uD83C\uDF89 Commencer !</button>'
        :'<button class="bp" onclick="S.modal.step='+(step+1)+';render()">Suivant \u2192</button>')
      +'</div></div></div></div>';
  }


  if(tp==='tutorial'){
    var tutId=m.tutId||'recrutement';
    var tut=TUTORIALS[tutId];
    if(!tut)return '';
    var step=m.tutStep||0;
    var steps=tut.steps;
    var st=steps[Math.min(step,steps.length-1)];
    var isLast=step>=steps.length-1;
    return '<div class="mov"><div class="mob" style="max-width:720px;height:90vh;display:flex;flex-direction:column">'
      +'<div class="moh" style="background:'+tut.color+';border-radius:16px 16px 0 0">'
      +'<div style="display:flex;align-items:center;gap:10px;flex:1"><div style="color:#fff;font-weight:800;font-size:15px">'+esc(tut.title)+'</div></div>'
      +'<button class="moc" style="color:rgba(255,255,255,.7)" onclick="S.modal=null;render()">✕</button></div>'
      +'<div class="mody" style="flex:1;overflow-y:auto;padding:20px">'
      /* Progress bar */
      +'<div style="display:flex;gap:6px;margin-bottom:16px">'
      +steps.map(function(_,i){
        return '<div style="flex:1;height:4px;border-radius:2px;background:'+(i<=step?tut.color:'#e2e8f0')+'"></div>';
      }).join('')
      +'</div>'
      /* Numéro étape */
      +'<div style="font-size:11px;font-weight:700;color:'+tut.color+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Étape '+(step+1)+' / '+steps.length+'</div>'
      /* Titre étape */
      +'<div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:10px">'+esc(st.title)+'</div>'
      /* Description */
      +'<div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:16px">'+st.desc+'</div>'
      /* Visuel SVG */
      +(st.svg?'<div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:16px">'+st.svg()+'</div>':'')
      +'</div>'
      /* Navigation */
      +'<div style="padding:14px 20px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">'
      +(step>0?'<button class="bsec" onclick="tutPrev()">← Précédent</button>':'<span></span>')
      +'<span style="font-size:12px;color:#94a3b8">'+esc(tut.title)+'</span>'
      +(isLast
        ?'<button class="bp" style="background:'+tut.color+'" onclick="S.modal=null;render()">✓ Terminé</button>'
        :'<button class="bp" style="background:'+tut.color+'" onclick="tutNext()">Suivant →</button>')
      +'</div></div></div>';
  }


  if(tp==='invite_link'){
    title='\u2705 Membre ajout\u00e9 \u00e0 l\u2019organisation';
    body='<div style="text-align:center;padding:8px 0">'
      +'<div style="font-size:34px;margin-bottom:10px">\uD83D\uDC4B</div>'
      +'<div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:4px">'+esc(m.name||'')+'</div>'
      +'<div style="font-size:12px;font-weight:700;color:#84CC16;margin-bottom:12px">'+esc(rLabel(m.role||''))+'</div>'
      +'<div style="font-size:12.5px;color:#374151;line-height:1.6;margin-bottom:14px">'
      +'La fiche est d\u00e9j\u00e0 visible dans votre \u00e9quipe.<br>'
      +'Pour activer son acc\u00e8s, la personne cr\u00e9e simplement son compte sur <strong>konsilys.fr</strong> avec l\u2019email\u00a0:'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px">'
      +'<input class="ic" id="inv-email-field" value="'+esc(m.email||'')+'" readonly style="flex:1;font-size:12px;background:transparent;border:none;text-align:center;font-weight:600">'
      +'<button class="bp" style="font-size:11px;padding:6px 12px;white-space:nowrap" onclick="var f=document.getElementById(\'inv-email-field\');f.select();document.execCommand(\'copy\');this.textContent=\'\u2713 Copi\u00e9\'">Copier</button>'
      +'</div>'
      +'<div style="font-size:11px;color:#94a3b8;margin-top:10px">Son r\u00f4le, son rattachement et ses acc\u00e8s seront appliqu\u00e9s automatiquement \u00e0 sa premi\u00e8re connexion.</div>'
      +'</div>';
    return '<div class="mov" id="mov"><div class="mbox mn">'
      +'<div class="moh"><div class="mot">'+title+'</div><button class="moc" data-act="mc">\u2715</button></div>'
      +'<div class="mody">'+body+'<div class="br"><button class="bg" data-act="mc">Fermer</button></div></div></div></div>';
  }
  if(tp==='salary_detail'){
    /* Calcul simplifié : SCR × 113.35 × 1.25 / (trimestre ? 4 : 1) */
    var _periodLabel=S.quarter?('Q'+S.quarter+' '+fyLbl(S.year)):fyLbl(S.year);
    var _costFactor=S.quarter?0.25:1; /* diviser par 4 si trimestre */
    title='\uD83D\uDCB0 Co\u00fbt salarial \u2014 '+_periodLabel;
    wide=true;
    var _cons2=S.cons.slice().sort(function(a,b){
      return ((b.scr||0)*113.35*1.25*_costFactor)-((a.scr||0)*113.35*1.25*_costFactor);
    });
    var _totSal2=_cons2.reduce(function(s,cc){return s+(cc.scr||0)*113.35*1.25*_costFactor;},0);
    var _recSal=_cons2.filter(function(cc){return cc.role==='recruteur';}).reduce(function(s,cc){return s+(cc.scr||0)*113.35*1.25*_costFactor;},0);
    var _bmSal=_cons2.filter(function(cc){return cc.grade==='sales_grade';}).reduce(function(s,cc){return s+(cc.scr||0)*113.35*1.25*_costFactor;},0);
    var _rows=_cons2.map(function(cc){
      var isRec=cc.role==='recruteur';var isBM=cc.grade==='sales_grade';
      var cost=(cc.scr||0)*113.35*1.25*_costFactor;
      var color=isRec?'#0F766E':isBM?'#1e40af':'#374151';
      var rowBg=isRec?'#f0fdf4':isBM?'#eff6ff':'transparent';
      var badge=isRec
        ?'<span style="font-size:9px;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:99px;font-weight:700">Recruteur</span>'
        :isBM?'<span style="font-size:9px;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:99px;font-weight:700">Business Manager</span>'
        :'';
      return '<tr style="background:'+rowBg+'">'
        +'<td style="font-weight:600;color:'+color+'">'+esc(cc.name)+'</td>'
        +'<td>'+badge+'</td>'
        +'<td style="font-size:11px;color:#64748b">'+(cc.contract==='freelance'?'Freelance':'Salari\u00e9')+'</td>'
        +'<td style="font-weight:700;color:'+color+'">'+fEur(Math.round(cost))+'</td>'
        +'</tr>';
    }).join('');
    body='<div class="ov" style="max-height:55vh;overflow-y:auto">'
      +'<table><thead><tr><th>Nom</th><th></th><th>Contrat</th><th>Co\u00fbt '+_periodLabel+'</th></tr></thead><tbody>'
      +_rows
      +'</tbody></table></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:12px;background:#f8fafc;border-radius:8px">'
      +'<div style="font-size:13px;font-weight:700;color:#0f172a">Total \u00e9quipe \u2014 '+_periodLabel+'</div>'
      +'<div style="font-size:16px;font-weight:900;color:#1B2B3A">'+fEur(Math.round(_totSal2))+'</div>'
      +'</div>'
      +((_recSal>0||_bmSal>0)?'<div style="margin-top:8px;padding:10px 12px;background:#f0fdf4;border-radius:8px;font-size:12px;display:flex;gap:16px">'
        +(_recSal>0?'<div><span style="color:#0F766E;font-weight:700">Recruteurs : '+fEur(Math.round(_recSal))+'</span></div>':'')
        +(_bmSal>0?'<div><span style="color:#1e40af;font-weight:700">Business Managers : '+fEur(Math.round(_bmSal))+'</span></div>':'')
        +'</div>':'')
      +'<div style="margin-top:10px;font-size:11px;color:#94a3b8">Formule : SCR \u00d7 113,35 \u00d7 1,25'+(S.quarter?' \u00f7 4 (trimestre)':'')+'</div>';
    return '<div class="mov" id="mov"><div class="mbox '+(wide?'mw':'mn')+'">'
      +'<div class="moh"><div class="mot">'+title+'</div><button class="moc" data-act="mc">\u2715</button></div>'
      +'<div class="mody">'+body
      +'<div class="br"><button class="bg" data-act="mc">Fermer</button></div>'
      +'</div></div></div>';
  }

  if(tp==='leave'){
    title=it?"Modifier l'absence":"Nouvelle absence / cong\u00e9";
    var dt=(it&&it.type)||'Cong\u00e9 pay\u00e9';
    var lo=LTYPES.map(function(t){return '<option value="'+t+'"'+(t===dt?' selected':'')+'>'+esc(t)+'</option>';}).join('');
    /* Admin / Gestionnaire : leur propre fiche remontée en tête + pré-sélectionnée */
    var selfCid=(it&&it.cid)||(S.consId||'');
    var consSorted=S.cons.slice().sort(function(a,b){
      if(a.id===S.consId)return -1; if(b.id===S.consId)return 1; return 0;
    });
    var coLeave=consSorted.map(function(x){
      var label=(x.id===S.consId)?('\u2605 Moi \u2014 '+x.name):x.name;
      return '<option value="'+x.id+'"'+(x.id===selfCid?' selected':'')+'>'+esc(label)+'</option>';
    }).join('');
    body='<div class="fd"><label class="fl">'+rLabel('utilisateur')+'</label><select class="ic" id="mlc">'+coLeave+'</select></div>'
      +'<div class="fd"><label class="fl">Type *</label><select class="ic" id="mlt">'+lo+'</select></div>'
      +'<div class="g2"><div class="fd"><label class="fl">Du *</label><input class="ic" id="mls" type="date" value="'+esc(it?it.s:'')+'"></div>'
      +'<div class="fd"><label class="fl">Au *</label><input class="ic" id="mle" type="date" value="'+esc(it?it.e:'')+'"></div></div>'
      +'<div class="br"><button class="bg" data-act="mc">Annuler</button><button class="bp" data-act="sl">'+(it?'Enregistrer':'Ajouter')+'</button></div>';
  }
  if(tp==='dayexc'){
    var dd=m.day,dcid=m.cid,dc=S.cons.find(function(x){return x.id===dcid;});
    title=fDt(dd)+' — '+(dc?dc.name:'');
    var lv=S.lvs.find(function(l){return l.cid===dcid&&l.s<=dd&&dd<=l.e;});
    if(lv&&lv.s===dd&&lv.e===dd){
      body='<p style="font-size:13px;color:#475569;margin-bottom:14px">Actuellement : <strong>'+esc(lv.type)+'</strong></p>'
        +'<div class="br"><button class="bg" data-act="mc">Fermer</button><button class="bp" data-act="day-clear" data-id="'+lv.id+'">Réactiver (jour travaillé)</button></div>';
    }else if(lv){
      body='<p style="font-size:13px;color:#475569">Ce jour est couvert par une absence du <strong>'+fDt(lv.s)+'</strong> au <strong>'+fDt(lv.e)+'</strong> ('+esc(lv.type)+').<br>Modifiez-la dans l\'onglet <strong>Absences</strong>.</p>'
        +'<div class="br"><button class="bp" data-act="mc">Fermer</button></div>';
    }else{
      var lo=LTYPES.map(function(t){return '<option value="'+t+'"'+(t==='Mission interne'?' selected':'')+'>'+esc(t)+'</option>';}).join('');
      body='<p style="font-size:13px;color:#475569;margin-bottom:12px">Marquer ce jour comme <strong>non travaillé</strong> :</p>'
        +'<div class="fd"><label class="fl">Motif</label><select class="ic" id="dexc-type">'+lo+'</select><p class="fh">« Mission interne » / « Inter-contrat » = non facturé au client</p></div>'
        +'<div class="br"><button class="bg" data-act="mc">Annuler</button><button class="bp" data-act="day-set">Marquer non travaillé</button></div>';
    }
  }
  /* ── Modal invitation par email ── */
  if(tp==='invite_mailto'){
    title='\uD83D\uDCE7 Invitation \u2014 '+esc(m.consName||'');
    body='<div style="text-align:center;padding:12px 0 20px">'
      +'<div style="font-size:13px;color:#374151;margin-bottom:20px">'
      +'Un lien d\u2019invitation a \u00e9t\u00e9 g\u00e9n\u00e9r\u00e9 pour <strong>'+esc(m.consName||'')+'</strong>'
      +'<br>(<span style="color:#64748b">'+esc(m.email||'')+'</span>).</div>'
      +'<a href="'+esc(m.mailtoUrl||'')+'" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:.01em">'
      +'\uD83D\uDCE8 Ouvrir ma messagerie pour envoyer</a>'
      +'<div style="margin-top:16px;font-size:11px;color:#94a3b8">'
      +'Cliquez le bouton ci-dessus pour ouvrir votre client email (Outlook, Gmail, Mail...).<br>'
      +'L\u2019email sera pr\u00e9-rempli avec le lien d\u2019invitation.</div>'
      +'<div style="margin-top:14px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:11px;color:#475569;word-break:break-all;text-align:left">'
      +'<span style="color:#94a3b8">Lien\u00a0: </span>'+esc(m.invLink||'')+'</div>'
      +'</div>'
      +'<div class="br"><button class="bg" data-act="mc">Fermer</button></div>';
  }
  /* ── Modal code d’invitation consultant ── */
  if(tp==='invite_code'){
    title='\uD83D\uDD11 Code d\u2019invitation — '+esc(m.consName||'');
    body='<div style="text-align:center;padding:12px 0 8px">'
      +'<div style="font-size:13px;color:#374151;margin-bottom:18px">Transmettez ce code \u00e0 <strong>'+esc(m.consName||'')+'</strong>.</div>'
      +'<div id="inv-code-box" style="font-size:32px;font-weight:900;letter-spacing:6px;color:#2563eb;background:#eff6ff;padding:20px 28px;border-radius:12px;border:2px solid #bfdbfe;cursor:text;user-select:all">'+esc(m.code||'')+'</div>'
      +'<div style="font-size:12px;color:#94a3b8;margin-top:10px">Cliquez sur le code pour le s\u00e9lectionner, puis Ctrl+C / Cmd+C pour copier.</div>'
      +'<div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#15803d;text-align:left">'
      +'\u2139\uFE0F Code \u00e0 usage unique. Le consultant le saisira sur la page de connexion pour cr\u00e9er son compte et \u00eatre rattach\u00e9 \u00e0 votre \u00e9quipe.'
      +'</div></div>'
      +'<div class="br">'
      +'<button class="bp" onclick="var el=document.getElementById(\'inv-code-box\');if(el){var r=document.createRange();r.selectNode(el);window.getSelection().removeAllRanges();window.getSelection().addRange(r);}">S\u00e9lectionner le code</button>'
      +'<button class="bg" data-act="mc">Fermer</button></div>';
  }
  /* ── Modal confirmation "demande envoyée" ── */
  if(tp==='approval_sent'){
    title='\uD83D\uDD14 Demande envoy\u00e9e';
    body='<div style="text-align:center;padding:20px 0">'
      +'<div style="font-size:48px;margin-bottom:12px">\u23f3</div>'
      +'<div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:8px">Votre demande est en cours d\u2019analyse</div>'
      +'<div style="font-size:13px;color:#64748b;max-width:320px;margin:0 auto">'
      +esc(m.desc||'')
      +'<br><br>Votre directeur recevra une notification et devra approuver ou refuser cette modification.'
      +'<br>Vous serez inform\u00e9(e) dans l\u2019onglet <strong>Approbations</strong>.</div></div>'
      +'<div class="br"><button class="bp" data-act="mc">Compris</button></div>';
  }
  /* ── Modal refus avec motif (directeur) ── */
  if(tp==='appr_reject'){
    title='Refuser la demande';
    body='<div style="font-size:13px;color:#64748b;margin-bottom:12px">Demande de <strong>'+esc(m.consName||'')+'</strong> : '+esc(m.applyDesc||'')+'</div>'
      +'<div class="fd"><label class="fl">Motif du refus *</label>'
      +'<textarea class="ic" id="appr-reason" rows="3" placeholder="Expliquez la raison du refus au consultant\u2026" style="resize:vertical"></textarea></div>'
      +'<div class="br"><button class="bg" data-act="mc">Annuler</button>'
      +'<button class="bp" style="background:#b91c1c;border-color:#b91c1c" data-act="appr-ko-confirm" data-id="'+esc(m.reqId||'')+'">Confirmer le refus</button></div>';
  }
  /* ── Modal import consultants (Excel/CSV) ── */
  if(tp==='import_cons'){
    wide=true;
    title='📥 Importer des consultants';
    body=tImportConsBody();
  }
  return '<div class="mov" id="mov"><div class="mbox '+(wide?'mw':'mn')+'">'
    +'<div class="mhd"><h3>'+esc(title)+'</h3><button class="mcl" data-act="mc">&times;</button></div>'
    +'<div class="mbd">'+body+'</div></div></div>';
}

