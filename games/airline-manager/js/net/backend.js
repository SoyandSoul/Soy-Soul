// Backend-Adapter. Heute: Supabase (wie History Shots) oder Demo-Modus.
// Andere Anbieter lassen sich anbinden, indem man diese vier Funktionen ersetzt – der Rest des Spiels kennt nur sie.
//
//   publish(snapshot)        eigene Airline in Börse/Rangliste aktualisieren
//   fetchMarket()            alle Airlines mit aktuellem Kurs holen
//   cloudSave(state)         Spielstand unter Code + Schlüssel ablegen (Gerätewechsel)
//   cloudLoad(code, secret)  Spielstand wiederherstellen

import { SUPABASE } from "./config.js";
import { demoMarket } from "../sim/stocks.js";

export const online = () => !!(SUPABASE.url && SUPABASE.key);

const headers = () => ({ apikey: SUPABASE.key, Authorization: "Bearer " + SUPABASE.key, "Content-Type": "application/json" });

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE.url}/rest/v1/rpc/${fn}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

export async function publish(snap) {
  if (!online()) return false;
  await rpc("publish_airline", { p_code: snap.code, p_secret: snap.secret, p_data: { ...snap, secret: undefined } });
  return true;
}

export async function fetchMarket(now = Date.now()) {
  if (!online()) return { demo: true, list: demoMarket(now) };
  const r = await fetch(`${SUPABASE.url}/rest/v1/airlines?select=code,name,iata,hub,share_price,value,rep,fleet,profit_30d,livery,updated_at&order=share_price.desc&limit=200`, { headers: headers() });
  if (!r.ok) throw new Error("Börse nicht erreichbar");
  const rows = await r.json();
  return {
    demo: false,
    list: rows.map(x => ({ code: x.code, name: x.name, iata: x.iata, hub: x.hub, price: +x.share_price, value: +x.value, rep: +x.rep, fleet: x.fleet, profit30: +x.profit_30d, livery: x.livery, updated: Date.parse(x.updated_at) }))
  };
}

export async function cloudSave(state) {
  if (!online()) return false;
  await rpc("save_game", { p_code: state.player.code, p_secret: state.player.secret, p_state: state });
  return true;
}

export async function cloudLoad(code, secret) {
  if (!online()) throw new Error("Kein Online-Backend eingerichtet.");
  const s = await rpc("load_game", { p_code: code, p_secret: secret });
  if (!s) throw new Error("Code oder Schlüssel falsch.");
  return s;
}
