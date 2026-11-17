// Einstieg: verbindet Spielstand, Simulation, Karte und Fenster-Apps.
import { clock } from "./core/clock.js";
import { BOOST } from "./core/config.js";
import { bus } from "./core/events.js";
import { load, save, wipe, newGame } from "./core/store.js";
import { STOCKS } from "./core/config.js";
import { profileOf, rate, qualifies } from "./sim/rating.js";
import { check as notifyCheck } from "./ui/notify.js";
import { fmt } from "./core/util.js";
import { settle } from "./sim/engine.js";
import { sharePrice, companyValue } from "./sim/stocks.js";
import { summary } from "./sim/ledger.js";
import { newPlayer } from "./net/player.js";
import { fetchMarket, publish, online } from "./net/backend.js";
import { createMap } from "./ui/map.js";
import { initWindows, register, openApp, toggle, isOpen, refreshAll, tickAll, allApps } from "./ui/windows.js";
import { initPanels, definePanel, refreshPanels, tickPanels, openSection } from "./ui/panels.js";
import { AIRLINE_SECTIONS } from "./ui/panels/airline.js";
import { OPS_SECTIONS } from "./ui/panels/ops.js";
import { renderHud, tickHud } from "./ui/hud.js";
import { renderFlightCard, tickFlightCard } from "./ui/flightcard.js";
import { toast } from "./ui/toast.js";
import { showOnboarding } from "./ui/onboarding.js";
import { openPainter } from "./ui/painter.js";
import { setTracedProfiles } from "./art/geometry.js";

import hangar from "./ui/apps/hangar.js";
import shop from "./ui/apps/shop.js";
import routes from "./ui/apps/routes.js";
import maint from "./ui/apps/maint.js";
import fuel from "./ui/apps/fuel.js";
import stocks from "./ui/apps/stocks.js";
import board from "./ui/apps/leaderboard.js";
import logbook from "./ui/apps/logbook.js";
import changelog from "./ui/apps/changelog.js";
import report from "./ui/apps/report.js";
import marketing from "./ui/apps/marketing.js";
import hub from "./ui/apps/hub.js";
import bank from "./ui/apps/bank.js";
import world from "./ui/apps/world.js";

// Die großen Werkzeuge bleiben Fenster; erreichbar über das Betriebs-Panel rechts (ui/panels/ops.js).
const APPS = [hangar, shop, routes, maint, fuel, stocks, board, logbook, changelog, report, marketing, hub, bank, world];

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
  refreshPanels();
  ctx.map.updateStatic();
  ctx.map.updatePlanes();
  renderHud(document.getElementById("hud"), ctx);
  renderFlightCard(document.getElementById("flightcard"), ctx, ctx.map.selected);
}

// ---------- Live-Schleifen
function tick() {
  if (!ctx.state) return;
  // Schnellstart: Die ersten Flüge laufen im Zeitraffer, damit am Anfang nicht eine Stunde
  // lang nichts passiert. Der Vorlauf wandert in den Spielstand, sonst spränge die Uhr zurück.
  if (ctx.state.stats.legs < BOOST.legs) {
    ctx.state.boost = clock.advanceBoost(BOOST.factor);
  } else if (boostWasOn) {
    boostWasOn = false;
    toast("Schnellstart beendet – ab jetzt läuft die Uhr in Echtzeit weiter.", "info", 6000);
    commit();
  }
  ctx.map.updatePlanes();
  tickHud(document.getElementById("hud"), ctx);
  tickAll();
  tickPanels();
  tickFlightCard(document.getElementById("flightcard"), ctx, ctx.map.selected);
  notifyCheck(ctx.state, ctx.now());
}

let boostWasOn = false;

function step() {
  const r = settle(ctx.state, ctx.now());
  if (r.clockWarning) toast("Die Geräte-Uhr wurde zurückgestellt – das Spiel rechnet nicht rückwärts.", "warn");
  if (r.legs || r.checks || r.crashes || r.incidents || r.irops || r.charters) { commit(); renderFlightCard(document.getElementById("flightcard"), ctx, ctx.map.selected); }
}

