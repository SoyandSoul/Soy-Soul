// Linkes Panel "Airline": alles über das eigene Unternehmen – Übersicht, Flotte, Personal,
// Kosten & Erlöse, Angebot an Bord, Unternehmen (Verträge/Drehkreuze/Schulung/Livery) und Spielstand.

import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { STAFF, CATERING, BAGS, CONTRACT, FLIGHT } from "../../core/config.js";
import { AIRPORT_BY_IATA, searchAirports } from "../../data/airports.js";
import { CONTRACT_MAKERS } from "../../data/aircraft.js";
import { statement, REV_BLOCKS } from "../../sim/finance.js";
import { staffNeed, staffHave, coverage, staffEffects, salaryPerDay, GROUPS } from "../../sim/staff.js";
import { COST, REV } from "../../sim/ledger.js";
import { companyValue } from "../../sim/stocks.js";
import { repFactors, repTarget } from "../../sim/reputation.js";
import { typeOf, routeDistance, positionAt } from "../../sim/flight.js";
import { leaseFrame, monthlyObligation, isLeased } from "../../sim/lease.js";
import { goalProgress, nextGoal, rewardText, GOAL_GROUPS } from "../../sim/goals.js";
import { commonality, commonalityNote } from "../../sim/commonality.js";
import * as act from "../../sim/actions.js";
import { exportSave, importSave } from "../../core/store.js";
import { online, cloudSave } from "../../net/backend.js";

const pct = x => Math.round(x * 100) + " %";
/** Faktor 0,82 → "−18 %" */
const pctDiff = f => (f <= 1 ? "−" : "+") + Math.abs(Math.round((f - 1) * 100)) + " %";
const sign = v => (v >= 0 ? "+" : "") + fmt.money(v);

// ---------------------------------------------------------------- Übersicht
const overview = {
  id: "overview", title: "Übersicht", icon: "overview",
  render(ctx) {
    const s = ctx.state, now = ctx.now();
    const st = statement(s, 30, now), val = companyValue(s, now, ctx.marketPrices());
    const eff = staffEffects(s);
    const fleet = s.fleet.filter(a => a.status !== "crashed");
    return html`
      <div class="tiles">
        <div class="tile"><span>Kasse</span><b class="${s.cash < 0 ? "bad" : ""}">${fmt.money(s.cash)}</b></div>
        <div class="tile"><span>Ergebnis 30 Tage</span><b class="${st.profit < 0 ? "bad" : "good"}">${sign(st.profit)}</b></div>
        <div class="tile"><span>Unternehmenswert</span><b>${fmt.money(val.total)}</b></div>
        <div class="tile"><span>Marge</span><b class="${st.margin < 0 ? "bad" : st.margin > 0.15 ? "good" : ""}">${pct(st.margin)}</b></div>
        <div class="tile"><span>Flotte</span><b>${fleet.length}<small> · ${ctx.inAir()} in der Luft</small></b></div>
        <div class="tile"><span>Reputation</span><b>${s.airline.rep.toFixed(1)}<small> / 100</small></b></div>
      </div>
      ${eff.openPositions ? html`<div class="note warn"><b>${eff.openPositions} offene Stellen</b><span>Unterbesetzung kostet Pünktlichkeit und Reputation.</span><button class="btn sm p" data-act="goStaff">Zum Personal</button></div>` : ""}
      ${s.cash < 0 ? html`<div class="note bad"><b>Die Kasse ist im Minus</b><span>Flugzeuge verkaufen oder unrentable Strecken schließen.</span></div>` : ""}
      ${(() => { const fr = leaseFrame(s, now); const leased = fleet.filter(isLeased).length;
        return leased || fr.used ? html`<div class="note info"><b>Leasing</b><span>${leased} von ${fleet.length} Flugzeugen geleast · ${fmt.money(fr.used)} Raten pro Monat · noch ${fmt.money(fr.free)} Rahmen frei</span></div>` : ""; })()}
      <dl class="kv" style="margin-top:10px">
        <dt>Flottenwert (Eigentum)</dt><dd>${fmt.money(val.fleet)}</dd>
        <dt>Kerosinvorrat</dt><dd>${fmt.money(val.fuel)}</dd>
        <dt>Beteiligungen</dt><dd>${fmt.money(val.holdings)}</dd>
        <dt>Ertragswert</dt><dd>${fmt.money(val.goodwill)}</dd>
        <dt>Laufende Kosten</dt><dd>${fmt.money(salaryPerDay(s).total)} / Tag Personal${monthlyObligation(s) ? html` · ${fmt.money(monthlyObligation(s))} / Monat Leasing` : ""}</dd>
      </dl>`;
  },
  click: (ctx, v, api) => ({ goStaff: () => { v.open = "staff"; api.rerender(); } })
};

