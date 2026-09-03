"use strict";

/* =========================================================
   CORE — asset loading + shared utilities + SpriteTint.
   =========================================================
   Asset PATHS and every tunable number live in js/config.js (ASSETS /
   CONFIG), which loads before this file. This file is the machinery
   that consumes them: loaders with graceful fallbacks, math helpers,
   and the alpha-safe recolor system. Nothing here needs editing to
   swap art — change ASSETS in config.js instead.
   ========================================================= */

const Sprites = {
  player: null,
  bayat: null,
  buddy: null,
  jumpscare: null,
  playerLoaded: false,
  bayatLoaded: false,
  buddyLoaded: false,
  jumpscareLoaded: false,
};
function loadSprite(key, src) {
  const img = new Image();
  img.onload = () => {
    Sprites[key + "Loaded"] = true;
  };
  img.onerror = () => {
    Sprites[key + "Loaded"] = false;
  };
  img.src = src;
  Sprites[key] = img;
}
loadSprite("player", ASSETS.player);
loadSprite("bayat", ASSETS.bayat);
loadSprite("buddy", ASSETS.buddy);
loadSprite("jumpscare", ASSETS.jumpscare);

/* =========================================================
   OPTIONAL MEDIA (video / audio) — same graceful-degradation contract as
   loadSprite() above: if a file is absent, unreachable, or undecodable,
   the corresponding *Loaded flag just stays false and every consumer
   falls back to the built-in procedural version. Nothing here ever
   throws into the game loop.

   Both are opt-in — ASSETS.jumpscareVideo/jumpscareSound default to
   null, in which case these do nothing at all and no network request is
   made.
   ========================================================= */
const Videos = { jumpscare: null, jumpscareLoaded: false };
const Sounds = { jumpscare: null, jumpscareLoaded: false };

function loadVideo(store, key, src) {
  if (!src) return; // opt-in only — no path configured, nothing to do
  try {
    const v = document.createElement("video");
    v.muted = true; // audio comes from AudioSystem, never the video track (autoplay-safe)
    v.playsInline = true;
    v.preload = "auto";
    v.loop = false;
    // 'canplaythrough' (not 'loadeddata') so the first play() doesn't
    // stall mid-scare on a slow connection.
    v.addEventListener("canplaythrough", () => {
      store[key + "Loaded"] = true;
    });
    v.addEventListener("error", () => {
      store[key + "Loaded"] = false;
    });
    v.src = src;
    // The element MUST be attached to the DOM and actually rendered, even
    // though we only ever paint it onto the canvas ourselves. Chrome
    // force-pauses muted, video-only media (no audio track) that isn't
    // being displayed — "video-only background media was paused to save
    // power" — which silently kills playback and leaves you with a frozen
    // first frame. `display:none`/`visibility:hidden`/`opacity:0` all
    // still count as "not rendered" for that heuristic, so this parks it
    // as a ~1px, barely-opaque, non-interactive element behind everything
    // instead. Do NOT "clean this up" into display:none — see CLAUDE.md
    // bug history.
    v.style.cssText =
      "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;" +
      "pointer-events:none;z-index:-1;";
    const attach = () => {
      if (document.body && !v.isConnected) document.body.appendChild(v);
    };
    if (document.body) attach();
    else window.addEventListener("DOMContentLoaded", attach);
    store[key] = v;
  } catch (e) {
    store[key + "Loaded"] = false;
  }
}
function loadSound(store, key, src) {
  if (!src) return; // opt-in only
  try {
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("canplaythrough", () => {
      store[key + "Loaded"] = true;
    });
    a.addEventListener("error", () => {
      store[key + "Loaded"] = false;
    });
    a.src = src;
    store[key] = a;
  } catch (e) {
    store[key + "Loaded"] = false;
  }
}
loadVideo(Videos, "jumpscare", ASSETS.jumpscareVideo);
loadSound(Sounds, "jumpscare", ASSETS.jumpscareSound);

/* =========================================================
   UTILITIES
   ========================================================= */
const TAU = Math.PI * 2;
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
/* Snaps a 0..1 progress value to a fixed number of discrete steps, so
   animations feel like limited-frame pixel-art rather than smooth
   CSS-style interpolation. e.g. quantize(0.42, 4) -> 0.25 (step 2 of 4). */
function quantize(t, steps) {
  return Math.floor(clamp(t, 0, 0.9999) * steps) / steps;
}
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function dist(ax, ay, bx, by) {
  const dx = ax - bx,
    dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx,
    dy = ay - by;
  return dx * dx + dy * dy;
}
function fmtTime(s) {
  return s.toFixed(1);
}

function weightedPick(items) {
  let total = 0;
  for (const it of items) total += it.weight;
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.item;
  }
  return items[items.length - 1].item;
}
// Escapes text that came from another peer (username, chat, etc.) before
// it's dropped into innerHTML — in multiplayer this is untrusted input
// from someone else's browser over a WebRTC data channel, not just a
// display-formatting nicety.
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
