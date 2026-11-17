// Welt: was gerade und demnächst in der Welt passiert – Termine im Kalender und Ereignisse,
// dazu der Steckbrief jedes Flughafens.

import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { upcoming, eventsAt } from "../../sim/calendar.js";
import { activeEvents, upcomingEvents } from "../../sim/events.js";
import { describe } from "../../sim/airportInfo.js";
import { AIRPORT_BY_IATA, searchAirports } from "../../data/airports.js";

const TABS = [["now", "Jetzt"], ["cal", "Kalender"], ["ap", "Flughäfen"]];
const when = (from, to, now) => from > now
  ? `ab ${fmt.dateTime(from)}`
  : `noch ${fmt.duration(to - now)}`;

export default {
  id: "world", title: "Welt", icon: "calendar", width: 620,
  initialView: ctx => ({ tab: "now", q: "", ap: null }),

  render(ctx, v) {
    const now = ctx.now();
    return html`
      <div class="tabs">${TABS.map(([id, label]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${label}</button>`)}</div>
      ${v.tab === "now" ? nowTab(ctx, now) : v.tab === "cal" ? calTab(ctx, now) : apTab(ctx, v, now)}`;
  },

  click(ctx, v, api) {
    return {
      tab: el => { v.tab = el.dataset.tab; api.rerender(); },
      ap: el => { v.ap = el.dataset.iata; v.tab = "ap"; api.rerender(); },
      focus: el => { const a = AIRPORT_BY_IATA[el.dataset.iata]; if (a) ctx.map.flyTo(a.lon, a.lat, 6); }
    };
  },

  input(ctx, v, api) {
    return { q: el => { v.q = el.value; api.rerender(); } };
  }
};

function nowTab(ctx, now) {
  const s = ctx.state;
  const live = activeEvents(now);
  const soon = upcomingEvents(now, 10).filter(e => e.from > now);
  const cal = eventsAt(now);
  const mine = new Set([...s.airline.hubs, ...s.routes.flatMap(r => [r.from, r.to])]);
  const touches = e => e.scope === "country"
    ? [...mine].some(i => AIRPORT_BY_IATA[i]?.country === e.country)
    : mine.has(e.at);

  return html`
    ${cal.length ? html`<h3 class="rep-h">Im Kalender</h3>
      ${cal.map(e => html`<div class="card"><div class="row"><div class="grow"><b>${e.label}</b>
        <div class="small muted">${e.note}</div></div>
        <div class="r small"><span class="${e.leisure > 1 ? "good" : "muted"}">Urlaub ${pct(e.leisure)}</span><br>
          <span class="${e.biz < 1 ? "bad" : "muted"}">Geschäft ${pct(e.biz)}</span></div></div></div>`)}` : ""}

    <h3 class="rep-h">Läuft gerade</h3>
    ${!live.length ? html`<div class="empty"><b>Nichts Besonderes</b>Weltweit ruhiger Betrieb.</div>`
    : live.map(e => html`<div class="card ${touches(e) ? "hit" : ""}">
        <div class="row"><div class="grow"><b>${e.label} · ${e.at}</b>${touches(e) ? html` <span class="pill warn">betrifft euch</span>` : ""}
          <div class="small muted">${e.text}</div>
          <div class="small muted">${when(e.from, e.to, now)}${e.closes ? " · Flughafen gesperrt" : e.demand !== 1 ? ` · Nachfrage ${pct(e.demand)}` : ""}${e.costFactor !== 1 ? ` · Kosten ${pct(e.costFactor)}` : ""}</div></div>
          <button class="btn sm" data-act="ap" data-iata="${e.at}">Flughafen</button></div></div>`)}

    ${soon.length ? html`<h3 class="rep-h">Angekündigt</h3>
      <table class="t"><tbody>${soon.map(e => html`<tr><td>${e.label}</td><td>${e.city}</td>
        <td class="r muted">${fmt.dateTime(e.from)}</td></tr>`)}</tbody></table>
      <p class="small muted" style="margin-top:6px">Ereignisse hängen am Datum, nicht am Zufall des Moments –
        alle Spieler bekommen dieselben, und wer vorbaut, ist im Vorteil.</p>` : ""}`;
}

function calTab(ctx, now) {
  const s = ctx.state;
  const countries = [...new Set([...s.airline.hubs, ...s.routes.flatMap(r => [r.from, r.to])]
    .map(i => AIRPORT_BY_IATA[i]?.country).filter(Boolean))];
  const list = upcoming(now, 200);
  return html`
    <p class="small muted">Feiertage und Ferien verschieben die Nachfrage: Urlaubsreisen steigen,
      Geschäftsreisen brechen ein. Was euer Streckennetz betrifft, ist hervorgehoben.</p>
    ${list.map(e => {
      const hit = !e.countries || e.countries.some(c => countries.includes(c));
      const running = now >= e.from && now <= e.to;
      return html`<div class="card ${hit ? "hit" : ""}" style="${hit ? "" : "opacity:.6"}">
        <div class="row"><div class="grow"><b>${e.label}</b> ${running ? html`<span class="pill good">läuft</span>` : ""}
          <div class="small muted">${fmt.date(e.from)} – ${fmt.date(e.to)}${e.countries ? ` · ${e.countries.slice(0, 8).join(", ")}${e.countries.length > 8 ? " …" : ""}` : " · weltweit"}</div>
          <div class="small muted">${e.note}</div></div>
          <div class="r small"><span class="${e.leisure > 1 ? "good" : "muted"}">Urlaub ${pct(e.leisure)}</span><br>
            <span class="${e.biz < 1 ? "bad" : "muted"}">Geschäft ${pct(e.biz)}</span></div></div></div>`;
    })}`;
}

function apTab(ctx, v, now) {
  const s = ctx.state;
  const own = [...new Set([...s.airline.hubs, ...s.routes.flatMap(r => [r.from, r.to])])];
  const iata = v.ap || own[0];
  const found = v.q.trim().length >= 2 ? searchAirports(v.q.trim(), 8) : [];
  const d = iata ? describe(s, iata, now) : null;
  const a = AIRPORT_BY_IATA[iata];
  return html`
    <input class="in" style="width:100%" placeholder="Flughafen suchen …" data-act="q" value="${v.q}">
    ${found.length ? html`<div class="pick">${found.map(x => html`<button data-act="ap" data-iata="${x.iata}">${x.iata} · ${x.city}</button>`)}</div>` : ""}
    <div class="row wrap" style="margin-top:8px;gap:6px">${own.map(i => html`<button class="btn sm ${i === iata ? "p" : ""}" data-act="ap" data-iata="${i}">${i}</button>`)}</div>
    ${!d ? html`<div class="empty"><b>Noch kein Flughafen</b>Sobald ihr Strecken habt, stehen sie hier.</div>`
    : html`
      <div class="card" style="margin-top:10px">
        <div class="row"><div class="grow"><b style="font:700 18px var(--display)">${a.city}</b>
          <span class="code">${a.iata} · ${a.icao}</span></div>
          <button class="btn sm" data-act="focus" data-iata="${a.iata}">Auf Karte</button></div>
        ${d.lines.map(l => html`<p class="small" style="margin-top:8px">${l}</p>`)}
      </div>
      <h3 class="rep-h">Wo sich Strecken lohnen könnten</h3>
      <p class="small muted">Gefiltert auf das, was eure Flotte erreicht – rund ${fmt.km(d.reach)}.</p>
      <table class="t"><tbody>${d.routes.map(r => html`<tr><td><b>${r.to}</b> ${r.city}</td>
        <td class="muted">${fmt.km(r.km)}</td><td class="r">${fmt.int(r.market)} Pax/Tag Markt</td></tr>`)}</tbody></table>
      <p class="small muted" style="margin-top:6px">Markt heißt: alle Fluggäste dieser Richtung, nicht euer Anteil.
        Was davon zu euch kommt, hängt an Preis, Ruf und Bekanntheit.</p>`}`;
}

const pct = f => `${f >= 1 ? "+" : ""}${Math.round((f - 1) * 100)} %`;
