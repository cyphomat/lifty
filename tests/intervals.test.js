// Ausfuehren: jsc --module-file=tests/intervals.test.js
// Prueft die reine Umrechnung Log -> intervals.icu-Aktivitaet.
import * as I from '../js/intervals.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const config = { intervals: { loadProMinute: { strength: 0.8, wod: 1.4 } } };

const kraft = {
  date: '2026-09-02', workout: 'A', type: 'strength',
  started: '2026-09-02T17:00:00.000Z', finished: '2026-09-02T17:45:00.000Z',
  lifts: [
    { lift:'squat', weight:50, sets:5, target:5, reps:[5,5,5,5,5], success:true },
    { lift:'bench', weight:37.5, sets:5, target:5, reps:[5,5,5,5,4], success:false }
  ]
};

print('\n--- Krafteinheit wird zur Aktivitaet ---');
const a = I.alsAktivitaet(kraft, config);
eq('Typ ist WeightTraining', a.type, 'WeightTraining');
eq('45 Minuten in Sekunden', a.moving_time, 2700);
eq('Last = 45 x 0,8', a.icu_training_load, 36);
eq('external_id ist stabil', a.external_id, 'lifty-2026-09-02-strength-A');
ok('Name nennt das Workout', a.name.includes('Workout A'), a.name);
ok('Beschreibung listet die Uebungen', a.description.includes('squat 50 kg 5/5/5/5/5'));
ok('Beschreibung kennzeichnet die Last als Schaetzung', a.description.includes('geschätzt'));
ok('Startzeit ohne Zeitzonenkuerzel', !/Z$/.test(a.start_date_local), a.start_date_local);
ok('Startzeit im erwarteten Format', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(a.start_date_local), a.start_date_local);

print('\n--- Zweimal umrechnen ergibt dieselbe Kennung ---');
eq('idempotent', I.alsAktivitaet(kraft, config).external_id, a.external_id);

print('\n--- WOD ---');
const wod = { date:'2026-09-04', type:'wod', label:'AMRAP 12 · Thruster / Burpees', dauerSekunden: 720 };
const b = I.alsAktivitaet(wod, config);
eq('Typ ist Crossfit', b.type, 'Crossfit');
eq('Last = 12 x 1,4', b.icu_training_load, 17);
ok('Name nennt das WOD', b.name.includes('AMRAP 12'), b.name);
eq('eigene Kennung', b.external_id, 'lifty-2026-09-04-wod');

print('\n--- Ohne Dauer keine erfundene Last ---');
eq('fehlende Zeiten ergeben nichts', I.alsAktivitaet({ date:'2026-09-05', type:'strength', lifts:[] }, config), null);
eq('unter einer Minute ergibt nichts', I.alsAktivitaet({ date:'2026-09-05', type:'wod', dauerSekunden: 30 }, config), null);
eq('Max-Out wird nicht uebertragen', I.alsAktivitaet({ date:'2026-09-05', type:'maxout', lift:'squat', weight:100, reps:1 }, config), null);
eq('null bleibt null', I.alsAktivitaet(null, config), null);

print('\n--- Lastfaktor ist einstellbar ---');
const doppelt = I.alsAktivitaet(kraft, { intervals: { loadProMinute: { strength: 1.6, wod: 1.4 } } });
eq('doppelter Faktor, doppelte Last', doppelt.icu_training_load, 72);
const ohneConfig = I.alsAktivitaet(kraft, {});
eq('ohne Konfiguration greift der Standard', ohneConfig.icu_training_load, 36);

print('\n--- Juengste Form aus den Wellness-Daten ---');
const recs = [
  { date:'2026-09-01', ctl:50, atl:60 },
  { date:'2026-09-03', ctl:52, atl:48 },
  { date:'2026-09-02', ctl:51, atl:55 },
  { date:'2026-09-04', ctl:null, atl:null }
];
eq('nimmt den juengsten vollstaendigen', I.letzteForm(recs).date, '2026-09-03');
eq('ohne Daten nichts', I.letzteForm([]), null);
eq('unvollstaendige werden uebersprungen', I.letzteForm([{date:'2026-09-09',ctl:null,atl:null}]), null);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
