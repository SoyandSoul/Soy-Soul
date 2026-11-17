// Flugzeugmarkt: Neubestellung bei Airbus/Boeing und Gebrauchtmarkt des Tages.
import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { AIRCRAFT, AIRCRAFT_BY_ID, MAKERS } from "../../data/aircraft.js";
import { CHECKS } from "../../core/config.js";
import { canOrderNew, newOrderQuote, usedListings, listPrice, MARKET_FACTOR, deliveryDelay, condEffects } from "../../sim/market.js";
import { leaseQuote, leaseFrame, frameBlock } from "../../sim/lease.js";
import { LEASE } from "../../core/config.js";
import { GAME } from "../../core/config.js";
import { sideView } from "../aircraftArt.js";
import { datasheet, condLine } from "../datasheet.js";
import * as act from "../../sim/actions.js";

export default {
  id: "shop", title: "Flugzeugmarkt", icon: "shop", width: 860,
  initialView: () => ({ tab: "new", maker: "all", sort: "seats", mode: "buy", months: LEASE.defaultTerm }),

  render(ctx, v) {
    const s = ctx.state, c = s.airline.contract;
    return html`
      <div class="row wrap" style="margin-bottom:10px">
        <div class="tabs" style="margin:0">${[["new", "Neu ab Werk"], ["used", "Gebraucht"]].map(([id, l]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${l}</button>`)}</div>
        <span class="grow"></span>
        <select class="in" data-act="maker">${[["all", "Alle Hersteller"], ...MAKERS.map(m => [m, m])].map(([id, l]) => html`<option value="${id}" ${v.maker === id ? "selected" : ""}>${l}</option>`)}</select>
        <select class="in" data-act="sort">${[["seats", "Nach Sitzen"], ["price", "Nach Preis"], ["range", "Nach Reichweite"]].map(([id, l]) => html`<option value="${id}" ${v.sort === id ? "selected" : ""}>${l}</option>`)}</select>
      </div>
      <div class="row wrap" style="margin-bottom:10px">
        <div class="tabs" style="margin:0">${[["buy", "Kaufen"], ["lease", "Leasen"]].map(([id, l]) => html`<button data-act="mode" data-mode="${id}" aria-selected="${String(v.mode === id)}">${l}</button>`)}</div>
        ${v.mode === "lease" ? html`<select class="in" data-act="months">${LEASE.terms.map(t => html`<option value="${t.months}" ${v.months === t.months ? "selected" : ""}>${t.months} Monate${t.factor > 1 ? ` (+${Math.round((t.factor - 1) * 100)} %)` : t.factor < 1 ? ` (−${Math.round((1 - t.factor) * 100)} %)` : ""}</option>`)}</select>
          ${frameLine(ctx)}` : ""}
      </div>
      ${deliveryNote(ctx.state)}
      ${c ? html`<p class="small" style="margin-bottom:10px"><span class="pill good">Exklusivvertrag ${c.maker}</span> <span class="muted">Mengenrabatt auf Neubestellungen, −15 % auf Checks.</span></p>`
          : html`<p class="small muted" style="margin-bottom:10px">Tipp: Ein Exklusivvertrag (Airline → Verträge) bringt Mengenrabatte und günstigere Wartung – sperrt aber Neubestellungen beim anderen Hersteller.</p>`}
      ${v.tab === "used" ? used(ctx, v) : newer(ctx, v)}`;
  },

  click(ctx, v, api) {
    return {
      buyNew: el => {
        const qty = Math.max(1, +el.closest(".shop-item").querySelector("[name=qty]").value || 1);
        const r = ctx.run(act.orderNew, el.dataset.id, qty, ctx.now());
        if (!r) return;
        const late = r.aircraft.filter(a => a.availableAt), now = ctx.now();
        ctx.toast(`${qty}× ${AIRCRAFT_BY_ID[el.dataset.id].name} gekauft für ${fmt.money(r.cost)}. ` + (late.length ? `${qty - late.length ? `${qty - late.length} sofort einsatzbereit, ` : ""}Lieferung ${late.length > 1 ? "ab" : "in"} ${fmt.duration(late[0].availableAt - now)} – Countdown im Hangar.` : "Sofort einsatzbereit!"), "good", 6000);
      },
      buyUsed: el => {
        const r = ctx.run(act.buyUsed, el.dataset.id, ctx.now());
        if (r) ctx.toast(r.aircraft.availableAt ? `${r.aircraft.reg} gekauft – Überführung dauert ${fmt.duration(r.aircraft.availableAt - ctx.now())}.` : `${r.aircraft.reg} gekauft und sofort einsatzbereit!`, "good", 6000);
      },
      leaseNew: el => {
        const r = ctx.run(act.leaseNew, el.dataset.id, v.months, ctx.now());
        if (r) ctx.toast(`${r.aircraft.reg} geleast bei ${r.aircraft.lease.lessor}: ${fmt.money(r.quote.rate)} pro Monat für ${v.months} Monate. Kaution ${fmt.money(r.quote.deposit)} hinterlegt.`, "good", 7000);
      },
      leaseUsed: el => {
        const r = ctx.run(act.leaseUsed, el.dataset.id, v.months, ctx.now());
        if (r) ctx.toast(`${r.aircraft.reg} geleast bei ${r.aircraft.lease.lessor}: ${fmt.money(r.quote.rate)} pro Monat.`, "good", 7000);
      },
      mode: el => { v.mode = el.dataset.mode; api.rerender(); }
    };
  },

  change(ctx, v, api) {
    return { maker: el => { v.maker = el.value; api.rerender(); }, sort: el => { v.sort = el.value; api.rerender(); }, months: el => { v.months = +el.value; api.rerender(); } };
  },

  input(ctx, v) {
    return {
      qty: el => {
        const card = el.closest(".shop-item"), t = AIRCRAFT_BY_ID[card.dataset.type];
        const q = newOrderQuote(ctx.state, t, Math.max(1, +el.value || 1));
        card.querySelector("[data-total]").textContent = fmt.money(q.total) + (q.disc ? ` (−${Math.round(q.disc * 100)} %)` : "");
      }
    };
  }
};

const sorters = { seats: (a, b) => a.seats - b.seats, price: (a, b) => a.priceM - b.priceM, range: (a, b) => a.rangeKm - b.rangeKm };

function specs(t) {
  return html`<div class="specs">
    <div><span>Sitze</span><b>${t.seats} / ${t.seatsMax}</b></div>
    <div><span>Reichweite</span><b>${fmt.km(t.rangeKm)}</b></div>
    <div><span>Speed</span><b>${t.cruiseKmh} km/h</b></div>
    <div><span>Min. Bahn</span><b>${fmt.int(t.runwayM)} m</b></div>
    <div><span>Verbrauch</span><b>${fmt.dec(t.fuelKgH / 1000)} t/h</b></div>
    <div><span>Nutzlast</span><b>${fmt.dec(t.payloadKg / 1000)} t</b></div>
    <div><span>Unterhalt</span><b>$${fmt.int(t.maintFH)}/h</b></div>
    <div><span>Crew</span><b title="Cockpit + min. Kabine · Techniker">${t.crew.pilots}+${t.crew.cabin} · ${t.crew.techs}T</b></div>
  </div>`;
}

function newer(ctx, v) {
  const s = ctx.state;
  const list = AIRCRAFT.filter(t => t.inProd && (v.maker === "all" || t.maker === v.maker)).sort(sorters[v.sort]);
  return html`<div class="shop-grid">${list.map(t => {
    const block = canOrderNew(s, t), q = newOrderQuote(s, t, 1);
    return html`<article class="shop-item" data-type="${t.id}">
      <div class="art">${raw(sideView(t, s.airline.livery))}</div>
      <div class="info">
        <h3>${t.name}<small>${t.maker}</small></h3>
        ${specs(t)}
        <details class="ds-wrap"><summary>Datenblatt</summary>${datasheet(t, null, { compact: true })}</details>
        ${v.mode === "lease" ? leaseLine(ctx, v, t, block, { id: t.id, act: "leaseNew" }) : html`
        <div class="price-line"><div><b>${fmt.money(q.unit * (1 - q.disc))}</b><br><s>Liste ${fmt.money(listPrice(t))}</s></div>
          <div class="row"><input class="in" type="number" name="qty" min="1" max="50" value="1" data-act="qty" style="width:56px" ${block ? "disabled" : ""}><button class="btn p sm" data-act="buyNew" data-id="${t.id}" ${block ? "disabled" : ""}>Bestellen</button></div></div>
        <div class="small ${block ? "warn" : "muted"}">${block || html`Gesamt: <span data-total>${fmt.money(q.total)}</span> · Lieferung ${leadTime(s, t, false)}`}</div>`}
      </div></article>`;
  })}</div>
  <p class="small muted" style="margin-top:10px">Preise: Listenpreis × ${MARKET_FACTOR} (übliche Kundenrabatte). Werte sind Richtwerte nach Herstellerangaben.</p>`;
}

function used(ctx, v) {
  const s = ctx.state, now = ctx.now();
  const list = usedListings(now).filter(l => v.maker === "all" || AIRCRAFT_BY_ID[l.typeId].maker === v.maker);
  const next = new Date(now); next.setUTCHours(24, 0, 0, 0);
  return html`<p class="small muted" style="margin-bottom:10px">Neue Angebote in ${fmtLeft(next - now)} · Alle Spieler sehen dieselbe Liste.</p>
  <div class="shop-grid">${list.map(l => {
    const t = AIRCRAFT_BY_ID[l.typeId], sold = s.market.boughtUsed.includes(l.id);
    const cRem = CHECKS.C.fh - l.maint.C.fh, dRem = CHECKS.D.fh - l.maint.D.fh;
    return html`<article class="shop-item">
      <div class="art">${raw(sideView(t, null))}</div>
      <div class="info">
        <h3>${t.name}<small>${t.maker} · ${l.seller}</small></h3>
        <div class="specs">
          <div><span>Alter</span><b>${l.age} J.</b></div><div><span>Std.</span><b>${fmt.int(l.hours)}</b></div>
          <div><span>C in</span><b class="${cRem < 800 ? "warn" : ""}">${fmt.int(cRem)} h</b></div><div><span>D in</span><b class="${dRem < 2000 ? "warn" : ""}">${fmt.int(dRem)} h</b></div>
          <div><span>Reichw.</span><b>${fmt.int(t.rangeKm * (1 + condEffects(l.cond).range))} km</b></div><div><span>Sitze</span><b>${t.seats}</b></div>
        </div>
        <div>${condLine(l.cond)}</div>
        ${l.nearHeavy ? html`<div class="small warn">Schwerer Check steht bald an – daher günstiger.</div>` : ""}
        <details class="ds-wrap"><summary>Datenblatt</summary>${datasheet(t, { cond: l.cond, aux: 0 }, { compact: true })}</details>
        <div class="small muted">Übergabe ${leadTime(s, t, true)}</div>
        ${v.mode === "lease" ? leaseLine(ctx, v, t, sold ? "Dieses Angebot ist vergeben." : null, { id: l.id, act: "leaseUsed", used: l })
          : html`<div class="price-line"><b>${fmt.money(l.price)}</b><button class="btn p sm" data-act="buyUsed" data-id="${l.id}" ${sold ? "disabled" : ""}>${sold ? "Gekauft" : "Kaufen"}</button></div>`}
      </div></article>`;
  })}</div>`;
}

/** Leasingzeile: Monatsrate, Kaution und was sofort fällig wird. */
function leaseLine(ctx, v, t, block, { id, act: action, used = null }) {
  const q = leaseQuote(ctx.state, t, { months: v.months, used });
  const fb = block || frameBlock(ctx.state, ctx.now(), q.rate) || (q.upfront > ctx.state.cash ? `Sofort fällig wären ${fmt.money(q.upfront)} – nicht genug Geld.` : null);
  return html`<div class="price-line"><div><b>${fmt.money(q.rate)}</b><br><small class="muted">pro Monat · ${v.months} Monate</small></div>
      <button class="btn p sm" data-act="${action}" data-id="${id}" ${fb ? "disabled" : ""}>Leasen</button></div>
    <div class="small ${fb ? "warn" : "muted"}">${fb || html`Kaution ${fmt.money(q.deposit)} · sofort fällig ${fmt.money(q.upfront)} · ${q.reservePerFH} $ je Flugstunde Rücklage`}</div>`;
}

/** Wie viel Leasingrahmen noch frei ist. */
function frameLine(ctx) {
  const fr = leaseFrame(ctx.state, ctx.now());
  const pctUsed = fr.max ? Math.min(100, fr.used / fr.max * 100) : 100;
  return html`<span class="grow"></span><div class="frame-chip" title="Der Rahmen wächst mit Betriebsergebnis und Reputation">
    <span>Leasingrahmen</span><b>${fmt.money(fr.free)} frei</b>
    <div class="bar"><i style="width:${pctUsed}%;background:var(--c-fleet)"></i></div></div>`;
}

function leadTime(s, t, used) { const d = deliveryDelay(s, t, { used }); return d ? "in " + fmt.duration(d).replace(/ 0 min$/, "") : "sofort"; }
function deliveryNote(s) {
  const left = GAME.instantDeliveries - (s.ordered || 0);
  return left > 0 ? html`<p class="small" style="margin-bottom:10px"><span class="pill good">Startbonus</span> Die nächsten ${left} Flugzeuge werden sofort geliefert – danach gelten echte Lieferzeiten.</p>` : "";
}
const fmtLeft = ms => `${Math.floor(ms / 3600000)} h ${Math.floor(ms / 60000) % 60} min`;
