// Ausfuehren: jsc --module-file=tests/einrichten.test.js
import * as E from '../js/einrichten.js';
import * as P from '../js/program.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

print('\n--- Entwurf ---');
const e = E.standardEntwurf();
eq('fuenf Uebungen', e.lifts.length, 5);
eq('zwei Krafttage', e.krafttage.length, 2);
eq('Montag und Donnerstag', e.krafttage.join(','), '1,4');
eq('keine Radtage', e.radtage.length, 0);
eq('Standardstange', e.bar, 20);
ok('jeder Aufruf liefert einen eigenen Entwurf', E.standardEntwurf().lifts !== e.lifts);
E.standardEntwurf().lifts[0].name = 'kaputt';
eq('und veraendert die Vorlage nicht', E.standardEntwurf().lifts[0].name, 'Back Squat');

print('\n--- Pruefung ---');
const fehlerVon = ab => E.pruefeEntwurf({ ...E.standardEntwurf(), ...ab });
eq('sauberer Entwurf hat keine Fehler', fehlerVon({}).length, 0);
ok('ohne Krafttage', fehlerVon({ krafttage: [] }).includes('keineKrafttage'));
ok('ohne Uebungen', fehlerVon({ lifts: [] }).includes('keineUebungen'));
ok('leerer Name', fehlerVon({ lifts: [{ id: 'x', name: '  ', start: 40, increment: 2.5 }] }).includes('nameFehlt'));
ok('Startgewicht null', fehlerVon({ lifts: [{ id: 'x', name: 'X', start: 0, increment: 2.5 }] }).includes('gewichtFehlt'));
ok('Startgewicht leer', fehlerVon({ lifts: [{ id: 'x', name: 'X', start: '', increment: 2.5 }] }).includes('gewichtFehlt'));
ok('Stange null', fehlerVon({ bar: 0 }).includes('stangeFehlt'));
ok('Tag doppelt belegt', fehlerVon({ krafttage: [1, 4], radtage: [4] }).includes('tagDoppelt'));
ok('getrennte Tage sind in Ordnung', !fehlerVon({ krafttage: [1, 4], radtage: [2, 6] }).includes('tagDoppelt'));

print('\n--- Gebaute Konfiguration ---');
const c = E.baueConfig(E.standardEntwurf());
eq('Stange uebernommen', c.bar, 20);
eq('fuenf Uebungen', Object.keys(c.lifts).length, 5);
eq('Name uebernommen', c.lifts.squat.name, 'Back Squat');
eq('Startgewicht wird zur Zahl', typeof c.lifts.squat.start, 'number');
eq('Deadlift steigt in Fuenferschritten', c.lifts.deadlift.increment, 5);
eq('zwei Slots', c.week.slots.length, 2);
eq('beide Kraft', c.week.slots.every(s => s.type === 'strength'), true);
ok('rides fehlt ganz, wenn keine Radtage', c.rides === undefined);
eq('Workout A hat drei Uebungen', c.workouts.A.length, 3);
eq('Deadlift nur ein Satz', c.workouts.B[2].sets, 1);
ok('Scheiben dabei', Array.isArray(c.plates) && c.plates.length > 0);

print('\n--- Slots stehen in Wochenreihenfolge ---');
const gemischt = E.baueConfig({ ...E.standardEntwurf(), krafttage: [4, 1], radtage: [6, 2] });
eq('nach Wochentag sortiert', gemischt.week.slots.map(s => s.day).join(','), '1,2,4,6');
eq('Typen bleiben zugeordnet',
  gemischt.week.slots.map(s => s.type[0]).join(''), 'srsr');
ok('mit Radtagen kommen auch Radeinheiten', Array.isArray(gemischt.rides) && gemischt.rides.length > 0);

print('\n--- Text aus den Feldern wird nicht blind uebernommen ---');
const getippt = E.baueConfig({
  ...E.standardEntwurf(),
  lifts: [{ id: 'squat', name: '  Kniebeuge  ', start: '42.5', increment: '2.5' }],
  krafttage: ['1']
});
eq('Leerraum am Namen faellt weg', getippt.lifts.squat.name, 'Kniebeuge');
eq('Gewicht als Zahl', getippt.lifts.squat.start, 42.5);
eq('Steigerung als Zahl', getippt.lifts.squat.increment, 2.5);
eq('Wochentag als Zahl', getippt.week.slots[0].day, 1);

print('\n--- Das Ergebnis traegt die App wirklich ---');
// Der eigentliche Zweck: was hier herauskommt, muss ohne Nacharbeit durch
// initialState und planWeek gehen. Genau daran ist die handgeschriebene
// config.json regelmaessig gescheitert.
for (const [name, entwurf] of Object.entries({
  'nur Kraft': E.standardEntwurf(),
  'Kraft und Rad': { ...E.standardEntwurf(), radtage: [2, 6] },
  'ein einziger Tag': { ...E.standardEntwurf(), krafttage: [3], radtage: [] },
  'sieben Tage': { ...E.standardEntwurf(), krafttage: [1, 2, 3, 4, 5, 6, 7], radtage: [] }
})) {
  const cfg = E.baueConfig(entwurf);
  try {
    const st = P.initialState(cfg);
    const woche = P.planWeek(st, cfg, new Date(2026, 8, 2));
    const soll = entwurf.krafttage.length + entwurf.radtage.length;
    ok(`${name}: Woche baut sich (${woche.length} Slots)`, woche.length === soll,
      `(${woche.length} statt ${soll})`);
    ok(`${name}: jeder Slot hat eine Beschriftung`, woche.every(s => s.label && s.detail));
    P.planWorkout(st, cfg);
  } catch (err) {
    ok(`${name}: Woche baut sich`, false, err.message);
  }
}

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
