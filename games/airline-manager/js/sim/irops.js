// IROPS – wenn der Plan nicht mehr aufgeht.
//
// Ein schwerer Defekt setzt ein Flugzeug fest (AOG, aircraft on ground). Repariert werden muss
// es in jedem Fall; die Entscheidung dreht sich um die Fluggäste und den Umlauf:
//
//   warten      – alle warten, bis die Maschine wieder fliegt. Ab drei Stunden wird entschädigt.
//   streichen   – der Umlauf fällt aus. Erstattung und Umbuchung kosten, der Ruf leidet stärker.
//   tauschen    – ein freies Flugzeug übernimmt die Strecke sofort, der Defekt geht in die Werft.
//   überführen  – ein freies Flugzeug fliegt leer dorthin, wo es gebraucht wird, und übernimmt.
//
// Wichtig für ein Spiel, das nebenher läuft: Jede Entscheidung hat eine Frist. Wer nicht da ist,
// bekommt automatisch „warten" – die sichere, aber nicht die beste Wahl. Anwesenheit wird belohnt,
// Abwesenheit nicht bestraft, genau wie bei der Schnellabfertigung.

import { IROPS, H, DAY } from "../core/config.js";
import { rand01, clamp } from "../core/util.js";
import { typeOf, totalSeats, routeDistance, blockHours } from "./flight.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";
import { distanceKm } from "./geo.js";

export const openCases = (state, now) => (state.irops || []).filter(c => !c.done && c.deadline > now - 7 * DAY);
export const caseFor = (state, acId) => (state.irops || []).find(c => c.acId === acId && !c.done);

/** Wie lange die Reparatur dauert – schwerer Defekt, nicht der kleine Pannenfall. */
export function repairHours(ac, ts) {
  const t = typeOf(ac);
  const [a, b] = IROPS.repairH[t.size] || IROPS.repairH.narrow;
  return a + (b - a) * rand01("aogRepair", ac.id, ts);
}

/** Entschädigung nach Verspätungsdauer – angelehnt an die europäische Regel. */
export function compensation(pax, delayH) {
  if (delayH < IROPS.compFromH) return 0;
  const rate = delayH >= IROPS.compBigH ? IROPS.compBig : IROPS.comp;
  return Math.round(pax * rate);
}

/** Welche Flugzeuge könnten einspringen? */
export function replacements(state, c) {
  const broken = state.fleet.find(a => a.id === c.acId);
  if (!broken) return [];
  const route = state.routes.find(r => r.id === c.routeId);
  const km = route ? routeDistance(route) : 0;
  return state.fleet.filter(a => {
    if (a.id === c.acId || a.status !== "idle" || a.charter || a.adLivery?.ready > c.at) return false;
    const t = typeOf(a);
    if (t.rangeKm < km * 1.05) return false;
    return totalSeats(a.cfg) >= totalSeats(broken.cfg) * IROPS.seatTolerance;
  });
}

/** Was eine Überführung kostet: ein Leerflug zum gestrandeten Flugzeug. */
export function ferryQuote(state, c, ac) {
  const hub = state.airline.hubs[0];
  const from = AIRPORT_BY_IATA[hub], to = AIRPORT_BY_IATA[c.at];
  if (!from || !to) return null;
  const km = Math.round(distanceKm(from, to));
  const t = typeOf(ac);
  const bh = blockHours(km, t);
  // Treibstoff, Gebühren und Besatzung ohne jede Einnahme
  const cost = Math.round(km * IROPS.ferryPerKm[t.size] + IROPS.ferryBase);
  return { km, hours: bh, cost };
}

/** Die vier Möglichkeiten mit ihren Folgen – für die Oberfläche und für die Vorschau. */
export function options(state, c, now) {
  const ac = state.fleet.find(a => a.id === c.acId);
  if (!ac) return [];
  const left = Math.max(0, c.repairUntil - now) / H;
  const comp = compensation(c.pax, left);
  const subs = replacements(state, c);
  const out = [
    {
      id: "wait", label: "Warten",
      text: `Reparatur läuft noch ${left.toFixed(1)} h. Alle Fluggäste warten; ab ${IROPS.compFromH} h gibt es Entschädigung.`,
      cost: comp, rep: IROPS.rep.wait, delayH: left, available: true, isDefault: true
    },
    {
      id: "cancel", label: "Umlauf streichen",
      text: "Der Flug fällt aus. Erstattung und Umbuchung kosten sofort, der Ruf leidet deutlich – dafür ist der Plan schnell wieder sauber.",
      cost: Math.round(c.pax * IROPS.refundPerPax), rep: IROPS.rep.cancel, delayH: 0, available: true
    },
    {
      id: "swap", label: "Flugzeug tauschen",
      text: subs.length
        ? `${subs[0].reg} steht frei und übernimmt die Strecke. Der Defekt geht in die Werft.`
        : "Kein passendes Flugzeug frei – es müsste eines ohne Strecke am Drehkreuz stehen.",
      cost: IROPS.swapCost, rep: IROPS.rep.swap, delayH: IROPS.swapDelayH,
      available: subs.length > 0, subs
    }
  ];
  const ferrySub = subs[0];
  const fq = ferrySub ? ferryQuote(state, c, ferrySub) : null;
  out.push({
    id: "ferry", label: "Leer überführen",
    text: fq
      ? `${ferrySub.reg} fliegt leer ${fq.km} km nach ${c.at} und übernimmt dort. Dauert ${fq.hours.toFixed(1)} h und bringt keinen Umsatz.`
      : "Kein passendes Flugzeug frei, das überführt werden könnte.",
    cost: fq ? fq.cost : 0, rep: IROPS.rep.ferry, delayH: fq ? fq.hours + 1 : 0,
    available: !!fq && c.at !== state.airline.hubs[0], subs, ferry: fq
  });
  return out;
}

/** Einen Fall anlegen – wird aus der Engine gerufen, wenn ein schwerer Defekt eintritt. */
export function openCase(state, ac, route, at, ts, pax) {
  const hours = repairHours(ac, ts);
  const c = {
    id: `ir${ts.toString(36)}${ac.id}`,
    acId: ac.id, reg: ac.reg, routeId: route?.id || null, at,
    pax: Math.round(pax), at_ts: ts, at_city: AIRPORT_BY_IATA[at]?.city || at,
    repairUntil: ts + hours * H,
    deadline: ts + IROPS.decideH * H,
    done: false, choice: null
  };
  state.irops ??= [];
  state.irops.unshift(c);
  if (state.irops.length > 40) state.irops.length = 40;
  return c;
}

/** Fristablauf: ohne Entscheidung wird gewartet. */
export const expired = (c, now) => !c.done && now >= c.deadline;
