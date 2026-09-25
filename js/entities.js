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
    // Momentum buff: faster the longer your combo runs (capped).
    if (this.momentumLevel) {
      const cfg = CONFIG.momentum;
      s *= 1 + Math.min(cfg.capPerLevel * this.momentumLevel, (Game.combo || 0) * cfg.perCombo * this.momentumLevel);
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
    if (type.patrolType) {
      this.baseSpeed *= CONFIG.nasser.speedMult * (type.patrolSpeedMult || 1);
      this.legLength = CONFIG.nasser.legLength * (type.legMult || 1);
      this.patrolPauseT = 0;
      // A valid default leg so every creation path (co-op puppets, tests)
      // has patrol state. BayatManager.spawnPatrol() replaces it with a
      // validated, grid-snapped one for real spawns.
      this.initPatrol(Math.random() < 0.5 ? "h" : "v", Math.random() < 0.5 ? 1 : -1);
    }
    if (type.havaType) {
      // See CLAUDE.md "Havas". hunting -> leaving -> (captured | escaped)
      this.havaState = "hunting";
      this.huntT = CONFIG.hava.huntDuration;
      this.meals = 0;
      this.bankExp = 0; // banked at CONFIG.hava.bankMult x each meal's value
      this.bankTime = 0;
      this.baseRadius = this.radius;
      this.retargetT = 0;
      this.prey = null;
      this.havaVer = 1; // bumps on every change the co-op host must re-send
      this.havaKnown = true;
    }
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
  /* Things NO tool may pull: Dangerous Bayats (hugging them costs time)
     and pull-immune Dissers/Nassers (the Bulldozer — its face costs time
     too, so dragging it into you would be a trap). Explosive Bomb Bayats
     are deliberately NOT here: pulling a bomb in to hug it is the play. */
  get noPull() {
    return !!(this.type.danger || this.type.pullImmune);
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
    // Central pull guard: tools (~27 sites in tools.js) and co-op relayed
    // effects all pull by setting hookedT/anchorT, so dropping them HERE
    // for no-pull types covers every tool, including ones added later.
    if (this.noPull && (this.hookedT > 0 || this.anchorT > 0)) {
      this.hookedT = 0;
      this.anchorT = 0;
      this.pullPeerId = null;
    }
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
    // Nassers: checked BEFORE the steering chain below, whose final else
    // assumes "!flee means dangerous lurker". A Nasser isn't steered by
    // forces at all — no flee, no separation, no wander, no Black Hole
    // drift — it just walks its lane. Tool CC (freeze/stun/hook/anchor)
    // still lands via the early returns above, exactly like any Bayat.
    if (this.type.patrolType) {
      this.updatePatrol(dt);
      return;
    }
    // Havas: same reasoning — their own movement, no steering forces.
    // `others` is the FULL list for them (BayatManager passes it), since
    // they hunt across the whole huntRange, not just neighbouring cells.
    if (this.type.havaType) {
      this.updateHava(dt, others);
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
  /* ---- Hava (havaType) — see CLAUDE.md "Havas" ----
     HUNTING: chase the best prey in huntRange and eat it on contact.
     Dangerous prey (Dangerous Bayats, Bulldozers) get a `dangerPriority`
     head start, so a Hava goes for them first unless a huggable one is a
     LOT closer — cleaning up what you can't hug is their whole purpose.
     LEAVING: after huntDuration or a full stomach, walk (slower) to the
     nearest arena edge. That's the only window capture tools work in.
     Reaching the edge = escaped, bank and all. */
  isHavaPrey(n) {
    return (
      n !== this &&
      n.alive &&
      !n.type.havaType &&
      !n.type.medkitType && // a co-op revive item isn't food
      !(n.type.ghostType && n.ghostPhased) &&
      n.spawnT >= 1
    );
  }
  pickHavaPrey(list) {
    const cfg = CONFIG.hava;
    const r2 = cfg.huntRange * cfg.huntRange;
    let best = null,
      bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (!this.isHavaPrey(n)) continue;
      const d2 = dist2(this.x, this.y, n.x, n.y);
      if (d2 > r2) continue;
      const score = Math.sqrt(d2) - (n.noPull ? cfg.dangerPriority : 0);
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return best;
  }
  // What a meal is worth to the bank: bankMult x the value a hug of it
  // would give (same 6*expMult / baseTimeReward*rewardMult base as
  // applyHugReward). Dangerous prey have no hug value, so they bank at
  // dangerPreyExpMult/TimeMult instead — eating them still pays.
  havaMealValue(prey) {
    const cfg = CONFIG.hava;
    const bad = prey.type.danger || prey.type.pullImmune;
    const expMult = bad ? cfg.dangerPreyExpMult : Math.max(0, prey.type.expMult);
    const timeMult = bad ? cfg.dangerPreyTimeMult : Math.max(0, prey.type.rewardMult);
    return {
      exp: cfg.bankMult * 6 * expMult,
      time: cfg.bankMult * CONFIG.full.baseTimeReward * timeMult * Game.timeRewardFactor(),
    };
  }
  havaEat(prey) {
    const cfg = CONFIG.hava;
    prey.alive = false;
    const v = this.havaMealValue(prey);
    this.bankExp += v.exp;
    this.bankTime += v.time;
    this.meals++;
    this.radius = Math.min(this.baseRadius * cfg.maxGrowthMult, this.radius + cfg.growPerMeal);
    this.havaVer++;
    this.prey = null;
    Game.onHavaEat(this, prey);
    if (this.meals >= cfg.stomachSize) this.havaStartLeaving();
  }
  havaStartLeaving() {
    if (this.havaState === "leaving") return;
    this.havaState = "leaving";
    // exit through the nearest wall
    const W = CONFIG.arena.width,
      H = CONFIG.arena.height;
    const opts = [
      { d: this.x, x: 0, y: this.y },
      { d: W - this.x, x: W, y: this.y },
      { d: this.y, x: this.x, y: 0 },
      { d: H - this.y, x: this.x, y: H },
    ];
    opts.sort((a, b) => a.d - b.d);
    this.exitX = opts[0].x;
    this.exitY = opts[0].y;
    this.havaVer++;
    Game.onHavaLeaving(this);
  }
  updateHava(dt, list) {
    const cfg = CONFIG.hava;
    let tx = null,
      ty = null,
      sp = this.effectiveSpeed; // slows/freezes/Time Stop still apply
    if (this.havaState === "hunting") {
      this.huntT -= dt;
      if (this.huntT <= 0) this.havaStartLeaving();
    }
    if (this.havaState === "hunting") {
      this.retargetT -= dt;
      if (!this.prey || !this.prey.alive || this.retargetT <= 0) {
        this.prey = this.pickHavaPrey(list);
        this.retargetT = 0.5;
      }
      if (this.prey) {
        tx = this.prey.x;
        ty = this.prey.y;
        if (dist(this.x, this.y, tx, ty) < this.radius + this.prey.radius * 0.6) {
          this.havaEat(this.prey);
          return;
        }
      } else {
        // nothing in range: prowl in slow circles until something turns up
        this.wanderAngle += rand(-0.5, 0.5) * dt * 2;
        tx = this.x + Math.cos(this.wanderAngle) * 100;
        ty = this.y + Math.sin(this.wanderAngle) * 100;
        sp *= 0.5;
      }
    } else {
      tx = this.exitX;
      ty = this.exitY;
      sp *= cfg.leaveSpeedMult;
      const m = cfg.exitMargin;
      if (
        this.x <= m || this.y <= m ||
        this.x >= CONFIG.arena.width - m || this.y >= CONFIG.arena.height - m
      ) {
        this.alive = false;
        Game.onHavaEscaped(this);
        return;
      }
    }
    const dx = tx - this.x,
      dy = ty - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    this.vx = lerp(this.vx, (dx / d) * sp, Math.min(1, dt * 5));
    this.vy = lerp(this.vy, (dy / d) * sp, Math.min(1, dt * 5));
    this.x = clamp(this.x + this.vx * dt, 0, CONFIG.arena.width);
    this.y = clamp(this.y + this.vy * dt, 0, CONFIG.arena.height);
    if (Math.abs(this.vx) > 1) this.facingDir = this.vx > 0 ? 1 : -1;
  }
  // Belly + state label over a Hava's head, in the draw transform.
  drawHavaLabel(ctx) {
    const leaving = this.havaState === "leaving";
    const y = -this.radius * 1.55;
    ctx.font = "700 12px Consolas, monospace";
    ctx.textAlign = "center";
    const bank = "+" + Math.round(CONFIG.hava.baseExp + (this.bankExp || 0)) + " EXP";
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(-42, y - 12, 84, 16);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(bank, 0, y);
    if (leaving) {
      const blink = Math.floor(performance.now() / 250) % 2 === 0;
      ctx.fillStyle = blink ? "#ff5c72" : "#ffffff";
      ctx.fillText("ESCAPING!", 0, y - 16);
    } else {
      ctx.fillStyle = "#c9b3ff";
      ctx.fillText("HUNGRY " + (this.meals || 0) + "/" + CONFIG.hava.stomachSize, 0, y - 16);
    }
  }
  /* ---- Nasser patrol (patrolType) ----
     A lane is: an axis ("h"/"v"), a fixed perpendicular coordinate
     (patrolLine), and an along-axis range [patrolLo, patrolHi]. The Nasser
     walks toward one end at constant speed, flips patrolDir, repeats.
     patrolVer bumps whenever the lane changes, so the co-op host knows to
     re-send it for joiners' path hints. */
  initPatrol(axis, dir) {
    this.patrolAxis = axis;
    this.patrolDir = dir;
    this.patrolLine = axis === "h" ? this.y : this.x;
    const along = axis === "h" ? this.x : this.y;
    this.setPatrolRange(dir > 0 ? along : along - this.legLength);
    // Start at one END of the leg, walking toward the other (if clamping
    // moved the range, put it back on its start end). A Bouncer's "leg" is
    // the whole arena width, so it just starts where it spawned.
    const start = this.type.patrolBounce
      ? clamp(along, this.patrolLo, this.patrolHi)
      : dir > 0
        ? this.patrolLo
        : this.patrolHi;
    if (axis === "h") this.x = start;
    else this.y = start;
    this.patrolKnown = true;
  }
  // Places [lo, lo+legLength] on the current axis, shifted (not shrunk)
  // to sit fully inside the arena walls. A Bouncer ignores `lo` and gets
  // wall-to-wall — its real turnarounds are decor, see updatePatrol().
  setPatrolRange(lo) {
    const cfg = CONFIG.nasser;
    const m = cfg.edgeMargin + this.radius;
    const max = (this.patrolAxis === "h" ? CONFIG.arena.width : CONFIG.arena.height) - m;
    const L = this.type.patrolBounce ? max - m : Math.min(this.legLength, max - m);
    lo = clamp(lo, m, max - L);
    this.patrolLo = lo;
    this.patrolHi = lo + L;
    // Keep the lane line itself inside the arena too.
    const pmax = (this.patrolAxis === "h" ? CONFIG.arena.height : CONFIG.arena.width) - m;
    this.patrolLine = clamp(this.patrolLine, m, pmax);
    this.patrolVer = (this.patrolVer || 0) + 1;
  }
  updatePatrol(dt) {
    const cfg = CONFIG.nasser;
    const h = this.patrolAxis === "h";
    let along = h ? this.x : this.y;
    const perp = h ? this.y : this.x;
    const tol = cfg.relaneTolerance;
    // Knocked or pulled off its lane by a tool: DON'T snap back (that
    // reads as broken rubber-banding). Re-lane on the same axis, centred
    // on wherever it landed, and carry on in the same direction.
    // A small slide ALONG its own lane (e.g. a stun's drift carrying it a
    // few px past an end) is just clamped back — re-laning for that would
    // shift the route for no visible reason.
    const slack = cfg.relaneAlongSlack;
    if (
      Math.abs(perp - this.patrolLine) > tol ||
      along < this.patrolLo - slack ||
      along > this.patrolHi + slack
    ) {
      this.patrolLine = perp;
      this.setPatrolRange(along - this.legLength / 2);
      // Knocked out of its row: it's on its own now, or it would drag the
      // rest of the Line's freeze/slow timers around with it.
      this.formation = null;
    }
    along = clamp(along, this.patrolLo, this.patrolHi);
    // Pacer: standing still at an end. Still on its lane, still facing
    // the way it's about to walk — the pause is the catch window.
    if (this.patrolPauseT > 0) {
      this.patrolPauseT -= dt;
      this.vx = this.vy = 0;
      return;
    }
    const sp = this.effectiveSpeed; // slow/Time Stop/events still apply
    along += this.patrolDir * sp * dt;
    let atEnd = false;
    if (along >= this.patrolHi) {
      along = this.patrolHi;
      atEnd = true;
    } else if (along <= this.patrolLo) {
      along = this.patrolLo;
      atEnd = true;
    } else if (this.type.patrolBounce && this.decorAhead(along)) {
      atEnd = true;
    }
    if (h) {
      this.x = along;
      this.y = this.patrolLine;
    } else {
      this.y = along;
      this.x = this.patrolLine;
    }
    if (atEnd) {
      if (this.type.patrolTurn) this.turnCorner();
      else this.patrolDir = -this.patrolDir;
      if (this.type.patrolPause) this.patrolPauseT = cfg.pauseDuration;
    }
    const nh = this.patrolAxis === "h";
    this.vx = nh ? this.patrolDir * sp : 0;
    this.vy = nh ? 0 : this.patrolDir * sp;
  }
  // Turner: a clockwise 90deg turn at each end instead of reversing, so
  // four legs make a square. In screen space (y down) clockwise is
  // +x -> +y -> -x -> -y. The new leg starts exactly at the corner.
  turnCorner() {
    const wasH = this.patrolAxis === "h";
    const newDir = wasH ? this.patrolDir : -this.patrolDir;
    this.patrolAxis = wasH ? "v" : "h";
    this.patrolDir = newDir;
    this.patrolLine = wasH ? this.x : this.y;
    const along = wasH ? this.y : this.x;
    this.setPatrolRange(newDir > 0 ? along : along - this.legLength);
    // Game.checkHugs() reads this for the "hug a Turner at its corner"
    // window (achievements are a later pass).
    this.cornerAt = performance.now();
  }
  // Bouncer: is an unbroken rock/crystal right in front, on its lane?
  // Only decor AHEAD counts, so once it has turned away it can't flip
  // straight back. NOTE: decor is cosmetic and generated per client
  // (never synced), so in co-op a joiner may see it turn at nothing.
  decorAhead(along) {
    const cfg = CONFIG.nasser;
    const decor = Game.decor;
    if (!decor) return false;
    const h = this.patrolAxis === "h";
    const reach = this.radius + cfg.bouncerDecorRadius;
    for (let i = 0; i < decor.length; i++) {
      const d = decor[i];
      if (d.broken || cfg.bouncerDecorKinds.indexOf(d.kind) < 0) continue;
      const dp = h ? d.y : d.x;
      if (Math.abs(dp - this.patrolLine) > reach) continue;
      const ahead = ((h ? d.x : d.y) - along) * this.patrolDir;
      if (ahead > 0 && ahead < reach) return true;
    }
    return false;
  }
  // The route hint: a dotted line along the leg with end-markers, drawn
  // under every sprite so the player can read the whole patrol at a glance
  // and plan an intercept. Fades with distance from the local player so a
  // full arena doesn't turn into a mess of lines. Pixel squares, not
  // setLineDash — keeps it in the pixel-art style.
  drawPatrolHint(ctx, cam, player) {
    if (!this.patrolKnown || !this.alive) return;
    const cfg = CONFIG.nasser;
    const h = this.patrolAxis === "h";
    // Drawn at FOOT level, so the dots read as a path on the ground.
    const foot = this.radius * 0.85;
    const x0 = h ? this.patrolLo : this.patrolLine,
      y0 = (h ? this.patrolLine : this.patrolLo) + foot,
      x1 = h ? this.patrolHi : this.patrolLine,
      y1 = (h ? this.patrolLine : this.patrolHi) + foot;
    // cull off-screen legs
    if (
      Math.max(x0, x1) < cam.x - 20 || Math.min(x0, x1) > cam.x + cam.w + 20 ||
      Math.max(y0, y1) < cam.y - 20 || Math.min(y0, y1) > cam.y + cam.h + 20
    )
      return;
    // distance from the player to the nearest point on the leg
    const nx = clamp(player.x, Math.min(x0, x1), Math.max(x0, x1));
    const ny = clamp(player.y, Math.min(y0, y1), Math.max(y0, y1));
    const d = dist(player.x, player.y, nx, ny);
    const fade =
      1 - clamp((d - cfg.pathHintFadeStart) / (cfg.pathHintFadeEnd - cfg.pathHintFadeStart), 0, 1);
    // 4 stepped opacity levels rather than a smooth fade (pixel-art rule)
    const alpha = cfg.pathHintOpacity * Math.ceil(fade * 4) / 4;
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = cfg.pathHintColor;
    const ds = cfg.pathHintDotSize,
      sp = cfg.pathHintDotSpacing;
    const len = this.patrolHi - this.patrolLo;
    // Dots march in the current walk direction — shows which way it's
    // heading without needing to look at the sprite.
    const scroll = ((performance.now() / 1000) * cfg.pathHintScrollSpeed * this.patrolDir) % sp;
    const ox = x0 - cam.x,
      oy = y0 - cam.y;
    for (let t = ((scroll % sp) + sp) % sp; t <= len; t += sp) {
      const px = Math.round(h ? ox + t : ox) - (ds >> 1);
      const py = Math.round(h ? oy : oy + t) - (ds >> 1);
      ctx.fillRect(px, py, ds, ds);
    }
    // end-markers: short perpendicular bars
    const bar = 10;
    for (const e of [0, len]) {
      const ex = Math.round(h ? ox + e : ox),
        ey = Math.round(h ? oy : oy + e);
      if (h) ctx.fillRect(ex - 1, ey - bar / 2, 3, bar);
      else ctx.fillRect(ex - bar / 2, ey - 1, bar, 3);
    }
    ctx.restore();
  }
  // Co-op, non-host clients only: the host runs the real AI via update()
  // above and periodically broadcasts {id, t, x, y} snapshots (see
  // Game.mpApplyBayatSnapshot); everyone else just visually lerps this
  // puppet's position toward the latest snapshot rather than simulating
  // AI locally — this is what "host-authoritative Bayats" means in
  // practice. Bob/animation still runs locally since it's purely
  // cosmetic and doesn't need to be network-accurate.
  updatePuppet(dt) {
    this._lastPuppetDt = dt;
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
    if (this.type.havaType) {
      // Puppet Havas don't simulate — but the Prison Cage aims at where a
      // Hava is GOING, so estimate velocity from the interpolated motion.
      const px = this.x,
        py = this.y;
      this.puppetInterp(buf, renderAt);
      const pdt = Math.max(1 / 240, (this._lastPuppetDt || 1 / 60));
      this.pvx = (this.x - px) / pdt;
      this.pvy = (this.y - py) / pdt;
      return;
    }
    if (this.type.patrolType) {
      // Puppets don't simulate the patrol (the host owns the position —
      // see CLAUDE.md "Nassers" for why syncing the route and simulating
      // locally would silently diverge). Walk direction is only for the
      // sprite flip + hint scroll, so derive it from observed motion.
      const px = this.x,
        py = this.y;
      this.puppetInterp(buf, renderAt);
      const dAlong = this.patrolAxis === "h" ? this.x - px : this.y - py;
      if (Math.abs(dAlong) > 0.05) this.patrolDir = dAlong > 0 ? 1 : -1;
      return;
    }
    this.puppetInterp(buf, renderAt);
  }
  puppetInterp(buf, renderAt) {

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
    // Nassers draw from their OWN sprite (never the Bayat one — they're a
    // separate character), squashed SHORT with the feet kept where a
    // Bayat's would be. If nasser.png fails to load they take the
    // procedural fallback below, like any other sprite.
    const patrol = this.type.patrolType;
    const imgKey = this.type.spriteKey ? this.type.spriteKey : "bayat";
    if (Sprites[imgKey + "Loaded"]) {
      ctx.save();
      ctx.globalAlpha = ghostAlpha;
      const size = this.radius * 2.9;
      const w = patrol ? size * CONFIG.nasser.spriteWidthMult : size;
      const h = patrol ? size * CONFIG.nasser.spriteHeightMult : size;
      // face the walk direction (horizontal lanes only — a vertical
      // walker keeps whatever way it last faced)
      if (patrol && this.patrolAxis === "h" && this.patrolDir < 0) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      // Glow is BAKED (GlowCache) instead of a live shadowBlur: a canvas
      // blur is re-rasterised on every draw, which is one of the most
      // expensive things a phone GPU can be asked to do per sprite.
      let glowColor = null,
        glowBlur = 0;
      if (this.type.glow) {
        glowColor = "#ffd76a";
        glowBlur = 26;
      } else if (this.type.danger || this.type.bulldozer) {
        glowColor = "rgba(255,60,80,.55)";
        glowBlur = 12;
      } else if (bombBlink) {
        glowColor = "rgba(255,80,30,.7)";
        glowBlur = 18;
      }
      // alpha-safe tint: only visible pixels are recolored, transparent pixels
      // (and partially-transparent edge pixels) are left exactly as they were.
      const tinted =
        this.frozenT > 0
          ? SpriteTint.getTinted(imgKey, "#9adfff", 0.55)
          : SpriteTint.getTinted(
              imgKey,
              tintColorOverride,
              tintStrengthOverride,
            );
      // bottom edge at +size/2 either way, so a short sprite stands on
      // the same ground line instead of hovering at mid-height
      const src = tinted || Sprites[imgKey];
      if (glowBlur) {
        const tintKey =
          this.frozenT > 0 ? imgKey + "|frozen" : imgKey + "|" + tintColorOverride + "|" + tintStrengthOverride;
        const g = GlowCache.get(src, tintKey, w, h, glowColor, glowBlur);
        if (g) ctx.drawImage(g.canvas, -w / 2 - g.pad, size / 2 - h - g.pad, w + g.pad * 2, h + g.pad * 2);
        else ctx.drawImage(src, -w / 2, size / 2 - h, w, h);
      } else {
        ctx.drawImage(src, -w / 2, size / 2 - h, w, h);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      // ---- procedural fallback (used if bayat.png fails to load) ----
      if (patrol) ctx.scale(1, CONFIG.nasser.spriteHeightMult);
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
    if (this.type.havaType) this.drawHavaLabel(ctx);
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
    this.nasserTimer = CONFIG.nasser.firstSpawnDelay;
    this.havaTimer = CONFIG.hava.firstSpawnDelay;
  }
  reset() {
    this.list = [];
    this.spawnTimer = 0;
    this.nasserTimer = CONFIG.nasser.firstSpawnDelay;
    this.havaTimer = CONFIG.hava.firstSpawnDelay;
  }
  countHava() {
    let c = 0;
    for (const n of this.list) if (n.alive && n.type.havaType) c++;
    return c;
  }
  // Havas walk in from a distance rather than popping up next to you.
  spawnHava(anchor, diff) {
    const cfg = CONFIG.hava;
    const ang = Math.random() * TAU;
    const r = rand(cfg.spawnRingMin, cfg.spawnRingMax);
    const m = 150;
    const x = clamp(anchor.x + Math.cos(ang) * r, m, CONFIG.arena.width - m);
    const y = clamp(anchor.y + Math.sin(ang) * r, m, CONFIG.arena.height - m);
    const h = new Bayat(BAYAT_TYPES.hava, x, y, diff);
    this.list.push(h);
    Game.onHavaArrive(h);
    return h;
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
      // Nassers have their own pool + spawn timer — see pickNasserType().
      if (t.patrolType) continue;
      if (t.havaType) continue; // own timer — see spawnHava()
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
  // The Nasser spawn pool: same weight/minDiff shape as pickType(), but
  // only over patrolType entries. `anyDiff` (test hotkey) ignores minDiff.
  pickNasserType(diff, anyDiff) {
    const pool = [];
    for (const key in BAYAT_TYPES) {
      const t = BAYAT_TYPES[key];
      if (!t.patrolType || (!anyDiff && diff < t.minDiff)) continue;
      pool.push({ item: t, weight: t.weightBase });
    }
    return pool.length ? weightedPick(pool) : null;
  }
  countPatrol() {
    let c = 0;
    for (const n of this.list) if (n.alive && n.type.patrolType) c++;
    return c;
  }
  spawnOne(player, diff, luck) {
    const type = this.pickType(diff, luck);
    if (type.patrolType) return this.spawnPatrol(type, player, diff);
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
  /* Nassers don't spawn at a random ring point like Bayats — they spawn
     at a lane START, with the whole leg validated: inside the arena
     (Bayat.setPatrolRange shifts it in), grid-snapped so several Nassers
     form deliberate-looking lanes, and never crossing the player's
     current position. `ringMin/ringMax` default to CONFIG; the test
     hotkey passes a closer ring so you can watch one immediately. */
  spawnPatrol(type, player, diff, ringMin, ringMax) {
    const cfg = CONFIG.nasser;
    const g = cfg.laneGrid;
    // Line: a row of marchers side by side on parallel lanes, same leg,
    // same phase. They share a `formation` object so CC on one (a Gem of
    // Time catching the edge of the row) holds the whole row in formation
    // — see syncFormations().
    const count = type.formation ? randInt(cfg.lineCountMin, cfg.lineCountMax) : 1;
    const members = [];
    for (let i = 0; i < count; i++) members.push(new Bayat(type, player.x, player.y, diff));
    const lead = members[0];
    let axis = "h",
      dir = 1;
    for (let tries = 0; tries < 12; tries++) {
      const ang = Math.random() * TAU;
      const r = rand(ringMin || cfg.spawnRingMin, ringMax || cfg.spawnRingMax);
      lead.x = Math.round((player.x + Math.cos(ang) * r) / g) * g;
      lead.y = Math.round((player.y + Math.sin(ang) * r) / g) * g;
      axis = Math.random() < 0.5 ? "h" : "v";
      dir = Math.random() < 0.5 ? 1 : -1;
      // Every member's lane must clear the player, not just the lead's.
      let clear = true;
      for (let i = 0; i < count && clear; i++) {
        const n = members[i];
        n.x = lead.x + (axis === "h" ? 0 : i * cfg.lineSpacing);
        n.y = lead.y + (axis === "h" ? i * cfg.lineSpacing : 0);
        n.initPatrol(axis, dir);
        const h = n.patrolAxis === "h";
        const along = clamp(h ? player.x : player.y, n.patrolLo, n.patrolHi);
        const lx = h ? along : n.patrolLine,
          ly = h ? n.patrolLine : along;
        if (dist(player.x, player.y, lx, ly) < cfg.playerClearance) clear = false;
      }
      if (clear) break;
    }
    const formation = count > 1 ? { members } : null;
    for (const n of members) {
      n.formation = formation;
      n.patrolVer = 1;
      this.list.push(n);
    }
    if (type.miniBoss) Game.onMiniBossEvent(type);
    return lead;
  }
  // Hold every Line in formation: any freeze/stun/slow/pause on one
  // member is applied to all of them, so the row stops and restarts
  // together instead of shearing apart. Runs before the per-Bayat update
  // (host/solo only — joiners just render positions). Scratch fields on
  // the shared formation object, stamped per frame, so nothing allocates.
  syncFormations() {
    const frame = (this._formFrame = (this._formFrame || 0) + 1);
    for (const n of this.list) {
      const f = n.formation;
      if (!f || !n.alive) continue;
      if (f._frame !== frame) {
        f._frame = frame;
        f.fz = f.st = f.sl = f.pz = 0;
      }
      f.fz = Math.max(f.fz, n.frozenT);
      f.st = Math.max(f.st, n.stunT);
      f.sl = Math.max(f.sl, n.slowT);
      f.pz = Math.max(f.pz, n.patrolPauseT);
    }
    for (const n of this.list) {
      const f = n.formation;
      if (!f || !n.alive || f._frame !== frame) continue;
      n.frozenT = f.fz;
      n.stunT = f.st;
      n.slowT = f.sl;
      n.patrolPauseT = f.pz;
    }
  }
  drawPatrolHints(ctx, cam, player) {
    if (!CONFIG.nasser.showPathHint) return;
    for (const n of this.list) if (n.type.patrolType) n.drawPatrolHint(ctx, cam, player);
  }
  // `extraSpawnAnchors` (co-op host only — see CLAUDE.md "Multiplayer"):
  // remote peers' puppet positions (Game.mpPeers), so new Bayats populate
  // near whichever player is actually exploring, not just the host. Bayat
  // AI itself (Bayat.update() below) still only reacts to the host's own
  // `player` — a Bayat spawned near a remote peer won't flee/chase them,
  // it'll just sit there until that peer's local checkHugs() catches it.
  // A real fix needs per-Bayat "nearest of N players" targeting, which is
  // a bigger change than this — see CLAUDE.md known gaps.
  /* ---- Spatial grid for Bayat-to-Bayat separation ----
     Separation used to test every Bayat against EVERY entity in the list
     each frame — 100 Bayats x 200 entities = 20,000 distance checks, and
     measured at 87% of all Bayat.update() time. Only neighbours closer
     than (r1 + r2 + 18) ever push each other, so bucketing entities into
     cells at least that big and checking the 3x3 cells around each Bayat
     finds exactly the same pushers for a fraction of the work. Behaviour
     is unchanged: same neighbours, same forces, same order of AI.
     Buckets and the scratch array are reused, so it allocates nothing
     per frame once warm. */
  buildGrid() {
    let maxR = 0;
    for (const n of this.list) if (n.alive && n.radius > maxR) maxR = n.radius;
    // largest possible separation distance + a margin for this frame's
    // movement (positions are read live while the loop runs)
    this._cell = maxR * 2 + 18 + 24;
    const g = this._grid || (this._grid = new Map());
    for (const bucket of g.values()) bucket.length = 0;
    const c = this._cell;
    for (const n of this.list) {
      if (!n.alive) continue;
      const k = Math.floor(n.x / c) * 4096 + Math.floor(n.y / c);
      let bucket = g.get(k);
      if (!bucket) g.set(k, (bucket = []));
      bucket.push(n);
    }
  }
  neighbours(n) {
    const out = this._nb || (this._nb = []);
    out.length = 0;
    const c = this._cell,
      g = this._grid;
    const cx = Math.floor(n.x / c),
      cy = Math.floor(n.y / c);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = g.get((cx + dx) * 4096 + (cy + dy));
        if (bucket) for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
      }
    }
    return out;
  }
  // id -> Bayat, rebuilt at most once per frame on demand. Replaces
  // list.find() scans (snapshot apply, claims, relayed effects, missile
  // drawing) that were O(n) each, O(n^2) per snapshot.
  byId(id) {
    const stamp = Game.elapsed + ":" + this.list.length;
    if (this._byIdStamp !== stamp || !this._byId) {
      const m = this._byId || (this._byId = new Map());
      m.clear();
      for (const n of this.list) m.set(n.id, n);
      this._byIdStamp = stamp;
    }
    // A miss can mean "added this frame after the map was built" — fall
    // back to a scan so the cache can only ever speed lookups up, never
    // change their answer.
    return this._byId.get(id) || this.list.find((n) => n.id === id);
  }
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
    // Nassers: their own spawn speed (CONFIG.nasser.spawnInterval), eased
    // toward spawnIntervalMin with difficulty and sped up by the same
    // Hyper Mode / event multiplier as Bayats.
    const nc = CONFIG.nasser;
    this.nasserTimer -= dt;
    if (this.nasserTimer <= 0) {
      this.nasserTimer = lerp(nc.spawnInterval, nc.spawnIntervalMin, diff) / speedMult;
      if (this.countPatrol() < nc.maxAlive) {
        const t = this.pickNasserType(diff);
        const anchor =
          extraSpawnAnchors && extraSpawnAnchors.length && Math.random() < 0.5
            ? choice(extraSpawnAnchors)
            : player;
        if (t) this.spawnPatrol(t, anchor, diff);
      }
    }
    // Havas: their own (slow) timer, same shape as the Nassers'.
    const hc = CONFIG.hava;
    if (Game.havasOn) this.havaTimer -= dt; // Settings > Havas
    if (Game.havasOn && this.havaTimer <= 0) {
      this.havaTimer = lerp(hc.spawnInterval, hc.spawnIntervalMin, diff);
      if (this.countHava() < hc.maxAlive) {
        const anchor =
          extraSpawnAnchors && extraSpawnAnchors.length && Math.random() < 0.5
            ? choice(extraSpawnAnchors)
            : player;
        this.spawnHava(anchor, diff);
      }
    }
    this.syncFormations();
    this.buildGrid();
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
      // Nassers ignore separation entirely (they return before it), so
      // they don't need a neighbour query at all.
      n.update(
        dt,
        target,
        n.type.patrolType || n.type.havaType ? this.list : this.neighbours(n),
        blackHoleLevel,
      );
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
  applySnapshot(flat, intro, difficulty, sampleT, patrols, havas) {
    /* sampleT is the host's send time mapped onto our clock
       (Game.mpSampleTime). Buffering by that instead of by arrival time
       is what makes remote motion smooth: the host emits snapshots at a
       perfectly even rate, so evenly-spaced stamps mean the interpolator
       plays the motion back at its true speed. Arrival times are jittered
       by the network, and interpolating between them makes every Bayat
       surge and stall. Falls back to arrival time if a sender stamp
       wasn't supplied. */
    const now = typeof sampleT === "number" ? sampleT : performance.now();
    if (!Array.isArray(flat)) return;
    /* Wire format (see Game.mpUpdateNetworking): `flat` is a flat number
       array [id,x,y, id,x,y, ...] and `intro` is [id,typeKey, ...] naming
       only the Bayats being introduced this tick. A type is fixed for a
       Bayat's whole life, so re-sending it every tick was pure waste.

       Both scratch containers are reused across calls — this runs ~12x a
       second for the whole run, and a Map plus a Set allocated per call
       is exactly the kind of steady garbage that produces the GC hitches
       this netcode work exists to remove. */
    if (!this._introMap) this._introMap = new Map();
    if (!this._seenIds) this._seenIds = new Set();
    const introMap = this._introMap;
    const seen = this._seenIds;
    introMap.clear();
    seen.clear();
    if (Array.isArray(intro))
      for (let i = 0; i + 1 < intro.length; i += 2)
        introMap.set(intro[i], intro[i + 1]);

    // One map for the whole snapshot instead of a list.find() per entry
    // (that was O(n^2): 200 Bayats x 200 x 15 snapshots/sec on a joiner).
    const idMap = this._snapIdMap || (this._snapIdMap = new Map());
    idMap.clear();
    for (const b of this.list) idMap.set(b.id, b);
    for (let i = 0; i + 2 < flat.length; i += 3) {
      const s = { id: flat[i], x: flat[i + 1], y: flat[i + 2] };
      seen.add(s.id);
      let n = idMap.get(s.id);
      if (!n) {
        /* An id we've never seen and no introduction for it: the host is
           mid-keyframe-interval and already introduced it to everyone who
           was listening at the time. Skip it — the next keyframe re-sends
           every type, so this self-heals within snapshotKeyframeMs rather
           than inventing a wrong type or throwing. */
        const key = introMap.get(s.id);
        if (!key) continue;
        const type = BAYAT_TYPES[key];
        if (!type) continue; // unknown type key — ignore rather than throw
        n = new Bayat(type, s.x, s.y, difficulty || 0);
        n.id = s.id;
        idMap.set(n.id, n);
        // the constructor's default lane is a guess — hide the hint until
        // the host's real lane arrives (normally in this same message)
        if (type.patrolType) n.patrolKnown = false;
        this.list.push(n);
      }
      /* Push into the interpolation buffer that updatePuppet() reads.
         Kept small — only enough history to cover the render delay plus
         a couple of dropped packets; anything older is dead weight. */
      if (!n.netBuf) n.netBuf = [];
      // updatePuppet()'s bracket search requires ascending stamps. A clock
      // re-seed can produce one that isn't; nudge rather than corrupt.
      const last = n.netBuf[n.netBuf.length - 1];
      n.netBuf.push({ t: last && now <= last.t ? last.t + 1 : now, x: s.x, y: s.y });
      while (n.netBuf.length > 12) n.netBuf.shift();
      n.netStamp = now;
      n.netTargetX = s.x;
      n.netTargetY = s.y;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!seen.has(this.list[i].id)) this.list.splice(i, 1);
    }
    /* Nasser lanes: [id, axis(0=h,1=v), lo, hi, line, ...]. DISPLAY ONLY —
       drives the path hint. The puppet's position still comes purely from
       the snapshot stream above; nothing simulates the patrol here. */
    /* Hava state: [id, leaving(0/1), bankExp, bankTime*10, radius, meals,
       ...]. Drives the joiner's belly label, the ESCAPING marker and
       whether their capture tools may target it. The position still
       comes from the snapshot stream — nothing simulates it here. */
    if (Array.isArray(havas)) {
      for (let i = 0; i + 5 < havas.length; i += 6) {
        const n = idMap.get(havas[i]);
        if (!n || !n.type.havaType) continue;
        n.havaState = havas[i + 1] ? "leaving" : "hunting";
        n.bankExp = havas[i + 2];
        n.bankTime = havas[i + 3] / 10;
        n.radius = havas[i + 4];
        n.meals = havas[i + 5];
      }
    }
    if (Array.isArray(patrols)) {
      for (let i = 0; i + 4 < patrols.length; i += 5) {
        const n = idMap.get(patrols[i]);
        if (!n || !n.type.patrolType) continue;
        n.patrolAxis = patrols[i + 1] ? "v" : "h";
        n.patrolLo = patrols[i + 2];
        n.patrolHi = patrols[i + 3];
        n.patrolLine = patrols[i + 4];
        n.patrolKnown = true;
      }
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
