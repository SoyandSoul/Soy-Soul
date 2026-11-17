#!/usr/bin/env python3
"""Automatischer Blaupausen-Tracer: Seitenansicht (PNG/JPG/AVIF, weißer Grund) → Profil im Format von data/profiles.json.

Aufruf:  python3 -I trace.py <bilderordner> <ausgabe.json> [--debug ordner]

Was aus dem Bild kommt:  Rumpf-Ober-/Unterkontur (Nase, Buckel, Heckkonus), Seitenleitwerk (exakt), Lage/Länge der
Triebwerke (aus der Unterkontur), Fensterreihe (dunkle Punkte im Rumpf).
Was parametrisch ergänzt wird:  Flügel, Höhenleitwerk, Pylone, Türen, Cockpit – an den erkannten Stellen verankert.
"""
import sys, json, os, math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# ---------- Typtabelle: Datei → id, Länge (m), Spannweite (m), Hinweise für den Tracer
# eng: Gondellänge, Durchmesser (m), Abstände von der Rumpfmitte (m) · mount: wing | rear · tail: normal | T | delta
# wing: Wurzeltiefe, Spitzentiefe, Pfeilung°, V-Stellung°, Winglet-Typ
TYPES = {
    "A220-100":  dict(id="a220-100",  L=35.0,  span=35.1, eng=[3.9, 2.1, [4.9]],  wing=[5.5, 1.5, 24, 5, None]),
    "A220-300":  dict(id="a220-300",  L=38.7,  span=35.1, eng=[3.9, 2.1, [4.9]],  wing=[5.5, 1.5, 24, 5, None]),
    "A319-100":  dict(id="a319",      L=33.84, span=35.8, eng=[4.0, 2.05, [5.75]], wing=[6.1, 1.5, 27, 5, "sharklet"]),
    "A320-200":  dict(id="a320ceo",   L=37.57, span=35.8, eng=[4.0, 2.05, [5.75]], wing=[6.1, 1.5, 27, 5, "sharklet"]),
    "A320neo":   dict(id="a320neo",   L=37.57, span=35.8, eng=[4.3, 2.35, [5.75]], wing=[6.1, 1.5, 27, 5, "sharklet"]),
    "A321-200":  dict(id="a321",      L=44.51, span=35.8, eng=[4.0, 2.05, [5.75]], wing=[6.1, 1.5, 27, 5, "sharklet"]),
    "A321neo":   dict(id="a321neo",   L=44.51, span=35.8, eng=[4.3, 2.35, [5.75]], wing=[6.1, 1.5, 27, 5, "sharklet"]),
    "A330-200":  dict(id="a330-200",  L=58.82, span=60.3, eng=[5.6, 3.0, [9.4]],   wing=[10.0, 2.5, 33, 6, "fence"]),
    "A330-300":  dict(id="a330-300",  L=63.69, span=60.3, eng=[5.6, 3.0, [9.4]],   wing=[10.0, 2.5, 33, 6, "fence"]),
    "A330-900neo": dict(id="a330-900", L=63.66, span=64.0, eng=[6.0, 3.4, [9.4]],  wing=[10.0, 2.5, 33, 6, "sharklet"]),
    "A340-300":  dict(id="a340-300",  L=63.69, span=60.3, eng=[4.9, 2.4, [9.9, 19.6]], wing=[10.0, 2.5, 33, 6, "fence"]),
    "A340-600":  dict(id="a340-600",  L=75.36, span=63.45, eng=[5.4, 2.8, [10.2, 20.5]], wing=[10.6, 2.6, 33, 6, "fence"]),
    "A350-900":  dict(id="a350-900",  L=66.8,  span=64.75, eng=[6.0, 3.4, [9.5]],  wing=[11.0, 2.4, 35, 6, "curved"]),
    "A350-1000": dict(id="a350-1000", L=73.79, span=64.75, eng=[6.3, 3.5, [9.5]],  wing=[11.0, 2.4, 35, 6, "curved"]),
    "A380-800":  dict(id="a380-800",  L=72.72, span=79.75, eng=[6.0, 3.4, [15.4, 25.7]], wing=[17.0, 4.0, 35, 6, "fence"], deck2=True),
    "B717-200":  dict(id="b717-200",  L=37.8,  span=28.45, eng=[4.6, 2.0, [2.2]],  wing=[5.5, 1.5, 24, 3, None], mount="rear", tail="T"),
    "B737-400":  dict(id="b737-400",  L=36.4,  span=28.9,  eng=[3.9, 1.9, [4.9]],  wing=[6.5, 1.3, 25, 6, None]),
    "B737-800":  dict(id="b737-800",  L=39.5,  span=35.8,  eng=[3.9, 1.9, [4.9]],  wing=[6.5, 1.3, 25, 6, "blended"]),
    "B737-900ER": dict(id="b737-900er", L=42.1, span=35.8, eng=[3.9, 1.9, [4.9]],  wing=[6.5, 1.3, 25, 6, "blended"]),
    "B747-400":  dict(id="b747-400",  L=70.66, span=64.44, eng=[5.0, 2.7, [11.9, 21.3]], wing=[14.0, 4.0, 37, 7, "blended"]),
    "B747-8":    dict(id="b747-8i",   L=76.25, span=68.4,  eng=[5.6, 3.1, [11.9, 21.3]], wing=[14.0, 4.0, 37, 7, None]),
    "B757-200":  dict(id="b757-200",  L=47.32, span=38.05, eng=[5.0, 2.45, [7.3]], wing=[8.0, 2.0, 25, 6, "blended"]),
    "B757-300":  dict(id="b757-300",  L=54.43, span=38.05, eng=[5.0, 2.45, [7.3]], wing=[8.0, 2.0, 25, 6, "blended"]),
    "B767-300ER": dict(id="b767-300er", L=54.94, span=47.57, eng=[5.0, 2.8, [7.6]], wing=[9.0, 2.4, 31, 6, "blended"]),
    "B767-400ER": dict(id="b767-400er", L=61.37, span=51.92, eng=[5.0, 2.8, [7.6]], wing=[9.0, 2.4, 31, 6, "raked"]),
    "B777-200ER": dict(id="b777-200er", L=63.73, span=60.93, eng=[6.4, 3.8, [9.6]], wing=[12.0, 2.5, 31, 6, None]),
    "B777-300ER": dict(id="b777-300er", L=73.86, span=64.8,  eng=[6.6, 3.9, [9.6]], wing=[12.0, 2.5, 31, 6, "raked"]),
    "B787-8":    dict(id="b787-8",    L=56.72, span=60.12, eng=[5.8, 3.3, [9.8]],  wing=[11.0, 2.0, 32, 6, "raked"]),
    "B787-9":    dict(id="b787-9",    L=62.81, span=60.12, eng=[5.8, 3.3, [9.8]],  wing=[11.0, 2.0, 32, 6, "raked"]),
    "B787-10":   dict(id="b787-10",   L=68.28, span=60.12, eng=[5.8, 3.3, [9.8]],  wing=[11.0, 2.0, 32, 6, "raked"]),
    "Beechcraft-1900D": dict(id="be1900d", L=17.63, span=17.67, eng=[2.6, 0.9, [3.0]], wing=[2.2, 1.0, 2, 6, "fence"], mount="prop", tail="T", engX=0.27, propR=1.39),
    "Concorde":  dict(id="concorde",  L=61.66, span=25.6,  eng=[8.0, 1.6, [6.0]],  wing=[27.0, 1.0, 60, 0, None], mount="delta", tail="delta"),
    "CRJ-200":   dict(id="crj200",    L=26.77, span=21.21, eng=[3.0, 1.3, [1.9]],  wing=[3.5, 1.1, 24, 3, "sharklet"], mount="rear", tail="T"),
    "CRJ-700":   dict(id="crj700",    L=32.3,  span=23.24, eng=[3.3, 1.4, [1.9]],  wing=[3.9, 1.2, 25, 3, "sharklet"], mount="rear", tail="T"),
    "CRJ-900":   dict(id="crj900",    L=36.2,  span=24.85, eng=[3.3, 1.4, [1.9]],  wing=[3.9, 1.2, 25, 3, "sharklet"], mount="rear", tail="T"),
    "E-170":     dict(id="e170",      L=29.9,  span=26.0,  eng=[3.4, 1.7, [3.8]],  wing=[4.4, 1.3, 23, 5, "sharklet"]),
    "E-175":     dict(id="e175",      L=31.68, span=28.65, eng=[3.4, 1.7, [3.8]],  wing=[4.4, 1.3, 23, 5, "sharklet"]),
    "EMB-145":   dict(id="erj145",    L=29.87, span=20.04, eng=[2.6, 1.1, [1.7]],  wing=[3.0, 1.0, 23, 3, "sharklet"], mount="rear", tail="T"),
    # ---------- ab v0.32: Typen aus den Seitenrissen im Ordner "Flugzeug modelle"
    "A300-600":  dict(id="a300-600",  L=54.08, span=44.84, eng=[5.2, 2.8, [8.0]],   wing=[9.6, 2.5, 28, 5, None]),
    "A310-300":  dict(id="a310-300",  L=46.66, span=43.90, eng=[5.0, 2.8, [7.6]],   wing=[8.6, 2.2, 28, 5, "fence"]),
    "A318":      dict(id="a318",      L=31.44, span=34.10, eng=[4.0, 2.05, [5.75]], wing=[6.1, 1.5, 27, 5, "fence"]),
    "A340-500":  dict(id="a340-500",  L=67.93, span=63.45, eng=[5.4, 2.8, [10.2, 20.5]], wing=[10.6, 2.6, 33, 6, "fence"]),
    "B737-600":  dict(id="b737-600",  L=31.24, span=34.32, eng=[3.9, 1.9, [4.9]],   wing=[6.5, 1.3, 25, 6, None]),
    "B737-7MAX": dict(id="b737-max7", L=35.56, span=35.92, eng=[4.3, 2.1, [4.9]],   wing=[6.5, 1.3, 25, 6, "split"]),
    "B737-8MAX": dict(id="b737-max8", L=39.52, span=35.92, eng=[4.3, 2.1, [4.9]],   wing=[6.5, 1.3, 25, 6, "split"]),
    "B737-9MAX": dict(id="b737-max9", L=42.16, span=35.92, eng=[4.3, 2.1, [4.9]],   wing=[6.5, 1.3, 25, 6, "split"]),
    "B737-10 MAX": dict(id="b737-max10", L=43.80, span=35.92, eng=[4.3, 2.1, [4.9]], wing=[6.5, 1.3, 25, 6, "split"]),
    "B747-SP":   dict(id="b747sp",    L=56.31, span=59.64, eng=[5.0, 2.5, [11.9, 21.3]], wing=[14.0, 4.0, 37, 7, None]),
    "B777-9":    dict(id="b777-9",    L=76.72, span=71.75, eng=[6.8, 4.1, [9.8]],   wing=[12.0, 2.3, 31, 6, "raked"]),
    "CRJ-1000":  dict(id="crj1000",   L=39.13, span=26.18, eng=[3.5, 1.5, [1.9]],   wing=[3.9, 1.2, 25, 3, "sharklet"], mount="rear", tail="T"),
    "DHC-8-q400": dict(id="dhc8-400", L=32.84, span=28.42, eng=[5.0, 1.5, [4.6]],   wing=[3.4, 1.3, 3, 5, None], mount="prop", tail="T", highwing=True, propR=2.06),
    "E190":      dict(id="e190",      L=36.24, span=28.72, eng=[3.9, 2.0, [4.3]],   wing=[4.4, 1.3, 23, 5, "sharklet"]),
    "E195-E2":   dict(id="e195-e2",   L=41.50, span=35.10, eng=[4.0, 2.1, [4.4]],   wing=[4.8, 1.3, 25, 5, "curved"]),
    "Fokker 70": dict(id="f70",       L=30.91, span=28.08, eng=[4.3, 1.6, [2.4]],   wing=[4.6, 1.4, 17, 3, None], mount="rear", tail="T"),
    "Fokker-100": dict(id="f100",     L=35.53, span=28.08, eng=[4.3, 1.6, [2.4]],   wing=[4.6, 1.4, 17, 3, None], mount="rear", tail="T"),
    "MD-87":     dict(id="md87",      L=39.75, span=32.87, eng=[5.0, 1.5, [2.4]],   wing=[6.0, 1.6, 24, 3, None], mount="rear", tail="T"),
    "MD11":      dict(id="md11",      L=61.60, span=51.66, eng=[5.6, 2.9, [10.2]],  wing=[11.0, 2.6, 35, 6, "fence"], trijet=[6.5, 2.9]),
}

