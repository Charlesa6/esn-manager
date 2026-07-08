'use strict';
/* ════════════════════════════════════════════════════════════
   LOGS D'ACTIVITÉ
════════════════════════════════════════════════════════════ */
function logActivity(action,entityType,entityId,details){
  if(!S.activityLog)S.activityLog=[];
  var entry={id:uid(),user_email:S._userEmail||'',user_name:(S.profileFirstName||'')+(S.profileLastName?' '+S.profileLastName:''),user_role:rLabel(S.role||''),action:action,entity_type:entityType||'',entity_id:entityId||'',details:details||'',created_at:new Date().toISOString()};
  S.activityLog.unshift(entry);
  if(S.activityLog.length>200)S.activityLog.pop();
  if(sb&&SB_CID){sb.from('activity_logs').insert(Object.assign({},entry,{company_id:SB_CID})).then(function(){});}
}
async function loadActivityLog(){
  if(!S.activityLog)S.activityLog=[];
  if(!sb||!SB_CID)return;
  try{var r=await sb.from('activity_logs').select('*').eq('company_id',SB_CID).order('created_at',{ascending:false}).limit(300);if(r.data)S.activityLog=r.data;}catch(e){console.warn('activity_log:',e);}
}
function markOnboardingDone(){localStorage.setItem('konsilys_ob_'+S._userEmail,'1');S.modal=null;render();}
function restartOnboarding(){localStorage.removeItem('konsilys_ob_'+S._userEmail);S.modal={type:'onboarding',step:0};render();}
function checkOnboarding(){var key='konsilys_ob_'+S._userEmail;if(!S._userEmail||localStorage.getItem(key))return;S.modal={type:'onboarding',step:0};render();}

