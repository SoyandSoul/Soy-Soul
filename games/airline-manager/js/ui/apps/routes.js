// Routenplaner: Strecken anlegen, Preise pro Klasse + Saisonregeln, Flugzeuge zuweisen.
import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { CABIN } from "../../core/config.js";
import { AIRPORT_BY_IATA, searchAirports } from "../../data/airports.js";
import { distanceKm } from "../../sim/geo.js";
import { routeDistance, routeProblems, typeOf, blockHours } from "../../sim/flight.js";
import { demandPreview, refFare, seasonOf, effectivePrice, seasonFactor } from "../../sim/demand.js";
import { flightsPerDay } from "../../sim/engine.js";
import * as act from "../../sim/actions.js";
import { outlookFor } from "../outlook.js";

const SEASON = { peak: ["Hochsaison", "good"], off: ["Nebensaison", "info"], normal: ["Normal", ""] };

export default {
  id: "routes", title: "Routenplaner", icon: "routes", width: 640,
  initialView: () => ({ tab: "list", detail: null, from: null, to: null, q: "" }),

  render(ctx, v) {
    const s = ctx.state;
    if (v.detail && s.routes.some(r => r.id === v.detail)) return detail(ctx, s.routes.find(r => r.id === v.detail));
    v.detail = null;
    return html`${tabsBar(v)}${v.tab === "new" ? planner(ctx, v) : list(ctx)}`;
  },

  click(ctx, v, api) {
    return {
      open: el => { v.detail = el.dataset.id; ctx.highlight(v.detail); api.rerender(); },
      back: () => { v.detail = null; ctx.highlight(null); api.rerender(); },
      pickTo: el => { v.to = el.dataset.iata; v.q = ""; api.rerender(); },
      create: () => {
        const r = ctx.run(act.createRoute, v.from || ctx.state.airline.hubs[0], v.to);
        if (r) { ctx.toast(`Strecke ${r.route.from}–${r.route.to} angelegt.`, "good"); v.detail = r.route.id; v.to = null; v.tab = "list"; ctx.highlight(r.route.id); api.rerender(); }
      },
      savePrices: el => {
        const box = el.closest(".body"), prices = {};
        for (const c of CABIN.classes) prices[c] = box.querySelector(`[name="p-${c}"]`).value;
        const seasonal = { peak: box.querySelector("[name=peak]").value, off: box.querySelector("[name=off]").value };
        ctx.run(act.setRoutePricing, v.detail, prices, seasonal) && ctx.toast("Preise gespeichert.", "good");
      },
      refPrices: el => {
        const r = ctx.state.routes.find(x => x.id === v.detail), km = routeDistance(r), prices = {};
        for (const c of CABIN.classes) prices[c] = refFare(km, c);
        ctx.run(act.setRoutePricing, v.detail, prices) && api.rerender();
      },
      assign: el => {
        const id = el.closest(".body").querySelector("[name=ac]").value;
        if (id && ctx.run(act.assign, id, v.detail, ctx.now())) ctx.toast("Flugzeug startet auf der Strecke.", "good");
      },
      unassign: el => { const r = ctx.run(act.unassign, el.dataset.id, ctx.now()); if (r) ctx.toast(r.now ? "Abgezogen." : "Wird nach Rückkehr abgezogen.", "info"); },
      del: () => { if (ctx.run(act.deleteRoute, v.detail)) { v.detail = null; ctx.highlight(null); api.rerender(); } },
      showAc: el => ctx.map.focusAircraft(el.dataset.id)
    };
  },

  change(ctx, v, api) {
    return {
      from: el => { v.from = el.value; api.rerender(); },
      // Streckenbewertung zum gewählten Flugzeug nachziehen
      pickAc: el => {
        const ac = ctx.state.fleet.find(a => a.id === el.value);
        const r = ctx.state.routes.find(x => x.id === v.detail);
        const box = el.closest(".body")?.querySelector("[data-outlook]");
        if (box) box.innerHTML = r && ac ? outlookFor(ctx, r, ac).s : "";
      }
    };
  },

  input(ctx, v, api) {
    return {
      q: el => {
        v.q = el.value;
        const res = el.closest(".body").querySelector("[data-results]");
        res.innerHTML = results(ctx, v).s;
      }
    };
  }
};

