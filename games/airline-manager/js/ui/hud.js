// Kopfzeile: Airline, Kasse, Aktienkurs, Reputation, Kerosinpreis, Uhr.
import { html } from "./dom.js";
import { fmt } from "../core/util.js";
import { fuelPrice } from "../sim/fuel.js";
import { normalizeLivery } from "../art/livery.js";
import { toggleAirMenu } from "./airmenu.js";

let lastFuel = 0, lastShare = 0;

export function renderHud(el, ctx) {
  const s = ctx.state, lv = normalizeLivery(s.airline.livery);
  const tail = lv.base.fin, tailTxt = lv.items.find(i => i.t === "text" && i.z === "fin");
  el.innerHTML = html`
    <div class="brand glass">
      <a href="../../" title="Zurück zu Soy & Soul" aria-label="Zurück zur Startseite"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></a>
      <button class="am-btn" data-airmenu aria-haspopup="menu" aria-expanded="false" title="Airline-Menü">
        <span class="tail" style="background:${tail};color:${tailTxt?.c || "#1b2230"};box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)">${s.airline.iata}</span>
        <span class="am-name"><b>${s.airline.name}</b><small>${s.player.code}</small></span>
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </div>
    <div class="stats glass">
      <div data-hud-open="airline" title="Finanzen"><span>Kasse</span><b data-h="cash"></b></div>
      <div data-hud-open="stocks" title="Börse"><span>Aktie</span><b data-h="share"></b></div>
      <div data-hud-open="airline" title="Reputation"><span>Reputation</span><b data-h="rep"></b></div>
      <div data-hud-open="fuel" title="Kerosinmarkt"><span>Kerosin / t</span><b data-h="fuel"></b></div>
      <div data-hud-open="hangar" title="Flotte"><span>In der Luft</span><b data-h="fleet"></b></div>
    </div>
    <div class="clock glass"><b data-h="time"></b><span data-h="date"></span></div>`.s;
  el.querySelectorAll("[data-hud-open]").forEach(d => d.onclick = () => ctx.openApp(d.dataset.hudOpen));
  el.querySelector("[data-airmenu]").onclick = e => toggleAirMenu(ctx, e.currentTarget);
  tickHud(el, ctx);
}

export function tickHud(el, ctx) {
  const s = ctx.state, now = ctx.now(), q = k => el.querySelector(`[data-h="${k}"]`);
  if (!q("cash")) return;
  q("cash").textContent = fmt.money(s.cash);
  q("cash").className = s.cash < 0 ? "bad" : "";
  const sp = ctx.sharePrice();
  q("share").textContent = fmt.price(sp);
  q("share").className = sp > lastShare + 1e-6 ? "tick-up" : sp < lastShare - 1e-6 ? "tick-down" : "";
  lastShare = sp;
  q("rep").textContent = s.airline.rep.toFixed(1) + " / 100";
  const fp = fuelPrice(now) * 1000;
  q("fuel").textContent = "$" + fmt.int(fp);
  q("fuel").className = fp > lastFuel + 0.01 ? "tick-up" : fp < lastFuel - 0.01 ? "tick-down" : "";
  lastFuel = fp;
  const active = s.fleet.filter(a => a.status === "active").length;
  const air = ctx.inAir();
  q("fleet").textContent = `${air} / ${s.fleet.filter(a => a.status !== "crashed").length}`;
  q("fleet").title = `${active} Flugzeuge im Liniendienst`;
  const d = new Date(now);
  q("time").textContent = d.toLocaleTimeString("de-DE");
  q("date").textContent = d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "long" });
}
