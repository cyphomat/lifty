// Unplugged — fuenfzehn Minuten, nur Koerpergewicht, im Zweifel leise.
//
// Der Jam braucht Platz, Geraet und meist zwanzig Minuten. Das hier ist die
// andere Lage: morgens im Wohnzimmer, die Familie schlaeft noch, in einer
// Viertelstunde muss es vorbei sein. Deshalb drei feste Entscheidungen:
//
//   1. Nichts ausser dem eigenen Koerper. Keine Klimmzugstange, kein Seil.
//   2. "Leise" ist Voreinstellung, nicht Zusatz. Wer um sechs Uhr Burpees
//      springt, weckt das halbe Haus — und macht es genau einmal.
//   3. Feste Intervalle statt Wiederholungszahlen. Bei Zeitdruck zaehlt
//      niemand mit; die Uhr fuehrt, man arbeitet nur.
//
// Ehrlich bleiben muss man an einer Stelle: **ziehen** geht ohne Stange
// nicht. Der Ruecken bekommt hier Streckarbeit am Boden, kein Ersatz fuer
// Klimmzuege. Das steht auch so in der Oberflaeche.

/* Muskelrichtungen. Eine Runde nimmt aus jeder hoechstens eine Uebung,
   damit nicht vier Beinsachen hintereinander kommen.                     */
export const RICHTUNGEN = ['druck', 'beine', 'rumpf', 'puls'];

