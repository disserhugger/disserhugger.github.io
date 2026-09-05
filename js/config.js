"use strict";

/* =========================================================
   ★ CONFIG — START HERE IF YOU WANT TO CHANGE THINGS ★
   =========================================================
   This file is the tuning surface for the whole game. It holds the two
   things you're most likely to want to edit:

     ASSETS  — file paths for art/video/audio (swap in your own)
     CONFIG  — every gameplay number, grouped by system

   It loads FIRST (before every other script — see index.html), so
   everything else in the project can read these. Nothing in here depends
   on any other file, which is exactly why it can sit at the front of the
   load order.

   Changing a number here should never require touching game logic. If
   you find yourself wanting to tune something that's hardcoded elsewhere,
   the right fix is to move it here, not to edit it in place.
   ========================================================= */

/* ---------------------------------------------------------
   ASSETS — swap in your own art/media by changing these paths.
   Every one of these is optional in the sense that a missing or broken
   file NEVER crashes the game: sprites fall back to procedurally drawn
   characters, and the jumpscare falls back video -> PNG -> hand-drawn.
   --------------------------------------------------------- */
const ASSETS = {
  // --- sprites (PNG; any size, drawn scaled — pixel art recommended) ---
  player: "assets/gohid.png",
  bayat: "assets/nanbaiat.png", // ONE sprite for every Bayat type; colors come from SpriteTint
  buddy: "assets/buddy.png", // Orbit Buddies companion
  jumpscare: "assets/jumpscare.png", // the "Mr. Squeeze" mascot still-image

  // --- optional jumpscare media (set to null to disable either one) ---
  // VIDEO: plays fullscreen instead of the PNG. Any web-playable format
  // (mp4/webm). Its own audio track is always muted — sound comes from
  // jumpscareSound below (or the built-in procedural sting), so autoplay
  // policy can never silently kill the scare.
  jumpscareVideo: "assets/foxi-video.mp4",
  // SOUND: replaces the built-in procedural sting. mp3/m4a/aac-in-mp4/ogg.
  jumpscareSound: "assets/foxi-audio.mp4",
};

/* ---------------------------------------------------------
   CONFIG — all gameplay numbers, grouped by the system that reads them.
   --------------------------------------------------------- */
