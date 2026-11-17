# Airline Manager – Fahrplan

Noahs Wunschliste (32 Punkte) in neun Pakete aufgeteilt. **Ein Paket pro Version**, jeweils erst fertig
bauen, testen und freigeben, bevor das nächste beginnt. Reihenfolge ist ein Vorschlag und kann getauscht
werden – die Abhängigkeiten unten sagen, was nicht vorgezogen werden sollte.

Stand: 17.11.2026 · aktuelle Version im Spiel: **v0.30**

> **Erledigt:** Paket 2 (Airline-Zentrale und Kostenstruktur) als v0.17, Paket 3 (Abflüge und
> Flugabrechnung) als v0.21, Paket 4 (Erlöse und Reputation) als v0.22, Paket 5 (Hub und
> Ausstattung) als v0.23, Paket 6 (Finanzen) als v0.24, Paket 7 (Karte und Bodenbetrieb) als v0.25,
> Paket 8 (Welt und Ereignisse) als v0.26, Paket 9 (Börse und Rangliste) als v0.27.
> **Spielspaß-Paket (nicht aus der ursprünglichen Liste):** Ziele, Streckenbewertung und
> Flottenvereinheitlichung sind als v0.19 fertig. Umsteiger am Drehkreuz als v0.29, geführter
> Einstieg, Benachrichtigungen und Balance-Werkzeug als v0.28, IROPS als v0.30.
> **Zurückgestellt:** Paket 1 (Flugzeugformen) – auf Noahs Wunsch später, zusammen mit den Norebbo-Vorlagen.

---

## Schon erledigt (v0.16)

| Punkt | Was | Stand |
|---|---|---|
| 1 | Nur die 38 Typen aus dem Bilderordner, alle ab Werk weiß | ✅ Typen und Weiß fertig · Formen → Paket 1 |
| 1 | 10 Lackierungen je Flugzeug | ⚠️ Als 10 **Schemata** ohne Markenlogos umgesetzt (Eurowhite, Cheatline, Billboard …) × 10 Farbwelten. Echte Airline-Logos sind Marken und können auf einer öffentlichen Seite nicht nachgebaut werden. |
| 2 | Vorgefertigte Lackierungen, trotzdem frei bemalbar | ✅ |
| 3 | Datenblatt je Flugzeug mit Untergruppen, echte Daten | ✅ Markt + Hangar |
| 4 | Grünes Symbol am Zielflughafen | ✅ grün am Boden, grau in Wartung, gelb in der Luft |
| 7 | Flughöhe, Geschwindigkeit, Restzeit beim Anklicken | ✅ |
| 22 | Flüge laufen weiter, wenn der Tab zu ist | ✅ war schon Kernprinzip |
| 31 | Gebrauchte mit schlechteren Werten | ✅ Zustand 35–98 %, Reichweite, Verbrauch, Defekte, Restwert |

---

## Paket 1 – Flugzeugformen 1:1 → zurückgestellt

Die Formen kommen aus Noahs Seitenansichten. Rumpf und Seitenleitwerk sind schon pixelgenau abgepaust
(Deckung 86–93 %), **Flügel, Höhenleitwerk und Triebwerksform sind noch berechnet** – genau die Teile,
die ein Flugzeug falsch aussehen lassen.

- Flügel, Höhenleitwerk und Triebwerksgondel ebenfalls aus den Bildern abpausen (`tools/trace_profiles.py`)
- Leitwerks-Hinterkante korrigieren (aktuell zu viel Material unten hinten)
- T-Leitwerke (CRJ, ERJ, 717, 1900D) sitzen noch falsch
- Beechcraft 1900D (Turboprop) und Concorde (Delta) neu aufbauen
- Zielwert: **über 95 % Deckung** mit der Vorlage, messbar über das Overlay-Werkzeug

**Test:** Overlay-Vergleich je Typ, dazu Sichtprüfung aller 38 Typen nebeneinander.
**Rechtlich:** Nur die Umrisse der echten Flugzeuge werden übernommen – die Form eines A320 ist frei.
Die Bilder selbst kommen nicht ins Repo. Als Pausvorlage sind Norebbos weiße Templates vorgesehen; der Autor
erlaubt die Nutzung für eigene Lackierungen, verlangt aber, die Bilder nicht unverändert weiterzuverbreiten,
und freut sich über eine Quellenangabe. Dann gehört Norebbo in README und Credits.

