// Profil-Werkstatt: Seitenansichten von Blaupausen abpausen und als Profil für das Spiel speichern.
// Gearbeitet wird in Bildpixeln; erst beim Export wird mit dem Maßstab (Nase → Heck = echte Länge) in Meter umgerechnet.

import { AIRCRAFT, AIRCRAFT_BY_ID } from "../js/data/aircraft.js";
import { setTracedProfiles } from "../js/art/geometry.js";
import { renderAircraft } from "../js/art/render.js";
import { pathD, samplePoly } from "../js/art/path.js";
import { bboxOf } from "../js/art/geometry.js";

const PARTS = [
  ["fuselage", "Rumpf", "Kontur einmal rundherum"],
  ["fin", "Seitenleitwerk", "inkl. Rückenflosse"],
  ["stab", "Höhenleitwerk", "nahe Seite"],
  ["wing", "Flügel", "Flügel, Winglet, Pylon – je ein Teil"],
  ["engine", "Triebwerk", "jede Gondel ein Teil"],
  ["cockpit", "Cockpitfenster", "als Fläche"],
  ["windows", "Fensterreihe", "Mitte erstes + letztes Fenster"],
  ["doors", "Türen", "Ecke oben links + unten rechts"]
];
const COLORS = { fuselage: "#4fb3ff", fin: "#ff7a00", stab: "#ffc400", wing: "#a4d233", engine: "#ff4f9a", cockpit: "#ffffff", windows: "#7ef0ff", doors: "#c9a227" };
const TEST_LV = { v: 2, base: { fuselage: "#ffffff", fin: "#0b2a5b", stab: "#ffffff", wing: "#ffffff", engine: "#0b2a5b" }, items: [{ t: "band", z: "fuselage", c: "#0b2a5b", v0: .62, v1: 1.1 }, { t: "band", z: "fuselage", c: "#e0262d", v0: .53, v1: .6 }, { t: "text", z: "fin", c: "#ffffff", u: .6, v: .5, s: .25, txt: "AM", b: 1, i: 1 }] };

const $ = id => document.getElementById(id);
const LS = "am-werkstatt";
const store = load();
let typeId = store.lastType || "a320neo";
let mode = "calib", scale = 1, tx = 0, ty = 0, space = false, drag = null, pending = null;

function load() { try { return JSON.parse(localStorage.getItem(LS)) || { wip: {}, profiles: {} }; } catch { return { wip: {}, profiles: {} }; } }
function persist() { store.lastType = typeId; localStorage.setItem(LS, JSON.stringify(store)); }
const wip = () => (store.wip[typeId] ||= { calib: null, zones: {}, windows: [], doors: [], cockpit: [] });

// ---------- Typauswahl + Teile
$("type").innerHTML = AIRCRAFT.map(t => `<option value="${t.id}">${t.maker} ${t.name}</option>`).join("");
$("type").value = typeId;
$("type").onchange = e => { typeId = e.target.value; pending = null; persist(); refresh(); };
$("parts").innerHTML = PARTS.map(([id, name, hint]) => `<button data-part="${id}">${name}<small>${hint}</small></button>`).join("");
$("parts").onclick = e => { const b = e.target.closest("[data-part]"); if (b) setMode(b.dataset.part); };
$("calib").onclick = () => { wip().calib = null; setMode("calib"); refresh(); };

function setMode(m) { mode = m; pending = null; refresh(); }

// ---------- Bild laden
function showImage(src) {
  $("img").onload = () => { $("drop").hidden = true; const { naturalWidth: w, naturalHeight: h } = $("img"); $("ov").setAttribute("viewBox", `0 0 ${w} ${h}`); $("view").style.width = w + "px"; $("view").style.height = h + "px"; fit(); refresh(); };
  $("img").src = src;
}
$("file").onchange = e => { const f = e.target.files[0]; if (f) showImage(URL.createObjectURL(f)); };
addEventListener("paste", e => { const f = [...e.clipboardData.items].find(i => i.type.startsWith("image/"))?.getAsFile(); if (f) showImage(URL.createObjectURL(f)); });
$("main").addEventListener("dragover", e => e.preventDefault());
$("main").addEventListener("drop", e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) showImage(URL.createObjectURL(f)); });
$("imgop").oninput = e => $("view").style.setProperty("--imgop", e.target.value / 100);

