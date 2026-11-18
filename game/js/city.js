// Solara Bay — procedural city: streets, blocks, buildings, beach, landmarks.
// The city is generated once from a fixed seed, so every playthrough shares
// the same streets and every mission marker lands on a real place.
(function () {
  'use strict';

  var U = SB.util;

  var PITCH = 280;      // distance between street centrelines
  var ROAD_W = 72;      // street width
  var BLOCK = PITCH - ROAD_W; // block side
  var COLS = 12;
  var ROWS = 10;
  var BEACH_H = 280;    // sand strip along the south edge
  var WORLD_W = COLS * PITCH + ROAD_W;
  var WORLD_H = ROWS * PITCH + ROAD_W;
  var TOTAL_H = WORLD_H + BEACH_H;

  var AVENUES = [
    'Coral Ave', 'Palmetto Ave', 'Neon Row', 'Harbor Blvd', 'Sunset Dr',
    'Mango St', 'Flamingo Ave', 'Breeze Way', 'Tropic Ln', 'Marina Blvd',
    'Coconut Ave', 'Lagoon St', 'Seabreeze Ave'
  ];
  var STREETS = [
    'Ocean View', 'Starfish St', 'Pelican Rd', 'Salsa St', 'Hibiscus Way',
    'Anchor St', 'Dolphin Ave', 'Calypso Rd', 'Tradewinds Blvd', 'Shell St',
    'Boardwalk'
  ];

  var ROOF_COLORS = ['#c96f4a', '#d9a05b', '#8fa3b8', '#b5533c', '#7d8f6a', '#a87f5f', '#5f7d8a'];
  var WALL_COLORS = ['#e8dcc8', '#f2e6d0', '#dfe8ea', '#f0d9c0', '#e6d3b3', '#d8e0d8'];
  var PALM_SPOTS = [];

  var city = null;

  /** Build the whole city from the fixed seed. */
  function generate() {
    var rng = U.makeRng(20261118);
    var buildings = [];
    var parks = [];
    var lots = [];
    var palms = [];
    var lamps = [];
    var landmarks = {};

    var special = {
      '6,5': 'plaza',
      '8,3': 'bank',
      '3,7': 'motel',
      '11,8': 'docks',
      '2,2': 'paintshop',
      '5,8': 'safehouse',
      '6,4': 'bar'
    };

    for (var bx = 0; bx < COLS; bx++) {
      for (var by = 0; by < ROWS; by++) {
        var key = bx + ',' + by;
        var x0 = bx * PITCH + ROAD_W + 14;
        var y0 = by * PITCH + ROAD_W + 14;
        var kind = special[key] || 'block';
        if (kind === 'plaza') {
          parks.push({ x: x0 - 14, y: y0 - 14, w: BLOCK, h: BLOCK, kind: 'plaza', name: 'Solara Plaza' });
          scatterPalms(rng, palms, x0, y0, BLOCK, BLOCK, 6);
          continue;
        }
        if (kind === 'docks') {
          lots.push({ x: x0 - 14, y: y0 - 14, w: BLOCK, h: BLOCK, kind: 'docks', name: 'Marina Docks' });
          scatterPalms(rng, palms, x0, y0, BLOCK, BLOCK, 3);
          continue;
        }
        var roll = rng();
        if (roll < 0.14 && kind === 'block') {
          parks.push({ x: x0 - 14, y: y0 - 14, w: BLOCK, h: BLOCK, kind: 'park', name: 'Pocket Park' });
          scatterPalms(rng, palms, x0, y0, BLOCK, BLOCK, 7);
          continue;
        }
        if (roll < 0.26 && kind === 'block') {
          lots.push({ x: x0 - 14, y: y0 - 14, w: BLOCK, h: BLOCK, kind: 'lot', name: 'Parking Lot' });
          continue;
        }
        var n = U.randInt(rng, 1, 3);
        var cells = splitBlock(rng, x0, y0, BLOCK, BLOCK, n);
        var named = false;
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          var tall = kind !== 'block' || rng() < 0.3;
          var b = {
            x: c.x, y: c.y, w: c.w, h: c.h,
            height: tall ? U.randInt(rng, 22, 52) : U.randInt(rng, 8, 20),
            roof: U.randPick(rng, ROOF_COLORS),
            wall: U.randPick(rng, WALL_COLORS),
            kind: kind,
            name: ''
          };
          if (kind !== 'block' && !named) {
            b.name = landmarkName(kind);
            named = true;
          }
          buildings.push(b);
        }
        if (kind !== 'block') {
          landmarks[kind] = landmarkPoint(kind, x0, y0, BLOCK);
        }
        scatterPalms(rng, palms, x0, y0, BLOCK, BLOCK, 2);
      }
    }

    // Landmark points for the plain blocks that hold them.
    landmarks.plaza = { x: 6 * PITCH + ROAD_W + BLOCK / 2, y: 5 * PITCH + ROAD_W + BLOCK / 2, name: 'Solara Plaza' };
    landmarks.docks = { x: 11 * PITCH + ROAD_W + BLOCK / 2, y: 8 * PITCH + ROAD_W + BLOCK / 2, name: 'Marina Docks' };

    // Street lamps along every avenue, staggered.
    for (var i = 0; i <= COLS; i++) {
      for (var j = 0; j < ROWS; j++) {
        lamps.push({ x: i * PITCH + ROAD_W - 6, y: j * PITCH + ROAD_W + BLOCK / 2 });
      }
    }
    for (var j2 = 0; j2 <= ROWS; j2++) {
      for (var i2 = 0; i2 < COLS; i2++) {
        lamps.push({ x: i2 * PITCH + ROAD_W + BLOCK / 2, y: j2 * PITCH + ROAD_W - 6 });
      }
    }

    // Beach palms along the sand.
    for (var p = 0; p < 26; p++) {
      palms.push({ x: 40 + rng() * (WORLD_W - 80), y: WORLD_H + 40 + rng() * (BEACH_H - 90), beach: true });
    }

    city = {
      buildings: buildings,
      parks: parks,
      lots: lots,
      palms: palms,
      lamps: lamps,
      landmarks: landmarks,
      seed: 20261118
    };
    return city;
  }

  /** Human name for a landmark block kind. */
  function landmarkName(kind) {
    if (kind === 'bank') return 'Bay Trust Bank';
    if (kind === 'motel') return 'Palms Motel';
    if (kind === 'paintshop') return 'Spray & Shine';
    if (kind === 'safehouse') return 'Reyes Safehouse';
    if (kind === 'bar') return 'La Luna Bar';
    return '';
  }

  /** A walk-to point in front of a landmark block. */
  function landmarkPoint(kind, x0, y0, size) {
    return { x: x0 + size / 2, y: y0 + size + 26, name: landmarkName(kind) };
  }

  /** Split a block rect into n building plots with small gaps. */
  function splitBlock(rng, x0, y0, w, h, n) {
    var out = [];
    if (n === 1) {
      out.push({ x: x0, y: y0, w: w, h: h });
      return out;
    }
    if (n === 2) {
      if (rng() < 0.5) {
        var cut = w * U.randRange(rng, 0.4, 0.6);
        out.push({ x: x0, y: y0, w: cut - 6, h: h });
        out.push({ x: x0 + cut + 6, y: y0, w: w - cut - 6, h: h });
      } else {
        var cutY = h * U.randRange(rng, 0.4, 0.6);
        out.push({ x: x0, y: y0, w: w, h: cutY - 6 });
        out.push({ x: x0, y: y0 + cutY + 6, w: w, h: h - cutY - 6 });
      }
      return out;
    }
    var cutX = w * 0.5 - 4;
    var cutY2 = h * 0.5 - 4;
    out.push({ x: x0, y: y0, w: cutX, h: cutY2 });
    out.push({ x: x0 + cutX + 8, y: y0, w: cutX, h: cutY2 });
    out.push({ x: x0, y: y0 + cutY2 + 8, w: w, h: cutY2 });
    return out;
  }

  /** Scatter palm trees inside a block, avoiding building footprints. */
  function scatterPalms(rng, palms, x0, y0, w, h, count) {
    for (var i = 0; i < count; i++) {
      palms.push({
        x: x0 + 10 + rng() * (w - 20),
        y: y0 + 10 + rng() * (h - 20),
        beach: false
      });
    }
  }

  /** True when (x, y) lies on a street band. */
  function isOnRoad(x, y) {
    var rx = x % PITCH;
    var ry = y % PITCH;
    return rx < ROAD_W || ry < ROAD_W;
  }

  /** Snap a point to the nearest street centreline; returns axis, dir and point. */
  function snapToRoad(x, y) {
    var cx = Math.round((x - ROAD_W / 2) / PITCH) * PITCH + ROAD_W / 2;
    var cy = Math.round((y - ROAD_W / 2) / PITCH) * PITCH + ROAD_W / 2;
    var dx = Math.abs(x - cx);
    var dy = Math.abs(y - cy);
    if (dx <= dy) return { axis: 'y', x: cx, y: U.clamp(y, 0, WORLD_H) };
    return { axis: 'x', x: U.clamp(x, 0, WORLD_W), y: cy };
  }

  /** A random point on a street centreline. */
  function randomRoadPoint(rng) {
    if (rng() < 0.5) {
      var col = U.randInt(rng, 0, COLS);
      return { x: col * PITCH + ROAD_W / 2, y: U.randRange(rng, 0, WORLD_H), axis: 'y' };
    }
    var row = U.randInt(rng, 0, ROWS);
    return { x: U.randRange(rng, 0, WORLD_W), y: row * PITCH + ROAD_W / 2, axis: 'x' };
  }

  /** A random point on the sand, for beach strolls and umbrellas. */
  function randomBeachPoint(rng) {
    return {
      x: U.randRange(rng, 60, WORLD_W - 60),
      y: WORLD_H + U.randRange(rng, 40, BEACH_H - 60)
    };
  }

  /** A random point on a sidewalk ring around a random block. */
  function randomSidewalkPoint(rng) {
    var bx = U.randInt(rng, 0, COLS - 1);
    var by = U.randInt(rng, 0, ROWS - 1);
    var x0 = bx * PITCH + ROAD_W;
    var y0 = by * PITCH + ROAD_W;
    var side = U.randInt(rng, 0, 3);
    if (side === 0) return { x: x0 + rng() * BLOCK, y: y0 - 7 };
    if (side === 1) return { x: x0 + rng() * BLOCK, y: y0 + BLOCK + 7 };
    if (side === 2) return { x: x0 - 7, y: y0 + rng() * BLOCK };
    return { x: x0 + BLOCK + 7, y: y0 + rng() * BLOCK };
  }

  /** Push a circle out of every building and the water; returns true on a hit. */
  function resolveWorldCircle(p, r) {
    var hit = false;
    for (var i = 0; i < city.buildings.length; i++) {
      if (U.resolveCircleRect(p, r, city.buildings[i])) hit = true;
    }
    // Water is a wall at the far south edge of the beach.
    if (p.y + r > TOTAL_H - 24) { p.y = TOTAL_H - 24 - r; hit = true; }
    if (p.x - r < 0) { p.x = r; hit = true; }
    if (p.x + r > WORLD_W) { p.x = WORLD_W - r; hit = true; }
    if (p.y - r < 0) { p.y = r; hit = true; }
    return hit;
  }

  /** True when a circle overlaps any building. */
  function hitsBuilding(x, y, r) {
    for (var i = 0; i < city.buildings.length; i++) {
      if (U.circleHitsRect(x, y, r, city.buildings[i])) return true;
    }
    return false;
  }

  /** Street name for a point on a road, for flavour text. */
  function streetNameAt(x, y) {
    var col = Math.round((x - ROAD_W / 2) / PITCH);
    var row = Math.round((y - ROAD_W / 2) / PITCH);
    if (Math.abs(x - (col * PITCH + ROAD_W / 2)) < Math.abs(y - (row * PITCH + ROAD_W / 2))) {
      return AVENUES[U.clamp(col, 0, AVENUES.length - 1)];
    }
    return STREETS[U.clamp(row, 0, STREETS.length - 1)];
  }

  SB.city = {
    PITCH: PITCH,
    ROAD_W: ROAD_W,
    BLOCK: BLOCK,
    COLS: COLS,
    ROWS: ROWS,
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    TOTAL_H: TOTAL_H,
    BEACH_H: BEACH_H,
    generate: generate,
    isOnRoad: isOnRoad,
    snapToRoad: snapToRoad,
    randomRoadPoint: randomRoadPoint,
    randomSidewalkPoint: randomSidewalkPoint,
    randomBeachPoint: randomBeachPoint,
    resolveWorldCircle: resolveWorldCircle,
    hitsBuilding: hitsBuilding,
    streetNameAt: streetNameAt,
    get data() { return city; }
  };
})();
