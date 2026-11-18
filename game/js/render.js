// Solara Bay — renderer: the sun-soaked city, camera, entities, effects, minimap.
// Everything draws on one canvas; the minimap is a second small canvas.
(function () {
  'use strict';

  var U = SB.util;
  var C = null;

  var canvas = null;
  var ctx = null;
  var miniCanvas = null;
  var miniCtx = null;
  var viewW = 1280;
  var viewH = 800;
  var camera = { x: 0, y: 0, zoom: 1 };
  var particles = [];
  var skids = [];
  var flashes = [];

  /** Attach the canvases and size them to the window. */
  function init(mainCanvas, mapCanvas) {
    C = SB.city;
    canvas = mainCanvas;
    ctx = canvas.getContext('2d');
    miniCanvas = mapCanvas;
    miniCtx = mapCanvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  /** Fit the canvas to the window (CSS pixels, capped devicePixelRatio 1.5). */
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Follow the player with a smooth camera. */
  function updateCamera(dt) {
    var p = SB.player.state;
    var tx = U.clamp(p.x - viewW / 2, -80, C.WORLD_W - viewW + 80);
    var ty = U.clamp(p.y - viewH / 2, -80, C.TOTAL_H - viewH + 80);
    camera.x = U.lerp(camera.x, tx, U.clamp(5 * dt, 0, 1));
    camera.y = U.lerp(camera.y, ty, U.clamp(5 * dt, 0, 1));
  }

  /** Spawn a burst of coloured particles. */
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 40 + Math.random() * 130;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color: color, r: 2 + Math.random() * 3 });
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300);
  }

  /** Add a skid mark at a car's position. */
  function addSkid(x, y, angle) {
    skids.push({ x: x, y: y, angle: angle, life: 6 });
    if (skids.length > 220) skids.shift();
  }

  /** A muzzle flash at a gunshot. */
  function muzzle(x, y, angle) {
    flashes.push({ x: x, y: y, angle: angle, life: 0.07 });
  }

  /** Draw the whole frame: world, entities, effects, then the minimap. */
  function draw() {
    C = SB.city;
    ctx.fillStyle = '#f7d9a0';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGround();
    drawBeach();
    drawParksAndLots();
    drawBuildings();
    drawProps();
    drawSkids();
    drawPickups();
    drawMarkers();
    drawEntities();
    drawParticles();
    drawFlashes();
    ctx.restore();
    drawOffscreenArrow();
    drawSunTint();
    drawMinimap();
  }

  /** An edge arrow pointing at the mission marker when it is off screen. */
  function drawOffscreenArrow() {
    var marks = SB.missions.markers;
    if (marks.length === 0) return;
    var m = marks[0];
    var p = SB.player.state;
    var mx = m.x - camera.x, my = m.y - camera.y;
    if (mx > 40 && mx < viewW - 40 && my > 40 && my < viewH - 40) return;
    var cx = U.clamp(mx, 60, viewW - 60);
    var cy = U.clamp(my, 90, viewH - 90);
    var a = Math.atan2(my - (p.y - camera.y), mx - (p.x - camera.x));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(U.dist(p.x, p.y, m.x, m.y) / 10) * 10 + 'm', cx, cy + 26);
  }

  /** Base ground: warm sand-toned grass with a subtle checker of blocks. */
  function drawGround() {
    ctx.fillStyle = '#e9d8a6';
    ctx.fillRect(camera.x - 40, camera.y - 40, viewW + 80, viewH + 80);
    // Roads: asphalt bands with dashed centrelines.
    ctx.fillStyle = '#3c4148';
    for (var i = 0; i <= C.COLS; i++) {
      var x = i * C.PITCH;
      ctx.fillRect(x, camera.y - 40, C.ROAD_W, viewH + 80);
    }
    for (var j = 0; j <= C.ROWS; j++) {
      var y = j * C.PITCH;
      ctx.fillRect(camera.x - 40, y, viewW + 80, C.ROAD_W);
    }
    // Sidewalk edging around every block.
    ctx.fillStyle = '#cfc3a5';
    for (var bx = 0; bx < C.COLS; bx++) {
      for (var by = 0; by < C.ROWS; by++) {
        var x0 = bx * C.PITCH + C.ROAD_W;
        var y0 = by * C.PITCH + C.ROAD_W;
        ctx.fillRect(x0, y0, C.BLOCK, 10);
        ctx.fillRect(x0, y0 + C.BLOCK - 10, C.BLOCK, 10);
        ctx.fillRect(x0, y0, 10, C.BLOCK);
        ctx.fillRect(x0 + C.BLOCK - 10, y0, 10, C.BLOCK);
      }
    }
    // Centre dashes.
    ctx.strokeStyle = '#e8d27a';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (var i2 = 0; i2 <= C.COLS; i2++) {
      var x2 = i2 * C.PITCH + C.ROAD_W / 2;
      ctx.beginPath();
      ctx.moveTo(x2, camera.y - 40);
      ctx.lineTo(x2, camera.y + viewH + 40);
      ctx.stroke();
    }
    for (var j2 = 0; j2 <= C.ROWS; j2++) {
      var y2 = j2 * C.PITCH + C.ROAD_W / 2;
      ctx.beginPath();
      ctx.moveTo(camera.x - 40, y2);
      ctx.lineTo(camera.x + viewW + 40, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at intersections.
    ctx.fillStyle = '#e8e8e8';
    for (var i3 = 0; i3 <= C.COLS; i3++) {
      for (var j3 = 0; j3 <= C.ROWS; j3++) {
        var cx = i3 * C.PITCH + C.ROAD_W / 2;
        var cy = j3 * C.PITCH + C.ROAD_W / 2;
        for (var s = -2; s <= 2; s++) {
          ctx.fillRect(cx + s * 12 - 4, cy - C.ROAD_W / 2 + 4, 8, 12);
          ctx.fillRect(cx + s * 12 - 4, cy + C.ROAD_W / 2 - 16, 8, 12);
        }
      }
    }
  }

  /** The beach and the sea along the south edge. */
  function drawBeach() {
    var y0 = C.WORLD_H;
    ctx.fillStyle = '#f2e2b8';
    ctx.fillRect(camera.x - 40, y0, viewW + 80, C.BEACH_H);
    var wave = (Date.now() / 900) % 1;
    ctx.fillStyle = '#3fa7c9';
    ctx.fillRect(camera.x - 40, y0 + C.BEACH_H - 24 - wave * 6, viewW + 80, 40);
    ctx.fillStyle = '#57b8d8';
    ctx.fillRect(camera.x - 40, y0 + C.BEACH_H - 14 - wave * 6, viewW + 80, 20);
    // Beach umbrellas.
    ctx.fillStyle = '#e2574c';
    for (var i = 0; i < 8; i++) {
      var ux = 200 + i * 420;
      if (ux < camera.x - 60 || ux > camera.x + viewW + 60) continue;
      ctx.beginPath();
      ctx.arc(ux, y0 + 120, 26, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f2e6d0';
      ctx.fillRect(ux - 2, y0 + 120, 4, 26);
      ctx.fillStyle = '#e2574c';
    }
  }

  /** Parks, plazas, docks and parking lots. */
  function drawParksAndLots() {
    var data = C.data;
    var i;
    for (i = 0; i < data.parks.length; i++) {
      var pk = data.parks[i];
      ctx.fillStyle = pk.kind === 'plaza' ? '#d8cbb0' : '#8fbf6f';
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      if (pk.kind === 'plaza') {
        ctx.fillStyle = '#57b8d8';
        ctx.beginPath();
        ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath();
        ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (i = 0; i < data.lots.length; i++) {
      var lot = data.lots[i];
      ctx.fillStyle = '#4a4f57';
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = '#e8d27a';
      ctx.lineWidth = 2;
      for (var s = 0; s < 4; s++) {
        ctx.strokeRect(lot.x + 16 + s * 46, lot.y + 20, 36, 70);
      }
    }
  }

  /** Buildings with pseudo-3D height: roof, sunlit side and shadow. */
  function drawBuildings() {
    var data = C.data;
    var list = data.buildings;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!onScreen(b.x - 80, b.y - 80, b.w + 160, b.h + 160)) continue;
      var h = b.height;
      // Ground shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);
      // Sunlit south and east faces.
      ctx.fillStyle = shade(b.wall, -24);
      ctx.fillRect(b.x, b.y + h * 0.4, b.w, b.h - h * 0.4 + h * 0.4);
      ctx.fillStyle = shade(b.wall, -44);
      ctx.fillRect(b.x + b.w - h * 0.3, b.y, h * 0.3, b.h);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - h * 0.28, b.y - h * 0.28, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - h * 0.28, b.y - h * 0.28, b.w, b.h);
      // Rooftop details.
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      var ac = 2 + (b.w * b.h) % 3;
      for (var k = 0; k < ac; k++) {
        ctx.fillRect(b.x - h * 0.28 + 10 + k * 18, b.y - h * 0.28 + 10, 10, 10);
      }
      if (b.kind && b.kind !== 'block') {
        ctx.fillStyle = '#20242e';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x - h * 0.28 + b.w / 2, b.y - h * 0.28 + b.h / 2 + 4);
      }
    }
  }

  /** Darken or lighten a hex colour by amt. */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = U.clamp((n >> 16) + amt, 0, 255);
    var g = U.clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = U.clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /** Palm trees and street lamps. */
  function drawProps() {
    var data = C.data;
    var i;
    for (i = 0; i < data.palms.length; i++) {
      var p = data.palms[i];
      if (!onScreen(p.x - 30, p.y - 30, 60, 60)) continue;
      ctx.strokeStyle = '#8a6a42';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 4, p.y - 22);
      ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      for (var f = 0; f < 5; f++) {
        var a = (f / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x + 4 + Math.cos(a) * 12, p.y - 24 + Math.sin(a) * 7, 13, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#2c2f36';
    for (i = 0; i < data.lamps.length; i++) {
      var l = data.lamps[i];
      if (!onScreen(l.x - 6, l.y - 6, 12, 12)) continue;
      ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    }
  }

  /** Skid marks left by drifting cars. */
  function drawSkids() {
    ctx.strokeStyle = 'rgba(20,20,20,0.4)';
    ctx.lineWidth = 5;
    for (var i = 0; i < skids.length; i++) {
      var s = skids[i];
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      ctx.stroke();
    }
  }

  /** Cash drops and medkits on the ground. */
  function drawPickups() {
    var list = SB.missions.pickups;
    for (var i = 0; i < list.length; i++) {
      var pk = list[i];
      if (pk.taken) continue;
      var bob = Math.sin(Date.now() / 300 + i) * 3;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2f7d3a';
        ctx.fillRect(pk.x - 10, pk.y - 7 + bob, 20, 14);
        ctx.fillStyle = '#ffd94d';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', pk.x, pk.y + 4 + bob);
      } else {
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
        ctx.fillStyle = '#e2574c';
        ctx.fillRect(pk.x - 3, pk.y - 8 + bob, 6, 16);
        ctx.fillRect(pk.x - 8, pk.y - 3 + bob, 16, 6);
      }
    }
  }

  /** Mission markers: a bouncing diamond and a beam of light. */
  function drawMarkers() {
    var list = SB.missions.markers;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var bob = Math.sin(Date.now() / 280) * 6;
      ctx.fillStyle = 'rgba(255,217,77,0.25)';
      ctx.fillRect(m.x - 3, m.y - 70, 6, 70);
      ctx.fillStyle = m.color;
      ctx.save();
      ctx.translate(m.x, m.y - 52 + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y - 72 + bob);
    }
  }

  /** All moving entities, sorted by y so nearer things draw on top. */
  function drawEntities() {
    var items = [];
    var peds = SB.peds.list;
    var cars = SB.cars.list;
    var cops = SB.police.cops;
    var player = SB.player.state;
    var i;
    for (i = 0; i < peds.length; i++) items.push({ y: peds[i].y, kind: 'ped', o: peds[i] });
    for (i = 0; i < cars.length; i++) items.push({ y: cars[i].y, kind: 'car', o: cars[i] });
    for (i = 0; i < cops.length; i++) items.push({ y: cops[i].y, kind: 'cop', o: cops[i] });
    if (player.onFoot) items.push({ y: player.y, kind: 'player', o: player });
    items.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'ped') drawPed(it.o);
      else if (it.kind === 'car') drawCar(it.o);
      else if (it.kind === 'cop') drawCop(it.o);
      else drawPlayer(it.o);
    }
    drawBullets();
  }

  /** A pedestrian: bobbing walk, shirt and skin. */
  function drawPed(p) {
    if (!onScreen(p.x - 20, p.y - 20, 40, 40)) return;
    var bob = p.state === 'walk' ? Math.sin(p.bob) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.state === 'down') {
      ctx.fillStyle = p.shirt;
      ctx.fillRect(p.x - 10, p.y - 4, 20, 9);
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(p.x + 12, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = p.shirt;
    ctx.fillRect(p.x - 6, p.y - 8 + bob, 12, 14);
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 12 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(p.x - 5, p.y + 5, 4, 6);
    ctx.fillRect(p.x + 1, p.y + 5, 4, 6);
  }

  /** A police officer: navy uniform, cap, badge. */
  function drawCop(c) {
    if (!onScreen(c.x - 20, c.y - 20, 40, 40)) return;
    var bob = Math.sin(c.bob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 10, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (c.state === 'down') {
      ctx.fillStyle = '#1c2f57';
      ctx.fillRect(c.x - 10, c.y - 4, 20, 9);
      return;
    }
    ctx.fillStyle = '#1c2f57';
    ctx.fillRect(c.x - 6, c.y - 8 + bob, 12, 14);
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(c.x, c.y - 12 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#101c33';
    ctx.fillRect(c.x - 6, c.y - 17 + bob, 12, 4);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(c.x - 2, c.y - 4 + bob, 4, 4);
  }

  /** The player on foot: orange jacket, cap, gun in hand when aiming. */
  function drawPlayer(p) {
    var bob = Math.sin(Date.now() / 130) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 11, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#e2701d';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(8, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(2, -6, 7, 12);
    if (p.hasGun) {
      ctx.fillStyle = '#2c2f36';
      ctx.fillRect(10, -2, 12, 4);
    }
    ctx.restore();
    // Direction ring so the player is easy to spot.
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** A car: shadow, body, windows, wheels, taxi sign, police lights. */
  function drawCar(car) {
    if (!onScreen(car.x - 50, car.y - 50, 100, 100)) return;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 4, car.len / 2, car.wid / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15181d';
    ctx.fillRect(-car.len / 2 + 2, -car.wid / 2 - 3, 12, 6);
    ctx.fillRect(-car.len / 2 + 2, car.wid / 2 - 3, 12, 6);
    ctx.fillRect(car.len / 2 - 14, -car.wid / 2 - 3, 12, 6);
    ctx.fillRect(car.len / 2 - 14, car.wid / 2 - 3, 12, 6);
    ctx.fillStyle = car.color;
    roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 8);
    ctx.fill();
    ctx.fillStyle = '#bcd6e8';
    roundRect(-car.len * 0.18, -car.wid / 2 + 3, car.len * 0.32, car.wid - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 3, 6, car.wid - 6);
    if (car.model === 'taxi') {
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(-6, -5, 12, 10);
      ctx.fillStyle = '#20242e';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 2);
    }
    if (car.kind === 'police') {
      var on = Math.sin(car.siren) > 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2f7fc9';
      ctx.fillRect(-8, -car.wid / 2 - 2, 7, 5);
      ctx.fillStyle = on ? '#2f7fc9' : '#ff3b30';
      ctx.fillRect(1, -car.wid / 2 - 2, 7, 5);
      ctx.fillStyle = '#f0f0f0';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('SBPD', 0, 3);
    }
    if (car.kind === 'player') {
      ctx.strokeStyle = 'rgba(255,217,77,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-car.len / 2 - 4, -car.wid / 2 - 4, car.len + 8, car.wid + 8);
    }
    ctx.restore();
  }

  /** Rounded rectangle path helper. */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Player bullets as bright tracers. */
  function drawBullets() {
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (var i = 0; i < SB.player.bullets.length; i++) {
      var b = SB.player.bullets[i];
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  /** Particles: sparks, dust, smoke. */
  function drawParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.life -= 0.016;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = U.clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Muzzle flashes. */
  function drawFlashes() {
    for (var i = flashes.length - 1; i >= 0; i--) {
      var f = flashes[i];
      f.life -= 0.016;
      if (f.life <= 0) { flashes.splice(i, 1); continue; }
      ctx.fillStyle = '#ffe27a';
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(16, -4);
      ctx.lineTo(16, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Warm sun tint and a soft vignette over the whole frame. */
  function drawSunTint() {
    var g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, 'rgba(255,190,90,0.10)');
    g.addColorStop(1, 'rgba(255,120,60,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
    var v = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.45, viewW / 2, viewH / 2, viewH * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, viewW, viewH);
    // Hurt flash.
    var hurt = SB.player.state.hurtFlash;
    if (hurt > 0) {
      ctx.fillStyle = 'rgba(200,30,30,' + (hurt * 0.45) + ')';
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  /** The minimap: roads, blocks, mission marker, police and the player. */
  function drawMinimap() {
    if (!miniCanvas) return;
    var mw = miniCanvas.width, mh = miniCanvas.height;
    var sx = mw / C.WORLD_W, sy = mh / C.TOTAL_H;
    var s = Math.min(sx, sy);
    miniCtx.fillStyle = 'rgba(20,24,32,0.85)';
    miniCtx.fillRect(0, 0, mw, mh);
    // Sand-coloured blocks so the dark roads read at a glance.
    miniCtx.fillStyle = '#d8cbb0';
    miniCtx.fillRect(0, 0, C.WORLD_W * s, C.WORLD_H * s);
    miniCtx.fillStyle = '#3c4148';
    for (var i = 0; i <= C.COLS; i++) miniCtx.fillRect(i * C.PITCH * s, 0, C.ROAD_W * s, mh);
    for (var j = 0; j <= C.ROWS; j++) miniCtx.fillRect(0, j * C.PITCH * s, mw, C.ROAD_W * s);
    miniCtx.fillStyle = '#f2e2b8';
    miniCtx.fillRect(0, C.WORLD_H * s, mw, C.BEACH_H * s);
    miniCtx.fillStyle = '#57b8d8';
    miniCtx.fillRect(0, (C.WORLD_H + C.BEACH_H - 24) * s, mw, 24 * s);
    var marks = SB.missions.markers;
    for (var k = 0; k < marks.length; k++) {
      miniCtx.fillStyle = '#ffd94d';
      miniCtx.beginPath();
      miniCtx.arc(marks[k].x * s, marks[k].y * s, 5, 0, Math.PI * 2);
      miniCtx.fill();
    }
    var cars = SB.cars.list;
    for (var c = 0; c < cars.length; c++) {
      if (cars[c].kind !== 'police') continue;
      miniCtx.fillStyle = (Math.floor(Date.now() / 300) % 2 === 0) ? '#ff3b30' : '#2f7fc9';
      miniCtx.beginPath();
      miniCtx.arc(cars[c].x * s, cars[c].y * s, 4, 0, Math.PI * 2);
      miniCtx.fill();
    }
    var p = SB.player.state;
    miniCtx.fillStyle = '#ffffff';
    miniCtx.beginPath();
    miniCtx.arc(p.x * s, p.y * s, 4.5, 0, Math.PI * 2);
    miniCtx.fill();
    miniCtx.strokeStyle = '#ffd94d';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    miniCtx.arc(p.x * s, p.y * s, 6.5, 0, Math.PI * 2);
    miniCtx.stroke();
  }

  /** True when a world rect overlaps the visible viewport. */
  function onScreen(x, y, w, h) {
    return x + w > camera.x - 20 && x < camera.x + viewW + 20 && y + h > camera.y - 20 && y < camera.y + viewH + 20;
  }

  SB.render = {
    init: init,
    resize: resize,
    updateCamera: updateCamera,
    draw: draw,
    burst: burst,
    addSkid: addSkid,
    muzzle: muzzle,
    camera: camera,
    get viewW() { return viewW; },
    get viewH() { return viewH; }
  };
})();
