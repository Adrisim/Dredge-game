// Fishing / dredging / crab-pot / relic spots. Fixed by seed; usage is tracked in game state.
import { SEED, WORLD_RADIUS } from '../config.js';
import { mulberry32, TAU } from '../util/math.js';
import { islands, towns, heightAt, isClearWater, findWater, shoreDistance, zoneAt, getTown } from './worldgen.js';
import { MAIN } from '../game/quests.js';

export const spots = [];
export const spotById = new Map();
const grid = new Map();
const CELL = 250;
const key = (cx, cz) => cx * 92837111 ^ cz * 689287499;
let nextId = 1;

function addSpot(o) {
  o.id = nextId++;
  o.zone = zoneAt(o.x, o.z);
  spots.push(o);
  spotById.set(o.id, o);
  const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL));
  let l = grid.get(k);
  if (!l) grid.set(k, (l = []));
  l.push(o);
  return o;
}

export function spotsNear(x, z, r) {
  const out = [];
  const c0x = Math.floor((x - r) / CELL), c1x = Math.floor((x + r) / CELL);
  const c0z = Math.floor((z - r) / CELL), c1z = Math.floor((z + r) / CELL);
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cz = c0z; cz <= c1z; cz++) {
      const l = grid.get(key(cx, cz));
      if (!l) continue;
      for (const s of l) if ((s.x - x) ** 2 + (s.z - z) ** 2 <= r * r) out.push(s);
    }
  }
  return out;
}

(function generate() {
  const rng = mulberry32(SEED ^ 0x5eed);
  const ann = [[120, 1100], [1100, 2300], [2300, 3400], [3400, WORLD_RADIUS - 220]];

  const sampleIn = (zone, tries, test, nearIsland = 0.5) => {
    for (let t = 0; t < tries; t++) {
      let x, z;
      if (rng() < nearIsland) {
        const cands = islands.filter((i) => i.kind !== 'reef' && i.kind !== 'stack' && i.zone === zone);
        if (!cands.length) continue;
        const isl = cands[Math.floor(rng() * cands.length)];
        const a = rng() * TAU, d = isl.R * (1.05 + rng() * 0.75);
        x = isl.x + Math.cos(a) * d; z = isl.z + Math.sin(a) * d;
      } else {
        const [r0, r1] = ann[zone - 1];
        const r = Math.sqrt(r0 * r0 + rng() * (r1 * r1 - r0 * r0)), a = rng() * TAU;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
      }
      if (zoneAt(x, z) !== zone) continue;
      if (test(x, z)) return { x, z };
    }
    return null;
  };

  // Fishing spots
  const FISH = [60, 72, 72, 62];
  for (let zone = 1; zone <= 4; zone++) {
    for (let i = 0; i < FISH[zone - 1]; i++) {
      const p = sampleIn(zone, 80, (x, z) => isClearWater(x, z, 18, -3), 0.55);
      if (!p) continue;
      const kind = shoreDistance(p.x, p.z) < 230 ? 'shore' : 'open';
      const aberrant = zone >= 2 && rng() < 0.3;
      addSpot({ type: 'fish', x: p.x, z: p.z, kind, aberrant, rich: rng() < 0.12, max: 3 + Math.floor(rng() * 3), r: 11 });
    }
  }
  // Dredge spots
  const DRED = [24, 28, 30, 26];
  for (let zone = 1; zone <= 4; zone++) {
    for (let i = 0; i < DRED[zone - 1]; i++) {
      const p = sampleIn(zone, 80, (x, z) => isClearWater(x, z, 20, -4), 0.45);
      if (p) addSpot({ type: 'dredge', x: p.x, z: p.z, max: 2 + Math.floor(rng() * 2), r: 13 });
    }
  }
  // Crab pot spots (shallows only)
  const CRAB = [26, 24, 18, 0];
  for (let zone = 1; zone <= 3; zone++) {
    for (let i = 0; i < CRAB[zone - 1]; i++) {
      const p = sampleIn(zone, 200, (x, z) => { const h = heightAt(x, z); return h < -2.6 && h > -9 && isClearWater(x, z, 8, -2.4); }, 0.95);
      if (p) addSpot({ type: 'crab', x: p.x, z: p.z, kind: 'shore', max: 1, r: 8 });
    }
  }

  // Starter spots around Saltmere so the first minutes are obvious
  const home = getTown('saltmere');
  const b = home.dock.boat, d = home.dock;
  const place = (type, fwd, side, extra = {}) => {
    const p = findWater(b.x + d.dx * fwd - d.dz * side, b.z + d.dz * fwd + d.dx * side, 18, -4);
    return addSpot({ type, x: p.x, z: p.z, r: type === 'dredge' ? 13 : type === 'crab' ? 8 : 11, max: 4, kind: 'shore', ...extra });
  };
  place('fish', 130, 20, { rich: false });
  place('fish', 210, -70);
  place('fish', 90, -120);
  place('fish', 320, 90);
  place('dredge', 170, 120);
  place('dredge', 260, -150);
  place('crab', 100, 160);

  // Lens fragment (main quest) sites
  MAIN.lensApprox.forEach(([x, z], i) => {
    const p = findWater(x, z, 26, -6);
    addSpot({ type: 'lens', lens: i + 1, x: p.x, z: p.z, max: 1, r: 14 });
  });
})();

export const lensSpots = spots.filter((s) => s.type === 'lens');
void towns;

/** Is this spot currently usable? `abs` = absolute game hours. */
export function spotAvailable(spot, state, abs, isNight) {
  if (spot.type === 'fish' && spot.aberrant && !isNight) return false;
  if (spot.type === 'lens') {
    if (state.main.stage < 1) return false;
    return !state.main.have[spot.lens - 1];
  }
  if (spot.type === 'crab') return true;
  const rec = state.spots[spot.id];
  if (rec && rec.until > abs) return false;
  return true;
}

export function useSpot(spot, state, abs) {
  const rec = (state.spots[spot.id] = state.spots[spot.id] || { used: 0, until: 0 });
  rec.used++;
  if (rec.used >= spot.max) { rec.until = abs + 20; rec.used = 0; }
}
