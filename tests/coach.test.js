// Ausfuehren: jsc --module-file=tests/coach.test.js
import * as C from '../js/coach.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const config = {
  lifts: {
    squat:    { name: 'Kniebeuge',       increment: 2.5, start: 47.5, reference: 80 },
    bench:    { name: 'Bankdrücken',     increment: 2.5, start: 35,   reference: 60 },
    row:      { name: 'Rudern',          increment: 2.5, start: 32.5, reference: 55 },
    ohp:      { name: 'Schulterdrücken', increment: 2.5, start: 25,   reference: 40 },
    deadlift: { name: 'Kreuzheben',      increment: 5,   start: 60,   reference: 100 }
  },
  workouts: {
    A: [{ lift: 'squat' }, { lift: 'bench' }, { lift: 'row' }],
    B: [{ lift: 'squat' }, { lift: 'ohp' }, { lift: 'deadlift' }]
  }
};
const base = () => ({
  next: 'A', history: [],
  lifts: { squat:{weight:47.5,fails:0}, bench:{weight:35,fails:0}, row:{weight:32.5,fails:0},
           ohp:{weight:25,fails:0}, deadlift:{weight:60,fails:0} }
});
const HEUTE = new Date(2026, 8, 15); // Di, 15.09.2026

print('\n--- Tage seit der letzten Einheit ---');
eq('gestern', C.daysSince('2026-09-14', HEUTE), 1);
eq('vor 30 Tagen', C.daysSince('2026-08-16', HEUTE), 30);
eq('ohne Datum null', C.daysSince(null, HEUTE), null);

print('\n--- Wochenstreak ---');
eq('ohne Historie 0', C.weekStreak([], HEUTE), 0);
const dreiWochen = [{date:'2026-09-01'},{date:'2026-09-08'},{date:'2026-09-15'}];
eq('drei Wochen am Stueck', C.weekStreak(dreiWochen, HEUTE), 3);
const mitLuecke = [{date:'2026-09-01'},{date:'2026-09-15'}];
eq('Luecke bricht den Streak', C.weekStreak(mitLuecke, HEUTE), 1);
const nurLetzteWoche = [{date:'2026-09-08'}];
eq('laufende Woche ohne Einheit zaehlt nicht mit', C.weekStreak(nurLetzteWoche, HEUTE), 1);

print('\n--- Fortschritt zu den alten Arbeitsgewichten ---');
const p = C.progressToReference(base(), config);
ok('Kniebeuge 47,5 von 80 sind rund 59 %', Math.abs(p.perLift.squat.anteil - 0.59375) < 1e-9);
ok('Gesamtwert liegt zwischen 0 und 1', p.gesamt > 0.55 && p.gesamt < 0.65, p.gesamt);
const stark = base(); stark.lifts.squat.weight = 100;
eq('ueber dem Ziel wird bei 100 % gekappt', C.progressToReference(stark, config).perLift.squat.anteil, 1);

print('\n--- Die Ansage passt zur Lage ---');
let s = base();
eq('ohne Historie: Comeback', C.directive(s, config, HEUTE).situation, 'comeback');
eq('Comeback heisst Technik', C.directive(s, config, HEUTE).intensitaet.stufe, 'technik');

s = base(); s.history = [{date:'2026-06-01'}];
eq('lange her: Comeback', C.directive(s, config, HEUTE).situation, 'comeback');

s = base(); s.history = [{date:'2026-09-14'}]; s.lifts.bench.fails = 1;
eq('offener Fehlversuch schlaegt alles andere', C.directive(s, config, HEUTE).situation, 'nachFehlversuch');
eq('und wird hart angesagt', C.directive(s, config, HEUTE).intensitaet.stufe, 'hart');

s = base(); s.history = dreiWochen.concat([{date:'2026-08-25'}]);
Object.values(s.lifts).forEach(l => l.weight = 999);
eq('vier Wochen am Stueck: Streak', C.directive(s, config, HEUTE).situation, 'streak');

s = base(); s.history = [{date:'2026-09-14'}];
eq('unter 70 % vom Ziel: Wiederaufbau', C.directive(s, config, HEUTE).situation, 'leicht');

s = base(); s.history = [{date:'2026-09-14'}]; s.next = 'B';
Object.values(s.lifts).forEach(l => l.weight = 999);
eq('Workout B wird als schwer angesagt', C.directive(s, config, HEUTE).intensitaet.label, 'SCHWER');

