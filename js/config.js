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
    /* ★★★ THE RELIABLE OPTION — START HERE ★★★
       ------------------------------------------------------------------
       Set this and co-op just works, everywhere, with NO TURN server and
       NO credentials of any kind to manage, protect, or leak.

       Why it works when peer-to-peer doesn't: P2P asks two players'
       routers to accept a DIRECT connection, and many routers (and most
       mobile carriers) refuse — that's the "works on the same wifi,
       random across networks" problem. With a relay, both players make
       an OUTBOUND connection instead, exactly like loading a web page.
       Outbound always works. Nothing to traverse, nothing to
       authenticate, nothing secret to store.

       SETUP (~3 minutes, free, no credit card):
         1. https://console.deno.com — sign in with GitHub
            (NOT dash.deno.com — that's the retired "Deploy Classic",
             whose signup is closed and returns 403 SIGNUP_UNAVAILABLE)
         2. New Playground, paste server/relay-server.js, deploy
         3. Put the URL here as wss:// (NOT https://)

         relayUrl: "wss://your-app.deno.dev",

       Deno Deploy's free tier (~1M requests, 100 GB/month) is far beyond
       what this game uses. Any WebSocket-capable host works — the server
       is ~150 lines and holds no state. */
    relayUrl: null,

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

    /* ★★ TURN — THE FIX FOR "CO-OP ONLY WORKS ON THE SAME WIFI" ★★
       ------------------------------------------------------------------
       Relays (above) only handle the *introduction*. Once two peers have
       found each other, the actual gameplay connection is direct WebRTC,
       which has to punch through both players' routers. STUN (free,
       automatic) handles the easy NAT types. It CANNOT handle symmetric
       NAT — very common on mobile data and plenty of home routers. When
       either side has one, the peers find each other fine and then
       simply never connect.

       That is exactly the "works on the same network, random across
       networks, impossible to test" behaviour: it depends on the NAT
       types of the two specific players, which neither of you controls.
       A TURN server (which *relays* traffic when direct fails) is the
       only real fix.

       FULL SETUP GUIDE: worker/README.md (provider comparison + steps).

       ---- Option A: paste credentials here (simplest, ~5 minutes) ----
       Sign up with a TURN provider that has a free tier and issues a
       fixed username/password, then fill this in:

         - ExpressTURN  https://www.expressturn.com/   1000 GB/mo free
         - Metered      https://www.metered.ca/tools/openrelay/  20 GB/mo

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

       Listing several providers is fine and gives redundancy if one is
       blocked or down.

       TRADEOFF: credentials put here are visible in your public repo and
       in players' devtools. For a free-tier account that's usually an
       acceptable risk (bounded quota, rotatable) — but if you'd rather
       keep them out of the repo, use Option B. */
    turnServers: [],

    /* ---- Option B: serve credentials from an endpoint instead ----
       Point this at the small endpoint in worker/ and your repo contains
       only a URL. It works with any provider, and also supports
       Cloudflare's short-lived-credential API (the only genuinely
       expiring option, but Cloudflare signup requires a credit card).
       Deployable to Cloudflare Workers, Deno Deploy, Val Town, etc. */
    turnCredentialsUrl: null, // e.g. "https://bayat-turn.you.workers.dev"

    playerStateHz: 12, // how often you broadcast your own position
    bayatSnapshotHz: 8, // how often the host broadcasts Bayat positions
    reviveRadius: 46,
    reviveTimeFraction: 0.4, // revived teammates come back with this much of max time

    // Logs relay/peer-connection state to the console during co-op, and
    // shows a live status line in the lobby. Leave on while testing —
    // it turns "it randomly doesn't work" into an actual diagnosis.
    debug: true,
  },
};
