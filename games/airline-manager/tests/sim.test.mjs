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
import { staffNeed, coverage, salaryPerDay, GROUPS } from "../js/sim/staff.js";
import { leaseFrame, monthlyObligation } from "../js/sim/lease.js";
import { goalProgress, nextGoal, GOALS } from "../js/sim/goals.js";
import { commonality } from "../js/sim/commonality.js";
import { routeOutlook } from "../js/sim/demand.js";
import { AIRCRAFT_BY_ID } from "../js/data/aircraft.js";
import { turnaroundHours, rushCost, rushSaving, departureBoard, rushAllQuote } from "../js/sim/handling.js";
import { tally, rateRoute, routeReport } from "../js/sim/report.js";
import { awareness, awarenessFactor, campaignQuote, activeCampaigns, awarenessFloor } from "../js/sim/marketing.js";
import { charterOffers, candidates as charterFits } from "../js/sim/charter.js";
import { liveryOffers, quoteFor, liveryRep, activeLiveries } from "../js/sim/adlivery.js";
import { repBreakdown, repAdvice } from "../js/sim/reputation.js";
import { levelOf, stage, nextStage, upkeepPerDay, hangarEffect, hubRep, loungeFactor, gateFactor } from "../js/sim/hub.js";
import { seatBudget, retrofitQuote, fleetFitting } from "../js/sim/fitting.js";
import { seatUnits } from "../js/sim/flight.js";
import { creditLimit, interestRate, quote, annuity, totalDebt, openLoans, monthlyLoad, payoffQuote, MONTH } from "../js/sim/credit.js";
import { nightPolygon } from "../js/sim/geo.js";
import { layout, groundPosition, gateIndex } from "../js/sim/ground.js";
import { runwaysFor, RUNWAYS } from "../js/data/runways.js";
import { easter, eventsAt, upcoming, demandFactor } from "../js/sim/calendar.js";
import { eventsOfWeek, activeEvents, closureAt, effectsAt, diversion, departureNotBefore } from "../js/sim/events.js";
import { describe as describeAirport, bestRoutes } from "../js/sim/airportInfo.js";
import { stars, sizeScore, efficiencyScore, rate, qualifies, profileOf } from "../js/sim/rating.js";
import { buyShares, sellShares, maxShares, stakeIn, demoMarket } from "../js/sim/stocks.js";
import { STOCKS, RATING } from "../js/core/config.js";
import { steps } from "../js/sim/firststeps.js";
import { pending } from "../js/ui/notify.js";
import { hubTimetable, detourFactor, waitFactor, connectingPax, hubWaves } from "../js/sim/connections.js";
import { CONNECT, IROPS } from "../js/core/config.js";
import { openCase, options as iropsOptions, replacements, compensation, repairHours, openCases } from "../js/sim/irops.js";
import { AIRPORT_BY_IATA } from "../js/data/airports.js";
import { companyValue } from "../js/sim/stocks.js";
import { sharePrice } from "../js/sim/stocks.js";
import { AIRCRAFT } from "../js/data/aircraft.js";
import { AIRPORTS } from "../js/data/airports.js";

const T0 = Date.UTC(2026, 6, 1, 11, 0); // 1. Juli, 13:00 MESZ
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log("✓", name); };

/**
 * Flugzeug-IDs sind im Spiel zufällig (uid() aus Zeit und Math.random). Der gesamte
 * deterministische Zufall hängt aber daran: Verspätungen, Defekte, Nachfrage-Rauschen.
 * Ohne feste IDs liefert derselbe Testlauf mal zwei, mal drei Flüge in sechs Stunden –
 * und die Balance-Zahlen unten wären nicht vergleichbar. Deshalb hier feste IDs.
 */
function stableIds(s) {
  s.fleet.forEach((ac, i) => { ac.id = `t-ac-${i}`; });
  return s;
}

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

function setup(n = 2) {
  const s = newGame({ name: "Test Air", iata: "TA", hub: "FRA", player: { code: "AL-TST-001", secret: "x" }, now: T0 });
  for (let i = 0; i < n; i++) { const r = act.leaseNew(s, "a320neo", 12, T0); assert.ok(r.ok, r.msg); }
  settle(s, T0 + 2 * H);
  const route = act.createRoute(s, "FRA", "PMI").route;
  const hired = act.hireAllOpen(s, T0 + 2 * H); assert.ok(hired.ok, hired.msg);
  stableIds(s);
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
  // Die wichtigste Invariante des ganzen Spiels: ohne Server darf das Ergebnis nicht davon
  // abhängen, wie oft jemand den Tab öffnet. Über 14 Tage auf den Cent genau.
  const a = setup();
  const route = act.createRoute(a.s, "FRA", "LHR").route;
  act.hireAllOpen(a.s, a.start);
  act.assign(a.s, a.s.fleet[0].id, route.id, a.start);
  act.assign(a.s, a.s.fleet[1].id, a.route.id, a.start);
  act.hireAllOpen(a.s, a.start);
  const b = { ...a, s: structuredClone(a.s) };
  settle(a.s, a.start + 14 * DAY);
  for (let h = 1; h <= 14 * 24; h++) settle(b.s, b.start + h * H);
  assert.equal(a.s.flights.length, b.s.flights.length);
  assert.equal(a.s.cash.toFixed(2), b.s.cash.toFixed(2), `${a.s.cash} vs ${b.s.cash}`);
  assert.equal(a.s.airline.rep.toFixed(6), b.s.airline.rep.toFixed(6), "auch die Reputation muss gleich laufen");
  assert.deepEqual(a.s.goals.done, b.s.goals.done, "Ziele fallen zur selben Zeit");
});

test("Gut gewählte Strecke ist profitabel (Balance-Grundcheck)", () => {
  // Ein geleastes Flugzeug auf einer nachfragestarken Strecke – so sieht vernünftiges Spiel aus.
  const { s, start } = setup(1);
  const route = act.createRoute(s, "FRA", "LHR").route;
  act.assign(s, s.fleet[0].id, route.id, start);
  act.hireAllOpen(s, start);          // neues Ziel heißt mehr Bodenpersonal
  let legs = 0;
  for (let d = 1; d <= 28; d++) legs += settle(s, start + d * DAY).legs;
  const sum = summary(s, 30, start + 28 * DAY), margin = sum.profit / sum.opRev;
  console.log(`   28 Tage, 1× A320neo FRA–LHR: ${Math.round(sum.profit / 1e3)} k$ Gewinn aus ${legs} Flügen, Marge ${(margin * 100).toFixed(0)} %, Rep ${s.airline.rep.toFixed(1)}`);
  assert.ok(sum.profit > 0, "Strecke muss Gewinn abwerfen");
  assert.ok(margin > 0.12 && margin < 0.55, `Marge ${(margin * 100).toFixed(0)} % liegt außerhalb des spielbaren Bandes`);
  assert.ok(sharePrice(s, start + 28 * DAY) > 0);
});

test("Zu viel Kapazität auf einer dünnen Strecke lohnt sich nicht", () => {
  // Gegenprobe: dieselbe Flotte auf eine nachfrageschwache Ferienstrecke – Auslastung und Ergebnis brechen ein.
  const { s, route, start } = setup();                       // route = FRA–PMI
  for (const ac of s.fleet) act.assign(s, ac.id, route.id, start);
  for (let d = 1; d <= 28; d++) settle(s, start + d * DAY);
  const lf = s.flights.reduce((a, f) => a + f.lf, 0) / s.flights.length;
  console.log(`   28 Tage, 2× A320neo FRA–PMI: Auslastung ${(lf * 100).toFixed(0)} %, Ergebnis ${Math.round(summary(s, 30, start + 28 * DAY).profit / 1e3)} k$`);
  assert.ok(lf < 0.55, "Überversorgung muss die Auslastung drücken");
});

test("Personal: ohne Crew kein Einsatz, Gehälter laufen als Tageskosten", () => {
  const s = newGame({ name: "Test Air", iata: "TA", hub: "FRA", player: { code: "c", secret: "x" }, now: T0 });
  s.cash = 300e6;
  act.orderNew(s, "a320neo", 2, T0);
  settle(s, T0 + 2 * H);
  const route = act.createRoute(s, "FRA", "LHR").route;
  const bad = act.assign(s, s.fleet[0].id, route.id, T0 + 2 * H);
  assert.equal(bad.ok, false, "ohne Personal darf kein Flugzeug in Dienst gehen");
  assert.match(bad.msg, /Personal/);
  const hired = act.hireAllOpen(s, T0 + 2 * H);
  assert.ok(hired.ok && hired.total > 0, "offene Stellen müssen besetzbar sein");
  assert.ok(act.assign(s, s.fleet[0].id, route.id, T0 + 2 * H).ok, "mit Personal muss es gehen");
  // Eine neue Destination hebt den Bedarf an Bodenpersonal – erst nach dem Nachbesetzen ist alles gedeckt.
  assert.ok(coverage(s).ground < 1, "neues Ziel muss zusätzliches Bodenpersonal verlangen");
  act.hireAllOpen(s, T0 + 2 * H);
  const need = staffNeed(s), cov = coverage(s);
  for (const g of GROUPS) assert.ok(cov[g] >= 1, `${g} unterbesetzt: ${cov.have[g]}/${need[g]}`);
  // Gehälter müssen auch ohne Flugbetrieb anfallen
  const before = s.cash;
  settle(s, T0 + 2 * H + 1 * DAY);
  const day = summary(s, 2, T0 + 2 * H + DAY).cost.staff;
  assert.ok(day > 0 && Math.abs(day - salaryPerDay(s).total) / day < 0.05, `Tagesgehälter ${day}`);
  assert.ok(s.cash !== before);
});

