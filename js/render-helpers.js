"use strict";

/* =========================================================
   PARTICLE SYSTEM (particles + floating text combined)
   ========================================================= */
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
  }
  burst(x, y, color, count, opts) {
    opts = opts || {};
    const n = Game.settings.reducedParticles ? Math.ceil(count * 0.4) : count;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * TAU;
      const spd = rand(opts.minSpeed || 40, opts.maxSpeed || 220);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: rand(opts.minLife || 0.35, opts.maxLife || 0.9),
        age: 0,
        size: rand(opts.minSize || 2, opts.maxSize || 5),
        color: color || "#ffffff",
        gravity: opts.gravity || 0,
        fade: true,
        shape: opts.shape || "circle",
      });
    }
  }
  text(x, y, str, color, size) {
    this.texts.push({
      x,
      y,
      str,
      color: color || "#fff",
      size: size || 16,
      age: 0,
      life: 0.9,
      vy: -46,
    });
  }
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, 2.2 * dt);
      p.vy *= 1 - Math.min(1, 1.2 * dt);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age += dt;
      if (t.age >= t.life) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 1 - Math.min(1, 2 * dt);
    }
  }
  draw(ctx, cam) {
    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      const sx = p.x - cam.x,
        sy = p.y - cam.y;
      if (p.shape === "spark") {
        ctx.fillRect(sx - p.size / 2, sy - 1, p.size, 2);
      } else {
        ctx.fillRect(
          sx - p.size * (0.5 + a * 0.5),
          sy - p.size * (0.5 + a * 0.5),
          p.size * (1 + a),
          p.size * (1 + a),
        );
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = 1 - t.age / t.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `700 ${t.size}px Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = t.color;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.lineWidth = 3;
      const sx = t.x - cam.x,
        sy = t.y - cam.y;
      ctx.strokeText(t.str, sx, sy);
      ctx.fillText(t.str, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}

/* =========================================================
   CAMERA
   ========================================================= */
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.w = innerWidth;
    this.h = innerHeight;
  }
  resize(w, h) {
    this.w = w;
    this.h = h;
  }
  follow(px, py, dt) {
    const targetX = px - this.w / 2;
    const targetY = py - this.h / 2;
    this.x = lerp(this.x, targetX, Math.min(1, dt * 6));
    this.y = lerp(this.y, targetY, Math.min(1, dt * 6));
  }
  shake(mag, t) {
    if (!Game.settings.shake) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, t);
  }
  applyShake(ctx, dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * (this.shakeT > 0 ? 1 : 0);
      ctx.translate(rand(-m, m), rand(-m, m));
      this.shakeMag *= 0.9;
    }
  }
}

/* =========================================================
   ARENA DECORATION
   ========================================================= */
/* =========================================================
   FLOOR TILES — gives every arena an actual pixel-art ground
   instead of a flat void. Generated once per run as a grid of
   small tiles (with occasional feature marks), then only the
   tiles inside the camera view are drawn each frame.
   ========================================================= */
const FLOOR_CELL = 64;
function generateFloorTiles(arena) {
  const cols = Math.ceil(CONFIG.arena.width / FLOOR_CELL);
  const rows = Math.ceil(CONFIG.arena.height / FLOOR_CELL);
  const tiles = (arena && arena.floorTiles) || [
    { color: "#1c1830", weight: 1 },
  ];
  const features = (arena && arena.floorFeatures) || [];
  const featureChance = (arena && arena.floorFeatureChance) || 0;
  const grid = new Array(rows);
  const weighted = tiles.map((t) => ({ item: t.color, weight: t.weight }));
  for (let r = 0; r < rows; r++) {
    const row = new Array(cols);
    for (let c = 0; c < cols; c++) {
      const color = weightedPick(weighted);
      const hasFeature = features.length && Math.random() < featureChance;
      row[c] = {
        color,
        feature: hasFeature ? choice(features) : null,
        seed: Math.random(),
      };
    }
    grid[r] = row;
  }
  return { grid, cols, rows };
}
function drawFloorFeature(ctx, x, y, kind, seed, color) {
  const ox = 8 + seed * (FLOOR_CELL - 24),
    oy = 8 + ((seed * 13) % 1) * (FLOOR_CELL - 24);
  ctx.fillStyle = color;
  if (kind === "crack") {
    ctx.fillRect(x + ox, y + oy, 2, 9);
    ctx.fillRect(x + ox + 2, y + oy + 7, 2, 7);
    ctx.fillRect(x + ox - 2, y + oy + 12, 2, 5);
  } else if (kind === "patch") {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + ox, y + oy, 12, 9);
    ctx.globalAlpha = 1;
  } else if (kind === "dot") {
    ctx.fillRect(x + ox, y + oy, 4, 4);
    ctx.fillRect(x + ox + 6, y + oy + 3, 3, 3);
  } else if (kind === "pebble") {
    ctx.fillRect(x + ox, y + oy, 5, 4);
    ctx.fillRect(x + ox + 5, y + oy + 2, 4, 3);
  } else if (kind === "ember") {
    ctx.globalAlpha =
      0.55 + Math.sin(performance.now() / 300 + seed * 10) * 0.25;
    ctx.fillRect(x + ox, y + oy, 4, 4);
    ctx.globalAlpha = 1;
  } else if (kind === "glow") {
    ctx.globalAlpha = 0.4 + Math.sin(performance.now() / 450 + seed * 10) * 0.3;
    ctx.fillRect(x + ox, y + oy, 3, 3);
    ctx.globalAlpha = 1;
  }
}
function drawFloor(ctx, cam, floor, arena) {
  if (!floor) return;
  const { grid, cols, rows } = floor;
  const startCol = Math.max(0, Math.floor(cam.x / FLOOR_CELL) - 1);
  const endCol = Math.min(
    cols - 1,
    Math.ceil((cam.x + cam.w) / FLOOR_CELL) + 1,
  );
  const startRow = Math.max(0, Math.floor(cam.y / FLOOR_CELL) - 1);
  const endRow = Math.min(
    rows - 1,
    Math.ceil((cam.y + cam.h) / FLOOR_CELL) + 1,
  );
  for (let r = startRow; r <= endRow; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = startCol; c <= endCol; c++) {
      const t = row[c];
      if (!t) continue;
      const x = c * FLOOR_CELL - cam.x,
        y = r * FLOOR_CELL - cam.y;
      ctx.fillStyle = t.color;
      ctx.fillRect(x, y, FLOOR_CELL, FLOOR_CELL);
      if (t.feature)
        drawFloorFeature(
          ctx,
          x,
          y,
          t.feature,
          t.seed,
          arena.floorFeatureColor || "#000",
        );
    }
  }
}
function generateDecor(arena) {
  const palette = (arena && arena.decorPalette) || [
    "#3a3055",
    "#4a3f6b",
    "#2f2648",
  ];
  const kinds = (arena && arena.decorKinds) || [
    "rock",
    "bush",
    "flower",
    "crystal",
  ];
  const list = [];
  for (let i = 0; i < 70; i++) {
    const x = rand(120, CONFIG.arena.width - 120);
    const y = rand(120, CONFIG.arena.height - 120);
    if (dist(x, y, CONFIG.arena.width / 2, CONFIG.arena.height / 2) < 300)
      continue;
    list.push({
      x,
      y,
      kind: choice(kinds),
      c: choice(palette),
      seed: Math.random(),
    });
  }
  return list;
}
function generateZones(arena) {
  const colors = (arena && arena.zoneColors) || [
    "rgba(124,58,237,0.10)",
    "rgba(245,185,66,0.08)",
  ];
  const list = [];
  for (let i = 0; i < 6; i++) {
    list.push({
      x: rand(400, CONFIG.arena.width - 400),
      y: rand(400, CONFIG.arena.height - 400),
      r: rand(500, 900),
      color: choice(colors),
    });
  }
  return list;
}
function drawDecor(ctx, cam, decor) {
  for (const d of decor) {
    // Destructible decor (rock/crystal — see Game.updateDestructibles()):
    // once broken it's just gone, no rubble sprite to keep drawing.
    if (d.broken) continue;
    const sx = d.x - cam.x,
      sy = d.y - cam.y;
    if (sx < -40 || sx > cam.w + 40 || sy < -40 || sy > cam.h + 40) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = d.c;
    if (d.kind === "rock") {
      ctx.fillRect(-10, -6, 20, 14);
      ctx.fillRect(-6, -10, 12, 6);
    } else if (d.kind === "bush") {
      ctx.fillRect(-12, -4, 24, 10);
      ctx.fillRect(-8, -9, 16, 7);
      ctx.fillStyle = "#2f6b4a";
      ctx.fillRect(-10, -6, 20, 8);
    } else if (d.kind === "flower") {
      ctx.fillStyle = "#4a3f6b";
      ctx.fillRect(-2, -2, 4, 10);
      ctx.fillStyle = d.seed > 0.5 ? "#ff7ab8" : "#a970ff";
      ctx.fillRect(-6, -10, 4, 4);
      ctx.fillRect(2, -10, 4, 4);
      ctx.fillRect(-2, -14, 4, 4);
      ctx.fillRect(-2, -6, 4, 4);
    } else if (d.kind === "crystal") {
      ctx.fillStyle = "#7fd8e8";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (d.kind === "tombstone") {
      ctx.fillStyle = d.c;
      ctx.fillRect(-7, -14, 14, 18);
      ctx.beginPath();
      ctx.arc(0, -14, 7, Math.PI, 0);
      ctx.fill();
    } else if (d.kind === "deadtree") {
      ctx.strokeStyle = d.c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(0, -14);
      ctx.moveTo(0, -6);
      ctx.lineTo(-9, -16);
      ctx.moveTo(0, -10);
      ctx.lineTo(8, -18);
      ctx.stroke();
    } else if (d.kind === "fog") {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#c7c7d8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 10, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (d.kind === "ember") {
      ctx.fillStyle = "#ff9d4d";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (d.kind === "icecrystal") {
      ctx.fillStyle = "#bfe9ff";
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
function drawPixelStar(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size / 2, y - size * 1.5, size, size * 3);
  ctx.fillRect(x - size * 1.5, y - size / 2, size * 3, size);
}
function drawZones(ctx, cam, zones) {
  for (const z of zones) {
    const sx = z.x - cam.x,
      sy = z.y - cam.y;
    if (sx < -z.r || sx > cam.w + z.r || sy < -z.r || sy > cam.h + z.r)
      continue;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, z.r);
    g.addColorStop(0, z.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - z.r, sy - z.r, z.r * 2, z.r * 2);
  }
}

/* =========================================================
   REMOTE PLAYER (co-op) — a lightweight puppet renderer for teammates,
   NOT a second Player instance. Their real Player/buffs/tools only exist
   on their own machine (see CLAUDE.md "Multiplayer" — local-only per-
   player systems); everyone else just needs to see roughly where they
   are, their name, and their color. Reuses the same player.png + the
   same alpha-safe SpriteTint system as everything else — no new art,
   and never emoji, per the project's pixel-art rule.
   `puppet` is one entry of Game.mpPeers: {x, y, facing, color, name,
   moving, downed, animT} — x/y are the interpolation-smoothed render
   position Game keeps updating each frame, not the raw last-received
   network sample (see Game.mpUpdateRemotePuppets). */
function drawRemotePlayer(ctx, cam, puppet) {
  const sx = puppet.x - cam.x,
    sy = puppet.y - cam.y;
  if (sx < -60 || sx > cam.w + 60 || sy < -60 || sy > cam.h + 60) return;
  const radius = 18;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.9, radius * 0.9, radius * 0.35, 0, 0, TAU);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fill();
  const bob = puppet.moving
    ? Math.sin(quantize(((puppet.animT || 0) % TAU) / TAU, 6) * TAU) * 2.5
    : 0;
  ctx.translate(0, bob);
  if (Sprites.playerLoaded) {
    const size = radius * 2.8;
    ctx.imageSmoothingEnabled = false;
    const tinted = SpriteTint.getTinted("player", puppet.color, 0.6);
    ctx.globalAlpha = puppet.downed ? 0.5 : 1;
    ctx.scale(puppet.facing < 0 ? -1 : 1, 1);
    ctx.drawImage(tinted || Sprites.player, -size / 2, -size / 2, size, size);
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = puppet.color;
    ctx.globalAlpha = puppet.downed ? 0.5 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // name tag — plain canvas text, not DOM, so it scrolls with the world
  ctx.save();
  ctx.font = "bold 11px Consolas, 'Courier New', monospace"; // matches --font-pixel in css/style.css
  ctx.textAlign = "center";
  const label = puppet.name + (puppet.downed ? " (down)" : "");
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillText(label, sx + 1, sy - radius - 9);
  ctx.fillStyle = puppet.downed ? "#ff8a8a" : "#fff";
  ctx.fillText(label, sx, sy - radius - 10);
  ctx.restore();
}

/* =========================================================
   WORLD PICKUPS — drawn as a simple bobbing pixel diamond rather than
   pulling the icons.png DOM sprite sheet onto canvas (that sheet was
   never loaded as a Sprites entry, and adding a second image-loading
   path just for this felt like more machinery than a small ground item
   needs) — see PICKUP_DEFS in content.js.
   ========================================================= */
function drawPickup(ctx, cam, p) {
  const sx = p.x - cam.x,
    sy = p.y - cam.y + Math.sin(p.bob) * 4;
  if (sx < -30 || sx > cam.w + 30 || sy < -30 || sy > cam.h + 30) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.shadowColor = p.def.color;
  ctx.shadowBlur = 12;
  const s = 9 + Math.sin(p.bob * 1.3) * 1.5;
  ctx.fillStyle = p.def.color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.75, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.75, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(20,14,32,.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.5);
  ctx.lineTo(s * 0.1, -s * 0.1);
  ctx.lineTo(-s * 0.3, -s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* =========================================================
   JUMPSCARE MASCOT — "Mr. Squeeze". An ORIGINAL character invented for
   this game (not a reproduction of any existing copyrighted mascot) —
   the joke is that in a game about hugging, the one thing that hugs YOU
   is the scary part. Drawn as a real, swappable image asset
   (assets/jumpscare.png, loaded via the usual ASSETS/Sprites pattern in
   core.js — change how the jumpscare looks by replacing that file, no
   code edit needed) with the SAME quantized pop-in scale + jitter either
   way; if the sprite fails to load, drawJumpscareProcedural() below
   (the original hand-coded-primitives version) is the fallback, exactly
   like every other sprite in this project degrades gracefully. Drawn in
   screen space (ignores the camera, like the HUD) either way.
   ========================================================= */
// `videoReady` is Game.jumpscareVideoReady — false while the rewind seek
// is still in flight, during which the <video> element would hand us the
// PREVIOUS playthrough's last frame. We paint plain black for those few
// frames instead; see Game.triggerJumpscare()'s comment.
function drawJumpscareOverlay(ctx, cam, t, totalDuration, golden, videoReady) {
  const progress = clamp(1 - t / totalDuration, 0, 1);
  const scale = 0.7 + quantize(Math.min(1, progress * 3), 4) * 0.3;
  const cx = cam.w / 2,
    cy = cam.h * 0.56;
  const W = Math.min(cam.w, cam.h) * 0.62;
  const jitterX = golden ? 0 : Math.sin(performance.now() / 35) * 4;
  // Priority: VIDEO (if configured + loaded) > PNG > procedural drawing.
  // The video is drawn onto the game canvas like any other image source,
  // so it lives inside the game's own rendering rather than being a DOM
  // overlay — that keeps the CRT/scanline layer and screen flash on top
  // of it, and means it can't survive a state change that stops drawing.
  if (Videos.jumpscareLoaded && Videos.jumpscare) {
    if (!videoReady) {
      // Rewind still in flight — black, not a stale frame from last time.
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cam.w, cam.h);
      ctx.restore();
      return;
    }
    ctx.save();
    // A video jumpscare goes FULLSCREEN (unlike the PNG mascot, which is
    // a centered character) — that's the look people expect from one, and
    // it sidesteps having to crop an arbitrary-aspect clip into a square
    // box (which would slice the sides off a 4:3 face). Scaled to COVER
    // the whole canvas: preserves aspect ratio, overflows the short axis,
    // never letterboxes and never stretches.
    const vw = Videos.jumpscare.videoWidth || 16;
    const vh = Videos.jumpscare.videoHeight || 9;
    // The shared `scale` above starts at 0.7 (a stepped pop-in that suits
    // the PNG mascot, which is a centered character). Applying that to a
    // fullscreen video would shrink it BELOW full coverage and letterbox
    // it — so instead the video punches IN from 1.12x and settles to
    // exactly 1.0x, which reads as the same "slam into frame" beat while
    // never exposing an edge. Quantized, per the animation conventions.
    const punch = 1 + (1 - scale) * 0.4; // scale 0.7 -> 1.12, scale 1.0 -> 1.0
    const coverScale = Math.max(cam.w / vw, cam.h / vh) * punch;
    const dw = vw * coverScale,
      dh = vh * coverScale;
    // Black backdrop — belt-and-braces so the arena can never show
    // through even if a frame is somehow undersized.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.translate(cam.w / 2 + jitterX, cam.h / 2);
    if (golden) {
      ctx.shadowColor = "#ffd76a";
      ctx.shadowBlur = 40;
    }
    try {
      ctx.drawImage(Videos.jumpscare, -dw / 2, -dh / 2, dw, dh);
      // Golden variant: a gentle warm wash over the footage, since
      // SpriteTint can't be used here (it caches a one-off recolor of a
      // STATIC image; a video is a new frame every tick, so a per-frame
      // composite is the only option).
      // Deliberately a low-alpha plain source-over fill, NOT an "overlay"
      // blend — overlay massively amplifies contrast, which turned a
      // noisy/static video frame into an illegible gold mess. Keep this
      // subtle: the gold glow around the edges does most of the work.
      if (golden) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#ffd76a";
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    } catch (e) {
      // Frame not decodable yet (or the element went bad) — fall through
      // to the PNG/procedural path rather than dropping the whole scare.
      ctx.restore();
    }
  }
  if (Sprites.jumpscareLoaded) {
    ctx.save();
    ctx.translate(cx + jitterX, cy);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;
    // Golden variant: alpha-safe tint toward gold, same SpriteTint system
    // every other recolor in this game uses — never ctx.filter (see
    // CLAUDE.md "SpriteTint" for why: transparent-edge color fringing).
    const sprite = golden
      ? SpriteTint.getTinted("jumpscare", "#ffd76a", 0.6) || Sprites.jumpscare
      : Sprites.jumpscare;
    const size = W * 1.9;
    if (golden) {
      ctx.shadowColor = "#ffd76a";
      ctx.shadowBlur = 30;
    }
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }
  drawJumpscareProcedural(ctx, cx + jitterX, cy, W, scale, golden);
}
function drawJumpscareProcedural(ctx, cx, cy, W, scale, golden) {
  const bodyColor = golden ? "#ffd76a" : "#3a1030";
  const darkColor = golden ? "#a8791a" : "#150410";
  const eyeGlow = golden ? "#fff8e0" : "#ffffff";
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // body (big rounded blob, arms reaching wide — "wants to hug you")
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.56, W * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, W * 0.5, W * 0.44, 0, 0, TAU);
  ctx.fill();
  // arms
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(-W * 0.62, W * 0.05, W * 0.22, W * 0.13, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W * 0.62, W * 0.05, W * 0.22, W * 0.13, 0.4, 0, TAU);
  ctx.fill();
  // eyes — huge, white, tiny dark pupils that dart
  const eyeDX = Math.sin(performance.now() / 90) * W * 0.02;
  for (const side of [-1, 1]) {
    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.ellipse(side * W * 0.22, -W * 0.08, W * 0.15, W * 0.17, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#0a0510";
    ctx.beginPath();
    ctx.ellipse(
      side * W * 0.22 + eyeDX,
      -W * 0.06,
      W * 0.055,
      W * 0.065,
      0,
      0,
      TAU,
    );
    ctx.fill();
  }
  // wide jagged grin
  ctx.fillStyle = "#0a0510";
  ctx.beginPath();
  ctx.moveTo(-W * 0.3, W * 0.16);
  ctx.quadraticCurveTo(0, W * 0.34, W * 0.3, W * 0.16);
  ctx.quadraticCurveTo(0, W * 0.24, -W * 0.3, W * 0.16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  const teeth = 7;
  for (let i = 0; i < teeth; i++) {
    const tx = -W * 0.26 + (i / (teeth - 1)) * W * 0.52;
    ctx.beginPath();
    ctx.moveTo(tx - W * 0.03, W * 0.17);
    ctx.lineTo(tx + W * 0.03, W * 0.17);
    ctx.lineTo(tx, W * 0.24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
