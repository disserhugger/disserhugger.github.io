# How Many Bayats Can You Hug? — Project Notes

## What this is

A browser survivors-like (Vampire Survivors-inspired) with one twist: you
don't kill enemies ("Bayats"), you chase them down and **hug** them. Built
across many iterative rounds into a fairly deep, chaotic roguelite: two
modes, 17 enemy types (including rare/mini-boss variants), 26 passive
buffs, 30 active tools, 5 weapon evolutions, 6 chest-triggered synergy
items, 4 cursed items, 5 arenas with 6 optional per-run modifiers, a
3-tier loot system, 7 world pickup kinds, destructible decor, a 7-event
random event system, combo milestones + Hyper Hug Mode, a rare original-
character jumpscare, 22 achievements, co-op multiplayer, and a full
mobile-hardened rendering pipeline. See "Chaos Update" below for the
whole second layer of systems on top of the original game.

It's split into a small set of files by concern (see below) — no build step,
no bundler, no framework, still just **open `index.html` in a browser**
(including via `file://`, no local server needed — plain `<script src>`
tags work offline, unlike ES modules). Keep it this way unless there's a
strong reason to change it.

## File layout

```
index.html              markup only + <link>/<script src> tags, in load order
css/style.css            all styling (was previously an inline <style> block)
js/config.js              ★ THE TUNING SURFACE — ASSETS (every art/video/
                          audio path) + CONFIG (every gameplay number,
                          grouped by system). Loads FIRST, before every
                          other script, and depends on nothing. This is
                          where you point the game at different art or
                          rebalance it; you should almost never have to
                          touch game logic to do either. If you find a
                          tunable hardcoded elsewhere, the fix is to move
                          it here, not to edit it in place.
js/core.js                sprite/video/audio LOADERS (Sprites/Videos/Sounds +
                          loadSprite/loadVideo/loadSound, all with graceful
                          fallbacks) + utils (clamp/lerp/rand/dist/quantize/
                          escapeHtml/etc) + SpriteTint (the alpha-safe
                          recolor system — see below). Reads paths from
                          config.js; holds no paths of its own.
js/content.js             all game DATA TABLES: BAYAT_TYPES, BOOST_POOL,
                          MP_COLORS, STAT_UPGRADES, TOOL_DEFS, ICON_SPRITE/
                          iconHTML, EVOLUTIONS, SYNERGIES, EVENT_POOL,
                          CURSED_ITEMS, ACHIEVEMENTS, ARENA_MODIFIERS,
                          PICKUP_DEFS, ARENAS, and some now-dead leftover
                          chest-reward code (CURSES/RARITY_TABLE/
                          rollChaosRewards/applyChaosReward — see "Known
                          gaps" below). This file is the "what exists"
                          layer; config.js is the "how strong is it" layer.
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
server/relay-server.js    WebSocket relay — the RECOMMENDED co-op
                          transport. Deployed by the user to Deno Deploy
                          (free, no credit card). Stateless message
                          forwarding only; the host client is still the
                          Bayat/hug authority. Makes TURN unnecessary
                          entirely because both players connect OUTBOUND.
                          Optional — without it the game falls back to
                          peer-to-peer. See server/README.md.
server/README.md          relay deploy guide + transport-mode reference
worker/turn-worker.js     TURN credential endpoint — only needed for the
                          PEER-TO-PEER path. Superseded by the relay for
                          most users; kept because P2P is harder to block
                          at a national level. Supports both static
                          credentials (any provider) and Cloudflare's
                          short-lived minting API.
                          Mints short-lived Cloudflare TURN credentials.
                          Exists because Cloudflare refuses to issue
                          long-lived ones and the minting key must never
                          reach the browser. Entirely OPTIONAL — the game
                          runs without it, just on plain P2P. Deploy
                          instructions in worker/README.md.
worker/wrangler.toml      deploy config for the above (secrets are NOT in
                          here — set via `wrangler secret put`)
worker/README.md          ~5-minute TURN setup walkthrough + a table for
                          reading the lobby's connection diagnostics
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
assets/icons.png           8 cols x 9 rows sprite sheet, 48px cells (bumped
                          from 7 rows when the icon count outgrew 56 cells —
                          see bug history) — a pixel-art icon for every
                          buff/tool/synergy. Index is the ICON_SPRITE map in
                          js/content.js. Both `iconHTML()`'s hardcoded 432
                          and the `.pixel-icon` CSS `background-size` in
                          css/style.css must match the sheet's real pixel
                          height (rows*48) — bump all three together if the
                          grid ever grows again.
assets/jumpscare.png       "Mr. Squeeze" rare-jumpscare mascot (pixel art,
                          original character — see "Chaos Update" >
                          "Rare jumpscare" for why it's not Foxy). Swap
                          this file directly to change how the jumpscare
                          looks; falls back to a procedural canvas
                          drawing if it fails to load, like every other
                          sprite here.
gen_icons.py               Python/PIL script that generates icons.png +
                          buddy.png, saved relative to the script's own
                          location (`assets/` next to it) — NOT the stale
                          absolute `/home/claude/...` paths this originally
                          shipped with, see bug history. RE-RUN THIS when
                          adding a new icon — never hand-edit the PNG. Each
                          icon is a small primitive-drawing function (shoe,
                          gem, bolt, heart, ...) reused across several icons
                          with different colors. Needs Pillow (`pip install
                          Pillow`) — not installed by default.
gen_jumpscare.py           Python/PIL script that generates jumpscare.png,
                          same relative-path pattern as gen_icons.py.
                          RE-RUN THIS after editing the mascot's drawing
                          calls — or skip it entirely and just replace
                          assets/jumpscare.png with hand-made art instead.
gen_assets.py               generated player.png / bayat.png the same way
                          (still has the same stale absolute-path issue —
                          not fixed, since nothing needed to re-run it yet).
CLAUDE.md                   this file
```

