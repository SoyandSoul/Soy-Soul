// Umsteiger am Drehkreuz.
//
// Bisher war ein Drehkreuz nur ein Punkt, von dem Strecken ausgehen – die Summe seiner Strecken.
// Echte Drehkreuze leben davon, dass Ankünfte und Abflüge zusammenpassen: Wer aus Madrid kommt und
// nach Oslo weiterfliegt, zählt für beide Flüge. Dadurch wird die Abflugzeit zur Entscheidung und
// ein Netz aus zehn Strecken mehr wert als zehn einzelne Strecken.
//
// Wie es gerechnet wird:
//   1. Jedes Flugzeug pendelt mit fester Umlaufzeit. Daraus lassen sich seine Ankünfte und Abflüge
//      am Drehkreuz vorwärts und rückwärts projizieren – ohne irgendetwas zu speichern.
//   2. Für einen Flug ins Drehkreuz zählen die Abflüge im Anschlussfenster, für einen Flug aus dem
//      Drehkreuz die Ankünfte davor.
//   3. Die Nachfrage A→B kommt aus demselben Modell wie der Direktverkehr, gedämpft mit dem Umweg:
//      Wer über das Drehkreuz 60 % weiter fliegt als direkt, steigt kaum um.
//   4. Umsteiger füllen nur freie Sitze – örtliche Nachfrage hat Vorrang, wie in echt.
//   5. Der Durchgangspreis liegt unter der Summe zweier Einzelflüge und wird nach Entfernung
//      auf beide Flüge aufgeteilt, damit kein Erlös doppelt gezählt wird.

import { CONNECT, CABIN, GAME, H } from "../core/config.js";
import { clamp } from "../core/util.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";
import { typeOf, routeDistance, blockHours } from "./flight.js";
import { distanceKm } from "./geo.js";
import { dailyMarket, classSplit, refFare, repDemandFactor } from "./demand.js";
import { turnaroundHours } from "./handling.js";

/** Ist dieser Flughafen ein Drehkreuz der Airline? */
const isHub = (state, iata) => state.airline.hubs.includes(iata);

/**
 * Ankünfte und Abflüge am Drehkreuz, projiziert aus den Umlaufzeiten.
 * Liefert je Flugzeug die Zeiten im gewünschten Fenster – reine Rechnung aus ac.ops.
 */
export function hubTimetable(state, hub, from, to) {
  const out = [];
  for (const ac of state.fleet) {
    if (ac.status !== "active" || !ac.ops) continue;
    const route = state.routes.find(r => r.id === ac.ops.routeId);
    if (!route) continue;
    if (route.from !== hub && route.to !== hub) continue;
    const dest = route.from === hub ? route.to : route.from;
    const t = typeOf(ac);
    const block = blockHours(routeDistance(route), t) * H;
    const turn = turnaroundHours(state, ac, hub) * H;
    const cycle = 2 * block + turn + turnaroundHours(state, ac, dest) * H;
    if (!(cycle > 0)) continue;
    // Nächster Abflug am Drehkreuz: steht es dort, ist es ops.dep; sonst nach Rückflug und Standzeit.
    const hubDep0 = ac.ops.dir === 0 ? ac.ops.dep : ac.ops.dep + block + turn;
    const hubArr0 = hubDep0 - turn;
    const kFrom = Math.floor((from - hubDep0) / cycle) - 1;
    const kTo = Math.ceil((to - hubArr0) / cycle) + 1;
    const arrivals = [], departures = [];
    for (let k = kFrom; k <= kTo; k++) {
      const a = hubArr0 + k * cycle, d = hubDep0 + k * cycle;
      if (a >= from && a <= to) arrivals.push(a);
      if (d >= from && d <= to) departures.push(d);
    }
    if (arrivals.length || departures.length) out.push({ acId: ac.id, routeId: route.id, dest, arrivals, departures, cycle });
  }
  return out;
}

/** Wie viel Umweg der Umstieg bedeutet, und wie viele das mitmachen. 1 = kein Umweg. */
export function detourFactor(aIata, bIata, hubIata) {
  const a = AIRPORT_BY_IATA[aIata], b = AIRPORT_BY_IATA[bIata], h = AIRPORT_BY_IATA[hubIata];
  if (!a || !b || !h) return 0;
  const direct = distanceKm(a, b);
  if (direct < CONNECT.minDirectKm) return 0;          // zu nah, dafür steigt niemand um
  const via = distanceKm(a, h) + distanceKm(h, b);
  const ratio = via / Math.max(1, direct);
  if (ratio > CONNECT.maxDetour) return 0;
  // 1,0 → voll, maxDetour → nichts
  return clamp(1 - (ratio - 1) / (CONNECT.maxDetour - 1), 0, 1);
}

/** Wie attraktiv eine Umsteigezeit ist: zu knapp geht nicht, zu lang will keiner. */
export function waitFactor(minutes) {
  if (minutes < CONNECT.minMinutes) return 0;
  if (minutes > CONNECT.maxMinutes) return 0;
  const sweet = CONNECT.sweetMinutes;
  return minutes <= sweet
    ? clamp((minutes - CONNECT.minMinutes) / Math.max(1, sweet - CONNECT.minMinutes), 0, 1)
    : clamp(1 - (minutes - sweet) / Math.max(1, CONNECT.maxMinutes - sweet), 0, 1) * 0.85 + 0.15;
}

