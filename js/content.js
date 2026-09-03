"use strict";

/* =========================================================
   GAME CONTENT / DATA TABLES
   =========================================================
   Every data table the game reads lives here. Tunable NUMBERS live in
   js/config.js instead (loaded before this file) — this file is the
   "what exists" layer, config.js is the "how strong is it" layer.
   ========================================================= */

/* Among-Us-style fixed color palette for co-op player identity (profile
   screen swatches, remote-player nametags/avatars in multiplayer). Picked
   for contrast against the dark UI panels and against each other; not
   tied to any single arena's palette. See CLAUDE.md "Multiplayer" section. */
const MP_COLORS = [
  { id: "red", name: "Red", hex: "#ff5c72" },
  { id: "blue", name: "Blue", hex: "#4aa3ff" },
  { id: "green", name: "Green", hex: "#6fe3a3" },
  { id: "yellow", name: "Yellow", hex: "#f5d90a" },
  { id: "pink", name: "Pink", hex: "#ff7ab8" },
  { id: "orange", name: "Orange", hex: "#ff7a3d" },
  { id: "cyan", name: "Cyan", hex: "#7fd8e8" },
  { id: "purple", name: "Purple", hex: "#a970ff" },
  { id: "white", name: "White", hex: "#f2eefc" },
  { id: "black", name: "Black", hex: "#2a2438" },
];

/* Bayat types: visual identity is created entirely from ONE base PNG.
   Color variants are produced by SpriteTint (see below), which recolors
   only the visible (alpha>0) pixels of the sprite and leaves transparent
   pixels fully transparent — no colored fringing, no filter hacks. */
const BAYAT_TYPES = {
  normal: {
    key: "normal",
    label: "Bayat",
    speedMult: 1.0,
    sizeMult: 1.0,
    expMult: 1.0,
    rewardMult: 1.0,
    color: "#cdd6f4",
    dark: "#9aa3c9",
    weightBase: 10,
    minDiff: 0,
    flee: true,
    danger: false,
    glow: false,
    tintColor: null,
    tintStrength: 0,
    badge: "",
    badgeColor: "#fff",
    turnRate: 4.5,
    jitter: 0.7,
    slipChance: 0.02,
  },
  fast: {
    key: "fast",
    label: "Fast Bayat",
    speedMult: 1.75,
    sizeMult: 0.88,
    expMult: 1.35,
    rewardMult: 1.3,
    color: "#89dceb",
    dark: "#5fb2c4",
    weightBase: 5,
    minDiff: 0.04,
    flee: true,
    danger: false,
    glow: false,
    tintColor: "#39c5e0",
    tintStrength: 0.55,
    badge: "»",
    badgeColor: "#bdf3ff",
    turnRate: 6.5,
    jitter: 0.9,
    slipChance: 0.05,
  },
  slow: {
    key: "slow",
    label: "Slow Bayat",
    speedMult: 0.55,
    sizeMult: 1.12,
    expMult: 0.7,
    rewardMult: 0.6,
    color: "#a6adc8",
    dark: "#7c839f",
    weightBase: 6,
    minDiff: 0,
    flee: true,
    danger: false,
    glow: false,
    tintColor: "#7c839f",
    tintStrength: 0.45,
    badge: "~",
    badgeColor: "#d7dcef",
    turnRate: 2.6,
    jitter: 0.4,
    slipChance: 0.02,
  },
  tiny: {
    key: "tiny",
    label: "Tiny Bayat",
    speedMult: 1.25,
    sizeMult: 0.55,
    expMult: 1.25,
    rewardMult: 1.15,
    color: "#f9e2af",
    dark: "#c9ac5f",
    weightBase: 4,
    minDiff: 0.08,
    flee: true,
    danger: false,
    glow: false,
    tintColor: "#f0c94a",
    tintStrength: 0.4,
    badge: "·",
    badgeColor: "#ffe9a3",
    turnRate: 8.0,
    jitter: 1.6,
    slipChance: 0.06,
  },
  giant: {
    key: "giant",
    label: "Giant Bayat",
    speedMult: 0.42,
    sizeMult: 1.9,
    expMult: 1.9,
    rewardMult: 2.3,
    color: "#fab387",
    dark: "#c47f4f",
    weightBase: 2.4,
    minDiff: 0.12,
    flee: true,
    danger: false,
    glow: false,
    tintColor: "#e8823f",
    tintStrength: 0.5,
    badge: "!!",
    badgeColor: "#ffd3ac",
    turnRate: 2.0,
    jitter: 0.3,
    slipChance: 0.005,
  },
  dangerous: {
    key: "dangerous",
    label: "DANGEROUS Bayat",
    speedMult: 0.55,
    sizeMult: 1.0,
    expMult: 0.0,
    rewardMult: -1.7,
    color: "#f38ba8",
    dark: "#b5495f",
    weightBase: 3.2,
    minDiff: 0.06,
    flee: false,
    danger: true,
    glow: false,
    tintColor: "#ff2d4d",
    tintStrength: 0.7,
    badge: "☠",
    badgeColor: "#ffbfca",
    turnRate: 3.0,
    jitter: 0.5,
    slipChance: 0.01,
  },
  golden: {
    key: "golden",
    label: "GOLDEN Bayat",
    speedMult: 2.1,
    sizeMult: 0.85,
    expMult: 4.2,
    rewardMult: 5.5,
    color: "#ffd76a",
    dark: "#c99a1e",
    weightBase: 0.22,
    minDiff: 0,
    flee: true,
    danger: false,
    glow: true,
    tintColor: "#ffcc22",
    tintStrength: 0.65,
    badge: "★",
    badgeColor: "#fff2c2",
    turnRate: 9.5,
    jitter: 2.4,
    slipChance: 0.03,
  },
  boost: {
    key: "boost",
    label: "BOOST Bayat",
    speedMult: 1.15,
    sizeMult: 0.95,
    expMult: 1.5,
    rewardMult: 1.4,
    color: "#7cffb2",
    dark: "#2ecf7c",
    weightBase: 1.6,
    minDiff: 0.03,
    flee: true,
    danger: false,
    glow: true,
    boostType: true,
    tintColor: "#39ff9a",
    tintStrength: 0.6,
    badge: "⚡",
    badgeColor: "#c8ffe0",
    turnRate: 5.5,
    jitter: 1.0,
    slipChance: 0.03,
  },
  snowball: {
    key: "snowball",
    label: "Snowball Bayat",
    speedMult: 0.85,
    sizeMult: 1.0,
    expMult: 1.4,
    rewardMult: 1.3,
    color: "#bfe9ff",
    dark: "#6bb8dd",
    weightBase: 2.2,
    minDiff: 0.08,
    flee: true,
    danger: false,
    glow: false,
    ranged: true,
    tintColor: "#7fd8f5",
    tintStrength: 0.55,
    badge: "❄",
    badgeColor: "#d9f3ff",
    turnRate: 3.5,
    jitter: 0.6,
    slipChance: 0.07,
  },
  bomb: {
    key: "bomb",
    label: "BOMB Bayat",
    speedMult: 0.7,
    sizeMult: 1.05,
    expMult: 2.0,
    rewardMult: 1.8,
    color: "#8d1936",
    dark: "#1a0d0d",
    weightBase: 1.4,
    minDiff: 0.14,
    flee: false,
    danger: false,
    glow: false,
    bombType: true,
    tintColor: "#2a1010",
    tintStrength: 0.75,
    badge: "",
    badgeColor: "#ff8a3d",
    turnRate: 2.0,
    jitter: 0.2,
    slipChance: 0.008,
  },
  // Co-op only (see pickType()'s medkitType filter below) — hugging one
  // doesn't give EXP/time like every other type, it gives a Medkit
  // consumable used to revive a downed teammate. Reuses the same base
  // sprite + SpriteTint like every other type; no new art.
  medkit: {
    key: "medkit",
    label: "Medkit Bayat",
    speedMult: 0.65,
    sizeMult: 1.0,
    expMult: 0,
    rewardMult: 0,
    color: "#9adfff",
    dark: "#4a90b8",
    weightBase: 1.2,
    minDiff: 0,
    flee: true,
    danger: false,
    glow: true,
    medkitType: true,
    tintColor: "#7fe0ff",
    tintStrength: 0.6,
    badge: "+",
    badgeColor: "#dff6ff",
    turnRate: 3.0,
    jitter: 0.5,
    slipChance: 0.02,
  },

  /* ---- "Chaos Update" rare / mini-boss variants — same one base
     sprite + SpriteTint as every type above, no new art. Low weightBase
     and a meaningful minDiff keep them feeling like genuine discoveries
     rather than flooding the normal spawn mix. See CLAUDE.md "Chaos
     Update" section for the full rundown of each one's hook/mechanic. ---- */
  runner: {
    key: "runner",
    label: "THE RUNNER",
    miniBoss: true,
    speedMult: 2.6,
    sizeMult: 0.9,
    expMult: 5.5,
    rewardMult: 6.5,
    color: "#ff9f40",
    dark: "#a85a12",
    weightBase: 0.12,
    minDiff: 0.15,
    flee: true,
    danger: false,
    glow: true,
    tintColor: "#ff9f40",
    tintStrength: 0.62,
    badge: "≫", // ≫
    badgeColor: "#ffe0bd",
    turnRate: 10.5, // extremely twitchy — hardest thing in the game to corner
    jitter: 3.2,
    slipChance: 0.02,
  },
  tank: {
    key: "tank",
    label: "THE TANK",
    miniBoss: true,
    speedMult: 0.55,
    sizeMult: 1.55,
    expMult: 5,
    rewardMult: 6,
    color: "#6b7a99",
    dark: "#2c3448",
    weightBase: 0.14,
    minDiff: 0.2,
    flee: true,
    danger: false,
    glow: false,
    tintColor: "#6b7a99",
    tintStrength: 0.68,
    badge: "▣", // ▣
    badgeColor: "#c7d0e8",
    turnRate: 4.5, // slow in a straight line, but juks unpredictably — deceptively hard to pin
    jitter: 2.6,
    slipChance: 0.01,
  },
  // Periodically "phases" — see Bayat.update()'s ghostType branch and
  // entities.js's rendering alpha. While phased it can't be hugged at
  // all (checkHugs skips it) and tools that filter `!n.type.danger`
  // still see it as a legal target, so pulls just visibly fail to stick.
  ghost: {
    key: "ghost",
    label: "Ghost Bayat",
    speedMult: 1.3,
    sizeMult: 1.0,
    expMult: 3.2,
    rewardMult: 3.6,
    color: "#cbb8ff",
    dark: "#6a5a99",
    weightBase: 0.1,
    minDiff: 0.25,
    flee: true,
    danger: false,
    glow: false,
    ghostType: true,
    tintColor: "#cbb8ff",
    tintStrength: 0.55,
    badge: "◌", // ◌
    badgeColor: "#e9e0ff",
    turnRate: 5,
    jitter: 1.2,
    slipChance: 0.015,
  },
  diamond: {
    key: "diamond",
    label: "Diamond Bayat",
    speedMult: 2.3,
    sizeMult: 0.8,
    expMult: 7,
    rewardMult: 8,
    color: "#9ff2ff",
    dark: "#2c9aa8",
    weightBase: 0.08,
    minDiff: 0.3,
    flee: true,
    danger: false,
    glow: true,
    diamondType: true, // triggers its own rare spawn-announcement toast, like golden
    tintColor: "#9ff2ff",
    tintStrength: 0.6,
    badge: "◈", // ◈
    badgeColor: "#e3fbff",
    turnRate: 9,
    jitter: 2.4,
    slipChance: 0.02,
  },
  // Visually identical to `normal` on purpose (same tint) — see
  // BAYAT_TYPES lookup skip in Bayat.draw() badge logic and the surprise
  // roll in Game.applyHugReward()'s mimicType branch. It's meant to be
  // indistinguishable until you've already committed to the hug.
  mimic: {
    key: "mimic",
    label: "Mimic Bayat",
    speedMult: 1.0,
    sizeMult: 1.0,
    expMult: 1.0,
    rewardMult: 1.0,
    color: "#c9c2b8",
    dark: "#6b6258",
    weightBase: 0.16,
    minDiff: 0.1,
    flee: true,
    danger: false,
    glow: false,
    mimicType: true,
    tintColor: null, // no tint at all — reads as a plain "normal" Bayat
    tintStrength: 0,
    badge: "", // deliberately blank, same as `normal` — see comment above
    badgeColor: "#fff2c2",
    turnRate: 5.5,
    jitter: 1.0,
    slipChance: 0.03,
  },
  // Randomly re-rolls its own color/speed every couple seconds — see
  // Bayat.update()'s chaosType branch. Reward is rolled at hug-time from
  // a wide random range instead of a fixed rewardMult (set on the
  // instance, not here — see Bayat constructor).
  chaos: {
    key: "chaos",
    label: "THE CHAOS BAYAT",
    miniBoss: true,
    speedMult: 1.4,
    sizeMult: 1.15,
    expMult: 6,
    rewardMult: 6,
    color: "#ff7ab8",
    dark: "#5a1f6b",
    weightBase: 0.07,
    minDiff: 0.35,
    flee: true,
    danger: false,
    glow: true,
    chaosType: true,
    tintColor: "#ff7ab8",
    tintStrength: 0.6,
    badge: "✦", // ✦
    badgeColor: "#ffd9f0",
    turnRate: 7,
    jitter: 2.0,
    slipChance: 0.02,
  },
};

