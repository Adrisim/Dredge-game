// Item database: fish, crabs, aberrations, materials, relics and junk.
// Shapes are ascii polyominoes used by the tetris-style cargo hold.

const parse = (rows) => {
  const cells = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') cells.push([x, y]); }));
  return cells;
};

export const ITEMS = {};
export const ITEM_LIST = [];

function def(id, name, cat, rows, value, color, icon, o = {}) {
  const it = {
    id, name, cat, rows, cells: parse(rows), value, color, icon,
    zones: o.zones || [1, 4], hab: o.hab || 'any', time: o.time || 'any', rar: o.rar ?? 5,
    fight: o.fight || null, desc: o.desc || '', quest: !!o.quest, kg: o.kg || +(parse(rows).length * 1.3).toFixed(1),
  };
  ITEMS[id] = it;
  ITEM_LIST.push(it);
  return it;
}
const F = (hits, zone, speed, sp) => ({ hits, zone, speed, sp });

// ---------------------------------------------------------------- Zone 1: The Shallows
def('sardine', 'Sardine', 'fish', ['XX'], 9, '#9fc3d8', 'fish', { zones: [1, 2], rar: 10, fight: F(1, 84, 120), desc: 'Silver and plentiful. Gulls adore them.' });
def('herring', 'Herring', 'fish', ['XXX'], 13, '#8fb0c8', 'fish', { zones: [1, 2], hab: 'open', rar: 8, fight: F(1, 74, 130), desc: 'Runs in shoals, never alone.' });
def('mackerel', 'Mackerel', 'fish', ['XX', 'X.'], 17, '#5f95b5', 'fish', { zones: [1, 2], rar: 8, fight: F(2, 68, 130), desc: 'Striped back, oily flesh. A harbour staple.' });
def('perch', 'Perch', 'fish', ['XX', 'XX'], 21, '#9bb85a', 'fish', { zones: [1, 2], hab: 'shore', rar: 6, fight: F(2, 64, 130), desc: 'Spiny fins and a sulky temperament.' });
def('flounder', 'Flounder', 'fish', ['XX.', '.XX'], 26, '#b59a6a', 'flat', { zones: [1, 2], hab: 'shore', rar: 5, fight: F(2, 60, 135), desc: 'Lies flat on the seabed, both eyes on one side.' });
def('cod', 'Cod', 'fish', ['XXX', 'X..'], 36, '#a89b78', 'fish', { zones: [1, 2], hab: 'open', rar: 5, fight: F(2, 56, 140), desc: 'Heavy, honest, and always hungry.' });
def('sea_bass', 'Sea Bass', 'fish', ['XXX', '.X.'], 46, '#7a9aa8', 'fish', { zones: [1, 2], hab: 'shore', rar: 3, fight: F(3, 52, 145), desc: 'Wary of shadows. Worth the patience.' });

// ---------------------------------------------------------------- Zone 2: Kelp Marches
def('bream', 'Sea Bream', 'fish', ['XXX', 'XX.'], 58, '#d9a07a', 'fish', { zones: [2, 3], hab: 'shore', rar: 8, fight: F(2, 58, 150), desc: 'Blushing scales, quick to nibble.' });
def('sea_trout', 'Sea Trout', 'fish', ['XXXX'], 66, '#c9b58a', 'fish', { zones: [2, 3], rar: 6, fight: F(2, 56, 150), desc: 'A river fish that went to sea and never apologised.' });
def('snapper', 'Red Snapper', 'fish', ['.XX', 'XX.'], 78, '#e0604a', 'fish', { zones: [2, 3], hab: 'shore', rar: 5, fight: F(3, 52, 155), desc: 'Bright as a warning flag.' });
def('haddock', 'Haddock', 'fish', ['XXX', '..X'], 84, '#8a8a9a', 'fish', { zones: [2, 3], hab: 'open', rar: 5, fight: F(3, 50, 155), desc: 'Marked with the devil\'s thumbprint, they say.' });
def('red_mullet', 'Red Mullet', 'fish', ['XX', 'XX', '.X'], 100, '#e0786a', 'fish', { zones: [2, 3], hab: 'open', rar: 3, fight: F(3, 48, 160), desc: 'Whiskered scavenger of the sandy deeps.' });

