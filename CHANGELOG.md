# Changelog

Alle nennenswerten Änderungen an Setlist. Neueste zuerst.

Die Versionsnummer ist das Datum plus eine laufende Zahl (`2026-09-01.73`). Sie steht
in `version.json` und im Cache-Namen von `sw.js` — beide werden gemeinsam gesetzt,
sonst merkt die installierte App nichts von einer neuen Fassung.

<sub>Deutsch · <a href="README.en.md">English README</a></sub>

---

## 2026-09-01.81

### Dokumentation
- **README beider Sprachen mit Screenshots der neuen Bildschirme**: Ersteinrichtung,
  „Deine Stimme", Orte und Geräte, die Ortswahl aus der Kopfzeile und der Fork-Hinweis.
  Echte Bildschirme mit Beispieldaten, keine Mockups.
- Neue Tabelle **Einrichten und anpassen** in den Funktionen. „Deine Stimme" und „Orte und
  Geräte" standen bis jetzt unter *Rad und Kondition* — dort gehörten sie nie hin.
- `tools/shots.mjs` ergänzt `tools/screens.sh`: ein paar Bildschirme hängen daran, was die
  API *antwortet* (fehlende `config.json`, neuere Version im Original) und lassen sich
  nicht aus dem Zwischenspeicher stellen. Playwright statt Chrome-unter-macOS, damit es
  überall läuft.

### Nebenbei
- Ankreuzfelder tragen jetzt die Bernsteinfarbe der App statt des Browser-Blaus.

---

## 2026-09-01.80

### Behoben — Datenverlust
- **Orte konnten verschwinden (schwerwiegend, von mir eingebaut).** Wer die Tour öffnete,
  *bevor* die Konfiguration geladen war, bekam einen leeren Orte-Entwurf. Der blieb in
  einer Modulvariable hängen und wurde auch dann nicht erneuert, wenn die Konfiguration
  kurz darauf ankam — die Liste zeigte weiter „Noch keine Orte eingerichtet". Ein Klick auf
  *Orte speichern* schrieb daraufhin `gyms: []` in die `config.json`, mit einem fröhlichen
  „ORTE GESPEICHERT" dazu. Nachgestellt und Zeile für Zeile belegt.

  Vier Stellen repariert:
  - Ohne geladene Konfiguration entsteht **kein** Entwurf mehr; es steht „Lädt…" und der
    Speichern-Knopf ist gesperrt.
  - Ein Entwurf wird verworfen, sobald eine Konfiguration geladen ist — auch aus dem
    Zwischenspeicher. Ein veralteter Entwurf kann keine frische Konfiguration überdauern.
  - Steht die Tour beim Fertigladen schon offen, wird sie aufgefrischt statt stehen zu
    bleiben (und der Mensch nicht auf den Startbildschirm zurückgerissen).
  - Letzte Sicherung beim Speichern: ein leerer Entwurf gegen eine Datei, in der Orte
    stehen, wird nur geschrieben, wenn wirklich etwas geändert wurde. Ausdrückliches
    Löschen aller Orte bleibt damit möglich, versehentliches Leerschreiben nicht.
- Der Ort-Knopf in der Kopfzeile blieb nach der Rückkehr aus der Tour auf altem Stand.

### Falls es dich getroffen hat
`config.json` liegt in einem Git-Repo — jede Änderung ist ein Commit. Unter
`setlist-data` → `config.json` → **History** steht der Stand von vor dem Überschreiben,
inklusive `gyms`-Block zum Zurückkopieren.

---

## 2026-09-01.79

### Neu
- **Der Ort steht jetzt im Kopf.** Ein Knopf in der Kopfzeile zeigt, wo du gerade
  trainierst, und öffnet die Auswahl — auf dem Startbildschirm wie im Jam. Vorher ging das
  nur im Jam, und man musste erst dorthin navigieren, um umzustellen.
- In der Auswahl steht je Ort, wie viele Jam-Bewegungen dort möglich sind (`14/31`) —
  sonst wählt man einen Ort und merkt erst danach, dass kaum etwas übrig bleibt.
