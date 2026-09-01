import * as P from './program.js';
import * as S from './store.js';
import * as ICU from './intervals.js';
import * as C from './coach.js';
import { LIFT_INFO, WARMUP, SKILL, MOBILITY, FINISHER, RIDE_INFO } from './content.js';
import * as WOD from './wod.js';
import * as ST from './stats.js';
import * as B from './bibliothek.js';
import { t, locale, sprache, setSprache, uebersetzeStatisch } from './i18n.js';
import * as G from './geraete.js';
import { escHtml, sicherLink } from './sicher.js';
import * as A from './aktualisierung.js';

let config = null, state = null, stateSha = null, session = null;
let ridesByDate = new Map(), letzterLog = null, trend = null;
// Sichtbarer Zustand der intervals.icu-Anbindung. Vorher verschwanden
// Fehler in der Konsole, und man konnte nicht unterscheiden zwischen
// "nicht verbunden", "kaputt" und "diese Woche einfach nichts gefahren".
let icu = { stand: 'aus', text: '', letzte: null, anzahl: 0 };
// Woher die angezeigten Daten wirklich stammen. Eine gruene Kachel, die nur
// den Zwischenspeicher meint, waere eine Luege.
let datenQuelle = 'keine';
// null = noch nicht geprueft oder nicht feststellbar. Nur ein echtes true
// loest die Warnung aus — eine geratene Warnung waere schlimmer als keine.
let repoOeffentlich = null;
let restTimer = null, restLeft = 0;
// Manuell gewaehltes Workout. Nur fuer diese eine Einheit — der Automat
// bleibt die Wahrheit darueber, was eigentlich dran waere.
let workoutOverride = null;
let wod = null, wodSeed = 0, swTimer = null, swSek = 0, swLaeuft = false;
let alleLogs = [];              // zuletzt geladene Einheiten, fuer Bestwerte
let mo = { lift: 'squat' };     // laufender Krafttest
let form = null;                // Form aus intervals.icu (ctl - atl)
let erholung = null;            // HRV/Schlaf aus intervals.icu, gegen die eigene Basis
let alleFahrten = [];           // Radfahrten der letzten 90 Tage
let stoerung = null;            // Interferenz Rad -> Eisen
let stimme = null;              // deine eigenen Zeilen aus stimme.json
let gewichtsPunkte = [];        // Rohwerte fuer die Gewichtskurve
let formPunkte = [];            // Fitness und Ermuedung ueber die Zeit
let eftp = null;                // geschaetzte FTP, fuer Wattziele
let bibliothek = {};            // eigene Notizen/Videos je Uebung, aus bibliothek.json
let bibZufall = null, bibKategorie = null;

const $ = id => document.getElementById(id);
// Feste Beschriftungen sofort in der gewaehlten Sprache — vor dem ersten
// Rendern, damit nichts kurz auf Deutsch aufblitzt.
uebersetzeStatisch();
const VERSION_KEY = 'setlist.version';
let laufendeVersion = localStorage.getItem(VERSION_KEY) || '—';
const VIEWS = ['setup', 'home', 'session', 'wod', 'maxout', 'done', 'history', 'bibliothek'];
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
    const [c, st, sti, bib] = await Promise.all([
      S.readFile('config.json'), S.readFile('state.json'), S.readFile('stimme.json'), S.readFile('bibliothek.json')
    ]);
    stimme = sti ? sti.data : null;
    if (!c) throw new Error(t('msg.configFehlt', { repo: S.getRepo() }));
    config = c.data;
    state = st ? st.data : P.initialState(config);
    stateSha = st ? st.sha : null;
    bibliothek = bib ? bib.data : {};
    datenQuelle = 'netz';
    S.cache({ config, state, stimme, bibliothek });
    S.repoOeffentlich().then(oeff => {
      repoOeffentlich = oeff;
      // Kurz im Banner — die ganze Erklaerung samt Weg zur Einstellung
      // steht unter Verbindungen, wo man sie in Ruhe lesen kann.
      if (oeff) banner(t('conn.gh.oeffentlichKurz', { repo: S.getRepo() }), 'err', 12000);
      renderConnections();
    });
  } catch (e) {
    const c = S.cached();
    if (c.config) {
      config = c.config; state = c.state; stimme = c.stimme || null; stateSha = null;
      bibliothek = c.bibliothek || {};
      datenQuelle = 'cache';
      banner(t('msg.offline'), '', 4000);
    } else {
      banner(e.message, 'err', 9000);
      return show('setup');
    }
  }
  // Fahrten und Form aus dem Zwischenspeicher, damit Interferenz und
  // Formhinweis auch ohne Netz stehen. Beides wird gleich aufgefrischt,
  // aber ein leerer Bildschirm im Funkloch waere die schlechtere Antwort.
  const zwischen = S.cached();
  if (zwischen.fahrten && zwischen.fahrten.length) {
    alleFahrten = zwischen.fahrten;
    stoerung = C.interferenz(zwischen.fahrten);
  }
  if (zwischen.form) form = zwischen.form;
  if (zwischen.erholung) erholung = zwischen.erholung;
  if (zwischen.gewicht) gewichtsPunkte = zwischen.gewicht;
  if (zwischen.formVerlauf) formPunkte = zwischen.formVerlauf;
  if (zwischen.eftp) eftp = zwischen.eftp;

  await flushQueue();
  renderHome();
  show('home');
  loadIntervals();
  pruefeUrsprung();
}

/** Nur Beiwerk: Fehler hier duerfen die App nie blockieren — aber sichtbar sein. */
async function loadIntervals() {
  if (!ICU.isConfigured()) {
    icu = { stand: 'aus', text: t('conn.icu.aus') };
    renderIcuStatus();
    return;
  }
  icu = { stand: 'laedt', text: t('tour.laedt') };
  renderIcuStatus();
  await verarbeiteIcuQueue();

  try {
    // Bewusst 90 Tage statt nur der laufenden Woche: sonst sieht man bei
    // einer Trainingspause gar nichts und haelt die Anbindung fuer kaputt.
    const bis = new Date(), von = new Date();
    von.setDate(von.getDate() - 90);
    const alle = await ICU.rides(P.ymd(von), P.ymd(bis));
    alleFahrten = alle;
    stoerung = C.interferenz(alle);
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
    gewichtsPunkte = roh.filter(w => w.weight).map(w => ({ date: w.date, weight: w.weight }));
    S.cache({ gewicht: gewichtsPunkte });
    formPunkte = ST.formVerlauf(roh);
    S.cache({ formVerlauf: formPunkte });
    trend = C.gewichtsTrend(roh);
    form = C.formLage(ICU.letzteForm(roh));
    erholung = C.erholung(roh);
    const mitFtp = [...roh].filter(w => w.eftp).sort((a, b) => b.date.localeCompare(a.date))[0];
    eftp = mitFtp ? Math.round(mitFtp.eftp) : null;
    S.cache({ form, erholung, eftp });
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
    el.innerHTML = `<p class="fine">${t('icu.aus')}</p>`;
    return;
  }
  if (icu.stand === 'laedt') { el.innerHTML = `<p class="fine">${t('icu.laedt')}</p>`; return; }
  if (icu.stand === 'fehler') {
    el.innerHTML = `<p class="fine" style="color:var(--rot)">intervals.icu: ${escHtml(icu.text)}</p>`;
    return;
  }

  if (!icu.letzte) {
    el.innerHTML = `<p class="fine">${t('icu.keineFahrten')}</p>`;
    return;
  }
  const tage = C.daysSince(icu.letzte.date, new Date());
  const lange = tage > 21;
  const wann = tage === 0 ? t('icu.heute') : tage === 1 ? t('icu.einTag') : t('icu.tage', { n: tage });
  el.innerHTML = `<p class="fine">
    ${tage === 0 ? t('icu.zuletzt') : t('icu.davor')} <b class="num" style="color:${lange ? 'var(--rost)' : 'var(--akzent)'}">${wann}</b>
    — ${escHtml(icu.letzte.name)} · ${escHtml(icu.letzte.minutes)} Min · ${escHtml(icu.letzte.km)} km.
    ${t(icu.anzahl === 1 ? 'icu.fahrtenIn90' : 'icu.fahrtenIn90.mehr', { n: icu.anzahl })}
    ${lange ? `<br>${t('icu.radRuht')}` : ''}
  </p>`;
}

/** Verbindungsuebersicht unter ≡. */
function renderConnections() {
  const box = $('conn-box');
  if (!box) return;
  const zeile = (name, stand, text) => `<div class="conn">
      <span class="dot ${stand}"></span>
      <span class="b"><span class="n">${escHtml(name)}</span><span class="s">${escHtml(text)}</span></span>
    </div>`;
  const gh = repoOeffentlich === true
    ? ['fehler', t('conn.gh.oeffentlich', { repo: S.getRepo() })]
    : datenQuelle === 'netz'
    ? ['ok', t('conn.gh.ok', { repo: S.getRepo() })]
    : datenQuelle === 'cache'
      ? ['aus', t('conn.gh.cache')]
      : ['fehler', t('conn.gh.fehler')];

  const n = icu.anzahl;
  const push = ICU.pushAktiv();
  box.innerHTML =
    zeile('GitHub', gh[0], gh[1]) +
    zeile('intervals.icu', icu.stand === 'laedt' ? 'aus' : (icu.stand === 'ok' ? 'ok' : icu.stand),
      icu.stand === 'ok'
        ? `${t(n === 1 ? 'conn.icu.ok' : 'conn.icu.ok.mehr', { n })}${icu.letzte ? t('conn.icu.zuletzt', { datum: icu.letzte.date }) : ''}.`
        : icu.stand === 'fehler' ? icu.text : t('conn.icu.aus')) +
    `<div class="conn">
       <span class="dot ${push && icu.stand === 'ok' ? 'ok' : 'aus'}"></span>
       <span class="b">
         <span class="n">${t('conn.push.name')}</span>
         <span class="s">${icu.stand === 'ok'
           ? (push ? t('conn.push.an') : t('conn.push.aus'))
           : t('conn.push.ohne')}</span>
         <label class="schalter">
           <input type="checkbox" id="icu-push" ${push ? 'checked' : ''} ${icu.stand === 'ok' ? '' : 'disabled'}>
           <span>${t('conn.push.schalter')}</span>
         </label>
       </span>
     </div>`;
  const cb = $('icu-push');
  if (cb) cb.onchange = () => {
    ICU.setPushAktiv(cb.checked);
    banner(t(cb.checked ? 'conn.push.an.banner' : 'conn.push.aus.banner'), 'ok');
    renderConnections();
  };
}

/* ============================ Home ============================ */

function renderHome() {
  const d = C.directive(state, config, new Date(), letzterLog, stimme, erholung);

  $('directive').innerHTML = `
    <div class="directive">
      <span class="tone ${d.intensitaet.stufe}">${d.intensitaet.label} · ${d.kopf}</span>
      <p class="txt">${d.intensitaet.text}</p>
      ${formZeile()}
      ${erholungsZeile()}
      ${stoerungsZeile()}
    </div>
    ${meilensteinKarte()}
    <p class="spruch">${zeileFuerHeute(d)}</p>`;

  const gewaehlt = workoutOverride || state.next;
  const plan = P.planWorkout(state, config, gewaehlt);
  $('swap-workout').textContent = `Workout ${gewaehlt === 'A' ? 'B' : 'A'}`;
  $('today').innerHTML = `
    <div class="kicker">${t(workoutOverride ? 'home.selbstGewaehlt' : 'home.alsNaechstes')}</div>
    <div class="name neon">WORKOUT ${plan.workout}</div>
    <ul>${plan.lifts.map(l => `
      <li><span>${escHtml(l.name)} <span class="num">${l.sets}×${l.reps}</span></span><span>${P.fmtWeight(l.weight)}</span></li>
    `).join('')}</ul>
    <button id="start" class="btn">${t('home.starten')}</button>`;
  $('start').onclick = startSession;

  const motto = config.motto;
  $('motto').innerHTML = motto ? `<p class="motto">${escHtml(motto)}</p>` : '';
  renderProgress(d.fortschritt, d.streak);
  renderWeek();
  renderIcuStatus();
  renderWeights(d.fortschritt);
}

