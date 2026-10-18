"""Original, deterministic pixel art for Crônicas de Ferro.

Run with Python 3 + Pillow. Every asset is authored here; no downloaded images,
fonts, sprite sheets, or third-party art are used. No smoothing is applied.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math
import random

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "items").mkdir(exist_ok=True)
INK = "#20312e"
SHADOW = (20, 37, 29, 70)
WOOD = ["#443b30", "#63503a", "#92704a", "#b08b58", "#d2ac70"]
STONE = ["#374542", "#59645a", "#7b8272", "#a4ab91", "#c5c7a8"]
LEAF = ["#203d30", "#2f5538", "#477442", "#67944b", "#8cb559", "#b4cb77"]
TEAL = ["#173f41", "#265c5d", "#398381", "#66ada0", "#a3d0af"]
IRON = ["#35454a", "#5c7174", "#90a7a5", "#c1d2c5", "#f0e8cb"]
GOLD = ["#72512d", "#a57534", "#d3a34e", "#edd182", "#fff0ac"]


def canvas(w, h):
    im = Image.new("RGBA", (w, h))
    return im, ImageDraw.Draw(im)


def save(im, name):
    im.save(OUT / (name + ".png"))
    return im


def poly(d, points, fill, outline=INK, width=1):
    d.polygon(points, fill=fill)
    if outline:
        d.line(points + [points[0]], fill=outline, width=width)


def rect(d, box, fill, outline=None, width=1):
    d.rectangle(box, fill=fill, outline=outline, width=width)


def ellipse(d, box, fill, outline=None, width=1):
    d.ellipse(box, fill=fill, outline=outline, width=width)


def shadow(d, x, y, rx, ry):
    ellipse(d, (x-rx, y-ry, x+rx, y+ry), SHADOW)


def speckle(d, area, colors, count, seed, test=None):
    r = random.Random(seed)
    for _ in range(count):
        x, y = r.randrange(area[0], area[2]+1), r.randrange(area[1], area[3]+1)
        if test and not test(x, y):
            continue
        color = r.choice(colors)
        d.point((x,y), fill=color)
        if r.random() < .35:
            d.point((x+1,y), fill=color)


def terrain():
    atlas, ad = canvas(320, 32)
    bases = ["#587b47", "#537443", "#b7955c", "#998d6b", "#3e8e93", "#b4a877", "#35563a", "#535753", "#64685c", "#745437"]
    palettes = [
        ["#5d814b", "#62874e", "#50733f", "#759451"],
        ["#597a45", "#61814b", "#4c6c3f", "#6b8a4b"],
        ["#be9d66", "#ac8a52", "#ceb079", "#a7834c"],
        ["#a29572", "#8d8466", "#bab18b", "#837c61"],
        ["#4a999d", "#32838b", "#64aaaa", "#71b5ac"],
        ["#c2b684", "#a79e71", "#cdc18e", "#9e976b"],
        ["#3b6040", "#304d34", "#456947", "#52774a"],
        ["#5d625a", "#474d49", "#696c61", "#74766a"],
        ["#707565", "#5a6054", "#7c806c", "#535d51"],
        ["#8d6540", "#62472f", "#a17a4b", "#533e2c"],
    ]
    for i, base in enumerate(bases):
        im, d = canvas(32,32)
        rect(d,(0,0,31,31),base)
        speckle(d,(0,0,31,31),palettes[i],75,100+i)
        r = random.Random(i+2)
        if i in (0,1,6):
            for _ in range(10):
                x,y=r.randrange(32),r.randrange(32)
                d.line([(x-1,y),(x,y+2),(x+1,y-1)], fill=palettes[i][r.randrange(4)])
        if i in (2,5):
            for _ in range(8):
                x,y=r.randrange(30),r.randrange(30)
                rect(d,(x,y,x+1,y+1),palettes[i][r.randrange(4)])
        if i in (3,8):
            for y in range(-5,32,9):
                offset = 7 if (y//9)%2 else 0
                d.line((0,y,31,y),fill=palettes[i][1])
                d.line((0,y+1,31,y+1),fill=palettes[i][2])
                for x in range(offset,32,13):
                    d.line((x,y,x+2,y+8),fill=palettes[i][1])
        if i == 4:
            for x,y,w in [(2,5,8),(19,14,9),(7,25,12)]:
                d.line((x,y,x+w,y),fill="#68b1b0")
                d.line((x+2,y+1,x+w-2,y+1),fill="#58a1a5")
        if i == 9:
            for y in range(2,32,8):
                d.line((0,y,31,y),fill="#463b2b",width=2)
                d.line((0,y+2,31,y+2),fill="#a67d4c")
        atlas.alpha_composite(im,(i*32,0))
    save(atlas,"terrain")


def terrain_edges():
    """32px overlays; frame index is outside-neighbor mask N1/E2/S4/W8."""
    for name,water in [("path_edges",False),("shore_edges",False),("water_edges",True)]:
        atlas,_=canvas(512,32)
        for mask in range(16):
            im,d=canvas(32,32)
            # Pixel-perfect periodic profile: identical across neighboring tiles.
            profile=[3,3,2,2,3,4,4,3,3,2,2,3,3,3,2,2,3,4,3,3,2,2,3,3,4,4,3,3,2,2,3,3]
            for y in range(32):
                for x in range(32):
                    near=[]
                    if mask&1:near.append((y,profile[x]))
                    if mask&2:near.append((31-x,profile[y]))
                    if mask&4:near.append((31-y,profile[31-x]))
                    if mask&8:near.append((x,profile[31-y]))
                    if not near:continue
                    dist,thick=min(near,key=lambda p:p[0]-p[1])
                    r=random.Random(x*91+y*23+int(water)*7)
                    # Round the convex corners of paths, breaking visible stair-steps.
                    cutcorner=False
                    for a,b,cx,cy,sx,sy in [(1,2,20,11,1,-1),(2,4,20,20,1,1),(4,8,11,20,-1,1),(8,1,11,11,-1,-1)]:
                        if mask&a and mask&b and (x-cx)*sx>0 and (y-cy)*sy>0:
                            if (x-cx)**2+(y-cy)**2>99:
                                cutcorner=True
                    if dist<thick or cutcorner:
                        if water:
                            col=r.choice(["#b4a877","#b4a877","#c2b684","#a79e71"])
                        else:
                            col=r.choice(["#587b47","#587b47","#5d814b","#50733f"])
                        d.point((x,y),fill=col)
                    elif dist==thick:
                        d.point((x,y),fill="#6c7252" if water else "#738044")
                    elif dist==thick+1:
                        d.point((x,y),fill="#2f7379" if water else "#a58a50")
                    elif water and dist==thick+2 and r.random()<.7:
                        d.point((x,y),fill="#9dc8b8")
                    elif not water and dist==thick+2 and r.random()<.22:
                        d.point((x,y),fill="#6a8645")
            # A few grass blades cross the boundary instead of a continuous outline.
            if not water:
                for bit in [1,2,4,8]:
                    if not mask&bit:continue
                    for pos in [5,15,25]:
                        if bit==1:pts=[(pos,2),(pos+1,6),(pos+2,3)]
                        elif bit==2:pts=[(29,pos),(25,pos+1),(28,pos+2)]
                        elif bit==4:pts=[(pos,29),(pos-1,25),(pos-2,28)]
                        else:pts=[(2,pos),(6,pos-1),(3,pos-2)]
                        d.line(pts,fill="#688b4c")
            atlas.alpha_composite(im,(mask*32,0))
        save(atlas,name)


def leafy_lobe(d,cx,cy,rx,ry,palette,seed):
    r = random.Random(seed)
    points=[]
    for i in range(28):
        a=2*math.pi*i/28
        k=r.uniform(.86,1.03)
        points.append((round(cx+math.cos(a)*rx*k),round(cy+math.sin(a)*ry*k)))
    poly(d,points,palette[0])
    poly(d,[(x,y-2) for x,y in points],palette[2],palette[1])
    ellipse(d,(cx-rx+4,cy-ry+3,cx+rx-5,cy+ry-8),palette[3])
    # Small overlapping, hand-shaped leaf clusters give the crown pixel edges.
    for _ in range(int(rx*ry/20)):
        x=r.randint(cx-rx+4,cx+rx-4)
        y=r.randint(cy-ry+4,cy+ry-6)
        if ((x-cx)/rx)**2+((y-cy)/ry)**2>.75:
            continue
        col=palette[4] if y < cy and r.random()<.8 else palette[2]
        if r.random()<.22: col=palette[5]
        poly(d,[(x-3,y),(x-1,y-2),(x+2,y-2),(x+4,y),(x+2,y+2),(x-2,y+2)],col,None)
        d.point((x-2,y+2),fill=palette[3])


def tree(kind):
    w,h=(96,128) if kind=="oak" else (64,112)
    im,d=canvas(w,h)
    cx=w//2
    shadow(d,cx,h-9,w//3,8)
    if kind=="birch":
        poly(d,[(cx-7,h-9),(cx-4,50),(cx+3,49),(cx+5,h-13),(cx+10,h-8),(cx+4,h-7),(cx,h-12),(cx-2,h-7)],"#c2c2a0")
        d.line((cx-3,53,cx-4,h-12),fill="#eff0c5",width=3)
        for yy in [63,73,87,99]:
            d.line((cx-3,yy,cx+2,yy+1),fill="#596454",width=2)
        palette=["#3b4b31","#5d6d35","#859545","#a8b450","#c6cd6e","#e6df96"]
        for j,(x,y,rx,ry) in enumerate([(22,48,20,25),(44,43,18,23),(30,27,22,23)]):
            leafy_lobe(d,x,y,rx,ry,palette,30+j)
    elif kind=="pine":
        poly(d,[(cx-6,h-9),(cx-3,55),(cx+3,55),(cx+5,h-13),(cx+9,h-8)],WOOD[1])
        d.line((cx-2,61,cx-3,h-12),fill=WOOD[3],width=2)
        for j,(yy,ww) in enumerate([(78,28),(62,25),(46,20),(31,15)]):
            p=[(cx,yy-30),(cx+ww-4,yy-4),(cx+ww,yy+5),(cx+ww-7,yy+5),(cx+ww-4,yy+10),(cx+9,yy+8),(cx+2,yy+11),(cx-7,yy+9),(cx-ww,yy+8),(cx-ww+5,yy),(cx-ww+3,yy-3)]
            poly(d,p,LEAF[1])
            poly(d,[(cx-2,yy-25),(cx+ww-7,yy+1),(cx+11,yy-2),(cx+7,yy+3),(cx,yy),(cx-5,yy+3),(cx-ww+7,yy+3)],LEAF[2],None)
            d.line((cx-2,yy-23,cx-ww+8,yy-1),fill=LEAF[4],width=2)
            for k in range(14):
                x=random.Random(j*50+k).randint(cx-ww+9,cx+ww-9)
                y=random.Random(j*70+k).randint(yy-9,yy+3)
                d.line((x,y,x+2,y+2),fill=LEAF[3])
    else:
        poly(d,[(cx-11,119),(cx-7,76),(cx-19,63),(cx-14,58),(cx-2,73),(cx+3,43),(cx+9,43),(cx+7,81),(cx+18,69),(cx+21,74),(cx+9,91),(cx+11,116),(cx+18,120),(cx+9,122),(cx+1,117),(cx-3,123)],WOOD[1],WOOD[0])
        d.line([(cx-3,116),(cx-2,81),(cx+4,51)],fill=WOOD[3],width=3)
        d.line((cx+6,110,cx+4,92),fill=WOOD[0],width=2)
        d.line((cx-5,116,cx-9,121),fill=WOOD[3],width=2)
        for j,(x,y,rx,ry) in enumerate([(24,62,21,24),(65,62,25,23),(75,43,19,22),(26,35,22,23),(48,25,25,22),(47,51,30,27)]):
            leafy_lobe(d,x,y,rx,ry,LEAF,110+j)
    save(im,"tree_"+kind)


def rock(name, mineral=None):
    im,d=canvas(48,48 if mineral else 40)
    base=42 if mineral else 35
    shadow(d,24,base,21,5)
    p=[(3,base-8),(5,base-20),(14,base-29),(29,base-31),(41,base-22),(45,base-10),(39,base-2),(14,base)]
    poly(d,p,STONE[1])
    poly(d,[(5,base-20),(14,base-29),(29,base-31),(37,base-22),(25,base-13),(12,base-14)],STONE[2],None)
    poly(d,[(14,base-29),(29,base-31),(33,base-26),(21,base-22),(11,base-21)],STONE[3],None)
    poly(d,[(25,base-13),(37,base-22),(43,base-11),(36,base-6),(21,base-4)],STONE[0],None)
    d.line([(8,base-12),(14,base-15),(21,base-9),(20,base-4)],fill=STONE[0])
    d.line((12,base-29,19,base-29),fill=STONE[4])
    speckle(d,(9,base-23,36,base-6),[STONE[1],STONE[3]],25,73)
    if mineral:
        colors={"copper":["#6b4934","#b66b41","#e5a562"],"iron":["#354754","#7d9aa2","#c1d4c4"],"silver":["#66777e","#b4c6cb","#eff4e6"],"gold":["#866027","#dbab43","#ffe69a"]}[mineral]
        for x,y in [(12,base-21),(24,base-24),(31,base-13),(16,base-8)]:
            poly(d,[(x-4,y),(x-2,y-4),(x+3,y-3),(x+5,y+1),(x+1,y+4),(x-3,y+3)],colors[1],colors[0])
            d.line((x-2,y-2,x+2,y-2),fill=colors[2],width=2)
    save(im,name)


def crystal():
    im,d=canvas(48,48)
    shadow(d,24,42,18,5)
    for x,y,h in [(13,39,21),(32,42,23),(23,40,34)]:
        poly(d,[(x-7,y-3),(x-7,y-h+6),(x,y-h),(x+7,y-h+6),(x+6,y),(x,y+3)],"#4e587b","#2a374d")
        poly(d,[(x,y-h+1),(x+5,y-h+6),(x+4,y-1),(x,y+2)],"#8b98cb",None)
        poly(d,[(x-5,y-h+7),(x,y-h+2),(x,y-1),(x-5,y-4)],"#80bdd1",None)
        d.line((x,y-h+3,x,y-3),fill="#d4f2df")
    for x,y in [(7,14),(37,8),(39,26)]:
        d.line((x-2,y,x+2,y),fill="#d9f2de")
        d.line((x,y-2,x,y+2),fill="#d9f2de")
    save(im,"crystal")


def plant(name):
    im,d=canvas(24,24)
    shadow(d,12,21,8,3)
    if name=="mushroom":
        for x,y,s in [(15,20,1),(7,21,.7)]:
            rect(d,(x-2,y-8,x+2,y),"#e0c9a1",WOOD[1])
            ellipse(d,(x-7,y-14,x+7,y-5),"#713e38",WOOD[0])
            ellipse(d,(x-6,y-14,x+5,y-7),"#b7664a")
            rect(d,(x-3,y-12,x-1,y-11),"#edc391")
            d.point((x+3,y-9),fill="#e4ae77")
    elif name=="berry":
        for x,y,rx,ry in [(8,15,6,5),(16,13,6,7),(10,9,5,5)]:
            ellipse(d,(x-rx,y-ry,x+rx,y+ry),LEAF[1],LEAF[0])
            d.line((x-2,y-3,x+2,y-3),fill=LEAF[3],width=2)
        for x,y in [(6,13),(12,9),(16,14),(10,18),(18,8)]:
            ellipse(d,(x,y,x+3,y+3),"#b25b53", "#673c3f")
            d.point((x,y),fill="#e7aa86")
    else:
        for x,yy in [(6,20),(11,17),(16,20),(12,22)]:
            d.line([(12,23),(x,yy-9)],fill=LEAF[1],width=2)
            poly(d,[(x,yy-4),(x-5,yy-8),(x-5,yy-11),(x,yy-9),(x+1,yy-5),(x+5,yy-10),(x+6,yy-7)],LEAF[3],LEAF[1])
            if name=="flower":
                cy=yy-12
                for xx,yyy in [(x-2,cy),(x+2,cy),(x,cy-2),(x,cy+2)]:
                    rect(d,(xx-1,yyy-1,xx+1,yyy+1),"#dfb5aa")
                d.point((x,cy),fill="#f7de9d")
            if name=="fiber":
                d.line((x,yy-4,x+2,yy-15),fill="#afba77",width=2)
    save(im,name)


def wood_grain(d,box,seed=5):
    x0,y0,x1,y1=box
    r=random.Random(seed)
    for y in range(y0+2,y1,5):
        d.line((x0,y,x1,y),fill=WOOD[0])
        d.line((x0+1,y+1,x1-1,y+1),fill=WOOD[3])
        if x1-x0>9:
            x=r.randint(x0+3,x1-4)
            d.line((x,y+3,min(x+8,x1-1),y+3),fill=WOOD[1])


def chest(w=40,h=36):
    im,d=canvas(w,h)
    shadow(d,w//2,h-3,w//2-2,4)
    poly(d,[(3,15),(8,7),(30,7),(36,15),(36,30),(5,32)],WOOD[2],WOOD[0],2)
    rect(d,(7,17,33,29),WOOD[1])
    wood_grain(d,(7,18,33,29))
    poly(d,[(5,15),(9,9),(29,9),(34,15)],WOOD[3],WOOD[0])
    d.line((7,16,34,16),fill=WOOD[0],width=2)
    for x in [9,28]:
        rect(d,(x,9,x+3,30),IRON[1],IRON[0])
        d.line((x+1,10,x+1,29),fill=IRON[3])
        for y in [13,25]:d.point((x+2,y),fill=IRON[4])
    rect(d,(18,15,24,22),GOLD[2],GOLD[0])
    rect(d,(20,17,21,20),WOOD[0])
    return im


def bench(name):
    sizes={"workbench":(64,48),"forge":(80,64),"alchemy":(64,56),"carpentry":(80,48)}
    w,h=sizes[name]
    im,d=canvas(w,h)
    shadow(d,w//2,h-5,w//2-3,5)
    for x in [8,w-16]:
        poly(d,[(x,24),(x+8,24),(x+7,h-5),(x-2,h-3)],WOOD[1],WOOD[0])
        d.line((x+1,26,x,h-6),fill=WOOD[3],width=2)
    poly(d,[(3,20),(12,12),(w-9,12),(w-3,21),(w-3,28),(3,28)],WOOD[2],WOOD[0],2)
    wood_grain(d,(5,20,w-5,25))
    d.line((11,14,w-10,14),fill=WOOD[4],width=2)
    d.line((5,21,w-5,21),fill=WOOD[4])
    if name=="workbench":
        d.line((15,9,29,19),fill=WOOD[0],width=5)
        d.line((15,9,29,19),fill=WOOD[3],width=2)
        poly(d,[(10,4),(15,2),(22,8),(19,13),(15,13)],IRON[2],IRON[0])
        rect(d,(35,13,51,17),WOOD[0])
        d.line((36,13,49,13),fill=WOOD[4],width=2)
        rect(d,(39,8,43,16),IRON[1],INK)
        d.line((43,7,53,7),fill=IRON[2],width=3)
    elif name=="forge":
        poly(d,[(22,24),(17,17),(17,12),(58,12),(66,7),(74,8),(67,17),(53,22),(51,30),(60,35),(22,35),(30,29),(30,23)],IRON[1],IRON[0],2)
        d.line((19,13,57,13),fill=IRON[3],width=3)
        d.line((32,24,49,24),fill=IRON[3],width=2)
        rect(d,(30,34,52,h-7),STONE[1],STONE[0])
        d.line((32,36,50,36),fill=STONE[3],width=2)
        d.line((12,35,29,45),fill=WOOD[0],width=5)
        d.line((12,35,29,45),fill=WOOD[3],width=2)
        poly(d,[(6,30),(10,25),(19,32),(16,38),(12,38)],IRON[2],IRON[0])
    elif name=="alchemy":
        for x,y,c in [(17,13,"#7a8398"),(30,15,"#7b9b6d"),(45,12,"#bb7760")]:
            rect(d,(x-2,y-11,x+2,y-5),"#bad2b6",TEAL[1])
            ellipse(d,(x-5,y-7,x+5,y+2),c,TEAL[0])
            rect(d,(x-1,y-12,x+2,y-11),WOOD[3])
            d.line((x-3,y-4,x-3,y),fill="#e3e9c4")
        poly(d,[(35,29),(52,27),(55,36),(39,38)],"#dfcb9a",WOOD[0])
        d.line((39,31,50,29),fill=WOOD[3])
        d.line((40,34,51,32),fill=WOOD[2])
    else:
        for x in [20,29,38]:
            poly(d,[(x,16),(x+14,8),(x+28,12),(x+14,20)],WOOD[3],WOOD[0])
            d.line((x+3,16,x+15,10),fill=WOOD[4])
        d.line((10,29,33,36),fill=IRON[1],width=3)
        for i in range(8):
            d.line((11+i*3,30+i,12+i*3,32+i),fill=IRON[2])
        rect(d,(8,25,13,34),WOOD[0])
    save(im,name)


def furnace():
    im,d=canvas(64,80)
    shadow(d,32,73,28,6)
    poly(d,[(8,70),(10,31),(18,20),(21,8),(43,8),(46,21),(55,32),(57,71),(49,76),(14,76)],STONE[1],STONE[0],2)
    poly(d,[(12,32),(22,23),(23,11),(31,11),(31,72),(12,70)],STONE[2],None)
    for y in [15,24,34,44,54,65]:
        d.line((12 if y>24 else 22,y,52 if y>24 else 43,y),fill=STONE[0],width=2)
        d.line((13 if y>24 else 23,y+2,50 if y>24 else 41,y+2),fill=STONE[3])
    for x,y in [(27,16),(35,25),(23,35),(41,35),(20,45),(45,55)]:
        d.line((x,y,x,y+7),fill=STONE[0])
    poly(d,[(20,64),(20,49),(24,42),(40,42),(45,49),(45,64)],"#352e2c",STONE[0],2)
    for j,(x,y,h) in enumerate([(25,62,11),(32,64,19),(39,62,13)]):
        poly(d,[(x-4,y),(x-3,y-6),(x,y-h),(x+2,y-7),(x+4,y-2),(x+2,y+1)],"#da793d",None)
        poly(d,[(x-2,y),(x,y-9),(x+2,y)],"#f3ca72",None)
    d.line((19,65,46,65),fill=IRON[0],width=3)
    for x in [23,29,35,41]:d.line((x,57,x,65),fill=IRON[1],width=2)
    rect(d,(21,6,44,10),STONE[0])
    d.line((22,6,43,6),fill=STONE[3],width=2)
    save(im,"furnace")


def fence_image(name):
    w,h={"fence":(32,40),"wall":(32,48),"gate":(64,48)}[name]
    im,d=canvas(w,h)
    shadow(d,w//2,h-3,w//2-1,4)
    if name=="wall":
        poly(d,[(0,16),(8,9),(31,9),(31,44),(0,44)],STONE[1],STONE[0])
        poly(d,[(0,16),(8,9),(31,9),(24,16)],STONE[3],STONE[0])
        for yy in [20,29,38]:
            d.line((0,yy,31,yy),fill=STONE[0],width=2)
            for xx in ([7,23] if yy==29 else [15]):
                d.line((xx,yy-8,xx,yy),fill=STONE[0])
            d.line((1,yy+2,30,yy+2),fill=STONE[2])
        return save(im,name)
    for y in [17,28]:
        rect(d,(0,y,w-1,y+5),WOOD[2],WOOD[0])
        d.line((1,y+1,w-1,y+1),fill=WOOD[4])
    for x in ([4,25] if name=="fence" else [4,56]):
        poly(d,[(x-3,h-3),(x-3,10),(x,6),(x+4,10),(x+4,h-3)],WOOD[2],WOOD[0])
        d.line((x-1,11,x-1,h-6),fill=WOOD[4])
        d.point((x+1,20),fill=IRON[2])
    if name=="gate":
        for x in range(12,55,9):
            rect(d,(x,16,x+4,37),WOOD[2],WOOD[0])
            d.line((x+1,17,x+1,35),fill=WOOD[3])
        d.line((12,35,52,17),fill=WOOD[0],width=5)
        d.line((12,34,52,16),fill=WOOD[3],width=2)
        rect(d,(44,24,48,28),IRON[1],INK)
    save(im,name)


def roof(d, cx, y, rw, rh, palette, seed):
    # Isometric gable roof with individual staggered terracotta tiles.
    left=[(cx-rw//2,y+rh),(cx-8,y),(cx+1,y+rh//5),(cx+1,y+rh+7)]
    right=[(cx-8,y),(cx+rw//2-5,y+rh-4),(cx+rw//2,y+rh+8),(cx+1,y+rh+7),(cx+1,y+rh//5)]
    poly(d,left,palette[1],WOOD[0],2)
    poly(d,right,palette[2],WOOD[0],2)
    r=random.Random(seed)
    mask=Image.new("1",d._image.size)
    md=ImageDraw.Draw(mask)
    md.polygon(left,fill=1)
    md.polygon(right,fill=1)
    # Clip every tile pixel to its roof slope.
    for yy in range(y+5,y+rh+8,7):
        for xx in range(cx-rw//2,cx+rw//2,10):
            xx+=5 if (yy//7)%2 else 0
            col=palette[r.randrange(1,4)]
            for py in range(yy,yy+5):
                for px in range(xx,xx+9):
                    if 0<=px<mask.width and 0<=py<mask.height and mask.getpixel((px,py)):
                        d.point((px,py),fill=col)
            for px in range(xx,xx+9):
                if 0<=px<mask.width and 0<=yy<mask.height and mask.getpixel((px,yy)):
                    d.point((px,yy),fill=palette[0])
            for px in range(xx+1,xx+8):
                if 0<=px<mask.width and 0<=yy+1<mask.height and mask.getpixel((px,yy+1)):
                    d.point((px,yy+1),fill=palette[4])
    d.line(left+[left[0]],fill=WOOD[0],width=2)
    d.line(right+[right[0]],fill=WOOD[0],width=2)
    d.line((cx-8,y,cx+1,y+rh//5,cx+1,y+rh+7),fill=WOOD[3],width=4)
    d.line((cx-7,y+2,cx+2,y+rh//5,cx+2,y+rh+5),fill=WOOD[4])


def window(d,x,y,w=19,h=23,lit=True):
    rect(d,(x-3,y-3,x+w+3,y+h+3),WOOD[0])
    rect(d,(x-1,y-1,x+w+1,y+h+1),WOOD[3],WOOD[0])
    rect(d,(x+1,y+1,x+w-1,y+h-1),"#b99c5e" if lit else TEAL[0])
    rect(d,(x+3,y+2,x+w-3,y+h-3),"#efd49a" if lit else TEAL[2])
    d.line((x+3,y+2,x+w-3,y+2),fill="#fff2bd" if lit else TEAL[4])
    d.line((x+w//2,y+1,x+w//2,y+h),fill=WOOD[1],width=3)
    d.line((x,y+h//2,x+w,y+h//2),fill=WOOD[1],width=2)
    rect(d,(x-5,y+h+2,x+w+5,y+h+6),WOOD[2],WOOD[0])


def door(d,x,y,w,h):
    poly(d,[(x-3,y+h),(x-3,y+7),(x+2,y-1),(x+w-2,y-1),(x+w+3,y+7),(x+w+3,y+h)],WOOD[0])
    rect(d,(x,y+3,x+w,y+h),WOOD[1])
    for xx in range(x+2,x+w,5):
        d.line((xx,y+5,xx,y+h-1),fill=WOOD[0])
        d.line((xx+1,y+5,xx+1,y+h-1),fill=WOOD[2])
    for yy in [y+12,y+h-8]:
        rect(d,(x+1,yy,x+w-1,yy+2),IRON[0])
        d.point((x+3,yy+1),fill=IRON[2])
    ellipse(d,(x+w-6,y+h//2,x+w-3,y+h//2+3),GOLD[2],GOLD[0])
    rect(d,(x-5,y+h,x+w+5,y+h+5),STONE[2],STONE[0])
    d.line((x-4,y+h+1,x+w+4,y+h+1),fill=STONE[4])


def house(name,w,h,style=0):
    im,d=canvas(w,h)
    cx=w//2
    ground=h-12
    bw=int(w*.68)
    x=cx-bw//2
    top=int(h*.42)
    bottom=ground-5
    shadow(d,cx,ground,w//2-8,10)
    # Stone foundation; individually mortared blocks.
    rect(d,(x-3,bottom-20,x+bw+3,bottom+2),STONE[1],STONE[0],2)
    for yy in range(bottom-18,bottom,8):
        d.line((x-2,yy,x+bw+2,yy),fill=STONE[0])
        for xx in range(x+(5 if yy%16 else 14),x+bw,18):
            d.line((xx,yy,xx,yy+7),fill=STONE[0])
        d.line((x-1,yy+1,x+bw+1,yy+1),fill=STONE[2])
    rect(d,(x,top,x+bw,bottom-15),"#b2976b",WOOD[0],2)
    # Plaster and exposed medieval timber frame.
    speckle(d,(x+3,top+3,x+bw-3,bottom-20),["#bda476","#a88b61","#c6af7f"],int(bw*.8),style+42)
    for yy in [top+20,bottom-22]:
        rect(d,(x,yy,x+bw,yy+5),WOOD[1],WOOD[0])
        d.line((x+1,yy+1,x+bw-1,yy+1),fill=WOOD[3])
    for xx in [x,x+bw//2-3,x+bw-7]:
        rect(d,(xx,top,xx+6,bottom-16),WOOD[1],WOOD[0])
        d.line((xx+1,top+2,xx+1,bottom-18),fill=WOOD[3])
    for a,b in [((x+9,top+25),(x+bw//2-8,bottom-29)),((x+bw//2+8,bottom-29),(x+bw-9,top+25))]:
        d.line([a,b],fill=WOOD[0],width=7)
        d.line([a,b],fill=WOOD[2],width=4)
    roof_palettes=[
        ["#693a32","#8b493b","#a85943","#b86e4d","#d18a5c"],
        ["#344f45","#466858","#608270","#709681","#8daf8b"],
        ["#3b535c","#42697a","#508397","#6199a4","#83b0b1"],
        ["#715334","#946c3c","#b18848","#c7a15e","#d9bc78"],
    ]
    # Optional chimney sits behind the roof with brick detail.
    if name in ("smithy","tavern","home","house"):
        chx=x+bw-24
        rect(d,(chx,23,chx+20,top+15),STONE[1],STONE[0],2)
        for yy in range(28,top+15,7):
            d.line((chx+1,yy,chx+19,yy),fill=STONE[0])
            d.line((chx+3,yy+1,chx+17,yy+1),fill=STONE[3])
        rect(d,(chx-3,20,chx+23,27),STONE[2],STONE[0])
    roof(d,cx,int(h*.1),int(w*.87),int(h*.4),roof_palettes[style%4],5+style)
    # The ridge front and gable are visible below the eaves.
    poly(d,[(cx+2,int(h*.25)),(cx+int(w*.37),top+int(h*.13)),(cx+int(w*.37),top+int(h*.15)),(cx+2,int(h*.30))],WOOD[1],WOOD[0],2)
    d.line((cx+5,int(h*.30),cx+int(w*.35),top+int(h*.13)),fill=WOOD[3],width=2)
    window(d,x+15,bottom-64,21,25,True)
    door(d,x+bw-43,bottom-54,25,54)
    if w>180:
        window(d,x+bw//2-14,top+13,24,21,False)
    # Flower boxes and climbing vines.
    boxy=bottom-32
    rect(d,(x+11,boxy,x+43,boxy+8),WOOD[1],WOOD[0])
    for i in range(7):
        xx=x+12+i*4
        d.line((xx,boxy+2,xx-2,boxy-5),fill=LEAF[1],width=2)
        rect(d,(xx-3,boxy-5,xx,boxy-3),["#b58c8d","#d8ad78","#d8c58c"][i%3])
        d.point((xx-2,boxy-4),fill="#f4d2a0")
    # Door lantern and cobbles.
    lx=x+bw-6
    d.line((lx,bottom-52,lx+5,bottom-52,lx+5,bottom-42),fill=IRON[0],width=2)
    rect(d,(lx+1,bottom-42,lx+9,bottom-32),GOLD[0],INK)
    rect(d,(lx+3,bottom-40,lx+7,bottom-34),"#f2ca7c")
    for j in range(7):
        xx=x-9+j*9
        yy=ground-3+(j%2)*3
        ellipse(d,(xx,yy,xx+7,yy+3),STONE[2],STONE[0])
    if name=="smithy":
        # Hanging iron anvil emblem, and a wood-and-stone smith yard.
        d.line((x-2,bottom-67,x-18,bottom-67,x-18,bottom-55),fill=WOOD[0],width=4)
        rect(d,(x-31,bottom-54,x-7,bottom-31),WOOD[1],WOOD[0],2)
        poly(d,[(x-29,bottom-47),(x-9,bottom-47),(x-14,bottom-42),(x-19,bottom-42),(x-20,bottom-38),(x-12,bottom-36),(x-26,bottom-36),(x-22,bottom-40),(x-23,bottom-44)],IRON[2],None)
        for j in range(4):
            rect(d,(x+7+j*10,bottom+3,x+14+j*10,bottom+7),WOOD[1],WOOD[0])
    if name=="tavern":
        d.line((x-2,bottom-72,x-20,bottom-72,x-20,bottom-56),fill=WOOD[0],width=4)
        rect(d,(x-33,bottom-57,x-6,bottom-29),WOOD[2],WOOD[0],2)
        rect(d,(x-27,bottom-51,x-16,bottom-37),GOLD[2],WOOD[0])
        d.arc((x-22,bottom-50,x-10,bottom-38),-90,90,fill=GOLD[3],width=3)
        rect(d,(x-28,bottom-53,x-14,bottom-49),"#e8d9ac")
    save(im,name)


def market():
    im,d=canvas(160,160)
    shadow(d,80,146,67,10)
    # Timber merchant wagon underneath striped canvas canopy.
    for x in [27,126]:
        rect(d,(x,40,x+6,144),WOOD[2],WOOD[0])
        d.line((x+1,41,x+1,141),fill=WOOD[4])
    poly(d,[(17,74),(38,35),(118,35),(145,74),(141,88),(17,88)],"#ddd1a2",WOOD[0],2)
    for j in range(7):
        x=18+j*18
        poly(d,[(x,74),(38+int(j*11.5),36),(49+int(j*11.5),36),(x+14,74),(x+14,87),(x+7,92),(x,87)],"#a45c4d" if j%2==0 else "#ddc995",WOOD[1])
        d.line((x+2,75,x+12,75),fill="#e4b68b" if j%2==0 else "#f1dfb1")
    poly(d,[(21,117),(34,102),(128,102),(140,117),(140,139),(21,139)],WOOD[2],WOOD[0],2)
    wood_grain(d,(24,120,137,137))
    d.line((25,118,136,118),fill=WOOD[4],width=2)
    for x,y,c in [(41,108,"#a15542"),(54,111,"#d4ac53"),(74,107,"#668248"),(95,110,"#a05254"),(112,106,"#b89760")]:
        ellipse(d,(x-8,y-7,x+8,y+4),WOOD[0])
        ellipse(d,(x-6,y-7,x+6,y+1),c,WOOD[0])
        d.line((x-3,y-5,x+1,y-5),fill="#e6c692")
    for x in [14,137]:
        ellipse(d,(x-8,135,x+8,151),WOOD[0])
        ellipse(d,(x-5,138,x+5,148),WOOD[2])
        d.line((x-5,143,x+5,143),fill=WOOD[0])
        d.line((x,138,x,148),fill=WOOD[0])
    save(im,"market")


def well():
    im,d=canvas(64,80)
    shadow(d,32,73,29,6)
    ellipse(d,(7,43,57,75),STONE[0])
    rect(d,(7,54,57,64),STONE[1],STONE[0])
    ellipse(d,(7,39,57,65),STONE[2],STONE[0],2)
    ellipse(d,(14,44,50,59),TEAL[0],STONE[0])
    ellipse(d,(18,47,46,56),TEAL[2])
    d.line((24,50,39,50),fill=TEAL[3])
    for x in [14,46]:
        rect(d,(x,13,x+5,50),WOOD[2],WOOD[0])
        d.line((x+1,15,x+1,46),fill=WOOD[4])
    poly(d,[(3,19),(29,2),(61,20),(60,26),(4,26)],"#8d4b3d",WOOD[0],2)
    for y in [13,20]:d.line((12,y,50,y+1),fill="#c07a50",width=2)
    d.line((30,25,30,49),fill=WOOD[4])
    rect(d,(26,41,35,50),WOOD[2],WOOD[0])
    d.line((20,33,47,33),fill=WOOD[1],width=3)
    ellipse(d,(25,29,37,37),WOOD[3],WOOD[0])
    save(im,"well")


def ruin():
    im,d=canvas(160,160)
    shadow(d,80,145,70,9)
    for x in [23,106]:
        poly(d,[(x,144),(x+3,62),(x+30,49),(x+32,143)],STONE[1],STONE[0],2)
        for yy in range(64,140,16):
            d.line((x+3,yy,x+30,yy-2),fill=STONE[0],width=2)
            d.line((x+4,yy+2,x+29,yy),fill=STONE[3])
        rect(d,(x-5,136,x+36,147),STONE[2],STONE[0],2)
        rect(d,(x-4,57,x+35,68),STONE[2],STONE[0])
    # Broken, ancient pointed arch.
    arch=[(21,64),(25,47),(40,29),(60,17),(74,13),(89,17),(103,27),(120,43),(138,61),(107,64),(97,48),(82,37),(68,35),(53,44),(48,64)]
    poly(d,arch,STONE[2],STONE[0],2)
    for pts in [[(41,30),(54,45)],[(61,19),(66,36)],[(86,19),(83,37)],[(105,31),(96,47)],[(121,45),(106,61)]]:
        d.line(pts,fill=STONE[0],width=2)
    d.line([(27,47),(42,30),(60,19),(73,16)],fill=STONE[4],width=2)
    poly(d,[(72,13),(75,18),(73,27),(78,33),(82,29),(81,17)],"#273c36",None)
    for x,y in [(32,91),(113,75),(113,121)]:
        d.line((x,y,x+11,y),fill=TEAL[3],width=2)
        d.line((x+5,y-5,x+5,y+6),fill=TEAL[3],width=2)
        d.point((x+3,y-3),fill=TEAL[4])
    # Ivy descends over broken stone.
    for j in range(12):
        x=24+j%3*5; y=45+j*6
        d.line((x,y,x+3,y+8),fill=LEAF[1],width=2)
        poly(d,[(x,y),(x-6,y-2),(x-7,y+2),(x-1,y+5),(x+4,y+2)],LEAF[2],LEAF[0])
        d.point((x-4,y),fill=LEAF[4])
    for x,y in [(63,141),(91,148),(139,145),(14,142)]:
        poly(d,[(x-7,y),(x-4,y-7),(x+4,y-5),(x+9,y+2),(x,y+4)],STONE[2],STONE[0])
    save(im,"ruin_arch")


def mine():
    im,d=canvas(160,160)
    shadow(d,80,146,73,10)
    poly(d,[(7,144),(9,99),(22,79),(29,42),(54,24),(89,18),(121,32),(139,64),(144,102),(154,143)],STONE[1],STONE[0],2)
    poly(d,[(12,99),(31,44),(55,27),(86,22),(108,33),(97,57),(60,76)],STONE[2],None)
    poly(d,[(88,22),(120,35),(135,65),(141,101),(152,140),(118,142),(112,92)],STONE[0],None)
    d.line([(29,44),(55,27),(86,22)],fill=STONE[3],width=3)
    for pts in [[(16,103),(34,94),(41,71),(67,62)],[(112,40),(99,57),(105,75),(129,89)],[(31,119),(40,104)],[(55,29),(61,45),(83,52)]]:
        d.line(pts,fill=STONE[0],width=2)
    poly(d,[(42,144),(42,83),(52,66),(104,66),(117,83),(117,144)],"#1f2928",STONE[0],2)
    poly(d,[(57,144),(57,89),(67,77),(91,77),(102,90),(102,144)],"#152423",None)
    for x in [36,112]:
        rect(d,(x,74,x+12,146),WOOD[1],WOOD[0],2)
        d.line((x+2,77,x+2,142),fill=WOOD[3],width=3)
        for y in [91,125]:
            rect(d,(x, y,x+12,y+4),IRON[0])
            d.point((x+5,y+2),fill=IRON[2])
    rect(d,(32,65,129,78),WOOD[2],WOOD[0],2)
    d.line((35,67,127,67),fill=WOOD[4],width=2)
    for x in [55,92]:
        d.line((x,144,x+6,102),fill=IRON[2],width=3)
    for y in range(106,148,10):
        d.line((52,y,103,y),fill=WOOD[2],width=4)
        d.line((52,y-1,103,y-1),fill=WOOD[0])
    rect(d,(25,93,34,105),GOLD[0],INK)
    rect(d,(27,95,32,102),GOLD[3])
    for x,y in [(18,116),(127,118),(135,131)]:
        poly(d,[(x-4,y),(x-3,y-8),(x+2,y-11),(x+6,y-4),(x+5,y+1)],"#99b7bb",IRON[0])
        d.line((x-1,y-7,x-1,y-1),fill=IRON[4])
    save(im,"mine_entrance")


def bridge():
    im,d=canvas(128,128)
    shadow(d,64,110,59,10)
    for x in [13,109]:
        rect(d,(x,17,x+7,116),WOOD[1],WOOD[0])
    poly(d,[(17,25),(109,25),(117,113),(9,113)],WOOD[2],WOOD[0],2)
    for y in range(28,114,8):
        d.line((14,y,113,y),fill=WOOD[0],width=2)
        d.line((15,y+2,112,y+2),fill=WOOD[3])
        if y%3==0:d.line((35,y+4,71,y+4),fill=WOOD[1])
    for x in [9,111]:
        for y in [31,68,108]:
            rect(d,(x-3,y-18,x+6,y+5),WOOD[2],WOOD[0])
            rect(d,(x-5,y-20,x+8,y-14),WOOD[3],WOOD[0])
            d.line((x-1,y-13,x-1,y+1),fill=WOOD[4])
        d.line((x+2,12,x+2,91),fill=WOOD[0],width=5)
        d.line((x+1,12,x+1,91),fill=WOOD[3],width=2)
    save(im,"bridge")


def small_props():
    save(chest(),"chest")
    im,d=canvas(40,24)
    shadow(d,20,20,17,3)
    poly(d,[(7,19),(10,8),(30,8),(33,19),(37,21),(27,22),(21,19),(13,22),(3,21)],WOOD[1],WOOD[0])
    ellipse(d,(9,3,31,14),WOOD[3],WOOD[0])
    ellipse(d,(13,5,27,12),WOOD[2],WOOD[0])
    d.line((16,7,23,10),fill=WOOD[4])
    save(im,"stump")
    im,d=canvas(24,48)
    shadow(d,12,44,7,3)
    rect(d,(10,24,14,44),WOOD[2],WOOD[0])
    d.line((11,25,11,42),fill=WOOD[4])
    poly(d,[(8,29),(5,20),(10,14),(10,5),(17,14),(20,21),(16,29)],"#b76d3c",INK)
    poly(d,[(9,26),(8,20),(13,12),(17,21),(14,27)],"#ecc16c",None)
    poly(d,[(11,25),(13,19),(15,25)],"#fff0ba",None)
    for y in [28,31]:rect(d,(8,y,16,y+2),IRON[1],IRON[0])
    save(im,"torch")
    im,d=canvas(32,48)
    shadow(d,16,44,9,3)
    rect(d,(14,12,18,43),WOOD[2],WOOD[0])
    d.line((15,14,15,40),fill=WOOD[4])
    poly(d,[(2,9),(24,9),(30,16),(24,23),(2,23)],WOOD[2],WOOD[0],2)
    d.line((4,11,23,11),fill=WOOD[4])
    d.line((5,17,20,17),fill=WOOD[0])
    d.line((18,15,21,17,18,19),fill=GOLD[2],width=2)
    save(im,"sign")
    im,d=canvas(48,32)
    shadow(d,24,27,22,4)
    poly(d,[(3,14),(34,9),(43,15),(42,25),(12,30),(4,25)],WOOD[1],WOOD[0])
    d.line((8,15,36,11),fill=WOOD[3],width=3)
    d.line((12,23,36,20),fill=WOOD[0])
    ellipse(d,(32,10,46,26),WOOD[3],WOOD[0])
    ellipse(d,(35,13,43,23),WOOD[1],WOOD[0])
    ellipse(d,(37,15,41,21),WOOD[2])
    save(im,"log")
    im,d=canvas(32,32)
    for x,y in [(8,22),(18,17),(23,26)]:
        d.line((x,y+4,x,y-4),fill=LEAF[1])
        for dx,dy in [(-2,0),(2,0),(0,-2),(0,2)]:
            rect(d,(x+dx-1,y+dy-1,x+dx+1,y+dy+1),"#dad4ab" if x%2==0 else "#d49c94")
        d.point((x,y),fill=GOLD[3])
    save(im,"flowers")
    im,d=canvas(32,32)
    for x,y,dx in [(8,27,-4),(12,27,2),(16,28,-1),(20,26,5),(25,27,2)]:
        poly(d,[(x-1,y),(x+dx,y-11),(x+2,y)],LEAF[2],None)
        d.line((x,y-1,x+dx,y-8),fill=LEAF[4])
    save(im,"grass_tuft")
    im,d=canvas(32,32)
    ellipse(d,(4,12,28,24),"#345e49",TEAL[0])
    poly(d,[(15,19),(27,12),(26,20)],TEAL[1],None)
    d.line((8,15,18,15),fill=LEAF[4])
    for dx,dy in [(-3,0),(3,0),(0,-3),(0,3)]:
        ellipse(d,(14+dx,10+dy,18+dx,14+dy),"#dec0b1")
    rect(d,(15,11,17,13),GOLD[3])
    save(im,"lily")


def garden():
    im,d=canvas(64,64)
    shadow(d,32,55,30,6)
    poly(d,[(5,19),(51,12),(60,51),(11,59)],"#6b5036",WOOD[0])
    for y in [23,35,47]:
        d.line((10,y,53,y-5),fill="#a5804f",width=3)
        for x in [16,29,42]:
            yy=y-(x//12)
            d.line((x,yy+1,x,yy-7),fill=LEAF[1],width=2)
            poly(d,[(x,yy-3),(x-6,yy-8),(x-7,yy-4),(x-1,yy),(x+5,yy-8),(x+7,yy-6)],LEAF[3],LEAF[1])
            d.line((x-4,yy-5,x-1,yy-3),fill=LEAF[5])
    for pts in [[(4,18),(51,11)],[(4,18),(11,60)],[(11,60),(61,52)],[(51,11),(61,52)]]:
        d.line(pts,fill=WOOD[0],width=4)
        d.line(pts,fill=WOOD[3],width=2)
    save(im,"garden")


def animal_pen():
    im,d=canvas(96,96)
    shadow(d,48,84,43,6)
    rect(d,(11,29,86,82),"#667d47")
    speckle(d,(13,31,84,80),[LEAF[2],LEAF[4],"#a79c57"],75,12)
    # Three rails leave a walkable gate opening.
    for x0,y0,x1,y1 in [(8,25,86,25),(8,25,8,84),(86,25,86,84),(8,84,34,84),(66,84,86,84)]:
        d.line((x0,y0,x1,y1),fill=WOOD[0],width=6)
        d.line((x0,y0-1,x1,y1-1),fill=WOOD[3],width=3)
    for x,y in [(8,25),(48,25),(86,25),(8,55),(86,55),(8,84),(34,84),(66,84),(86,84)]:
        poly(d,[(x-3,y+3),(x-3,y-13),(x,y-17),(x+4,y-13),(x+4,y+3)],WOOD[2],WOOD[0])
        d.line((x-1,y-12,x-1,y+1),fill=WOOD[4])
    ellipse(d,(20,40,46,50),WOOD[0])
    rect(d,(20,44,46,56),WOOD[2],WOOD[0])
    ellipse(d,(22,40,44,49),"#bca569",WOOD[0])
    for xx in range(24,44,4):d.line((xx,43,xx+2,46),fill=GOLD[3])
    save(im,"animal_pen")


def person_frame(direction,frame,style="player"):
    im,d=canvas(48,64)
    palettes={
        "player":(TEAL,WOOD[2],"#75492e",False),
        "smith":(["#493d36","#66544a","#8e6d54","#b8936c","#dfb884"],"#514840","#5b4537",False),
        "merchant":(["#4d3343","#764d60","#a2707d","#c39b94","#e4c5b0"],"#baa071","#4d3931",True),
        "healer":(["#3f4c43","#667d66","#9db28a","#c1d2a3","#e4e6c0"],"#d2c2a2","#ad9362",True),
        "captain":(["#344750","#516f7e","#7897a2","#a5b8b8","#d5dbcd"],IRON[2],"#63513b",False),
        "hunter":(["#343e30","#50583a","#78804d","#a3a36b","#cbbe88"],WOOD[2],"#754e31",True),
        "villager":(["#53453f","#80594c","#aa7a60","#c6a078","#e6c49a"],"#9f956c","#705034",False),
    }
    pal,shirt,hair,hat=palettes[style]
    step=[0,0,-2,0,2,0,0,0][frame]
    bob=1 if frame in (3,5) else 0
    act=frame>=6
    # Feet shadows are deliberately kept inside the frame.
    shadow(d,24,58,12,4)
    fy=54+bob
    side=direction in (1,2)
    # Cape, shoulders and split hem.
    poly(d,[(15,28+bob),(32,28+bob),(35,49+bob),(29,51+bob),(25,48+bob),(19,51+bob),(12,47+bob)],pal[0])
    poly(d,[(16,31+bob),(29,30+bob),(30,47+bob),(24,45+bob),(17,48+bob)],pal[2],None)
    d.line((17,33+bob,16,44+bob),fill=pal[3])
    # Walk cycle separates the feet, including side-facing stride.
    if side:
        legs=[(21-step,fy),(26+step,fy-1)]
    else:
        legs=[(20,fy+step),(28,fy-step)]
    for lx,ly in legs:
        rect(d,(lx-3,42+bob,lx+3,ly),"#4b453c",INK)
        poly(d,[(lx-3,ly-6),(lx+3,ly-6),(lx+5 if direction==2 else lx+3,ly+2),(lx-5 if direction==1 else lx-3,ly+2)],WOOD[1])
        d.line((lx-2,ly-5,lx+2,ly-5),fill=WOOD[3],width=2)
        toe_x=lx-3 if direction==1 else lx+1 if direction==2 else lx-1
        d.line((toe_x,ly,toe_x+2,ly),fill=WOOD[3])
        d.line((lx-4 if direction==1 else lx-3,ly+2,lx+4 if direction==2 else lx+3,ly+2),fill=INK)
    # Body leather jerkin over colored tunic.
    poly(d,[(16,29+bob),(31,29+bob),(33,43+bob),(29,48+bob),(17,47+bob),(14,41+bob)],shirt)
    poly(d,[(17,30+bob),(24,30+bob),(24,44+bob),(17,44+bob)],WOOD[3] if style=="player" else pal[2],None)
    if direction!=3:
        d.line((18,33+bob,29,41+bob),fill=WOOD[0],width=3)
        d.line((18,32+bob,29,40+bob),fill=WOOD[3])
    rect(d,(15,42+bob,32,45+bob),WOOD[0])
    rect(d,(23,42+bob,26,45+bob),GOLD[2],GOLD[0])
    # Arms follow stride and rise during the action frames.
    left_y=33+bob+int(step/2)
    right_y=33+bob-int(step/2)
    if act:
        right_y=23 if frame==6 else 33
    for ax,ay in [(13,left_y),(33,right_y)]:
        poly(d,[(ax-3,ay-2),(ax+3,ay-2),(ax+4,ay+7),(ax,ay+10),(ax-4,ay+6)],pal[2])
        rect(d,(ax-2,ay+6,ax+2,ay+11),"#d3a173",WOOD[0])
        d.line((ax-1,ay+7,ax+1,ay+7),fill="#edc08d")
        rect(d,(ax-3,ay+4,ax+3,ay+6),WOOD[1],WOOD[0])
    # A readable 17-pixel face, with profile adjusted by direction.
    hx=24+(-2 if direction==1 else 2 if direction==2 else 0)
    hy=18+bob
    poly(d,[(hx-8,hy-7),(hx-6,hy-11),(hx+5,hy-11),(hx+9,hy-6),(hx+8,hy+7),(hx+4,hy+11),(hx-5,hy+10),(hx-9,hy+5)],"#b98259",WOOD[0])
    poly(d,[(hx-6,hy-5),(hx+5,hy-5),(hx+6,hy+5),(hx+2,hy+8),(hx-5,hy+6)],"#d8a776",None)
    rect(d,(hx-5,hy-4,hx+4,hy),"#edc28f")
    # Hair uses stepped clusters rather than a circular cap.
    poly(d,[(hx-9,hy-4),(hx-9,hy-8),(hx-6,hy-12),(hx+4,hy-13),(hx+9,hy-8),(hx+8,hy-2),(hx+4,hy-4),(hx+2,hy-7),(hx-2,hy-4),(hx-5,hy-5),(hx-7,hy+2)],hair,WOOD[0])
    d.line((hx-6,hy-9,hx+3,hy-10),fill=WOOD[3],width=2)
    if direction==3:
        poly(d,[(hx-8,hy-6),(hx+7,hy-6),(hx+7,hy+4),(hx+4,hy+7),(hx-5,hy+7),(hx-8,hy+3)],hair,WOOD[0])
        d.line((hx-5,hy-4,hx-5,hy+3),fill=WOOD[3])
        # Teal hood folded at the back of the neck.
        poly(d,[(16,28+bob),(24,25+bob),(32,28+bob),(27,34+bob),(20,34+bob)],pal[1],pal[0])
        d.line((19,29+bob,26,31+bob),fill=pal[3])
    else:
        eyes=[hx-4,hx+4] if direction==0 else [hx-5] if direction==1 else [hx+5]
        for ex in eyes:
            d.line((ex,hy+1,ex+2,hy+1),fill="#282b29",width=2)
            d.point((ex,hy),fill="#f4d7a0")
        if direction==0:
            d.line((hx-1,hy+6,hx+2,hy+6),fill="#94634d")
        else:
            ex=hx-8 if direction==1 else hx+8
            rect(d,(ex,hy+2,ex+2,hy+4),"#d7a371")
    if hat:
        if style=="healer":
            poly(d,[(hx-11,hy-5),(hx-9,hy-12),(hx,hy-16),(hx+9,hy-12),(hx+11,hy-5),(hx+7,hy-3),(hx+5,hy-11),(hx-5,hy-11),(hx-7,hy-3)],pal[3],pal[0])
        else:
            poly(d,[(hx-12,hy-6),(hx-8,hy-9),(hx-5,hy-17),(hx+4,hy-15),(hx+8,hy-8),(hx+13,hy-6),(hx+8,hy-3),(hx-8,hy-3)],pal[1],pal[0])
            d.line((hx-7,hy-8,hx+7,hy-8),fill=pal[3],width=2)
            if style=="hunter":
                d.line((hx+5,hy-11,hx+11,hy-21),fill=GOLD[2],width=2)
                d.line((hx+9,hy-20,hx+12,hy-17),fill=GOLD[4],width=2)
    if style=="smith" and direction!=3:
        poly(d,[(hx-6,hy+5),(hx,hy+7),(hx+6,hy+4),(hx+5,hy+11),(hx,hy+13),(hx-4,hy+10)],"#624839",WOOD[0])
    if style=="captain":
        poly(d,[(hx-9,hy-7),(hx-6,hy-13),(hx+5,hy-13),(hx+9,hy-7),(hx+9,hy-1),(hx+6,hy-1),(hx+5,hy-5),(hx-5,hy-5),(hx-6,hy-1),(hx-9,hy-1)],IRON[2],IRON[0])
        d.line((hx,hy-13,hx,hy-6),fill=IRON[4],width=2)
    # Blade is a separate-looking layer, synchronized with the action.
    if style=="captain":
        if act:
            sx,sy=(36,29) if frame==6 else (36,40)
            ex,ey=(43,8) if frame==6 else (45,34)
        else:
            sx,sy=35,47+bob
            ex,ey=40,31+bob
        d.line((sx,sy,ex,ey),fill=INK,width=5)
        d.line((sx,sy,ex,ey),fill=IRON[2],width=3)
        d.line((sx,sy,ex-1,ey),fill=IRON[4])
        d.line((sx-4,sy-2,sx+3,sy+1),fill=GOLD[1],width=3)
        d.line((sx-1,sy+1,sx-2,sy+5),fill=WOOD[1],width=3)
    return im


def persons():
    for style in ["player","smith","merchant","healer","captain","hunter","villager"]:
        atlas,_=canvas(384,256)
        for direction in range(4):
            for frame in range(8):
                atlas.alpha_composite(person_frame(direction,frame,style),(frame*48,direction*64))
        save(atlas,"player" if style=="player" else "npc_"+style)
    # Optional aligned armor layers, for an actually visible equipment upgrade.
    for name in ["armor_chest","armor_helmet"]:
        atlas,_=canvas(384,256)
        for direction in range(4):
            for frame in range(8):
                im,d=canvas(48,64)
                b=1 if frame in (3,5) else 0
                if name=="armor_chest":
                    poly(d,[(16,29+b),(22,31+b),(28,29+b),(32,32+b),(31,42+b),(27,45+b),(18,43+b),(15,36+b)],IRON[1],IRON[0])
                    poly(d,[(18,31+b),(23,33+b),(23,41+b),(18,40+b)],IRON[2],None)
                    d.line((18,32+b,21,33+b),fill=IRON[4],width=2)
                    d.line((25,33+b,28,31+b),fill=IRON[3],width=2)
                    rect(d,(17,40+b,30,43+b),IRON[0])
                    rect(d,(23,41+b,26,43+b),GOLD[2],GOLD[0])
                else:
                    hx=24+(-2 if direction==1 else 2 if direction==2 else 0)
                    hy=18+b
                    poly(d,[(hx-10,hy-5),(hx-8,hy-12),(hx-3,hy-15),(hx+5,hy-14),(hx+10,hy-8),(hx+10,hy+3),(hx+6,hy+5),(hx+5,hy-4),(hx-5,hy-4),(hx-6,hy+5),(hx-10,hy+3)],IRON[1],IRON[0])
                    poly(d,[(hx-7,hy-11),(hx-2,hy-13),(hx+3,hy-12),(hx+3,hy-6),(hx-7,hy-6)],IRON[2],None)
                    d.line((hx,hy-13,hx,hy-5),fill=IRON[4],width=2)
                    if direction==3:rect(d,(hx-6,hy-4,hx+6,hy+4),IRON[1],IRON[0])
                atlas.alpha_composite(im,(frame*48,direction*64))
        save(atlas,name)


def enemy_frame(name,frame):
    w,h=(96,112) if name=="guardian" else (48,64)
    im,d=canvas(w,h)
    cx=w//2
    bob=1 if frame==2 else 0
    shadow(d,cx,h-7,w//3,5)
    if name=="slime":
        y=49+bob
        poly(d,[(7,y+3),(6,y-7),(10,y-17),(17,y-22),(29,y-21),(37,y-15),(42,y-3),(40,y+5),(34,y+8),(25,y+6),(15,y+9)],"#4d854f",LEAF[0],2)
        ellipse(d,(11,y-19,35,y-1),"#76ac66")
        poly(d,[(13,y-12),(15,y-17),(22,y-18),(24,y-15),(18,y-13)],"#b2ce87",None)
        for x in [19,31]:
            rect(d,(x,y-6,x+2,y-2),"#233c31")
            d.point((x,y-7),fill="#e2dfb1")
        d.line((23,y+1,28,y+1),fill="#355d3b")
        for x,y0 in [(10,y+3),(34,y+2)]:d.point((x,y0),fill="#c3d99b")
    elif name=="wolf":
        step=2 if frame==1 else -2 if frame==2 else 0
        for x,y in [(11,50+step),(18,53-step),(32,51-step),(38,51+step)]:
            d.line((x,y-10,x,y+6),fill="#4a5450",width=5)
            d.line((x-1,y+6,x+3,y+6),fill="#c2bfa2",width=2)
        poly(d,[(8,38),(13,31),(32,30),(39,36),(37,48),(24,49),(15,44),(8,47)],"#77847a",INK,2)
        poly(d,[(9,36),(2,29),(2,20),(7,24),(13,34)],"#57685f",INK)
        poly(d,[(27,35),(29,24),(28,17),(35,23),(41,19),(44,28),(43,39),(47,43),(43,48),(32,45),(28,42)],"#85938a",INK)
        poly(d,[(32,26),(35,21),(36,28),(41,24),(41,35),(36,39),(30,35)],"#b6b9a0",None)
        d.line((36,32,39,32),fill="#d8b273",width=2)
        rect(d,(43,40,47,43),INK)
        if frame==3:
            poly(d,[(34,42),(43,45),(45,48),(37,48),(33,45)],"#693e39",INK)
            d.point((40,44),fill="#ede8c7")
    elif name=="spider":
        for s in [-1,1]:
            for j in range(4):
                yy=35+j*4
                dx=15+(j%2)*3
                dy=(-6+j*4)+ (2 if frame==1 else -2 if frame==2 else 0)
                d.line([(cx+s*6,yy),(cx+s*dx,yy-8),(cx+s*(dx+5),yy+dy)],fill=INK,width=4)
                d.line([(cx+s*6,yy),(cx+s*dx,yy-8),(cx+s*(dx+5),yy+dy)],fill="#8b775f",width=2)
        ellipse(d,(13,22,35,43),"#625443",INK,2)
        ellipse(d,(16,24,30,35),"#9b8661")
        poly(d,[(21,26),(27,28),(29,33),(23,32)],"#b7a276",None)
        ellipse(d,(15,38,34,53),"#4e443a",INK,2)
        for x,y in [(20,43),(28,43),(17,46),(31,46)]:
            rect(d,(x,y,x+1,y+1),"#e1a36b")
        d.line((22,50,20,55),fill="#e1d3a2",width=2)
        d.line((27,50,29,55),fill="#e1d3a2",width=2)
    elif name=="golem":
        step=2 if frame==1 else -2 if frame==2 else 0
        for x,y in [(14,55+step),(32,55-step)]:
            poly(d,[(x-7,43),(x+6,43),(x+8,y),(x+6,y+5),(x-9,y+5),(x-10,y)],STONE[1],STONE[0],2)
            d.line((x-5,47,x-4,y+1),fill=STONE[3],width=2)
        poly(d,[(11,24),(32,22),(39,34),(36,47),(26,51),(12,47),(8,36)],STONE[2],STONE[0],2)
        poly(d,[(14,26),(25,24),(24,39),(12,40)],STONE[3],None)
        for x,yy in [(5,30),(38,29)]:
            poly(d,[(x-4,yy),(x+5,yy-2),(x+8,yy+10),(x+5,yy+20),(x-3,yy+18),(x-5,yy+8)],STONE[1],STONE[0],2)
            d.line((x-2,yy+2,x+3,yy+1),fill=STONE[3],width=2)
        poly(d,[(14,9),(30,9),(35,16),(32,28),(15,28),(11,20)],STONE[2],STONE[0],2)
        d.line((15,11,28,11),fill=STONE[4],width=2)
        for x in [17,27]:rect(d,(x,19,x+3,21),TEAL[3],TEAL[0])
        d.line((21,26,26,26),fill=STONE[0],width=2)
        d.line([(30,31),(26,36),(28,43)],fill=STONE[0])
        poly(d,[(21,33),(25,37),(22,42),(18,38)],TEAL[3],TEAL[0])
        for x,y in [(13,12),(31,34),(5,35)]:
            rect(d,(x,y,x+5,y+2),LEAF[2])
    elif name=="guardian":
        step=3 if frame==1 else -3 if frame==2 else 0
        for x,y in [(33,95+step),(62,95-step)]:
            poly(d,[(x-10,73),(x+10,73),(x+11,y),(x+6,y+9),(x-15,y+9),(x-16,y+3)],STONE[1],STONE[0],2)
            poly(d,[(x-7,77),(x+6,77),(x+6,y),(x-10,y+3)],STONE[2],None)
            d.line((x-4,82,x+2,82),fill=TEAL[3],width=2)
        poly(d,[(25,35),(63,35),(72,51),(68,77),(53,85),(30,79),(21,60)],STONE[1],STONE[0],2)
        poly(d,[(28,40),(45,43),(43,71),(31,71),(25,57)],STONE[2],None)
        d.line((31,42,42,46),fill=GOLD[2],width=3)
        d.line((56,43,64,41),fill=GOLD[2],width=3)
        for x,y in [(13,37),(74,39)]:
            poly(d,[(x-10,y),(x+7,y-5),(x+15,y+7),(x+12,y+24),(x+5,y+35),(x-8,y+31),(x-13,y+16)],STONE[1],STONE[0],2)
            poly(d,[(x-8,y+2),(x+5,y-1),(x+7,y+12),(x-6,y+15)],STONE[3],None)
            d.line((x-4,y+21,x+5,y+21),fill=TEAL[3],width=3)
        poly(d,[(31,12),(58,12),(64,22),(61,39),(52,45),(33,41),(27,27)],STONE[2],STONE[0],2)
        poly(d,[(32,15),(43,15),(42,34),(33,34)],STONE[3],None)
        for x in [34,51]:
            rect(d,(x,27,x+6,30),TEAL[3],TEAL[0])
            d.line((x+1,28,x+4,28),fill=TEAL[4])
        poly(d,[(28,15),(24,4),(32,8),(40,3),(47,10),(56,3),(62,8),(68,4),(63,18)],GOLD[1],GOLD[0],2)
        d.line((33,14,59,14),fill=GOLD[3],width=2)
        poly(d,[(47,49),(56,60),(49,73),(38,63)],TEAL[3],TEAL[0],2)
        poly(d,[(47,52),(50,60),(47,68),(43,61)],TEAL[4],None)
        # Stone warblade is legible even at game scale.
        d.line((80,74,86,28 if frame!=3 else 52),fill=STONE[0],width=10)
        d.line((80,74,86,28 if frame!=3 else 52),fill=STONE[3],width=6)
        d.line((73,73,88,75),fill=GOLD[1],width=5)
        d.line((79,75,78,90),fill=WOOD[1],width=6)
        for x,y in [(33,18),(64,66),(18,49)]:rect(d,(x,y,x+6,y+2),LEAF[2])
    else:
        # Armed humanoid monsters: goblin, skeleton and archer.
        step=2 if frame==1 else -2 if frame==2 else 0
        gob=name=="goblin"
        skin=" #8d9b55".strip() if gob else "#c9c5a2"
        shade="#5d703e" if gob else "#8f967f"
        for x,yy in [(18,53+step),(29,53-step)]:
            d.line((x,42,x,yy),fill=INK,width=7)
            d.line((x,42,x,yy),fill=shade,width=4)
            poly(d,[(x-3,yy-3),(x+3,yy-3),(x+5,yy+3),(x-4,yy+3)],WOOD[1] if gob else skin,INK)
        if gob:
            poly(d,[(15,29),(30,29),(35,44),(27,49),(16,46),(12,37)],"#7d5c41",INK)
            d.line((17,31,29,43),fill=WOOD[3],width=3)
            for x,y in [(11,33),(34,32)]:
                d.line((x,y,x+(2 if x<20 else -1),y+13),fill=INK,width=7)
                d.line((x,y,x+(2 if x<20 else -1),y+13),fill=shade,width=4)
            poly(d,[(14,13),(8,11),(6,19),(12,24),(14,29),(23,32),(32,27),(38,23),(43,14),(34,14),(30,8),(19,7)],shade,INK)
            poly(d,[(17,12),(29,11),(33,18),(31,26),(23,29),(15,25),(13,18)],skin,None)
            d.line((17,18,20,19),fill="#312f29",width=2)
            d.line((27,19,30,17),fill="#312f29",width=2)
            d.line((19,26,27,26),fill="#4f5035")
            for x in [20,27]:d.line((x,26,x,23),fill="#e7ddb0",width=2)
            poly(d,[(13,13),(15,6),(25,4),(34,10),(36,14),(30,13),(25,9),(17,11)],"#6b4e3c",INK)
        else:
            # Spine and ribcage; actual separated bones.
            d.line((24,29,24,46),fill=INK,width=6)
            d.line((24,29,24,46),fill=skin,width=3)
            for y in [31,35,39]:
                d.line([(24,y),(16,y-1),(16,y+2),(23,y+3),(31,y+2),(31,y-1),(24,y)],fill=shade,width=3)
                d.line((18,y-1,29,y-1),fill=skin)
            for x,y in [(12,31),(34,31)]:
                d.line([(x,y),(x-2,y+7),(x+1,y+14)],fill=INK,width=5)
                d.line([(x,y),(x-2,y+7),(x+1,y+14)],fill=skin,width=3)
            poly(d,[(15,10),(21,6),(30,8),(35,14),(33,25),(28,28),(18,27),(12,21)],skin,INK,2)
            poly(d,[(14,13),(20,10),(25,10),(24,14),(15,17)],"#e5dfb7",None)
            for x in [17,27]:
                rect(d,(x,17,x+4,21),"#37423b")
                d.point((x+1,19),fill="#c78359")
            d.line((23,21,22,24),fill=shade,width=2)
            for x in [19,23,27]:d.line((x,25,x,28),fill=INK)
            if name=="skeleton":
                poly(d,[(12,15),(14,7),(21,3),(31,6),(36,14),(32,15),(28,10),(16,12)],IRON[1],IRON[0])
                d.line((16,8,26,6),fill=IRON[3],width=2)
                poly(d,[(11,30),(16,27),(20,31),(17,36),(10,35)],IRON[1],INK)
            else:
                poly(d,[(11,16),(13,8),(20,3),(29,5),(35,13),(34,28),(30,29),(30,13),(23,9),(15,15),(14,27),(10,27)],"#60644a",INK)
                d.line((15,9,21,5,28,7),fill="#969573",width=2)
        if name=="archer":
            d.arc((30,25,48,56),-90,90,fill=WOOD[0],width=4)
            d.arc((30,25,48,56),-90,90,fill=WOOD[3],width=2)
            d.line((39,26,39,55),fill="#d8c796")
            d.line((31,40,47,40),fill=WOOD[3])
        else:
            sy=41 if frame!=3 else 29
            d.line((36,sy,43,sy-23),fill=INK,width=5)
            d.line((36,sy,43,sy-23),fill=IRON[2],width=3)
            d.line((36,sy,42,sy-22),fill=IRON[4])
            d.line((32,sy-1,40,sy+1),fill=GOLD[0],width=3)
            d.line((35,sy+1,34,sy+6),fill=WOOD[1],width=3)
            if name=="skeleton":
                poly(d,[(5,34),(13,33),(18,37),(16,48),(11,53),(4,48),(2,39)],WOOD[2],WOOD[0])
                d.line((9,36,9,49),fill=IRON[1],width=3)
    return im


def enemies():
    for name in ["slime","wolf","goblin","skeleton","archer","spider","golem","guardian"]:
        w,h=(96,112) if name=="guardian" else (48,64)
        atlas,_=canvas(w*4,h)
        for frame in range(4):atlas.alpha_composite(enemy_frame(name,frame),(frame*w,0))
        save(atlas,"enemy_"+name)


def animals():
    for name in ["chicken","sheep"]:
        atlas,_=canvas(128,32)
        for frame in range(4):
            im,d=canvas(32,32)
            b=frame%2
            shadow(d,16,28,11,3)
            if name=="chicken":
                for x in [13,20]:
                    d.line((x,24,x+b-1,28),fill="#9f733e")
                    d.line((x-2,29,x+2,29),fill="#cf9b51")
                poly(d,[(7,22),(4,17),(3,12),(7,14),(11,13),(16,10),(22,13),(24,20),(21,24),(13,25)],"#cfcaac",WOOD[0])
                ellipse(d,(9,14,20,22),"#eee4c0")
                d.line((10,17,17,19),fill="#b3b39a")
                ellipse(d,(18,7+b,26,18+b),"#e1d8b4",WOOD[0])
                poly(d,[(19,8+b),(19,4+b),(22,5+b),(23,3+b),(25,7+b)],"#b4614c",WOOD[0])
                poly(d,[(25,12+b),(30,14+b),(25,16+b)],"#d9ad59",WOOD[0])
                d.point((23,11+b),fill=INK)
            else:
                for x in [9,21]:
                    d.line((x,22,x+(b*2-1),29),fill=WOOD[0],width=3)
                for x,y in [(8,17),(13,13),(20,15),(24,20),(17,23),(9,22)]:
                    ellipse(d,(x-6,y-6,x+6,y+6),"#bbbfa6",WOOD[0])
                    ellipse(d,(x-5,y-5,x+4,y+3),"#dedcc0")
                    d.point((x-2,y-3),fill="#f0e9c9")
                poly(d,[(20,13),(24,11),(29,14),(29,23),(25,25),(21,21)],"#59594b",INK)
                d.line((22,16,18,13),fill=WOOD[1],width=3)
                d.point((26,17),fill="#e4d4a9")
            atlas.alpha_composite(im,(frame*32,0))
        save(atlas,name)
    atlas,_=canvas(64,16)
    for frame in range(4):
        im,d=canvas(16,16)
        wing=4 if frame%2==0 else 2
        for side in [-1,1]:
            poly(d,[(8,8),(8+side*wing,2),(8+side*(wing+2),4),(8+side*(wing+1),9),(8+side*wing,13),(8+side,10)],"#dba75e",WOOD[0])
            d.point((8+side*wing,5),fill="#f6d89b")
        d.line((8,5,8,11),fill=WOOD[0])
        atlas.alpha_composite(im,(frame*16,0))
    save(atlas,"butterfly")


def item_icon(name):
    im,d=canvas(32,32)
    # Consistent subtle ink shadow is part of each icon, not a flat icon tile.
    if name in ["wood","hardwood","ancient_wood"]:
        pal=WOOD if name=="wood" else ["#343a32","#4b5040","#767458","#a1a076","#d1c299"] if name=="hardwood" else ["#343540","#514a5b","#7b6a78","#ae9295","#d1b5b0"]
        for x,y in [(7,12),(12,18),(18,10)]:
            poly(d,[(x-4,y),(x+9,y-5),(x+14,y),(x+14,y+6),(x,y+12),(x-4,y+7)],pal[1],pal[0])
            d.line((x-1,y+2,x+10,y-2),fill=pal[3],width=2)
            ellipse(d,(x-3,y+2,x+5,y+12),pal[3],pal[0])
            ellipse(d,(x-1,y+4,x+3,y+10),pal[1],pal[0])
            d.point((x,y+5),fill=pal[4])
    elif name in ["stone","copper_ore","iron_ore","silver_ore","gold_ore"]:
        poly(d,[(3,23),(5,13),(12,5),(23,7),(29,17),(28,25),(17,29),(6,28)],STONE[1],STONE[0])
        poly(d,[(5,14),(12,6),(22,8),(24,13),(15,20),(8,20)],STONE[2],None)
        d.line((11,8,17,8),fill=STONE[4],width=2)
        d.line((17,21,25,16),fill=STONE[0],width=2)
        if name!="stone":
            pal={"copper_ore":["#724535","#be7a4c","#e6b17a"],"iron_ore":["#30424b","#8aa2a5","#d6ded0"],"silver_ore":["#526778","#b0ced2","#f0f3df"],"gold_ore":[GOLD[0],GOLD[2],GOLD[4]]}[name]
            for x,y in [(11,14),(21,13),(18,24)]:
                poly(d,[(x-3,y),(x-2,y-4),(x+2,y-3),(x+4,y+2),(x,y+3)],pal[1],pal[0])
                d.line((x-1,y-2,x+1,y-2),fill=pal[2],width=2)
    elif name in ["crystal","essence","core"]:
        pal=["#344d61","#5c8aa2","#90c5cb","#ddede0"] if name=="crystal" else ["#4b3b67","#79649e","#b8a1d2","#e1d1ea"]
        if name=="core":
            ellipse(d,(5,5,27,28),pal[0],INK)
            poly(d,[(16,6),(25,16),(17,27),(7,18)],pal[1],pal[0])
            poly(d,[(16,9),(21,16),(17,23),(12,17)],pal[2],pal[0])
            d.line((15,12,17,12),fill=pal[3],width=2)
        elif name=="essence":
            poly(d,[(6,25),(6,18),(12,11),(15,3),(20,9),(19,14),(26,19),(26,25),(21,29),(12,29)],pal[1],pal[0])
            poly(d,[(11,25),(11,20),(17,15),(16,24),(21,22),(20,27)],pal[2],None)
            d.point((13,23),fill=pal[3])
        else:
            for x,y,h in [(9,27,17),(23,27,20),(16,27,25)]:
                poly(d,[(x-5,y-2),(x-5,y-h+5),(x,y-h),(x+5,y-h+5),(x+4,y),(x,y+3)],pal[1],pal[0])
                poly(d,[(x,y-h+1),(x+3,y-h+5),(x+2,y),(x,y+2)],pal[2],None)
                d.line((x,y-h+4,x,y-2),fill=pal[3])
    elif name in ["herb","flower","fiber","berry","mushroom"]:
        spr=Image.open(OUT/(name+".png"))
        im.alpha_composite(spr,(4,4))
        if name=="herb":
            d.line((8,27,23,24),fill=WOOD[1],width=3)
            d.line((11,25,20,28),fill=WOOD[3],width=2)
    elif name in ["fish","cooked_fish"]:
        pal=TEAL if name=="fish" else [WOOD[0],"#83543d","#b98455","#dfb57b","#f1d29b"]
        poly(d,[(7,17),(2,11),(2,24),(8,20),(13,25),(23,23),(30,16),(24,10),(15,10)],pal[2],pal[0])
        poly(d,[(10,16),(16,11),(24,12),(27,15),(20,17)],pal[3],None)
        poly(d,[(15,12),(15,6),(21,11)],pal[1],pal[0])
        d.line((12,22,22,21),fill=pal[4])
        ellipse(d,(23,13,26,16),pal[4],pal[0])
        d.point((25,14),fill=INK)
        if name=="cooked_fish":
            for x in [13,18,23]:d.line((x,14,x-3,19),fill=WOOD[0],width=2)
    elif name=="fang":
        poly(d,[(9,4),(23,4),(25,9),(23,18),(16,25),(6,29),(10,22),(13,13)],"#d4c9a7",WOOD[0])
        poly(d,[(17,7),(22,7),(21,16),(15,22),(11,24),(16,15)],"#f2e4bd",None)
        rect(d,(10,4,23,7),"#9a967d",WOOD[0])
    elif name=="leather":
        poly(d,[(5,5),(11,8),(16,5),(22,7),(28,4),(26,12),(29,18),(25,22),(27,28),(19,26),(14,29),(7,25),(3,27),(6,18),(3,11)],WOOD[2],WOOD[0])
        poly(d,[(9,10),(15,8),(23,10),(24,20),(18,24),(9,21)],WOOD[3],None)
        d.line([(8,7),(11,12),(9,17),(12,23)],fill=WOOD[1])
    elif name=="bone":
        d.line((8,24,23,9),fill=WOOD[0],width=8)
        d.line((8,24,23,9),fill="#d3ceb1",width=5)
        for x,y in [(6,21),(10,25),(21,6),(25,10)]:
            ellipse(d,(x-3,y-3,x+3,y+3),"#d3ceb1",WOOD[0])
            d.point((x-1,y-1),fill="#f0e6c3")
    elif name.endswith("_bar"):
        pal={"copper_bar":["#704536","#aa6a44","#d69d6a","#edc293"],"iron_bar":IRON,"silver_bar":["#526778","#91abb8","#c5d7d8","#f0eee0"],"gold_bar":GOLD}[name]
        poly(d,[(4,15),(11,8),(26,9),(29,22),(21,27),(3,25)],pal[1],pal[0])
        poly(d,[(5,15),(12,9),(25,10),(21,17)],pal[3],pal[0])
        poly(d,[(21,17),(25,10),(28,22),(21,26)],pal[2],pal[0])
        d.line((6,17,19,19),fill=pal[2],width=2)
    elif name in ["wood_sword","copper_sword","iron_sword","ancient_blade","spear","wood_axe","iron_axe","stone_pickaxe","iron_pickaxe","staff"]:
        pal=WOOD if name in ["wood_sword","wood_axe"] else ["#6d4232","#a36843","#d39b6a","#f0c393","#ffdfb0"] if name=="copper_sword" else ["#3d4059","#6c6784","#9da4c1","#d9d8da","#f5efcb"] if name=="ancient_blade" else IRON
        # Diagonal shafts make longer weapons readable at small sizes.
        d.line((7,27,24,6),fill=INK,width=5)
        d.line((7,27,24,6),fill=WOOD[2],width=3)
        d.line((8,26,24,6),fill=WOOD[4])
        if "sword" in name or name=="ancient_blade":
            poly(d,[(12,21),(11,17),(24,3),(28,2),(28,7),(16,22)],pal[2],pal[0])
            d.line((14,18,26,5),fill=pal[4],width=2)
            d.line((8,16,19,24),fill=GOLD[0],width=4)
            d.line((8,15,19,23),fill=GOLD[2],width=2)
            ellipse(d,(4,25,8,29),GOLD[2],GOLD[0])
            if name=="ancient_blade":
                for x,y in [(21,12),(18,15)]:d.point((x,y),fill=TEAL[4])
        elif "axe" in name and "pickaxe" not in name:
            poly(d,[(16,8),(21,4),(26,4),(28,9),(30,14),(26,20),(21,17),(20,12)],pal[2],pal[0])
            poly(d,[(27,9),(29,14),(26,18),(23,16)],pal[3],None)
            d.line((20,6,23,9),fill=pal[3])
        elif "pickaxe" in name:
            poly(d,[(9,6),(17,4),(24,6),(29,12),(29,18),(24,12),(17,9),(10,9),(5,12)],pal[2] if name=="iron_pickaxe" else STONE[2],pal[0])
            d.line((10,6,17,5,24,8),fill=pal[3])
        elif name=="spear":
            poly(d,[(17,10),(20,3),(29,1),(28,10),(21,14)],IRON[2],IRON[0])
            d.line((21,10,27,3),fill=IRON[4])
            d.line((17,11,21,14),fill=GOLD[2],width=2)
        else:
            d.arc((15,0,31,17),-120,170,fill=GOLD[0],width=4)
            d.arc((15,0,31,17),-120,170,fill=GOLD[2],width=2)
            poly(d,[(22,4),(27,8),(24,13),(19,9)],TEAL[3],TEAL[0])
            d.point((22,6),fill=TEAL[4])
    elif name=="hunting_bow":
        d.arc((1,2,28,32),-80,90,fill=WOOD[0],width=5)
        d.arc((1,2,28,32),-80,90,fill=WOOD[3],width=3)
        d.line((15,2,15,30),fill="#ded3a6")
        d.line((4,22,28,6),fill=INK,width=3)
        d.line((4,22,28,6),fill=WOOD[3])
        poly(d,[(24,6),(29,3),(28,9)],IRON[2],IRON[0])
        d.line((3,21,9,21),fill=IRON[3],width=2)
    elif name=="arrow":
        for dx in [-4,1,6]:
            d.line((8+dx,28,23+dx,6),fill=INK,width=3)
            d.line((8+dx,28,23+dx,6),fill=WOOD[3])
            poly(d,[(20+dx,7),(27+dx,2),(25+dx,10)],IRON[2],IRON[0])
            poly(d,[(6+dx,22),(10+dx,23),(10+dx,28),(6+dx,30)],"#c4bd99",INK)
    elif name in ["wood_shield","iron_shield"]:
        pal=WOOD if name=="wood_shield" else IRON
        poly(d,[(5,7),(16,2),(28,7),(26,21),(21,27),(16,30),(9,25),(5,18)],pal[1],pal[0],2)
        poly(d,[(8,9),(16,5),(24,9),(23,20),(16,26),(9,20)],pal[2],pal[0])
        d.line((16,6,16,26),fill=pal[3],width=2)
        if name=="wood_shield":
            for x in [11,21]:d.line((x,8,x,23),fill=pal[0])
        ellipse(d,(11,10,22,21),IRON[1],IRON[0])
        ellipse(d,(14,12,20,18),IRON[2])
        d.point((16,13),fill=IRON[4])
        for x,y in [(8,9),(24,9),(10,21),(22,21)]:d.point((x,y),fill=pal[4])
    elif name=="iron_helmet":
        poly(d,[(5,24),(5,12),(10,5),(17,3),(25,8),(28,17),(27,27),(21,26),(21,16),(12,16),(12,27)],IRON[1],IRON[0])
        poly(d,[(9,12),(12,6),(17,5),(17,14),(9,14)],IRON[2],None)
        d.line((18,5,18,16),fill=IRON[4],width=2)
        d.line((8,16,25,16),fill=IRON[0],width=2)
        rect(d,(7,17,10,23),IRON[3])
        rect(d,(23,17,25,23),IRON[2])
    elif name=="iron_chest":
        poly(d,[(9,4),(15,8),(21,4),(28,9),(28,18),(24,17),(25,27),(21,30),(10,28),(8,17),(4,19),(3,10)],IRON[1],IRON[0])
        poly(d,[(10,8),(15,11),(15,24),(10,23)],IRON[2],None)
        poly(d,[(17,11),(21,8),(23,12),(22,23),(17,25)],IRON[2],None)
        d.line((11,10,14,12),fill=IRON[4],width=2)
        rect(d,(8,24,24,27),IRON[0])
        rect(d,(14,24,18,27),GOLD[2],GOLD[0])
    elif name=="iron_legs":
        poly(d,[(7,4),(25,4),(26,13),(24,28),(17,29),(16,16),(15,29),(7,29),(5,13)],IRON[1],IRON[0])
        rect(d,(8,7,14,21),IRON[2])
        rect(d,(18,7,23,21),IRON[2])
        for x in [7,18]:
            rect(d,(x,20,x+6,24),IRON[0])
            d.line((x+1,21,x+5,21),fill=IRON[3])
        rect(d,(7,4,25,7),WOOD[0])
        rect(d,(14,4,18,7),GOLD[2],GOLD[0])
    elif name=="leather_boots":
        for x,y in [(7,7),(20,4)]:
            poly(d,[(x-3,y),(x+5,y),(x+4,y+13),(x+9,y+17),(x+7,y+21),(x-5,y+21),(x-6,y+17)],WOOD[1],WOOD[0])
            rect(d,(x-2,y+1,x+4,y+4),WOOD[3],WOOD[0])
            d.line((x-3,y+18,x+6,y+18),fill=WOOD[3],width=2)
            for yy in [7,10]:d.line((x,y+yy,x+2,y+yy),fill=GOLD[2])
    elif name=="amulet":
        d.arc((7,1,26,23),0,340,fill=GOLD[0],width=3)
        d.arc((7,1,26,23),0,340,fill=GOLD[3])
        poly(d,[(16,15),(24,22),(16,30),(8,23)],GOLD[2],GOLD[0])
        poly(d,[(16,18),(21,23),(16,27),(11,23)],TEAL[2],TEAL[0])
        d.line((15,20,17,20),fill=TEAL[4],width=2)
    elif name in ["health_potion","energy_potion"]:
        pal=["#703e3e","#ae5c55","#d98978","#f5c3a0"] if name=="health_potion" else ["#355a55","#5b8c74","#9abe91","#dfdfaf"]
        rect(d,(12,4,20,14),"#aec4ac",TEAL[0])
        ellipse(d,(6,12,26,30),"#91a797",TEAL[0])
        ellipse(d,(8,16,24,28),pal[1],pal[0])
        d.line((11,19,11,24),fill=pal[3],width=2)
        rect(d,(11,3,21,7),WOOD[2],WOOD[0])
        d.line((12,4,19,4),fill=WOOD[4])
        if name=="health_potion":
            d.line((14,21,19,21),fill="#ead6aa",width=2)
            d.line((16,19,16,24),fill="#ead6aa",width=2)
        else:
            d.line((19,18,14,22,19,24),fill="#e6e2ae",width=2)
    else:
        # Detailed world structures also supply their own inventory silhouettes.
        path=OUT/(name+".png")
        if path.exists():
            obj=Image.open(path).convert("RGBA")
            bbox=obj.getbbox()
            if bbox: obj=obj.crop(bbox)
            obj.thumbnail((29,28),Image.Resampling.NEAREST)
            im.alpha_composite(obj,((32-obj.width)//2,(32-obj.height)//2))
        else:
            raise ValueError("Missing authored icon: "+name)
    return im


ITEMS = "wood hardwood ancient_wood stone copper_ore iron_ore silver_ore gold_ore crystal herb mushroom flower berry fish fiber fang leather bone essence core copper_bar iron_bar silver_bar gold_bar wood_sword copper_sword iron_sword ancient_blade wood_axe iron_axe stone_pickaxe iron_pickaxe spear hunting_bow staff arrow wood_shield iron_shield iron_helmet iron_chest iron_legs leather_boots amulet health_potion energy_potion cooked_fish workbench furnace forge alchemy carpentry chest fence wall gate torch garden cabin house animal_pen".split()


def previews():
    # Contact sheets are for review and do not add game rendering overhead.
    bg="#243831"
    im=Image.new("RGBA",(1280,1000),bg)
    d=ImageDraw.Draw(im)
    d.text((24,15),"CRONICAS DE FERRO / ORIGINAL PIXEL ART",fill="#d9d3ab")
    xy=[(24,42,"tree_oak"),(136,42,"tree_pine"),(212,42,"tree_birch"),(296,42,"home"),(510,42,"smithy"),(758,42,"tavern"),(1004,42,"market"),(24,282,"house"),(244,282,"cabin"),(434,282,"ruin_arch"),(614,282,"mine_entrance"),(794,282,"bridge"),(946,282,"well")]
    for x,y,name in xy:
        obj=Image.open(OUT/(name+".png"))
        im.alpha_composite(obj,(x,y))
        d.text((x,y+obj.height+4),name,fill="#aab99b")
    for j,name in enumerate(["player","npc_smith","npc_merchant","npc_healer","npc_captain","npc_hunter","npc_villager"]):
        obj=Image.open(OUT/(name+".png")).crop((0,0,48,64)).resize((96,128),Image.Resampling.NEAREST)
        im.alpha_composite(obj,(24+j*114,508))
        d.text((24+j*114,640),name,fill="#aab99b")
    for j,name in enumerate(["slime","wolf","goblin","skeleton","archer","spider","golem","guardian"]):
        w,h=(96,112) if name=="guardian" else (48,64)
        obj=Image.open(OUT/("enemy_"+name+".png")).crop((0,0,w,h))
        if w==48:obj=obj.resize((96,128),Image.Resampling.NEAREST)
        im.alpha_composite(obj,(24+j*144,680))
        d.text((24+j*144,812),name,fill="#aab99b")
    obj=Image.open(OUT/"terrain.png").resize((960,96),Image.Resampling.NEAREST)
    im.alpha_composite(obj,(24,864))
    save(im,"assets-preview")
    icons=Image.new("RGBA",(800,560),bg)
    di=ImageDraw.Draw(icons)
    for j,name in enumerate(ITEMS):
        x=(j%10)*80+8; y=(j//10)*80+8
        icon=Image.open(OUT/"items"/(name+".png")).resize((48,48),Image.Resampling.NEAREST)
        icons.alpha_composite(icon,(x+5,y))
        di.text((x,y+52),name,fill="#c1c8a8")
    save(icons,"items-preview")


def main():
    terrain()
    terrain_edges()
    for name in ["oak","pine","birch"]:tree(name)
    rock("rock")
    for mineral in ["copper","iron","silver","gold"]:rock(mineral+"_ore",mineral)
    crystal()
    for name in ["herb","mushroom","flower","berry","fiber"]:plant(name)
    small_props()
    for name in ["workbench","forge","alchemy","carpentry"]:bench(name)
    furnace()
    for name in ["fence","wall","gate"]:fence_image(name)
    for name,w,h,s in [("home",192,192,0),("cabin",160,160,3),("house",192,192,1),("smithy",224,224,2),("tavern",224,224,0)]:house(name,w,h,s)
    market();well();ruin();mine();bridge();garden();animal_pen()
    persons();enemies();animals()
    for name in ITEMS:item_icon(name).save(OUT/"items"/(name+".png"))
    previews()
    print(f"Generated {len(list(OUT.rglob('*.png')))} original PNG assets in {OUT}")


if __name__=="__main__":
    main()
