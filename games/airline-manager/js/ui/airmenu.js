// Airline-Menü: großes Dropdown oben links (Klick auf Airline-Name). Ersetzt den Airline-Knopf im Dock.
import { html, raw } from "./dom.js";
import { fmt } from "../core/util.js";
import { GAME } from "../core/config.js";
import { summary } from "../sim/ledger.js";
import { sideView } from "./aircraftArt.js";

const ITEMS = [
  ["finance", "Finanzen", "Einnahmen, Ausgaben, Unternehmenswert", '<path d="M4 19h16"/><path d="M7 15v-4M12 15V7M17 15v-6"/>'],
  ["rep", "Reputation", "Was Passagiere von dir halten", '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'],
  ["offer", "Angebot an Bord", "Catering und Gepäckgebühren", '<path d="M4 11h16"/><path d="M5 11a7 7 0 0 1 14 0"/><path d="M3 15h18"/>'],
  ["staff", "Personal & Schulung", "Crews, Techniker, Schulungsstufe", '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14c3 0 6 1.8 6 5"/>'],
  ["paint", "Lackiererei", "Eigene Livery für die ganze Flotte malen", '<path d="M4 20c2 0 4-1 4-4l9-9 3 3-9 9c-3 0-4 2-4 4"/><path d="M14 6l4 4"/>'],
  ["contract", "Herstellerverträge", "Exklusivdeal mit Airbus oder Boeing", '<path d="M6 3h9l4 4v14H6z"/><path d="M9 13l2 2 4-4"/>'],
  ["hubs", "Drehkreuze", "Weitere Basen eröffnen", '<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/>'],
  ["account", "Spielstand & Code", "Spielercode, Export, Gerätewechsel", '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>']
];

let menu = null;

export function toggleAirMenu(ctx, anchor) {
  if (menu) return closeAirMenu();
  const s = ctx.state, now = ctx.now(), sum = summary(s, 30, now);
  const main = s.fleet.find(a => a.status !== "crashed")?.typeId || "a320neo";
  menu = document.createElement("div");
  menu.className = "airmenu glass";
  menu.setAttribute("role", "menu");
  menu.innerHTML = html`
    <div class="am-head">
      <div class="am-art">${raw(sideView(main, s.airline.livery, { fit: true, shadow: false }))}</div>
      <div><b>${s.airline.name}</b><span class="code">${s.player.code} · ${s.airline.iata} · Basis ${s.airline.hubs.join(", ")}</span></div>
    </div>
    <div class="am-stats">
      <div><span>Kasse</span><b>${fmt.money(s.cash)}</b></div>
      <div><span>Ergebnis 30 T</span><b class="${sum.profit < 0 ? "bad" : "good"}">${fmt.money(sum.profit)}</b></div>
      <div><span>Reputation</span><b>${s.airline.rep.toFixed(1)}</b></div>
      <div><span>Flotte</span><b>${s.fleet.filter(a => a.status !== "crashed").length}</b></div>
    </div>
    <div class="am-grid">${ITEMS.map(([id, t, d, icon]) => html`<button role="menuitem" data-m="${id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${raw(icon)}</svg><span><b>${t}</b><small>${d}</small></span></button>`)}</div>
    <div class="am-foot small muted">Airline Manager ${GAME.label}</div>`.s;
  document.body.appendChild(menu);
  anchor?.setAttribute("aria-expanded", "true");
  menu.addEventListener("click", e => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    closeAirMenu();
    if (b.dataset.m === "paint") ctx.openPainter();
    else ctx.openApp("airline", { tab: b.dataset.m });
  });
  setTimeout(() => {
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
  });
  menu.querySelector("[data-m]").focus();
}

export function closeAirMenu() {
  if (!menu) return;
  menu.remove(); menu = null;
  document.querySelector("[data-airmenu]")?.setAttribute("aria-expanded", "false");
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("keydown", esc);
}
const outside = e => { if (!menu?.contains(e.target) && !e.target.closest("[data-airmenu]")) closeAirMenu(); };
const esc = e => { if (e.key === "Escape") closeAirMenu(); };
