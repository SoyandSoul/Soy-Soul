// Bewertung einer Airline in drei Zahlen, die auch für fremde Airlines funktionieren –
// also nur aus dem, was eine Airline veröffentlicht, nicht aus ihrem Spielstand.
//
//   Sterne         0–5 mit einer Nachkommastelle, aus der Reputation
//   Größe          0–100 aus Flotte, Personal, Zielen und Fluggästen
//   Wirtschaftlich 0–100 % aus Marge und Ergebnis je Flugzeug
//
// Die Teilskalen sind gestaucht (Wurzelkurve): Der Sprung von einem auf drei Flugzeuge zählt mehr
// als der von dreißig auf dreiunddreißig – aber eine Airline mit zwei Maschinen landet auch nicht
// schon bei der Hälfte der Punkte, wie es eine rein logarithmische Skala täte.

import { RATING as R } from "../core/config.js";
import { clamp } from "../core/util.js";
import { summary } from "./ledger.js";
import { staffNeed, headcount } from "./staff.js";

const curve = (v, max) => clamp(Math.pow(Math.max(0, v) / max, 0.45), 0, 1);

/** Sterne aus der Reputation – eine Nachkommastelle, wie in der Wunschliste. */
export const stars = rep => Math.round(clamp(rep, 0, 100) / 20 * 10) / 10;

/** Größe 0–100 aus vier Teilen. Erwartet das veröffentlichte Kurzprofil. */
export function sizeScore({ fleet = 0, staff = 0, destinations = 0, pax = 0 }) {
  const parts = [
    curve(fleet, R.max.fleet) * R.weight.fleet,
    curve(staff, R.max.staff) * R.weight.staff,
    curve(destinations, R.max.destinations) * R.weight.destinations,
    curve(pax, R.max.pax) * R.weight.pax
  ];
  const sum = R.weight.fleet + R.weight.staff + R.weight.destinations + R.weight.pax;
  return Math.round(parts.reduce((a, b) => a + b, 0) / sum * 100);
}

/**
 * Wirtschaftlichkeit 0–100 %. Zwei Hälften: Marge und Ergebnis je Flugzeug und Tag.
 * Eine kleine Airline mit guter Marge kann eine große mit schlechter schlagen – so soll es sein.
 */
export function efficiencyScore({ margin = 0, profitPerAircraftDay = 0, fleet = 0 }) {
  if (!fleet) return 0;
  const m = clamp(margin / R.goodMargin, -0.5, 1.2) / 1.2;
  const p = clamp(profitPerAircraftDay / R.goodPerDay, -0.5, 1.2) / 1.2;
  return Math.round(clamp((m * 0.55 + p * 0.45) * 100, 0, 100));
}

/** Das Kurzprofil der eigenen Airline – genau das, was veröffentlicht wird. */
export function profileOf(state, now) {
  const fleet = state.fleet.filter(a => a.status !== "crashed");
  const sum = summary(state, 30, now);
  const days = 30;
  const legs = state.flights.filter(f => f.arr >= now - days * 86400000);
  const margin = sum.opRev > 0 ? sum.profit / sum.opRev : 0;
  const perDay = fleet.length ? sum.profit / fleet.length / days : 0;
  const destinations = new Set(state.routes.flatMap(r => [r.from, r.to])).size;
  return {
    fleet: fleet.length,
    staff: headcount(state).total ?? headcount(state),
    destinations,
    pax: state.stats?.pax || 0,
    legs: state.stats?.legs || 0,
    rep: state.airline.rep,
    margin,
    profit30: sum.profit,
    profitPerAircraftDay: perDay,
    types: [...new Set(fleet.map(a => a.typeId))],
    routes: state.routes.map(r => `${r.from}-${r.to}`).slice(0, 40),
    recentLegs: legs.length
  };
}

/** Die drei Kennzahlen zu einem Profil. */
export function rate(profile) {
  return {
    stars: stars(profile.rep || 0),
    size: sizeScore(profile),
    efficiency: efficiencyScore(profile)
  };
}

/** Ist diese Airline für die Börse qualifiziert? */
export const qualifies = profile => (profile?.fleet || 0) >= R.minFleet;

/** Ein Satz, der die Bewertung einordnet. */
export function ratingNote(r) {
  if (r.size >= 70 && r.efficiency >= 60) return "Groß und profitabel – eine der ersten Adressen.";
  if (r.size >= 70) return "Groß, aber die Marge hinkt der Größe hinterher.";
  if (r.efficiency >= 70) return "Klein und sehr effizient – jeder Flug trägt.";
  if (r.efficiency < 30) return "Die Wirtschaftlichkeit ist das Thema, nicht die Größe.";
  return "Solide unterwegs, Luft nach oben in beide Richtungen.";
}