/**
 * Umsteiger für einen konkreten Flug.
 *   dir "out" – Flug startet am Drehkreuz: zählt Ankünfte davor
 *   dir "in"  – Flug endet am Drehkreuz: zählt Abflüge danach
 * freeSeats = was nach der örtlichen Nachfrage noch frei ist.
 */
export function connectingPax(state, { hub, other, ts, dir, freeSeats, km, flightsPerDay = 1 }) {
  if (!isHub(state, hub) || !freeSeats) return null;
  const win = dir === "out"
    ? [ts - CONNECT.maxMinutes * 60_000, ts - CONNECT.minMinutes * 60_000]
    : [ts + CONNECT.minMinutes * 60_000, ts + CONNECT.maxMinutes * 60_000];
  const table = hubTimetable(state, hub, win[0], win[1]);
  const rep = repDemandFactor(state.airline.rep);

  const perClass = {}; for (const c of CABIN.classes) perClass[c] = 0;
  let fare = 0, pairs = 0;
  for (const entry of table) {
    if (entry.dest === other) continue;                 // der eigene Flug zählt nicht als Zubringer
    const times = dir === "out" ? entry.arrivals : entry.departures;
    if (!times.length) continue;
    const det = detourFactor(entry.dest, other, hub);
    if (!det) continue;
    // Beste Verbindung dieses Zubringers im Fenster
    let best = 0;
    for (const t of times) {
      const wait = Math.abs(ts - t) / 60_000;
      best = Math.max(best, waitFactor(wait));
    }
    if (!best) continue;
    pairs++;
    const [fromI, toI] = dir === "out" ? [entry.dest, other] : [other, entry.dest];
    const m = dailyMarket(fromI, toI, ts, distanceKm(AIRPORT_BY_IATA[fromI], AIRPORT_BY_IATA[toI]));
    const split = classSplit(m.bizAvg, distanceKm(AIRPORT_BY_IATA[fromI], AIRPORT_BY_IATA[toI]));
    // Entscheidend: Der Tagesmarkt eines Städtepaars verteilt sich auf ALLE eigenen Abflüge
    // dieser Strecke am Tag. Ohne diesen Nenner würde dieselbe Nachfrage bei jedem Abflug
    // noch einmal einsteigen – und jedes Flugzeug wäre immer voll.
    const share = GAME.marketShare * CONNECT.share * det * best * rep;
    const perFlight = m.total * share / Math.max(1, flightsPerDay);
    const through = distanceKm(AIRPORT_BY_IATA[fromI], AIRPORT_BY_IATA[toI]);
    for (const c of CABIN.classes) {
      const pax = perFlight * split[c];
      perClass[c] += pax;
      // Durchgangspreis, anteilig nach Entfernung auf diesen Flug
      fare += pax * refFare(through, c) * CONNECT.throughFare * clamp(km / Math.max(1, through), 0, 1);
    }
  }
  // Auf freie Sitze deckeln – örtliche Nachfrage hat Vorrang, und auch ein gut angebundenes
  // Drehkreuz füllt nicht jeden letzten Platz: Umsteiger nehmen höchstens einen Teil des Rests.
  let total = CABIN.classes.reduce((s, c) => s + perClass[c], 0);
  if (total <= 0) return null;
  const room = freeSeats * CONNECT.fillFree;
  if (total > room) {
    const f = room / total;
    for (const c of CABIN.classes) perClass[c] *= f;
    fare *= f;
    total = room;
  }
  const pax = {};
  for (const c of CABIN.classes) pax[c] = Math.floor(perClass[c]);
  const paxTotal = CABIN.classes.reduce((s, c) => s + pax[c], 0);
  if (!paxTotal) return null;
  return { pax, paxTotal, revenue: Math.round(fare * paxTotal / Math.max(0.001, total)), pairs };
}

/**
 * Überblick fürs Drehkreuz-Fenster: Wie gut passen Ankünfte und Abflüge zusammen?
 * Liefert die Wellen über 24 Stunden und eine Note.
 */
export function hubWaves(state, hub, now, hours = 24) {
  const from = now, to = now + hours * 3600_000;
  const table = hubTimetable(state, hub, from, to);
  const buckets = [];
  for (let i = 0; i < hours; i++) buckets.push({ h: i, arr: 0, dep: 0 });
  for (const e of table) {
    for (const a of e.arrivals) { const i = Math.floor((a - from) / 3600_000); if (buckets[i]) buckets[i].arr++; }
    for (const d of e.departures) { const i = Math.floor((d - from) / 3600_000); if (buckets[i]) buckets[i].dep++; }
  }
  // Note: wie viele Abflüge haben eine passende Ankunft davor?
  let matched = 0, deps = 0;
  for (const e of table) {
    for (const d of e.departures) {
      deps++;
      const ok = table.some(o => o !== e && detourFactor(o.dest, e.dest, hub) > 0 &&
        o.arrivals.some(a => waitFactor((d - a) / 60_000) > 0));
      if (ok) matched++;
    }
  }
  const quality = deps ? matched / deps : 0;
  return {
    buckets, deps, matched, quality,
    note: deps < 2 ? "Für Umsteiger braucht es mindestens zwei Strecken."
      : quality > 0.75 ? "Die Umläufe passen gut zusammen – fast jeder Abflug hat Zubringer."
      : quality > 0.4 ? "Ein Teil der Abflüge hat Zubringer. Mehr Strecken oder andere Startzeiten helfen."
      : "Die Umläufe passen kaum zusammen – es gibt fast keine Umsteiger."
  };
}
