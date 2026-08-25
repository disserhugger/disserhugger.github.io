"use strict";

/* =========================================================
   ASSET CONFIGURATION
   Edit these paths to swap in different art. If either PNG
   fails to load (missing file, blocked network, etc.) the game
   automatically falls back to procedurally drawn characters —
   nothing ever crashes because of a missing image.
   ========================================================= */
const ASSETS = {
  player: "assets/gohid.png",
  bayat: "assets/nanbaiat.png",
  buddy: "assets/buddy.png",
};

const Sprites = {
  player: null,
  bayat: null,
  buddy: null,
  playerLoaded: false,
  bayatLoaded: false,
  buddyLoaded: false,
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
