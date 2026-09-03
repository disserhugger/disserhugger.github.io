from PIL import Image, ImageDraw

def new_canvas(size=32):
    return Image.new("RGBA", (size, size), (0,0,0,0))

def save_scaled(img, path, scale=4):
    w,h = img.size
    big = img.resize((w*scale, h*scale), Image.NEAREST)
    big.save(path)

# ---------- PLAYER ----------
img = new_canvas(32)
d = ImageDraw.Draw(img)

# shadow/outline body (drawn slightly larger, darker)
d.ellipse([4,7,27,29], fill=(43,17,90,255))     # outline violet-deep
d.ellipse([5,7,26,28], fill=(124,58,237,255))   # body base violet
# lighter belly highlight
d.ellipse([9,12,20,24], fill=(169,112,255,255))
# arms (amber, stubby, out to sides - "ready to hug")
d.ellipse([0,15,7,21], fill=(245,183,66,255))
d.ellipse([24,15,31,21], fill=(245,183,66,255))
d.rectangle([0,17,7,20], fill=(245,183,66,255))
d.rectangle([24,17,31,20], fill=(245,183,66,255))
# feet
d.ellipse([8,27,14,31], fill=(28,20,48,255))
d.ellipse([18,27,24,31], fill=(28,20,48,255))
# eyes
d.ellipse([10,15,13,19], fill=(20,14,32,255))
d.ellipse([19,15,22,19], fill=(20,14,32,255))
d.ellipse([11,16,12,17], fill=(255,255,255,255))
d.ellipse([20,16,21,17], fill=(255,255,255,255))
# blush
d.ellipse([8,20,11,22], fill=(255,150,180,140))
d.ellipse([21,20,24,22], fill=(255,150,180,140))
# smile
d.arc([12,18,20,24], start=20, end=160, fill=(20,14,32,255), width=1)

save_scaled(img, "/home/claude/build/assets/player.png", scale=4)

# ---------- BAYAT ----------
img2 = new_canvas(32)
d2 = ImageDraw.Draw(img2)

# outline + body (cream)
d2.ellipse([4,8,27,29], fill=(154,120,55,255))     # outline dark cream
d2.ellipse([5,8,26,28], fill=(245,226,175,255))    # body cream
# belly highlight
d2.ellipse([9,13,20,24], fill=(252,240,210,255))
# running legs (offset stride)
d2.rectangle([9,27,13,32], fill=(154,120,55,255))
d2.rectangle([19,25,23,30], fill=(154,120,55,255))
# tiny arms flailing
d2.ellipse([2,17,7,21], fill=(245,226,175,255))
d2.ellipse([25,14,30,18], fill=(245,226,175,255))
# big scared eyes (white sclera)
d2.ellipse([9,13,15,20], fill=(255,255,255,255))
d2.ellipse([18,13,24,20], fill=(255,255,255,255))
# pupils pushed to corner (looking back = fear)
d2.ellipse([12,15,14,18], fill=(20,14,32,255))
d2.ellipse([21,15,23,18], fill=(20,14,32,255))
# open scared mouth
d2.ellipse([14,21,19,26], fill=(90,40,45,255))
d2.ellipse([15,22,18,25], fill=(40,15,20,255))
# sweat drop
d2.polygon([(24,9),(27,13),(24,16),(21,13)], fill=(120,200,255,220))

save_scaled(img2, "/home/claude/build/assets/bayat.png", scale=4)

print("done")