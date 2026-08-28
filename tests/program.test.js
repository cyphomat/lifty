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

print('\n--- Abgehakt wird nur, was zum Slot passt ---');
// Regression: eine Krafteinheit am Dienstag hat frueher die Radeinheit
// desselben Tages als erledigt markiert.
const MI = new Date(2026, 8, 2);                    // Mi, 02.09.2026
const mitKraftAmDi = { ...P.initialState(config), history: [{ date: '2026-09-01', workout: 'A' }] };
const w2 = P.planWeek(mitKraftAmDi, config, MI);
eq('Dienstag ist der Rad-Slot', w2[1].type, 'ride');
eq('Krafteinheit hakt die Radeinheit NICHT ab', w2[1].done, false);
const mitKraftAmMo = { ...P.initialState(config), history: [{ date: '2026-08-31', workout: 'A' }] };
eq('Krafteinheit hakt den Kraft-Slot ab', P.planWeek(mitKraftAmMo, config, MI)[0].done, true);

print('\n--- Rundung ---');
eq('42,3 -> 42,5', P.roundTo(42.3, 2.5), 42.5);
eq('41,1 -> 40', P.roundTo(41.1, 2.5), 40);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Ein WOD darf die Progression nicht anfassen ---');
let wodState = P.initialState(config);
wodState = P.applyLog(wodState, config, {
  date: '2026-09-02', type: 'wod', label: 'AMRAP 12', lifts: []
});
eq('Kniebeuge unveraendert', wodState.lifts.squat.weight, 47.5);
eq('A/B-Wechsel unveraendert', wodState.next, 'A');
eq('taucht trotzdem in der Historie auf', wodState.history.length, 1);
eq('und ist als WOD markiert', wodState.history[0].type, 'wod');

wodState = P.applyLog(wodState, config, {
  date: '2026-09-03', workout: 'A', type: 'strength',
  lifts: [win('squat', 47.5), win('bench', 35), win('row', 32.5)]
});
eq('Krafteinheit danach steigert normal', wodState.lifts.squat.weight, 50);
eq('und dreht den Wechsel weiter', wodState.next, 'B');

print('\n--- Ein WOD hakt keinen Kraft-Slot ab ---');
const MI2 = new Date(2026, 8, 2);
const nurWod = { ...P.initialState(config), history: [{ date: '2026-08-31', type: 'wod', label: 'AMRAP' }] };
eq('Montag bleibt offen', P.planWeek(nurWod, config, MI2)[0].done, false);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Max-Out ist ein Test, kein Programmschritt ---');
let mo = P.initialState(config);
mo = P.applyLog(mo, config, { date:'2026-09-10', type:'maxout', lift:'squat', weight:90, reps:1 });
eq('A/B-Wechsel unberuehrt', mo.next, 'A');
eq('Arbeitsgewicht unveraendert ohne Uebernahme', mo.lifts.squat.weight, 47.5);
eq('steht aber in der Historie', mo.history[0].type, 'maxout');

print('\n--- ... ausser du uebernimmst das Ergebnis ---');
let mo2 = P.initialState(config);
mo2.lifts.squat.fails = 2;
mo2 = P.applyLog(mo2, config, { date:'2026-09-10', type:'maxout', lift:'squat', weight:90, reps:1, newWorking:72 });
eq('neues Arbeitsgewicht auf 2,5 gerundet', mo2.lifts.squat.weight, 72.5);
eq('Fehlerzaehler zurueckgesetzt', mo2.lifts.squat.fails, 0);
eq('A/B trotzdem unberuehrt', mo2.next, 'A');
const mo3 = P.applyLog(P.initialState(config), config,
  { date:'2026-09-10', type:'maxout', lift:'squat', weight:90, reps:1, newWorking:5 });
eq('nie unter Hantelgewicht', mo3.lifts.squat.weight, 20);

print('\n--- Und die Ableitbarkeit bleibt ---');
const gemischt = [
  { date:'2026-09-01', workout:'A', type:'strength', lifts:[win('squat',47.5),win('bench',35),win('row',32.5)] },
  { date:'2026-09-05', type:'maxout', lift:'squat', weight:90, reps:1, newWorking:72 },
  { date:'2026-09-08', workout:'B', type:'strength', lifts:[win('squat',72.5),win('ohp',25),win('deadlift',60,1)] }
];
const abgeleitet = P.deriveState(config, gemischt);
eq('Kniebeuge nach Uebernahme und einer Einheit', abgeleitet.lifts.squat.weight, 75);
eq('nur die Krafteinheiten drehen den Wechsel', abgeleitet.next, 'A');

