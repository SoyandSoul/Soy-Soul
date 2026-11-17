// Rangliste: alle gelisteten Airlines mit Bewertung – Sterne, Größe, Wirtschaftlichkeit.
// Eine Zeile antippen zeigt das Kurzprofil: Flotte, Ziele und grobe Finanzzahlen.

import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { RATING, STOCKS } from "../../core/config.js";
import { rate, ratingNote, profileOf, qualifies } from "../../sim/rating.js";
import { stakeIn } from "../../sim/stocks.js";
import { AIRCRAFT_BY_ID } from "../../data/aircraft.js";
import { AIRPORT_BY_IATA } from "../../data/airports.js";

const SORTS = [["price", "Aktienkurs"], ["size", "Größe"], ["efficiency", "Wirtschaftlichkeit"], ["stars", "Sterne"], ["fleet", "Flotte"]];
const starBar = n => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

export default {
  id: "board", title: "Rangliste", icon: "board", width: 620,
  initialView: () => ({ sort: "price", open: null }),

  render(ctx, v) {
    const s = ctx.state, now = ctx.now();
    const mine = profileOf(s, now);
    const list = ctx.listings().map(l => {
      const p = l.code === s.player.code ? mine : (l.profile || { fleet: l.fleet, rep: l.rep });
      const r = rate({ ...p, rep: p.rep ?? l.rep ?? 0 });
      return { ...l, profile: p, ...r };
    }).sort((a, b) => (b[v.sort] ?? 0) - (a[v.sort] ?? 0));
    const myRank = list.findIndex(l => l.code === s.player.code) + 1;
    const myRating = rate(mine);

    return html`
      <div class="row" style="margin-bottom:10px">
        <div class="grow"><b style="font:700 22px var(--display)">Platz ${myRank || "–"}</b>
          <span class="muted small">von ${list.length}</span></div>
        <select class="in" data-act="sort">${SORTS.map(([k, label]) =>
          html`<option value="${k}" ${v.sort === k ? "selected" : ""}>${label}</option>`)}</select></div>

      ${!qualifies(mine) ? html`<div class="note warn" style="margin-bottom:10px"><b>Noch nicht gelistet</b>
        <span>Ab ${RATING.minFleet} Flugzeugen erscheint eure Airline in Börse und Rangliste. Aktuell: ${mine.fleet}.</span></div>`
      : html`<div class="card" style="margin-bottom:10px">
          <div class="row"><div class="grow"><b>${s.airline.name}</b> <span class="code">${s.player.code}</span>
            <div class="small muted">${ratingNote(myRating)}</div></div>
            <div class="r"><b class="acc">${starBar(myRating.stars)}</b><div class="small muted">${myRating.stars.toFixed(1)} von 5</div></div></div>
          <div class="grid2" style="margin-top:10px">
            <div><div class="small muted">Größe</div><div class="bar"><i style="width:${myRating.size}%;background:var(--info)"></i></div><b class="small">${myRating.size} / 100</b></div>
            <div><div class="small muted">Wirtschaftlichkeit</div><div class="bar"><i style="width:${myRating.efficiency}%;background:var(--good)"></i></div><b class="small">${myRating.efficiency} %</b></div>
          </div>
          ${s.lastPublish ? html`<p class="small muted" style="margin-top:8px">Zuletzt veröffentlicht ${fmt.dateTime(s.lastPublish)} – der Eintrag wird alle zwei Stunden aufgefrischt.</p>` : ""}
        </div>`}

      ${ctx.market.demo ? html`<p class="small warn" style="margin-bottom:8px">Demo-Daten – echte Spieler erscheinen, sobald das Backend eingerichtet ist.</p>` : ""}

      <table class="t board"><thead><tr><th>#</th><th>Airline</th><th class="r">Aktie</th><th class="r">Sterne</th><th class="r">Größe</th><th class="r">Wirt.</th></tr></thead><tbody>
      ${list.map((l, i) => html`
        <tr class="${l.code === s.player.code ? "me" : ""} ${v.open === l.code ? "open" : ""}" data-act="open" data-code="${l.code}">
          <td>${i + 1}</td>
          <td><b>${l.name}</b> <span class="muted small">${l.iata}${l.hub ? ` · ${l.hub}` : ""}</span>
            <div class="code small">${l.code}</div></td>
          <td class="r mono">${fmt.price(l.price)}</td>
          <td class="r acc">${l.stars.toFixed(1)}</td>
          <td class="r">${l.size}</td>
          <td class="r">${l.efficiency} %</td>
        </tr>
        ${v.open === l.code ? html`<tr class="detail"><td colspan="6">${detail(ctx, l)}</td></tr>` : ""}`)}
      </tbody></table>
      <p class="small muted" style="margin-top:8px">Sterne kommen aus der Reputation, Größe aus Flotte, Personal, Zielen und
        Fluggästen, Wirtschaftlichkeit aus Marge und Ergebnis je Flugzeug. Eine Zeile antippen zeigt mehr.</p>`;
  },

  click(ctx, v, api) {
    return { open: el => { v.open = v.open === el.dataset.code ? null : el.dataset.code; api.rerender(); } };
  },

  change(ctx, v, api) { return { sort: el => { v.sort = el.value; api.rerender(); } }; }
};

/** Kurzprofil einer fremden Airline – so viel, wie sie veröffentlicht hat. */
function detail(ctx, l) {
  const p = l.profile || {};
  const stake = stakeIn(ctx.state, l);
  const types = (p.types || []).map(t => AIRCRAFT_BY_ID[t]?.name || t);
  const dests = (p.routes || []).map(r => r.split("-")[1]).filter((x, i, a) => x && a.indexOf(x) === i);
  return html`
    <div class="row wrap small" style="gap:14px">
      <span>Flotte <b>${p.fleet ?? "–"}</b></span>
      <span>Personal <b>${p.staff != null ? fmt.int(p.staff) : "–"}</b></span>
      <span>Ziele <b>${p.destinations ?? "–"}</b></span>
      <span>Fluggäste <b>${p.pax != null ? fmt.int(p.pax) : "–"}</b></span>
      <span>Marge <b>${p.margin != null ? Math.round(p.margin * 100) + " %" : "–"}</b></span>
      <span>Ergebnis 30 Tage <b>${p.profit30 != null ? fmt.money(p.profit30) : "–"}</b></span>
    </div>
    ${types.length ? html`<div class="small muted" style="margin-top:6px">Muster: ${types.join(", ")}</div>` : ""}
    ${dests.length ? html`<div class="small muted">Ziele: ${dests.slice(0, 14).map(d => AIRPORT_BY_IATA[d]?.city || d).join(", ")}${dests.length > 14 ? " …" : ""}</div>` : ""}
    ${stake > 0 ? html`<div class="small good" style="margin-top:6px">Ihr haltet ${(stake * 100).toFixed(1)} % dieser Airline
      (erlaubt sind ${Math.round(STOCKS.maxStake * 100)} %).</div>` : ""}
    ${l.updated ? html`<div class="small muted" style="margin-top:6px">Stand ${fmt.dateTime(l.updated)}</div>` : ""}`;
}
