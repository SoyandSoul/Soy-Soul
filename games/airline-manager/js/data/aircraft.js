// Flugzeugkatalog – 38 Typen, genau die, für die Seitenansichten als Blaupause vorliegen (data/profiles.json).
// Alle Werte sind Richtwerte aus Herstellerangaben (Aircraft Characteristics / Airport Planning Docs,
// Typenzulassungen, zuletzt veröffentlichte Listenpreise). Vor dem Release gegen die AC-Dokumente prüfen,
// siehe README → "Daten prüfen".
//
// Einheitliche Felder pro Typ (Spielbalance):
//   seats      typische 2-Klassen-Bestuhlung        seatsMax  Zulassungsgrenze (Notausgänge)
//   rangeKm    Reichweite mit typischer Kabine      cruiseKmh Reisegeschwindigkeit
//   runwayM    Startstrecke bei MTOW (ISA, MSL)     fuelKgH   Verbrauch im Reiseflug pro Blockstunde
//   payloadKg  max. Nutzlast (Pax + Gepäck + Fracht) mtowT    max. Abfluggewicht in t
//   priceM     Listenpreis in Mio. USD              maintFH   Wartungsreserve (Line + Teile) in USD pro Flugstunde
//   crew       Cockpit / min. Kabine / Techniker pro Flugzeug
//   art        Geometrie für den Zeichner (Länge, Spannweite, Triebwerke …)
//   inProd     false = nur noch gebraucht erhältlich
//   info       Datenblatt (ui: Markt + Hangar) – reine Anzeige, keine Balance:
//              heightM, wingM2, oewT (Leergewicht), fuelL (Tankinhalt), vmaxMach, vmaxKmh, ceilingFt,
//              engine (Name), thrustKN (je Triebwerk; Turboprop: kW), firstFlight, eis (Indienststellung), note

const A = "Airbus", B = "Boeing", BO = "Bombardier", E = "Embraer", BE = "Beechcraft", C = "Aérospatiale/BAC";

