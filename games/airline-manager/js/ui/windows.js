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
  el.style.left = "-9999px"; el.style.top = "84px"; // erst rendern + messen, dann freien Platz suchen
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
  place(el, pos);
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

// ---------- Freien Platz finden
const TOP = 84, DOCK_H = 96, STEP = 16;
const rectOf = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Neues Fenster dorthin, wo es am wenigsten andere Fenster (und die Flug-Infokarte) verdeckt. */
function place(el, saved) {
  if (innerWidth <= 720) return; // mobil: CSS legt Fenster unten an
  const w = el.offsetWidth, h = Math.min(el.offsetHeight, innerHeight - TOP - DOCK_H);
  const others = [...open.values()].map(o => o.el).filter(o => o !== el).map(rectOf);
  const fc = document.getElementById("flightcard");
  if (fc && !fc.hidden) others.push(rectOf(fc));
  const cost = (x, y) => others.reduce((s, o) => s + overlap({ x, y, w, h }, o), 0);
  let best = null;
  const consider = (x, y, bias) => { const c = cost(x, y) * 1000 + bias; if (!best || c < best.c) best = { x, y, c }; };
  if (saved) consider(clampX(saved.x, w), clampY(saved.y, h), -1); // gespeicherte Position bevorzugen, wenn sie frei ist
  for (let y = TOP; y <= Math.max(TOP, innerHeight - DOCK_H - h); y += STEP)
    for (let x = 8; x <= Math.max(8, innerWidth - w - 8); x += STEP) consider(x, y, x * 0.6 + (y - TOP));
  el.style.left = best.x + "px";
  el.style.top = best.y + "px";
}
const clampX = (x, w) => Math.max(8, Math.min(innerWidth - w - 8, x));
const clampY = (y, h) => Math.max(TOP, Math.min(innerHeight - DOCK_H - Math.min(h, 200), y));

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
