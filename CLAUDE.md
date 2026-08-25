# How Many Bayats Can You Hug? — Project Notes

## What this is

A browser survivors-like (Vampire Survivors-inspired) with one twist: you
don't kill enemies ("Bayats"), you chase them down and **hug** them. Built
across many iterative rounds into a fairly deep roguelite: two modes, 10
enemy types, 21 passive buffs, 23 active tools, 5 weapon evolutions, 6
chest-triggered synergy items, 5 arenas, a 3-tier loot system, and a full
mobile-hardened rendering pipeline.

It's split into a small set of files by concern (see below) — no build step,
no bundler, no framework, still just **open `index.html` in a browser**
(including via `file://`, no local server needed — plain `<script src>`
tags work offline, unlike ES modules). Keep it this way unless there's a
strong reason to change it.

## File layout

```
index.html              markup only + <link>/<script src> tags, in load order
css/style.css            all styling (was previously an inline <style> block)
js/core.js                sprite loading (ASSETS/Sprites/loadSprite) + utils
                          (clamp/lerp/rand/dist/quantize/etc) + SpriteTint
                          (the alpha-safe recolor system — see below)
js/content.js             all game DATA: CONFIG, BAYAT_TYPES, BOOST_POOL,
                          STAT_UPGRADES, TOOL_DEFS, ICON_SPRITE/iconHTML,
                          EVOLUTIONS, SYNERGIES, ARENAS, and some now-dead
                          leftover chest-reward code (CURSES/RARITY_TABLE/
                          rollChaosRewards/applyChaosReward — see "Known
                          gaps" below)
js/save-audio.js          SaveSystem (localStorage, wrapped safe) + AudioSystem
                          (procedural WebAudio tones)
js/render-helpers.js      ParticleSystem, Camera, floor-tile generation/
                          drawing, decor generation/drawing, zone tinting,
                          drawPixelStar
js/entities.js            Player, Bayat, BayatManager — the core sim objects
js/progression.js         ExperienceSystem, UpgradeSystem
js/tools.js                ToolSystem (every active tool's behavior), drawRopeLine
js/chests.js               CHEST_KINDS + ChestSystem
js/ui.js                   UI — all DOM manipulation, kept separate from Game on purpose
js/game.js                 Game — the main singleton/state machine/update-draw loop
js/multiplayer.js          Multiplayer — the ONLY ES module in the project;
                          wraps Trystero (peer-to-peer WebRTC, no backend
                          server). See "Multiplayer" section below.
js/main.js                 one line: boots Game.init() on DOMContentLoaded
assets/player.png          player sprite (pixel art)
assets/bayat.png          base Bayat sprite — every Bayat TYPE reuses this
                          one PNG, alpha-safe recolored at runtime, NOT
                          separate art per type (see SpriteTint below)
assets/buddy.png           Orbit Buddy companion sprite (pixel art — this
                          replaced an emoji "sticker" that broke the art style,
                          see history below; don't reintroduce emoji sprites)
assets/icons.png           8 cols x 7 rows sprite sheet, 48px cells — a pixel-art
                          icon for every buff/tool/synergy. Index is the
                          ICON_SPRITE map in js/content.js.
gen_icons.py               Python/PIL script that generated icons.png + buddy.png.
                          RE-RUN THIS when adding a new icon — never hand-edit
                          the PNG. Each icon is a small primitive-drawing
                          function (shoe, gem, bolt, heart, ...) reused across
                          several icons with different colors.
gen_assets.py               generated player.png / bayat.png the same way.
CLAUDE.md                   this file
```

**Load order in `index.html` matters and is deliberate**: `core.js` →
`content.js` → `save-audio.js` → `render-helpers.js` → `entities.js` →
`progression.js` → `tools.js` → `chests.js` → `ui.js` → `game.js` →
`multiplayer.js` → `main.js`. There's no `import`/`export` anywhere in any
of the classic scripts — every one of those files uses plain top-level
`const`/`class`/`function`, and classic (non-module) `<script>` tags on
the same page share one global lexical scope, so a later file can freely
reference anything declared in an earlier one. This means:

- A new file must be added to `index.html`'s script list in the right
  dependency position (usually right before whatever needs it).
- Don't add `type="module"` to any script tag other than
  `js/multiplayer.js` — that would both break the shared-global-scope
  assumption everything relies on AND break the `file://` no-server
  workflow (ES modules are blocked by CORS for local files; classic
  `<script src>` is not). `multiplayer.js` is the one deliberate
  exception, because it needs http(s) regardless (WebRTC signaling can't
  work over `file://`) and Trystero is only distributed as an ES module —
  see "Multiplayer" below for how it stays isolated from the rest.
- The one-time split from a single `index.html` into these files was done
  as a pure mechanical extraction (verified byte-for-byte against the
  original via `diff`) — nothing was reordered or rewritten in the
  process, so behavior should be 100% unchanged. If something regresses
  right after this split, suspect the extraction boundaries before
  suspecting the original logic.

## Core concept & the two modes

