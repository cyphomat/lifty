// Ausfuehren: jsc --module-file=tests/intervals.test.js
// Prueft die reine Umrechnung Log -> intervals.icu-Aktivitaet.
import * as I from '../js/intervals.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const config = {
  intervals: { loadProMinute: { strength: 0.8, wod: 1.4 } },
  lifts: { squat: { name: 'Kniebeuge' }, bench: { name: 'Bankdrücken' } }
};

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
eq('external_id ist stabil', a.external_id, 'setlist-2026-09-02-strength-A');
ok('Name nennt das Workout', a.name.includes('Workout A'), a.name);
ok('Beschreibung nutzt die Uebungsnamen', a.description.includes('Kniebeuge 50 kg — 5/5/5/5/5'), a.description.slice(0,60));
ok('kein internes Kuerzel in der Beschreibung', !a.description.includes('squat'), a.description.slice(0,60));
const ohneNamen = I.alsAktivitaet(kraft, { intervals: config.intervals });
ok('ohne Namen faellt es auf das Kuerzel zurueck', ohneNamen.description.includes('squat 50 kg'));
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
eq('eigene Kennung', b.external_id, 'setlist-2026-09-04-wod');

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

print('\n--- Geplanter Slot als Kalendereintrag ---');
const slot = { date:'2026-09-14', type:'ride', label:'Sweet Spot', detail:'3x12 Min', watt:'205–217 W' };
const ev = I.alsEvent(slot);
eq('Kategorie', ev.category, 'WORKOUT');
eq('Typ Ride', ev.type, 'Ride');
eq('Name', ev.name, 'Sweet Spot');
eq('Startdatum als Ortszeit', ev.start_date_local, '2026-09-14T00:00:00');
eq('stabile Kennung', ev.external_id, 'setlist-plan-2026-09-14-ride');
ok('Wattziel steht in der Beschreibung', ev.description.includes('205–217 W'));
ok('als aus Setlist gekennzeichnet', ev.description.includes('Setlist'));

const kraftSlot = { date:'2026-09-15', type:'strength', workout:'B', detail:'Kniebeuge · Schulterdrücken · Kreuzheben' };
const ev2 = I.alsEvent(kraftSlot);
eq('Typ WeightTraining', ev2.type, 'WeightTraining');
eq('Name nennt das Workout', ev2.name, 'Kraft — Workout B');
eq('ohne Slot nichts', I.alsEvent(null), null);

print('\n--- Es wird nur eingetragen, was fehlt ---');
const geplant = [ev, ev2];
eq('leerer Kalender: alles fehlt', I.fehlendeEvents(geplant, []).length, 2);
eq('gleiche Kennung wird uebersprungen',
   I.fehlendeEvents(geplant, [{ external_id:'setlist-plan-2026-09-14-ride' }]).length, 1);
eq('auch Datum plus Name genuegt',
   I.fehlendeEvents(geplant, [{ start_date_local:'2026-09-14T00:00:00', name:'Sweet Spot' }]).length, 1);
eq('beide vorhanden: nichts zu tun',
   I.fehlendeEvents(geplant, [
     { start_date_local:'2026-09-14T00:00:00', name:'Sweet Spot' },
     { start_date_local:'2026-09-15T00:00:00', name:'Kraft — Workout B' }]).length, 0);
eq('fremde Eintraege stoeren nicht',
   I.fehlendeEvents(geplant, [{ start_date_local:'2026-09-14T00:00:00', name:'Irgendwas anderes' }]).length, 2);

print('\n--- Nachtragen von Einheiten prueft dasselbe ---');
const akt = I.alsAktivitaet(kraft, config);
eq('unbekannt: wird nachgetragen', I.fehlendeAktivitaeten([akt], []).length, 1);
eq('per Kennung erkannt', I.fehlendeAktivitaeten([akt], [{ external_id: akt.external_id }]).length, 0);
eq('per Datum und Name erkannt',
   I.fehlendeAktivitaeten([akt], [{ start_date_local:'2026-09-02T19:00:00', name:'Kraft — Workout A' }]).length, 0);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
