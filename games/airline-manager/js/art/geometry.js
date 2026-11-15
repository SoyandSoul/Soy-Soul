// Seitenprofil-Geometrie der Flugzeuge (linke Seite, Nase links), in Metern.
// Koordinaten: x = 0 an der Nasenspitze, nach hinten positiv. y = 0 auf der Rumpfmitte, nach UNTEN positiv (SVG).
//
// Zwei Quellen:
//   1. Abgepauste Profile aus der Profil-Werkstatt (tools/profil-werkstatt.html) → data/profiles.json.
//      Diese übernehmen die Form 1:1 von einer Blaupause und haben Vorrang.
//   2. Parametrische Profile aus echten Maßen (Länge, Rumpfhöhe, Leitwerkshöhe, Flügel, Triebwerke) pro Baureihe.
//      Sie sind die Rückfallebene, solange ein Typ noch nicht abgepaust ist.
//
// Ergebnis ist immer dasselbe Format, damit Renderer, Lackiererei und Trefferprüfung nicht wissen müssen, woher es kommt:
//   { id, L, D, zones: { fin, fuselage, stab, wing, engine }, deco: { windows, doors, cockpit }, bbox, source }
//   zone = Liste von Polygonen { pts: [[x, y, ecke?], …], smooth: bool }

import { AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { samplePoly } from "./path.js";

// ---------- Baureihen-Parameter (Meter bzw. Vielfache der Rumpfhöhe D)
// D Rumpfhöhe · nose: Länge (×D), Stumpfheit n, Absenkung der Spitze (×D) · tail: Heckkonuslänge (×D), Höhe der Spitze (×D)
// fin: Höhe über Rumpf, Wurzeltiefe, Spitzentiefe, Pfeilung° · wing: Wurzeltiefe, Spitzentiefe, Pfeilung°, V-Stellung°, Winglet-Typ
// eng: Gondellänge, Durchmesser, Abstand(e) von der Rumpfmitte (m)
const FAM = {
  A220: { D: 3.7, nose: [1.8, 2.3, .09], tail: [2.6, -.24], fin: [5.6, 5.0, 2.4, 38], wing: [5.5, 1.5, 24, 5, null], eng: [3.9, 2.1, [4.9]] },
  A320: { D: 4.14, nose: [1.75, 2.35, .08], tail: [2.6, -.24], fin: [5.9, 5.6, 2.3, 38], wing: [6.1, 1.5, 27, 5, "sharklet"], eng: [4.3, 2.35, [5.75]] },
  737:  { D: 4.01, nose: [2.15, 2.05, .11], tail: [3.0, -.22], fin: [6.6, 6.0, 1.9, 38], wing: [6.5, 1.3, 28, 6, "blended"], eng: [4.0, 2.0, [4.9]], dorsal: 3.8 },
  757:  { D: 4.1, nose: [2.05, 2.15, .11], tail: [2.9, -.22], fin: [7.0, 6.6, 2.2, 38], wing: [8.0, 2.0, 28, 6, null], eng: [5.0, 2.45, [7.3]] },
  767:  { D: 5.41, nose: [1.8, 2.3, .09], tail: [2.6, -.23], fin: [8.1, 8.0, 2.9, 40], wing: [9.0, 2.4, 34, 6, null], eng: [5.0, 2.8, [7.6]] },
  A330: { D: 5.64, nose: [1.75, 2.35, .08], tail: [2.6, -.24], fin: [8.6, 8.8, 3.2, 42], wing: [10.0, 2.5, 33, 6, "fence"], eng: [5.6, 3.0, [9.4]] },
  A340: { D: 5.64, nose: [1.75, 2.35, .08], tail: [2.6, -.24], fin: [8.6, 8.8, 3.2, 42], wing: [10.0, 2.5, 33, 6, "fence"], eng: [4.9, 2.4, [9.9, 19.6]] },
  A350: { D: 6.09, nose: [1.95, 2.2, .06], tail: [2.4, -.25], fin: [9.0, 9.4, 3.4, 40], wing: [11.0, 2.4, 35, 6, "curved"], eng: [6.0, 3.4, [9.5]] },
  A380: { D: 8.41, nose: [1.3, 2.7, .04], tail: [2.0, -.26], fin: [12.0, 15.0, 4.6, 43], wing: [17.0, 4.0, 35, 6, "fence"], eng: [6.0, 3.4, [15.4, 25.7]] },
  777:  { D: 6.2, nose: [1.75, 2.4, .06], tail: [2.6, -.24], fin: [9.2, 10.0, 3.5, 40], wing: [12.0, 2.5, 34, 6, null], eng: [6.4, 3.8, [9.6]] },
  "777X": { D: 6.2, nose: [1.75, 2.4, .06], tail: [2.6, -.24], fin: [9.2, 10.0, 3.5, 40], wing: [12.0, 2.3, 34, 6, null], eng: [6.8, 4.1, [9.8]] },
  787:  { D: 5.91, nose: [1.95, 2.1, .03], tail: [2.5, -.25], fin: [8.8, 9.2, 3.2, 40], wing: [11.0, 2.0, 35, 6, null], eng: [5.8, 3.3, [9.8]] },
  747:  { D: 6.5, nose: [1.6, 2.5, .12], tail: [2.6, -.24], fin: [10.2, 11.5, 4.2, 46], wing: [14.0, 4.0, 40, 7, "blended"], eng: [5.0, 2.7, [11.9, 21.3]] }
};
// Abweichungen einzelner Typen von ihrer Baureihe
const TYPE = {
  "a320ceo": { eng: [4.0, 2.05, [5.75]], wingTip: "fence" },
  "a330-200": {}, "a330-300": {},
  "a330-900": { eng: [6.0, 3.4, [9.4]], wingTip: "sharklet" },
  "b737-700": { eng: [3.9, 1.9, [4.9]] }, "b737-800": { eng: [3.9, 1.9, [4.9]] },
  "b737-max7": { eng: [4.3, 2.1, [4.9]], wingTip: "split" }, "b737-max8": { eng: [4.3, 2.1, [4.9]], wingTip: "split" },
  "b737-max9": { eng: [4.3, 2.1, [4.9]], wingTip: "split" }, "b737-max10": { eng: [4.3, 2.1, [4.9]], wingTip: "split" },
  "b757-200": { wingTip: "blended" }, "b767-300er": { wingTip: "blended" },
  "b747-400": { hump: [2.5, .375] }, "b747-8i": { hump: [2.5, .405], eng: [5.6, 3.1, [11.9, 21.3]], wingTip: null }
};

// ---------- Registry für abgepauste Profile
let traced = {};
export function setTracedProfiles(obj) { traced = obj || {}; cache.clear(); }
export const tracedIds = () => Object.keys(traced);

const cache = new Map();

export function getProfile(typeOrId) {
  const t = typeof typeOrId === "string" ? AIRCRAFT_BY_ID[typeOrId] : typeOrId;
  if (cache.has(t.id)) return cache.get(t.id);
  const p = traced[t.id] ? fromTraced(t, traced[t.id]) : parametric(t);
  finalize(p);
  cache.set(t.id, p);
  return p;
}

// ---------- Abgepaust → Standardformat
function fromTraced(t, tr) {
  const zones = {};
  for (const z of ["fin", "fuselage", "stab", "wing", "engine"]) zones[z] = (tr.zones?.[z] || []).map(poly => ({ pts: poly.pts, smooth: poly.smooth !== false }));
  return { id: t.id, L: tr.L || t.art.lengthM, D: tr.D, zones, deco: tr.deco || { windows: [], doors: [], cockpit: [] }, source: "blueprint" };
}

// ---------- Parametrisch
function parametric(t) {
  const famKey = t.family === "777X" ? "777X" : t.family;
  const f = { ...FAM[famKey], ...(TYPE[t.id] || {}) };
  const L = t.art.lengthM, D = f.D, top = -D / 2, bot = D / 2;
  const [noseK, nExp, drop] = f.nose, nl = noseK * D;
  const [tailK, tipK] = f.tail, tl = tailK * D;
  const tipY = tipK * D, tipH = 0.14 * D;
  const hump = f.hump;

  // Rumpf: Oberseite (Nase → Heck), dann Unterseite zurück
  const upper = [], lower = [];
  const noseY = D * drop;
  const N = 18;
  for (let i = 0; i <= N; i++) { // Nase oben: Superellipse
    const th = (i / N) * Math.PI / 2;
    upper.push([nl * (1 - Math.pow(Math.cos(th), 2 / nExp)), noseY + (top - noseY) * Math.pow(Math.sin(th), 2 / nExp)]);
  }
  if (hump) { // 747: Oberdeck-Buckel
    const [hh, endF] = hump, x0 = nl * 0.55, xEnd = endF * L;
    upper.length = Math.floor(N * 0.55);
    const hTop = top - hh, steps = 14;
    for (let i = 0; i <= steps; i++) { const k = i / steps; upper.push([x0 + (nl * 1.4 - x0) * k, upper[upper.length - 1][1] + (hTop - upper[upper.length - 1][1]) * Math.sin(k * Math.PI / 2) * 0.5]); }
    upper.push([nl * 1.6, hTop], [xEnd - 0.06 * L, hTop]);
    for (let i = 1; i <= steps; i++) { const k = i / steps; upper.push([xEnd - 0.06 * L + k * 0.09 * L, hTop + (top - hTop) * (1 - Math.cos(k * Math.PI)) / 2]); }
  }
  const tailStart = L - tl;
  upper.push([tailStart, top]);
  for (let i = 1; i <= N; i++) { // Heck oben: sanft auf die APU-Spitze
    const k = i / N;
    upper.push([tailStart + tl * k, top + (tipY - tipH / 2 - top) * (1 - Math.cos(k * Math.PI / 2))]);
  }
  const sweepStart = L - tl * 1.35;
  for (let i = 0; i <= N; i++) { // Heck unten: Aufwärtsschwung
    const k = i / N;
    lower.push([L - (L - sweepStart) * k, tipY + tipH / 2 + (bot - tipY - tipH / 2) * Math.pow(Math.sin(k * Math.PI / 2), 1.6)]);
  }
  const nlb = nl * 0.6;
  for (let i = N; i >= 0; i--) { // Nase unten
    const th = (i / N) * Math.PI / 2;
    lower.push([nlb * (1 - Math.cos(th)), noseY + (bot - noseY) * Math.pow(Math.sin(th), 0.85)]);
  }
  const fuselage = [{ pts: [...upper, ...lower], smooth: false }];

  // Seitenleitwerk
  const [fh, fr, ft, fs] = f.fin;
  const finTE = L - 0.035 * L, finLE = finTE - fr, finTop = top - fh;
  const tipLE = finLE + fh * Math.tan(fs * Math.PI / 180);
  const finTopFus = yTopAt(upper, finLE);
  const dl = f.dorsal || 0.8; // Rückenflosse (737 lang, sonst kurzer Übergang)
  const fin = [{ pts: [[finLE - dl, yTopAt(upper, finLE - dl) + 0.25], [finLE + 0.25, finTopFus - (f.dorsal ? 1.1 : 0.5)], [tipLE, finTop], [tipLE + ft, finTop], [finTE + 0.25, yTopAt(upper, finTE) + 0.3]], smooth: false }];

  // Höhenleitwerk (nahe Seite, leicht V-gestellt)
  const sChord = fr * 0.62, sSpan = Math.max(5, t.art.spanM * 0.17), sSweep = sSpan * 0.55;
  const sRoot = L - 0.02 * L - sSweep - sChord * 0.4, sY = tipY * 0.15;
  const stab = [{ pts: [[sRoot, sY], [sRoot + sSweep, sY - sSpan * 0.1], [sRoot + sSweep + sChord * 0.4, sY - sSpan * 0.1 + 0.12], [sRoot + sChord, sY + 0.4]], smooth: false }];

  // Flügel (nahe Seite): Wurzel unten am Rumpf, Spitze höher (V-Stellung) und weiter hinten (Pfeilung)
  const [wr, wt, ws, wd, tipDefault] = f.wing;
  const wingTip = "wingTip" in f ? f.wingTip : tipDefault;
  const half = t.art.spanM / 2 - D / 2;
  const tanS = Math.tan(ws * Math.PI / 180), tanD = Math.tan(wd * Math.PI / 180);
  const wRootLE = 0.43 * L - wr * 0.55, wY = bot * 0.42;
  const wTipLE = wRootLE + half * tanS, wTipY = wY - half * tanD;
  const wing = [{ pts: [[wRootLE, wY], [wTipLE, wTipY], [wTipLE + wt, wTipY + 0.12], [wRootLE + wr, wY + 0.55]], smooth: false }];
  if (wingTip) {
    const h = { sharklet: 2.4, blended: 2.5, split: 2.1, curved: 2.0, fence: 1.1 }[wingTip];
    const back = wingTip === "curved" ? 0.9 : 0.6;
    wing.push({ pts: [[wTipLE + 0.1, wTipY + 0.05], [wTipLE + wt * back, wTipY - h], [wTipLE + wt * back + wt * 0.35, wTipY - h], [wTipLE + wt, wTipY + 0.1]], smooth: false });
    if (wingTip === "split" || wingTip === "fence") wing.push({ pts: [[wTipLE + wt * 0.3, wTipY + 0.1], [wTipLE + wt * 0.7, wTipY + 0.9], [wTipLE + wt, wTipY + 0.9], [wTipLE + wt, wTipY + 0.1]], smooth: false });
  }

  // Triebwerke + Pylone (Pylone gehören zur Flügelzone)
  const [enl, end, spans] = f.eng;
  const engine = [];
  for (const sp of [...spans].reverse()) { // äußeres zuerst (liegt optisch dahinter)
    const s = sp - D / 2;
    const wingYAt = wY - s * tanD, leAt = wRootLE + s * tanS;
    const ex = leAt - enl * 0.62, cy = wingYAt + end * 0.62;
    engine.push({ pts: nacelle(ex, cy, enl, end), smooth: false });
    wing.push({ pts: [[ex + enl * 0.45, cy - end * 0.42], [leAt - 0.2, wingYAt + 0.05], [leAt + wr * 0.45, wingYAt + 0.3], [ex + enl * 0.98, cy - end * 0.28]], smooth: false });
  }

  // Deko: Fenster, Türen, Cockpit
  const rows = [];
  const doorsX = [];
  const winY = t.art.deck2 ? [D * 0.12, -D * 0.25] : [-D * 0.13];
  const x0 = nl * 1.12, x1 = tailStart - D * 0.15;
  for (const y of winY) rows.push({ y, x0, x1, pitch: 0.53, w: 0.24, h: 0.36 });
  if (hump) rows.push({ y: top - hump[0] * 0.45, x0: nl * 1.0, x1: hump[1] * L - 0.08 * L, pitch: 0.53, w: 0.24, h: 0.34 });
  doorsX.push(nl * 0.93, x1 + 0.3);
  if (t.size !== "narrow") doorsX.push(L * 0.33, L * 0.55);
  else if (L > 42) doorsX.push(L * 0.40, L * 0.62);
  const dw = t.size === "narrow" ? 0.82 : 1.05, dh = t.size === "narrow" ? 1.85 : 1.93;
  const doors = doorsX.map(x => ({ x, y: winY[0] - 0.55, w: dw, h: dh }));
  const ck = cockpit(nl, noseY, top, D, t.family);
  return { id: t.id, L, D, zones: { fin, fuselage, stab, wing, engine }, deco: { windows: rows, doors, cockpit: [ck] }, source: "parametric" };
}

function nacelle(x, cy, l, d) {
  const r = d / 2, pts = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI; pts.push([x + r * 0.22 * (1 + Math.cos(a)), cy - r * Math.sin(a)]); } // Einlauflippe
  pts.reverse();
  // pts verläuft von unten nach oben über die Front; jetzt oben nach hinten, Düse, unten zurück
  return [...pts, [x + l * 0.72, cy - r], [x + l, cy - r * 0.62], [x + l * 1.08, cy - r * 0.15], [x + l, cy + r * 0.5], [x + l * 0.72, cy + r * 0.95]];
}

