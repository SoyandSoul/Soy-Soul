// Herzstück ohne Server: settle(state, now) bringt den Spielstand auf den Zeitpunkt "now".
//
// Prinzip: Jedes Flugzeug hat einen festen Fahrplan (ops.dep = nächster Abflug, Blockzeit aus der Distanz,
// danach Turnaround, dann Rückflug). Wer um 13:00 einen 5-Stunden-Flug startet und um 17:00 wieder reinschaut,
// bekommt beim Laden alle bis 17:00 beendeten Flüge abgerechnet und sieht das Flugzeug kurz vor der Landung.
//
// Alle Ereignisse werden in zeitlicher Reihenfolge über die ganze Flotte abgearbeitet
// (Kerosinlager, Reputation und Kasse ändern sich also in der richtigen Reihenfolge).
// Zufall (Nachfrage-Rauschen, Vorfälle) ist deterministisch aus Flugzeug-ID + Abflugzeit:
// Neu laden würfelt nichts neu.

import { GAME, H, DAY, USED, CHECKS } from "../core/config.js";
import { rand01 } from "../core/util.js";
import { bus } from "../core/events.js";
import { typeOf, routeDistance, blockHours, turnaroundH } from "./flight.js";
import { computeLeg, fixedPerHour } from "./economy.js";
import { book, prune } from "./ledger.js";
import { updateRep } from "./reputation.js";
import { addFlightHours, legRisk, mostUrgent, startCheck, finishCheck } from "./maintenance.js";
import { aircraftValue } from "./market.js";
import { weatherDelay } from "./weather.js";

const MAX_STEPS = 200_000;

export function cycleHours(ac, route) {
  const t = typeOf(ac);
  return 2 * (blockHours(routeDistance(route), t) + turnaroundH(t));
}

/** Wie oft fliegt die eigene Airline eine Strecke pro Tag und Richtung? */
export function flightsPerDay(state, route) {
  let n = 0;
  for (const ac of state.fleet) if (ac.ops?.routeId === route.id && ac.status !== "crashed") n += 24 / cycleHours(ac, route);
  return n;
}

function nextEventAt(state, ac) {
  switch (ac.status) {
    case "delivery": return ac.availableAt;
    case "check": return ac.check.until;
    case "active": {
      const r = state.routes.find(r => r.id === ac.ops.routeId);
      return ac.ops.dep + blockHours(routeDistance(r), typeOf(ac)) * H;
    }
    default: return Infinity;
  }
}

function log(state, ts, kind, text) {
  state.log.unshift({ t: ts, kind, text });
  if (state.log.length > 200) state.log.length = 200;
}

export function settle(state, now, { quiet = false } = {}) {
  const report = { legs: 0, profit: 0, crashes: 0, incidents: 0, checks: 0, from: state.lastSettled };
  if (now < state.lastSettled - 5 * 60_000) {
    // Uhr wurde zurückgestellt: nichts rückwärts rechnen.
    report.clockWarning = true;
    return report;
  }
  const floor = now - GAME.maxCatchupDays * DAY;
  if (state.lastSettled < floor) {
    // Zu lange weg: Fahrpläne auf das Fenster vorziehen, damit nicht Monate nachgerechnet werden.
    for (const ac of state.fleet) if (ac.status === "active" && ac.ops.dep < floor) ac.ops.dep = floor;
    state.lastSettled = state.lastFixedAt = floor;
    report.capped = true;
  }

  // Fixkosten zeitanteilig
  const hrs = (now - state.lastFixedAt) / H;
  if (hrs > 0) {
    let fixed = 0;
    for (const ac of state.fleet) if (ac.status !== "crashed" && ac.status !== "delivery") fixed += fixedPerHour(ac) * hrs;
    book(state, now, "cost", "fixed", fixed);
    state.lastFixedAt = now;
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    let next = null, at = Infinity;
    for (const ac of state.fleet) { const t = nextEventAt(state, ac); if (t < at) { at = t; next = ac; } }
    if (!next || at > now) break;
    process(state, next, at, report, quiet);
  }

  state.lastSettled = now;
  prune(state);
  return report;
}

