// Vermarktung: alles, was Geld bringt, ohne dass ein Linienflug dafür startet.
//   Werbung       – Kampagnen buchen, Bekanntheit aufbauen
//   Charter       – ein Flugzeug für ein paar Tage an einen Reiseveranstalter vermieten
//   Lackierungen  – die Außenhaut als Werbefläche vermieten

import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { MARKETING, CHARTER, ADLIVERY, DAY } from "../../core/config.js";
import * as act from "../../sim/actions.js";
import {
  awareness, awarenessNote, awarenessFactor, campaignQuote, activeCampaigns,
  campaignsOf, channelOf, spendPerDay, CHANNELS
} from "../../sim/marketing.js";
import { charterOffers, candidates as charterFits, routeProfitPerDay } from "../../sim/charter.js";
import { liveryOffers, quoteFor, candidates as liveryFits, activeLiveries, liveryIncomePerDay } from "../../sim/adlivery.js";
import { typeOf } from "../../sim/flight.js";

const TABS = [["ads", "Werbung"], ["charter", "Charter"], ["livery", "Lackierungen"]];
const days = (ms) => Math.max(0, Math.ceil(ms / DAY));

export default {
  id: "marketing", title: "Vermarktung", icon: "offer", width: 640,
  initialView: () => ({ tab: "ads", channel: "online", tier: 0, term: 14, pick: null }),

  render(ctx, v) {
    const now = ctx.now();
    return html`
      <div class="tabs">${TABS.map(([id, label]) => html`<button data-act="tab" data-tab="${id}" aria-selected="${String(v.tab === id)}">${label}</button>`)}</div>
      ${v.tab === "ads" ? ads(ctx, v, now) : v.tab === "charter" ? charter(ctx, v, now) : livery(ctx, v, now)}`;
  },

  click(ctx, v, api) {
    const now = () => ctx.now();
    return {
      channel: el => { v.channel = el.dataset.k; api.rerender(); },
      tier: el => { v.tier = +el.dataset.i; api.rerender(); },
      term: el => { v.term = +el.dataset.d; api.rerender(); },
      bookAd: () => {
        const r = ctx.run(act.bookCampaign, v.channel, v.tier, v.term, now());
        if (r) { ctx.toast(`${r.quote.label} läuft ${v.term} Tage.`, "good"); api.rerender(); }
      },
      pick: el => { v.pick = v.pick === el.dataset.id ? null : el.dataset.id; api.rerender(); },
      takeCharter: el => {
        const r = ctx.run(act.acceptCharter, el.dataset.id, el.dataset.ac, now());
        if (r) { ctx.toast(`${r.offer.operator}: Auftrag angenommen.`, "good"); v.pick = null; api.rerender(); }
      },
      dropCharter: el => { ctx.run(act.declineCharter, el.dataset.id); api.rerender(); },
      cancelCharter: el => {
        if (confirm("Charter abbrechen? Das kostet Vertragsstrafe und Ruf.")) {
          const r = ctx.run(act.cancelCharter, el.dataset.ac, now());
          if (r) { ctx.toast(`Abgebrochen, ${fmt.money(r.fee)} Vertragsstrafe.`, "warn"); api.rerender(); }
        }
      },
      takeLivery: el => {
        const r = ctx.run(act.acceptLivery, el.dataset.id, el.dataset.ac, now());
        if (r) { ctx.toast(`Vertrag steht, ${fmt.money(r.quote.upfront)} sofort.`, "good"); v.pick = null; api.rerender(); }
      },
      dropLivery: el => { ctx.run(act.declineLivery, el.dataset.id); api.rerender(); },
      endLivery: el => {
        if (confirm("Sonderlackierung vorzeitig beenden? Das kostet Vertragsstrafe.")) {
          const r = ctx.run(act.endLivery, el.dataset.ac, now());
          if (r) { ctx.toast(`Beendet, ${fmt.money(r.fee)} Vertragsstrafe.`, "warn"); api.rerender(); }
        }
      }
    };
  }
};

