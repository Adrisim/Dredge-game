import { h } from './dom.js';
import { icon } from './icons.js';
import { Joystick } from './joystick.js';
import { fmtMoney } from '../util/math.js';
import { towns } from '../world/worldgen.js';
import { lensSpots } from '../world/spots.js';
import { audio } from '../audio.js';

export class Hud {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    this.labelEls = new Map();
    this.actionSig = '';

    // --- top-left status
    this.moneyEl = h('span', {}, '0');
    this.timeEl = h('span', {}, '08:00');
    this.dayEl = h('small', {}, 'Day 1');
    this.timeIcon = h('span', { html: icon('sun', 18) });
    this.hullEl = h('div', { class: 'pips' });
    this.panicFill = h('i');
    this.panicBar = h('div', { class: 'panic-bar' }, this.panicFill);
    this.panicChip = h('div', { class: 'chip', style: 'display:none' }, h('span', { html: icon('eye', 18), style: 'color:#c08aff' }), this.panicBar);
    this.tl = h('div', { class: 'hud tl' },
      h('div', { class: 'chip' }, h('span', { html: icon('coin', 18) }), this.moneyEl),
      h('div', { class: 'chip time' }, this.timeIcon, this.timeEl, this.dayEl),
      h('div', { class: 'chip' }, h('span', { html: icon('shield', 18), style: 'color:#6fe0a0' }), this.hullEl),
      this.panicChip,
    );

    // --- top-right: minimap + buttons
    this.mm = h('canvas', { width: 208, height: 208 });
    this.mmWrap = h('div', { class: 'minimap', onclick: () => game.openMap() }, this.mm, h('div', { class: 'n' }, 'N'));
    const rb = (ic, fn, extra) => h('button', { class: 'rbtn', html: icon(ic, 21), onclick: () => { audio.tap(); fn(); } }, extra);
    this.cargoBadge = h('span', { class: 'badge', style: 'display:none' });
    this.tr = h('div', { class: 'hud tr' },
      this.mmWrap,
      h('div', { class: 'rbtns' },
        rb('book', () => game.openJournal()),
        rb('bag', () => game.openCargo(), this.cargoBadge),
        rb('menu', () => game.openMenu())),
    );

    // --- bottom-right actions
    this.actionsEl = h('div', { class: 'row', style: 'flex-direction:column;align-items:flex-end;gap:10px' });
    this.lightBtn = h('button', { class: 'toggle', html: icon('lamp', 24), onclick: () => { audio.tap(); game.toggleLight(); } });
    this.cruiseBtn = h('button', { class: 'toggle', html: icon('up', 24), onclick: () => { audio.tap(); game.toggleCruise(); } });
    this.br = h('div', { class: 'hud br' },
      this.actionsEl,
      h('div', { class: 'row' }, this.cruiseBtn, this.lightBtn),
    );

    // --- centre top
    this.wpEl = h('div', { class: 'waypoint', style: 'display:none' });
    this.toasts = h('div', { style: 'display:flex;flex-direction:column;gap:6px;align-items:center' });
    this.topc = h('div', { class: 'topc' }, this.wpEl, this.toasts);

    this.bannerEl = h('div', { class: 'banner' }, h('h2'), h('p'));
    this.hintEl = null;
    this.labels = h('div', { class: 'labels' });
    this.vignette = h('div', { class: 'vignette' });
    this.flash = h('div', { class: 'dmgflash' });
    this.fadeEl = h('div', { class: 'fade' });
    this.joyZone = h('div', { id: 'joyzone' });
    this.joystick = new Joystick(this.joyZone);