**Offen:** Noah lädt die „all white"-Vorlagen herunter und legt sie in den Bilderordner.

---

## Paket 2 – Airline-Zentrale und Kostenstruktur → ✅ v0.17

Punkte 5, 9, 16, 27 · **das größte Paket, Grundlage für Paket 3 und 4**

- Zwei aufklappbare Panele links und rechts statt vieler Fenster; links prominent **Airline**
- Flotte auf einen Blick: am Boden und in der Luft, jedes Flugzeug direkt anklickbar
- Managementbereich als eine Seite statt verschachtelter Menüs
- **Kostenstruktur** mit Einnahmen und Ausgaben, an den echten Flugbetrieb angelehnt:
  Personal (Cockpit, Kabine, Boden, Verwaltung), Kerosin, Gebühren, Wartung, Vertrieb, Fixkosten
- Personal anwerben, wenn die Flotte wächst – zu wenig Personal bremst den Betrieb
- Etwas mehr Farbe, ohne bunt zu werden

**Test:** erledigt – Margen gemessen über 28 Spieltage, Kostenanteile gegen echte Airline-Strukturen geprüft.

**Erledigt:** Das Wachstumsproblem aus diesem Paket ist mit **Leasing** gelöst (v0.18, aus Paket 6 vorgezogen).

---

## Paket 3 – Abflug und Flugabrechnung → v0.21 ✅

Punkte 6, 8 · erledigt

- ✅ Bereich **Abflüge** im Airline-Panel: alles am Gate mit laufender Restzeit und Verspätungsgrund
- ✅ Ein Knopf zieht alle vor – als **Schnellabfertigung** statt Startfreigabe, siehe unten
- ✅ **Flugabrechnung** über 6 h / 24 h / 7 Tage: Umsatz und Kosten nach Posten, Gewinn, Marge
- ✅ Jeder Flug einzeln aufklappbar
- ✅ Streckenbewertung mit Sternen aus Auslastung, Pünktlichkeit und Ertrag je Sitz
- ✅ Bodenabfertiger wählbar: Sparanbieter · Standard · Premium

**Gelöster Konflikt:** Punkt 6 will einen Abflugknopf, Punkt 22 will, dass Flieger auch bei
geschlossenem Tab fliegen. Beides geht nur, wenn Flugzeuge weiter von allein starten – der Knopf kürzt
deshalb die Standzeit gegen Aufpreis, statt den Start überhaupt erst auszulösen. Der Preis hängt an der
gesparten Zeit. Anwesenheit wird belohnt, Abwesenheit nicht bestraft.

**Test:** erledigt – drei Tests in `sim.test.mjs` (Abfertigerstaffelung, Preis und Abflugzeit beim
Vorziehen, Sterne und Teilnoten), dazu Browsercheck auf Desktop und Telefon.

---

## Paket 4 – Erlöse und Reputation → v0.22 ✅

Punkte 10, 11, 12, 13, 14 · erledigt

- ✅ Buy on Board: Sortiment wählbar (schlicht · Standard · Marken und Region) mit eigenen Margen
- ✅ Catering: Umfang wie bisher wählbar, jetzt mit dem Sortiment kombinierbar
- ✅ Charterangebote von Reiseveranstaltern: ganzes Flugzeug für mehrere Tage, ungewöhnliche Ziele
- ✅ Werbung in vier Kanälen mit je eigener Wirkung, Anlaufzeit, Nachwirkung und Klassengewichtung
- ✅ Sonderlackierungen an Firmen vermieten
- ✅ Reputation aufgeschlüsselt, jeder Baustein mit Hinweis, sortiert nach Schadenshöhe

**Test:** erledigt – sechs Tests in `sim.test.mjs`, darunter eine Messung über 28 Tage: gezielte Werbung
bringt mehr als sie kostet, das größte Budget füllt zwar die Flugzeuge, kostet unterm Strich aber mehr.
Die Zeitunabhängigkeit der Bekanntheit ist eigens geprüft (240 Einzelschritte gegen einen Sprung).

---

