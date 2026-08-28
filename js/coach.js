// Leitet aus dem tatsaechlichen Zustand ab, was heute ansteht und in welchem
// Ton. Reine Funktionen, kein I/O — damit testbar, und damit die App nie
// etwas behauptet, das nicht aus deinen Daten folgt.

import { VOICE } from './content.js';
import { mondayOf } from './program.js';

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
export function directive(state, config, today = new Date(), letzterLog = null, stimme = null) {
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
    kopf = tage === null ? 'Auf geht’s'
         : tage === 0 ? 'Heute schon trainiert'
         : tage === 1 ? 'Gestern trainiert'
         : `Zuletzt vor ${tage} Tagen`;
  }

  return {
    situation,
    kopf,
    spruch: spruchWaehlen(situation, toKey(today), stimme && stimme.sprueche),
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

/* ---------------------------------------------------------------
   Interferenz zwischen Rad und Eisen. Die Forschungslage kurz:
   vier bis acht Stunden Abstand vermeiden die Stoerung weitgehend,
   Radfahren stoert weniger als Laufen, harte Intervalle treffen die
   Kraftausdauer deutlich und das Maximalkraftniveau kaum, und ab
   etwa 30 Minuten Umfang wird es ueberhaupt erst messbar.

   Die App warnt damit — sie kuerzt nichts. Der Sinn ist, dass ein
   zaeher Tag erklaerbar wird statt sich wie ein Rueckschritt
   anzufuehlen.                                                    */

function artDerFahrt(f) {
  const min = f.minutes || 0;
  const proMin = min > 0 && f.load ? f.load / min : 0;
  if (proMin >= 1.3 || (f.load >= 90 && min <= 75)) return 'hart';
  if (min >= 75) return 'lang';
  return 'locker';
}

export function interferenz(fahrten = [], jetzt = new Date()) {
  const mitZeit = fahrten
    .filter(f => f.zeit)
    .map(f => ({ ...f, ts: new Date(f.zeit) }))
    .filter(f => !isNaN(f.ts) && f.ts <= jetzt)
    .sort((a, b) => b.ts - a.ts);
  if (!mitZeit.length) return null;

  const f = mitZeit[0];
  const stunden = Math.round(((jetzt - f.ts) / 3600000) * 10) / 10;
  if (stunden > 24) return null;

  const art = artDerFahrt(f);
  const gerundet = Math.round(stunden);

  if (art === 'locker' && stunden >= 4) return null;

  if (stunden < 4 && art !== 'locker') {
    return { stufe: 'stark', stunden, art, fahrt: f,
      text: `Vor ${gerundet} Stunden ${art === 'hart' ? 'hart' : 'lang'} gefahren. Unter vier Stunden Abstand `
          + `leidet vor allem die Kraftausdauer — die letzten Sätze werden zäh. `
          + `Das Maximalkraftniveau bleibt davon weitgehend unberührt: es ist Ermüdung, kein Rückschritt.` };
  }
  if (stunden < 8 && art !== 'locker') {
    return { stufe: 'leicht', stunden, art, fahrt: f,
      text: `Vor ${gerundet} Stunden ${art === 'hart' ? 'hart' : 'lang'} gefahren. Der Abstand reicht knapp; `
          + `rechne beim letzten Satz mit etwas weniger Reserve.` };
  }
  if (stunden < 4) {
    return { stufe: 'gering', stunden, art, fahrt: f,
      text: `Vor ${gerundet} Stunden locker gefahren. Kein nennenswerter Einfluss — ruhige Grundlage stört das Eisen nicht.` };
  }
  return null;
}

/* ---------------------------------------------------------------
   Deine eigene Stimme. Alles Bisherige stammt von mir — das erzeugt
   dieses leicht Fremde. `stimme.json` im privaten Repo gehoert dir:
   was dort steht, hat Vorrang. Meine Zeilen sind nur die Rueckfall-
   ebene fuer Situationen, fuer die du noch nichts geschrieben hast. */

export function spruchWaehlen(situation, tag, eigene) {
  const meine = VOICE[situation] || [];
  const seine = (eigene && (eigene[situation] || eigene.alle)) || [];
  const pool = seine.length ? seine : meine;
  if (!pool.length) return '';
  let h = 0;
  const seed = String(tag) + situation;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/* ---------------------------------------------------------------
   Meilensteine. Die App kennt deine Bestleistungen samt Datum und
   sagt nichts dazu. Das sind die Saetze, die nur DEINE App sagen
   kann — kein Programm von der Stange kommt darauf.                */

export function meilensteine(state, config, heute = new Date()) {
  const out = [];
  const rec = (config.records && config.records.programm) || {};

  // Jahrestage der alten Bestleistungen
  for (const [id, r] of Object.entries(rec)) {
    if (!r || !r.datum) continue;
    const def = config.lifts[id];
    if (!def) continue;
    const d = new Date(r.datum + 'T12:00:00');
    const dieserJahrestag = new Date(heute.getFullYear(), d.getMonth(), d.getDate());
    const abstand = Math.round((dieserJahrestag - new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())) / 86400000);
    if (Math.abs(abstand) > 3) continue;
    const jahre = heute.getFullYear() - d.getFullYear();
    if (jahre < 1) continue;
    const wert = r.bestesEinzel || r.bestes5er;
    // Ganze Saetze statt zusammengeklebter Bruchstuecke — sonst kommt
    // "Vor 1 Tag waren es 5 Jahren" heraus.
    const n = Math.abs(abstand);
    const wann =
      abstand === 0  ? `Heute vor ${jahre} Jahren`
    : abstand === -1 ? `Gestern vor ${jahre} Jahren`
    : abstand === 1  ? `Morgen vor ${jahre} Jahren`
    : abstand < 0    ? `Vor ${n} Tagen war es ${jahre} Jahre her`
    :                  `In ${n} Tagen ist es ${jahre} Jahre her`;
    out.push({
      art: 'jahrestag', rang: 1, lift: id,
      text: `${wann}: ${wert} kg ${def.name}. Heute stehst du bei ${state.lifts[id].weight} kg — `
          + `nicht weil du weniger kannst, sondern weil du wieder anfängst.`
    });
  }

  // Zurueck auf dem Stand vor der Pause
  for (const [id, def] of Object.entries(config.lifts)) {
    if (!def.reference) continue;
    const w = state.lifts[id].weight;
    if (w >= def.reference) {
      out.push({
        art: 'referenz', rang: 2, lift: id,
        text: w > def.reference
          ? `${def.name}: ${w} kg — ${Math.round((w - def.reference) * 10) / 10} kg über deinem Stand vor der Pause.`
          : `${def.name}: ${w} kg — genau da, wo du vor der Pause warst. Ab hier ist alles Neuland.`
      });
    }
  }

  return out.sort((a, b) => a.rang - b.rang);
}

/* ---------------------------------------------------------------
   Minierfolge. Nach einer Einheit hat die App bisher berichtet, was
   passiert ist — eine Tabelle mit Pfeilen. Das ist etwas anderes,
   als gesagt zu bekommen, dass man gerade etwas geschafft hat.

   Bewusst kleinteilig: jede Steigerung zaehlt, jeder saubere Satz,
   jede Einheit in der Woche. Es geht nicht um Rekorde, sondern
   darum, dass sich Regelmaessigkeit anfuehlt wie Fortschritt.      */

export function erfolge(vorher, nachher, config, log, alleLogs = [], heute = new Date()) {
  const out = [];
  const lifts = Array.isArray(log.lifts) ? log.lifts : [];

  // Jede Steigerung ist ein Erfolg — auch die zwoelfte in Folge.
  const gestiegen = lifts
    .map(e => ({ id: e.lift, alt: vorher.lifts[e.lift].weight, neu: nachher.lifts[e.lift].weight }))
    .filter(x => x.neu > x.alt);
  for (const g of gestiegen) {
    out.push({ art: 'steigerung', rang: 3, lift: g.id,
      text: `${config.lifts[g.id].name}: ${g.alt} → ${g.neu} kg` });
  }

  // Runde Zahl geknackt
  for (const g of gestiegen) {
    const schwelle = Math.floor(g.neu / 10) * 10;
    if (schwelle > g.alt && schwelle <= g.neu && schwelle >= 40) {
      out.push({ art: 'rund', rang: 1, lift: g.id,
        text: `${schwelle} kg im ${config.lifts[g.id].name} — erste Mal über dieser Marke seit dem Wiedereinstieg.` });
    }
  }

  // Wieder auf dem Stand vor der Pause
  for (const g of gestiegen) {
    const ref = config.lifts[g.id].reference;
    if (ref && g.alt < ref && g.neu >= ref) {
      out.push({ art: 'referenz', rang: 0, lift: g.id,
        text: `${config.lifts[g.id].name} zurück auf ${ref} kg — dem Stand vor der Pause. Ab hier ist alles Neuland.` });
    }
  }

  // Alle Sätze sauber
  const saetze = lifts.reduce((s, e) => s + (e.reps || []).length, 0);
  const sauber = lifts.reduce((s, e) => s + (e.reps || []).filter(r => r >= (e.target || 5)).length, 0);
  if (saetze && sauber === saetze) {
    out.push({ art: 'sauber', rang: 2, text: `${saetze} von ${saetze} Sätzen sauber durchgezogen.` });
  } else if (saetze) {
    out.push({ art: 'saetze', rang: 4, text: `${sauber} von ${saetze} Sätzen geschafft.` });
  }

  // Bewegtes Gewicht dieser Einheit
  const tonnage = lifts.reduce((s, e) => s + (e.weight || 0) * (e.reps || []).reduce((a, r) => a + r, 0), 0);
  if (tonnage > 0) {
    out.push({ art: 'tonnage', rang: 5,
      text: tonnage >= 1000 ? `${(tonnage / 1000).toFixed(1)} Tonnen bewegt.` : `${Math.round(tonnage)} kg bewegt.` });
  }

  // Wievielte Einheit in dieser Woche
  const montag = mondayOf(heute);
  const dieseWoche = alleLogs.filter(l => (l.type || 'strength') === 'strength'
    && new Date(l.date + 'T12:00:00') >= montag).length;
  if (dieseWoche >= 2) {
    out.push({ art: 'woche', rang: 2, text: `${dieseWoche}. Einheit diese Woche.` });
  }

  // Runde Gesamtzahl an Einheiten
  const gesamt = alleLogs.filter(l => (l.type || 'strength') === 'strength').length;
  if (gesamt > 0 && (gesamt % 10 === 0 || gesamt === 5)) {
    out.push({ art: 'anzahl', rang: 1, text: `${gesamt}. Einheit insgesamt.` });
  }

  return out.sort((a, b) => a.rang - b.rang);
}