**Load order in `index.html` matters and is deliberate**: `config.js` →
`core.js` → `content.js` → `save-audio.js` → `render-helpers.js` →
`entities.js` → `progression.js` → `tools.js` → `chests.js` → `ui.js` →
`game.js` → `multiplayer.js` → `main.js`. `config.js` MUST stay first —
`core.js` starts loading assets from `ASSETS` the moment it executes, and
several `content.js` data tables reference `CONFIG` values at definition
time, so anything earlier would read `undefined`.
There's no `import`/`export` anywhere in any
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

### Bayat types (17) — `BAYAT_TYPES`

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

**Rare / mini-boss variants (Chaos Update)** — low `weightBase`, gated
behind a meaningful `minDiff` so they read as discoveries, not clutter:
`runner`(mini-boss, extreme turnRate/jitter — hardest thing in the game
to corner, pure data tuning, no new AI), `tank`(mini-boss, slow in a
straight line but juks unpredictably — same trick, high jitter),
`ghost`(periodically "phases" — `Bayat.update()`'s `ghostType` branch
toggles `this.ghostPhased` on a lazy-init timer; while phased it's
skipped entirely in `Game.checkHugs()` and rendered at 0.28 alpha, but
tool-pull effects still land on it, so a phased ghost can visibly drift
without you being able to actually catch it), `diamond`(rare, huge
reward, own spawn toast via `Game.onDiamondEvent()`, `diamondType` flag
also gets `pickType()`'s golden-weight-boost events), `mimic`(**visually
identical to `normal`** — `tintColor:null, badge:""` on purpose; hugging
it rolls a surprise multiplier in `applyHugReward()`'s `mimicType`
branch: 20% triple reward, 55% 1.5x, 25% "...just a Bayat?" zero-reward
shrug — worst case is never an actual loss), `chaos`(mini-boss; re-rolls
its own speed + tint every 1.8-3.2s via a per-INSTANCE
`chaosSpeedMult`/`chaosTintColor` — never mutates `this.type`, which is
a shared object every Bayat of that kind points to; hugging it rolls a
wide `rand(0.4, 5)` reward multiplier in `applyHugReward()`'s
`chaosType` branch, the actual "randomly switches abilities" payoff).
All six reuse the one base sprite + SpriteTint, same as every other type
— no new art, per the pixel-art rule.

### Passive buffs (26) — `STAT_UPGRADES`

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
`adrenaline`(speed/reach ramp up as your time gets low),
`warmcocoa`(passive time regen/sec, Full mode — `player.timeRegenPerSec`,
applied in `Game.applyTimeRegen()`), `combokeeper`(extends the combo
window — `player.comboWindowBonus`, added to `CONFIG.combo.window` at
both places the window is checked), `goldenaura`(amplifies the combo
bonus itself, applied after the normal maxBonus clamp so it raises the
effective ceiling — `player.comboAmplifierMult`), `cozyinsulation`
(weakens Snowball's slow — `player.snowResistMult`, multiplies into
`CONFIG.snowball.slowAmount` where the temp effect is applied),
`boldhugs`(risk/reward: +hug reward but smaller hug radius —
`player.boldHugsRewardMult` folds into `rewardMult` in
`applyHugReward()`, `player.boldHugsRadiusMult` folds into the
`Player.hugRadius` getter).

### Active tools (30) — `TOOL_DEFS`

Cooldown-cast: `hook`, `cake`, `rope`, `ring`, `gem`, `snowball`(tool),
`vacuum`, `magnet`, `boomerang`, `net`, `banana`, `teleporter`, `alarm`,
`confetti`, `staticcling`, `heartmissile`, `carepackage`, `glittercloud`,
`anchor`(pulls the crowd to a decoy point away from you), `airplane`
(pierces every non-danger Bayat in a narrow cone aimed at the nearest
one — the only tool that hits a LINE of targets instead of a radius),
`firecracker`(zaps random Bayats anywhere currently on screen, filtered
by camera bounds rather than a distance radius — see its `range` field's
comment in content.js for why it still has one), `cupid`(targets the
FARTHEST non-danger Bayat in range instead of nearest/cluster — mops up
stragglers everything else ignores), `timebomb`(dropped close to the
player rather than thrown far — the only tool that KNOCKS Dangerous
Bayats away instead of just slowing them, while still pulling in
everything else, `kind:"telegraph"` like `carepackage`).
Aura (continuous): `cuddleaura`, `comfortaura`, `partyhorn`(keeps an
active combo alive without a hug), `duster`(periodic full-radius freeze
burst on a timer, like `comfortaura`/`partyhorn`'s pattern — distinct
from `cuddleaura`'s continuous per-frame slow), `tesla`(periodic chain
lightning — picks a random chain of `CONFIG.tesla.chainCount` nearby
Bayats and zaps each in sequence, bolt drawn coil→first→next→...).
Orbit: `orbitbuddies`.
Multi-target missile: `balloon`(fires 1+ mini hearts each seeking a
DIFFERENT nearby Bayat — same `Game.projectiles`/`kind:"missile"`
mechanism as `heartmissile`, just called multiple times per cast toward
distinct targets).

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

## Chaos Update — the big "go wild" pass