/* ════════════════════════════════════════════════════════════
   ONGLET AIDE + ONBOARDING
════════════════════════════════════════════════════════════ */
var HELP_FEATURES=[
  {
    icon:'\uD83D\uDCC8',title:'KPIs & Pilotage',roles:['super_admin','admin','gestionnaire'],
    desc:'Tableau de bord analytique en temps r\u00e9el pour piloter la performance de votre \u00e9quipe.',
    details:[
      '\uD83D\uDCCA <strong>4 indicateurs cl\u00e9s</strong> : taux de staffing (% de jours factur\u00e9s vs jours ouvrables), CA total factur\u00e9, TJM moyen pond\u00e9r\u00e9, et contribution nette (CA \u2212 co\u00fbts employeur).',
      '\uD83D\uDD0D <strong>3 niveaux de d\u00e9tail</strong> : vue par Consultant (tri par n\'importe quel indicateur), vue par Gestionnaire (lignes d\u00e9pliables pour voir les consultants), vue VP (3 niveaux hi\u00e9rarchiques).',
      '\uD83D\uDCC5 <strong>Filtrage temporel</strong> : exercice fiscal complet ou trimestre (Q1/Q2/Q3/Q4). Le d\u00e9marrage de l\'exercice est configurable dans Param\u00e8tres (ex. octobre pour un FY Oct-Sept).',
      '\u26A0\uFE0F <strong>Alertes automatiques</strong> : les consultants sous 80% de taux d\'utilisation apparaissent en orange dans les Pr\u00e9conisations.',
      '\uD83E\uDDEE <strong>Calcul du SCR</strong> : co\u00fbt journalier = SCR \u00d7 113,35 (jours ouvrables annuels) \u00d7 1,25 (charges patronales). La marge = (TJM \u2212 co\u00fbt) / TJM.',
    ]
  },
  {
    icon:'\uD83D\uDCCA',title:'Tableau de bord',roles:['super_admin','admin','gestionnaire','utilisateur'],
    desc:'Vue op\u00e9rationnelle quotidienne : tout ce qui n\u00e9cessite une action ou une attention imm\u00e9diate.',
    details:[
      '\uD83D\uDFE1 <strong>Inter-contrat</strong> : liste des consultants sans mission active aujourd\'hui (ni absence en cours). Utile pour lancer le staffing imm\u00e9diatement.',
      '\u23F0 <strong>Fins de mission imminentes</strong> : consultants dont la mission se termine dans moins de 14 jours, tri\u00e9s par urgence. Permet d\'anticiper le renouvellement ou le re-staffing.',
      '\uD83D\uDC4B <strong>Arriv\u00e9es</strong> : nouveaux consultants dont la date d\'arriv\u00e9e est dans les 14 prochains jours. Pour pr\u00e9parer l\'int\u00e9gration.',
      '\uD83C\uDFE0 <strong>Retours de cong\u00e9</strong> : consultants en absence se terminant dans les 7 prochains jours.',
      '\uD83D\uDD14 <strong>Approbations en attente</strong> (Gestionnaire) : toutes les demandes de modification soumises par les Utilisateurs, directement actionnables depuis le dashboard.',
    ]
  },
  {
    icon:'\uD83D\uDC65',title:'\u00c9quipe',roles:['super_admin','admin','gestionnaire'],
    desc:'Gestion compl\u00e8te des fiches collaborateurs de votre p\u00e9rim\u00e8tre.',
    details:[
      '\uD83D\uDCDD <strong>Fiche collaborateur</strong> : nom, grade (Junior/Confirm\u00e9/S\u00e9nior/Manager/Business Manager), type de contrat (Salari\u00e9 ou Freelance), SCR journalier, email, Gestionnaire rattach\u00e9, dates d\'arriv\u00e9e et de d\u00e9part.',
      '\uD83D\uDCBC <strong>Expertises & Secteurs</strong> : tags s\u00e9lectionnables depuis une liste pr\u00e9d\u00e9finie ou cr\u00e9\u00e9s librement. Permettent de filtrer l\'\u00e9quipe par comp\u00e9tence lors du staffing.',
      '\uD83D\uDCB0 <strong>Calcul automatique</strong> : d\u00e8s la saisie du SCR, le co\u00fbt journalier employeur s\'affiche (SCR \u00d7 113,35 \u00d7 1,25 pour salari\u00e9, SCR direct pour freelance).',
      '\uD83D\uDD0E <strong>Filtres</strong> : recherche par nom, filtres Gestionnaire, expertise, secteur. Pagination automatique.',
      '\uD83D\uDE80 <strong>Invitation</strong> : depuis Gestion des acc\u00e8s, invitez un Utilisateur par email. Il cr\u00e9e son compte sur konsilys.fr et est rattach\u00e9 automatiquement \u00e0 sa fiche consultant.',
    ]
  },
  {
    icon:'\uD83D\uDCCB',title:'Missions',roles:['super_admin','admin','gestionnaire','utilisateur'],
    desc:'Cr\u00e9ation et suivi de toutes les missions, en AT ou au Forfait.',
    details:[
      '\uD83D\uDCB5 <strong>Mission AT (Assistance Technique)</strong> : TJM factur\u00e9 \u00d7 jours travaill\u00e9s. D\u00e9finissez les jours de la semaine (Lun/Mar/Mer/Jeu/Ven), le client, les dates. Le CA et la marge sont calcul\u00e9s automatiquement.',
      '\uD83D\uDCC1 <strong>Mission Forfait</strong> : montant fixe du deal + marge cible. Le nombre de jours restants \u00e0 travailler est calcul\u00e9 automatiquement : jours = deal / (SCR \u00d7 1,25 / (1 \u2212 marge)). Supporte plusieurs consultants.',
      '\uD83D\uDCCA <strong>Vue synth\u00e8se</strong> : liste toutes les missions avec mission active/ferm\u00e9e, client, TJM, dates, marge r\u00e9elle. Filtre par Gestionnaire, consultant, statut.',
      '\uD83D\uDCE5 <strong>Import en masse</strong> : import CSV avec mappage colonne par colonne. Permet de migrer un historique Excel existant.',
      '\uD83D\uDC64 <strong>Utilisateur</strong> : voit uniquement ses missions. Peut soumettre une demande de modification (TJM, dates) qui sera valid\u00e9e par son Gestionnaire.',
    ]
  },
  {
    icon:'\uD83D\uDCC5',title:'Planning',roles:['super_admin','admin','gestionnaire','utilisateur','recruteur','sales'],
    desc:'Vue Gantt mensuelle de toutes les missions et absences de votre \u00e9quipe.',
    details:[
      '\uD83D\uDDFD <strong>Gantt par consultant</strong> : chaque ligne = un collaborateur, chaque cellule = un jour. Couleurs diff\u00e9rentes par mission, absences sur fond rouge.',
      '\u23ED <strong>Navigation temporelle</strong> : navigation mois par mois, retour au mois courant en un clic.',
      '\uD83D\uDCF1 <strong>Cl\u00e9s de lecture</strong> : les jours non travaill\u00e9s selon le planning (ex. pas de mercredi pour une mission 4j/sem) s\'affichent en gris clair. Les f\u00e9ri\u00e9s en jaune.',
      '\uD83D\uDD0D <strong>Clic sur un jour</strong> : ouvre un r\u00e9capitulatif avec le d\u00e9tail de la mission ou de l\'absence. Permet \u00e9galement de cr\u00e9er une absence directement sur ce jour.',
      '\u26A0\uFE0F <strong>Inter-contrat mis en \u00e9vidence</strong> : les p\u00e9riodes sans mission ni absence apparaissent clairement pour identifier les disponibilit\u00e9s.',
    ]
  },
  {
    icon:'\uD83C\uDFD6\uFE0F',title:'Absences & Cong\u00e9s',roles:['super_admin','admin','gestionnaire','utilisateur','recruteur','sales'],
    desc:'Gestion de tous les types d\'absences avec workflow d\'approbation selon le r\u00f4le.',
    details:[
      '\uD83D\uDDC2\uFE0F <strong>9 types d\'absences</strong> : Cong\u00e9 pay\u00e9, Maladie, Cong\u00e9 maternit\u00e9/paternit\u00e9, Sans solde, Forma\u00adtion, Mission interne, Inter-contrat, RTT, Cong\u00e9 exceptionnel. Mission interne et Inter-contrat sont marqu\u00e9s "non factur\u00e9" dans les KPIs.',
      '\uD83D\uDD04 <strong>Workflows diff\u00e9renci\u00e9s</strong> : Utilisateur → soumet au Gestionnaire. Recruteur → soumet au Super Admin. Business Manager → soumet au Gestionnaire. Les autres r\u00f4les valident directement.',
      '\uD83D\uDCCA <strong>Impact KPIs</strong> : les absences sont d\u00e9duites automatiquement du taux de staffing et des jours facturables.',
      '\uD83D\uDC40 <strong>Visibilit\u00e9</strong> : un Gestionnaire voit toutes les absences de son \u00e9quipe. Un Utilisateur ne voit que les siennes. Elles s\'affichent sur le Planning en rouge.',
      '\uD83D\uDD12 <strong>S\u00e9curit\u00e9</strong> : impossible de cr\u00e9er une absence sur une p\u00e9riode d\u00e9j\u00e0 couverte par une autre. Le syst\u00e8me d\u00e9tecte les chevauchements.',
    ]
  },
  {
    icon:'\uD83C\uDFAF',title:'Recrutement',roles:['super_admin','admin','gestionnaire','utilisateur','recruteur'],
    isModule:true,
    desc:'MODULE. Pipeline de recrutement complet, du premier contact jusqu\'\u00e0 l\'int\u00e9gration dans l\'\u00e9quipe.',
    details:[
      '\uD83D\uDCC1 <strong>8 statuts par d\u00e9faut</strong> (personnalisables) : RH \u00e0 voir, RH en cours, Ops \u00e0 voir, Ops en cours, Nogo candidat, Nogo, En pipeline, Recrut\u00e9. Les statuts sont enti\u00e8rement reconfigurables par le Super Admin dans Param\u00e8tres.',
      '\uD83D\uDC64 <strong>Fiche candidat</strong> : nom, grade (s\u00e9lecteur unifi\u00e9), statut, recruteur assign\u00e9, salaire souhait\u00e9, marge cible, SCR calcul\u00e9, TJM estim\u00e9, expertises, secteurs, localisations pr\u00e9f\u00e9r\u00e9es.',
      '\uD83D\uDCC8 <strong>Calcul automatique</strong> : \u00e0 partir du salaire brut souhait\u00e9, le syst\u00e8me calcule le SCR journalier et le TJM recommand\u00e9 selon la marge cible.',
      '\uD83D\uDD0D <strong>Filtres puissants</strong> : par statut (pills en haut), par recruteur assign\u00e9, par recherche textuelle libre. Les recruteurs ne voient que leurs propres candidats.',
      '\uD83D\uDE80 <strong>Conversion automatique</strong> : quand un candidat passe en "Recrut\u00e9", il peut \u00eatre converti en Utilisateur en un clic : saisie du Gestionnaire, date de d\u00e9marrage, grade. La fiche consultant est cr\u00e9\u00e9e automatiquement.',
    ]
  },
  {
    icon:'\uD83D\uDCBC',title:'Business D\u00e9veloppement',roles:['super_admin','admin','gestionnaire','utilisateur','sales'],
    isModule:true,
    desc:'MODULE. CRM complet pour le d\u00e9veloppement commercial de votre ESN.',
    details:[
      '\uD83C\uDFE2 <strong>Comptes</strong> : base clients et prospects. Statut (actif/prospect/inactif), secteur d\'activit\u00e9, taille entreprise, adresse. Chaque compte est li\u00e9 \u00e0 ses contacts et opportunit\u00e9s.',
      '\uD83D\uDC65 <strong>Contacts</strong> : annuaire des interlocuteurs par compte. Nom, poste, t\u00e9l\u00e9phone, email, notes.',
      '\uD83D\uDCB0 <strong>Pipeline Opportunit\u00e9s</strong> : cr\u00e9ez une opportunit\u00e9 en AT (TJM + jours + dates) ou Forfait (montant du deal). Assignez les consultants pr\u00e9sent\u00e9s avec leurs jours de staffing et marge cible. La r\u00e9partition du CA entre consultants est calcul\u00e9e automatiquement (SCR \u00d7 jours).',
      '\uD83C\uDFAF <strong>Opportunit\u00e9 Gagn\u00e9e → Mission</strong> : quand une opportunit\u00e9 passe en "Gagn\u00e9", cliquez "→ Mission". La mission est cr\u00e9\u00e9e automatiquement dans l\'onglet Missions avec le TJM calcul\u00e9, les jours de staffing et la marge par consultant.',
      '\uD83D\uDCCA <strong>KPIs commerciaux</strong> : CA pipeline pond\u00e9r\u00e9 par probabilit\u00e9, taux de conversion par commercial, activit\u00e9s (appels/RDV/propositions) par compte.',
    ]
  },
  {
    icon:'\uD83D\uDD14',title:'Approbations',roles:['super_admin','admin','gestionnaire','utilisateur','recruteur','sales'],
    desc:'Workflow de validation pour toutes les demandes de modification.',
    details:[
      '\uD83D\uDCE4 <strong>Qui soumet ?</strong> Utilisateur (missions + absences), Recruteur (absences), Business Manager (absences).',
      '\uD83D\uDCE5 <strong>Qui valide ?</strong> Gestionnaire pour les Utilisateurs et Recruteurs. Super Admin pour les Business Managers.',
      '\uD83D\uDEA6 <strong>Types de demandes</strong> : ajout de mission, modification de mission (TJM, dates, type), suppression de mission, ajout d\'absence, modification d\'absence, suppression d\'absence.',
      '\u2705 <strong>Validation</strong> : le validateur voit le d\u00e9tail de la demande et peut Approuver ou Refuser avec motif. En cas de refus, l\'utilisateur re\u00e7oit le motif dans son onglet Approbations.',
      '\uD83D\uDD14 <strong>Notification visuelle</strong> : un badge num\u00e9rique dans la navigation indique le nombre d\'approbations en attente.',
    ]
  },
  {
    icon:'\uD83D\uDCA1',title:'Pr\u00e9conisations',roles:['super_admin','admin','gestionnaire'],
    desc:'Recommandations personnalis\u00e9es g\u00e9n\u00e9r\u00e9es automatiquement \u00e0 partir de vos KPIs.',
    details:[
      '\uD83D\uDE80 <strong>Diversification client</strong> : alerte si un client repr\u00e9sente plus de 30% du CA. Recommandation de cibles dans les secteurs compl\u00e9mentaires.',
      '\uD83D\uDCC8 <strong>Taux d\'utilisation</strong> : identifie les consultants sous 80% et sugg\u00e8re une action imm\u00e9diate (relancer le pipeline, mission interne).',
      '\uD83D\uDCB0 <strong>Optimisation tarifaire</strong> : compare le TJM de chaque consultant \u00e0 la moyenne \u00e9quipe. Calcule le gain potentiel d\'une hausse de 5% sur l\'exercice.',
      '\uD83D\uDCC5 <strong>Anticipation inter-contrats</strong> : liste les consultants dont la mission se termine dans moins de 30 jours sans suite identifi\u00e9e. Priorit\u00e9 d\'action.',
      '\uD83D\uDD04 <strong>Mise \u00e0 jour automatique</strong> : les pr\u00e9conisations se recalculent \u00e0 chaque saisie. Elles sont filtr\u00e9es par exercice fiscal et trimestre.',
    ]
  },
  {
    icon:'\u2699',title:'Param\u00e8tres',roles:['super_admin'],
    desc:'Configuration g\u00e9n\u00e9rale de votre espace Konsilys.',
    details:[
      '\uD83D\uDCB1 <strong>Devise</strong> : EUR, USD, GBP, CHF, CAD, JPY. Le symbole s\'adapte partout dans l\'application.',
      '\uD83D\uDCC5 <strong>Exercice fiscal</strong> : choisissez le mois de d\u00e9marrage (janvier pour un FY calendaire, octobre pour un FY Oct-Sept). Les trimestres et le filtre "ann\u00e9e" s\'adaptent automatiquement.',
      '\uD83C\uDFF7\uFE0F <strong>Noms des r\u00f4les</strong> : renommez chaque r\u00f4le (ex. "Gestionnaire" → "Directeur de P\u00f4le", "Admin" → "Directeur R\u00e9gional"). Les noms s\'affichent partout dans l\'application.',
      '\uD83D\uDCCB <strong>Statuts recrutement</strong> : ajoutez, supprimez ou renommez les statuts du pipeline recrutement. Les candidats existants gardent leur statut.',
      '\uD83D\uDD27 <strong>Modules</strong> : visualisez l\'\u00e9tat des modules Recrutement et Business D\u00e9veloppement. L\'activation se fait par votre interlocuteur Konsilys.',
    ]
  },
];

