// Ausfuehren: jsc --module-file=tests/i18n.test.js
//
// i18n.js liest die Sprachwahl aus dem localStorage und faerbt beim Laden
// das Dokument ein. Beides gibt es in der Testumgebung nicht, deshalb steht
// der Ersatz vor dem Laden des Moduls — und das Modul kommt per dynamischem
// Import, weil statische Importe sonst vorher laufen wuerden.
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k)
};
globalThis.document = { documentElement: {}, querySelectorAll: () => [] };

const I = await import('../js/i18n.js');

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

print('\n--- Sprachwahl ---');
speicher.clear();
eq('ohne Wahl gilt Deutsch', I.sprache(), 'de');
I.setSprache('en');
eq('Wahl wird uebernommen', I.sprache(), 'en');
I.setSprache('kl');
eq('unbekannte Sprache wird ignoriert', I.sprache(), 'en');
I.setSprache('de');
eq('zurueck auf Deutsch', I.sprache(), 'de');

print('\n--- Texte ---');
eq('deutscher Text', I.t('setup.verbinden'), 'Verbinden');
I.setSprache('en');
eq('englischer Text', I.t('setup.verbinden'), 'Connect');
I.setSprache('de');

ok('unbekannter Schluessel faellt auf sich selbst zurueck', I.t('gibt.es.nicht') === 'gibt.es.nicht');

print('\n--- Platzhalter ---');
eq('ein Platzhalter', I.t('icu.tage', { n: 5 }), '5 Tagen');
eq('mehrere Platzhalter', I.t('home.vonReferenz', { p: 80, kg: 100 }), '80% von 100 kg');
eq('fehlender Wert bleibt stehen', I.t('icu.tage'), '{n} Tagen');
ok('gleicher Platzhalter mehrfach wird komplett ersetzt',
  !I.t('kal.quote', { a: 1, n: 2, p: 3 }).includes('{'));

print('\n--- Locale ---');
I.setSprache('de');
eq('deutsches Zahlformat', I.locale(), 'de-DE');
I.setSprache('en');
eq('englisches Zahlformat', I.locale(), 'en-GB');
I.setSprache('de');

print('\n--- Beide Sprachen decken sich ---');
const de = Object.keys(I.TEXTE.de).sort();
const en = Object.keys(I.TEXTE.en).sort();
const fehltEn = de.filter(k => !I.TEXTE.en[k]);
const fehltDe = en.filter(k => !I.TEXTE.de[k]);
ok('kein Schluessel ohne englische Fassung', fehltEn.length === 0, fehltEn.join(', '));
ok('kein englischer Schluessel ohne deutsches Gegenstueck', fehltDe.length === 0, fehltDe.join(', '));
eq('gleich viele Schluessel', de.length, en.length);

// Ein vertippter Platzhalter faellt sonst erst im Betrieb auf — dann steht
// woertlich "{kg}" auf dem Bildschirm statt einer Zahl.
const platzhalter = s => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
const schief = de.filter(k => platzhalter(I.TEXTE.de[k]) !== platzhalter(I.TEXTE.en[k]));
ok('gleiche Platzhalter in beiden Sprachen', schief.length === 0, schief.join(', '));

ok('kein Text ist leer', de.every(k => I.TEXTE.de[k].trim() && I.TEXTE.en[k].trim()));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