// ------------------------------------------------------------------ Werbung
function ads(ctx, v, now) {
  const s = ctx.state;
  const aw = awareness(s, now), note = awarenessNote(s, now);
  const running = activeCampaigns(s, now);
  const q = campaignQuote(v.channel, v.tier, v.term);
  const ch = channelOf(v.channel);
  const past = campaignsOf(s).filter(c => c.until <= now).slice(0, 4);

  return html`
    <div class="card">
      <div class="row"><b class="grow">Bekanntheit</b><b class="acc mono">${Math.round(aw)} / 100</b></div>
      <div class="track aw"><i style="width:${aw}%"></i><u style="left:${note.floor}%"></u></div>
      <div class="row wrap small muted" style="margin-top:6px">
        <span>${note.stand}</span><span>·</span><span>Trend ${note.dir}</span><span>·</span>
        <span>Nachfrage <b class="${awarenessFactor(s, now) >= 1 ? "good" : "warn"}">${awarenessFactor(s, now) >= 1 ? "+" : ""}${Math.round((awarenessFactor(s, now) - 1) * 100)} %</b></span>
        ${running.length ? html`<span>·</span><span>${fmt.money(spendPerDay(s, now))}/Tag in Kampagnen</span>` : ""}
      </div>
      <p class="small muted" style="margin-top:6px">Werbung füllt leere Sitze – sie schafft keine Nachfrage, wo die Flugzeuge schon voll sind.
        Die Markierung zeigt, wie bekannt ihr allein durch euer Streckennetz seid.</p>
    </div>

    ${running.length ? html`<h3 class="rep-h">Läuft gerade</h3>
      ${running.map(c => html`<div class="card row">
        <div class="grow"><b>${channelOf(c.channel).label}</b> <span class="pill">${MARKETING.tiers[c.tier].label}</span>
          <div class="small muted">noch ${days(c.until - now)} Tage · ${fmt.money(c.total)} bezahlt</div></div>
        <div class="r small muted">${fmt.money(c.perDay)}<br>pro Tag</div></div>`)}` : ""}

    <h3 class="rep-h">Kampagne buchen</h3>
    <div class="opt-list">${CHANNELS.map(k => {
      const c = channelOf(k), busy = running.some(r => r.channel === k);
      return html`<label class="${busy ? "off" : ""}"><input type="radio" name="mkch" ${v.channel === k ? "checked" : ""} ${busy ? "disabled" : ""} data-act="channel" data-k="${k}">
        <div><b>${c.label}</b> ${busy ? html`<span class="pill">läuft</span>` : ""}
          <div class="small muted">${c.note}</div>
          <div class="small muted">ab ${fmt.money(c.costPerDay)}/Tag · Anlauf ${c.ramp ? `${c.ramp} Tag${c.ramp > 1 ? "e" : ""}` : "sofort"} · wirkt ${c.halfLifeDays} Tage nach</div></div></label>`;
    })}</div>

    <div class="row wrap" style="margin-top:10px;gap:14px">
      <div><div class="small muted">Tarif</div><div class="tabs sm">${MARKETING.tiers.map((t, i) =>
        html`<button data-act="tier" data-i="${i}" aria-selected="${String(v.tier === i)}">${t.label}</button>`)}</div></div>
      <div><div class="small muted">Laufzeit</div><div class="tabs sm">${MARKETING.terms.map(d =>
        html`<button data-act="term" data-d="${d}" aria-selected="${String(v.term === d)}">${d} Tage</button>`)}</div></div>
    </div>

    ${q ? html`<div class="card" style="margin-top:10px">
      <div class="row"><div class="grow"><b>${q.label}, ${q.days} Tage</b>
        <div class="small muted">${fmt.money(q.perDay)} pro Tag · wird sofort in voller Höhe bezahlt</div></div>
        <b class="big-price">${fmt.money(q.total)}</b></div>
      <button class="btn p" style="width:100%;margin-top:10px" data-act="bookAd" ${ctx.state.cash < q.total || running.some(r => r.channel === v.channel) ? "disabled" : ""}>
        ${running.some(r => r.channel === v.channel) ? `Auf ${ch.label} läuft schon eine Kampagne` : `Buchen für ${fmt.money(q.total)}`}</button>
    </div>` : ""}

    ${past.length ? html`<h3 class="rep-h">Zuletzt gelaufen</h3>
      <table class="t"><tbody>${past.map(c => html`<tr><td>${channelOf(c.channel).label}, ${MARKETING.tiers[c.tier].label}</td>
        <td class="muted">${c.days} Tage</td><td class="r">${fmt.money(c.total)}</td></tr>`)}</tbody></table>` : ""}`;
}