// ---------- Zoom & Verschieben
function applyView() { $("view").style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; }
function fit() {
  const r = $("main").getBoundingClientRect(), w = $("img").naturalWidth || 1, h = $("img").naturalHeight || 1;
  scale = Math.min((r.width - 40) / w, (r.height - 80) / h); tx = (r.width - w * scale) / 2; ty = (r.height - h * scale) / 2; applyView();
}
$("fit").onclick = fit;
$("main").addEventListener("wheel", e => {
  e.preventDefault();
  const r = $("main").getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = Math.exp(-e.deltaY * 0.0015);
  tx = mx - (mx - tx) * k; ty = my - (my - ty) * k; scale *= k; applyView(); refresh();
}, { passive: false });
addEventListener("keydown", e => { if (e.code === "Space" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { space = true; e.preventDefault(); } });
addEventListener("keyup", e => { if (e.code === "Space") space = false; });

const toImg = e => { const r = $("main").getBoundingClientRect(); return [(e.clientX - r.left - tx) / scale, (e.clientY - r.top - ty) / scale]; };

// ---------- Klicken & Ziehen
$("main").addEventListener("pointerdown", e => {
  if (!$("img").src) return;
  if (space || e.button === 1) { drag = { pan: true, x: e.clientX, y: e.clientY, tx, ty }; $("main").setPointerCapture(e.pointerId); return; }
  if (e.button !== 0) return;
  const p = toImg(e), w = wip();
  if (mode === "calib") {
    if (!w.calib || w.calib.t) w.calib = { n: p, t: null };
    else { w.calib.t = p; mode = "fuselage"; }
    persist(); refresh(); return;
  }
  if (mode === "windows" || mode === "doors") {
    if (!pending) pending = p;
    else { (mode === "windows" ? w.windows : w.doors).push(mode === "windows" ? { a: pending, b: p, pitch: 0.53, w: 0.24, h: 0.36 } : { a: pending, b: p }); pending = null; persist(); }
    refresh(); return;
  }
  // Polygon-Teile: vorhandenen Punkt greifen?
  const hit = nearestPoint(p);
  if (hit) {
    if (e.altKey) { hit.pt[2] = hit.pt[2] ? 0 : 1; persist(); refresh(); return; }
    drag = { point: hit.pt }; $("main").setPointerCapture(e.pointerId); return;
  }
  const poly = activePoly(true);
  poly.pts.push([p[0], p[1], 0]);
  persist(); refresh();
});
$("main").addEventListener("pointermove", e => {
  if (!drag) return;
  if (drag.pan) { tx = drag.tx + e.clientX - drag.x; ty = drag.ty + e.clientY - drag.y; applyView(); return; }
  const p = toImg(e); drag.point[0] = p[0]; drag.point[1] = p[1]; refresh(true);
});
$("main").addEventListener("pointerup", () => { if (drag && !drag.pan) { persist(); refresh(); } drag = null; });

addEventListener("keydown", e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === "Backspace") { e.preventDefault(); const poly = activePoly(false); if (poly) { poly.pts.pop(); if (!poly.pts.length) removePoly(poly); } else pending = null; persist(); refresh(); }
  if (e.key === "Enter") { const poly = activePoly(false); if (poly) { poly.done = true; persist(); refresh(); } }
});

function list(zone) { const w = wip(); return zone === "cockpit" ? w.cockpit : (w.zones[zone] ||= []); }
function activePoly(create) {
  if (!PARTS.some(([id]) => id === mode) || mode === "windows" || mode === "doors") return null;
  const l = list(mode), last = l[l.length - 1];
  if (last && !last.done) return last;
  if (!create) return null;
  const poly = { pts: [], done: false }; l.push(poly); return poly;
}
function removePoly(poly) { const l = list(mode), i = l.indexOf(poly); if (i >= 0) l.splice(i, 1); }
function nearestPoint(p) {
  const tol = 9 / scale; let best = null;
  for (const [z] of PARTS) for (const poly of (z === "windows" || z === "doors") ? [] : list(z)) for (const pt of poly.pts) {
    const d = Math.hypot(pt[0] - p[0], pt[1] - p[1]); if (d < tol && (!best || d < best.d)) best = { pt, d };
  }
  return best;
}

