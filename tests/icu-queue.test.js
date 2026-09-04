// Ausfuehren: jsc --module-file=tests/icu-queue.test.js
//
// Die Warteschlange fuer intervals.icu. Darin liegen abgeschlossene
// Einheiten, die absichtlich erst beim naechsten App-Start uebertragen
// werden — geht sie verloren, fehlt das Training in Fitness und Ermuedung.
// Zusaetzlich der Schalter, der entscheidet, ob ueberhaupt etwas an einen
// fremden Dienst geht.
const speicher = new Map();
globalThis.localStorage = {
  getItem: k => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: k => speicher.delete(k)
};

const ICU = await import('../js/intervals.js');

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

print('\n--- Zugangsdaten ---');
speicher.clear();
ok('ohne Key nicht verbunden', !ICU.isConfigured());
ICU.setCreds('i123', '  geheim  ');
ok('mit Key verbunden', ICU.isConfigured());
eq('Key wird beschnitten', speicher.get('setlist.icu.key'), 'geheim');
ICU.clearCreds();
ok('nach dem Entfernen nicht mehr verbunden', !ICU.isConfigured());
ok('Key ist wirklich weg', !speicher.has('setlist.icu.key'));
ok('Athleten-Kennung ebenfalls', !speicher.has('setlist.icu.athlete'));

print('\n--- Uebertragungsschalter ---');
speicher.clear();
ok('ohne Einstellung aktiv', ICU.pushAktiv());
ICU.setPushAktiv(false);
ok('ausschaltbar', !ICU.pushAktiv());
ok('das Aus ueberdauert einen Neustart', speicher.get('setlist.icu.push') === '0');
ICU.setPushAktiv(true);
ok('wieder einschaltbar', ICU.pushAktiv());

print('\n--- Warteschlange ---');
speicher.clear();
eq('leer zu Beginn', ICU.pendingPush().length, 0);
ICU.queuePush({ date: '2026-09-01', type: 'strength', workout: 'A' });
ICU.queuePush({ date: '2026-09-02', type: 'wod', label: 'AMRAP 12' });
eq('zwei Einheiten warten', ICU.pendingPush().length, 2);
eq('Reihenfolge bleibt', ICU.pendingPush()[0].date, '2026-09-01');
eq('Inhalt bleibt vollstaendig', ICU.pendingPush()[1].label, 'AMRAP 12');

// Der wichtige Fall: eine Uebertragung schlaegt fehl, die andere klappt.
// Dann darf nur die gelungene verschwinden.
const rest = ICU.pendingPush().filter(l => l.date !== '2026-09-01');
ICU.clearPushQueue(rest);
eq('nur die uebertragene ist weg', ICU.pendingPush().length, 1);
eq('die gescheiterte wartet weiter', ICU.pendingPush()[0].date, '2026-09-02');

ICU.clearPushQueue([]);
eq('leere Restliste raeumt vollstaendig ab', ICU.pendingPush().length, 0);

ICU.queuePush({ date: '2026-09-03' });
ICU.clearPushQueue();
eq('ohne Argument ebenfalls leer', ICU.pendingPush().length, 0);

speicher.set('setlist.icu.pendingPush', 'kaputt');
eq('kaputte Warteschlange ergibt eine leere Liste', ICU.pendingPush().length, 0);

print('\n--- Dublettenerkennung ---');
// Die Apple Watch traegt Krafttraining oft selbst ein. Wird das nicht
// erkannt, steht dieselbe Einheit doppelt in Fitness und Ermuedung.
//
// `started` traegt eine Zone (Z = UTC), `start_date_local` von intervals.icu
// nicht — das wird als Ortszeit gelesen. Beide fest zu verdrahten hiess:
// gruen nur auf einer Maschine, die in UTC laeuft, und in Darmstadt zwei
// Stunden daneben. Die Fremdaktivitaet wird deshalb aus derselben Instanz
// gebaut, gegen die geprueft wird.
const log = { date: '2026-09-01', type: 'strength',
              started: '2026-09-01T17:00:00.000Z', finished: '2026-09-01T18:00:00.000Z' };
const alsLocal = d => {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` +
         `T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};
const fuenfMinutenSpaeter = alsLocal(new Date(new Date(log.started).getTime() + 5 * 60000));
const fremd = [{ start_date_local: fuenfMinutenSpaeter, type: 'WeightTraining', moving_time: 3300 }];
ok('von der Uhr erfasste Einheit wird erkannt', ICU.schonErfasst(log, fremd));
ok('an einem anderen Tag nicht', !ICU.schonErfasst(log, [{ start_date_local: '2026-09-05T17:05:00', type: 'WeightTraining', moving_time: 3300 }]));
ok('leere Fremdliste ist keine Dublette', !ICU.schonErfasst(log, []));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
