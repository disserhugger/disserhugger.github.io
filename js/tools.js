"use strict";

/* =========================================================
   TOOL SYSTEM
   ========================================================= */
class ToolSystem {
  constructor() {
    this.active = {};
  }
  reset() {
    this.active = {};
  }
  equip(def, level) {
    if (!this.active[def.id]) this.active[def.id] = { def, level: 0, cd: 0 };
    this.active[def.id].level = level;
  }
  update(dt, player, bayatManager) {
    for (const id in this.active) {
      const t = this.active[id];
      if (t.def.kind === "aura") {
        this.tickAura(t, dt, player, bayatManager);
        continue;
      }
      if (t.def.kind === "orbit") {
        this.tickOrbit(t, dt, player, bayatManager);
        continue;
      }
      if (!t.def.baseCooldown) continue;
      t.cd -= dt;
      if (t.cd <= 0) {
        this.fire(t, player, bayatManager);
        t.cd = t.def.baseCooldown * player.cooldownMult * rand(0.96, 1.04);
      }
    }
  }
  tickAura(t, dt, player, nm) {
    const range = t.def.range
      ? t.def.range(t.level) * (player.wideArmsMult || 1)
      : 0;
    if (t.def.id === "cuddleaura") {
      const targets = nm.inRadius(player.x, player.y, range);
      for (const n of targets) {
        if (!n.type.danger) {
          n.slowT = Math.max(n.slowT, 0.2);
        } else {
          // gently push dangerous bayats back out of the aura
          const a = Math.atan2(n.y - player.y, n.x - player.x);
          n.x += Math.cos(a) * 40 * dt;
          n.y += Math.sin(a) * 40 * dt;
        }
      }
      if (Math.random() < 0.35)
        Game.particles.burst(player.x, player.y, "#ff9dc9", 1, {
          minLife: 0.3,
          maxLife: 0.5,
          minSize: 2,
          maxSize: 3,
          minSpeed: 10,
          maxSpeed: range * 0.5,
        });
    } else if (t.def.id === "comfortaura") {
      t.timer = (t.timer || 0) - dt;
      if (t.timer <= 0) {
        t.timer = t.def.tickInterval;
        const evoBonus = Game.evolvedSet && Game.evolvedSet.bloodAura ? 1.6 : 1;
        if (Game.mode === "arcade") {
          const gain = (3 + t.level * 1.5) * evoBonus * player.totalExpMult;
          Game.exp.add(gain);
          Game.particles.text(
            player.x,
            player.y - 46,
            "+" + Math.round(gain) + " EXP",
            "#a970ff",
            12,
          );
        } else {
          const bonus = (0.4 + t.level * 0.18) * evoBonus;
          Game.timer = clamp(Game.timer + bonus, 0, Game.maxStoredTime);
          Game.particles.text(
            player.x,
            player.y - 46,
            "+" + bonus.toFixed(1) + "s",
            "#6fe3a3",
            12,
          );
        }
      }
    } else if (t.def.id === "partyhorn") {
      t.timer = (t.timer || 0) - dt;
      if (t.timer <= 0) {
        t.timer = Math.max(2, t.def.tickInterval - t.level * 0.4);
        if (Game.combo > 1) {
          Game.lastHugTime = Game.elapsed; // refresh the combo window so it can't decay right now
          Game.particles.text(player.x, player.y - 34, "PARTY!", "#ff7ab8", 15);
          Game.particles.burst(player.x, player.y, "#ff7ab8", 14, {
            maxSpeed: 130,
            minLife: 0.3,
            maxLife: 0.6,
          });
          AudioSystem.toolFire();
        }
      }
    } else if (t.def.id === "duster") {
      // Periodic full-radius freeze burst, like comfortaura/partyhorn's
      // timer pattern — distinct from cuddleaura's continuous per-frame
      // slow, this is an instant sweep every few seconds.
      t.timer = (t.timer || 0) - dt;
      if (t.timer <= 0) {
        t.timer = t.def.tickInterval;
        const targets = nm.inRadius(player.x, player.y, range);
        for (const n of targets) {
          n.frozenT = Math.max(n.frozenT, 0.5 + t.level * 0.08);
        }
        Game.particles.burst(player.x, player.y, "#ffe1a8", 18, {
          maxSpeed: 140,
          minLife: 0.3,
          maxLife: 0.6,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#ffe1a8",
          t: 0.3,
          maxT: 0.3,
        });
        if (targets.length) AudioSystem.toolFire();
      }
    } else if (t.def.id === "gravitywell") {
      // Synergy result (Black Hole + Vacuum): a permanent, always-on strong
      // pull — non-dangerous Bayats get a steady stream of near-guaranteed
      // catches, dangerous ones get firmly shoved back out.
      const targets = nm.inRadius(player.x, player.y, range);
      for (const n of targets) {
        if (!n.type.danger) {
          n.hookedT = Math.max(n.hookedT, 0.3);
        } else {
          const a = Math.atan2(n.y - player.y, n.x - player.x);
          n.x += Math.cos(a) * 90 * dt;
          n.y += Math.sin(a) * 90 * dt;
        }
      }
      if (Math.random() < 0.6)
        Game.particles.burst(player.x, player.y, "#a970ff", 2, {
          minLife: 0.3,
          maxLife: 0.65,
          minSize: 2,
          maxSize: 4,
          minSpeed: 20,
          maxSpeed: range * 0.55,
        });
    }
  }
  tickOrbit(t, dt, player, nm) {
    const isBestBuds = t.def.id === "bestbuds";
    const count = isBestBuds ? 3 : 1 + t.level;
    const radius = t.def.range(t.level) * 1.6 * (player.wideArmsMult || 1);
    t.spin =
      (t.spin || 0) +
      dt * (1.6 + (Game.evolvedSet && Game.evolvedSet.bladeStorm ? 1.2 : 0));
    const buddyCount =
      count +
      (Game.evolvedSet && Game.evolvedSet.bladeStorm && !isBestBuds ? 2 : 0);
    t.positions = [];
    if (!t.hitPulse) t.hitPulse = [];
    for (let i = 0; i < t.hitPulse.length; i++) {
      if (t.hitPulse[i] > 0) t.hitPulse[i] -= dt;
    }
    for (let i = 0; i < buddyCount; i++) {
      const ang = t.spin + (TAU / buddyCount) * i;
      const bx = player.x + Math.cos(ang) * radius,
        by = player.y + Math.sin(ang) * radius;
      t.positions.push({ x: bx, y: by });
      const hit = nm.nearest(
        bx,
        by,
        (n) => !n.type.danger && dist(bx, by, n.x, n.y) < n.radius + 12,
      );
      if (hit) {
        Game.onHug(hit, true);
        t.hitPulse[i] = 0.22;
        if (isBestBuds && Math.random() < 0.4) {
          const second = nm.nearest(
            hit.x,
            hit.y,
            (n) =>
              n !== hit &&
              n.alive &&
              !n.type.danger &&
              dist(hit.x, hit.y, n.x, n.y) < 90,
          );
          if (second) Game.onHug(second, true);
        }
      }
    }
  }
  fire(t, player, nm) {
    const range = t.def.range(t.level) * (player.wideArmsMult || 1);
    switch (t.def.id) {
      case "hook": {
        const maxTargets = t.def.targets ? t.def.targets(t.level) : 1;
        const targets = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger)
          .slice(0, maxTargets);
        for (const target of targets) {
          target.hookedT = 0.45;
          Game.particles.burst(target.x, target.y, "#f5b942", 10, {
            maxSpeed: 120,
          });
          drawRopeLine(player, target, "#f5b942");
        }
        if (targets.length) AudioSystem.toolFire();
        break;
      }
      case "cake": {
        const targets = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger);
        for (const n of targets) {
          n.hookedT = Math.max(n.hookedT, 0.32);
        }
        Game.particles.burst(player.x, player.y, "#ffb6d9", 18, {
          maxSpeed: 90,
          minLife: 0.4,
          maxLife: 0.7,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#ffb6d9",
          t: 0.4,
          maxT: 0.4,
        });
        AudioSystem.toolFire();
        break;
      }
      case "rope": {
        const targets = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger);
        for (const n of targets) {
          n.hookedT = Math.max(n.hookedT, 0.5);
          drawRopeLine(player, n, "#c8a06a");
        }
        Game.particles.burst(player.x, player.y, "#c8a06a", 14, {
          maxSpeed: 70,
        });
        AudioSystem.toolFire();
        break;
      }
      case "ring": {
        const targets = nm.inRadius(player.x, player.y, range);
        for (const n of targets) {
          n.slowT = Math.max(n.slowT, 1.1);
          if (!n.type.danger) n.hookedT = Math.max(n.hookedT, 0.22);
        }
        Game.particles.burst(player.x, player.y, "#a970ff", 26, {
          maxSpeed: 160,
          minLife: 0.5,
          maxLife: 0.9,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#a970ff",
          t: 0.45,
          maxT: 0.45,
        });
        AudioSystem.toolFire();
        break;
      }
      case "gem": {
        const targets = nm.inRadius(player.x, player.y, range);
        for (const n of targets) {
          n.frozenT = Math.max(n.frozenT, 1.0 + t.level * 0.15);
        }
        Game.particles.burst(player.x, player.y, "#8fd9ff", 24, {
          maxSpeed: 130,
          minLife: 0.5,
          maxLife: 0.9,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#8fd9ff",
          t: 0.5,
          maxT: 0.5,
        });
        AudioSystem.toolFire();
        break;
      }
      case "snowball": {
        const target = nm.densestCluster(player.x, player.y, 900) ||
          nm.nearest(player.x, player.y, (n) => !n.type.danger) || {
            x: player.x,
            y: player.y + 150,
          };
        const targets = nm.inRadius(target.x, target.y, 130 + t.level * 10);
        for (const n of targets) {
          n.slowT = Math.max(n.slowT, 1.6);
        }
        Game.particles.burst(target.x, target.y, "#cdeaff", 20, {
          maxSpeed: 100,
        });
        Game.telegraphs.push({
          x: target.x,
          y: target.y,
          r: 130 + t.level * 10,
          color: "#cdeaff",
          t: 0.4,
          maxT: 0.4,
        });
        AudioSystem.toolFire();
        break;
      }
      case "vacuum": {
        const maxT = 3 + t.level * 2;
        const targets = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger)
          .slice(0, maxT);
        for (const n of targets) {
          n.hookedT = Math.max(n.hookedT, 0.5 + t.level * 0.05);
        }
        Game.particles.burst(player.x, player.y, "#bda4ff", 22, {
          maxSpeed: -10,
          minSpeed: -160,
          gravity: 0,
          minLife: 0.3,
          maxLife: 0.5,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#bda4ff",
          t: 0.35,
          maxT: 0.35,
        });
        AudioSystem.toolFire();
        break;
      }
      case "magnet": {
        const targets = nm.inRadius(player.x, player.y, range);
        for (const n of targets) {
          if (!n.type.danger)
            n.hookedT = Math.max(n.hookedT, 0.6 + t.level * 0.08);
          else n.slowT = Math.max(n.slowT, 0.4);
        }
        Game.particles.burst(player.x, player.y, "#ff7ab8", 30, {
          maxSpeed: 190,
          minLife: 0.5,
          maxLife: 0.9,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#ff7ab8",
          t: 0.5,
          maxT: 0.5,
        });
        AudioSystem.toolFire();
        break;
      }
      case "boomerang": {
        const originX = player.x,
          originY = player.y;
        const angle = Math.random() * TAU;
        Game.projectiles.push({
          kind: "boomerang",
          x: originX,
          y: originY,
          angle,
          t: 0,
          dur: 0.55,
          range: range * 0.5,
        });
        Game.delayedEffects.push({
          t: 0.58,
          fn: () => {
            const maxT = 2 + t.level;
            const targets = nm
              .inRadius(player.x, player.y, range * 0.65)
              .filter((n) => !n.type.danger)
              .slice(0, maxT);
            for (const n of targets) {
              n.hookedT = Math.max(n.hookedT, 0.5);
            }
            Game.particles.burst(player.x, player.y, "#f5b942", 20, {
              maxSpeed: 150,
            });
            AudioSystem.toolFire();
          },
        });
        break;
      }
      case "net": {
        const targets = nm.inRadius(player.x, player.y, range);
        const dur = 0.8 + t.level * 0.15;
        for (const n of targets) {
          n.frozenT = Math.max(n.frozenT, dur);
        }
        Game.particles.burst(player.x, player.y, "#8a6a3f", 18, {
          maxSpeed: 100,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#8a6a3f",
          t: 0.4,
          maxT: 0.4,
        });
        AudioSystem.toolFire();
        break;
      }
      case "banana": {
        const targets = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger);
        for (const n of targets) {
          n.slowT = Math.max(n.slowT, 1.2);
          n.hookedT = Math.max(n.hookedT, 0.15 + t.level * 0.03);
        }
        Game.particles.burst(player.x, player.y, "#f9e2af", 18, {
          maxSpeed: 110,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#f9e2af",
          t: 0.4,
          maxT: 0.4,
        });
        AudioSystem.toolFire();
        break;
      }
      case "teleporter": {
        const dest = nm.densestCluster(player.x, player.y, range);
        if (dest) {
          Game.particles.burst(player.x, player.y, "#a970ff", 24, {
            maxSpeed: 220,
          });
          player.x = clamp(
            dest.x + rand(-40, 40),
            player.radius,
            CONFIG.arena.width - player.radius,
          );
          player.y = clamp(
            dest.y + rand(-40, 40),
            player.radius,
            CONFIG.arena.height - player.radius,
          );
          Game.particles.burst(player.x, player.y, "#a970ff", 24, {
            maxSpeed: 220,
          });
          Game.camera.shake(6, 0.2);
          AudioSystem.teleport();
        }
        break;
      }
      case "alarm": {
        const targets = nm.inRadius(player.x, player.y, range);
        const dur = 0.9 + t.level * 0.15;
        for (const n of targets) {
          n.slowT = Math.max(n.slowT, dur);
        }
        Game.particles.burst(player.x, player.y, "#ffd166", 24, {
          maxSpeed: 170,
          minLife: 0.4,
          maxLife: 0.7,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#ffd166",
          t: 0.4,
          maxT: 0.4,
        });
        AudioSystem.toolFire();
        break;
      }
      case "confetti": {
        const dest =
          nm.densestCluster(player.x, player.y, range) ||
          nm.nearest(player.x, player.y, (n) => !n.type.danger);
        if (!dest) break;
        const tx = dest.x,
          ty = dest.y;
        const travel = t.def.travel * (player.quickTossMult || 1);
        Game.projectiles.push({
          kind: "lob",
          x1: player.x,
          y1: player.y,
          x2: tx,
          y2: ty,
          t: 0,
          dur: travel,
        });
        const inferno = Game.evolvedSet && Game.evolvedSet.infernoCore;
        Game.delayedEffects.push({
          t: travel,
          fn: () => {
            const blastR = (110 + t.level * 16) * (inferno ? 1.5 : 1);
            const hitTargets = nm
              .inRadius(tx, ty, blastR)
              .filter((n) => !n.type.danger);
            for (const n of hitTargets) {
              n.hookedT = Math.max(n.hookedT, 0.4);
            }
            Game.particles.burst(tx, ty, "#ff9dc9", 30, {
              maxSpeed: 220,
              minLife: 0.4,
              maxLife: 0.8,
            });
            Game.camera.shake(6, 0.15);
            Game.fxZones.push({
              x: tx,
              y: ty,
              r: blastR * 0.8,
              color: inferno ? "#ff7a3d" : "#ffb6d9",
              t: inferno ? 4.5 : 2.2,
              maxT: inferno ? 4.5 : 2.2,
              slow: true,
            });
            AudioSystem.toolFire();
          },
        });
        break;
      }
      case "staticcling": {
        const maxTargets = t.def.targets ? t.def.targets(t.level) : 1;
        const pool = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger);
        const thunder = Game.evolvedSet && Game.evolvedSet.thunderstorm;
        const total = Math.min(pool.length, maxTargets + (thunder ? 2 : 0));
        for (let i = 0; i < total; i++) {
          const idx = randInt(0, pool.length - 1);
          const n = pool.splice(idx, 1)[0];
          if (!n) continue;
          n.hookedT = Math.max(n.hookedT, 0.4);
          Game.lightningBolts.push({
            x1: player.x,
            y1: player.y,
            x2: n.x,
            y2: n.y,
            t: 0,
            dur: 0.18,
          });
        }
        if (total > 0) AudioSystem.toolFire();
        break;
      }
      case "heartmissile": {
        const target = nm.nearest(player.x, player.y, (n) => !n.type.danger);
        if (!target) break;
        const d = dist(player.x, player.y, target.x, target.y);
        const travel =
          Math.min(t.def.travel, Math.max(0.18, d / 900)) *
          (player.quickTossMult || 1);
        const targetId = target.id;
        Game.projectiles.push({
          kind: "missile",
          x: player.x,
          y: player.y,
          targetId,
          t: 0,
          dur: travel,
        });
        Game.delayedEffects.push({
          t: travel,
          fn: () => {
            const n = nm.list.find((nn) => nn.id === targetId && nn.alive);
            if (n) {
              n.hookedT = Math.max(n.hookedT, 0.55);
              Game.particles.burst(n.x, n.y, "#ff7ab8", 14, { maxSpeed: 140 });
            }
          },
        });
        AudioSystem.toolFire();
        break;
      }
      case "carepackage": {
        const ang = Math.random() * TAU,
          dropR = rand(80, 220);
        const tx = clamp(
          player.x + Math.cos(ang) * dropR,
          60,
          CONFIG.arena.width - 60,
        );
        const ty = clamp(
          player.y + Math.sin(ang) * dropR,
          60,
          CONFIG.arena.height - 60,
        );
        Game.telegraphs.push({
          x: tx,
          y: ty,
          r: range,
          color: "#ffd76a",
          t: t.def.telegraphTime,
          maxT: t.def.telegraphTime,
        });
        Game.delayedEffects.push({
          t: t.def.telegraphTime,
          fn: () => {
            const targets = nm.inRadius(tx, ty, range);
            for (const n of targets) {
              n.frozenT = Math.max(n.frozenT, 1.4 + t.level * 0.2);
              n.hookedT = Math.max(n.hookedT, 0.3);
            }
            Game.particles.burst(tx, ty, "#ffd76a", 40, {
              maxSpeed: 260,
              minLife: 0.4,
              maxLife: 0.9,
            });
            Game.camera.shake(11, 0.25);
            AudioSystem.golden();
          },
        });
        break;
      }
      case "glittercloud": {
        const dest = nm.densestCluster(player.x, player.y, range) || {
          x: player.x,
          y: player.y,
        };
        Game.fxZones.push({
          x: dest.x,
          y: dest.y,
          r: 100 + t.level * 14,
          color: "#c9a0ff",
          t: t.def.zoneDuration(t.level),
          maxT: t.def.zoneDuration(t.level),
          slow: true,
        });
        Game.particles.burst(dest.x, dest.y, "#c9a0ff", 20, {
          maxSpeed: 90,
          minLife: 0.5,
          maxLife: 0.9,
        });
        AudioSystem.toolFire();
        break;
      }
      case "anchor": {
        const ang = Math.random() * TAU;
        const dropX = clamp(
          player.x + Math.cos(ang) * 220,
          80,
          CONFIG.arena.width - 80,
        );
        const dropY = clamp(
          player.y + Math.sin(ang) * 220,
          80,
          CONFIG.arena.height - 80,
        );
        const dur = 1.4 + t.level * 0.3;
        const targets = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger);
        for (const n of targets) {
          n.anchorT = dur;
          n.anchorX = dropX;
          n.anchorY = dropY;
        }
        Game.particles.burst(dropX, dropY, "#7fd8e8", 24, {
          maxSpeed: 120,
          minLife: 0.4,
          maxLife: 0.8,
        });
        Game.telegraphs.push({
          x: dropX,
          y: dropY,
          r: 40 + t.level * 6,
          color: "#7fd8e8",
          t: 0.5,
          maxT: 0.5,
        });
        Game.shockwaves.push({
          x: player.x,
          y: player.y,
          color: "#7fd8e8",
          t: 0,
          duration: 0.3,
          maxR: range * 0.5,
        });
        if (targets.length) AudioSystem.toolFire();
        break;
      }
      case "cryocore": {
        // Synergy result (Snowball + Gem of Time): bigger, more frequent freeze
        const targets = nm.inRadius(player.x, player.y, range);
        for (const n of targets) {
          n.frozenT = Math.max(n.frozenT, 1.7);
          if (!n.type.danger) n.hookedT = Math.max(n.hookedT, 0.3);
        }
        Game.particles.burst(player.x, player.y, "#bfe9ff", 32, {
          maxSpeed: 150,
          minLife: 0.5,
          maxLife: 0.9,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#bfe9ff",
          t: 0.5,
          maxT: 0.5,
        });
        AudioSystem.toolFire();
        break;
      }
      case "stormcaller": {
        // Synergy result (Static Cling + Ring of Magic): instant zaps + a huge pull/slow pulse
        const pool = nm
          .inRadius(player.x, player.y, range)
          .filter((n) => !n.type.danger);
        const zapCount = Math.min(pool.length, 4);
        for (let i = 0; i < zapCount; i++) {
          const idx = randInt(0, pool.length - 1);
          const n = pool.splice(idx, 1)[0];
          if (!n) continue;
          n.hookedT = Math.max(n.hookedT, 0.45);
          Game.lightningBolts.push({
            x1: player.x,
            y1: player.y,
            x2: n.x,
            y2: n.y,
            t: 0,
            dur: 0.2,
          });
        }
        const all = nm.inRadius(player.x, player.y, range);
        for (const n of all) {
          n.slowT = Math.max(n.slowT, 1.3);
        }
        Game.particles.burst(player.x, player.y, "#a970ff", 30, {
          maxSpeed: 190,
          minLife: 0.5,
          maxLife: 0.9,
        });
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#a970ff",
          t: 0.5,
          maxT: 0.5,
        });
        AudioSystem.toolFire();
        break;
      }
      case "bigbang": {
        // Synergy result (Confetti Bomb + Care Package): a rare, devastating single blast
        Game.telegraphs.push({
          x: player.x,
          y: player.y,
          r: range,
          color: "#ffd76a",
          t: 0.9,
          maxT: 0.9,
        });
        Game.delayedEffects.push({
          t: 0.9,
          fn: () => {
            const targets = nm.inRadius(player.x, player.y, range);
            for (const n of targets) {
              n.frozenT = Math.max(n.frozenT, 1.6);
              if (!n.type.danger) n.hookedT = Math.max(n.hookedT, 0.4);
            }
            Game.particles.burst(player.x, player.y, "#ff9dc9", 50, {
              maxSpeed: 280,
              minLife: 0.4,
              maxLife: 0.85,
            });
            Game.particles.burst(player.x, player.y, "#ffd76a", 34, {
              maxSpeed: 220,
              minLife: 0.4,
              maxLife: 0.8,
            });
            Game.shockwaves.push({
              x: player.x,
              y: player.y,
              color: "#ff9dc9",
              t: 0,
              duration: 0.5,
              maxR: range,
            });
            Game.camera.shake(12, 0.28);
            AudioSystem.golden();
          },
        });
        break;
      }
      case "airplane": {
        // Pierces every non-danger Bayat in a narrow cone aimed at the
        // nearest one — the only tool that hits a LINE of targets instead
        // of a radius around the player or a single picked point.
        const aimTarget = nm.nearest(player.x, player.y, (n) => !n.type.danger);
        if (!aimTarget) break;
        const angle = Math.atan2(
          aimTarget.y - player.y,
          aimTarget.x - player.x,
        );
        const coneHalfAngle = 0.22; // ~12.6 degrees either side
        const targets = nm.list.filter((n) => {
          if (!n.alive || n.type.danger) return false;
          if (dist(player.x, player.y, n.x, n.y) > range) return false;
          let diff = Math.abs(Math.atan2(n.y - player.y, n.x - player.x) - angle);
          if (diff > Math.PI) diff = TAU - diff;
          return diff < coneHalfAngle;
        });
        for (const n of targets) {
          n.hookedT = Math.max(n.hookedT, 0.4);
        }
        Game.ropeLines.push({
          x1: player.x,
          y1: player.y,
          x2: player.x + Math.cos(angle) * range,
          y2: player.y + Math.sin(angle) * range,
          t: 0,
          dur: 0.22,
          color: "#7fd8e8",
        });
        if (targets.length) AudioSystem.toolFire();
        break;
      }
      case "firecracker": {
        // Targets are picked from anywhere currently on screen, not
        // within a radius of the player — see the def's `range` comment
        // in content.js for why it still has one anyway.
        const maxTargets = t.def.targets ? t.def.targets(t.level) : 2;
        const cam = Game.camera;
        const pool = nm.list.filter(
          (n) =>
            n.alive &&
            !n.type.danger &&
            n.x > cam.x - 40 &&
            n.x < cam.x + cam.w + 40 &&
            n.y > cam.y - 40 &&
            n.y < cam.y + cam.h + 40,
        );
        const total = Math.min(pool.length, maxTargets);
        for (let i = 0; i < total; i++) {
          const idx = randInt(0, pool.length - 1);
          const n = pool.splice(idx, 1)[0];
          if (!n) continue;
          n.hookedT = Math.max(n.hookedT, 0.4);
          // strikes straight down onto the target rather than from the
          // player — reinforces that this isn't a "reach out" tool
          Game.lightningBolts.push({
            x1: n.x,
            y1: n.y - 60,
            x2: n.x,
            y2: n.y,
            t: 0,
            dur: 0.18,
          });
        }
        if (total > 0) AudioSystem.toolFire();
        break;
      }
      case "balloon": {
        const maxHearts = 1 + Math.floor(t.level / 2);
        const poolCopy = nm.list.filter(
          (n) =>
            n.alive &&
            !n.type.danger &&
            dist(player.x, player.y, n.x, n.y) <= range,
        );
        const chosen = [];
        while (chosen.length < maxHearts && poolCopy.length) {
          const idx = randInt(0, poolCopy.length - 1);
          chosen.push(poolCopy.splice(idx, 1)[0]);
        }
        for (const target of chosen) {
          const d = dist(player.x, player.y, target.x, target.y);
          const travel =
            Math.min(t.def.travel, Math.max(0.18, d / 900)) *
            (player.quickTossMult || 1);
          const targetId = target.id;
          Game.projectiles.push({
            kind: "missile",
            x: player.x,
            y: player.y,
            targetId,
            t: 0,
            dur: travel,
          });
          Game.delayedEffects.push({
            t: travel,
            fn: () => {
              const n = nm.list.find((nn) => nn.id === targetId && nn.alive);
              if (n) {
                n.hookedT = Math.max(n.hookedT, 0.5);
                Game.particles.burst(n.x, n.y, "#ff9dc9", 12, {
                  maxSpeed: 130,
                });
              }
            },
          });
        }
        if (chosen.length) AudioSystem.toolFire();
        break;
      }
      case "cupid": {
        // Targets the FARTHEST non-danger Bayat in range instead of the
        // nearest/cluster — every other tool aims close, this one mops
        // up whatever straggler is about to wander out of range.
        let best = null,
          bd = -1;
        for (const n of nm.list) {
          if (!n.alive || n.type.danger) continue;
          const d = dist(player.x, player.y, n.x, n.y);
          if (d <= range && d > bd) {
            bd = d;
            best = n;
          }
        }
        if (!best) break;
        best.hookedT = Math.max(best.hookedT, 0.7);
        drawRopeLine(player, best, "#ff7ab8");
        Game.particles.burst(best.x, best.y, "#ff7ab8", 14, { maxSpeed: 140 });
        AudioSystem.toolFire();
        break;
      }
    }
  }
}
function drawRopeLine(player, target, color) {
  Game.ropeLines.push({
    x1: player.x,
    y1: player.y,
    x2: target.x,
    y2: target.y,
    t: 0,
    dur: 0.22,
    color,
  });
}
