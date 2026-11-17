// Bodenabfertigung: wer das Flugzeug am Boden betreut. Billig heißt längere Standzeiten und mehr
// Verspätung, teuer heißt knappe Umläufe und zufriedenere Gäste.
//
// Dazu die Schnellabfertigung: Priorität am Gate gegen Aufpreis. Sie verkürzt eine laufende Standzeit,
// ersetzt sie aber nicht – ein Flugzeug kann nicht ohne Abfertigung starten.

import { HANDLERS, FLIGHT, H } from "../core/config.js";
import { gateFactor, delayFactor } from "./hub.js";
import { rand01 } from "../core/util.js";
import { typeOf, totalSeats } from "./flight.js";

export const handlerOf = state => HANDLERS[state.airline.handler] || HANDLERS[HANDLERS.default];

/** Standzeit eines Flugzeugs in Stunden, inklusive Abfertiger-Faktor. */
export function turnaroundHours(state, ac, at = null) {
  const base = FLIGHT.turnaroundMin[typeOf(ac).size] / 60 * handlerOf(state).turnaround;
  return base * (at ? gateFactor(state, at) : 1);
}

/** Zusätzliche Verspätung durch den Abfertiger – deterministisch aus Flugzeug und Abflugzeit. */
export function handlerDelay(state, ac, dep, at = null) {
  const h = handlerOf(state);
  // Am eigenen Drehkreuz senken gute Gates das Risiko, draußen hilft nur der Abfertiger.
  const chance = h.delayChance * (at ? delayFactor(state, at) : 1);
  if (rand01("handler", ac.id, dep) >= chance) return null;
  const [a, b] = h.delayMin;
  const min = Math.round(a + (b - a) * rand01("handlerMin", ac.id, dep));
  return { min, reason: h === HANDLERS.budget ? "der Bodenabfertigung" : "verzögerter Abfertigung" };
}

/**
 * Was eine Schnellabfertigung für dieses Flugzeug kostet.
 * Der Preis hängt an der Restzeit: wer kurz vor dem Abflug noch drückt, spart wenig und zahlt wenig.
 * So ist Vorziehen nie eine Falle, egal wann man draufklickt.
 */
export function rushCost(state, ac, left) {
  const seats = totalSeats(ac.cfg) || typeOf(ac).seats;
  const full = turnaroundHours(state, ac) * H;
  const share = left == null ? 1 : Math.min(1, Math.max(0, left / full));
  const base = seats * HANDLERS.rush.costPerSeat * handlerOf(state).costFactor * share;
  return Math.max(HANDLERS.rush.minCost, Math.round(base / 10) * 10);
}

/**
 * Flugzeuge, die am Boden stehen und auf den Abflug warten – mit Restzeit.
 * ready = Abfertigung läuft noch, lässt sich aber beschleunigen.
 */
export function departureBoard(state, now) {
  const out = [];
  for (const ac of state.fleet) {
    if (ac.status !== "active" || !ac.ops) continue;
    const left = ac.ops.dep - now;
    if (left <= 0) continue;                       // fliegt gleich von allein los
    const route = state.routes.find(r => r.id === ac.ops.routeId);
    if (!route) continue;
    out.push({
      ac, route,
      from: ac.ops.dir === 0 ? route.from : route.to,
      to: ac.ops.dir === 0 ? route.to : route.from,
      dep: ac.ops.dep, left,
      delay: ac.ops.delay || null,
      rushable: left > 4 * 60_000,                 // unter vier Minuten lohnt es nicht
      saving: rushSaving(left),
      cost: rushCost(state, ac, left)
    });
  }
  return out.sort((a, b) => a.left - b.left);
}

/** Gesamtkosten, um alle beschleunigbaren Flugzeuge vorzuziehen. */
export function rushAllQuote(state, now) {
  const list = departureBoard(state, now).filter(d => d.rushable);
  return { list, total: list.reduce((s, d) => s + d.cost, 0), count: list.length };
}

/** Wie viel Zeit eine Schnellabfertigung bei diesem Flugzeug spart. */
export const rushSaving = (left) => Math.round(left * HANDLERS.rush.cut);
