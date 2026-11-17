# Airline Manager

Wirtschaftssimulation im Browser: eigene Airline gründen, Airbus- und Boeing-Flotte aufbauen, Strecken in Echtzeit
fliegen, Wartung planen, Kerosin einkaufen und an der Börse mit den Airlines anderer Spieler handeln.

Kein Build-Step, keine Abhängigkeiten außer MapLibre (liegt in `lib/`). Wie die anderen Spiele der Seite
läuft alles als statische Dateien.

## Starten

```bash
# im Repo-Root
python3 -m http.server 8000
# → http://localhost:8000/games/airline-manager/
```

ES-Module brauchen einen Webserver, `file://` funktioniert nicht.

**Dev-Modus:** `?dev=1` an die URL hängen. In der Konsole dann `am.clock.shift(5)` (5 Stunden vorspulen) und `am.step()`.

**Tests der Simulation** (ohne Browser): `node games/airline-manager/tests/sim.test.mjs`

## Ordnerstruktur

```
games/airline-manager/
├─ index.html              Hülle: Karte, HUD, Dock, Fensterebene
├─ css/
│  ├─ base.css             Farben, Schrift, Bausteine (Buttons, Tabellen, Pills …)
│  ├─ layout.css           Karte, HUD, Dock, Fenster, Flug-Infokarte, Onboarding
│  └─ apps.css             Inhalte der einzelnen Fenster
├─ js/
│  ├─ main.js              Verdrahtung: Kontext, Dock, Live-Schleifen, Start
│  ├─ core/                ohne DOM, läuft auch in Node
│  │  ├─ config.js         ALLE Balance-Werte (Preise, Gebühren, Check-Intervalle, Risiko …)
│  │  ├─ store.js          Spielstand anlegen/laden/speichern/migrieren, Export/Import
│  │  ├─ clock.js          Spielzeit = Gerätezeit (+ Dev-Verschiebung)
│  │  ├─ events.js         Event-Bus Simulation → UI
│  │  └─ util.js           deterministischer Zufall, Formatierung
│  ├─ data/
│  │  ├─ aircraft.js       38 Typen (Airbus, Boeing, Bombardier, Embraer, Beechcraft, Concorde) + Datenblatt
│  │  ├─ airports.js       137 Flughäfen: IATA/ICAO, Koordinaten, Bahnlänge, Nachfrage-Faktoren
│  │  └─ changelog.js      Änderungsverlauf für den Knopf im Spiel (bei jeder Version ergänzen)
│  ├─ sim/                 Spiellogik, ohne DOM
│  │  ├─ engine.js         settle(): rechnet alles bis "jetzt" nach (Kern des Offline-Prinzips)
│  │  ├─ actions.js        jede Spieleraktion mit Regelprüfung
│  │  ├─ flight.js         Blockzeit, Reichweite, Bahnprüfung, Position zu jedem Zeitpunkt
│  │  ├─ demand.js         Nachfrage: Stadtgröße, Geschäft vs. Urlaub, Saison, Wochentag, Preis, Reputation
│  │  ├─ economy.js        Einnahmen und Kosten pro Flug
│  │  ├─ fuel.js           weltweit identischer Kerosinpreis, Tanklager
│  │  ├─ maintenance.js    A/B/C/D-Checks, Überfälligkeit, Risiko
│  │  ├─ reputation.js     Reputation aus Preisen, Gebühren, Service, Schulung, Sicherheit
│  │  ├─ market.js         Neukauf (Vertragsrabatte), Gebrauchtmarkt, Restwert
│  │  ├─ stocks.js         Unternehmenswert, Aktienkurs, Depot, Demo-Börse
│  │  ├─ ledger.js         Buchhaltung (jede Geldbewegung läuft hier durch)
│  │  └─ geo.js            Großkreis-Mathematik
│  ├─ net/
│  │  ├─ config.js         Supabase-URL/Key (leer = Demo)
│  │  ├─ player.js         Spielercode + geheimer Schlüssel
│  │  └─ backend.js        publish / fetchMarket / cloudSave / cloudLoad
│  └─ ui/
│     ├─ map.js            MapLibre-Karte im Flightradar-Stil
│     ├─ windows.js        Fenstermanager (Apps über der Karte)
│     ├─ hud.js, flightcard.js, onboarding.js, toast.js, dom.js, icons.js
│     ├─ aircraftArt.js    Einstieg für Grafiken (Seitenansicht + Karten-Icon)
│     ├─ painter.js        Lackiererei: eigene Livery malen
│  ├─ art/                 Flugzeugformen und Lackierung, ohne DOM
│  │  ├─ geometry.js       Seitenprofile: abgepaust (data/profiles.json) oder aus echten Maßen
│  │  ├─ render.js         Zeichentrick-Renderer (Konturen, Glanz, Fenster, Livery pro Bauteil)
│  │  ├─ livery.js         Livery-Format (Bauteil-Koordinaten → passt auf jeden Typ)
│  │  └─ path.js           geglättete Konturen, Pinselstriche, Vereinfachung
│     ├─ panels.js         zwei Panele oben (links Airline, rechts Betrieb)
│     ├─ panels/            airline.js (Übersicht, Flotte, Personal, Kosten …), ops.js (Routen, Markt, Technik …)
│     └─ apps/             hangar, shop, routes, maint, fuel, stocks, leaderboard, logbook
├─ lib/                    MapLibre GL (Kopie aus history-shots)
├─ data/profiles.json      abgepauste Blaupausen-Profile aller 38 Typen (tools/trace_profiles.py)
├─ tools/
│  ├─ trace_profiles.py      Seitenansichten automatisch abpausen → profiles.json
│  ├─ profil-werkstatt.html  Blaupausen von Hand abpausen → profiles.json (im Browser öffnen)
│  └─ dxf_to_svg.py          Herstellerzeichnungen (DXF) → SVG
└─ tests/sim.test.mjs      Simulationstests
```

Regel: `core/` und `sim/` kennen kein DOM. Die UI ruft nur `sim/actions.js` auf (über `ctx.run`), nie direkt den Spielstand.
So bleibt die Logik testbar und lässt sich später auch auf einen Server verschieben.

