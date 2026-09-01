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
/* ---------------------------------------------------------------
   Watt pro Kilogramm. Die Kurve, die im Defizit steigt, waehrend die
   absoluten Watt stehenbleiben.

   Beides liegt in intervals.icu: `eftp` und `weight` aus den
   Wellness-Daten. Es braucht also kein einziges neues Feld — nur die
   Division, die bisher niemand gemacht hat.                         */

/** Punkte mit beiden Haelften. Tage ohne Gewicht oder ohne eFTP fallen raus. */
export function wattProKg(wellness = []) {
  return wellness
    .filter(w => w.eftp > 0 && w.weight > 0)
    .map(w => ({
      date: w.date,
      wkg: Math.round((w.eftp / w.weight) * 1000) / 1000,
      eftp: Math.round(w.eftp),
      weight: Math.round(w.weight * 10) / 10
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Woher die Veraenderung kam. Ein Plus in W/kg kann aus mehr Leistung
 * stammen oder aus weniger Gewicht — das ist derselbe Zahlenwert und ein
 * voellig anderer Vorgang. Die Zerlegung ist exakt, nicht geschaetzt:
 *   b.eftp/b.kg - a.eftp/a.kg
 *     = (b.eftp - a.eftp)/a.kg  +  b.eftp * (1/b.kg - 1/a.kg)
 * Der erste Summand ist der Anteil der Leistung, der zweite der des
 * Gewichts, und zusammen ergeben sie die Differenz ohne Rest.
 */
export function wattProKgTrend(punkte = []) {
  if (punkte.length < 2) return null;
  const a = punkte[0], b = punkte[punkte.length - 1];
  const ausLeistung = (b.eftp - a.eftp) / a.weight;
  const ausGewicht = b.eftp * (1 / b.weight - 1 / a.weight);
  const r = n => Math.round(n * 1000) / 1000;
  return {
    von: a, bis: b,
    delta: r(b.wkg - a.wkg),
    ausLeistung: r(ausLeistung),
    ausGewicht: r(ausGewicht),
    kgDelta: Math.round((b.weight - a.weight) * 10) / 10,
    wattDelta: b.eftp - a.eftp,
    tage: Math.round((new Date(b.date) - new Date(a.date)) / 86400000)
  };
}

/**
 * Zwei Anteile so runden, dass sie die gerundete Summe exakt ergeben.
 * Getrennt gerundet ergaben +0,12 und +0,09 eine Summe von +0,22 — die
 * Rechnung stimmt, die Anzeige sah nach Schlamperei aus. Der Rest der
 * Rundung geht an den zweiten Anteil, statt in einer dritten Zahl zu
 * verschwinden, die niemand zuordnen kann.
 */
export function anteileAufSumme(summe, teilA, stellen = 2) {
  const f = 10 ** stellen;
  const s = Math.round(summe * f) / f;
  const a = Math.round(teilA * f) / f;
  return { summe: s, a, b: Math.round((s - a) * f) / f };
}

/* ---------------------------------------------------------------
   Aerobe Basis: Effizienzfaktor und Entkopplung.

   Beides misst dasselbe von zwei Seiten — wie viel Leistung ein
   Herzschlag traegt. Der Unterschied ist die Anforderung an die Fahrt:
   der Effizienzfaktor kommt mit fuenfundvierzig Minuten aus, die
   Entkopplung braucht eine lange ruhige Strecke am Stueck.

   Deshalb traegt hier der Effizienzfaktor, und die Entkopplung bleibt
   still, bis genug zusammenhaengende Grundlage dahintersteht. Eine
   Kurve aus zwei Messpunkten waere kein Trend, sondern Dekoration.   */

/**
 * Der Effizienzfaktor ist nur innerhalb vergleichbarer Fahrten aussagekraeftig:
 * eine harte Fahrt hat systematisch einen hoeheren Wert als eine ruhige, weil
 * die Leistung schneller steigt als der Puls. Eine Kurve ueber alle Fahrten
 * misst darum vor allem, wie hart die letzte war.
 *
 * Statt eine Zielzone vorzuschreiben, sucht diese Funktion das Band, in dem
 * am meisten gefahren wurde, und vergleicht nur darin. Sie passt sich damit
 * an, was tatsaechlich passiert — nicht an das, was jemand fuer richtig haelt.
 */
export function aerobeEffizienz(fahrten = [], { minMinuten = 25, bandBreite = 0.15, ab = 0.40 } = {}) {
  const taugt = fahrten.filter(f =>
    f && f.effizienz > 0 && f.intensitaet > 0 && (f.minutes || 0) >= minMinuten);
  if (!taugt.length) return { band: null, punkte: [], geprueft: fahrten.length, verworfen: fahrten.length };

  const bandVon = f => ab + Math.floor((f.intensitaet - ab) / bandBreite) * bandBreite;
  const eimer = new Map();
  for (const f of taugt) {
    const k = Math.round(bandVon(f) * 100) / 100;
    if (!eimer.has(k)) eimer.set(k, []);
    eimer.get(k).push(f);
  }
  // Groesstes Band gewinnt; bei Gleichstand das haertere, weil dort die
  // juengeren Fahrten liegen und der Trend aktueller ist.
  const [von, gruppe] = [...eimer.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0];

  return {
    band: [Math.round(von * 100) / 100, Math.round((von + bandBreite) * 100) / 100],
    geprueft: fahrten.length,
    verworfen: fahrten.length - gruppe.length,
    punkte: gruppe
      .map(f => ({
        date: f.date,
        ef: Math.round(f.effizienz * 1000) / 1000,
        ist: Math.round(f.intensitaet * 100) / 100,
        np: f.np || null, hf: f.hf || null, minuten: f.minutes || null
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}

/**
 * Trend ueber die Effizienzpunkte. Unter drei Punkten wird bewusst nichts
 * ausgerechnet: zwei Werte sind eine Verbindungslinie, kein Verlauf.
 */
export function effizienzTrend(punkte = []) {
  if (punkte.length < 3) return null;
  const a = punkte[0], b = punkte[punkte.length - 1];
  const delta = b.ef - a.ef;
  return {
    von: a, bis: b, n: punkte.length,
    delta: Math.round(delta * 1000) / 1000,
    prozent: Math.round((delta / a.ef) * 1000) / 10,
    tage: Math.round((new Date(b.date) - new Date(a.date)) / 86400000)
  };
}

/**
 * Entkopplung, aber nur wo sie etwas bedeutet. `pwhrMin` sagt, ueber wie
 * viele Minuten zusammenhaengender Grundlage intervals.icu den Wert
 * gebildet hat — darunter ist die Zahl da, aber nicht belastbar.
 *
 * Gibt immer auch zurueck, WORAN es fehlt. "Keine Daten" und "die Fahrten
 * sind zu kurz dafuer" sind zwei verschiedene Auskuenfte, und nur die
 * zweite sagt einem, was sich aendern muesste.
 */
export function entkopplungsReihe(fahrten = [], minZ2Minuten = 20) {
  const mitWert = fahrten.filter(f => f && f.entkopplung != null);
  const punkte = mitWert
    .filter(f => (f.pwhrMin || 0) >= minZ2Minuten)
    .map(f => ({
      date: f.date,
      wert: Math.round(f.entkopplung * 10) / 10,
      minuten: f.pwhrMin, fahrtMinuten: f.minutes || null
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const beste = mitWert.reduce((m, f) => Math.max(m, f.pwhrMin || 0), 0);
  return {
    punkte,
    schwelle: minZ2Minuten,
    mitWert: mitWert.length,
    zuKurz: mitWert.length - punkte.length,
    besteMinuten: beste,
    // Genug fuer eine Aussage? Drei Punkte, dieselbe Begruendung wie oben.
    tragfaehig: punkte.length >= 3
  };
}

/* ---------------------------------------------------------------
   Plan gegen Ist. Die Frage ist nicht "wie stark bist du", sondern
   "hast du gemacht, was dran war" — und der Fehler, der wirklich
   etwas kostet, ist die leichte Einheit, die hart gefahren wurde.  */

// Wie weit die Intensitaet neben dem Ziel liegen darf, bevor es zaehlt.
const TOLERANZ = 0.03;

/**
 * Eine Fahrt gegen ihren Plan. `planFuer(datum)` liefert `{ label, ftp:
 * [von, bis], struktur }` oder null — als Funktion uebergeben, damit diese
 * Datei nichts ueber Wochenplaene wissen muss und pruefbar bleibt.
 *
 * Bei Intervallen wird "zu locker" bewusst NICHT geurteilt: der Schnitt
 * ueber die ganze Fahrt enthaelt Aufwaermen und Pausen und liegt darum
 * zwangslaeufig unter dem Ziel der Intervalle. Ein Urteil, das die Methode
 * gar nicht hergibt, waere schlimmer als keins.
 */
export function intensitaetsAbgleich(fahrten = [], planFuer = () => null) {
  return fahrten
    .filter(f => f && f.intensitaet != null && f.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(f => {
      const plan = planFuer(f.date);
      const ist = Math.round(f.intensitaet * 100) / 100;
      const basis = { date: f.date, ist, minuten: f.minutes || null, name: f.name || null };
      if (!plan || !Array.isArray(plan.ftp) || plan.ftp.length !== 2) {
        return { ...basis, stufe: 'ohnePlan', label: plan ? plan.label : null, ziel: null };
      }
      const [von, bis] = plan.ftp;
      const gemein = { ...basis, label: plan.label, ziel: [von, bis], struktur: plan.struktur || 'dauerhaft' };
      if (ist > bis + TOLERANZ) return { ...gemein, stufe: 'zuHart' };
      if (ist >= von - TOLERANZ) return { ...gemein, stufe: 'imZiel' };
      return { ...gemein, stufe: gemein.struktur === 'intervalle' ? 'unklar' : 'zuLocker' };
    });
}

/** Zaehlwerk ueber den Abgleich. `quote` laesst aus, was nicht beurteilbar ist. */
export function abgleichBilanz(eintraege = []) {
  const z = { imZiel: 0, zuHart: 0, zuLocker: 0, unklar: 0, ohnePlan: 0 };
  for (const e of eintraege) if (z[e.stufe] !== undefined) z[e.stufe]++;
  const beurteilt = z.imZiel + z.zuHart + z.zuLocker;
  return { ...z, gesamt: eintraege.length, beurteilt,
           quote: beurteilt ? Math.round((z.imZiel / beurteilt) * 100) : null };
}

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

/** Bewegtes Gewicht je Woche — das Volumen hinter der Progression. */
export function wochenTonnage(logs = [], wochen = 12, heute = new Date()) {
  const start = montagVon(heute);
  const eimer = [];
  for (let i = wochen - 1; i >= 0; i--) {
    const m = new Date(start);
    m.setDate(m.getDate() - i * 7);
    eimer.push({ woche: tagesKey(m), tonnage: 0, einheiten: 0 });
  }
  const index = new Map(eimer.map((e, i) => [e.woche, i]));
  for (const l of logs) {
    if (!l.date || !istKraft(l)) continue;
    const i = index.get(tagesKey(montagVon(new Date(l.date + 'T12:00:00'))));
    if (i === undefined) continue;
    eimer[i].tonnage += tonnage(l);
    eimer[i].einheiten += 1;
  }
  return eimer.map(e => ({ ...e, tonnage: Math.round(e.tonnage) }));
}

/**
 * Fitness und Ermuedung ueber die Zeit. Der Abstand zwischen beiden ist die
 * Form — deshalb wird er als Flaeche zwischen den Linien gezeichnet und
 * nicht als dritte Kurve, die dasselbe noch einmal sagt.
 */
export function formVerlauf(wellness = []) {
  return wellness
    .filter(w => w.ctl != null && w.atl != null && w.date)
    .map(w => ({ date: w.date, ctl: w.ctl, atl: w.atl, form: Math.round((w.ctl - w.atl) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Zum Angeben ──────────────────────────────────────────────────
   Reine Vergleiche in derselben Einheit oder reine Zaehlungen — nichts
   geschaetzt, nichts erfunden. Kalorien aus bewegtem Gewicht waeren genau
   das: Physik vorgetaeuscht, wo eigentlich Stoffwechsel gemeint ist.    */

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

/** Wiederholungen insgesamt, aus allen Kraftsaetzen — auch nicht geschafften. */
export function wiederholungenGesamt(logs = []) {
  return logs.filter(istKraft).reduce((summe, l) =>
    summe + l.lifts.reduce((s, e) => s + (e.reps || []).reduce((a, r) => a + r, 0), 0), 0);
}

/**
 * Wochentag, an dem am haeufigsten trainiert wurde — Kraft, WOD und Rad
 * zusammen, weil es um das eigene Muster geht, nicht um eine Sportart.
 * Ein Tag mit zwei Einheiten zaehlt einmal, wie im Trainingskalender auch.
 */
export function lieblingstag(logs = [], fahrten = []) {
  const zaehler = new Array(7).fill(0);
  const gesehen = new Set();
  const zaehle = datum => {
    if (!datum || gesehen.has(datum)) return;
    gesehen.add(datum);
    zaehler[new Date(datum + 'T00:00:00').getDay()]++;
  };
  for (const l of logs) zaehle(l.date);
  for (const f of fahrten) zaehle(f.date);
  if (!gesehen.size) return null;
  const idx = zaehler.indexOf(Math.max(...zaehler));
  return { tag: WOCHENTAGE[idx], anzahl: zaehler[idx] };
}

/**
 * Laengste Serie aufeinanderfolgender Wochen mit mindestens einer Einheit,
 * ueber die gesamte Geschichte — der Rekord, nicht die laufende Serie
 * (die steht schon im Trainingskalender).
 */
export function laengsteSerie(logs = [], fahrten = []) {
  const wochenstart = new Set();
  const einordnen = datum => {
    if (!datum) return;
    const d = new Date(datum + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    wochenstart.add(tagesKey(d));
  };
  for (const l of logs) einordnen(l.date);
  for (const f of fahrten) einordnen(f.date);

  const sortiert = [...wochenstart].sort();
  let laengste = 0, laufend = 0, vorher = null;
  for (const w of sortiert) {
    const d = new Date(w + 'T00:00:00');
    laufend = (vorher && d - vorher === 7 * 86400000) ? laufend + 1 : 1;
    laengste = Math.max(laengste, laufend);
    vorher = d;
  }
  return laengste;
}

// Ansage-Stufen aus intensitaet() in coach.js — HART und SCHWER teilen sich
// dieselbe Stufe, beide sagen "wird hart", nur aus verschiedenem Grund.
const ANSAGE_STUFE = { TECHNIK: 0, SOLIDE: 1, HART: 2, SCHWER: 2 };
const GEFUEHL_STUFE = { leicht: 0, normal: 1, hart: 2, extrem: 3 };

/**
 * Ansage gegen tatsaechliches Gefuehl — macht die Vorhersage ueberpruefbar
 * statt behauptet. Nur Einheiten, die beides tragen, fliessen ein; aeltere
 * Logs kennen weder angesagt noch gefuehlt und werden stillschweigend
 * uebersprungen statt als Fehlschlag gezaehlt zu werden.
 */
export function ansageAbgleich(logs = []) {
  const eintraege = logs
    .filter(l => istKraft(l) && l.angesagt in ANSAGE_STUFE && l.gefuehlt in GEFUEHL_STUFE)
    .map(l => {
      const soll = ANSAGE_STUFE[l.angesagt], ist = GEFUEHL_STUFE[l.gefuehlt];
      const urteil = ist === soll ? 'treffer' : ist > soll ? 'schwerer' : 'leichter';
      return { date: l.date, workout: l.workout, angesagt: l.angesagt, gefuehlt: l.gefuehlt, urteil };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    eintraege,
    gesamt: eintraege.length,
    treffer: eintraege.filter(e => e.urteil === 'treffer').length,
    schwerer: eintraege.filter(e => e.urteil === 'schwerer').length,
    leichter: eintraege.filter(e => e.urteil === 'leichter').length
  };
}
