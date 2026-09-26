/* =========================================================
   ARENA LIFE — makes every arena feel inhabited (see CLAUDE.md
   "Arena Life"). Four layers, all COSMETIC:

   1. Decor + set pieces (generated seeded, so co-op worlds match):
      clustered, idle-animated, and REACTIVE — grass bends away from
      whoever walks through it (you, teammates, Bayats), bushes rustle,
      puddles ripple, snow keeps footprints.
   2. Critters that live around the camera and FLEE — birds take off,
      lizards dart, hares hop away, butterflies scatter.
   3. Weather / air: pollen, fog banks, drips, embers, ash, snow + wind,
      dust devils, cloud shadows, lightning, aurora.
   4. Light: stepped (octagon-ring, pixel-style) glows from candles,
      crystals, lava, wisps — additive, so it spills onto Bayats too.

   Rules it follows: pixel art only (fillRect, no emoji), animation is
   stepped (integer-pixel offsets, frame counters — never smooth
   easing), everything is culled to the camera, weather density is per
   WORLD area (so a zoomed-out phone and a 4K board look alike), and no
   gameplay code reads any of it. The only decor that matters to
   gameplay is still the breakable kinds (rock/crystal, see
   Game.updateDestructibles) and the Bouncer Nasser's decorAhead() —
   both read Game.decor exactly as before.
   ========================================================= */

const LIFE_CELL = 400; // decor culling bucket (world px)
const LIFE_CHUNK = 512; // baked floor + static-decor chunk (world px)

// Stepped light sprite: concentric octagon rings — reads as pixel-art
// light, not a smooth airbrushed gradient. Baked once per colour/size.
const LightCache = {
  map: new Map(),
  get(color, r) {
    r = Math.max(8, Math.round(r / 4) * 4);
    const key = color + "|" + r;
    let c = this.map.get(key);
    if (c) return c;
    if (this.map.size > 80) this.map.clear();
    c = document.createElement("canvas");
    c.width = c.height = r * 2;
    const g = c.getContext("2d");
    g.fillStyle = color;
    // 7 rings, each only a little brighter than the last: still visibly
    // STEPPED (pixel-style), but the outer edge is too faint to read as
    // a box. (4 strong rings looked like a purple stop sign.)
    const rings = 7;
    for (let i = 0; i < rings; i++) {
      const rr = Math.round((r * (1 - i / rings)) / 2) * 2;
      const k = Math.round(rr * 0.41);
      g.globalAlpha = 0.03 + i * 0.022;
      g.beginPath();
      g.moveTo(r - rr + k, r - rr);
      g.lineTo(r + rr - k, r - rr);
      g.lineTo(r + rr, r - rr + k);
      g.lineTo(r + rr, r + rr - k);
      g.lineTo(r + rr - k, r + rr);
      g.lineTo(r - rr + k, r + rr);
      g.lineTo(r - rr, r + rr - k);
      g.lineTo(r - rr, r - rr + k);
      g.closePath();
      g.fill();
    }
    this.map.set(key, c);
    return c;
  },
};

/* A baked, stepped glow drawn additively at (x, y) in the current
   transform — the replacement for live ctx.shadowBlur on chests, pickups
   and orbit buddies. shadowBlur re-rasterises a blur on EVERY draw call
   (every fillRect of a chest paid for its own blur); this is one image. */
function drawGlow(ctx, x, y, color, r, a) {
  const img = LightCache.get(color, r);
  const h = img.width / 2;
  const op = ctx.globalCompositeOperation,
    ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a;
  ctx.drawImage(img, x - h, y - h);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = ga;
}

// Cheap deterministic hash → [0,1). Used for stepped twinkles so a
// shimmer spot is stable within a frame-step and jumps on the next.
function lifeHash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---------------- generation (runs inside withSeededRandom) ---------------- */

// A blocky organic blob: a core rect plus a few offset rects. Used for
// water / lava / ice. `rects` are relative to the piece's centre.
function lifeBlob(w, h) {
  const rects = [{ x: -w / 2, y: -h / 2, w, h }];
  const n = randInt(3, 5);
  for (let i = 0; i < n; i++) {
    const bw = w * rand(0.45, 0.75),
      bh = h * rand(0.45, 0.75);
    const a = rand(0, TAU);
    rects.push({
      x: Math.cos(a) * w * 0.32 - bw / 2,
      y: Math.sin(a) * h * 0.32 - bh / 2,
      w: bw,
      h: bh,
    });
  }
  for (const r of rects) {
    r.x = Math.round(r.x / 4) * 4;
    r.y = Math.round(r.y / 4) * 4;
    r.w = Math.round(r.w / 4) * 4;
    r.h = Math.round(r.h / 4) * 4;
  }
  return rects;
}
const SET_PIECE_DEFS = {
  pond: { blob: [150, 100], liquid: "water", r: 110 },
  pool: { blob: [170, 110], liquid: "water", r: 120 },
  lavapool: { blob: [150, 96], liquid: "lava", r: 110 },
  icelake: { blob: [240, 150], liquid: "ice", r: 160 },
  tree: { r: 70, canopy: 64 },
  pine: { r: 60, canopy: 52 },
  mausoleum: { r: 80 },
  opengrave: { r: 44 },
  geode: { r: 70 },
  spire: { r: 50 },
  statue: { r: 60 },
};
function pointInBlob(sp, x, y, pad) {
  if (!sp.rects) return dist2(x, y, sp.x, sp.y) < (sp.r + pad) * (sp.r + pad) * 0.35;
  const lx = x - sp.x,
    ly = y - sp.y;
  for (const r of sp.rects) {
    if (lx > r.x - pad && lx < r.x + r.w + pad && ly > r.y - pad && ly < r.y + r.h + pad) return true;
  }
  return false;
}

/* Returns {decor, setPieces}. `decor` is Game.decor (breakables first,
   then clustered decoration) — its INDICES are what co-op decorBreak
   sends, which is only safe because this runs seeded on every client. */
function generateArenaWorld(arena) {
  const life = (arena && arena.life) || {};
  const cfg = CONFIG.arenaLife;
  const W = CONFIG.arena.width,
    H = CONFIG.arena.height;
  const cx = W / 2,
    cy = H / 2;
  const colors = life.colors || {};
  const palette = (arena && arena.decorPalette) || ["#3a3055", "#4a3f6b", "#2f2648"];
  // ---- set pieces ----
  const setPieces = [];
  const spKinds = (life.setPieces || []).map(([item, weight]) => ({ item, weight }));
  for (let tries = 0; spKinds.length && setPieces.length < cfg.setPieces && tries < 400; tries++) {
    const kind = weightedPick(spKinds);
    const def = SET_PIECE_DEFS[kind];
    const x = rand(300, W - 300),
      y = rand(300, H - 300);
    // liquids keep well clear of the spawn; trees/statues can be closer
    if (dist(x, y, cx, cy) < (def.blob ? 520 : 320)) continue;
    if (setPieces.some((o) => dist(x, y, o.x, o.y) < o.r + def.r + 260)) continue;
    const sp = { kind, x, y, r: def.r, seed: Math.random() };
    if (def.blob) {
      const s = rand(0.8, 1.25);
      sp.rects = lifeBlob(def.blob[0] * s, def.blob[1] * s);
      sp.liquid = def.liquid;
      sp.r = def.r * s;
      // extras: lilypads / cracks / bubbles positions (seeded so they match)
      sp.dots = [];
      for (let i = 0; i < 6; i++) {
        const r0 = sp.rects[0];
        sp.dots.push({ x: r0.x + rand(0.15, 0.85) * r0.w, y: r0.y + rand(0.15, 0.85) * r0.h, s: Math.random() });
      }
    }
    if (def.canopy) sp.canopy = def.canopy * rand(0.85, 1.2);
    setPieces.push(sp);
  }
  const blocked = (x, y, pad) => {
    for (const sp of setPieces) if (pointInBlob(sp, x, y, pad)) return true;
    return false;
  };
  const decor = [];
  // ---- breakables first (same rules as the old decor: away from spawn) ----
  const breakKinds = life.breakKinds || [];
  for (let i = 0, tries = 0; breakKinds.length && i < (life.breakables || 0) && tries < 2000; tries++) {
    const x = rand(120, W - 120),
      y = rand(120, H - 120);
    if (dist(x, y, cx, cy) < 300 || blocked(x, y, 20)) continue;
    decor.push({ x, y, kind: choice(breakKinds), c: choice(palette), seed: Math.random() });
    i++;
  }
  // ---- clustered decoration ----
  const kinds = (life.decor || [["grass", 1]]).map(([item, weight]) => ({ item, weight }));
  let placed = 0;
  for (let tries = 0; placed < cfg.decorCount && tries < cfg.decorCount * 6; tries++) {
    const kind = weightedPick(kinds);
    const ccx = rand(100, W - 100),
      ccy = rand(100, H - 100);
    if (dist(ccx, ccy, cx, cy) < 70) continue; // the spawn shouldn't look bare
    const n = kind === "grass" || kind === "deadgrass" || kind === "flower" ? randInt(4, 9) : randInt(1, 3);
    for (let k = 0; k < n && placed < cfg.decorCount; k++) {
      const x = ccx + rand(-60, 60),
        y = ccy + rand(-40, 40);
      // 30px pad: decor is drawn scaled and tall props stand ABOVE their
      // foot point, so a tighter pad let cacti "stand in" the lava
      if (x < 60 || y < 60 || x > W - 60 || y > H - 60 || blocked(x, y, 30)) continue;
      const pal = colors[kind === "flower" ? "flower" : kind === "bush" ? "bush" : /grass|shrub/.test(kind) ? "grass" : "stone"];
      decor.push({ x, y, kind, c: pal ? choice(pal) : choice(palette), seed: Math.random() });
      placed++;
    }
  }
  return { decor, setPieces };
}

// Static ground cover baked into each floor tile (a couple of grass
// blades, pebbles, snow specks) plus two "dither" specks of another tile
// colour so the 64px grid stops reading as a checkerboard. Runs seeded.
function decorateFloorTiles(floor, arena) {
  const life = (arena && arena.life) || {};
  const cover = life.cover || [];
  const chance = life.coverChance || 0;
  const tileColors = ((arena && arena.floorTiles) || []).map((t) => t.color);
  for (const row of floor.grid) {
    for (const t of row) {
      const marks = [];
      if (tileColors.length > 1) {
        for (let i = 0; i < 2; i++) {
          marks.push({ k: "dither", x: randInt(0, 15) * 4, y: randInt(0, 15) * 4, c: choice(tileColors) });
        }
      }
      if (cover.length && Math.random() < chance) {
        const n = randInt(1, 3);
        for (let i = 0; i < n; i++) marks.push({ k: choice(cover), x: randInt(2, 14) * 4, y: randInt(2, 14) * 4 });
      }
      t.marks = marks;
    }
  }
}
function drawFloorMarks(ctx, x, y, marks, coverColor) {
  for (const m of marks) {
    const mx = x + m.x,
      my = y + m.y;
    if (m.k === "dither") {
      ctx.fillStyle = m.c;
      ctx.fillRect(mx, my, 4, 4);
      continue;
    }
    ctx.fillStyle = coverColor;
    if (m.k === "blade") {
      ctx.fillRect(mx, my, 2, 5);
      ctx.fillRect(mx + 3, my + 1, 2, 4);
    } else if (m.k === "pebble") {
      ctx.fillRect(mx, my, 4, 3);
    } else if (m.k === "speck") {
      ctx.fillRect(mx, my, 2, 2);
    } else if (m.k === "snow") {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(mx, my, 3, 2);
      ctx.fillRect(mx + 5, my + 2, 2, 2);
      ctx.globalAlpha = 1;
    } else if (m.k === "ash") {
      ctx.globalAlpha = 0.6;
      ctx.fillRect(mx, my, 3, 3);
      ctx.globalAlpha = 1;
    } else if (m.k === "crack") {
      ctx.fillRect(mx, my, 6, 2);
      ctx.fillRect(mx + 5, my + 2, 2, 5);
    }
  }
}

/* ---------------- decor drawing ----------------
   Each entry draws with the context already translated to the decor's
   foot point. `L` is ArenaLife (t = seconds, f12 = stepped frame
   counter, sway() = integer-px wind sway + the bend from movers).
   react: "bend" (grass-like, leans away from movers), "rustle" (shakes
   + drops a few leaves when something walks in), "part" (fog thins). */
