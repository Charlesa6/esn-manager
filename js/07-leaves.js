'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   TEMPLATE - LEAVES
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function tLeaves(){
  var H=fyHols(S.year);
  var _r=curRange(S.year);var fyS=_r[0],fyE=_r[1];

  var fil=S.lvs.filter(function(l){
    if(S.flc!=='all'&&l.cid!==S.flc)return false;
    return l.e>=fyS&&l.s<=fyE;
  }).sort(function(a,b){return a.s.localeCompare(b.s);});

  var co='<option value="all">Tous les consultants</option>'+S.cons.map(function(c){
    return '<option value="'+c.id+'"'+(c.id===S.flc?' selected':'')+'>'+esc(c.name)+'</option>';
  }).join('');

  var TCC={
    'Cong\u00e9 pay\u00e9':'#dbeafe|#1e40af','RTT':'#ede9fe|#5b21b6',
    'Formation':'#dcfce7|#15803d','Inter-contrat':'#ffedd5|#c2410c',
    'Maladie':'#fee2e2|#b91c1c','Cong\u00e9 maternit\u00e9':'#fce7f3|#9d174d',
    'Cong\u00e9 sans solde':'#f1f5f9|#475569','Mission interne':'#ccfbf1|#0f766e','Autre':'#f1f5f9|#475569'
  };
  function isArret(t){return t==='Maladie'||t==='Cong\u00e9 maternit\u00e9'||t==='Cong\u00e9 sans solde';}

  var bodyHtml='';

  if(S.flc==='all'){
    /* ── Vue synth\u00e8se : indicateur par consultant ── */
    var sumRows=S.cons.map(function(c){
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

  return '<div><div class="ph"><div><div class="pt">Absences &amp; Cong\u00e9s</div><div class="ps">'+sub+'</div></div>'
    +'<div style="display:flex;gap:8px;align-items:center">'
    +'<button class="bp" data-act="al">+ Ajouter une absence</button>'
    +'<button class="bg" onclick="document.getElementById(\'lv-xls-inp\').click()">\u2191 Importer un fichier</button>'
    +'<input type="file" id="lv-xls-inp" accept=".xlsx" style="display:none" onchange="importStaffingXLS(this.files[0]);this.value=\'\'"></div></div>'
    +'<div style="margin-bottom:16px"><select class="ic" style="max-width:240px" id="flc">'+co+'</select></div>'
    +'<div class="card ov" style="margin-bottom:16px">'+bodyHtml+'</div>'
    +'<details><summary>\uD83D\uDCC5 Jours f\u00e9ri\u00e9s fran\u00e7ais int\u00e9gr\u00e9s dans les calculs</summary>'
    +'<div style="margin-top:8px;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px 16px">'+hols+'</div></details></div>';
}