/* Boost Bayat reward pool — hugging one grants a random temporary buff.
   Reuses the same Game.tempEffects system as curses/Turbo Surge, so it
   shows up in the Inventory "Temp Effects" tab automatically. */
const BOOST_POOL = [
  {
    id: "boostspeed",
    name: "Speed Boost",
    icon: "shoes",
    desc: "+35% movement speed",
    apply: (p) => {
      p.speedMult *= 1.35;
    },
    revert: (p) => {
      p.speedMult /= 1.35;
    },
  },
  {
    id: "boostrange",
    name: "Reach Boost",
    icon: "longarms",
    desc: "+30% hug range",
    apply: (p) => {
      p.hugRadiusMult *= 1.3;
    },
    revert: (p) => {
      p.hugRadiusMult /= 1.3;
    },
  },
  {
    id: "boostexp",
    name: "EXP Boost",
    icon: "amulet",
    desc: "+50% EXP gained",
    apply: (p) => {
      p.expMult *= 1.5;
    },
    revert: (p) => {
      p.expMult /= 1.5;
    },
  },
  {
    id: "boostcd",
    name: "Haste Boost",
    icon: "fasthands",
    desc: "-35% tool cooldowns",
    apply: (p) => {
      p.cooldownMult *= 0.65;
    },
    revert: (p) => {
      p.cooldownMult /= 0.65;
    },
  },
];

/* =========================================================
   SPRITE TINT — alpha-safe recoloring
   Loads a base sprite once, then for each requested tint,
   recolors ONLY pixels with alpha>0 by blending their RGB
   toward the target color (proportional to `strength`), while
   leaving the original alpha value (including partially
   transparent edge/antialiased pixels) completely untouched.
   Results are cached per (image,color,strength) so the pixel
   work only ever runs once. Fully reusable for any future
   colors (gold/red/blue/green/purple/white/dark/etc).
   ========================================================= */
