// Reine Programmlogik: 5x5-Automat. Kein I/O, keine DOM-Zugriffe.
// Alles hier ist deterministisch und aus config + logs reproduzierbar.

export function roundTo(weight, step) {
  return Math.round(weight / step) * step;
}

/** Startzustand allein aus der Programmdefinition. */
export function initialState(config) {
  const lifts = {};
  for (const [id, l] of Object.entries(config.lifts)) {
    lifts[id] = { weight: l.start, fails: 0 };
  }
  return {
    version: 1,
    derivedFrom: 0,
    updated: new Date(0).toISOString(),
    next: config.firstWorkout,
    lifts,
    history: []
  };
}

/** Hat der Satz-Verlauf das Ziel erfuellt? */
export function isSuccess(entry, target) {
  return entry.reps.length === entry.sets && entry.reps.every(r => r >= target);
}

/**
 * Eine Einheit auf den Zustand anwenden.
 * Erfolg  -> Gewicht + Steigerung, Fehlerzaehler auf 0
 * Fehler  -> Gewicht bleibt, Fehlerzaehler + 1
 * 3 Fehler-> Deload auf 90 %, Fehlerzaehler auf 0
 */
export function applyLog(state, config, log) {
  const next = JSON.parse(JSON.stringify(state)); // bewusst kein structuredClone: aeltere iOS-Safari kennen es nicht

  // Ein Max-Out ist ein Krafttest, kein Programmschritt. Er dreht den
  // A/B-Wechsel nicht weiter. Nur wenn du das Ergebnis ausdruecklich
  // uebernimmst, steht das im Log — und ist damit reproduzierbar.
  if (log.type === 'maxout') {
    const l = next.lifts[log.lift];
    if (l && log.newWorking) {
      l.weight = Math.max(config.bar, roundTo(log.newWorking, config.rounding));
      l.fails = 0;
    }
    next.updated = new Date().toISOString();
    next.history = [...(next.history || []),
      { date: log.date, type: 'maxout', lift: log.lift, weight: log.weight, reps: log.reps }].slice(-100);
    return next;
  }

  // Ein WOD ist Beiwerk, kein Programmschritt: es taucht in der Historie auf,
  // darf aber weder Arbeitsgewichte noch den A/B-Wechsel anfassen. Sonst
  // wuerde eine Spasseinheit die Progression verschieben.
  if (log.type && log.type !== 'strength') {
    next.updated = new Date().toISOString();
    next.history = [...(next.history || []), { date: log.date, type: log.type, label: log.label || 'WOD' }].slice(-100);
    return next;
  }

  for (const entry of log.lifts) {
    const def = config.lifts[entry.lift];
    const cur = next.lifts[entry.lift];
    if (!def || !cur) continue;

    if (entry.success) {
      cur.weight = roundTo(entry.weight + def.increment, config.rounding);
      cur.fails = 0;
    } else {
      cur.fails += 1;
      if (cur.fails >= config.deload.afterFails) {
        cur.weight = Math.max(config.bar, roundTo(entry.weight * config.deload.factor, config.rounding));
        cur.fails = 0;
      }
    }
  }
  next.next = log.workout === 'A' ? 'B' : 'A';
  next.derivedFrom = (next.derivedFrom || 0) + 1;
  next.updated = new Date().toISOString();
  next.history = [...(next.history || []), { date: log.date, workout: log.workout, type: 'strength' }].slice(-100);
  return next;
}

/** Vollstaendige Neuberechnung aus allen Logs — die tragende Invariante. */
export function deriveState(config, logs) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.reduce((s, log) => applyLog(s, config, log), initialState(config));
}

/** Was steht heute an? Gewichte aus dem aktuellen Zustand. */
export function planWorkout(state, config, which = state.next) {
  return {
    workout: which,
    lifts: config.workouts[which].map(slot => ({
      lift: slot.lift,
      name: config.lifts[slot.lift].name,
      weight: state.lifts[slot.lift].weight,
      sets: slot.sets,
      reps: slot.reps,
      fails: state.lifts[slot.lift].fails
    }))
  };
}

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** ISO-Wochennummer, weil der Plan wochenweise gedacht ist. */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - start) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Montag der Woche, in der d liegt. */
export function mondayOf(d) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/**
 * Die Woche wird nicht gespeichert, sondern aus config + state erzeugt.
 * Damit kann sie nie mit dem Zustand auseinanderlaufen.
 */
