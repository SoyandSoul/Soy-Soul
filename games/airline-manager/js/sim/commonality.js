// Flottenvereinheitlichung. Airlines, die nur eine Baureihe fliegen, sparen echtes Geld:
// ein gemeinsames Type Rating für die Piloten, ein Ersatzteillager, eine Schulung, einfachere Crew-Planung.
// Wer dagegen sieben verschiedene Muster betreibt, zahlt drauf.
//
// Reine Berechnung aus der Flotte – kein DOM, in Node testbar.

import { COMMONALITY as C } from "../core/config.js";
import { typeOf } from "./flight.js";

/** Verteilung der Flotte auf Baureihen (A320-Familie, 787, CRJ …). */
export function fleetFamilies(state) {
  const by = new Map();
  let total = 0;
  for (const ac of state.fleet) {
    if (ac.status === "crashed") continue;
    const f = typeOf(ac).family;
    by.set(f, (by.get(f) || 0) + 1);
    total++;
  }
  const list = [...by.entries()].map(([family, n]) => ({ family, n, share: total ? n / total : 0 }))
    .sort((a, b) => b.n - a.n);
  return { list, total, families: list.length, main: list[0] || null };
}

/**
 * Wirkung der Flottenstruktur.
 * share = Anteil der größten Baureihe (1 = reine Einheitsflotte).
 * Unterhalb von COMMONALITY.minFleet Flugzeugen passiert nichts – eine Flotte aus zwei
 * Maschinen ist zwangsläufig einheitlich, dafür gibt es keinen Bonus.
 */
export function commonality(state) {
  const f = fleetFamilies(state);
  const none = { ...f, share: 1, bonus: 0, penalty: 0, maint: 1, cockpit: 1, training: 1, active: false };
  if (f.total < C.minFleet) return none;

  const share = f.main.share;
  // Bonus wächst erst ab einer deutlichen Mehrheit, damit zwei gleiche Typen nicht schon alles bringen
  const bonus = Math.max(0, (share - 0.5) / 0.5);
  const extra = Math.max(0, f.families - C.penaltyFrom + 1);
  const penalty = Math.min(C.penaltyMax, extra * C.penaltyPerFamily);

  return {
    ...f, share, bonus, penalty, active: true,
    maint: 1 - C.maintBonus * bonus + penalty,
    cockpit: 1 - C.cockpitBonus * bonus + penalty,
    training: 1 - C.trainingBonus * bonus + penalty
  };
}

/** Kurztext für die Anzeige. */
export function commonalityNote(c) {
  if (!c.active) return "Ab drei Flugzeugen zählt die Flottenstruktur.";
  const pct = Math.round(c.share * 100);
  if (c.bonus > 0.6) return `Fast reine ${c.main.family}-Flotte (${pct} %) – ein Ersatzteillager, ein Type Rating, günstige Wartung.`;
  if (c.penalty > 0) return `${c.families} verschiedene Baureihen – jede kostet eigene Schulung, Ersatzteile und Crew-Planung.`;
  if (c.bonus > 0) return `${c.main.family} stellt ${pct} % der Flotte. Je einheitlicher, desto günstiger.`;
  return "Sehr gemischte Flotte – eine dominierende Baureihe würde Kosten sparen.";
}