## Echtzeit ohne Server

Jedes Flugzeug auf einer Strecke hat nur einen Eintrag `ops = { routeId, dir, dep }`: Richtung und Abflugzeit des
aktuellen Legs. Daraus folgt alles andere:

- **Position** = Anteil `(jetzt − Abflug) / Blockzeit` auf dem Großkreis (`flight.js → positionAt`).
- **Abrechnung**: `engine.js → settle(state, jetzt)` arbeitet alle bis jetzt beendeten Flüge der ganzen Flotte in
  zeitlicher Reihenfolge ab (Einnahmen, Kosten, Verschleiß, Checks, Risiko) und plant das nächste Leg
  (Ankunft + Turnaround). Läuft beim Öffnen und alle 5 Sekunden.
- Wer um 13:00 einen 5-h-Flug startet und um 17:00 wiederkommt, sieht das Flugzeug kurz vor der Landung – und alle
  inzwischen beendeten Flüge sind abgerechnet.
- **Zufall ist deterministisch** (Hash aus Flugzeug-ID + Abflugzeit). Neu laden würfelt nichts neu, und es ist egal,
  ob man jede Minute oder einmal am Tag reinschaut (Test „Abrechnung ist unabhängig …“).
- Nach langer Abwesenheit wird höchstens `GAME.maxCatchupDays` (30) nachgerechnet.
- Wird die Geräteuhr zurückgestellt, rechnet das Spiel nicht rückwärts.

Auch der **Kerosinpreis** und der **Gebrauchtmarkt** sind reine Funktionen der Weltzeit bzw. des Datums:
Alle Spieler sehen im selben Moment denselben Preis und dieselben Angebote, ganz ohne Server.

## Online-Börse mit Supabase

Ohne Einrichtung läuft eine Demo-Börse mit Beispiel-Airlines. Für die echte Börse und Rangliste
(wie bei History Shots):

1. Kostenloses Projekt auf supabase.com anlegen.
2. Im SQL-Editor ausführen (eine bestehende Datenbank aus einer älteren Version braucht nur
   `alter table airlines add column if not exists profile jsonb;` und die neue `publish_airline`):

```sql
create extension if not exists pgcrypto;

create table airlines (
  code text primary key check (code ~ '^AL-[A-Z0-9]{3}-[A-Z0-9]{3}$'),
  name text not null check (char_length(name) <= 28),
  iata text check (char_length(iata) <= 3),
  hub text,
  share_price numeric not null default 0,
  value numeric not null default 0,
  rep numeric,
  fleet int,
  profit_30d numeric,
  livery jsonb,
  profile jsonb,            -- Kurzprofil: Flotte, Personal, Ziele, Fluggäste, Marge, Bewertung (v0.27)
  updated_at timestamptz not null default now()
);
alter table airlines enable row level security;
create policy "lesen" on airlines for select using (true);   -- schreiben nur über die Funktionen unten

create table airline_keys (code text primary key, secret_hash text not null);
alter table airline_keys enable row level security;           -- keine Policy = von außen unlesbar

create table saves (code text primary key, state jsonb not null, updated_at timestamptz default now());
alter table saves enable row level security;

create or replace function check_key(p_code text, p_secret text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select secret_hash into h from airline_keys where code = p_code;
  if h is null then
    insert into airline_keys values (p_code, crypt(p_secret, gen_salt('bf')));
  elsif h <> crypt(p_secret, h) then
    raise exception 'falscher Schlüssel';
  end if;
end $$;

create or replace function publish_airline(p_code text, p_secret text, p_data jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_key(p_code, p_secret);
  insert into airlines (code, name, iata, hub, share_price, value, rep, fleet, profit_30d, livery, profile, updated_at)
  values (p_code, left(p_data->>'name', 28), left(p_data->>'iata', 3), p_data->>'hub',
          least((p_data->>'share_price')::numeric, 1e6), (p_data->>'value')::numeric, (p_data->>'rep')::numeric,
          (p_data->>'fleet')::int, (p_data->>'profit_30d')::numeric, p_data->'livery', p_data->'profile', now())
  on conflict (code) do update set name = excluded.name, iata = excluded.iata, hub = excluded.hub,
    share_price = excluded.share_price, value = excluded.value, rep = excluded.rep, fleet = excluded.fleet,
    profit_30d = excluded.profit_30d, livery = excluded.livery, profile = excluded.profile, updated_at = now();
end $$;

create or replace function save_game(p_code text, p_secret text, p_state jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_key(p_code, p_secret);
  insert into saves values (p_code, p_state, now())
  on conflict (code) do update set state = excluded.state, updated_at = now();
end $$;

create or replace function load_game(p_code text, p_secret text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform check_key(p_code, p_secret);
  return (select state from saves where code = p_code);
end $$;

grant execute on function publish_airline, save_game, load_game to anon;
```

3. In `js/net/config.js` Projekt-URL und anon/public Key eintragen.

Ehrlicher Hinweis: Ohne Server, der das Spiel selbst simuliert, kann ein Spieler mit Entwicklerwerkzeugen seinen
Spielstand manipulieren. Der Schlüssel verhindert nur, dass jemand **fremde** Airlines überschreibt. Für ein
Freundes-Spiel reicht das; für Ranglisten mit Preisen bräuchte es serverseitige Plausibilitätsprüfungen
(z. B. maximaler Kurssprung pro Stunde in `publish_airline`).

## Flugzeugformen, Blaupausen und Lackiererei

**Alle Flugzeuge sind ab Werk komplett weiß.** In der Lackiererei (Klick auf das Kürzel oben links oder
Airline → Livery) malt man die eigene Livery: Pinsel, Linie, Band (waagerechte Fläche, ideal für Bauch und
Zierstreifen), Füllen, Text, Radierer, Rückgängig. Gespeichert wird pro Bauteil (Rumpf, Seitenleitwerk,
Höhenleitwerk, Flügel, Triebwerke) in relativen Koordinaten – deshalb passt dieselbe Livery auf jeden Typ.