export const UEBUNGEN = [
  /* ---------- Druck ---------- */
  { id: 'pushup', name: 'Liegestütze', richtung: 'druck', laut: false,
    cue: 'Körper bleibt eine Linie, Ellbogen nach hinten statt zur Seite.',
    erklaerung: 'Horizontales Drücken mit dem eigenen Gewicht. Der Rumpf arbeitet mit — sobald die Hüfte durchhängt, wird aus der Übung eine Rückenbelastung.',
    leichter: ['Hände erhöht auf Sofa oder Tisch', 'Auf den Knien'],
    schwerer: ['Füße erhöht', 'Langsam ablassen, drei Sekunden'] },
  { id: 'pikepush', name: 'Pike Push-ups', richtung: 'druck', laut: false,
    cue: 'Hüfte hoch, Kopf zwischen die Hände.',
    erklaerung: 'Liegestütz mit hoher Hüfte — dadurch drückst du fast senkrecht nach oben statt nach vorn. Die Vorstufe zum Handstanddrücken und der beste Schulterreiz ohne jedes Gerät.',
    leichter: ['Hände erhöht', 'Kürzerer Weg'],
    schwerer: ['Füße auf dem Sofa', 'Pause unten'] },
  { id: 'dips', name: 'Dips an der Stuhlkante', richtung: 'druck', laut: false,
    cue: 'Schultern unten halten, nicht zu den Ohren ziehen.',
    erklaerung: 'Trizeps und vordere Schulter über den Stuhl. Der Stuhl steht ohnehin da — es ist Körpergewicht, kein Gerät.',
    leichter: ['Füße näher heran, Knie gebeugt'],
    schwerer: ['Füße auf einem zweiten Stuhl'] },
  { id: 'diamond', name: 'Enge Liegestütze', richtung: 'druck', laut: false,
    cue: 'Hände unter der Brust, Ellbogen eng am Körper.',
    erklaerung: 'Derselbe Zug wie beim Liegestütz, nur mit engem Griff — die Last wandert von der Brust in den Trizeps. Deutlich härter, als die kleine Änderung vermuten lässt.',
    leichter: ['Hände erhöht', 'Auf den Knien'],
    schwerer: ['Füße erhöht'] },

  /* ---------- Beine ---------- */
  { id: 'airsquat', name: 'Kniebeugen', richtung: 'beine', laut: false,
    cue: 'Tief, Brust hoch, Fersen bleiben am Boden.',
    erklaerung: 'Die Grundbewegung überhaupt, ohne jedes Zusatzgewicht. Hier zählt der volle Weg, nicht die Last — halbe Kniebeugen sind halbe Arbeit.',
    leichter: ['Bis zum Stuhl und wieder hoch'],
    schwerer: ['Drei Sekunden runter', 'Unten zwei Sekunden halten'] },
  { id: 'lunge', name: 'Ausfallschritte', richtung: 'beine', laut: false,
    cue: 'Knie kontrolliert absetzen, nicht aufschlagen.',
    erklaerung: 'Einbeinig, im Wechsel. Deckt genau das ab, was die beidbeinige Kniebeuge auslässt: seitliche Stabilität und den Unterschied zwischen links und rechts.',
    leichter: ['An der Wand abstützen', 'Kürzerer Schritt'],
    schwerer: ['Rückwärts statt vorwärts', 'Hinteres Bein erhöht'] },
  { id: 'bulgarian', name: 'Bulgarische Kniebeugen', richtung: 'beine', laut: false,
    cue: 'Hinterer Fuß auf dem Sofa, Gewicht auf dem vorderen Bein.',
    erklaerung: 'Einbeinige Kniebeuge mit erhöhtem Hinterfuß. Ohne jedes Zusatzgewicht härter als die meisten glauben — und der direkteste Weg zu einbeiniger Kraft.',
    leichter: ['Kürzerer Weg', 'Mit einer Hand an der Wand'],
    schwerer: ['Langsam ablassen', 'Unten kurz halten'] },
  { id: 'wallsit', name: 'Wandsitzen', richtung: 'beine', laut: false, aufZeit: true,
    cue: 'Oberschenkel waagerecht, Rücken flach an der Wand.',
    erklaerung: 'Halten statt bewegen. Nach vierzig Sekunden brennt es zuverlässig, ohne dass irgendetwas laut wird oder wehtut — das leiseste harte Ding im ganzen Vorrat.',
    leichter: ['Höher sitzen'],
    schwerer: ['Tiefer', 'Ein Bein anheben'] },
  { id: 'glutebridge', name: 'Hüftheben', richtung: 'beine', laut: false,
    cue: 'Oben die Hüfte ganz strecken, Gesäß fest.',
    erklaerung: 'Hüftstreckung im Liegen — die Rückseite, die beim Sitzen den ganzen Tag schläft. Am Boden, ohne Belastung für den unteren Rücken.',
    leichter: ['Kürzerer Weg'],
    schwerer: ['Einbeinig', 'Oben zwei Sekunden halten'] },

  /* ---------- Rumpf und Rücken ---------- */
  { id: 'plank', name: 'Unterarmstütz', richtung: 'rumpf', laut: false, aufZeit: true,
    cue: 'Gesäß fest, Hüfte weder hoch noch durchhängend.',
    erklaerung: 'Halten gegen das Durchhängen. Kein Bauchmuskeltraining im Wiederholungssinn, sondern genau die Arbeit, die der Rumpf beim Heben leistet.',
    leichter: ['Auf den Knien', 'Kürzere Intervalle'],
    schwerer: ['Ein Bein anheben', 'Unterarme vorschieben'] },
  { id: 'hollow', name: 'Hohlkörper-Halten', richtung: 'rumpf', laut: false, aufZeit: true,
    cue: 'Unterer Rücken bleibt am Boden gedrückt.',
    erklaerung: 'Die Grundspannung des Turnens. Sobald sich der untere Rücken vom Boden löst, arbeitet nicht mehr der Bauch, sondern die Hüftbeuger — dann lieber die Knie anziehen.',
    leichter: ['Knie angezogen', 'Arme an den Seiten'],
    schwerer: ['Arme über Kopf', 'Beine tiefer'] },
  { id: 'deadbug', name: 'Dead Bug', richtung: 'rumpf', laut: false,
    cue: 'Gegenüberliegender Arm und Bein, Rücken bleibt am Boden.',
    erklaerung: 'Rumpfstabilität gegen Bewegung der Gliedmaßen. Langsam ausgeführt anspruchsvoller als schnelle Sit-ups — und deutlich freundlicher zum Rücken.',
    leichter: ['Nur die Beine', 'Kürzerer Weg'],
    schwerer: ['Langsamer', 'Ferse knapp über dem Boden halten'] },
  { id: 'superman', name: 'Superman', richtung: 'rumpf', laut: false,
    cue: 'Arme und Beine gleichzeitig heben, Blick zum Boden.',
    erklaerung: 'Streckarbeit für den ganzen Rücken am Boden — das Gegenstück zu allem Drücken. Kein Ersatz für Klimmzüge, aber ohne Stange die ehrlichste Rückseite, die zu haben ist.',
    leichter: ['Nur die Arme', 'Nur die Beine'],
    schwerer: ['Oben zwei Sekunden halten'] },
  { id: 'situp', name: 'Sit-ups', richtung: 'rumpf', laut: false,
    cue: 'Kein Schwung aus den Armen.',
    erklaerung: 'Rumpfbeugung über den vollen Weg. Im Intervall meist die Erholung zwischen zwei harten Teilen, ohne dass der Puls ganz absinkt.',
    leichter: ['Crunches mit kürzerem Weg'],
    schwerer: ['Arme über Kopf', 'Langsam ablassen'] },
  { id: 'sidplank', name: 'Seitstütz', richtung: 'rumpf', laut: false, aufZeit: true,
    cue: 'Hüfte hoch, Körper in einer Linie. Halbe Zeit je Seite.',
    erklaerung: 'Die seitliche Rumpfmuskulatur, die beim geraden Halten nie drankommt. Sie entscheidet mit, ob die Hüfte beim einbeinigen Stand kippt.',
    leichter: ['Auf dem Knie abstützen'],
    schwerer: ['Oberen Arm strecken', 'Oberes Bein anheben'] },

  /* ---------- Puls ---------- */
  { id: 'mountain', name: 'Mountain Climbers', richtung: 'puls', laut: false,
    cue: 'Hüfte tief, Knie zügig wechseln.',
    erklaerung: 'Der schnellste Weg zu hohem Puls, der nichts vom Boden abhebt. Im Liegestütz bleibt die Rumpfspannung erhalten, während die Beine arbeiten.',
    leichter: ['Langsamer', 'Hände erhöht'],
    schwerer: ['Schneller', 'Knie kreuzweise'] },
  { id: 'stepback', name: 'Ausfallschritte rückwärts, zügig', richtung: 'puls', laut: false,
    cue: 'Zügig, aber weich aufsetzen.',
    erklaerung: 'Wie der Ausfallschritt, nur im Tempo. Bringt den Puls hoch, ohne dass ein einziger Fuß den Boden verlässt.',
    leichter: ['Langsamer', 'An der Wand abstützen'],
    schwerer: ['Tiefer', 'Ohne Pause zwischen den Seiten'] },
  { id: 'burpeeleise', name: 'Burpees ohne Sprung', richtung: 'puls', laut: false,
    cue: 'Runter, Brett, hoch — nur eben ohne Sprung am Ende.',
    erklaerung: 'Der Ganzkörper-Klassiker, entschärft um genau das Element, das laut ist. Der Puls geht trotzdem hoch; es fehlt nur der Knall.',
    leichter: ['Schrittweise statt springend nach hinten'],
    schwerer: ['Liegestütz unten dazu'] },
  { id: 'squatpuls', name: 'Kniebeugen im Tempo', richtung: 'puls', laut: false,
    cue: 'Zügig, aber jede Wiederholung ganz.',
    erklaerung: 'Kniebeugen als Konditionsteil statt als Kraftteil. Bei hoher Frequenz brennt die Oberschenkelmuskulatur, lange bevor die Puste ausgeht.',
    leichter: ['Langsamer', 'Kürzerer Weg'],
    schwerer: ['Unten kurz halten'] },

  /* ---------- Laut: nur ohne Ruecksicht ---------- */
  { id: 'jumpingjack', name: 'Hampelmänner', richtung: 'puls', laut: true,
    cue: 'Locker bleiben, gleichmäßiger Rhythmus.',
    erklaerung: 'Aufwärmen und Puls in einem, seit Jahrzehnten unverändert im Programm. Springt — also nichts für schlafende Mitbewohner oder Nachbarn unter dir.',
    leichter: ['Nur die Arme, Beine im Wechsel antippen'],
    schwerer: ['Schneller'] },
  { id: 'burpee', name: 'Burpees', richtung: 'puls', laut: true,
    cue: 'Gleichmäßig. Wer sprintet, stirbt in Runde drei.',
    erklaerung: 'Der billigste Weg, den Puls zu maximieren: ganzer Körper, jede Wiederholung von ganz unten nach ganz oben. Mit Sprung am Ende — entsprechend laut.',
    leichter: ['Ohne Sprung', 'Hände auf eine Erhöhung'],
    schwerer: ['Liegestütz unten dazu'] },
  { id: 'squatjump', name: 'Sprungkniebeugen', richtung: 'beine', laut: true,
    cue: 'Weich landen, sofort in die nächste.',
    erklaerung: 'Kniebeuge mit Absprung — Schnellkraft für die Beine ohne jedes Gerät. Die Landung ist das Laute daran und zugleich das, was die Gelenke fordert.',
    leichter: ['Nur bis auf die Zehenspitzen'],
    schwerer: ['Höher', 'Ohne Pause zwischen den Wiederholungen'] }
];