const SpriteTint = {
  cache: {},
  getTinted(imgKey, hexColor, strength) {
    if (!hexColor || !strength) return Sprites[imgKey];
    const key = imgKey + "|" + hexColor + "|" + strength;
    if (this.cache[key]) return this.cache[key];
    const src = Sprites[imgKey];
    if (!src || !Sprites[imgKey + "Loaded"] || !src.naturalWidth) return src;
    const off = document.createElement("canvas");
    off.width = src.naturalWidth;
    off.height = src.naturalHeight;
    const octx = off.getContext("2d");
    octx.drawImage(src, 0, 0);
    let data;
    try {
      data = octx.getImageData(0, 0, off.width, off.height);
    } catch (e) {
      return src;
    } // canvas tainted (e.g. file:// in some browsers) — fall back to plain sprite
    const d = data.data;
    const tr = parseInt(hexColor.slice(1, 3), 16),
      tg = parseInt(hexColor.slice(3, 5), 16),
      tb = parseInt(hexColor.slice(5, 7), 16);
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a === 0) continue; // fully transparent pixels are left completely untouched
      // blend original color toward the tint color, weighted by strength;
      // alpha (d[i+3]) is never modified, so partial-alpha edge pixels stay correct.
      d[i] = d[i] + (tr - d[i]) * strength;
      d[i + 1] = d[i + 1] + (tg - d[i + 1]) * strength;
      d[i + 2] = d[i + 2] + (tb - d[i + 2]) * strength;
    }
    octx.putImageData(data, 0, 0);
    this.cache[key] = off;
    return off;
  },
  clearCache() {
    this.cache = {};
  },
};

/* Upgrade & Tool pools ------------------------------------------------ */
const STAT_UPGRADES = [
  {
    id: "shoes",
    name: "Running Shoes",
    icon: "👟",
    maxLevel: 5,
    desc: (l) => `+${8 * l}% move speed`,
    apply: (p, l) => {
      p.speedMult = 1 + 0.08 * l;
    },
  },
  {
    id: "bearhug",
    name: "Bear Hug",
    icon: "🤗",
    maxLevel: 5,
    desc: (l) => `+${10 * l}% hug radius, small AoE stun on hug`,
    apply: (p, l) => {
      p.hugRadiusMult = 1 + 0.1 * l;
      p.bearHugLevel = l;
    },
  },
  {
    id: "amulet",
    name: "Amulet of EXP",
    icon: "📿",
    maxLevel: 5,
    desc: (l) => `+${15 * l}% EXP gained`,
    apply: (p, l) => {
      p.expMult = 1 + 0.15 * l;
    },
  },
  {
    id: "blackhole",
    name: "Black Hole",
    icon: "🕳️",
    maxLevel: 3,
    desc: (l) => `Pulls nearby Bayats toward you (str ${l})`,
    apply: (p, l) => {
      p.blackHoleLevel = l;
    },
  },
  {
    id: "fasthands",
    name: "Fast Hands",
    icon: "⚡",
    maxLevel: 4,
    desc: (l) => `-${9 * l}% tool cooldowns`,
    apply: (p, l) => {
      p.cooldownMult = 1 - 0.09 * l;
    },
  },
  {
    id: "clover",
    name: "Four Leaf Clover",
    icon: "🍀",
    maxLevel: 4,
    desc: (l) => `+${12 * l}% luck (rarer Bayats appear more)`,
    apply: (p, l) => {
      p.luckMult = 1 + 0.12 * l;
    },
  },
  {
    id: "stickyarms",
    name: "Sticky Arms",
    icon: "🫳",
    maxLevel: 4,
    desc: (l) =>
      `Bayats that get close to your hug range are slowed down (Lv${l})`,
    apply: (p, l) => {
      p.stickyArmsLevel = l;
    },
  },
  {
    id: "longarms",
    name: "Long Arms",
    icon: "💪",
    maxLevel: 4,
    desc: (l) => `+${14 * l}% extra hug reach, stacks with Bear Hug`,
    apply: (p, l) => {
      p.longArmsBonus = 0.14 * l;
    },
  },
  {
    id: "turbolegs",
    name: "Turbo Legs",
    icon: "🚀",
    maxLevel: 4,
    desc: (l) => `+${20 + l * 8}% speed burst for a moment after every hug`,
    apply: (p, l) => {
      p.turboLevel = l;
    },
  },
  {
    id: "timepocket",
    name: "Time Pocket",
    icon: "⏳",
    maxLevel: 4,
    desc: (l) => `Every ${Math.max(6, 16 - l * 2)}s, get a free bonus`,
    apply: (p, l) => {
      p.timePocketLevel = l;
      if (!p.timePocketTimer) p.timePocketTimer = Math.max(6, 16 - l * 2);
    },
  },
  {
    id: "magnetheart",
    name: "Magnet Heart",
    icon: "🧲",
    maxLevel: 4,
    desc: (l) => `Chests can be opened from farther away and drift toward you`,
    apply: (p, l) => {
      p.magnetLevel = l;
    },
  },
  {
    id: "doublehug",
    name: "Double Hug",
    icon: "👯",
    maxLevel: 3,
    desc: (l) => `${8 * l}% chance to catch a second nearby Bayat in one hug`,
    apply: (p, l) => {
      p.doubleHugChance = 0.08 * l;
    },
  },
  {
    id: "luckysocks",
    name: "Lucky Socks",
    icon: "🧦",
    maxLevel: 4,
    desc: (l) => `Chests appear more often and rare chests are more common`,
    apply: (p, l) => {
      p.chestLuckMult = 1 + 0.25 * l;
    },
  },
  {
    id: "warmhugs",
    name: "Warm Hugs",
    icon: "💗",
    maxLevel: 5,
    desc: (l) => `+${10 * l}% reward from every hug (time or EXP)`,
    apply: (p, l) => {
      p.warmHugsMult = 1 + 0.1 * l;
    },
  },
  {
    id: "megahug",
    name: "Mega Hug Chance",
    icon: "💥",
    maxLevel: 5,
    desc: (l) => `${6 * l}% chance any hug becomes a Mega Hug (2x reward)`,
    apply: (p, l) => {
      p.megaHugChance = 0.06 * l;
    },
  },
  {
    id: "widearms",
    name: "Wide Arms",
    icon: "📏",
    maxLevel: 4,
    desc: (l) => `+${12 * l}% range on all tools`,
    apply: (p, l) => {
      p.wideArmsMult = 1 + 0.12 * l;
    },
  },
  {
    id: "quicktoss",
    name: "Quick Toss",
    icon: "🌪️",
    maxLevel: 4,
    desc: (l) => `Projectile & missile tools travel ${15 * l}% faster`,
    apply: (p, l) => {
      p.quickTossMult = 1 - Math.min(0.55, 0.15 * l);
    },
  },
  {
    id: "secondwind",
    name: "Second Wind",
    icon: "🌬️",
    maxLevel: 4,
    desc: (l) => `+${2 * l}s to your maximum stored time (Full Game)`,
    apply: (p, l) => {
      p.secondWindBonus = 2 * l;
    },
  },
  {
    id: "thickskin",
    name: "Thick Skin",
    icon: "🛡️",
    maxLevel: 4,
    desc: (l) => `Dangerous Bayats cost you ${20 * l}% less time`,
    apply: (p, l) => {
      p.thickSkinMult = 1 - Math.min(0.8, 0.2 * l);
    },
  },
  {
    id: "guardianhug",
    name: "Guardian Hug",
    icon: "🐻",
    maxLevel: 3,
    desc: (l) =>
      `${l} time(s) this run, hitting 0 refills you instead of ending the run`,
    apply: (p, l) => {
      p.guardianTotal = l;
    },
  },
  {
    id: "adrenaline",
    name: "Adrenaline Rush",
    icon: "💉",
    maxLevel: 4,
    desc: (l) => `+${10 * l}% speed & hug range when your time is running low`,
    apply: (p, l) => {
      p.adrenalineLevel = l;
    },
  },
  {
    id: "warmcocoa",
    name: "Warm Cocoa",
    icon: "☕",
    maxLevel: 5,
    desc: (l) =>
      `Passively regenerates ${(0.3 * l).toFixed(1)} time/sec (Full Game)`,
    apply: (p, l) => {
      p.timeRegenPerSec = 0.3 * l;
    },
  },
  {
    id: "combokeeper",
    name: "Combo Keeper",
    icon: "🔗",
    maxLevel: 5,
    desc: (l) => `Combo window lasts +${(0.25 * l).toFixed(2)}s longer`,
    apply: (p, l) => {
      p.comboWindowBonus = 0.25 * l;
    },
  },
  {
    id: "goldenaura",
    name: "Golden Aura",
    icon: "✨",
    maxLevel: 5,
    desc: (l) => `Combo bonus amplified by +${25 * l}%`,
    apply: (p, l) => {
      p.comboAmplifierMult = 1 + 0.25 * l;
    },
  },
  {
    id: "cozyinsulation",
    name: "Cozy Insulation",
    icon: "🧣",
    maxLevel: 4,
    desc: (l) => `Snowball slows are ${18 * l}% weaker`,
    apply: (p, l) => {
      p.snowResistMult = Math.min(0.8, 0.18 * l);
    },
  },
  {
    id: "boldhugs",
    name: "Bold Hugs",
    icon: "💗",
    maxLevel: 5,
    desc: (l) => `+${12 * l}% hug reward, but ${5 * l}% smaller hug radius`,
    apply: (p, l) => {
      p.boldHugsRewardMult = 1 + 0.12 * l;
      p.boldHugsRadiusMult = 1 - 0.05 * l;
    },
  },
];

