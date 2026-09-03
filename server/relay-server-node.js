/* =========================================================
   WEBSOCKET RELAY SERVER — Node version
   =========================================================
   Identical wire protocol to relay-server.js (the Deno version) — the
   game client can't tell them apart. Use whichever you can actually
   run:

     relay-server.js       -> Deno Deploy (hosted, always on)
     relay-server-node.js  -> this file, runs on your own machine

   ---- WHY THIS EXISTS: the no-signup path ----------------------------
   If every cloud provider is refusing you accounts (credit card walls,
   CAPTCHA loops, 403 SIGNUP_UNAVAILABLE), you can run the relay on your
   own PC and expose it publicly with a Cloudflare Quick Tunnel, which
   needs NO Cloudflare account, NO API token, and NO signup at all:

     1. Install deps once, in this folder:
          npm install ws
     2. Start the relay:
          node relay-server-node.js
     3. In a SECOND terminal, expose it (downloads a single binary):
          cloudflared tunnel --url http://localhost:9301
        It prints a public URL like:
          https://random-words-here.trycloudflare.com
     4. In js/config.js, use that host with wss:// :
          relayUrl: "wss://random-words-here.trycloudflare.com",

   Honest limitations of the tunnel approach:
     - The URL changes every time you restart cloudflared, so you'll be
       editing config.js (and re-deploying the page) each session.
     - It only works while your PC and both terminals are running.
     - Quick tunnels are meant for testing; they're rate-limited and can
       be flaky under load. Fine for a few friends, not for a public
       launch.

   For something permanent, get the Deno version hosted — see
   server/README.md, including the "someone else can host it" note.
   ========================================================= */

"use strict";

const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 9301;
const MAX_ROOM_SIZE = 8; // plenty for co-op; stops one room being abused
const MAX_MESSAGE_BYTES = 64 * 1024;

/** roomCode -> Map<peerId, WebSocket> */
const rooms = new Map();

const makePeerId = () =>
  crypto.randomUUID().replace(/-/g, "").slice(0, 20);

function send(ws, obj) {
  try {
    if (ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(obj));
  } catch {
    /* a dead socket is not our problem — cleanup happens on close */
  }
}

function broadcast(room, obj, exceptPeerId) {
  for (const [pid, ws] of room) {
    if (pid !== exceptPeerId) send(ws, obj);
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket, req) => {
  const match = (req.url || "").match(/^\/room\/([A-Za-z0-9_-]{1,32})$/);
  if (!match) {
    socket.close(1008, "bad-path"); // expects /room/<CODE>
    return;
  }
  const roomCode = match[1].toUpperCase();
  const peerId = makePeerId();

  let room = rooms.get(roomCode);
  if (!room) {
    room = new Map();
    rooms.set(roomCode, room);
  }
  if (room.size >= MAX_ROOM_SIZE) {
    send(socket, { type: "full" });
    socket.close(1008, "room-full");
    return;
  }

  // Tell the newcomer who it is and who's already here, then tell the
  // room about the newcomer. Mirrors Trystero's onPeerJoin semantics so
  // the client wrapper treats both transports identically.
  send(socket, { type: "welcome", selfId: peerId, peers: [...room.keys()] });
  broadcast(room, { type: "peerJoin", peerId }, peerId);
  room.set(peerId, socket);
  console.log(
    `[relay] + ${peerId.slice(0, 6)} joined ${roomCode} (${room.size} in room)`,
  );

  socket.on("message", (raw) => {
    const text = raw.toString();
    if (text.length > MAX_MESSAGE_BYTES) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return; // ignore malformed frames rather than dropping the socket
    }
    if (!msg || msg.type !== "msg" || typeof msg.action !== "string") return;

    const r = rooms.get(roomCode);
    if (!r) return;

    const out = { type: "msg", action: msg.action, data: msg.data, from: peerId };
    if (msg.to) {
      const target = r.get(msg.to);
      if (target) send(target, out); // targeted (e.g. profile, revive)
    } else {
      broadcast(r, out, peerId); // everyone except the sender
    }
  });

  const cleanup = () => {
    const r = rooms.get(roomCode);
    if (!r) return;
    r.delete(peerId);
    if (r.size === 0) rooms.delete(roomCode); // don't leak empty rooms
    else broadcast(r, { type: "peerLeave", peerId });
    console.log(
      `[relay] - ${peerId.slice(0, 6)} left ${roomCode} (${r.size} left)`,
    );
  };
  socket.on("close", cleanup);
  socket.on("error", cleanup);
});

console.log(`[relay] listening on ws://localhost:${PORT}`);
console.log(`[relay] expose it publicly with:`);
console.log(`        cloudflared tunnel --url http://localhost:${PORT}`);
