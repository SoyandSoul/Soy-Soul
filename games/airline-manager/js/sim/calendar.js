// Kalender: Feiertage, Ferien und große Ereignisse.
//
// Alles rein aus dem Datum gerechnet, nichts gespeichert – damit sehen alle Spieler dieselben
// Termine, und ein Blick in die Zukunft ist möglich, ohne irgendetwas vorzubereiten.
//
// Wirkung: ein Nachfragefaktor auf Strecken, die ein betroffenes Land berühren, getrennt nach
// Geschäftsreise und Urlaub. Weihnachten füllt die Ferienflieger und leert die Businessklasse –
// genau das passiert in der Realität auch.

import { CALENDAR } from "../core/config.js";

const DAYMS = 86400000;
const utc = (y, m, d) => Date.UTC(y, m - 1, d);
const dayOf = ts => Math.floor(ts / DAYMS);

/** Ostersonntag (gregorianisch, Anonyme Gaußsche Osterformel). */
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** n-ter Wochentag eines Monats, z. B. der vierte Donnerstag im November. */
function nth(year, month, weekday, n) {
  const first = new Date(utc(year, month, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return utc(year, month, day);
}

/** Alle Termine eines Jahres als { id, label, from, to, countries, biz, leisure, note }. */
export function eventsOfYear(year) {
  const E = easter(year);
  const out = [
    { id: "christmas", label: "Weihnachten", from: utc(year, 12, 18), to: utc(year, 12, 26),
      countries: null, biz: 0.5, leisure: 1.5, note: "Heimflüge und Familienbesuche, die Businessklasse bleibt leer." },
    { id: "newyear", label: "Jahreswechsel", from: utc(year, 12, 27), to: utc(year + 1, 1, 3),
      countries: null, biz: 0.55, leisure: 1.45, note: "Alles fliegt nach Hause oder in den Schnee, kaum jemand zu einem Termin." },
    { id: "easter", label: "Ostern", from: E - 9 * DAYMS, to: E + 2 * DAYMS,
      countries: ["DE", "AT", "CH", "NL", "BE", "FR", "GB", "IE", "ES", "IT", "PT", "PL", "CZ", "DK", "SE", "NO", "FI", "US", "BR"],
      biz: 0.75, leisure: 1.35, note: "Erste große Ferienwelle des Jahres." },
    { id: "whitsun", label: "Pfingsten", from: E + 47 * DAYMS, to: E + 52 * DAYMS,
      countries: ["DE", "AT", "CH", "NL", "BE", "FR", "DK", "SE", "NO"],
      biz: 0.8, leisure: 1.25, note: "Langes Wochenende, viele Kurztrips." },
    { id: "summer", label: "Sommerferien", from: utc(year, 7, 10), to: utc(year, 8, 31),
      countries: null, biz: 0.78, leisure: 1.3, note: "Hauptreisezeit – volle Ferienflieger, leere Businessklasse." },
    { id: "autumn", label: "Herbstferien", from: utc(year, 10, 12), to: utc(year, 10, 26),
      countries: ["DE", "AT", "CH", "NL", "GB", "DK", "SE"], biz: 0.92, leisure: 1.2, note: "Kurze Ferienwoche, beliebt für Flüge in die Sonne." },
    { id: "thanksgiving", label: "Thanksgiving", from: nth(year, 11, 4, 4) - 2 * DAYMS, to: nth(year, 11, 4, 4) + 3 * DAYMS,
      countries: ["US", "CA"], biz: 0.6, leisure: 1.5, note: "Das stärkste Reisewochenende Nordamerikas." },
    { id: "july4", label: "Independence Day", from: utc(year, 7, 2), to: utc(year, 7, 6),
      countries: ["US"], biz: 0.7, leisure: 1.3, note: "Langes Wochenende in den USA." },
    { id: "oktoberfest", label: "Oktoberfest", from: utc(year, 9, 16), to: utc(year, 10, 5),
      countries: ["DE"], biz: 1.05, leisure: 1.22, note: "München ist drei Wochen lang ausgebucht." },
    { id: "carnival", label: "Karneval in Rio", from: E - 50 * DAYMS, to: E - 44 * DAYMS,
      countries: ["BR"], biz: 0.9, leisure: 1.4, note: "Brasilien feiert, alle wollen hin." },
    { id: "lunar", label: "Neujahrsfest", from: lunarNewYear(year) - 6 * DAYMS, to: lunarNewYear(year) + 8 * DAYMS,
      countries: ["CN", "HK", "SG", "TW", "VN", "KR"], biz: 0.7, leisure: 1.45, note: "Die größte Reisewelle der Welt." },
    { id: "ramadanEnd", label: "Zuckerfest", from: ramadanEnd(year) - 3 * DAYMS, to: ramadanEnd(year) + 4 * DAYMS,
      countries: ["AE", "QA", "SA", "TR", "EG", "MA", "ID", "MY"], biz: 0.8, leisure: 1.35, note: "Familienbesuche über den ganzen Nahen Osten." }
  ];
  return out;
}

/** Grobe Näherung für das chinesische Neujahr (reicht für ein Spiel: ±2 Tage). */
function lunarNewYear(year) {
  const table = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23], 2032: [2, 11] };
  const t = table[year] || [2, 5];
  return utc(year, t[0], t[1]);
}

/** Grobe Näherung für das Ende des Ramadan (wandert jährlich rund elf Tage nach vorn). */
function ramadanEnd(year) {
  const base = utc(2026, 3, 20);                    // Eid al-Fitr 2026
  return base - (year - 2026) * 10.875 * DAYMS;
}

const cache = new Map();
function yearEvents(year) {
  if (!cache.has(year)) cache.set(year, eventsOfYear(year));
  return cache.get(year);
}

/** Welche Termine laufen gerade? */
export function eventsAt(ts) {
  const y = new Date(ts).getUTCFullYear();
  const list = [...yearEvents(y - 1), ...yearEvents(y), ...yearEvents(y + 1)];
  return list.filter(e => ts >= e.from && ts <= e.to);
}

/** Die nächsten Termine ab jetzt – für den Kalender im Spiel. */
export function upcoming(ts, days = 120, countries = null) {
  const y = new Date(ts).getUTCFullYear();
  const list = [...yearEvents(y), ...yearEvents(y + 1)];
  return list
    .filter(e => e.to >= ts && e.from <= ts + days * DAYMS)
    .filter(e => !countries || !e.countries || e.countries.some(c => countries.includes(c)))
    .sort((a, b) => a.from - b.from);
}

/**
 * Nachfragefaktor für eine Strecke: getrennt für Geschäftsreise und Urlaub.
 * Ein Termin zählt, wenn er eines der beiden Länder betrifft (oder weltweit gilt).
 */
export function demandFactor(ts, fromCountry, toCountry) {
  let biz = 1, leisure = 1;
  for (const e of eventsAt(ts)) {
    if (e.countries && !e.countries.includes(fromCountry) && !e.countries.includes(toCountry)) continue;
    // Mehrere Termine gleichzeitig verstärken sich gedämpft, sonst wird Weihnachten absurd
    biz *= 1 + (e.biz - 1) * CALENDAR.weight;
    leisure *= 1 + (e.leisure - 1) * CALENDAR.weight;
  }
  return { biz, leisure };
}
