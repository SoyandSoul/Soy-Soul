// Flugzeugkatalog Airbus + Boeing.
// Alle Werte sind Richtwerte aus Herstellerangaben (Aircraft Characteristics / Airport Planning Docs,
// Listenpreise). Vor dem Release gegen die AC-Dokumente prüfen, siehe README → "Daten prüfen".
//
// Einheitliche Felder pro Typ:
//   seats      typische 2-Klassen-Bestuhlung        seatsMax  Zulassungsgrenze (Notausgänge)
//   rangeKm    Reichweite mit typischer Kabine      cruiseKmh Reisegeschwindigkeit
//   runwayM    Startstrecke bei MTOW (ISA, MSL)     fuelKgH   Verbrauch im Reiseflug pro Blockstunde
//   payloadKg  max. Nutzlast (Pax + Gepäck + Fracht) mtowT    max. Abfluggewicht in t
//   priceM     Listenpreis in Mio. USD              maintFH   Wartungsreserve (Line + Teile) in USD pro Flugstunde
//   crew       Cockpit / min. Kabine / Techniker pro Flugzeug
//   art        Geometrie für den einheitlichen SVG-Zeichner (Länge, Spannweite, Triebwerke …)
//   inProd     false = nur noch gebraucht erhältlich

const A = "Airbus", B = "Boeing";

// [id, maker, family, name, seats, seatsMax, rangeKm, cruiseKmh, runwayM, fuelKgH, payloadKg, mtowT, priceM, maintFH, lengthM, spanM, engines, inProd, extra]
const RAW = [
  ["a220-100", A, "A220", "A220-100", 120, 135, 6390, 829, 1463, 1700, 15100, 63.1, 81.0, 700, 35.0, 35.1, 2, true],
  ["a220-300", A, "A220", "A220-300", 140, 160, 6300, 829, 1890, 1900, 18700, 70.9, 91.5, 720, 38.7, 35.1, 2, true],
  ["a319neo", A, "A320", "A319neo", 140, 160, 6850, 828, 2000, 2000, 17700, 75.5, 101.5, 820, 33.8, 35.8, 2, true, { sharklet: 1 }],
  ["a320ceo", A, "A320", "A320ceo", 165, 180, 6100, 828, 2100, 2500, 19900, 78.0, 101.0, 980, 37.6, 34.1, 2, false],
  ["a320neo", A, "A320", "A320neo", 165, 194, 6300, 828, 2100, 2200, 20000, 79.0, 110.6, 850, 37.6, 35.8, 2, true, { sharklet: 1 }],
  ["a321neo", A, "A320", "A321neo", 206, 244, 7400, 828, 2300, 2500, 25500, 97.0, 129.5, 950, 44.5, 35.8, 2, true, { sharklet: 1 }],
  ["a321xlr", A, "A320", "A321XLR", 200, 220, 8700, 828, 2600, 2600, 23000, 101.0, 142.0, 980, 44.5, 35.8, 2, true, { sharklet: 1 }],
  ["a330-200", A, "A330", "A330-200", 247, 406, 13450, 871, 2770, 5600, 49000, 242.0, 238.5, 2300, 58.8, 60.3, 2, false],
  ["a330-300", A, "A330", "A330-300", 277, 440, 11750, 871, 2500, 5700, 45600, 242.0, 264.2, 2300, 63.7, 60.3, 2, false],
  ["a330-900", A, "A330", "A330-900", 287, 460, 13330, 871, 2770, 5100, 46000, 251.0, 296.4, 2100, 63.7, 64.0, 2, true, { sharklet: 1 }],
  ["a340-300", A, "A340", "A340-300", 277, 440, 13500, 871, 3000, 6400, 51000, 276.5, 238.0, 3000, 63.7, 60.3, 4, false],
  ["a350-900", A, "A350", "A350-900", 315, 440, 15000, 903, 2600, 5800, 53300, 283.0, 317.4, 2300, 66.8, 64.8, 2, true, { curvedTip: 1 }],
  ["a350-1000", A, "A350", "A350-1000", 369, 480, 16100, 903, 2750, 6800, 68000, 322.0, 366.5, 2600, 73.8, 64.8, 2, true, { curvedTip: 1 }],
  ["a380-800", A, "A380", "A380-800", 545, 853, 14800, 903, 3000, 11500, 84000, 575.0, 445.6, 4800, 72.7, 79.8, 4, false, { deck2: 1 }],

  ["b737-700", B, "737", "737-700", 128, 149, 6370, 828, 1900, 2300, 20100, 70.1, 89.1, 1000, 33.6, 35.8, 2, false, { winglet: 1 }],
  ["b737-800", B, "737", "737-800", 162, 189, 5440, 828, 2300, 2530, 21300, 79.0, 106.1, 1000, 39.5, 35.8, 2, false, { winglet: 1 }],
  ["b737-max7", B, "737", "737 MAX 7", 153, 172, 7130, 839, 2100, 2100, 18000, 80.3, 99.7, 860, 35.6, 35.9, 2, true, { winglet: 2 }],
  ["b737-max8", B, "737", "737 MAX 8", 172, 210, 6570, 839, 2500, 2200, 21500, 82.2, 121.6, 870, 39.5, 35.9, 2, true, { winglet: 2 }],
  ["b737-max9", B, "737", "737 MAX 9", 193, 220, 6570, 839, 2600, 2350, 23000, 88.3, 128.9, 900, 42.2, 35.9, 2, true, { winglet: 2 }],
  ["b737-max10", B, "737", "737 MAX 10", 204, 230, 6110, 839, 2700, 2450, 24000, 89.8, 134.9, 920, 43.8, 35.9, 2, true, { winglet: 2 }],
  ["b757-200", B, "757", "757-200", 200, 239, 7250, 850, 2070, 3300, 25900, 115.7, 90.0, 1500, 47.3, 38.1, 2, false, { winglet: 1 }],
  ["b767-300er", B, "767", "767-300ER", 218, 290, 11070, 851, 2650, 4800, 43800, 186.9, 217.9, 2000, 54.9, 47.6, 2, true, { winglet: 1 }],
  ["b777-200er", B, "777", "777-200ER", 313, 440, 13080, 892, 3100, 6800, 54200, 297.6, 306.6, 2800, 63.7, 60.9, 2, false],
  ["b777-300er", B, "777", "777-300ER", 396, 550, 13650, 892, 3050, 7500, 69900, 351.5, 375.5, 3000, 73.9, 64.8, 2, false],
  ["b777-9", B, "777X", "777-9", 426, 495, 13500, 905, 3000, 7100, 73000, 351.5, 442.2, 2900, 76.7, 71.8, 2, true, { foldTip: 1 }],
  ["b787-8", B, "787", "787-8", 248, 359, 13530, 903, 2600, 4900, 43300, 228.0, 248.3, 2000, 56.7, 60.1, 2, true, { raked: 1 }],
  ["b787-9", B, "787", "787-9", 296, 406, 14010, 903, 2800, 5500, 52600, 254.0, 292.5, 2200, 62.8, 60.1, 2, true, { raked: 1 }],
  ["b787-10", B, "787", "787-10", 336, 440, 11730, 903, 2900, 5900, 57300, 254.0, 338.4, 2400, 68.3, 60.1, 2, true, { raked: 1 }],
  ["b747-400", B, "747", "747-400", 416, 660, 13490, 913, 3300, 10200, 62900, 396.9, 266.0, 4200, 70.7, 64.4, 4, false, { hump: 1, winglet: 1 }],
  ["b747-8i", B, "747", "747-8 Intercontinental", 410, 605, 14310, 917, 3100, 9600, 76000, 447.7, 418.4, 3800, 76.3, 68.4, 4, true, { hump: 1.3, raked: 1 }]
];