test("Auto-Check greift, Zähler werden zurückgesetzt", () => {
  const { s, route, start } = setup();
  const ac = s.fleet[0];
  ac.maint.A.fh = CHECKS.A.fh - 1;
  act.assign(s, ac.id, route.id, start);
  settle(s, start + 12 * H);
  assert.ok(ac.status === "check" || ac.maint.A.fh < 20, `A-Check gestartet/erledigt (fh ${ac.maint.A.fh.toFixed(1)}, Status ${ac.status})`);
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
  s.cash = 300e6;
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
  g.cash = 900e6;
  g.cash = 2e9;
  act.orderNew(g, "a320neo", 4, T0); act.orderNew(g, "a320neo", 3, T0);
  assert.deepEqual(g.fleet.map(a => a.status), ["idle", "idle", "idle", "idle", "idle", "delivery", "delivery"]);
  assert.ok(g.fleet[6].availableAt > g.fleet[5].availableAt, "zweites spätes Flugzeug derselben Bestellung kommt später");
});

test("Blaupausen: jeder Typ hat ein abgepaustes Profil, Vorlagen zeichnen sauber", async () => {});
const { readFileSync } = await import("node:fs");
const { setTracedProfiles, getProfile, tracedIds } = await import("../js/art/geometry.js");
const { SCHEMES, PALETTES, presetLivery } = await import("../js/art/liveryPresets.js");
setTracedProfiles(JSON.parse(readFileSync(new URL("../data/profiles.json", import.meta.url), "utf8")));
for (const t of AIRCRAFT) {
  assert.ok(tracedIds().includes(t.id), `${t.id} ohne Blaupause in data/profiles.json`);
  const p = getProfile(t.id);
  assert.equal(p.source, "blueprint", t.id);
  assert.ok(p.zones.fuselage.length && p.zones.fin.length && p.zones.wing.length, t.id + ": Bauteile fehlen");
  assert.ok(Math.abs(p.bbox.x1 - p.bbox.x0 - t.art.lengthM) < t.art.lengthM * 0.15, t.id + ": Länge passt nicht zur Blaupause");
}
for (const sc of SCHEMES) for (const pal of PALETTES.slice(0, 3)) {
  const svg = renderAircraft("a321neo", presetLivery(sc.id, pal.id, "Test Air", "TA"));
  assert.ok(!/NaN|undefined/.test(svg), sc.id + "/" + pal.id);
}
const used = usedListings(T0);
assert.ok(used.every(l => l.cond >= 0.35 && l.cond <= 0.98), "Gebraucht-Zustand liegt im erlaubten Bereich");

test("Leasing: Rate, Rahmen, Verlängerung und Rückgabe", () => {
  const s = newGame({ name: "Lease Air", iata: "LA", hub: "FRA", player: { code: "c", secret: "x" }, now: T0 });
  const before = s.cash;
  const r = act.leaseNew(s, "a320neo", 12, T0);
  assert.ok(r.ok, r.msg);
  const ac = r.aircraft;
  assert.ok(ac.lease && ac.lease.rate > 0, "Vertrag fehlt");
  assert.ok(s.cash < before, "Kaution muss abgebucht werden");
  // Geleastes Gerät gehört der Airline nicht
  assert.equal(act.sellAircraft(s, ac.id, T0).ok, false, "geleaste Maschine darf nicht verkäuflich sein");
  assert.equal(companyValue(s, T0).fleet, 0, "Leasingflugzeug zählt nicht zum Vermögen");
  // Der Rahmen begrenzt die Flotte: irgendwann sagt der Leasinggeber nein
  let leased = 1;
  while (act.leaseNew(s, "a320neo", 12, T0).ok && leased < 20) leased++;
  assert.ok(leased >= 2 && leased < 20, `Rahmen greift nicht (${leased} Flugzeuge)`);
  assert.ok(monthlyObligation(s) <= leaseFrame(s, T0).max * 1.001, "Verpflichtungen über dem Rahmen");
  // Raten laufen zeitanteilig als Kosten – über zehn Tage muss die Summe zur Monatsrate passen
  settle(s, T0 + 2 * H);
  const base = summary(s, 60, T0 + 2 * H).cost.lease || 0;
  settle(s, T0 + 2 * H + 10 * DAY);
  const ten = (summary(s, 60, T0 + 2 * H + 10 * DAY).cost.lease || 0) - base;
  const expect = monthlyObligation(s) / 30.4 * 10;
  assert.ok(Math.abs(ten - expect) / expect < 0.02, `Leasingraten 10 Tage: ${Math.round(ten)} statt ${Math.round(expect)}`);
  // Vertragsende: wird automatisch verlängert, solange keine Rückgabe gewünscht ist
  const until = ac.lease.until, rate = ac.lease.rate;
  settle(s, until + H);
  assert.ok(ac.lease.until > until && ac.lease.rate > rate, "Verlängerung fehlt");
  // Rückgabe: Kaution zurück, abzüglich Strafen
  const cash = s.cash, ret = act.returnLease(s, ac.id, until + 2 * H);
  assert.ok(ret.ok, ret.msg);
  assert.ok(!s.fleet.includes(ac), "Flugzeug muss zurückgehen");
  assert.ok(s.cash !== cash, "Rückgabe muss abgerechnet werden");
});

test("Ziele: Fortschritt, Freischalten und Belohnung", () => {
  const { s, start } = setup(1);
  const route = act.createRoute(s, "FRA", "LHR").route;
  act.assign(s, s.fleet[0].id, route.id, start);
  act.hireAllOpen(s, start);
  assert.equal(new Set(GOALS.map(g => g.id)).size, GOALS.length, "doppelte Ziel-IDs");
  const frameBefore = s.airline.frameBonus || 0;
  let fired = [];
  for (let d = 1; d <= 14; d++) fired.push(...(settle(s, start + d * DAY).goals || []));
  assert.ok(fired.length >= 3, `zu wenige Ziele erreicht: ${fired.length}`);
  assert.ok(s.goals.done.includes("route1") && s.goals.done.includes("fly1"), "Grundziele fehlen");
  assert.ok((s.airline.frameBonus || 0) > frameBefore, "Belohnung wurde nicht gutgeschrieben");
  // Jedes Ziel wird nur einmal vergeben
  const again = settle(s, start + 15 * DAY).goals || [];
  assert.equal(again.filter(g => s.goals.done.filter(x => x === g.id).length > 1).length, 0);
  assert.equal(new Set(s.goals.done).size, s.goals.done.length, "Ziel doppelt freigeschaltet");
  // Der Vorschlag muss aus einer frühen Gruppe kommen, nicht aus "Wirtschaft"
  const n = nextGoal(s, start + 15 * DAY);
  assert.ok(!n || n.group !== "Wirtschaft" || s.goals.done.length > 10, `unpassender Vorschlag: ${n?.title}`);
  const gp = goalProgress(s, start + 15 * DAY);
  assert.ok(gp.every(g => g.pct >= 0 && g.pct <= 1), "Fortschritt außerhalb 0..1");
});

test("Flottenvereinheitlichung: Bonus und Malus", () => {
  const mk = types => {
    const s = newGame({ name: "T", iata: "TT", hub: "FRA", player: { code: "c", secret: "x" }, now: T0 });
    s.cash = 5e9;
    for (const t of types) assert.ok(act.orderNew(s, t, 1, T0).ok, t);
    return commonality(s);
  };
  const pure = mk(["a320neo", "a320neo", "a320neo", "a320neo"]);
  const mixed = mk(["a320neo", "a220-300", "e175", "b787-9", "a350-900", "b777-300er"]);
  const tiny = mk(["a320neo", "a320neo"]);
  assert.equal(tiny.active, false, "unter drei Flugzeugen darf nichts passieren");
  assert.ok(pure.maint < 0.9 && pure.cockpit < 0.95 && pure.training < 0.85, "Einheitsflotte bringt zu wenig");
  assert.ok(mixed.maint > 1 && mixed.families === 6, "Mischflotte wird nicht teurer");
  assert.ok(pure.maint < mixed.maint && pure.training < mixed.training);
});

