// Personal: vier Gruppen, die der Spieler selbst einstellt (Cockpit, Kabine, Boden, Verwaltung).
//
// Jede Gruppe hat einen Bedarf (wächst mit Flotte und angeflogenen Zielen) und einen Ist-Stand.
// Wer zu wenig Leute hat, fliegt unpünktlich und verliert Reputation; fehlende Verwaltung verteuert
// den Betrieb. Gehälter laufen als Tageskosten (sim/engine.js), zusätzlich gibt es Spesen pro Blockstunde
// (sim/economy.js). Techniker stecken weiterhin in den Fixkosten – sie bekommen mit dem Technikhangar
// ein eigenes System.

import { STAFF } from "../core/config.js";
import { typeOf } from "./flight.js";
import { commonality } from "./commonality.js";

export const GROUPS = ["cockpit", "cabin", "ground", "admin"];

/** Vorgeschriebene Kabinenbesatzung eines Flugzeugs: gesetzliches Minimum + Zuschlag für Premiumklassen. */
export function cabinCrew(ac) {
  const c = ac.cfg, min = typeOf(ac).crew.cabin;
  if (!min) return 0;                                   // kleine Muster fliegen ohne Kabinenbesatzung
  return Math.max(min, Math.ceil((c.y || 0) / 50 + (c.w || 0) / 30 + (c.j || 0) / 12 + (c.f || 0) / 6));
}

/** Wie viele Leute die Airline im aktuellen Zustand bräuchte. */
export function staffNeed(state) {
  const n = STAFF.need;
  let cockpit = 0, cabin = 0, ground = 0, admin = 0;
  const dest = new Set(state.airline.hubs);
  for (const ac of state.fleet) {
    if (ac.status === "crashed" || ac.status === "delivery") continue;
    // Der Bedarf hängt an der Flotte, nicht am Tagesstatus: Crews bleiben auch, wenn ein Flugzeug am Boden steht.
    const t = typeOf(ac);
    cockpit += n.cockpitPerAircraft[t.size];
    cabin += cabinCrew(ac) * n.cabinSets;
    ground += n.groundPerAircraft;
    admin += n.adminPerAircraft;
    if (ac.status === "active" && ac.ops) {
      const r = state.routes.find(r => r.id === ac.ops.routeId);
      if (r) { dest.add(r.from); dest.add(r.to); }
    }
  }
  // Ein gemeinsames Type Rating heißt: ein Pilotenpool statt vieler kleiner.
  cockpit *= commonality(state).cockpit;
  ground += dest.size * n.groundPerDestination;
  admin += (cockpit + cabin + ground) * n.adminShare;
  const out = { cockpit: Math.ceil(cockpit), cabin: Math.ceil(cabin), ground: Math.ceil(ground), admin: Math.ceil(admin), destinations: dest.size };
  out.total = GROUPS.reduce((s, g) => s + out[g], 0);
  return out;
}

/** Ist-Stand je Gruppe (mit Rückfall für alte Spielstände). */
export const staffHave = state => {
  const h = state.staff || {};
  return Object.fromEntries(GROUPS.map(g => [g, Math.max(0, Math.round(h[g] || 0))]));
};

/** Besetzungsgrad je Gruppe: 1 = Bedarf gedeckt, darüber Überbesetzung. */
export function coverage(state) {
  const need = staffNeed(state), have = staffHave(state);
  const cov = Object.fromEntries(GROUPS.map(g => [g, need[g] ? have[g] / need[g] : 1]));
  return { ...cov, need, have, total: have.cockpit + have.cabin + have.ground + have.admin };
}

/** Auswirkungen der Unterbesetzung. lack = 0 (alles gut) bis 1 (niemand da). */
export function staffEffects(state) {
  const cov = coverage(state), sh = STAFF.shortage;
  const lack = g => Math.max(0, Math.min(1, (sh.grace - cov[g]) / sh.grace));
  const flight = Math.max(lack("cockpit"), lack("cabin"));
  const ground = lack("ground"), admin = lack("admin");
  return {
    cov, flight, ground, admin,
    delayMin: Math.round(flight * sh.delayMinFlightCrew + ground * sh.delayMinGround),
    repMalus: -Math.max(flight, ground) * sh.repMalus,
    surcharge: admin * sh.adminSurcharge,
    worst: Math.min(...GROUPS.map(g => cov[g])),
    openPositions: GROUPS.reduce((s, g) => s + Math.max(0, cov.need[g] - cov.have[g]), 0)
  };
}

/** Gehälter pro Tag, je Gruppe und gesamt (inkl. Schulungszuschlag). */
export function salaryPerDay(state) {
  const have = staffHave(state), wage = 1 + STAFF.training.wageBonus * state.airline.training;
  const by = Object.fromEntries(GROUPS.map(g => [g, have[g] * STAFF.groups[g].salaryPerDay * wage]));
  return { by, total: GROUPS.reduce((s, g) => s + by[g], 0), wage };
}

/** Mitarbeiterzahl inkl. der (noch) automatisch mitlaufenden Techniker – für Schulungen und Anzeige. */
export function headcount(state) {
  const have = staffHave(state);
  let techs = 0;
  for (const ac of state.fleet) if (ac.status !== "crashed" && ac.status !== "delivery") techs += typeOf(ac).crew.techs;
  return { ...have, techs, total: have.cockpit + have.cabin + have.ground + have.admin + techs };
}

/** Kosten einer Einstellung bzw. Entlassung. */
export const hireCost = (group, n) => STAFF.groups[group].hireFee * n;
export const severanceCost = (group, n) => STAFF.groups[group].severance * n;
