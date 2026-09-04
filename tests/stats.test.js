// Ausfuehren: jsc --module-file=tests/stats.test.js
import * as S from '../js/stats.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const logs = [
  { date:'2026-09-01', workout:'A', type:'strength', lifts:[
    { lift:'squat', weight:50, reps:[5,5,5,5,5], success:true },
    { lift:'bench', weight:35, reps:[5,5,5,5,5], success:true }]},
  { date:'2026-09-03', type:'wod', label:'AMRAP 12' },
  { date:'2026-09-05', workout:'A', type:'strength', lifts:[
    { lift:'squat', weight:52.5, reps:[5,5,5,4,3], success:false },
    { lift:'bench', weight:37.5, reps:[5,5,5,5,5], success:true }]}
];

print('\n--- Tonnage ---');
eq('erste Einheit: 50x25 + 35x25', S.tonnage(logs[0]), 50*25 + 35*25);
eq('ein WOD hat keine Tonnage', S.tonnage(logs[1]), 0);
eq('nicht geschaffte Wiederholungen zaehlen trotzdem', S.tonnage(logs[2]), 52.5*22 + 37.5*25);

print('\n--- Zusammenfassung ---');
const s = S.summary(logs);
eq('drei Einheiten insgesamt', s.einheiten, 3);
eq('davon zwei Kraft', s.kraft, 2);
eq('und ein WOD', s.wods, 1);
eq('Tonnage summiert', s.tonnage, Math.round(50*25+35*25 + 52.5*22+37.5*25));
eq('Bestwert Bank ist der letzte saubere', s.best.bench.weight, 37.5);
eq('Bestwert Kniebeuge ignoriert den Fehlversuch', s.best.squat.weight, 50);
eq('Zeitraum korrekt', s.von + '..' + s.bis, '2026-09-01..2026-09-05');
ok('Einheiten pro Woche berechnet', s.proWoche > 0, s.proWoche);
const leer = S.summary([]);
eq('leere Historie bricht nicht', leer.einheiten, 0);
eq('und hat keine Tonnage', leer.tonnage, 0);

print('\n--- Verlauf einer Uebung ---');
const v = S.serie(logs, 'squat');
eq('zwei Punkte', v.length, 2);
eq('aufsteigend nach Datum', v[0].date, '2026-09-01');
eq('WOD taucht nicht auf', S.serie(logs, 'burpee').length, 0);

print('\n--- Sparkline ---');
eq('ohne Punkte kein Diagramm', S.sparkline([]), null);
const sp = S.sparkline(v, 300, 60);
eq('Minimum erkannt', sp.min, 50);
eq('Maximum erkannt', sp.max, 52.5);
eq('zwei Koordinaten', sp.koord.length, 2);
ok('hoechster Wert liegt oben', sp.koord[1].y < sp.koord[0].y, `${sp.koord[1].y} vs ${sp.koord[0].y}`);
ok('Pfad beginnt mit M', sp.linie.startsWith('M'));
ok('Flaeche ist geschlossen', sp.flaeche.endsWith('Z'));
const einer = S.sparkline([{date:'2026-09-01',weight:60}], 300, 60);
ok('ein einzelner Punkt landet mittig', Math.abs(einer.koord[0].x - 150) < 1, einer.koord[0].x);