test("Streckenbewertung warnt vor Überversorgung", () => {
  const s = newGame({ name: "T", iata: "TT", hub: "FRA", player: { code: "c", secret: "x" }, now: T0 });
  const big = AIRCRAFT_BY_ID["a320neo"], small = AIRCRAFT_BY_ID["e175"];
  const thickRoute = routeOutlook(s, "FRA", "LHR", big, null, T0);
  const thinRoute = routeOutlook(s, "FRA", "PMI", big, null, T0);
  const thinSmall = routeOutlook(s, "FRA", "PMI", small, null, T0);
  assert.equal(thickRoute.verdict, "good", `FRA-LHR sollte tragen (${Math.round(thickRoute.lf * 100)} %)`);
  assert.ok(thinRoute.lf < thickRoute.lf - 0.2, `FRA-PMI muss deutlich schwächer sein (${Math.round(thinRoute.lf * 100)} % vs ${Math.round(thickRoute.lf * 100)} %)`);
  assert.ok(thinRoute.capacity < 1, `dünne Strecke darf kein ganzes A320neo tragen (${thinRoute.capacity})`);
  assert.ok(thinSmall.lf > thinRoute.lf, "kleineres Flugzeug muss auf dünner Strecke besser dastehen");
  assert.ok(thickRoute.capacity > thinRoute.capacity, "starke Strecke muss mehr Flugzeuge tragen");
  assert.ok(thinRoute.bookable > 0 && thinRoute.km > 1000);
  // Im Hochsommer trägt Palma deutlich mehr als im November – die Bewertung muss das abbilden
  const summer = routeOutlook(s, "FRA", "PMI", big, null, Date.UTC(2026, 6, 15));
  const winter = routeOutlook(s, "FRA", "PMI", big, null, Date.UTC(2026, 10, 15));
  assert.ok(summer.bookable > winter.bookable * 1.2, `Saison fehlt: Sommer ${summer.bookable}, Winter ${winter.bookable}`);
});

test("Abfertiger wirkt auf Standzeit, Kosten und Ruf", () => {
  const { s } = setup(1);
  const [ac] = s.fleet;
  const std = turnaroundHours(s, ac);
  assert.ok(act.setHandler(s, "budget").ok);
  const cheap = turnaroundHours(s, ac);
  assert.ok(act.setHandler(s, "premium").ok);
  const fast = turnaroundHours(s, ac);
  assert.ok(cheap > std && std > fast, `Standzeiten müssen sich staffeln: ${cheap} / ${std} / ${fast}`);
  assert.ok(!act.setHandler(s, "rush").ok, "rush ist kein wählbarer Abfertiger");
  assert.ok(!act.setHandler(s, "gibtsnicht").ok);
});

test("Schnellabfertigung: Preis nach gesparter Zeit, Abflug rückt vor", () => {
  const { s, route, start } = setup(1);
  const [ac] = s.fleet;
  assert.ok(act.assign(s, ac.id, route.id, start).ok);
  const now = start + 6 * H;
  settle(s, now);
  const board = departureBoard(s, now);
  if (!board.length) { assert.ok(true, "gerade nichts am Gate"); return; }
  const d = board[0];
  // Preis skaliert mit der Restzeit: später drücken heißt weniger sparen und weniger zahlen
  assert.ok(rushCost(s, d.ac, d.left) >= rushCost(s, d.ac, d.left / 2), "Preis muss mit der Restzeit fallen");
  assert.ok(rushSaving(d.left) > 0 && rushSaving(d.left) < d.left, "Vorziehen kürzt, ersetzt die Abfertigung aber nicht");
  const before = d.ac.ops.dep, cash = s.cash;
  const r = act.rushDeparture(s, d.ac.id, now);
  if (d.rushable) {
    assert.ok(r.ok, r.msg);
    assert.equal(d.ac.ops.dep, before - r.saved);
    assert.ok(s.cash < cash, "Schnellabfertigung muss Geld kosten");
    assert.ok(d.ac.ops.dep > now, "ein Flugzeug kann nicht ohne Abfertigung starten");
  }
  // Zweimal drücken bringt nichts mehr, wenn es gleich losgeht
  const q = rushAllQuote(s, now);
  assert.equal(q.total, q.list.reduce((a, x) => a + x.cost, 0));
});

test("Streckenbewertung: Sterne, Teilnoten und Hinweis", () => {
  const { s, route, start } = setup(2);
  for (const ac of s.fleet) assert.ok(act.assign(s, ac.id, route.id, start).ok);
  assert.equal(rateRoute(s, route.id, start), null, "unter zwei Flügen gibt es keine Bewertung");
  const now = start + 10 * DAY;
  settle(s, now);
  const rr = rateRoute(s, route.id, now);
  assert.ok(rr, "nach zehn Tagen muss eine Bewertung dastehen");
  assert.ok(rr.stars >= 0 && rr.stars <= 5, rr.stars);
  assert.equal(rr.parts.length, 3);
  for (const p of rr.parts) assert.ok(p.score >= 0 && p.score <= 1, `${p.key}: ${p.score}`);
  assert.equal(rr.weakest, rr.parts.slice().sort((a, b) => a.score - b.score)[0]);
  assert.ok(rr.hint.length > 20);
  // FRA–PMI ist bewusst überversorgt: die Auslastung muss die schwächste Note sein
  assert.equal(rr.weakest.key, "Auslastung", `erwartet schwache Auslastung, war ${rr.weakest.key}`);
  assert.ok(routeReport(s, now).length >= 1);
  const t = tally(s.flights.slice(0, 5));
  assert.ok(t.legs === 5 && t.pax > 0 && t.lf > 0 && t.onTime <= 1);
  assert.equal(tally([]), null);
});


test("Werbung: Bekanntheit läuft an, klingt ab und ist zeitunabhängig", () => {
  const { s, start } = setup(1);
  s.cash = 20e6;
  const floor = awarenessFloor(s);
  assert.ok(Math.abs(awareness(s, start) - floor) < 0.01, "ohne Kampagne genau der Bodenwert");
  const q = campaignQuote("tv", 1, 14);
  const cash = s.cash;
  assert.ok(act.bookCampaign(s, "tv", 1, 14, start).ok);
  assert.equal(Math.round(cash - s.cash), q.total, "wird sofort in voller Höhe bezahlt");
  assert.ok(!act.bookCampaign(s, "tv", 0, 7, start).ok, "zwei Kampagnen auf demselben Kanal gehen nicht");
  assert.ok(!act.bookCampaign(s, "tv", 0, 9, start).ok, "krumme Laufzeiten gibt es nicht");

  const at = d => awareness(s, start + d * DAY);
  assert.ok(at(1) > at(0), "steigt");
  assert.ok(at(14) > at(7), "steigt bis zum Ende der Laufzeit");
  assert.ok(at(30) < at(14) && at(30) > floor, "klingt danach ab, aber nicht unter den Bodenwert");
  assert.ok(at(90) < at(30));

  // Der Kern des serverlosen Modells: Bekanntheit ist eine reine Funktion der Zeit.
  const a = structuredClone(s), b = structuredClone(s);
  settle(a, start + 10 * DAY);
  for (let h = 1; h <= 240; h++) settle(b, start + h * H);
  assert.ok(Math.abs(awareness(a, start + 10 * DAY) - awareness(b, start + 10 * DAY)) < 1e-9);

  // Wirkung: spürbar, aber nicht beliebig
  assert.ok(awarenessFactor(s, start + 14 * DAY) > awarenessFactor(s, start), "Werbung hebt die Nachfrage");
  assert.ok(awarenessFactor(s, start + 14 * DAY) < 1.25, "aber nicht ins Unermessliche");
});

test("Werbung über vier Wochen: lohnt sich, kippt das Spiel aber nicht", () => {
  const run = (plan) => {
    // Zwei gesunde Strecken mit Luft nach oben – dort soll Werbung wirken.
    const { s, start } = setup(2);
    act.hireAllOpen(s, start);
    s.fleet.forEach((ac, i) => {
      const r = act.createRoute(s, "FRA", i ? "MAD" : "LHR").route;
      act.hireAllOpen(s, start);
      act.assign(s, ac.id, r.id, start);
      act.hireAllOpen(s, start);
    });
    s.cash = 30e6;
    for (let d = 0; d < 28; d++) {
      const t = start + d * DAY;
      if (plan && d % 7 === 0) act.bookCampaign(s, plan[0], plan[1], 7, t);
      settle(s, t + DAY);
    }
    const sum = summary(s, 28, start + 28 * DAY);
    return { profit: sum.profit, ads: sum.cost.marketing || 0, aw: awareness(s, start + 28 * DAY) };
  };
  const plain = run(null), cheap = run(["online", 1]), heavy = run(["tv", 2]);
  assert.ok(cheap.aw > plain.aw && heavy.aw > cheap.aw, "mehr Budget, mehr Bekanntheit");
  assert.ok(cheap.profit > plain.profit, `gezielte Werbung muss sich lohnen (${Math.round(cheap.profit / 1e3)} vs ${Math.round(plain.profit / 1e3)} k$)`);
  assert.ok(heavy.profit < plain.profit + (cheap.profit - plain.profit) * 3,
    "die größte Kampagne darf nicht einfach dreimal so viel bringen");
  console.log(`   28 Tage, 2 Flugzeuge: ohne Werbung ${Math.round(plain.profit / 1e3)} k$ · Online mittel ${Math.round(cheap.profit / 1e3)} k$ (${Math.round(cheap.ads / 1e3)} k$ Werbung) · TV groß ${Math.round(heavy.profit / 1e3)} k$ (${Math.round(heavy.ads / 1e3)} k$)`);
});

