// Ausfuehren: jsc --module-file=tests/bibliothek.test.js
import * as B from '../js/bibliothek.js';
import { LIFT_INFO, SKILL, MOBILITY, FINISHER, WARMUP, QUELLEN } from '../js/content.js';
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


print('\n--- Jede Uebung hat eine Korrektur, nicht nur ein Fehlerbild ---');
const lifts = Object.entries(LIFT_INFO);
ok('alle Grundlifts haben eine Korrektur',
   lifts.every(([, d]) => d.korrektur), lifts.filter(([, d]) => !d.korrektur).map(([n]) => n).join());
ok('jede Korrektur sagt WANN und WARUM',
   lifts.every(([, d]) => d.korrektur.wenn && d.korrektur.warum));
ok('jede Korrektur nennt mindestens zwei Uebungen',
   lifts.every(([, d]) => (d.korrektur.uebungen || []).length >= 2));
ok('jede Korrekturuebung hat Name und Dosis',
   lifts.every(([, d]) => d.korrektur.uebungen.every(u => u.name && u.dosis)));

print('\n--- Quellen zeigen ins Leere oder gar nicht ---');
// Eine Quelle unter einem Satz, den sie nicht stuetzt, sieht nach Sorgfalt
// aus und ist das Gegenteil. Mindestens die Kennung muss also aufloesen.
const mitQuelle = [
  ...lifts.map(([, d]) => d.korrektur && d.korrektur.quelle),
  ...SKILL.map(x => x.quelle), ...MOBILITY.map(x => x.quelle), ...FINISHER.map(x => x.quelle)
].filter(Boolean);
ok('es gibt ueberhaupt Quellenangaben', mitQuelle.length >= 4, String(mitQuelle.length));
ok('jede Kennung loest auf', mitQuelle.every(q => QUELLEN[q]),
   mitQuelle.filter(q => !QUELLEN[q]).join());
ok('jede Quelle hat Kurz- und Langform',
   Object.values(QUELLEN).every(q => q.kurz && q.lang));
ok('die Langform nennt ein Jahr',
   Object.values(QUELLEN).every(q => /\b(19|20)\d\d\b/.test(q.lang)));

print('\n--- McGill Big 3 im Warm-up ---');
eq('drei Uebungen', (WARMUP.rumpf || []).length, 3);
ok('Bird-Dog, Seitstuetz und Curl-up',
   ['Bird-Dog', 'Seitstütz', 'Curl-up'].every(n => WARMUP.rumpf.some(w => w.was.includes(n))));
ok('jede mit Dosis und Erklaerung', WARMUP.rumpf.every(w => w.t && w.was && w.detail));

print('\n--- Nichts, was im Studio nicht steht ---');
// Der Referenz-Guide, aus dem die Korrekturen stammen, ist zur Haelfte
// Strongman mit Spezialgeraet. Nichts davon steht im Fitness First — ein
// Eintrag, den er nicht ausfuehren kann, ist schlimmer als keiner.
const GIBT_ES_NICHT = /\b(axle|log press|yoke|atlas|sandbag|viper|continental|fat gripz|reverse hyper)/i;
const alles = B.alleUebungen(config, state);
const texte = alles.flatMap(u => [u.name, u.info, u.cue, u.fehler,
  ...(u.korrektur ? [u.korrektur.wenn, u.korrektur.warum, ...u.korrektur.uebungen.map(x => x.name)] : [])])
  .filter(Boolean);
ok('kein Strongman-Spezialgeraet in der Bibliothek',
   !texte.some(t => GIBT_ES_NICHT.test(t)), texte.filter(t => GIBT_ES_NICHT.test(t)).join(' | '));
ok('auch nicht im Warm-up',
   !Object.values(WARMUP).flat().some(w => GIBT_ES_NICHT.test(w.was + ' ' + w.detail)));

print('\n--- Man sucht eine Uebung auch ueber ihr Problem ---');
const lockout = B.suche(alles, 'lockout');
ok('"Lockout" findet den Strict Press',
   lockout.some(u => u.id === 'lift:ohp'), lockout.map(u => u.id).join());
const deficit = B.suche(alles, 'deficit');
ok('"Deficit" findet das Kreuzheben',
   deficit.some(u => u.id === 'lift:deadlift'), deficit.map(u => u.id).join());
ok('die Korrektur haengt auch am Bibliothekseintrag',
   alles.find(u => u.id === 'lift:squat').korrektur !== null);

print('\n--- Die neuen Technikuebungen ---');
for (const id of ['push-jerk', 'snatch-high-pull', 'paused-front-squat'])
  ok(`${id} ist da`, SKILL.some(x => x.id === id));
ok('alle Technikuebungen haben Dosis und Begruendung',
   SKILL.every(x => x.name && x.dosis && x.warum));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
