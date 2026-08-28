// intervals.icu: liest die Ist-Daten fuer die Radeinheiten.
// Wir schreiben dort nichts — Zwift -> Strava -> intervals.icu laeuft von allein.
//
// Zugangsdaten liegen ausschliesslich im localStorage dieses Browsers,
// niemals im Repo. Deshalb taucht hier kein Schluessel im Code auf.

const BASE = 'https://intervals.icu/api/v1';
const KEY_ID = 'lifty.icu.athlete';
const KEY_TOKEN = 'lifty.icu.key';
const RIDE_TYPES = ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide'];

export function setCreds(athleteId, apiKey) {
  localStorage.setItem(KEY_ID, (athleteId || '').trim());
  localStorage.setItem(KEY_TOKEN, (apiKey || '').trim());
}
export function clearCreds() {
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_TOKEN);
}
export function isConfigured() {
  return !!localStorage.getItem(KEY_TOKEN);
}

async function get(path) {
  const key = localStorage.getItem(KEY_TOKEN);
  if (!key) return null;
  const res = await fetch(BASE + path, {
    headers: { Authorization: 'Basic ' + btoa('API_KEY:' + key) }
  });
  if (res.status === 401 || res.status === 403) throw new Error('intervals.icu: Key ungültig.');
  if (!res.ok) throw new Error(`intervals.icu ${res.status}`);
  return res.json();
}

/** Athleten-ID aus dem Key aufloesen, damit du sie nicht selbst suchen musst. */
export async function resolveAthlete() {
  const me = await get('/athlete/0');
  if (me && me.id) {
    localStorage.setItem(KEY_ID, me.id);
    return { id: me.id, name: me.name || me.firstname || '' };
  }
  return null;
}

/** Radaktivitaeten in einem Zeitraum, auf das Noetige reduziert. */
export async function rides(from, to) {
  const id = localStorage.getItem(KEY_ID);
  if (!id) return [];
  const list = await get(`/athlete/${id}/activities?oldest=${from}&newest=${to}`);
  if (!Array.isArray(list)) return [];
  return list
    .filter(a => RIDE_TYPES.includes(a.type))
    .map(a => ({
      id: a.id,
      date: (a.start_date_local || '').slice(0, 10),
      name: a.name || 'Fahrt',
      minutes: Math.round((a.moving_time || 0) / 60),
      km: Math.round((a.distance || 0) / 100) / 10,
      load: a.icu_training_load || null
    }));
}

/** Wellness-Daten: Gewicht, Fitness (ctl) und Ermuedung (atl). */
export async function wellness(from, to) {
  const id = localStorage.getItem(KEY_ID);
  if (!id) return [];
  const list = await get(`/athlete/${id}/wellness?oldest=${from}&newest=${to}`);
  if (!Array.isArray(list)) return [];
  return list.map(w => ({
    date: w.id,
    weight: w.weight || null,
    ctl: w.ctl != null ? w.ctl : null,
    atl: w.atl != null ? w.atl : null,
    restingHR: w.restingHR || null
  }));
}

/** Der juengste Eintrag mit Fitness- und Ermuedungswert. */
export function letzteForm(records = []) {
  return [...records]
    .filter(w => w.ctl != null && w.atl != null)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

/* ---------------------------------------------------------------
   Krafteinheiten nach intervals.icu schreiben. Damit liegt die
   gesamte Trainingslast in einer Kurve statt in zwei Welten.
   Die Umrechnung ist rein und getestet — sie schreibt in ein
   fremdes Konto, da will man nicht raten.                         */

const STANDARD_LAST = { strength: 0.8, wod: 1.4 };

/** Ortszeit als ISO ohne Zeitzone, so erwartet es intervals.icu. */
function lokalIso(d) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` +
         `T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

/**
 * Log -> Aktivitaet. Gibt null zurueck, wenn keine Dauer bekannt ist:
 * ohne Dauer laesst sich keine ehrliche Last angeben, und eine
 * erfundene waere schlimmer als ein fehlender Eintrag.
 */
export function alsAktivitaet(log, config = {}) {
  if (!log || (log.type && log.type !== 'strength' && log.type !== 'wod')) return null;

  const faktor = (config.intervals && config.intervals.loadProMinute) || STANDARD_LAST;
  const dauerSek = log.dauerSekunden ||
    (log.started && log.finished
      ? Math.round((new Date(log.finished) - new Date(log.started)) / 1000)
      : 0);
  if (!dauerSek || dauerSek < 60) return null;

  const istWod = log.type === 'wod';
  const minuten = dauerSek / 60;
  const last = Math.max(1, Math.round(minuten * (istWod ? faktor.wod : faktor.strength)));
  const start = log.started ? new Date(log.started) : new Date(`${log.date}T18:00:00`);

  const beschreibung = istWod
    ? (log.label || 'WOD')
    : (log.lifts || []).map(e => {
        const name = (config.lifts && config.lifts[e.lift] && config.lifts[e.lift].name) || e.lift;
        return `${name} ${e.weight} kg — ${(e.reps || []).join('/')}`;
      }).join('\n');

  return {
    external_id: `lifty-${log.date}-${log.type || 'strength'}${log.workout ? '-' + log.workout : ''}`,
    start_date_local: lokalIso(start),
    type: istWod ? 'Crossfit' : 'WeightTraining',
    name: istWod ? `WOD — ${log.label || ''}`.trim() : `Kraft — Workout ${log.workout || ''}`.trim(),
    moving_time: dauerSek,
    elapsed_time: dauerSek,
    icu_training_load: last,
    description: `${beschreibung}\n\nAus lifty übertragen. Trainingslast geschätzt aus der Dauer (${Math.round(minuten)} Min).`
  };
}

/** Aktivitaet anlegen. Wirft bei Fehlern — der Aufrufer entscheidet. */
export async function pushAktivitaet(aktivitaet) {
  const id = localStorage.getItem(KEY_ID);
  const key = localStorage.getItem(KEY_TOKEN);
  if (!id || !key) throw new Error('intervals.icu ist nicht verbunden.');

  const res = await fetch(`${BASE}/athlete/${id}/activities/manual`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa('API_KEY:' + key),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(aktivitaet)
  });
  if (res.status === 401 || res.status === 403) throw new Error('intervals.icu: Key ohne Schreibrecht.');
  if (!res.ok) throw new Error(`intervals.icu ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

const PUSH_KEY = 'lifty.icu.push';
export function pushAktiv() { return localStorage.getItem(PUSH_KEY) === '1'; }
export function setPushAktiv(an) { localStorage.setItem(PUSH_KEY, an ? '1' : '0'); }
