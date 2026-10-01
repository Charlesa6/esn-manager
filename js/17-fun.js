'use strict';
/* ════════════════════════════════════════════════════════════
   ONGLET FUN 🎉 — la pause bien méritée
   Vue 100 % front, sans backend : blague ESN, boule magique du
   staffing, compteur de cafés (localStorage), humeur d'équipe et
   confettis. Aucune donnée entreprise n'est lue ni écrite.
   ════════════════════════════════════════════════════════════ */

var FUN_JOKES=[
  'Pourquoi le consultant a-t-il apporté une échelle en réunion&nbsp;? Pour viser les objectifs les plus hauts. 🪜',
  'Mon TJM est tellement élevé que même mon café se facture en jour-homme. ☕',
  'Un intercontrat entre dans un bar. Le barman&nbsp;: «&nbsp;désolé, on ne staffe pas ici.&nbsp;» 🍸',
  'Qu\'est-ce qu\'un consultant optimiste&nbsp;? Quelqu\'un qui pense que la mission finira avant la fin du forfait. 📅',
  'Pourquoi les ESN adorent l\'automne&nbsp;? C\'est la saison des feuilles… de temps. 🍂',
  'Le secret d\'une marge saine&nbsp;? Un SCR bien tenu et beaucoup d\'amour. ❤️',
  'Réunion de staffing&nbsp;: l\'art de transformer 3 Excel en 1 décision… reportée à vendredi. 📊',
  'Mon manager m\'a dit de penser «&nbsp;out of the box&nbsp;». J\'ai donc pris une semaine de congés. 🏖️',
  'Deux TJM se rencontrent. Le premier dit&nbsp;: «&nbsp;t\'as l\'air net.&nbsp;» 💶',
  'Comment reconnaître un bon planning&nbsp;? Il change moins de trois fois par jour. 🗓️',
  'Le client voulait «&nbsp;du concret&nbsp;». On lui a livré une slide avec des coins arrondis. 🟦',
  'Un forfait, c\'est comme un régime&nbsp;: tout va bien jusqu\'au dernier jour. 🍰'
];

var FUN_8BALL=[
  'C\'est un grand oui. ✅',
  'Mets ça dans le prochain comité. 🧑‍💼',
  'Demande à ton N+1… ah, c\'est toi. 😎',
  'Les astres (et le TJM) sont alignés. ✨',
  'Mieux vaut un café d\'abord. ☕',
  'Non. Mais joliment non. 🙃',
  'Staffe-le, on verra bien. 🚀',
  'Reviens après la pause déj\'. 🥪',
  'Le forfait dit oui, la marge dit peut-être. 📈',
  'Absolument. Facture-le. 💸'
];

/* Petit feu d'artifice d'emojis (sans dépendance). */
function funBurst(emojis){
  emojis=emojis||['🎉','🎊','✨','🥳','⭐','💫','🎈'];
  var box=document.createElement('div');
  box.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
  document.body.appendChild(box);
  for(var i=0;i<30;i++){
    (function(){
      var s=document.createElement('span');
      s.textContent=emojis[Math.floor(Math.random()*emojis.length)];
      var dur=1200+Math.random()*1300;
      s.style.cssText='position:absolute;top:-6vh;left:'+(Math.random()*100)+'vw;font-size:'+(16+Math.random()*24)+'px;will-change:transform,opacity;opacity:1;transform:translateY(0) rotate(0deg);transition:transform '+dur+'ms cubic-bezier(.25,.6,.4,1),opacity '+dur+'ms ease-in';
      box.appendChild(s);
      requestAnimationFrame(function(){requestAnimationFrame(function(){
        s.style.transform='translateY('+(104+Math.random()*18)+'vh) rotate('+(Math.random()*720-360)+'deg)';
        s.style.opacity='0';
      });});
    })();
  }
  setTimeout(function(){if(box.parentNode)box.parentNode.removeChild(box);},2800);
}

function funNewJoke(){
  var el=document.getElementById('fun-joke');if(!el)return;
  el.innerHTML=FUN_JOKES[Math.floor(Math.random()*FUN_JOKES.length)];
}

function funAsk8(){
  var a=document.getElementById('fun-8a');if(!a)return;
  var q=((document.getElementById('fun-q')||{}).value||'').trim();
  a.innerHTML='🔮 <b>'+esc(FUN_8BALL[Math.floor(Math.random()*FUN_8BALL.length)])+'</b>';
  funBurst(['🔮','✨','💫']);
}

function _funCoffeeGet(){var n=0;try{n=+localStorage.getItem('fun_coffee')||0;}catch(e){}return n;}
function funCoffee(){
  var n=_funCoffeeGet()+1;
  try{localStorage.setItem('fun_coffee',String(n));}catch(e){}
  var el=document.getElementById('fun-coffee-n');if(el)el.textContent=n;
  var msg=document.getElementById('fun-coffee-msg');
  if(msg)msg.textContent=(n%10===0)?('🎉 '+n+' cafés ! Palier atteint, tu carbures.'):'Encore '+(10-(n%10))+' avant le prochain palier ☕';
  if(n%10===0)funBurst(['☕','🎉','✨','🥳']);
}

