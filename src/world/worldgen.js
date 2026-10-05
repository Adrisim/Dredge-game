// Procedural world definition: islands, towns, zones and the terrain height function.
// Everything here is deterministic from SEED so saves only need to store player state.
import { SEED, WORLD_RADIUS } from '../config.js';
import { mulberry32, fbm2, smoothstep, hash2, TAU } from '../util/math.js';

export const ZONES = [
  { id: 1, name: 'The Shallows', maxR: 1100, color: '#5fd0c8' },
  { id: 2, name: 'Kelp Marches', maxR: 2300, color: '#7ed36b' },
  { id: 3, name: 'Open Ocean', maxR: 3400, color: '#5b8cff' },
  { id: 4, name: 'The Abyssal Reach', maxR: 99999, color: '#b36bff' },
];

export function zoneAt(x, z) {
  const r = Math.hypot(x, z);
  for (const zn of ZONES) if (r < zn.maxR) return zn.id;
  return 4;
}
export const zoneName = (id) => ZONES[id - 1].name;

export const TOWN_DEFS = [
  { id: 'saltmere', name: 'Saltmere', x: 0, z: 0, R: 135, P: 7, zone: 1, style: 'fishing',
    boost: ['mackerel', 'cod', 'perch'], blurb: 'A sleepy harbour of salt-bleached roofs. Home.' },
  { id: 'gullhaven', name: 'Gullhaven', x: 900, z: -380, R: 120, P: 7, zone: 1, style: 'fishing',
    boost: ['flounder', 'sardine', 'brown_crab'], blurb: 'Loud with gulls and louder with gossip.' },
  { id: 'barrowfen', name: 'Barrowfen', x: -1350, z: 750, R: 145, P: 7, zone: 2, style: 'marsh',
    boost: ['snapper', 'sea_trout', 'lobster'], blurb: 'Stilt-houses over a drowned marsh. Lanterns burn all day.' },
  { id: 'cinder', name: 'Cinder Quay', x: 1500, z: 1700, R: 160, P: 7, zone: 2, style: 'volcanic', hillH: 46,
    boost: ['red_mullet', 'haddock', 'copper_ore'], blurb: 'A forge-town in the shadow of a sleeping volcano.' },
  { id: 'paleanchor', name: 'Pale Anchor', x: -2500, z: -1800, R: 150, P: 7, zone: 3, style: 'pale',
    boost: ['tuna', 'mahi_mahi', 'barracuda'], blurb: 'Bone-white cliffs and a rusted anchor the size of a house.' },
  { id: 'thornwick', name: 'Thornwick', x: 2500, z: -1800, R: 150, P: 7, zone: 3, style: 'pine',
    boost: ['swordfish', 'sunfish', 'deep_crystal'], blurb: 'Pine-clad and proud. They pay well for the big ones.' },
  { id: 'kelpsend', name: "Kelp's End", x: -500, z: 3100, R: 140, P: 7, zone: 3, style: 'marsh',
    boost: ['manta_ray', 'giant_crab', 'lobster'], blurb: 'The last place the kelp grows. Beyond: only dark water.' },
  { id: 'lantern', name: 'Lantern Cay', x: -3200, z: 2000, R: 130, P: 7, zone: 4, style: 'pale',
    boost: ['oarfish', 'gulper_eel', 'anglerfish'], blurb: 'Every window holds a lamp. Nobody sleeps here.' },
  { id: 'hollow', name: 'Hollow Light', x: 3300, z: 2100, R: 105, P: 9, zone: 4, style: 'lighthouse', noShops: true,
    boost: [], blurb: 'A lighthouse that has not shone in a hundred years.' },
];

const WILD_NAMES = ['Gull Rock', 'Driftwood Isle', 'Brine Hollow', 'Tern Island', 'Old Mast', 'Cormorant Key',
  'Shipwreck Shoal', 'Hag Stone', 'Smuggler\'s Rest', 'Barnacle Bank', 'Lone Pine', 'Whale Back', 'Mourn Rock',
  'Spindle Isle', 'The Knuckles', 'Saint Elva', 'Black Tooth', 'Fenwick Cay', 'Salt Lick', 'Heron\'s Perch',
  'Dead Man\'s Hand', 'Pilot\'s Fold', 'Moss Crown', 'Greywater Bar', 'Siren\'s Step', 'Cold Harbour', 'Bell Rock',
  'Widow\'s Walk', 'Thistle Cay', 'Ember Skerry', 'Quiet Isle', 'The Drowned Mile', 'Mist Haven', 'Ghost Ridge',
  'Nettle Reef', 'Hollow Crown'];

export const islands = [];
export const towns = [];
const CELL = 500;
const grid = new Map();
const cellKey = (cx, cz) => cx * 73856093 ^ cz * 19349663;

function register(isl) {
  const ext = isl.R * 2.0;
  const c0x = Math.floor((isl.x - ext) / CELL), c1x = Math.floor((isl.x + ext) / CELL);
  const c0z = Math.floor((isl.z - ext) / CELL), c1z = Math.floor((isl.z + ext) / CELL);
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cz = c0z; cz <= c1z; cz++) {
      const k = cellKey(cx, cz);
      let list = grid.get(k);
      if (!list) grid.set(k, (list = []));
      list.push(isl);
    }
  }
  islands.push(isl);
}

