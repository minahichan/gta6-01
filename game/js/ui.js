// Solara Bay — HUD and menus: health, cash, wanted stars, mission tracker,
// contextual hints, banners, start/pause/game-over screens, and saving.
(function () {
  'use strict';

  var U = SB.util;

  var els = {};
  var flashText = '';
  var flashT = 0;
  var bannerTitle = '';
  var bannerText = '';
  var bannerT = 0;
  var hintText = '';

  /** Cache the DOM nodes the HUD updates every frame. */
  function init() {
    var ids = ['hud', 'health-fill', 'health-num', 'cash', 'stars', 'objective',
      'objective-title', 'timer', 'hint', 'flash', 'banner', 'banner-title',
      'banner-text', 'menu', 'menu-title', 'menu-body', 'menu-start', 'menu-continue',
      'menu-note', 'pause', 'speed', 'street', 'ammo'];
    for (var i = 0; i < ids.length; i++) {
      els[ids[i]] = document.getElementById(ids[i]);
    }
    els['menu-start'].addEventListener('click', function () {
      SB.audio.ensureAudio();
      SB.audio.playClick();
      SB.main.startGame(false);
    });
    els['menu-continue'].addEventListener('click', function () {
      SB.audio.ensureAudio();
      SB.audio.playClick();
      SB.main.startGame(true);
    });
    // Enter starts the game from the menu, too.
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && SB.main.getState() === 'menu' && !els['menu'].classList.contains('hidden')) {
        SB.audio.ensureAudio();
        SB.main.startGame(false);
      }
    });
    els['pause'].querySelector('[data-resume]').addEventListener('click', function () {
      SB.main.togglePause();
    });
    els['pause'].querySelector('[data-quit]').addEventListener('click', function () {
      SB.main.quitToMenu();
    });
  }

  /** A short-lived toast above the HUD. */
  function flash(text) {
    flashText = text;
    flashT = 3;
  }

  /** A big centre banner (mission start, job done, failed). */
  function showBanner(title, text) {
    bannerTitle = title;
    bannerText = text;
    bannerT = 4.5;
  }

  /** Hide the banner at once (screenshot staging). */
  function clearBanner() {
    bannerT = 0;
    els['banner'].classList.add('hidden');
  }

  /** Show the start menu; Continue only when a save exists. */
  function showMenu(hasSave) {
    els['menu'].classList.remove('hidden');
    els['hud'].classList.add('hidden');
    els['menu-continue'].style.display = hasSave ? 'inline-block' : 'none';
    els['menu-title'].textContent = 'SOLARA BAY';
    els['menu-body'].innerHTML =
      'Sun, surf and trouble. You are <b>Danny Reyes</b>, fresh out of the yard, ' +
      'back in Solara Bay to work for <b>Sol Vega</b> — and to take the city for yourself.<br><br>' +
      '<b>WASD / arrows</b> move &amp; drive &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>E</b> steal / exit car<br>' +
      '<b>Mouse</b> aim &amp; shoot &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>H</b> horn &nbsp;·&nbsp; <b>M</b> mute &nbsp;·&nbsp; <b>Esc</b> pause<br><br>' +
      'Steal cars, run jobs for Sol, dodge the SBPD, and mind your wanted stars. ' +
      'Your progress saves automatically.';
    els['menu-note'].textContent = 'An original game. No Rockstar names, maps or assets — just Solara Bay.';
  }

  /** Hide the menu and show the HUD. */
  function hideMenu() {
    els['menu'].classList.add('hidden');
    els['hud'].classList.remove('hidden');
  }

  /** Show the pause panel. */
  function showPause(show) {
    els['pause'].classList.toggle('hidden', !show);
  }

  /** Game-over panel for busted / wasted. */
  function showGameOver(kind) {
    els['menu'].classList.remove('hidden');
    els['hud'].classList.add('hidden');
    els['menu-continue'].style.display = 'none';
    if (kind === 'busted') {
      els['menu-title'].textContent = 'BUSTED';
      els['menu-body'].innerHTML = 'The SBPD caught up with you. Sol posted bail — but the heat cost you ' +
        '<b>$150</b> and your current job restarts.<br><br>Press <b>Start</b> to get back on the streets.';
    } else {
      els['menu-title'].textContent = 'WASTED';
      els['menu-body'].innerHTML = 'Solara Bay chewed you up. The clinic patched you up for <b>$150</b> ' +
        'and your current job restarts.<br><br>Press <b>Start</b> to get back on the streets.';
    }
    els['menu-start'].textContent = 'Back on the streets';
    els['menu-note'].textContent = '';
  }

  /** Update every HUD element from the live game state. */
  function update(dt) {
    flashT = Math.max(0, flashT - dt);
    bannerT = Math.max(0, bannerT - dt);
    var p = SB.player.state;
    var wanted = SB.police.getWanted();

    els['health-fill'].style.width = p.health + '%';
    els['health-fill'].style.background = p.health > 50 ? '#6ab86a' : (p.health > 25 ? '#e2b84c' : '#e2574c');
    els['health-num'].textContent = Math.ceil(p.health);
    els['cash'].textContent = U.formatMoney(p.cash);
    els['ammo'].textContent = p.hasGun ? ('Ammo ' + p.ammo) : '';

    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
    els['stars'].textContent = stars;
    els['stars'].className = wanted > 0 ? 'hot' : '';

    var m = SB.missions.currentMission();
    els['objective-title'].textContent = m.title;
    els['objective'].textContent = m.objective;
    els['timer'].textContent = SB.missions.timeLeft > 0 ? U.formatTime(SB.missions.timeLeft) : '';

    var car = SB.cars.getPlayerCar();
    if (car) {
      els['speed'].textContent = Math.abs(Math.round(car.speed * 0.14)) + ' mph';
    } else {
      els['speed'].textContent = '';
    }
    els['street'].textContent = SB.city.streetNameAt(p.x, p.y);

    // Contextual hint line.
    var hint = '';
    if (p.onFoot) {
      var near = SB.cars.nearestStealable(p.x, p.y, 64);
      if (near) hint = 'E — steal the ' + near.model;
      else if (SB.missions.markers.length > 0) hint = 'Follow the yellow marker';
    } else {
      hint = 'E — exit car · H — horn';
    }
    if (hint !== hintText) {
      hintText = hint;
      els['hint'].textContent = hint;
    }

    els['flash'].textContent = flashT > 0 ? flashText : '';
    els['flash'].style.opacity = flashT > 0 ? '1' : '0';

    if (bannerT > 0) {
      els['banner'].classList.remove('hidden');
      els['banner-title'].textContent = bannerTitle;
      els['banner-text'].textContent = bannerText;
    } else {
      els['banner'].classList.add('hidden');
    }
  }

  /** Save cash, mission progress and position to localStorage. */
  function saveGame() {
    try {
      var p = SB.player.state;
      var save = {
        cash: p.cash,
        missionIndex: SB.missions.missionIndex,
        storyDone: SB.missions.storyDone,
        x: p.x, y: p.y,
        health: p.health,
        ammo: p.ammo,
        savedAt: Date.now()
      };
      localStorage.setItem('solara-bay-save-v1', JSON.stringify(save));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Load a save, or null when there is none. */
  function loadGame() {
    try {
      var raw = localStorage.getItem('solara-bay-save-v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** True when a save exists. */
  function hasSave() {
    return loadGame() !== null;
  }

  SB.ui = {
    init: init,
    update: update,
    flash: flash,
    showBanner: showBanner,
    clearBanner: clearBanner,
    showMenu: showMenu,
    hideMenu: hideMenu,
    showPause: showPause,
    showGameOver: showGameOver,
    saveGame: saveGame,
    loadGame: loadGame,
    hasSave: hasSave
  };
})();
