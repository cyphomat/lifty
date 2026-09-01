// Was steht dir gerade zur Verfuegung?
//
// Ein Jam daheim scheitert nicht an der Motivation, sondern daran, dass der
// Generator Rudergeraet und Langhantel auswirft, die im Wohnzimmer nicht
// stehen. Deshalb kennt die App Orte ("Gyms") mit jeweils eigener
// Ausstattung — und zieht nur aus dem, was dort tatsaechlich da ist.
//
// Voreinstellung ist bewusst "alles an": wer nichts einrichtet, bekommt
// genau das Verhalten von vorher. Die Einschraenkung ist eine Entscheidung,
// die man trifft, keine, in die man hineinstolpert.

export const GERAETE = [
  { id: 'langhantel',     name: 'Langhantel und Scheiben' },
  { id: 'kurzhantel',     name: 'Kurzhanteln' },
  { id: 'kettlebell',     name: 'Kettlebell' },
  { id: 'klimmzugstange', name: 'Klimmzugstange' },
  { id: 'latzug',         name: 'Latzug' },
  { id: 'box',            name: 'Sprungbox' },
  { id: 'wandball',       name: 'Medizinball und freie Wand' },
  { id: 'springseil',     name: 'Springseil' },
  { id: 'battlerope',     name: 'Battle Ropes' },
  { id: 'rudergeraet',    name: 'Rudergerät' },
  { id: 'bikeerg',        name: 'Bike Erg' },
  { id: 'assaultbike',    name: 'Assault Bike' }
];

export const ALLE_GERAETE = GERAETE.map(g => g.id);
const BEKANNT = new Set(ALLE_GERAETE);

/** Anzeigename zu einer Kennung — unbekannte Kennung bleibt sichtbar. */
export function geraetName(id) {
  const g = GERAETE.find(x => x.id === id);
  return g ? g.name : id;
}

/**
 * Vorschlaege beim ersten Einrichten. Bewusst keine Wahrheit, sondern ein
 * Startpunkt: drei Orte, wie man sie typischerweise hat, jeweils grob
 * ausgestattet. Danach hakt man selbst an und ab.
 */
export function vorlagen() {
  return [
    { id: 'home', name: 'Homegym',
      geraete: ['kurzhantel', 'kettlebell', 'springseil'] },
    { id: 'box', name: 'Crossfit Box', geraete: [...ALLE_GERAETE] },
    { id: 'studio', name: 'Studio',
      geraete: ['langhantel', 'kurzhantel', 'kettlebell', 'klimmzugstange',
                'latzug', 'box', 'rudergeraet', 'assaultbike'] }
  ];
}

/**
 * Die eingerichteten Orte aus der Konfiguration, defensiv gelesen: die
 * config.json wird von Hand gepflegt, ein kaputter Eintrag darf nicht den
 * Jam-Generator mitreissen. Ohne Eintrag kommt eine leere Liste zurueck —
 * "nichts eingerichtet" heisst dann an anderer Stelle "alles verfuegbar".
 */
export function gyms(config) {
  const roh = config && config.gyms;
  if (!Array.isArray(roh)) return [];
  return roh
    .filter(g => g && typeof g.id === 'string' && g.id.trim())
    .map(g => ({
      id: g.id.trim(),
      name: (typeof g.name === 'string' && g.name.trim()) || g.id.trim(),
      // Unbekannte Kennungen fliegen raus statt Uebungen stumm zu blockieren.
      geraete: Array.isArray(g.geraete) ? [...new Set(g.geraete.filter(x => BEKANNT.has(x)))] : []
    }));
}

/** Der Ort zu einer Kennung, oder null fuer "kein bestimmter Ort". */
export function gym(config, id) {
  if (!id) return null;
  return gyms(config).find(g => g.id === id) || null;
}

/**
 * Welche Geraete gelten gerade? Ohne gewaehlten Ort — und ebenso bei einem
 * Ort, den es nicht mehr gibt — zaehlt alles. Lieber ein Workout, das man
 * nicht komplett machen kann, als ein leerer Bildschirm.
 */
export function aktiveGeraete(config, gymId) {
  const g = gym(config, gymId);
  return g ? g.geraete : [...ALLE_GERAETE];
}

/** Braucht die Bewegung nur Dinge, die da sind? */
export function machbar(move, geraete) {
  const noetig = move.geraete || [];
  if (!noetig.length) return true;              // reines Koerpergewicht
  return noetig.every(n => geraete.includes(n));
}

/** Alles, was an diesem Ort geht. */
export function machbare(moves, geraete) {
  return moves.filter(m => machbar(m, geraete));
}

/**
 * Neuen Ort anlegen. Startet mit voller Ausstattung — abhaken ist schneller
 * als alles einzeln anklicken, und "alles an" ist der sichere Ausgangspunkt.
 */
export function neuerGym(name, vorhandene = []) {
  const basis = (name || 'gym').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gym';
  const belegt = new Set(vorhandene.map(g => g.id));
  let id = basis, n = 2;
  while (belegt.has(id)) id = `${basis}-${n++}`;
  return { id, name: name || 'Neuer Ort', geraete: [...ALLE_GERAETE] };
}

/**
 * Darf dieser Entwurf die Orte im Repo ersetzen?
 *
 * Der Fall, den es zu verhindern gilt: der Entwurf ist leer, weil er
 * entstanden ist, bevor die Konfiguration geladen war — und ueberschreibt
 * beim Speichern die echten Orte. Genau so sind schon einmal Orte
 * verlorengegangen.
 *
 * Ein ausdrueckliches Loeschen aller Orte muss trotzdem durchgehen. Zu
 * unterscheiden sind die beiden nur ueber `geaendert`: hat der Mensch etwas
 * angefasst, ist ein leerer Entwurf sein Wille; hat er nichts angefasst,
 * ist er ein Fehler.
 */
export function darfSpeichern(entwurf, imRepo, geaendert) {
  if (!Array.isArray(entwurf)) return false;
  if (entwurf.length) return true;                  // etwas da: immer gut
  if (!Array.isArray(imRepo) || !imRepo.length) return true;  // nichts zu verlieren
  return !!geaendert;                               // leer gegen belegt: nur bewusst
}
