// Laeuft dieser Fork noch auf einem alten Stand?
//
// Wer die App selbst betreibt, hat das Repo geforkt. Ein Fork bekommt von
// sich aus nie mit, dass am Original weitergearbeitet wurde — er bleibt
// stehen, wo er abgezweigt ist, und niemand merkt es. Deshalb vergleicht
// die App ihre eigene Version mit der des Originals und sagt Bescheid.
//
// Bewusst nur ein Hinweis: aktualisiert wird von Hand ueber GitHub
// ("Sync fork"). Ein Fork, der sich selbst ueberschreibt, waere eine
// Fernsteuerung fremder Repos.

// Das Original, von dem alle Forks abstammen.
export const URSPRUNG = { owner: 'cyphomat', repo: 'setlist' };

/**
 * Versionen haben die Form JJJJ-MM-TT.N — Datum plus laufende Nummer am Tag.
 * Zerlegt in beides, damit .100 nicht vor .75 einsortiert wird, wie es ein
 * reiner Zeichenkettenvergleich taete.
 */
function zerlege(v) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:\.(\d+))?$/.exec(String(v ?? '').trim());
  return m ? { datum: m[1], nummer: m[2] ? Number(m[2]) : 0 } : null;
}

/**
 * -1, 0, 1 — wie ein ueblicher Vergleich. Ist eine der beiden Angaben
 * unbrauchbar, kommt 0 zurueck: unbekannt heisst nicht "veraltet".
 */
export function vergleiche(a, b) {
  const x = zerlege(a), y = zerlege(b);
  if (!x || !y) return 0;
  if (x.datum !== y.datum) return x.datum < y.datum ? -1 : 1;
  if (x.nummer !== y.nummer) return x.nummer < y.nummer ? -1 : 1;
  return 0;
}

/** Gibt es oben etwas Neueres als hier? */
export function istVeraltet(laufend, oben) {
  return vergleiche(laufend, oben) === -1;
}

/**
 * Laeuft die App ueberhaupt als Fork? Auf der Seite des Originals waere der
 * Hinweis sinnlos — dort ist man selbst die Quelle. Erkannt an der Adresse:
 * GitHub Pages eines Nutzers liegen unter <nutzer>.github.io.
 */
export function istFork(host, owner = URSPRUNG.owner) {
  const h = String(host ?? '').toLowerCase();
  if (!h.endsWith('.github.io')) return false;          // lokal oder woanders
  return h !== `${String(owner).toLowerCase()}.github.io`;
}