function makeIsland(props) {
  const isl = { seed: Math.floor(hash2(Math.round(props.x), Math.round(props.z), SEED) * 100000), ...props };
  isl.zone = zoneAt(isl.x, isl.z);
  isl.sx = hash2(isl.seed, 1, 3) * 50;
  isl.sz = hash2(isl.seed, 2, 3) * 50;
  register(isl);
  return isl;
}

/** Height contribution of one island at (x, z). Negative = below sea level (water depth). */
function islandHeight(isl, x, z) {
  const dx = x - isl.x, dz = z - isl.z;
  const R = isl.R;
  const r2 = dx * dx + dz * dz;
  if (r2 > R * R * 4) return -16;
  const r = Math.sqrt(r2);
  const n = fbm2(dx / R * 1.7 + isl.sx, dz / R * 1.7 + isl.sz, 3, isl.seed);
  const d = r / (R * (0.74 + 0.52 * n));
  if (d >= 1) {
    const depth = 16 * (1 - Math.exp(-(d - 1) * 3.2));
    return -Math.min(16, depth);
  }
  const k = 1 - d;
  let h;
  switch (isl.kind) {
    case 'stack': h = Math.pow(k, 0.4) * isl.P; break;
    case 'town': case 'light': h = Math.pow(k, 0.5) * isl.P; break;
    default: h = Math.pow(k, 0.85) * isl.P; break;
  }
  if (isl.hill) {
    const hx = isl.x + isl.hill.dx * R * 0.45, hz = isl.z + isl.hill.dz * R * 0.45;
    const hd = Math.hypot(x - hx, z - hz) / (R * 0.5);
    let cone = Math.max(0, 1 - hd);
    cone = Math.pow(cone, 1.35);
    // crater rim for the volcano
    const crater = hd < 0.12 ? (0.12 - hd) * 40 : 0;
    h = Math.max(h, cone * isl.hill.h - crater);
  }
  // fine detail, faded out near the shore so coastlines stay clean
  const detailAmp = isl.kind === 'town' || isl.kind === 'light' ? 0.5 : Math.min(2.6, 0.35 + isl.P * 0.07);
  h += (fbm2(x * 0.07, z * 0.07, 2, isl.seed + 9) - 0.5) * 2 * detailAmp * smoothstep(0, 0.35, k);
  return h;
}

export function heightAt(x, z) {
  const list = grid.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return -16;
  let best = -16;
  for (let i = 0; i < list.length; i++) {
    const h = islandHeight(list[i], x, z);
    if (h > best) best = h;
  }
  return best;
}

export function islandsNear(x, z, radius) {
  const out = [];
  for (const isl of islands) {
    const d = Math.hypot(isl.x - x, isl.z - z) - isl.R * 1.9;
    if (d < radius) out.push(isl);
  }
  return out;
}

/** Distance from a point to the nearest island shoreline (approx.). */
export function shoreDistance(x, z) {
  let best = Infinity;
  for (const isl of islands) {
    if (isl.kind === 'reef') continue;
    const d = Math.hypot(isl.x - x, isl.z - z) - isl.R;
    if (d < best) best = d;
  }
  return best;
}

export function isClearWater(x, z, radius = 20, maxH = -3) {
  if (Math.hypot(x, z) > WORLD_RADIUS - 150) return false;
  if (heightAt(x, z) > maxH) return false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    if (heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius) > maxH) return false;
  }
  return true;
}

