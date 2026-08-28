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
    skalierung:['Leere Stange statt Zusatzgewicht','Goblet Thruster mit Kurzhantel','Kniebeuge und Drücken getrennt'] },
  { id:'powerclean',name:'Power Clean',         kat:'hantel', reps:[5,10],  last:s=>auf25(s.deadlift.weight*0.5), cue:'Hüfte öffnen, dann erst die Arme.',
    skalierung:['Hang Power Clean aus der Hüfte','Nur der Zug ohne Landung','Leere Stange, dafür sauber'] },
  { id:'pushpress', name:'Push Press',          kat:'hantel', reps:[6,12],  last:s=>auf25(s.ohp.weight*0.8), cue:'Kurzer Dip, explosiv drücken.',
    skalierung:['Leere Stange','Strict Press ohne Beineinsatz'] },
  { id:'dl',        name:'Kreuzheben',          kat:'hantel', reps:[8,15],  last:s=>auf25(s.deadlift.weight*0.5), cue:'Rücken flach, auch wenn die Uhr läuft.',
    skalierung:['Leichter und dafür sauber','Romanian Deadlift mit kürzerem Weg','Kettlebell Deadlift'] },
  { id:'frontsquat',name:'Front Squat',         kat:'hantel', reps:[6,12],  last:s=>auf25(s.squat.weight*0.5), cue:'Ellbogen hoch halten.',
    skalierung:['Goblet Squat mit Kurzhantel','Leere Stange','Luftkniebeuge'] },

  { id:'burpee',    name:'Burpees',             kat:'turnen', reps:[8,15],  last:null, cue:'Gleichmäßig. Wer sprintet, stirbt in Runde drei.',
    skalierung:['Ohne Sprung, nur aufstehen','Hände auf eine Bank statt auf den Boden','Halbe Wiederholungszahl'] },
  { id:'pullup',    name:'Klimmzüge',           kat:'turnen', reps:[5,12],  last:null, cue:'Rücken zuerst, nicht die Arme.',
    skalierung:['Ring Rows oder Rudern unter der Langhantel im Rack','Klimmzüge mit Band','Negative: hochspringen, langsam ablassen','Latzug am Gerät'] },
  { id:'pushup',    name:'Liegestütze',         kat:'turnen', reps:[10,20], last:null, cue:'Körper bleibt eine Linie.',
    skalierung:['Hände erhöht auf einer Bank','Auf den Knien'] },
  { id:'situp',     name:'Sit-ups',             kat:'turnen', reps:[15,25], last:null, cue:'Kein Schwung aus den Armen.',
    skalierung:['Crunches mit kürzerem Weg','Hohlkörper-Halten auf Zeit'] },
  { id:'boxjump',   name:'Box Jumps',           kat:'turnen', reps:[10,20], last:null, cue:'Landung weich, Hüfte oben strecken.',
    skalierung:['Niedrigere Box','Hochsteigen statt springen — schont die Achillessehne'] },
  { id:'lunge',     name:'Ausfallschritte',     kat:'turnen', reps:[10,20], last:null, cue:'Knie kontrolliert absetzen.',
    skalierung:['Ohne Zusatzgewicht','Am Rack festhalten','Rückwärts statt vorwärts'] },
  { id:'kbswing',   name:'Kettlebell Swings',   kat:'turnen', reps:[15,25], last:null, cue:'Hüftschwung, keine Schulterarbeit.',
    skalierung:['Nur bis Brusthöhe statt über Kopf','Leichtere Kugel','Kurzhantel beidhändig'] },

  { id:'ropewave',  name:'Battle Ropes — Wellen',      kat:'seil', reps:[20,40], einheit:'Sek', last:null, cue:'Frequenz halten, Rumpf fest.',
    skalierung:['Kürzere Intervalle','Im Stand statt in der Hocke'] },
  { id:'ropeslam',  name:'Battle Ropes — Slams',       kat:'seil', reps:[15,25], einheit:'Sek', last:null, cue:'Ganzer Körper, nicht nur Arme.',
    skalierung:['Kürzere Intervalle','Weniger Amplitude'] },
  { id:'ropealt',   name:'Battle Ropes — Wechselwellen', kat:'seil', reps:[20,40], einheit:'Sek', last:null, cue:'Gegen die Rotation arbeiten.',
    skalierung:['Kürzere Intervalle','Beidseitig statt im Wechsel'] },

  { id:'row',       name:'Rudergerät',          kat:'mono', reps:[200,500], einheit:'m', last:null, cue:'Beine, Rumpf, Arme — in der Reihenfolge.',
    skalierung:['Kürzere Distanz','Radergometer stattdessen'] },
  { id:'bikeerg',   name:'Radergometer',        kat:'mono', reps:[500,1200],einheit:'m', last:null, cue:'Gleichmäßige Trittfrequenz.',
    skalierung:['Kürzere Distanz'] },
  { id:'runrow',    name:'Rudern hart',         kat:'mono', reps:[250,400], einheit:'m', last:null, cue:'Zug für Zug, nicht hetzen.',
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
