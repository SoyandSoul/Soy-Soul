// Sonderlackierungen: Firmen mieten die Außenhaut eines Flugzeugs als Werbefläche.
//
// Das Flugzeug fliegt normal weiter und verdient normal – die Lackierung ist reines Zusatzgeschäft.
// Preis macht, wer gesehen wird: große Fläche, bekannte Airline, guter Ruf.
// Der Haken: die eigene Marke verschwindet unter fremden Farben. Jedes bemalte Flugzeug kostet Ruf.
//
// Wie überall ohne Server sind die Angebote eine reine Funktion der Woche und des Drehkreuzes.

import { ADLIVERY as A, DAY } from "../core/config.js";
import { rand01, clamp } from "../core/util.js";
import { typeOf } from "./flight.js";
import { awareness } from "./marketing.js";

const weekKey = ts => {
  const d = new Date(ts), day = (d.getUTCDay() + 6) % 7;       // Montag = 0
  return new Date(ts - day * DAY).toISOString().slice(0, 10);
};

const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

/** Tagessatz: Fläche × Bekanntheit × Ruf. */
export function dailyRate(state, ac, now) {
  const t = typeOf(ac);
  const aw = awareness(state, now), rep = state.airline.rep;
  const reach = A.reachMin + A.reachSpan * (0.65 * aw + 0.35 * rep) / 100;
  return Math.round(A.perSeatPerDay[t.size] * t.seatsMax * reach);
}

/** Die Angebote dieser Woche. Jedes nennt den Kunden, die Laufzeit und was es bringt. */
export function liveryOffers(state, now) {
  const hub = state.airline.hubs[0], key = weekKey(now);
  const out = [];
  const used = new Set(state.adlivery?.taken || []);
  const declined = new Set(state.adlivery?.declined || []);
  for (let i = 0; i < A.offersPerWeek; i++) {
    const seed = `${key}|${hub}|${i}`;
    const id = `al${key}${i}`;
    if (used.has(id) || declined.has(id)) continue;
    // Je Woche verschiedene Kunden: einmal würfeln, dann durchrotieren.
    const client = A.clients[(Math.floor(rand01("alClient", key) * A.clients.length) + i) % A.clients.length];
    const days = A.terms[Math.floor(rand01("alDays", seed) * A.terms.length) % A.terms.length];
    const bonus = 1 + A.haggle * (rand01("alPrice", seed) * 2 - 1);
    out.push({ id, client: client.name, branch: client.branch, colors: client.colors, days, bonus, until: new Date(key).getTime() + 7 * DAY });
  }
  return out;
}

/** Was dieses Angebot für dieses konkrete Flugzeug wert ist. */
export function quoteFor(state, offer, ac, now) {
  const perDay = Math.round(dailyRate(state, ac, now) * offer.bonus);
  return {
    perDay, days: offer.days,
    upfront: Math.round(perDay * A.upfrontDays),
    total: Math.round(perDay * (offer.days + A.upfrontDays)),
    paintH: A.paintHours[typeOf(ac).size]
  };
}

export function fitProblems(ac) {
  const p = [];
  if (ac.adLivery) p.push("Trägt bereits eine Sonderlackierung.");
  if (ac.status === "crashed" || ac.status === "delivery") p.push("Flugzeug ist nicht verfügbar.");
  if (ac.status === "charter") p.push("Fliegt gerade einen Charter.");
  return p;
}

export const candidates = (state, offer) => state.fleet.filter(ac => !fitProblems(ac).length);

export const activeLiveries = (state, now) => state.fleet.filter(ac => ac.adLivery && ac.adLivery.until > now);

/** Laufende Tageseinnahme aus allen Sonderlackierungen. */
export const liveryIncomePerDay = (state, now) =>
  activeLiveries(state, now).reduce((s, ac) => s + ac.adLivery.perDay, 0);

/** Rufabzug: fremde Farben verwässern die eigene Marke. */
export function liveryRep(state, now) {
  const n = activeLiveries(state, now).length;
  if (!n) return 0;
  const share = n / Math.max(1, state.fleet.filter(a => a.status !== "crashed").length);
  return -clamp(A.repPerAircraft * n * (0.5 + share), 0, A.repMax);
}
