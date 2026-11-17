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
  label: "v0.27",
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

// Bodenabfertigung. In der Realität kaufen Airlines das an fast allen Stationen zu – vom billigen
// Dienstleister bis zum Premiumanbieter mit eigener Crew. Das entscheidet über Standzeit und Pünktlichkeit.
export const HANDLERS = {
  budget: {
    label: "Sparanbieter", short: "günstig",
    desc: "Knapp besetzt und oft im Verzug. Gepäck geht häufiger verloren, Gäste warten.",
    turnaround: 1.25,            // Faktor auf die Standzeit
    delayChance: 0.22,           // Wahrscheinlichkeit je Umlauf für zusätzliche Verspätung
    delayMin: [15, 55],          // Spanne dieser Verspätung
    costFactor: 0.7,             // Faktor auf Turnaround- und Handlingkosten
    rep: -7
  },
  standard: {
    label: "Standardabfertiger", short: "ausgewogen",
    desc: "Solide Arbeit zu üblichen Konditionen – der Normalfall an den meisten Flughäfen.",
    turnaround: 1.0, delayChance: 0.08, delayMin: [10, 30], costFactor: 1.0, rep: 0
  },
  premium: {
    label: "Premiumabfertiger", short: "teuer",
    desc: "Eigene Teams, Priorität am Gate, kaum Verzug. Gäste merken den Unterschied.",
    turnaround: 0.82, delayChance: 0.02, delayMin: [5, 15], costFactor: 1.55, rep: 7
  },
  // Schnellabfertigung auf Zuruf: Priorität am Gate gegen Aufpreis, verkürzt die laufende Standzeit.
  rush: { cut: 0.45, costPerSeat: 26, minCost: 400, repPerUse: 0 },
  default: "standard"
};

export const CATERING = {
  modes: {
    free:  { label: "Inklusive",          rep: 8,  costPerPax: { f: 90, j: 40, w: 15, y: 8 }, salesPerPax: { f: 0, j: 0, w: 0, y: 0 } },
    mixed: { label: "Premium inklusive",  rep: 2,  costPerPax: { f: 90, j: 40, w: 15, y: 2 }, salesPerPax: { f: 0, j: 0, w: 0, y: 4 } },
    buy:   { label: "Buy on Board",       rep: -6, costPerPax: { f: 30, j: 12, w: 2,  y: 2 }, salesPerPax: { f: 0, j: 0, w: 5, y: 5 } }
  },
  defaultMode: "mixed"
};

export const BAGS = { defaultFee: 25, maxFee: 120, takeRate: 0.55, decay: 60, repPerUsd: 0.15, repCap: 15 };

// Kalender: wie stark Feiertage und Ferien auf die Nachfrage schlagen.
// 1 = voller Effekt wie in sim/calendar.js hinterlegt, darunter gedämpft.
export const CALENDAR = { weight: 0.7 };

// Ereignisse in der Welt. Alles erfunden – keine realen Vorfälle, keine realen Namen.
// chance = Wahrscheinlichkeit, dass diese Art in einer Woche irgendwo auftritt.
export const EVENTS = {
  kinds: [
    { id: "strike", label: "Streik", chance: 0.22, hours: [8, 26], closes: true, scope: "airport",
      text: "Arbeitsniederlegung der Bodendienste in {ort} – der Flughafen {iata} ist vorerst dicht." },
    { id: "atc", label: "Luftraumsperrung", chance: 0.14, hours: [4, 14], closes: true, scope: "country",
      text: "Ausfall der Flugsicherung über {ort} – der Luftraum des Landes ist gesperrt." },
    { id: "storm", label: "Unwetterlage", chance: 0.35, hours: [6, 20], closes: false, scope: "airport",
      costFactor: 1.25, demand: 0.9,
      text: "Schwere Unwetter über {ort}: Enteisung, Umläufe, Verspätungen – der Betrieb wird teuer." },
    { id: "slump", label: "Nachfrageeinbruch", chance: 0.18, hours: [72, 240], closes: false, scope: "country",
      demand: 0.78,
      text: "Konjunkturdelle rund um {ort} – spürbar weniger Buchungen im ganzen Land." },
    { id: "boom", label: "Großveranstaltung", chance: 0.2, hours: [48, 170], closes: false, scope: "airport",
      demand: 1.3,
      text: "Großveranstaltung in {ort}: Hotels ausgebucht, Flüge gefragt." }
  ],
  // Ausweichlandung: selten, aber teuer und schlecht für den Ruf
  divert: { chance: 0.012, delayMin: [90, 220], baseCost: 42_000, rep: -3 }
};

