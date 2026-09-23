# How Many Bayats Can You Hug?

A browser survivors-like with one twist: you don't kill the enemies
("Bayats") — you chase them down and **hug** them.

**▶ Play: <https://disserhugger.github.io>**

No build step, no bundler, no framework. Open `index.html` and it runs.

## What's in it

- **Two modes** — Arcade (60 seconds, max hugs) and Full Game (the timer
  *is* your health, and hugs are how you refill it)
- **17 Bayat types**, including rare finds and mini-bosses — a Ghost that
  phases out of reach, a Mimic that looks exactly like a normal one until
  you hug it, a Chaos Bayat that rerolls its own abilities
- **30 active tools and 26 passive buffs**, plus 5 evolutions and 6
  synergies that fuse pairs into something new
- **Combo system** with milestones, building to **Hyper Hug Mode** at x100
- **Random events** — Bayat Rush, Blackout, Golden Minute, Chaos Mode…
- **Cursed items**, world pickups, destructible decor, per-run arena
  modifiers, 22 achievements
- **A rare jumpscare.** Good luck.
- **Co-op multiplayer** — see below
- **5 arenas**, each with its own tileset, decor and hazards

## Co-op

Play together with a friend. **[Full setup guide →
MULTIPLAYER.md](MULTIPLAYER.md)**

Short version: deploy one small Cloudflare Worker (free, no credit
card), paste its URL into `js/config.js`, done. The game stays on GitHub
Pages — the Worker is just a message relay it connects out to.

Without that, co-op falls back to peer-to-peer, which works between some
networks and not others.

## Making changes

**`js/config.js` is the tuning surface.** Every gameplay number and
every asset path lives there, grouped by system — art swaps and balance
changes shouldn't need you to touch game logic at all.

For anything deeper, **`CLAUDE.md`** documents the architecture, the
rendering conventions, the mobile-specific hardening, and a bug history
explaining why certain code looks the way it does. Read it before
changing rendering or multiplayer.

## Layout

```
index.html            markup + script tags, in load order
css/style.css         all styling
js/config.js          ★ assets + every gameplay number
js/core.js            loaders, utils, SpriteTint (alpha-safe recolor)
js/content.js         data tables: Bayats, tools, buffs, events, …
js/entities.js        Player, Bayat, BayatManager
js/game.js            the main singleton / state machine / loop
js/multiplayer.js     co-op networking (relay + P2P fallback)
worker/               the co-op relay (Cloudflare Worker)
gen_*.py              regenerate the pixel-art PNGs (needs Pillow)
```

## Testing

There's no test suite. The bar for any change:

```bash
for f in js/*.js; do node --check "$f"; done
```

That catches syntax errors only — actually open the game and play a
round. Much of this project's real bug history has been mobile-only, so
testing on a phone is worth more than it sounds.