A large creative expansion layered entirely on top of the original game —
nothing above was removed, simplified, or restructured to make room for
this; every system below is additive and most read `Game.xxx` state
directly at their point of use rather than the two layers reaching into
each other's internals. All the new data tables (`EVENT_POOL`,
`CURSED_ITEMS`, `ACHIEVEMENTS`, `ARENA_MODIFIERS`, `PICKUP_DEFS`) live in
`js/content.js` right next to `ARENAS`, following the exact same
"data table + a system that reads it" shape as everything that came
before — see architecture note #16 for the pattern this repeats.

### Combo milestones + Hyper Hug Mode

`CONFIG.combo.milestones` (`[5, 10, 25, 50]`) and `hyperThreshold`
(`100`). `Game.checkComboMilestones()` runs after every non-chain hug
(`applyHugReward()`) and fires `Game.onComboMilestone(n)` the first time
the combo crosses each threshold this run (`Game.comboMilestonesHit`
tracks which) — x5 is a flat EXP bonus, x10/x25 are `applyTempEffect()`
buffs (`player.combo10SpeedMult`/`combo25RewardMult`, read live by
`Player.speed`/the reward calc), x50 is pure spectacle (shockwave +
flash + particles, no new stat). Crossing x100 calls
`Game.enterHyperHugMode()` — NOT a milestone, a timed state
(`Game.hyperModeT`, `CONFIG.hyperMode.duration` = 9s) that can retrigger
later in the same run if the combo climbs back up. Its four multipliers
(`speedMult`, `cooldownMult`, `rewardMult`, `spawnRateMult`) are read
live wherever the equivalent single-player number already lived:
`Player.speed` getter, `ToolSystem.update()`'s cooldown calc,
`applyHugReward()`'s `rewardMult`, and `BayatManager.update()`'s
spawn density/interval calc — see `Game.hyperModeActive` (a getter,
`hyperModeT > 0`) used at every one of those sites.

### Random events — `EVENT_POOL`

11 events (`bayatrush`, `goldenminute`, `panic`, `slowmo`, `blackout`,
`doublehugevent`, `chaosmode`, `timestop`, `giantmode`, `magnetstorm`,
`reverseworld`), each just a data entry with `weight`, `duration`, and
whichever of a handful of multiplier fields it wants to set
(`spawnMult`, `goldenWeightMult`, `luckMult`, `bayatSpeedMult`,
`rewardEventMult`, `darkness`, `playerScaleEventMult`,
`playerSpeedEventMult`, `globalPull`, `invertControls`).
`Game.updateEvents(dt)` is a pure scheduler
(`CONFIG.events.firstDelay`/`minGap`/`maxGap`) — it never touches
gameplay directly except for Magnet Storm's `globalPull` (see below),
the one field that needed a per-frame position mutation rather than
just being read elsewhere. Every other system reads
`Game.activeEvent.def.<field>` at its own point of use instead:
`BayatManager.update()` (spawn density/speed, shared with Hyper Mode's
hook), `BayatManager.pickType()` (golden/diamond weight + luck),
`Bayat.effectiveSpeed` (bayatSpeedMult — **explicit `!== undefined`
check, not truthiness**, see bug history), `applyHugReward()`
(rewardEventMult), `Player.speed`/`hugRadius`/`draw()` (Giant Mode's
`playerSpeedEventMult`/`playerScaleEventMult` — the last one purely
visual, collision/arena-bounds stay tied to the real `this.radius`),
`Player.update()` (Reverse World's `invertControls`, same flip as the
jumpscare's `invertControlsT` outcome but event-gated instead of a
timer), and `Game.drawWorld()` (the `darkness` flag — draws a
radial-gradient "hole" of visibility around the player in plain screen
space, not a composite-operation punch-out). Adding a new event is
almost always just a new `EVENT_POOL` entry reusing an existing field;
only add a new field + new read site for a genuinely new kind of effect.
Chaos Mode is deliberately the rarest (`weight: 3`) and stacks several
fields at once — the "everything at once, good luck" event. Time Stop
(`bayatSpeedMult: 0`) is the strongest single effect (free hugs) and is
weighted accordingly rare.

Magnet Storm's `globalPull` is co-op-guarded
(`!this.coop || Multiplayer.isHost`) since it's the one event field that
directly mutates Bayat position every frame — on a non-host client that
would fight `Bayat.updatePuppet()`'s lerp-toward-the-host's-snapshot.
Every other event field only ever *reads* a multiplier, so this is the
only one that needed the guard — see "Known gaps" below for the wider
point that random events aren't synced across co-op peers at all yet.

### Cursed items — `CURSED_ITEMS`

Distinct from the pre-existing dead `CURSES` array (still dead, still
safe to delete, see "Known gaps") — these are real, live, and always a
paired benefit + drawback (`cursedspeed`, `bloodclock`, `glasshands`,
`chaosmagnet`). Rolled independently of chest tier in
`Game.onChestOpened()` (`CONFIG.cursedChest.chance` = 5%, gated on
`Game.cursedItemsTaken` so the same one can't be granted twice in one
run) — a cursed chest replaces that chest's normal picks with exactly
one `CURSED_ITEMS` entry via `Game.grantCursedItem()`. Granted through
the existing `applyTempEffect()` system with `duration: Infinity`
(JS: `Infinity - dt` stays `Infinity`, so this Just Works with zero
changes to `updateTempEffects()`) — the ONE thing that needed a real fix
was the Inventory "Temp Effects" tab's countdown display, which called
`e.remaining.toFixed(1)` and would've shown literal `"Infinitys"`; it
now special-cases `Infinity` to `"rest of run"` (`UI.renderInventory`).

