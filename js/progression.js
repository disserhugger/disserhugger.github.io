"use strict";

/* =========================================================
   EXPERIENCE SYSTEM
   ========================================================= */
class ExperienceSystem {
  constructor() {
    this.level = 1;
    this.exp = 0;
    this.expToNext = CONFIG.leveling.baseExp;
  }
  reset() {
    this.level = 1;
    this.exp = 0;
    this.expToNext = CONFIG.leveling.baseExp;
  }
  add(amount) {
    this.exp += amount;
    const levels = [];
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.round(
        CONFIG.leveling.baseExp *
          Math.pow(CONFIG.leveling.growth, this.level - 1),
      );
      levels.push(this.level);
    }
    return levels;
  }
  get progress() {
    return clamp(this.exp / this.expToNext, 0, 1);
  }
}

/* =========================================================
   UPGRADE SYSTEM
   ========================================================= */
class UpgradeSystem {
  constructor() {
    this.levels = {};
  }
  reset() {
    this.levels = {};
  }
  levelOf(id) {
    return this.levels[id] || 0;
  }
  isMaxed(def) {
    return this.levelOf(def.id) >= def.maxLevel;
  }
  rollChoices(n, includeTools) {
    const pool = [];
    for (const def of STAT_UPGRADES) {
      if (!this.isMaxed(def)) pool.push(def);
    }
    if (includeTools) {
      for (const def of TOOL_DEFS) {
        if (!this.isMaxed(def)) pool.push(def);
      }
    }
    const picks = [];
    const copy = pool.slice();
    while (picks.length < n && copy.length) {
      const idx = randInt(0, copy.length - 1);
      picks.push(copy.splice(idx, 1)[0]);
    }
    return picks;
  }
  apply(def, player) {
    const newLevel = this.levelOf(def.id) + 1;
    this.levels[def.id] = newLevel;
    if (STAT_UPGRADES.includes(def)) {
      def.apply(player, newLevel);
    } else {
      Game.tools.equip(def, newLevel);
    }
    return newLevel;
  }
}
