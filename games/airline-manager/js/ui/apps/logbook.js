// Logbuch: Ereignisse (Auslieferungen, Checks, Vorfälle) und die letzten Flüge mit Abrechnung.
import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { CABIN } from "../../core/config.js";

export default {
  id: "log", title: "Logbuch", icon: "log", width: 640,
  initialView: () => ({ tab: "events" }),

  render(ctx, v) {
    const s = ctx.state;
    const t = html`<div class="tabs">${[["events", "Ereignisse"], ["flights", "Flüge"]].map(([id, l]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${l}</button>`)}</div>`;
    if (v.tab === "flights") {
      if (!s.flights.length) return html`${t}<div class="empty"><b>Noch keine Flüge</b>Weise ein Flugzeug einer Strecke zu.</div>`;
      return html`${t}<table class="t"><thead><tr><th>Landung</th><th>Flug</th><th>Flugzeug</th><th class="r">Pax</th><th class="r">Auslastung</th><th class="r">Fracht</th><th class="r">Ergebnis</th></tr></thead><tbody>
        ${s.flights.map(f => html`<tr title="${CABIN.classes.map(c => `${CABIN.names[c]}: ${f.pax[c]}`).join(" · ")}">
          <td class="mono small">${fmt.dateTime(f.arr)}</td><td><b>${f.from}–${f.to}</b>${f.event ? html` <span class="pill ${f.event === "crash" ? "bad" : "warn"}">${f.event === "crash" ? "Absturz" : "Vorfall"}</span>` : ""}${f.delay ? html` <span class="pill warn" title="${f.delayReason}">+${f.delay} min</span>` : ""}</td>
          <td class="small">${f.reg} · ${f.type}</td><td class="r">${f.paxTotal}</td><td class="r">${Math.round(f.lf * 100)} %</td><td class="r">${fmt.dec(f.cargoKg / 1000)} t</td>
          <td class="r ${f.profit < 0 ? "bad" : "good"}">${fmt.money(f.profit)}</td></tr>`)}
      </tbody></table>`;
    }
    if (!s.log.length) return html`${t}<div class="empty"><b>Noch ruhig hier</b>Ereignisse deiner Airline erscheinen hier.</div>`;
    return html`${t}<ul class="log">${s.log.map(e => html`<li><time>${fmt.dateTime(e.t)}</time><span class="${e.kind === "bad" ? "bad" : e.kind === "warn" ? "warn" : ""}">${e.text}</span></li>`)}</ul>`;
  }
};