function renderProgress(f, streak) {
  const pct = Math.round(f.gesamt * 100);
  $('progress').innerHTML = `
    <div class="card">
      <div class="kicker">${t('home.fortschritt.kicker')}</div>
      <div class="name">${pct}<span style="font-size:20px">%</span></div>
      <div class="bar gruen"><i style="width:${pct}%"></i></div>
      <p class="fine">${t('home.fortschritt.fine')} ${streak > 0
        ? `<b style="color:var(--gruen)">${t(streak === 1 ? 'home.fortschritt.serie' : 'home.fortschritt.serien', { n: streak })}</b>`
        : t('home.fortschritt.keineSerie')}</p>
    </div>`;
}

function renderWeights(f) {
  $('weights').innerHTML = Object.entries(config.lifts).map(([id, def]) => {
    const s = state.lifts[id];
    const anteil = f.perLift[id] ? Math.round(f.perLift[id].anteil * 100) : null;
    return `<div class="w">
      <div class="n">${escHtml(def.name)}</div>
      <div class="v">${P.fmtWeight(s.weight)}</div>
      ${s.fails ? `<div class="f">${t('home.offen', { n: s.fails })}</div>` : ''}
      ${anteil !== null ? `<div class="mini"><i style="width:${anteil}%"></i></div>
        <div class="f" style="color:var(--dim)">${t('home.vonReferenz', { p: anteil, kg: def.reference })}</div>` : ''}
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
        <span class="day">${escHtml(s.day)}</span>
        <span class="what">${done ? '✓ ' : ''}${escHtml(s.label)}
          <span class="detail">${ride
            ? `<span class="ride-done">${escHtml(ride.minutes)} MIN · ${escHtml(ride.km)} KM${ride.load ? ` · LOAD ${escHtml(ride.load)}` : ''}</span>`
            : escHtml(s.detail) + wattZiel(s.label)}</span>
        </span>
      </div>
      ${info && !done ? `<details class="info"><summary>${t('home.warumEinheit')}</summary>
        <div class="body"><p>${info.warum}</p>
        <div class="kv"><span class="k">${t('home.achtung')}</span><span class="v">${info.achtung}</span></div></div></details>` : ''}`;
  }).join('');
}

function renderBodyTrend() {
  if (!trend) { $('body-trend').innerHTML = ''; return; }
  const runter = trend.delta !== null && trend.delta < 0;

  // Eine Zahl sagt, wo du stehst. Eine Kurve sagt, wohin es geht — und bei
  // Koerpergewicht ist ausschliesslich Letzteres interessant.
  const punkte = gewichtsPunkte.length > 1
    ? ST.sparkline([...gewichtsPunkte].sort((a, b) => a.date.localeCompare(b.date)), 300, 56)
    : null;

  $('body-trend').innerHTML = `
    <h2>${t('tour.koerpergewicht')}</h2>
    <div class="card">
      <div class="kicker">${t('gew.kicker', { n: trend.n })}</div>
      <div class="name">${trend.aktuell}<span style="font-size:20px"> kg</span></div>
      ${punkte ? `<svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true"
            style="display:block;width:100%;height:56px;margin-top:10px;overflow:visible">
          <path d="${punkte.flaeche}" fill="${runter ? 'var(--tint-gruen)' : 'var(--tint-rost)'}"/>
          <path d="${punkte.linie}" fill="none" stroke="${runter ? 'var(--gruen)' : 'var(--rost)'}"
                stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
        <div style="display:flex;justify-content:space-between;margin-top:5px">
          <span class="kicker">${punkte.min} kg</span><span class="kicker">${punkte.max} kg</span>
        </div>` : ''}
      ${trend.delta !== null ? `<p class="fine" style="color:${runter ? 'var(--gruen)' : 'var(--rost)'}">
        ${t('gew.delta', { d: `${trend.delta > 0 ? '+' : ''}${trend.delta}` })}
        ${t(runter ? 'gew.runter' : 'gew.hoch')}</p>` : ''}
    </div>`;
}

/* ============================ Einheit ============================ */

function startSession() {
  const plan = P.planWorkout(state, config, workoutOverride || state.next);
  const d = C.directive(state, config, new Date(), letzterLog, stimme, erholung);
  session = {
    date: P.ymd(new Date()), started: new Date().toISOString(),
    workout: plan.workout,
    angesagt: d.intensitaet.label,  // fuer den Abgleich mit dem gefuehlten Aufwand danach
    // planWeight bleibt stehen, damit sichtbar wird, was abweicht.
    lifts: plan.lifts.map(l => ({ ...l, planWeight: l.weight, done: [] }))
  };
  $('session-title').textContent = `WORKOUT ${plan.workout}`;

  $('session-intent').innerHTML = `
    <div class="directive"><span class="tone ${d.intensitaet.stufe}">${d.intensitaet.label}</span>
    <p class="txt">${d.intensitaet.text}</p>${stoerungsZeile()}</div>`;

  const skill = C.tagesAuswahl(SKILL, new Date(), 'skill');
  const mobility = C.mobilityDran(state) ? C.tagesAuswahl(MOBILITY, new Date(), 'mob') : null;
  $('warmup').innerHTML = `
    <details class="info" open><summary>${t('ses.soundcheck')}</summary>
      <div class="body">
        ${WARMUP.allgemein.concat(WARMUP[plan.workout]).map((w, i) =>
          `<label class="kv check"><input type="checkbox" data-w="${i}">
            <span class="k">${w.t}</span><span class="v"><b>${w.was}</b> — ${w.detail}</span></label>`).join('')}
      </div>
    </details>
    <details class="info"><summary>${t('ses.waermsaetze')}</summary>
      <div class="body">
        ${plan.lifts.map(l => `
          <p class="tagline" style="margin:12px 0 4px"><b>${escHtml(l.name)}</b> → ${P.fmtWeight(l.weight)}</p>
          ${P.waermsaetze(l.weight, config).map(w => {
            const pt = P.plattenText(w.weight, config);
            return `<div class="kv">
              <span class="k">${w.saetze > 1 ? w.saetze + '×' : ''}${t('ses.wdh', { n: w.reps })}</span>
              <span class="v"><b>${P.fmtWeight(w.weight)}</b>${pt ? ` — ${pt}` : ''}</span></div>`;
          }).join('')}`).join('')}
        <p style="color:var(--dim);margin-top:12px">${t('ses.scheibenHinweis', { kg: config.bar })}</p>
      </div>
    </details>
    <details class="info"><summary>${t('ses.technik', { name: skill.name })}</summary>
      <div class="body">
        <p class="tagline"><b>${skill.name}</b> · ${skill.dosis}</p>
        <p>${skill.warum}</p>
        <p style="color:var(--dim)">${t('ses.technikHinweis')}</p>
      </div>
    </details>
    ${mobility ? `<details class="info"><summary>${t('ses.mobility', { name: mobility.name })}</summary>
      <div class="body">
        <p class="tagline"><b>${mobility.name}</b> · ${mobility.dosis}</p>
        <p>${mobility.warum}</p>
      </div>
    </details>` : ''}`;
  $('warmup').querySelectorAll('.kv.check input').forEach(cb => {
    cb.onchange = () => cb.closest('.kv').classList.toggle('erledigt', cb.checked);
  });

  const fin = C.tagesAuswahl(FINISHER, new Date(), 'fin');
  $('finisher').innerHTML = `
    <details class="info"><summary>${t('ses.encore', { name: fin.name })}</summary>
      <div class="body">
        <p class="tagline"><b>${fin.name}</b> · ${fin.dosis}</p>
        <p>${fin.warum}</p>
        <p style="color:var(--dim)">${t('ses.encoreHinweis')}</p>
      </div>
    </details>`;

  renderSession();
  show('session');
}

function renderSession() {
  $('session-body').innerHTML = session.lifts.map((l, li) => {
    const i = LIFT_INFO[l.lift] || {};
    return `<div class="lift">
      <div class="bar-head"><span class="ln">${escHtml(i.tag || l.name)}</span>
        <span class="wadj">
          <button data-w="${li}" data-d="-1" aria-label="${t('ses.leichter')}">−</button>
          <span class="lw">${P.fmtWeight(l.weight)}</span>
          <button data-w="${li}" data-d="1" aria-label="${t('ses.schwerer')}">+</button>
        </span></div>
      ${plattenZeile(l.weight)}
      ${l.weight !== l.planWeight
        ? `<p class="cue geaendert">${t('ses.angepasst', { kg: P.fmtWeight(l.planWeight) })}</p>`
        : (i.kadenz ? `<p class="cue">${i.kadenz}</p>` : '')}
      <div class="sets">
        ${Array.from({ length: l.sets }, (_, si) => {
          const r = l.done[si];
          const cls = r === undefined ? '' : (r > l.reps ? 'done plus' : r === l.reps ? 'done' : 'partial');
          return `<button class="set ${cls}" data-l="${li}" data-s="${si}">${r === undefined ? l.reps : r}</button>`;
        }).join('')}
      </div>
      <details class="info"><summary>${t('ses.warum', { name: l.name })}</summary>
        <div class="body">
          <p>${i.warum || ''}</p>
          <div class="kv"><span class="k">${t('ses.cue')}</span><span class="v">${i.cue || ''}</span></div>
          <div class="kv"><span class="k">${t('ses.fehler')}</span><span class="v">${i.fehler || ''}</span></div>
          ${i.oly ? `<div class="kv"><span class="k">OLY</span><span class="v">${i.oly}</span></div>` : ''}
        </div>
      </details>
    </div>`;
  }).join('') + `<p class="fine">${t('ses.tippHinweis', { n: session.lifts[0].reps })}</p>`;

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
  const offenIdx = [...$('session-body').querySelectorAll('details.info')].map(d => d.open);
  if (reps === undefined) delete l.done[si];
  else {
    l.done[si] = reps;
    // Nach dem letzten Satz der ganzen Einheit gibt es nichts mehr, wofuer
    // man pausieren wuerde — der Timer lief bisher trotzdem einfach weiter.
    const fertig = session.lifts.every(x => x.done.length === x.sets && x.done.every(v => v !== undefined));
    if (fertig) stopRest();
    else startRest(reps >= l.reps ? config.rest.normal : config.rest.afterFail);
  }
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
  $('picker-title').textContent = t('ses.picker', { name: l.name, n: si + 1, ziel: l.reps });
  $('picker-opts').innerHTML = Array.from({ length: max + 1 }, (_, n) =>
    `<button data-n="${n}" class="${n === l.reps ? 'ziel' : n > l.reps ? 'mehr' : ''}">${n}</button>`).join('');
  $('picker-opts').querySelectorAll('button').forEach(b => {
    b.onclick = () => { dlg.close(); recordSet(li, si, +b.dataset.n); };
  });
  dlg.showModal();
}

/**
 * Kurzer Ton per Web Audio — keine Audiodatei noetig, aber der Kontext
 * darf laut iOS erst nach einer Nutzergeste starten. Session- und WOD-
 * Start sind selbst schon Nutzergesten, deshalb reicht das lazy Anlegen
 * hier; ein eigener "Sound freischalten"-Tap waere unnoetige Reibung.
 * Respektiert den Stumm-Schalter (anders als die Vibration) — beide
 * zusammen decken beides ab.
 */