- Im Jam ersetzt der Knopf die alte Chipreihe. Ein Umstellen dort würfelt weiterhin sofort
  neu, mit gleichem Seed und anderem Vorrat; der Hinweis unter der Kopfzeile bleibt.

### Bewusst so
- **Ohne eingerichtete Orte bleibt der Knopf weg.** Ein Schalter mit genau einer Stellung
  ist kein Schalter — und alles verhält sich dann exakt wie vorher.
- Lange Ortsnamen werden in der Kopfzeile beschnitten statt sie zu sprengen; im Dialog
  steht der volle Name.

---

## 2026-09-01.78

Die Schicht, die aus einem Programm *deine* App macht — bisher lag sie nur in
handgeschriebenem JSON und war damit faktisch für genau eine Person erreichbar.

### Neu
- **Tour → Backstage → Deine Stimme.** Drei Dinge sind jetzt in der App eintragbar:
  - **Dein Grund** — erscheint an den harten Tagen, und nur dann, damit er sich nicht
    abnutzt.
  - **Eigene Zeilen** — eine pro Zeile, gemischt mit den 52 mitgelieferten.
  - **Bestleistungen von früher** — je Übung Datum, bestes Einzel, bester 5er. Mit Datum
    erinnert die App an Jahrestagen daran:

    > **Aus deiner Geschichte** — Heute vor 5 Jahren: 140 kg Back Squat. Heute stehst du
    > bei 40 kg — nicht weil du weniger kannst, sondern weil du wieder anfängst.

### Bewusst so
- **Was von Hand gepflegt wurde, überlebt.** Nach Situation getrennte Sprüche
  (`comeback`, `leicht`, …) bleiben erhalten, auch wenn das Textfeld geleert wird — die
  Oberfläche schreibt nur unter `alle`. Ebenso bleiben `records.quelle` und
  `records.weitere` unangetastet.
- **Ein Datum allein ist keine Bestleistung.** Ohne Gewicht fällt der Eintrag weg, sonst
  stünde ein Jahrestag im Kalender, zu dem es nichts zu sagen gibt. Umgekehrt geht ein
  Gewicht ohne Datum durch — es zählt dann bei den Bestwerten, nur ohne Jahrestag.
- **Leere Felder räumen auf** statt leere Hüllen stehen zu lassen: kein Grund heißt kein
  `ziele`-Block, keine Rekorde heißt kein `records.programm`.
- **Zwei Dateien, beide vorher frisch gelesen** — `config.json` und `stimme.json`.
  `stimme.json` wird nur angefasst, wenn sich dort auch wirklich etwas ändert.

### Testabdeckung
Von 696 auf **745**. `persoenlich.test.js` prüft vor allem die Fälle, in denen etwas
verloren gehen könnte: handgepflegte Situationszeilen, `quelle` und `weitere` neben den
ersetzten Rekorden, halbe Daten, unsinnige Gewichte.

---

## 2026-09-01.77

Der erste Schritt weg von „das ist Daniels App" hin zu „das kann jemand anderes auch
benutzen". Die höchste Hürde war nicht das Training, sondern eine JSON-Datei.

### Behoben
- **Drei Abstürze bei unvollständiger `config.json`.** Fehlte `week`, fehlte `week.slots`
  oder stand ein Radslot ohne `rides`-Array da, starb der komplette Startbildschirm — ohne
  Meldung, ohne Hinweis, was fehlt. Wer die Datei von Hand schrieb, lief mit hoher
  Wahrscheinlichkeit hinein. Jetzt bleibt die Wochenübersicht in diesen Fällen leer und
  alles andere läuft weiter.

### Neu
- **Geführte Ersteinrichtung.** Findet die App kein Programm im Repo, kommt kein Fehler
  mehr, sondern ein Bildschirm: Stangengewicht, die fünf Übungen mit Startgewicht,
  Krafttage, optional Radtage. Daraus schreibt sie eine gültige `config.json`. Ein neues
  Repo braucht damit **keine einzige Datei von Hand**.
