# History Shots

Ratespiel: Wann und wo wurde ein historisches Foto aufgenommen?

## Bilderpool
`data/photos.json` enthält nur Verweise auf Wikimedia Commons (Dateiname, Jahr, Koordinaten, Urheber, Lizenz).
Erzeugen/aktualisieren mit:

    python3 data/build_pool.py --max-per-theme 120 --out data/photos.json

Das Script braucht Zugriff auf commons.wikimedia.org und nominatim.openstreetmap.org.

## Globale Highscore-Tabelle (optional, Supabase)
1. Kostenloses Projekt auf supabase.com anlegen.
2. Im SQL-Editor ausführen:

    create table highscores (
      id bigint generated always as identity primary key,
      code text not null check (code ~ '^HS-[A-Z0-9]{3}-[A-Z0-9]{3}$'),
      name text check (char_length(name) <= 20),
      score int not null check (score between 0 and 5000),
      mode text not null check (mode in ('classic','year','theme')),
      theme text,
      created_at timestamptz not null default now()
    );
    alter table highscores enable row level security;
    create policy "read" on highscores for select using (true);
    create policy "insert" on highscores for insert with check (true);

3. In `index.html` bei `const SUPABASE = { url: "", key: "" }` die Projekt-URL und den anon/public Key eintragen.