let audioCtx = null;
function toene(frequenzen, dauerMs = 160) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    frequenzen.forEach((freq, i) => {
      const start = audioCtx.currentTime + i * (dauerMs / 1000);
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dauerMs / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start); osc.stop(start + dauerMs / 1000);
    });
  } catch { /* Web Audio nicht verfuegbar — Vibration bleibt */ }
}

function startRest(seconds) {
  restLeft = seconds;
  $('rest').hidden = false;
  $('rest-time').textContent = restLeft;
  clearInterval(restTimer);
  restTimer = setInterval(() => {
    restLeft--;
    $('rest-time').textContent = restLeft > 0 ? restLeft : t('ses.los');
    if (restLeft <= 0) {
      clearInterval(restTimer);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      toene([880]);
      setTimeout(stopRest, 2500);
    }
  }, 1000);
}
const stopRest = () => { clearInterval(restTimer); $('rest').hidden = true; };

/** Pause im Lauf verstellen — 90 Sekunden passen nicht zu jedem Satz. */
function verstellePause(delta) {
  restLeft = Math.max(0, restLeft + delta);
  $('rest-time').textContent = restLeft > 0 ? restLeft : t('ses.los');
}

async function finishSession() {
  const log = {
    date: session.date, workout: session.workout,
    started: session.started, finished: new Date().toISOString(),
    angesagt: session.angesagt,
    lifts: session.lifts.map(l => {
      const reps = l.done.slice(0, l.sets).map(r => r ?? 0);
      return { lift: l.lift, weight: l.weight, sets: l.sets, target: l.reps, reps,
               success: reps.length === l.sets && reps.every(r => r >= l.reps) };
    })
  };
  const before = state;
  state = P.applyLog(state, config, log);
  letzterLog = log;
  letzterLogPfad = null;
  S.cache({ state });
  stopRest();
  renderDone(before, log);
  show('done');
  toene([660, 880]);
  try {
    letzterLogPfad = await commit(log);
    banner(t('msg.gespeichert'), 'ok');
    if (ICU.pushAktiv() && ICU.isConfigured()) ICU.queuePush(log);
  } catch { S.queue(log); banner(t('msg.keinNetz'), '', 6000); }
  aktiviereGefuehlChips();
  session = null;
  workoutOverride = null;
}

/** Schreibt die Einheit weg und gibt den tatsaechlich benutzten Pfad
 * zurueck — das Gefuehl danach (siehe waehleGefuehl) muss wissen, wohin. */
async function commit(log) {
  let path = `${S.LOG_DIR}/${log.date}.json`;
  if (await S.readFile(path)) path = `${S.LOG_DIR}/${log.date}-2.json`;
  await S.writeFile(path, log, `Einheit ${log.workout} am ${log.date}`);
  const cur = await S.readFile('state.json');
  await S.writeFile('state.json', state, `Zustand nach ${log.date}`, cur ? cur.sha : stateSha);
  return path;
}

async function flushQueue() {
  const q = S.pending();
  if (!q.length) return;
  try { for (const log of q) await commit(log); S.clearQueue(); banner(t('msg.nachgetragen', { n: q.length }), 'ok'); }
  catch { banner(t('msg.warten', { n: q.length }), '', 5000); }
}

function renderDone(before, log) {
  const d = C.directive(state, config, new Date(), log, stimme, erholung);
  // Erst der Erfolg, dann der Bericht. Eine Tabelle mit Pfeilen sagt, was
  // passiert ist; sie sagt nicht, dass du gerade etwas geschafft hast.
  const wins = C.erfolge(before, state, config, log, alleLogs.concat([log]), new Date());
  const kopf = wins[0];
  const rest = wins.slice(1, 5);

  $('done-body').innerHTML = `
    ${kopf ? `<div class="erfolg-kopf">
      <span class="kicker">Workout ${log.workout} · ${log.date.slice(8)}.${log.date.slice(5,7)}.</span>
      <p class="gross">${escHtml(kopf.text)}</p>
    </div>` : ''}
    ${rest.length ? `<div class="erfolge">${rest.map(w => `<div class="erfolg">${escHtml(w.text)}</div>`).join('')}</div>` : ''}
    <details class="info"><summary>${t('done.geaendert')}</summary>
      <div class="body">
        ${log.lifts.map(e => {
          const b = before.lifts[e.lift].weight, a = state.lifts[e.lift].weight;
          const txt = a > b ? `${P.fmtWeight(a)} ▲` : a < b ? `${P.fmtWeight(a)} ▼ Deload` : t('done.bleibt');
          return `<div class="kv"><span class="k">${e.success ? '✓' : '✕'}</span>
            <span class="v">${escHtml(config.lifts[e.lift].name)} — ${txt}</span></div>`;
        }).join('')}
      </div>
    </details>
    <p class="spruch">${zeileFuerHeute(d)}</p>
    <div class="gefuehl">
      <p class="tagline">${t('done.gefuehlFrage')}</p>
      <div class="chips" id="gefuehl-chips">
        ${['leicht', 'normal', 'hart', 'extrem'].map(g =>
          `<button data-g="${g}" disabled>${gefuehlLabel(g)}</button>`).join('')}
      </div>
    </div>
    <p class="fine">${t('done.naechstes', { w: state.next })}${d.streak > 0 ? t(d.streak === 1 ? 'done.serie' : 'done.serien', { n: d.streak }) : ''}</p>`;
}

const gefuehlLabel = g => t(`gefuehl.${g}`);
let letzterLogPfad = null;   // Pfad der zuletzt gespeicherten Einheit, fuer das Gefuehl danach

/** Erst tippbar, wenn die Einheit wirklich gespeichert ist — sonst
 * verspricht der Knopf etwas, das gerade gar nicht sicher landet. */
function aktiviereGefuehlChips() {
  const box = $('gefuehl-chips');
  if (!box) return;
  box.querySelectorAll('button').forEach(b => {
    b.disabled = !letzterLogPfad;
    b.onclick = () => waehleGefuehl(b.dataset.g);
  });
}

/**
 * Traegt das Gefuehl in die bereits gespeicherte Einheit nach — ein
 * zweiter, kleiner Schreibvorgang statt den ersten aufzuhalten. Die
 * eigentlichen Trainingsdaten (Gewicht, Wiederholungen) sind schon
 * sicher, bevor hier ueberhaupt eine Frage gestellt wird.
 */
async function waehleGefuehl(wert) {
  $('gefuehl-chips').querySelectorAll('button').forEach(b => b.classList.toggle('an', b.dataset.g === wert));
  try {
    const cur = await S.readFile(letzterLogPfad);
    if (!cur) return;
    const log = { ...cur.data, gefuehlt: wert };
    await S.writeFile(letzterLogPfad, log, `Gefühl: ${wert}`, cur.sha);
    if (letzterLog) letzterLog.gefuehlt = wert;
  } catch (e) {
    banner(t('msg.gefuehlFehler', { msg: e.message }), 'err', 5000);
  }
}

/* ============================== Tour ============================== */

async function renderHistory() {
  show('history');
  renderVersion();
  renderConnections();
  renderGymVerwaltung();
  // Ohne geladene Konfiguration gibt es nichts zu zeigen — und der Zugriff
  // auf config.lifts wuerde die ganze Ansicht mit einem leeren Bildschirm
  // quittieren statt mit einer Erklaerung.
  if (!config) {
    $('hist-summary').innerHTML = '';
    $('hist-angeben').innerHTML = '';
    $('hist-prs').innerHTML = '';
    $('hist-ansage').innerHTML = '';
    $('hist-kalender').innerHTML = '';
    $('hist-last').innerHTML = '';
    $('hist-tonnage').innerHTML = '';
    $('hist-form').innerHTML = '';
    $('hist-charts').innerHTML = '';
    $('history-body').innerHTML =
      `<p class="lead">${t('tour.keineVerbindung')}</p>`;
    return;
  }
  $('hist-summary').innerHTML = '';
  $('hist-angeben').innerHTML = '';
  $('hist-prs').innerHTML = '';
  $('hist-ansage').innerHTML = '';
  $('hist-kalender').innerHTML = '';
  $('hist-last').innerHTML = '';
  $('hist-tonnage').innerHTML = '';
  $('hist-form').innerHTML = '';
  $('hist-charts').innerHTML = '';
  $('hist-rad').innerHTML = '';
  $('history-body').innerHTML = `<p class="lead">${t('tour.laedt')}</p>`;
  try {
    const logs = await S.readAllLogs();
    alleLogs = logs;
    S.cacheLogs(logs);
    renderStats(logs);
    renderAngeben(logs);
    renderKalender(logs);
    renderLast(logs);
    renderTonnage(logs);
    renderFormVerlauf();
    renderPRs(logs);
    renderAnsageAbgleich(logs);
    renderCharts(logs);
    renderRad();
    renderListe(logs);
  } catch (e) {
    // Lieber den letzten bekannten Stand zeigen als eine Sackgasse.
    const alt = S.cachedLogs();
    if (alt && alt.logs.length) {
      alleLogs = alt.logs;
      renderStats(alt.logs);
      renderAngeben(alt.logs);
      renderKalender(alt.logs);
      renderLast(alt.logs);
      renderTonnage(alt.logs);
      renderFormVerlauf();
      renderPRs(alt.logs);
      renderAnsageAbgleich(alt.logs);
      renderCharts(alt.logs);
      renderRad();
      renderListe(alt.logs);
      banner(t('msg.offlineStand', { datum: new Date(alt.zeit).toLocaleDateString(locale()) }), '', 5000);
    } else {
      $('history-body').innerHTML = `<p class="lead">${escHtml(e.message)}</p>`;
    }
    $('history-body').insertAdjacentHTML('beforeend',
      `<button id="hist-retry" class="btn ghost">${t('tour.erneut')}</button>`);
    $('hist-retry').onclick = renderHistory;
  }
}

async function rebuild() {
  if (!confirm(t('bs.rebuildFrage'))) return;
  try {
    banner(t('msg.berechne'), '', 0);
    const logs = await S.readAllLogs();
    state = P.deriveState(config, logs);
    letzterLog = logs.length ? logs.sort((a, b) => a.date.localeCompare(b.date))[logs.length - 1] : null;
    const cur = await S.readFile('state.json');
    await S.writeFile('state.json', state, `Neuberechnung aus ${logs.length} Einheiten`, cur ? cur.sha : null);
    S.cache({ state });
    renderHome();
    banner(t('msg.neuBerechnet', { n: logs.length }), 'ok');
  } catch (e) { banner(e.message, 'err', 8000); }
}

/* ============================ Start ============================ */

