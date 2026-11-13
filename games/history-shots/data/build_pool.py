#!/usr/bin/env python3
"""
Bilderpool für History Shots aus Wikimedia Commons zusammenstellen.

Es werden nur Verweise gespeichert (Dateiname, Jahr, Koordinaten, Urheber, Lizenz),
keine Bilder kopiert. Die Seite lädt die Bilder beim Spielen direkt von Commons.

Aufnahme nur, wenn alle Kriterien stimmen:
  - Aufnahmedatum mit eindeutigem Jahr (kein "circa", keine Zeitspanne)
  - Aufnahmeort als Koordinaten vorhanden
  - freie Lizenz (Public Domain, CC0, CC BY, CC BY-SA)
  - echtes Foto (JPEG/PNG), mindestens 700 px breit
  - Jahr passt zur Kategorie, wenn der Kategoriename ein Jahr oder Jahrzehnt enthält

Aufruf:  python3 build_pool.py [--max-per-theme 120] [--out photos.json]
"""
import json, re, sys, time, urllib.parse, urllib.request, argparse, hashlib, collections

API = "https://commons.wikimedia.org/w/api.php"
NOMI = "https://nominatim.openstreetmap.org/reverse"
UA = "SoyAndSoul-HistoryShots/1.0 (https://soyandsoul.github.io/Soy-Soul/; pool builder)"

DECADES = [1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000]
YEARS = list(range(1895, 2011))
CITIES = ["Berlin", "Frankfurt am Main", "Hamburg", "Munich", "Cologne", "Vienna", "Paris", "London", "Amsterdam", "Copenhagen",
          "Barcelona", "Rome", "Prague", "Zurich", "Stockholm", "Lisbon", "Madrid", "Brussels", "Warsaw", "Budapest",
          "New York City", "Chicago", "San Francisco", "Los Angeles", "Tokyo", "Sydney", "Istanbul", "Moscow", "Athens", "Dublin",
          "Dresden", "Leipzig", "Stuttgart", "Düsseldorf", "Hanover", "Nuremberg", "Bremen", "Milan", "Venice", "Florence"]

# Kategorie-Muster je Thema. {d} = Jahrzehnt (1960), {y} = Jahr, {c} = Stadt
THEMES = {
    "cities": ["{c} in the {d}s", "{d}s photographs of {c}", "{d}s in {c}", "Street scenes in {c} in the {d}s", "Historical images of {c}"],
    "aviation": ["{y} in aviation", "Aviation in {y}", "Airports in the {d}s", "Aircraft in the {d}s", "Frankfurt Airport in the {d}s",
                 "Berlin Tempelhof Airport in the {d}s", "Heathrow Airport in the {d}s", "Lufthansa in the {d}s", "Pan Am in the {d}s",
                 "Airliners in the {d}s", "Airports in {y}", "Aircraft photographed in {y}"],
    "cars": ["Cars photographed in {y}", "Automobiles in the {d}s", "Cars in the {d}s", "Automobiles photographed in {y}",
             "Traffic in the {d}s", "Street scenes in the {d}s", "Petrol stations in the {d}s", "Road transport in {y}", "{y} in road transport"],
    "pop": ["{y} in music", "Concerts in {y}", "Music festivals in {y}", "Cinemas in the {d}s", "Record shops in the {d}s",
            "Fashion in the {d}s", "Discotheques in the {d}s", "Television in the {d}s", "Youth culture in the {d}s", "Music in the {d}s"],
    "food": ["Restaurants in the {d}s", "Cafés in the {d}s", "Markets in the {d}s", "Food in the {d}s", "Bakeries in the {d}s",
             "Street food in the {d}s", "Pubs in the {d}s", "Beer gardens in the {d}s", "Kitchens in the {d}s", "Ice cream in the {d}s",
             "Food in {y}", "Restaurants in {y}", "Markets in {y}"],
    "sport": ["{y} in sports", "Football in {y}", "{y} in football", "Stadiums in the {d}s", "Olympic Games in {y}",
              "Cycling in {y}", "Motorsport in {y}", "Sport in {y}"],
    "rail": ["Rail transport in {y}", "{y} in rail transport", "Railway stations in the {d}s", "Trams in the {d}s", "Trains in the {d}s",
             "Locomotives photographed in {y}", "Trams in {y}", "Public transport in the {d}s"],
    "everyday": ["Everyday life in the {d}s", "Street scenes in the {d}s", "Children in the {d}s", "People in the {d}s",
                 "Shops in the {d}s", "Beaches in the {d}s", "Families in the {d}s", "Schools in the {d}s", "{y} in Germany", "{y} in Austria",
                 "{y} in Europe", "Daily life in {y}"],
}
OK_LIC = re.compile(r"^(Public domain|PD|CC0|CC BY(-SA)?( \d\.\d)?( [a-z]{2})?|CC-BY(-SA)?.*|No restrictions)", re.I)
BAD_TITLE = re.compile(r"(map|karte|plan|postcard|poster|drawing|painting|gemälde|zeichnung|stamp|briefmarke|logo|diagram|chart|scan of|newspaper|magazine|cover|advert)", re.I)

opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", UA)]

def get(url, params=None, retries=4):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    for i in range(retries):
        try:
            with opener.open(url, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == retries - 1:
                print("  ! fehlgeschlagen:", url[:120], e, file=sys.stderr)
                return None
            time.sleep(2 + 3 * i)

def api(**p):
    p.update(action="query", format="json", formatversion="2")
    return get(API, p)

def cat_exists(name):
    r = api(titles="Category:" + name, prop="categoryinfo")
    pages = (r or {}).get("query", {}).get("pages", [])
    return pages and not pages[0].get("missing") and pages[0].get("categoryinfo", {}).get("files", 0) + pages[0].get("categoryinfo", {}).get("subcats", 0) > 0

def members(cat, kind):
    out, cont = [], {}
    while True:
        r = api(list="categorymembers", cmtitle="Category:" + cat, cmtype=kind, cmlimit="200", **cont)
        if not r: break
        out += [m["title"] for m in r["query"]["categorymembers"]]
        if "continue" in r and len(out) < 600: cont = r["continue"]
        else: break
    return out

def year_of_cat(name):
    m = re.search(r"\b(1[89]\d\d|20[0-2]\d)\b", name)
    if m:
        y = int(m.group(1))
        return (y, y + 9) if re.search(r"\b" + str(y) + r"s\b", name) else (y, y)
    return None

def parse_year(s):
    if not s: return None
    s = re.sub(r"<[^>]+>", " ", s)
    if re.search(r"(circa|ca\.|c\.|approx|vor |nach |before|after|between|zwischen|\d{4}\s*[-–/]\s*\d{4}|\d{4}s|unknown|unbekannt|\?)", s, re.I):
        return None
    m = re.match(r"\s*(1[89]\d\d|20[0-2]\d)(?:[-:/ .]|$)", s)
    return int(m.group(1)) if m else None

def info(titles):
    """Metadaten für bis zu 50 Dateien."""
    r = api(titles="|".join(titles), prop="imageinfo|coordinates|categories", iiprop="url|size|mime|extmetadata",
            iiextmetadatafilter="DateTimeOriginal|LicenseShortName|Artist|Credit|ImageDescription|LicenseUrl|ObjectName",
            coprop="type|primary", colimit="max", cllimit="50")
    return (r or {}).get("query", {}).get("pages", [])

geo_cache = {}
def place_of(lat, lon, lang="de"):
    key = (round(lat, 2), round(lon, 2), lang)
    if key in geo_cache: return geo_cache[key]
    time.sleep(1.05)
    r = get(NOMI, {"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 10, "accept-language": lang})
    a = (r or {}).get("address", {})
    city = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or a.get("county") or a.get("state") or ""
    country = a.get("country", "")
    p = ", ".join(x for x in [city, country] if x) or None
    geo_cache[key] = p
    return p

def clean(s, n=120):
    s = re.sub(r"<[^>]+>", "", s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s[:n]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-per-theme", type=int, default=120)
    ap.add_argument("--out", default="photos.json")
    ap.add_argument("--themes", default=",".join(THEMES))
    args = ap.parse_args()

    try:
        old = json.load(open(args.out))
        pool = {p["file"]: p for p in old.get("photos", [])}
        print("bestehend:", len(pool))
    except Exception:
        pool = {}

    cand = collections.OrderedDict()   # file -> set(themes), cat-range
    for theme in args.themes.split(","):
        pats = THEMES[theme]
        cats = []
        for pat in pats:
            names = set()
            if "{c}" in pat:
                for c in CITIES:
                    for d in DECADES: names.add(pat.format(c=c, d=d))
                    if "{d}" not in pat: names.add(pat.format(c=c))
            elif "{d}" in pat:
                for d in DECADES: names.add(pat.format(d=d))
            elif "{y}" in pat:
                for y in YEARS: names.add(pat.format(y=y))
            else:
                names.add(pat)
            for n in sorted(names):
                if cat_exists(n): cats.append(n)
        print(f"[{theme}] {len(cats)} Kategorien gefunden")
        n0 = len(cand)
        for cat in cats:
            rng = year_of_cat(cat)
            files = members(cat, "file")
            # eine Ebene Unterkategorien, nur wenn sie zum Jahr passen
            for sub in members(cat, "subcat")[:40]:
                sub = sub.replace("Category:", "")
                sr = year_of_cat(sub)
                if rng and sr and (sr[1] < rng[0] or sr[0] > rng[1]): continue
                files += members(sub, "file")[:150]
            for f in files:
                if not re.search(r"\.(jpe?g|png)$", f, re.I) or BAD_TITLE.search(f): continue
                e = cand.setdefault(f, {"themes": set(), "rng": None})
                e["themes"].add(theme)
                if rng: e["rng"] = rng if not e["rng"] else (max(rng[0], e["rng"][0]), min(rng[1], e["rng"][1]))
            if len(cand) - n0 > args.max_per_theme * 25: break
        print(f"[{theme}] Kandidaten: {len(cand) - n0}")

    titles = [f for f in cand if f not in pool]
    print("prüfe Metadaten für", len(titles), "Dateien …")
    kept = 0
    for i in range(0, len(titles), 50):
        for pg in info(titles[i:i + 50]):
            f = pg.get("title")
            ii = (pg.get("imageinfo") or [{}])[0]
            md = {k: v.get("value") for k, v in (ii.get("extmetadata") or {}).items()}
            year = parse_year(md.get("DateTimeOriginal"))
            if not year: continue
            rng = cand[f]["rng"]
            if rng and not (rng[0] <= year <= rng[1]): continue
            co = [c for c in pg.get("coordinates", []) if c.get("primary") or c.get("type") in (None, "camera")]
            if not co: continue
            lic = md.get("LicenseShortName", "")
            if not OK_LIC.match(lic): continue
            if ii.get("mime") not in ("image/jpeg", "image/png") or (ii.get("width") or 0) < 700: continue
            cats = " ".join(c["title"] for c in pg.get("categories", []))
            if BAD_TITLE.search(cats) and not re.search(r"photograph", cats, re.I): continue
            lat, lon = co[0]["lat"], co[0]["lon"]
            if abs(lat) < .01 and abs(lon) < .01: continue
            pool[f] = {
                "id": hashlib.md5(f.encode()).hexdigest()[:10], "file": f, "year": year, "lat": round(lat, 5), "lon": round(lon, 5),
                "cat": sorted(cand[f]["themes"]), "title": {"de": clean(md.get("ObjectName") or md.get("ImageDescription") or f[5:-4], 90), "en": clean(md.get("ObjectName") or md.get("ImageDescription") or f[5:-4], 90)},
                "place": None, "author": clean(md.get("Artist") or md.get("Credit") or "", 60) or "unbekannt",
                "license": clean(lic, 30), "w": ii.get("width"), "h": ii.get("height")
            }
            kept += 1
        print(f"  {min(i + 50, len(titles))}/{len(titles)} geprüft, {kept} aufgenommen", end="\r")
    print()

    # Orte nachschlagen
    need = [p for p in pool.values() if not p.get("place")]
    print("Orte für", len(need), "Fotos nachschlagen (Nominatim, 1/s) …")
    for k, p in enumerate(need):
        p["place"] = place_of(p["lat"], p["lon"]) or f"{p['lat']:.2f}, {p['lon']:.2f}"
        if k % 25 == 0: print(f"  {k}/{len(need)}", end="\r")
    print()

    # Je Thema begrenzen, Mischung über Jahrzehnte
    photos = list(pool.values())
    by_theme = collections.Counter()
    out = []
    for p in sorted(photos, key=lambda p: (len(p["cat"]), hash(p["file"]))):
        if any(by_theme[c] < args.max_per_theme for c in p["cat"]):
            out.append(p)
            for c in p["cat"]: by_theme[c] += 1
    out.sort(key=lambda p: p["id"])
    json.dump({"updated": time.strftime("%Y-%m-%d"), "note": "Verweise auf Wikimedia Commons, erzeugt mit build_pool.py", "photos": out},
              open(args.out, "w"), ensure_ascii=False, indent=0)
    print("fertig:", len(out), "Fotos ·", dict(by_theme))

if __name__ == "__main__":
    main()
