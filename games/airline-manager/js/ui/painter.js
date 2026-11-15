// Lackiererei (Painter-Modus): eigene Livery auf ein weißes Flugzeug malen. Das Ergebnis gilt für die ganze Flotte.
//
// Werkzeuge: Pinsel, Linie, Band (waagerechte Fläche über das ganze Bauteil, ideal für Bauch und Zierlinien),
// Füllen (ganzes Bauteil), Text (Name, Logo), Radierer. Gemalt wird immer innerhalb des Bauteils, auf dem der Strich
// beginnt – so läuft nichts über die Kontur, und die Livery lässt sich auf jeden Typ übertragen.

import { renderAircraft, item } from "../art/render.js";
import { getProfile, hitZone } from "../art/geometry.js";
import { normalizeLivery, whiteLivery, frames, toUV, boxH, ZONE_NAMES, MAX_ITEMS } from "../art/livery.js";
import { strokeD, simplify } from "../art/path.js";
import { AIRCRAFT, AIRCRAFT_BY_ID } from "../data/aircraft.js";
import { esc } from "./dom.js";
import * as act from "../sim/actions.js";

const TOOLS = [
  ["move", "Auswählen", "V", '<path d="M5 3l14 8-6 2-2 6z"/>', "Text anklicken: ziehen zum Verschieben. Farbe, Größe, Inhalt, Fett/Kursiv ändern den ausgewählten Text. Entf löscht ihn."],
  ["brush", "Pinsel", "B", '<path d="M4 20c2 0 4-1 4-4l9-9 3 3-9 9c-3 0-4 2-4 4"/><path d="M14 6l4 4"/>', "Freihand malen. Bleibt im Bauteil, auf dem du beginnst."],
  ["line", "Linie", "L", '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>', "Gerade Linie ziehen – mit Umschalt waagerecht."],
  ["band", "Band", "G", '<rect x="3" y="9" width="18" height="6" rx="1"/>', "Senkrecht ziehen: farbiges Band über die ganze Länge des Bauteils (Bauch, Zierstreifen)."],
  ["fill", "Füllen", "F", '<path d="M6 11l6-6 7 7-6 6z"/><path d="M19 15s2 2.2 2 3.5a2 2 0 0 1-4 0c0-1.3 2-3.5 2-3.5z"/>', "Ganzes Bauteil in einer Farbe (Rumpf, Leitwerk, Triebwerke …)."],
  ["text", "Text", "T", '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>', "Klicken, um Text zu setzen – z. B. Airline-Name am Rumpf oder Kürzel am Leitwerk."],
  ["erase", "Radierer", "E", '<path d="M8 20h12"/><path d="M4 16l9-9 6 6-5 5H8z"/>', "Übermalt mit der Grundfarbe des Bauteils."]
];
const PALETTE = ["#ffffff", "#e9ecf1", "#b9c0ca", "#5b6472", "#16191f", "#0b2a5b", "#1f4fd8", "#4fb3ff", "#0aa39b", "#1f9d55", "#a4d233", "#ffc400", "#ff7a00", "#e0262d", "#7a1631", "#ff4f9a", "#6b3fa0", "#c9a227"];
const PREVIEWS = ["a220-300", "b737-max8", "a321neo", "b787-9", "a350-900", "b777-9", "b747-8i", "a380-800"];

