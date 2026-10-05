import * as THREE from 'three';
import { spotsNear, spotAvailable } from './spots.js';
import { glowTex } from './decor.js';
import { waveHeight, U } from './shared.js';

const COLORS = { fish: '#bff6ff', dredge: '#d9b073', crab: '#ffb05a', aberrant: '#d070ff', lens: '#ffd84a', rich: '#a8ffd0' };
const POOL = 44;

const ringGeo = new THREE.RingGeometry(0.8, 1.0, 40).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
const ringMats = {}, bubbleMats = {}, haloMats = {};
function mats(kind) {
  if (!ringMats[kind]) {
    const c = new THREE.Color(COLORS[kind]);
    ringMats[kind] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    bubbleMats[kind] = new THREE.PointsMaterial({ map: glowTex, color: c, size: 1.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
    haloMats[kind] = new THREE.PointsMaterial({ map: glowTex, color: c, size: 40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.38 });
  }
}
Object.keys(COLORS).forEach(mats);
const discMat = new THREE.MeshBasicMaterial({ color: '#2d2118', transparent: true, opacity: 0.5, depthWrite: false });
const beamGeo = new THREE.CylinderGeometry(1.2, 1.6, 90, 10, 1, true).translate(0, 45, 0);
const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function makeVisual() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(ringGeo, ringMats.fish);
  const ring2 = new THREE.Mesh(ringGeo, ringMats.fish);
  const disc = new THREE.Mesh(discGeo, discMat);
  const bg = new THREE.BufferGeometry();
  const bp = new Float32Array(12 * 3);
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const bubbles = new THREE.Points(bg, bubbleMats.fish);
  bubbles.frustumCulled = false;
  const hg = new THREE.BufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 3, 0]), 3));
  const halo = new THREE.Points(hg, haloMats.fish);
  halo.frustumCulled = false;
  const beam = new THREE.Mesh(beamGeo, beamMat);
  g.add(disc, ring, ring2, bubbles, halo, beam);
  g.visible = false;
  return { g, ring, ring2, disc, bubbles, bp, halo, beam, spot: null, phase: Math.random() * 6.28, kind: 'fish' };
}

export class SpotsView {
  constructor(scene) {
    this.scene = scene;
    this.pool = Array.from({ length: POOL }, makeVisual);
    this.pool.forEach((v) => scene.add(v.g));
    this.active = new Map(); // spot.id -> visual
    this.near = [];          // available spots in range, sorted by distance
    this.timer = 0;
  }

  kindOf(s) {
    if (s.type === 'fish') return s.aberrant ? 'aberrant' : s.rich ? 'rich' : 'fish';
    return s.type;
  }

  /** ctx: { state, abs, night } */
  update(dt, px, pz, ctx) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.3;
      const range = ctx.night > 0.6 ? 330 : 470;
      const cands = [];
      const occupied = new Set(ctx.state.pots.map((p) => p.spotId));
      for (const s of spotsNear(px, pz, range + 60)) {
        if (!spotAvailable(s, ctx.state, ctx.abs, ctx.night > 0.6)) continue;
        if (s.type === 'crab' && Math.hypot(s.x - px, s.z - pz) > 260) continue;
        const d = Math.hypot(s.x - px, s.z - pz);
        if (d > range) continue;
        cands.push({ s, d, taken: s.type === 'crab' && occupied.has(s.id) });
      }
      cands.sort((a, b) => a.d - b.d);
      this.near = cands;
      const want = new Set(cands.slice(0, POOL).map((c) => c.s.id));
      for (const [id, v] of this.active) if (!want.has(id)) { v.g.visible = false; v.spot = null; this.active.delete(id); }
      for (const c of cands.slice(0, POOL)) {
        if (this.active.has(c.s.id)) continue;
        const v = this.pool.find((p) => !p.spot);
        if (!v) break;
        v.spot = c.s;
        this.active.set(c.s.id, v);
        const kind = this.kindOf(c.s);
        v.kind = kind;
        v.ring.material = v.ring2.material = ringMats[kind];
        v.bubbles.material = bubbleMats[kind];
        v.halo.material = haloMats[kind];
        const r = c.s.r;
        v.ring.scale.setScalar(r); v.ring2.scale.setScalar(r * 0.6);
        v.disc.visible = c.s.type === 'dredge';
        v.disc.scale.setScalar(r * 0.95);
        v.beam.visible = c.s.type === 'lens';
        v.ring2.visible = c.s.type !== 'crab';
        v.g.visible = true;
      }
    }
    const t = U.uTime.value;
    for (const v of this.active.values()) {
      const s = v.spot;
      if (!s) continue;
      const y = waveHeight(s.x, s.z, t) * 0.7 + 0.16;
      v.g.position.set(s.x, y, s.z);
      const pulse = 1 + 0.12 * Math.sin(t * 2.2 + v.phase);
      v.ring.scale.setScalar(s.r * pulse);
      v.ring2.scale.setScalar(s.r * 0.6 * (1.1 - 0.12 * Math.sin(t * 2.2 + v.phase)));
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = i * 2.399 + v.phase;
        const rr = (0.15 + ((i * 0.37) % 0.7)) * s.r * 0.8;
        const lt = (t * (0.5 + (i % 3) * 0.15) + i * 0.27) % 1;
        v.bp[i * 3] = Math.cos(a + t * 0.1) * rr;
        v.bp[i * 3 + 1] = lt * 2.6;
        v.bp[i * 3 + 2] = Math.sin(a + t * 0.1) * rr;
      }
      v.bubbles.geometry.attributes.position.needsUpdate = true;
    }
  }

  nearestOfType(types, maxDist) {
    for (const c of this.near) if (types.includes(c.s.type) && c.d <= maxDist && !c.taken) return c;
    return null;
  }
}

/** Crab pot buoys */
export class PotsView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = new Map();
    this.geo = new THREE.SphereGeometry(0.7, 8, 6);
    this.poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 4).translate(0, 1.6, 0);
    this.flagGeo = new THREE.PlaneGeometry(0.9, 0.6).translate(0.45, 2.6, 0);
    this.matA = new THREE.MeshLambertMaterial({ color: '#ff8a2a', flatShading: true });
    this.matP = new THREE.MeshLambertMaterial({ color: '#4a3a28' });
    this.matF = new THREE.MeshBasicMaterial({ color: '#ffd84a', side: THREE.DoubleSide });
  }
  sync(pots) {
    const ids = new Set(pots.map((p) => p.id));
    for (const [id, m] of this.meshes) if (!ids.has(id)) { this.group.remove(m); this.meshes.delete(id); }
    for (const p of pots) {
      if (this.meshes.has(p.id)) continue;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.geo, this.matA), new THREE.Mesh(this.poleGeo, this.matP), new THREE.Mesh(this.flagGeo, this.matF));
      g.position.set(p.x, 0, p.z);
      this.group.add(g);
      this.meshes.set(p.id, g);
    }
  }
  update(t) {
    for (const [, m] of this.meshes) m.position.y = waveHeight(m.position.x, m.position.z, t) * 0.8 - 0.1;
  }
}
