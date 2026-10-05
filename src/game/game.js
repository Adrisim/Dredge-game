import * as THREE from 'three';
import { Environment } from '../world/environment.js';
import { Water } from '../world/water.js';
import { Sky } from '../world/sky.js';
import { IslandManager } from '../world/islandManager.js';
import { SpotsView, PotsView } from '../world/spotsView.js';
import { MapData } from '../world/mapdata.js';
import { U, waveHeight } from '../world/shared.js';
import { Boat } from '../entities/boat.js';
import { Gulls, Bobber, Ghosts } from '../entities/ambient.js';
import { towns, getTown, zoneAt, zoneName, heightAt } from '../world/worldgen.js';
import { spots, lensSpots, spotAvailable, useSpot } from '../world/spots.js';
import { ITEMS, rollFish, rollDredge, rollCrabs } from './items.js';
import { newState, load, save, absHours, wipe, hasSave } from './state.js';
import { statsFor, UPGRADES, curIndex } from './upgrades.js';
import { QUESTS, MAIN } from './quests.js';
import { Hud } from '../ui/hud.js';
import { FishingUI } from '../ui/fishingUI.js';
import { openCargoScreen, openPlacementScreen } from '../ui/cargoUI.js';
import { openTown } from '../ui/townUI.js';
import { openMapScreen } from '../ui/mapUI.js';
import { openMenu, openJournal, openFishLog, openSettings, buildTitle } from '../ui/menus.js';
import { h } from '../ui/dom.js';
import { audio } from '../audio.js';
import { DAY_SECONDS, WORLD_RADIUS } from '../config.js';
import { clamp, lerp, angleDiff, smoothstep, fmtMoney } from '../util/math.js';

const HOURS_PER_SEC = 24 / DAY_SECONDS;
const POT_HOURS = 3.5;
const TITLE_HOUR = 6.9;