var ONBOARDING_STEPS={
  'super_admin':[
    {icon:'\uD83D\uDC4B',title:'Bienvenue, Super Admin !',desc:'Vous avez le contr\u00f4le total de Konsilys pour votre organisation. Voici les premi\u00e8res \u00e9tapes cl\u00e9s.'},
    {icon:'\u2699',title:'Configurez votre espace',desc:'Commencez par les Param\u00e8tres (\u274F sidebar) : d\u00e9finissez votre devise, le mois de d\u00e9marrage de votre exercice fiscal, et personnalisez les noms des r\u00f4les si besoin.'},
    {icon:'\uD83D\uDD11',title:'Invitez votre \u00e9quipe',desc:'Dans Gestion des acc\u00e8s, invitez vos Admins et Recruteurs par email. Ils s\'inscrivent sur konsilys.fr et sont rattach\u00e9s automatiquement.'},
    {icon:'\uD83D\uDC65',title:'Ajoutez vos collaborateurs',desc:'Dans l\'onglet \u00c9quipe, ajoutez chaque consultant avec son SCR journalier. Le syst\u00e8me calcule automatiquement les co\u00fbts et marges.'},
    {icon:'\uD83C\uDF89',title:'Vous \u00eates pr\u00eat !',desc:'Explorez les KPIs, le Dashboard et les Pr\u00e9conisations. Tout se met \u00e0 jour automatiquement au fil des saisies.'},
  ],
  'admin':[
    {icon:'\uD83D\uDC4B',title:'Bienvenue, Admin !',desc:'Vous supervisez plusieurs \u00e9quipes de Gestionnaires. Voici comment d\u00e9marrer.'},
    {icon:'\uD83D\uDD11',title:'Invitez vos Gestionnaires',desc:'Dans Gestion des acc\u00e8s, invitez vos Gestionnaires par email. Ils g\u00e8rent ensuite leurs \u00e9quipes de fa\u00e7on autonome.'},
    {icon:'\uD83D\uDCC8',title:'Suivez les KPIs globaux',desc:'Le tableau de bord vous donne une vue agr\u00e9g\u00e9e de toutes les \u00e9quipes sous votre p\u00e9rim\u00e8tre.'},
    {icon:'\uD83C\uDF89',title:'Vous \u00eates pr\u00eat !',desc:'Explorez les KPIs par Gestionnaire et le planning global.'},
  ],
  'gestionnaire':[
    {icon:'\uD83D\uDC4B',title:'Bienvenue, Gestionnaire !',desc:'Vous g\u00e9rez une \u00e9quipe de consultants. Voici les premi\u00e8res actions.'},
    {icon:'\uD83D\uDC65',title:'Ajoutez votre \u00e9quipe',desc:'Dans l\'onglet \u00c9quipe, ajoutez vos consultants avec leur SCR et leurs expertises.'},
    {icon:'\uD83D\uDCCB',title:'Saisissez les missions',desc:'Pour chaque consultant en mission, cr\u00e9ez la mission avec le TJM et les dates. Le CA et la marge se calculent automatiquement.'},
    {icon:'\uD83D\uDD14',title:'Validez les demandes',desc:'Vos consultants soumettent des modifications depuis leur espace. Approuvez ou refusez depuis le Dashboard.'},
    {icon:'\uD83C\uDF89',title:'Vous \u00eates pr\u00eat !',desc:'Consultez les KPIs en temps r\u00e9el et les pr\u00e9conisations personnalis\u00e9es.'},
  ],
  'utilisateur':[
    {icon:'\uD83D\uDC4B',title:'Bienvenue !',desc:'Votre espace vous permet de suivre vos missions et de g\u00e9rer vos absences.'},
    {icon:'\uD83D\uDCCB',title:'Vos missions',desc:'Retrouvez toutes vos missions en cours dans l\'onglet Missions. Vos TJM et contributions sont pr\u00e9-remplis par votre Gestionnaire.'},
    {icon:'\uD83C\uDFD6\uFE0F',title:'Absences & cong\u00e9s',desc:'D\u00e9clarez vos absences dans l\'onglet Absences. Elles sont soumises \u00e0 votre Gestionnaire pour validation.'},
    {icon:'\uD83C\uDF89',title:'Vous \u00eates pr\u00eat !',desc:''},
  ],
  'recruteur':[
    {icon:'\uD83D\uDC4B',title:'Bienvenue, Recruteur !',desc:'Votre espace est d\u00e9di\u00e9 au pipeline de recrutement.'},
    {icon:'\uD83C\uDFAF',title:'G\u00e9rez les candidats',desc:'Ajoutez les candidats, suivez leur progression dans les 8 statuts, et assignez-vous comme recruteur responsable.'},
    {icon:'\uD83C\uDF89',title:'Vous \u00eates pr\u00eat !',desc:'Une fois recrut\u00e9, le candidat peut \u00eatre converti en Utilisateur directement depuis sa fiche.'},
  ],
  'sales':[
    {icon:'\uD83D\uDC4B',title:'Bienvenue, Business Manager !',desc:'Votre espace est centr\u00e9 sur le d\u00e9veloppement commercial.'},
    {icon:'\uD83D\uDCBC',title:'G\u00e9rez votre pipeline',desc:'Ajoutez vos opportunit\u00e9s, suivez les statuts (Identification → Qualification → Proposition → Gagnée), assignez des consultants.'},
    {icon:'\uD83C\uDF89',title:'Vous \u00eates pr\u00eat !',desc:'Quand une opportunit\u00e9 passe en Gagn\u00e9e, cliquez "→ Mission" pour cr\u00e9er automatiquement la mission.'},
  ],
};

