import * as P from './program.js';
import * as S from './store.js';
import * as ICU from './intervals.js';

let config = null, state = null, stateSha = null, session = null;
let ridesByDate = new Map();
let restTimer = null, restLeft = 0;

const $ = id => document.getElementById(id);
const VIEWS = ['setup', 'home', 'session', 'done', 'history'];

function show(name) {
  VIEWS.forEach(v => $('view-' + v).hidden = v !== name);
  window.scrollTo(0, 0);
}

let bannerTimer = null;
function banner(msg, kind = '', ms = 3500) {
  const b = $('banner');
  b.textContent = msg;
  b.className = 'banner ' + kind;
  b.hidden = false;
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => b.hidden = true, ms);
}

/* ============================ Laden ============================ */

async function load() {
  try {
    const [c, st] = await Promise.all([S.readFile('config.json'), S.readFile('state.json')]);
    if (!c) throw new Error('config.json fehlt in lifty-data.');
    config = c.data;
    state = st ? st.data : P.initialState(config);
    stateSha = st ? st.sha : null;
    S.cache({ config, state });
  } catch (e) {
    const c = S.cached();
    if (c.config) {
      config = c.config; state = c.state; stateSha = null;
      banner('Offline — letzter bekannter Stand', '', 4000);
    } else {
      banner(e.message, 'err', 9000);
      return show('setup');
    }
  }
  await flushQueue();
  loadRides();
  renderHome();
  show('home');
}

/** Ist-Daten fuers Rad. Fehler hier duerfen die App nie blockieren. */
async function loadRides() {
  if (!ICU.isConfigured()) return;
  try {
    const monday = P.mondayOf(new Date());
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const list = await ICU.rides(P.ymd(monday), P.ymd(sunday));
    ridesByDate = new Map(list.map(r => [r.date, r]));
    renderWeek();
  } catch (e) {
    console.warn('intervals.icu:', e.message);
  }
}

/* ============================ Home ============================ */

function renderHome() {
  const plan = P.planWorkout(state, config);
  $('today').innerHTML = `
    <div class="kicker">Als Nächstes</div>
    <div class="name">Workout ${plan.workout}</div>
    <ul>${plan.lifts.map(l => `
      <li><span>${l.name} ${l.sets}×${l.reps}</span><span>${P.fmtWeight(l.weight)}</span></li>
    `).join('')}</ul>
    <button id="start" class="btn primary">Training starten</button>`;
  $('start').onclick = startSession;

  renderWeek();

  $('weights').innerHTML = Object.entries(config.lifts).map(([id, def]) => {
    const s = state.lifts[id];
    return `<div class="w">
      <div class="n">${def.name}</div>
      <div class="v">${P.fmtWeight(s.weight)}</div>
      ${s.fails ? `<div class="f">${s.fails}× nicht geschafft</div>` : ''}
    </div>`;
  }).join('');
}

function renderWeek() {
  if (!config || !state) return;
  $('week').innerHTML = P.planWeek(state, config).map(s => {
    const ride = s.type === 'ride' ? ridesByDate.get(s.date) : null;
    const done = s.done || !!ride;
    return `<div class="slot ${s.isToday ? 'today-slot' : ''} ${done ? 'done' : ''}">
      <span class="day">${s.day}</span>
      <span class="what">
        ${done ? '✓ ' : ''}${s.label}
        <span class="detail">${ride
          ? `<span class="ride-done">${ride.minutes} Min · ${ride.km} km${ride.load ? ` · Load ${ride.load}` : ''}</span>`
          : s.detail}</span>
      </span>
    </div>`;
  }).join('');
}

/* ============================ Einheit ============================ */

function startSession() {
  const plan = P.planWorkout(state, config);
  session = {
    date: P.ymd(new Date()),
    started: new Date().toISOString(),
    workout: plan.workout,
    lifts: plan.lifts.map(l => ({ ...l, done: [] }))
  };
  $('session-title').textContent = `Workout ${plan.workout}`;
  renderSession();
  show('session');
}

