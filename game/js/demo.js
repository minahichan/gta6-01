// Solara Bay — screenshot staging: ?demo=cover|chase|foot|mission.
// The game renders its own systems in a chosen moment (a chase, a job, a
// walk through the plaza) so its maker can capture honest screenshots.
// Normal play never passes a demo parameter.
// Round 2: untouched logic — the round-1 fix is in main.ts only.
(function () {
  'use strict';

  var U = SB.util;

  /** Read the demo parameter from the page URL. */
  function demoParam() {
    try {
      return new URLSearchParams(window.location.search).get('demo') || '';
    } catch (e) {
      return '';
    }
  }

  /** Stage a scene after the world loads; returns true when a demo ran. */
  function stage() {
    var kind = demoParam();
    if (!kind) return false;
    var C = SB.city;
    var P = SB.player.state;
    var rng = U.makeRng(5150);

    if (kind === 'cover') {
      // Golden-hour drive down Harbor Blvd: traffic, peds, one star of heat.
      var car = SB.cars.spawnParked(false);
      car.x = 4 * C.PITCH + C.ROAD_W / 2;
      car.y = 5 * C.PITCH + C.ROAD_W / 2 + 200;
      car.angle = Math.PI / 2;
      car.model = 'sports';
      car.color = '#2f7fc9';
      SB.cars.setPlayerCar(car);
      P.onFoot = false;
      P.car = car;
      P.x = car.x;
      P.y = car.y;
      car.speed = 260;
      SB.police.setWanted(1);
      SB.cars.spawnPoliceCar(car.x, car.y - 320);
      SB.missions.reset();
      SB.ui.clearBanner(); // hide the job banner so the shot shows the drive
      return true;
    }

    if (kind === 'chase') {
      // Full chase: three stars, two cruisers on the player's tail.
      var taxi = SB.cars.spawnParked(false);
      taxi.x = 7 * C.PITCH + C.ROAD_W / 2;
      taxi.y = 6 * C.PITCH + C.ROAD_W / 2;
      taxi.angle = 0;
      taxi.model = 'taxi';
      SB.cars.setPlayerCar(taxi);
      P.onFoot = false;
      P.car = taxi;
      P.x = taxi.x;
      P.y = taxi.y;
      taxi.speed = 300;
      SB.police.setWanted(3);
      var c1 = SB.cars.spawnPoliceCar(taxi.x - 260, taxi.y + 30);
      c1.speed = 300;
      var c2 = SB.cars.spawnPoliceCar(taxi.x - 420, taxi.y - 40);
      c2.speed = 300;
      SB.police.spawnCop();
      SB.missions.skipToMission(3); // Heat Wave: lose the cops
      SB.ui.clearBanner(); // hide the job banner so the shot shows the chase
      return true;
    }

    if (kind === 'foot') {
      // On foot in Solara Plaza: peds, palms, the first job marker ahead.
      P.x = 6 * C.PITCH + C.ROAD_W + C.BLOCK / 2;
      P.y = 5 * C.PITCH + C.ROAD_W + C.BLOCK / 2 + 60;
      P.angle = -Math.PI / 2;
      SB.missions.reset();
      for (var i = 0; i < 6; i++) SB.peds.spawnPed(true);
      // A shiny sports car parked at the plaza edge, ready to steal.
      var sport = SB.cars.spawnParked(false);
      sport.x = P.x + 150;
      sport.y = P.y + 40;
      sport.angle = Math.PI / 2;
      sport.model = 'sports';
      sport.color = '#c94f43';
      SB.ui.clearBanner(); // hide the job banner so the shot shows the plaza
      return true;
    }

    if (kind === 'mission') {
      // The Big Score: outside Bay Trust Bank, four stars, cruisers closing in.
      var L = C.data.landmarks;
      var sport = SB.cars.spawnParked(false);
      sport.x = L.bank.x;
      sport.y = L.bank.y + 120;
      sport.angle = Math.PI;
      sport.model = 'sports';
      sport.color = '#c94f43';
      SB.cars.setPlayerCar(sport);
      P.onFoot = false;
      P.car = sport;
      P.x = sport.x;
      P.y = sport.y;
      sport.speed = 120;
      SB.police.setWanted(4);
      SB.cars.spawnPoliceCar(sport.x - 300, sport.y);
      SB.cars.spawnPoliceCar(sport.x + 300, sport.y + 60);
      SB.missions.skipToMission(5); // The Big Score: rob the bank, escape
      SB.ui.clearBanner(); // hide the job banner so the shot shows the getaway
      return true;
    }

    return false;
  }

  SB.demo = {
    demoParam: demoParam,
    stage: stage
  };
})();
