import * as P from './program.js';
import * as S from './store.js';
import * as ICU from './intervals.js';
import * as C from './coach.js';
import { LIFT_INFO, WARMUP, SKILL, FINISHER, RIDE_INFO } from './content.js';

let config = null, state = null, stateSha = null, session = null;
let ridesByDate = new Map(), letzterLog = null, trend = null;
let restTimer = null, restLeft = 0;

const $ = id => document.getElementById(id);
const VIEWS = ['setup', 'home', 'session', 'done', 'history'];
const show = n => { VIEWS.forEach(v => $('view-' + v).hidden = v !== n); window.scrollTo(0, 0); };

let bannerTimer = null;
function banner(msg, kind = '', ms = 3500) {
  const b = $('banner');
  b.textContent = msg; b.className = 'banner ' + kind; b.hidden = false;
  document.body.classList.add('has-banner');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => {
    b.hidden = true;
    document.body.classList.remove('has-banner');
  }, ms);
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
      banner('OFFLINE — LETZTER STAND', '', 4000);
    } else {
      banner(e.message, 'err', 9000);
      return show('setup');
    }
  }
  await flushQueue();
  renderHome();
  show('home');
  loadIntervals();
}

/** Nur Beiwerk: Fehler hier duerfen die App nie blockieren. */
async function loadIntervals() {
  if (!ICU.isConfigured()) return;
  try {
    const monday = P.mondayOf(new Date());
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const list = await ICU.rides(P.ymd(monday), P.ymd(sunday));
    ridesByDate = new Map(list.map(r => [r.date, r]));
    renderWeek();
  } catch (e) { console.warn('intervals.icu rides:', e.message); }
  try {
    const bis = new Date(), von = new Date(); von.setDate(von.getDate() - 90);
    trend = C.gewichtsTrend(await ICU.wellness(P.ymd(von), P.ymd(bis)));
    renderBodyTrend();
  } catch (e) { console.warn('intervals.icu wellness:', e.message); }
}

/* ============================ Home ============================ */

function renderHome() {
  const d = C.directive(state, config, new Date(), letzterLog);

  $('directive').innerHTML = `
    <div class="directive">
      <span class="tone ${d.intensitaet.stufe}">${d.intensitaet.label} · ${d.kopf}</span>
      <p class="txt">${d.intensitaet.text}</p>
    </div>
    <p class="spruch">${d.spruch}</p>`;

  const plan = P.planWorkout(state, config);
  $('today').innerHTML = `
    <div class="kicker">Als Nächstes</div>
    <div class="name neon">WORKOUT ${plan.workout}</div>
    <ul>${plan.lifts.map(l => `
      <li><span>${l.name} <span class="num">${l.sets}×${l.reps}</span></span><span>${P.fmtWeight(l.weight)}</span></li>
    `).join('')}</ul>
    <button id="start" class="btn">Training starten</button>`;
  $('start').onclick = startSession;

  renderProgress(d.fortschritt, d.streak);
  renderWeek();
  renderWeights(d.fortschritt);
  renderBodyTrend();
}

function renderProgress(f, streak) {
  const pct = Math.round(f.gesamt * 100);
  $('progress').innerHTML = `
    <div class="card">
      <div class="kicker">Zurück zu deinen alten Arbeitsgewichten</div>
      <div class="name">${pct}<span style="font-size:20px">%</span></div>
      <div class="bar lime"><i style="width:${pct}%"></i></div>
      <p class="fine">Gemittelt über alle fünf Übungen. ${streak > 0
        ? `<b style="color:var(--lime)">${streak} Woche${streak === 1 ? '' : 'n'} am Stück.</b>`
        : 'Noch keine laufende Serie — die erste Einheit startet sie.'}</p>
    </div>`;
}

function renderWeights(f) {
  $('weights').innerHTML = Object.entries(config.lifts).map(([id, def]) => {
    const s = state.lifts[id];
    const anteil = f.perLift[id] ? Math.round(f.perLift[id].anteil * 100) : null;
    return `<div class="w">
      <div class="n">${def.name}</div>
      <div class="v">${P.fmtWeight(s.weight)}</div>
      ${s.fails ? `<div class="f">${s.fails}× offen</div>` : ''}
      ${anteil !== null ? `<div class="mini"><i style="width:${anteil}%"></i></div>
        <div class="f" style="color:var(--dim)">${anteil}% von ${def.reference} kg</div>` : ''}
    </div>`;
  }).join('');
}