    this.group = h('div', { style: 'position:absolute;inset:0;pointer-events:none' },
      this.vignette, this.labels, this.joyZone, this.tl, this.tr, this.br, this.topc, this.bannerEl);
    root.append(this.group, this.flash, this.fadeEl);
    this.show(false);
  }

  show(on) { this.group.style.display = on ? '' : 'none'; if (!on) this.joystick.reset(); }

  toast(msg, kind = '') {
    const t = h('div', { class: 'toast ' + kind }, msg);
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('fade'), 2800);
    setTimeout(() => t.remove(), 3400);
  }

  banner(title, sub = '') {
    const b = this.bannerEl;
    b.querySelector('h2').textContent = title;
    b.querySelector('p').textContent = sub;
    b.classList.add('show');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('show'), 3200);
  }

  hint(text) {
    if (this.hintEl) { this.hintEl.remove(); this.hintEl = null; }
    if (!text) return;
    this.hintEl = h('div', { class: 'hint' }, text);
    this.root.append(this.hintEl);
  }

  damageFlash() {
    this.flash.style.opacity = '1';
    setTimeout(() => (this.flash.style.opacity = '0'), 80);
  }

  fade(on) { this.fadeEl.classList.toggle('on', on); }

  /** actions: [{id,label,icon,cls,disabled,onClick}] */
  setActions(actions) {
    const sig = actions.map((a) => a.id + a.label + (a.disabled ? 'x' : '')).join('|');
    if (sig === this.actionSig) return;
    this.actionSig = sig;
    this.actionsEl.replaceChildren(...actions.map((a) => h('button', {
      class: 'abtn ' + (a.cls || '') + (a.disabled ? ' dis' : ''),
      html: icon(a.icon, 26) + `<span>${a.label}</span>`,
      onclick: () => { if (a.disabled) { audio.nope(); a.onDisabled && a.onDisabled(); } else { audio.tap(); a.onClick(); } },
    })));
  }

  setLabels(items) {
    const seen = new Set();
    for (const it of items) {
      seen.add(it.key);
      let el = this.labelEls.get(it.key);
      if (!el) {
        el = h('div', { class: 'label ' + (it.cls || '') });
        this.labels.append(el);
        this.labelEls.set(it.key, el);
      }
      if (el._t !== it.text + '|' + it.sub) { el.innerHTML = it.text + (it.sub ? `<small>${it.sub}</small>` : ''); el._t = it.text + '|' + it.sub; }
      el.style.left = it.x.toFixed(0) + 'px';
      el.style.top = it.y.toFixed(0) + 'px';
      el.style.opacity = it.opacity ?? 1;
    }
    for (const [k, el] of this.labelEls) if (!seen.has(k)) { el.remove(); this.labelEls.delete(k); }
  }

  update(game) {
    const s = game.state;
    this.moneyEl.textContent = fmtMoney(s.money);
    const hh = Math.floor(s.hour), mm = Math.floor((s.hour - hh) * 60);
    this.timeEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.dayEl.textContent = `Day ${s.day}`;
    const night = hh >= 20 || hh < 5;
    if (night !== this._night) { this._night = night; this.timeIcon.innerHTML = icon(night ? 'moon' : 'sun', 18); }
    const max = game.stats.hullMax;
    const sig = s.hull + '/' + max;
    if (sig !== this._hullSig) {
      this._hullSig = sig;
      this.hullEl.replaceChildren(...Array.from({ length: max }, (_, i) => h('div', { class: 'pip' + (i >= s.hull ? ' off' : s.hull <= 1 ? ' low' : '') })));
    }
    const showPanic = s.panic > 0.02;
    this.panicChip.style.display = showPanic ? '' : 'none';
    this.panicFill.style.width = Math.round(s.panic * 100) + '%';
    this.panicBar.classList.toggle('high', s.panic > 0.8);
    this.vignette.style.background = s.panic > 0.25
      ? `radial-gradient(ellipse at center, transparent 40%, rgba(50,0,80,${(Math.min(1, (s.panic - 0.25) / 0.75) * 0.55).toFixed(2)}) 100%)` : '';
    const free = s.inv.freeCells();
    this.cargoBadge.style.display = free <= 0 ? '' : 'none';
    this.cargoBadge.textContent = '!';
    this.lightBtn.classList.toggle('on', game.boat.lightOn);
    this.cruiseBtn.classList.toggle('on', game.cruise);
  }

  setWaypoint(info) {
    if (!info) { this.wpEl.style.display = 'none'; return; }
    this.wpEl.style.display = '';
    this.wpEl.innerHTML = `<span class="arrow" style="transform:rotate(${info.rot}rad)">${icon('up', 18)}</span><span>${info.name} · ${info.dist}</span>`;
  }

  drawMinimap(game) {
    const map = game.map;
    const c = this.mm, ctx = c.getContext('2d');
    const W = c.width;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0b2a3d'; ctx.fillRect(0, 0, W, W);
    const b = game.boat;
    const range = 640; // world units each side
    if (map.ready) {
      const [mx, my] = map.toMap(b.x, b.z);
      const sw = range * 2 * map.scale;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(map.base, mx - sw / 2, my - sw / 2, sw, sw, 0, 0, W, W);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(map.fog, mx - sw / 2, my - sw / 2, sw, sw, 0, 0, W, W);
      ctx.globalAlpha = 1;
    }
    const k = W / (range * 2);
    const px = (x) => W / 2 + (x - b.x) * k, pz = (z) => W / 2 + (z - b.z) * k;
    // spots (sonar)
    for (const c2 of game.spotsView.near) {
      const s = c2.s;
      const x = px(s.x), y = pz(s.z);
      if (x < 4 || y < 4 || x > W - 4 || y > W - 4) continue;
      ctx.fillStyle = s.type === 'dredge' ? '#d9b073' : s.type === 'crab' ? '#ffb05a' : s.type === 'lens' ? '#ffd84a' : s.aberrant ? '#d070ff' : '#bff6ff';
      ctx.beginPath(); ctx.arc(x, y, s.type === 'lens' ? 6 : 3.4, 0, 7); ctx.fill();
    }
    // towns
    for (const t of towns) {
      const x = px(t.x), y = pz(t.z);
      if (x < -10 || y < -10 || x > W + 10 || y > W + 10) continue;
      ctx.fillStyle = '#ffcf6b'; ctx.strokeStyle = '#2a1b00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.stroke();
    }
    // waypoint
    if (game.waypoint) {
      const dx = game.waypoint.x - b.x, dz = game.waypoint.z - b.z;
      const d = Math.hypot(dx, dz);
      let x = px(game.waypoint.x), y = pz(game.waypoint.z);
      if (d > range * 0.85) { x = W / 2 + dx / d * W * 0.44; y = W / 2 + dz / d * W * 0.44; }
      ctx.fillStyle = '#ff6b5b'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // boat
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.rotate(Math.PI - b.heading); // heading 0 = +z = pointing down on the map
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#06121c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 10); ctx.lineTo(0, 5); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    void lensSpots;
  }
}
