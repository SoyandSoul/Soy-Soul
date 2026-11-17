// Kabinenausstattung je Flugzeug: Sitzart und Unterhaltung.
//
// Die Sitzart verändert das Sitzbudget des Typs (Slimline bringt mehr Sitze rein, Komfort weniger),
// die Unterhaltung Ruf und Bordverkauf. Beides kostet je Sitzplatz und braucht Hallenzeit –
// deshalb lohnt es sich, den Umbau zusammen mit einem Check zu legen.

import { FITTING } from "../core/config.js";
import { typeOf, totalSeats } from "./flight.js";

export const fittingOf = ac => ({
  seats: FITTING.seats[ac.fit?.seats] ? ac.fit.seats : "standard",
  ife: FITTING.ife[ac.fit?.ife] ? ac.fit.ife : "none"
});

export const seatSpec = ac => FITTING.seats[fittingOf(ac).seats];
export const ifeSpec = ac => FITTING.ife[fittingOf(ac).ife];

/** Sitzbudget des Flugzeugs nach Umbau. */
export const seatBudget = ac => Math.floor(typeOf(ac).seatsMax * seatSpec(ac).seatBonus);

/** Ruf- und Umsatzwirkung der Flotte, gewichtet nach Sitzen – eine Maschine von zehn zählt wenig. */
export function fleetFitting(state) {
  const fleet = state.fleet.filter(a => a.status !== "crashed");
  let seats = 0, rep = 0, onboard = 0;
  for (const ac of fleet) {
    const n = totalSeats(ac.cfg) || 1;
    seats += n;
    rep += n * (seatSpec(ac).rep + ifeSpec(ac).rep);
    onboard += n * ifeSpec(ac).onboard;
  }
  if (!seats) return { rep: 0, onboard: 1 };
  return { rep: rep / seats, onboard: onboard / seats };
}

/** Was ein Umbau kostet und wie lange er dauert. */
export function retrofitQuote(state, ac, seatsKey, ifeKey) {
  const cur = fittingOf(ac);
  const toSeats = FITTING.seats[seatsKey], toIfe = FITTING.ife[ifeKey];
  if (!toSeats || !toIfe) return null;
  const n = totalSeats(ac.cfg) || typeOf(ac).seats;
  let price = 0, hours = 0;
  if (seatsKey !== cur.seats) { price += toSeats.pricePerSeat * n; hours = Math.max(hours, toSeats.hours); }
  if (ifeKey !== cur.ife) { price += toIfe.pricePerSeat * n; hours = Math.max(hours, toIfe.hours); }
  return {
    price: Math.round(price), hours, seats: seatsKey, ife: ifeKey, changed: price > 0 || hours > 0,
    budgetAfter: Math.floor(typeOf(ac).seatsMax * toSeats.seatBonus)
  };
}