function process(state, ac, ts, report, quiet) {
  if (ac.status === "delivery") {
    ac.status = "idle"; ac.availableAt = null;
    log(state, ts, "good", `${ac.reg} (${typeOf(ac).name}) wurde ausgeliefert.`);
    if (!quiet) bus.emit("delivered", { aircraft: ac });
    return;
  }
  if (ac.status === "check") {
    const done = finishCheck(ac);
    if (ac.ops) { ac.ops.dir = 0; ac.ops.dep = Math.max(ac.ops.dep, done.until); ac.ops.delay = null; }
    log(state, ts, "info", `${ac.reg}: ${done.type}-Check abgeschlossen.`);
    return;
  }
  // Flug beendet → abrechnen
  const route = state.routes.find(r => r.id === ac.ops.routeId);
  const dep = ac.ops.dep;
  const leg = computeLeg(state, ac, route, ac.ops.dir, dep, flightsPerDay(state, route));
  if (ac.ops.delay) { leg.delay = ac.ops.delay.min; leg.delayReason = ac.ops.delay.reason; report.delays = (report.delays || 0) + 1; }
  for (const [c, v] of Object.entries(leg.rev)) book(state, leg.arr, "rev", c, v);
  for (const [c, v] of Object.entries(leg.cost)) book(state, leg.arr, "cost", c, v);
  const risk = legRisk(ac, dep, leg.blockH);
  addFlightHours(ac, leg.blockH - 0.3);
  updateRep(state, leg.arr, leg);
  report.legs++; report.profit += leg.profit;
  route.stats ||= { legs: 0, pax: 0, profit: 0 };
  route.stats.legs++; route.stats.pax += leg.paxTotal; route.stats.profit += leg.profit;

  const roll = rand01("risk", ac.id, dep);
  if (roll < risk.crash) {
    leg.event = "crash";
    crash(state, ac, route, leg.arr, report, quiet);
  } else if (roll < risk.incident) {
    leg.event = "incident";
    state.airline.safety.incidents.push(leg.arr);
    report.incidents++;
    log(state, leg.arr, "warn", `Vorfall auf ${ac.reg} (${leg.from}–${leg.to}): technischer Defekt, Sicherheitslandung. Wartung überfällig!`);
    if (!quiet) bus.emit("incident", { aircraft: ac, route });
  }
  state.flights.unshift(leg);
  if (state.flights.length > 150) state.flights.length = 150;
  if (ac.status === "crashed") return;

  // Nächstes Leg planen
  const arrivedHome = ac.ops.dir === 1;
  const turn = turnaroundH(typeOf(ac)) * H;
  ac.ops.dir = 1 - ac.ops.dir;
  ac.ops.dep = leg.arr + turn;
  // Wetter am Ankunftsflughafen kann den Turnaround verlängern
  const wd = weatherDelay(leg.to, leg.arr, ac.id);
  ac.ops.delay = wd;
  if (wd) {
    ac.ops.dep += wd.min * 60_000;
    if (wd.min >= 45) log(state, leg.arr, "warn", `${ac.reg} in ${wd.at}: ${wd.min} min Verspätung wegen ${wd.reason}.`);
  }
  if (!arrivedHome) return;

  if (ac.unassign) { ac.ops = null; ac.unassign = false; ac.status = "idle"; return; }
  const due = ac.scheduledCheck || (ac.autoCheck && mostUrgent(ac, leg.arr)?.check);
  if (due) {
    ac.ops.delay = null;
    const cost = startCheck(state, ac, due, leg.arr);
    book(state, leg.arr, "cost", "checks", cost);
    ac.scheduledCheck = null;
    report.checks++;
    log(state, leg.arr, "info", `${ac.reg}: ${due}-Check gestartet (bis ${new Date(ac.check.until).toLocaleString("de-DE")}).`);
  }
}

function crash(state, ac, route, ts, report, quiet) {
  const refund = aircraftValue(ac, ts) * USED.insuranceRefund;
  ac.status = "crashed"; ac.ops = null; ac.crashedAt = ts;
  state.airline.safety.crashes.push(ts);
  book(state, ts, "rev", "insurance", refund);
  report.crashes++;
  log(state, ts, "bad", `ABSTURZ: ${ac.reg} auf ${route.from}–${route.to}. Ursache: überfällige Wartung. Versicherung zahlt ${Math.round(refund / 1e6)} Mio $.`);
  if (!quiet) bus.emit("crash", { aircraft: ac, route });
}

export const CHECK_ORDER = CHECKS.order;
