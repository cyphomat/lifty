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
eq('auch Datum plus Typ genuegt',
   I.fehlendeEvents(geplant, [{ start_date_local:'2026-09-14T00:00:00', type:'Ride' }]).length, 1);
eq('beide vorhanden: nichts zu tun',
   I.fehlendeEvents(geplant, [
     { start_date_local:'2026-09-14T00:00:00', type:'Ride' },
     { start_date_local:'2026-09-15T00:00:00', type:'WeightTraining' }]).length, 0);
eq('anderer Typ am selben Tag stoert nicht',
   I.fehlendeEvents(geplant, [{ start_date_local:'2026-09-14T00:00:00', type:'Swim' }]).length, 2);
// Der Grund fuer den Wechsel vom Namen auf den Typ: rotierte die Radeinheit
// zwischen zwei Pushes durch, legte der Abgleich einen zweiten Eintrag an.
eq('umbenannte Radeinheit bleibt derselbe Eintrag',
   I.fehlendeEvents(geplant, [
     { start_date_local:'2026-09-14T00:00:00', type:'Ride', name:'Grundlage Z2' },
     { start_date_local:'2026-09-15T00:00:00', type:'WeightTraining', name:'Kraft — Workout A' }]).length, 0);

print('\n--- Nachtragen von Einheiten prueft dasselbe ---');
const akt = I.alsAktivitaet(kraft, config);
eq('unbekannt: wird nachgetragen', I.fehlendeAktivitaeten([akt], []).length, 1);
eq('per Kennung erkannt', I.fehlendeAktivitaeten([akt], [{ external_id: akt.external_id }]).length, 0);
eq('per Datum und Name erkannt',
   I.fehlendeAktivitaeten([akt], [{ start_date_local:'2026-09-02T19:00:00', name:'Kraft — Workout A' }]).length, 0);

print('\n--- Die Uhr hat es schon erfasst? ---');
// start_date_local ist Ortszeit ohne Zone (wie intervals.icu sie liefert) —
// deshalb hier ueber die lokalen Datumsteile derselben Instanz gebaut,
// statt eine Uhrzeit fest zu verdrahten. Sonst haengt der Test von der
// Zeitzone der ausfuehrenden Maschine ab.
const alsLocal = d => {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};
const sessionStart = new Date(kraft.started);
const mitten = alsLocal(new Date(sessionStart.getTime() + 20 * 60000));
const kurzVorher = alsLocal(new Date(sessionStart.getTime() - 20 * 60000));
const weitWeg = alsLocal(new Date(sessionStart.getTime() - 5 * 3600000));

eq('keine Aktivitaeten: nichts erfasst', I.schonErfasst(kraft, []), false);
eq('fremde Aktivitaet mitten in der Session: erfasst',
   I.schonErfasst(kraft, [{ start_date_local: mitten, external_id: null }]), true);
eq('fremde Aktivitaet kurz vor dem Start: erfasst',
   I.schonErfasst(kraft, [{ start_date_local: kurzVorher, external_id: null }]), true);
eq('fremde Aktivitaet weit ausserhalb: nicht erfasst',
   I.schonErfasst(kraft, [{ start_date_local: weitWeg, external_id: null }]), false);
eq('eigener Push zaehlt nicht als fremd',
   I.schonErfasst(kraft, [{ start_date_local: mitten, external_id: 'setlist-2026-09-02-strength-A' }]), false);
eq('ohne Start-/Endzeit nicht pruefbar',
   I.schonErfasst({ date: '2026-09-05', type: 'wod', dauerSekunden: 720 }, [{ start_date_local: mitten }]), false);

print('\n--- Doppelte Fahrten aus zwei Sync-Wegen ---');
// Der echte Fall vom 01.09.2026: Zwift ueber Strava und daneben ein nackter
// Health-Eintrag derselben Fahrt. 16 km, nicht 32.
const zwift = { id:'i1', zeit:'2026-09-01T19:12:00', date:'2026-09-01',
  name:'Zwift - Group Ride: Bikealicious', minutes:45, km:16, load:63 };
const health = { id:'i2', zeit:'2026-09-01T19:11:00', date:'2026-09-01',
  name:'Rad indoor', minutes:46, km:16, load:null };

const eine = I.entdoppeln([zwift, health]);
eq('aus zwei mach eine', eine.length, 1);
eq('die reichere Fassung bleibt', eine[0].name, 'Zwift - Group Ride: Bikealicious');
eq('Last bleibt erhalten', eine[0].load, 63);
eq('Kilometer werden nicht summiert', eine[0].km, 16);
eq('die verworfene Kennung ist vermerkt', eine[0].doppel.join(), 'i2');
ok('Reihenfolge der Eingabe ist egal',
   I.entdoppeln([health, zwift])[0].load === 63);

print('\n--- Zwei echte Fahrten am selben Tag bleiben zwei ---');
const frueh = { id:'a', zeit:'2026-09-01T07:00:00', date:'2026-09-01', minutes:45, km:16, load:40 };
const spaet = { id:'b', zeit:'2026-09-01T19:00:00', date:'2026-09-01', minutes:45, km:16, load:60 };
eq('kein Zusammenfassen ueber den Tag', I.entdoppeln([frueh, spaet]).length, 2);
eq('chronologisch sortiert', I.entdoppeln([spaet, frueh])[0].id, 'a');
eq('direkt hintereinander bleibt getrennt',
   I.entdoppeln([frueh, { ...spaet, zeit:'2026-09-01T07:45:00' }]).length, 2);

print('\n--- Ohne Uhrzeit wird nicht geraten ---');
ok('keine Zeit, kein Treffer', !I.selbeFahrt({ minutes:45 }, { minutes:45 }));
eq('beide bleiben stehen',
   I.entdoppeln([{ id:'x', date:'2026-09-01', minutes:45 },
                 { id:'y', date:'2026-09-01', minutes:45 }]).length, 2);

print('\n--- Ueberlappung entscheidet, nicht die exakte Startzeit ---');
ok('eine Minute Versatz ist dieselbe Fahrt',
   I.selbeFahrt(zwift, health));
ok('halb so lange Fahrt im selben Fenster zaehlt als dieselbe',
   I.selbeFahrt(zwift, { zeit:'2026-09-01T19:20:00', minutes:22 }));
ok('nur ein Zipfel Ueberlappung reicht nicht',
   !I.selbeFahrt(zwift, { zeit:'2026-09-01T19:50:00', minutes:45 }));
eq('leere Liste bleibt leer', I.entdoppeln([]).length, 0);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