function renderWeek() {
  if (!config || !state) return;
  $('week').innerHTML = P.planWeek(state, config).map(s => {
    const ride = s.type === 'ride' ? ridesByDate.get(s.date) : null;
    const done = s.done || !!ride;
    const info = s.type === 'ride' ? RIDE_INFO[s.label] : null;
    return `<div class="slot ${s.isToday ? 'today-slot' : ''} ${done ? 'done' : ''}">
        <span class="day">${s.day}</span>
        <span class="what">${done ? '✓ ' : ''}${s.label}
          <span class="detail">${ride
            ? `<span class="ride-done">${ride.minutes} MIN · ${ride.km} KM${ride.load ? ` · LOAD ${ride.load}` : ''}</span>`
            : s.detail}</span>
        </span>
      </div>
      ${info && !done ? `<details class="info"><summary>Warum diese Einheit</summary>
        <div class="body"><p>${info.warum}</p>
        <div class="kv"><span class="k">ACHTUNG</span><span class="v">${info.achtung}</span></div></div></details>` : ''}`;
  }).join('');
}

function renderBodyTrend() {
  if (!trend) { $('body-trend').innerHTML = ''; return; }
  const runter = trend.delta !== null && trend.delta < 0;
  $('body-trend').innerHTML = `
    <h2>Körpergewicht</h2>
    <div class="card">
      <div class="kicker">Aus intervals.icu · ${trend.n} Messungen</div>
      <div class="name">${trend.aktuell}<span style="font-size:20px"> kg</span></div>
      ${trend.delta !== null ? `<p class="fine" style="color:${runter ? 'var(--lime)' : 'var(--amber)'}">
        ${trend.delta > 0 ? '+' : ''}${trend.delta} kg im Zeitraum.
        ${runter ? 'Richtung stimmt. Solange die Gewichte auf der Stange steigen, verlierst du Fett und keine Muskeln — genau das ist das Ziel.'
                 : 'Nach oben. Kein Drama, solange die Kraftwerte mitziehen — sonst nachjustieren.'}</p>` : ''}
    </div>`;
}

/* ============================ Einheit ============================ */

function startSession() {
  const plan = P.planWorkout(state, config);
  const d = C.directive(state, config, new Date(), letzterLog);
  session = {
    date: P.ymd(new Date()), started: new Date().toISOString(),
    workout: plan.workout,
    lifts: plan.lifts.map(l => ({ ...l, done: [] }))
  };
  $('session-title').textContent = `WORKOUT ${plan.workout}`;

  $('session-intent').innerHTML = `
    <div class="directive"><span class="tone ${d.intensitaet.stufe}">${d.intensitaet.label}</span>
    <p class="txt">${d.intensitaet.text}</p></div>`;

  const skill = C.tagesAuswahl(SKILL, new Date(), 'skill');
  $('warmup').innerHTML = `
    <details class="info" open><summary>Warm-up — nicht überspringen</summary>
      <div class="body">
        ${WARMUP.allgemein.concat(WARMUP[plan.workout]).map(w =>
          `<div class="kv"><span class="k">${w.t}</span><span class="v"><b>${w.was}</b> — ${w.detail}</span></div>`).join('')}
      </div>
    </details>
    <details class="info"><summary>Technik aus dem Gewichtheben — ${skill.name}</summary>
      <div class="body">
        <p class="tagline"><b>${skill.name}</b> · ${skill.dosis}</p>
        <p>${skill.warum}</p>
        <p style="color:var(--dim)">Leicht bleiben. Das ist Auffrischung, kein zweites Training — es darf die Sätze danach nicht kosten.</p>
      </div>
    </details>`;

  const fin = C.tagesAuswahl(FINISHER, new Date(), 'fin');
  $('finisher').innerHTML = `
    <details class="info"><summary>Finisher — ${fin.name}</summary>
      <div class="body">
        <p class="tagline"><b>${fin.name}</b> · ${fin.dosis}</p>
        <p>${fin.warum}</p>
        <p style="color:var(--dim)">Immer nach dem Eisen, nie davor. Sonst frisst die Kondition die Progression.</p>
      </div>
    </details>`;

  renderSession();
  show('session');
}