**Woher die Formen kommen** (`js/art/geometry.js`):

1. **Abgepauste Blaupausen** aus `data/profiles.json` – haben Vorrang und übernehmen die Form 1:1.
   Seit v0.16 sind **alle 38 Typen** abgepaust (automatisch, siehe unten).
2. Solange ein Typ nicht abgepaust ist: Profil aus echten Maßen pro Baureihe (Länge, Rumpfhöhe,
   Nasen- und Heckform, Leitwerkshöhe und -pfeilung, Flügel mit V-Stellung, Winglet-Art, Triebwerksgröße und -lage).

**Automatisch abpausen** (`tools/trace_profiles.py`, seit v0.16): Ein Ordner mit Seitenansichten (eine Datei pro
Typ, Dateiname = Typ wie in der Tabelle `TYPES` im Skript, PNG/JPG/AVIF mit weißem oder transparentem Hintergrund)
wird in einem Rutsch zu `profiles.json`:

```
pip install numpy scipy pillow          # einmalig (AVIF braucht Pillow ≥ 11)
python3 -I tools/trace_profiles.py <bilderordner> games/airline-manager/data/profiles.json --debug /tmp/dbg
```

Aus dem Bild kommen Rumpf-Ober-/Unterkontur (Nase, 747-Buckel, Heckkonus), das Seitenleitwerk (exakt), die Lage
der Triebwerke und die Fensterreihe. Flügel, Höhenleitwerk, Pylone, Türen und Cockpit werden parametrisch an den
erkannten Stellen ergänzt. `--debug` schreibt Masken mit den erkannten Linien zum Prüfen. Die Bilder selbst landen
nicht im Repo – nur die Konturen. Gestapelte Mehrfachansichten (oberste zählt), Rahmen/Text (werden abgetrennt) und
ausgefahrenes Fahrwerk (schmale Auswüchse werden ignoriert) sind abgefangen.

**Einen Typ von Hand abpausen** (Profil-Werkstatt, ca. 10–15 Minuten pro Typ):

1. `tools/profil-werkstatt.html` im Browser öffnen (über den lokalen Webserver, siehe „Starten“).
2. Blaupause laden oder Screenshot einfügen. Gute Quellen: die Seitenansicht in den
   Aircraft-Characteristics-PDFs von Airbus bzw. den Airport-Planning-Dokumenten von Boeing
   (Kapitel „General Airplane Dimensions“).
3. Typ wählen, Maßstab setzen (Nasenspitze, dann hinterste Stelle).
4. Rumpf, Seitenleitwerk, Höhenleitwerk, Flügelteile, Triebwerke, Cockpitfenster als Punkte abklicken;
   Fensterreihen und Türen mit zwei Klicks. Die Konturen werden automatisch weich geglättet
   (Zeichentrick-Look), Alt+Klick macht einen Punkt zur harten Ecke (z. B. Leitwerksspitze).
5. Rechts die Vorschau im Spiel-Look prüfen, dann `profiles.json` herunterladen und
   `games/airline-manager/data/profiles.json` damit ersetzen. Fertig – das Spiel nutzt die neue Form sofort.

Der Arbeitsstand bleibt im Browser gespeichert; das Bild selbst wird nirgends hochgeladen und landet nicht im Repo –
im Spiel steckt nur die abgepauste Kontur.

**Rechtliches:** Nur die Form wird übernommen, keine Grafik. Trotzdem: Boeing vermerkt bei den Zeichnungen
„All Rights Reserved“ (Zweck: Gate-Planung), Airbus verweist auf eigene Nutzungsbedingungen. Für ein öffentliches
Spiel lieber kurz klären bzw. eigene Vorlagen nutzen.

`tools/dxf_to_svg.py` wandelt die AutoCAD-Zeichnungen der Hersteller (DXF) in SVG um – praktisch, um daraus ein
sauberes Bild für die Profil-Werkstatt zu machen.

## Daten prüfen

`data/aircraft.js` enthält Richtwerte (Sitze, Reichweite, Startstrecke, Verbrauch, Nutzlast, Listenpreis, Wartung pro
Flugstunde, Crew). Vor dem Release gegen die Aircraft-Characteristics-PDFs (Airbus) bzw. Airport Planning Documents
(Boeing) abgleichen. Preise: Listenpreise × `MARKET_FACTOR` (0,55) in `sim/market.js`, weil Airlines real deutlich
unter Liste kaufen. Wer exakte Listenpreise will, setzt den Faktor auf 1.

Neue Flughäfen: eine Zeile in `data/airports.js`. Neue Flugzeuge: eine Zeile in `data/aircraft.js` – Shop, Grafik,
Livery, Checks und Wirtschaft funktionieren automatisch.

## Balance – erste Stellschrauben

Gemessen mit den Tests (7 Tage Echtzeit): ein A320neo auf FRA–LHR verdient ca. 0,55 Mio $/Woche, ein A350-900 auf
FRA–JFK ca. 2,7 Mio $/Woche. Ein Flugzeug spielt sich also in Monaten bis gut einem Jahr Echtzeit ein – realistisch,
aber langsam. Hebel in `core/config.js`: `GAME.startCash`, `GAME.marketShare`, `CABIN.refFare`, `DEMAND.k`,
`FEES`, `STAFF`, sowie `MARKET_FACTOR`. Checks: `CHECKS.*.fh/days/downH` (C- und D-Check stehen Wochen in Echtzeit).

## Fahrplan

Die Wunschliste ist in neun Pakete aufgeteilt – eines pro Version, jeweils fertig und getestet, bevor das
nächste beginnt: siehe **[ROADMAP.md](ROADMAP.md)**.

## Was als Nächstes kommt (Vorschläge)

- Eigenes Bestätigungs-Popup statt `confirm()`
- Englische Übersetzung (die Seite ist zweisprachig) – Texte liegen noch direkt in den Apps
- Frachtflugzeuge (777F, 747-8F, A350F) und reine Frachtstrecken
- Kredite, Leasing statt Kauf, Kapitalerhöhung über eigene Aktien
- Konkurrenz auf Strecken: Nachfrage teilen, wenn andere Spieler dieselbe Strecke fliegen (braucht Backend)
- Slots an Tier-5-Flughäfen, Nachtflugverbote
- Ereignisse (Streik, Vulkanasche, Messen mit Nachfragespitzen)

