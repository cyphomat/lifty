// Die Wissensschicht. Bewusst hier im oeffentlichen Repo und nicht bei den
// Trainingsdaten: das ist Programmwissen, kein Personenbezug. Ausserdem muss
// es im Studio sofort da sein, ohne zweiten API-Aufruf.

export const LIFT_INFO = {
  squat: {
    tag: 'BACK SQUAT',
    warum: 'Die größte Hebelwirkung auf deinen gesamten Körper. Beine, Rumpf, oberer Rücken — und der stärkste hormonelle Reiz, den du im Defizit kriegen kannst. Deshalb steht sie in beiden Workouts.',
    kadenz: '3 Sekunden runter, unten nicht abfedern, explosiv hoch.',
    cue: 'Bruch aus der Hüfte und den Knien gleichzeitig. Ellbogen unter die Stange, Brust bleibt offen.',
    fehler: 'Hüfte schießt zuerst hoch — dann wird aus dem Squat ein Good Morning.',
    oly: 'Aus deinem Gewichtheben kennst du die aufrechte Front-Position. Halte im Back Squat denselben Oberkörperwinkel wie im Clean, dann überträgt es sich.'
  },
  bench: {
    tag: 'BENCH PRESS',
    warum: 'Horizontaler Druck. Der Gegenspieler zum Rudern — beide zusammen halten die Schulter gesund.',
    kadenz: 'Kontrolliert runter bis Brustkontakt, kurze Pause, dann drücken.',
    cue: 'Schulterblätter zusammen und in die Bank. Füße fest, leichter Bogen im unteren Rücken.',
    fehler: 'Ellbogen 90 Grad abgespreizt. Etwa 45 Grad, das schont die Schulter.',
    oly: null
  },
  row: {
    tag: 'BARBELL ROW',
    warum: 'Zieht, was die Bank drückt. Ohne Rudern kippt dein Schultergürtel nach vorn — und dein Oberkörper ist die Basis für jedes Frontrack.',
    kadenz: 'Explosiv ziehen, betont langsam ablassen.',
    cue: 'Oberkörper knapp über parallel, Stange an den unteren Bauch. Rücken bleibt flach.',
    fehler: 'Aus dem Aufrichten schwingen. Wenn du reißen musst, ist es zu schwer.',
    oly: 'Die Position ist deine Zugposition beim Clean. Betrachte jeden Satz als Positionstraining.'
  },
  ohp: {
    tag: 'STRICT PRESS',
    warum: 'Ehrlichster Test für Rumpf und Schulter. Hier gibt es nichts zu schummeln — und er ist die Basis für jeden Jerk.',
    kadenz: 'Gleichmäßig hoch, kontrolliert zurück ins Rack.',
    cue: 'Gesäß und Bauch fest. Kopf leicht zurück, dann Stange am Gesicht vorbei, dann Kopf durch.',
    fehler: 'Rücklage aus dem unteren Rücken. Wenn du dich zurücklehnen musst, ist es zu schwer.',
    oly: 'Deine Overhead-Position hier entscheidet über den Jerk. Aktive Schulter, Ohren frei.'
  },
  deadlift: {
    tag: 'DEADLIFT',
    warum: 'Nur ein Satz — mit Absicht. Deadlifts kosten mehr Erholung als alles andere. Ein schwerer Satz reicht als Reiz, fünf würden deinen Squat auffressen.',
    kadenz: 'Spannung aufbauen, dann ohne Ruck. Jede Wiederholung neu ansetzen.',
    cue: 'Stange am Schienbein. Brust hoch, bevor die Hüfte kommt. Schieben, nicht ziehen.',
    fehler: 'Aus dem Boden reißen. Zieh die Stange erst auf Spannung, dann kommt die Bewegung.',
    oly: 'Das ist dein erster Zug. Gleiche Position wie beim Clean bis Kniehöhe — nutze das bewusst.'
  }
};

/* ---------------------------------------------------------------
   Warm-up. Nicht optional gedacht: nach langer Pause ist das der
   Teil, der entscheidet, ob du in acht Wochen noch dabei bist.    */