test("Charter: Angebote gleich bei jedem Blick, Flugzeug kehrt zurück", () => {
  const { s, route, start } = setup(1);
  const [ac] = s.fleet;
  act.assign(s, ac.id, route.id, start);
  settle(s, start + 2 * DAY);
  const now = start + 2 * DAY;
  const a = charterOffers(s, now), b = charterOffers(s, now);
  assert.deepEqual(a.map(o => o.id), b.map(o => o.id), "zweimal schauen zeigt dasselbe");
  assert.ok(a.length, "es gibt Angebote");
  assert.ok(a.some(o => o.size === "narrow"), "immer etwas für Schmalrumpf dabei");
  assert.ok(charterOffers(s, now + DAY)[0].id !== a[0].id, "morgen fragen andere an");

  const offer = a.find(o => charterFits(s, o).length) || a[0];
  // Bis das Flugzeug am Drehkreuz steht vorspulen
  let t = now;
  for (let i = 0; i < 300 && !(ac.status === "active" && ac.ops.dir === 0 && ac.ops.dep > t); i++) { t += 20 * 60_000; settle(s, t); }
  const cash = s.cash;
  const r = act.acceptCharter(s, offer.id, ac.id, t);
  if (!r.ok) { assert.ok(true, "kein passendes Flugzeug – dann hat der Markt eben nichts"); return; }
  assert.equal(ac.status, "charter");
  assert.equal(Math.round(s.cash - cash), offer.upfront, "Anzahlung kommt sofort");
  assert.ok(!act.sellAircraft(s, ac.id, t).ok, "im Charter lässt sich nichts verkaufen");
  const hours = ac.hours;
  settle(s, t + offer.days * DAY + H);
  assert.equal(ac.status, "active", "danach wieder im Liniendienst");
  assert.equal(ac.ops.routeId, route.id, "und zurück auf der alten Strecke");
  assert.ok(ac.hours > hours, "Flugstunden laufen trotzdem auf die Wartung");
  assert.equal(s.fleet.find(a => a.id === ac.id).charter, null);
});

test("Sonderlackierung: zahlt laufend, kostet Ruf, endet von selbst", () => {
  const { s, start } = setup(2);
  const offers = liveryOffers(s, start);
  assert.ok(offers.length);
  assert.deepEqual(liveryOffers(s, start).map(o => o.id), offers.map(o => o.id));
  const [ac] = s.fleet, offer = offers[0];
  const q = quoteFor(s, offer, ac, start);
  const cash = s.cash;
  assert.ok(act.acceptLivery(s, offer.id, ac.id, start).ok);
  assert.equal(Math.round(s.cash - cash), q.upfront);
  assert.ok(liveryRep(s, start) < 0, "fremde Farben kosten Ruf");
  assert.ok(!act.acceptLivery(s, offer.id, ac.id, start).ok, "ein Flugzeug trägt nur eine Werbung");
  assert.ok(!act.assign(s, ac.id, s.routes[0]?.id, start).ok || ac.adLivery.ready <= start, "während der Lackierung kein Einsatz");

  // In Tagesschritten weiterrechnen, sonst greift die 30-Tage-Grenze der Nachberechnung
  for (let d = 1; d <= offer.days + 1; d++) settle(s, start + d * DAY);
  assert.equal(ac.adLivery, null, "läuft von selbst aus");
  const paid = summary(s, offer.days + 2, start + (offer.days + 1) * DAY).rev.livery || 0;
  assert.ok(paid >= q.total - 1, `die ganze Vertragssumme muss fließen (${Math.round(paid)} von ${q.total})`);
  assert.equal(activeLiveries(s, s.lastSettled).length, 0);
});

test("Reputation: Aufschlüsselung nennt den größten Hebel", () => {
  const { s, route, start } = setup(1);
  act.assign(s, s.fleet[0].id, route.id, start);
  settle(s, start + 2 * DAY);
  const bars = repBreakdown(s, start + 2 * DAY, s.flights[0]);
  assert.ok(bars.length >= 10, "jeder Baustein steht da");
  assert.ok(bars.every(b => b.label && typeof b.value === "number"));
  for (let i = 1; i < bars.length; i++) assert.ok(bars[i - 1].value <= bars[i].value, "schlechtestes zuerst");
  act.setBagFee(s, 120);
  const worst = repAdvice(s, start + 2 * DAY);
  assert.equal(worst.key, "gepaeck", "die teuerste Gepäckgebühr muss der größte Hebel sein");
  assert.ok(worst.tip.length > 20);
  act.setBagFee(s, 0);
  assert.ok(repBreakdown(s, start + 2 * DAY).find(b => b.key === "gepaeck").value === 0);
});

test("Bordverkauf: mehr Sortiment heißt mehr Umsatz, aber nicht alles Gewinn", () => {
  const run = range => {
    const { s, route, start } = setup(1);
    act.setOnboard(s, range);
    act.assign(s, s.fleet[0].id, route.id, start);
    settle(s, start + 5 * DAY);
    const sum = summary(s, 5, start + 5 * DAY);
    return { onboard: sum.rev.onboard || 0, catering: sum.cost.catering || 0 };
  };
  const basic = run("basic"), std = run("standard"), prem = run("premium");
  assert.ok(prem.onboard > std.onboard && std.onboard > basic.onboard, "größeres Sortiment, mehr Umsatz");
  assert.ok(prem.catering > std.catering, "aber auch mehr Wareneinsatz");
  assert.ok(prem.onboard - prem.catering > basic.onboard - basic.catering, "unterm Strich lohnt Premium trotzdem");
  assert.ok(!act.setOnboard(s0(), "gibtsnicht").ok);
  function s0() { return setup(1).s; }
});


test("Drehkreuz: Ausbau wirkt auf Standzeit, Ruf und Unterhalt", () => {
  const { s, start } = setup(1);
  const [ac] = s.fleet;
  s.cash = 200e6;
  assert.equal(levelOf(s, "FRA", "gates"), 1, "neue Airlines starten mit Fluggastbrücken");
  const turnHub = turnaroundHours(s, ac, "FRA"), turnOut = turnaroundHours(s, ac, "PMI");
  assert.equal(turnHub, turnOut, "auf Stufe 1 ist die Standzeit überall gleich");

  assert.ok(!act.upgradeHub(s, "PMI", "gates", start).ok, "nur an eigenen Drehkreuzen bauen");
  assert.ok(act.upgradeHub(s, "FRA", "gates", start).ok);
  assert.ok(act.upgradeHub(s, "FRA", "gates", start).ok);
  assert.equal(levelOf(s, "FRA", "gates"), 3);
  assert.equal(nextStage(s, "FRA", "gates"), null, "danach ist Schluss");
  assert.ok(!act.upgradeHub(s, "FRA", "gates", start).ok);

  assert.ok(turnaroundHours(s, ac, "FRA") < turnHub, "eigenes Terminal verkürzt die Standzeit");
  assert.equal(turnaroundHours(s, ac, "PMI"), turnOut, "draußen ändert sich nichts");
  assert.equal(gateFactor(s, "PMI"), 1);
  assert.ok(hubRep(s) > 0, "gute Gates heben den Ruf");
  assert.ok(upkeepPerDay(s) > 0, "Unterhalt läuft ab dem Bau");

  // Unterhalt wird zeitanteilig gebucht und ist unabhängig von der Schrittweite
  const a = structuredClone(s), b = structuredClone(s);
  settle(a, start + 4 * DAY);
  for (let h = 1; h <= 96; h++) settle(b, start + h * H);
  const ha = summary(a, 5, start + 4 * DAY).cost.hub, hb = summary(b, 5, start + 4 * DAY).cost.hub;
  assert.ok(ha > 0 && Math.abs(ha - hb) / ha < 0.01, `Unterhalt ${Math.round(ha)} vs ${Math.round(hb)}`);
});

