"use strict";

/* =========================================================
   SAVE SYSTEM
   ========================================================= */
const SaveSystem = {
  KEY_ARCADE: "bayatHug_arcadeHighScore",
  KEY_FULL: "bayatHug_fullGameBestTime",
  KEY_SETTINGS: "bayatHug_settings",
  KEY_LIFETIME: "bayatHug_lifetimeHugs",
  KEY_MP_PROFILE: "bayatHug_mpProfile",
  KEY_ACHIEVEMENTS: "bayatHug_achievements",
  KEY_RELAY_URL: "bayatHug_relayUrl",
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
  // Co-op multiplayer identity (username + color swatch) — separate from
  // KEY_SETTINGS since it's player identity, not game options, but wrapped
  // in the exact same safe try/catch pattern as everything else here.
  getMpProfile() {
    try {
      const raw = this.safeGet(this.KEY_MP_PROFILE);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.name === "string" && typeof p.color === "string") {
          return p;
        }
      }
    } catch (e) {}
    return null;
  },
  setMpProfile(profile) {
    try {
      this.safeSet(this.KEY_MP_PROFILE, JSON.stringify(profile));
    } catch (e) {}
  },
  // Co-op relay URL, remembered between sessions so a changing tunnel
  // URL doesn't mean editing config.js and redeploying every time.
  // See Game.mpResolveRelayUrl() for the precedence rules.
  getRelayUrl() {
    const v = this.safeGet(this.KEY_RELAY_URL);
    return v && /^wss?:\/\//i.test(v) ? v : null;
  },
  setRelayUrl(url) {
    if (!url) {
      this.safeRemove(this.KEY_RELAY_URL);
      return;
    }
    // Only ever store something that looks like a websocket URL — this
    // can come from a query string, so don't trust it blindly.
    if (/^wss?:\/\//i.test(url)) this.safeSet(this.KEY_RELAY_URL, url.trim());
  },
  // Achievements — persisted as {id: true, ...} rather than an array so
  // "is this unlocked" is an O(1) lookup everywhere it's checked.
  getUnlockedAchievements() {
    try {
      const raw = this.safeGet(this.KEY_ACHIEVEMENTS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  },
  unlockAchievement(id) {
    const set = this.getUnlockedAchievements();
    if (set[id]) return false; // already unlocked — tell the caller so they don't toast twice
    set[id] = true;
    try {
      this.safeSet(this.KEY_ACHIEVEMENTS, JSON.stringify(set));
    } catch (e) {}
    return true;
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
  /* ---- Rare jumpscare ("Mr. Squeeze") ----
     A dedicated sting rather than reusing danger() — this is the loudest,
     nastiest sound in the game on purpose. Procedural like everything
     else here (no audio file needed), BUT if you drop a real file in as
     ASSETS.jumpscareSound it plays that instead — see playJumpscare().
     Built from a downward frequency sweep (the classic "scare" swoop) +
     a burst of detuned sawtooth noise on top. */
  jumpscareTone(golden) {
    if (!this.ctx || !this.settings.sfx) return;
    const t0 = this.ctx.currentTime;
    try {
      // downward swoop
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = golden ? "triangle" : "sawtooth";
      osc.frequency.setValueAtTime(golden ? 900 : 760, t0);
      osc.frequency.exponentialRampToValueAtTime(golden ? 220 : 55, t0 + 0.55);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.32, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.75);
      // detuned dissonant stack — the "screech"
      const partials = golden ? [523, 659, 784] : [180, 191, 233, 246];
      partials.forEach((f, i) => {
        this.tone(f, 0.45, golden ? "sine" : "sawtooth", 0.13, i * 0.015);
      });
      // low body thump
      this.tone(48, 0.6, "square", 0.22, 0.02);
    } catch (e) {
      // Any WebAudio hiccup must never take down the frame that triggered
      // the jumpscare — fall back to the generic danger sting.
      this.danger();
    }
  },
  /* Plays the jumpscare audio: a real audio FILE if one is configured and
     loaded (ASSETS.jumpscareSound), otherwise the procedural sting above.
     Same graceful-degradation philosophy as every sprite in this project —
     a missing/failed audio file is never fatal, you just get the built-in
     sound instead. */
  playJumpscare(golden) {
    if (!this.settings.sfx) return;
    const el = Sounds && Sounds.jumpscare;
    if (el && Sounds.jumpscareLoaded) {
      try {
        el.currentTime = 0;
        el.volume = clamp((this.settings.volume || 70) / 100, 0, 1);
        const p = el.play();
        // play() returns a promise in modern browsers; a rejection (autoplay
        // policy, decode error) should silently fall back, not throw.
        if (p && p.catch) p.catch(() => this.jumpscareTone(golden));
        return;
      } catch (e) {
        /* fall through to procedural */
      }
    }
    this.jumpscareTone(golden);
  },
};
