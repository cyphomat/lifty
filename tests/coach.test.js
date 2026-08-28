// Ausfuehren: jsc --module-file=tests/coach.test.js
import * as C from '../js/coach.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const config = {
  lifts: {
    squat:    { name: 'Kniebeuge',       increment: 2.5, start: 47.5, reference: 80 },
    bench:    { name: 'Bankdrücken',     increment: 2.5, start: 35,   reference: 60 },
    row:      { name: 'Rudern',          increment: 2.5, start: 32.5, reference: 55 },
    ohp:      { name: 'Schulterdrücken', increment: 2.5, start: 25,   reference: 40 },
    deadlift: { name: 'Kreuzheben',      increment: 5,   start: 60,   reference: 100 }
  },
  workouts: {
    A: [{ lift: 'squat' }, { lift: 'bench' }, { lift: 'row' }],
    B: [{ lift: 'squat' }, { lift: 'ohp' }, { lift: 'deadlift' }]
  }
};
const base = () => ({
  next: 'A', history: [],
  lifts: { squat:{weight:47.5,fails:0}, bench:{weight:35,fails:0}, row:{weight:32.5,fails:0},
           ohp:{weight:25,fails:0}, deadlift:{weight:60,fails:0} }
});
const HEUTE = new Date(2026, 8, 15); // Di, 15.09.2026

print('\n--- Tage seit der letzten Einheit ---');
eq('gestern', C.daysSince('2026-09-14', HEUTE), 1);
eq('vor 30 Tagen', C.daysSince('2026-08-16', HEUTE), 30);
eq('ohne Datum null', C.daysSince(null, HEUTE), null);

print('\n--- Wochenstreak ---');
eq('ohne Historie 0', C.weekStreak([], HEUTE), 0);
const dreiWochen = [{date:'2026-09-01'},{date:'2026-09-08'},{date:'2026-09-15'}];
eq('drei Wochen am Stueck', C.weekStreak(dreiWochen, HEUTE), 3);
const mitLuecke = [{date:'2026-09-01'},{date:'2026-09-15'}];
eq('Luecke bricht den Streak', C.weekStreak(mitLuecke, HEUTE), 1);
const nurLetzteWoche = [{date:'2026-09-08'}];
eq('laufende Woche ohne Einheit zaehlt nicht mit', C.weekStreak(nurLetzteWoche, HEUTE), 1);

print('\n--- Fortschritt zu den alten Arbeitsgewichten ---');
const p = C.progressToReference(base(), config);
ok('Kniebeuge 47,5 von 80 sind rund 59 %', Math.abs(p.perLift.squat.anteil - 0.59375) < 1e-9);
ok('Gesamtwert liegt zwischen 0 und 1', p.gesamt > 0.55 && p.gesamt < 0.65, p.gesamt);
const stark = base(); stark.lifts.squat.weight = 100;
eq('ueber dem Ziel wird bei 100 % gekappt', C.progressToReference(stark, config).perLift.squat.anteil, 1);

print('\n--- Die Ansage passt zur Lage ---');
let s = base();
eq('ohne Historie: Comeback', C.directive(s, config, HEUTE).situation, 'comeback');
eq('Comeback heisst Technik', C.directive(s, config, HEUTE).intensitaet.stufe, 'technik');

s = base(); s.history = [{date:'2026-06-01'}];
eq('lange her: Comeback', C.directive(s, config, HEUTE).situation, 'comeback');

s = base(); s.history = [{date:'2026-09-14'}]; s.lifts.bench.fails = 1;
eq('offener Fehlversuch schlaegt alles andere', C.directive(s, config, HEUTE).situation, 'nachFehlversuch');
eq('und wird hart angesagt', C.directive(s, config, HEUTE).intensitaet.stufe, 'hart');

s = base(); s.history = dreiWochen.concat([{date:'2026-08-25'}]);
Object.values(s.lifts).forEach(l => l.weight = 999);
eq('vier Wochen am Stueck: Streak', C.directive(s, config, HEUTE).situation, 'streak');

s = base(); s.history = [{date:'2026-09-14'}];
eq('unter 70 % vom Ziel: Wiederaufbau', C.directive(s, config, HEUTE).situation, 'leicht');

s = base(); s.history = [{date:'2026-09-14'}]; s.next = 'B';
Object.values(s.lifts).forEach(l => l.weight = 999);
eq('Workout B wird als schwer angesagt', C.directive(s, config, HEUTE).intensitaet.label, 'SCHWER');

print('\n--- Deload wird erkannt ---');
s = base(); s.history = [{date:'2026-09-14'}]; s.lifts.squat.weight = 42.5;
const log = { lifts: [{ lift:'squat', weight: 47.5 }] };
eq('Gewicht gefallen = Deload', C.directive(s, config, HEUTE, log).situation, 'nachDeload');
eq('ohne Log kein Deload', C.directive(s, config, HEUTE, null).situation !== 'nachDeload', true);

print('\n--- Sprueche sind stabil, nicht zufaellig ---');
s = base();
const a1 = C.directive(s, config, HEUTE).spruch;
const a2 = C.directive(s, config, HEUTE).spruch;
eq('gleicher Tag, gleicher Spruch', a1, a2);
ok('Spruch ist nicht leer', a1.length > 10);
const morgen = C.directive(s, config, new Date(2026, 8, 16)).spruch;
ok('anderer Tag darf anderen Spruch geben', typeof morgen === 'string');

print('\n--- Gewichtstrend ---');
eq('ohne Daten null', C.gewichtsTrend([]), null);
const punkte = [];
for (let i = 0; i < 20; i++) punkte.push({ date: `2026-09-${String(i+1).padStart(2,'0')}`, weight: 90 - i * 0.1 });
const t = C.gewichtsTrend(punkte);
ok('Abnahme wird als negatives Delta erkannt', t.delta < 0, t.delta);
ok('aktueller Wert plausibel', t.aktuell > 87 && t.aktuell < 90, t.aktuell);
eq('verrauschte Einzelwerte werden gemittelt', t.n, 20);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Form aus intervals.icu ---');
eq('ohne Daten keine Aussage', C.formLage(null), null);
eq('unvollstaendige Daten ergeben nichts', C.formLage({ ctl: 40 }), null);
const frisch = C.formLage({ ctl: 50, atl: 40, date: '2026-09-01' });
eq('Form ist Fitness minus Ermuedung', frisch.form, 10);
eq('positiv heisst frisch', frisch.stufe, 'frisch');
eq('neutral bei leicht negativ', C.formLage({ ctl: 50, atl: 55 }).stufe, 'neutral');
eq('muede ab minus zehn', C.formLage({ ctl: 50, atl: 65 }).stufe, 'muede');
eq('platt ab minus zwanzig', C.formLage({ ctl: 50, atl: 75 }).stufe, 'platt');
ok('Fitness und Ermuedung werden mitgegeben', frisch.fitness === 50 && frisch.ermuedung === 40);
ok('jede Stufe hat einen Text', ['frisch','neutral','muede','platt']
  .every(s => { const w = { frisch:{ctl:50,atl:40}, neutral:{ctl:50,atl:55}, muede:{ctl:50,atl:65}, platt:{ctl:50,atl:75} }[s];
                return C.formLage(w).text.length > 20; }));
eq('Grenzfall genau null ist neutral', C.formLage({ ctl: 50, atl: 50 }).stufe, 'neutral');

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
