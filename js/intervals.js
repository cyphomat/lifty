// intervals.icu: liest die Ist-Daten fuer die Radeinheiten.
// Wir schreiben dort nichts — Zwift -> Strava -> intervals.icu laeuft von allein.
//
// Zugangsdaten liegen ausschliesslich im localStorage dieses Browsers,
// niemals im Repo. Deshalb taucht hier kein Schluessel im Code auf.

const BASE = 'https://intervals.icu/api/v1';
const KEY_ID = 'setlist.icu.athlete';
const KEY_TOKEN = 'setlist.icu.key';
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

/**
 * Dieselbe Fahrt kann zweimal in intervals.icu landen, wenn zwei Wege
 * dorthin fuehren — Zwift -> Strava und daneben Apple Health -> HealthFit.
 * Die Kopien tragen verschiedene Kennungen und leicht verschiedene Zeiten,
 * sind aber dieselbe Stunde auf dem Rad. Ungefiltert verdoppeln sie
 * Kilometer, Stunden und Wochenlast: jeder Graph waere dann Fiktion.
 */

/** Zeitfenster einer Fahrt in Millisekunden, oder null ohne Uhrzeit. */
function fenster(f) {
  const start = f.zeit ? new Date(f.zeit).getTime() : NaN;
  if (isNaN(start)) return null;
  return [start, start + Math.max(f.minutes || 0, 1) * 60000];
}

/**
 * Zwei Fahrten sind dieselbe, wenn sich ihre Zeitfenster zur Haelfte der
 * kuerzeren ueberlappen. Ueber die Uhrzeit statt ueber den Tag, weil zwei
 * echte Fahrten an einem Tag erhalten bleiben muessen — und ueber die
 * Ueberlappung statt ueber die exakte Startzeit, weil die Quellen um
 * Minuten auseinanderliegen (45 Min bei Zwift, 46 in Apple Health).
 */
export function selbeFahrt(a, b) {
  const fa = fenster(a), fb = fenster(b);
  if (!fa || !fb) return false;   // ohne Uhrzeit wird nicht geraten
  const ueberlappung = Math.min(fa[1], fb[1]) - Math.max(fa[0], fb[0]);
  if (ueberlappung <= 0) return false;
  return ueberlappung >= Math.min(fa[1] - fa[0], fb[1] - fb[0]) / 2;
}

/**
 * Wie viel eine Fahrt hergibt. Die reichere Kopie gewinnt: die Zwift-Fassung
 * mit Watt und Trainingslast, nicht der nackte Health-Eintrag ohne beides.
 * Ohne Last stuft `coach.interferenz` eine harte Fahrt als locker ein.
 */
function reichtum(f) {
  return (f.load ? 4 : 0) + (f.km ? 2 : 0) + (f.minutes ? 1 : 0);
}

/**
 * Doppelte Fahrten zusammenfassen. Die verworfenen Kennungen bleiben unter
 * `doppel` stehen — verschwiegen wird nichts, die App sagt es im Status.
 */
export function entdoppeln(fahrten = []) {
  const behalten = [];
  const nachReichtum = [...fahrten].sort(
    (a, b) => reichtum(b) - reichtum(a) || (b.minutes || 0) - (a.minutes || 0));

  for (const f of nachReichtum) {
    const treffer = behalten.find(g => selbeFahrt(f, g));
    if (treffer) (treffer.doppel = treffer.doppel || []).push(f.id);
    else behalten.push({ ...f });
  }
  return behalten.sort(
    (a, b) => String(a.zeit || a.date).localeCompare(String(b.zeit || b.date)));
}

