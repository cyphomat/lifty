<p align="center">
  <img src="assets/banner.svg" alt="Setlist" width="100%">
</p>

<p align="center">
  <a href="https://cyphomat.github.io/setlist/"><img alt="App öffnen" src="https://img.shields.io/badge/App-öffnen-e8a23d?style=for-the-badge&labelColor=17161b"></a>
  <img alt="Tests" src="https://img.shields.io/badge/Tests-375%20grün-7fa65c?style=for-the-badge&labelColor=17161b">
  <img alt="Build" src="https://img.shields.io/badge/Build-keiner-6f93ad?style=for-the-badge&labelColor=17161b">
</p>

<p align="center">
  <b>Ein Trainingsplaner für eine Person.</b><br>
  Zweimal Kraft, zweimal Rad pro Woche. Die Woche ist eine Setlist.
</p>

---

## So sieht es aus

<table>
<tr>
<td width="33%"><img src="assets/screens/home-dunkel.png" alt="Startbildschirm"></td>
<td width="33%"><img src="assets/screens/session-dunkel.png" alt="Einheit im Studio"></td>
<td width="33%"><img src="assets/screens/geschafft-dunkel.png" alt="Nach der Einheit"></td>
</tr>
<tr>
<td align="center"><sub>Die Ansage</sub></td>
<td align="center"><sub>Im Studio</sub></td>
<td align="center"><sub>Danach</sub></td>
</tr>
</table>

<sub>Echte Bildschirme mit Beispieldaten, aufgenommen über <code>tools/shot.html</code>.</sub>

---

## Was sie tut

Jeden Tag eine Ansage, aus Daten statt aus dem Bauch: Pause, offene Fehlversuche, Form vom Rad, Abstand zu den alten Bestwerten.

- **Kraft** läuft nach 5×5: fünf Sätze schaffen → Gewicht steigt, dreimal gerissen → Deload auf 90 %. Arbeitsgewichte werden nie von Hand gesetzt, nur über einen protokollierten Log.
- **Rad** kommt automatisch — Zwift → Strava → intervals.icu. Setlist zeigt es nur als Hinweis und schreibt jede Krafteinheit dorthin zurück, damit Fitness und Ermüdung in einer Kurve liegen.
- **Interferenz-Warnung**, wenn eine harte Fahrt weniger als vier Stunden her ist — die letzten Sätze werden zäh, das Maximalkraftniveau nicht.
- **Jam**: ein Zufalls-Workout, wenn mal keine Lust auf den Plan besteht. Lasten aus dem aktuellen Stand, Skalierung für alles, was du (noch) nicht kannst.
- **Meilensteine und Minierfolge**: „Gestern vor 5 Jahren 140 kg" neben „heute stehst du bei 65". Nach jeder Einheit steht zuerst das Geschaffte, nicht der Bericht.
- **Die Stimme** mischt deine eigenen Zeilen aus `stimme.json` mit den mitgelieferten, etwa halbe halbe.

## Zweimal und zweimal

5×5 ist ursprünglich für drei Einheiten pro Woche gebaut. Bei höchstens zwei gilt dieselbe Mechanik, nur langsamer — die 60-%-Regel für den Wiedereinstieg hätte bei dieser Frequenz sechs bis neun Wochen unter Reizschwelle bedeutet, deshalb sind es 80 %.

|  | Übung 1 | Übung 2 | Übung 3 |
|---|---|---|---|
| **Workout A** | Back Squat 5×5 | Bench Press 5×5 | Barbell Row 5×5 |
| **Workout B** | Back Squat 5×5 | Strict Press 5×5 | Deadlift 1×5 |

Back Squat ist in beiden Workouts dabei und steigt darum doppelt so schnell.

---

## Funktionen

**Kraft** — Plattenrechner, Aufwärmsätze aus dem Arbeitsgewicht, Gewicht im Satz nachjustierbar, Pausenuhr mit Verlängerung nach Fehlversuch, Bestwerte getrennt in `Maximum` (nur Max-Out) und `Mindestens` (Arbeitssätze, systematisch zu niedrig).

**Rad und Kondition** — Wochenlast Kraft+Rad gestapelt, Fitness gegen Ermüdung, Trainingskalender über 26 Wochen, Wattziele aus der eFTP statt Prozentangaben.

**App** — Offline-Puffer, aktualisiert sich beim Start selbst, hell/dunkel, Handy und Mac in einer Ansicht (ab 900 px zwei Spalten).

Details und Begründungen stehen als Kommentare direkt im Code, dort wo sie hingehören.

---

## Aufbau

| Datei | Rolle |
|---|---|
| `js/program.js` | 5×5-Automat, Plattenrechner, e1RM. Reine Funktionen. |
| `js/coach.js` | Ansage, Ton, Meilensteine, Minierfolge. Ebenfalls rein. |
| `js/wod.js` | Jam-Generator, deterministisch über einen Seed. |
| `js/stats.js` | Tonnage, Bestwerte, Sparklines, Radstatistik. |
| `js/content.js` | Wissensschicht: Cues, Soundcheck, Technik, Encore, Stimme. |
| `js/store.js` | GitHub-API als Speicher, Offline-Puffer. |
| `js/intervals.js` | Liest Fahrten und Form; schreibt Krafteinheiten zurück. |
| `js/app.js` | Oberfläche und Ablauf. |
| `sw.js` | Cacht die App-Hülle. Trainingsdaten bewusst **nicht**. |

`state.json` steht nirgends im Repo, weil es nirgends stehen muss: eine reine Projektion aus `config.json` und allen Dateien in `einheiten/`. „state.json neu berechnen" stellt sie jederzeit wieder her.

---

## Tests

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
for t in program coach wod stats intervals; do $JSC --module-file=tests/$t.test.js; done
```

375 Tests, ausgeführt von der JS-Engine, die in macOS ohnehin steckt. Kein Node, kein Build.

---

## Veröffentlichen

```sh
sh tools/release.sh 2026-09-14.1
git add -A && git commit -m "…" && git push
```

Setzt `version.json` und den Cache-Namen in `sw.js` gemeinsam — beides muss sich ändern, sonst merkt die App nichts Neues.

Screenshots neu aufnehmen:

```sh
python3 -m http.server 8765 &
sh tools/screens.sh
```

---

## Auf dem Mac

Web-App, die URL genügt. Für ein eigenes Fenster: **Safari** → Ablage → *Zum Dock hinzufügen*, oder **Chrome** → Adressleiste → *Installieren*.

Token und Key liegen im `localStorage`, also pro Gerät — auf dem Mac einmal neu eintragen. Die Trainingsdaten kommen aus dem Repo und sind überall dieselben. Zwei Geräte gleichzeitig eine Einheit abschließen lassen sollte man nicht; nacheinander ist problemlos.

## Zugangsdaten

Nirgends im Code, nirgends im Repo, in keinem Commit. GitHub-Token und intervals.icu-Key werden in der App eingegeben und liegen ausschließlich im `localStorage` des jeweiligen Browsers.
