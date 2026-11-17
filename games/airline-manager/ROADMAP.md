# Airline Manager – Fahrplan

Noahs Wunschliste (32 Punkte) in neun Pakete aufgeteilt. **Ein Paket pro Version**, jeweils erst fertig
bauen, testen und freigeben, bevor das nächste beginnt. Reihenfolge ist ein Vorschlag und kann getauscht
werden – die Abhängigkeiten unten sagen, was nicht vorgezogen werden sollte.

Stand: 17.11.2026 · aktuelle Version im Spiel: **v0.19**

> **Erledigt:** Paket 2 (Airline-Zentrale und Kostenstruktur) ist als v0.17 fertig.
> **Spielspaß-Paket (nicht aus der ursprünglichen Liste):** Ziele, Streckenbewertung und
> Flottenvereinheitlichung sind als v0.19 fertig. Offen daraus: Umsteiger am Drehkreuz, IROPS,
> wartende Entscheidungen, Benachrichtigungen, geführter Einstieg – siehe unten.
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

## Paket 3 – Abflug und Flugabrechnung → v0.18

Punkte 6, 8 · **braucht Paket 2**

- Liste „bereit zum Abflug" in der Airline-Zentrale, alternativ als kleines Popup
- Ein Knopf schickt alle startbereiten Flieger los
- Danach Abrechnung aller gerade gestarteten Flüge: Umsatz, Kosten, Gewinn
- Jeder Flug einzeln aufklappbar
- Bewertung der Strecke aus Auslastung und Zufriedenheit
- Wahl des Bodenabfertigers: günstig (mehr Verspätung, unzufriedene Gäste) · mittel · Premium (teuer, top)

**Test:** 20 Flüge sammeln lassen, Sammelabflug, Zahlen gegen das Logbuch prüfen.

---

## Paket 4 – Erlöse und Reputation → v0.19

Punkte 10, 11, 12, 13, 14 · **braucht Paket 2**

- Buy on Board: verschiedene Angebote, unterschiedliche Margen
- Catering: Umfang wählbar, kostenlos oder kostenpflichtig
- Charterangebote von Reiseveranstaltern: ganze Flugzeuge, ungewöhnliche Ziele, viel Aufwand, viel Ertrag
- Werbung: TV und Radio, Plakat, Zeitung, Online – je eigene Wirkung und Kosten
- Sonderlackierungen an Firmen verkaufen
- Reputation im Detail aufgeschlüsselt, mit Tipps zur Verbesserung

**Test:** Reputation über mehrere Wochen Spielzeit beobachten, Werbung muss spürbar, aber nicht zu stark wirken.

---

## Paket 5 – Hub und Ausstattung → v0.20

Punkte 15, 25, 28

- Hub-Steuerung als eigener Bereich
- Bessere Gates: teurer, dafür pünktlicher und zufriedenere Gäste
- Lounges in verschiedenen Größen bauen und ausstatten
- Technikhangar ausbauen, Personal einstellen → bessere und schnellere Wartung
- Tanklager ausbauen
- Kabinenausstattung je Flugzeug: Sitzart bis Dekor

**Test:** Ausbaustufen durchspielen, Wirkung auf Pünktlichkeit und Wartungszeit messen.

---

## Paket 6 – Finanzen → v0.21

Punkte 29, 30 · **Leasing ist als v0.18 schon erledigt**

- Kredite mit Zinsen, Rückzahlung am Stück oder in Raten
- Kerosin mit Diagrammen statt Zahlenkolonnen (Preisverlauf, Tanklagerstand, Verbrauch)

**Test:** Kredit aufnehmen, Raten über Spielzeit laufen lassen, Kasse muss stimmen.

---

## Paket 7 – Karte und Bodenbetrieb → v0.22

Punkte 17, 18

- Kartenstile umschaltbar: Satellit, Schema, Tag und Nacht
- Beim Hineinzoomen: Flugzeuge starten am Gate, rollen zur Bahn, starten dort

