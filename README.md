<p align="center">
  <img src="assets/banner.svg" alt="Setlist" width="100%">
</p>

<p align="center">
  <a href="https://cyphomat.github.io/setlist/"><img alt="App öffnen" src="https://img.shields.io/badge/App-öffnen-e8a23d?style=for-the-badge&labelColor=17161b"></a>
  <img alt="Tests" src="https://img.shields.io/badge/Tests-460%20grün-7fa65c?style=for-the-badge&labelColor=17161b">
  <img alt="Build" src="https://img.shields.io/badge/Build-keiner-6f93ad?style=for-the-badge&labelColor=17161b">
  <img alt="Abhängigkeiten" src="https://img.shields.io/badge/Abhängigkeiten-0-a7a3ab?style=for-the-badge&labelColor=17161b">
</p>

<p align="center">
  <b>Ein Trainingsplaner für eine Person.</b><br>
  Zweimal Kraft, zweimal Rad pro Woche. Die Woche ist eine Setlist.
</p>

<p align="center">
  <sub>100% vibe coded. Nutzung auf eigene Gefahr. Featurewünsche gerne gesehen.</sub>
</p>

<p align="center">
  <b>Deutsch</b> · <a href="README.en.md">English</a> · <a href="CHANGELOG.md">Changelog</a>
</p>

> **Zur Sprache.** Die Oberfläche der App gibt es auf Deutsch und Englisch — umschaltbar unter **Tour → Backstage → Sprache**. Die *Trainingsinhalte* sind bisher nur deutsch: die Ansage vor der Einheit, Übungserklärungen, Cues, typische Fehler, Jam-Bewegungen und die Rad-Begründungen. Das ist Fachtext, der inhaltlich übersetzt werden muss statt Wort für Wort — deshalb ist er bewusst noch nicht angefasst. Im englischen Modus steht also gemischte Sprache auf dem Bildschirm.

---

## So sieht es aus

<table>
<tr>
<td width="33%"><img src="assets/screens/home-dunkel.png" alt="Startbildschirm"></td>
<td width="33%"><img src="assets/screens/session-dunkel.png" alt="Einheit im Studio"></td>
<td width="33%"><img src="assets/screens/geschafft-dunkel.png" alt="Nach der Einheit"></td>
</tr>
<tr>
<td align="center"><b>Die Ansage</b><br><sub>Ton aus Pause, Form und Rad</sub></td>
<td align="center"><b>Im Studio</b><br><sub>Scheiben, Kadenz, Sätze über dem Ziel</sub></td>
<td align="center"><b>Danach</b><br><sub>Erst der Erfolg, dann der Bericht</sub></td>
</tr>
</table>

**Auf dem Mac wird daraus eine Übersicht** — Kalender, Wochenlast, Bestwerte und Verlaufskurven nebeneinander statt untereinander:

<img src="assets/screens/tour-desktop.png" alt="Tour auf dem Mac, breite Ansicht">

<sub>Echte Bildschirme mit Beispieldaten, aufgenommen über <code>tools/shot.html</code>. Keine Mockups.</sub>

---

## Was sie dir sagt

Der Unterschied zu einem Logbuch: sie hat eine Meinung zum heutigen Tag — aus Daten, nicht aus dem Bauch.

- **Die Ansage** liest Trainingspause, offene Fehlversuche, laufende Serie und Form vom Rad und entscheidet zwischen `TECHNIK`, `SOLIDE`, `HART` und `SCHWER` — und fragt nach der Einheit, wie sich das wirklich angefühlt hat. Die Ansage bleibt damit überprüfbar statt behauptet.
- **HRV und Schlaf gehen vor.** Fällt die HRV deutlich unter den eigenen Schnitt der letzten Tage oder war die Nacht zu kurz, sagt die App TECHNIK an — auch wenn Trainingsplan oder offene Fehlversuche eigentlich etwas anderes verlangen würden. Beides sieht etwas, das reine Trainingslast nicht erfasst.
- **Interferenz-Warnung**, wenn eine harte Fahrt weniger als vier Stunden her ist — die letzten Sätze werden zäh, das Maximalkraftniveau bleibt unberührt.
- **Meilensteine** kennen die alten Bestleistungen samt Datum:

  > **Aus deiner Geschichte** — Gestern vor 5 Jahren: 140 kg Back Squat. Heute stehst du bei 65 kg — nicht weil du weniger kannst, sondern weil du wieder anfängst.