/** Größenklasse steuert Turnaround, Gebühren, Check-Kosten und Technikerbedarf. */
function sizeClass(seats, engines, extra) {
  if (extra?.deck2 || seats >= 400) return "jumbo";
  if (seats >= 230) return "wide";
  return "narrow";
}

export const AIRCRAFT = RAW.map(r => {
  const [id, maker, family, name, seats, seatsMax, rangeKm, cruiseKmh, runwayM, fuelKgH, payloadKg, mtowT, priceM, maintFH, lengthM, spanM, engines, inProd, extra = {}] = r;
  const size = sizeClass(seats, engines, extra);
  return {
    id, maker, family, name, seats, seatsMax, rangeKm, cruiseKmh, runwayM, fuelKgH, payloadKg, mtowT, priceM, maintFH, inProd, size,
    crew: {
      pilots: 2,                                   // pro Flug; Langstrecke > 8 h wird in sim/crew.js aufgestockt
      cabin: Math.max(1, Math.ceil(seatsMax / 50)), // gesetzliches Minimum 1 FA pro 50 Sitze
      techs: size === "narrow" ? 6 : size === "wide" ? 10 : 14
    },
    art: { lengthM, spanM, engines, ...extra }
  };
});

export const AIRCRAFT_BY_ID = Object.fromEntries(AIRCRAFT.map(a => [a.id, a]));
export const MAKERS = [A, B];

/** Verweise auf die offiziellen Quellen – für Datenprüfung und Zeichnungs-Pipeline (tools/). */
export const SOURCES = {
  [A]: {
    characteristics: "https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/aircraft-characteristics",
    drawings: "https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/autocad-3-view-aircraft-drawings"
  },
  [B]: {
    characteristics: "https://www.boeing.com/commercial/airports/plan-manuals",
    drawings: "https://www.boeing.com/commercial/airports/3-view"
  }
};
