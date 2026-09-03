# Co-op relay on Cloudflare — the recommended setup

**Best of both:** your game stays on **GitHub Pages** (easy, already
working, nothing to migrate), and a tiny **Cloudflare Worker** provides
the WebSocket relay that makes co-op reliable.

You do **not** move hosting. The page just opens a connection out to the
Worker, the same way it already talks to the internet.

## Why this fixes co-op

Peer-to-peer asks two players' routers to accept a *direct* connection.
Lots of routers and most mobile carriers refuse — that's the "works on
the same wifi, random everywhere else, five minutes of debugging every
time" problem.

With a relay, both players make an **outbound** connection to the Worker,
exactly like loading a web page. Outbound always works. There's no NAT
traversal, no TURN server, and no credentials of any kind.

## Cost: free

- Durable Objects have been on the **Workers Free plan** since April
  2025 — **no credit card**.
- ~100,000 requests/day, and incoming WebSocket messages bill at **20:1**
  (20 messages = 1 request). This game sends ~32 msg/sec, so about 1.6
  billed requests/sec.
- Cloudflare lists real-time multiplayer games as an intended use case.

> This is a **different product** from Cloudflare Realtime/TURN — the one
> that demanded a credit card. Workers and Durable Objects are on the
> free plan, and with a relay you don't need TURN at all.

## Deploy (~5 minutes)

From inside this `worker/` directory:

```bash
npx wrangler login
```

```bash
npx wrangler deploy
```

Wrangler prints your URL, e.g.
`https://bayat-coop-relay.<your-subdomain>.workers.dev`.

Then in `js/config.js`, set it as **`wss://`** (not `https://`):

```js
relayUrl: "wss://bayat-coop-relay.your-subdomain.workers.dev",
```

Commit, push to GitHub Pages, done. The lobby should read
`● relay connected`.

### If the deploy errors

The most likely cause is the Durable Object migration. `wrangler.toml`
uses:

```toml
[[migrations]]
tag = "v1"
new_sqlite_classes = ["CoopRoom"]
```

It **must** be `new_sqlite_classes`, not `new_classes` — the free plan
only supports SQLite-backed Durable Objects, and `new_classes` fails
there. This is already set correctly; just don't "fix" it to
`new_classes`.

## Checking it works

Open the Worker URL in a normal browser tab:

```json
{"ok":true,"service":"bayat-coop-relay","runtime":"cloudflare-durable-objects"}
```

That's the health check. The game connects to `wss://.../room/<CODE>`.

In the lobby:

| Status line | Meaning |
|---|---|
| `● relay connected · peers 0` | Working. Waiting for the other player. |
| `● relay connected · peers 1` | Connected. |
| `○ relay down` | Wrong URL, `https://` instead of `wss://`, or the deploy failed. |
| `● relays 16/20 · TURN off` | You're on **peer-to-peer** — `relayUrl` isn't set, or the relay was unreachable and it fell back. |

## Cross-origin: nothing to configure

Your page is on `github.io` and the Worker is on `workers.dev`, but
WebSocket connections aren't subject to CORS the way `fetch` is — the
browser doesn't apply same-origin rules to them. No headers, no
allow-list, no configuration needed.

## How it works

One **Durable Object per room code**. A plain Worker is stateless and
each request can land on a different machine, so it has nowhere to track
"who is in this room". A Durable Object is a single instance with
memory, and `idFromName(roomCode)` guarantees everyone using the same
code reaches the *same* instance worldwide. That maps onto the game so
directly the room logic is about 40 lines.

The relay is deliberately dumb: it forwards messages and holds no game
state. The host client is still the authority for Bayats and hug
arbitration, exactly as before — which is why adding this required no
changes to game logic.

## Other options in this folder

- `server/relay-server.js` — same relay for Deno Deploy
- `server/relay-server-node.js` — same relay for Node, plus a Cloudflare
  Quick Tunnel recipe that needs no account at all
- `turn-worker.js` + `wrangler-turn.toml` — TURN credentials for the
  peer-to-peer path. **Not needed when using this relay.**

All of them speak the identical wire protocol, so switching is a
one-line change to `relayUrl`.