/** Spiral outwards from (x,z) until a clear stretch of deep-ish water is found. */
export function findWater(x, z, radius = 24, maxH = -5) {
  for (let ring = 0; ring < 60; ring++) {
    const rr = ring * 14;
    const steps = Math.max(1, Math.round(ring * 6));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU + ring * 0.7;
      const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      if (isClearWater(px, pz, radius, maxH)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

// ---------------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------------
(function generate() {
  const rng = mulberry32(SEED);

  // Towns first (hand-placed so progression is stable).
  for (const def of TOWN_DEFS) {
    const isl = makeIsland({
      kind: def.style === 'lighthouse' ? 'light' : 'town',
      x: def.x, z: def.z, R: def.R, P: def.P, townId: def.id, name: def.name,
    });
    if (def.hillH) {
      // volcano sits on the side away from the (later chosen) dock; pick the hill side first
      const a = hash2(isl.seed, 5, 1) * TAU;
      isl.hill = { dx: Math.cos(a), dz: Math.sin(a), h: def.hillH, angle: a };
    }
    const town = { ...def, island: isl, zone: zoneAt(def.x, def.z) };
    isl.town = town;
    towns.push(town);
  }
  const townIsles = islands.slice();

  const farFromAll = (x, z, R, mult, extra) => {
    for (const o of islands) {
      if (Math.hypot(o.x - x, o.z - z) < (R + o.R) * mult + extra) return false;
    }
    return true;
  };

  // Wild islands
  const names = WILD_NAMES.slice();
  let wild = 0, tries = 0;
  while (wild < 38 && tries++ < 6000) {
    const rr = Math.sqrt(rng()) * (WORLD_RADIUS - 380);
    const a = rng() * TAU;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const R = 50 + rng() * rng() * 230;
    if (Math.hypot(x, z) < 420 + R) continue;
    if (!farFromAll(x, z, R, 1.8, 140)) continue;
    const P = 9 + R * 0.12 + rng() * 12;
    makeIsland({ kind: 'wild', x, z, R, P, name: names[wild % names.length] });
    wild++;
  }
  const wildIsles = islands.filter((i) => i.kind === 'wild');

  const place = (count, mk, nearWild) => {
    let placed = 0, t = 0;
    while (placed < count && t++ < 5000) {
      let x, z;
      if (nearWild && rng() < nearWild) {
        const w = wildIsles[Math.floor(rng() * wildIsles.length)];
        const a = rng() * TAU, d = w.R * (1.2 + rng() * 1.0);
        x = w.x + Math.cos(a) * d; z = w.z + Math.sin(a) * d;
      } else {
        const rr = Math.sqrt(rng()) * (WORLD_RADIUS - 300), a = rng() * TAU;
        x = Math.cos(a) * rr; z = Math.sin(a) * rr;
      }
      const props = mk(x, z);
      if (Math.hypot(x, z) < props.minOrigin) continue;
      if (Math.hypot(x, z) > WORLD_RADIUS - 200) continue;
      let ok = true;
      for (const o of islands) {
        const d = Math.hypot(o.x - x, o.z - z);
        const lim = o.kind === 'town' || o.kind === 'light' ? o.R * 2.1 + props.R : props.spacing + o.R * 0.9 + props.R;
        if (d < lim) { ok = false; break; }
      }
      if (!ok) continue;
      makeIsland({ x, z, ...props.island });
      placed++;
    }
  };

  // Small rocks, reefs (awash - dangerous) and tall sea-stacks
  place(190, (x, z) => {
    const R = 9 + rng() * 22;
    return { R, spacing: 36, minOrigin: 320, island: { kind: 'rock', R, P: 1.8 + rng() * 8 } };
  }, 0.6);
  place(46, (x, z) => {
    const R = 24 + rng() * 34;
    return { R, spacing: 60, minOrigin: 520, island: { kind: 'reef', R, P: -0.3 + rng() * 0.9 } };
  }, 0.5);
  place(34, (x, z) => {
    const R = 12 + rng() * 10;
    return { R, spacing: 80, minOrigin: 1800, island: { kind: 'stack', R, P: 30 + rng() * 40 } };
  }, 0.0);

  // Docks: choose a seaward bearing with clear water for each town.
  for (const t of towns) {
    const isl = t.island;
    const base = hash2(isl.seed, 9, 2) * TAU;
    let chosen = null;
    for (let k = 0; k < 36 && !chosen; k++) {
      const a = base + k * (TAU / 36);
      if (isl.hill && Math.abs(Math.atan2(Math.sin(a - isl.hill.angle), Math.cos(a - isl.hill.angle))) < 1.2) continue;
      const dx = Math.cos(a), dz = Math.sin(a);
      let r = 8;
      while (r < isl.R * 2 && heightAt(isl.x + dx * r, isl.z + dz * r) > 0.3) r += 1.5;
      const rc = r;
      let clear = true;
      for (let rr = rc + 6; rr < rc + 140 && clear; rr += 10) {
        for (const off of [-34, 0, 34]) {
          const px = isl.x + dx * rr - dz * off, pz = isl.z + dz * rr + dx * off;
          if (heightAt(px, pz) > -2.5) { clear = false; break; }
        }
      }
      if (clear) chosen = { a, dx, dz, rc };
    }
    if (!chosen) {
      // fallback: very rare, just take the base bearing
      const a = base, dx = Math.cos(a), dz = Math.sin(a);
      let r = 8;
      while (r < isl.R * 2 && heightAt(isl.x + dx * r, isl.z + dz * r) > 0.3) r += 1.5;
      chosen = { a, dx, dz, rc: r };
    }
    const { a, dx, dz, rc } = chosen;
    // pier starts a little inland, ends 24 units past the shoreline
    let rs = rc;
    while (rs > 4 && heightAt(isl.x + dx * rs, isl.z + dz * rs) < 1.2) rs -= 1;
    const px = -dz, pz = dx; // perpendicular
    t.dock = {
      a, dx, dz,
      start: { x: isl.x + dx * (rs - 4), z: isl.z + dz * (rs - 4) },
      end: { x: isl.x + dx * (rc + 24), z: isl.z + dz * (rc + 24) },
      boat: {
        x: isl.x + dx * (rc + 20) + px * 7,
        z: isl.z + dz * (rc + 20) + pz * 7,
        heading: Math.atan2(dx, dz),
      },
    };
    t.x = isl.x; t.z = isl.z;
  }
  void townIsles;
})();

export const getTown = (id) => towns.find((t) => t.id === id);
export const WORLD = { radius: WORLD_RADIUS };