## Paket 5 – Hub und Ausstattung → v0.23 ✅

Punkte 15, 25, 28 · erledigt

- ✅ Drehkreuz als eigenes Fenster, ein Reiter je Hub
- ✅ Gates in vier Stufen: kürzere Standzeit, weniger Verspätung, besserer Ruf – nur am eigenen Hub
- ✅ Lounges in vier Stufen: Ruf und Nachfrage in den vorderen Klassen
- ✅ Technik in vier Stufen: schnellere und billigere Checks, gedeckelt an den Hallenplätzen.
  Das „Personal einstellen" steckt in den Technikerkosten, die mit der eigenen Werft sinken –
  eine fünfte Personalgruppe hätte der Oberfläche mehr geschadet als genützt.
- ✅ Tanklager steht mit im selben Fenster
- ✅ Kabinenausstattung je Flugzeug: Sitzart (Standard · Slimline · Komfort) und Unterhaltung
  (keine · WLAN · WLAN und Bildschirme). Dekor ist bewusst weggelassen – die Lackiererei deckt das ab.

**Test:** erledigt – drei Tests in `sim.test.mjs`: Ausbaustufen mit Wirkung auf Standzeit, Ruf und
Unterhalt (inklusive Schrittweiten-Unabhängigkeit), Lounge und Werft, Kabinenumbau mit Sitzbudget.

---

## Paket 6 – Finanzen → v0.24 ✅

Punkte 29, 30 · erledigt · Leasing war als v0.18 schon da

- ✅ Kredite mit Zinsen, als Annuität (Raten) oder endfällig (am Stück)
- ✅ Zinssatz aus Ruf und Verschuldung, Rahmen aus Ertrag und eigenem Flottenwert
- ✅ Vorzeitige Ablösung, verpasste Raten mit Folgen statt Spielende
- ✅ Kerosin mit Diagrammen: Preisverlauf, Tanklagerstand, Tagesverbrauch der letzten 14 Tage

**Test:** erledigt – drei Tests in `sim.test.mjs` (Raten über 370 Tage, Schrittweiten-Unabhängigkeit
über 20 Tage auf den Cent, Ablösung und verpasste Raten).

---

## Paket 7 – Karte und Bodenbetrieb → v0.25 ✅

Punkte 17, 18 · erledigt

- ✅ Vier Kartenstile: Dunkel, Hell, Schema, Satellit (NASA Blue Marble, gemeinfrei)
- ✅ Nachtschatten aus Datum und Uhrzeit, für alle Spieler gleich
- ✅ Ab Zoomstufe 11 Bahnen, Vorfeld und Rollwege; Flugzeuge stehen am Gate, rollen zur Bahn
  und beschleunigen dort

**Wie angekündigt vereinfacht:** Für rund 60 große Flughäfen sind die echten Bahnrichtungen
hinterlegt (FRA mit drei Parallelbahnen und der 18), alle übrigen bekommen ein Schema mit einer
Bahn, deren Richtung deterministisch aus dem ICAO-Code kommt. Gatepositionen sind überall schematisch.

**Test:** erledigt – zwei Tests in `sim.test.mjs` (Terminator gegen bekannte Fälle wie Polarnacht
auf Spitzbergen, Bahnlage und Rollphasen über die Zeit), dazu Browsercheck auf FRA.

---

## Paket 8 – Welt und Ereignisse → v0.26 ✅

Punkte 19, 20, 23, 26 · erledigt

- ✅ Kalender mit elf Terminen von Weihnachten bis Zuckerfest, Urlaub und Geschäft gegenläufig
- ✅ Ereignisse: Streik, Luftraumsperrung, Unwetterlage, Konjunkturdelle, Großveranstaltung
- ✅ Ausweichlandungen mit Zusatzkosten, Verspätung und Rufverlust
- ✅ Steckbrief je Flughafen mit eigenen Zahlen und Streckenvorschlägen
- ✅ Erste zehn Flüge im vierfachen Tempo

**Test:** erledigt – vier Tests in `sim.test.mjs`: Osterdaten gegen bekannte Jahre, Feiertagswirkung
nach Ländern, Ereignisse deterministisch und in plausibler Häufigkeit (rund 50 im Jahr), Sperrungen
verschieben Abflüge, Ausweichlandungen selten und reproduzierbar.