- **Minierfolge** stehen nach jeder Einheit ganz oben. Nicht der Bericht, sondern das Geschaffte.
- **Die Stimme** mischt eigene Zeilen aus `stimme.json` mit 52 mitgelieferten, etwa halbe halbe.

## Wie es zusammenhängt

```
Zwift ──▶ Strava ──▶ intervals.icu ◀──▶ Setlist ◀──▶ setlist-data (privat)
                            │                              │
                       Fahrten, Form                  Kraft-Progression
```

Setlist besitzt die **Kraft**-Progression — zwei Systeme, die dasselbe Arbeitsgewicht berechnen, laufen unweigerlich auseinander. Das **Rad** läuft andersherum: es kommt automatisch über Zwift → Strava → intervals.icu, Setlist zeigt es nur als Hinweis und schreibt im Gegenzug jede Krafteinheit zurück, damit Fitness und Ermüdung in einer Kurve liegen statt in zwei getrennten Welten.

Der Rückweg wartet bewusst bis zum nächsten App-Start: die Apple Watch erkennt Krafttraining oft selbst über die Herzfrequenz und reicht es mit Verzögerung über Strava nach. Ein sofortiger Push käme dem meist zuvor und dieselbe Einheit stünde doppelt in Fitness und Ermüdung.

## Zweimal und zweimal

5×5 ist ursprünglich für drei Einheiten pro Woche gebaut. Bei höchstens zwei gilt dieselbe Mechanik, nur langsamer — die 60-%-Regel für den Wiedereinstieg hätte bei dieser Frequenz sechs bis neun Wochen unter Reizschwelle bedeutet, deshalb sind es 80 %.

|  | Übung 1 | Übung 2 | Übung 3 |
|---|---|---|---|
| **Workout A** | Back Squat 5×5 | Bench Press 5×5 | Barbell Row 5×5 |
| **Workout B** | Back Squat 5×5 | Strict Press 5×5 | Deadlift 1×5 |

Back Squat ist in beiden Workouts dabei und steigt darum doppelt so schnell.

---

## Funktionen

### Kraft

| | |
|---|---|
| **5×5-Automat** | Steigerung, Fehlerzähler, Deload auf 90 % nach drei Fehlversuchen. |
| **Plattenrechner** | Scheiben pro Seite. Nicht exakt ladbare Gewichte werden benannt statt gerundet. |
| **Soundcheck** | Aufwärmsätze aus dem Arbeitsgewicht: leere Stange, dann 55 / 70 / 85 %. Jede Zeile abhakbar — angetippt durchgestrichen. |
| **Gewicht im Satz** | Anpassbar während der Einheit — das Log bildet ab, was wirklich passiert ist. |
| **Pausenuhr** | 90 s, nach Fehlversuch 180 s, im Lauf um ±30 s verstellbar. Endet mit Vibration und Ton, stoppt sich nach dem letzten Satz der Einheit selbst. |
| **Bestwerte** | `Maximum` (nur aus Max-Out) gegen `Mindestens` (aus Arbeitssätzen, systematisch zu niedrig). |
| **Max-Out** | Krafttest mit e1RM. Dreht den A/B-Wechsel nicht. |
| **Wissen an der Stange** | Aufklappbar: Begründung, Cue, typischer Fehler, Brücke zum olympischen Heben. |
| **Mobility** | Fünf Übungen, einmal pro Kalenderwoche fällig — bei der ersten Einheit (Kraft oder Jam), ganz gleich welcher. Eigener Button, jederzeit unabhängig davon nutzbar. |
| **Gefühl nach der Einheit** | Vier Stufen (Leicht/Normal/Hart/Extrem) auf dem Geschafft-Screen — macht die Ansage im Nachhinein überprüfbar. |
| **Ansage gegen Gefühl** | In der Tour: jede Einheit mit beiden Werten, dazu die Trefferquote — Ansage und gefühlte Schwere nebeneinander statt nur behauptet. |

### Rad und Kondition

