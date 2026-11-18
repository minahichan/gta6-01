// Solara Bay — pedestrians: sidewalk strollers who flee gunfire and traffic.
// They make the city feel alive and give the wanted system something to react to.
(function () {
  'use strict';

  var U = SB.util;
  var C = null;

  var SHIRTS = ['#e2574c', '#4c8de2', '#e2b84c', '#6ab86a', '#9a6ad1', '#e28ab0', '#4cc2c2', '#f0f0f0'];
  var SKINS = ['#f2c9a0', '#d9a066', '#a8763e', '#f7d7b5', '#8a5a2b'];

  var list = [];
  var rng = U.makeRng(4242);

  /** Spawn the starting crowd around the plaza. */
  function createWorld() {
    C = SB.city;
    list = [];
    for (var i = 0; i < 26; i++) spawnPed(true);
  }

  /** Make one pedestrian at a sidewalk point. */
  function makePed(x, y) {
    return {
      x: x, y: y,
      angle: rng() * Math.PI * 2,
      speed: U.randRange(rng, 28, 55),
      shirt: U.randPick(rng, SHIRTS),
      skin: U.randPick(rng, SKINS),
      target: null,
      state: 'walk', // walk | flee | down | gone
      stateT: 0,
      bob: rng() * Math.PI * 2
    };
  }

  /** Spawn a pedestrian somewhere near the player (or anywhere at start). */
  function spawnPed(anywhere) {
    var p = SB.player ? SB.player.state : null;
    var pt;
    var tries = 0;
    do {
      pt = C.randomSidewalkPoint(rng);
      tries++;
    } while (!anywhere && p && U.dist(pt.x, pt.y, p.x, p.y) < 320 && tries < 10);
    var ped = makePed(pt.x, pt.y);
    ped.target = C.randomSidewalkPoint(rng);
    list.push(ped);
    return ped;
  }

  /** A carjacked driver bails out and sprints away screaming. */
  function spawnFleeingDriver(x, y) {
    var ped = makePed(x, y);
    ped.state = 'flee';
    ped.stateT = 3;
    ped.speed = 190;
    list.push(ped);
    return ped;
  }

  /** Scare every pedestrian near a point (gunshot, crash, siren). */
  function scareNear(x, y, radius) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.state === 'walk' && U.dist(p.x, p.y, x, y) < radius) {
        p.state = 'flee';
        p.stateT = U.randRange(rng, 2, 4);
        p.speed = U.randRange(rng, 150, 210);
        p.target = { x: p.x + (p.x - x), y: p.y + (p.y - y) };
      }
    }
  }

  /** A punch lands on a ped within range of (x, y); returns true on a hit. */
  function punchAt(x, y, range) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.state === 'down') continue;
      if (U.dist(p.x, p.y, x, y) < range) {
        knockDown(p);
        return true;
      }
    }
    return false;
  }

  /** A bullet hits a ped at (x, y); returns true on a hit. */
  function bulletHit(x, y) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.state === 'down') continue;
      if (U.dist(p.x, p.y, x, y) < 14) {
        knockDown(p);
        return true;
      }
    }
    return false;
  }

  /** Knock a pedestrian down; they get up and flee after a moment. */
  function knockDown(p) {
    p.state = 'down';
    p.stateT = 1.6;
    SB.render.burst(p.x, p.y, '#ff5b5b', 8);
  }

  /** A car just hit a ped: they tumble and the crowd scatters. */
  function carHit(ped) {
    knockDown(ped);
    scareNear(ped.x, ped.y, 260);
  }

  /** How many pedestrians stand within radius of a point. */
  function countNear(x, y, radius) {
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      if (U.dist(list[i].x, list[i].y, x, y) < radius) n++;
    }
    return n;
  }

  /** Per-frame update: walking, fleeing, getting up, respawning the crowd. */
  function update(dt) {
    var player = SB.player.state;
    var car = SB.cars.getPlayerCar();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      p.bob += dt * 8;
      if (p.state === 'down') {
        p.stateT -= dt;
        if (p.stateT <= 0) {
          p.state = 'flee';
          p.stateT = 3;
          p.speed = 180;
        }
        continue;
      }
      if (p.state === 'flee') {
        p.stateT -= dt;
        if (p.stateT <= 0) {
          p.state = 'walk';
          p.speed = U.randRange(rng, 28, 55);
          p.target = C.randomSidewalkPoint(rng);
        }
      }
      // Run from a speeding player car.
      if (car && Math.abs(car.speed) > 150 && U.dist(p.x, p.y, car.x, car.y) < 90 && p.state === 'walk') {
        p.state = 'flee';
        p.stateT = 2;
        p.speed = 190;
      }
      if (!p.target || U.dist(p.x, p.y, p.target.x, p.target.y) < 12) {
        p.target = p.state === 'flee'
          ? { x: U.clamp(p.x + U.randRange(rng, -260, 260), 0, C.WORLD_W), y: U.clamp(p.y + U.randRange(rng, -260, 260), 0, C.TOTAL_H) }
          : C.randomSidewalkPoint(rng);
      }
      var a = U.angleTo(p.x, p.y, p.target.x, p.target.y);
      p.angle = U.angleStep(p.angle, a, 5 * dt);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      C.resolveWorldCircle(p, 10);

      // Hit by the player's car?
      if (car && p.state !== 'down') {
        var d = U.dist(p.x, p.y, car.x, car.y);
        if (d < 26 && Math.abs(car.speed) > 40) {
          carHit(p);
          SB.police.addWanted(1);
          SB.audio.playCrash(0.5);
          car.speed *= 0.85;
        }
      }
    }
    // Keep the crowd topped up near the player.
    var near = 0;
    for (var j = 0; j < list.length; j++) {
      if (U.dist(list[j].x, list[j].y, player.x, player.y) < 900) near++;
    }
    if (near < 18) spawnPed(false);
    // Remove peds that wandered far away.
    for (var k = list.length - 1; k >= 0; k--) {
      if (U.dist(list[k].x, list[k].y, player.x, player.y) > 1600) list.splice(k, 1);
    }
  }

  SB.peds = {
    createWorld: createWorld,
    update: update,
    spawnPed: spawnPed,
    spawnFleeingDriver: spawnFleeingDriver,
    scareNear: scareNear,
    punchAt: punchAt,
    bulletHit: bulletHit,
    carHit: carHit,
    countNear: countNear,
    get list() { return list; }
  };
})();
