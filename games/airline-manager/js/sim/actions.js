// Alle Spieleraktionen an einer Stelle. Jede Aktion prüft ihre Regeln und gibt { ok, msg } zurück.
// Die UI ruft nur diese Funktionen auf und verändert den Spielstand nie direkt.

import { AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";
import { CABIN, CONTRACT, FLIGHT, STAFF, BAGS, CATERING, CHECKS, LEASE, DAY, H } from "../core/config.js";
import { uid } from "../core/util.js";
import { book } from "./ledger.js";
import { canOrderNew, newOrderQuote, createAircraft, usedListings, aircraftValue, basePrice } from "./market.js";
import { leaseQuote, makeContract, frameBlock, isLeased, returnSettlement, buyoutPrice, termOf } from "./lease.js";
import { routeProblems, seatUnits, typeOf } from "./flight.js";
import { refFare } from "./demand.js";
import { routeDistance } from "./flight.js";
import { startCheck, checkCost } from "./maintenance.js";
import { headcount, staffNeed, staffHave, coverage, GROUPS, hireCost, severanceCost } from "./staff.js";
import { normalizeLivery, liverySize } from "../art/livery.js";

const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = msg => ({ ok: false, msg });

// ---------- Flotte

export function orderNew(state, typeId, qty, now) {
  const t = AIRCRAFT_BY_ID[typeId], block = canOrderNew(state, t);
  if (block) return fail(block);
  const q = newOrderQuote(state, t, qty);
  if (q.total > state.cash) return fail("Nicht genug Geld für diese Bestellung.");
  book(state, now, "cost", "aircraft", q.total);
  const list = [];
  let late = 0;
  for (let i = 0; i < qty; i++) {
    const ac = createAircraft(state, t, now, { orderIndex: late });
    if (ac.availableAt) late++;
    ac.price = q.total / qty; state.fleet.push(ac); list.push(ac);
  }
  return ok({ aircraft: list, cost: q.total });
}

export function buyUsed(state, listingId, now) {
  if (state.market.boughtUsed.includes(listingId)) return fail("Dieses Angebot hast du schon gekauft.");
  const l = usedListings(now).find(x => x.id === listingId);
  if (!l) return fail("Angebot ist nicht mehr verfügbar.");
  if (l.price > state.cash) return fail("Nicht genug Geld.");
  book(state, now, "cost", "aircraft", l.price);
  const ac = createAircraft(state, AIRCRAFT_BY_ID[l.typeId], now, { used: l });
  ac.price = l.price;
  state.fleet.push(ac);
  state.market.boughtUsed.push(listingId);
  if (state.market.boughtUsed.length > 200) state.market.boughtUsed.shift();
  return ok({ aircraft: ac });
}

export function sellAircraft(state, acId, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!ac) return fail("Flugzeug nicht gefunden.");
  if (isLeased(ac)) return fail("Geleaste Flugzeuge gehören dem Leasinggeber – zurückgeben oder herauskaufen.");
  if (ac.status === "active" || ac.status === "check") return fail("Erst von der Route nehmen bzw. Check abwarten.");
  const value = ac.status === "crashed" ? 0 : aircraftValue(ac, now) * 0.95;
  state.fleet = state.fleet.filter(a => a !== ac);
  book(state, now, "rev", "insurance", value); // als außerordentlicher Ertrag
  return ok({ value });
}

export function setCabin(state, acId, cfg) {
  const ac = state.fleet.find(a => a.id === acId), t = typeOf(ac);
  if (ac.status === "active") return fail("Umbau nur am Boden ohne Route.");
  const clean = {};
  for (const c of CABIN.classes) clean[c] = Math.max(0, Math.floor(+cfg[c] || 0));
  if (seatUnits(clean) > t.seatsMax) return fail(`Zu viele Sitze: ${seatUnits(clean).toFixed(0)} von ${t.seatsMax} Einheiten.`);
  ac.cfg = clean;
  return ok();
}

export function addAuxTank(state, acId, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if ((ac.aux || 0) >= FLIGHT.aux.maxTanks) return fail("Maximale Zusatztanks verbaut.");
  if (ac.status === "active") return fail("Einbau nur am Boden ohne Route.");
  const cost = FLIGHT.aux.priceM * 1e6;
  if (cost > state.cash) return fail("Nicht genug Geld.");
  book(state, now, "cost", "upgrades", cost);
  ac.aux = (ac.aux || 0) + 1;
  return ok({ cost });
}

// ---------- Strecken

