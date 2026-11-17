// Kleine Diagramme als SVG. Kein Fremdpaket, keine Canvas-Nachzeichnerei:
// Die Werte sind wenige Dutzend, da ist SVG einfacher zu lesen und skaliert von selbst mit.
//
// Alle Funktionen geben fertiges SVG zurück und erwarten Zahlen, keine Objekte –
// die Aufbereitung bleibt beim Aufrufer.

import { fmt } from "../core/util.js";

const esc = s => String(s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

/** Linie mit Fläche darunter. values = [{ x, y }] oder reine Zahlen. */
export function lineChart(values, { w = 600, h = 160, color = "var(--accent)", fill = true, label = v => fmt.int(v), pad = 24 } = {}) {
  const ys = values.map(v => (typeof v === "number" ? v : v.y));
  if (ys.length < 2) return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg"></svg>`;
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const px = i => pad + i * (w - pad * 2) / (ys.length - 1);
  const py = v => h - pad - (v - min) / span * (h - pad * 2);
  const d = ys.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const area = `${d} L${px(ys.length - 1).toFixed(1)} ${h - pad} L${px(0).toFixed(1)} ${h - pad} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="none">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="ax"/>
    ${fill ? `<path d="${area}" fill="${color}" opacity=".14"/>` : ""}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${px(ys.length - 1).toFixed(1)}" cy="${py(ys[ys.length - 1]).toFixed(1)}" r="3.5" fill="${color}"/>
    <text x="${pad}" y="14" class="cl">${esc(label(max))}</text>
    <text x="${pad}" y="${h - 6}" class="cl">${esc(label(min))}</text>
  </svg>`;
}

/** Säulen, zum Beispiel Tagesverbrauch. values = [{ v, t }] */
export function barChart(values, { w = 600, h = 150, color = "var(--accent)", label = v => fmt.int(v), pad = 24, marks = 0 } = {}) {
  if (!values.length) return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg"></svg>`;
  const vs = values.map(x => (typeof x === "number" ? x : x.v));
  const max = Math.max(...vs, 1);
  const bw = (w - pad * 2) / values.length;
  const bars = vs.map((v, i) => {
    const bh = Math.max(1, v / max * (h - pad * 2));
    return `<rect x="${(pad + i * bw + bw * 0.12).toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}" opacity="${0.55 + 0.45 * (i / values.length)}"/>`;
  }).join("");
  const ticks = marks ? values.map((x, i) => (i % Math.ceil(values.length / marks) === 0 && x.t
    ? `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${h - 6}" class="cl mid">${esc(x.t)}</text>` : "")).join("") : "";
  return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="none">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="ax"/>
    ${bars}${ticks}
    <text x="${pad}" y="14" class="cl">${esc(label(max))}</text>
  </svg>`;
}

/** Waagerechter Anteilsbalken, zum Beispiel Schulden gegen Rahmen. */
export function gaugeBar(parts, { w = 600, h = 26 } = {}) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  let x = 0;
  const segs = parts.map(p => {
    const pw = p.v / total * w;
    const seg = `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0, pw - 2).toFixed(1)}" height="${h}" rx="5" fill="${p.color}"/>`;
    x += pw;
    return seg;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="none" style="height:${h}px">${segs}</svg>`;
}
