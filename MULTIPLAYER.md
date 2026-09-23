# Co-op Multiplayer — Complete Setup Guide

Everything you need to get co-op working, why it's built this way, and
what to do when something breaks.

**TL;DR:** deploy one small Cloudflare Worker, paste its URL into
`js/config.js`, done. Your game stays on GitHub Pages.

> **Already deployed for this project.** `js/config.js` points at
> `wss://bayat-coop-relay.bayathugger.workers.dev`, verified working on
> live Cloudflare infrastructure. You only need the setup steps below if
> you're deploying your own copy or the existing one stops working.

---

## Table of contents

1. [How it works](#1-how-it-works)
2. [Setup (the 5-minute version)](#2-setup-the-5-minute-version)
3. [Verifying it works](#3-verifying-it-works)
4. [Troubleshooting](#4-troubleshooting)
5. [Playing a co-op game](#5-playing-a-co-op-game)
6. [Alternatives if Cloudflare won't work for you](#6-alternatives-if-cloudflare-wont-work-for-you)
7. [Configuration reference](#7-configuration-reference)
8. [How the netcode works](#8-how-the-netcode-works-for-future-changes)
9. [Cost and limits](#9-cost-and-limits)
10. [Known gaps](#10-known-gaps)

---

## 1. How it works

Two players need to exchange messages. There are two ways, and the
difference is the entire reason this guide exists.

### Peer-to-peer (the fallback — unreliable)

The two machines try to connect **directly** to each other. Their
routers have to cooperate, and often they won't: home routers and
especially mobile carriers use NAT setups that refuse incoming
connections.

This is why co-op "works on the same wifi but randomly fails across
networks, and takes five minutes of debugging every time" — whether it
works depends on the NAT types of the two specific players, which
neither of you controls.

### A relay (the fix — reliable)

Both players open an **outbound** connection to a small server, exactly
like loading a web page. Outbound connections always work. There's no
NAT traversal to fail, no TURN server, and no credentials of any kind
because there's nothing to authenticate against.

```
   Player A ──outbound──►  ┌─────────────┐  ◄──outbound── Player B
                           │   Relay     │
   (GitHub Pages)          │  (Worker)   │       (GitHub Pages)
                           └─────────────┘
```

**Your game still lives on GitHub Pages.** The relay is just something
the page connects out to. You are not moving hosting.

The relay is deliberately dumb: it forwards messages between players in
the same room and holds no game state. One player's browser is still the
authority for Bayats and hug arbitration (see
[section 8](#8-how-the-netcode-works-for-future-changes)).

---

## 2. Setup (the 5-minute version)

You need a free Cloudflare account. **No credit card.**

> Cloudflare Workers + Durable Objects are on the free plan. This is a
> *different product* from Cloudflare Realtime/TURN, which does ask for
> a card — you don't need that one.

### Step 1 — Sign in to Cloudflare

```bash
cd worker
```

```bash
npx wrangler login
```

This opens a browser to authorise. If you don't have a Cloudflare
account yet, create one first at <https://dash.cloudflare.com/sign-up>.

### Step 2 — Deploy

```bash
npx wrangler deploy
```

Wrangler prints your URL:

```
https://bayat-coop-relay.YOUR-SUBDOMAIN.workers.dev
```

### Step 3 — Point the game at it

In `js/config.js`, find `coop:` and set `relayUrl` — as **`wss://`**,
not `https://`:

```js
coop: {
  relayUrl: "wss://bayat-coop-relay.YOUR-SUBDOMAIN.workers.dev",
```

### Step 4 — Publish

Commit and push. GitHub Pages serves the updated `config.js`, and co-op
now uses the relay for everyone.

---

## 3. Verifying it works

**Check the Worker itself.** Open the `https://` version of your Worker
URL in a browser tab. You should see:

```json
{"ok":true,"service":"bayat-coop-relay","runtime":"cloudflare-durable-objects"}
```

That's the health check. (The game connects to `wss://.../room/<CODE>`,
not the root — visiting the root in a browser is expected to show this.)

**Check in-game.** Open the game → **Co-op** → set a name → **Host**.
The lobby shows a live status line:

| Status line | Meaning |
|---|---|
| `● relay connected · peers 0` | Working. Waiting for the other player. |
| `● relay connected · peers 1` | Connected to one other player. |
| `○ relay down` | Not reaching the Worker — see troubleshooting. |
| `● relays 16/20 · peers 0 · P2P` | You're on the **peer-to-peer fallback**, not the relay. |

**Test with two tabs.** Host in one, copy the room code, join in
another. `peers 1` on both = working.

---

## 4. Troubleshooting

### `○ relay down`

In order of likelihood:

1. **You used `https://` instead of `wss://`.** This is the most common
   mistake. It must be `wss://`.
2. **Trailing slash or a path.** Use the bare host:
   `wss://bayat-coop-relay.you.workers.dev` — no `/` at the end.
3. **The deploy failed.** Re-run `npx wrangler deploy` and read the
   output.
4. **Typo in the subdomain.** Compare against what wrangler printed.

### `wrangler deploy` fails

**If it mentions Durable Objects or migrations:** check
`worker/wrangler.toml` says:

```toml
[[migrations]]
tag = "v1"
new_sqlite_classes = ["CoopRoom"]
```

It must be `new_sqlite_classes`, **not** `new_classes` — the free plan
only supports SQLite-backed Durable Objects. This is already correct in
the repo; just don't "fix" it to `new_classes`.

### `wrangler login` fails with a bot challenge / 403

If you see:

```
X [ERROR] It looks like you might have hit a bot challenge page.
X [ERROR] Invalid JSON in response: status: 403 Forbidden
```

**This is not a problem with the code.** Wrangler's OAuth login opens a
Cloudflare page, and Cloudflare's anti-bot protection is blocking it
before your project is involved at all. It's common behind VPNs and on
some networks/regions.

**Fix: skip the browser login and use an API token instead.**

1. Open <https://dash.cloudflare.com/profile/api-tokens> in a normal
   browser tab.
2. **Create Token** → use the **"Edit Cloudflare Workers"** template
   (it grants exactly the permissions a Workers deploy needs).
3. Copy the token — you only see it once.
4. In the same terminal you'll deploy from:

   PowerShell:
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = "paste-your-token-here"
   ```

   bash/zsh:
   ```bash
   export CLOUDFLARE_API_TOKEN="paste-your-token-here"
   ```

5. Deploy — **no `wrangler login` needed**, the token replaces it:
   ```bash
   npx wrangler deploy
   ```

Notes:
- The variable only lasts for that terminal window. Set it again next
  time, or add it to your system environment variables permanently.
- If it complains about the account, also set `CLOUDFLARE_ACCOUNT_ID`
  (it's in the dashboard URL, and on the Workers overview page).
- **Never commit this token.** `.gitignore` already blocks `.env` and
  `.dev.vars`; setting it as an environment variable keeps it out of
  files entirely.

**If you can't even reach the dashboard** to create a token, Cloudflare
is blocking you more broadly — go to
[section 6](#6-alternatives-if-cloudflare-wont-work-for-you), especially
Option B (run the relay yourself, no account anywhere).

### Lobby shows `P2P` even though I set `relayUrl`

The relay was unreachable, so it fell back (that's `transport: "auto"`
doing its job). To make failures loud instead of silent while you debug,
set `transport: "relay"` in `js/config.js` — it will then throw a
visible error instead of quietly falling back.

### It works locally but not on GitHub Pages

Your local page is `http://` and Pages is `https://`. A page served over
HTTPS **cannot** open an insecure `ws://` socket — it must be `wss://`.
Cloudflare Workers give you `wss://` automatically, so just make sure
you didn't write `ws://`.

### Peers never see each other

- Both players must use the **exact same room code** (case doesn't
  matter, it's normalised).
- Both must be on the same relay URL — i.e. both playing the *deployed*
  page, not one local and one deployed.
- Check both lobbies say `● relay connected`.

### Co-op is missing / the button does nothing

Multiplayer needs the page served over `http(s)`. Opening
`index.html` directly from disk (`file://`) disables it — the module
that provides it can't load over `file://`. Use the deployed page, or
run a local server:

```bash
python -m http.server 8000
```

---

## 5. Playing a co-op game

1. **Co-op** from the main menu.
2. Pick a **name and colour** (saved for next time).
3. One player hits **Host** and reads out the 5-character room code.
   The other picks **Join** and enters it.
4. Both appear in the lobby list. The **host** gets a **Start Run**
   button.
5. Everyone starts together in the same arena.

### In a co-op run

- **Your buffs, tools and chests are yours alone** — you each build your
  own loadout. Only Bayats and player positions are shared.
- **Medkit Bayats** appear (co-op only). Hugging one gives you a medkit.
- **Going down:** when your timer hits 0 you don't die — you go *down*,
  greyed out and barely able to move, as long as a teammate is still up.
- **Reviving:** a teammate holding a medkit just has to walk into you.
  No button. They lose the medkit, you come back with 40% of max time.
- **Shared game over:** if everyone is down at once, the run ends for
  the whole lobby.

---

## 6. Alternatives if Cloudflare won't work for you

All of these speak an **identical protocol**, so switching is a one-line
change to `relayUrl`.

### Option A — Someone else hosts it (recommended if you're blocked)

The relay holds **no secrets, no credentials, no accounts, no data**.
It's ~100 lines that forward messages and forget them. So anyone can
host it for you:

- a friend or relative whose signups aren't blocked
- they deploy once, send you the `wss://` URL, and never think about it
  again — they don't even need to play

Because nothing is secret, sharing the hosting costs and risks nothing.

### Option B — Any other WebSocket host

`worker/relay-worker.js` needs Cloudflare (it uses Durable Objects), but
the relay is simple to port: a room map plus message forwarding, ~40
lines of real logic. On a Node host you'd swap Cloudflare's WebSocket
API for the `ws` package and keep the same wire protocol, so the game
wouldn't change at all. Hosts worth trying:
[Zeabur](https://zeabur.com/), [Render](https://render.com/),
[Replit](https://replit.com/).

### Option C — Accept peer-to-peer

Leave `relayUrl: null`. Co-op still works between players whose networks
allow direct connections — often fine on the same wifi, unreliable
across networks. This is the state you're in with no setup at all.

---

## 7. Configuration reference

All of this is in `js/config.js` under `coop:`.

| Setting | Default | What it does |
|---|---|---|
| `relayUrl` | `null` | Your relay's `wss://` URL. **The one setting that matters.** |
| `transport` | `"auto"` | `"auto"` = relay, silently falling back to P2P. `"relay"` = relay only, fail loudly (use while debugging). `"p2p"` = ignore the relay. |
| `debug` | `true` | Console logging + the lobby status line. Leave on. |
| `playerStateHz` | `12` | How often you broadcast your position. |
| `bayatSnapshotHz` | `8` | How often the host broadcasts Bayat positions. |
| `reviveRadius` | `46` | How close you must be to revive a teammate. |
| `reviveTimeFraction` | `0.4` | Fraction of max time a revived player returns with. |
| `relayRedundancy` | `20` | **P2P only.** How many signaling relays to use. Don't lower it — see CLAUDE.md bug history. |

---

## 8. How the netcode works (for future changes)

**One Durable Object per room code.** A plain Worker is stateless and
each request may land on a different machine, so it has nowhere to track
"who's in this room". A Durable Object is a single instance with memory,
and `idFromName(roomCode)` guarantees everyone using the same code
reaches the *same* instance worldwide.

**The host is just the first player.** It isn't enforced by the server —
it's a local flag deciding two things: who can press Start, and whose
browser simulates the Bayats.

**What's synced vs. local:**

| | Where it lives |
|---|---|
| Your own movement | Simulated locally, broadcast ~12×/sec |
| Other players | Lightweight puppets, interpolated between updates |
| Bayats | **Host simulates**, broadcasts snapshots ~8×/sec |
| Hugs | Claimed by the client, **arbitrated by the host** |
| Buffs / tools / chests | **Entirely local and personal** |
| Floor, decor, zones | Local, not synced (cosmetic only) |

**Hug arbitration** is why two players can't catch the same Bayat: the
host is the single authority. If the host hugs something it resolves
instantly; anyone else sends a claim and the host replies with the
verdict. First valid claim wins.

**Message protocol** (all via `Multiplayer.send(name, data, targetId?)`):

| Message | From → To | Purpose |
|---|---|---|
| `profile` | everyone → new peer | name + colour |
| `start` | host → all | begin the run together |
| `playerState` | everyone → all | position/facing/moving |
| `bayatSnapshot` | host → all | authoritative Bayat positions |
| `hugClaim` | non-host → host | "I think I hugged this one" |
| `hugResult` | host → all | who actually got it |
| `bayatEffect` | non-host → host | a joiner's tool CC/pull, so it actually affects the host's simulation |
| `downedState` | affected player → all | went down / got revived |
| `revive` | reviver → downed peer | consumes a medkit |

**Adding a new message type** takes two lines: `Multiplayer.on("name",
handler)` where the others are registered, and `Multiplayer.send("name",
data)` where you want to send. The relay forwards anything; it doesn't
need to know about your message.

**Swapping transports** touches one file. `js/multiplayer.js` presents
one surface (`send`, `on`, `peers`, `selfId`, the peer callbacks) and
nothing in `game.js` knows which transport is live.

---

## 9. Cost and limits

Cloudflare's free plan, at time of writing:

- **~100,000 requests/day**
- Incoming WebSocket messages bill at **20:1** (20 messages = 1 request)
- Durable Objects included on the free plan; **no credit card**

This game sends roughly 32 messages/sec during a 2-player run ≈ 1.6
billed requests/sec. A long session is a few thousand requests. You are
very unlikely to approach the limits.

If you ever need to reduce traffic, lower `bayatSnapshotHz` and
`playerStateHz` — 8 and 5 feel nearly identical and roughly halve it.

**Privacy:** the relay sees the messages passing through it (positions,
names). It stores nothing — rooms live in memory and vanish when empty —
but it isn't end-to-end encrypted the way peer-to-peer WebRTC is. Fine
for this game; worth knowing if you reuse the code.

---

## 10. Known gaps

Honest list of what isn't handled:

- **No mid-run join.** Joining after Start leaves you in a lobby nobody
  is looking at. Everyone must start together.
- **No host migration.** If the host closes their tab mid-run, Bayats
  stop updating and hug claims stop resolving for everyone else.
- **No "restart together".** Play Again after a co-op run leaves the
  room and restarts solo.
- **Bayat AI only reacts to the host.** Spawning accounts for all
  players, but a Bayat won't flee *you* unless you're the host — it just
  sits there until you reach it.
- **Chests aren't synced** — deliberate, they're personal loot.
- **Chaos Update systems aren't synced.** Random events, Hyper Hug Mode,
  cursed items, achievements, pickups and destructible decor are all
  rolled per-client, so two players can be in different events. Random
  events in particular would be more fun shared; wiring that up means
  the host broadcasting event start/end the same way it already
  broadcasts `start`.
