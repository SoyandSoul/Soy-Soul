// Wartung: A-, B-, C-, D-Checks nach Flugstunden oder Kalendertagen (was zuerst eintritt).
// Überfällige Checks laufen ins Minus. Je weiter im Minus, desto höher das Risiko für Vorfälle und Abstürze.

import { condEffects } from "./market.js";
import { CHECKS, CONTRACT, DAY, H } from "../core/config.js";
import { typeOf } from "./flight.js";

/** Neues Flugzeug: alle Zähler auf null. Gebrauchte bekommen Startwerte vom Markt. */
export function freshMaintenance(ts) {
  const m = {};
  for (const k of CHECKS.order) m[k] = { fh: 0, at: ts };
  return m;
}

/** Status pro Check: verbleibende Stunden (negativ = überfällig) und Tage. */
export function checkStatus(ac, ts) {
  const out = {};
  for (const k of CHECKS.order) {
    const c = CHECKS[k], m = ac.maint[k];
    const remFH = c.fh - m.fh;
    const remDays = c.days - (ts - m.at) / DAY;
    // Kalenderüberfälligkeit wird in äquivalente Flugstunden umgerechnet, damit es eine Zahl gibt.
    const remEq = Math.min(remFH, remDays / c.days * c.fh);
    const over = Math.max(0, -remEq) / c.fh;
    out[k] = {
      remFH, remDays, rem: remEq, overRatio: over,
      state: remEq < 0 ? "overdue" : (remFH < CHECKS.warnFH || remDays < CHECKS.warnDays) ? "due" : "ok"
    };
  }
  return out;
}

/** Der dringendste fällige Check (höchste Stufe bei Gleichstand), oder null */
export function mostUrgent(ac, ts) {
  const st = checkStatus(ac, ts);
  let best = null;
  for (const k of CHECKS.order) if (st[k].state !== "ok") best = k; // höhere Stufe gewinnt, sie deckt die niedrigeren ab
  return best ? { check: best, ...st[best] } : null;
}

/** Zustand 0..100 % für die Anzeige (Verschleiß seit dem letzten A/B/C-Check gewichtet) */
export function condition(ac, ts) {
  const st = checkStatus(ac, ts);
  const used = CHECKS.order.reduce((s, k) => s + CHECKS[k].risk * (1 - st[k].rem / CHECKS[k].fh), 0) / CHECKS.order.reduce((s, k) => s + CHECKS[k].risk, 0);
  return Math.max(0, Math.round(100 * (1 - used * 0.6)));
}

/** Wahrscheinlichkeit pro Flug für Absturz bzw. Vorfall */
export function legRisk(ac, ts, blockH) {
  const st = checkStatus(ac, ts);
  let w = 0;
  for (const k of CHECKS.order) w += CHECKS[k].risk * Math.pow(st[k].overRatio, CHECKS.riskExp);
  const crash = Math.min(0.5, CHECKS.riskPerFH * w * blockH);
  // Gebrauchte Maschinen in schlechtem Zustand: zusätzlich ungeplante Defekte (keine Abstürze, aber Kosten + Standzeit)
  const fault = Math.min(0.6, condEffects(ac.cond).faultPerBlockH * blockH);
  return { crash, incident: Math.min(0.9, crash * CHECKS.incidentMul + 0.0002 * blockH * w), fault };
}

export function checkCost(state, ac, check) {
  const t = typeOf(ac);
  let cost = CHECKS[check].cost[t.size];
  if (state.airline.contract?.maker === t.maker) cost *= 1 - CONTRACT.maintDiscount;
  return cost;
}

/** Check starten. Flugzeug muss am Boden am Heimatdrehkreuz stehen. */
export function startCheck(state, ac, check, ts) {
  const cost = checkCost(state, ac, check);
  ac.status = "check";
  ac.check = { type: check, from: ts, until: ts + CHECKS[check].downH * H, cost };
  return cost;
}

/** Check abschließen: dieser und alle niedrigeren Checks werden zurückgesetzt. */
export function finishCheck(ac) {
  const idx = CHECKS.order.indexOf(ac.check.type);
  for (let i = 0; i <= idx; i++) ac.maint[CHECKS.order[i]] = { fh: 0, at: ac.check.until };
  const done = ac.check;
  ac.check = null;
  ac.status = ac.ops ? "active" : "idle";
  return done;
}

export function addFlightHours(ac, h) {
  ac.hours += h; ac.cycles += 1;
  for (const k of CHECKS.order) ac.maint[k].fh += h;
}
