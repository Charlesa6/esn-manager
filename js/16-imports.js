'use strict';
/* ══════════════════════════════════════════════════════════════
   IMPORT GÉNÉRIQUE — Candidats & Opportunités (Excel / CSV)

   Même principe que l'import d'équipe (js/14-data-boot.js) : on télécharge
   un modèle Excel (.xlsx) pré-formaté, on le remplit, on l'importe. Les
   colonnes sont reconnues automatiquement puis ajustables, un aperçu montre
   les nouveautés / doublons / lignes invalides avant écriture.

   Un seul moteur paramétré par une « spec » d'import (IMPORT_SPECS) :
   champs + alias d'auto-mapping, type de chaque colonne, construction de
   l'objet applicatif et écriture (réutilise sbUpsertCand / sbUpsertCrmOpp,
   source de vérité unique des colonnes Supabase). État: S.imp2.
══════════════════════════════════════════════════════════════ */

/* ── Convertisseurs de cellules ── */
function _impStr(v){return String(v==null?'':v).trim();}
function _impNum(v){var n=parseFloat(String(v==null?'':v).replace(/[^\d.,-]/g,'').replace(',','.'));return isNaN(n)?0:n;}
function _impList(v){return String(v==null?'':v).split(/[,;/|]+/).map(function(x){return x.trim();}).filter(Boolean);}
function _impPad(x){return String(x).length<2?'0'+x:String(x);}
function _impDate(v){
  if(!v)return '';
  if(v instanceof Date)return v.getFullYear()+'-'+_impPad(v.getMonth()+1)+'-'+_impPad(v.getDate());
  var s=String(v).trim();
  var m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){var y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+_impPad(m[2])+'-'+_impPad(m[1]);}
  var m2=s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if(m2)return m2[1]+'-'+_impPad(m2[2])+'-'+_impPad(m2[3]);
  return '';
}
/* Rapproche une valeur libre d'un statut (par id OU par libellé, tolérant aux
   symboles ✓/✗ et à la casse). Repli sur le statut par défaut. */
function _impPickStatus(v,list,def){
  var raw=String(v==null?'':v).toLowerCase().replace(/[^a-z0-9àâäéèêëïîôöùûüç]+/g,'').trim();
  if(!raw)return def;
  for(var i=0;i<list.length;i++){
    var idN=String(list[i].id).toLowerCase().replace(/[^a-z0-9]+/g,'');
    var lbN=String(list[i].lb).toLowerCase().replace(/[^a-z0-9àâäéèêëïîôöùûüç]+/g,'');
    if(raw===idN||raw===lbN||(lbN&&raw.indexOf(lbN)>=0)||(lbN&&lbN.indexOf(raw)>=0))return list[i].id;
  }
  return def;
}
function _impBtype(v){var l=String(v==null?'':v).toLowerCase();return (l.indexOf('forfait')>=0||l.indexOf('fixe')>=0||l.indexOf('fixed')>=0||l.indexOf('package')>=0)?'forfait':'at';}

/* ── Auto-mapping colonne → champ (exact puis inclusion, sans réutiliser une
   colonne déjà prise) ── */
function _impAutoMap(headers,fields){
  var am={},norm=headers.map(function(h){return String(h||'').toLowerCase().replace(/\s*\*/g,'').replace(/\s+/g,' ').trim();});
  function used(i){for(var k in am){if(am[k]===i)return true;}return false;}
  fields.forEach(function(f){
    var al=(f.aliases||[]).map(function(a){return a.toLowerCase();});
    /* passe 1 : égalité stricte */
    for(var i=0;i<norm.length&&am[f.k]===undefined;i++){if(al.indexOf(norm[i])>=0&&!used(i))am[f.k]=i;}
    /* passe 2 : inclusion */
    for(var j=0;j<norm.length&&am[f.k]===undefined;j++){for(var q=0;q<al.length;q++){if(al[q]&&norm[j].indexOf(al[q])>=0&&!used(j)){am[f.k]=j;break;}}}
  });
  return am;
}

