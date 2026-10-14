#!/usr/bin/env node
// Génère les pages de konsilys.com (offre « création de sites internet », dossier com/).
//   node scripts/build-com.cjs
// Une page d'accueil + une page par profession, à partir d'un gabarit commun et des textes ci-dessous.
// Les fichiers produits (com/*.html, sitemap-com.xml) sont commités : Vercel les sert tels quels (pas de build).
// Pour ajouter une profession : une entrée dans PROFESSIONS, une route dans vercel.json, puis relancer le script.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://www.konsilys.com';
const TEL = '06 71 58 20 74';
const TEL_HREF = 'tel:+33671582074';
const MAIL = 'contact@konsilys.com';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const IC = {
  phone: '<rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
};
const icon = (n) => `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

// ── Les professions (onglets) ─────────────────────────────────────────────────
const PROFESSIONS = [
  {
    slug: 'batiment', onglet: 'Bâtiment', nom: 'entreprises du bâtiment', pour: 'entreprise du bâtiment',
    titre: 'Création de site internet pour entreprise du bâtiment à Lyon',
    description: 'Konsilys crée le site internet des artisans et PME du bâtiment à Lyon : maçons, couvreurs, électriciens, plombiers. Maquette gratuite, en ligne en 48 h, dès 39 € HT/mois.',
    eyebrow: 'Maçons, couvreurs, électriciens, plombiers, menuisiers…',
    h1: 'Le site de votre entreprise du bâtiment, <em>déjà prêt</em>.',
    lead: 'Vos prestations, votre zone d\'intervention, votre numéro en un clic : on prépare gratuitement la maquette du site de votre entreprise, vous la validez, elle est en ligne sous votre nom en 48 heures.',
    exemples: [['maconnerie', 'Maçonnerie'], ['electricite', 'Électricité']],
    atouts: [
      ['phone', 'Lisible sur téléphone', 'C\'est là que vos clients vous cherchent. Votre numéro s\'appelle d\'un simple toucher.'],
      ['search', 'Trouvable près de chez vous', 'Votre métier et votre zone d\'intervention, présentés pour être bien compris par Google.'],
      ['shield', 'Rassurant', 'Pour les particuliers, les architectes, les donneurs d\'ordre… et les futurs salariés.'],
    ],
    faq: ['Je n\'ai pas de photos de mes chantiers.', 'Le site fonctionne très bien sans. Vous pourrez en ajouter plus tard : une photo prise au téléphone, envoyée par email, suffit.'],
  },
  {
    slug: 'restaurant', onglet: 'Restaurants', nom: 'restaurants', pour: 'restaurant',
    titre: 'Création de site internet pour restaurant à Lyon',
    description: 'Konsilys crée le site internet des restaurants lyonnais : votre maison, vos horaires, la réservation par téléphone et l\'itinéraire. Maquette gratuite, en ligne en 48 h, dès 39 € HT/mois.',
    eyebrow: 'Restaurants, bistrots, bouchons, brasseries…',
    h1: 'Le site de votre restaurant, <em>déjà prêt</em>.',
    lead: 'Votre cuisine, vos horaires, un bouton « Réserver une table » et l\'itinéraire jusqu\'à chez vous : on prépare gratuitement la maquette du site de votre restaurant, elle est en ligne sous votre nom en 48 heures.',
    exemples: [['restaurant', 'Restaurant']],
    atouts: [
      ['calendar', 'Des réservations en un clic', 'Le bouton « Réserver une table » appelle directement votre restaurant depuis un téléphone.'],
      ['clock', 'Horaires toujours à jour', 'Fermeture exceptionnelle, nouveaux horaires d\'été : un message suffit, on met à jour.'],
      ['pin', 'Facile à trouver', 'Votre adresse et l\'itinéraire en un geste, pour les clients qui vous découvrent.'],
    ],
    faq: ['J\'ai déjà une page Instagram ou une fiche sur une plateforme de réservation.', 'Gardez-les : le site les complète. C\'est votre vitrine à vous, à votre nom, sans publicité pour d\'autres restaurants, et vous pouvez y renvoyer depuis Instagram.'],
  },
  {
    slug: 'coiffeur', onglet: 'Coiffeurs', nom: 'salons de coiffure', pour: 'salon de coiffure',
    titre: 'Création de site internet pour salon de coiffure à Lyon',
    description: 'Konsilys crée le site internet des salons de coiffure lyonnais : vos prestations, vos horaires et la prise de rendez-vous par téléphone. Maquette gratuite, en ligne en 48 h, dès 39 € HT/mois.',
    eyebrow: 'Coiffeurs, barbiers, salons mixtes…',
    h1: 'Le site de votre salon de coiffure, <em>déjà prêt</em>.',
    lead: 'Vos prestations, vos horaires et un bouton « Prendre rendez-vous » : on prépare gratuitement la maquette du site de votre salon, elle est en ligne sous votre nom en 48 heures.',
    exemples: [['coiffure', 'Salon de coiffure']],
    atouts: [
      ['calendar', 'Des rendez-vous en un clic', 'Le bouton « Prendre rendez-vous » appelle votre salon directement depuis un téléphone.'],
      ['camera', 'Votre style, en images', 'Ajoutez les photos du salon et de vos réalisations quand vous le souhaitez.'],
      ['pin', 'Facile à trouver', 'Adresse, horaires et itinéraire, pour les clients du quartier comme ceux de passage.'],
    ],
    faq: ['J\'utilise déjà une application de prise de rendez-vous.', 'Aucun problème : on ajoute un lien vers elle sur votre site. Le site reste votre vitrine à vous, à votre nom.'],
  },
  {
    slug: 'fleuriste', onglet: 'Fleuristes', nom: 'fleuristes', pour: 'boutique de fleurs',
    titre: 'Création de site internet pour fleuriste à Lyon',
    description: 'Konsilys crée le site internet des fleuristes lyonnais : vos créations, vos prestations pour les mariages et le deuil, vos horaires et la commande par téléphone. Maquette gratuite, dès 39 € HT/mois.',
    eyebrow: 'Fleuristes, artisans fleuristes, ateliers floraux…',
    h1: 'Le site de votre boutique de fleurs, <em>déjà prêt</em>.',
    lead: 'Vos bouquets, vos prestations pour les mariages et le deuil, vos horaires et un bouton « Commander un bouquet » : on prépare gratuitement la maquette du site de votre boutique, elle est en ligne sous votre nom en 48 heures.',
    exemples: [['fleuriste', 'Fleuriste']],
    atouts: [
      ['phone', 'Des commandes en un clic', 'Le bouton « Commander un bouquet » appelle votre boutique directement depuis un téléphone.'],
      ['camera', 'Vos créations, en images', 'Ajoutez les photos de vos bouquets et compositions au fil des saisons.'],
      ['shield', 'Rassurant pour les grandes occasions', 'Mariages, événements, deuil : vos clients trouvent tout de suite qui contacter.'],
    ],
    faq: ['Mes créations changent chaque semaine.', 'Envoyez-nous de nouvelles photos par email quand vous le souhaitez : elles sont en ligne dans la journée.'],
  },
  {
    slug: 'boulangerie', onglet: 'Boulangeries', nom: 'boulangeries', pour: 'boulangerie',
    titre: 'Création de site internet pour boulangerie à Lyon',
    description: 'Konsilys crée le site internet des boulangeries et pâtisseries lyonnaises : vos produits, vos horaires et les commandes de gâteaux par téléphone. Maquette gratuite, en ligne en 48 h, dès 39 € HT/mois.',
    eyebrow: 'Boulangeries, pâtisseries, boulangeries-pâtisseries…',
    h1: 'Le site de votre boulangerie, <em>déjà prêt</em>.',
    lead: 'Vos pains et pâtisseries, vos horaires et un bouton « Passer commande » pour les gâteaux d\'anniversaire : on prépare gratuitement la maquette du site de votre boulangerie, elle est en ligne sous votre nom en 48 heures.',
    exemples: [['boulangerie', 'Boulangerie']],
    atouts: [
      ['phone', 'Des commandes en un clic', 'Le bouton « Passer commande » appelle votre boulangerie directement depuis un téléphone.'],
      ['clock', 'Horaires toujours à jour', 'Jours de fermeture, congés d\'été : un message suffit, on met à jour.'],
      ['pin', 'Facile à trouver', 'Votre adresse et l\'itinéraire, pour les habitants du quartier comme pour les nouveaux venus.'],
    ],
    faq: ['Je n\'ai pas de photos de mes produits.', 'Le site fonctionne très bien sans. Une photo prise au téléphone, envoyée par email, suffit pour en ajouter.'],
  },
];

const HUB = {
  slug: '', titre: 'Création de site internet à Lyon pour artisans et commerçants',
  description: 'Konsilys crée à Lyon le site internet des artisans, commerçants et entreprises du bâtiment : maquette gratuite préparée pour vous, en ligne en 48 h, dès 39 € HT par mois, domaine et hébergement compris.',
  eyebrow: 'Création de sites internet à Lyon',
  h1: 'Votre site internet est <em>déjà prêt</em>. Il ne manque que votre accord.',
  lead: 'Je prépare gratuitement la maquette du site de votre entreprise. Vous la regardez, on l\'ajuste ensemble, et elle est en ligne sous votre nom en 48 heures. Vous n\'écrivez rien, vous ne gérez rien.',
  exemples: [['maconnerie', 'Maçonnerie'], ['restaurant', 'Restaurant'], ['coiffure', 'Salon de coiffure'], ['boulangerie', 'Boulangerie']],
  atouts: [
    ['phone', 'Lisible sur téléphone', 'C\'est là que vos clients vous cherchent. Votre numéro s\'appelle d\'un simple toucher.'],
    ['search', 'Trouvable près de chez vous', 'Votre métier, votre quartier, vos horaires : présentés pour être bien compris par Google.'],
    ['shield', 'Rassurant', 'Même recommandé, on vous vérifie sur internet avant d\'appeler ou de venir.'],
  ],
  faq: null,
};

const FAQ_COMMUNE = [
  ['Je n\'ai pas le temps de m\'en occuper.', 'C\'est précisément le principe : je prépare tout, textes compris. De votre côté, comptez un appel de quelques minutes pour valider la maquette.'],
  ['Comment avez-vous préparé une maquette sans me connaître ?', 'À partir des informations publiques de votre entreprise (registres officiels, annuaires professionnels) : nom, métier, adresse, coordonnées. Les textes génériques sont signalés comme « à valider » et vous les corrigez avant toute mise en ligne. La maquette est privée et n\'apparaît pas sur Google.'],
  ['J\'ai déjà une fiche Google, à quoi sert un site ?', 'La fiche vous fait trouver ; le site vous présente en entier, à votre nom, et rassure ceux qui hésitent. Une fiche sans site affiche un bouton « Site web » vide. Avec l\'offre Site + Google, je relie les deux et je les garde à jour ensemble : mêmes horaires, même numéro, mêmes photos.'],
  ['Est-ce que je serai premier sur Google ?', 'Personne ne peut honnêtement le promettre. Votre site est construit pour être bien compris par Google (métier, quartier de Lyon, horaires), et c\'est ce qui compte pour être trouvé près de chez vous.'],
  ['Et si je veux arrêter ?', 'Après la première année, l\'abonnement est sans engagement. Le nom de domaine est à votre nom : vous le gardez, et vous pouvez récupérer votre site.'],
  ['Qui est derrière Konsilys ?', `Charles Allouard, consultant en informatique depuis plus de 5 ans, basé à Lyon (2e arrondissement). Vous avez un interlocuteur direct, joignable au ${TEL} ou par email.`],
];

// ── Gabarit ───────────────────────────────────────────────────────────────────
const url = (slug) => `${BASE}/creation-site-internet${slug ? '/' + slug : ''}`;
const href = (slug) => `/creation-site-internet${slug ? '/' + slug : ''}`;

function jsonLd(page, faq) {
  const org = {
    '@type': 'ProfessionalService', '@id': `${BASE}/#konsilys`, name: 'Konsilys', url: url(''),
    telephone: '+33671582074', email: MAIL, priceRange: '39 € – 69 € HT / mois',
    image: `${BASE}/com/img/exemple-maconnerie-ordinateur.jpg`,
    address: { '@type': 'PostalAddress', streetAddress: '17 rue Vaubecour', postalCode: '69002', addressLocality: 'Lyon', addressRegion: 'Auvergne-Rhône-Alpes', addressCountry: 'FR' },
    geo: { '@type': 'GeoCoordinates', latitude: 45.7551, longitude: 4.8279 },
    areaServed: [{ '@type': 'City', name: 'Lyon' }, { '@type': 'AdministrativeArea', name: 'Métropole de Lyon' }],
    founder: { '@type': 'Person', name: 'Charles Allouard', jobTitle: 'Consultant en informatique, fondateur de Konsilys' },
  };
  const service = {
    '@type': 'Service', name: page.titre, serviceType: 'Création de site internet', provider: { '@id': `${BASE}/#konsilys` },
    areaServed: { '@type': 'City', name: 'Lyon' }, url: url(page.slug),
    offers: [
      { '@type': 'Offer', name: 'Site', price: '39', priceCurrency: 'EUR', description: 'Abonnement mensuel HT, création offerte, domaine et hébergement compris' },
      { '@type': 'Offer', name: 'Site + Google', price: '45', priceCurrency: 'EUR', description: 'Abonnement mensuel HT : site et fiche Google tenus à jour ensemble' },
      { '@type': 'Offer', name: 'Sérénité', price: '69', priceCurrency: 'EUR', description: 'Abonnement mensuel HT + 290 € HT de mise en ligne : site et fiche Google, suivi mensuel, photos et actualités' },
    ],
  };
  const crumbs = { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Création de site internet à Lyon', item: url('') }].concat(page.slug ? [{ '@type': 'ListItem', position: 2, name: page.onglet, item: url(page.slug) }] : []) };
  const faqLd = { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, service, crumbs, faqLd] }).replace(/</g, '\\u003c');
}