const CONFIG = {
  arena: { width: 4200, height: 4200 },
  player: {
    baseSpeed: 265,
    baseHugRadius: 32,
    baseExpMult: 1,
    baseLuck: 1,
  },
  arcade: { duration: 60 },
  full: {
    startTime: 60,
    maxTimeStart: 60,
    maxTimeFloor: 9,
    maxTimeDecayPerSec: 0.018,
    rewardTau: 130,
    rewardMinFactor: 0.01,
    baseTimeReward: 2.2,
  },
  combo: {
    window: 1.55,
    bonusPerLevel: 0.05,
    maxBonus: 0.75,
    // Milestones fire once per run the FIRST time combo reaches each
    // threshold (Game.comboMilestonesHit tracks which). Hyper Hug Mode
    // (x100) isn't just another milestone — see hyperMode below.
    milestones: [5, 10, 25, 50],
    hyperThreshold: 100,
  },
  leveling: { baseExp: 12, growth: 1.16 },
  spawn: {
    initialCount: 9,
    maxCount: 100,
    baseInterval: 1.05,
    minInterval: 0.22,
    rampDuration: 220,
  },
  bayatBaseSpeed: 118,
  bayatBaseRadius: 20,

  // ---- per-Bayat-ability tunables ----
  boost: {
    duration: 8,
  },
  snowball: {
    keepDistance: 260, // tries to stay at least this far from the player
    detectionRange: 620,
    throwCooldown: 2.6,
    projectileSpeed: 330,
    projectileLife: 2.2,
    slowAmount: 0.4, // 40% slower
    slowDuration: 3,
  },
  bomb: {
    detectionRange: 560,
    triggerRadius: 150, // starts arming once this close to the player
    cancelRadius: 210, // backing off past this cancels the countdown
    warningDuration: 1.1,
    criticalDuration: 0.6,
    explosionRadius: 170,
    explosionTimeDamage: 5,
    explosionKnockback: 260,
    movementSpeedMult: 0.85,
  },
  slip: {
    stunDuration: 0.9,
  },

  // ---- "Chaos Update" systems — each its own block so balance passes
  // never mean hunting for magic numbers inline. See CLAUDE.md's
  // "Chaos Update" section for how these systems fit together. ----
  hyperMode: {
    duration: 9, // seconds of Hyper Hug Mode once triggered
    speedMult: 1.35,
    cooldownMult: 0.6, // tools fire 40% faster
    rewardMult: 1.6,
    spawnRateMult: 1.6, // Bayats spawn faster/denser — more chaos, more targets
  },
  events: {
    // First roll waits this long so a run has time to breathe; every
    // roll after that is re-scheduled for [minGap,maxGap).
    firstDelay: 18,
    minGap: 22,
    maxGap: 38,
  },
  jumpscare: {
    // A small per-second chance while playing. At 0.0009/sec that's
    // roughly one scare per ~18 minutes of actual play on average
    // (memoryless — could be sooner, could be later), deliberately rare
    // enough to stay a genuine surprise.
    // >> Turn this up (e.g. 0.05) if you want to see it often while testing,
    //    or just press J in-game — see the test hotkeys in CLAUDE.md.
    chancePerSecond: 0.0009,
    goldenChance: 0.05, // of the scares that DO fire, 5% are the rare Golden variant
    freezeDuration: 0.55,
    visibleDuration: 1.1,
    // When a jumpscare VIDEO/SOUND asset is set (see ASSETS above), the
    // scare stretches to that media's real length so it isn't cut off
    // mid-scream — see Game.jumpscareDuration(). These two bound it:
    // never shorter than the built-in timing, never long enough that a
    // wrongly-sized file locks up the run. Set useMediaDuration:false to
    // always use the static timing above instead.
    useMediaDuration: true,
    maxMediaDuration: 6,
  },
  pickups: {
    spawnInterval: 5.5, // a new field pickup appears roughly this often
    maxOnField: 6,
    collectRadius: 30,
  },
  cursedChest: {
    // Rolled independently of normal chest-tier weighting — see
    // ChestSystem/Game.onChestOpened. A cursed chest replaces the
    // chest's usual picks with ONE high-risk/high-reward CURSED_ITEMS
    // entry instead.
    chance: 0.05,
  },
  tesla: {
    tickInterval: 2.2,
    chainCount: 3,
  },
  timebomb: {
    fuseDuration: 1.6,
    explosionRadius: 200,
  },

  // ---- co-op multiplayer (see js/multiplayer.js + CLAUDE.md) ----
  coop: {
    /* ★★★ CO-OP SETUP — THIS IS THE ONE SETTING THAT MATTERS ★★★
       ------------------------------------------------------------------
       Set this to your deployed relay and co-op works reliably between
       any two players, on any networks, with no credentials anywhere.

       Why it works when peer-to-peer doesn't: P2P asks two players'
       routers to accept a DIRECT connection, and many routers (and most
       mobile carriers) refuse — that's the "works on the same wifi,
       random across networks" problem. With a relay, both players make
       an OUTBOUND connection instead, exactly like loading a web page.
       Outbound always works.

       Your game stays on GitHub Pages either way — the relay is just
       something the page connects out to.

       SETUP: see MULTIPLAYER.md (about 5 minutes, free, no credit card).
       Short version:
         cd worker && npx wrangler login && npx wrangler deploy
       then paste the printed URL here as wss:// (NOT https://):

         relayUrl: "wss://bayat-coop-relay.YOUR-SUBDOMAIN.workers.dev",

       Left null, co-op falls back to peer-to-peer, which often fails
       between different networks. */
    relayUrl: "wss://bayat-coop-relay.bayathugger.workers.dev",

    /* "auto"  — use relayUrl if set, else peer-to-peer; if the relay is
                 unreachable, quietly fall back to P2P.
       "relay" — relay only, fail loudly if down (good for testing).
       "p2p"   — ignore relayUrl, always peer-to-peer (old behaviour). */
    transport: "auto",

    /* ---- Everything below only matters for the PEER-TO-PEER path ----
       If you set relayUrl above, you can ignore all of it (including the
       whole TURN section — a relay makes TURN unnecessary). */

    // How many of Trystero's ~45 public relays to connect to. Host and
    // joiner each pick their own random subset, and they can only find
    // each other through a relay BOTH happen to be on — at the library's
    // default of 5 that overlap fails roughly half the time, which reads
    // as "joining randomly doesn't work". Higher = far more reliable,
    // at the cost of more websocket connections. Don't lower this
    // without re-testing joins repeatedly. See CLAUDE.md bug history.
    relayRedundancy: 20,

    /* Tick rates. Higher = less staleness = tighter feel, at the cost of
       more messages. These were raised (12->20, 8->15) only AFTER
       snapshot culling below cut the payload ~68%, so the faster rates
       still cost LESS total bandwidth than the old slow ones did.
       Cloudflare bills inbound WebSocket messages at 20:1, so even at
       these rates a 2-player run is only ~2.8 billed requests/sec. */
    playerStateHz: 20, // how often you broadcast your own position
    bayatSnapshotHz: 15, // how often the host broadcasts Bayat positions

    /* Snapshot culling: only Bayats near SOME player are sent. The real
       radius is computed per-frame as (half the screen diagonal +
       margin), so it adapts to the player's actual window instead of
       assuming a size — a fixed radius either saves nothing on a small
       screen or clips visible Bayats on an ultrawide.

       The margin is the off-screen buffer. It has to exceed roughly
       (Bayat speed x snapshot interval) so something entering the radius
       has finished its spawn-in animation well before it's on screen;
       300px is ~2.5s of travel at base Bayat speed. */
    snapshotCullMargin: 300,
    snapshotCullMin: 900, // floor, so a tiny window still gets useful lookahead

    /* Remote things (Bayats and other players) are rendered this many ms
       IN THE PAST, interpolating between two snapshots that actually
       arrived — rather than extrapolating a guess forward.

       This is the standard approach for a reason: Bayats steer randomly
       every frame, so projecting a straight line ahead of one overshoots
       and snaps back on every turn (that's rubber-banding). Rendering
       slightly late is always smooth and never wrong.

       Must exceed one snapshot interval (1000/bayatSnapshotHz = ~67ms)
       with headroom for jitter, or the buffer runs dry and motion
       stutters. Too high just adds needless visual delay. ~100ms is the
       usual sweet spot; it costs nothing mechanically because hug
       arbitration only asks the host whether a Bayat is still ALIVE,
       never how close you were standing. */
    interpDelayMs: 100, // used only when adaptiveInterp is false

    /* Adaptive interpolation delay (recommended). Instead of trusting a
       fixed number, Game.mpInterpDelay() sizes the buffer from the
       connection's MEASURED jitter: one snapshot interval + 2x jitter.

       This matters more than average ping. A real measurement on this
       game's relay read 151ms ping but 65ms jitter with spikes to 315ms
       — against that, a fixed 100ms buffer empties on every spike and
       stutters, while a connection with 5ms jitter gets a needlessly
       stale 100ms for no reason. Press N in a co-op run to see both
       numbers live. */
    adaptiveInterp: true,
    interpDelayMinMs: 80,
    interpDelayMaxMs: 260,

    // How often the netcode HUD measures round-trip time (press N in a
    // co-op run to show it). One tiny message per interval.
    pingIntervalMs: 2000,
    reviveRadius: 46,
    reviveTimeFraction: 0.4, // revived teammates come back with this much of max time

    // Logs relay/peer-connection state to the console during co-op, and
    // shows a live status line in the lobby. Leave on while testing —
    // it turns "it randomly doesn't work" into an actual diagnosis.
    debug: true,
  },
};