/* ── Modèle .xlsx réel (1 feuille : en-tête en gras + 1 ligne d'exemple) ──
   Réutilise les briques OOXML bas niveau de js/06-kpis.js (_zipStore, _xSheet…). */
function _impXlsxTemplate(sheetName,headers,example){
  var rows=[headers.map(function(h){return {v:h,t:'s',s:1};}),(example||[]).map(function(v){return {v:v,t:'s'};})];
  var CT='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  var RELS='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  var WB='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+_xesc(sheetName).slice(0,31)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';
  var WBR='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  var ST='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  return _zipStore([
    {name:'[Content_Types].xml',data:_u8(CT)},
    {name:'_rels/.rels',data:_u8(RELS)},
    {name:'xl/workbook.xml',data:_u8(WB)},
    {name:'xl/_rels/workbook.xml.rels',data:_u8(WBR)},
    {name:'xl/styles.xml',data:_u8(ST)},
    {name:'xl/worksheets/sheet1.xml',data:_u8(_xSheet(rows))}
  ]);
}
function _impDL(u8,name,mime){
  var blob=new Blob([u8],{type:mime||'application/octet-stream'});
  var u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(u);},1000);
}

/* ══════════════════════════════════════════════════════════════
   SPECS D'IMPORT
══════════════════════════════════════════════════════════════ */
var IMPORT_SPECS={
  candidate:{
    kind:'candidate',
    entity:'candidat', entityP:'candidats',
    title:'📥 Importer des candidats',
    sheet:'Candidats',
    fields:[
      {k:'name',lb:'Nom complet',req:true,type:'str',aliases:['nom complet','nom et prénom','nom et prenom','candidat','name','full name','nom','prénom nom','prenom nom']},
      {k:'email',lb:'Email',type:'str',aliases:['email','e-mail','mail','courriel']},
      {k:'phone',lb:'Téléphone',type:'str',aliases:['téléphone','telephone','tel','tél','phone','portable','mobile','gsm']},
      {k:'status',lb:'Statut',type:'status',aliases:['statut','status','étape','etape','stage','phase']},
      {k:'location',lb:'Localisation',type:'str',aliases:['localisation','ville','lieu','location','région','region','secteur géo']},
      {k:'nationality',lb:'Nationalité',type:'str',aliases:['nationalité','nationalite','nationality']},
      {k:'yearsExp',lb:'Années d\'expérience',type:'num',aliases:['années','annees','expérience','experience','ancienneté','anciennete','xp','years','nb années']},
      {k:'availDate',lb:'Date de disponibilité',type:'date',aliases:['disponibilité','disponibilite','disponible','availability','avail','dispo','date dispo']},
      {k:'reqSalary',lb:'Rémunération annuelle (€)',type:'num',aliases:['rémunération','remuneration','salaire','salary','prétentions','pretentions','package','tjm']},
      {k:'expertise',lb:'Expertises',type:'list',aliases:['expertise','expertises','compétence','competence','compétences','competences','skill','skills','techno','stack']},
      {k:'sectors',lb:'Secteurs',type:'list',aliases:['secteur','secteurs','sector','industrie','industry','domaine']},
      {k:'recruiter',lb:'Recruteur assigné',type:'str',aliases:['recruteur','recruiter','chargé','charge','responsable rh']}
    ],
    example:['Sophie Martin','sophie.martin@exemple.com','06 12 34 56 78','A rencontrer RH','Lyon','Française','5','2026-09-01','45000','Java; Spring','Banque, Assurance','Charles Allouard'],
    dedupInfo:'Doublon = même email (ou même nom si email absent) qu\'un candidat existant.',
    previewCols:[
      {lb:'Nom',get:function(o){return o.name||'—';}},
      {lb:'Email',get:function(o){return o.email||'';}},
      {lb:'Statut',get:function(o){return (typeof recStLbD==='function'?recStLbD(o.status):o.status)||'';}},
      {lb:'Exp.',get:function(o){return o.yearsExp?o.yearsExp+' an'+(o.yearsExp>1?'s':''):'';}},
      {lb:'Expertises',get:function(o){return (o.expertise||[]).join(', ');}}
    ],
    build:function(raw){
      var loc=raw.location||'';
      var o={id:uid(),name:raw.name||'',email:(raw.email||'').toLowerCase(),phone:raw.phone||'',
        status:_impPickStatus(raw.status,(typeof REC_STATUS!=='undefined'?REC_STATUS:[]),'rh_a'),
        locTarget:loc,locations:loc?[loc]:[],locSecondary:[],mobileFrance:false,
        nationality:raw.nationality||'',yearsExp:raw.yearsExp||0,availDate:raw.availDate||'',
        reqSalary:raw.reqSalary||0,expertise:raw.expertise||[],sectors:raw.sectors||[],
        recruiter:raw.recruiter||'',marginPct:25,createdBy:(S._userEmail||''),feedbacks:[],
        comptesRendus:[],cgiMeetings:[],experiences:[],cvProfile:{},cvFiles:[],
        buId:(typeof myBuId==='function'?myBuId():null),recruited:false};
      return o;
    },
    dedupKeys:function(){
      var email={},name={};
      (S.cands||[]).forEach(function(c){if(c.email)email[String(c.email).toLowerCase().trim()]=1;if(c.name)name[String(c.name).toLowerCase().trim()]=1;});
      return {email:email,name:name};
    },
    isDup:function(o,keys){var e=(o.email||'').toLowerCase().trim();return e?!!keys.email[e]:(!!o.name&&!!keys.name[o.name.toLowerCase().trim()]);},
    commit:function(valid){
      valid.forEach(function(o){S.cands=(S.cands||[]).concat([o]);});
      var writes=valid.map(function(o){
        try{var r=(typeof sbUpsertCand==='function')?sbUpsertCand(o):null;return Promise.resolve(r).then(function(){return true;},function(){return false;});}
        catch(e){return Promise.resolve(false);}
      });
      return Promise.all(writes).then(function(res){
        return {ok:valid.length,failed:res.filter(function(x){return x===false;}).length,extra:''};
      });
    }
  },

  opportunity:{
    kind:'opportunity',
    entity:'opportunité', entityP:'opportunités',
    title:'📥 Importer des opportunités',
    sheet:'Opportunités',
    fields:[
      {k:'name',lb:'Nom de l\'opportunité',req:true,type:'str',aliases:['nom','opportunité','opportunite','opportunity','affaire','deal','intitulé','intitule','name','libellé','libelle']},
      {k:'client',lb:'Client / Compte',type:'str',aliases:['client','compte','account','société','societe','entreprise','company','raison sociale']},
      {k:'status',lb:'Statut',type:'status',aliases:['statut','status','étape','etape','stage','phase']},
      {k:'btype',lb:'Type (AT / Forfait)',type:'btype',aliases:['type','facturation','billing','modèle','modele','mode']},
      {k:'tjm_cible',lb:'TJM cible (€)',type:'num',aliases:['tjm','taux journalier','daily rate','tarif','tj']},
      {k:'jours_estimes',lb:'Jours estimés',type:'num',aliases:['jours','days','nb jours','charge','jours estimés','jours estimes']},
      {k:'deal_amount',lb:'Montant deal (€)',type:'num',aliases:['montant','deal','forfait','budget','amount','ca','montant deal']},
      {k:'probability',lb:'Probabilité (%)',type:'num',aliases:['probabilité','probabilite','probability','proba','chance','%']},
      {k:'date_start',lb:'Date de début',type:'date',aliases:['début','debut','start','démarrage','demarrage','date début','date debut']},
      {k:'date_end',lb:'Date de fin',type:'date',aliases:['fin','end','date fin','échéance','echeance']},
      {k:'duree_mois',lb:'Durée (mois)',type:'num',aliases:['durée','duree','mois','months','duration','durée mois']},
      {k:'date_closing',lb:'Date de closing',type:'date',aliases:['closing','signature','clôture','cloture','décision','decision','date closing']},
      {k:'req_expertise',lb:'Expertises requises',type:'list',aliases:['expertise','expertises','compétence','competence','compétences','competences','skill','skills','techno','stack']},
      {k:'location',lb:'Localisation',type:'str',aliases:['localisation','ville','lieu','location','région','region']},
      {k:'req_sector',lb:'Secteur',type:'str',aliases:['secteur','sector','industrie','industry','domaine']},
      {k:'notes',lb:'Notes',type:'str',aliases:['notes','note','commentaire','comment','description','remarque']}
    ],
    example:['Refonte SI RH','ACME Corp','Qualification','at','650','120','','40','2026-09-01','2027-03-31','6','2026-08-15','Java, Angular','Paris','Banque','Prospect chaud rencontré au salon'],
    dedupInfo:'Doublon = même nom d\'opportunité pour le même client qu\'une opportunité existante. Les comptes clients absents sont créés automatiquement.',
    previewCols:[
      {lb:'Opportunité',get:function(o){return o.name||'—';}},
      {lb:'Client',get:function(o){return o._client||'';}},
      {lb:'Statut',get:function(o){return (typeof oppStLb==='function'?oppStLb(o.status):o.status)||'';}},
      {lb:'Type',get:function(o){return o.btype==='forfait'?'Forfait':'AT';}},
      {lb:'TJM/Deal',get:function(o){return o.btype==='forfait'?((o.deal_amount||0)+' €'):((o.tjm_cible||0)+' €');}},
      {lb:'Proba',get:function(o){return (o.probability||0)+'%';}}
    ],
    build:function(raw){
      var o={id:uid2(),name:raw.name||'',_client:(raw.client||'').trim(),
        status:_impPickStatus(raw.status,(typeof OPP_STATUS!=='undefined'?OPP_STATUS:[]),'identification'),
        btype:_impBtype(raw.btype),tjm_cible:raw.tjm_cible||0,jours_estimes:raw.jours_estimes||0,
        deal_amount:raw.deal_amount||0,probability:raw.probability||20,
        date_start:raw.date_start||null,date_end:raw.date_end||null,duree_mois:raw.duree_mois||0,
        date_closing:raw.date_closing||null,req_expertise:raw.req_expertise||[],
        location:raw.location||null,req_sector:raw.req_sector||null,notes:raw.notes||null,
        consultant_ids:[],opp_team:null,
        owner_email:(S._userEmail||''),owner_name:(S.profileFirstName||''),owner_role:S.role,
        owner_dir:(S.dirName||''),owner_vp:(S.vpName||''),
        bu_id:(typeof myBuId==='function'?myBuId():null)};
      return o;
    },
    dedupKeys:function(){
      var sig={};
      (S.bizOpps||[]).forEach(function(o){var cn=(typeof accName==='function'?accName(o.account_id):'')||'';sig[String(o.name||'').toLowerCase().trim()+'|'+cn.toLowerCase().trim()]=1;});
      return {sig:sig};
    },
    isDup:function(o,keys){return !!keys.sig[String(o.name||'').toLowerCase().trim()+'|'+String(o._client||'').toLowerCase().trim()];},
    commit:function(valid){
      /* Résolution des comptes clients : réutilise l'existant (insensible à la
         casse), crée les manquants une seule fois. */
      var map={};(S.bizAccounts||[]).forEach(function(a){if(a.name)map[a.name.toLowerCase().trim()]=a.id;});
      var newAcc=[];
      valid.forEach(function(o){var n=(o._client||'').trim();if(n&&!map[n.toLowerCase()]){var a={id:uid2(),name:n,status:'prospect'};map[n.toLowerCase()]=a.id;S.bizAccounts=(S.bizAccounts||[]).concat([a]);newAcc.push(a);}});
      var accWrites=newAcc.map(function(a){try{return Promise.resolve((typeof sbUpsertAcc==='function')?sbUpsertAcc(a):null);}catch(e){return Promise.resolve();}});
      return Promise.all(accWrites).then(function(){
        valid.forEach(function(o){o.account_id=o._client?(map[o._client.toLowerCase().trim()]||null):null;delete o._client;S.bizOpps=(S.bizOpps||[]).concat([o]);});
        var writes=valid.map(function(o){try{return Promise.resolve((typeof sbUpsertCrmOpp==='function')?sbUpsertCrmOpp(o):null).then(function(){return true;},function(){return false;});}catch(e){return Promise.resolve(false);}});
        return Promise.all(writes);
      }).then(function(res){
        return {ok:valid.length,failed:(res||[]).filter(function(x){return x===false;}).length,extra:newAcc.length?(newAcc.length+' compte(s) client créé(s)'):''};
      });
    }
  }
};

