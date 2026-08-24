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
