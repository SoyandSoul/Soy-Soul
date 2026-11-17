// Leasing. Statt ein Flugzeug zu kaufen, mietet man es bei einer Leasinggesellschaft:
// Kaution plus Monatsrate, dazu Wartungsrücklagen pro Flugstunde. Das Flugzeug bindet kein Kapital,
// gehört aber nicht der Airline – es kann nicht verkauft werden und muss am Ende zurück.
//
// Wie viel eine Airline leasen darf, hängt am Zahlungsstrom (Leasingrahmen), nicht am Kontostand –
// so machen es echte Leasinggeber auch.

import { LEASE, DAY, H, CHECKS } from "../core/config.js";
import { AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { aircraftValue, basePrice } from "./market.js";
import { summary } from "./ledger.js";
import { checkStatus } from "./maintenance.js";

export const LESSORS = ["Aviation Capital", "Skyfleet Leasing", "Nordic Aircraft Partners", "Meridian Lease", "Blue Harbour Aviation"];

export const isLeased = ac => !!ac?.lease;
export const termOf = months => LEASE.terms.find(t => t.months === months) || LEASE.terms.find(t => t.months === LEASE.defaultTerm);

/** Monatsrate für ein Flugzeug. Grundlage ist der Marktwert, nicht der Listenpreis. */
export function monthlyRate(type, { months = LEASE.defaultTerm, value = null, factor = 1 } = {}) {
  const v = value ?? basePrice(type);
  return v * LEASE.ratePerMonth * termOf(months).factor * factor;
}

/** Angebot für ein konkretes Flugzeug (neu vom Hersteller oder aus einem Gebrauchtangebot). */
export function leaseQuote(state, type, { months = LEASE.defaultTerm, used = null } = {}) {
  const value = used ? used.price / 0.95 : basePrice(type);   // Gebrauchtpreise sind schon marktnah
  const rate = monthlyRate(type, { months, value });
  return {
    months, value, rate,
    deposit: rate * LEASE.depositMonths,
    reservePerFH: LEASE.reservePerFH[type.size],
    upfront: rate * (LEASE.depositMonths + 1),                // Kaution + erste Monatsrate
    perDay: rate / LEASE.monthDays
  };
}

/** Summe aller laufenden Monatsraten. */
export function monthlyObligation(state) {
  return state.fleet.reduce((s, a) => s + (isLeased(a) && a.status !== "crashed" ? a.lease.rate : 0), 0);
}

/**
 * Leasingrahmen: wie viel Monatsrate der Markt dieser Airline zutraut.
 * Basis plus ein Vielfaches des monatlichen Betriebsergebnisses, skaliert mit der Reputation.
 */
export function leaseFrame(state, now) {
  const f = LEASE.frame;
  const monthlyProfit = Math.max(0, summary(state, 30, now).profit);
  const rep = f.repLow + f.repSpan * state.airline.rep / 100;
  // Erreichte Ziele heben den Rahmen dauerhaft (sim/goals.js)
  const max = (f.base + monthlyProfit * f.profitMultiple) * rep + (state.airline.frameBonus || 0);
  const used = monthlyObligation(state);
  return { max, used, free: Math.max(0, max - used), rep, monthlyProfit };
}

/** Passt ein weiteres Flugzeug in den Rahmen? Gibt null zurück, wenn ja, sonst den Grund. */
export function frameBlock(state, now, rate) {
  const fr = leaseFrame(state, now);
  if (rate <= fr.free) return null;
  return `Leasingrahmen zu klein: frei sind ${Math.round(fr.free / 1000)} k$ im Monat, nötig wären ${Math.round(rate / 1000)} k$. Der Rahmen wächst mit Betriebsergebnis und Reputation.`;
}

/** Vertragsdaten für ein neu geleastes Flugzeug. */
export function makeContract(state, type, ts, quote, lessorSeed = 0) {
  return {
    lessor: LESSORS[Math.abs(lessorSeed + state.fleet.length) % LESSORS.length],
    since: ts,
    until: ts + quote.months * LEASE.monthDays * DAY,
    months: quote.months,
    rate: quote.rate,
    deposit: quote.deposit,
    reservePerFH: quote.reservePerFH,
    returnAtEnd: false,                 // sonst wird am Ende automatisch verlängert
    extensions: 0
  };
}

/** Wartungsrücklage für einen Flug (geht an den Leasinggeber, zusätzlich zur eigenen Wartungsreserve). */
export const reserveForLeg = (ac, blockH) => isLeased(ac) ? ac.lease.reservePerFH * Math.max(0, blockH - 0.3) : 0;

/** Überfällige Flugstunden bei der Rückgabe – dafür verlangt der Leasinggeber Geld. */
export function returnPenalty(ac, ts) {
  if (!isLeased(ac)) return 0;
  const st = checkStatus(ac, ts);
  let overdue = 0;
  for (const k of CHECKS.order) if (st[k].rem < 0) overdue += -st[k].rem;
  return Math.round(overdue * LEASE.returnPenaltyPerFH);
}

/** Abrechnung einer Rückgabe: Kaution zurück, abzüglich Strafen und – bei vorzeitiger Rückgabe – Restraten. */
export function returnSettlement(ac, ts) {
  const l = ac.lease;
  const early = Math.max(0, l.until - ts);
  const earlyMonths = Math.min(LEASE.earlyReturnMonths, early / (LEASE.monthDays * DAY));
  const earlyFee = Math.round(earlyMonths * l.rate);
  const penalty = returnPenalty(ac, ts);
  const refund = Math.max(0, l.deposit - penalty - earlyFee);
  const due = Math.max(0, penalty + earlyFee - l.deposit);
  return { earlyMonths, earlyFee, penalty, refund, due, isEarly: early > 0 };
}

/** Preis, um ein geleastes Flugzeug zu übernehmen. */
export const buyoutPrice = (ac, ts) => Math.round(aircraftValue(ac, ts) * LEASE.buyoutFactor);

/** Tagesrate aller Leasingverträge – wird in sim/engine.js zeitanteilig gebucht. */
export const rentPerDay = state => monthlyObligation(state) / LEASE.monthDays;
