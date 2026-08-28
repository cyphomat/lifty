// Leitet aus dem tatsaechlichen Zustand ab, was heute ansteht und in welchem
// Ton. Reine Funktionen, kein I/O — damit testbar, und damit die App nie
// etwas behauptet, das nicht aus deinen Daten folgt.

import { VOICE } from './content.js';

export function daysSince(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const a = new Date(dateStr + 'T00:00:00');
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((b - a) / 86400000);
}

/** Wie viele Wochen am Stueck mit mindestens einer Einheit? */
export function weekStreak(history = [], today = new Date()) {
  if (!history.length) return 0;
  const wochen = new Set(history.map(h => isoWeekKey(new Date(h.date + 'T00:00:00'))));
  let streak = 0;
  const cursor = new Date(today);
  // Die laufende Woche zaehlt nur mit, wenn schon trainiert wurde.
  if (!wochen.has(isoWeekKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  while (wochen.has(isoWeekKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-${Math.ceil(((t - start) / 86400000 + 1) / 7)}`;
}

/**
 * Wie weit zurueck auf dem Weg zu den alten Arbeitsgewichten?
 * Das ist die Zahl, die nach einer Pause wirklich motiviert —
 * nicht das absolute Gewicht.
 */
export function progressToReference(state, config) {
  const perLift = {};
  let summe = 0, n = 0;
  for (const [id, def] of Object.entries(config.lifts)) {
    if (!def.reference) continue;
    const anteil = Math.min(1, state.lifts[id].weight / def.reference);
    perLift[id] = { anteil, jetzt: state.lifts[id].weight, ziel: def.reference };
    summe += anteil; n++;
  }
  return { gesamt: n ? summe / n : 0, perLift };
}

/** Stabil ueber den Tag: derselbe Spruch bei jedem Neuzeichnen. */
function pick(list, seed) {
  if (!list || !list.length) return '';
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/**
 * Die eine Aussage, die oben steht: Wo stehst du, was will der Tag,
 * und in welchem Ton wird das gesagt.
 */
export function directive(state, config, today = new Date(), letzterLog = null) {
  const hist = state.history || [];
  const letzte = hist.length ? hist[hist.length - 1].date : null;
  const tage = daysSince(letzte, today);
  const streak = weekStreak(hist, today);
  const fortschritt = progressToReference(state, config);
  const workout = state.next;
  const lifts = config.workouts[workout].map(s => s.lift);
  const offeneFehler = lifts.filter(l => (state.lifts[l].fails || 0) > 0);
  const deloadGerade = !!letzterLog && Array.isArray(letzterLog.lifts) &&
    letzterLog.lifts.some(e => state.lifts[e.lift] && state.lifts[e.lift].weight < e.weight);

  let situation, kopf;
  if (tage === null || tage > 21) {
    situation = 'comeback';
    kopf = tage === null ? 'Erste Einheit' : `${tage} Tage weg`;
  } else if (deloadGerade) {
    situation = 'nachDeload';
    kopf = 'Deload aktiv';
  } else if (offeneFehler.length) {
    situation = 'nachFehlversuch';
    kopf = `Offene Rechnung: ${config.lifts[offeneFehler[0]].name}`;
  } else if (streak >= 4) {
    situation = 'streak';
    kopf = `${streak} Wochen am Stück`;
  } else if (fortschritt.gesamt < 0.7) {
    situation = 'leicht';
    kopf = 'Wiederaufbau';
  } else {
    situation = 'standard';
    kopf = tage !== null ? `Zuletzt vor ${tage} Tag${tage === 1 ? '' : 'en'}` : 'Auf geht’s';
  }

  return {
    situation,
    kopf,
    spruch: pick(VOICE[situation], toKey(today) + situation),
    intensitaet: intensitaet(situation, workout),
    streak,
    tageSeitLetzter: tage,
    fortschritt
  };
}

/** Sagt klar an, was der Tag sein soll. Kein "je nach Gefühl". */
function intensitaet(situation, workout) {
  if (situation === 'comeback' || situation === 'leicht' || situation === 'nachDeload') {
    return { stufe: 'technik', label: 'TECHNIK', text: 'Heute geht es um Position, nicht um Last. Sauber vor schwer.' };
  }
  if (situation === 'nachFehlversuch') {
    return { stufe: 'hart', label: 'HART', text: 'Gleiche Last wie letztes Mal. Heute holst du sie dir.' };
  }
  if (workout === 'B') {
    return { stufe: 'hart', label: 'SCHWER', text: 'Kreuzheben am Ende. Spar dir was auf, ein Satz muss reichen.' };
  }
  return { stufe: 'normal', label: 'SOLIDE', text: 'Fünf saubere Sätze pro Übung. Nicht mehr, nicht weniger.' };
}

function toKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Deterministische Auswahl aus einer Liste, taeglich wechselnd. */
export function tagesAuswahl(list, today = new Date(), salz = '') {
  return pick(list, toKey(today) + salz);
}

/** Gewichtstrend aus intervals.icu-Wellness. Rohdaten sind verrauscht. */
export function gewichtsTrend(punkte = []) {
  const clean = punkte.filter(p => p.weight).sort((a, b) => a.date.localeCompare(b.date));
  if (clean.length < 2) return clean.length ? { aktuell: clean[0].weight, delta: null, n: 1 } : null;
  const mittel = arr => arr.reduce((s, p) => s + p.weight, 0) / arr.length;
  const fenster = Math.min(7, Math.floor(clean.length / 2));
  const neu = mittel(clean.slice(-fenster));
  const alt = mittel(clean.slice(0, fenster));
  return {
    aktuell: Math.round(neu * 10) / 10,
    delta: Math.round((neu - alt) * 10) / 10,
    n: clean.length,
    von: clean[0].date,
    bis: clean[clean.length - 1].date
  };
}

/* ---------------------------------------------------------------
   Form aus intervals.icu. Form = Fitness minus Ermuedung (ctl-atl),
   der uebliche TSB-Wert. Bewusst nur ein Hinweis: die App kuerzt
   dir keine Gewichte eigenmaechtig, sie sagt dir, was sie sieht.  */

export function formLage(wellness) {
  if (!wellness || wellness.ctl == null || wellness.atl == null) return null;
  const form = Math.round(wellness.ctl - wellness.atl);

  let stufe, text;
  if (form >= 5) {
    stufe = 'frisch';
    text = 'Ausgeruht. Wenn ein Tag für einen Versuch am oberen Ende taugt, dann dieser.';
  } else if (form >= -10) {
    stufe = 'neutral';
    text = 'Normal belastet. Plan durchziehen.';
  } else if (form >= -20) {
    stufe = 'muede';
    text = 'Deutlich ermüdet vom Rad. Technik hat heute Vorrang vor Last — und der Finisher darf ausfallen.';
  } else {
    stufe = 'platt';
    text = 'Stark ermüdet. Wenn heute etwas nicht geht, liegt es nicht an dir. Leichter machen ist hier die richtige Entscheidung, nicht die bequeme.';
  }

  return {
    form, stufe, text,
    fitness: Math.round(wellness.ctl),
    ermuedung: Math.round(wellness.atl),
    datum: wellness.date || null
  };
}
