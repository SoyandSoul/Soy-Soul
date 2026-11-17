// Zentrale Spielbalance. Alle Stellschrauben an einem Ort – Werte hier ändern, nicht im Code verstreuen.
// Geld immer in USD, Gewichte in kg, Zeiten in Millisekunden (Echtzeit) bzw. Stunden (h).

export const H = 3600_000;          // 1 Stunde in ms
export const DAY = 24 * H;

export const GAME = {
  version: 1,                        // Save-Format-Version, siehe core/store.js → migrate()
  saveKey: "am-save",
  // Startkapital einer jungen Airline: genug für ein paar Leasingkautionen, Personal und Puffer –
  // ein Flugzeug zu kaufen ist anfangs bewusst außer Reichweite (siehe sim/lease.js).
  startCash: 12_000_000,
  startShares: 10_000_000,           // Aktien pro Airline beim Börsengang
  maxCatchupDays: 30,                // so weit rechnet das Spiel nach längerer Abwesenheit maximal nach
  label: "v0.19",
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
  // Referenzpreis = base + perKm × km, wobei der Ertrag je km ab taperFrom degressiv abnimmt
  // (Langstrecke bringt pro Kilometer weniger als Kurzstrecke – siehe sim/demand.js → refFare).
  refFare: { base: 60, perKm: 0.105, taperFrom: 900, taperExp: 0.30, mul: { f: 6, j: 3.6, w: 1.7, y: 1 } },
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
  yieldBase: 0.09, yieldPerKm: 0.00011, // USD pro kg (Beifracht im Bauch, nicht Frachterbetrieb)
  loadFactor: [0, 0.35, 0.45, 0.55, 0.65, 0.75] // nach Flughafen-Tier (max beider Enden)
};

export const FEES = {
  landingPerT: [0, 3.2, 4, 4.8, 6.4, 8],     // USD pro t MTOW, nach Tier
  paxFee: [0, 5, 7, 9.5, 13, 16],            // USD pro abfliegendem Passagier
  handlingPerPax: 6,
  turnaroundBase: { narrow: 900, wide: 2500, jumbo: 4000 },
  navPerKm: 0.6,                             // Flugsicherung: USD pro km × √(MTOW/50 t)
  distribution: 0.08                         // Vertrieb (GDS, Provisionen, Zahlungsgebühren) vom Ticketumsatz
};