export function openPainter(ctx) {
  if (document.querySelector(".painter")) return;
  const s = ctx.state;
  let lv = structuredClone(normalizeLivery(s.airline.livery));
  const undo = [], redo = [];
  let dirty = false;
  const ui = {
    tool: "brush", sel: null, color: "#e0262d", size: 0.12, txt: s.airline.name, bold: true, italic: false, zoom: 1,
    type: s.fleet.find(a => a.status !== "crashed")?.typeId || "a320neo"
  };

  const el = document.createElement("div");
  el.className = "painter";
  el.innerHTML = `
    <header class="pt-head">
      <div class="grow"><h2>Lackiererei</h2><span class="muted small">Deine Livery für alle Flugzeuge – gemalt auf <select class="in" data-k="type">${AIRCRAFT.map(t => `<option value="${t.id}" ${t.id === ui.type ? "selected" : ""}>${esc(t.maker + " " + t.name)}</option>`).join("")}</select></span></div>
      <div class="row">
        <button class="btn sm" data-a="undo" title="Rückgängig (Strg+Z)">↶</button><button class="btn sm" data-a="redo" title="Wiederholen (Strg+Y)">↷</button>
        <button class="btn sm" data-a="zoom" title="Zoom">1×</button>
        <button class="btn sm" data-a="white">Alles weiß</button>
        <button class="btn sm" data-a="cancel">Abbrechen</button>
        <button class="btn sm p" data-a="save">Speichern</button>
      </div>
    </header>
    <aside class="pt-tools">
      <div class="pt-toolgrid pt7">${TOOLS.map(([id, label, key, icon]) => `<button data-tool="${id}" title="${label} (${key})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icon}</svg><span>${label}</span></button>`).join("")}</div>
      <p class="small muted" data-k="hint"></p>
      <label class="pt-label">Farbe</label>
      <div class="row"><input type="color" data-k="color" value="${ui.color}"><span class="mono small" data-k="hex">${ui.color}</span></div>
      <div class="pt-palette">${PALETTE.map(c => `<button data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}</div>
      <label class="pt-label">Größe</label>
      <input type="range" min="1" max="60" value="${Math.round(ui.size * 100)}" data-k="size">
      <div data-k="textopts" hidden>
        <div class="row" style="justify-content:space-between"><span class="pt-label">Text</span><button class="btn sm danger" data-a="delsel" title="Ausgewählten Text löschen (Entf)">Löschen</button></div>
        <input class="in" data-k="txt" maxlength="40" value="${esc(ui.txt)}" style="width:100%">
        <div class="row" style="margin-top:6px"><label class="row small"><input type="checkbox" data-k="bold" checked> Fett</label><label class="row small"><input type="checkbox" data-k="italic"> Kursiv</label></div>
      </div>
      <p class="small muted pt-foot">Tipp: Zum Lackieren beginnt jeder Strich in einem Bauteil und bleibt dort. Die Vorschau unten zeigt deine Livery auf anderen Typen.</p>
    </aside>
    <main class="pt-stage" data-k="stage"></main>
    <div class="pt-status small" data-k="status"></div>
    <footer class="pt-previews" data-k="previews"></footer>`;
  document.body.appendChild(el);
  const $ = k => el.querySelector(`[data-k="${k}"]`);

  // ---------- Darstellung
  let svg, profile;
  function draw() {
    profile = getProfile(ui.type);
    $("stage").innerHTML = `<div class="pt-canvas" style="width:${ui.zoom * 100}%">${renderAircraft(ui.type, lv, { fit: true, prefix: "pt", outline: 1.6, shadow: false, interactive: true, overlay: '<g id="pt-live"></g><g id="pt-sel"></g><circle id="pt-cursor" r="0" fill="none" stroke="#ffb000" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>' })}</div>`;
    svg = $("stage").querySelector("svg");
    bindStage();
    drawSelection();
  }
  /** gestrichelter Rahmen um den ausgewählten Text + Textfelder mit seinen Werten füllen */
  function drawSelection() {
    const g = svg.querySelector("#pt-sel"), it = lv.items[ui.sel];
    if (!it || it.t !== "text") { ui.sel = null; g.innerHTML = ""; syncTools(); return; }
    const parts = [...svg.querySelectorAll(`[data-it="${ui.sel}"]`)].map(n => n.getBBox());
    g.innerHTML = parts.map(b => `<rect x="${b.x - 0.25}" y="${b.y - 0.2}" width="${b.width + 0.5}" height="${b.height + 0.4}" fill="none" stroke="#ffb000" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`).join("");
    $("txt").value = it.txt; $("bold").checked = !!it.b; $("italic").checked = !!it.i;
    $("size").value = Math.round(it.s / 1.6 * 100);
    ui.color = it.c;
    syncTools();
  }
  /** Ausgewählten Text ändern. Mehrere schnelle Änderungen (Tippen, Slider) = ein Rückgängig-Schritt. */
  let lastEdit = { key: null, t: 0 };
  function editSel(key, fn) {
    const it = lv.items[ui.sel];
    if (!it) return false;
    const now = Date.now();
    if (lastEdit.key !== key || now - lastEdit.t > 1500) { undo.push(JSON.stringify(lv)); redo.length = 0; }
    lastEdit = { key, t: now };
    fn(it); dirty = true;
    draw(); drawPreviews();
    return true;
  }
  function drawPreviews() {
    $("previews").innerHTML = PREVIEWS.map(id => `<button data-prev="${id}" class="${id === ui.type ? "on" : ""}" title="${esc(AIRCRAFT_BY_ID[id].name)}">${renderAircraft(id, lv, { fit: true, outline: 0.8, shadow: false })}<span>${esc(AIRCRAFT_BY_ID[id].name)}</span></button>`).join("");
  }
  function syncTools() {
    el.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === ui.tool)));
    const selIt = lv.items[ui.sel];
    $("hint").textContent = selIt ? `Ausgewählt: „${selIt.txt}“ – ziehen zum Verschieben, Entf zum Löschen, Klick daneben hebt die Auswahl auf.` : TOOLS.find(t => t[0] === ui.tool)[4];
    $("textopts").hidden = ui.tool !== "text" && ui.sel == null;
    $("hex").textContent = ui.color;
    $("color").value = ui.color;
    el.querySelector('[data-a="zoom"]').textContent = ui.zoom + "×";
  }

  function change(fn) {
    if (lv.items.length >= MAX_ITEMS && fn.adds) { ctx.toast("Maximale Anzahl an Elementen erreicht – fasse Flächen mit „Band“ oder „Füllen“ zusammen.", "warn"); return; }
    undo.push(JSON.stringify(lv)); if (undo.length > 80) undo.shift();
    redo.length = 0;
    fn();
    dirty = true;
    draw(); drawPreviews();
  }

  // ---------- Malen
  const svgPoint = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  let stroke = null;

  function bindStage() {
    const live = svg.querySelector("#pt-live"), cursor = svg.querySelector("#pt-cursor");
    svg.addEventListener("pointermove", e => {
      const { x, y } = svgPoint(e), hit = hitZone(profile, x, y);
      $("status").textContent = hit ? ZONE_NAMES[hit.zone] : "";
      const box = hit && frames(profile, hit.zone)[hit.zone === "engine" ? hit.index : 0];
      const r = (stroke ? stroke.r : box && (ui.tool === "brush" || ui.tool === "erase" || ui.tool === "line") ? ui.size * boxH(box) / 2 : 0);
      cursor.setAttribute("cx", x); cursor.setAttribute("cy", y); cursor.setAttribute("r", r);
      if (!stroke) return;
      if (stroke.kind === "brush" || stroke.kind === "erase") stroke.pts.push([x, y]);
      else if (stroke.kind === "line") stroke.pts[1] = e.shiftKey ? [x, stroke.pts[0][1]] : [x, y];
      else if (stroke.kind === "band") stroke.y1 = y;
      paintLive(live);
    });
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const tEl = e.target.closest("[data-it]");
      if (tEl && (ui.tool === "move" || ui.tool === "text")) return grabText(e, +tEl.dataset.it);
      if (ui.tool === "move") { ui.sel = null; drawSelection(); return; }
      const { x, y } = svgPoint(e), hit = hitZone(profile, x, y);
      if (!hit) return;
      const box = frames(profile, hit.zone)[hit.zone === "engine" ? hit.index : 0];
      const clip = hit.zone === "engine" ? `pt-engine-${hit.index}` : `pt-${hit.zone}`;
      if (ui.tool === "fill") return change(() => { lv.base[hit.zone] = ui.color; });
      if (ui.tool === "text") {
        const txt = $("txt").value.trim();
        if (!txt) return ctx.toast("Erst Text eingeben.", "warn");
        const [u, v] = toUV(box, x, y);
        const f = Object.assign(() => { lv.items.push({ t: "text", z: hit.zone, c: ui.color, u: r3(u), v: r3(v), s: r3(ui.size * 1.6), txt, b: ui.bold ? 1 : 0, i: ui.italic ? 1 : 0 }); ui.sel = lv.items.length - 1; }, { adds: true });
        return change(f);
      }
      svg.setPointerCapture(e.pointerId);
      stroke = { kind: ui.tool, zone: hit.zone, box, clip, pts: [[x, y], [x, y]], y0: y, y1: y, r: ui.size * boxH(box) / 2 };
      paintLive(live);
    });
    const end = () => {
      if (!stroke) return;
      const st = stroke; stroke = null;
      live.innerHTML = "";
      const h = boxH(st.box);
      if (st.kind === "band") {
        const v0 = (Math.min(st.y0, st.y1) - st.box.y0) / h, v1 = (Math.max(st.y0, st.y1) - st.box.y0) / h;
        if (v1 - v0 < 0.005) return;
        return change(Object.assign(() => lv.items.push({ t: "band", z: st.zone, c: ui.color, v0: r3(v0), v1: r3(v1) }), { adds: true }));
      }
      const pts = st.kind === "line" ? [st.pts[0], st.pts[1]] : simplify(st.pts, ui.size * h * 0.12);
      change(Object.assign(() => lv.items.push({ t: st.kind === "erase" ? "erase" : st.kind === "line" ? "line" : "brush", z: st.zone, c: ui.color, w: r3(ui.size), p: pts.map(([x, y]) => toUV(st.box, x, y).map(r3)) }), { adds: true }));
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", () => { stroke = null; live.innerHTML = ""; });
    svg.addEventListener("pointerleave", () => { $("status").textContent = ""; });
  }

  /** Text anfassen und verschieben (alle Kopien, z. B. auf mehreren Triebwerken, bewegen sich mit) */
  function grabText(e, idx) {
    ui.sel = idx; drawSelection();
    const it = lv.items[idx], box = frames(profile, it.z)[0];
    const start = svgPoint(e), u0 = it.u, v0 = it.v, before = JSON.stringify(lv);
    let moved = false;
    svg.setPointerCapture(e.pointerId);
    const move = ev => {
      const p = svgPoint(ev), w = box.x1 - box.x0, h = boxH(box);
      it.u = r3(u0 + (p.x - start.x) / w); it.v = r3(v0 + (p.y - start.y) / h);
      moved = true;
      svg.querySelectorAll(`[data-it="${idx}"]`).forEach(n => {
        const nx = +n.getAttribute("x") + (p.x - start.x) - (n._dx || 0), ny = +n.getAttribute("y") + (p.y - start.y) - (n._dy || 0);
        n._dx = p.x - start.x; n._dy = p.y - start.y;
        n.setAttribute("x", nx); n.setAttribute("y", ny);
        if (n.getAttribute("transform-origin")) n.setAttribute("transform-origin", `${nx} ${ny}`);
      });
      const g = svg.querySelector("#pt-sel"); if (g) g.innerHTML = "";
    };
    const up = () => {
      svg.removeEventListener("pointermove", move); svg.removeEventListener("pointerup", up);
      if (moved) { undo.push(before); redo.length = 0; dirty = true; draw(); drawPreviews(); }
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    e.stopPropagation();
  }

  function paintLive(live) {
    const st = stroke, base = lv.base[st.zone];
    let it;
    if (st.kind === "band") it = { t: "band", c: ui.color, v0: (Math.min(st.y0, st.y1) - st.box.y0) / boxH(st.box), v1: (Math.max(st.y0, st.y1) - st.box.y0) / boxH(st.box) };
    else {
      const pts = st.kind === "line" ? [st.pts[0], st.pts[1]] : st.pts;
      live.innerHTML = `<g clip-path="url(#${st.clip})"><path d="${strokeD(pts)}" fill="none" stroke="${st.kind === "erase" ? base : ui.color}" stroke-width="${ui.size * boxH(st.box)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      return;
    }
    live.innerHTML = `<g clip-path="url(#${st.clip})">${item(it, st.box, base)}</g>`;
  }

  // ---------- Bedienung
  el.addEventListener("click", e => {
    const t = e.target.closest("[data-tool]"); if (t) { ui.tool = t.dataset.tool; syncTools(); return; }
    const c = e.target.closest("[data-c]"); if (c) { ui.color = c.dataset.c; if (!editSel("color", it => (it.c = ui.color))) syncTools(); return; }
    const p = e.target.closest("[data-prev]"); if (p) { ui.type = p.dataset.prev; $("type").value = ui.type; draw(); drawPreviews(); return; }
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "undo") doUndo();
    if (a === "delsel") deleteSel();
    if (a === "redo") doRedo();
    if (a === "zoom") { ui.zoom = ui.zoom >= 3 ? 1 : ui.zoom + 1; syncTools(); draw(); }
    if (a === "white" && confirm("Alles entfernen und wieder komplett weiß lackieren?")) change(() => { lv = whiteLivery(); });
    if (a === "cancel") close();
    if (a === "save") {
      if (ctx.run(act.setLivery, lv)) { dirty = false; ctx.toast("Neue Livery ist auf allen Flugzeugen.", "good"); close(); }
    }
  });
  $("type").addEventListener("change", e => { ui.type = e.target.value; draw(); drawPreviews(); });
  $("color").addEventListener("input", e => { ui.color = e.target.value; $("hex").textContent = ui.color; editSel("color", it => (it.c = ui.color)); });
  $("size").addEventListener("input", e => { ui.size = +e.target.value / 100; editSel("size", it => (it.s = r3(ui.size * 1.6))); });
  $("txt").addEventListener("input", e => { ui.txt = e.target.value; if (e.target.value.trim()) editSel("txt", it => (it.txt = e.target.value)); });
  $("bold").addEventListener("change", e => { ui.bold = e.target.checked; editSel("bold", it => (it.b = ui.bold ? 1 : 0)); });
  $("italic").addEventListener("change", e => { ui.italic = e.target.checked; editSel("italic", it => (it.i = ui.italic ? 1 : 0)); });
  function deleteSel() { if (ui.sel == null) return; const i = ui.sel; ui.sel = null; change(() => lv.items.splice(i, 1)); }

  function doUndo() { if (!undo.length) return; ui.sel = null; redo.push(JSON.stringify(lv)); lv = JSON.parse(undo.pop()); dirty = true; draw(); drawPreviews(); }
  function doRedo() { if (!redo.length) return; ui.sel = null; undo.push(JSON.stringify(lv)); lv = JSON.parse(redo.pop()); dirty = true; draw(); drawPreviews(); }

  const keys = e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) && e.key !== "Escape") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && ui.sel != null) { e.preventDefault(); deleteSel(); return; }
    if (e.key === "Escape") { if (ui.sel != null) { ui.sel = null; drawSelection(); } else close(); return; }
    const t = TOOLS.find(x => x[2].toLowerCase() === e.key.toLowerCase());
    if (t && !e.ctrlKey && !e.metaKey) { ui.tool = t[0]; syncTools(); }
  };
  document.addEventListener("keydown", keys);

  function close() {
    if (dirty && !confirm("Änderungen verwerfen?")) return;
    document.removeEventListener("keydown", keys);
    el.remove();
  }

  syncTools(); draw(); drawPreviews();
}

const r3 = n => Math.round(n * 1000) / 1000;
