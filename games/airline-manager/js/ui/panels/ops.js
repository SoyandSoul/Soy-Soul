// Rechtes Panel "Betrieb": die operativen Bereiche mit Live-Kurzstatus. Was wenig Platz braucht,
// steht direkt im Panel; die großen Werkzeuge (Markt, Routen, Lackiererei) öffnen weiter als Fenster.

import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { FUEL, HUB } from "../../core/config.js";
import { fuelPrice } from "../../sim/fuel.js";
import { AREAS, levelOf, upkeepPerDay, hangarEffect } from "../../sim/hub.js";
import { activeEvents } from "../../sim/events.js";
import { eventsAt } from "../../sim/calendar.js";
import { AIRPORT_BY_IATA } from "../../data/airports.js";
import { checkStatus, mostUrgent } from "../../sim/maintenance.js";
import { typeOf, routeDistance } from "../../sim/flight.js";
import { flightsPerDay } from "../../sim/engine.js";
import { usedListings } from "../../sim/market.js";
import { leaseFrame } from "../../sim/lease.js";
import * as act from "../../sim/actions.js";

const openBtn = (id, label) => html`<button class="btn sm p" data-act="open" data-id="${id}">${label}</button>`;

// ---------------------------------------------------------------- Routen
const routes = {
  id: "routes", title: "Routen", icon: "routes",
  badge: ctx => { const n = ctx.state.routes.length; return n ? { n } : null; },
  render(ctx) {
    const s = ctx.state;
    if (!s.routes.length) return html`<div class="empty"><b>Noch keine Strecke</b>Strecken starten immer an einem Drehkreuz.</div>
      <div class="row">${openBtn("routes", "Strecken planen")}</div>`;
    const rows = s.routes.map(r => {
      const planes = s.fleet.filter(a => a.ops?.routeId === r.id && a.status !== "crashed");
      const legs = s.flights.filter(f => f.routeId === r.id);
      const lf = legs.length ? legs.reduce((a, f) => a + f.lf, 0) / legs.length : null;
      const profit = legs.length ? legs.reduce((a, f) => a + f.profit, 0) / legs.length : null;
      return html`<button class="acrow" data-act="route" data-id="${r.id}">
        <span class="grow"><b>${r.from} ⇄ ${r.to}</b><small>${fmt.km(routeDistance(r))} · ${planes.length} Flugzeug${planes.length === 1 ? "" : "e"}</small></span>
        <span class="acdet">${lf == null ? "noch keine Flüge" : html`${Math.round(lf * 100)} % · <b class="${profit < 0 ? "bad" : "good"}">${fmt.money(profit)}</b>/Flug`}</span></button>`;
    });
    return html`${rows}<div class="row" style="margin-top:10px">${openBtn("routes", "Strecken verwalten")}</div>`;
  },
  click: ctx => ({
    open: el => ctx.openApp(el.dataset.id),
    route: el => { ctx.highlight(el.dataset.id); ctx.openApp("routes", { detail: el.dataset.id }); }
  })
};

// ---------------------------------------------------------------- Flugzeugmarkt
const market = {
  id: "shop", title: "Flugzeugmarkt", icon: "shop",
  render(ctx) {
    const s = ctx.state, used = usedListings(ctx.now());
    const pending = s.fleet.filter(a => a.status === "delivery").length;
    const fr = leaseFrame(s, ctx.now());
    return html`<dl class="kv"><dt>Kasse</dt><dd>${fmt.money(s.cash)}</dd>
      <dt>Leasingrahmen frei</dt><dd class="${fr.free ? "acc" : "muted"}">${fmt.money(fr.free)} / Monat</dd>
      <dt>Gebrauchtangebote</dt><dd>${used.length}</dd>
      <dt>Sofort lieferbar</dt><dd>${Math.max(0, 5 - (s.ordered || 0))} Flugzeuge</dd>
      ${pending ? html`<dt>In Auslieferung</dt><dd>${pending}</dd>` : ""}</dl>
      <div class="row" style="margin-top:10px">${openBtn("shop", "Markt öffnen")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id) })
};

// ---------------------------------------------------------------- Wartung
const maint = {
  id: "maint", title: "Wartung", icon: "maint",
  badge(ctx) {
    const n = ctx.state.fleet.filter(a => a.status !== "crashed" && mostUrgent(a, ctx.now())?.overdue).length;
    return n ? { n, kind: "bad" } : null;
  },
  render(ctx) {
    const s = ctx.state, now = ctx.now();
    const list = s.fleet.filter(a => a.status !== "crashed" && a.status !== "delivery")
      .map(a => ({ a, u: mostUrgent(a, now) })).filter(x => x.u)
      .sort((x, y) => x.u.rem - y.u.rem).slice(0, 6);
    if (!list.length) return html`<div class="empty"><b>Nichts fällig</b>Alle Flugzeuge sind im Plan.</div>`;
    return html`${list.map(({ a, u }) => html`<button class="acrow ${u.overdue ? "bad" : ""}" data-act="ac" data-id="${a.id}">
        <span class="grow"><b>${a.reg}</b><small>${typeOf(a).name}</small></span>
        <span class="acdet ${u.overdue ? "bad" : u.rem < 100 ? "warn" : ""}">${u.check}-Check · ${fmt.fh(u.rem)}</span></button>`)}
      <div class="row" style="margin-top:10px">${openBtn("maint", "Wartung öffnen")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id), ac: el => ctx.openApp("maint", { detail: el.dataset.id }) })
};

