// Ausfuehren: jsc --module-file=tests/persoenlich.test.js
import * as PS from '../js/persoenlich.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);
const gleich = (n, a, b) => ok(n, JSON.stringify(a) === JSON.stringify(b),
  `(${JSON.stringify(a)} != ${JSON.stringify(b)})`);

print('\n--- Zeilen aus Text ---');
gleich('einfache Liste', PS.zeilenAusText('eins\nzwei'), ['eins', 'zwei']);
gleich('leere Zeilen fliegen raus', PS.zeilenAusText('eins\n\n  \nzwei'), ['eins', 'zwei']);
gleich('Leerraum am Rand faellt weg', PS.zeilenAusText('  eins  '), ['eins']);
gleich('leerer Text', PS.zeilenAusText(''), []);
gleich('null', PS.zeilenAusText(null), []);
eq('und zurueck', PS.textAusZeilen(['a', 'b']), 'a\nb');
eq('zurueck aus nichts', PS.textAusZeilen(null), '');

print('\n--- Stimme bauen ---');
gleich('aus Text wird alle', PS.baueStimme('eins\nzwei'), { sprueche: { alle: ['eins', 'zwei'] } });
eq('ohne Zeilen kommt null', PS.baueStimme('   '), null);
eq('ohne Zeilen und ohne Vorhandenes ebenfalls', PS.baueStimme('', null), null);

// Wer die Datei von Hand nach Situation aufgeteilt hat, darf das nicht
// dadurch verlieren, dass er im Textfeld etwas aendert.
const vonHand = { sprueche: { comeback: ['zurueck'], alle: ['alt'] } };
gleich('nach Situation getrennte Zeilen bleiben',
  PS.baueStimme('neu', vonHand), { sprueche: { comeback: ['zurueck'], alle: ['neu'] } });
gleich('und ueberleben auch ein geleertes Textfeld',
  PS.baueStimme('', vonHand), { sprueche: { comeback: ['zurueck'] } });
gleich('nur alle, geleert, ergibt null', PS.baueStimme('', { sprueche: { alle: ['weg'] } }), null);

print('\n--- Eigene Zeilen zurueck ins Feld ---');
eq('aus alle', PS.eigeneZeilen({ sprueche: { alle: ['a', 'b'] } }), 'a\nb');
eq('ohne Datei', PS.eigeneZeilen(null), '');
eq('ohne sprueche', PS.eigeneZeilen({}), '');
eq('nur situationsbezogene Zeilen zeigt das Feld nicht',
  PS.eigeneZeilen({ sprueche: { comeback: ['x'] } }), '');

print('\n--- Rekorde bauen ---');
const bau = e => PS.baueRekorde(e);
gleich('vollstaendiger Eintrag',
  bau([{ id: 'squat', datum: '2021-03-04', bestesEinzel: '140', bestes5er: '120' }]),
  { squat: { datum: '2021-03-04', bestesEinzel: 140, bestes5er: 120 } });
gleich('ohne Datum bleibt das Gewicht erhalten',
  bau([{ id: 'squat', datum: '', bestesEinzel: '140', bestes5er: '' }]),
  { squat: { bestesEinzel: 140 } });
// Ein Datum allein ist keine Bestleistung — sonst stuende ein Jahrestag im
// Kalender, zu dem es nichts zu sagen gibt.
gleich('Datum ohne Gewicht faellt weg', bau([{ id: 'squat', datum: '2021-03-04' }]), {});
gleich('leerer Eintrag faellt weg', bau([{ id: 'squat', bestesEinzel: '', bestes5er: '' }]), {});
gleich('null als Gewicht faellt weg', bau([{ id: 'squat', bestesEinzel: '0' }]), {});
gleich('unsinniges Gewicht faellt weg', bau([{ id: 'squat', bestesEinzel: 'schwer' }]), {});
gleich('halbes Datum wird verworfen, Gewicht bleibt',
  bau([{ id: 'squat', datum: '2021-03', bestesEinzel: '140' }]), { squat: { bestesEinzel: 140 } });
gleich('Eintrag ohne Kennung faellt weg', bau([{ bestesEinzel: '100' }]), {});
gleich('nichts ergibt nichts', bau([]), {});
gleich('undefined ergibt nichts', bau(undefined), {});
eq('Kommagewichte kommen als Zahl an',
  bau([{ id: 'ohp', bestesEinzel: '52.5' }]).ohp.bestesEinzel, 52.5);

print('\n--- Entwurf aus der Konfiguration ---');
const config = {
  lifts: { squat: { name: 'Back Squat' }, bench: { name: 'Bench Press' } },
  records: { programm: { squat: { datum: '2021-03-04', bestesEinzel: 140 } }, quelle: 'altes Logbuch' }
};
const entwurf = PS.rekordEntwurf(config);
eq('eine Zeile je Uebung', entwurf.length, 2);
eq('Name aus config', entwurf[0].name, 'Back Squat');
eq('vorhandener Wert wird uebernommen', entwurf[0].bestesEinzel, 140);
eq('fehlender Wert ist leer, nicht undefined', entwurf[0].bestes5er, '');
eq('Uebung ohne Rekord bleibt leer', entwurf[1].datum, '');
eq('leere Konfiguration kippt nicht', PS.rekordEntwurf(null).length, 0);
eq('Konfiguration ohne lifts', PS.rekordEntwurf({}).length, 0);

print('\n--- In die Konfiguration einsetzen ---');
const basis = { bar: 20, lifts: { squat: { name: 'Back Squat' } } };
const mit = PS.setzeInConfig(basis, { grund: '  Damit ich alt werde  ', rekorde: { squat: { bestesEinzel: 140 } } });
eq('Grund wird beschnitten gesetzt', mit.ziele.warum, 'Damit ich alt werde');
eq('Rekorde landen unter programm', mit.records.programm.squat.bestesEinzel, 140);
eq('der Rest bleibt unangetastet', mit.bar, 20);
ok('die Vorlage wird nicht veraendert', basis.ziele === undefined);

const ohne = PS.setzeInConfig(mit, { grund: '', rekorde: {} });
ok('leerer Grund entfernt ziele ganz', ohne.ziele === undefined);
ok('leere Rekorde entfernen records ganz', ohne.records === undefined);

// Was daneben in denselben Bloecken steht, gehoert nicht der Oberflaeche.
const mitFremd = { ...basis,
  ziele: { warum: 'alt', sonstiges: 'bleibt' },
  records: { programm: { squat: { bestesEinzel: 1 } }, quelle: 'Logbuch', weitere: [{ name: 'Fran' }] } };
const gemischt = PS.setzeInConfig(mitFremd, { grund: 'neu', rekorde: { squat: { bestesEinzel: 2 } } });
eq('anderes unter ziele bleibt', gemischt.ziele.sonstiges, 'bleibt');
eq('quelle bleibt', gemischt.records.quelle, 'Logbuch');
eq('weitere Bestleistungen bleiben', gemischt.records.weitere.length, 1);
eq('programm wurde ersetzt', gemischt.records.programm.squat.bestesEinzel, 2);

const geleert = PS.setzeInConfig(mitFremd, { grund: '', rekorde: {} });
eq('records bleibt, weil quelle und weitere drin sind', geleert.records.quelle, 'Logbuch');
ok('nur programm ist weg', geleert.records.programm === undefined);
eq('ziele bleibt, weil sonstiges drin ist', geleert.ziele.sonstiges, 'bleibt');
ok('nur warum ist weg', geleert.ziele.warum === undefined);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