function funMood(em,ev){
  try{localStorage.setItem('fun_mood',em);}catch(e){}
  var row=document.getElementById('fun-mood-row');
  if(row){var bs=row.getElementsByTagName('button');for(var i=0;i<bs.length;i++){bs[i].style.outline='';bs[i].style.transform='';}}
  if(ev&&ev.currentTarget){ev.currentTarget.style.outline='3px solid #84CC16';ev.currentTarget.style.transform='scale(1.15)';}
  var m=document.getElementById('fun-mood-msg');if(m)m.textContent='Humeur du jour enregistrée : '+em+' — merci d\'avoir partagé !';
}

function tFun(){
  var coffee=_funCoffeeGet();
  var mood='';try{mood=localStorage.getItem('fun_mood')||'';}catch(e){}
  var joke0=FUN_JOKES[Math.floor(Math.random()*FUN_JOKES.length)];
  var moods=['😄','🙂','😐','😫','🔥','🥳'];
  var card='background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px';
  var btn='border:none;border-radius:9px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit';
  var lime='background:#84CC16;color:#16240a;'+btn;
  var ghost='background:#f1f5f9;color:#334155;'+btn;

  return '<div class="vw">'
    +'<div class="ph"><div><div class="pt">🎉 Fun</div><div class="ps">La pause bien méritée — zéro reporting, 100&nbsp;% bonne humeur</div></div>'
    +'<button style="'+lime+'" onclick="funBurst()">Lancer des confettis 🎊</button></div>'

    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:4px">'

    /* Blague ESN du jour */
    +'<div style="'+card+'">'
    +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:12px">😄 La blague ESN du jour</div>'
    +'<div id="fun-joke" style="font-size:15px;line-height:1.6;color:#243447;min-height:70px;display:flex;align-items:center">'+joke0+'</div>'
    +'<button style="'+ghost+';margin-top:12px" onclick="funNewJoke()">Une autre 🔁</button>'
    +'</div>'

    /* Boule magique du staffing */
    +'<div style="'+card+'">'
    +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:12px">🔮 La boule magique du staffing</div>'
    +'<p style="font-size:12px;color:#64748b;margin:0 0 10px">Posez une question fermée (staffer&nbsp;? valider&nbsp;? prendre un café&nbsp;?)</p>'
    +'<input id="fun-q" placeholder="Dois-je staffer Jean sur le projet X&nbsp;?" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:13px" onkeydown="if(event.key===\'Enter\')funAsk8()">'
    +'<button style="'+lime+';margin-top:10px" onclick="funAsk8()">Demander à la boule 🔮</button>'
    +'<div id="fun-8a" style="margin-top:14px;font-size:16px;color:#0f172a;min-height:24px"></div>'
    +'</div>'

    /* Compteur de cafés */
    +'<div style="'+card+';text-align:center">'
    +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:6px">☕ Compteur de cafés</div>'
    +'<div style="font-size:52px;line-height:1.1;font-weight:800;color:#84CC16"><span id="fun-coffee-n">'+coffee+'</span></div>'
    +'<div style="font-size:12px;color:#64748b;margin-bottom:12px">cafés comptabilisés (rien que pour le plaisir)</div>'
    +'<button style="'+lime+'" onclick="funCoffee()">+1 café ☕</button>'
    +'<div id="fun-coffee-msg" style="font-size:12px;color:#64748b;margin-top:12px">Palier de confettis tous les 10 cafés 🎉</div>'
    +'</div>'

    /* Humeur du jour */
    +'<div style="'+card+'">'
    +'<div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:6px">🌡️ Humeur du jour</div>'
    +'<p style="font-size:12px;color:#64748b;margin:0 0 14px">Comment vous sentez-vous aujourd\'hui&nbsp;?</p>'
    +'<div id="fun-mood-row" style="display:flex;gap:8px;flex-wrap:wrap">'
    +moods.map(function(em){
        var sel=(em===mood);
        return '<button onclick="funMood(\''+em+'\',event)" style="font-size:28px;line-height:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;cursor:pointer;transition:transform .12s'+(sel?';outline:3px solid #84CC16;transform:scale(1.15)':'')+'">'+em+'</button>';
      }).join('')
    +'</div>'
    +'<div id="fun-mood-msg" style="font-size:12px;color:#64748b;margin-top:14px">'+(mood?('Humeur du jour enregistrée : '+mood+' — merci d\'avoir partagé !'):'Votre humeur reste sur cet appareil, rien n\'est envoyé.')+'</div>'
    +'</div>'

    +'</div>'
    +'<p style="font-size:11px;color:#94a3b8;margin-top:16px;text-align:center">🎈 Onglet 100&nbsp;% détente — aucune donnée entreprise n\'est utilisée ici.</p>'
    +'</div>';
}
