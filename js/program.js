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
  next.history = [...(next.history || []), { date: log.date, workout: log.workout }].slice(-100);
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
    const done = (state.history || []).some(h => h.date === key);

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