$('save-token').onclick = async () => {
  const owner = $('owner').value.trim();
  if (!owner) return banner(t('msg.ownerFehlt'), 'err');
  const tok = $('token').value.trim();
  if (!tok) return banner(t('msg.tokenFehlt'), 'err');
  S.setRepo(owner, $('repo').value.trim());
  S.setToken(tok);
  const k = $('icukey').value.trim();
  if (k) {
    ICU.setCreds('', k);
    try { const me = await ICU.resolveAthlete(); if (me) banner(t('msg.icuName', { name: me.name }), 'ok'); }
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
$('go-mobility').onclick = () => zeigeBibliothek('Mobility');
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
$('go-bibliothek').onclick = () => zeigeBibliothek();
$('bib-back').onclick = () => show('home');
$('bib-suche').oninput = renderBibliothek;
$('rebuild').onclick = rebuild;
$('logout').onclick = () => {
  if (!confirm(t('bs.logoutFrage'))) return;
  S.clearToken(); S.clearRepo(); ICU.clearCreds(); location.reload();
};
$('finish').onclick = finishSession;
$('abort').onclick = () => { if (confirm(t('ses.verwerfen'))) { stopRest(); session = null; show('home'); } };
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
      banner(t('msg.neueVersion'), 'ok', 0);
      setTimeout(() => location.reload(), 800);
      return;
    }
    localStorage.setItem(VERSION_KEY, version);
    if (manuell) {
      await leereCaches();
      banner(t('msg.aktuell', { v: version }), 'ok');
      renderVersion();
    }
  } catch {
    if (manuell) banner(t('msg.versionUnpruefbar'), 'err', 5000);
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

// Version im Original-Repo, sobald bekannt. null = nicht geprueft oder
// nicht erreichbar — dann wird nichts behauptet.
let versionOben = null;

function renderVersion() {
  const veraltet = versionOben && A.istVeraltet(laufendeVersion, versionOben);
  $('version-box').innerHTML =
    `<p class="fine" style="margin:0 0 6px">${t('bs.version', { v: laufendeVersion })}</p>` +
    (veraltet
      ? `<p class="fine" style="margin:0 0 10px;color:var(--rost)">${
          t('fork.hinweis', { oben: escHtml(versionOben), hier: escHtml(laufendeVersion) })}</p>`
      : '');
}

/**
 * Nachsehen, ob am Original weitergearbeitet wurde. Nur fuer Forks — auf der
 * Seite des Originals ist man selbst die Quelle.
 *
 * Das Banner kommt hoechstens einmal je neuer Version: ein Hinweis, der bei
 * jedem Start erscheint, wird nach dem dritten Mal weggeklickt statt gelesen.
 */
const FORK_KEY = 'setlist.forkGesehen';

async function pruefeUrsprung() {
  if (!A.istFork(location.hostname)) return;
  const oben = await S.versionImUrsprung(A.URSPRUNG.owner, A.URSPRUNG.repo);
  if (!oben) return;
  versionOben = oben;
  renderVersion();
  if (!A.istVeraltet(laufendeVersion, oben)) return;
  if (localStorage.getItem(FORK_KEY) === oben) return;
  localStorage.setItem(FORK_KEY, oben);
  banner(t('fork.neu'), '', 8000);
}

$('force-update').onclick = () => pruefeVersion(true);
$('icu-save').onclick = async () => {
  const k = $('icukey2').value.trim();
  if (!k) return banner(t('msg.keyFehlt'), 'err');
  ICU.setCreds('', k);
  try {
    const me = await ICU.resolveAthlete();
    $('icukey2').value = '';
    banner(t('msg.icuName', { name: me ? me.name : t('msg.icuVerbunden') }), 'ok');
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
  $('today').innerHTML = `<div class="kicker">${t('home.verbinde')}</div><div class="name neon">···</div>`;
  load();
} else show('setup');

/* =============================== Jam ===============================
   Bewusst getrennt vom 5x5: es wird als eigener Typ geloggt und beruehrt
   weder Arbeitsgewichte noch den A/B-Wechsel.                          */

function starteWod(seed) {
  wodSeed = seed >>> 0;
  wod = WOD.generateWod(state, wodSeed, config, gymGeraete());
  swSek = 0; stopUhr();
  $('sw-time').textContent = '0:00';
  $('wod-finish').disabled = true;
  renderWod();
  show('wod');
}

/* ================= Orte und Geraete =================
   Der gewaehlte Ort liegt bewusst im Browser, nicht im Repo: er sagt, wo du
   gerade stehst, nicht wer du bist. Das Handy geht mit ins Studio, der
   Rechner bleibt daheim — beide haetten mit einem gemeinsamen Wert unrecht.
   Die Orte selbst gehoeren dagegen ins Repo, damit sie auf jedem Geraet
   gelten.                                                                  */

const GYM_KEY = 'setlist.gym';
const gymWahl = () => localStorage.getItem(GYM_KEY) || '';

/** Geraete am gewaehlten Ort, oder null fuer "keine Einschraenkung". */
function gymGeraete() {
  const id = gymWahl();
  if (!id || !G.gym(config, id)) return null;
  return G.aktiveGeraete(config, id);
}

/** Wie viele Jam-Bewegungen hier ueberhaupt gehen — inklusive der
 *  dauerhaft ausgeschlossenen, sonst verspricht die Zahl zu viel. */
function machbareAnzahl(geraete) {
  const aus = new Set((config && config.wod && config.wod.aus) || []);
  const moeglich = WOD.MOVES.filter(m => !aus.has(m.id));
  return { n: G.machbare(moeglich, geraete).length, gesamt: moeglich.length };
}

function renderWodGyms() {
  const box = $('wod-gyms'), hinweis = $('wod-gym-hinweis');
  if (!box) return;
  const orte = G.gyms(config);
  if (!orte.length) { box.innerHTML = ''; hinweis.innerHTML = ''; return; }

  const gewaehlt = gymWahl();
  box.innerHTML = [{ id: '', name: t('gym.ueberall') }, ...orte].map(o =>
    `<button data-gym="${o.id}" class="${o.id === gewaehlt ? 'an' : ''}">${o.name}</button>`).join('');
  box.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      localStorage.setItem(GYM_KEY, b.dataset.gym);
      starteWod(wodSeed);          // gleicher Seed, anderer Vorrat
    };
  });

  const geraete = gymGeraete();
  if (!geraete) { hinweis.innerHTML = `<p class="fine">${t('gym.hinweis')}</p>`; return; }
  const { n, gesamt } = machbareAnzahl(geraete);
  hinweis.innerHTML = n < 2
    ? `<p class="fine" style="color:var(--rost)">${t('gym.zuWenig')}</p>`
    : `<p class="fine">${t('gym.machbar', { n, gesamt })}</p>`;
}

function renderWod() {
  renderWodGyms();
  const mobility = C.mobilityDran(state) ? C.tagesAuswahl(MOBILITY, new Date(), 'mob') : null;
  $('wod-body').innerHTML = `
    <div class="card">
      <div class="kicker">${wod.dauer ? t('wod.minuten', { n: wod.dauer }) : wod.runden > 1 ? t('wod.runden', { n: wod.runden }) : t('wod.aufZeit')}</div>
      <div class="wod-format">${wod.format.toUpperCase()}</div>
      <p class="txt" style="color:var(--muted);margin:0 0 6px">${wod.beschreibung}</p>
      ${wod.teile.map(teil => `
        <div class="wod-teil">
          <span class="menge">${teil.menge ? `${teil.menge} ${teil.einheit}` : '20/10'}</span>
          <span class="bez"><b>${teil.name}</b>
            ${teil.last ? `<span class="last">${P.fmtWeight(teil.last)}</span>` : ''}
            <span class="c">${teil.cue}</span>
            <details class="skal"><summary>${t('wod.wasDasBringt')}</summary>
              ${teil.erklaerung ? `<p class="erkl">${teil.erklaerung}</p>` : ''}
              ${teil.skalierung && teil.skalierung.length ? `
                <div class="skal-titel">${t('wod.leichter')}</div>
                <ul>${teil.skalierung.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
              <button class="raus" data-raus="${teil.id}" data-name="${teil.name}">${t('wod.kannIchNicht')}</button>
            </details>
          </span>
        </div>`).join('')}
    </div>
    <button id="sw-start" class="btn">${t(swLaeuft ? 'wod.laeuft' : 'wod.uhrStarten')}</button>
    <p class="fine">${t('wod.fine')}</p>
    ${mobility ? `<details class="info"><summary>${t('ses.mobility', { name: mobility.name })}</summary>
      <div class="body">
        <p class="tagline"><b>${mobility.name}</b> · ${mobility.dosis}</p>
        <p>${mobility.warum}</p>
      </div>
    </details>` : ''}`;
  $('sw-start').onclick = startUhr;
  $('wod-body').querySelectorAll('[data-raus]').forEach(b => {
    b.onclick = () => uebungAusschliessen(b.dataset.raus, b.dataset.name);
  });
}

function startUhr() {
  if (swLaeuft) return;
  swLaeuft = true;
  $('stopwatch').hidden = false;
  $('sw-toggle').textContent = t('wod.stopp');
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
  $('sw-toggle').textContent = t('wod.weiter');
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
      <ul>${wod.teile.map(teil => `<li><span>${teil.name}</span><span>${teil.menge ? `${teil.menge} ${teil.einheit}` : '20/10'}</span></li>`).join('')}</ul>
    </div>
    <p class="spruch">${t('wod.spruch')}</p>`;
  show('done');
  toene([660, 880]);
  try {
    await commitWod(log);
    banner(t('msg.gespeichert'), 'ok');
    if (ICU.pushAktiv() && ICU.isConfigured()) ICU.queuePush(log);
  } catch { S.queue(log); banner(t('msg.keinNetz'), '', 6000); }
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

/* ============================ Bibliothek ============================
   Wachsende Wissensschicht ueber allem, was schon an Inhalt existiert —
   Grundlifts, Technik, Mobility, Finisher, Jam-Bewegungen. Notizen und
   eigene Videolinks landen in bibliothek.json, damit sie mitwachsen
   statt bei jedem Neuladen wieder bei null anzufangen.                  */


function zeigeBibliothek(kategorie = null) {
  bibZufall = null;               // bei jedem Aufruf neu ziehen
  bibKategorie = kategorie;
  $('bib-suche').value = '';
  renderBibliothek();
  show('bibliothek');
}

function bibDetailHtml(u) {
  const eintrag = bibliothek[u.id] || {};
  const video = sicherLink(eintrag.video) || B.youtubeSuche(u.name);
  return `
    <div class="bib-detail" data-id="${escHtml(u.id)}">
      ${u.dosis ? `<p class="tagline"><b>${escHtml(u.dosis)}</b></p>` : ''}
      ${u.aktuell ? `<div class="kv"><span class="k">${t('bib.aktuell')}</span><span class="v">${escHtml(u.aktuell)}</span></div>` : ''}
      ${u.info ? `<p>${escHtml(u.info)}</p>` : ''}
      ${u.cue ? `<div class="kv"><span class="k">${t('bib.cue')}</span><span class="v">${escHtml(u.cue)}</span></div>` : ''}
      ${u.fehler ? `<div class="kv"><span class="k">${t('bib.fehler')}</span><span class="v">${escHtml(u.fehler)}</span></div>` : ''}
      <a class="bib-video" href="${video}" target="_blank" rel="noopener noreferrer"
         referrerpolicy="no-referrer">${t('bib.video')}</a>
      <textarea class="bib-notiz" rows="3" placeholder="${t('bib.notiz.ph')}">${escHtml(eintrag.notiz)}</textarea>
      <input class="bib-eigenesvideo" type="text" placeholder="${t('bib.eigenesVideo.ph')}" value="${escHtml(eintrag.video)}">
      <button class="btn ghost small bib-speichern">${t('bib.speichern')}</button>
    </div>`;
}

