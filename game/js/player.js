// Solara Bay — the player on foot: walking, running, stealing cars, combat.
// Bullets, health and the busted/wasted states live here too.
// Round 2: untouched logic — the round-1 fix is in main.ts only.
(function () {
  'use strict';

  var U = SB.util;
  var C = null;

  var WALK_SPEED = 175;
  var RUN_SPEED = 295;

  var state = {
    x: 0, y: 0, angle: 0,
    health: 100, maxHealth: 100,
    onFoot: true, car: null,
    ammo: 24, hasGun: true,
    punchCooldown: 0, shootCooldown: 0,
    hurtFlash: 0, bustedTimer: 0,
    dead: false, busted: false,
    cash: 250
  };

  var bullets = [];

  /** Place the player at the plaza to start. */
  function reset(spawn) {
    C = SB.city;
    state.x = spawn.x;
    state.y = spawn.y;
    state.angle = -Math.PI / 2;
    state.health = 100;
    state.onFoot = true;
    state.car = null;
    state.ammo = 24;
    state.hasGun = true;
    state.dead = false;
    state.busted = false;
    state.bustedTimer = 0;
    state.hurtFlash = 0;
    bullets.length = 0;
  }

  /** Take damage; returns true when the player is wasted. */
  function damagePlayer(amount) {
    if (state.dead || state.busted) return false;
    state.health -= amount;
    state.hurtFlash = 0.5;
    if (state.health <= 0) {
      state.health = 0;
      state.dead = true;
      SB.audio.stopEngine();
      SB.audio.setSiren(false);
      return true;
    }
    return false;
  }

  /** Heal a little (pickups, mission rewards). */
  function healPlayer(amount) {
    state.health = Math.min(state.maxHealth, state.health + amount);
  }

  /** Add pistol ammo (medkit pickups). */
  function addAmmo(n) {
    state.ammo += n;
  }

  /** Fire the pistol toward the mouse (world position). */
  function shootAt(wx, wy) {
    if (!state.onFoot || state.shootCooldown > 0 || state.ammo <= 0) return;
    state.shootCooldown = 0.28;
    state.ammo--;
    var a = U.angleTo(state.x, state.y, wx, wy);
    state.angle = a;
    bullets.push({
      x: state.x + Math.cos(a) * 16,
      y: state.y + Math.sin(a) * 16,
      vx: Math.cos(a) * 720,
      vy: Math.sin(a) * 720,
      life: 0.9, fromPlayer: true
    });
    SB.audio.playGunshot();
    SB.render.muzzle(state.x + Math.cos(a) * 18, state.y + Math.sin(a) * 18, a);
    SB.police.noiseEvent(state.x, state.y, 500);
  }

  /** Punch the nearest ped or cop in front of the player. */
  function punch() {
    if (!state.onFoot || state.punchCooldown > 0) return;
    state.punchCooldown = 0.45;
    SB.audio.playPunch();
    var fx = state.x + Math.cos(state.angle) * 26;
    var fy = state.y + Math.sin(state.angle) * 26;
    var hit = SB.peds.punchAt(fx, fy, 30);
    if (!hit) hit = SB.police.punchAt(fx, fy, 30);
    if (hit) SB.police.addWanted(1);
  }

  /** Try to enter the nearest stealable car; returns a message for the HUD. */
  function tryEnterCar() {
    var car = SB.cars.nearestStealable(state.x, state.y, 64);
    if (!car) return null;
    var wasTraffic = car.kind === 'traffic';
    if (wasTraffic) {
      // Carjack: the driver bails out and runs.
      SB.peds.spawnFleeingDriver(car.x, car.y);
      SB.police.addWanted(1);
      SB.ui.flash('Car jacked! The driver ran for it.');
    }
    SB.cars.setPlayerCar(car);
    state.car = car;
    state.onFoot = false;
    SB.audio.playHorn();
    return car;
  }

  /** Step out of the car onto the street. */
  function exitCar() {
    var car = state.car;
    if (!car) return;
    var side = car.angle + Math.PI / 2;
    state.x = car.x + Math.cos(side) * 30;
    state.y = car.y + Math.sin(side) * 30;
    state.angle = car.angle;
    SB.cars.setPlayerCar(null);
    state.car = null;
    state.onFoot = true;
    SB.audio.stopEngine();
  }

  /** Per-frame update: on-foot movement, combat, bullets, busted timer. */
  function update(dt) {
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    state.shootCooldown = Math.max(0, state.shootCooldown - dt);
    state.hurtFlash = Math.max(0, state.hurtFlash - dt);

    if (state.dead || state.busted) return;

    var input = SB.input;
    if (state.onFoot) {
      var mv = input.moveVector();
      var running = input.isDown('Shift');
      var speed = running ? RUN_SPEED : WALK_SPEED;
      if (mv.x !== 0 || mv.y !== 0) {
        state.angle = Math.atan2(mv.y, mv.x);
        state.x += mv.x * speed * dt;
        state.y += mv.y * speed * dt;
        C.resolveWorldCircle(state, 13);
      }
      // Face the mouse when aiming with the pistol.
      if (input.mouse.down && state.ammo > 0) {
        var cam = SB.render.camera;
        var wx = cam.x + input.mouse.x - SB.render.viewW / 2;
        var wy = cam.y + input.mouse.y - SB.render.viewH / 2;
        shootAt(wx, wy);
      }
      if (input.wasPressed('f')) punch();
      if (input.wasPressed('e')) tryEnterCar();
    } else {
      // Driving: keep the player glued to the car.
      if (state.car) {
        state.x = state.car.x;
        state.y = state.car.y;
        state.angle = state.car.angle;
      }
      if (input.wasPressed('e')) exitCar();
      if (input.wasPressed('h')) SB.audio.playHorn();
    }

    // Bullets fly, hit buildings, cars and peds.
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0;
      if (!dead && C.hitsBuilding(b.x, b.y, 2)) {
        SB.render.burst(b.x, b.y, '#ffd27d', 5);
        dead = true;
      }
      if (!dead) {
        var hitPed = SB.peds.bulletHit(b.x, b.y);
        if (hitPed) {
          SB.police.addWanted(1);
          dead = true;
        }
      }
      if (!dead) {
        var hitCop = SB.police.bulletHit(b.x, b.y);
        if (hitCop) {
          SB.police.addWanted(1);
          dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    // Busted: a cop standing on the player arrests them.
    if (SB.police.copTouchingPlayer()) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 1.1) {
        state.busted = true;
        SB.audio.stopEngine();
        SB.audio.setSiren(false);
      }
    } else {
      state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
    }
  }

  SB.player = {
    state: state,
    bullets: bullets,
    reset: reset,
    update: update,
    damagePlayer: damagePlayer,
    healPlayer: healPlayer,
    addAmmo: addAmmo,
    shootAt: shootAt,
    punch: punch,
    tryEnterCar: tryEnterCar,
    exitCar: exitCar
  };
})();