- „Überall mit der leeren Stange anfangen" als ein Klick — die ehrlichste Antwort auf
  „welches Startgewicht?", wenn man es nicht weiß.
- Ein Tag kann nicht Kraft- und Radtag zugleich sein; das Umschalten räumt den anderen
  automatisch ab.
- Wochentagskürzel sind jetzt übersetzt — vorher stand auch im englischen Modus
  „MO DI MI DO FR SA SO", auf dem Startbildschirm wie im Einrichten.

### Bewusst so
- **Die Aufteilung bleibt fest.** A/B, 5×5, Deadlift 1×5 — das ist das Programm, keine
  Einstellung. Wer daran dreht, hat am Ende eine beliebige Gym-App.
- **Vor dem Schreiben wird frisch nachgesehen.** Liegt inzwischen doch eine `config.json`
  da, wird sie nicht überschrieben.
- `rides` wird nur angelegt, wenn es auch Radtage gibt — ein leeres Array war genau die
  Falle, die den Startbildschirm sterben ließ.

### Testabdeckung
Von 644 auf **696**. `einrichten.test.js` prüft neben der Baulogik vor allem das, worauf es
ankommt: dass jede erzeugte Konfiguration ohne Nacharbeit durch `initialState`,
`planWeek` und `planWorkout` geht — für nur Kraft, Kraft und Rad, einen einzigen Tag und
alle sieben. Dazu die drei Absturzfälle in `program.test.js`.

---

## 2026-09-01.76

### Neu
- **Ein Fork merkt jetzt, dass es etwas Neues gibt.** Wer die App selbst betreibt, hat das
  Repo geforkt — und ein Fork bleibt stehen, wo er abgezweigt ist, ohne dass es jemandem
  auffällt. Die App vergleicht ihre Version beim Start mit der des Originals und sagt
  einmalig Bescheid; unter *Backstage → App* steht dann, welche Version oben liegt und
  welche hier läuft, samt Weg zum Aktualisieren (**Sync fork → Update branch**).
- Beide READMEs bekommen einen Schritt „Updates holen", auch für den Fall eigener
  Code-Änderungen über `upstream`-Remote.

### Bewusst so
- **Nur ein Hinweis, keine Selbstaktualisierung.** Ein Fork, der sich selbst überschreibt,
  wäre eine Fernsteuerung fremder Repos.
- **Höchstens einmal je neuer Version.** Ein Hinweis bei jedem Start wird nach dem dritten
  Mal weggeklickt statt gelesen.
- **Auf der Seite des Originals wird gar nicht erst gefragt** — dort ist man selbst die
  Quelle. Ebenso wenig beim lokalen Entwickeln.
- Versionen werden in Datum und laufende Nummer zerlegt verglichen. Als Zeichenkette wäre
  `.100` kleiner als `.75`, und genau dann fände ein Fork sein Update nicht.

---

## 2026-09-01.75

Ergebnis eines Sicherheits- und Datenschutz-Durchgangs.

### Behoben — Sicherheit
- **Fremdtext wurde ungeprüft ins DOM geschrieben (schwerwiegend).** Aktivitätsnamen aus
  intervals.icu setzt nicht der Nutzer, sondern Strava, Zwift oder eine Gruppenfahrt. Ein
  Name mit HTML darin führte Code aus — nachgestellt und reproduziert: drei Ausführungen
  auf Start- und Tour-Ansicht. Aus diesem Kontext sind GitHub-Token und intervals.icu-Key
  im `localStorage` lesbar, das Risiko war also der vollständige Verlust beider Zugänge.
  Sämtlicher Fremdtext wird jetzt maskiert (`js/sicher.js`): intervals.icu-Daten,
  Fehlermeldungen der GitHub-API, Namen und Freitexte aus `config.json`, `stimme.json`,
  `bibliothek.json` und den Log-Dateien.