// ---------------------------------------------------------------- Ziele
const goals = {
  id: "goals", title: "Ziele", icon: "board",
  badge(ctx) {
    const gp = goalProgress(ctx.state, ctx.now());
    const open = gp.filter(g => !g.done).length;
    return open ? { n: `${gp.length - open}/${gp.length}`, kind: "" } : { n: "✓", kind: "" };
  },
  render(ctx) {
    const gp = goalProgress(ctx.state, ctx.now()), now = ctx.now();
    const next = nextGoal(ctx.state, now);
    const done = gp.filter(g => g.done).length;
    return html`
      ${next ? html`<div class="note info"><b>Als Nächstes: ${next.title}</b><span>${next.hint}</span></div>`
        : html`<div class="note good"><b>Alle Ziele erreicht</b><span>Respekt – die Airline läuft.</span></div>`}
      <div class="row small muted" style="margin-top:8px"><span class="grow">${done} von ${gp.length} erreicht</span>
        <span>${ctx.state.airline.frameBonus ? `Leasingrahmen aus Zielen: ${fmt.money(ctx.state.airline.frameBonus)}/Monat` : ""}</span></div>
      <div class="bar" style="margin-top:4px"><i style="width:${done / gp.length * 100}%;background:var(--accent)"></i></div>
      ${GOAL_GROUPS.map(grp => html`<div class="goal-head"><h4>${grp}</h4></div>
        ${gp.filter(g => g.group === grp).map(g => html`<div class="goal ${g.done ? "done" : ""}">
          <div class="row"><b class="grow">${g.done ? html`<span class="tick">✓</span> ` : ""}${g.title}</b>
            <span class="reward">${rewardText(g.reward)}</span></div>
          ${g.done ? "" : html`<div class="bar"><i style="width:${g.pct * 100}%;background:var(--${g.pct > 0.66 ? "good" : g.pct > 0.3 ? "warn" : "accent"})"></i></div>
            <small>${g.hint} · ${fmtGoal(g)}</small>`}
        </div>`)}`)}`;
  }
};

const fmtGoal = g => g.target >= 1000 ? `${fmt.int(g.cur)} von ${fmt.int(g.target)}` : g.target === 1 ? "noch offen" : `${fmt.dec(g.cur)} von ${g.target}`;

// ---------------------------------------------------------------- Flotte
const FLEET_GROUPS = [["air", "In der Luft"], ["ground", "Am Boden"], ["idle", "Ohne Strecke"], ["check", "In Wartung"], ["delivery", "In Auslieferung"]];

/** In welche Gruppe gehört ein Flugzeug? Maßgeblich ist die Spieluhr, nicht die Systemzeit. */
function fleetGroup(ctx, ac) {
  if (ac.status === "check") return "check";
  if (ac.status === "delivery") return "delivery";
  if (ac.status !== "active" || !ac.ops) return "idle";
  const r = ctx.state.routes.find(r => r.id === ac.ops.routeId);
  if (!r) return "idle";
  return positionAt(ac, r, ctx.now()).phase === "air" ? "air" : "ground";
}