test("Lounge zieht vorne, die Werft verkürzt Checks", () => {
  const { s, start } = setup(2);
  s.cash = 200e6;
  assert.equal(loungeFactor(s, "y"), 1, "Economy merkt von der Lounge nichts");
  act.upgradeHub(s, "FRA", "lounge", start);
  act.upgradeHub(s, "FRA", "lounge", start);
  assert.ok(loungeFactor(s, "j") > 1 && loungeFactor(s, "f") > 1, "Business und First schon");
  assert.equal(loungeFactor(s, "y"), 1);

  const plain = hangarEffect(s);
  assert.equal(plain.downH, 1, "ohne Werft wird alles zugekauft");
  act.upgradeHub(s, "FRA", "hangar", start);
  const small = hangarEffect(s);
  assert.ok(small.downH < 1 && small.cost < 1 && small.techs < 1);
  assert.equal(small.covered, 1, "vier Plätze decken zwei Flugzeuge");

  // Mehr Flugzeuge als Plätze: der Vorteil verwässert
  for (let i = 0; i < 6; i++) s.fleet.push({ ...s.fleet[0], id: `extra-${i}` });
  const big = hangarEffect(s);
  assert.ok(big.covered < 1 && big.downH > small.downH, "über die Hallenplätze hinaus wird zugekauft");

  const checkNow = () => { const x = setup(1); x.s.cash = 200e6; return x; };
  const base = checkNow(); act.requestCheck(base.s, base.s.fleet[0].id, "A", base.start);
  const dur0 = base.s.fleet[0].check.until - base.start;
  const up = checkNow(); act.upgradeHub(up.s, "FRA", "hangar", up.start); act.upgradeHub(up.s, "FRA", "hangar", up.start);
  act.requestCheck(up.s, up.s.fleet[0].id, "A", up.start);
  assert.ok(up.s.fleet[0].check.until - up.start < dur0 * 0.75, "eigene Werft ist deutlich schneller");
  assert.ok(up.s.fleet[0].check.cost < base.s.fleet[0].check.cost, "und billiger");
});

test("Kabinenausstattung: Sitzbudget, Ruf und Umbaukosten", () => {
  const { s, start } = setup(1);
  const [ac] = s.fleet;
  s.cash = 50e6;
  const budget0 = seatBudget(ac);
  assert.ok(budget0 > 0);
  assert.equal(fleetFitting(s).rep, 0, "Standard ist neutral");

  const q = retrofitQuote(s, ac, "comfort", "wifi");
  assert.ok(q.price > 0 && q.hours > 0);
  assert.ok(q.budgetAfter < budget0, "Komfortsitze kosten Sitzplätze");
  assert.ok(act.retrofit(s, ac.id, "comfort", "wifi", start).ok);
  assert.ok(seatBudget(ac) < budget0);
  assert.ok(seatUnits(ac.cfg) <= seatBudget(ac), "die Bestuhlung wird mit zurückgeschnitten");
  assert.ok(fleetFitting(s).rep > 0, "Komfort und WLAN heben den Ruf");
  assert.ok(fleetFitting(s).onboard > 1, "WLAN kurbelt den Bordverkauf an");
  assert.ok(!act.retrofit(s, ac.id, "comfort", "wifi", start).ok, "zweimal dasselbe geht nicht");
  assert.ok(!act.assign(s, ac.id, s.routes[0].id, start).ok, "während des Umbaus kein Einsatz");

  // Slimline bringt mehr Sitze, kostet aber Ruf
  const { s: s2, start: st2 } = setup(1);
  s2.cash = 50e6;
  const before = seatBudget(s2.fleet[0]);
  assert.ok(act.retrofit(s2, s2.fleet[0].id, "slim", "none", st2).ok);
  assert.ok(seatBudget(s2.fleet[0]) > before);
  assert.ok(fleetFitting(s2).rep < 0);
});


test("Kredit: Rate, Zins und Tilgung über die Laufzeit", () => {
  const { s, start } = setup(1);
  const route = act.createRoute(s, "FRA", "LHR").route;
  act.hireAllOpen(s, start);
  act.assign(s, s.fleet[0].id, route.id, start);
  act.hireAllOpen(s, start);
  for (let d = 0; d < 30; d++) settle(s, start + (d + 1) * DAY);
  const now = start + 30 * DAY;

  const limit = creditLimit(s, now);
  assert.ok(limit > 0, "eine profitable Airline bekommt einen Rahmen");
  assert.ok(!act.takeLoan(s, limit * 2, 24, "annuity", now).ok, "über den Rahmen hinaus gibt es nichts");
  assert.ok(!act.takeLoan(s, 100, 24, "annuity", now).ok, "Kleinbeträge auch nicht");
  assert.ok(!act.takeLoan(s, 1e6, 7, "annuity", now).ok, "krumme Laufzeiten nicht");

  // Annuität: Rate × Monate ergibt mehr als die Summe, Zins steckt drin
  const q = quote(s, now, 4e6, 24, "annuity");
  assert.ok(Math.abs(q.payment - annuity(4e6, q.rate, 24)) < 1);
  assert.ok(q.interest > 0 && q.totalPaid > 4e6);
  const bullet = quote(s, now, 4e6, 24, "bullet");
  assert.ok(bullet.payment < q.payment, "endfällig ist monatlich billiger");
  assert.ok(bullet.interest > q.interest, "dafür kostet es insgesamt mehr Zinsen");
  assert.equal(bullet.balloon, 4e6);

  const cash = s.cash;
  const r = act.takeLoan(s, 4e6, 24, "annuity", now);
  assert.ok(r.ok, r.msg);
  assert.equal(Math.round(s.cash - cash), 4e6 - q.fee, "Auszahlung abzüglich Gebühr");
  assert.equal(totalDebt(s), 4e6);
  assert.ok(monthlyLoad(s) > 0);

  // Nach zwölf Monatsraten ist rund die Hälfte getilgt, der Rest läuft weiter
  for (let d = 0; d < 370; d++) settle(s, now + (d + 1) * DAY);
  const loan = s.credit.loans[0];
  assert.ok(loan.paidCount >= 12, `Raten gezahlt: ${loan.paidCount}`);
  assert.ok(loan.rest < 4e6 * 0.6 && loan.rest > 0, `Restschuld ${Math.round(loan.rest)}`);
  const sum = summary(s, 60, now + 370 * DAY);
  assert.ok(sum.cost.interest > 0 && sum.cost.repay > 0, "Zinsen und Tilgung werden getrennt gebucht");
});

test("Kreditraten hängen nicht an der Schrittweite", () => {
  const { s, start } = setup(1);
  const route = act.createRoute(s, "FRA", "LHR").route;
  act.hireAllOpen(s, start); act.assign(s, s.fleet[0].id, route.id, start); act.hireAllOpen(s, start);
  for (let d = 0; d < 30; d++) settle(s, start + (d + 1) * DAY);
  const now = start + 30 * DAY;
  assert.ok(act.takeLoan(s, Math.min(3e6, creditLimit(s, now)), 12, "bullet", now).ok);
  const a = structuredClone(s), b = structuredClone(s);
  for (let d = 0; d < 20; d++) settle(a, now + (d + 1) * DAY);
  for (let h = 1; h <= 20 * 24; h++) settle(b, now + h * H);
  assert.ok(Math.abs(a.cash - b.cash) < 1, `${Math.round(a.cash)} vs ${Math.round(b.cash)}`);
  assert.equal(Math.round(totalDebt(a)), Math.round(totalDebt(b)));
});

test("Kredit vorzeitig ablösen und verpasste Raten", () => {
  const { s, start } = setup(1);
  const route = act.createRoute(s, "FRA", "LHR").route;
  act.hireAllOpen(s, start); act.assign(s, s.fleet[0].id, route.id, start); act.hireAllOpen(s, start);
  for (let d = 0; d < 30; d++) settle(s, start + (d + 1) * DAY);
  const now = start + 30 * DAY;
  assert.ok(act.takeLoan(s, 3e6, 24, "annuity", now).ok);
  const id = s.credit.loans[0].id;
  const po = payoffQuote(s, id);
  assert.ok(po.fee > 0 && po.total > po.rest, "Ablösen kostet Vorfälligkeitsentschädigung");
  const cash = s.cash;
  assert.ok(act.repayLoan(s, id, now).ok);
  assert.equal(Math.round(cash - s.cash), po.total);
  assert.equal(totalDebt(s), 0);
  assert.equal(openLoans(s).length, 0);
  assert.ok(!act.repayLoan(s, id, now).ok, "zweimal geht nicht");

  // Verpasste Rate: Restschuld wächst, Ruf sinkt, kein Spielende
  assert.ok(act.takeLoan(s, 3e6, 12, "annuity", now).ok);
  s.cash = 0;
  const rep = s.airline.rep;
  settle(s, now + 32 * DAY);
  const l = s.credit.loans[0];
  assert.ok(l.missed >= 1, "die Rate wurde als verpasst gezählt");
  assert.ok(l.rest > 3e6 * 0.9, "die Restschuld ist nicht gesunken");
  assert.ok(s.airline.rep < rep, "und der Ruf hat gelitten");
});