/* ════════ TUTORIELS VISUELS ════════ */
var TUTORIALS={

'recrutement':{
  title:'Recrutement — De la candidature à l\'intégration',
  color:'#0F766E',
  steps:[
    {
      title:'Ouvrez le pipeline de recrutement',
      desc:'Dans la barre de navigation à gauche, cliquez sur l\'onglet <strong>🎯 Recrutement</strong>. Vous verrez le pipeline avec les candidats organisés par statut.',
      svg:function(){return tut_svg_nav('recrutement','#0F766E');}
    },
    {
      title:'Créez un nouveau candidat',
      desc:'Cliquez sur le bouton <strong>+ Candidat</strong> en haut à droite. Un formulaire s\'ouvre.',
      svg:function(){return tut_svg_btn('+ Candidat','#0F766E','Recrutement — Pipeline','Tous les statuts');}
    },
    {
      title:'Remplissez la fiche candidat',
      desc:'Saisissez le <strong>Nom complet</strong>, sélectionnez le <strong>Grade</strong> (Consultant Junior, Confirmé, Sénior, Manager ou Business Manager), renseignez le <strong>Salaire brut souhaité</strong> en €/an. Le SCR et le TJM estimé se calculent automatiquement.',
      svg:function(){return tut_svg_form(['Nom complet *','Grade','Statut','Salaire brut (€/an)','Marge cible (%)'],['Sophie Martin','Consultant Confirmé','RH à voir','45 000','25']);}
    },
    {
      title:'Faites progresser le candidat dans le pipeline',
      desc:'Depuis la fiche candidat, changez le <strong>Statut</strong> via la liste déroulante. Les statuts par défaut sont : RH à voir → RH en cours → Ops à voir → Ops en cours → En pipeline → Recruté (ou Nogo candidat / Nogo pour clôturer négativement).',
      svg:function(){return tut_svg_status(['RH à voir','RH en cours','Ops à voir','Ops en cours','En pipeline','Recruté'],'Ops en cours','#0F766E');}
    },
    {
      title:'Convertissez en Utilisateur',
      desc:'Quand le candidat est en statut <strong>Recruté</strong>, un bouton <strong>"→ Intégrer dans l\'équipe"</strong> apparaît. Cliquez dessus. Renseignez : le Gestionnaire rattaché, le Grade, et la date de démarrage. La fiche consultant est créée automatiquement dans l\'onglet Équipe.',
      svg:function(){return tut_svg_convert('Sophie Martin','Recruté','→ Intégrer dans l\'équipe','#0F766E');}
    },
    {
      title:'Le consultant est dans l\'équipe !',
      desc:'Sophie Martin apparaît maintenant dans l\'onglet <strong>Équipe</strong> avec son SCR, ses expertises et son grade. Son compte utilisateur sera actif dès sa première connexion sur konsilys.fr avec l\'email renseigné.',
      svg:function(){return tut_svg_team_card('Sophie Martin','Consultant Confirmé','450 €/j','#0F766E');}
    },
  ]
},

'business':{
  title:'Business Développement — Du prospect à la mission',
  color:'#1e40af',
  steps:[
    {
      title:'Ouvrez le module Business',
      desc:'Dans la navigation, cliquez sur <strong>💼 Business</strong>. Vous accédez au CRM avec 5 sous-onglets : Pipeline, Comptes, Contacts, Activités, KPIs.',
      svg:function(){return tut_svg_nav('business','#1e40af');}
    },
    {
      title:'Créez un Compte (client/prospect)',
      desc:'Cliquez sur le sous-onglet <strong>Comptes</strong> puis <strong>+ Compte</strong>. Renseignez : nom de l\'entreprise, statut (Prospect / Client actif / Inactif), secteur d\'activité, taille.',
      svg:function(){return tut_svg_btn('+ Compte','#1e40af','Business — Comptes','Aucun compte. Cliquez "+ Compte" pour commencer.');}
    },
    {
      title:'Ajoutez un Contact',
      desc:'Dans le sous-onglet <strong>Contacts</strong>, cliquez <strong>+ Contact</strong>. Liez le contact à un compte existant. Renseignez : nom, poste (ex. DSI, DRH), téléphone, email.',
      svg:function(){return tut_svg_form(['Nom *','Poste','Compte','Email','Téléphone'],['Marie Dupont','DSI','BNP Paribas','m.dupont@bnp.fr','06 12 34 56 78']);}
    },
    {
      title:'Créez une Opportunité AT',
      desc:'Dans <strong>Pipeline</strong>, cliquez <strong>+ Opportunité</strong>. Choisissez le type <strong>AT (Assistance Technique)</strong>. Renseignez : nom, compte, contact, TJM cible, jours estimés, date de démarrage et de fin, consultant(s) présenté(s).',
      svg:function(){return tut_svg_opp_form('at','#1e40af');}
    },
    {
      title:'Ou créez une Opportunité Forfait',
      desc:'Choisissez le type <strong>Forfait</strong>. Renseignez le montant du deal, la date de démarrage. Dans le <strong>team builder</strong>, ajoutez chaque consultant, cochez leurs jours de staffing (Lun/Mar/Mer...) et définissez leur marge cible. La répartition du CA se calcule automatiquement selon SCR × jours.',
      svg:function(){return tut_svg_opp_forfait('Louis Bernard',420,'Forfait','#1e40af');}
    },
    {
      title:'Faites progresser l\'opportunité',
      desc:'Modifiez le <strong>Statut</strong> au fil des étapes : Identification → Qualification → Proposition → Négociation → <strong>Gagnée</strong> (ou Perdue). Ajustez la probabilité (%) pour pondérer le CA dans les KPIs.',
      svg:function(){return tut_svg_status(['Identification','Qualification','Proposition','Négociation','Gagnée'],'Proposition','#1e40af');}
    },
    {
      title:'Opportunité Gagnée → Mission créée automatiquement',
      desc:'Quand l\'opportunité passe en <strong>Gagnée</strong>, un bouton <strong>"→ Mission"</strong> apparaît. Cliquez dessus. Une (ou plusieurs) mission(s) est créée dans l\'onglet Missions avec le TJM calculé, les jours de staffing et la marge par consultant.',
      svg:function(){return tut_svg_convert('Refonte SI BNP','Gagnée','→ Mission','#1e40af');}
    },
  ]
},

'missions':{
  title:'Missions — AT et Forfait',
  color:'#7c3aed',
  steps:[
    {
      title:'Ouvrez l\'onglet Missions',
      desc:'Cliquez sur <strong>📋 Missions</strong> dans la navigation. Vous voyez toutes les missions de votre équipe avec leur TJM, client, statut et dates.',
      svg:function(){return tut_svg_nav('missions','#7c3aed');}
    },
    {
      title:'Créez une mission AT',
      desc:'Cliquez sur <strong>+ Mission</strong>. Choisissez <strong>Assistance Technique</strong>. Renseignez : consultant, nom de mission, client, TJM facturé, cochez les jours/semaine (Lun à Ven), date de démarrage. La marge s\'affiche en temps réel.',
      svg:function(){return tut_svg_form(['Consultant *','Nom de la mission *','Client *','TJM facturé (€)','Date de démarrage *'],['Jean Dupont','Transformation SI','BNP Paribas','750','2025-02-01']);}
    },
    {
      title:'Créez une mission Forfait',
      desc:'Pour un Forfait, sélectionnez ce type. Renseignez le <strong>Montant du deal (CA)</strong> et la <strong>Marge cible</strong>. Le nombre de jours restants à travailler est calculé automatiquement : jours = deal ÷ (SCR × 1,25 ÷ (1 − marge)).',
      svg:function(){return tut_svg_forfait_calc(120000,30,450,'#7c3aed');}
    },
    {
      title:'Suivi des jours travaillés',
      desc:'Dans chaque mission, le <strong>calendrier des jours travaillés</strong> permet de cocher manuellement les jours ou de laisser le système calculer automatiquement selon les jours de la semaine configurés. Le CA est mis à jour en temps réel.',
      svg:function(){return tut_svg_calendar('2025-02','#7c3aed');}
    },
  ]
},

'kpis':{
  title:'KPIs — Piloter la performance',
  color:'#b45309',
  steps:[
    {
      title:'Accédez aux KPIs',
      desc:'Cliquez sur <strong>📈 KPIs</strong>. Trois niveaux s\'affichent : par Consultant, par Gestionnaire (avec équipes dépliables), et par VP (3 niveaux hiérarchiques).',
      svg:function(){return tut_svg_nav('kpis','#b45309');}
    },
    {
      title:'Filtrez par période',
      desc:'En haut à gauche de la sidebar, sélectionnez l\'<strong>exercice fiscal</strong> (année) puis un trimestre : <strong>Q1 / Q2 / Q3 / Q4</strong> ou "Année" pour voir la totalité. Le démarrage de l\'exercice est configurable dans Paramètres.',
      svg:function(){return tut_svg_fy_filter('2024-2025','#b45309');}
    },
    {
      title:'Comprendre les 4 indicateurs clés',
      desc:'Pour chaque consultant : <strong>Staffing</strong> (% jours facturés / jours ouvrables), <strong>CA</strong> (TJM × jours facturés), <strong>TJM moyen</strong>, <strong>Contribution nette</strong> (CA − coût employeur). En orange si staffing < 80%.',
      svg:function(){return tut_svg_kpi_row('Jean Dupont','87%','52 500 €','750 €','14 200 €','#b45309');}
    },
  ]
},

'absences':{
  title:'Absences & Congés',
  color:'#b91c1c',
  steps:[
    {
      title:'Déclarez une absence (Utilisateur)',
      desc:'Cliquez sur <strong>🏖️ Absences</strong> puis <strong>+ Absence</strong>. Choisissez le type (Congé payé, Maladie, RTT...), les dates de début et de fin. La demande est soumise automatiquement à votre Gestionnaire.',
      svg:function(){return tut_svg_form(['Type d\'absence *','Date de début *','Date de fin *'],[' Congé payé','2025-07-14','2025-07-25']);}
    },
    {
      title:'Validez une absence (Gestionnaire)',
      desc:'Dans le <strong>Dashboard</strong>, la section <strong>🔔 Approbations en attente</strong> affiche les demandes d\'absence de votre équipe. Cliquez <strong>✓ Approuver</strong> ou <strong>✗ Refuser</strong> avec un motif.',
      svg:function(){return tut_svg_approval('Jean Dupont','Congé payé 14/07 → 25/07','#b91c1c');}
    },
  ]
},

'dashboard':{
  title:'Tableau de bord — Vue opérationnelle',
  color:'#0f172a',
  steps:[
    {
      title:'Le Dashboard en un coup d\'œil',
      desc:'Le Dashboard centralise tout ce qui nécessite votre attention immédiate. Il se met à jour automatiquement à chaque saisie.',
      svg:function(){return tut_svg_dashboard_overview('# b45309');}
    },
    {
      title:'Identifiez les consultants en inter-contrat',
      desc:'La section <strong>Inter-contrat</strong> liste les consultants sans mission active aujourd\'hui (hors absences). C\'est la première priorité de staffing. Cliquez sur un consultant pour voir son profil.',
      svg:function(){return tut_svg_dashboard_section('Inter-contrat','Martin Paul — disponible depuis 3j','#b45309');}
    },
    {
      title:'Anticipez les fins de mission',
      desc:'La section <strong>Fins de mission imminentes</strong> affiche les missions qui se terminent dans moins de 14 jours. En rouge = moins de 7 jours. Action recommandée : lancer le re-staffing maintenant.',
      svg:function(){return tut_svg_dashboard_section('Fins de mission','Sophie M. — Mission BNP dans 5j','#dc2626');}
    },
  ]
}
};

