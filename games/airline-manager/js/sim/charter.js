// Charteraufträge von Reiseveranstaltern.
//
// Ein Veranstalter mietet ein ganzes Flugzeug samt Crew für ein paar Tage (in der Branche: ACMI).
// Er stellt Kerosin und Gebühren, wir stellen Flugzeug, Besatzung, Wartung und Versicherung.
// Für uns heißt das: ein fester Betrag, kaum variable Kosten – dafür ist das Flugzeug weg,
// die eigene Strecke verliert so lange Frequenz, und die Flugstunden laufen trotzdem auf die Wartung zu.
//
// Die Angebote hängen am Tag und am Drehkreuz, nicht am Zufall des Moments: Wer dieselbe Airline
// am selben Tag öffnet, sieht dieselben Angebote – neu laden würfelt nichts neu.

import { CHARTER as C, DAY } from "../core/config.js";
import { rand01, dayKey, clamp } from "../core/util.js";
import { AIRPORTS, AIRPORT_BY_IATA } from "../data/airports.js";
import { typeOf, totalSeats } from "./flight.js";
import { distanceKm } from "./geo.js";

/** Ziele, die ein Veranstalter bucht: touristisch, erreichbar, nicht der eigene Hub. */
function poolFor(hub) {
  const h = AIRPORT_BY_IATA[hub];
  return AIRPORTS
    .filter(a => a.iata !== hub && a.tour >= C.minTourism)
    .map(a => ({ a, km: Math.round(distanceKm(h, a)) }))
    .filter(x => x.km >= C.minKm && x.km <= C.maxKm);
}

const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

/** Tagessatz je Sitz, mit Zuschlag für weite Ziele und gutem Ruf. */
export function dayRate(state, size, km) {
  const base = C.dayRatePerSeat[size];
  const far = 1 + C.farBonus * clamp((km - 1500) / 6000, 0, 1);
  const rep = C.repMin + C.repSpan * state.airline.rep / 100;
  return base * far * rep;
}

/**
 * Die Angebote des laufenden Tages. Reine Funktion aus Datum, Drehkreuz und Ruf.
 * Sie verfallen um Mitternacht UTC – wer zögert, sieht am nächsten Tag andere.
 */
export function charterOffers(state, now) {
  const hub = state.airline.hubs[0];
  const key = dayKey(now);
  const pool = poolFor(hub);
  if (!pool.length) return [];
  const until = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
  const taken = new Set(state.charter?.taken || []);
  const out = [];
  for (let i = 0; i < C.offersPerDay; i++) {
    const seed = `${key}|${hub}|${i}`;
    // Immer eine Mischung: ein erreichbarer Auftrag für Schmalrumpf, ein freier, ein großer.
    // So steht auch am ersten Tag etwas zur Auswahl, ohne dass die Langstrecke verschwindet.
    const want = i === 0 ? "narrow" : i === 1 ? null : "wide";
    const sub = want === "narrow" ? pool.filter(x => x.km <= C.narrowKm)
      : want === "wide" ? pool.filter(x => x.km >= C.wideFromKm) : pool;
    const dest = pick(sub.length ? sub : pool, rand01("chDest", seed));
    const size = want || (dest.km > C.wideFromKm ? "wide" : rand01("chSize", seed) < 0.3 ? "wide" : "narrow");
    const days = C.minDays + Math.floor(rand01("chDays", seed) * (C.maxDays - C.minDays + 1));
    const seats = C.refSeats[size];
    const id = `ch${key}${i}`;
    if (taken.has(id) || (state.charter?.declined || []).includes(id)) continue;
    const total = Math.round(dayRate(state, size, dest.km) * seats * days / 1000) * 1000;
    out.push({
      id, to: dest.a.iata, city: dest.a.city, km: dest.km, size, days, seats,
      operator: C.operators[(Math.floor(rand01("chOp", key) * C.operators.length) + i) % C.operators.length],
      total, upfront: Math.round(total * C.upfront), until,
      perDay: Math.round(total / days),
      fh: C.fhPerDay[size] * days
    });
  }
  return out;
}

/** Passt dieses Flugzeug zu dem Auftrag? */
export function fitProblems(ac, offer) {
  const t = typeOf(ac);
  const p = [];
  if (t.size !== offer.size && !(offer.size === "narrow" && t.size !== "narrow"))
    p.push(`Verlangt wird ${offer.size === "wide" ? "ein Großraumflugzeug" : "ein Schmalrumpfflugzeug"}.`);
  if (t.rangeKm < offer.km * 1.05) p.push(`Reichweite reicht nicht (${offer.km} km).`);
  if (totalSeats(ac.cfg) < offer.seats * C.seatTolerance)
    p.push(`Zu wenig Sitze: verlangt sind rund ${offer.seats}, an Bord sind ${totalSeats(ac.cfg)}.`);
  if (ac.status !== "idle" && ac.status !== "active") p.push("Flugzeug ist gerade nicht einsatzbereit.");
  if (ac.charter) p.push("Fliegt bereits einen Charter.");
  return p;
}

/** Welche Flugzeuge kämen für diesen Auftrag in Frage? */
export const candidates = (state, offer) =>
  state.fleet.filter(ac => ac.status !== "crashed" && !fitProblems(ac, offer).length);

/**
 * Was dieses Flugzeug zuletzt im Liniendienst pro Tag abgeworfen hat.
 * Damit lässt sich ein Charterangebot ehrlich vergleichen, statt nur die große Zahl zu sehen.
 */
export function routeProfitPerDay(state, ac, now, days = 7) {
  const since = now - days * DAY;
  const legs = state.flights.filter(f => f.acId === ac.id && f.arr >= since);
  if (legs.length < 2) return null;
  const span = Math.max(DAY / 2, now - Math.min(...legs.map(f => f.t)));
  return Math.round(legs.reduce((s, f) => s + f.profit, 0) / (span / DAY));
}