// Schnellstart: Die ersten Flüge laufen im Zeitraffer, damit nicht eine Stunde nichts passiert.
export const BOOST = { legs: 10, factor: 4 };

// Bodenbetrieb auf der Karte: rein optisch, ohne Einfluss auf die Abrechnung.
export const GROUND = {
  zoom: 11,          // ab diesem Zoom werden Bahnen, Vorfeld und Rollwege gezeichnet
  gates: 12,         // Gatepositionen je Flughafen
  taxiMin: 8,        // Rollzeit in Minuten
  rollSec: 35        // Startlauf in Sekunden
};

// Kredite. Der Zins ist der eigentliche Hebel: Wer wenig verdient, viel schuldet oder einen
// schlechten Ruf hat, zahlt deutlich mehr. Ein Kredit ist nie gratis Geld.
export const CREDIT = {
  monthDays: 30.4,
  terms: [12, 24, 60],
  termPremium: { 12: 0, 24: 0.004, 60: 0.011 },
  base: 0.049,                 // Grundzins pro Jahr
  repSpan: 0.055,              // bis +5,5 Punkte bei Ruf 0
  leverageSpan: 0.06,          // bis +6 Punkte, wenn der Rahmen ausgereizt ist
  fee: 0.012,                  // Bearbeitungsgebühr auf die Summe
  earlyFee: 0.02,              // Vorfälligkeitsentschädigung auf die Restschuld
  profitMultiple: 6,           // Ertrag der letzten 30 Tage × … = Rahmen (gut ein halbes Jahr)
  fleetShare: 0.5,             // eigene Flugzeuge sind Sicherheit
  valueShare: 0.2,             // Kasse und Vorräte nur anteilig, Firmenwert gar nicht
  loadMultiple: 5,             // minus das Vielfache der monatlichen Verpflichtungen
  minAmount: 500_000,
  missedPenalty: 0.03,         // Zuschlag auf die verpasste Rate
  missedRep: 4                 // Rufverlust je verpasster Rate
};

