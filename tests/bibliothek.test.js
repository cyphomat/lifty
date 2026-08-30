// Ausfuehren: jsc --module-file=tests/bibliothek.test.js
import * as B from '../js/bibliothek.js';
import { LIFT_INFO, SKILL, MOBILITY, FINISHER } from '../js/content.js';
import { MOVES } from '../js/wod.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const config = { lifts: { squat: { name: 'Kniebeuge' }, bench: { name: 'Bankdrücken' } } };
const state = { lifts: { squat: { weight: 82.5, fails: 0 } } };

print('\n--- Alle Uebungen gebuendelt ---');
const alle = B.alleUebungen(config, state);
const erwartet = Object.keys(LIFT_INFO).length + SKILL.length + MOBILITY.length + FINISHER.length + MOVES.length;
eq('Anzahl aus allen Quellen', alle.length, erwartet);
ok('alphabetisch sortiert', alle.every((u, i) => i === 0 || u.name.localeCompare(alle[i - 1].name, 'de') >= 0));
ok('jede Uebung hat eine bekannte Kategorie', alle.every(u => B.KATEGORIEN.includes(u.kategorie)));
ok('IDs sind eindeutig', new Set(alle.map(u => u.id)).size === alle.length);

const squat = alle.find(u => u.id === 'lift:squat');
eq('Name kommt aus config, nicht aus dem internen Tag', squat.name, 'Kniebeuge');
eq('aktuelles Arbeitsgewicht aus state', squat.aktuell, '82.5 kg Arbeitsgewicht');

const bench = alle.find(u => u.id === 'lift:bench');
eq('ohne state-Eintrag kein aktuelles Gewicht', bench.aktuell, null);

const thruster = alle.find(u => u.id === 'wod:thruster');
ok('Jam-Uebung mit Dosis aus dem Wiederholungsbereich', thruster.dosis.includes('–'));

print('\n--- Suche ---');
eq('leere Suche liefert alles', B.suche(alle, '').length, alle.length);
// Nur pruefen, dass der Name-Treffer dabei ist — nicht, dass er allein
// dasteht: andere Uebungen duerfen "Bankdrücken" legitim im Erklaerungs-
// text erwaehnen (z.B. eine Mobility-Uebung, die sich darauf bezieht).
ok('Name-Treffer', B.suche(alle, 'Bankdrücken').some(u => u.id === 'lift:bench'));
ok('Gross-Kleinschreibung egal', B.suche(alle, 'bankdrücken').some(u => u.id === 'lift:bench'));
ok('Treffer im Erklaerungstext', B.suche(alle, 'Hebelwirkung').length > 0);
ok('Treffer im Cue', B.suche(alle, 'Ellbogen').length > 0);
eq('nichts gefunden', B.suche(alle, 'xyzzy123').length, 0);
eq('Kategoriefilter allein', B.suche(alle, '', 'Mobility').length, MOBILITY.length);
eq('Suche plus Kategorie kombiniert', B.suche(alle, '', 'Kraft').length, Object.keys(LIFT_INFO).length);

print('\n--- Zufaellige Auswahl ---');
eq('leere Liste ergibt nichts', B.zufaellig([]), null);
eq('fester rng waehlt deterministisch den ersten', B.zufaellig(alle, () => 0), alle[0]);
eq('fester rng nahe 1 waehlt den letzten', B.zufaellig(alle, () => 0.999999), alle[alle.length - 1]);

print('\n--- YouTube-Suchlink ---');
ok('zeigt auf die YouTube-Suche, nicht auf ein geratenes Video',
   B.youtubeSuche('Back Squat').startsWith('https://www.youtube.com/results?search_query='));
ok('Name steckt kodiert im Link', B.youtubeSuche('Back Squat').includes(encodeURIComponent('Back Squat')));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