function _impSpec(){var k=(S.imp2&&S.imp2.kind)||'candidate';return IMPORT_SPECS[k]||IMPORT_SPECS.candidate;}

/* ── Ouverture / téléchargement du modèle ── */
function openImport2(kind){
  var spec=IMPORT_SPECS[kind];if(!spec){toast('Type d\'import inconnu.','error');return;}
  if(kind==='opportunity'&&S.role==='utilisateur'){toast('L\'import d\'opportunités nécessite un rôle Business Manager ou gestionnaire.','error');return;}
  S.imp2={kind:kind,file:'',headers:[],raw:[],map:{},rows:[],step:'upload',results:null};
  S.modal={type:'import2'};render();
}
function downloadImport2Template(){
  var spec=_impSpec();
  var headers=spec.fields.map(function(f){return f.lb+(f.req?' *':'');});
  try{
    var u8=_impXlsxTemplate(spec.sheet,headers,spec.example);
    _impDL(u8,'modele_import_'+spec.entityP+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }catch(e){
    /* Repli CSV si la génération xlsx échoue */
    var csv=headers.join(';')+'\n'+(spec.example||[]).join(';')+'\n';
    _impDL(_u8('﻿'+csv),'modele_import_'+spec.entityP+'.csv','text/csv;charset=utf-8');
  }
}

/* ── Lecture du fichier ── */
function handleImport2File(file){
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
        var spec=_impSpec();
        S.imp2=Object.assign({},S.imp2,{file:file.name,headers:headers,raw:data.slice(1),map:_impAutoMap(headers,spec.fields),rows:[],step:'map',results:null});
        if(!S.modal||S.modal.type!=='import2')S.modal={type:'import2'};
        render();
      }catch(err){alert('Erreur de lecture : '+err.message);}
    };
    r.readAsArrayBuffer(file);
  });
}