const TOOL_DEFS = [
  {
    id: "hook",
    name: "Grappling Hook",
    icon: "🪝",
    maxLevel: 5,
    baseCooldown: 3.2,
    desc: (l) => `Yanks ${1 + Math.floor(l / 2)} nearby Bayat(s) to you.`,
    range: (l) => 320 + l * 50,
    targets: (l) => 1 + Math.floor(l / 2),
  },
  {
    id: "cake",
    name: "Cake",
    icon: "🍰",
    maxLevel: 5,
    baseCooldown: 5.5,
    desc: (l) => `Drops a tasty cake that pulls nearby Bayats in.`,
    range: (l) => 170 + l * 35,
  },
  {
    id: "rope",
    name: "Rope",
    icon: "🪢",
    maxLevel: 5,
    baseCooldown: 6.0,
    desc: (l) => `Throws a snare that drags trapped Bayats to you.`,
    range: (l) => 220 + l * 40,
  },
  {
    id: "ring",
    name: "Ring of Magic",
    icon: "💍",
    maxLevel: 5,
    baseCooldown: 7.5,
    desc: (l) => `Huge pulse: slows & pulls everything nearby.`,
    range: (l) => 340 + l * 55,
  },
  {
    id: "gem",
    name: "Gem of Time",
    icon: "💎",
    maxLevel: 5,
    baseCooldown: 9.0,
    desc: (l) => `Freezes every Bayat around you briefly.`,
    range: (l) => 190 + l * 30,
  },
  {
    id: "snowball",
    name: "Snowball",
    icon: "❄️",
    maxLevel: 5,
    baseCooldown: 4.5,
    desc: (l) => `Lobs a slow zone at the nearest Bayat crowd.`,
    range: (l) => 260 + l * 40,
  },
  {
    id: "vacuum",
    name: "Vacuum",
    icon: "🌀",
    maxLevel: 5,
    baseCooldown: 6.0,
    desc: (l) => `Sucks up to ${3 + l * 2} Bayats in a wide radius.`,
    range: (l) => 260 + l * 45,
  },
  {
    id: "magnet",
    name: "Giant Magnet",
    icon: "🧲",
    maxLevel: 5,
    baseCooldown: 8.5,
    desc: (l) => `Extremely powerful pull across a huge area.`,
    range: (l) => 400 + l * 60,
  },
  {
    id: "boomerang",
    name: "Boomerang",
    icon: "🪃",
    maxLevel: 5,
    baseCooldown: 5.0,
    desc: (l) => `Flies out and yanks Bayats back with it on return.`,
    range: (l) => 300 + l * 40,
  },
  {
    id: "net",
    name: "Net",
    icon: "🥅",
    maxLevel: 5,
    baseCooldown: 6.5,
    desc: (l) => `Traps nearby Bayats in place briefly.`,
    range: (l) => 200 + l * 30,
  },
  {
    id: "banana",
    name: "Banana Peel",
    icon: "🍌",
    maxLevel: 5,
    baseCooldown: 5.5,
    desc: (l) => `Bayats slip on it and stumble toward you.`,
    range: (l) => 230 + l * 35,
  },
  {
    id: "teleporter",
    name: "Teleporter",
    icon: "🌟",
    maxLevel: 5,
    baseCooldown: 10.0,
    desc: (l) => `Warps you straight to the nearest Bayat crowd.`,
    range: (l) => 700 + l * 80,
  },
  {
    id: "alarm",
    name: "Alarm Clock",
    icon: "⏰",
    maxLevel: 5,
    baseCooldown: 8.0,
    desc: (l) => `Startles and slows every Bayat nearby.`,
    range: (l) => 320 + l * 45,
  },

  /* ---- Continuous "aura" weapons: no cooldown, tick every frame ---- */
  {
    id: "cuddleaura",
    name: "Cuddle Aura",
    icon: "🌸",
    maxLevel: 5,
    kind: "aura",
    desc: (l) =>
      `Constant aura slows Bayats & gently pushes Dangerous ones away.`,
    range: (l) => 110 + l * 18,
  },
  {
    id: "comfortaura",
    name: "Comfort Aura",
    icon: "☕",
    maxLevel: 5,
    kind: "aura",
    tickInterval: 3.5,
    desc: (l) => `Every few seconds, passively refunds a little time/EXP.`,
    range: (l) => 90 + l * 10,
  },
  {
    id: "orbitbuddies",
    name: "Orbit Buddies",
    icon: "🧸",
    maxLevel: 5,
    kind: "orbit",
    desc: (l) =>
      `${1 + l} tiny buddies orbit you and auto-hug anything they touch.`,
    range: (l) => 60 + l * 8,
  },

  /* ---- Cast-and-resolve weapons with their own visuals ---- */
  {
    id: "confetti",
    name: "Confetti Bomb",
    icon: "🎉",
    maxLevel: 5,
    baseCooldown: 6.5,
    kind: "projectile",
    desc: (l) =>
      `Lobbed at the Bayat crowd; explodes into a pulling blast + lingering zone.`,
    range: (l) => 340 + l * 40,
    travel: 0.5,
  },
  {
    id: "staticcling",
    name: "Static Cling",
    icon: "⚡",
    maxLevel: 5,
    baseCooldown: 5.0,
    desc: (l) =>
      `Zaps ${1 + Math.floor(l / 2)} random nearby Bayats, yanking them to you instantly.`,
    range: (l) => 300 + l * 40,
    targets: (l) => 1 + Math.floor(l / 2),
  },
  {
    id: "heartmissile",
    name: "Heart Missile",
    icon: "💌",
    maxLevel: 5,
    baseCooldown: 4.2,
    kind: "missile",
    desc: (l) => `Homes in on the nearest Bayat and reels it in on arrival.`,
    range: (l) => 500 + l * 60,
    travel: 0.6,
  },
  {
    id: "carepackage",
    name: "Care Package",
    icon: "📦",
    maxLevel: 5,
    baseCooldown: 12.0,
    kind: "telegraph",
    desc: (l) =>
      `After a short warning, a huge blast freezes & pulls everything in the area.`,
    range: (l) => 260 + l * 35,
    telegraphTime: 0.9,
  },
  {
    id: "glittercloud",
    name: "Glitter Cloud",
    icon: "🌈",
    maxLevel: 5,
    baseCooldown: 9.0,
    kind: "zone",
    desc: (l) =>
      `Leaves a lingering cloud that slows any Bayat standing in it.`,
    range: (l) => 170 + l * 25,
    zoneDuration: (l) => 3 + l * 0.8,
  },
  {
    id: "anchor",
    name: "Anchor",
    icon: "⚓",
    maxLevel: 5,
    baseCooldown: 9.5,
    desc: (l) =>
      `Pulls the crowd around you to a random nearby spot and holds them there.`,
    range: (l) => 260 + l * 40,
  },
  {
    id: "partyhorn",
    name: "Party Horn",
    icon: "📯",
    maxLevel: 5,
    kind: "aura",
    tickInterval: 4,
    desc: (l) =>
      `Every few seconds, keeps an active combo alive even without a hug.`,
  },

  /* ---- newer tools: each picks targets a different way than the pull/
     slow/freeze-radius pattern above, for variety ---- */
  {
    id: "airplane",
    name: "Paper Airplane",
    icon: "✈️",
    maxLevel: 5,
    baseCooldown: 3.8,
    desc: (l) =>
      `Throws a plane toward the nearest Bayat, piercing everything in its path.`,
    range: (l) => 380 + l * 55,
  },
  {
    id: "firecracker",
    name: "Firecracker String",
    icon: "🧨",
    maxLevel: 5,
    baseCooldown: 7.0,
    desc: (l) =>
      `Zaps ${2 + Math.floor(l / 2)} random Bayats anywhere on screen, not just nearby.`,
    // fire()'s dispatch unconditionally calls t.def.range(t.level) for
    // every non-aura/orbit tool (see CLAUDE.md bug history — same class
    // of bug as the missing-range() aura crash, just for the default
    // cooldown path instead). This tool's actual targeting is screen-
    // bound, not radius-bound, so `range` here is just a large safety
    // value, not something fire()'s "firecracker" case reads.
    range: () => 2400,
    targets: (l) => 2 + Math.floor(l / 2),
  },
  {
    id: "balloon",
    name: "Love Balloon",
    icon: "🎈",
    maxLevel: 5,
    baseCooldown: 6.2,
    kind: "missile",
    desc: (l) =>
      `Releases ${1 + Math.floor(l / 2)} mini hearts that each seek out a different nearby Bayat.`,
    range: (l) => 420 + l * 50,
    travel: 0.55,
  },
  {
    id: "duster",
    name: "Feather Duster",
    icon: "🪶",
    maxLevel: 5,
    kind: "aura",
    tickInterval: 3,
    desc: (l) => `Every few seconds, a wide sweep freezes everything nearby.`,
    range: (l) => 150 + l * 22,
  },
  {
    id: "cupid",
    name: "Cupid's Arrow",
    icon: "💘",
    maxLevel: 5,
    baseCooldown: 5.2,
    desc: (l) =>
      `Fires at the FARTHEST Bayat in range instead of the nearest — mops up stragglers.`,
    range: (l) => 900 + l * 90,
  },
  {
    id: "tesla",
    name: "Tesla Coil",
    icon: "⚡",
    maxLevel: 5,
    kind: "aura",
    tickInterval: CONFIG.tesla.tickInterval,
    desc: (l) =>
      `Periodically electrocutes nearby Bayats — lightning chains between ${CONFIG.tesla.chainCount + Math.floor(l / 2)} of them.`,
    range: (l) => 260 + l * 40,
  },
  {
    id: "timebomb",
    name: "Time Bomb",
    icon: "🧨",
    maxLevel: 5,
    baseCooldown: 8.5,
    kind: "telegraph",
    desc: (l) =>
      `Drops a bomb that explodes after a delay — big pull + knockback + time drain on Dangerous Bayats caught in it.`,
    range: (l) => CONFIG.timebomb.explosionRadius + l * 20,
    telegraphTime: CONFIG.timebomb.fuseDuration,
  },
];

