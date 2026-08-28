// Ausfuehren: jsc --module-file=tests/stats.test.js
import * as S from '../js/stats.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const logs = [
  { date:'2026-09-01', workout:'A', type:'strength', lifts:[
    { lift:'squat', weight:50, reps:[5,5,5,5,5], success:true },
    { lift:'bench', weight:35, reps:[5,5,5,5,5], success:true }]},
  { date:'2026-09-03', type:'wod', label:'AMRAP 12' },
  { date:'2026-09-05', workout:'A', type:'strength', lifts:[
    { lift:'squat', weight:52.5, reps:[5,5,5,4,3], success:false },
    { lift:'bench', weight:37.5, reps:[5,5,5,5,5], success:true }]}
];

print('\n--- Tonnage ---');
eq('erste Einheit: 50x25 + 35x25', S.tonnage(logs[0]), 50*25 + 35*25);
eq('ein WOD hat keine Tonnage', S.tonnage(logs[1]), 0);
eq('nicht geschaffte Wiederholungen zaehlen trotzdem', S.tonnage(logs[2]), 52.5*22 + 37.5*25);

print('\n--- Zusammenfassung ---');
const s = S.summary(logs);
eq('drei Einheiten insgesamt', s.einheiten, 3);
eq('davon zwei Kraft', s.kraft, 2);
eq('und ein WOD', s.wods, 1);
eq('Tonnage summiert', s.tonnage, Math.round(50*25+35*25 + 52.5*22+37.5*25));
eq('Bestwert Bank ist der letzte saubere', s.best.bench.weight, 37.5);
eq('Bestwert Kniebeuge ignoriert den Fehlversuch', s.best.squat.weight, 50);
eq('Zeitraum korrekt', s.von + '..' + s.bis, '2026-09-01..2026-09-05');
ok('Einheiten pro Woche berechnet', s.proWoche > 0, s.proWoche);
const leer = S.summary([]);
eq('leere Historie bricht nicht', leer.einheiten, 0);
eq('und hat keine Tonnage', leer.tonnage, 0);

print('\n--- Verlauf einer Uebung ---');
const v = S.serie(logs, 'squat');
eq('zwei Punkte', v.length, 2);
eq('aufsteigend nach Datum', v[0].date, '2026-09-01');
eq('WOD taucht nicht auf', S.serie(logs, 'burpee').length, 0);

print('\n--- Sparkline ---');
eq('ohne Punkte kein Diagramm', S.sparkline([]), null);
const sp = S.sparkline(v, 300, 60);
eq('Minimum erkannt', sp.min, 50);
eq('Maximum erkannt', sp.max, 52.5);
eq('zwei Koordinaten', sp.koord.length, 2);
ok('hoechster Wert liegt oben', sp.koord[1].y < sp.koord[0].y, `${sp.koord[1].y} vs ${sp.koord[0].y}`);
ok('Pfad beginnt mit M', sp.linie.startsWith('M'));
ok('Flaeche ist geschlossen', sp.flaeche.endsWith('Z'));
const einer = S.sparkline([{date:'2026-09-01',weight:60}], 300, 60);
ok('ein einzelner Punkt landet mittig', Math.abs(einer.koord[0].x - 150) < 1, einer.koord[0].x);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