/* ════ Fonctions de rendu SVG pour tutoriels ════ */
function tut_color_light(hex){
  /* version très claire d\'une couleur pour les fonds */
  return hex+'18';
}

function tut_svg_nav(activeTab,color){
  var tabs=[
    {id:'kpis',ic:'📈',lb:'KPIs'},
    {id:'dashboard',ic:'📊',lb:'Dashboard'},
    {id:'teams',ic:'👥',lb:'Équipe'},
    {id:'missions',ic:'📋',lb:'Missions'},
    {id:'recrutement',ic:'🎯',lb:'Recrutement'},
    {id:'business',ic:'💼',lb:'Business'},
    {id:'help',ic:'❓',lb:'Aide'},
  ];
  var rows=tabs.map(function(t){
    var act=t.id===activeTab;
    return '<rect x="4" y="'+(10+tabs.indexOf(t)*26)+'" width="120" height="22" rx="5" fill="'+(act?color:'transparent')+'" opacity="'+(act?'1':'0.3')+'"/>'
      +'<text x="12" y="'+(25+tabs.indexOf(t)*26)+'" font-size="10" fill="'+(act?'#fff':'#94a3b8')+'">'+t.ic+' '+t.lb+'</text>'
      +(act?'<circle cx="125" cy="'+(21+tabs.indexOf(t)*26)+'" r="5" fill="'+color+'" class="tut-pulse"/>':'');
  }).join('');
  return '<svg viewBox="0 0 340 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#1B2B3A">'
    +'<rect width="340" height="200" rx="10" fill="#1B2B3A"/>'
    +'<rect x="0" y="0" width="132" height="200" rx="10" fill="#162030"/>'
    +'<text x="14" y="16" font-size="11" font-weight="bold" fill="#84CC16">Konsilys</text>'
    +rows
    +'<rect x="140" y="10" width="190" height="180" rx="8" fill="#f8fafc" opacity="0.9"/>'
    +'<text x="152" y="30" font-size="11" font-weight="bold" fill="#0f172a">Onglet '+activeTab+'</text>'
    +'<text x="152" y="48" font-size="9" fill="#64748b">Contenu de l\'onglet...</text>'
    +'<style>.tut-pulse{animation:pulse 1.2s ease-in-out infinite;} @keyframes pulse{0%,100%{r:5;opacity:1}50%{r:7;opacity:0.7}}</style>'
    +'</svg>';
}

function tut_svg_btn(btnLabel,color,tabTitle,emptyMsg){
  return '<svg viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#f8fafc">'
    +'<rect width="340" height="180" rx="10" fill="#f8fafc"/>'
    +'<rect x="10" y="10" width="320" height="38" rx="8" fill="#fff" stroke="#e2e8f0" stroke-width="1"/>'
    +'<text x="22" y="33" font-size="13" font-weight="bold" fill="#0f172a">'+tabTitle+'</text>'
    +'<rect x="230" y="16" width="90" height="26" rx="7" fill="'+color+'" class="tut-pulse"/>'
    +'<text x="248" y="33" font-size="10" font-weight="bold" fill="#fff">'+btnLabel+'</text>'
    +'<text x="20" y="75" font-size="10" fill="#94a3b8">'+emptyMsg+'</text>'
    +'<path d="M270 45 L270 65 L250 65" stroke="'+color+'" stroke-width="2" fill="none" stroke-dasharray="4" marker-end="url(#arr)"/>'
    +'<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="'+color+'"/></marker></defs>'
    +'<style>.tut-pulse{filter:drop-shadow(0 0 6px '+color+'80);animation:glow 1.4s ease-in-out infinite;} @keyframes glow{0%,100%{opacity:1}50%{opacity:0.7}}</style>'
    +'</svg>';
}

