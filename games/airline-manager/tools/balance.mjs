// Balance-Werkzeug: rechnet ein paar typische Spielsituationen durch und zeigt,
// was mit Margen, Auslastung und Wachstum passiert. Nach jeder Änderung an den Zahlen
// in js/core/config.js einmal laufen lassen – dann sieht man sofort, was sie anrichtet.
//
//   node games/airline-manager/tools/balance.mjs
//   node games/airline-manager/tools/balance.mjs --tage 56 --szenario leasing
//
// Flugzeug-IDs sind im Spiel zufällig, und der gesamte deterministische Zufall hängt daran.
// Hier werden sie deshalb festgesetzt, damit zwei Läufe vergleichbar sind.

import { newGame } from "../js/core/store.js";
import { settle } from "../js/sim/engine.js";
import * as act from "../js/sim/actions.js";
import { summary } from "../js/sim/ledger.js";
import { companyValue } from "../js/sim/stocks.js";
import { profileOf, rate } from "../js/sim/rating.js";
import { awareness } from "../js/sim/marketing.js";
import { totalDebt } from "../js/sim/credit.js";
import { H, DAY, GAME } from "../js/core/config.js";

const T0 = Date.UTC(2026, 5, 1, 6, 0);
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const DAYS = +arg("tage", 28);
const ONLY = arg("szenario", null);

const money = v => (v / 1e6).toFixed(2).padStart(7) + " Mio";
const pct = v => (v * 100).toFixed(0).padStart(3) + " %";

function stable(s) { s.fleet.forEach((a, i) => { a.id = `bal-${i}`; }); return s; }

function fresh() {
  const s = newGame({ name: "Balance Air", iata: "BA", hub: "FRA", player: { code: "AL-BAL-001", secret: "x" }, now: T0 });
  settle(s, T0 + H);
  return s;
}

/** Flugzeuge leasen und auf Strecken setzen. dests = Liste von IATA-Codes. */
function build(s, dests, { buy = false, type = "a320neo" } = {}) {
  for (let i = 0; i < dests.length; i++) {
    const r = buy ? act.orderNew(s, type, 1, T0 + H) : act.leaseNew(s, type, 12, T0 + H);
    if (!r.ok) { console.warn(`  (nur ${i} Flugzeuge: ${r.msg})`); break; }
  }
  settle(s, T0 + 2 * H);
  stable(s);
  for (const d of dests) {
    const route = act.createRoute(s, "FRA", d).route;
    if (!route) continue;
    act.hireAllOpen(s, T0 + 2 * H);
    const free = s.fleet.find(a => a.status === "idle");
    if (free) act.assign(s, free.id, route.id, T0 + 2 * H);
    act.hireAllOpen(s, T0 + 2 * H);
  }
  return s;
}

/** Tag für Tag durchrechnen – nie in einem Sprung, sonst greift die 30-Tage-Grenze. */
function run(s, days, perDay) {
  for (let d = 0; d < days; d++) {
    const t = T0 + 2 * H + d * DAY;
    perDay?.(s, t, d);
    settle(s, t + DAY);
  }
  return T0 + 2 * H + days * DAY;
}

function report(label, s, now, extra = {}) {
  const sum = summary(s, DAYS, now);
  const legs = s.flights;
  const lf = legs.length ? legs.reduce((a, f) => a + f.lf, 0) / legs.length : 0;
  const onTime = legs.length ? legs.filter(f => (f.delay || 0) < 15).length / legs.length : 0;
  const fleet = s.fleet.filter(a => a.status !== "crashed").length;
  const r = rate(profileOf(s, now));
  console.log(
    label.padEnd(26) +
    `| Erlöse ${money(sum.opRev)} | Ergebnis ${money(sum.profit)} | Marge ${pct(sum.opRev ? sum.profit / sum.opRev : 0)}` +
    ` | LF ${pct(lf)} | pünktl. ${pct(onTime)} | Flotte ${String(fleet).padStart(2)}` +
    ` | Kasse ${money(s.cash)} | Wert ${money(companyValue(s, now).total)}` +
    ` | Rep ${s.airline.rep.toFixed(0).padStart(3)} | Bek. ${String(Math.round(awareness(s, now))).padStart(3)}` +
    ` | Größe ${String(r.size).padStart(3)} | Wirt. ${String(r.efficiency).padStart(3)}` +
    (extra.note ? ` | ${extra.note}` : "")
  );
}

