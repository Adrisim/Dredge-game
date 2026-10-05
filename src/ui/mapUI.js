import { h } from './dom.js';
import { icon } from './icons.js';
import { towns, zoneName, zoneAt, ZONES } from '../world/worldgen.js';
import { lensSpots } from '../world/spots.js';
import { EXTENT } from '../world/mapdata.js';
import { audio } from '../audio.js';

export function openMapScreen(game) {
  const map = game.map;
  const st = game.state;
  const sheet = h('div', { class: 'sheet' });
  const canvas = h('canvas');
  const wrap = h('div', { class: 'mapwrap' }, canvas);
  const info = h('div', { class: 'mapinfo', style: 'display:none' });
  let W = 0, H = 0;
  const view = { cx: game.boat.x, cz: game.boat.z, s: 0.045 };
  let selected = null;
  let raf = 0, closed = false;
  const pointers = new Map();
  let pinch = null, tapInfo = null;

  const fit = () => { W = wrap.clientWidth; H = wrap.clientHeight; canvas.width = W * Math.min(2, window.devicePixelRatio || 1); canvas.height = H * Math.min(2, window.devicePixelRatio || 1); };
  const minScale = () => Math.max(0.02, Math.min(W, H) / (EXTENT * 2.1));
  const toScreen = (x, z) => [W / 2 + (x - view.cx) * view.s, H / 2 + (z - view.cz) * view.s];
  const toWorld = (sx, sy) => [view.cx + (sx - W / 2) / view.s, view.cz + (sy - H / 2) / view.s];
  const clampView = () => { view.s = Math.max(minScale(), Math.min(0.5, view.s)); view.cx = Math.max(-EXTENT, Math.min(EXTENT, view.cx)); view.cz = Math.max(-EXTENT, Math.min(EXTENT, view.cz)); };

  const markers = () => {
    const list = [];
    for (const t of towns) list.push({ kind: 'town', x: t.x, z: t.z, t, visited: st.visited.includes(t.id) });
    if (st.main.stage >= 1 && st.main.stage < 5) for (const l of lensSpots) if (!st.main.have[l.lens - 1]) list.push({ kind: 'lens', x: l.x, z: l.z, lens: l.lens });
    for (const p of st.pots) list.push({ kind: 'pot', x: p.x, z: p.z, pot: p });
    return list;
  };

  function draw() {
    if (closed) return;
    const ctx = canvas.getContext('2d');
    const dpr = canvas.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050d16'; ctx.fillRect(0, 0, W, H);
    if (map.ready) {
      const [x0, y0] = toScreen(-EXTENT, -EXTENT);
      const size = EXTENT * 2 * view.s;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(map.base, x0, y0, size, size);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(map.fog, x0, y0, size, size);
      ctx.globalAlpha = 1;
    }
    // zone names along the vertical axis
    ctx.font = '600 11px Georgia, serif'; ctx.textAlign = 'center';
    ZONES.forEach((zn, i) => {
      const inner = i === 0 ? 0 : ZONES[i - 1].maxR;
      const outer = Math.min(zn.maxR, 4300);
      const [sx, sy] = toScreen(0, -(inner + outer) / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
      if (sy > 10 && sy < H - 10) { ctx.strokeText(zn.name.toUpperCase(), sx, sy); ctx.fillText(zn.name.toUpperCase(), sx, sy); }
    });
    // markers
    ctx.textAlign = 'center';
    for (const m of markers()) {
      const [sx, sy] = toScreen(m.x, m.z);
      if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
      if (m.kind === 'town') {
        ctx.fillStyle = m.visited ? '#ffcf6b' : '#8a9aa6'; ctx.strokeStyle = '#06121c'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, m.visited ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
        if (m.visited || view.s > 0.09) { ctx.font = '700 12px Georgia, serif'; ctx.fillStyle = '#f3e6c4'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; const nm = m.visited ? m.t.name : '???'; ctx.strokeText(nm, sx, sy - 12); ctx.fillText(nm, sx, sy - 12); }
      } else if (m.kind === 'lens') {
        ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 4.5 : 10; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (m.kind === 'pot') {
        ctx.fillStyle = '#ff8a2a'; ctx.strokeStyle = '#2a1000'; ctx.lineWidth = 2; ctx.fillRect(sx - 4, sy - 4, 8, 8); ctx.strokeRect(sx - 4, sy - 4, 8, 8);
      }
    }
    // waypoint
    if (game.waypoint) {
      const [sx, sy] = toScreen(game.waypoint.x, game.waypoint.z);
      ctx.strokeStyle = '#ff6b5b'; ctx.lineWidth = 3; ctx.fillStyle = '#ff6b5b';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy - 22); ctx.lineTo(sx + 14, sy - 17); ctx.lineTo(sx, sy - 11); ctx.fill();
    }
    // boat
    {
      const b = game.boat;
      const [sx, sy] = toScreen(b.x, b.z);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI - b.heading);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#06121c'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 11); ctx.lineTo(0, 6); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (selected) {
      const [sx, sy] = toScreen(selected.x, selected.z);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    raf = requestAnimationFrame(draw);
  }

  function select(x, z, town) {
    selected = { x, z };
    const d = Math.hypot(x - game.boat.x, z - game.boat.z);
    const zone = zoneAt(x, z);
    const nm = town ? (st.visited.includes(town.id) ? town.name : 'Unexplored settlement') : 'Waypoint';
    info.style.display = '';
    info.replaceChildren(
      h('h3', {}, nm),
      h('p', {}, `${zoneName(zone)} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'} away${town && st.visited.includes(town.id) ? ' · ' + town.blurb : ''}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm primary', html: icon('compass', 16) + 'Set waypoint', onclick: () => { game.setWaypoint(x, z, nm, town); audio.tap(); } }),
        h('button', { class: 'btn sm', html: icon('up', 16) + 'Autopilot', onclick: () => { game.setWaypoint(x, z, nm, town); close(); game.startAutopilot(); } }),
        game.waypoint ? h('button', { class: 'btn sm', onclick: () => { game.clearWaypoint(); selected = null; info.style.display = 'none'; } }, 'Clear') : null),
    );
  }

  // gestures
  const onDown = (e) => {
    wrap.setPointerCapture && wrap.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tapInfo = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false } : null;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; }
  };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      view.cx -= dx / view.s; view.cz -= dy / view.s; clampView();
      if (tapInfo && Math.hypot(e.clientX - tapInfo.x, e.clientY - tapInfo.y) > 8) tapInfo.moved = true;
    } else if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      view.s = pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; clampView();
    }
  };
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (tapInfo && !tapInfo.moved && performance.now() - tapInfo.t < 400 && pointers.size === 0) {
      const r = wrap.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      let best = null, bd = 28;
      for (const m of markers()) { if (m.kind !== 'town') continue; const [mx, my] = toScreen(m.x, m.z); const d = Math.hypot(mx - sx, my - sy); if (d < bd) { bd = d; best = m; } }
      if (best) select(best.x, best.z, best.t);
      else { const [wx, wz] = toWorld(sx, sy); select(wx, wz, null); }
      audio.tap();
    }
    if (pointers.size < 2) pinch = null;
  };
  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', onUp);
  wrap.addEventListener('wheel', (e) => { e.preventDefault(); view.s *= e.deltaY < 0 ? 1.15 : 0.87; clampView(); }, { passive: false });

  const zoom = (f) => { view.s *= f; clampView(); };
  const close = () => { closed = true; cancelAnimationFrame(raf); sheet.remove(); audio.close(); game.closeModal(); };
  const ctl = h('div', { class: 'mapctl' },
    h('button', { class: 'xbtn', html: icon('plus', 20), onclick: () => zoom(1.4) }),
    h('button', { class: 'xbtn', html: icon('minus', 20), onclick: () => zoom(1 / 1.4) }),
    h('button', { class: 'xbtn', html: icon('compass', 20), onclick: () => { view.cx = game.boat.x; view.cz = game.boat.z; view.s = Math.max(view.s, 0.12); clampView(); } }));
  const legend = h('div', { class: 'legend', html: '<i style="background:#ffcf6b"></i>Town<br><i style="background:#ffd84a"></i>Lens fragment<br><i style="background:#ff8a2a"></i>Crab pot<br><i style="background:#ff6b5b"></i>Waypoint' });
  wrap.append(legend, ctl, info);
  sheet.append(h('div', { class: 'sheet-head' }, h('h1', {}, 'Chart of the Hollow Sea', h('small', {}, 'Drag to pan · pinch to zoom · tap a place to navigate')), h('button', { class: 'xbtn', html: icon('close', 20), onclick: close })), wrap);
  game.openModal(sheet, close);
  fit(); clampView();
  view.s = minScale() * 1.0;
  if (game.waypoint) { selected = game.waypoint; }
  raf = requestAnimationFrame(draw);
  window.addEventListener('resize', fit, { once: false });
}