function aircraftRow(ctx, ac) {
  const t = typeOf(ac), now = ctx.now();
  let detail = "", cls = "";
  if (ac.status === "active" && ac.ops) {
    const r = ctx.state.routes.find(r => r.id === ac.ops.routeId);
    const p = r && positionAt(ac, r, now);
    if (p?.phase === "air") { detail = `${p.from.iata} → ${p.to.iata} · noch ${fmt.duration(p.eta - now)}`; cls = "air"; }
    else if (r) { detail = `${ac.ops.dir === 0 ? r.from : r.to} · Abflug ${fmt.time(ac.ops.dep)}`; cls = "ground"; }
    if (ac.ops.delay) detail += ` · +${ac.ops.delay.min}′`;
  } else if (ac.status === "check") { detail = `${ac.check.type}-Check bis ${fmt.dateTime(ac.check.until)}`; cls = "check"; }
  else if (ac.status === "delivery") { detail = `Übergabe ${fmt.dateTime(ac.availableAt)}`; cls = "delivery"; }
  else detail = "steht am Drehkreuz";
  return html`<button class="acrow ${cls}" data-act="focus" data-id="${ac.id}">
    <i class="dot"></i>
    <span class="grow"><b>${ac.reg}</b>${isLeased(ac) ? html`<i class="tag">Leasing</i>` : ""}<small>${t.name}${ac.name ? ` · ${ac.name}` : ""}</small></span>
    <span class="acdet">${detail}</span></button>`;
}

const fleet = {
  id: "fleet", title: "Flotte", icon: "fleet",
  badge(ctx) { const n = ctx.state.fleet.filter(a => a.status === "idle").length; return n ? { n, kind: "warn" } : null; },
  render(ctx) {
    const s = ctx.state;
    const by = {};
    for (const a of s.fleet) { if (a.status === "crashed") continue; (by[fleetGroup(ctx, a)] ||= []).push(a); }
    const groups = FLEET_GROUPS.map(([id, label]) => [id, label, by[id] || []]).filter(([, , l]) => l.length);
    if (!s.fleet.length) return html`<div class="empty"><b>Noch keine Flugzeuge</b>Im Betriebs-Panel rechts den Flugzeugmarkt öffnen.</div>`;
    const c = commonality(s);
    return html`${c.active ? html`<div class="note ${c.bonus > 0.4 ? "good" : c.penalty ? "warn" : ""}">
        <b>Flottenstruktur: ${c.families} Baureihe${c.families === 1 ? "" : "n"}</b>
        <span>${commonalityNote(c)} Wartung ${pctDiff(c.maint)}, Cockpit-Bedarf ${pctDiff(c.cockpit)}, Schulung ${pctDiff(c.training)}.</span></div>` : ""}
      ${groups.map(([id, label, list]) => html`
      <div class="fgroup"><h4>${label}<span>${list.length}</span></h4>${list.map(a => aircraftRow(ctx, a))}</div>`)}
      <div class="row" style="margin-top:10px"><button class="btn sm grow" data-act="hangar">Hangar öffnen</button><button class="btn sm grow" data-act="shop">Flugzeug kaufen</button></div>`;
  },
  tick(el, ctx) {
    // Restzeiten laufen mit, ohne das Panel neu zu zeichnen
    for (const b of el.querySelectorAll(".acrow.air")) {
      const ac = ctx.state.fleet.find(a => a.id === b.dataset.id);
      const r = ac?.ops && ctx.state.routes.find(r => r.id === ac.ops.routeId);
      if (!r) continue;
      const p = positionAt(ac, r, ctx.now());
      if (p.phase === "air") b.querySelector(".acdet").textContent = `${p.from.iata} → ${p.to.iata} · noch ${fmt.duration(p.eta - ctx.now())}${ac.ops.delay ? ` · +${ac.ops.delay.min}′` : ""}`;
    }
  },
  click: ctx => ({
    focus: el => { ctx.map.focusAircraft(el.dataset.id); ctx.openApp("hangar", { detail: el.dataset.id }); },
    hangar: () => ctx.openApp("hangar"),
    shop: () => ctx.openApp("shop")
  })
};

