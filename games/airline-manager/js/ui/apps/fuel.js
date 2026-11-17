// Kerosin: Live-Preis (sekündlich), 48-h-Chart, Tanklager kaufen und ausbauen.
import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { FUEL } from "../../core/config.js";
import { fuelPrice, fuelHistory, depotCapKg, buyFuel, upgradeDepot } from "../../sim/fuel.js";
import { barChart } from "../chart.js";
import { DAY } from "../../core/config.js";
import { dayKey } from "../../core/util.js";

export default {
  id: "fuel", title: "Kerosin", icon: "fuel", width: 520,
  initialView: () => ({ amount: 50 }),

  render(ctx, v) {
    const s = ctx.state, cap = depotCapKg(s), next = FUEL.depot[s.fuel.depot + 1];
    const free = cap - s.fuel.stockKg;
    return html`
      <div class="row" style="align-items:flex-end"><div class="grow"><div class="small muted">Spotpreis je Tonne · live</div><div class="big-price" data-k="price"></div><div class="small" data-k="chg"></div></div>
        <div class="stack" style="text-align:right"><span class="small muted">48 h Tief / Hoch</span><b data-k="range" class="mono"></b></div></div>
      <canvas class="chart" data-k="chart" width="960" height="300" style="margin-top:8px"></canvas>
      <div class="card" style="margin-top:12px">
        <div class="row"><b class="grow">Tanklager</b><span class="muted small">Stufe ${s.fuel.depot + 1} / ${FUEL.depot.length}</span></div>
        <div class="bar" style="margin:8px 0"><i style="width:${(s.fuel.stockKg / cap * 100).toFixed(1)}%"></i></div>
        <div class="row small"><span class="grow">${fmt.int(s.fuel.stockKg / 1000)} t von ${fmt.int(cap / 1000)} t</span><span class="muted">Ø Einkauf ${fmt.price(s.fuel.avgCost * 1000)}/t</span></div>
        <label class="stack" style="margin-top:12px"><span class="small muted">Menge kaufen: <b data-k="amt"></b> t</span>
          <input type="range" min="0" max="100" value="${v.amount}" data-act="amount"></label>
        <div class="row" style="margin-top:8px"><span class="grow small muted" data-k="cost"></span><button class="btn p" data-act="buy" ${free <= 0 ? "disabled" : ""}>Kaufen</button></div>
        <p class="small muted" style="margin-top:8px">Flüge tanken aus dem Lager zum Durchschnittspreis. Ist das Lager leer, wird zum aktuellen Preis +${FUEL.spotPremium * 100} % nachgekauft.</p>
      </div>
      <h3 class="rep-h">Verbrauch und Kosten</h3>
      <div class="card">${raw(usageBlock(ctx))}</div>
      <div class="card" style="margin-top:10px"><div class="row"><div class="grow"><b>Lager ausbauen</b><div class="small muted">${next ? `Auf ${fmt.int(next.capT)} t für ${fmt.money(next.price)}` : "Maximale Größe erreicht."}</div></div>
        <button class="btn" data-act="upgrade" ${next ? "" : "disabled"}>Ausbauen</button></div></div>`;
  },

  click(ctx, v, api) {
    return {
      buy: () => {
        const kg = amountKg(ctx, v);
        const r = ctx.run(buyFuelAction, kg, ctx.now());
        if (r) ctx.toast(`${fmt.int(r.kg / 1000)} t gekauft zu ${fmt.price(r.price * 1000)}/t.`, "good");
      },
      upgrade: () => { const r = ctx.run(upgradeDepot); if (r) ctx.toast("Tanklager ausgebaut.", "good"); }
    };
  },

  input(ctx, v) {
    return { amount: (el) => { v.amount = +el.value; this.tick(el.closest(".body"), ctx, v); } };
  },

  tick(el, ctx, v) {
    const now = ctx.now(), p = fuelPrice(now) * 1000, prev = fuelPrice(now - 3600_000) * 1000;
    const q = k => el.querySelector(`[data-k="${k}"]`);
    if (!q("price")) return;
    q("price").textContent = fmt.price(p);
    q("chg").textContent = `${fmt.pct(p / prev - 1)} in 1 h`;
    q("chg").className = "small " + (p >= prev ? "bad" : "good");
    const hist = fuelHistory(now, 48, 240).map(([t, x]) => [t, x * 1000]);
    const vals = hist.map(h => h[1]);
    q("range").textContent = `$${fmt.int(Math.min(...vals))} / $${fmt.int(Math.max(...vals))}`;
    draw(q("chart"), hist);
    const kg = amountKg(ctx, v);
    q("amt").textContent = fmt.int(kg / 1000);
    q("cost").textContent = kg ? `≈ ${fmt.money(kg * p / 1000)}` : "Lager voll";
  }
};