const LIFE_DECOR = {
  grass: {
    react: "bend",
    sprite: true, // cached per pose — see ArenaLife.decorSprite
    draw(g, d, L) {
      const s = L.sway(d, 1.4);
      const h = 7 + Math.floor(d.seed * 6);
      g.fillStyle = d.c;
      for (let i = 0; i < 4; i++) {
        const bx = -6 + i * 4,
          bh = h - ((i * 3 + Math.floor(d.seed * 7)) % 4);
        g.fillRect(bx, -bh / 2, 2, bh / 2);
        g.fillRect(bx + s, -bh, 2, bh / 2);
      }
    },
  },
  deadgrass: {
    react: "bend",
    sprite: true, // cached per pose — see ArenaLife.decorSprite
    draw(g, d, L) {
      const s = L.sway(d, 1);
      g.fillStyle = d.c;
      g.fillRect(-5, -4, 2, 4);
      g.fillRect(-5 + s, -8, 2, 4);
      g.fillRect(-1, -5, 2, 5);
      g.fillRect(-1 + s, -10, 2, 5);
      g.fillRect(3, -3, 2, 3);
      g.fillRect(3 + s, -6, 2, 3);
    },
  },
  flower: {
    react: "bend",
    sprite: true, // cached per pose — see ArenaLife.decorSprite
    draw(g, d, L) {
      const s = L.sway(d, 1.6);
      const cols = L.colors.flower || ["#ff7ab8"];
      g.fillStyle = "#3d6b35";
      g.fillRect(-1, -6, 2, 6);
      g.fillRect(-1 + Math.round(s / 2), -11, 2, 5);
      g.fillRect(1, -5, 3, 2); // leaf
      const hx = s,
        hy = -15;
      g.fillStyle = cols[Math.floor(d.seed * cols.length)];
      g.fillRect(hx - 4, hy, 3, 3);
      g.fillRect(hx + 1, hy, 3, 3);
      g.fillRect(hx - 1, hy - 3, 3, 3);
      g.fillRect(hx - 1, hy + 3, 3, 3);
      g.fillStyle = "#ffd166";
      g.fillRect(hx - 1, hy, 2, 3);
    },
  },
  bush: {
    react: "rustle",
    sprite: true,
    shakes: true,
    draw(g, d, L) {
      const sh = L.shake(d);
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(-14, 2, 28, 4);
      g.fillStyle = d.c;
      g.fillRect(-14 + sh, -8, 28, 11);
      g.fillRect(-10 + sh, -14, 20, 8);
      g.fillRect(-4 + sh, -18, 10, 5);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(-8 + sh, -13, 8, 3);
      g.fillRect(2 + sh, -16, 4, 2);
      if (d.seed > 0.55) {
        g.fillStyle = "#ff5c72";
        g.fillRect(-6 + sh, -6, 3, 3);
        g.fillRect(5 + sh, -9, 3, 3);
        g.fillRect(0 + sh, -3, 3, 3);
      }
    },
  },
  mushroom: {
    static: true,
    draw(g, d) {
      g.fillStyle = "#e9dcc0";
      g.fillRect(-2, -6, 4, 6);
      g.fillStyle = d.seed > 0.5 ? "#d9534f" : "#c98a3a";
      g.fillRect(-7, -11, 14, 5);
      g.fillRect(-5, -13, 10, 2);
      g.fillStyle = "#fff4e0";
      g.fillRect(-4, -10, 2, 2);
      g.fillRect(2, -12, 2, 2);
    },
  },
  stump: {
    static: true,
    draw(g) {
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(-12, 2, 24, 4);
      g.fillStyle = "#5a3d24";
      g.fillRect(-10, -8, 20, 10);
      g.fillStyle = "#8a6440";
      g.fillRect(-9, -11, 18, 4);
      g.fillStyle = "#5a3d24";
      g.fillRect(-4, -10, 8, 2);
    },
  },
  rock: {
    static: true,
    draw(g, d) {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(-14, 4, 28, 4);
      g.fillStyle = d.c;
      g.fillRect(-13, -7, 26, 12);
      g.fillRect(-9, -12, 18, 5);
      g.fillStyle = "rgba(255,255,255,0.16)";
      g.fillRect(-9, -11, 9, 3);
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(-13, 2, 26, 3);
    },
  },
  crystal: {
    light: (d, L) => ["#7fd8e8", 34, 0.55 + 0.25 * L.pulse(d, 1.3)],
    draw(g, d, L) {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(-9, 6, 18, 3);
      L.diamond(g, 0, -4, 8, 13, "#5fb8cc");
      L.diamond(g, -1, -5, 5, 9, "#9be6f2");
      if (L.glint(d, 2.6)) {
        g.fillStyle = "#ffffff";
        g.fillRect(-2, -12, 2, 2);
        g.fillRect(-3, -11, 4, 1);
      }
    },
  },
  shard: {
    light: (d, L) => [d.seed > 0.5 ? "#a970ff" : "#7fd8e8", 30, 0.45 + 0.25 * L.pulse(d, 0.9)],
    draw(g, d, L) {
      const c = d.seed > 0.5 ? "#8a5fd6" : "#4fa9c0";
      L.diamond(g, -6, -6, 4, 10, c);
      L.diamond(g, 3, -9, 5, 14, c);
      L.diamond(g, 3, -10, 3, 9, "rgba(255,255,255,0.35)");
    },
  },
  tombstone: {
    static: true,
    draw(g, d) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-11, 2, 22, 4);
      g.fillStyle = d.c;
      const v = Math.floor(d.seed * 3);
      if (v === 0) {
        g.fillRect(-8, -18, 16, 20);
        g.fillRect(-6, -21, 12, 3);
        g.fillRect(-3, -23, 6, 2);
      } else if (v === 1) {
        g.fillRect(-2, -24, 4, 26);
        g.fillRect(-8, -18, 16, 4);
      } else {
        g.fillRect(-8, -14, 16, 16);
        g.fillRect(-8, -18, 9, 4); // broken top
      }
      g.fillStyle = "rgba(0,0,0,0.25)";
      if (v !== 1) g.fillRect(-4, -12, 8, 2);
      g.fillStyle = "#4f6b3a"; // moss
      g.fillRect(-8, -2, 5, 3);
    },
  },
  deadtree: {
    draw(g, d, L) {
      const s = Math.round(Math.sin(L.t * 0.8 + d.seed * 7));
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-10, 2, 20, 3);
      g.fillStyle = d.c;
      g.fillRect(-2, -26, 4, 28);
      g.fillRect(-10 + s, -24, 8, 3);
      g.fillRect(-12 + s, -30, 3, 7);
      g.fillRect(2 + s, -32, 3, 8);
      g.fillRect(4 + s, -34, 8, 3);
      g.fillRect(-6 + s, -36, 3, 6);
    },
  },
  candle: {
    light: (d, L) => ["#ffb347", 44, 0.55 + 0.35 * L.flicker(d)],
    draw(g, d, L) {
      g.fillStyle = "#e9dcc0";
      g.fillRect(-2, -8, 4, 8);
      g.fillStyle = "#c8b890";
      g.fillRect(-2, -1, 4, 1);
      const fl = L.flicker(d) > 0.5 ? 1 : 0;
      g.fillStyle = "#ffd166";
      g.fillRect(-1, -12 - fl, 2, 4 + fl);
      g.fillStyle = "#fff4c0";
      g.fillRect(-1, -10, 2, 2);
    },
  },
  lantern: {
    light: (d, L) => ["#ffb347", 70, 0.5 + 0.2 * L.flicker(d)],
    lightY: -22,
    draw(g, d, L) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-6, 2, 12, 3);
      g.fillStyle = "#2a2833";
      g.fillRect(-1, -30, 3, 32);
      g.fillRect(-1, -30, 8, 2);
      g.fillRect(4, -30, 2, 4);
      g.fillStyle = "#1a1820";
      g.fillRect(1, -26, 8, 9);
      g.fillStyle = L.flicker(d) > 0.3 ? "#ffd166" : "#e0a040";
      g.fillRect(3, -24, 4, 5);
    },
  },
  bones: {
    static: true,
    draw(g) {
      g.fillStyle = "#d8d2c0";
      g.fillRect(-7, -2, 10, 2);
      g.fillRect(-8, -3, 2, 4);
      g.fillRect(2, -3, 2, 4);
      g.fillRect(-2, 1, 8, 2);
    },
  },
  skull: {
    static: true,
    draw(g) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-7, 2, 14, 3);
      g.fillStyle = "#d8d2c0";
      g.fillRect(-6, -10, 12, 9);
      g.fillRect(-4, -1, 8, 3);
      g.fillStyle = "#1a0e08";
      g.fillRect(-4, -7, 3, 3);
      g.fillRect(1, -7, 3, 3);
      g.fillRect(-1, -2, 2, 2);
    },
  },
  fogpuff: {
    react: "part",
    draw(g, d, L) {
      const dx = Math.round(Math.sin(L.t * 0.3 + d.seed * 10) * 6);
      const a = 0.16 * (1 - (d.part || 0) * 0.8);
      g.fillStyle = "#c7c7d8";
      g.globalAlpha = a * 0.7;
      g.fillRect(-46 + dx, -4, 92, 8);
      g.fillRect(-36 + dx, -9, 30, 6);
      g.fillRect(8 + dx, -10, 26, 7);
      g.globalAlpha = a;
      g.fillRect(-28 + dx, -10, 24, 14);
      g.fillRect(-8 + dx, -15, 22, 18);
      g.fillRect(12 + dx, -8, 18, 11);
      g.globalAlpha = 1;
    },
  },
  fence: {
    static: true,
    draw(g) {
      g.fillStyle = "#1f1d26";
      for (let i = 0; i < 5; i++) {
        g.fillRect(-16 + i * 8, -18, 2, 20);
        g.fillRect(-17 + i * 8, -21, 4, 3);
      }
      g.fillRect(-16, -14, 34, 2);
      g.fillRect(-16, -5, 34, 2);
    },
  },
  glowshroom: {
    light: (d, L) => [d.seed > 0.5 ? "#6fe3a3" : "#7fd8e8", 36, 0.4 + 0.35 * L.pulse(d, 0.7)],
    draw(g, d, L) {
      const c = d.seed > 0.5 ? "#6fe3a3" : "#7fd8e8";
      g.fillStyle = "#b9c6d8";
      g.fillRect(-1, -6, 3, 6);
      g.fillRect(6, -4, 2, 4);
      g.fillStyle = c;
      g.globalAlpha = 0.7 + 0.3 * L.pulse(d, 0.7);
      g.fillRect(-5, -10, 11, 4);
      g.fillRect(-3, -12, 7, 2);
      g.fillRect(4, -7, 6, 3);
      g.globalAlpha = 1;
    },
  },
  stalagmite: {
    static: true,
    draw(g, d) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-10, 2, 20, 3);
      g.fillStyle = d.c;
      g.fillRect(-8, -6, 16, 8);
      g.fillRect(-6, -14, 12, 8);
      g.fillRect(-4, -22, 8, 8);
      g.fillRect(-2, -28, 4, 6);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(-4, -20, 2, 14);
    },
  },
  puddle: {
    liquid: true,
    draw(g, d, L) {
      g.fillStyle = "#0b1a26";
      g.fillRect(-14, -4, 28, 8);
      g.fillRect(-10, -6, 20, 12);
      g.fillStyle = "#1c3a4f";
      g.fillRect(-10, -3, 20, 5);
      if (L.glint(d, 3.2)) {
        g.fillStyle = "#7fd8e8";
        g.fillRect(-4, -2, 6, 1);
      }
    },
  },
  pebbles: {
    static: true,
    draw(g, d) {
      g.fillStyle = d.c;
      g.fillRect(-6, -2, 5, 4);
      g.fillRect(1, 0, 4, 3);
      g.fillRect(-2, -5, 3, 3);
    },
  },
  charredtree: {
    draw(g, d, L) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-10, 2, 20, 3);
      g.fillStyle = "#1a100b";
      g.fillRect(-3, -30, 5, 32);
      g.fillRect(-11, -26, 9, 3);
      g.fillRect(-12, -32, 3, 7);
      g.fillRect(2, -22, 9, 3);
      g.fillRect(9, -28, 3, 7);
      if (L.flicker(d) > 0.6) {
        g.fillStyle = "#ff7a3d";
        g.fillRect(-12, -33, 2, 2);
        g.fillRect(10, -29, 2, 2);
      }
    },
  },
  deadcactus: {
    static: true,
    draw(g) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-9, 2, 18, 3);
      g.fillStyle = "#5e5238";
      g.fillRect(-3, -24, 6, 26);
      g.fillRect(-10, -16, 7, 3);
      g.fillRect(-10, -22, 3, 7);
      g.fillRect(3, -12, 7, 3);
      g.fillRect(7, -18, 3, 7);
      g.fillStyle = "rgba(255,255,255,0.1)";
      g.fillRect(-2, -22, 2, 20);
    },
  },
  smokevent: {
    light: (d, L) => ["#ff7a3d", 36, 0.35 + 0.25 * L.pulse(d, 1.1)],
    vent: true,
    draw(g, d, L) {
      g.fillStyle = "#140a06";
      g.fillRect(-10, -4, 20, 8);
      g.fillRect(-6, -6, 12, 12);
      g.fillStyle = "#ff6a2e";
      g.globalAlpha = 0.5 + 0.4 * L.pulse(d, 1.1);
      g.fillRect(-5, -2, 10, 4);
      g.globalAlpha = 1;
    },
  },
  lavacrack: {
    light: (d, L) => ["#ff6a2e", 40, 0.35 + 0.3 * L.pulse(d, 0.6)],
    draw(g, d, L) {
      g.fillStyle = "#1a0b06";
      g.fillRect(-18, -2, 14, 4);
      g.fillRect(-6, -6, 4, 8);
      g.fillRect(-4, -6, 14, 4);
      g.fillRect(8, -2, 12, 4);
      g.fillStyle = L.pulse(d, 0.6) > 0.5 ? "#ffb347" : "#ff6a2e";
      g.fillRect(-16, -1, 10, 2);
      g.fillRect(-5, -5, 2, 6);
      g.fillRect(-3, -5, 11, 2);
      g.fillRect(9, -1, 9, 2);
    },
  },
  ember: {
    light: (d, L) => ["#ff9d4d", 26, 0.4 + 0.3 * L.pulse(d, 1.6)],
    draw(g, d, L) {
      g.fillStyle = "#2a1510";
      g.fillRect(-5, -2, 10, 4);
      g.fillStyle = L.pulse(d, 1.6) > 0.5 ? "#ffb347" : "#ff7a3d";
      g.fillRect(-3, -2, 3, 3);
      g.fillRect(1, -1, 3, 2);
    },
  },
  icecrystal: {
    light: (d, L) => ["#bfe9ff", 28, 0.3 + 0.2 * L.pulse(d, 1)],
    draw(g, d, L) {
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(-8, 6, 16, 3);
      L.diamond(g, 0, -6, 6, 16, "#8fc9e6");
      L.diamond(g, -1, -7, 3, 11, "#e2f6ff");
      if (L.glint(d, 2.2)) {
        g.fillStyle = "#ffffff";
        g.fillRect(-1, -18, 2, 4);
        g.fillRect(-3, -16, 6, 1);
      }
    },
  },
  snowdrift: {
    static: true,
    draw(g) {
      g.fillStyle = "#8fb4cc";
      g.fillRect(-20, -2, 40, 5);
      g.fillStyle = "#d8ecf7";
      g.fillRect(-18, -6, 36, 6);
      g.fillRect(-10, -9, 22, 4);
      g.fillStyle = "#ffffff";
      g.fillRect(-8, -9, 10, 2);
    },
  },
  frozenshrub: {
    react: "bend",
    sprite: true, // cached per pose — see ArenaLife.decorSprite
    draw(g, d, L) {
      const s = L.sway(d, 1);
      g.fillStyle = "#8fb4cc";
      g.fillRect(-10, -2, 20, 4);
      g.fillStyle = "#d8ecf7";
      g.fillRect(-8, -4, 16, 3);
      g.fillStyle = "#4a6f88";
      g.fillRect(-2, -10, 3, 7);
      g.fillRect(-7, -9, 6, 2);
      g.fillRect(2, -8, 6, 2);
      g.fillRect(-9 + s, -15, 3, 7);
      g.fillRect(6 + s, -13, 3, 6);
      g.fillRect(-2 + s, -18, 3, 8);
      g.fillRect(-6 + s, -18, 5, 2);
      g.fillRect(1 + s, -20, 5, 2);
      g.fillStyle = "#e2f6ff"; // frost on the tips
      g.fillRect(-10 + s, -16, 5, 2);
      g.fillRect(5 + s, -14, 5, 2);
      g.fillRect(-3 + s, -20, 5, 2);
      g.fillRect(-7 + s, -19, 3, 1);
      g.fillStyle = "#9adfff";
      g.fillRect(3 + s, -21, 2, 2);
    },
  },
  brokenpillar: {
    static: true,
    draw(g, d) {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(-13, 2, 26, 4);
      g.fillStyle = d.c;
      g.fillRect(-12, -4, 24, 6);
      g.fillRect(-8, -22, 16, 18);
      g.fillRect(-8, -26, 9, 4);
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(-4, -22, 2, 18);
      g.fillRect(3, -22, 2, 18);
      g.fillStyle = "#e2f6ff";
      g.fillRect(-9, -27, 11, 3);
      g.fillRect(-13, -5, 8, 2);
    },
  },
};

