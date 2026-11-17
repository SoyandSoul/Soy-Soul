// Kleine Hilfsfunktionen ohne DOM-Bezug (laufen auch in Node für Tests).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Stabiler 32-bit-Hash für Strings – Basis für deterministische Zufallswerte. */
export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

/** Deterministische Zahl 0..1 aus beliebigen Schlüsseln. Gleiche Eingabe → gleiches Ergebnis auf jedem Gerät. */
export const rand01 = (...keys) => hash(keys.join("|")) / 4294967296;

/** Seeded PRNG (mulberry32) für Listen, z. B. Gebrauchtmarkt des Tages. */
export function rng(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hash(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Glattes Rauschen über die Zeit (Value-Noise), für Kerosinpreis u. ä. */
export function smoothNoise(key, x) {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  return lerp(rand01(key, i), rand01(key, i + 1), s) * 2 - 1;
}

export const uid = (p = "id") => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const dayKey = ts => new Date(ts).toISOString().slice(0, 10);

const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export const fmt = {
  int: v => nf0.format(Math.round(v)),
  dec: v => nf1.format(v),
  money(v) {
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e9) return s + "$" + nf2.format(a / 1e9) + " Mrd";
    if (a >= 1e6) return s + "$" + nf2.format(a / 1e6) + " Mio";
    if (a >= 1e4) return s + "$" + nf0.format(a / 1e3) + "k";
    return s + "$" + nf0.format(a);
  },
  price: v => "$" + nf2.format(v),
  pct: v => (v >= 0 ? "+" : "−") + nf1.format(Math.abs(v * 100)) + " %",
  km: v => nf0.format(v) + " km",
  hours(h) {
    const s = h < 0 ? "−" : "", a = Math.abs(h), hh = Math.floor(a), mm = Math.round((a - hh) * 60);
    return s + hh + ":" + String(mm).padStart(2, "0") + " h";
  },
  /** Flugstunden bis zum Check, negativ = überfällig */
  fh: h => (h < 0 ? "−" : "") + nf0.format(Math.abs(Math.round(h))) + " h",
  duration(ms) {
    const neg = ms < 0, a = Math.abs(ms) / 60000, d = Math.floor(a / 1440), h = Math.floor((a % 1440) / 60), m = Math.floor(a % 60);
    return (neg ? "−" : "") + (d ? d + " T " : "") + (d || h ? h + " h " : "") + m + " min";
  },
  time: ts => new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
  dateTime: ts => new Date(ts).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  date: ts => new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
};