export class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.uiRoot = document.getElementById('ui');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 3000);
    this.env = new Environment(this.scene);
    this.water = new Water(); this.scene.add(this.water.mesh);
    this.sky = new Sky(); this.scene.add(this.sky.mesh);
    this.islandMgr = new IslandManager(this.scene);
    this.boat = new Boat(this.scene);
    this.spotsView = new SpotsView(this.scene);
    this.potsView = new PotsView(this.scene);
    this.gulls = new Gulls(this.scene);
    this.bobber = new Bobber(this.scene);
    this.ghosts = new Ghosts(this.scene);
    this.map = new MapData();
    this.state = newState();
    this.stats = statsFor(this.state.up);

    this.mode = 'title';
    this.modals = [];
    this.cruise = false;
    this.waypoint = null;
    this.autopilot = false;
    this.fishing = null;       // {phase, t, wait, spot, ui}
    this.dredging = null;      // {spot, t, need}
    this.lastTownTab = 'market';
    this.keys = new Set();
    this.cam = { heading: 0, userYaw: 0, userPitch: 0, dist: 24, idle: 0, shake: 0, titleA: 0 };
    this.hintTimer = 0;
    this.timers = { actions: 0, minimap: 0, labels: 0, save: 0, reveal: 0, spots: 0, zone: 0, panicWhisper: 0, ghost: 8 };
    this.curZone = 0;
    this.msgCooldown = 0;
    this.perf = { acc: 0, n: 0, ratio: 1, cap: 2, t: 0 };
    this.contextActions = [];

    this.hud = new Hud(this.uiRoot, this);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode !== 'title') this.saveGame(); });
    window.addEventListener('pagehide', () => { if (this.mode !== 'title') this.saveGame(); });

    this.map.generate();
    this.setupTitle();
    this.last = performance.now();
    this.applyQuality();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------------------ lifecycle
  setupTitle() {
    this.mode = 'title';
    this.hud.show(false);
    this.hud.setActions([]);
    this.hud.setLabels([]);
    const port = getTown('saltmere');
    this.boat.teleport(port.dock.boat.x, port.dock.boat.z, port.dock.boat.heading);
    this.boat.lightOn = false;
    this.islandMgr.preload(this.boat.x, this.boat.z);
    this.potsView.sync([]);
    this.titleEl = buildTitle(this, () => { audio.unlock(); audio.open(); this.startFresh(); }, () => { audio.unlock(); audio.open(); this.startContinue(); });
    this.uiRoot.append(this.titleEl);
  }

  toTitle() {
    this.closeAllModals();
    this.cancelActivities();
    this.ghosts.clear();
    this.setupTitle();
  }

  startFresh() {
    wipe();
    this.state = newState();
    this.begin(null);
    this.state.flags.fresh = true;
    this.showHint('h_move', 'Use the stick (bottom-left) to sail: up for throttle, left/right to steer. Head for the bubbling water ahead.', 9);
  }

  newGame() { if (this.titleEl) this.titleEl.remove(); this.closeAllModals(); this.cancelActivities(); this.startFresh(); }

  startContinue() {
    const st = load();
    if (!st) { this.startFresh(); return; }
    this.state = st;
    this.begin(st.pos);
  }

  begin(pos) {
    if (this.titleEl) { this.titleEl.remove(); this.titleEl = null; }
    const st = this.state;
    this.applyState();
    // a lens fragment flagged as found but absent from the hold (e.g. closed mid-placement) goes back to the seabed
    if (!st.main.delivered) st.main.have = st.main.have.map((v, i) => v && st.inv.count('lens_' + (i + 1)) > 0);
    const port = getTown(st.lastPort) || getTown('saltmere');
    const p = pos || { x: port.dock.boat.x, z: port.dock.boat.z, heading: port.dock.boat.heading };
    this.boat.teleport(p.x, p.z, p.heading);
    this.cam.heading = p.heading;
    this.islandMgr.preload(p.x, p.z);
    this.map.restore(st.discovered);
    this.map.revealAt(p.x, p.z);
    this.potsView.sync(st.pots);
    this.curZone = zoneAt(p.x, p.z);
    this.cruise = false; this.waypoint = null; this.autopilot = false;
    this.boat.lightOn = false;
    this.mode = 'sail';
    this.hud.show(true);
    audio.setEnabled(st.settings.sound);
    this.islandMgr.isLit = (isl) => !(isl.town && isl.town.id === 'hollow') || st.main.delivered;
    this.hud.banner(zoneName(this.curZone), 'Day ' + st.day);
  }

  applyState() {
    const st = this.state;
    this.stats = statsFor(st.up);
    st.inv.resize(Math.max(st.inv.w, this.stats.grid[0]), Math.max(st.inv.h, this.stats.grid[1]));
    st.hull = clamp(st.hull, 0, this.stats.hullMax);
    this.boat.setUpgrades(st.up);
  }

  saveGame(manual = false) {
    const st = this.state;
    st.pos = { x: this.boat.x, z: this.boat.z, heading: this.boat.heading };
    st.discovered = this.map.serialize();
    const ok = save(st);
    if (manual) this.hud.toast(ok ? 'Game saved' : 'Could not save (storage unavailable)', ok ? 'good' : 'bad');
    return ok;
  }

  // ------------------------------------------------------------------------------ modals
  openModal(el, onClose) {
    this.uiRoot.append(el);
    this.modals.push({ el, onClose });
    this.hud.joystick.reset();
    audio.open();
  }
  closeModal() { this.modals.pop(); }
  closeAllModals() {
    while (this.modals.length) { const m = this.modals.pop(); try { m.onClose ? m.onClose() : m.el.remove(); } catch { m.el.remove(); } }
    this.modals = [];
  }
  get paused() { return this.modals.length > 0 || this.mode === 'title'; }

  confirm(title, text, onYes, yesLabel = 'OK') {
    const m = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('h2', {}, title), h('p', {}, text),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => m.remove() }, 'Cancel'),
        h('button', { class: 'btn danger', onclick: () => { m.remove(); onYes(); } }, yesLabel))));
    this.uiRoot.append(m);
  }

  notice(title, text, label = 'Continue', cb) {
    const m = h('div', { class: 'modal' }, h('div', { class: 'box' }, h('h2', {}, title), h('p', {}, text),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => { m.remove(); cb && cb(); } }, label))));
    this.uiRoot.append(m);
  }

  openMap() { if (this.canOpenUi()) openMapScreen(this); }
  openCargo() { if (this.canOpenUi()) openCargoScreen(this); }
  openMenu() { if (this.canOpenUi(true)) openMenu(this); }
  openJournal() { if (this.canOpenUi()) openJournal(this); }
  openFishLog() { openFishLog(this); }
  openSettings() { openSettings(this); }
  canOpenUi(allowFishing = false) { return this.mode !== 'title' && this.mode !== 'dying' && !this.modals.length && (allowFishing || !this.fishing?.ui); }

  vibrate(ms) { if (this.state.settings.vibrate !== false && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignore */ } }

  // ------------------------------------------------------------------------------ input
  bindInput() {
    const c = this.canvas;
    const ptrs = new Map();
    let pinch = null, dragging = null;
    c.addEventListener('pointerdown', (e) => {
      audio.unlock();
      if (this.paused) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture && c.setPointerCapture(e.pointerId);
      if (ptrs.size === 1) dragging = e.pointerId;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.cam.dist }; }
    });
    c.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1 && dragging === e.pointerId) {
        this.cam.userYaw -= dx * 0.006;
        this.cam.userPitch = clamp(this.cam.userPitch + dy * 0.004, -0.3, 0.7);
        this.cam.idle = 0;
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        this.cam.dist = clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 13, 50);
        this.cam.idle = 0;
      }
    });
    const end = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (dragging === e.pointerId) dragging = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => { this.cam.dist = clamp(this.cam.dist * (e.deltaY > 0 ? 1.08 : 0.92), 13, 50); }, { passive: true });
    window.addEventListener('keydown', (e) => {
      audio.unlock();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape') { const m = this.modals[this.modals.length - 1]; if (m) { m.onClose ? m.onClose() : m.el.remove(); } else if (this.mode === 'sail') this.openMenu(); }
      if (this.paused || this.mode !== 'sail') return;
      if (e.code === 'Space' || e.code === 'KeyE') { const a = this.contextActions.find((x) => !x.disabled); if (a) a.onClick(); }
      if (e.code === 'KeyL') this.toggleLight();
      if (e.code === 'KeyM') this.openMap();
      if (e.code === 'KeyC') this.openCargo();
      if (e.code === 'KeyV') this.toggleCruise();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  toggleLight() { this.boat.lightOn = !this.boat.lightOn; audio.tap(); }
  toggleCruise() {
    this.cruise = !this.cruise;
    if (this.cruise) { this.autopilot = false; this.hud.toast('Cruise control on - pull the stick down to stop'); }
  }

  resize() {
    const w = window.innerWidth, hh = window.innerHeight;
    this.renderer.setPixelRatio(this.perf.ratio);
    this.renderer.setSize(w, hh, false);
    this.camera.aspect = w / hh;
    this.camera.fov = this.camera.aspect < 1 ? 74 : 58;
    this.camera.updateProjectionMatrix();
  }

  applyQuality() {
    const q = this.state.settings.quality;
    const dpr = window.devicePixelRatio || 1;
    this.perf.cap = q === 'low' ? 1 : q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.75);
    this.perf.ratio = q === 'low' ? 1 : q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.5);
    this.resize();
  }

  tickPerf(dt) {
    if (this.state.settings.quality !== 'auto') return;
    const p = this.perf;
    p.acc += dt; p.n++; p.t += dt;
    if (p.t > 2.5) {
      const avg = p.acc / p.n;
      if (avg > 1 / 38 && p.ratio > 0.75) { p.ratio = Math.max(0.75, p.ratio - 0.25); this.resize(); }
      else if (avg < 1 / 57 && p.ratio < p.cap) { p.ratio = Math.min(p.cap, p.ratio + 0.25); this.resize(); }
      p.acc = 0; p.n = 0; p.t = 0;
    }
  }

  // ------------------------------------------------------------------------------ main loop
  frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    try { this.update(dt); } catch (err) { console.error(err); }
    this.renderer.render(this.scene, this.camera);
    this.tickPerf(dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    const st = this.state;
    const title = this.mode === 'title';
    const running = !this.paused;
    U.uTime.value += dt;

    // ---- time
    let hoursPassed = 0;
    if (running && this.mode !== 'dying') {
      hoursPassed = dt * HOURS_PER_SEC;
      st.hour += hoursPassed;
      if (st.hour >= 24) { st.hour -= 24; st.day++; }
    }
    const hour = title ? TITLE_HOUR : st.hour;

    // ---- boat control
    if (!title) this.updateBoat(dt, running);
    else { this.boat.update(dt, { throttle: 0, steer: 0, anchored: true }, this.stats, {}); }

    // ---- camera
    this.updateCamera(dt, title);

    // ---- world
    this.env.update(dt, hour, this.camera, { zone: this.curZone || 1, hoursPassed: running ? hoursPassed : 0 });
    this.sky.follow(this.camera.position);
    this.sky.cloud.value = this.env.cloudAmount;
    this.water.follow(this.camera.position.x, this.camera.position.z);
    this.islandMgr.update(this.boat.x, this.boat.z);
    this.islandMgr.animate(dt, this.env);
    this.spotsView.update(dt, this.boat.x, this.boat.z, { state: st, abs: absHours(st), night: this.env.night });
    this.potsView.update(U.uTime.value);
    this.gulls.update(dt, this.boat.x, this.boat.z, this.env.night);

    if (title) { this.updateAudio(); return; }

    // ---- gameplay systems
    if (running) {
      this.updatePanic(dt);
      this.updateFishing(dt);
      this.updateDredging(dt);
      this.timers.save -= dt;
      if (this.timers.save <= 0) { this.timers.save = 45; if (this.mode === 'sail') this.saveGame(); }
    }
    this.ghosts.update(dt, this.boat, () => this.onGhostHit());
    this.bobber.update(dt, this.boat.rodTip.getWorldPosition(this._tip || (this._tip = new THREE.Vector3())));

    // ---- periodic
    this.timers.reveal -= dt;
    if (this.timers.reveal <= 0) {
      this.timers.reveal = 0.6;
      this.map.revealAt(this.boat.x, this.boat.z);
      const z = zoneAt(this.boat.x, this.boat.z);
      if (z !== this.curZone) { this.curZone = z; this.hud.banner(zoneName(z), z === 4 ? 'The water is very dark here' : ''); }
      this.checkHints();
    }
    this.timers.actions -= dt;
    if (this.timers.actions <= 0) { this.timers.actions = 0.12; this.computeActions(); }
    this.timers.minimap -= dt;
    if (this.timers.minimap <= 0) { this.timers.minimap = 0.14; this.hud.drawMinimap(this); this.hud.update(this); this.updateWaypointHud(); }
    this.updateLabels();
    this.updateAudio();
  }

  /** Advance the simulation without rendering (used by automated tests). */
  simulate(seconds, step = 0.05) {
    const n = Math.max(1, Math.ceil(seconds / step));
    for (let i = 0; i < n; i++) this.update(step);
  }

  updateAudio() {
    const sp = Math.abs(this.boat.speed) / (this.stats.maxSpeed || 13);
    audio.update({ speed: this.mode === 'title' ? 0 : clamp(sp, 0, 1), night: this.env.night, dread: smoothstep(0.55, 1, this.state.panic), storm: this.env.w.rain });
  }

  // ------------------------------------------------------------------------------ boat & camera
  updateBoat(dt, running) {
    const b = this.boat;
    const j = this.hud.joystick;
    const k = this.keys;
    let steer = j.x, throttle = j.y;
    if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) steer += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) throttle += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) throttle -= 1;
    steer = clamp(steer, -1, 1); throttle = clamp(throttle, -1, 1);
    const stickUsed = Math.abs(steer) > 0.2 || Math.abs(throttle) > 0.2;
    if (stickUsed && this.autopilot) { this.autopilot = false; this.hud.toast('Autopilot off'); }
    if (this.cruise) {
      if (throttle < -0.3) { this.cruise = false; }
      else throttle = Math.max(throttle, 1);
    }
    if (this.autopilot && this.waypoint) {
      const nav = this.navigate();
      steer = nav.steer; throttle = nav.throttle;
      if (nav.arrived) { this.autopilot = false; this.hud.toast('You have arrived', 'good'); audio.bell(); this.clearWaypoint(); }
    }
    const anchored = !running || this.mode !== 'sail';
    b.update(dt, { throttle: anchored ? 0 : throttle, steer: anchored ? 0 : steer, anchored }, this.stats, {
      onHit: (imp) => this.onBoatHit(imp),
      onScrape: () => { audio.scrape(); },
      onEdge: () => { if (this.msgCooldown <= 0) { this.hud.toast('A wall of storm turns you back.', 'bad'); this.msgCooldown = 6; } },
    });
    this.msgCooldown -= dt;
    // storm slows you slightly
    if (this.env.w.rain > 0.3) b.speed *= 1 - dt * 0.05;
  }

  navigate() {
    const b = this.boat, w = this.waypoint;
    const dx = w.x - b.x, dz = w.z - b.z;
    const dist = Math.hypot(dx, dz);
    if (dist < (w.radius || 55)) return { steer: 0, throttle: 0, arrived: true };
    const want = Math.atan2(dx, dz);
    const look = 28 + Math.abs(b.speed) * 2.6;
    const offs = [0, 0.2, -0.2, 0.42, -0.42, 0.7, -0.7, 1.0, -1.0, 1.4, -1.4];
    let pick = 0, found = false;
    for (const o of offs) {
      const a = want + o;
      let clear = true;
      for (const f of [0.35, 0.7, 1.0]) {
        const x = b.x + Math.sin(a) * look * f, z = b.z + Math.cos(a) * look * f;
        if (heightAt(x, z) > -2.2 || heightAt(x + Math.cos(a) * 5, z - Math.sin(a) * 5) > -2.2 || heightAt(x - Math.cos(a) * 5, z + Math.sin(a) * 5) > -2.2) { clear = false; break; }
      }
      if (clear) { pick = o; found = true; break; }
    }
    const target = want + (found ? pick : 1.6);
    const d = angleDiff(b.heading, target);
    return { steer: clamp(-d * 2.2, -1, 1), throttle: Math.abs(d) > 1.0 ? 0.25 : found && Math.abs(pick) > 0.6 ? 0.45 : dist < 160 ? 0.5 : 1, arrived: false };
  }

  updateCamera(dt, title) {
    const cam = this.cam, b = this.boat, c = this.camera;
    cam.idle += dt;
    if (title) {
      cam.titleA += dt * 0.07;
      const a = b.heading + Math.PI * 0.8 + Math.sin(cam.titleA) * 0.7;
      c.position.set(b.x - Math.sin(a) * 26, 9 + Math.sin(cam.titleA * 1.7) * 1.5, b.z - Math.cos(a) * 26);
      c.lookAt(b.x, 3.5, b.z);
      return;
    }
    const diff = angleDiff(cam.heading, b.heading);
    cam.heading += diff * (1 - Math.exp(-dt * (Math.abs(b.speed) > 1 ? 1.8 : 0.6)));
    if (cam.idle > 2.5) { cam.userYaw *= Math.exp(-dt * 0.9); cam.userPitch *= Math.exp(-dt * 0.9); }
    let dist = cam.dist, pitch = 0.4 + cam.userPitch;
    if (this.mode === 'fishing' || this.mode === 'dredge') { dist = Math.min(dist, 19); pitch += 0.08; }
    const a = cam.heading + cam.userYaw;
    const tx = b.group.position.x, ty = b.group.position.y + 2.4, tz = b.group.position.z;
    let cx = tx - Math.sin(a) * dist * Math.cos(pitch), cz = tz - Math.cos(a) * dist * Math.cos(pitch);
    let cy = ty + dist * Math.sin(pitch);
    cam.shake = Math.max(0, cam.shake - dt * 2.2);
    if (cam.shake > 0) { cx += (Math.random() - 0.5) * cam.shake; cy += (Math.random() - 0.5) * cam.shake; cz += (Math.random() - 0.5) * cam.shake; }
    cy = Math.max(cy, waveHeight(cx, cz, U.uTime.value) + 1.6);
    c.position.set(cx, cy, cz);
    c.lookAt(tx, ty + 0.6, tz);
  }

  // ------------------------------------------------------------------------------ damage, panic, wreck
  onBoatHit(impact) {
    audio.bump();
    this.cam.shake = 1.4;
    this.vibrate(120);
    this.cancelAuto();
    this.damageHull(1, 'You ran aground!');
  }

  onGhostHit() {
    audio.bump(); this.cam.shake = 1.6; this.vibrate(160);
    this.state.panic = Math.max(0, this.state.panic - 0.4);
    this.damageHull(1, 'Something dark struck the hull!');
  }

  cancelAuto() { this.autopilot = false; }

  damageHull(n, msg) {
    const st = this.state;
    st.hull = Math.max(0, st.hull - n);
    this.hud.damageFlash();
    this.hud.toast(msg, 'bad');
    if (st.hull > 0 && Math.random() < 0.5) {
      const cell = st.inv.randomHealthyCell();
      if (cell) {
        const dead = st.inv.breakCell(cell[0], cell[1]);
        const lost = [];
        for (const it of dead) {
          if (ITEMS[it.id].quest) {
            // quest items are never lost for good: re-stow, or let the lens drift back to the seabed
            if (!st.inv.add(it.id, { w: it.w })) { const m = /^lens_(\d)$/.exec(it.id); if (m) st.main.have[+m[1] - 1] = false; this.hud.toast('A precious relic slipped overboard - it glints on the seabed again.', 'bad'); }
          } else lost.push(it);
        }
        this.hud.toast(lost.length ? `A cargo cell cracked - lost ${ITEMS[lost[0].id].name}!` : 'A cargo cell cracked!', 'bad');
      }
    }
    if (st.hull <= 0) this.wreck();
  }

  wreck() {
    if (this.mode === 'dying') return;
    const st = this.state;
    this.cancelActivities();
    this.mode = 'dying';
    this.hud.setActions([]);
    this.hud.fade(true);
    audio.horn();
    setTimeout(() => {
      // lose half the (non-quest) cargo and some coin
      const loseable = st.inv.items.filter((i) => !ITEMS[i.id].quest);
      const n = Math.floor(loseable.length / 2);
      for (let i = 0; i < n; i++) { const it = loseable.splice(Math.floor(Math.random() * loseable.length), 1)[0]; st.inv.remove(it.uid); }
      const fine = Math.min(st.money, Math.round(st.money * 0.2));
      st.money -= fine;
      st.stats.sunk++;
      st.hull = Math.max(2, Math.ceil(this.stats.hullMax * 0.5));
      st.panic = 0;
      // nearest visited port
      let best = null, bd = Infinity;
      for (const t of towns) { if (!st.visited.includes(t.id) || t.noShops) continue; const d = Math.hypot(t.x - this.boat.x, t.z - this.boat.z); if (d < bd) { bd = d; best = t; } }
      best = best || getTown('saltmere');
      this.boat.teleport(best.dock.boat.x, best.dock.boat.z, best.dock.boat.heading);
      this.cam.heading = best.dock.boat.heading;
      this.islandMgr.preload(this.boat.x, this.boat.z);
      this.ghosts.clear();
      this.map.revealAt(this.boat.x, this.boat.z);
      this.mode = 'sail';
      this.hud.fade(false);
      this.notice('Wrecked!', `Fishermen tow you into ${best.name}. You lost half your cargo and ${fmtMoney(fine)} coin in salvage fees. The shipyard patched the hull enough to float.`, 'Carry on', () => this.dock(best));
    }, 900);
  }

  updatePanic(dt) {
    const st = this.state;
    if (this.mode === 'dying') return;
    const dark = Math.max(smoothstep(0.45, 0.95, this.env.night), this.env.w.dark * 1.2);
    // safe near a town
    let nearTown = false;
    for (const t of towns) if (Math.hypot(t.x - this.boat.x, t.z - this.boat.z) < t.island.R * 1.5 + 140) { nearTown = true; break; }
    const calm = this.boat.lightOn ? this.stats.lightCalm : 0;
    if (dark > 0.05 && !nearTown) {
      st.panic = clamp(st.panic + dt * 0.012 * dark * (1 - calm) * (this.curZone >= 3 ? 1.3 : 1), 0, 1);
    } else {
      st.panic = Math.max(0, st.panic - dt * (nearTown ? 0.05 : 0.02));
    }
    if (st.panic > 0.55) {
      this.timers.panicWhisper -= dt;
      if (this.timers.panicWhisper <= 0) { this.timers.panicWhisper = 8 + Math.random() * 8; audio.whisper(); }
    }
    if (st.panic >= 0.95 && this.mode !== 'dock') {
      this.timers.ghost -= dt;
      if (this.timers.ghost <= 0) { this.timers.ghost = 9 + Math.random() * 6; this.ghosts.spawn(this.boat); audio.whisper(); this.hud.toast('Something stirs in the water...', 'bad'); }
    }
  }

  // ------------------------------------------------------------------------------ actions / context
  nearTownDock() {
    for (const t of towns) {
      const d = Math.hypot(t.dock.boat.x - this.boat.x, t.dock.boat.z - this.boat.z);
      if (d < 55) return t;
    }
    return null;
  }

  computeActions() {
    if (this.mode === 'title' || this.mode === 'dying') { this.contextActions = []; this.hud.setActions([]); return; }
    const acts = [];
    const st = this.state, b = this.boat;
    if (this.mode === 'sail' && !this.modals.length) {
      const dockT = this.nearTownDock();
      if (dockT) acts.push({ id: 'dock' + dockT.id, label: 'Dock', icon: 'anchor', onClick: () => this.dock(dockT) });
      const sv = this.spotsView;
      let fishSpot = null, dredgeSpot = null, crabSpot = null;
      for (const c of sv.near) {
        const d = Math.hypot(c.s.x - b.x, c.s.z - b.z);
        if (c.s.type === 'fish' && d < c.s.r + 10 && !fishSpot) fishSpot = c.s;
        else if ((c.s.type === 'dredge' || c.s.type === 'lens') && d < c.s.r + 6 && !dredgeSpot) dredgeSpot = c.s;
        else if (c.s.type === 'crab' && !c.taken && d < c.s.r + 6 && !crabSpot) crabSpot = c.s;
      }
      if (fishSpot) acts.push({ id: 'fish' + fishSpot.id, label: 'Fish', icon: 'rod', onClick: () => this.startFishing(fishSpot) });
      if (dredgeSpot) {
        const sp = dredgeSpot;
        acts.push({ id: 'dredge' + sp.id, label: 'Dredge', icon: 'pick', disabled: !this.stats.netTime, onClick: () => this.startDredging(sp), onDisabled: () => this.hud.toast('You need a dredge net - the shipyard sells one.', 'bad') });
      }
      if (crabSpot && this.stats.potsMax > 0) {
        const sp = crabSpot;
        const full = st.pots.length >= this.stats.potsMax;
        acts.push({ id: 'pot' + sp.id, label: 'Set pot', icon: 'pot', cls: 'pot', disabled: full, onClick: () => this.deployPot(sp), onDisabled: () => this.hud.toast('All your pots are already out. Collect one first.', 'bad') });
      } else if (crabSpot && !this.stats.potsMax) {
        acts.push({ id: 'potlock', label: 'Pots', icon: 'pot', cls: 'pot', disabled: true, onClick: () => {}, onDisabled: () => this.hud.toast('Buy a crab pot rack at the shipyard to use crab spots.', 'bad') });
      }
      for (const p of st.pots) {
        if (Math.hypot(p.x - b.x, p.z - b.z) < 22) {
          const ready = absHours(st) - p.at >= POT_HOURS;
          acts.push({ id: 'collect' + p.id + (ready ? 'r' : 'w'), label: ready ? 'Haul pot' : 'Pot...', icon: 'collect', cls: 'pot', disabled: !ready, onClick: () => this.collectPot(p), onDisabled: () => { const left = POT_HOURS - (absHours(st) - p.at); this.hud.toast(`The pot needs another ${left.toFixed(1)} hours`, ''); } });
          break;
        }
      }
    } else if (this.mode === 'fishing' && this.fishing && this.fishing.phase === 'wait') {
      acts.push({ id: 'reelin', label: 'Reel in', icon: 'rod', cls: 'sec', onClick: () => this.cancelFishing() });
    } else if (this.mode === 'dredge') {
      acts.push({ id: 'stopd', label: 'Stop', icon: 'close', cls: 'sec', onClick: () => this.cancelDredging() });
    }
    this.contextActions = acts;
    this.hud.setActions(acts);
  }

  // ------------------------------------------------------------------------------ fishing
  startFishing(spot) {
    if (this.mode !== 'sail') return;
    this.mode = 'fishing';
    this.cancelAuto(); this.cruise = false;
    this.fishing = { phase: 'wait', t: 0, wait: 1.2 + Math.random() * 2.2, spot, ui: null };
    const a = Math.random() * Math.PI * 2;
    this.bobber.cast(spot.x + Math.cos(a) * 2.5, spot.z + Math.sin(a) * 2.5);
    audio.cast();
    this.hud.hint(null);
  }

  cancelFishing() {
    if (this.fishing) { if (this.fishing.ui) this.fishing.ui.destroy(); this.bobber.retract(); }
    this.fishing = null;
    if (this.mode === 'fishing') this.mode = 'sail';
  }

  updateFishing(dt) {
    const f = this.fishing;
    if (!f) return;
    f.t += dt;
    if (f.phase === 'wait' && f.t >= f.wait) {
      const isNight = this.env.night > 0.6;
      const fish = rollFish(f.spot, isNight);
      if (!fish) { this.cancelFishing(); return; }
      f.phase = 'fight'; f.fish = fish;
      this.bobber.setBite(true);
      this.hud.setActions([]);
      f.ui = new FishingUI(this, fish, this.stats, (res) => this.onFishResult(res));
    }
    if (f.ui) f.ui.update(dt);
  }

  onFishResult(res) {
    const f = this.fishing;
    if (!f) return;
    this.bobber.setBite(false);
    this.bobber.retract();
    if (res !== 'caught') {
      this.fishing = null;
      this.mode = 'sail';
      if (res === 'lost') this.hud.toast('The fish got away...', 'bad');
      return;
    }
    const st = this.state;
    const fish = f.fish, spot = f.spot;
    useSpot(spot, st, absHours(st));
    const isNew = !st.log[fish.id];
    const w = +(0.72 + Math.random() * 0.7).toFixed(2);
    st.stats.caught++;
    st.log[fish.id] = (st.log[fish.id] || 0) + 1;
    if (fish.cat === 'aberrant') { st.panic = Math.min(1, st.panic + 0.1); this.hud.toast('It stared at you the whole way up.', 'bad'); }
    this.fishing = null;
    this.mode = 'sail';
    openPlacementScreen(this, [{ id: fish.id, w, isNew }], { title: fish.cat === 'aberrant' ? 'An aberration!' : 'You caught...' }).then(() => { this.afterHaul(); });
  }

  afterHaul() { this.refreshMainStage(); this.saveGame(); }

  // ------------------------------------------------------------------------------ dredging
  startDredging(spot) {
    if (this.mode !== 'sail' || !this.stats.netTime) return;
    this.mode = 'dredge';
    this.cancelAuto(); this.cruise = false;
    this.dredging = { spot, t: 0, need: this.stats.netTime * (spot.type === 'lens' ? 1.6 : 1) };
    const ring = h('div', { class: 'ring' }, h('div', { class: 'rbar' }), h('div', { class: 'lbl' }, 'Dredging...'));
    ring.innerHTML = `<svg width="116" height="116" viewBox="0 0 116 116"><circle cx="58" cy="58" r="48" fill="rgba(5,14,24,.6)" stroke="#1d3b52" stroke-width="10"/><circle class="arc" cx="58" cy="58" r="48" fill="none" stroke="#d9b073" stroke-width="10" stroke-linecap="round" stroke-dasharray="302" stroke-dashoffset="302" transform="rotate(-90 58 58)"/></svg><div class="lbl">${spot.type === 'lens' ? 'Something gleams below...' : 'Dredging...'}</div>`;
    this.dredging.el = ring;
    this.uiRoot.append(ring);
    audio.dredge();
  }

  cancelDredging() {
    if (this.dredging && this.dredging.el) this.dredging.el.remove();
    this.dredging = null;
    if (this.mode === 'dredge') this.mode = 'sail';
  }

  updateDredging(dt) {
    const d = this.dredging;
    if (!d) return;
    d.t += dt;
    d.el.querySelector('.arc').setAttribute('stroke-dashoffset', String(302 * (1 - Math.min(1, d.t / d.need))));
    if (Math.floor(d.t * 3) !== d.tick) { d.tick = Math.floor(d.t * 3); if (d.tick % 3 === 0) audio.dredge(); }
    if (d.t >= d.need) {
      const spot = d.spot, st = this.state;
      d.el.remove();
      this.dredging = null;
      this.mode = 'sail';
      let entries;
      if (spot.type === 'lens') {
        entries = [{ id: 'lens_' + spot.lens, w: 1, isNew: true }];
        st.main.have[spot.lens - 1] = true;
        this.hud.banner('A Lens Fragment!', MAIN.title);
        audio.fanfare();
      } else {
        useSpot(spot, st, absHours(st));
        entries = rollDredge(spot, st.up.net).map((id) => ({ id, w: +(0.8 + Math.random() * 0.4).toFixed(2), isNew: !st.log[id] }));
        entries.forEach((e) => { st.log[e.id] = (st.log[e.id] || 0) + 0; });
      }
      openPlacementScreen(this, entries, { title: spot.type === 'lens' ? 'Recovered!' : 'Dredged up...' }).then(() => this.afterHaul());
    }
  }

  refreshMainStage() {
    const m = this.state.main;
    if (m.stage >= 1 && !m.delivered) m.stage = m.have.every(Boolean) ? 5 : 1;
    if (m.stage === 5 && !this._told5) { this._told5 = true; this.notice('All four fragments!', 'The lens pieces hum together in your hold. Carry them to the Hollow Light, far to the south-east, and set them in the lantern.', 'On it'); }
  }

  // ------------------------------------------------------------------------------ crab pots
  deployPot(spot) {
    const st = this.state;
    if (st.pots.length >= this.stats.potsMax) return;
    const id = (st.pots.reduce((m, p) => Math.max(m, p.id), 0)) + 1;
    st.pots.push({ id, spotId: spot.id, x: spot.x, z: spot.z, zone: spot.zone, at: absHours(st) });
    this.potsView.sync(st.pots);
    audio.splash();
    this.hud.toast(`Pot set. Come back in ~${POT_HOURS} hours.`, 'good');
    this.saveGame();
  }

  collectPot(p) {
    const st = this.state;
    if (absHours(st) - p.at < POT_HOURS) return;
    const crabs = rollCrabs(p).map((id) => ({ id, w: +(0.8 + Math.random() * 0.5).toFixed(2), isNew: !st.log[id] }));
    st.pots = st.pots.filter((q) => q.id !== p.id);
    this.potsView.sync(st.pots);
    crabs.forEach((c) => { st.log[c.id] = (st.log[c.id] || 0) + 1; });
    audio.splash();
    openPlacementScreen(this, crabs, { title: 'Pot hauled!' }).then(() => this.afterHaul());
  }

  cancelActivities() {
    this.cancelFishing();
    this.cancelDredging();
    this.autopilot = false;
  }

  // ------------------------------------------------------------------------------ towns
  dock(town) {
    if (this.mode !== 'sail') return;
    this.cancelAuto(); this.cruise = false;
    this.mode = 'dock';
    this.hud.setActions([]);
    this.hud.fade(true);
    audio.bell();
    setTimeout(() => {
      const b = town.dock.boat;
      this.boat.teleport(b.x, b.z, b.heading);
      this.cam.heading = b.heading; this.cam.userYaw = 0.6;
      const st = this.state;
      st.lastPort = town.id;
      st.panic = 0;
      this.ghosts.clear();
      const first = !st.visited.includes(town.id);
      if (first) { st.visited.push(town.id); this.hud.banner(town.name, zoneName(town.zone)); }
      this.map.revealAt(b.x, b.z, true);
      this.hud.fade(false);
      this.saveGame();
      openTown(this, town);
      if (first) this.hud.toast(`Discovered ${town.name}`, 'good');
    }, 650);
  }

  onLeaveTown(town) {
    this.mode = 'sail';
    this.cam.userYaw = 0;
    this.cam.idle = 99;
    this.saveGame();
    if (!this.state.flags.h_leave && this.state.settings.hints) {
      this.state.flags.h_leave = true;
      this.showHint('h_leave', 'Open the map (top-right) to set a waypoint, then use Autopilot for long trips.', 8);
    }
  }

  priceFor(item, townId) {
    const def = ITEMS[item.id];
    const t = getTown(townId);
    const mult = t && t.boost.includes(item.id) ? 1.4 : 1;
    return Math.max(def.value ? 1 : 0, Math.round(def.value * item.w * mult));
  }
  sellItem(uid, townId) {
    const inv = this.state.inv, it = inv.get(uid);
    if (!it || ITEMS[it.id].quest) return 0;
    const price = this.priceFor(it, townId);
    inv.remove(uid);
    this.state.money += price; this.state.stats.earned += price;
    audio.coin();
    this.hud.toast(`+${fmtMoney(price)} coin  ·  ${ITEMS[it.id].name}`, 'good');
    return price;
  }
  sellAll(townId) {
    const inv = this.state.inv;
    let total = 0, n = 0;
    for (const it of [...inv.items]) {
      if (!['fish', 'crab', 'aberrant', 'trash'].includes(ITEMS[it.id].cat)) continue;
      total += this.priceFor(it, townId); n++; inv.remove(it.uid);
    }
    if (n) { this.state.money += total; this.state.stats.earned += total; audio.coin(); setTimeout(() => audio.coin(), 120); this.hud.toast(`Sold ${n} for ${fmtMoney(total)} coin`, 'good'); }
  }

  repairCosts() {
    const st = this.state;
    const unit = 8 + 6 * st.up.hull;
    return { hull: (this.stats.hullMax - st.hull) * unit, hullUnit: unit, cargo: st.inv.broken.size * 18 };
  }
  repairHull() {
    const st = this.state, c = this.repairCosts();
    const missing = this.stats.hullMax - st.hull;
    const pips = Math.min(missing, Math.floor(st.money / c.hullUnit));
    if (pips <= 0) { audio.nope(); this.hud.toast('Not enough coin', 'bad'); return; }
    st.hull += pips; st.money -= pips * c.hullUnit; audio.place(); audio.coin();
    this.hud.toast(pips === missing ? 'Hull fully repaired' : `Repaired ${pips} hull points`, 'good');
  }
  repairCargo() {
    const st = this.state, c = this.repairCosts();
    if (!st.inv.broken.size) return;
    if (st.money < c.cargo) { audio.nope(); this.hud.toast('Not enough coin', 'bad'); return; }
    st.money -= c.cargo; st.inv.repairAll(); audio.place(); audio.coin();
    this.hud.toast('Cargo hold repaired', 'good');
  }

  buyUpgrade(key) {
    const st = this.state, U2 = UPGRADES[key];
    const next = U2.levels[curIndex(key, st.up[key]) + 1];
    if (!next) return false;
    if (st.money < next.cost) { audio.nope(); this.hud.toast('Not enough coin', 'bad'); return false; }
    for (const [id, n] of Object.entries(next.mats || {})) if (st.inv.count(id) < n) { audio.nope(); this.hud.toast(`You need ${n}× ${ITEMS[id].name} in your hold`, 'bad'); return false; }
    for (const [id, n] of Object.entries(next.mats || {})) st.inv.consume(id, n);
    st.money -= next.cost;
    st.up[key]++;
    this.applyState();
    if (key === 'hull') st.hull = this.stats.hullMax;
    audio.fanfare();
    this.hud.toast(`${U2.name} upgraded!`, 'good');
    return true;
  }

  questState(id) {
    const q = this.state.quests;
    return q.done.includes(id) ? 'done' : q.active.includes(id) ? 'active' : 'available';
  }
  questProgress(q) {
    return Object.entries(q.req).map(([key, need]) => ({
      id: key, need, have: this.state.inv.countMatch(key),
      name: key.startsWith('cat:') ? 'Aberrant catch' : ITEMS[key].name,
    }));
  }
  acceptQuest(id) {
    const q = this.state.quests;
    if (!q.active.includes(id)) q.active.push(id);
    audio.tap();
    this.hud.toast('Job accepted - see the Journal', 'good');
  }
  deliverQuest(id) {
    const q = QUESTS.find((x) => x.id === id), st = this.state;
    if (!q || !this.questProgress(q).every((p) => p.have >= p.need)) return;
    for (const [key, n] of Object.entries(q.req)) st.inv.consume(key, n);
    st.money += q.reward.money; st.stats.earned += q.reward.money;
    if (q.reward.upgrade) {
      const [k, lvl] = q.reward.upgrade;
      if (st.up[k] < lvl) st.up[k] = lvl;
      this.applyState();
    }
    st.quests.active = st.quests.active.filter((x) => x !== id);
    st.quests.done.push(id);
    audio.coin(); audio.fanfare();
    this.hud.toast(`Job complete! +${fmtMoney(q.reward.money)} coin`, 'good');
  }

  acceptMain() {
    const st = this.state;
    if (st.main.stage === 0) { st.main.stage = 1; audio.fanfare(); this.hud.toast('The Hollow Light: seek the lens fragments (gold markers on the map)', 'good'); }
  }

  finishMain() {
    const st = this.state;
    for (let i = 1; i <= 4; i++) st.inv.consume('lens_' + i, 1);
    st.main.delivered = true; st.main.stage = 6;
    st.money += 3000; st.stats.earned += 3000;
    audio.fanfare(); setTimeout(() => audio.bell(), 900);
    this.hud.fade(true);
    setTimeout(() => {
      this.hud.fade(false);
      this.notice('The Hollow Light', MAIN.ending + ' (The harbourmaster has sent 3,000 coin to your account.)', 'Keep sailing');
      this.saveGame();
    }, 1200);
  }

  ferryTo(id, cost) {
    const st = this.state, t = getTown(id);
    if (!t || st.money < cost) return;
    st.money -= cost;
    this.hud.fade(true);
    const from = getTown(st.lastPort);
    const dist = from ? Math.hypot(from.x - t.x, from.z - t.z) : 1000;
    setTimeout(() => {
      st.hour += dist / 1500;
      while (st.hour >= 24) { st.hour -= 24; st.day++; }
      const b = t.dock.boat;
      this.boat.teleport(b.x, b.z, b.heading);
      this.islandMgr.preload(b.x, b.z);
      this.mode = 'sail';
      this.hud.fade(false);
      this.dock(t);
    }, 700);
  }

  rest() {
    const st = this.state;
    this.hud.fade(true);
    audio.bell();
    setTimeout(() => {
      if (st.hour >= 6) st.day++;
      st.hour = 6.1; st.panic = 0; st.stats.nights++;
      this.hud.fade(false);
      this.saveGame();
      this.hud.toast(`Day ${st.day} dawns. Your crab pots have had time to fill.`, 'good');
      this.mode = 'sail';
    }, 900);
  }

  rumours(town) {
    const st = this.state;
    const list = [];
    if (town.boost.length) list.push(`They say ${town.name} pays well for ${town.boost.map((id) => ITEMS[id].name.toLowerCase()).slice(0, 2).join(' and ')}.`);
    if (st.main.stage >= 1 && st.main.stage < 5) {
      let best = null, bd = Infinity;
      for (const l of lensSpots) { if (st.main.have[l.lens - 1]) continue; const d = Math.hypot(l.x - town.x, l.z - town.z); if (d < bd) { bd = d; best = l; } }
      if (best) {
        const dx = best.x - town.x, dz = best.z - town.z;
        const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
        const ang = Math.atan2(dz, dx); // north = -z
        const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
        list.push(`A sailor swore he saw a golden glimmer on the sea floor about ${(bd / 1000).toFixed(1)} km ${dirs[idx]} of here.`);
      }
    }
    const gen = [
      'Aberrant fish only rise after dark, from the purple glowing water. Take a lamp.',
      'Dread builds in the dark. A good lamp holds it back - a bed ashore ends it.',
      'The deeper you go, the bigger the fish and the thicker the rocks. Upgrade your hull first.',
      'Crab pots fill while you sleep. Set them in the shallow, brown-ringed water near the coast.',
      'Dredge spots look like dark patches. Scrap and driftwood fix everything.',
      'Fish at dawn and dusk; the gulls will show you where the shoals run.',
      'Tight on cargo space? Fish are puzzle pieces. Turn them. Always turn them.',
      'The map shows only where you have sailed. Zoom out and plan your voyage.',
      'The ferry runs between any harbours you have visited. A little coin saves a lot of sailing.',
    ];
    while (list.length < 3) { const g = gen[Math.floor(Math.random() * gen.length)]; if (!list.includes(g)) list.push(g); }
    return list;
  }

  // ------------------------------------------------------------------------------ waypoint
  setWaypoint(x, z, name, town) {
    const t = town || towns.find((tt) => tt.name === name);
    if (t) this.waypoint = { x: t.dock.boat.x, z: t.dock.boat.z, name: t.name, radius: 40 };
    else this.waypoint = { x, z, name: name || 'Waypoint', radius: 60 };
    this.hud.toast('Waypoint set', 'good');
  }
  clearWaypoint() { this.waypoint = null; this.autopilot = false; this.hud.setWaypoint(null); }
  startAutopilot() {
    if (!this.waypoint) return;
    this.autopilot = true; this.cruise = false;
    this.hud.toast('Autopilot engaged - touch the stick to take over', 'good');
  }
  updateWaypointHud() {
    const w = this.waypoint;
    if (!w) { this.hud.setWaypoint(null); return; }
    const dx = w.x - this.boat.x, dz = w.z - this.boat.z;
    const d = Math.hypot(dx, dz);
    const rel = angleDiff(this.boat.heading, Math.atan2(dx, dz));
    this.hud.setWaypoint({ name: w.name, dist: d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m', rot: -rel });
  }

  // ------------------------------------------------------------------------------ labels & hints
  updateLabels() {
    this.timers.labels -= 0.016;
    const items = [];
    const cam = this.camera;
    const v = this._lv || (this._lv = new THREE.Vector3());
    const W = window.innerWidth, H = window.innerHeight;
    const project = (x, y, z) => {
      v.set(x, y, z).project(cam);
      if (v.z > 1 || v.z < -1) return null;
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
    };
    const b = this.boat;
    if (this.mode === 'sail' && !this.modals.length) {
      for (const t of towns) {
        const d = Math.hypot(t.x - b.x, t.z - b.z);
        if (d > 1100) continue;
        const p = project(t.x, 38, t.z);
        if (!p || p[0] < 20 || p[0] > W - 20 || p[1] < 20 || p[1] > H - 20) continue;
        const known = this.state.visited.includes(t.id);
        items.push({ key: 't' + t.id, x: p[0], y: p[1], text: known ? t.name : 'Settlement', sub: d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m', cls: 'town', opacity: smoothstep(1100, 700, d) });
      }
      for (const p0 of this.state.pots) {
        const d = Math.hypot(p0.x - b.x, p0.z - b.z);
        if (d > 260) continue;
        const p = project(p0.x, 4, p0.z);
        if (!p) continue;
        const left = POT_HOURS - (absHours(this.state) - p0.at);
        items.push({ key: 'pot' + p0.id, x: p[0], y: p[1], text: left <= 0 ? 'Pot ready' : 'Pot', sub: left <= 0 ? '' : left.toFixed(1) + 'h', cls: 'pot' });
      }
      if (this.state.main.stage >= 1 && this.state.main.stage < 5) {
        for (const l of lensSpots) {
          if (this.state.main.have[l.lens - 1]) continue;
          const d = Math.hypot(l.x - b.x, l.z - b.z);
          if (d > 420) continue;
          const p = project(l.x, 14, l.z);
          if (!p) continue;
          items.push({ key: 'lens' + l.lens, x: p[0], y: p[1], text: 'Lens fragment', sub: Math.round(d) + ' m', cls: 'lens' });
        }
      }
      if (this.waypoint) {
        const w = this.waypoint;
        const d = Math.hypot(w.x - b.x, w.z - b.z);
        const p = project(w.x, 10, w.z);
        if (p && d > 40) items.push({ key: 'wp', x: p[0], y: p[1], text: '▼ ' + w.name, sub: d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m', cls: 'town' });
      }
    }
    this.hud.setLabels(items);
  }

  showHint(flag, text, secs = 7) {
    const st = this.state;
    if (st.flags[flag] === 'done' || !st.settings.hints) return;
    st.flags[flag] = 'done';
    this.hud.hint(text);
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => this.hud.hint(null), secs * 1000);
  }

  checkHints() {
    if (this.mode !== 'sail' || this.modals.length) return;
    const st = this.state;
    const b = this.boat;
    if (!st.flags.moved && Math.hypot(b.x - getTown('saltmere').dock.boat.x, b.z - getTown('saltmere').dock.boat.z) > 45) st.flags.moved = true;
    if (st.flags.moved && !st.flags.h_fish) {
      for (const c of this.spotsView.near) {
        if (c.s.type === 'fish' && Math.hypot(c.s.x - b.x, c.s.z - b.z) < 70) { st.flags.h_fish = true; this.showHint('h_fish', 'Slow down inside the glowing ring, then tap FISH. Tap REEL when the needle is in the gold zone.', 9); break; }
      }
    }
    if (!st.flags.h_dock) {
      const t = towns.find((tt) => Math.hypot(tt.dock.boat.x - b.x, tt.dock.boat.z - b.z) < 120);
      if (t && st.stats.caught > 0) this.showHint('h_dock', 'Tap DOCK to enter the harbour - sell your catch, repair and upgrade.', 8);
    }
    if (!st.flags.h_dread && this.env.night > 0.8) this.showHint('h_dread', 'Night falls. Dread builds in the dark - switch on your lamp (bulb button) or head to port.', 9);
    if (!st.flags.h_dredge) {
      for (const c of this.spotsView.near) if (c.s.type === 'dredge' && Math.hypot(c.s.x - b.x, c.s.z - b.z) < 60) { this.showHint('h_dredge', 'Dark patches are dredging spots. A dredge net from the shipyard lets you scoop scrap and ore.', 9); break; }
    }
  }
}
