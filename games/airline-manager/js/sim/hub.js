// Drehkreuz-Ausbau: was eine Airline an ihrer eigenen Basis besitzt.
//
// Vier Bereiche, jeder in Stufen ausbaubar. Gebaut wird einmal (Investition), danach läuft
// ein Unterhalt pro Tag – die Stufe darüber lohnt sich also erst ab einer gewissen Größe.
//
//   Gates    – kürzere Standzeit und zufriedenere Gäste, aber nur am eigenen Drehkreuz
//   Lounge   – Ruf und mehr Nachfrage in den vorderen Klassen
//   Hangar   – Checks laufen schneller und billiger, Technikerkosten sinken
//   Tanklager – liegt in sim/fuel.js, hier nur mit aufgeführt
//
// Alles hängt am einzelnen Flughafen (state.hub[IATA]), nicht an der Airline: Wer ein zweites
// Drehkreuz eröffnet, fängt dort wieder bei null an.

import { HUB, CABIN } from "../core/config.js";
import { clamp } from "../core/util.js";

export const AREAS = ["gates", "lounge", "hangar"];

/** Ausbaustand eines Flughafens – fehlt der Eintrag, ist alles auf Stufe 0. */
export function hubState(state, iata) {
  return (state.hub?.[iata]) || { gates: 0, lounge: 0, hangar: 0 };
}

export const levelOf = (state, iata, area) => hubState(state, iata)[area] || 0;
export const stageOf = (area, level) => HUB[area].stages[clamp(level, 0, HUB[area].stages.length - 1)];
export const stage = (state, iata, area) => stageOf(area, levelOf(state, iata, area));

export const isHub = (state, iata) => state.airline.hubs.includes(iata);

/** Nächste Ausbaustufe mit Preis – oder null, wenn alles gebaut ist. */
export function nextStage(state, iata, area) {
  const lvl = levelOf(state, iata, area), list = HUB[area].stages;
  if (lvl >= list.length - 1) return null;
  return { level: lvl + 1, ...list[lvl + 1] };
}

/** Unterhalt aller Drehkreuze pro Tag. */
export function upkeepPerDay(state) {
  let sum = 0;
  for (const iata of state.airline.hubs)
    for (const area of AREAS) sum += stage(state, iata, area).upkeep || 0;
  return sum;
}

/**
 * Standzeitfaktor an einem Flughafen. Außerhalb der eigenen Drehkreuze zählt nur der Abfertiger,
 * drinnen kommt die eigene Infrastruktur dazu.
 */
export function gateFactor(state, iata) {
  return isHub(state, iata) ? stage(state, iata, "gates").turnaround : 1;
}

/** Wie oft der Abfertiger am eigenen Drehkreuz trotzdem noch zu spät ist. */
export function delayFactor(state, iata) {
  return isHub(state, iata) ? stage(state, iata, "gates").delay : 1;
}

/** Rufbeitrag aus Gates und Lounges, gemittelt über die Drehkreuze. */
export function hubRep(state) {
  const hubs = state.airline.hubs;
  if (!hubs.length) return 0;
  let sum = 0;
  for (const iata of hubs) sum += stage(state, iata, "gates").rep + stage(state, iata, "lounge").rep;
  return sum / hubs.length;
}

/** Nachfrageaufschlag je Klasse aus der Lounge – wirkt nur vorne. */
export function loungeFactor(state, cls) {
  const hubs = state.airline.hubs;
  if (!hubs.length || cls === "y") return 1;
  let sum = 0;
  for (const iata of hubs) sum += stage(state, iata, "lounge").premium;
  const avg = sum / hubs.length;
  return 1 + (avg - 1) * (CABIN.classes.indexOf(cls) <= 1 ? 1 : 0.5);   // F und J voll, Premium halb
}

/** Beste Werft der Airline – dort laufen die Checks. */
export function bestHangar(state) {
  let best = stageOf("hangar", 0), level = 0, where = null;
  for (const iata of state.airline.hubs) {
    const lvl = levelOf(state, iata, "hangar");
    if (lvl > level) { level = lvl; best = stageOf("hangar", lvl); where = iata; }
  }
  return { ...best, level, where };
}

/**
 * Die Werft arbeitet nur so viele Flugzeuge ab, wie sie Plätze hat. Darüber hinaus wird
 * zugekauft, der Vorteil verwässert also mit wachsender Flotte.
 */
export function hangarEffect(state) {
  const h = bestHangar(state);
  const fleet = state.fleet.filter(a => a.status !== "crashed").length || 1;
  const covered = clamp((h.slots || 0) / fleet, 0, 1);
  return {
    level: h.level, label: h.label, where: h.where, slots: h.slots || 0, covered,
    downH: 1 - (1 - h.downH) * covered,
    cost: 1 - (1 - h.cost) * covered,
    techs: 1 - (1 - h.techs) * covered
  };
}

/** Kurzer Satz, was der nächste Ausbau bringt – für die Oberfläche. */
export function upgradeNote(area, from, to) {
  if (area === "gates") return `Standzeit ${Math.round(to.turnaround * 100)} % statt ${Math.round(from.turnaround * 100)} %, Verspätungsrisiko ${Math.round(to.delay * 100)} %`;
  if (area === "lounge") return `Ruf +${to.rep} statt +${from.rep}, Nachfrage vorne ${Math.round((to.premium - 1) * 100)} %`;
  return `Checkdauer ${Math.round(to.downH * 100)} %, Checkkosten ${Math.round(to.cost * 100)} %, bis ${to.slots} Flugzeuge`;
}
