"use strict";

/* =========================================================
   SAVE SYSTEM
   ========================================================= */
const SaveSystem = {
  KEY_ARCADE: "bayatHug_arcadeHighScore",
  KEY_FULL: "bayatHug_fullGameBestTime",
  KEY_SETTINGS: "bayatHug_settings",
  KEY_LIFETIME: "bayatHug_lifetimeHugs",
  // In-memory fallback used whenever localStorage isn't available (private
  // browsing on iOS Safari throws on every setItem, some Android WebViews
  // disable storage entirely, quota can fill up, etc). Scores still work
  // for the current session — they just won't persist — and, importantly,
  // a storage failure can never throw up into the game loop and freeze it.
  _mem: {},
  safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return key in this._mem ? this._mem[key] : null;
    }
  },
  safeSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      this._mem[key] = val;
    }
  },
  safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete this._mem[key];
    }
  },
  // Arena-specific scores live under their own key so old saves keep working —
  // the default 'meadow' arena still reads/writes the original keys.
  arcadeKey(arenaId) {
    return !arenaId || arenaId === "meadow"
      ? this.KEY_ARCADE
      : this.KEY_ARCADE + "_" + arenaId;
  },
  fullKey(arenaId) {
    return !arenaId || arenaId === "meadow"
      ? this.KEY_FULL
      : this.KEY_FULL + "_" + arenaId;
  },
  getArcadeBest(arenaId) {
    return parseInt(this.safeGet(this.arcadeKey(arenaId)) || "0", 10) || 0;
  },
  setArcadeBest(v, arenaId) {
    this.safeSet(this.arcadeKey(arenaId), String(v));
  },
  getFullBest(arenaId) {
    return parseFloat(this.safeGet(this.fullKey(arenaId)) || "0") || 0;
  },
  setFullBest(v, arenaId) {
    this.safeSet(this.fullKey(arenaId), String(v));
  },
  getLifetimeHugs() {
    return parseInt(this.safeGet(this.KEY_LIFETIME) || "0", 10) || 0;
  },
  addLifetimeHugs(n) {
    const total = this.getLifetimeHugs() + (n || 0);
    this.safeSet(this.KEY_LIFETIME, String(total));
    return total;
  },
  getSettings() {
    const isTouch =
      "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
    try {
      const raw = this.safeGet(this.KEY_SETTINGS);
      if (raw)
        return Object.assign(
          {
            volume: 70,
            sfx: true,
            shake: true,
            reducedParticles: false,
            badges: true,
            touchControls: isTouch,
          },
          JSON.parse(raw),
        );
    } catch (e) {}
    return {
      volume: 70,
      sfx: true,
      shake: true,
      reducedParticles: false,
      badges: true,
      touchControls: isTouch,
    };
  },
  setSettings(s) {
    try {
      this.safeSet(this.KEY_SETTINGS, JSON.stringify(s));
    } catch (e) {}
  },
  resetScores() {
    this.safeRemove(this.KEY_ARCADE);
    this.safeRemove(this.KEY_FULL);
  },
};

/* =========================================================
   AUDIO SYSTEM (WebAudio, procedural, no external files)
   ========================================================= */
const AudioSystem = {
  ctx: null,
  master: null,
  settings: null,
  init(settings) {
    this.settings = settings;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.volume / 100;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  },
  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  setVolume(v) {
    if (this.master) this.master.gain.value = v / 100;
  },
  tone(freq, dur, type, gainVal, delay) {
    if (!this.ctx || !this.settings.sfx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },
  hug(pitch) {
    const base = 420 + (pitch || 0) * 28;
    this.tone(base, 0.12, "triangle", 0.22, 0);
    this.tone(base * 1.5, 0.14, "sine", 0.14, 0.03);
  },
  danger() {
    this.tone(140, 0.28, "sawtooth", 0.18, 0);
    this.tone(100, 0.32, "square", 0.1, 0.05);
  },
  golden() {
    [660, 880, 1100, 1320].forEach((f, i) =>
      this.tone(f, 0.18, "sine", 0.16, i * 0.05),
    );
  },
  levelup() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone(f, 0.2, "triangle", 0.18, i * 0.06),
    );
  },
  chest() {
    this.tone(300, 0.1, "square", 0.14, 0);
    this.tone(500, 0.14, "square", 0.14, 0.08);
    this.tone(760, 0.18, "square", 0.14, 0.16);
  },
  toolFire() {
    this.tone(220, 0.12, "sine", 0.14, 0);
  },
  click() {
    this.tone(320, 0.05, "square", 0.08, 0);
  },
  teleport() {
    this.tone(900, 0.08, "sine", 0.14, 0);
    this.tone(500, 0.14, "sine", 0.12, 0.06);
    this.tone(1200, 0.1, "sine", 0.1, 0.1);
  },
  milestone() {
    [784, 988, 1175].forEach((f, i) =>
      this.tone(f, 0.16, "triangle", 0.15, i * 0.05),
    );
  },
  evolution() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone(f, 0.26, "triangle", 0.2, i * 0.07),
    );
  },
  slip() {
    this.tone(180, 0.1, "square", 0.12, 0);
    this.tone(120, 0.14, "square", 0.1, 0.05);
  },
  boost() {
    [440, 660, 880].forEach((f, i) =>
      this.tone(f, 0.14, "sine", 0.18, i * 0.04),
    );
  },
  snowThrow() {
    this.tone(700, 0.08, "sine", 0.1, 0);
  },
  snowHit() {
    this.tone(260, 0.16, "triangle", 0.16, 0);
    this.tone(180, 0.2, "sine", 0.1, 0.05);
  },
  bombWarning() {
    this.tone(200, 0.12, "square", 0.1, 0);
  },
  bombCritical() {
    this.tone(300, 0.08, "square", 0.14, 0);
    this.tone(300, 0.08, "square", 0.14, 0.12);
  },
  bombExplode() {
    this.tone(80, 0.4, "sawtooth", 0.26, 0);
    this.tone(60, 0.5, "square", 0.18, 0.06);
  },
};