def load_rgb(path):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)[:, :, 3]
    alpha = a if (a < 128).mean() > 0.2 else None  # echte Transparenz vorhanden?
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    return np.asarray(Image.alpha_composite(bg, im).convert("RGB")).astype(np.int16), alpha

def foreground(rgb, alpha):
    if alpha is not None:
        m = alpha > 40
    else:
        mn = rgb.min(axis=2); mx = rgb.max(axis=2)
        m = (mn < 238) | ((mx - mn) > 22)
    m = ndi.binary_closing(m, iterations=2)
    return m

def pick_component(mask, retry=True):
    """Wählt die (oberste) große, flugzeugförmige Komponente (ohne Rahmen, Text, zweite Ansichten)."""
    try:
        return _pick(mask)
    except RuntimeError:
        if not retry: raise
        # dünne Linien (Rahmen, Maßstab) kappen, die das Flugzeug mit anderem verbinden
        return pick_component(ndi.binary_opening(mask, iterations=4), retry=False)

def _pick(mask):
    lab, n = ndi.label(mask)
    objs = ndi.find_objects(lab)
    cands = []
    for i, sl in enumerate(objs):
        if sl is None: continue
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        sub = lab[sl] == i + 1
        area = int(sub.sum()); fill = area / (w * h)
        if w < mask.shape[1] * 0.3 or w / max(h, 1) < 2.2 or w / max(h, 1) > 14 or fill < 0.18: continue
        cands.append((area, sl[0].start, i + 1, sl))
    if not cands: raise RuntimeError("keine Flugzeugkomponente gefunden")
    amax = max(c[0] for c in cands)
    cands = [c for c in cands if c[0] >= 0.6 * amax]
    cands.sort(key=lambda c: c[1])  # oberste zuerst
    _, _, idx, sl = cands[0]
    comp = ndi.binary_fill_holes(lab == idx)
    return comp, sl

