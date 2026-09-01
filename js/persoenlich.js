// Die Schicht, die aus einem Programm deine App macht.
//
// Drei Dinge lagen bisher nur in handgeschriebenem JSON und waren damit
// faktisch unerreichbar fuer jeden ausser dem, der die App gebaut hat:
//
//   ziele.warum      dein Grund, gezeigt an den schweren Tagen
//   stimme.json      eigene Zeilen, gemischt mit den mitgelieferten
//   records.programm alte Bestleistungen, die die Meilensteine tragen
//
// Ohne sie ist die App ein Timer mit Tabelle. Mit ihnen sagt sie Saetze,
// auf die kein Programm von der Stange kommt. Deshalb gehoert das in die
// Oberflaeche und nicht in eine Datei, deren Aufbau man erraten muss.
//
// Reine Funktionen, kein I/O.

/** Aus einem Textfeld eine Liste — leere Zeilen fliegen raus. */
export function zeilenAusText(text) {
  return String(text ?? '')
    .split('\n')
    .map(z => z.trim())
    .filter(Boolean);
}

/** Und zurueck, fuer die Anzeige im Textfeld. */
export function textAusZeilen(zeilen) {
  return (Array.isArray(zeilen) ? zeilen : []).join('\n');
}

/**
 * Der Inhalt der stimme.json. Ohne eigene Zeilen kommt null zurueck — dann
 * soll die Datei geloescht statt mit einer leeren Liste beschrieben werden.
 *
 * Geschrieben wird unter `alle`: die Zeilen gelten dann in jeder Lage. Wer
 * nach Situation trennen will (comeback, leicht, …), kann die Datei
 * weiterhin von Hand aufteilen — die App liest beides.
 */
export function baueStimme(text, vorhanden = null) {
  const zeilen = zeilenAusText(text);
  const rest = (vorhanden && vorhanden.sprueche) ? { ...vorhanden.sprueche } : {};
  delete rest.alle;
  if (!zeilen.length) {
    // Nach Situation getrennte Zeilen bleiben erhalten, auch wenn das
    // Textfeld leer ist — sonst loescht ein Klick, was von Hand gepflegt wurde.
    return Object.keys(rest).length ? { ...vorhanden, sprueche: rest } : null;
  }
  return { ...(vorhanden || {}), sprueche: { ...rest, alle: zeilen } };
}

/** Die eigenen Zeilen aus einer geladenen stimme.json fuer das Textfeld. */
export function eigeneZeilen(stimme) {
  const s = stimme && stimme.sprueche;
  return textAusZeilen(s && s.alle);
}

/** Eine Zahl aus einem Eingabefeld, oder null. Leer ist kein Fehler. */
function zahl(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** JJJJ-MM-TT, oder null. Ein halbes Datum ist kein Datum. */
function datum(v) {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Aus den Formularfeldern der Block `records.programm`.
 *
 * Ein Eintrag zaehlt nur, wenn mindestens ein Gewicht dasteht — ein Datum
 * allein ist keine Bestleistung. Ohne Datum wird das Gewicht trotzdem
 * behalten: es taucht dann bei den Bestwerten auf, nur eben ohne Jahrestag.
 */
export function baueRekorde(eintraege) {
  const out = {};
  for (const e of eintraege || []) {
    if (!e || !e.id) continue;
    const einzel = zahl(e.bestesEinzel);
    const fuenfer = zahl(e.bestes5er);
    if (!einzel && !fuenfer) continue;
    const r = {};
    const d = datum(e.datum);
    if (d) r.datum = d;
    if (einzel) r.bestesEinzel = einzel;
    if (fuenfer) r.bestes5er = fuenfer;
    out[e.id] = r;
  }
  return out;
}

/** Die gespeicherten Rekorde als Formularentwurf, je Uebung eine Zeile. */
export function rekordEntwurf(config) {
  const rec = (config && config.records && config.records.programm) || {};
  const lifts = (config && config.lifts) || {};
  return Object.entries(lifts).map(([id, def]) => {
    const r = rec[id] || {};
    return {
      id,
      name: def.name || id,
      datum: r.datum || '',
      bestesEinzel: r.bestesEinzel ?? '',
      bestes5er: r.bestes5er ?? ''
    };
  });
}

/**
 * Die Aenderungen in eine bestehende config.json einsetzen, ohne sonst
 * etwas anzufassen. Leere Angaben entfernen den jeweiligen Block, statt
 * ihn als leere Huelle stehen zu lassen.
 */
export function setzeInConfig(config, { grund, rekorde }) {
  const neu = JSON.parse(JSON.stringify(config || {}));

  const g = String(grund ?? '').trim();
  if (g) neu.ziele = { ...(neu.ziele || {}), warum: g };
  else if (neu.ziele) {
    delete neu.ziele.warum;
    if (!Object.keys(neu.ziele).length) delete neu.ziele;
  }

  if (rekorde && Object.keys(rekorde).length) {
    neu.records = { ...(neu.records || {}), programm: rekorde };
  } else if (neu.records) {
    delete neu.records.programm;
    if (!Object.keys(neu.records).length) delete neu.records;
  }

  return neu;
}