// [id, maker, family, name, seats, seatsMax, rangeKm, cruiseKmh, runwayM, fuelKgH, payloadKg, mtowT, priceM, maintFH, lengthM, spanM, engines, inProd, extra, info]
const RAW = [
  // ---------- Airbus
  ["a220-100", A, "A220", "A220-100", 120, 135, 6390, 829, 1463, 1700, 15100, 63.1, 81.0, 700, 35.0, 35.1, 2, true, {},
    { heightM: 11.5, wingM2: 112.3, oewT: 35.2, fuelL: 21805, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 41000, engine: "Pratt & Whitney PW1500G", thrustKN: 104, firstFlight: 2013, eis: 2016, note: "Ehemals Bombardier CSeries CS100. Sehr sparsam, leise, große Fenster – ideal für dünne Strecken." }],
  ["a220-300", A, "A220", "A220-300", 140, 160, 6300, 829, 1890, 1900, 18700, 70.9, 91.5, 720, 38.7, 35.1, 2, true, {},
    { heightM: 11.5, wingM2: 112.3, oewT: 37.1, fuelL: 21805, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 41000, engine: "Pratt & Whitney PW1500G", thrustKN: 104, firstFlight: 2015, eis: 2016, note: "Die gestreckte Variante – meistverkaufte A220." }],
  ["a319", A, "A320", "A319-100", 134, 156, 6850, 828, 1850, 2200, 17700, 75.5, 92.3, 820, 33.84, 35.8, 2, false, { sharklet: 1 },
    { heightM: 11.76, wingM2: 122.6, oewT: 40.8, fuelL: 24210, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 39800, engine: "CFM56-5B / IAE V2500", thrustKN: 105, firstFlight: 1995, eis: 1996, note: "Kurzversion des A320 mit großer Reichweite, auch als Geschäftsflugzeug (ACJ)." }],
  ["a320ceo", A, "A320", "A320-200", 164, 180, 6100, 828, 2100, 2500, 19900, 78.0, 101.0, 980, 37.57, 35.8, 2, false, { sharklet: 1 },
    { heightM: 11.76, wingM2: 122.6, oewT: 42.6, fuelL: 24210, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 39800, engine: "CFM56-5B / IAE V2500", thrustKN: 120, firstFlight: 1987, eis: 1988, note: "Erstes Verkehrsflugzeug mit Fly-by-Wire. Das Arbeitstier der Kurz- und Mittelstrecke." }],
  ["a320neo", A, "A320", "A320neo", 165, 194, 6300, 828, 2100, 2200, 20000, 79.0, 110.6, 850, 37.57, 35.8, 2, true, { sharklet: 1 },
    { heightM: 11.76, wingM2: 122.6, oewT: 44.3, fuelL: 26730, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 39800, engine: "CFM LEAP-1A / PW1100G", thrustKN: 120, firstFlight: 2014, eis: 2016, note: "New Engine Option: rund 15 % weniger Verbrauch als der ceo." }],
  ["a321", A, "A320", "A321-200", 199, 220, 5950, 828, 2200, 2900, 25300, 93.5, 118.3, 950, 44.51, 35.8, 2, false, { sharklet: 1 },
    { heightM: 11.76, wingM2: 122.6, oewT: 48.5, fuelL: 29680, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 39800, engine: "CFM56-5B3 / IAE V2533", thrustKN: 147, firstFlight: 1993, eis: 1997, note: "Längster A320 – viel Kapazität auf gut gebuchten Strecken." }],
  ["a321neo", A, "A320", "A321neo", 206, 244, 7400, 828, 2300, 2500, 25500, 97.0, 129.5, 950, 44.51, 35.8, 2, true, { sharklet: 1 },
    { heightM: 11.76, wingM2: 122.6, oewT: 50.1, fuelL: 32940, vmaxMach: 0.82, vmaxKmh: 871, ceilingFt: 39800, engine: "CFM LEAP-1A / PW1100G", thrustKN: 147, firstFlight: 2016, eis: 2017, note: "Bestseller mit Transatlantik-Reichweite (LR/XLR)." }],
  ["a330-200", A, "A330", "A330-200", 247, 406, 13450, 871, 2770, 5600, 49000, 242.0, 238.5, 2300, 58.82, 60.3, 2, false, {},
    { heightM: 17.39, wingM2: 361.6, oewT: 120.5, fuelL: 139090, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 41450, engine: "GE CF6-80E1 / PW4000 / RR Trent 700", thrustKN: 320, firstFlight: 1997, eis: 1998, note: "Kurze Langstreckenversion mit höherem Leitwerk und großer Reichweite." }],
  ["a330-300", A, "A330", "A330-300", 277, 440, 11750, 871, 2500, 5700, 45600, 242.0, 264.2, 2300, 63.69, 60.3, 2, false, {},
    { heightM: 16.79, wingM2: 361.6, oewT: 124.5, fuelL: 97530, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 41450, engine: "GE CF6-80E1 / PW4000 / RR Trent 700", thrustKN: 320, firstFlight: 1992, eis: 1994, note: "Der klassische Großraumjet für Mittel- und Langstrecke." }],
  ["a330-900", A, "A330", "A330-900neo", 287, 460, 13330, 871, 2770, 5100, 46000, 251.0, 296.4, 2100, 63.66, 64.0, 2, true, { sharklet: 1 },
    { heightM: 16.79, wingM2: 465.0, oewT: 137.0, fuelL: 139090, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 41450, engine: "Rolls-Royce Trent 7000", thrustKN: 324, firstFlight: 2017, eis: 2018, note: "Neue Triebwerke, breitere Flügel mit Sharklets, A350-Kabine." }],
  ["a340-300", A, "A340", "A340-300", 277, 440, 13500, 871, 3000, 6400, 51000, 276.5, 238.0, 3000, 63.69, 60.3, 4, false, {},
    { heightM: 16.85, wingM2: 361.6, oewT: 129.8, fuelL: 147850, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 41100, engine: "CFM56-5C4", thrustKN: 151, firstFlight: 1991, eis: 1993, note: "Vierstrahler für Ultralangstrecken über Ozeane – ohne ETOPS-Beschränkung, aber durstig." }],
  ["a340-600", A, "A340", "A340-600", 326, 475, 14450, 881, 3100, 7800, 63500, 380.0, 275.4, 3400, 75.36, 63.45, 4, false, {},
    { heightM: 17.22, wingM2: 437.3, oewT: 177.8, fuelL: 195880, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 41100, engine: "Rolls-Royce Trent 556", thrustKN: 249, firstFlight: 2001, eis: 2002, note: "Bis zur 747-8 das längste Verkehrsflugzeug der Welt (75,4 m)." }],
  ["a350-900", A, "A350", "A350-900", 315, 440, 15000, 903, 2600, 5800, 53300, 283.0, 317.4, 2300, 66.8, 64.75, 2, true, { curvedTip: 1 },
    { heightM: 17.05, wingM2: 442.0, oewT: 142.4, fuelL: 140795, vmaxMach: 0.89, vmaxKmh: 945, ceilingFt: 43100, engine: "Rolls-Royce Trent XWB-84", thrustKN: 374, firstFlight: 2013, eis: 2015, note: "CFK-Rumpf, 25 % weniger Verbrauch als die Vorgänger. Rückgrat vieler Langstreckenflotten." }],
  ["a350-1000", A, "A350", "A350-1000", 369, 480, 16100, 903, 2750, 6800, 68000, 322.0, 366.5, 2600, 73.79, 64.75, 2, true, { curvedTip: 1 },
    { heightM: 17.08, wingM2: 464.3, oewT: 155.0, fuelL: 158791, vmaxMach: 0.89, vmaxKmh: 945, ceilingFt: 43100, engine: "Rolls-Royce Trent XWB-97", thrustKN: 431, firstFlight: 2016, eis: 2018, note: "Die größere A350 – Konkurrentin der 777-300ER mit deutlich weniger Verbrauch." }],
  ["a380-800", A, "A380", "A380-800", 545, 853, 14800, 903, 3000, 11500, 84000, 575.0, 445.6, 4800, 72.72, 79.75, 4, false, { deck2: 1 },
    { heightM: 24.09, wingM2: 845.0, oewT: 277.0, fuelL: 320000, vmaxMach: 0.89, vmaxKmh: 945, ceilingFt: 43000, engine: "RR Trent 900 / Engine Alliance GP7200", thrustKN: 348, firstFlight: 2005, eis: 2007, note: "Größtes Passagierflugzeug der Welt, zwei durchgehende Decks. Produktion 2021 eingestellt." }],

  // ---------- Boeing
  ["b717-200", B, "717", "717-200", 106, 134, 3815, 811, 1700, 2300, 14500, 54.9, 42.0, 760, 37.8, 28.45, 2, false, {},
    { heightM: 8.92, wingM2: 92.97, oewT: 30.6, fuelL: 13892, vmaxMach: 0.77, vmaxKmh: 811, ceilingFt: 37000, engine: "Rolls-Royce BR715", thrustKN: 93, firstFlight: 1998, eis: 1999, note: "Entwickelt als MD-95 bei McDonnell Douglas; Hecktriebwerke, T-Leitwerk." }],
  ["b737-400", B, "737", "737-400", 146, 188, 3800, 796, 2540, 2700, 17700, 68.0, 45.0, 1000, 36.4, 28.9, 2, false, {},
    { heightM: 11.13, wingM2: 105.4, oewT: 35.1, fuelL: 20100, vmaxMach: 0.82, vmaxKmh: 876, ceilingFt: 37000, engine: "CFM56-3C1", thrustKN: 104, firstFlight: 1988, eis: 1988, note: "Größtes Mitglied der 737 Classic, bei Charter- und Billigairlines beliebt." }],
  ["b737-800", B, "737", "737-800", 162, 189, 5436, 828, 2300, 2530, 21300, 79.0, 106.1, 1000, 39.5, 35.8, 2, false, { winglet: 1 },
    { heightM: 12.5, wingM2: 124.6, oewT: 41.4, fuelL: 26020, vmaxMach: 0.82, vmaxKmh: 876, ceilingFt: 41000, engine: "CFM56-7B26", thrustKN: 117, firstFlight: 1997, eis: 1998, note: "Meistgebaute 737 Next Generation – fast 5.000 Stück." }],
  ["b737-900er", B, "737", "737-900ER", 178, 220, 5925, 828, 2450, 2650, 23000, 85.1, 112.6, 1050, 42.1, 35.8, 2, false, { winglet: 1 },
    { heightM: 12.5, wingM2: 124.6, oewT: 44.7, fuelL: 29660, vmaxMach: 0.82, vmaxKmh: 876, ceilingFt: 41000, engine: "CFM56-7B27", thrustKN: 121, firstFlight: 2006, eis: 2007, note: "Längste 737 NG, mit zusätzlichen Notausgängen und Zusatztanks." }],
  ["b747-400", B, "747", "747-400", 416, 660, 13490, 913, 3300, 10200, 62900, 396.9, 266.0, 4200, 70.66, 64.44, 4, false, { hump: 1, winglet: 1 },
    { heightM: 19.4, wingM2: 541.2, oewT: 178.8, fuelL: 216840, vmaxMach: 0.92, vmaxKmh: 988, ceilingFt: 45100, engine: "PW4056 / GE CF6-80C2 / RR RB211-524", thrustKN: 258, firstFlight: 1988, eis: 1989, note: "Die Königin der Lüfte – Zwei-Mann-Cockpit, Winglets, längeres Oberdeck." }],
  ["b747-8i", B, "747", "747-8 Intercontinental", 410, 605, 14320, 917, 3100, 9600, 76000, 447.7, 418.4, 3800, 76.25, 68.4, 4, false, { hump: 1.3, raked: 1 },
    { heightM: 19.4, wingM2: 554.0, oewT: 220.1, fuelL: 243120, vmaxMach: 0.90, vmaxKmh: 966, ceilingFt: 43100, engine: "GEnx-2B67", thrustKN: 296, firstFlight: 2011, eis: 2012, note: "Längstes Verkehrsflugzeug der Welt (76,3 m). Letzte 747 wurde Anfang 2023 ausgeliefert." }],
  ["b757-200", B, "757", "757-200", 200, 239, 7250, 850, 2070, 3300, 25900, 115.7, 90.0, 1500, 47.32, 38.05, 2, false, { winglet: 1 },
    { heightM: 13.6, wingM2: 185.3, oewT: 58.4, fuelL: 43490, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 42000, engine: "RR RB211-535E4 / PW2037", thrustKN: 191, firstFlight: 1982, eis: 1983, note: "Starkes Schmalrumpfflugzeug mit Transatlantik-Reichweite und kurzen Bahnen." }],
  ["b757-300", B, "757", "757-300", 243, 295, 6295, 850, 2550, 3500, 29000, 123.6, 100.0, 1600, 54.43, 38.05, 2, false, { winglet: 1 },
    { heightM: 13.6, wingM2: 185.3, oewT: 64.3, fuelL: 43490, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 42000, engine: "RR RB211-535E4B / PW2043", thrustKN: 191, firstFlight: 1998, eis: 1999, note: "Längstes Schmalrumpfflugzeug mit Einzelgang, das je gebaut wurde (54,4 m)." }],
  ["b767-300er", B, "767", "767-300ER", 218, 290, 11070, 851, 2650, 4800, 43800, 186.9, 217.9, 2000, 54.94, 47.57, 2, false, { winglet: 1 },
    { heightM: 15.85, wingM2: 283.3, oewT: 90.0, fuelL: 91380, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 43100, engine: "GE CF6-80C2 / PW4060", thrustKN: 276, firstFlight: 1988, eis: 1988, note: "Schmaler Großraumjet (2-3-2), eröffnete mit ETOPS die zweistrahlige Atlantikquerung." }],
  ["b767-400er", B, "767", "767-400ER", 245, 375, 10415, 851, 3050, 5100, 46000, 204.1, 230.0, 2100, 61.37, 51.92, 2, false, { raked: 1 },
    { heightM: 16.8, wingM2: 290.7, oewT: 103.9, fuelL: 91380, vmaxMach: 0.86, vmaxKmh: 913, ceilingFt: 43100, engine: "GE CF6-80C2B8F", thrustKN: 282, firstFlight: 1999, eis: 2000, note: "Gestreckt mit Raked Wingtips; nur 38 Stück gebaut (Delta, Continental)." }],
  ["b777-200er", B, "777", "777-200ER", 313, 440, 13080, 892, 3100, 6800, 54200, 297.6, 306.6, 2800, 63.73, 60.93, 2, false, {},
    { heightM: 18.5, wingM2: 427.8, oewT: 138.1, fuelL: 171170, vmaxMach: 0.89, vmaxKmh: 945, ceilingFt: 43100, engine: "GE90-94B / RR Trent 895 / PW4090", thrustKN: 417, firstFlight: 1996, eis: 1997, note: "Erstes vollständig am Computer entworfenes Verkehrsflugzeug." }],
  ["b777-300er", B, "777", "777-300ER", 396, 550, 13650, 892, 3050, 7500, 69900, 351.5, 375.5, 3000, 73.86, 64.8, 2, true, { raked: 1 },
    { heightM: 18.5, wingM2: 436.8, oewT: 167.8, fuelL: 181280, vmaxMach: 0.89, vmaxKmh: 945, ceilingFt: 43100, engine: "GE90-115B", thrustKN: 513, firstFlight: 2003, eis: 2004, note: "Stärkstes Strahltriebwerk der Welt; erfolgreichste 777-Version." }],
  ["b787-8", B, "787", "787-8", 248, 359, 13530, 903, 2600, 4900, 43300, 228.0, 248.3, 2000, 56.72, 60.12, 2, true, { raked: 1 },
    { heightM: 16.9, wingM2: 377.0, oewT: 119.9, fuelL: 126206, vmaxMach: 0.90, vmaxKmh: 954, ceilingFt: 43100, engine: "GEnx-1B / RR Trent 1000", thrustKN: 280, firstFlight: 2009, eis: 2011, note: "Dreamliner: CFK-Rumpf, größere Fenster, niedrigere Kabinenhöhe." }],
  ["b787-9", B, "787", "787-9", 296, 406, 14010, 903, 2800, 5500, 52600, 254.0, 292.5, 2200, 62.81, 60.12, 2, true, { raked: 1 },
    { heightM: 17.0, wingM2: 377.0, oewT: 128.9, fuelL: 126372, vmaxMach: 0.90, vmaxKmh: 954, ceilingFt: 43100, engine: "GEnx-1B74 / RR Trent 1000", thrustKN: 320, firstFlight: 2013, eis: 2014, note: "Die gestreckte und meistbestellte Dreamliner-Version." }],
  ["b787-10", B, "787", "787-10", 336, 440, 11730, 903, 2900, 5900, 57300, 254.0, 338.4, 2400, 68.28, 60.12, 2, true, { raked: 1 },
    { heightM: 17.0, wingM2: 377.0, oewT: 135.5, fuelL: 126372, vmaxMach: 0.90, vmaxKmh: 954, ceilingFt: 43100, engine: "GEnx-1B76 / RR Trent 1000-TEN", thrustKN: 340, firstFlight: 2017, eis: 2018, note: "Längste 787, optimiert für stark nachgefragte Mittel- und Langstrecken." }],

  // ---------- Regionaljets, Turboprop, Überschall
  ["crj200", BO, "CRJ", "CRJ-200", 50, 50, 3045, 786, 1920, 1100, 6100, 24.0, 24.0, 600, 26.77, 21.21, 2, false, { rear: 1 },
    { heightM: 6.22, wingM2: 48.35, oewT: 13.8, fuelL: 8080, vmaxMach: 0.81, vmaxKmh: 860, ceilingFt: 41000, engine: "GE CF34-3B1", thrustKN: 41, firstFlight: 1995, eis: 1996, note: "Der Regionaljet, der die 50-Sitzer-Welle auslöste – abgeleitet vom Challenger-Geschäftsflugzeug." }],
  ["crj700", BO, "CRJ", "CRJ-700", 70, 78, 2655, 829, 1600, 1450, 8600, 34.0, 33.0, 650, 32.3, 23.24, 2, false, { rear: 1 },
    { heightM: 7.57, wingM2: 70.6, oewT: 19.7, fuelL: 11490, vmaxMach: 0.83, vmaxKmh: 880, ceilingFt: 41000, engine: "GE CF34-8C5", thrustKN: 61, firstFlight: 1999, eis: 2001, note: "Gestreckt, neuer Flügel, Vorflügel – deutlich komfortabler als der CRJ-200." }],
  ["crj900", BO, "CRJ", "CRJ-900", 76, 90, 2956, 829, 1950, 1550, 10300, 38.3, 42.0, 680, 36.2, 24.85, 2, false, { rear: 1 },
    { heightM: 7.51, wingM2: 70.6, oewT: 21.4, fuelL: 11490, vmaxMach: 0.83, vmaxKmh: 880, ceilingFt: 41000, engine: "GE CF34-8C5", thrustKN: 64, firstFlight: 2001, eis: 2003, note: "Die große CRJ; CRJ-Programm 2020 an Mitsubishi verkauft, Produktion beendet." }],
  ["e170", E, "E-Jet", "E170", 72, 80, 3982, 829, 1644, 1550, 9100, 38.6, 40.0, 650, 29.9, 26.0, 2, false, { sharklet: 1 },
    { heightM: 9.85, wingM2: 72.7, oewT: 21.1, fuelL: 11625, vmaxMach: 0.82, vmaxKmh: 870, ceilingFt: 41000, engine: "GE CF34-8E", thrustKN: 62, firstFlight: 2002, eis: 2004, note: "Erster E-Jet: 2-2-Bestuhlung ohne Mittelsitz, Fly-by-Wire." }],
  ["e175", E, "E-Jet", "E175", 78, 88, 4000, 829, 2000, 1650, 10100, 40.4, 49.7, 680, 31.68, 28.65, 2, true, { sharklet: 1 },
    { heightM: 9.86, wingM2: 72.7, oewT: 21.9, fuelL: 11625, vmaxMach: 0.82, vmaxKmh: 870, ceilingFt: 41000, engine: "GE CF34-8E5", thrustKN: 64, firstFlight: 2003, eis: 2005, note: "Meistgebauter Regionaljet der USA (Scope-Clause-Größe), mit Winglets." }],
  ["erj145", E, "ERJ", "ERJ 145", 50, 50, 2873, 833, 2100, 1150, 5800, 22.0, 21.0, 580, 29.87, 20.04, 2, false, { rear: 1, sharklet: 1 },
    { heightM: 6.76, wingM2: 51.2, oewT: 12.1, fuelL: 6400, vmaxMach: 0.78, vmaxKmh: 833, ceilingFt: 37000, engine: "Rolls-Royce AE 3007A", thrustKN: 33, firstFlight: 1995, eis: 1996, note: "Embraers Durchbruch: über 1.200 Stück, Hecktriebwerke, 1-2-Bestuhlung." }],
  ["be1900d", BE, "1900", "1900D", 19, 19, 1480, 518, 1140, 330, 2400, 7.8, 5.5, 250, 17.63, 17.67, 2, false, { prop: 1 },
    { heightM: 4.72, wingM2: 28.8, oewT: 4.8, fuelL: 2522, vmaxMach: 0.48, vmaxKmh: 533, ceilingFt: 25000, engine: "Pratt & Whitney Canada PT6A-67D (Turboprop)", thrustKN: 954, firstFlight: 1990, eis: 1991, note: "19-sitziger Zubringer mit Stehhöhe in der Kabine. Keine Kabinenbesatzung nötig." }],
  ["concorde", C, "Concorde", "Concorde", 100, 128, 7250, 2158, 3600, 22000, 13400, 185.0, 130.0, 6000, 61.66, 25.6, 4, false, { delta: 1 },
    { heightM: 12.2, wingM2: 358.2, oewT: 78.7, fuelL: 119500, vmaxMach: 2.04, vmaxKmh: 2179, ceilingFt: 60000, engine: "Rolls-Royce/Snecma Olympus 593 (Nachbrenner)", thrustKN: 169, firstFlight: 1969, eis: 1976, note: "Mach 2 in 18 km Höhe, Paris–New York in 3,5 h. Nur 20 gebaut, 2003 außer Dienst – im Spiel als Sammlerstück gebraucht erhältlich." }]
];

