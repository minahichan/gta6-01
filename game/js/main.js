// Solara Bay — boot and main loop: world setup, state machine, autosave.
// States: menu → playing ⇄ paused → busted / wasted → menu.
// Round 2: untouched logic — the round-1 fix is in main.ts only.
(function () {
  'use strict';

  var U = SB.util;

  var gameState = 'menu'; // menu | playing | paused | busted | wasted
  var lastT = 0;
  var saveTimer = 0;
  var booted = false;

  /** Build the world, wire the UI, show the menu. */
  function boot() {
    if (booted) return;
    booted = true;
    var canvas = document.getElementById('game');
    var mini = document.getElementById('minimap');
    SB.city.generate();
    SB.render.init(canvas, mini);
    SB.input.init(canvas);
    SB.ui.init();
    SB.cars.createWorld();
    SB.peds.createWorld();
    SB.police.reset();
    var plaza = SB.city.data.landmarks.plaza;
    SB.player.reset({ x: plaza.x, y: plaza.y + 60 });
    SB.missions.reset();
    SB.missions.scatterMedkits();
    SB.render.updateCamera(1);
    SB.ui.showMenu(SB.ui.hasSave());
    SB.audio.startMusic();
    window.__solaraReady = true;
    requestAnimationFrame(loop);
  }

  /** Start a new game, or continue from the save. */
  function startGame(continueSave) {
    var save = continueSave ? SB.ui.loadGame() : null;
    SB.audio.stopMusic();
    SB.audio.ensureAudio();
    if (save) {
      SB.player.state.cash = save.cash || 250;
      SB.player.state.health = save.health || 100;
      SB.player.state.ammo = save.ammo || 24;
      SB.player.state.x = save.x;
      SB.player.state.y = save.y;
      // Resume the story from the saved job (no reward replay).
      SB.missions.reset();
      SB.missions.skipToMission(save.missionIndex || 0);
    } else {
      SB.player.state.cash = 250;
      SB.player.state.health = 100;
      SB.player.state.ammo = 24;
      var plaza = SB.city.data.landmarks.plaza;
      SB.player.reset({ x: plaza.x, y: plaza.y + 60 });
      SB.police.reset();
      SB.missions.reset();
    }
    // A demo parameter stages a screenshot scene instead of normal play.
    SB.demo.stage();
    SB.ui.hideMenu();
    SB.ui.showPause(false);
    gameState = 'playing';
    SB.render.updateCamera(1);
    lastT = performance.now();
  }

  /** Pause or resume. */
  function togglePause() {
    if (gameState === 'playing') {
      gameState = 'paused';
      SB.ui.showPause(true);
      SB.audio.setSiren(false);
      SB.audio.stopEngine();
    } else if (gameState === 'paused') {
      gameState = 'playing';
      SB.ui.showPause(false);
      if (SB.police.getWanted() > 0) SB.audio.setSiren(true);
    }
  }

  /** Back to the menu from pause or game over. */
  function quitToMenu() {
    gameState = 'menu';
    SB.ui.showPause(false);
    SB.ui.showMenu(SB.ui.hasSave());
    SB.audio.startMusic();
    SB.audio.setSiren(false);
    SB.audio.stopEngine();
  }

  /** The player was busted or wasted: fine, restart the job, menu. */
  function gameOver(kind) {
    gameState = kind;
    SB.player.state.cash = Math.max(0, SB.player.state.cash - 150);
    SB.ui.saveGame();
    SB.ui.showGameOver(kind);
    SB.audio.setSiren(false);
    SB.audio.stopEngine();
  }

  /** One frame: update the world, draw it, update the HUD. */
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;

    if (SB.input.wasPressed('Escape')) {
      if (gameState === 'playing' || gameState === 'paused') togglePause();
    }
    if (SB.input.wasPressed('m')) {
      SB.audio.toggleMute();
      SB.ui.flash(SB.audio.isMuted() ? 'Sound muted' : 'Sound on');
    }

    if (gameState === 'playing') {
      SB.player.update(dt);
      SB.cars.update(dt);
      SB.peds.update(dt);
      SB.police.update(dt);
      SB.missions.update(dt);
      SB.render.updateCamera(dt);
      saveTimer += dt;
      if (saveTimer > 15) {
        saveTimer = 0;
        SB.ui.saveGame();
      }
      if (SB.player.state.dead) gameOver('wasted');
      else if (SB.player.state.busted) gameOver('busted');
    }

    if (gameState === 'playing' || gameState === 'paused') {
      SB.render.draw();
      SB.ui.update(dt);
    }
    SB.input.endFrame();
  }

  /** Current top-level state, for tests and the demo stager. */
  function getState() {
    return gameState;
  }

  document.addEventListener('DOMContentLoaded', boot);

  SB.main = {
    boot: boot,
    startGame: startGame,
    togglePause: togglePause,
    quitToMenu: quitToMenu,
    gameOver: gameOver,
    getState: getState
  };
})();