/* Pixel-art icon sprite sheet lookup: id -> [col,row] cell in assets/icons.png
   (8 columns x 9 rows, 48px cells). Falls back to the def's emoji if an id
   isn't in the sheet, so nothing ever renders blank. */
const ICON_SPRITE = {
  shoes: [0, 0],
  bearhug: [1, 0],
  amulet: [2, 0],
  blackhole: [3, 0],
  fasthands: [4, 0],
  clover: [5, 0],
  stickyarms: [6, 0],
  longarms: [7, 0],
  turbolegs: [0, 1],
  timepocket: [1, 1],
  magnetheart: [2, 1],
  doublehug: [3, 1],
  luckysocks: [4, 1],
  warmhugs: [5, 1],
  megahug: [6, 1],
  widearms: [7, 1],
  quicktoss: [0, 2],
  secondwind: [1, 2],
  thickskin: [2, 2],
  guardianhug: [3, 2],
  adrenaline: [4, 2],
  hook: [5, 2],
  cake: [6, 2],
  rope: [7, 2],
  ring: [0, 3],
  gem: [1, 3],
  snowball: [2, 3],
  vacuum: [3, 3],
  magnet: [4, 3],
  boomerang: [5, 3],
  net: [6, 3],
  banana: [7, 3],
  teleporter: [0, 4],
  alarm: [1, 4],
  cuddleaura: [2, 4],
  comfortaura: [3, 4],
  orbitbuddies: [4, 4],
  confetti: [5, 4],
  staticcling: [6, 4],
  heartmissile: [7, 4],
  carepackage: [0, 5],
  glittercloud: [1, 5],
  anchor: [2, 5],
  partyhorn: [3, 5],
  gravitywell: [4, 5],
  cryocore: [5, 5],
  stormcaller: [6, 5],
  bigbang: [7, 5],
  bestbuds: [0, 6],
  fortunesfavor: [1, 6],
  warmcocoa: [2, 6],
  combokeeper: [3, 6],
  goldenaura: [4, 6],
  cozyinsulation: [5, 6],
  boldhugs: [6, 6],
  airplane: [7, 6],
  firecracker: [0, 7],
  balloon: [1, 7],
  duster: [2, 7],
  cupid: [3, 7],
  tesla: [4, 7],
  timebomb: [5, 7],
};
function iconHTML(id, sizePx, fallbackEmoji) {
  const cell = ICON_SPRITE[id];
  if (!cell)
    return `<span style="font-size:${sizePx}px;line-height:1;">${fallbackEmoji || "\u2726"}</span>`;
  const cellSize = 48;
  const scale = sizePx / cellSize;
  return `<div class="pixel-icon" style="width:${sizePx}px;height:${sizePx}px;background-position:-${cell[0] * cellSize * scale}px -${cell[1] * cellSize * scale}px;background-size:${384 * scale}px ${432 * scale}px;"></div>`;
}

/* =========================================================
   EVOLUTIONS — data-driven weapon/buff combinations.
   Add a new entry here to add a new evolution; nothing else in
   the game loop needs to change. `parts` lists the tool/buff ids
   (and the level each must reach) required to unlock it.
   Fire()/aura logic elsewhere checks Game.evolvedSet[id].
   ========================================================= */
const EVOLUTIONS = [
  {
    id: "bloodAura",
    name: "Blood Aura",
    icon: "🩸",
    parts: [
      { id: "cuddleaura", minLevel: 3 },
      { id: "comfortaura", minLevel: 3 },
    ],
    desc: "Comfort Aura ticks heal for 60% more.",
  },
  {
    id: "infernoCore",
    name: "Inferno Core",
    icon: "🔥",
    parts: [
      { id: "confetti", minLevel: 3 },
      { id: "bearhug", minLevel: 3 },
    ],
    desc: "Confetti Bombs blast wider and leave a bigger, longer burning zone.",
  },
  {
    id: "absoluteZero",
    name: "Absolute Zero",
    icon: "🧊",
    parts: [
      { id: "snowball", minLevel: 3 },
      { id: "stickyarms", minLevel: 3 },
    ],
    desc: "Hugging a frozen Bayat gives +40% bonus reward.",
  },
  {
    id: "bladeStorm",
    name: "Blade Storm",
    icon: "🌀",
    parts: [
      { id: "orbitbuddies", minLevel: 3 },
      { id: "fasthands", minLevel: 3 },
    ],
    desc: "+2 Orbit Buddies and a much faster spin.",
  },
  {
    id: "thunderstorm",
    name: "Thunderstorm",
    icon: "⛈️",
    parts: [
      { id: "staticcling", minLevel: 3 },
      { id: "longarms", minLevel: 3 },
    ],
    desc: "Static Cling zaps 2 extra Bayats per cast.",
  },
];

