/* Konsilys — tunnel d'inscription partagé (pages /essai-gratuit et /tarifs).
   ⚠ Les price IDs Stripe ci-dessous doivent rester cohérents avec
   supabase/functions/seats-checkout (ALLOWED / OWNER_PRICES) et
   supabase/functions/stripe-webhook (PRICE_MAP). Annuel = 10× le mensuel.

   Parcours : création du compte admin (Supabase signUp, entreprise inactive)
   → seats-checkout (trial:true → 14 jours offerts, sans carte bancaire)
   → Stripe Checkout → webhook (active l'entreprise, provisionne les sièges)
   → /login?checkout=success&trial=1. */
var KS_SUPA_URL='https://rwmstlesxnglpblrurqj.supabase.co';
var KS_SUPA_FN=KS_SUPA_URL+'/functions/v1';
var KS_SUPA_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3bXN0bGVzeG5nbHBibHJ1cnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjcyNTMsImV4cCI6MjA5NzEwMzI1M30.9SrsA1sYjdsqdPCnZ_sc2iTl01NKXsl7gAu2Y_VYgSQ';
var KS_TRIAL_DAYS=14;
var PLANS=[
  {key:'utilisateur',name:'Consultant',price:8,m:'price_1TqUYFA6guMn7iZUAYWbMGfR',a:'price_1TqUYGA6guMn7iZUzeoBFm9V'},
  {key:'sales',name:'Business Manager',price:22,m:'price_1TqUYKA6guMn7iZUBf840s9D',a:'price_1TqUYLA6guMn7iZUKzu8PByk'},
  {key:'recruteur',name:'Recruteur',price:22,m:'price_1TqUYHA6guMn7iZUhwKFDqQQ',a:'price_1TqUYJA6guMn7iZUIzsPv23E'},
  {key:'gestionnaire',name:'Directeur',price:29,m:'price_1TqUYNA6guMn7iZUW0TAySfr',a:'price_1TqUYPA6guMn7iZUGUuT6aaP'},
  {key:'admin',name:'Admin',price:39,m:'price_1TqUYQA6guMn7iZUdOwh2sri',a:'price_1TqUYRA6guMn7iZU0VqsQlIt'},
  {key:'super_admin',name:'Super Admin',price:49,m:'price_1TqUYTA6guMn7iZUVdiYjBhI',a:'price_1TqUYUA6guMn7iZUtB7aYGuq'}
];
var MODULES=[
  {key:'business',name:'Business Développement (CRM)',price:59,m:'price_1TqUYVA6guMn7iZUr72z01vh',a:'price_1TqUYXA6guMn7iZUllYZc79I'},
  {key:'recrutement',name:'Recrutement',price:59,m:'price_1TqUYYA6guMn7iZUkwyVkWpb',a:'price_1TqUYZA6guMn7iZUwngF93eZ'}
];
var OWNER_ROLES=[
  {key:'admin',name:'Admin',desc:'Gestion multi-équipes, KPIs agrégés, missions & tableau de bord complets.'},
  {key:'super_admin',name:'Super Admin',desc:'Tout Admin + pilotage global sur 3 niveaux et paramétrage complet.'}
];
var ksSb=(window.supabase&&window.supabase.createClient)?window.supabase.createClient(KS_SUPA_URL,KS_SUPA_ANON):null;

function ksPlan(r){for(var i=0;i<PLANS.length;i++)if(PLANS[i].key===r)return PLANS[i];return null;}
function ksUnit(p,billing){return billing==='annual'?p.price*10:p.price;}
function ksPrice(p,billing){return billing==='annual'?p.a:p.m;}
function ksFmt(n){return Number(n).toLocaleString('fr-FR');}
function ksEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function ksIsEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);}
function ksUuid(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:r&0x3|0x8).toString(16);});}

/* Lignes Stripe à partir d'une configuration. */
function ksItems(cfg){
  var items=[{price_id:ksPrice(ksPlan(cfg.ownerRole),cfg.billing),quantity:1}],counts={};
  (cfg.members||[]).forEach(function(m){counts[m.role]=(counts[m.role]||0)+1;});
  Object.keys(counts).forEach(function(r){var p=ksPlan(r);if(p)items.push({price_id:ksPrice(p,cfg.billing),quantity:counts[r]});});
  MODULES.forEach(function(m){if(cfg.mod&&cfg.mod[m.key])items.push({price_id:ksPrice(m,cfg.billing),quantity:1});});
  return items;
}
function ksTotal(cfg){
  var t=ksUnit(ksPlan(cfg.ownerRole),cfg.billing);
  (cfg.members||[]).forEach(function(m){var p=ksPlan(m.role);if(p)t+=ksUnit(p,cfg.billing);});
  MODULES.forEach(function(m){if(cfg.mod&&cfg.mod[m.key])t+=ksUnit(m,cfg.billing);});
  return t;
}

/* Démarre l'essai : cfg = {company, fn, ln, email, pw, ownerRole, billing, members[], mod{}}.
   ui = {onError(msg), onStep(label)}. Valide, crée le compte, ouvre Stripe Checkout. */
function ksStartTrial(cfg,ui){
  function err(t){ui.onError(t);}
  var co=(cfg.company||'').trim(),fn=(cfg.fn||'').trim(),ln=(cfg.ln||'').trim(),em=(cfg.email||'').trim().toLowerCase(),pw=cfg.pw||'';
  if(!co)return err('Indiquez le nom de votre entreprise.');
  if(!fn||!ln)return err('Indiquez votre prénom et votre nom.');
  if(!ksIsEmail(em))return err('Indiquez un email professionnel valide.');
  if(pw.length<8)return err('Mot de passe : 8 caractères minimum.');
  var seats=[];
  for(var i=0;i<(cfg.members||[]).length;i++){var m=cfg.members[i];
    if(!(m.fn||'').trim()||!(m.ln||'').trim()||!ksIsEmail((m.em||'').trim()))return err('Membre '+(i+1)+' : prénom, nom et email valides requis.');
    seats.push({first_name:m.fn.trim(),last_name:m.ln.trim(),email:m.em.trim().toLowerCase(),role:m.role});
  }
  if(!ksSb)return err('Service momentanément indisponible, réessayez dans un instant.');
  var items=ksItems(cfg);
  ui.onStep('Création de votre espace…');
  return ksSb.auth.signUp({email:em,password:pw,options:{data:{company_name:co,first_name:fn,last_name:ln,role:cfg.ownerRole,company_id:ksUuid()}}})
    .then(function(res){
      if(res.error){var e=(res.error.message||'').toLowerCase();
        if(e.indexOf('already')>=0||e.indexOf('registered')>=0)err('Cet email a déjà un compte. Connectez-vous : vous pourrez finaliser votre essai depuis votre espace.');
        else err(res.error.message||'Erreur lors de la création du compte.');
        return null;}
      var token=res.data&&res.data.session&&res.data.session.access_token;
      if(!token){err('Vérifiez votre boîte mail pour confirmer votre compte, puis connectez-vous pour démarrer votre essai.');return null;}
      ui.onStep('Activation de votre essai gratuit…');
      return fetch(KS_SUPA_FN+'/seats-checkout',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+token},
        body:JSON.stringify({items:items,seats:seats,trial:true,success_url:location.origin+'/login?checkout=success&trial=1',cancel_url:location.origin+'/essai-gratuit'})})
        .then(function(r){return r.json();});
    })
    .then(function(d){if(!d)return;if(d.url){location.href=d.url;return;}err((d&&d.error)||'Erreur — réessayez ou contactez-nous.');})
    .catch(function(){err('Erreur réseau — réessayez.');});
}
