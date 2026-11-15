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
│  │  ├─ aircraft.js       30 Typen Airbus/Boeing mit einheitlichen Werten
│  │  └─ airports.js       137 Flughäfen: IATA/ICAO, Koordinaten, Bahnlänge, Nachfrage-Faktoren
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
│     ├─ aircraftArt.js    einheitliche Flugzeuggrafiken aus echten Maßen (Livery-fähig)
│     └─ apps/             hangar, shop, routes, maint, fuel, airline, stocks, leaderboard, logbook
├─ lib/                    MapLibre GL (Kopie aus history-shots)
├─ tools/dxf_to_svg.py     Herstellerzeichnungen (DXF) → SVG
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
2. Im SQL-Editor ausführen:

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
  insert into airlines (code, name, iata, hub, share_price, value, rep, fleet, profit_30d, livery, updated_at)
  values (p_code, left(p_data->>'name', 28), left(p_data->>'iata', 3), p_data->>'hub',
          least((p_data->>'share_price')::numeric, 1e6), (p_data->>'value')::numeric, (p_data->>'rep')::numeric,
          (p_data->>'fleet')::int, (p_data->>'profit_30d')::numeric, p_data->'livery', now())
  on conflict (code) do update set name = excluded.name, iata = excluded.iata, hub = excluded.hub,
    share_price = excluded.share_price, value = excluded.value, rep = excluded.rep, fleet = excluded.fleet,
    profit_30d = excluded.profit_30d, livery = excluded.livery, updated_at = now();
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

## Flugzeugbilder von Airbus und Boeing

Die Herstellerseiten liefern CAD-Dateien, keine fertigen Bilder:

- Airbus: AutoCAD 3-View Drawings + Aircraft Characteristics (PDF, Maße und Leistungsdaten)
  https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/autocad-3-view-aircraft-drawings
- Boeing: 3-View (ZIP mit .dwg/.dxf, z. B. `…/airports/dwgs/7878.zip`) https://www.boeing.com/commercial/airports/3-view

Das Spiel zeichnet deshalb **jedes Modell aus seinen echten Maßen** (`ui/aircraftArt.js`: Länge, Spannweite,
Rumpfhöhe, Triebwerksanzahl, Doppeldeck, 747-Buckel …). Alle Typen haben dieselben Livery-Flächen
(Rumpf, Bauch, Zierlinie, Leitwerk, Logo, Triebwerke) und denselben Maßstab – eine Livery passt auf alles.

Echte Umrisse übernehmen:

```bash
python3 tools/dxf_to_svg.py 7878.dxf --info                         # Layer + Ausdehnung
python3 tools/dxf_to_svg.py 7878.dxf -o 787-8-side.svg --bbox …     # nur die Seitenansicht
```

**Rechtliches vorher klären:** Boeing vermerkt „Copyright © Boeing. All Rights Reserved“ und nennt als Zweck
Gate-Planung; Airbus verweist auf eigene Nutzungsbedingungen. Ob abgeleitete Grafiken öffentlich in einem Spiel
gezeigt werden dürfen, ist damit nicht geklärt. Im Zweifel bei airport.compatibility@airbus.com bzw. Boeing nachfragen
oder bei den eigenen, parametrischen Grafiken bleiben.

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

## Was als Nächstes kommt (Vorschläge)

- Eigenes Bestätigungs-Popup statt `confirm()`
- Englische Übersetzung (die Seite ist zweisprachig) – Texte liegen noch direkt in den Apps
- Frachtflugzeuge (777F, 747-8F, A350F) und reine Frachtstrecken
- Kredite, Leasing statt Kauf, Kapitalerhöhung über eigene Aktien
- Konkurrenz auf Strecken: Nachfrage teilen, wenn andere Spieler dieselbe Strecke fliegen (braucht Backend)
- Slots an Tier-5-Flughäfen, Nachtflugverbote
- Ereignisse (Streik, Vulkanasche, Messen mit Nachfragespitzen)
