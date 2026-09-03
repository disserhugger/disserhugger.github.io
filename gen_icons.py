from PIL import Image, ImageDraw

CELL = 16   # base pixel-art resolution per icon
SCALE = 3   # upscale factor (nearest-neighbor) for crispness
COLS = 8
ROWS = 9    # bumped from 7 -> 9 to fit the new buff/tool icons + headroom
sheet = Image.new("RGBA", (CELL*SCALE*COLS, CELL*SCALE*ROWS), (0,0,0,0))

def canvas():
    return Image.new("RGBA", (CELL, CELL), (0,0,0,0))

def paste(img, col, row):
    big = img.resize((CELL*SCALE, CELL*SCALE), Image.NEAREST)
    sheet.paste(big, (col*CELL*SCALE, row*CELL*SCALE), big)

def outline_fill(d, box, fill, outline=(20,14,32,255)):
    d.rectangle(box, fill=fill, outline=outline)

# ---- primitive icon drawers (16x16, hard pixel edges) ----
def shoe(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([2,9,13,12], fill=c, outline=(20,14,32,255))
    d.rectangle([2,6,7,9], fill=c, outline=(20,14,32,255))
    d.rectangle([11,10,14,12], fill=(20,14,32,255))
    return im

def paw(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([4,7,12,14], fill=c, outline=(20,14,32,255))
    for x in (3,7,11):
        d.ellipse([x,2,x+3,6], fill=c, outline=(20,14,32,255))
    return im

def gem(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,2),(13,7),(8,14),(3,7)], fill=c, outline=(20,14,32,255))
    d.line([(5,7),(11,7)], fill=(255,255,255,140))
    return im

def spiral(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,1,14,14], outline=c, width=2)
    d.ellipse([4,4,11,11], outline=c, width=2)
    d.ellipse([7,7,9,9], fill=c)
    return im

def bolt(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(9,1),(4,9),(7,9),(5,15),(12,6),(9,6)], fill=c, outline=(20,14,32,255))
    return im

def clover(c):
    im=canvas(); d=ImageDraw.Draw(im)
    for dx,dy in [(-3,-3),(3,-3),(-3,3),(3,3)]:
        d.ellipse([8+dx-3,8+dy-3,8+dx+3,8+dy+3], fill=c, outline=(20,14,32,255))
    d.rectangle([7,8,8,14], fill=(90,60,20,255))
    return im

def mitten(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([4,6,12,14], fill=c, outline=(20,14,32,255))
    d.rectangle([2,8,5,11], fill=c, outline=(20,14,32,255))
    d.ellipse([4,2,12,8], fill=c, outline=(20,14,32,255))
    return im

def doublearrow(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([3,7,12,9], fill=c)
    d.polygon([(0,8),(4,4),(4,12)], fill=c)
    d.polygon([(15,8),(11,4),(11,12)], fill=c)
    return im

def chevrons(c):
    im=canvas(); d=ImageDraw.Draw(im)
    for off in (0,5,10):
        d.line([(2,3+off*0.0+2),(8,9+0)], fill=c, width=2)
    d.polygon([(2,3),(8,8),(2,13)], outline=c, width=0)
    d.line([(2,2),(9,8)], fill=c, width=2)
    d.line([(2,8),(9,14)], fill=c, width=2)
    d.line([(6,2),(13,8)], fill=c, width=2)
    d.line([(6,8),(13,14)], fill=c, width=2)
    return im

def hourglass(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(3,2),(13,2),(8,8),(13,14),(3,14),(8,8)], fill=c, outline=(20,14,32,255))
    d.rectangle([3,1,13,2], fill=(20,14,32,255))
    d.rectangle([3,14,13,15], fill=(20,14,32,255))
    return im

def heart(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([2,3,8,9], fill=c, outline=(20,14,32,255))
    d.ellipse([8,3,14,9], fill=c, outline=(20,14,32,255))
    d.polygon([(3,7),(13,7),(8,14)], fill=c, outline=(20,14,32,255))
    return im

def star(c):
    im=canvas(); d=ImageDraw.Draw(im)
    pts=[(8,1),(10,6),(15,6),(11,9),(13,14),(8,11),(3,14),(5,9),(1,6),(6,6)]
    d.polygon(pts, fill=c, outline=(20,14,32,255))
    return im

def shield(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,1),(14,3),(14,8),(8,15),(2,8),(2,3)], fill=c, outline=(20,14,32,255))
    d.line([(8,4),(8,11)], fill=(255,255,255,160), width=2)
    return im

