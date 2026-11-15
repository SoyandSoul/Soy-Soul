// Zeichnet ein Flugzeug im Zeichentrick-Look: weiche Konturen, kräftige Umrisslinie, Glanzverlauf, dunkle Fenster.
// Die Lackierung (Livery) wird pro Bauteil in die Bauteil-Box gerechnet und auf die Kontur zugeschnitten.

import { getProfile } from "./geometry.js";
import { pathD, strokeD } from "./path.js";
import { normalizeLivery, frames, fromUV, boxH, ZONES } from "./livery.js";

let seq = 0;
const UNIFORM_W = 82, UNIFORM_H = 28; // einheitlicher Maßstab in Metern: Größenvergleich zwischen Typen stimmt

/**
 * @param typeOrId  Flugzeugtyp oder ID
 * @param livery    Livery (v1 oder v2) – leer = komplett weiß
 * @param opts      { fit: Flugzeug füllt die Fläche, prefix, outline: px, shadow: bool, overlay: zusätzliches SVG }
 */
export function renderAircraft(typeOrId, livery, opts = {}) {
  const p = getProfile(typeOrId), lv = normalizeLivery(livery);
  const id = opts.prefix || "ac" + (++seq);
  const ow = opts.outline ?? 1.2;
  const bb = p.bbox;

  const defs = [], body = [];
  // Clip-Pfade pro Bauteil (Triebwerke einzeln)
  for (const z of ZONES) {
    const polys = p.zones[z] || [];
    if (z === "engine") polys.forEach((poly, i) => defs.push(`<clipPath id="${id}-engine-${i}"><path d="${pathD(poly.pts, poly.smooth)}"/></clipPath>`));
    else if (polys.length) defs.push(`<clipPath id="${id}-${z}">${polys.map(poly => `<path d="${pathD(poly.pts, poly.smooth)}"/>`).join("")}</clipPath>`);
  }
  defs.push(`<linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".28" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0b1a33" stop-opacity=".22"/></linearGradient>`);
  defs.push(`<linearGradient id="${id}-eng" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#0b1a33" stop-opacity=".3"/></linearGradient>`);

  const outline = (polys, extra = "") => polys.map(poly => `<path d="${pathD(poly.pts, poly.smooth)}" fill="none" stroke="#1b2230" stroke-opacity=".75" stroke-width="${ow}" stroke-linejoin="round" vector-effect="non-scaling-stroke" ${extra}/>`).join("");

  if (opts.shadow !== false) body.push(`<ellipse cx="${(bb.x0 + bb.x1) / 2}" cy="${bb.y1 + 1.6}" rx="${(bb.x1 - bb.x0) * 0.42}" ry="${0.45}" fill="#000" opacity=".22"/>`);

  // Malreihenfolge: Leitwerk (hinter dem Rumpf), Rumpf + Deko, Höhenleitwerk, Flügel, Triebwerke
  body.push(zoneLayer(p, lv, "fin", id), outline(p.zones.fin));
  body.push(zoneLayer(p, lv, "fuselage", id));
  body.push(deco(p, id));
  body.push(`<rect x="${bb.x0 - 1}" y="${p.zoneBox.fuselage.y0}" width="${bb.x1 - bb.x0 + 2}" height="${boxH(p.zoneBox.fuselage)}" fill="url(#${id}-sheen)" clip-path="url(#${id}-fuselage)"/>`);
  body.push(outline(p.zones.fuselage));
  body.push(zoneLayer(p, lv, "stab", id), outline(p.zones.stab));
  body.push(zoneLayer(p, lv, "wing", id), `<g clip-path="url(#${id}-wing)"><rect x="${bb.x0}" y="${bb.y0}" width="${bb.x1 - bb.x0}" height="${bb.y1 - bb.y0}" fill="#0b1a33" opacity=".07"/></g>`, outline(p.zones.wing));
  (p.zones.engine || []).forEach((poly, i) => {
    body.push(zoneLayer(p, lv, "engine", id, i));
    const b = poly.box, h = b.y1 - b.y0;
    body.push(`<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${h}" fill="url(#${id}-eng)" clip-path="url(#${id}-engine-${i})"/>`);
    body.push(`<ellipse cx="${b.x0 + h * 0.06}" cy="${(b.y0 + b.y1) / 2}" rx="${h * 0.07}" ry="${h * 0.4}" fill="#1b2230" opacity=".85"/>`);
    body.push(outline([poly]));
  });
  if (opts.overlay) body.push(opts.overlay);

  const vb = opts.fit
    ? `${bb.x0 - 1} ${bb.y0 - 1} ${bb.x1 - bb.x0 + 2} ${bb.y1 - bb.y0 + 3}`
    : `${(bb.x0 + bb.x1) / 2 - UNIFORM_W / 2} ${bb.y1 + 2.4 - UNIFORM_H} ${UNIFORM_W} ${UNIFORM_H}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${esc(opts.label || p.id)}" data-type="${p.id}"><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
}

/** Ein Bauteil: Grundfarbe + alle Livery-Elemente dieses Bauteils, auf die Kontur zugeschnitten */
function zoneLayer(p, lv, z, id, engineIdx = null) {
  const fr = frames(p, z);
  const list = z === "engine" ? [[fr[engineIdx], `${id}-engine-${engineIdx}`]] : fr.map(b => [b, `${id}-${z}`]);
  return list.map(([box, clip]) => {
    if (!box) return "";
    const out = [`<rect x="${box.x0 - 1}" y="${box.y0 - 1}" width="${box.x1 - box.x0 + 2}" height="${boxH(box) + 2}" fill="${lv.base[z]}"/>`];
    for (const it of lv.items) if (it.z === z) out.push(item(it, box, lv.base[z]));
    return `<g clip-path="url(#${clip})">${out.join("")}</g>`;
  }).join("");
}

export function item(it, box, baseColor) {
  const h = boxH(box);
  switch (it.t) {
    case "band": {
      const y0 = box.y0 + it.v0 * h, y1 = box.y0 + it.v1 * h;
      return `<rect x="${box.x0 - 1}" y="${Math.min(y0, y1)}" width="${box.x1 - box.x0 + 2}" height="${Math.abs(y1 - y0)}" fill="${it.c}"/>`;
    }
    case "text": {
      const [x, y] = fromUV(box, it.u, it.v), s = it.s * h;
      const tr = it.i ? ` transform="skewX(-12)" transform-origin="${x} ${y}"` : "";
      return `<text x="${x}" y="${y}" font-size="${s}" font-family="Bricolage, system-ui, sans-serif" font-weight="${it.b ? 800 : 500}" fill="${it.c}" text-anchor="middle" dominant-baseline="central"${tr}>${esc(it.txt)}</text>`;
    }
    default: {
      const pts = it.p.map(([u, v]) => fromUV(box, u, v));
      const col = it.t === "erase" ? baseColor : it.c;
      return `<path d="${strokeD(pts)}" fill="none" stroke="${col}" stroke-width="${it.w * h}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
}

function deco(p) {
  const out = [];
  for (const r of p.deco.windows || []) {
    for (let x = r.x0; x <= r.x1; x += r.pitch) out.push(`<rect x="${(x - r.w / 2).toFixed(2)}" y="${(r.y - r.h / 2).toFixed(2)}" width="${r.w}" height="${r.h}" rx="${r.w / 2}"/>`);
  }
  const win = `<g fill="#1b2a3f" opacity=".9">${out.join("")}</g>`;
  const doors = (p.deco.doors || []).map(d => `<rect x="${d.x - d.w / 2}" y="${d.y}" width="${d.w}" height="${d.h}" rx="${d.w * 0.3}" fill="none" stroke="#1b2230" stroke-opacity=".35" stroke-width=".7" vector-effect="non-scaling-stroke"/>`).join("");
  const ck = (p.deco.cockpit || []).map(c => `<path d="${pathD(c.pts, c.smooth)}" fill="#14202f"/>`).join("");
  return win + doors + ck;
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