/* ── Mapping → aperçu ── */
function applyImport2Map(){
  var im=S.imp2;if(!im)return;
  var spec=_impSpec();
  var cm={};
  spec.fields.forEach(function(f){
    var el=document.getElementById('im2-'+f.k);
    if(el){if(el.value!=='')cm[f.k]=parseInt(el.value,10);}
    else if(im.map&&im.map[f.k]!==undefined)cm[f.k]=im.map[f.k]; /* hors DOM (tests) : repli sur le mapping courant */
  });
  var reqMissing=spec.fields.filter(function(f){return f.req&&cm[f.k]===undefined;});
  if(reqMissing.length){alert('Colonne obligatoire non associée : '+reqMissing.map(function(f){return f.lb;}).join(', '));return;}
  function conv(f,v){
    if(f.type==='num')return _impNum(v);
    if(f.type==='list')return _impList(v);
    if(f.type==='date')return _impDate(v);
    return _impStr(v);
  }
  var keys=spec.dedupKeys();
  var rows=im.raw.map(function(row){
    var raw={};
    spec.fields.forEach(function(f){raw[f.k]=cm[f.k]!==undefined?conv(f,row[cm[f.k]]):(f.type==='list'?[]:(f.type==='num'?0:''));});
    var o=spec.build(raw);
    o._invalid=!o.name;
    o._dup=!o._invalid&&spec.isDup(o,keys);
    return o;
  }).filter(function(o){return o.name||o._client||o.email;});
  im.map=cm;im.rows=rows;im.step='preview';render();
}