- **Arcade**: fixed 60s timer, counts down regardless of anything you do.
  Leveling is automatic (no choice screen) — hugs give EXP, leveling
  auto-applies a random small stat boost. Goal: max hugs before time hits 0.
- **Full Game**: the timer IS your health. It only goes up when you hug
  something, and the amount you gain per hug decays exponentially the
  longer the run goes (`Game.timeRewardFactor()`), so you're always
  chasing the next hug. The max time you can _store_ also shrinks over the
  run. Leveling here pauses the game and shows a 3-card choice (the only
  place the player still picks anything — chests are pure RNG, see below).
- Both modes share: combo system, chests, arenas, buffs/tools, evolutions,
  synergies, Guardian Hug revives.

## Architecture (read `index.html` top to bottom in roughly this order)

1. **ASSETS / Sprites / loadSprite()** — image loading with graceful
   fallback. Every sprite-loaded render path has a procedural-canvas
   fallback branch so a missing/failed PNG never crashes the game or
   breaks the visuals, just degrades gracefully.
2. **Utility functions** — `clamp/lerp/rand/dist/weightedPick/quantize`.
   `quantize(t, steps)` snaps a 0-1 progress value to N discrete steps —
   used everywhere to keep animation feeling like limited-frame pixel art
   instead of smooth CSS-style easing (death-pop scale, shockwave radius,
   telegraph rings, player walk-bob).
3. **CONFIG** — every gameplay number lives here in named sub-objects
   (`CONFIG.boost`, `CONFIG.snowball`, `CONFIG.bomb`, `CONFIG.slip`,
   `CONFIG.full`, `CONFIG.spawn`, etc). Balance changes should go here, not
   as magic numbers inline.
4. **BAYAT_TYPES** — all 10 enemy variants as data (see full list below).
   Visual identity comes from `tintColor`/`tintStrength` applied to the ONE
   base sprite via SpriteTint, plus a `badge` (colorblind-friendly symbol)
   and behavior flags (`flee`, `danger`, `ranged`, `bombType`).
5. **BOOST_POOL** — the 4 random buffs a Boost Bayat can grant on hug.
6. **SpriteTint** — **the** alpha-safe recoloring system. Loads a sprite
   once into an offscreen canvas, and for any requested `(hexColor,
strength)` blends RGB toward that color **only on pixels with alpha>0**
   via `getImageData`/`putImageData`, then caches the result. This is how
   7+ Bayat colors, the player's red hurt-flash, the violet dash trail,
   and the pink Best-Buds buddy all come from 2-3 base PNGs.
   **Never use `ctx.filter` for tinting** — an earlier version did, and it
   caused visible color fringing on the sprite's transparent edges. Route
   any new recolor need through `SpriteTint.getTinted(imgKey, color,
strength)`.
7. **STAT_UPGRADES** — 21 passive buffs (full list below).
8. **TOOL_DEFS** — 23 active tools (full list below). Each has a `kind`
   that determines how `ToolSystem` drives it — see architecture note #12.
9. **ICON_SPRITE / iconHTML()** — maps an id to a sprite-sheet cell; falls
   back to an emoji **only** as a last resort for DOM text (never for
   in-world rendering).
10. **EVOLUTIONS** — 5 combos that auto-unlock the instant both parts hit a
    level threshold (checked via `Game.checkEvolutions()`, called after
    every upgrade pick). They just set a flag in `Game.evolvedSet` that
    the relevant tool's own logic checks (e.g. `staticcling`'s fire() case
    checks `Game.evolvedSet.thunderstorm`) — no new items are created.