print('\n--- Geschaetztes Einer-Maximum ---');
eq('eine Wiederholung ist gemessen', P.e1rm(100, 1), 100);
eq('Formel bei 1 Wiederholung', P.e1rmFormel(1), 'gemessen');
eq('bis 6 Wiederholungen Brzycki', P.e1rmFormel(5), 'Brzycki');
eq('darueber Epley', P.e1rmFormel(8), 'Epley');
ok('5 Wiederholungen mit 100 kg ergeben rund 112,5', Math.abs(P.e1rm(100,5) - 112.5) < 0.6, P.e1rm(100,5));
ok('8 Wiederholungen mit 100 kg ergeben rund 126,7', Math.abs(P.e1rm(100,8) - 126.7) < 0.6, P.e1rm(100,8));
ok('mehr Wiederholungen ergeben mehr Maximum', P.e1rm(100,6) > P.e1rm(100,3));
eq('ueber 12 Wiederholungen keine Schaetzung', P.e1rm(100,15), null);
eq('ohne Gewicht keine Schaetzung', P.e1rm(0,5), null);

print('\n--- Arbeitsgewicht aus dem Maximum ---');
eq('80 % von 100, gerundet', P.arbeitsgewichtAus(100), 80);
eq('nie unter der Hantel', P.arbeitsgewichtAus(10), 20);
eq('ohne Maximum nichts', P.arbeitsgewichtAus(null), null);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Plattenrechner ---');
const cfg = { bar: 20, rounding: 2.5, plates: P.STANDARD_SCHEIBEN };
eq('leere Stange hat keine Scheiben', JSON.stringify(P.platten(20, cfg)), '[]');
eq('60 kg sind 20 pro Seite', JSON.stringify(P.platten(60, cfg)), '[20]');
eq('100 kg sind 25+15 pro Seite', JSON.stringify(P.platten(100, cfg)), '[25,15]');
eq('47,5 kg sind 10+2,5+1,25', JSON.stringify(P.platten(47.5, cfg)), '[10,2.5,1.25]');
eq('unter Hantelgewicht nicht ladbar', P.platten(15, cfg), null);
eq('krummes Gewicht nicht ladbar', P.platten(21, cfg), null);
eq('Text fuer 100 kg', P.plattenText(100, cfg), '25 + 15');
eq('Text fuer 60 kg', P.plattenText(60, cfg), '20');
eq('Text fuer die leere Stange', P.plattenText(20, cfg), 'leere Stange');
eq('110 kg sind 25 + 20 pro Seite', P.plattenText(110, cfg), '25 + 20');
eq('doppelte Scheiben werden gezaehlt', P.plattenText(120, cfg), '2×25');
// Gegenprobe: Summe muss stimmen
let summenFehler = 0;
for (let w = 20; w <= 200; w += 2.5) {
  const p = P.platten(w, cfg);
  if (p && Math.abs(20 + 2 * p.reduce((a, b) => a + b, 0) - w) > 1e-6) summenFehler++;
}
eq('jede Aufteilung ergibt wieder das Gewicht', summenFehler, 0);

print('\n--- Aufwaermsaetze ---');
const ws = P.waermsaetze(80, cfg);
eq('beginnt mit der leeren Stange', ws[0].weight, 20);
eq('und zwar zweimal', ws[0].saetze, 2);
ok('steigen an', ws.every((s, i) => i === 0 || s.weight > ws[i-1].weight), JSON.stringify(ws.map(s=>s.weight)));
ok('bleiben unter dem Arbeitsgewicht', ws.every(s => s.weight < 80));
ok('Wiederholungen sinken bei steigender Last', ws[ws.length-1].reps <= ws[1].reps);
ok('alle sind ladbar', ws.every(s => P.platten(s.weight, cfg) !== null), JSON.stringify(ws.map(s=>s.weight)));
eq('bei fast leerer Stange nur die Stange', P.waermsaetze(22.5, cfg).length, 1);
const ws2 = P.waermsaetze(47.5, cfg);
ok('keine doppelten Gewichte', new Set(ws2.map(s=>s.weight)).size === ws2.length, JSON.stringify(ws2.map(s=>s.weight)));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Wattziele aus der FTP ---');
eq('88 bis 93 Prozent von 240', P.wattBereich([0.88, 0.93], 240), '211–223 W');
eq('gleiche Grenzen ergeben einen Wert', P.wattBereich([0.7, 0.7], 200), '140 W');
eq('ohne FTP kein Ziel', P.wattBereich([0.88, 0.93], null), null);
eq('ohne Bereich kein Ziel', P.wattBereich(null, 240), null);
eq('unvollstaendiger Bereich ergibt nichts', P.wattBereich([0.88], 240), null);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