export function planWeek(state, config, today = new Date()) {
  const monday = mondayOf(today);
  const todayKey = ymd(today);
  let workout = state.next;
  let rideIndex = (state.history || []).length;

  return config.week.slots.map(slot => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + (slot.day - 1));
    const key = ymd(date);
    // Nur Krafteinheiten kommen aus der eigenen Historie. Ob eine Radeinheit
    // gefahren wurde, weiss allein intervals.icu — sonst haekelt eine
    // Krafteinheit am Dienstag die Radeinheit desselben Tages ab.
    const done = slot.type === 'strength' &&
      (state.history || []).some(h => h.date === key && (h.type || 'strength') === 'strength');

    const item = {
      date: key,
      day: DAYS[date.getDay()],
      type: slot.type,
      isToday: key === todayKey,
      isPast: key < todayKey,
      done
    };

    if (slot.type === 'strength') {
      item.label = `Workout ${workout}`;
      item.detail = config.workouts[workout].map(s => config.lifts[s.lift].name).join(' · ');
      item.workout = workout;
      if (!done) workout = workout === 'A' ? 'B' : 'A';
    } else {
      const ride = config.rides[rideIndex++ % config.rides.length];
      item.label = ride.label;
      item.detail = ride.detail;
    }
    return item;
  });
}

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtWeight(w) {
  return (Number.isInteger(w) ? w : w.toFixed(1)) + ' kg';
}

/**
 * Geschaetztes Einer-Maximum. Brzycki liegt im Bereich 2-6 Wiederholungen
 * naeher, Epley darueber — deshalb wird umgeschaltet statt eine Formel fuer
 * alles zu benutzen. Ueber 12 Wiederholungen wird jede Schaetzung Kaffeesatz,
 * dann gibt es bewusst keine.
 */
export function e1rm(weight, reps) {
  if (!weight || !reps || reps < 1 || reps > 12) return null;
  if (reps === 1) return weight;
  const wert = reps <= 6
    ? weight * 36 / (37 - reps)          // Brzycki
    : weight * (1 + reps / 30);          // Epley
  return Math.round(wert * 10) / 10;
}

/** Welche Formel steckt dahinter — damit die App nicht orakelt. */
export function e1rmFormel(reps) {
  if (!reps || reps < 1 || reps > 12) return null;
  return reps === 1 ? 'gemessen' : reps <= 6 ? 'Brzycki' : 'Epley';
}

/** Arbeitsgewicht fuer 5x5 aus einem Maximum. Konservativ mit 80 %. */
export function arbeitsgewichtAus(max1rm, rounding = 2.5, bar = 20) {
  if (!max1rm) return null;
  return Math.max(bar, roundTo(max1rm * 0.8, rounding));
}

/* ---------------------------------------------------------------
   Plattenrechner. Rechnen zwischen zwei Sätzen ist die häufigste
   Quelle für falsch beladene Stangen — und im Studio steht man
   ohnehin schon unter Zeitdruck.                                  */

export const STANDARD_SCHEIBEN = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Scheiben pro Seite, absteigend. Gibt null zurück, wenn sich das
 * Gewicht mit den vorhandenen Scheiben nicht exakt laden lässt —
 * lieber ehrlich nichts anzeigen als eine Zahl erfinden.
 */
export function platten(gewicht, config = {}) {
  const bar = config.bar || 20;
  const vorrat = [...(config.plates || STANDARD_SCHEIBEN)].sort((a, b) => b - a);
  if (gewicht < bar) return null;
  if (gewicht === bar) return [];

  let rest = Math.round(((gewicht - bar) / 2) * 1000) / 1000;
  const out = [];
  for (const p of vorrat) {
    while (rest >= p - 1e-9) {
      out.push(p);
      rest = Math.round((rest - p) * 1000) / 1000;
    }
  }
  return rest < 1e-9 ? out : null;
}

/** "2×20 + 5 + 2,5" — kurz genug für eine Zeile unter der Übung. */
export function plattenText(gewicht, config = {}) {
  const p = platten(gewicht, config);
  if (p === null) return null;
  if (!p.length) return 'leere Stange';
  const zaehler = new Map();
  for (const g of p) zaehler.set(g, (zaehler.get(g) || 0) + 1);
  return [...zaehler].map(([g, n]) => (n > 1 ? `${n}×${g}` : `${g}`)).join(' + ');
}

/**
 * Aufwärmsätze zum Arbeitsgewicht. Absteigende Wiederholungen bei
 * steigender Last: warm werden, ohne vor dem ersten Arbeitssatz
 * schon Körner zu lassen.
 */
export function waermsaetze(arbeit, config = {}) {
  const bar = config.bar || 20;
  const step = config.rounding || 2.5;
  const saetze = [{ weight: bar, reps: 5, saetze: 2, anteil: 0 }];
  if (arbeit <= bar + step) return saetze;

  for (const [anteil, reps] of [[0.55, 5], [0.7, 3], [0.85, 2]]) {
    const w = Math.max(bar, roundTo(arbeit * anteil, step));
    if (w >= arbeit) continue;
    if (saetze.some(s => s.weight === w)) continue;
    saetze.push({ weight: w, reps, saetze: 1, anteil });
  }
  return saetze;
}
