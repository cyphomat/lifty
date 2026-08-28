// Auswertung der Logs. Rein und testbar — die Historie soll etwas zeigen,
// das man nicht schon beim Training wusste.

const istKraft = l => (l.type || 'strength') === 'strength' && Array.isArray(l.lifts);

/** Bewegtes Gesamtgewicht einer Einheit: Last x tatsaechliche Wiederholungen. */
export function tonnage(log) {
  if (!istKraft(log)) return 0;
  return log.lifts.reduce((s, e) =>
    s + (e.weight || 0) * (e.reps || []).reduce((a, r) => a + r, 0), 0);
}

/** Zahlen fuer die Kopfzeile der Historie. */
export function summary(logs = []) {
  const kraft = logs.filter(istKraft);
  const wods = logs.filter(l => l.type && l.type !== 'strength');
  const gesamt = kraft.reduce((s, l) => s + tonnage(l), 0);

  const best = {};
  for (const l of kraft) {
    for (const e of l.lifts) {
      if (!e.success) continue;                       // nur saubere Saetze zaehlen
      if (!best[e.lift] || e.weight > best[e.lift].weight) {
        best[e.lift] = { weight: e.weight, date: l.date };
      }
    }
  }

  const daten = logs.map(l => l.date).sort();
  let proWoche = null;
  if (daten.length > 1) {
    const tage = (new Date(daten[daten.length - 1]) - new Date(daten[0])) / 86400000;
    proWoche = tage > 0 ? Math.round((logs.length / (tage / 7)) * 10) / 10 : null;
  }

  return {
    einheiten: logs.length,
    kraft: kraft.length,
    wods: wods.length,
    tonnage: Math.round(gesamt),
    best,
    proWoche,
    von: daten[0] || null,
    bis: daten[daten.length - 1] || null
  };
}