export function createRoute(state, from, to) {
  if (!state.airline.hubs.includes(from)) return fail("Strecken starten an einem deiner Drehkreuze.");
  if (from === to || !AIRPORT_BY_IATA[to]) return fail("Ungültiges Ziel.");
  if (state.routes.some(r => r.from === from && r.to === to)) return fail("Diese Strecke gibt es schon.");
  const route = { id: uid("rt"), from, to, prices: {}, seasonal: { peak: 15, off: 10 }, created: Date.now() };
  const km = routeDistance(route);
  for (const c of CABIN.classes) route.prices[c] = Math.round(refFare(km, c));
  state.routes.push(route);
  return ok({ route });
}

export function deleteRoute(state, routeId) {
  for (const ac of state.fleet) if (ac.ops?.routeId === routeId) return fail("Erst alle Flugzeuge von der Strecke nehmen.");
  state.routes = state.routes.filter(r => r.id !== routeId);
  return ok();
}

export function setRoutePricing(state, routeId, prices, seasonal) {
  const r = state.routes.find(x => x.id === routeId);
  for (const c of CABIN.classes) if (prices[c] != null) r.prices[c] = Math.max(1, Math.round(+prices[c]));
  if (seasonal) r.seasonal = { peak: Math.max(0, Math.min(100, +seasonal.peak || 0)), off: Math.max(0, Math.min(60, +seasonal.off || 0)) };
  return ok();
}

/** Flugzeug auf Strecke setzen. Startet ab "start" (Default jetzt) mit dem Hinflug. */
export function assign(state, acId, routeId, now, start = now) {
  const ac = state.fleet.find(a => a.id === acId), route = state.routes.find(r => r.id === routeId);
  if (!ac || !route) return fail("Nicht gefunden.");
  if (ac.status !== "idle") return fail("Flugzeug ist nicht verfügbar (Auslieferung, Check oder bereits im Einsatz).");
  const problems = routeProblems(ac, route);
  if (problems.length) return fail(problems.join(" · "));
  if (!Object.values(ac.cfg).some(Boolean)) return fail("Kabine hat keine Sitze.");
  ac.ops = { routeId, dir: 0, dep: Math.max(now, start) };
  ac.status = "active";
  // Ohne Crew fliegt nichts: mit dem neuen Einsatz steigt der Personalbedarf – reicht er nicht, zurückrollen.
  const cov = coverage(state), min = STAFF.shortage.minToAssign;
  const short = GROUPS.filter(g => cov[g] < min);
  if (short.length) {
    ac.ops = null; ac.status = "idle";
    const miss = short.map(g => `${Math.max(1, cov.need[g] - cov.have[g])} ${STAFF.groups[g].short}`).join(" und ");
    return fail(`Zu wenig Personal für diesen Einsatz – es fehlen ${miss}. Erst einstellen (Airline → Personal).`);
  }
  return ok();
}

/** Von der Strecke nehmen: steht es gerade am Drehkreuz, sofort – sonst nach Rückkehr. */
export function unassign(state, acId, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!ac?.ops) return fail("Flugzeug fliegt keine Strecke.");
  if (ac.status === "active" && ac.ops.dir === 0 && ac.ops.dep > now) { ac.ops = null; ac.status = "idle"; return ok({ now: true }); }
  if (ac.status === "check") { ac.ops = null; return ok({ now: true }); }
  ac.unassign = true;
  return ok({ now: false });
}

// ---------- Wartung

/** Check sofort starten (nur wenn am Drehkreuz am Boden) oder für die nächste Rückkehr vormerken. */
export function requestCheck(state, acId, check, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!CHECKS[check]) return fail("Unbekannter Check.");
  if (ac.status === "check") return fail("Läuft bereits ein Check.");
  if (ac.status === "delivery" || ac.status === "crashed") return fail("Nicht möglich.");
  const atHub = ac.status === "idle" || (ac.status === "active" && ac.ops.dir === 0 && ac.ops.dep > now);
  if (atHub) {
    const cost = checkCost(state, ac, check);
    if (cost > state.cash) return fail("Nicht genug Geld für den Check.");
    book(state, now, "cost", "checks", startCheck(state, ac, check, now));
    if (ac.ops) ac.ops.dep = ac.check.until;
    return ok({ now: true });
  }
  ac.scheduledCheck = check;
  return ok({ now: false });
}

export function setAutoCheck(state, acId, on) { state.fleet.find(a => a.id === acId).autoCheck = !!on; return ok(); }

// ---------- Airline

export function signContract(state, maker, now) {
  if (state.airline.contract) return fail("Es läuft bereits ein Exklusivvertrag.");
  state.airline.contract = { maker, since: now };
  return ok();
}

export function cancelContract(state, now) {
  if (!state.airline.contract) return fail("Kein Vertrag aktiv.");
  if (state.cash < CONTRACT.cancelFee) return fail("Nicht genug Geld für die Vertragsstrafe.");
  book(state, now, "cost", "contract", CONTRACT.cancelFee);
  state.airline.contract = null;
  return ok();
}