### Rare jumpscare — "Mr. Squeeze"

An **original** pixel-art mascot invented for this game, not a
reproduction of Five Nights at Freddy's Foxy or any other existing
copyrighted character — the user's spec named Foxy specifically, but
that's a trademarked design, so this is a from-scratch replacement with
the same "sudden scary visitor" beat. The joke: in a game about hugging,
the thing that hugs YOU is the scary part (big reaching arms).

**It's a real, swappable image asset** — `assets/jumpscare.png`, loaded
through the exact same `ASSETS`/`Sprites`/`loadSprite()` pattern in
core.js as `player.png`/`bayat.png`/`buddy.png` (see "File layout").
Change how the jumpscare looks by just replacing that PNG — any size
works, it's drawn scaled to fit — no code edit needed. The default was
generated by `gen_jumpscare.py` (same Python/PIL pattern as
`gen_icons.py`/`gen_assets.py`, saved relative to the script's own
location); edit the drawing calls in that script and re-run it if you
want to regenerate rather than hand-draw a replacement. If the PNG ever
fails to load, `drawJumpscareOverlay()` (render-helpers.js) falls back
to `drawJumpscareProcedural()` — the original hand-coded-canvas-
primitives version, kept specifically as that fallback — same
graceful-degradation philosophy as every other sprite in this project.
Both paths share the same quantized stepped pop-in scale (per the
project's animation conventions) and screen-space positioning (ignores
the camera, like the HUD). The Golden variant recolors the sprite via
`SpriteTint.getTinted("jumpscare", "#ffd76a", 0.6)` — the same alpha-
safe tint system every other recolor in this game uses, never
`ctx.filter` (see "SpriteTint" architecture note for why).

**Optional VIDEO and custom SOUND overrides** — both opt-in, both
`null` by default (so nothing is fetched unless you set them):

- `ASSETS.jumpscareVideo` (core.js) — set to a video path
  (`"assets/foxi-video.mp4"`; webm/mp4 both fine) to play a video instead
  of the PNG. Loaded via `loadVideo()`, drawn frame-by-frame onto the
  game canvas by `drawJumpscareOverlay()` — the frames are *painted by
  us*, so the scanline layer and screen flash still composite on top and
  it can't outlive a state change that stops drawing. Unlike the PNG
  mascot (a centered character) a video renders **fullscreen**, scaled to
  COVER the canvas, punching in from 1.12x to 1.0x. The element is
  force-`muted` — **audio always comes from AudioSystem, never the
  video's own track** — so autoplay policy can never silently block the
  scare. Note the element still has to be *attached to the DOM and
  rendered* despite only ever being drawn to canvas; see bug history #18
  before touching how it's parked there. `Game.triggerJumpscare()`
  restarts it from `currentTime = 0`; `Game.stopJumpscareMedia()` halts
  video AND audio on every exit path (scare ends, quit to menu, run over,
  new run started) so a long clip can't bleed over the results screen.
- `ASSETS.jumpscareSound` (core.js) — set to an audio path
  (`"assets/foxi-audio.mp4"`; mp3/m4a/aac-in-mp4 all work) to replace the
  built-in procedural sting with your own file. Loaded via `loadSound()`,
  played by `AudioSystem.playJumpscare()`, volume tied to
  `settings.volume`.

**Scare length auto-fits the media.** `Game.jumpscareDuration()` normally
returns `CONFIG.jumpscare.freezeDuration + visibleDuration` (1.65s), but
when a video/sound asset is loaded it stretches to that media's real
`duration` so a 5s clip isn't chopped off a third of the way through —
clamped to never go below the built-in timing and never above
`CONFIG.jumpscare.maxMediaDuration` (6s), so a wrongly-sized file can't
lock up a run. Set `CONFIG.jumpscare.useMediaDuration: false` to opt out
and always use the static timing. Both `triggerJumpscare()` and the
`drawWorld()` draw call go through this one helper — don't recompute the
total inline, or the pop-in animation will desync from the real length.

The shipped default pair (`assets/foxi-video.mp4` + `assets/foxi-audio.mp4`,
both ~4.9s) is deliberately split: the video has **no audio track** and
the audio is a separate file. That's the ideal shape here given the
video element is force-muted anyway — but it's also exactly the setup
that triggers Chrome's video-only background-pause heuristic, so see bug
history #18 if playback ever mysteriously stops.

**Full priority chain, each step falling through to the next on any
failure (missing file, decode error, autoplay block, `drawImage` throw):
video → PNG → procedural drawing** for visuals, and **file → procedural
sting** for audio. Verified by testing each fallback explicitly, not just
the happy path. `AudioSystem.jumpscareTone(golden)` is the built-in
sting — a dedicated downward-sweep + detuned-sawtooth screech (the
nastiest sound in the game on purpose), NOT the generic `danger()` sting
it originally reused; the Golden variant gets a brighter, non-hostile
variant of the same shape.