/* ---------------- set pieces ----------------
   ground(g, sp, L) draws at ground level (under entities); overhead(...)
   (trees) draws ABOVE entities and fades while you stand under it. */
const LIQUID_COLORS = {
  water: (L) => {
    const w = L.colors.water || ["#17304a", "#1f4466", "#2f6391"];
    return { rim: L.arena.id === "meadow" ? "#3b3222" : "#101a26", fill: w[0], mid: w[1], hi: w[2] };
  },
  lava: () => ({ rim: "#1a0b06", fill: "#7a2206", mid: "#d9480f", hi: "#ffb347" }),
  ice: (L) => {
    const w = L.colors.water || ["#6f9fc0", "#94c2de", "#c4e4f5"];
    return { rim: "#4a6f88", fill: w[0], mid: w[1], hi: w[2] };
  },
};
function drawLiquid(g, sp, L) {
  const c = LIQUID_COLORS[sp.liquid](L);
  const rs = sp.rects;
  g.fillStyle = c.rim;
  for (const r of rs) g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
  g.fillStyle = c.fill;
  for (const r of rs) g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = c.mid;
  for (const r of rs) if (r.w > 20 && r.h > 20) g.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
  // stepped shimmer: a few highlight dashes that jump every 1/3s
  const r0 = rs[0];
  const frame = Math.floor(L.t * 3);
  g.fillStyle = c.hi;
  for (let i = 0; i < 5; i++) {
    const hx = lifeHash(i + Math.floor(sp.seed * 997), frame);
    const hy = lifeHash(i * 31 + 7, frame + Math.floor(sp.seed * 331));
    g.fillRect(Math.round(r0.x + 10 + hx * (r0.w - 30)), Math.round(r0.y + 10 + hy * (r0.h - 20)), sp.liquid === "ice" ? 3 : 8, 2);
  }
}
const SET_PIECE_DRAW = {
  pond: {
    ground(g, sp, L) {
      drawLiquid(g, sp, L);
      g.fillStyle = "#3f7a3a"; // lily pads
      for (let i = 0; i < 3; i++) {
        const p = sp.dots[i];
        g.fillRect(p.x - 5, p.y - 3, 10, 6);
        g.fillStyle = "#1f4466";
        g.fillRect(p.x + 1, p.y - 3, 3, 3);
        g.fillStyle = "#3f7a3a";
        if (p.s > 0.6) {
          g.fillStyle = "#ff9ec8";
          g.fillRect(p.x - 2, p.y - 2, 3, 3);
          g.fillStyle = "#3f7a3a";
        }
      }
      g.fillStyle = "#4c7d41"; // reeds on the bank
      const r0 = sp.rects[0];
      for (let i = 0; i < 4; i++) {
        const s = Math.round(Math.sin(L.t * 1.3 + i + sp.seed * 5));
        const rx = r0.x - 6 + i * 5;
        g.fillRect(rx, r0.y - 10, 2, 12);
        g.fillRect(rx + s, r0.y - 18, 2, 8);
        g.fillStyle = "#6b4a2a";
        g.fillRect(rx + s, r0.y - 20, 2, 4);
        g.fillStyle = "#4c7d41";
      }
    },
  },
  pool: {
    ground(g, sp, L) {
      drawLiquid(g, sp, L);
      for (const p of sp.dots) {
        const on = L.pulse({ seed: p.s }, 0.5) > 0.5;
        g.fillStyle = on ? "#7fd8e8" : "#2f6d80";
        g.fillRect(p.x, p.y, 2, 2);
      }
      L.addLight(sp.x, sp.y, "#3fa8c8", sp.r * 1.1, 0.35 + 0.1 * L.pulse(sp, 0.25));
    },
  },
  lavapool: {
    ground(g, sp, L) {
      drawLiquid(g, sp, L);
      // hot core that pulses in stepped brightness
      const r0 = sp.rects[0];
      g.fillStyle = L.pulse(sp, 0.35) > 0.5 ? "#ff8a2e" : "#f06a1c";
      g.fillRect(Math.round(r0.x + r0.w * 0.3), Math.round(r0.y + r0.h * 0.3), Math.round(r0.w * 0.4), Math.round(r0.h * 0.4));
      // cooled crust drifting on the surface
      g.fillStyle = "#3a1408";
      for (let i = 0; i < 4; i++) {
        const p = sp.dots[i];
        const dx = Math.round(Math.sin(L.t * 0.2 + p.s * 9) * 4);
        g.fillRect(p.x - 6 + dx, p.y - 3, 12, 5);
        g.fillRect(p.x - 3 + dx, p.y - 5, 7, 2);
      }
      // bubbles: grow 2 -> 4 -> 6px in steps, then pop
      for (const p of sp.dots) {
        const ph = (L.t * 0.7 + p.s * 5) % 2.4;
        if (ph < 0.6) {
          const s = 2 + Math.floor(ph / 0.2) * 2;
          g.fillStyle = "#ffd166";
          g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          g.fillStyle = "#b3360b";
          g.fillRect(p.x - s / 2 + 1, p.y - s / 2 + 1, Math.max(1, s - 3), Math.max(1, s - 3));
        }
      }
      L.addLight(sp.x, sp.y, "#ff6a2e", sp.r * 1.5, 0.45 + 0.15 * L.pulse(sp, 0.35));
    },
  },
  icelake: {
    ground(g, sp, L) {
      drawLiquid(g, sp, L);
      g.fillStyle = "#e8f6ff"; // cracks
      for (const p of sp.dots) {
        g.fillRect(p.x, p.y, 10, 1);
        g.fillRect(p.x + 9, p.y, 1, 7);
        g.fillRect(p.x + 9, p.y + 6, 7, 1);
      }
      // a glint sweeping across the ice every few seconds
      const r0 = sp.rects[0];
      const ph = (L.t * 0.22 + sp.seed) % 1.4;
      if (ph < 1) {
        const gx = r0.x + ph * r0.w;
        g.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < 5; i++) g.fillRect(Math.round(gx + i * 3), Math.round(r0.y + 6 + i * 6), 3, 5);
      }
    },
  },
  tree: {
    ground(g, sp) {
      const c = sp.canopy;
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(-c * 0.9, -c * 0.25, c * 1.8, c * 0.5);
      g.fillRect(-c * 0.6, -c * 0.4, c * 1.2, c * 0.8);
      g.fillStyle = "#4a3220";
      g.fillRect(-6, -34, 12, 36);
      g.fillRect(-10, -2, 6, 4);
      g.fillRect(4, -2, 7, 4);
      g.fillStyle = "#6b4a2e";
      g.fillRect(-4, -32, 3, 30);
    },
    overhead(g, sp, L) {
      const c = sp.canopy,
        cols = L.colors.canopy || ["#2c6238", "#3a7a45", "#23512f", "#4c9152"];
      const s = Math.round(Math.sin(L.t * 0.9 + sp.seed * 6) * 1.5);
      g.translate(s, -44);
      g.fillStyle = "#16301c"; // outline so the canopy reads against the grass
      g.fillRect(-c - 3, -c * 0.55 - 3, c * 2 + 6, c * 1.15 + 6);
      g.fillRect(-c * 0.75 - 3, -c * 0.85 - 3, c * 1.5 + 6, c * 1.62 + 6);
      g.fillRect(-c * 0.4 - 3, -c - 3, c * 0.8 + 6, c * 1.8 + 6);
      g.fillStyle = cols[2];
      g.fillRect(-c, -c * 0.45, c * 2, c * 1.05);
      g.fillStyle = cols[0];
      g.fillRect(-c, -c * 0.55, c * 2, c * 0.9);
      g.fillRect(-c * 0.75, -c * 0.85, c * 1.5, c * 1.5);
      g.fillRect(-c * 0.4, -c, c * 0.8, c * 1.75);
      g.fillStyle = cols[1];
      g.fillRect(-c * 0.7, -c * 0.75, c * 0.8, c * 0.5);
      g.fillRect(-c * 0.2, -c * 0.9, c * 0.5, c * 0.35);
      g.fillStyle = cols[3];
      g.fillRect(-c * 0.55, -c * 0.7, c * 0.3, c * 0.2);
      // leaf clumps: fixed per tree (hashed), so they don't crawl around
      for (let i = 0; i < 14; i++) {
        const lx = (lifeHash(i, Math.floor(sp.seed * 9999)) - 0.5) * c * 1.6,
          ly = (lifeHash(i + 50, Math.floor(sp.seed * 7777)) - 0.5) * c * 1.3;
        g.fillStyle = i & 1 ? cols[1] : cols[2];
        g.fillRect(Math.round(lx), Math.round(ly), 6, 4);
      }
      if (sp.seed > 0.5) {
        g.fillStyle = "#d9534f"; // apples
        g.fillRect(c * 0.3, -c * 0.2, 4, 4);
        g.fillRect(-c * 0.5, c * 0.1, 4, 4);
        g.fillRect(c * 0.05, -c * 0.55, 4, 4);
      }
    },
  },
  pine: {
    ground(g, sp) {
      const c = sp.canopy;
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(-c * 0.8, -c * 0.2, c * 1.6, c * 0.4);
      g.fillStyle = "#3a2a1c";
      g.fillRect(-4, -20, 8, 22);
    },
    overhead(g, sp, L) {
      const c = sp.canopy,
        cols = L.colors.canopy || ["#1f4a44", "#2a5d55", "#173b37"];
      const s = Math.round(Math.sin(L.t * 0.7 + sp.seed * 6));
      g.translate(s, -18);
      for (let i = 0; i < 4; i++) {
        const w = c * (1 - i * 0.22),
          y = -i * c * 0.42;
        g.fillStyle = cols[i % 2 ? 1 : 0];
        g.fillRect(-w, y - c * 0.3, w * 2, c * 0.34);
        g.fillRect(-w * 0.7, y - c * 0.46, w * 1.4, c * 0.2);
        g.fillStyle = "#e2f6ff"; // snow on each tier
        g.fillRect(-w * 0.7, y - c * 0.48, w * 1.4, 4);
        g.fillRect(-w, y - c * 0.32, w * 0.5, 3);
      }
      g.fillStyle = "#e2f6ff";
      g.fillRect(-3, -c * 1.75, 6, 6);
    },
  },
  mausoleum: {
    ground(g, sp, L) {
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(-50, -4, 100, 10);
      g.fillStyle = "#3c3c4c";
      g.fillRect(-44, -56, 88, 58);
      g.fillStyle = "#4a4a5c";
      g.fillRect(-50, -62, 100, 8);
      g.fillRect(-40, -70, 80, 8);
      g.fillRect(-26, -78, 52, 8);
      g.fillRect(-10, -84, 20, 6);
      g.fillStyle = "#5a5a6e";
      g.fillRect(-38, -54, 8, 54);
      g.fillRect(30, -54, 8, 54);
      g.fillStyle = "#0c0a14";
      g.fillRect(-14, -40, 28, 42);
      g.fillRect(-10, -44, 20, 4);
      const on = L.flicker(sp) > 0.25;
      g.fillStyle = on ? "#a970ff" : "#6b4aa0";
      g.globalAlpha = 0.55;
      g.fillRect(-10, -36, 20, 36);
      g.globalAlpha = 1;
      g.fillStyle = "#4f6b3a"; // moss / ivy
      g.fillRect(-44, -20, 6, 20);
      g.fillRect(-44, -30, 3, 10);
      g.fillRect(38, -12, 6, 12);
      L.addLight(sp.x, sp.y - 20, "#a970ff", 96, on ? 0.7 : 0.5);
    },
  },
  opengrave: {
    ground(g, sp) {
      g.fillStyle = "#3a2c22";
      g.fillRect(16, -14, 22, 18);
      g.fillRect(20, -20, 14, 6);
      g.fillStyle = "#07060a";
      g.fillRect(-14, -24, 26, 44);
      g.fillStyle = "#2a2018";
      g.fillRect(-14, -24, 26, 4);
      g.fillStyle = "#6b5a40"; // shovel
      g.fillRect(40, -34, 3, 30);
      g.fillStyle = "#8a8a9a";
      g.fillRect(38, -8, 7, 8);
      g.fillStyle = "#4a4a5c";
      g.fillRect(-8, -40, 14, 16);
      g.fillRect(-6, -43, 10, 3);
    },
  },
  geode: {
    ground(g, sp, L) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-46, 4, 92, 10);
      g.fillStyle = "#2a3a52";
      g.fillRect(-44, -8, 88, 16);
      const cols = ["#8a5fd6", "#4fa9c0", "#a970ff", "#7fd8e8", "#6fe3a3"];
      const shards = [[-30, -10, 7, 18], [-14, -20, 9, 30], [4, -26, 10, 38], [22, -16, 8, 24], [36, -6, 6, 14]];
      shards.forEach((s, i) => {
        L.diamond(g, s[0], s[1], s[2], s[3], cols[(i + Math.floor(sp.seed * 5)) % cols.length]);
        L.diamond(g, s[0] - 1, s[1] - 2, Math.max(2, s[2] - 4), Math.max(3, s[3] - 8), "rgba(255,255,255,0.28)");
      });
      L.addLight(sp.x, sp.y - 16, "#a970ff", 130, 0.45 + 0.2 * L.pulse(sp, 0.4));
      L.addLight(sp.x + 10, sp.y - 24, "#7fd8e8", 70, 0.35 + 0.2 * L.pulse(sp, 0.6));
    },
  },
  spire: {
    ground(g, sp, L) {
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(-24, 2, 48, 8);
      g.fillStyle = "#140c10";
      g.fillRect(-18, -12, 36, 14);
      g.fillRect(-13, -36, 26, 24);
      g.fillRect(-9, -60, 18, 24);
      g.fillRect(-5, -80, 10, 20);
      g.fillRect(-2, -92, 4, 12);
      g.fillStyle = "#2c1c24";
      g.fillRect(-9, -58, 4, 52);
      const hot = L.pulse(sp, 0.5) > 0.5;
      g.fillStyle = hot ? "#ffb347" : "#ff6a2e";
      g.fillRect(2, -46, 2, 14);
      g.fillRect(4, -34, 5, 2);
      g.fillRect(-6, -22, 2, 10);
      L.addLight(sp.x, sp.y - 30, "#ff6a2e", 50, hot ? 0.4 : 0.25);
    },
  },
  statue: {
    ground(g, sp) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(-28, 2, 56, 8);
      g.fillStyle = "#3a4f64";
      g.fillRect(-24, -14, 48, 16);
      g.fillStyle = "#5a7590";
      g.fillRect(-12, -40, 10, 26); // legs
      g.fillRect(2, -40, 10, 26);
      g.fillRect(-16, -72, 32, 34); // torso
      g.fillRect(-26, -70, 10, 24); // one arm
      g.fillRect(16, -70, 10, 10); // the broken one
      g.fillStyle = "#4a6178";
      g.fillRect(-4, -84, 10, 12); // a stump where the head was
      g.fillStyle = "rgba(0,0,0,0.2)";
      g.fillRect(-2, -66, 2, 18);
      g.fillRect(4, -56, 8, 2);
      g.fillStyle = "#e2f6ff";
      g.fillRect(-26, -16, 52, 3);
      g.fillRect(-16, -74, 32, 3);
      g.fillRect(-26, -72, 10, 3);
      g.fillRect(-4, -86, 10, 3);
    },
  },
};

