/* Konsilys — comportements partagés du site vitrine (aucune dépendance).
   En-tête collant, méga-menus, menu mobile, onglets, mot animé du hero,
   formulaires « email → essai gratuit », sous-navigation active, apparitions. */
(function(){
  var d=document,html=d.documentElement;
  html.classList.add('js');

  /* En-tête : ombre au défilement */
  var hdr=d.querySelector('.site-header');
  function onScroll(){if(hdr)hdr.classList.toggle('scrolled',window.scrollY>8);}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  /* Menu mobile */
  var burger=d.querySelector('.burger');
  if(burger)burger.addEventListener('click',function(){
    var open=d.body.classList.toggle('nav-open');
    burger.setAttribute('aria-expanded',open?'true':'false');
  });

  /* Méga-menus : survol (desktop) + clic (desktop & mobile), Échap pour fermer */
  var items=d.querySelectorAll('.menu>li.has-mega');
  var hoverable=window.matchMedia&&matchMedia('(hover:hover) and (min-width:961px)').matches;
  function closeAll(except){for(var i=0;i<items.length;i++)if(items[i]!==except){items[i].classList.remove('open');var b=items[i].querySelector('button');if(b)b.setAttribute('aria-expanded','false');}}
  Array.prototype.forEach.call(items,function(li){
    var btn=li.querySelector('button'),t;
    btn.addEventListener('click',function(e){e.stopPropagation();var o=!li.classList.contains('open');closeAll(li);li.classList.toggle('open',o);btn.setAttribute('aria-expanded',o?'true':'false');});
    if(hoverable){
      li.addEventListener('mouseenter',function(){clearTimeout(t);closeAll(li);li.classList.add('open');btn.setAttribute('aria-expanded','true');});
      li.addEventListener('mouseleave',function(){t=setTimeout(function(){li.classList.remove('open');btn.setAttribute('aria-expanded','false');},140);});
    }
  });
  d.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.menu'))closeAll();});
  d.addEventListener('keydown',function(e){if(e.key==='Escape'){closeAll();d.body.classList.remove('nav-open');}});
  /* Un lien d'ancre cliqué dans le menu mobile referme le menu */
  Array.prototype.forEach.call(d.querySelectorAll('.menu a'),function(a){a.addEventListener('click',function(){d.body.classList.remove('nav-open');closeAll();});});

  /* Onglets accessibles (data-tabs) — sélection initiale possible via #ancre */
  Array.prototype.forEach.call(d.querySelectorAll('[data-tabs]'),function(root){
    var btns=root.querySelectorAll('[role="tab"]'),panels=root.querySelectorAll('[role="tabpanel"]');
    function sel(i,focus){
      for(var k=0;k<btns.length;k++){var on=k===i;btns[k].setAttribute('aria-selected',on?'true':'false');btns[k].tabIndex=on?0:-1;panels[k].classList.toggle('on',on);}
      if(focus)btns[i].focus();
    }
    Array.prototype.forEach.call(btns,function(b,i){
      b.addEventListener('click',function(){sel(i);});
      b.addEventListener('keydown',function(e){
        if(e.key==='ArrowRight'){e.preventDefault();sel((i+1)%btns.length,true);}
        if(e.key==='ArrowLeft'){e.preventDefault();sel((i-1+btns.length)%btns.length,true);}
      });
    });
    var h=(location.hash||'').slice(1),start=0;
    for(var k=0;k<btns.length;k++)if(h&&btns[k].getAttribute('data-hash')===h)start=k;
    sel(start);
  });

  /* Mot animé du hero */
  var rot=d.querySelector('[data-rotate]');
  if(rot&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)){
    var words=rot.getAttribute('data-rotate').split('|'),wi=0;
    setInterval(function(){wi=(wi+1)%words.length;rot.innerHTML='<span class="rot-word">'+words[wi]+'</span>';},2600);
  }

  /* Formulaires « votre email pro → essai gratuit » */
  Array.prototype.forEach.call(d.querySelectorAll('form[data-capture]'),function(f){
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var v=(f.querySelector('input[type=email]').value||'').trim();
      location.href='/essai-gratuit'+(v?'?email='+encodeURIComponent(v):'');
    });
  });

  /* Sous-navigation : surligne la section visible */
  var sub=d.querySelectorAll('.subnav a[href^="#"]');
  if(sub.length&&'IntersectionObserver' in window){
    var map={};Array.prototype.forEach.call(sub,function(a){map[a.getAttribute('href').slice(1)]=a;});
    var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){for(var k in map)map[k].classList.remove('on');var a=map[e.target.id];if(a){a.classList.add('on');if(a.scrollIntoView&&a.parentNode.scrollWidth>a.parentNode.clientWidth)a.parentNode.scrollLeft=a.offsetLeft-24;}}});},{rootMargin:'-45% 0px -50% 0px'});
    for(var k in map){var s=d.getElementById(k);if(s)so.observe(s);}
  }

  /* Apparition au défilement (filet de sécurité : tout afficher après 2,5 s) */
  var rv=d.querySelectorAll('.rv');
  function all(){for(var i=0;i<rv.length;i++)rv[i].classList.add('in');}
  if(!('IntersectionObserver' in window)){all();}
  else{
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    Array.prototype.forEach.call(rv,function(el){io.observe(el);});
    setTimeout(all,2500);
  }

  /* Année du pied de page */
  Array.prototype.forEach.call(d.querySelectorAll('[data-year]'),function(el){el.textContent=new Date().getFullYear();});
})();
