// Hangar: Flotte im Überblick, Detailansicht mit Kabinen-Konfiguration, Zusatztank, Strecke, Verkauf.
import { html, raw } from "../dom.js";
import { fmt } from "../../core/util.js";
import { CABIN, FLIGHT, CHECKS } from "../../core/config.js";
import { typeOf, seatUnits, totalSeats, effectiveRange, routeProblems, routeDistance } from "../../sim/flight.js";
import { checkStatus, condition } from "../../sim/maintenance.js";
import { aircraftValue, condEffects } from "../../sim/market.js";
import { isLeased, buyoutPrice, returnSettlement, termOf } from "../../sim/lease.js";
import { LEASE } from "../../core/config.js";
import { sideView } from "../aircraftArt.js";
import * as act from "../../sim/actions.js";
import { seatmapSVG, setClass, moveBoundary, CLASS_COLORS } from "../seatmap.js";
import { datasheet, condLine } from "../datasheet.js";
import { outlookFor } from "../outlook.js";
import { FITTING } from "../../core/config.js";
import { fittingOf, seatBudget, retrofitQuote } from "../../sim/fitting.js";

export const STATUS = {
  idle: ["Am Boden", "info"], active: ["Im Liniendienst", "good"], check: ["In Wartung", "warn"],
  delivery: ["Auslieferung", "info"], crashed: ["Totalverlust", "bad"]
};