// ---------- Umrechnung Pixel → Meter
function frame(w) {
  const t = AIRCRAFT_BY_ID[typeId], { n, t: tl } = w.calib;
  const dx = tl[0] - n[0], dy = tl[1] - n[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const [px, py] = ux >= 0 ? [-uy, ux] : [uy, -ux]; // senkrecht, "unten" im Bild = positiv
  const m = t.art.lengthM / len;
  return ([x, y]) => [((x - n[0]) * ux + (y - n[1]) * uy) * m, ((x - n[0]) * px + (y - n[1]) * py) * m];
}
const r3 = v => Math.round(v * 1000) / 1000;

function toProfile(id = typeId) {
  const w = store.wip[id];
  if (!w?.calib?.t || !(w.zones.fuselage || []).some(p => p.pts.length > 2)) return null;
  const prevType = typeId; typeId = id; const conv = frame(w); typeId = prevType;
  const polys = l => (l || []).filter(p => p.pts.length > 2).map(p => ({ pts: p.pts.map(pt => { const [x, y] = conv(pt); return pt[2] ? [x, y, 1] : [x, y]; }), smooth: true }));
  const zones = {}; for (const z of ["fuselage", "fin", "stab", "wing", "engine"]) zones[z] = polys(w.zones[z]);
  const fb = bboxOf(zones.fuselage.flatMap(p => samplePoly(p.pts, true)));
  const cy = (fb.y0 + fb.y1) / 2, shift = pts => pts.map(p => [r3(p[0]), r3(p[1] - cy), ...(p[2] ? [1] : [])]);
  for (const z in zones) zones[z] = zones[z].map(p => ({ pts: shift(p.pts), smooth: true }));
  const windows = w.windows.map(r => { const a = conv(r.a), b = conv(r.b); return { y: r3((a[1] + b[1]) / 2 - cy), x0: r3(Math.min(a[0], b[0])), x1: r3(Math.max(a[0], b[0])), pitch: r.pitch, w: r.w, h: r.h }; });
  const doors = w.doors.map(d => { const a = conv(d.a), b = conv(d.b); return { x: r3((a[0] + b[0]) / 2), y: r3(Math.min(a[1], b[1]) - cy), w: r3(Math.abs(b[0] - a[0])), h: r3(Math.abs(b[1] - a[1])) }; });
  const cockpit = polys(w.cockpit).map(p => ({ pts: shift(p.pts), smooth: true }));
  return { L: AIRCRAFT_BY_ID[id].art.lengthM, D: r3(fb.y1 - fb.y0), zones, deco: { windows, doors, cockpit }, traced: new Date().toISOString().slice(0, 10) };
}

// ---------- Anzeige
function refresh(fast = false) {
  const w = wip(), sw = 1.5 / scale, out = [];
  if (w.calib) {
    const { n, t } = w.calib;
    out.push(`<circle cx="${n[0]}" cy="${n[1]}" r="${6 / scale}" fill="#ffb000"/>`);
    if (t) out.push(`<circle cx="${t[0]}" cy="${t[1]}" r="${6 / scale}" fill="#ffb000"/><line x1="${n[0]}" y1="${n[1]}" x2="${t[0]}" y2="${t[1]}" stroke="#ffb000" stroke-width="${sw}" stroke-dasharray="${8 / scale}"/>`);
  }
  for (const [z] of PARTS) {
    if (z === "windows") { for (const r of w.windows) out.push(`<line x1="${r.a[0]}" y1="${r.a[1]}" x2="${r.b[0]}" y2="${r.b[1]}" stroke="${COLORS[z]}" stroke-width="${sw * 2}"/>`); continue; }
    if (z === "doors") { for (const d of w.doors) out.push(`<rect x="${Math.min(d.a[0], d.b[0])}" y="${Math.min(d.a[1], d.b[1])}" width="${Math.abs(d.b[0] - d.a[0])}" height="${Math.abs(d.b[1] - d.a[1])}" fill="none" stroke="${COLORS[z]}" stroke-width="${sw}"/>`); continue; }
    for (const poly of list(z)) {
      const c = COLORS[z], active = z === mode && !poly.done;
      if (poly.pts.length > 2) out.push(`<path d="${pathD(poly.pts, true)}" fill="${c}" fill-opacity="${active ? .12 : .22}" stroke="${c}" stroke-width="${sw}"/>`);
      else if (poly.pts.length === 2) out.push(`<line x1="${poly.pts[0][0]}" y1="${poly.pts[0][1]}" x2="${poly.pts[1][0]}" y2="${poly.pts[1][1]}" stroke="${c}" stroke-width="${sw}"/>`);
      if (z === mode || active) for (const pt of poly.pts) out.push(pt[2] ? `<rect x="${pt[0] - 4 / scale}" y="${pt[1] - 4 / scale}" width="${8 / scale}" height="${8 / scale}" fill="${c}" stroke="#000" stroke-width="${1 / scale}"/>` : `<circle cx="${pt[0]}" cy="${pt[1]}" r="${4 / scale}" fill="${c}" stroke="#000" stroke-width="${1 / scale}"/>`);
    }
  }
  if (pending) out.push(`<circle cx="${pending[0]}" cy="${pending[1]}" r="${5 / scale}" fill="${COLORS[mode]}"/>`);
  $("ov").innerHTML = out.join("");
  if (fast) return;

  const t = AIRCRAFT_BY_ID[typeId];
  $("typeinfo").textContent = `Länge ${t.art.lengthM} m · Spannweite ${t.art.spanM} m · ${t.art.engines} Triebwerke`;
  $("calibinfo").textContent = w.calib?.t ? "✓ gesetzt" : w.calib ? "jetzt Heckende klicken" : "";
  document.querySelectorAll("[data-part]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.part === mode)));
  document.querySelectorAll(".step").forEach(s => s.classList.toggle("on", (mode === "calib" && s.dataset.step === "3") || (mode !== "calib" && s.dataset.step === "4")));
  $("mode").textContent = mode === "calib" ? (w.calib && !w.calib.t ? "Maßstab: jetzt hinterste Stelle klicken" : "Maßstab: Nasenspitze klicken") : `${PARTS.find(p => p[0] === mode)[1]} – ${mode === "windows" || mode === "doors" ? (pending ? "zweiten Punkt klicken" : "ersten Punkt klicken") : "Punkte setzen, Enter = Teil fertig"}`;
  $("partlist").innerHTML = PARTS.map(([z, name]) => {
    const n = z === "windows" ? w.windows.length : z === "doors" ? w.doors.length : list(z).filter(p => p.pts.length).length;
    return n ? `<div class="row"><span class="grow" style="color:${COLORS[z]}">${name}: ${n}</span><button class="btn sm" data-del="${z}">letztes löschen</button></div>` : "";
  }).join("");
  // Vorschau
  const prof = toProfile();
  setTracedProfiles({ ...store.profiles, ...(prof ? { [typeId]: prof } : {}) });
  $("preview").innerHTML = renderAircraft(typeId, $("testlv").checked ? TEST_LV : null, { fit: true });
  const done = Object.keys({ ...store.profiles, ...Object.fromEntries(Object.keys(store.wip).filter(id => toProfile(id)).map(id => [id, 1])) });
  $("stored").textContent = done.length ? `Abgepaust: ${done.map(id => AIRCRAFT_BY_ID[id]?.name || id).join(", ")}` : "Noch kein Typ abgepaust.";
}
$("partlist").onclick = e => {
  const z = e.target.closest("[data-del]")?.dataset.del; if (!z) return;
  const w = wip(); (z === "windows" ? w.windows : z === "doors" ? w.doors : list(z)).pop(); persist(); refresh();
};
$("testlv").onchange = () => refresh();

// ---------- Speichern
$("download").onclick = () => {
  const all = { ...store.profiles };
  for (const id of Object.keys(store.wip)) { const p = toProfile(id); if (p) all[id] = p; }
  const blob = new Blob([JSON.stringify(all, null, 1)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "profiles.json" });
  a.click();
};
$("loadjson").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { Object.assign(store.profiles, JSON.parse(await f.text())); persist(); refresh(); } catch { alert("Datei ist kein gültiges profiles.json"); }
};
$("clear").onclick = () => { if (confirm("Abgepauste Punkte für diesen Typ löschen?")) { delete store.wip[typeId]; delete store.profiles[typeId]; persist(); refresh(); } };

// Vorhandene Profile aus dem Spiel übernehmen
fetch("../data/profiles.json", { cache: "no-cache" }).then(r => r.json()).then(p => { store.profiles = { ...p, ...store.profiles }; refresh(); }).catch(() => {});
setMode(wip().calib?.t ? "fuselage" : "calib");
addEventListener("resize", () => $("img").src && fit());