11. **SYNERGIES** — 6 combos that are different from EVOLUTIONS on
    purpose: you just need to _own_ both parts (any level 1+, not maxed),
    and the grant only happens the next time you **open a chest** (one
    of the chest's random picks is replaced by the synergy). It hands
    over a brand-new `resultTool` — a real tool object, fixed at
    `maxLevel:1`, that is **never added to TOOL_DEFS**, so it can never
    appear again as a normal upgrade choice and can never be releveled.
    `Game.grantSynergy()` does the actual granting (equips the tool, marks
    it "owned" in `UpgradeSystem.levels`, calls `resultTool.onGrant(player)`
    if present for passive-style synergies).
12. **Player / Bayat / BayatManager** — core entities.
    - `Bayat.update()` branches behavior by type flags rather than one
      subclass per type: `type.ranged` (Snowball — kites and throws),
      `type.bombType` (Bomb — chases, has its own warning/critical/explode
      state machine in `updateBombState()`), `type.flee` (most types),
      else "dangerous lurk" behavior. A per-type `slipChance` can stun a
      Bayat briefly regardless of type (pixel-star indicator, not emoji).
    - `Player` carries most run-scoped multipliers directly as fields
      (`speedMult`, `hugRadiusMult`, `cooldownMult`, `warmHugsMult`,
      `snowSlowMult`, `adrenalineLevel`, `guardianTotal/guardianUsed`,
      etc) — buffs mutate these directly in their `apply(player, level)`.
13. **ToolSystem** — routes every active tool by `def.kind`:
    - `'aura'` → `tickAura()`, ticked every frame while equipped (Cuddle
      Aura, Comfort Aura, Party Horn, Gravity Well, ...).
    - `'orbit'` → `tickOrbit()`, computes orbiting positions and checks
      contact each frame (Orbit Buddies, Best Buds).
    - `'passive'` → nothing per-frame; effect applied once via
      `onGrant(player)` at grant time (Fortune's Favor).
    - anything else (has `baseCooldown`) → cooldown countdown, then
      `fire()`'s big switch-statement on `def.id`.
      Adding a new tool almost always means: add to `TOOL_DEFS`, add an
      icon, add a `case` in `fire()` (or a branch in `tickAura`/`tickOrbit`).
14. **UpgradeSystem** — tracks levels for **both** STAT_UPGRADES and
    TOOL_DEFS in one `levels` map — leveling a buff and unlocking/leveling
    a tool are the same code path (`apply()` branches on which array the
    def came from).
15. **ChestSystem / CHEST_KINDS** — 3 tiers only, **no player choice**:
    `normal`→1 random upgrade, `rare`→3, `legendary`→5, weighted-random
    picked from `STAT_UPGRADES.concat(TOOL_DEFS)` filtered to non-maxed.
    A small flat EXP/time bonus is layered on top so a chest is never
    "wasted" on bad RNG. `Game.onChestOpened()` also checks SYNERGIES
    first (see #11) before spending picks on random upgrades.
16. **ARENAS** — 5 arenas (list below), each with its own floor-tile
    palette (`floorTiles`/`floorFeatures`), decoration palette/kinds,
    zone-tint colors, and gameplay modifiers (spawn rates, speeds,
    rewards). Floor is a generated tile grid (`generateFloorTiles()`),
    NOT a flat color — only visible tiles are drawn per frame
    (`drawFloor()` culls to camera bounds).
17. **ParticleSystem, Camera** — generic, reused everywhere. Particles are
    drawn as filled squares (`fillRect`), not circles — keeps the pixel
    aesthetic even for VFX.
18. **AudioSystem** — pure WebAudio procedural tones (oscillators), no
    audio files. Each event (hug, golden, levelup, evolution, bomb
    warning/critical/explode, slip, boost, snowball throw/hit, ...) has
    its own short method. Respects `settings.sfx`/`settings.volume`.
19. **SaveSystem** — localStorage wrapped in `safeGet`/`safeSet` with an
    in-memory fallback (see history #4 below — do not remove the
    try/catch). Per-arena high scores (`arcadeKey(arenaId)`), lifetime hug
    count (used to unlock arenas), settings, all live here.
20. **Game** — the main singleton: state machine (`menu / playing / paused
/ levelup / gameover`), `update(dt)` / `drawWorld()` / `loop(ts)`, and
    most cross-system glue (`onHug`, `onChestOpened`, `bombExplode`,
    `spawnSnowball`, `checkEvolutions`, `grantSynergy`, `grantBoost`,
    `tryGuardianSave`, ...). `Game.freezeT` is a brief "hitstop" (world
    pauses, particles/fx keep animating) used for mega hugs, evolutions,
    and Guardian Hug saves. `Game.screenFlashT` is a full-screen color
    flash for the same class of big moments.
21. **UI** — all DOM manipulation (screens, HUD, modals, inventory, toast,
    arena select). Deliberately separate from `Game` — `Game` owns
    simulation state, `UI` only reads it and touches the DOM. Never do DOM
    work inside `Game`'s update loop beyond calling into `UI`.

## Complete content inventory

### Bayat types (11) — `BAYAT_TYPES`

`normal`, `fast`, `slow`, `tiny`, `giant`, `dangerous` (costs time, don't
hug it), `golden` (rare, huge reward, has its own spawn-announcement
toast), `boost` (grants a random temp buff on hug — see BOOST_POOL),
`snowball` (ranged kiter, throws projectiles that slow the player, own
projectile list `Game.enemyProjectiles`), `bomb` (chases, arms with a
flashing fuse when close, explodes for time damage + knockback if not
hugged or evaded in time — state machine in `Bayat.updateBombState`),
`medkit` (co-op only — see "Multiplayer" below; grants a revive
consumable instead of EXP/time, filtered out of the spawn pool entirely
in solo play via `pickType()`'s `Game.coop` check).

### Passive buffs (21) — `STAT_UPGRADES`

`shoes`(speed), `bearhug`(hug radius+AoE stun), `amulet`(EXP mult),
`blackhole`(passive pull), `fasthands`(cooldown reduction),
`clover`(luck), `stickyarms`(slows things near your hug range),
`longarms`(hug reach), `turbolegs`(speed burst after hug),
`timepocket`(periodic free bonus), `magnetheart`(chest pickup
range+drift), `doublehug`(chance to catch a 2nd bayat), `luckysocks`
(chest frequency/rarity), `warmhugs`(reward multiplier), `megahug`
(crit-hug chance, 2x reward + flash), `widearms`(tool range),
`quicktoss`(projectile/missile speed), `secondwind`(+max stored time,
Full mode), `thickskin`(less time lost to Dangerous Bayats),
`guardianhug`(N revive charges — refills instead of ending the run),
`adrenaline`(speed/reach ramp up as your time gets low).

### Active tools (23) — `TOOL_DEFS`

Cooldown-cast: `hook`, `cake`, `rope`, `ring`, `gem`, `snowball`(tool),
`vacuum`, `magnet`, `boomerang`, `net`, `banana`, `teleporter`, `alarm`,
`confetti`, `staticcling`, `heartmissile`, `carepackage`, `glittercloud`,
`anchor`(pulls the crowd to a decoy point away from you).
Aura (continuous): `cuddleaura`, `comfortaura`, `partyhorn`(keeps an
active combo alive without a hug).
Orbit: `orbitbuddies`.

### Evolutions (5) — auto-unlock at level thresholds — `EVOLUTIONS`

`bloodAura`(Cuddle Aura L3 + Comfort Aura L3), `infernoCore`(Confetti Bomb
L3 + Bear Hug L3), `absoluteZero`(Snowball L3 + Sticky Arms L3),
`bladeStorm`(Orbit Buddies L3 + Fast Hands L3), `thunderstorm`(Static
Cling L3 + Long Arms L3). Each just sets an `evolvedSet` flag the source
tool's own code checks — no new item.

### Synergies (6) — chest-triggered, own-both-at-any-level — `SYNERGIES`

`gravitywell`(Black Hole + Vacuum -> permanent strong-pull aura),
`cryocore`(Snowball tool + Gem of Time -> bigger/faster freeze pulse),
`stormcaller`(Static Cling + Ring of Magic -> multi-zap + huge pull/slow),
`bigbang`(Confetti Bomb + Care Package -> rare telegraphed mega-blast),
`bestbuds`(Orbit Buddies + Double Hug -> 3 buddies, chain-catch chance),
`fortunesfavor`(Lucky Socks + Amulet of EXP -> permanent EXP+luck boost,
`kind:'passive'`). Each grants a real, unique, unrepeatable, un-levelable
tool — see architecture note #11 for the mechanism.

### Chest tiers (3) — `CHEST_KINDS`

`normal`(65% weight, 1 pick), `rare`(27%, 3 picks), `legendary`(8%, 5
picks). Weighted by the player's combined luck. No player choice — see
architecture note #15.

### Arenas (5) — `ARENAS`

`meadow`(Sunny Meadow — default, unlocked, no modifiers), `graveyard`
(Haunted Graveyard — +35% Dangerous spawn rate, unlock @25 lifetime
hugs), `cavern`(Crystal Cavern — +50% chest luck, unlock @60),
`wasteland`(Burning Wasteland — +15% Bayat speed/+20% reward, unlock
@120), `frozen`(Frozen Ruins — -10% both speeds, unlock @200). Each has
its own floor tileset, decor palette, and zone tint colors — see
architecture note #16. Per-arena high scores are tracked separately.

## Multiplayer (co-op, peer-to-peer, no backend)

An opt-in second mode alongside solo Arcade/Full Game — a shared main-menu
button ("Co-op") leads to a profile screen, then host/join, then a lobby,
then a run. Single-player is completely untouched by this: every hook is
gated behind `Game.coop` (see below), which defaults `false` and is only
ever set `true` inside the co-op flow.

### Networking: Trystero

[Trystero](https://trystero.dev) does serverless WebRTC matchmaking over
free public relays (default strategy — no account/API key needed); once
two peers find each other via the relay, all real gameplay data goes
peer-to-peer directly, encrypted, never touching any server. This is why
the game can stay "open `index.html`, zero backend" even with co-op.

- **`js/multiplayer.js` is the only ES module in the project.** Trystero
  is only distributed as an ES module, and WebRTC signaling can't work
  over `file://` anyway, so this file needing `http(s)` doesn't cost
  anything single-player didn't already avoid needing. It's loaded via
  `<script type="module" src="js/multiplayer.js">` — module scripts are
  deferred (run after the document is parsed, in order among other
  deferred scripts, but before `DOMContentLoaded`), so by the time
  `Game.init()` runs, `window.Multiplayer` already exists. No special
  load-order dance needed beyond where the tag sits in `index.html`.
- **On `file://`, or fully offline, `window.Multiplayer` never gets
  defined at all** (the module script itself can't execute — fetching it
  is blocked by the same-origin/CORS rules `file://` applies to modules).
  Every entry point in `Game` (the `mp*` methods) checks
  `typeof Multiplayer !== "undefined"` first and fails soft with a toast
  — same philosophy as everything else in this project that degrades
  around a missing browser feature (localStorage, canvas context, ...).
  Even when the module DOES load, `Multiplayer.host()`/`.join()` can
  still reject (offline, unreachable relays) — callers always wrap those
  in try/catch and toast rather than let it throw into the UI flow.
- **`Multiplayer` never throws into the rest of the game.** `send()`
  swallows failures (a dead/dropped connection should degrade silently,
  same as everything else here), and every user-supplied callback
  (`onPeerJoin`/`onPeerLeave`/`onPeerProfile`, and every handler
  registered via `on()`) is invoked inside its own try/catch.
- **Trystero API gotchas that cost real debugging time** (all now
  encapsulated inside `js/multiplayer.js` — see its own comments, and
  don't relearn these the hard way twice):
  1. `room.onPeerJoin` / `room.onPeerLeave` and every action's
     `.onMessage` (from `room.makeAction(id)`) are **event-handler-style
     properties you assign a callback to** (`room.onPeerJoin = fn`), like
     `el.onclick = fn` — **not methods you call with a callback**
     (`room.onPeerJoin(fn)` looks entirely plausible and fails silently
     or throws "not a function", because the property is `null` until
     assigned).
  2. `room.makeAction(id)` returns `{send, onMessage, onReceiveProgress}`
     on the currently-served build — not the `[send, get, onProgress]`
     array tuple some older docs/examples show. Destructuring it as an
     array silently gets `undefined`s.
  3. An action's `onMessage(data, meta)` calls back with `meta` as an
     **object** (`{peerId, ...}`), not a raw peerId string — verified by
     capturing live callback args, since this doesn't seem to be
     documented anywhere and is exactly the kind of thing that changes
     between builds. `Multiplayer.on()` is the ONE place that unwraps
     `meta.peerId` — every handler in `Game` (`mpOn*`) is written against
     a plain peerId string. If a future Trystero version changes this
     shape again, fix it there, not in every handler.
  4. All three of the above are why `js/multiplayer.js` exposes its own
     `send(name, data, targetPeerId)` / `on(name, handler)` wrappers
     around `room.makeAction` instead of letting `Game` call
     `room.makeAction()` directly — one normalization point instead of
     N call sites that could each get it wrong differently.

### Profile, rooms, and the lobby

- **Profile** (username + one of 10 fixed colors, `MP_COLORS` in
  `js/content.js`, Among-Us-style): saved via
  `SaveSystem.getMpProfile()/setMpProfile()`, same safe try/catch pattern
  as every other SaveSystem key. Lives in `Game.mpProfile` for the
  session.
- **Room codes** are 5 characters from `Game.mpRoomCharset` (uppercase
  letters/digits minus `0/O/1/I` for readability), generated client-side
  by whoever hosts — Trystero's `appId` (a fixed constant,
  `MP_APP_ID`/`how-many-bayats-can-you-hug-v1`) plus that room code is
  what actually scopes the Trystero room; there's no server-side
  registry, so a "wrong code" just means you join a Trystero room nobody
  else is in.
- **The host is just the first peer** — `Multiplayer.isHost` is a purely
  local flag set at `host()`/`join()` time, not something the network
  enforces. It matters for exactly two things: who's allowed to click
  "Start Run" in the lobby (`UI.els["mp-start-btn"]` is hidden for
  everyone else), and who's the Bayat/hug-claim authority once a run
  starts (see below). If the host's tab closes mid-run, nothing
  reassigns authority — that peer's simulation just stops broadcasting
  (documented gap, see "Known gaps").
- **Lobby** (`Game.mpBindRoomCallbacks()`): live peer list via
  `Multiplayer.onPeerJoin/onPeerLeave` + a `profile` action every peer
  broadcasts to newcomers, rendered by `UI.renderMpPeerList()`. Host
  clicking "Start Run" (`Game.mpStartRun()`) broadcasts a `start` message
  with the chosen arena and then calls the same `Game.mpBeginCoopRun()`
  every peer eventually calls (host locally, everyone else from the
  `start` handler) — one shared code path for "how a run actually
  begins," not two.

### Netcode model — what's synced vs. local

Deliberately simple (casual co-op, not a competitive shooter):

- **Each player simulates and renders their own `Player` locally** —
  movement is instant/authoritative from their own perspective, same as
  solo play. They broadcast a `playerState` message ~12/sec; everyone
  else renders them as a lightweight **puppet**
  (`Game.mpPeers[peerId]`: name/color/position/facing/moving/downed),
  lerped toward the latest network sample in `Game.mpUpdateNetworking()`
  — see `drawRemotePlayer()` in `js/render-helpers.js` for how a puppet
  is drawn (reuses `player.png` + `SpriteTint`, a name tag drawn in
  canvas text, never a second real `Player` instance).
- **Bayats are host-authoritative.** Only the host runs real spawning/AI
  (`BayatManager.update()`); the host broadcasts a `bayatSnapshot`
  (`{id, t, x, y}[]`) ~8/sec, and every non-host client calls
  `BayatManager.applySnapshot()` instead of `update()` (branch is in
  `Game.update()`: `if (this.coop && !Multiplayer.isHost)
this.bayats.updateAsPuppets(dt); else this.bayats.update(...)`) — puppets
  just lerp toward the latest snapshot (`Bayat.updatePuppet()`), no local
  AI. This is the whole reason two players can never end up disagreeing
  about the same Bayat.
- **Hugs are claim-arbitrated by the host.** `Game.onHug()` is the single
  choke point every hug source goes through (proximity in `checkHugs()`,
  Orbit Buddies/Best Buds, the Double Hug chain); in co-op it routes to
  `mpRequestHug()` instead of applying the reward directly:
  - **Host**: resolves immediately (no round trip) — if the Bayat is
    still alive, marks it dead, splices it out, broadcasts `hugResult`,
    and applies the reward to itself via `applyHugReward()` (the renamed
    original `onHug()` body).
  - **Non-host**: sends a `hugClaim`, marks the id pending
    (`Game.mpPendingClaims`) so `checkHugs()` re-overlapping the same
    still-alive-looking puppet doesn't spam more claims, and waits.
  - **Host receiving a `hugClaim`** (`mpOnHugClaim`): valid only if that
    Bayat is still alive in the host's own list — first claim wins,
    everyone else's claim for the same id will see `valid:false`.
  - **Everyone receiving `hugResult`**: the winner (matched by
    `Multiplayer.selfId`) calls `applyHugReward()` for their own
    EXP/time/combo/camera-shake; everyone else who can see it just gets
    `mpPlayDeathFx()` — the same particle-burst/`deathFx` visuals with
    zero reward, so it doesn't just vanish on their screen.
- **Buffs/tools/chests stay entirely local and personal**, exactly as the
  spec asked: `UpgradeSystem`/`ToolSystem`/`ChestSystem` are unchanged,
  running per-player on each client for their OWN `Game.player`/`Game.
tools`. A remote puppet never runs anyone else's tools/auras — there's
  nothing to simulate, only a position to render.
- **Floor/decor/zone-tint cosmetics are NOT synced and use no shared
  seed** — `generateFloorTiles()`/`generateDecor()`/`generateZones()`
  still call `Math.random()` per client, same as solo play. This is
  intentional, not an oversight: none of those are collidable or
  gameplay-relevant (only Bayat positions, from the host's snapshot, and
  player positions, from `playerState`, are), so every player's world
  looks cosmetically different and nobody can tell.

### Message protocol (all via `Multiplayer.send(name, data, targetPeerId?)`)

| action | sender → receiver(s) | payload | purpose |
|---|---|---|---|
| `profile` | everyone → new peer (targeted) | `{name, color}` | identity, sent on `onPeerJoin` |
| `start` | host → all | `{arenaId}` | begin the run together |
| `playerState` | everyone → all, ~12/sec | `{x, y, facing, moving}` | remote puppet position |
| `bayatSnapshot` | host → all, ~8/sec | `{list:[{id,t,x,y}], difficulty}` | host-authoritative Bayat sync |
| `hugClaim` | non-host → all (host filters) | `{bayatId}` | "I think I just hugged this one" |
| `hugResult` | host → all | `{bayatId, winnerId, valid}` | arbitration outcome |
| `downedState` | the affected player → all | `{downed}` | broadcast on going down / getting revived |
| `revive` | reviver → downed peer (targeted) | `{}` | consumes 1 medkit locally first, on the reviver's side |

### Medkit / downed / revive

- **Medkit Bayat** (`BAYAT_TYPES.medkit`, `medkitType: true`): filtered
  out of `pickType()`'s pool entirely unless `Game.coop` — hugging it
  grants `Game.player.medkits++` instead of EXP/time (early branch in
  `applyHugReward()`, before the arcade/full split).
- **Going down** (`Game.mpBecomeDowned()`, called from `update()`'s
  timer-hits-zero branch instead of `endRun()` when `this.coop` is true):
  if at least one tracked peer isn't already downed, sets
  `player.downed = true`, clamps the timer at 0 (decay branch is skipped
  entirely while downed — see the `if (!this.player.downed)` guard in
  `update()`), and broadcasts `downedState`. If nobody's left to revive
  you (solo in the room, or everyone else already down), it's just
  `endRun()` — the same ending solo Full Mode would have.
  - Downed visuals: grey `SpriteTint` + 0.6 alpha on the real `Player`
    sprite (`Player.draw()`), 0.18× speed ("can't move much" per spec,
    not a full stop) via the `speed` getter, and `checkHugs()` early-
    returns while downed (can't hug from the ground).
- **Reviving** (`Game.mpUpdateReviveCheck()`, ticked every frame in
  `mpUpdateNetworking()`): a player holding ≥1 medkit who gets within 46px
  of a downed teammate's **puppet** position auto-revives them — no
  button, "proximity... automatic on contact" per spec. Consumes the
  medkit and sends `revive` immediately, and sets a per-puppet
  `_reviveSent` guard so the ~50-150ms round trip before the downed
  peer's `downedState:false` comes back doesn't let the same teammate
  drain multiple medkits by standing there. The guard resets the next
  time that peer goes down again.
- **On receiving `revive`** (`mpOnRevive` — only the targeted peer ever
  gets this message, no broadcast, so no sender-side filtering needed):
  clears `downed`, restores the timer to 40% of `maxStoredTime`,
  broadcasts `downedState:false`.
- **Shared wipe**: `mpCheckAllDowned()` runs after any downed-state change
  while the local player is themselves downed; if every tracked peer is
  also downed, `endRun()` fires locally. Every client reaches this
  conclusion independently from the same peer roster + downed flags —
  there's no separate "game over" network message, it's derived.

### Known gaps (co-op)

- **No mid-run join.** A peer who joins the room code after `start` has
  already fired isn't added to `Game.mpPeers` or given a puppet — the
  lobby flow assumes everyone starts together, matching the spec
  ("everyone begins the run together"). Joining mid-run currently just
  leaves that peer sitting in a lobby nobody else is looking at.
- **No host migration.** If the host's tab/connection drops mid-run,
  nothing reassigns Bayat authority — surviving peers keep rendering
  puppets from the last snapshot they got and hug-claims stop resolving.
  Not handled; would need an explicit new-host election to fix properly.
- **No "restart together" flow.** "Play Again" after a co-op run
  (`retry`) leaves the Trystero room (`Game.mpEndCoopSession()`) and
  restarts solo, rather than silently half-restarting a session other
  peers still think is live — see the comment at the `retry` case in
  `bindUI()`.
- **Chests are not synced**, deliberately — see "buffs/tools/chests stay
  entirely local" above; this matches the spec, not a cut corner.

## Rendering / animation conventions

- **Pixel-art discipline is a hard rule.** No emoji in in-world rendering,
  ever — only as a DOM-text fallback of last resort. No smooth CSS
  easing for game-feel animation; use `quantize()` to keep motion feeling
  like limited frames. This was explicit user feedback (Orbit Buddies'
  emoji "ruined the art style" and got replaced with `buddy.png`).
- Death has a real animation: `Game.deathFx` — a 3-frame stepped
  scale+fade of the actual tinted sprite, not an instant vanish.
- Big moments get a `Game.shockwaves` entry — a blocky (octagon, not
  circle) ring that expands in quantized steps — plus usually a
  `Game.triggerFlash()` full-screen color pulse and/or a brief
  `Game.freezeT` hitstop. Used for: mega hugs, Bomb explosions, Guardian
  Hug saves, combo milestones (x10/x20/x35), evolutions, synergies.
- Tool visuals have their own transient lists, all culled/drawn in
  `drawWorld()`: `Game.telegraphs` (AoE warning rings, quantized
  expansion), `Game.ropeLines` (extend toward target over time, not
  instant), `Game.lightningBolts` (bright flash frame then fade),
  `Game.projectiles` (boomerang/lob/homing-missile kinds), `Game.fxZones`
  (lingering ground effects like Glitter Cloud).
- `imageSmoothingEnabled = false` wherever sprites are drawn — keep pixel
  edges crisp, never let the browser blur them.

## Mobile engineering (all load-bearing, don't regress these)

- **Canvas context loss**: low-memory/low-battery Android can silently
  lose the 2D canvas context — symptom is a frozen/garbled screen while
  the DOM HUD keeps updating fine (this actually happened and was
  reported as "a really bad bug"). `Game.init()` listens for
  `contextlost`/`contextrestored`, shows a "Recovering graphics..." banner,
  and `loop()` skips all draw calls while lost rather than spamming a
  dead context.
- **localStorage can throw** (iOS Safari private mode throws on every
  `setItem` — this was a real, confirmed cause of the game "randomly
  crashing," because an uncaught exception inside a `requestAnimationFrame`
  callback permanently stops the loop). `SaveSystem.safeGet/safeSet` wrap
  everything; `Game.loop()` also wraps its whole frame body in try/catch
  so no single bad frame can ever kill the RAF chain.
- **Resolution cap**: `Game.resize()` caps devicePixelRatio at 1.5x on
  touch devices (2x on desktop) specifically to reduce the GPU memory
  pressure that triggers context loss.
- **Compact HUD**: below 560px width, `UI.updateCompactHud()` hides the
  tool tray (it used to be visually cramped AND rebuilt its full DOM every
  frame — a real perf cost) and shows a `#menu-fab` button instead;
  Pause -> Inventory shows the same tool/buff info without cramming the
  HUD.
- **Tool tray perf**: `UI.renderTools()` updates existing cached DOM nodes
  in place (`UI._toolNodes`) instead of `innerHTML = ''` + rebuild every
  frame. Don't regress this.
- **HUD layout**: the stat row and EXP bar are a single flex-column
  (`.hud-topbar`) specifically because two independently `position:
absolute`-at-the-same-top elements used to overlap on narrow screens.
- **Virtual joystick**: `#joystick` — a floating joystick that appears
  wherever the player first touches (not fixed in a corner), toggled by
  a `settings.touchControls` option (auto-defaults true on touch
  devices).
- **Modals must be scrollable, not flex-centered**: `#upgrade-modal` (used
  for level-up choices and the Chaos-Chest-era reveal) had cards go
  off-screen on mobile because `display:flex; align-items:center` clips
  overflow instead of scrolling to it. It's `overflow-y:auto` with plain
  block-flow centering now — keep any future full-screen modal the same
  way.

## Bug history (context for why some code looks the way it does)

1. Inventory Buffs/Temp-Effects tabs didn't switch — the click handler had
   an early `if(!btn) return` gated on `[data-action]`, which ate clicks
   on the tab buttons (`[data-invtab]`) before they were ever checked.
   Fixed by decoupling the checks.
2. Chaos-chest cards (5 of them) went off-screen on mobile — see "Modals
   must be scrollable" above.
3. HUD stat row overlapped the EXP bar on mobile — see "HUD layout" above.
4. Game froze/"crashed" randomly on phones — root cause: uncaught
   localStorage exceptions in private browsing killing the render loop.
   See "localStorage can throw" above.
5. Tool tray was "too big" / janky on phones — root cause was both a
   layout issue and a genuine perf bug (full DOM rebuild every frame).
   Fixed both: compact-mode hides it in favor of a menu button, and the
   underlying render function no longer rebuilds DOM every frame.
6. Canvas showed a huge garbled/unrelated image on a low-battery Android
   phone — diagnosed as GPU canvas-context loss. See "Canvas context
   loss" above.
7. `ctx.filter`-based tinting caused visible color fringing on
   transparent sprite edges — replaced with the alpha-safe `SpriteTint`
   system (get/putImageData, only touches alpha>0 pixels).
8. Orbit Buddies rendered as an emoji (a teddy bear) — explicitly called
   out as breaking the pixel-art style. Replaced with a real generated
   sprite (`buddy.png`), tinted pink for the Best Buds synergy variant.
9. A couple of aura-kind tools were added without a `range()` function,
   which would have thrown when `tickAura` unconditionally called
   `t.def.range(t.level)`. Fixed by guarding: `t.def.range ? ... : 0`.
   If you add a new `kind:'aura'` tool, give it a `range()` even if
   unused, or make sure it doesn't need the guard removed.
10. Canvas showed a garbled patch on mobile (HUD stayed correct, only the
    game world was affected) — same underlying cause as #6
    (`canvas.width/height`, set by `Game.resize()` from
    `innerWidth`/`innerHeight`, desyncing from the real viewport — mobile
    browsers can grow/shrink the viewport, e.g. address-bar show/hide,
    without reliably firing a plain `window resize` event), but two
    distinct visual symptoms depending on which way the mismatch goes:
    a stale *smaller* backing buffer gets stretched by the browser into a
    huge blocky frame, while a stale *larger* buffer means `drawWorld()`'s
    per-frame clear (previously `clearRect(0,0,cam.w,cam.h)`, sized to the
    tracked camera, not the real canvas) leaves an uncleared strip that
    low-alpha effects (zone tints, particles) then paint into, frame after
    frame, until it's a solid garbled patch — this is why it can "just
    happen" mid-run with no modal/upgrade involved, not only right after
    a viewport-changing tap. Fixed three ways: (1) also listen on
    `window.visualViewport`'s `resize` event, the more reliable mobile
    signal; (2) a cheap per-frame poll in `loop()` comparing
    `camera.w/h` to `innerWidth/innerHeight` and calling `Game.resize()`
    on any mismatch, so a missed event self-heals within one frame instead
    of persisting/accumulating; (3) `drawWorld()` now clears the canvas's
    actual full pixel size (`this.canvas.width/height` with the transform
    reset first), not the tracked `cam.w/h`, so even if the two are ever
    out of sync for a frame, nothing is ever left unwiped.
11. Co-op peers connected (relay signaling + WebRTC handshake both
    succeeded, `onPeerJoin` fired on both sides) but every peer's name
    showed up as a room key of literal `"[object Object]"` instead of
    their real id, and no `playerState`/`hugResult`/etc ever reached its
    handler. Root cause was the Trystero API gotcha #3 in "Multiplayer"
    above: an action's `onMessage(data, meta)` passes `meta` as
    `{peerId, ...}`, not a raw peerId string — confirmed by capturing the
    live callback args over an actual two-tab connection, since this
    isn't documented anywhere. Fixed once, centrally, in
    `Multiplayer.on()` rather than in every individual handler — see that
    gotcha's full writeup for why call sites should never unwrap this
    themselves.

## Known gaps / honest limitations

- Animation is all _procedural_ (tint-flash, squash/stretch, quantized
  scale/alpha steps, particle bursts) — there is **no hand-authored
  multi-frame sprite sheet system** (e.g. a real walk-cycle or attack
  animation with distinct drawn frames). This was requested once at full
  scope and intentionally scaled back; if you want true frame-based
  character animation, that's a real asset-authoring project, not a code
  change.
- Only 5 arenas exist. A "toxic swamp" and "void arena" were discussed in
  early brainstorming but never built.
- Dead code: `CURSES`, `RARITY_TABLE`, `rollChaosRewards`,
  `applyChaosReward`, `UI.showChaosModal` are leftovers from an older
  chest design (golden/cursed/chaos/evolution chest kinds) that was
  replaced by the current 3-tier system. Nothing calls them anymore —
  safe to delete, left in place only to avoid churn.

## Testing

No test suite — it's a small set of plain files, no build step. Minimum bar
for any change: `node --check` every `.js` file you touched (or all of them:
`for f in js/*.js; do node --check "$f"; done`). This only catches syntax
errors, not logic/runtime bugs — actually open `index.html` in a browser
and play a round. Given how much of this project's real bug history is
mobile-only (see above), testing on an actual phone before calling
something "done" is disproportionately valuable here.