/* ---------------- critters ----------------
   Each lives around the camera, never simulated far away, and flees
   from you (and teammates; ground critters also from Bayats). */
const CRITTER_DEFS = {
  bird: {
    air: false,
    make(c) {
      c.state = "ground";
      c.facing = Math.random() < 0.5 ? -1 : 1;
      c.hopT = rand(1, 3);
    },
    update(c, dt, L) {
      if (c.state === "ground") {
        const th = L.threat(c, L.scareR, true);
        if (th || c.scared) {
          c.state = "fly";
          const a = th ? Math.atan2(c.y - th.y, c.x - th.x) + rand(-0.5, 0.5) : rand(0, TAU);
          const sp = rand(190, 250);
          c.vx = Math.cos(a) * sp;
          c.vy = Math.sin(a) * sp;
          c.facing = c.vx < 0 ? -1 : 1;
          return;
        }
        c.hopT -= dt;
        if (c.hopT <= 0) {
          c.hopT = rand(1.2, 3.5);
          c.x += rand(-8, 8);
          c.y += rand(-5, 5);
          if (Math.random() < 0.4) c.facing = -c.facing;
        }
      } else {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z = Math.min(80, c.z + 110 * dt);
      }
    },
    draw(g, c, L, x, y) {
      const col = c.color;
      const f = c.facing;
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(x - 4, y, 8, 2);
      const by = y - 6 - c.z;
      if (c.state === "ground") {
        const peck = (L.f8 + Math.floor(c.seed * 8)) % 7 < 2;
        g.fillStyle = col;
        g.fillRect(x - 4, by, 8, 5);
        g.fillRect(f > 0 ? x - 7 : x + 4, by + 1, 3, 2); // tail
        g.fillRect(x + (f > 0 ? 2 : -6), by - 3 + (peck ? 3 : 0), 4, 4); // head
        g.fillStyle = c.beak;
        g.fillRect(x + (f > 0 ? 6 : -8), by - 2 + (peck ? 3 : 0), 2, 1);
        g.fillStyle = "#1a1510";
        g.fillRect(x - 2, by + 5, 1, 2);
        g.fillRect(x + 1, by + 5, 1, 2);
      } else {
        const up = L.f12 & 1;
        g.fillStyle = col;
        g.fillRect(x - 3, by, 6, 4);
        if (up) {
          g.fillRect(x - 9, by - 4, 6, 2);
          g.fillRect(x + 3, by - 4, 6, 2);
        } else {
          g.fillRect(x - 9, by + 2, 6, 2);
          g.fillRect(x + 3, by + 2, 6, 2);
        }
        g.fillRect(x + (f > 0 ? 3 : -6), by - 1, 3, 3);
      }
    },
  },
  butterfly: {
    air: true,
    make(c) {
      c.a = rand(0, TAU);
      c.z = rand(12, 26);
    },
    update(c, dt, L) {
      const th = L.threat(c, 70, false);
      let sp = 34;
      if (th) {
        c.a = Math.atan2(c.y - th.y, c.x - th.x);
        c.fleeT = 0.8;
      }
      if (c.fleeT > 0) {
        c.fleeT -= dt;
        sp = 120;
      } else c.a += rand(-3, 3) * dt;
      c.x += Math.cos(c.a) * sp * dt;
      c.y += Math.sin(c.a) * sp * dt;
      c.z = 18 + Math.sin(L.t * 3 + c.seed * 10) * 6;
    },
    draw(g, c, L, x, y) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(x - 1, y, 3, 1);
      const by = Math.round(y - c.z);
      const open = (L.f12 + Math.floor(c.seed * 4)) & 1;
      g.fillStyle = c.color;
      if (open) {
        g.fillRect(x - 5, by - 3, 4, 4);
        g.fillRect(x + 1, by - 3, 4, 4);
        g.fillRect(x - 4, by + 1, 3, 2);
        g.fillRect(x + 1, by + 1, 3, 2);
      } else {
        g.fillRect(x - 3, by - 3, 2, 5);
        g.fillRect(x + 1, by - 3, 2, 5);
      }
      g.fillStyle = "#1a1510";
      g.fillRect(x - 1, by - 3, 2, 6);
    },
  },
  wisp: {
    air: true,
    make(c) {
      c.a = rand(0, TAU);
    },
    update(c, dt, L) {
      const th = L.threat(c, 95, false);
      let sp = 12;
      if (th) {
        c.a = Math.atan2(c.y - th.y, c.x - th.x);
        sp = 70;
      } else c.a += rand(-1, 1) * dt;
      c.x += Math.cos(c.a) * sp * dt;
      c.y += Math.sin(c.a) * sp * dt;
      c.z = 22 + Math.sin(L.t * 1.6 + c.seed * 10) * 6;
      c.dim = th ? Math.min(1, (c.dim || 0) + dt * 3) : Math.max(0, (c.dim || 0) - dt);
    },
    draw(g, c, L, x, y) {
      const by = Math.round(y - c.z);
      const a = 1 - (c.dim || 0) * 0.6;
      g.globalAlpha = a;
      g.fillStyle = "#c9f3ff";
      g.fillRect(x - 2, by - 2, 4, 4);
      g.fillStyle = "#7fd8e8";
      g.fillRect(x - 4, by - 1, 2, 2);
      g.fillRect(x + 2, by - 1, 2, 2);
      g.fillRect(x - 1, by + 2, 2, 3 + (L.f8 & 1));
      g.globalAlpha = 1;
      L.addLight(c.x, c.y + by * CONFIG.arenaLife.decorScale, "#7fd8e8", 46, (0.45 + 0.2 * L.flicker(c)) * a);
    },
  },
  glowbug: {
    air: true,
    make(c) {
      c.a = rand(0, TAU);
    },
    update(c, dt, L) {
      const th = L.threat(c, 60, false);
      c.a = th ? Math.atan2(c.y - th.y, c.x - th.x) : c.a + rand(-4, 4) * dt;
      const sp = th ? 90 : 22;
      c.x += Math.cos(c.a) * sp * dt;
      c.y += Math.sin(c.a) * sp * dt;
      c.z = 16 + Math.sin(L.t * 2 + c.seed * 10) * 8;
    },
    draw(g, c, L, x, y) {
      if (Math.sin(L.t * 2.2 + c.seed * 20) < -0.3) return; // blink off
      const by = Math.round(y - c.z);
      g.fillStyle = "#d8ff9a";
      g.fillRect(x - 1, by - 1, 2, 2);
      L.addLight(c.x, c.y + by * CONFIG.arenaLife.decorScale, "#b8ff6a", 22, 0.5);
    },
  },
  lizard: {
    air: false,
    make(c) {
      c.idleT = rand(0.5, 3);
      c.dir = rand(0, TAU);
      c.runT = 0;
    },
    update(c, dt, L) {
      const th = L.threat(c, 100, true);
      if (th && c.runT <= 0) {
        c.dir = Math.atan2(c.y - th.y, c.x - th.x) + rand(-0.4, 0.4);
        c.runT = 0.5;
        c.speed = 260;
      }
      if (c.runT > 0) {
        c.runT -= dt;
        c.x += Math.cos(c.dir) * c.speed * dt;
        c.y += Math.sin(c.dir) * c.speed * dt;
      } else {
        c.idleT -= dt;
        if (c.idleT <= 0) {
          c.idleT = rand(1.5, 4);
          c.dir = rand(0, TAU);
          c.runT = rand(0.15, 0.35);
          c.speed = 150;
        }
      }
    },
    draw(g, c, L, x, y) {
      const f = Math.cos(c.dir) < 0 ? -1 : 1;
      const run = c.runT > 0;
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(x - 6, y + 1, 12, 2);
      g.fillStyle = "#8a7050";
      g.fillRect(x - 5, y - 3, 10, 3);
      g.fillRect(x + (f > 0 ? 5 : -8), y - 4, 3, 3);
      g.fillRect(x + (f > 0 ? -11 : 5), y - 2, 6, 2);
      g.fillStyle = "#5e4a34";
      const leg = run && L.f12 & 1;
      g.fillRect(x - 4, y + (leg ? 0 : -1), 2, 2);
      g.fillRect(x + 2, y + (leg ? -1 : 0), 2, 2);
    },
  },
  hare: {
    air: false,
    make(c) {
      c.hops = 0;
      c.hopT = 0;
      c.dir = rand(0, TAU);
      c.idleT = rand(1, 3);
    },
    update(c, dt, L) {
      const th = L.threat(c, 120, true);
      if ((th || c.scared) && c.hops <= 0) {
        c.hops = randInt(3, 5);
        c.dir = th ? Math.atan2(c.y - th.y, c.x - th.x) + rand(-0.3, 0.3) : rand(0, TAU);
        c.hopT = 0;
        c.scared = false;
      }
      if (c.hops > 0) {
        c.hopT += dt;
        const p = Math.min(1, c.hopT / 0.3);
        c.x += Math.cos(c.dir) * 160 * dt;
        c.y += Math.sin(c.dir) * 160 * dt;
        c.z = Math.sin(p * Math.PI) * 10;
        if (p >= 1) {
          c.hops--;
          c.hopT = 0;
          c.z = 0;
          L.addPrint(c.x, c.y, 0);
        }
      } else {
        c.idleT -= dt;
        if (c.idleT <= 0) {
          c.idleT = rand(2, 5);
          c.hops = 1;
          c.dir = rand(0, TAU);
        }
      }
    },
    draw(g, c, L, x, y) {
      const f = Math.cos(c.dir) < 0 ? -1 : 1;
      g.fillStyle = "rgba(0,40,80,0.2)";
      g.fillRect(x - 5, y, 10, 2);
      const by = Math.round(y - 7 - c.z);
      g.fillStyle = "#f4fbff";
      g.fillRect(x - 5, by, 9, 6);
      g.fillRect(x + (f > 0 ? 3 : -7), by - 3, 5, 5);
      const twitch = c.hops <= 0 && (L.f8 + Math.floor(c.seed * 9)) % 9 === 0;
      g.fillRect(x + (f > 0 ? 4 : -6), by - 8 + (twitch ? 2 : 0), 2, 5 - (twitch ? 2 : 0));
      g.fillStyle = "#1a2836";
      g.fillRect(x + (f > 0 ? 6 : -6), by - 2, 1, 1);
      g.fillStyle = "#d8ecf7";
      g.fillRect(x + (f > 0 ? -6 : 3), by + 1, 3, 3);
    },
  },
  bat: {
    air: true,
    flock: true,
    make() {},
    update(c, dt, L) {
      c.x += c.vx * dt;
      c.y += c.vy * dt + Math.sin(L.t * 6 + c.seed * 10) * 40 * dt;
    },
    draw(g, c, L, x, y) {
      const by = Math.round(y - c.z);
      const up = (L.f12 + Math.floor(c.seed * 3)) & 1;
      g.fillStyle = "#0e0b14";
      g.fillRect(x - 2, by - 1, 4, 3);
      if (up) {
        g.fillRect(x - 8, by - 4, 6, 2);
        g.fillRect(x + 2, by - 4, 6, 2);
        g.fillRect(x - 9, by - 6, 2, 2);
        g.fillRect(x + 7, by - 6, 2, 2);
      } else {
        g.fillRect(x - 8, by, 6, 2);
        g.fillRect(x + 2, by, 6, 2);
      }
    },
  },
};
CRITTER_DEFS.crow = CRITTER_DEFS.bird; // same behaviour, black (see spawnCritter)