/* Zuschnitte je Dauer. Bewusst wenige: drei Laengen decken ab, was zwischen
   "keine Zeit" und "eine halbe Stunde" liegt.                            */
export const LAENGEN = [
  { minuten: 10, uebungen: 4, runden: 3, arbeit: 35, pause: 15 },
  { minuten: 15, uebungen: 4, runden: 4, arbeit: 40, pause: 15 },
  { minuten: 20, uebungen: 5, runden: 4, arbeit: 40, pause: 20 }
];

/** Deterministisch: gleicher Seed, gleiche Auswahl. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Was heute erlaubt ist. `leise` nimmt alles Springende raus. */
export function vorrat(leise = true) {
  return UEBUNGEN.filter(u => !leise || !u.laut);
}

/**
 * Baut die Einheit.
 *
 * Die Auswahl geht der Reihe nach durch die Muskelrichtungen, statt frei zu
 * ziehen: sonst kommen vier Beinuebungen hintereinander und der Satz drei
 * ist nur noch Verwaltung. Reicht eine Richtung nicht aus, wird aus dem
 * Rest aufgefuellt — lieber unrund als zu kurz.
 */
export function baueSession({ minuten = 15, seed = 0, leise = true } = {}) {
  const laenge = LAENGEN.find(l => l.minuten === minuten) || LAENGEN[1];
  const r = rng(seed);
  const pool = vorrat(leise);

  const gewaehlt = [];
  const genommen = new Set();
  // Erst je Richtung eine, in gemischter Reihenfolge.
  const richtungen = [...RICHTUNGEN].sort(() => r() - 0.5);
  for (const richtung of richtungen) {
    if (gewaehlt.length >= laenge.uebungen) break;
    const passend = pool.filter(u => u.richtung === richtung && !genommen.has(u.id));
    if (!passend.length) continue;
    const u = passend[Math.floor(r() * passend.length)];
    gewaehlt.push(u); genommen.add(u.id);
  }
  // Dann auffuellen, falls noch Plaetze frei sind.
  while (gewaehlt.length < laenge.uebungen) {
    const rest = pool.filter(u => !genommen.has(u.id));
    if (!rest.length) break;
    const u = rest[Math.floor(r() * rest.length)];
    gewaehlt.push(u); genommen.add(u.id);
  }

  const teile = gewaehlt.map(u => ({
    id: u.id, name: u.name, cue: u.cue,
    erklaerung: u.erklaerung || '',
    aufZeit: !!u.aufZeit,
    leichter: u.leichter || [],
    schwerer: u.schwerer || []
  }));

  // Die letzte Pause faellt weg — danach ist Schluss, nicht Erholung.
  const gesamtSekunden = teile.length * laenge.runden * (laenge.arbeit + laenge.pause) - laenge.pause;

  return {
    minuten: laenge.minuten,
    runden: laenge.runden,
    arbeit: laenge.arbeit,
    pause: laenge.pause,
    leise,
    teile,
    gesamtSekunden,
    seed
  };
}

/**
 * Der Ablauf als flache Liste von Abschnitten. Die Oberflaeche laeuft sie
 * nur noch ab, statt bei jedem Wechsel neu zu rechnen — und die Reihenfolge
 * ist damit testbar, ohne eine Uhr laufen zu lassen.
 */
export function ablauf(session) {
  const schritte = [];
  for (let runde = 1; runde <= session.runden; runde++) {
    for (let i = 0; i < session.teile.length; i++) {
      const letzter = runde === session.runden && i === session.teile.length - 1;
      schritte.push({ art: 'arbeit', sekunden: session.arbeit, runde, teil: session.teile[i] });
      if (!letzter) schritte.push({ art: 'pause', sekunden: session.pause, runde, naechster: naechsterTeil(session, runde, i) });
    }
  }
  return schritte;
}

function naechsterTeil(session, runde, i) {
  return i + 1 < session.teile.length ? session.teile[i + 1] : session.teile[0];
}

/** Eine Zeile Klartext — fuer Log und Historie. */
export function label(session) {
  return `${session.minuten} Min · ${session.teile.map(t => t.name).join(' / ')}`;
}
