// Flugabrechnung: was die zuletzt beendeten Flüge gebracht haben – und wie gut eine Strecke läuft.
//
// state.flights hält die letzten Legs mit allen Zahlen. Hier werden sie zu einem Bericht gebündelt
// und je Strecke zu einer Bewertung verdichtet (Auslastung, Pünktlichkeit, Ertrag).

import { DAY, CABIN } from "../core/config.js";
import { refFare } from "./demand.js";

const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

/** Kennzahlen einer Menge von Flügen. */
export function tally(legs) {
  if (!legs.length) return null;
  const rev = {}, cost = {};
  for (const l of legs) {
    for (const [k, v] of Object.entries(l.rev)) rev[k] = (rev[k] || 0) + v;
    for (const [k, v] of Object.entries(l.cost)) cost[k] = (cost[k] || 0) + v;
  }
  const revTotal = sum(Object.values(rev), v => v), costTotal = sum(Object.values(cost), v => v);
  const onTime = legs.filter(l => !l.delay || l.delay < 15).length;
  const transferPax = legs.reduce((a, f) => a + (f.transferPax || 0), 0);
  return {
    transferPax,
    legs: legs.length, rev, cost, revTotal, costTotal,
    profit: revTotal - costTotal,
    margin: revTotal ? (revTotal - costTotal) / revTotal : 0,
    pax: sum(legs, l => l.paxTotal),
    lf: sum(legs, l => l.lf) / legs.length,
    onTime: onTime / legs.length,
    delayed: legs.length - onTime,
    events: legs.filter(l => l.event).length
  };
}

/** Flüge, die seit einem Zeitpunkt gelandet sind. */
export const legsSince = (state, since) => state.flights.filter(l => l.arr > since);

/**
 * Bewertung einer Strecke, 0 bis 5 Sterne, aus den letzten Flügen.
 * Drei gleichgewichtete Teile: Auslastung, Pünktlichkeit und Ertrag je Sitz gegen den Referenzpreis.
 */
export function rateRoute(state, routeId, now, days = 14) {
  const legs = state.flights.filter(l => l.routeId === routeId && l.arr > now - days * DAY);
  if (legs.length < 2) return null;
  const t = tally(legs);

  // Ertrag je angebotenem Sitz im Verhältnis zum Referenzpreis der Strecke
  const km = legs[0].km;
  const ref = refFare(km, "y");
  const rask = sum(legs, l => l.rev.tickets) / Math.max(1, sum(legs, l => l.seats));
  const yieldScore = Math.max(0, Math.min(1, rask / (ref * 0.8)));

  const lfScore = Math.max(0, Math.min(1, (t.lf - 0.35) / 0.5));       // 35 % = 0, 85 % = 1
  const punctScore = Math.max(0, Math.min(1, (t.onTime - 0.5) / 0.45)); // 50 % = 0, 95 % = 1
  const stars = Math.round((lfScore + punctScore + yieldScore) / 3 * 50) / 10;

  const parts = [
    { key: "Auslastung", score: lfScore, text: `${Math.round(t.lf * 100)} %` },
    { key: "Pünktlichkeit", score: punctScore, text: `${Math.round(t.onTime * 100)} % ohne Verspätung` },
    { key: "Ertrag je Sitz", score: yieldScore, text: `$${Math.round(rask)} von $${Math.round(ref * 0.8)}` }
  ];
  const weakest = parts.slice().sort((a, b) => a.score - b.score)[0];

  return {
    stars, legs: legs.length, ...t, parts, weakest,
    hint: stars >= 4 ? "Läuft rund – hier lohnt sich mehr Kapazität."
      : weakest.key === "Auslastung" ? "Zu viele Sitze für diese Nachfrage: weniger Frequenz oder kleineres Muster."
      : weakest.key === "Pünktlichkeit" ? "Verspätungen drücken die Bewertung – Personal und Abfertiger prüfen."
      : "Der Ertrag je Sitz ist niedrig: Preise oder Kabinenaufteilung anpassen."
  };
}

/** Bericht über alle Strecken, nach Ergebnis sortiert. */
export function routeReport(state, now, days = 14) {
  return state.routes
    .map(r => ({ route: r, rating: rateRoute(state, r.id, now, days) }))
    .filter(x => x.rating)
    .sort((a, b) => b.rating.profit - a.rating.profit);
}
