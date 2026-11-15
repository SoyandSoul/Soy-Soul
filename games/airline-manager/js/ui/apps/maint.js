// Wartungs-App: Status aller Checks pro Flugzeug, Warnungen, Checks planen oder sofort starten.
import { html } from "../dom.js";
import { fmt } from "../../core/util.js";
import { CHECKS } from "../../core/config.js";
import { typeOf } from "../../sim/flight.js";
import { checkStatus, checkCost, legRisk, condition } from "../../sim/maintenance.js";
import * as act from "../../sim/actions.js";

export default {
  id: "maint", title: "Wartung", icon: "maint", width: 760,
  initialView: () => ({ focus: null }),

  badge(ctx) {
    const now = ctx.now();
    let over = 0, due = 0;
    for (const ac of ctx.state.fleet) {
      if (ac.status === "crashed" || ac.status === "check") continue;
      const st = checkStatus(ac, now), ks = CHECKS.order.map(k => st[k].state);
      if (ks.includes("overdue")) over++; else if (ks.includes("due")) due++;
    }
    return over ? { n: over, kind: "bad" } : due ? { n: due, kind: "warn" } : null;
  },

  render(ctx, v) {
    const s = ctx.state, now = ctx.now();
    const fleet = s.fleet.filter(a => a.status !== "crashed" && a.status !== "delivery");
    if (!fleet.length) return html`<div class="empty"><b>Keine Flugzeuge im Dienst</b>Sobald deine Flotte fliegt, siehst du hier alle A-, B-, C- und D-Checks.</div>`;
    const sorted = [...fleet].sort((a, b) => worst(a, now) - worst(b, now));
    return html`
      <div class="card small" style="margin-bottom:10px">
        <b>So funktioniert's:</b> Checks werden nach Flugstunden <i>oder</i> Kalendertagen fällig. Mit <b>Auto</b> geht das Flugzeug bei der nächsten Rückkehr ans Drehkreuz automatisch in den Hangar.
        Überfällige Checks laufen ins Minus – je tiefer, desto höher das Risiko für Vorfälle und Abstürze.
        <div class="row wrap" style="margin-top:6px">${CHECKS.order.map(k => html`<span class="pill">${k}: ${fmt.int(CHECKS[k].fh)} FH / ${CHECKS[k].days} T · ${fmtDown(CHECKS[k].downH)}</span>`)}</div>
      </div>
      <table class="t"><thead><tr><th>Flugzeug</th>${CHECKS.order.map(k => html`<th class="r">${k}</th>`)}<th class="r">Risiko/Flug</th><th>Auto</th><th></th></tr></thead><tbody>
      ${sorted.map(ac => {
        const st = checkStatus(ac, now), t = typeOf(ac);
        const risk = legRisk(ac, now, 3);
        return html`<tr style="${v.focus === ac.id ? "background:rgba(255,176,0,.08)" : ""}">
          <td><b>${ac.reg}</b> <span class="muted small">${t.name}</span><div class="small muted">${ac.status === "check" ? `${ac.check.type}-Check bis ${fmt.dateTime(ac.check.until)}` : ac.scheduledCheck ? `${ac.scheduledCheck}-Check vorgemerkt` : `Zustand ${condition(ac, now)} %`}</div></td>
          ${CHECKS.order.map(k => html`<td class="r mono ${st[k].state === "overdue" ? "bad" : st[k].state === "due" ? "warn" : ""}">${fmt.fh(st[k].rem)}</td>`)}
          <td class="r small ${risk.crash > 0.0005 ? "bad" : risk.incident > 0.001 ? "warn" : "muted"}">${risk.crash ? (risk.crash * 100).toFixed(3) + " %" : "–"}</td>
          <td><input type="checkbox" data-act="auto" data-id="${ac.id}" ${ac.autoCheck ? "checked" : ""} aria-label="Automatische Checks"></td>
          <td class="r"><select class="in" data-act="req" data-id="${ac.id}" ${ac.status === "check" ? "disabled" : ""} style="padding:4px 6px">
            <option value="">Check …</option>${CHECKS.order.map(k => html`<option value="${k}">${k} · ${fmt.money(checkCost(s, ac, k))}</option>`)}</select></td>
        </tr>`;
      })}</tbody></table>
      <p class="small muted" style="margin-top:8px">Ein höherer Check deckt alle niedrigeren mit ab (C setzt auch A und B zurück). Steht das Flugzeug am Drehkreuz, beginnt der Check sofort – sonst nach der Rückkehr.${s.airline.contract ? ` Exklusivvertrag: −15 % auf ${s.airline.contract.maker}-Checks.` : ""}</p>`;
  },

  change(ctx, v, api) {
    return {
      auto: el => ctx.run(act.setAutoCheck, el.dataset.id, el.checked),
      req: el => {
        if (!el.value) return;
        const ac = ctx.state.fleet.find(a => a.id === el.dataset.id);
        const r = ctx.run(act.requestCheck, ac.id, el.value, ctx.now());
        if (r) ctx.toast(r.now ? `${ac.reg}: ${el.value}-Check gestartet.` : `${ac.reg}: ${el.value}-Check nach Rückkehr vorgemerkt.`, "good");
        api.rerender();
      }
    };
  }
};

function worst(ac, now) { const st = checkStatus(ac, now); return Math.min(...CHECKS.order.map(k => st[k].rem / CHECKS[k].fh)); }
const fmtDown = h => h < 48 ? `${h} h Standzeit` : `${Math.round(h / 24)} Tage Standzeit`;
