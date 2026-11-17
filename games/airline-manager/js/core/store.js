// Spielstand: Aufbau, Laden, Speichern, Migration.
// Gespeichert wird nur im Browser (localStorage). Kein Konto, keine E-Mail.
// Für Gerätewechsel gibt es Export/Import als Text (ui/panels/airline.js) und optional Cloud-Save (net/backend.js).

import { GAME, FUEL, REPUTATION, CATERING, BAGS, HANDLERS, ONBOARD, STOCKS } from "./config.js";
import { whiteLivery, normalizeLivery } from "../art/livery.js";
import { AIRCRAFT_BY_ID, LEGACY_TYPES } from "../data/aircraft.js";
import { staffNeed, GROUPS } from "../sim/staff.js";

const mem = new Map(); // Fallback, falls localStorage fehlt (Node-Tests, privater Modus)
const storage = {
  get(k) { try { return globalThis.localStorage ? localStorage.getItem(k) : mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } },
  set(k, v) { try { globalThis.localStorage ? localStorage.setItem(k, v) : mem.set(k, v); } catch { mem.set(k, v); } },
  del(k) { try { globalThis.localStorage ? localStorage.removeItem(k) : mem.delete(k); } catch { mem.delete(k); } }
};

export function newGame({ name, iata, hub, player, now = Date.now() }) {
  const s = {
    v: GAME.version,
    created: now,
    player,                                   // { code, secret } aus net/player.js
    airline: {
      name, iata, hubs: [hub],
      livery: whiteLivery(),                  // komplett weiß – bemalt wird in der Lackiererei (ui/painter.js)
      contract: null,                         // { maker, since }
      catering: CATERING.defaultMode,
      handler: HANDLERS.default,              // Bodenabfertiger, siehe sim/handling.js
      bagFee: BAGS.defaultFee,
      training: 0,
      frameBonus: 0,                          // dauerhafter Leasingrahmen aus erreichten Zielen
      marketing: { campaigns: [] },           // Werbekampagnen; Bekanntheit wird daraus gerechnet (sim/marketing.js)
      onboard: ONBOARD.defaultRange,          // Sortiment im Bordverkauf
      rep: REPUTATION.start,
      safety: { crashes: [], incidents: [], since: now },
      shares: GAME.startShares
    },
    cash: GAME.startCash,
    fleet: [],
    routes: [],
    fuel: { stockKg: FUEL.startStockT * 1000, avgCost: FUEL.basePerKg, depot: 0 },
    stocks: { holdings: {} },                 // { [code]: { qty, cost } }
    fin: { days: {} },                        // Tagesbuchungen, siehe sim/ledger.js
    flights: [],                              // letzte Flüge (Logbuch)
    log: [],                                  // Ereignisse für die UI
    market: { boughtUsed: [] },
    charter: { taken: [], declined: [] },     // Charteraufträge, siehe sim/charter.js
    adlivery: { taken: [], declined: [] },    // Sonderlackierungen, siehe sim/adlivery.js
    hub: { [hub]: { gates: 1, lounge: 0, hangar: 0 } },   // Ausbau je Drehkreuz, siehe sim/hub.js
    credit: { loans: [] },                    // Kredite, siehe sim/credit.js
    boost: 0,                                 // Vorlauf aus dem Schnellstart (sim/engine.js)
    lastPublish: 0,                           // wann der Börseneintrag zuletzt erneuert wurde
    irops: [],                                // offene Störfälle, siehe sim/irops.js
    ordered: 0,                               // Zähler für Sofort-Lieferungen
    staff: { cockpit: 0, cabin: 0, ground: 0, admin: 0 },  // wird gleich auf den Startbedarf gesetzt
    // Dauerhafte Statistik über die ganze Laufzeit (state.flights ist gedeckelt, taugt dafür nicht)
    stats: { pax: 0, legs: 0, km: 0, dest: [], lastBigDelay: 0, lastOverdue: 0 },
    goals: { done: [], seen: [] },                         // erreichte Ziele, siehe sim/goals.js
    lastSettled: now,
    lastFixedAt: now
  };
  // Zum Start ist der Bedarf gedeckt – wachsen muss die Mannschaft erst mit der Flotte (sim/staff.js).
  const need = staffNeed(s);
  for (const g of GROUPS) s.staff[g] = need[g];
  return s;
}