// Drehkreuz-Ausbau. Einmal bauen, danach Unterhalt pro Tag – die nächste Stufe lohnt sich
// deshalb erst ab einer gewissen Größe. Gilt je Flughafen, nicht für die Airline.
export const HUB = {
  gates: {
    label: "Gates", icon: "gate",
    stages: [
      { label: "Vorfeldpositionen", price: 0, upkeep: 0, turnaround: 1.1, delay: 1.15, rep: -2,
        note: "Bus zum Flugzeug, Treppe statt Brücke. Kostet nichts und merkt man." },
      { label: "Fluggastbrücken", price: 4_000_000, upkeep: 1800, turnaround: 1, delay: 1, rep: 0,
        note: "Eigene Brücken an den Standardpositionen. Der Normalfall." },
      { label: "Eigener Flugsteig", price: 15_000_000, upkeep: 6500, turnaround: 0.92, delay: 0.8, rep: 3,
        note: "Zusammenhängender Bereich mit eigenen Abläufen. Spürbar kürzere Standzeiten." },
      { label: "Eigenes Terminal", price: 44_000_000, upkeep: 19_000, turnaround: 0.86, delay: 0.6, rep: 7,
        note: "Alles unter eigener Regie, kurze Wege, eigene Gepäckanlage." }
    ]
  },
  lounge: {
    label: "Lounges", icon: "offer",
    stages: [
      { label: "Keine Lounge", price: 0, upkeep: 0, rep: 0, premium: 1,
        note: "Wer vorne sitzt, wartet im Terminal wie alle anderen." },
      { label: "Kleine Lounge", price: 2_500_000, upkeep: 1500, rep: 2, premium: 1.06,
        note: "Ein Raum, Getränke, Zeitungen. Besser als nichts." },
      { label: "Business Lounge", price: 9_000_000, upkeep: 5200, rep: 5, premium: 1.14,
        note: "Warmes Buffet, Duschen, Arbeitsplätze. Business-Reisende buchen dafür um." },
      { label: "First Lounge", price: 26_000_000, upkeep: 15_000, rep: 8, premium: 1.24,
        note: "Eigener Bereich mit Bedienung, Ruheräume, Fahrdienst ans Flugzeug." }
    ]
  },
  hangar: {
    label: "Technik", icon: "wrench",
    stages: [
      { label: "Fremdwartung", price: 0, upkeep: 0, downH: 1, cost: 1, techs: 1, slots: 0,
        note: "Checks werden eingekauft. Voller Preis, volle Standzeit." },
      { label: "Linienhangar", price: 7_000_000, upkeep: 3400, downH: 0.85, cost: 0.9, techs: 0.92, slots: 4,
        note: "Eine Halle, eigene Mechaniker. Kleine Checks laufen über Nacht." },
      { label: "Werft", price: 20_000_000, upkeep: 11_000, downH: 0.7, cost: 0.78, techs: 0.84, slots: 10,
        note: "Zwei Hallen mit Schichtbetrieb. Auch C-Checks im eigenen Haus." },
      { label: "Großwerft", price: 52_000_000, upkeep: 29_000, downH: 0.55, cost: 0.65, techs: 0.75, slots: 22,
        note: "Eigene Werft mit Triebwerksstand. Selbst D-Checks bleiben im Haus." }
    ]
  }
};

// Kabinenausstattung je Flugzeug: Sitzart und Unterhaltung. Umbau kostet je Sitz und dauert.
export const FITTING = {
  seats: {
    standard: { label: "Standard", seatBonus: 1, rep: 0, pricePerSeat: 0, hours: 0,
                note: "Normale Sitze im üblichen Abstand." },
    slim:     { label: "Slimline", seatBonus: 1.08, rep: -3, pricePerSeat: 2200, hours: 14,
                note: "Dünnere Rückenlehnen: 8 % mehr Sitzbudget, enger wird es trotzdem." },
    comfort:  { label: "Komfort", seatBonus: 0.93, rep: 5, pricePerSeat: 5200, hours: 20,
                note: "Mehr Beinfreiheit und breitere Polster. Kostet Sitze, bringt Ruf." }
  },
  ife: {
    none:  { label: "Keine", rep: 0, onboard: 1, pricePerSeat: 0, hours: 0, note: "Fenster und Bordmagazin." },
    wifi:  { label: "WLAN", rep: 3, onboard: 1.15, pricePerSeat: 1600, hours: 10,
             note: "Internet an Bord. Kommt an und kurbelt den Bordverkauf an." },
    full:  { label: "WLAN & Bildschirme", rep: 6, onboard: 1.3, pricePerSeat: 4800, hours: 24,
             note: "Bildschirm in jeder Lehne plus Internet. Schwer, teuer, beliebt." }
  }
};

