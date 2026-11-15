// Simulationstests ohne Browser:  node games/airline-manager/tests/sim.test.mjs
import assert from "node:assert/strict";
import { newGame } from "../js/core/store.js";
import { H, DAY, CHECKS } from "../js/core/config.js";
import { settle } from "../js/sim/engine.js";
import * as act from "../js/sim/actions.js";
import { positionAt } from "../js/sim/flight.js";
import { fuelPrice } from "../js/sim/fuel.js";
import { usedListings } from "../js/sim/market.js";
import { checkStatus } from "../js/sim/maintenance.js";
import { summary } from "../js/sim/ledger.js";
import { sharePrice } from "../js/sim/stocks.js";
import { AIRCRAFT } from "../js/data/aircraft.js";
import { AIRPORTS } from "../js/data/airports.js";

const T0 = Date.UTC(2026, 6, 1, 11, 0); // 1. Juli, 13:00 MESZ
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log("✓", name); };

test("Daten vollständig", () => {
  assert.ok(AIRCRAFT.length >= 25);
  assert.equal(new Set(AIRPORTS.map(a => a.iata)).size, AIRPORTS.length, "IATA doppelt");
  for (const a of AIRCRAFT) for (const k of ["seats", "rangeKm", "cruiseKmh", "runwayM", "fuelKgH", "payloadKg", "priceM"]) assert.ok(a[k] > 0, a.id + "." + k);
});

test("Kerosinpreis deterministisch und im Rahmen", () => {
  assert.equal(fuelPrice(T0), fuelPrice(T0));
  for (let i = 0; i < 2000; i++) { const p = fuelPrice(T0 + i * 3.7 * H); assert.ok(p > 0.4 && p < 1.4, p); }
});

test("Gebrauchtmarkt für alle gleich", () => {
  assert.deepEqual(usedListings(T0), usedListings(T0 + 3 * H));
});

function setup() {
  const s = newGame({ name: "Test Air", iata: "TA", hub: "FRA", player: { code: "AL-TST-001", secret: "x" }, now: T0 });
  const r = act.orderNew(s, "a320neo", 2, T0); assert.ok(r.ok, r.msg);
  settle(s, T0 + 2 * H);
  const route = act.createRoute(s, "FRA", "PMI").route;
  return { s, route, start: T0 + 2 * H };
}

test("Offline-Nachrechnung: Flug um 13 Uhr, Login um 17 Uhr", () => {
  const { s, route, start } = setup();
  const [ac] = s.fleet;
  assert.ok(act.assign(s, ac.id, route.id, start).ok);
  const p = positionAt(ac, route, start + 1 * H);
  assert.equal(p.phase, "air");
  assert.ok(p.progress > 0.4 && p.progress < 0.6, "nach 1 h etwa auf halber Strecke: " + p.progress);
  const rep = settle(s, start + 4 * H);
  assert.ok(rep.legs >= 1, "mindestens ein Flug abgerechnet");
  assert.ok(s.flights[0].paxTotal > 0);
});

test("Abrechnung ist unabhängig davon, wie oft man reinschaut", () => {
  const a = setup();
  act.assign(a.s, a.s.fleet[0].id, a.route.id, a.start);
  const b = { ...a, s: structuredClone(a.s) };
  settle(a.s, a.start + 3 * DAY);
  for (let h = 1; h <= 72; h++) settle(b.s, b.start + h * H);
  assert.equal(a.s.flights.length, b.s.flights.length);
  assert.ok(Math.abs(a.s.cash - b.s.cash) < 1, `${a.s.cash} vs ${b.s.cash}`);
});

test("Strecke ist profitabel (Balance-Grundcheck)", () => {
  const { s, route, start } = setup();
  for (const ac of s.fleet) act.assign(s, ac.id, route.id, start);
  settle(s, start + 7 * DAY);
  const sum = summary(s, 30, start + 7 * DAY);
  console.log("   7 Tage, 2× A320neo FRA–PMI:", Math.round(sum.profit / 1e3), "k$ Gewinn,", s.flights.length, "Flüge, Rep", s.airline.rep.toFixed(1));
  assert.ok(sum.profit > 0);
  assert.ok(sharePrice(s, start + 7 * DAY) > 0);
});

