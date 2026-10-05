import { ITEMS, cellsFor } from './items.js';

/** Tetris-style cargo hold. Items are placed on a w x h grid; broken cells cannot be used. */
export class Inventory {
  constructor(w = 4, h = 3) {
    this.w = w; this.h = h;
    this.items = [];
    this.broken = new Set();
    this.nextUid = 1;
  }

  key(x, y) { return x + ',' + y; }
  cells(item, x = item.x, y = item.y, rot = item.rot) {
    return cellsFor(item.id, rot).cells.map(([cx, cy]) => [x + cx, y + cy]);
  }

  occupancy(ignoreUid = -1) {
    const m = new Map();
    for (const it of this.items) {
      if (it.uid === ignoreUid) continue;
      for (const [cx, cy] of this.cells(it)) m.set(this.key(cx, cy), it.uid);
    }
    return m;
  }

  canPlace(id, x, y, rot, ignoreUid = -1) {
    const occ = this.occupancy(ignoreUid);
    for (const [cx, cy] of cellsFor(id, rot).cells) {
      const gx = x + cx, gy = y + cy;
      if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return false;
      const k = this.key(gx, gy);
      if (this.broken.has(k) || occ.has(k)) return false;
    }
    return true;
  }

  findSpot(id) {
    const occ = this.occupancy();
    const tried = new Set();
    for (let rot = 0; rot < 4; rot++) {
      const c = cellsFor(id, rot);
      const sig = c.cells.map((p) => p.join(':')).sort().join('|');
      if (tried.has(sig)) continue;
      tried.add(sig);
      for (let y = 0; y <= this.h - c.h; y++) {
        for (let x = 0; x <= this.w - c.w; x++) {
          let ok = true;
          for (const [cx, cy] of c.cells) {
            const k = this.key(x + cx, y + cy);
            if (this.broken.has(k) || occ.has(k)) { ok = false; break; }
          }
          if (ok) return { x, y, rot };
        }
      }
    }
    return null;
  }

  /** Add an item at a given spot (or auto-place). Returns the item or null. */
  add(id, extra = {}, spot = null) {
    const s = spot || this.findSpot(id);
    if (!s) return null;
    const item = { uid: this.nextUid++, id, x: s.x, y: s.y, rot: s.rot, w: extra.w ?? 1 };
    this.items.push(item);
    return item;
  }

  get(uid) { return this.items.find((i) => i.uid === uid); }
  remove(uid) { const i = this.items.findIndex((it) => it.uid === uid); if (i >= 0) return this.items.splice(i, 1)[0]; return null; }
  count(id) { return this.items.filter((i) => i.id === id).length; }
  countMatch(key) {
    if (key.startsWith('cat:')) return this.items.filter((i) => ITEMS[i.id].cat === key.slice(4)).length;
    return this.count(key);
  }
  consume(key, n) {
    let left = n;
    // consume cheapest-first so valuable catches are not eaten by quests
    const list = this.items
      .filter((i) => (key.startsWith('cat:') ? ITEMS[i.id].cat === key.slice(4) : i.id === key))
      .sort((a, b) => ITEMS[a.id].value * a.w - ITEMS[b.id].value * b.w);
    for (const it of list) { if (left <= 0) break; this.remove(it.uid); left--; }
    return n - left;
  }
  freeCells() {
    let used = this.broken.size;
    for (const it of this.items) used += ITEMS[it.id].cells.length;
    return this.w * this.h - used;
  }
  totalValue() { return this.items.reduce((s, i) => s + ITEMS[i.id].value * i.w, 0); }

  resize(w, h) { this.w = w; this.h = h; }

  /** Mark a cell as damaged. Returns destroyed items. */
  breakCell(x, y) {
    this.broken.add(this.key(x, y));
    const dead = [];
    for (const it of [...this.items]) {
      if (this.cells(it).some(([cx, cy]) => cx === x && cy === y)) { this.remove(it.uid); dead.push(it); }
    }
    return dead;
  }
  randomHealthyCell() {
    const list = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.broken.has(this.key(x, y))) list.push([x, y]);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  repairAll() { const n = this.broken.size; this.broken.clear(); return n; }

  toJSON() {
    return { w: this.w, h: this.h, items: this.items, broken: [...this.broken], nextUid: this.nextUid };
  }
  static fromJSON(o) {
    const inv = new Inventory(o.w, o.h);
    inv.items = (o.items || []).filter((i) => ITEMS[i.id]);
    inv.broken = new Set(o.broken || []);
    inv.nextUid = o.nextUid || (inv.items.reduce((m, i) => Math.max(m, i.uid), 0) + 1);
    return inv;
  }
}