/* =========================================================
   SYNERGIES — chest-triggered combinations. Unlike EVOLUTIONS
   above (which unlock automatically once both parts reach a
   level), a synergy just requires OWNING both parts (any level),
   and is only granted the next time a chest is opened. It hands
   over a brand new tool (`resultTool`) that is stronger than
   either part alone, is added straight to the player's tools,
   and — because it's never part of STAT_UPGRADES/TOOL_DEFS and
   is immediately marked "owned" — can never be picked again or
   leveled up. One-time, permanent, fixed-strength.
   Add more entries here to add more combos.
   ========================================================= */
const SYNERGIES = [
  {
    id: "gravitywell",
    name: "Gravity Well",
    icon: "🌌",
    parts: ["blackhole", "vacuum"],
    desc: "Black Hole + Vacuum fuse into a permanent, powerful singularity.",
    resultTool: {
      id: "gravitywell",
      name: "Gravity Well",
      icon: "🌌",
      maxLevel: 1,
      kind: "aura",
      desc: () =>
        "A permanent singularity around you — constantly reels in every Bayat nearby and shoves away anything dangerous. Stronger than Black Hole or Vacuum alone. Cannot be upgraded further.",
      range: () => 300,
    },
  },
  {
    id: "cryocore",
    name: "Cryo Core",
    icon: "❄️",
    parts: ["snowball", "gem"],
    desc: "Snowball + Gem of Time fuse into a huge, frequent freeze pulse.",
    resultTool: {
      id: "cryocore",
      name: "Cryo Core",
      icon: "❄️",
      maxLevel: 1,
      baseCooldown: 6.5,
      desc: () =>
        "A large, frequent pulse that freezes every Bayat around you — bigger range and shorter cooldown than Gem of Time alone. Cannot be upgraded further.",
      range: () => 260,
    },
  },
  {
    id: "stormcaller",
    name: "Storm Caller",
    icon: "⛈️",
    parts: ["staticcling", "ring"],
    desc: "Static Cling + Ring of Magic fuse into a zapping, pulling storm.",
    resultTool: {
      id: "stormcaller",
      name: "Storm Caller",
      icon: "⛈️",
      maxLevel: 1,
      baseCooldown: 5.5,
      desc: () =>
        "Zaps a handful of Bayats instantly while pulling and slowing everything else in a huge radius. Cannot be upgraded further.",
      range: () => 360,
    },
  },
  {
    id: "bigbang",
    name: "Big Bang",
    icon: "💥",
    parts: ["confetti", "carepackage"],
    desc: "Confetti Bomb + Care Package fuse into one devastating blast.",
    resultTool: {
      id: "bigbang",
      name: "Big Bang",
      icon: "💥",
      maxLevel: 1,
      baseCooldown: 11,
      desc: () =>
        "A rare, massive blast that freezes, pulls, and showers the whole area in reward-boosting confetti. Cannot be upgraded further.",
      range: () => 320,
    },
  },
  {
    id: "bestbuds",
    name: "Best Buds",
    icon: "👯",
    parts: ["orbitbuddies", "doublehug"],
    desc: "Orbit Buddies + Double Hug fuse into a squad that chain-catches.",
    resultTool: {
      id: "bestbuds",
      name: "Best Buds",
      icon: "👯",
      maxLevel: 1,
      kind: "orbit",
      desc: () =>
        "3 orbiting buddies that each have a chance to catch a second nearby Bayat on contact. Cannot be upgraded further.",
      range: () => 70,
    },
  },
  {
    id: "fortunesfavor",
    name: "Fortune's Favor",
    icon: "🍀",
    parts: ["luckysocks", "amulet"],
    desc: "Lucky Socks + Amulet of EXP fuse into a permanent stroke of fortune.",
    resultTool: {
      id: "fortunesfavor",
      name: "Fortune's Favor",
      icon: "🍀",
      maxLevel: 1,
      kind: "passive",
      desc: () =>
        "Instantly and permanently boosts your EXP gain and chest luck. A one-time blessing — cannot be upgraded further.",
      onGrant: (p) => {
        p.expMult *= 1.25;
        p.chestLuckMult *= 1.25;
      },
    },
  },
];

/* =========================================================
   RANDOM EVENT SYSTEM — a modular, data-driven table. Game.updateEvents()
   (game.js) rolls a weighted pick from here every CONFIG.events window;
   the winning event runs for `duration` seconds as `Game.activeEvent =
   {def, t, duration}`, and every gameplay hook that cares reads
   Game.activeEvent.def directly at the point of use rather than this
   system pushing state around — see each field's comment for where it's
   read. Adding a new event is just adding an entry here (+ picking which
   of the existing multiplier fields it sets); nothing else in the loop
   needs new special-casing. `weight` is relative, doesn't need to sum to
   anything in particular.
   ========================================================= */
const EVENT_POOL = [
  {
    id: "bayatrush",
    name: "BAYAT RUSH",
    desc: "A huge number of Bayats spawn at once.",
    weight: 10,
    duration: 9,
    color: "#ff9f40",
    spawnMult: 2.4, // read by BayatManager.update()
  },
  {
    id: "goldenminute",
    name: "GOLDEN MINUTE",
    desc: "More Golden & Diamond Bayats, better luck.",
    weight: 8,
    duration: 15,
    color: "#ffd76a",
    goldenWeightMult: 5, // read by BayatManager.pickType()
    luckMult: 1.6, // read by BayatManager.pickType() for chest-adjacent luck rolls
  },
  {
    id: "panic",
    name: "PANIC",
    desc: "Every Bayat suddenly moves much faster.",
    weight: 9,
    duration: 10,
    color: "#ff5c72",
    bayatSpeedMult: 1.7, // read by Bayat.effectiveSpeed
  },
  {
    id: "slowmo",
    name: "SLOW MOTION",
    desc: "Everything slows down... except you.",
    weight: 8,
    duration: 7,
    color: "#7fd8e8",
    bayatSpeedMult: 0.35,
  },
  {
    id: "blackout",
    name: "BLACKOUT",
    desc: "The arena goes dark except right around you.",
    weight: 6,
    duration: 12,
    color: "#0a0812",
    darkness: true, // read by Game.drawWorld()
  },
  {
    id: "doublehugevent",
    name: "DOUBLE HUG",
    desc: "Every hug gives double the reward.",
    weight: 9,
    duration: 10,
    color: "#ff7ab8",
    rewardEventMult: 2, // read by Game.applyHugReward()
  },
  {
    id: "chaosmode",
    name: "CHAOS MODE",
    desc: "Everything at once. Good luck.",
    weight: 3, // rarest of the bunch — the "oh no" event
    duration: 12,
    color: "#a970ff",
    spawnMult: 1.7,
    bayatSpeedMult: 1.3,
    rewardEventMult: 1.6,
    goldenWeightMult: 2.5,
  },
  {
    id: "timestop",
    name: "TIME STOP",
    desc: "Every Bayat freezes solid. Free hugs.",
    weight: 4, // strong effect ("free hugs") — kept rarer than the mid-tier events
    duration: 5,
    color: "#cdeaff",
    bayatSpeedMult: 0, // reuses the exact same hook as Panic/Slow Motion — 0x is just the extreme end
  },
  {
    id: "giantmode",
    name: "GIANT MODE",
    desc: "You're enormous — huge reach, but slower.",
    weight: 7,
    duration: 11,
    color: "#ffb6d9",
    playerScaleEventMult: 1.9, // read by Player.draw() (visual) and Player.hugRadius
    playerSpeedEventMult: 0.75, // read by Player.speed — the trade-off
  },
  {
    id: "magnetstorm",
    name: "MAGNET STORM",
    desc: "Every Bayat is pulled steadily toward you.",
    weight: 7,
    duration: 9,
    color: "#a970ff",
    globalPull: true, // read by Game.updateEvents() — applies a steady pull each frame
  },
  {
    id: "reverseworld",
    name: "REVERSE WORLD",
    desc: "Your controls are inverted. Good luck.",
    weight: 5,
    duration: 8,
    color: "#ff5c72",
    invertControls: true, // read by Player.update()
  },
];