/** Verlauf einer Uebung: ein Punkt je Einheit, in der sie vorkam. */
export function serie(logs, liftId) {
  return logs.filter(istKraft)
    .map(l => {
      const e = l.lifts.find(x => x.lift === liftId);
      return e ? { date: l.date, weight: e.weight, success: e.success } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Punkte zu SVG-Koordinaten. Getrennt von der Darstellung, damit die
 * Umrechnung testbar bleibt und nicht im Template versteckt liegt.
 */
export function sparkline(punkte, breite = 300, hoehe = 60, rand = 4) {
  if (!punkte.length) return null;
  const werte = punkte.map(p => p.weight);
  const min = Math.min(...werte), max = Math.max(...werte);
  const spanne = max - min || 1;
  const n = punkte.length;
  const koord = punkte.map((p, i) => ({
    x: rand + (n === 1 ? (breite - 2 * rand) / 2 : (i / (n - 1)) * (breite - 2 * rand)),
    y: rand + (1 - (p.weight - min) / spanne) * (hoehe - 2 * rand),
    ...p
  }));
  return {
    min, max, koord,
    linie: koord.map((k, i) => `${i ? 'L' : 'M'}${k.x.toFixed(1)},${k.y.toFixed(1)}`).join(' '),
    flaeche: `M${koord[0].x.toFixed(1)},${hoehe} ` +
             koord.map(k => `L${k.x.toFixed(1)},${k.y.toFixed(1)}`).join(' ') +
             ` L${koord[n - 1].x.toFixed(1)},${hoehe} Z`
  };
}

/* ---------------------------------------------------------------
   PR-Verwaltung. Bewusst abgeleitet und nicht gepflegt — dieselbe
   Invariante wie beim Zustand. Eine PR-Liste, die man von Hand
   fortschreibt, ist nach dem ersten Tippfehler wertlos.           */

import { e1rm, e1rmFormel } from './program.js';

/**
 * Bestwerte je Übung, aus allen Logs abgeleitet.
 *   arbeit   schwerster sauber geschaffter Arbeitssatz
 *   gemessen echter Einzelversuch aus einem Max-Out
 *   maximum  bestes geschätztes Einer-Maximum, egal woher
 */
export function prs(logs = []) {
  const out = {};
  const merke = (lift, feld, wert) => {
    out[lift] = out[lift] || { arbeit: null, gemessen: null, maximum: null, untergrenze: null };
    const alt = out[lift][feld];
    if (!alt || wert.vergleich > alt.vergleich) out[lift][feld] = wert;
  };

  for (const l of logs) {
    if (l.type === 'maxout' && l.lift && l.weight) {
      const wdh = l.reps || 1;
      const geschaetzt = e1rm(l.weight, wdh);
      if (wdh === 1) {
        merke(l.lift, 'gemessen', { vergleich: l.weight, weight: l.weight, date: l.date });
      }
      // Nur ein Max-Out geht bis nah ans Versagen — nur daraus wird ein
      // belastbares Maximum. Alles andere ist eine Untergrenze.
      if (geschaetzt) {
        merke(l.lift, 'maximum', {
          vergleich: geschaetzt, wert: geschaetzt, weight: l.weight, reps: wdh,
          date: l.date, formel: e1rmFormel(wdh)
        });
      }
      continue;
    }
    if ((l.type || 'strength') !== 'strength' || !Array.isArray(l.lifts)) continue;

    for (const e of l.lifts) {
      const beste = Math.max(0, ...(e.reps || []));
      if (e.success) {
        merke(e.lift, 'arbeit', { vergleich: e.weight, weight: e.weight, date: l.date, sets: e.sets, reps: e.target });
      }
      // Arbeitssaetze sind submaximal: die Formel unterschaetzt hier
      // systematisch. Deshalb "mindestens", nicht "geschaetztes Maximum".
      const geschaetzt = e1rm(e.weight, beste);
      if (geschaetzt) {
        merke(e.lift, 'untergrenze', {
          vergleich: geschaetzt, wert: geschaetzt, weight: e.weight, reps: beste,
          date: l.date, formel: e1rmFormel(beste)
        });
      }
    }
  }
  return out;
}

/**
 * Verlauf des geschätzten Maximums. Steigt auch dann, wenn du bei gleichem
 * Gewicht mehr Wiederholungen schaffst — bei ein bis zwei Einheiten pro
 * Woche der ehrlichere Fortschrittsmesser als das reine Arbeitsgewicht.
 */
export function serieE1rm(logs, liftId) {
  const punkte = [];
  for (const l of logs) {
    if (l.type === 'maxout' && l.lift === liftId) {
      const w = e1rm(l.weight, l.reps || 1);
      if (w) punkte.push({ date: l.date, weight: w, belastbar: true });
      continue;
    }
    if ((l.type || 'strength') !== 'strength' || !Array.isArray(l.lifts)) continue;
    const e = l.lifts.find(x => x.lift === liftId);
    if (!e) continue;
    const w = e1rm(e.weight, Math.max(0, ...(e.reps || [])));
    if (w) punkte.push({ date: l.date, weight: w, belastbar: false });
  }
  return punkte.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Was an dieser einen Einheit ein Bestwert war — gemessen gegen alles,
 * was davor liegt. Für die Rückmeldung direkt nach dem Training.
 */
export function neuePRs(logs, log) {
  const davor = prs(logs.filter(l => l.date < log.date));
  const danach = prs([...logs.filter(l => l.date < log.date), log]);
  const treffer = [];
  for (const [lift, neu] of Object.entries(danach)) {
    for (const feld of ['arbeit', 'gemessen', 'maximum', 'untergrenze']) {
      const a = davor[lift] && davor[lift][feld];
      const b = neu[feld];
      if (b && (!a || b.vergleich > a.vergleich) && b.date === log.date) {
        treffer.push({ lift, feld, wert: b });
      }
    }
  }
  return treffer;
}

/* ---------------------------------------------------------------
   Radfahrten. Kommen fertig aus intervals.icu, hier wird nur
   zusammengefasst — nachgebaut wird dort nichts.                  */

export function radStats(rides = []) {
  const minuten = rides.reduce((s, r) => s + (r.minutes || 0), 0);
  const km = rides.reduce((s, r) => s + (r.km || 0), 0);
  const last = rides.reduce((s, r) => s + (r.load || 0), 0);
  const daten = rides.map(r => r.date).sort();
  let proWoche = null;
  if (daten.length > 1) {
    const tage = (new Date(daten[daten.length - 1]) - new Date(daten[0])) / 86400000;
    proWoche = tage > 0 ? Math.round((rides.length / (tage / 7)) * 10) / 10 : null;
  }
  return {
    anzahl: rides.length,
    minuten,
    stunden: Math.round((minuten / 60) * 10) / 10,
    km: Math.round(km),
    last: Math.round(last),
    proWoche,
    von: daten[0] || null,
    bis: daten[daten.length - 1] || null
  };
}

/** Wochenweise Last — zeigt Rhythmus und Lücken deutlicher als eine Liste. */
export function radWochen(rides = [], wochen = 12, heute = new Date()) {
  const montag = d => {
    const m = new Date(d);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  };
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const eimer = [];
  const start = montag(heute);
  for (let i = wochen - 1; i >= 0; i--) {
    const m = new Date(start);
    m.setDate(m.getDate() - i * 7);
    eimer.push({ woche: key(m), last: 0, minuten: 0, fahrten: 0 });
  }
  const index = new Map(eimer.map((e, i) => [e.woche, i]));

  for (const r of rides) {
    if (!r.date) continue;
    const i = index.get(key(montag(new Date(r.date + 'T12:00:00'))));
    if (i === undefined) continue;
    eimer[i].last += r.load || 0;
    eimer[i].minuten += r.minutes || 0;
    eimer[i].fahrten += 1;
  }
  return eimer;
}

/* ---------------------------------------------------------------
   Trainingskalender. Regelmaessigkeit ist Daniels erklaertes Ziel —
   und nichts zeigt sie so unbestechlich wie ein Raster, in dem die
   Luecken genauso sichtbar sind wie die Treffer.                   */

const tagesKey = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const montagVon = d => {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};

export function kalender(logs = [], fahrten = [], wochen = 26, heute = new Date()) {
  const start = montagVon(heute);
  start.setDate(start.getDate() - (wochen - 1) * 7);

  const kraft = new Set(), wod = new Set(), rad = new Set();
  for (const l of logs) {
    if (!l.date) continue;
    if (l.type === 'wod') wod.add(l.date);
    else if (!l.type || l.type === 'strength') kraft.add(l.date);
  }
  for (const f of fahrten) if (f.date) rad.add(f.date);

  const tage = [];
  const heuteKey = tagesKey(heute);
  for (let i = 0; i < wochen * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = tagesKey(d);
    tage.push({
      date: key,
      kraft: kraft.has(key),
      wod: wod.has(key),
      rad: rad.has(key),
      zukunft: key > heuteKey,
      heute: key === heuteKey
    });
  }
  return { tage, wochen, von: tage[0].date, bis: tage[tage.length - 1].date };
}

/**
 * Wochenlast aus beiden Welten. Kraft wird aus der Dauer geschaetzt — mit
 * demselben Faktor wie bei der Uebertragung nach intervals.icu, damit die
 * Zahlen hier und dort dieselben sind.
 */
export function wochenLast(logs = [], fahrten = [], wochen = 12, heute = new Date(), faktor = { strength: 0.8, wod: 1.4 }) {
  const start = montagVon(heute);
  const eimer = [];
  for (let i = wochen - 1; i >= 0; i--) {
    const m = new Date(start);
    m.setDate(m.getDate() - i * 7);
    eimer.push({ woche: tagesKey(m), kraft: 0, rad: 0 });
  }
  const index = new Map(eimer.map((e, i) => [e.woche, i]));
  const eimerFuer = datum => index.get(tagesKey(montagVon(new Date(datum + 'T12:00:00'))));

  for (const l of logs) {
    if (!l.date || l.type === 'maxout' || l.type === 'anpassung') continue;
    const i = eimerFuer(l.date);
    if (i === undefined) continue;
    const sek = l.dauerSekunden ||
      (l.started && l.finished ? Math.round((new Date(l.finished) - new Date(l.started)) / 1000) : 0);
    if (!sek) continue;
    eimer[i].kraft += Math.round((sek / 60) * (l.type === 'wod' ? faktor.wod : faktor.strength));
  }
  for (const f of fahrten) {
    if (!f.date) continue;
    const i = eimerFuer(f.date);
    if (i !== undefined) eimer[i].rad += f.load || 0;
  }
  return eimer.map(e => ({ ...e, gesamt: e.kraft + e.rad }));
}
