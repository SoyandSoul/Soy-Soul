// Einheitliche Flugzeug-Grafiken.
// Jeder Typ wird aus seinen echten Maßen gezeichnet (Länge, Spannweite, Rumpfhöhe, Triebwerke, Besonderheiten).
// Alle Typen teilen dieselbe Zeichnung und dieselben Livery-Flächen → eine Livery passt auf jedes Flugzeug.
//
// Echte Herstellerzeichnungen einbinden: tools/dxf_to_svg.py erzeugt aus den Airbus-/Boeing-DXF-Dateien
// Umriss-Pfade. Liegt für einen Typ eine Datei in assets/outlines/<id>.json, kann sideView() später diese
// Umrisse statt der parametrischen Form nutzen (Livery-Flächen bleiben gleich).

import { AIRCRAFT_BY_ID } from "../data/aircraft.js";

const FUSE_D = { narrow: 4.0, wide: 5.8, jumbo: 6.6 };
const TAIL_H = { narrow: 6.3, wide: 9.2, jumbo: 10.6 };
const NAC = { narrow: [4.6, 2.1], wide: [7.0, 3.4], jumbo: [6.4, 3.0] };
const VIEW_W = 82, VIEW_H = 26; // einheitlicher Maßstab in Metern: alle Bilder sind vergleichbar groß

let n = 0;

/**
 * Seitenansicht als SVG-String.
 * opts.fit = true: Flugzeug füllt die Breite (für kleine Kacheln); sonst einheitlicher Maßstab.
 */
