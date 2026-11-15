// Kabinenplan: Draufsicht der Kabine mit allen Sitzen, Klassengrenzen lassen sich ziehen.
// Logik: Jede Klasse belegt "Sitzeinheiten" (First 5, Business 3, Premium 1,35, Economy 1) aus dem Budget des Typs (seatsMax).
// Ändert man eine Premium-Klasse, passt Economy sich an, damit die Kabine gleich voll bleibt.

import { CABIN } from "../core/config.js";

const ORDER = ["f", "j", "w", "y"];
const COL = { f: "#c9a227", j: "#4f7cff", w: "#2bb6a8", y: "#8a94a6" };

export function abreast(t, c) {
  const wide = t.size !== "narrow", jumbo = t.size === "jumbo";
  return { f: 4, j: wide ? 4 : 4, w: wide ? 8 : 6, y: jumbo ? 10 : wide ? 9 : 6 }[c];
}
const units = cfg => ORDER.reduce((s, c) => s + (cfg[c] || 0) * CABIN.units[c], 0);

/** Wert einer Klasse setzen; Economy (bzw. bei Economy-Änderung nichts) gleicht aus, Ziel = bisher belegte Einheiten */
export function setClass(cfg, cls, value, t) {
  const out = { ...cfg }, budget = t.seatsMax;
  const target = Math.min(budget, Math.max(units(cfg), 1));
  out[cls] = Math.max(0, Math.round(value));
  if (cls !== "y") {
    const others = ORDER.filter(c => c !== "y").reduce((s, c) => s + (out[c] || 0) * CABIN.units[c], 0);
    if (others > budget) out[cls] = Math.floor((budget - (others - out[cls] * CABIN.units[cls])) / CABIN.units[cls]);
    const used = ORDER.filter(c => c !== "y").reduce((s, c) => s + (out[c] || 0) * CABIN.units[c], 0);
    out.y = Math.max(0, Math.floor(target - used));
  } else {
    const rest = budget - (units(out) - out.y);
    out.y = Math.min(out.y, Math.floor(rest));
  }
  return out;
}

/** Klassengrenze verschieben: Einheiten wandern zwischen den Klassen links und rechts der Grenze.
 *  Ist die direkte Nachbarklasse leer, wird die nächste belegte Klasse in Zugrichtung genommen. */
export function moveBoundary(cfg, left, right, du, t) {
  const out = { ...cfg }, U = CABIN.units;
  let li = ORDER.indexOf(left), ri = ORDER.indexOf(right);
  if (du > 0) while (ri < ORDER.length - 1 && !(out[ORDER[ri]] > 0)) ri++;
  else while (li > 0 && !(out[ORDER[li]] > 0)) li--;
  const L = ORDER[li], R = ORDER[ri];
  const lu = (out[L] || 0) * U[L], ru = (out[R] || 0) * U[R];
  const d = Math.max(-lu, Math.min(ru, du));
  out[L] = Math.max(0, Math.round((lu + d) / U[L]));
  const moved = out[L] * U[L] - lu;            // tatsächlich gewanderte Einheiten (auf ganze Sitze gerundet)
  out[R] = Math.max(0, Math.floor((ru - moved) / U[R]));
  if (units(out) > t.seatsMax) out[R] = Math.max(0, out[R] - Math.ceil((units(out) - t.seatsMax) / U[R]));
  return out;
}

const W = 760, H = 120, NOSE = 46, TAIL = 40;

/** SVG-Kabinenplan. Grenzen haben data-bound="links,rechts" zum Ziehen. */
export function seatmapSVG(cfg, t) {
  const budget = t.seatsMax, inner = W - NOSE - TAIL, scale = inner / budget;
  const out = [`<svg viewBox="0 0 ${W} ${H}" class="seatmap" data-scale="${scale}">`,
    `<path d="M${NOSE},14 H${W - TAIL} q${TAIL},0 ${TAIL},${H / 2 - 14} q0,${H / 2 - 14} -${TAIL},${H / 2 - 14} H${NOSE} C10,${H - 14} 2,${H / 2 + 14} 2,${H / 2} C2,${H / 2 - 14} 10,14 ${NOSE},14 Z" fill="#1c222d" stroke="#3a4352" stroke-width="1.5"/>`];
  let x = NOSE;
  const bounds = [];
  ORDER.forEach((c, i) => {
    const n = cfg[c] || 0, len = n * CABIN.units[c] * scale;
    if (n) {
      const ab = abreast(t, c), rows = Math.ceil(n / ab), pitch = len / rows;
      const aisles = ab >= 9 ? [3, 6] : ab >= 6 ? [ab / 2] : [2];
      const gap = 7, rowsH = H - 36, seatH = (rowsH - gap * aisles.length) / ab;
      out.push(`<rect x="${x}" y="16" width="${len}" height="${H - 32}" fill="${COL[c]}" opacity=".08"/>`);
      let left = n;
      for (let r = 0; r < rows; r++) {
        for (let s = 0; s < ab && left > 0; s++, left--) {
          const off = aisles.filter(a => s >= a).length * gap;
          out.push(`<rect x="${(x + r * pitch + pitch * 0.12).toFixed(1)}" y="${(18 + s * seatH + off).toFixed(1)}" width="${Math.max(1.5, pitch * 0.72).toFixed(1)}" height="${Math.max(1.5, seatH * 0.8).toFixed(1)}" rx="${Math.min(3, pitch * 0.2).toFixed(1)}" fill="${COL[c]}"/>`);
        }
      }
      if (len > 40) out.push(`<text x="${x + len / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="${COL[c]}" font-weight="700">${CABIN.names[c]} · ${n}</text>`);
    }
    x += len;
    if (i < ORDER.length - 1) bounds.push([x, c, ORDER[i + 1]]);
  });
  const free = W - TAIL - x;
  if (free > 2) out.push(`<rect x="${x}" y="16" width="${free}" height="${H - 32}" fill="url(#hatch)" opacity=".5"/><text x="${x + free / 2}" y="${H / 2 + 4}" text-anchor="middle" font-size="11" fill="#6f7888">frei</text>`);
  out.push(`<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="#3a4352"/></pattern></defs>`);
  // Ziehgriffe (letzter oben, damit bei Klassen mit 0 Sitzen der rechte Griff greift)
  for (const [bx, l, r] of bounds) {
    out.push(`<g class="sm-handle" data-bound="${l},${r}" transform="translate(${bx.toFixed(1)},0)"><rect x="-7" y="6" width="14" height="${H - 12}" fill="transparent"/><line y1="10" y2="${H - 10}" stroke="#ffb000" stroke-width="2"/><rect x="-5" y="${H / 2 - 9}" width="10" height="18" rx="4" fill="#ffb000"/></g>`);
  }
  out.push("</svg>");
  return out.join("");
}

export const CLASS_COLORS = COL;