---

## Paket 9 – Börse und Rangliste online → v0.27 ✅ (Spielseite fertig)

Punkte 21, 24, 32 · **der Client ist fertig, der Server fehlt noch**

- Ab 2 Flugzeugen für die Börse qualifiziert, Eintrag mit dem eigenen Spielercode
- Airline live für alle sichtbar in Aktienmarkt und Rangliste
- Bewertung: Reputation 0–5 Sterne mit Nachkommastelle · Größe (Flotte, Personal, Ziele, Fluggäste) ·
  Wirtschaftlichkeit 0–100 %
- Aktualisierung alle 2 Stunden
- Anteile anderer Airlines kaufen, höchstens 49 %, Wert wächst mit der Airline, jederzeit verkaufbar
- Flotte, Ziele und grobe Finanzzahlen anderer Spieler einsehbar

- ✅ Ab 2 Flugzeugen qualifiziert, Eintrag mit dem eigenen Spielercode
- ✅ Bewertung: Sterne 0–5 mit Nachkommastelle · Größe 0–100 · Wirtschaftlichkeit 0–100 %
- ✅ Aktualisierung alle 2 Stunden
- ✅ Beteiligungen bis 49 %, Wert wächst mit der Airline, jederzeit verkaufbar
- ✅ Flotte, Ziele und grobe Finanzzahlen anderer Spieler einsehbar

**Was noch fehlt, und zwar nur das:** Dein Freund muss das Supabase-Projekt anlegen. Das SQL steht
fertig im README unter „Online-Börse mit Supabase" – eine bestehende Datenbank braucht nur
`alter table airlines add column if not exists profile jsonb;` und die neue `publish_airline`.
Bis dahin läuft die Demo-Börse mit zehn Beispiel-Airlines, die jetzt ebenfalls Profile und
Bewertungen haben. Ohne Server ist außerdem Schummeln per DevTools möglich.

---

## Paket 10 – Spielspaß, zweite Stufe

Aus der Empfehlungsliste, noch offen – nach Wirkung sortiert:

- ✅ **Umsteiger am Drehkreuz** (v0.29): Ankünfte und Abflüge im Anschlussfenster zählen für beide
  Flüge. Umsteigeranteil wächst von 5 % des Erlöses bei zwei Strecken auf 16 % bei acht.
- **Unregelmäßigkeiten (IROPS)**: Flugzeug fällt aus – verspäten, streichen, tauschen oder ferryen,
  mit Folgen für Reputation und Kosten. Passt eng zu Paket 8 (Diversions).
- **Wartende Entscheidungen**: Charterangebote mit Frist, Kerosin-Tief zum Eindecken, Störungen, die
  eine Antwort brauchen. Teils in Paket 4 und 8 enthalten – dort bewusst als Entscheidung bauen, nicht als Meldung.
- ✅ **Browser-Benachrichtigung** (v0.28), meldet nur, was eine Entscheidung verlangt
- ✅ **Geführter Einstieg** (v0.28): sieben Schritte, die sich selbst abhaken
- ✅ **Balance-Werkzeug fest im Repo** (v0.28): `tools/balance.mjs`, acht Szenarien

## Abhängigkeiten

```
Paket 1  (Formen)        ── unabhängig
Paket 2  (Airline-UI)    ── Grundlage für 3 und 4
   ├─ Paket 3  (Abflug)
   └─ Paket 4  (Erlöse)
Paket 5  (Hub)           ── unabhängig
Paket 6  (Finanzen)      ── unabhängig
Paket 7  (Karte/Boden)   ── unabhängig
Paket 8  (Ereignisse)    ── unabhängig
Paket 9  (Online)        ── braucht Supabase
```

## Ablauf je Paket

1. Umsetzen, Balance-Werte nach `js/core/config.js`, Eintrag in `js/data/changelog.js`
2. `node games/airline-manager/tests/sim.test.mjs` muss grün bleiben, neue Tests dazu
3. Durchspielen im Browser, Screenshots zur Abnahme
4. Version an drei Stellen hochzählen: `core/config.js` (GAME.label), `index.html` (ver der Spielkarte),
   README → „Änderungen"
5. Nach Freigabe auf `main` pushen
