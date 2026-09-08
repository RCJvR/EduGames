// ============================================================
// THE MAGIC LAB — french-tutor.js
// Standalone French practice app: listening, reading, writing,
// speaking + a scripted conversation partner. No account, no
// backend — progress lives in localStorage. Grading uses the
// free LanguageTool API (grammar/spelling) plus the browser's
// own SpeechRecognition/speechSynthesis for the speech side.
// ============================================================

(function () {
'use strict';

// ── Content ──────────────────────────────────────────────────
const CONTENT = {

  vocabulary: [
    { id:'voc-a1-1', level:'A1', unit:'a1-hellos', title:'bonjour', word:'bonjour', options:['hello / good day','goodbye','thank you','please'], answer:0 },
    { id:'voc-a1-2', level:'A1', unit:'a1-hellos', title:'merci', word:'merci', options:['thank you','sorry','please','hello'], answer:0 },
    { id:'voc-a1-3', level:'A1', unit:'a1-hellos', title:'au revoir', word:'au revoir', options:['goodbye','hello','yes','no'], answer:0 },
    { id:'voc-a1-4', level:'A1', unit:'a1-numbers', title:'un', word:'un', options:['one','two','three','four'], answer:0 },
    { id:'voc-a1-5', level:'A1', unit:'a1-numbers', title:'dix', word:'dix', options:['ten','two','six','nine'], answer:0 },
    { id:'voc-a1-6', level:'A1', unit:'a1-numbers', title:'l’heure', word:'l’heure', options:['the time / hour','the day','the week','the month'], answer:0 },
    { id:'voc-a1-7', level:'A1', unit:'a1-family', title:'la mère', word:'la mère', options:['the mother','the father','the sister','the brother'], answer:0 },
    { id:'voc-a1-8', level:'A1', unit:'a1-family', title:'le frère', word:'le frère', options:['the brother','the sister','the son','the father'], answer:0 },
    { id:'voc-a1-9', level:'A1', unit:'a1-family', title:'rouge', word:'rouge', options:['red','blue','green','yellow'], answer:0 },
    { id:'voc-a1-10', level:'A1', unit:'a1-objects', title:'la table', word:'la table', options:['the table','the chair','the door','the window'], answer:0 },
    { id:'voc-a1-11', level:'A1', unit:'a1-objects', title:'le livre', word:'le livre', options:['the book','the pen','the bag','the phone'], answer:0 },
    { id:'voc-a1-12', level:'A1', unit:'a1-objects', title:'la maison', word:'la maison', options:['the house','the car','the school','the shop'], answer:0 },
    { id:'voc-a1-13', level:'A1', unit:'a1-food', title:'le pain', word:'le pain', options:['bread','water','cheese','meat'], answer:0 },
    { id:'voc-a1-14', level:'A1', unit:'a1-food', title:'l’eau', word:'l’eau', options:['water','milk','juice','coffee'], answer:0 },
    { id:'voc-a1-15', level:'A1', unit:'a1-food', title:'la pomme', word:'la pomme', options:['the apple','the pear','the banana','the orange'], answer:0 }
  ],

  listening: [
    { id:'lis-a2-1', level:'A2', unit:'a2-daily', type:'dictation', title:'Au marché',
      audioText:'Je vais au marché ce matin pour acheter des légumes.' },
    { id:'lis-a2-2', level:'A2', unit:'a2-greetings', type:'mcq', title:'Se présenter',
      audioText:'Bonjour, je m’appelle Claire. J’ai vingt-cinq ans et j’habite à Lyon avec mon frère.',
      question:'Où habite Claire ?',
      options:['À Paris','À Lyon','À Marseille','À Nice'], answer:1 },
    { id:'lis-b1-1', level:'B1', unit:'b1-travel', type:'dictation', title:'Sortie au cinéma',
      audioText:'Hier soir, nous sommes allés au cinéma pour voir le nouveau film français.' },
    { id:'lis-b1-2', level:'B1', unit:'b1-lifestyle', type:'mcq', title:'La météo',
      audioText:'La météo pour demain annonce du soleil le matin, mais des nuages arriveront l’après-midi avec un risque de pluie en soirée.',
      question:'Quel temps est prévu en soirée ?',
      options:['Du soleil','Des nuages','De la pluie','De la neige'], answer:2 },
    { id:'lis-b2-1', level:'B2', unit:'b2-culture', type:'dictation', title:'La fête du village',
      audioText:'Malgré la pluie, les habitants du village ont décidé de maintenir la fête organisée chaque année en été.' },
    { id:'lis-b2-2', level:'B2', unit:'b2-society', type:'mcq', title:'Une réforme',
      audioText:'Le gouvernement a annoncé hier une nouvelle réforme visant à réduire les émissions de carbone d’ici deux mille trente, ce qui a suscité des réactions mitigées parmi les experts.',
      question:'Que vise la réforme annoncée ?',
      options:['Augmenter les impôts','Réduire les émissions de carbone','Créer des emplois','Construire des routes'], answer:1 },
    { id:'lis-a1-1', level:'A1', unit:'a1-hellos', type:'dictation', title:'Se saluer',
      audioText:'Bonjour, comment ça va ?' },
    { id:'lis-a1-2', level:'A1', unit:'a1-numbers', type:'mcq', title:'Quelle heure est-il ?',
      audioText:'Il est trois heures.',
      question:'Quelle heure est-il ?',
      options:['1 heure','3 heures','5 heures','10 heures'], answer:1 },
    { id:'lis-a1-3', level:'A1', unit:'a1-family', type:'mcq', title:'La couleur des cheveux',
      audioText:'Ma sœur s’appelle Julie. Elle a les cheveux bruns.',
      question:'De quelle couleur sont les cheveux de la sœur ?',
      options:['Blonds','Bruns','Roux','Gris'], answer:1 },
    { id:'lis-a1-4', level:'A1', unit:'a1-objects', type:'dictation', title:'Dans la chambre',
      audioText:'Le livre est sur la table.' },
    { id:'lis-a1-5', level:'A1', unit:'a1-food', type:'mcq', title:'Une commande simple',
      audioText:'Je voudrais du pain et de l’eau, s’il vous plaît.',
      question:'Qu’est-ce que la personne demande ?',
      options:['Du pain et de l’eau','Du fromage et du vin','Une pomme','Un café'], answer:0 },
    { id:'lis-a2-3', level:'A2', unit:'a2-shopping', type:'mcq', title:'Au magasin',
      audioText:'Bonjour, je cherche une robe bleue en taille moyenne, vous en avez ?',
      question:'Qu’est-ce que la cliente cherche ?',
      options:['Une robe bleue','Un pantalon noir','Des chaussures','Un manteau'], answer:0 },
    { id:'lis-a2-4', level:'A2', unit:'a2-shopping', type:'dictation', title:'Un rendez-vous',
      audioText:'J’ai rendez-vous chez le dentiste à quatorze heures.' },
    { id:'lis-a2-5', level:'A2', unit:'a2-city', type:'mcq', title:'L’arrêt de bus',
      audioText:'Le bus numéro douze part dans cinq minutes, à l’arrêt en face de la pharmacie.',
      question:'Où est l’arrêt de bus ?',
      options:['Devant la pharmacie','Devant la banque','Devant l’école','Devant la gare'], answer:0 },
    { id:'lis-a2-6', level:'A2', unit:'a2-city', type:'dictation', title:'Indiquer un chemin',
      audioText:'Pour aller à la bibliothèque, prenez la deuxième rue à droite.' },
    { id:'lis-a2-7', level:'A2', unit:'a2-health', type:'mcq', title:'Chez le médecin',
      audioText:'J’ai mal à la tête et un peu de fièvre depuis ce matin.',
      question:'Quels sont les symptômes ?',
      options:['Mal à la tête et fièvre','Mal au ventre','Mal aux dents','Une toux'], answer:0 },
    { id:'lis-a2-8', level:'A2', unit:'a2-health', type:'dictation', title:'Un médicament',
      audioText:'Il faut prendre ce médicament trois fois par jour.' },
    { id:'lis-b1-3', level:'B1', unit:'b1-relations', type:'mcq', title:'Se sentir seul',
      audioText:'Depuis qu’elle a déménagé, Claire se sent un peu seule, même si elle a rencontré de nouveaux collègues sympathiques.',
      question:'Comment se sent Claire depuis son déménagement ?',
      options:['Très heureuse','Un peu seule','En colère','Stressée'], answer:1 },
    { id:'lis-b1-4', level:'B1', unit:'b1-relations', type:'dictation', title:'Un ami fidèle',
      audioText:'Mon meilleur ami me soutient toujours, même dans les moments difficiles.' },
    { id:'lis-b1-5', level:'B1', unit:'b1-media', type:'mcq', title:'Un podcast',
      audioText:'Ce podcast parle de l’histoire de la musique française, épisode après épisode, depuis les années soixante.',
      question:'De quoi parle ce podcast ?',
      options:['De cuisine','De l’histoire de la musique française','De sport','De politique'], answer:1 },
    { id:'lis-b1-6', level:'B1', unit:'b1-media', type:'dictation', title:'Lire ou regarder',
      audioText:'Je préfère lire un livre plutôt que regarder la télévision le soir.' },
    { id:'lis-b1-7', level:'B1', unit:'b1-future', type:'mcq', title:'Étudier à l’étranger',
      audioText:'L’année prochaine, je compte partir étudier à l’étranger pendant six mois.',
      question:'Que compte faire la personne l’année prochaine ?',
      options:['Changer de travail','Partir étudier à l’étranger','Déménager','Se marier'], answer:1 },
    { id:'lis-b1-8', level:'B1', unit:'b1-future', type:'dictation', title:'Un rêve d’avenir',
      audioText:'Dans dix ans, j’espère avoir mon propre restaurant.' },
    { id:'lis-b2-3', level:'B2', unit:'b2-news', type:'mcq', title:'Un sondage',
      audioText:'Selon un sondage récent, une majorité de citoyens estiment que les médias traditionnels manquent de neutralité, préférant s’informer via les réseaux sociaux, malgré les risques de désinformation.',
      question:'Que préfèrent une majorité de citoyens, selon le sondage ?',
      options:['Les journaux papier','Les réseaux sociaux','La radio','La télévision publique'], answer:1 },
    { id:'lis-b2-4', level:'B2', unit:'b2-news', type:'dictation', title:'Un débat qui divise',
      audioText:'Le débat sur la réforme des retraites continue de diviser l’opinion publique.' },
    { id:'lis-b2-5', level:'B2', unit:'b2-work', type:'mcq', title:'Pénurie de main-d’œuvre',
      audioText:'Face à la pénurie de main-d’œuvre dans certains secteurs, plusieurs entreprises ont décidé d’augmenter les salaires et d’améliorer les conditions de travail.',
      question:'Comment certaines entreprises réagissent-elles à la pénurie de main-d’œuvre ?',
      options:['En réduisant les effectifs','En augmentant les salaires et améliorant les conditions','En fermant des usines','En automatisant tout'], answer:1 },
    { id:'lis-b2-6', level:'B2', unit:'b2-work', type:'dictation', title:'L’inflation',
      audioText:'L’inflation continue de peser sur le pouvoir d’achat des ménages.' },
    { id:'lis-b2-7', level:'B2', unit:'b2-arts', type:'mcq', title:'Une exposition',
      audioText:'L’exposition consacrée aux impressionnistes attire un nombre record de visiteurs depuis son ouverture le mois dernier.',
      question:'À quel mouvement artistique l’exposition est-elle consacrée ?',
      options:['Le cubisme','L’impressionnisme','Le surréalisme','L’art abstrait'], answer:1 },
    { id:'lis-b2-8', level:'B2', unit:'b2-arts', type:'dictation', title:'Un grand roman',
      audioText:'Ce roman aborde des thèmes universels comme l’amour et la perte.' }
  ],

  reading: [
    { id:'read-a2-1', level:'A2', unit:'a2-daily', title:'Le petit café',
      passage:'Chaque matin, Marie va au petit café près de chez elle. Elle commande un croissant et un café au lait. Elle aime lire le journal en attendant le bus. Le café est calme le matin, mais très animé à midi.',
      questions:[
        { q:'Qu’est-ce que Marie commande ?', options:['Un thé et un croissant','Un café au lait et un croissant','Un jus d’orange','Un sandwich'], answer:1 },
        { q:'Quand le café est-il très animé ?', options:['Le matin','Le soir','À midi','La nuit'], answer:2 }
      ],
      written:{ prompt:'Décris en une ou deux phrases ce que fait Marie chaque matin.', keywords:['café','croissant','journal','bus','marie'] } },
    { id:'read-a2-2', level:'A2', unit:'a2-daily', title:'Une journée de classe',
      passage:'Léo se lève à sept heures. Il prend son petit-déjeuner, puis il va à l’école à pied avec sa sœur. Les cours commencent à huit heures et finissent à quinze heures trente. Après l’école, il fait ses devoirs avant de jouer au football.',
      questions:[
        { q:'Comment Léo va-t-il à l’école ?', options:['En voiture','En bus','À pied','À vélo'], answer:2 },
        { q:'Que fait Léo après l’école ?', options:['Il dort','Il fait ses devoirs','Il regarde la télévision','Il travaille'], answer:1 }
      ],
      written:{ prompt:'Résume la journée de Léo avec tes propres mots.', keywords:['école','devoirs','football','sœur','lève'] } },
    { id:'read-b1-1', level:'B1', unit:'b1-travel', title:'Un voyage inoubliable',
      passage:'L’année dernière, Thomas a décidé de voyager seul en Italie pendant deux semaines. Il n’avait jamais voyagé sans sa famille auparavant, et il était à la fois excité et un peu nerveux. Finalement, ce voyage lui a appris à être plus indépendant et à faire confiance à ses propres décisions.',
      questions:[
        { q:'Pourquoi Thomas était-il nerveux ?', options:['Il n’aimait pas l’Italie','Il n’avait jamais voyagé seul','Il avait peur de l’avion','Il ne parlait pas italien'], answer:1 },
        { q:'Qu’est-ce que ce voyage lui a appris ?', options:['À cuisiner','À être plus indépendant','À parler anglais','À économiser de l’argent'], answer:1 }
      ],
      written:{ prompt:'Que penses-tu de la décision de Thomas de voyager seul ?', keywords:['pense','opinion','voyage','indépendant','courage'] } },
    { id:'read-b1-2', level:'B1', unit:'b1-lifestyle', title:'Changer de métier',
      passage:'Après dix ans dans la finance, Sophie a quitté son emploi pour devenir professeure de yoga. Beaucoup de ses amis pensaient qu’elle prenait un grand risque, mais elle affirme n’avoir jamais regretté sa décision. Selon elle, gagner moins d’argent vaut la peine si le travail rend vraiment heureux.',
      questions:[
        { q:'Que faisait Sophie avant ?', options:['Professeure de yoga','Elle travaillait dans la finance','Médecin','Étudiante'], answer:1 },
        { q:'Que pense Sophie de sa décision ?', options:['Elle la regrette','Elle ne la regrette pas','Elle est indifférente','Elle veut recommencer dans la finance'], answer:1 }
      ],
      written:{ prompt:'Aurais-tu pris la même décision que Sophie ? Pourquoi ?', keywords:['décision','pense','argent','heureux','risque'] } },
    { id:'read-b2-1', level:'B2', unit:'b2-society', title:'Le télétravail en question',
      passage:'Depuis quelques années, de plus en plus d’entreprises proposent le télétravail à leurs employés. Si cette flexibilité est appréciée par beaucoup, certains experts s’inquiètent de ses effets sur la collaboration entre collègues et sur la santé mentale des travailleurs isolés chez eux. Un équilibre entre présence au bureau et travail à distance semble donc être la solution privilégiée par de nombreuses entreprises aujourd’hui.',
      questions:[
        { q:'Que craignent certains experts à propos du télétravail ?', options:['Qu’il coûte trop cher','Ses effets sur la collaboration et la santé mentale','Qu’il soit interdit par la loi','Qu’il réduise les salaires'], answer:1 },
        { q:'Quelle solution est privilégiée par de nombreuses entreprises ?', options:['Le télétravail total','Le retour au bureau à temps plein','Un équilibre entre bureau et télétravail','La suppression du télétravail'], answer:2 }
      ],
      written:{ prompt:'Selon toi, quel est le meilleur équilibre entre bureau et télétravail ?', keywords:['équilibre','bureau','télétravail','pense','journée'] } },
    { id:'read-b2-2', level:'B2', unit:'b2-culture', title:'L’intelligence artificielle au quotidien',
      passage:'L’intelligence artificielle s’invite désormais dans des domaines aussi variés que la médecine, l’éducation et les transports. Si ses défenseurs vantent des gains d’efficacité considérables, d’autres redoutent une dépendance excessive à des systèmes dont les décisions restent parfois difficiles à expliquer. Le débat porte donc moins sur la technologie elle-même que sur la manière de l’encadrer.',
      questions:[
        { q:'Que redoutent certaines personnes à propos de l’IA ?', options:['Qu’elle coûte trop cher','Une dépendance excessive à des systèmes peu transparents','Qu’elle ne fonctionne pas','Qu’elle remplace les médecins uniquement'], answer:1 },
        { q:'Sur quoi porte vraiment le débat, selon le texte ?', options:['Sur l’interdiction totale de l’IA','Sur la manière d’encadrer la technologie','Sur son prix','Sur son invention'], answer:1 }
      ],
      written:{ prompt:'Es-tu plutôt optimiste ou inquiet à propos de l’intelligence artificielle ? Explique.', keywords:['optimiste','inquiet','ia','intelligence','pense'] } },
    { id:'read-a2-3', level:'A2', unit:'a2-greetings', title:'Nouvel ami à l’école',
      passage:'Aujourd’hui, c’est le premier jour de Léa dans sa nouvelle école. Dans la cour, un garçon s’approche et dit : « Salut, je m’appelle Hugo. Comment tu t’appelles ? » Léa sourit et répond : « Je m’appelle Léa. J’ai onze ans et je viens d’arriver en ville. » Hugo lui présente ensuite ses amis.',
      questions:[
        { q:'Comment s’appelle le garçon ?', options:['Léa','Hugo','Paul','Marc'], answer:1 },
        { q:'Pourquoi Léa est-elle nouvelle à l’école ?', options:['Elle a changé de classe','Elle vient d’arriver en ville','Elle a raté le bus','Elle est malade'], answer:1 }
      ],
      written:{ prompt:'Imagine que tu rencontres un nouvel élève. Que lui dis-tu ?', keywords:['salut','bonjour','je m’appelle','comment','t’appelles'] } },
    { id:'read-a1-1', level:'A1', unit:'a1-hellos', title:'Se présenter',
      passage:'Bonjour ! Je m’appelle Emma. J’ai dix ans. Voici mon ami, il s’appelle Noah. Il a onze ans.',
      questions:[
        { q:'Comment s’appelle la fille ?', options:['Emma','Noah','Léa','Marc'], answer:0 },
        { q:'Quel âge a Noah ?', options:['Dix ans','Onze ans','Douze ans','Neuf ans'], answer:1 }
      ],
      written:{ prompt:'Présente-toi : dis ton nom et ton âge.', keywords:['je m’appelle','j’ai','ans'] } },
    { id:'read-a1-2', level:'A1', unit:'a1-numbers', title:'La journée de Léo',
      passage:'Léo a huit ans. Il a deux frères et une sœur. Le cours commence à neuf heures et finit à midi.',
      questions:[
        { q:'Quel âge a Léo ?', options:['Six ans','Sept ans','Huit ans','Neuf ans'], answer:2 },
        { q:'À quelle heure commence le cours ?', options:['Huit heures','Neuf heures','Dix heures','Midi'], answer:1 }
      ],
      written:{ prompt:'Écris ton âge et l’heure à laquelle tu te lèves.', keywords:['ans','heure','je me lève'] } },
    { id:'read-a1-3', level:'A1', unit:'a1-family', title:'Ma famille',
      passage:'Voici ma famille. Mon père s’appelle Marc, il a quarante ans. Ma mère s’appelle Julie. J’ai une petite sœur, elle aime le rose.',
      questions:[
        { q:'Comment s’appelle le père ?', options:['Marc','Julie','Noah','Léo'], answer:0 },
        { q:'Quelle couleur aime la petite sœur ?', options:['Le rose','Le bleu','Le vert','Le rouge'], answer:0 }
      ],
      written:{ prompt:'Décris un membre de ta famille.', keywords:['ma','mon','famille','s’appelle'] } },
    { id:'read-a1-4', level:'A1', unit:'a1-objects', title:'Ma chambre',
      passage:'Dans ma chambre, il y a un lit, une table et une chaise. Mes livres sont sur l’étagère. La maison a un grand jardin.',
      questions:[
        { q:'Où sont les livres ?', options:['Sur le lit','Sur l’étagère','Dans le jardin','Sur la chaise'], answer:1 },
        { q:'Qu’est-ce que la maison a ?', options:['Une piscine','Un grand jardin','Un garage','Un balcon'], answer:1 }
      ],
      written:{ prompt:'Décris ta chambre en deux phrases.', keywords:['chambre','table','lit','maison'] } },
    { id:'read-a1-5', level:'A1', unit:'a1-food', title:'Le petit-déjeuner',
      passage:'Au petit-déjeuner, je mange du pain avec du beurre et je bois du jus d’orange. Ma sœur préfère les pommes.',
      questions:[
        { q:'Que boit la personne au petit-déjeuner ?', options:['Du café','Du jus d’orange','De l’eau','Du lait'], answer:1 },
        { q:'Qu’est-ce que la sœur préfère ?', options:['Le pain','Les pommes','Le fromage','Le beurre'], answer:1 }
      ],
      written:{ prompt:'Qu’est-ce que tu manges au petit-déjeuner ?', keywords:['mange','bois','petit-déjeuner','pain'] } },
    { id:'read-a2-4', level:'A2', unit:'a2-shopping', title:'Un cadeau d’anniversaire',
      passage:'Ce matin, Camille va au centre commercial pour acheter un cadeau d’anniversaire pour sa mère. Elle hésite entre un foulard et un livre. Finalement, elle choisit le foulard parce que sa mère aime la mode.',
      questions:[
        { q:'Pourquoi Camille va-t-elle au centre commercial ?', options:['Pour acheter des vêtements pour elle','Pour acheter un cadeau d’anniversaire','Pour rencontrer une amie','Pour travailler'], answer:1 },
        { q:'Qu’est-ce que Camille choisit finalement ?', options:['Un livre','Un foulard','Un sac','Des chaussures'], answer:1 }
      ],
      written:{ prompt:'Qu’est-ce que tu offres pour un anniversaire ? Pourquoi ?', keywords:['offre','cadeau','anniversaire','parce que'] } },
    { id:'read-a2-5', level:'A2', unit:'a2-city', title:'Le trajet de Karim',
      passage:'Chaque jour, Karim prend le métro pour aller au travail. Le trajet dure vingt minutes. Certains jours, il préfère marcher parce qu’il fait beau et que ça lui permet de faire de l’exercice.',
      questions:[
        { q:'Combien de temps dure le trajet en métro ?', options:['Dix minutes','Vingt minutes','Trente minutes','Une heure'], answer:1 },
        { q:'Pourquoi Karim marche-t-il parfois ?', options:['Le métro est en panne','Il fait beau et il veut faire de l’exercice','Il n’a pas d’argent','Il est en retard'], answer:1 }
      ],
      written:{ prompt:'Comment vas-tu à l’école ou au travail ? Décris ton trajet.', keywords:['vais','prends','métro','bus','à pied'] } },
    { id:'read-a2-6', level:'A2', unit:'a2-health', title:'Une visite chez le médecin',
      passage:'Depuis quelques jours, Inès se sent fatiguée et elle tousse beaucoup. Elle décide finalement d’aller chez le médecin, qui lui conseille de se reposer et de boire beaucoup d’eau.',
      questions:[
        { q:'Quels sont les symptômes d’Inès ?', options:['Fatigue et toux','Fièvre et mal de tête','Mal au dos','Mal aux dents'], answer:0 },
        { q:'Que conseille le médecin ?', options:['De faire du sport','De se reposer et boire de l’eau','De prendre des vacances','De changer de travail'], answer:1 }
      ],
      written:{ prompt:'Que fais-tu quand tu es malade ?', keywords:['malade','repose','médecin','médicament','eau'] } },
    { id:'read-b1-3', level:'B1', unit:'b1-relations', title:'Une dispute entre frères',
      passage:'Après une dispute avec son frère, Antoine a mis plusieurs jours avant de lui reparler. Finalement, il a compris qu’il valait mieux s’excuser plutôt que de rester fâché indéfiniment.',
      questions:[
        { q:'Pourquoi Antoine ne parlait-il plus à son frère ?', options:['Ils avaient eu une dispute','Il avait déménagé','Il était malade','Il était en voyage'], answer:0 },
        { q:'Qu’est-ce qu’Antoine a finalement décidé de faire ?', options:['Déménager','S’excuser','Ignorer son frère pour toujours','Partir en voyage'], answer:1 }
      ],
      written:{ prompt:'Raconte une dispute que tu as eue et comment tu l’as résolue.', keywords:['dispute','excusé','ami','frère','résolu'] } },
    { id:'read-b1-4', level:'B1', unit:'b1-media', title:'Séries en streaming',
      passage:'De plus en plus de jeunes préfèrent les séries en streaming aux émissions de télévision traditionnelles. Cela leur permet de regarder ce qu’ils veulent, quand ils le veulent, sans publicité.',
      questions:[
        { q:'Que préfèrent de plus en plus de jeunes ?', options:['La télévision traditionnelle','Les séries en streaming','La radio','Les journaux'], answer:1 },
        { q:'Quel avantage le streaming offre-t-il ?', options:['C’est moins cher','On choisit quand regarder, sans publicité','Il y a plus de chaînes','C’est en direct'], answer:1 }
      ],
      written:{ prompt:'Préfères-tu la télévision ou le streaming ? Pourquoi ?', keywords:['préfère','streaming','télévision','parce que'] } },
    { id:'read-b1-5', level:'B1', unit:'b1-future', title:'Choisir sa voie',
      passage:'Mathilde hésite encore entre deux voies professionnelles : devenir vétérinaire ou travailler dans l’informatique. Elle a décidé de faire un stage dans chaque domaine avant de choisir définitivement.',
      questions:[
        { q:'Entre quoi Mathilde hésite-t-elle ?', options:['Médecine et droit','Vétérinaire et informatique','Enseignement et commerce','Art et musique'], answer:1 },
        { q:'Que va-t-elle faire avant de choisir ?', options:['Un voyage','Un stage dans chaque domaine','Des études supplémentaires','Rien'], answer:1 }
      ],
      written:{ prompt:'Quels sont tes projets pour les cinq prochaines années ?', keywords:['projet','avenir','espère','veux','vais'] } },
    { id:'read-b2-3', level:'B2', unit:'b2-news', title:'Désinformation et régulation',
      passage:'La question de la désinformation en ligne préoccupe de plus en plus les gouvernements. Si certains proposent une régulation stricte des plateformes, d’autres craignent que cela ne porte atteinte à la liberté d’expression. Trouver un juste équilibre reste un défi majeur pour les démocraties actuelles.',
      questions:[
        { q:'Que craignent certains à propos d’une régulation stricte ?', options:['Qu’elle coûte trop cher','Qu’elle porte atteinte à la liberté d’expression','Qu’elle soit inefficace','Qu’elle prenne trop de temps'], answer:1 },
        { q:'Quel est le défi majeur évoqué dans le texte ?', options:['Trouver un équilibre entre régulation et liberté','Interdire internet','Créer de nouvelles lois fiscales','Réduire les impôts'], answer:0 }
      ],
      written:{ prompt:'Penses-tu que les réseaux sociaux devraient être davantage régulés ? Justifie ta position.', keywords:['régulé','liberté','pense','opinion','réseaux'] } },
    { id:'read-b2-4', level:'B2', unit:'b2-work', title:'L’IA et le marché du travail',
      passage:'L’essor de l’intelligence artificielle transforme profondément le marché du travail. Si certains métiers risquent de disparaître, de nouveaux emplois émergent également, notamment dans la maintenance et la supervision des systèmes automatisés. Les experts recommandent donc de miser sur la formation continue pour s’adapter à ces changements.',
      questions:[
        { q:'Que recommandent les experts face à ces changements ?', options:['D’arrêter d’utiliser l’IA','De miser sur la formation continue','De changer de pays','D’ignorer le problème'], answer:1 },
        { q:'Que se passe-t-il avec certains métiers ?', options:['Ils deviennent tous automatisés','Certains risquent de disparaître, d’autres émergent','Ils disparaissent tous','Rien ne change'], answer:1 }
      ],
      written:{ prompt:'Comment penses-tu que l’intelligence artificielle va transformer ton futur métier ?', keywords:['intelligence artificielle','métier','avenir','pense','transformer'] } },
    { id:'read-b2-5', level:'B2', unit:'b2-arts', title:'Un roman intemporel',
      passage:'Considéré comme l’un des plus grands romans du vingtième siècle, cette œuvre continue de fasciner les lecteurs par sa capacité à mêler critique sociale et introspection psychologique. Traduit dans une trentaine de langues, il n’a rien perdu de sa force depuis sa publication.',
      questions:[
        { q:'Pourquoi cette œuvre continue-t-elle de fasciner les lecteurs ?', options:['Parce qu’elle est courte','Parce qu’elle mêle critique sociale et introspection','Parce qu’elle est facile à lire','Parce qu’elle est récente'], answer:1 },
        { q:'Dans combien de langues l’œuvre a-t-elle été traduite ?', options:['Une dizaine','Une vingtaine','Une trentaine','Une cinquantaine'], answer:2 }
      ],
      written:{ prompt:'Parle d’une œuvre (livre, film, tableau) qui t’a marqué et explique pourquoi.', keywords:['œuvre','marqué','parce que','aime','pense'] } }
  ],

  grammar: [
    { id:'gr-a2-1', level:'A2', unit:'a2-greetings', title:'Le verbe « être »',
      before:'Je ', after:' étudiant.', accepted:['suis'],
      explanation:'« Je suis » — première personne du singulier du verbe être.',
      explanationEn:'"Je suis" — first person singular of the verb "être" (to be).' },
    { id:'gr-a2-2', level:'A2', unit:'a2-daily', title:'L’article défini',
      before:'', after:' pomme est rouge.', accepted:['la'],
      explanation:'« Pomme » est féminin singulier, donc l’article est « la ».',
      explanationEn:'"Pomme" (apple) is feminine singular, so the article is "la".' },
    { id:'gr-b1-1', level:'B1', unit:'b1-travel', title:'Le passé composé',
      before:'Hier, nous ', after:' au cinéma. (aller)', accepted:['sommes allés','sommes allées','sommes allé','sommes allée'],
      explanation:'« Aller » se conjugue avec « être » au passé composé : nous sommes allé(e)s.',
      explanationEn:'"Aller" (to go) takes "être" in the passé composé: "nous sommes allé(e)s".' },
    { id:'gr-b1-2', level:'B1', unit:'b1-lifestyle', title:'La préposition « à »',
      before:'Je pense ', after:' toi tous les jours.', accepted:['à'],
      explanation:'« Penser à quelqu’un » se construit avec la préposition « à ».',
      explanationEn:'"To think about someone" ("penser à quelqu’un") takes the preposition "à".' },
    { id:'gr-b2-1', level:'B2', unit:'b2-society', title:'Le subjonctif',
      before:'Il faut que tu ', after:' tes devoirs. (faire)', accepted:['fasses'],
      explanation:'Après « il faut que », le verbe se met au subjonctif : que tu fasses.',
      explanationEn:'After "il faut que" (it is necessary that), the verb takes the subjunctive: "que tu fasses".' },
    { id:'gr-b2-2', level:'B2', unit:'b2-culture', title:'Le pronom relatif',
      before:'C’est la maison ', after:' j’ai grandi.', accepted:['où'],
      explanation:'« Où » remplace un complément de lieu ou de temps dans une proposition relative.',
      explanationEn:'"Où" (where) replaces a place or time complement in a relative clause.' },
    { id:'gr-a1-1', level:'A1', unit:'a1-hellos', title:'Le verbe « s’appeler »',
      before:'Comment tu ', after:' ?', accepted:['t’appelles','t appelles'],
      explanation:'« Tu t’appelles » — verbe pronominal « s’appeler » à la 2e personne du singulier.',
      explanationEn:'"Tu t’appelles" — the reflexive verb "s’appeler" (to be called) in the 2nd person singular.' },
    { id:'gr-a1-2', level:'A1', unit:'a1-numbers', title:'Le verbe « avoir »',
      before:'J’', after:' quinze ans.', accepted:['ai'],
      explanation:'« Avoir » au présent : j’ai, tu as, il/elle a…',
      explanationEn:'"Avoir" (to have) in the present tense: j’ai, tu as, il/elle a…' },
    { id:'gr-a1-3', level:'A1', unit:'a1-family', title:'L’adjectif possessif',
      before:'C’est ', after:' mère.', accepted:['ma'],
      explanation:'« Ma » s’accorde au féminin singulier avec « mère ».',
      explanationEn:'"Ma" (my) agrees with the feminine singular noun "mère" (mother).' },
    { id:'gr-a1-4', level:'A1', unit:'a1-objects', title:'L’article indéfini',
      before:'Il y a ', after:' table dans la cuisine.', accepted:['une'],
      explanation:'« Table » est féminin, donc l’article indéfini est « une ».',
      explanationEn:'"Table" is feminine, so the indefinite article is "une" (a).' },
    { id:'gr-a1-5', level:'A1', unit:'a1-food', title:'L’article partitif',
      before:'Je voudrais ', after:' pain.', accepted:['du'],
      explanation:'« Du » est l’article partitif utilisé devant un nom masculin non comptable comme « pain ».',
      explanationEn:'"Du" is the partitive article used before an uncountable masculine noun like "pain" (bread).' },
    { id:'gr-a2-3', level:'A2', unit:'a2-shopping', title:'Le futur proche',
      before:'Je ', after:' acheter une nouvelle veste. (aller)', accepted:['vais'],
      explanation:'Le futur proche se forme avec « aller » au présent + infinitif : je vais acheter.',
      explanationEn:'The near future is formed with "aller" (to go) in the present + infinitive: "je vais acheter" (I’m going to buy).' },
    { id:'gr-a2-4', level:'A2', unit:'a2-shopping', title:'Les adjectifs démonstratifs',
      before:'Je voudrais essayer ', after:' robe, s’il vous plaît.', accepted:['cette'],
      explanation:'« Cette » est l’adjectif démonstratif féminin singulier.',
      explanationEn:'"Cette" (this) is the feminine singular demonstrative adjective.' },
    { id:'gr-a2-5', level:'A2', unit:'a2-city', title:'Les prépositions de lieu',
      before:'La pharmacie est ', after:' de la banque.', accepted:['en face'],
      explanation:'« En face de » indique une position devant, de l’autre côté.',
      explanationEn:'"En face de" (opposite/across from) indicates a position facing something, on the other side.' },
    { id:'gr-a2-6', level:'A2', unit:'a2-city', title:'L’impératif',
      before:'', after:' la deuxième rue à droite. (prendre)', accepted:['prenez'],
      explanation:'L’impératif à la 2e personne du pluriel de « prendre » est « prenez », utilisé pour donner des indications.',
      explanationEn:'The imperative 2nd person plural of "prendre" (to take) is "prenez", used to give directions.' },
    { id:'gr-a2-7', level:'A2', unit:'a2-health', title:'« Avoir mal à »',
      before:'J’ai mal ', after:' tête.', accepted:['à la'],
      explanation:'« Avoir mal à » + article contracté : à la tête, au ventre, aux dents.',
      explanationEn:'"Avoir mal à" (to have pain in) + contracted article: "à la tête" (head), "au ventre" (stomach), "aux dents" (teeth).' },
    { id:'gr-a2-8', level:'A2', unit:'a2-health', title:'« Il faut » + infinitif',
      before:'Il ', after:' se reposer. (falloir)', accepted:['faut'],
      explanation:'« Il faut » exprime une obligation ou un conseil, suivi d’un infinitif.',
      explanationEn:'"Il faut" (it is necessary to) expresses an obligation or piece of advice, followed by an infinitive.' },
    { id:'gr-b1-3', level:'B1', unit:'b1-relations', title:'Les pronoms compléments',
      before:'Je ', after:' appelle tous les jours. (lui)', accepted:['lui'],
      explanation:'« Lui » remplace un complément d’objet indirect (à quelqu’un).',
      explanationEn:'"Lui" replaces an indirect object complement (to someone).' },
    { id:'gr-b1-4', level:'B1', unit:'b1-relations', title:'L’imparfait',
      before:'Quand j’étais petit, je ', after:' toujours avec mon frère. (jouer)', accepted:['jouais'],
      explanation:'L’imparfait décrit une habitude passée : je jouais, tu jouais, il jouait…',
      explanationEn:'The imperfect describes a past habit: "je jouais, tu jouais, il jouait…" (I used to play, you used to play, he used to play…).' },
    { id:'gr-b1-5', level:'B1', unit:'b1-media', title:'Le comparatif',
      before:'Ce film est ', after:' intéressant que l’autre. (plus)', accepted:['plus'],
      explanation:'« Plus… que » exprime la supériorité dans une comparaison.',
      explanationEn:'"Plus… que" (more… than) expresses superiority in a comparison.' },
    { id:'gr-b1-6', level:'B1', unit:'b1-media', title:'Verbe de préférence + infinitif',
      before:'Je préfère ', after:' un livre. (lire)', accepted:['lire'],
      explanation:'Après « préférer », le second verbe reste à l’infinitif.',
      explanationEn:'After "préférer" (to prefer), the second verb stays in the infinitive.' },
    { id:'gr-b1-7', level:'B1', unit:'b1-future', title:'Le futur simple',
      before:'L’année prochaine, je ', after:' à l’étranger. (partir)', accepted:['partirai'],
      explanation:'Le futur simple exprime une action à venir : je partirai, tu partiras…',
      explanationEn:'The simple future expresses an upcoming action: "je partirai, tu partiras…" (I will leave, you will leave…).' },
    { id:'gr-b1-8', level:'B1', unit:'b1-future', title:'« Espérer » + infinitif',
      before:'J’espère ', after:' mon propre restaurant un jour. (avoir)', accepted:['avoir'],
      explanation:'Après « espérer », si le sujet est le même, le second verbe reste à l’infinitif.',
      explanationEn:'After "espérer" (to hope), when the subject is the same, the second verb stays in the infinitive.' },
    { id:'gr-b2-3', level:'B2', unit:'b2-news', title:'Le conditionnel présent',
      before:'Si le gouvernement agissait, la situation ', after:' meilleure. (être)', accepted:['serait'],
      explanation:'Le conditionnel présent exprime une hypothèse : si + imparfait, … conditionnel.' },
    { id:'gr-b2-4', level:'B2', unit:'b2-news', title:'La concession (« bien que »)',
      before:'Bien que le sujet ', after:' complexe, il faut en débattre. (être)', accepted:['soit'],
      explanation:'Après « bien que », le verbe se met au subjonctif : bien que ce soit complexe.' },
    { id:'gr-b2-5', level:'B2', unit:'b2-work', title:'La voix passive',
      before:'De nouveaux emplois ', after:' créés chaque année. (être)', accepted:['sont'],
      explanation:'La voix passive se forme avec « être » + participe passé : sont créés.' },
    { id:'gr-b2-6', level:'B2', unit:'b2-work', title:'Le gérondif',
      before:'Les entreprises s’adaptent ', after:' les nouvelles technologies. (adopter, en + participe présent)', accepted:['en adoptant'],
      explanation:'Le gérondif (en + participe présent) exprime la manière ou la simultanéité : en adoptant.' },
    { id:'gr-b2-7', level:'B2', unit:'b2-arts', title:'Le plus-que-parfait',
      before:'Quand je suis arrivé, le film ', after:' déjà commencé. (avoir)', accepted:['avait'],
      explanation:'Le plus-que-parfait exprime une action antérieure à une autre action passée : avait commencé.' },
    { id:'gr-b2-8', level:'B2', unit:'b2-arts', title:'Les pronoms relatifs composés',
      before:'L’artiste ', after:' j’admire le travail vient de Lyon. (dont)', accepted:['dont'],
      explanation:'« Dont » remplace un complément introduit par « de » : le travail dont j’admire…' }
  ],

  writing: [
    { id:'wr-a2-1', level:'A2', unit:'a2-daily', title:'Ta journée typique', minWords:30,
      prompt:'Décris ta journée typique : à quelle heure te lèves-tu, qu’est-ce que tu manges, et que fais-tu le soir ?' },
    { id:'wr-a2-2', level:'A2', unit:'a2-greetings', title:'Présente-toi', minWords:25,
      prompt:'Présente-toi : quel est ton nom, quel âge as-tu, où habites-tu et quels sont tes loisirs ?' },
    { id:'wr-b1-1', level:'B1', unit:'b1-travel', title:'Un souvenir de voyage', minWords:50,
      prompt:'Raconte un voyage ou une sortie que tu as faite récemment. Où es-tu allé(e) et qu’est-ce que tu as aimé ?' },
    { id:'wr-b1-2', level:'B1', unit:'b1-lifestyle', title:'Ville ou campagne ?', minWords:50,
      prompt:'Donne ton opinion : préfères-tu vivre en ville ou à la campagne ? Explique pourquoi.' },
    { id:'wr-b2-1', level:'B2', unit:'b2-society', title:'Le télétravail', minWords:80,
      prompt:'Le télétravail devrait-il devenir la norme ? Donne ton opinion avec au moins deux arguments.' },
    { id:'wr-b2-2', level:'B2', unit:'b2-society', title:'Un enjeu environnemental', minWords:80,
      prompt:'Décris un problème environnemental qui t’inquiète et propose une solution possible.' },
    { id:'wr-b2-3', level:'B2', unit:'b2-culture', title:'Les réseaux sociaux', minWords:80,
      prompt:'Penses-tu que les réseaux sociaux ont plus d’avantages ou d’inconvénients ? Justifie ta réponse avec des exemples.' },
    { id:'wr-a1-1', level:'A1', unit:'a1-hellos', title:'Se présenter', minWords:8,
      prompt:'Présente-toi en une phrase : dis ton nom et ton âge.' },
    { id:'wr-a1-2', level:'A1', unit:'a1-numbers', title:'Les nombres', minWords:10,
      prompt:'Écris trois phrases avec des nombres : ton âge, l’heure actuelle, et le nombre de personnes dans ta famille.' },
    { id:'wr-a1-3', level:'A1', unit:'a1-family', title:'Ma famille', minWords:12,
      prompt:'Décris deux membres de ta famille (nom, âge, une couleur qu’ils aiment).' },
    { id:'wr-a1-4', level:'A1', unit:'a1-objects', title:'Ma maison', minWords:12,
      prompt:'Décris trois objets dans ta chambre ou ta maison.' },
    { id:'wr-a1-5', level:'A1', unit:'a1-food', title:'Mes repas', minWords:12,
      prompt:'Décris ce que tu manges et bois au petit-déjeuner.' },
    { id:'wr-a2-3', level:'A2', unit:'a2-shopping', title:'Une liste de courses', minWords:30,
      prompt:'Écris une liste de courses avec au moins cinq articles et explique pourquoi tu en as besoin.' },
    { id:'wr-a2-4', level:'A2', unit:'a2-city', title:'Indiquer un chemin', minWords:30,
      prompt:'Explique à un touriste comment aller de chez toi jusqu’à ton école ou ton lieu de travail.' },
    { id:'wr-a2-5', level:'A2', unit:'a2-health', title:'Chez le médecin', minWords:30,
      prompt:'Décris une fois où tu étais malade : quels symptômes avais-tu et qu’as-tu fait ?' },
    { id:'wr-b1-3', level:'B1', unit:'b1-relations', title:'Une amitié importante', minWords:50,
      prompt:'Décris une amitié importante dans ta vie et explique pourquoi cette personne compte pour toi.' },
    { id:'wr-b1-4', level:'B1', unit:'b1-media', title:'Tes loisirs préférés', minWords:50,
      prompt:'Décris comment tu passes ton temps libre et pourquoi tu aimes ces activités.' },
    { id:'wr-b1-5', level:'B1', unit:'b1-future', title:'Dans dix ans', minWords:50,
      prompt:'Où te vois-tu dans dix ans ? Décris tes projets professionnels et personnels.' },
    { id:'wr-b2-4', level:'B2', unit:'b2-news', title:'La liberté d’expression en ligne', minWords:80,
      prompt:'Les plateformes en ligne devraient-elles être davantage régulées pour lutter contre la désinformation ? Développe ton argumentation.' },
    { id:'wr-b2-5', level:'B2', unit:'b2-work', title:'Le marché du travail de demain', minWords:80,
      prompt:'Selon toi, quels métiers seront les plus recherchés dans dix ans ? Justifie ta réponse.' },
    { id:'wr-b2-6', level:'B2', unit:'b2-arts', title:'L’art dans ta vie', minWords:80,
      prompt:'Quel rôle l’art (musique, littérature, cinéma…) joue-t-il dans ta vie ? Développe avec des exemples précis.' }
  ],

  speaking: [
    { id:'sp-a2-1', level:'A2', unit:'a2-greetings', title:'Ta famille',
      prompt:'Décris ta famille en quelques phrases.',
      keywords:['famille','frère','soeur','sœur','parents','mère','père','fils','fille'] },
    { id:'sp-a2-2', level:'A2', unit:'a2-daily', title:'Le week-end',
      prompt:'Que fais-tu le week-end ?',
      keywords:['week-end','weekend','samedi','dimanche','sport','amis','famille'] },
    { id:'sp-b1-1', level:'B1', unit:'b1-lifestyle', title:'Apprendre le français',
      prompt:'Explique comment tu apprends le français.',
      keywords:['apprends','français','pratique','regarde','écoute','lis','parle','cours'] },
    { id:'sp-b1-2', level:'B1', unit:'b1-lifestyle', title:'Ton plat préféré',
      prompt:'Décris ton plat préféré et comment il est préparé.',
      keywords:['plat','préféré','préparé','ingrédients','cuisine','recette'] },
    { id:'sp-b1-3', level:'B1', unit:'b1-travel', title:'Un voyage de rêve',
      prompt:'Décris un voyage que tu aimerais faire et explique pourquoi.',
      keywords:['voyage','aimerais','pays','visiter','parce que','découvrir'] },
    { id:'sp-b2-1', level:'B2', unit:'b2-culture', title:'L’intelligence artificielle',
      prompt:'Que penses-tu de l’intelligence artificielle dans notre société ?',
      keywords:['intelligence','artificielle','société','pense','avantages','inconvénients','opinion'] },
    { id:'sp-b2-2', level:'B2', unit:'b2-society', title:'Un défi surmonté',
      prompt:'Décris un défi que tu as surmonté récemment.',
      keywords:['défi','surmonté','difficile','réussi','problème','solution'] },
    { id:'sp-a1-1', level:'A1', unit:'a1-hellos', title:'Dis bonjour',
      prompt:'Dis bonjour et donne ton nom.',
      keywords:['bonjour','je m’appelle','salut'] },
    { id:'sp-a1-2', level:'A1', unit:'a1-numbers', title:'Compte en français',
      prompt:'Compte de un à dix en français.',
      keywords:['un','deux','trois','quatre','cinq'] },
    { id:'sp-a1-3', level:'A1', unit:'a1-family', title:'Ta famille',
      prompt:'Nomme deux membres de ta famille.',
      keywords:['mère','père','frère','sœur','famille'] },
    { id:'sp-a1-4', level:'A1', unit:'a1-objects', title:'Chez toi',
      prompt:'Nomme trois objets qui sont dans ta maison.',
      keywords:['table','livre','maison','chaise','lit'] },
    { id:'sp-a1-5', level:'A1', unit:'a1-food', title:'Ce que tu aimes manger',
      prompt:'Dis ce que tu aimes manger et boire.',
      keywords:['j’aime','pain','eau','pomme','manger'] },
    { id:'sp-a2-3', level:'A2', unit:'a2-shopping', title:'Prendre rendez-vous',
      prompt:'Explique comment tu prendrais rendez-vous chez le médecin par téléphone.',
      keywords:['rendez-vous','bonjour','je voudrais','disponible'] },
    { id:'sp-a2-4', level:'A2', unit:'a2-city', title:'Les transports',
      prompt:'Décris comment tu te déplaces habituellement en ville.',
      keywords:['bus','métro','vélo','à pied','voiture','prends'] },
    { id:'sp-a2-5', level:'A2', unit:'a2-health', title:'Décrire un symptôme',
      prompt:'Explique à un médecin imaginaire ce qui ne va pas.',
      keywords:['mal','fièvre','fatigué','depuis','j’ai'] },
    { id:'sp-b1-4', level:'B1', unit:'b1-relations', title:'Exprimer ses sentiments',
      prompt:'Comment exprimes-tu tes sentiments à tes amis ou à ta famille ?',
      keywords:['sentiments','exprime','parle','ami','famille'] },
    { id:'sp-b1-5', level:'B1', unit:'b1-media', title:'Un livre ou un film',
      prompt:'Recommande un livre ou un film que tu as aimé récemment.',
      keywords:['recommande','aimé','film','livre','parce que'] },
    { id:'sp-b1-6', level:'B1', unit:'b1-future', title:'Tes projets d’avenir',
      prompt:'Parle de tes projets pour l’année prochaine.',
      keywords:['projet','année prochaine','espère','vais','veux'] },
    { id:'sp-b2-3', level:'B2', unit:'b2-news', title:'Un débat de société',
      prompt:'Choisis un sujet d’actualité qui te tient à cœur et donne ton opinion.',
      keywords:['actualité','opinion','pense','débat','société'] },
    { id:'sp-b2-4', level:'B2', unit:'b2-work', title:'L’avenir du travail',
      prompt:'Penses-tu que l’automatisation va créer plus d’emplois qu’elle n’en détruit ?',
      keywords:['automatisation','emplois','pense','créer','détruire'] },
    { id:'sp-b2-5', level:'B2', unit:'b2-arts', title:'Une œuvre marquante',
      prompt:'Présente une œuvre d’art ou un livre qui a changé ta façon de voir les choses.',
      keywords:['œuvre','livre','changé','pense','marqué'] }
  ],

  conversation: [
    { id:'conv-cafe', level:'A2', unit:'a2-daily', mode:'spoken', title:'Au café (spoken)', turns:[
      { app:'Bonjour ! Qu’est-ce que je vous sers ?',
        keywords:['je voudrais','je prends','un café','un thé','un chocolat','s’il vous plaît','svp'],
        hint:'Essaie « Je voudrais un café, s’il vous plaît »',
        hintEn:'Try "Je voudrais un café, s’il vous plaît" (I’d like a coffee, please)' },
      { app:'Très bien. Et avec ça, autre chose ?',
        keywords:['non merci','non','oui','un croissant','c’est tout'],
        hint:'Essaie « Non merci, c’est tout » ou « Oui, un croissant aussi »',
        hintEn:'Try "Non merci, c’est tout" (No thanks, that’s all) or "Oui, un croissant aussi" (Yes, a croissant too)' },
      { app:'D’accord, ça fait trois euros cinquante.',
        keywords:['voilà','merci','d’accord','tenez'],
        hint:'Essaie « Voilà, merci ! »',
        hintEn:'Try "Voilà, merci !" (Here you go, thanks!)' },
      { app:'Merci à vous, bonne journée !' }
    ] },
    { id:'conv-party', level:'A2', unit:'a2-greetings', mode:'spoken', title:'Se présenter à une fête (spoken)', turns:[
      { app:'Salut ! Je ne crois pas qu’on se connaisse. Comment tu t’appelles ?',
        keywords:['je m’appelle','moi c’est','je suis'],
        hint:'Essaie « Je m’appelle... » ou « Moi c’est... »',
        hintEn:'Try "Je m’appelle..." or "Moi c’est..." (My name is...)' },
      { app:'Enchanté ! Qu’est-ce que tu fais dans la vie ?',
        keywords:['je suis','je travaille','étudiant','étudiante','j’étudie'],
        hint:'Essaie « Je suis étudiant(e) » ou « Je travaille comme... »',
        hintEn:'Try "Je suis étudiant(e)" (I’m a student) or "Je travaille comme..." (I work as...)' },
      { app:'Ah super ! Et tu habites dans le coin ?',
        keywords:['j’habite','oui','non','près','loin'],
        hint:'Essaie « Oui, j’habite près d’ici »',
        hintEn:'Try "Oui, j’habite près d’ici" (Yes, I live nearby)' },
      { app:'Génial, ravi d’avoir discuté avec toi !' }
    ] },
    { id:'conv-directions', level:'B1', unit:'b1-travel', mode:'spoken', title:'Demander son chemin (spoken)', turns:[
      { app:'Excusez-moi, pouvez-vous m’indiquer la direction de la gare, s’il vous plaît ?',
        keywords:['tout droit','à gauche','à droite','continuez','tournez','c’est'],
        hint:'Essaie « Continuez tout droit, puis tournez à gauche »',
        hintEn:'Try "Continuez tout droit, puis tournez à gauche" (Keep going straight, then turn left)' },
      { app:'D’accord, merci. C’est loin d’ici ?',
        keywords:['minutes','loin','près','pied','non'],
        hint:'Essaie « Non, c’est à cinq minutes à pied »',
        hintEn:'Try "Non, c’est à cinq minutes à pied" (No, it’s five minutes on foot)' },
      { app:'Merci beaucoup pour votre aide !',
        keywords:['de rien','je vous en prie','au revoir','bonne journée'],
        hint:'Essaie « De rien, bonne journée ! »',
        hintEn:'Try "De rien, bonne journée !" (You’re welcome, have a good day!)' },
      { app:'Au revoir !' }
    ] },
    { id:'conv-work', level:'B2', unit:'b2-society', mode:'spoken', title:'Discussion informelle au travail (spoken)', turns:[
      { app:'Salut ! Alors, comment se passe ce nouveau projet dont tu m’as parlé ?',
        keywords:['projet','bien','difficile','avance','compliqué','ça va'],
        hint:'Essaie « Ça avance bien, mais c’est assez difficile »' },
      { app:'Ah je vois. Et ton équipe, elle t’aide bien ?',
        keywords:['équipe','collègues','aide','aident','oui','non'],
        hint:'Essaie « Oui, mes collègues m’aident beaucoup »' },
      { app:'Tant mieux. Vous pensez respecter les délais ?',
        keywords:['délais','temps','espère','pense','difficile'],
        hint:'Essaie « J’espère qu’on va respecter les délais »' },
      { app:'Bon courage, j’espère que ça va bien se passer !' }
    ] },
    { id:'conv-b2-culture', level:'B2', unit:'b2-culture', mode:'spoken', title:'Parler d’un film (spoken)', turns:[
      { app:'Tu as vu le nouveau film dont tout le monde parle ?',
        keywords:['oui','non','pas encore','j’ai vu','je ne l’ai pas vu'] },
      { app:'Ah bon ? Et qu’est-ce que tu en penses ?',
        keywords:['pense','trouve','excellent','intéressant','ennuyeux','pas mal'] },
      { app:'Intéressant ! Tu me le recommandes alors ?',
        keywords:['oui','non','recommande','je te le recommande','pas vraiment'] },
      { app:'D’accord, je le regarderai ce week-end alors, merci !' }
    ] },
    { id:'conv-text-a2', level:'A2', unit:'a2-daily', mode:'written', title:'Message entre amis (written)', turns:[
      { app:'Salut ! Ça te dit d’aller au cinéma samedi ?',
        keywords:['oui','non','d’accord','pourquoi pas','samedi','envie'],
        hint:'Essaie « Oui, pourquoi pas ! » ou « D’accord, avec plaisir »',
        hintEn:'Try "Oui, pourquoi pas !" (Yes, why not!) or "D’accord, avec plaisir" (Sure, gladly)' },
      { app:'Super ! Quel film tu veux voir ?',
        keywords:['film','comédie','action','veux','aimerais','regarder'],
        hint:'Essaie « J’aimerais bien voir une comédie »',
        hintEn:'Try "J’aimerais bien voir une comédie" (I’d like to see a comedy)' },
      { app:'Parfait, on se retrouve à quelle heure ?',
        keywords:['heure','à','vers','heures'],
        hint:'Essaie « Vers dix-neuf heures ? »',
        hintEn:'Try "Vers dix-neuf heures ?" (Around 7pm?)' },
      { app:'D’accord, à samedi !' }
    ] },
    { id:'conv-text-b1', level:'B1', unit:'b1-lifestyle', mode:'written', title:'E-mail à un professeur (written)', turns:[
      { app:'Bonjour, j’ai lu votre dernier devoir. Pouvez-vous m’expliquer votre méthode ?',
        keywords:['méthode','ai utilisé','pense','parce que','j’ai'],
        hint:'Essaie « J’ai utilisé un plan en trois parties parce que... »',
        hintEn:'Try "J’ai utilisé un plan en trois parties parce que..." (I used a three-part structure because...)' },
      { app:'Je vois. Et combien de temps y avez-vous consacré ?',
        keywords:['heures','temps','jours','environ','passé'],
        hint:'Essaie « J’y ai passé environ trois heures »',
        hintEn:'Try "J’y ai passé environ trois heures" (I spent about three hours on it)' },
      { app:'Merci beaucoup pour ces précisions, bonne continuation.',
        keywords:['merci','au revoir','bonne journée','professeur'],
        hint:'Essaie « Merci à vous, bonne journée ! »',
        hintEn:'Try "Merci à vous, bonne journée !" (Thank you, have a good day!)' },
      { app:'À bientôt !' }
    ] },
    { id:'conv-a1-hellos', level:'A1', unit:'a1-hellos', mode:'spoken', title:'Se rencontrer (spoken)', turns:[
      { app:'Bonjour ! Comment tu t’appelles ?',
        keywords:['je m’appelle','moi c’est'],
        hint:'Essaie « Je m’appelle... »',
        hintEn:'Try "Je m’appelle..." (My name is...)' },
      { app:'Enchanté ! Comment ça va ?',
        keywords:['ça va','bien','très bien'],
        hint:'Essaie « Ça va bien, merci »',
        hintEn:'Try "Ça va bien, merci" (I’m doing well, thanks)' },
      { app:'Super ! À bientôt !' }
    ] },
    { id:'conv-a1-numbers', level:'A1', unit:'a1-numbers', mode:'spoken', title:'Demander l’heure (spoken)', turns:[
      { app:'Excuse-moi, quelle heure est-il ?',
        keywords:['il est','heure'],
        hint:'Essaie « Il est... heures »',
        hintEn:'Try "Il est... heures" (It is... o’clock)' },
      { app:'Merci ! Le cours commence à quelle heure ?',
        keywords:['heure','commence','à'],
        hint:'Essaie « Il commence à... heures »',
        hintEn:'Try "Il commence à... heures" (It starts at... o’clock)' },
      { app:'D’accord, merci beaucoup !' }
    ] },
    { id:'conv-a1-family', level:'A1', unit:'a1-family', mode:'written', title:'Parler de sa famille (written)', turns:[
      { app:'Tu as des frères et sœurs ?',
        keywords:['oui','non','frère','sœur','j’ai'],
        hint:'Essaie « Oui, j’ai un frère » ou « Non, je n’ai pas de frère »',
        hintEn:'Try "Oui, j’ai un frère" (Yes, I have a brother) or "Non, je n’ai pas de frère" (No, I don’t have a brother)' },
      { app:'Et comment ils s’appellent ?',
        keywords:['s’appelle','s’appellent'],
        hint:'Essaie « Il/Elle s’appelle... »',
        hintEn:'Try "Il/Elle s’appelle..." (He/She is called...)' },
      { app:'Sympa ! Merci de me raconter.' }
    ] },
    { id:'conv-a1-objects', level:'A1', unit:'a1-objects', mode:'spoken', title:'Chercher un objet (spoken)', turns:[
      { app:'Excuse-moi, où est mon livre ?',
        keywords:['sur','dans','table','là'],
        hint:'Essaie « Il est sur la table »',
        hintEn:'Try "Il est sur la table" (It’s on the table)' },
      { app:'Ah, merci ! Et mon téléphone, tu l’as vu ?',
        keywords:['oui','non','sur','dans'],
        hint:'Essaie « Oui, il est dans ton sac »',
        hintEn:'Try "Oui, il est dans ton sac" (Yes, it’s in your bag)' },
      { app:'Parfait, merci beaucoup !' }
    ] },
    { id:'conv-a1-food', level:'A1', unit:'a1-food', mode:'written', title:'Commander à manger (written)', turns:[
      { app:'Qu’est-ce que tu veux manger ?',
        keywords:['je voudrais','du pain','une pomme','veux'],
        hint:'Essaie « Je voudrais du pain »',
        hintEn:'Try "Je voudrais du pain" (I’d like some bread)' },
      { app:'Et à boire ?',
        keywords:['eau','jus','veux','je voudrais'],
        hint:'Essaie « Je voudrais de l’eau »',
        hintEn:'Try "Je voudrais de l’eau" (I’d like some water)' },
      { app:'D’accord, ça arrive !' }
    ] },
    { id:'conv-a2-shopping', level:'A2', unit:'a2-shopping', mode:'spoken', title:'Au magasin de vêtements (spoken)', turns:[
      { app:'Bonjour, je peux vous aider ?',
        keywords:['je cherche','je voudrais','oui','merci'],
        hint:'Essaie « Je cherche une robe bleue »',
        hintEn:'Try "Je cherche une robe bleue" (I’m looking for a blue dress)' },
      { app:'Quelle taille faites-vous ?',
        keywords:['taille','moyenne','grande','petite'],
        hint:'Essaie « Je fais du/une taille moyenne »',
        hintEn:'Try "Je fais une taille moyenne" (I’m a medium size)' },
      { app:'D’accord, voilà. Ça vous va ?',
        keywords:['oui','parfait','merci','non'],
        hint:'Essaie « Oui, c’est parfait, merci »',
        hintEn:'Try "Oui, c’est parfait, merci" (Yes, that’s perfect, thanks)' },
      { app:'Parfait, merci de votre visite !' }
    ] },
    { id:'conv-a2-city', level:'A2', unit:'a2-city', mode:'spoken', title:'Dans le bus (spoken)', turns:[
      { app:'Excusez-moi, ce bus va bien au centre-ville ?',
        keywords:['oui','non','va','bus'],
        hint:'Essaie « Oui, il va au centre-ville »',
        hintEn:'Try "Oui, il va au centre-ville" (Yes, it goes to the town centre)' },
      { app:'Merci ! C’est loin d’ici ?',
        keywords:['minutes','loin','près','arrêts'],
        hint:'Essaie « Non, c’est à dix minutes »',
        hintEn:'Try "Non, c’est à dix minutes" (No, it’s ten minutes away)' },
      { app:'D’accord, vous pouvez me dire quand descendre ?',
        keywords:['oui','bien sûr','pas de problème'],
        hint:'Essaie « Oui, bien sûr »',
        hintEn:'Try "Oui, bien sûr" (Yes, of course)' },
      { app:'Merci beaucoup, c’est gentil !' }
    ] },
    { id:'conv-a2-health', level:'A2', unit:'a2-health', mode:'written', title:'Prendre rendez-vous chez le médecin (written)', turns:[
      { app:'Cabinet médical, bonjour. Que puis-je faire pour vous ?',
        keywords:['je voudrais','rendez-vous','malade'],
        hint:'Essaie « Je voudrais prendre rendez-vous »',
        hintEn:'Try "Je voudrais prendre rendez-vous" (I’d like to make an appointment)' },
      { app:'D’accord, quels sont vos symptômes ?',
        keywords:['mal','fièvre','fatigué','tousse'],
        hint:'Essaie « J’ai mal à la tête et de la fièvre »',
        hintEn:'Try "J’ai mal à la tête et de la fièvre" (I have a headache and a fever)' },
      { app:'Je vous propose demain à dix heures, ça vous convient ?',
        keywords:['oui','non','parfait','d’accord'],
        hint:'Essaie « Oui, ça me convient »',
        hintEn:'Try "Oui, ça me convient" (Yes, that works for me)' },
      { app:'Très bien, à demain !' }
    ] },
    { id:'conv-b1-relations', level:'B1', unit:'b1-relations', mode:'written', title:'Réconcilier deux amis (written)', turns:[
      { app:'Tu sais que Paul et Marie ne se parlent plus ?',
        keywords:['oui','non','pourquoi','dispute'],
        hint:'Essaie « Non, qu’est-ce qui s’est passé ? »',
        hintEn:'Try "Non, qu’est-ce qui s’est passé ?" (No, what happened?)' },
      { app:'Tu penses qu’ils devraient se réconcilier ?',
        keywords:['pense','oui','devrait','excuser'],
        hint:'Essaie « Oui, je pense qu’ils devraient s’excuser »',
        hintEn:'Try "Oui, je pense qu’ils devraient s’excuser" (Yes, I think they should apologize)' },
      { app:'Tu as raison. On devrait les aider.',
        keywords:['oui','d’accord','aider','bonne idée'],
        hint:'Essaie « Oui, bonne idée »',
        hintEn:'Try "Oui, bonne idée" (Yes, good idea)' },
      { app:'Merci de ton aide, à plus tard !' }
    ] },
    { id:'conv-b1-media', level:'B1', unit:'b1-media', mode:'spoken', title:'Choisir un film à regarder (spoken)', turns:[
      { app:'Qu’est-ce qu’on regarde ce soir ?',
        keywords:['film','série','regarder','veux'],
        hint:'Essaie « On pourrait regarder un film »',
        hintEn:'Try "On pourrait regarder un film" (We could watch a movie)' },
      { app:'Bonne idée, c’est quel genre ?',
        keywords:['comédie','action','drame','genre'],
        hint:'Essaie « C’est une comédie »',
        hintEn:'Try "C’est une comédie" (It’s a comedy)' },
      { app:'Parfait, ça me va !',
        keywords:['super','d’accord','parfait','oui'],
        hint:'Essaie « Super, allons-y »',
        hintEn:'Try "Super, allons-y" (Great, let’s go)' },
      { app:'Allons-y alors !' }
    ] },
    { id:'conv-b1-future', level:'B1', unit:'b1-future', mode:'written', title:'Parler de ses projets (written)', turns:[
      { app:'Qu’est-ce que tu comptes faire après tes études ?',
        keywords:['vais','compte','espère','veux'],
        hint:'Essaie « Je compte voyager un peu »',
        hintEn:'Try "Je compte voyager un peu" (I plan to travel a bit)' },
      { app:'Intéressant ! Et pourquoi ce choix ?',
        keywords:['parce que','aime','intéresse','passionne'],
        hint:'Essaie « Parce que ça me passionne »',
        hintEn:'Try "Parce que ça me passionne" (Because I’m passionate about it)' },
      { app:'Ça a l’air passionnant, bonne chance !',
        keywords:['merci','oui','j’espère'],
        hint:'Essaie « Merci beaucoup ! »',
        hintEn:'Try "Merci beaucoup !" (Thank you very much!)' },
      { app:'À bientôt, et bon courage pour la suite !' }
    ] },
    { id:'conv-b2-news', level:'B2', unit:'b2-news', mode:'spoken', title:'Débattre d’un sujet d’actualité (spoken)', turns:[
      { app:'Tu as suivi les infos sur la nouvelle réforme ?',
        keywords:['oui','non','entendu','vu'] },
      { app:'Et qu’est-ce que tu en penses ?',
        keywords:['pense','trouve','opinion','accord'] },
      { app:'Intéressant point de vue, merci de partager.',
        keywords:['merci','oui','d’accord'] },
      { app:'On en reparlera bientôt, à plus !' }
    ] },
    { id:'conv-b2-work', level:'B2', unit:'b2-work', mode:'spoken', title:'Discuter d’une reconversion (spoken)', turns:[
      { app:'J’ai entendu dire que tu envisages une reconversion professionnelle ?',
        keywords:['oui','non','envisage','pense'] },
      { app:'Vers quel domaine aimerais-tu te tourner ?',
        keywords:['domaine','secteur','aimerais','veux'] },
      { app:'Ça semble être un choix judicieux !',
        keywords:['merci','oui','j’espère'] },
      { app:'Je te souhaite bonne chance dans cette nouvelle voie !' }
    ] },
    { id:'conv-b2-arts', level:'B2', unit:'b2-arts', mode:'written', title:'Discuter d’une exposition (written)', turns:[
      { app:'Tu es allé voir la nouvelle exposition au musée ?',
        keywords:['oui','non','vu','visité'] },
      { app:'Qu’est-ce que tu en as pensé ?',
        keywords:['pense','trouve','impressionnant','intéressant'] },
      { app:'Ça donne envie d’y aller !',
        keywords:['oui','recommande','vaut le coup'] },
      { app:'Merci pour la recommandation !' }
    ] }
  ]
};

const LEVELS = ['A1','A2','B1','B2'];
const STORAGE_KEY = 'frenchTutorProgress_v1';

// Themed units — every skill's exercises for a unit share the same topic,
// so vocab reinforces across listening/reading/grammar/writing/speaking
// instead of each skill being a disconnected list.
const UNITS = {
  A1: [
    { id:'a1-hellos', title:'Salutations & se présenter', icon:'👋' },
    { id:'a1-numbers', title:'Les nombres & l’heure', icon:'🔢' },
    { id:'a1-family', title:'La famille & les couleurs', icon:'👪' },
    { id:'a1-objects', title:'Les objets du quotidien & la maison', icon:'🏠' },
    { id:'a1-food', title:'La nourriture & les boissons', icon:'🍞' }
  ],
  A2: [
    { id:'a2-greetings', title:'Se présenter', icon:'👋' },
    { id:'a2-daily', title:'La vie quotidienne & le café', icon:'☕' },
    { id:'a2-shopping', title:'Achats & rendez-vous', icon:'🛍️' },
    { id:'a2-city', title:'En ville & les transports', icon:'🚌' },
    { id:'a2-health', title:'La santé & le corps', icon:'🩺' }
  ],
  B1: [
    { id:'b1-travel', title:'Sorties & voyages', icon:'🧳' },
    { id:'b1-lifestyle', title:'Style de vie & travail', icon:'💼' },
    { id:'b1-relations', title:'Relations & sentiments', icon:'❤️' },
    { id:'b1-media', title:'Médias & loisirs', icon:'📺' },
    { id:'b1-future', title:'Projets & avenir', icon:'🎯' }
  ],
  B2: [
    { id:'b2-society', title:'Société & environnement', icon:'🌍' },
    { id:'b2-culture', title:'Technologie & culture', icon:'🎭' },
    { id:'b2-news', title:'Actualités & débats', icon:'📰' },
    { id:'b2-work', title:'Monde du travail & économie', icon:'📈' },
    { id:'b2-arts', title:'Arts & littérature', icon:'🎨' }
  ]
};
const SKILL_ORDER = ['vocabulary','listening','reading','grammar','writing','speaking','conversation'];
const SKILL_META = {
  vocabulary:{ label:'Vocabulary', icon:'library' },
  listening:{ label:'Listening', icon:'headphones' },
  reading:{ label:'Reading', icon:'book-open' },
  grammar:{ label:'Grammar', icon:'spell-check' },
  writing:{ label:'Writing', icon:'pencil' },
  speaking:{ label:'Speaking', icon:'mic' },
  conversation:{ label:'Conversation', icon:'message-circle' }
};

// ── Progress storage (localStorage only — no account) ──────────
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { attempts: [] };
  } catch (e) { return { attempts: [] }; }
}
function saveAttempt(attempt) {
  const data = loadProgress();
  data.attempts.push({ ...attempt, timestamp: Date.now() });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}