def hook(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.arc([3,3,13,13], start=30, end=330, fill=c, width=3)
    d.rectangle([7,1,9,7], fill=c)
    return im

def cake(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([3,8,13,14], fill=c, outline=(20,14,32,255))
    d.rectangle([3,6,13,8], fill=(255,255,255,180))
    d.rectangle([7,2,9,6], fill=(255,214,102,255))
    d.ellipse([6,1,10,3], fill=(255,120,60,255))
    return im

def coil(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.arc([1,2,7,8], start=270, end=90, fill=c, width=2)
    d.arc([5,2,11,8], start=90, end=270, fill=c, width=2)
    d.arc([9,2,15,8], start=270, end=90, fill=c, width=2)
    d.arc([1,8,7,14], start=90, end=270, fill=c, width=2)
    d.arc([5,8,11,14], start=270, end=90, fill=c, width=2)
    return im

def ring(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([2,6,14,15], outline=c, width=2)
    d.polygon([(8,1),(11,5),(8,8),(5,5)], fill=(127,216,232,255), outline=(20,14,32,255))
    return im

def snowflake(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.line([(8,1),(8,15)], fill=c, width=2)
    d.line([(1,8),(15,8)], fill=c, width=2)
    d.line([(3,3),(13,13)], fill=c, width=2)
    d.line([(13,3),(3,13)], fill=c, width=2)
    return im

def funnel(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(2,2),(14,2),(9,9),(9,14),(7,14),(7,9)], fill=c, outline=(20,14,32,255))
    return im

def horseshoe(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.arc([3,2,13,14], start=0, end=180, fill=c, width=3)
    d.rectangle([2,8,5,13], fill=(255,90,90,255))
    d.rectangle([11,8,14,13], fill=(90,140,255,255))
    return im

def boomerang(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(2,2),(6,2),(9,9),(14,13),(14,15),(11,15),(6,7)], fill=c, outline=(20,14,32,255))
    return im

def net(c):
    im=canvas(); d=ImageDraw.Draw(im)
    for i in range(2,15,4):
        d.line([(i,1),(i,14)], fill=c, width=1)
        d.line([(1,i),(14,i)], fill=c, width=1)
    d.rectangle([0,0,15,15], outline=(20,14,32,255))
    return im

def banana(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.arc([1,1,15,17], start=200, end=340, fill=c, width=3)
    return im

def starburst(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.line([(8,0),(8,15)], fill=c, width=2)
    d.line([(0,8),(15,8)], fill=c, width=2)
    d.line([(2,2),(13,13)], fill=c, width=1)
    d.line([(13,2),(2,13)], fill=c, width=1)
    d.ellipse([6,6,10,10], fill=(255,255,255,220))
    return im

def bell(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,1),(13,10),(3,10)], fill=c, outline=(20,14,32,255))
    d.rectangle([2,10,14,12], fill=c, outline=(20,14,32,255))
    d.ellipse([6,12,10,15], fill=(255,214,102,255))
    return im

def flower(c):
    im=canvas(); d=ImageDraw.Draw(im)
    for dx,dy in [(0,-4),(0,4),(-4,0),(4,0)]:
        d.ellipse([8+dx-3,8+dy-3,8+dx+3,8+dy+3], fill=c, outline=(20,14,32,255))
    d.ellipse([6,6,10,10], fill=(255,214,102,255))
    return im

def cup(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([3,7,11,14], fill=c, outline=(20,14,32,255))
    d.arc([10,8,15,13], start=280, end=80, fill=c, width=2)
    d.line([(5,5),(5,2)], fill=(255,255,255,150))
    d.line([(8,5),(8,1)], fill=(255,255,255,150))
    return im

def orbit(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,1,14,14], outline=c, width=1)
    d.ellipse([6,6,10,10], fill=c, outline=(20,14,32,255))
    d.ellipse([11,2,14,5], fill=(255,214,102,255), outline=(20,14,32,255))
    return im

def confetti(c):
    im=canvas(); d=ImageDraw.Draw(im)
    cols=[c,(255,122,184,255),(127,216,232,255),(245,185,66,255)]
    import random
    random.seed(42)
    for i in range(9):
        x=random.randint(1,12); y=random.randint(1,12)
        col=cols[i%len(cols)]
        d.rectangle([x,y,x+2,y+2], fill=col)
    return im

def box(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([2,4,14,14], fill=c, outline=(20,14,32,255))
    d.rectangle([2,4,14,6], fill=(255,255,255,60))
    d.rectangle([7,4,9,14], fill=(255,214,102,255))
    return im

def cloud(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,6,8,12], fill=c, outline=(20,14,32,255))
    d.ellipse([6,4,14,12], fill=c, outline=(20,14,32,255))
    d.rectangle([3,9,12,13], fill=c, outline=(20,14,32,255))
    d.ellipse([4,1,6,3], fill=(255,255,255,220))
    d.ellipse([10,2,12,4], fill=(255,255,255,220))
    return im

def twocircles(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,4,10,13], outline=c, width=2)
    d.ellipse([6,4,15,13], outline=c, width=2)
    return im

def sock(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([4,1,9,9], fill=c, outline=(20,14,32,255))
    d.polygon([(4,9),(9,9),(13,13),(9,15),(4,15)], fill=c, outline=(20,14,32,255))
    d.rectangle([4,3,9,4], fill=(255,255,255,120))
    return im

def guardshield(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,1),(14,3),(14,8),(8,15),(2,8),(2,3)], fill=c, outline=(20,14,32,255))
    d.ellipse([5,5,8,8], fill=(255,122,184,255))
    d.ellipse([8,5,11,8], fill=(255,122,184,255))
    d.polygon([(5,7),(11,7),(8,12)], fill=(255,122,184,255))
    return im

def syringe(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([6,5,11,10], fill=c, outline=(20,14,32,255))
    d.rectangle([4,3,13,5], fill=c, outline=(20,14,32,255))
    d.line([(3,11),(6,8)], fill=(20,14,32,255), width=2)
    d.line([(1,13),(4,10)], fill=c, width=2)
    d.rectangle([7,1,10,3], fill=(255,255,255,140))
    return im

def anchor_icon(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([6,1,10,5], outline=c, width=2)
    d.rectangle([7,4,9,13], fill=c)
    d.arc([2,7,14,17], start=0, end=180, fill=c, width=2)
    d.rectangle([3,6,13,7], fill=c)
    d.rectangle([2,12,4,14], fill=c)
    d.rectangle([12,12,14,14], fill=c)
    return im

def horn(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(1,6),(9,2),(9,13),(1,10)], fill=c, outline=(20,14,32,255))
    d.ellipse([8,1,15,14], outline=c, width=2)
    d.ellipse([9,3,13,7], fill=(255,214,102,255))
    return im

def vortex(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([0,0,15,15], fill=(20,10,35,255), outline=c)
    d.arc([2,2,13,13], start=0, end=270, fill=c, width=2)
    d.arc([5,5,10,10], start=90, end=360, fill=(255,255,255,200), width=1)
    d.ellipse([6,6,9,9], fill=(20,10,35,255))
    return im

def frozengem(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,1),(14,7),(8,15),(2,7)], fill=c, outline=(20,14,32,255))
    d.line([(8,4),(8,12)], fill=(255,255,255,200), width=1)
    d.line([(5,7),(11,7)], fill=(255,255,255,200), width=1)
    d.line([(6,5),(10,9)], fill=(255,255,255,150), width=1)
    d.line([(10,5),(6,9)], fill=(255,255,255,150), width=1)
    return im

def stormring(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,1,14,14], outline=c, width=2)
    d.polygon([(9,3),(6,9),(8,9),(6,13),(11,7),(9,7)], fill=(255,244,163,255), outline=(20,14,32,255))
    return im

def megaburst(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.line([(8,0),(8,15)], fill=c, width=2)
    d.line([(0,8),(15,8)], fill=c, width=2)
    d.line([(1,1),(14,14)], fill=c, width=2)
    d.line([(14,1),(1,14)], fill=c, width=2)
    d.ellipse([4,4,12,12], fill=(255,214,102,255), outline=(20,14,32,255))
    d.ellipse([6,6,10,10], fill=(255,255,255,230))
    return im

def buddypair(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,1,14,14], outline=c, width=1)
    d.ellipse([5,3,9,7], fill=c, outline=(20,14,32,255))
    d.ellipse([8,9,12,13], fill=(255,122,184,255), outline=(20,14,32,255))
    return im

def luckygem(c):
    im=canvas(); d=ImageDraw.Draw(im)
    for dx,dy in [(-3,-3),(3,-3),(-3,3),(3,3)]:
        d.ellipse([6+dx-2,6+dy-2,6+dx+2,6+dy+2], fill=c, outline=(20,14,32,255))
    d.rectangle([5,7,6,12], fill=(90,60,20,255))
    d.polygon([(12,8),(15,11),(12,14),(9,11)], fill=(255,214,102,255), outline=(20,14,32,255))
    return im

def steamingmug(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([3,8,10,14], fill=c, outline=(20,14,32,255))
    d.arc([9,9,14,13], start=280, end=80, fill=c, width=2)
    d.line([(5,6),(5,3)], fill=(255,255,255,170), width=1)
    d.line([(5,3),(4,1)], fill=(255,255,255,170), width=1)
    d.line([(8,6),(8,3)], fill=(255,255,255,170), width=1)
    d.line([(8,3),(9,1)], fill=(255,255,255,170), width=1)
    return im

def chainlink(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,3,9,10], outline=c, width=2)
    d.ellipse([7,6,15,13], outline=c, width=2)
    return im

def sparkle(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,0),(10,6),(16,8),(10,10),(8,16),(6,10),(0,8),(6,6)], fill=c, outline=(20,14,32,255))
    d.ellipse([3,1,5,3], fill=(255,255,255,200))
    d.ellipse([12,11,14,13], fill=(255,255,255,200))
    return im

