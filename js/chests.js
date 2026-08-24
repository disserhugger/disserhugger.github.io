"use strict";

/* =========================================================
   CHEST SYSTEM
   ========================================================= */
/* Chest kind table — weights are relative and scaled by the player's chest luck.
   Add/tune kinds here without touching the spawn/open logic below. */
const CHEST_KINDS = {
  normal: {
    weight: 65,
    color: "#8a6a3f",
    lid: "#5f4527",
    glow: null,
    picks: 1,
  },
  rare: {
    weight: 27,
    color: "#f5b942",
    lid: "#c98f1e",
    glow: "#ffd76a",
    picks: 3,
  },
  legendary: {
    weight: 8,
    color: "#ff7ab8",
    lid: "#7c3aed",
    glow: "#a970ff",
    rainbow: true,
    picks: 5,
  },
};
class ChestSystem {
  constructor() {
    this.chests = [];
    this.timer = rand(8, 14);
  }
  reset() {
    this.chests = [];
    this.timer = rand(8, 14);
  }
  update(dt, elapsed, player, chestLuck) {
    this.timer -= dt;
    if (this.timer <= 0 && this.chests.length < 4) {
      this.spawn(player, chestLuck);
      this.timer = rand(11, 18) / Math.max(0.6, Math.min(2.0, chestLuck));
    }
    const openRadius = 30 + player.hugRadius * 0.6 + player.magnetLevel * 18;
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.bob += dt * 2;
      if (!c.opened) {
        const d = dist(player.x, player.y, c.x, c.y);
        if (
          player.magnetLevel > 0 &&
          d < openRadius * 2.4 &&
          d > openRadius * 0.4
        ) {
          const pull = Math.min(1, dt * 0.9 * player.magnetLevel);
          c.x = lerp(c.x, player.x, pull);
          c.y = lerp(c.y, player.y, pull);
        }
        if (d < openRadius) this.open(c);
      }
      if (c.opened) {
        c.openT += dt;
        if (c.openT > 0.6) this.chests.splice(i, 1);
      }
    }
  }
  pickKind(chestLuck) {
    const items = [];
    for (const k in CHEST_KINDS) {
      const def = CHEST_KINDS[k];
      let w = def.weight;
      if (k !== "normal") w *= clamp(chestLuck, 0.5, 2.5);
      items.push({ item: k, weight: w });
    }
    return weightedPick(items);
  }
  spawn(player, chestLuck) {
    const ang = Math.random() * TAU,
      r = rand(500, 900);
    const x = clamp(player.x + Math.cos(ang) * r, 60, CONFIG.arena.width - 60);
    const y = clamp(player.y + Math.sin(ang) * r, 60, CONFIG.arena.height - 60);
    const kind = this.pickKind(chestLuck);
    this.chests.push({
      x,
      y,
      bob: Math.random() * 10,
      kind,
      rare: kind !== "normal",
      opened: false,
      openT: 0,
    });
  }
  open(chest) {
    chest.opened = true;
    chest.openT = 0;
    AudioSystem.chest();
    const def = CHEST_KINDS[chest.kind];
    Game.particles.burst(
      chest.x,
      chest.y,
      def.glow || "#a970ff",
      chest.kind === "legendary" ? 40 : 26,
      { maxSpeed: 190, minLife: 0.4, maxLife: 0.8 },
    );
    Game.onChestOpened(chest);
  }
  draw(ctx, cam) {
    for (const c of this.chests) {
      const sx = c.x - cam.x,
        sy = c.y - cam.y + (c.opened ? 0 : Math.sin(c.bob) * 4);
      if (sx < -60 || sx > cam.w + 60 || sy < -60 || sy > cam.h + 60) continue;
      const def = CHEST_KINDS[c.kind];
      ctx.save();
      ctx.translate(sx, sy);
      if (def.glow) {
        ctx.shadowColor = def.rainbow
          ? `hsl(${(performance.now() / 6) % 360},90%,65%)`
          : def.glow;
        ctx.shadowBlur = c.opened ? 30 : 18;
      }
      if (c.opened) {
        // opening sequence: base box stays put, lid pops up + rotates open,
        // a pixel light-beam flashes out in quantized steps, then it's gone.
        const openFrac = quantize(Math.min(1, c.openT / 0.35), 4);
        ctx.globalAlpha = Math.max(0, 1 - c.openT / 0.6);
        ctx.fillStyle = def.rainbow
          ? `hsl(${(performance.now() / 6) % 360},80%,55%)`
          : def.color;
        ctx.fillRect(-16, -6, 32, 20);
        // light beam
        ctx.fillStyle = "rgba(255,255,255," + 0.5 * (1 - openFrac) + ")";
        ctx.fillRect(-10, -30, 20, 26);
        // lid, lifted and rotated back on a hinge
        ctx.save();
        ctx.translate(-14, -6);
        ctx.rotate(-openFrac * 1.9);
        ctx.fillStyle = def.lid;
        ctx.fillRect(0, -7, 32, 7);
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-16, -6, 32, 20);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = def.rainbow
          ? `hsl(${(performance.now() / 6) % 360},80%,55%)`
          : def.color;
        ctx.fillRect(-16, -6, 32, 20);
        ctx.fillStyle = def.lid;
        ctx.fillRect(-16, -6, 32, 7);
        ctx.strokeStyle = "rgba(0,0,0,.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-16, -6, 32, 20);
        ctx.beginPath();
        ctx.arc(0, -6, 4, 0, Math.PI, true);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
