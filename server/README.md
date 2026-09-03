# Co-op relay server — the reliable way to run multiplayer

**This is the recommended setup.** It's free, needs no credit card, and
there are no credentials to manage, protect, or leak.

## Why this instead of TURN

Co-op needs two players' machines to exchange messages. There are two
ways to do that:

**Peer-to-peer (the old default).** The two machines try to connect
*directly*. Their routers have to cooperate, and many don't — especially
mobile carriers. That's the "works on the same wifi, random across
networks" problem. Fixing it requires a TURN server, which means signing
up with a third party and then protecting the credentials they give you.

**A relay (this).** Both players open an *outbound* WebSocket to a server
you control — exactly like loading a web page. Outbound connections
always work. There is no NAT traversal, no TURN, and no credential,
because there is nothing to authenticate against.

The relay is deliberately dumb: it forwards messages between players in
the same room and holds no game state. The host client is still the
authority for Bayats and hug arbitration, exactly as before — which is
why switching transports required no changes to the game logic at all.

## ⚠ Blocked from signing up everywhere? Two ways out.

If providers keep refusing you accounts — credit card walls, endless
CAPTCHAs, `403 SIGNUP_UNAVAILABLE` — you have two options that need no
account of your own.

### Option 1: run it yourself, no signup anywhere (`relay-server-node.js`)

A **Cloudflare Quick Tunnel** gives your local server a public URL with
no Cloudflare account, no API token, and no signup at all. Combined with
the Node version of the relay, you need to register with nobody.

```bash
cd server && npm install ws
```

```bash
node relay-server-node.js
```

Then in a **second terminal** (this downloads one binary, no account):

```bash
cloudflared tunnel --url http://localhost:9301
```

It prints something like `https://random-words.trycloudflare.com`. Put
that in `js/config.js` as **`wss://`**:

```js
relayUrl: "wss://random-words.trycloudflare.com",
```

Honest limitations: the URL changes every restart (so you'll edit
`config.js` each session), it only works while your PC and both
terminals are running, and quick tunnels are rate-limited testing tools
rather than production hosting. Fine for playing with a few friends;
not for a public launch.

### Option 2: someone else hosts it, permanently

If cloud providers keep refusing you (credit card walls, CAPTCHA loops,
`403 SIGNUP_UNAVAILABLE`, sanctions geo-blocks), you do **not** have to
be the one who deploys this.

**This server holds no secrets and no personal data.** There are no API
keys, no credentials, no accounts, no database — it's ~150 lines that
forward messages between players and forget everything when the room
empties. That means literally anyone can host it for you:

- a friend or relative in a country these services do serve
- anyone with a working GitHub account
- they never have to play the game, or think about it again after
  deploying

They deploy once, send you the `wss://...` URL, you paste it into
`js/config.js`. Done — every player benefits, including you.

This is the practical answer when signups are blocked, and it works
because of that one property: **nothing here is secret**, so sharing the
hosting costs nothing and risks nothing.

## Deploy it (~3 minutes)

1. Go to **<https://console.deno.com>** and sign in with GitHub.
   Free tier, **no credit card**.

   > **Use `console.deno.com`, not `dash.deno.com`.** The old dashboard
   > ("Deploy Classic") is being shut down on 2026-07-20 and its signup
   > is closed — it returns `403 SIGNUP_UNAVAILABLE`, which looks like
   > you're being blocked when you actually just hit the retired one.
2. Create a new **Playground**.
3. Paste the contents of `relay-server.js` and deploy.
4. Copy the URL it gives you (e.g. `https://your-app.deno.dev`).
5. In `js/config.js`, set it as **`wss://`** — not `https://`:

```js
relayUrl: "wss://your-app.deno.dev",
```

That's it. Start a co-op run; the lobby should read
`● relay connected`.

Deno Deploy's free tier is roughly 1M requests and 100 GB/month — far
beyond what this game uses.

### If Deno Deploy won't let you sign up

Signup blocks are common if you're behind a VPN or in a region US
providers restrict. Alternatives worth trying, roughly in order:

| Host | Card needed? | Notes |
|---|---|---|
| **[Zeabur](https://zeabur.com/)** | No — $5/mo credit | Deploy from GitHub; plenty for this |
| **[Render](https://render.com/)** | No for signup | Free web services; confirm WebSockets are on their free tier before relying on it |
| **[Replit](https://replit.com/)** | No | Easy, but free instances sleep when idle |
| **[Koyeb](https://www.koyeb.com/)** | Yes (fraud check) | Skip if a card is the blocker |

The server is plain WebSocket JavaScript. On a Node host, swap Deno's
`Deno.serve` + `Deno.upgradeWebSocket` for the `ws` package — the room
logic underneath is unchanged and the wire protocol is identical.

And if none of them work for you: see the section above — **someone else
can host it.** That is usually the fastest path out of this.

## Checking it works

Open your deploy URL in a normal browser tab. You should see:

```json
{"ok":true,"service":"bayat-coop-relay","rooms":0,"players":0}
```

That's the health check — it means the server is up. The game connects
to `wss://.../room/<CODE>` rather than the root.

In the lobby, the status line tells you the rest:

| Status line | Meaning |
|---|---|
| `● relay connected · peers 0` | Relay works. Waiting for the other player. |
| `● relay connected · peers 1` | Connected. |
| `○ relay down` | Wrong URL, used `https://` instead of `wss://`, or the deploy is asleep/failed. |
| `● relays 16/20 · TURN off` | You're on the **peer-to-peer** path — `relayUrl` isn't set, or the relay was unreachable and it fell back. |

## Transport modes

`CONFIG.coop.transport` in `js/config.js`:

- **`"auto"`** (default) — use the relay if `relayUrl` is set; if it's
  unreachable, quietly fall back to peer-to-peer. Best for players:
  a degraded connection beats none.
- **`"relay"`** — relay only, fail loudly if it's down. Use this while
  testing, so a silent fallback doesn't mask a broken deploy.
- **`"p2p"`** — ignore the relay entirely, original behaviour.

## Tradeoffs, honestly

**In favour:** connections essentially always succeed, no credentials
anywhere, no third-party account beyond the host, and you own the
endpoint.

**Against:** it's one server on one domain. A country-level block of
`deno.dev` would take co-op down, whereas peer-to-peer's ~45
decentralized signaling relays are much harder to block wholesale. If
that matters for your players, `transport: "auto"` is the hedge — it
tries the relay first and falls back to P2P automatically.

**Bandwidth:** the `bayatSnapshot` message is the main driver (it carries
every live Bayat's position, up to ~100 of them, 8×/second from the
host). If you ever approach the free tier, lower
`CONFIG.coop.bayatSnapshotHz` and `playerStateHz` — at 8/5 Hz instead of
12/8 the game feels essentially the same and uses roughly half.

## Privacy note

The relay sees the messages passing through it — positions, Bayat
snapshots, player names. It doesn't store anything (rooms live in memory
and are deleted when empty), but it isn't end-to-end encrypted the way
peer-to-peer WebRTC is. For a hugging game this is fine; worth knowing
if you ever reuse this code for something more sensitive.
