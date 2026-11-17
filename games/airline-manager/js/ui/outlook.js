// Streckenbewertung als wiederverwendbarer Baustein – zeigt vor dem Zuweisen, ob eine Strecke
// das Flugzeug trägt. Nutzt sim/demand.js → routeOutlook.
import { html } from "./dom.js";
import { fmt } from "../core/util.js";
import { routeOutlook } from "../sim/demand.js";
import { typeOf } from "../sim/flight.js";

const WORD = { good: "Trägt", ok: "Knapp", bad: "Zu dünn" };

/** Kompakte Zeile: erwartete Auslastung und Empfehlung. ac = konkretes Flugzeug (optional). */
export function outlookLine(ctx, route, type, cfg = null, { extra = 1, compact = false } = {}) {
  const o = routeOutlook(ctx.state, route.from, route.to, type, cfg, ctx.now(), extra);
  const pct = Math.round(o.lf * 100);
  return html`<div class="outlook ${o.verdict} ${compact ? "compact" : ""}">
    <div class="row"><span class="pill ${o.verdict === "good" ? "good" : o.verdict === "ok" ? "warn" : "bad"}">${WORD[o.verdict]}</span>
      <span class="grow small">erwartete Auslastung <b>${pct} %</b></span>
      <span class="small muted">${fmt.int(o.bookable)} Gäste/Tag buchbar</span></div>
    <div class="bar"><i style="width:${Math.min(100, pct)}%;background:var(--${o.verdict === "good" ? "good" : o.verdict === "ok" ? "warn" : "bad"})"></i></div>
    ${compact ? "" : html`<p class="small muted">${o.note} Sinnvoll sind hier etwa <b>${o.capacity}</b> Flugzeuge dieses Typs${o.current > 0.05 ? html` – im Einsatz sind rechnerisch schon ${o.current.toFixed(1)} Abflüge je Richtung und Tag` : ""}.</p>`}
  </div>`;
}

/** Bewertung für ein konkretes Flugzeug auf einer Strecke. */
export const outlookFor = (ctx, route, ac, opts) => outlookLine(ctx, route, typeOf(ac), ac.cfg, opts);
