// Reputation 0..100. Bewegt sich nach jedem Flug langsam auf einen Zielwert zu.
// Zielwert = Preisfairness + Gebühren + Bordservice + Schulung + Kabinenkomfort + Sicherheitsbilanz.

import { REPUTATION as R, CATERING, BAGS, STAFF, CABIN, DAY } from "../core/config.js";
import { clamp } from "../core/util.js";
import { refFare } from "./demand.js";
import { seatUnits } from "./flight.js";

const decay = (ts, list, cfg) => list.reduce((s, t) => s + cfg.hit * Math.pow(0.5, (ts - t) / (cfg.halfLifeDays * DAY)), 0);

/** Einzelne Bausteine – die Airline-App zeigt sie als Aufschlüsselung an. */
export function repFactors(state, ts, leg) {
  const a = state.airline, f = {};
  if (leg) {
    // Preisfairness: Verhältnis eigener Preis zu Referenzpreis, gewichtet nach Sitzen
    let w = 0, ratio = 0;
    for (const c of CABIN.classes) { const n = leg.cfg[c] || 0; if (!n) continue; w += n; ratio += n * leg.prices[c] / refFare(leg.km, c); }
    const r = w ? ratio / w : 1, p = R.priceFair;
    f.preis = r <= p.good ? p.bonus * (p.good - r) / p.good * 3 : r >= p.bad ? -p.malus * Math.min(1, (r - p.bad) / 0.5) : 0;
    f.preis = clamp(f.preis, -p.malus, p.bonus);
    f.komfort = seatUnits(leg.cfg) / leg.seatsMax > CABIN.denseThreshold ? R.dense : 0;
  }
  f.bordservice = CATERING.modes[a.catering].rep;
  f.gepaeck = -Math.min(BAGS.repCap, a.bagFee * BAGS.repPerUsd);
  f.schulung = STAFF.training.rep[a.training];
  f.sicherheit = decay(ts, a.safety.crashes, R.crash) + decay(ts, a.safety.incidents, R.incident);
  const last = Math.max(a.safety.since, ...a.safety.crashes, ...a.safety.incidents);
  f.unfallfrei = Math.min(R.safeBonusMax, (ts - last) / DAY / R.safeBonusPerDays);
  return f;
}

export function repTarget(state, ts, leg) {
  return clamp(R.start + Object.values(repFactors(state, ts, leg)).reduce((s, v) => s + v, 0), 0, 100);
}

export function updateRep(state, ts, leg) {
  const a = state.airline;
  a.rep = clamp(a.rep + (repTarget(state, ts, leg) - a.rep) * R.ema, 0, 100);
}