function tut_svg_form(fields,values){
  var rows=fields.map(function(f,i){
    var y=40+i*28;
    return '<text x="22" y="'+(y-2)+'" font-size="9" font-weight="600" fill="#64748b" text-transform="uppercase">'+f+'</text>'
      +'<rect x="20" y="'+y+'" width="300" height="20" rx="5" fill="'+(i===0?'#f0fdf4':'#fff')+'" stroke="'+(i===0?'#84CC16':'#e2e8f0')+'" stroke-width="'+(i===0?'1.5':'1')+'"/>'
      +'<text x="28" y="'+(y+14)+'" font-size="10" fill="#374151">'+values[i]+'</text>';
  }).join('');
  var h=50+fields.length*28+20;
  return '<svg viewBox="0 0 340 '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<rect width="340" height="'+h+'" rx="10" fill="#fff"/>'
    +'<rect x="0" y="0" width="340" height="28" rx="10" fill="#1B2B3A"/>'
    +'<rect x="0" y="18" width="340" height="10" fill="#1B2B3A"/>'
    +'<text x="14" y="19" font-size="11" font-weight="bold" fill="#fff">Formulaire</text>'
    +rows
    +'<rect x="90" y="'+(h-26)+'" width="160" height="20" rx="5" fill="#84CC16"/>'
    +'<text x="145" y="'+(h-12)+'" font-size="10" font-weight="bold" fill="#1B2B3A">Enregistrer</text>'
    +'</svg>';
}

function tut_svg_status(statuses,current,color){
  var rows=statuses.map(function(s,i){
    var act=s===current;
    return '<rect x="20" y="'+(30+i*26)+'" width="300" height="22" rx="5" fill="'+(act?color:'#f1f5f9')+'" stroke="'+(act?color:'#e2e8f0')+'" stroke-width="1"/>'
      +'<text x="30" y="'+(45+i*26)+'" font-size="10" fill="'+(act?'#fff':'#64748b')+'" font-weight="'+(act?'bold':'normal')+'">'+s+'</text>'
      +(act?'<text x="295" y="'+(45+i*26)+'" font-size="9" fill="#fff">✓</text>':'');
  }).join('');
  var h=50+statuses.length*26;
  return '<svg viewBox="0 0 340 '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<text x="14" y="20" font-size="11" font-weight="bold" fill="#0f172a">Statut</text>'
    +rows
    +'</svg>';
}

function tut_svg_convert(name,status,btnLabel,color){
  return '<svg viewBox="0 0 340 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<rect width="340" height="120" rx="10" fill="#fff"/>'
    +'<rect x="10" y="10" width="320" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>'
    +'<text x="22" y="32" font-size="13" font-weight="bold" fill="#0f172a">'+name+'</text>'
    +'<rect x="22" y="40" width="70" height="18" rx="9" fill="'+color+'30"/>'
    +'<text x="30" y="53" font-size="9" fill="'+color+'" font-weight="bold">'+status+'</text>'
    +'<rect x="190" y="38" width="130" height="22" rx="7" fill="'+color+'" class="tut-pulse"/>'
    +'<text x="198" y="53" font-size="9" font-weight="bold" fill="#fff">'+btnLabel+'</text>'
    +'<path d="M255 80 L255 100" stroke="'+color+'" stroke-width="2" stroke-dasharray="4" fill="none"/>'
    +'<text x="180" y="115" font-size="9" fill="'+color+'" font-weight="bold">Cliquez ici !</text>'
    +'<style>.tut-pulse{filter:drop-shadow(0 0 5px '+color+'90);animation:glow 1.4s ease-in-out infinite;} @keyframes glow{0%,100%{opacity:1}50%{opacity:0.6}}</style>'
    +'</svg>';
}

function tut_svg_opp_form(btype,color){
  var fields=btype==='at'
    ?[['Type','AT — Assistance Technique'],['TJM cible (€)','750'],['Jours estimés','45'],['Date démarrage','2025-02-01'],['Date fin','2025-07-31']]
    :[['Type','Forfait'],['Montant deal (€)','120 000'],['Date démarrage','2025-02-01']];
  var rows=fields.map(function(f,i){
    return '<text x="22" y="'+(45+i*30)+'" font-size="9" font-weight="600" fill="#64748b">'+f[0]+'</text>'
      +'<rect x="20" y="'+(50+i*30)+'" width="300" height="20" rx="5" fill="#fff" stroke="#e2e8f0"/>'
      +'<text x="28" y="'+(64+i*30)+'" font-size="10" fill="#374151">'+f[1]+'</text>';
  }).join('');
  var h=80+fields.length*30;
  return '<svg viewBox="0 0 340 '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0">'
    +'<rect x="0" y="0" width="340" height="30" rx="10" fill="'+color+'"/>'
    +'<rect x="0" y="20" width="340" height="10" fill="'+color+'"/>'
    +'<text x="14" y="20" font-size="11" font-weight="bold" fill="#fff">Nouvelle opportunité — '+btype.toUpperCase()+'</text>'
    +'<rect x="10" y="32" width="320" height="'+(h-42)+'" rx="8" fill="#fff" stroke="#e2e8f0"/>'
    +rows+'</svg>';
}

function tut_svg_opp_forfait(consName,scr,btype,color){
  return '<svg viewBox="0 0 340 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<text x="14" y="18" font-size="11" font-weight="bold" fill="#0f172a">Team builder Forfait</text>'
    +'<rect x="10" y="26" width="320" height="50" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>'
    +'<text x="20" y="44" font-size="10" font-weight="600" fill="#0f172a">'+consName+' · SCR '+scr+'€/j</text>'
    +'<rect x="20" y="50" width="90" height="18" rx="5" fill="'+color+'20" stroke="'+color+'" stroke-width="1"/>'
    +'<text x="28" y="63" font-size="9" fill="'+color+'">☑ Lun ☑ Mar ☐ Mer</text>'
    +'<text x="130" y="63" font-size="9" fill="#64748b">Marge</text>'
    +'<rect x="160" y="50" width="50" height="18" rx="5" fill="#fff" stroke="#e2e8f0"/>'
    +'<text x="168" y="63" font-size="10" fill="#374151">25%</text>'
    +'<text x="220" y="63" font-size="9" font-weight="bold" fill="#1B2B3A">≈ 32j</text>'
    +'<rect x="10" y="86" width="320" height="40" rx="8" fill="#f0fdf4" stroke="#84CC16"/>'
    +'<text x="20" y="102" font-size="10" font-weight="bold" fill="#0f172a">Synthèse</text>'
    +'<text x="20" y="116" font-size="9" fill="#15803d">'+consName+' — 100% du deal · 32j à facturer · Lun+Mar</text>'
    +'<rect x="10" y="136" width="150" height="18" rx="5" fill="#f0fdf4" stroke="#84CC16" stroke-dasharray="3"/>'
    +'<text x="20" y="149" font-size="9" fill="#15803d">+ Ajouter un membre</text>'
    +'</svg>';
}

function tut_svg_forfait_calc(deal,marge,scr,color){
  var tjm=Math.round(scr*113.35*1.25/(1-marge/100));
  var days=Math.round(deal/tjm);
  return '<svg viewBox="0 0 340 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<text x="14" y="20" font-size="11" font-weight="bold" fill="#0f172a">Calcul automatique — Mission Forfait</text>'
    +'<rect x="10" y="28" width="148" height="50" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>'
    +'<text x="20" y="44" font-size="9" fill="#64748b">Montant deal (CA)</text>'
    +'<text x="20" y="62" font-size="16" font-weight="bold" fill="'+color+'">'+deal.toLocaleString('fr-FR')+' €</text>'
    +'<rect x="164" y="28" width="166" height="50" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>'
    +'<text x="174" y="44" font-size="9" fill="#64748b">Marge cible</text>'
    +'<text x="174" y="62" font-size="16" font-weight="bold" fill="'+color+'">'+marge+'%</text>'
    +'<text x="152" y="62" font-size="18" fill="#94a3b8">÷</text>'
    +'<text x="14" y="98" font-size="9" fill="#64748b">SCR: '+scr+'€ · TJM calculé = '+tjm+'€</text>'
    +'<rect x="10" y="108" width="320" height="40" rx="8" fill="'+color+'15" stroke="'+color+'" stroke-width="1.5"/>'
    +'<text x="20" y="124" font-size="10" font-weight="bold" fill="#0f172a">Résultat automatique</text>'
    +'<text x="20" y="140" font-size="13" font-weight="bold" fill="'+color+'">'+days+' jours à travailler pour couvrir le forfait</text>'
    +'</svg>';
}

