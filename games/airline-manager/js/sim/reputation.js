// Reputation 0..100. Bewegt sich nach jedem Flug langsam auf einen Zielwert zu.
// Zielwert = Preisfairness + Gebühren + Bordservice + Schulung + Kabinenkomfort + Sicherheitsbilanz.

import { REPUTATION as R, CATERING, ONBOARD, BAGS, STAFF, CABIN, DAY } from "../core/config.js";
import { clamp } from "../core/util.js";
import { refFare } from "./demand.js";
import { seatUnits } from "./flight.js";
import { staffEffects } from "./staff.js";
import { handlerOf } from "./handling.js";
import { marketingRep } from "./marketing.js";
import { liveryRep } from "./adlivery.js";
import { hubRep } from "./hub.js";
import { fleetFitting } from "./fitting.js";

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
  f.bordservice = CATERING.modes[a.catering].rep + (ONBOARD.ranges[a.onboard]?.rep || 0);
  f.gepaeck = -Math.min(BAGS.repCap, a.bagFee * BAGS.repPerUsd);
  f.schulung = STAFF.training.rep[a.training];
  f.personal = staffEffects(state).repMalus;   // Unterbesetzung → Verspätungen, unzufriedene Gäste
  f.abfertigung = handlerOf(state).rep;        // wie zügig und sorgfältig am Boden gearbeitet wird
  f.bekanntheit = marketingRep(state, ts);     // wer bekannt ist, wird eher empfohlen
  f.sonderlack = liveryRep(state, ts);         // fremde Farben verwässern die eigene Marke
  f.drehkreuz = hubRep(state);                 // Gates und Lounges am eigenen Flughafen
  f.kabine = fleetFitting(state).rep;          // Sitzart und Unterhaltung an Bord
  f.sicherheit = decay(ts, a.safety.crashes, R.crash) + decay(ts, a.safety.incidents, R.incident);
  const last = Math.max(a.safety.since, ...a.safety.crashes, ...a.safety.incidents);
  f.unfallfrei = Math.min(R.safeBonusMax, (ts - last) / DAY / R.safeBonusPerDays);
  return f;
}

// Was jeder Baustein bedeutet und woran man drehen kann. Der Hinweis hängt davon ab,
// ob der Wert gerade schadet, nichts tut oder schon gut ist – sonst steht überall dasselbe.
const TIPS = {
  preis: {
    label: "Preisniveau",
    bad: "Die Tickets liegen deutlich über dem, was die Strecke hergibt. Preise senken oder mehr bieten.",
    mid: "Die Preise sind marktüblich. Wer unter dem Referenzpreis bleibt, gewinnt spürbar Ruf.",
    good: "Gäste empfinden die Preise als fair – das zieht."
  },
  komfort: { bestAtZero: true, label: "Sitzabstand",
    bad: "Die Kabine ist eng bestuhlt. Weniger Sitze oder mehr Premium bringt Ruf zurück.",
    mid: "Der Sitzabstand ist unauffällig.", good: "Der Sitzabstand ist in Ordnung." },
  bordservice: { label: "Bordservice",
    bad: "Buy on Board allein kommt schlecht an. Verpflegung einschließen oder das Sortiment aufwerten.",
    mid: "Der Bordservice ist Durchschnitt – ein besseres Sortiment wirkt sofort.",
    good: "Verpflegung und Sortiment an Bord werden gelobt." },
  gepaeck: { bestAtZero: true, label: "Gepäckgebühr",
    bad: "Die Gepäckgebühr ärgert die Gäste. Jeder Dollar weniger hebt den Ruf.",
    mid: "Die Gepäckgebühr liegt im üblichen Rahmen.", good: "Gepäck kostet fast nichts – das merken die Gäste." },
  schulung: { label: "Schulung",
    bad: "Ungeschultes Personal fällt auf.", mid: "Mehr Schulung kostet Gehalt, hebt aber Ruf und Sicherheit.",
    good: "Gut geschulte Crews, das sieht man im Ruf." },
  personal: { bestAtZero: true, label: "Personaldecke",
    bad: "Zu wenig Personal: Verspätungen und genervte Gäste. Offene Stellen besetzen.",
    mid: "Die Personaldecke trägt.", good: "Die Personaldecke trägt." },
  abfertigung: { label: "Bodenabfertigung",
    bad: "Der Sparanbieter am Boden kostet Pünktlichkeit und Ruf.",
    mid: "Standardabfertigung – Premium würde auffallen.", good: "Die schnelle Abfertigung kommt an." },
  bekanntheit: { label: "Bekanntheit",
    bad: "Kaum jemand kennt die Airline. Eine Kampagne ändert das.",
    mid: "Die Marke ist bekannt genug, um wahrgenommen zu werden.", good: "Der Name ist ein Begriff." },
  sonderlack: { bestAtZero: true, label: "Sonderlackierungen",
    bad: "Zu viele Flugzeuge in fremden Farben – die eigene Marke verschwindet.",
    mid: "Einzelne Werbemaschinen fallen kaum ins Gewicht.", good: "Alle Flugzeuge tragen die eigenen Farben." },
  sicherheit: { bestAtZero: true, label: "Sicherheitsbilanz",
    bad: "Vorfälle wiegen schwer und verblassen nur langsam. Wartung vor Auslastung.",
    mid: "Keine frischen Vorfälle.", good: "Keine Vorfälle." },
  unfallfrei: { label: "Unfallfreie Zeit",
    bad: "", mid: "Je länger nichts passiert, desto mehr zählt es.", good: "Lange unfallfrei – das zahlt sich aus." }
};

/** Bausteine mit Erklärung und Hinweis, sortiert nach dem, was am meisten schadet. */
export function repBreakdown(state, ts, leg = null) {
  const f = repFactors(state, ts, leg);
  return Object.entries(f).map(([key, value]) => {
    const t = TIPS[key] || { label: key, bad: "", mid: "", good: "" };
    // Bei manchen Bausteinen ist 0 schon das Beste, was geht – dann nicht nach Verbesserung klingen.
    const tip = value < -0.5 ? t.bad : (value > 1.5 || (t.bestAtZero && value >= -0.5)) ? t.good : t.mid;
    return { key, label: t.label, value, tip };
  }).sort((a, b) => a.value - b.value);
}

/** Der eine Hebel, der gerade am meisten bringt. */
export function repAdvice(state, ts) {
  const worst = repBreakdown(state, ts).find(b => b.value < 0 && b.tip);
  return worst || null;
}

export function repTarget(state, ts, leg) {
  return clamp(R.start + Object.values(repFactors(state, ts, leg)).reduce((s, v) => s + v, 0), 0, 100);
}

export function updateRep(state, ts, leg) {
  const a = state.airline;
  a.rep = clamp(a.rep + (repTarget(state, ts, leg) - a.rep) * R.ema, 0, 100);
}