// ------------------------------------------------------------------ Charter
function charter(ctx, v, now) {
  const s = ctx.state;
  const offers = charterOffers(s, now);
  const flying = s.fleet.filter(a => a.charter);
  return html`
    ${flying.length ? html`<h3 class="rep-h">Unterwegs</h3>
      ${flying.map(ac => html`<div class="card row">
        <div class="grow"><b>${ac.reg}</b> für ${ac.charter.operator} nach ${ac.charter.city}
          <div class="small muted">noch ${days(ac.charter.until - now)} von ${ac.charter.days} Tagen · Restsumme ${fmt.money(ac.charter.total - ac.charter.paid)} bei Rückkehr</div></div>
        <button class="btn sm danger" data-act="cancelCharter" data-ac="${ac.id}">Abbrechen</button></div>`)}` : ""}

    <h3 class="rep-h">Anfragen heute</h3>
    <p class="small muted">Der Veranstalter stellt Kerosin und Gebühren, wir stellen Flugzeug, Crew und Wartung.
      Das Flugzeug ist so lange aus dem Liniendienst – seine Strecke verliert Frequenz, die Flugstunden laufen trotzdem.</p>
    ${!offers.length ? html`<div class="empty"><b>Heute nichts dabei</b>Morgen fragen andere Veranstalter an.</div>`
    : offers.map(o => {
      const fits = charterFits(s, o);
      const open = v.pick === o.id;
      return html`<div class="card offer ${open ? "open" : ""}">
        <div class="row" data-act="pick" data-id="${o.id}">
          <div class="grow"><b>${o.city}</b> <span class="pill">${o.days} Tage</span>
            <div class="small muted">${o.operator} · ${fmt.int(o.km)} km · ${o.size === "wide" ? "Großraum" : "Schmalrumpf"}, rund ${o.seats} Sitze</div></div>
          <div class="r"><b class="acc">${fmt.money(o.total)}</b><div class="small muted">${fmt.money(o.perDay)}/Tag</div></div>
        </div>
        ${open ? html`<div class="offer-body">
          <div class="small muted" style="margin-bottom:8px">Anzahlung ${fmt.money(o.upfront)} sofort, Rest bei Rückkehr. Rund ${o.fh} Flugstunden gehen auf die Wartung, dafür gibt es nach sauberer Abwicklung +${CHARTER.repBonus} Ruf.</div>
          ${!fits.length ? html`<p class="small warn">Kein passendes Flugzeug: verlangt sind ${o.size === "wide" ? "ein Großraumflugzeug" : "ein Schmalrumpfflugzeug"} mit mindestens ${Math.round(o.seats * CHARTER.seatTolerance)} Sitzen und ${fmt.int(o.km)} km Reichweite, am Drehkreuz am Boden.</p>`
          : fits.map(ac => {
            const line = routeProfitPerDay(s, ac, now);
            return html`<div class="row pickrow">
              <div class="grow"><b>${ac.reg}</b> <span class="small muted">${typeOf(ac).name}${ac.ops ? " · fliegt gerade Linie" : " · steht"}</span>
                ${line != null ? html`<div class="small muted">Linie bringt zuletzt ${fmt.money(line)}/Tag – Charter ${fmt.money(o.perDay)}/Tag</div>` : ""}</div>
              <button class="btn sm p" data-act="takeCharter" data-id="${o.id}" data-ac="${ac.id}">Annehmen</button></div>`;
          })}
          <button class="btn sm" style="margin-top:8px" data-act="dropCharter" data-id="${o.id}">Ablehnen</button>
        </div>` : ""}</div>`;
    })}`;
}