function tut_svg_calendar(ym,color){
  var jours=['L','M','M','J','V'];
  var cells=Array.from({length:20},function(_,i){
    var j=i%5;var sem=Math.floor(i/5);
    var worked=j<4&&sem<3;
    return '<rect x="'+(20+j*52)+'" y="'+(50+sem*30)+'" width="44" height="22" rx="4" fill="'+(worked?color+'25':'#f1f5f9')+'" stroke="'+(worked?color:'#e2e8f0')+'" stroke-width="'+(worked?'1.5':'0.5')+'"/>'
      +'<text x="'+(42+j*52)+'" y="'+(65+sem*30)+'" font-size="9" text-anchor="middle" fill="'+(worked?color:'#94a3b8')+'">'+i+1+'</text>';
  }).join('');
  var header=jours.map(function(j,i){return '<text x="'+(42+i*52)+'" y="42" font-size="9" font-weight="bold" text-anchor="middle" fill="#64748b">'+j+'</text>';}).join('');
  return '<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<text x="14" y="22" font-size="11" font-weight="bold" fill="#0f172a">Calendrier — '+ym+'</text>'
    +header+cells
    +'<rect x="20" y="145" width="12" height="10" rx="2" fill="'+color+'25" stroke="'+color+'"/>'
    +'<text x="36" y="154" font-size="8" fill="#64748b">Jour travaillé</text>'
    +'<rect x="110" y="145" width="12" height="10" rx="2" fill="#f1f5f9" stroke="#e2e8f0"/>'
    +'<text x="126" y="154" font-size="8" fill="#64748b">Non travaillé</text>'
    +'</svg>';
}

function tut_svg_fy_filter(fy,color){
  return '<svg viewBox="0 0 340 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#1B2B3A">'
    +'<rect width="340" height="140" rx="10" fill="#1B2B3A"/>'
    +'<text x="14" y="22" font-size="9" font-weight="600" fill="#84CC16" text-transform="uppercase">Exercice fiscal</text>'
    +'<rect x="10" y="28" width="150" height="26" rx="6" fill="#0f1a28" stroke="#334155"/>'
    +'<text x="20" y="44" font-size="11" fill="#fff">'+fy+' ▼</text>'
    +'<text x="14" y="75" font-size="9" font-weight="600" fill="#64748b">Trimestre</text>'
    +['Q1','Q2','Q3','Q4','Année'].map(function(q,i){
      var act=q==='Q1';
      return '<rect x="'+(10+i*64)+'" y="82" width="58" height="24" rx="5" fill="'+(act?color:'transparent')+'" stroke="'+(act?color:'#334155')+'"/>'
        +'<text x="'+(39+i*64)+'" y="98" font-size="9" text-anchor="middle" fill="'+(act?'#fff':'#94a3b8')+'">'+q+'</text>';
    }).join('')
    +'<style>.tut-pulse{animation:pulse 1.2s ease-in-out infinite;} @keyframes pulse{0%,100%{r:5;opacity:1}50%{r:7;opacity:0.7}}</style>'
    +'</svg>';
}

function tut_svg_kpi_row(name,staffing,ca,tjm,contrib,color){
  return '<svg viewBox="0 0 340 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<rect width="340" height="28" rx="5" fill="#f8fafc"/>'
    +'<text x="10" y="18" font-size="9" font-weight="700" fill="#64748b">CONSULTANT</text>'
    +'<text x="130" y="18" font-size="9" font-weight="700" fill="#64748b">STAFFING</text>'
    +'<text x="180" y="18" font-size="9" font-weight="700" fill="#64748b">CA</text>'
    +'<text x="230" y="18" font-size="9" font-weight="700" fill="#64748b">TJM MOY.</text>'
    +'<text x="290" y="18" font-size="9" font-weight="700" fill="#64748b">CONTRIB.</text>'
    +'<rect x="0" y="28" width="340" height="44" fill="'+(staffing>='90%'?'#fff':color+'10')+'"/>'
    +'<text x="10" y="54" font-size="12" font-weight="bold" fill="#0f172a">'+name+'</text>'
    +'<text x="130" y="54" font-size="12" font-weight="bold" fill="'+color+'">'+staffing+'</text>'
    +'<text x="180" y="54" font-size="10" fill="#374151">'+ca+'</text>'
    +'<text x="230" y="54" font-size="10" fill="#374151">'+tjm+'</text>'
    +'<text x="290" y="54" font-size="12" font-weight="bold" fill="#15803d">'+contrib+'</text>'
    +'<rect x="0" y="72" width="340" height="1" fill="#f1f5f9"/>'
    +'<text x="10" y="84" font-size="8" fill="#94a3b8">→ Jours facturés / jours ouvrables · Contribution = CA - coût employeur (SCR × 113,35 × 1,25)</text>'
    +'</svg>';
}

function tut_svg_team_card(name,grade,scr,color){
  return '<svg viewBox="0 0 340 110" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<rect x="10" y="10" width="320" height="88" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>'
    +'<circle cx="40" cy="46" r="22" fill="'+color+'20" stroke="'+color+'" stroke-width="1.5"/>'
    +'<text x="40" y="51" font-size="13" font-weight="bold" text-anchor="middle" fill="'+color+'">'+name[0]+'</text>'
    +'<text x="72" y="36" font-size="13" font-weight="bold" fill="#0f172a">'+name+'</text>'
    +'<rect x="72" y="42" width="80" height="16" rx="8" fill="'+color+'20"/>'
    +'<text x="80" y="53" font-size="9" fill="'+color+'" font-weight="600">'+grade+'</text>'
    +'<text x="72" y="74" font-size="11" fill="#64748b">'+scr+'</text>'
    +'<text x="220" y="50" font-size="10" font-weight="bold" fill="#15803d">✓ Dans l\'équipe</text>'
    +'<style>.tut-pulse{animation:glow 1s ease-in-out infinite;} @keyframes glow{0%,100%{opacity:1}50%{opacity:0.6}}</style>'
    +'</svg>';
}

function tut_svg_approval(name,desc,color){
  return '<svg viewBox="0 0 340 110" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<rect width="340" height="26" rx="10" fill="#1B2B3A"/>'
    +'<rect x="0" y="16" width="340" height="10" fill="#1B2B3A"/>'
    +'<text x="14" y="18" font-size="10" font-weight="bold" fill="#fff">🔔 Approbations en attente (1)</text>'
    +'<rect x="10" y="34" width="320" height="58" rx="8" fill="#fffbeb" stroke="#fde68a" stroke-width="1.5"/>'
    +'<text x="20" y="54" font-size="11" font-weight="bold" fill="#0f172a">'+name+'</text>'
    +'<text x="20" y="68" font-size="9" fill="#64748b">'+desc+'</text>'
    +'<rect x="200" y="60" width="55" height="22" rx="6" fill="#16a34a" class="tut-pulse"/>'
    +'<text x="213" y="75" font-size="9" font-weight="bold" fill="#fff">✓ Approuver</text>'
    +'<rect x="262" y="60" width="55" height="22" rx="6" fill="#dc2626"/>'
    +'<text x="276" y="75" font-size="9" font-weight="bold" fill="#fff">✗ Refuser</text>'
    +'<style>.tut-pulse{filter:drop-shadow(0 0 4px #16a34a80);animation:glow 1.4s ease-in-out infinite;} @keyframes glow{0%,100%{opacity:1}50%{opacity:0.7}}</style>'
    +'</svg>';
}

function tut_svg_dashboard_overview(color){
  var sections=['🟡 Inter-contrat (2)','⏰ Fins de mission (3)','👋 Arrivées prévues (1)','🔔 Approbations (2)'];
  var rows=sections.map(function(s,i){
    return '<rect x="10" y="'+(30+i*28)+'" width="320" height="22" rx="6" fill="'+(i===3?'#fffbeb':'#f8fafc')+'" stroke="'+(i===3?'#fde68a':'#e2e8f0')+'"/>'
      +'<text x="20" y="'+(45+i*28)+'" font-size="10" fill="#374151">'+s+'</text>'
      +'<text x="305" y="'+(45+i*28)+'" font-size="9" fill="#94a3b8">›</text>';
  }).join('');
  return '<svg viewBox="0 0 340 145" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<text x="14" y="20" font-size="11" font-weight="bold" fill="#0f172a">📊 Tableau de bord</text>'
    +rows+'</svg>';
}