// ---------------------------------------------------------------- Zone 3: Open Ocean
def('grouper', 'Grouper', 'fish', ['XX', 'XX', 'XX'], 150, '#8a7a5a', 'fish', { zones: [3, 4], hab: 'shore', rar: 6, fight: F(3, 50, 150), desc: 'Swallows its meals whole. Be wary of your fingers.' });
def('mahi_mahi', 'Mahi-Mahi', 'fish', ['XXXX', 'X...'], 185, '#6ad0a0', 'fish', { zones: [3, 4], hab: 'open', time: 'day', rar: 5, fight: F(3, 46, 170), desc: 'Gold and green, blazing in the sun.' });
def('tuna', 'Bluefin Tuna', 'fish', ['XXXX', '.XX.'], 230, '#4a74b8', 'fish', { zones: [3, 4], hab: 'open', rar: 6, fight: F(4, 44, 165), desc: 'Built like a torpedo and twice as fast.' });
def('barracuda', 'Barracuda', 'fish', ['XXXXX'], 210, '#8a9aa8', 'fish', { zones: [3, 4], hab: 'open', rar: 5, fight: F(4, 42, 185, 'dart'), desc: 'All teeth and bad intentions.' });
def('sunfish', 'Sunfish', 'fish', ['XXX', 'XXX', '.X.'], 270, '#c8c8b8', 'fish', { zones: [3, 4], hab: 'open', time: 'day', rar: 3, fight: F(4, 46, 150), desc: 'A great pale disc that basks at the surface.' });
def('swordfish', 'Swordfish', 'fish', ['XXXXXX'], 360, '#5a6a9a', 'fish', { zones: [3, 4], hab: 'open', rar: 3, fight: F(5, 38, 190, 'reverse'), desc: 'The sea\'s duellist. It will not come quietly.' });
def('manta_ray', 'Manta Ray', 'fish', ['.X.', 'XXX', 'XXX'], 330, '#4a5a78', 'ray', { zones: [3, 4], hab: 'open', rar: 2.5, fight: F(4, 44, 160), desc: 'Gliding wings, a gentle giant.' });

// ---------------------------------------------------------------- Zone 4: Abyssal Reach
def('anglerfish', 'Anglerfish', 'fish', ['XXX', 'XXX', 'X..'], 560, '#4a3a58', 'fish', { zones: [4, 4], hab: 'open', rar: 6, fight: F(5, 36, 190, 'decoy'), desc: 'Its lure glows in the dark. Do not follow it.' });
def('gulper_eel', 'Gulper Eel', 'fish', ['XXXXX', '....X'], 520, '#3a3a48', 'eel', { zones: [4, 4], hab: 'open', rar: 5, fight: F(5, 36, 195), desc: 'Mostly mouth.' });
def('vampire_squid', 'Vampire Squid', 'fish', ['X.X', 'XXX', '.X.'], 640, '#6a2a48', 'squid', { zones: [4, 4], hab: 'open', rar: 4, fight: F(5, 34, 200, 'shrink'), desc: 'Neither vampire nor squid. Entirely sinister.' });
def('lantern_shark', 'Lantern Shark', 'fish', ['XXX.', '.XXX', '..X.'], 760, '#3a5a68', 'shark', { zones: [4, 4], hab: 'open', rar: 3, fight: F(6, 32, 210, 'dart'), desc: 'Glows faintly blue. Patrols the black.' });
def('oarfish', 'Oarfish', 'fish', ['XXXXXXX'], 980, '#c8d0d8', 'eel', { zones: [4, 4], hab: 'open', rar: 1.8, fight: F(6, 30, 200, 'reverse'), desc: 'A silver ribbon the length of a house. Sailors take it for an omen.' });
def('giant_squid', 'Giant Squid', 'fish', ['X..', 'XXX', 'XXX', 'X..'], 1200, '#a04a5a', 'squid', { zones: [4, 4], hab: 'open', rar: 1.2, fight: F(7, 28, 205, 'shrink'), desc: 'Every legend has to start somewhere.' });

// ---------------------------------------------------------------- Crabs (pots)
def('brown_crab', 'Brown Crab', 'crab', ['XX', 'XX'], 32, '#b86a48', 'crab', { zones: [1, 4], rar: 10, desc: 'Sidles into any pot with bait.' });
def('lobster', 'Lobster', 'crab', ['XXX', '.X.'], 120, '#d0503a', 'crab', { zones: [2, 4], rar: 6, desc: 'Blue-black until it meets a kettle.' });
def('giant_crab', 'Giant Spider Crab', 'crab', ['X.X', 'XXX', 'X.X'], 280, '#c27a58', 'crab', { zones: [3, 4], rar: 4, desc: 'Legs like scaffolding.' });
def('king_crab', 'Abyssal King Crab', 'crab', ['XXXX', 'XXXX'], 620, '#8a3a5a', 'crab', { zones: [4, 4], rar: 3, desc: 'It wears something that might once have been a crown.' });

