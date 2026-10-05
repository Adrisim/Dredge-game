import { h } from './dom.js';
import { icon, itemIconMarkup, shade } from './icons.js';
import { ITEMS, cellsFor, CATEGORY_LABEL } from '../game/items.js';
import { audio } from '../audio.js';
import { fmtMoney } from '../util/math.js';

const VERTICAL_ICONS = new Set(['squid']);
const rectCache = new Map();
function bestRect(id, rot, cells, w, hh) {
  const key = id + ':' + rot;
  let best = rectCache.get(key);
  if (best) return best;
  const set = new Set(cells.map((c) => c.join(',')));
  for (let y0 = 0; y0 < hh; y0++) for (let x0 = 0; x0 < w; x0++) for (let rw = 1; x0 + rw <= w; rw++) for (let rh = 1; y0 + rh <= hh; rh++) {
    let ok = true;
    for (let yy = y0; yy < y0 + rh && ok; yy++) for (let xx = x0; xx < x0 + rw; xx++) if (!set.has(xx + ',' + yy)) { ok = false; break; }
    if (!ok) continue;
    const area = rw * rh;
    if (!best || area > best.area || (area === best.area && Math.max(rw, rh) > Math.max(best.rw, best.rh))) best = { x0, y0, rw, rh, area };
  }
  rectCache.set(key, best);
  return best;
}

/** SVG for one polyomino piece at a given cell size. */
export const isShortLandscape = () => window.innerHeight < 520 && window.innerWidth > window.innerHeight;