/** Ältere Speicherstände auf das aktuelle Format heben. Jede Version bekommt einen eigenen Schritt. */
export function migrate(s) {
  if (!s || typeof s !== "object") return null;
  // Beispiel für spätere Versionen:
  // if (s.v === 1) { s.airline.newField = default; s.v = 2; }
  if (s.v !== GAME.version) return null;
  s.airline.livery = normalizeLivery(s.airline.livery); // alte Farbflächen-Livery → Malformat
  s.ordered ??= s.fleet.length;
  // v0.16: Flotte auf die 38 Typen mit Blaupause umgestellt – weggefallene Typen auf den nächsten Verwandten
  for (const ac of s.fleet) {
    if (LEGACY_TYPES[ac.typeId]) ac.typeId = LEGACY_TYPES[ac.typeId];
    if (!AIRCRAFT_BY_ID[ac.typeId]) ac.typeId = "a320neo";
    ac.cond ??= null; // v0.16: Zustand gebrauchter Flugzeuge (null = neu gekauft, siehe sim/market.js)
  }
  // v0.17: Personal wird selbst eingestellt. Bestehende Airlines starten mit gedecktem Bedarf,
  // damit niemand nach dem Update plötzlich unterbesetzt dasteht.
  if (!s.staff) {
    s.staff = { cockpit: 0, cabin: 0, ground: 0, admin: 0 };
    const need = staffNeed(s);
    for (const g of GROUPS) s.staff[g] = need[g];
  }
  // v0.18: Leasing · v0.19: Statistik und Ziele
  for (const ac of s.fleet) ac.lease ??= null;
  s.airline.frameBonus ??= 0;
  if (!s.stats) {
    const dest = new Set(s.airline.hubs);
    for (const r of s.routes) { dest.add(r.from); dest.add(r.to); }
    s.stats = {
      pax: s.flights.reduce((a, f) => a + f.paxTotal, 0),
      legs: s.flights.length, km: s.flights.reduce((a, f) => a + f.km, 0),
      dest: [...dest], lastBigDelay: 0, lastOverdue: 0
    };
  }
  s.goals ??= { done: [], seen: [] };
  // Felder aus früheren Versionen, die in alten Ständen fehlen können. Lieber einmal zu viel
  // abgesichert – ein Spielstand, der nicht mehr lädt, ist der schlimmste Fehler in diesem Spiel.
  s.airline.catering ??= CATERING.defaultMode;
  if (!CATERING.modes[s.airline.catering]) s.airline.catering = CATERING.defaultMode;
  s.airline.bagFee ??= BAGS.defaultFee;
  s.airline.rep ??= REPUTATION.start;
  s.airline.safety ??= { incidents: [], crashes: [] };
  s.flights ??= [];
  s.log ??= [];
  s.routes ??= [];
  s.fleet ??= [];
  s.stocks ??= { holdings: {}, shares: STOCKS.defaultShares };
  s.fin ??= { days: {} };
  s.airline.handler ??= HANDLERS.default;      // v0.21: Bodenabfertiger
  if (!HANDLERS[s.airline.handler]) s.airline.handler = HANDLERS.default;
  // v0.22: Werbung, Charter, Sonderlackierungen, Bordverkauf
  s.airline.marketing ??= { campaigns: [] };
  s.airline.marketing.campaigns ??= [];
  s.airline.onboard ??= ONBOARD.defaultRange;
  if (!ONBOARD.ranges[s.airline.onboard]) s.airline.onboard = ONBOARD.defaultRange;
  s.charter ??= { taken: [], declined: [] };
  s.adlivery ??= { taken: [], declined: [] };
  // v0.23: Drehkreuz-Ausbau und Kabinenausstattung. Bestandsairlines starten mit Fluggastbrücken,
  // damit niemand nach dem Update plötzlich schlechter dasteht als vorher.
  s.hub ??= {};
  for (const h of s.airline.hubs) s.hub[h] ??= { gates: 1, lounge: 0, hangar: 0 };
  for (const ac of s.fleet) ac.fit ??= { seats: "standard", ife: "none" };
  s.credit ??= { loans: [] };               // v0.24: Kredite
  s.boost ??= 0;                            // v0.26: Schnellstart
  s.lastPublish ??= 0;                      // v0.27: Börseneintrag
  s.irops ??= [];                           // v0.30: Störfälle
  for (const ac of s.fleet) { ac.charter ??= null; ac.adLivery ??= null; }
  return s;
}

export function load() {
  const raw = storage.get(GAME.saveKey);
  if (!raw) return null;
  try { return migrate(JSON.parse(raw)); } catch { return null; }
}

export function save(state) { storage.set(GAME.saveKey, JSON.stringify(state)); }
export function wipe() { storage.del(GAME.saveKey); }

export const exportSave = state => btoa(unescape(encodeURIComponent(JSON.stringify(state))));
export function importSave(text) {
  const s = migrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
  if (!s) throw new Error("Spielstand passt nicht zu dieser Version.");
  return s;
}

export const prefs = {
  get: (k, d) => { try { return JSON.parse(storage.get("am-pref-" + k)) ?? d; } catch { return d; } },
  set: (k, v) => storage.set("am-pref-" + k, JSON.stringify(v))
};
