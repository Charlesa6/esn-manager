/* ═══════════════════════════════════════════════════════════════════════════
   ASSISTANT IA — « Crée-moi une mission pour X du … au … à … € »
   Panneau de discussion flottant. La compréhension se fait côté serveur
   (Edge Function `assistant`, Claude) qui renvoie des ACTIONS PROPOSÉES ; rien
   n'est écrit tant que l'utilisateur n'a pas cliqué « Créer » sur la carte.
   L'application passe par les mêmes règles que les formulaires : droits par
   rôle, validation N+1 (submitApproval), soldes de congés, verrou Time Sheet.
   Le panneau vit hors de #mc (non reconstruit par render()) et utilise ses
   propres attributs data-ai (pas le dispatcher data-act global).
   ═══════════════════════════════════════════════════════════════════════════ */
var AI_FN='https://rwmstlesxnglpblrurqj.supabase.co/functions/v1/assistant';
var AI_MISSION_ROLES=['super_admin','admin','gestionnaire','utilisateur'];

function aiState(){
  if(!S.ai)S.ai={open:false,busy:false,msgs:[]};
  return S.ai;
}
/* Disponible pour un utilisateur connecté à une entreprise (pas en démo). */
function aiAvailable(){return !!(sb&&SB_CID&&!S.demo);}

/* Consultants que l'assistant peut cibler : ceux que l'utilisateur voit déjà. */
function aiConsList(){
  var base=(S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales')?personalCons():visibleData().cons;
  return (base||[]).filter(function(c){return c&&c.id;});
}
function aiContext(){
  var cons=aiConsList(),me=S.consId?(S._all&&S._all.cons||S.cons).find(function(c){return c.id===S.consId;}):null;
  var cl={};
  (visibleData().miss||[]).forEach(function(m){if(m.cli)cl[m.cli]=1;});
  (S.bizAccounts||[]).forEach(function(a){if(a&&a.name)cl[a.name]=1;});
  return {
    today:TODAY,role:S.role,
    me:me?{id:me.id,name:me.name}:null,
    consultants:cons.slice(0,800).map(function(c){return {id:String(c.id),name:c.name||'',title:c.title||''};}),
    clients:Object.keys(cl).slice(0,400)
  };
}

/* ── Montage du bouton + panneau (appelé à la fin de render()) ── */
function aiMount(){
  var btn=document.getElementById('ai-fab');
  if(!aiAvailable()){if(btn)btn.style.display='none';var p0=document.getElementById('ai-panel');if(p0)p0.style.display='none';return;}
  if(!btn){
    btn=document.createElement('button');btn.id='ai-fab';btn.type='button';
    btn.setAttribute('aria-label','Ouvrir l’assistant Konsilys');btn.setAttribute('data-ai','toggle');
    btn.innerHTML='<span aria-hidden="true">✨</span><span class="ai-fab-t">Assistant</span>';
    document.body.appendChild(btn);
    var panel=document.createElement('div');panel.id='ai-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Assistant Konsilys');
    document.body.appendChild(panel);
    document.addEventListener('click',aiOnClick);
    document.addEventListener('keydown',function(e){
      if(e.target&&e.target.id==='ai-in'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiSend();}
      else if(e.key==='Escape'&&aiState().open){aiState().open=false;aiRender();}
    });
  }
  else{btn.style.display='';return;} /* déjà monté : on ne re-rend pas le panneau (évite de voler le focus) */
  btn.style.display='';
  aiRender();
}

