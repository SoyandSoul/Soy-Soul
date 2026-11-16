// Datenblatt eines Flugzeugtyps mit Untergruppen (Abmessungen, Gewichte, Leistung, Antrieb, Kabine, Geschichte, Betrieb).
// Reine Anzeige – die Werte kommen aus data/aircraft.js (Balance) und dessen info-Block (Realdaten).
import { html, raw } from "./dom.js";
import { fmt } from "../core/util.js";
import { FLIGHT, CHECKS } from "../core/config.js";
import { listPrice } from "../sim/market.js";
import { condEffects } from "../sim/market.js";

const n = (v, unit = "", d = 0) => v == null ? "–" : (d ? fmt.dec(v) : fmt.int(v)) + (unit ? " " + unit : "");

/** Gruppen für ein Typ-Datenblatt. ac (optional) = konkretes Flugzeug → Zustand/Zusatztank fließen ein. */
export function datasheetGroups(t, ac = null) {
  const i = t.info || {};
  const eff = condEffects(ac?.cond);
  const isProp = /Turboprop/i.test(i.engine || "");
  const range = t.rangeKm * (1 + FLIGHT.aux.rangeBonus * (ac?.aux || 0)) * (1 + eff.range);
  const fuel = t.fuelKgH * (1 + eff.fuel);
  return [
    ["Abmessungen", [
      ["Länge", n(t.art.lengthM, "m", 1)], ["Spannweite", n(t.art.spanM, "m", 1)], ["Höhe", n(i.heightM, "m", 1)],
      ["Flügelfläche", n(i.wingM2, "m²", 1)], ["Größenklasse", { narrow: "Schmalrumpf", wide: "Großraum", jumbo: "Jumbo" }[t.size]]
    ]],
    ["Gewichte & Tank", [
      ["Leergewicht (OEW)", n(i.oewT, "t", 1)], ["Max. Abfluggewicht (MTOW)", n(t.mtowT, "t", 1)],
      ["Max. Nutzlast", n(t.payloadKg / 1000, "t", 1)], ["Tankinhalt", n(i.fuelL, "l")]
    ]],
    ["Leistung", [
      ["Reisegeschwindigkeit", n(t.cruiseKmh, "km/h")], ["Höchstgeschwindigkeit", i.vmaxKmh ? `${n(i.vmaxKmh, "km/h")}${i.vmaxMach ? ` (Mach ${fmt.dec(i.vmaxMach)})` : ""}` : "–"],
      ["Dienstgipfelhöhe", i.ceilingFt ? `${n(i.ceilingFt, "ft")} (${n(Math.round(i.ceilingFt * 0.3048), "m")})` : "–"],
      ["Reichweite", n(Math.round(range), "km") + (ac && (ac.aux || eff.range) ? " *" : "")], ["Startstrecke (MTOW)", n(t.runwayM, "m")]
    ]],
    ["Antrieb", [
      ["Triebwerke", `${t.art.engines}× ${i.engine || "–"}`], [isProp ? "Leistung je Triebwerk" : "Schub je Triebwerk", i.thrustKN ? (isProp ? n(i.thrustKN, "kW") : n(i.thrustKN, "kN")) : "–"],
      ["Verbrauch (Block)", n(Math.round(fuel), "kg/h") + (eff.fuel ? " *" : "")]
    ]],
    ["Kabine & Crew", [
      ["Typische Bestuhlung", n(t.seats, "Sitze")], ["Max. Sitze (Zulassung)", n(t.seatsMax)],
      ["Cockpit", `${t.crew.pilots} Piloten`], ["Kabine (Minimum)", t.crew.cabin ? `${t.crew.cabin} Flugbegleiter` : "keine vorgeschrieben"], ["Techniker je Flugzeug", n(t.crew.techs)]
    ]],
    ["Geschichte", [
      ["Hersteller", t.maker], ["Baureihe", t.family], ["Erstflug", i.firstFlight ?? "–"], ["Indienststellung", i.eis ?? "–"],
      ["Status", t.inProd ? "in Produktion" : "nur gebraucht (Produktion beendet)"]
    ]],
    ["Wirtschaft", [
      ["Listenpreis", fmt.money(listPrice(t))], ["Wartungsreserve", `$${fmt.int(t.maintFH)} je Flugstunde`],
      ["Turnaround", `${FLIGHT.turnaroundMin[t.size]} min`], ["A-Check", `alle ${CHECKS.A.fh} FH / ${CHECKS.A.days} Tage`], ["C-Check", `alle ${CHECKS.C.fh} FH / ${Math.round(CHECKS.C.days / 365)} Jahre`]
    ]]
  ];
}

/** Ausklappbares Datenblatt. open = welche Gruppen zu Beginn offen sind. */
export function datasheet(t, ac = null, { open = [], compact = false } = {}) {
  const groups = datasheetGroups(t, ac);
  const note = t.info?.note ? html`<p class="ds-note">${t.info.note}</p>` : "";
  const star = ac && (ac.aux || condEffects(ac.cond).range || condEffects(ac.cond).fuel) ? html`<p class="small muted">* inkl. Zusatztank bzw. Zustand dieses Flugzeugs</p>` : "";
  return html`<div class="ds ${compact ? "compact" : ""}">${note}
    ${groups.map(([title, rows]) => html`<details ${open.includes(title) ? "open" : ""}><summary>${title}</summary>
      <dl class="kv">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl></details>`)}
    ${star}</div>`;
}

/** Kurze Zustandszeile für gebrauchte Flugzeuge: Zustand in %, Auswirkungen. */
export function condLine(cond) {
  if (cond == null) return html`<span class="pill good">Neu ab Werk</span>`;
  const e = condEffects(cond), pct = Math.round(cond * 100);
  const cls = pct >= 85 ? "good" : pct >= 65 ? "warn" : "bad";
  const parts = [];
  if (e.range) parts.push(`${Math.round(e.range * 100)} % Reichweite`);
  if (e.fuel) parts.push(`+${Math.round(e.fuel * 100)} % Verbrauch`);
  if (e.faultPerBlockH) parts.push(`Defekte ~${(e.faultPerBlockH * 100).toFixed(1)} %/Blockstunde`);
  return html`<span class="pill ${cls}">Zustand ${pct} %</span>${parts.length ? html` <span class="small muted">${parts.join(" · ")}</span>` : ""}`;
}