print(`\n========== ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- PR-Verwaltung ---');
const prLogs = [
  { date:'2026-09-01', workout:'A', type:'strength', lifts:[
    { lift:'squat', weight:50, sets:5, target:5, reps:[5,5,5,5,5], success:true }]},
  { date:'2026-09-05', workout:'A', type:'strength', lifts:[
    { lift:'squat', weight:60, sets:5, target:5, reps:[5,5,5,4,3], success:false }]},
  { date:'2026-09-10', type:'maxout', lift:'squat', weight:95, reps:1 }
];
const P1 = S.prs(prLogs);
eq('schwerster sauberer Arbeitssatz', P1.squat.arbeit.weight, 50);
eq('gescheiterter Satz ist kein Arbeits-PR', P1.squat.arbeit.date, '2026-09-01');
eq('gemessener Einzelversuch', P1.squat.gemessen.weight, 95);
eq('belastbares Maximum kommt nur vom Max-Out', P1.squat.maximum.weight, 95);
eq('und ist als gemessen gekennzeichnet', P1.squat.maximum.formel, 'gemessen');
eq('ohne Max-Out gibt es kein belastbares Maximum', S.prs(prLogs.slice(0,2)).squat.maximum, null);
ok('Arbeitssaetze liefern nur eine Untergrenze', S.prs(prLogs.slice(0,2)).squat.untergrenze.wert > 60);
eq('ohne Logs keine PRs', Object.keys(S.prs([])).length, 0);

print('\n--- Auch ein Fehlversuch kann ein Maximum liefern ---');
const nurFail = S.prs([prLogs[1]]);
eq('kein Arbeits-PR', nurFail.squat.arbeit, null);
eq('und kein belastbares Maximum', nurFail.squat.maximum, null);
ok('aber eine Untergrenze aus 60x5', nurFail.squat.untergrenze.wert > 60, nurFail.squat.untergrenze.wert);

print('\n--- Verlauf des geschaetzten Maximums ---');
const kurve = S.serieE1rm(prLogs, 'squat');
eq('drei Punkte', kurve.length, 3);
eq('aufsteigend nach Datum', kurve[0].date, '2026-09-01');
eq('der Max-Out ist als belastbar markiert', kurve[2].belastbar, true);
eq('Arbeitssaetze nicht', kurve[0].belastbar, false);
ok('Max-Out-Wert entspricht dem Gewicht bei einer Wiederholung', kurve[2].weight === 95);
eq('unbekannte Uebung ergibt nichts', S.serieE1rm(prLogs, 'ohp').length, 0);

print('\n--- Neue Bestwerte einer Einheit ---');
const neu = S.neuePRs(prLogs.slice(0,2), prLogs[2]);
ok('Max-Out setzt Bestwerte', neu.length >= 2, JSON.stringify(neu.map(t=>t.feld)));
ok('darunter der gemessene', neu.some(t=>t.feld==='gemessen'));
eq('die allererste Einheit setzt naturgemaess Bestwerte', S.neuePRs(prLogs, prLogs[0]).length, 2);
const schwaecher = { date:'2026-09-14', workout:'A', type:'strength', lifts:[
  { lift:'squat', weight:45, sets:5, target:5, reps:[5,5,5,5,5], success:true }]};
eq('eine schwaechere Einheit danach ist kein PR', S.neuePRs(prLogs, schwaecher).length, 0);
const staerker = { date:'2026-09-14', workout:'A', type:'strength', lifts:[
  { lift:'squat', weight:65, sets:5, target:5, reps:[5,5,5,5,5], success:true }]};
const t2 = S.neuePRs(prLogs, staerker);
ok('eine schwerere saubere Einheit schon', t2.some(t=>t.feld==='arbeit'), JSON.stringify(t2.map(x=>x.feld)));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Radfahrten zusammenfassen ---');
const fahrten = [
  { date:'2026-08-26', name:'Zwift', minutes:50, km:15.3, load:73 },
  { date:'2026-08-19', name:'Watopia', minutes:60, km:28,  load:88 },
  { date:'2026-08-12', name:'Feierabend', minutes:90, km:52, load:120 }
];
const rs = S.radStats(fahrten);
eq('drei Fahrten', rs.anzahl, 3);
eq('Minuten summiert', rs.minuten, 200);
eq('Stunden gerundet', rs.stunden, 3.3);
eq('Kilometer gerundet', rs.km, 95);
eq('Last summiert', rs.last, 281);
eq('Zeitraum', rs.von + '..' + rs.bis, '2026-08-12..2026-08-26');
ok('Fahrten pro Woche plausibel', rs.proWoche > 0.5 && rs.proWoche < 2, rs.proWoche);
eq('ohne Fahrten keine Panik', S.radStats([]).anzahl, 0);
eq('und keine Last', S.radStats([]).last, 0);

print('\n--- Wochenweise Last ---');
const w = S.radWochen(fahrten, 4, new Date(2026, 7, 28));   // Fr, 28.08.2026
eq('vier Wochen', w.length, 4);
eq('letzte Woche enthaelt die juengste Fahrt', w[3].last, 73);
eq('und genau eine Fahrt', w[3].fahrten, 1);
ok('jede Woche hat einen Schluessel', w.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.woche)));
eq('Summe ueber alle Eimer', w.reduce((s,x)=>s+x.last,0), 281);
const leereWochen = S.radWochen([], 6, new Date(2026, 7, 28));
eq('ohne Fahrten sechs leere Wochen', leereWochen.length, 6);
eq('alle bei null', leereWochen.reduce((s,x)=>s+x.last,0), 0);
const alt = S.radWochen([{ date:'2020-01-01', minutes:60, load:50 }], 4, new Date(2026, 7, 28));
eq('zu alte Fahrten fallen raus', alt.reduce((s,x)=>s+x.last,0), 0);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Trainingskalender ---');
const kLogs = [
  { date:'2026-08-24', type:'strength' },
  { date:'2026-08-26', type:'strength' },
  { date:'2026-08-27', type:'wod' },
  { date:'2026-06-01', type:'strength' }
];
const kFahrten = [{ date:'2026-08-25' }, { date:'2026-08-26' }];
const kal = S.kalender(kLogs, kFahrten, 4, new Date(2026, 7, 28));
eq('vier Wochen ergeben 28 Tage', kal.tage.length, 28);
eq('beginnt an einem Montag', new Date(kal.von + 'T12:00:00').getDay(), 1);
const tag = d => kal.tage.find(t => t.date === d);
eq('Krafttag erkannt', tag('2026-08-24').kraft, true);
eq('Radtag erkannt', tag('2026-08-25').rad, true);
eq('beides am selben Tag', tag('2026-08-26').kraft && tag('2026-08-26').rad, true);
eq('WOD getrennt gefuehrt', tag('2026-08-27').wod, true);
eq('und nicht als Kraft gezaehlt', tag('2026-08-27').kraft, false);
eq('heute ist markiert', tag('2026-08-28').heute, true);
eq('morgen liegt in der Zukunft', tag('2026-08-29').zukunft, true);
eq('zu alte Eintraege tauchen nicht auf', kal.tage.filter(t=>t.date==='2026-06-01').length, 0);
eq('leere Daten ergeben trotzdem ein Raster', S.kalender([], [], 4, new Date(2026,7,28)).tage.length, 28);

print('\n--- Wochenlast aus beiden Welten ---');
const wLogs = [
  { date:'2026-08-26', type:'strength', started:'2026-08-26T17:00:00Z', finished:'2026-08-26T17:50:00Z' },
  { date:'2026-08-27', type:'wod', dauerSekunden: 600 },
  { date:'2026-08-25', type:'maxout', lift:'squat', weight:100, reps:1 }
];
const wFahrten = [{ date:'2026-08-26', load:78 }, { date:'2026-08-24', load:120 }];
const wl = S.wochenLast(wLogs, wFahrten, 4, new Date(2026, 7, 28));
eq('vier Wochen', wl.length, 4);
const dieseWoche = wl[3];
eq('Kraft: 50 Min x 0,8 plus WOD 10 Min x 1,4', dieseWoche.kraft, 40 + 14);
eq('Rad summiert', dieseWoche.rad, 198);
eq('Gesamt ist die Summe', dieseWoche.gesamt, 54 + 198);
eq('Max-Out zaehlt nicht mit', S.wochenLast([wLogs[2]], [], 4, new Date(2026,7,28))[3].kraft, 0);
eq('ohne Dauer keine Kraftlast',
   S.wochenLast([{date:'2026-08-26',type:'strength'}], [], 4, new Date(2026,7,28))[3].kraft, 0);
eq('leere Daten ergeben leere Wochen', S.wochenLast([], [], 6, new Date(2026,7,28)).filter(w=>w.gesamt>0).length, 0);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);

print('\n--- Tonnage je Woche ---');
const tLogs = [
  { date:'2026-08-24', type:'strength', lifts:[{lift:'squat',weight:100,reps:[5,5,5,5,5]}] },
  { date:'2026-08-26', type:'strength', lifts:[{lift:'squat',weight:50,reps:[5,5,5,5,5]}] },
  { date:'2026-08-17', type:'strength', lifts:[{lift:'squat',weight:80,reps:[5,5,5,5,5]}] },
  { date:'2026-08-25', type:'wod', label:'AMRAP' }
];
const wt = S.wochenTonnage(tLogs, 4, new Date(2026, 7, 28));
eq('vier Wochen', wt.length, 4);
eq('diese Woche: 100x25 + 50x25', wt[3].tonnage, 2500 + 1250);
eq('zwei Einheiten', wt[3].einheiten, 2);
eq('WOD zaehlt nicht in die Tonnage', S.wochenTonnage([tLogs[3]], 4, new Date(2026,7,28))[3].tonnage, 0);
eq('Vorwoche getrennt', wt[2].tonnage, 80 * 25);
eq('leer bleibt leer', S.wochenTonnage([], 3, new Date(2026,7,28)).every(w=>w.tonnage===0), true);

print('\n--- Fitness und Ermuedung ---');
const wellnessRoh = [
  { date:'2026-08-20', ctl:44, atl:50 },
  { date:'2026-08-10', ctl:40, atl:38 },
  { date:'2026-08-15', ctl:null, atl:20 },
  { date:'2026-08-25', ctl:48, atl:44 }
];
const fv = S.formVerlauf(wellnessRoh);
eq('unvollstaendige Punkte fallen raus', fv.length, 3);
eq('aufsteigend sortiert', fv[0].date, '2026-08-10');
eq('Form ist Fitness minus Ermuedung', fv[0].form, 2);
eq('auch negativ', fv[1].form, -6);
eq('ohne Daten leer', S.formVerlauf([]).length, 0);

print('\n--- Zum Angeben ---');
eq('Wiederholungen aus zwei Kraft-Einheiten, WOD zaehlt nicht', S.wiederholungenGesamt(logs), 25+25 + 22+25);
eq('ohne Logs keine Wiederholungen', S.wiederholungenGesamt([]), 0);

const angebenLogs = [
  { date:'2026-08-03', type:'strength', lifts:[{ lift:'squat', weight:50, reps:[5,5,5,5,5] }] }, // Montag
  { date:'2026-08-10', type:'strength', lifts:[{ lift:'squat', weight:50, reps:[5,5,5,5,5] }] }, // Montag
  { date:'2026-08-17', type:'strength', lifts:[{ lift:'squat', weight:50, reps:[5,5,5,5,5] }] }, // Montag
  { date:'2026-08-04', type:'wod', label:'AMRAP' },                                              // Dienstag
  { date:'2026-08-31', type:'strength', lifts:[{ lift:'squat', weight:50, reps:[5,5,5,5,5] }] }, // Montag, nach Luecke
  { date:'2026-09-07', type:'strength', lifts:[{ lift:'squat', weight:50, reps:[5,5,5,5,5] }] }  // Montag
];
const angebenFahrten = [
  { date:'2026-08-03' }, // gleicher Tag wie eine Einheit — zaehlt nicht doppelt
  { date:'2026-08-11' }  // Dienstag, eigener Tag
];

const tagTest = S.lieblingstag(angebenLogs, angebenFahrten);
eq('Montag ist der haeufigste Tag', tagTest.tag, 'Montag');
eq('fünfmal Montag', tagTest.anzahl, 5);
eq('ohne jede Aktivitaet kein Lieblingstag', S.lieblingstag([], []), null);

eq('drei Wochen am Stueck sind die laengste Serie', S.laengsteSerie(angebenLogs, angebenFahrten), 3);
eq('eine einzelne Einheit ist eine Serie von einer Woche', S.laengsteSerie([angebenLogs[0]], []), 1);
eq('ohne Daten keine Serie', S.laengsteSerie([], []), 0);

print('\n--- Ansage gegen Gefuehl ---');
const kraftLog = (date, angesagt, gefuehlt) =>
  ({ date, type: 'strength', workout: 'A', angesagt, gefuehlt, lifts: [{ lift: 'squat', weight: 50, reps: [5,5,5,5,5] }] });
const abgleichLogs = [
  kraftLog('2026-09-01', 'SOLIDE', 'normal'),   // Treffer
  kraftLog('2026-09-08', 'TECHNIK', 'leicht'),  // Treffer
  kraftLog('2026-09-15', 'SOLIDE', 'hart'),     // schwerer als angesagt
  kraftLog('2026-09-22', 'SCHWER', 'normal'),   // leichter als angesagt
  kraftLog('2026-09-29', 'HART', 'extrem'),     // schwerer als angesagt
  { date: '2026-10-06', type: 'strength', workout: 'B', lifts: [{ lift: 'squat', weight: 50, reps: [5,5,5,5,5] }] }, // kein angesagt/gefuehlt -> raus
  { date: '2026-10-07', type: 'wod', label: 'AMRAP', angesagt: 'SOLIDE', gefuehlt: 'hart' } // kein Kraft-Log -> raus
];
const abgleich = S.ansageAbgleich(abgleichLogs);
eq('nur Kraft-Logs mit beiden Feldern zaehlen', abgleich.gesamt, 5);
eq('zwei Treffer', abgleich.treffer, 2);
eq('zwei schwerer als angesagt', abgleich.schwerer, 2);
eq('ein leichter als angesagt', abgleich.leichter, 1);
eq('neueste Einheit zuerst', abgleich.eintraege[0].date, '2026-09-29');
eq('SCHWER und HART teilen sich die Stufe',
   S.ansageAbgleich([kraftLog('2026-09-01', 'SCHWER', 'hart')]).eintraege[0].urteil, 'treffer');
eq('leere Liste bleibt leer', S.ansageAbgleich([]).gesamt, 0);
eq('unbekannte Ansage wird uebersprungen',
   S.ansageAbgleich([kraftLog('2026-09-01', 'IRGENDWAS', 'normal')]).gesamt, 0);


print('\n--- Watt pro Kilogramm ---');
// Deine echten Werte vom 01.09.2026 als Ausgangspunkt: 136 W bei 120,5 kg.
const wel = [
  { date:'2026-06-01', eftp:130, weight:124.0 },
  { date:'2026-07-01', eftp:132, weight:0 },      // Gewicht fehlt: faellt raus
  { date:'2026-08-01', eftp:null, weight:122.0 }, // eFTP fehlt: faellt raus
  { date:'2026-09-01', eftp:136, weight:120.5 }
];
const wkg = S.wattProKg(wel);
eq('nur Tage mit beiden Haelften', wkg.length, 2);
eq('aufsteigend sortiert', wkg[0].date, '2026-06-01');
eq('130 durch 124', wkg[0].wkg, 1.048);
eq('136 durch 120,5', wkg[1].wkg, 1.129);
eq('leere Wellness bleibt leer', S.wattProKg([]).length, 0);
eq('unsortierte Eingabe wird sortiert',
   S.wattProKg([wel[3], wel[0]])[0].date, '2026-06-01');

print('\n--- Woher die Veraenderung kam ---');
const tr = S.wattProKgTrend(wkg);
eq('Zuwachs in W/kg', tr.delta, 0.081);
eq('sechs Watt mehr', tr.wattDelta, 6);
eq('dreieinhalb Kilo weniger', tr.kgDelta, -3.5);
ok('beide Anteile sind positiv', tr.ausLeistung > 0 && tr.ausGewicht > 0,
   `${tr.ausLeistung} / ${tr.ausGewicht}`);
// Die Zerlegung ist exakt, nicht geschaetzt: sie muss ohne Rest aufgehen.
ok('Leistung plus Gewicht ergibt genau das Delta',
   Math.abs((tr.ausLeistung + tr.ausGewicht) - tr.delta) < 0.002,
   `${tr.ausLeistung} + ${tr.ausGewicht} != ${tr.delta}`);
eq('92 Tage dazwischen', tr.tage, 92);
eq('ein einzelner Punkt ergibt keinen Trend', S.wattProKgTrend([wkg[0]]), null);
eq('leer ergibt keinen Trend', S.wattProKgTrend([]), null);

// Nur abnehmen, gleiche Leistung: der ganze Zuwachs kommt vom Gewicht.
const nurGewicht = S.wattProKgTrend(S.wattProKg([
  { date:'2026-06-01', eftp:136, weight:124.0 },
  { date:'2026-09-01', eftp:136, weight:120.5 }]));
eq('kein Anteil aus der Leistung', nurGewicht.ausLeistung, 0);
ok('der ganze Zuwachs kommt vom Gewicht',
   Math.abs(nurGewicht.ausGewicht - nurGewicht.delta) < 0.002);

print('\n--- Plan gegen Ist ---');
const ZIELE = {
  'Grundlage Z2': { label:'Grundlage Z2', ftp:[0.56, 0.75], struktur:'dauerhaft' },
  'Sweet Spot':   { label:'Sweet Spot',   ftp:[0.88, 0.93], struktur:'intervalle' }
};
const planFuer = d => ({ '2026-09-01': ZIELE['Grundlage Z2'],
                         '2026-09-05': ZIELE['Sweet Spot'],
                         '2026-09-08': ZIELE['Grundlage Z2'] }[d] || null);

// Der echte Fall: geplant war Grundlage, gefahren wurde mit 0,91 —
// ein Zwift-Group-Ride faehrt, was die Gruppe faehrt.
const radFahrten = [
  { date:'2026-09-01', intensitaet:0.91, minutes:45, name:'Zwift - Group Ride' },
  { date:'2026-09-05', intensitaet:0.79, minutes:60, name:'Sweet Spot' },
  { date:'2026-09-08', intensitaet:0.68, minutes:90, name:'Grundlage' },
  { date:'2026-09-10', intensitaet:0.70, minutes:50, name:'Ohne Plan' },
  { date:'2026-09-11', intensitaet:null, minutes:40, name:'Ohne Leistungsmesser' }
];
const ab = S.intensitaetsAbgleich(radFahrten, planFuer);
// Regressionsschutz: kaeme die Intensitaet als Prozentzahl herein, waere
// jede Fahrt "zu hart" und die Quote immer 0 %. Genau so sah es live aus.
const alsProzent = S.intensitaetsAbgleich(
  [{ date:'2026-09-08', intensitaet:68, minutes:90 }], planFuer);
eq('ungerechnete Prozentwerte wuerden alles als zu hart werten',
   alsProzent[0].stufe, 'zuHart');
eq('Fahrten ohne Intensitaet fallen raus', ab.length, 4);
eq('geplant locker, gefahren hart', ab[0].stufe, 'zuHart');
eq('und das Ziel steht dabei', ab[0].ziel.join('-'), '0.56-0.75');
eq('Intervallfahrt unter dem Ziel ist nicht "zu locker"', ab[1].stufe, 'unklar');
eq('Grundlage im Zielbereich', ab[2].stufe, 'imZiel');
eq('ohne Plan kein Urteil', ab[3].stufe, 'ohnePlan');

// Dieselbe Unterschreitung bei einer dauerhaften Fahrt ist sehr wohl ein Urteil.
const locker = S.intensitaetsAbgleich(
  [{ date:'2026-09-08', intensitaet:0.40, minutes:90 }], planFuer);
eq('dauerhafte Fahrt deutlich unter dem Ziel', locker[0].stufe, 'zuLocker');

// Die Toleranz faengt Randfaelle ab, statt bei 0,76 gleich Alarm zu schlagen.
const knapp = S.intensitaetsAbgleich(
  [{ date:'2026-09-08', intensitaet:0.77, minutes:90 }], planFuer);
eq('knapp ueber dem Ziel bleibt im Ziel', knapp[0].stufe, 'imZiel');

print('\n--- Bilanz ---');
const bil = S.abgleichBilanz(ab);
eq('einmal im Ziel', bil.imZiel, 1);
eq('einmal zu hart', bil.zuHart, 1);
eq('einmal unklar', bil.unklar, 1);
eq('einmal ohne Plan', bil.ohnePlan, 1);
eq('beurteilbar waren zwei', bil.beurteilt, 2);
eq('Quote rechnet nur mit den beurteilbaren', bil.quote, 50);
eq('ohne Eintraege keine Quote', S.abgleichBilanz([]).quote, null);


print('\n--- Angezeigte Anteile ergeben die angezeigte Summe ---');
// Getrennt gerundet ergaben +0,12 und +0,09 die Summe +0,22.
const an = S.anteileAufSumme(0.216, 0.124);
eq('Summe auf zwei Stellen', an.summe, 0.22);
eq('erster Anteil normal gerundet', an.a, 0.12);
eq('der Rest geht an den zweiten', an.b, 0.1);
ok('und beides ergibt die Summe', Math.abs(an.a + an.b - an.summe) < 1e-9);
const neg = S.anteileAufSumme(-0.07, -0.044);
ok('auch bei fallenden Werten', Math.abs(neg.a + neg.b - neg.summe) < 1e-9);
eq('ohne Rest bleibt es, wie es ist', S.anteileAufSumme(0.3, 0.1).b, 0.2);


print('\n--- Aerobe Effizienz: nur Vergleichbares vergleichen ---');
// Harte Fahrten haben systematisch den hoeheren Effizienzfaktor: die
// Leistung steigt schneller als der Puls. Eine Kurve ueber alles misst
// deshalb vor allem, wie hart die letzte Fahrt war.
const efFahrten = [
  { date:'2026-06-02', effizienz:0.95, intensitaet:0.90, minutes:45, np:120, hf:126 },
  { date:'2026-06-09', effizienz:0.97, intensitaet:0.91, minutes:48, np:123, hf:127 },
  { date:'2026-06-16', effizienz:0.82, intensitaet:0.68, minutes:60, np:96,  hf:117 },
  { date:'2026-06-23', effizienz:1.01, intensitaet:0.93, minutes:50, np:127, hf:126 },
  { date:'2026-06-30', effizienz:0.99, intensitaet:0.88, minutes:20, np:124, hf:125 }, // zu kurz
  { date:'2026-07-07', effizienz:null, intensitaet:0.90, minutes:45 }                  // ohne Wert
];
const ef = S.aerobeEffizienz(efFahrten);
eq('das meistgefahrene Band gewinnt', ef.band.join('-'), '0.85-1');
eq('nur die Fahrten aus dem Band', ef.punkte.length, 3);
eq('die ruhige Fahrt bleibt draussen', ef.punkte.some(p => p.date === '2026-06-16'), false);
eq('zu kurze Fahrt bleibt draussen', ef.punkte.some(p => p.date === '2026-06-30'), false);
eq('chronologisch', ef.punkte[0].date, '2026-06-02');
eq('und es wird gesagt, wie viel verworfen wurde', ef.verworfen, 3);
eq('ohne brauchbare Fahrten kein Band', S.aerobeEffizienz([]).band, null);
eq('Fahrten ohne Leistungsmesser ergeben kein Band',
   S.aerobeEffizienz([{ date:'2026-06-02', minutes:60 }]).band, null);

// Wer nur ruhig faehrt, bekommt das ruhige Band — die Funktion schreibt
// keine Zone vor, sie folgt dem, was tatsaechlich gefahren wurde.
const ruhig = S.aerobeEffizienz([
  { date:'2026-06-02', effizienz:0.80, intensitaet:0.62, minutes:60 },
  { date:'2026-06-09', effizienz:0.83, intensitaet:0.66, minutes:60 },
  { date:'2026-06-16', effizienz:1.02, intensitaet:0.95, minutes:45 }
]);
eq('das ruhige Band gewinnt hier', ruhig.band.join('-'), '0.55-0.7');
eq('zwei Punkte darin', ruhig.punkte.length, 2);

print('\n--- Effizienztrend ---');
const eft = S.effizienzTrend(ef.punkte);
eq('drei Punkte', eft.n, 3);
eq('Zuwachs im Wert', eft.delta, 0.06);
eq('in Prozent', eft.prozent, 6.3);
eq('21 Tage', eft.tage, 21);
eq('zwei Punkte sind kein Verlauf', S.effizienzTrend(ef.punkte.slice(0, 2)), null);
eq('einer erst recht nicht', S.effizienzTrend(ef.punkte.slice(0, 1)), null);

print('\n--- Entkopplung bleibt still, bis sie etwas bedeutet ---');
// Genau Daniels Lage: kurze Zwift-Fahrten, der Wert steht da, aber es
// stehen kaum Minuten zusammenhaengender Grundlage dahinter.
const kurz = S.entkopplungsReihe([
  { date:'2026-08-25', entkopplung:4.2, pwhrMin:6,  minutes:45 },
  { date:'2026-09-01', entkopplung:5.1, pwhrMin:11, minutes:46 }
]);
eq('nichts Tragfaehiges', kurz.tragfaehig, false);
eq('keine Punkte ueber der Schwelle', kurz.punkte.length, 0);
eq('aber die Werte gibt es', kurz.mitWert, 2);
eq('zwei waren zu kurz', kurz.zuKurz, 2);
eq('und das laengste Stueck war elf Minuten', kurz.besteMinuten, 11);
eq('die Schwelle wird mitgeteilt', kurz.schwelle, 20);

const lang = S.entkopplungsReihe([
  { date:'2026-08-25', entkopplung:4.2, pwhrMin:44, minutes:90 },
  { date:'2026-09-01', entkopplung:3.4, pwhrMin:61, minutes:100 },
  { date:'2026-09-08', entkopplung:2.9, pwhrMin:52, minutes:95 },
  { date:'2026-09-10', entkopplung:9.9, pwhrMin:4,  minutes:40 }
]);
eq('drei tragfaehige Punkte', lang.punkte.length, 3);
eq('jetzt traegt es', lang.tragfaehig, true);
eq('die kurze Fahrt bleibt draussen', lang.zuKurz, 1);
eq('sinkende Entkopplung bleibt in der Reihenfolge', lang.punkte[2].wert, 2.9);
eq('leere Eingabe bleibt still', S.entkopplungsReihe([]).tragfaehig, false);

// Der Zwischenzustand: lang genug gefahren, aber erst einmal. Das ist
// etwas anderes als "zu kurz" und braucht eine eigene Auskunft.
const eineLange = S.entkopplungsReihe([
  { date:'2026-09-01', entkopplung:3.4, pwhrMin:62, minutes:100 },
  { date:'2026-09-03', entkopplung:6.0, pwhrMin:8,  minutes:45 }
]);
eq('noch nicht tragfaehig', eineLange.tragfaehig, false);
eq('aber ein Punkt ist da', eineLange.punkte.length, 1);
ok('und die Schwelle war nicht das Problem', eineLange.besteMinuten > eineLange.schwelle,
   `${eineLange.besteMinuten} vs ${eineLange.schwelle}`);


print('\n--- Gewicht: der Tageswert luegt, der Schnitt nicht ---');
// Zwei Kilo Unterschied zwischen zwei Morgen sind Wasser, nicht Fett.
const wel2 = [
  { date:'2026-08-01', weight:124.0 }, { date:'2026-08-02', weight:122.4 },
  { date:'2026-08-03', weight:124.6 }, { date:'2026-08-04', weight:123.2 },
  { date:'2026-08-05', weight:123.8 }, { date:'2026-08-06', weight:122.9 },
  { date:'2026-08-07', weight:123.5 }, { date:'2026-08-08', weight:122.7 },
  { date:'2026-08-09', weight:0 }
];
const reihe = S.gewichtsReihe(wel2);
eq('Tage ohne Wert fallen raus', reihe.length, 8);
eq('der erste Punkt ist er selbst', reihe[0].schnitt, 124);
ok('der Schnitt glaettet den Ausreisser', reihe[2].schnitt < 124.6 && reihe[2].schnitt > 123,
   String(reihe[2].schnitt));
eq('das Fenster waechst erst an', reihe[2].n, 3);
eq('und bleibt dann bei sieben', reihe[7].n, 7);
eq('der Rohwert bleibt erhalten', reihe[2].roh, 124.6);
eq('leere Eingabe bleibt leer', S.gewichtsReihe([]).length, 0);

print('\n--- Abnehmrate als Ausgleichsgerade ---');
// Sauberer Verlauf: 121 kg, jede Woche 0,7 kg runter, ueber 5 Wochen.
const sauber = S.gewichtsReihe(Array.from({ length: 35 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10),
  weight: Math.round((121 - i * 0.1) * 100) / 100
})));
const r = S.abnehmRate(sauber, 28);
ok('rund 0,7 kg pro Woche runter', Math.abs(r.proWoche + 0.7) < 0.05, String(r.proWoche));
ok('das sind gut ein halbes Prozent', r.prozentProWoche > 0.5 && r.prozentProWoche < 0.7,
   String(r.prozentProWoche));
eq('28 Tage zurueck sind 29 Tageswerte, heute eingeschlossen', r.punkte, 29);
eq('zu wenig Daten ergibt nichts', S.abnehmRate(sauber.slice(0, 3)), null);
eq('leer ergibt nichts', S.abnehmRate([]), null);
// Ein einzelner schwerer Abend darf die Richtung nicht drehen.
const mitAusreisser = [...sauber];
mitAusreisser[mitAusreisser.length - 1] = { ...mitAusreisser[34], schnitt: 123 };
ok('ein Ausreisser dreht den Trend nicht',
   S.abnehmRate(mitAusreisser, 28).proWoche < 0);

print('\n--- Wohin die Arbeitsgewichte laufen ---');
const kraftLogs = [
  { date:'2026-08-05', type:'strength', lifts:[{lift:'squat',weight:60,reps:[5]},{lift:'bench',weight:45,reps:[5]}] },
  { date:'2026-08-12', type:'strength', lifts:[{lift:'squat',weight:62.5,reps:[5]},{lift:'bench',weight:45,reps:[5]}] },
  { date:'2026-08-19', type:'strength', lifts:[{lift:'squat',weight:65,reps:[5]},{lift:'bench',weight:47.5,reps:[5]}] }
];
const kr = S.kraftRichtung(kraftLogs, 42, new Date('2026-08-20'));
eq('unterm Strich 7,5 kg mehr', kr.delta, 7.5);
eq('Richtung stimmt', kr.richtung, 'rauf');
eq('drei Einheiten', kr.einheiten, 3);
// Die Summe taugt fuers Urteil, die Anzahl fuer die Anzeige.
eq('beide Uebungen gestiegen', kr.gestiegen, 2);
eq('keine gefallen', kr.gefallen, 0);
eq('von zwei Uebungen', kr.uebungen, 2);
eq('eine Einheit reicht nicht', S.kraftRichtung(kraftLogs.slice(0,1), 42, new Date('2026-08-20')), null);
const runter = S.kraftRichtung([kraftLogs[2], { date:'2026-08-26', type:'strength',
  lifts:[{lift:'squat',weight:57.5,reps:[5]},{lift:'bench',weight:42.5,reps:[5]}] }], 42, new Date('2026-08-27'));
eq('fallende Gewichte werden erkannt', runter.richtung, 'runter');

print('\n--- Die eigentliche Frage: schnell genug und langsam genug ---');
const lage = S.abnehmLage(r, kr);
eq('abnehmen und gleichzeitig staerker: das Fenster ist offen', lage.stufe, 'fenster');
eq('das Tempo passt', lage.tempo, 'passend');
// Fallende Gewichte schlagen alles andere — dann kostet das Defizit Substanz.
eq('fallende Gewichte werden zuerst gemeldet',
   S.abnehmLage(r, { richtung:'runter' }).stufe, 'teuer');
eq('zu schnell wird benannt',
   S.abnehmLage({ proWoche:-1.8, prozentProWoche:1.5, aktuell:120 }, { richtung:'flach' }).stufe, 'schnell');
eq('kaum Bewegung auch',
   S.abnehmLage({ proWoche:-0.1, prozentProWoche:0.08, aktuell:120 }, { richtung:'flach' }).stufe, 'traege');
eq('nach oben ist eindeutig',
   S.abnehmLage({ proWoche:0.4, prozentProWoche:0.33, aktuell:120 }, { richtung:'rauf' }).stufe, 'rauf');
eq('ohne Rate keine Lage', S.abnehmLage(null, kr), null);
ok('ohne Kraftdaten bleibt die Rate lesbar',
   S.abnehmLage(r, null).stufe === 'haltend');

print('\n--- Minierfolge auf der Waage ---');
const erf = S.gewichtsErfolge(sauber);
eq('Startgewicht', erf.start, 121);
ok('runter seit Beginn', erf.runter > 3, String(erf.runter));
eq('der Tiefstwert ist jetzt', erf.amTief, true);
ok('volle Kilo werden gezaehlt', erf.erreicht.some(e => e.art === 'kilo'));
ok('ein Prozent auch', erf.erreicht.some(e => e.art === 'prozent'));
ok('der naechste Meilenstein liegt unter dem Tiefstwert', erf.naechstes < erf.tief,
   `${erf.naechstes} vs ${erf.tief}`);
// Steht die Waage auf einer runden Zahl, ist der naechste der darunter.
const rund = S.gewichtsErfolge([{ date:'2026-08-01', schnitt:120 }, { date:'2026-08-02', schnitt:119 }]);
eq('bei glatten 119 ist 118 dran', rund.naechstes, 118);
eq('ohne Zielgewicht keine Restdistanz', erf.bisZiel, null);
eq('mit Zielgewicht schon', S.gewichtsErfolge(sauber, 105).bisZiel > 0, true);
eq('ein Punkt reicht nicht', S.gewichtsErfolge([{ date:'x', schnitt:120 }]), null);

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