## Änderungen

**v0.30 – Störfälle mit echten Entscheidungen** (aus Paket 10)
- `sim/irops.js`: Ein schwerer Defekt (`IROPS.chancePerLeg`, rund jeder 250. Flug) legt einen Fall an.
  Die Reparaturdauer steht fest und ist deterministisch aus Flugzeug und Zeit; entschieden wird nur
  über die Fluggäste.
- Vier Optionen mit Kosten, Rufwirkung und Verzug: `wait` (Entschädigung nach Dauer, angelehnt an
  die europäische Regel), `cancel`, `swap` und `ferry`. `replacements` prüft Reichweite, Sitzzahl
  und Verfügbarkeit, `ferryQuote` rechnet den Leerflug.
- Neuer Flugzeugstatus `aog`. `nextEventAt` liefert das Minimum aus Entscheidungsfrist und
  Reparaturende; bei Fristablauf wendet die Engine `wait` an. Der Flug selbst ist zu dem Zeitpunkt
  bereits abgerechnet und steht normal im Flugbuch – nur der nächste Umlauf wird nicht geplant.
- Panel-Abschnitt **Störfall** mit laufendem Countdown, sichtbar nur bei offenem Fall;
  `ui/notify.js` meldet Störfälle vor allem anderen.

**v0.29 – Umsteiger am Drehkreuz** (aus Paket 10)
- `sim/connections.js`: Jedes Flugzeug pendelt mit fester Umlaufzeit, daraus lassen sich seine
  Ankünfte und Abflüge am Drehkreuz vorwärts und rückwärts projizieren (`hubTimetable`) – ohne
  zusätzlichen Zustand und damit ohne Gefahr für die Nachrechen-Invariante.
- `connectingPax` zählt für einen Abflug die Ankünfte im Anschlussfenster (und umgekehrt),
  dämpft mit Umweg (`detourFactor`) und Umsteigezeit (`waitFactor`) und deckelt auf die freien Sitze.
- **Der entscheidende Nenner:** Der Tagesmarkt eines Städtepaars verteilt sich auf *alle* eigenen
  Abflüge dieser Strecke am Tag (`flightsPerDay`). Ohne ihn stieg dieselbe Nachfrage bei jedem
  Abflug erneut ein – in der ersten Fassung lag die Auslastung dadurch bei 98 %.
- Der Durchgangspreis liegt unter der Summe zweier Einzelflüge und wird nach Entfernung auf
  Zubringer und Weiterflug verteilt, damit kein Erlös doppelt gezählt wird. Örtliche Nachfrage
  behält Vorrang; `rev.tickets` kommt weiter nur von ihr, Umsteiger laufen unter `rev.transfer`.
- `hubWaves` liefert Ankunfts- und Abflugwellen über 24 Stunden und eine Note, wie gut die Umläufe
  zusammenpassen – im Drehkreuz-Fenster als Diagramm.
- Gemessen über 28 Tage ab FRA: 2 Strecken 5 % Umsteigeranteil (LF 60 %), 4 Strecken 13 % (LF 70 %),
  8 Strecken 16 % (LF 75 %).

**v0.28 – Geführter Einstieg und Benachrichtigungen** (aus Paket 10)
- `sim/firststeps.js`: sieben Schritte, abgeleitet aus dem Spielstand – nichts zusätzlich gespeichert
  außer dem Ausblenden-Flag in `prefs`. Panel-Abschnitte können sich jetzt über `hidden(ctx)`
  selbst verbergen; „Erste Schritte" verschwindet, sobald alles erledigt ist.
- `ui/notify.js`: `pending(state, now)` sammelt, was eine Entscheidung verlangt; `check` meldet
  höchstens eine Sache auf einmal, nur bei verstecktem Tab und mit sechs Stunden Sperre je Thema.
  Die Erlaubnis wird nur aus einem Klick heraus angefragt, wie Browser es verlangen.
- `tools/balance.mjs`: acht Szenarien (Referenz, Überversorgung, Netz, Leasingwachstum, Werbung,
  Service, Drehkreuz, Kredit) in einer Tabelle. `node games/airline-manager/tools/balance.mjs`,
  mit `--tage` und `--szenario` steuerbar. Flugzeug-IDs werden festgesetzt, damit Läufe vergleichbar sind.
- Fehler behoben: `mostUrgent(...)?.overdue` gibt es nicht – das Feld heißt `state === "overdue"`.
  Dadurch wurde `stats.lastOverdue` nie gesetzt und das Ziel „Technisch sauber" war von Anfang an erfüllt.

**v0.27 – Bewertung, Rangliste und Beteiligungen** (Paket 9)
- `sim/rating.js`: drei Kennzahlen, bewusst nur aus dem, was eine Airline *veröffentlicht* –
  damit funktionieren sie für fremde Airlines genauso wie für die eigene. Die Teilskalen laufen
  über eine Wurzelkurve (`(v/max)^0.45`): früh spürbar, oben gestaucht.
- `profileOf(state, now)` baut das Kurzprofil, das `publish` mitschickt; `qualifies` verlangt
  `RATING.minFleet` Flugzeuge, `STOCKS.publishEveryMs` begrenzt auf alle zwei Stunden.
- Beteiligungen sind bei `STOCKS.maxStake` gedeckelt (49 %); `maxShares` und `stakeIn` in
  `sim/stocks.js`, geprüft in `buyShares`.
- `net/backend.js` fragt die neue Spalte `profile` ab und fällt bei Status 400 auf die alte
  Abfrage zurück – eine Datenbank aus einer früheren Version funktioniert also weiter.
- **Noch offen, nicht am Spiel:** Ohne Supabase-Projekt läuft weiter die Demo-Börse. Das SQL steht
  unten; eine bestehende Datenbank braucht nur die neue Spalte und die neue `publish_airline`.

