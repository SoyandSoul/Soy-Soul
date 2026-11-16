// Lackier-Vorlagen: Schemata nach gängigen Mustern echter Airlines (ohne Markenlogos), kombiniert mit Farbwelten.
// Eine Vorlage erzeugt eine normale Livery (v2) – der Spieler passt danach Name, Farben und Details in der
// Lackiererei an oder malt frei weiter. Alles in relativen u/v-Koordinaten → passt auf jeden Flugzeugtyp.
//
// Schema-Funktion: (p = Farbwelt, name, iata) → Livery.  Farbwelt: { a: Hauptfarbe, b: Zweitfarbe, c: Akzent, ink: Schriftfarbe auf Weiß }

import { whiteLivery } from "./livery.js";

export const PALETTES = [
  { id: "navy",    name: "Marine & Gold",      a: "#0b2a5b", b: "#1f4fd8", c: "#ffc400", ink: "#0b2a5b" },
  { id: "red",     name: "Rot & Weiß",         a: "#e0262d", b: "#7a1631", c: "#ffffff", ink: "#e0262d" },
  { id: "teal",    name: "Türkis & Nacht",     a: "#0aa39b", b: "#0b2a5b", c: "#a4d233", ink: "#0b2a5b" },
  { id: "green",   name: "Grün & Gelb",        a: "#1f9d55", b: "#0f5132", c: "#ffc400", ink: "#0f5132" },
  { id: "orange",  name: "Orange & Grau",      a: "#ff7a00", b: "#5b6472", c: "#ffffff", ink: "#16191f" },
  { id: "violet",  name: "Violett & Rosa",     a: "#6b3fa0", b: "#ff4f9a", c: "#ffffff", ink: "#6b3fa0" },
  { id: "black",   name: "Schwarz & Gold",     a: "#16191f", b: "#c9a227", c: "#ffffff", ink: "#16191f" },
  { id: "sky",     name: "Himmelblau & Weiß",  a: "#4fb3ff", b: "#1f4fd8", c: "#ffffff", ink: "#1f4fd8" },
  { id: "sand",    name: "Sand & Bordeaux",    a: "#c9a227", b: "#7a1631", c: "#ffffff", ink: "#7a1631" },
  { id: "mint",    name: "Mint & Anthrazit",   a: "#5fd3b5", b: "#2b3340", c: "#ffffff", ink: "#2b3340" }
];

const text = (z, c, u, v, s, txt, b = 1, i = 0) => ({ t: "text", z, c, u, v, s, txt, b, i });
const band = (z, c, v0, v1) => ({ t: "band", z, c, v0, v1 });
const line = (z, c, w, p) => ({ t: "line", z, c, w, p });
const brush = (z, c, w, p) => ({ t: "brush", z, c, w, p });
const code = (name, iata) => (iata || name.slice(0, 2)).toUpperCase();

