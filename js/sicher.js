// Fremdtext, der ins DOM geht.
//
// Fast die ganze Oberflaeche wird ueber Vorlagen-Zeichenketten und innerHTML
// aufgebaut. Jeder Text, den nicht dieser Code selbst erzeugt hat, muss
// deshalb maskiert werden: Namen aus der config.json, eigene Zeilen aus der
// stimme.json, Notizen aus der bibliothek.json — und vor allem, was von
// intervals.icu kommt. Ein Aktivitaetsname wird dort von Strava, Zwift oder
// einer Gruppenfahrt gesetzt, nicht von dir.
//
// Der Ernstfall ist konkret: ohne Maskierung wird aus einem Aktivitaetsnamen
// ausfuehrbarer Code, und der laeuft auf derselben Herkunft wie der
// GitHub-Token und der intervals.icu-Key im localStorage.

/** Die fuenf Zeichen, mit denen man aus Text HTML machen kann. */
export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Adresse fuer ein href. Nur http und https kommen durch — ein selbst
 * eingetragener Link der Form javascript:… wuerde beim Antippen Code
 * ausfuehren, und "es ist ja mein eigenes Repo" ist keine Zusicherung,
 * sondern eine Annahme.
 *
 * Gibt '' zurueck, wenn nichts Brauchbares uebrig bleibt — der Aufrufer
 * entscheidet dann, was stattdessen dasteht.
 */
export function sicherLink(url, basis) {
  const roh = String(url ?? '').trim();
  if (!roh) return '';
  try {
    const u = new URL(roh, basis || (typeof location !== 'undefined' ? location.href : 'https://example.invalid/'));
    if (u.protocol === 'http:' || u.protocol === 'https:') return escHtml(u.href);
  } catch { /* keine gueltige Adresse */ }
  return '';
}
