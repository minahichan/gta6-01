// Solara Bay — shared helpers.
// Every game module attaches itself to the SB namespace defined here.
window.SB = window.SB || {};

(function () {
  'use strict';

  /** Clamp a number into [lo, hi]. */
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /** Linear interpolation between a and b by t. */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Squared distance between two points. */
  function dist2(ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  }

  /** Distance between two points. */
  function dist(ax, ay, bx, by) {
    return Math.sqrt(dist2(ax, ay, bx, by));
  }

  /** Angle from (ax, ay) toward (bx, by). */
  function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  }

  /** Shortest signed turn from angle a toward angle b. */
  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /** Move angle a toward b by at most step radians. */
  function angleStep(a, b, step) {
    var d = angleDiff(a, b);
    if (d > step) return a + step;
    if (d < -step) return a - step;
    return b;
  }

  /** Deterministic seeded random generator (mulberry32). */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Random float in [lo, hi) from a rng function. */
  function randRange(rng, lo, hi) {
    return lo + rng() * (hi - lo);
  }

  /** Random integer in [lo, hi] from a rng function. */
  function randInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  /** Pick a random element from an array with a rng function. */
  function randPick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  /** True when circle (cx, cy, r) overlaps axis-aligned rect r. */
  function circleHitsRect(cx, cy, r, rect) {
    var nx = clamp(cx, rect.x, rect.x + rect.w);
    var ny = clamp(cy, rect.y, rect.y + rect.h);
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  /** Push a circle out of a rect; returns true when a push happened. */
  function resolveCircleRect(p, r, rect) {
    var nx = clamp(p.x, rect.x, rect.x + rect.w);
    var ny = clamp(p.y, rect.y, rect.y + rect.h);
    var dx = p.x - nx, dy = p.y - ny;
    var d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 > 0.0001) {
      var d = Math.sqrt(d2);
      p.x = nx + (dx / d) * r;
      p.y = ny + (dy / d) * r;
    } else {
      // Centre inside the rect: push out along the smallest penetration axis.
      var left = p.x - rect.x, right = rect.x + rect.w - p.x;
      var top = p.y - rect.y, bottom = rect.y + rect.h - p.y;
      var m = Math.min(left, right, top, bottom);
      if (m === left) p.x = rect.x - r;
      else if (m === right) p.x = rect.x + rect.w + r;
      else if (m === top) p.y = rect.y - r;
      else p.y = rect.y + rect.h + r;
    }
    return true;
  }

  /** Format a cash amount as $1,250. */
  function formatMoney(n) {
    return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** Format seconds as M:SS. */
  function formatTime(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /** Move a value toward a target by at most step. */
  function toward(v, target, step) {
    if (v < target) return Math.min(target, v + step);
    if (v > target) return Math.max(target, v - step);
    return v;
  }

  /** Shallow copy of own enumerable props. */
  function extend(target, src) {
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  SB.util = {
    clamp: clamp,
    lerp: lerp,
    dist: dist,
    dist2: dist2,
    angleTo: angleTo,
    angleDiff: angleDiff,
    angleStep: angleStep,
    makeRng: makeRng,
    randRange: randRange,
    randInt: randInt,
    randPick: randPick,
    circleHitsRect: circleHitsRect,
    resolveCircleRect: resolveCircleRect,
    formatMoney: formatMoney,
    formatTime: formatTime,
    toward: toward,
    extend: extend
  };
})();
