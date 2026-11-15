// Einstieg: verbindet Spielstand, Simulation, Karte und Fenster-Apps.
import { clock } from "./core/clock.js";
import { bus } from "./core/events.js";
import { load, save, wipe, newGame } from "./core/store.js";
import { STOCKS } from "./core/config.js";
import { fmt } from "./core/util.js";
import { settle } from "./sim/engine.js";
import { sharePrice, companyValue } from "./sim/stocks.js";
import { summary } from "./sim/ledger.js";
import { newPlayer } from "./net/player.js";
import { fetchMarket, publish, online } from "./net/backend.js";
import { createMap } from "./ui/map.js";
import { initWindows, register, openApp, toggle, isOpen, refreshAll, tickAll, allApps } from "./ui/windows.js";
import { renderHud, tickHud } from "./ui/hud.js";
import { renderFlightCard, tickFlightCard } from "./ui/flightcard.js";
import { toast } from "./ui/toast.js";
import { showOnboarding } from "./ui/onboarding.js";
import { ICONS } from "./ui/icons.js";
import { esc } from "./ui/dom.js";
import { openPainter } from "./ui/painter.js";
import { setTracedProfiles } from "./art/geometry.js";

import hangar from "./ui/apps/hangar.js";
import shop from "./ui/apps/shop.js";
import routes from "./ui/apps/routes.js";
import maint from "./ui/apps/maint.js";
import fuel from "./ui/apps/fuel.js";
import airline from "./ui/apps/airline.js";
import stocks from "./ui/apps/stocks.js";
import board from "./ui/apps/leaderboard.js";
import logbook from "./ui/apps/logbook.js";

const DOCK = [[hangar, "Hangar"], [shop, "Markt"], [routes, "Routen"], [maint, "Wartung"], [fuel, "Kerosin"], [stocks, "Börse"], [board, "Rangliste"], [logbook, "Logbuch"]];
// Die Airline-App öffnet sich über das Dropdown oben links (ui/airmenu.js)

// ---------- Kontext, den alle UI-Teile bekommen
const ctx = {
  state: null,
  now: clock.now,
  market: { list: [], demo: !online(), fetched: 0, error: null },
  highlightRoute: null,
  map: null,
  toast,
  openApp: (id, params) => openApp(id, params),
  openPainter: () => openPainter(ctx),

  /** Aktion ausführen: bei Erfolg speichern und UI aktualisieren, sonst Meldung zeigen. */
  run(fn, ...args) {
    const r = fn(ctx.state, ...args);
    if (!r || r.ok === false) { toast(r?.msg || "Nicht möglich.", "warn"); return false; }
    commit();
    return r;
  },
  sharePrice: () => sharePrice(ctx.state, ctx.now(), ctx.marketPrices()),
  marketPrices: () => Object.fromEntries(ctx.market.list.map(l => [l.code, l.price])),
  /** Börsenliste inkl. eigener Airline mit Live-Kurs */
  listings() {
    const s = ctx.state, me = { code: s.player.code, name: s.airline.name, iata: s.airline.iata, hub: s.airline.hubs[0], price: ctx.sharePrice(), fleet: s.fleet.filter(a => a.status !== "crashed").length, rep: s.airline.rep };
    return [me, ...ctx.market.list.filter(l => l.code !== me.code)].sort((a, b) => b.price - a.price);
  },
  inAir() {
    const now = ctx.now();
    return ctx.state.fleet.filter(a => a.status === "active" && a.ops && now >= a.ops.dep).length;
  },
  highlight(id) { ctx.highlightRoute = id; ctx.map.updateStatic(); },
  onSelect(id) { renderFlightCard(document.getElementById("flightcard"), ctx, id); },
  async refreshMarket() {
    try { const m = await fetchMarket(ctx.now()); ctx.market = { ...m, fetched: Date.now(), error: null }; }
    catch (e) { ctx.market.error = "Börse gerade nicht erreichbar."; }
  },
  replaceState(s) { save(s); location.reload(); },
  resetGame() { wipe(); location.reload(); }
};

function commit() {
  save(ctx.state);
  refreshAll();
  ctx.map.updateStatic();
  ctx.map.updatePlanes();
  updateDock();
  renderHud(document.getElementById("hud"), ctx);
  renderFlightCard(document.getElementById("flightcard"), ctx, ctx.map.selected);
}

// ---------- Dock
function buildDock() {
  const dock = document.getElementById("dock");
  dock.innerHTML = DOCK.map(([app, label]) => `<button data-app="${app.id}" aria-pressed="false" title="${esc(app.title)}">${ICONS[app.icon]}<span>${esc(label)}</span></button>`).join("");
  dock.addEventListener("click", e => { const b = e.target.closest("[data-app]"); if (b) toggle(b.dataset.app); });
  document.addEventListener("windows:change", updateDock);
  updateDock();
}