`CONFIG.jumpscare.chancePerSecond`
(0.0009 — ≈1 scare per ~18 min of play on average, memoryless) is rolled
every frame in `Game.updateJumpscareRoll()` while playing and not
already frozen for something else. `Game.triggerJumpscare(forceGolden)`
reuses the existing `Game.freezeT` hitstop mechanism (same one mega-
hugs/evolutions use) for the freeze+visible duration; `forceGolden` is
optional (leave it `undefined` for the real random roll against
`CONFIG.jumpscare.goldenChance`, 5%) — it exists specifically for the
test hotkey below to be able to force the rare variant on demand rather
than waiting for a 1-in-20 roll. Resolves one of 7 outcomes in
`Game.applyJumpscareOutcome()`: nothing, steal a little time/EXP, a
speed buff, scare every Bayat away (knockback + stun), a free upgrade,
inverted controls (`player.invertControlsT`, a simple decrementing timer
checked in `Player.update()` — flips `dx`/`dy` before anything else uses
them; Reverse World's `invertControls` event field does the identical
flip, just gated on the active event instead of a timer), or force-
triggering a random event.

**Test hotkey**: press **J** anytime during a run to trigger a jumpscare
immediately, bypassing the per-second random roll — **Shift+J** forces
the rare Golden variant specifically (bound in `Game.bindInput()`,
guarded on `this.state === "playing"` and not already mid-jumpscare).
Exists purely so testing/tuning the outcome table or swapping the art
doesn't mean sitting around for up to ~18 minutes waiting for a real
one.

### Achievements — `ACHIEVEMENTS`

22 entries, persisted via `SaveSystem.getUnlockedAchievements()`/
`unlockAchievement()` as `{id: true}` (localStorage, safe-wrapped like
everything else in SaveSystem). `Game.checkAchievement(id)` is the ONE
call every trigger site uses — it's a no-op past the first unlock
(`SaveSystem.unlockAchievement()` returns `false`), so call sites never
need their own guard. Sprinkled at the moment each thing actually
happens (bomb hit in `Game.bombExplode()`, snowball hit in the snowball-
hit branch, 100/1000 lifetime hugs computed as `SaveSystem.
getLifetimeHugs() + this.hugs` since the persisted total only updates at
`endRun()`, Legendary chest in `ChestSystem.open()`, Guardian Hug save in
`tryGuardianSave()`, co-op revive in `mpUpdateReviveCheck()`, ...) rather
than centralized polling. `hidden: true` entries (jumpscare-related,
mimic jackpot) show "???" in the achievements screen
(`UI.renderAchievements()`, reachable from the main menu) until
unlocked. `Game.achievementsThisRun` feeds the results screen's
"Achievements Earned" row.

### Arena modifiers — `ARENA_MODIFIERS`

An optional per-run wildcard, independent of which arena you picked —
40% chance any modifier happens at all (`Game.rollRunModifier()`,
called from `startGame()`), then a weighted pick from 6
(`fastworld`, `tinyworld`, `richworld`, `dangerousworld`,
`infinitecombo`, `nochests`). Same philosophy as everything else here:
each field is read live at an existing hook point rather than inventing
new ones — `bayatSpeedMult`/`playerSpeedRunMult` fold into
`effectiveSpeed`/`Player.speed` right next to Hyper Mode's and Panic's
own multipliers, `bayatSizeMult` is read once at `Bayat` construction
(the modifier doesn't change mid-run, so baking it in at spawn is fine,
unlike the live-read speed multipliers), `rewardMult` folds into
`applyHugReward()`, `dangerWeightMult` into `pickType()`,
`infiniteCombo` just skips the decay check in `update()`, and
`noChests` early-returns `ChestSystem.update()`'s spawn call (paired
with a `rewardMult` bump on the same modifier so skipping chests isn't a
pure downgrade).

### World pickups — `PICKUP_DEFS`

7 kinds (`timeshard`, `megatimeshard`, `xpcrystal`, `comboorb`,
`luckorb`, `mysteryorb`, `chaosorb`) spawning periodically
(`CONFIG.pickups`) near the player and auto-collecting on proximity —
`Game.updatePickups()`/`spawnPickup()`/`collectPickup()`, deliberately
mirroring `ChestSystem`'s own spawn/open pattern (including reacting to
`player.magnetLevel` the same way chests do) rather than inventing a
different shape for "thing on the ground you walk up to." Drawn as a
simple bobbing pixel diamond (`drawPickup()`, render-helpers.js) rather
than pulling the `icons.png` DOM sprite sheet onto canvas — that sheet
was never loaded as a `Sprites` entry, and doing so just for small
ground items felt like more machinery than the payoff warranted; the
`icon` field on each `PICKUP_DEFS` entry is real (reused from
`ICON_SPRITE`) but currently unused by the canvas renderer — available
if a future pass wants to actually draw the icon instead of a diamond.
`mysteryorb` and `chaosorb` are grab-bags/wildcards (`collectPickup()`'s
`mystery`/`triggerEvent` branches) — always net-positive, per "random
does not mean unfair."

### Destructible decor