export default {
  id: "hangar", title: "Hangar · Flotte", icon: "hangar", width: 620,
  initialView: () => ({ detail: null }),

  render(ctx, v) {
    const s = ctx.state;
    if (v.detail && s.fleet.some(a => a.id === v.detail)) return detail(ctx, s.fleet.find(a => a.id === v.detail), v);
    if (!s.fleet.length) return html`<div class="empty"><b>Noch keine Flugzeuge</b>Im Flugzeugmarkt kannst du neu bestellen oder gebraucht kaufen.<div style="margin-top:12px"><button class="btn p" data-act="shop">Zum Flugzeugmarkt</button></div></div>`;
    const now = ctx.now();
    return html`<div class="row" style="margin-bottom:10px"><span class="muted small grow">${s.fleet.length} Flugzeuge · Flottenwert ${fmt.money(s.fleet.reduce((x, a) => x + (a.status === "crashed" ? 0 : aircraftValue(a, now)), 0))}</span><button class="btn sm" data-act="shop">Flugzeug kaufen</button></div>
      ${s.fleet.map(ac => {
        const t = typeOf(ac), st = STATUS[ac.status], r = ac.ops && s.routes.find(x => x.id === ac.ops.routeId);
        const cs = checkStatus(ac, now), worst = CHECKS.order.find(k => cs[k].state === "overdue") || CHECKS.order.find(k => cs[k].state === "due");
        return html`<div class="ac-card" data-act="open" data-id="${ac.id}">
          ${raw(sideView(t, s.airline.livery, { fit: true }))}
          <div><h3>${ac.reg} <span class="muted small">${t.name}</span></h3>
            <div class="meta">${r ? `${r.from} ⇄ ${r.to}` : "keine Strecke"} · ${totalSeats(ac.cfg)} Sitze · Zustand ${condition(ac, now)} %</div></div>
          <div style="text-align:right" class="stack"><span class="pill ${st[1]}">${st[0]}</span>${ac.status === "delivery" ? html`<span class="pill info" title="Lieferung ${fmt.dateTime(ac.availableAt)}">⏱ <span data-eta="${ac.availableAt}"></span></span>` : ""}${worst ? html`<span class="pill ${cs[worst].state === "overdue" ? "bad" : "warn"}">${worst}-Check ${fmt.fh(cs[worst].rem)}</span>` : ""}</div>
        </div>`;
      })}`;
  },

  /** Lieferungs-Countdowns jede Sekunde */
  tick(el, ctx, v) {
    const now = ctx.now();
    if (v.detail && el.querySelector("[data-sm]")) {
      bindSeatmap(el, ctx, v);
      if (!el.querySelector("[data-units]").textContent) updateCabin(el, ctx, v);
    }
    el.querySelectorAll("[data-eta]").forEach(s => { const left = +s.dataset.eta - now; s.textContent = left > 0 ? fmt.duration(left) : "gleich da"; });
  },

  badge(ctx) {
    const n = ctx.state.fleet.filter(a => a.status === "delivery").length;
    return n ? { n, kind: "info" } : null;
  },

  click(ctx, v, api) {
    const id = () => v.detail;
    return {
      shop: () => api.open("shop"),
      open: el => { v.detail = el.dataset.id; v.fit = null; api.rerender(); },
      back: () => { v.detail = null; api.rerender(); },
      saveCabin: () => { if (ctx.run(act.setCabin, id(), v.draft)) ctx.toast("Kabine umgebaut.", "good"); },
      resetCabin: el => { v.draft = { ...ctx.state.fleet.find(a => a.id === id()).cfg }; updateCabin(el.closest(".body"), ctx, v); },
      aux: () => ctx.run(act.addAuxTank, id(), ctx.now()) && ctx.toast("Zusatztank eingebaut.", "good"),
      fitSeats: el => { const ac = ctx.state.fleet.find(a => a.id === id()); v.fit = { ...(v.fit || fittingOf(ac)), seats: el.dataset.k }; api.rerender(); },
      fitIfe: el => { const ac = ctx.state.fleet.find(a => a.id === id()); v.fit = { ...(v.fit || fittingOf(ac)), ife: el.dataset.k }; api.rerender(); },
      retrofit: () => {
        const ac = ctx.state.fleet.find(a => a.id === id()), f = v.fit || fittingOf(ac);
        const r = ctx.run(act.retrofit, id(), f.seats, f.ife, ctx.now());
        if (r) { ctx.toast(`Kabine umgebaut, fertig in ${r.quote.hours} h.`, "good"); v.fit = null; v.draft = { ...ac.cfg }; api.rerender(); }
      },
      assign: el => {
        const rid = el.closest(".body").querySelector("[name=route]").value;
        if (rid && ctx.run(act.assign, id(), rid, ctx.now())) { ctx.toast("Flugzeug startet auf der Strecke.", "good"); ctx.map.focusAircraft(id()); }
      },
      unassign: () => { const r = ctx.run(act.unassign, id(), ctx.now()); if (r) ctx.toast(r.now ? "Von der Strecke genommen." : "Wird nach Rückkehr zum Drehkreuz abgezogen.", "info"); },
      sell: () => {
        const ac = ctx.state.fleet.find(a => a.id === id());
        if (!confirmSell(ac, ctx)) return;
        const r = ctx.run(act.sellAircraft, id(), ctx.now());
        if (r) { ctx.toast(`Verkauft für ${fmt.money(r.value)}.`, "good"); v.detail = null; api.rerender(); }
      },
      locate: () => ctx.map.focusAircraft(id()),
      maint: () => api.open("maint", { focus: id() }),
      leaseReturn: () => {
        const ac = ctx.state.fleet.find(a => a.id === id()), st = returnSettlement(ac, ctx.now());
        const txt = st.isEarly
          ? `${ac.reg} vorzeitig zurückgeben? Es werden ${fmt.money(st.earlyFee)} Restraten fällig${st.penalty ? ` und ${fmt.money(st.penalty)} für überfällige Checks` : ""}. Erstattung der Kaution: ${fmt.money(st.refund)}.`
          : `${ac.reg} an ${ac.lease.lessor} zurückgeben?${st.penalty ? ` Für überfällige Checks werden ${fmt.money(st.penalty)} fällig.` : ""} Erstattung der Kaution: ${fmt.money(st.refund)}.`;
        if (!confirm(txt)) return;
        const r = ctx.run(act.returnLease, id(), ctx.now());
        if (r) { ctx.toast(`${r.reg} zurückgegeben.${r.refund ? ` Kaution ${fmt.money(r.refund)} erstattet.` : ""}`, "info", 6000); v.detail = null; api.rerender(); }
      },
      leaseBuyout: () => {
        const ac = ctx.state.fleet.find(a => a.id === id()), p = buyoutPrice(ac, ctx.now());
        if (!confirm(`${ac.reg} für ${fmt.money(p)} aus dem Leasingvertrag herauskaufen? Danach gehört die Maschine deiner Airline.`)) return;
        const r = ctx.run(act.buyoutLease, id(), ctx.now());
        if (r) ctx.toast(`${ac.reg} übernommen für ${fmt.money(r.price)}.`, "good");
      },
      leaseExtend: el => { const r = ctx.run(act.extendLease, id(), +el.dataset.m, ctx.now()); if (r) ctx.toast(`Vertrag verlängert, neue Rate ${fmt.money(r.rate)} pro Monat.`, "good"); },
      leaseEnd: el => { const r = ctx.run(act.setReturnAtEnd, id(), el.checked); if (r) ctx.toast(r.returnAtEnd ? "Wird am Vertragsende zurückgegeben." : "Wird am Vertragsende automatisch verlängert.", "info"); },
      saleLeaseback: () => {
        const ac = ctx.state.fleet.find(a => a.id === id());
        if (!confirm(`${ac.reg} an eine Leasinggesellschaft verkaufen und zurückmieten? Du bekommst den Verkaufserlös sofort, zahlst dafür künftig Monatsraten.`)) return;
        const r = ctx.run(act.saleLeaseback, id(), LEASE.defaultTerm, ctx.now());
        if (r) ctx.toast(`${ac.reg} verkauft für ${fmt.money(r.value)} und zurückgemietet für ${fmt.money(r.rate)} pro Monat.`, "good", 7000);
      }
    };
  },

  change(ctx, v) {
    return {
      rename: el => ctx.run(act.renameAircraft, v.detail, el.value),
      // Bewertung der gewählten Strecke live nachziehen
      route: el => {
        const ac = ctx.state.fleet.find(a => a.id === v.detail);
        const r = ctx.state.routes.find(x => x.id === el.value);
        const box = el.closest(".card")?.querySelector("[data-outlook]");
        if (box) box.innerHTML = r && ac ? outlookFor(ctx, r, ac).s : "";
      }
    };
  },

  input(ctx, v) {
    return {
      cabS: el => {
        const ac = ctx.state.fleet.find(a => a.id === v.detail);
        v.draft = setClass(v.draft, el.dataset.c, +el.value, typeOf(ac));
        updateCabin(el.closest(".body"), ctx, v, el);
      }
    };
  }
};

