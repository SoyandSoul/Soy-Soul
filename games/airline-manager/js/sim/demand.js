// Nachfrage-Modell.
// Zwei Ströme pro Strecke:
//   Geschäftsreise – Größe beider Städte × Geschäftsanteil, über das Jahr konstant, unter der Woche stärker.
//   Urlaub         – Einwohner der einen Seite × Tourismuswert der anderen, mit Saison der Herkunfts-Hemisphäre.
// Große Städte und Drehkreuze haben dadurch automatisch mehr Nachfrage; Ferienziele boomen im Sommer.

import { DEMAND, CABIN, GAME, REPUTATION } from "../core/config.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";
import { clamp, rand01 } from "../core/util.js";
import { routeDistance } from "./flight.js";

const TAU = Math.PI * 2;

function dayOfYear(ts) {
  const d = new Date(ts), start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return (ts - start) / 86400000;
}

/** Saisonfaktor für Urlaubsreisende aus einem Ort mit Breite lat. ~0,5 (Nebensaison) bis ~1,65 (Hochsommer + Feiertage) */
export function seasonFactor(ts, lat) {
  const doy = dayOfYear(ts);
  const peak = lat >= 0 ? 196 : 15;                 // Mitte Juli bzw. Mitte Januar
  let s = 1 + DEMAND.seasonAmp * Math.cos(TAU * (doy - peak) / 365);
  if (doy > 352 || doy < 6) s += DEMAND.xmasBoost;  // Weihnachten/Neujahr
  return s;
}

/** Distanzfaktor: Kurzstrecke konkurriert mit Bahn/Auto, Ultra-Langstrecke ist dünner. */
function distanceFactor(km) {
  return km < 400 ? Math.pow(km / 400, 0.7) : Math.exp(-(km - 400) / 12000);
}

/** Tägliche Passagiere einer Richtung (Gesamtmarkt, alle Klassen) */
export function dailyMarket(fromIata, toIata, ts, km) {
  const a = AIRPORT_BY_IATA[fromIata], b = AIRPORT_BY_IATA[toIata];
  const bizAvg = (a.biz + b.biz) / 2;
  const wd = DEMAND.weekday[new Date(ts).getUTCDay()];
  const business = Math.sqrt(a.pop * b.pop) * (0.3 + bizAvg) * wd;
  const leisure = DEMAND.tourismWeight * Math.sqrt(a.pop * b.tour * seasonFactor(ts, a.lat) + b.pop * a.tour * seasonFactor(ts, b.lat));
  return { total: DEMAND.k * distanceFactor(km) * (business + leisure), bizAvg, business, leisure };
}

/** Aufteilung auf Klassen. First lohnt sich nur auf Langstrecke. */
export function classSplit(bizAvg, km) {
  const long = km > 3000 ? 1 : 0.3;
  const f = (0.01 + 0.04 * bizAvg) * long, j = (0.05 + 0.25 * bizAvg) * (km > 1500 ? 1 : 0.6), w = 0.08;
  return { f, j, w, y: Math.max(0.4, 1 - f - j - w) };
}

/**
 * Referenzpreis einer Klasse. Der Ertrag je Kilometer sinkt mit der Entfernung (wie in der Realität):
 * eine Stunde Kurzstrecke bringt deutlich mehr pro Kilometer als eine Stunde über dem Atlantik.
 */
export function refFare(km, cls) {
  const r = CABIN.refFare;
  const taper = Math.pow(Math.min(1, r.taperFrom / Math.max(1, km)), r.taperExp);
  return (r.base + r.perKm * km * taper) * r.mul[cls];
}

export const repDemandFactor = rep => REPUTATION.demandMin + REPUTATION.demandSpan * rep / 100;

/** Ist gerade Hoch- oder Nebensaison auf dieser Strecke? (für saisonale Preisregeln) */
export function seasonOf(route, ts) {
  const a = AIRPORT_BY_IATA[route.from], b = AIRPORT_BY_IATA[route.to];
  const tour = Math.max(a.tour, b.tour);
  const s = (seasonFactor(ts, a.lat) + seasonFactor(ts, b.lat)) / 2;
  if (tour < 0.5) return "normal";
  return s > 1.25 ? "peak" : s < 0.75 ? "off" : "normal";
}

/** Effektiver Ticketpreis inkl. Saisonregel bzw. automatischer Preissteuerung. */
export function effectivePrice(route, cls, ts) {
  const base = route.prices[cls];
  const season = seasonOf(route, ts);
  const adj = season === "peak" ? route.seasonal.peak : season === "off" ? -route.seasonal.off : 0;
  return base * (1 + adj / 100);
}

/**
 * Gebuchte Passagiere für EINEN Flug.
 * flightsPerDay = wie oft die eigene Airline diese Richtung täglich fliegt (Nachfrage wird geteilt).
 */
export function bookings({ route, dir, cfg, ts, rep, flightsPerDay, legKey }) {
  const km = routeDistance(route);
  const [from, to] = dir === 0 ? [route.from, route.to] : [route.to, route.from];
  const m = dailyMarket(from, to, ts, km);
  const split = classSplit(m.bizAvg, km);
  const noise = 1 + DEMAND.noise * (rand01("demand", legKey) * 2 - 1);
  const repF = repDemandFactor(rep);
  const out = {}, prices = {};
  for (const c of CABIN.classes) {
    const seats = cfg[c] || 0;
    const price = effectivePrice(route, c, ts);
    prices[c] = price;
    if (!seats) { out[c] = 0; continue; }
    const priceF = Math.pow(refFare(km, c) / Math.max(1, price), CABIN.elasticity[c]);
    // Unbesetzte Premium-Nachfrage rutscht teilweise eine Klasse tiefer – vereinfacht über "spill" ignoriert.
    const demand = m.total * split[c] * GAME.marketShare / Math.max(1, flightsPerDay) * priceF * repF * noise;
    out[c] = clamp(Math.round(demand), 0, seats);
  }
  return { pax: out, prices, market: m, km };
}

/** Vorschau für die Routenplanung: Tagesnachfrage pro Klasse für den eigenen Marktanteil */
export function demandPreview(from, to, ts, km) {
  const m = dailyMarket(from, to, ts, km), split = classSplit(m.bizAvg, km);
  const res = {};
  for (const c of CABIN.classes) res[c] = Math.round(m.total * split[c] * GAME.marketShare);
  return res;
}