Two existing decor kinds (`rock`, `crystal` — already present across
multiple arenas' `decorKinds`, see `ARENAS`) become breakable on
proximity: `Game.updateDestructibles()` checks the player against every
un-broken rock/crystal in `Game.decor` each frame, and breaking one
(`d.broken = true`, `drawDecor()` just skips broken entries — no rubble
sprite) rolls a reward: ~45% small EXP/time, ~25% spawns a real
`PICKUP_DEFS` item on the spot, ~15% a temporary luck buff, ~15% nothing
— matching the spec's own "XP / time / buff / rare item / nothing" list.
No attack button — proximity IS the interaction, same philosophy as
hugging itself.

### Known gaps (Chaos Update)

- No full Bayat/weapon/buff/arena **codex/collection screen** — only
  Achievements got a dedicated persistent-unlock screen. A codex would
  reuse the exact same `SaveSystem`-backed-set pattern; scoped out for
  time, not because it's hard.
- **Bayat Stampede** (a wave charging in a line) from the original spec
  was folded into `bayatrush`'s spawn-density burst rather than built as
  genuine directional-wave AI — a real "everyone charges from one edge"
  behavior would need new movement logic in `Bayat.update()`, not just a
  spawn-rate multiplier.
- The **Chaos Bayat**'s "randomly switches abilities" is currently a
  cosmetic speed/tint re-roll + a wide random reward swing at hug-time,
  not literally cycling through other types' full behavior state
  machines (ranged throwing, bomb arming, etc.) — see its BAYAT_TYPES
  comment for why (per-instance overrides vs. the shared `type` object
  every Bayat of a kind points to made borrowing another type's stateful
  AI a much bigger change than the visual/reward version).
- **Mirror** (temporary player clone) and **Drone Buddy** (a companion
  that attacks/collects/stuns) from the original tool list weren't
  built — both need a genuinely new entity class + its own draw/update
  loop, closer in scope to Orbit Buddies than to a `fire()` case; every
  tool that DID ship reuses the existing pull/slow/freeze/orbit/missile
  primitives instead.
- `CONFIG.jumpscare.chancePerSecond`/`goldenChance` and every other new
  `CONFIG` block are real tunables, but none have been balance-tested
  against real playtime — treat the numbers as a reasonable first guess,
  not a verified-fun baseline.
- **Random events, Hyper Hug Mode, cursed items, achievements, world
  pickups, and destructible decor are not synced across co-op peers at
  all** — each client rolls/tracks these entirely independently (so two
  peers can be in different events, or one can be in Hyper Mode and the
  other not). This matches the existing "buffs/tools/chests stay local
  and personal" co-op design for everything EXCEPT random events, which
  really should feel shared (everyone seeing "BAYAT RUSH" together would
  be more fun than each player quietly getting their own). Wiring that
  up would mean the host broadcasting event start/end the same way it
  already broadcasts `start`/`bayatSnapshot` — a real gap, not a design
  choice, just not built yet. Magnet Storm's pull is host-guarded (see
  "Random events" above) specifically so this gap doesn't also cause
  visible position-fighting on non-host clients in the meantime.

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
  `BayatManager.update()`'s spawn anchor is NOT just the host's own
  `player` — it also gets `Object.values(Game.mpPeers)` as
  `extraSpawnAnchors` and picks randomly among all of them per spawn, so
  new Bayats populate near whichever player is actually exploring, not
  only around the host. **Per-Bayat AI targeting (chase/flee) still only
  reacts to the host's own `player`, not remote peers** — a Bayat spawned
  near a peer won't flee them, it'll just sit there until that peer's own
  local `checkHugs()` catches it. That's a real, known limitation (see
  "Known gaps"), not a bug — full "nearest of N players" targeting is a
  bigger change to `Bayat.update()` than a spawn-anchor fix.
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

### Transports: WebSocket relay vs peer-to-peer (READ THIS FIRST)

There are now TWO transports, selected by `CONFIG.coop.transport`
("auto" | "relay" | "p2p"). `Multiplayer.transport` says which is live.
Both present an identical surface — `selfId`, `peers`,
`onPeerJoin/onPeerLeave/onPeerProfile`, `send()`, `on()` — so **nothing
in `game.js` knows which one is running.** That was the whole point of
the abstraction; adding the relay needed zero changes to game logic.

**RELAY (recommended, `server/relay-server.js`)** — both players open an
OUTBOUND WebSocket to a server the user deploys (Deno Deploy: free, no
credit card). Outbound connections always work, so there is no NAT
traversal, no TURN, and no credentials at all. The relay is deliberately
dumb: it forwards messages within a room and holds no game state — the
host client remains the Bayat/hug authority exactly as before.

**P2P (Trystero, the original)** — kept as the fallback. Decentralized
signaling across ~45 nostr relays makes it much harder to block at a
national level than any single domain, which is why it wasn't deleted.
Its weakness is the NAT problem below.

In `"auto"` (the default) the relay is tried first and P2P is the
automatic fallback if it's unreachable — verified: a dead relay falls
back in ~2s, and `"relay"` mode correctly throws instead of masking a
broken deploy.

### Why the peer-to-peer path is unreliable across networks

Reported as: "co-op is really inconsistent, needs a lot of work to
connect, doesn't work if you aren't on the same network, and it's so
random it's hard to test." All of that is one root cause, and it is
**not** a bug in this codebase:

Connecting two peers is two separate steps, and only the first is
Trystero's job.

1. **Finding each other (signaling)** — done over public relays. This is
   what `CONFIG.coop.relayRedundancy` fixes (see bug history #12: the
   library default of 5 relays means two peers share zero relays about
   half the time). At 20 this step is now reliable, and the lobby's live
   readout (`● relays 16/20`) shows it working.
2. **The actual gameplay connection (WebRTC)** — a *direct* connection
   between the two machines, which has to punch through both players'
   routers. Trystero configures free STUN servers, which handle the
   easy NAT types. **STUN cannot traverse symmetric NAT**, which is
   common on mobile data and on plenty of consumer routers. When either
   side has one, the peers find each other fine and then simply never
   connect.

That is precisely why it "works on the same wifi" (no NAT traversal
needed) and is "random" across networks (depends on both players' NAT
types, which neither of you controls). **The only real fix is a TURN
server**, which relays the traffic when direct P2P fails.

**The setup here is Cloudflare TURN via a small Worker** (`worker/`,
opt-in, off by default). Two things made that the choice:

- **It survives restrictive networks.** Cloudflare offers TURN over TLS
  on port 443, which is indistinguishable from ordinary HTTPS. A network
  that blocks it blocks the web. This mattered more than raw
  reliability, because the requirement was "works for someone in, say,
  Iran" — see the note on centralized services below.
- **It's free at this scale.** 1,000 GB/month, and TURN only carries
  traffic when direct P2P fails.

Why a Worker rather than pasting credentials into `config.js`:
Cloudflare deliberately only issues SHORT-LIVED credentials, minted from
a long-term key that must stay server-side. `worker/turn-worker.js` is
that server side and nothing more — it holds the key as a secret, calls
Cloudflare's `generate-ice-servers` endpoint, and returns only the
short-lived result. `Multiplayer._fetchTurnServers()` calls it once per
session (cached), filters out the credential-less bare-STUN entry, and
hands the rest to Trystero as `turnConfig`.

`turnConfig` is used rather than `rtcConfig` on purpose: it ADDS to
Trystero's own default STUN servers instead of replacing the whole ICE
list, so we keep every path we had plus the new one.

**Every failure mode degrades to today's behaviour, never worse** —
Worker absent, misconfigured, unreachable, timing out (6s cap),
returning non-JSON, or returning no usable credentials all resolve to
"no TURN, plain P2P" with a console warning. Verified by testing each
case explicitly. `CONFIG.coop.turnServers` still exists alongside it for
providers that DO issue long-lived credentials (Metered, Twilio, Xirsys,
self-hosted coturn); the two are combined.

**A note on why NOT a centralized WebSocket relay** (Supabase Realtime,
PartyKit, Firebase): those would fix NAT completely and were seriously
considered. They were rejected because they concentrate the whole game
behind one company's domain, which is both trivially blockable at a
national level (Supabase was blocked country-wide in India in Feb 2026)
and subject to sanctions geo-blocking that would refuse some players
outright. Trystero's ~45 independent nostr relays are far harder to
block than any single vendor domain, so the P2P architecture is
deliberately KEPT and TURN bolted on, rather than replaced. If you ever
do move to a central relay, note that `Game` only touches 12
`Multiplayer.*` members and nothing outside `js/multiplayer.js`
references Trystero — the transport is genuinely swappable in one file.

**Making it testable:** `CONFIG.coop.debug` (on by default) logs the
room/relay/TURN setup on connect and drives a live status line in the
lobby — `● relays 16/20 · peers 1 · TURN off` — polled once a second by
`Game.mpStartLobbyPolling()` and rendered by `UI.renderMpConnStatus()`.
Green means signaling is up. If relays are green on both machines and
peers still reads 0 after ~10s, that is the NAT/TURN problem above, not
a code problem — which is the distinction that used to be impossible to
make from the outside.

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
- **Bayat AI only targets the host's own player**, never a remote peer —
  spawning is peer-aware (see above) but chase/flee behavior isn't. A
  Bayat that spawned near a peer just stands there rather than reacting
  to them, until that peer walks up and hugs it themselves.

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
12. Real-world report (not just sandbox testing): "Join" with a correct
    room code would silently create an empty room instead of connecting
    to the host — happened consistently enough to reproduce with a phone
    + two browser tabs, all genuinely online. Root cause: Trystero's
    nostr strategy only connects each client to `relayConfig.redundancy`
    relays (default **5**) picked randomly out of its ~45-relay pool —
    confirmed directly by inspecting `getRelaySockets()` after `joinRoom`
    with no config. Host and joiner each pick their own random 5, and by
    hypergeometric math two independent 5-of-45 picks share **zero**
    relays roughly **half the time** — with no shared relay, neither
    peer's signaling messages ever reach the other, and from the outside
    that's indistinguishable from "joining just doesn't work." Fixed by
    passing `relayConfig: {redundancy: 20}` to every `joinRoom()` call in
    `js/multiplayer.js` — connecting to 20-of-45 instead of 5-of-45 makes
    zero-overlap astronomically unlikely. Verified with fresh two-tab
    connections before vs. after (default: intermittent; redundancy 20:
    connected on every attempt tried). Don't lower this back down without
    re-verifying — it looks like an arbitrary magic number but it's
    load-bearing.
