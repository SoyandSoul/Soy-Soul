// Buchhaltung: jede Einnahme/Ausgabe läuft hier durch, damit Kasse und Statistik nie auseinanderlaufen.

import { dayKey } from "../core/util.js";

export const REV = { tickets: "Tickets", cargo: "Fracht", onboard: "Bordverkauf", bags: "Gepäckgebühren", charter: "Charter", livery: "Sonderlackierung", insurance: "Versicherung", stocks: "Aktienverkauf" };
export const COST = {
  fuel: "Kerosin", staff: "Gehälter", crew: "Crew-Spesen", fees: "Start-/Landegebühren", handling: "Turnaround & Handling", nav: "Flugsicherung", sales: "Vertrieb", catering: "Catering", marketing: "Werbung",
  lease: "Leasingraten", leaseReserve: "Wartungsrücklagen (Leasing)", leaseFee: "Leasing-Gebühren",
  maint: "Wartungsreserve", checks: "Checks A–D", fixed: "Fixkosten (Techniker, Versicherung, Parken)",
  training: "Schulungen", hub: "Drehkreuz-Unterhalt", interest: "Zinsen", recruit: "Personalgewinnung", aircraft: "Flugzeugkäufe", upgrades: "Ausbau", stocks: "Aktienkäufe", contract: "Verträge"
};

const KEEP_DAYS = 60;

export function book(state, ts, kind, cat, amount) {
  if (!amount) return;
  const k = dayKey(ts), days = state.fin.days;
  const d = (days[k] ||= { rev: {}, cost: {} });
  d[kind][cat] = (d[kind][cat] || 0) + amount;
  state.cash += kind === "rev" ? amount : -amount;
}

export function prune(state) {
  const keys = Object.keys(state.fin.days).sort();
  while (keys.length > KEEP_DAYS) delete state.fin.days[keys.shift()];
}

/** Summen über die letzten n Tage. Investitionen (Flugzeuge, Aktien, Ausbau) zählen nicht zum operativen Ergebnis. */
const CAPEX = new Set(["aircraft", "stocks", "upgrades", "recruit", "leaseFee"]);
const NONOP_REV = new Set(["stocks", "insurance"]);

export function summary(state, days = 30, now = Date.now()) {
  const from = dayKey(now - days * 86400000);
  const rev = {}, cost = {};
  for (const [k, d] of Object.entries(state.fin.days)) {
    if (k < from) continue;
    for (const [c, v] of Object.entries(d.rev)) rev[c] = (rev[c] || 0) + v;
    for (const [c, v] of Object.entries(d.cost)) cost[c] = (cost[c] || 0) + v;
  }
  const opRev = Object.entries(rev).filter(([c]) => !NONOP_REV.has(c)).reduce((s, [, v]) => s + v, 0);
  const opCost = Object.entries(cost).filter(([c]) => !CAPEX.has(c)).reduce((s, [, v]) => s + v, 0);
  return { rev, cost, opRev, opCost, profit: opRev - opCost };
}
