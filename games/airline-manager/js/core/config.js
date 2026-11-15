// Zentrale Spielbalance. Alle Stellschrauben an einem Ort – Werte hier ändern, nicht im Code verstreuen.
// Geld immer in USD, Gewichte in kg, Zeiten in Millisekunden (Echtzeit) bzw. Stunden (h).

export const H = 3600_000;          // 1 Stunde in ms
export const DAY = 24 * H;

export const GAME = {
  version: 1,                        // Save-Format-Version, siehe core/store.js → migrate()
  saveKey: "am-save",
  startCash: 200_000_000,
  startShares: 10_000_000,           // Aktien pro Airline beim Börsengang
  maxCatchupDays: 30,                // so weit rechnet das Spiel nach längerer Abwesenheit maximal nach
  label: "v0.15",
  instantDeliveries: 5,              // die ersten 5 Flugzeuge kommen sofort – schneller Einstieg
  // Danach Lieferzeiten in Echtzeit-Stunden: Endmontage-Slot, Abnahmeflüge, Überführung, Zulassung.
  // (Echte Auftragsbestände liegen bei Jahren – hier auf spielbare Tage verdichtet.)
  newDeliveryH: { narrow: 72, wide: 120, jumbo: 168 },
  orderStaggerH: 24,                 // jedes weitere Flugzeug derselben Bestellung kommt einen Tag später
  usedDeliveryH: 24,                 // Gebraucht: Übergabe-Check, Umregistrierung, Überführungsflug
  marketShare: 0.30                  // Anteil am Gesamtmarkt einer Strecke, den eine Spieler-Airline bedienen kann
};

// Flugzeit = feste Rollzeit/Steig-/Sinkanteil + Strecke × Umwegfaktor / Reisegeschwindigkeit
export const FLIGHT = {
  fixedH: 0.5,
  routingFactor: 1.05,
  turnaroundMin: { narrow: 45, wide: 90, jumbo: 120 },
  paxWeightKg: 100,                  // Passagier inkl. Gepäck
  aux: { maxTanks: 2, rangeBonus: 0.07, payloadCostKg: 2500, priceM: 1.5 } // Zusatztank (ACT) pro Flugzeug
};

// Kabine: wie viele "Sitzeinheiten" belegt ein Sitz. Budget = seatsMax des Typs.
export const CABIN = {
  classes: ["f", "j", "w", "y"],
  names: { f: "First", j: "Business", w: "Premium Eco", y: "Economy" },
  units: { f: 5, j: 3, w: 1.35, y: 1 },
  denseThreshold: 0.93,              // Auslastung des Budgets, ab der die Kabine als "eng" gilt (Reputation -)
  // Referenzpreis = base + perKm × Distanz, multipliziert pro Klasse
  refFare: { base: 60, perKm: 0.07, mul: { f: 6, j: 3.6, w: 1.7, y: 1 } },
  elasticity: { f: 0.6, j: 0.8, w: 1.2, y: 1.5 }
};

export const DEMAND = {
  k: 200,
  tourismWeight: 2,
  seasonAmp: 0.5,                    // ±50 % auf Urlaubsnachfrage über das Jahr
  xmasBoost: 0.15,
  weekday: [0.9, 1.1, 1.1, 1.1, 1.1, 1.15, 0.7], // So..Sa, wirkt auf Geschäftsreisende
  noise: 0.1                         // ±10 % Schwankung pro Flug (deterministisch)
};

export const CARGO = {
  yieldBase: 0.2, yieldPerKm: 0.00025, // USD pro kg
  loadFactor: [0, 0.35, 0.45, 0.55, 0.65, 0.75] // nach Flughafen-Tier (max beider Enden)
};

export const FEES = {
  landingPerT: [0, 4, 5, 6, 8, 10],          // USD pro t MTOW, nach Tier
  paxFee: [0, 6, 9, 12, 16, 20],             // USD pro abfliegendem Passagier
  handlingPerPax: 6,
  turnaroundBase: { narrow: 900, wide: 2500, jumbo: 4000 },
  navPerKm: 0.6,                             // Flugsicherung: USD pro km × √(MTOW/50 t)
  distribution: 0.08                         // Vertrieb (GDS, Provisionen, Zahlungsgebühren) vom Ticketumsatz
};

