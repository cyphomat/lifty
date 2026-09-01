// Ausfuehren: jsc --module-file=tests/store.test.js
//
// Die Speicherschicht hatte bisher keine Tests. Zwei Dinge darin sind
// heikel genug, um sie festzunageln:
//
//   1. Das Repo-Ziel. Zeigt es auf das falsche Repo, schreibt die App
//      Trainingsdaten irgendwo anders hin — im schlimmsten Fall in ein
//      oeffentliches.
//   2. Der Offline-Puffer. Darin liegen fertige Einheiten, die noch nicht
//      uebertragen sind. Geht der verloren, ist das Training weg.
//
// Beides braucht nur den localStorage, den es hier als Ersatz gibt.
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k)
};

const S = await import('../js/store.js');

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

print('\n--- Repo-Ziel ---');
speicher.clear();
// Der Rueckfall haelt bestehende Installationen am Laufen, die eingerichtet
// wurden, bevor das Ziel einstellbar war.
eq('ohne Einstellung greift der Rueckfall', S.getOwner(), 'cyphomat');
eq('ebenso beim Repo', S.getRepo(), 'setlist-data');

S.setRepo('freundin', 'meine-daten');
eq('gesetzter Besitzer', S.getOwner(), 'freundin');
eq('gesetztes Repo', S.getRepo(), 'meine-daten');

S.setRepo('  jemand  ', '  mit-leerzeichen  ');
eq('Leerraum wird abgeschnitten', S.getOwner(), 'jemand');
eq('auch beim Repo', S.getRepo(), 'mit-leerzeichen');

S.setRepo('jemand', '');
eq('leerer Repo-Name faellt auf den Standard zurueck', S.getRepo(), 'setlist-data');

S.clearRepo();
eq('nach dem Entfernen wieder der Rueckfall', S.getOwner(), 'cyphomat');
eq('und beim Repo ebenso', S.getRepo(), 'setlist-data');

print('\n--- Token ---');
speicher.clear();
eq('ohne Token leerer String', S.getToken(), '');
S.setToken('  github_pat_beispiel  ');
eq('Token wird beschnitten gespeichert', S.getToken(), 'github_pat_beispiel');
S.clearToken();
eq('nach dem Entfernen wieder leer', S.getToken(), '');
ok('Token liegt unter einem eigenen Schluessel', !speicher.has('setlist.token'));

print('\n--- Offline-Puffer ---');
speicher.clear();
eq('leerer Puffer ist eine leere Liste', S.pending().length, 0);
S.queue({ date: '2026-09-01', workout: 'A' });
S.queue({ date: '2026-09-04', workout: 'B' });
eq('zwei Einheiten warten', S.pending().length, 2);
eq('Reihenfolge bleibt erhalten', S.pending()[0].date, '2026-09-01');
eq('Inhalt bleibt vollstaendig', S.pending()[1].workout, 'B');
S.clearQueue();
eq('geleert', S.pending().length, 0);

// Ein kaputter Eintrag darf nicht dazu fuehren, dass die App beim Start
// stehenbleibt — dann kaeme man an die anderen Einheiten nie wieder heran.
speicher.set('setlist.queue', '{kein json');
eq('kaputter Puffer ergibt eine leere Liste statt eines Absturzes', S.pending().length, 0);

print('\n--- Lesecache ---');
speicher.clear();
eq('leerer Cache ist ein leeres Objekt', Object.keys(S.cached()).length, 0);
S.cache({ config: { bar: 20 } });
S.cache({ state: { next: 'A' } });
eq('zweiter Aufruf ergaenzt statt zu ersetzen', S.cached().config.bar, 20);
eq('und das Neue ist auch da', S.cached().state.next, 'A');
S.cache({ config: { bar: 15 } });
eq('gleicher Schluessel wird ueberschrieben', S.cached().config.bar, 15);
eq('anderer Schluessel bleibt', S.cached().state.next, 'A');
speicher.set('setlist.cache', 'kaputt');
eq('kaputter Cache ergibt ein leeres Objekt', Object.keys(S.cached()).length, 0);

print('\n--- Zwischengespeicherte Einheiten ---');
speicher.clear();
eq('ohne Daten null', S.cachedLogs(), null);
S.cacheLogs([{ date: '2026-09-01' }]);
eq('eine Einheit gemerkt', S.cachedLogs().logs.length, 1);
ok('mit Zeitstempel', typeof S.cachedLogs().zeit === 'number');
speicher.set('setlist.logs', 'kaputt');
eq('kaputter Eintrag ergibt null', S.cachedLogs(), null);

print('\n--- Ordnername ---');
// Der Ordner heisst bewusst nicht 'log': Inhaltsblocker und Firmen-WLANs
// verwerfen Adressen mit diesem Wegstueck.
eq('Einheiten liegen unter einem unverfaenglichen Pfad', S.LOG_DIR, 'einheiten');

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
