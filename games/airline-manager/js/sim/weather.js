// Globales Wetter, ganz ohne Server: Das Wetter an jedem Flughafen ist eine feste Funktion von Ort und Zeit
// (wie der Kerosinpreis) – alle Spieler sehen dasselbe Wetter, und Nachrechnen nach Abwesenheit ergibt dasselbe.
//
// Klima nach Breite und Jahreszeit:
//   Tropen        Gewitter vor allem in der Regenzeit (lokaler Sommer)
//   Mittelbreiten Sommergewitter, Herbst-/Winternebel, Schnee ab ~38° im Winter
//   hohe Breiten  viel Schnee im Winter
// Unwetter verlängern manchmal den Turnaround (Enteisen, Gewitterstopp am Vorfeld, Sichtflugregeln bei Nebel).

import { smoothNoise, rand01 } from "../core/util.js";
import { AIRPORT_BY_IATA } from "../data/airports.js";

const TAU = Math.PI * 2, BLOCK_H = 3;

export const WX = {
  clear: { label: "Klar", icon: "☀️" },
  clouds: { label: "Bewölkt", icon: "☁️" },
  rain: { label: "Regen", icon: "🌧️" },
  storm: { label: "Gewitter", icon: "⛈️", bad: true },
  snow: { label: "Schnee", icon: "❄️", bad: true },
  fog: { label: "Nebel", icon: "🌫️", bad: true }
};

/** Jahreszeit am Ort: +1 Hochsommer, −1 tiefer Winter */
function season(ts, lat) {
  const d = new Date(ts), doy = (ts - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
  const peak = lat >= 0 ? 200 : 17;
  return Math.cos(TAU * (doy - peak) / 365);
}

function chances(lat, s) {
  const a = Math.abs(lat), summer = Math.max(0, s), winter = Math.max(0, -s);
  const storm = a < 25 ? 0.07 + 0.13 * summer : a < 45 ? 0.03 + 0.07 * summer : 0.01 + 0.03 * summer;
  const snow = a > 38 ? winter * (a > 52 ? 0.24 : a > 45 ? 0.14 : 0.07) : 0;
  const fog = a > 28 ? 0.025 + 0.05 * winter : 0.01;
  return { storm, snow, fog };
}

/** Wetter an einem Flughafen zu einem Zeitpunkt. sev = Stärke 0..1 (nur bei Unwetter > 0) */
export function weatherAt(iata, ts) {
  const ap = AIRPORT_BY_IATA[iata];
  const t = ts / 3600_000 / BLOCK_H;
  const n = (smoothNoise("wx-" + iata, t) + 1) / 2;          // 0..1, ändert sich über Stunden
  const s = season(ts, ap.lat), c = chances(ap.lat, s);
  const bad = c.storm + c.snow + c.fog;
  if (n > 1 - bad) {
    const pick = rand01("wx-kind", iata, Math.floor(t / 2)) * bad;
    const kind = pick < c.storm ? "storm" : pick < c.storm + c.snow ? "snow" : "fog";
    return { kind, sev: Math.min(1, (n - (1 - bad)) / bad + 0.15), ...WX[kind] };
  }
  const kind = n > 0.72 ? (Math.abs(ap.lat) > 35 && s < -0.3 && n > 0.8 ? "snow" : "rain") : n > 0.5 ? "clouds" : "clear";
  return { kind, sev: 0, ...WX[kind], bad: false };
}

/**
 * Zusätzliche Turnaround-Minuten durch Wetter am Flughafen (deterministisch pro Flugzeug + Zeitpunkt).
 * Nicht jedes Unwetter verspätet jeden Flug – die Wahrscheinlichkeit steigt mit der Stärke.
 */
export function weatherDelay(iata, ts, key) {
  const w = weatherAt(iata, ts);
  if (!w.bad && w.kind !== "rain") return null;
  const r = rand01("wx-delay", key, ts);
  if (w.kind === "rain") return r < 0.12 ? { min: 5 + Math.round(r * 60), reason: "Regen", at: iata, kind: w.kind } : null;
  if (r > 0.35 + 0.55 * w.sev) return null;
  const base = { storm: [15, 75], snow: [20, 100], fog: [10, 45] }[w.kind];
  const min = Math.round(base[0] + (base[1] - base[0]) * w.sev * (0.6 + 0.4 * rand01("wx-len", key, ts)));
  return { min, reason: w.label, at: iata, kind: w.kind };
}

/** Alle Flughäfen mit Unwetter (für die Karte) */
export function severeWeather(airports, ts) {
  return airports.map(a => ({ a, w: weatherAt(a.iata, ts) })).filter(x => x.w.bad);
}