function attemptsFor(exerciseId) {
  return loadProgress().attempts.filter(a => a.exerciseId === exerciseId);
}
function clearProgress() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

// ── Text helpers ─────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function stripAccents(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function normalize(s) {
  return stripAccents(String(s ?? '').toLowerCase())
    // Straight (') and typographic (') apostrophes must compare equal —
    // authored content uses typographic quotes, but a keyboard types straight ones.
    .replace(/[.,!?;:"«»()'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function wordCount(s) {
  return normalize(s).split(' ').filter(Boolean).length;
}
function containsPhrase(haystackNorm, phrase) {
  return haystackNorm.includes(normalize(phrase));
}
function keywordCoverage(text, keywords) {
  if (!keywords || !keywords.length) return null;
  const n = normalize(text);
  const hits = keywords.filter(k => containsPhrase(n, k));
  return { hits, ratio: hits.length / keywords.length };
}
/**
 * French feedback for every level, plus an English line underneath for
 * A2/B1 — B2 learners get French only, so the training wheels come off
 * as they progress. frHtml/enHtml may contain markup; callers are
 * responsible for escaping any dynamic text they interpolate into them.
 */
function bi(level, frHtml, enHtml) {
  if (level === 'B2' || !enHtml) return `<div>${frHtml}</div>`;
  return `<div>${frHtml}</div><div class="feedback-en">${enHtml}</div>`;
}
/** Same idea as bi(), but for a short label that continues on the same line as French content (e.g. a label followed by the actual sentence/number) instead of standing alone. */
function biLabel(level, frLabel, enLabel) {
  if (level === 'B2' || !enLabel) return frLabel;
  return `${frLabel} <span class="feedback-en-inline">(${enLabel})</span>`;
}
function ltFailedMessage(level) {
  return bi(level, 'La vérification grammaticale n’est pas disponible pour le moment — voici un score de base.', 'Grammar check is unavailable right now — this is a basic score.');
}
function noIssuesMessage(level) {
  return bi(level, 'Aucune erreur de grammaire ou d’orthographe trouvée. Bravo !', 'No grammar or spelling issues found. Well done!');
}
function lcsWordCount(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[n][m];
}

// ── Text-to-speech ───────────────────────────────────────────
let _voices = [];
function _loadVoices() { _voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
if (window.speechSynthesis) {
  _loadVoices();
  window.speechSynthesis.onvoiceschanged = _loadVoices;
}
// Named voices known to sound noticeably more natural than default offline
// OS voices (e.g. Chrome's networked "Google français", Edge's "Online
// (Natural)" voices). Ranked ahead of everything else when present.
const PREFERRED_VOICE_NAMES = [
  'google français', 'google francais', 'natural', 'denise', 'henri', 'paul', 'julie', 'amelie', 'amélie', 'thomas', 'audrey', 'virginie'
];
function pickFrenchVoice() {
  const fr = _voices.filter(v => (v.lang || '').toLowerCase().startsWith('fr'));
  if (!fr.length) return null;
  const scored = fr.map(v => {
    let score = 0;
    if (v.lang === 'fr-FR') score += 2;
    if (v.localService === false) score += 3; // networked voices are usually higher quality than bundled offline ones
    if (PREFERRED_VOICE_NAMES.some(n => v.name.toLowerCase().includes(n))) score += 5;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const v = pickFrenchVoice();
  if (v) u.voice = v;
  u.rate = 0.94;
  window.speechSynthesis.speak(u);
}

// ── Speech-to-text ───────────────────────────────────────────
function supportsSTT() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function createRecognizer(handlers) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'fr-FR';
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  let finalTranscript = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t + ' '; else interim += t;
    }
    handlers.onUpdate && handlers.onUpdate(finalTranscript.trim(), interim.trim());
  };
  rec.onerror = (e) => handlers.onError && handlers.onError(e.error);
  rec.onend = () => handlers.onEnd && handlers.onEnd(finalTranscript.trim());
  return {
    start() { finalTranscript = ''; try { rec.start(); } catch (e) { handlers.onError && handlers.onError(e.message); } },
    stop() { try { rec.stop(); } catch (e) {} }
  };
}

// ── Grading ──────────────────────────────────────────────────
async function checkWithLanguageTool(text) {
  const res = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text, language: 'fr' })
  });
  if (!res.ok) throw new Error('LanguageTool request failed');
  const data = await res.json();
  return data.matches || [];
}