/* ── Écriture ── */
function commitImport2(){
  var im=S.imp2;if(!im||!im.rows)return;
  var spec=_impSpec();
  var valid=im.rows.filter(function(o){return !o._invalid&&!o._dup;});
  if(!valid.length){alert('Aucune ligne à importer.');return;}
  im.step='importing';render();
  Promise.resolve(spec.commit(valid)).then(function(res){
    im.results={ok:(res&&res.ok)||valid.length,failed:(res&&res.failed)||0,extra:(res&&res.extra)||'',
      dup:im.rows.filter(function(o){return o._dup;}).length,invalid:im.rows.filter(function(o){return o._invalid;}).length};
    im.step='result';render();
  },function(e){
    im.results={err:(e&&e.message)||String(e)};im.step='result';render();
  });
}
function import2Back(){if(S.imp2){S.imp2.step='map';render();}}
function import2Cancel(){S.imp2=null;S.modal=null;render();}

/* ══════════════════════════════════════════════════════════════
   RENDU DU MODAL
══════════════════════════════════════════════════════════════ */
function tImport2Body(){
  var im=S.imp2||{step:'upload'};var st=im.step||'upload';var spec=_impSpec();
  if(st==='upload'){
    return '<div style="font-size:13px;color:#475569;margin-bottom:14px">Importez vos '+spec.entityP+' depuis un fichier Excel (.xlsx) ou CSV — depuis notre modèle ou votre propre export. Les colonnes sont reconnues automatiquement, vous pourrez ajuster.</div>'
      +'<label style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer">📥 Choisir un fichier'
      +'<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleImport2File(this.files[0]);this.value=\'\'"></label>'
      +'<div style="margin-top:14px"><button class="bg" data-act="import2-tpl" style="font-size:12px">⬇ Télécharger le modèle Excel</button></div>'
      +'<div style="margin-top:16px;padding:10px 14px;background:#f8fafc;border-radius:8px;font-size:11px;color:#64748b">Colonnes reconnues : '+spec.fields.map(function(f){return esc(f.lb);}).join(' · ')+'. Seul le champ <strong>'+esc((spec.fields.find(function(f){return f.req;})||{}).lb||'nom')+'</strong> est obligatoire.<br>'+esc(spec.dedupInfo)+'</div>'
      +'<div class="br"><button class="bg" data-act="import2-cancel">Fermer</button></div>';
  }
  if(st==='map'){
    var opts=function(sel){return '<option value="">— Ignorer —</option>'+im.headers.map(function(h,i){return '<option value="'+i+'"'+(sel===i?' selected':'')+'>'+esc(h||('Colonne '+(i+1)))+'</option>';}).join('');};
    var flds=spec.fields.map(function(f){
      return '<div class="fd"><label class="fl">'+esc(f.lb)+(f.req?' *':'')+'</label>'
        +'<select class="ic" id="im2-'+f.k+'">'+opts(im.map[f.k])+'</select></div>';
    }).join('');
    return '<div style="font-size:13px;color:#475569;margin-bottom:4px">Fichier : <strong>'+esc(im.file)+'</strong> · '+im.raw.length+' ligne'+(im.raw.length>1?'s':'')+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-bottom:14px">Associez chaque champ à une colonne de votre fichier (pré-rempli automatiquement).</div>'
      +'<div class="g2">'+flds+'</div>'
      +'<div class="br"><button class="bg" data-act="import2-cancel">Annuler</button><button class="bp" data-act="import2-map">Prévisualiser →</button></div>';
  }
  if(st==='preview'){
    var valid=im.rows.filter(function(o){return !o._invalid&&!o._dup;});
    var dup=im.rows.filter(function(o){return o._dup;});
    var inval=im.rows.filter(function(o){return o._invalid;});
    var cols=spec.previewCols;
    var th='<th style="padding:6px 8px;text-align:left">Import</th>'+cols.map(function(c){return '<th style="padding:6px 8px;text-align:left">'+esc(c.lb)+'</th>';}).join('');
    var tr=im.rows.slice(0,200).map(function(o){
      var tag=o._invalid?'<span style="color:#b91c1c">✕ sans nom</span>':o._dup?'<span style="color:#b45309">↔ doublon</span>':'<span style="color:#15803d">✓ nouveau</span>';
      var bg=o._invalid?'#fff1f2':o._dup?'#fffbeb':'#f0fdf4';
      return '<tr style="background:'+bg+'"><td style="padding:4px 8px;white-space:nowrap">'+tag+'</td>'+cols.map(function(c){return '<td style="padding:4px 8px">'+esc(c.get(o)||'')+'</td>';}).join('')+'</tr>';
    }).join('');
    return '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
      +'<span style="background:#f0fdf4;color:#15803d;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700">✓ '+valid.length+' à importer</span>'
      +'<span style="background:#fffbeb;color:#b45309;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700">↔ '+dup.length+' doublon(s)</span>'
      +'<span style="background:#fff1f2;color:#b91c1c;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:700">✕ '+inval.length+' invalide(s)</span></div>'
      +'<div style="max-height:340px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="position:sticky;top:0;background:#f8fafc">'+th+'</tr></thead><tbody>'+tr+'</tbody></table></div>'
      +(im.rows.length>200?'<div style="font-size:11px;color:#94a3b8;margin-top:6px">Aperçu limité à 200 lignes — toutes les valides seront importées.</div>':'')
      +'<div class="br"><button class="bg" data-act="import2-back">← Mapping</button><button class="bp" data-act="import2-commit"'+(valid.length?'':' disabled style="opacity:.5;cursor:not-allowed"')+'>Importer '+valid.length+' '+esc(spec.entity)+(valid.length>1?'s':'')+'</button></div>';
  }
  if(st==='importing'){
    return '<div style="text-align:center;padding:30px 0"><div style="font-size:40px">⏳</div><div style="margin-top:10px;font-size:14px;color:#0f172a;font-weight:700">Import en cours…</div></div>';
  }
  if(st==='result'){
    var rz=im.results||{};
    if(rz.err)return '<div style="padding:16px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;color:#b91c1c;font-size:13px">✕ Erreur : '+esc(rz.err)+'</div><div class="br"><button class="bg" data-act="import2-back">← Retour</button><button class="bg" data-act="import2-cancel">Fermer</button></div>';
    return '<div style="text-align:center;padding:16px 0"><div style="font-size:44px">✅</div>'
      +'<div style="margin-top:8px;font-size:16px;font-weight:800;color:#0f172a">'+(rz.ok||0)+' '+esc(spec.entity)+((rz.ok||0)>1?'s':'')+' importé'+((rz.ok||0)>1?'s':'')+'</div>'
      +'<div style="font-size:12px;color:#64748b;margin-top:6px">'+(rz.dup||0)+' doublon(s) ignoré(s) · '+(rz.invalid||0)+' invalide(s)'+(rz.failed?' · '+rz.failed+' en erreur':'')+'</div>'
      +(rz.extra?'<div style="font-size:12px;color:#0369a1;margin-top:4px">'+esc(rz.extra)+'</div>':'')
      +'</div><div class="br"><button class="bp" data-act="import2-cancel">Terminer</button></div>';
  }
  return '';
}
