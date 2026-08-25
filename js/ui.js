"use strict";

/* =========================================================
   UI
   ========================================================= */
const UI = {
  els: {},
  cacheEls() {
    const ids = [
      "screen-menu",
      "screen-htp",
      "screen-settings",
      "screen-results",
      "screen-pause",
      "screen-inventory",
      "screen-arena",
      "screen-mp-profile",
      "screen-mp-hostjoin",
      "screen-mp-lobby",
      "mp-username-input",
      "mp-color-grid",
      "mp-join-code-input",
      "mp-room-code",
      "mp-peer-list",
      "mp-start-btn",
      "hud",
      "hud-timer",
      "hud-secondary",
      "hud-combo",
      "hud-level",
      "timer-label",
      "secondary-label",
      "expbar-fill",
      "level-label",
      "tool-tray",
      "upgrade-modal",
      "um-title",
      "um-sub",
      "um-cards",
      "inv-body",
      "arena-list",
      "combo-banner",
      "event-toast",
      "results-title",
      "results-stats",
      "results-record",
      "menu-arcade-best",
      "menu-full-best",
      "menu-arena-name",
      "set-volume",
      "set-sfx",
      "set-shake",
      "set-particles",
      "set-badges",
      "set-touch",
      "pause-hint",
    ];
    ids.forEach((id) => (this.els[id] = document.getElementById(id)));
  },
  ALL_SCREENS: [
    "screen-menu",
    "screen-htp",
    "screen-settings",
    "screen-results",
    "screen-pause",
    "screen-inventory",
    "screen-arena",
    "screen-mp-profile",
    "screen-mp-hostjoin",
    "screen-mp-lobby",
  ],
  showScreen(id) {
    this.ALL_SCREENS.forEach((s) => {
      this.els[s].classList.toggle("hidden", s !== id);
    });
  },
  hideAllScreens() {
    this.ALL_SCREENS.forEach((s) => this.els[s].classList.add("hidden"));
  },
  updateMenuStats() {
    this.els["menu-arcade-best"].textContent = SaveSystem.getArcadeBest(
      Game.selectedArenaId,
    );
    this.els["menu-full-best"].textContent =
      fmtTime(SaveSystem.getFullBest(Game.selectedArenaId)) + "s";
    const arena = ARENAS.find((a) => a.id === Game.selectedArenaId);
    if (arena) this.els["menu-arena-name"].textContent = arena.name;
  },
  setHudMode(mode) {
    if (mode === "arcade") {
      this.els["timer-label"].textContent = "TIME";
      this.els["secondary-label"].textContent = "HUGS";
    } else {
      this.els["timer-label"].textContent = "TIME LEFT";
      this.els["secondary-label"].textContent = "HUGS";
    }
  },
  updateHud(state) {
    this.els["hud-timer"].textContent = fmtTime(Math.max(0, state.timer));
    this.els["hud-timer"].classList.toggle(
      "danger",
      state.timer < 6 && state.timer > 0,
    );
    this.els["hud-secondary"].textContent = state.hugs;
    this.els["hud-combo"].textContent = "x" + state.combo;
    this.els["hud-level"].textContent = state.level;
    this.els["expbar-fill"].style.width =
      (state.expProgress * 100).toFixed(1) + "%";
    this.els["level-label"].textContent =
      state.mode === "arcade" ? "AUTO-LEVELING" : `EXP  ·  LV ${state.level}`;
  },
  compactHud: false,
  updateCompactHud() {
    // On narrow phone screens, the equipped-tools tray got too cramped and
    // was costing needless per-frame DOM work — hide it and surface a
    // dedicated menu button instead; Inventory (via Pause) still shows
    // every equipped tool and buff at a glance.
    this.compactHud = window.innerWidth <= 560;
    document.body.classList.toggle("compact-hud", this.compactHud);
  },
  _toolNodes: {},
  renderTools(toolSystem) {
    if (UI.compactHud) return; // tray is hidden on phones — see menu-fab instead
    const tray = this.els["tool-tray"];
    const activeIds = Object.keys(toolSystem.active);
    // remove chips for tools that are no longer active (shouldn't normally happen, but stay safe)
    for (const id in this._toolNodes) {
      if (!toolSystem.active[id]) {
        this._toolNodes[id].el.remove();
        delete this._toolNodes[id];
      }
    }
    for (const id of activeIds) {
      const t = toolSystem.active[id];
      const frac = t.cd > 0 ? clamp(t.cd / t.def.baseCooldown, 0, 1) : 0;
      let node = this._toolNodes[id];
      if (!node) {
        const div = document.createElement("div");
        div.className = "tool-chip";
        div.innerHTML = `${iconHTML(t.def.id, 28, t.def.icon)}<div class="cd-overlay"></div><span class="lvl"></span>`;
        tray.appendChild(div);
        node = {
          el: div,
          cd: div.querySelector(".cd-overlay"),
          lvl: div.querySelector(".lvl"),
        };
        this._toolNodes[id] = node;
      }
      // cheap per-frame updates only — no DOM rebuild
      node.cd.style.transform = `scaleY(${frac})`;
      if (node.lvl.textContent != t.level) node.lvl.textContent = t.level;
    }
  },
  resetToolTray() {
    for (const id in this._toolNodes) this._toolNodes[id].el.remove();
    this._toolNodes = {};
  },
  renderInventory(tab) {
    document
      .querySelectorAll(".inv-tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.invtab === tab));
    const body = this.els["inv-body"];
    body.innerHTML = "";
    if (!Game.player) {
      body.innerHTML = '<div class="inv-empty">No run in progress.</div>';
      return;
    }
    if (tab === "weapons") {
      const ids = Object.keys(Game.tools.active);
      if (!ids.length) {
        body.innerHTML =
          '<div class="inv-empty">No tools equipped yet — level up to unlock some!</div>';
        return;
      }
      for (const id of ids) {
        const t = Game.tools.active[id];
        const rate = t.def.baseCooldown
          ? (Game.player.cooldownMult * t.def.baseCooldown).toFixed(1) +
            "s cooldown"
          : "passive";
        const range = t.def.range
          ? Math.round(t.def.range(t.level) * (Game.player.wideArmsMult || 1)) +
            "px range"
          : "";
        body.insertAdjacentHTML(
          "beforeend",
          `<div class="inv-card">
          ${iconHTML(t.def.id, 32, t.def.icon)}
          <div class="inv-main">
            <div class="inv-name">${t.def.name}</div>
            <div class="inv-desc">${t.def.desc(t.level)}</div>
            <div class="inv-stats">${rate}${range ? " · " + range : ""}</div>
          </div>
          <div class="inv-lvl">LV ${t.level}/${t.def.maxLevel}</div>
        </div>`,
        );
      }
    } else if (tab === "buffs") {
      const ids = Object.keys(Game.upgrades.levels).filter((id) =>
        STAT_UPGRADES.some((d) => d.id === id),
      );
      if (!ids.length) {
        body.innerHTML =
          '<div class="inv-empty">No passive buffs yet — level up to choose some!</div>';
        return;
      }
      for (const id of ids) {
        const def = STAT_UPGRADES.find((d) => d.id === id);
        const lvl = Game.upgrades.levelOf(id);
        body.insertAdjacentHTML(
          "beforeend",
          `<div class="inv-card">
          ${iconHTML(def.id, 32, def.icon)}
          <div class="inv-main">
            <div class="inv-name">${def.name}</div>
            <div class="inv-desc">${def.desc(lvl)}</div>
          </div>
          <div class="inv-lvl">LV ${lvl}/${def.maxLevel}</div>
        </div>`,
        );
      }
    } else if (tab === "temp") {
      if (!Game.tempEffects.length) {
        body.innerHTML =
          '<div class="inv-empty">No temporary effects active.</div>';
        return;
      }
      for (const e of Game.tempEffects) {
        body.insertAdjacentHTML(
          "beforeend",
          `<div class="inv-card">
          ${iconHTML(e.id, 32, e.icon)}
          <div class="inv-main">
            <div class="inv-name">${e.name}</div>
            <div class="inv-desc">Active run modifier</div>
          </div>
          <div class="inv-timer">${e.remaining.toFixed(1)}s</div>
        </div>`,
        );
      }
    }
  },
  renderArenaSelect() {
    const list = this.els["arena-list"];
    if (!list) return;
    list.innerHTML = "";
    const lifetime = SaveSystem.getLifetimeHugs();
    for (const a of ARENAS) {
      const unlocked = !a.unlock || lifetime >= a.unlock.value;
      const bestArcade = SaveSystem.getArcadeBest(a.id);
      const bestFull = SaveSystem.getFullBest(a.id);
      const selected = Game.selectedArenaId === a.id;
      list.insertAdjacentHTML(
        "beforeend",
        `<div class="arena-card ${unlocked ? "" : "locked"} ${selected ? "selected" : ""}" data-arena-select="${unlocked ? a.id : ""}" style="--arena-color:${a.accent}">
        <div class="arena-card-top">
          <div class="arena-name">${a.name}${selected ? " \u2713" : ""}</div>
          <div class="arena-diff">${a.difficulty}</div>
        </div>
        <div class="arena-desc">${a.desc}</div>
        <div class="arena-mod">${a.modifierText}</div>
        ${
          unlocked
            ? `<div class="arena-best">Arcade best: <b>${bestArcade}</b> hugs &nbsp;·&nbsp; Full best: <b>${fmtTime(bestFull)}s</b></div>`
            : `<div class="arena-locked-text">\uD83D\uDD12 Unlock by reaching ${a.unlock.value} lifetime hugs (you have ${lifetime})</div>`
        }
      </div>`,
      );
    }
  },
  // ---- Co-op multiplayer screens ----
  _mpSelectedColor: null,
  renderMpProfileForm() {
    const existing = SaveSystem.getMpProfile();
    this.els["mp-username-input"].value = existing ? existing.name : "";
    this._mpSelectedColor = existing ? existing.color : MP_COLORS[0].hex;
    const grid = this.els["mp-color-grid"];
    grid.innerHTML = "";
    for (const c of MP_COLORS) {
      const selected = c.hex === this._mpSelectedColor;
      grid.insertAdjacentHTML(
        "beforeend",
        `<div class="mp-color-swatch${selected ? " selected" : ""}"
              data-mp-color="${c.hex}" style="background:${c.hex}"
              title="${c.name}"></div>`,
      );
    }
  },
  selectMpColor(hex) {
    this._mpSelectedColor = hex;
    const grid = this.els["mp-color-grid"];
    grid.querySelectorAll(".mp-color-swatch").forEach((el) => {
      el.classList.toggle("selected", el.dataset.mpColor === hex);
    });
  },
  // Renders the live peer list in the lobby placeholder screen. `peers` is
  // Multiplayer.peers (peerId -> {name,color}); `selfProfile` is this
  // client's own {name,color} so the local player shows up too, since
  // Trystero only tells you about OTHER peers, not yourself.
  renderMpPeerList(peers, selfProfile, isHost) {
    const list = this.els["mp-peer-list"];
    if (!list) return;
    list.innerHTML = "";
    const rows = [{ name: selfProfile.name, color: selfProfile.color, self: true }];
    for (const id in peers) {
      rows.push({ name: peers[id].name, color: peers[id].color, self: false });
    }
    for (const r of rows) {
      const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(r.color) ? r.color : "#888";
      list.insertAdjacentHTML(
        "beforeend",
        `<div class="mp-player-row">
          <div class="mp-player-swatch" style="background:${safeColor}"></div>
          <div class="mp-player-name">${escapeHtml(r.name || "?")}${r.self ? " (you)" : ""}${r.self && isHost ? " ★" : ""}</div>
        </div>`,
      );
    }
  },
  comboBanner(text) {
    const el = this.els["combo-banner"];
    el.textContent = text;
    el.style.transition = "none";
    el.style.opacity = "1";
    el.style.transform = "translate(-50%,-50%) scale(1.3)";
    requestAnimationFrame(() => {
      el.style.transition = "opacity .5s ease, transform .5s ease";
      el.style.opacity = "0";
      el.style.transform = "translate(-50%,-50%) scale(1.0)";
    });
  },
  _toastTimer: null,
  toast(text, ms) {
    const el = this.els["event-toast"];
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(
      () => el.classList.remove("show"),
      ms || 1800,
    );
  },
  showUpgradeModal(title, sub, choices, onPick) {
    this.els["um-title"].textContent = title;
    this.els["um-sub"].textContent = sub;
    const row = this.els["um-cards"];
    row.innerHTML = "";
    choices.forEach((def) => {
      const currentLevel = Game.upgrades.levelOf(def.id);
      const nextLevel = currentLevel + 1;
      const isTool = TOOL_DEFS.includes(def);
      const card = document.createElement("div");
      card.className = "up-card" + (isTool ? " rare" : "");
      card.innerHTML = `<div class="eyebrow">${isTool ? "TOOL" : "BUFF"}</div>
        <div class="icon">${iconHTML(def.id, 40, def.icon)}</div>
        <div class="name">${def.name}</div>
        <div class="lvl-tag">${isTool ? (currentLevel ? "LV " + currentLevel + " \u2192 " + nextLevel : "NEW!") : "LV " + nextLevel + "/" + def.maxLevel}</div>
        <div class="desc">${def.desc(nextLevel)}</div>
        <div class="select-btn">Select</div>`;
      card.onclick = () => {
        AudioSystem.click();
        onPick(def);
      };
      row.appendChild(card);
    });
    this.els["upgrade-modal"].classList.add("show");
  },
  hideUpgradeModal() {
    this.els["upgrade-modal"].classList.remove("show");
  },
  showChaosModal(rewards, onPick) {
    this.els["um-title"].textContent = "\uD83C\uDF08 CHAOS CHEST! \uD83C\uDF08";
    this.els["um-sub"].textContent = "pick 1 of 5 random rewards";
    const row = this.els["um-cards"];
    row.innerHTML = "";
    rewards.forEach((r) => {
      const card = document.createElement("div");
      card.className = "up-card rare";
      card.style.boxShadow = `0 0 0 2px ${r.rarity.color}, 6px 6px 0 rgba(0,0,0,.55)`;
      card.innerHTML = `<div class="eyebrow" style="background:${r.rarity.color};color:#08060d;">${r.rarity.name.toUpperCase()}</div>
        <div class="icon">${iconHTML(r.def ? r.def.id : null, 40, r.icon)}</div>
        <div class="name">${r.name}</div>
        <div class="lvl-tag" style="color:${r.rarity.color};">${r.instant ? "INSTANT" : "BOOST"}</div>
        <div class="desc">${r.desc}</div>
        <div class="select-btn">Take It</div>`;
      card.onclick = () => {
        AudioSystem.click();
        onPick(r);
      };
      row.appendChild(card);
    });
    this.els["upgrade-modal"].classList.add("show");
  },
  showResults(mode, stats, isRecord) {
    this.showScreen("screen-results");
    this.els["results-title"].textContent =
      mode === "arcade" ? "Time\u2019s Up!" : "Game Over";
    const rows = [];
    if (mode === "arcade") {
      rows.push(["Bayats Hugged", stats.hugs]);
      rows.push(["Highest Combo", "x" + stats.maxCombo]);
      rows.push(["Level Reached", stats.level]);
      rows.push(["Best Score", SaveSystem.getArcadeBest()]);
    } else {
      rows.push(["Survived", fmtTime(stats.survived) + "s"]);
      rows.push(["Bayats Hugged", stats.hugs]);
      rows.push(["Highest Combo", "x" + stats.maxCombo]);
      rows.push(["Level Reached", stats.level]);
      rows.push(["Best Time", fmtTime(SaveSystem.getFullBest()) + "s"]);
    }
    this.els["results-stats"].innerHTML = rows
      .map((r) => `<div class="r-row"><span>${r[0]}</span><b>${r[1]}</b></div>`)
      .join("");
    this.els["results-record"].classList.toggle("hidden", !isRecord);
  },
};