const SZENARIEN = {
  /** Eine Maschine auf einer starken Strecke – der Referenzfall für alle Margen. */
  referenz() {
    const s = build(fresh(), ["LHR"]);
    report("1 Flugzeug FRA–LHR", s, run(s, DAYS));
  },

  /** Dieselbe Strecke mit zwei Maschinen: zeigt, wie schnell Überversorgung weh tut. */
  ueberversorgt() {
    const s = build(fresh(), ["LHR", "LHR"]);
    report("2 Flugzeuge FRA–LHR", s, run(s, DAYS));
  },

  /** Drei Strecken, drei Maschinen – der normale Spielverlauf. */
  netz() {
    const s = build(fresh(), ["LHR", "CDG", "MAD"]);
    report("3 Strecken, 3 Flugzeuge", s, run(s, DAYS));
  },

  /**
   * Wachstum über Leasing. Zweimal: einmal mit täglicher Personalplanung, einmal ohne.
   * Der Unterschied ist der Grund, warum schnelles Wachstum im Spiel weh tun soll.
   */
  leasing() {
    for (const [label, hireDaily] of [["Wachstum, Personal gepflegt", true], ["Wachstum ohne Personalplanung", false]]) {
      const s = build(fresh(), ["LHR"]);
      const dests = ["CDG", "MAD", "BCN", "FCO", "VIE", "CPH", "DUB", "LIS", "ATH", "WAW", "OSL"];
      let next = 0;
      const now = run(s, DAYS, (st, t) => {
        if (hireDaily) act.hireAllOpen(st, t);
        if (next >= dests.length || st.cash < 4e6) return;
        if (!act.leaseNew(st, "a320neo", 12, t).ok) return;
        stable(st);
        const route = act.createRoute(st, "FRA", dests[next++]).route;
        act.hireAllOpen(st, t);
        const free = st.fleet.find(a => a.status === "idle");
        if (free && route) act.assign(st, free.id, route.id, t);
        act.hireAllOpen(st, t);
      });
      report(label, s, now);
    }
  },

  /**
   * Umsteiger: Was bringt ein Netz gegenüber wenigen einzelnen Strecken?
   * Der Leasingrahmen wird hier künstlich gehoben, sonst misst man nur ihn.
   */
  umsteiger() {
    const dests = ["LIS", "ATH", "OSL", "IST", "MAD", "HEL", "DUB", "WAW"];
    for (const n of [2, 4, 8]) {
      const s = fresh();
      s.cash = 60e6;
      s.airline.frameBonus = 3e6;                 // Rahmen für den Test öffnen
      build(s, dests.slice(0, n));
      const now = run(s, DAYS, (st, t) => act.hireAllOpen(st, t));
      const sum = summary(s, DAYS, now);
      const share = sum.opRev ? (sum.rev.transfer || 0) / sum.opRev : 0;
      report(`${n} weite Strecken`, s, now, { note: `Umsteiger ${money(sum.rev.transfer || 0)} (${pct(share)} vom Erlös)` });
    }
  },

  /** Werbung: lohnt sie sich, und ab wann nicht mehr? */
  werbung() {
    for (const [label, plan] of [["ohne Werbung", null], ["Online mittel", ["online", 1]], ["TV groß", ["tv", 2]]]) {
      const s = build(fresh(), ["LHR", "CDG"]);
      s.cash += 20e6;
      const now = run(s, DAYS, (st, t, d) => { if (plan && d % 7 === 0) act.bookCampaign(st, plan[0], plan[1], 7, t); });
      const ads = summary(s, DAYS, now).cost.marketing || 0;
      report(label, s, now, { note: `Werbung ${money(ads)}` });
    }
  },

  /** Service-Einstellungen gegeneinander. */
  service() {
    for (const [label, apply] of [
      ["Standard", () => {}],
      ["Sparabfertiger", st => act.setHandler(st, "budget")],
      ["Premium + Komfort", st => { act.setHandler(st, "premium"); act.setOnboard(st, "premium"); act.setCatering(st, "free"); }]
    ]) {
      const s = build(fresh(), ["LHR", "CDG"]);
      apply(s);
      report(label, s, run(s, DAYS));
    }
  },

  /** Drehkreuz-Ausbau: zahlt er sich über den Zeitraum aus? */
  drehkreuz() {
    for (const [label, build2] of [
      ["ohne Ausbau", () => {}],
      ["Flugsteig + Lounge", st => { st.cash += 30e6; act.upgradeHub(st, "FRA", "gates", T0 + 2 * H); act.upgradeHub(st, "FRA", "lounge", T0 + 2 * H); act.upgradeHub(st, "FRA", "lounge", T0 + 2 * H); }]
    ]) {
      const s = build(fresh(), ["LHR", "CDG", "MAD"]);
      build2(s);
      report(label, s, run(s, DAYS));
    }
  },

  /** Kredit: trägt eine gekaufte Maschine ihre Rate? */
  kredit() {
    const s = build(fresh(), ["LHR", "CDG"]);
    let taken = false;
    const now = run(s, DAYS, (st, t, d) => {
      if (taken || d < 20) return;
      const r = act.takeLoan(st, 8e6, 24, "annuity", t);
      if (r.ok) taken = true;
    });
    report("Kredit nach 20 Tagen", s, now, { note: `Schulden ${money(totalDebt(s))}` });
  }
};

console.log(`Airline Manager ${GAME.label} · Balance über ${DAYS} Tage\n`);
for (const [name, fn] of Object.entries(SZENARIEN)) {
  if (ONLY && ONLY !== name) continue;
  console.log(`— ${name} —`);
  fn();
  console.log("");
}