function tut_svg_dashboard_section(title,content,color){
  return '<svg viewBox="0 0 340 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:10px;background:#fff;border:1px solid #e2e8f0">'
    +'<rect x="10" y="10" width="320" height="78" rx="8" fill="'+color+'10" stroke="'+color+'" stroke-width="1.5"/>'
    +'<text x="22" y="30" font-size="11" font-weight="bold" fill="'+color+'">'+title+'</text>'
    +'<text x="22" y="52" font-size="11" fill="#374151">'+content+'</text>'
    +'<rect x="22" y="62" width="140" height="18" rx="5" fill="'+color+'" opacity="0.85"/>'
    +'<text x="55" y="74" font-size="9" font-weight="bold" fill="#fff">Voir le profil →</text>'
    +'</svg>';
}

/* ════ Affichage tutoriel ════ */
var _tutState={id:null,step:0};
function openTutorial(id){_tutState={id:id,step:0};S.modal={type:'tutorial',tutId:id,tutStep:0};render();}
function tutNext(){if(S.modal&&S.modal.type==='tutorial'){S.modal.tutStep=(S.modal.tutStep||0)+1;render();}}
function tutPrev(){if(S.modal&&S.modal.type==='tutorial'){S.modal.tutStep=Math.max(0,(S.modal.tutStep||0)-1);render();}}

function tHelp(){
  var role=S.role||'utilisateur';
  /* logs: visible uniquement dans Supabase (audit) */
  return '<div class="vw">'
    +'<div class="ph"><div class="pt">\u2753 Aide &amp; Tutoriels</div>'
    +'<div class="ps">Guides interactifs pour le r\u00f4le '+rLabel(role)+'</div></div>'
    /* Tutoriels disponibles */
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">'
    +Object.keys(TUTORIALS).filter(function(k){
      var roleMap={kpis:['super_admin','admin','gestionnaire'],dashboard:['super_admin','admin','gestionnaire','utilisateur'],recrutement:['super_admin','admin','gestionnaire','recruteur','utilisateur'],business:['super_admin','admin','gestionnaire','sales','utilisateur'],missions:['super_admin','admin','gestionnaire','utilisateur'],absences:['super_admin','admin','gestionnaire','utilisateur','recruteur','sales']};
      return !roleMap[k]||roleMap[k].indexOf(role)>=0;
    }).map(function(k){
      var tut=TUTORIALS[k];
      return '<button data-act="open-tutorial" data-tutid="'+k+'" style="text-align:left;border:1px solid '+tut.color+'30;background:'+tut.color+'0a;border-radius:12px;padding:18px;cursor:pointer;transition:all .15s;width:100%"'
        +' onmouseover="this.style.background=\''+tut.color+'18\'" onmouseout="this.style.background=\''+tut.color+'0a\'">'
        +'<div style="font-size:28px;margin-bottom:8px">'+(k==='recrutement'?'\uD83C\uDFAF':k==='business'?'\uD83D\uDCBC':k==='missions'?'\uD83D\uDCCB':k==='kpis'?'\uD83D\uDCC8':k==='absences'?'\uD83C\uDFD6\uFE0F':'\uD83D\uDCCA')+'</div>'
        +'<div style="font-weight:800;color:'+tut.color+';font-size:14px;margin-bottom:4px">'+esc(tut.title.split('\u2014')[0].trim())+'</div>'
        +'<div style="font-size:12px;color:#64748b;margin-bottom:8px">'+tut.steps.length+' \u00e9tapes guid\u00e9es</div>'
        +'<div style="font-size:11px;font-weight:700;color:'+tut.color+';background:'+tut.color+'15;padding:4px 10px;border-radius:99px;display:inline-block">\u25b6 D\u00e9marrer le tutoriel</div>'
        +'</button>';
    }).join('')
    +'</div>'
    +'</div>';
}


function tParam(){
  var ks=buildKS();
  var totR=ks.reduce(function(s,x){return s+x.k.rev;},0);
  var totBill=ks.reduce(function(s,x){return s+x.k.bill;},0);
  var _aktWD=ks.reduce(function(s,x){return s+(x.k.tWD||0);},0);
  var avgSr=_aktWD>0?ks.reduce(function(s,x){return s+x.k.sr*(x.k.tWD||0);},0)/_aktWD:0;
  var avgTJMv=totBill>0?totR/totBill:0;
  var _fyTWD=wDays(fyStart(S.year),fyEnd(S.year),H);
  var netC=totR-(_fyTWD>0?ks.reduce(function(s,x){return s+(x.c.contract==='freelance'?x.c.scr*x.k.bill:x.c.scr*SCR_FACTOR*EMPLOYER_FACTOR*(x.k.tWD/_fyTWD));},0):0);

  var context='<div class="card" style="padding:20px;margin-bottom:20px">'
    +'<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:14px">\uD83D\uDCCC Situation actuelle - '+fyLbl(S.year)+'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">'
    +[['Staffing moyen',avgSr.toFixed(1)+'%'],['CA total',fEur(totR)],['TJM moyen',avgTJMv>0?fEur(Math.round(avgTJMv)):'\u2014'],['Contribution nette',fEur(netC)]].map(function(x){
      return '<div style="text-align:center;padding:12px;background:#f8fafc;border-radius:8px">'
        +'<div style="font-size:16px;font-weight:800;color:#0f172a">'+x[1]+'</div>'
        +'<div style="font-size:11px;color:#64748b;margin-top:2px">'+x[0]+'</div></div>';
    }).join('')+'</div></div>';

  var goals=[
    {id:'ca',  icon:'\uD83D\uDCB6', title:'Augmenter le Chiffre d\'Affaires',       sub:'Maximiser les revenus de votre équipe de conseil'},
    {id:'util',icon:'\uD83D\uDCCA', title:'Améliorer le Taux d\'Utilisation',        sub:'Optimiser le staffing et réduire les jours non facturés'},
    {id:'tjm', icon:'\uD83D\uDCC8', title:'Augmenter le TJM Moyen',                  sub:'Améliorer les tarifs et la marge de votre équipe'}
  ];

  var sections=goals.map(function(g){
    var recs=S.precs&&S.precs[g.id];
    var recHtml=recs?recs.map(function(r,i){
      return '<div class="rec-card">'
        +'<div class="rec-title">'+esc((i+1)+'. '+r.title)+'</div>'
        +'<div class="rec-detail">'+esc(r.detail)+'</div></div>';
    }).join(''):'<div style="font-size:12px;color:#94a3b8;font-style:italic;padding:8px 0">Cliquez sur \u00ab\u00a0G\u00e9n\u00e9rer\u00a0\u00bb pour obtenir des pr\u00e9conisations personnalis\u00e9es bas\u00e9es sur vos donn\u00e9es '+fyLbl(S.year)+'.</div>';
    return '<div class="goal-card"><div class="goal-header">'
      +'<div class="goal-icon">'+g.icon+'</div>'
      +'<div style="flex:1"><div class="goal-title">'+esc(g.title)+'</div><div class="goal-sub">'+esc(g.sub)+'</div></div>'
      +'<button class="bp" style="flex-shrink:0" data-act="gen-'+g.id+'">\u26A1 Générer les préconisations</button>'
      +'</div>'+recHtml+'</div>';
  }).join('');

  return '<div class="vw">'
    +'<div><div class="pt">Param\u00e9trage & Pr\u00e9conisations</div>'
    +'<div class="ps">Analyse intelligente de vos donn\u00e9es '+fyLbl(S.year)+' pour vous aider \u00e0 atteindre vos objectifs</div></div>'
    +context+sections+'</div>';
}