function renderBibliothek() {
  const alle = B.alleUebungen(config, state);
  const treffer = B.suche(alle, $('bib-suche').value, bibKategorie);

  $('bib-kategorien').innerHTML = ['Alle', ...B.KATEGORIEN].map(k => {
    const aktiv = k === 'Alle' ? !bibKategorie : k === bibKategorie;
    return `<button class="${aktiv ? 'an' : ''}" data-k="${k}">${k === 'Alle' ? t('bib.alle') : k}</button>`;
  }).join('');
  $('bib-kategorien').querySelectorAll('button').forEach(b => {
    b.onclick = () => { bibKategorie = b.dataset.k === 'Alle' ? null : b.dataset.k; renderBibliothek(); };
  });

  if (!bibZufall) bibZufall = B.zufaellig(alle);
  $('bib-random').innerHTML = bibZufall ? `
    <div class="card">
      <div class="kicker">${escHtml(t('bib.zufaellig', { kat: bibZufall.kategorie }))}</div>
      <div class="name">${escHtml(bibZufall.name)}</div>
      ${bibDetailHtml(bibZufall)}
    </div>` : '';

  $('bib-liste').innerHTML = treffer.length
    ? treffer.map(u => `
      <details class="info"><summary>${escHtml(u.name)}<span class="bib-kat">${escHtml(u.kategorie)}</span></summary>
        <div class="body">${bibDetailHtml(u)}</div>
      </details>`).join('')
    : `<p class="fine">${t('bib.keine')}</p>`;

  document.querySelectorAll('.bib-detail .bib-speichern').forEach(btn => {
    btn.onclick = () => {
      const box = btn.closest('.bib-detail');
      speichereBibNotiz(box.dataset.id,
        box.querySelector('.bib-notiz').value.trim(),
        box.querySelector('.bib-eigenesvideo').value.trim());
    };
  });
}

/** Vor dem Schreiben frisch lesen statt einer gemerkten sha zu vertrauen —
 * dieselbe Vorsicht wie beim Zustand nach einer Einheit (siehe commit()). */
async function speichereBibNotiz(id, notiz, video) {
  try {
    const cur = await S.readFile('bibliothek.json');
    const aktuell = cur ? cur.data : {};
    if (notiz || video) aktuell[id] = { notiz, video };
    else delete aktuell[id];
    await S.writeFile('bibliothek.json', aktuell, `Notiz: ${id}`, cur ? cur.sha : null);
    bibliothek = aktuell;
    S.cache({ bibliothek });
    banner(t('bib.gespeichert'), 'ok');
  } catch (e) {
    banner(t('bib.fehlgeschlagen', { msg: e.message }), 'err', 6000);
  }
}

/* ============================ Auswertung ============================ */

function renderStats(logs) {
  const s = ST.summary(logs);
  const tonn = s.tonnage >= 1000 ? `${(s.tonnage / 1000).toFixed(1)} t` : `${s.tonnage} kg`;
  $('hist-summary').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">${t('stat.einheiten')}</div><div class="v">${s.einheiten}</div>
        <div class="s">${t('stat.kraftWod', { k: s.kraft, w: s.wods })}</div></div>
      <div class="stat"><div class="n">${t('stat.bewegt')}</div><div class="v">${tonn}</div>
        <div class="s">${t('stat.lastMalReps')}</div></div>
      <div class="stat"><div class="n">${t('stat.proWoche')}</div><div class="v">${s.proWoche ?? '—'}</div>
        <div class="s">${s.von ? t('stat.seit', { datum: s.von }) : t('stat.keineDaten')}</div></div>
      <div class="stat"><div class="n">${escHtml(t('stat.bestwert', { name: (config.lifts.squat || {}).name || 'Squat' }))}</div>
        <div class="v">${s.best.squat ? P.fmtWeight(s.best.squat.weight) : '—'}</div>
        <div class="s">${s.best.squat ? s.best.squat.date : t('stat.nochKeiner')}</div></div>
    </div>`;
}

const MARSHALL_KG = 55; // Halfstack, Kopf + 4x12-Box, grob gerundet

function renderAngeben(logs) {
  const box = $('hist-angeben');
  if (!box) return;
  const fahrten = alleFahrten.length ? alleFahrten : (S.cached().fahrten || []);
  const s = ST.summary(logs);
  const reps = ST.wiederholungenGesamt(logs);
  const tag = ST.lieblingstag(logs, fahrten);
  const serie = ST.laengsteSerie(logs, fahrten);
  const stacks = Math.round(s.tonnage / MARSHALL_KG);
  box.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">${t('stat.bewegtesGewicht')}</div>
        <div class="v">${stacks.toLocaleString(locale())}</div>
        <div class="s">${t('stat.halfstacks', { kg: MARSHALL_KG })}</div></div>
      <div class="stat"><div class="n">${t('stat.wiederholungen')}</div>
        <div class="v">${reps.toLocaleString(locale())}</div>
        <div class="s">${t('stat.seitErstem')}</div></div>
      <div class="stat"><div class="n">${t('stat.lieblingstag')}</div>
        <div class="v">${tag ? tag.tag : '—'}</div>
        <div class="s">${tag ? t('stat.amHaeufigsten', { n: tag.anzahl }) : t('stat.keinMuster')}</div></div>
      <div class="stat"><div class="n">${t('stat.laengsteSerie')}</div>
        <div class="v">${serie}</div>
        <div class="s">${t(serie === 1 ? 'stat.wocheRekord' : 'stat.wochenRekord')}</div></div>
    </div>`;
}

function renderCharts(logs) {
  const teile = Object.keys(config.lifts).map(id => {
    const punkte = ST.serie(logs, id);
    if (punkte.length < 2) return '';   // eine Linie aus einem Punkt sagt nichts
    const sp = ST.sparkline(punkte, 300, 60);
    const letzter = punkte[punkte.length - 1];
    const delta = letzter.weight - punkte[0].weight;
    // Zweite Linie: das geschaetzte Maximum steigt auch dann, wenn du bei
    // gleichem Gewicht mehr Wiederholungen schaffst.
    // Wichtig: Untergrenzen aus Arbeitssaetzen und Max-Out-Werte NICHT in
    // eine Linie mischen. Sonst sieht ein Wechsel der Datenquelle wie ein
    // Rueckschritt aus. Gemeinsame Skala, aber Linie nur durch die
    // Untergrenzen; Max-Outs stehen als eigene Punkte daneben.
    const alleMax = ST.serieE1rm(logs, id);
    const spMax = alleMax.length > 1 ? ST.sparkline(alleMax, 300, 60, 4) : null;
    const untere = spMax ? spMax.koord.filter(k => !k.belastbar) : [];
    const tests = spMax ? spMax.koord.filter(k => k.belastbar) : [];
    const linieUnten = untere.length > 1
      ? untere.map((k, i) => `${i ? 'L' : 'M'}${k.x.toFixed(1)},${k.y.toFixed(1)}`).join(' ') : null;
    return `<div class="chart">
      <div class="h"><span class="t">${escHtml(config.lifts[id].name)}</span>
        <span class="r">${P.fmtWeight(letzter.weight)} ${delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : ''}</span></div>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="${sp.flaeche}" fill="var(--tint-akzent)"/>
        <path d="${sp.linie}" fill="none" stroke="var(--akzent)" stroke-width="2"
              stroke-linejoin="round" stroke-linecap="round"/>
        ${linieUnten ? `<path d="${linieUnten}" fill="none" stroke="var(--stahl)" stroke-width="1.5"
              stroke-dasharray="4 3" stroke-linejoin="round" opacity=".8"/>` : ''}
        ${tests.map(k => `<circle cx="${k.x.toFixed(1)}" cy="${k.y.toFixed(1)}" r="4"
              fill="var(--stahl)"/>`).join('')}
        ${sp.koord.map(k => `<circle cx="${k.x.toFixed(1)}" cy="${k.y.toFixed(1)}" r="2.5"
              fill="${k.success === false ? 'var(--rost)' : 'var(--akzent)'}"/>`).join('')}
      </svg>
      <div class="h" style="margin:6px 0 0">
        <span class="t">${sp.min} kg</span><span class="t">${sp.max} kg</span></div>
      ${linieUnten ? `<div class="h" style="margin:3px 0 0">
        <span class="t" style="color:var(--stahl)">${t('pr.mind', { kg: Math.max(...untere.map(k => k.weight)) })}</span>
        ${tests.length ? `<span class="t" style="color:var(--stahl)">${
          t('pr.maxOutPunkt', { kg: Math.max(...tests.map(k => k.weight)) })}</span>` : ''}</div>` : ''}
    </div>`;
  }).join('');
  $('hist-charts').innerHTML = teile || `<p class="fine">${t('chart.leer')}</p>`;
}