**v0.26 – Welt, Kalender und Ereignisse** (Paket 8)
- `sim/calendar.js`: Feiertage und Ferien als reine Funktion des Datums, inklusive Osterformel
  und Näherungen für Neujahrsfest und Zuckerfest. Jeder Termin liefert getrennte Faktoren für
  Geschäftsreise und Urlaub; `demandFactor` dämpft Überlagerungen mit `CALENDAR.weight`.
  Der alte `DEMAND.xmasBoost` in der Saisonkurve ist entfallen, sonst hätte Weihnachten doppelt gezählt.
- `sim/events.js`: Ereignisse werden wochenweise aus dem Datum gewürfelt (`rand01` auf den
  Wochenschlüssel), nicht gespeichert. Fünf Arten mit eigener Wahrscheinlichkeit; über ein Jahr
  kommen rund 50 Ereignisse zusammen. `closureAt` / `departureNotBefore` schieben Abflüge,
  `effectsAt` wirkt auf Kosten und Nachfrage, `diversion` liefert Ausweichlandungen.
- Ausweichlandungen sind bewusst vereinfacht: Der Flug endet am geplanten Ziel, kostet aber extra,
  verspätet sich deutlich und nennt den Ausweichflughafen. Ein echter Streckenwechsel würde das
  Pendel-Fahrplanmodell sprengen.
- `sim/airportInfo.js`: Steckbrief aus vorhandenen Daten – Größe, Profil, Bahn, Gebühren,
  Wetterneigung (über ein Jahr abgetastet) und die eigenen Zahlen der letzten zwei Wochen.
  Streckenvorschläge sind auf die Reichweite der eigenen Flotte gefiltert.
- Schnellstart: `clock.advanceBoost(factor)` summiert zusätzliche Spielzeit, solange weniger als
  `BOOST.legs` Flüge abgerechnet sind. Der Vorlauf liegt in `state.boost` – ohne ihn spränge die
  Uhr beim nächsten Laden zurück und der Nachrechner bliebe stehen.
- Neues Fenster **Welt** (`ui/apps/world.js`) und eine Sektion im Betriebs-Panel.

**v0.25 – Kartenstile und Bodenbetrieb** (Paket 7)
- `ui/map.js`: `MAP_STYLES` mit vier Stilen. Schema und Satellit sind eigene Style-Objekte im Code
  (Satellit: NASA GIBS Blue Marble, gemeinfrei, ohne Schlüssel, maxzoom 8). Auswahl und
  Nachtschatten liegen in `prefs`, bleiben also über Sitzungen erhalten.
- `nightPolygon(ts)` in `sim/geo.js`: Terminator aus vereinfachter Sonnenposition. Für jede Länge
  gilt `lat = atan(-cos(Stundenwinkel) / tan(Deklination))`; das Polygon schließt zum Pol der
  gerade dunklen Halbkugel. Rein aus der Uhrzeit, also für alle gleich.
- `data/runways.js`: echte Bahnrichtungen für rund 60 große Flughäfen, Rest deterministisch aus
  dem ICAO-Code. `sim/ground.js` baut daraus Bahnen, Vorfeld, Gates und Rollweg.
- `groundPosition(ap, acId, ts, { dep, arr })` liefert Gate, Rollweg oder Startlauf – alles aus
  `ac.ops.dep` abgeleitet, damit auch die Bodenbewegung bei jedem Blick gleich aussieht.
  Die Kursberechnung korrigiert die Längengradstauchung, sonst steht das Flugzeug schief zur Bahn.
- Die Karte zeichnet den Bodenbetrieb erst ab `GROUND.zoom`; darunter bleibt alles wie bisher.

**v0.24 – Kredite und Kerosin-Diagramme** (Paket 6)
- `sim/credit.js`: Annuität und endfälliger Kredit. Zahlungen sind **feste Termine** (`nextDue`),
  keine laufende Verzinsung – damit hängt wie beim Charter nichts an der Schrittweite.
  `creditLimit` aus Ertrag der letzten 30 Tage, eigenem Flottenwert (Sicherheit) und Kasse,
  minus dem Vielfachen der monatlichen Verpflichtungen. Firmenwert zählt bewusst nicht mit.
- `interestRate` aus Grundzins, Ruf und Verschuldungsgrad. Verpasste Rate: Restschuld plus
  Zuschlag, Laufzeit verlängert sich, Ruf sinkt – aber kein Spielende.
- Neues Fenster **Bank** (`ui/apps/bank.js`), Finanzierungsblock im Airline-Panel.
- `ui/chart.js`: kleine SVG-Diagramme (Linie, Säulen, Anteilsbalken) ohne Fremdpaket.
  Kerosin zeigt damit den Tagesverbrauch der letzten 14 Tage und die Reichweite des Vorrats.
- **Wichtige Korrektur an der Kernregel:** Ziele wurden bisher am Ende jedes `settle`-Durchlaufs
  geprüft, also bei stündlichem Nachrechnen zu anderer Zeit als bei täglichem. Da die Belohnung
  Reputation enthält und Reputation die Nachfrage steuert, lief das Ergebnis langsam auseinander
  (gemessen 671 $ auf 17,7 Mio $ über 20 Tage). Die Prüfung sitzt jetzt **am Ereignis selbst**;
  nur wenn die ganze Flotte steht, wird am Ende geprüft. Der Invariantentest läuft jetzt über
  14 Tage und vergleicht Kasse, Reputation und Zielliste auf den Cent genau.

**v0.23 – Drehkreuz, Technik und Kabine** (Paket 5)
- `sim/hub.js`: Ausbau je Flughafen (`state.hub[IATA]`), drei Bereiche mit je vier Stufen, Konfiguration
  unter `HUB`. Investition einmal, danach Unterhalt pro Tag – zeitanteilig gebucht wie Gehälter.
- Gates wirken ortsgebunden: `turnaroundHours(state, ac, at)` und `handlerDelay(state, ac, dep, at)`
  nehmen jetzt den Flughafen entgegen und greifen nur, wenn er ein eigenes Drehkreuz ist.