function aiRender(){
  var st=aiState(),panel=document.getElementById('ai-panel'),btn=document.getElementById('ai-fab');
  if(!panel)return;
  if(btn)btn.classList.toggle('on',st.open);
  panel.style.display=st.open?'flex':'none';
  if(!st.open)return;
  var keep=document.getElementById('ai-in'),draft=keep?keep.value:'';
  var intro='<div class="ai-msg a"><div class="ai-b">Bonjour ! Dites-moi ce que vous voulez créer, par exemple :'
    +'<button class="ai-ex" data-ai="ex">Crée une mission pour '+esc((aiConsList()[0]||{}).name||'Julie Martin')+' chez BNP Paribas du 3 au 28 novembre à 650 €</button>'
    +'<button class="ai-ex" data-ai="ex">Pose-moi un congé payé du 22 au 26 décembre</button></div></div>';
  var body=st.msgs.map(function(m,i){
    var h='<div class="ai-msg '+(m.role==='user'?'u':'a')+'">';
    if(m.text)h+='<div class="ai-b'+(m.err?' err':'')+'">'+esc(m.text).replace(/\n/g,'<br>')+'</div>';
    (m.actions||[]).forEach(function(ac,j){h+=aiCard(ac,i,j);});
    return h+'</div>';
  }).join('');
  panel.innerHTML='<div class="ai-hd"><b>✨ Assistant Konsilys</b><span class="ai-beta">Bêta</span>'
    +'<button class="ai-x" data-ai="close" aria-label="Fermer">✕</button></div>'
    +'<div class="ai-body" id="ai-body">'+intro+body
    +(st.busy?'<div class="ai-msg a"><div class="ai-b ai-typing"><i></i><i></i><i></i></div></div>':'')+'</div>'
    +'<div class="ai-ft"><textarea id="ai-in" rows="1" placeholder="Ex. : crée une mission pour…" aria-label="Votre demande"'+(st.busy?' disabled':'')+'></textarea>'
    +'<button class="ai-send" data-ai="send" aria-label="Envoyer"'+(st.busy?' disabled':'')+'>➤</button></div>'
    +'<div class="ai-note">Rien n’est créé sans votre confirmation.</div>';
  var inp=document.getElementById('ai-in');if(inp){inp.value=draft;if(!st.busy)inp.focus();}
  var b=document.getElementById('ai-body');if(b)b.scrollTop=b.scrollHeight;
}

/* Carte récapitulative d'une action proposée. */
function aiCard(ac,i,j){
  var x=ac.input||{},rows=[],title='';
  var cname=function(id){var c=aiConsList().find(function(k){return String(k.id)===String(id);});return c?c.name:'⚠ consultant inconnu';};
  if(ac.tool==='create_mission'){
    title='💼 Nouvelle mission';
    rows.push(['Consultant'+((x.consultant_ids||[]).length>1?'s':''),(x.consultant_ids||[]).map(cname).join(', ')]);
    rows.push(['Mission',x.name]);rows.push(['Client',x.client]);
    rows.push(['Période',fDt(x.start_date)+' → '+(x.end_date?fDt(x.end_date):'sans date de fin')]);
    if(x.billing_type==='forfait')rows.push(['Forfait',(x.deal_amount!=null?Number(x.deal_amount).toLocaleString('fr-FR')+' € HT':'—')+(x.target_margin!=null?' · marge '+x.target_margin+' %':'')]);
    else rows.push(['TJM',x.tjm!=null?Number(x.tjm).toLocaleString('fr-FR')+' € HT / jour':'—']);
  }else if(ac.tool==='create_leave'){
    title='🌴 Nouvelle absence';
    rows.push(['Consultant',cname(x.consultant_id)]);rows.push(['Type',x.type]);
    rows.push(['Période',fDt(x.start_date)+' → '+fDt(x.end_date)]);
  }
  var st=ac.status;
  var foot=st==='done'?'<div class="ai-st ok">✓ '+esc(ac.result||'Créé')+'</div>'
    :st==='cancel'?'<div class="ai-st">Annulé</div>'
    :st==='error'?'<div class="ai-st err">⚠ '+esc(ac.result||'Erreur')+'</div>'
      +'<div class="ai-act"><button class="ai-ok" data-ai="apply" data-i="'+i+'" data-j="'+j+'">Réessayer</button></div>'
    :'<div class="ai-act"><button class="ai-ok" data-ai="apply" data-i="'+i+'" data-j="'+j+'">Créer</button><button class="ai-no" data-ai="cancel" data-i="'+i+'" data-j="'+j+'">Annuler</button></div>';
  return '<div class="ai-card"><div class="ai-ct">'+title+'</div>'
    +rows.map(function(r){return '<div class="ai-row"><span>'+esc(r[0])+'</span><b>'+esc(r[1]==null?'—':r[1])+'</b></div>';}).join('')
    +foot+'</div>';
}