export const STAFF = {
  pilotPerH: 250, cabinPerH: 70,             // pro Blockstunde
  techPerDay: 420,                           // fix pro Techniker und Tag
  extraPilots: [[8, 3], [12, 4]],            // ab x Blockstunden y Piloten (Ruhecrew)
  training: {                                // Schulungsstufen, Gebühr pro Mitarbeiter beim Aufstieg
    levels: ["Basis", "Standard", "Premium", "Exzellenz"],
    feePerEmployee: [0, 2500, 6000, 12000],
    wageBonus: 0.05,                         // +5 % Lohn pro Stufe
    rep: [0, 4, 8, 12]
  },
  crewSetsPerAircraft: 5                     // für die Mitarbeiterzählung (Schichten/Rotation)
};

export const FIXED = { insurancePerMPerDay: 25, parkingPerDay: { narrow: 150, wide: 400, jumbo: 700 } };

export const CATERING = {
  modes: {
    free:  { label: "Inklusive",          rep: 8,  costPerPax: { f: 90, j: 40, w: 15, y: 8 }, salesPerPax: { f: 0, j: 0, w: 0, y: 0 } },
    mixed: { label: "Premium inklusive",  rep: 2,  costPerPax: { f: 90, j: 40, w: 15, y: 2 }, salesPerPax: { f: 0, j: 0, w: 0, y: 4 } },
    buy:   { label: "Buy on Board",       rep: -6, costPerPax: { f: 30, j: 12, w: 2,  y: 2 }, salesPerPax: { f: 0, j: 0, w: 5, y: 5 } }
  },
  defaultMode: "mixed"
};

export const BAGS = { defaultFee: 25, maxFee: 120, takeRate: 0.55, decay: 60, repPerUsd: 0.15, repCap: 15 };

export const FUEL = {
  basePerKg: 0.78,
  spotPremium: 0.15,                         // Aufschlag wenn das Tanklager leer ist
  depot: [                                   // Ausbaustufen Tanklager
    { capT: 500, price: 0 },
    { capT: 1500, price: 2e6 },
    { capT: 4000, price: 6e6 },
    { capT: 10000, price: 15e6 },
    { capT: 25000, price: 40e6 }
  ],
  startStockT: 300
};

// Wartung: fällig nach Flugstunden ODER Kalendertagen (was zuerst kommt). down = Standzeit in Echtzeit-Stunden.
export const CHECKS = {
  order: ["A", "B", "C", "D"],
  A: { fh: 600,   days: 75,   downH: 10,      cost: { narrow: 60e3,  wide: 150e3, jumbo: 250e3 }, risk: 0.6 },
  B: { fh: 2000,  days: 240,  downH: 36,      cost: { narrow: 180e3, wide: 450e3, jumbo: 700e3 }, risk: 0.8 },
  C: { fh: 7500,  days: 730,  downH: 24 * 21, cost: { narrow: 1.5e6, wide: 3e6,   jumbo: 4.5e6 }, risk: 1.0 },
  D: { fh: 30000, days: 2190, downH: 24 * 42, cost: { narrow: 5e6,   wide: 12e6,  jumbo: 18e6 },  risk: 1.3 },
  warnFH: 50, warnDays: 7,
  riskPerFH: 0.0005,                         // Absturzrisiko pro Flugstunde bei 100 % Überfälligkeit (× Gewicht)
  riskExp: 1.5,
  incidentMul: 6                             // nicht-tödliche Vorfälle sind so viel häufiger
};

export const CONTRACT = {
  baseDiscount: 0.06,
  volume: [[3, 0.03], [5, 0.06], [10, 0.10]], // ab Stückzahl zusätzlicher Rabatt
  maintDiscount: 0.15,
  cancelFee: 25e6
};

export const REPUTATION = {
  start: 50, ema: 0.01,
  priceFair: { good: 0.9, bad: 1.3, bonus: 10, malus: 15 },
  dense: -10,
  crash: { hit: -40, halfLifeDays: 60 },
  incident: { hit: -8, halfLifeDays: 20 },
  safeBonusMax: 8, safeBonusPerDays: 30,     // +1 pro 30 unfallfreien Tagen, max +8
  demandMin: 0.6, demandSpan: 0.8            // Nachfragefaktor = min + span × rep/100
};

export const USED = { listings: 18, maxAge: 28, depreciation: 0.92, floor: 0.08, insuranceRefund: 0.6 };

export const STOCKS = { profitMultiple: 3, repWeight: 0.4, minPrice: 0.5, fee: 0.005, refreshMs: 60_000 };
