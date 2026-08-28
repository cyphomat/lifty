// Ausfuehren:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc --module-file=tests/program.test.js
// Kein Node, kein Framework — die Regeln des Programms als ausfuehrbare Doku.
import * as P from '../js/program.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; print(`  ok   ${name}`); }
  else { fail++; print(`  FAIL ${name} ${extra}`); }
}
function eq(name, a, b) { ok(name, a === b, `(${a} != ${b})`); }

const config = {
  bar: 20, rounding: 2.5,
  deload: { afterFails: 3, factor: 0.9 },
  lifts: {
    squat:    { name: 'Kniebeuge',       increment: 2.5, start: 47.5 },
    bench:    { name: 'Bankdrücken',     increment: 2.5, start: 35.0 },
    row:      { name: 'Rudern',          increment: 2.5, start: 32.5 },
    ohp:      { name: 'Schulterdrücken', increment: 2.5, start: 25.0 },
    deadlift: { name: 'Kreuzheben',      increment: 5.0, start: 60.0 }
  },
  workouts: {
    A: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'bench', sets: 5, reps: 5 }, { lift: 'row', sets: 5, reps: 5 }],
    B: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'ohp', sets: 5, reps: 5 }, { lift: 'deadlift', sets: 1, reps: 5 }]
  },
  firstWorkout: 'A',
  week: { slots: [{ day: 1, type: 'strength' }, { day: 2, type: 'ride' }, { day: 4, type: 'strength' }, { day: 6, type: 'ride' }] },
  rides: [{ label: 'Z2', detail: 'ruhig' }, { label: 'SST', detail: 'zaeh' }]
};

const win  = (lift, weight, sets = 5) => ({ lift, weight, sets, target: 5, reps: Array(sets).fill(5), success: true });
const lose = (lift, weight)          => ({ lift, weight, sets: 5, target: 5, reps: [5,5,5,4,3], success: false });

print('\n--- Startzustand ---');
let s = P.initialState(config);
eq('Kniebeuge startet bei 47,5', s.lifts.squat.weight, 47.5);
eq('erste Einheit ist A', s.next, 'A');

print('\n--- Erfolg steigert ---');
s = P.applyLog(s, config, { date: '2026-09-01', workout: 'A',
  lifts: [win('squat', 47.5), win('bench', 35), win('row', 32.5)] });
eq('Kniebeuge +2,5', s.lifts.squat.weight, 50);
eq('Bank +2,5', s.lifts.bench.weight, 37.5);
eq('danach kommt B', s.next, 'B');

print('\n--- Kreuzheben steigt in 5er-Schritten, 1x5 ---');
s = P.applyLog(s, config, { date: '2026-09-04', workout: 'B',
  lifts: [win('squat', 50), win('ohp', 25), win('deadlift', 60, 1)] });
eq('Kreuzheben +5', s.lifts.deadlift.weight, 65);
eq('Schulterdruecken +2,5', s.lifts.ohp.weight, 27.5);
eq('danach wieder A', s.next, 'A');
eq('Kniebeuge steigt in beiden Workouts', s.lifts.squat.weight, 52.5);

print('\n--- Fehlversuche zaehlen, Gewicht bleibt ---');
let f = P.initialState(config);
for (let i = 1; i <= 2; i++) {
  f = P.applyLog(f, config, { date: `2026-09-0${i}`, workout: 'A', lifts: [lose('squat', 47.5)] });
  eq(`nach ${i}. Fehlversuch weiter 47,5`, f.lifts.squat.weight, 47.5);
  eq(`Fehlerzaehler = ${i}`, f.lifts.squat.fails, i);
}

print('\n--- Dritter Fehlversuch loest Deload aus ---');
f = P.applyLog(f, config, { date: '2026-09-03', workout: 'A', lifts: [lose('squat', 47.5)] });
eq('Deload auf 90 %, auf 2,5 gerundet', f.lifts.squat.weight, 42.5);
eq('Fehlerzaehler zurueckgesetzt', f.lifts.squat.fails, 0);

print('\n--- Erfolg setzt den Zaehler zurueck ---');
let g = P.initialState(config);
g = P.applyLog(g, config, { date: '2026-09-01', workout: 'A', lifts: [lose('bench', 35)] });
eq('ein Fehlversuch', g.lifts.bench.fails, 1);
g = P.applyLog(g, config, { date: '2026-09-03', workout: 'A', lifts: [win('bench', 35)] });
eq('Zaehler wieder 0', g.lifts.bench.fails, 0);
eq('und Steigerung', g.lifts.bench.weight, 37.5);

print('\n--- Die tragende Invariante: state ist aus den Logs ableitbar ---');
const logs = [
  { date: '2026-09-01', workout: 'A', lifts: [win('squat', 47.5), win('bench', 35), win('row', 32.5)] },
  { date: '2026-09-04', workout: 'B', lifts: [win('squat', 50), win('ohp', 25), win('deadlift', 60, 1)] },
  { date: '2026-09-08', workout: 'A', lifts: [lose('squat', 52.5), win('bench', 37.5), win('row', 35)] }
];
const sequential = logs.reduce((st, l) => P.applyLog(st, config, l), P.initialState(config));
const derived = P.deriveState(config, logs);
eq('Neuberechnung == schrittweise Anwendung', JSON.stringify(derived.lifts), JSON.stringify(sequential.lifts));
const shuffled = P.deriveState(config, [logs[2], logs[0], logs[1]]);
eq('Reihenfolge der Dateien egal (wird sortiert)', JSON.stringify(shuffled.lifts), JSON.stringify(derived.lifts));

print('\n--- Wochenplan ---');
const week = P.planWeek(P.initialState(config), config, new Date(2026, 8, 2));
eq('vier Slots', week.length, 4);
eq('Montag Kraft A', week[0].workout, 'A');
eq('Donnerstag Kraft B', week[2].workout, 'B');
eq('Dienstag ist Rad', week[1].type, 'ride');
eq('Wochentage stimmen', week.map(w => w.day).join(','), 'Mo,Di,Do,Sa');

print('\n--- Rundung ---');
eq('42,3 -> 42,5', P.roundTo(42.3, 2.5), 42.5);
eq('41,1 -> 40', P.roundTo(41.1, 2.5), 40);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