export function setCatering(state, mode) { if (!CATERING.modes[mode]) return fail("Unbekannt."); state.airline.catering = mode; return ok(); }
export function setBagFee(state, fee) { state.airline.bagFee = Math.max(0, Math.min(BAGS.maxFee, Math.round(+fee || 0))); return ok(); }

export function trainingQuote(state) {
  const lvl = state.airline.training + 1;
  if (lvl >= STAFF.training.levels.length) return null;
  const staff = headcount(state).total;
  return { level: lvl, staff, cost: staff * STAFF.training.feePerEmployee[lvl] };
}

export function upgradeTraining(state, now) {
  const q = trainingQuote(state);
  if (!q) return fail("Höchste Schulungsstufe erreicht.");
  if (!q.staff) return fail("Noch keine Mitarbeiter – erst Flugzeuge kaufen.");
  if (q.cost > state.cash) return fail("Nicht genug Geld.");
  book(state, now, "cost", "training", q.cost);
  state.airline.training = q.level;
  return ok(q);
}

export const hubPrice = iata => AIRPORT_BY_IATA[iata].tier * 5e6;

// ---------- Leasing

/** Fabrikneues Flugzeug leasen. */
export function leaseNew(state, typeId, months, now) {
  const t = AIRCRAFT_BY_ID[typeId], block = canOrderNew(state, t);
  if (block) return fail(block);
  const q = leaseQuote(state, t, { months });
  const fb = frameBlock(state, now, q.rate);
  if (fb) return fail(fb);
  if (q.upfront > state.cash) return fail(`Kaution und erste Rate kosten ${Math.round(q.upfront / 1e3)} k$ – nicht genug Geld.`);
  book(state, now, "cost", "leaseFee", q.deposit);          // Kaution: bei ordentlicher Rückgabe zurück
  const ac = createAircraft(state, t, now, { lease: null });
  ac.lease = makeContract(state, t, now, q);
  state.fleet.push(ac);
  return ok({ aircraft: ac, quote: q });
}

/** Ein Gebrauchtangebot leasen statt kaufen. */
export function leaseUsed(state, listingId, months, now) {
  if (state.market.boughtUsed.includes(listingId)) return fail("Dieses Angebot ist schon vergeben.");
  const l = usedListings(now).find(x => x.id === listingId);
  if (!l) return fail("Angebot ist nicht mehr verfügbar.");
  const t = AIRCRAFT_BY_ID[l.typeId];
  const q = leaseQuote(state, t, { months, used: l });
  const fb = frameBlock(state, now, q.rate);
  if (fb) return fail(fb);
  if (q.upfront > state.cash) return fail(`Kaution und erste Rate kosten ${Math.round(q.upfront / 1e3)} k$ – nicht genug Geld.`);
  book(state, now, "cost", "leaseFee", q.deposit);
  const ac = createAircraft(state, t, now, { used: l, lease: null });
  ac.lease = makeContract(state, t, now, q);
  state.fleet.push(ac);
  state.market.boughtUsed.push(listingId);
  if (state.market.boughtUsed.length > 200) state.market.boughtUsed.shift();
  return ok({ aircraft: ac, quote: q });
}

/** Vertrag verlängern (freiwillig, vor Ablauf). */
export function extendLease(state, acId, months, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!isLeased(ac)) return fail("Kein Leasingflugzeug.");
  const t = typeOf(ac), rate = Math.round(ac.lease.rate * (termOf(months).factor / termOf(ac.lease.months).factor));
  const fb = frameBlock(state, now, Math.max(0, rate - ac.lease.rate));
  if (fb) return fail(fb);
  ac.lease.until = Math.max(ac.lease.until, now) + months * LEASE.monthDays * DAY;
  ac.lease.months = months;
  ac.lease.rate = rate;
  ac.lease.returnAtEnd = false;
  return ok({ rate, until: ac.lease.until });
}

/** Am Vertragsende zurückgeben statt automatisch verlängern. */
export function setReturnAtEnd(state, acId, on) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!isLeased(ac)) return fail("Kein Leasingflugzeug.");
  ac.lease.returnAtEnd = !!on;
  return ok({ returnAtEnd: ac.lease.returnAtEnd });
}

/** Sofort zurückgeben. Vorzeitig kostet Restraten, überfällige Checks kosten extra. */
export function returnLease(state, acId, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!isLeased(ac)) return fail("Kein Leasingflugzeug.");
  if (ac.status === "active") return fail("Erst von der Strecke nehmen.");
  if (ac.status === "check") return fail("Der laufende Check muss abgeschlossen werden.");
  const st = returnSettlement(ac, now);
  if (st.due > state.cash) return fail(`Rückgabe kostet ${Math.round(st.due / 1e3)} k$ – nicht genug Geld.`);
  if (st.refund) book(state, now, "rev", "insurance", st.refund);
  if (st.due) book(state, now, "cost", "leaseFee", st.due);
  state.fleet = state.fleet.filter(a => a !== ac);
  return ok({ ...st, reg: ac.reg });
}