/**
 * Eigenen Eintrag in Börse und Rangliste aktualisieren.
 * Zwei Regeln aus der Wunschliste: erst ab zwei Flugzeugen gelistet, und höchstens
 * alle zwei Stunden – häufiger wäre weder nötig noch höflich gegenüber dem Server.
 */
async function publishLoop() {
  await ctx.refreshMarket();
  if (!online() || !ctx.state) return;
  const s = ctx.state, now = ctx.now();
  const profile = profileOf(s, now);
  if (!qualifies(profile)) return;
  if (s.lastPublish && now - s.lastPublish < STOCKS.publishEveryMs) return;
  try {
    const r = rate(profile);
    await publish({
      code: s.player.code, secret: s.player.secret, name: s.airline.name, iata: s.airline.iata, hub: s.airline.hubs[0],
      share_price: +ctx.sharePrice().toFixed(4), value: Math.round(companyValue(s, now, ctx.marketPrices()).total),
      rep: +s.airline.rep.toFixed(2), fleet: profile.fleet,
      profit_30d: Math.round(profile.profit30), livery: s.airline.livery,
      profile: { ...profile, rating: r }
    });
    s.lastPublish = now;
    commit();
  } catch (e) { console.warn(e); }
}

// ---------- Ereignisse aus der Simulation
bus.on("crash", ({ aircraft, route }) => toast(`ABSTURZ: ${aircraft.reg} auf ${route.from}–${route.to}. Überfällige Wartung!`, "bad", 9000));
bus.on("incident", ({ aircraft }) => toast(`Vorfall auf ${aircraft.reg} – Wartung überfällig.`, "warn", 6000));
bus.on("delivered", ({ aircraft }) => toast(`${aircraft.reg} wurde ausgeliefert und steht im Hangar.`, "good"));
bus.on("goal", ({ goal, reward }) => toast(`Ziel erreicht: ${goal.title}${reward ? ` – ${reward}` : ""}`, "good", 8000));

// ---------- Start
function start() {
  const s = ctx.state;
  const report = settle(s, ctx.now(), { quiet: true });
  save(s);
  renderHud(document.getElementById("hud"), ctx);
  definePanel("left", { title: "Airline", sections: AIRLINE_SECTIONS });
  definePanel("right", { title: "Betrieb", sections: OPS_SECTIONS });
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
    window.am = { ctx, clock, settle, step, get map() { return ctx.map; } };
    console.info("Dev-Modus: am.clock.shift(stunden) verschiebt die Zeit, danach am.step()");
  }
}

async function boot() {
  // Abgepauste Blaupausen-Profile (tools/profil-werkstatt.html) laden – fehlen sie, gelten die Maß-Profile.
  try { setTracedProfiles(await (await fetch("data/profiles.json", { cache: "no-cache" })).json()); } catch { /* optional */ }
  initWindows(ctx);
  initPanels(ctx);
  for (const app of APPS) register(app);
  ctx.map = createMap(document.getElementById("map"), ctx);
  ctx.state = load();
  if (ctx.state) {
    // Gesicherten Vorlauf des Schnellstarts wiederherstellen, bevor irgendetwas nachgerechnet wird
    clock.setBoost(ctx.state.boost || 0);
    boostWasOn = ctx.state.stats.legs < BOOST.legs;
    return start();
  }
  showOnboarding(ctx, ({ name, iata, hub }) => {
    clock.setBoost(0);
    boostWasOn = true;
    ctx.state = newGame({ name, iata, hub, player: newPlayer(), now: ctx.now() });
    save(ctx.state);
    start();
    toast(`${name} ist gegründet! Mit dem Startkapital kaufst du noch kein Flugzeug – lease dein erstes im Betriebs-Panel rechts (Flugzeugmarkt → Leasen) und stelle links Personal ein.`, "good", 11000);
  });
}

boot();