- `hangarEffect` deckelt den Werftvorteil an den Hallenplätzen: `covered = slots / Flotte`, Checkdauer,
  Checkkosten und Technikeranteil der Fixkosten werden nur anteilig gesenkt.
- `loungeFactor` hebt die Nachfrage in F und J (Premium halb), Economy bleibt unberührt.
- `sim/fitting.js`: Sitzart (`seatBonus` auf `seatsMax`) und Unterhaltung je Flugzeug, gewichtet nach
  Sitzen in `fleetFitting`. Der Umbau schneidet eine zu große Bestuhlung automatisch zurück und blockiert
  das Flugzeug über `ac.fitReady`.
- Neues Fenster **Drehkreuz** (`ui/apps/hub.js`), Ausstattungsblock im Hangar, Sektion im Betriebs-Panel.
- Tests: Flugzeug-IDs sind dort jetzt fest (`stableIds`). Sie sind im Spiel zufällig, und der gesamte
  deterministische Zufall hängt daran – ohne feste IDs lieferte derselbe Lauf mal zwei, mal drei Flüge
  in sechs Stunden, und die Suite war gelegentlich rot.

**v0.22 – Werbung, Charter und Sonderlackierungen** (Paket 4)
- `sim/marketing.js`: Bekanntheit 0–100 als **reine Funktion der Zeit**, nicht als mitgeschleppter Wert.
  Je Kampagne ein Vorrat nach `dS/dt = g − λS` (λ aus der Halbwertszeit des Kanals), Anlauf als Faktor,
  Summe über alle Kampagnen plus Grundbekanntheit aus der Zahl der Ziele. Dadurch bleibt die Invariante
  „stündlich reinschauen = einmal reinschauen" erhalten; bezahlt wird beim Buchen, nicht zeitanteilig.
  `awarenessFactor` liegt bei einer jungen Airline auf 1,0 – Werbung ist Aufschlag, kein Pflichtprogramm.
- `sim/charter.js`: tagesfeste ACMI-Angebote aus Datum, Drehkreuz und Ruf. Index 0 immer Schmalrumpf,
  Index 2 immer Großraum, damit nie ein Tag ohne brauchbares Angebot dasteht. Neuer Flugzeugstatus
  `charter`; `nextEventAt` liefert das Vertragsende, `process` zahlt die Restsumme, bucht die Flugstunden
  auf die Wartung und setzt das Flugzeug auf seine alte Strecke zurück. Verkauf und Leasingrückgabe sind
  währenddessen gesperrt.
- `sim/adlivery.js`: wochenfeste Angebote, Tagessatz aus Sitzzahl × Bekanntheit × Ruf. Der Vertrag hängt
  am Flugzeug (`ac.adLivery`), nicht am Status – `nextEventAt` nimmt deshalb das Minimum aus Statustermin
  und Vertragsende. Rufabzug über `liveryRep`, gedeckelt bei `ADLIVERY.repMax`.
- `ONBOARD` in der Konfiguration: Sortiment im Bordverkauf mit `salesMul` und `costShare`
  (Wareneinsatz als Anteil vom Umsatz, läuft über die Catering-Kostenstelle).
- `repBreakdown` / `repAdvice` in `sim/reputation.js`: jeder Baustein mit Hinweistext, sortiert nach
  Schadenshöhe. `bestAtZero` markiert die Bausteine, bei denen 0 schon das Beste ist.
- Neues Fenster **Vermarktung** (`ui/apps/marketing.js`) mit den drei Reitern, neue Panel-Sektion
  **Vermarktung**, Sortimentwahl unter **Service**, Reputationsbereich mit aufklappbaren Hinweisen.
- Gemessen über 28 Tage, zwei Flugzeuge auf gesunden Strecken: ohne Werbung 3,73 Mio $ Ergebnis,
  mit Online/mittel 4,10 Mio $ (189 k$ Werbung), mit TV/groß 3,60 Mio $ (1,51 Mio $ Werbung).
  Gezielte Werbung lohnt sich, das größte Budget füllt die Flugzeuge, kostet aber mehr als es bringt.

**v0.21 – Abflüge und Flugabrechnung** (Paket 3)
- `sim/handling.js`: Bodenabfertigung als Airline-Einstellung (`airline.handler`, Konfiguration unter
  `HANDLERS`). Der gewählte Abfertiger skaliert die Standzeit (`turnaroundHours(state, ac)`, ersetzt
  `turnaroundH(type)`), die Handlingkosten (`costFactor`) und den Reputationsfaktor `abfertigung`; dazu
  kommt eine eigene deterministische Verspätungsquelle `handlerDelay`.
- Verspätungen werden in `engine.js` jetzt als Liste von Quellen gesammelt (Defekt, Wetter,
  Personalmangel, Abfertiger) und summiert, statt sich gegenseitig zu überschreiben – die Abrechnung
  nennt den Grund.
- Schnellabfertigung: `rushDeparture` / `rushAll` kürzen die laufende Standzeit um `rush.cut`. Der Preis
  skaliert mit der Restzeit (`rushCost(state, ac, left)`), damit spätes Drücken weder teuer noch nutzlos
  ist. Flugzeuge starten weiterhin ohne Zutun – der Knopf macht es nur schneller (Punkt 6 und 22 der
  Wunschliste vertragen sich so).
- `sim/report.js`: `tally`, `legsSince`, `rateRoute` (0–5 Sterne aus Auslastung, Pünktlichkeit und
  Ertrag je Sitz gegen `refFare`, dazu Hinweis auf die schwächste Teilnote) und `routeReport`.
- Neu im Airline-Panel: Bereich **Abflüge** (Zahlen der letzten sechs Stunden, Gate-Liste mit laufender
  Restzeit über `tick`, Vorziehen einzeln oder gesammelt) und Abfertigerwahl im Bereich **Service**.
- Neues Fenster **Flugabrechnung** (`ui/apps/report.js`): Zeiträume 6 h / 24 h / 7 Tage, Umsatz und
  Kosten nach Posten, Streckenbewertung mit Sternen, jeder Flug einzeln aufklappbar.

