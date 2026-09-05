/* =========================================================
   MULTIPLAYER (Trystero peer-to-peer networking)
   =========================================================
   This is the ONLY ES module script in the project — every other file is
   a classic <script src> sharing one global lexical scope (see CLAUDE.md
   "File layout" for why: file:// support + no build step). Modules can't
   be avoided here because Trystero is only distributed as an ES module,
   and it needs the page served over http(s) anyway (WebRTC signaling
   can't work over file://) — see CLAUDE.md "Multiplayer" section.

   Because a <script type="module"> is deferred (runs after the document
   is parsed, in order among other module/deferred scripts, but BEFORE
   DOMContentLoaded), by the time Game.init() runs (on DOMContentLoaded)
   this file has already executed and window.Multiplayer exists — no
   special load-order dance needed in index.html beyond just including it.

   This module NEVER throws into the rest of the game. Every public
   method either resolves/returns normally or rejects with an Error that
   callers are expected to catch — see Game's mp* bindUI handlers, which
   all wrap calls in try/catch and show a toast rather than let a bad
   connection crash anything (same philosophy as Game.loop()'s top-level
   try/catch).
   ========================================================= */
"use strict";

const MP_APP_ID = "how-many-bayats-can-you-hug-v1";

const Multiplayer = {
  // true once the Trystero library itself has successfully loaded from
  // the CDN. false on file://, offline, or if the CDN is unreachable —
  // callers should check this (or just catch host()/join() rejecting)
  // before offering multiplayer UI as usable.
  available: false,
  room: null,
  roomCode: null,
  /* Live netcode telemetry, so "co-op feels bad" can become a number
     instead of a guess. Filled in by the ping/pong below and by every
     inbound message; read by UI.renderNetStats() (toggle in-game with N).
     Costs one tiny message every pingIntervalMs and nothing else. */
  netStats: {
    rttMs: 0,
    rttMin: 0,
    rttMax: 0,
    jitterMs: 0,
    msgsPerSec: 0,
    lastSnapshotAgeMs: 0,
    samples: [],
  },
  _pingTimer: null,
  _msgWindow: [],
  _startNetStats() {
    this._stopNetStats();
    const cfg = (typeof CONFIG !== "undefined" && CONFIG.coop) || {};
    this._pingTimer = setInterval(() => {
      /* Addressed to OURSELVES on purpose. The relay's targeted-send path
         looks the recipient up in the room's peer map, which includes the
         sender — verified against the deployed Worker (124ms round trip
         solo). That measures the true client->relay->client path with no
         second player present and no cooperation from anyone, so ping is
         live the moment you open a lobby.

         (An earlier version broadcast the ping and waited for a peer to
         echo it, which silently reported nothing at all while you were
         alone — exactly when you most want to check your connection.) */
      if (!this.selfId) return;
      this.send("__ping", { t: performance.now() }, this.selfId);
    }, cfg.pingIntervalMs || 2000);
  },
  _stopNetStats() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = null;
  },
  _recordRtt(ms) {
    const st = this.netStats;
    st.rttMs = Math.round(ms);
    st.samples.push(ms);
    if (st.samples.length > 20) st.samples.shift();
    const arr = st.samples;
    st.rttMin = Math.round(Math.min(...arr));
    st.rttMax = Math.round(Math.max(...arr));
    // Jitter = mean absolute deviation between consecutive samples; it's
    // what actually causes stutter, and it's often the real culprit when
    // a decent average ping still feels bad.
    let j = 0;
    for (let i = 1; i < arr.length; i++) j += Math.abs(arr[i] - arr[i - 1]);
    st.jitterMs = arr.length > 1 ? Math.round(j / (arr.length - 1)) : 0;
  },
  _countMsg() {
    const now = performance.now();
    this._msgWindow.push(now);
    while (this._msgWindow.length && now - this._msgWindow[0] > 1000)
      this._msgWindow.shift();
    this.netStats.msgsPerSec = this._msgWindow.length;
  },
  isHost: false,
  selfId: null,
  // "relay" | "p2p" | null — which transport is actually live. Set by
  // _connect(); read by send()/on() and the diagnostics readout.
  transport: null,
  // peerId -> {name, color} — populated as peers announce their profile.
  // A peer with no profile yet (announcement still in flight) is simply
  // absent from this map rather than present with placeholder data.
  peers: {},

  // Optional callbacks the rest of the game can set. Every call site is
  // wrapped in try/catch so a bug in a handler can't take down the
  // networking layer (or vice versa).
  onPeerJoin: null, // (peerId) => void
  onPeerLeave: null, // (peerId) => void
  onPeerProfile: null, // (peerId, {name,color}) => void

  _joinRoomFn: null,
  _selfIdFromLib: null,
  // name -> the raw {send, onMessage, onReceiveProgress} object Trystero
  // gave us for that action id. Every action used anywhere in the game
  // (position sync, Bayat snapshots, hug claims, downed/revive, ...)
  // should go through action()/send()/on() below rather than calling
  // room.makeAction() directly — this is the ONE place that has to
  // remember Trystero's assign-not-call quirk for onMessage.
  _actions: {},

  // Gets (and lazily creates) the action object for `name`. Throws if
  // there's no active room — callers should already be guarding on that
  // via mpInLobby/mpInRun in Game, but this fails loud rather than
  // silently dropping a message if that guard is ever missing.
  _action(name) {
    if (!this.room) throw new Error("[Multiplayer] no active room");
    if (!this._actions[name]) {
      this._actions[name] = this.room.makeAction(name);
    }
    return this._actions[name];
  },
  // Send `data` on action `name` to every peer, or just `targetPeerId` if
  // given. Never throws — a send on a dead/dropped connection should
  // degrade silently, same philosophy as everything else here.
  send(name, data, targetPeerId) {
    if (this.transport === "relay") {
      try {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(
            JSON.stringify({ type: "msg", action: name, data, to: targetPeerId }),
          );
        }
      } catch (e) {
        console.warn("[Multiplayer] relay send('" + name + "') failed:", e);
      }
      return;
    }
    try {
      this._action(name).send(data, targetPeerId);
    } catch (e) {
      console.warn("[Multiplayer] send('" + name + "') failed (ignoring):", e);
    }
  },
  // Registers `handler(data, peerId)` for incoming messages on action
  // `name`. Only one handler per action name (matches Trystero's own
  // one-slot onMessage) — call again to replace it.
  //
  // NORMALIZATION NOTE: the currently-served Trystero build calls
  // onMessage(data, meta) where meta is {peerId, ...}, NOT onMessage(data,
  // peerId) with a raw string — confirmed by capturing live args, since
  // this is undocumented/varies by version and got it wrong once already
  // (see CLAUDE.md "Multiplayer" bug history). Every handler in Game
  // (mpOn*) is written against a plain peerId string, so this is the one
  // place that unwraps meta.peerId — don't duplicate that unwrapping
  // elsewhere if Trystero's shape changes again, fix it here.
  on(name, handler) {
    if (this.transport === "relay") {
      // Relay path: one handler per action name, invoked from the
      // socket's onmessage below. Wrapped so a throwing handler can't
      // kill the socket loop.
      this._relayHandlers[name] = (data, peerId) => {
        try {
          handler(data, peerId);
        } catch (e) {
          console.error("[Multiplayer] handler for '" + name + "' threw:", e);
        }
      };
      return;
    }
    try {
      this._action(name).onMessage = (data, meta) => {
        try {
          const peerId =
            meta && typeof meta === "object" ? meta.peerId : meta;
          handler(data, peerId);
        } catch (e) {
          console.error("[Multiplayer] handler for '" + name + "' threw:", e);
        }
      };
    } catch (e) {
      console.warn("[Multiplayer] on('" + name + "') failed (ignoring):", e);
    }
  },

  async _loadLib() {
    if (this._joinRoomFn) return true;
    try {
      const mod = await import("https://esm.run/trystero");
      this._joinRoomFn = mod.joinRoom;
      this._selfIdFromLib = mod.selfId || null;
      // Used by _startDiagnostics() to report how many signaling relays
      // are actually connected — optional, guarded everywhere it's used.
      this._getRelaySockets = mod.getRelaySockets || null;
      this.available = true;
      return true;
    } catch (e) {
      console.warn(
        "[Multiplayer] Trystero failed to load (offline, or page opened " +
          "via file:// instead of http(s)?) — multiplayer is unavailable.",
        e,
      );
      this.available = false;
      return false;
    }
  },

  /* Live connection diagnostics — the answer to "co-op is random and I
     can't test it". Polls Trystero's relay sockets and reports how many
     are actually OPEN, plus how many peers we can see. `status` is a
     plain object other code (UI.renderMpPeerList) can read each frame;
     nothing here affects gameplay. Only runs when CONFIG.coop.debug. */
  status: { transport: null, relaysOpen: 0, relaysTotal: 0, peerCount: 0 },
  _diagTimer: null,
  _startDiagnostics() {
    this._stopDiagnostics();
    const tick = () => {
      try {
        let open = 0,
          total = 0;
        if (this._getRelaySockets) {
          const sockets = this._getRelaySockets();
          for (const url in sockets) {
            total++;
            // WebSocket.OPEN === 1
            if (sockets[url] && sockets[url].readyState === 1) open++;
          }
        }
        if (this.transport === "relay") {
          const up = this._ws && this._ws.readyState === 1;
          this.status = {
            transport: "relay",
            relaysOpen: up ? 1 : 0,
            relaysTotal: 1,
            peerCount: Object.keys(this.peers).length,
          };
        } else {
          this.status = {
            transport: this.transport || "p2p",
            relaysOpen: open,
            relaysTotal: total,
            peerCount: Object.keys(this.peers).length,
          };
        }
      } catch (e) {
        /* diagnostics must never break a run */
      }
    };
    tick();
    this._diagTimer = setInterval(tick, 1000);
  },
  _stopDiagnostics() {
    if (this._diagTimer) clearInterval(this._diagTimer);
    this._diagTimer = null;
  },

  /* =========================================================
     TRANSPORT: WEBSOCKET RELAY  (worker/relay-worker.js)
     =========================================================
     The reliable alternative to peer-to-peer. Both players open an
     OUTBOUND WebSocket to a relay you control — outbound connections
     always work, so there is no NAT traversal to fail and no TURN
     server (and therefore no credentials) involved at all.

     Presents exactly the same surface as the Trystero path — selfId,
     peers, onPeerJoin/onPeerLeave/onPeerProfile, send(), on() — so
     nothing in game.js knows or cares which transport is live.
     ========================================================= */
  _ws: null,
  _relayHandlers: {},

  _connectRelay(code, hosting, profile) {
    return new Promise((resolve, reject) => {
      const base = (CONFIG.coop && CONFIG.coop.relayUrl) || "";
      if (!base) return reject(new Error("no-relay-url"));
      const url = base.replace(/\/+$/, "") + "/room/" + encodeURIComponent(code);

      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        return reject(e);
      }
      this._ws = ws;

      // Don't hang the lobby forever on an unreachable relay.
      const timeout = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        reject(new Error("relay-timeout"));
      }, 8000);

      ws.onopen = () => {
        if (CONFIG.coop && CONFIG.coop.debug) {
          console.log("[Multiplayer] relay socket open ->", url);
        }
      };

      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "welcome") {
          clearTimeout(timeout);
          this.selfId = msg.selfId;
          // Peers already in the room. Their profiles arrive separately
          // (each side sends `profile` on join), same as the P2P path.
          for (const pid of msg.peers || []) {
            if (this.onPeerJoin) {
              try {
                this.onPeerJoin(pid);
              } catch (e) {
                console.error("[Multiplayer] onPeerJoin handler threw:", e);
              }
            }
            this.send("profile", profile, pid);
          }
          resolve(true);
        } else if (msg.type === "peerJoin") {
          this.send("profile", profile, msg.peerId);
          if (this.onPeerJoin) {
            try {
              this.onPeerJoin(msg.peerId);
            } catch (e) {
              console.error("[Multiplayer] onPeerJoin handler threw:", e);
            }
          }
        } else if (msg.type === "peerLeave") {
          delete this.peers[msg.peerId];
          if (this.onPeerLeave) {
            try {
              this.onPeerLeave(msg.peerId);
            } catch (e) {
              console.error("[Multiplayer] onPeerLeave handler threw:", e);
            }
          }
        } else if (msg.type === "full") {
          clearTimeout(timeout);
          reject(new Error("room-full"));
        } else if (msg.type === "msg") {
          // `profile` is handled here rather than by Game so the peers
          // map is populated identically on both transports.
          if (msg.action === "profile") {
            if (msg.data && typeof msg.data.name === "string") {
              this.peers[msg.from] = msg.data;
              if (this.onPeerProfile) {
                try {
                  this.onPeerProfile(msg.from, msg.data);
                } catch (e) {
                  console.error("[Multiplayer] onPeerProfile handler threw:", e);
                }
              }
            }
            return;
          }
          this._countMsg();
          // Echo pings straight back so the sender can time a real
          // round trip; swallow our own returning echo to record it.
          if (msg.action === "__ping") {
            // Our own ping coming back: that's the RTT sample. A ping
            // from someone else is echoed so THEY can measure theirs.
            if (msg.from === this.selfId) {
              if (msg.data && msg.data.t)
                this._recordRtt(performance.now() - msg.data.t);
            } else {
              this.send("__pong", msg.data, msg.from);
            }
            return;
          }
          if (msg.action === "__pong") {
            if (msg.data && msg.data.t) this._recordRtt(performance.now() - msg.data.t);
            return;
          }
          if (msg.action === "bayatSnapshot") {
            const now = performance.now();
            if (this._lastSnapAt)
              this.netStats.lastSnapshotAgeMs = Math.round(now - this._lastSnapAt);
            this._lastSnapAt = now;
          }
          const h = this._relayHandlers[msg.action];
          if (h) h(msg.data, msg.from);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("relay-error"));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        // A mid-session drop: surface every peer as having left so the
        // lobby/run doesn't show ghosts.
        for (const pid of Object.keys(this.peers)) {
          delete this.peers[pid];
          if (this.onPeerLeave) {
            try {
              this.onPeerLeave(pid);
            } catch {}
          }
        }
      };
    });
  },

  async _connect(code, hosting, profile) {
    this.leave();
    this.roomCode = code;
    this.isHost = hosting;
    this.peers = {};
    this._actions = {};
    this._relayHandlers = {};

    /* ---- Transport selection (CONFIG.coop.transport) ----
       "auto"  — use the relay if one is configured, else P2P. If the
                 relay is unreachable, fall back to P2P rather than
                 failing outright: a degraded connection beats none.
       "relay" — relay only; error if it's down (useful for testing).
       "p2p"   — original Trystero behaviour, ignores relayUrl. */
    const coopCfg = (typeof CONFIG !== "undefined" && CONFIG.coop) || {};
    const mode = coopCfg.transport || "auto";
    const relayConfigured = !!coopCfg.relayUrl;

    if (relayConfigured && (mode === "auto" || mode === "relay")) {
      try {
        this.transport = "relay";
        await this._connectRelay(code, hosting, profile);
        this._startNetStats();
        if (coopCfg.debug) {
          console.log(
            "[Multiplayer] room '" + code + "' | host=" + hosting +
              " | transport=RELAY (no NAT traversal, no TURN needed)",
          );
          this._startDiagnostics();
        }
        return true;
      } catch (e) {
        this.transport = null;
        this._ws = null;
        if (mode === "relay") throw e; // caller explicitly demanded the relay
        console.warn(
          "[Multiplayer] Relay unreachable (" +
            (e && e.message) +
            ") — falling back to peer-to-peer.",
        );
      }
    }

    // ---- Peer-to-peer (Trystero) ----
    this.transport = "p2p";
    const ok = await this._loadLib();
    if (!ok) throw new Error("multiplayer-unavailable");
    this.selfId = this._selfIdFromLib;
    try {
      // Trystero's nostr strategy only connects each client to `redundancy`
      // relays picked randomly out of its ~45-relay default pool — the
      // default is just 5. Two independent 5-of-45 picks share ZERO
      // relays roughly HALF the time (birthday-paradox-style math), and
      // with no shared relay two peers can never find each other's
      // signaling messages — from the outside this looks exactly like
      // "joining silently creates an empty room instead" (confirmed: a
      // real host + a real joiner, both genuinely online, just never saw
      // each other). Raising redundancy makes overlap near-certain at the
      // cost of a few more short-lived WebSocket connections, which is a
      // trivial cost for a casual browser game. See CLAUDE.md
      // "Multiplayer" bug history before lowering this back down.
      // Tunable via CONFIG.coop.relayRedundancy (js/config.js). Falls
      // back to 20 if config.js somehow didn't load — this module is the
      // one ES-module file and can in principle execute before/without
      // the classic scripts in an odd load order, so it never assumes.
      const coopCfg = (typeof CONFIG !== "undefined" && CONFIG.coop) || {};
      const redundancy = coopCfg.relayRedundancy || 20;
      const roomCfg = { appId: MP_APP_ID, relayConfig: { redundancy } };
      // NOTE: this path has no TURN server, so it can only connect peers
      // whose networks allow direct WebRTC. That's the whole reason the
      // relay transport above exists and is the default — see
      // MULTIPLAYER.md. Trystero's own default STUN servers are still
      // used, which covers the easier NAT types.
      this.room = this._joinRoomFn(roomCfg, code);
      if (coopCfg.debug) {
        console.log(
          "[Multiplayer] room '" +
            code +
            "' | host=" +
            hosting +
            " | transport=P2P | relay redundancy=" +
            redundancy +
            " | no TURN (cross-network joins may fail — set CONFIG.coop.relayUrl)",
        );
        this._startDiagnostics();
      }
    } catch (e) {
      console.error("[Multiplayer] joinRoom() threw:", e);
      this.room = null;
      throw e;
    }
    // onPeerJoin/onPeerLeave are event-handler-style PROPERTIES you assign
    // a callback to (like el.onclick = fn), not methods you call with a
    // callback argument — room.onPeerJoin(fn) looks plausible but throws
    // "not a function" (or silently does nothing) because it's null until
    // assigned. Same for every action's .onMessage (see action()/on()
    // above). This tripped us up once already; see CLAUDE.md "Multiplayer"
    // bug history before changing either pattern.
    this.room.onPeerJoin = (peerId) => {
      console.log("[Multiplayer] peer joined:", peerId);
      this.send("profile", profile, peerId);
      if (this.onPeerJoin) {
        try {
          this.onPeerJoin(peerId);
        } catch (e) {
          console.error("[Multiplayer] onPeerJoin handler threw:", e);
        }
      }
    };
    this.room.onPeerLeave = (peerId) => {
      console.log("[Multiplayer] peer left:", peerId);
      delete this.peers[peerId];
      if (this.onPeerLeave) {
        try {
          this.onPeerLeave(peerId);
        } catch (e) {
          console.error("[Multiplayer] onPeerLeave handler threw:", e);
        }
      }
    };
    this.on("profile", (data, peerId) => {
      if (!data || typeof data.name !== "string") return;
      this.peers[peerId] = data;
      if (this.onPeerProfile) {
        try {
          this.onPeerProfile(peerId, data);
        } catch (e) {
          console.error("[Multiplayer] onPeerProfile handler threw:", e);
        }
      }
    });
    return true;
  },

  // Host a room under `code` (the caller picks/generates it). `profile`
  // is {name, color} — broadcast to every peer as they join.
  host(code, profile) {
    return this._connect(code, true, profile);
  },
  // Join an existing room under `code`.
  join(code, profile) {
    return this._connect(code, false, profile);
  },

  leave() {
    this._stopDiagnostics();
    this._stopNetStats();
    if (this._ws) {
      try {
        // Null the handlers first so the close event doesn't fire the
        // peer-left cascade for a teardown we initiated.
        this._ws.onclose = null;
        this._ws.onerror = null;
        this._ws.onmessage = null;
        this._ws.close();
      } catch (e) {
        console.warn("[Multiplayer] relay socket close threw (ignoring):", e);
      }
      this._ws = null;
    }
    this._relayHandlers = {};
    this.transport = null;
    if (this.room) {
      try {
        this.room.leave();
      } catch (e) {
        console.warn("[Multiplayer] room.leave() threw (ignoring):", e);
      }
    }
    this.room = null;
    this.roomCode = null;
    this.isHost = false;
    this.peers = {};
    this._actions = {};
  },
};

window.Multiplayer = Multiplayer;
