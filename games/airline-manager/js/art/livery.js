// Livery-Datenmodell. Eine Livery gilt für JEDEN Flugzeugtyp:
// Alles, was gemalt wird, speichern wir pro Bauteil (Zone) in relativen Koordinaten u/v (0..1) der Bauteil-Box.
// Auf einem anderen Typ wird es in dessen Bauteil-Box zurückgerechnet – ein Streifen am Rumpf bleibt am Rumpf,
// das Logo auf dem Leitwerk bleibt auf dem Leitwerk, egal ob A220 oder A380.
//
// {
//   v: 2,
//   base:  { fuselage, fin, stab, wing, engine }      Grundfarbe pro Bauteil
//   items: [                                           in Malreihenfolge
//     { t: "brush" | "erase" | "line", z, c, w, p: [[u, v], …] }   w = Strichbreite relativ zur Bauteilhöhe
//     { t: "band", z, c, v0, v1 }                                   waagerechtes Band über das ganze Bauteil
//     { t: "text", z, c, u, v, s, txt, b, i }                        Schrift (s = Größe relativ zur Höhe)
//   ]
// }

export const ZONES = ["fuselage", "fin", "stab", "wing", "engine"];
export const ZONE_NAMES = { fuselage: "Rumpf", fin: "Seitenleitwerk", stab: "Höhenleitwerk", wing: "Flügel", engine: "Triebwerke" };
export const MAX_ITEMS = 600;

export function whiteLivery() {
  return { v: 2, base: { fuselage: "#ffffff", fin: "#ffffff", stab: "#ffffff", wing: "#ffffff", engine: "#ffffff" }, items: [] };
}

/** Alte Livery (v1: feste Farbflächen) in das neue Format übertragen. */
export function normalizeLivery(lv) {
  if (lv && lv.v === 2) return lv;
  const out = whiteLivery();
  if (!lv) return out;
  out.base.fuselage = lv.body || "#ffffff";
  out.base.fin = lv.tail || "#ffffff";
  out.base.engine = lv.engine || "#ffffff";
  if (lv.belly && lv.belly !== lv.body) out.items.push({ t: "band", z: "fuselage", c: lv.belly, v0: 0.64, v1: 1.01 });
  if (lv.stripe && lv.stripe !== lv.body) out.items.push({ t: "band", z: "fuselage", c: lv.stripe, v0: 0.52, v1: 0.6 });
  if (lv.text) out.items.push({ t: "text", z: "fin", c: lv.logo || "#ffffff", u: 0.62, v: 0.5, s: 0.22, txt: lv.text, b: 1, i: 1 });
  return out;
}

/** Bauteil-Boxen, in die gemalt wird. Triebwerke: jede Gondel eigene Box (alle bekommen dasselbe Motiv). */
export function frames(profile, zone) {
  if (zone === "engine") return (profile.zones.engine || []).map(p => p.box);
  return profile.zoneBox[zone] ? [profile.zoneBox[zone]] : [];
}

export const toUV = (box, x, y) => [(x - box.x0) / (box.x1 - box.x0 || 1), (y - box.y0) / (box.y1 - box.y0 || 1)];
export const fromUV = (box, u, v) => [box.x0 + u * (box.x1 - box.x0), box.y0 + v * (box.y1 - box.y0)];
export const boxH = box => box.y1 - box.y0;

/** Grobe Größe für die Speicherung/Veröffentlichung (Zeichen) */
export const liverySize = lv => JSON.stringify(lv).length;