export const WARMUP = {
  allgemein: [
    { t: '3 Min', was: 'Rudergerät, Seil oder Fahrrad', detail: 'Bis du leicht warm bist. Nicht mehr.' },
    { t: '10x',   was: 'Hüftkreisen je Seite',          detail: 'Groß und langsam.' },
    { t: '10x',   was: 'Katzenbuckel / Kuhrücken',      detail: 'Wirbel für Wirbel.' },
    { t: '10x',   was: 'Bandzüge nach außen',           detail: 'Schulter aufwecken, besonders vor Drücken.' }
  ],
  A: [
    { t: '5x', was: 'Leere Stange Back Squat', detail: 'Tief, langsam, Position finden.' },
    { t: '5x', was: 'Leere Stange Bench Press', detail: 'Schulterblätter setzen.' }
  ],
  B: [
    { t: '5x', was: 'Leere Stange Overhead', detail: 'Position über dem Kopf suchen.' },
    { t: '5x', was: 'Romanian Deadlift, leer', detail: 'Hüfte lernt den Weg.' }
  ]
};

/* ---------------------------------------------------------------
   Technikarbeit aus dem Gewichtheben. Bewusst LEICHT — das ist
   Auffrischung von etwas, das du kannst, kein neuer Trainingsreiz. */

export const SKILL = [
  { name: 'Snatch Balance', dosis: '3x3, leer bis leicht', warum: 'Holt dir die Overhead-Position zurück, ohne Ermüdung zu kosten.' },
  { name: 'Hang Power Clean', dosis: '4x2, technisch', warum: 'Explosive Hüftstreckung — der Teil, der nach einer Pause zuerst geht.' },
  { name: 'Overhead Squat', dosis: '3x5, leere Stange', warum: 'Ehrliches Feedback über Mobilität. Ignorier es nicht.' },
  { name: 'Clean Pull', dosis: '3x3 @ 60 %', warum: 'Erster Zug, saubere Position, keine Landung.' },
  { name: 'Sots Press', dosis: '3x5, leer', warum: 'Unbequem, aber nichts öffnet die Schulter schneller.' }
];

/* ---------------------------------------------------------------
   Finisher. Am Ende, nie davor — sonst frisst die Kondition die
   Kraftprogression, und genau das willst du nicht.                */

export const FINISHER = [
  { name: 'Battle Ropes — Waves', dosis: '8x 20 Sek an / 40 Sek Pause', warum: 'Hoher Puls, null Belastung für Knie und Wirbelsäule. Perfekt nach schwerem Beintag.' },
  { name: 'Battle Ropes — Slams', dosis: '6x 15 Sek maximal', warum: 'Ganzkörper, explosiv. Der Rest vom Gewichtheber in dir.' },
  { name: 'Battle Ropes — Alternating', dosis: '5x 30 Sek', warum: 'Rumpf muss gegen die Rotation arbeiten. Unterschätzt.' },
  { name: 'Farmer Walk', dosis: '4x 40 m schwer', warum: 'Griff, Rumpf, Haltung — alles, was den Deadlift trägt.' },
  { name: 'Row (Erg)', dosis: '5x 250 m, 1 Min Pause', warum: 'Wenn die Seile besetzt sind.' }
];

/* ---------------------------------------------------------------
   Radeinheiten mit Begruendung. "Zone 2" ohne Warum ist eine
   Anweisung; mit Warum ist es eine Entscheidung.                  */

export const RIDE_INFO = {
  'Grundlage Z2': {
    intensitaet: 'locker',
    ftp: [0.56, 0.75],
    warum: 'Baut das aerobe Fundament und verbrennt Fett, ohne deine Beine für den Squat zu ruinieren. Der wichtigste Teil deines Radumfangs — und der, den alle zu hart fahren.',
    achtung: 'Wenn du dich unterhalten kannst, stimmt es. Wenn es sich gut anfühlt, ist es meistens zu hart.'
  },
  'Sweet Spot': {
    intensitaet: 'mittel',
    ftp: [0.88, 0.93],
    warum: 'Bestes Verhältnis von Reiz zu Erholungskosten. Hebt die Schwelle, ohne dich für Tage zu zerstören.',
    achtung: 'Zäh, aber kontrolliert. Du solltest das letzte Intervall genauso fahren können wie das erste.'
  },
  'VO2max': {
    intensitaet: 'hart',
    ftp: [1.06, 1.20],
    warum: 'Hebt die Decke. Wenige, kurze, wirklich harte Intervalle.',
    achtung: 'Nicht am Tag vor dem Beintag. Und nicht, wenn du schlecht geschlafen hast.'
  }
};

/* ---------------------------------------------------------------
   Sprueche. Kommen aus dem echten Zustand, nicht aus dem Zufall —
   deshalb sind sie nach Situation sortiert, nicht als Liste.      */