/** Grades free-form French text: LanguageTool grammar/spelling + optional keyword coverage. */
async function gradeFreeText(text, opts = {}) {
  const words = wordCount(text);
  let matches = [], ltFailed = false;
  try {
    matches = await checkWithLanguageTool(text);
  } catch (e) {
    ltFailed = true;
  }

  let grammarScore;
  if (ltFailed) {
    grammarScore = Math.min(100, Math.max(40, words * 3));
  } else {
    const penalty = Math.min(100, (matches.length / Math.max(words, 1)) * 300);
    grammarScore = Math.round(Math.max(0, 100 - penalty));
  }

  const coverage = keywordCoverage(text, opts.expectedKeywords);
  let score = grammarScore;
  if (coverage) score = Math.round(grammarScore * 0.6 + coverage.ratio * 100 * 0.4);

  if (opts.minWords && words < opts.minWords) score = Math.min(score, 60);

  const corrections = matches.slice(0, 8).map(m => ({
    message: m.message,
    suggestion: m.replacements && m.replacements[0] ? m.replacements[0].value : null,
    context: text.substring(Math.max(0, m.offset - 15), m.offset + m.length + 15)
  }));

  return { score: Math.max(0, Math.min(100, score)), words, matches: matches.length, corrections, ltFailed, coverage };
}

