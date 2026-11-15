#!/usr/bin/env python3
"""
DXF → SVG für die 3-Seiten-Ansichten von Airbus und Boeing.

Die Hersteller liefern ZIPs mit .dwg und/oder .dxf (AutoCAD). Dieses Skript liest ASCII-DXF ohne
Zusatzpakete und schreibt die Linien als SVG. Damit lassen sich die echten Umrisse als Vorlage für
aircraftArt.js nutzen (oder später direkt als Grafik, falls ihr das rechtlich dürft – siehe README).

Nur .dwg vorhanden? Erst mit dem kostenlosen "ODA File Converter" (opendesign.com) oder LibreCAD
nach DXF umwandeln.

Beispiele:
    python3 tools/dxf_to_svg.py 7878.dxf --info                       # Layer und Ausdehnung anzeigen
    python3 tools/dxf_to_svg.py 7878.dxf -o 787-8.svg                 # alles
    python3 tools/dxf_to_svg.py 7878.dxf -o side.svg --bbox 0,0,60,20 # nur Seitenansicht (Zeichnungskoordinaten)
    python3 tools/dxf_to_svg.py a320.dxf -o a320.svg --layer OUTLINE
"""
import argparse, math, sys
from collections import defaultdict


def read_pairs(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = [l.rstrip("\r\n") for l in f]
    if len(lines) < 2 or not lines[0].strip().lstrip("-").isdigit():
        sys.exit("Keine ASCII-DXF-Datei (binäre DXF/DWG bitte erst umwandeln).")
    for i in range(0, len(lines) - 1, 2):
        yield int(lines[i].strip()), lines[i + 1].strip()


def entities(path):
    """Liefert (typ, layer, punkte, geschlossen) aus der ENTITIES-Sektion."""
    in_ent, cur, poly = False, None, None
    out = []

    def flush(e):
        if not e: return
        t, d = e["type"], e
        L = d.get(8, "0")
        if t == "LINE":
            out.append((L, [(d[10], d[20]), (d[11], d[21])], False))
        elif t == "LWPOLYLINE":
            out.append((L, list(zip(d["xs"], d["ys"])), bool(int(d.get(70, 0)) & 1)))
        elif t in ("CIRCLE", "ARC"):
            cx, cy, r = d[10], d[20], d[40]
            a0, a1 = (d.get(50, 0.0), d.get(51, 360.0)) if t == "ARC" else (0.0, 360.0)
            if a1 < a0: a1 += 360
            n = max(8, int((a1 - a0) / 6))
            pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]
            out.append((L, pts, t == "CIRCLE"))
        elif t == "SPLINE":  # Kontrollpunkte als Näherung
            if d["xs"]: out.append((L, list(zip(d["xs"], d["ys"])), False))

    for code, val in read_pairs(path):
        if code == 0 and val == "SECTION": continue
        if code == 2 and val == "ENTITIES": in_ent = True; continue
        if code == 0 and val == "ENDSEC" and in_ent:
            flush(cur); cur = None; in_ent = False; continue
        if not in_ent: continue
        if code == 0:
            if val == "VERTEX" and poly is not None:
                cur = {"type": "VERTEX"}; continue
            if val == "SEQEND" and poly is not None:
                out.append((poly["layer"], poly["pts"], poly["closed"])); poly = None; cur = None; continue
            if cur and cur["type"] == "VERTEX" and poly is not None:
                pass
            else:
                flush(cur)
            cur = {"type": val, "xs": [], "ys": []}
            if val == "POLYLINE": poly = {"layer": "0", "pts": [], "closed": False}
            continue
        if cur is None: continue
        if cur["type"] == "POLYLINE" and poly is not None:
            if code == 8: poly["layer"] = val
            if code == 70: poly["closed"] = bool(int(val) & 1)
            continue
        if cur["type"] == "VERTEX" and poly is not None:
            if code == 10: cur["x"] = float(val)
            if code == 20: poly["pts"].append((cur.get("x", 0.0), float(val)))
            continue
        if code in (10, 20) and cur["type"] in ("LWPOLYLINE", "SPLINE"):
            (cur["xs"] if code == 10 else cur["ys"]).append(float(val)); continue
        if code in (10, 20, 11, 21, 40, 50, 51):
            cur[code] = float(val)
        elif code in (8, 70):
            cur[code] = val
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dxf"); ap.add_argument("-o", "--out")
    ap.add_argument("--info", action="store_true", help="Layer und Ausdehnung ausgeben")
    ap.add_argument("--layer", action="append", help="nur diese Layer (mehrfach möglich)")
    ap.add_argument("--bbox", help="x1,y1,x2,y2 in Zeichnungskoordinaten – z. B. nur die Seitenansicht")
    ap.add_argument("--stroke", type=float, default=0.06)
    a = ap.parse_args()

    ents = entities(a.dxf)
    if a.layer: ents = [e for e in ents if e[0] in a.layer]
    if a.bbox:
        x1, y1, x2, y2 = map(float, a.bbox.split(","))
        ents = [e for e in ents if all(x1 <= x <= x2 and y1 <= y <= y2 for x, y in e[1])]
    if not ents: sys.exit("Keine Linien gefunden.")
    xs = [x for e in ents for x, _ in e[1]]; ys = [y for e in ents for _, y in e[1]]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)

    if a.info or not a.out:
        per = defaultdict(int)
        for e in ents: per[e[0]] += 1
        print(f"{len(ents)} Elemente · Ausdehnung x {minx:.2f}…{maxx:.2f}  y {miny:.2f}…{maxy:.2f}")
        for k, v in sorted(per.items(), key=lambda kv: -kv[1]): print(f"  Layer {k}: {v}")
        if not a.out: return

    w, h = maxx - minx, maxy - miny
    paths = []
    for _, pts, closed in ents:
        d = "M" + " L".join(f"{x - minx:.3f},{maxy - y:.3f}" for x, y in pts) + (" Z" if closed else "")
        paths.append(f'<path d="{d}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.3f} {h:.3f}">'
           f'<g fill="none" stroke="#000" stroke-width="{a.stroke}" stroke-linejoin="round">{"".join(paths)}</g></svg>')
    with open(a.out, "w") as f: f.write(svg)
    print(f"{a.out}: {len(paths)} Pfade, {w:.1f} × {h:.1f} Einheiten")


if __name__ == "__main__":
    main()