function renderListe(logs) {
  const sortiert = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  $('history-body').innerHTML = sortiert.length ? sortiert.map(l => {
    if (l.type === 'maxout') {
      const name = (config.lifts[l.lift] || {}).name || l.lift;
      return `<div class="hist maxout"><div class="d">${escHtml(l.date)} · ${t('hist.maxout')} · ${escHtml(name.toUpperCase())}</div>
        <div class="l">${escHtml(l.weight)} kg × ${escHtml(l.reps)}${l.e1rm ? escHtml(t('hist.geschaetztesMax', { kg: l.e1rm })) : ''}</div></div>`;
    }
    if (l.type === 'anpassung') {
      const g = Object.entries(l.gewichte || {})
        .map(([id, w]) => `${escHtml((config.lifts[id] || {}).name || id)} ${P.fmtWeight(w)}`).join(' · ');
      return `<div class="hist anpassung"><div class="d">${escHtml(l.date)} · ${t('hist.angepasst')}</div>
        <div class="l">${g}${l.grund ? `<br><span style="color:var(--dim)">${escHtml(l.grund)}</span>` : ''}</div></div>`;
    }
    if (l.type && l.type !== 'strength') {
      const m = l.dauerSekunden ? `${Math.floor(l.dauerSekunden / 60)}:${String(l.dauerSekunden % 60).padStart(2, '0')}` : '—';
      return `<div class="hist wod"><div class="d">${escHtml(l.date)} · WOD · ${m}</div>
        <div class="l">${escHtml(l.label || '')}</div></div>`;
    }
    return `<div class="hist"><div class="d">${escHtml(l.date)} · WORKOUT ${escHtml(l.workout)}</div>
      <div class="l">${(l.lifts || []).map(e =>
        `${escHtml((config.lifts[e.lift] || {}).name || e.lift)} ${P.fmtWeight(e.weight)} (${escHtml((e.reps || []).join('/'))})`).join(' · ')}</div>
    </div>`;
  }).join('') : `<p class="lead">${t('tour.keineEinheit')}</p>`;
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
      <div class="n">${escHtml(def.name)}</div>
      <div class="v">${P.fmtWeight(state.lifts[id].weight)}</div>
      <div class="f" style="color:var(--dim)">${t('mo.aktuellesGewicht')}</div>
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
    box.innerHTML = `<p class="fine">${t('mo.eingeben')}</p>`;
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
      <div class="kicker">${t('mo.geschaetzt', { formel })}</div>
      <div class="name neon">${max}<span style="font-size:20px"> kg</span></div>
      ${bisher ? `<p class="fine">${max > bisher
        ? `<b style="color:var(--gruen)">${t('mo.neuerBestwert')}</b> ${t('mo.bisherKg', { kg: bisher })}`
        : t('mo.bisherigerBestwert', { kg: bisher })}</p>` : ''}
      <ul>
        <li><span>${t('mo.arbeitsgewichtFuer')}</span><span>${P.fmtWeight(vorschlag)}</span></li>
        <li><span>${t('mo.aktuellEingestellt')}</span><span>${P.fmtWeight(jetzt)}</span></li>
      </ul>
      <label style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;font-size:14px;color:var(--muted)">
        <input type="checkbox" id="mo-apply" style="width:auto;margin:3px 0 0">
        <span>${t('mo.uebernehmen', { kg: P.fmtWeight(vorschlag) })}</span>
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
      <div class="kicker">${escHtml(log.date)} · Max-Out · ${escHtml(config.lifts[mo.lift].name)}</div>
      <div class="name neon">${w} × ${r}</div>
      <ul>
        <li><span>${t('mo.geschaetztesMax', { formel: log.formel })}</span><span>${max} kg</span></li>
        <li><span>${t('mo.arbeitsgewicht')}</span><span>${uebernehmen
          ? `${P.fmtWeight(vorher)} → ${P.fmtWeight(state.lifts[mo.lift].weight)}`
          : t('mo.bleibt', { kg: P.fmtWeight(vorher) })}</span></li>
      </ul>
    </div>
    <p class="spruch">${t('mo.spruch')}</p>`;
  show('done');

  try { await commitMaxout(log); banner(t('msg.gespeichert'), 'ok'); }
  catch { S.queue(log); banner(t('msg.keinNetz'), '', 6000); }
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
    const z = (label, wert, zusatz) =>
      `<div class="reihe"><span class="l">${label}</span><span class="v">${wert}${zusatz ? `<small>${zusatz}</small>` : ''}</span></div>`;
    // Auch ohne eigene Einheit gehoert die alte Bestleistung sichtbar —
    // gerade dann ist sie die einzige Zahl, die etwas ueber dich sagt.
    if (!e) return `<div class="pr"><div class="k">${escHtml(def.name)}</div>
      <div class="reihe"><span class="l">${t('pr.keineEinheit')}</span><span class="v">—</span></div>
      ${def.reference ? z(t('pr.vorDerPause'), P.fmtWeight(def.reference)) : ''}
      ${rekordZeile(id)}</div>`;

    return `<div class="pr">
      <div class="k">${escHtml(def.name)}</div>
      ${e.arbeit ? z(t('pr.schwersterSatz'), P.fmtWeight(e.arbeit.weight), e.arbeit.date) : z(t('pr.schwersterSatz'), '—')}
      ${e.gemessen ? z(t('pr.gemessen'), P.fmtWeight(e.gemessen.weight), e.gemessen.date) : ''}
      ${e.maximum ? z(t('pr.maximum'), `${e.maximum.wert} kg`,
          `${e.maximum.weight}×${e.maximum.reps} · ${e.maximum.formel}`) : ''}
      ${e.untergrenze ? z(t('pr.mindestens'), `${e.untergrenze.wert} kg`,
          t('pr.aus', { w: e.untergrenze.weight, r: e.untergrenze.reps })) : ''}
      ${def.reference ? z(t('pr.vorDerPause'), P.fmtWeight(def.reference)) : ''}
      ${rekordZeile(id)}
    </div>`;
  }).join('');
  $('hist-prs').innerHTML = zeilen + weitereRekorde() + `<p class="fine">${t('pr.fine')}</p>`;
}

// Ansage-Stufe, Farbe und Text je Urteil — auf einen Blick statt einer Zahl,
// die man erst deuten muesste.
const ANSAGE_TONE = { TECHNIK: 'technik', SOLIDE: 'normal', HART: 'hart', SCHWER: 'hart' };
const urteilText = u => t(`ans.${u}`);
const URTEIL_FARBE = { treffer: 'var(--gruen)', schwerer: 'var(--rost)', leichter: 'var(--stahl)' };

/**
 * Macht die Ansage ueberpruefbar statt behauptet: was vor der Einheit
 * vorhergesagt wurde (TECHNIK/SOLIDE/HART/SCHWER), gegen das, was du
 * danach als Gefuehl eingetragen hast.
 */
function renderAnsageAbgleich(logs) {
  const a = ST.ansageAbgleich(logs);
  if (!a.gesamt) {
    $('hist-ansage').innerHTML = `<p class="fine">${t('ans.leer')}</p>`;
    return;
  }

  const zeilen = a.eintraege.map(e => `
    <div class="pr" style="border-left:2px solid ${URTEIL_FARBE[e.urteil]}">
      <div class="k">${e.date.slice(8)}.${e.date.slice(5, 7)}. · Workout ${e.workout}</div>
      <div class="reihe"><span class="l">${t('ans.angesagt')}</span>
        <span class="v"><span class="tone ${ANSAGE_TONE[e.angesagt]}" style="font-size:9.5px;padding:2px 7px">${e.angesagt}</span></span></div>
      <div class="reihe"><span class="l">${t('ans.gefuehlt')}</span><span class="v">${gefuehlLabel(e.gefuehlt)}</span></div>
      <div class="reihe"><span class="l">${t('ans.urteil')}</span><span class="v" style="color:${URTEIL_FARBE[e.urteil]}">${urteilText(e.urteil)}</span></div>
    </div>`).join('');

  $('hist-ansage').innerHTML = `
    <div class="pr" style="border-left:2px solid var(--akzent)">
      <div class="k">${t('ans.kopf', { treffer: a.treffer, gesamt: a.gesamt })}</div>
      <div class="reihe"><span class="l">${t('ans.schwerer')}</span><span class="v">${a.schwerer}</span></div>
      <div class="reihe"><span class="l">${t('ans.leichter')}</span><span class="v">${a.leichter}</span></div>
    </div>
    ${zeilen}
    <p class="fine">${t('ans.fine')}</p>`;
}

/* ================= Scheiben und Form ================= */

/** Was pro Seite auf die Stange gehört — spart Rechnen zwischen den Sätzen. */
function plattenZeile(gewicht) {
  const pt = P.plattenText(gewicht, config);
  if (!pt) return `<p class="platten nicht">${t('ses.plattenNicht')}</p>`;
  if (pt === 'leere Stange') return `<p class="platten">${t('ses.plattenLeer')}</p>`;
  return `<p class="platten">${t('ses.platten')} <b>${pt}</b></p>`;
}

/** Form aus intervals.icu — ein Hinweis, keine Anweisung. */
function formZeile() {
  if (!form) return '';
  const farbe = { frisch: 'var(--gruen)', neutral: 'var(--muted)', muede: 'var(--rost)', platt: 'var(--rot)' }[form.stufe];
  return `<p class="formzeile" style="border-top-color:${farbe}">
    <span class="fw" style="color:${farbe}">${t('form.zeile', { v: `${form.form > 0 ? '+' : ''}${form.form}` })}</span>
    <span class="ft">${form.text}</span>
    <span class="fd">${t('form.detail', { f: form.fitness, e: form.ermuedung })}</span>
  </p>`;
}

/** HRV/Schlaf aus intervals.icu — separat von Form, weil beide etwas anderes sehen. */
function erholungsZeile() {
  if (!erholung) return '';
  const farbe = { ok: 'var(--gruen)', kurz: 'var(--rost)', belastet: 'var(--rot)' }[erholung.stufe];
  const label = t(`erh.${erholung.stufe}`);
  const teile = [];
  if (erholung.hrv != null) teile.push(erholung.basis != null
    ? t('erh.hrvBasis', { v: erholung.hrv, b: erholung.basis })
    : t('erh.hrv', { v: erholung.hrv }));
  if (erholung.schlafStunden != null) teile.push(t('erh.schlaf', { h: erholung.schlafStunden }));
  return `<p class="formzeile" style="border-top-color:${farbe}">
    <span class="fw" style="color:${farbe}">${t('erh.zeile', { label })}</span>
    <span class="ft">${teile.join(' · ') || t('erh.keineWerte')}</span>
    <span class="fd">${t(erholung.stufe !== 'ok' ? 'erh.fliesst' : 'erh.quelle')}</span>
  </p>`;
}

/* ================= Übertragung nach intervals.icu ================= */

/**
 * Einheit als Aktivität nach intervals.icu übertragen — aufgerufen aus der
 * Warteschlange beim nächsten App-Start, nicht mehr direkt beim Abschluss
 * (siehe queueIcuPush): die Apple Watch erkennt Krafttraining oft selbst
 * über die Herzfrequenz und schickt es via Strava nach intervals.icu, aber
 * erst mit Verzögerung. Ein sofortiger Abgleich käme dem meist zuvor und
 * die Einheit stünde doppelt in Fitness und Ermüdung.
 *
 * Gibt true zurück, wenn nichts mehr zu tun ist (gepusht, als Dublette
 * erkannt oder gar nicht zuständig), false, wenn es später erneut
 * versucht werden soll — dann bleibt der Eintrag in der Warteschlange.
 */
async function uebertrageNachIcu(log) {
  if (!ICU.pushAktiv() || !ICU.isConfigured()) return true;
  const aktivitaet = ICU.alsAktivitaet(log, config);
  if (!aktivitaet) return true;                  // ohne Dauer keine erfundene Last
  try {
    const tag = aktivitaet.start_date_local.slice(0, 10);
    const vorhanden = await ICU.alleAktivitaeten(tag, tag);
    if (ICU.schonErfasst(log, vorhanden)) {
      banner(t('msg.schonErfasst', { datum: log.date }), 'ok', 5000);
      return true;
    }
    await ICU.pushAktivitaet(aktivitaet);
    banner(t('msg.anIcu', { datum: log.date, last: aktivitaet.icu_training_load }), 'ok', 4000);
    return true;
  } catch (e) {
    banner(t('msg.icuFehler', { msg: e.message }), 'err', 7000);
    return false;
  }
}

/** Warteschlange aus queueIcuPush beim App-Start abarbeiten. */
async function verarbeiteIcuQueue() {
  const q = ICU.pendingPush();
  if (!q.length) return;
  const rest = [];
  for (const log of q) {
    if (!(await uebertrageNachIcu(log))) rest.push(log);
  }
  ICU.clearPushQueue(rest);
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
    box.innerHTML = `<p class="fine">${t('rad.nichtVerbunden')}</p>`;
    return;
  }
  if (!fahrten.length) {
    box.innerHTML = `<p class="fine">${t('rad.keine')}</p>`;
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
      fill="${i === wochen.length - 1 ? 'var(--akzent)' : 'var(--stahl)'}" opacity="${w.last ? 0.85 : 0.25}"/>`;
  }).join('');

  const sortiert = [...fahrten].sort((a, b) => b.date.localeCompare(a.date));

  box.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="n">${t('rad.fahrten')}</div><div class="v">${st.anzahl}</div>
        <div class="s">${t('rad.proWoche', { n: st.proWoche ?? '—' })}</div></div>
      <div class="stat"><div class="n">${t('rad.imSattel')}</div><div class="v">${st.stunden}<span style="font-size:14px"> h</span></div>
        <div class="s">${st.km} km</div></div>
    </div>
    <div class="radbar">
      <div class="h"><span class="t">${t('rad.wochenlast')}</span><span class="r">${t('rad.gesamt', { n: st.last })}</span></div>
      <svg viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none" aria-hidden="true">${balken}</svg>
      <div class="h" style="margin:7px 0 0">
        <span class="t">${wochen[0].woche.slice(5)}</span>
        <span class="t">${t('rad.dieseWoche')}</span></div>
    </div>
    ${sortiert.slice(0, 20).map(r => `
      <div class="fahrt">
        <div class="d">${escHtml(r.date)}${r.load ? ` · LOAD ${escHtml(r.load)}` : ''}</div>
        <div class="n">${escHtml(r.name)}</div>
        <div class="m">${escHtml(r.minutes)} Min · ${escHtml(r.km)} km</div>
      </div>`).join('')}
    ${sortiert.length > 20 ? `<p class="fine">${t('rad.weitere', { n: sortiert.length - 20 })}</p>` : ''}`;
}

/* ---------- Orte einrichten (Backstage) ----------
   Der Entwurf lebt bis zum Speichern nur hier. Jeder Haken einzeln ins Repo
   zu schreiben waere ein Commit pro Klick — und ein halb eingerichteter Ort
   im Repo waere schlimmer als einer, den man verwirft.                    */

let gymEntwurf = null;

function renderGymVerwaltung() {
  const box = $('gym-liste');
  if (!box) return;
  if (!gymEntwurf) gymEntwurf = G.gyms(config);

  if (!gymEntwurf.length) {
    box.innerHTML = `<p class="fine">${t('gym.keine')}</p>`;
    return;
  }

  box.innerHTML = gymEntwurf.map((o, i) => {
    const { n, gesamt } = machbareAnzahl(o.geraete);
    return `<details class="info">
      <summary>${escHtml(o.name)}<span class="bib-kat">${t('gym.machbarKurz', { n, gesamt })}</span></summary>
      <div class="body">
        <input class="gym-name" data-i="${i}" type="text" value="${escHtml(o.name)}"
               placeholder="${t('gym.name.ph')}" autocomplete="off">
        <p class="fine" style="margin:0 0 8px">${t('gym.machbar', { n, gesamt })}</p>
        <div class="chips">
          <button class="gym-alle" data-i="${i}" data-an="1">${t('gym.alleAn')}</button>
          <button class="gym-alle" data-i="${i}" data-an="">${t('gym.alleAus')}</button>
        </div>
        ${G.GERAETE.map(g => `<label class="kv check">
            <input type="checkbox" class="gym-geraet" data-i="${i}" data-g="${g.id}"
                   ${o.geraete.includes(g.id) ? 'checked' : ''}>
            <span class="v">${g.name}</span></label>`).join('')}
        <button class="btn ghost small danger gym-weg" data-i="${i}">${t('gym.loeschen')}</button>
      </div>
    </details>`;
  }).join('');

  box.querySelectorAll('.gym-name').forEach(el => {
    el.oninput = () => { gymEntwurf[+el.dataset.i].name = el.value; };
  });
  box.querySelectorAll('.gym-geraet').forEach(el => {
    el.onchange = () => {
      const o = gymEntwurf[+el.dataset.i];
      o.geraete = el.checked
        ? [...new Set([...o.geraete, el.dataset.g])]
        : o.geraete.filter(x => x !== el.dataset.g);
    };
  });
  box.querySelectorAll('.gym-alle').forEach(el => {
    el.onclick = () => {
      gymEntwurf[+el.dataset.i].geraete = el.dataset.an ? [...G.ALLE_GERAETE] : [];
      renderGymVerwaltung();
    };
  });
  box.querySelectorAll('.gym-weg').forEach(el => {
    el.onclick = () => {
      const o = gymEntwurf[+el.dataset.i];
      if (!confirm(t('gym.loeschenFrage', { name: o.name }))) return;
      gymEntwurf.splice(+el.dataset.i, 1);
      renderGymVerwaltung();
    };
  });
}

/** Vor dem Schreiben frisch lesen — dieselbe Vorsicht wie ueberall sonst. */
async function speichereGyms() {
  try {
    banner(t('msg.speichere'), '', 0);
    const datei = await S.readFile('config.json');
    if (!datei) throw new Error(t('msg.configNichtLesbar'));
    const neu = datei.data;
    neu.gyms = gymEntwurf.map(o => ({ id: o.id, name: o.name, geraete: o.geraete }));
    await S.writeFile('config.json', neu, `Orte und Geräte aktualisiert`, datei.sha);
    config = neu;
    S.cache({ config });
    // Ein geloeschter Ort darf nicht als Auswahl zurueckbleiben.
    if (gymWahl() && !G.gym(config, gymWahl())) localStorage.removeItem(GYM_KEY);
    gymEntwurf = null;
    renderGymVerwaltung();
    banner(t('gym.gespeichert'), 'ok');
  } catch (e) {
    banner(e.message, 'err', 8000);
  }
}

$('gym-neu').onclick = () => {
  if (!gymEntwurf) gymEntwurf = G.gyms(config);
  gymEntwurf.push(G.neuerGym(t('gym.name.ph'), gymEntwurf));
  renderGymVerwaltung();
};
$('gym-vorlagen').onclick = () => {
  if (!gymEntwurf) gymEntwurf = G.gyms(config);
  const belegt = new Set(gymEntwurf.map(o => o.id));
  gymEntwurf.push(...G.vorlagen().filter(o => !belegt.has(o.id)));
  renderGymVerwaltung();
};
$('gym-speichern').onclick = speichereGyms;

/* ================= Darstellung ================= */

const THEMA_KEY = 'setlist.theme';

/** 'auto' folgt dem System, sonst die ausdrückliche Wahl. */
function themaWahl() { return localStorage.getItem(THEMA_KEY) || 'dunkel'; }

function themaAnwenden() {
  const wahl = themaWahl();
  const hell = wahl === 'hell' ||
    (wahl === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  if (hell) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', hell ? '#f4f1ea' : '#0c0c0e');
  renderThemenSchalter();
}

function renderThemenSchalter() {
  const wahl = themaWahl();
  document.querySelectorAll('.themen button[data-thema]').forEach(b =>
    b.classList.toggle('an', b.dataset.thema === wahl));
}

document.querySelectorAll('.themen button[data-thema]').forEach(b => {
  b.onclick = () => {
    localStorage.setItem(THEMA_KEY, b.dataset.thema);
    themaAnwenden();
    banner(t('bs.darstellungBanner', { was: b.textContent.toUpperCase() }), 'ok', 2000);
  };
});

/* ================= Sprache ================= */

/**
 * Sprachwechsel laedt neu statt jede Ansicht einzeln nachzuziehen. Alles,
 * was auf dem Bildschirm steht, liegt entweder im Repo oder im localStorage —
 * ein Neuladen kostet nichts und laesst keine halb uebersetzte Ansicht zurueck.
 */
function renderSprachSchalter() {
  const s = sprache();
  document.querySelectorAll('.sprachen button').forEach(b =>
    b.classList.toggle('an', b.dataset.sprache === s));
}

document.querySelectorAll('.sprachen button').forEach(b => {
  b.onclick = () => {
    if (b.dataset.sprache === sprache()) return;
    setSprache(b.dataset.sprache);
    location.reload();
  };
});

renderSprachSchalter();

// Systemwechsel mitbekommen, solange 'System' gewählt ist.
window.matchMedia('(prefers-color-scheme: light)')
  .addEventListener('change', () => { if (themaWahl() === 'auto') themaAnwenden(); });

themaAnwenden();

/* ================= Interferenz, Watt, Kalender ================= */

/** Warnt vor der Wechselwirkung mit dem Rad — kürzt aber nichts. */
function stoerungsZeile() {
  if (!stoerung) return '';
  const farbe = { stark: 'var(--rost)', leicht: 'var(--akzent)', gering: 'var(--dim)' }[stoerung.stufe];
  return `<p class="formzeile" style="border-top-color:${farbe}">
    <span class="fw" style="color:${farbe}">${t('stoer.zeile', { h: Math.round(stoerung.stunden) })}</span>
    <span class="ft">${escHtml(stoerung.text)}</span>
    <span class="fd">${escHtml(stoerung.fahrt.name)} · ${escHtml(stoerung.fahrt.minutes)} Min${stoerung.fahrt.load ? ` · Load ${escHtml(stoerung.fahrt.load)}` : ''}</span>
  </p>`;
}

/** "3x12 Min @ 88-93% FTP" wird zu einer Zahl, die man einstellen kann. */
function wattZiel(label) {
  const info = RIDE_INFO[label];
  if (!info || !info.ftp || !eftp) return '';
  const w = P.wattBereich(info.ftp, eftp);
  return w ? ` <b style="color:var(--stahl)">≈ ${w}</b>` : '';
}

/** Geplante Woche als Kalendereinträge — nur was dort noch fehlt. */
async function planInKalender() {
  if (!ICU.isConfigured()) return banner(t('msg.icuNichtVerbunden'), 'err');
  try {
    banner(t('msg.pruefeKalender'), '', 0);
    const woche = P.planWeek(state, config);
    const geplant = woche.map(s => ICU.alsEvent({
      ...s,
      watt: s.type === 'ride' ? P.wattBereich((RIDE_INFO[s.label] || {}).ftp, eftp) : null
    })).filter(Boolean);

    const von = woche[0].date, bis = woche[woche.length - 1].date;
    const vorhanden = await ICU.events(von, bis);
    const fehlt = ICU.fehlendeEvents(geplant, vorhanden);

    if (!fehlt.length) return banner(t('msg.kalenderAktuell'), 'ok');
    await ICU.pushEvents(fehlt);
    banner(t('msg.kalenderAngelegt', { n: fehlt.length }), 'ok', 5000);
  } catch (e) {
    banner(t('msg.icuFehler', { msg: e.message }), 'err', 8000);
  }
}

/**
 * Alte Einheiten nachtragen. Es wird zuerst gelesen, was dort schon steht —
 * auf die Kennung allein ist mit einem API-Key kein Verlass, und doppelte
 * Aktivitäten im eigenen Konto sind ärgerlicher als fehlende.
 */
async function einheitenNachtragen() {
  if (!ICU.isConfigured()) return banner(t('msg.icuNichtVerbunden'), 'err');
  try {
    banner(t('msg.leseEinheiten'), '', 0);
    const logs = alleLogs.length ? alleLogs : await S.readAllLogs();
    const kandidaten = logs.map(l => ICU.alsAktivitaet(l, config)).filter(Boolean);
    if (!kandidaten.length) return banner(t('msg.nichtsZuUebertragen'), 'ok');

    const daten = kandidaten.map(a => a.start_date_local.slice(0, 10)).sort();
    const vorhanden = await ICU.alleAktivitaeten(daten[0], daten[daten.length - 1]);
    const fehlt = ICU.fehlendeAktivitaeten(kandidaten, vorhanden);

    if (!fehlt.length) return banner(t('msg.allesUebertragen'), 'ok');
    banner(t('msg.uebertrage', { n: fehlt.length }), '', 0);
    let n = 0;
    for (const a of fehlt) { await ICU.pushAktivitaet(a); n++; }
    banner(t('msg.nachgetragenIcu', { n }), 'ok', 5000);
  } catch (e) {
    banner(t('msg.icuFehler', { msg: e.message }), 'err', 8000);
  }
}

$('icu-plan').onclick = planInKalender;
$('icu-nachtragen').onclick = einheitenNachtragen;

/**
 * Übung dauerhaft aus dem Generator nehmen. Landet in config.json, damit
 * es auf jedem Gerät gilt und beim nächsten Würfeln sofort greift — eine
 * Einstellung im Browserspeicher wäre auf dem nächsten Gerät wieder weg.
 */
async function uebungAusschliessen(id, name) {
  if (!confirm(t('wod.ausschliessen', { name }))) return;
  try {
    banner(t('msg.speichere'), '', 0);
    const datei = await S.readFile('config.json');
    if (!datei) throw new Error(t('msg.configNichtLesbar'));

    const neu = datei.data;
    neu.wod = neu.wod || {};
    neu.wod.aus = [...new Set([...(neu.wod.aus || []), id])];
    await S.writeFile('config.json', neu, `${name} aus den Zufalls-Workouts genommen`, datei.sha);

    config = neu;
    S.cache({ config });
    starteWod((wodSeed * 7919 + 13) >>> 0);      // neu würfeln, ohne die Übung
    banner(t('wod.ausgeschlossen', { name: name.toUpperCase() }), 'ok', 5000);
  } catch (e) {
    banner(e.message, 'err', 8000);
  }
}

/* ================= Bestleistungen aus der CrossFit-Zeit ================= */

/**
 * Zwei Zeithorizonte, die nicht vermischt werden dürfen: „Vor der Pause" ist
 * das realistische Nahziel, die Bestleistung von 2021 der ferne Bestwert.
 * Der Fortschrittsbalken misst bewusst gegen das Nahziel — gegen 140 kg
 * gemessen stünde er bei einem Drittel, und das wäre entmutigend statt wahr.
 */
function rekordZeile(id) {
  const r = config.records && config.records.programm && config.records.programm[id];
  if (!r) return '';
  const jahr = (r.datum || '').slice(0, 4);
  const teile = [];
  if (r.bestesEinzel) teile.push(t('pr.einzeln', { kg: P.fmtWeight(r.bestesEinzel) }));
  if (r.bestes5er) teile.push(t('pr.imFuenfer', { kg: P.fmtWeight(r.bestes5er) }));
  if (!teile.length) return '';
  return `<div class="reihe"><span class="l">${t('pr.bestleistung')}</span>
    <span class="v" style="color:var(--stahl)">${teile.join(' · ')}<small>${escHtml(jahr)}</small></span></div>`;
}

/** Was du außerhalb des Programms mal konntest — Kontext, kein Ziel. */
function weitereRekorde() {
  const w = config.records && config.records.weitere;
  if (!w || !w.length) return '';
  return `<div class="pr" style="border-left:2px solid var(--stahl)">
    <div class="k">${t('pr.weitere')}</div>
    ${w.map(r => `<div class="reihe">
      <span class="l">${escHtml(r.name)}${r.zusatz ? ` <small style="color:var(--dim)">${escHtml(r.zusatz)}</small>` : ''}</span>
      <span class="v" style="color:var(--stahl)">${P.fmtWeight(r.wert)}<small>${escHtml((r.datum || '').slice(0, 4))}</small></span>
    </div>`).join('')}
    <p class="fine" style="margin-top:10px">${t('pr.quelle', { quelle: config.records.quelle })}</p>
  </div>`;
}

/* ================= Deine Worte, deine Geschichte ================= */

/**
 * An schweren Tagen zählt dein eigener Grund mehr als jeder Spruch von mir.
 * Deshalb wird er genau dann gezeigt — und sonst nicht, damit er sich nicht
 * abnutzt.
 */
function zeileFuerHeute(d) {
  const schwer = ['comeback', 'nachDeload'].includes(d.situation)
    || (form && ['muede', 'platt'].includes(form.stufe));
  const warum = config.ziele && config.ziele.warum;
  if (schwer && warum) {
    return `<span style="font-style:normal;color:var(--muted);font-size:12px;
      font-family:var(--mono);letter-spacing:.1em;display:block;margin-bottom:6px">DEIN GRUND</span>${escHtml(warum)}`;
  }
  return escHtml(d.spruch);
}