export function sideView(typeOrId, livery, opts = {}) {
  const t = typeof typeOrId === "string" ? AIRCRAFT_BY_ID[typeOrId] : typeOrId;
  const a = t.art, L = a.lengthM, size = a.deck2 ? "jumbo" : t.size;
  const D = a.deck2 ? 8.4 : FUSE_D[size], tailH = TAIL_H[size];
  const hump = a.hump ? 2.4 * a.hump : 0;
  const id = "ac" + (++n);
  const lv = { body: "#ffffff", belly: "#d9dde3", tail: "#1f4fd8", stripe: "#1f4fd8", engine: "#c8ced6", logo: "#ffffff", text: "", ...livery };

  const top = -D / 2, bot = D / 2;
  const x = f => (f * L).toFixed(2);
  // Rumpf-Umriss (Nase links)
  let topPath;
  if (hump) {
    topPath = `C0,${top * 0.6} ${x(0.02)},${top - hump * 0.7} ${x(0.07)},${top - hump} L${x(0.30)},${top - hump} C${x(0.36)},${top - hump} ${x(0.38)},${top} ${x(0.44)},${top}`;
  } else {
    topPath = `C0,${top * 0.55} ${x(0.025)},${top} ${x(0.075)},${top}`;
  }
  const fuse = `M0,${(D * 0.08).toFixed(2)} ${topPath} L${x(0.80)},${top} C${x(0.9)},${top} ${x(0.97)},${(top * 0.75).toFixed(2)} ${x(1)},${(top * 0.55).toFixed(2)} L${x(1)},${(top * 0.3).toFixed(2)} C${x(0.9)},${(bot * 0.35).toFixed(2)} ${x(0.8)},${bot} ${x(0.7)},${bot} L${x(0.09)},${bot} C${x(0.03)},${bot} 0,${(D * 0.3).toFixed(2)} 0,${(D * 0.08).toFixed(2)} Z`;

  // Seitenleitwerk
  const fin = `M${x(0.79)},${top + 0.3} L${x(0.885)},${top - tailH} L${x(0.945)},${top - tailH} L${x(0.99)},${(top * 0.55).toFixed(2)} Z`;
  // Höhenleitwerk
  const stab = `M${x(0.86)},${(top * 0.3).toFixed(2)} L${x(0.955)},${(top * 0.55).toFixed(2)} L${x(0.985)},${(top * 0.48).toFixed(2)} L${x(0.9)},${(top * 0.05).toFixed(2)} Z`;
  // Flügel (in Seitenansicht flach, nach hinten versetzt)
  const wy = bot * 0.55, wingTipX = 0.38 + (a.spanM / L) * 0.24;
  const wing = `M${x(0.33)},${wy} L${x(0.55)},${wy - 0.3} L${x(Math.min(0.74, wingTipX))},${wy + 0.15} L${x(0.37)},${wy + 1.1} Z`;
  // Triebwerke
  const [nl, nd] = NAC[size];
  const eng = [];
  const engines = a.engines === 4 ? [[0.30, 0.55], [0.43, 0.25]] : [[0.34, 0.6]];
  for (const [fx, drop] of engines.reverse()) {
    const ex = fx * L, ey = bot + nd * drop - nd / 2;
    eng.push(`<rect x="${ex.toFixed(2)}" y="${ey.toFixed(2)}" width="${nl}" height="${nd}" rx="${nd / 2}" fill="${lv.engine}" stroke="rgba(0,0,0,.25)" stroke-width=".08"/>`,
      `<rect x="${(ex + 0.15).toFixed(2)}" y="${(ey + nd * 0.15).toFixed(2)}" width=".35" height="${(nd * 0.7).toFixed(2)}" rx=".17" fill="#2a2f38"/>`,
      `<path d="M${(ex + nl * 0.55).toFixed(2)},${ey} L${(ex + nl * 0.8).toFixed(2)},${wy + 0.4} L${(ex + nl * 1.0).toFixed(2)},${wy + 0.4} L${(ex + nl).toFixed(2)},${ey + nd * 0.3} Z" fill="#9aa1ac"/>`);
  }

  // Fenster
  const win = [];
  const wyRow = a.deck2 ? [-D * 0.27, D * 0.06] : [-D * 0.12];
  for (const ry of wyRow) for (let px = L * 0.11; px < L * 0.77; px += 0.55) win.push(`<circle cx="${px.toFixed(2)}" cy="${ry.toFixed(2)}" r=".17"/>`);
  if (hump) for (let px = L * 0.09; px < L * 0.30; px += 0.55) win.push(`<circle cx="${px.toFixed(2)}" cy="${(top - hump * 0.45).toFixed(2)}" r=".17"/>`);
  // Türen
  const doors = [0.09, 0.36, 0.76].map(f => `<rect x="${x(f)}" y="${(top * 0.55).toFixed(2)}" width="1" height="${(D * 0.48).toFixed(2)}" rx=".25" fill="none" stroke="rgba(0,0,0,.28)" stroke-width=".07"/>`);
  // Cockpit
  const ck = `M${x(0.022)},${(top * 0.35).toFixed(2)} L${x(0.05)},${(top * (hump ? 0.6 : 0.55)).toFixed(2)} L${x(0.058)},${(top * 0.32).toFixed(2)} Z`;

  const minY = top - Math.max(tailH, hump) - 0.8, h = bot + 3.6 - minY;
  const vb = opts.fit ? `-1 ${minY.toFixed(2)} ${(L + 2).toFixed(2)} ${h.toFixed(2)}` : `${((L - VIEW_W) / 2).toFixed(2)} ${(bot + 3.6 - VIEW_H).toFixed(2)} ${VIEW_W} ${VIEW_H}`;
  const finText = lv.text ? `<text x="${x(0.905)}" y="${(top - tailH * 0.42).toFixed(2)}" font-size="${(tailH * 0.32).toFixed(2)}" font-family="Bricolage, sans-serif" font-weight="800" fill="${lv.logo}" text-anchor="middle" transform="skewX(-12)" transform-origin="${x(0.905)} ${(top - tailH * 0.42).toFixed(2)}">${esc(lv.text.slice(0, 3))}</text>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(t.name)}">
  <defs><clipPath id="${id}c"><path d="${fuse}"/></clipPath>
  <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>
  <ellipse cx="${x(0.5)}" cy="${(bot + 3.1).toFixed(2)}" rx="${(L * 0.45).toFixed(2)}" ry=".45" fill="#000" opacity=".25"/>
  <path d="${stab}" fill="${lv.tail}" opacity=".85"/>
  <path d="${fin}" fill="${lv.tail}"/>
  ${finText}
  <g clip-path="url(#${id}c)">
    <rect x="-1" y="${top - hump - 1}" width="${L + 2}" height="${D + hump + 2}" fill="${lv.body}"/>
    <rect x="-1" y="${(D * 0.14).toFixed(2)}" width="${L + 2}" height="${D}" fill="${lv.belly}"/>
    <rect x="-1" y="${(D * 0.02).toFixed(2)}" width="${L + 2}" height="${(D * 0.09).toFixed(2)}" fill="${lv.stripe}"/>
    <rect x="-1" y="${top - hump - 1}" width="${L + 2}" height="${D + hump + 2}" fill="url(#${id}g)"/>
  </g>
  <path d="${fuse}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".08"/>
  <g fill="#1d2633">${win.join("")}</g>
  ${doors.join("")}
  <path d="${ck}" fill="#141a24"/>
  <path d="${wing}" fill="#aeb5bf" stroke="rgba(0,0,0,.3)" stroke-width=".06"/>
  ${eng.join("")}
</svg>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Draufsicht als weiße Silhouette für die Karte (MapLibre SDF-Icon → einfärbbar).
 * Gibt ImageData zurück. Nase zeigt nach oben (Norden), MapLibre dreht nach Kurs.
 */
export function topViewIcon(kind = "narrow", px = 64) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(px, px) : Object.assign(document.createElement("canvas"), { width: px, height: px });
  const g = c.getContext("2d"), s = px / 64;
  g.scale(s, s);
  g.fillStyle = "#fff";
  const w = kind === "jumbo" ? 30 : kind === "wide" ? 28 : 25, fw = kind === "narrow" ? 3.2 : 4;
  g.beginPath(); // Rumpf
  g.ellipse(32, 32, fw, 27, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); // Flügel (gepfeilt)
  g.moveTo(32 - fw, 26); g.lineTo(32 - w, 37); g.lineTo(32 - w, 40); g.lineTo(32 - fw, 35);
  g.lineTo(32 + fw, 35); g.lineTo(32 + w, 40); g.lineTo(32 + w, 37); g.lineTo(32 + fw, 26); g.closePath(); g.fill();
  g.beginPath(); // Höhenleitwerk
  g.moveTo(32 - 2, 52); g.lineTo(32 - 10, 58); g.lineTo(32 - 10, 60); g.lineTo(32, 57.5); g.lineTo(32 + 10, 60); g.lineTo(32 + 10, 58); g.lineTo(32 + 2, 52); g.closePath(); g.fill();
  const eng = kind === "jumbo" ? [-19, -11, 11, 19] : [-12, 12];
  for (const ex of eng) { g.beginPath(); g.roundRect(32 + ex - 1.8, 28 + Math.abs(ex) * 0.2, 3.6, 7, 1.5); g.fill(); }
  return g.getImageData(0, 0, px, px);
}