function header(page) {
  const tabs = [['', 'Accueil']].concat(PROFESSIONS.map((p) => [p.slug, p.onglet]));
  return `<header class="hdr"><div class="wrap hdr-in">
  <a class="brand" href="${href('')}" aria-label="Konsilys — accueil"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-name">Konsilys</span><span class="brand-sub">Sites internet · Lyon</span></a>
  <a class="hdr-tel" href="${TEL_HREF}" aria-label="Appeler le ${TEL}">${TEL}</a>
  <a class="btn btn-lime hdr-cta" href="#contact">Ma maquette gratuite</a>
</div>
<nav class="tabs" aria-label="Professions"><div class="wrap tabs-in">${tabs.map(([s, l]) => `<a href="${href(s)}"${s === page.slug ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</div></nav>
</header>`;
}

function exemples(page) {
  const many = page.exemples.length > 1;
  return `<section class="sec" id="exemples"><div class="wrap">
  <div class="center"><h2>À quoi ressemblera votre site</h2><p>Chaque métier a ses couleurs et sa présentation. Exemples réalisés pour des entreprises fictives.</p></div>
  <div class="${many ? 'examples' : 'example-one'}">${page.exemples.map(([n, l]) => {
    const lien = !page.slug ? PROFESSIONS.find((p) => p.exemples.some(([e]) => e === n)) : null;
    return `<div class="ex">
    <div class="pair"><figure class="desk"><img src="/com/img/exemple-${n}-ordinateur.jpg" width="1280" height="800" loading="lazy" alt="Exemple de site — ${esc(l)}, vu sur ordinateur"></figure>${many ? '' : `<figure class="mob"><img src="/com/img/exemple-${n}-mobile.jpg" width="780" height="1560" loading="lazy" alt="Le même site vu sur téléphone"></figure>`}</div>
    <p class="fine" style="text-align:left;margin-top:10px">${esc(l)} — exemple fictif${lien ? ` · <a class="lnk" href="${href(lien.slug)}">Voir l'offre ${esc(lien.onglet.toLowerCase())}</a>` : ''}</p></div>`;
  }).join('')}</div>
</div></section>`;
}

function page(p) {
  const faq = FAQ_COMMUNE.slice(0, 2).concat(p.faq ? [p.faq] : []).concat(FAQ_COMMUNE.slice(2));
  const hero = p.slug ? p.exemples[0][0] : 'maconnerie';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.titre)} — Konsilys</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url(p.slug)}">
<meta name="geo.region" content="FR-69"><meta name="geo.placename" content="Lyon"><meta name="geo.position" content="45.7551;4.8279"><meta name="ICBM" content="45.7551, 4.8279">
<meta property="og:locale" content="fr_FR"><meta property="og:type" content="website"><meta property="og:site_name" content="Konsilys">
<meta property="og:title" content="${esc(p.titre)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:url" content="${url(p.slug)}">
<meta property="og:image" content="${BASE}/com/img/exemple-${hero}-ordinateur.jpg">
<meta name="theme-color" content="#1B2B3A">
<link rel="icon" href="/icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/com/com.css">
<script type="application/ld+json">${jsonLd(p, faq)}</script>
</head>
<body>
<!-- Page générée par scripts/build-com.cjs : modifier le script, pas ce fichier. -->
${header(p)}

<main>
<section class="hero"><div class="wrap hero-in">
  <div>
    <span class="eyebrow">${esc(p.eyebrow)}</span>
    <h1>${p.h1}</h1>
    <p class="lead">${esc(p.lead)}</p>
    <div class="cta-row">
      <a class="btn btn-lime btn-lg" href="#contact">Recevoir ma maquette gratuite</a>
      <a class="btn btn-out btn-lg" href="#exemples">Voir des exemples</a>
    </div>
    <p class="call-line">Une question ? Appelez Charles Allouard au <a href="${TEL_HREF}">${TEL}</a></p>
    <ul class="reassure">
      <li>${CHECK}Maquette gratuite, sans engagement</li>
      <li>${CHECK}Dès 39 € HT/mois, domaine et hébergement compris</li>
      <li>${CHECK}Basé à Lyon</li>
    </ul>
  </div>
  <div class="shots" aria-label="Exemple de site réalisé (entreprise fictive)">
    <div class="shot-desk"><div class="bar" aria-hidden="true"><i></i><i></i><i></i></div><img src="/com/img/exemple-${hero}-ordinateur.jpg" width="1280" height="800" alt="Exemple de site vu sur ordinateur"></div>
    <div class="shot-phone"><img src="/com/img/exemple-${hero}-mobile.jpg" width="780" height="1560" alt="Le même site vu sur téléphone"></div>
    <span class="tag-ex">Exemple réalisé pour une entreprise fictive</span>
  </div>
</div></section>

${p.slug ? '' : `<section class="sec sec-off"><div class="wrap">
  <div class="center"><h2>Pour les artisans et commerçants lyonnais</h2><p>Un site qui dit l'essentiel : ce que vous faites, où vous trouver, comment vous joindre. Choisissez votre métier :</p></div>
  <div class="prof-grid">${PROFESSIONS.map((q) => `<a class="prof" href="${href(q.slug)}"><img src="/com/img/exemple-${q.exemples[0][0]}-mobile.jpg" width="780" height="1560" loading="lazy" alt=""><span><b>${esc(q.onglet)}</b><small>${esc(q.eyebrow)}</small></span></a>`).join('')}</div>
</div></section>`}

<section class="sec${p.slug ? ' sec-off' : ''}"><div class="wrap">
  <div class="center"><h2>Vos clients vous cherchent avant de ${p.slug === 'batiment' ? 'vous appeler' : 'venir'}</h2><p>Même recommandé, on vous vérifie sur internet. Sans site, ou avec un site qui ne s'affiche pas sur un téléphone, vous laissez filer des clients qui ne trouvent ni ${p.slug === 'batiment' ? 'vos prestations' : 'vos horaires'}, ni votre numéro.</p></div>
  <div class="grid3">${p.atouts.map(([i, t, d]) => `<article class="card"><span class="ic">${icon(i)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('')}</div>
</div></section>

<section class="sec sec-navy" id="fonctionnement"><div class="wrap">
  <div class="center"><h2>Comment ça marche</h2><p>Trois étapes, et vous n'avez presque rien à faire.</p></div>
  <div class="grid3">
    <article class="card step"><b class="n">1</b><h3>Je prépare votre maquette</h3><p>À partir des informations publiques de votre ${p.slug ? esc(p.pour) : 'entreprise'} : métier, adresse, coordonnées. Gratuitement, avant toute discussion.</p></article>
    <article class="card step"><b class="n">2</b><h3>On l'ajuste ensemble</h3><p>Un appel de quelques minutes : vous corrigez les textes, ajoutez vos horaires et vos photos si vous le souhaitez.</p></article>
    <article class="card step"><b class="n">3</b><h3>En ligne en 48 heures</h3><p>Sous votre propre nom de domaine. Ensuite, une modification ? Un email ou un appel suffit.</p></article>
  </div>
</div></section>

${exemples(p)}

<section class="sec sec-off"><div class="wrap">
  <div class="center"><h2>Tout est compris</h2><p>Pas de devis à rallonge, pas de surprise.</p></div>
  <ul class="incl">
    <li>${CHECK}<span>La création du site<small>Textes rédigés pour vous, adaptés à votre métier</small></span></li>
    <li>${CHECK}<span>Votre nom de domaine<small>À votre nom : vous en restez propriétaire</small></span></li>
    <li>${CHECK}<span>L'hébergement et la sécurité<small>Site rapide, connexion sécurisée (HTTPS)</small></span></li>
    <li>${CHECK}<span>Les modifications<small>Nouveaux horaires, nouvelle prestation : on s'en occupe</small></span></li>
    <li>${CHECK}<span>Les mentions légales<small>Rédigées et tenues à jour</small></span></li>
    <li>${CHECK}<span>Un interlocuteur unique<small>Charles Allouard, joignable au ${TEL}</small></span></li>
  </ul>
</div></section>

<section class="sec" id="tarifs"><div class="wrap">
  <div class="center"><h2>Des tarifs simples</h2><p>Un abonnement mensuel, tout compris.</p></div>
  <div class="prices">
    <article class="price">
      <span class="badge" style="background:#F1F5F9;color:var(--navy)">Le site</span>
      <h3>Site</h3>
      <div class="amt">39 € <small>HT / mois</small></div>
      <p class="setup">Création offerte</p>
      <ul>
        <li>${CHECK}Site une page : présentation, ${p.slug === 'batiment' ? 'prestations, zone' : 'prestations, horaires, adresse'}, contact</li>
        <li>${CHECK}Nom de domaine et hébergement</li>
        <li>${CHECK}2 modifications par mois</li>
      </ul>
      <a class="btn btn-navy btn-lg" href="#contact">Recevoir ma maquette</a>
    </article>
    <article class="price best">
      <span class="badge">Le plus choisi</span>
      <h3>Site + Google</h3>
      <div class="amt">45 € <small>HT / mois</small></div>
      <p class="setup">Création offerte</p>
      <ul>
        <li>${CHECK}Tout l'offre Site</li>
        <li>${CHECK}Création ou reprise de votre fiche Google, complétée et reliée au site</li>
        <li>${CHECK}Toujours les mêmes informations : un changement d'horaires ou de numéro est reporté sur le site et la fiche, le jour même</li>
        <li>${CHECK}QR code « Laissez-nous un avis » à poser ${p.slug === 'batiment' ? 'sur vos devis' : 'en caisse'}</li>
      </ul>
      <a class="btn btn-lime btn-lg" href="#contact">Recevoir ma maquette</a>
    </article>
    <article class="price">
      <span class="badge" style="background:#F1F5F9;color:var(--navy)">Sans souci</span>
      <h3>Sérénité</h3>
      <div class="amt">69 € <small>HT / mois</small></div>
      <p class="setup">+ 290 € HT de mise en ligne</p>
      <ul>
        <li>${CHECK}Tout l'offre Site + Google</li>
        <li>${CHECK}Suivi chaque mois du site et de la fiche Google</li>
        <li>${CHECK}Nouvelles photos (${p.slug === 'batiment' ? 'chantiers' : p.slug === 'restaurant' ? 'plats, salle' : p.slug === 'coiffeur' ? 'salon, réalisations' : p.slug === 'fleuriste' ? 'créations' : p.slug === 'boulangerie' ? 'produits' : 'chantiers, plats, créations…'}) et actualités publiées pour vous</li>
        <li>${CHECK}Horaires des jours fériés et des vacances mis à jour</li>
        <li>${CHECK}Réponses à vos avis Google préparées pour vous</li>
        <li>${CHECK}Modifications illimitées</li>
      </ul>
      <a class="btn btn-navy btn-lg" href="#contact">En parler</a>
    </article>
  </div>
  <p class="fine">Engagement de 12 mois, puis sans engagement. Paiement annuel possible : 10 mois payés pour 12.</p>
</div></section>

<section class="sec sec-off" id="qui"><div class="wrap about">
  <div class="about-mark" aria-hidden="true">CA</div>
  <div>
    <span class="eyebrow">Qui suis-je ?</span>
    <h2>Charles Allouard, consultant en informatique à Lyon</h2>
    <p>Je suis consultant en informatique depuis plus de 5 ans. J'ai créé Konsilys à Lyon pour mettre ce savoir-faire au service des artisans et des commerçants : des sites simples, rapides, tenus à jour, sans jargon et sans mauvaise surprise.</p>
    <p>Vous avez un seul interlocuteur, joignable directement : <a class="lnk" href="${TEL_HREF}">${TEL}</a> ou <a class="lnk" href="mailto:${MAIL}">${MAIL}</a>.</p>
  </div>
</div></section>

<section class="sec" id="questions"><div class="wrap">
  <div class="center"><h2>Vos questions</h2></div>
  <div class="faq">${faq.map(([q, a]) => `\n    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
  </div>
</div></section>

<section class="sec sec-navy" id="contact"><div class="wrap contact">
  <div>
    <h2>Recevez votre maquette gratuite</h2>
    <p>Indiquez-moi le nom de votre ${p.slug ? esc(p.pour) : 'entreprise'} : je prépare votre maquette et je vous recontacte pour vous la montrer. Sans engagement.</p>
    <p style="margin-top:22px">Ou contactez-moi directement :</p>
    <p style="margin-top:10px"><a class="mail-big" href="${TEL_HREF}">${TEL}</a></p>
    <p style="margin-top:12px"><a class="mail-big" href="mailto:${MAIL}">${MAIL}</a></p>
  </div>
  <form class="form" id="demande" novalidate>
    <label>Nom de votre ${p.slug ? esc(p.pour) : 'entreprise'}<input name="entreprise" required autocomplete="organization"></label>
    <label>Votre métier<select name="metier">${['Bâtiment', 'Restaurant', 'Coiffure', 'Fleuriste', 'Boulangerie', 'Autre'].map((m) => `<option${(p.onglet || '').startsWith(m.slice(0, 5)) ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
    <label>Adresse ou arrondissement<input name="ville" autocomplete="street-address"></label>
    <label>Votre nom<input name="nom" autocomplete="name"></label>
    <label>Téléphone<input name="tel" type="tel" autocomplete="tel"></label>
    <label>Un mot sur votre activité (facultatif)<textarea name="message"></textarea></label>
    <button class="btn btn-lime btn-lg" type="submit">Demander ma maquette</button>
    <p class="hint">Le bouton ouvre votre messagerie avec un email pré-rempli à ${MAIL}. Vos informations servent uniquement à vous répondre.</p>
  </form>
</div></section>
</main>

<footer class="ftr"><div class="wrap">
  <nav class="ftr-links" aria-label="Création de site internet à Lyon par métier">${[['', 'Création de site internet à Lyon']].concat(PROFESSIONS.map((q) => [q.slug, 'Site internet ' + q.onglet.toLowerCase()])).map(([s, l]) => `<a href="${href(s)}">${esc(l)}</a>`).join('')}</nav>
  <div class="ftr-in">
    <span>© <span id="an">2026</span> Konsilys — Charles Allouard, 17 rue Vaubecour, 69002 Lyon</span>
    <a href="${TEL_HREF}">${TEL}</a>
    <a href="mailto:${MAIL}">${MAIL}</a>
    <a href="/mentions-legales">Mentions légales</a>
  </div>
</div></footer>

<script>
document.getElementById('an').textContent = new Date().getFullYear();
document.getElementById('demande').addEventListener('submit', function (e) {
  e.preventDefault();
  var f = e.target, v = function (n) { return (f.elements[n].value || '').trim(); };
  if (!v('entreprise')) { f.elements.entreprise.focus(); return; }
  var corps = 'Bonjour,\\n\\nJe souhaite recevoir la maquette gratuite du site de mon entreprise.\\n\\n'
    + 'Entreprise : ' + v('entreprise') + '\\nMétier : ' + v('metier') + '\\nAdresse : ' + v('ville') + '\\nNom : ' + v('nom') + '\\nTéléphone : ' + v('tel')
    + (v('message') ? '\\n\\n' + v('message') : '') + '\\n';
  location.href = 'mailto:${MAIL}?subject=' + encodeURIComponent('Maquette gratuite — ' + v('entreprise')) + '&body=' + encodeURIComponent(corps);
});
</script>
</body>
</html>
`;
}

// ── Écriture ──────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'com', 'index.html'), page(HUB));
for (const p of PROFESSIONS) fs.writeFileSync(path.join(ROOT, 'com', `${p.slug}.html`), page(p));
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sitemap-com.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[''].concat(PROFESSIONS.map((p) => p.slug)).map((s) => `  <url><loc>${url(s)}</loc><lastmod>${today}</lastmod><priority>${s ? '0.8' : '1.0'}</priority></url>`).join('\n')}
  <url><loc>${BASE}/mentions-legales</loc><lastmod>${today}</lastmod><priority>0.2</priority></url>
</urlset>
`);
console.log(`com/index.html + ${PROFESSIONS.length} pages métier + sitemap-com.xml`);
