// Aufnahmen fuer die README — die Fassung mit abgefangener GitHub-API.
//
// tools/shot.html reicht fuer alles, was aus dem Zwischenspeicher lebt. Ein
// paar Bildschirme haengen aber daran, was die API *antwortet*: der
// Einrichte-Bildschirm erscheint nur, wenn config.json mit 404 zurueckkommt,
// der Fork-Hinweis nur, wenn im Original eine neuere Version steht. Das
// laesst sich nicht aus dem Zwischenspeicher stellen, also wird hier
// geantwortet statt geladen.
//
// Aufruf:
//   python3 -m http.server 8765 &
//   node tools/shots.mjs            (alle)
//   node tools/shots.mjs orte       (einzeln)
//
// Braucht playwright und einen Chromium. Auf dem Mac:
//   npx playwright install chromium

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = join(WURZEL, 'assets', 'screens');
const PORT = process.env.PORT || 8765;
const BASIS = `http://localhost:${PORT}`;

// Die laufende Version mitgeben. Steht dort etwas anderes, haelt die App
// sich fuer veraltet und laedt sich mitten in der Aufnahme neu — der
// Bildschirm springt dann zurueck auf den Start.
const VERSION = JSON.parse(readFileSync(join(WURZEL, 'version.json'), 'utf8')).version;

/* ---------- Beispieldaten ----------
   Erfunden, aber plausibel: ein Wiedereinstieg im dritten Monat.        */

const CONFIG = {
  version: 1, bar: 20, rounding: 2.5, motto: 'Lift Heavy Shit',
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  deload: { afterFails: 3, factor: 0.9 },
  lifts: {
    squat:    { name: 'Back Squat',   increment: 2.5, start: 47.5, reference: 100 },
    bench:    { name: 'Bench Press',  increment: 2.5, start: 35,   reference: 75 },
    row:      { name: 'Barbell Row',  increment: 2.5, start: 32.5, reference: 70 },
    ohp:      { name: 'Strict Press', increment: 2.5, start: 25,   reference: 50 },
    deadlift: { name: 'Deadlift',     increment: 5,   start: 60,   reference: 130 }
  },
  workouts: {
    A: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'bench', sets: 5, reps: 5 }, { lift: 'row', sets: 5, reps: 5 }],
    B: [{ lift: 'squat', sets: 5, reps: 5 }, { lift: 'ohp', sets: 5, reps: 5 }, { lift: 'deadlift', sets: 1, reps: 5 }]
  },
  firstWorkout: 'A',
  rest: { normal: 90, afterFail: 180 },
  week: { slots: [{ day: 1, type: 'strength' }, { day: 2, type: 'ride' },
                  { day: 4, type: 'strength' }, { day: 6, type: 'ride' }] },
  rides: [
    { label: 'Grundlage Z2', detail: '90 Min ruhig, Zone 2, Gespräch möglich' },
    { label: 'Sweet Spot', detail: '3x12 Min @ 88-93% FTP, 6 Min locker dazwischen' }
  ],
  ziele: { warum: 'Damit ich mit siebzig noch meine Enkel hochheben kann.' },
  records: {
    quelle: 'altes Trainingstagebuch',
    programm: {
      squat:    { datum: '2021-03-04', bestesEinzel: 140, bestes5er: 120 },
      bench:    { datum: '2021-02-11', bestesEinzel: 95,  bestes5er: 80 },
      deadlift: { datum: '2021-04-22', bestesEinzel: 170, bestes5er: 145 }
    }
  },
  gyms: [
    { id: 'home', name: 'Homegym', geraete: ['kurzhantel', 'kettlebell', 'springseil'] },
    { id: 'box', name: 'Crossfit Box', geraete: [
      'langhantel','kurzhantel','kettlebell','klimmzugstange','latzug','box',
      'wandball','springseil','battlerope','rudergeraet','bikeerg','assaultbike'] },
    { id: 'studio', name: 'Studio', geraete: [
      'langhantel','kurzhantel','kettlebell','klimmzugstange','latzug','box',
      'rudergeraet','assaultbike'] }
  ]
};

const STIMME = { sprueche: { alle: [
  'Keine Ausreden. Nur Sätze.',
  'Die Stange ist ehrlich. Sie lügt nie über deinen Tag.',
  'Nicht schneller werden. Nicht aufhören.'
] } };

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');

/** Antwortet auf die GitHub-API. `configDa: false` heisst "noch nichts eingerichtet". */
function routen(ctx, { configDa = true, versionOben = null } = {}) {
  return ctx.route('**/api.github.com/**', r => {
    const u = r.request().url();
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.includes('/cyphomat/setlist/contents/version.json'))
      return versionOben ? j({ content: b64({ version: versionOben }) }) : r.fulfill({ status: 404, body: '' });
    if (u.includes('contents/config.json'))
      return configDa ? j({ content: b64(CONFIG), sha: 'c1' }) : r.fulfill({ status: 404, body: '' });
    if (u.includes('contents/stimme.json')) return j({ content: b64(STIMME), sha: 's1' });
    if (u.includes('git/trees')) return j({ tree: [] });
    if (/\/repos\/[^/]+\/[^/]+$/.test(new URL(u).pathname)) return j({ private: true });
    return r.fulfill({ status: 404, body: '' });
  });
}