/* ---------------- ambient weather (screen-space, wraps) ----------------
   x/y are SCREEN coords in world units; each frame they move by their
   own velocity and by -cameraDelta * par (par 1 = sits in the world,
   >1 = closer to the camera, so it slides past a little faster). */
const AMBIENT_DEFS = {
  pollen: { par: 1, init: (p, L) => ((p.vx = rand(-6, 6) + L.wind * 0.4), (p.vy = rand(-5, 3)), (p.s = 2), (p.c = "#ffe9a0"), (p.a = 0.55)) },
  petal: { par: 1.1, init: (p, L) => ((p.vx = rand(6, 16)), (p.vy = rand(10, 18)), (p.s = 3), (p.c = choice(["#ffb3d1", "#f2f2f2"])), (p.a = 0.75)) },
  mote: { par: 0.95, init: (p) => ((p.vx = rand(-4, 4)), (p.vy = rand(-3, 3)), (p.s = 2), (p.c = "#c7c7d8"), (p.a = 0.3)) },
  dust: { par: 0.97, init: (p) => ((p.vx = rand(-3, 3)), (p.vy = rand(-2, 4)), (p.s = 2), (p.c = "#bcd8ec"), (p.a = 0.35)), twinkle: true },
  ember: { par: 1.05, init: (p) => ((p.vx = rand(-8, 8)), (p.vy = rand(-60, -28)), (p.s = 2), (p.c = choice(["#ff9d4d", "#ffd166", "#ff6a2e"])), (p.a = 0.85)), flicker: true },
  ash: { par: 1.1, init: (p) => ((p.vx = rand(-6, 10)), (p.vy = rand(8, 16)), (p.s = choice([2, 3])), (p.c = "#6a6058"), (p.a = 0.55)) },
  snow: {
    par: 1.15,
    init: (p) => {
      p.s = Math.random() < 0.3 ? 3 : 2;
      p.vy = p.s === 3 ? rand(46, 62) : rand(28, 42);
      p.vx = 0;
      p.c = "#ffffff";
      p.a = p.s === 3 ? 0.9 : 0.6;
    },
    windy: true,
  },
};

/* =========================================================
   ArenaLife — the system. Game calls reset() in startGame, update(dt)
   every frame (hitstop included), and the four draw passes from
   drawWorld(): drawGround → drawDecor (under entities), drawOverhead
   (above entities, inside the shaken world transform), drawScreen
   (after it, before the darkness event overlay).
   ========================================================= */