// ---------------------------------------------------------------- Aberrations (night only)
def('twin_cod', 'Twin-Mouthed Cod', 'aberrant', ['XXX', 'X.X'], 150, '#a8b878', 'fish', { zones: [2, 4], rar: 8, time: 'night', fight: F(3, 50, 170, 'dart'), desc: 'Two mouths. Both are hungry. Neither is yours.' });
def('weeping_mackerel', 'Weeping Mackerel', 'aberrant', ['XXX', 'XX.'], 120, '#78b8c8', 'fish', { zones: [2, 4], rar: 8, time: 'night', fight: F(3, 52, 165, 'shrink'), desc: 'Its eyes leak a slow black tear.' });
def('hollow_eel', 'Hollow Eel', 'aberrant', ['XXXX', '...X'], 175, '#7a6a98', 'eel', { zones: [2, 4], rar: 6, time: 'night', fight: F(3, 48, 175, 'reverse'), desc: 'You can see right through the middle of it.' });
def('moon_snapper', 'Moon Snapper', 'aberrant', ['XX.', 'XXX', '.X.'], 260, '#c8d8f0', 'fish', { zones: [2, 4], rar: 5, time: 'night', fight: F(4, 46, 180, 'decoy'), desc: 'Pale as bone. It watches the moon back.' });
def('pale_barracuda', 'Pale Barracuda', 'aberrant', ['XXXXX', '.X...'], 440, '#d8d0e8', 'fish', { zones: [3, 4], rar: 5, time: 'night', fight: F(5, 40, 205, 'dart'), desc: 'Too many teeth, and not all of them are in its mouth.' });
def('stitched_tuna', 'Stitched Tuna', 'aberrant', ['XXX', 'XXX', 'XX.'], 620, '#78689a', 'fish', { zones: [3, 4], rar: 4, time: 'night', fight: F(5, 38, 205, 'shrink'), desc: 'Sewn together from better-behaved fish.' });
def('many_eyed_angler', 'Many-Eyed Angler', 'aberrant', ['XXX.', 'XXXX', '..X.'], 1400, '#a84ad0', 'fish', { zones: [4, 4], rar: 4, time: 'night', fight: F(6, 34, 220, 'decoy'), desc: 'Every eye is looking at something different.' });
def('gaunt_oarfish', 'Gaunt Oarfish', 'aberrant', ['XXXXXX', 'X.....'], 1800, '#e0e0f0', 'eel', { zones: [4, 4], rar: 2, time: 'night', fight: F(7, 30, 225, 'reverse'), desc: 'It follows the boat for three nights before it bites.' });

// ---------------------------------------------------------------- Materials & treasures
def('scrap_iron', 'Scrap Iron', 'mat', ['XX'], 6, '#8a8a92', 'scrap', { desc: 'Rusted plate, good for patching hulls.' });
def('driftwood', 'Driftwood', 'mat', ['XXX'], 8, '#9a7a52', 'wood', { desc: 'Sea-bleached and sound.' });
def('copper_ore', 'Copper Ore', 'mat', ['X', 'X'], 22, '#d0804a', 'ore', { desc: 'Green-streaked and heavy.' });
def('deep_crystal', 'Deep Crystal', 'mat', ['XX', 'XX'], 60, '#6ad0ff', 'gem', { zones: [3, 4], desc: 'Cold light pulses faintly inside.' });
def('pearl', 'Black Pearl', 'mat', ['X'], 140, '#3a3a58', 'pearl', { desc: 'Smooth and strangely heavy.' });
def('ancient_coin', 'Ancient Coin', 'relic', ['X'], 55, '#d8b84a', 'coin', { desc: 'Stamped with a lighthouse nobody recognises.' });
def('brass_compass', 'Brass Compass', 'relic', ['XX'], 150, '#c8a040', 'compass', { desc: 'The needle points down.' });
def('idol', 'Drowned Idol', 'relic', ['X.', 'XX'], 260, '#6a9a8a', 'idol', { desc: 'Worn smooth by a thousand years of tide.' });

// Junk
def('old_boot', 'Old Boot', 'trash', ['XX', 'X.'], 1, '#6a5240', 'boot', { desc: 'Left foot. Always left foot.' });
def('tin_can', 'Tin Can', 'trash', ['X'], 1, '#a0a0a8', 'can', { desc: 'Empty. Naturally.' });
def('tangled_net', 'Tangled Net', 'trash', ['XX', 'XX'], 2, '#7a8a6a', 'net', { desc: 'More knot than net.' });

