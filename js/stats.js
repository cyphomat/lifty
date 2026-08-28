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