const buyFuelAction = (state, kg, now) => buyFuel(state, kg, now);
const amountKg = (ctx, v) => Math.round((depotCapKg(ctx.state) - ctx.state.fuel.stockKg) * v.amount / 100 / 1000) * 1000;

function draw(cv, data) {
  const g = cv.getContext("2d"), W = cv.width, Hh = cv.height, pad = 8;
  const vals = data.map(d => d[1]), min = Math.min(...vals) * 0.98, max = Math.max(...vals) * 1.02;
  const X = i => pad + (i / (data.length - 1)) * (W - pad * 2), Y = v => Hh - pad - ((v - min) / (max - min)) * (Hh - pad * 2);
  g.clearRect(0, 0, W, Hh);
  g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, Hh * i / 4); g.lineTo(W, Hh * i / 4); g.stroke(); }
  const grad = g.createLinearGradient(0, 0, 0, Hh);
  grad.addColorStop(0, "rgba(255,176,0,.35)"); grad.addColorStop(1, "rgba(255,176,0,0)");
  g.beginPath(); data.forEach((d, i) => i ? g.lineTo(X(i), Y(d[1])) : g.moveTo(X(i), Y(d[1])));
  g.lineTo(X(data.length - 1), Hh); g.lineTo(X(0), Hh); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); data.forEach((d, i) => i ? g.lineTo(X(i), Y(d[1])) : g.moveTo(X(i), Y(d[1])));
  g.strokeStyle = "#ffb000"; g.lineWidth = 3; g.stroke();
  const last = data.length - 1;
  g.beginPath(); g.arc(X(last), Y(data[last][1]), 6, 0, Math.PI * 2); g.fillStyle = "#ffb000"; g.fill();
}

/**
 * Tagesverbrauch und Reichweite des Vorrats. Die Kosten je Tag stehen im Buchungsjournal,
 * die Kilogramm rechnen wir aus dem Schnitt zurück – genauer als eine zweite Statistik zu führen,
 * die beim Nachrechnen auseinanderlaufen könnte.
 */
function usageBlock(ctx) {
  const s = ctx.state, now = ctx.now();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const t = now - i * DAY, k = dayKey(t);
    const cost = s.fin.days[k]?.cost?.fuel || 0;
    days.push({ v: cost, t: new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) });
  }
  const spent = days.reduce((a, d) => a + d.v, 0);
  const withData = days.filter(d => d.v > 0).length;
  const perDay = withData ? spent / withData : 0;
  const kgPerDay = perDay / Math.max(0.01, s.fuel.avgCost);
  const reach = kgPerDay > 0 ? s.fuel.stockKg / kgPerDay : null;
  return `${barChart(days, { label: v => fmt.money(v), marks: 4, color: "var(--accent)" })}
    <div class="row wrap small muted" style="margin-top:8px">
      <span>14 Tage: <b>${fmt.money(spent)}</b></span><span>·</span>
      <span>im Schnitt <b>${fmt.money(perDay)}</b> am Tag</span><span>·</span>
      <span>rund <b>${fmt.int(kgPerDay / 1000)} t</b> täglich</span>
      ${reach != null ? `<span>·</span><span>Vorrat reicht <b class="${reach < 2 ? "warn" : ""}">${reach.toFixed(1)} Tage</b></span>` : ""}
    </div>`;
}
