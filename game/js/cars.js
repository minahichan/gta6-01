// Solara Bay — vehicles: player driving physics, traffic AI, parked cars.
// Cars are circles at their front and rear for collision; traffic follows the
// street grid and turns at intersections like real drivers.
(function () {
  'use strict';

  var U = SB.util;
  var C = null; // city module, resolved at runtime

  var MODELS = {
    sedan:   { len: 48, wid: 23, maxSpeed: 300, accel: 240, color: '#c94f43' },
    taxi:    { len: 48, wid: 23, maxSpeed: 290, accel: 230, color: '#f2c230' },
    sports:  { len: 50, wid: 23, maxSpeed: 420, accel: 330, color: '#2f7fc9' },
    truck:   { len: 62, wid: 27, maxSpeed: 230, accel: 170, color: '#7d8f6a' },
    van:     { len: 54, wid: 25, maxSpeed: 250, accel: 190, color: '#e8e2d4' },
    police:  { len: 50, wid: 24, maxSpeed: 380, accel: 300, color: '#20242e' },
    classic: { len: 52, wid: 24, maxSpeed: 270, accel: 210, color: '#b5538a' }
  };
  var MODEL_KEYS = Object.keys(MODELS);
  var TRAFFIC_COLORS = ['#c94f43', '#d9a05b', '#8fa3b8', '#7d8f6a', '#a87f5f', '#5f7d8a', '#e8e2d4', '#6a5f8a'];

  var list = [];
  var playerCar = null;
  var rng = U.makeRng(777);

  /** Spawn the starting traffic and parked cars around the plaza. */
  function createWorld() {
    C = SB.city;
    list = [];
    playerCar = null;
    for (var i = 0; i < 14; i++) spawnTraffic(true);
    for (var j = 0; j < 10; j++) spawnParked(true);
  }

  /** Make a car object at a road point. */
  function makeCar(x, y, angle, model, kind) {
    var m = MODELS[model];
    return {
      x: x, y: y, angle: angle, speed: 0,
      len: m.len, wid: m.wid, maxSpeed: m.maxSpeed, accel: m.accel,
      color: kind === 'taxi' ? '#f2c230' : (kind === 'police' ? '#20242e' : m.color),
      model: model, kind: kind,
      cruise: U.randRange(rng, 85, 135),
      target: null, axis: 'x', dir: 1, lane: 0,
      driver: kind === 'traffic',
      siren: 0, skid: 0, stuck: 0,
      id: Math.floor(rng() * 1e9)
    };
  }

  /** Spawn a traffic car on a road near the player (or anywhere at start). */
  function spawnTraffic(anywhere) {
    var p = SB.player ? SB.player.state : null;
    var pt;
    var tries = 0;
    do {
      pt = C.randomRoadPoint(rng);
      tries++;
    } while (!anywhere && p && U.dist(pt.x, pt.y, p.x, p.y) < 500 && tries < 12);
    var model = U.randPick(rng, ['sedan', 'sedan', 'taxi', 'sports', 'truck', 'van', 'classic']);
    var angle = pt.axis === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    var car = makeCar(pt.x, pt.y, angle, model, model === 'taxi' ? 'taxi' : 'traffic');
    car.axis = pt.axis;
    car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
    car.lane = laneOffset(angle);
    car.target = nextIntersection(car);
    list.push(car);
    return car;
  }

  /** Right-hand lane offset for a heading angle. */
  function laneOffset(angle) {
    return 17;
  }

  /** The next intersection point ahead of a traffic car. */
  function nextIntersection(car) {
    var snap = C.snapToRoad(car.x, car.y);
    var step = C.PITCH;
    if (car.axis === 'x') {
      var nx = snap.x + car.dir * step;
      return { x: U.clamp(nx, 0, C.WORLD_W), y: snap.y };
    }
    var ny = snap.y + car.dir * step;
    return { x: snap.x, y: U.clamp(ny, 0, C.WORLD_H) };
  }

  /** Spawn a parked car in a lot or along a street edge. */
  function spawnParked(anywhere) {
    var p = SB.player ? SB.player.state : null;
    var pt;
    var tries = 0;
    do {
      pt = C.randomRoadPoint(rng);
      tries++;
    } while (!anywhere && p && U.dist(pt.x, pt.y, p.x, p.y) < 350 && tries < 12);
    var model = U.randPick(rng, MODEL_KEYS.filter(function (k) { return k !== 'police'; }));
    var angle = pt.axis === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    var off = pt.axis === 'x' ? 26 : -26;
    var car = makeCar(
      pt.axis === 'x' ? pt.x : pt.x + off,
      pt.axis === 'x' ? pt.y + off : pt.y,
      angle, model, 'parked');
    car.color = U.randPick(rng, TRAFFIC_COLORS);
    list.push(car);
    return car;
  }

  /** Spawn a police car on the nearest road, chasing the player. */
  function spawnPoliceCar(x, y) {
    var snap = C.snapToRoad(x, y);
    var car = makeCar(snap.x, snap.y, 0, 'police', 'police');
    car.cruise = 330;
    list.push(car);
    return car;
  }

  /** The car the player is driving, or null. */
  function getPlayerCar() {
    return playerCar;
  }

  /** Give the player a car to drive. */
  function setPlayerCar(car) {
    if (playerCar) playerCar.kind = 'parked';
    playerCar = car;
    if (car) car.kind = 'player';
  }

  /** Nearest car the player could steal, within maxDist. */
  function nearestStealable(x, y, maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.kind !== 'parked' && c.kind !== 'traffic') continue;
      var d = U.dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /** Front and rear circle centres of a car (for collision). */
  function carCircles(car) {
    var c = Math.cos(car.angle), s = Math.sin(car.angle);
    var q = car.len * 0.28;
    return [
      { x: car.x + c * q, y: car.y + s * q, r: car.wid * 0.62 },
      { x: car.x - c * q, y: car.y - s * q, r: car.wid * 0.62 }
    ];
  }

  /** Push a car out of buildings using its two circles. */
  function collideBuildings(car) {
    var circles = carCircles(car);
    var hit = false;
    for (var i = 0; i < circles.length; i++) {
      var p = { x: circles[i].x, y: circles[i].y };
      if (C.resolveWorldCircle(p, circles[i].r)) {
        // Rebuild the car centre from the pushed circle.
        var c = Math.cos(car.angle), s = Math.sin(car.angle);
        var q = car.len * 0.28;
        if (i === 0) { car.x = p.x - c * q; car.y = p.y - s * q; }
        else { car.x = p.x + c * q; car.y = p.y + s * q; }
        hit = true;
      }
    }
    return hit;
  }

  /** Update every car: player physics, traffic AI, police chase, collisions. */
  function update(dt) {
    var player = SB.player.state;
    for (var i = 0; i < list.length; i++) {
      var car = list[i];
      if (car.kind === 'player') updatePlayerCar(car, dt);
      else if (car.kind === 'police') updatePoliceCar(car, dt, player);
      else if (car.kind === 'traffic') updateTrafficCar(car, dt);
    }
    collideCars(dt);
    // Keep traffic topped up near the player.
    var trafficCount = 0;
    for (var j = 0; j < list.length; j++) if (list[j].kind === 'traffic') trafficCount++;
    if (trafficCount < 12) spawnTraffic(false);
    // Despawn far traffic and police cars that lost the player.
    for (var k = list.length - 1; k >= 0; k--) {
      var c2 = list[k];
      if ((c2.kind === 'traffic' || c2.kind === 'police') && U.dist(c2.x, c2.y, player.x, player.y) > 1500) {
        if (c2.kind === 'traffic') list.splice(k, 1);
        else if (SB.police.wanted === 0) list.splice(k, 1);
      }
    }
  }

  /** Arcade driving for the player's car. */
  function updatePlayerCar(car, dt) {
    var input = SB.input;
    var throttle = (input.isDown('w') || input.isDown('ArrowUp')) ? 1 : 0;
    var brake = (input.isDown('s') || input.isDown('ArrowDown')) ? 1 : 0;
    var steer = 0;
    if (input.isDown('a') || input.isDown('ArrowLeft')) steer -= 1;
    if (input.isDown('d') || input.isDown('ArrowRight')) steer += 1;

    if (throttle) car.speed += car.accel * dt;
    else if (brake) {
      if (car.speed > 20) car.speed -= car.accel * 1.4 * dt;
      else car.speed -= car.accel * 0.5 * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * 120 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    car.speed = U.clamp(car.speed, -140, car.maxSpeed);

    var spd = Math.abs(car.speed);
    var steerRate = 2.4 * U.clamp(spd / 120, 0, 1) * (spd > 260 ? 0.75 : 1);
    car.angle += steer * steerRate * dt * Math.sign(car.speed || 1);

    // Drift: velocity lags the heading a little at speed.
    var drift = U.clamp(spd / 300, 0, 1) * 0.35;
    var vx = Math.cos(car.angle) * car.speed;
    var vy = Math.sin(car.angle) * car.speed;
    car.x += vx * dt;
    car.y += vy * dt;
    if (Math.abs(steer) > 0 && spd > 200) {
      car.skid = 0.3;
      if (rng() < 0.4) SB.audio.playSkid();
      SB.render.addSkid(car.x, car.y, car.angle);
    } else {
      car.skid = Math.max(0, car.skid - dt);
    }
    var hitWall = collideBuildings(car);
    if (hitWall && spd > 120) {
      SB.audio.playCrash(U.clamp(spd / 400, 0.15, 1));
      SB.render.burst(car.x, car.y, '#ffb347', 10);
      car.speed *= 0.45;
      SB.player.damagePlayer(2);
    }
    SB.audio.setEngine(U.clamp(spd / car.maxSpeed, 0, 1));
  }

  /** Traffic car: cruise along its lane, turn at intersections, avoid the car ahead. */
  function updateTrafficCar(car, dt) {
    var snap = C.snapToRoad(car.x, car.y);
    var tx = car.target.x, ty = car.target.y;
    var want = Math.atan2(ty - car.y, tx - car.x);
    car.angle = U.angleStep(car.angle, want, 2.2 * dt);

    // Slow for the car ahead in the same lane.
    var ahead = 9999;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === car) continue;
      var d = U.dist(car.x, car.y, o.x, o.y);
      if (d < 90) {
        var a = U.angleTo(car.x, car.y, o.x, o.y);
        if (Math.abs(U.angleDiff(car.angle, a)) < 0.6 && d < ahead) ahead = d;
      }
    }
    var targetSpeed = car.cruise;
    if (ahead < 70) targetSpeed = Math.max(0, (ahead - 34) * 2.5);
    // Slow a little near intersections.
    var toTarget = U.dist(car.x, car.y, tx, ty);
    if (toTarget < 60) targetSpeed = Math.min(targetSpeed, 70);

    car.speed = U.lerp(car.speed, targetSpeed, U.clamp(2.5 * dt, 0, 1));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(car);

    if (toTarget < 14) {
      // Pick a new road at the intersection: straight, left or right.
      var options = [];
      var cur = car.axis;
      var dirs = cur === 'x' ? [1, -1] : [1, -1];
      var r = rng();
      if (r < 0.55) {
        options.push({ axis: cur, dir: car.dir });
      } else if (r < 0.8) {
        options.push({ axis: cur === 'x' ? 'y' : 'x', dir: 1 });
      } else {
        options.push({ axis: cur === 'x' ? 'y' : 'x', dir: -1 });
      }
      var pick = options[0];
      car.axis = pick.axis;
      car.dir = pick.dir;
      car.target = nextIntersection(car);
      // Clamp target inside the world so cars never drive into the sea.
      car.target.x = U.clamp(car.target.x, 0, C.WORLD_W);
      car.target.y = U.clamp(car.target.y, 0, C.WORLD_H);
    }
  }

  /** Police car: steer toward the player and ram. */
  function updatePoliceCar(car, dt, player) {
    var want = Math.atan2(player.y - car.y, player.x - car.x);
    var d = U.dist(car.x, car.y, player.x, player.y);
    car.angle = U.angleStep(car.angle, want, 3.0 * dt);
    var targetSpeed = d > 260 ? car.cruise : car.cruise * 0.8;
    car.speed = U.lerp(car.speed, targetSpeed, U.clamp(2 * dt, 0, 1));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.siren = (car.siren + dt * 6) % (Math.PI * 2);
    var hitWall = collideBuildings(car);
    if (hitWall) car.speed *= 0.6;
    // Ram the player's car.
    if (playerCar) {
      var pd = U.dist(car.x, car.y, playerCar.x, playerCar.y);
      if (pd < 46) {
        var push = U.angleTo(car.x, car.y, playerCar.x, playerCar.y);
        playerCar.x += Math.cos(push) * 60 * dt;
        playerCar.y += Math.sin(push) * 60 * dt;
        playerCar.speed *= 0.94;
        if (rng() < 0.1) SB.audio.playCrash(0.4);
      }
    }
  }

  /** Car-to-car shoves and crash sounds. */
  function collideCars(dt) {
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var d = U.dist(a.x, a.y, b.x, b.y);
        var min = (a.len + b.len) * 0.32;
        if (d < min && d > 0.01) {
          var push = U.angleTo(b.x, b.y, a.x, a.y);
          var overlap = (min - d) / 2;
          a.x += Math.cos(push) * overlap;
          a.y += Math.sin(push) * overlap;
          b.x -= Math.cos(push) * overlap;
          b.y -= Math.sin(push) * overlap;
          var impact = Math.abs(a.speed - b.speed);
          if (impact > 140 && rng() < 0.3) SB.audio.playCrash(U.clamp(impact / 400, 0.2, 1));
          if (a.kind === 'player') a.speed *= 0.96;
          if (b.kind === 'player') b.speed *= 0.96;
        }
      }
    }
  }

  /** Remove a car from the world. */
  function removeCar(car) {
    var i = list.indexOf(car);
    if (i >= 0) list.splice(i, 1);
    if (playerCar === car) playerCar = null;
  }

  /** How many cars of one kind are on the road right now. */
  function countByKind(kind) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (list[i].kind === kind) n++;
    return n;
  }

  /** Nearest car of any kind within maxDist of a point. */
  function nearestCar(x, y, maxDist) {
    var best = null, bestD = maxDist;
    for (var i = 0; i < list.length; i++) {
      var d = U.dist(x, y, list[i].x, list[i].y);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  }

  SB.cars = {
    MODELS: MODELS,
    createWorld: createWorld,
    update: update,
    spawnTraffic: spawnTraffic,
    spawnParked: spawnParked,
    spawnPoliceCar: spawnPoliceCar,
    getPlayerCar: getPlayerCar,
    setPlayerCar: setPlayerCar,
    nearestStealable: nearestStealable,
    carCircles: carCircles,
    removeCar: removeCar,
    countByKind: countByKind,
    nearestCar: nearestCar,
    get list() { return list; }
  };
})();