/** Größenklasse steuert Turnaround, Gebühren, Check-Kosten und Technikerbedarf. */
function sizeClass(seats, spanM, extra) {
  if (extra?.deck2 || seats >= 400) return "jumbo";
  if (spanM > 45) return "wide";
  return "narrow";
}

export const AIRCRAFT = RAW.map(r => {
  const [id, maker, family, name, seats, seatsMax, rangeKm, cruiseKmh, runwayM, fuelKgH, payloadKg, mtowT, priceM, maintFH, lengthM, spanM, engines, inProd, extra = {}, info = {}] = r;
  const size = sizeClass(seats, spanM, extra);
  return {
    id, maker, family, name, seats, seatsMax, rangeKm, cruiseKmh, runwayM, fuelKgH, payloadKg, mtowT, priceM, maintFH, inProd, size, info,
    crew: {
      pilots: 2,                                   // pro Flug; Langstrecke > 8 h wird in sim/economy.js aufgestockt
      cabin: seatsMax < 20 ? 0 : Math.max(1, Math.ceil(seatsMax / 50)), // gesetzliches Minimum 1 FA pro 50 Sitze
      techs: size === "narrow" ? (seatsMax < 100 ? 3 : 6) : size === "wide" ? 10 : 14
    },
    art: { lengthM, spanM, engines, ...extra }
  };
});

