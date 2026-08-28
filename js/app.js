import * as P from './program.js';
import * as S from './store.js';
import * as ICU from './intervals.js';
import * as C from './coach.js';
import { LIFT_INFO, WARMUP, SKILL, FINISHER, RIDE_INFO } from './content.js';
import * as WOD from './wod.js';
import * as ST from './stats.js';

let config = null, state = null, stateSha = null, session = null;
let ridesByDate = new Map(), letzterLog = null, trend = null;
// Sichtbarer Zustand der intervals.icu-Anbindung. Vorher verschwanden
// Fehler in der Konsole, und man konnte nicht unterscheiden zwischen
// "nicht verbunden", "kaputt" und "diese Woche einfach nichts gefahren".
let icu = { stand: 'aus', text: '', letzte: null, anzahl: 0 };
// Woher die angezeigten Daten wirklich stammen. Eine gruene Kachel, die nur
// den Zwischenspeicher meint, waere eine Luege.
let datenQuelle = 'keine';
let restTimer = null, restLeft = 0;
// Manuell gewaehltes Workout. Nur fuer diese eine Einheit — der Automat
// bleibt die Wahrheit darueber, was eigentlich dran waere.
let workoutOverride = null;
let wod = null, wodSeed = 0, swTimer = null, swSek = 0, swLaeuft = false;
let alleLogs = [];              // zuletzt geladene Einheiten, fuer Bestwerte
let mo = { lift: 'squat' };     // laufender Krafttest
let form = null;                // Form aus intervals.icu (ctl - atl)
let alleFahrten = [];           // Radfahrten der letzten 90 Tage

