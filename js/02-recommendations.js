'use strict';
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   RECOMMENDATIONS ENGINE
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function genRecs(goal){
  var ks=buildKS();
  var totR=ks.reduce(function(s,x){return s+x.k.rev;},0);
  var totCost=ks.reduce(function(s,x){return s+x.k.cost;},0);
  /* Coût salarial annuel estimé (SCR × jours ouvrables × charges) */
  var totSalaryAnnuel=S.cons.reduce(function(s,cc){return s+(cc.scr||0)*113.35*1.25;},0)/260*(S.cons.length>0?260:1);
  var totBill=ks.reduce(function(s,x){return s+x.k.bill;},0);
  var _aktWD=ks.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var avgSr=_aktWD>0?ks.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/_aktWD:0;
  var avgTJMv=totBill>0?totR/totBill:0;
  var cliArr=clientRev(ks);
  var recs=[];

  if(goal==='ca'){
    var noM=S.cons.filter(function(c){return !getAct(c.id)&&!isGone(c)&&!getActiveLv(c.id);});
    if(noM.length>0)recs.push({
      title:'Action urgente : staffer les consultants sans mission',
      detail:noM.map(function(c){return c.name;}).join(', ')+' ne sont pas en mission. Chaque jour factur\u00e9 g\u00e9n\u00e8re en moyenne '+fEur(Math.round(avgTJMv))+'. Lancez imm\u00e9diatement des appels d\u2019offres ou sollicitez vos clients existants pour un besoin compl\u00e9mentaire.'
    });
    var lowSr=ks.filter(function(x){return x.k.sr>0&&x.k.sr<75;}).sort(function(a,b){return a.k.sr-b.k.sr;});
    if(lowSr.length>0)recs.push({
      title:'R\u00e9duire les p\u00e9riodes inter-missions',
      detail:'Consultants sous 75\u00a0% de taux d\u2019utilisation\u00a0: '+lowSr.map(function(x){return x.c.name+' ('+x.k.sr.toFixed(0)+'%)';}).join(', ')+'. Chaque +10\u00a0% de staffing \u00e9quipe repr\u00e9sente environ '+fEur(Math.round(totBill*avgTJMv*0.10/Math.max(ks.length,1)))+' de CA suppl\u00e9mentaire par consultant.'
    });
    var lowTJM=ks.filter(function(x){return x.k.avgT>0&&x.k.avgT<avgTJMv*0.88;});
    if(lowTJM.length>0)recs.push({
      title:'Ren\u00e9gocier les TJM inf\u00e9rieurs \u00e0 la moyenne \u00e9quipe',
      detail:'TJM moyen \u00e9quipe\u00a0: '+fEur(Math.round(avgTJMv))+'/j. Consultants en dessous\u00a0: '+lowTJM.map(function(x){return x.c.name+' ('+fEur(Math.round(x.k.avgT))+'/j)';}).join(', ')+'. Une revalorisation de +50\u00a0\u20ac/j g\u00e9n\u00e8re '+fEur(Math.round(lowTJM.length*50*totBill/Math.max(ks.length,1)))+' de CA suppl\u00e9mentaire.'
    });
    if(cliArr.length>0&&cliArr[0].rev/Math.max(totR,1)>0.33)recs.push({
      title:'Diversifier le portefeuille\u00a0: trop de d\u00e9pendance sur '+cliArr[0].name,
      detail:cliArr[0].name+' repr\u00e9sente '+Math.round(cliArr[0].rev/Math.max(totR,1)*100)+'% du CA ('+fEur(cliArr[0].rev)+'). Au-dessus de 30\u00a0%, le risque est trop \u00e9lev\u00e9. Ciblez 2\u20133 nouvelles enseignes dans les secteurs Finance, \u00c9nergie ou Distribution.'
    });
    var end30=S.miss.filter(function(m){var s=mSt(m);return(s==='critical'||s==='soon')&&m.ed;});
    if(end30.length>0)recs.push({
      title:'S\u00e9curiser le renouvellement des missions en fin de vie',
      detail:end30.length+' mission(s) se terminent dans moins de 30\u00a0jours\u00a0: '+end30.map(function(m){return esc(m.name)+' chez '+esc(m.cli)+' (J\u2212'+dL(m.ed)+')';}).join(', ')+'. Engagez les discussions de prolongation maintenant - un renouvellement co\u00fbte 10\u00d7 moins cher qu\u2019un nouveau client.'
    });
    if(recs.length<5)recs.push({
      title:'Upsell\u00a0: \u00e9tendre le p\u00e9rim\u00e8tre chez vos clients actuels',
      detail:'Votre base de '+cliArr.length+' client(s) actif(s) est un levier sous-exploit\u00e9. Proposez des audits strat\u00e9giques, ateliers ou formations aux d\u00e9cideurs chez vos clients en mission. L\u2019upsell sur un client existant est 3\u00d7 plus rapide qu\u2019une vente \u00e0 un nouveau compte.'
    });
  }

  if(goal==='util'){
    var noM2=S.cons.filter(function(c){return !getAct(c.id)&&!isGone(c)&&!getActiveLv(c.id);});
    if(noM2.length>0)recs.push({
      title:'Priorit\u00e9 absolue\u00a0: '+noM2.length+' consultant(s) sans mission',
      detail:noM2.map(function(c){return c.name;}).join(', ')+' n\u2019ont aucune mission. Chaque semaine non factur\u00e9e repr\u00e9sente '+fEur(Math.round(avgTJMv*5))+' de CA perdu. D\u00e9clenchez des entretiens clients d\u00e8s cette semaine.'
    });
    var below80=ks.filter(function(x){return x.k.sr>0&&x.k.sr<80;}).sort(function(a,b){return a.k.sr-b.k.sr;});
    if(below80.length>0)recs.push({
      title:'Porter le taux d\u2019utilisation de tous au-dessus de 80\u00a0%',
      detail:'Consultants sous 80\u00a0%\u00a0: '+below80.map(function(x){return x.c.name+' ('+x.k.sr.toFixed(0)+'%)';}).join(', ')+'. 80\u00a0% est le seuil de rentabilit\u00e9 standard en ESN. Calculez les jours libres de chacun et positionnez-les en priorit\u00e9 sur vos comptes existants.'
    });
    var end30b=S.miss.filter(function(m){var s=mSt(m);return(s==='critical'||s==='soon')&&m.ed;});
    if(end30b.length>0)recs.push({
      title:'Lancer le staffing post-mission maintenant, pas \u00e0 J-0',
      detail:end30b.length+' mission(s) se terminent bient\u00f4t\u00a0: '+end30b.map(function(m){var c=S.cons.find(function(c){return c.id===m.cid;});return(c?esc(c.name):'')+' chez '+esc(m.cli)+' (J\u2212'+dL(m.ed)+')';}).join(', ')+'. Objectif\u00a0: z\u00e9ro jour d\u2019inter-contrat. Le recasement doit \u00eatre confirm\u00e9 avant la fin de la mission en cours.'
    });
    var highLv=ks.filter(function(x){return x.k.lvD>15;});
    if(highLv.length>0)recs.push({
      title:'Anticiper les absences longues pour pr\u00e9server le staffing',
      detail:'Consultants avec plus de 15\u00a0jours d\u2019absence sur l\u2019exercice\u00a0: '+highLv.map(function(x){return x.c.name+' ('+x.k.lvD+'j)';}).join(', ')+'. N\u00e9gociez les dates de cong\u00e9s hors p\u00e9riodes de pic client et pr\u00e9venez les clients 4 semaines \u00e0 l\u2019avance.'
    });
    recs.push({
      title:'Instaurer un rituel hebdomadaire de revue du staffing',
      detail:'Mettez en place un point 30\u00a0min chaque semaine pour passer en revue la situation de chaque consultant\u00a0: mission en cours, date de fin, pipeline de renouvellement, CV envoy\u00e9s. La visibilit\u00e9 \u00e0 60\u00a0jours est la cl\u00e9 d\u2019un taux d\u2019utilisation \u00e9lev\u00e9.'
    });
  }

  if(goal==='tjm'){
    var srtTJM=ks.filter(function(x){return x.k.avgT>0;}).sort(function(a,b){return a.k.avgT-b.k.avgT;});
    if(srtTJM.length>0){
      var lo=srtTJM[0];
      recs.push({
        title:'Revaloriser en priorit\u00e9 le TJM de '+lo.c.name,
        detail:'TJM actuel\u00a0: '+fEur(Math.round(lo.k.avgT))+'/j contre '+fEur(Math.round(avgTJMv))+'/j en moyenne \u00e9quipe. Un alignement sur la moyenne apporterait '+fEur(Math.round((avgTJMv-lo.k.avgT)*lo.k.bill))+' de CA suppl\u00e9mentaire sur l\u2019exercice. Pr\u00e9parez un dossier de valeur ajout\u00e9e avant la prochaine rencontrac\u00adtualisation.'
      });
    }
    var seniors=ks.filter(function(x){var tl=x.c.title.toLowerCase();return x.k.avgT>0&&x.k.avgT<avgTJMv&&(tl.indexOf('senior')>=0||tl.indexOf('manager')>=0);});
    if(seniors.length>0)recs.push({
      title:'Les profils senior\u00a0/ manager m\u00e9ritent un TJM au-dessus de la moyenne',
      detail:seniors.map(function(x){return x.c.name+' ('+x.c.title+' \u2014 '+fEur(Math.round(x.k.avgT))+'/j)';}).join(', ')+' sont sous la moyenne \u00e9quipe. Ces profils devraient se n\u00e9gocier 15\u202630\u00a0% au-dessus, soit '+fEur(Math.round(avgTJMv*1.15))+'\u202d\u00e0\u202d'+fEur(Math.round(avgTJMv*1.30))+'/j.'
    });
    var lowMarM=[];
    ks.forEach(function(x){x.k.pm.forEach(function(m){if(m.days>0&&m.mar<25)lowMarM.push({n:m.name,cli:m.cli,mar:m.mar,tjm:m.tjm});});});
    if(lowMarM.length>0)recs.push({
      title:'Ren\u00e9gocier les missions \u00e0 marge inf\u00e9rieure \u00e0 25\u00a0%',
      detail:'Missions en dessous de 25\u00a0% de marge [(TJM\u2212SCR)/TJM]\u00a0: '+lowMarM.map(function(m){return esc(m.n)+' chez '+esc(m.cli)+' ('+m.mar.toFixed(0)+'%\u00a0\u2014\u00a0TJM\u00a0'+fEur(m.tjm)+')';}).join(', ')+'. Visez un minimum de 30\u00a0% pour couvrir vos frais de structure.'
    });
    recs.push({
      title:'Int\u00e9grer une clause de revalorisation annuelle dans tous les contrats',
      detail:'Syst\u00e9matisez une r\u00e9vision tarifaire annuelle de +3\u00a0\u00e0\u00a0+8\u00a0% (selon inflation\u00a0+ performance). Sur un TJM moyen de '+fEur(Math.round(avgTJMv))+' et '+totBill+' jours factur\u00e9s, une hausse de 5\u00a0% g\u00e9n\u00e8re '+fEur(Math.round(totBill*avgTJMv*0.05))+' de CA suppl\u00e9mentaire.'
    });
    recs.push({
      title:'D\u00e9velopper des expertises rares \u00e0 forte valeur march\u00e9',
      detail:'Les sp\u00e9cialit\u00e9s IA g\u00e9n\u00e9rative, Cyber\u00ads\u00e9curit\u00e9, SAP\u00a0S/4HANA et Cloud\u00a0Native permettent de facturer 30\u202650\u00a0% au-dessus des TJM g\u00e9n\u00e9ralistes. Ciblez 1\u20132 consultants \u00e0 fort potentiel et investissez dans leur certification pour viser des TJM\u00a0>\u00a0'+fEur(Math.round(avgTJMv*1.40))+'/j.'
    });
  }

  if(!S.precs)S.precs={};
  S.precs[goal]=recs;
  render();
}

