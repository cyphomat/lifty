# lifty

Wochenplaner und Studio-Logger für StrongLifts 5x5 plus Radtraining.
Statische Web-App, kein Build, keine Abhängigkeiten, kein Server.

**App:** https://cyphomat.github.io/lifty/ · **Daten:** privates Repo `lifty-data`

## Wie es zusammenhängt

```
Kraft   ─ in lifty erfasst ──────────────► lifty-data (privates Repo, JSON)
Rad     ─ Zwift → Strava → intervals.icu ─► nur gelesen, für Soll/Ist
```

lifty besitzt die Kraft-Progression. Die StrongLifts-App wird nicht mehr gebraucht —
zwei Systeme, die dasselbe Arbeitsgewicht berechnen, laufen unweigerlich auseinander.

Radeinheiten plant lifty nur als Hinweis. Die Ist-Daten entstehen ohnehin automatisch,
also werden sie gelesen statt nachgebaut.

## Das Programm

```
Workout A:  Kniebeuge 5x5   Bankdrücken 5x5   Rudern 5x5
Workout B:  Kniebeuge 5x5   Schulterdrücken 5x5   Kreuzheben 1x5
```

* Alle Sätze geschafft → Gewicht steigt (+2,5 kg, Kreuzheben +5 kg)
* Ein Satz zu kurz → Gewicht bleibt, Fehlerzähler steigt
* Drei Fehlversuche → Deload auf 90 %, Zähler zurück auf 0
* Kniebeuge kommt in beiden Workouts vor und steigt daher doppelt so schnell

5x5 ist auf drei Einheiten pro Woche ausgelegt. Bei ein bis zwei pro Woche gilt
dieselbe Mechanik, nur langsamer — A und B wechseln sich über zwei Wochen ab.

## Die tragende Invariante

`state.json` ist **abgeleitet**, nicht gepflegt: eine Projektion aus `config.json`
und allen Dateien in `log/`. „Neu berechnen" im Verlauf stellt sie jederzeit wieder her.

Das ist der Grund, warum ein vertippter Eintrag nie zum Problem wird — Log-Datei
korrigieren, neu berechnen, fertig. Wer hier eine Abkürzung einbaut und `state.json`
direkt fortschreibt, verliert genau diese Eigenschaft.

## Zugangsdaten

Nirgends im Code, nirgends im Repo, in keinem Commit. GitHub-Token und
intervals.icu-Key werden beim ersten Öffnen in die App eingegeben und liegen
danach ausschließlich im `localStorage` des jeweiligen Browsers.

## Tests

```
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc --module-file=tests/program.test.js
```

Nutzt die JS-Engine, die in macOS ohnehin steckt. Kein Node nötig.

## Aufbau

| Datei | Rolle |
|---|---|
| `js/program.js` | Der 5x5-Automat. Reine Funktionen, kein I/O — deshalb testbar. |
| `js/store.js` | GitHub-API als Speicher, Offline-Puffer, Lesecache. |
| `js/intervals.js` | Liest Radaktivitäten von intervals.icu. |
| `js/app.js` | Oberfläche und Ablauf. |
| `sw.js` | Cacht die App-Hülle. Trainingsdaten bewusst **nicht** — veraltete Gewichte im Studio wären schlimmer als ein Ladebalken. |