export const SCHEMES = [
  { id: "eurowhite", name: "Eurowhite", desc: "Weißer Rumpf, farbiges Leitwerk, Name vorne – der Klassiker.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.a; lv.items.push(text("fuselage", p.ink, 0.3, 0.29, 0.27, name), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata), 1, 1)); return lv; } },
  { id: "cheatline", name: "Cheatline", desc: "Zierlinie auf Fensterhöhe, dunkler Bauch – 70er/80er-Stil.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.a; lv.items.push(band("fuselage", p.a, 0.44, 0.5), band("fuselage", p.b, 0.5, 0.54), band("fuselage", p.a, 0.62, 1.02), band("engine", p.a, 0.55, 1.02), text("fuselage", p.ink, 0.28, 0.29, 0.22, name), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata), 1, 1)); return lv; } },
  { id: "billboard", name: "Billboard", desc: "Riesiger Schriftzug über den ganzen Rumpf.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.a; lv.base.engine = p.a; lv.items.push(text("fuselage", p.a, 0.42, 0.4, 0.5, name.toUpperCase()), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata))); return lv; } },
  { id: "belly", name: "Farbiger Bauch", desc: "Untere Rumpfhälfte in Farbe, geschwungen zum Heck.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.a; lv.base.engine = p.a; lv.items.push(band("fuselage", p.a, 0.6, 1.02), brush("fuselage", p.a, 0.22, [[0.78, 0.62], [0.86, 0.5], [0.93, 0.32], [1, 0.1]]), text("fuselage", p.ink, 0.3, 0.29, 0.26, name), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata), 1, 1)); return lv; } },
  { id: "swoosh", name: "Heckschwung", desc: "Dynamischer Pinselschwung vom Bauch ins Leitwerk.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.a; lv.items.push(brush("fuselage", p.b, 0.16, [[0.55, 0.98], [0.68, 0.9], [0.8, 0.7], [0.9, 0.4], [1, 0.08]]), brush("fuselage", p.a, 0.12, [[0.6, 1.0], [0.72, 0.95], [0.84, 0.8], [0.95, 0.5], [1.02, 0.2]]), brush("fin", p.b, 0.35, [[0.1, 1.0], [0.4, 0.7], [0.7, 0.3]]), text("fuselage", p.ink, 0.3, 0.29, 0.27, name), text("fin", p.c, 0.65, 0.45, 0.3, code(name, iata), 1, 1)); return lv; } },
  { id: "retro", name: "Retro-Streifen", desc: "Drei Streifen in Rumpfmitte, Leitwerk im gleichen Muster.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.items.push(band("fuselage", p.a, 0.46, 0.52), band("fuselage", p.b, 0.53, 0.59), band("fuselage", p.c, 0.6, 0.65), band("fin", p.a, 0.3, 0.45), band("fin", p.b, 0.47, 0.62), band("fin", p.c, 0.64, 0.78), band("engine", p.a, 0.3, 0.45), band("engine", p.b, 0.5, 0.65), text("fuselage", p.ink, 0.3, 0.29, 0.24, name)); return lv; } },
  { id: "twotone", name: "Zweiton", desc: "Oben Farbe, unten Weiß, geteilt auf Fensterhöhe.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.a; lv.base.stab = p.a; lv.items.push(band("fuselage", p.a, -0.02, 0.5), band("fuselage", p.c, 0.5, 0.53), text("fuselage", p.c, 0.32, 0.27, 0.26, name), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata), 1, 1)); return lv; } },
  { id: "solid", name: "Vollton", desc: "Ganzer Rumpf in Farbe, weiße Schrift – fällt auf.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fuselage = p.a; lv.base.fin = p.b; lv.base.engine = p.b; lv.base.stab = p.a; lv.items.push(text("fuselage", p.c, 0.32, 0.29, 0.28, name), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata), 1, 1)); return lv; } },
  { id: "metal", name: "Metallic", desc: "Silberner Rumpf mit dunkler Zierlinie, Leitwerk in Farbe.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fuselage = "#d9dde3"; lv.base.engine = "#d9dde3"; lv.base.stab = "#d9dde3"; lv.base.wing = "#d9dde3"; lv.base.fin = p.a; lv.items.push(band("fuselage", p.a, 0.47, 0.52), band("fuselage", p.b, 0.52, 0.55), text("fuselage", p.ink, 0.3, 0.29, 0.25, name), text("fin", p.c, 0.62, 0.5, 0.3, code(name, iata))); return lv; } },
  { id: "special", name: "Sonderlackierung", desc: "Verspielte Blöcke und Linien – Basis für eine Jubiläums- oder Werbelackierung.",
    make: (p, name, iata) => { const lv = whiteLivery(); lv.base.fin = p.b; lv.base.engine = p.c === "#ffffff" ? p.a : p.c; lv.items.push(band("fuselage", p.a, 0.7, 1.02), line("fuselage", p.b, 0.08, [[0.05, 0.7], [0.5, 0.7]]), line("fuselage", p.c === "#ffffff" ? p.b : p.c, 0.06, [[0.5, 0.62], [0.95, 0.62]]), brush("fuselage", p.b, 0.2, [[0.62, 0.0], [0.68, 0.25], [0.74, 0.0]]), brush("fuselage", p.a, 0.2, [[0.72, 0.0], [0.78, 0.25], [0.84, 0.0]]), text("fuselage", p.ink, 0.3, 0.29, 0.26, name), text("fin", p.c, 0.6, 0.5, 0.34, code(name, iata), 1, 1)); return lv; } }
];

export function presetLivery(schemeId, paletteId, name, iata) {
  const sc = SCHEMES.find(s => s.id === schemeId) || SCHEMES[0];
  const p = PALETTES.find(x => x.id === paletteId) || PALETTES[0];
  const lv = sc.make(p, name || "Airline", iata);
  lv.preset = { scheme: sc.id, palette: p.id };
  return lv;
}
