// GitHub-API als Datenspeicher. Einziger I/O-Layer der App.
// Schreibt Klartext-JSON ins private Repo — jede Einheit wird ein Commit.

const API = 'https://api.github.com';
const TOKEN_KEY = 'setlist.token';
const QUEUE_KEY = 'setlist.queue';
const CACHE_KEY = 'setlist.cache';
const LOGS_KEY = 'setlist.logs';

const OWNER_KEY = 'setlist.owner';
const REPO_KEY = 'setlist.repo';
// Fallback fuer Installationen von vor dieser Funktion: kein setlist.owner
// im localStorage bedeutet "die urspruengliche, fest verdrahtete Instanz".
// Wer neu einrichtet, tippt im Setup-Screen sein eigenes Repo ein — dieser
// Fallback greift dann nie, weil setRepo() sofort etwas Eigenes speichert.
const STANDARD_OWNER = 'cyphomat';
const STANDARD_REPO = 'setlist-data';

export function getOwner() { return localStorage.getItem(OWNER_KEY) || STANDARD_OWNER; }
export function getRepo() { return localStorage.getItem(REPO_KEY) || STANDARD_REPO; }
export function setRepo(owner, repo) {
  localStorage.setItem(OWNER_KEY, (owner || '').trim());
  localStorage.setItem(REPO_KEY, (repo || '').trim() || STANDARD_REPO);
}
export function clearRepo() {
  localStorage.removeItem(OWNER_KEY);
  localStorage.removeItem(REPO_KEY);
}

// Bewusst nicht "log": Inhaltsblocker, Netzwerkfilter und Firmen-WLANs
// verwerfen Adressen mit diesem Wegstueck regelmaessig, weil dort sonst
// Tracking-Daten abfliessen. Der Ordner heisst deshalb neutral.
export const LOG_DIR = 'einheiten';

export function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t.trim()); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

async function api(path, options = {}, versuch = 1) {
  let res;
  try {
    res = await fetch(API + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {})
      }
    });
  } catch (e) {
    // Safari meldet abgebrochene Anfragen als "Load failed". Das passiert auf
    // iOS regelmaessig bei der ersten Anfrage, nachdem die App aus dem
    // Hintergrund aufgeweckt wurde — ein zweiter Versuch geht fast immer durch.
    if (versuch < 3) {
      await new Promise(r => setTimeout(r, 400 * versuch));
      return api(path, options, versuch + 1);
    }
    const wo = path.split('?')[0].replace(`/repos/${getOwner()}/${getRepo()}/contents`, '');
    throw new Error(`Keine Verbindung zu GitHub${wo ? ` (${wo})` : ''} — ${navigator.onLine ? 'Server nicht erreichbar' : 'Gerät ist offline'}.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Token ungültig oder ohne Schreibrecht auf ${getRepo()}.`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 140)}`);
  return res.json();
}

/**
 * Sichtbarkeit des Datenrepos. Die App schreibt jede Einheit, jedes
 * Koerpergewicht und jede Notiz dorthin — steht das Repo auf oeffentlich,
 * liest das die ganze Welt mit, und niemand merkt es, weil die App sonst
 * genauso funktioniert. Deshalb wird gefragt statt angenommen.
 *
 * Gibt null zurueck, wenn es sich nicht feststellen laesst (kein Netz, kein
 * Leserecht auf die Metadaten). Unbekannt ist nicht dasselbe wie oeffentlich.
 */
export async function repoOeffentlich() {
  try {
    const j = await api(`/repos/${getOwner()}/${getRepo()}`);
    if (!j || typeof j.private !== 'boolean') return null;
    return !j.private;
  } catch {
    return null;
  }
}

/** Datei lesen. Gibt { data, sha } oder null zurueck. */
export async function readFile(path) {
  const j = await api(`/repos/${getOwner()}/${getRepo()}/contents/${path}?ref=main`);
  if (!j || !j.content) return null;
  return { data: JSON.parse(b64decode(j.content)), sha: j.sha };
}

/** Datei schreiben. sha weglassen heisst "neu anlegen". */
export async function writeFile(path, data, message, sha) {
  const body = {
    message,
    content: b64encode(JSON.stringify(data, null, 2) + '\n'),
    branch: 'main'
  };
  if (sha) body.sha = sha;
  return api(`/repos/${getOwner()}/${getRepo()}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

/**
 * Alle Einheiten laden — ueber die Git-Trees-API statt ueber das
 * Verzeichnislisting. Zwei Gruende: es ist eine Anfrage statt einer pro
 * Datei, und die Adresse enthaelt kein Wegstueck, an dem Filter haengen.
 * Der alte Ordnername wird mitgelesen, damit nichts verloren geht.
 */
export async function readAllLogs() {
  const tree = await api(`/repos/${getOwner()}/${getRepo()}/git/trees/main?recursive=1`);
  if (!tree || !Array.isArray(tree.tree)) return [];
  const dateien = tree.tree.filter(f =>
    f.type === 'blob' && f.path.endsWith('.json') &&
    (f.path.startsWith(`${LOG_DIR}/`) || f.path.startsWith('log/')));

  const out = [];
  for (const f of dateien) {
    const blob = await api(`/repos/${getOwner()}/${getRepo()}/git/blobs/${f.sha}`);
    if (!blob || !blob.content) continue;
    try { out.push(JSON.parse(b64decode(blob.content))); }
    catch { /* eine kaputte Datei darf nicht den ganzen Verlauf kippen */ }
  }
  return out;
}

/* ---------- Offline-Puffer ----------
   Im Studio ist der Empfang schlecht. Eine fertige Einheit darf niemals
   verloren gehen, nur weil gerade kein Netz da ist.                      */

export function queue(entry) {
  const q = pending();
  q.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
export function pending() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
export function clearQueue() { localStorage.removeItem(QUEUE_KEY); }

/* ---------- Lesecache ----------
   Damit die App auch ohne Netz sofort anzeigt, was heute ansteht.        */

export function cache(obj) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cached(), ...obj }));
}
export function cached() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}

/* ---------- Zuletzt geladene Einheiten ----------
   Damit der Verlauf auch ohne Netz etwas zeigt statt einer Fehlermeldung.  */

export function cacheLogs(logs) {
  try { localStorage.setItem(LOGS_KEY, JSON.stringify({ zeit: Date.now(), logs })); }
  catch { /* Speicher voll — nicht kritisch */ }
}
export function cachedLogs() {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY) || 'null'); }
  catch { return null; }
}
