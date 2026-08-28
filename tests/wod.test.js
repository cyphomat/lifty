// Ausfuehren: jsc --module-file=tests/wod.test.js
import * as W from '../js/wod.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const state = { lifts: {
  squat:{weight:55,fails:0}, bench:{weight:37.5,fails:0}, row:{weight:35,fails:0},
  ohp:{weight:27.5,fails:0}, deadlift:{weight:70,fails:0} } };

print('\n--- Gleicher Seed, gleiches Workout ---');
const a = W.generateWod(state, 12345);
const b = W.generateWod(state, 12345);
eq('identisch reproduzierbar', JSON.stringify(a), JSON.stringify(b));
ok('anderer Seed liefert etwas anderes',
   JSON.stringify(W.generateWod(state, 999)) !== JSON.stringify(a));

print('\n--- Ueber 400 Seeds muss jedes Workout gueltig sein ---');
let maxHantel = 0, fehlendeTeile = 0, kaputteLast = 0, leereNamen = 0, dopplung = 0;
const formate = {};
for (let s = 1; s <= 400; s++) {
  const w = W.generateWod(state, s);
  formate[w.formatId] = (formate[w.formatId] || 0) + 1;
  const soll = W.FORMATE.find(f => f.id === w.formatId).teile;
  if (w.teile.length !== soll) fehlendeTeile++;
  const namen = w.teile.map(t => t.name);
  if (new Set(namen).size !== namen.length) dopplung++;
  const hantel = w.teile.filter(t => t.last !== null).length;
  if (hantel > maxHantel) maxHantel = hantel;
  for (const t of w.teile) {
    if (!t.name) leereNamen++;
    if (t.last !== null && (t.last < 20 || Math.round(t.last * 10) % 25 !== 0)) kaputteLast++;
    if (w.formatId !== 'tabata' && !(t.menge > 0)) fehlendeTeile++;
  }
}
eq('immer die richtige Anzahl Teile', fehlendeTeile, 0);
eq('nie dieselbe Uebung doppelt', dopplung, 0);
eq('nie mehr als ein Langhantelteil', maxHantel, 1);
eq('keine leeren Namen', leereNamen, 0);
eq('alle Lasten >= 20 kg und auf 2,5 gerundet', kaputteLast, 0);
ok('alle fuenf Formate kommen vor', Object.keys(formate).length === 5, JSON.stringify(formate));

print('\n--- Lasten haengen am tatsaechlichen Stand ---');
const schwach = { lifts: { squat:{weight:40}, bench:{weight:30}, row:{weight:30}, ohp:{weight:20}, deadlift:{weight:50} } };
const stark   = { lifts: { squat:{weight:120}, bench:{weight:90}, row:{weight:80}, ohp:{weight:60}, deadlift:{weight:180} } };
let gefunden = false;
for (let s = 1; s <= 200 && !gefunden; s++) {
  const w1 = W.generateWod(schwach, s), w2 = W.generateWod(stark, s);
  const l1 = w1.teile.find(t => t.last), l2 = w2.teile.find(t => t.last);
  if (l1 && l2) { ok('starker Athlet bekommt mehr Last', l2.last > l1.last, `${l1.last} vs ${l2.last}`); gefunden = true; }
}
ok('ueberhaupt ein Langhantel-WOD gefunden', gefunden);

print('\n--- Tabata hat keine Wiederholungszahl ---');
let tab = null;
for (let s = 1; s <= 500 && !tab; s++) { const w = W.generateWod(state, s); if (w.formatId === 'tabata') tab = w; }
ok('Tabata existiert', !!tab);
if (tab) eq('Menge bleibt leer', tab.teile[0].menge, null);

print('\n--- Beschriftung fuer Log und Historie ---');
const lbl = W.wodLabel(a);
ok('Label ist gefuellt', lbl.length > 8, lbl);
ok('Label nennt die Uebungen', a.teile.every(t => lbl.includes(t.name)));

