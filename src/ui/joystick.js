import { h } from './dom.js';

/** Floating virtual stick. x: right(+), y: up(+), both in -1..1. */
export class Joystick {
  constructor(zone) {
    this.zone = zone;
    this.x = 0; this.y = 0; this.active = false; this.pid = null;
    this.R = 54;
    this.knob = h('div', { class: 'joy-knob' });
    this.base = h('div', { class: 'joy-base' }, this.knob, h('div', { class: 'joy-hint' }, 'steer / throttle'));
    zone.append(this.base);
    this.placeIdle();
    zone.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('resize', () => { if (!this.active) this.placeIdle(); });
  }
  placeIdle() {
    const w = this.zone.clientWidth, hgt = this.zone.clientHeight;
    this.setBase(Math.min(86, w * 0.5), Math.max(60, hgt - 88));
  }
  setBase(x, y) { this.ox = x; this.oy = y; this.base.style.left = x + 'px'; this.base.style.top = y + 'px'; }
  down(e) {
    if (this.active) return;
    e.preventDefault();
    this.active = true; this.pid = e.pointerId;
    const r = this.zone.getBoundingClientRect();
    const x = Math.max(70, Math.min(r.width - 70, e.clientX - r.left));
    const y = Math.max(70, Math.min(r.height - 50, e.clientY - r.top));
    this.setBase(x, y);
    this.base.classList.add('active');
    this.cx = r.left + x; this.cy = r.top + y;
    this.move(e);
  }
  move(e) {
    if (!this.active || e.pointerId !== this.pid) return;
    let dx = e.clientX - this.cx, dy = e.clientY - this.cy;
    const len = Math.hypot(dx, dy);
    if (len > this.R) { dx = dx / len * this.R; dy = dy / len * this.R; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let nx = dx / this.R, ny = -dy / this.R;
    const m = Math.hypot(nx, ny);
    if (m < 0.12) { nx = 0; ny = 0; }
    this.x = nx; this.y = ny;
  }
  up(e) {
    if (!this.active || e.pointerId !== this.pid) return;
    this.active = false; this.pid = null; this.x = 0; this.y = 0;
    this.knob.style.transform = '';
    this.base.classList.remove('active');
    this.placeIdle();
  }
  reset() { this.active = false; this.pid = null; this.x = this.y = 0; this.knob.style.transform = ''; this.base.classList.remove('active'); this.placeIdle(); }
}