function renderSession() {
  $('session-body').innerHTML = session.lifts.map((l, li) => `
    <div class="lift">
      <div class="bar"><span class="ln">${l.name}</span><span class="lw">${P.fmtWeight(l.weight)}</span></div>
      <div class="sets">
        ${Array.from({ length: l.sets }, (_, si) => {
          const r = l.done[si];
          const cls = r === undefined ? '' : (r >= l.reps ? 'done' : 'partial');
          return `<button class="set ${cls}" data-l="${li}" data-s="${si}">${r === undefined ? l.reps : r}</button>`;
        }).join('')}
      </div>
    </div>`).join('') +
    `<p class="fine">Tippen = ${session.lifts[0].reps} Wiederholungen geschafft. Lange drücken, wenn es weniger waren.</p>`;

  $('session-body').querySelectorAll('.set').forEach(bindSet);
  const complete = session.lifts.every(l => l.done.length === l.sets && l.done.every(v => v !== undefined));
  $('finish').disabled = !complete;
}

function bindSet(btn) {
  const li = +btn.dataset.l, si = +btn.dataset.s;
  let held = false, t = null;

  const start = () => { held = false; t = setTimeout(() => { held = true; openPicker(li, si); }, 450); };
  const end = e => {
    clearTimeout(t);
    if (held) { e.preventDefault(); return; }
    const l = session.lifts[li];
    recordSet(li, si, l.done[si] === undefined ? l.reps : undefined);
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointerleave', () => clearTimeout(t));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

function recordSet(li, si, reps) {
  const l = session.lifts[li];
  if (reps === undefined) { delete l.done[si]; }
  else {
    l.done[si] = reps;
    startRest(reps >= l.reps ? config.rest.normal : config.rest.afterFail);
  }
  renderSession();
}

function openPicker(li, si) {
  const l = session.lifts[li];
  const dlg = $('picker');
  $('picker-title').textContent = `${l.name} · Satz ${si + 1}`;
  $('picker-opts').innerHTML = Array.from({ length: l.reps + 1 }, (_, n) =>
    `<button data-n="${n}">${n}</button>`).join('');
  $('picker-opts').querySelectorAll('button').forEach(b => {
    b.onclick = () => { dlg.close(); recordSet(li, si, +b.dataset.n); };
  });
  dlg.showModal();
}

/* ---------- Pausenuhr ---------- */

function startRest(seconds) {
  restLeft = seconds;
  $('rest').hidden = false;
  $('rest-time').textContent = restLeft;
  clearInterval(restTimer);
  restTimer = setInterval(() => {
    restLeft--;
    $('rest-time').textContent = restLeft > 0 ? restLeft : 'Los';
    if (restLeft <= 0) {
      clearInterval(restTimer);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(stopRest, 2500);
    }
  }, 1000);
}
function stopRest() { clearInterval(restTimer); $('rest').hidden = true; }

/* ---------- Abschliessen ---------- */

async function finishSession() {
  const log = {
    date: session.date,
    workout: session.workout,
    started: session.started,
    finished: new Date().toISOString(),
    lifts: session.lifts.map(l => {
      const reps = l.done.slice(0, l.sets).map(r => r ?? 0);
      return {
        lift: l.lift, weight: l.weight, sets: l.sets, target: l.reps, reps,
        success: reps.length === l.sets && reps.every(r => r >= l.reps)
      };
    })
  };

  const before = state;
  state = P.applyLog(state, config, log);
  S.cache({ state });
  stopRest();
  renderDone(before, log);
  show('done');

  try {
    await commit(log);
    banner('Gespeichert', 'ok');
  } catch (e) {
    S.queue(log);
    banner('Kein Netz — Einheit wird später hochgeladen', '', 6000);
  }
  session = null;
}

async function commit(log) {
  let path = `log/${log.date}.json`;
  if (await S.readFile(path)) path = `log/${log.date}-2.json`;
  await S.writeFile(path, log, `Einheit ${log.workout} am ${log.date}`);
  const cur = await S.readFile('state.json');
  await S.writeFile('state.json', state, `Zustand nach ${log.date}`, cur ? cur.sha : stateSha);
}

async function flushQueue() {
  const q = S.pending();
  if (!q.length) return;
  try {
    for (const log of q) await commit(log);
    S.clearQueue();
    banner(`${q.length} nachgetragen`, 'ok');
  } catch { banner(`${q.length} Einheit(en) warten auf Upload`, '', 5000); }
}

function renderDone(before, log) {
  $('done-body').innerHTML = `
    <div class="card">
      <div class="kicker">Workout ${log.workout} · ${log.date}</div>
      <ul>${log.lifts.map(e => {
        const b = before.lifts[e.lift].weight, a = state.lifts[e.lift].weight;
        const arrow = a > b ? `→ ${P.fmtWeight(a)}` : a < b ? `→ ${P.fmtWeight(a)} (Deload)` : 'bleibt';
        return `<li><span>${config.lifts[e.lift].name} ${e.success ? '✓' : '✕'}</span><span>${arrow}</span></li>`;
      }).join('')}</ul>
    </div>
    <p class="fine">Nächstes Mal: Workout ${state.next}</p>`;
}

/* ============================ Verlauf ============================ */

async function renderHistory() {
  show('history');
  $('history-body').innerHTML = '<p class="lead">Lade…</p>';
  try {
    const logs = await S.readAllLogs();
    logs.sort((a, b) => b.date.localeCompare(a.date));
    $('history-body').innerHTML = logs.length ? logs.map(l => `
      <div class="hist">
        <div class="d">${l.date} · Workout ${l.workout}</div>
        <div class="l">${l.lifts.map(e =>
          `${config.lifts[e.lift].name} ${P.fmtWeight(e.weight)} (${e.reps.join('/')})`).join(' · ')}</div>
      </div>`).join('') : '<p class="lead">Noch keine Einheit protokolliert.</p>';
  } catch (e) {
    $('history-body').innerHTML = `<p class="lead">${e.message}</p>`;
  }
}

/** Neuberechnung aus allen Logs — beweist die Invariante und repariert Tippfehler. */
async function rebuild() {
  if (!confirm('state.json vollständig aus allen Log-Dateien neu berechnen?')) return;
  try {
    banner('Berechne neu…', '', 0);
    const logs = await S.readAllLogs();
    state = P.deriveState(config, logs);
    const cur = await S.readFile('state.json');
    await S.writeFile('state.json', state, `Neuberechnung aus ${logs.length} Einheiten`, cur ? cur.sha : null);
    S.cache({ state });
    renderHome();
    banner(`Neu berechnet aus ${logs.length} Einheiten`, 'ok');
  } catch (e) { banner(e.message, 'err', 8000); }
}

/* ============================ Start ============================ */

$('save-token').onclick = async () => {
  const t = $('token').value.trim();
  if (!t) return banner('GitHub-Token fehlt', 'err');
  S.setToken(t);
  const k = $('icukey').value.trim();
  if (k) {
    ICU.setCreds('', k);
    try {
      const me = await ICU.resolveAthlete();
      if (me) banner(`intervals.icu verbunden: ${me.name}`, 'ok');
    } catch (e) { ICU.clearCreds(); banner(e.message, 'err', 6000); }
  }
  load();
};

$('go-history').onclick = renderHistory;
$('hist-back').onclick = () => show('home');
$('rebuild').onclick = rebuild;
$('logout').onclick = () => {
  if (!confirm('Token und Key aus diesem Browser entfernen?')) return;
  S.clearToken(); ICU.clearCreds(); location.reload();
};
$('finish').onclick = finishSession;
$('abort').onclick = () => { if (confirm('Einheit verwerfen?')) { stopRest(); session = null; show('home'); } };
$('done-ok').onclick = () => { renderHome(); show('home'); };
$('rest-skip').onclick = stopRest;

window.addEventListener('online', flushQueue);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Kein Aufblitzen des Setup-Screens, wenn schon ein Token da ist.
if (S.getToken()) {
  show('home');
  $('today').innerHTML = '<div class="kicker">Einen Moment</div><div class="name">Lade…</div>';
  load();
} else {
  show('setup');
}
