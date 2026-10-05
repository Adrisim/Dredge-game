# Hollow Tide

A mobile-first fishing & exploration game in the spirit of *Dredge*, built with **three.js** and vanilla JS.
Sail a huge hand-seeded archipelago, fish at bubbling spots, pack your catch into a tetris-style hold,
dredge the seabed, set crab pots, upgrade your boat, and survive the dread that creeps in after dark.

```bash
npm install
npm run dev            # dev server (opens on your LAN so you can test on a phone)
npm run build          # static site in dist/ (relative paths: host anywhere)
npm run build:single   # ALSO writes dist/hollow-tide.html - one self-contained file
```

## What's in the game

| Dredge mechanic | Hollow Tide |
| --- | --- |
| **Huge sea, towns** | ~8.6 km wide sea, 300+ islands/rocks/reefs/sea-stacks, 8 towns + a dead lighthouse, four zones (Shallows -> Kelp Marches -> Open Ocean -> Abyssal Reach). Procedural, deterministic from a seed. |
| **Fishing minigame** | Cast at glowing spots, then tap **REEL** when the rotating needle crosses the gold arc. Perfect hits count double. Fish have behaviours: *darting*, *reversing*, *shrinking zones*, *decoy lures*. Better rods = wider zones, slower needle, more line. |
| **Tetris cargo** | Every catch is a polyomino. Drag pieces into the hold, tap to rotate, drag to the bin to discard. Damaged (hatched) cells can't hold cargo until repaired. Hold upgrades grow the grid. |
| **Dredging** | Dark seabed patches yield scrap, driftwood, ore, pearls, relics - the materials for upgrades. Needs a dredge net. |
| **Crab pots** | Deploy pots on brown-ringed shallow spots, come back after ~3.5 game-hours to haul them. |
| **Day/night & panic** | Dawn/dusk/night cycle with stars, moon, glowing windows, lighthouse beams. In the dark - or in storms/fog - **dread** rises; at max, ghosts hunt your hull. A lamp slows dread, a bed ashore resets it. |
| **Aberrations** | After dark, purple glowing spots hold mutated fish with nastier minigames and big payouts. |
| **Hull & wrecks** | Rocks and ghosts cost hull points and can crack cargo cells. At 0 you are towed home minus half your cargo and some coin. |
| **Economy** | Per-town "in demand" species (+40%), a market, a shipyard (7 upgrade tracks that consume cash **and** salvaged materials), job boards, a ferry between discovered harbours, a tavern with rumours and sleep. |
| **Story** | Recover four lens fragments from wrecks across the zones and relight the Hollow Light. |

### Controls

* **Left stick** - up/down throttle, left/right steer (like Dredge's tank steering). **Chevron button** = cruise control.
* **Drag** the right side of the screen to look around, **pinch** to zoom.
* **Map** (top-right minimap): tap a town or anywhere on the sea to set a waypoint, then **Autopilot** to sail there avoiding rocks.
* Contextual round buttons (bottom-right): **Dock / Fish / Dredge / Set pot / Haul pot**.
* Desktop: `WASD`/arrows to sail, `Space`/`E` to act, `L` lamp, `M` map, `C` cargo, `V` cruise, `Esc` menu.
* Portrait and landscape layouts, safe-area aware, vibration feedback, wake-lock while playing.
* Progress autosaves (localStorage) whenever you dock and every ~45 s at sea.

## Project layout

```
src/
  main.js                 entry (mobile gesture/wake-lock hardening)
  config.js               world size, day length, save key
  audio.js                procedural WebAudio: sea, wind, engine, dread drone, sfx
  world/
    worldgen.js           seeded islands, towns, docks, zones + the terrain height function
    islandMesh.js         terrain mesh + shallows/foam shader (land & shallows share one geometry)
    decor.js              trees, buildings, piers, lighthouses merged into few draw calls
    islandManager.js      streams islands in/out around the player
    water.js sky.js       custom shaders (waves, fresnel, glints, lamp pool / sky, sun, moon, stars, clouds)
    environment.js        day-night keyframes, lights, fog, weather + rain
    spots.js spotsView.js fishing/dredge/crab/relic spots and their pooled visuals
    mapdata.js            pre-rendered world map + fog of war
  entities/
    boat.js               procedural boat, physics, terrain collision, wake
    ambient.js            gulls, bobber & line, dread ghosts
  game/
    game.js               the orchestrator: loop, fishing/dredge/pots/panic/wrecks/quests/save
    items.js inventory.js fish & item database, loot rolls, polyomino grid logic
    fishing.js            pure minigame logic
    upgrades.js quests.js state.js
  ui/                     hud, joystick, fishing dial, cargo drag-drop, town, map, menus (plain DOM + SVG)
```

Everything visual is generated in code (geometry, shaders, SVG icons, audio) - no asset files.

## Tuning

* `src/config.js` - `WORLD_RADIUS`, `DAY_SECONDS` (default 10 real minutes per day).
* `src/game/items.js` - fish values, shapes and minigame difficulty (`fight: F(hits, zoneDeg, speedDegPerSec, special)`).
* `src/game/upgrades.js` - costs, required materials and stat curves.
* Settings -> Graphics: *Auto* adapts the render resolution to hold ~50 fps on phones.

`window.__game` is exposed for debugging; `game.simulate(seconds)` steps the simulation without rendering,
which is how the headless Playwright smoke tests drive fishing, dredging, docking, wrecks and long autopilot voyages.