/** Kabinenplan + Slider aktualisieren, ohne den gerade gezogenen Slider neu zu erzeugen */
function updateCabin(box, ctx, v, active = null) {
  const ac = ctx.state.fleet.find(a => a.id === v.detail), t = typeOf(ac), d = v.draft;
  box.querySelector("[data-sm]").innerHTML = seatmapSVG(d, t);
  for (const c of CABIN.classes) {
    const sl = box.querySelector(`[data-act="cabS"][data-c="${c}"]`);
    if (sl && sl !== active) sl.value = d[c] || 0;
    const n = box.querySelector(`[data-n="${c}"]`); if (n) n.textContent = d[c] || 0;
  }
  const u = seatUnits(d), out = box.querySelector("[data-units]");
  const changed = CABIN.classes.some(c => (d[c] || 0) !== (ac.cfg[c] || 0));
  out.textContent = `${totalSeats(d)} Sitze · ${Math.round(u / t.seatsMax * 100)} % der Kabine belegt${u / t.seatsMax > 0.93 ? " – eng (Reputation −)" : ""}`;
  out.className = u / t.seatsMax > 0.93 ? "warn small grow" : "muted small grow";
  box.querySelector('[data-act="saveCabin"]').disabled = !changed || ac.status === "active";
}

/** Klassengrenzen im Kabinenplan ziehen */
function bindSeatmap(box, ctx, v) {
  const host = box.querySelector("[data-sm]");
  if (!host || host.dataset.bound) return;
  host.dataset.bound = "1";
  host.addEventListener("pointerdown", e => {
    const h = e.target.closest(".sm-handle");
    const ac = ctx.state.fleet.find(a => a.id === v.detail);
    if (!h || ac.status === "active") return;
    const svg = host.querySelector("svg"), [l, r] = h.dataset.bound.split(",");
    const x0 = svgX(svg, e.clientX), start = { ...v.draft }, scale = +svg.dataset.scale;
    host.setPointerCapture(e.pointerId);
    const move = ev => { v.draft = moveBoundary(start, l, r, (svgX(host.querySelector("svg"), ev.clientX) - x0) / scale, typeOf(ac)); updateCabin(box, ctx, v); };
    const up = () => { host.removeEventListener("pointermove", move); host.removeEventListener("pointerup", up); };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
  });
}
const svgX = (svg, cx) => { const p = svg.createSVGPoint(); p.x = cx; p.y = 0; return p.matrixTransform(svg.getScreenCTM().inverse()).x; };

