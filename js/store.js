// GitHub-API als Datenspeicher. Einziger I/O-Layer der App.
// Schreibt Klartext-JSON ins private Repo — jede Einheit wird ein Commit.

const API = 'https://api.github.com';
const TOKEN_KEY = 'lifty.token';
const QUEUE_KEY = 'lifty.queue';
const CACHE_KEY = 'lifty.cache';
const LOGS_KEY = 'lifty.logs';

export const OWNER = 'cyphomat';
export const REPO = 'lifty-data';

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
    const wo = path.split('?')[0].replace(`/repos/${OWNER}/${REPO}/contents`, '');
    throw new Error(`Keine Verbindung zu GitHub${wo ? ` (${wo})` : ''} — ${navigator.onLine ? 'Server nicht erreichbar' : 'Gerät ist offline'}.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Token ungültig oder ohne Schreibrecht auf lifty-data.');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 140)}`);
  return res.json();
}

/** Datei lesen. Gibt { data, sha } oder null zurueck. */
export async function readFile(path) {
  const j = await api(`/repos/${OWNER}/${REPO}/contents/${path}?ref=main`);
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
  return api(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

/** Alle Log-Dateien laden — nur fuer die Neuberechnung. */
export async function readAllLogs() {
  const list = await api(`/repos/${OWNER}/${REPO}/contents/log?ref=main`);
  if (!Array.isArray(list)) return [];
  const files = list.filter(f => f.name.endsWith('.json') && f.name !== '.gitkeep');
  const out = [];
  for (const f of files) {
    const r = await readFile(`log/${f.name}`);
    if (r) out.push(r.data);
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
