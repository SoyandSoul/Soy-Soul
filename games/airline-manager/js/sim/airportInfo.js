// Was man über einen Flughafen wissen will, bevor man ihn anfliegt.
//
// Alles aus vorhandenen Daten abgeleitet, nichts zusätzlich gespeichert: Größe und Einzugsgebiet
// aus der Flughafendatenbank, Wetterneigung aus sim/weather.js, Pünktlichkeit und Ertrag aus den
// eigenen Flügen. Was man selbst noch nie geflogen ist, steht als Einschätzung da, nicht als Fakt.

import { AIRPORT_BY_IATA, AIRPORTS } from "../data/airports.js";
import { FEES, DAY } from "../core/config.js";
import { weatherAt } from "./weather.js";
import { distanceKm } from "./geo.js";
import { dailyMarket, classSplit, refFare } from "./demand.js";
import { runwaysFor } from "../data/runways.js";
import { effectiveRange } from "./flight.js";

const typeRange = ac => { try { return effectiveRange(ac); } catch { return 0; } };

/** Wetterneigung: Anteil der Stunden mit Störung, über ein Jahr abgetastet. */
export function weatherShare(iata, now) {
  let bad = 0, n = 0;
  for (let d = 0; d < 365; d += 7) {
    for (const h of [6, 12, 18]) {
      const w = weatherAt(iata, now + d * DAY + h * 3600_000);
      n++;
      if (w && w.sev > 0.35) bad++;
    }
  }
  return n ? bad / n : 0;
}

/** Eigene Zahlen für diesen Flughafen aus dem Flugbuch. */
export function ownStats(state, iata, now, days = 14) {
  const since = now - days * DAY;
  const legs = state.flights.filter(f => (f.from === iata || f.to === iata) && f.arr >= since);
  if (!legs.length) return null;
  const onTime = legs.filter(f => (f.delay || 0) < 15).length / legs.length;
  const pax = legs.reduce((a, f) => a + f.paxTotal, 0);
  const profit = legs.reduce((a, f) => a + f.profit, 0);
  const lf = legs.reduce((a, f) => a + f.lf, 0) / legs.length;
  return { legs: legs.length, onTime, pax, profit, lf, perLeg: profit / legs.length };
}

/**
 * Ziele mit der höchsten Nachfrage – aber nur solche, die die eigene Flotte auch erreicht.
 * Ein Vorschlag nach Tokio hilft niemandem, der drei A320 hat.
 */
export function bestRoutes(iata, now, limit = 3, maxKm = Infinity) {
  const a = AIRPORT_BY_IATA[iata];
  if (!a) return [];
  return AIRPORTS
    .filter(b => b.iata !== iata)
    .map(b => {
      const km = Math.round(distanceKm(a, b));
      const m = dailyMarket(iata, b.iata, now, km);
      const split = classSplit(m.bizAvg, km);
      // Grober Tagesertrag des Gesamtmarkts – nur zum Sortieren, keine Prognose
      const yieldPerPax = refFare(km, "y") * (1 + split.j * 2.6 + split.f * 5);
      return { to: b.iata, city: b.city, km, market: Math.round(m.total), score: m.total * yieldPerPax };
    })
    .filter(x => x.km > 250 && x.km <= maxKm)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** Ein kurzer Steckbrief in Sätzen. */
export function describe(state, iata, now) {
  const a = AIRPORT_BY_IATA[iata];
  if (!a) return null;
  const rw = runwaysFor(a);
  const wx = weatherShare(iata, now);
  const own = ownStats(state, iata, now);
  const fee = FEES.landingPerT[a.tier];

  const size = a.tier >= 5 ? "Drehkreuz der ersten Reihe" : a.tier === 4 ? "großer Verkehrsflughafen"
    : a.tier === 3 ? "mittlerer Verkehrsflughafen" : a.tier === 2 ? "Regionalflughafen" : "kleiner Platz";
  const profile = a.biz > 0.65 ? "stark geschäftlich geprägt"
    : a.tour > 0.65 ? "fast reiner Ferienverkehr"
    : a.biz > a.tour ? "überwiegend Geschäftsreise" : "überwiegend Urlaubsverkehr";
  const wxText = wx > 0.22 ? "Wetterstörungen sind hier häufig"
    : wx > 0.12 ? "mit Wetterstörungen ist regelmäßig zu rechnen"
    : "das Wetter spielt meistens mit";
  const feeText = fee >= 6 ? "Die Gebühren sind hoch" : fee >= 4 ? "Die Gebühren liegen im Mittelfeld" : "Die Gebühren sind günstig";

  // Reichweite der eigenen Flotte – ohne Flugzeuge eine vernünftige Kurzstreckenannahme
  const reach = state.fleet.filter(x => x.status !== "crashed")
    .reduce((m, x) => Math.max(m, typeRange(x)), 0) || 4000;

  const lines = [
    `${a.city} ist ein ${size} mit rund ${a.pop.toFixed(1).replace(".", ",")} Mio Menschen im Einzugsgebiet, ${profile}.`,
    `Die längste Bahn misst ${a.runwayM} m${rw.guessed ? "" : `, die Hauptrichtung ist die ${rwName(rw.hdg[0])}`}. ${feeText}, und ${wxText}.`
  ];
  if (own) {
    lines.push(`Eure eigenen ${own.legs} Flüge der letzten zwei Wochen waren zu ${Math.round(own.onTime * 100)} % pünktlich bei ${Math.round(own.lf * 100)} % Auslastung und ${Math.round(own.perLeg / 1000)} k$ Ergebnis je Flug.`);
  }
  return { lines, wx, own, tier: a.tier, fee, reach, routes: bestRoutes(iata, now, 3, reach * 0.95) };
}

function rwName(hdg) {
  const a = Math.round(hdg / 10) % 36 || 36, b = (a + 18) % 36 || 36;
  const p = n => String(n).padStart(2, "0");
  return `${p(a)}/${p(b)}`;
}