// ---------------------------------------------------------------- Personal
const staff = {
  id: "staff", title: "Personal", icon: "staff",
  badge(ctx) { const n = staffEffects(ctx.state).openPositions; return n ? { n, kind: "warn" } : null; },
  render(ctx) {
    const s = ctx.state, cov = coverage(s), eff = staffEffects(s), sal = salaryPerDay(s);
    const q = act.trainingQuote(s), lvl = s.airline.training;
    const open = GROUPS.map(g => Math.max(0, cov.need[g] - cov.have[g]));
    const openTotal = open.reduce((a, b) => a + b, 0);
    const openCost = GROUPS.reduce((a, g, i) => a + STAFF.groups[g].hireFee * open[i], 0);
    return html`
      ${openTotal ? html`<div class="note warn"><b>${openTotal} offene Stellen</b><span>${eff.delayMin ? `Aktuell ${eff.delayMin} min Verspätung je Umlauf` : "Noch ohne Auswirkung"}${eff.repMalus < -0.5 ? `, Reputation ${eff.repMalus.toFixed(0)}` : ""}.</span>
        <button class="btn sm p" data-act="hireAll">Alle besetzen · ${fmt.money(openCost)}</button></div>`
      : html`<div class="note good"><b>Alle Stellen besetzt</b><span>${cov.total} Mitarbeiter, ${fmt.money(sal.total)} Gehalt pro Tag.</span></div>`}
      ${GROUPS.map((g, i) => {
        const c = cov[g], gi = STAFF.groups[g], ok = c >= 1;
        return html`<div class="sgrp">
          <div class="row"><span class="grow"><b>${gi.label}</b><small class="muted"> ${gi.short}</small></span>
            <b class="${ok ? "good" : c >= 0.95 ? "warn" : "bad"}">${cov.have[g]} / ${cov.need[g]}</b></div>
          <div class="bar"><i style="width:${Math.min(100, c * 100)}%;background:var(--${ok ? "good" : c >= 0.8 ? "warn" : "bad"})"></i></div>
          <div class="row small muted" style="margin-top:5px">
            <span class="grow">${fmt.money(gi.salaryPerDay * sal.wage)} / Tag und Kopf · Einstellung ${fmt.money(gi.hireFee)}</span>
            <button class="btn sm" data-act="fire" data-g="${g}" ${cov.have[g] ? "" : "disabled"}>−5</button>
            <button class="btn sm" data-act="hire" data-g="${g}">+5</button>
            ${open[i] ? html`<button class="btn sm p" data-act="hire" data-g="${g}" data-n="${open[i]}">+${open[i]}</button>` : ""}
          </div></div>`;
      })}
      <div class="card" style="margin-top:10px"><div class="row"><div class="grow"><b>Schulung: ${STAFF.training.levels[lvl]}</b>
        <div class="small muted">Reputation +${STAFF.training.rep[lvl]} · Gehälter +${Math.round(lvl * STAFF.training.wageBonus * 100)} %</div></div>
        ${q ? html`<button class="btn sm p" data-act="training">${STAFF.training.levels[q.level]} · ${fmt.money(q.cost)}</button>` : html`<span class="pill good">Höchste Stufe</span>`}</div></div>
      <p class="small muted" style="margin-top:8px">Der Bedarf wächst mit der Flotte und mit jedem neuen Ziel. Unter 60 % Besetzung lässt sich kein Flugzeug mehr in Dienst stellen. Techniker laufen noch automatisch mit.</p>`;
  },
  click: (ctx, v, api) => ({
    hire: el => { const n = +(el.dataset.n || 5); const r = ctx.run(act.hire, el.dataset.g, n, ctx.now()); if (r) ctx.toast(`${n} ${STAFF.groups[el.dataset.g].short} eingestellt.`, "good"); },
    fire: el => { const r = ctx.run(act.fire, el.dataset.g, 5, ctx.now()); if (r) ctx.toast(`${r.n} ${STAFF.groups[el.dataset.g].short} entlassen – Abfindung ${fmt.money(r.cost)}.`, "info"); },
    hireAll: () => { const r = ctx.run(act.hireAllOpen, ctx.now()); if (r) ctx.toast(`${r.total} Stellen besetzt für ${fmt.money(r.cost)}.`, "good"); },
    training: () => { const r = ctx.run(act.upgradeTraining, ctx.now()); if (r) ctx.toast(`Schulung abgeschlossen: ${STAFF.training.levels[r.level]}.`, "good"); }
  })
};

// ---------------------------------------------------------------- Kosten & Erlöse
const PERIODS = [["1", "Heute", 1], ["7", "7 Tage", 7], ["30", "30 Tage", 30]];

