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
  isHost: false,
  selfId: null,
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

  async _connect(code, hosting, profile) {
    const ok = await this._loadLib();
    if (!ok) throw new Error("multiplayer-unavailable");
    this.leave();
    this.roomCode = code;
    this.isHost = hosting;
    this.selfId = this._selfIdFromLib;
    this.peers = {};
    this._actions = {};
    try {
      this.room = this._joinRoomFn({ appId: MP_APP_ID }, code);
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
