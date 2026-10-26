"""Singapore as a halftone pearl: assets/img/sg-pearl.svg (slide 26).

    python tools/gen_sg_pearl.py assets/img/sg-pearl.svg

Reads tools/sg-coast.json (island polygons, lon/lat; see its "source" field) and lays halftone dots
over the islands in concentric rings that radiate from Orchard, where Andrew's machines are. Dots
are largest and fullest red at that core (the heart), then darken, fade and shrink toward the coast
so the shape keeps a soft edge. A faint coastline sits behind the dots.
Prints the pixel position of the named places so the marker overlay in index.html can be placed in
the same coordinate space (the asset is drawn 1:1 inside that overlay). --no-outline drops the stroke;
--teal uses the deck's line color instead of the flag red.
"""
import json, math, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
COAST = HERE / "sg-coast.json"
HEART = (239, 51, 64)     # Singapore flag red (Pantone 032 C); the slide's one deliberate non-problem red
DARK = (112, 22, 30)      # the same red in shadow, for the coast
TEAL = (54, 217, 187)     # --raw-mono-1, for --teal
WHITE = (254, 240, 250)   # --fg

# projection: equirectangular on the island bbox, VIEW_W px wide (slide units, drawn 1:1)
VIEW_W = 820
LON0, LON1 = 103.600, 104.100
LAT0, LAT1 = 1.200, 1.470
COS = math.cos(math.radians(1.33))
SCALE = VIEW_W / ((LON1 - LON0) * COS)
VIEW_H = int(round((LAT1 - LAT0) * SCALE))

def proj(lon, lat):
    return (lon - LON0) * COS * SCALE, (LAT1 - lat) * SCALE

PLACES = {
    "Orchard (my machines)": (103.8398, 1.3006),   # by Orchard Central
    "Woodlands (GlobalFoundries)": (103.787, 1.445),
    "Serangoon North (Kulicke & Soffa)": (103.871, 1.374),
    "Kallang (Infineon)": (103.868, 1.323),
    "Pasir Ris (UMC)": (103.955, 1.376),          # Pasir Ris Wafer Fab Park
    "Marina Bay": (103.860, 1.284),
    "Changi Airport": (103.990, 1.357),
    "Botanic Gardens": (103.816, 1.315),
}
CORE = "Orchard (my machines)"   # rings and luster radiate from here

# ---------------------------------------------------------------- geometry
def simplify(ring, tol):
    """Douglas-Peucker on a closed ring (pixel coords)."""
    def dp(pts):
        if len(pts) < 3: return pts
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1e-9
        imax, dmax = 0, -1
        for i in range(1, len(pts) - 1):
            x, y = pts[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L
            if d > dmax: imax, dmax = i, d
        if dmax > tol:
            return dp(pts[:imax + 1])[:-1] + dp(pts[imax:])
        return [pts[0], pts[-1]]
    half = len(ring) // 2
    a = dp(ring[:half + 1]); b = dp(ring[half:] + ring[:1])
    return a[:-1] + b[:-1]

def inside(x, y, ring):
    n = len(ring); c = False
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi: c = not c
    return c

def seg_dist(x, y, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L2))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))

def coast_dist(x, y, rings):
    best = 1e9
    for ring in rings:
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % n]
            if abs(x1 - x) > best + 60 and abs(x2 - x) > best + 60: continue
            d = seg_dist(x, y, x1, y1, x2, y2)
            if d < best: best = d
    return best

def mix(a, b, t):
    return "#%02x%02x%02x" % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# ---------------------------------------------------------------- halftone
def main(out_path, outline=True, base=HEART, dark=DARK):
    data = json.loads(COAST.read_text(encoding="utf-8"))
    rings = [simplify([proj(lon, lat) for lon, lat in r], 1.0) for r in data["rings"]]
    rings = [r for r in rings if len(r) >= 4]
    main_ring = max(rings, key=len)

    S = 10.5                  # ring spacing and dot pitch along a ring
    RMAX = 4.5                # largest dot
    EDGE = 9.0                # px over which dots shrink to nothing at the coast
    cx, cy = proj(*PLACES[CORE])
    R = 0.62 * VIEW_W         # luster radius

    dots = []
    k = 0
    while k * S <= 1.3 * VIEW_W:
        r = k * S
        n = 1 if r == 0 else max(6, round(2 * math.pi * r / S))
        for j in range(n):
            a = 2 * math.pi * j / n + (k % 2) * math.pi / n
            x, y = cx + r * math.cos(a), cy + r * math.sin(a)
            if not (0 <= x <= VIEW_W and 0 <= y <= VIEW_H): continue
            hit = None
            for ring in rings:
                if inside(x, y, ring): hit = ring; break
            if hit is None: continue
            d = coast_dist(x, y, rings)
            fade = min(1.0, d / EDGE) ** 0.8
            L = max(0.0, 1.0 - r / R)
            rad = RMAX * (0.3 + 0.7 * L ** 1.1) * fade
            if hit is not main_ring: rad *= 0.85
            if rad > 0.35:
                dots.append((x, y, rad, 0.34 + 0.5 * L, mix(dark, base, 0.74 * L ** 0.8)))   # core kept a little under full red
        k += 1

    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VIEW_W} {VIEW_H}" width="{VIEW_W}" height="{VIEW_H}">',
             f'<!-- Singapore, halftone, rings from Orchard. Coastline: {data.get("source", "")}. Generated by tools/gen_sg_pearl.py -->']
    if outline:   # a calm coastline, simplified harder than the dots so the jetties at Tuas don't buzz
        for ring in [simplify(r, 2.2) for r in rings]:
            d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in ring) + " Z"
            parts.append(f'<path d="{d}" fill="none" stroke="{mix(base, base, 0)}" stroke-width="1" stroke-linejoin="round" opacity="0.26"/>')
    for x, y, rad, op, col in dots:
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad:.2f}" fill="{col}" opacity="{op:.2f}"/>')
    parts.append('</svg>')
    pathlib.Path(out_path).write_text("\n".join(parts), encoding="utf-8")
    print(f"{out_path}: {len(dots)} dots, viewBox 0 0 {VIEW_W} {VIEW_H}, {len(rings)} islands")
    for name, (lon, lat) in PLACES.items():
        x, y = proj(lon, lat)
        print(f"  {name:36s} x={x:7.1f} y={y:7.1f}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else str(HERE.parent / "assets/img/sg-pearl.svg")
    teal = "--teal" in sys.argv
    main(out, outline="--no-outline" not in sys.argv, base=TEAL if teal else HEART, dark=(14, 60, 52) if teal else DARK)