function renderSession() {
  $('session-body').innerHTML = session.lifts.map((l, li) => {
    const i = LIFT_INFO[l.lift] || {};
    return `<div class="lift">
      <div class="bar-head"><span class="ln">${i.tag || l.name}</span><span class="lw">${P.fmtWeight(l.weight)}</span></div>
      ${i.kadenz ? `<p class="cue">${i.kadenz}</p>` : ''}
      <div class="sets">
        ${Array.from({ length: l.sets }, (_, si) => {
          const r = l.done[si];
          const cls = r === undefined ? '' : (r >= l.reps ? 'done' : 'partial');
          return `<button class="set ${cls}" data-l="${li}" data-s="${si}">${r === undefined ? l.reps : r}</button>`;
        }).join('')}
      </div>
      <details class="info"><summary>Warum ${l.name}</summary>
        <div class="body">
          <p>${i.warum || ''}</p>
          <div class="kv"><span class="k">CUE</span><span class="v">${i.cue || ''}</span></div>
          <div class="kv"><span class="k">FEHLER</span><span class="v">${i.fehler || ''}</span></div>
          ${i.oly ? `<div class="kv"><span class="k">OLY</span><span class="v">${i.oly}</span></div>` : ''}
        </div>
      </details>
    </div>`;
  }).join('') + `<p class="fine">Tippen = ${session.lifts[0].reps} Wiederholungen geschafft. Lange drücken, wenn es weniger waren.</p>`;

  $('session-body').querySelectorAll('.set').forEach(bindSet);
  $('finish').disabled = !session.lifts.every(l => l.done.length === l.sets && l.done.every(v => v !== undefined));
}

