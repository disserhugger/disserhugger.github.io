/* =========================================================
   WEBSOCKET RELAY SERVER  (deploy to Deno Deploy — free, no card)
   =========================================================
   The alternative to peer-to-peer + TURN, and the reliable one.

   Why this exists:
     P2P asks two players' routers to accept a direct connection. Plenty
     of routers (and most mobile carriers) refuse, which is why co-op
     "randomly" fails between different networks. Fixing that needs a
     TURN server, which means trusting — and authenticating against — a
     third party.

     This sidesteps all of it. Both players open an OUTBOUND WebSocket to
     this server, exactly like loading a web page. Outbound connections
     always work. There is no NAT traversal, no TURN, and no credential
     to leak, because there is no credential.

   What it does: nothing but pass messages between players in the same
   room. It holds no game state and makes no decisions — the host client
   is still the authority for Bayats and hug arbitration, exactly as
   before (see CLAUDE.md "Multiplayer"). Keeping it dumb means the game's
   netcode didn't have to change.

   DEPLOY (about 3 minutes):
     1. https://console.deno.com — sign in with GitHub. No credit card.
        (NOT dash.deno.com — retired "Deploy Classic", signup closed.)
     2. New Playground (or link this repo), paste this file, deploy.
     3. Copy the URL it gives you, e.g. https://your-app.deno.dev
     4. In js/config.js set:
          relayUrl: "wss://your-app.deno.dev"
        (note: wss:// not https://)

   Free tier is roughly 1M requests + 100 GB egress/month — far beyond
   what this game will use.
   ========================================================= */

const MAX_ROOM_SIZE = 8; // plenty for co-op; stops one room being abused
const MAX_MESSAGE_BYTES = 64 * 1024;

/** roomCode -> Map<peerId, WebSocket> */
const rooms = new Map();

function makePeerId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

function send(ws, obj) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  } catch {
    /* a dead socket is not our problem — cleanup happens on close */
  }
}

function broadcast(room, obj, exceptPeerId) {
  for (const [pid, ws] of room) {
    if (pid !== exceptPeerId) send(ws, obj);
  }
}

Deno.serve((req) => {
  const url = new URL(req.url);

  // Health check / friendly landing page, so hitting the URL in a
  // browser tells you whether the deploy worked.
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "bayat-coop-relay",
        rooms: rooms.size,
        players: [...rooms.values()].reduce((n, r) => n + r.size, 0),
        hint: "Connect with wss://<this-host>/room/<ROOMCODE>",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Expect /room/<CODE>
  const match = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{1,32})$/);
  if (!match) {
    return new Response("Bad room path. Use /room/<CODE>", { status: 400 });
  }
  const roomCode = match[1].toUpperCase();

  const { socket, response } = Deno.upgradeWebSocket(req);
  const peerId = makePeerId();

  socket.onopen = () => {
    let room = rooms.get(roomCode);
    if (!room) {
      room = new Map();
      rooms.set(roomCode, room);
    }
    if (room.size >= MAX_ROOM_SIZE) {
      send(socket, { type: "full" });
      try {
        socket.close(1008, "room-full");
      } catch { /* already closing */ }
      return;
    }

    // Tell the newcomer who it is and who's already here, then tell the
    // room about the newcomer. Mirrors Trystero's onPeerJoin semantics so
    // the client wrapper can treat both transports identically.
    send(socket, { type: "welcome", selfId: peerId, peers: [...room.keys()] });
    broadcast(room, { type: "peerJoin", peerId }, peerId);
    room.set(peerId, socket);
  };

  socket.onmessage = (ev) => {
    if (typeof ev.data !== "string" || ev.data.length > MAX_MESSAGE_BYTES) return;
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return; // ignore malformed frames rather than dropping the socket
    }
    if (!msg || msg.type !== "msg" || typeof msg.action !== "string") return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const out = { type: "msg", action: msg.action, data: msg.data, from: peerId };
    if (msg.to) {
      const target = room.get(msg.to);
      if (target) send(target, out); // targeted (e.g. profile, revive)
    } else {
      broadcast(room, out, peerId); // everyone except the sender
    }
  };

  const cleanup = () => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.delete(peerId);
    if (room.size === 0) rooms.delete(roomCode); // don't leak empty rooms
    else broadcast(room, { type: "peerLeave", peerId });
  };
  socket.onclose = cleanup;
  socket.onerror = cleanup;

  return response;
});