/** Vertragsdaten eines geleasten Flugzeugs mit Verlängern, Herauskaufen und Rückgabe. */
function leaseBox(ctx, ac, now) {
  if (!isLeased(ac)) return "";
  const l = ac.lease, rest = l.until - now;
  const st = returnSettlement(ac, now);
  return html`<h3 style="margin:16px 0 8px;font-size:15px">Leasingvertrag</h3>
    <div class="card">
      <dl class="kv"><dt>Leasinggeber</dt><dd>${l.lessor}</dd>
        <dt>Monatsrate</dt><dd class="acc">${fmt.money(l.rate)}</dd>
        <dt>Laufzeit</dt><dd>${l.months} Monate${l.extensions ? ` · ${l.extensions}× verlängert` : ""}</dd>
        <dt>Restlaufzeit</dt><dd class="${rest < 14 * 864e5 ? "warn" : ""}">${rest > 0 ? fmt.duration(rest) : "abgelaufen"}</dd>
        <dt>Wartungsrücklage</dt><dd>$${fmt.int(l.reservePerFH)} je Flugstunde</dd>
        <dt>Kaution</dt><dd>${fmt.money(l.deposit)}</dd>
        ${st.penalty ? html`<dt>Offene Checks</dt><dd class="bad">${fmt.money(st.penalty)} bei Rückgabe</dd>` : ""}</dl>
      <label class="row small" style="margin-top:8px"><input type="checkbox" data-act="leaseEnd" ${l.returnAtEnd ? "checked" : ""}>
        <span class="grow">Am Vertragsende zurückgeben (sonst automatische Verlängerung zum etwas höheren Satz)</span></label>
      <div class="row wrap" style="margin-top:10px">
        ${LEASE.terms.map(t => html`<button class="btn sm" data-act="leaseExtend" data-m="${t.months}">+${t.months} Mon.</button>`)}
        <span class="grow"></span>
        <button class="btn sm" data-act="leaseBuyout">Herauskaufen · ${fmt.money(buyoutPrice(ac, now))}</button>
        <button class="btn sm danger" data-act="leaseReturn" ${ac.status === "active" || ac.status === "check" ? "disabled" : ""}>Zurückgeben</button>
      </div></div>`;
}

function confirmSell(ac, ctx) {
  // Eigener Bestätigungsdialog wäre schöner; confirm() reicht fürs Fundament.
  return window.confirm(`${ac.reg} für ca. ${fmt.money(aircraftValue(ac, ctx.now()) * 0.95)} verkaufen?`);
}