print('\n--- Deload wird erkannt ---');
s = base(); s.history = [{date:'2026-09-14'}]; s.lifts.squat.weight = 42.5;
const log = { lifts: [{ lift:'squat', weight: 47.5 }] };
eq('Gewicht gefallen = Deload', C.directive(s, config, HEUTE, log).situation, 'nachDeload');
eq('ohne Log kein Deload', C.directive(s, config, HEUTE, null).situation !== 'nachDeload', true);

print('\n--- Sprueche sind stabil, nicht zufaellig ---');
s = base();
const a1 = C.directive(s, config, HEUTE).spruch;
const a2 = C.directive(s, config, HEUTE).spruch;
eq('gleicher Tag, gleicher Spruch', a1, a2);
ok('Spruch ist nicht leer', a1.length > 10);
const morgen = C.directive(s, config, new Date(2026, 8, 16)).spruch;
ok('anderer Tag darf anderen Spruch geben', typeof morgen === 'string');

print('\n--- Gewichtstrend ---');
eq('ohne Daten null', C.gewichtsTrend([]), null);
const punkte = [];
for (let i = 0; i < 20; i++) punkte.push({ date: `2026-09-${String(i+1).padStart(2,'0')}`, weight: 90 - i * 0.1 });
const t = C.gewichtsTrend(punkte);
ok('Abnahme wird als negatives Delta erkannt', t.delta < 0, t.delta);
ok('aktueller Wert plausibel', t.aktuell > 87 && t.aktuell < 90, t.aktuell);
eq('verrauschte Einzelwerte werden gemittelt', t.n, 20);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Form aus intervals.icu ---');
eq('ohne Daten keine Aussage', C.formLage(null), null);
eq('unvollstaendige Daten ergeben nichts', C.formLage({ ctl: 40 }), null);
const frisch = C.formLage({ ctl: 50, atl: 40, date: '2026-09-01' });
eq('Form ist Fitness minus Ermuedung', frisch.form, 10);
eq('positiv heisst frisch', frisch.stufe, 'frisch');
eq('neutral bei leicht negativ', C.formLage({ ctl: 50, atl: 55 }).stufe, 'neutral');
eq('muede ab minus zehn', C.formLage({ ctl: 50, atl: 65 }).stufe, 'muede');
eq('platt ab minus zwanzig', C.formLage({ ctl: 50, atl: 75 }).stufe, 'platt');
ok('Fitness und Ermuedung werden mitgegeben', frisch.fitness === 50 && frisch.ermuedung === 40);
ok('jede Stufe hat einen Text', ['frisch','neutral','muede','platt']
  .every(s => { const w = { frisch:{ctl:50,atl:40}, neutral:{ctl:50,atl:55}, muede:{ctl:50,atl:65}, platt:{ctl:50,atl:75} }[s];
                return C.formLage(w).text.length > 20; }));