const $ = id => document.getElementById(id);
const VERSION_KEY = 'lifty.version';
let laufendeVersion = localStorage.getItem(VERSION_KEY) || '—';
const VIEWS = ['setup', 'home', 'session', 'wod', 'maxout', 'done', 'history'];
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
    datenQuelle = 'netz';
    S.cache({ config, state });
  } catch (e) {
    const c = S.cached();
    if (c.config) {
      config = c.config; state = c.state; stateSha = null;
      datenQuelle = 'cache';
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

/** Nur Beiwerk: Fehler hier duerfen die App nie blockieren — aber sichtbar sein. */
async function loadIntervals() {
  if (!ICU.isConfigured()) {
    icu = { stand: 'aus', text: 'Nicht verbunden.' };
    renderIcuStatus();
    return;
  }
  icu = { stand: 'laedt', text: 'Lade…' };
  renderIcuStatus();

  try {
    // Bewusst 90 Tage statt nur der laufenden Woche: sonst sieht man bei
    // einer Trainingspause gar nichts und haelt die Anbindung fuer kaputt.
    const bis = new Date(), von = new Date();
    von.setDate(von.getDate() - 90);
    const alle = await ICU.rides(P.ymd(von), P.ymd(bis));
    alleFahrten = alle;
    S.cache({ fahrten: alle });

    const monday = P.mondayOf(new Date());
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const vonK = P.ymd(monday), bisK = P.ymd(sunday);
    ridesByDate = new Map(alle.filter(r => r.date >= vonK && r.date <= bisK).map(r => [r.date, r]));

    const sortiert = [...alle].sort((a, b) => b.date.localeCompare(a.date));
    icu = {
      stand: 'ok',
      text: '',
      letzte: sortiert[0] || null,
      anzahl: alle.length
    };
    renderWeek();
  } catch (e) {
    icu = { stand: 'fehler', text: e.message };
  }
  renderIcuStatus();

  try {
    const bis = new Date(), von = new Date(); von.setDate(von.getDate() - 90);
    const roh = await ICU.wellness(P.ymd(von), P.ymd(bis));
    trend = C.gewichtsTrend(roh);
    form = C.formLage(ICU.letzteForm(roh));
    renderBodyTrend();
    renderHome();
  } catch (e) {
    console.warn('intervals.icu wellness:', e.message);
  }
}

/** Was von intervals.icu tatsaechlich ankommt — oder warum nicht. */
function renderIcuStatus() {
  const el = $('icu-status');
  if (!el) return;

  if (icu.stand === 'aus') {
    el.innerHTML = `<p class="fine">Radeinheiten werden nicht abgeglichen —
      intervals.icu ist nicht verbunden. Unter ≡ eintragen.</p>`;
    return;
  }
  if (icu.stand === 'laedt') { el.innerHTML = '<p class="fine">Frage intervals.icu ab…</p>'; return; }
  if (icu.stand === 'fehler') {
    el.innerHTML = `<p class="fine" style="color:var(--red)">intervals.icu: ${icu.text}</p>`;
    return;
  }

  if (!icu.letzte) {
    el.innerHTML = `<p class="fine">Keine Radeinheit in den letzten 90 Tagen.
      Die Anbindung funktioniert — es gibt schlicht nichts abzugleichen.</p>`;
    return;
  }
  const tage = C.daysSince(icu.letzte.date, new Date());
  const lange = tage > 21;
  el.innerHTML = `<p class="fine">
    Letzte Fahrt vor <b class="num" style="color:${lange ? 'var(--amber)' : 'var(--cyan)'}">${tage} Tagen</b>
    — ${icu.letzte.name} · ${icu.letzte.minutes} Min · ${icu.letzte.km} km.
    ${icu.anzahl} Fahrt${icu.anzahl === 1 ? '' : 'en'} in 90 Tagen.
    ${lange ? '<br>Das Rad ruht länger als das Eisen. Eine ruhige Stunde in Zone 2 kostet dich keine Erholung für die Kniebeuge.' : ''}
  </p>`;
}

/** Verbindungsuebersicht unter ≡. */
function renderConnections() {
  const box = $('conn-box');
  if (!box) return;
  const zeile = (name, stand, text) => `<div class="conn">
      <span class="dot ${stand}"></span>
      <span class="b"><span class="n">${name}</span><span class="s">${text}</span></span>
    </div>`;
  const gh = datenQuelle === 'netz'
    ? ['ok', 'Verbunden mit lifty-data.']
    : datenQuelle === 'cache'
      ? ['aus', 'Zeigt zwischengespeicherte Daten — der letzte Abruf ist fehlgeschlagen.']
      : ['fehler', 'Keine Verbindung zu deinen Daten.'];

  const n = icu.anzahl;
  const push = ICU.pushAktiv();
  box.innerHTML =
    zeile('GitHub', gh[0], gh[1]) +
    zeile('intervals.icu', icu.stand === 'laedt' ? 'aus' : (icu.stand === 'ok' ? 'ok' : icu.stand),
      icu.stand === 'ok'
        ? `${n} ${n === 1 ? 'Fahrt' : 'Fahrten'} in 90 Tagen${icu.letzte ? `, zuletzt ${icu.letzte.date}` : ''}.`
        : icu.stand === 'fehler' ? icu.text : 'Nicht verbunden — Key unten eintragen.') +
    `<div class="conn">
       <span class="dot ${push && icu.stand === 'ok' ? 'ok' : 'aus'}"></span>
       <span class="b">
         <span class="n">Kraft → intervals.icu</span>
         <span class="s">${icu.stand === 'ok'
           ? (push
             ? 'Neue Krafteinheiten und WODs werden dort als Aktivität eingetragen. Trainingslast geschätzt aus der Dauer.'
             : 'Aus. Einschalten, damit dein Eisen in derselben Kurve landet wie dein Rad.')
           : 'Braucht erst eine Verbindung zu intervals.icu.'}</span>
         <label class="schalter">
           <input type="checkbox" id="icu-push" ${push ? 'checked' : ''} ${icu.stand === 'ok' ? '' : 'disabled'}>
           <span>Übertragung aktiv</span>
         </label>
       </span>
     </div>`;
  const cb = $('icu-push');
  if (cb) cb.onchange = () => {
    ICU.setPushAktiv(cb.checked);
    banner(cb.checked ? 'ÜBERTRAGUNG AN' : 'ÜBERTRAGUNG AUS', 'ok');
    renderConnections();
  };
}

/* ============================ Home ============================ */

function renderHome() {
  const d = C.directive(state, config, new Date(), letzterLog);

  $('directive').innerHTML = `
    <div class="directive">
      <span class="tone ${d.intensitaet.stufe}">${d.intensitaet.label} · ${d.kopf}</span>
      <p class="txt">${d.intensitaet.text}</p>
      ${formZeile()}
    </div>
    <p class="spruch">${d.spruch}</p>`;

  const gewaehlt = workoutOverride || state.next;
  const plan = P.planWorkout(state, config, gewaehlt);
  $('swap-workout').textContent = `Workout ${gewaehlt === 'A' ? 'B' : 'A'}`;
  $('today').innerHTML = `
    <div class="kicker">${workoutOverride ? 'Selbst gewählt' : 'Als Nächstes'}</div>
    <div class="name neon">WORKOUT ${plan.workout}</div>
    <ul>${plan.lifts.map(l => `
      <li><span>${l.name} <span class="num">${l.sets}×${l.reps}</span></span><span>${P.fmtWeight(l.weight)}</span></li>
    `).join('')}</ul>
    <button id="start" class="btn">Training starten</button>`;
  $('start').onclick = startSession;

  renderProgress(d.fortschritt, d.streak);
  renderWeek();
  renderIcuStatus();
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
  const plan = P.planWorkout(state, config, workoutOverride || state.next);
  const d = C.directive(state, config, new Date(), letzterLog);
  session = {
    date: P.ymd(new Date()), started: new Date().toISOString(),
    workout: plan.workout,
    // planWeight bleibt stehen, damit sichtbar wird, was abweicht.
    lifts: plan.lifts.map(l => ({ ...l, planWeight: l.weight, done: [] }))
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
    <details class="info"><summary>Aufwärmsätze mit Scheiben</summary>
      <div class="body">
        ${plan.lifts.map(l => `
          <p class="tagline" style="margin:12px 0 4px"><b>${l.name}</b> → ${P.fmtWeight(l.weight)}</p>
          ${P.waermsaetze(l.weight, config).map(w => {
            const t = P.plattenText(w.weight, config);
            return `<div class="kv">
              <span class="k">${w.saetze > 1 ? w.saetze + '×' : ''}${w.reps} Wdh</span>
              <span class="v"><b>${P.fmtWeight(w.weight)}</b>${t ? ` — ${t}` : ''}</span></div>`;
          }).join('')}`).join('')}
        <p style="color:var(--dim);margin-top:12px">Scheibenangaben gelten pro Seite, ausgehend von einer ${config.bar}-kg-Stange.</p>
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
      <div class="bar-head"><span class="ln">${i.tag || l.name}</span>
        <span class="wadj">
          <button data-w="${li}" data-d="-1" aria-label="leichter">−</button>
          <span class="lw">${P.fmtWeight(l.weight)}</span>
          <button data-w="${li}" data-d="1" aria-label="schwerer">+</button>
        </span></div>
      ${plattenZeile(l.weight)}
      ${l.weight !== l.planWeight
        ? `<p class="cue geaendert">Angepasst von ${P.fmtWeight(l.planWeight)} — so wird es protokolliert, und die Progression rechnet ab hier weiter.</p>`
        : (i.kadenz ? `<p class="cue">${i.kadenz}</p>` : '')}
      <div class="sets">
        ${Array.from({ length: l.sets }, (_, si) => {
          const r = l.done[si];
          const cls = r === undefined ? '' : (r > l.reps ? 'done plus' : r === l.reps ? 'done' : 'partial');
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
  $('session-body').querySelectorAll('.wadj button').forEach(b => {
    b.onclick = () => aendereGewicht(+b.dataset.w, +b.dataset.d);
  });
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
  // Bewusst ueber das Ziel hinaus: manchmal geht mehr, und ein Satz mit acht
  // Wiederholungen ist eine Information, die man nicht wegwerfen sollte —
  // das geschaetzte Maximum lebt davon.
  const max = config.repMax || 12;
  $('picker-title').textContent = `${l.name} · Satz ${si + 1} · Ziel ${l.reps}`;
  $('picker-opts').innerHTML = Array.from({ length: max + 1 }, (_, n) =>
    `<button data-n="${n}" class="${n === l.reps ? 'ziel' : n > l.reps ? 'mehr' : ''}">${n}</button>`).join('');
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

/** Pause im Lauf verstellen — 90 Sekunden passen nicht zu jedem Satz. */
function verstellePause(delta) {
  restLeft = Math.max(0, restLeft + delta);
  $('rest-time').textContent = restLeft > 0 ? restLeft : 'LOS';
}

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
  try {
    await commit(log);
    banner('GESPEICHERT', 'ok');
    await uebertrageNachIcu(log);
  } catch { S.queue(log); banner('KEIN NETZ — WIRD NACHGETRAGEN', '', 6000); }
  session = null;
  workoutOverride = null;
}

async function commit(log) {
  let path = `${S.LOG_DIR}/${log.date}.json`;
  if (await S.readFile(path)) path = `${S.LOG_DIR}/${log.date}-2.json`;
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
  renderVersion();
  renderConnections();
  // Ohne geladene Konfiguration gibt es nichts zu zeigen — und der Zugriff
  // auf config.lifts wuerde die ganze Ansicht mit einem leeren Bildschirm
  // quittieren statt mit einer Erklaerung.
  if (!config) {
    $('hist-summary').innerHTML = '';
    $('hist-prs').innerHTML = '';
    $('hist-charts').innerHTML = '';
    $('history-body').innerHTML =
      `<p class="lead">Noch keine Verbindung zu deinen Daten. Prüfe den GitHub-Token
       unter „Zugänge entfernen“ und richte ihn neu ein.</p>`;
    return;
  }
  $('hist-summary').innerHTML = '';
  $('hist-prs').innerHTML = '';
  $('hist-charts').innerHTML = '';
  $('hist-rad').innerHTML = '';
  $('history-body').innerHTML = '<p class="lead">Lade…</p>';
  try {
    const logs = await S.readAllLogs();
    alleLogs = logs;
    S.cacheLogs(logs);
    renderStats(logs);
    renderPRs(logs);
    renderCharts(logs);
    renderRad();
    renderListe(logs);
  } catch (e) {
    // Lieber den letzten bekannten Stand zeigen als eine Sackgasse.
    const alt = S.cachedLogs();
    if (alt && alt.logs.length) {
      alleLogs = alt.logs;
      renderStats(alt.logs);
      renderPRs(alt.logs);
      renderCharts(alt.logs);
      renderRad();
      renderListe(alt.logs);
      banner('OFFLINE — STAND VOM ' + new Date(alt.zeit).toLocaleDateString('de-DE'), '', 5000);
    } else {
      $('history-body').innerHTML = `<p class="lead">${e.message}</p>`;
    }
    $('history-body').insertAdjacentHTML('beforeend',
      '<button id="hist-retry" class="btn ghost">Erneut versuchen</button>');
    $('hist-retry').onclick = renderHistory;
  }
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
$('swap-workout').onclick = () => {
  const jetzt = workoutOverride || state.next;
  workoutOverride = jetzt === 'A' ? 'B' : 'A';
  if (workoutOverride === state.next) workoutOverride = null;   // zurueck zum Automaten
  renderHome();
};
$('go-wod').onclick = () => { starteWod(WOD.seedAus(P.ymd(new Date()))); };
$('go-maxout').onclick = starteMaxout;
$('mo-back').onclick = () => show('home');
$('mo-weight').oninput = renderMaxoutErgebnis;
$('mo-reps').oninput = renderMaxoutErgebnis;
$('mo-save').onclick = speichereMaxout;
$('rest-minus').onclick = () => verstellePause(-30);
$('rest-plus').onclick = () => verstellePause(30);
$('wod-back').onclick = () => { stopUhr(); show('home'); };
$('wod-reroll').onclick = () => { starteWod((wodSeed * 7919 + 13) >>> 0); };
$('wod-finish').onclick = wodAbschliessen;
$('sw-toggle').onclick = () => swLaeuft ? stopUhr() : startUhr();
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
/**
 * Update-Erkennung. Der Service Worker holt zwar bei jedem Start vom Netz,
 * aber ein bereits geladenes Modul tauscht sich nicht selbst aus. Deshalb
 * vergleichen wir die ausgelieferte Version mit der zuletzt gesehenen und
 * laden genau einmal neu, wenn sie sich geaendert hat.
 */
async function pruefeVersion(manuell = false) {
  try {
    const res = await fetch(`version.json?cb=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('nicht erreichbar');
    const { version } = await res.json();
    const gesehen = localStorage.getItem(VERSION_KEY);
    laufendeVersion = version;

    if (gesehen && gesehen !== version) {
      // Zuerst merken, dann neu laden — sonst droht eine Endlosschleife.
      localStorage.setItem(VERSION_KEY, version);
      await leereCaches();
      banner('NEUE VERSION — LADE NEU', 'ok', 0);
      setTimeout(() => location.reload(), 800);
      return;
    }
    localStorage.setItem(VERSION_KEY, version);
    if (manuell) {
      await leereCaches();
      banner(`AKTUELL · ${version}`, 'ok');
      renderVersion();
    }
  } catch {
    if (manuell) banner('KEIN NETZ — VERSION NICHT PRÜFBAR', 'err', 5000);
  }
}

async function leereCaches() {
  try {
    if (window.caches) {
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const rs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(rs.map(r => r.update().catch(() => {})));
    }
  } catch { /* nicht kritisch */ }
}

function renderVersion() {
  $('version-box').innerHTML = `<p class="fine" style="margin:0 0 6px">
    Version <b class="num" style="color:var(--cyan)">${laufendeVersion}</b> ·
    Updates kommen beim nächsten Start von allein.</p>`;
}

$('force-update').onclick = () => pruefeVersion(true);
$('icu-save').onclick = async () => {
  const k = $('icukey2').value.trim();
  if (!k) return banner('KEY FEHLT', 'err');
  ICU.setCreds('', k);
  try {
    const me = await ICU.resolveAthlete();
    $('icukey2').value = '';
    banner(`INTERVALS.ICU: ${me ? me.name : 'verbunden'}`, 'ok');
    await loadIntervals();
    renderConnections();
  } catch (e) {
    ICU.clearCreds();
    icu = { stand: 'fehler', text: e.message };
    renderConnections();
    banner(e.message, 'err', 6000);
  }
};
window.addEventListener('online', flushQueue);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

pruefeVersion();
if (S.getToken()) {
  show('home');
  $('today').innerHTML = '<div class="kicker">Verbinde</div><div class="name neon">···</div>';
  load();
} else show('setup');

/* ============================ Zufalls-WOD ============================
   Bewusst getrennt vom 5x5: es wird als eigener Typ geloggt und beruehrt
   weder Arbeitsgewichte noch den A/B-Wechsel.                          */

function starteWod(seed) {
  wodSeed = seed >>> 0;
  wod = WOD.generateWod(state, wodSeed);
  swSek = 0; stopUhr();
  $('sw-time').textContent = '0:00';
  $('wod-finish').disabled = true;
  renderWod();
  show('wod');
}

function renderWod() {
  $('wod-body').innerHTML = `
    <div class="card">
      <div class="kicker">${wod.dauer ? `${wod.dauer} Minuten` : wod.runden > 1 ? `${wod.runden} Runden` : 'Auf Zeit'}</div>
      <div class="wod-format">${wod.format.toUpperCase()}</div>
      <p class="txt" style="color:var(--muted);margin:0 0 6px">${wod.beschreibung}</p>
      ${wod.teile.map(t => `
        <div class="wod-teil">
          <span class="menge">${t.menge ? `${t.menge} ${t.einheit}` : '20/10'}</span>
          <span class="bez"><b>${t.name}</b>
            ${t.last ? `<span class="last">${P.fmtWeight(t.last)}</span>` : ''}
            <span class="c">${t.cue}</span>
          </span>
        </div>`).join('')}
    </div>
    <button id="sw-start" class="btn">${swLaeuft ? 'Läuft…' : 'Uhr starten'}</button>
    <p class="fine">Nicht zufrieden? Oben rechts neu würfeln. Das WOD zählt nicht in die 5x5-Progression —
    es taucht in der Historie auf, verschiebt aber weder deine Gewichte noch den A/B-Wechsel.</p>`;
  $('sw-start').onclick = startUhr;
}

function startUhr() {
  if (swLaeuft) return;
  swLaeuft = true;
  $('stopwatch').hidden = false;
  $('sw-toggle').textContent = 'STOPP';
  $('wod-finish').disabled = false;
  clearInterval(swTimer);
  swTimer = setInterval(() => {
    swSek++;
    $('sw-time').textContent = `${Math.floor(swSek / 60)}:${String(swSek % 60).padStart(2, '0')}`;
  }, 1000);
  renderWod();
}

function stopUhr() {
  swLaeuft = false;
  clearInterval(swTimer);
  $('sw-toggle').textContent = 'WEITER';
  if (swSek === 0) $('stopwatch').hidden = true;
}

async function wodAbschliessen() {
  stopUhr();
  const log = {
    date: P.ymd(new Date()),
    type: 'wod',
    label: WOD.wodLabel(wod),
    dauerSekunden: swSek,
    seed: wodSeed,
    wod,
    finished: new Date().toISOString()
  };
  state = P.applyLog(state, config, log);
  S.cache({ state });
  $('stopwatch').hidden = true;
  $('done-body').innerHTML = `
    <div class="card">
      <div class="kicker">${log.date} · WOD</div>
      <div class="name">${Math.floor(swSek / 60)}:${String(swSek % 60).padStart(2, '0')}</div>
      <ul>${wod.teile.map(t => `<li><span>${t.name}</span><span>${t.menge ? `${t.menge} ${t.einheit}` : '20/10'}</span></li>`).join('')}</ul>
    </div>
    <p class="spruch">Kondition kostet nichts, solange sie am Ende steht. Deine Gewichte sind unberührt.</p>`;
  show('done');
  try {
    await commitWod(log);
    banner('GESPEICHERT', 'ok');
    await uebertrageNachIcu(log);
  } catch { S.queue(log); banner('KEIN NETZ — WIRD NACHGETRAGEN', '', 6000); }
  wod = null;
}

async function commitWod(log) {
  let path = `${S.LOG_DIR}/${log.date}-wod.json`;
  let n = 2;
  while (await S.readFile(path)) path = `${S.LOG_DIR}/${log.date}-wod-${n++}.json`;
  await S.writeFile(path, log, `WOD am ${log.date}`);
  const cur = await S.readFile('state.json');
  await S.writeFile('state.json', state, `Zustand nach WOD ${log.date}`, cur ? cur.sha : stateSha);
}

/* ============================ Auswertung ============================ */

function renderStats(logs) {
  const s = ST.summary(logs);
  const t = s.tonnage >= 1000 ? `${(s.tonnage / 1000).toFixed(1)} t` : `${s.tonnage} kg`;
  $('hist-summary').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">Einheiten</div><div class="v">${s.einheiten}</div>
        <div class="s">${s.kraft} Kraft · ${s.wods} WOD</div></div>
      <div class="stat"><div class="n">Bewegt</div><div class="v">${t}</div>
        <div class="s">Last × Wiederholungen</div></div>
      <div class="stat"><div class="n">Pro Woche</div><div class="v">${s.proWoche ?? '—'}</div>
        <div class="s">${s.von ? `seit ${s.von}` : 'noch keine Daten'}</div></div>
      <div class="stat"><div class="n">Bestwert Kniebeuge</div>
        <div class="v">${s.best.squat ? P.fmtWeight(s.best.squat.weight) : '—'}</div>
        <div class="s">${s.best.squat ? s.best.squat.date : 'noch keiner'}</div></div>
    </div>`;
}

function renderCharts(logs) {
  const teile = Object.keys(config.lifts).map(id => {
    const punkte = ST.serie(logs, id);
    if (punkte.length < 2) return '';   // eine Linie aus einem Punkt sagt nichts
    const sp = ST.sparkline(punkte, 300, 60);
    const letzter = punkte[punkte.length - 1];
    const delta = letzter.weight - punkte[0].weight;
    return `<div class="chart">
      <div class="h"><span class="t">${config.lifts[id].name}</span>
        <span class="r">${P.fmtWeight(letzter.weight)} ${delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : ''}</span></div>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="${sp.flaeche}" fill="rgba(0,229,255,.13)"/>
        <path d="${sp.linie}" fill="none" stroke="var(--cyan)" stroke-width="2"
              stroke-linejoin="round" stroke-linecap="round"/>
        ${sp.koord.map(k => `<circle cx="${k.x.toFixed(1)}" cy="${k.y.toFixed(1)}" r="2.5"
              fill="${k.success === false ? 'var(--amber)' : 'var(--cyan)'}"/>`).join('')}
      </svg>
      <div class="h" style="margin:6px 0 0"><span class="t">${sp.min} kg</span><span class="t">${sp.max} kg</span></div>
    </div>`;
  }).join('');
  $('hist-charts').innerHTML = teile || '<p class="fine">Verläufe erscheinen ab der zweiten Einheit je Übung.</p>';
}

function renderListe(logs) {
  const sortiert = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  $('history-body').innerHTML = sortiert.length ? sortiert.map(l => {
    if (l.type && l.type !== 'strength') {
      const m = l.dauerSekunden ? `${Math.floor(l.dauerSekunden / 60)}:${String(l.dauerSekunden % 60).padStart(2, '0')}` : '—';
      return `<div class="hist wod"><div class="d">${l.date} · WOD · ${m}</div>
        <div class="l">${l.label || ''}</div></div>`;
    }
    return `<div class="hist"><div class="d">${l.date} · WORKOUT ${l.workout}</div>
      <div class="l">${(l.lifts || []).map(e =>
        `${(config.lifts[e.lift] || {}).name || e.lift} ${P.fmtWeight(e.weight)} (${(e.reps || []).join('/')})`).join(' · ')}</div>
    </div>`;
  }).join('') : '<p class="lead">Noch keine Einheit protokolliert.</p>';
}


/* ================= Gewicht waehrend des Trainings ================= */

/**
 * Die Stange lügt nicht: wenn 55 kg heute nicht gehen, wird 52,5 geloggt.
 * Das Protokoll bildet ab, was passiert ist — und die Progression rechnet
 * beim nächsten Mal von dort weiter, weil sie aus dem Log abgeleitet wird.
 */
function aendereGewicht(li, richtung) {
  const l = session.lifts[li];
  const schritt = config.lifts[l.lift].increment;
  const neu = Math.max(config.bar, P.roundTo(l.weight + richtung * schritt, config.rounding));
  if (neu === l.weight) return;
  l.weight = neu;
  const offen = [...$('session-body').querySelectorAll('details.info')].map(d => d.open);
  renderSession();
  $('session-body').querySelectorAll('details.info').forEach((d, i) => d.open = !!offen[i]);
}

/* ================= Max-Out ================= */

function starteMaxout() {
  mo = { lift: mo.lift || 'squat' };
  $('mo-weight').value = '';
  $('mo-reps').value = '1';
  renderMaxoutLifts();
  renderMaxoutErgebnis();
  show('maxout');
}

function renderMaxoutLifts() {
  $('mo-lifts').innerHTML = Object.entries(config.lifts).map(([id, def]) => `
    <div class="w waehlbar ${id === mo.lift ? 'gewaehlt' : ''}" data-lift="${id}">
      <div class="n">${def.name}</div>
      <div class="v">${P.fmtWeight(state.lifts[id].weight)}</div>
      <div class="f" style="color:var(--dim)">aktuelles Arbeitsgewicht</div>
    </div>`).join('');
  $('mo-lifts').querySelectorAll('[data-lift]').forEach(el => {
    el.onclick = () => { mo.lift = el.dataset.lift; renderMaxoutLifts(); renderMaxoutErgebnis(); };
  });
}

function renderMaxoutErgebnis() {
  const w = parseFloat($('mo-weight').value);
  const r = parseInt($('mo-reps').value, 10);
  const max = P.e1rm(w, r);
  const box = $('mo-result');

  if (!max) {
    box.innerHTML = `<p class="fine">Gewicht und Wiederholungen eintragen (1 bis 12).
      Über 12 Wiederholungen ist jede Schätzung Kaffeesatz — dann gibt es bewusst keine.</p>`;
    $('mo-save').disabled = true;
    return;
  }

  const vorschlag = P.arbeitsgewichtAus(max, config.rounding, config.bar);
  const jetzt = state.lifts[mo.lift].weight;
  const formel = P.e1rmFormel(r);
  const alt = alleLogs.length ? ST.prs(alleLogs)[mo.lift] : null;
  const bisher = alt && alt.maximum ? alt.maximum.wert : null;

  box.innerHTML = `
    <div class="card">
      <div class="kicker">Geschätztes Einer-Maximum · ${formel}</div>
      <div class="name neon">${max}<span style="font-size:20px"> kg</span></div>
      ${bisher ? `<p class="fine">${max > bisher
        ? `<b style="color:var(--lime)">Neuer Bestwert.</b> Bisher ${bisher} kg.`
        : `Bisheriger Bestwert: ${bisher} kg.`}</p>` : ''}
      <ul>
        <li><span>Arbeitsgewicht für 5×5 (80 %)</span><span>${P.fmtWeight(vorschlag)}</span></li>
        <li><span>Aktuell eingestellt</span><span>${P.fmtWeight(jetzt)}</span></li>
      </ul>
      <label style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;font-size:14px;color:var(--muted)">
        <input type="checkbox" id="mo-apply" style="width:auto;margin:3px 0 0">
        <span>Arbeitsgewicht auf <b style="color:var(--cyan)">${P.fmtWeight(vorschlag)}</b> setzen.
        Ohne Haken bleibt alles, wie es ist — der Test wird nur protokolliert.</span>
      </label>
    </div>`;
  $('mo-save').disabled = false;
}

async function speichereMaxout() {
  const w = parseFloat($('mo-weight').value);
  const r = parseInt($('mo-reps').value, 10);
  const max = P.e1rm(w, r);
  if (!max) return;
  const uebernehmen = $('mo-apply') && $('mo-apply').checked;

  const log = {
    date: P.ymd(new Date()),
    type: 'maxout',
    lift: mo.lift,
    weight: w,
    reps: r,
    e1rm: max,
    formel: P.e1rmFormel(r),
    finished: new Date().toISOString()
  };
  if (uebernehmen) log.newWorking = P.arbeitsgewichtAus(max, config.rounding, config.bar);

  const vorher = state.lifts[mo.lift].weight;
  state = P.applyLog(state, config, log);
  S.cache({ state });

  $('done-body').innerHTML = `
    <div class="card">
      <div class="kicker">${log.date} · Max-Out · ${config.lifts[mo.lift].name}</div>
      <div class="name neon">${w} × ${r}</div>
      <ul>
        <li><span>Geschätztes Maximum (${log.formel})</span><span>${max} kg</span></li>
        <li><span>Arbeitsgewicht</span><span>${uebernehmen
          ? `${P.fmtWeight(vorher)} → ${P.fmtWeight(state.lifts[mo.lift].weight)}`
          : `bleibt ${P.fmtWeight(vorher)}`}</span></li>
      </ul>
    </div>
    <p class="spruch">Ein Maximum ist eine Momentaufnahme, kein Charakterzeugnis. Morgen zählt wieder der saubere Satz.</p>`;
  show('done');

  try { await commitMaxout(log); banner('GESPEICHERT', 'ok'); }
  catch { S.queue(log); banner('KEIN NETZ — WIRD NACHGETRAGEN', '', 6000); }
}

async function commitMaxout(log) {
  let path = `${S.LOG_DIR}/${log.date}-maxout-${log.lift}.json`;
  let n = 2;
  while (await S.readFile(path)) path = `${S.LOG_DIR}/${log.date}-maxout-${log.lift}-${n++}.json`;
  await S.writeFile(path, log, `Max-Out ${config.lifts[log.lift].name} am ${log.date}`);
  const cur = await S.readFile('state.json');
  await S.writeFile('state.json', state, `Zustand nach Max-Out ${log.date}`, cur ? cur.sha : stateSha);
}

/* ================= Bestwerte ================= */

function renderPRs(logs) {
  const p = ST.prs(logs);
  const zeilen = Object.entries(config.lifts).map(([id, def]) => {
    const e = p[id];
    if (!e) return `<div class="pr"><div class="k">${def.name}</div>
      <div class="reihe"><span class="l">Noch kein Wert</span><span class="v">—</span></div></div>`;
    const z = (label, wert, zusatz) =>
      `<div class="reihe"><span class="l">${label}</span><span class="v">${wert}${zusatz ? `<small>${zusatz}</small>` : ''}</span></div>`;
    return `<div class="pr">
      <div class="k">${def.name}</div>
      ${e.arbeit ? z('Schwerster sauberer Satz', P.fmtWeight(e.arbeit.weight), e.arbeit.date) : z('Schwerster sauberer Satz', '—')}
      ${e.gemessen ? z('Gemessenes Einzel', P.fmtWeight(e.gemessen.weight), e.gemessen.date) : ''}
      ${e.maximum ? z('Geschätztes Maximum', `${e.maximum.wert} kg`,
          `${e.maximum.weight}×${e.maximum.reps} · ${e.maximum.formel}`) : ''}
      ${def.reference ? z('Alter Referenzwert', P.fmtWeight(def.reference)) : ''}
    </div>`;
  }).join('');
  $('hist-prs').innerHTML = zeilen;
}

/* ================= Scheiben und Form ================= */

/** Was pro Seite auf die Stange gehört — spart Rechnen zwischen den Sätzen. */
function plattenZeile(gewicht) {
  const t = P.plattenText(gewicht, config);
  if (!t) return `<p class="platten nicht">Mit deinen Scheiben nicht exakt ladbar.</p>`;
  if (t === 'leere Stange') return `<p class="platten">Leere Stange</p>`;
  return `<p class="platten">Pro Seite: <b>${t}</b></p>`;
}

/** Form aus intervals.icu — ein Hinweis, keine Anweisung. */
function formZeile() {
  if (!form) return '';
  const farbe = { frisch: 'var(--lime)', neutral: 'var(--muted)', muede: 'var(--amber)', platt: 'var(--red)' }[form.stufe];
  return `<p class="formzeile" style="border-top-color:${farbe}">
    <span class="fw" style="color:${farbe}">Form ${form.form > 0 ? '+' : ''}${form.form}</span>
    <span class="ft">${form.text}</span>
    <span class="fd">Fitness ${form.fitness} · Ermüdung ${form.ermuedung} · aus intervals.icu</span>
  </p>`;
}

/* ================= Übertragung nach intervals.icu ================= */

/**
 * Nach dem lokalen Speichern: Einheit als Aktivität nach intervals.icu.
 * Läuft bewusst NACH dem Commit und schluckt Fehler nicht — aber sie
 * dürfen das lokale Protokoll nie gefährden, das bleibt die Wahrheit.
 */
async function uebertrageNachIcu(log) {
  if (!ICU.pushAktiv() || !ICU.isConfigured()) return;
  const aktivitaet = ICU.alsAktivitaet(log, config);
  if (!aktivitaet) return;                       // ohne Dauer keine erfundene Last
  try {
    await ICU.pushAktivitaet(aktivitaet);
    banner(`AN INTERVALS.ICU · LAST ${aktivitaet.icu_training_load}`, 'ok', 4000);
  } catch (e) {
    banner(`INTERVALS.ICU: ${e.message}`, 'err', 7000);
  }
}

/* ================= Radfahrten ================= */

/**
 * Die Fahrten kommen fertig aus intervals.icu — hier werden sie nur
 * sichtbar gemacht. Ohne diese Ansicht hat man zwei Trainingsleben
 * und sieht immer nur eines davon.
 */
function renderRad() {
  const box = $('hist-rad');
  if (!box) return;

  let fahrten = alleFahrten;
  if (!fahrten.length) {
    const c = S.cached();
    if (c.fahrten && c.fahrten.length) fahrten = c.fahrten;
  }

  if (!ICU.isConfigured()) {
    box.innerHTML = '<p class="fine">intervals.icu ist nicht verbunden — trag den Key oben unter „Verbindungen" ein.</p>';
    return;
  }
  if (!fahrten.length) {
    box.innerHTML = '<p class="fine">Keine Radeinheit in den letzten 90 Tagen.</p>';
    return;
  }

  const st = ST.radStats(fahrten);
  const wochen = ST.radWochen(fahrten, 12);
  const maxLast = Math.max(1, ...wochen.map(w => w.last));
  const breite = 300, hoehe = 64, luecke = 3;
  const bw = (breite - luecke * (wochen.length - 1)) / wochen.length;

  const balken = wochen.map((w, i) => {
    const h = Math.max(w.last > 0 ? 2 : 0, (w.last / maxLast) * hoehe);
    const x = i * (bw + luecke);
    return `<rect x="${x.toFixed(1)}" y="${(hoehe - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
      fill="${i === wochen.length - 1 ? 'var(--cyan)' : 'var(--magenta)'}" opacity="${w.last ? 0.85 : 0.25}"/>`;
  }).join('');

  const sortiert = [...fahrten].sort((a, b) => b.date.localeCompare(a.date));

  box.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">Fahrten</div><div class="v">${st.anzahl}</div>
        <div class="s">${st.proWoche ?? '—'} pro Woche</div></div>
      <div class="stat"><div class="n">Zeit im Sattel</div><div class="v">${st.stunden}<span style="font-size:14px"> h</span></div>
        <div class="s">${st.km} km</div></div>
    </div>
    <div class="radbar">
      <div class="h"><span class="t">Wochenlast · 12 Wochen</span><span class="r">${st.last} gesamt</span></div>
      <svg viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none" aria-hidden="true">${balken}</svg>
      <div class="h" style="margin:7px 0 0">
        <span class="t">${wochen[0].woche.slice(5)}</span>
        <span class="t">diese Woche</span></div>
    </div>
    ${sortiert.slice(0, 20).map(r => `
      <div class="fahrt">
        <div class="d">${r.date}${r.load ? ` · LOAD ${r.load}` : ''}</div>
        <div class="n">${r.name}</div>
        <div class="m">${r.minutes} Min · ${r.km} km</div>
      </div>`).join('')}
    ${sortiert.length > 20 ? `<p class="fine">${sortiert.length - 20} weitere nicht gezeigt.</p>` : ''}`;
}

/* ================= Darstellung ================= */

const THEMA_KEY = 'lifty.theme';

/** 'auto' folgt dem System, sonst die ausdrückliche Wahl. */
function themaWahl() { return localStorage.getItem(THEMA_KEY) || 'dunkel'; }

function themaAnwenden() {
  const wahl = themaWahl();
  const hell = wahl === 'hell' ||
    (wahl === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  if (hell) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', hell ? '#eceff4' : '#04060a');
  renderThemenSchalter();
}

function renderThemenSchalter() {
  const wahl = themaWahl();
  document.querySelectorAll('.themen button').forEach(b =>
    b.classList.toggle('an', b.dataset.thema === wahl));
}

document.querySelectorAll('.themen button').forEach(b => {
  b.onclick = () => {
    localStorage.setItem(THEMA_KEY, b.dataset.thema);
    themaAnwenden();
    banner(`DARSTELLUNG: ${b.textContent.toUpperCase()}`, 'ok', 2000);
  };
});

// Systemwechsel mitbekommen, solange 'System' gewählt ist.
window.matchMedia('(prefers-color-scheme: light)')
  .addEventListener('change', () => { if (themaWahl() === 'auto') themaAnwenden(); });

themaAnwenden();
