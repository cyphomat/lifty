# Changelog

Alle nennenswerten Änderungen an Setlist. Neueste zuerst.

Die Versionsnummer ist das Datum plus eine laufende Zahl (`2026-09-01.73`). Sie steht
in `version.json` und im Cache-Namen von `sw.js` — beide werden gemeinsam gesetzt,
sonst merkt die installierte App nichts von einer neuen Fassung.

<sub>Deutsch · <a href="README.en.md">English README</a></sub>

---

## 2026-09-01.73

### Neu
- **Sprachumschalter** unter *Tour → Backstage → Sprache*: Deutsch und Englisch.
  Betrifft die Oberfläche — Beschriftungen, Knöpfe, Meldungen, Hinweise. Die
  Trainingsinhalte (Ansage, Übungserklärungen, Cues, Jam-Bewegungen, Rad-Begründungen)
  bleiben vorerst deutsch: das ist Fachtext, der inhaltlich übersetzt gehört und nicht
  Wort für Wort.
- **Englische README** (`README.en.md`), beidseitig mit der deutschen verlinkt.
- **Dieser Changelog.**
- `js/i18n.js` als neue Textschicht mit 18 eigenen Tests — darunter ein Abgleich, dass
  beide Sprachen dieselben Schlüssel *und* dieselben Platzhalter haben. Ein vertipptes
  `{kg}` fiele sonst erst im Studio auf.

### Geändert
- `aria-label` der Icon-Knöpfe werden mitübersetzt statt fest deutsch zu bleiben.
- Zahlformate folgen der gewählten Sprache (`1.234` gegen `1,234`).

---

## 2026-09-01.72

### Behoben
- Die Token-Anleitung ließ offen, ob die Einstellungen im Repo oder im eigenen Konto
  liegen. Setup-Screen und README verweisen jetzt ausdrücklich auf *Profilbild →
  Settings* und grenzen das von den Repo-Settings ab. (Rückmeldung des ersten
  Selbsteinrichters.)

---

## 2026-08-31.71

### Neu
- **Repo-Ziel im Setup-Screen einstellbar.** GitHub-Nutzername und Name des Datenrepos
  werden in der App eingetragen statt in `js/store.js` einkompiliert — eine eigene
  Instanz braucht damit keinen Code-Editor mehr. Bestehende Installationen laufen über
  einen Rückfallwert unverändert weiter.
- **Anleitung zum Selbst-Einrichten** in der README, mit geprüftem Minimalbeispiel für
  `config.json`.

### Geändert
- **Körpergewicht von der Startseite in die Tour** verschoben. Es steht jetzt bei
  Fitness und Ermüdung statt auf dem Bildschirm, den man anderen zeigt.

---

## 2026-08-31.70

### Neu
- **Erholung aus HRV und Schlaf**, gelesen aus intervals.icu (meist über HealthFit aus
  Apple Health). Die HRV wird nur relativ zur eigenen Basis der letzten Tage bewertet,
  nie absolut — absolute Schwellen sagen zwischen zwei Menschen nichts.
- Fällt die Erholung ab, **sagt die App TECHNIK an** und überstimmt damit Trainingsplan
  und offene Fehlversuche. Beides sieht etwas, das reine Trainingslast nicht erfasst.

---

## 2026-08-30

### Neu
- **Bibliothek**: alle Übungen an einem Ort — Grundlifts, Technik, Mobility, Finisher
  und Jam-Bewegungen, durchsuchbar und nach Kategorie filterbar. Eigene Notizen und
  Videolinks landen in `bibliothek.json` und wachsen mit.
- **Frage nach dem Gefühl** auf dem Geschafft-Screen (Leicht / Normal / Hart / Extrem)
  und **Ansage gegen Gefühl** in der Tour. Damit wird die Vorhersage überprüfbar statt
  bloß behauptet.
- **Mobility** als eigener Block und eigener Knopf, einmal pro Kalenderwoche fällig —
  bei der ersten Einheit, egal ob Kraft oder Jam.
- **Ton** bei Pausenende und Einheitsabschluss, zusätzlich zur Vibration.
- Zwölf neue Jam-Bewegungen (Kettlebell, Kurzhantel, Toes-to-Bar, Air Squats, HSPU,
  Devil's Press …) und fünf neue Mobility-Dränge.
- Soundcheck-Zeilen sind abhakbar.

### Behoben
- **Pausentimer lief nach dem letzten Satz weiter.** Nach dem letzten Satz der Einheit
  gibt es nichts mehr, wofür man pausieren würde.
- **Doppelte Einträge in intervals.icu.** Die Apple Watch erkennt Krafttraining oft
  selbst über die Herzfrequenz und reicht es verzögert über Strava nach. Der eigene
  Push wartet deshalb bis zum nächsten App-Start, statt dem zuvorzukommen.
- **Echter Zufallsfehler bei kurzen Listen.** Der rohe Hashwert modulo Listenlänge ist
  bei fünf Einträgen nicht zufällig, weil 31 ≡ 1 (mod 5) — dieselbe Auswahl kam
  systematisch zu oft. Jetzt läuft der Wert erst durch eine Durchmischung.
- Zweiter Squat-Fehler ergänzt (abhebende Fersen), nach Abgleich mit der Fachliteratur.

---

## 2026-08-28

### Neu
- **Aus lifty wird Setlist.** Neuer Name, neues Gesicht: die App sieht aus wie eine
  Backline, die Woche ist eine Setlist.
- **Die Tour** wird zur Übersicht: Trainingskalender über 26 Wochen, gestapelte
  Wochenlast aus Kraft und Rad, Wochenvolumen, Fitness gegen Ermüdung, Gewichtskurve.
- **Sektion „Zum Angeben"** — bewegtes Gewicht in Marshall-Halfstacks, Wiederholungen
  seit dem ersten Log, Lieblingstag, längste Serie.
- **Zwei Spalten** ab 900 px, für den Mac.
- **Eigene Stimme**: Zeilen aus `stimme.json` werden mit 52 mitgelieferten gemischt
  statt sie zu ersetzen. Dazu Meilensteine aus den alten Bestleistungen.
- **Minierfolge** stehen nach jeder Einheit ganz oben — erst der Erfolg, dann der
  Bericht.
- **Log-Typ `anpassung`** für von Hand gesetzte Arbeitsgewichte. `state.json` bleibt
  damit durchgängig abgeleitet und wird nie direkt gepflegt.
- Erklärtexte für alle Jam-Übungen.

### Behoben
- Bestwerte-Karten sprengten auf dem Handy das Layout — die Zeilen brechen jetzt um.
- „vor 1 Tagen" bei der letzten Fahrt.
- Regelmäßigkeits-Quote zählt ab dem ersten aktiven Tag statt gegen ein halbes Jahr,
  in dem man noch gar nicht angefangen hatte.
- Münzwurf und Zeilenauswahl zogen aus denselben Bits und waren dadurch gekoppelt.
- Grammatik in den erzeugten Sätzen: falsche Artikel, doppeltes „Geschafft",
  „Woche(n)".
- Übungsnamen durchgängig englisch, auch in der Prosa.
