import { Inventory } from './inventory.js';
import { UPGRADE_KEYS, statsFor } from './upgrades.js';
import { SAVE_KEY, START_HOUR } from '../config.js';

export function newState() {
  const up = Object.fromEntries(UPGRADE_KEYS.map((k) => [k, 1]));
  up.net = 0; up.rack = 0;
  const stats = statsFor(up);
  const inv = new Inventory(stats.grid[0], stats.grid[1]);
  return {
    v: 1,
    money: 40,
    day: 1,
    hour: START_HOUR,
    hull: stats.hullMax,
    panic: 0,
    up,
    inv,
    quests: { active: [], done: [] },
    main: { stage: 0, have: [false, false, false, false], delivered: false },
    log: {},              // species -> count caught
    spots: {},            // spotId -> {used, until}
    pots: [],             // {id, spotId, x, z, zone, at}
    visited: ['saltmere'],
    discovered: [],
    pos: null,            // {x,z,heading}
    lastPort: 'saltmere',
    flags: {},
    stats: { caught: 0, earned: 0, sunk: 0, nights: 0 },
    settings: { sound: true, quality: 'auto', hints: true },
  };
}

export const absHours = (s) => (s.day - 1) * 24 + s.hour;

export function serialize(state) {
  return JSON.stringify({ ...state, inv: state.inv.toJSON() });
}

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); return true; } catch { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    const base = newState();
    const st = { ...base, ...o };
    st.up = { ...base.up, ...o.up };
    st.inv = Inventory.fromJSON(o.inv || { w: 4, h: 3 });
    st.main = { ...base.main, ...o.main };
    st.quests = { ...base.quests, ...o.quests };
    st.stats = { ...base.stats, ...o.stats };
    st.settings = { ...base.settings, ...o.settings };
    return st;
  } catch { return null; }
}

export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
