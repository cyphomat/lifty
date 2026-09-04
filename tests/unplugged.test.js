// Ausfuehren: jsc --module-file=tests/unplugged.test.js
import * as U from '../js/unplugged.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

print('\n--- Der Vorrat ---');
ok('jede Uebung hat Kennung, Name, Richtung',
  U.UEBUNGEN.every(u => u.id && u.name && u.richtung));
ok('Kennungen sind eindeutig',
  new Set(U.UEBUNGEN.map(u => u.id)).size === U.UEBUNGEN.length);
ok('jede Richtung ist bekannt',
  U.UEBUNGEN.every(u => U.RICHTUNGEN.includes(u.richtung)));
ok('jede Uebung sagt, ob sie laut ist',
  U.UEBUNGEN.every(u => typeof u.laut === 'boolean'));
ok('jede Uebung hat einen Cue', U.UEBUNGEN.every(u => u.cue && u.cue.length > 10));
ok('jede Uebung erklaert sich', U.UEBUNGEN.every(u => u.erklaerung && u.erklaerung.length > 40));
ok('jede Uebung nennt eine leichtere Fassung',
  U.UEBUNGEN.every(u => Array.isArray(u.leichter) && u.leichter.length));
ok('und eine schwerere', U.UEBUNGEN.every(u => Array.isArray(u.schwerer) && u.schwerer.length));

// Der Kern des Ganzen: nichts darf ein Geraet brauchen. Stuhl und Sofa
// stehen ohnehin da — eine Klimmzugstange nicht.
const verboten = /hantel|kettlebell|stange|seil|rudergerät|bike|ball|band|klimmzug/i;
const mitGeraet = U.UEBUNGEN.filter(u => verboten.test(u.name));
ok('keine Uebung braucht ein Geraet', mitGeraet.length === 0, mitGeraet.map(u => u.name).join(', '));

print('\n--- Leise ---');
const leise = U.vorrat(true);
ok('im Leise-Modus ist nichts Lautes dabei', leise.every(u => !u.laut));
ok('und es bleibt trotzdem genug uebrig', leise.length >= 12);
ok('ohne Ruecksicht ist alles dabei', U.vorrat(false).length === U.UEBUNGEN.length);
ok('es gibt ueberhaupt laute Uebungen', U.UEBUNGEN.some(u => u.laut));
// Jede Richtung muss auch leise bedienbar sein, sonst kippt die Auswahl.
for (const richtung of U.RICHTUNGEN) {
  ok(`Richtung "${richtung}" ist auch leise besetzt`,
    leise.some(u => u.richtung === richtung));
}

print('\n--- Die Session ---');
const s = U.baueSession({ minuten: 15, seed: 1 });
eq('vier Uebungen', s.teile.length, 4);
eq('vier Runden', s.runden, 4);
eq('vierzig Sekunden Arbeit', s.arbeit, 40);
eq('leise ist Voreinstellung', s.leise, true);
ok('bleibt unter sechzehn Minuten', s.gesamtSekunden <= 16 * 60, `${s.gesamtSekunden}s`);
ok('und ist nicht laecherlich kurz', s.gesamtSekunden >= 13 * 60, `${s.gesamtSekunden}s`);
ok('keine Uebung doppelt', new Set(s.teile.map(t => t.id)).size === s.teile.length);

print('\n--- Alle Laengen tragen ---');
for (const l of U.LAENGEN) {
  const x = U.baueSession({ minuten: l.minuten, seed: 7 });
  eq(`${l.minuten} Min: Anzahl Uebungen`, x.teile.length, l.uebungen);
  const abweichung = Math.abs(x.gesamtSekunden - l.minuten * 60);
  ok(`${l.minuten} Min: Dauer passt (${Math.round(x.gesamtSekunden / 60 * 10) / 10} Min)`,
    abweichung <= 90, `${abweichung}s daneben`);
}
eq('unbekannte Laenge faellt auf fuenfzehn zurueck',
  U.baueSession({ minuten: 42, seed: 1 }).minuten, 15);

print('\n--- Ausgewogen statt zufaellig ---');
// Der eigentliche Zweck der Richtungen: nicht viermal Beine hintereinander.
let einseitig = 0;
for (let seed = 0; seed < 60; seed++) {
  const x = U.baueSession({ minuten: 15, seed });
  const richtungen = x.teile.map(t => U.UEBUNGEN.find(u => u.id === t.id).richtung);
  if (new Set(richtungen).size < 4) einseitig++;
}
eq('60 Seeds decken jedes Mal alle vier Richtungen ab', einseitig, 0);

print('\n--- Deterministisch ---');
ok('gleicher Seed, gleiches Ergebnis',
  JSON.stringify(U.baueSession({ minuten: 15, seed: 5 })) ===
  JSON.stringify(U.baueSession({ minuten: 15, seed: 5 })));
const verschieden = new Set();
for (let seed = 0; seed < 30; seed++) {
  verschieden.add(U.baueSession({ minuten: 15, seed }).teile.map(t => t.id).join(','));
}
ok('verschiedene Seeds ergeben verschiedene Einheiten', verschieden.size >= 20, `${verschieden.size}/30`);

print('\n--- Leise wirkt bis ins Ergebnis ---');
let lauteDrin = 0;
for (let seed = 0; seed < 60; seed++) {
  const x = U.baueSession({ minuten: 20, seed, leise: true });
  if (x.teile.some(t => U.UEBUNGEN.find(u => u.id === t.id).laut)) lauteDrin++;
}
eq('in 60 leisen Einheiten keine einzige laute Uebung', lauteDrin, 0);
ok('ohne Leise-Modus taucht Lautes auch auf', (() => {
  for (let seed = 0; seed < 60; seed++) {
    const x = U.baueSession({ minuten: 20, seed, leise: false });
    if (x.teile.some(t => U.UEBUNGEN.find(u => u.id === t.id).laut)) return true;
  }
  return false;
})());

print('\n--- Der Ablauf ---');
const a = U.ablauf(s);
eq('Arbeitsabschnitte: Uebungen mal Runden',
  a.filter(x => x.art === 'arbeit').length, 4 * 4);
// Nach dem letzten Satz kommt Schluss, keine Pause ins Leere.
eq('eine Pause weniger als Arbeitsabschnitte',
  a.filter(x => x.art === 'pause').length, 4 * 4 - 1);
eq('der erste Abschnitt ist Arbeit', a[0].art, 'arbeit');
eq('der letzte auch', a[a.length - 1].art, 'arbeit');
eq('Runde eins zuerst', a[0].runde, 1);
eq('und zuletzt die letzte Runde', a[a.length - 1].runde, s.runden);
eq('Summe der Abschnitte gleicht der Gesamtdauer',
  a.reduce((n, x) => n + x.sekunden, 0), s.gesamtSekunden);
ok('jede Pause kuendigt an, was kommt',
  a.filter(x => x.art === 'pause').every(x => x.naechster && x.naechster.name));
ok('jeder Arbeitsabschnitt kennt seine Uebung',
  a.filter(x => x.art === 'arbeit').every(x => x.teil && x.teil.name));
// Reihenfolge innerhalb einer Runde muss der Auswahl folgen.
const ersteRunde = a.filter(x => x.art === 'arbeit' && x.runde === 1).map(x => x.teil.id);
eq('Runde eins laeuft die Uebungen der Reihe nach', ersteRunde.join(','), s.teile.map(t => t.id).join(','));

print('\n--- Beschriftung ---');
const l = U.label(s);
ok('nennt die Dauer', l.includes('15 Min'));
ok('nennt die Uebungen', s.teile.every(t => l.includes(t.name)));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