def contours(comp, sl):
    ys, xs = sl
    sub = comp[sl]
    H, W = sub.shape
    top = np.full(W, np.nan); bot = np.full(W, np.nan)
    for x in range(W):
        col = np.where(sub[:, x])[0]
        if len(col): top[x] = col[0]; bot[x] = col[-1]
    return top, bot, W, H

def mode_of(vals, binw):
    v = vals[~np.isnan(vals)]
    if not len(v): return np.nan
    h, e = np.histogram(v, bins=np.arange(v.min(), v.max() + binw * 2, binw))
    i = h.argmax()
    sel = v[(v >= e[i]) & (v < e[i + 1])]
    return float(np.median(sel))

def runs(bool_arr):
    out = []; start = None
    for i, b in enumerate(bool_arr):
        if b and start is None: start = i
        if not b and start is not None: out.append((start, i - 1)); start = None
    if start is not None: out.append((start, len(bool_arr) - 1))
    return out

def rdp(pts, tol):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0][:2]), np.array(pts[-1][:2])
    d = b - a; n = np.hypot(*d) or 1
    best, idx = 0, -1
    for i in range(1, len(pts) - 1):
        p = np.array(pts[i][:2])
        dist = abs(d[0] * (a[1] - p[1]) - d[1] * (a[0] - p[0])) / n
        if dist > best: best, idx = dist, i
    if best > tol:
        return rdp(pts[:idx + 1], tol)[:-1] + rdp(pts[idx:], tol)
    return [pts[0], pts[-1]]