def scarf(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([1,5,14,9], fill=c, outline=(20,14,32,255))
    d.rectangle([9,9,13,15], fill=c, outline=(20,14,32,255))
    d.line([(2,6),(13,6)], fill=(255,255,255,120))
    d.line([(2,8),(13,8)], fill=(20,14,32,120))
    return im

def boldheart(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([1,2,8,9], fill=c, outline=(20,14,32,255))
    d.ellipse([8,2,15,9], fill=c, outline=(20,14,32,255))
    d.polygon([(2,7),(14,7),(8,15)], fill=c, outline=(20,14,32,255))
    d.rectangle([7,3,9,10], fill=(255,255,255,200))
    return im

def paperplane(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(1,3),(15,8),(1,13),(5,8)], fill=c, outline=(20,14,32,255))
    d.line([(5,8),(15,8)], fill=(20,14,32,180), width=1)
    return im

def firecracker(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.rectangle([5,6,10,14], fill=c, outline=(20,14,32,255))
    d.rectangle([5,6,10,8], fill=(255,255,255,120))
    d.line([(7,6),(7,2)], fill=(90,60,20,255), width=1)
    d.line([(7,2),(5,0)], fill=(255,214,102,255), width=1)
    d.line([(7,2),(9,0)], fill=(255,90,90,255), width=1)
    d.line([(7,2),(7,0)], fill=(127,216,232,255), width=1)
    return im

def balloon(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([3,1,13,12], fill=c, outline=(20,14,32,255))
    d.ellipse([5,3,8,6], fill=(255,255,255,140))
    d.polygon([(6,12),(10,12),(8,14)], fill=c, outline=(20,14,32,255))
    d.line([(8,14),(8,15)], fill=(20,14,32,255), width=1)
    return im

def feather(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.polygon([(8,0),(13,6),(8,15),(3,6)], fill=c, outline=(20,14,32,255))
    d.line([(8,2),(8,13)], fill=(255,255,255,140), width=1)
    return im

def cupidarrow(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.line([(1,14),(13,2)], fill=c, width=2)
    d.polygon([(11,0),(15,1),(15,5)], fill=c, outline=(20,14,32,255))
    d.line([(1,14),(4,14)], fill=(255,214,102,255), width=1)
    d.line([(1,14),(1,11)], fill=(255,214,102,255), width=1)
    return im

def teslacoil(c):
    im=canvas(); d=ImageDraw.Draw(im)
    for y in (10,12,14):
        d.arc([3,y-2,12,y+2], start=200, end=340, fill=c, width=2)
    d.rectangle([6,2,9,10], fill=(166,138,90,255), outline=(20,14,32,255))
    d.polygon([(7,0),(4,6),(6,6),(3,11),(9,4),(7,4)], fill=(255,244,163,255), outline=(20,14,32,255))
    return im

def timebomb(c):
    im=canvas(); d=ImageDraw.Draw(im)
    d.ellipse([2,5,14,16], fill=c, outline=(20,14,32,255))
    d.ellipse([5,8,8,11], fill=(255,255,255,120))
    d.line([(9,5),(11,1)], fill=(90,60,20,255), width=1)
    d.ellipse([10,0,13,3], fill=(255,214,102,255), outline=(20,14,32,255))
    return im

# ---- id -> (drawer, color) map ----
ICONS = {
  # buffs
  'shoes':        (shoe, (127,216,232,255)),
  'bearhug':      (paw, (245,185,66,255)),
  'amulet':       (gem, (169,112,255,255)),
  'blackhole':    (spiral, (75,22,154,255)),
  'fasthands':    (bolt, (255,214,102,255)),
  'clover':       (clover, (111,227,163,255)),
  'stickyarms':   (mitten, (255,122,184,255)),
  'longarms':     (doublearrow, (127,216,232,255)),
  'turbolegs':    (chevrons, (255,154,66,255)),
  'timepocket':   (hourglass, (245,185,66,255)),
  'magnetheart':  (horseshoe, (255,122,184,255)),
  'doublehug':    (twocircles, (169,112,255,255)),
  'luckysocks':   (sock, (111,227,163,255)),
  'warmhugs':     (heart, (255,92,114,255)),
  'megahug':      (star, (255,209,102,255)),
  'widearms':     (doublearrow, (89,199,214,255)),
  'quicktoss':    (coil, (127,216,232,255)),
  'secondwind':   (cloud, (154,223,255,255)),
  'thickskin':    (shield, (137,158,201,255)),
  'guardianhug':  (guardshield, (255,209,102,255)),
  'adrenaline':   (syringe, (255,92,114,255)),
  # tools
  'hook':         (hook, (245,185,66,255)),
  'cake':         (cake, (255,122,184,255)),
  'rope':         (coil, (166,138,90,255)),
  'ring':         (ring, (169,112,255,255)),
  'gem':          (gem, (127,216,232,255)),
  'snowball':     (snowflake, (154,223,255,255)),
  'vacuum':       (funnel, (169,112,255,255)),
  'magnet':       (horseshoe, (255,90,90,255)),
  'boomerang':    (boomerang, (245,185,66,255)),
  'net':          (net, (166,138,90,255)),
  'banana':       (banana, (249,226,175,255)),
  'teleporter':   (starburst, (169,112,255,255)),
  'alarm':        (bell, (255,209,102,255)),
  'cuddleaura':   (flower, (255,122,184,255)),
  'comfortaura':  (cup, (245,185,66,255)),
  'orbitbuddies': (orbit, (255,214,102,255)),
  'confetti':     (confetti, (255,122,184,255)),
  'staticcling':  (bolt, (137,220,235,255)),
  'heartmissile': (heart, (255,122,184,255)),
  'carepackage':  (box, (245,185,66,255)),
  'glittercloud': (cloud, (201,160,255,255)),
  'anchor':       (anchor_icon, (127,216,232,255)),
  'partyhorn':    (horn, (255,122,184,255)),
  # synergy result tools (fixed icons for the fused items)
  'gravitywell':  (vortex, (169,112,255,255)),
  'cryocore':     (frozengem, (154,223,255,255)),
  'stormcaller':  (stormring, (137,220,235,255)),
  'bigbang':      (megaburst, (255,122,61,255)),
  'bestbuds':     (buddypair, (255,214,102,255)),
  'fortunesfavor':(luckygem, (111,227,163,255)),
  # new buffs
  'warmcocoa':    (steamingmug, (166,110,60,255)),
  'combokeeper':  (chainlink, (255,122,184,255)),
  'goldenaura':   (sparkle, (255,214,102,255)),
  'cozyinsulation':(scarf, (154,223,255,255)),
  'boldhugs':     (boldheart, (255,92,114,255)),
  # new tools
  'airplane':     (paperplane, (127,216,232,255)),
  'firecracker':  (firecracker, (255,122,61,255)),
  'balloon':      (balloon, (255,122,184,255)),
  'duster':       (feather, (245,185,66,255)),
  'cupid':        (cupidarrow, (255,122,184,255)),
  # Chaos Update tools
  'tesla':        (teslacoil, (137,220,235,255)),
  'timebomb':     (timebomb, (255,122,61,255)),
}

order = list(ICONS.keys())
print(len(order), "icons")
mapping = {}
for i, key in enumerate(order):
    col = i % COLS
    row = i // COLS
    drawer, color = ICONS[key]
    icon = drawer(color)
    paste(icon, col, row)
    mapping[key] = (col, row)

import os
ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
sheet.save(os.path.join(ASSETS_DIR, "icons.png"))
print("sheet size:", sheet.size)
import json
print(json.dumps(mapping))

# ---------------------------------------------------------------
# BUDDY companion sprite — replaces the emoji "sticker" previously
# used for Orbit Buddies with an actual pixel-art character that
# matches the player/bayat art style (round blob body, simple
# pixel face, small star-point ears). Drawn at 32x32 then scaled.
# ---------------------------------------------------------------
buddy = Image.new("RGBA", (32,32), (0,0,0,0))
bd = ImageDraw.Draw(buddy)
outline = (20,14,32,255)
body = (255,214,102,255)      # warm gold, matches its existing glow color
belly = (255,236,179,255)
# little star-point "ears"
bd.polygon([(9,9),(12,3),(14,10)], fill=body, outline=outline)
bd.polygon([(23,9),(20,3),(18,10)], fill=body, outline=outline)
# round body
bd.ellipse([5,8,27,28], fill=body, outline=outline)
bd.ellipse([10,14,22,24], fill=belly)
# face
bd.ellipse([11,16,14,19], fill=outline)
bd.ellipse([18,16,21,19], fill=outline)
bd.ellipse([12,17,13,18], fill=(255,255,255,255))
bd.ellipse([19,17,20,18], fill=(255,255,255,255))
bd.arc([12,19,20,24], start=20, end=160, fill=outline, width=1)
# blush
bd.ellipse([8,20,11,22], fill=(255,150,150,140))
bd.ellipse([21,20,24,22], fill=(255,150,150,140))
buddy_big = buddy.resize((32*4,32*4), Image.NEAREST)
buddy_big.save(os.path.join(ASSETS_DIR, "buddy.png"))
print("buddy sprite size:", buddy_big.size)