/** Was nur deine App sagen kann — Jahrestage, alte Bestwerte, Wendepunkte. */
function meilensteinKarte() {
  const m = C.meilensteine(state, config, new Date());
  if (!m.length) return '';
  return `<div class="meilenstein">
    <span class="kicker">${m[0].art === 'jahrestag' ? 'Aus deiner Geschichte' : 'Wendepunkt'}</span>
    <p>${escHtml(m[0].text)}</p>
  </div>`;
}

/* ================= Kalender und Last ================= */

/**
 * Trainingskalender. Regelmäßigkeit ist das erklärte Ziel — und nichts zeigt
 * sie so unbestechlich wie ein Raster, in dem die Lücken genauso sichtbar
 * sind wie die Treffer. Eine Spalte ist eine Woche, oben Montag.
 */
function renderKalender(logs) {
  const box = $('hist-kalender');
  if (!box) return;
  const fahrten = alleFahrten.length ? alleFahrten : (S.cached().fahrten || []);
  const k = ST.kalender(logs, fahrten, 26, new Date());

  const zellen = k.tage.map(tag => {
    const was = [];
    if (tag.kraft) was.push(t('kal.kraft'));
    if (tag.wod) was.push(t('kal.wod'));
    if (tag.rad) was.push(t('kal.rad'));
    const klasse = [
      'zelle',
      tag.zukunft ? 'zukunft' : '',
      tag.heute ? 'heute' : '',
      tag.kraft ? 'kraft' : '',
      tag.wod ? 'wod' : '',
      tag.rad ? 'rad' : ''
    ].filter(Boolean).join(' ');
    return `<span class="${klasse}" title="${tag.date}${was.length ? ' — ' + was.join(' + ') : ''}"></span>`;
  }).join('');

  // Nur ab dem ersten aktiven Tag zaehlen. Gegen ein halbes Jahr gerechnet
  // steht da sonst eine niedrige Quote, die nichts ueber Regelmaessigkeit
  // sagt, sondern nur darueber, wann man angefangen hat.
  const bisHeute = k.tage.filter(t => !t.zukunft);
  const ersterAktiv = bisHeute.findIndex(t => t.kraft || t.wod || t.rad);
  const tage = ersterAktiv >= 0 ? bisHeute.slice(ersterAktiv) : [];
  const aktiv = tage.filter(t => t.kraft || t.wod || t.rad).length;
  box.innerHTML = `
    <div class="kalender">
      <div class="raster">${zellen}</div>
      <div class="legende">
        <span><i class="kraft"></i> ${t('kal.kraft')}</span>
        <span><i class="wod"></i> ${t('kal.wod')}</span>
        <span><i class="rad"></i> ${t('kal.rad')}</span>
        <span class="rechts">${tage.length
          ? t('kal.quote', { a: aktiv, n: tage.length, p: Math.round(aktiv / tage.length * 100) })
          : t('kal.nichts')}</span>
      </div>
    </div>`;
}

