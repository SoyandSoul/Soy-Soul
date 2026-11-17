// Weltkarte im Flightradar-Stil: dunkle Karte, gelbe Flugzeuge mit Kurs, Großkreis-Linien, Klick für Details.
// Basiert auf MapLibre (lokal in lib/, wie bei History Shots) und OpenFreeMap-Kacheln.

import { Map as MLMap, NavigationControl, AttributionControl, Popup } from "../../lib/maplibre-gl.mjs";
import { AIRPORTS, AIRPORT_BY_IATA } from "../data/airports.js";
import { positionAt, typeOf, routeDistance } from "../sim/flight.js";
import { arc, nightPolygon } from "../sim/geo.js";
import { layout, groundPosition, gateIndex } from "../sim/ground.js";
import { GROUND } from "../core/config.js";
import { topViewIcon } from "./aircraftArt.js";
import { html } from "./dom.js";
import { fmt } from "../core/util.js";
import { prefs } from "../core/store.js";
import { weatherAt, severeWeather } from "../sim/weather.js";

// Notfall-Stil ohne Kacheln: Spiel bleibt bedienbar, auch wenn der Kartendienst nicht erreichbar ist.
const OFFLINE = { version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#121822" } }] };
// Schema: keine Kacheln, nur Hintergrund – die Linien, Flughäfen und Flugzeuge des Spiels
// zeichnen wir ohnehin selbst. Läuft auch dann, wenn der Kachelserver streikt.
const SCHEMA = { version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b1018" } }] };
// Satellit: NASA Blue Marble, gemeinfrei und ohne Schlüssel. Nur grobe Auflösung, dafür weltweit.
const SAT = {
  version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: { sat: { type: "raster", tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/{z}/{y}/{x}.jpeg"], tileSize: 256, maxzoom: 8, attribution: "NASA EOSDIS GIBS" } },
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#05070c" } }, { id: "sat", type: "raster", source: "sat" }]
};
export const MAP_STYLES = [
  { id: "dark", label: "Dunkel", style: "https://tiles.openfreemap.org/styles/dark" },
  { id: "light", label: "Hell", style: "https://tiles.openfreemap.org/styles/positron" },
  { id: "schema", label: "Schema", style: SCHEMA },
  { id: "sat", label: "Satellit", style: SAT }
];
const STYLES = [...MAP_STYLES.map(s => s.style), OFFLINE];
const PLANE = "#ffb000", PLANE_SEL = "#ff5a1f", HUB = "#ffb000", PLANE_GROUND = "#3ddc84", PLANE_CHECK = "#8a94a6";

export function createMap(container, ctx) {
  let styleIdx = Math.max(0, MAP_STYLES.findIndex(x => x.id === prefs.get("map-style", "dark")));
  let ready = false, selected = null, pickMode = null, popup = null, lastWx = 0;
  let night = prefs.get("map-night", false), lastNight = 0, groundShown = false;
  const map = new MLMap({
    container, style: STYLES[styleIdx], center: [10, 35], zoom: 1.6, minZoom: 1, maxZoom: 12,
    attributionControl: false, dragRotate: false, pitchWithRotate: false, renderWorldCopies: true
  });
  map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(styleControl(), "bottom-right");
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
    map.addSource("night", { type: "geojson", data: empty() });
    map.addSource("ground", { type: "geojson", data: empty() });
    for (const k of ["storm", "snow", "fog", "delay"]) if (!map.hasImage("wx-" + k)) map.addImage("wx-" + k, wxIcon(k), { pixelRatio: 2 });
    // Nachtschatten: wo auf der Erde gerade keine Sonne scheint. Reine Astronomie aus der Uhrzeit.
    map.addLayer({ id: "night", type: "fill", source: "night", paint: { "fill-color": "#000b1e", "fill-opacity": 0.42 } });
    map.addLayer({ id: "night-edge", type: "line", source: "night", paint: { "line-color": "#ffd27a", "line-width": 1, "line-opacity": 0.35, "line-blur": 1.5 } });
    // Bodenbetrieb: Bahnen, Vorfeld und Rollwege, erst ab GROUND.zoom sichtbar
    map.addLayer({ id: "apron", type: "line", source: "ground", filter: ["==", ["get", "k"], "apron"],
      paint: { "line-color": "#2a3444", "line-width": 14, "line-opacity": 0.9 }, layout: { "line-cap": "round" } });
    map.addLayer({ id: "taxi", type: "line", source: "ground", filter: ["==", ["get", "k"], "taxi"],
      paint: { "line-color": "#39455a", "line-width": 4, "line-dasharray": [3, 2] } });
    map.addLayer({ id: "rwy", type: "line", source: "ground", filter: ["==", ["get", "k"], "rwy"],
      paint: { "line-color": "#4a5668", "line-width": 9 }, layout: { "line-cap": "butt" } });
    map.addLayer({ id: "rwy-mid", type: "line", source: "ground", filter: ["==", ["get", "k"], "rwy"],
      paint: { "line-color": "#cfd6e2", "line-width": 1, "line-dasharray": [4, 6], "line-opacity": 0.8 } });
    map.addLayer({ id: "rwy-label", type: "symbol", source: "ground", filter: ["==", ["get", "k"], "rwy"],
      layout: { "symbol-placement": "line-center", "text-field": ["get", "name"], "text-size": 10, "text-font": ["Noto Sans Regular"] },
      paint: { "text-color": "#aab2c0", "text-halo-color": "#0b1018", "text-halo-width": 1.2 } });
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
        "icon-offset": ["get", "off"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.6, 5, 1, 9, 1.4],
        "text-field": ["step", ["zoom"], "", 4, ["get", "reg"]], "text-size": 10, "text-offset": [0, 1.6], "text-anchor": "top", "text-font": ["Noto Sans Regular"], "text-optional": true
      },
      // gelb = in der Luft, grün = am Boden (gelandet / wartet auf Abflug / steht am Hub), grau = in Wartung
      paint: { "icon-color": ["case", ["get", "sel"], PLANE_SEL, ["==", ["get", "ground"], "check"], PLANE_CHECK, ["get", "air"], PLANE, PLANE_GROUND], "icon-opacity": ["case", ["get", "air"], 1, 0.92], "text-color": ["case", ["get", "air"], "#ffd27a", "#9df0bf"], "text-halo-color": "#0d1016", "text-halo-width": 1.2 }
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
    const state = s, detail = map.getZoom() >= GROUND.zoom;
    let track = empty();
    const hub = AIRPORT_BY_IATA[s.airline.hubs[0]];
    const parked = {}; // Flugzeuge am selben Flughafen leicht versetzt zeichnen (wie auf dem Vorfeld)
    const slot = iata => { const i = parked[iata] = (parked[iata] || 0) + 1; return [((i - 1) % 4) * 14, Math.floor((i - 1) / 4) * 14 + 10]; };
    for (const ac of s.fleet) {
      if (ac.status === "crashed" || ac.status === "delivery") continue;
      const t = typeOf(ac), kind = t.art.deck2 || t.art.engines === 4 ? "jumbo" : t.size;
      const route = ac.ops && s.routes.find(r => r.id === ac.ops.routeId);
      if (!route) {
        // ohne Strecke / in Wartung: steht am Drehkreuz (grün bzw. grau)
        if (!hub) continue;
        feats.push(pt([hub.lon, hub.lat], { id: ac.id, reg: ac.reg, hdg: 0, kind, air: false, ground: ac.status === "check" ? "check" : "hub", off: slot(hub.iata), sel: ac.id === selected, delayed: false }));
        continue;
      }
      const p = ac.status === "check" ? { phase: "ground", at: AIRPORT_BY_IATA[route.from], lat: AIRPORT_BY_IATA[route.from].lat, lon: AIRPORT_BY_IATA[route.from].lon, heading: 0 } : positionAt(ac, route, now);
      let onGround = p.phase !== "air";
      // Nah dran: nicht einfach auf den Flughafenpunkt setzen, sondern ans Gate, auf den
      // Rollweg oder auf die Bahn – je nachdem, wie lange es bis zum Abflug noch dauert.
      if (onGround && detail && p.at) {
        const g = groundPosition(p.at, ac.id, now, { dep: ac.ops.dep, arr: ac.ops.dep - turnBack(ac, state) });
        feats.push(pt([g.lon, g.lat], { id: ac.id, reg: ac.reg + (ac.ops.delay ? ` +${ac.ops.delay.min}'` : ""), hdg: g.heading, kind, air: false, ground: ac.status === "check" ? "check" : (p.at.iata === route.from ? "hub" : "dest"), off: [0, 0], sel: ac.id === selected, delayed: !!ac.ops.delay, taxi: g.phase !== "gate" }));
        continue;
      }
      const ground = ac.status === "check" ? "check" : onGround ? (p.at?.iata === route.from ? "hub" : "dest") : null;
      feats.push(pt([p.lon, p.lat], { id: ac.id, reg: ac.reg + (ac.ops.delay ? ` +${ac.ops.delay.min}'` : ""), hdg: onGround ? 0 : p.heading, kind, air: !onGround, ground, off: onGround ? slot(p.at?.iata || route.from) : [0, 0], sel: ac.id === selected, delayed: !!ac.ops.delay }));
      if (ac.id === selected && p.phase === "air") {
        const full = arc(p.from, p.to, 96), cut = Math.max(1, Math.round(p.progress * 96));
        track = fc([line(full.slice(0, cut + 1), { done: true }), line(full.slice(cut), { done: false })]);
      }
    }
    map.getSource("planes").setData(fc(feats));
    updateNight(now);
    updateGround();
    if (now - lastWx > 60_000) { lastWx = now; map.getSource("weather").setData(fc(severeWeather(AIRPORTS, now).map(({ a, w }) => pt([a.lon, a.lat], { kind: w.kind, sev: w.sev })))); }
    map.getSource("track").setData(track);
  }

  /** Kleines Menü für Kartenstil und Nachtschatten, unten rechts über den Zoomknöpfen. */
  function styleControl() {
    let el;
    return {
      onAdd() {
        el = document.createElement("div");
        el.className = "maplibregl-ctrl maplibregl-ctrl-group mapstyle";
        el.innerHTML = `<button type="button" title="Kartenstil" aria-label="Kartenstil">◧</button>
          <div class="mapstyle-menu" hidden>
            ${MAP_STYLES.map(x => `<button type="button" data-style="${x.id}">${x.label}</button>`).join("")}
            <hr><button type="button" data-night="1">Nachtschatten</button>
          </div>`;
        const menu = el.querySelector(".mapstyle-menu");
        const mark = () => {
          for (const b of menu.querySelectorAll("[data-style]")) b.classList.toggle("on", b.dataset.style === MAP_STYLES[styleIdx].id);
          menu.querySelector("[data-night]").classList.toggle("on", night);
        };
        el.firstElementChild.onclick = () => { menu.hidden = !menu.hidden; mark(); };
        menu.onclick = ev => {
          const b = ev.target.closest("button");
          if (!b) return;
          if (b.dataset.night) { api.setNight(!night); } else { api.setStyle(b.dataset.style); }
          mark();
        };
        document.addEventListener("click", ev => { if (!el.contains(ev.target)) menu.hidden = true; });
        return el;
      },
      onRemove() { el?.remove(); }
    };
  }

  /** Nachtschatten – einmal pro Minute reicht, die Erde dreht sich langsam. */
  function updateNight(now) {
    if (!ready) return;
    if (!night) { if (lastNight) { map.getSource("night").setData(empty()); lastNight = 0; } return; }
    if (now - lastNight < 60_000) return;
    lastNight = now;
    map.getSource("night").setData(fc([{ type: "Feature", properties: {}, geometry: nightPolygon(now) }]));
  }

  /**
   * Bahnen, Vorfeld und Rollwege der Flughäfen im Blickfeld. Erst ab GROUND.zoom –
   * darunter wäre es ein Gewirr aus Strichen und würde auf dem Telefon nur bremsen.
   */
  function updateGround() {
    if (!ready) return;
    if (map.getZoom() < GROUND.zoom) { if (groundShown) { map.getSource("ground").setData(empty()); groundShown = false; } return; }
    const b = map.getBounds();
    const feats = [];
    for (const ap of AIRPORTS) {
      if (ap.lon < b.getWest() - 0.2 || ap.lon > b.getEast() + 0.2 || ap.lat < b.getSouth() - 0.2 || ap.lat > b.getNorth() + 0.2) continue;
      const l = layout(ap);
      l.runways.forEach((r, i) => feats.push(line([r.from, r.to], { k: "rwy", name: rwyName(r.hdg) })));
      feats.push(line(l.apron, { k: "apron" }));
      feats.push(line([l.apron[0], l.hold, l.runways[0].from], { k: "taxi" }));
      feats.push(line([l.apron[1], l.hold], { k: "taxi" }));
    }
    map.getSource("ground").setData(fc(feats));
    groundShown = true;
  }

  const api = {
    map,
    updateStatic, updatePlanes, select,
    get style() { return MAP_STYLES[styleIdx]?.id || "dark"; },
    setStyle(id) {
      const i = MAP_STYLES.findIndex(x => x.id === id);
      if (i < 0 || i === styleIdx) return;
      styleIdx = i; ready = false; lastNight = 0; groundShown = false;
      prefs.set("map-style", id);
      map.setStyle(STYLES[i]);
    },
    get night() { return night; },
    setNight(on) { night = !!on; prefs.set("map-night", night); lastNight = 0; updateNight(ctx.now()); },
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
  return api;
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

/** Bahnbezeichnung aus der Richtung: 070° → "07/25" */
function rwyName(hdg) {
  const a = Math.round(hdg / 10) % 36 || 36;
  const b = (a + 18) % 36 || 36;
  const p = n => String(n).padStart(2, "0");
  return `${p(a)}/${p(b)}`;
}

/** Wie lange das Flugzeug schon am Boden steht – für die Rollbewegung nach der Landung. */
function turnBack(ac, state) {
  const r = state.routes.find(x => x.id === ac.ops?.routeId);
  if (!r) return 0;
  // Die Standzeit ist der Abstand zwischen Landung und geplantem Abflug; genauer brauchen
  // wir es nicht, die Rollbewegung dauert ohnehin nur ein paar Minuten.
  return 45 * 60_000;
}