/** Radaktivitaeten in einem Zeitraum, auf das Noetige reduziert. */
export async function rides(from, to) {
  const id = localStorage.getItem(KEY_ID);
  if (!id) return [];
  const list = await get(`/athlete/${id}/activities?oldest=${from}&newest=${to}`);
  if (!Array.isArray(list)) return [];
  return entdoppeln(list
    .filter(a => RIDE_TYPES.includes(a.type))
    .map(a => ({
      id: a.id,
      external_id: a.external_id || null,
      date: (a.start_date_local || '').slice(0, 10),
      // Uhrzeit wird gebraucht: der Abstand zwischen Fahrt und Eisen
      // entscheidet, ob sich die beiden ins Gehege kommen.
      zeit: a.start_date_local || null,
      name: a.name || 'Fahrt',
      minutes: Math.round((a.moving_time || 0) / 60),
      km: Math.round((a.distance || 0) / 100) / 10,
      load: a.icu_training_load || null,
      // Ab hier die Felder fuer die Auswertung. Namen sind nicht geraten,
      // sondern aus dem Schema unter /api/v1/docs (Activity) gelesen: es
      // heisst `icu_average_watts`, ein `average_watts` gibt es nicht.
      intensitaet: a.icu_intensity != null ? a.icu_intensity : null,
      np: a.icu_weighted_avg_watts || null,
      watt: a.icu_average_watts || null,
      hf: a.average_heartrate || null,
      hfMax: a.max_heartrate || null,
      effizienz: a.icu_efficiency_factor != null ? a.icu_efficiency_factor : null,
      entkopplung: a.decoupling != null ? a.decoupling : null,
      // Wie viele Minuten zusammenhaengende Grundlage hinter dem
      // Leistung:HF-Wert stehen. Das ist die Stichprobengroesse der
      // Entkopplung — ohne sie waere jede Kurve daraus geraten.
      pwhr: a.icu_power_hr_z2 != null ? a.icu_power_hr_z2 : null,
      pwhrMin: a.icu_power_hr_z2_mins || 0,
      ftpDamals: a.icu_ftp || null,
      trainer: !!a.trainer,
      // {id, secs} je Zone. Nur die belegten, sonst blaeht das den
      // Zwischenspeicher fuer nichts auf.
      zonen: Array.isArray(a.icu_zone_times)
        ? a.icu_zone_times.filter(z => z && z.secs).map(z => ({ id: z.id, secs: z.secs }))
        : null
    })));
}