const finance = {
  id: "finance", title: "Kosten & Erlöse", icon: "finance",
  render(ctx, v) {
    const key = v.period || "7", days = PERIODS.find(p => p[0] === key)[2];
    const st = statement(ctx.state, days, ctx.now());
    const maxCost = Math.max(1, ...st.costBlocks.filter(b => !b.capex).map(b => b.total));
    const block = (b, total, kind) => {
      const off = b.capex || b.nonOp;                       // zählen nicht zum operativen Ergebnis
      const w = off ? 0 : Math.min(100, b.total / (kind === "cost" ? maxCost : Math.max(1, total)) * 100);
      return html`<div class="fblock ${off ? "off" : ""}">
        <div class="row"><span class="grow"><b>${b.label}</b><small class="muted"> ${b.hint}</small></span><b>${fmt.money(b.total)}</b>
          <span class="fshare">${off ? "" : total ? pct(b.total / total) : "–"}</span></div>
        ${off ? "" : html`<div class="bar"><i style="width:${w}%;background:var(--c-${b.color})"></i></div>`}
        ${b.parts.length > 1 ? html`<div class="fparts">${b.parts.map(([c, val]) => html`<span>${(kind === "cost" ? COST : REV)[c] || c} <b>${fmt.money(val)}</b></span>`)}</div>` : ""}
      </div>`;
    };
    return html`
      <div class="tabs sm">${PERIODS.map(([id, label]) => html`<button data-act="ptab" data-ptab="${id}" data-ptab-key="period" aria-selected="${String(id === key)}">${label}</button>`)}</div>
      <div class="tiles two">
        <div class="tile"><span>Erlöse</span><b class="good">${fmt.money(st.opRev)}</b></div>
        <div class="tile"><span>Kosten</span><b>${fmt.money(st.opCost)}</b></div>
        <div class="tile"><span>Ergebnis</span><b class="${st.profit < 0 ? "bad" : "good"}">${sign(st.profit)}</b></div>
        <div class="tile"><span>Marge</span><b class="${st.margin < 0 ? "bad" : ""}">${pct(st.margin)}</b></div>
      </div>
      <h4 class="fhead">Erlöse</h4>${st.revBlocks.filter(b => b.total).map(b => block(b, st.opRev, "rev"))}
      <h4 class="fhead">Kosten</h4>${st.costBlocks.filter(b => b.total).map(b => block(b, st.opCost, "cost"))}
      ${st.legs ? html`<h4 class="fhead">Je Flug</h4>
      <dl class="kv"><dt>Flüge im Zeitraum</dt><dd>${st.legs}</dd><dt>Ø Auslastung</dt><dd>${pct(st.lf)}</dd>
        <dt>Erlös je Flug</dt><dd>${fmt.money(st.perLeg.rev)}</dd><dt>Kosten je Flug</dt><dd>${fmt.money(st.perLeg.cost)}</dd>
        <dt>Ergebnis je Flug</dt><dd class="${st.perLeg.profit < 0 ? "bad" : "good"}">${sign(st.perLeg.profit)}</dd>
        <dt>Ergebnis je Flugzeug/Tag</dt><dd class="${st.perAircraftDay < 0 ? "bad" : ""}">${sign(st.perAircraftDay)}</dd></dl>`
      : html`<p class="small muted" style="margin-top:8px">Noch keine Flüge in diesem Zeitraum.</p>`}
      <p class="small muted" style="margin-top:8px">Investitionen (Flugzeuge, Ausbau, Personalgewinnung) zählen nicht zum operativen Ergebnis.</p>`;
  }
};

// ---------------------------------------------------------------- Angebot an Bord
const offer = {
  id: "offer", title: "Angebot an Bord", icon: "offer",
  render(ctx) {
    const a = ctx.state.airline;
    return html`<div class="opt-list">${Object.entries(CATERING.modes).map(([k, m]) => html`<label><input type="radio" name="catering" value="${k}" data-act="catering" ${a.catering === k ? "checked" : ""}>
      <div><b>${m.label}</b> <span class="pill ${m.rep > 0 ? "good" : m.rep < 0 ? "bad" : ""}">Reputation ${m.rep > 0 ? "+" : ""}${m.rep}</span>
      <div class="small muted">${k === "free" ? "Essen und Getränke in allen Klassen inklusive. Teuer, Passagiere lieben es." : k === "mixed" ? "Premium-Klassen inklusive, Economy kauft an Bord." : "Alles kostenpflichtig – Extra-Umsatz, aber weniger Zufriedenheit."}</div></div></label>`)}</div>
      <div class="card" style="margin-top:10px"><div class="row"><b class="grow">Gepäckgebühr Economy</b><b data-bag class="acc">$${a.bagFee}</b></div>
        <input type="range" min="0" max="${BAGS.maxFee}" step="5" value="${a.bagFee}" data-act="bag" style="margin-top:8px">
        <p class="small muted">Höhere Gebühren bringen pro Koffer mehr, aber weniger Passagiere zahlen sie – und die Reputation sinkt (bis −${BAGS.repCap}).</p></div>`;
  },
  change: ctx => ({ catering: el => ctx.run(act.setCatering, el.value), bag: el => ctx.run(act.setBagFee, el.value) }),
  input: () => ({ bag: el => { el.closest(".card").querySelector("[data-bag]").textContent = "$" + el.value; } })
};