export function pieceSvg(id, rot, cell, { quest = false } = {}) {
  const def = ITEMS[id];
  const { cells, w, h: hh } = cellsFor(id, rot);
  const col = def.color, dark = shade(col, -0.38), light = shade(col, 0.15);
  const W = w * cell, H = hh * cell;
  const set = new Set(cells.map((c) => c.join(',')));
  let base = '', inner = '';
  const ins = 2, ins2 = 5;
  for (const [cx, cy] of cells) {
    const x = cx * cell, y = cy * cell;
    base += `<rect class="hit" x="${x + ins}" y="${y + ins}" width="${cell - ins * 2}" height="${cell - ins * 2}" rx="7" fill="${dark}"/>`;
    inner += `<rect x="${x + ins2}" y="${y + ins2}" width="${cell - ins2 * 2}" height="${cell - ins2 * 2}" rx="5" fill="${col}"/>`;
    if (set.has(`${cx + 1},${cy}`)) {
      base += `<rect class="hit" x="${x + cell - ins - 1}" y="${y + ins}" width="${ins * 2 + 2}" height="${cell - ins * 2}" fill="${dark}"/>`;
      inner += `<rect x="${x + cell - ins2 - 1}" y="${y + ins2}" width="${ins2 * 2 + 2}" height="${cell - ins2 * 2}" fill="${col}"/>`;
    }
    if (set.has(`${cx},${cy + 1}`)) {
      base += `<rect class="hit" x="${x + ins}" y="${y + cell - ins - 1}" width="${cell - ins * 2}" height="${ins * 2 + 2}" fill="${dark}"/>`;
      inner += `<rect x="${x + ins2}" y="${y + cell - ins2 - 1}" width="${cell - ins2 * 2}" height="${ins2 * 2 + 2}" fill="${col}"/>`;
    }
  }
  // place the icon inside the largest solid rectangle of the piece so it never spills over neighbours
  const r = bestRect(id, rot, cells, w, hh);
  const ccx = (r.x0 + r.rw / 2) * cell, ccy = (r.y0 + r.rh / 2) * cell;
  const iconV = VERTICAL_ICONS.has(def.icon);
  const rotate = r.rw !== r.rh && iconV !== (r.rh > r.rw);
  const ew = r.rw * cell * 0.9, eh = r.rh * cell * 0.88;
  let sx = (rotate ? eh : ew) / 100, sy = (rotate ? ew : eh) / 100;
  const maxAspect = 1.9;
  if (sx / sy > maxAspect) sx = sy * maxAspect; else if (sy / sx > maxAspect) sy = sx * maxAspect;
  const tf = `translate(${ccx} ${ccy}) ${rotate ? 'rotate(90)' : ''} scale(${sx} ${sy}) translate(-50 -50)`;
  const outline = quest ? `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" fill="none" stroke="#ffcf6b" stroke-width="2" stroke-dasharray="5 4" opacity=".8"/>` : '';
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${base}${inner}<g opacity=".95" transform="${tf}">${itemIconMarkup(def.icon, light)}</g>${outline}</svg>`;
}

export function thumbSvg(id, size = 54) {
  const def = ITEMS[id];
  return `<svg class="thumb" width="${size}" height="${size}" viewBox="0 0 100 100">${itemIconMarkup(def.icon, def.color)}</svg>`;
}

export class CargoView {
  /** opts: {inv, mode:'edit'|'select', maxHeight, onSelect(item), onChange(), onDiscard(item), onPlaced(item), trashEl, dim(item)->bool} */
  constructor(opts) {
    this.opts = opts;
    this.inv = opts.inv;
    this.mode = opts.mode || 'edit';
    this.selected = null;
    this.tray = null;
    this.drag = null;
    this.root = h('div', { class: 'cargo-wrap' });
    this._move = (e) => this.onMove(e);
    this._up = (e) => this.onUp(e);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
    this.render();
  }

  destroy() {
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
    if (this.drag && this.drag.clone) this.drag.clone.remove();
  }

  get cell() {
    const land = isShortLandscape();
    const availW = land ? Math.min(window.innerWidth * 0.44, 420) : Math.min(window.innerWidth, 560) - 50;
    const maxH = land ? window.innerHeight - 74 - 36 - (this.opts.reserve || 0) : (this.opts.maxHeight || window.innerHeight * 0.4);
    let c = Math.floor(availW / this.inv.w);
    c = Math.min(c, Math.floor((maxH - 16) / this.inv.h), 64);
    return Math.max(land ? 28 : 32, c);
  }

  setTray(entry) { this.tray = entry ? { uid: -1, id: entry.id, rot: entry.rot || 0, w: entry.w ?? 1, quest: ITEMS[entry.id].quest } : null; this.renderTray(); }
  get selectedItem() { return this.selected != null ? this.inv.get(this.selected) : null; }
  select(uid) { this.selected = uid; this.render(); this.opts.onSelect && this.opts.onSelect(this.selectedItem); }

  render() {
    const inv = this.inv, cell = this.cell;
    this.curCell = cell;
    this.gridEl = h('div', { class: 'cells', style: { gridTemplateColumns: `repeat(${inv.w}, ${cell}px)`, gridTemplateRows: `repeat(${inv.h}, ${cell}px)` } });
    for (let y = 0; y < inv.h; y++) for (let x = 0; x < inv.w; x++) {
      this.gridEl.append(h('div', { class: 'cg-cell' + (inv.broken.has(x + ',' + y) ? ' broken' : '') }));
    }
    this.itemsEl = h('div', { style: 'position:absolute;left:8px;top:8px;right:8px;bottom:8px;pointer-events:none' });
    for (const it of inv.items) this.itemsEl.append(this.makeItemEl(it, cell, false));
    this.ghostEl = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    this.itemsEl.append(this.ghostEl);
    this.boxEl = h('div', { class: 'cargo' }, this.gridEl, this.itemsEl);
    this.trayEl = h('div', { class: 'tray', style: this.tray ? '' : 'display:none' }, h('span', { class: 'tray-label' }, 'New cargo'));
    this.root.replaceChildren(this.boxEl, this.trayEl);
    this.renderTray();
  }

  renderTray() {
    if (!this.trayEl) return;
    const cell = this.curCell || this.cell;
    this.trayEl.querySelectorAll('.cg-item').forEach((n) => n.remove());
    this.trayEl.style.display = this.tray ? '' : 'none';
    if (!this.tray) return;
    this.trayEl.append(this.makeItemEl(this.tray, cell, true));
  }

  makeItemEl(it, cell, tray) {
    const def = ITEMS[it.id];
    const el = h('div', { class: 'cg-item' + (!tray && it.uid === this.selected ? ' sel' : ''), dataset: { uid: it.uid } });
    el.innerHTML = pieceSvg(it.id, it.rot, cell, { quest: def.quest });
    if (!tray) { el.style.left = it.x * cell + 'px'; el.style.top = it.y * cell + 'px'; }
    if (this.opts.dim && this.opts.dim(it)) el.style.opacity = '0.4';
    el.addEventListener('pointerdown', (e) => this.onDown(e, it, el, tray));
    return el;
  }

  onDown(e, it, el, tray) {
    if (this.drag) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    this.drag = { it, el, tray, pid: e.pointerId, sx: e.clientX, sy: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, started: false, w: r.width, h: r.height };
  }

  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.started) {
      if (this.mode === 'select') return;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 8) return;
      d.started = true;
      d.clone = d.el.cloneNode(true);
      d.clone.classList.add('clone');
      d.clone.style.left = '0px'; d.clone.style.top = '0px';
      document.getElementById('ui').append(d.clone);
      d.el.classList.add('lifted');
      audio.tap();
    }
    d.clone.style.transform = `translate(${e.clientX - d.gx}px, ${e.clientY - d.gy}px)`;
    // grid target
    const cell = this.curCell;
    const rect = this.gridEl.getBoundingClientRect();
    const tlx = e.clientX - d.gx - rect.left, tly = e.clientY - d.gy - rect.top;
    const gx = Math.round(tlx / cell), gy = Math.round(tly / cell);
    const { w, h: hh } = cellsFor(d.it.id, d.it.rot);
    const overlaps = gx > -w && gy > -hh && gx < this.inv.w && gy < this.inv.h;
    this.ghostEl.replaceChildren();
    d.target = null;
    if (overlaps) {
      const ok = this.inv.canPlace(d.it.id, gx, gy, d.it.rot, d.tray ? -1 : d.it.uid);
      d.target = { x: gx, y: gy, ok };
      for (const [cx, cy] of cellsFor(d.it.id, d.it.rot).cells) {
        this.ghostEl.append(h('div', { class: 'cg-ghost ' + (ok ? 'ok' : 'bad'), style: { left: (gx + cx) * cell + 'px', top: (gy + cy) * cell + 'px', width: cell + 'px', height: cell + 'px' } }));
      }
    }
    if (this.opts.trashEl) {
      const tr = this.opts.trashEl.getBoundingClientRect();
      const over = e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top - 20 && e.clientY <= tr.bottom + 20;
      this.opts.trashEl.classList.toggle('hot', over);
      d.overTrash = over;
    }
  }

  onUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    this.drag = null;
    if (d.clone) d.clone.remove();
    if (this.opts.trashEl) this.opts.trashEl.classList.remove('hot');
    if (!d.started) {
      // tap
      if (d.tray) { this.rotateTray(); return; }
      this.select(this.selected === d.it.uid && this.mode !== 'select' ? d.it.uid : d.it.uid);
      audio.tap();
      return;
    }
    d.el.classList.remove('lifted');
    this.ghostEl.replaceChildren();
    if (d.overTrash) {
      if (ITEMS[d.it.id].quest) { audio.nope(); this.flashNo(); return; }
      this.opts.onDiscard && this.opts.onDiscard(d.it, d.tray);
      return;
    }
    if (d.target && d.target.ok) {
      if (d.tray) {
        const item = this.inv.add(d.it.id, { w: d.it.w }, { x: d.target.x, y: d.target.y, rot: d.it.rot });
        audio.place();
        this.tray = null;
        this.render();
        this.opts.onPlaced && this.opts.onPlaced(item);
      } else {
        d.it.x = d.target.x; d.it.y = d.target.y;
        audio.place();
        this.selected = d.it.uid;
        this.render();
        this.opts.onChange && this.opts.onChange();
        this.opts.onSelect && this.opts.onSelect(d.it);
      }
    } else if (d.target) { audio.nope(); }
  }

  flashNo() { this.boxEl.classList.remove('shake'); void this.boxEl.offsetWidth; this.boxEl.classList.add('shake'); }

  rotateTray() {
    if (!this.tray) return;
    this.tray.rot = (this.tray.rot + 1) & 3;
    audio.tap();
    this.renderTray();
  }

  rotateSelected() {
    if (this.tray) { this.rotateTray(); return true; }
    const it = this.selectedItem;
    if (!it) return false;
    const nr = (it.rot + 1) & 3;
    let best = null;
    for (let y = 0; y < this.inv.h; y++) for (let x = 0; x < this.inv.w; x++) {
      if (!this.inv.canPlace(it.id, x, y, nr, it.uid)) continue;
      const dist = Math.abs(x - it.x) + Math.abs(y - it.y);
      if (!best || dist < best.dist) best = { x, y, dist };
    }
    if (!best) { audio.nope(); this.flashNo(); return false; }
    it.rot = nr; it.x = best.x; it.y = best.y;
    audio.tap();
    this.render();
    this.opts.onChange && this.opts.onChange();
    this.opts.onSelect && this.opts.onSelect(it);
    return true;
  }
}

// ---------------------------------------------------------------- shared item card
export function itemCard(it, extra = {}) {
  const def = ITEMS[it.id];
  const kg = (def.kg * (it.w ?? 1)).toFixed(1);
  const tags = [h('span', { class: 'tag' + (def.cat === 'aberrant' ? ' ab' : def.quest ? ' q' : '') }, CATEGORY_LABEL[def.cat] || def.cat)];
  if (extra.isNew) tags.push(h('span', { class: 'tag new' }, 'New species'));
  const el = h('div', { class: 'itemcard' });
  el.innerHTML = thumbSvg(it.id);
  el.append(h('div', { style: 'flex:1;min-width:0' },
    h('h4', {}, def.name, ...tags),
    h('p', {}, def.desc),
    h('p', { style: 'margin-top:4px' }, `${kg} kg`, def.value ? h('span', {}, ' · worth ', h('span', { class: 'price' }, fmtMoney(def.value * (it.w ?? 1)))) : ''),
    extra.extra || null,
  ));
  return el;
}

// ---------------------------------------------------------------- full-screen cargo hold
export function openCargoScreen(game) {
  const inv = game.state.inv;
  const sheet = h('div', { class: 'sheet' });
  const summary = h('small', {});
  const info = h('div', { style: 'width:100%' });
  const trash = h('div', { class: 'trash', html: icon('trash', 18) + '<span>Drag here to discard</span>' });
  const btnRot = h('button', { class: 'btn', html: icon('rotate', 18) + 'Rotate', onclick: () => view.rotateSelected() });
  const btnDrop = h('button', { class: 'btn danger', html: icon('trash', 18) + 'Discard', onclick: () => discard(view.selectedItem) });
  const refreshSummary = () => {
    const used = inv.w * inv.h - inv.freeCells();
    summary.textContent = `${used}/${inv.w * inv.h} cells${inv.broken.size ? ` · ${inv.broken.size} damaged` : ''} · cargo worth ${fmtMoney(inv.totalValue())}`;
  };
  const showInfo = (it) => {
    info.replaceChildren(it ? itemCard(it) : h('div', { class: 'itemcard' }, h('p', { style: 'align-self:center' }, 'Drag pieces to rearrange. Tap a piece to inspect or rotate it. Red hatched cells are damaged - repair them at a shipyard.')));
    const q = it && ITEMS[it.id].quest;
    btnRot.disabled = !it; btnDrop.disabled = !it || q;
    btnRot.classList.toggle('dis', !it); btnDrop.classList.toggle('dis', !it || q);
  };
  const discard = (it) => {
    if (!it) return;
    if (ITEMS[it.id].quest) { audio.nope(); return; }
    const worth = ITEMS[it.id].value * it.w;
    const doIt = () => { inv.remove(it.uid); audio.splash(); view.selected = null; view.render(); showInfo(null); refreshSummary(); game.hud.toast(`Threw back the ${ITEMS[it.id].name}`); };
    if (worth >= 100) game.confirm(`Throw back ${ITEMS[it.id].name}?`, `It's worth about ${fmtMoney(worth)}.`, doIt, 'Throw back');
    else doIt();
  };
  const view = new CargoView({
    inv, mode: 'edit', trashEl: trash, maxHeight: window.innerHeight * 0.38,
    onSelect: showInfo, onChange: refreshSummary, onDiscard: (it) => discard(it),
  });
  const close = () => { view.destroy(); sheet.remove(); audio.close(); game.closeModal(); };
  sheet.append(
    h('div', { class: 'sheet-head' }, h('h1', {}, 'Cargo Hold', summary), h('button', { class: 'xbtn', html: icon('close', 20), onclick: close })),
    h('div', { class: 'sheet-body' }, h('div', { class: 'split' },
      h('div', { class: 'l' }, view.root),
      h('div', { class: 'r' }, info, h('div', { class: 'row', style: 'width:100%' }, btnRot, btnDrop), trash))),
  );
  showInfo(null); refreshSummary();
  game.openModal(sheet, close);
}