13. Real-world report, same test session as #12 (phone + browser tab,
    after the redundancy fix so connection itself was working): the
    non-host player saw no Bayats at all, only the host did. Diagnosed as
    a real design gap rather than a network bug — `BayatManager.update()`
    (host-only) picked its spawn anchor from ONLY `Game.player` (the
    host's own position); a joiner who wandered away from the host was
    exploring an area the host's spawner was never populating in the
    first place, snapshot delivery notwithstanding. Fixed by also passing
    `Object.values(Game.mpPeers)` in as `extraSpawnAnchors`, so new Bayats
    spawn near a randomly-picked player (host or peer) each time, not only
    the host. Bayat *AI* (chase/flee) still only reacts to the host's
    player — see "Known gaps" — so this fixes visibility/availability, not
    reactive behavior, near remote peers.
14. `gen_icons.py` saved to a hardcoded absolute path
    (`/home/claude/build2/assets/icons.png`) from whatever sandbox first
    generated this project — running it as-is would have silently written
    to a nonexistent directory instead of updating `assets/icons.png`.
    Never actually hit during normal development because nobody had
    needed to re-run it since the icon sheet was first committed — only
    surfaced when adding new icons required running it for real. Fixed to
    save relative to the script's own file location. `gen_assets.py` has
    the identical issue and is NOT fixed — nothing has needed to re-run it
    yet, so it's flagged here rather than silently left for the next
    person to rediscover.
15. (Chaos Update) `Game.grantCursedItem()` wrote to
    `this.cursedItemsTaken[item.id]` assuming that object already
    existed — it was only ever lazily created inside
    `Game.onChestOpened()`, so any other future call path (found by
    calling `grantCursedItem` directly while testing) threw. Fixed by
    making `cursedItemsTaken` a real top-level `Game` state field
    (initialized once, reset every `startGame()`) instead of a lazily-
    created one — the general lesson: a field only ever lazy-inited from
    one call site is a trap for the next call site.
16. (Chaos Update) Cursed items use `applyTempEffect()` with
    `duration: Infinity` to mean "rest of the run" (works correctly —
    `Infinity - dt` stays `Infinity`), but the Inventory "Temp Effects"
    tab called `e.remaining.toFixed(1)` unconditionally, which would
    have displayed the literal string "Infinitys". Fixed with a small
    `e.remaining === Infinity` special case in `UI.renderInventory()`.
    Caught by testing the actual rendered inventory, not just that the
    effect applied — the underlying game-logic bug (none) and the
    display bug (real) were two different questions.
17. (Chaos Update) The Time Stop event (`bayatSpeedMult: 0`, meant to
    freeze every Bayat solid) did nothing — `Bayat.effectiveSpeed`'s
    read site was `if (Game.activeEvent && Game.activeEvent.def.
bayatSpeedMult)`, a truthiness check, and `0` is falsy in JS, so the
    multiply was silently skipped exactly when the value mattered most.
    Every other event's `bayatSpeedMult` (1.7, 0.35, 1.3, ...) is
    non-zero, so this only ever affected Time Stop specifically — caught
    by testing each new event's actual numeric effect, not just that it
    ran without throwing. Fixed to `!== undefined`. General lesson:
    any multiplier field that's allowed to legitimately be `0` needs an
    explicit-undefined check at its read site, not a truthy one — a
    plain `if (x.mult)` guard silently breaks the one value that turns
    the effect all the way off.
18. (Chaos Update) The jumpscare VIDEO refused to play — `play()` always
    rejected with `AbortError: The play() request was interrupted
    because video-only background media was paused to save power`, so the
    scare showed a frozen first frame while the audio played fine. Two
    separate causes, both worth knowing:
    (a) **The `<video>` element was created but never attached to the
    DOM.** Chrome force-pauses muted, *video-only* media (a file with no
    audio track — which is exactly what a paired video+separate-audio
    setup produces) whenever it isn't actually being rendered. Drawing it
    to a canvas does NOT count as rendering it. Fixed by appending the
    element to `document.body`, parked as a ~2px, `opacity:0.01`,
    `z-index:-1`, `pointer-events:none` box — **do not "tidy" this into
    `display:none`, `visibility:hidden`, or `opacity:0`**, all three
    re-trigger the same heuristic and silently break playback again.
    (b) The remaining failures during testing were a red herring:
    `document.visibilityState === "hidden"` (the automated browser pane
    wasn't displayed), which legitimately pauses video-only media. That's
    not a bug — a backgrounded tab isn't rendering frames anyway — but it
    made the fix look like it hadn't worked. If you're ever debugging
    this again, log `document.visibilityState` FIRST before assuming the
    code is wrong.
19. (Chaos Update) Two rendering bugs in the video jumpscare path, both
    caught by actually looking at screenshots rather than just checking
    that it ran: (a) the shared stepped pop-in `scale` starts at 0.7,
    which shrank the fullscreen video below full coverage and
    letterboxed it with black bars — the video path now punches in from
    1.12x and settles to exactly 1.0x instead, same "slam into frame"
    beat with no exposed edge; (b) the Golden variant used an `overlay`
    composite for its gold tint, which massively amplifies contrast and
    turned a noisy/static video frame into an illegible gold mess — now
    a plain low-alpha (0.2) `source-over` wash, with the gold shadow glow
    doing most of the work.
20. Real-world report: the video jumpscare "shows a bit of the END of the
    clip, then restarts and plays the real scare." Root cause: assigning
    `video.currentTime = 0` starts an **asynchronous seek**, and a
    `<video>` keeps presenting its last decoded frame until that seek
    lands. `triggerJumpscare()` set `currentTime` and immediately began
    drawing, so the first few frames painted the PREVIOUS playthrough's
    final frame before snapping to the start. Fixed two ways, both
    needed: (a) `stopJumpscareMedia()` now rewinds to 0 when a scare
    ENDS, so the element is already parked on frame 0 long before the
    next one starts; (b) `Game.jumpscareVideoReady` gates drawing — set
    false at trigger, flipped true either immediately (already at 0) or
    on the `seeked` event, and `drawJumpscareOverlay()` paints plain
    black instead of a stale frame while it's false. Don't remove the
    gate: (a) alone still leaves the very first scare of a session, and
    any interrupted seek, able to show a stale frame.

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
  safe to delete, left in place only to avoid churn. **Don't confuse
  this with `CURSED_ITEMS`** (Chaos Update) — that's a separate, live,
  actually-wired-up system; the similar naming is coincidental (the old
  `CURSES` predates the Chaos Update entirely).

## Testing

No test suite — it's a small set of plain files, no build step. Minimum bar
for any change: `node --check` every `.js` file you touched (or all of them:
`for f in js/*.js; do node --check "$f"; done`). This only catches syntax
errors, not logic/runtime bugs — actually open `index.html` in a browser
and play a round. Given how much of this project's real bug history is
mobile-only (see above), testing on an actual phone before calling
something "done" is disproportionately valuable here.