// ---------------------------------------------------------------- Reputation
const LABELS = { preis: "Preisfairness", komfort: "Kabinenkomfort", bordservice: "Bordservice", gepaeck: "Gepäckgebühr", schulung: "Schulung", personal: "Personalbesetzung", sicherheit: "Vorfälle", unfallfrei: "Unfallfreie Zeit" };

const reputation = {
  id: "rep", title: "Reputation", icon: "airline",
  render(ctx) {
    const s = ctx.state, now = ctx.now(), last = s.flights[0];
    const f = repFactors(s, now, last), target = repTarget(s, now, last);
    const tips = Object.entries(f).filter(([, x]) => x < -0.5).sort((a, b) => a[1] - b[1]).slice(0, 3);
    return html`<div class="row"><div class="grow"><div class="big-price">${s.airline.rep.toFixed(1)}</div>
      <div class="small muted">Ziel aktuell ${target.toFixed(1)} – die Reputation nähert sich mit jedem Flug an.</div></div></div>
      <div class="rep-bars" style="margin-top:10px">${Object.entries(f).map(([k, x]) => {
        const w = Math.min(50, Math.abs(x) * 2.5);
        return html`<div><span>${LABELS[k] || k}</span><div class="track"><i style="${x >= 0 ? `left:50%;width:${w}%;background:var(--good)` : `right:50%;width:${w}%;background:var(--bad)`}"></i></div><b class="r mono">${x >= 0 ? "+" : ""}${x.toFixed(1)}</b></div>`;
      })}</div>
      ${tips.length ? html`<div class="note info" style="margin-top:10px"><b>Größte Baustellen</b><span>${tips.map(([k]) => LABELS[k] || k).join(" · ")}</span></div>` : ""}
      <p class="small muted" style="margin-top:8px">Reputation steuert die Nachfrage: bei 0 nur 60 %, bei 100 bis zu 140 %.</p>`;
  }
};

// ---------------------------------------------------------------- Unternehmen
const company = {
  id: "company", title: "Unternehmen", icon: "contract",
  render(ctx, v) {
    const s = ctx.state, c = s.airline.contract;
    return html`
      <div class="card row"><div class="grow"><b>Lackiererei</b><div class="small muted">Eigene Livery für die ganze Flotte malen – oder eine Vorlage wählen.</div></div>
        <button class="btn sm p" data-act="paint">Öffnen</button></div>
      <h4 class="fhead">Herstellervertrag</h4>
      <p class="small muted">${CONTRACT.baseDiscount * 100} % Grundrabatt, Mengenrabatte und −${CONTRACT.maintDiscount * 100} % auf Checks – sperrt aber Neubestellungen beim anderen Hersteller.</p>
      <div class="grid2" style="margin-top:8px">${CONTRACT_MAKERS.map(m => html`<div class="card"><b>${m}</b>
        ${c?.maker === m ? html`<p class="small good" style="margin:6px 0">Aktiv seit ${fmt.date(c.since)}</p><button class="btn sm danger" data-act="cancel">Kündigen</button>`
          : html`<p class="small muted" style="margin:6px 0">${c ? "Gesperrt" : "Verfügbar"}</p><button class="btn sm" data-act="sign" data-maker="${m}" ${c ? "disabled" : ""}>Unterschreiben</button>`}</div>`)}</div>
      <h4 class="fhead">Drehkreuze</h4>
      <div class="row wrap">${s.airline.hubs.map(h => html`<span class="pill info">${h} · ${AIRPORT_BY_IATA[h].city}</span>`)}</div>
      <input class="in" style="width:100%;margin-top:8px" placeholder="Weiteren Flughafen suchen …" data-act="q" value="${v.q || ""}">
      <div class="pick" data-results>${v.q ? hubResults(ctx, v) : ""}</div>`;
  },
  click: (ctx, v, api) => ({
    paint: () => ctx.openPainter(),
    sign: el => { if (confirm(`Exklusivvertrag mit ${el.dataset.maker}? Neubestellungen beim anderen Hersteller sind dann gesperrt, Kündigung kostet ${fmt.money(CONTRACT.cancelFee)}.`)) ctx.run(act.signContract, el.dataset.maker, ctx.now()); },
    cancel: () => { if (confirm(`Vertrag für ${fmt.money(CONTRACT.cancelFee)} kündigen?`)) ctx.run(act.cancelContract, ctx.now()); },
    addHub: el => { const r = ctx.run(act.addHub, el.dataset.iata, ctx.now()); if (r) { ctx.toast(`${el.dataset.iata} ist jetzt Drehkreuz.`, "good"); v.q = ""; api.rerender(); } }
  }),
  input: (ctx, v) => ({ q: el => { v.q = el.value; el.closest(".psec-body").querySelector("[data-results]").innerHTML = hubResults(ctx, v).s; } })
};

