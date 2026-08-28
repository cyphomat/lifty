// Zufalls-WOD. Rein und deterministisch: gleicher Seed -> gleiches Workout.
// Die Lasten werden aus den aktuellen Arbeitsgewichten abgeleitet, nicht
// geraten — ein WOD mit Wettkampfgewichten waere im Wiederaufbau Unsinn.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedAus(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const waehle = (arr, r) => arr[Math.floor(r() * arr.length)];
const zwischen = (min, max, r, schritt = 1) =>
  min + Math.floor(r() * ((max - min) / schritt + 1)) * schritt;
const auf25 = w => Math.max(20, Math.round(w / 2.5) * 2.5);

/* Bewegungen. `last` leitet aus dem Zustand ab, `kat` verhindert, dass zwei
   Langhantelteile im selben Workout landen, und `skalierung` nennt echte
   Alternativen — ein Hinweis wie "bei Bedarf skalieren" hilft nicht, wenn
   man an der Stange gar nicht erst hochkommt.                            */
export const MOVES = [
  { id:'thruster',  name:'Thruster',            kat:'hantel', reps:[6,12],  last:s=>auf25(s.squat.weight*0.45), cue:'Aus der Hocke durchziehen, keine Pause oben.',
    erklaerung:'Squat und Overhead Press in einer Bewegung — deshalb geht der Puls schneller hoch als bei allem anderen mit der Stange. Der Trick ist, aus der Hocke durchzuziehen statt zweimal anzusetzen; wer oben stoppt, macht die doppelte Arbeit.',
    skalierung:['Leere Stange statt Zusatzgewicht','Goblet Thruster mit Kurzhantel','Squat und Press getrennt'] },
  { id:'powerclean',name:'Power Clean',         kat:'hantel', reps:[5,10],  last:s=>auf25(s.deadlift.weight*0.5), cue:'Hüfte öffnen, dann erst die Arme.',
    erklaerung:'Explosive Hüftstreckung unter Last, dieselbe Bewegung wie im Clean, nur ohne tiefe Landung. In einem WOD trainiert sie Schnellkraft bei Ermüdung — und genau die geht nach einer Pause zuerst verloren.',
    skalierung:['Hang Power Clean aus der Hüfte','Nur der Zug ohne Landung','Leere Stange, dafür sauber'] },
  { id:'pushpress', name:'Push Press',          kat:'hantel', reps:[6,12],  last:s=>auf25(s.ohp.weight*0.8), cue:'Kurzer Dip, explosiv drücken.',
    erklaerung:'Überkopfdrücken mit kurzem Beineinsatz. Du bewegst deutlich mehr Gewicht als beim strikten Drücken, ohne die Schulter zu überfordern — deshalb eignet es sich für Wiederholungen, wo Strict Press längst ausgereizt wäre.',
    skalierung:['Leere Stange','Strict Press ohne Beineinsatz'] },
  { id:'dl',        name:'Deadlift',            kat:'hantel', reps:[8,15],  last:s=>auf25(s.deadlift.weight*0.5), cue:'Rücken flach, auch wenn die Uhr läuft.',
    erklaerung:'Der stärkste Ganzkörperzug, den es gibt. Im WOD bewusst leicht: unter Zeitdruck kippt die Technik zuerst am unteren Rücken, und ein müder Rundrücken bei schwerer Last ist die häufigste Verletzung in solchen Formaten.',
    skalierung:['Leichter und dafür sauber','Romanian Deadlift mit kürzerem Weg','Kettlebell Deadlift'] },
  { id:'frontsquat',name:'Front Squat',         kat:'hantel', reps:[6,12],  last:s=>auf25(s.squat.weight*0.5), cue:'Ellbogen hoch halten.',
    erklaerung:'Squat mit der Stange vorn — der Oberkörper muss aufrecht bleiben, sonst rutscht die Stange. Das macht ihn zur ehrlichsten Rumpfübung im Programm und zur direkten Vorbereitung auf den Clean.',
    skalierung:['Goblet Squat mit Kurzhantel','Leere Stange','Air Squat'] },

  { id:'burpee',    name:'Burpees',             kat:'turnen', reps:[8,15],  last:null, cue:'Gleichmäßig. Wer sprintet, stirbt in Runde drei.',
    erklaerung:'Der billigste Weg, den Puls zu maximieren: kein Gerät, ganzer Körper, jede Wiederholung von ganz unten nach ganz oben. Genau deshalb ist die Versuchung groß, zu schnell zu starten — gleichmäßig ist hier immer schneller.',
    skalierung:['Ohne Sprung, nur aufstehen','Hände auf eine Bank statt auf den Boden','Halbe Wiederholungszahl'] },
  { id:'pullup',    name:'Pull-ups',            kat:'turnen', reps:[5,12],  last:null, cue:'Rücken zuerst, nicht die Arme.',
    erklaerung:'Vertikaler Zug mit dem eigenen Körpergewicht, der Gegenspieler zu allem Drücken. Ohne vertikales Ziehen kippt der Schultergürtel über Monate nach vorn.',
    skalierung:['Ring Rows oder Barbell Rows unter der Stange im Rack','Pull-ups mit Band','Negatives: hochspringen, langsam ablassen','Lat Pulldown'] },
  { id:'latzug',    name:'Lat Pulldown',        kat:'turnen', reps:[10,16], last:null, cue:'Ellbogen nach unten ziehen, nicht die Hände.',
    erklaerung:'Vertikaler Zug am Gerät — dieselbe Muskulatur wie beim Klimmzug, aber die Last ist frei wählbar. In einem WOD der verlässlichere Weg, weil du bei Ermüdung einfach reduzierst statt an der Stange hängen zu bleiben.',
    skalierung:['Leichter und dafür sauber','Enger Griff','Seated Cable Row'] },
  { id:'pushup',    name:'Push-ups',            kat:'turnen', reps:[10,20], last:null, cue:'Körper bleibt eine Linie.',
    erklaerung:'Horizontales Drücken mit Körpergewicht, quasi Bench Press ohne Bank. Der Rumpf arbeitet mit — sobald die Hüfte durchhängt, wird aus der Übung eine Rückenbelastung.',
    skalierung:['Hände erhöht auf einer Bank','Auf den Knien'] },
  { id:'situp',     name:'Sit-ups',             kat:'turnen', reps:[15,25], last:null, cue:'Kein Schwung aus den Armen.',
    erklaerung:'Rumpfbeugung über den vollen Weg. Im WOD dient sie meist als Erholung zwischen zwei harten Teilen, ohne dass der Puls ganz absinkt.',
    skalierung:['Crunches mit kürzerem Weg','Hohlkörper-Halten auf Zeit'] },
  { id:'boxjump',   name:'Box Jumps',           kat:'turnen', reps:[10,20], last:null, cue:'Landung weich, Hüfte oben strecken.',
    erklaerung:'Sprungkraft und Landefähigkeit. Der Nutzen liegt im Absprung, das Risiko in der Landung — deshalb weich landen und im Zweifel hochsteigen statt springen, gerade bei müden Beinen.',
    skalierung:['Niedrigere Box','Hochsteigen statt springen — schont die Achillessehne'] },
  { id:'lunge',     name:'Walking Lunges',      kat:'turnen', reps:[10,20], last:null, cue:'Knie kontrolliert absetzen.',
    erklaerung:'Einbeiniger Squat im Gehen. Deckt genau das ab, was der beidbeinige Squat auslässt: seitliche Stabilität und Unterschiede zwischen links und rechts.',
    skalierung:['Ohne Zusatzgewicht','Am Rack festhalten','Rückwärts statt vorwärts'] },
  { id:'kbswing',   name:'Kettlebell Swings',   kat:'turnen', reps:[15,25], last:null, cue:'Hüftschwung, keine Schulterarbeit.',
    erklaerung:'Explosive Hüftstreckung ohne Landung — die einfachste Art, Schnellkraft zu trainieren, wenn die Technik für Reißen oder Umsetzen nicht sitzt. Die Arme sind nur Seil, die Arbeit macht die Hüfte.',
    skalierung:['Nur bis Brusthöhe statt über Kopf','Leichtere Kugel','Kurzhantel beidhändig'] },

  { id:'ropewave',  name:'Battle Ropes — Waves',       kat:'seil', reps:[20,40], einheit:'Sek', last:null, cue:'Frequenz halten, Rumpf fest.',
    erklaerung:'Dauerbelastung für Schultern, Arme und Rumpf bei null Belastung für Knie und Wirbelsäule. Deshalb der ideale Abschluss nach schwerem Beintag, wenn Springen oder Laufen keine gute Idee mehr ist.',
    skalierung:['Kürzere Intervalle','Im Stand statt in der Hocke'] },
  { id:'ropeslam',  name:'Battle Ropes — Slams',       kat:'seil', reps:[15,25], einheit:'Sek', last:null, cue:'Ganzer Körper, nicht nur Arme.',
    erklaerung:'Ganzkörperbewegung von oben nach unten, explosiv. Kurz, hart, und einer der wenigen Wege, mit gelenkschonendem Gerät noch richtig Leistung abzurufen.',
    skalierung:['Kürzere Intervalle','Weniger Amplitude'] },
  { id:'ropealt',   name:'Battle Ropes — Alternating',  kat:'seil', reps:[20,40], einheit:'Sek', last:null, cue:'Gegen die Rotation arbeiten.',
    erklaerung:'Wie die Wellen, aber im Wechsel — dadurch muss der Rumpf gegen die Rotation arbeiten. Unterschätzt: das ist Anti-Rotations-Training, verkleidet als Kondition.',
    skalierung:['Kürzere Intervalle','Beidseitig statt im Wechsel'] },

  { id:'row',       name:'Row (Erg)',           kat:'mono', reps:[200,500], einheit:'m', last:null, cue:'Beine, Rumpf, Arme — in der Reihenfolge.',
    erklaerung:'Zug mit Beinen, Rumpf und Armen in dieser Reihenfolge. Das gleichmäßigste Konditionsgerät überhaupt, weil die Belastung über den ganzen Zug verteilt ist statt in Spitzen zu kommen.',
    skalierung:['Kürzere Distanz','Bike Erg stattdessen'] },
  { id:'bikeerg',   name:'Bike Erg',            kat:'mono', reps:[500,1200],einheit:'m', last:null, cue:'Gleichmäßige Trittfrequenz.',
    erklaerung:'Kondition ohne jede Stoßbelastung. Für dich naheliegend, weil du das ohnehin kannst — im WOD als Puffer zwischen zwei Kraftteilen.',
    skalierung:['Kürzere Distanz'] },
  { id:'runrow',    name:'Row Sprints',         kat:'mono', reps:[250,400], einheit:'m', last:null, cue:'Zug für Zug, nicht hetzen.',
    erklaerung:'Kurze, harte Ruderintervalle. Anders als die lockere Variante geht es hier um Leistung pro Zug, nicht um Durchhalten.',
    skalierung:['Kürzere Distanz','Ruhiger und dafür durchgehend'] }
];