function cockpit(nl, noseY, top, D, fam) {
  const sleek = fam === "787" || fam === "A350";
  const x0 = nl * (sleek ? 0.42 : 0.5), x1 = nl * (sleek ? 0.8 : 0.78);
  const y0 = top + D * (sleek ? 0.2 : 0.24), y1 = top + D * 0.37;
  return { pts: [[x0, y1], [x0 + (x1 - x0) * 0.35, y0], [x1, y0 - D * 0.02], [x1, y1 - D * 0.01]], smooth: false };
}

function yTopAt(upper, x) {
  for (let i = 1; i < upper.length; i++) if (upper[i][0] >= x) {
    const [ax, ay] = upper[i - 1], [bx, by] = upper[i];
    return ay + (by - ay) * ((x - ax) / ((bx - ax) || 1));
  }
  return upper[upper.length - 1][1];
}

/** Bounding-Boxen pro Polygon/Zone + Gesamtbox (inkl. Bodenschatten) */
function finalize(p) {
  p.sampled = {};
  p.zoneBox = {};
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [z, polys] of Object.entries(p.zones)) {
    p.sampled[z] = polys.map(poly => samplePoly(poly.pts, poly.smooth));
    const boxes = p.sampled[z].map(bboxOf);
    polys.forEach((poly, i) => (poly.box = boxes[i]));
    if (boxes.length) {
      const zb = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
      p.zoneBox[z] = zb;
      minX = Math.min(minX, zb.x0); minY = Math.min(minY, zb.y0); maxX = Math.max(maxX, zb.x1); maxY = Math.max(maxY, zb.y1);
    }
  }
  p.bbox = { x0: minX, y0: minY, x1: maxX, y1: maxY };
  // Leitwerks-Box ohne Rückenflosse/Übergang: nur der obere Teil zählt für Logos
  const fb = p.zoneBox.fin;
  if (fb) {
    const lim = fb.y0 + 0.85 * (fb.y1 - fb.y0);
    const xs = p.sampled.fin.flat().filter(([, y]) => y <= lim).map(([x]) => x);
    if (xs.length) p.zoneBox.fin = { ...fb, x0: Math.min(...xs) };
  }
}

export function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/** Welche Zone liegt an Punkt (x, y)? Reihenfolge = was oben gezeichnet ist. Gibt { zone, index } oder null. */
export const HIT_ORDER = ["engine", "wing", "stab", "fuselage", "fin"];
export function hitZone(p, x, y) {
  for (const z of HIT_ORDER) {
    const list = p.sampled[z] || [];
    for (let i = list.length - 1; i >= 0; i--) if (inside(list[i], x, y)) return { zone: z, index: i };
  }
  return null;
}

function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export const FAMILY_PARAMS = FAM;
