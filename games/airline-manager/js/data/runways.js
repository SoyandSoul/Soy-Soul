// Bahnlagen für den Bodenbetrieb auf der Karte.
//
// Für die großen Flughäfen sind die echten Richtungen hinterlegt (Grad rechtweisend, also 070 für
// die 07/25). Mehrere Einträge heißen mehrere Bahnen; die erste ist die, von der abgeflogen wird.
// `sep` ist der seitliche Abstand paralleler Bahnen in Metern, `apron` die Richtung, in der das
// Terminal liegt – damit die Flugzeuge nicht durch die Bahn hindurch rollen.
//
// Alle übrigen Flughäfen bekommen ein Schema: eine Bahn, Richtung deterministisch aus dem
// ICAO-Code. Das ist erfunden, aber für jeden Spieler gleich und bleibt über Sitzungen hinweg stabil.

export const RUNWAYS = {
  FRA: { hdg: [70, 70, 70, 180], sep: 800, apron: 160 },      // drei Parallelbahnen plus Startbahn West
  MUC: { hdg: [86, 86], sep: 2300, apron: 176 },   // die beiden Bahnen liegen wirklich so weit auseinander
  BER: { hdg: [71, 71], sep: 1900, apron: 161 },
  DUS: { hdg: [54, 54], sep: 500, apron: 144 },
  HAM: { hdg: [51, 151], sep: 0, apron: 320 },
  STR: { hdg: [75], sep: 0, apron: 165 },
  CGN: { hdg: [140, 76], sep: 1500, apron: 230 },
  LHR: { hdg: [90, 90], sep: 1400, apron: 180 },
  LGW: { hdg: [78], sep: 0, apron: 168 },
  MAN: { hdg: [50, 50], sep: 400, apron: 140 },
  CDG: { hdg: [87, 87, 87, 87], sep: 1800, apron: 177 },
  ORY: { hdg: [60, 240, 20], sep: 1500, apron: 150 },
  AMS: { hdg: [182, 222, 60, 90], sep: 2000, apron: 272 },
  BRU: { hdg: [250, 192, 70], sep: 1600, apron: 340 },
  ZRH: { hdg: [143, 103, 165], sep: 1200, apron: 233 },
  VIE: { hdg: [116, 162], sep: 1400, apron: 206 },
  MAD: { hdg: [144, 144, 324, 324], sep: 1800, apron: 234 },
  BCN: { hdg: [67, 247, 20], sep: 1300, apron: 157 },
  LIS: { hdg: [30, 210], sep: 1100, apron: 120 },
  FCO: { hdg: [163, 163, 70], sep: 1500, apron: 253 },
  MXP: { hdg: [350, 350], sep: 800, apron: 80 },
  CPH: { hdg: [40, 220, 120], sep: 1600, apron: 130 },
  ARN: { hdg: [8, 8, 260], sep: 2300, apron: 98 },
  OSL: { hdg: [12, 12], sep: 1000, apron: 102 },
  HEL: { hdg: [40, 220, 150], sep: 1700, apron: 130 },
  DUB: { hdg: [100, 100, 160], sep: 1600, apron: 190 },
  IST: { hdg: [170, 170, 350, 350, 90], sep: 2000, apron: 260 },
  DOH: { hdg: [160, 160], sep: 2100, apron: 250 },
  DXB: { hdg: [120, 120], sep: 800, apron: 210 },
  JFK: { hdg: [40, 220, 130, 310], sep: 1700, apron: 130 },
  EWR: { hdg: [40, 40, 110], sep: 900, apron: 130 },
  LAX: { hdg: [69, 69, 249, 249], sep: 1500, apron: 159 },
  ORD: { hdg: [100, 100, 100, 280, 40], sep: 1500, apron: 190 },
  SFO: { hdg: [10, 10, 280, 280], sep: 1300, apron: 100 },
  MIA: { hdg: [90, 90, 270], sep: 1400, apron: 180 },
  YYZ: { hdg: [50, 50, 150], sep: 1600, apron: 140 },
  GRU: { hdg: [96, 96], sep: 400, apron: 186 },
  NRT: { hdg: [160, 160], sep: 2500, apron: 250 },
  HND: { hdg: [160, 160, 40, 220], sep: 2000, apron: 250 },
  ICN: { hdg: [150, 150, 330, 330], sep: 2000, apron: 240 },
  PEK: { hdg: [10, 10, 180], sep: 1800, apron: 100 },
  PVG: { hdg: [170, 170, 350, 350], sep: 2100, apron: 260 },
  HKG: { hdg: [70, 70], sep: 1500, apron: 160 },
  SIN: { hdg: [20, 20, 20], sep: 1600, apron: 110 },
  BKK: { hdg: [10, 10], sep: 2200, apron: 100 },
  SYD: { hdg: [160, 160, 70], sep: 1000, apron: 250 },
  MEL: { hdg: [160, 90], sep: 1200, apron: 250 },
  JNB: { hdg: [30, 30], sep: 1200, apron: 120 },
  CAI: { hdg: [50, 50, 230], sep: 1500, apron: 140 },
  PMI: { hdg: [60, 60], sep: 1200, apron: 150 },
  AGP: { hdg: [130, 130], sep: 600, apron: 220 },
  LPA: { hdg: [30, 30], sep: 500, apron: 120 },
  TFS: { hdg: [70], sep: 0, apron: 160 },
  ATH: { hdg: [30, 30], sep: 1500, apron: 120 },
  PRG: { hdg: [60, 120], sep: 1300, apron: 150 },
  WAW: { hdg: [110, 150], sep: 1200, apron: 200 },
  OTP: { hdg: [80, 80], sep: 500, apron: 170 }
};

/** Deterministische Ersatzrichtung für Flughäfen ohne Eintrag – gleich für alle Spieler. */
export function runwaysFor(ap) {
  const r = RUNWAYS[ap.iata];
  if (r) return r;
  let h = 2166136261;
  for (const c of ap.icao || ap.iata) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const hdg = ((h >>> 0) % 18) * 10;                 // 0..170 in Zehnerschritten
  return { hdg: [hdg], sep: 0, apron: (hdg + 90) % 360, guessed: true };
}