// ---------------------------------------------------------------- placing newly acquired items
/** entries: [{id, w}] -> Promise<{stored, thrown}> */
export function openPlacementScreen(game, entries, { title = 'Catch!', verb = 'caught' } = {}) {
  return new Promise((resolve) => {
    const inv = game.state.inv;
    const queue = entries.map((e) => ({ id: e.id, w: e.w ?? 1, rot: 0, isNew: !!e.isNew }));
    let stored = 0, thrown = 0;
    const sheet = h('div', { class: 'sheet' });
    const cardHolder = h('div', { style: 'width:100%' });
    const msg = h('div', { class: 'empty', style: 'padding:4px 8px;font-size:12.5px' });
    const trash = h('div', { class: 'trash', html: icon('trash', 18) + '<span>Drag a stored item here to make room</span>' });
    const head = h('h1', {}, title, h('small', {}));
    let view;
    const btnRot = h('button', { class: 'btn', html: icon('rotate', 18) + 'Rotate', onclick: () => view.rotateTray() });
    const btnThrow = h('button', { class: 'btn danger', html: icon('trash', 18) + 'Throw back', onclick: () => throwBack() });

    const current = () => queue[0];
    const refresh = () => {
      const cur = current();
      if (!cur) { finish(); return; }
      head.querySelector('small').textContent = queue.length > 1 ? `${queue.length} items to stow` : 'Find it a place in the hold';
      cardHolder.replaceChildren(itemCard(cur, { isNew: cur.isNew }));
      view.setTray(cur);
      const fit = inv.findSpot(cur.id);
      msg.textContent = fit ? 'Drag the piece into your hold. Tap it to rotate.' : (ITEMS[cur.id].quest ? 'No room! Discard something else to make space.' : 'No room! Rearrange your hold, discard something, or throw it back.');
      msg.style.color = fit ? '' : 'var(--accent)';
      btnThrow.style.display = ITEMS[cur.id].quest ? 'none' : '';
    };
    const finish = () => { view.destroy(); sheet.remove(); game.closeModal(true); resolve({ stored, thrown }); };
    const throwBack = () => {
      const cur = current();
      if (!cur || ITEMS[cur.id].quest) return;
      const done = () => { audio.splash(); thrown++; queue.shift(); refresh(); };
      const worth = ITEMS[cur.id].value * cur.w;
      if (worth >= 150) game.confirm(`Throw back ${ITEMS[cur.id].name}?`, `It's worth about ${fmtMoney(worth)}.`, done, 'Throw back');
      else done();
    };
    view = new CargoView({
      inv, mode: 'edit', trashEl: trash, maxHeight: window.innerHeight * 0.34, reserve: 100,
      onPlaced: () => { stored++; queue.shift(); audio.catchFish(); refresh(); },
      onDiscard: (it, fromTray) => {
        if (fromTray) { throwBack(); return; }
        inv.remove(it.uid); audio.splash(); view.selected = null; view.render(); view.setTray(current());
        game.hud.toast(`Threw back the ${ITEMS[it.id].name}`);
        refresh();
      },
    });
    sheet.append(
      h('div', { class: 'sheet-head' }, head),
      h('div', { class: 'sheet-body' }, h('div', { class: 'split' },
        h('div', { class: 'l' }, view.root),
        h('div', { class: 'r' }, cardHolder, msg, h('div', { class: 'row', style: 'width:100%' }, btnRot, btnThrow), trash))),
    );
    game.openModal(sheet, null);
    refresh();
  });
}