function detail(ctx, ac, v) {
  if (v.draftFor !== ac.id) { v.draft = { ...ac.cfg }; v.draftFor = ac.id; }
  const s = ctx.state, t = typeOf(ac), now = ctx.now();
  const route = ac.ops && s.routes.find(r => r.id === ac.ops.routeId);
  const units = seatUnits(ac.cfg), cs = checkStatus(ac, now), canEdit = ac.status !== "active";
  const usable = s.routes.filter(r => !routeProblems(ac, r).length);
  return html`
    <div class="row" style="margin-bottom:8px"><button class="btn sm" data-act="back">← Flotte</button><span class="grow"></span>
      ${route ? html`<button class="btn sm" data-act="locate">Auf Karte zeigen</button>` : ""}<button class="btn sm" data-act="maint">Wartung</button></div>
    <div class="preview-art">${raw(sideView(t, s.airline.livery))}</div>
    <div class="row" style="margin:10px 0"><div class="grow"><h3 style="font-size:20px">${ac.reg} · ${t.maker} ${t.name}</h3>
      <div class="muted small">Gekauft ${new Date(ac.bought).toLocaleDateString("de-DE")} · ${fmt.int(ac.hours)} Flugstunden · ${fmt.int(ac.cycles)} Zyklen · Baujahr-Alter ${ac.ageYears} J.</div>
      <div style="margin-top:4px">${condLine(ac.cond)}</div></div>
      <span class="pill ${STATUS[ac.status][1]}">${STATUS[ac.status][0]}</span></div>
    ${ac.status === "delivery" ? html`<div class="card row" style="margin-bottom:10px"><span class="grow">Lieferung am ${fmt.dateTime(ac.availableAt)}</span><b class="mono acc">⏱ <span data-eta="${ac.availableAt}"></span></b></div>` : ""}
    <input class="in" style="width:100%" name="rename" data-act="rename" placeholder="Taufname (optional)" value="${ac.name}" maxlength="24">

    <h3 style="margin:16px 0 8px;font-size:15px">Einsatz</h3>
    <div class="card">${route
      ? html`<div class="row"><div class="grow"><b>${route.from} ⇄ ${route.to}</b> <span class="muted small">${fmt.km(routeDistance(route))}</span>${ac.unassign ? html` <span class="pill warn">wird abgezogen</span>` : ""}</div><button class="btn sm" data-act="unassign">Von Strecke nehmen</button></div>`
      : html`<div class="row"><select class="in grow" name="route" data-act="route" ${ac.status !== "idle" ? "disabled" : ""}><option value="">Strecke wählen …</option>${usable.map(r => html`<option value="${r.id}">${r.from} → ${r.to} (${fmt.km(routeDistance(r))})</option>`)}</select><button class="btn sm p" data-act="assign" ${ac.status !== "idle" ? "disabled" : ""}>Starten</button></div>
        <div data-outlook>${usable.length ? outlookFor(ctx, usable[0], ac) : ""}</div>
        <p class="small muted" style="margin-top:6px">${s.routes.length - usable.length ? `${s.routes.length - usable.length} Strecke(n) ausgeblendet: Reichweite oder Bahnlänge passt nicht.` : "Fliegt im Pendel: Hinflug, Turnaround, Rückflug – rund um die Uhr in Echtzeit."}</p>`}</div>

    <h3 style="margin:16px 0 8px;font-size:15px">Kabine</h3>
    <div class="card">
      <div data-sm>${raw(seatmapSVG(v.draft, t))}</div>
      <div class="cab-sliders">${CABIN.classes.map(c => html`<label><span style="color:${CLASS_COLORS[c]}">${CABIN.names[c]}</span>
        <input type="range" min="0" max="${Math.floor(seatBudget(ac) / CABIN.units[c])}" value="${v.draft[c] || 0}" data-act="cabS" data-c="${c}" style="accent-color:${CLASS_COLORS[c]}" ${canEdit ? "" : "disabled"}>
        <b class="mono" data-n="${c}">${v.draft[c] || 0}</b></label>`)}</div>
      <div class="row" style="margin-top:8px"><span data-units class="muted small grow"></span><button class="btn sm" data-act="resetCabin">Zurücksetzen</button><button class="btn sm p" data-act="saveCabin" disabled>Umbauen</button></div>
      <p class="small muted" style="margin-top:6px">${canEdit ? "Slider oder die gelben Griffe im Kabinenplan ziehen. Mehr Business oder First nimmt Economy-Plätze weg – und umgekehrt." : "Umbau nur, wenn das Flugzeug keine Strecke fliegt."} Über 93 % belegter Kabine gilt sie als eng (Reputation −).</p></div>

    <h3 style="margin:16px 0 8px;font-size:15px">Ausstattung</h3>
    ${fittingBox(ctx, ac, v)}

    <h3 style="margin:16px 0 8px;font-size:15px">Technik</h3>
    <div class="grid2">
      <dl class="kv card"><dt>Reichweite</dt><dd>${fmt.km(effectiveRange(ac))}</dd><dt>Zusatztanks</dt><dd>${ac.aux || 0} / ${FLIGHT.aux.maxTanks}</dd><dt>Startstrecke</dt><dd>${fmt.int(t.runwayM)} m</dd><dt>Verbrauch</dt><dd>${fmt.int(t.fuelKgH * (1 + condEffects(ac.cond).fuel))} kg/h</dd></dl>
      <dl class="kv card"><dt>Cockpit</dt><dd>${t.crew.pilots} Piloten</dd><dt>Kabine (min.)</dt><dd>${t.crew.cabin}</dd><dt>Techniker</dt><dd>${t.crew.techs}</dd><dt>Restwert</dt><dd>${fmt.money(aircraftValue(ac, now))}</dd></dl>
    </div>
    <h3 style="margin:16px 0 8px;font-size:15px">Datenblatt ${t.maker} ${t.name}</h3>
    <div class="card">${datasheet(t, ac, { open: ["Leistung"] })}</div>
    <div class="row wrap" style="margin-top:10px">
      <button class="btn sm" data-act="aux" ${canEdit && (ac.aux || 0) < FLIGHT.aux.maxTanks ? "" : "disabled"}>Zusatztank einbauen (${fmt.money(FLIGHT.aux.priceM * 1e6)}, +${Math.round(FLIGHT.aux.rangeBonus * 100)} % Reichweite, −${fmt.int(FLIGHT.aux.payloadCostKg)} kg Nutzlast)</button>
    </div>
    <div class="checks" style="margin-top:10px">${CHECKS.order.map(k => html`<div class="${cs[k].state}">${k}-Check<b>${fmt.fh(cs[k].rem)}</b></div>`)}</div>
    ${leaseBox(ctx, ac, now)}
    <div class="row" style="margin-top:16px"><span class="grow"></span>
      ${isLeased(ac) ? "" : html`<button class="btn sm" data-act="saleLeaseback" ${ac.status === "delivery" ? "disabled" : ""} title="Verkaufen und zurückmieten – bringt sofort Geld">Sale-and-Leaseback</button>`}
      <button class="btn sm danger" data-act="sell" ${isLeased(ac) || ac.status === "active" || ac.status === "check" ? "disabled" : ""}>Verkaufen</button></div>`;
}

