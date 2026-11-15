// Weltkarte im Flightradar-Stil: dunkle Karte, gelbe Flugzeuge mit Kurs, Großkreis-Linien, Klick für Details.
// Basiert auf MapLibre (lokal in lib/, wie bei History Shots) und OpenFreeMap-Kacheln.

import { Map as MLMap, NavigationControl, AttributionControl, Popup } from "../../lib/maplibre-gl.mjs";
import { AIRPORTS, AIRPORT_BY_IATA } from "../data/airports.js";
import { positionAt, typeOf, routeDistance } from "../sim/flight.js";
import { arc } from "../sim/geo.js";
import { topViewIcon } from "./aircraftArt.js";
import { html } from "./dom.js";
import { fmt } from "../core/util.js";
import { weatherAt, severeWeather } from "../sim/weather.js";

// Notfall-Stil ohne Kacheln: Spiel bleibt bedienbar, auch wenn der Kartendienst nicht erreichbar ist.
const OFFLINE = { version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#121822" } }] };
const STYLES = ["https://tiles.openfreemap.org/styles/dark", "https://tiles.openfreemap.org/styles/positron", OFFLINE];
const PLANE = "#ffb000", PLANE_SEL = "#ff5a1f", HUB = "#ffb000";

export function createMap(container, ctx) {
  let styleIdx = 0, ready = false, selected = null, pickMode = null, popup = null, lastWx = 0;
  const map = new MLMap({
    container, style: STYLES[0], center: [10, 35], zoom: 1.6, minZoom: 1, maxZoom: 12,
    attributionControl: false, dragRotate: false, pitchWithRotate: false, renderWorldCopies: true
  });
  map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new AttributionControl({ compact: true }), "bottom-left");
  map.on("error", e => {
    // Stil nicht ladbar → nächsten probieren
    if (!ready && e?.error && styleIdx < STYLES.length - 1) { styleIdx++; map.setStyle(STYLES[styleIdx]); }
  });

  map.on("style.load", () => {
    for (const k of ["narrow", "wide", "jumbo"]) if (!map.hasImage("plane-" + k)) map.addImage("plane-" + k, topViewIcon(k, 64), { sdf: true, pixelRatio: 2 });
    map.addSource("routes", { type: "geojson", data: empty() });
    map.addSource("track", { type: "geojson", data: empty() });
    map.addSource("airports", { type: "geojson", data: empty() });
    map.addSource("planes", { type: "geojson", data: empty() });
    map.addSource("weather", { type: "geojson", data: empty() });
    for (const k of ["storm", "snow", "fog", "delay"]) if (!map.hasImage("wx-" + k)) map.addImage("wx-" + k, wxIcon(k), { pixelRatio: 2 });
    map.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": ["case", ["get", "sel"], "#ffd27a", "#ffb000"], "line-opacity": ["case", ["get", "sel"], 0.9, 0.28], "line-width": ["case", ["get", "sel"], 2.2, 1.1] }, layout: { "line-cap": "round" } });
    map.addLayer({ id: "track-done", type: "line", source: "track", filter: ["==", ["get", "done"], true], paint: { "line-color": PLANE_SEL, "line-width": 2.4 } });
    map.addLayer({ id: "track-todo", type: "line", source: "track", filter: ["==", ["get", "done"], false], paint: { "line-color": PLANE_SEL, "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 2] } });
    map.addLayer({
      id: "airports", type: "circle", source: "airports",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["+", 1.2, ["*", 0.5, ["get", "tier"]]], 6, ["+", 3, ["get", "tier"]]],
        "circle-color": ["case", ["get", "hub"], HUB, ["get", "served"], "#ffffff", "#7d8899"],
        "circle-opacity": ["case", ["any", ["get", "hub"], ["get", "served"]], 1, 0.7],
        "circle-stroke-width": ["case", ["get", "hub"], 2, 0], "circle-stroke-color": "#1a1300"
      }
    });
    map.addLayer({
      id: "airport-labels", type: "symbol", source: "airports", minzoom: 2.6,
      layout: { "text-field": ["get", "iata"], "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-font": ["Noto Sans Bold"], "text-allow-overlap": false },
      paint: { "text-color": "#c8d0dc", "text-halo-color": "#0d1016", "text-halo-width": 1.4 }
    });
    map.addLayer({
      id: "weather", type: "symbol", source: "weather",
      layout: { "icon-image": ["concat", "wx-", ["get", "kind"]], "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.55, 5, 0.9], "icon-offset": [16, -16], "icon-allow-overlap": true, "icon-ignore-placement": true },
      paint: { "icon-opacity": ["+", 0.55, ["*", 0.45, ["get", "sev"]]] }
    });
    map.addLayer({
      id: "planes", type: "symbol", source: "planes",
      layout: {
        "icon-image": ["concat", "plane-", ["get", "kind"]], "icon-rotate": ["get", "hdg"], "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 5, 1, 9, 1.4],
        "text-field": ["step", ["zoom"], "", 4, ["get", "reg"]], "text-size": 10, "text-offset": [0, 1.6], "text-anchor": "top", "text-font": ["Noto Sans Regular"], "text-optional": true
      },
      paint: { "icon-color": ["case", ["get", "sel"], PLANE_SEL, PLANE], "icon-opacity": ["case", ["get", "air"], 1, 0.55], "text-color": "#ffd27a", "text-halo-color": "#0d1016", "text-halo-width": 1.2 }
    });
    map.addLayer({
      id: "plane-delay", type: "symbol", source: "planes", filter: ["==", ["get", "delayed"], true],
      layout: { "icon-image": "wx-delay", "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.45, 5, 0.7], "icon-offset": [22, -22], "icon-allow-overlap": true, "icon-ignore-placement": true }
    });
    ready = true;
    lastWx = 0;
    updateStatic();
    updatePlanes();
  });

  // ---- Interaktion
  map.on("click", "planes", e => { const id = e.features[0].properties.id; select(id); e.preventDefault(); });
  map.on("click", "airports", e => {
    if (e.defaultPrevented) return;
    const iata = e.features[0].properties.iata;
    if (pickMode) { pickMode(iata); return; }
    showAirport(iata);
  });
  map.on("click", e => { if (!e.defaultPrevented && !map.queryRenderedFeatures(e.point, { layers: ["planes", "airports"] }).length) select(null); });
  for (const l of ["planes", "airports"]) {
    map.on("mouseenter", l, () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", l, () => map.getCanvas().style.cursor = "");
  }

  function showAirport(iata) {
    const a = AIRPORT_BY_IATA[iata], s = ctx.state, isHub = s?.airline.hubs.includes(iata), wx = weatherAt(iata, ctx.now());
    popup?.remove();
    const el = document.createElement("div");
    el.innerHTML = html`<div class="stack">
      <div><b style="font:700 18px var(--display)">${a.city}</b> <span class="code">${a.iata} · ${a.icao}</span></div>
      <dl class="kv">
        <dt>Land</dt><dd>${a.country}</dd>
        <dt>Längste Bahn</dt><dd>${fmt.int(a.runwayM)} m</dd>
        <dt>Einzugsgebiet</dt><dd>${fmt.dec(a.pop)} Mio</dd>
        <dt>Geschäft / Urlaub</dt><dd>${Math.round(a.biz * 100)} % / ${Math.round(a.tour * 100)} %</dd>
        <dt>Kategorie</dt><dd>${"★".repeat(a.tier)}</dd>
        <dt>Wetter jetzt</dt><dd>${wx.icon} ${wx.label}${wx.bad ? html` <span class="pill warn">Verspätungen möglich</span>` : ""}</dd>
      </dl>
      <div class="row">${s ? (isHub ? html`<span class="pill good">Dein Drehkreuz</span>` : html`<button class="btn sm p" data-plan>Strecke planen</button>`) : ""}</div>
    </div>`.s;
    el.querySelector("[data-plan]")?.addEventListener("click", () => { popup.remove(); ctx.openApp("routes", { tab: "new", to: iata }); });
    popup = new Popup({ offset: 10, maxWidth: "280px" }).setLngLat([a.lon, a.lat]).setDOMContent(el).addTo(map);
  }

  function select(id) {
    selected = id;
    ctx.onSelect?.(id);
    updatePlanes();
  }

  // ---- Daten
  function updateStatic() {
    if (!ready) return;
    const s = ctx.state, hubs = new Set(s?.airline.hubs || []), served = new Set();
    for (const r of s?.routes || []) { served.add(r.from); served.add(r.to); }
    map.getSource("airports").setData(fc(AIRPORTS.map(a => pt([a.lon, a.lat], { iata: a.iata, tier: a.tier, hub: hubs.has(a.iata), served: served.has(a.iata) }))));
    const selRoute = selected && s?.fleet.find(a => a.id === selected)?.ops?.routeId;
    map.getSource("routes").setData(fc((s?.routes || []).map(r => line(arc(AIRPORT_BY_IATA[r.from], AIRPORT_BY_IATA[r.to]), { id: r.id, sel: r.id === selRoute || r.id === ctx.highlightRoute }))));
  }

  function updatePlanes() {
    if (!ready || !ctx.state) return;
    const s = ctx.state, now = ctx.now(), feats = [];
    let track = empty();
    for (const ac of s.fleet) {
      if (ac.status !== "active" && ac.status !== "check") continue;
      if (!ac.ops) continue;
      const route = s.routes.find(r => r.id === ac.ops.routeId);
      if (!route) continue;
      const p = ac.status === "check" ? { phase: "ground", lat: AIRPORT_BY_IATA[route.from].lat, lon: AIRPORT_BY_IATA[route.from].lon, heading: 0 } : positionAt(ac, route, now);
      const t = typeOf(ac);
      feats.push(pt([p.lon, p.lat], { id: ac.id, reg: ac.reg + (ac.ops.delay ? ` +${ac.ops.delay.min}'` : ""), hdg: p.heading, kind: t.art.deck2 || t.art.engines === 4 ? "jumbo" : t.size, air: p.phase === "air", sel: ac.id === selected, delayed: !!ac.ops.delay }));
      if (ac.id === selected && p.phase === "air") {
        const full = arc(p.from, p.to, 96), cut = Math.max(1, Math.round(p.progress * 96));
        track = fc([line(full.slice(0, cut + 1), { done: true }), line(full.slice(cut), { done: false })]);
      }
    }
    map.getSource("planes").setData(fc(feats));
    if (now - lastWx > 60_000) { lastWx = now; map.getSource("weather").setData(fc(severeWeather(AIRPORTS, now).map(({ a, w }) => pt([a.lon, a.lat], { kind: w.kind, sev: w.sev })))); }
    map.getSource("track").setData(track);
  }

  return {
    map,
    updateStatic, updatePlanes, select,
    get selected() { return selected; },
    flyTo(lon, lat, zoom = 4) { map.flyTo({ center: [lon, lat], zoom, speed: 1.4 }); },
    focusAircraft(id) {
      const ac = ctx.state.fleet.find(a => a.id === id), r = ac?.ops && ctx.state.routes.find(x => x.id === ac.ops.routeId);
      select(id);
      if (r) { const p = positionAt(ac, r, ctx.now()); map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 4) }); }
    },
    /** Auswahlmodus für Flughäfen (Onboarding: Drehkreuz wählen). fn = null beendet ihn. */
    pickAirport(fn) { pickMode = fn; popup?.remove(); }
  };
}

/** Kleine Wetter- und Verspätungssymbole für die Karte */
function wxIcon(kind) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(48, 48) : Object.assign(document.createElement("canvas"), { width: 48, height: 48 });
  const g = c.getContext("2d");
  const cloud = (col) => { g.fillStyle = col; g.beginPath(); g.arc(17, 22, 9, 0, 7); g.arc(28, 18, 11, 0, 7); g.arc(36, 25, 7, 0, 7); g.fill(); g.fillRect(17, 22, 20, 10); };
  if (kind === "storm") { cloud("#5a6578"); g.fillStyle = "#ffd23f"; g.beginPath(); g.moveTo(27, 26); g.lineTo(19, 40); g.lineTo(25, 39); g.lineTo(22, 47); g.lineTo(33, 32); g.lineTo(27, 33); g.lineTo(31, 26); g.closePath(); g.fill(); }
  if (kind === "snow") { g.strokeStyle = "#e6f3ff"; g.lineWidth = 3.5; g.lineCap = "round"; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(24 + 15 * Math.cos(a), 24 + 15 * Math.sin(a)); g.lineTo(24 - 15 * Math.cos(a), 24 - 15 * Math.sin(a)); g.stroke(); } }
  if (kind === "fog") { g.strokeStyle = "#c3cad6"; g.lineWidth = 4; g.lineCap = "round"; for (const [y, x0, x1] of [[14, 8, 34], [24, 14, 40], [34, 6, 30]]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); } }
  if (kind === "delay") { g.fillStyle = "#ff4d5e"; g.beginPath(); g.arc(24, 24, 18, 0, 7); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 3.5; g.lineCap = "round"; g.beginPath(); g.arc(24, 24, 10, 0, 7); g.stroke(); g.beginPath(); g.moveTo(24, 17); g.lineTo(24, 24); g.lineTo(29, 27); g.stroke(); }
  return g.getImageData(0, 0, 48, 48);
}

const empty = () => ({ type: "FeatureCollection", features: [] });
const fc = features => ({ type: "FeatureCollection", features });
const pt = (c, properties) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties });
const line = (c, properties) => ({ type: "Feature", geometry: { type: "LineString", coordinates: c }, properties });
export { routeDistance };
