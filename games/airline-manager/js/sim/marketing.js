// Werbung und Bekanntheit.
//
// Bekanntheit (0..100) ist das Gegenstück zur Reputation: die sagt, wie gut über dich geredet wird,
// die Bekanntheit, ob überhaupt jemand an dich denkt, wenn er einen Flug sucht.
// Sie füllt also leere Sitze – wo schon alles voll ist, bringt Werbung wenig. Das begrenzt sich von selbst.
//
// Wichtig fürs Rechnen ohne Server: Bekanntheit wird NICHT mitgeschleppt, sondern jederzeit aus der
// Liste der gebuchten Kampagnen ausgerechnet. Damit ist sie – wie Kerosinpreis und Wetter – eine reine
// Funktion der Zeit: Es ist egal, ob man stündlich reinschaut oder drei Tage wegbleibt.
//
// Modell je Kampagne: ein Vorrat, der während der Laufzeit aufgefüllt wird und danach abklingt.
//   dS/dt = g − λS  →  Laufzeit: S = g/λ · (1 − e^(−λ·t)) · Anlauf,  danach: S(Ende) · e^(−λ·t)
// λ kommt aus der Halbwertszeit des Kanals: Online verpufft schnell, ein Fernsehspot wirkt nach.

import { MARKETING as M, DAY, CABIN } from "../core/config.js";
import { clamp } from "../core/util.js";

export const channelOf = id => M.channels[id];
export const CHANNELS = Object.keys(M.channels);

const lambda = ch => Math.LN2 / ch.halfLifeDays;

/** Grundbekanntheit: wer viele Ziele bedient, ist auch ohne Werbung ein Begriff. */
export function awarenessFloor(state) {
  const dest = new Set(state.routes.map(r => r.to)).size;
  return Math.min(M.floorMax, M.base + dest * M.floorPerDest);
}

export const campaignsOf = state => state.airline.marketing?.campaigns || [];
export const activeCampaigns = (state, now) => campaignsOf(state).filter(c => c.start <= now && c.until > now);

/** Anlaufkurve: ein Fernsehspot wirkt nicht am ersten Abend. 0..1 */
function ramp(c, now) {
  const ch = channelOf(c.channel);
  if (!ch?.ramp) return 1;
  return clamp((Math.min(now, c.until) - c.start) / (ch.ramp * DAY), 0, 1);
}

/** Beitrag einer einzelnen Kampagne zur Bekanntheit, zum Zeitpunkt now. */
export function contribution(c, now) {
  const ch = channelOf(c.channel);
  if (!ch || now <= c.start) return 0;
  const lam = lambda(ch), g = c.gainPerDay;
  const runDays = (Math.min(now, c.until) - c.start) / DAY;
  let s = g / lam * (1 - Math.exp(-lam * runDays)) * ramp(c, now);
  if (now > c.until) s *= Math.exp(-lam * (now - c.until) / DAY);
  return s;
}

/** Bekanntheit 0..100 – reine Funktion aus Grundwert und gebuchten Kampagnen. */
export function awareness(state, now) {
  let sum = awarenessFloor(state);
  for (const c of campaignsOf(state)) sum += contribution(c, now);
  return clamp(sum, 0, M.maxAw);
}

/** Was eine Kampagne kostet. Tarif und Laufzeit multiplizieren sich, bezahlt wird beim Buchen. */
export function campaignQuote(channelId, tierIndex, days) {
  const ch = channelOf(channelId), tier = M.tiers[tierIndex];
  if (!ch || !tier || !M.terms.includes(days)) return null;
  return {
    channel: channelId, tier: tierIndex, days,
    perDay: Math.round(ch.costPerDay * tier.mul),
    total: Math.round(ch.costPerDay * tier.mul * days),
    gainPerDay: ch.gainPerDay * tier.mul,
    label: `${ch.label}, ${tier.label}`
  };
}

/** Klassengewichtung der laufenden Kanäle. Zeitung spricht Geschäftsreisende an, Online eher Urlauber. */
export function classMix(state, now) {
  const mix = {}; for (const c of CABIN.classes) mix[c] = 0;
  let w = 0;
  for (const c of campaignsOf(state)) {
    const weight = contribution(c, now);
    if (weight <= 0) continue;
    w += weight;
    const bias = channelOf(c.channel).bias || {};
    for (const cls of CABIN.classes) mix[cls] += (bias[cls] ?? 1) * weight;
  }
  if (!w) { for (const c of CABIN.classes) mix[c] = 1; return mix; }
  for (const c of CABIN.classes) mix[c] /= w;
  return mix;
}

/**
 * Nachfragefaktor aus der Bekanntheit. Eine junge Airline (Bekanntheit ~12) liegt bei 1,0 –
 * Werbung ist also ein Aufschlag, kein Pflichtprogramm, mit dem man nur ein Loch stopft.
 * Volle Bekanntheit bringt gut ein Fünftel mehr Nachfrage.
 */
export function awarenessFactor(state, now, cls = null) {
  const aw = awareness(state, now);
  const bias = cls ? (classMix(state, now)[cls] ?? 1) : 1;
  return clamp(1 + M.demandSpan * (aw - M.demandRef) / 100 * bias, 0.9, 1.4);
}

/** Rufgewinn: bekannt sein hilft ein wenig, Zeitungswerbung zusätzlich. */
export function marketingRep(state, now) {
  let rep = M.repPer10 * awareness(state, now) / 10;
  for (const c of activeCampaigns(state, now)) rep += (channelOf(c.channel).rep || 0) * ramp(c, now);
  return rep;
}

/** Laufende Werbeausgaben je Tag – nur zur Anzeige, bezahlt wird beim Buchen. */
export const spendPerDay = (state, now) => activeCampaigns(state, now).reduce((s, c) => s + c.perDay, 0);

/** Einschätzung in Worten – fürs Panel. */
export function awarenessNote(state, now) {
  const aw = awareness(state, now), floor = awarenessFloor(state);
  const soon = awareness(state, now + DAY);
  const trend = soon - aw;
  const stand = aw < 20 ? "Kaum jemand kennt euch."
    : aw < 40 ? "Ein Begriff in der Region."
    : aw < 60 ? "In der Branche bekannt."
    : aw < 80 ? "Eine Marke, die man kennt."
    : "Jeder kennt euren Namen.";
  return { aw, stand, trend, floor, dir: trend > 0.2 ? "steigend" : trend < -0.2 ? "fallend" : "stabil" };
}