/**
 * Sitzart und Unterhaltung. Beides zusammen in einem Angebot, damit man einmal in die
 * Halle muss statt zweimal – im Spiel wie in echt die teuerste Zutat des Umbaus.
 */
function fittingBox(ctx, ac, v) {
  // Anders als die Bestuhlung geht der Ausstattungsumbau auch zwischen zwei Umläufen,
  // solange das Flugzeug am Drehkreuz steht – er braucht nur die Hallenzeit.
  const now = ctx.now();
  const canEdit = ac.status === "idle" || (ac.status === "active" && ac.ops?.dir === 0 && ac.ops.dep > now);
  const cur = fittingOf(ac);
  const pick = v.fit || cur;
  const q = retrofitQuote(ctx.state, ac, pick.seats, pick.ife);
  const busy = ac.fitReady && ac.fitReady > ctx.now();
  return html`<div class="card">
    ${busy ? html`<p class="small warn" style="margin-bottom:8px">Kabinenumbau läuft noch bis ${fmt.dateTime(ac.fitReady)}.</p>` : ""}
    <div class="small muted">Sitzart</div>
    <div class="opt-row">${Object.entries(FITTING.seats).map(([k, m]) => html`<button class="opt ${pick.seats === k ? "on" : ""}" data-act="fitSeats" data-k="${k}" ${canEdit ? "" : "disabled"}>
      <b>${m.label}</b><span>${m.seatBonus === 1 ? "Sitzbudget unverändert" : `${m.seatBonus > 1 ? "+" : ""}${Math.round((m.seatBonus - 1) * 100)} % Sitzbudget`}${m.rep ? ` · Ruf ${m.rep > 0 ? "+" : ""}${m.rep}` : ""}</span></button>`)}</div>
    <p class="small muted">${FITTING.seats[pick.seats].note}</p>
    <div class="small muted" style="margin-top:10px">Unterhaltung</div>
    <div class="opt-row">${Object.entries(FITTING.ife).map(([k, m]) => html`<button class="opt ${pick.ife === k ? "on" : ""}" data-act="fitIfe" data-k="${k}" ${canEdit ? "" : "disabled"}>
      <b>${m.label}</b><span>${m.rep ? `Ruf +${m.rep} · ` : ""}Bordverkauf ${Math.round(m.onboard * 100)} %</span></button>`)}</div>
    <p class="small muted">${FITTING.ife[pick.ife].note}</p>
    <div class="row" style="margin-top:10px"><span class="grow small muted">
      ${!canEdit ? "Umbau nur, wenn das Flugzeug am Drehkreuz steht."
        : q?.changed ? `Sitzbudget danach ${q.budgetAfter} Einheiten · ${q.hours} h in der Halle` : "Aktuelle Ausstattung"}</span>
      <button class="btn sm p" data-act="retrofit" ${q?.changed && canEdit && !busy ? "" : "disabled"}>
        ${q?.changed ? `Umbauen für ${fmt.money(q.price)}` : "Umbauen"}</button></div>
  </div>`;
}