function updateDock() {
  for (const b of document.querySelectorAll("#dock [data-app]")) {
    const app = allApps().find(a => a.id === b.dataset.app);
    b.setAttribute("aria-pressed", String(isOpen(app.id)));
    b.querySelector(".badge")?.remove();
    const badge = ctx.state && app.badge?.(ctx);
    if (badge) b.insertAdjacentHTML("beforeend", `<i class="badge ${badge.kind}">${badge.n}</i>`);
  }
}

// ---------- Live-Schleifen
function tick() {
  if (!ctx.state) return;
  ctx.map.updatePlanes();
  tickHud(document.getElementById("hud"), ctx);
  tickAll();
  tickFlightCard(document.getElementById("flightcard"), ctx, ctx.map.selected);
}

function step() {
  const r = settle(ctx.state, ctx.now());
  if (r.clockWarning) toast("Die Geräte-Uhr wurde zurückgestellt – das Spiel rechnet nicht rückwärts.", "warn");
  if (r.legs || r.checks || r.crashes || r.incidents) { commit(); renderFlightCard(document.getElementById("flightcard"), ctx, ctx.map.selected); }
}

async function publishLoop() {
  if (!online()) return;
  const s = ctx.state, now = ctx.now();
  try {
    await publish({
      code: s.player.code, secret: s.player.secret, name: s.airline.name, iata: s.airline.iata, hub: s.airline.hubs[0],
      share_price: +ctx.sharePrice().toFixed(4), value: Math.round(companyValue(s, now, ctx.marketPrices()).total),
      rep: +s.airline.rep.toFixed(2), fleet: s.fleet.filter(a => a.status !== "crashed").length,
      profit_30d: Math.round(summary(s, 30, now).profit), livery: s.airline.livery
    });
  } catch (e) { console.warn(e); }
  await ctx.refreshMarket();
}

// ---------- Ereignisse aus der Simulation
bus.on("crash", ({ aircraft, route }) => toast(`ABSTURZ: ${aircraft.reg} auf ${route.from}–${route.to}. Überfällige Wartung!`, "bad", 9000));
bus.on("incident", ({ aircraft }) => toast(`Vorfall auf ${aircraft.reg} – Wartung überfällig.`, "warn", 6000));
bus.on("delivered", ({ aircraft }) => toast(`${aircraft.reg} wurde ausgeliefert und steht im Hangar.`, "good"));

// ---------- Start
function start() {
  const s = ctx.state;
  const report = settle(s, ctx.now(), { quiet: true });
  save(s);
  renderHud(document.getElementById("hud"), ctx);
  buildDock();
  ctx.map.updateStatic();
  if (report.legs) {
    toast(`Willkommen zurück! Seit ${fmt.dateTime(report.from)}: ${report.legs} Flüge, Ergebnis ${fmt.money(report.profit)}${report.capped ? " (max. 30 Tage nachgerechnet)" : ""}.`, report.profit >= 0 ? "good" : "warn", 7000);
  }
  if (report.crashes) toast(`Während deiner Abwesenheit: ${report.crashes} Absturz/Abstürze. Siehe Logbuch.`, "bad", 9000);
  if (!s.fleet.length) setTimeout(() => openApp("shop"), 400);
  setInterval(tick, 1000);
  setInterval(step, 5000);
  ctx.refreshMarket().then(() => { publishLoop(); setInterval(publishLoop, STOCKS.refreshMs); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(ctx.state); else step(); });
  addEventListener("pagehide", () => save(ctx.state));
  if (new URLSearchParams(location.search).has("dev")) {
    window.am = { ctx, clock, settle, step };
    console.info("Dev-Modus: am.clock.shift(stunden) verschiebt die Zeit, danach am.step()");
  }
}

async function boot() {
  // Abgepauste Blaupausen-Profile (tools/profil-werkstatt.html) laden – fehlen sie, gelten die Maß-Profile.
  try { setTracedProfiles(await (await fetch("data/profiles.json", { cache: "no-cache" })).json()); } catch { /* optional */ }
  initWindows(ctx);
  for (const [app] of DOCK) register(app);
  register(airline);
  ctx.map = createMap(document.getElementById("map"), ctx);
  ctx.state = load();
  if (ctx.state) return start();
  showOnboarding(ctx, ({ name, iata, hub }) => {
    ctx.state = newGame({ name, iata, hub, player: newPlayer(), now: ctx.now() });
    save(ctx.state);
    start();
    toast(`${name} ist gegründet! Deine Flugzeuge sind noch weiß – im Airline-Menü oben links → Lackiererei malst du deine Livery.`, "good", 8000);
  });
}

boot();

