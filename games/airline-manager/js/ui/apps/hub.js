// Drehkreuz: was die Airline an ihrer eigenen Basis besitzt und was der nächste Ausbau bringt.
// Ein Reiter je Drehkreuz; das Tanklager steht mit dabei, weil es dieselbe Frage beantwortet.

import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { HUB, FUEL } from "../../core/config.js";
import * as act from "../../sim/actions.js";
import { upgradeDepot } from "../../sim/fuel.js";
import { AREAS, levelOf, stage, nextStage, upkeepPerDay, hangarEffect, upgradeNote } from "../../sim/hub.js";
import { AIRPORT_BY_IATA } from "../../data/airports.js";
import { depotCapKg } from "../../sim/fuel.js";

export default {
  id: "hub", title: "Drehkreuz", icon: "gate", width: 620,
  initialView: () => ({ tab: null }),

  render(ctx, v) {
    const s = ctx.state;
    const iata = s.airline.hubs.includes(v.tab) ? v.tab : s.airline.hubs[0];
    v.tab = iata;
    const ap = AIRPORT_BY_IATA[iata];
    const he = hangarEffect(s);
    return html`
      ${s.airline.hubs.length > 1 ? html`<div class="tabs">${s.airline.hubs.map(h =>
        html`<button data-act="tab" data-tab="${h}" aria-selected="${String(h === iata)}">${h}</button>`)}</div>` : ""}

      <div class="card row">
        <div class="grow"><b>${ap.city} · ${iata}</b>
          <div class="small muted">Größe ${ap.tier} von 5 · längste Bahn ${fmt.int(ap.runwayM)} m · ${fmt.int(ap.pop * 10) / 10} Mio Einzugsgebiet</div></div>
        <div class="r"><div class="small muted">Unterhalt</div><b>${fmt.money(upkeepPerDay(s))}/Tag</b></div>
      </div>

      ${AREAS.map(area => block(ctx, iata, area))}

      <h3 class="rep-h">Tanklager</h3>
      <div class="card">
        <div class="row"><div class="grow"><b>${FUEL.depot[s.fuel.depot].capT} t Kapazität</b>
          <div class="small muted">Vorrat ${Math.round(s.fuel.stockKg / 1000)} t · Ein volles Lager schützt vor Preisspitzen,
            ein leeres zahlt ${Math.round(FUEL.spotPremium * 100)} % Aufschlag am Spotmarkt.</div></div>
          ${FUEL.depot[s.fuel.depot + 1]
            ? html`<button class="btn sm p" data-act="depot">${FUEL.depot[s.fuel.depot + 1].capT} t · ${fmt.money(FUEL.depot[s.fuel.depot + 1].price)}</button>`
            : html`<span class="pill good">Endausbau</span>`}</div>
        <div class="track aw" style="margin-top:8px"><i style="width:${Math.min(100, s.fuel.stockKg / depotCapKg(s) * 100)}%"></i></div>
      </div>

      ${he.level && he.covered < 1 ? html`<p class="small warn" style="margin-top:10px">
        Die ${he.label} ist auf ${he.slots} Flugzeuge ausgelegt, die Flotte ist größer –
        der Vorteil wirkt derzeit zu ${Math.round(he.covered * 100)} %, der Rest wird zugekauft.</p>` : ""}`;
  },

  click(ctx, v, api) {
    return {
      tab: el => { v.tab = el.dataset.tab; api.rerender(); },
      build: el => {
        const r = ctx.run(act.upgradeHub, el.dataset.iata, el.dataset.area, ctx.now());
        if (r) { ctx.toast(`${r.stage.label} gebaut.`, "good"); api.rerender(); }
      },
      depot: () => { const r = ctx.run(upgradeDepot); if (r) { ctx.toast("Tanklager vergrößert.", "good"); api.rerender(); } }
    };
  }
};

function block(ctx, iata, area) {
  const s = ctx.state, cfg = HUB[area];
  const lvl = levelOf(s, iata, area), cur = stage(s, iata, area), next = nextStage(s, iata, area);
  return html`
    <h3 class="rep-h">${cfg.label}</h3>
    <div class="card">
      <div class="row"><div class="grow"><b>${cur.label}</b> <span class="pill">Stufe ${lvl}</span>
        <div class="small muted">${cur.note}</div></div>
        ${cur.upkeep ? html`<div class="r small muted">${fmt.money(cur.upkeep)}<br>pro Tag</div>` : ""}</div>
      <div class="steps">${cfg.stages.map((st, i) => html`<i class="${i <= lvl ? "on" : ""}" title="${st.label}"></i>`)}</div>
      ${next ? html`<div class="row" style="margin-top:10px;align-items:center">
        <div class="grow small"><b>Nächste Stufe: ${next.label}</b>
          <div class="muted">${upgradeNote(area, cur, next)}</div>
          <div class="muted">Unterhalt ${fmt.money(next.upkeep)} am Tag</div></div>
        <button class="btn sm p" data-act="build" data-iata="${iata}" data-area="${area}"
          ${s.cash < next.price ? "disabled" : ""}>${fmt.money(next.price)}</button></div>`
      : html`<p class="small good" style="margin-top:8px">Höchste Stufe erreicht.</p>`}
    </div>`;
}