function gradeDictation(userText, targetText) {
  const targetWords = normalize(targetText).split(' ').filter(Boolean);
  const userWords = normalize(userText).split(' ').filter(Boolean);
  const lcs = lcsWordCount(targetWords, userWords);
  const score = targetWords.length ? Math.round((lcs / targetWords.length) * 100) : 0;
  const userSet = new Set(userWords);
  const highlight = targetWords.map(w => ({ word: w, hit: userSet.has(w) }));
  return { score, highlight };
}

// ── State ────────────────────────────────────────────────────
const state = {
  level: 'A2',
  currentId: { vocabulary: null, listening: null, reading: null, grammar: null, writing: null, speaking: null, conversation: null }
};

function exercisesFor(skill) {
  return CONTENT[skill].filter(x => x.level === state.level);
}
function ensureCurrent(skill) {
  const list = exercisesFor(skill);
  if (!list.length) { state.currentId[skill] = null; return null; }
  if (!list.find(x => x.id === state.currentId[skill])) state.currentId[skill] = list[0].id;
  return CONTENT[skill].find(x => x.id === state.currentId[skill]);
}

// ── Chips (shared) ──────────────────────────────────────────
function renderChips(skill) {
  const list = exercisesFor(skill);
  const wrap = document.getElementById(skill + '-chips');
  wrap.innerHTML = list.map(x => {
    const done = attemptsFor(x.id).length > 0;
    const active = x.id === state.currentId[skill];
    const modeIcon = skill === 'conversation' ? (x.mode === 'written' ? '✍️ ' : '🎤 ') : '';
    return `<button class="chip${active ? ' active' : ''}${done ? ' done' : ''}" data-skill="${skill}" data-id="${x.id}">${modeIcon}${esc(x.title)}</button>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentId[skill] = btn.dataset.id;
      renderTab(skill);
    });
  });
}

// ── Feedback rendering helper ────────────────────────────────
function feedbackClass(score) { return score >= 75 ? 'good' : (score >= 45 ? 'mid' : 'bad'); }
function scoreBadge(score) { return `<div class="score-badge">Score: ${score}/100</div>`; }

// ── Units overview ───────────────────────────────────────────
function renderUnits() {
  const box = document.getElementById('units-content');
  const units = UNITS[state.level] || [];

  const unitStats = units.map(u => {
    const items = SKILL_ORDER.flatMap(skill =>
      CONTENT[skill].filter(x => x.level === state.level && x.unit === u.id).map(x => ({ skill, ex: x }))
    );
    const done = items.filter(it => attemptsFor(it.ex.id).length > 0).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    return { unit: u, items, pct };
  });
  // Soft nudge only — nothing below is ever locked or unclickable.
  const nudge = unitStats.find(s => s.pct < 100);

  box.innerHTML = unitStats.map(({ unit, items, pct }) => `
    <div class="unit-card">
      <div class="unit-head">
        <div class="unit-icon">${unit.icon}</div>
        <div class="unit-title-wrap">
          <div class="unit-title">${esc(unit.title)}</div>
          ${nudge && unit.id === nudge.unit.id ? '<div class="unit-nudge">Continue here</div>' : ''}
        </div>
        <div class="unit-ring-outer" style="background:conic-gradient(#4d8dff ${pct}%, rgba(255,255,255,0.10) 0)">
          <div class="unit-ring-inner">${pct}%</div>
        </div>
      </div>
      <div class="unit-rows">
        ${items.map(({ skill, ex: x }) => {
          const done = attemptsFor(x.id).length > 0;
          return `<button class="unit-row" data-skill="${skill}" data-id="${x.id}">
            <i data-lucide="${SKILL_META[skill].icon}" style="width:15px;height:15px;"></i>
            <span class="unit-row-label">${SKILL_META[skill].label}</span>
            <span class="unit-row-title">${esc(x.title)}</span>
            ${done ? '<span class="unit-row-check">✓</span>' : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');

  window.lucide && window.lucide.createIcons();
  box.querySelectorAll('.unit-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const skill = btn.dataset.skill, id = btn.dataset.id;
      state.currentId[skill] = id;
      selectTab(skill);
    });
  });
}

// ── Vocabulary tab ───────────────────────────────────────────
function renderVocabulary() {
  renderChips('vocabulary');
  const ex = ensureCurrent('vocabulary');
  const box = document.getElementById('vocabulary-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No exercises at this level yet.</p>'; return; }

  box.innerHTML = `
    <div class="card">
      <div class="card-eyebrow">Vocabulary · ${ex.level}</div>
      <div class="card-title french" style="font-size:26px;">« ${esc(ex.word)} »</div>
      <button class="speak-btn" id="voc-play"><i data-lucide="volume-2" style="width:14px;height:14px;"></i> Play word</button>
      <div class="card-body"><strong>${biLabel(ex.level, 'Que veut dire ce mot ?', 'What does this word mean?')}</strong></div>
      <div id="voc-options"></div>
      <div class="feedback" id="voc-feedback"></div>
    </div>`;
  const optWrap = document.getElementById('voc-options');
  optWrap.innerHTML = ex.options.map((o, i) => `<div class="mcq-option" data-i="${i}">${esc(o)}</div>`).join('');
  window.lucide && window.lucide.createIcons();
  document.getElementById('voc-play').addEventListener('click', () => speak(ex.word));

  optWrap.querySelectorAll('.mcq-option').forEach(opt => {
    opt.addEventListener('click', () => {
      if (optWrap.dataset.answered) return;
      optWrap.dataset.answered = '1';
      const i = Number(opt.dataset.i);
      optWrap.querySelectorAll('.mcq-option').forEach(o => o.classList.add('disabled'));
      opt.classList.add(i === ex.answer ? 'correct' : 'wrong');
      if (i !== ex.answer) optWrap.children[ex.answer].classList.add('correct');
      const score = i === ex.answer ? 100 : 0;
      const fb = document.getElementById('voc-feedback');
      fb.className = 'feedback show ' + feedbackClass(score);
      fb.innerHTML = scoreBadge(score) + (score === 100
        ? 'Correct !'
        : bi(ex.level, `« ${esc(ex.word)} » veut dire « ${esc(ex.options[ex.answer])} ».`, `"${esc(ex.word)}" means "${esc(ex.options[ex.answer])}".`));
      saveAttempt({ skill: 'vocabulary', exerciseId: ex.id, level: ex.level, score });
      renderChips('vocabulary');
    });
  });
}

// ── Listening tab ────────────────────────────────────────────
function renderListening() {
  renderChips('listening');
  const ex = ensureCurrent('listening');
  const box = document.getElementById('listening-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No exercises at this level yet.</p>'; return; }

  if (ex.type === 'dictation') {
    box.innerHTML = `
      <div class="card">
        <div class="card-eyebrow">Listening · Dictation · ${ex.level}</div>
        <div class="card-title">${esc(ex.title)}</div>
        <button class="speak-btn" id="lis-play"><i data-lucide="volume-2" style="width:14px;height:14px;"></i> Play audio</button>
        <div class="card-body">Type exactly what you hear. Play it as many times as you need.</div>
        <textarea id="lis-input" rows="3" placeholder="Écris ce que tu entends…"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="lis-check"><i data-lucide="check" style="width:14px;height:14px;"></i> Check</button>
        </div>
        <div class="feedback" id="lis-feedback"></div>
      </div>`;
    window.lucide && window.lucide.createIcons();
    document.getElementById('lis-play').addEventListener('click', () => speak(ex.audioText));
    document.getElementById('lis-check').addEventListener('click', () => {
      const val = document.getElementById('lis-input').value;
      const { score, highlight } = gradeDictation(val, ex.audioText);
      const fb = document.getElementById('lis-feedback');
      fb.className = 'feedback show ' + feedbackClass(score);
      const words = highlight.map(h => `<span style="color:${h.hit ? '#8ff0cf' : '#fca5a5'}">${esc(h.word)}</span>`).join(' ');
      fb.innerHTML = scoreBadge(score) + `<div>${biLabel(ex.level, 'Phrase correcte :', 'Correct sentence:')} ${words}</div>`;
      saveAttempt({ skill: 'listening', exerciseId: ex.id, level: ex.level, score });
      renderChips('listening');
    });
  } else {
    box.innerHTML = `
      <div class="card">
        <div class="card-eyebrow">Listening · Comprehension · ${ex.level}</div>
        <div class="card-title">${esc(ex.title)}</div>
        <button class="speak-btn" id="lis-play"><i data-lucide="volume-2" style="width:14px;height:14px;"></i> Play audio</button>
        <div class="card-body"><strong>${esc(ex.question)}</strong></div>
        <div id="lis-options"></div>
        <div class="feedback" id="lis-feedback"></div>
      </div>`;
    const optWrap = document.getElementById('lis-options');
    optWrap.innerHTML = ex.options.map((o, i) => `<div class="mcq-option" data-i="${i}">${esc(o)}</div>`).join('');
    window.lucide && window.lucide.createIcons();
    document.getElementById('lis-play').addEventListener('click', () => speak(ex.audioText));
    optWrap.querySelectorAll('.mcq-option').forEach(opt => {
      opt.addEventListener('click', () => {
        if (optWrap.dataset.answered) return;
        optWrap.dataset.answered = '1';
        const i = Number(opt.dataset.i);
        optWrap.querySelectorAll('.mcq-option').forEach(o => o.classList.add('disabled'));
        opt.classList.add(i === ex.answer ? 'correct' : 'wrong');
        if (i !== ex.answer) optWrap.children[ex.answer].classList.add('correct');
        const score = i === ex.answer ? 100 : 0;
        const fb = document.getElementById('lis-feedback');
        fb.className = 'feedback show ' + feedbackClass(score);
        fb.innerHTML = scoreBadge(score) + (score === 100
          ? 'Correct !'
          : bi(ex.level, `La bonne réponse était « ${esc(ex.options[ex.answer])} ».`, `The correct answer was "${esc(ex.options[ex.answer])}".`));
        saveAttempt({ skill: 'listening', exerciseId: ex.id, level: ex.level, score });
        renderChips('listening');
      });
    });
  }
}

// ── Reading tab ──────────────────────────────────────────────
function renderReading() {
  renderChips('reading');
  const ex = ensureCurrent('reading');
  const box = document.getElementById('reading-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No exercises at this level yet.</p>'; return; }

  box.innerHTML = `
    <div class="card">
      <div class="card-eyebrow">Reading · ${ex.level}</div>
      <div class="card-title">${esc(ex.title)}</div>
      <button class="speak-btn" id="read-play"><i data-lucide="volume-2" style="width:14px;height:14px;"></i> Listen to passage</button>
      <div class="card-body french">${esc(ex.passage)}</div>
      <div id="read-questions" style="margin-top:16px;"></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="read-check"><i data-lucide="check" style="width:14px;height:14px;"></i> Check answers</button>
      </div>
      <div class="feedback" id="read-feedback"></div>
      ${ex.written ? `
        <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);">
          <div class="card-eyebrow">Written response</div>
          <div class="card-body">${esc(ex.written.prompt)}</div>
          <textarea id="read-written-input" rows="3" placeholder="Réponds en français…"></textarea>
          <div class="btn-row">
            <button class="btn btn-primary" id="read-written-check"><i data-lucide="sparkles" style="width:14px;height:14px;"></i> Get feedback</button>
          </div>
          <div class="feedback" id="read-written-feedback"></div>
        </div>
      ` : ''}
    </div>`;
  const qWrap = document.getElementById('read-questions');
  qWrap.innerHTML = ex.questions.map((q, qi) => `
    <div style="margin-bottom:16px;">
      <div class="card-body"><strong>${qi + 1}. ${esc(q.q)}</strong></div>
      <div class="q-options" data-qi="${qi}">
        ${q.options.map((o, i) => `<div class="mcq-option" data-i="${i}">${esc(o)}</div>`).join('')}
      </div>
    </div>`).join('');
  window.lucide && window.lucide.createIcons();
  document.getElementById('read-play').addEventListener('click', () => speak(ex.passage));

  qWrap.querySelectorAll('.q-options').forEach(group => {
    group.querySelectorAll('.mcq-option').forEach(opt => {
      opt.addEventListener('click', () => {
        group.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
  });

  document.getElementById('read-check').addEventListener('click', () => {
    let correct = 0;
    qWrap.querySelectorAll('.q-options').forEach(group => {
      const qi = Number(group.dataset.qi);
      const q = ex.questions[qi];
      const selected = group.querySelector('.mcq-option.selected');
      const selI = selected ? Number(selected.dataset.i) : -1;
      group.querySelectorAll('.mcq-option').forEach(o => o.classList.add('disabled'));
      if (selI === q.answer) correct++;
      group.children[q.answer].classList.add('correct');
      if (selI !== -1 && selI !== q.answer) group.children[selI].classList.add('wrong');
    });
    const score = Math.round((correct / ex.questions.length) * 100);
    const fb = document.getElementById('read-feedback');
    fb.className = 'feedback show ' + feedbackClass(score);
    fb.innerHTML = scoreBadge(score) + bi(ex.level, `${correct} sur ${ex.questions.length} bonnes réponses.`, `${correct} of ${ex.questions.length} correct.`);
    saveAttempt({ skill: 'reading', exerciseId: ex.id, level: ex.level, score });
    renderChips('reading');
  });

  if (ex.written) {
    document.getElementById('read-written-check').addEventListener('click', async () => {
      const text = document.getElementById('read-written-input').value.trim();
      if (!text) return;
      const btn = document.getElementById('read-written-check');
      btn.disabled = true; btn.textContent = 'Checking…';
      const result = await gradeFreeText(text, { expectedKeywords: ex.written.keywords });
      btn.disabled = false; btn.innerHTML = '<i data-lucide="sparkles" style="width:14px;height:14px;"></i> Get feedback';
      window.lucide && window.lucide.createIcons();

      const fb = document.getElementById('read-written-feedback');
      fb.className = 'feedback show ' + feedbackClass(result.score);
      let html = scoreBadge(result.score);
      if (result.ltFailed) html += ltFailedMessage(ex.level);
      else if (result.corrections.length) {
        html += `<ul class="correction-list">` +
          result.corrections.map(c => `<li>${esc(c.message)}${c.suggestion ? ` — try <span class="correction-fix">${esc(c.suggestion)}</span>` : ''}</li>`).join('') +
          `</ul>`;
      } else {
        html += noIssuesMessage(ex.level);
      }
      fb.innerHTML = html;
      saveAttempt({ skill: 'reading', exerciseId: ex.id + '-written', level: ex.level, score: result.score });
    });
  }
}

// ── Grammar tab ──────────────────────────────────────────────
function renderGrammar() {
  renderChips('grammar');
  const ex = ensureCurrent('grammar');
  const box = document.getElementById('grammar-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No exercises at this level yet.</p>'; return; }

  box.innerHTML = `
    <div class="card">
      <div class="card-eyebrow">Grammar · ${ex.level}</div>
      <div class="card-title">${esc(ex.title)}</div>
      <div class="blank-sentence">${esc(ex.before)}<input type="text" class="blank-input" id="gr-input" autocomplete="off">${esc(ex.after)}</div>
      <div class="btn-row">
        <button class="btn btn-primary" id="gr-check"><i data-lucide="check" style="width:14px;height:14px;"></i> Check</button>
      </div>
      <div class="feedback" id="gr-feedback"></div>
    </div>`;
  window.lucide && window.lucide.createIcons();

  document.getElementById('gr-check').addEventListener('click', () => {
    const val = document.getElementById('gr-input').value;
    const ok = ex.accepted.some(a => normalize(a) === normalize(val));
    const score = ok ? 100 : 0;
    const fb = document.getElementById('gr-feedback');
    fb.className = 'feedback show ' + feedbackClass(score);
    const answerLine = ok ? 'Correct !' : `<div>${biLabel(ex.level, 'Réponse correcte :', 'Correct answer:')} <span class="correction-fix">${esc(ex.accepted[0])}</span></div>`;
    fb.innerHTML = scoreBadge(score) + answerLine +
      `<div style="margin-top:6px;">${bi(ex.level, esc(ex.explanation), esc(ex.explanationEn))}</div>`;
    saveAttempt({ skill: 'grammar', exerciseId: ex.id, level: ex.level, score });
    renderChips('grammar');
  });
}

// ── Writing tab ──────────────────────────────────────────────
function renderWriting() {
  renderChips('writing');
  const ex = ensureCurrent('writing');
  const box = document.getElementById('writing-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No exercises at this level yet.</p>'; return; }

  box.innerHTML = `
    <div class="card">
      <div class="card-eyebrow">Writing · ${ex.level} · at least ${ex.minWords} words</div>
      <div class="card-title">${esc(ex.title)}</div>
      <div class="card-body french">${esc(ex.prompt)}</div>
      <textarea id="wr-input" rows="7" placeholder="Écris ta réponse en français…"></textarea>
      <div class="word-count" id="wr-count">0 words</div>
      <div class="btn-row">
        <button class="btn btn-primary" id="wr-check"><i data-lucide="sparkles" style="width:14px;height:14px;"></i> Get feedback</button>
      </div>
      <div class="feedback" id="wr-feedback"></div>
    </div>`;
  window.lucide && window.lucide.createIcons();
  const input = document.getElementById('wr-input');
  const count = document.getElementById('wr-count');
  input.addEventListener('input', () => { count.textContent = wordCount(input.value) + ' words'; });

  document.getElementById('wr-check').addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    const btn = document.getElementById('wr-check');
    btn.disabled = true; btn.textContent = 'Checking…';
    const result = await gradeFreeText(text, { minWords: ex.minWords });
    btn.disabled = false; btn.innerHTML = '<i data-lucide="sparkles" style="width:14px;height:14px;"></i> Get feedback';
    window.lucide && window.lucide.createIcons();

    const fb = document.getElementById('wr-feedback');
    fb.className = 'feedback show ' + feedbackClass(result.score);
    let html = scoreBadge(result.score);
    if (result.ltFailed) html += ltFailedMessage(ex.level);
    else if (result.corrections.length) {
      html += `<div>${biLabel(ex.level, `${result.matches} chose${result.matches === 1 ? '' : 's'} à vérifier :`, `${result.matches} thing${result.matches === 1 ? '' : 's'} to look at:`)}</div><ul class="correction-list">` +
        result.corrections.map(c => `<li>${esc(c.message)}${c.suggestion ? ` — try <span class="correction-fix">${esc(c.suggestion)}</span>` : ''}</li>`).join('') +
        `</ul>`;
    } else {
      html += noIssuesMessage(ex.level);
    }
    if (result.words < ex.minWords) {
      html += `<div style="margin-top:8px;">${bi(ex.level,
        `Essaie d’écrire au moins ${ex.minWords} mots pour une pratique plus complète (tu as écrit ${result.words}).`,
        `Try writing at least ${ex.minWords} words for fuller practice (you wrote ${result.words}).`)}</div>`;
    }
    fb.innerHTML = html;

    saveAttempt({ skill: 'writing', exerciseId: ex.id, level: ex.level, score: result.score });
    renderChips('writing');
  });
}

// ── Speaking tab ─────────────────────────────────────────────
function renderSpeaking() {
  renderChips('speaking');
  const ex = ensureCurrent('speaking');
  const box = document.getElementById('speaking-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No exercises at this level yet.</p>'; return; }

  const sttOk = supportsSTT();
  box.innerHTML = `
    <div class="card">
      <div class="card-eyebrow">Speaking · ${ex.level}</div>
      <div class="card-title">${esc(ex.title)}</div>
      <button class="speak-btn" id="sp-play"><i data-lucide="volume-2" style="width:14px;height:14px;"></i> Hear the prompt</button>
      <div class="card-body french">${esc(ex.prompt)}</div>
      ${sttOk ? `
        <div class="mic-row">
          <button class="mic-btn" id="sp-mic"><i data-lucide="mic" style="width:20px;height:20px;"></i></button>
          <span class="mic-status" id="sp-status">Tap to speak in French</span>
        </div>
        <div class="transcript-box" id="sp-transcript"></div>
        <div class="btn-row">
          <button class="btn btn-primary" id="sp-check" disabled><i data-lucide="check" style="width:14px;height:14px;"></i> Grade my answer</button>
        </div>
      ` : `
        <div class="unsupported-note">Speech recognition isn’t available in this browser. Type what you would say instead — everything else about grading still works.</div>
        <textarea id="sp-input" rows="4" placeholder="Écris ce que tu dirais…"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="sp-check"><i data-lucide="check" style="width:14px;height:14px;"></i> Grade my answer</button>
        </div>
      `}
      <div class="feedback" id="sp-feedback"></div>
    </div>`;
  window.lucide && window.lucide.createIcons();
  document.getElementById('sp-play').addEventListener('click', () => speak(ex.prompt));

  let transcript = '';
  if (sttOk) {
    let recognizing = false;
    const micBtn = document.getElementById('sp-mic');
    const status = document.getElementById('sp-status');
    const box2 = document.getElementById('sp-transcript');
    const checkBtn = document.getElementById('sp-check');
    const rec = createRecognizer({
      onUpdate(finalText, interim) {
        transcript = finalText;
        box2.textContent = (finalText + ' ' + interim).trim();
        checkBtn.disabled = !transcript;
      },
      onError(err) {
        status.textContent = err === 'not-allowed' ? 'Microphone access denied.' : ('Error: ' + err);
        micBtn.classList.remove('recording');
        recognizing = false;
      },
      onEnd() {
        micBtn.classList.remove('recording');
        recognizing = false;
        status.textContent = transcript ? 'Recording stopped.' : 'Didn’t catch that — try again.';
      }
    });
    micBtn.addEventListener('click', () => {
      if (!rec) return;
      if (recognizing) { rec.stop(); return; }
      recognizing = true;
      micBtn.classList.add('recording');
      status.textContent = 'Listening…';
      rec.start();
    });
  }

  document.getElementById('sp-check').addEventListener('click', async () => {
    const text = sttOk ? transcript : document.getElementById('sp-input').value.trim();
    if (!text) return;
    const btn = document.getElementById('sp-check');
    btn.disabled = true; btn.textContent = 'Checking…';
    const result = await gradeFreeText(text, { expectedKeywords: ex.keywords });
    btn.disabled = false; btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i> Grade my answer';
    window.lucide && window.lucide.createIcons();

    const fb = document.getElementById('sp-feedback');
    fb.className = 'feedback show ' + feedbackClass(result.score);
    let html = scoreBadge(result.score) + `<div>${biLabel(ex.level, 'Ce que tu as dit :', 'What you said:')} “${esc(text)}”</div>`;
    if (result.coverage) {
      html += `<div style="margin-top:6px;">${bi(ex.level,
        `${result.coverage.hits.length}/${ex.keywords.length} idées clés couvertes.`,
        `Covered ${result.coverage.hits.length}/${ex.keywords.length} key ideas.`)}</div>`;
    }
    if (result.corrections.length) {
      html += `<ul class="correction-list">` +
        result.corrections.map(c => `<li>${esc(c.message)}${c.suggestion ? ` — try <span class="correction-fix">${esc(c.suggestion)}</span>` : ''}</li>`).join('') +
        `</ul>`;
    }
    fb.innerHTML = html;
    saveAttempt({ skill: 'speaking', exerciseId: ex.id, level: ex.level, score: result.score });
    renderChips('speaking');
  });
}

// ── Conversation tab ─────────────────────────────────────────
function renderConversation() {
  renderChips('conversation');
  const ex = ensureCurrent('conversation');
  const box = document.getElementById('conversation-content');
  if (!ex) { box.innerHTML = '<p class="empty-note">No conversations at this level yet.</p>'; return; }

  const useVoice = supportsSTT() && ex.mode !== 'written';
  box.innerHTML = `
    <div class="card">
      <div class="card-eyebrow">Conversation · ${ex.mode === 'written' ? 'Written' : 'Spoken'} · ${ex.level}</div>
      <div class="card-title">${esc(ex.title)}</div>
      ${ex.mode === 'written' ? '<div class="card-body">Read each line and type your reply — no mic needed.</div>' : ''}
      <div class="convo-log" id="convo-log"></div>
      <div id="convo-controls"></div>
      <div class="btn-row">
        <button class="btn" id="convo-restart"><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> Restart</button>
      </div>
    </div>`;
  window.lucide && window.lucide.createIcons();

  const log = document.getElementById('convo-log');
  const controls = document.getElementById('convo-controls');
  let turnIndex = 0;
  let retries = 0;
  let scores = [];

  function addBubble(cls, text) {
    const div = document.createElement('div');
    div.className = 'convo-bubble ' + cls;
    div.textContent = text;
    log.appendChild(div);
    return div;
  }
  function addBubbleHtml(cls, html) {
    const div = document.createElement('div');
    div.className = 'convo-bubble ' + cls;
    div.innerHTML = html;
    log.appendChild(div);
    return div;
  }

  function playAppTurn() {
    const turn = ex.turns[turnIndex];
    addBubble('app', turn.app);
    if (ex.mode !== 'written') speak(turn.app);
    window.lucide && window.lucide.createIcons();
    if (!turn.keywords) {
      controls.innerHTML = `<div class="feedback show good">${scoreBadge(Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1)) || 100)}${bi(ex.level, 'Conversation terminée !', 'Conversation complete!')}</div>`;
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
      saveAttempt({ skill: 'conversation', exerciseId: ex.id, level: ex.level, score: avg });
      renderChips('conversation');
      return;
    }
    renderUserControls(turn);
  }

  function renderUserControls(turn) {
    if (useVoice) {
      controls.innerHTML = `
        <div class="mic-row">
          <button class="mic-btn" id="convo-mic"><i data-lucide="mic" style="width:20px;height:20px;"></i></button>
          <span class="mic-status" id="convo-status">Tap to reply in French</span>
        </div>
        <div class="transcript-box" id="convo-transcript"></div>
        <div class="btn-row">
          <button class="btn btn-primary" id="convo-send" disabled><i data-lucide="send" style="width:14px;height:14px;"></i> Send</button>
        </div>`;
    } else {
      controls.innerHTML = `
        ${ex.mode !== 'written' ? '<div class="unsupported-note">Speech recognition isn’t available — type your reply instead.</div>' : ''}
        <input type="text" id="convo-input" placeholder="Écris ta réponse…">
        <div class="btn-row">
          <button class="btn btn-primary" id="convo-send"><i data-lucide="send" style="width:14px;height:14px;"></i> Send</button>
        </div>`;
    }
    window.lucide && window.lucide.createIcons();

    let transcript = '';
    if (useVoice) {
      let recognizing = false;
      const micBtn = document.getElementById('convo-mic');
      const status = document.getElementById('convo-status');
      const tBox = document.getElementById('convo-transcript');
      const sendBtn = document.getElementById('convo-send');
      const rec = createRecognizer({
        onUpdate(finalText, interim) {
          transcript = finalText;
          tBox.textContent = (finalText + ' ' + interim).trim();
          sendBtn.disabled = !transcript;
        },
        onError(err) {
          status.textContent = err === 'not-allowed' ? 'Microphone access denied.' : ('Error: ' + err);
          micBtn.classList.remove('recording');
          recognizing = false;
        },
        onEnd() {
          micBtn.classList.remove('recording');
          recognizing = false;
          status.textContent = transcript ? 'Got it.' : 'Didn’t catch that — try again.';
        }
      });
      micBtn.addEventListener('click', () => {
        if (!rec) return;
        if (recognizing) { rec.stop(); return; }
        recognizing = true;
        micBtn.classList.add('recording');
        status.textContent = 'Listening…';
        rec.start();
      });
    }

    document.getElementById('convo-send').addEventListener('click', () => {
      const text = useVoice ? transcript : document.getElementById('convo-input').value.trim();
      if (!text) return;
      addBubble('user', text);
      const coverage = keywordCoverage(text, turn.keywords);
      if (coverage.ratio > 0) {
        scores.push(Math.max(40, 100 - retries * 20));
        retries = 0;
        turnIndex++;
        controls.innerHTML = '';
        setTimeout(playAppTurn, 500);
      } else {
        retries++;
        const hintFr = turn.hint || 'Réessaie — réécoute la ligne si tu en as besoin.';
        const hintEn = turn.hintEn || 'Try again — listen to the line again if you need to.';
        addBubbleHtml('hint', bi(ex.level, esc(hintFr), esc(hintEn)));
        renderUserControls(turn);
      }
    });
  }

  document.getElementById('convo-restart').addEventListener('click', () => {
    log.innerHTML = ''; controls.innerHTML = ''; turnIndex = 0; retries = 0; scores = [];
    playAppTurn();
  });

  playAppTurn();
}

// ── Progress tab ─────────────────────────────────────────────
function renderProgress() {
  const box = document.getElementById('progress-content');
  const data = loadProgress();
  const attempts = data.attempts;

  if (!attempts.length) {
    box.innerHTML = `<p class="empty-note">No practice yet — finish an exercise in any tab and it’ll show up here.</p>`;
    return;
  }

  const bySkill = {};
  attempts.forEach(a => { (bySkill[a.skill] ??= []).push(a.score); });
  const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

  const dates = new Set(attempts.map(a => new Date(a.timestamp).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; ; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (dates.has(d.toDateString())) streak++; else break;
  }

  const skillLabels = { vocabulary:'Vocabulary', listening:'Listening', reading:'Reading', grammar:'Grammar', writing:'Writing', speaking:'Speaking', conversation:'Conversation' };

  box.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${attempts.length}</div><div class="stat-label">Attempts</div></div>
      <div class="stat-card"><div class="stat-num">${avg(attempts.map(a => a.score))}</div><div class="stat-label">Avg score</div></div>
      <div class="stat-card"><div class="stat-num">${streak}</div><div class="stat-label">Day streak</div></div>
      ${Object.keys(bySkill).map(s => `<div class="stat-card"><div class="stat-num">${avg(bySkill[s])}</div><div class="stat-label">${skillLabels[s] || s}</div></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-title">Recent activity</div>
      <div id="history-list"></div>
      <div class="btn-row">
        <button class="btn btn-danger" id="clear-progress"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Clear my data</button>
      </div>
    </div>`;
  window.lucide && window.lucide.createIcons();

  const list = document.getElementById('history-list');
  list.innerHTML = attempts.slice().reverse().slice(0, 25).map(a => {
    const isWritten = a.exerciseId.endsWith('-written');
    const baseId = isWritten ? a.exerciseId.slice(0, -8) : a.exerciseId;
    const ex = CONTENT[a.skill] ? CONTENT[a.skill].find(x => x.id === baseId) : null;
    const exLabel = ex ? (ex.title || (ex.word ? `« ${ex.word} »` : a.exerciseId)) : a.exerciseId;
    const label = exLabel + (isWritten ? ' (written response)' : '');
    return `<div class="history-row">
      <span><span class="history-skill">${skillLabels[a.skill] || a.skill}</span> ${esc(label)}</span>
      <span class="history-score" style="color:${a.score >= 75 ? '#8ff0cf' : a.score >= 45 ? '#fcd34d' : '#fca5a5'}">${a.score}</span>
    </div>`;
  }).join('');

  document.getElementById('clear-progress').addEventListener('click', () => {
    if (confirm('Clear all saved French Tutor progress on this device? This can’t be undone.')) {
      clearProgress();
      renderProgress();
    }
  });
}

// ── Tab / level wiring ───────────────────────────────────────
const RENDERERS = { units: renderUnits, vocabulary: renderVocabulary, listening: renderListening, reading: renderReading, grammar: renderGrammar, writing: renderWriting, speaking: renderSpeaking, conversation: renderConversation, progress: renderProgress };

function renderTab(tab) {
  window.speechSynthesis && window.speechSynthesis.cancel();
  RENDERERS[tab] && RENDERERS[tab]();
}

function selectTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
  renderTab(tab);
}

function selectLevel(level) {
  state.level = level;
  document.querySelectorAll('.level-btn').forEach(b => b.classList.toggle('active', b.dataset.level === level));
  const active = document.querySelector('.tab-btn.active');
  renderTab(active ? active.dataset.tab : 'units');
}

function init() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => selectTab(btn.dataset.tab)));
  document.querySelectorAll('.level-btn').forEach(btn => btn.addEventListener('click', () => selectLevel(btn.dataset.level)));
  selectLevel('A2');
  selectTab('units');
}

window.FrenchTutor = { init };

})();