def mark_corners(pts, deg=55):
    out = []
    n = len(pts)
    for i in range(n):
        p0, p1, p2 = np.array(pts[i - 1][:2]), np.array(pts[i][:2]), np.array(pts[(i + 1) % n][:2])
        a, b = p0 - p1, p2 - p1
        na, nb = np.hypot(*a), np.hypot(*b)
        ang = 180.0
        if na > 1e-6 and nb > 1e-6:
            ang = math.degrees(math.acos(max(-1, min(1, float(np.dot(a, b)) / (na * nb)))))
        pt = [round(float(p1[0]), 3), round(float(p1[1]), 3)]
        if ang < 180 - deg or pts[i][2:3] == [1]: pt.append(1)
        out.append(pt)
    return out

def nacelle(x, cy, l, d):
    r = d / 2; pts = []
    for i in range(11):
        a = math.pi / 2 + (i / 10) * math.pi
        pts.append([x + r * 0.22 * (1 + math.cos(a)), cy - r * math.sin(a)])
    pts.reverse()
    return pts + [[x + l * 0.72, cy - r], [x + l, cy - r * 0.62], [x + l * 1.08, cy - r * 0.15], [x + l, cy + r * 0.5], [x + l * 0.72, cy + r * 0.95]]

def r3(v): return round(float(v), 3)
def poly(pts, smooth=True): return {"pts": [[r3(p[0]), r3(p[1])] + ([1] if len(p) > 2 and p[2] else []) for p in pts], "smooth": smooth}

