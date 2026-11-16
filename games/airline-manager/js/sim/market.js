// Flugzeugmarkt: Neubestellungen beim Hersteller (mit Exklusivvertrag-Rabatten) und Gebrauchtmarkt.
// Der Gebrauchtmarkt wird pro Tag aus einem Seed erzeugt – alle Spieler sehen dieselben Angebote, ganz ohne Server.

import { AIRCRAFT, AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { CONTRACT, USED, CHECKS, GAME, DAY, H } from "../core/config.js";
import { rng, dayKey } from "../core/util.js";

/** Marktpreis-Faktor: Airlines zahlen in der Realität deutlich unter Liste. 1 = voller Listenpreis. */
export const MARKET_FACTOR = 0.55;

export const listPrice = type => type.priceM * 1e6;
export const basePrice = type => listPrice(type) * MARKET_FACTOR;

export function contractDiscount(state, type, qty) {
  const c = state.airline.contract;
  if (!c || c.maker !== type.maker) return 0;
  let d = CONTRACT.baseDiscount;
  for (const [n, extra] of CONTRACT.volume) if (qty >= n) d = CONTRACT.baseDiscount + extra;
  return d;
}

/** Darf neu bestellt werden? Exklusivvertrag sperrt Neubestellungen beim anderen Hersteller. */
export function canOrderNew(state, type) {
  if (!type.inProd) return "Nicht mehr in Produktion – nur gebraucht erhältlich.";
  const c = state.airline.contract;
  if (c && c.maker !== type.maker) return `Exklusivvertrag mit ${c.maker}: keine Neubestellungen bei ${type.maker}.`;
  return null;
}

export function newOrderQuote(state, type, qty) {
  const unit = basePrice(type), disc = contractDiscount(state, type, qty);
  return { unit, disc, total: unit * qty * (1 - disc) };
}

/** Restwert: 8 %/Jahr Wertverlust, Abschlag für Verschleiß/überfällige Checks */
export function aircraftValue(ac, ts) {
  const t = AIRCRAFT_BY_ID[ac.typeId];
  const ageY = (ac.ageYears || 0) + (ts - ac.bought) / (365 * DAY);
  const v = basePrice(t) * Math.max(USED.floor, Math.pow(USED.depreciation, ageY));
  const usedPenalty = Math.min(0.3, ac.hours / 200000);
  return v * (1 - usedPenalty) * (1 - USED.cond.valueLoss * condPenalty(ac));
}

/** Gebrauchtangebote des Tages (UTC). Deterministisch → identisch für alle Spieler. */
export function usedListings(ts) {
  const key = dayKey(ts), r = rng("used-" + key), out = [];
  for (let i = 0; i < USED.listings; i++) {
    const t = AIRCRAFT[Math.floor(r() * AIRCRAFT.length)];
    const age = Math.max(1, Math.round(r() * (t.inProd ? 14 : USED.maxAge)));
    const hours = Math.round(age * (2800 + r() * 1800));
    // Checkstand: zufällig verteilt, manche Angebote sind kurz vor einem großen Check (günstiger!)
    const maint = {};
    for (const k of CHECKS.order) {
      const frac = r();
      maint[k] = { fh: Math.round(Math.min(hours, CHECKS[k].fh * frac * 1.05)), daysAgo: Math.round(CHECKS[k].days * frac) };
    }
    const nearHeavy = (CHECKS.C.fh - maint.C.fh) < 800 || (CHECKS.D.fh - maint.D.fh) < 2000;
    // Zustand: je älter und je mehr Stunden, desto schlechter – plus Pflegezustand des Vorbesitzers
    const wear = Math.min(1, age / USED.maxAge * 0.6 + hours / 120000 * 0.4);
    const cond = Math.round(100 * Math.max(USED.cond.min, Math.min(0.98, 1 - wear * 0.55 - r() * 0.2))) / 100;
    const value = basePrice(t) * Math.max(USED.floor, Math.pow(USED.depreciation, age)) * (1 - Math.min(0.3, hours / 200000)) * (1 - USED.cond.valueLoss * (1 - cond));
    const price = Math.round(value * (nearHeavy ? 0.85 : 1) * (0.92 + r() * 0.16) / 1e4) * 1e4;
    out.push({ id: `U-${key}-${i}`, typeId: t.id, age, hours, maint, price, nearHeavy, cond, seller: SELLERS[Math.floor(r() * SELLERS.length)] });
  }
  return out.sort((a, b) => a.price - b.price);
}

/** 0 = wie neu, 1 = schlechtester Zustand. Neu gekaufte Flugzeuge haben cond = null. */
export const condPenalty = ac => ac.cond == null ? 0 : Math.max(0, Math.min(1, 1 - ac.cond));

/** Auswirkungen des Zustands für die Anzeige */
export function condEffects(cond) {
  const p = cond == null ? 0 : Math.max(0, 1 - cond);
  return { range: -USED.cond.rangeLoss * p, fuel: USED.cond.fuelExtra * p, faultPerBlockH: USED.cond.faultPerBlockH * p };
}

const SELLERS = ["Leasinggesellschaft", "Insolvenzmasse", "Flottenerneuerung", "Charter-Airline", "Regierungsflotte", "Broker"];

// --- Flugzeug-Instanzen

const REG_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function nextRegistration(state) {
  const n = state.fleet.length + 1;
  const pre = state.airline.iata.slice(0, 1);
  return `D-${pre}${REG_LETTERS[Math.floor(n / 26) % 26]}${REG_LETTERS[n % 26]}${REG_LETTERS[(n * 7) % 26]}`.slice(0, 6);
}

export function defaultConfig(type) {
  // Langstrecke: Business + Eco, Mittelstrecke: reine Eco mit typischer Bestuhlung
  if (type.size === "narrow") return { f: 0, j: 0, w: 0, y: type.seats };
  const j = Math.round(type.seats * 0.12), w = Math.round(type.seats * 0.08);
  const y = Math.floor(type.seatsMax * 0.88 - j * 3 - w * 1.35);
  return { f: 0, j, w, y: Math.max(0, y) };
}

/** Lieferzeit in ms für das nächste Flugzeug (die ersten GAME.instantDeliveries kommen sofort). */
export function deliveryDelay(state, type, { used = false, orderIndex = 0 } = {}) {
  if ((state.ordered || 0) < GAME.instantDeliveries) return 0;
  return ((used ? GAME.usedDeliveryH : GAME.newDeliveryH[type.size]) + (used ? 0 : orderIndex * GAME.orderStaggerH)) * H;
}

export function createAircraft(state, type, ts, { used = null, orderIndex = 0 } = {}) {
  const delay = deliveryDelay(state, type, { used: !!used, orderIndex });
  state.ordered = (state.ordered || 0) + 1;
  const maint = {};
  for (const k of CHECKS.order) {
    maint[k] = used ? { fh: used.maint[k].fh, at: ts - used.maint[k].daysAgo * DAY } : { fh: 0, at: ts };
  }
  return {
    id: "ac_" + ts.toString(36) + Math.random().toString(36).slice(2, 6),
    typeId: type.id,
    reg: nextRegistration(state),
    name: "",
    bought: ts,
    ageYears: used ? used.age : 0,
    cond: used ? used.cond ?? 0.8 : null,     // Zustand gebrauchter Maschinen (sim/market.js → condEffects)
    hours: used ? used.hours : 0,
    cycles: used ? Math.round(used.hours / 2.2) : 0,
    maint,
    cfg: defaultConfig(type),
    aux: 0,
    autoCheck: true,
    scheduledCheck: null,
    status: delay ? "delivery" : "idle",
    availableAt: delay ? ts + delay : null,
    ops: null,
    check: null
  };
}