function aiOnClick(e){
  var t=e.target.closest&&e.target.closest('[data-ai]');if(!t)return;
  var a=t.getAttribute('data-ai'),st=aiState();
  if(a==='toggle'){st.open=!st.open;aiRender();}
  else if(a==='close'){st.open=false;aiRender();}
  else if(a==='send'){aiSend();}
  else if(a==='ex'){var inp=document.getElementById('ai-in');if(inp){inp.value=t.textContent;aiSend();}}
  else if(a==='apply'||a==='cancel'){
    var m=st.msgs[+t.getAttribute('data-i')],ac=m&&m.actions&&m.actions[+t.getAttribute('data-j')];
    if(!ac||ac.status==='done'||ac.status==='cancel')return;
    if(a==='cancel'){ac.status='cancel';aiRender();return;}
    var r=aiApply(ac);
    ac.status=r.ok?'done':'error';ac.result=r.msg;
    aiRender();
    if(r.ok)render();
  }
}

/* Historique texte envoyé au serveur (les propositions y figurent avec leur statut). */
function aiHistory(){
  return aiState().msgs.filter(function(m){return !m.err;}).map(function(m){
    var txt=m.text||'';
    (m.actions||[]).forEach(function(ac){
      var s=ac.status==='done'?'créée':ac.status==='cancel'?'annulée par l’utilisateur':ac.status==='error'?'échec : '+(ac.result||''):'en attente de confirmation';
      txt+='\n[Proposition '+ac.tool+' '+JSON.stringify(ac.input)+' — '+s+']';
    });
    return {role:m.role==='user'?'user':'assistant',content:txt.trim()||'(proposition)'};
  });
}

async function aiSend(){
  var st=aiState(),inp=document.getElementById('ai-in');
  var q=inp?(inp.value||'').trim():'';
  if(!q||st.busy)return;
  if(inp)inp.value='';
  st.msgs.push({role:'user',text:q.slice(0,2000)});
  st.busy=true;aiRender();
  try{
    var ses=await sb.auth.getSession();
    var tok=ses&&ses.data&&ses.data.session&&ses.data.session.access_token;
    var r=await fetch(AI_FN,{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({messages:aiHistory(),context:aiContext()})});
    var d=await r.json().catch(function(){return {};});
    if(!r.ok||d.error)st.msgs.push({role:'assistant',err:true,text:d.error||'L’assistant est indisponible — réessayez.'});
    else st.msgs.push({role:'assistant',text:d.reply||'',actions:(d.actions||[]).map(function(x){return {tool:x.tool,input:x.input,status:'pending'};})});
  }catch(err){st.msgs.push({role:'assistant',err:true,text:'Erreur réseau — réessayez.'});}
  st.busy=false;aiRender();
}

/* ── Application d'une action (mêmes règles que les formulaires) ── */
function aiIsDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(new Date(s+'T00:00:00'));}
function aiApply(ac){
  try{
    if(ac.tool==='create_mission')return aiApplyMission(ac.input||{});
    if(ac.tool==='create_leave')return aiApplyLeave(ac.input||{});
    return {ok:false,msg:'Action non prise en charge.'};
  }catch(e){console.warn('assistant apply:',e);return {ok:false,msg:'Erreur inattendue.'};}
}