// Charter: ein Veranstalter mietet Flugzeug und Crew (ACMI). Er zahlt Kerosin und Gebühren,
// wir stellen Flugzeug, Besatzung, Wartung, Versicherung. Viel Geld, aber das Flugzeug ist weg.
export const CHARTER = {
  offersPerDay: 3,
  minDays: 3, maxDays: 12,
  minKm: 900, maxKm: 11000,
  narrowKm: 4200,                              // bis hierhin reicht ein Schmalrumpfflugzeug
  wideFromKm: 4800,                            // ab hier fragen Veranstalter Großraumflugzeuge an
  minTourism: 0.45,                            // nur touristische Ziele
  dayRatePerSeat: { narrow: 420, wide: 470, jumbo: 430 },   // je Sitz und Tag; grob so viel wie eine gut laufende Strecke
  refSeats: { narrow: 170, wide: 290, jumbo: 410 },
  seatTolerance: 0.8,                          // so viele Sitze muss das Flugzeug mindestens haben
  farBonus: 0.2,                               // Zuschlag für weite Ziele
  repMin: 0.78, repSpan: 0.42,                 // Ruf 0..100 → Satz 0,78 … 1,20
  upfront: 0.4,                                // Anzahlung beim Annehmen, Rest bei Rückkehr
  fhPerDay: { narrow: 8.5, wide: 11, jumbo: 11 },
  cancelShare: 0.6,                            // Vertragsstrafe bei Abbruch, Anteil der Restsumme
  repBonus: 2.5,                               // Rufgewinn nach sauber geflogenem Auftrag
  operators: [
    "Sonnenflug Reisen", "Adriatic Holidays", "Blautour", "Nordstern Reisen", "Condor Travel Group",
    "Mediterrane Touristik", "Albatros Fernreisen", "Pauschal & Co.", "Baltic Sun", "Orienta Travel"
  ]
};

// Sonderlackierungen: Firmen mieten die Außenhaut als Werbefläche. Das Flugzeug fliegt normal weiter,
// die eigene Marke verschwindet aber darunter – deshalb kostet jedes bemalte Flugzeug Ruf.
export const ADLIVERY = {
  offersPerWeek: 3,
  terms: [30, 60, 90],
  perSeatPerDay: { narrow: 20, wide: 27, jumbo: 31 },   // je Sitzplatz Maximalbestuhlung
  reachMin: 0.55, reachSpan: 0.9,                       // Bekanntheit und Ruf machen die Fläche wertvoll
  upfrontDays: 20,                                      // Einmalzahlung beim Abschluss
  haggle: 0.18,                                         // Streuung der Angebote
  paintHours: { narrow: 20, wide: 30, jumbo: 36 },      // so lange steht das Flugzeug in der Lackiererei
  repPerAircraft: 1.2, repMax: 6,
  cancelShare: 0.5,
  clients: [
    { name: "Nordbank", branch: "Finanzen", colors: ["#0b3d91", "#f2b705"] },
    { name: "Vitafit", branch: "Sportartikel", colors: ["#00a86b", "#ffffff"] },
    { name: "Kaffeerösterei Hansen", branch: "Lebensmittel", colors: ["#5b3a29", "#e8d8c3"] },
    { name: "Stromwerk", branch: "Energie", colors: ["#16a34a", "#0f172a"] },
    { name: "Pixelfabrik", branch: "Spiele", colors: ["#7c3aed", "#22d3ee"] },
    { name: "Hafenwerft", branch: "Industrie", colors: ["#334155", "#f97316"] },
    { name: "Tourismusverband Tirol", branch: "Tourismus", colors: ["#0ea5e9", "#ffffff"] },
    { name: "Blütenhof", branch: "Molkerei", colors: ["#fef3c7", "#1d4ed8"] }
  ]
};

// Sortiment im Bordverkauf. Wirkt nur dort, wo überhaupt verkauft wird (siehe CATERING.modes).
// costShare = Wareneinsatz als Anteil vom Umsatz: viel Umsatz heißt nicht viel Gewinn.
export const ONBOARD = {
  defaultRange: "standard",
  ranges: {
    basic:    { label: "Schlicht", salesMul: 0.65, costShare: 0.30, rep: -2,
                note: "Kaffee, Wasser, Riegel. Wenig Umsatz, aber fast alles davon bleibt." },
    standard: { label: "Standard", salesMul: 1, costShare: 0.45, rep: 0,
                note: "Getränke, Snacks, belegte Brötchen. Der Normalfall." },
    premium:  { label: "Marken & Region", salesMul: 1.7, costShare: 0.58, rep: 4,
                note: "Markenprodukte und regionale Spezialitäten. Deutlich mehr Umsatz, dünnere Marge – und die Gäste reden darüber." }
  }
};

