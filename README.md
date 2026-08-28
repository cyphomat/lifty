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
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc --module-file=tests/coach.test.js
```

```
jsc --module-file=tests/wod.test.js
jsc --module-file=tests/stats.test.js
```

104 Tests. Sie decken ab, was still kaputtgehen kann: Progression, Deload,
Streak-Berechnung, Fortschritt zur Referenz, die Ableitbarkeit des Zustands —
und dass ein WOD die Progression nicht anfasst.

Nutzt die JS-Engine, die in macOS ohnehin steckt. Kein Node nötig.

## Aufbau

| Datei | Rolle |
|---|---|
| `js/program.js` | Der 5x5-Automat. Reine Funktionen, kein I/O — deshalb testbar. |
| `js/coach.js` | Leitet Ansage, Ton und Fortschritt aus dem Zustand ab. Ebenfalls rein und getestet. |
| `js/content.js` | Wissensschicht: Warum je Übung, Kadenz-Cues, Warm-up, Technikarbeit, Finisher. |
| `js/wod.js` | Zufalls-WOD. Deterministisch über einen Seed, Lasten aus den Arbeitsgewichten. |
| `js/stats.js` | Tonnage, Bestwerte, Verläufe. Rechnet die Sparklines, zeichnet sie aber nicht. |
| `js/store.js` | GitHub-API als Speicher, Offline-Puffer, Lesecache. |
| `js/intervals.js` | Liest Radaktivitäten von intervals.icu. |
| `js/app.js` | Oberfläche und Ablauf. |
| `sw.js` | Cacht die App-Hülle. Trainingsdaten bewusst **nicht** — veraltete Gewichte im Studio wären schlimmer als ein Ladebalken. |

## Warum die Inhalte im Code liegen

Übungsbegründungen, Cues und Warm-up stehen in `js/content.js`, nicht bei den
Trainingsdaten. Zwei Gründe: es ist Programmwissen ohne Personenbezug, und es
muss im Studio sofort da sein, ohne zweiten API-Aufruf über schlechtes Netz.

Persönliches — Gewichte, Logs, Ziele — bleibt im privaten Repo.

## Die Rangordnung im Training

5x5 ist das Rückgrat, weil es als Einziges messbar progressiv ist.
Olympische Technik läuft leicht im Warm-up-Slot (Auffrischung, kein neuer Reiz).
Seile und Konditionsarbeit kommen als Finisher ans Ende.

Diese Reihenfolge ist kein Geschmack, sondern der Grund, warum die Progression
im Kaloriendefizit überhaupt funktioniert. Wer den Finisher nach vorn zieht oder
die Technikarbeit schwer macht, kippt sie.

## Warum ein WOD einen eigenen Log-Typ hat

Log-Dateien tragen ein Feld `type`. Fehlt es, gilt `strength`.

`applyLog` steigt bei jedem anderen Typ sofort aus: das WOD landet in der
Historie, rührt aber weder Arbeitsgewichte noch den A/B-Wechsel an.

Ohne diese Trennung würde eine Spaßeinheit am Mittwoch die Kniebeuge um
2,5 kg weiterdrehen oder als Fehlversuch zählen — und die Progression, die
das ganze Programm trägt, wäre nach zwei Wochen Fiktion. Dafür gibt es
Regressionstests in `tests/program.test.js`.

## Veröffentlichen

```
sh tools/release.sh 2026-09-14.1
git add -A && git commit -m "..." && git push
```

Das Skript setzt `version.json` und den Cache-Namen in `sw.js` gemeinsam.
Beides muss sich ändern, sonst merkt weder die App noch der Service Worker,
dass es etwas Neues gibt.

Die App vergleicht bei jedem Start die ausgelieferte Version mit der zuletzt
gesehenen und lädt sich **genau einmal** neu, wenn sie abweicht. Der Merker
wird vor dem Neuladen geschrieben — sonst entstünde eine Endlosschleife.

### Warum der Service Worker `no-cache` benutzt

GitHub Pages liefert alles mit `Cache-Control: max-age=600` aus. Ohne
erzwungene Rückfrage beantwortet der HTTP-Cache des Browsers die Anfrage des
Service Workers selbst — der Netz-zuerst-Ansatz wäre dann nur auf dem Papier
vorhanden und Updates kämen bis zu zehn Minuten verspätet an.

## Warum keine Adresse mehr `/log` enthält

Ein Netzwerkfehler trat reproduzierbar nur beim Verzeichnislisting
`contents/log` auf, während alle anderen Aufrufe durchgingen. Inhaltsblocker,
Netzwerkfilter und Firmen-WLANs verwerfen Adressen mit diesem Wegstück
regelmäßig — dort fließen sonst Tracking-Daten ab. In Safari sieht eine
solche Blockade wie ein Netzwerkausfall aus („Load failed").

Zwei Konsequenzen: der Ordner heißt jetzt `einheiten/`, und der Verlauf wird
über `git/trees` und `git/blobs` gelesen statt über `contents/<ordner>`.
Nebeneffekt: eine Anfrage für den ganzen Baum statt einer pro Datei.
