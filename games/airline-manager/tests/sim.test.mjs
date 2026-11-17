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
import { companyValue } from "../js/sim/stocks.js";
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

function setup(n = 2) {
  const s = newGame({ name: "Test Air", iata: "TA", hub: "FRA", player: { code: "AL-TST-001", secret: "x" }, now: T0 });
  for (let i = 0; i < n; i++) { const r = act.leaseNew(s, "a320neo", 12, T0); assert.ok(r.ok, r.msg); }
  settle(s, T0 + 2 * H);
  const route = act.createRoute(s, "FRA", "PMI").route;
  const hired = act.hireAllOpen(s, T0 + 2 * H); assert.ok(hired.ok, hired.msg);
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