| | |
|---|---|
| **Radfahrten** | Fahrten, Stunden, Kilometer, Wochenlast über zwölf Wochen — aus intervals.icu. |
| **Trainingskalender** | 26 Wochen als Raster: Kraft bernstein, Jam grün, Rad stahlblau. |
| **Wochenlast gestapelt** | Kraft und Rad in einem Balken — die eine Kurve, wegen der beides zusammengehört. |
| **Fitness gegen Ermüdung** | Zwei Linien aus intervals.icu — die Fläche dazwischen *ist* die Form. |
| **Erholung (HRV/Schlaf)** | Aus intervals.icu, meist via HealthFit aus Apple Health. HRV nur relativ zur eigenen Basis der letzten Tage bewertet, nicht absolut. Fließt in die Ansage ein. |
| **Wattziele** | Aus der eFTP statt Prozentangaben. |
| **Jam** | Fünf Formate, 31 Übungen, Lasten aus dem aktuellen Stand. Nie zwei Langhantelteile. |
| **Skalierung** | Jede Übung nennt Alternativen. „Kann ich nicht" nimmt sie dauerhaft raus. |

### App

| | |
|---|---|
| **Offline** | Einheiten werden gepuffert. Tour und Radansicht zeigen den letzten Stand. |
| **Selbstaktualisierend** | Prüft die Version beim Start und lädt sich genau einmal neu. |
| **Sound und Vibration** | Ton bei Pausenende und Einheitsabschluss, zusätzlich zur Vibration — Ton respektiert den Stumm-Schalter, Vibration nicht. |
| **Hell und dunkel** | Umschalter System / Hell / Dunkel. Zwei echte Fassungen, keine Invertierung. |
| **Handy und Mac** | Ab 900 px zwei Spalten, in der Tour breitere Raster — dieselbe Reihenfolge, kein Umbau. |
| **Deutsch und Englisch** | Oberflächensprache unter Backstage umschaltbar. Trainingsinhalte bleiben vorerst deutsch. |

### Bibliothek

| | |
|---|---|
| **Alle Übungen an einem Ort** | Grundlifts, Technik, Mobility, Finisher und alle Jam-Bewegungen, durchsuchbar und nach Kategorie filterbar. |
| **Immer eine zufällige Übung** | Mit vollem Detail oben, bei jedem Aufruf neu gezogen — bleibt stabil, während man tippt oder filtert. |
| **YouTube-Suchlink statt geratenem Video** | Ein einzelnes fest verdrahtetes Video könnte offline oder falsch sein. Per eigenem Link überschreibbar. |
| **Eigene Notizen** | Landen in `bibliothek.json` in `setlist-data` und wachsen mit — dieselbe Wissensschicht wie `config.json`, nur für das, was du selbst gelernt hast. |

---

## Zwei Entscheidungen, die tragen

**`state.json` ist abgeleitet, nicht gepflegt.** Eine Projektion aus `config.json` und allen Dateien in `einheiten/`. Ein vertippter Eintrag wird nie zum Problem: Datei korrigieren, „state.json neu berechnen", fertig. Arbeitsgewichte werden nie direkt gesetzt — dafür gibt es den Log-Typ `anpassung`.

**„Mindestens" ist nicht „Maximum".** e1RM-Formeln setzen Nähe zum Versagen voraus; ein 5×5-Arbeitssatz ist submaximal, die Formel unterschätzt dort systematisch. Deshalb mischt die Verlaufskurve die Quellen nicht: gestrichelte Linie für Untergrenzen, Max-Outs als eigene Punkte.

---

## Selbst einrichten

Setlist ist für genau eine Person gebaut — dich. Es gibt keinen Login mit mehreren Konten; wer die App benutzt, ist der oder die, dessen `setlist-data`-Repo hinterlegt ist. Um eine eigene, unabhängige Instanz zu bekommen, brauchst du ein GitHub-Konto und etwa zehn Minuten.

**1 · App-Code forken**

Fork dieses Repo (`cyphomat/setlist`) in dein eigenes GitHub-Konto. Das ist der öffentliche Teil — Code, kein Personenbezug.

**2 · Eigenes Datenrepo anlegen**

Leg ein **privates** Repo namens `setlist-data` an. Dort hinein kommt mindestens eine `config.json` — das ist die einzige Datei, die du von Hand brauchst:

```json
{
  "bar": 20,
  "rounding": 2.5,
  "deload": { "afterFails": 3, "factor": 0.9 },
  "lifts": {
    "squat":    { "name": "Back Squat",   "increment": 2.5, "start": 40 },
    "bench":    { "name": "Bench Press",  "increment": 2.5, "start": 30 },
    "row":      { "name": "Barbell Row",  "increment": 2.5, "start": 30 },
    "ohp":      { "name": "Strict Press", "increment": 2.5, "start": 20 },
    "deadlift": { "name": "Deadlift",     "increment": 5.0, "start": 50 }
  },
  "workouts": {
    "A": [{ "lift": "squat", "sets": 5, "reps": 5 }, { "lift": "bench", "sets": 5, "reps": 5 }, { "lift": "row", "sets": 5, "reps": 5 }],
    "B": [{ "lift": "squat", "sets": 5, "reps": 5 }, { "lift": "ohp", "sets": 5, "reps": 5 }, { "lift": "deadlift", "sets": 1, "reps": 5 }]
  },
  "firstWorkout": "A",
  "rest": { "normal": 90, "afterFail": 180 },
  "plates": [25, 20, 15, 10, 5, 2.5, 1.25],
  "week": { "slots": [{ "day": 1, "type": "strength" }, { "day": 4, "type": "strength" }] }
}
```

