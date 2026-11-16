// Wirtschaft pro Flug: Einnahmen (Tickets, Fracht, Bordverkauf, Gepäck) und Kosten
// (Kerosin, Crew, Start-/Landegebühren, Turnaround, Catering, Wartungsreserve).

import { condEffects } from "./market.js";
import { CABIN, CARGO, FEES, STAFF, CATERING, BAGS, FIXED, H } from "../core/config.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";
import { typeOf, routeDistance, blockHours, cargoCapacityKg, totalSeats } from "./flight.js";
import { bookings } from "./demand.js";
import { consumeFuel } from "./fuel.js";
import { rand01 } from "../core/util.js";

export function pilotsFor(blockH) {
  let p = 2;
  for (const [h, n] of STAFF.extraPilots) if (blockH >= h) p = n;
  return p;
}

/** Kabinencrew: gesetzliches Minimum + Service-Aufschlag für Premiumklassen */
export function cabinCrew(ac) {
  const c = ac.cfg, min = typeOf(ac).crew.cabin;
  return Math.max(min, Math.ceil((c.y || 0) / 50 + (c.w || 0) / 30 + (c.j || 0) / 12 + (c.f || 0) / 6));
}

/** Mitarbeiterzahl der Airline (für Schulungskosten und Anzeige) */
export function headcount(state) {
  let pilots = 0, cabin = 0, techs = 0;
  for (const ac of state.fleet) {
    if (ac.status === "crashed") continue;
    const t = typeOf(ac);
    pilots += 2 * STAFF.crewSetsPerAircraft * (t.rangeKm > 9000 ? 1.5 : 1);
    cabin += cabinCrew(ac) * STAFF.crewSetsPerAircraft;
    techs += t.crew.techs;
  }
  return { pilots: Math.round(pilots), cabin: Math.round(cabin), techs, total: Math.round(pilots + cabin + techs) };
}

/**
 * Berechnet einen kompletten Flug (Leg). Reine Berechnung + Kerosinentnahme; das Buchen macht engine.js.
 */
export function computeLeg(state, ac, route, dir, dep, flightsPerDay) {
  const t = typeOf(ac), km = routeDistance(route), bh = blockHours(km, t);
  const from = AIRPORT_BY_IATA[dir === 0 ? route.from : route.to], to = AIRPORT_BY_IATA[dir === 0 ? route.to : route.from];
  const legKey = ac.id + ":" + dep;
  const b = bookings({ route, dir, cfg: ac.cfg, ts: dep, rep: state.airline.rep, flightsPerDay, legKey });
  const paxTotal = CABIN.classes.reduce((s, c) => s + b.pax[c], 0);
  const seats = totalSeats(ac.cfg);
  const lf = seats ? paxTotal / seats : 0;
  const cat = CATERING.modes[state.airline.catering];

  // --- Einnahmen
  const rev = { tickets: 0, cargo: 0, onboard: 0, bags: 0 };
  for (const c of CABIN.classes) rev.tickets += b.pax[c] * b.prices[c];
  const cargoKg = cargoCapacityKg(ac, km, paxTotal) * CARGO.loadFactor[Math.max(from.tier, to.tier)] * (0.85 + 0.3 * rand01("cargo", legKey));
  rev.cargo = cargoKg * (CARGO.yieldBase + CARGO.yieldPerKm * km);
  for (const c of CABIN.classes) rev.onboard += b.pax[c] * cat.salesPerPax[c] * (km > 1500 ? 1.4 : 1);
  const bagTake = BAGS.takeRate * Math.exp(-state.airline.bagFee / BAGS.decay);
  rev.bags = (b.pax.y + b.pax.w * 0.5) * bagTake * state.airline.bagFee;

  // --- Kosten
  const fuelKg = (t.fuelKgH * bh * (0.88 + 0.12 * lf) + (cargoKg / 1000) * 30 * bh) * (1 + condEffects(ac.cond).fuel);
  const cost = {};
  cost.fuel = consumeFuel(state, fuelKg, dep);
  const wage = 1 + STAFF.training.wageBonus * state.airline.training;
  const pilots = pilotsFor(bh), cabin = cabinCrew(ac);
  cost.crew = (pilots * STAFF.pilotPerH + cabin * STAFF.cabinPerH) * bh * wage;
  cost.fees = t.mtowT * (FEES.landingPerT[from.tier] + FEES.landingPerT[to.tier]) / 2 + paxTotal * FEES.paxFee[from.tier];
  cost.handling = FEES.turnaroundBase[t.size] + paxTotal * FEES.handlingPerPax;
  cost.nav = FEES.navPerKm * km * Math.sqrt(t.mtowT / 50);
  cost.sales = rev.tickets * FEES.distribution;
  cost.catering = CABIN.classes.reduce((s, c) => s + b.pax[c] * cat.costPerPax[c], 0) * (km > 3000 ? 1.8 : 1);
  cost.maint = t.maintFH * (bh - 0.3);

  return {
    t: dep, arr: dep + bh * H, acId: ac.id, reg: ac.reg, type: t.name, routeId: route.id,
    from: from.iata, to: to.iata, km, blockH: bh, pax: b.pax, paxTotal, seats, lf, cargoKg: Math.round(cargoKg),
    prices: b.prices, cfg: { ...ac.cfg }, seatsMax: t.seatsMax, fuelKg: Math.round(fuelKg), pilots, cabin, rev, cost,
    profit: Object.values(rev).reduce((s, v) => s + v, 0) - Object.values(cost).reduce((s, v) => s + v, 0)
  };
}

/** Fixkosten pro Stunde für ein Flugzeug: Techniker, Versicherung, Parken */
export function fixedPerHour(ac) {
  const t = typeOf(ac);
  return (t.crew.techs * STAFF.techPerDay + FIXED.insurancePerMPerDay * t.priceM + FIXED.parkingPerDay[t.size]) / 24;
}