export const VOICE = {
  comeback: [
    'Fünf Wochen weg. Das Gewicht auf der Stange ist niedrig, weil das der Plan ist — nicht weil du schwach bist.',
    'Der erste Satz nach einer Pause ist der schwerste. Nicht körperlich.',
    'Du kommst nicht bei null zurück. Du kommst mit allem zurück, was du vorher gelernt hast.',
    'Willkommen zurück. Die Stange hat dich nicht vermisst — sie liegt einfach da und wartet.',
    'Die Pause ist vorbei, sobald du drunterstehst. Nicht vorher.',
    'Niemand schaut zu. Das ist die gute Nachricht.',
    'Dein Körper hat das alles schon mal gemacht. Er erinnert sich schneller, als du denkst.',
    'Anfangen ist die ganze Übung. Der Rest ist Routine.'
  ],
  leicht: [
    'Heute soll sich zu leicht anfühlen. Das ist die Dosis, nicht der Fehler.',
    'Geduld ist hier kein Charakterzug, sondern Methode.',
    'Wer jetzt schummelt und Scheiben drauflegt, zahlt es in Woche sechs.',
    'Zu leicht ist heute die richtige Antwort. Die schweren Tage kommen von allein.',
    'Langweilig ist ein Trainingszustand, kein Urteil.',
    'Die harten Tage stehen im Kalender. Nur eben nicht heute.',
    'Unterfordert ist besser als überzogen. Fragt jeder, der mal drei Monate ausgefallen ist.'
  ],
  standard: [
    'Kein Held sein. Fünf saubere Sätze, dann nach Hause.',
    'Die Stange interessiert nicht, wie dein Tag war.',
    'Zwei Kilo mehr als beim letzten Mal. So wird das gemacht.',
    'Technik zuerst. Das Gewicht kommt von allein.',
    'Keine Ausreden, keine Zuschauer. Nur Eisen.',
    'Aufwärmen, laden, wegdrücken. Kein Drama.',
    'Fünf Sätze. Die Stange zählt mit, nicht du.',
    'Der Plan steht. Du musst ihn nur noch anfassen.',
    'Erst die Arbeit, dann der Espresso.',
    'Heute keine Heldentaten. Heute Handwerk.',
    'Zwift im Keller, Eisen in Darmstadt. Heute ist Darmstadt dran.',
    'Es liegt alles bereit. Du musst dich nur drunterlegen.',
    'Niemand hat je eine Einheit bereut, die er gemacht hat.'
  ],
  nachFehlversuch: [
    'Letztes Mal hat dich das geschlagen. Heute nicht.',
    'Gleiche Last wie beim letzten Mal. Diesmal gewinnst du sie.',
    'Ein Fehlversuch ist Information, kein Urteil.',
    'Die Stange hat gewonnen. Einmal.',
    'Beim letzten Mal war Schluss. Heute nicht.',
    'Dieselbe Stange, dieselbe Zahl. Andere Laune.',
    'Sie steht noch auf deiner Liste. Streich sie.'
  ],
  nachDeload: [
    'Deload ist kein Rückschritt, sondern Anlauf. Das Programm hat das für dich entschieden, nicht gegen dich.',
    'Zehn Prozent runter, damit es wieder hoch geht. Vertrau der Mechanik.',
    'Zehn Prozent runter ist kein Rückzug. Das ist Anlauf nehmen.',
    'Das Programm hat entschieden, damit du es nicht musst.',
    'Rückwärts laufen, um Anlauf zu nehmen, sieht immer albern aus. Funktioniert trotzdem.'
  ],
  streak: [
    'Vierte Woche in Folge. Das ist der Teil, an dem die meisten aufhören.',
    'Konstanz schlägt Intensität. Du machst es gerade richtig.',
    'Kein spektakulärer Tag. Nur wieder einer. Genau darum geht es.',
    'Nichts Spektakuläres. Nur wieder da. Genau das zählt.',
    'Vier Wochen. Die meisten sind längst weg.',
    'Kein Applaus, keine Geschichte. Nur Wochen, die sich stapeln.',
    'Das hier ist der unsichtbare Teil. Der zählt am meisten.'
  ],
  defizit: [
    'Im Defizit ist Halten schon Gewinn. Jedes Kilo mehr auf der Stange ist Bonus.',
    'Muskeln aufbauen und Fett verlieren gleichzeitig geht — bei Wiedereinsteigern. Das Fenster ist offen, nutz es.',
    'Weniger essen, mehr heben. Der unangenehmste Weg — und der einzige, der geht.',
    'Der Espresso hat keine Kalorien. Alles danach schon.',
    'Die Waage misst Wasser, Essen und Tagesform. Die Stange misst dich.'
  ]
};
