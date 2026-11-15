// Info-Karte für ein angeklicktes Flugzeug (rechts oben, Flightradar-Stil).
import { html, raw } from "./dom.js";
import { fmt } from "../core/util.js";
import { typeOf, positionAt } from "../sim/flight.js";
import { sideView } from "./aircraftArt.js";
import { mostUrgent } from "../sim/maintenance.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";

export function renderFlightCard(el, ctx, id) {
  const s = ctx.state, ac = id && s.fleet.find(a => a.id === id);
  if (!ac) { el.hidden = true; el.innerHTML = ""; return; }
  const t = typeOf(ac), route = ac.ops && s.routes.find(r => r.id === ac.ops.routeId);
  el.hidden = false;
  el.innerHTML = html`
    <div class="hd"><div class="grow"><b>${s.airline.iata}${flightNo(ac, s)}</b> <span class="code">${ac.reg}</span><div class="small muted">${t.maker} ${t.name}${ac.name ? " · „" + ac.name + "“" : ""}</div></div>
      <button class="btn sm" data-fc="close" aria-label="Schließen">✕</button></div>
    <div class="art">${raw(sideView(t, s.airline.livery))}</div>
    ${route ? html`<div class="route">
      <div class="ap"><b data-f="o"></b><span data-f="oc"></span></div>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--accent)"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <div class="ap"><b data-f="d"></b><span data-f="dc"></span></div>
    </div>
    <div class="prog"><div class="bar"><i data-f="bar"></i></div><div class="row small muted" style="justify-content:space-between;margin-top:4px"><span data-f="dep"></span><span data-f="arr"></span></div></div>
    <div class="grid3">
      <div><span>Höhe</span><b data-f="alt"></b></div>
      <div><span>Speed</span><b data-f="spd"></b></div>
      <div><span>Kurs</span><b data-f="hdg"></b></div>
      <div><span>Status</span><b data-f="st"></b></div>
      <div><span>Restzeit</span><b data-f="rem"></b></div>
      <div><span>Wartung</span><b data-f="mt"></b></div>
    </div>` : html`<p class="muted small" style="padding:12px 14px">${ac.status === "delivery" ? "Wird ausgeliefert." : "Keine Strecke zugewiesen."}</p>`}
    <footer><button class="btn sm" data-fc="hangar">Im Hangar öffnen</button>${route ? html`<button class="btn sm" data-fc="route">Strecke</button>` : ""}</footer>`.s;
  el.onclick = e => {
    const b = e.target.closest("[data-fc]");
    if (!b) return;
    if (b.dataset.fc === "close") ctx.map.select(null);
    if (b.dataset.fc === "hangar") ctx.openApp("hangar", { detail: ac.id });
    if (b.dataset.fc === "route") ctx.openApp("routes", { tab: "list", detail: route.id });
  };
  tickFlightCard(el, ctx, id);
}

function flightNo(ac, s) {
  const i = s.fleet.indexOf(ac);
  return String(100 + i * 2 + (ac.ops?.dir || 0));
}

export function tickFlightCard(el, ctx, id) {
  if (el.hidden || !id) return;
  const s = ctx.state, ac = s.fleet.find(a => a.id === id);
  const route = ac?.ops && s.routes.find(r => r.id === ac.ops.routeId);
  if (!route) return;
  const now = ctx.now(), q = k => el.querySelector(`[data-f="${k}"]`);
  if (!q("o")) return;
  const inCheck = ac.status === "check";
  const p = inCheck ? null : positionAt(ac, route, now);
  const o = p ? p.from : AIRPORT_BY_IATA[route.from], d = p ? p.to : AIRPORT_BY_IATA[route.to];
  q("o").textContent = o.iata; q("oc").textContent = o.city;
  q("d").textContent = d.iata; q("dc").textContent = d.city;
  q("bar").style.width = ((p?.progress || 0) * 100).toFixed(1) + "%";
  q("dep").textContent = p ? "Ab " + fmt.time(ac.ops.dep) : "";
  q("arr").textContent = p ? "An " + fmt.time(p.eta) : "";
  q("alt").textContent = p?.phase === "air" ? fmt.int(p.altFt) + " ft" : "–";
  q("spd").textContent = p?.phase === "air" ? p.speedKt + " kt" : "–";
  q("hdg").textContent = p?.phase === "air" ? Math.round(p.heading) + "°" : "–";
  q("st").textContent = inCheck ? ac.check.type + "-Check" : p.phase === "air" ? "In der Luft" : now < ac.ops.dep ? "Boarding" : "Gelandet";
  q("rem").textContent = inCheck ? fmt.duration(ac.check.until - now) : p.phase === "air" ? fmt.duration(p.eta - now) : "Abflug " + fmt.time(ac.ops.dep);
  const m = mostUrgent(ac, now);
  const mt = q("mt");
  mt.textContent = m ? `${m.check} ${fmt.fh(m.rem)}` : "OK";
  mt.className = m ? (m.rem < 0 ? "bad" : "warn") : "good";
}
