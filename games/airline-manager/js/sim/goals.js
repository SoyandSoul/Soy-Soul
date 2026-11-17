// Ziele und Meilensteine. Ohne sie gründet man eine Airline und spielt dann ins Leere –
// mit ihnen hat jede Sitzung ein nächstes Etappenziel.
//
// Jedes Ziel liefert einen Wert und ein Soll; daraus ergibt sich der Fortschritt von allein.
// Belohnungen sind bewusst klein und dauerhaft nützlich: Leasingrahmen, Einmalzahlung, Reputation.
// Reine Berechnung – das Freischalten passiert in sim/engine.js.

import { DAY } from "../core/config.js";
import { typeOf, routeDistance } from "./flight.js";
import { statement } from "./finance.js";
import { commonality } from "./commonality.js";
import { isLeased } from "./lease.js";

const alive = s => s.fleet.filter(a => a.status !== "crashed");
const owned = s => alive(s).filter(a => !isLeased(a));

/** reward: { cash, frame (dauerhafter Leasingrahmen), rep } */
export const GOALS = [
  // ---- Aufbau
  { id: "route1", group: "Aufbau", title: "Erste Strecke", hint: "Eröffne eine Strecke ab deinem Drehkreuz.", target: 1, value: s => s.routes.length, reward: { cash: 300e3 } },
  { id: "fly1", group: "Aufbau", title: "In der Luft", hint: "Stelle dein erstes Flugzeug in Dienst.", target: 1, value: s => alive(s).filter(a => a.status === "active").length, reward: { frame: 150e3 } },
  { id: "fleet3", group: "Aufbau", title: "Drei Flugzeuge", hint: "Bring deine Flotte auf drei Maschinen.", target: 3, value: s => alive(s).length, reward: { frame: 300e3 } },
  { id: "dest5", group: "Aufbau", title: "Fünf Ziele", hint: "Fliege fünf verschiedene Flughäfen an.", target: 5, value: s => s.stats.dest.length, reward: { frame: 400e3 } },

  // ---- Betrieb
  { id: "pax10k", group: "Betrieb", title: "10.000 Passagiere", hint: "Befördere 10.000 Gäste.", target: 10e3, value: s => s.stats.pax, reward: { cash: 500e3 } },
  { id: "pax100k", group: "Betrieb", title: "100.000 Passagiere", hint: "Befördere 100.000 Gäste.", target: 100e3, value: s => s.stats.pax, reward: { cash: 2e6 } },
  { id: "pax1m", group: "Betrieb", title: "Eine Million Passagiere", hint: "Befördere eine Million Gäste.", target: 1e6, value: s => s.stats.pax, reward: { frame: 2e6 } },
  { id: "punctual", group: "Betrieb", title: "Pünktlich", hint: "Sieben Tage ohne Verspätung über 30 Minuten.", target: 7,
    value: (s, now) => s.stats.legs < 20 ? 0 : Math.min(7, (now - (s.stats.lastBigDelay || s.created)) / DAY), reward: { rep: 4 } },
  { id: "techclean", group: "Betrieb", title: "Saubere Technik", hint: "30 Tage lang keinen Check überziehen.", target: 30,
    value: (s, now) => s.stats.legs < 20 ? 0 : Math.min(30, (now - (s.stats.lastOverdue || s.created)) / DAY), reward: { rep: 4 } },

  // ---- Flotte
  { id: "own1", group: "Flotte", title: "Erstes eigenes Flugzeug", hint: "Kaufe eine Maschine, statt sie zu leasen.", target: 1, value: s => owned(s).length, reward: { frame: 500e3 } },
  { id: "wide1", group: "Flotte", title: "Erster Großraumjet", hint: "Nimm ein Großraumflugzeug in die Flotte.", target: 1, value: s => alive(s).filter(a => typeOf(a).size !== "narrow").length, reward: { frame: 600e3 } },
  { id: "common", group: "Flotte", title: "Einheitsflotte", hint: "Mindestens fünf Flugzeuge, davon 90 % aus einer Baureihe.", target: 1,
    value: s => { const c = commonality(s); return alive(s).length >= 5 && c.share >= 0.9 ? 1 : 0; }, reward: { cash: 1e6 } },
  { id: "fleet10", group: "Flotte", title: "Zehn Flugzeuge", hint: "Bring deine Flotte auf zehn Maschinen.", target: 10, value: s => alive(s).length, reward: { frame: 1.5e6 } },

  // ---- Netz
  { id: "longhaul", group: "Netz", title: "Interkontinental", hint: "Bediene eine Strecke über 5.000 km.", target: 1,
    value: s => s.routes.some(r => routeDistance(r) > 5000 && s.fleet.some(a => a.ops?.routeId === r.id)) ? 1 : 0, reward: { cash: 1e6 } },
  { id: "dest15", group: "Netz", title: "Fünfzehn Ziele", hint: "Fliege fünfzehn verschiedene Flughäfen an.", target: 15, value: s => s.stats.dest.length, reward: { frame: 1.5e6 } },
  { id: "hub2", group: "Netz", title: "Zweites Drehkreuz", hint: "Eröffne eine zweite Basis.", target: 2, value: s => s.airline.hubs.length, reward: { cash: 2e6 } },

  // ---- Wirtschaft
  { id: "profit1m", group: "Wirtschaft", title: "Erste Million", hint: "Erreiche ein Betriebsergebnis von 1 Mio $ in 30 Tagen.", target: 1e6, value: (s, now) => statement(s, 30, now).profit, reward: { rep: 3 } },
  { id: "profit10m", group: "Wirtschaft", title: "Zehn Millionen", hint: "Erreiche ein Betriebsergebnis von 10 Mio $ in 30 Tagen.", target: 10e6, value: (s, now) => statement(s, 30, now).profit, reward: { frame: 3e6 } },
  { id: "rep70", group: "Wirtschaft", title: "Guter Ruf", hint: "Bring deine Reputation auf 70.", target: 70, value: s => s.airline.rep, reward: { frame: 1e6 } },
  { id: "rep85", group: "Wirtschaft", title: "Erstklassig", hint: "Bring deine Reputation auf 85.", target: 85, value: s => s.airline.rep, reward: { cash: 5e6 } }
];