/** Wellness-Daten: Gewicht, Fitness (ctl), Ermuedung (atl), HRV und Schlaf. */
export async function wellness(from, to) {
  const id = localStorage.getItem(KEY_ID);
  if (!id) return [];
  const list = await get(`/athlete/${id}/wellness?oldest=${from}&newest=${to}`);
  if (!Array.isArray(list)) return [];
  return list.map(w => ({
    date: w.id,
    weight: w.weight || null,
    eftp: w.eftp || null,
    ctl: w.ctl != null ? w.ctl : null,
    atl: w.atl != null ? w.atl : null,
    restingHR: w.restingHR || null,
    // hrv kommt bei Apple-Health-Quellen (z.B. via HealthFit) als SDNN in ms.
    hrv: w.hrv != null ? w.hrv : null,
    sleepSecs: w.sleepSecs != null ? w.sleepSecs : null
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
    external_id: `setlist-${log.date}-${log.type || 'strength'}${log.workout ? '-' + log.workout : ''}`,
    start_date_local: lokalIso(start),
    type: istWod ? 'Crossfit' : 'WeightTraining',
    name: istWod ? `WOD — ${log.label || ''}`.trim() : `Kraft — Workout ${log.workout || ''}`.trim(),
    moving_time: dauerSek,
    elapsed_time: dauerSek,
    icu_training_load: last,
    description: `${beschreibung}\n\nAus Setlist übertragen. Trainingslast geschätzt aus der Dauer (${Math.round(minuten)} Min).`
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

const PUSH_KEY = 'setlist.icu.push';
/**
 * An, solange nicht ausdruecklich abgeschaltet. Daniel hat die Uebertragung
 * freigegeben; ein Schalter, den man erst suchen muss, wuerde die Funktion
 * faktisch totlegen.
 */
export function pushAktiv() {
  const v = localStorage.getItem(PUSH_KEY);
  return v === null ? true : v === '1';
}
export function setPushAktiv(an) { localStorage.setItem(PUSH_KEY, an ? '1' : '0'); }

const QUEUE_KEY = 'setlist.icu.pendingPush';
/**
 * Einheiten, die beim Abschluss noch nicht geprueft werden konnten — siehe
 * schonErfasst: direkt nach dem Training hat die Apple Watch ihre eigene
 * Aktivitaet meist noch gar nicht ueber Strava nachgereicht, ein sofortiger
 * Abgleich waere blind. Die Warteschlange wird erst beim naechsten
 * App-Start abgearbeitet, wenn genug Zeit vergangen ist.
 */
export function pendingPush() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
export function queuePush(log) {
  const q = pendingPush();
  q.push(log);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
export function clearPushQueue(rest) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
}

/* ---------------------------------------------------------------
   Geplante Einheiten in den Kalender. `external_id` greift laut Doku
   nur fuer dieselbe OAuth-Anwendung — mit einem API-Key ist darauf
   kein Verlass. Deshalb wird vorher gelesen, was schon dasteht, statt
   blind zu schreiben: doppelte Eintraege im eigenen Kalender sind
   aergerlicher als ein fehlender.                                   */

/** Vorhandene Kalendereintraege im Zeitraum. */
export async function events(from, to) {
  const id = localStorage.getItem(KEY_ID);
  if (!id) return [];
  const list = await get(`/athlete/${id}/events?oldest=${from}&newest=${to}`);
  return Array.isArray(list) ? list : [];
}

/** Ein geplanter Slot als Kalendereintrag. Rein, damit testbar. */
export function alsEvent(slot, config = {}) {
  if (!slot || !slot.date) return null;
  const rad = slot.type === 'ride';
  return {
    category: 'WORKOUT',
    start_date_local: `${slot.date}T00:00:00`,
    type: rad ? 'Ride' : 'WeightTraining',
    name: rad ? slot.label : `Kraft — Workout ${slot.workout || ''}`.trim(),
    description: [slot.detail, slot.watt ? `Ziel: ${slot.watt}` : '', 'Geplant in Setlist.']
      .filter(Boolean).join('\n'),
    external_id: `setlist-plan-${slot.date}-${slot.type}`
  };
}

/**
 * Was von den geplanten Eintraegen noch fehlt. Abgleich ueber external_id
 * und ersatzweise ueber Datum plus **Typ** — nicht ueber den Namen: der
 * darf sich aendern (eine andere Radeinheit rotiert herein, eine Uebung
 * kommt dazu), ohne dass daraus ein zweiter Eintrag fuer denselben Tag
 * werden darf. Der Preis ist, dass ein fremder Eintrag gleichen Typs am
 * selben Tag unseren verhindert. Das ist der bessere Tausch: ein fehlender
 * Plan faellt auf, ein doppelter verschmutzt den Kalender still.
 */
export function fehlendeEvents(geplant, vorhanden = []) {
  const kennungen = new Set(vorhanden.map(e => e.external_id).filter(Boolean));
  const paare = new Set(vorhanden.map(e => `${(e.start_date_local || '').slice(0, 10)}|${e.type || ''}`));
  return geplant.filter(e =>
    !kennungen.has(e.external_id) &&
    !paare.has(`${e.start_date_local.slice(0, 10)}|${e.type}`));
}

/** Mehrere Kalendereintraege auf einmal anlegen. */
export async function pushEvents(liste) {
  if (!liste.length) return [];
  const id = localStorage.getItem(KEY_ID);
  const key = localStorage.getItem(KEY_TOKEN);
  if (!id || !key) throw new Error('intervals.icu ist nicht verbunden.');
  const res = await fetch(`${BASE}/athlete/${id}/events/bulk`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa('API_KEY:' + key), 'Content-Type': 'application/json' },
    body: JSON.stringify(liste)
  });
  if (res.status === 401 || res.status === 403) throw new Error('intervals.icu: Key ohne Schreibrecht.');
  if (!res.ok) throw new Error(`intervals.icu ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/** Analog fuer Aktivitaeten: was von den Einheiten dort noch fehlt. */
export function fehlendeAktivitaeten(geplant, vorhanden = []) {
  const kennungen = new Set(vorhanden.map(a => a.external_id).filter(Boolean));
  const paare = new Set(vorhanden.map(a => `${(a.start_date_local || a.zeit || '').slice(0, 10)}|${a.name || ''}`));
  return geplant.filter(a =>
    !kennungen.has(a.external_id) &&
    !paare.has(`${a.start_date_local.slice(0, 10)}|${a.name}`));
}

/** Alle Aktivitaeten im Zeitraum, ungefiltert — fuer den Abgleich. */
export async function alleAktivitaeten(from, to) {
  const id = localStorage.getItem(KEY_ID);
  if (!id) return [];
  const list = await get(`/athlete/${id}/activities?oldest=${from}&newest=${to}`);
  return Array.isArray(list) ? list : [];
}

/**
 * Ob rund um die Sessionzeit schon eine fremde Aktivitaet existiert —
 * typischerweise die automatische Trainingserkennung der Apple Watch
 * ueber die Herzfrequenz, die selbststaendig ueber Strava nach
 * intervals.icu laeuft. Dann nicht zusaetzlich pushen: sonst zaehlt
 * dieselbe Einheit doppelt in Fitness und Ermuedung.
 */
export function schonErfasst(log, vorhanden = []) {
  if (!log || !log.started || !log.finished) return false;
  const start = new Date(log.started).getTime();
  const ende = new Date(log.finished).getTime();
  const spielraum = 30 * 60 * 1000;
  return vorhanden.some(a => {
    if ((a.external_id || '').startsWith('setlist-')) return false;
    const t = new Date(a.start_date_local || '').getTime();
    return Number.isFinite(t) && t >= start - spielraum && t <= ende + spielraum;
  });
}