export const AIRCRAFT_BY_ID = Object.fromEntries(AIRCRAFT.map(a => [a.id, a]));
export const MAKERS = [...new Set(AIRCRAFT.map(a => a.maker))];
/** Exklusivverträge gibt es nur bei den beiden Großen. */
export const CONTRACT_MAKERS = [A, B];

/** Typen früherer Versionen, die es nicht mehr gibt → nächster Verwandter (core/store.js → migrate). */
export const LEGACY_TYPES = {
  "a319neo": "a319", "a321xlr": "a321neo",
  "b737-700": "b737-800", "b737-max7": "b737-800", "b737-max8": "b737-800", "b737-max9": "b737-900er", "b737-max10": "b737-900er",
  "b777-9": "b777-300er"
};

/** Verweise auf die offiziellen Quellen – für Datenprüfung und Zeichnungs-Pipeline (tools/). */
export const SOURCES = {
  [A]: {
    characteristics: "https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/aircraft-characteristics",
    drawings: "https://www.aircraft.airbus.com/en/customer-care/fleet-wide-care/airport-operations-and-aircraft-characteristics/autocad-3-view-aircraft-drawings"
  },
  [B]: {
    characteristics: "https://www.boeing.com/commercial/airports/plan-manuals",
    drawings: "https://www.boeing.com/commercial/airports/3-view"
  },
  [E]: { characteristics: "https://www.embraercommercialaviation.com/" },
  [BO]: { characteristics: "https://mhirj.com/" }
};