// Quest items (cannot be sold or discarded)
const lens = (n, rows, color) => def(`lens_${n}`, `Lens Fragment ${['I', 'II', 'III', 'IV'][n - 1]}`, 'quest', rows, 0, color, 'lens', { quest: true, desc: 'A shard of the Hollow Light\'s great lens. It hums when the tide turns.' });
lens(1, ['XX', 'X.'], '#ffe08a');
lens(2, ['X.', 'XX'], '#ffd070');
lens(3, ['XX'], '#ffc858');
lens(4, ['X', 'X'], '#ffc040');
def('silver_locket', 'Silver Locket', 'quest', ['X'], 0, '#d8e0e8', 'coin', { quest: true, desc: 'Engraved with two initials and a date.' });

// ---------------------------------------------------------------- Rotation helpers
const rotCache = new Map();
export function cellsFor(id, rot = 0) {
  const key = id + ':' + (rot & 3);
  let c = rotCache.get(key);
  if (c) return c;
  let cells = ITEMS[id].cells.map(([x, y]) => [x, y]);
  for (let r = 0; r < (rot & 3); r++) cells = cells.map(([x, y]) => [-y, x]);
  const mx = Math.min(...cells.map((p) => p[0])), my = Math.min(...cells.map((p) => p[1]));
  cells = cells.map(([x, y]) => [x - mx, y - my]);
  c = { cells, w: Math.max(...cells.map((p) => p[0])) + 1, h: Math.max(...cells.map((p) => p[1])) + 1 };
  rotCache.set(key, c);
  return c;
}

export const CATEGORY_LABEL = { fish: 'Fish', crab: 'Shellfish', aberrant: 'Aberration', mat: 'Material', relic: 'Relic', trash: 'Junk', quest: 'Quest item' };

// ---------------------------------------------------------------- Loot rolls
function pickWeighted(list, wf, rng) {
  let tot = 0;
  for (const it of list) tot += wf(it);
  if (tot <= 0) return null;
  let r = rng() * tot;
  for (const it of list) { r -= wf(it); if (r <= 0) return it; }
  return list[list.length - 1];
}

export function rollFish(spot, isNight, rng = Math.random) {
  const zone = spot.zone;
  if (spot.aberrant) {
    const pool = ITEM_LIST.filter((i) => i.cat === 'aberrant' && zone >= i.zones[0] && zone <= i.zones[1]);
    return pickWeighted(pool, (i) => i.rar, rng);
  }
  if (rng() < 0.07) return ITEMS[['old_boot', 'tin_can', 'tangled_net'][Math.floor(rng() * 3)]];
  const pool = ITEM_LIST.filter((i) => i.cat === 'fish' && zone >= i.zones[0] && zone <= i.zones[1]
    && (i.hab === 'any' || i.hab === spot.kind) && (i.time === 'any' || (i.time === 'night') === isNight));
  return pickWeighted(pool, (i) => i.rar * (spot.rich && i.value > 80 ? 1.6 : 1), rng);
}

const DREDGE_TABLE = {
  1: { scrap_iron: 10, driftwood: 8, old_boot: 3, tin_can: 3, ancient_coin: 1.5, copper_ore: 1 },
  2: { scrap_iron: 8, driftwood: 6, copper_ore: 8, ancient_coin: 2, pearl: 1, brass_compass: 0.8, tin_can: 1 },
  3: { copper_ore: 8, scrap_iron: 5, deep_crystal: 6, pearl: 2, brass_compass: 1.5, ancient_coin: 2, idol: 0.7 },
  4: { deep_crystal: 9, pearl: 3, brass_compass: 2, idol: 1.3, copper_ore: 4, ancient_coin: 2 },
};
export function rollDredge(spot, netLvl, rng = Math.random) {
  const tbl = DREDGE_TABLE[spot.zone] || DREDGE_TABLE[1];
  const entries = Object.entries(tbl).map(([id, w]) => ({ id, w: w * (ITEMS[id].value > 50 ? 1 + 0.3 * (netLvl - 1) : 1) }));
  const out = [];
  const n = rng() < 0.28 + 0.12 * netLvl ? 2 : 1;
  for (let i = 0; i < n; i++) out.push(pickWeighted(entries, (e) => e.w, rng).id);
  return out;
}

export function rollCrabs(pot, rng = Math.random) {
  const pool = ITEM_LIST.filter((i) => i.cat === 'crab' && pot.zone >= i.zones[0] && pot.zone <= i.zones[1]);
  const n = 1 + Math.floor(rng() * 3);
  const out = [];
  for (let i = 0; i < n; i++) out.push(pickWeighted(pool, (c) => c.rar, rng).id);
  if (rng() < 0.12) out.push('tangled_net');
  return out;
}
