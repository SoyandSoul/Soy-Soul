// Bodenbetrieb: wo genau ein Flugzeug am Flughafen steht, rollt oder abhebt.
//
// Das ist reine Geometrie für die Karte und greift nicht in die Abrechnung ein – ein Flug kostet
// und bringt dasselbe, egal ob jemand zusieht. Aus den Bahnrichtungen (data/runways.js) und der
// Flughafenposition wird ein Schema gebaut: Bahn(en), eine Vorfeldlinie davor, Gatepositionen
// darauf und ein Rollweg vom Gate zur Bahnschwelle.
//
// Zeitlich hängt alles am geplanten Abflug: In den letzten Minuten davor rollt das Flugzeug,
// bei Abflug beschleunigt es auf der Bahn, nach der Landung rollt es zum Gate zurück.
// Weil ac.ops.dep fest steht, ist auch das wieder für jeden Blick dasselbe.

import { GROUND } from "../core/config.js";
import { runwaysFor } from "../data/runways.js";

const R = 6371000;
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

/** Punkt in Metern von einem Ausgangspunkt aus versetzen (Richtung in Grad rechtweisend). */
export function offset(lat, lon, meters, headingDeg) {
  const d = meters / R, h = rad(headingDeg), la = rad(lat);
  const lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(h));
  const lon2 = rad(lon) + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
  return [deg(lon2), deg(lat2)];
}

const lerpPt = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

/**
 * Schema eines Flughafens: Bahnen, Vorfeld und Gates – alles als Koordinatenlisten.
 * Die Länge der Bahn kommt aus der Flughafendatenbank, die Richtung aus data/runways.js.
 */
export function layout(ap) {
  const cfg = runwaysFor(ap);
  const len = Math.max(1800, ap.runwayM || 2500);
  const main0 = cfg.hdg[0];
  const runways = cfg.hdg.map((hdg, i) => {
    // Parallele Bahnen quer zur Bahnrichtung nebeneinander,
    // querende Bahnen zusätzlich längs versetzt – sonst kreuzen sich alle im selben Punkt.
    const isParallel = Math.abs(((hdg - main0 + 540) % 360) - 180) < 20 || Math.abs(((hdg - main0 + 720) % 360)) < 20;
    const parallel = cfg.hdg.filter((h, j) => j < i && (Math.abs(((h - hdg + 540) % 360) - 180) < 20 || Math.abs((h - hdg + 720) % 360) < 20)).length;
    const shift = parallel ? (parallel % 2 ? 1 : -1) * Math.ceil(parallel / 2) * (cfg.sep || 1200) : 0;
    let mid = shift ? offset(ap.lat, ap.lon, Math.abs(shift), hdg + (shift > 0 ? 90 : -90)) : [ap.lon, ap.lat];
    if (!isParallel) {
      const cross = cfg.hdg.filter((h, j) => j < i && !(Math.abs(((h - main0 + 540) % 360) - 180) < 20 || Math.abs((h - main0 + 720) % 360) < 20)).length;
      const along = (cross % 2 ? 1 : -1) * (len * 0.45);
      mid = offset(ap.lat, ap.lon, Math.abs(along), main0 + (along > 0 ? 0 : 180));
    }
    const a = offset(mid[1], mid[0], len / 2, hdg + 180);
    const b = offset(mid[1], mid[0], len / 2, hdg);
    return { hdg, from: a, to: b, mid, len };
  });
  // Vorfeld parallel zur Hauptbahn, in Richtung `apron` versetzt
  const main = runways[0];
  const apronDist = (cfg.sep || 900) * 0.55 + 450;
  const ac = offset(ap.lat, ap.lon, apronDist, cfg.apron ?? (main.hdg + 90));
  const apron = [
    offset(ac[1], ac[0], len * 0.3, main.hdg + 180),
    offset(ac[1], ac[0], len * 0.3, main.hdg)
  ];
  const gates = [];
  for (let i = 0; i < GROUND.gates; i++) gates.push(lerpPt(apron[0], apron[1], (i + 0.5) / GROUND.gates));
  // Rollweg: vom Vorfeld quer zur Bahn, dann an die Schwelle
  const holdPoint = offset(main.from[1], main.from[0], 120, main.hdg);
  return { runways, apron, gates, hold: holdPoint, cfg, len, guessed: !!cfg.guessed };
}

/** Gate-Nummer eines Flugzeugs – stabil, damit es nicht bei jedem Blick springt. */
export function gateIndex(acId) {
  let h = 2166136261;
  for (const c of String(acId)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % GROUND.gates;
}

/**
 * Position am Boden zum Zeitpunkt ts.
 *   phase "gate"   – steht am Gate
 *   phase "taxi"   – rollt zur Bahn (vor dem Abflug) oder zum Gate (nach der Landung)
 *   phase "roll"   – Startlauf auf der Bahn
 * dep = geplanter Abflug, arr = Zeitpunkt der Landung (oder null, wenn gerade erst abgestellt).
 */
export function groundPosition(ap, acId, ts, { dep = null, arr = null } = {}) {
  const l = layout(ap);
  const gate = l.gates[gateIndex(acId)];
  const taxiMs = GROUND.taxiMin * 60_000, rollMs = GROUND.rollSec * 1000;
  const main = l.runways[0];

  // Nach der Landung: von der Bahn zum Gate
  if (arr != null && ts >= arr && ts < arr + taxiMs) {
    const f = (ts - arr) / taxiMs;
    const p = path([main.to, l.hold, gate], f);
    return { ...p, phase: "taxi", gate };
  }
  if (dep != null) {
    const out = dep - taxiMs;
    if (ts >= out && ts < dep) {
      const f = (ts - out) / taxiMs;
      const p = path([gate, l.hold, main.from], f);
      return { ...p, phase: "taxi", gate };
    }
    if (ts >= dep && ts < dep + rollMs) {
      const f = (ts - dep) / rollMs;
      const p = path([main.from, main.to], Math.pow(f, 1.6));   // beschleunigt
      return { ...p, phase: "roll", gate, speed: Math.round(f * 160) };
    }
  }
  return { lon: gate[0], lat: gate[1], heading: (main.hdg + 90) % 360, phase: "gate", gate };
}

/** Punkt auf einem Linienzug bei Fortschritt f (0..1), mit Kurs in Bewegungsrichtung. */
function path(points, f) {
  const segs = [];
  let total = 0;
  const k = Math.cos(rad(points[0][1]));
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot((points[i][0] - points[i - 1][0]) * k, points[i][1] - points[i - 1][1]);
    segs.push(d); total += d;
  }
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (want <= segs[i] || i === segs.length - 1) {
      const t = segs[i] ? want / segs[i] : 0;
      const p = lerpPt(points[i], points[i + 1], Math.min(1, t));
      // Längengrade sind in unseren Breiten kürzer als Breitengrade – ohne diese Korrektur
      // zeigt der Kurs auf der Karte schief an der Bahn vorbei.
      const k = Math.cos(rad(p[1]));
      const dx = (points[i + 1][0] - points[i][0]) * k, dy = points[i + 1][1] - points[i][1];
      return { lon: p[0], lat: p[1], heading: (deg(Math.atan2(dx, dy)) + 360) % 360 };
    }
    want -= segs[i];
  }
  const last = points[points.length - 1];
  return { lon: last[0], lat: last[1], heading: 0 };
}