function aiApplyMission(x){
  if(AI_MISSION_ROLES.indexOf(S.role)<0)return {ok:false,msg:'Votre rôle ne permet pas de créer des missions.'};
  var allowed={};aiConsList().forEach(function(c){allowed[String(c.id)]=c;});
  var cids=(x.consultant_ids||[]).map(String).filter(function(id,k,arr){return arr.indexOf(id)===k;});
  if(!cids.length)return {ok:false,msg:'Aucun consultant indiqué.'};
  if(cids.some(function(id){return !allowed[id];}))return {ok:false,msg:'Consultant introuvable ou hors de votre périmètre.'};
  var name=String(x.name||'').trim(),cli=String(x.client||'').trim();
  if(!name||!cli)return {ok:false,msg:'Intitulé et client requis.'};
  if(!aiIsDate(x.start_date))return {ok:false,msg:'Date de début invalide.'};
  var ed=x.end_date?String(x.end_date):null;
  if(ed&&(!aiIsDate(ed)||ed<x.start_date))return {ok:false,msg:'Date de fin invalide.'};
  var bt=x.billing_type==='forfait'?'forfait':'at';
  var tjm=Number(x.tjm)||0,deal=Number(x.deal_amount)||0,tmar=(x.target_margin==null||x.target_margin==='')?null:Number(x.target_margin);
  if(S.role==='utilisateur'){
    if(cids.length!==1||cids[0]!==String(S.consId))return {ok:false,msg:'Vous pouvez proposer une mission uniquement pour vous-même.'};
  }else if(bt==='forfait'){
    if(!deal||tmar==null||isNaN(tmar))return {ok:false,msg:'Forfait : montant et marge cible requis.'};
  }else if(!(tjm>0))return {ok:false,msg:'TJM requis pour une mission en assistance technique.'};
  var targets=bt==='forfait'?[cids[0]]:cids;
  if(targets.some(function(c){return tsRangeLocked(c,x.start_date,ed);}))return {ok:false,msg:'Période verrouillée par un Time Sheet approuvé.'};
  var d={name:name,cli:cli,tjm:bt==='forfait'?0:tjm,sd:x.start_date,ed:ed,loc:'',mgr:'',ccn:'',ccr:'',btype:bt,wdays:[1,2,3,4,5],
    deal:bt==='forfait'?deal:0,tmar:bt==='forfait'?tmar:null,pcode:'',wmode:'rec',manualDays:[]};
  if(S.role==='utilisateur'){
    var desc='Ajout de mission — '+esc(cli)+' · '+esc(name)+' début '+fDt(d.sd)+(ed?' fin '+fDt(ed):'');
    submitApproval('miss_add',Object.assign({id:uid(),approver_id:resolveApprover(S._userId)},d,{cid:allowed[cids[0]].id}),desc);
    return {ok:true,msg:'Demande envoyée à votre N+1 pour validation'};
  }
  targets.forEach(function(c){
    var nm=Object.assign({id:uid()},d,{cid:allowed[c].id});
    S.miss=S.miss.concat([nm]);
    sbUpsertMiss(nm).catch(function(e){console.warn('assistant mission:',e);});
  });
  return {ok:true,msg:targets.length>1?targets.length+' missions créées':'Mission créée'};
}

function aiApplyLeave(x){
  var allowed={};aiConsList().forEach(function(c){allowed[String(c.id)]=c;});
  var cid=String(x.consultant_id||'');
  if(!allowed[cid])return {ok:false,msg:'Consultant introuvable ou hors de votre périmètre.'};
  if(LTYPES.indexOf(x.type)<0)return {ok:false,msg:'Type d’absence inconnu.'};
  if(!aiIsDate(x.start_date)||!aiIsDate(x.end_date)||x.end_date<x.start_date)return {ok:false,msg:'Dates invalides.'};
  /* Un consultant / recruteur / BM ne pose des absences que pour lui-même. */
  if((S.role==='utilisateur'||S.role==='recruteur'||S.role==='sales')&&cid!==String(S.consId))return {ok:false,msg:'Vous pouvez poser une absence uniquement pour vous-même.'};
  if(tsRangeLocked(cid,x.start_date,x.end_date))return {ok:false,msg:'Période verrouillée par un Time Sheet approuvé.'};
  var bal=checkLeaveBalance(cid,x.type,x.start_date,x.end_date,null);
  if(bal.capped&&!bal.ok)return {ok:false,msg:'Solde insuffisant ('+bal.label+' : '+fmtJ(bal.remaining)+' restants, '+fmtJ(bal.need)+' demandés).'};
  var approverId=resolveApprover(S._userId),isSelf=!!(S.consId&&cid===String(S.consId));
  var nl={id:uid(),cid:allowed[cid].id,type:x.type,s:x.start_date,e:x.end_date};
  if(!approverId||!isSelf){
    S.lvs=S.lvs.concat([nl]);
    sbUpsertLeave(nl);
    return {ok:true,msg:'Absence enregistrée'};
  }
  submitApproval('leave_add',Object.assign({},nl,{approver_id:approverId}),'Ajout d’absence — '+esc(x.type)+' du '+fDt(x.start_date)+' au '+fDt(x.end_date));
  return {ok:true,msg:'Demande envoyée à votre N+1 pour validation'};
}