/* ---------- Die Szenen ---------- */

const SZENEN = {
  // Ersteinrichtung: kommt nur, wenn im Repo noch kein Programm liegt.
  einrichten: {
    optionen: { configDa: false },
    hoehe: 1180,
    async fuehre(p) { await p.waitForSelector('#ein-lifts .ein-lift'); }
  },

  // Orte und Geraete im Backstage, ein Ort aufgeklappt.
  orte: {
    hoehe: 1000,
    async fuehre(p) {
      await p.click('#go-history');
      await p.waitForSelector('#gym-liste details');
      await p.click('#gym-liste details:first-child summary');
      await p.waitForTimeout(250);
      await verstecke(p, '#banner');
      await scrolleZu(p, '#gym-liste', 120);
    }
  },

  // Die Ortsauswahl aus der Kopfzeile.
  ortwahl: {
    async fuehre(p) {
      await p.waitForSelector('#gym-wahl:not([hidden])');
      await p.click('#gym-wahl');
      await p.waitForTimeout(300);
    }
  },

  // Deine Stimme: Grund, eigene Zeilen, alte Bestleistungen.
  stimme: {
    hoehe: 1000,
    async fuehre(p) {
      await p.click('#go-history');
      await p.waitForSelector('#pers-rekorde .pers-rekord');
      await verstecke(p, '#banner');
      await scrolleZu(p, '#pers-grund', 190);
    }
  },

  // Der Hinweis, dass am Original weitergearbeitet wurde.
  fork: {
    optionen: { versionOben: '2026-11-14.3' },
    host: 'jens.github.io',
    async fuehre(p) {
      await p.click('#go-history');
      await p.waitForSelector('#version-box');
      await verstecke(p, '#banner');
      await scrolleZu(p, '#version-box', 150);
    }
  }
};

const verstecke = (p, sel) => p.evaluate(s => {
  const el = document.querySelector(s); if (el) el.hidden = true;
}, sel);

const scrolleZu = (p, sel, abstand) => p.evaluate(([s, a]) => {
  const el = document.querySelector(s);
  if (el) window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - a));
}, [sel, abstand]);

/* ---------- Ablauf ---------- */

const gewaehlt = process.argv.slice(2);
const namen = gewaehlt.length ? gewaehlt : Object.keys(SZENEN);
const unbekannt = namen.filter(n => !SZENEN[n]);
if (unbekannt.length) {
  console.error(`Unbekannte Szene: ${unbekannt.join(', ')}`);
  console.error(`Bekannt: ${Object.keys(SZENEN).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined
});

for (const name of namen) {
  const s = SZENEN[name];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: s.hoehe || 844 },
    deviceScaleFactor: 2
  });
  await ctx.addInitScript(v => {
    localStorage.setItem('setlist.token', 'demo');
    localStorage.setItem('setlist.theme', 'dunkel');
    localStorage.setItem('setlist.version', v);
  }, VERSION);
  await routen(ctx, s.optionen);

  // Ein Fork laeuft unter fremder Adresse — nur dann fragt die App beim
  // Original nach. Dafuer wird der lokale Server unter diesem Namen
  // ausgeliefert statt ihn nachzubauen.
  if (s.host) {
    await ctx.route(`https://${s.host}/**`, async r => {
      const pfad = new URL(r.request().url()).pathname.replace(/^\//, '') || 'index.html';
      const res = await fetch(`${BASIS}/${pfad}`);
      if (!res.ok) return r.fulfill({ status: 404, body: '' });
      const typ = pfad.endsWith('.js') ? 'text/javascript'
        : pfad.endsWith('.css') ? 'text/css'
        : pfad.endsWith('.json') ? 'application/json'
        : pfad.endsWith('.woff2') ? 'font/woff2'
        : pfad.endsWith('.png') ? 'image/png' : 'text/html';
      return r.fulfill({ status: 200, contentType: typ, body: Buffer.from(await res.arrayBuffer()) });
    });
  }

  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', e => fehler.push(e.message));
  await p.goto(`${s.host ? `https://${s.host}` : BASIS}/index.html`);
  await p.waitForTimeout(1400);
  await s.fuehre(p);
  await p.waitForTimeout(400);
  await verstecke(p, '#banner');
  await p.screenshot({ path: join(ZIEL, `${name}-dunkel.png`) });
  console.log(`  ${name}-dunkel.png${fehler.length ? `   FEHLER: ${fehler.join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