**v0.20 – Änderungsverlauf im Spiel**
- Knopf unten im Airline-Panel („Airline Manager v0.20 · Was ist neu") öffnet den Verlauf aller Versionen
  seit Projektbeginn (`data/changelog.js`, `ui/apps/changelog.js`). Nach einem Update erscheint dort ein
  Hinweis, bis der Spieler ihn gelesen hat (`prefs: changelog-seen`).
- **Beim Hochzählen der Version gehört ab jetzt ein Eintrag in `data/changelog.js` dazu** – ein Test prüft,
  dass `GAME.label` und der oberste Eintrag übereinstimmen, dass die Liste absteigend sortiert ist und dass
  jeder Eintrag Titel, Datum und mindestens einen Punkt mit gültiger Markierung hat.
- Behoben: Auf schmalen Bildschirmen öffneten sich Fenster hinter dem Panel, weil das Panel dort die ganze
  Breite einnimmt. Panele klappen jetzt ein, sobald ein Fenster aufgeht – betraf jeden „Öffnen"-Knopf.
- Tests: 20.

**v0.19 – Ziele, Streckenbewertung, Flottenvereinheitlichung**
- **Ziele und Meilensteine** (`sim/goals.js`): 20 Ziele in fünf Gruppen (Aufbau, Betrieb, Flotte, Netz,
  Wirtschaft) mit Fortschrittsbalken und Belohnung – Einmalzahlung, dauerhafter Leasingrahmen oder
  Reputation. Vorher konnte man ewig spielen, ohne je ein Etappenziel zu erreichen. Das Panel zeigt
  „Als Nächstes" und schlägt dabei immer aus der frühesten offenen Gruppe vor.
  Dafür führt der Spielstand jetzt eine dauerhafte Statistik (`state.stats`: Passagiere, Flüge, Kilometer,
  angeflogene Ziele, letzte große Verspätung, letzter überzogener Check) – `state.flights` ist gedeckelt
  und taugte dafür nicht.
- **Streckenbewertung vor dem Zuweisen** (`sim/demand.js → routeOutlook`, `ui/outlook.js`): zeigt buchbare
  Nachfrage, erwartete Auslastung und wie viele Flugzeuge dieses Typs die Strecke sinnvoll trägt – im Hangar
  und in der Routen-App, live beim Umschalten. Vorher konnte man blind eine dünne Strecke überversorgen und
  verlor Geld, ohne je gewarnt worden zu sein. Die Bewertung mittelt eine Woche und ist damit saisonal:
  Palma im Juli trägt deutlich mehr als im November.
- **Flottenvereinheitlichung** (`sim/commonality.js`): Wer überwiegend eine Baureihe fliegt, spart bis zu
  18 % Wartung, 15 % Cockpit-Bedarf und 25 % Schulungs- und Einstellungskosten (gemeinsames Type Rating,
  ein Ersatzteillager). Ab vier Baureihen gibt es stattdessen Aufschlag, bis +20 %. Unter drei Flugzeugen
  passiert nichts. Anzeige im Flottenabschnitt.
- Tests: 19 (neu: Ziele schalten frei und belohnen genau einmal, Vereinheitlichung mit Bonus und Malus,
  Streckenbewertung warnt vor Überversorgung und bildet die Saison ab).

**v0.18 – Leasing** (vorgezogen aus Paket 6, löst die langsame Amortisation aus v0.17)
- **Flugzeuge leasen statt kaufen** (`sim/lease.js`): Kaution plus Monatsrate statt Kaufpreis, dazu
  Wartungsrücklagen pro Flugstunde an den Leasinggeber. So wachsen echte Airlines – die meisten besitzen
  ihre Flotte gar nicht. Rate ≈ 0,95 % des Marktwerts im Monat, kürzere Laufzeiten sind teurer
  (3/6/12/24 Monate). Geleaste Maschinen zählen nicht zum Unternehmenswert und lassen sich nicht verkaufen.
- **Leasingrahmen**: Wie viel eine Airline leasen darf, hängt am Zahlungsstrom, nicht am Kontostand –
  Grundbetrag plus Vielfaches des Betriebsergebnisses, skaliert mit der Reputation. Der Rahmen wächst mit
  dem Erfolg und schrumpft wieder, wenn das Ergebnis einbricht.
- **Vertragsende**: wird automatisch verlängert (etwas teurer), außer man stellt auf Rückgabe. Rückgabe,
  Verlängerung und Herauskaufen gehen jederzeit im Hangar; überfällige Checks kosten bei der Rückgabe extra,
  vorzeitige Rückgabe kostet Restraten.
- **Sale-and-Leaseback**: eigenes Flugzeug an eine Leasinggesellschaft verkaufen und zurückmieten – bringt
  sofort Kapital.
- **Startkapital von 200 auf 12 Mio $ gesenkt** und `MARKET_FACTOR` zurück auf realistische 0,50.
  Ein Flugzeug zu kaufen ist am Anfang bewusst außer Reichweite; gewachsen wird über Leasing, gekauft wird
  später, wenn Kapital da ist (dann günstiger als Leasing – wie in der Realität).
  Wachstum im Test: 2 Flugzeuge nach 4 Wochen, 5 nach 8, 11 nach 16 Wochen.
- Tests: 16 (neu: Rate, Rahmen, Tagesbuchung, automatische Verlängerung und Rückgabe).

**v0.17 – Airline-Zentrale und Kostenstruktur** (Paket 2 des Fahrplans)
- **Zwei Panele statt Dock und Dropdown**: links „Airline" (Übersicht, Flotte, Personal, Kosten & Erlöse,
  Angebot an Bord, Reputation, Unternehmen, Spielstand), rechts „Betrieb" (Routen, Markt, Wartung, Kerosin,
  Börse & Rangliste, Logbuch) mit Live-Kurzstatus. Abschnitte klappen einzeln auf, die Karte bleibt dazwischen
  frei (`ui/panels.js`, `ui/panels/`). Das untere Dock und das alte Airline-Dropdown entfallen.
