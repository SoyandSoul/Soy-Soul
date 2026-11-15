// Flugzeug-Grafiken für die UI.
// Seitenansicht: js/art/render.js (Profile aus js/art/geometry.js, Livery aus js/art/livery.js).
// Draufsicht: einfaches Karten-Icon unten.

import { renderAircraft } from "../art/render.js";

/** Seitenansicht als SVG-String. opts.fit = true: füllt die Fläche; sonst einheitlicher Maßstab. */
export const sideView = (type, livery, opts = {}) => renderAircraft(type, livery, { label: typeof type === "string" ? type : type.name, ...opts });

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
