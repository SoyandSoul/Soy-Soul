// Rangliste: Spielercode + Airline-Name, sortiert nach Aktienkurs bzw. Unternehmenswert.
import { html } from "../dom.js";
import { fmt } from "../../core/util.js";

export default {
  id: "board", title: "Rangliste", icon: "board", width: 560,
  initialView: () => ({ sort: "price" }),

  render(ctx, v) {
    const s = ctx.state, list = [...ctx.listings()].sort((a, b) => (b[v.sort] ?? 0) - (a[v.sort] ?? 0));
    const myRank = list.findIndex(l => l.code === s.player.code) + 1;
    return html`<div class="row" style="margin-bottom:10px"><div class="grow"><b style="font:700 22px var(--display)">Platz ${myRank || "–"}</b> <span class="muted small">von ${list.length}</span></div>
      <select class="in" data-act="sort"><option value="price" ${v.sort === "price" ? "selected" : ""}>Aktienkurs</option><option value="fleet" ${v.sort === "fleet" ? "selected" : ""}>Flottengröße</option><option value="rep" ${v.sort === "rep" ? "selected" : ""}>Reputation</option></select></div>
      ${ctx.market.demo ? html`<p class="small warn" style="margin-bottom:8px">Demo-Daten – echte Spieler erscheinen, sobald das Backend eingerichtet ist.</p>` : ""}
      <table class="t"><thead><tr><th>#</th><th>Spieler</th><th>Airline</th><th class="r">Aktie</th><th class="r">Flotte</th><th class="r">Rep</th></tr></thead><tbody>
      ${list.map((l, i) => html`<tr class="${l.code === s.player.code ? "me" : ""}"><td>${i + 1}</td><td class="code">${l.code}</td><td><b>${l.name}</b> <span class="muted small">${l.iata}</span></td>
        <td class="r mono">${fmt.price(l.price)}</td><td class="r">${l.fleet ?? "–"}</td><td class="r">${l.rep != null ? Math.round(l.rep) : "–"}</td></tr>`)}
      </tbody></table>`;
  },

  change(ctx, v, api) { return { sort: el => { v.sort = el.value; api.rerender(); } }; }
};
