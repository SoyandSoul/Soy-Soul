// Pfad-Helfer: geglättete geschlossene Konturen (Catmull-Rom) für den weichen Zeichentrick-Look.
// Punkte: [x, y, ecke]. ecke = 1 → harter Knick (z. B. Leitwerksspitze), sonst rund.

const f = n => +n.toFixed(3);

/** Bézier-Segmente einer geschlossenen Kontur. smooth = false → Polygon. */
function segments(pts, smooth) {
  const n = pts.length, segs = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (!smooth) { segs.push([p1, p1, p2, p2]); continue; }
    const t1 = p1[2] ? 0 : 1 / 6, t2 = p2[2] ? 0 : 1 / 6;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t1, p1[1] + (p2[1] - p0[1]) * t1];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t2, p2[1] - (p3[1] - p1[1]) * t2];
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}

export function pathD(pts, smooth = false) {
  if (!pts.length) return "";
  if (!smooth) return "M" + pts.map(p => f(p[0]) + "," + f(p[1])).join(" L") + " Z";
  const segs = segments(pts, true);
  return "M" + f(pts[0][0]) + "," + f(pts[0][1]) + segs.map(([, c1, c2, p]) => ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p[0])},${f(p[1])}`).join("") + " Z";
}

/** Dichte Punktliste für Trefferprüfung und Bounding-Box */
export function samplePoly(pts, smooth = false, steps = 8) {
  if (!smooth) return pts.map(p => [p[0], p[1]]);
  const out = [];
  for (const [a, b, c, d] of segments(pts, true)) {
    for (let i = 0; i < steps; i++) {
      const t = i / steps, u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
    }
  }
  return out;
}

/** Offene Linie (Pinselstrich) als geglätteter Pfad */
export function strokeD(pts) {
  if (!pts.length) return "";
  if (pts.length < 3) return "M" + pts.map(p => f(p[0]) + "," + f(p[1])).join(" L") + (pts.length === 1 ? ` l0.001,0` : "");
  let d = "M" + f(pts[0][0]) + "," + f(pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${f(pts[i][0])},${f(pts[i][1])} ${f(mx)},${f(my)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${f(l[0])},${f(l[1])}`;
}

/** Ramer-Douglas-Peucker: Pinselstriche verkleinern, bevor sie gespeichert werden */
export function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sq = tol * tol;
  const rec = (a, b, out) => {
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len));
      const ex = ax + t * dx - pts[i][0], ey = ay + t * dy - pts[i][1], d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > sq) { rec(a, idx, out); out.push(pts[idx]); rec(idx, b, out); }
  };
  const out = [pts[0]];
  rec(0, pts.length - 1, out);
  out.push(pts[pts.length - 1]);
  return out;
}