print('\n--- Seed aus Text ist stabil ---');
eq('gleicher Text, gleicher Seed', W.seedAus('2026-09-02'), W.seedAus('2026-09-02'));
ok('anderer Text, anderer Seed', W.seedAus('2026-09-02') !== W.seedAus('2026-09-03'));

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Jede Uebung hat eine Skalierung ---');
eq('keine Uebung ohne Alternative',
   W.MOVES.filter(m => !m.skalierung || !m.skalierung.length).length, 0);
const klimm = W.MOVES.find(m => m.id === 'pullup');
ok('Klimmzuege nennen Ring Rows zuerst', klimm.skalierung[0].includes('Ring Rows'), klimm.skalierung[0]);
ok('mehrere Stufen', klimm.skalierung.length >= 3, klimm.skalierung.length);
ok('Skalierungen kommen im erzeugten WOD mit',
   W.generateWod(state, 7).teile.every(t => Array.isArray(t.skalierung)));

print('\n--- Ausgeschlossene Uebungen tauchen nicht auf ---');
const ohne = { wod: { aus: ['pullup'] } };
let klimmzuege = 0;
for (let s = 1; s <= 400; s++) {
  if (W.generateWod(state, s, ohne).teile.some(t => t.name === 'Klimmzüge')) klimmzuege++;
}
eq('Klimmzuege ueber 400 Seeds: nie', klimmzuege, 0);
let ohneAusschluss = 0;
for (let s = 1; s <= 400; s++) {
  if (W.generateWod(state, s).teile.some(t => t.name === 'Klimmzüge')) ohneAusschluss++;
}
ok('ohne Ausschluss kommen sie sehr wohl vor', ohneAusschluss > 10, ohneAusschluss);

print('\n--- Auch mit vielen Ausschluessen bleibt es benutzbar ---');
const vieleAus = { wod: { aus: ['pullup','burpee','boxjump','kbswing','situp','pushup','lunge'] } };
let leer = 0, zuWenig = 0;
for (let s = 1; s <= 200; s++) {
  const w = W.generateWod(state, s, vieleAus);
  if (!w.teile.length) leer++;
  if (w.teile.length < 2) zuWenig++;
  if (w.teile.some(t => vieleAus.wod.aus.includes(t.id))) zuWenig++;
}
eq('nie ein leeres Workout', leer, 0);
eq('nie unter zwei Teilen und nie etwas Ausgeschlossenes', zuWenig, 0);

print('\n--- Notbremse: schliesst man alles aus, bleibt der volle Pool ---');
const allesAus = { wod: { aus: W.MOVES.map(m => m.id) } };
ok('lieber ein Workout als gar keins', W.generateWod(state, 3, allesAus).teile.length > 0);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Jede Uebung erklaert sich ---');
eq('keine Uebung ohne Erklaerung',
   W.MOVES.filter(m => !m.erklaerung || m.erklaerung.length < 60).length, 0);
ok('Erklaerungen sind zwei Saetze oder mehr',
   W.MOVES.every(m => (m.erklaerung.match(/[.!?]/g) || []).length >= 2),
   W.MOVES.filter(m => (m.erklaerung.match(/[.!?]/g) || []).length < 2).map(m => m.id).join(','));
ok('Erklaerung kommt im erzeugten WOD mit',
   W.generateWod(state, 11).teile.every(t => typeof t.erklaerung === 'string' && t.erklaerung.length > 0));

print('\n--- Latzug als Ersatz fuer die Klimmzuege ---');
const lat = W.MOVES.find(m => m.id === 'latzug');
ok('existiert', !!lat);
eq('zaehlt als Turnen', lat.kat, 'turnen');
ok('nennt den Bezug zum Klimmzug', lat.erklaerung.includes('Klimmzug'), lat.erklaerung.slice(0,50));
let latGesehen = 0;
for (let s = 1; s <= 300; s++) {
  if (W.generateWod(state, s, { wod:{ aus:['pullup'] } }).teile.some(t => t.id === 'latzug')) latGesehen++;
}
ok('kommt trotz Klimmzug-Ausschluss vor', latGesehen > 5, latGesehen);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
