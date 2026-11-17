// Ereignisse in der Welt: Streiks, Luftraumsperrungen, Unwetterlagen, Nachfrageeinbrüche.
//
// Alles erfunden, nichts an reale Vorfälle angelehnt – und alles rein aus dem Datum gerechnet.
// Jede Woche wird aus einem festen Startwert gewürfelt, ob und was passiert. Damit sehen alle
// Spieler dieselben Ereignisse, ohne dass irgendwo ein Server stehen müsste.
//
// Wirkung je nach Art: Flughafen gesperrt (Abflüge warten), höhere Kosten, weniger Nachfrage.

import { EVENTS as E, DAY } from "../core/config.js";
import { rand01 } from "../core/util.js";
import { AIRPORTS, AIRPORT_BY_IATA } from "../data/airports.js";

const weekStart = ts => {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
};

const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

/** Kandidaten: größere Flughäfen, damit ein Ereignis überhaupt jemanden trifft. */
const BIG = AIRPORTS.filter(a => a.tier >= 3);

/**
 * Die Ereignisse einer Woche. Jede Art hat eine eigene Wahrscheinlichkeit – zusammen passiert
 * in etwa jeder zweiten Woche irgendetwas, meist Kleinkram.
 */
export function eventsOfWeek(weekTs) {
  const key = new Date(weekTs).toISOString().slice(0, 10);
  const out = [];
  for (const [i, kind] of E.kinds.entries()) {
    const roll = rand01("ev", key, i);
    if (roll >= kind.chance) continue;
    const seed = `${key}|${kind.id}`;
    const ap = pick(BIG, rand01("evAp", seed));
    const start = weekTs + Math.floor(rand01("evStart", seed) * 5) * DAY + 6 * 3600_000;
    const hours = kind.hours[0] + Math.floor(rand01("evLen", seed) * (kind.hours[1] - kind.hours[0] + 1));
    out.push({
      id: `${kind.id}-${key}`, kind: kind.id, label: kind.label,
      at: ap.iata, city: ap.city, country: ap.country,
      from: start, to: start + hours * 3600_000, hours,
      closes: !!kind.closes, costFactor: kind.costFactor || 1, demand: kind.demand || 1,
      scope: kind.scope || "airport",
      text: kind.text.replace("{ort}", ap.city).replace("{iata}", ap.iata)
    });
  }
  return out;
}

/** Alle laufenden Ereignisse zu einem Zeitpunkt. */
export function activeEvents(ts) {
  const w = weekStart(ts);
  return [...eventsOfWeek(w - 7 * DAY), ...eventsOfWeek(w), ...eventsOfWeek(w + 7 * DAY)]
    .filter(e => ts >= e.from && ts < e.to);
}

/** Was in den nächsten Tagen ansteht – für die Anzeige. */
export function upcomingEvents(ts, days = 14) {
  const w = weekStart(ts);
  return [...eventsOfWeek(w), ...eventsOfWeek(w + 7 * DAY), ...eventsOfWeek(w + 14 * DAY)]
    .filter(e => e.to > ts && e.from < ts + days * DAY)
    .sort((a, b) => a.from - b.from);
}

/** Ist dieser Flughafen gerade dicht? Gibt das Ereignis zurück, sonst null. */
export function closureAt(iata, ts) {
  for (const e of activeEvents(ts)) {
    if (!e.closes) continue;
    if (e.scope === "country" ? AIRPORT_BY_IATA[iata]?.country === e.country : e.at === iata) return e;
  }
  return null;
}

/** Kosten- und Nachfragewirkung an einem Flughafen. */
export function effectsAt(iata, ts) {
  let cost = 1, demand = 1;
  const ap = AIRPORT_BY_IATA[iata];
  for (const e of activeEvents(ts)) {
    const hits = e.scope === "country" ? ap?.country === e.country : e.at === iata;
    if (!hits) continue;
    cost *= e.costFactor;
    demand *= e.demand;
  }
  return { cost, demand };
}

/**
 * Wann darf ein Flugzeug frühestens starten? Bei Sperrung wartet es bis zum Ende –
 * das ist die ehrlichste Abbildung: Der Flug fällt nicht aus, er geht später.
 */
export function departureNotBefore(iata, planned) {
  const c = closureAt(iata, planned);
  return c ? c.to : planned;
}

/**
 * Ausweichlandung. Deterministisch aus Flugzeug und Abflugzeit, Wahrscheinlichkeit aus EVENTS.divert.
 * Liefert Ausweichflughafen, Zusatzkosten und Verspätung – oder null.
 */
export function diversion(ac, toIata, dep, blockH) {
  if (rand01("divert", ac.id, dep) >= E.divert.chance) return null;
  const to = AIRPORT_BY_IATA[toIata];
  if (!to) return null;
  // Ausweichflughafen: der nächstgelegene andere Flughafen im Umkreis
  let best = null, bestD = Infinity;
  for (const a of AIRPORTS) {
    if (a.iata === toIata) continue;
    const d = Math.hypot((a.lon - to.lon) * Math.cos(to.lat * Math.PI / 180), a.lat - to.lat);
    if (d < bestD) { bestD = d; best = a; }
  }
  if (!best || bestD > 6) return null;
  const r = rand01("divertKind", ac.id, dep);
  const kind = r < 0.45 ? "technisch" : r < 0.8 ? "Wetter" : "medizinisch";
  const [a, b] = E.divert.delayMin;
  return {
    to: best.iata, city: best.city, kind,
    delayMin: Math.round(a + (b - a) * rand01("divertMin", ac.id, dep)),
    cost: Math.round(E.divert.baseCost * (1 + blockH * 0.25)),
    rep: E.divert.rep,
    text: kind === "technisch" ? `technischer Defekt – Ausweichlandung in ${best.city}`
      : kind === "Wetter" ? `Wetter unter Minimum – Ausweichlandung in ${best.city}`
      : `medizinischer Notfall an Bord – Ausweichlandung in ${best.city}`
  };
}
