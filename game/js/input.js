// Solara Bay — keyboard and mouse input, with edge-triggered presses.
// Round 2: untouched logic — the round-1 fix is in main.ts only.
(function () {
  'use strict';

  var keys = {};
  var pressed = {};
  var mouse = { x: 0, y: 0, down: false, clicked: false };
  var anyKey = false;

  /** Bind listeners to the window and the canvas. */
  function init(canvas) {
    window.addEventListener('keydown', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!keys[k]) pressed[k] = true;
      keys[k] = true;
      anyKey = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = false;
    });
    window.addEventListener('blur', function () {
      keys = {};
    });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', function (e) {
      mouse.down = true;
      mouse.clicked = true;
      mouse.x = e.clientX - canvas.getBoundingClientRect().left;
      mouse.y = e.clientY - canvas.getBoundingClientRect().top;
      anyKey = true;
    });
    window.addEventListener('mouseup', function () {
      mouse.down = false;
    });
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  }

  /** True while the key is held. */
  function isDown(k) {
    return !!keys[k];
  }

  /** True while any of the listed keys is held. */
  function isDownAny(list) {
    for (var i = 0; i < list.length; i++) {
      if (keys[list[i]]) return true;
    }
    return false;
  }

  /** True only on the frame the key went down. */
  function wasPressed(k) {
    return !!pressed[k];
  }

  /** True when any movement key is held. */
  function moveVector() {
    var x = 0, y = 0;
    if (keys['a'] || keys['ArrowLeft']) x -= 1;
    if (keys['d'] || keys['ArrowRight']) x += 1;
    if (keys['w'] || keys['ArrowUp']) y -= 1;
    if (keys['s'] || keys['ArrowDown']) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x: x, y: y };
  }

  /** Clear edge-triggered state; call once per frame after update. */
  function endFrame() {
    pressed = {};
    mouse.clicked = false;
  }

  /** True when the player has pressed anything since the last check. */
  function consumeAnyKey() {
    var v = anyKey;
    anyKey = false;
    return v;
  }

  SB.input = {
    init: init,
    isDown: isDown,
    isDownAny: isDownAny,
    wasPressed: wasPressed,
    moveVector: moveVector,
    endFrame: endFrame,
    consumeAnyKey: consumeAnyKey,
    mouse: mouse
  };
})();