test("Auto-Check greift, Zähler werden zurückgesetzt", () => {
  const { s, route, start } = setup();
  const ac = s.fleet[0];
  ac.maint.A.fh = CHECKS.A.fh - 5;
  act.assign(s, ac.id, route.id, start);
  settle(s, start + 6 * H);
  assert.ok(ac.status === "check" || ac.maint.A.fh < 20, "A-Check gestartet/erledigt");
});

test("Überfällige Wartung → negative Stunden + Risiko", () => {
  const { s, route, start } = setup();
  const ac = s.fleet[0];
  ac.autoCheck = false;
  ac.id = "ac_fixed_for_test";            // Zufall ist deterministisch aus der ID
  ac.maint.A.fh = CHECKS.A.fh + 400;
  assert.ok(checkStatus(ac, start).A.rem < 0);
  act.assign(s, ac.id, route.id, start);
  settle(s, start + 60 * DAY);
  const events = s.flights.filter(f => f.event).length;
  console.log("   60 Tage ohne Wartung:", events, "Vorfälle/Abstürze, Status", ac.status);
  assert.ok(events > 0);
});

test("Bahnlänge wird geprüft", () => {
  const s = newGame({ name: "X", iata: "XX", hub: "LHR", player: { code: "c", secret: "s" }, now: T0 });
  act.orderNew(s, "a350-900", 1, T0); settle(s, T0 + 2 * H);
  const r = act.createRoute(s, "LHR", "LCY").route;
  const res = act.assign(s, s.fleet[0].id, r.id, T0 + 2 * H);
  assert.equal(res.ok, false);
});

test("Alle Typen zeichenbar, Livery passt auf jeden Typ", async () => {});
const { renderAircraft } = await import("../js/art/render.js");
const { normalizeLivery } = await import("../js/art/livery.js");
const lv = normalizeLivery({ body: "#fff", belly: "#123", tail: "#e00", stripe: "#e00", engine: "#123", text: "AB" });
for (const t of AIRCRAFT) { const svg = renderAircraft(t, lv); assert.ok(!/NaN|undefined/.test(svg), t.id); }
const fresh = newGame({ name: "W", iata: "WW", hub: "FRA", player: { code: "c", secret: "s" }, now: T0 });
assert.equal(fresh.airline.livery.items.length, 0, "neue Airline ist komplett weiß");
assert.ok(Object.values(fresh.airline.livery.base).every(c => c === "#ffffff"));

test("Erste 5 Flugzeuge sofort, danach Lieferzeit", () => {
  const g = newGame({ name: "D", iata: "DD", hub: "FRA", player: { code: "c", secret: "s" }, now: T0 });
  g.cash = 2e9;
  act.orderNew(g, "a320neo", 4, T0); act.orderNew(g, "a320neo", 3, T0);
  assert.deepEqual(g.fleet.map(a => a.status), ["idle", "idle", "idle", "idle", "idle", "delivery", "delivery"]);
  assert.ok(g.fleet[6].availableAt > g.fleet[5].availableAt, "zweites spätes Flugzeug derselben Bestellung kommt später");
});

test("Wetter deterministisch, Verspätungen kommen vor", async () => {});
const { weatherAt, weatherDelay } = await import("../js/sim/weather.js");
assert.deepEqual(weatherAt("OSL", T0), weatherAt("OSL", T0));
let delays = 0;
for (let h = 0; h < 24 * 60; h++) if (weatherDelay("OSL", Date.UTC(2026, 0, 1) + h * H, "k" + h)) delays++;
assert.ok(delays > 20 && delays < 24 * 60 * 0.5, "Oslo im Winter: " + delays);

console.log(`\n${pass} Tests bestanden`);
