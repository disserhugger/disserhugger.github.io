"use strict";

/* =========================================================
   PLAYER
   ========================================================= */
class Player {
  constructor() {
    this.x = CONFIG.arena.width / 2;
    this.y = CONFIG.arena.height / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;
    this.speedMult = 1;
    this.hugRadiusMult = 1;
    this.expMult = 1;
    this.cooldownMult = 1;
    this.luckMult = 1;
    this.blackHoleLevel = 0;
    this.stickyArmsLevel = 0;
    this.longArmsBonus = 0;
    this.bearHugLevel = 0;
    this.turboLevel = 0;
    this.turboBoostT = 0;
    this.timePocketLevel = 0;
    this.timePocketTimer = 999;
    this.magnetLevel = 0;
    this.doubleHugChance = 0;
    this.chestLuckMult = 1;
    this.facing = 1;
    this.hugFlashT = 0;
    this.animT = 0;
    this.moving = false;
    this.lungeT = 0;
    this.lungeVX = 0;
    this.lungeVY = 0;
    this.hurtFlashT = 0;
    this.trail = []; // afterimage points while turbo-boosted
    this.snowSlowMult = 1;
    this.guardianTotal = 0;
    this.guardianUsed = 0;
    this.adrenalineLevel = 0;
    // ---- co-op only (see CLAUDE.md "Multiplayer" section) ----
    this.medkits = 0; // consumable count, granted by hugging a Medkit Bayat
    this.downed = false; // co-op: replaces run-ending when timer hits 0, if a teammate is still up
    this.downedFlashT = 0; // brief pulse when going down/getting revived, purely visual
    this.invertControlsT = 0; // rare jumpscare outcome — see Game.triggerJumpscare()
  }
  get adrenalineMult() {
    if (!this.adrenalineLevel) return 1;
    const maxRef =
      Game.mode === "full" ? Game.maxStoredTime || 30 : CONFIG.arcade.duration;
    const frac = clamp((Game.timer || 0) / maxRef, 0, 1);
    const urgency = clamp(1 - frac * 2.5, 0, 1); // kicks in once time drops under ~40%
    return 1 + this.adrenalineLevel * 0.1 * urgency;
  }
  get speed() {
    let s = CONFIG.player.baseSpeed * this.speedMult;
    if (this.turboBoostT > 0) s *= 1 + (0.2 + this.turboLevel * 0.08);
    if (Game.arena) s *= Game.arena.playerSpeedMult;
    s *= this.snowSlowMult;
    s *= this.adrenalineMult;
    s *= this.combo10SpeedMult || 1; // Combo Milestone x10 — see Game.onComboMilestone()
    if (Game.hyperModeActive) s *= CONFIG.hyperMode.speedMult;
    if (Game.runModifier && Game.runModifier.playerSpeedRunMult) {
      s *= Game.runModifier.playerSpeedRunMult;
    }
    // Giant Mode event: the trade-off side (see hugRadius/draw() for the
    // reach/visual side of the same event).
    if (Game.activeEvent && Game.activeEvent.def.playerSpeedEventMult) {
      s *= Game.activeEvent.def.playerSpeedEventMult;
    }
    if (this.downed) s *= 0.18; // "can't move much" per spec — a crawl, not a stop
    return s;
  }
  get hugRadius() {
    // Giant Mode event: bigger reach to go with the bigger sprite (see
    // draw() for the visual side, speed getter for the trade-off side).
    const giantMult =
      (Game.activeEvent && Game.activeEvent.def.playerScaleEventMult) || 1;
    return (
      CONFIG.player.baseHugRadius *
      this.hugRadiusMult *
      (1 + this.longArmsBonus) *
      this.adrenalineMult *
      (this.boldHugsRadiusMult || 1) * // Bold Hugs: trades radius for reward
      giantMult
    );
  }
  get totalExpMult() {
    return CONFIG.player.baseExpMult * this.expMult;
  }
  get totalLuck() {
    return CONFIG.player.baseLuck * this.luckMult;
  }
  triggerHug(tx, ty) {
    this.hugFlashT = 0.2;
    this.lungeT = 0.18;
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.lungeVX = Math.cos(a) * 230;
    this.lungeVY = Math.sin(a) * 230;
    if (this.turboLevel > 0) this.turboBoostT = 0.5 + this.turboLevel * 0.12;
  }
  update(dt, input) {
    let dx = 0,
      dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    // Rare jumpscare outcome: inverted controls for a few seconds — see
    // Game.triggerJumpscare()'s "invert" branch. Reverse World event uses
    // the same flip, just gated on the active event instead of a timer.
    if (
      this.invertControlsT > 0 ||
      (Game.activeEvent && Game.activeEvent.def.invertControls)
    ) {
      dx = -dx;
      dy = -dy;
    }
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      this.facing = dx >= 0 ? 1 : -1;
    }
    if (this.turboBoostT > 0) this.turboBoostT -= dt;
    const targetVx = dx * this.speed,
      targetVy = dy * this.speed;
    this.vx = lerp(this.vx, targetVx, Math.min(1, dt * 10));
    this.vy = lerp(this.vy, targetVy, Math.min(1, dt * 10));
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      this.x += this.lungeVX * dt;
      this.y += this.lungeVY * dt;
    }
    this.x = clamp(this.x, this.radius, CONFIG.arena.width - this.radius);
    this.y = clamp(this.y, this.radius, CONFIG.arena.height - this.radius);
    if (this.hugFlashT > 0) this.hugFlashT -= dt;
    if (this.hurtFlashT > 0) this.hurtFlashT -= dt;
    if (this.invertControlsT > 0) this.invertControlsT -= dt;
    this.animT += dt * (this.moving ? 9 : 2.4);
    // pixel afterimage trail while turbo-boosted (dash effect)
    if (this.turboBoostT > 0) {
      this.trail.push({ x: this.x, y: this.y, t: 0 });
      if (this.trail.length > 6) this.trail.shift();
    } else if (this.trail.length) {
      this.trail.shift();
    }
    for (const p of this.trail) p.t += dt;
  }
  draw(ctx, cam) {
    // pixel afterimage trail (dash/turbo effect) — drawn as flat tinted silhouettes, fading in discrete steps
    if (this.trail.length > 1 && Sprites.playerLoaded) {
      for (let i = 0; i < this.trail.length - 1; i++) {
        const p = this.trail[i];
        const frac = i / (this.trail.length - 1);
        const tsx = p.x - cam.x,
          tsy = p.y - cam.y;
        const size = this.radius * 2.8;
        ctx.save();
        ctx.translate(tsx, tsy);
        ctx.globalAlpha = quantize(frac, 4) * 0.35;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          SpriteTint.getTinted("player", "#a970ff", 0.5) || Sprites.player,
          -size / 2,
          -size / 2,
          size,
          size,
        );
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    const sx = this.x - cam.x,
      sy = this.y - cam.y;
    ctx.save();
    ctx.translate(sx, sy);
    // shadow
    ctx.beginPath();
    ctx.ellipse(
      0,
      this.radius * 0.9,
      this.radius * 0.9,
      this.radius * 0.35,
      0,
      0,
      TAU,
    );
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.fill();
    // quantize the walk bob into discrete pixel-art "steps" instead of a smooth sine wave
    const walkStep = this.moving
      ? quantize((this.animT % TAU) / TAU, 6)
      : quantize(((this.animT * 0.4) % TAU) / TAU, 4);
    const bob = this.moving
      ? Math.sin(walkStep * TAU) * 2.5
      : Math.sin(walkStep * TAU) * 1;
    ctx.translate(0, bob);
    const tilt = clamp(this.vx / CONFIG.player.baseSpeed, -1, 1) * 0.14;
    const squashPulse = this.moving
      ? Math.abs(Math.sin(walkStep * TAU)) * 0.05
      : 0;
    const squashY = (this.hugFlashT > 0 ? 1.16 : 1) + squashPulse;
    const squashX = (this.hugFlashT > 0 ? 0.86 : 1) - squashPulse;
    // hurt flash: blink between normal and a solid red silhouette on a coarse duty cycle (classic i-frame flicker)
    const hurtBlink =
      this.hurtFlashT > 0 && Math.floor(this.hurtFlashT * 14) % 2 === 0;

    if (Sprites.playerLoaded) {
      ctx.save();
      ctx.rotate(tilt);
      ctx.scale(this.facing < 0 ? -squashX : squashX, squashY);
      if (this.turboBoostT > 0) {
        ctx.shadowColor = "#ffd76a";
        ctx.shadowBlur = 16;
      }
      // Giant Mode event: purely visual scale-up (collision/arena-bounds
      // stay tied to the real this.radius — only the sprite grows).
      const giantVisualMult =
        (Game.activeEvent && Game.activeEvent.def.playerScaleEventMult) || 1;
      const size = this.radius * 2.8 * giantVisualMult;
      ctx.imageSmoothingEnabled = false;
      const sprite = hurtBlink
        ? SpriteTint.getTinted("player", "#ff3b3b", 0.85) || Sprites.player
        : this.downed
          ? SpriteTint.getTinted("player", "#4a4a5a", 0.8) || Sprites.player
          : Sprites.player;
      if (this.downed) ctx.globalAlpha = 0.6;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      // ---- procedural fallback (used if player.png fails to load) ----
      ctx.save();
      ctx.rotate(tilt);
      const armSwing =
        this.hugFlashT > 0
          ? -0.9
          : this.moving
            ? Math.sin(this.animT * 1.6) * 0.5
            : 0.12;
      ctx.strokeStyle = "#ffd76a";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.7, -2);
      ctx.lineTo(
        -this.radius * 1.35 * this.facing * -1 +
          (this.hugFlashT > 0 ? this.facing * 10 : -6),
        -this.radius * 0.2 + armSwing * 10,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.7, -2);
      ctx.lineTo(
        this.radius * 1.35 * this.facing * -1 -
          (this.hugFlashT > 0 ? this.facing * -10 : 6),
        -this.radius * 0.2 - armSwing * 10,
      );
      ctx.stroke();
      const grad = ctx.createRadialGradient(
        -this.radius * 0.3,
        -this.radius * 0.4,
        2,
        0,
        0,
        this.radius * 1.3,
      );
      grad.addColorStop(0, "#c9aaff");
      grad.addColorStop(1, "#7c3aed");
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, TAU);
      ctx.fillStyle = this.hugFlashT > 0 ? "#ffd76a" : grad;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(255,255,255,.4)";
      ctx.stroke();
      ctx.fillStyle = "#1c1430";
      const eyeOff = this.radius * 0.32;
      const happy = this.hugFlashT > 0;
      ctx.beginPath();
      ctx.arc(-eyeOff * this.facing, -2, happy ? 1.5 : 2.6, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeOff * this.facing, -2, happy ? 1.5 : 2.6, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      if (happy) {
        ctx.arc(0, 4, 5, 0, Math.PI);
      } else {
        ctx.arc(0, 3, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
      }
      ctx.strokeStyle = "#1c1430";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

/* =========================================================
   BAYAT
   ========================================================= */
let BAYAT_UID = 1;
// Pool the Chaos Bayat's periodic re-tint picks from — deliberately reuses
// hues already used elsewhere in the game rather than inventing new ones.
const CHAOS_TINT_COLORS = [
  "#ff7ab8",
  "#7fd8e8",
  "#ffd76a",
  "#a970ff",
  "#6fe3a3",
  "#ff5c72",
];
class Bayat {
  constructor(type, x, y, difficulty) {
    this.id = BAYAT_UID++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius =
      CONFIG.bayatBaseRadius *
      type.sizeMult *
      (Game.runModifier && Game.runModifier.bayatSizeMult
        ? Game.runModifier.bayatSizeMult
        : 1);
    this.baseSpeed =
      CONFIG.bayatBaseSpeed *
      type.speedMult *
      (1 + difficulty * 0.35) *
      (Game.arena ? Game.arena.bayatSpeedMult : 1);
    if (type.bombType) this.baseSpeed *= CONFIG.bomb.movementSpeedMult;
    this.wanderAngle = Math.random() * TAU;
    this.animT = Math.random() * 10;
    this.frozenT = 0;
    this.slowT = 0;
    this.hookedT = 0;
    this.stunT = 0;
    this.alive = true;
    this.spawnT = 0.001;
    this.faceSeed = Math.random();
    this.throwCd = rand(0.5, CONFIG.snowball.throwCooldown);
    this.throwFlashT = 0;
    this.bombState = "idle";
    this.bombTimer = 0;
    this.flickerSeed = Math.random() * 10;
    this.anchorT = 0;
    this.anchorX = 0;
    this.anchorY = 0;
  }
  get effectiveSpeed() {
    let s = this.baseSpeed * (this.chaosSpeedMult || 1);
    // Panic / Slow Motion / Time Stop / Chaos Mode events (bayatSpeedMult).
    // Explicit undefined check, not truthiness — Time Stop's 0 is a
    // deliberate, meaningful value that a `if (...mult)` check would
    // silently skip (0 is falsy in JS).
    if (Game.activeEvent && Game.activeEvent.def.bayatSpeedMult !== undefined) {
      s *= Game.activeEvent.def.bayatSpeedMult;
    }
    // Fast World run modifier (see ARENA_MODIFIERS in content.js).
    if (Game.runModifier && Game.runModifier.bayatSpeedMult) {
      s *= Game.runModifier.bayatSpeedMult;
    }
    if (this.slowT > 0) s *= 0.35;
    if (this.frozenT > 0) s = 0;
    return s;
  }
  update(dt, player, others, blackHoleLevel) {
    if (this.spawnT < 1) this.spawnT = Math.min(1, this.spawnT + dt * 3.2);
    this.animT += dt * (this.effectiveSpeed > 4 ? 8 : 2.5);
    if (this.throwFlashT > 0) this.throwFlashT -= dt;
    // Ghost Bayat: cycles solid/phased regardless of any other state (CC,
    // spawn animation, etc). While phased it can't be hugged at all — see
    // the checkHugs() skip in game.js — but tool-pull effects still land
    // on it visually, so a phased ghost can drift around from being
    // yanked without you actually being able to catch it. `this.ghostTimer`
    // starts undefined; `(x||0)-dt` going negative on the very first frame
    // is the lazy-init, no constructor change needed.
    if (this.type.ghostType) {
      this.ghostTimer = (this.ghostTimer || 0) - dt;
      if (this.ghostTimer <= 0) {
        this.ghostPhased = !this.ghostPhased;
        this.ghostTimer = this.ghostPhased ? rand(1.0, 1.8) : rand(1.6, 2.6);
      }
    }
    // Chaos Bayat: periodically re-rolls its own speed and tint, purely
    // cosmetic + a speed wobble — reward itself is rolled separately at
    // hug-time (see Game.applyHugReward's chaosType branch), not tied to
    // this timer. Never mutates `this.type` (a SHARED object every Bayat
    // of this kind points to) — per-instance overrides only.
    if (this.type.chaosType) {
      this.chaosTimer = (this.chaosTimer || 0) - dt;
      if (this.chaosTimer <= 0) {
        this.chaosTimer = rand(1.8, 3.2);
        this.chaosSpeedMult = rand(0.6, 2.4);
        this.chaosTintColor = choice(CHAOS_TINT_COLORS);
        Game.particles.burst(this.x, this.y, this.chaosTintColor, 10, {
          maxSpeed: 100,
          minLife: 0.25,
          maxLife: 0.5,
        });
      }
    }
    if (this.frozenT > 0) {
      this.frozenT -= dt;
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vx *= 1 - Math.min(1, dt * 4);
      this.vy *= 1 - Math.min(1, dt * 4);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    if (this.slowT > 0) this.slowT -= dt;
    if (this.hookedT > 0) {
      this.hookedT -= dt;
      /* Pull toward whoever actually cast it. A remote peer's pull tools
         are relayed to the host (Game.mpOnBayatEffect) and tagged with
         their peer id; resolving that id LIVE each frame — rather than
         baking in the position at cast time — means the Bayat tracks
         them as they move, instead of being yanked to where they stood
         a moment ago. Falls back to `player` (the normal target) for
         solo play and for the host's own casts. */
      let puller = player;
      if (this.pullPeerId && Game.mpPeers) {
        const p = Game.mpPeers[this.pullPeerId];
        if (p) puller = p;
      }
      if (this.hookedT <= 0) this.pullPeerId = null;
      const a = Math.atan2(puller.y - this.y, puller.x - this.x);
      const pull = 620;
      this.vx = Math.cos(a) * pull;
      this.vy = Math.sin(a) * pull;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    if (this.anchorT > 0) {
      this.anchorT -= dt;
      const a = Math.atan2(this.anchorY - this.y, this.anchorX - this.x);
      const pull = 300;
      this.vx = Math.cos(a) * pull;
      this.vy = Math.sin(a) * pull;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    // slip mechanic — a small per-type chance each second to lose balance and
    // get briefly stunned. Doesn't apply while already controlled by a tool.
    if (
      (this.type.slipChance || 0) > 0 &&
      Math.random() < this.type.slipChance * dt
    ) {
      this.stunT = CONFIG.slip.stunDuration;
      this.vx *= 0.4;
      this.vy *= 0.4;
      Game.particles.burst(this.x, this.y + this.radius * 0.5, "#ffffff", 5, {
        maxSpeed: 70,
        minLife: 0.2,
        maxLife: 0.4,
        minSize: 1.5,
        maxSize: 3,
      });
      AudioSystem.slip();
      Game.slipsWatched = (Game.slipsWatched || 0) + 1;
      if (Game.slipsWatched >= 10) Game.checkAchievement("slips10");
      return;
    }
    let fx = 0,
      fy = 0;
    const dx = this.x - player.x,
      dy = this.y - player.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (this.type.ranged) {
      // Snowball Bayat: keeps its distance and lobs snowballs from range
      this.throwCd -= dt;
      const keep = CONFIG.snowball.keepDistance;
      if (d < keep) {
        fx += (dx / d) * 2.2;
        fy += (dy / d) * 2.2;
      } else if (d > keep * 1.4 && d < CONFIG.snowball.detectionRange) {
        fx -= (dx / d) * 0.5;
        fy -= (dy / d) * 0.5;
      }
      if (d < CONFIG.snowball.detectionRange && this.throwCd <= 0) {
        this.throwCd = CONFIG.snowball.throwCooldown * rand(0.85, 1.15);
        this.throwFlashT = 0.28;
        this.vx *= 0.3;
        this.vy *= 0.3;
        Game.spawnSnowball(this, player);
      }
    } else if (this.type.bombType) {
      this.updateBombState(dt, player, d);
      if (this.bombState === "idle" && d < CONFIG.bomb.detectionRange) {
        fx -= (dx / d) * 1.4;
        fy -= (dy / d) * 1.4;
      }
    } else if (this.type.flee) {
      const fleeRadius = 340;
      if (d < fleeRadius) {
        const w = 1 - d / fleeRadius;
        fx += (dx / d) * w * 2.4;
        fy += (dy / d) * w * 2.4;
      }
    } else {
      // Dangerous: stays lurking near the player rather than fleeing -
      // it only nudges away when the player gets uncomfortably close,
      // making it a hazard you have to actively steer around.
      if (d < 90) {
        fx += (dx / d) * 1.2;
        fy += (dy / d) * 1.2;
      } else if (d > 220) {
        fx -= (dx / d) * 0.5;
        fy -= (dy / d) * 0.5;
      }
    }
    if (blackHoleLevel > 0) {
      const bhRadius = 260 + blackHoleLevel * 40;
      if (d < bhRadius) {
        const w = (1 - d / bhRadius) * (0.5 + blackHoleLevel * 0.35);
        fx -= (dx / d) * w;
        fy -= (dy / d) * w;
      }
    }
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      if (o === this || !o.alive) continue;
      const ox = this.x - o.x,
        oy = this.y - o.y;
      const od2 = ox * ox + oy * oy;
      const minD = this.radius + o.radius + 18;
      if (od2 < minD * minD && od2 > 0.001) {
        const od = Math.sqrt(od2);
        const w = (1 - od / minD) * 1.1;
        fx += (ox / od) * w;
        fy += (oy / od) * w;
      }
    }
    this.wanderAngle += rand(-0.7, 0.7) * dt * (this.type.turnRate || 3);
    fx += Math.cos(this.wanderAngle) * (this.type.jitter || 0.35);
    fy += Math.sin(this.wanderAngle) * (this.type.jitter || 0.35);
    const margin = 160;
    if (this.x < margin) fx += ((margin - this.x) / margin) * 1.6;
    if (this.x > CONFIG.arena.width - margin)
      fx -= ((this.x - (CONFIG.arena.width - margin)) / margin) * 1.6;
    if (this.y < margin) fy += ((margin - this.y) / margin) * 1.6;
    if (this.y > CONFIG.arena.height - margin)
      fy -= ((this.y - (CONFIG.arena.height - margin)) / margin) * 1.6;

    const flen = Math.sqrt(fx * fx + fy * fy) || 0.0001;
    const nx = fx / flen,
      ny = fy / flen;
    const targetVx = nx * this.effectiveSpeed,
      targetVy = ny * this.effectiveSpeed;
    this.vx = lerp(this.vx, targetVx, Math.min(1, dt * 4.5));
    this.vy = lerp(this.vy, targetVy, Math.min(1, dt * 4.5));
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, this.radius, CONFIG.arena.width - this.radius);
    this.y = clamp(this.y, this.radius, CONFIG.arena.height - this.radius);
  }
  // Co-op, non-host clients only: the host runs the real AI via update()
  // above and periodically broadcasts {id, t, x, y} snapshots (see
  // Game.mpApplyBayatSnapshot); everyone else just visually lerps this
  // puppet's position toward the latest snapshot rather than simulating
  // AI locally — this is what "host-authoritative Bayats" means in
  // practice. Bob/animation still runs locally since it's purely
  // cosmetic and doesn't need to be network-accurate.
  updatePuppet(dt) {
    this.animT += dt * 6;
    // MUST advance spawnT here too. draw() scales the sprite by it for
    // the spawn-in pop (`const s = this.spawnT < 1 ? this.spawnT : 1`),
    // and it starts at 0.001 — so a puppet that never advances it is
    // drawn at 1/1000th size, i.e. completely invisible. That was the
    // "non-host players can't see any Bayats" bug: the Bayats were
    // present, alive and correctly positioned the whole time, just
    // scaled to nothing. Any future per-frame visual state added to
    // update() needs mirroring here for the same reason.
    if (this.spawnT < 1) this.spawnT = Math.min(1, this.spawnT + dt * 3.2);
    // Same reasoning for the CC/flash timers: update() is the only place
    // that decays them, and a non-host's own tools still SET them on
    // puppets (tools.js writes frozenT/slowT/etc to whatever is in the
    // list). Without decay here, one Gem of Time would leave every Bayat
    // frozen-tinted on the joiner's screen for the rest of the run.
    // Only the timers are decayed — never the movement they drive in
    // update(), because a puppet's position is the host's to decide.
    if (this.frozenT > 0) this.frozenT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.hookedT > 0) this.hookedT -= dt;
    if (this.anchorT > 0) this.anchorT -= dt;
    if (this.throwFlashT > 0) this.throwFlashT -= dt;
    if (this.netTargetX == null) return; // no snapshot yet — stay put
    /* SNAPSHOT INTERPOLATION (not extrapolation — this was changed after
       testing, see CLAUDE.md bug history).

       Bayats steer erratically on purpose: `wanderAngle += rand(-0.7,0.7)
       * turnRate` every frame, plus per-type jitter. Projecting a
       straight line forward from an entity that is about to turn is
       actively wrong — it overshoots, then snaps back when the truth
       arrives, which reads as rubber-banding. That's the classic reason
       shooters interpolate rather than extrapolate.

       So instead of guessing the future, we render slightly in the PAST:
       hold a short buffer of received samples and draw the position
       between the two that bracket (now - interpDelay). Every frame is
       then between two positions the host actually reported — never a
       guess, so it can never overshoot or snap.

       The cost is a small fixed visual delay, which is invisible here:
       hug arbitration checks only whether the host still has the Bayat
       ALIVE, never how close you were, so being a frame "behind" costs
       you nothing mechanically. */
    const buf = this.netBuf;
    if (!buf || buf.length === 0) return;
    const renderAt = performance.now() - Game.mpInterpDelay();

    // Newer than the whole buffer (packets stalled): hold at the newest
    // known position rather than inventing motion.
    const newest = buf[buf.length - 1];
    if (renderAt >= newest.t) {
      this.x = newest.x;
      this.y = newest.y;
      return;
    }
    // Older than the buffer (just spawned / big gap): snap to oldest.
    if (renderAt <= buf[0].t) {
      this.x = buf[0].x;
      this.y = buf[0].y;
      return;
    }
    for (let i = buf.length - 1; i > 0; i--) {
      const b = buf[i],
        a = buf[i - 1];
      if (renderAt >= a.t && renderAt <= b.t) {
        const span = b.t - a.t;
        const f = span > 0 ? (renderAt - a.t) / span : 1;
        this.x = a.x + (b.x - a.x) * f;
        this.y = a.y + (b.y - a.y) * f;
        return;
      }
    }
  }
  updateBombState(dt, player, d) {
    const cfg = CONFIG.bomb;
    if (this.bombState === "idle") {
      if (d < cfg.triggerRadius) {
        this.bombState = "warning";
        this.bombTimer = 0;
        AudioSystem.bombWarning();
      }
    } else if (this.bombState === "warning") {
      this.bombTimer += dt;
      if (d > cfg.cancelRadius) {
        this.bombState = "idle";
        this.bombTimer = 0;
      } else if (this.bombTimer >= cfg.warningDuration) {
        this.bombState = "critical";
        this.bombTimer = 0;
        AudioSystem.bombCritical();
      }
    } else if (this.bombState === "critical") {
      this.bombTimer += dt;
      if (d > cfg.cancelRadius) {
        this.bombState = "warning";
        this.bombTimer = 0;
      } else if (this.bombTimer >= cfg.criticalDuration) {
        Game.bombExplode(this);
      }
    }
  }
  drawBadge(ctx) {
    if (!Game.settings.badges || !this.type.badge) return;
    ctx.font = "700 11px Consolas, monospace";
    ctx.textAlign = "center";
    const by = -this.radius - 11;
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(-11, by - 9, 22, 14);
    ctx.fillStyle = this.type.badgeColor || "#fff";
    ctx.fillText(this.type.badge, 0, by + 1);
  }
  draw(ctx, cam) {
    const sx = this.x - cam.x,
      sy = this.y - cam.y;
    if (sx < -80 || sx > cam.w + 80 || sy < -80 || sy > cam.h + 80) return;
    ctx.save();
    ctx.translate(sx, sy);
    const s = this.spawnT < 1 ? this.spawnT : 1;
    const throwSquash = this.throwFlashT > 0 ? 0.85 : 1;
    ctx.scale(s, s * throwSquash);
    const bob = Math.sin(this.animT) * (this.type.key === "giant" ? 1.5 : 3);
    ctx.translate(0, bob);

    // ground shadow
    ctx.beginPath();
    ctx.ellipse(
      0,
      this.radius * 0.85,
      this.radius * 0.85,
      this.radius * 0.3,
      0,
      0,
      TAU,
    );
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.fill();

    // Bomb Bayat: tint flashes faster and brighter as detonation approaches
    let tintColorOverride = this.type.tintColor,
      tintStrengthOverride = this.type.tintStrength;
    // Chaos Bayat: its periodic re-roll overrides the type's own fixed
    // tint — see the chaosType branch in update().
    if (this.type.chaosType && this.chaosTintColor) {
      tintColorOverride = this.chaosTintColor;
      tintStrengthOverride = 0.65;
    }
    let bombBlink = false;
    if (this.type.bombType && this.bombState !== "idle") {
      const rate = this.bombState === "critical" ? 16 : 8;
      bombBlink = Math.floor(this.bombTimer * rate) % 2 === 0;
      if (bombBlink) {
        tintColorOverride = "#ff3b1a";
        tintStrengthOverride = 0.92;
      }
    }

    // Ghost Bayat: fades to near-invisible while phased, the visual tell
    // that it can't be hugged right now — see update()'s ghostType branch.
    const ghostAlpha =
      this.type.ghostType && this.ghostPhased ? 0.28 : 1;
    if (Sprites.bayatLoaded) {
      ctx.save();
      ctx.globalAlpha = ghostAlpha;
      const size = this.radius * 2.9;
      ctx.imageSmoothingEnabled = false;
      if (this.type.glow) {
        ctx.shadowColor = "#ffd76a";
        ctx.shadowBlur = 26;
      } else if (this.type.danger) {
        ctx.shadowColor = "rgba(255,60,80,.55)";
        ctx.shadowBlur = 12;
      } else if (bombBlink) {
        ctx.shadowColor = "rgba(255,80,30,.7)";
        ctx.shadowBlur = 18;
      }
      // alpha-safe tint: only visible pixels are recolored, transparent pixels
      // (and partially-transparent edge pixels) are left exactly as they were.
      const tinted =
        this.frozenT > 0
          ? SpriteTint.getTinted("bayat", "#9adfff", 0.55)
          : SpriteTint.getTinted(
              "bayat",
              tintColorOverride,
              tintStrengthOverride,
            );
      ctx.drawImage(tinted || Sprites.bayat, -size / 2, -size / 2, size, size);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      // ---- procedural fallback (used if bayat.png fails to load) ----
      if (this.type.glow) {
        ctx.shadowColor = "#ffd76a";
        ctx.shadowBlur = 22;
      } else if (this.type.danger) {
        ctx.shadowColor = "rgba(255,92,114,.5)";
        ctx.shadowBlur = 10;
      }
      const g = ctx.createRadialGradient(
        -this.radius * 0.3,
        -this.radius * 0.35,
        1,
        0,
        0,
        this.radius * 1.25,
      );
      g.addColorStop(0, this.type.color);
      g.addColorStop(1, this.type.dark);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, TAU);
      ctx.fillStyle = this.frozenT > 0 ? "#bfe9ff" : g;
      ctx.fill();
      ctx.lineWidth = this.type.danger ? 3 : 2;
      ctx.strokeStyle = this.type.danger ? "#ff5c72" : "rgba(255,255,255,.35)";
      ctx.stroke();
      ctx.shadowBlur = 0;
      const scared = this.type.flee;
      ctx.fillStyle = "#1c1430";
      const eo = this.radius * 0.3;
      if (this.type.danger) {
        ctx.strokeStyle = "#1c1430";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-eo - 4, -eo * 0.5 - 2);
        ctx.lineTo(-eo + 4, -eo * 0.5 + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eo - 4, -eo * 0.5 + 2);
        ctx.lineTo(eo + 4, -eo * 0.5 - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-eo, 0, 2.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eo, 0, 2.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, this.radius * 0.35, 3.4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else {
        const wobble = Math.sin(this.animT * 2 + this.faceSeed * 6) * 1.2;
        ctx.beginPath();
        ctx.arc(-eo, -1 + wobble, scared ? 3.2 : 2.6, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eo, -1 - wobble, scared ? 3.2 : 2.6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#1c1430";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (scared)
          ctx.arc(0, this.radius * 0.32, 3.6, Math.PI * 0.15, Math.PI * 0.85);
        else ctx.arc(0, this.radius * 0.25, 3, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
      if (this.frozenT > 0) {
        ctx.fillStyle = "rgba(150,220,255,.35)";
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 3, 0, TAU);
        ctx.fill();
      }
    }
    // fuse + spark accessory — makes the Bomb Bayat read as an obvious explosive
    if (this.type.bombType) {
      const fuseTop = -this.radius - 7;
      ctx.strokeStyle = "#6b4a26";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(2, fuseTop);
      ctx.stroke();
      if (bombBlink) {
        ctx.fillStyle = this.bombState === "critical" ? "#fff59d" : "#ffb066";
        ctx.beginPath();
        ctx.arc(
          2,
          fuseTop - 2,
          this.bombState === "critical" ? 3.5 : 2.5,
          0,
          TAU,
        );
        ctx.fill();
      }
    }
    // slip/stun indicator — small pixel stars circling above the head (no emoji)
    if (this.stunT > 0) {
      const starY = -this.radius - 15;
      for (let i = 0; i < 3; i++) {
        const ang = performance.now() / 260 + i * (TAU / 3);
        drawPixelStar(
          ctx,
          Math.cos(ang) * 9,
          starY + Math.sin(ang) * 3,
          3,
          "#ffe27a",
        );
      }
    }
    this.drawBadge(ctx);
    ctx.restore();
    if (this.type.glow && Game.particles && Math.random() < 0.5) {
      Game.particles.burst(
        this.x + rand(-6, 6),
        this.y + rand(-6, 6),
        "#ffd76a",
        1,
        {
          minLife: 0.25,
          maxLife: 0.45,
          minSize: 1.5,
          maxSize: 3,
          minSpeed: 5,
          maxSpeed: 20,
        },
      );
    }
  }
}

/* =========================================================
   BAYAT MANAGER
   ========================================================= */
class BayatManager {
  constructor() {
    this.list = [];
    this.spawnTimer = 0;
  }
  reset() {
    this.list = [];
    this.spawnTimer = 0;
  }
  difficulty(elapsed) {
    return clamp(elapsed / CONFIG.spawn.rampDuration, 0, 1);
  }
  pickType(diff, luck) {
    const pool = [];
    for (const key in BAYAT_TYPES) {
      const t = BAYAT_TYPES[key];
      if (diff < t.minDiff) continue;
      // Medkits only matter in co-op (they revive downed teammates) — keep
      // them out of the single-player pool entirely rather than spawning
      // a pickup with no use. Co-op runs always use "full" mode semantics
      // (timer-as-health) — Game.coop is the orthogonal flag for "this
      // run is networked", not a third Game.mode value; see CLAUDE.md
      // "Multiplayer" section.
      if (t.medkitType && !Game.coop) continue;
      let w = t.weightBase;
      // Golden Minute / Chaos Mode events (goldenWeightMult) heavily
      // favor Golden and Diamond spawns while active.
      const ev = Game.activeEvent && Game.activeEvent.def;
      const evLuck = ev && ev.luckMult ? luck * ev.luckMult : luck;
      if (t.key === "golden") w *= evLuck * (ev && ev.goldenWeightMult ? ev.goldenWeightMult : 1);
      if (t.diamondType) w *= evLuck * (ev && ev.goldenWeightMult ? ev.goldenWeightMult : 1);
      if (t.key === "dangerous")
        w *=
          (1 + diff * 0.6) *
          (Game.arena ? Game.arena.spawnDangerMult : 1) *
          (Game.runModifier && Game.runModifier.dangerWeightMult
            ? Game.runModifier.dangerWeightMult
            : 1);
      pool.push({ item: t, weight: w });
    }
    return weightedPick(pool);
  }
  spawnOne(player, diff, luck) {
    const type = this.pickType(diff, luck);
    let x,
      y,
      tries = 0;
    do {
      const ang = Math.random() * TAU;
      const r = rand(420, 780);
      x = clamp(player.x + Math.cos(ang) * r, 60, CONFIG.arena.width - 60);
      y = clamp(player.y + Math.sin(ang) * r, 60, CONFIG.arena.height - 60);
      tries++;
    } while (dist(x, y, player.x, player.y) < 300 && tries < 8);
    const n = new Bayat(type, x, y, diff);
    this.list.push(n);
    if (type.key === "golden") Game.onGoldenEvent();
    else if (type.diamondType) Game.onDiamondEvent();
    else if (type.miniBoss) Game.onMiniBossEvent(type);
    return n;
  }
  // `extraSpawnAnchors` (co-op host only — see CLAUDE.md "Multiplayer"):
  // remote peers' puppet positions (Game.mpPeers), so new Bayats populate
  // near whichever player is actually exploring, not just the host. Bayat
  // AI itself (Bayat.update() below) still only reacts to the host's own
  // `player` — a Bayat spawned near a remote peer won't flee/chase them,
  // it'll just sit there until that peer's local checkHugs() catches it.
  // A real fix needs per-Bayat "nearest of N players" targeting, which is
  // a bigger change than this — see CLAUDE.md known gaps.
  update(dt, elapsed, player, blackHoleLevel, extraSpawnAnchors) {
    const diff = this.difficulty(elapsed);
    // Hyper Hug Mode and spawn-flavored random events (Bayat Rush, Bayat
    // Stampede, ...) both push spawn density/speed through these two
    // multipliers rather than their own bespoke code paths — see
    // CONFIG.hyperMode.spawnRateMult and each event def's `spawnMult` in
    // content.js's EVENT_POOL.
    let densityMult = player.curseSpawnMult || 1;
    let speedMult = 1;
    if (Game.hyperModeActive) {
      densityMult *= CONFIG.hyperMode.spawnRateMult;
      speedMult *= CONFIG.hyperMode.spawnRateMult;
    }
    if (Game.activeEvent && Game.activeEvent.def.spawnMult) {
      densityMult *= Game.activeEvent.def.spawnMult;
      speedMult *= Game.activeEvent.def.spawnMult;
    }
    const targetCount = Math.round(
      lerp(CONFIG.spawn.initialCount, CONFIG.spawn.maxCount, diff) *
        densityMult,
    );
    const interval =
      lerp(CONFIG.spawn.baseInterval, CONFIG.spawn.minInterval, diff) /
      speedMult;
    this.spawnTimer -= dt;
    if (this.list.length < targetCount && this.spawnTimer <= 0) {
      const anchor =
        extraSpawnAnchors && extraSpawnAnchors.length && Math.random() < 0.5
          ? choice(extraSpawnAnchors)
          : player;
      this.spawnOne(anchor, diff, player.totalLuck);
      this.spawnTimer = interval;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i];
      if (!n.alive) {
        this.list.splice(i, 1);
        continue;
      }
      /* AI targets the NEAREST player, not unconditionally the host.
         Previously every Bayat chased/fled the host's own player, so on
         a joiner's screen Bayats simply ignored them — they'd sit
         motionless while you walked up, or flee toward you because they
         were running from someone across the map. That reads as broken
         far more than latency does.

         `player` (the host's own) stays the fallback, so solo play takes
         the identical path it always did. */
      let target = player;
      if (extraSpawnAnchors && extraSpawnAnchors.length) {
        let best = dist2(n.x, n.y, player.x, player.y);
        for (const a of extraSpawnAnchors) {
          if (!a || a.downed) continue; // a downed teammate isn't a threat to flee
          const d = dist2(n.x, n.y, a.x, a.y);
          if (d < best) {
            best = d;
            target = a;
          }
        }
      }
      n.update(dt, target, this.list, blackHoleLevel);
    }
  }
  // Co-op, non-host clients: called instead of update() above — no
  // spawning, no AI, just cosmetic per-frame animation of whatever
  // puppets the latest host snapshot put here.
  updateAsPuppets(dt) {
    for (const n of this.list) n.updatePuppet(dt);
  }
  // Co-op, non-host clients: reconciles this.list against the host's
  // latest {id, t, x, y} snapshot array — adds puppets for newly-seen
  // ids, updates lerp targets for existing ones, and drops anything the
  // host no longer lists (it died — a hugResult already handled the
  // death fx locally, this is just cleanup for ids we somehow missed,
  // e.g. this client joined mid-run and never saw the original spawn).
  applySnapshot(list, difficulty) {
    const now = performance.now();
    const seen = {};
    for (const s of list) {
      seen[s.id] = true;
      let n = this.list.find((b) => b.id === s.id);
      if (!n) {
        const type = BAYAT_TYPES[s.t];
        if (!type) continue; // unknown type key — ignore rather than throw
        n = new Bayat(type, s.x, s.y, difficulty || 0);
        n.id = s.id;
        this.list.push(n);
      }
      /* Push into the interpolation buffer that updatePuppet() reads.
         Kept small — only enough history to cover the render delay plus
         a couple of dropped packets; anything older is dead weight. */
      if (!n.netBuf) n.netBuf = [];
      n.netBuf.push({ t: now, x: s.x, y: s.y });
      while (n.netBuf.length > 12) n.netBuf.shift();
      n.netStamp = now;
      n.netTargetX = s.x;
      n.netTargetY = s.y;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!seen[this.list[i].id]) this.list.splice(i, 1);
    }
  }
  nearest(x, y, filterFn) {
    let best = null,
      bd = Infinity;
    for (const n of this.list) {
      if (!n.alive) continue;
      if (filterFn && !filterFn(n)) continue;
      const d = dist2(x, y, n.x, n.y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }
  inRadius(x, y, r) {
    const out = [];
    const r2 = r * r;
    for (const n of this.list) {
      if (n.alive && dist2(x, y, n.x, n.y) <= r2) out.push(n);
    }
    return out;
  }
  densestCluster(x, y, r) {
    const candidates = this.inRadius(x, y, r);
    if (!candidates.length) return null;
    let best = candidates[0],
      bestScore = -1;
    for (const c of candidates) {
      let score = 0;
      for (const o of candidates) {
        if (o !== c && dist(c.x, c.y, o.x, o.y) < 150) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }
  draw(ctx, cam) {
    for (const n of this.list) n.draw(ctx, cam);
  }
}
