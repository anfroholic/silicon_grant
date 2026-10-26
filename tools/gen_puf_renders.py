# Render the MEME PUF figures for the deck straight from the signoff GDS.
#   uv run --no-project --with klayout --with pillow python tools/gen_puf_renders.py <chip_top.gds.gz> assets/img
# GDS: eurosynth repo, branch `meme`, final_meme/gds/chip_top.gds.gz
#   git -C ../eurosynth show meme:final_meme/gds/chip_top.gds.gz > chip_top.gds.gz
# Outputs:
#   puf-medallion.png  one dogecoin medallion (all metal art, dimmed) with its hidden cluster
#   puf-cluster.svg    the 8-divider cluster itself, line art (poly + M1..M3)
import sys, klayout.db as db
from PIL import Image, ImageDraw

gds, out = sys.argv[1], sys.argv[2]
TEAL = (0x36, 0xd9, 0xbb)
INK = (0x0a, 0x11, 0x0f)
POLY, M1, M2, M3 = (30, 0), (34, 0), (36, 0), (42, 0)
ART = [(34, 0), (36, 0), (42, 0), (46, 0), (81, 0)]          # M1..M5

ly = db.Layout(); ly.read(gds)
top = ly.top_cell()
clus = next(i for i in top.each_inst() if i.cell.name == "meme_puf_cluster" and i.dbbox().left < 700)  # west R1
cb = clus.dbbox()
print("cluster R1", cb)

def polys(cell, layer, box=None):
    li = ly.find_layer(*layer)
    if li is None: return []
    r = db.Region(cell.begin_shapes_rec(li))
    if box: r &= db.Region(box.to_itype(ly.dbu))
    return [p.to_dtype(ly.dbu) for p in r.merged().each()]

# ---- 1. medallion: 280 x 200 um around the R1 cluster, all metal layers stacked
cx, cy = cb.center().x, cb.center().y + 20
W, H, PX = 280, 200, 8
win = db.DBox(cx - W/2, cy - H/2, cx + W/2, cy + H/2)
img = Image.new("RGB", (W*PX, H*PX), INK)
over = Image.new("RGBA", img.size, (0, 0, 0, 0))
for k, layer in enumerate(ART):
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for p in polys(top, layer, win):
        pts = [((q.x - win.left)*PX, (win.top - q.y)*PX) for q in p.each_point_hull()]
        d.polygon(pts, fill=TEAL + (14 + 6*k,))
    over = Image.alpha_composite(over, lay)
# the PUF itself: poly resistors + its own routing, full strength
lay = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
for layer, a in ((M3, 150), (M2, 150), (M1, 190), (POLY, 255)):
    for p in polys(clus.cell, layer):
        pts = [((q.x + cb.left - win.left)*PX, (win.top - (q.y + cb.bottom))*PX) for q in p.each_point_hull()]
        d.polygon(pts, fill=TEAL + (a,))
over = Image.alpha_composite(over, lay)
img = Image.alpha_composite(img.convert("RGBA"), over)
d = ImageDraw.Draw(img)
x0, y0 = (cb.left - win.left)*PX, (win.top - cb.top)*PX
d.rectangle([x0 - 8, y0 - 8, x0 + cb.width()*PX + 8, y0 + cb.height()*PX + 8], outline=(0xfe, 0xf0, 0xfa), width=4)
img.convert("RGB").save(f"{out}/puf-medallion.png", optimize=True)
print("medallion window", win)

# ---- 2. the cluster: 80.6 x 44.9 um, 8 dividers. Poly filled, metal as outlines.
SC = 12                                   # px per um
cw, ch = clus.cell.dbbox().width(), clus.cell.dbbox().height()
Wp, Hp = cw*SC, ch*SC
def path(p):
    return "M" + " L".join(f"{q.x*SC:.1f} {(ch - q.y)*SC:.1f}" for q in p.each_point_hull()) + " Z"
s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -60 {Wp+190:.0f} {Hp+150:.0f}">',
     f'<rect x="0" y="0" width="{Wp:.1f}" height="{Hp:.1f}" fill="none" stroke="#2d4d45" stroke-width="2" stroke-dasharray="6 6"/>']
style = {M3: 'fill="none" stroke="#36d9bb" stroke-opacity="0.35" stroke-width="1.5"',
         M2: 'fill="#36d9bb" fill-opacity="0.08" stroke="#36d9bb" stroke-opacity="0.5" stroke-width="1.5"',
         M1: 'fill="none" stroke="#36d9bb" stroke-opacity="0.75" stroke-width="1.5"',
         POLY: 'fill="#36d9bb" fill-opacity="0.85" stroke="none"'}
for layer in (M3, M2, M1, POLY):
    s.append(f'<path {style[layer]} d="' + " ".join(path(p) for p in polys(clus.cell, layer)) + '"/>')
# labels (rail positions from ip/meme_puf/script/gen_cluster.py: HI y12.3..16.3, LO y17.3..21.3)
T = 'font-family="IBM Plex Mono, monospace" font-size="22" letter-spacing="1.5"'
for name, y0, y1 in (("HI", 12.3, 16.3), ("LO", 17.3, 21.3)):
    ym = (ch - (y0 + y1)/2)*SC
    s.append(f'<text {T} x="{Wp+18:.0f}" y="{ym+8:.0f}" fill="#fef0fa">{name} RAIL</text>')
s.append(f'<text {T} x="0" y="-24" fill="#a7b5b1">8 TAPS + RAILS → PADS (WEST EDGE)</text>')
s.append(f'<text {T} x="{Wp:.0f}" y="{Hp+48:.0f}" text-anchor="end" fill="#a7b5b1">POLY RESISTORS · 0.8 × 8 µm · ~3.5 kΩ</text>')
# 10 um scale bar
y = Hp + 40
s.append(f'<path d="M0 {y:.0f} H{10*SC} M0 {y-8:.0f} V{y+8:.0f} M{10*SC} {y-8:.0f} V{y+8:.0f}" stroke="#fef0fa" stroke-width="2" fill="none"/>')
s.append(f'<text {T} x="{10*SC + 16}" y="{y+7:.0f}" fill="#a7b5b1">10 µm</text>')
s.append("</svg>")
open(f"{out}/puf-cluster.svg", "w", encoding="utf-8").write("\n".join(s))
print("cluster", cw, "x", ch, "um")
