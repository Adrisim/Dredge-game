import { h, svgNS } from './dom.js';
import { icon } from './icons.js';
import { FishingGame } from '../game/fishing.js';
import { audio } from '../audio.js';

const CX = 150, CY = 150, R = 118, SW = 30;
function arcPath(a0, a1, r = R) {
  const p = (a) => [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)];
  let span = ((a1 - a0) % 360 + 360) % 360;
  const [x0, y0] = p(a0), [x1, y1] = p(a0 + span);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const svgEl = (tag, attrs) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

export class FishingUI {
  /** fish = item def; stats = derived boat stats; onDone('caught'|'lost'|'cut') */
  constructor(game, fish, stats, onDone, opts = {}) {
    this.game = game;
    this.fish = fish;
    this.logic = new FishingGame(fish.fight, stats);
    this.onDone = onDone;
    this.delay = 0.9;
    this.finished = false;
    this.known = !!game.state.log[fish.id];
    const size = Math.min(window.innerWidth * 0.82, window.innerHeight * (window.innerHeight < 460 ? 0.6 : 0.42), 330);

    this.svg = svgEl('svg', { viewBox: '0 0 300 300', width: size, height: size });
    this.svg.append(
      svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'rgba(5,14,24,.7)', stroke: '#0a1824', 'stroke-width': SW + 8 }),
      svgEl('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: '#1d3b52', 'stroke-width': SW }),
    );
    for (let i = 0; i < 36; i++) {
      const a = i * 10 * Math.PI / 180, r0 = R - SW / 2 - 6, r1 = r0 - (i % 3 === 0 ? 9 : 4);
      this.svg.append(svgEl('line', { x1: CX + r0 * Math.sin(a), y1: CY - r0 * Math.cos(a), x2: CX + r1 * Math.sin(a), y2: CY - r1 * Math.cos(a), stroke: 'rgba(160,205,230,.35)', 'stroke-width': 2 }));
    }
    this.zoneEl = svgEl('path', { fill: 'none', stroke: '#ffd070', 'stroke-width': SW, 'stroke-linecap': 'butt' });
    this.perfEl = svgEl('path', { fill: 'none', stroke: '#7dff9a', 'stroke-width': SW, 'stroke-linecap': 'butt' });
    this.decoyEl = svgEl('path', { fill: 'none', stroke: '#ff4a4a', 'stroke-width': SW, 'stroke-linecap': 'butt', opacity: 0.9 });
    this.needle = svgEl('g', {});
    this.needle.append(
      svgEl('line', { x1: CX, y1: CY, x2: CX, y2: CY - R - SW / 2 - 4, stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      svgEl('circle', { cx: CX, cy: CY - R, r: 8, fill: '#fff', stroke: '#06121c', 'stroke-width': 3 }),
      svgEl('circle', { cx: CX, cy: CY, r: 9, fill: '#fff', stroke: '#06121c', 'stroke-width': 3 }),
    );
    this.svg.append(this.zoneEl, this.perfEl, this.decoyEl, this.needle);

    this.center = h('div', { class: 'center' }, h('div', { class: 'q' }, '?'));
    this.dial = h('div', { class: 'dial' }, this.svg, this.center);
    this.hitsEl = h('div', { class: 'hits' });
    this.strainEl = h('div', { class: 'strain' });
    this.sub = h('div', { class: 'sub' }, 'Something is biting...');
    this.title = h('div', { class: 'title' }, 'A bite!');
    this.btn = h('button', { class: 'reel-btn' }, 'Reel');
    const press = (e) => { e.preventDefault(); this.tap(); this.btn.classList.add('press'); setTimeout(() => this.btn.classList.remove('press'), 90); };
    this.btn.addEventListener('pointerdown', press);
    this.dial.addEventListener('pointerdown', press);
    this.cut = h('button', { class: 'btn sm cut', html: icon('close', 16) + 'Cut line', onclick: () => this.finish('cut') });
    this.el = h('div', { class: 'fishing' }, this.cut, this.title, this.sub, this.dial, this.hitsEl, this.strainEl, this.btn);
    this.keyHandler = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.tap(); } };
    window.addEventListener('keydown', this.keyHandler);
    game.uiRoot.append(this.el);
    this.drawStatic();
    this.drawDynamic();
    audio.bite();
  }

  drawStatic() {
    const L = this.logic;
    this.hitsEl.replaceChildren(...Array.from({ length: L.need }, (_, i) => h('i', { class: i < L.hits ? 'on' : '' })));
    this.strainEl.replaceChildren(h('span', {}, 'Line '), ...Array.from({ length: L.strainMax }, (_, i) => h('b', { class: i < L.strain ? 'on' : '' })));
  }

  drawDynamic() {
    const L = this.logic;
    this.zoneEl.setAttribute('d', arcPath(L.zc - L.zoneW / 2, L.zc + L.zoneW / 2));
    this.perfEl.setAttribute('d', arcPath(L.zc - L.perfectW / 2, L.zc + L.perfectW / 2));
    if (L.decoy !== null) { this.decoyEl.setAttribute('d', arcPath(L.decoy - L.decoyW / 2, L.decoy + L.decoyW / 2)); this.decoyEl.style.display = ''; }
    else this.decoyEl.style.display = 'none';
  }

  tap() {
    if (this.finished || this.delay > 0) return;
    const L = this.logic;
    const r = L.tap();
    if (r === 'perfect') { audio.perfect(); this.flash('flash-ok'); this.sub.textContent = 'Perfect!'; }
    else if (r === 'hit') { audio.hit(); this.flash('flash-ok'); this.sub.textContent = 'Reeling in...'; }
    else if (r === 'decoy') { audio.miss(); this.flash('flash-bad'); this.sub.textContent = 'It was a lure! The line strains.'; }
    else { audio.miss(); this.flash('flash-bad'); this.sub.textContent = 'Missed! The line strains.'; }
    this.game.vibrate(r === 'miss' || r === 'decoy' ? 40 : 15);
    this.drawStatic(); this.drawDynamic();
    if (L.done) this.finish(L.done);
  }

  flash(cls) { this.dial.classList.remove('flash-ok', 'flash-bad'); void this.dial.offsetWidth; this.dial.classList.add(cls); }

  update(dt) {
    if (this.finished) return;
    if (this.delay > 0) {
      this.delay -= dt;
      this.title.textContent = this.delay > 0.25 ? 'A bite!' : 'Get ready...';
      this.needle.setAttribute('transform', `rotate(${this.logic.angle} ${CX} ${CY})`);
      return;
    }
    const L = this.logic;
    if (this.title.textContent !== (this.known ? this.fish.name : 'Reel it in!')) this.title.textContent = this.known ? this.fish.name : 'Reel it in!';
    const wasDart = L.darted;
    L.update(dt);
    if (L.darted && !wasDart) { this.sub.textContent = 'It darted away!'; L.darted = false; this.drawDynamic(); }
    if (L.afk) { L.afk = false; this.drawStatic(); audio.miss(); this.sub.textContent = 'Too slow - the line strains!'; if (L.done) this.finish('lost'); }
    this.needle.setAttribute('transform', `rotate(${L.angle} ${CX} ${CY})`);
  }

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    window.removeEventListener('keydown', this.keyHandler);
    if (result === 'caught') { this.title.textContent = 'Hooked!'; this.sub.textContent = 'Pulling it aboard...'; }
    else if (result === 'lost') { this.title.textContent = 'It got away...'; this.sub.textContent = 'The line snapped.'; audio.escape(); }
    setTimeout(() => { this.el.remove(); this.onDone(result); }, result === 'cut' ? 0 : 650);
  }

  destroy() { window.removeEventListener('keydown', this.keyHandler); this.el.remove(); this.finished = true; }
}