- **Personal wird selbst eingestellt** (`sim/staff.js`): Cockpit, Kabine, Boden und Verwaltung haben je einen
  Bedarf, der mit Flotte und angeflogenen Zielen wächst. Gehälter laufen als Tageskosten, pro Flug fallen nur
  noch Spesen an. Unterbesetzung kostet Pünktlichkeit und Reputation, fehlende Verwaltung verteuert Handling
  und Vertrieb. Unter 60 % Besetzung lässt sich kein Flugzeug mehr in Dienst stellen. Techniker laufen weiter
  automatisch mit – sie bekommen mit dem Technikhangar (Paket 5) ein eigenes System.
- **Kostenstruktur** (`sim/finance.js`): Erlöse und Kosten in Blöcken wie in einem Geschäftsbericht
  (Personal, Flugbetrieb, Technik, Vertrieb & Service, Investitionen), umschaltbar auf 1/7/30 Tage, dazu
  Kennzahlen je Flug und je Flugzeug und Tag.
- **Balance überarbeitet**, damit die Kostenanteile denen echter Airlines ähneln:
  Gehälter jetzt 16–18 % statt 9 % der Betriebskosten, Flughafengebühren gesenkt (waren 18 %, real 10–12 %),
  Beifracht von 30 % auf ~10 % des Umsatzes zurückgenommen (Beifracht im Bauch, kein Frachterbetrieb).
  Neu ist ein **degressiver Kilometerertrag** (`CABIN.refFare.taperFrom/taperExp`): Langstrecke bringt pro
  Kilometer weniger als Kurzstrecke – vorher war Langstrecke mit 53 % Marge klar überlegen.
  `MARKET_FACTOR` von 0,55 auf 0,30 gesenkt, damit eine Maschine in rund einem Jahr Echtzeit verdient ist.
  Richtwerte (1 Flugzeug, 28 Tage): A320neo FRA–LHR 34 % Marge, E175 FRA–CDG 20 %, A350 FRA–JFK 41 %.
  Eine überversorgte dünne Strecke bleibt bewusst defizitär.
- Meldungen (Toasts) erscheinen jetzt unten, wo vorher das Dock saß.
- Tests: 15 (neu: gut gewählte Strecke profitabel mit Margenband, Überversorgung drückt die Auslastung,
  Personal blockiert Einsätze und Gehälter laufen als Tageskosten).

**v0.16**
- Flotte auf die 38 Typen umgestellt, für die Seitenansichten vorliegen: Airbus A220–A380, Boeing 717–787,
  Bombardier CRJ, Embraer E-Jets/ERJ, Beechcraft 1900D und Concorde (nur gebraucht). Weggefallene Typen
  (737 MAX, 777-9, A321XLR …) werden in alten Spielständen auf den nächsten Verwandten umgestellt
  (`LEGACY_TYPES` in `data/aircraft.js`, `core/store.js → migrate`). Exklusivverträge gibt es weiter nur mit
  Airbus und Boeing (`CONTRACT_MAKERS`).
- Alle 38 Typen sind abgepaust: `data/profiles.json` kommt aus `tools/trace_profiles.py` (siehe „Flugzeugformen“).
  Die Flugzeuge sind weiterhin ab Werk weiß.
- Lackiererei → **Vorlagen**: 10 Schemata nach gängigen Mustern (Eurowhite, Cheatline, Billboard, farbiger Bauch,
  Heckschwung, Retro-Streifen, Zweiton, Vollton, Metallic, Sonderlackierung) × 10 Farbwelten, mit Airline-Name und
  Kürzel vorbelegt (`art/liveryPresets.js`). Danach beliebig weitermalen. Keine Markenlogos echter Airlines.
- **Datenblatt** je Typ mit Untergruppen (Abmessungen, Gewichte & Tank, Leistung, Antrieb, Kabine & Crew,
  Geschichte, Wirtschaft) im Flugzeugmarkt (neu und gebraucht, aufklappbar) und im Hangar (`ui/datasheet.js`,
  Realdaten im `info`-Block von `data/aircraft.js`).
- **Gebraucht-Zustand** (`USED.cond` in `core/config.js`): Angebote haben einen Zustand 35–98 % aus Alter und
  Stunden. Schlechter Zustand = weniger Reichweite (bis −12 %), Mehrverbrauch (bis +14 %), ungeplante Defekte
  (Reparaturkosten + Standzeit, Logbuch-Eintrag) und niedrigerer Restwert. Anzeige im Markt und Hangar.
- Karte: Flugzeuge am Boden sind **grün** (gelandet am Ziel, Turnaround, am Hub ohne Strecke), in Wartung grau,
  in der Luft gelb; mehrere am selben Flughafen stehen leicht versetzt. Flug-Infokarte zeigt Höhe zusätzlich in m,
  Speed in km/h und die Ankunftszeit.
- Tests: 13 (neu: jeder Typ hat eine Blaupause, Vorlagen zeichnen sauber, Gebraucht-Zustand im Bereich).

**v0.15**
- Die ersten 5 Flugzeuge kommen sofort, danach Lieferzeiten in Echtzeit (`GAME.newDeliveryH`, `orderStaggerH`,
  `usedDeliveryH` in `core/config.js`) mit Countdown im Hangar und Badge im Dock.
- Airline-Menü als großes Dropdown oben links (Klick auf den Airline-Namen); der Airline-Knopf im Dock entfällt.
- Neue Fenster suchen sich den freiesten Platz auf dem Bildschirm (`ui/windows.js → place`).
- Kabine: Slider pro Klasse und ziehbare Klassengrenzen im Kabinenplan (`ui/seatmap.js`). Mehr Business/First nimmt
  Economy Plätze weg und umgekehrt.
- Wetter (`sim/weather.js`): saisonal und nach Klimazone, für alle Spieler identisch. Gewitter, Schnee und Nebel
  verlängern manchmal den Turnaround → Verspätungssymbol auf der Karte, Hinweis in der Flug-Infokarte und im Logbuch.
- Lackiererei: Cockpitfenster sitzen weiter vorn auf der Nase; Texte lassen sich auswählen, verschieben, umfärben,
  in Größe/Inhalt ändern und löschen (Werkzeug „Auswählen“, Taste V).
