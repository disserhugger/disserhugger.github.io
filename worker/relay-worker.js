/* =========================================================
   CLOUDFLARE RELAY — Worker + Durable Object
   =========================================================
   The co-op relay, running on Cloudflare's free Workers plan. Same wire
   protocol as server/relay-server.js, so the game client can't tell them
   apart — you can switch hosts by changing one URL.

   WHY DURABLE OBJECTS: a plain Worker is stateless and each request may
   hit a different machine, so it has nowhere to keep "who is in this
   room". A Durable Object is a single addressable instance with memory,
   and `idFromName(roomCode)` guarantees everyone using the same room
   code reaches the SAME instance worldwide. One room = one object. That
   maps onto this game so directly that the room logic is ~40 lines.

   FREE PLAN: Durable Objects have been on the Workers Free plan since
   April 2025 — no credit card. Limits are ~100k requests/day, and
   incoming WebSocket messages bill at 20:1 (20 messages = 1 request),
   so this game's ~32 msg/sec costs roughly 1.6 billed requests/sec.
   Cloudflare lists multiplayer games as an intended use case.

   NOTE: this is a DIFFERENT product from Cloudflare Realtime/TURN (the
   one that wanted a credit card). Workers + Durable Objects + Pages are
   all on the free plan. You do not need TURN at all when using a relay.

   DEPLOY: see worker/README-relay.md (~5 minutes).
   ========================================================= */

const MAX_ROOM_SIZE = 8;
const MAX_MESSAGE_BYTES = 64 * 1024;

/* ---------- Durable Object: one instance per room code ---------- */
export class CoopRoom {
  constructor(state) {
    this.state = state;
    /** peerId -> WebSocket. In-memory only; a room is ephemeral by design. */
    this.peers = new Map();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const peerId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);

    if (this.peers.size >= MAX_ROOM_SIZE) {
      this.send(server, { type: "full" });
      try {
        server.close(1008, "room-full");
      } catch {}
      return new Response(null, { status: 101, webSocket: client });
    }

    // Tell the newcomer who it is and who's already here, then announce
    // it to the room. Mirrors Trystero's onPeerJoin semantics so the
    // client wrapper treats every transport identically.
    this.send(server, {
      type: "welcome",
      selfId: peerId,
      peers: [...this.peers.keys()],
    });
    this.broadcast({ type: "peerJoin", peerId }, peerId);
    this.peers.set(peerId, server);

    server.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string" || ev.data.length > MAX_MESSAGE_BYTES) {
        return;
      }
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return; // ignore malformed frames rather than dropping the socket
      }
      if (!msg || msg.type !== "msg" || typeof msg.action !== "string") return;

      const out = {
        type: "msg",
        action: msg.action,
        data: msg.data,
        from: peerId,
      };
      if (msg.to) {
        const target = this.peers.get(msg.to);
        if (target) this.send(target, out); // targeted (profile, revive)
      } else {
        this.broadcast(out, peerId); // everyone except the sender
      }
    });

    const cleanup = () => {
      this.peers.delete(peerId);
      this.broadcast({ type: "peerLeave", peerId });
      // No explicit room teardown needed: when the last socket closes and
      // nothing references this object, Cloudflare evicts it on its own.
    };
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* dead socket — the close handler cleans up */
    }
  }

  broadcast(obj, exceptPeerId) {
    const payload = JSON.stringify(obj);
    for (const [pid, ws] of this.peers) {
      if (pid === exceptPeerId) continue;
      try {
        ws.send(payload);
      } catch {
        /* ignore; close handler will remove it */
      }
    }
  }
}

/* ---------- Worker: routes /room/<CODE> to that room's object ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check, so opening the URL in a browser tells you it's live.
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "bayat-coop-relay",
          runtime: "cloudflare-durable-objects",
          hint: "Connect with wss://<this-host>/room/<ROOMCODE>",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{1,32})$/);
    if (!match) {
      return new Response("Bad room path. Use /room/<CODE>", { status: 400 });
    }
    const roomCode = match[1].toUpperCase();

    // idFromName() is the important bit: the same room code always maps
    // to the same Durable Object instance, anywhere in the world, which
    // is what lets two players actually meet.
    const id = env.COOP_ROOM.idFromName(roomCode);
    return env.COOP_ROOM.get(id).fetch(request);
  },
};