`start` ist dein Einstiegsgewicht je Übung, `increment` die Steigerung pro erfolgreicher Einheit. `week.slots` legt fest, welche Wochentage etwas anstehen (`day`: 1 = Montag … 7 = Sonntag) — **anders als die übrigen Felder ist das nicht optional**, ohne `week` stürzt der Home-Screen beim Aufbau der Wochenübersicht ab. Willst du auch Radslots (`"type": "ride"`), brauchst du zusätzlich ein nicht-leeres `rides`-Array (`label`/`detail` je Eintrag) — sonst dasselbe Problem.

`state.json` **nicht** anlegen — die App leitet den Startzustand beim ersten Mal selbst aus `config.json` ab (`firstWorkout`, `start`-Gewichte) und schreibt ihn erst nach der ersten abgeschlossenen Einheit zurück. `einheiten/` als Ordner reicht leer. Wirklich optional sind dagegen `stimme.json` (eigene Sprüche, siehe `js/content.js` für die Struktur) sowie `records` und `ziele` in `config.json`, wenn du Meilensteine oder alte Bestleistungen wie im Original willst — schau notfalls direkt in Daniels `setlist-data`, welche Felder es dafür gibt.

**3 · Veröffentlichen**

Im Fork unter **Settings → Pages**: Source auf den `main`-Branch stellen. Nach ein bis zwei Minuten läuft die App unter `https://<du>.github.io/setlist/`.

**4 · GitHub-Token erzeugen**

Klick oben rechts auf dein **Profilbild → Settings** — deine persönlichen Kontoeinstellungen, **nicht** die Settings des Repos — dann **Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.** Zugriff nur auf dein Datenrepo, Permission **Contents → Read and write**, sonst nichts.

Beim ersten Öffnen landest du automatisch auf dem Setup-Screen. Dort trägst du deinen **GitHub-Nutzernamen**, den **Namen deines Datenrepos** (steht schon auf `setlist-data` vor) und den Token ein — kein Code-Editieren nötig, das Repo-Ziel ist direkt in der App einstellbar. Alle drei bleiben ausschließlich im `localStorage` deines Browsers.

**5 · intervals.icu — optional**

Nur nötig, wenn du auch Radeinheiten/Form/HRV/Schlaf willst. Key liegt unter **Settings → Developer** in deinem intervals.icu-Konto.

Fertig. Die erste Einheit legt `state.json` automatisch an; alles danach ist Ableitung, kein manuelles Pflegen.

---

## Aufbau

| Datei | Rolle |
|---|---|
| `js/program.js` | 5×5-Automat, Plattenrechner, e1RM. Reine Funktionen. |
| `js/coach.js` | Ansage, Ton, Meilensteine, Minierfolge. Ebenfalls rein. |
| `js/wod.js` | Jam-Generator, deterministisch über einen Seed. |
| `js/stats.js` | Tonnage, Bestwerte, Sparklines, Radstatistik. |
| `js/content.js` | Wissensschicht: Cues, Soundcheck, Technik, Encore, Stimme. |
| `js/bibliothek.js` | Bündelt alle Übungen zu einer durchsuchbaren Liste. |
| `js/i18n.js` | Oberflächentexte auf Deutsch und Englisch. |
| `js/store.js` | GitHub-API als Speicher, Offline-Puffer. |
| `js/intervals.js` | Liest Fahrten und Form; schreibt Krafteinheiten zurück. |
| `js/app.js` | Oberfläche und Ablauf. |
| `sw.js` | Cacht die App-Hülle. Trainingsdaten bewusst **nicht**. |

---

## Tests

```sh
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
for t in program coach wod stats intervals bibliothek i18n; do $JSC --module-file=tests/$t.test.js; done
```

460 Tests, ausgeführt von der JS-Engine, die in macOS ohnehin steckt. Kein Node, kein Build.

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
