// Spielstand: Aufbau, Laden, Speichern, Migration.
// Gespeichert wird nur im Browser (localStorage). Kein Konto, keine E-Mail.
// Für Gerätewechsel gibt es Export/Import als Text (ui/apps/airline.js) und optional Cloud-Save (net/backend.js).

import { GAME, FUEL, REPUTATION, CATERING, BAGS } from "./config.js";
import { whiteLivery, normalizeLivery } from "../art/livery.js";

const mem = new Map(); // Fallback, falls localStorage fehlt (Node-Tests, privater Modus)
const storage = {
  get(k) { try { return globalThis.localStorage ? localStorage.getItem(k) : mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } },
  set(k, v) { try { globalThis.localStorage ? localStorage.setItem(k, v) : mem.set(k, v); } catch { mem.set(k, v); } },
  del(k) { try { globalThis.localStorage ? localStorage.removeItem(k) : mem.delete(k); } catch { mem.delete(k); } }
};

export function newGame({ name, iata, hub, player, now = Date.now() }) {
  return {
    v: GAME.version,
    created: now,
    player,                                   // { code, secret } aus net/player.js
    airline: {
      name, iata, hubs: [hub],
      livery: whiteLivery(),                  // komplett weiß – bemalt wird in der Lackiererei (ui/painter.js)
      contract: null,                         // { maker, since }
      catering: CATERING.defaultMode,
      bagFee: BAGS.defaultFee,
      training: 0,
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
    lastSettled: now,
    lastFixedAt: now
  };
}

/** Ältere Speicherstände auf das aktuelle Format heben. Jede Version bekommt einen eigenen Schritt. */
export function migrate(s) {
  if (!s || typeof s !== "object") return null;
  // Beispiel für spätere Versionen:
  // if (s.v === 1) { s.airline.newField = default; s.v = 2; }
  if (s.v !== GAME.version) return null;
  s.airline.livery = normalizeLivery(s.airline.livery); // alte Farbflächen-Livery → Malformat
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