function tabsBar(v) {
  return html`<div class="tabs">${[["list", "Meine Strecken"], ["new", "Neue Strecke"]].map(([id, l]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${l}</button>`)}</div>`;
}

function list(ctx) {
  const s = ctx.state;
  if (!s.routes.length) return html`<div class="empty"><b>Noch keine Strecken</b>Lege unter „Neue Strecke“ dein erstes Ziel an – oder klicke auf der Karte auf einen Flughafen.</div>`;
  return html`<table class="t"><thead><tr><th>Strecke</th><th class="r">Distanz</th><th class="r">Flüge/Tag</th><th class="r">Pax</th><th class="r">Gewinn</th></tr></thead><tbody>
    ${s.routes.map(r => html`<tr data-act="open" data-id="${r.id}" style="cursor:pointer">
      <td><b>${r.from} → ${r.to}</b> <span class="muted small">${AIRPORT_BY_IATA[r.to].city}</span></td>
      <td class="r">${fmt.km(routeDistance(r))}</td><td class="r">${fmt.dec(flightsPerDay(s, r))}</td>
      <td class="r">${fmt.int(r.stats?.pax || 0)}</td><td class="r ${(r.stats?.profit || 0) < 0 ? "bad" : "good"}">${fmt.money(r.stats?.profit || 0)}</td></tr>`)}
  </tbody></table>`;
}

function results(ctx, v) {
  const from = v.from || ctx.state.airline.hubs[0];
  return html`${searchAirports(v.q, 10).filter(a => a.iata !== from).map(a => html`<button data-act="pickTo" data-iata="${a.iata}"><b>${a.iata}</b><span class="grow">${a.city}</span><span class="muted small">${fmt.km(distanceKm(AIRPORT_BY_IATA[from], a))}</span></button>`)}`;
}

function planner(ctx, v) {
  const s = ctx.state, from = v.from || s.airline.hubs[0], now = ctx.now();
  const to = v.to && AIRPORT_BY_IATA[v.to];
  let info = html`<p class="muted small" style="margin-top:10px">Ziel suchen (Stadt, IATA oder ICAO) oder auf der Karte anklicken.</p>`;
  if (to) {
    const km = Math.round(distanceKm(AIRPORT_BY_IATA[from], to));
    const d = demandPreview(from, to.iata, now, km), back = demandPreview(to.iata, from, now, km);
    const fake = { id: "x", from, to: to.iata, _km: km };
    const fleetOk = s.fleet.filter(ac => ac.status !== "crashed" && !routeProblems(ac, fake).length);
    const season = SEASON[seasonOf(fake, now)];
    info = html`<div class="card" style="margin-top:12px">
      <div class="row"><h3 class="grow" style="font-size:18px">${from} → ${to.iata} <span class="muted small">${to.city}</span></h3>${season[1] ? html`<span class="pill ${season[1]}">${season[0]}</span>` : ""}</div>
      <dl class="kv" style="margin-top:8px"><dt>Distanz</dt><dd>${fmt.km(km)}</dd><dt>Bahn am Ziel</dt><dd>${fmt.int(to.runwayM)} m</dd>
        <dt>Saisonfaktor Urlaub</dt><dd>${fmt.dec(seasonFactor(now, AIRPORT_BY_IATA[from].lat))}×</dd>
        <dt>Passende Flugzeuge</dt><dd>${fleetOk.length} von ${s.fleet.length}</dd></dl>
      <table class="t" style="margin-top:10px"><thead><tr><th>Klasse</th><th class="r">Nachfrage/Tag hin</th><th class="r">zurück</th><th class="r">Referenzpreis</th></tr></thead><tbody>
        ${CABIN.classes.map(c => html`<tr><td>${CABIN.names[c]}</td><td class="r">${fmt.int(d[c])}</td><td class="r">${fmt.int(back[c])}</td><td class="r">${fmt.price(refFare(km, c))}</td></tr>`)}
      </tbody></table>
      ${fleetOk.length ? html`<p class="small muted" style="margin-top:8px">Blockzeit z. B. ${fmt.hours(blockHours(km, typeOf(fleetOk[0])))} mit ${typeOf(fleetOk[0]).name}.</p>` : ""}
      <div class="row" style="margin-top:10px"><span class="grow small muted">Nachfrage = dein erreichbarer Marktanteil. Sie schwankt mit Wochentag, Saison und Reputation.</span><button class="btn p" data-act="create">Strecke anlegen</button></div>
    </div>`;
  }
  return html`<div class="grid2">
      <label class="stack"><span class="small muted">Von (Drehkreuz)</span><select class="in" data-act="from">${s.airline.hubs.map(h => html`<option value="${h}" ${h === from ? "selected" : ""}>${h} · ${AIRPORT_BY_IATA[h].city}</option>`)}</select></label>
      <label class="stack"><span class="small muted">Nach</span><input class="in" data-act="q" placeholder="z. B. JFK, Palma, Tokio" value="${v.q}" autocomplete="off"></label>
    </div>
    <div class="pick" data-results>${v.q ? results(ctx, v) : ""}</div>
    ${info}`;
}

function detail(ctx, r) {
  const s = ctx.state, km = routeDistance(r), now = ctx.now();
  const onRoute = s.fleet.filter(a => a.ops?.routeId === r.id);
  const free = s.fleet.filter(a => a.status === "idle" && !routeProblems(a, r).length);
  const season = SEASON[seasonOf(r, now)];
  return html`
    <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="back">← Strecken</button><span class="grow"></span><button class="btn sm danger" data-act="del">Strecke löschen</button></div>
    <div class="row"><h3 class="grow" style="font-size:20px">${r.from} ⇄ ${r.to}</h3>${season[1] ? html`<span class="pill ${season[1]}">${season[0]}</span>` : html`<span class="pill">Normalsaison</span>`}</div>
    <p class="muted small">${AIRPORT_BY_IATA[r.from].city} – ${AIRPORT_BY_IATA[r.to].city} · ${fmt.km(km)} · ${fmt.dec(flightsPerDay(s, r))} Flüge/Tag je Richtung</p>
    <div class="grid3" style="margin:12px 0">
      <div class="card stat"><span>Flüge</span><b>${fmt.int(r.stats?.legs || 0)}</b></div>
      <div class="card stat"><span>Passagiere</span><b>${fmt.int(r.stats?.pax || 0)}</b></div>
      <div class="card stat"><span>Gewinn gesamt</span><b class="${(r.stats?.profit || 0) < 0 ? "bad" : "good"}">${fmt.money(r.stats?.profit || 0)}</b></div>
    </div>

    <h3 style="font-size:15px;margin:14px 0 8px">Ticketpreise</h3>
    <div class="card"><table class="t"><thead><tr><th>Klasse</th><th class="r">Referenz</th><th class="r">Dein Preis</th><th class="r">Heute effektiv</th></tr></thead><tbody>
      ${CABIN.classes.map(c => html`<tr><td>${CABIN.names[c]}</td><td class="r muted">${fmt.price(refFare(km, c))}</td>
        <td class="r"><input class="in" type="number" min="1" name="p-${c}" value="${r.prices[c]}" style="width:96px;text-align:right"></td>
        <td class="r">${fmt.price(effectivePrice(r, c, now))}</td></tr>`)}
    </tbody></table>
    <div class="grid2" style="margin-top:10px">
      <label class="stack"><span class="small muted">Aufschlag Hochsaison (%)</span><input class="in" type="number" min="0" max="100" name="peak" value="${r.seasonal.peak}"></label>
      <label class="stack"><span class="small muted">Rabatt Nebensaison (%)</span><input class="in" type="number" min="0" max="60" name="off" value="${r.seasonal.off}"></label>
    </div>
    <p class="small muted" style="margin-top:8px">Unter Referenz: mehr Passagiere und bessere Reputation. Deutlich darüber (ab +30 %): weniger Buchungen und Reputation sinkt. Saisonregeln greifen nur auf Urlaubsstrecken.</p>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="refPrices">Auf Referenz setzen</button><span class="grow"></span><button class="btn sm p" data-act="savePrices">Preise speichern</button></div></div>

    <h3 style="font-size:15px;margin:14px 0 8px">Flugzeuge auf dieser Strecke</h3>
    <div class="card">
      ${onRoute.length ? html`<table class="t"><tbody>${onRoute.map(a => html`<tr><td><b>${a.reg}</b> <span class="muted small">${typeOf(a).name}</span></td><td class="small">${fmt.hours(blockHours(km, typeOf(a)))} Block</td>
        <td class="r"><button class="btn sm" data-act="showAc" data-id="${a.id}">Karte</button> <button class="btn sm" data-act="unassign" data-id="${a.id}">Abziehen</button></td></tr>`)}</tbody></table>`
        : html`<p class="muted small">Noch keine.</p>`}
      <div class="row" style="margin-top:10px"><select class="in grow" name="ac" data-act="pickAc"><option value="">Freies Flugzeug wählen …</option>${free.map(a => html`<option value="${a.id}">${a.reg} · ${typeOf(a).name}</option>`)}</select><button class="btn sm p" data-act="assign" ${free.length ? "" : "disabled"}>Zuweisen</button></div>
      <div data-outlook>${free.length ? outlookFor(ctx, r, free[0]) : ""}</div>
    </div>`;
}