// Werbung. Bekanntheit 0..100 füllt leere Sitze – wo schon alles voll ist, bringt sie wenig.
// Deshalb darf der Hebel spürbar sein, ohne das Spiel zu kippen.
export const MARKETING = {
  base: 8,                  // Grundbekanntheit einer frisch gegründeten Airline
  floorPerDest: 1.6,        // je bedientem Ziel
  floorMax: 42,             // ohne Werbung ist irgendwann Schluss
  maxAw: 100,
  demandRef: 12,            // Bekanntheit einer jungen Airline = Nachfragefaktor 1,0
  demandSpan: 0.25,         // je 100 Punkte darüber: +25 % Nachfrage (bei 100 also rund +22 %)
  repPer10: 0.5,            // Ruf: bis zu +5 bei voller Bekanntheit
  // gainPerDay = Punkte pro Tag im kleinsten Tarif, halfLifeDays = wie lange es nachwirkt
  channels: {
    tv: {
      label: "TV & Radio", costPerDay: 9000, gainPerDay: 1.1, halfLifeDays: 14, ramp: 3, rep: 0,
      bias: { f: 1, j: 1, w: 1, y: 1 },
      note: "Teuer und breit. Braucht drei Tage Anlauf, wirkt dann auf alle Klassen gleich und lange nach."
    },
    ooh: {
      label: "Plakat", costPerDay: 3400, gainPerDay: 0.8, halfLifeDays: 10, ramp: 2, rep: 0.5,
      bias: { f: 1.05, j: 1.1, w: 1.05, y: 0.95 },
      note: "Großflächen am Drehkreuz und in der Innenstadt. Solide Dauerwirkung, nichts Spektakuläres."
    },
    print: {
      label: "Zeitung", costPerDay: 1900, gainPerDay: 0.4, halfLifeDays: 12, ramp: 1, rep: 1.4,
      bias: { f: 1.3, j: 1.3, w: 1.1, y: 0.9 },
      note: "Kleine Reichweite, aber die richtigen Leute: Geschäftsreisende – und der Ruf steigt mit."
    },
    online: {
      label: "Online", costPerDay: 2600, gainPerDay: 1.6, halfLifeDays: 4, ramp: 0, rep: -0.4,
      bias: { f: 0.85, j: 0.9, w: 1.05, y: 1.2 },
      note: "Wirkt sofort und günstig, verpufft aber genauso schnell. Zieht vor allem Urlauber."
    }
  },
  tiers: [
    { label: "klein", mul: 1 },
    { label: "mittel", mul: 2.6 },
    { label: "groß", mul: 6 }
  ],
  terms: [7, 14, 30]
};

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

export const STOCKS = {
  profitMultiple: 3, repWeight: 0.4, minPrice: 0.5, fee: 0.005, refreshMs: 60_000,
  publishEveryMs: 2 * 3600_000,   // eigener Eintrag wird höchstens alle zwei Stunden aktualisiert
  maxStake: 0.49,                 // an einer fremden Airline höchstens 49 %
  defaultShares: 10_000_000       // Aktienzahl, wenn eine fremde Airline keine nennt
};

// Bewertung einer Airline: Sterne, Größe, Wirtschaftlichkeit (sim/rating.js)
export const RATING = {
  minFleet: 2,                    // ab so vielen Flugzeugen ist man für die Börse qualifiziert
  max: { fleet: 60, staff: 4000, destinations: 40, pax: 4_000_000 },
  weight: { fleet: 1, staff: 0.7, destinations: 1, pax: 1.2 },
  goodMargin: 0.22,               // Marge, die 100 % Wirtschaftlichkeit entspricht
  goodPerDay: 60_000              // Ergebnis je Flugzeug und Tag für 100 %
};
