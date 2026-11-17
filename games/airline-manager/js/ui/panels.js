// Zwei Panele am oberen Rand: links "Airline" (alles über das eigene Unternehmen),
// rechts "Betrieb" (Routen, Markt, Wartung …). Beide klappen nach unten auf, die Karte bleibt dazwischen frei.
//
// Ein Panel besteht aus Abschnitten:
//   { id, title, icon, badge(ctx), render(ctx, view) → html`…`, click/change/input(ctx, view, api) → { act: handler }, tick(el, ctx) }
// Abschnitte klappen einzeln auf; welche offen sind, merkt sich prefs.

import { ICONS } from "./icons.js";
import { html, raw, esc, delegate } from "./dom.js";
import { prefs } from "../core/store.js";
import { normalizeLivery } from "../art/livery.js";

const panels = new Map();   // side → { el, sections, view, open }
let ctxRef = null;

export function initPanels(ctx) { ctxRef = ctx; }

/** Panel anlegen. side = "left" | "right". */
export function definePanel(side, { title, sections }) {
  const el = document.createElement("aside");
  el.className = `panel panel-${side}`;
  el.dataset.side = side;
  const open = prefs.get("panel-" + side, side === "left");
  const view = prefs.get("panel-view-" + side, null) || { open: sections[0]?.id };
  const entry = { el, sections, view, open, title, side };
  panels.set(side, entry);
  document.getElementById("panels").appendChild(el);

  el.addEventListener("click", e => {
    const head = e.target.closest("[data-panel-toggle]");
    if (head) { setOpen(side, !entry.open); return; }
    const sec = e.target.closest("[data-sec-toggle]");
    if (sec) {
      const id = sec.dataset.secToggle;
      view.open = view.open === id ? null : id;
      prefs.set("panel-view-" + side, view);
      render(side);
      // frisch geöffneten Abschnitt in den Blick rücken
      requestAnimationFrame(() => el.querySelector(`[data-sec="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  });
  render(side);
  return entry;
}

export function setOpen(side, open) {
  const p = panels.get(side);
  if (!p) return;
  p.open = open;
  prefs.set("panel-" + side, open);
  render(side);
}

export const isPanelOpen = side => !!panels.get(side)?.open;

/** Abschnitt gezielt öffnen (z. B. aus dem HUD heraus). */
export function openSection(side, id) {
  const p = panels.get(side);
  if (!p) return;
  p.view.open = id;
  p.open = true;
  prefs.set("panel-" + side, true);
  prefs.set("panel-view-" + side, p.view);
  render(side);
  requestAnimationFrame(() => p.el.querySelector(`[data-sec="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
}

function head(ctx, p) {
  const s = ctx.state;
  if (p.side === "left") {
    const lv = normalizeLivery(s.airline.livery);
    const tail = lv.base.fin, tailTxt = lv.items.find(i => i.t === "text" && i.z === "fin");
    return html`<div class="panel-headrow">
      <a class="panel-back" href="../../" title="Zurück zu Soy &amp; Soul" aria-label="Zurück zur Startseite">${raw(ICONS.back)}</a>
      <button class="panel-head" data-panel-toggle aria-expanded="${String(p.open)}">
        <span class="tail" style="background:${tail};color:${tailTxt?.c || "#1b2230"}">${s.airline.iata}</span>
        <span class="panel-title"><b>Airline</b><small>${s.airline.name} · ${s.player.code}</small></span>
        ${chev(p.open)}</button></div>`;
  }
  return html`<button class="panel-head" data-panel-toggle aria-expanded="${String(p.open)}">
    <span class="panel-title r"><b>${p.title}</b><small>Routen, Markt, Technik</small></span>
    ${chev(p.open)}</button>`;
}

const chev = open => raw(`<svg class="chev${open ? " up" : ""}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>`);

function render(side) {
  const p = panels.get(side), ctx = ctxRef;
  if (!p || !ctx?.state) return;
  p.el.classList.toggle("open", p.open);
  const body = p.open ? html`<div class="panel-body">${p.sections.map(sec => {
    const isOpen = p.view.open === sec.id;
    const b = sec.badge?.(ctx);
    return html`<section class="psec ${isOpen ? "open" : ""}" data-sec="${sec.id}">
      <button class="psec-head" data-sec-toggle="${sec.id}" aria-expanded="${String(isOpen)}">
        ${raw(ICONS[sec.icon] || "")}<span class="grow">${sec.title}</span>
        ${b ? html`<i class="badge ${b.kind || ""}">${b.n}</i>` : ""}
        ${chev(isOpen)}</button>
      ${isOpen ? html`<div class="psec-body">${sec.render(ctx, p.view)}</div>` : ""}
    </section>`;
  })}</div>` : html``;
  p.el.innerHTML = head(ctx, p).s + body.s;

  // Handler des offenen Abschnitts verdrahten
  const sec = p.sections.find(s => s.id === p.view.open);
  const bodyEl = p.el.querySelector(".psec.open .psec-body");
  if (sec && bodyEl) {
    const api = { rerender: () => render(side), open: (id, params) => ctx.openApp(id, params), close: () => setOpen(side, false) };
    if (sec.click) delegate(bodyEl, sec.click(ctx, p.view, api));
    if (sec.change) delegate(bodyEl, sec.change(ctx, p.view, api), "change");
    if (sec.input) delegate(bodyEl, sec.input(ctx, p.view, api), "input");
    delegate(bodyEl, { ptab: b => { p.view[b.dataset.ptabKey || "tab"] = b.dataset.ptab; prefs.set("panel-view-" + side, p.view); render(side); } });
    sec.tick?.(bodyEl, ctx, p.view);
  }
}

/** Während jemand tippt oder einen Regler zieht, nicht neu zeichnen. */
const typing = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "");

export function refreshPanels() { if (!typing()) for (const side of panels.keys()) render(side); }

export function tickPanels() {
  for (const [side, p] of panels) {
    if (!p.open) continue;
    const sec = p.sections.find(s => s.id === p.view.open);
    const bodyEl = p.el.querySelector(".psec.open .psec-body");
    if (sec?.tick && bodyEl) sec.tick(bodyEl, ctxRef, p.view);
  }
}
