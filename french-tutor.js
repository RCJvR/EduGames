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
      options:['Augmenter les impôts','Réduire les émissions de carbone','Créer des emplois','Construire des routes'], answer:1 }
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
      written:{ prompt:'Imagine que tu rencontres un nouvel élève. Que lui dis-tu ?', keywords:['salut','bonjour','je m’appelle','comment','t’appelles'] } }
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
      explanationEn:'"Où" (where) replaces a place or time complement in a relative clause.' }
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
      prompt:'Penses-tu que les réseaux sociaux ont plus d’avantages ou d’inconvénients ? Justifie ta réponse avec des exemples.' }
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
      keywords:['défi','surmonté','difficile','réussi','problème','solution'] }
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
    ] }
  ]
};

const LEVELS = ['A2','B1','B2'];
const STORAGE_KEY = 'frenchTutorProgress_v1';

// Themed units — every skill's exercises for a unit share the same topic,
// so vocab reinforces across listening/reading/grammar/writing/speaking
// instead of each skill being a disconnected list.
const UNITS = {
  A2: [
    { id:'a2-greetings', title:'Se présenter', icon:'👋' },
    { id:'a2-daily', title:'La vie quotidienne & le café', icon:'☕' }
  ],
  B1: [
    { id:'b1-travel', title:'Sorties & voyages', icon:'🧳' },
    { id:'b1-lifestyle', title:'Style de vie & travail', icon:'💼' }
  ],
  B2: [
    { id:'b2-society', title:'Société & environnement', icon:'🌍' },
    { id:'b2-culture', title:'Technologie & culture', icon:'🎭' }
  ]
};
const SKILL_ORDER = ['listening','reading','grammar','writing','speaking','conversation'];
const SKILL_META = {
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
    .replace(/[.,!?;:"«»()]/g, ' ')
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
  currentId: { listening: null, reading: null, writing: null, speaking: null, conversation: null }
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

  const skillLabels = { listening:'Listening', reading:'Reading', grammar:'Grammar', writing:'Writing', speaking:'Speaking', conversation:'Conversation' };

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
    const label = (ex ? ex.title : a.exerciseId) + (isWritten ? ' (written response)' : '');
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
const RENDERERS = { units: renderUnits, listening: renderListening, reading: renderReading, grammar: renderGrammar, writing: renderWriting, speaking: renderSpeaking, conversation: renderConversation, progress: renderProgress };

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