def trace(path, spec, debug=None):
    rgb, alpha = load_rgb(path)
    mask = foreground(rgb, alpha)
    comp, sl = pick_component(mask)
    top, bot, W, H = contours(comp, sl)
    L = spec["L"]; m = L / W  # Meter pro Pixel
    xs = np.arange(W)

    # --- Rumpf-Grundlinien (Pixel, y nach unten)
    topsel = (xs > 0.42 * W) & (xs < 0.62 * W)   # hinter einem Buckel, vor dem Leitwerk
    botsel = (xs > 0.12 * W) & (xs < 0.32 * W)   # hinter der Nase, vor Flügel/Verkleidung
    top_base = mode_of(top[topsel], 2)
    bot_base = mode_of(bot[botsel], 2)
    D_px = bot_base - top_base
    Dm = D_px * m

    # --- Seitenleitwerk: Bereich hinten, wo die Oberkontur deutlich über die Rumpfoberkante steigt
    rise = (top_base - top) > 0.10 * D_px
    rise[xs < 0.5 * W] = False
    fin_runs = [r for r in runs(rise) if r[1] - r[0] > 0.02 * W]
    mount = spec.get("mount", "wing")
    if not fin_runs: raise RuntimeError("kein Leitwerk gefunden")
    fr = fin_runs[-1]
    tip_x = int(np.nanargmin(top))
    for r in fin_runs:
        if r[0] <= tip_x <= r[1]: fr = r
    fin_x0, fin_x1 = fr
    rear_nacelle = None
    if mount == "rear":
        # Gondel liegt vor dem Leitwerk in derselben Silhouette: Vorderkante des Leitwerks aus der steilen Flanke
        # zurückrechnen (Höhe 0.7 D → 1.3 D über Rumpfoberkante), dann auf die Rumpfoberkante verlängern
        xa = next((x for x in range(tip_x, fin_x0, -1) if top_base - top[x] < 0.7 * D_px), fin_x0)
        xb = next((x for x in range(tip_x, fin_x0, -1) if top_base - top[x] < 1.3 * D_px), fin_x0)
        slope = (xb - xa) / max(1e-6, (top[xa] - top[xb]))  # Pixel x pro Pixel Höhe
        root = int(xa - slope * (top_base - top[xa]))
        # Gondel: Plateau zwischen fr[0] und root
        plateau = [x for x in range(fr[0], max(fr[0] + 1, root)) if 0.12 * D_px < top_base - top[x] < 0.9 * D_px]
        if len(plateau) > 0.02 * W:
            rear_nacelle = (plateau[0], plateau[-1], float(np.nanmin(top[plateau[0]:plateau[-1] + 1])))
        fin_x0 = max(fr[0], root)
    # Leitwerkswurzel vorne leicht vorziehen (Rückenflosse)
    fin_x0 = max(int(0.45 * W), fin_x0 - int(0.012 * W))

    # Heckspitze: hinterste Spalte, deren Unterkontur noch zum Rumpf gehört (unterhalb der oberen 15 %)
    tail_x = W - 1
    for x in range(W - 1, int(0.8 * W), -1):
        if not np.isnan(bot[x]) and bot[x] > top_base + 0.15 * D_px: tail_x = x; break
    # steht Höhenleitwerk/Ruder hinter dem Rumpf, springt die Unterkontur am Rumpfende nach unten
    for x in range(tail_x - 1, int(0.85 * W), -1):
        if not np.isnan(bot[x]) and not np.isnan(bot[x + 1]) and bot[x] - bot[x + 1] > 0.1 * D_px:
            tail_x = x; break
    tail_y = bot[tail_x] - 0.08 * D_px
    fus_top = top.copy()
    x_fin_root = fin_x0
    y_fin_root = top[x_fin_root] if top_base - top[x_fin_root] < 0.12 * D_px else top_base
    for x in range(x_fin_root, W):
        k = (x - x_fin_root) / max(1, (tail_x - x_fin_root))
        fus_top[x] = y_fin_root + (tail_y - 0.07 * D_px - y_fin_root) * min(1, k) ** 1.15
    if mount == "rear":  # Gondel oben hinten: Oberkontur davor auf die Rumpflinie zurückholen
        for x in range(int(0.55 * W), x_fin_root):
            if top_base - top[x] > 0.04 * D_px: fus_top[x] = top_base
    if mount == "prop":  # Propellerspinner/Gondel ragen über die Rumpfoberkante
        for x in range(int(0.1 * W), x_fin_root):
            if top_base - top[x] > 0.04 * D_px: fus_top[x] = top_base

    # --- Unterkontur: Auswüchse (Triebwerke, Fahrwerk) entfernen
    depth = bot - bot_base
    depth[np.isnan(depth)] = 0
    prot = depth > 0.08 * D_px
    prot[(xs > 0.9 * W)] = False
    # 1D-Öffnung: schmale Auswüchse (Fahrwerk) fallen weg
    k = max(3, int(0.045 * W))
    prot_open = ndi.binary_opening(prot, structure=np.ones(k))
    eng_runs = [r for r in runs(prot_open) if (r[1] - r[0]) * m > 0.4 * spec["eng"][0] and np.nanmax(depth[r[0]:r[1] + 1]) * m > 0.3 * spec["eng"][1]]
    if spec.get("engX"): eng_runs = []
    fus_bot = bot.copy()
    for r in runs(prot):
        x0, x1 = max(0, r[0] - 2), min(W - 1, r[1] + 2)
        ya, yb = bot[x0] if not prot[x0] else bot_base, bot[x1] if not prot[x1] else bot_base
        for x in range(x0, x1 + 1):
            fus_bot[x] = ya + (yb - ya) * (x - x0) / max(1, x1 - x0)
    # Nase/Heck unten: Unterkontur ist dort bereits Rumpf
    # Glätten
    fus_top_s = ndi.uniform_filter1d(np.nan_to_num(fus_top, nan=top_base), 3)
    fus_bot_s = ndi.uniform_filter1d(np.nan_to_num(fus_bot, nan=bot_base), 3)

    # --- in Meter: x ab Nase, y = 0 auf Rumpfmitte
    cy = (top_base + bot_base) / 2
    X = lambda px: px * m
    Y = lambda py: (py - cy) * m
    step = max(1, int(0.35 / m))
    TX = tail_x
    upper = [[X(x), Y(fus_top_s[x])] for x in range(0, TX, step)] + [[X(TX), Y(fus_top_s[TX])]]
    lower = [[X(TX), Y(fus_bot_s[TX])]] + [[X(x), Y(fus_bot_s[x])] for x in range(TX - (TX % step), -1, -step)] + [[X(0), Y(fus_bot_s[0])]]
    fus = rdp(upper, 0.05) + rdp(lower, 0.05)
    # Doppelpunkte entfernen
    clean = []
    for p in fus:
        if not clean or abs(clean[-1][0] - p[0]) > 1e-3 or abs(clean[-1][1] - p[1]) > 1e-3: clean.append(p)
    fus = mark_corners(clean)
    fuselage = [poly(fus)]

    # --- Seitenleitwerk-Polygon: Oberkontur von fin_x0 bis Ende + Rumpflinie zurück
    fin_pts = [[X(x), Y(top[x])] for x in range(fin_x0, W, max(1, step // 2)) if not np.isnan(top[x])]
    fin_pts.append([X(W - 1), Y(top[W - 1] if not np.isnan(top[W - 1]) else fus_top_s[W - 1])])
    def back_y(x):
        y = fus_top_s[x] + 0.25 / m
        if x > tail_x and not np.isnan(bot[x]): y = min(y, bot[x])
        return Y(y)
    back = [[X(x), back_y(x)] for x in range(W - 1, fin_x0 - 1, -max(1, step))]
    fin_poly = mark_corners(rdp(fin_pts, 0.05) + rdp(back, 0.08))
    fin = [poly(fin_poly)]

    # --- Höhenleitwerk
    tail = spec.get("tail", "normal")
    span = spec["span"]
    stab = []
    if tail == "T":
        # oben am Leitwerk: Spitze des Leitwerks
        ty = Y(top[tip_x]); tx0 = X(tip_x)
        chord = 0.12 * L
        stab = [poly([[tx0 - chord * 0.9, ty + 0.05], [tx0 + chord * 0.45, ty - 0.35], [tx0 + chord * 0.75, ty - 0.3], [tx0 + chord * 0.2, ty + 0.4]])]
    elif tail == "delta":
        stab = []
    else:
        sChord = 0.055 * L; sSpan = max(5, span * 0.17); sSweep = sSpan * 0.55
        sRoot = X(tail_x) - 0.02 * L - sSweep - sChord * 0.4; sY = Y(tail_y) * 0.2
        stab = [poly([[sRoot, sY], [sRoot + sSweep, sY - sSpan * 0.1], [sRoot + sSweep + sChord * 0.4, sY - sSpan * 0.1 + 0.12], [sRoot + sChord, sY + 0.4]], False)]

    # --- Triebwerke + Flügel
    enl, end, spans = spec["eng"]
    wr, wt, ws, wd, tip = spec["wing"]
    D = Dm
    tanS, tanD = math.tan(math.radians(ws)), math.tan(math.radians(wd))
    half = span / 2 - D / 2
    engine, wing, props = [], [], []
    bot_m = D / 2
    if mount == "wing" or mount == "prop":
        # Verankerung: größter Auswuchs = inneres Triebwerk
        if eng_runs:
            r = max(eng_runs, key=lambda r: r[1] - r[0])
            ex_px = r[0]; eb = max(bot[r[0]:r[1] + 1])
            ex = X(ex_px) - 0.1; ebot = Y(eb)
        elif spec.get("engX"):
            ex = spec["engX"] * L; ebot = bot_m + end * 0.6
        else:
            ex = 0.43 * L - wr * 0.55 + spans[0] * tanS - enl * 0.62; ebot = bot_m + end * 0.95
        s0 = spans[0] - D / 2
        # Flügel so legen, dass das innere Triebwerk an der erkannten Stelle sitzt
        leAt0 = ex + enl * 0.62
        wRootLE = leAt0 - s0 * tanS
        wY = -bot_m * 0.98 if spec.get("highwing") else bot_m * 0.42
        cy0 = ebot - end * 0.475  # Gondelmitte: Unterkante − 0.95 r
        cy0 = min(cy0, bot_m + 0.55 * end)  # Gondel hängt nie völlig frei unter dem Rumpf
        if mount == "prop": cy0 = (wY + end * 0.45) if spec.get("highwing") else bot_m * 0.25
        wTipLE = wRootLE + half * tanS; wTipY = wY - half * tanD
        wing.append(poly([[wRootLE, wY], [wTipLE, wTipY], [wTipLE + wt, wTipY + 0.12], [wRootLE + wr, wY + 0.55]], False))
        if tip:
            h = {"sharklet": 2.4, "blended": 2.5, "split": 2.1, "curved": 2.0, "fence": 1.1, "raked": 0.9}[tip]
            back_ = 0.9 if tip in ("curved", "raked") else 0.6
            wing.append(poly([[wTipLE + 0.1, wTipY + 0.05], [wTipLE + wt * back_, wTipY - h], [wTipLE + wt * back_ + wt * 0.35, wTipY - h], [wTipLE + wt, wTipY + 0.1]], False))
            if tip == "fence": wing.append(poly([[wTipLE + wt * 0.3, wTipY + 0.1], [wTipLE + wt * 0.7, wTipY + 0.9], [wTipLE + wt, wTipY + 0.9], [wTipLE + wt, wTipY + 0.1]], False))
        for sp in reversed(spans):
            s = sp - D / 2
            wingYAt = wY - s * tanD; leAt = wRootLE + s * tanS
            exi = leAt - enl * 0.62
            cyi = cy0 - (s - s0) * tanD
            if mount == "prop":
                props.append({"cx": round(exi - end * 0.1, 3), "cy": round(cyi, 3), "r": round(spec.get("propR", end * 1.35), 3)})
                # Turboprop: schlanke Gondel auf dem Flügel + Propellerscheibe
                engine.append(poly([[exi, cyi - end * 0.5], [exi + enl * 0.3, cyi - end * 0.62], [exi + enl, cyi - end * 0.3], [exi + enl * 1.05, cyi + end * 0.1], [exi + enl, cyi + end * 0.45], [exi + enl * 0.3, cyi + end * 0.55], [exi, cyi + end * 0.45]]))
            else:
                engine.append(poly(nacelle(exi, cyi, enl, end), False))
                wing.append(poly([[exi + enl * 0.45, cyi - end * 0.42], [leAt - 0.2, wingYAt + 0.05], [leAt + wr * 0.45, wingYAt + 0.3], [exi + enl * 0.98, cyi - end * 0.28]], False))
    elif mount == "rear":
        # Gondel hinten oben am Rumpf (nahe Seite), Flügel tief vorne
        wRootLE = 0.42 * L - wr * 0.5; wY = bot_m * 0.42
        wTipLE = wRootLE + half * tanS; wTipY = wY - half * tanD
        wing.append(poly([[wRootLE, wY], [wTipLE, wTipY], [wTipLE + wt, wTipY + 0.12], [wRootLE + wr, wY + 0.55]], False))
        if tip:
            wing.append(poly([[wTipLE + 0.1, wTipY + 0.05], [wTipLE + wt * 0.6, wTipY - 1.6], [wTipLE + wt * 0.95, wTipY - 1.6], [wTipLE + wt, wTipY + 0.1]], False))
        if rear_nacelle:
            px0, px1, ptop = rear_nacelle
            enl = max(enl, (px1 - px0) * m * 0.95)
            ex = X(px0); cyn = Y(ptop) + end * 0.5
        else:
            ex = X(x_fin_root) - enl * 1.1; cyn = -D * 0.25
        engine.append(poly(nacelle(ex, cyn, enl, end), False))
        wing.append(poly([[ex + enl * 0.4, cyn], [ex + enl * 0.4, cyn + end * 0.9], [ex + enl * 0.9, cyn + end * 0.9], [ex + enl * 0.95, cyn]], False))
    if spec.get("trijet"):  # drittes Triebwerk im Seitenleitwerk (MD-11, DC-10)
        tnl, tnd = spec["trijet"]
        engine.append(poly(nacelle(X(x_fin_root) + 0.12 * L * 0.2, Y(top[tip_x]) * 0.3 - D * 0.1, tnl, tnd), False))
    if mount == "delta":
        # Concorde: Ogivaldelta – Wurzel lang am Rumpf, Spitze hinten; Triebwerkskästen unter dem Flügel
        wRootLE = 0.33 * L; wY = bot_m * 0.3
        wing.append(poly([[wRootLE, wY], [0.62 * L, wY - 2.6], [0.9 * L, wY - 2.2], [0.92 * L, wY + 0.9], [0.6 * L, wY + 1.4]]))
        for sp in [6.0]:
            exi = 0.62 * L
            engine.append(poly([[exi, wY + 0.2], [exi + 0.3 * L, wY + 0.2], [exi + 0.31 * L, wY + 2.0], [exi + 0.02 * L, wY + 2.2]], False))

    # --- Deko: Fensterreihe aus dem Bild (dunkle kleine Punkte im Rumpf)
    nl_px0 = next((x for x in range(W) if top[x] <= top_base + 0.03 * D_px), int(0.08 * W))
    windows = []
    sub = rgb[sl]
    lum = sub.mean(axis=2)
    dark = (lum < 110) & comp[sl]
    lab, n = ndi.label(dark)
    objs = ndi.find_objects(lab)
    cand = []
    wpx = 0.35 / m
    for i, s in enumerate(objs):
        if s is None: continue
        h = s[0].stop - s[0].start; w = s[1].stop - s[1].start
        if 0.4 * wpx < h < 2.2 * wpx and 0.3 * wpx < w < 2.0 * wpx:
            cy_ = (s[0].start + s[0].stop) / 2; cx_ = (s[1].start + s[1].stop) / 2
            if top_base + 0.1 * D_px < cy_ < top_base + 0.6 * D_px: cand.append((cy_, cx_))
    if len(cand) > 8:
        ys_ = np.array([c[0] for c in cand])
        # dichteste Zeile
        best = None
        for y0 in ys_:
            sel = [c for c in cand if abs(c[0] - y0) < 0.08 * D_px]
            if best is None or len(sel) > len(best): best = sel
        best = [c for c in (best or []) if nl_px0 * 0.95 < c[1] < x_fin_root + 0.05 * W]
        if len(best) > 8:
            xs_ = sorted(c[1] for c in best)
            gaps = np.diff(xs_)
            pitch = float(np.median(gaps[gaps > 0]))
            windows.append({"y": r3(Y(np.median([c[0] for c in best]))), "x0": r3(X(xs_[0])), "x1": r3(X(xs_[-1])), "pitch": r3(max(0.4, min(0.8, pitch * m))), "w": 0.24, "h": 0.36})
    if not windows:
        # parametrisch
        nl = next((X(x) for x in range(W) if top[x] <= top_base + 0.02 * D_px), 0.08 * L)
        rows_y = [-D * 0.13] if not spec.get("deck2") else [D * 0.12, -D * 0.25]
        for yy in rows_y: windows.append({"y": r3(yy), "x0": r3(nl * 1.12), "x1": r3(X(x_fin_root) - D * 0.15), "pitch": 0.53, "w": 0.24, "h": 0.36})
    if spec.get("deck2") and len(windows) == 1:
        windows.append({"y": r3(windows[0]["y"] - D * 0.37), "x0": windows[0]["x0"], "x1": windows[0]["x1"], "pitch": windows[0]["pitch"], "w": 0.24, "h": 0.36})
    # 747-Buckel: zweite Fensterreihe oben vorne
    hump_top = top_base - np.nanmin(top[int(0.08 * W):int(0.35 * W)])
    if hump_top > 0.25 * D_px and not spec.get("deck2"):
        hx1 = next((X(x) for x in range(int(0.15 * W), int(0.5 * W)) if top_base - top[x] < 0.2 * D_px), 0.3 * L)
        windows.append({"y": r3(Y(top_base - hump_top * 0.5)), "x0": r3(0.1 * L), "x1": r3(hx1 - 1.5), "pitch": 0.53, "w": 0.24, "h": 0.34})

    # Türen (parametrisch, auf die erkannte Fensterreihe gelegt)
    w0 = windows[0]
    narrow = D < 4.6
    dw, dh = (0.82, 1.85) if narrow else (1.05, 1.93)
    nl_m = X(nl_px0)
    doorsX = [max(w0["x0"] - 1.2, nl_m * 0.9), min(w0["x1"] + 1.2, X(x_fin_root) - D * 0.3)]
    if not narrow: doorsX += [L * 0.33, L * 0.55]
    elif L > 42: doorsX += [L * 0.40, L * 0.62]
    doors = [{"x": r3(x), "y": r3(w0["y"] - 0.55), "w": dw, "h": dh} for x in doorsX]

    # Cockpit: auf der Nasenrundung, folgt der Oberkontur
    nl_px = next((x for x in range(W) if top[x] <= top_base + 0.03 * D_px), int(0.08 * W))
    a, b = 0.22, 0.45
    x0c, x1c = int(nl_px * a), int(nl_px * b); xm = int(x0c + (x1c - x0c) * 0.3)
    yT = lambda x: Y(fus_top_s[min(W - 1, max(0, x))])
    cockpit = [poly([[X(x0c), yT(x0c) + D * 0.13], [X(xm), yT(xm) + D * 0.045], [X(x1c), yT(x1c) + D * 0.06], [X(x1c), yT(x1c) + D * 0.16], [X(xm), yT(xm) + D * 0.15]], False)]

    prof = {"L": L, "D": r3(D), "zones": {"fuselage": fuselage, "fin": fin, "stab": stab, "wing": wing, "engine": engine},
            "deco": {"windows": windows, "doors": doors, "cockpit": cockpit, "props": props}, "traced": __import__("datetime").date.today().isoformat(), "method": "auto-silhouette"}
    if debug:
        dbg = Image.fromarray((comp[sl] * 255).astype(np.uint8)).convert("RGB")
        from PIL import ImageDraw
        d = ImageDraw.Draw(dbg)
        d.line([(x, fus_top_s[x]) for x in range(W)], fill=(255, 0, 0))
        d.line([(x, fus_bot_s[x]) for x in range(W)], fill=(0, 160, 255))
        d.line([(fin_x0, 0), (fin_x0, H)], fill=(255, 160, 0))
        for r in eng_runs: d.rectangle([r[0], bot_base, r[1], H - 1], outline=(0, 255, 0))
        dbg.save(os.path.join(debug, spec["id"] + ".png"))
    return prof

norm = lambda s: "".join(ch for ch in s.lower() if ch.isalnum())
NORM = {norm(k): v for k, v in TYPES.items()}

def main():
    src, out = sys.argv[1], sys.argv[2]
    debug = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--debug" else None
    if debug: os.makedirs(debug, exist_ok=True)
    profiles = {}
    for f in sorted(os.listdir(src)):
        key = os.path.splitext(f)[0]
        spec = TYPES.get(key) or NORM.get(norm(key))
        if not spec: print("übersprungen:", f); continue
        try:
            profiles[spec["id"]] = trace(os.path.join(src, f), spec, debug)
            print("ok", spec["id"])
        except Exception as e:
            print("FEHLER", spec["id"], e)
    with open(out, "w") as fh: json.dump(profiles, fh, separators=(",", ":"))
    print(len(profiles), "Profile →", out, os.path.getsize(out) // 1024, "KB")

if __name__ == "__main__": main()