/* =========================================================
   CURSED ITEMS — rare, high-risk/high-reward chest rewards, distinct
   from a normal STAT_UPGRADES pick: always a big upside PAIRED with a
   real downside, never a pure buff. Granted instead of a chest's normal
   picks with CONFIG.cursedChest.chance — see Game.onChestOpened(). Like
   BOOST_POOL, these use Game.tempEffects... except cursed items last the
   REST OF THE RUN (duration: Infinity), showing up in the Inventory
   "Temp Effects" tab as a permanent-this-run entry rather than a
   countdown.
   ========================================================= */
const CURSED_ITEMS = [
  {
    id: "cursedspeed",
    name: "Cursed Speed",
    icon: "👟",
    desc: "+100% move speed, but -50% hug range.",
    apply: (p) => {
      p.speedMult *= 2;
      p.hugRadiusMult *= 0.5;
    },
    revert: (p) => {
      p.speedMult /= 2;
      p.hugRadiusMult /= 0.5;
    },
  },
  {
    id: "bloodclock",
    name: "Blood Clock",
    icon: "⏰",
    desc: "Hugs give 2.5x time, but your timer drains 40% faster.",
    apply: (p) => {
      p.warmHugsMult = (p.warmHugsMult || 1) * 2.5;
      p.bloodClockDrainMult = 1.4;
    },
    revert: (p) => {
      p.warmHugsMult = (p.warmHugsMult || 1) / 2.5;
      p.bloodClockDrainMult = 1;
    },
  },
  {
    id: "glasshands",
    name: "Glass Hands",
    icon: "💎",
    desc: "+120% hug radius, but Dangerous Bayats cost 3x the time.",
    apply: (p) => {
      p.hugRadiusMult *= 2.2;
      p.glassHandsDangerMult = 3;
    },
    revert: (p) => {
      p.hugRadiusMult /= 2.2;
      p.glassHandsDangerMult = 1;
    },
  },
  {
    id: "chaosmagnet",
    name: "Chaos Magnet",
    icon: "🧲",
    desc: "Huge pickup range, but Bayats spawn 60% faster.",
    apply: (p) => {
      p.magnetLevel = (p.magnetLevel || 0) + 6;
      p.curseSpawnMult = (p.curseSpawnMult || 1) * 1.6;
    },
    revert: (p) => {
      p.magnetLevel = Math.max(0, (p.magnetLevel || 0) - 6);
      p.curseSpawnMult = (p.curseSpawnMult || 1) / 1.6;
    },
  },
];

/* =========================================================
   ARENA MODIFIERS — an optional per-run wildcard, rolled once in
   Game.rollRunModifier() (startGame()) and stored as Game.runModifier
   for the rest of the run. `chance` is the odds THIS SPECIFIC modifier
   wins the roll if a modifier happens at all — see rollRunModifier()'s
   own comment for the "does one happen" gate. Every field here is read
   live by the same hook points CONFIG.hyperMode/EVENT_POOL already use
   (bayatSpeedMult in Bayat.effectiveSpeed, rewardMult in
   applyHugReward, etc) rather than each modifier inventing its own.
   ========================================================= */
const ARENA_MODIFIERS = [
  {
    id: "fastworld",
    name: "Fast World",
    desc: "Everything moves faster — you included.",
    weight: 10,
    bayatSpeedMult: 1.35,
    playerSpeedRunMult: 1.25,
  },
  {
    id: "tinyworld",
    name: "Tiny World",
    desc: "Everyone is smaller and quicker to lose track of.",
    weight: 8,
    bayatSizeMult: 0.7,
  },
  {
    id: "richworld",
    name: "Rich World",
    desc: "+50% EXP and time from every hug.",
    weight: 10,
    rewardMult: 1.5,
  },
  {
    id: "dangerousworld",
    name: "Dangerous World",
    desc: "Dangerous Bayats show up much more often.",
    weight: 8,
    dangerWeightMult: 2.4,
  },
  {
    id: "infinitecombo",
    name: "Infinite Combo",
    desc: "Your combo never decays on its own this run.",
    weight: 7,
    infiniteCombo: true,
  },
  {
    id: "nochests",
    name: "No Chests",
    desc: "No chests spawn — Bayats reward much more instead.",
    weight: 7,
    noChests: true,
    rewardMult: 1.6,
  },
];

/* =========================================================
   WORLD PICKUPS — small ground items that spawn periodically and
   auto-collect on proximity (CONFIG.pickups), independent of chests and
   Bayats entirely. Reuses existing ICON_SPRITE entries for the DOM/
   inventory-adjacent bits, but is actually drawn on canvas as a simple
   colored pixel diamond (drawPickup() in render-helpers.js) rather than
   pulling the icon sheet onto canvas — see that function's comment.
   Game.collectPickup() (game.js) is where each field below actually
   gets applied; add a new pickup by adding an entry here + one branch
   there.
   ========================================================= */
const PICKUP_DEFS = [
  {
    id: "timeshard",
    name: "Time Shard",
    icon: "timepocket",
    color: "#6fe3a3",
    weight: 12,
    timeValue: 1.5,
  },
  {
    id: "megatimeshard",
    name: "Mega Time Shard",
    icon: "timepocket",
    color: "#ffd76a",
    weight: 2,
    timeValue: 10,
  },
  {
    id: "xpcrystal",
    name: "XP Crystal",
    icon: "amulet",
    color: "#a970ff",
    weight: 12,
    expValue: 40,
  },
  {
    id: "comboorb",
    name: "Combo Orb",
    icon: "megahug",
    color: "#ff7ab8",
    weight: 6,
    comboBoost: 6,
  },
  {
    id: "luckorb",
    name: "Luck Orb",
    icon: "clover",
    color: "#7fd8e8",
    weight: 6,
    luckBuffDuration: 14,
  },
  {
    id: "mysteryorb",
    name: "Mystery Orb",
    icon: "blackhole",
    color: "#cbb8ff",
    weight: 8,
    mystery: true,
  },
  {
    id: "chaosorb",
    name: "Chaos Orb",
    icon: "goldenaura",
    color: "#ff5c72",
    weight: 3,
    triggerEvent: true,
  },
];

/* =========================================================
   ACHIEVEMENTS — persistent, cross-run unlocks (SaveSystem-backed, see
   SaveSystem.getUnlockedAchievements()/unlockAchievement()). Checked via
   Game.checkAchievement(id) sprinkled at the relevant moment in whatever
   system owns that moment (see each id's comment below for where).
   `hidden:true` entries show "???" in the achievements screen until
   unlocked — everything else shows its real name/desc always, locked or
   not, so players know what to aim for.
   ========================================================= */
