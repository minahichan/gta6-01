// Solara Bay — missions and story: six jobs for Sol Vega, then repeatable gigs.
// Each mission sets markers, a timer and a win condition; the HUD reads
// currentMission for its title and objective line.
(function () {
  'use strict';

  var U = SB.util;
  var C = null;

  var pickups = [];   // cash drops and medkits on the ground
  var markers = [];   // world/minimap markers for the active mission
  var missionIndex = 0;
  var stage = 0;      // progress inside the current mission
  var timeLeft = 0;
  var banner = '';
  var bannerT = 0;
  var storyDone = false;
  var gigCooldown = 0;

  /** Mission catalogue: title, briefing, objective, reward. */
  var MISSIONS = [
    {
      id: 'meet-sol', title: 'Meet Sol',
      briefing: 'Fresh out of the yard, Danny. Sol Vega runs La Luna Bar — go say hello.',
      objective: 'Drive or walk to La Luna Bar',
      reward: 100
    },
    {
      id: 'hot-wheels', title: 'Hot Wheels',
      briefing: 'Sol needs wheels. Jack any car on the street, then bring it to Spray & Shine.',
      objective: 'Steal a car, then reach the paint shop',
      reward: 200
    },
    {
      id: 'the-package', title: 'The Package',
      briefing: 'A package is waiting at Marina Docks. Pick it up and drop it at Palms Motel. Fast — the clock is ticking.',
      objective: 'Pick up the package, deliver it to the motel',
      reward: 350
    },
    {
      id: 'heat-wave', title: 'Heat Wave',
      briefing: 'Somebody talked. The SBPD is all over you — lose the heat and get clean.',
      objective: 'Lose the cops: get your wanted level to zero',
      reward: 400
    },
    {
      id: 'turf-run', title: 'Turf Run',
      briefing: 'Five cash drops are stashed around Solara Bay. Scoop them all before the timer runs out.',
      objective: 'Collect all 5 cash drops',
      reward: 500
    },
    {
      id: 'big-score', title: 'The Big Score',
      briefing: 'Bay Trust Bank. Walk in, grab the cash, and get out. The whole city will be looking for you — reach the safehouse.',
      objective: 'Rob the bank, then escape to the safehouse',
      reward: 1000
    }
  ];

  /** Start the story over from mission zero. */
  function reset() {
    C = SB.city;
    missionIndex = 0;
    stage = 0;
    timeLeft = 0;
    storyDone = false;
    pickups.length = 0;
    markers.length = 0;
    gigCooldown = 0;
    startMission(0);
  }

  /** Jump the story to mission i without paying rewards (save restore). */
  function skipToMission(i) {
    missionIndex = 0;
    stage = 0;
    timeLeft = 0;
    storyDone = false;
    pickups.length = 0;
    markers.length = 0;
    if (i <= 0) {
      startMission(0);
      return;
    }
    if (i >= MISSIONS.length) {
      missionIndex = MISSIONS.length;
      storyDone = true;
      startGig();
      return;
    }
    for (var k = 0; k < i && k < MISSIONS.length; k++) {
      missionIndex = k;
      stage = 0;
      markers.length = 0;
      pickups.length = 0;
    }
    startMission(Math.min(i, MISSIONS.length - 1));
  }

  /** The mission the player is on now (or the gig board after the story). */
  function currentMission() {
    if (storyDone) return { id: 'gigs', title: 'Street Gigs', objective: 'Take a courier gig from the map marker', reward: 150 };
    return MISSIONS[missionIndex];
  }

  /** Place the markers and timers for a mission. */
  function startMission(i) {
    missionIndex = i;
    stage = 0;
    timeLeft = 0;
    markers.length = 0;
    pickups.length = 0;
    var L = C.data.landmarks;
    var m = MISSIONS[i];
    showBanner(m.title, m.briefing);
    SB.audio.playMissionComplete();
    if (i === 0) markers.push(markerAt(L.bar, 'La Luna Bar'));
    if (i === 1) markers.push(markerAt(L.paintshop, 'Spray & Shine'));
    if (i === 2) markers.push(markerAt(L.docks, 'Marina Docks'));
    if (i === 3) {
      SB.police.setWanted(3);
      markers.length = 0;
    }
    if (i === 4) {
      timeLeft = 180;
      for (var k = 0; k < 5; k++) {
        var pt = C.randomSidewalkPoint(function () { return Math.random(); });
        pickups.push({ x: pt.x, y: pt.y, kind: 'cash', value: 60, taken: false });
        markers.push(markerAt(pt, 'Cash drop'));
      }
    }
    if (i === 5) markers.push(markerAt(L.bank, 'Bay Trust Bank'));
  }

  /** A marker object from a landmark point. */
  function markerAt(pt, label) {
    return { x: pt.x, y: pt.y, label: label, color: '#ffd94d' };
  }

  /** Show a big centre-screen banner for a few seconds. */
  function showBanner(title, text) {
    banner = title;
    bannerT = 4;
    SB.ui.showBanner(title, text);
  }

  /** Complete the current mission: pay out, fanfare, next job. */
  function completeMission() {
    var m = MISSIONS[missionIndex];
    SB.player.state.cash += m.reward;
    SB.audio.playMissionComplete();
    SB.ui.showBanner('Job done: ' + m.title, 'Sol wired you ' + U.formatMoney(m.reward) + '.');
    SB.ui.flash('Earned ' + U.formatMoney(m.reward));
    SB.player.healPlayer(40);
    missionIndex++;
    if (missionIndex >= MISSIONS.length) {
      storyDone = true;
      SB.ui.showBanner('Story complete!', 'You run Solara Bay now. Street gigs keep paying — check the map marker.');
      startGig();
    } else {
      startMission(missionIndex);
    }
  }

  /** Fail the current mission: sting, then restart it. */
  function failMission(reason) {
    SB.audio.playMissionFailed();
    SB.ui.showBanner('Job failed', reason + ' — Sol is giving you one more shot.');
    SB.police.clearHeat();
    startMission(missionIndex);
  }

  /** Start a repeatable courier gig after the story. */
  function startGig() {
    markers.length = 0;
    var spots = [C.data.landmarks.motel, C.data.landmarks.docks, C.data.landmarks.bank, C.data.landmarks.bar];
    var spot = spots[Math.floor(Math.random() * spots.length)];
    markers.push(markerAt(spot, 'Courier drop: ' + spot.name));
    stage = 0;
  }

  /** True when the player stands on a marker. */
  function onMarker(mk, radius) {
    var p = SB.player.state;
    return U.dist(p.x, p.y, mk.x, mk.y) < (radius || 46);
  }

  /** Per-frame mission logic. */
  function update(dt) {
    bannerT = Math.max(0, bannerT - dt);
    gigCooldown = Math.max(0, gigCooldown - dt);

    if (timeLeft > 0) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        failMission('Out of time');
        return;
      }
    }

    // Cash drops and medkits on the ground.
    var p = SB.player.state;
    for (var i = 0; i < pickups.length; i++) {
      var pk = pickups[i];
      if (pk.taken) continue;
      if (U.dist(p.x, p.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        if (pk.kind === 'cash') {
          p.cash += pk.value;
          SB.audio.playPickup();
          SB.ui.flash('Picked up ' + U.formatMoney(pk.value));
        } else {
          SB.player.healPlayer(50);
          SB.player.addAmmo(12);
          SB.audio.playPickup();
          SB.ui.flash('Patched up +50 health, +12 ammo');
        }
        if (missionIndex === 4 && !storyDone) {
          var left = 0;
          for (var j = 0; j < pickups.length; j++) if (!pickups[j].taken && pickups[j].kind === 'cash') left++;
          if (left === 0) completeMission();
        }
      }
    }

    if (storyDone) {
      if (markers.length > 0 && onMarker(markers[0], 46)) {
        p.cash += 150;
        SB.audio.playMissionComplete();
        SB.ui.flash('Gig paid: ' + U.formatMoney(150));
        gigCooldown = 2;
        startGig();
      }
      return;
    }

    var m = MISSIONS[missionIndex];
    if (missionIndex === 0) {
      if (markers.length > 0 && onMarker(markers[0])) completeMission();
    } else if (missionIndex === 1) {
      if (stage === 0 && !p.onFoot) {
        stage = 1;
        markers.length = 0;
        markers.push(markerAt(C.data.landmarks.paintshop, 'Spray & Shine'));
        SB.ui.flash('Nice ride. Now get it to the paint shop.');
      }
      if (stage === 1 && !p.onFoot && markers.length > 0 && onMarker(markers[0], 60)) completeMission();
    } else if (missionIndex === 2) {
      if (stage === 0 && markers.length > 0 && onMarker(markers[0])) {
        stage = 1;
        timeLeft = 150;
        markers.length = 0;
        markers.push(markerAt(C.data.landmarks.motel, 'Palms Motel'));
        SB.ui.flash('Package secured. Deliver it — 2:30 on the clock.');
        SB.audio.playPickup();
      } else if (stage === 1 && markers.length > 0 && onMarker(markers[0])) {
        completeMission();
      }
    } else if (missionIndex === 3) {
      if (SB.police.getWanted() === 0) completeMission();
    } else if (missionIndex === 5) {
      if (stage === 0 && markers.length > 0 && onMarker(markers[0], 52)) {
        stage = 1;
        p.cash += 250;
        SB.police.setWanted(4);
        markers.length = 0;
        markers.push(markerAt(C.data.landmarks.safehouse, 'Reyes Safehouse'));
        SB.ui.showBanner('The vault is open!', 'You grabbed the cash. Four stars — run for the safehouse!');
        SB.audio.playPickup();
      } else if (stage === 1 && markers.length > 0 && onMarker(markers[0], 56)) {
        completeMission();
      }
    }
  }

  /** Scatter a few medkits around the city for the player to find. */
  function scatterMedkits() {
    for (var i = 0; i < 4; i++) {
      var pt = C.randomSidewalkPoint(function () { return Math.random(); });
      pickups.push({ x: pt.x, y: pt.y, kind: 'medkit', value: 0, taken: false });
    }
  }

  SB.missions = {
    MISSIONS: MISSIONS,
    reset: reset,
    update: update,
    currentMission: currentMission,
    skipToMission: skipToMission,
    scatterMedkits: scatterMedkits,
    showBanner: showBanner,
    get markers() { return markers; },
    get pickups() { return pickups; },
    get missionIndex() { return missionIndex; },
    get timeLeft() { return timeLeft; },
    get storyDone() { return storyDone; },
    get banner() { return banner; },
    get bannerT() { return bannerT; }
  };
})();