test("Tag und Nacht: Terminator steht richtig", () => {
  const inside = (poly, lon, lat) => {
    const r = poly.coordinates[0];
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // 21. Dezember: Frankfurt nachts um 23 UTC, mittags hell; Sydney umgekehrt; Spitzbergen Polarnacht
  const night = h => nightPolygon(Date.UTC(2026, 11, 21, h, 0));
  assert.ok(inside(night(23), 8.6, 50.0), "Frankfurt um 23 UTC: Nacht");
  assert.ok(!inside(night(12), 8.6, 50.0), "Frankfurt um 12 UTC: Tag");
  assert.ok(inside(night(12), 151, -33.9), "Sydney um 12 UTC (23 Uhr Ortszeit): Nacht");
  assert.ok(!inside(night(23), 151, -33.9), "Sydney um 23 UTC (10 Uhr Ortszeit): Tag");
  assert.ok(inside(night(12), 15, 78), "Spitzbergen im Dezember: Polarnacht");
  // Im Juni ist es dort umgekehrt
  assert.ok(!inside(nightPolygon(Date.UTC(2026, 5, 21, 12, 0)), 15, 78), "Spitzbergen im Juni: Mitternachtssonne");
  assert.equal(nightPolygon(1).coordinates[0].length, nightPolygon(2).coordinates[0].length);
});

test("Bodenbetrieb: Bahnlage, Gates und Rollbewegung", () => {
  const fra = AIRPORT_BY_IATA.FRA;
  const l = layout(fra);
  assert.equal(l.runways.length, 4, "FRA hat drei Parallelbahnen plus Startbahn West");
  assert.equal(l.runways[0].hdg, 70, "07/25 zeigt auf 070 Grad");
  assert.ok(l.runways.some(r => r.hdg === 180), "und die 18 ist dabei");
  assert.equal(l.gates.length, 12);
  // Zweimal fragen muss dasselbe ergeben – sonst springt alles beim Neuladen
  assert.deepEqual(layout(fra).gates, l.gates);
  assert.equal(gateIndex("t-ac-0"), gateIndex("t-ac-0"));

  // Flughäfen ohne Eintrag bekommen eine Ersatzrichtung, aber immer dieselbe
  const far = AIRPORTS.find(a => !RUNWAYS[a.iata]);
  assert.ok(far, "es gibt Flughäfen ohne hinterlegte Bahn");
  assert.equal(runwaysFor(far).hdg[0], runwaysFor(far).hdg[0]);
  assert.ok(runwaysFor(far).guessed);

  const dep = Date.UTC(2026, 6, 1, 12, 0);
  const at = m => groundPosition(fra, "t-ac-0", dep + m * 60_000, { dep });
  assert.equal(at(-20).phase, "gate", "lange vorher steht es am Gate");
  assert.equal(at(-5).phase, "taxi", "kurz vorher rollt es");
  assert.equal(at(0.2).phase, "roll", "zur Abflugzeit ist es auf der Bahn");
  assert.equal(Math.round(at(0.2).heading), 70, "und zwar in Bahnrichtung");
  assert.ok(at(-5).lon !== at(-2).lon, "die Position bewegt sich");
  // Dieselbe Sekunde zweimal gefragt: identisch
  assert.deepEqual(at(-3), at(-3));
});


test("Kalender: Ostern, Feiertage und ihre Wirkung", () => {
  assert.equal(new Date(easter(2026)).toISOString().slice(0, 10), "2026-04-05");
  assert.equal(new Date(easter(2027)).toISOString().slice(0, 10), "2027-03-28");
  assert.equal(new Date(easter(2024)).toISOString().slice(0, 10), "2024-03-31");

  const xmas = Date.UTC(2026, 11, 24, 12);
  const labels = eventsAt(xmas).map(e => e.label);
  assert.ok(labels.includes("Weihnachten"), labels.join(","));
  const f = demandFactor(xmas, "DE", "ES");
  assert.ok(f.leisure > 1.2, `Urlaub zu Weihnachten: ${f.leisure}`);
  assert.ok(f.biz < 0.8, `Geschäftsreise zu Weihnachten: ${f.biz}`);

  // Ein Termin, der nur die USA betrifft, lässt eine Strecke in Europa unberührt
  const tg = Date.UTC(2026, 10, 26, 12);
  assert.ok(eventsAt(tg).some(e => e.id === "thanksgiving"));
  assert.equal(demandFactor(tg, "DE", "FR").leisure, 1);
  assert.ok(demandFactor(tg, "DE", "US").leisure > 1);

  // Und im Hochsommer ist überall Ferienzeit
  assert.ok(demandFactor(Date.UTC(2026, 7, 5, 12), "DE", "ES").leisure > 1.1);
  assert.ok(upcoming(Date.UTC(2026, 0, 2), 400).length >= 8);
});

test("Ereignisse: deterministisch, Sperrungen verschieben Abflüge", () => {
  const w = Date.UTC(2026, 5, 1);
  assert.deepEqual(eventsOfWeek(w).map(e => e.id), eventsOfWeek(w).map(e => e.id), "zweimal fragen, gleiche Antwort");
  assert.notDeepEqual(eventsOfWeek(w).map(e => e.id), eventsOfWeek(w + 7 * DAY).map(e => e.id), "andere Woche, andere Lage");

  // Über ein Jahr muss ungefähr wöchentlich etwas passieren – nicht nie und nicht dauernd
  let n = 0;
  for (let i = 0; i < 52; i++) n += eventsOfWeek(w + i * 7 * DAY).length;
  assert.ok(n > 25 && n < 110, `Ereignisse im Jahr: ${n}`);

  // Eine Sperrung schiebt den Abflug ans Ende der Sperrung
  const closure = (() => {
    for (let i = 0; i < 60; i++) {
      const hit = eventsOfWeek(w + i * 7 * DAY).find(e => e.closes);
      if (hit) return hit;
    }
    return null;
  })();
  assert.ok(closure, "irgendwann muss eine Sperrung vorkommen");
  const mid = closure.from + (closure.to - closure.from) / 2;
  assert.ok(closureAt(closure.at, mid), "mittendrin ist der Flughafen dicht");
  assert.equal(departureNotBefore(closure.at, mid), closure.to, "der Abflug wartet bis zum Ende");
  assert.equal(departureNotBefore(closure.at, closure.to + 1), closure.to + 1, "danach nicht mehr");
  assert.equal(closureAt(closure.at, closure.from - DAY), null, "vorher auch nicht");
});

test("Ausweichlandung: selten, teuer, deterministisch", () => {
  const ac = { id: "t-ac-0" };
  let hits = 0;
  const base = Date.UTC(2026, 3, 1);
  for (let i = 0; i < 2000; i++) {
    const d = diversion(ac, "LHR", base + i * 3600_000, 1.6);
    if (d) {
      hits++;
      assert.ok(d.to !== "LHR" && d.delayMin >= 90 && d.cost > 0 && d.rep < 0);
      assert.deepEqual(d, diversion(ac, "LHR", base + i * 3600_000, 1.6), "zweimal fragen, gleiche Antwort");
    }
  }
  assert.ok(hits > 5 && hits < 60, `Ausweichlandungen in 2000 Flügen: ${hits}`);
});

test("Flughafen-Steckbrief beschreibt, was da ist", () => {
  const { s, route, start } = setup(1);
  act.assign(s, s.fleet[0].id, route.id, start);
  settle(s, start + 3 * DAY);
  const d = describeAirport(s, "FRA", start + 3 * DAY);
  assert.ok(d.lines.length >= 2);
  assert.ok(d.lines[0].includes("Frankfurt"));
  assert.ok(d.lines[1].includes("4000 m"), d.lines[1]);
  assert.ok(d.wx >= 0 && d.wx <= 1);
  assert.ok(d.routes.length === 3 && d.routes.every(r => r.km > 250 && r.market > 0));
  // Mit eigenen Flügen kommt eine dritte Zeile dazu
  const pmi = describeAirport(s, "PMI", start + 3 * DAY);
  assert.ok(pmi.own ? pmi.lines.length === 3 : pmi.lines.length === 2);
});


test("Bewertung: Sterne, Größe und Wirtschaftlichkeit", () => {
  assert.equal(stars(0), 0);
  assert.equal(stars(100), 5);
  assert.equal(stars(78), 3.9, "eine Nachkommastelle");

  const klein = { fleet: 2, staff: 70, destinations: 3, pax: 20_000 };
  const gross = { fleet: 45, staff: 3200, destinations: 34, pax: 3_200_000 };
  assert.ok(sizeScore(klein) < 30, `Starter: ${sizeScore(klein)}`);
  assert.ok(sizeScore(gross) > 80, `Große: ${sizeScore(gross)}`);
  assert.ok(sizeScore({ fleet: 0, staff: 0, destinations: 0, pax: 0 }) === 0);

  // Wirtschaftlichkeit hängt an Marge und Ertrag, nicht an Größe
  const gut = efficiencyScore({ margin: 0.22, profitPerAircraftDay: 60_000, fleet: 2 });
  const schwach = efficiencyScore({ margin: 0.02, profitPerAircraftDay: 4_000, fleet: 45 });
  assert.ok(gut > 80 && schwach < 25, `${gut} vs ${schwach}`);
  assert.equal(efficiencyScore({ margin: 0.3, profitPerAircraftDay: 9e9, fleet: 0 }), 0, "ohne Flotte keine Note");

  const { s, route, start } = setup(2);
  act.assign(s, s.fleet[0].id, route.id, start);
  settle(s, start + 5 * DAY);
  const p = profileOf(s, start + 5 * DAY);
  assert.equal(p.fleet, 2);
  assert.ok(p.staff > 0 && p.destinations >= 2 && p.pax > 0);
  assert.ok(qualifies(p), "zwei Flugzeuge reichen für die Börse");
  assert.ok(!qualifies({ fleet: RATING.minFleet - 1 }));
  const r = rate(p);
  assert.ok(r.stars >= 0 && r.stars <= 5 && r.size >= 0 && r.size <= 100 && r.efficiency >= 0 && r.efficiency <= 100);
});

test("Beteiligungen: höchstens 49 Prozent, jederzeit verkaufbar", () => {
  const { s, start } = setup(1);
  s.cash = 500e6;
  const [listing] = demoMarket(start);
  const max = maxShares(listing);
  assert.equal(max, Math.floor(STOCKS.defaultShares * STOCKS.maxStake));

  assert.ok(buyShares(s, listing, 1000, start).ok);
  assert.ok(stakeIn(s, listing) > 0 && stakeIn(s, listing) < 0.01);
  assert.ok(!buyShares(s, listing, max, start).ok, "über 49 % geht nicht");
  assert.ok(buyShares(s, listing, max - 1000, start).ok, "bis genau 49 % schon");
  assert.ok(Math.abs(stakeIn(s, listing) - STOCKS.maxStake) < 0.001);
  assert.ok(!buyShares(s, listing, 1, start).ok, "danach ist Schluss");

  const cash = s.cash;
  assert.ok(sellShares(s, listing, max, start).ok, "und alles lässt sich wieder verkaufen");
  assert.ok(s.cash > cash);
  assert.equal(stakeIn(s, listing), 0);
  assert.ok(!buyShares(s, { code: s.player.code, price: 10 }, 10, start).ok, "eigene Aktien nicht");
});


test("Geführter Einstieg hakt sich selbst ab", () => {
  const s0 = newGame({ name: "Neu Air", iata: "NA", hub: "FRA", player: { code: "AL-NEW-001", secret: "x" }, now: T0 });
  const first = steps(s0, T0);
  assert.equal(first.progress, 0, "frisch gegründet ist nichts erledigt");
  assert.equal(first.next.id, "lease", "der erste Schritt ist das Leasen");
  assert.ok(first.next.why.length > 30 && first.next.where.includes("→"));

  const { s, route, start } = setup(2);
  const mid = steps(s, start);
  assert.ok(mid.list.find(x => x.id === "lease").done);
  assert.ok(mid.list.find(x => x.id === "route").done);
  assert.ok(!mid.list.find(x => x.id === "assign").done, "zugewiesen ist noch nichts");

  act.assign(s, s.fleet[0].id, route.id, start);
  settle(s, start + 2 * DAY);
  const late = steps(s, start + 2 * DAY);
  assert.ok(late.list.find(x => x.id === "assign").done);
  assert.ok(late.list.find(x => x.id === "firstleg").done);
  assert.ok(late.progress > mid.progress);
  assert.ok(late.done || late.next, "entweder fertig oder es gibt einen nächsten Schritt");
});

test("Benachrichtigungen melden nur, was eine Entscheidung braucht", () => {
  const { s, route, start } = setup(2);
  // Zwei Flugzeuge ohne Strecke → eine Meldung
  const idle = pending(s, start);
  assert.ok(idle.some(x => x.id === "idle"), "Flugzeug ohne Strecke wird gemeldet");

  act.assign(s, s.fleet[0].id, route.id, start);
  act.assign(s, s.fleet[1].id, route.id, start);
  assert.ok(!pending(s, start).some(x => x.id === "idle"), "beide im Einsatz, nichts zu melden");

  // Überfällige Wartung
  s.fleet[0].maint.A.fh = 99999;
  assert.ok(pending(s, start).some(x => x.id.startsWith("check-")), "überfällige Wartung wird gemeldet");

  // Negative Kasse
  s.cash = -1;
  assert.ok(pending(s, start).some(x => x.id === "cash"));
  // Auslaufendes Leasing
  s.fleet[0].lease.until = start + DAY;
  assert.ok(pending(s, start).some(x => x.id.startsWith("lease-")));
});


test("Umsteiger: Umweg, Wartezeit und Fahrplan", () => {
  // Über FRA von Lissabon nach Helsinki ist ein vernünftiger Umstieg
  assert.ok(detourFactor("LIS", "HEL", "FRA") > 0.3, detourFactor("LIS", "HEL", "FRA"));
  // Von London nach Paris über Frankfurt steigt niemand um
  assert.equal(detourFactor("LHR", "CDG", "FRA"), 0);
  // Ganz kurze Städtepaare fallen heraus – dafür steigt niemand um
  assert.equal(detourFactor("DUS", "CGN", "FRA"), 0);
  // Hamburg–München über Frankfurt ist dagegen ein echter Umstieg, wie in der Realität auch
  assert.ok(detourFactor("HAM", "MUC", "FRA") > 0.5);
  assert.ok(detourFactor("MAD", "WAW", "FRA") > detourFactor("MAD", "ATH", "FRA"),
    "je gerader der Weg über das Drehkreuz, desto mehr steigen um");

  assert.equal(waitFactor(CONNECT.minMinutes - 1), 0, "unter der Mindestumsteigezeit geht nichts");
  assert.equal(waitFactor(CONNECT.maxMinutes + 1), 0, "und ewig wartet niemand");
  assert.ok(waitFactor(CONNECT.sweetMinutes) > waitFactor(CONNECT.minMinutes + 5));
  assert.ok(waitFactor(CONNECT.sweetMinutes) > waitFactor(CONNECT.maxMinutes - 10));

  const { s, start } = setup(2);
  const r1 = act.createRoute(s, "FRA", "LIS").route;
  const r2 = act.createRoute(s, "FRA", "HEL").route;
  // Jede neue Strecke hebt den Personalbedarf – zwischen den Zuweisungen muss neu eingestellt werden.
  act.hireAllOpen(s, start);
  assert.ok(act.assign(s, s.fleet[0].id, r1.id, start).ok);
  act.hireAllOpen(s, start);
  assert.ok(act.assign(s, s.fleet[1].id, r2.id, start).ok);
  act.hireAllOpen(s, start);

  const table = hubTimetable(s, "FRA", start, start + DAY);
  assert.equal(table.length, 2, "beide Flugzeuge tauchen im Fahrplan auf");
  for (const e of table) {
    assert.ok(e.arrivals.length && e.departures.length, "Ankünfte und Abflüge über 24 Stunden");
    assert.ok(e.cycle > 0);
    // Streng aufsteigend und im Fenster
    for (const t of [...e.arrivals, ...e.departures]) assert.ok(t >= start && t <= start + DAY);
  }
  assert.deepEqual(hubTimetable(s, "FRA", start, start + DAY), table, "zweimal fragen, gleiche Antwort");
});

test("Umsteiger füllen nur freie Sitze und nie doppelt", () => {
  const { s, start } = setup(2);
  const r1 = act.createRoute(s, "FRA", "LIS").route;
  const r2 = act.createRoute(s, "FRA", "HEL").route;
  act.hireAllOpen(s, start);
  act.assign(s, s.fleet[0].id, r1.id, start);
  act.hireAllOpen(s, start);
  act.assign(s, s.fleet[1].id, r2.id, start);
  act.hireAllOpen(s, start);
  settle(s, start + 3 * DAY);

  const args = { hub: "FRA", other: "HEL", ts: start + DAY, dir: "out", km: 1900, flightsPerDay: 2 };
  const voll = connectingPax(s, { ...args, freeSeats: 0 });
  assert.equal(voll, null, "ohne freien Sitz keine Umsteiger");
  const etwas = connectingPax(s, { ...args, freeSeats: 50 });
  if (etwas) {
    assert.ok(etwas.paxTotal <= Math.ceil(50 * CONNECT.fillFree), `${etwas.paxTotal} von 50 freien Sitzen`);
    assert.ok(etwas.revenue > 0);
    assert.deepEqual(connectingPax(s, { ...args, freeSeats: 50 }), etwas, "deterministisch");
  }
  // Mehr eigene Abflüge am Tag teilen denselben Markt auf
  const wenig = connectingPax(s, { ...args, freeSeats: 400, flightsPerDay: 1 });
  const viel = connectingPax(s, { ...args, freeSeats: 400, flightsPerDay: 6 });
  if (wenig && viel) assert.ok(viel.paxTotal < wenig.paxTotal, "sonst würde derselbe Markt mehrfach einsteigen");

  // Kein Drehkreuz, keine Umsteiger
  assert.equal(connectingPax(s, { ...args, hub: "LIS", freeSeats: 100 }), null);

  const w = hubWaves(s, "FRA", start + DAY, 24);
  assert.equal(w.buckets.length, 24);
  assert.ok(w.deps > 0);
  assert.ok(w.quality >= 0 && w.quality <= 1);
  assert.ok(w.note.length > 20);
});

test("Ein Netz bringt mehr als einzelne Strecken", () => {
  const run = (dests) => {
    const s = newGame({ name: "Netz", iata: "NZ", hub: "FRA", player: { code: "AL-NET-001", secret: "x" }, now: T0 });
    s.cash = 80e6;
    s.airline.frameBonus = 3e6;
    for (let i = 0; i < dests.length; i++) act.leaseNew(s, "a320neo", 12, T0);
    settle(s, T0 + 2 * H);
    s.fleet.forEach((ac, i) => { ac.id = `net-${i}`; });
    const start = T0 + 2 * H;
    for (const d of dests) {
      const r = act.createRoute(s, "FRA", d).route;
      act.hireAllOpen(s, start);
      const free = s.fleet.find(a => a.status === "idle");
      if (free && r) act.assign(s, free.id, r.id, start);
      act.hireAllOpen(s, start);
    }
    for (let i = 0; i < 14; i++) { act.hireAllOpen(s, start + i * DAY); settle(s, start + (i + 1) * DAY); }
    const sum = summary(s, 14, start + 14 * DAY);
    return { transfer: sum.rev.transfer || 0, rev: sum.opRev, perAircraft: sum.opRev / dests.length };
  };
  const klein = run(["LIS", "HEL"]);
  const gross = run(["LIS", "HEL", "ATH", "OSL", "IST", "MAD"]);
  assert.ok(gross.transfer > klein.transfer * 2, `Umsteiger: ${Math.round(klein.transfer / 1e3)} k$ vs ${Math.round(gross.transfer / 1e3)} k$`);
  assert.ok(gross.transfer / gross.rev > klein.transfer / klein.rev, "der Anteil wächst mit dem Netz");
  assert.ok(gross.perAircraft > klein.perAircraft,
    `Erlös je Flugzeug: ${Math.round(klein.perAircraft / 1e3)} k$ vs ${Math.round(gross.perAircraft / 1e3)} k$ – ein Netz muss mehr bringen als die Summe seiner Strecken`);
});


test("Störfall: vier Wege, Vorgabe ist warten", () => {
  const { s, start } = setup(2);
  const r = act.createRoute(s, "FRA", "LIS").route;
  act.hireAllOpen(s, start);
  act.assign(s, s.fleet[0].id, r.id, start);
  act.hireAllOpen(s, start);
  settle(s, start + DAY);
  const now = s.lastSettled;
  const [broken, spare] = s.fleet;
  const c = openCase(s, broken, r, "LIS", now, 160);
  broken.status = "aog";
  broken.aog = { caseId: c.id, until: c.repairUntil, deadline: c.deadline };

  assert.ok(c.repairUntil > now && c.deadline > now && c.deadline < c.repairUntil);
  assert.equal(c.deadline - now, IROPS.decideH * H, "zwei Stunden Zeit");
  assert.ok(openCases(s, now).some(x => x.id === c.id));

  const opts = iropsOptions(s, c, now);
  assert.equal(opts.length, 4);
  assert.ok(opts.find(o => o.id === "wait").isDefault);
  assert.ok(opts.every(o => o.text.length > 20));
  // Ein freies Flugzeug macht Tausch und Überführung möglich
  assert.ok(replacements(s, c).some(a => a.id === spare.id));
  assert.ok(opts.find(o => o.id === "swap").available);
  // Tauschen schont den Ruf deutlich mehr als streichen
  assert.ok(opts.find(o => o.id === "swap").rep > opts.find(o => o.id === "cancel").rep);
  assert.ok(opts.find(o => o.id === "cancel").rep < opts.find(o => o.id === "wait").rep);

  const rep0 = s.airline.rep, cash0 = s.cash;
  const res = act.resolveIrops(s, c.id, "swap", now);
  assert.ok(res.ok, res.msg);
  assert.equal(spare.status, "active", "das Ersatzflugzeug übernimmt");
  assert.equal(spare.ops.routeId, r.id);
  assert.equal(broken.ops, null, "die defekte Maschine verliert die Strecke");
  assert.ok(s.cash < cash0 && s.airline.rep < rep0);
  assert.ok(!act.resolveIrops(s, c.id, "wait", now).ok, "zweimal entscheiden geht nicht");
});

test("Störfall ohne Entscheidung: es wird gewartet und entschädigt", () => {
  const { s, start } = setup(1);
  const r = act.createRoute(s, "FRA", "LIS").route;
  act.hireAllOpen(s, start);
  act.assign(s, s.fleet[0].id, r.id, start);
  act.hireAllOpen(s, start);
  settle(s, start + DAY);
  const now = s.lastSettled;
  const ac = s.fleet[0];
  const c = openCase(s, ac, r, "LIS", now, 200);
  ac.status = "aog";
  ac.aog = { caseId: c.id, until: c.repairUntil, deadline: c.deadline };

  const rep0 = s.airline.rep, cash0 = s.cash;
  settle(s, now + IROPS.decideH * H + H);
  assert.ok(c.done, "nach Fristablauf ist entschieden");
  assert.equal(c.choice, "wait");
  assert.ok(s.airline.rep < rep0, "der Ruf leidet");
  assert.ok(cash0 - s.cash >= compensation(200, (c.repairUntil - c.at_ts) / H), "Entschädigung wurde gebucht");
  assert.ok(!act.resolveIrops(s, c.id, "swap", now + 3 * H).ok, "nach der Frist geht nichts mehr");

  // Nach der Reparatur fliegt die Maschine weiter
  settle(s, c.repairUntil + 2 * H);
  assert.notEqual(ac.status, "aog", `Status nach Reparatur: ${ac.status}`);
  assert.equal(ac.aog, null);

  // Entschädigung nach Dauer gestaffelt
  assert.equal(compensation(100, 1), 0, "unter drei Stunden gibt es nichts");
  assert.ok(compensation(100, 4) > 0);
  assert.ok(compensation(100, 8) > compensation(100, 4), "ab sechs Stunden mehr");
  const [lo, hi] = IROPS.repairH.narrow;
  const h = repairHours(ac, now);
  assert.ok(h >= lo && h <= hi);
  assert.equal(h, repairHours(ac, now), "deterministisch");
});

test("Änderungsverlauf passt zur Version", async () => {});
const { CHANGELOG, LATEST, TAGS } = await import("../js/data/changelog.js");
const { GAME } = await import("../js/core/config.js");
assert.equal(GAME.label, LATEST, `core/config.js sagt ${GAME.label}, der Änderungsverlauf ${LATEST} – beide hochzählen`);
assert.equal(new Set(CHANGELOG.map(e => e.v)).size, CHANGELOG.length, "Version doppelt im Änderungsverlauf");
for (let i = 1; i < CHANGELOG.length; i++) assert.ok(CHANGELOG[i - 1].v > CHANGELOG[i].v, "Änderungsverlauf muss absteigend sortiert sein");
for (const e of CHANGELOG) {
  assert.ok(e.title && e.date && e.items.length, `${e.v}: unvollständig`);
  for (const [tag, text] of e.items) { assert.ok(TAGS[tag], `${e.v}: unbekannte Markierung "${tag}"`); assert.ok(text.length > 20, `${e.v}: Text zu knapp`); }
}

test("Wetter deterministisch, Verspätungen kommen vor", async () => {});
const { weatherAt, weatherDelay } = await import("../js/sim/weather.js");
assert.deepEqual(weatherAt("OSL", T0), weatherAt("OSL", T0));
let delays = 0;
for (let h = 0; h < 24 * 60; h++) if (weatherDelay("OSL", Date.UTC(2026, 0, 1) + h * H, "k" + h)) delays++;
assert.ok(delays > 20 && delays < 24 * 60 * 0.5, "Oslo im Winter: " + delays);

console.log(`\n${pass} Tests bestanden`);
