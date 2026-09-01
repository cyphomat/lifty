// Ausfuehren: jsc --module-file=tests/geraete.test.js
import * as G from '../js/geraete.js';
import { MOVES, generateWod } from '../js/wod.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const state = { lifts: {
  squat: { weight: 80 }, bench: { weight: 60 }, row: { weight: 55 },
  ohp: { weight: 40 }, deadlift: { weight: 100 }
} };

print('\n--- Katalog ---');
ok('jedes Geraet hat Kennung und Namen', G.GERAETE.every(g => g.id && g.name));
ok('Kennungen sind eindeutig', new Set(G.GERAETE.map(g => g.id)).size === G.GERAETE.length);
eq('ALLE_GERAETE deckt den Katalog', G.ALLE_GERAETE.length, G.GERAETE.length);
eq('Name zur Kennung', G.geraetName('kettlebell'), 'Kettlebell');
eq('unbekannte Kennung bleibt sichtbar', G.geraetName('trampolin'), 'trampolin');

print('\n--- Jede Bewegung nennt ihre Geraete ---');
ok('kein Feld fehlt', MOVES.every(m => Array.isArray(m.geraete)));
const unbekannt = MOVES.flatMap(m => m.geraete).filter(g => !G.ALLE_GERAETE.includes(g));
ok('keine unbekannte Geraetekennung', unbekannt.length === 0, unbekannt.join(', '));
ok('Langhantelteile brauchen die Langhantel',
  MOVES.filter(m => m.kat === 'hantel').every(m => m.geraete.includes('langhantel')));
ok('Burpees brauchen nichts', MOVES.find(m => m.id === 'burpee').geraete.length === 0);

print('\n--- Machbarkeit ---');
const bw = { geraete: [] };
ok('Koerpergewicht geht ueberall', G.machbar(bw, []));
ok('fehlendes Geraet sperrt', !G.machbar({ geraete: ['langhantel'] }, ['kurzhantel']));
ok('vorhandenes Geraet erlaubt', G.machbar({ geraete: ['langhantel'] }, ['langhantel', 'box']));
ok('mehrere noetige Geraete: alle muessen da sein',
  !G.machbar({ geraete: ['a', 'b'] }, ['a']));
eq('mit voller Ausstattung ist alles machbar',
  G.machbare(MOVES, G.ALLE_GERAETE).length, MOVES.length);
ok('ohne Geraete bleiben nur Koerpergewichtsuebungen',
  G.machbare(MOVES, []).every(m => m.geraete.length === 0));
ok('und das sind mehr als null', G.machbare(MOVES, []).length > 0);

print('\n--- Orte aus der Konfiguration ---');
eq('ohne Eintrag keine Orte', G.gyms({}).length, 0);
eq('null-Konfiguration kippt nicht', G.gyms(null).length, 0);
eq('kaputter Eintrag statt Liste', G.gyms({ gyms: 'nope' }).length, 0);

const cfg = { gyms: [
  { id: 'home', name: 'Homegym', geraete: ['kettlebell', 'springseil'] },
  { id: 'box', name: 'Box', geraete: [...G.ALLE_GERAETE] },
  { id: '  ', name: 'Namenlos', geraete: [] },
  { name: 'ohne Kennung', geraete: [] }
] };
eq('Eintraege ohne brauchbare Kennung fliegen raus', G.gyms(cfg).length, 2);
eq('Ort per Kennung', G.gym(cfg, 'home').name, 'Homegym');
eq('unbekannter Ort ist null', G.gym(cfg, 'mond'), null);
eq('leere Kennung ist null', G.gym(cfg, ''), null);

const schmutzig = { gyms: [{ id: 'x', geraete: ['kettlebell', 'trampolin', 'kettlebell'] }] };
const x = G.gyms(schmutzig)[0];
eq('unbekanntes Geraet wird verworfen', x.geraete.join(','), 'kettlebell');
eq('Name faellt auf die Kennung zurueck', x.name, 'x');

print('\n--- Aktive Geraete ---');
eq('ohne Wahl gilt alles', G.aktiveGeraete(cfg, '').length, G.ALLE_GERAETE.length);
eq('unbekannter Ort gilt als alles', G.aktiveGeraete(cfg, 'mond').length, G.ALLE_GERAETE.length);
eq('gewaehlter Ort liefert seine Ausstattung', G.aktiveGeraete(cfg, 'home').length, 2);

print('\n--- Neue Orte ---');
const n1 = G.neuerGym('Homegym', []);
eq('Kennung aus dem Namen', n1.id, 'homegym');
eq('startet mit voller Ausstattung', n1.geraete.length, G.ALLE_GERAETE.length);
eq('Kennung weicht Kollisionen aus', G.neuerGym('Homegym', [n1]).id, 'homegym-2');
eq('Sonderzeichen fallen raus', G.neuerGym('Crossfit Box!', []).id, 'crossfit-box');
eq('nur Sonderzeichen ergibt einen Rueckfall', G.neuerGym('!!!', []).id, 'gym');
ok('Vorlagen haben eindeutige Kennungen',
  new Set(G.vorlagen().map(o => o.id)).size === G.vorlagen().length);
ok('Vorlagen nennen nur bekannte Geraete',
  G.vorlagen().every(o => o.geraete.every(g => G.ALLE_GERAETE.includes(g))));

print('\n--- Der Generator haelt sich daran ---');
const nurKb = ['kettlebell', 'springseil'];
for (let seed = 0; seed < 40; seed++) {
  const w = generateWod(state, seed, {}, nurKb);
  const verletzt = w.teile.filter(teil => {
    const m = MOVES.find(x => x.id === teil.id);
    return !G.machbar(m, nurKb);
  });
  if (verletzt.length) { ok(`Seed ${seed} bleibt im Vorrat`, false, verletzt.map(v => v.name).join(', ')); break; }
  if (seed === 39) ok('40 Seeds bleiben im Vorrat', true);
}

const ohne = generateWod(state, 7, {});
ok('ohne Geraeteangabe wie bisher', ohne.teile.length > 0);
ok('null bedeutet keine Einschraenkung',
  JSON.stringify(generateWod(state, 7, {}, null)) === JSON.stringify(ohne));

// Eine leere Liste heisst "hier steht nichts" — dann greift der Rueckfall,
// damit statt eines leeren Bildschirms wenigstens ein Workout dasteht.
const leer = generateWod(state, 3, {}, []);
ok('zu wenig Geraete liefert trotzdem ein Workout', leer.teile.length > 0);

// Ausgeschlossene Uebungen und Geraetefilter greifen zusammen.
const mitAus = generateWod(state, 11, { wod: { aus: ['kbswing'] } }, nurKb);
ok('ausgeschlossene Uebung bleibt draussen', !mitAus.teile.some(teil => teil.id === 'kbswing'));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