function hubResults(ctx, v) {
  const s = ctx.state;
  const list = searchAirports(v.q, 6).filter(a => !s.airline.hubs.includes(a.iata));
  return html`${list.map(a => html`<button data-act="addHub" data-iata="${a.iata}"><b>${a.iata}</b><span class="grow">${a.city}</span><span class="muted small">${fmt.money(act.hubPrice(a.iata))}</span></button>`)}`;
}

// ---------------------------------------------------------------- Spielstand
const account = {
  id: "account", title: "Spielstand", icon: "account",
  render(ctx) {
    const p = ctx.state.player;
    return html`<dl class="kv"><dt>Spielercode</dt><dd class="mono acc">${p.code}</dd>
      <dt>Airline</dt><dd>${ctx.state.airline.name} (${ctx.state.airline.iata})</dd>
      <dt>Gegründet</dt><dd>${fmt.date(ctx.state.created)}</dd>
      <dt>Schlüssel</dt><dd><button class="btn sm" data-act="showSecret">Anzeigen</button></dd></dl>
      <p class="small muted" style="margin-top:8px">Der Spielstand liegt nur in diesem Browser. Der Code erscheint öffentlich in Börse und Rangliste, den Schlüssel niemandem geben.</p>
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="export">Exportieren</button><button class="btn sm" data-act="import">Importieren</button>${online() ? html`<button class="btn sm" data-act="cloud">Online sichern</button>` : ""}</div>
      <textarea name="io" class="in" rows="3" style="width:100%;margin-top:8px;font:11px var(--mono)" placeholder="Exportierten Spielstand hier einfügen …"></textarea>
      <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn sm danger" data-act="reset">Neu anfangen</button></div>`;
  },
  click: ctx => ({
    showSecret: el => { el.textContent = ctx.state.player.secret; },
    export: async el => {
      const text = exportSave(ctx.state);
      try { await navigator.clipboard.writeText(text); ctx.toast("Spielstand kopiert.", "good"); }
      catch { el.closest(".psec-body").querySelector("[name=io]").value = text; ctx.toast("Spielstand ins Feld geschrieben – kopieren und sicher aufbewahren.", "info"); }
    },
    import: el => {
      const text = el.closest(".psec-body").querySelector("[name=io]").value;
      try { const s = importSave(text); if (confirm(`Spielstand von „${s.airline.name}" laden? Der aktuelle wird ersetzt.`)) ctx.replaceState(s); }
      catch (e) { ctx.toast("Import fehlgeschlagen: " + e.message, "bad"); }
    },
    cloud: async () => { try { await cloudSave(ctx.state); ctx.toast("Online gesichert.", "good"); } catch (e) { ctx.toast("Sicherung fehlgeschlagen: " + e.message, "bad"); } },
    reset: () => { if (confirm("Wirklich ALLES löschen und neu starten? Exportiere vorher deinen Spielstand.")) ctx.resetGame(); }
  })
};

export const AIRLINE_SECTIONS = [overview, goals, fleet, staff, finance, offer, reputation, company, account];
