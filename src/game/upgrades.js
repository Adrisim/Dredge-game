// Boat upgrade tracks and the stats derived from them.
export const UPGRADES = {
  hull: {
    name: 'Hull Plating', blurb: 'Tougher plating lets you shrug off more knocks.',
    levels: [
      { hp: 4 },
      { cost: 160, mats: { scrap_iron: 3 }, hp: 6 },
      { cost: 650, mats: { scrap_iron: 5, driftwood: 3 }, hp: 8 },
      { cost: 2000, mats: { copper_ore: 4, scrap_iron: 6 }, hp: 10 },
      { cost: 5500, mats: { deep_crystal: 3, copper_ore: 6 }, hp: 12 },
    ],
    fmt: (l) => `${l.hp} hull points`,
  },
  engine: {
    name: 'Engine', blurb: 'More power, more speed, more miles before dark.',
    levels: [
      { speed: 13, accel: 4.5, turn: 0.95 },
      { cost: 140, mats: { scrap_iron: 2 }, speed: 17, accel: 5.5, turn: 1.0 },
      { cost: 540, mats: { scrap_iron: 4, copper_ore: 2 }, speed: 22, accel: 6.5, turn: 1.05 },
      { cost: 1600, mats: { copper_ore: 5 }, speed: 28, accel: 8, turn: 1.1 },
      { cost: 4200, mats: { deep_crystal: 2, copper_ore: 6 }, speed: 35, accel: 10, turn: 1.15 },
    ],
    fmt: (l) => `Top speed ${l.speed} kn`,
  },
  rod: {
    name: 'Fishing Rod', blurb: 'Wider catch zones, a steadier line and slower fish.',
    levels: [
      { zone: 1.0, speed: 1.0, strain: 3 },
      { cost: 110, mats: { driftwood: 2 }, zone: 1.2, speed: 0.93, strain: 3 },
      { cost: 480, mats: { driftwood: 3, scrap_iron: 2 }, zone: 1.4, speed: 0.86, strain: 4 },
      { cost: 1400, mats: { copper_ore: 3 }, zone: 1.62, speed: 0.8, strain: 4 },
      { cost: 3800, mats: { deep_crystal: 2, copper_ore: 3 }, zone: 1.9, speed: 0.72, strain: 5 },
    ],
    fmt: (l) => `Zone x${l.zone.toFixed(2)} · ${l.strain} strain`,
  },
  hold: {
    name: 'Cargo Hold', blurb: 'Knock out a bulkhead for more space.',
    levels: [
      { grid: [4, 3] },
      { cost: 220, mats: { driftwood: 3 }, grid: [5, 4] },
      { cost: 760, mats: { driftwood: 4, scrap_iron: 3 }, grid: [6, 4] },
      { cost: 2200, mats: { scrap_iron: 6, copper_ore: 3 }, grid: [6, 5] },
      { cost: 5200, mats: { copper_ore: 6, deep_crystal: 2 }, grid: [7, 5] },
    ],
    fmt: (l) => `${l.grid[0]} × ${l.grid[1]} hold`,
  },
  light: {
    name: 'Lamp', blurb: 'A brighter lamp pushes back the dark - and the dread.',
    levels: [
      { range: 1, calm: 0.5 },
      { cost: 150, mats: { scrap_iron: 2 }, range: 2, calm: 0.65 },
      { cost: 800, mats: { copper_ore: 2, pearl: 1 }, range: 3, calm: 0.82 },
      { cost: 2600, mats: { deep_crystal: 2, pearl: 2 }, range: 4, calm: 1.0 },
    ],
    fmt: (l) => `Range ${l.range} · calms ${Math.round(l.calm * 100)}% dread`,
  },
  net: {
    name: 'Dredge Net', blurb: 'Drag the seabed for scrap, ore and relics.',
    levels: [
      { time: 0 },
      { cost: 90, time: 4.2 },
      { cost: 420, mats: { scrap_iron: 4, driftwood: 2 }, time: 3.2 },
      { cost: 1500, mats: { copper_ore: 4, scrap_iron: 4 }, time: 2.2 },
    ],
    fmt: (l) => (l.time ? `Dredge in ${l.time}s` : 'None'),
  },
  rack: {
    name: 'Crab Pot Rack', blurb: 'Carry baited pots to leave on the seabed.',
    levels: [
      { pots: 0 },
      { cost: 120, mats: { driftwood: 2 }, pots: 2 },
      { cost: 520, mats: { driftwood: 3, scrap_iron: 2 }, pots: 4 },
      { cost: 1700, mats: { copper_ore: 3, driftwood: 4 }, pots: 6 },
    ],
    fmt: (l) => (l.pots ? `${l.pots} pots` : 'None'),
  },
};
export const UPGRADE_KEYS = Object.keys(UPGRADES);

export function statsFor(up) {
  const e = UPGRADES.engine.levels[up.engine - 1];
  const r = UPGRADES.rod.levels[up.rod - 1];
  const l = UPGRADES.light.levels[up.light - 1];
  return {
    hullMax: UPGRADES.hull.levels[up.hull - 1].hp,
    maxSpeed: e.speed, accel: e.accel, turn: e.turn,
    rodZone: r.zone, rodSpeed: r.speed, strainMax: r.strain,
    grid: UPGRADES.hold.levels[up.hold - 1].grid,
    lightRange: l.range, lightCalm: l.calm,
    netTime: UPGRADES.net.levels[up.net].time,
    potsMax: UPGRADES.rack.levels[up.rack].pots,
  };
}

/** Index into UPGRADES[key].levels for the player's current level (net & rack start at 0, the rest at 1). */
export const curIndex = (key, lvl) => (key === 'net' || key === 'rack' ? lvl : lvl - 1);
