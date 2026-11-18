# Solara Bay — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/minahichan/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/minahichan/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

**Solara Bay** is a complete open-world crime game that runs offline in a desktop
browser from its own static files — no network, no build step, no libraries.
You are Danny Reyes, fresh out of the yard, back in the sun-soaked coastal city
of Solara Bay to work for Sol Vega — and to take the city for yourself.

## Play it

Serve `game/` with any static server and open `game/index.html`, or run
`npx serve game` / `python3 -m http.server` from the `game/` folder.
Keyboard and mouse only. Progress saves automatically in the browser.

## What is in the game

- **A living city**: a procedurally built grid of streets, avenues, parks,
  a plaza, a marina, a beach and the sea — every playthrough shares the same
  streets, so every mission marker lands on a real place.
- **On foot and by car**: walk, run, steal any parked or driven car, drive
  with arcade physics, drift, honk, and hop out whenever you like.
- **Traffic and pedestrians**: cars cruise the grid and turn at intersections,
  pedestrians stroll the sidewalks and flee gunfire, crashes and sirens.
- **Wanted system**: the SBPD responds with stars — foot officers chase you
  down, cruisers ram your car, and the heat only cools when you stay out of
  sight. Hit a pedestrian or shoot near a cop and the stars climb.
- **Missions and story**: six jobs for Sol Vega — meet her at La Luna Bar,
  jack a car for the paint shop, run a package against the clock, lose a
  three-star heat, scoop five cash drops, then rob Bay Trust Bank and escape
  to the safehouse. After the story, repeatable courier gigs keep paying.
- **Combat**: pistol with ammo, punches, and a car itself as a weapon.
- **HUD and minimap**: health, cash, ammo, wanted stars, street name, speed,
  mission tracker with timer, and a live minimap with mission and police blips.
- **Sound**: fully synthesized WebAudio — engine hum, sirens, gunshots,
  crashes, horns and a lazy menu bass loop. No audio files. `M` mutes.
- **Save**: cash, job progress, position and health persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| E | Steal / enter car, exit car |
| Mouse | Aim, click to shoot |
| F | Punch |
| H | Horn |
| M | Mute |
| Esc | Pause |

## Structure

The game is plain Canvas 2D, written from scratch with no engine and no
vendored library — one file per job, all under `game/js/`:

- `util.js` — math, RNG and collision helpers
- `audio.js` — synthesized WebAudio effects and music
- `city.js` — procedural city generation and street queries
- `input.js` — keyboard and mouse state
- `player.js` — on-foot movement, combat, bullets, busted/wasted
- `cars.js` — driving physics, traffic AI, parked cars, police cruisers
- `peds.js` — pedestrian AI: strolling, fleeing, getting knocked down
- `police.js` — wanted stars, officer AI, heat and cooldown
- `missions.js` — the six-job story arc and repeatable gigs
- `render.js` — world renderer, camera, effects and minimap
- `ui.js` — HUD, menus, banners and saving
- `demo.js` — `?demo=` scene staging for screenshots
- `main.js` — boot, state machine and main loop

`main.ts` hands the entry in: it copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with `vendor/makefun-game.ts`,
make.fun's own library, unchanged from the kit.

## Screenshots

The four screenshots under `screenshots/` are real renders of this game
running in a desktop browser: a golden-hour drive, a three-star police chase,
a walk through Solara Plaza, and the Big Score outside Bay Trust Bank.

## Development

Build the entry locally with Node 22 (no install, no network):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Run it twice and compare the two `dossier.json` files — they must be byte
identical. Take fresh screenshots by serving `game/` and opening it in a
desktop browser; `?demo=cover|chase|foot|mission` stages a scene for the shot.

## License

MIT — see [LICENSE](LICENSE). Solara Bay is an original game: its city,
characters, vehicles, names, story, art and sounds are its own, with nothing
taken from any commercial game.