const ACHIEVEMENTS = [
  { id: "firsthug", name: "First Hug", desc: "Hug your first Bayat.", icon: "warmhugs" },
  { id: "hug100", name: "Professional Hugger", desc: "Hug 100 Bayats total (across all runs).", icon: "warmhugs" },
  { id: "hug1000", name: "Hug Apocalypse", desc: "Hug 1,000 Bayats total (across all runs).", icon: "megahug" },
  { id: "manybayats", name: "WHY ARE THERE SO MANY?", desc: "Have 60+ Bayats alive on screen at once.", icon: "goldenaura" },
  { id: "bombhit", name: "OH NO", desc: "Get caught by a Bomb Bayat's explosion.", icon: "firecracker" },
  { id: "snowhit", name: "Snow Problem", desc: "Get hit by a Snowball Bayat.", icon: "snowball" },
  { id: "slips10", name: "Slippery Situation", desc: "Watch 10 Bayats slip in a single run.", icon: "shoes" },
  { id: "chaosevent", name: "Maximum Chaos", desc: "Trigger CHAOS MODE.", icon: "goldenaura" },
  { id: "jumpscare", name: "Mr. Squeeze?!", desc: "Survive a jumpscare from Mr. Squeeze.", icon: "boldhugs", hidden: true },
  { id: "goldenjumpscare", name: "Golden Squeeze", desc: "Get the ultra-rare Golden Mr. Squeeze visit.", icon: "goldenaura", hidden: true },
  { id: "goldenhug", name: "Golden Hug", desc: "Hug a Golden Bayat.", icon: "megahug" },
  { id: "diamondhug", name: "Diamond in the Rough", desc: "Hug a Diamond Bayat.", icon: "gem" },
  { id: "miniboss", name: "Boss Hugger", desc: "Hug a mini-boss Bayat (Runner, Tank, or Chaos).", icon: "thickskin" },
  { id: "ghosthug", name: "Gotcha, Ghost", desc: "Hug a Ghost Bayat while it's solid.", icon: "clover" },
  { id: "mimicjackpot", name: "Sneaky Sneaky", desc: "Hit the jackpot on a Mimic Bayat.", icon: "gem", hidden: true },
  { id: "hyperhug", name: "HYPER HUG MODE", desc: "Reach x100 combo and trigger Hyper Hug Mode.", icon: "goldenaura" },
  { id: "combo50", name: "Unstoppable", desc: "Reach a x50 combo.", icon: "megahug" },
  { id: "cursed", name: "Deal With The Devil", desc: "Take a Cursed Item from a chest.", icon: "boldhugs" },
  { id: "legendarychest", name: "Jackpot", desc: "Open a Legendary chest.", icon: "gem" },
  { id: "allarenas", name: "Bayat Collector", desc: "Unlock every arena.", icon: "clover" },
  { id: "guardiansave", name: "So Close", desc: "Get saved by Guardian Hug.", icon: "guardianhug" },
  { id: "downedrevive", name: "I've Got You", desc: "Revive a downed teammate in co-op.", icon: "adrenaline" },
];

/* =========================================================
   ARENAS — each arena swaps background/decor/atmosphere and
   nudges a few gameplay knobs. Add a new arena here; nothing
   else needs to change (rendering + spawning read from
   Game.arena at runtime).
   ========================================================= */
const ARENAS = [
  {
    id: "meadow",
    name: "Sunny Meadow",
    desc: "The original hugging grounds. Balanced and friendly.",
    difficulty: "Easy",
    modifierText: "No modifiers — a fair fight.",
    bg: "#120e1c",
    accent: "#7c3aed",
    decorPalette: ["#3a3055", "#4a3f6b", "#2f2648"],
    decorKinds: ["rock", "bush", "flower", "crystal"],
    zoneColors: [
      "rgba(124,58,237,0.10)",
      "rgba(245,185,66,0.08)",
      "rgba(255,122,184,0.08)",
      "rgba(111,227,163,0.07)",
      "rgba(127,216,232,0.08)",
    ],
    spawnDangerMult: 1,
    chestLuckMult: 1,
    playerSpeedMult: 1,
    bayatSpeedMult: 1,
    floorTiles: [
      { color: "#233522", weight: 10 },
      { color: "#2a3e28", weight: 8 },
      { color: "#1e2e1d", weight: 5 },
      { color: "#31462c", weight: 3 },
    ],
    floorFeatures: ["patch", "dot"],
    floorFeatureColor: "#3d5a35",
    floorFeatureChance: 0.08,
    unlock: null,
  },
  {
    id: "graveyard",
    name: "Haunted Graveyard",
    desc: "Fog, tombstones, and Bayats that don\u2019t scare easy.",
    difficulty: "Medium",
    modifierText: "+35% Dangerous Bayat frequency.",
    bg: "#0d0d14",
    accent: "#8a7bbf",
    decorPalette: ["#2b2b38", "#1f1f2c", "#3a3a4a"],
    decorKinds: ["tombstone", "deadtree", "fog"],
    zoneColors: ["rgba(138,123,191,0.12)", "rgba(90,90,110,0.10)"],
    spawnDangerMult: 1.35,
    chestLuckMult: 1,
    playerSpeedMult: 1,
    bayatSpeedMult: 1,
    floorTiles: [
      { color: "#231f26", weight: 10 },
      { color: "#2a2530", weight: 7 },
      { color: "#1c1920", weight: 6 },
      { color: "#332c22", weight: 2 },
    ],
    floorFeatures: ["crack", "pebble"],
    floorFeatureColor: "#161318",
    floorFeatureChance: 0.1,
    unlock: { value: 25 },
  },
  {
    id: "cavern",
    name: "Crystal Cavern",
    desc: "Glittering rock everywhere. Luck runs high down here.",
    difficulty: "Medium",
    modifierText: "+50% chest luck, tighter decor clusters.",
    bg: "#0f1522",
    accent: "#7fd8e8",
    decorPalette: ["#2a3a52", "#1f2c40", "#365269"],
    decorKinds: ["crystal", "rock"],
    zoneColors: ["rgba(127,216,232,0.12)", "rgba(169,112,255,0.09)"],
    spawnDangerMult: 0.9,
    chestLuckMult: 1.5,
    playerSpeedMult: 1,
    bayatSpeedMult: 1,
    floorTiles: [
      { color: "#1c2536", weight: 10 },
      { color: "#212c40", weight: 8 },
      { color: "#182030", weight: 6 },
      { color: "#243349", weight: 3 },
    ],
    floorFeatures: ["crack", "glow"],
    floorFeatureColor: "#7fd8e8",
    floorFeatureChance: 0.09,
    unlock: { value: 60 },
  },
  {
    id: "wasteland",
    name: "Burning Wasteland",
    desc: "Cracked earth and heat haze. Everything moves faster.",
    difficulty: "Hard",
    modifierText: "+15% Bayat speed, +20% rewards.",
    bg: "#1c0f0a",
    accent: "#ff7a3d",
    decorPalette: ["#3d2416", "#4a2c1a", "#2a1810"],
    decorKinds: ["rock", "ember"],
    zoneColors: ["rgba(255,122,61,0.14)", "rgba(255,92,114,0.08)"],
    spawnDangerMult: 1.15,
    chestLuckMult: 1,
    playerSpeedMult: 1,
    bayatSpeedMult: 1.15,
    rewardMult: 1.2,
    floorTiles: [
      { color: "#2a1811", weight: 10 },
      { color: "#331e14", weight: 7 },
      { color: "#20130d", weight: 6 },
      { color: "#3d2115", weight: 2 },
    ],
    floorFeatures: ["crack", "ember"],
    floorFeatureColor: "#ff6a2e",
    floorFeatureChance: 0.1,
    unlock: { value: 120 },
  },
  {
    id: "frozen",
    name: "Frozen Ruins",
    desc: "Slippery ice and old broken statues. Slow and tense.",
    difficulty: "Hard",
    modifierText: "-10% player & Bayat speed, longer freezes.",
    bg: "#0d1620",
    accent: "#9adfff",
    decorPalette: ["#22374a", "#2c4258", "#1a2836"],
    decorKinds: ["icecrystal", "rock"],
    zoneColors: ["rgba(154,223,255,0.14)", "rgba(169,112,255,0.08)"],
    spawnDangerMult: 1,
    chestLuckMult: 1.1,
    playerSpeedMult: 0.9,
    bayatSpeedMult: 0.9,
    floorTiles: [
      { color: "#182838", weight: 10 },
      { color: "#1e3040", weight: 8 },
      { color: "#132230", weight: 6 },
      { color: "#24384a", weight: 3 },
    ],
    floorFeatures: ["patch", "crack"],
    floorFeatureColor: "#bfe9ff",
    floorFeatureChance: 0.11,
    unlock: { value: 200 },
  },
];