/** Kraft und Rad gestapelt — die eine Kurve, wegen der beides zusammengehört. */
function renderLast(logs) {
  const box = $('hist-last');
  if (!box) return;
  const fahrten = alleFahrten.length ? alleFahrten : (S.cached().fahrten || []);
  const faktor = (config.intervals && config.intervals.loadProMinute) || { strength: 0.8, wod: 1.4 };
  const wochen = ST.wochenLast(logs, fahrten, 12, new Date(), faktor);
  const max = Math.max(1, ...wochen.map(w => w.gesamt));

  const breite = 300, hoehe = 74, luecke = 3;
  const bw = (breite - luecke * (wochen.length - 1)) / wochen.length;
  const balken = wochen.map((w, i) => {
    const x = i * (bw + luecke);
    const hK = (w.kraft / max) * hoehe;
    const hR = (w.rad / max) * hoehe;
    return `
      ${w.rad ? `<rect x="${x.toFixed(1)}" y="${(hoehe - hR).toFixed(1)}" width="${bw.toFixed(1)}" height="${hR.toFixed(1)}"
        fill="var(--stahl)" opacity=".85"><title>${w.woche} · Rad ${w.rad}</title></rect>` : ''}
      ${w.kraft ? `<rect x="${x.toFixed(1)}" y="${(hoehe - hR - hK).toFixed(1)}" width="${bw.toFixed(1)}" height="${hK.toFixed(1)}"
        fill="var(--akzent)" opacity=".9"><title>${w.woche} · Kraft ${w.kraft}</title></rect>` : ''}`;
  }).join('');

  const summeK = wochen.reduce((s, w) => s + w.kraft, 0);
  const summeR = wochen.reduce((s, w) => s + w.rad, 0);
  box.innerHTML = `
    <div class="radbar">
      <div class="h"><span class="t">${t('last.titel')}</span>
        <span class="r" style="color:var(--fg)">${t('last.gesamt', { n: summeK + summeR })}</span></div>
      <svg viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none" aria-hidden="true">${balken}</svg>
      <div class="h" style="margin:7px 0 0">
        <span class="t" style="color:var(--akzent)">${t('last.kraft', { n: summeK })}</span>
        <span class="t" style="color:var(--stahl)">${t('last.rad', { n: summeR })}</span>
        <span class="t">${t('last.dieseWoche')}</span></div>
    </div>`;
}

/** Bewegtes Gewicht je Woche — das Volumen hinter der Progression. */
function renderTonnage(logs) {
  const box = $('hist-tonnage');
  if (!box) return;
  const wochen = ST.wochenTonnage(logs, 12, new Date());
  const max = Math.max(1, ...wochen.map(w => w.tonnage));
  const breite = 300, hoehe = 64, luecke = 3;
  const bw = (breite - luecke * (wochen.length - 1)) / wochen.length;

  const balken = wochen.map((w, i) => {
    const h = w.tonnage ? Math.max(2, (w.tonnage / max) * hoehe) : 0;
    const x = i * (bw + luecke);
    return h ? `<rect x="${x.toFixed(1)}" y="${(hoehe - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
      fill="${i === wochen.length - 1 ? 'var(--gruen)' : 'var(--akzent)'}" opacity=".85"
      ><title>${w.woche} · ${(w.tonnage/1000).toFixed(1)} t · ${w.einheiten} Einheiten</title></rect>` : '';
  }).join('');

  const gesamt = wochen.reduce((s, w) => s + w.tonnage, 0);
  const beste = wochen.reduce((a, w) => w.tonnage > a.tonnage ? w : a, wochen[0]);
  box.innerHTML = `
    <div class="radbar">
      <div class="h"><span class="t">${t('ton.titel')}</span>
        <span class="r" style="color:var(--akzent)">${t('ton.gesamt', { t: (gesamt/1000).toFixed(1) })}</span></div>
      <svg viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none" aria-hidden="true">${balken}</svg>
      <div class="h" style="margin:7px 0 0">
        <span class="t">${t('ton.beste', { t: (beste.tonnage/1000).toFixed(1) })}</span>
        <span class="t">${t('last.dieseWoche')}</span></div>
    </div>`;
}

/**
 * Fitness und Ermüdung. Der Abstand zwischen beiden Linien ist die Form —
 * deshalb wird er als Fläche gezeichnet und nicht als dritte Kurve, die
 * dasselbe noch einmal sagt.
 */
function renderFormVerlauf() {
  const box = $('hist-form');
  if (!box) return;
  if (formPunkte.length < 2) {
    box.innerHTML = `<p class="fine">${t('form.leer')}</p>`;
    return;
  }
  const breite = 300, hoehe = 74, rand = 4;
  const werte = formPunkte.flatMap(p => [p.ctl, p.atl]);
  const min = Math.min(...werte), max = Math.max(...werte);
  const spanne = max - min || 1;
  const n = formPunkte.length;
  const x = i => rand + (n === 1 ? (breite - 2*rand)/2 : (i / (n - 1)) * (breite - 2*rand));
  const y = v => rand + (1 - (v - min) / spanne) * (hoehe - 2*rand);

  const pfad = feld => formPunkte.map((p, i) =>
    `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[feld]).toFixed(1)}`).join(' ');
  const band = pfad('ctl') + ' ' +
    formPunkte.map((p, i) => `L${x(n-1-i).toFixed(1)},${y(formPunkte[n-1-i].atl).toFixed(1)}`).join(' ') + ' Z';

  const jetzt = formPunkte[n - 1];
  const farbe = jetzt.form >= 5 ? 'var(--gruen)' : jetzt.form >= -10 ? 'var(--akzent)'
              : jetzt.form >= -20 ? 'var(--rost)' : 'var(--rot)';
  box.innerHTML = `
    <div class="radbar">
      <div class="h"><span class="t">${t('form.titel')}</span>
        <span class="r" style="color:${farbe}">${t('form.wert', { v: `${jetzt.form > 0 ? '+' : ''}${jetzt.form}` })}</span></div>
      <svg viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${band}" fill="var(--tint-stahl)"/>
        <path d="${pfad('atl')}" fill="none" stroke="var(--stahl)" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="${pfad('ctl')}" fill="none" stroke="var(--akzent)" stroke-width="2" stroke-linejoin="round"/>
      </svg>
      <div class="h" style="margin:7px 0 0">
        <span class="t" style="color:var(--akzent)">${t('form.fitness', { n: Math.round(jetzt.ctl) })}</span>
        <span class="t" style="color:var(--stahl)">${t('form.ermuedung', { n: Math.round(jetzt.atl) })}</span>
        <span class="t">${t('form.flaeche')}</span></div>
    </div>`;
}
