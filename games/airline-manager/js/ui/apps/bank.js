// Bank: Kredite aufnehmen, laufende Kredite sehen, vorzeitig ablösen.
// Daneben der Blick, den eine Bank auch hätte: Was ist an Verpflichtungen schon gebunden?

import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { CREDIT } from "../../core/config.js";
import * as act from "../../sim/actions.js";
import { creditLimit, interestRate, quote, openLoans, loansOf, totalDebt, monthlyLoad, payoffQuote, debtNote, MONTH } from "../../sim/credit.js";
import { monthlyObligation } from "../../sim/lease.js";
import { gaugeBar } from "../chart.js";

const MODES = [["annuity", "Annuität", "Jeden Monat dieselbe Rate aus Zins und Tilgung. Planbar."],
               ["bullet", "Endfällig", "Monatlich nur Zinsen, die ganze Summe am Ende. Billig im Betrieb, teuer am Schluss."]];

export default {
  id: "bank", title: "Bank", icon: "bank", width: 600,
  initialView: () => ({ amount: null, months: 24, mode: "annuity" }),

  render(ctx, v) {
    const s = ctx.state, now = ctx.now();
    const limit = creditLimit(s, now);
    const note = debtNote(s, now);
    const amount = Math.min(v.amount ?? Math.round(limit / 2 / 1e5) * 1e5, limit);
    const q = amount >= CREDIT.minAmount ? quote(s, now, amount, v.months, v.mode) : null;
    const loans = openLoans(s);

    return html`
      <div class="card">
        <div class="row"><div class="grow"><div class="small muted">Freier Kreditrahmen</div>
          <div class="big-price">${fmt.money(limit)}</div></div>
          <div class="r"><div class="small muted">Restschuld</div><b>${fmt.money(note.debt)}</b></div></div>
        ${raw(gaugeBar(note.debt
          ? [{ v: note.debt, color: "var(--bad)" }, { v: Math.max(limit, 1), color: "var(--accent)" }]
          : [{ v: 1, color: "var(--accent)" }]))}
        <div class="row small muted" style="margin-top:4px">
          ${note.debt ? html`<span><i class="dot wv-d" style="background:var(--bad)"></i> Restschuld</span>` : ""}
          <span><i class="dot wv-d"></i> freier Rahmen</span></div>
        <div class="row wrap small muted" style="margin-top:6px">
          <span>${note.text}</span><span>·</span>
          <span>Kreditraten ${fmt.money(note.load)}/Monat</span><span>·</span>
          <span>Leasing ${fmt.money(note.lease)}/Monat</span>
        </div>
        <p class="small muted" style="margin-top:6px">Der Rahmen wächst mit dem Ertrag der letzten 30 Tage und mit eigenen Flugzeugen –
          geleaste gehören dem Leasinggeber und taugen nicht als Sicherheit. Laufende Verpflichtungen ziehen ihn wieder zusammen.</p>
      </div>

      ${loans.length ? html`<h3 class="rep-h">Laufende Kredite</h3>
        ${loans.map(l => {
          const po = payoffQuote(s, l.id);
          return html`<div class="card">
            <div class="row"><div class="grow"><b>${fmt.money(l.rest)}</b> offen bei ${l.bank}
              <div class="small muted">${(l.rate * 100).toFixed(2)} % · ${l.mode === "annuity" ? "Annuität" : "endfällig"} ·
                Rate ${fmt.money(l.payment)} · noch ${Math.max(0, l.months - l.paidCount)} von ${l.months} Monaten ·
                nächste am ${fmt.date(l.nextDue)}</div>
              ${l.missed ? html`<div class="small bad">${l.missed} Rate(n) nicht bedient – Restschuld und Laufzeit sind gewachsen.</div>` : ""}</div>
              <button class="btn sm" data-act="payoff" data-id="${l.id}" ${s.cash < po.total ? "disabled" : ""}>
                Ablösen ${fmt.money(po.total)}</button></div>
            ${l.mode === "bullet" ? html`<p class="small warn" style="margin-top:6px">
              Am ${fmt.date(l.start + l.months * MONTH)} werden ${fmt.money(l.amount)} auf einmal fällig.</p>` : ""}</div>`;
        })}` : ""}

      <h3 class="rep-h">Neuer Kredit</h3>
      ${limit < CREDIT.minAmount ? html`<div class="empty"><b>Die Bank gibt gerade nichts</b>
        Der Rahmen steigt mit dem Ertrag der letzten 30 Tage, mit eigenen Flugzeugen und sinkenden Verpflichtungen.</div>`
      : html`<div class="card">
        <label class="stack"><span class="small muted">Summe: <b class="acc">${fmt.money(amount)}</b></span>
          <input type="range" min="${CREDIT.minAmount}" max="${limit}" step="100000" value="${amount}" data-act="amount"></label>
        <div class="row wrap" style="margin-top:12px;gap:14px">
          <div><div class="small muted">Laufzeit</div><div class="tabs sm">${CREDIT.terms.map(m =>
            html`<button data-act="months" data-m="${m}" aria-selected="${String(v.months === m)}">${m / 12} ${m === 12 ? "Jahr" : "Jahre"}</button>`)}</div></div>
        </div>
        <div class="opt-row" style="margin-top:10px">${MODES.map(([k, label, note]) =>
          html`<button class="opt ${v.mode === k ? "on" : ""}" data-act="mode" data-k="${k}"><b>${label}</b><span>${note}</span></button>`)}</div>
        ${q ? html`<table class="t" style="margin-top:12px"><tbody>
          <tr><td>Zinssatz</td><td class="r">${(q.rate * 100).toFixed(2)} % p. a.</td></tr>
          <tr><td>Monatliche Rate</td><td class="r"><b>${fmt.money(q.payment)}</b></td></tr>
          ${q.balloon ? html`<tr><td>Schlusszahlung</td><td class="r">${fmt.money(q.balloon)}</td></tr>` : ""}
          <tr><td>Zinsen insgesamt</td><td class="r">${fmt.money(q.interest)}</td></tr>
          <tr><td>Bearbeitungsgebühr</td><td class="r">${fmt.money(q.fee)}</td></tr>
          <tr><td>Auszahlung heute</td><td class="r good">${fmt.money(q.amount - q.fee)}</td></tr>
        </tbody></table>
        <button class="btn p" style="width:100%;margin-top:10px" data-act="take">${fmt.money(amount)} aufnehmen</button>
        <p class="small muted" style="margin-top:6px">Erste Rate in einem Monat. Reicht die Kasse bei Fälligkeit nicht,
          wächst die Restschuld um ${Math.round(CREDIT.missedPenalty * 100)} % der Rate und der Ruf sinkt um ${CREDIT.missedRep} Punkte –
          ein Spielende gibt es nicht.</p>` : ""}
      </div>`}

      ${loansOf(s).some(l => l.rest <= 0) ? html`<h3 class="rep-h">Abgeschlossen</h3>
        <table class="t"><tbody>${loansOf(s).filter(l => l.rest <= 0).slice(0, 5).map(l =>
          html`<tr><td>${l.bank}</td><td class="muted">${l.months} Monate</td><td class="r">${fmt.money(l.amount)}</td></tr>`)}</tbody></table>` : ""}`;
  },

  click(ctx, v, api) {
    return {
      months: el => { v.months = +el.dataset.m; api.rerender(); },
      mode: el => { v.mode = el.dataset.k; api.rerender(); },
      take: () => {
        const limit = creditLimit(ctx.state, ctx.now());
        const amount = Math.min(v.amount ?? Math.round(limit / 2 / 1e5) * 1e5, limit);
        const r = ctx.run(act.takeLoan, amount, v.months, v.mode, ctx.now());
        if (r) { ctx.toast(`${fmt.money(amount)} von ${r.loan.bank}.`, "good"); v.amount = null; api.rerender(); }
      },
      payoff: el => {
        const r = ctx.run(act.repayLoan, el.dataset.id, ctx.now());
        if (r) { ctx.toast(`Abgelöst für ${fmt.money(r.paid)}.`, "good"); api.rerender(); }
      }
    };
  },

  input(ctx, v, api) {
    return { amount: el => { v.amount = +el.value; api.rerender(); } };
  }
};
