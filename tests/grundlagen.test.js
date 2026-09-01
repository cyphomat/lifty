// Ausfuehren: jsc --module-file=tests/grundlagen.test.js
//
// Die kleinen Funktionen, auf denen alles andere steht: Datumsrechnung,
// Erfolgspruefung, Anzeige. Sie waren bisher nur indirekt ueber die grossen
// Funktionen abgedeckt — ein Fehler in isoWeek haette sich als falsche
// Serie, falscher Kalender und falsche Wochenlast gleichzeitig gezeigt, und
// man haette an drei Stellen gesucht.
import * as P from '../js/program.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

// Ortszeit, nicht UTC — die App rechnet durchgehend lokal.
const tag = (j, m, t) => new Date(j, m - 1, t);

print('\n--- ymd ---');
eq('einstellige Monate und Tage werden aufgefuellt', P.ymd(tag(2026, 1, 5)), '2026-01-05');
eq('zweistellig bleibt zweistellig', P.ymd(tag(2026, 12, 31)), '2026-12-31');
eq('Schalttag', P.ymd(tag(2024, 2, 29)), '2024-02-29');
eq('Jahreswechsel', P.ymd(tag(2025, 12, 31)), '2025-12-31');
// Mittags statt Mitternacht: bei Zeitzonenversatz waere ein UTC-Umweg hier
// einen Tag daneben. Genau der Fehler, den lokales Rechnen vermeidet.
eq('Uhrzeit spielt keine Rolle', P.ymd(new Date(2026, 5, 1, 23, 59)), '2026-06-01');

print('\n--- mondayOf ---');
eq('Montag bleibt Montag', P.ymd(P.mondayOf(tag(2026, 8, 31))), '2026-08-31');
eq('Dienstag geht zurueck', P.ymd(P.mondayOf(tag(2026, 9, 1))), '2026-08-31');
// Der klassische Fehler: Sonntag ist Tag 0, naiv gerechnet landet man
// dadurch auf dem Montag der Folgewoche statt der eigenen.
eq('Sonntag gehoert zur ablaufenden Woche', P.ymd(P.mondayOf(tag(2026, 9, 6))), '2026-08-31');
eq('Samstag ebenso', P.ymd(P.mondayOf(tag(2026, 9, 5))), '2026-08-31');
eq('ueber den Monatswechsel', P.ymd(P.mondayOf(tag(2026, 3, 1))), '2026-02-23');
ok('Uhrzeit wird auf Mitternacht gesetzt', P.mondayOf(new Date(2026, 8, 2, 17, 30)).getHours() === 0);
ok('das uebergebene Datum bleibt unveraendert', (() => {
  const d = tag(2026, 9, 3); const vorher = d.getTime();
  P.mondayOf(d); return d.getTime() === vorher;
})());

print('\n--- isoWeek ---');
eq('normale Woche', P.isoWeek(tag(2026, 9, 1)), '2026-W36');
eq('Montag und Sonntag derselben Woche sind gleich',
  P.isoWeek(tag(2026, 8, 31)), P.isoWeek(tag(2026, 9, 6)));
ok('Sonntag und der Folgemontag unterscheiden sich',
  P.isoWeek(tag(2026, 9, 6)) !== P.isoWeek(tag(2026, 9, 7)));
// Der Jahreswechsel ist die Stelle, an der selbstgebaute Wochenzaehlung
// fast immer bricht: der 1. Januar 2027 ist ein Freitag und gehoert nach
// ISO 8601 noch in die 53. Woche von 2026.
eq('1. Januar kann noch zum Vorjahr gehoeren', P.isoWeek(tag(2027, 1, 1)), '2026-W53');
eq('31. Dezember kann schon zum Folgejahr gehoeren', P.isoWeek(tag(2019, 12, 31)), '2020-W01');
eq('4. Januar liegt immer in Woche 1', P.isoWeek(tag(2026, 1, 4)), '2026-W01');
ok('Format ist immer JJJJ-Wnn', /^\d{4}-W\d{2}$/.test(P.isoWeek(tag(2026, 3, 9))));

print('\n--- isSuccess ---');
const satz = (reps, sets) => ({ reps, sets });
ok('alle Saetze auf Ziel', P.isSuccess(satz([5, 5, 5, 5, 5], 5), 5));
ok('mehr als das Ziel zaehlt auch', P.isSuccess(satz([6, 5, 5, 5, 7], 5), 5));
ok('ein Satz darunter reicht zum Scheitern', !P.isSuccess(satz([5, 5, 5, 5, 4], 5), 5));
ok('zu wenige Saetze scheitern', !P.isSuccess(satz([5, 5, 5], 5), 5));
ok('leer scheitert', !P.isSuccess(satz([], 5), 5));
ok('Einzelsatz-Uebung wie Deadlift', P.isSuccess(satz([5], 1), 5));

print('\n--- fmtWeight ---');
eq('ganze Zahl ohne Nachkomma', P.fmtWeight(60), '60 kg');
eq('halbe Scheibe mit einer Stelle', P.fmtWeight(62.5), '62.5 kg');
eq('Viertelschritt wird gerundet dargestellt', P.fmtWeight(61.25), '61.3 kg');
eq('null ist eine Zahl', P.fmtWeight(0), '0 kg');

print('\n--- planWorkout ---');
const config = {
  lifts: {
    squat: { name: 'Back Squat', increment: 2.5 },
    bench: { name: 'Bench Press', increment: 2.5 },
    ohp: { name: 'Strict Press', increment: 2.5 },
    deadlift: { name: 'Deadlift', increment: 5 }
  },
  workouts: {
    A: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'bench', sets: 5, reps: 5 }],
    B: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'deadlift', sets: 1, reps: 5 }]
  }
};
const state = {
  next: 'A',
  lifts: {
    squat: { weight: 82.5, fails: 1 }, bench: { weight: 42.5, fails: 0 },
    ohp: { weight: 40, fails: 0 }, deadlift: { weight: 105, fails: 2 }
  }
};

const a = P.planWorkout(state, config);
eq('ohne Angabe kommt das naechste Workout', a.workout, 'A');
eq('Anzahl der Uebungen aus der Konfiguration', a.lifts.length, 2);
eq('Name kommt aus config', a.lifts[0].name, 'Back Squat');
eq('Gewicht kommt aus state', a.lifts[0].weight, 82.5);
eq('Fehlerzaehler wird mitgereicht', a.lifts[0].fails, 1);
eq('Saetze aus dem Plan', a.lifts[0].sets, 5);

const b = P.planWorkout(state, config, 'B');
eq('ausdrueckliche Wahl schlaegt state.next', b.workout, 'B');
eq('Deadlift hat nur einen Satz', b.lifts[1].sets, 1);
eq('und sein eigenes Gewicht', b.lifts[1].weight, 105);
ok('planWorkout aendert den Zustand nicht', state.lifts.squat.weight === 82.5);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