/** Aus dem Vertrag herauskaufen – das Flugzeug gehört danach der Airline. */
export function buyoutLease(state, acId, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!isLeased(ac)) return fail("Kein Leasingflugzeug.");
  const price = buyoutPrice(ac, now);
  if (price > state.cash) return fail(`Übernahme kostet ${Math.round(price / 1e6)} Mio $ – nicht genug Geld.`);
  book(state, now, "cost", "aircraft", price);
  book(state, now, "rev", "insurance", ac.lease.deposit);   // Kaution zurück
  ac.lease = null;
  ac.price = price;
  return ok({ price });
}

/** Sale-and-Leaseback: eigenes Flugzeug an eine Leasinggesellschaft verkaufen und zurückmieten. */
export function saleLeaseback(state, acId, months, now) {
  const ac = state.fleet.find(a => a.id === acId);
  if (!ac) return fail("Flugzeug nicht gefunden.");
  if (isLeased(ac)) return fail("Dieses Flugzeug ist bereits geleast.");
  if (ac.status === "crashed" || ac.status === "delivery") return fail("Nicht möglich.");
  const t = typeOf(ac), value = aircraftValue(ac, now) * LEASE.saleLeasebackFactor;
  const q = leaseQuote(state, t, { months });
  q.value = value; q.rate = value * LEASE.ratePerMonth * termOf(months).factor;
  q.deposit = q.rate * LEASE.depositMonths;
  const fb = frameBlock(state, now, q.rate);
  if (fb) return fail(fb);
  book(state, now, "rev", "insurance", value);              // Verkaufserlös
  book(state, now, "cost", "leaseFee", q.deposit);
  ac.lease = makeContract(state, t, now, q);
  return ok({ value, rate: q.rate, deposit: q.deposit });
}

// ---------- Personal

export function hire(state, group, n, now) {
  if (!GROUPS.includes(group)) return fail("Unbekannte Personalgruppe.");
  n = Math.max(0, Math.round(+n || 0));
  if (!n) return fail("Bitte eine Anzahl angeben.");
  const cost = hireCost(group, n);
  if (cost > state.cash) return fail(`Einstellung kostet ${Math.round(cost / 1000)} k$ an Werbung und Schulung – nicht genug Geld.`);
  book(state, now, "cost", "recruit", cost);
  state.staff[group] = staffHave(state)[group] + n;
  return ok({ group, n, cost });
}

export function fire(state, group, n, now) {
  if (!GROUPS.includes(group)) return fail("Unbekannte Personalgruppe.");
  const have = staffHave(state)[group];
  n = Math.max(0, Math.min(have, Math.round(+n || 0)));
  if (!n) return fail("Niemand zu entlassen.");
  const cost = severanceCost(group, n);
  if (cost > state.cash) return fail(`Abfindungen kosten ${Math.round(cost / 1000)} k$ – nicht genug Geld.`);
  book(state, now, "cost", "recruit", cost);
  state.staff[group] = have - n;
  return ok({ group, n, cost });
}

/** Alle offenen Stellen auf einmal besetzen. */
export function hireAllOpen(state, now) {
  const need = staffNeed(state), have = staffHave(state);
  const open = {};
  let total = 0, cost = 0;
  for (const g of GROUPS) { const d = Math.max(0, need[g] - have[g]); if (d) { open[g] = d; total += d; cost += hireCost(g, d); } }
  if (!total) return fail("Alle Stellen sind besetzt.");
  if (cost > state.cash) return fail(`${total} Stellen kosten ${Math.round(cost / 1000)} k$ an Werbung und Schulung – nicht genug Geld.`);
  book(state, now, "cost", "recruit", cost);
  for (const [g, d] of Object.entries(open)) state.staff[g] = have[g] + d;
  return ok({ open, total, cost });
}

export function addHub(state, iata, now) {
  if (state.airline.hubs.includes(iata)) return fail("Schon dein Drehkreuz.");
  const p = hubPrice(iata);
  if (p > state.cash) return fail("Nicht genug Geld.");
  book(state, now, "cost", "upgrades", p);
  state.airline.hubs.push(iata);
  return ok({ cost: p });
}

export function setLivery(state, livery) {
  const lv = normalizeLivery(livery);
  if (liverySize(lv) > 200_000) return fail("Livery ist zu groß – bitte weniger Einzelstriche verwenden.");
  state.airline.livery = lv;
  return ok();
}
export function renameAircraft(state, acId, name) { state.fleet.find(a => a.id === acId).name = String(name).slice(0, 24); return ok(); }

