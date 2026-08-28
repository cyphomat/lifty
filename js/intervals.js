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
