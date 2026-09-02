// Buendelt alle Uebungen aus den bestehenden Inhaltsquellen (Grundlifts,
// Technik, Mobility, Finisher, Jam-Bewegungen) zu einer durchsuchbaren
// Liste. Reine Funktionen aus config/state — Notizen und eigene Videos
// kommen erst in app.js dazu, das haelt diese Datei ohne I/O und testbar.

import { LIFT_INFO, SKILL, MOBILITY, FINISHER } from './content.js';
import { MOVES } from './wod.js';

export const KATEGORIEN = ['Kraft', 'Technik', 'Mobility', 'Finisher', 'Jam'];

/** Alle Uebungen, normalisiert auf eine gemeinsame Form, alphabetisch. */
export function alleUebungen(config = {}, state = {}) {
  const liste = [];

  for (const [id, def] of Object.entries(LIFT_INFO)) {
    const konfig = (config.lifts && config.lifts[id]) || {};
    const lift = state.lifts && state.lifts[id];
    liste.push({
      id: `lift:${id}`,
      kategorie: 'Kraft',
      name: konfig.name || def.tag,
      dosis: '5×5',
      info: def.warum,
      cue: def.cue,
      fehler: def.fehler,
      // Die Korrektur steht in der Bibliothek immer, unabhaengig von
      // Fehlversuchen: hier schlaegt man bewusst nach. In der laufenden
      // Einheit erscheint sie nur, wenn wirklich etwas offen ist.
      korrektur: def.korrektur || null,
      quelle: (def.korrektur && def.korrektur.quelle) || def.quelle || null,
      aktuell: lift ? `${lift.weight} kg Arbeitsgewicht` : null
    });
  }
  for (const s of SKILL) {
    liste.push({ id: `skill:${s.id}`, kategorie: 'Technik', name: s.name, dosis: s.dosis, info: s.warum, cue: null, fehler: s.fehler || null, korrektur: null, quelle: s.quelle || null, aktuell: null });
  }
  for (const m of MOBILITY) {
    liste.push({ id: `mobility:${m.id}`, kategorie: 'Mobility', name: m.name, dosis: m.dosis, info: m.warum, cue: null, fehler: null, korrektur: null, quelle: m.quelle || null, aktuell: null });
  }
  for (const f of FINISHER) {
    liste.push({ id: `finisher:${f.id}`, kategorie: 'Finisher', name: f.name, dosis: f.dosis, info: f.warum, cue: null, fehler: null, korrektur: null, quelle: f.quelle || null, aktuell: null });
  }
  for (const w of MOVES) {
    const einheit = w.einheit || 'Wdh';
    liste.push({
      id: `wod:${w.id}`, kategorie: 'Jam', name: w.name,
      dosis: `${w.reps[0]}–${w.reps[1]} ${einheit}`,
      info: w.erklaerung, cue: w.cue, fehler: null, korrektur: null, quelle: null, aktuell: null
    });
  }

  return liste.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Volltextsuche ueber Name, Erklaerung, Cue, Fehler und die Korrekturen.
 * Letztere gehoeren dazu, weil man eine Uebung auch ueber ihr Problem sucht:
 * wer "Lockout" eingibt, will den Strict Press finden.
 */
export function suche(liste, query = '', kategorie = null) {
  const q = query.trim().toLowerCase();
  const k = u => u.korrektur
    ? [u.korrektur.wenn, u.korrektur.warum, ...u.korrektur.uebungen.map(x => x.name)] : [];
  const treffer = u => [u.name, u.info, u.cue, u.fehler, ...k(u)]
    .some(t => t && t.toLowerCase().includes(q));
  return liste.filter(u => (!kategorie || u.kategorie === kategorie) && (!q || treffer(u)));
}

/** Zufaellige Uebung aus der Liste — rng austauschbar, damit testbar. */
export function zufaellig(liste, rng = Math.random) {
  if (!liste.length) return null;
  return liste[Math.floor(rng() * liste.length)];
}

/**
 * Verlinkt eine YouTube-Suche statt eines geratenen Videos. Ein einzelnes
 * fest verdrahtetes Video koennte offline, falsch oder schlecht sein —
 * die Trefferliste stimmt garantiert, und ein eigener Link (siehe Notiz)
 * kann das jederzeit ersetzen.
 */
export function youtubeSuche(name) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' Übung Technik')}`;
}
