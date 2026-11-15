// Flugphysik light: Blockzeiten, Reichweite, Bahnlänge, Position eines Flugzeugs zu einem Zeitpunkt.

import { FLIGHT, CABIN, H } from "../core/config.js";
import { AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";
import { distanceKm, interpolate, bearing } from "./geo.js";

export const typeOf = ac => AIRCRAFT_BY_ID[ac.typeId];

export function routeDistance(route) {
  return route._km ??= Math.round(distanceKm(AIRPORT_BY_IATA[route.from], AIRPORT_BY_IATA[route.to]));
}

/** Blockzeit in Stunden (Off-Block bis On-Block) */
export function blockHours(km, type) {
  return FLIGHT.fixedH + (km * FLIGHT.routingFactor) / type.cruiseKmh;
}

export const turnaroundH = type => FLIGHT.turnaroundMin[type.size] / 60;

export function effectiveRange(ac) {
  return typeOf(ac).rangeKm * (1 + FLIGHT.aux.rangeBonus * (ac.aux || 0));
}

export function seatUnits(cfg) {
  return CABIN.classes.reduce((s, c) => s + (cfg[c] || 0) * CABIN.units[c], 0);
}
export const totalSeats = cfg => CABIN.classes.reduce((s, c) => s + (cfg[c] || 0), 0);

/** Verfügbare Nutzlast für Fracht nach Passagieren; auf langen Strecken frisst Treibstoff Nutzlast. */
export function cargoCapacityKg(ac, km, pax) {
  const t = typeOf(ac);
  const rangeUse = km / effectiveRange(ac);
  const fuelPenalty = Math.max(0, (rangeUse - 0.7) / 0.3) * 0.5; // ab 70 % Reichweite sinkt die Nutzlast bis -50 %
  const payload = t.payloadKg * (1 - fuelPenalty) - FLIGHT.aux.payloadCostKg * (ac.aux || 0);
  return Math.max(0, payload - pax * FLIGHT.paxWeightKg);
}

/** Prüft, ob ein Flugzeug eine Strecke fliegen darf. Gibt eine Liste von Gründen zurück (leer = ok). */
export function routeProblems(ac, route) {
  const t = typeOf(ac), a = AIRPORT_BY_IATA[route.from], b = AIRPORT_BY_IATA[route.to];
  const km = routeDistance(route), out = [];
  if (km > effectiveRange(ac)) out.push(`Reichweite zu gering (${Math.round(effectiveRange(ac))} km < ${km} km)`);
  for (const ap of [a, b]) if (ap.runwayM < t.runwayM) out.push(`Bahn in ${ap.iata} zu kurz (${ap.runwayM} m, benötigt ${t.runwayM} m)`);
  return out;
}

/**
 * Wo ist das Flugzeug jetzt? Rein aus Abflugzeit + Blockzeit berechnet, ohne gespeicherte Positionen.
 * ops = { routeId, dir, dep }  dir 0: from→to, 1: to→from; dep = Abflugzeit des aktuellen/nächsten Legs
 */
export function positionAt(ac, route, ts) {
  const t = typeOf(ac);
  const [o, d] = legEnds(route, ac.ops.dir);
  const block = blockHours(routeDistance(route), t) * H;
  const f = (ts - ac.ops.dep) / block;
  if (f < 0) return { phase: "ground", at: o, lat: o.lat, lon: o.lon, heading: bearing(o, d), progress: 0, eta: ac.ops.dep + block, from: o, to: d };
  if (f >= 1) return { phase: "ground", at: d, lat: d.lat, lon: d.lon, heading: 0, progress: 1, eta: ac.ops.dep + block, from: o, to: d };
  const p = interpolate(o, d, f), ahead = interpolate(o, d, Math.min(1, f + 0.002));
  return { phase: "air", lat: p.lat, lon: p.lon, heading: bearing(p, ahead), progress: f, eta: ac.ops.dep + block, from: o, to: d, ...profile(f, block / H, t) };
}

export function legEnds(route, dir) {
  const a = AIRPORT_BY_IATA[route.from], b = AIRPORT_BY_IATA[route.to];
  return dir === 0 ? [a, b] : [b, a];
}

/** Vereinfachtes Flugprofil für die Anzeige im Flightradar-Stil: Höhe (ft) und Grundgeschwindigkeit (kt). */
function profile(f, blockH, type) {
  const climb = Math.min(0.35, 0.33 / blockH), descent = Math.min(0.35, 0.5 / blockH);
  const cruiseFt = blockH > 4 ? 39000 : blockH > 1.5 ? 37000 : 28000;
  const cruiseKt = Math.round(type.cruiseKmh / 1.852);
  let alt, spd;
  if (f < climb) { const k = f / climb; alt = cruiseFt * Math.sin(k * Math.PI / 2); spd = 160 + (cruiseKt - 160) * k; }
  else if (f > 1 - descent) { const k = (1 - f) / descent; alt = cruiseFt * Math.sin(k * Math.PI / 2); spd = 140 + (cruiseKt - 140) * k; }
  else { alt = cruiseFt; spd = cruiseKt; }
  return { altFt: Math.round(alt / 100) * 100, speedKt: Math.round(spd) };
}