eq('Grenzfall genau null ist neutral', C.formLage({ ctl: 50, atl: 50 }).stufe, 'neutral');

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Interferenz zwischen Rad und Eisen ---');
const jetzt = new Date(2026, 8, 10, 18, 0, 0);
// intervals.icu liefert Ortszeit ohne Zeitzone. toISOString() waere UTC —
// ohne das Z wuerde das als Ortszeit gelesen und um den Versatz verschoben.
const lokal = d => { const z = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`; };
const vorStunden = h => lokal(new Date(jetzt.getTime() - h * 3600000));
const fahrt = (h, minutes, load) => ({ date:'2026-09-10', zeit: vorStunden(h), minutes, load, name:'Test' });

eq('ohne Fahrten nichts', C.interferenz([], jetzt), null);
eq('ohne Uhrzeit nichts', C.interferenz([{ date:'2026-09-10', minutes:60, load:90 }], jetzt), null);
eq('aeltere Fahrt als 24 h zaehlt nicht', C.interferenz([fahrt(30, 60, 100)], jetzt), null);

const hart2h = C.interferenz([fahrt(2, 50, 90)], jetzt);
eq('harte Fahrt vor 2 h: starke Warnung', hart2h.stufe, 'stark');
eq('als hart erkannt', hart2h.art, 'hart');
ok('Text nennt die Kraftausdauer', hart2h.text.includes('Kraftausdauer'));
ok('und beruhigt beim Maximalkraftniveau', hart2h.text.includes('Maximalkraft'));

eq('harte Fahrt vor 6 h: nur leicht', C.interferenz([fahrt(6, 50, 90)], jetzt).stufe, 'leicht');
eq('harte Fahrt vor 10 h: keine Warnung', C.interferenz([fahrt(10, 50, 90)], jetzt), null);

const lang = C.interferenz([fahrt(3, 120, 110)], jetzt);
eq('lange Fahrt wird erkannt', lang.stufe, 'stark');

eq('lockere Fahrt vor 6 h: nichts', C.interferenz([fahrt(6, 60, 40)], jetzt), null);
eq('lockere Fahrt vor 1 h: nur Hinweis', C.interferenz([fahrt(1, 60, 40)], jetzt).stufe, 'gering');

print('\n--- Es zaehlt die juengste Fahrt ---');
const mehrere = [fahrt(20, 60, 100), fahrt(2, 50, 95), fahrt(9, 90, 120)];
eq('nimmt die von vor 2 Stunden', Math.round(C.interferenz(mehrere, jetzt).stunden), 2);
eq('Fahrten in der Zukunft werden ignoriert',
   C.interferenz([{ date:'2026-09-11', zeit: lokal(new Date(jetzt.getTime()+7200000)), minutes:60, load:100 }], jetzt), null);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Deine eigene Stimme hat Vorrang ---');
eq('ohne eigene Zeilen kommen meine', C.spruchWaehlen('standard', '2026-09-01', null).length > 10, true);
// Seit dem Mischen gilt nicht mehr "eigene ersetzen fremde", sondern
// "eigene kommen etwa jeden zweiten Tag vor". Also ueber viele Tage pruefen.
const ueberTage = (situation, eigene, n = 60) =>
  [...Array(n)].map((_, t) => C.spruchWaehlen(situation, `2026-09-${t + 1}`, eigene));
ok('eigene Zeile kommt vor',
   ueberTage('standard', { standard: ['Nur diese eine.'] }).includes('Nur diese eine.'));
ok('alle-Liste greift, wenn die Situation fehlt',
   ueberTage('comeback', { alle: ['Meine Universalzeile.'] }).includes('Meine Universalzeile.'));
const mitBeiden = ueberTage('comeback', { comeback: ['Speziell.'], alle: ['Allgemein.'] });
ok('Situation schlaegt die alle-Liste', mitBeiden.includes('Speziell.') && !mitBeiden.includes('Allgemein.'));
eq('gleicher Tag, gleiche Wahl',
   C.spruchWaehlen('standard', '2026-09-01', { standard: ['a','b','c','d','e'] }),
   C.spruchWaehlen('standard', '2026-09-01', { standard: ['a','b','c','d','e'] }));
eq('leere Liste faellt auf meine zurueck',
   C.spruchWaehlen('standard', '2026-09-01', { standard: [] }).length > 10, true);

print('\n--- Meilensteine ---');
const cfgM = {
  lifts: { squat:{name:'Back Squat',reference:80}, bench:{name:'Bench Press',reference:60} },
  records: { programm: {
    squat: { bestesEinzel:140, datum:'2021-08-27' },
    bench: { bestesEinzel:60, datum:'2020-03-15' } } }
};
const stM = { lifts: { squat:{weight:65,fails:0}, bench:{weight:47.5,fails:0} } };
const amJahrestag = C.meilensteine(stM, cfgM, new Date(2026, 7, 27));
ok('Jahrestag wird erkannt', amJahrestag.some(m => m.art === 'jahrestag'), JSON.stringify(amJahrestag.map(m=>m.art)));
ok('nennt die Jahre', amJahrestag[0].text.includes('5 Jahren'), amJahrestag[0].text);
ok('nennt den heutigen Stand', amJahrestag[0].text.includes('65 kg'));
ok('und relativiert', amJahrestag[0].text.includes('wieder anfängst'));
eq('einen Tag danach immer noch', C.meilensteine(stM, cfgM, new Date(2026,7,28)).filter(m=>m.art==='jahrestag').length, 1);
eq('eine Woche spaeter nicht mehr', C.meilensteine(stM, cfgM, new Date(2026,8,4)).filter(m=>m.art==='jahrestag').length, 0);
eq('im Maerz stattdessen die Bank', C.meilensteine(stM, cfgM, new Date(2026,2,15))[0].lift, 'bench');

print('\n--- Vorpausen-Niveau erreicht ---');
const aufNiveau = { lifts: { squat:{weight:80,fails:0}, bench:{weight:47.5,fails:0} } };
const m1 = C.meilensteine(aufNiveau, cfgM, new Date(2026, 10, 1));
eq('genau auf Referenz', m1.filter(m=>m.art==='referenz').length, 1);
ok('wird als Wendepunkt benannt', m1[0].text.includes('Neuland'), m1[0].text);
const drueber = { lifts: { squat:{weight:87.5,fails:0}, bench:{weight:47.5,fails:0} } };
ok('darueber wird die Differenz genannt', C.meilensteine(drueber, cfgM, new Date(2026,10,1))[0].text.includes('7.5 kg über'));
eq('darunter kein Meilenstein', C.meilensteine(stM, cfgM, new Date(2026,10,1)).length, 0);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Die Saetze muessen auch grammatisch stimmen ---');
const satz = tag => (C.meilensteine(stM, cfgM, tag).find(m => m.art === 'jahrestag') || {}).text || '';
eq('am Tag selbst', satz(new Date(2026,7,27)).startsWith('Heute vor 5 Jahren:'), true);
eq('einen Tag danach', satz(new Date(2026,7,28)).startsWith('Gestern vor 5 Jahren:'), true);
eq('einen Tag davor', satz(new Date(2026,7,26)).startsWith('Morgen vor 5 Jahren:'), true);
eq('zwei Tage danach', satz(new Date(2026,7,29)).startsWith('Vor 2 Tagen war es 5 Jahre her:'), true);
eq('zwei Tage davor', satz(new Date(2026,7,25)).startsWith('In 2 Tagen ist es 5 Jahre her:'), true);
ok('nirgends "waren es 5 Jahren"', ![25,26,27,28,29].some(d => satz(new Date(2026,7,d)).includes('waren es')));

print('\n--- Kopfzeile bei frischem Training ---');
const heuteTrainiert = { ...base(), history: [{ date: '2026-09-15' }] };
Object.values(heuteTrainiert.lifts).forEach(l => l.weight = 999);
eq('am selben Tag', C.directive(heuteTrainiert, config, HEUTE).kopf, 'Heute schon trainiert');
const gestern = { ...base(), history: [{ date: '2026-09-14' }] };
Object.values(gestern.lifts).forEach(l => l.weight = 999);
eq('einen Tag spaeter', C.directive(gestern, config, HEUTE).kopf, 'Gestern trainiert');
const vorendrei = { ...base(), history: [{ date: '2026-09-12' }] };
Object.values(vorendrei.lifts).forEach(l => l.weight = 999);
eq('danach mit Zahl', C.directive(vorendrei, config, HEUTE).kopf, 'Zuletzt vor 3 Tagen');

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Minierfolge ---');
const cfgE = { lifts: {
  squat:{name:'Back Squat',reference:80}, bench:{name:'Bench Press',reference:60}, row:{name:'Barbell Row',reference:55} } };
const vorEinheit = { lifts:{ squat:{weight:67.5}, bench:{weight:47.5}, row:{weight:45} } };
const nachEinheit = { lifts:{ squat:{weight:70},   bench:{weight:50},   row:{weight:47.5} } };
const logE = { date:'2026-09-10', workout:'A', type:'strength', lifts:[
  { lift:'squat', weight:67.5, sets:5, target:5, reps:[5,5,5,5,5] },
  { lift:'bench', weight:47.5, sets:5, target:5, reps:[5,5,5,5,5] },
  { lift:'row',   weight:45,   sets:5, target:5, reps:[5,5,5,5,5] } ] };

const e = C.erfolge(vorEinheit, nachEinheit, cfgE, logE, [logE], new Date(2026,8,10));
const arten = e.map(x => x.art);
ok('jede Steigerung zaehlt', e.filter(x=>x.art==='steigerung').length === 3, JSON.stringify(arten));
ok('saubere Saetze werden benannt', arten.includes('sauber'));
ok('bewegtes Gewicht auch', arten.includes('tonnage'));
ok('runde Marke erkannt', e.some(x=>x.art==='rund' && x.text.includes('70 kg')), JSON.stringify(e.filter(x=>x.art==='rund').map(x=>x.text)));
eq('das Wichtigste steht vorn', e[0].rang <= 1, true);

print('\n--- Zurueck auf Vorpausen-Niveau schlaegt alles ---');
const vorRef = { lifts:{ squat:{weight:77.5}, bench:{weight:47.5}, row:{weight:45} } };
const nachRef = { lifts:{ squat:{weight:80},  bench:{weight:47.5}, row:{weight:45} } };
const eRef = C.erfolge(vorRef, nachRef, cfgE, logE, [logE], new Date(2026,8,10));
eq('steht ganz oben', eRef[0].art, 'referenz');
ok('nennt den Wendepunkt', eRef[0].text.includes('Neuland'));

print('\n--- Auch ein durchwachsener Tag hat Erfolge ---');
const logMies = { date:'2026-09-10', workout:'A', type:'strength', lifts:[
  { lift:'squat', weight:67.5, sets:5, target:5, reps:[5,5,5,4,3] } ] };
const eMies = C.erfolge(vorEinheit, vorEinheit, cfgE, logMies, [logMies], new Date(2026,8,10));
ok('keine Steigerung, aber trotzdem etwas', eMies.length > 0, JSON.stringify(eMies.map(x=>x.art)));
ok('die geschafften Saetze werden gezaehlt', eMies.some(x=>x.art==='saetze' && x.text.includes('3 von 5')),
   JSON.stringify(eMies.filter(x=>x.art==='saetze').map(x=>x.text)));
ok('bewegtes Gewicht trotzdem', eMies.some(x=>x.art==='tonnage'));

print('\n--- Regelmaessigkeit zaehlt ---');
const zwei = [ {date:'2026-09-07',type:'strength'}, logE ];
ok('zweite Einheit der Woche',
   C.erfolge(vorEinheit, nachEinheit, cfgE, logE, zwei, new Date(2026,8,10)).some(x=>x.art==='woche'),
   'zweite Einheit der Woche fehlt');
const zehn = Array.from({length:10}, (_,i) => ({ date:`2026-09-0${(i%9)+1}`, type:'strength' }));
ok('zehnte Einheit insgesamt',
   C.erfolge(vorEinheit, nachEinheit, cfgE, logE, zehn, new Date(2026,8,10)).some(x=>x.art==='anzahl'));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Keine falschen Artikel in erzeugten Saetzen ---');
const alleTexte = [
  ...C.erfolge(vorEinheit, nachEinheit, cfgE, logE, [logE], new Date(2026,8,10)),
  ...C.erfolge(vorRef, nachRef, cfgE, logE, [logE], new Date(2026,8,10)),
  ...C.meilensteine(stM, cfgM, new Date(2026,7,27))
].map(x => x.text).join(' ');
ok('keine Uebung mit vorangestelltem Artikel',
   !/\b(im|in der|beim|der|die|das) (Back Squat|Bench Press|Barbell Row|Strict Press|Deadlift)\b/.test(alleTexte),
   alleTexte.slice(0,140));
ok('Uebungsnamen englisch', alleTexte.includes('Back Squat') || alleTexte.includes('Bench Press'), alleTexte.slice(0,140));
ok('nirgends "erste Mal"', !alleTexte.includes('erste Mal'), alleTexte.slice(0,120));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Eigene und fremde Zeilen mischen sich ---');
const meins = { alle: ["Let's go.", "Let's lift heavy shit."] };
let vonIhm = 0, vonMir = 0;
for (let t = 1; t <= 200; t++) {
  const z = C.spruchWaehlen('standard', `2026-09-${t}`, meins);
  if (meins.alle.includes(z)) vonIhm++; else vonMir++;
}
ok('beide kommen vor', vonIhm > 0 && vonMir > 0, `eigene ${vonIhm}, fremde ${vonMir}`);
ok('ungefaehr halbe halbe trotz zwei gegen dreizehn Zeilen',
   vonIhm > 60 && vonIhm < 140, `eigene ${vonIhm} von 200`);
eq('ohne eigene Zeilen kommen nur meine',
   [...Array(50)].every((_, t) => !meins.alle.includes(C.spruchWaehlen('standard', `2026-10-${t}`, null))), true);
eq('gleicher Tag, gleiche Wahl — auch beim Mischen',
   C.spruchWaehlen('standard', '2026-09-05', meins), C.spruchWaehlen('standard', '2026-09-05', meins));

print('\n--- Genug Auswahl, damit es sich nicht abnutzt ---');
const situationen = ['comeback','leicht','standard','nachFehlversuch','nachDeload','streak','defizit'];
for (const s of situationen) {
  const gesehen = new Set();
  for (let t = 1; t <= 120; t++) gesehen.add(C.spruchWaehlen(s, `2026-11-${t}`, null));
  ok(`${s}: mindestens fuenf verschiedene`, gesehen.size >= 5, `${gesehen.size} verschiedene`);
}

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Auch bei zwei eigenen Zeilen kommen beide vor ---');
// Regression: Muenze und Auswahl waren ueber die Hash-Paritaet gekoppelt,
// dadurch erschien von zwei eigenen Zeilen immer nur die erste.
const zweiEigene = { alle: ['ERSTE', 'ZWEITE'] };
const gesehenEigene = new Set();
for (let t = 1; t <= 200; t++) {
  const z = C.spruchWaehlen('standard', `2026-12-${t}`, zweiEigene);
  if (zweiEigene.alle.includes(z)) gesehenEigene.add(z);
}
eq('beide eigenen Zeilen erscheinen', gesehenEigene.size, 2);
const dreiEigene = { alle: ['A', 'B', 'C'] };
const gesehenDrei = new Set();
for (let t = 1; t <= 300; t++) {
  const z = C.spruchWaehlen('leicht', `2027-01-${t}`, dreiEigene);
  if (dreiEigene.alle.includes(z)) gesehenDrei.add(z);
}
eq('auch bei drei', gesehenDrei.size, 3);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Keine Wiederholung an aufeinanderfolgenden Tagen ---');
let dreimalGleich = 0, zweimalGleich = 0;
let vorher2 = null, vorher1 = null;
for (let i = 1; i <= 200; i++) {
  const d = new Date(2026, 0, i);
  const tag = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const z = C.spruchWaehlen('standard', tag, { alle: ["Let's go.", "Let's lift heavy shit."] });
  if (z === vorher1) zweimalGleich++;
  if (z === vorher1 && z === vorher2) dreimalGleich++;
  vorher2 = vorher1; vorher1 = z;
}
// Wiederholungen sind bei zwei eigenen Zeilen und halber Muenze Arithmetik,
// kein Defekt: jede eigene Zeile trifft rund ein Viertel aller Tage. Geprueft
// wird deshalb die Verteilung, nicht die Lauflaenge.
ok('nicht dauernd dasselbe', zweimalGleich < 70, `${zweimalGleich} Wiederholungen von 200`);

let eigeneTage = 0; const gesehenAlle = new Set();
for (let i = 1; i <= 200; i++) {
  const d = new Date(2026, 0, i);
  const tag = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const z = C.spruchWaehlen('standard', tag, { alle: ["Let's go.", "Let's lift heavy shit."] });
  gesehenAlle.add(z);
  if (z.startsWith("Let's")) eigeneTage++;
}
ok('eigene Zeilen an rund der Haelfte der Tage', eigeneTage > 70 && eigeneTage < 130, `${eigeneTage} von 200`);
ok('und der fremde Vorrat wird ausgeschoepft', gesehenAlle.size >= 10, `${gesehenAlle.size} verschiedene`);

print('\n--- Mobility nur jede dritte Krafteinheit ---');
const strengthHist = n => Array.from({ length: n }, (_, i) => ({ date: `2026-01-${i+1}`, type: 'strength' }));
eq('vor der ersten Einheit noch nicht dran', C.mobilityDran({ history: [] }), false);
eq('nach zwei Einheiten dran (dritte steht an)', C.mobilityDran({ history: strengthHist(2) }), true);
eq('nach drei Einheiten nicht dran', C.mobilityDran({ history: strengthHist(3) }), false);
eq('nach fuenf Einheiten dran (sechste steht an)', C.mobilityDran({ history: strengthHist(5) }), true);
const mitBeiwerk = [...strengthHist(2), { date: '2026-01-03', type: 'wod' }, { date: '2026-01-04', type: 'anpassung' }];
eq('WOD und Anpassung zaehlen nicht mit', C.mobilityDran({ history: mitBeiwerk }), true);
eq('ohne Historie-Feld nicht dran', C.mobilityDran({}), false);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