// ------------------------------------------------------------ Lackierungen
function livery(ctx, v, now) {
  const s = ctx.state;
  const offers = liveryOffers(s, now);
  const running = activeLiveries(s, now);
  return html`
    ${running.length ? html`<h3 class="rep-h">Beklebt unterwegs</h3>
      ${running.map(ac => html`<div class="card row">
        <span class="swatch" style="background:linear-gradient(135deg,${ac.adLivery.colors[0]},${ac.adLivery.colors[1]})"></span>
        <div class="grow"><b>${ac.reg}</b> für ${ac.adLivery.client}
          <div class="small muted">noch ${days(ac.adLivery.until - now)} von ${ac.adLivery.days} Tagen · ${fmt.money(ac.adLivery.perDay)}/Tag</div></div>
        <button class="btn sm danger" data-act="endLivery" data-ac="${ac.id}">Beenden</button></div>`)}
      <p class="small muted">Zusammen ${fmt.money(liveryIncomePerDay(s, now))} am Tag. Jede Fremdlackierung kostet etwas Ruf.</p>` : ""}

    <h3 class="rep-h">Anfragen diese Woche</h3>
    <p class="small muted">Das Flugzeug fliegt normal weiter und verdient normal – die Fläche gibt es obendrauf.
      Dafür verschwindet die eigene Marke darunter, und für die Lackierung steht es einmal still.</p>
    ${!offers.length ? html`<div class="empty"><b>Diese Woche keine Anfragen</b>Mit wachsender Bekanntheit melden sich mehr Kunden.</div>`
    : offers.map(o => {
      const fits = liveryFits(s, o), open = v.pick === o.id;
      const sample = fits[0] ? quoteFor(s, o, fits[0], now) : null;
      return html`<div class="card offer ${open ? "open" : ""}">
        <div class="row" data-act="pick" data-id="${o.id}">
          <span class="swatch" style="background:linear-gradient(135deg,${o.colors[0]},${o.colors[1]})"></span>
          <div class="grow"><b>${o.client}</b> <span class="pill">${o.days} Tage</span>
            <div class="small muted">${o.branch}</div></div>
          ${sample ? html`<div class="r"><b class="acc">${fmt.money(sample.total)}</b><div class="small muted">${fmt.money(sample.perDay)}/Tag</div></div>` : ""}
        </div>
        ${open ? html`<div class="offer-body">
          ${!fits.length ? html`<p class="small warn">Kein freies Flugzeug – alle tragen schon Werbung oder sind unterwegs.</p>`
          : fits.map(ac => {
            const q = quoteFor(s, o, ac, now);
            return html`<div class="row pickrow">
              <div class="grow"><b>${ac.reg}</b> <span class="small muted">${typeOf(ac).name}</span>
                <div class="small muted">${fmt.money(q.upfront)} sofort, dann ${fmt.money(q.perDay)}/Tag · ${q.paintH} h Lackiererei</div></div>
              <button class="btn sm p" data-act="takeLivery" data-id="${o.id}" data-ac="${ac.id}">Vermieten</button></div>`;
          })}
          <button class="btn sm" style="margin-top:8px" data-act="dropLivery" data-id="${o.id}">Ablehnen</button>
        </div>` : ""}</div>`;
    })}
    <p class="small muted" style="margin-top:10px">Große Flugzeuge, guter Ruf und hohe Bekanntheit machen die Fläche wertvoller –
      ab ${ADLIVERY.repMax} Punkten Rufabzug lohnt es sich nicht mehr.</p>`;
}
