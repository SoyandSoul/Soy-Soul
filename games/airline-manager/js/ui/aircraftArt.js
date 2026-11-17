// Flugzeug-Grafiken für die UI.
// Seitenansicht: js/art/render.js (Profile aus js/art/geometry.js, Livery aus js/art/livery.js).
// Draufsicht: einfaches Karten-Icon unten.

import { renderAircraft } from "../art/render.js";
import { AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { PHOTOS } from "../data/photos.js";
import { GAME } from "../core/config.js";

const UNIFORM_W = 82, UNIFORM_H = 28; // gleicher Maßstab wie in art/render.js – Größenvergleich stimmt
const CENTRE = 0.78;                  // so weit unten im Bild liegt die Rumpfmitte (Leitwerk braucht oben Platz)

/** Fotomodus für diesen Typ? Nur wenn eingeschaltet und ein Seitenriss vorliegt. */
export const hasPhoto = id => GAME.art === "foto" && !!PHOTOS[typeof id === "string" ? id : id.id];

/**
 * Seitenriss als Bild, in denselben Meter-Koordinaten wie die gezeichnete Fassung,
 * damit Flächen, Maßstab und Beschnitt in der Oberfläche gleich bleiben.
 */
function photoView(t, opts) {
  const [pw, ph] = PHOTOS[t.id];
  const w = t.art.lengthM, h = w * ph / pw;
  const y0 = -h * CENTRE, y1 = h * (1 - CENTRE);
  const vb = opts.fit
    ? `${-1} ${y0 - 1} ${w + 2} ${h + 3}`
    : `${w / 2 - UNIFORM_W / 2} ${y1 + 2.4 - UNIFORM_H} ${UNIFORM_W} ${UNIFORM_H}`;
  // Kein Bodenschatten: Auf den Seitenrissen ist das Fahrwerk eingefahren, das Flugzeug ist in der Luft.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(opts.label || t.name)}" data-type="${t.id}">`
    + `<image href="img/aircraft/${t.id}.png" x="0" y="${y0}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></svg>`;
}

/** Seitenansicht als SVG-String. opts.fit = true: füllt die Fläche; sonst einheitlicher Maßstab. */
export function sideView(type, livery, opts = {}) {
  const t = typeof type === "string" ? AIRCRAFT_BY_ID[type] : type;
  const o = { label: t?.name ?? String(type), ...opts };
  return t && hasPhoto(t.id) ? photoView(t, o) : renderAircraft(type, livery, o);
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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
