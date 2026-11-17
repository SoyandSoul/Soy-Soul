// Gewinn- und Verlustrechnung für die Anzeige: fasst die Tagesbuchungen aus sim/ledger.js zu Blöcken
// zusammen, wie sie ein Airline-Geschäftsbericht hat, und rechnet Kennzahlen je Flug und je Flugzeug aus.
//
// Die Buchhaltung selbst bleibt in ledger.js – hier wird nur gruppiert und ausgewertet.

import { dayKey } from "../core/util.js";
import { DAY } from "../core/config.js";
import { salaryPerDay } from "./staff.js";

/** Erlösblöcke. Reihenfolge = Anzeigereihenfolge. */
export const REV_BLOCKS = [
  { id: "traffic", label: "Verkehrserlöse", hint: "Tickets und Beifracht", cats: ["tickets", "cargo"], color: "rev" },
  { id: "ancillary", label: "Nebenerlöse", hint: "Gepäck und Bordverkauf", cats: ["bags", "onboard"], color: "rev2" },
  { id: "other", label: "Sonstige Erträge", hint: "Versicherung, Aktienverkäufe", cats: ["insurance", "stocks"], color: "muted", nonOp: true }
];

/** Kostenblöcke. */
export const COST_BLOCKS = [
  { id: "staff", label: "Personal", hint: "Gehälter, Spesen, Schulung", cats: ["staff", "crew", "training"], color: "staff" },
  { id: "ops", label: "Flugbetrieb", hint: "Kerosin, Gebühren, Handling, Flugsicherung", cats: ["fuel", "fees", "handling", "nav"], color: "ops" },
  { id: "fleet", label: "Flotte", hint: "Leasingraten und Wartungsrücklagen", cats: ["lease", "leaseReserve"], color: "fleet" },
  { id: "tech", label: "Technik", hint: "Wartungsreserve, Checks, Versicherung, Parken", cats: ["maint", "checks", "fixed"], color: "tech" },
  { id: "market", label: "Vertrieb & Service", hint: "Buchungskosten und Catering", cats: ["sales", "catering"], color: "market" },
  { id: "capex", label: "Investitionen", hint: "Flugzeuge, Ausbau, Personalgewinnung, Kautionen, Verträge, Aktien", cats: ["aircraft", "upgrades", "recruit", "contract", "stocks"], color: "muted", capex: true }
];

const sumCats = (obj, cats) => cats.reduce((s, c) => s + (obj[c] || 0), 0);

/**
 * Gewinn- und Verlustrechnung über die letzten `days` Tage.
 * Investitionen und außerordentliche Erträge bleiben außerhalb des operativen Ergebnisses –
 * sonst sähe eine Woche mit Flugzeugkauf aus wie eine Katastrophe.
 */
export function statement(state, days, now) {
  const from = dayKey(now - days * DAY);
  const rev = {}, cost = {};
  let activeDays = 0;
  for (const [k, d] of Object.entries(state.fin.days)) {
    if (k < from) continue;
    activeDays++;
    for (const [c, v] of Object.entries(d.rev)) rev[c] = (rev[c] || 0) + v;
    for (const [c, v] of Object.entries(d.cost)) cost[c] = (cost[c] || 0) + v;
  }
  const revBlocks = REV_BLOCKS.map(b => ({ ...b, total: sumCats(rev, b.cats), parts: b.cats.map(c => [c, rev[c] || 0]).filter(([, v]) => v) }));
  const costBlocks = COST_BLOCKS.map(b => ({ ...b, total: sumCats(cost, b.cats), parts: b.cats.map(c => [c, cost[c] || 0]).filter(([, v]) => v) }));
  const opRev = revBlocks.filter(b => !b.nonOp).reduce((s, b) => s + b.total, 0);
  const opCost = costBlocks.filter(b => !b.capex).reduce((s, b) => s + b.total, 0);
  const profit = opRev - opCost;

  // Flüge im Zeitraum (state.flights ist auf die letzten Einträge gedeckelt – reicht für Kennzahlen)
  const since = now - days * DAY;
  const legs = state.flights.filter(f => f.arr >= since);
  const pax = legs.reduce((s, f) => s + f.paxTotal, 0);
  const active = state.fleet.filter(a => a.status !== "crashed" && a.status !== "delivery").length;

  return {
    days, activeDays, rev, cost, revBlocks, costBlocks, opRev, opCost, profit,
    margin: opRev ? profit / opRev : 0,
    share: c => opCost ? c / opCost : 0,
    legs: legs.length, pax,
    lf: legs.length ? legs.reduce((s, f) => s + f.lf, 0) / legs.length : 0,
    perLeg: legs.length ? { rev: opRev / legs.length, cost: opCost / legs.length, profit: profit / legs.length } : null,
    perAircraftDay: active && days ? profit / active / days : 0,
    perPax: pax ? profit / pax : 0,
    salaryPerDay: salaryPerDay(state).total
  };
}

/** Laufende Kosten pro Tag, unabhängig davon ob geflogen wird – für die Frage „was kostet mich Stillstand?“ */
export function burnPerDay(state, now) {
  const st = statement(state, 7, now);
  const fixedish = sumCats(st.cost, ["staff", "fixed"]) / Math.max(1, Math.min(7, st.activeDays));
  return fixedish;
}