const ArenaLife = {
  t: 0,
  f8: 0,
  f12: 0,
  arena: null,
  life: {},
  colors: {},
  decor: [],
  setPieces: [],
  cells: null,
  cols: 0,
  critters: [],
  ambient: [],
  marks: [],
  falling: [],
  banks: [],
  clouds: [],
  vultures: [],
  devils: [],
  drips: [],
  lights: [],
  visible: [],
  movers: [],
  players: [],
  wind: 0,
  flash: null,
  cam: null,
  scareR: 110,

  get on() {
    return CONFIG.arenaLife.enabled;
  },
  get reduced() {
    return !!(Game.settings && Game.settings.reducedParticles);
  },
  reset(game) {
    this.arena = game.arena;
    this.life = (game.arena && game.arena.life) || {};
    this.colors = this.life.colors || {};
    this.decor = game.decor || [];
    this.setPieces = game.setPieces || [];
    this.t = 0;
    this.critters = [];
    this.ambient = [];
    this.marks = [];
    this.falling = [];
    this.devils = [];
    this.drips = [];
    this.flash = null;
    this.lastCamX = null;
    this.chunks.clear();
    this.active = [];
    this.reactFrame = 0;
    this.hasVents = (this.life.decor || []).some(([k]) => k === "smokevent");
    this.seenWaves = new WeakSet();
    this.wind = (this.life.wind && this.life.wind.base) || 6;
    this.windTarget = this.wind;
    this.gustT = this.life.wind ? rand(...this.life.wind.every) : 0;
    this.flockT = this.life.flocks ? rand(3, this.life.flocks.every[1]) : 0;
    this.lightningT = this.life.lightning ? rand(...this.life.lightning) : 0;
    this.devilT = this.life.dustDevils ? rand(3, this.life.dustDevils[1]) : 0;
    this.dripT = this.life.drips ? rand(...this.life.drips) : 0;
    this.scareR = CONFIG.arenaLife.scareRadius;
    // culling buckets for decor + set pieces
    this.cols = Math.ceil(CONFIG.arena.width / LIFE_CELL);
    const rows = Math.ceil(CONFIG.arena.height / LIFE_CELL);
    this.cells = [];
    for (let i = 0; i < this.cols * rows; i++) this.cells.push([]);
    for (const d of this.decor) {
      const c = Math.floor(d.x / LIFE_CELL) + Math.floor(d.y / LIFE_CELL) * this.cols;
      if (this.cells[c]) this.cells[c].push(d);
    }
    // screen-space layers get seeded on the first frame (need the camera)
    this.needsSeed = true;
  },

  /* ---- small helpers the draw tables use ---- */
  sway(d, amp) {
    return Math.round(Math.sin(this.t * 1.7 + d.seed * 9 + this.wind * 0.01) * amp + (d.bend || 0));
  },
  shake(d) {
    return d.rustle > 0 ? (this.f12 & 1 ? 1 : -1) : 0;
  },
  /* Sprite cache for the numerous small "pose" decor (grass, flowers,
     bushes, shrubs): each (kind, colour, seed bucket, pose) is drawn once
     into a tiny canvas and then blitted — one drawImage instead of 8-12
     fillRects per blade. The pose is the integer sway/shake the draw
     would have used this frame, so the animation is unchanged. Seeds
     are bucketed to 8 looks per kind+colour, which is plenty of variety. */
  spriteMap: new Map(), // key -> atlas slot {page, sx, sy}
  atlasPages: [],
  atlasNext: 0,
  decorSprite(def, d) {
    // the pose this frame: what sway()/shake() return for this decor
    const pose = def.shakes ? this.shake(d) : this.sway(d, d.kind === "flower" ? 1.6 : d.kind === "grass" ? 1.4 : 1);
    // most frames a blade holds its pose: reuse the slot it had
    if (d._pose === pose && d._slot && d._slot.gen === this.atlasGen) return d._slot;
    const bucket = Math.floor(d.seed * 8);
    const key = d.kind + d.c + bucket + "|" + pose;
    let slot = this.spriteMap.get(key);
    if (!slot) slot = this.bakeSprite(def, d, bucket, pose, key);
    d._pose = pose;
    d._slot = slot;
    return slot;
  },
  // Sprites live in shared 1024x1024 atlas pages (21x25 slots of 48x40):
  // one texture for the GPU instead of hundreds of tiny canvases.
  atlasGen: 1,
  bakeSprite(def, d, bucket, pose, key) {
    const SW = 48,
      SH = 40,
      PER_ROW = 21,
      PER_PAGE = 21 * 25;
    if (this.atlasNext >= PER_PAGE * 4) {
      // 4 pages full (can't happen with the current content, but bound it)
      this.spriteMap.clear();
      this.atlasPages = [];
      this.atlasNext = 0;
      this.atlasGen++;
    }
    const pageI = Math.floor(this.atlasNext / PER_PAGE),
      i = this.atlasNext % PER_PAGE;
    this.atlasNext++;
    let page = this.atlasPages[pageI];
    if (!page) {
      page = document.createElement("canvas");
      page.width = 1024;
      page.height = 1024;
      this.atlasPages[pageI] = page;
    }
    const sx = (i % PER_ROW) * SW,
      sy = Math.floor(i / PER_ROW) * SH;
    const g = page.getContext("2d");
    g.setTransform(1, 0, 0, 1, sx + 24, sy + 32);
    g.save();
    g.beginPath();
    g.rect(-24, -32, SW, SH);
    g.clip();
    const fakeD = { kind: d.kind, c: d.c, seed: (bucket + 0.5) / 8, rustle: 0, bend: 0 };
    const fakeL = Object.create(this);
    fakeL.sway = () => pose;
    fakeL.shake = () => pose;
    def.draw(g, fakeD, fakeL);
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const slot = { page, sx, sy, gen: this.atlasGen };
    this.spriteMap.set(key, slot);
    return slot;
  },
  pulse(d, speed) {
    const v = (Math.sin(this.t * speed * Math.PI + d.seed * 10) + 1) / 2;
    return Math.round(v * 3) / 3; // 4 stepped brightness levels
  },
  flicker(d) {
    return lifeHash(Math.floor(this.t * 10), Math.floor(d.seed * 100000));
  },
  glint(d, period) {
    return (this.t / period + d.seed) % 1 < 0.07;
  },
  diamond(g, cx, cy, w, h, color) {
    g.fillStyle = color;
    for (let y = -h; y < h; y += 2) {
      const ww = Math.max(1, Math.round(w * (1 - Math.abs(y + 1) / h)));
      g.fillRect(cx - ww, cy + y, ww * 2, 2);
    }
  },
  addLight(wx, wy, color, r, a) {
    if (!CONFIG.arenaLife.lights || !this.cam || a <= 0.02) return;
    this.lights.push(wx - this.cam.x, wy - this.cam.y, r, a, color);
  },
  addMark(m) {
    if (this.marks.length >= CONFIG.arenaLife.maxMarks) this.marks.shift();
    this.marks.push(m);
  },
  addPrint(x, y, side) {
    if (this.life.footprints === "snow") this.addMark({ k: "print", x, y, t: 0, max: 7, side });
  },
  // Nearest thing a critter should be scared of within r, or null.
  threat(c, r, includeBayats) {
    let best = null,
      bd = r * r;
    for (const p of this.players) {
      const d2 = dist2(c.x, c.y, p.x, p.y);
      if (d2 < bd) {
        bd = d2;
        best = p;
      }
    }
    if (includeBayats) {
      const rb = Math.min(r, 70),
        rb2 = rb * rb;
      for (const m of this.movers) {
        const d2 = dist2(c.x, c.y, m.x, m.y);
        if (d2 < rb2 && d2 < bd) {
          bd = d2;
          best = m;
        }
      }
    }
    return best;
  },

  /* ---------------- update ---------------- */
  update(dt, game) {
    if (!this.cells || !game.camera) return;
    const cam = (this.cam = game.camera);
    this.t += dt;
    this.f8 = Math.floor(this.t * 8);
    this.f12 = Math.floor(this.t * 12);
    // movers: you, teammates, and every Bayat / Nasser / Hava near the view
    const players = (this.players = this.players || []);
    players.length = 0;
    if (game.player) players.push(game.player);
    if (game.coop && game.mpPeers) for (const id in game.mpPeers) players.push(game.mpPeers[id]);
    const movers = this.movers;
    movers.length = 0;
    if (game.bayats) {
      const x0 = cam.x - 80,
        y0 = cam.y - 80,
        x1 = cam.x + cam.w + 80,
        y1 = cam.y + cam.h + 80;
      for (const n of game.bayats.list) {
        if (n.alive && n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) movers.push(n);
        if (movers.length >= 120) break;
      }
    }
    this.updateWind(dt);
    this.updateDecorReactions(dt);
    this.updateShockwaves(game);
    this.updatePrintsAndRipples(dt);
    if (!this.on) return;
    if (this.needsSeed) this.seedLayers(cam);
    this.updateCritters(dt, cam);
    this.updateAmbient(dt, cam);
    this.updateEvents(dt, cam);
  },
  updateWind(dt) {
    const w = this.life.wind;
    if (!w) return;
    this.gustT -= dt;
    if (this.gustT <= 0) {
      if (this.windTarget === w.base) {
        this.windTarget = w.gust * (Math.random() < 0.5 ? -1 : 1);
        this.gustT = rand(2, 3.5);
      } else {
        this.windTarget = w.base;
        this.gustT = rand(...w.every);
      }
    }
    this.wind += (this.windTarget - this.wind) * Math.min(1, dt * 1.5);
  },
  forVisibleDecor(cam, pad, fn) {
    const c0 = Math.max(0, Math.floor((cam.x - pad) / LIFE_CELL)),
      c1 = Math.min(this.cols - 1, Math.floor((cam.x + cam.w + pad) / LIFE_CELL));
    const r0 = Math.max(0, Math.floor((cam.y - pad) / LIFE_CELL)),
      r1 = Math.floor((cam.y + cam.h + pad) / LIFE_CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = this.cells[c + r * this.cols];
        if (!cell) continue;
        for (const d of cell) {
          if (d.broken) continue;
          if (d.x < cam.x - pad || d.x > cam.x + cam.w + pad || d.y < cam.y - pad || d.y > cam.y + cam.h + pad) continue;
          fn(d);
        }
      }
    }
  },
  /* Mover-centric: each mover (you, teammates, on-screen Bayats) looks up
     only the decor in its own bucket(s); anything touched joins `active`,
     which springs back and drops out once settled. The first version had
     every visible blade scan every mover (a closure per blade per frame)
     — 0.34ms in a dense meadow. */
  updateDecorReactions(dt) {
    const R = CONFIG.arenaLife.reactRadius;
    const frame = ++this.reactFrame;
    const active = this.active;
    const touch = (m) => {
      const rr = R + (m.radius || 14) * 0.5;
      const c0 = Math.max(0, Math.floor((m.x - rr) / LIFE_CELL)),
        c1 = Math.min(this.cols - 1, Math.floor((m.x + rr) / LIFE_CELL));
      const r0 = Math.max(0, Math.floor((m.y - rr) / LIFE_CELL)),
        r1 = Math.floor((m.y + rr) / LIFE_CELL);
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const cell = this.cells[c + r * this.cols];
          if (!cell) continue;
          for (let i = 0; i < cell.length; i++) {
            const d = cell[i];
            const dx = d.x - m.x,
              dy = d.y - m.y;
            if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
            const def = LIFE_DECOR[d.kind];
            if (!def || !def.react || d.broken) continue;
            const dd = Math.sqrt(dx * dx + dy * dy);
            if (dd >= rr) continue;
            const tgt = (dx >= 0 ? 1 : -1) * 5 * (1 - dd / rr);
            if (d._f !== frame || Math.abs(tgt) > Math.abs(d._t)) d._t = tgt;
            d._f = frame;
            if (!d._act) {
              d._act = true;
              active.push(d);
            }
          }
        }
    };
    for (const p of this.players) touch(p);
    for (const m of this.movers) touch(m);
    for (let i = active.length - 1; i >= 0; i--) {
      const d = active[i];
      const def = LIFE_DECOR[d.kind];
      const on = d._f === frame;
      if (def.react === "bend") {
        const tgt = on ? d._t : 0;
        d.bend = (d.bend || 0) + (tgt - (d.bend || 0)) * Math.min(1, dt * (on ? 16 : 5));
      } else if (def.react === "rustle") {
        if (on && !d.inside) {
          d.rustle = 0.4;
          if (Game.particles && !this.reduced) Game.particles.burst(d.x, d.y - 10, d.c, 4, { maxSpeed: 70, minLife: 0.3, maxLife: 0.6 });
        }
        d.inside = on;
        if (d.rustle > 0) d.rustle -= dt;
      } else if (def.react === "part") {
        d.part = (d.part || 0) + ((on ? 1 : 0) - (d.part || 0)) * Math.min(1, dt * 3);
      }
      const settled = !on && Math.abs(d.bend || 0) < 0.05 && !(d.rustle > 0) && (d.part || 0) < 0.01;
      if (settled) {
        d.bend = 0;
        d.part = 0;
        d._act = false;
        active[i] = active[active.length - 1];
        active.pop();
      }
    }
  },
  // A bomb / big hug / evolution shockwave scares critters and rustles
  // the decor it passes over — the world reacts to the loud moments.
  updateShockwaves(game) {
    if (!game.shockwaves) return;
    for (const w of game.shockwaves) {
      if (this.seenWaves.has(w)) continue;
      this.seenWaves.add(w);
      const r = (w.maxR || 100) * 1.6;
      for (const c of this.critters) {
        if (dist2(c.x, c.y, w.x, w.y) < r * r) {
          c.scared = true;
          if (CRITTER_DEFS[c.k].air) {
            c.a = Math.atan2(c.y - w.y, c.x - w.x);
            c.fleeT = 1;
          }
        }
      }
      if (this.cam) {
        const rr = (w.maxR || 100) * 1.1;
        this.forVisibleDecor(this.cam, 40, (d) => {
          const def = LIFE_DECOR[d.kind];
          if (!def || !def.react || dist2(d.x, d.y, w.x, w.y) > rr * rr) return;
          if (def.react === "bend") d.bend = Math.sign(d.x - w.x || 1) * 6;
          if (def.react === "rustle") d.rustle = 0.5;
          if (!d._act) {
            d._act = true;
            this.active.push(d);
          }
        });
      }
    }
  },
  updatePrintsAndRipples(dt) {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.t += dt;
      if (m.t >= m.max) this.marks.splice(i, 1);
    }
    const fp = this.life.footprints;
    const step = (e, isPlayer) => {
      if (e.downed) return;
      if (e._lpx === undefined) {
        e._lpx = e.x;
        e._lpy = e.y;
        e._lps = 0;
        return;
      }
      const dx = e.x - e._lpx,
        dy = e.y - e._lpy;
      const stride = isPlayer ? 18 : 22;
      if (dx * dx + dy * dy < stride * stride) return;
      e._lpx = e.x;
      e._lpy = e.y;
      e._lps ^= 1;
      if (fp === "snow") {
        const a = Math.atan2(dy, dx) + Math.PI / 2;
        const off = e._lps ? 4 : -4;
        this.addMark({ k: "print", x: e.x + Math.cos(a) * off, y: e.y + Math.sin(a) * off + (e.radius || 14) * 0.5, t: 0, max: 7 });
      } else if (fp === "dust") {
        this.addMark({ k: "puff", x: e.x, y: e.y + (e.radius || 14) * 0.6, t: 0, max: 0.5 });
      }
      // ripples when walking through water / puddles
      if (this.inWater(e.x, e.y)) this.addMark({ k: "ripple", x: e.x, y: e.y + 4, t: 0, max: 0.8 });
    };
    for (const p of this.players) step(p, true);
    for (const m of this.movers) step(m, false);
  },
  inWater(x, y) {
    for (const sp of this.setPieces) {
      if ((sp.liquid === "water" || sp.liquid === "lava") && dist2(x, y, sp.x, sp.y) < sp.r * sp.r * 1.6 && pointInBlob(sp, x, y, 0)) return true;
    }
    if (this.arena && this.arena.id === "cavern" && this.cam) {
      let hit = false;
      this.forVisibleDecor(this.cam, 0, (d) => {
        if (!hit && d.kind === "puddle" && Math.abs(d.x - x) < 14 && Math.abs(d.y - y) < 8) hit = true;
      });
      return hit;
    }
    return false;
  },

  /* ---- critters ---- */
  spawnCritter(kind, cam, anywhere) {
    const def = CRITTER_DEFS[kind];
    if (!def) return;
    const W = CONFIG.arena.width,
      H = CONFIG.arena.height;
    for (let tries = 0; tries < 8; tries++) {
      const x = rand(cam.x - 260, cam.x + cam.w + 260),
        y = rand(cam.y - 260, cam.y + cam.h + 260);
      if (x < 40 || y < 40 || x > W - 40 || y > H - 40) continue;
      // no pop-in: ground critters appear just outside the view
      const inView = x > cam.x - 20 && x < cam.x + cam.w + 20 && y > cam.y - 20 && y < cam.y + cam.h + 20;
      if (inView && !anywhere) continue;
      if (!def.air && this.inWater(x, y)) continue;
      if (this.players.some((p) => dist2(x, y, p.x, p.y) < 200 * 200)) continue;
      const c = { k: kind, x, y, z: 0, seed: Math.random(), vx: 0, vy: 0 };
      const cc = this.colors;
      if (kind === "crow") ((c.color = "#15131c"), (c.beak = "#4a4a5c"));
      else if (kind === "bird") ((c.color = choice(cc.bird || ["#7a5a3c"])), (c.beak = "#ffb347"));
      else if (kind === "butterfly") c.color = choice(cc.butterfly || ["#ffd166"]);
      def.make(c);
      this.critters.push(c);
      return c;
    }
  },
  critterTarget() {
    const life = this.life.critters || {};
    const m = CONFIG.arenaLife.critterMult * (this.reduced ? 0.5 : 1);
    return { ground: Math.round((life.groundCount || 0) * m), air: Math.round((life.airCount || 0) * m) };
  },
  updateCritters(dt, cam) {
    const life = this.life.critters;
    const want = this.critterTarget();
    let ground = 0,
      air = 0;
    const far = Math.max(cam.w, cam.h) * 0.7 + 520;
    const mx = cam.x + cam.w / 2,
      my = cam.y + cam.h / 2;
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      const def = CRITTER_DEFS[c.k];
      def.update(c, dt, this);
      if (Math.abs(c.x - mx) > far || Math.abs(c.y - my) > far) {
        this.critters.splice(i, 1);
        continue;
      }
      if (def.flock) continue;
      if (def.air) air++;
      else ground++;
    }
    if (life) {
      if (life.ground && ground < want.ground) this.spawnCritter(life.ground, cam, false);
      if (life.air && air < want.air) this.spawnCritter(life.air, cam, false);
    }
    // bat flocks cross the view now and then
    const fl = this.life.flocks;
    if (fl) {
      this.flockT -= dt;
      if (this.flockT <= 0) {
        this.flockT = rand(...fl.every);
        const n = Math.round(randInt(fl.size[0], fl.size[1]) * (this.reduced ? 0.5 : 1));
        const fromLeft = Math.random() < 0.5;
        const y0 = rand(cam.y + cam.h * 0.1, cam.y + cam.h * 0.7);
        for (let i = 0; i < n; i++) {
          this.critters.push({
            k: fl.kind,
            x: fromLeft ? cam.x - 40 - i * 26 : cam.x + cam.w + 40 + i * 26,
            y: y0 + rand(-40, 40),
            z: rand(30, 60),
            vx: (fromLeft ? 1 : -1) * rand(160, 210),
            vy: rand(-20, 20),
            seed: Math.random(),
          });
        }
      }
    }
  },

  /* ---- weather ---- */
  seedLayers(cam) {
    this.needsSeed = false;
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
    this.ambient = [];
    this.banks = [];
    this.clouds = [];
    this.vultures = [];
    const life = this.life;
    for (let i = 0; i < (life.fogBanks || 0); i++) {
      this.banks.push({ x: rand(-200, cam.w + 200), y: rand(0, cam.h), w: rand(260, 460), vx: rand(6, 16), seed: Math.random() });
    }
    for (let i = 0; i < (life.clouds || 0); i++) {
      this.clouds.push({ x: rand(-300, cam.w + 300), y: rand(-100, cam.h + 100), w: rand(260, 460), seed: Math.random() });
    }
    for (let i = 0; i < (life.vultures || 0); i++) {
      this.vultures.push({ x: rand(0, cam.w), y: rand(0, cam.h), a: rand(0, TAU), r: rand(60, 110), seed: Math.random() });
    }
    // initial critters: allowed in view so the arena doesn't start empty
    const want = this.critterTarget();
    const cl = life.critters || {};
    for (let i = 0; i < want.ground && cl.ground; i++) this.spawnCritter(cl.ground, cam, true);
    for (let i = 0; i < want.air && cl.air; i++) this.spawnCritter(cl.air, cam, true);
  },
  ambientTarget(kindDensity, cam) {
    const m = CONFIG.arenaLife.ambientDensity * (this.reduced ? CONFIG.arenaLife.reducedMult : 1);
    return Math.min(360, Math.round((kindDensity * m * cam.w * cam.h) / 1e6));
  },
  updateAmbient(dt, cam) {
    const dxc = cam.x - this.lastCamX,
      dyc = cam.y - this.lastCamY;
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
    // a teleport / respawn: don't smear everything across the screen
    const jump = Math.abs(dxc) > 400 || Math.abs(dyc) > 400;
    const M = 40;
    const W = cam.w + M * 2,
      H = cam.h + M * 2;
    const wrap = (p, m) => {
      if (p.x < -m) p.x += cam.w + m * 2;
      else if (p.x > cam.w + m) p.x -= cam.w + m * 2;
      if (p.y < -m) p.y += cam.h + m * 2;
      else if (p.y > cam.h + m) p.y -= cam.h + m * 2;
    };
    // particles: top up / trim each kind to its density
    const kinds = this.life.ambient || [];
    const counts = {};
    for (const p of this.ambient) counts[p.k] = (counts[p.k] || 0) + 1;
    for (const [k, dens] of kinds) {
      const want = this.ambientTarget(dens, cam);
      for (let n = counts[k] || 0; n < want; n++) {
        const p = { k, x: rand(-M, cam.w + M), y: rand(-M, cam.h + M), ph: Math.random() * 10 };
        AMBIENT_DEFS[k].init(p, this);
        this.ambient.push(p);
      }
      if ((counts[k] || 0) > Math.ceil(want * 1.2) + 2) {
        let drop = counts[k] - want;
        for (let i = this.ambient.length - 1; i >= 0 && drop > 0; i--) if (this.ambient[i].k === k) (this.ambient.splice(i, 1), drop--);
      }
    }
    for (const p of this.ambient) {
      const def = AMBIENT_DEFS[p.k];
      let vx = p.vx + (def.windy ? this.wind * (p.s === 3 ? 1.1 : 0.8) : 0);
      if (p.k === "pollen" || p.k === "petal" || p.k === "ash") vx += Math.sin(this.t * 1.3 + p.ph) * 8;
      p.x += vx * dt - (jump ? 0 : dxc * def.par);
      p.y += p.vy * dt - (jump ? 0 : dyc * def.par);
      wrap(p, M);
    }
    for (const b of this.banks) {
      b.x += b.vx * dt - (jump ? 0 : dxc * 0.92);
      b.y -= jump ? 0 : dyc * 0.92;
      wrap(b, b.w);
    }
    for (const c of this.clouds) {
      c.x += 16 * dt - (jump ? 0 : dxc);
      c.y += 5 * dt - (jump ? 0 : dyc);
      wrap(c, c.w);
    }
    for (const v of this.vultures) {
      v.a += dt * 0.5;
      v.x += 6 * dt - (jump ? 0 : dxc);
      v.y -= jump ? 0 : dyc;
      wrap(v, 200);
    }
    // falling leaves / smoke puffs (world space)
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      if (f.t >= f.max) {
        this.falling.splice(i, 1);
        continue;
      }
      if (f.k === "leaf") {
        if (f.t < f.land) {
          f.x += Math.sin(f.t * 4 + f.seed * 10) * 26 * dt;
          f.y += 34 * dt;
        }
      } else if (f.k === "smoke") {
        f.y -= 20 * dt;
        f.x += (this.wind * 0.3 + Math.sin(f.t * 2 + f.seed * 6) * 6) * dt;
      }
    }
    if (!this.reduced && this.falling.length < 60) {
      // leaves from visible tree canopies, smoke from visible vents
      if (Math.random() < dt * 0.9) {
        const trees = this.setPieces.filter((sp) => sp.kind === "tree" && this.onScreen(sp.x, sp.y, 120));
        if (trees.length) {
          const tr = choice(trees);
          this.falling.push({
            k: "leaf",
            x: tr.x + rand(-tr.canopy, tr.canopy) * 0.8,
            y: tr.y - 44 + rand(-tr.canopy * 0.6, tr.canopy * 0.3),
            t: 0,
            land: rand(1.2, 2.2),
            max: rand(3.5, 5),
            seed: Math.random(),
            c: choice(this.colors.canopy || ["#3a7a45"]),
          });
        }
      }
      if (this.hasVents) this.forVisibleDecor(cam, 40, (d) => {
        if (d.kind !== "smokevent") return;
        d.smokeT = (d.smokeT || rand(0, 0.8)) - dt;
        if (d.smokeT <= 0) {
          d.smokeT = rand(0.45, 0.8);
          this.falling.push({ k: "smoke", x: d.x + rand(-4, 4), y: d.y - 4, t: 0, max: 2.2, seed: Math.random() });
        }
      });
    }
  },
  onScreen(x, y, pad) {
    const cam = this.cam;
    return x > cam.x - pad && x < cam.x + cam.w + pad && y > cam.y - pad && y < cam.y + cam.h + pad;
  },
  updateEvents(dt, cam) {
    const life = this.life;
    if (life.lightning) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = rand(...life.lightning);
        this.flash = { t: 0 };
        // thunder spooks the crows off the graves
        for (const c of this.critters) if (this.onScreen(c.x, c.y, 100)) c.scared = true;
      }
    }
    if (this.flash) {
      this.flash.t += dt;
      if (this.flash.t > 0.5) this.flash = null;
    }
    if (life.drips) {
      this.dripT -= dt;
      if (this.dripT <= 0) {
        this.dripT = rand(...life.drips) * (this.reduced ? 2 : 1);
        let dx = rand(cam.x + 20, cam.x + cam.w - 20),
          dy = rand(cam.y + 60, cam.y + cam.h - 20);
        if (Math.random() < 0.5) {
          const wet = [];
          this.forVisibleDecor(cam, 0, (d) => d.kind === "puddle" && wet.push(d));
          for (const sp of this.setPieces) if (sp.kind === "pool" && this.onScreen(sp.x, sp.y, 0)) wet.push(sp);
          if (wet.length) {
            const w = choice(wet);
            dx = w.x + rand(-8, 8);
            dy = w.y + rand(-3, 3);
          }
        }
        this.drips.push({ x: dx, y: dy, t: 0 });
      }
      for (let i = this.drips.length - 1; i >= 0; i--) {
        const d = this.drips[i];
        d.t += dt;
        if (d.t >= 0.35) {
          // a ripple only where there's water to ripple; a splash anywhere else
          this.addMark({ k: this.inWater(d.x, d.y) ? "ripple" : "splat", x: d.x, y: d.y, t: 0, max: 0.7 });
          this.drips.splice(i, 1);
        }
      }
    }
    if (life.dustDevils) {
      this.devilT -= dt;
      if (this.devilT <= 0) {
        this.devilT = rand(...life.dustDevils);
        const left = Math.random() < 0.5;
        this.devils.push({
          x: left ? cam.x - 60 : cam.x + cam.w + 60,
          y: rand(cam.y + cam.h * 0.2, cam.y + cam.h * 0.9),
          vx: (left ? 1 : -1) * rand(50, 80),
          vy: rand(-12, 12),
          t: 0,
          max: (cam.w + 160) / 60,
        });
      }
      for (let i = this.devils.length - 1; i >= 0; i--) {
        const dv = this.devils[i];
        dv.t += dt;
        dv.x += dv.vx * dt;
        dv.y += dv.vy * dt;
        // anything light it passes gets swept up: grass leans, lizards bolt
        for (const c of this.critters) if (dist2(c.x, c.y, dv.x, dv.y) < 70 * 70) c.scared = true;
        if (dv.t > dv.max) this.devils.splice(i, 1);
      }
    }
  },

  /* ---------------- floor chunks ----------------
     The floor (tiles + dither + ground cover) and every STATIC decor kind
     are baked once into 512px chunk canvases and drawn as a few images a
     frame — measured: the per-frame version cost 0.8ms (floor) + most of
     1.5ms (decor) on desktop, which is ~5x that on a phone. Chunks are
     baked at 1 unit = 1 canvas px (memory doesn't grow with dpr), with a
     1px bleed on every side so neighbours overlap and no seam can open
     at fractional camera positions. LRU-capped; a broken rock re-bakes
     its chunks (decorChanged). Animated floor features (embers / glow)
     are remembered per chunk and drawn live on top. */
  chunks: new Map(),
  chunkFrame: 0,
  drawFloor(ctx, cam, floor, arena) {
    if (!floor) return;
    const CH = LIFE_CHUNK;
    const c0 = Math.max(0, Math.floor(cam.x / CH)),
      c1 = Math.min(Math.ceil(CONFIG.arena.width / CH) - 1, Math.floor((cam.x + cam.w) / CH));
    const r0 = Math.max(0, Math.floor(cam.y / CH)),
      r1 = Math.min(Math.ceil(CONFIG.arena.height / CH) - 1, Math.floor((cam.y + cam.h) / CH));
    this.chunkFrame++;
    let built = 0;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = c + r * 1000;
        let ch = this.chunks.get(key);
        if (!ch) {
          // bake at most 2 a frame; anything else this frame draws live
          if (built >= 2) {
            this.drawFloorRegion(ctx, floor, arena, c * CH, r * CH, CH, CH, -cam.x, -cam.y, null);
            ctx.save();
            ctx.beginPath();
            ctx.rect(c * CH - cam.x, r * CH - cam.y, CH, CH);
            ctx.clip();
            this.drawZonesRegion(ctx, c * CH, r * CH, CH, CH, -cam.x, -cam.y);
            ctx.restore();
            continue;
          }
          ch = this.bakeChunk(floor, arena, c, r);
          built++;
        }
        ch.used = this.chunkFrame;
        const x = c * CH - cam.x - 1,
          y = r * CH - cam.y - 1;
        ctx.drawImage(ch.canvas, x, y, CH + 2, CH + 2);
        for (const a of ch.anim) drawFloorFeature(ctx, a.x - cam.x, a.y - cam.y, a.kind, a.seed, arena.floorFeatureColor || "#000");
      }
    }
    ctx.imageSmoothingEnabled = prevSmooth;
    // LRU: keep what's on screen plus a margin (fewer on a small view)
    const cap = (c1 - c0 + 1) * (r1 - r0 + 1) + 8;
    if (this.chunks.size > cap) {
      const byAge = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < byAge.length - cap; i++) this.chunks.delete(byAge[i][0]);
    }
  },
  bakeChunk(floor, arena, c, r) {
    const CH = LIFE_CHUNK;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CH + 2;
    const g = canvas.getContext("2d");
    const x0 = c * CH,
      y0 = r * CH;
    const anim = [];
    // tiles one ring bigger so the bleed pixels are real neighbour pixels
    this.drawFloorRegion(g, floor, arena, x0 - FLOOR_CELL, y0 - FLOOR_CELL, CH + FLOOR_CELL * 2, CH + FLOOR_CELL * 2, 1 - x0, 1 - y0, anim, x0, y0);
    // zone tints are static per run — bake them too (they were six
    // 1000-1800px radial gradients filled every single frame)
    this.drawZonesRegion(g, x0 - 1, y0 - 1, CH + 2, CH + 2, 1 - x0, 1 - y0);
    // static decor overlapping this chunk (a rock on the edge bakes into both)
    const S = CONFIG.arenaLife.decorScale;
    const list = [];
    const pad = 60;
    const cc0 = Math.max(0, Math.floor((x0 - pad) / LIFE_CELL)),
      cc1 = Math.min(this.cols - 1, Math.floor((x0 + CH + pad) / LIFE_CELL));
    const rr0 = Math.max(0, Math.floor((y0 - pad) / LIFE_CELL)),
      rr1 = Math.floor((y0 + CH + pad) / LIFE_CELL);
    for (let rr = rr0; rr <= rr1; rr++)
      for (let cc = cc0; cc <= cc1; cc++) {
        const cell = this.cells[cc + rr * this.cols];
        if (!cell) continue;
        for (const d of cell) {
          if (d.broken) continue;
          const def = LIFE_DECOR[d.kind];
          if (!def || !def.static) continue;
          if (d.x < x0 - pad || d.x > x0 + CH + pad || d.y < y0 - pad || d.y > y0 + CH + pad) continue;
          list.push(d);
        }
      }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) {
      g.setTransform(S, 0, 0, S, Math.round(d.x - x0 + 1), Math.round(d.y - y0 + 1));
      LIFE_DECOR[d.kind].draw(g, d, this);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const ch = { canvas, anim, used: this.chunkFrame };
    this.chunks.set(c + r * 1000, ch);
    return ch;
  },
  // Draws the tiles of a world rect onto g, offset by (ox, oy). Collects
  // animated features (whose tile lies inside the chunk proper) into `anim`
  // instead of baking a frozen frame of them.
  drawFloorRegion(g, floor, arena, wx, wy, ww, wh, ox, oy, anim, cx0, cy0) {
    const { grid, cols, rows } = floor;
    const coverColor = (arena.life && arena.life.coverColor) || "rgba(0,0,0,0.25)";
    const fc = arena.floorFeatureColor || "#000";
    const col0 = Math.max(0, Math.floor(wx / FLOOR_CELL)),
      col1 = Math.min(cols - 1, Math.floor((wx + ww - 1) / FLOOR_CELL));
    const row0 = Math.max(0, Math.floor(wy / FLOOR_CELL)),
      row1 = Math.min(rows - 1, Math.floor((wy + wh - 1) / FLOOR_CELL));
    for (let r = row0; r <= row1; r++) {
      const row = grid[r];
      for (let c = col0; c <= col1; c++) {
        const t = row[c];
        const tx = c * FLOOR_CELL,
          ty = r * FLOOR_CELL;
        const x = tx + ox,
          y = ty + oy;
        g.fillStyle = t.color;
        g.fillRect(x, y, FLOOR_CELL, FLOOR_CELL);
        if (t.marks && t.marks.length) drawFloorMarks(g, x, y, t.marks, coverColor);
        if (!t.feature) continue;
        const animated = t.feature === "ember" || t.feature === "glow";
        if (!animated) drawFloorFeature(g, x, y, t.feature, t.seed, fc);
        else if (anim && tx >= cx0 && tx < cx0 + LIFE_CHUNK && ty >= cy0 && ty < cy0 + LIFE_CHUNK) anim.push({ x: tx, y: ty, kind: t.feature, seed: t.seed });
        else if (!anim) drawFloorFeature(g, x, y, t.feature, t.seed, fc);
      }
    }
  },
  // Zone tints (Game.zones) overlapping a world rect, offset by (ox, oy).
  drawZonesRegion(g, wx, wy, ww, wh, ox, oy) {
    const zones = Game.zones || [];
    for (const z of zones) {
      if (z.x + z.r < wx || z.x - z.r > wx + ww || z.y + z.r < wy || z.y - z.r > wy + wh) continue;
      const sx = z.x + ox,
        sy = z.y + oy;
      const grad = g.createRadialGradient(sx, sy, 0, sx, sy, z.r);
      grad.addColorStop(0, z.color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      const x0 = Math.max(wx + ox, sx - z.r),
        y0 = Math.max(wy + oy, sy - z.r);
      const x1 = Math.min(wx + ox + ww, sx + z.r),
        y1 = Math.min(wy + oy + wh, sy + z.r);
      if (x1 > x0 && y1 > y0) g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  },
  // A breakable was smashed (here or by a teammate): re-bake its chunks.
  decorChanged(d) {
    const CH = LIFE_CHUNK,
      pad = 60;
    const c0 = Math.floor((d.x - pad) / CH),
      c1 = Math.floor((d.x + pad) / CH);
    const r0 = Math.floor((d.y - pad) / CH),
      r1 = Math.floor((d.y + pad) / CH);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.chunks.delete(c + r * 1000);
  },

  /* ---------------- drawing ---------------- */
  drawGround(ctx, cam) {
    if (!this.cells) return;
    this.cam = cam;
    this.lights.length = 0;
    // set pieces (ground half)
    for (const sp of this.setPieces) {
      const pad = (sp.canopy || sp.r) + 60;
      if (!this.onScreen(sp.x, sp.y, pad)) continue;
      const def = SET_PIECE_DRAW[sp.kind];
      if (!def || !def.ground) continue;
      ctx.save();
      ctx.translate(Math.round(sp.x - cam.x), Math.round(sp.y - cam.y));
      def.ground(ctx, sp, this);
      ctx.restore();
    }
    // footprints / puffs / ripples
    for (const m of this.marks) {
      const sx = m.x - cam.x,
        sy = m.y - cam.y;
      if (sx < -30 || sy < -30 || sx > cam.w + 30 || sy > cam.h + 30) continue;
      const p = m.t / m.max;
      if (m.k === "print") {
        ctx.fillStyle = "rgba(70,110,150," + (0.45 * (1 - quantize(p, 4))).toFixed(3) + ")";
        ctx.fillRect(sx - 2, sy - 1, 4, 3);
      } else if (m.k === "puff") {
        const s = 3 + Math.floor(p * 3) * 2;
        ctx.fillStyle = "rgba(150,120,90," + (0.4 * (1 - p)).toFixed(3) + ")";
        ctx.fillRect(sx - s, sy - s / 2, s, s / 2);
        ctx.fillRect(sx + 1, sy - s / 2 - 2, s - 1, s / 2);
      } else if (m.k === "ripple") {
        // a flat pixel ring (rounded corners), growing in 4 steps
        const w = Math.round(4 + quantize(p, 4) * 14),
          h = Math.max(2, Math.round(w / 2));
        const x = Math.round(sx),
          y = Math.round(sy);
        ctx.fillStyle = "rgba(190,235,255," + (0.55 * (1 - p)).toFixed(3) + ")";
        ctx.fillRect(x - w + 2, y - h, w * 2 - 4, 2);
        ctx.fillRect(x - w + 2, y + h - 2, w * 2 - 4, 2);
        ctx.fillRect(x - w, y - h + 2, 2, h * 2 - 4);
        ctx.fillRect(x + w - 2, y - h + 2, 2, h * 2 - 4);
      } else if (m.k === "splat") {
        const s = 1 + Math.floor(p * 3);
        ctx.fillStyle = "rgba(159,220,240," + (0.6 * (1 - p)).toFixed(3) + ")";
        ctx.fillRect(Math.round(sx - 2 - s * 2), Math.round(sy - s), 2, 2);
        ctx.fillRect(Math.round(sx + s * 2), Math.round(sy - s), 2, 2);
        ctx.fillRect(Math.round(sx - 1), Math.round(sy - 1 - s * 2), 2, 2);
      }
    }
    if (!this.on) return;
    // vulture shadows circling over the wasteland
    for (const v of this.vultures) {
      const x = Math.round(v.x + Math.cos(v.a) * v.r),
        y = Math.round(v.y + Math.sin(v.a) * v.r * 0.6);
      const up = Math.floor(this.t * 3 + v.seed * 4) & 1;
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(x - 4, y - 2, 8, 5);
      ctx.fillRect(x - 16, y - (up ? 2 : 0), 12, 3);
      ctx.fillRect(x + 4, y - (up ? 2 : 0), 12, 3);
    }
    // dust devils (their ground shadow)
    for (const dv of this.devils) {
      ctx.fillStyle = "rgba(60,40,20,0.18)";
      ctx.fillRect(Math.round(dv.x - cam.x - 14), Math.round(dv.y - cam.y - 3), 28, 6);
    }
  },
  drawDecor(ctx, cam) {
    if (!this.cells) return;
    const vis = this.visible;
    vis.length = 0;
    this.forVisibleDecor(cam, 50, (d) => {
      const def = LIFE_DECOR[d.kind];
      if (def && !def.static) vis.push(d); // static kinds are baked into the floor chunks
    });
    vis.sort((a, b) => a.y - b.y); // back to front
    ctx.imageSmoothingEnabled = false;
    const S = CONFIG.arenaLife.decorScale;
    // one transform per item (no save/restore): base * translate * scale
    const m = ctx.getTransform();
    for (const d of vis) {
      const def = LIFE_DECOR[d.kind];
      const sx = Math.round(d.x - cam.x),
        sy = Math.round(d.y - cam.y);
      ctx.setTransform(m.a * S, m.b, m.c, m.d * S, m.e + sx * m.a + sy * m.c, m.f + sx * m.b + sy * m.d);
      if (def.sprite) {
        const sl = this.decorSprite(def, d);
        ctx.drawImage(sl.page, sl.sx, sl.sy, 48, 40, -24, -32, 48, 40);
      } else def.draw(ctx, d, this);
      if (def.light && this.on) {
        const [col, r, a] = def.light(d, this);
        this.addLight(d.x, d.y + (def.lightY || -6), col, r, a);
      }
    }
    ctx.setTransform(m);
    ctx.globalAlpha = 1;
    if (!this.on) return;
    // ground critters sit among the decor (air ones draw overhead)
    for (const c of this.critters) {
      const def = CRITTER_DEFS[c.k];
      if (def.air || (c.state === "fly" && c.z > 6)) continue;
      const sx = Math.round(c.x - cam.x),
        sy = Math.round(c.y - cam.y);
      if (sx < -30 || sy < -30 || sx > cam.w + 30 || sy > cam.h + 30) continue;
      this.drawCritter(ctx, def, c, sx, sy);
    }
  },
  // Critter art is drawn around (0,0) then scaled like the decor.
  drawCritter(ctx, def, c, sx, sy) {
    const S = CONFIG.arenaLife.decorScale;
    ctx.save();
    ctx.translate(sx, sy);
    if (S !== 1) ctx.scale(S, S);
    def.draw(ctx, c, this, 0, 0);
    ctx.restore();
  },
  drawOverhead(ctx, cam) {
    if (!this.cells) return;
    const cfg = CONFIG.arenaLife;
    // tree canopies — fade while you're under one so you never lose yourself
    const pl = Game.player;
    for (const sp of this.setPieces) {
      const def = SET_PIECE_DRAW[sp.kind];
      if (!def || !def.overhead) continue;
      if (!this.onScreen(sp.x, sp.y - 40, sp.canopy + 60)) continue;
      const under = pl && Math.abs(pl.x - sp.x) < sp.canopy && pl.y < sp.y + 10 && pl.y > sp.y - 44 - sp.canopy;
      sp.fade = sp.fade == null ? 1 : sp.fade + ((under ? cfg.canopyFade : 1) - sp.fade) * 0.2;
      ctx.save();
      ctx.globalAlpha = Math.round(sp.fade * 6) / 6; // stepped fade
      ctx.translate(Math.round(sp.x - cam.x), Math.round(sp.y - cam.y));
      def.overhead(ctx, sp, this);
      ctx.restore();
    }
    if (!this.on) return;
    // airborne critters
    for (const c of this.critters) {
      const def = CRITTER_DEFS[c.k];
      if (!def.air && !(c.state === "fly" && c.z > 6)) continue;
      const sx = Math.round(c.x - cam.x),
        sy = Math.round(c.y - cam.y);
      if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 120) continue;
      this.drawCritter(ctx, def, c, sx, sy);
    }
    // falling leaves + smoke
    for (const f of this.falling) {
      const sx = Math.round(f.x - cam.x),
        sy = Math.round(f.y - cam.y);
      if (sx < -20 || sy < -40 || sx > cam.w + 20 || sy > cam.h + 20) continue;
      if (f.k === "leaf") {
        ctx.globalAlpha = f.t > f.max - 1 ? f.max - f.t : 1;
        ctx.fillStyle = f.c;
        const flip = f.t < f.land && Math.floor(f.t * 6) & 1;
        ctx.fillRect(sx, sy, flip ? 2 : 4, flip ? 4 : 2);
      } else {
        const p = f.t / f.max;
        const s = 4 + Math.floor(p * 4) * 2;
        ctx.globalAlpha = 0.28 * (1 - p);
        ctx.fillStyle = "#5a524c";
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    // cavern drips (the falling drop)
    for (const d of this.drips) {
      const p = d.t / 0.35;
      ctx.fillStyle = "#9fdcf0";
      ctx.fillRect(Math.round(d.x - cam.x), Math.round(d.y - cam.y - 70 * (1 - p)), 2, 4);
    }
    // dust devils: dust spiralling up in stepped rings
    for (const dv of this.devils) {
      const bx = dv.x - cam.x,
        by = dv.y - cam.y;
      const a0 = Math.floor(this.t * 12) * 0.5;
      ctx.fillStyle = "rgba(184,154,112,0.55)";
      for (let i = 0; i < 12; i++) {
        const h = i * 5,
          rr = 4 + i * 1.4,
          a = a0 + i * 0.9;
        ctx.fillRect(Math.round(bx + Math.cos(a) * rr), Math.round(by - h + Math.sin(a) * rr * 0.3), 2, 2);
      }
    }
    // weather particles (screen-space)
    for (const p of this.ambient) {
      const def = AMBIENT_DEFS[p.k];
      let a = p.a;
      if (def.flicker) a *= lifeHash(Math.floor(this.t * 8), Math.floor(p.ph * 1000)) > 0.25 ? 1 : 0.4;
      if (def.twinkle) a *= Math.sin(this.t * 2 + p.ph) > 0 ? 1 : 0.4;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.k === "petal" ? 2 : p.s);
    }
    ctx.globalAlpha = 1;
    // wind streaks during a gust
    const w = this.life.wind;
    if (w && Math.abs(this.wind) > w.base * 2.5) {
      const n = this.reduced ? 3 : 8;
      const k = clamp((Math.abs(this.wind) - w.base * 2.5) / w.gust, 0, 1);
      ctx.fillStyle = "rgba(255,255,255," + (0.35 * k).toFixed(3) + ")";
      for (let i = 0; i < n; i++) {
        const y = lifeHash(i, 3) * cam.h;
        const x = (((lifeHash(i, 9) * cam.w + this.t * this.wind * 4) % (cam.w + 80)) + cam.w + 80) % (cam.w + 80) - 40;
        ctx.fillRect(Math.round(x), Math.round(y), 26, 1);
      }
    }
    // fog banks (graveyard) and cloud shadows (meadow) roll over everything
    for (const b of this.banks) {
      ctx.fillStyle = "#b8b8cc";
      ctx.globalAlpha = 0.05;
      ctx.fillRect(Math.round(b.x - b.w / 2), Math.round(b.y - 26), b.w, 52);
      ctx.fillRect(Math.round(b.x - b.w / 3), Math.round(b.y - 44), (b.w * 2) / 3, 88);
      ctx.fillRect(Math.round(b.x - b.w / 5), Math.round(b.y - 58), (b.w * 2) / 5, 116);
    }
    for (const c of this.clouds) {
      ctx.fillStyle = "#001400";
      ctx.globalAlpha = 0.07;
      ctx.fillRect(Math.round(c.x - c.w / 2), Math.round(c.y - c.w * 0.18), c.w, c.w * 0.36);
      ctx.fillRect(Math.round(c.x - c.w * 0.32), Math.round(c.y - c.w * 0.3), c.w * 0.64, c.w * 0.6);
    }
    ctx.globalAlpha = 1;
    // night tint, then lights on top of it (additive)
    if (this.life.tint) {
      ctx.fillStyle = this.life.tint;
      ctx.fillRect(-40, -40, cam.w + 80, cam.h + 80);
    }
    const L = this.lights;
    if (L.length) {
      // Cap: each light is a big additive quad (pure GPU fill). Beyond the
      // cap, only lights at least as strong (alpha x radius) as the cut-off
      // draw. Fewer when adaptive resolution says the device is struggling.
      const cap = (Game.renderLevel || 0) >= 2 ? CONFIG.arenaLife.maxLightsLow : CONFIG.arenaLife.maxLights;
      let minW = 0;
      const n = L.length / 5;
      if (n > cap) {
        const w = this._lw || (this._lw = []);
        w.length = 0;
        for (let i = 0; i < L.length; i += 5) w.push(L[i + 3] * L[i + 2]);
        w.sort((a, b) => b - a);
        minW = w[cap - 1];
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < L.length; i += 5) {
        const x = L[i],
          y = L[i + 1],
          r = L[i + 2];
        if (x < -r || y < -r || x > cam.w + r || y > cam.h + r) continue;
        if (minW && L[i + 3] * r < minW) continue;
        ctx.globalAlpha = Math.min(1, L[i + 3]);
        ctx.drawImage(LightCache.get(L[i + 4], r), Math.round(x - r), Math.round(y - r));
      }
      ctx.restore();
    }
  },
  drawScreen(ctx, cam) {
    if (!this.cells || !this.on) return;
    const life = this.life;
    if (life.aurora) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const bands = [
        ["#6fe3a3", 0.07, 0],
        ["#7fd8e8", 0.06, 1.7],
        ["#a970ff", 0.05, 3.1],
      ];
      const step = 16;
      for (const [col, a, off] of bands) {
        ctx.fillStyle = col;
        ctx.globalAlpha = a;
        for (let x = 0; x < cam.w; x += step) {
          const y = cam.h * 0.08 + Math.round(Math.sin(x * 0.006 + this.t * 0.35 + off) * 14 / 2) * 2 + off * 8;
          ctx.fillRect(x, y, step, 10 + Math.round((Math.sin(x * 0.013 + off) + 1) * 6));
        }
      }
      ctx.restore();
    }
    if (life.vignette) {
      let v = life.vignette;
      if (life.heatPulse) {
        const k = 0.75 + 0.25 * Math.round(((Math.sin(this.t * 0.9) + 1) / 2) * 3) / 3;
        v = v.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * k).toFixed(3) + ")");
      }
      ctx.drawImage(this.vignette(v, cam), 0, 0, cam.w, cam.h);
    }
    if (this.flash) {
      const t = this.flash.t;
      const a = t < 0.06 ? 0.34 : t < 0.12 ? 0 : t < 0.2 ? 0.24 : t < 0.35 ? 0.08 : 0;
      if (a) {
        ctx.fillStyle = "rgba(220,215,255," + a + ")";
        ctx.fillRect(0, 0, cam.w, cam.h);
      }
    }
  },
  // A soft edge-darkening, baked small once per colour and stretched.
  vignette(color, cam) {
    if (this._vig && this._vigColor === color) return this._vig;
    const c = this._vig || document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 160, 90);
    const grad = g.createRadialGradient(80, 45, 22, 80, 45, 95);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, 160, 90);
    this._vig = c;
    this._vigColor = color;
    return c;
  },
};
