"use strict";

/* =========================================================
   GAME (main controller)
   ========================================================= */
const Game = {
  canvas: null,
  ctx: null,
  camera: null,
  player: null,
  bayats: null,
  particles: null,
  exp: null,
  upgrades: null,
  tools: null,
  chests: null,
  settings: null,
  state: "menu",
  mode: "arcade",
  elapsed: 0,
  timer: 0,
  hugs: 0,
  combo: 0,
  maxCombo: 0,
  lastHugTime: -99,
  input: { left: false, right: false, up: false, down: false },
  lastFrame: 0,
  floor: null,
  decor: [],
  zones: [],
  delayedEffects: [],
  projectiles: [],
  telegraphs: [],
  ropeLines: [],
  fxZones: [],
  lightningBolts: [],
  tempEffects: [],
  evolvedSet: {},
  obtainedSynergies: {},
  deathFx: [],
  shockwaves: [],
  freezeT: 0,
  enemyProjectiles: [],
  screenFlashT: 0,
  screenFlashMax: 0,
  screenFlashColor: "#fff",
  levelUpQueue: [],
  selectedArenaId: "meadow",
  arena: null,
  // ---- Co-op multiplayer (see CLAUDE.md "Multiplayer" section) ----
  mpProfile: null, // {name, color} for THIS session, loaded from/saved to SaveSystem
  mpInLobby: false,
  coop: false, // true for the whole duration of a networked run — orthogonal to `mode` (coop always uses "full" semantics)
  mpPeers: {}, // peerId -> {name, color, x, y, targetX, targetY, facing, moving, downed, animT, _reviveSent}
  mpNetTimer: 0, // accumulator: local playerState broadcast tick
  mpBayatNetTimer: 0, // accumulator: host-only Bayat snapshot broadcast tick
  mpPendingClaims: {}, // bayatId -> true while awaiting the host's hugResult (non-host only)
  joystick: {
    active: false,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
    touchId: null,
  },

  init() {
    UI.cacheEls();
    this.settings = SaveSystem.getSettings();
    AudioSystem.init(this.settings);
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.contextLost = false;
    // On some Android devices, low memory / low battery causes the browser
    // to reclaim the canvas's GPU-backed context — draw calls then silently
    // stop applying, so the LAST thing that was on screen (sometimes garbled
    // or reused from elsewhere) stays frozen there forever. These listeners
    // let us detect that and recover instead of leaving a corrupted screen.
    this.canvas.addEventListener(
      "contextlost",
      (e) => {
        e.preventDefault();
        this.contextLost = true;
        document.getElementById("context-lost-banner").classList.add("show");
        console.warn(
          "Canvas context lost — pausing rendering until it is restored.",
        );
      },
      false,
    );
    this.canvas.addEventListener(
      "contextrestored",
      () => {
        this.ctx = this.canvas.getContext("2d");
        this.contextLost = false;
        document.getElementById("context-lost-banner").classList.remove("show");
        this.resize();
        console.warn("Canvas context restored — rendering resumed.");
      },
      false,
    );
    this.resize();
    window.addEventListener("resize", () => this.resize());
    // Mobile browsers show/hide their address bar (changing the real
    // viewport size) without always firing a plain window 'resize' event —
    // this desyncs the canvas's pixel backing buffer from its CSS box
    // (which tracks the viewport via 100% width/height) and the browser
    // then stretches the stale, smaller buffer to fill the bigger box,
    // producing a huge blocky/pixelated frame. visualViewport is the
    // reliable signal for that case, so listen to it too.
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => this.resize());
    }
    // If the tab comes back from being backgrounded (common right before a
    // context loss on mobile), force a clean redraw rather than trusting
    // whatever was left in the buffer.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !this.contextLost) this.resize();
    });
    this.bindInput();
    this.bindUI();
    this.applySettingsToUI();
    UI.updateMenuStats();
    UI.showScreen("screen-menu");
    requestAnimationFrame(this.loop.bind(this));
  },
  resize() {
    // Cap resolution harder on touch devices — a huge backing buffer is one
    // of the biggest contributors to the GPU memory pressure that triggers
    // context loss on lower-end phones, and the visual difference above ~1.5x
    // is negligible on a small screen anyway.
    const isTouch =
      "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
    const dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.canvas.style.width = innerWidth + "px";
    this.canvas.style.height = innerHeight + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(innerWidth, innerHeight);
    UI.updateCompactHud();
  },
  bindInput() {
    window.addEventListener("keydown", (e) => {
      AudioSystem.resume();
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") this.input.up = true;
      if (k === "s" || k === "arrowdown") this.input.down = true;
      if (k === "a" || k === "arrowleft") this.input.left = true;
      if (k === "d" || k === "arrowright") this.input.right = true;
      if (k === "escape" || k === "p") {
        if (this.state === "playing") this.pause();
        else if (this.state === "paused") this.resumeGame();
      }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") this.input.up = false;
      if (k === "s" || k === "arrowdown") this.input.down = false;
      if (k === "a" || k === "arrowleft") this.input.left = false;
      if (k === "d" || k === "arrowright") this.input.right = false;
    });
    this.joyEl = document.getElementById("joystick");
    this.joyBase = this.joyEl.querySelector(".joystick-base");
    this.joyKnob = this.joyEl.querySelector(".joystick-knob");
    let touchOrigin = null;
    const JOY_RADIUS = 52;
    const startJoystick = (t) => {
      this.joystick.touchId = t.identifier;
      this.joystick.active = true;
      this.joystick.baseX = t.clientX;
      this.joystick.baseY = t.clientY;
      this.joystick.knobX = t.clientX;
      this.joystick.knobY = t.clientY;
      touchOrigin = { x: t.clientX, y: t.clientY };
      this.joyEl.classList.add("active");
      this.joyBase.style.left = t.clientX + "px";
      this.joyBase.style.top = t.clientY + "px";
      this.joyKnob.style.left = t.clientX + "px";
      this.joyKnob.style.top = t.clientY + "px";
    };
    const moveJoystick = (t) => {
      let dx = t.clientX - touchOrigin.x,
        dy = t.clientY - touchOrigin.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      this.joystick.knobX = touchOrigin.x + dx;
      this.joystick.knobY = touchOrigin.y + dy;
      this.joyKnob.style.left = this.joystick.knobX + "px";
      this.joyKnob.style.top = this.joystick.knobY + "px";
      const dead = 10;
      this.input.left = dx < -dead;
      this.input.right = dx > dead;
      this.input.up = dy < -dead;
      this.input.down = dy > dead;
    };
    const endJoystick = () => {
      this.joystick.touchId = null;
      this.joystick.active = false;
      this.joyEl.classList.remove("active");
      this.input.left =
        this.input.right =
        this.input.up =
        this.input.down =
          false;
    };
    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        AudioSystem.resume();
        if (this.state !== "playing" || !this.settings.touchControls) return;
        if (this.joystick.touchId !== null) return;
        const t = e.changedTouches[0];
        startJoystick(t);
      },
      { passive: true },
    );
    this.canvas.addEventListener(
      "touchmove",
      (e) => {
        if (this.joystick.touchId === null) return;
        for (const t of e.changedTouches) {
          if (t.identifier !== this.joystick.touchId) continue;
          moveJoystick(t);
        }
      },
      { passive: true },
    );
    this.canvas.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystick.touchId) endJoystick();
      }
    });
    this.canvas.addEventListener("touchcancel", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joystick.touchId) endJoystick();
      }
    });
  },
  bindUI() {
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (btn) {
        const action = btn.dataset.action;
        AudioSystem.resume();
        switch (action) {
          case "start-arcade":
            this.startGame("arcade");
            break;
          case "start-full":
            this.startGame("full");
            break;
          case "show-htp":
            UI.showScreen("screen-htp");
            break;
          case "show-settings":
            UI.showScreen("screen-settings");
            break;
          case "back-menu":
            UI.updateMenuStats();
            UI.showScreen("screen-menu");
            break;
          case "reset-scores":
            SaveSystem.resetScores();
            UI.updateMenuStats();
            break;
          case "retry":
            // Co-op has no "restart together" flow (out of scope — see
            // CLAUDE.md "Multiplayer" known gaps) — Play Again after a
            // co-op run just leaves the room and retries solo, rather
            // than silently half-restarting a session other peers still
            // think is live.
            if (this.coop) this.mpEndCoopSession();
            this.startGame(this.mode);
            break;
          case "pause":
            if (this.state === "playing") this.pause();
            break;
          case "resume":
            this.resumeGame();
            break;
          case "quit-to-menu":
            this.quitToMenu();
            break;
          case "show-settings-ingame":
            UI.showScreen("screen-settings");
            break;
          case "show-inventory":
            UI.renderInventory("weapons");
            UI.showScreen("screen-inventory");
            break;
          case "close-inventory":
            UI.showScreen("screen-pause");
            break;
          case "show-arena-select":
            UI.renderArenaSelect();
            UI.showScreen("screen-arena");
            break;
          case "show-coop":
            this.mpEnterFlow();
            break;
          case "mp-save-profile":
            this.mpSaveProfile();
            break;
          case "mp-edit-profile":
            UI.renderMpProfileForm();
            UI.showScreen("screen-mp-profile");
            break;
          case "mp-host":
            this.mpStartHost();
            break;
          case "mp-join":
            this.mpStartJoin();
            break;
          case "mp-copy-code":
            this.mpCopyCode();
            break;
          case "mp-leave":
            this.mpLeaveLobby();
            break;
          case "mp-start":
            this.mpStartRun();
            break;
        }
      }
      const invTab = e.target.closest("[data-invtab]");
      if (invTab) {
        AudioSystem.click();
        UI.renderInventory(invTab.dataset.invtab);
      }
      const arenaCard = e.target.closest("[data-arena-select]");
      if (arenaCard && !arenaCard.classList.contains("locked")) {
        Game.selectedArenaId = arenaCard.dataset.arenaSelect;
        UI.toast(
          "Arena set: " +
            (ARENAS.find((a) => a.id === Game.selectedArenaId) || {}).name,
          1600,
        );
        UI.renderArenaSelect();
      }
      const colorSwatch = e.target.closest("[data-mp-color]");
      if (colorSwatch) {
        AudioSystem.click();
        UI.selectMpColor(colorSwatch.dataset.mpColor);
      }
    });
    const bindToggle = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener("click", () => {
        this.settings[key] = !this.settings[key];
        el.classList.toggle("on", this.settings[key]);
        SaveSystem.setSettings(this.settings);
      });
    };
    bindToggle("set-sfx", "sfx");
    bindToggle("set-shake", "shake");
    bindToggle("set-particles", "reducedParticles");
    bindToggle("set-badges", "badges");
    bindToggle("set-touch", "touchControls");
    document.getElementById("set-volume").addEventListener("input", (e) => {
      this.settings.volume = parseInt(e.target.value, 10);
      AudioSystem.setVolume(this.settings.volume);
      SaveSystem.setSettings(this.settings);
    });
  },
  applySettingsToUI() {
    document.getElementById("set-volume").value = this.settings.volume;
    document
      .getElementById("set-sfx")
      .classList.toggle("on", this.settings.sfx);
    document
      .getElementById("set-shake")
      .classList.toggle("on", this.settings.shake);
    document
      .getElementById("set-particles")
      .classList.toggle("on", this.settings.reducedParticles);
    document
      .getElementById("set-badges")
      .classList.toggle("on", this.settings.badges);
    document
      .getElementById("set-touch")
      .classList.toggle("on", this.settings.touchControls);
  },

  /* =========================================================
     CO-OP MULTIPLAYER (Trystero) — see CLAUDE.md "Multiplayer" section
     for the full protocol writeup. Everything here just drives the UI
     flow and calls into window.Multiplayer (js/multiplayer.js), the ES
     module that actually talks to Trystero. That module is guaranteed to
     be loaded by the time bindUI() can fire (see its own header comment
     for why), but on file:// (or fully offline) the module script itself
     never executes, so `Multiplayer` is undefined — every entry point
     here checks for that first and fails soft with a toast instead of
     throwing, exactly like the rest of the game degrades around missing
     localStorage/canvas-context/etc.
     ========================================================= */
  mpRoomCharset: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // no 0/O/1/I — easier to read aloud
  mpGenerateRoomCode() {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += this.mpRoomCharset[Math.floor(Math.random() * this.mpRoomCharset.length)];
    }
    return code;
  },
  mpAvailable() {
    return typeof Multiplayer !== "undefined";
  },
  mpEnterFlow() {
    if (!this.mpAvailable()) {
      UI.toast(
        "Co-op needs the game running from a web server (http/https) — it won't work opened as a local file.",
        3200,
      );
      return;
    }
    const existing = SaveSystem.getMpProfile();
    if (existing) {
      this.mpProfile = existing;
      UI.showScreen("screen-mp-hostjoin");
    } else {
      UI.renderMpProfileForm();
      UI.showScreen("screen-mp-profile");
    }
  },
  mpSaveProfile() {
    const nameRaw = (UI.els["mp-username-input"].value || "").trim();
    const name = nameRaw.slice(0, 16) || "Player";
    const color = UI._mpSelectedColor || MP_COLORS[0].hex;
    const profile = { name, color };
    SaveSystem.setMpProfile(profile);
    this.mpProfile = profile;
    UI.showScreen("screen-mp-hostjoin");
  },
  // Wires Multiplayer's callbacks to keep the lobby list live, and logs
  // join/leave the way the initial two-tabs smoke test wants. Safe to
  // call multiple times (host/join both call this after connecting).
  mpBindRoomCallbacks() {
    Multiplayer.onPeerJoin = (peerId) => {
      console.log("[Co-op] peer joined:", peerId);
      this.mpRefreshLobby();
    };
    Multiplayer.onPeerLeave = (peerId) => {
      console.log("[Co-op] peer left:", peerId);
      this.mpRefreshLobby();
      if (this.mpInLobby) {
        UI.toast("A player left the lobby.", 1800);
      }
    };
    Multiplayer.onPeerProfile = (peerId, profile) => {
      console.log("[Co-op] peer profile:", peerId, profile);
      this.mpRefreshLobby();
    };
    // ---- gameplay actions (see CLAUDE.md "Multiplayer" protocol table).
    // Registered here (lobby-join time) rather than at run-start so they're
    // ready the instant a "start" broadcast arrives — they're all no-ops
    // until this.coop actually flips true. ----
    Multiplayer.on("start", (data) => this.mpOnStartReceived(data));
    Multiplayer.on("playerState", (data, peerId) =>
      this.mpOnPlayerState(data, peerId),
    );
    Multiplayer.on("bayatSnapshot", (data) => this.mpOnBayatSnapshot(data));
    Multiplayer.on("hugClaim", (data, peerId) =>
      this.mpOnHugClaim(data, peerId),
    );
    Multiplayer.on("hugResult", (data) => this.mpOnHugResult(data));
    Multiplayer.on("downedState", (data, peerId) =>
      this.mpOnDownedState(data, peerId),
    );
    Multiplayer.on("revive", (data, peerId) => this.mpOnRevive(data, peerId));
  },
  mpRefreshLobby() {
    if (!this.mpInLobby || !this.mpProfile) return;
    UI.renderMpPeerList(Multiplayer.peers, this.mpProfile, Multiplayer.isHost);
    UI.els["mp-start-btn"].classList.toggle("hidden", !Multiplayer.isHost);
  },
  async mpStartHost() {
    if (!this.mpProfile) {
      UI.toast("Set a name and color first.", 2000);
      return;
    }
    const code = this.mpGenerateRoomCode();
    try {
      await Multiplayer.host(code, this.mpProfile);
    } catch (e) {
      console.error("[Co-op] host() failed:", e);
      UI.toast(
        "Couldn't start a co-op room — check your internet connection and try again.",
        3200,
      );
      return;
    }
    this.mpBindRoomCallbacks();
    this.mpInLobby = true;
    UI.els["mp-room-code"].textContent = code;
    this.mpRefreshLobby();
    UI.showScreen("screen-mp-lobby");
  },
  async mpStartJoin() {
    if (!this.mpProfile) {
      UI.toast("Set a name and color first.", 2000);
      return;
    }
    const code = (UI.els["mp-join-code-input"].value || "")
      .trim()
      .toUpperCase();
    if (code.length < 4) {
      UI.toast("Enter the room code your friend shared.", 2200);
      return;
    }
    try {
      await Multiplayer.join(code, this.mpProfile);
    } catch (e) {
      console.error("[Co-op] join() failed:", e);
      UI.toast(
        "Couldn't join that room — check the code and your internet connection.",
        3200,
      );
      return;
    }
    this.mpBindRoomCallbacks();
    this.mpInLobby = true;
    UI.els["mp-room-code"].textContent = code;
    this.mpRefreshLobby();
    UI.showScreen("screen-mp-lobby");
  },
  mpCopyCode() {
    const code = (Multiplayer && Multiplayer.roomCode) || "";
    if (!code) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(code)
          .then(() => UI.toast("Room code copied!", 1600))
          .catch(() => UI.toast("Couldn't copy — code is " + code, 2200));
      } else {
        UI.toast("Couldn't copy — code is " + code, 2200);
      }
    } catch (e) {
      UI.toast("Couldn't copy — code is " + code, 2200);
    }
  },
  mpLeaveLobby() {
    try {
      if (this.mpAvailable()) Multiplayer.leave();
    } catch (e) {
      console.warn("[Co-op] error leaving room (ignoring):", e);
    }
    this.mpInLobby = false;
    UI.showScreen("screen-mp-hostjoin");
  },
  // Host clicks "Start Run": broadcasts the chosen arena to everyone,
  // then begins locally. Everyone (host included) launches through the
  // same mpBeginCoopRun() so there's exactly one code path for "how a
  // co-op run actually starts."
  mpStartRun() {
    if (!Multiplayer.isHost) return;
    const arenaId = this.selectedArenaId;
    Multiplayer.send("start", { arenaId });
    this.mpBeginCoopRun(arenaId);
  },
  mpOnStartReceived(data) {
    if (Multiplayer.isHost || !this.mpInLobby) return;
    this.mpBeginCoopRun(data.arenaId);
  },
  mpBeginCoopRun(arenaId) {
    this.mpInLobby = false;
    this.coop = true;
    if (ARENAS.some((a) => a.id === arenaId)) this.selectedArenaId = arenaId;
    this.mpNetTimer = 0;
    this.mpBayatNetTimer = 0;
    this.mpPendingClaims = {};
    // Seed puppets for everyone already in the room from their known
    // profile; position/facing/moving fill in on their first playerState
    // broadcast (well under 100ms away) — CONFIG.arena.width/2, height/2
    // is also exactly where a fresh Player spawns, so this isn't a guess,
    // it's the real shared spawn point.
    this.mpPeers = {};
    for (const id in Multiplayer.peers) {
      const prof = Multiplayer.peers[id];
      this.mpPeers[id] = {
        name: prof.name,
        color: prof.color,
        x: CONFIG.arena.width / 2,
        y: CONFIG.arena.height / 2,
        targetX: null,
        targetY: null,
        facing: 1,
        moving: false,
        downed: false,
        animT: 0,
        _reviveSent: false,
      };
    }
    this.startGame("full");
  },
  // ---- per-frame networking: called from update(dt) only while
  // this.coop is true. Position/Bayat-snapshot broadcast tick rates are
  // deliberately low (10-15/sec-ish) — see CLAUDE.md "Multiplayer"
  // protocol table for why that's plenty for a casual co-op game. ----
  mpUpdateNetworking(dt) {
    this.mpNetTimer -= dt;
    if (this.mpNetTimer <= 0) {
      this.mpNetTimer = 1 / 12;
      Multiplayer.send("playerState", {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        facing: this.player.facing,
        moving: this.player.moving,
      });
    }
    if (Multiplayer.isHost) {
      this.mpBayatNetTimer -= dt;
      if (this.mpBayatNetTimer <= 0) {
        this.mpBayatNetTimer = 1 / 8;
        const list = this.bayats.list
          .filter((n) => n.alive)
          .map((n) => ({
            id: n.id,
            t: n.type.key,
            x: Math.round(n.x),
            y: Math.round(n.y),
          }));
        Multiplayer.send("bayatSnapshot", {
          list,
          difficulty: this.bayats.difficulty(this.elapsed),
        });
      }
    }
    for (const id in this.mpPeers) {
      const p = this.mpPeers[id];
      if (p.targetX == null) continue; // no network sample yet — stay at spawn
      const t = Math.min(1, dt * 10);
      p.x = lerp(p.x, p.targetX, t);
      p.y = lerp(p.y, p.targetY, t);
      p.animT += dt * (p.moving ? 8 : 2.4);
    }
    this.mpUpdateReviveCheck();
  },
  mpOnPlayerState(data, peerId) {
    if (!this.coop) return;
    let p = this.mpPeers[peerId];
    if (!p) {
      const prof = Multiplayer.peers[peerId] || { name: "Player", color: "#888" };
      p = this.mpPeers[peerId] = {
        name: prof.name,
        color: prof.color,
        x: data.x,
        y: data.y,
        targetX: data.x,
        targetY: data.y,
        facing: 1,
        moving: false,
        downed: false,
        animT: 0,
        _reviveSent: false,
      };
    }
    p.targetX = data.x;
    p.targetY = data.y;
    p.facing = data.facing;
    p.moving = data.moving;
  },
  mpOnBayatSnapshot(data) {
    if (!this.coop || Multiplayer.isHost) return;
    this.bayats.applySnapshot(data.list, data.difficulty);
  },
  // Host-only: the arbiter for "who gets this Bayat." Whoever's claim
  // arrives first while it's still alive wins; everyone else's claim for
  // the same id loses (bayat.alive is already false by then).
  mpOnHugClaim(data, peerId) {
    if (!this.coop || !Multiplayer.isHost) return;
    const bayat = this.bayats.list.find((n) => n.id === data.bayatId);
    const valid = !!(bayat && bayat.alive);
    if (valid) {
      bayat.alive = false;
      const idx = this.bayats.list.indexOf(bayat);
      if (idx >= 0) this.bayats.list.splice(idx, 1);
    }
    Multiplayer.send("hugResult", {
      bayatId: data.bayatId,
      winnerId: peerId,
      valid,
    });
  },
  mpOnHugResult(data) {
    if (!this.coop) return;
    if (data.winnerId === Multiplayer.selfId) {
      delete this.mpPendingClaims[data.bayatId];
    }
    if (!data.valid) return;
    const bayat = this.bayats.list.find((n) => n.id === data.bayatId);
    if (!bayat) return; // already pruned locally (e.g. by a later snapshot) — nothing left to show
    const idx = this.bayats.list.indexOf(bayat);
    if (idx >= 0) this.bayats.list.splice(idx, 1);
    if (data.winnerId === Multiplayer.selfId) {
      this.applyHugReward(bayat, false);
    } else {
      this.mpPlayDeathFx(bayat); // someone else's win — cosmetic pop only, no reward
    }
  },
  // Lightweight death particles/pop for a Bayat someone ELSE just hugged —
  // deliberately NOT the full applyHugReward() path (no EXP/time/combo/
  // camera-shake, those are personal to whoever actually won the claim).
  mpPlayDeathFx(bayat) {
    const type = bayat.type;
    const pcolor = type.danger ? "#ff5c72" : type.glow ? "#ffd76a" : type.color;
    this.particles.burst(bayat.x, bayat.y, pcolor, type.glow ? 24 : 12, {
      maxSpeed: type.glow ? 220 : 140,
      minLife: 0.3,
      maxLife: 0.6,
    });
    this.deathFx.push({
      x: bayat.x,
      y: bayat.y,
      radius: bayat.radius,
      tintColor: type.tintColor,
      tintStrength: type.tintStrength,
      danger: type.danger,
      t: 0,
      duration: type.glow ? 0.36 : 0.24,
    });
  },
  // Called from onHug() instead of applyHugReward() directly whenever
  // this.coop is true — see CLAUDE.md "Multiplayer" protocol table.
  mpRequestHug(bayat, isChainHug) {
    if (Multiplayer.isHost) {
      // I AM the authority — resolve immediately, no round trip needed.
      if (!bayat.alive) return;
      bayat.alive = false;
      const idx = this.bayats.list.indexOf(bayat);
      if (idx >= 0) this.bayats.list.splice(idx, 1);
      Multiplayer.send("hugResult", {
        bayatId: bayat.id,
        winnerId: Multiplayer.selfId,
        valid: true,
      });
      this.applyHugReward(bayat, isChainHug);
    } else {
      if (this.mpPendingClaims[bayat.id]) return; // already asked, awaiting hugResult
      this.mpPendingClaims[bayat.id] = true;
      Multiplayer.send("hugClaim", { bayatId: bayat.id });
    }
  },
  // Timer hit 0 in co-op: go down instead of ending the run, as long as
  // someone's still up to revive us. Called from update()'s timer-decay
  // branch in place of endRun() — see there for the non-coop path.
  mpBecomeDowned() {
    if (this.player.downed) return;
    const teammateUp = Object.values(this.mpPeers).some((p) => !p.downed);
    if (!teammateUp) {
      // Solo in this room, or everyone else is already down — no one left
      // to revive us, so this plays out exactly like solo full mode.
      this.endRun();
      return;
    }
    this.player.downed = true;
    this.player.downedFlashT = 0.6;
    this.timer = 0;
    this.camera.shake(6, 0.25);
    UI.toast("You're down! Wait for a teammate with a medkit.", 3000);
    Multiplayer.send("downedState", { downed: true });
    this.mpCheckAllDowned();
  },
  mpCheckAllDowned() {
    if (!this.coop || this.state !== "playing" || !this.player.downed) return;
    const anyoneUp = Object.values(this.mpPeers).some((p) => !p.downed);
    if (!anyoneUp) this.endRun();
  },
  mpOnDownedState(data, peerId) {
    if (!this.coop) return;
    const p = this.mpPeers[peerId];
    if (!p) return;
    p.downed = !!data.downed;
    if (data.downed) {
      p._reviveSent = false; // they can be revived again next time they go down
      UI.toast(p.name + " is down!", 1800);
    } else {
      UI.toast(p.name + " is back up!", 1800);
    }
    this.mpCheckAllDowned();
  },
  // Only ever received by the specific downed peer it was targeted to
  // (see mpUpdateReviveCheck's Multiplayer.send(..., id) below) — no
  // broadcast, so no self-filtering needed here.
  mpOnRevive(data, peerId) {
    if (!this.coop || !this.player.downed) return;
    this.player.downed = false;
    this.player.downedFlashT = 0.6;
    const reviveFraction = 0.4;
    this.timer = clamp(
      this.maxStoredTime * reviveFraction,
      0,
      this.maxStoredTime,
    );
    const byName = (this.mpPeers[peerId] && this.mpPeers[peerId].name) || "A teammate";
    UI.toast(byName + " revived you!", 2200);
    AudioSystem.levelup(); // reuse an existing uplifting cue rather than adding a new sound
    this.particles.burst(this.player.x, this.player.y, "#6fe3a3", 26, {
      maxSpeed: 200,
      minLife: 0.35,
      maxLife: 0.7,
    });
    Multiplayer.send("downedState", { downed: false });
  },
  // Reviver's side: holding a medkit + standing near a downed teammate's
  // (network-interpolated) puppet position revives them automatically —
  // "proximity... automatic on contact" per spec, no separate button.
  mpUpdateReviveCheck() {
    if (this.player.downed || this.player.medkits <= 0) return;
    for (const id in this.mpPeers) {
      const p = this.mpPeers[id];
      if (!p.downed || p._reviveSent) continue;
      if (dist2(this.player.x, this.player.y, p.x, p.y) < 46 * 46) {
        this.player.medkits--;
        p._reviveSent = true;
        Multiplayer.send("revive", {}, id);
        UI.toast("Reviving " + p.name + "...", 1600);
        this.particles.burst(p.x, p.y, "#9adfff", 18, {
          maxSpeed: 160,
          minLife: 0.3,
          maxLife: 0.55,
        });
      }
    }
  },

  startGame(mode) {
    this.mode = mode;
    UI.resetToolTray();
    this.player = new Player();
    this.bayats = new BayatManager();
    this.particles = new ParticleSystem();
    this.exp = new ExperienceSystem();
    this.upgrades = new UpgradeSystem();
    this.tools = new ToolSystem();
    this.chests = new ChestSystem();
    this.arena = ARENAS.find((a) => a.id === this.selectedArenaId) || ARENAS[0];
    this.floor = generateFloorTiles(this.arena);
    this.decor = generateDecor(this.arena);
    this.zones = generateZones(this.arena);
    this.delayedEffects = [];
    this.projectiles = [];
    this.telegraphs = [];
    this.ropeLines = [];
    this.fxZones = [];
    this.lightningBolts = [];
    this.tempEffects = [];
    this.evolvedSet = {};
    this.obtainedSynergies = {};
    this.deathFx = [];
    this.shockwaves = [];
    this.freezeT = 0;
    this.enemyProjectiles = [];
    this.screenFlashT = 0;
    this.levelUpQueue = [];
    this.elapsed = 0;
    this.hugs = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastHugTime = -99;
    this.nextMilestone = 25;
    this.timer =
      mode === "arcade" ? CONFIG.arcade.duration : CONFIG.full.startTime;
    this.maxStoredTime = CONFIG.full.maxTimeStart;
    this.camera.x = this.player.x - this.camera.w / 2;
    this.camera.y = this.player.y - this.camera.h / 2;
    UI.hideAllScreens();
    UI.setHudMode(mode);
    UI.els["hud"].classList.add("active");
    this.state = "playing";
    this.lastFrame = performance.now();
  },
  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    UI.showScreen("screen-pause");
  },
  resumeGame() {
    if (this.state !== "paused") return;
    this.state = "playing";
    UI.hideAllScreens();
    this.lastFrame = performance.now();
    this.resize();
  },
  quitToMenu() {
    this.state = "menu";
    UI.els["hud"].classList.remove("active");
    UI.hideUpgradeModal();
    UI.updateMenuStats();
    UI.showScreen("screen-menu");
    if (this.coop) this.mpEndCoopSession();
  },
  // Leaves the Trystero room and resets every co-op-only flag — the
  // single exit point for "this player is no longer in a co-op run",
  // called on quitting to menu and (via retry's mode check) before
  // starting a fresh solo run. Does NOT get called from endRun() itself —
  // the results screen still needs this.coop/this.mpPeers intact so co-op
  // stats/labels render correctly (see UI.showResults).
  mpEndCoopSession() {
    try {
      if (this.mpAvailable()) Multiplayer.leave();
    } catch (e) {
      console.warn("[Co-op] error leaving room on quit (ignoring):", e);
    }
    this.coop = false;
    this.mpInLobby = false;
    this.mpPeers = {};
    this.mpPendingClaims = {};
  },

  timeRewardFactor() {
    return Math.max(
      CONFIG.full.rewardMinFactor,
      Math.exp(-this.elapsed / CONFIG.full.rewardTau),
    );
  },

  onGoldenEvent() {
    AudioSystem.golden();
    UI.toast("\u2728 GOLDEN BAYAT! GET HIM! \u2728", 2200);
  },

  spawnSnowball(bayat, player) {
    AudioSystem.snowThrow();
    const a = Math.atan2(player.y - bayat.y, player.x - bayat.x);
    this.enemyProjectiles.push({
      x: bayat.x,
      y: bayat.y,
      vx: Math.cos(a) * CONFIG.snowball.projectileSpeed,
      vy: Math.sin(a) * CONFIG.snowball.projectileSpeed,
      life: CONFIG.snowball.projectileLife,
      age: 0,
      radius: 7,
      spin: 0,
    });
  },
  updateEnemyProjectiles(dt) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.age += dt;
      p.spin += dt * 14;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.random() < 0.6)
        this.particles.burst(p.x, p.y, "#bfe9ff", 1, {
          minLife: 0.15,
          maxLife: 0.3,
          minSize: 1,
          maxSize: 2,
          minSpeed: 4,
          maxSpeed: 16,
        });
      let hit = false;
      if (
        this.player &&
        dist(p.x, p.y, this.player.x, this.player.y) <
          p.radius + this.player.radius * 0.8
      ) {
        hit = true;
        AudioSystem.snowHit();
        this.applyTempEffect(
          "snowball",
          "Frozen",
          "snowball",
          CONFIG.snowball.slowDuration,
          (pl) => {
            // Cozy Insulation (snowResistMult) weakens the slow itself
            // rather than shortening the applyTempEffect duration, so the
            // "Frozen" toast/timer still reads honestly.
            pl.snowSlowMult =
              1 - CONFIG.snowball.slowAmount * (1 - (pl.snowResistMult || 0));
          },
          (pl) => {
            pl.snowSlowMult = 1;
          },
        );
        UI.toast(
          "FROZEN  \u2212" +
            Math.round(CONFIG.snowball.slowAmount * 100) +
            "% SPEED",
          1300,
        );
        this.particles.text(
          this.player.x,
          this.player.y - 34,
          "FROZEN!",
          "#bfe9ff",
          15,
        );
        this.particles.burst(p.x, p.y, "#eaf7ff", 16, {
          maxSpeed: 140,
          minLife: 0.25,
          maxLife: 0.5,
        });
        this.camera.shake(4, 0.12);
      }
      if (
        hit ||
        p.age >= p.life ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > CONFIG.arena.width ||
        p.y > CONFIG.arena.height
      ) {
        this.enemyProjectiles.splice(i, 1);
      }
    }
  },

  bombExplode(bayat) {
    if (!bayat.alive) return;
    bayat.alive = false;
    const cfg = CONFIG.bomb;
    AudioSystem.bombExplode();
    this.deathFx.push({
      x: bayat.x,
      y: bayat.y,
      radius: bayat.radius * 1.4,
      tintColor: "#ff3b1a",
      tintStrength: 0.9,
      danger: true,
      t: 0,
      duration: 0.4,
    });
    this.shockwaves.push({
      x: bayat.x,
      y: bayat.y,
      color: "#ff6a3d",
      t: 0,
      duration: 0.45,
      maxR: cfg.explosionRadius,
    });
    this.particles.burst(bayat.x, bayat.y, "#ff8a3d", 44, {
      maxSpeed: 280,
      minLife: 0.35,
      maxLife: 0.7,
    });
    this.particles.burst(bayat.x, bayat.y, "#3a2a2a", 20, {
      maxSpeed: 180,
      minLife: 0.4,
      maxLife: 0.8,
      minSize: 3,
      maxSize: 6,
    });
    this.camera.shake(13, 0.3);
    this.freezeT = 0.08;
    this.triggerFlash("#ff6a3d", 0.18);
    if (
      this.player &&
      dist(this.player.x, this.player.y, bayat.x, bayat.y) <=
        cfg.explosionRadius
    ) {
      const dealt =
        cfg.explosionTimeDamage *
        (this.player.thickSkinMult !== undefined
          ? this.player.thickSkinMult
          : 1);
      this.timer = clamp(this.timer - dealt, 0, this.maxStoredTime);
      this.particles.text(
        this.player.x,
        this.player.y - 40,
        "\u2212" + dealt.toFixed(0) + "s",
        "#ff5c72",
        20,
      );
      this.player.hurtFlashT = 0.4;
      const a = Math.atan2(this.player.y - bayat.y, this.player.x - bayat.x);
      this.player.lungeT = 0.22;
      this.player.lungeVX = Math.cos(a) * cfg.explosionKnockback;
      this.player.lungeVY = Math.sin(a) * cfg.explosionKnockback;
      UI.toast("\uD83D\uDCA5 BOOM!  \u2212" + dealt.toFixed(0) + "s", 1800);
    }
  },

  grantBoost(bayat) {
    const chosen = choice(BOOST_POOL);
    this.applyTempEffect(
      chosen.icon,
      chosen.name,
      chosen.icon,
      CONFIG.boost.duration,
      chosen.apply,
      chosen.revert,
    );
    AudioSystem.boost();
    this.shockwaves.push({
      x: bayat.x,
      y: bayat.y,
      color: "#39ff9a",
      t: 0,
      duration: 0.35,
      maxR: 65,
    });
    this.particles.burst(bayat.x, bayat.y, "#39ff9a", 26, {
      maxSpeed: 220,
      minLife: 0.3,
      maxLife: 0.6,
    });
    UI.toast(
      chosen.name.toUpperCase() +
        "  " +
        chosen.desc +
        "  (" +
        CONFIG.boost.duration +
        "s)",
      2000,
    );
  },

  tryGuardianSave(refillRef) {
    if (this.player.guardianTotal <= (this.player.guardianUsed || 0))
      return false;
    this.player.guardianUsed = (this.player.guardianUsed || 0) + 1;
    this.timer = refillRef * 0.3;
    this.freezeT = 0.16;
    this.shockwaves.push({
      x: this.player.x,
      y: this.player.y,
      color: "#ffd166",
      t: 0,
      duration: 0.6,
      maxR: 150,
    });
    this.shockwaves.push({
      x: this.player.x,
      y: this.player.y,
      color: "#ff7ab8",
      t: 0,
      duration: 0.75,
      maxR: 110,
    });
    this.particles.burst(this.player.x, this.player.y, "#ffd166", 50, {
      maxSpeed: 280,
      minLife: 0.4,
      maxLife: 0.9,
    });
    this.camera.shake(14, 0.35);
    this.triggerFlash("#ffd166", 0.22);
    AudioSystem.evolution();
    UI.toast("\u2728 GUARDIAN HUG! SECOND WIND! \u2728", 2600);
    this.particles.text(
      this.player.x,
      this.player.y - 50,
      "SAVED!",
      "#ffd166",
      22,
    );
    return true;
  },
  triggerFlash(color, duration) {
    this.screenFlashT = duration;
    this.screenFlashMax = duration;
    this.screenFlashColor = color;
  },
  checkMilestones() {
    if (this.hugs >= this.nextMilestone) {
      AudioSystem.milestone();
      UI.toast(this.nextMilestone + " HUGS! KEEP GOING!", 1600);
      this.nextMilestone += 25;
    }
    if (this.combo === 10 || this.combo === 20 || this.combo === 35) {
      AudioSystem.milestone();
      this.triggerFlash("#ff7ab8", 0.16);
      UI.comboBanner("x" + this.combo + " COMBO!");
    }
  },

  // The single choke point every hug source (proximity in checkHugs(),
  // Orbit Buddies/Best Buds in tools.js, the double-hug chain below) goes
  // through. In solo play this always resolves synchronously via
  // applyHugReward(). In co-op it's arbitrated instead — see
  // mpRequestHug() and CLAUDE.md "Multiplayer" section for the claim
  // protocol. Either way, the caller doesn't need to know which path ran.
  onHug(bayat, isChainHug) {
    if (this.coop) {
      this.mpRequestHug(bayat, isChainHug);
      return;
    }
    this.applyHugReward(bayat, isChainHug);
  },
  // Actually grants the reward for a hug that's already been confirmed
  // valid (always true in solo play; only after host arbitration in
  // co-op). Never call this directly for a hug that hasn't been through
  // onHug() — that's what keeps co-op's claim arbitration from being
  // bypassable.
  applyHugReward(bayat, isChainHug) {
    const type = bayat.type;
    bayat.alive = false;
    this.player.triggerHug(bayat.x, bayat.y);
    AudioSystem.hug(this.combo);
    if (type.glow) AudioSystem.golden();
    if (type.danger) AudioSystem.danger();

    if (!isChainHug) {
      const now = this.elapsed;
      // Combo Keeper (comboWindowBonus) extends how long the window stays
      // open before a gap resets the streak — same field used again at
      // the other combo-window check in update().
      if (
        now - this.lastHugTime <=
        CONFIG.combo.window + (this.player.comboWindowBonus || 0)
      ) {
        this.combo++;
      } else {
        this.combo = 1;
      }
      this.lastHugTime = now;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (this.combo > 0 && this.combo % 5 === 0)
        UI.comboBanner("HUG x" + this.combo + "!");
    }

    // Golden Aura (comboAmplifierMult) scales the combo bonus itself
    // (applied AFTER the normal maxBonus clamp, so it genuinely raises
    // the effective ceiling rather than just being absorbed by it).
    const comboBonus =
      Math.min(
        CONFIG.combo.maxBonus,
        (this.combo - 1) * CONFIG.combo.bonusPerLevel,
      ) * (this.player.comboAmplifierMult || 1);
    const isMega =
      !type.danger &&
      !isChainHug &&
      this.player.megaHugChance > 0 &&
      Math.random() < this.player.megaHugChance;
    // Bold Hugs (boldHugsRewardMult) trades hug radius (see Player.hugRadius
    // getter) for a straight reward bump.
    const rewardMult =
      (this.player.warmHugsMult || 1) *
      (this.player.boldHugsRewardMult || 1) *
      (isMega ? 2 : 1);
    if (type.boostType) this.grantBoost(bayat);

    const pcolor = type.danger ? "#ff5c72" : type.glow ? "#ffd76a" : type.color;
    this.particles.burst(bayat.x, bayat.y, pcolor, type.glow ? 36 : 16, {
      maxSpeed: type.glow ? 260 : 170,
      minLife: 0.35,
      maxLife: 0.75,
    });

    // pixel death-pop: a short, stepped (non-smooth) scale+fade of the actual
    // sprite, tinted to the type's color — this is the "sprite dies" animation
    this.deathFx.push({
      x: bayat.x,
      y: bayat.y,
      radius: bayat.radius,
      tintColor: type.tintColor,
      tintStrength: type.tintStrength,
      danger: type.danger,
      t: 0,
      duration: type.glow ? 0.36 : 0.24,
    });

    if (type.danger) {
      this.player.hurtFlashT = 0.4;
      this.camera.shake(8, 0.2);
    } else if (isMega) {
      this.camera.shake(9, 0.2);
      this.freezeT = 0.06;
      this.shockwaves.push({
        x: bayat.x,
        y: bayat.y,
        color: "#ffd166",
        t: 0,
        duration: 0.32,
        maxR: 70,
      });
      UI.comboBanner("MEGA HUG!");
      this.particles.burst(bayat.x, bayat.y, "#ffd166", 24, {
        maxSpeed: 220,
        minLife: 0.3,
        maxLife: 0.6,
      });
    } else {
      this.camera.shake(type.glow ? 10 : 4, 0.18);
    }
    if (type.glow)
      this.shockwaves.push({
        x: bayat.x,
        y: bayat.y,
        color: "#ffd76a",
        t: 0,
        duration: 0.4,
        maxR: 90,
      });

    // Bear Hug: small AoE stun ripple on nearby Bayats when you hug one
    if (this.player.bearHugLevel > 0) {
      const splash = this.bayats.inRadius(
        bayat.x,
        bayat.y,
        60 + this.player.bearHugLevel * 14,
      );
      for (const s of splash) {
        if (s !== bayat && !s.type.danger) s.slowT = Math.max(s.slowT, 0.5);
      }
    }

    if (!type.danger) this.hugs++;

    if (type.medkitType) {
      // Co-op only (see pickType()'s filter — these never spawn solo).
      // No EXP/time, just the consumable used to revive a downed
      // teammate — see mpUpdateReviveCheck().
      this.player.medkits++;
      this.particles.text(bayat.x, bayat.y - 26, "MEDKIT!", "#9adfff", 18);
      this.particles.text(
        bayat.x,
        bayat.y - 8,
        "+1 medkit (" + this.player.medkits + ")",
        "#7fe0ff",
        13,
      );
      AudioSystem.chest();
    } else if (this.mode === "arcade") {
      const expGain =
        6 *
        type.expMult *
        (1 + comboBonus) *
        this.player.totalExpMult *
        rewardMult;
      this.particles.text(
        bayat.x,
        bayat.y - 26,
        type.danger ? "OUCH!" : isMega ? "MEGA HUG!" : "HUG!",
        type.danger ? "#ff5c72" : isMega ? "#ffd166" : "#fff",
        isMega ? 22 : 18,
      );
      if (!type.danger) {
        this.particles.text(
          bayat.x,
          bayat.y - 8,
          "+" + Math.round(expGain) + " EXP",
          "#a970ff",
          13,
        );
        const lv = this.exp.add(expGain);
        if (lv.length) this.applyAutoLevel(lv.length);
      }
    } else {
      let timeDelta;
      if (type.danger) {
        timeDelta =
          -3.2 *
          (this.player.thickSkinMult !== undefined
            ? this.player.thickSkinMult
            : 1);
      } else {
        const factor = this.timeRewardFactor();
        timeDelta =
          CONFIG.full.baseTimeReward *
          type.rewardMult *
          factor *
          (1 + comboBonus) *
          rewardMult;
      }
      this.timer = clamp(this.timer + timeDelta, 0, this.maxStoredTime);
      this.particles.text(
        bayat.x,
        bayat.y - 26,
        type.danger ? "OUCH!" : isMega ? "MEGA HUG!" : "HUG!",
        type.danger ? "#ff5c72" : isMega ? "#ffd166" : "#fff",
        isMega ? 22 : 18,
      );
      this.particles.text(
        bayat.x,
        bayat.y - 8,
        (timeDelta >= 0 ? "+" : "") + timeDelta.toFixed(2) + "s",
        timeDelta >= 0 ? "#6fe3a3" : "#ff5c72",
        13,
      );
      if (!type.danger) {
        const expGain =
          6 *
          type.expMult *
          (1 + comboBonus) *
          this.player.totalExpMult *
          rewardMult;
        const lv = this.exp.add(expGain);
        if (lv.length) this.queueLevelUps(lv.length);
      }
    }

    if (!type.danger) this.checkMilestones();

    // Double Hug: chance to also catch a second nearby Bayat
    if (
      !isChainHug &&
      !type.danger &&
      this.player.doubleHugChance > 0 &&
      Math.random() < this.player.doubleHugChance
    ) {
      const second = this.bayats.nearest(
        bayat.x,
        bayat.y,
        (n) =>
          n !== bayat &&
          n.alive &&
          !n.type.danger &&
          dist(bayat.x, bayat.y, n.x, n.y) < this.player.hugRadius * 2.2,
      );
      if (second) {
        this.onHug(second, true);
      }
    }
  },

  applyAutoLevel(times) {
    for (let i = 0; i < times; i++) {
      const boosts = ["speed", "hug", "exp", "luck"];
      const pick = choice(boosts);
      if (pick === "speed") this.player.speedMult += 0.05;
      else if (pick === "hug") this.player.hugRadiusMult += 0.06;
      else if (pick === "exp") this.player.expMult += 0.08;
      else this.player.luckMult += 0.08;
      AudioSystem.levelup();
      this.particles.text(
        this.player.x,
        this.player.y - 40,
        "LEVEL UP!",
        "#ffd76a",
        20,
      );
      this.camera.shake(5, 0.15);
    }
  },

  queueLevelUps(times) {
    for (let i = 0; i < times; i++) this.levelUpQueue.push(true);
    if (this.state === "playing") this.processLevelUpQueue();
  },
  processLevelUpQueue() {
    if (this.levelUpQueue.length === 0) return;
    this.levelUpQueue.shift();
    this.state = "levelup";
    AudioSystem.levelup();
    this.shockwaves.push({
      x: this.player.x,
      y: this.player.y,
      color: "#a970ff",
      t: 0,
      duration: 0.35,
      maxR: 80,
    });
    this.particles.burst(this.player.x, this.player.y, "#ffd76a", 22, {
      maxSpeed: 200,
      minLife: 0.35,
      maxLife: 0.65,
    });
    const choices = this.upgrades.rollChoices(3, true);
    if (choices.length === 0) {
      this.state = "playing";
      return;
    }
    UI.showUpgradeModal("LEVEL UP!", "Choose an upgrade", choices, (def) => {
      const lvl = this.upgrades.apply(def, this.player);
      UI.hideUpgradeModal();
      this.particles.text(
        this.player.x,
        this.player.y - 40,
        def.name + " Lv" + lvl,
        "#ffd76a",
        16,
      );
      this.checkEvolutions();
      if (this.levelUpQueue.length > 0) {
        this.processLevelUpQueue();
      } else {
        this.state = "playing";
        this.lastFrame = performance.now();
        // The tap that closes this modal can trigger a mobile browser's
        // address bar to hide, changing the viewport without a 'resize'
        // event — resync the canvas backing buffer just in case.
        this.resize();
      }
    });
  },

  grantFlatReward(chest, expGain, timeBonus) {
    if (this.mode === "arcade") {
      this.exp.add(expGain);
      this.particles.text(
        chest.x,
        chest.y - 20,
        "+" + Math.round(expGain) + " EXP",
        "#a970ff",
        15,
      );
    } else {
      this.timer = clamp(this.timer + timeBonus, 0, this.maxStoredTime);
      const lv = this.exp.add(expGain);
      this.particles.text(
        chest.x,
        chest.y - 20,
        "+" + timeBonus.toFixed(1) + "s",
        "#6fe3a3",
        15,
      );
      if (lv.length) this.queueLevelUps(lv.length);
    }
  },
  applyCurse() {
    const curse = choice(CURSES);
    curse.apply(this.player);
    this.tempEffects.push({
      id: curse.id,
      name: curse.name,
      icon: curse.icon,
      remaining: curse.duration,
      duration: curse.duration,
      revert: curse.revert,
    });
    UI.toast("\u26A0 CURSED: " + curse.name + " \u26A0", 2200);
  },
  /* Adds a timed player effect. If one with the same id is already active,
     its duration is simply refreshed (apply() is NOT re-run) so effects
     like the snowball slow can't stack into an ever-growing multiplier —
     they just keep their current strength and reset the clock. */
  applyTempEffect(id, name, iconKeyOrEmoji, duration, applyFn, revertFn) {
    const existing = this.tempEffects.find((e) => e.id === id);
    if (existing) {
      existing.remaining = duration;
      return;
    }
    if (applyFn) applyFn(this.player);
    this.tempEffects.push({
      id,
      name,
      icon: iconKeyOrEmoji,
      remaining: duration,
      duration,
      revert: revertFn,
    });
  },
  onChestOpened(chest) {
    const kindDef = CHEST_KINDS[chest.kind] || CHEST_KINDS.normal;
    let picks = kindDef.picks || 1;
    const grants = []; // {name, lvl|null, isSynergy}

    // A synergy is granted at most once per run, and consumes one of the
    // chest's picks — the rest of the picks (if any) still land as normal
    // random upgrades. See SYNERGIES below for how combos are defined.
    const synergy = SYNERGIES.find(
      (s) =>
        !this.obtainedSynergies[s.id] &&
        s.parts.every((id) => this.upgrades.levelOf(id) > 0),
    );
    if (synergy && picks > 0) {
      this.grantSynergy(synergy);
      grants.push(synergy.name + " (NEW!)");
      picks--;
    }

    for (let i = 0; i < picks; i++) {
      const pool = STAT_UPGRADES.concat(TOOL_DEFS).filter(
        (d) => !this.upgrades.isMaxed(d),
      );
      if (!pool.length) break;
      const pick = choice(pool);
      const lvl = this.upgrades.apply(pick, this.player);
      grants.push(pick.name + " Lv" + lvl);
      this.particles.text(
        this.player.x,
        this.player.y - 40 - i * 16,
        pick.name + " Lv" + lvl,
        kindDef.glow || "#a970ff",
        15,
      );
      this.checkEvolutions();
    }

    // A small guaranteed bonus scales with tier so chests stay worth opening
    // even on an unlucky roll, without being the headline reward.
    const bonusScale = kindDef.picks || 1;
    const expGain = (6 + bonusScale * 4) * this.player.totalExpMult;
    const timeBonus = 0.9 * bonusScale;
    this.grantFlatReward(chest, expGain, timeBonus);

    if (grants.length) {
      const label =
        chest.kind === "legendary"
          ? "\u2726 LEGENDARY CHEST! \u2726"
          : chest.kind === "rare"
            ? "\u2726 RARE CHEST! \u2726"
            : "CHEST OPENED";
      UI.toast(
        label + "  " + grants.join(", "),
        chest.kind === "normal" ? 1600 : 2400,
      );
    }
  },
  grantSynergy(synergy) {
    this.obtainedSynergies[synergy.id] = true;
    const def = synergy.resultTool;
    this.tools.equip(def, 1);
    this.upgrades.levels[def.id] = 1; // marks it "owned" so it can never appear in a normal upgrade pool
    if (def.onGrant) def.onGrant(this.player);
    AudioSystem.evolution();
    this.freezeT = 0.16;
    this.triggerFlash("#a970ff", 0.22);
    this.shockwaves.push({
      x: this.player.x,
      y: this.player.y,
      color: "#a970ff",
      t: 0,
      duration: 0.55,
      maxR: 130,
    });
    this.shockwaves.push({
      x: this.player.x,
      y: this.player.y,
      color: "#ffd76a",
      t: 0,
      duration: 0.4,
      maxR: 90,
    });
    this.particles.burst(this.player.x, this.player.y, "#a970ff", 44, {
      maxSpeed: 260,
      minLife: 0.4,
      maxLife: 0.85,
    });
    this.camera.shake(11, 0.3);
    UI.toast("\u2666 SYNERGY: " + synergy.name.toUpperCase() + " \u2666", 3200);
    this.particles.text(
      this.player.x,
      this.player.y - 56,
      synergy.name + "!",
      "#a970ff",
      19,
    );
  },

  checkHugs() {
    if (this.player.downed) return; // can't hug while down — see mpBecomeDowned()
    const hr = this.player.hugRadius;
    for (const n of this.bayats.list) {
      if (!n.alive) continue;
      const rr = hr + n.radius * 0.6;
      if (dist2(this.player.x, this.player.y, n.x, n.y) <= rr * rr) {
        this.onHug(n, false);
      }
    }
  },

  applyStickyArms(dt) {
    if (this.player.stickyArmsLevel <= 0) return;
    const range = this.player.hugRadius * 1.5;
    for (const n of this.bayats.list) {
      if (!n.alive || n.type.danger) continue;
      if (dist2(this.player.x, this.player.y, n.x, n.y) < range * range) {
        n.slowT = Math.max(n.slowT, 0.12 * this.player.stickyArmsLevel);
      }
    }
  },
  applyTimePocket(dt) {
    if (this.player.timePocketLevel <= 0) return;
    this.player.timePocketTimer -= dt;
    if (this.player.timePocketTimer <= 0) {
      const lvl = this.player.timePocketLevel;
      this.player.timePocketTimer = Math.max(6, 16 - lvl * 2);
      if (this.mode === "arcade") {
        const gain = 10 * lvl;
        this.exp.add(gain);
        this.particles.text(
          this.player.x,
          this.player.y - 46,
          "TIME POCKET +" + gain + " EXP",
          "#ffd76a",
          14,
        );
      } else {
        const bonus = 1.4 + lvl * 0.35;
        this.timer = clamp(this.timer + bonus, 0, this.maxStoredTime);
        this.particles.text(
          this.player.x,
          this.player.y - 46,
          "TIME POCKET +" + bonus.toFixed(1) + "s",
          "#6fe3a3",
          14,
        );
      }
      AudioSystem.chest();
    }
  },
  // Warm Cocoa (timeRegenPerSec) — simple continuous regen, Full mode
  // only (Arcade's timer is a shared countdown clock, not health, so
  // regenerating it wouldn't mean anything). No particle text every
  // frame — that would spam the screen — the EXP bar / timer readout
  // updating is feedback enough, same as it is for e.g. Adrenaline.
  applyTimeRegen(dt) {
    if (!this.player.timeRegenPerSec || this.mode !== "full") return;
    this.timer = clamp(
      this.timer + this.player.timeRegenPerSec * dt,
      0,
      this.maxStoredTime,
    );
  },

  updateFxZones(dt) {
    for (let i = this.fxZones.length - 1; i >= 0; i--) {
      const z = this.fxZones[i];
      z.t -= dt;
      if (z.t <= 0) {
        this.fxZones.splice(i, 1);
        continue;
      }
      if (z.slow) {
        const targets = this.bayats.inRadius(z.x, z.y, z.r);
        for (const n of targets) {
          n.slowT = Math.max(n.slowT, 0.25);
        }
      }
    }
  },
  updateDeathFx(dt) {
    for (let i = this.deathFx.length - 1; i >= 0; i--) {
      const fx = this.deathFx[i];
      fx.t += dt;
      if (fx.t >= fx.duration) this.deathFx.splice(i, 1);
    }
  },
  updateShockwaves(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.t += dt;
      if (s.t >= s.duration) this.shockwaves.splice(i, 1);
    }
  },
  updateTempEffects(dt) {
    for (let i = this.tempEffects.length - 1; i >= 0; i--) {
      const e = this.tempEffects[i];
      e.remaining -= dt;
      if (e.remaining <= 0) {
        if (e.revert) e.revert(this.player);
        UI.toast(e.name + " wore off", 1400);
        this.tempEffects.splice(i, 1);
      }
    }
  },
  checkEvolutions() {
    for (const evo of EVOLUTIONS) {
      if (this.evolvedSet[evo.id]) continue;
      const met = evo.parts.every(
        (p) => this.upgrades.levelOf(p.id) >= p.minLevel,
      );
      if (met) {
        this.evolvedSet[evo.id] = true;
        AudioSystem.evolution();
        UI.toast(
          "\u2666 EVOLUTION: " + evo.name.toUpperCase() + " \u2666",
          3000,
        );
        this.particles.text(
          this.player.x,
          this.player.y - 56,
          evo.name + "!",
          "#ffd76a",
          18,
        );
        this.camera.shake(9, 0.3);
        this.freezeT = 0.14;
        this.shockwaves.push({
          x: this.player.x,
          y: this.player.y,
          color: "#ffd76a",
          t: 0,
          duration: 0.5,
          maxR: 130,
        });
        this.shockwaves.push({
          x: this.player.x,
          y: this.player.y,
          color: "#a970ff",
          t: 0,
          duration: 0.62,
          maxR: 100,
        });
        this.particles.burst(this.player.x, this.player.y, "#ffd76a", 40, {
          maxSpeed: 260,
          minLife: 0.4,
          maxLife: 0.8,
        });
      }
    }
  },

  endRun() {
    this.state = "gameover";
    UI.els["hud"].classList.remove("active");
    SaveSystem.addLifetimeHugs(this.hugs);
    let isRecord = false;
    const arenaId = this.arena ? this.arena.id : "meadow";
    if (this.mode === "arcade") {
      if (this.hugs > SaveSystem.getArcadeBest(arenaId)) {
        SaveSystem.setArcadeBest(this.hugs, arenaId);
        isRecord = true;
      }
      UI.showResults(
        "arcade",
        { hugs: this.hugs, maxCombo: this.maxCombo, level: this.exp.level },
        isRecord,
      );
    } else {
      if (this.elapsed > SaveSystem.getFullBest(arenaId)) {
        SaveSystem.setFullBest(this.elapsed, arenaId);
        isRecord = true;
      }
      UI.showResults(
        "full",
        {
          survived: this.elapsed,
          hugs: this.hugs,
          maxCombo: this.maxCombo,
          level: this.exp.level,
        },
        isRecord,
      );
    }
  },

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.state !== "playing") {
      return;
    }

    // Brief freeze-frame ("hitstop") for big moments — gameplay pauses for an
    // instant while fx/particles keep animating, then resumes automatically.
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      this.particles.update(dt);
      this.updateDeathFx(dt);
      this.updateShockwaves(dt);
      this.updateEnemyProjectiles(dt);
      if (this.screenFlashT > 0) this.screenFlashT -= dt;
      return;
    }

    this.elapsed += dt;

    if (this.mode === "arcade") {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (!this.tryGuardianSave(CONFIG.arcade.duration)) {
          this.timer = 0;
          this.endRun();
          return;
        }
      }
    } else {
      this.maxStoredTime =
        Math.max(
          CONFIG.full.maxTimeFloor,
          CONFIG.full.maxTimeStart -
            this.elapsed * CONFIG.full.maxTimeDecayPerSec,
        ) + (this.player.secondWindBonus || 0);
      // While downed the timer just sits at 0 — don't re-run the decay/
      // zero check every frame, that would call mpBecomeDowned() (a no-op
      // once already downed, but wasteful) or worse, tryGuardianSave()
      // again on every single frame.
      if (!this.player.downed) {
        this.timer = Math.min(this.timer, this.maxStoredTime);
        this.timer -= dt;
        if (this.timer <= 0) {
          if (!this.tryGuardianSave(this.maxStoredTime)) {
            this.timer = 0;
            if (this.coop) {
              this.mpBecomeDowned();
            } else {
              this.endRun();
            }
            // Either path is a valid stopping point for this frame — mirror
            // the single-player early-return rather than continuing to
            // simulate a frame the run/player state no longer expects.
            return;
          }
        }
      }
    }

    this.player.update(dt, this.input);
    this.camera.follow(this.player.x, this.player.y, dt);
    if (this.coop && !Multiplayer.isHost) {
      // Non-host: Bayats are host-authoritative — just lerp toward the
      // latest snapshot rather than running independent AI/spawning, so
      // two players can never end up disagreeing about the same Bayat.
      this.bayats.updateAsPuppets(dt);
    } else {
      this.bayats.update(
        dt,
        this.elapsed,
        this.player,
        this.player.blackHoleLevel,
        this.coop ? Object.values(this.mpPeers) : null,
      );
    }
    if (this.coop) this.mpUpdateNetworking(dt);
    if (this.mode === "full") this.tools.update(dt, this.player, this.bayats);
    this.chests.update(
      dt,
      this.elapsed,
      this.player,
      this.player.totalLuck * this.player.chestLuckMult,
    );
    this.particles.update(dt);
    this.applyStickyArms(dt);
    if (this.mode === "full") this.applyTimePocket(dt);
    if (this.mode === "full") this.applyTimeRegen(dt);
    this.updateFxZones(dt);
    this.updateTempEffects(dt);
    this.checkHugs();
    if (
      this.combo > 0 &&
      this.elapsed - this.lastHugTime >
        CONFIG.combo.window + (this.player.comboWindowBonus || 0)
    )
      this.combo = 0;

    for (let i = this.delayedEffects.length - 1; i >= 0; i--) {
      const e = this.delayedEffects[i];
      e.t -= dt;
      if (e.t <= 0) {
        e.fn();
        this.delayedEffects.splice(i, 1);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      if (p.t >= p.dur) this.projectiles.splice(i, 1);
    }
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      tg.t -= dt;
      if (tg.t <= 0) this.telegraphs.splice(i, 1);
    }
    for (let i = this.ropeLines.length - 1; i >= 0; i--) {
      const rl = this.ropeLines[i];
      rl.t += dt;
      if (rl.t >= rl.dur) this.ropeLines.splice(i, 1);
    }
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const lb = this.lightningBolts[i];
      lb.t += dt;
      if (lb.t >= lb.dur) this.lightningBolts.splice(i, 1);
    }
    this.updateDeathFx(dt);
    this.updateShockwaves(dt);
    this.updateEnemyProjectiles(dt);
    if (this.screenFlashT > 0) this.screenFlashT -= dt;

    UI.updateHud({
      timer: this.timer,
      hugs: this.hugs,
      combo: Math.max(1, this.combo),
      level: this.exp.level,
      expProgress: this.exp.progress,
      mode: this.mode,
    });
    if (this.mode === "full") UI.renderTools(this.tools);
  },

  drawWorld() {
    const ctx = this.ctx,
      cam = this.camera;
    // Clear the FULL physical backing buffer, not just the cam.w x cam.h
    // region the dpr transform currently maps to. If cam.w/cam.h ever fall
    // out of sync with the canvas's actual pixel size (a missed resize
    // event on mobile — see resize() notes), clearing only the tracked
    // region leaves a strip of old pixels untouched every frame; anything
    // drawn there with alpha blending (zone tints, particles, ...) then
    // keeps stacking on top of itself forever instead of being wiped,
    // which is what turns a subtle effect into a solid garbled patch.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = (this.arena && this.arena.bg) || "#120e1c";
    ctx.fillRect(0, 0, cam.w, cam.h);
    cam.applyShake(ctx, 1 / 60);

    // pixel-art floor — the ground beneath everything else, per arena
    drawFloor(ctx, cam, this.floor, this.arena);

    drawZones(ctx, cam, this.zones);

    const gridSize = 90;
    const offX = -cam.x % gridSize,
      offY = -cam.y % gridSize;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offX; x < cam.w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cam.h);
    }
    for (let y = offY; y < cam.h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(cam.w, y);
    }
    ctx.stroke();

    drawDecor(ctx, cam, this.decor);

    const bx = -cam.x,
      by = -cam.y;
    ctx.strokeStyle = "rgba(245,185,66,0.4)";
    ctx.lineWidth = 6;
    ctx.strokeRect(bx, by, CONFIG.arena.width, CONFIG.arena.height);

    // lingering fx zones (glitter cloud / confetti burn zones)
    for (const z of this.fxZones) {
      const sx = z.x - cam.x,
        sy = z.y - cam.y;
      const a = clamp(z.t / z.maxT, 0, 1);
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = z.color;
      ctx.beginPath();
      ctx.arc(sx, sy, z.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, z.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // telegraphs (tool area-of-effect rings) — expands in discrete pixel steps
    for (const tg of this.telegraphs) {
      const sx = tg.x - cam.x,
        sy = tg.y - cam.y;
      const a = tg.t / tg.maxT;
      const stepFrac = quantize(1 - a, 5);
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = tg.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, tg.r * (0.7 + 0.3 * stepFrac), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // rope lines (grappling hook / rope visuals) — extends toward the target
    // in quantized steps, then holds and fades, instead of snapping full-length.
    for (const rl of this.ropeLines) {
      const growFrac = quantize(Math.min(1, rl.t / (rl.dur * 0.45)), 5);
      const a = 1 - rl.t / rl.dur;
      const ex = lerp(rl.x1, rl.x2, growFrac),
        ey = lerp(rl.y1, rl.y2, growFrac);
      const x1 = rl.x1 - cam.x,
        y1 = rl.y1 - cam.y,
        x2 = ex - cam.x,
        y2 = ey - cam.y;
      ctx.globalAlpha = a;
      ctx.strokeStyle = rl.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      // hook tip while still extending
      if (growFrac < 1) {
        ctx.fillStyle = rl.color;
        ctx.save();
        ctx.translate(x2, y2);
        ctx.rotate(rl.t * 18);
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      } else if (!rl.impactFired) {
        rl.impactFired = true;
        Game.particles.burst(rl.x2, rl.y2, rl.color, 8, {
          maxSpeed: 110,
          minLife: 0.2,
          maxLife: 0.35,
        });
      }
      ctx.globalAlpha = 1;
    }
    // lightning bolts (static cling) — a bright over-saturated flash frame first, then fades
    for (const lb of this.lightningBolts) {
      const frac = lb.t / lb.dur;
      const a = 1 - frac;
      const x1 = lb.x1 - cam.x,
        y1 = lb.y1 - cam.y,
        x2 = lb.x2 - cam.x,
        y2 = lb.y2 - cam.y;
      ctx.globalAlpha = a;
      ctx.strokeStyle = frac < 0.35 ? "#ffffff" : "#fff2a3";
      ctx.lineWidth = frac < 0.35 ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const steps = 4;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        ctx.lineTo(
          lerp(x1, x2, t) + rand(-8, 8),
          lerp(y1, y2, t) + rand(-8, 8),
        );
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // projectiles (boomerang / lob / homing missile)
    for (const p of this.projectiles) {
      const frac = clamp(p.t / p.dur, 0, 1);
      if (p.kind === "boomerang") {
        const dist_ = Math.sin(frac * Math.PI) * p.range;
        const wx = this.player.x + Math.cos(p.angle) * dist_;
        const wy = this.player.y + Math.sin(p.angle) * dist_;
        const sx = wx - cam.x,
          sy = wy - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(frac * Math.PI * 4);
        ctx.fillStyle = "#f5b942";
        ctx.strokeStyle = "rgba(0,0,0,.4)";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillRect(-2, -8, 4, 16);
        ctx.strokeRect(-8, -2, 16, 4);
        ctx.strokeRect(-2, -8, 4, 16);
        ctx.restore();
      } else if (p.kind === "lob") {
        const arc = Math.sin(frac * Math.PI) * 70;
        const wx = lerp(p.x1, p.x2, frac),
          wy = lerp(p.y1, p.y2, frac) - arc;
        const sx = wx - cam.x,
          sy = wy - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(frac * Math.PI * 6);
        ctx.fillStyle = "#ff9dc9";
        ctx.strokeStyle = "rgba(0,0,0,.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === "missile") {
        const target = this.bayats.list.find(
          (n) => n.id === p.targetId && n.alive,
        );
        const tx = target ? target.x : p.x,
          ty = target ? target.y : p.y;
        const wx = lerp(p.x, tx, frac),
          wy = lerp(p.y, ty, frac);
        const sx = wx - cam.x,
          sy = wy - cam.y;
        const ang = Math.atan2(ty - p.y, tx - p.x);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = "#ff7ab8";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("\u2764", 0, 5);
        ctx.restore();
      }
    }

    // enemy projectiles (Snowball Bayat throws)
    for (const p of this.enemyProjectiles) {
      const sx = p.x - cam.x,
        sy = p.y - cam.y;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.spin);
      ctx.fillStyle = "#eaf7ff";
      ctx.strokeStyle = "rgba(60,120,160,.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath();
      ctx.arc(-2, -2, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (this.chests) this.chests.draw(ctx, cam);
    if (this.bayats) this.bayats.draw(ctx, cam);

    // pixel death-pop: 3 discrete stepped frames of the tinted sprite scaling+fading out
    for (const fx of this.deathFx) {
      const frac = fx.t / fx.duration;
      const frames = [
        { scale: 1.0, alpha: 1.0 },
        { scale: 1.35, alpha: 0.6 },
        { scale: 1.7, alpha: 0.22 },
      ];
      const idx = Math.min(2, Math.floor(frac * 3));
      const fr = frames[idx];
      const sx = fx.x - cam.x,
        sy = fx.y - cam.y;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = fr.alpha;
      if (Sprites.bayatLoaded) {
        const size = fx.radius * 2.9 * fr.scale;
        ctx.imageSmoothingEnabled = false;
        const sprite = fx.danger
          ? SpriteTint.getTinted("bayat", "#ff2d4d", 0.85)
          : SpriteTint.getTinted("bayat", fx.tintColor, fx.tintStrength);
        ctx.drawImage(
          sprite || Sprites.bayat,
          -size / 2,
          -size / 2,
          size,
          size,
        );
      } else {
        ctx.fillStyle = fx.danger ? "#ff5c72" : "#cdd6f4";
        ctx.beginPath();
        ctx.arc(0, 0, fx.radius * fr.scale, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // blocky pixel shockwave rings (mega hug / golden hug) — quantized steps, not a smooth circle
    for (const s of this.shockwaves) {
      const frac = quantize(s.t / s.duration, 5);
      const r = 8 + frac * s.maxR;
      const a = 1 - s.t / s.duration;
      const sx = s.x - cam.x,
        sy = s.y - cam.y;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      const sides = 8,
        pts = [];
      for (let i = 0; i < sides; i++) {
        const ang = (TAU / sides) * i;
        pts.push([
          Math.round(Math.cos(ang) * r),
          Math.round(Math.sin(ang) * r),
        ]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (this.coop) {
      for (const id in this.mpPeers) drawRemotePlayer(ctx, cam, this.mpPeers[id]);
    }
    if (this.player) this.player.draw(ctx, cam);
    if (this.tools) {
      for (const id in this.tools.active) {
        const t = this.tools.active[id];
        if (t.def.kind === "orbit" && t.positions) {
          const isBestBuds = t.def.id === "bestbuds";
          const glowColor = isBestBuds ? "#ff7ab8" : "#ffd76a";
          t.positions.forEach((pos, idx) => {
            const bobPhase = performance.now() / 260 + idx * 1.9;
            const bob = quantize((Math.sin(bobPhase) + 1) / 2, 4) * 5 - 2.5;
            const pulse = t.hitPulse && t.hitPulse[idx] > 0 ? 1.5 : 1;
            const sx = pos.x - cam.x,
              sy = pos.y - cam.y + bob;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(Math.sin(bobPhase * 0.7) * 0.22);
            ctx.scale(pulse, pulse);
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = pulse > 1 ? 16 : 9;
            if (Sprites.buddyLoaded) {
              // pixel-art companion sprite — tinted pink for the Best Buds synergy
              // so the two orbit tools read as visually distinct, not just recolored dots
              const sprite = isBestBuds
                ? SpriteTint.getTinted("buddy", "#ff5fa8", 0.5) || Sprites.buddy
                : Sprites.buddy;
              ctx.imageSmoothingEnabled = false;
              const size = 22;
              ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
            } else {
              // procedural fallback if buddy.png fails to load — still pixel-art, never an emoji
              ctx.fillStyle = glowColor;
              ctx.beginPath();
              ctx.arc(0, 0, 8, 0, TAU);
              ctx.fill();
              ctx.fillStyle = "#1c1430";
              ctx.beginPath();
              ctx.arc(-2.5, -1, 1.3, 0, TAU);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(2.5, -1, 1.3, 0, TAU);
              ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.restore();
          });
        }
      }
    }
    if (this.player) {
      const sx = this.player.x - cam.x,
        sy = this.player.y - cam.y;
      ctx.beginPath();
      ctx.arc(sx, sy, this.player.hugRadius, 0, TAU);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (this.particles) this.particles.draw(ctx, cam);
    ctx.restore();

    // full-screen flash for big moments (combo milestones, explosions, saves) —
    // drawn after restore() so it sits in plain screen space, unaffected by shake
    if (this.screenFlashT > 0) {
      const a = clamp(this.screenFlashT / this.screenFlashMax, 0, 1) * 0.35;
      ctx.fillStyle = this.screenFlashColor;
      ctx.globalAlpha = a;
      ctx.fillRect(0, 0, cam.w, cam.h);
      ctx.globalAlpha = 1;
    }
  },

  loop(ts) {
    try {
      if (this.contextLost) {
        // Don't touch the lost context at all — any draw call on it is a
        // silent no-op that can't refresh what's on screen, so calling them
        // repeatedly just wastes the frame. We just wait for 'contextrestored'.
        requestAnimationFrame(this.loop.bind(this));
        return;
      }
      // Cheap per-frame poll (two number comparisons) that self-heals a
      // missed resize event — mobile browsers don't always fire 'resize'
      // or 'visualViewport resize' for every address-bar/UI change, and a
      // stale canvas.width/height vs. the real viewport is what causes
      // the garbled/stretched-frame class of bug (see resize() notes).
      if (this.camera.w !== innerWidth || this.camera.h !== innerHeight) {
        this.resize();
      }
      const dt = Math.min(0.05, (ts - this.lastFrame) / 1000 || 0);
      this.lastFrame = ts;
      if (this.state === "playing") this.update(dt);
      if (
        this.state === "playing" ||
        this.state === "paused" ||
        this.state === "levelup"
      ) {
        this.drawWorld();
      } else {
        this.ctx.clearRect(0, 0, this.camera.w, this.camera.h);
        this.ctx.fillStyle = "#120e1c";
        this.ctx.fillRect(0, 0, this.camera.w, this.camera.h);
      }
    } catch (err) {
      // A frame-level error should never permanently freeze the game —
      // log it and keep the loop alive so the next frame can recover.
      console.error("Frame error (recovered):", err);
    }
    requestAnimationFrame(this.loop.bind(this));
  },
};
