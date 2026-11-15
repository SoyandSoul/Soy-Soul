// Fenstermanager: Apps öffnen sich als verschiebbare Fenster über der Karte.
//
// Eine App ist ein Objekt:
//   id, title, icon, width
//   render(ctx, view)          → html`…`  (komplett neu zeichnen; view = eigener UI-Zustand der App, z. B. Tab)
//   click(ctx, view, api)      → { aktionsname: (el, ev) => … }  für Elemente mit data-act="aktionsname"
//   change(ctx, view, api)     → dito für change-Events (Selects, Checkboxen)
//   input(ctx, view, api)      → dito für input-Events (Schieberegler live)
//   tick(el, ctx, view)        → optional, jede Sekunde (Live-Werte ohne Neuzeichnen)
//   badge(ctx)                 → optional, Zahl/Warnung im Dock

import { ICONS } from "./icons.js";
import { delegate } from "./dom.js";
import { prefs } from "../core/store.js";

const apps = new Map();
const open = new Map(); // id → { el, body, view }
let z = 10, ctxRef = null;

export function initWindows(ctx) { ctxRef = ctx; }
export const register = app => apps.set(app.id, app);
export const isOpen = id => open.has(id);
export const allApps = () => [...apps.values()];

export function toggle(id, params) { isOpen(id) ? close(id) : openApp(id, params); }

export function openApp(id, params = {}) {
  const app = apps.get(id);
  if (open.has(id)) { const w = open.get(id); Object.assign(w.view, params); rerender(id); focus(id); return; }
  const el = document.createElement("section");
  el.className = "win";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", app.title);
  el.innerHTML = `<header>${ICONS[app.icon] || ""}<h2>${app.title}</h2><button data-close aria-label="Schließen">${ICONS.close}</button></header><div class="body"></div>`;
  const pos = prefs.get("win-" + id, null);
  const w = Math.min(app.width || 480, innerWidth - 16);
  el.style.width = w + "px";
  const n = open.size;
  el.style.left = (pos?.x ?? Math.max(8, Math.min(innerWidth - w - 8, 24 + n * 36))) + "px";
  el.style.top = Math.min(pos?.y ?? 84 + n * 28, Math.max(8, innerHeight - 260)) + "px";
  document.getElementById("windows").appendChild(el);
  const body = el.querySelector(".body");
  const view = { ...(app.initialView?.() || {}), ...params };
  const entry = { el, body, view, dirty: false };
  open.set(id, entry);
  const api = { rerender: () => rerender(id), close: () => close(id), open: openApp };
  if (app.click) delegate(body, app.click(ctxRef, view, api));
  if (app.change) delegate(body, app.change(ctxRef, view, api), "change");
  if (app.input) delegate(body, app.input(ctxRef, view, api), "input");
  // Tabs sind in allen Apps gleich verdrahtet
  delegate(body, { tab: b => { view.tab = b.dataset.tab; rerender(id); } });
  el.querySelector("[data-close]").onclick = () => close(id);
  el.addEventListener("pointerdown", () => focus(id));
  body.addEventListener("focusout", () => setTimeout(() => { if (entry.dirty && !hasFocus(entry)) rerender(id); }, 0));
  drag(el, id);
  rerender(id);
  focus(id);
  document.dispatchEvent(new CustomEvent("windows:change"));
}

export function close(id) {
  const w = open.get(id);
  if (!w) return;
  w.el.remove();
  open.delete(id);
  document.dispatchEvent(new CustomEvent("windows:change"));
}

function focus(id) {
  for (const [k, w] of open) w.el.classList.toggle("focus", k === id);
  open.get(id).el.style.zIndex = ++z;
}

const hasFocus = w => w.el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);

/** Neu zeichnen. Während jemand in einem Feld tippt, wird verschoben, damit nichts verloren geht. */
export function rerender(id) {
  const w = open.get(id), app = apps.get(id);
  if (!w) return;
  if (hasFocus(w)) { w.dirty = true; return; }
  w.dirty = false;
  const scroll = w.body.scrollTop;
  w.body.innerHTML = app.render(ctxRef, w.view).s;
  w.body.scrollTop = scroll;
  app.tick?.(w.body, ctxRef, w.view);
}

export function refreshAll() { for (const id of open.keys()) rerender(id); }
export function tickAll() { for (const [id, w] of open) apps.get(id).tick?.(w.body, ctxRef, w.view); }

function drag(el, id) {
  const h = el.querySelector("header");
  h.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || innerWidth <= 720) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
    h.setPointerCapture(e.pointerId);
    const move = ev => {
      el.style.left = Math.max(-el.offsetWidth + 80, Math.min(innerWidth - 80, ev.clientX - sx)) + "px";
      el.style.top = Math.max(0, Math.min(innerHeight - 50, ev.clientY - sy)) + "px";
    };
    const up = () => { h.removeEventListener("pointermove", move); prefs.set("win-" + id, { x: el.offsetLeft, y: el.offsetTop }); };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up, { once: true });
  });
}
