// Großkreis-Geometrie: Distanz, Zwischenpunkte, Kurs.

const R = 6371; // Erdradius km
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Punkt auf dem Großkreis zwischen a und b, f = 0..1 */
export function interpolate(a, b, f) {
  const φ1 = rad(a.lat), λ1 = rad(a.lon), φ2 = rad(b.lat), λ2 = rad(b.lon);
  const δ = distanceKm(a, b) / R;
  if (δ < 1e-9) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - f) * δ) / Math.sin(δ), B = Math.sin(f * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) };
}

export function bearing(a, b) {
  const φ1 = rad(a.lat), φ2 = rad(b.lat), Δλ = rad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Linienpunkte für die Karte. Längengrade werden "entfaltet", damit Linien über die Datumsgrenze nicht quer über die Welt springen. */
export function arc(a, b, steps = 64) {
  const pts = [];
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const p = interpolate(a, b, i / steps);
    let lon = p.lon;
    if (prev !== null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; }
    pts.push([lon, p.lat]); prev = lon;
  }
  return pts;
}