function bindSet(btn) {
  const li = +btn.dataset.l, si = +btn.dataset.s;
  let held = false, t = null;
  btn.addEventListener('pointerdown', () => { held = false; t = setTimeout(() => { held = true; openPicker(li, si); }, 450); });
  btn.addEventListener('pointerup', e => {
    clearTimeout(t);
    if (held) return e.preventDefault();
    const l = session.lifts[li];
    recordSet(li, si, l.done[si] === undefined ? l.reps : undefined);
  });
  btn.addEventListener('pointerleave', () => clearTimeout(t));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

function recordSet(li, si, reps) {
  const l = session.lifts[li];
  const offen = $('session-body').querySelectorAll('details.info[open]');
  const offenIdx = [...$('session-body').querySelectorAll('details.info')].map(d => d.open);
  if (reps === undefined) delete l.done[si];
  else { l.done[si] = reps; startRest(reps >= l.reps ? config.rest.normal : config.rest.afterFail); }
  renderSession();
  // Aufgeklappte Erklaerungen ueberleben das Neuzeichnen.
  $('session-body').querySelectorAll('details.info').forEach((d, i) => d.open = !!offenIdx[i]);
}

function openPicker(li, si) {
  const l = session.lifts[li], dlg = $('picker');
  $('picker-title').textContent = `${l.name} · Satz ${si + 1}`;
  $('picker-opts').innerHTML = Array.from({ length: l.reps + 1 }, (_, n) => `<button data-n="${n}">${n}</button>`).join('');
  $('picker-opts').querySelectorAll('button').forEach(b => {
    b.onclick = () => { dlg.close(); recordSet(li, si, +b.dataset.n); };
  });
  dlg.showModal();
}

function startRest(seconds) {
  restLeft = seconds;
  $('rest').hidden = false;
  $('rest-time').textContent = restLeft;
  clearInterval(restTimer);
  restTimer = setInterval(() => {
    restLeft--;
    $('rest-time').textContent = restLeft > 0 ? restLeft : 'LOS';
    if (restLeft <= 0) {
      clearInterval(restTimer);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(stopRest, 2500);
    }
  }, 1000);
}
const stopRest = () => { clearInterval(restTimer); $('rest').hidden = true; };

async function finishSession() {
  const log = {
    date: session.date, workout: session.workout,
    started: session.started, finished: new Date().toISOString(),
    lifts: session.lifts.map(l => {
      const reps = l.done.slice(0, l.sets).map(r => r ?? 0);
      return { lift: l.lift, weight: l.weight, sets: l.sets, target: l.reps, reps,
               success: reps.length === l.sets && reps.every(r => r >= l.reps) };
    })
  };
  const before = state;
  state = P.applyLog(state, config, log);
  letzterLog = log;
  S.cache({ state });
  stopRest();
  renderDone(before, log);
  show('done');
  try { await commit(log); banner('GESPEICHERT', 'ok'); }
  catch { S.queue(log); banner('KEIN NETZ — WIRD NACHGETRAGEN', '', 6000); }
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
  try { for (const log of q) await commit(log); S.clearQueue(); banner(`${q.length} NACHGETRAGEN`, 'ok'); }
  catch { banner(`${q.length} EINHEIT(EN) WARTEN`, '', 5000); }
}

function renderDone(before, log) {
  const d = C.directive(state, config, new Date(), log);
  $('done-body').innerHTML = `
    <div class="card">
      <div class="kicker">Workout ${log.workout} · ${log.date}</div>
      <ul>${log.lifts.map(e => {
        const b = before.lifts[e.lift].weight, a = state.lifts[e.lift].weight;
        const txt = a > b ? `${P.fmtWeight(a)} ▲` : a < b ? `${P.fmtWeight(a)} ▼ Deload` : 'bleibt';
        return `<li><span>${config.lifts[e.lift].name} ${e.success ? '✓' : '✕'}</span><span>${txt}</span></li>`;
      }).join('')}</ul>
    </div>
    <p class="spruch">${d.spruch}</p>
    <p class="fine">Nächstes Mal: Workout ${state.next}. ${d.streak > 0 ? `Serie: ${d.streak} Woche(n).` : ''}</p>`;
}

/* ============================ Verlauf ============================ */

async function renderHistory() {
  show('history');
  $('history-body').innerHTML = '<p class="lead">Lade…</p>';
  try {
    const logs = (await S.readAllLogs()).sort((a, b) => b.date.localeCompare(a.date));
    $('history-body').innerHTML = logs.length ? logs.map(l => `
      <div class="hist"><div class="d">${l.date} · WORKOUT ${l.workout}</div>
        <div class="l">${l.lifts.map(e => `${config.lifts[e.lift].name} ${P.fmtWeight(e.weight)} (${e.reps.join('/')})`).join(' · ')}</div>
      </div>`).join('') : '<p class="lead">Noch keine Einheit protokolliert.</p>';
  } catch (e) { $('history-body').innerHTML = `<p class="lead">${e.message}</p>`; }
}

async function rebuild() {
  if (!confirm('state.json vollständig aus allen Log-Dateien neu berechnen?')) return;
  try {
    banner('BERECHNE NEU…', '', 0);
    const logs = await S.readAllLogs();
    state = P.deriveState(config, logs);
    letzterLog = logs.length ? logs.sort((a, b) => a.date.localeCompare(b.date))[logs.length - 1] : null;
    const cur = await S.readFile('state.json');
    await S.writeFile('state.json', state, `Neuberechnung aus ${logs.length} Einheiten`, cur ? cur.sha : null);
    S.cache({ state });
    renderHome();
    banner(`NEU BERECHNET · ${logs.length} EINHEITEN`, 'ok');
  } catch (e) { banner(e.message, 'err', 8000); }
}

/* ============================ Start ============================ */

$('save-token').onclick = async () => {
  const t = $('token').value.trim();
  if (!t) return banner('GITHUB-TOKEN FEHLT', 'err');
  S.setToken(t);
  const k = $('icukey').value.trim();
  if (k) {
    ICU.setCreds('', k);
    try { const me = await ICU.resolveAthlete(); if (me) banner(`INTERVALS.ICU: ${me.name}`, 'ok'); }
    catch (e) { ICU.clearCreds(); banner(e.message, 'err', 6000); }
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

if (S.getToken()) {
  show('home');
  $('today').innerHTML = '<div class="kicker">Verbinde</div><div class="name neon">···</div>';
  load();
} else show('setup');
