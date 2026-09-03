# TURN setup — making co-op work between different networks

Co-op needs two things: players find each other (already works, via
Trystero's decentralized relays), then their two machines open a direct
connection. That second step is the one that breaks — home routers and
mobile carriers often use NAT types that don't allow direct connections.
A TURN server fixes it by relaying the traffic instead.

**None of this is required.** Without TURN, co-op still runs — it just
fails unpredictably between different networks. This is the fix.

---

## Pick a provider

You need a TURN provider. Two that have real free tiers:

| | Free tier | Credentials | Card needed? |
|---|---|---|---|
| **[ExpressTURN](https://www.expressturn.com/)** | 1000 GB/mo, ports 3478 + 80/443 | one fixed username/password | No card mentioned at signup |
| **[Metered / Open Relay](https://www.metered.ca/tools/openrelay/)** | 20 GB/mo (Open Relay) | fixed username/password from dashboard | No card required |
| **[Cloudflare](https://dash.cloudflare.com/?to=/:account/calls)** | 1000 GB/mo, TURN over **TLS** on 443 | short-lived, minted via API | **Yes — card required** |

Cloudflare is technically the best of these (TURN over real TLS on 443
is the hardest for restrictive networks to block, and short-lived
credentials are inherently safer). But it requires a credit card, so if
that's a blocker, **ExpressTURN is the pragmatic choice** — the 1000 GB
free tier is generous and ports 80/443 still help through most
firewalls.

---

## Then pick how to store the credentials

### Option A — straight into `js/config.js` (5 minutes, works immediately)

Paste what your provider gave you into `CONFIG.coop.turnServers`:

```js
turnServers: [
  {
    urls: [
      "turn:relay.expressturn.com:3478",
      "turn:relay.expressturn.com:443",
    ],
    username: "YOUR_USERNAME",
    credential: "YOUR_PASSWORD",
  },
],
```

Done — co-op now works across networks.

**The tradeoff, stated plainly:** these credentials are then visible in
your public repo and in any player's devtools. Someone could copy them
and spend your quota. Whether that matters is a judgement call:

- The damage is bounded by the free tier (1000 GB on ExpressTURN) — it
  can't produce a surprise bill on a free plan.
- If it ever happens, rotate the credentials in your provider's
  dashboard and update `config.js`.
- Realistically, nobody is scraping a hugging game's repo for TURN
  credentials.

If that's acceptable, **stop here** — you don't need the rest of this
file or the Worker at all.

### Option B — behind the credential endpoint (keeps them out of the repo)

`turn-worker.js` in this folder serves the credentials instead, so your
repo and `config.js` contain only a URL. It adds an Origin allow-list
and per-IP rate limiting on top.

It works with **any** provider, in two modes:

- **Static mode** — set `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`.
  Use this for ExpressTURN, Metered, or self-hosted coturn.
- **Cloudflare mode** — set `TURN_KEY_ID`, `TURN_KEY_API_TOKEN`. Mints a
  fresh short-lived credential per request. Only for Cloudflare.

Be realistic about what Option B buys you: a long-lived credential given
to a browser is still readable in that browser's devtools. This keeps it
out of your *public repo* and stops other websites using it — it does
not make it secret. Cloudflare mode is the only one that's genuinely
short-lived.

#### Where to host it

The endpoint is plain `export default { fetch }` and returns JSON — no
WebSockets — so it runs on most serverless hosts. If Cloudflare's signup
is blocking you, these accept a GitHub login:

- **[Deno Deploy](https://deno.com/deploy)** — same `export default { fetch }` format, no changes needed
- **[Val Town](https://val.town/)** — paste-and-run
- **Netlify / Vercel Functions** — need the handler signature adjusted

#### Deploying to Cloudflare Workers

From inside this `worker/` directory:

```bash
npx wrangler login
```

Static mode (any provider):

```bash
npx wrangler secret put TURN_URLS
```

```bash
npx wrangler secret put TURN_USERNAME
```

```bash
npx wrangler secret put TURN_CREDENTIAL
```

Or Cloudflare mode:

```bash
npx wrangler secret put TURN_KEY_ID
```

```bash
npx wrangler secret put TURN_KEY_API_TOKEN
```

Then:

```bash
npx wrangler deploy
```

#### Lock it to your site

Edit `ALLOWED_ORIGINS` at the top of `turn-worker.js` to your real site
origin (it ships with `https://disserhugger.github.io` and some
localhost ports), then redeploy. This stops other people's pages using
your quota.

#### Point the game at it

In `js/config.js`:

```js
turnCredentialsUrl: "https://your-endpoint-url-here",
```

The lobby status line should then read `TURN on`.

---

## Where do my credentials actually live?

Depends which option you picked above.

**Option A (credentials in `js/config.js`):** they are in your public
repo. That's the accepted tradeoff — see Option A's note. Bounded by the
free tier, rotatable, and realistically low-risk for a game like this.

**Option B (credential endpoint):** no file you commit contains them.

| Where | Contains | In your public repo? |
|---|---|---|
| `worker/wrangler.toml` | Worker name and entrypoint only | ✅ yes, harmless |
| `worker/turn-worker.js` | `env.TURN_USERNAME` etc — *references*, never values | ✅ yes, harmless |
| `js/config.js` | your endpoint's **URL** only | ✅ yes, harmless |
| **Your host's secret store** | **the real credentials** | ❌ **never** |
| `worker/.dev.vars` | plaintext secrets, *if* you use `wrangler dev` | ❌ **gitignored** |

The `env.` prefix in `turn-worker.js` is the whole trick: it means "read
this from the host's secret store when the endpoint runs." `wrangler
secret put` sends the value straight to Cloudflare — it is never written
to a file in this project.

You can confirm this at any time. Run from the project root:

```bash
grep -rn "TURN_KEY\|TURN_USERNAME\|TURN_CREDENTIAL" --include=*.js --include=*.toml --include=*.md . | grep -v "env\."
```

Every line it prints should be a comment, a doc example, or a
placeholder — never a real credential. (Plain `grep` rather than `git
grep` on purpose: `git grep` only searches files already committed, so
it would miss a secret in a new file you haven't staged — exactly when
you'd most want to catch it.)

If it ever prints a real value you didn't intend to publish, rotate it
in your provider's dashboard. Note that deleting it in a later commit
does **not** erase it from git history.

The one genuine footgun is `.dev.vars`, wrangler's *local* dev secrets
file, which does hold plaintext. It's in `.gitignore` — don't remove
that entry.

**What is unavoidably public either way:** the credentials the browser
ends up using. A player's browser needs them to talk to TURN, so they're
visible in its devtools. Every browser-based WebRTC app has this
property — there is no way to hand a browser a secret it can't read.
Cloudflare mode limits the damage by making each credential expire
within the hour; static credentials don't expire until you rotate them.

So the goal is "bounded and inconvenient to abuse", not "impossible".
What's in place:

| Defense | What it stops |
|---|---|
| `Origin` required + allow-listed | Other websites, and scripted access that doesn't bother forging headers |
| Per-IP rate limit (20 / 10 min) | Bulk credential harvesting |
| 1-hour TTL | A leaked credential stops working within the hour |
| CORS echoes one exact origin, never `*` | Other sites reading the response |
| `Cache-Control: private, no-store` | Shared/CDN caches storing credentials |
| Cloudflare's 1,000 GB/mo free tier | Hard ceiling on what abuse could ever cost |

A determined attacker can forge an `Origin` header with `curl`. That is
true of any public endpoint without real authentication, and adding real
auth to an anonymous browser game isn't practical.

### Recommended: set a billing alert

The single most valuable thing you can do. Cloudflare dashboard →
**Notifications** → create a **Billing** alert. You have 1,000 GB free;
alert well before that and you'll know about abuse long before it costs
anything.

### If you see abuse

In rough order of effort:

1. **Rotate the key.** Delete the TURN key in the dashboard, create a
   new one, `wrangler secret put` both values again, redeploy. Every
   harvested credential dies immediately.
2. **Tighten the limits** at the top of `turn-worker.js` — drop
   `RATE_LIMIT_MAX`, shorten `CREDENTIAL_TTL_SECONDS` (don't go under
   ~15 min; TURN allocations refresh with these credentials, so if they
   expire mid-session co-op breaks for players who need TURN).
3. **Add a Cloudflare Rate Limiting rule** on the Worker's route in the
   dashboard — enforced at the edge, before your Worker runs, and
   stricter than the in-Worker limiter (which is per-datacenter because
   it uses the Cache API rather than requiring a KV/Durable Object
   binding).
4. **Add Cloudflare Turnstile** if it ever genuinely warrants it. This
   is heavy for a hugging game; mentioned only for completeness.

## Checking it works

Open the Worker URL directly in a browser. You should get JSON with an
`iceServers` array containing `turn:`/`turns:` entries plus a username
and credential.

> **Note:** opening the Worker URL directly in a browser address bar now
> returns `{"error":"origin-not-allowed"}` — that's correct, not a
> failure. A typed-in URL sends no `Origin` header, and refusing those
> is exactly the protection described above. To test it properly, open
> your game and check the lobby status line, or run this from the
> browser console **on your game's own page**:
>
> ```js
> fetch(CONFIG.coop.turnCredentialsUrl).then(r=>r.json()).then(console.log)
> ```

| What you see | What it means |
|---|---|
| `iceServers` JSON | Working. |
| `{"error":"worker-not-configured"}` | Secrets weren't set — redo step 2. |
| `{"error":"cloudflare-api-error"}` | Key ID or token is wrong, or the key was deleted. Run `npx wrangler tail` for the real reason (details are deliberately not returned to the browser). |
| `{"error":"origin-not-allowed"}` | Expected from the address bar. From your game, it means your site's origin isn't in `ALLOWED_ORIGINS`. |
| `{"error":"rate-limited"}` | More than 20 requests in 10 min from your IP. Normal play does one per session. |

In the game's lobby, the status line tells you the rest:

- `● relays n/20 · peers 0 · TURN on` — signaling is up, still waiting
  for the other player.
- `peers 1` — connected.
- Relays green on both machines but `peers 0` for more than ~15s, with
  `TURN on` — that's not NAT any more; suspect the room code, or one
  side's network blocking WebRTC outright.