**Hinweis:** Der Rollbetrieb braucht Gate- und Bahnlagen. Für die großen Flughäfen machbar, für alle 137
wird es ein vereinfachtes Schema geben.

**Test:** Auf mehrere Flughäfen zoomen, Rollwege plausibel, Leistung auf dem Handy prüfen.

---

## Paket 8 – Welt und Ereignisse → v0.23

Punkte 19, 20, 23, 26

- Kalender in Echtzeit: Feiertage, besondere Ereignisse
- Ereignisse im Spielverlauf: fiktive Krisen sperren Routen, Unwetter stören den Betrieb
- Diversions: technische Probleme oder Zwischenfälle mit Passagieren
- Beschreibung je Flughafen: was gut läuft, welche Strecken sich lohnen, wie pünktlich er ist
- Erste 10 Legs mit vierfachem Tempo, danach normal

**Test:** Zeit vorspulen, Ereignisse müssen für alle Spieler gleich eintreten (deterministisch).

---

## Paket 9 – Börse und Rangliste online → v0.24

Punkte 21, 24, 32 · **braucht Supabase – ohne Server nicht umsetzbar**

- Ab 2 Flugzeugen für die Börse qualifiziert, Eintrag mit dem eigenen Spielercode
- Airline live für alle sichtbar in Aktienmarkt und Rangliste
- Bewertung: Reputation 0–5 Sterne mit Nachkommastelle · Größe (Flotte, Personal, Ziele, Fluggäste) ·
  Wirtschaftlichkeit 0–100 %
- Aktualisierung alle 2 Stunden
- Anteile anderer Airlines kaufen, höchstens 49 %, Wert wächst mit der Airline, jederzeit verkaufbar
- Flotte, Ziele und grobe Finanzzahlen anderer Spieler einsehbar

**Voraussetzung:** Dein Freund muss das Supabase-Projekt anlegen. Das SQL steht fertig im README unter
„Online-Börse mit Supabase". Ohne Server bleibt es bei den Demo-Airlines, und Schummeln per DevTools ist möglich.

---

## Paket 10 – Spielspaß, zweite Stufe

Aus der Empfehlungsliste, noch offen – nach Wirkung sortiert:

- **Umsteiger am Drehkreuz**: Ankünfte und Abflüge in Wellen, Umsteigeverbindungen zählen.
  Macht die Abflugzeit zur Entscheidung und ein Drehkreuz mehr wert als die Summe seiner Strecken.
  Das aufwendigste Einzelstück im ganzen Fahrplan, aber das, was das Spiel von anderen unterscheiden würde.
- **Unregelmäßigkeiten (IROPS)**: Flugzeug fällt aus – verspäten, streichen, tauschen oder ferryen,
  mit Folgen für Reputation und Kosten. Passt eng zu Paket 8 (Diversions).
- **Wartende Entscheidungen**: Charterangebote mit Frist, Kerosin-Tief zum Eindecken, Störungen, die
  eine Antwort brauchen. Teils in Paket 4 und 8 enthalten – dort bewusst als Entscheidung bauen, nicht als Meldung.
- **Browser-Benachrichtigung**, wenn wirklich etwas wartet (Flugzeug ohne Strecke, Leasing läuft aus,
  Check überfällig).
- **Geführter Einstieg**: die ersten zehn Minuten an die Hand nehmen – jetzt umso wichtiger, wo man
  mit 12 Mio startet und leasen muss.
- **Balance-Werkzeug fest ins Repo**, damit jede Änderung sofort zeigt, was mit den Margen passiert.

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

1. Umsetzen, Balance-Werte nach `js/core/config.js`
2. `node games/airline-manager/tests/sim.test.mjs` muss grün bleiben, neue Tests dazu
3. Durchspielen im Browser, Screenshots zur Abnahme
4. Version an drei Stellen hochzählen: `core/config.js` (GAME.label), `index.html` (ver der Spielkarte),
   README → „Änderungen"
5. Nach Freigabe auf `main` pushen
