/* =========================================================
   CLOUDFLARE WORKER — TURN credential minter
   =========================================================
   Why this exists at all:

   Cloudflare's TURN service deliberately does NOT issue long-lived
   credentials. You hold one long-term "TURN key" and use it to mint
   short-lived username/password pairs on demand. That key must stay
   server-side — anyone who has it can spend your TURN bandwidth — so it
   cannot live in config.js or anywhere else the browser can read.

   This Worker is that server side, and it is the whole thing: it holds
   the key as a secret, calls Cloudflare's API, and hands the browser
   back only a short-lived credential.

   ---- WHAT IS AND ISN'T PROTECTED (read this) ----------------------
   SAFE: your long-term TURN key. It lives in Cloudflare's secret store
   (`wrangler secret put`), never in this repo, never in the browser.
   Nobody reading your GitHub Pages source or your git history can get
   it. That is the whole point of this file existing.

   PUBLIC BY NECESSITY: the Worker's URL (it's in js/config.js) and the
   short-lived credentials it returns (the player's browser needs them
   to talk to TURN, so they're visible in devtools). This is unavoidable
   for any browser-based WebRTC app — there is no way to give a browser
   a credential without the browser being able to see it.

   So the realistic goal is not "impossible to abuse", it's "bounded and
   inconvenient to abuse, and cheap even if someone tries". The defenses
   below do that:
     1. Origin is REQUIRED and allow-listed — blocks other websites and
        naive scripted access outright.
     2. Per-IP rate limiting — stops bulk credential harvesting.
     3. Short TTL — a leaked credential stops working within the hour.
     4. Cloudflare's own free tier (1,000 GB/mo) is the hard cost
        ceiling; see README for billing alerts.

   A determined attacker can still forge an Origin header. If you ever
   actually see abuse, the escalation path is in worker/README.md
   ("If you see abuse").

   The game degrades gracefully if this Worker is missing, broken, or
   unreachable — js/multiplayer.js catches the failure and simply plays
   without TURN. It never blocks a run.

   SETUP: see worker/README.md — about 5 minutes.
   ========================================================= */

// Which origins may call this Worker. EDIT THIS to match your real site
// before deploying. An origin is scheme + host + port, no trailing slash.
const ALLOWED_ORIGINS = [
  "https://disserhugger.github.io",
  "http://localhost:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8000",
];

// How long each minted credential stays valid.
// TRADEOFF: shorter limits how long a leaked credential is useful, but
// it must comfortably outlast a play session — TURN allocations are
// refreshed with these same credentials, so if they expire mid-game the
// relay drops and co-op breaks for players who need TURN. One hour is a
// safe default for this game's short runs. Don't go below ~15 min.
const CREDENTIAL_TTL_SECONDS = 3600;

// Per-IP rate limit. Legitimate use is one fetch per co-op session (the
// client caches for the whole session), so this is very generous while
// still making bulk harvesting impractical.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes

function corsHeaders(origin) {
  return {
    // Only ever echo an origin we've already validated — never "*",
    // which would let any site read the response.
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/* Crude per-IP rate limiter built on the Cache API so it needs no KV or
   Durable Object binding (keeps setup to "deploy and go"). Cache is
   per-datacenter rather than global, so the effective limit is per-colo
   — plenty for stopping harvesting, not a precise quota. Fails OPEN: if
   anything here throws, we allow the request rather than break co-op. */
async function rateLimited(request) {
  try {
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return false;
    const key = new Request(
      "https://ratelimit.internal/" + encodeURIComponent(ip),
      { method: "GET" },
    );
    const cache = caches.default;
    const hit = await cache.match(key);
    const count = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    if (count >= RATE_LIMIT_MAX) return true;
    await cache.put(
      key,
      new Response(String(count + 1), {
        headers: { "Cache-Control": "max-age=" + RATE_LIMIT_WINDOW_SECONDS },
      }),
    );
    return false;
  } catch (e) {
    return false; // never let the limiter itself break the game
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    // --- Origin is REQUIRED and must be allow-listed. ---
    // Note the missing-Origin case is rejected too. An earlier version
    // only checked `if (origin && !allowed)`, which meant a request with
    // NO Origin header (curl, scripts, anything non-browser) skipped the
    // check entirely and got credentials. Browsers always send Origin on
    // the cross-origin fetch this Worker is designed for, so requiring
    // it costs legitimate users nothing.
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      // No CORS headers on this path — nothing should be able to read
      // the body cross-origin anyway.
      return json(
        {
          error: "origin-not-allowed",
          hint: "Add your site's origin to ALLOWED_ORIGINS in worker/turn-worker.js",
        },
        403,
        {},
      );
    }

    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET") {
      return json({ error: "method-not-allowed" }, 405, headers);
    }

    if (await rateLimited(request)) {
      return json({ error: "rate-limited" }, 429, {
        ...headers,
        "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS),
      });
    }

    /* ---- MODE 1: static credentials (ExpressTURN, Metered, coturn…) ----
       Most TURN providers issue ONE long-lived username/password rather
       than a minting API. Serving them from here instead of putting them
       in js/config.js keeps them out of your public repo, and they still
       get the Origin allow-list and rate limiting above.

       Be clear-eyed about the limit: a long-lived credential handed to a
       browser is readable in that browser's devtools. This raises the
       bar (a casual repo reader sees only a URL) but can't make it
       secret. Rotate in your provider's dashboard if it's ever abused. */
    if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      const urls = env.TURN_URLS.split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      return new Response(
        JSON.stringify({
          iceServers: [
            {
              urls,
              username: env.TURN_USERNAME,
              credential: env.TURN_CREDENTIAL,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
          },
        },
      );
    }

    // ---- MODE 2: Cloudflare, minting short-lived credentials ----
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
      return json(
        {
          error: "worker-not-configured",
          hint:
            "Set either TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL (any provider), " +
            "or TURN_KEY_ID + TURN_KEY_API_TOKEN (Cloudflare). See worker/README.md",
        },
        500,
        headers,
      );
    }

    try {
      const res = await fetch(
        "https://rtc.live.cloudflare.com/v1/turn/keys/" +
          env.TURN_KEY_ID +
          "/credentials/generate-ice-servers",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env.TURN_KEY_API_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
        },
      );

      if (!res.ok) {
        // Deliberately does NOT forward Cloudflare's response body — it
        // can echo details about the key/account. Check the Worker's own
        // logs (`wrangler tail`) when debugging this.
        console.error("Cloudflare TURN API error", res.status);
        return json({ error: "cloudflare-api-error", status: res.status }, 502, headers);
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          // Private, not public: these are per-user credentials and must
          // not be stored by any shared/CDN cache.
          "Cache-Control": "private, no-store",
        },
      });
    } catch (e) {
      console.error("Worker exception", e);
      return json({ error: "worker-exception" }, 500, headers);
    }
  },
};
