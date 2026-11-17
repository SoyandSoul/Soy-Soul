// Börse: alle Spieler-Airlines weltweit, Kauf/Verkauf von Aktien, eigenes Depot.
import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { STOCKS } from "../../core/config.js";
import { buyShares, sellShares, maxShares, stakeIn } from "../../sim/stocks.js";
import { rate } from "../../sim/rating.js";

export default {
  id: "stocks", title: "Börse", icon: "stocks", width: 700,
  initialView: () => ({ tab: "market" }),

  render(ctx, v) {
    const m = ctx.market;
    return html`<div class="tabs">${[["market", "Markt"], ["depot", "Mein Depot"]].map(([id, l]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${l}</button>`)}</div>
      ${m.demo ? html`<p class="small warn" style="margin-bottom:8px">Demo-Börse: Es ist noch kein Online-Backend eingerichtet. Die anderen Airlines sind Beispiele (README → Supabase).</p>` : ""}
      ${m.error ? html`<p class="small bad" style="margin-bottom:8px">${m.error}</p>` : ""}
      ${v.tab === "depot" ? depot(ctx) : market(ctx)}`;
  },

  click(ctx, v, api) {
    const find = code => ctx.listings().find(l => l.code === code);
    return {
      buy: el => {
        const qty = Math.floor(+el.closest("tr").querySelector("[name=qty]").value || 0), l = find(el.dataset.code);
        const r = ctx.run(buyShares, l, qty, ctx.now());
        if (r) ctx.toast(`${fmt.int(qty)} Aktien ${l.name} gekauft (${fmt.money(r.cost)}).`, "good");
      },
      sell: el => {
        const qty = Math.floor(+el.closest("tr").querySelector("[name=qty]").value || 0), l = find(el.dataset.code);
        const r = ctx.run(sellShares, l, qty, ctx.now());
        if (r) ctx.toast(`Verkauft für ${fmt.money(r.gain)}.`, "good");
      },
      refresh: async () => { await ctx.refreshMarket(); api.rerender(); }
    };
  }
};

function market(ctx) {
  const s = ctx.state, list = ctx.listings();
  return html`<div class="row" style="margin-bottom:8px"><span class="small muted grow">${list.length} Airlines · Gebühr ${STOCKS.fee * 100} % pro Order · aktualisiert ${ctx.market.fetched ? new Date(ctx.market.fetched).toLocaleTimeString("de-DE") : "–"}</span><button class="btn sm" data-act="refresh">Aktualisieren</button></div>
  <table class="t"><thead><tr><th>Airline</th><th class="r">Kurs</th><th class="r">Sterne</th><th class="r">Größe</th><th class="r">Anteil</th><th></th></tr></thead><tbody>
    ${list.map(l => {
      const me = l.code === s.player.code, h = s.stocks.holdings[l.code];
      const r = rate({ ...(l.profile || { fleet: l.fleet }), rep: l.profile?.rep ?? l.rep ?? 0 });
      const stake = stakeIn(s, l), max = maxShares(l);
      return html`<tr class="${me ? "me" : ""}"><td><b>${l.name}</b> <span class="muted small">${l.iata}${l.hub ? ` · ${l.hub}` : ""}</span>
          <div class="code small">${l.code}</div></td>
        <td class="r mono">${fmt.price(l.price)}</td>
        <td class="r acc">${r.stars.toFixed(1)}</td><td class="r">${r.size}</td>
        <td class="r">${h ? html`${fmt.int(h.qty)}<div class="small muted">${(stake * 100).toFixed(1)} %</div>` : ""}</td>
        <td class="r">${me ? html`<span class="pill info">Deine Airline</span>`
          : html`<div class="row" style="justify-content:flex-end"><input class="in" name="qty" type="number" min="1" max="${max}" value="1000" style="width:84px"><button class="btn sm p" data-act="buy" data-code="${l.code}" ${stake >= STOCKS.maxStake ? "disabled" : ""}>Kauf</button>${h ? html`<button class="btn sm" data-act="sell" data-code="${l.code}">Verk.</button>` : ""}</div>`}</td></tr>`;
    })}</tbody></table>
  <p class="small muted" style="margin-top:8px">An einer fremden Airline sind höchstens ${Math.round(STOCKS.maxStake * 100)} % erlaubt –
    die Mehrheit bleibt immer beim Spieler selbst. Der Wert der Beteiligung wächst mit der Airline und lässt sich jederzeit verkaufen.</p>`;
}

function depot(ctx) {
  const s = ctx.state, list = ctx.listings(), entries = Object.entries(s.stocks.holdings);
  if (!entries.length) return html`<div class="empty"><b>Depot ist leer</b>Kaufe Aktien anderer Spieler-Airlines im Markt.</div>`;
  let total = 0, cost = 0;
  const rows = entries.map(([code, h]) => {
    const l = list.find(x => x.code === code), price = l?.price ?? h.cost / h.qty, val = price * h.qty;
    total += val; cost += h.cost;
    return html`<tr><td><b>${h.name}</b> <span class="code">${code}</span></td><td class="r">${fmt.int(h.qty)}</td><td class="r mono">${fmt.price(h.cost / h.qty)}</td><td class="r mono">${fmt.price(price)}</td>
      <td class="r ${val >= h.cost ? "good" : "bad"}">${fmt.pct(val / h.cost - 1)}</td>
      <td class="r"><div class="row" style="justify-content:flex-end"><input class="in" name="qty" type="number" min="1" value="${h.qty}" style="width:84px"><button class="btn sm" data-act="sell" data-code="${code}">Verkaufen</button></div></td></tr>`;
  });
  return html`<div class="grid2" style="margin-bottom:10px"><div class="card stat"><span>Depotwert</span><b>${fmt.money(total)}</b></div><div class="card stat"><span>Gewinn/Verlust</span><b class="${total >= cost ? "good" : "bad"}">${fmt.money(total - cost)}</b></div></div>
    <table class="t"><thead><tr><th>Airline</th><th class="r">Stück</th><th class="r">Einstand</th><th class="r">Kurs</th><th class="r">+/−</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