// Personal. Vier Gruppen, die der Spieler selbst einstellt – der Bedarf wächst mit Flotte und Zielen.
// (Techniker laufen weiter automatisch über FIXED/techPerDay; sie werden im Technikhangar-Paket eigenständig.)
export const STAFF = {
  groups: {
    cockpit: { label: "Cockpit",     short: "Piloten",       salaryPerDay: 780, hireFee: 9000, severance: 14000 },
    cabin:   { label: "Kabine",      short: "Flugbegleiter", salaryPerDay: 315, hireFee: 2400, severance: 3600 },
    ground:  { label: "Boden",       short: "Bodenpersonal", salaryPerDay: 270, hireFee: 1400, severance: 2100 },
    admin:   { label: "Verwaltung",  short: "Büro",          salaryPerDay: 470, hireFee: 3600, severance: 5400 }
  },
  // Personalbedarf. Cockpit/Kabine decken Schichten, Urlaub und Reserve ab (deshalb Vielfache der Flugcrew).
  need: {
    cockpitPerAircraft: { narrow: 10, wide: 18, jumbo: 24 },
    cabinSets: 5,                            // × vorgeschriebene Kabinenbesatzung des Typs
    groundPerAircraft: 3,
    groundPerDestination: 5,                 // eigene Station je angeflogenem Ziel
    adminPerAircraft: 3,
    adminShare: 0.10                         // + 10 % der übrigen Belegschaft
  },
  // Unterbesetzung: ab unter 95 % Besetzung wird es spürbar, bei 0 % gelten die vollen Werte.
  shortage: {
    grace: 0.95,
    delayMinFlightCrew: 150,                 // Cockpit/Kabine fehlen → Verspätung je Umlauf
    delayMinGround: 90,                      // Boden fehlt → längerer Turnaround
    repMalus: 20,
    adminSurcharge: 0.15,
    minToAssign: 0.6                         // unter 60 % Besetzung lässt sich kein Flugzeug in Dienst stellen                     // fehlende Verwaltung verteuert Handling und Vertrieb
  },
  allowancePerH: { pilot: 60, cabin: 20 },   // Spesen pro Blockstunde zusätzlich zum Gehalt
  hireDelayH: 0,                             // Einstellung wirkt sofort (Lieferzeiten gibt es schon bei Flugzeugen)
  techPerDay: 420,                           // fix pro Techniker und Tag
  extraPilots: [[8, 3], [12, 4]],            // ab x Blockstunden y Piloten im Cockpit (Ruhecrew)
  training: {                                // Schulungsstufen, Gebühr pro Mitarbeiter beim Aufstieg
    levels: ["Basis", "Standard", "Premium", "Exzellenz"],
    feePerEmployee: [0, 2500, 6000, 12000],
    wageBonus: 0.05,                         // +5 % Gehalt pro Stufe
    rep: [0, 4, 8, 12]
  }
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

// Flottenvereinheitlichung: Wer nur eine Baureihe fliegt, spart real bei Ersatzteilen, Schulung und
// Crew-Planung (gemeinsames Type Rating). Ein Flickenteppich kostet dagegen Aufschlag.
export const COMMONALITY = {
  maintBonus: 0.18,          // bis −18 % Wartungsreserve bei reiner Einheitsflotte
  cockpitBonus: 0.15,        // bis −15 % Cockpit-Bedarf (ein Pilotenpool statt vieler)
  trainingBonus: 0.25,       // bis −25 % Schulungs- und Einstellungskosten
  penaltyFrom: 4,            // ab so vielen Baureihen beginnt der Aufschlag
  penaltyPerFamily: 0.04,    // je weiterer Baureihe
  penaltyMax: 0.20,
  minFleet: 3                // darunter gibt es weder Bonus noch Malus
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

export const USED = {
  listings: 18, maxAge: 28, depreciation: 0.92, floor: 0.08, insuranceRefund: 0.6,
  // Zustand gebrauchter Flugzeuge (cond 0..1, aus Alter + Stunden). Bei cond = 0 gelten die vollen Abschläge:
  cond: {
    min: 0.35,                               // schlechtester Zustand auf dem Markt
    rangeLoss: 0.12,                         // −12 % Reichweite (Triebwerksverschleiß, Zusatzgewicht)
    fuelExtra: 0.14,                         // +14 % Verbrauch
    faultPerBlockH: 0.03,                    // Defektwahrscheinlichkeit pro Blockstunde (× (1 − cond))
    faultCost: { narrow: 45e3, wide: 120e3, jumbo: 200e3 }, // ungeplante Reparatur
    faultDelayH: [2, 9],                     // Standzeit danach (Spanne, deterministisch gewürfelt)
    valueLoss: 0.35                          // Restwert sinkt um bis zu 35 %
  }
};

// Leasing. In der Realität besitzen die meisten Airlines ihre Flotte nicht, sondern mieten sie bei
// Gesellschaften wie AerCap oder Air Lease. Statt des Kaufpreises zahlt man Kaution und Monatsrate,
// dazu Wartungsrücklagen pro Flugstunde. Dafür bindet das Flugzeug kein Kapital.
export const LEASE = {
  ratePerMonth: 0.0095,              // Monatsrate als Anteil am Marktwert (echte Operating Leases: 0,8–1,0 %)
  monthDays: 30.4,
  terms: [                           // kurze Laufzeit = teurer, der Leasinggeber trägt das Wiedervermarktungsrisiko
    { months: 3,  factor: 1.35 },
    { months: 6,  factor: 1.15 },
    { months: 12, factor: 1.00 },
    { months: 24, factor: 0.88 }
  ],
  defaultTerm: 12,
  depositMonths: 2,                  // Kaution, bei ordentlicher Rückgabe erstattet
  reservePerFH: { narrow: 190, wide: 390, jumbo: 560 },  // Wartungsrücklage an den Leasinggeber je Flugstunde
  earlyReturnMonths: 3,              // so viele Monatsraten werden bei vorzeitiger Rückgabe fällig (höchstens)
  returnPenaltyPerFH: 900,           // überfällige Checks bei der Rückgabe
  buyoutFactor: 1.08,                // Herauskaufen aus dem Vertrag: Marktwert plus Aufschlag
  extendFactor: 1.06,                // automatische Verlängerung wird etwas teurer
  saleLeasebackFactor: 0.94,         // Sale-and-Leaseback: eigenes Flugzeug verkaufen und zurückmieten
  deliveryH: 36,                     // Übergabe eines Leasingflugzeugs
  // Leasingrahmen: Leasinggeber schauen auf den Zahlungsstrom, nicht auf das Guthaben.
  frame: { base: 1_100_000, profitMultiple: 1.8, repLow: 0.6, repSpan: 0.8 }
};

export const STOCKS = { profitMultiple: 3, repWeight: 0.4, minPrice: 0.5, fee: 0.005, refreshMs: 60_000 };
