#!/usr/bin/env python3
"""Seitenrisse für den Fotomodus aufbereiten: Vorlage (zwei Ansichten, weißer Grund) → ein freigestelltes PNG.

Aufruf:  python3 -I crop_sideviews.py <bilderordner> <zielordner> <photos.js>

Die Vorlagen zeigen dasselbe Flugzeug zweimal übereinander – oben ohne, unten mit Fahrwerk.
Genommen wird die untere Ansicht, weil das Spiel die Flugzeuge am Boden mit Schatten zeigt.

Freistellen: Das Flugzeug ist selbst weiß, ein simples "Weiß → durchsichtig" würde den Rumpf auffressen.
Stattdessen wird dieselbe Silhouette bestimmt wie im Blaupausen-Tracer (dunkle oder farbige Pixel,
Lücken geschlossen, Löcher gefüllt) und als Alphakanal verwendet. Innen bleibt das Bild unverändert.

Ausgabe: <zielordner>/<id>.png und eine photos.js mit Bildgröße je Typ (für den Maßstab in der UI).
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# Dateiname der Vorlage → Typ-ID im Spiel. Schreibweise egal, siehe norm().
NAMES = {
    "A300-600": "a300-600", "A310-300": "a310-300", "A318": "a318", "A319-100": "a319",
    "A320-200": "a320ceo", "A320-200neo": "a320neo", "A321-200": "a321", "A321neo": "a321neo",
    "A330-200": "a330-200", "A330-300": "a330-300", "A330-900neo": "a330-900",
    "A340-300": "a340-300", "A340-500": "a340-500", "A340-600": "a340-600",
    "A350-900": "a350-900", "A350-1000": "a350-1000", "A380-800": "a380-800",
    "B717-200": "b717-200", "B737-400": "b737-400", "B737-600": "b737-600", "B737-800": "b737-800",
    "B737-7MAX": "b737-max7", "B737-8MAX": "b737-max8", "B737-9MAX": "b737-max9", "B737-10 MAX": "b737-max10",
    "B747-400": "b747-400", "B747-8i": "b747-8i", "B747-SP": "b747sp",
    "B757-200": "b757-200", "B757-300": "b757-300",
    "B767-300ER": "b767-300er", "B767-400": "b767-400er",
    "B777-200ER": "b777-200er", "B777-300ER": "b777-300er", "B777-9": "b777-9",
    "B787-8": "b787-8", "B787-9": "b787-9", "B787-10": "b787-10",
    "Beechcraft 1900D": "be1900d", "CRJ-1000": "crj1000", "DHC-8-q400": "dhc8-400",
    "E190": "e190", "E195-E2": "e195-e2",
    "Fokker 70": "f70", "Fokker-100": "f100", "MD-87": "md87", "MD11": "md11",
}
norm = lambda s: "".join(ch for ch in s.lower() if ch.isalnum())
NORM = {norm(k): v for k, v in NAMES.items()}

MAX_W = 900  # breiter braucht es die UI nie

# Fensterhöhe = Höhe/Länge mal gezeichnete Länge, mal diesem Faktor: Mit eingefahrenem Fahrwerk
# ist das Flugzeug niedriger als die Normhöhe, die ab Boden gemessen wird.
WINDOW = 0.93

# Höhe/Länge je Typ – bestimmt, wie hoch der Ausschnitt wird. Neu erzeugen nach Änderungen am Katalog:
#   node -e "import('./js/data/aircraft.js').then(m=>{const o={};for(const a of m.AIRCRAFT)\
#     o[a.id]=+(a.info.heightM/a.art.lengthM).toFixed(4);\
#     require('fs').writeFileSync('tools/aircraft-dims.json',JSON.stringify(o))})"
DIMS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "aircraft-dims.json")))



def silhouette(rgb, alpha):
    """Maske des Flugzeugs – dieselbe Logik wie in trace_profiles.py."""
    if alpha is not None:
        m = alpha > 40
    else:
        mn = rgb.min(axis=2)
        mx = rgb.max(axis=2)
        m = (mn < 238) | ((mx - mn) > 22)
    m = ndi.binary_closing(m, iterations=3)
    return ndi.binary_fill_holes(m)


def crop(path, ratio, win_f=WINDOW):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)[:, :, 3]
    alpha = a if (a < 128).mean() > 0.2 else None
    rgb = np.asarray(Image.alpha_composite(Image.new("RGBA", im.size, (255,) * 4), im).convert("RGB")).astype(np.int16)

    m = silhouette(rgb, alpha)
    # Genommen wird die OBERE der beiden Ansichten (Fahrwerk eingefahren). Sie lässt sich sauber
    # abtrennen: Über ihr steht nichts, und nach unten begrenzt sie das Fenster, dessen Höhe aus
    # den echten Maßen kommt (Höhe/Länge mal gezeichnete Länge). Was von der unteren Ansicht in
    # das Fenster ragt, hängt nicht mit ihr zusammen und fällt als kleinere Form heraus.
    xs_all = np.where(m.any(axis=0))[0]
    len_px = int(xs_all[-1] - xs_all[0] + 1)
    top = int(np.where(m.any(axis=1))[0][0])
    win = np.zeros_like(m)
    end = min(m.shape[0], top + int(round(len_px * ratio * win_f)))
    win[top:end] = m[top:end]
    lab, n = ndi.label(win)
    shape = win
    if n > 1:
        sizes = ndi.sum(win, lab, range(1, n + 1))
        shape = lab == (int(np.argmax(sizes)) + 1)
    # Manche Vorlagen setzen die Ansichten so dicht, dass sich die Winglets berühren. Dann hängt
    # ein Stück der unteren Ansicht als Geisterflügel am Leitwerk. Kurz schrumpfen trennt die
    # dünne Stelle; bleibt dabei fast alles erhalten, war es wirklich nur der Geisterflügel.
    for it in (2, 3, 4, 6):
        thin = ndi.binary_erosion(shape, iterations=it)
        lab2, n2 = ndi.label(thin)
        if n2 < 2:
            continue
        sizes = ndi.sum(thin, lab2, range(1, n2 + 1))
        keep = ndi.binary_dilation(lab2 == (int(np.argmax(sizes)) + 1), iterations=it + 1) & shape
        ys_k = np.where(keep.any(axis=1))[0]
        tall = len(ys_k) and (ys_k[-1] - ys_k[0]) >= len_px * ratio * 0.78   # Leitwerk noch dran?
        if tall and int(keep.sum()) > int(shape.sum()) * 0.72:
            shape = keep
            break

    band = ndi.binary_fill_holes(shape)

    xs = np.where(band.any(axis=0))[0]
    ys = np.where(band.any(axis=1))[0]
    x0, x1 = int(xs[0]), int(xs[-1]) + 1
    yy0, yy1 = int(ys[0]), int(ys[-1]) + 1

    out = np.dstack([rgb[yy0:yy1, x0:x1].astype(np.uint8),
                     (band[yy0:yy1, x0:x1] * 255).astype(np.uint8)])
    img = Image.fromarray(out, "RGBA")
    if img.width > MAX_W:
        img = img.resize((MAX_W, max(1, round(img.height * MAX_W / img.width))), Image.LANCZOS)
    return img


def main():
    src, dst, jsout = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(dst, exist_ok=True)
    sizes = {}
    for f in sorted(os.listdir(src)):
        key = os.path.splitext(f)[0]
        tid = NAMES.get(key) or NORM.get(norm(key))
        if not tid:
            print("übersprungen:", f)
            continue
        try:
            img = crop(os.path.join(src, f), DIMS[tid], WINDOW)
            img.save(os.path.join(dst, tid + ".png"), optimize=True)
            sizes[tid] = [img.width, img.height]
            print("ok", tid, f"{img.width}×{img.height}")
        except Exception as e:
            print("FEHLER", tid, e)
    head = ("// Seitenrisse für den Fotomodus (GAME.art in core/config.js).\n"
            "// Erzeugt von tools/crop_sideviews.py – Bildgröße in Pixeln, damit die UI den Maßstab kennt.\n"
            "// Typen ohne Eintrag werden weiter gezeichnet (js/art/render.js).\n\n"
            "export const PHOTOS = ")
    with open(jsout, "w") as fh:
        fh.write(head + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n")
    print(len(sizes), "Bilder →", dst)


if __name__ == "__main__":
    main()
