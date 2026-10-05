// Pre-rendered world map + fog of war, used by the minimap and the full map screen.
import { heightAt, ZONES } from './worldgen.js';
import { WORLD_RADIUS } from '../config.js';
import { clamp, lerp } from '../util/math.js';

export const EXTENT = 4500;
const SIZE = 1024;
const CELL = 120;
const REVEAL = 430;

export class MapData {
  constructor() {
    this.size = SIZE;
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = SIZE;
    this.fog = document.createElement('canvas');
    this.fog.width = this.fog.height = SIZE;
    this.fctx = this.fog.getContext('2d');
    this.fctx.fillStyle = 'rgb(5,13,22)';
    this.fctx.fillRect(0, 0, SIZE, SIZE);
    this.cells = new Set();
    this.ready = false;
    this.scale = SIZE / (EXTENT * 2);
  }

  toMap(x, z) { return [(x + EXTENT) * this.scale, (z + EXTENT) * this.scale]; }
  toWorld(px, py) { return [px / this.scale - EXTENT, py / this.scale - EXTENT]; }

  generate() {
    const ctx = this.base.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const d = img.data;
    let row = 0;
    const px = (v) => v / this.scale - EXTENT;
    return new Promise((resolve) => {
      const step = () => {
        const end = Math.min(SIZE, row + 64);
        for (; row < end; row++) {
          const z = px(row + 0.5);
          for (let col = 0; col < SIZE; col++) {
            const x = px(col + 0.5);
            const i = (row * SIZE + col) * 4;
            const r = Math.hypot(x, z);
            let R, G, B;
            if (r > WORLD_RADIUS) { R = 8; G = 16; B = 26; }
            else {
              const h = heightAt(x, z);
              if (h > 0) {
                if (h < 1.3) { R = 228; G = 212; B = 160; }
                else if (h < 9) { const t = clamp((h - 1.3) / 8, 0, 1); R = lerp(120, 78, t); G = lerp(168, 128, t); B = lerp(90, 70, t); }
                else if (h < 24) { const t = clamp((h - 9) / 15, 0, 1); R = lerp(78, 140, t); G = lerp(128, 134, t); B = lerp(70, 124, t); }
                else { R = 214; G = 214; B = 218; }
              } else {
                const t = clamp(-h / 16, 0, 1);
                R = lerp(112, 22, Math.sqrt(t)); G = lerp(206, 76, Math.sqrt(t)); B = lerp(206, 118, Math.sqrt(t));
              }
            }
            d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
          }
        }
        if (row < SIZE) setTimeout(step, 0);
        else {
          ctx.putImageData(img, 0, 0);
          // zone rings
          ctx.save();
          ctx.setLineDash([10, 10]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          const [cx, cy] = this.toMap(0, 0);
          for (const zn of ZONES.slice(0, 3)) { ctx.beginPath(); ctx.arc(cx, cy, zn.maxR * this.scale, 0, Math.PI * 2); ctx.stroke(); }
          ctx.setLineDash([]);
          ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,90,70,0.55)';
          ctx.beginPath(); ctx.arc(cx, cy, WORLD_RADIUS * this.scale, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          this.ready = true;
          resolve();
        }
      };
      step();
    });
  }

  revealAt(x, z, force = false) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const k = (cx + 100) * 1000 + (cz + 100);
    if (this.cells.has(k) && !force) return false;
    this.cells.add(k);
    this._draw(cx * CELL + CELL / 2, cz * CELL + CELL / 2);
    return true;
  }

  _draw(x, z) {
    const c = this.fctx;
    const [mx, my] = this.toMap(x, z);
    const r = REVEAL * this.scale;
    c.save();
    c.globalCompositeOperation = 'destination-out';
    const g = c.createRadialGradient(mx, my, r * 0.55, mx, my, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  serialize() { return [...this.cells]; }
  restore(cells) {
    for (const k of cells || []) {
      this.cells.add(k);
      const cz = (k % 1000) - 100, cx = Math.floor(k / 1000) - 100;
      this._draw(cx * CELL + CELL / 2, cz * CELL + CELL / 2);
    }
  }
  isRevealed(x, z) { return this.cells.has((Math.floor(x / CELL) + 100) * 1000 + (Math.floor(z / CELL) + 100)); }
}