// ---------------------------------------------------------------- Kerosin
const fuel = {
  id: "fuel", title: "Kerosin", icon: "fuel",
  render(ctx) {
    const s = ctx.state, now = ctx.now(), spot = fuelPrice(now) * 1000;
    const cap = FUEL.depot[s.fuel.depot].capT, stock = s.fuel.stockKg / 1000;
    const avg = s.fuel.avgCost * 1000;
    return html`<dl class="kv"><dt>Spotpreis</dt><dd class="${spot > avg ? "bad" : "good"}">$${fmt.int(spot)} / t</dd>
      <dt>Eigener Schnitt</dt><dd>$${fmt.int(avg)} / t</dd>
      <dt>Tanklager</dt><dd>${fmt.int(stock)} / ${fmt.int(cap)} t</dd></dl>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, stock / cap * 100)}%;background:var(--c-ops)"></i></div>
      <div class="row" style="margin-top:10px">${openBtn("fuel", "Kerosin öffnen")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id) })
};

// ---------------------------------------------------------------- Drehkreuz
const hubSec = {
  id: "hubs", title: "Drehkreuz", icon: "gate",
  render(ctx) {
    const s = ctx.state, he = hangarEffect(s);
    return html`${s.airline.hubs.map(iata => html`<div class="row" style="margin-bottom:6px">
        <b class="grow">${iata}</b>
        <span class="small muted">${AREAS.map(a => `${HUB[a].label} ${levelOf(s, iata, a)}`).join(" · ")}</span></div>`)}
      <dl class="kv" style="margin-top:8px"><dt>Unterhalt</dt><dd>${fmt.money(upkeepPerDay(s))} / Tag</dd>
        <dt>Werft</dt><dd>${he.level ? `${he.label} · ${Math.round(he.covered * 100)} % gedeckt` : "Fremdwartung"}</dd></dl>
      <div class="row" style="margin-top:10px">${openBtn("hub", "Drehkreuz öffnen")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id) })
};

// ---------------------------------------------------------------- Welt
const worldSec = {
  id: "world", title: "Welt", icon: "calendar",
  badge(ctx) {
    const s = ctx.state, now = ctx.now();
    const mine = new Set([...s.airline.hubs, ...s.routes.flatMap(r => [r.from, r.to])]);
    const n = activeEvents(now).filter(e => e.scope === "country"
      ? [...mine].some(i => AIRPORT_BY_IATA[i]?.country === e.country) : mine.has(e.at)).length;
    return n ? { n, kind: "warn" } : null;
  },
  render(ctx) {
    const now = ctx.now();
    const cal = eventsAt(now), live = activeEvents(now);
    return html`${cal.length ? html`<div class="small"><b>${cal.map(e => e.label).join(", ")}</b>
        <div class="muted">Urlaubsnachfrage ${cal.map(e => `${e.leisure >= 1 ? "+" : ""}${Math.round((e.leisure - 1) * 100)} %`).join(" / ")}</div></div>`
      : html`<div class="small muted">Kein besonderer Termin.</div>`}
      <div class="small" style="margin-top:8px">${live.length
        ? live.slice(0, 3).map(e => html`<div class="muted">${e.label} · ${e.at}${e.closes ? " (gesperrt)" : ""}</div>`)
        : html`<span class="muted">Weltweit ruhiger Betrieb.</span>`}</div>
      <div class="row" style="margin-top:10px">${openBtn("world", "Welt öffnen")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id) })
};

// ---------------------------------------------------------------- Börse & Rangliste
const market2 = {
  id: "stocks", title: "Börse & Rangliste", icon: "stocks",
  render(ctx) {
    const s = ctx.state, list = ctx.listings();
    const rank = list.findIndex(l => l.code === s.player.code) + 1;
    return html`<dl class="kv"><dt>Eigener Kurs</dt><dd class="acc">${fmt.price(ctx.sharePrice())}</dd>
      <dt>Platz</dt><dd>${rank || "–"} von ${list.length}</dd>
      <dt>Beteiligungen</dt><dd>${Object.keys(s.stocks.holdings).length}</dd>
      <dt>Quelle</dt><dd>${ctx.market.demo ? "Demo-Airlines" : "Live"}</dd></dl>
      <div class="row" style="margin-top:10px">${openBtn("stocks", "Börse")}${openBtn("board", "Rangliste")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id) })
};

// ---------------------------------------------------------------- Logbuch
const logbook = {
  id: "log", title: "Logbuch", icon: "log",
  badge: ctx => { const n = ctx.state.log.filter(l => l.kind === "bad" || l.kind === "warn").slice(0, 20).length; return n ? { n, kind: "warn" } : null; },
  render(ctx) {
    const log = ctx.state.log.slice(0, 7);
    if (!log.length) return html`<div class="empty"><b>Noch nichts passiert</b></div>`;
    return html`<ul class="loglist">${log.map(l => html`<li class="${l.kind}"><time>${fmt.dateTime(l.t)}</time>${l.text}</li>`)}</ul>
      <div class="row" style="margin-top:10px">${openBtn("logbook", "Logbuch öffnen")}</div>`;
  },
  click: ctx => ({ open: el => ctx.openApp(el.dataset.id) })
};

export const OPS_SECTIONS = [routes, market, maint, hubSec, fuel, worldSec, market2, logbook];