export const FORMATE = [
  { id:'amrap',    name:'AMRAP',        teile:3, dauer:[10,20],
    text:d=>`So viele Runden wie möglich in ${d} Minuten.` },
  { id:'fortime',  name:'Auf Zeit',     teile:3, runden:[3,5],
    text:(_,r)=>`${r} Runden auf Zeit. Zeitlimit 20 Minuten.` },
  { id:'emom',     name:'EMOM',         teile:2, dauer:[10,16],
    text:d=>`Jede Minute ${d} Minuten lang — im Wechsel, Rest der Minute ist Pause.` },
  { id:'chipper',  name:'Chipper',      teile:4, runden:[1,1],
    text:()=>'Einmal von oben nach unten durch. Auf Zeit.' },
  { id:'tabata',   name:'Tabata',       teile:2, dauer:[8,8],
    text:()=>'8 Runden je 20 Sekunden Arbeit, 10 Sekunden Pause — pro Übung.' }
];

/**
 * Erzeugt ein WOD. Gleicher Seed liefert dasselbe Ergebnis, damit ein
 * Neuzeichnen der Ansicht nicht das Workout unter dir wegtauscht.
 */
export function generateWod(state, seed, config = {}) {
  const r = rng(seed);
  const format = waehle(FORMATE, r);

  // Was du nicht kannst oder nicht hast, kommt gar nicht erst vor.
  const aus = new Set((config.wod && config.wod.aus) || []);
  const erlaubt = MOVES.filter(m => !aus.has(m.id));

  // Hoechstens ein Langhantelteil, und Seile bekommen eine echte Chance.
  const pool = erlaubt.length >= 2 ? [...erlaubt] : [...MOVES];
  const gewaehlt = [];
  let hantelDrin = false;
  while (gewaehlt.length < format.teile && pool.length) {
    const i = Math.floor(r() * pool.length);
    const m = pool.splice(i, 1)[0];
    if (m.kat === 'hantel' && hantelDrin) continue;
    if (gewaehlt.some(g => g.kat === m.kat && m.kat !== 'turnen')) continue;
    if (m.kat === 'hantel') hantelDrin = true;
    gewaehlt.push(m);
  }

  const dauer = format.dauer ? zwischen(format.dauer[0], format.dauer[1], r, 2) : null;
  const runden = format.runden ? zwischen(format.runden[0], format.runden[1], r) : null;
  const skala = format.id === 'chipper' ? 1.6 : format.id === 'tabata' ? 0.5 : 1;

  const teile = gewaehlt.map(m => {
    const einheit = m.einheit || 'Wdh';
    const roh = zwischen(m.reps[0], m.reps[1], r, einheit === 'm' ? 50 : einheit === 'Sek' ? 5 : 1);
    const menge = format.id === 'tabata' ? null : Math.max(1, Math.round(roh * skala / (einheit === 'm' ? 50 : 1)) * (einheit === 'm' ? 50 : 1));
    return {
      id: m.id,
      name: m.name,
      menge, einheit,
      last: m.last ? m.last(state.lifts) : null,
      cue: m.cue,
      erklaerung: m.erklaerung || '',
      skalierung: m.skalierung || []
    };
  });

  return {
    format: format.name,
    formatId: format.id,
    dauer, runden,
    beschreibung: format.text(dauer, runden),
    teile,
    zeitlimit: dauer || 20,
    seed
  };
}

/** Eine Zeile Klartext — fuer Log und Historie. */
export function wodLabel(wod) {
  const kopf = wod.dauer ? `${wod.format} ${wod.dauer}` : wod.runden > 1 ? `${wod.runden} Runden` : wod.format;
  return `${kopf} · ${wod.teile.map(t => t.name).join(' / ')}`;
}
