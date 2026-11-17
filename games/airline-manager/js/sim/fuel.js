// Kerosinmarkt ohne Server: Der Preis ist eine feste Funktion der Weltzeit.
// Dadurch sehen alle Spieler weltweit im selben Moment denselben Preis – sekündlich neu, mit regelmäßigen
// Hochs und Tiefs (überlagerte Zyklen), Rauschen und gelegentlichen Preisschocks.

import { FUEL } from "../core/config.js";
import { smoothNoise, rand01, clamp } from "../core/util.js";
import { H, DAY } from "../core/config.js";

const TAU = Math.PI * 2;

/** USD pro kg zum Zeitpunkt ts */
export function fuelPrice(ts) {
  const t = ts / H; // Stunden seit 1970
  let m = 1
    + 0.16 * Math.sin(TAU * t / 84 + 0.7)        // ~3,5-Tage-Welle: große Hochs/Tiefs
    + 0.07 * Math.sin(TAU * t / 17 + 2.1)        // Halbtageswelle
    + 0.03 * Math.sin(TAU * t / 2.3)             // kurzer Zyklus
    + 0.05 * smoothNoise("fuel-slow", t / 6)     // langsames Rauschen
    + 0.012 * smoothNoise("fuel-fast", ts / 20_000); // Ticks im 20-s-Raster → sichtbare Sekundenbewegung
  m += shock(ts);
  return FUEL.basePerKg * clamp(m, 0.55, 1.7);
}

/** An ca. jedem 6. Tag gibt es einen Schock (+/−) mit 6 h Dauer. */
function shock(ts) {
  const day = Math.floor(ts / DAY);
  if (rand01("shock", day) > 0.17) return 0;
  const start = rand01("shock-start", day) * 18 * H, dur = 6 * H;
  const x = (ts - day * DAY - start) / dur;
  if (x < 0 || x > 1) return 0;
  const sign = rand01("shock-sign", day) < 0.7 ? 1 : -1;
  return sign * 0.28 * Math.sin(Math.PI * x);
}

/** Verlauf für Diagramme */
export function fuelHistory(now, hours = 48, points = 240) {
  const out = [];
  for (let i = points; i >= 0; i--) { const ts = now - (hours * H * i) / points; out.push([ts, fuelPrice(ts)]); }
  return out;
}

export const depotCapKg = state => FUEL.depot[state.fuel.depot].capT * 1000;

/** Kerosin für einen Flug entnehmen. Fehlmenge wird zum Spotpreis mit Aufschlag gekauft. Gibt Kosten zurück. */
export function consumeFuel(state, kg, ts) {
  const f = state.fuel;
  const fromStock = Math.min(f.stockKg, kg);
  const missing = kg - fromStock;
  f.stockKg -= fromStock;
  return fromStock * f.avgCost + missing * fuelPrice(ts) * (1 + FUEL.spotPremium);
}

/** Kauf ins Tanklager zum aktuellen Preis. Gewichteter Durchschnittspreis für die Kostenrechnung. */
export function buyFuel(state, kg, ts) {
  const f = state.fuel, cap = depotCapKg(state);
  kg = Math.max(0, Math.min(kg, cap - f.stockKg));
  const price = fuelPrice(ts), cost = kg * price;
  if (kg <= 0) return { ok: false, msg: "Tanklager ist voll." };
  if (cost > state.cash) return { ok: false, msg: "Nicht genug Geld." };
  f.avgCost = (f.stockKg * f.avgCost + cost) / (f.stockKg + kg);
  f.stockKg += kg;
  state.cash -= cost;
  return { ok: true, kg, cost, price };
}

export function upgradeDepot(state) {
  const next = FUEL.depot[state.fuel.depot + 1];
  if (!next) return { ok: false, msg: "Höchste Stufe erreicht." };
  if (state.cash < next.price) return { ok: false, msg: "Nicht genug Geld." };
  state.cash -= next.price;
  state.fuel.depot++;
  return { ok: true, cost: next.price };
}

/**
 * Wie günstig der Kerosinpreis gerade im Vergleich zu den letzten zwei Wochen steht. 0..1,
 * wobei 1 das Tief dieser Zeit ist. Damit lässt sich sagen: „Jetzt lohnt sich Eindecken."
 */
export function priceStanding(ts, days = 14) {
  const now = fuelPrice(ts);
  let lo = Infinity, hi = -Infinity;
  for (let h = 0; h <= days * 24; h += 6) {
    const p = fuelPrice(ts - h * H);
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  const span = hi - lo;
  return { price: now, lo, hi, cheap: span > 0 ? 1 - (now - lo) / span : 0.5 };
}
