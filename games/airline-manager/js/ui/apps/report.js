// Flugabrechnung: was die zuletzt beendeten Flüge gebracht haben, je Flug aufklappbar,
// dazu die Bewertung jeder Strecke. Öffnet sich nach einem Sammelstart und über die Abflugliste.

import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { DAY } from "../../core/config.js";
import { REV, COST } from "../../sim/ledger.js";
import { tally, legsSince, routeReport } from "../../sim/report.js";
import { typeOf } from "../../sim/flight.js";

const PERIODS = [["6", "6 Stunden", 0.25], ["24", "24 Stunden", 1], ["7", "7 Tage", 7]];
const stars = n => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

export default {
  id: "report", title: "Flugabrechnung", icon: "finance", width: 640,
  initialView: () => ({ tab: "24", flight: null }),

  render(ctx, v) {
    const now = ctx.now(), days = (PERIODS.find(p => p[0] === v.tab) || PERIODS[1])[2];
    const legs = legsSince(ctx.state, now - days * DAY);
    const t = tally(legs);
    return html`
      <div class="tabs">${PERIODS.map(([id, label]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${label}</button>`)}</div>
      ${!t ? html`<div class="empty"><b>Noch keine abgerechneten Flüge</b>Sobald ein Flug landet, steht er hier mit allen Zahlen.</div>`
      : html`
        <div class="grid3">
          <div class="card stat"><span>Umsatz</span><b class="good">${fmt.money(t.revTotal)}</b></div>
          <div class="card stat"><span>Kosten</span><b>${fmt.money(t.costTotal)}</b></div>
          <div class="card stat"><span>Ergebnis</span><b class="${t.profit < 0 ? "bad" : "good"}">${t.profit >= 0 ? "+" : ""}${fmt.money(t.profit)}</b></div>
        </div>
        <div class="row wrap small muted" style="margin-top:8px">
          <span>${t.legs} Flüge</span><span>·</span><span>${fmt.int(t.pax)} Passagiere</span><span>·</span>
          <span>Ø Auslastung <b class="${t.lf < 0.6 ? "warn" : "good"}">${Math.round(t.lf * 100)} %</b></span><span>·</span>
          <span>pünktlich <b class="${t.onTime < 0.8 ? "warn" : "good"}">${Math.round(t.onTime * 100)} %</b></span>
          ${t.events ? html`<span>·</span><span class="bad">${t.events} Vorfälle</span>` : ""}
          <span>·</span><span>Marge <b>${Math.round(t.margin * 100)} %</b></span>
        </div>

        <h3 class="rep-h">Woher das Geld kam</h3>
        <div class="grid2">
          <div class="card"><b class="small">Einnahmen</b><table class="t"><tbody>
            ${Object.entries(t.rev).sort((a, b) => b[1] - a[1]).map(([k, val]) => html`<tr><td>${REV[k] || k}</td><td class="r">${fmt.money(val)}</td></tr>`)}</tbody></table></div>
          <div class="card"><b class="small">Ausgaben</b><table class="t"><tbody>
            ${Object.entries(t.cost).sort((a, b) => b[1] - a[1]).map(([k, val]) => html`<tr><td>${COST[k] || k}</td><td class="r">${fmt.money(val)}</td></tr>`)}</tbody></table></div>
        </div>

        <h3 class="rep-h">Bewertung der Strecken</h3>
        ${routes(ctx, now, days)}

        <h3 class="rep-h">Einzelne Flüge</h3>
        ${legs.slice(0, 40).map(l => flightRow(ctx, v, l))}
        ${legs.length > 40 ? html`<p class="small muted" style="margin-top:8px">Ältere Flüge stehen im Logbuch.</p>` : ""}`}`;
  },

  click(ctx, v, api) {
    return {
      flight: el => { v.flight = v.flight === el.dataset.k ? null : el.dataset.k; api.rerender(); },
      route: el => { ctx.highlight(el.dataset.id); api.open("routes", { detail: el.dataset.id }); }
    };
  }
};

function routes(ctx, now, days) {
  const list = routeReport(ctx.state, now, Math.max(7, days));
  if (!list.length) return html`<p class="small muted">Noch zu wenige Flüge für eine Bewertung.</p>`;
  return html`${list.map(({ route, rating }) => html`
    <div class="rrow">
      <div class="row"><button class="rlink" data-act="route" data-id="${route.id}"><b>${route.from} ⇄ ${route.to}</b></button>
        <span class="rstars" title="${rating.stars} von 5">${stars(rating.stars)}</span>
        <span class="grow small muted">${rating.legs} Flüge</span>
        <b class="${rating.profit < 0 ? "bad" : "good"}">${fmt.money(rating.profit)}</b></div>
      <div class="rparts">${rating.parts.map(p => html`<span><i style="width:${Math.round(p.score * 100)}%;background:var(--${p.score > 0.66 ? "good" : p.score > 0.33 ? "warn" : "bad"})"></i>${p.key} <b>${p.text}</b></span>`)}</div>
      <p class="small muted">${rating.hint}</p>
    </div>`)}`;
}

function flightRow(ctx, v, l) {
  const k = l.acId + ":" + l.t, open = v.flight === k;
  const late = l.delay >= 15;
  return html`<div class="fl ${open ? "open" : ""} ${l.event ? "ev" : ""}">
    <button class="fl-head" data-act="flight" data-k="${k}">
      <span class="fl-route"><b>${l.from} → ${l.to}</b><small>${l.reg} · ${fmt.time(l.t)}</small></span>
      <span class="small ${l.lf < 0.6 ? "warn" : ""}">${Math.round(l.lf * 100)} %</span>
      <span class="small">${l.paxTotal} Gäste</span>
      ${late ? html`<span class="pill warn">+${l.delay}′</span>` : ""}
      ${l.event ? html`<span class="pill bad">${l.event === "crash" ? "Absturz" : l.event === "fault" ? "Defekt" : "Vorfall"}</span>` : ""}
      <b class="${l.profit < 0 ? "bad" : "good"}">${l.profit >= 0 ? "+" : ""}${fmt.money(l.profit)}</b>
    </button>
    ${open ? html`<div class="fl-body">
      <div class="grid2">
        <dl class="kv"><dt>Flugzeug</dt><dd>${l.type}</dd><dt>Strecke</dt><dd>${fmt.km(l.km)} · ${fmt.hours(l.blockH)}</dd>
          <dt>Sitze</dt><dd>${l.paxTotal} von ${l.seats}</dd><dt>Fracht</dt><dd>${fmt.int(l.cargoKg)} kg</dd>
          ${l.delay ? html`<dt>Verspätung</dt><dd class="warn">${l.delay} min wegen ${l.delayReason || "Verzug"}</dd>` : ""}</dl>
        <dl class="kv"><dt>Kerosin</dt><dd>${fmt.int(l.fuelKg)} kg</dd><dt>Crew</dt><dd>${l.pilots} + ${l.cabin}</dd>
          <dt>Umsatz</dt><dd class="good">${fmt.money(Object.values(l.rev).reduce((s, x) => s + x, 0))}</dd>
          <dt>Kosten</dt><dd>${fmt.money(Object.values(l.cost).reduce((s, x) => s + x, 0))}</dd></dl>
      </div>
      <div class="fl-bars">
        ${Object.entries(l.cost).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, val]) =>
          html`<span>${COST[c] || c} <b>${fmt.money(val)}</b></span>`)}
      </div>
    </div>` : ""}
  </div>`;
}