- **Strikte Content-Security-Policy** als zweite Verteidigungslinie. `script-src 'self'`
  macht eingeschleuste `onerror`-Handler wirkungslos, `connect-src` begrenzt ausgehende
  Verbindungen auf GitHub und intervals.icu. Dafür ist das Inline-Skript nach `js/boot.js`
  gewandert — die Seite kommt damit ohne `unsafe-inline` aus.
- **Selbst eingetragene Videolinks** werden auf `http`/`https` begrenzt. Ein Link der Form
  `javascript:…` hätte sonst beim Antippen Code ausgeführt.
- **`tools/shot.html` läuft nur noch lokal.** Die Datei liegt im öffentlichen App-Repo und
  wird von GitHub Pages mit ausgeliefert — sie ruft aber `localStorage.clear()` auf. Wer
  sie versehentlich auf der eigenen Installation öffnete, verlor Token, Key und vor allem
  die Warteschlange mit noch nicht übertragenen Einheiten.
- Der YouTube-Link schickt keinen Referrer mehr — er verriet die Adresse der eigenen
  Installation und damit den GitHub-Nutzernamen.

### Neu — Datenschutz
- **Warnung, wenn das Datenrepo öffentlich steht.** Die App fragt die Sichtbarkeit beim
  Start ab und sagt es deutlich an. Vorher wäre das nie aufgefallen: ein öffentliches Repo
  funktioniert genauso gut wie ein privates, nur liest es die ganze Welt mit.
- README beider Sprachen bekommen einen Abschnitt, der belegbar aufführt, was wohin geht.

### Testabdeckung
Von 500 auf **617 Tests**. Vier neue Dateien für Bereiche, die vorher gar nicht oder nur
indirekt abgedeckt waren:
- `sicher.test.js` — Maskierung und Adressprüfung, inklusive des konkreten Angriffsstrings.
- `store.test.js` — die Speicherschicht hatte bisher **keine** Testdatei. Jetzt: Repo-Ziel
  samt Rückfallwerten, Token, Offline-Puffer und Lesecache, jeweils auch mit kaputten
  Daten.
- `grundlagen.test.js` — `isoWeek`, `mondayOf`, `ymd`, `isSuccess`, `fmtWeight`,
  `planWorkout`. Datumsrechnung inklusive der Stellen, an denen sie üblicherweise bricht:
  Sonntag, Jahreswechsel, Schalttag.
- `icu-queue.test.js` — die Warteschlange nach intervals.icu, besonders der Fall, dass eine
  Übertragung scheitert und die andere klappt.

---

## 2026-09-01.74

### Neu
- **Orte und Geräte.** Unter *Tour → Backstage → Orte und Geräte* legst du Gyms an —
  Homegym, Box, Studio — und hakst ab, was dort steht. Im Jam wählst du oben aus, wo du
  gerade bist; gewürfelt wird nur aus dem, was dieser Ort hergibt. Damit ist ein Jam
  daheim kein Glücksspiel mehr, bei dem Rudergerät und Langhantel auftauchen.
- Jede der 31 Jam-Bewegungen nennt jetzt ihre nötige Ausstattung. Reine
  Körpergewichtsübungen gehen überall.
- „Vorschläge übernehmen" legt die drei üblichen Orte grob ausgestattet an, als
  Startpunkt zum Anpassen.

### Bewusst so
- **Voreinstellung ist alles an.** Wer nichts einrichtet, bekommt exakt das Verhalten
  von vorher. Die Einschränkung ist eine Entscheidung, die man trifft, keine, in die
  man hineinstolpert.
- **Die Orte liegen im Repo, die aktuelle Wahl im Browser.** Wo du trainierst, gilt auf
  jedem Gerät; *wo du gerade stehst*, ist Sache des Geräts, das mitgeht.
- Bleiben an einem Ort weniger als zwei Bewegungen übrig, würfelt der Jam trotzdem aus
  allem — und sagt in der Ansicht, dass er das tut. Ein leerer Bildschirm wäre die
  schlechtere Antwort.

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
