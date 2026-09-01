// Aus ein paar Antworten eine gueltige config.json.
//
// Bisher musste man die Datei von Hand schreiben und dabei wissen, dass
// week.slots nicht optional ist. Wer das uebersah, bekam einen leeren
// Startbildschirm ohne Erklaerung. Das hier ist die Gegenrichtung: die App
// fragt das Wenige, was sie wirklich braucht, und baut den Rest selbst.
//
// Reine Funktionen, kein I/O — geschrieben wird woanders.

/** Die fuenf Uebungen des Programms. Reihenfolge ist die Anzeigereihenfolge. */
export const STANDARD_LIFTS = [
  { id: 'squat',    name: 'Back Squat',   increment: 2.5, start: 40 },
  { id: 'bench',    name: 'Bench Press',  increment: 2.5, start: 30 },
  { id: 'row',      name: 'Barbell Row',  increment: 2.5, start: 30 },
  { id: 'ohp',      name: 'Strict Press', increment: 2.5, start: 20 },
  { id: 'deadlift', name: 'Deadlift',     increment: 5.0, start: 50 }
];

/** Die Aufteilung liegt fest — sie ist das Programm, nicht eine Einstellung. */
export const WORKOUTS = {
  A: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'bench', sets: 5, reps: 5 }, { lift: 'row', sets: 5, reps: 5 }],
  B: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'ohp', sets: 5, reps: 5 }, { lift: 'deadlift', sets: 1, reps: 5 }]
};

/** Vorrat an Radeinheiten, falls jemand Radtage einplant. */
export const STANDARD_RIDES = [
  { label: 'Grundlage Z2', detail: '60–90 Min ruhig, Zone 2, Gespräch möglich' },
  { label: 'Sweet Spot', detail: '3x12 Min @ 88-93% FTP, 6 Min locker dazwischen' }
];

export const STANDARD_PLATTEN = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Der Entwurf, mit dem der Bildschirm startet. Zwei Krafttage, weil das
 * Programm dafuer gebaut ist; Montag und Donnerstag, weil dazwischen genug
 * Erholung liegt.
 */
export function standardEntwurf() {
  return {
    bar: 20,
    lifts: STANDARD_LIFTS.map(l => ({ ...l })),
    krafttage: [1, 4],
    radtage: []
  };
}

/**
 * Was am Entwurf noch nicht stimmt. Gibt Kennungen zurueck, keine Saetze —
 * die Formulierung gehoert in die Sprachschicht.
 */
export function pruefeEntwurf(e) {
  const fehler = [];
  if (!e || !Array.isArray(e.lifts) || !e.lifts.length) fehler.push('keineUebungen');
  else {
    if (e.lifts.some(l => !String(l.name || '').trim())) fehler.push('nameFehlt');
    if (e.lifts.some(l => !(Number(l.start) > 0))) fehler.push('gewichtFehlt');
  }
  if (!Array.isArray(e.krafttage) || !e.krafttage.length) fehler.push('keineKrafttage');
  // Ein Tag kann nicht gleichzeitig Kraft- und Radtag sein.
  if (Array.isArray(e.krafttage) && Array.isArray(e.radtage) &&
      e.krafttage.some(t => e.radtage.includes(t))) fehler.push('tagDoppelt');
  if (!(Number(e.bar) > 0)) fehler.push('stangeFehlt');
  return fehler;
}

/**
 * Der eigentliche Bau. Die Reihenfolge der Slots ist nach Wochentag
 * sortiert, damit die Woche auf dem Startbildschirm in der Reihenfolge
 * steht, in der sie auch stattfindet.
 */
export function baueConfig(entwurf) {
  const e = { ...standardEntwurf(), ...entwurf };
  const lifts = {};
  for (const l of e.lifts) {
    lifts[l.id] = {
      name: String(l.name).trim(),
      increment: Number(l.increment),
      start: Number(l.start)
    };
  }

  const slots = [
    ...e.krafttage.map(day => ({ day: Number(day), type: 'strength' })),
    ...e.radtage.map(day => ({ day: Number(day), type: 'ride' }))
  ].sort((a, b) => a.day - b.day);

  const config = {
    version: 1,
    bar: Number(e.bar),
    rounding: 2.5,
    plates: [...STANDARD_PLATTEN],
    deload: { afterFails: 3, factor: 0.9 },
    lifts,
    workouts: JSON.parse(JSON.stringify(WORKOUTS)),
    firstWorkout: 'A',
    rest: { normal: 90, afterFail: 180 },
    week: { slots }
  };

  // rides nur anlegen, wenn es auch Radtage gibt — ein leeres Array waere
  // genau die Falle, die den Startbildschirm frueher hat sterben lassen.
  if (e.radtage.length) config.rides = STANDARD_RIDES.map(r => ({ ...r }));

  return config;
}

/** Wochentage in der Reihenfolge, in der man sie anklickt. */
export const TAGE = [
  { nr: 1, kurz: 'Mo' }, { nr: 2, kurz: 'Di' }, { nr: 3, kurz: 'Mi' },
  { nr: 4, kurz: 'Do' }, { nr: 5, kurz: 'Fr' }, { nr: 6, kurz: 'Sa' },
  { nr: 7, kurz: 'So' }
];
