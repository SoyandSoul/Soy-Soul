// Börse: Jede Spieler-Airline ist gelistet. Der Kurs ergibt sich aus dem Unternehmenswert
// (Kasse + Flottenwert + Treibstoffvorrat + Beteiligungen + Gewinn-Multiple) pro Aktie, gewichtet mit der Reputation.
// Ohne Server veröffentlicht jeder Spieler seinen eigenen Kurs (net/backend.js); andere sehen ihn in der Börsenliste.

import { STOCKS, DAY } from "../core/config.js";
import { aircraftValue } from "./market.js";
import { summary, book } from "./ledger.js";
import { smoothNoise } from "../core/util.js";

export function companyValue(state, now, marketPrices = {}) {
  // Geleaste Maschinen gehören dem Leasinggeber und zählen nicht zum Vermögen.
  const fleet = state.fleet.filter(a => a.status !== "crashed" && !a.lease).reduce((s, a) => s + aircraftValue(a, now), 0);
  const fuel = state.fuel.stockKg * state.fuel.avgCost;
  const holdings = Object.entries(state.stocks.holdings).reduce((s, [code, h]) => s + h.qty * (marketPrices[code] ?? h.cost / h.qty), 0);
  const profit30 = summary(state, 30, now).profit;
  const goodwill = Math.max(0, profit30 * 12) * STOCKS.profitMultiple;
  return { cash: state.cash, fleet, fuel, holdings, goodwill, total: state.cash + fleet + fuel + holdings + goodwill };
}

export function sharePrice(state, now, marketPrices) {
  const v = companyValue(state, now, marketPrices).total;
  const repF = 1 - STOCKS.repWeight / 2 + STOCKS.repWeight * state.airline.rep / 100;
  // kleine, deterministische Tagesschwankung, damit der Chart lebt
  const wobble = 1 + 0.01 * smoothNoise("own-" + state.player.code, now / (2 * 3600_000));
  return Math.max(STOCKS.minPrice, v / state.airline.shares * repF * wobble);
}

/** Wie viele Aktien einer fremden Airline man höchstens halten darf (Sperrminorität bleibt dort). */
export function maxShares(listing) {
  return Math.floor((listing.shares || STOCKS.defaultShares) * STOCKS.maxStake);
}

/** Anteil, den man an einer Airline hält – 0..1 */
export function stakeIn(state, listing) {
  const h = state.stocks.holdings[listing.code];
  return h ? h.qty / (listing.shares || STOCKS.defaultShares) : 0;
}

export function buyShares(state, listing, qty, now) {
  const cost = qty * listing.price * (1 + STOCKS.fee);
  if (qty <= 0) return { ok: false, msg: "Menge ungültig." };
  if (listing.code === state.player.code) return { ok: false, msg: "Eigene Aktien können nicht gekauft werden." };
  const have = state.stocks.holdings[listing.code]?.qty || 0;
  const max = maxShares(listing);
  if (have + qty > max)
    return { ok: false, msg: `Höchstens ${Math.round(STOCKS.maxStake * 100)} % einer fremden Airline – das sind ${max.toLocaleString("de-DE")} Aktien. Ihr haltet schon ${have.toLocaleString("de-DE")}.` };
  if (cost > state.cash) return { ok: false, msg: "Nicht genug Geld." };
  const h = (state.stocks.holdings[listing.code] ||= { qty: 0, cost: 0, name: listing.name });
  h.qty += qty; h.cost += cost; h.name = listing.name;
  book(state, now, "cost", "stocks", cost);
  return { ok: true, cost };
}

export function sellShares(state, listing, qty, now) {
  const h = state.stocks.holdings[listing.code];
  if (!h || qty <= 0 || qty > h.qty) return { ok: false, msg: "So viele Aktien hast du nicht." };
  const gain = qty * listing.price * (1 - STOCKS.fee);
  h.cost *= (h.qty - qty) / h.qty; h.qty -= qty;
  if (!h.qty) delete state.stocks.holdings[listing.code];
  book(state, now, "rev", "stocks", gain);
  return { ok: true, gain };
}

// --- Demo-Börse, solange kein Backend eingerichtet ist (klar als "Demo" markiert)

const BOTS = [
  ["DM-SKY-001", "Skyline Atlantic", "SA", "LHR"], ["DM-SKY-002", "Nordwind Air", "NW", "HAM"], ["DM-SKY-003", "Pacific Crest", "PC", "SFO"],
  ["DM-SKY-004", "Sahara Jet", "SJ", "CMN"], ["DM-SKY-005", "Lotus Airways", "LO", "BKK"], ["DM-SKY-006", "Andes Air", "AN", "LIM"],
  ["DM-SKY-007", "Fjord Wings", "FW", "OSL"], ["DM-SKY-008", "Coral Air", "CA", "MLE"], ["DM-SKY-009", "Alpenflug", "AF", "ZRH"],
  ["DM-SKY-010", "Harbour Express", "HX", "HKG"]
];

export function demoMarket(now) {
  return BOTS.map(([code, name, iata, hub], i) => {
    const base = 8 + i * 3.1;
    const price = base * (1 + 0.25 * smoothNoise(code, now / DAY) + 0.06 * smoothNoise(code + "f", now / 3600_000));
    const fleet = 3 + (i * 7) % 40, rep = 40 + (i * 13) % 50;
    // Kurzprofil wie bei echten Airlines, damit Bewertung und Detailansicht auch im Demo-Modus etwas zeigen
    const profile = {
      fleet, rep, staff: fleet * 68 + (i * 37) % 200, destinations: Math.max(2, Math.round(fleet * 0.8)),
      pax: fleet * 42_000 + i * 15_000, legs: fleet * 900 + i * 300,
      margin: 0.06 + ((i * 7) % 18) / 100, profit30: fleet * 180_000,
      profitPerAircraftDay: 20_000 + ((i * 11) % 45) * 1000,
      types: ["a320neo", "b738", "a359"].slice(0, 1 + i % 3),
      routes: []
    };
    return { code, name, iata, hub, price: Math.max(0.5, price), fleet, rep, profile, demo: true, updated: now };
  });
}