export const GOAL_BY_ID = Object.fromEntries(GOALS.map(g => [g.id, g]));
export const GOAL_GROUPS = [...new Set(GOALS.map(g => g.group))];

/** Fortschritt aller Ziele, für die Anzeige. */
export function goalProgress(state, now) {
  const done = new Set(state.goals?.done || []);
  return GOALS.map(g => {
    const cur = done.has(g.id) ? g.target : Math.max(0, g.value(state, now) || 0);
    return { ...g, cur, done: done.has(g.id), pct: Math.max(0, Math.min(1, cur / g.target)) };
  });
}

/**
 * Das nächste sinnvolle Ziel. Zuerst die frühen Gruppen abarbeiten, darin das am weitesten
 * fortgeschrittene – sonst schlägt das Spiel einem Anfänger "Reputation 85" vor.
 */
export function nextGoal(state, now) {
  const open = goalProgress(state, now).filter(g => !g.done);
  if (!open.length) return null;
  const rank = g => GOAL_GROUPS.indexOf(g.group);
  return open.sort((a, b) => rank(a) - rank(b) || b.pct - a.pct)[0];
}

/** Welche Ziele sind seit dem letzten Mal neu erfüllt? Verändert den Spielstand nicht. */
export function newlyReached(state, now) {
  const done = new Set(state.goals?.done || []);
  return GOALS.filter(g => !done.has(g.id) && (g.value(state, now) || 0) >= g.target);
}

/** Belohnung gutschreiben. Gibt einen Text für die Meldung zurück. */
export function applyReward(state, reward) {
  const parts = [];
  if (reward.cash) { state.cash += reward.cash; parts.push(`${Math.round(reward.cash / 1e3)} k$`); }
  if (reward.frame) { state.airline.frameBonus = (state.airline.frameBonus || 0) + reward.frame; parts.push(`Leasingrahmen +${Math.round(reward.frame / 1e3)} k$/Monat`); }
  if (reward.rep) { state.airline.rep = Math.min(100, state.airline.rep + reward.rep); parts.push(`Reputation +${reward.rep}`); }
  return parts.join(" · ");
}

export const rewardText = r => [r.cash && `${Math.round(r.cash / 1e3)} k$`, r.frame && `Rahmen +${Math.round(r.frame / 1e3)} k$`, r.rep && `Ruf +${r.rep}`].filter(Boolean).join(" · ");
