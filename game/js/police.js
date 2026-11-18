// Solara Bay — the wanted system and the Solara Bay Police Department.
// Stars rise with crime, cops chase on foot and in cruisers, and the heat
// only cools when the player stays out of sight.
(function () {
  'use strict';

  var U = SB.util;
  var C = null;

  var wanted = 0;
  var wantedTimer = 0;      // time since the player was last seen
  var graceTimer = 0;       // short immunity after a star is added
  var spawnTimer = 0;
  var cops = [];            // on-foot officers
  var rng = U.makeRng(99);

  var MAX_STARS = 5;

  /** Reset the wanted level and clear every cop. */
  function reset() {
    C = SB.city;
    wanted = 0;
    wantedTimer = 0;
    graceTimer = 0;
    spawnTimer = 0;
    cops = [];
  }

  /** Current wanted stars. */
  function getWanted() {
    return wanted;
  }

  /** Add stars, capped at five, with a short grace period. */
  function addWanted(n) {
    if (graceTimer > 0 || n <= 0) return;
    wanted = Math.min(MAX_STARS, wanted + n);
    graceTimer = 1.2;
    wantedTimer = 0;
    SB.audio.setSiren(wanted > 0);
    if (wanted > 0) SB.ui.flash('Wanted level ' + wanted + ' — the SBPD is on you!');
  }

  /** Set the wanted level directly (missions script this). */
  function setWanted(n) {
    wanted = U.clamp(n, 0, MAX_STARS);
    wantedTimer = 0;
    SB.audio.setSiren(wanted > 0);
  }

  /** Drop all heat at once (mission failed, job restarted). */
  function clearHeat() {
    wanted = 0;
    wantedTimer = 0;
    SB.audio.setSiren(false);
  }

  /** A loud event: nearby peds flee and cops notice if they are close. */
  function noiseEvent(x, y, radius) {
    SB.peds.scareNear(x, y, radius);
    for (var i = 0; i < cops.length; i++) {
      if (U.dist(cops[i].x, cops[i].y, x, y) < 420) {
        addWanted(1);
        return;
      }
    }
  }

  /** A punch lands on a cop; returns true on a hit. */
  function punchAt(x, y, range) {
    for (var i = 0; i < cops.length; i++) {
      if (U.dist(cops[i].x, cops[i].y, x, y) < range) {
        knockCop(cops[i]);
        return true;
      }
    }
    return false;
  }

  /** A bullet hits a cop; returns true on a hit. */
  function bulletHit(x, y) {
    for (var i = 0; i < cops.length; i++) {
      if (U.dist(cops[i].x, cops[i].y, x, y) < 14) {
        knockCop(cops[i]);
        return true;
      }
    }
    return false;
  }

  /** Knock an officer down for a few seconds. */
  function knockCop(cop) {
    cop.state = 'down';
    cop.stateT = 2.5;
    SB.render.burst(cop.x, cop.y, '#5b8cff', 8);
  }

  /** True when an officer is standing on the player (arrest in progress). */
  function copTouchingPlayer() {
    var p = SB.player.state;
    if (!p.onFoot) return false;
    for (var i = 0; i < cops.length; i++) {
      var c = cops[i];
      if (c.state === 'chase' && U.dist(c.x, c.y, p.x, p.y) < 20) return true;
    }
    return false;
  }

  /** Spawn one on-foot officer near the player. */
  function spawnCop() {
    var p = SB.player.state;
    var a = rng() * Math.PI * 2;
    var r = U.randRange(rng, 380, 560);
    var cop = {
      x: U.clamp(p.x + Math.cos(a) * r, 0, C.WORLD_W),
      y: U.clamp(p.y + Math.sin(a) * r, 0, C.TOTAL_H),
      angle: 0, speed: wanted >= 3 ? 235 : 200,
      state: 'chase', stateT: 0, bob: rng() * 6
    };
    cops.push(cop);
    return cop;
  }

  /** How many officers and cruisers the current heat calls for. */
  function desiredForce() {
    if (wanted === 0) return { cops: 0, cars: 0 };
    if (wanted === 1) return { cops: 1, cars: 1 };
    if (wanted === 2) return { cops: 2, cars: 2 };
    if (wanted === 3) return { cops: 3, cars: 3 };
    if (wanted === 4) return { cops: 4, cars: 4 };
    return { cops: 5, cars: 5 };
  }

  /** Per-frame update: spawning, chasing, cooling off. */
  function update(dt) {
    var player = SB.player.state;
    graceTimer = Math.max(0, graceTimer - dt);
    spawnTimer -= dt;

    var force = desiredForce();

    // Count live cruisers.
    var cruisers = 0;
    var cars = SB.cars.list;
    for (var i = 0; i < cars.length; i++) if (cars[i].kind === 'police') cruisers++;

    if (wanted > 0) {
      wantedTimer += dt;
      // Spawn reinforcements on a timer.
      if (spawnTimer <= 0) {
        spawnTimer = wanted >= 3 ? 2.2 : 3.5;
        if (cops.length < force.cops) spawnCop();
        else if (cruisers < force.cars) SB.cars.spawnPoliceCar(player.x, player.y);
      }
      // Heat cools when no cop or cruiser can see the player.
      var nearest = 99999;
      for (var j = 0; j < cops.length; j++) {
        nearest = Math.min(nearest, U.dist(cops[j].x, cops[j].y, player.x, player.y));
      }
      for (var k = 0; k < cars.length; k++) {
        if (cars[k].kind === 'police') nearest = Math.min(nearest, U.dist(cars[k].x, cars[k].y, player.x, player.y));
      }
      if (nearest > 700) {
        if (wantedTimer > 9) {
          wanted--;
          wantedTimer = 0;
          SB.ui.flash(wanted > 0 ? 'Heat cooling… wanted level ' + wanted : 'You lost them. Clean — for now.');
          if (wanted === 0) SB.audio.setSiren(false);
        }
      } else {
        wantedTimer = 0;
      }
    } else {
      // No heat: officers stand down and drift away.
      for (var m = cops.length - 1; m >= 0; m--) {
        if (U.dist(cops[m].x, cops[m].y, player.x, player.y) > 900) cops.splice(m, 1);
      }
    }

    // Officers chase the player on foot.
    for (var n = 0; n < cops.length; n++) {
      var cop = cops[n];
      cop.bob += dt * 9;
      if (cop.state === 'down') {
        cop.stateT -= dt;
        if (cop.stateT <= 0) cop.state = 'chase';
        continue;
      }
      var a = U.angleTo(cop.x, cop.y, player.x, player.y);
      cop.angle = U.angleStep(cop.angle, a, 6 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      C.resolveWorldCircle(cop, 12);
      // An officer on foot can be run over.
      var car = SB.cars.getPlayerCar();
      if (car && Math.abs(car.speed) > 60 && U.dist(cop.x, cop.y, car.x, car.y) < 26) {
        knockCop(cop);
        addWanted(1);
        car.speed *= 0.85;
      }
    }
  }

  SB.police = {
    reset: reset,
    update: update,
    getWanted: getWanted,
    addWanted: addWanted,
    setWanted: setWanted,
    clearHeat: clearHeat,
    noiseEvent: noiseEvent,
    punchAt: punchAt,
    bulletHit: bulletHit,
    copTouchingPlayer: copTouchingPlayer,
    spawnCop: spawnCop,
    get wanted() { return wanted; },
    get cops() { return cops; }
  };
})();
