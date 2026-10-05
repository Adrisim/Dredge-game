// Low-poly decoration for islands: trees, rocks, town buildings, piers, lighthouses.
// Everything is baked into a handful of merged meshes per island to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './worldgen.js';
import { mulberry32, clamp, TAU } from '../util/math.js';

export const decorMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
export const windowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
export const lampMat = new THREE.MeshBasicMaterial({ color: 0x555555 });

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const glowTex = radialTexture();
export const haloMat = new THREE.PointsMaterial({
  map: glowTex, size: 9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  color: 0xffc070, opacity: 0, sizeAttenuation: true,
});

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  const gx = g.createLinearGradient(0, 0, 128, 0);
  gx.addColorStop(0, 'rgba(255,240,200,0.9)');
  gx.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gx; g.fillRect(0, 0, 128, 32);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 32);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.5, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy; g.fillRect(0, 0, 128, 32);
  return new THREE.CanvasTexture(c);
}
const beamTex = beamTexture();
export const beamMat = new THREE.MeshBasicMaterial({
  map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
});

// ---- geometry templates (unit-sized, base at y = 0) ---------------------------------------------
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const PYR = new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0);
const CYL5 = new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0);
const CONE6 = new THREE.ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0);
const CONE5 = new THREE.ConeGeometry(0.5, 1, 5).translate(0, 0.5, 0);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const PLANE = new THREE.PlaneGeometry(1, 1);

function makeGable() {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tris = [
    [V(-.5, 0, -.5), V(-.5, 0, .5), V(-.5, 1, 0)],
    [V(.5, 0, -.5), V(.5, 0, .5), V(.5, 1, 0)],
    [V(-.5, 0, -.5), V(.5, 0, -.5), V(.5, 1, 0)], [V(-.5, 0, -.5), V(.5, 1, 0), V(-.5, 1, 0)],
    [V(-.5, 0, .5), V(.5, 0, .5), V(.5, 1, 0)], [V(-.5, 0, .5), V(.5, 1, 0), V(-.5, 1, 0)],
  ];
  const centre = V(0, 0.33, 0);
  const pos = [];
  for (const [a, b, c] of tris) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(centre);
    const tri = n.dot(mid) >= 0 ? [a, b, c] : [a, c, b];
    for (const v of tri) pos.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
const GABLE = makeGable();

class Batch {
  constructor() { this.parts = []; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.c = new THREE.Color(); }
  add(geo, x, y, z, sx, sy, sz, rotY, color, rotX = 0, rotZ = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    this.e.set(rotX, rotY, rotZ, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    this.c.set(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = this.c.r; arr[i * 3 + 1] = this.c.g; arr[i * 3 + 2] = this.c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(g);
  }
  build() {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    return g;
  }
}

const STYLE = {
  fishing: { walls: ['#f3e9d8', '#d9e8ea', '#f2d9c4', '#e6d3a8'], roofs: ['#b8573c', '#3d6d8a', '#8a4b3a'], wood: '#8c6a47' },
  marsh: { walls: ['#9b8466', '#8a7458', '#a69272'], roofs: ['#5d6b47', '#6b5a3d'], wood: '#6e5a40' },
  volcanic: { walls: ['#4a4442', '#5a4f4a', '#3b3634'], roofs: ['#c2522b', '#8c3a22', '#2a2626'], wood: '#4d3b30' },
  pale: { walls: ['#f4f1ea', '#e6e2d6', '#dfe8ee'], roofs: ['#4f78a6', '#6c8fb3', '#a8b9c8'], wood: '#9a8a74' },
  pine: { walls: ['#8b5e3c', '#a36f45', '#7a5234'], roofs: ['#a23b2a', '#2f4f3a', '#6b3a2a'], wood: '#6b4a30' },
  lighthouse: { walls: ['#f1ece0'], roofs: ['#8a3a30'], wood: '#7a5c40' },
};

// ---- trees & scatter ----------------------------------------------------------------------------
function treePalette(isl) {
  if (isl.zone === 4) return { leaf: ['#5a5470', '#4a4560', '#6c6485'], trunk: '#3a3340', style: 'dead' };
  if (isl.zone === 3) return { leaf: ['#2f6a4c', '#27583f', '#3a7a58'], trunk: '#4a3a2a', style: 'pine' };
  if (isl.zone === 2) return { leaf: ['#4f8a3f', '#5f9a4a', '#3f7a3a'], trunk: '#5a432d', style: 'round' };
  return { leaf: ['#5ea84a', '#6bb554', '#4f9a42'], trunk: '#6a4a30', style: 'round' };
}

function addTree(b, x, y, z, s, pal, rng) {
  const leaf = pal.leaf[Math.floor(rng() * pal.leaf.length)];
  if (pal.style === 'pine') {
    b.add(CYL5, x, y, z, 0.5 * s, 1.6 * s, 0.5 * s, 0, pal.trunk);
    b.add(CONE6, x, y + 1.2 * s, z, 3.6 * s, 4.2 * s, 3.6 * s, 0, leaf);
    b.add(CONE6, x, y + 3.4 * s, z, 2.6 * s, 3.6 * s, 2.6 * s, 0.4, leaf);
    b.add(CONE6, x, y + 5.2 * s, z, 1.6 * s, 2.8 * s, 1.6 * s, 0.8, leaf);
  } else if (pal.style === 'dead') {
    b.add(CYL5, x, y, z, 0.45 * s, 4.2 * s, 0.45 * s, 0, pal.trunk, 0.05, 0.08);
    b.add(CYL5, x + 0.5 * s, y + 2.4 * s, z, 0.25 * s, 2 * s, 0.25 * s, 0, pal.trunk, 0, -0.9);
    b.add(CONE5, x, y + 3.6 * s, z, 1.6 * s, 2.4 * s, 1.6 * s, 0, leaf);
  } else {
    b.add(CYL5, x, y, z, 0.55 * s, 2.2 * s, 0.55 * s, 0, pal.trunk);
    b.add(ICO, x, y + 3.4 * s, z, 2.1 * s, 2.0 * s, 2.1 * s, rng() * 3, leaf);
    b.add(ICO, x + 0.9 * s, y + 2.7 * s, z + 0.4 * s, 1.4 * s, 1.3 * s, 1.4 * s, rng() * 3, leaf);
  }
}

function scatterNature(b, isl, rng, avoid, density = 1) {
  const pal = treePalette(isl);
  const R = isl.R;
  const wantTrees = clamp(Math.round(R * 0.65 * density), 0, 150);
  let placed = 0;
  const maxH = isl.P * 0.72;
  for (let t = 0; t < wantTrees * 5 && placed < wantTrees; t++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * R * 1.05;
    const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < 1.9 || h > maxH) continue;
    if (avoid && avoid(x, z)) continue;
    if (Math.abs(heightAt(x + 3, z) - h) > 2.4 || Math.abs(heightAt(x, z + 3) - h) > 2.4) continue;
    addTree(b, x, h - 0.2, z, 0.8 + rng() * 0.9, pal, rng);
    placed++;
  }
  // beach & hill rocks
  const wantRocks = clamp(Math.round(R * 0.22), 2, 40);
  for (let t = 0; t < wantRocks * 4 && wantRocks > 0; t++) {
    const a = rng() * TAU, d = (0.55 + rng() * 0.6) * R;
    const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < 0.3) continue;
    if (avoid && avoid(x, z)) continue;
    const s = 0.8 + rng() * 2.2;
    b.add(ICO, x, h - 0.3, z, s * 1.2, s * 0.8, s, rng() * 6, rng() < 0.5 ? '#8f8a80' : '#7a766e');
  }
}

// ---- buildings ------------------------------------------------------------------------------------
function pickColor(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function addWindows(gb, x, y, z, w, d, h, rot, count, rng) {
  // windows on the front (+z local) and the right side
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const put = (lx, ly, lz, ry) => {
    const wx = x + lx * cos + lz * sin, wz = z - lx * sin + lz * cos;
    gb.add(PLANE, wx, y + ly, wz, 1.1, 1.3, 1, rot + ry, '#ffffff');
  };
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
    put(t * (w * 0.7) + (count === 1 ? w * 0.22 : 0), h * 0.5, d / 2 + 0.06, 0);
  }
  if (rng() < 0.7) put(w / 2 + 0.06, h * 0.5, 0, Math.PI / 2);
}

function addHouse(b, gb, x, y, z, rot, kind, st, rng, halos) {
  let w = 7 + rng() * 3, d = 6 + rng() * 2.5, h = 3.6 + rng() * 1.4;
  if (kind === 'tavern') { w = 12; d = 8.5; h = 6.5; }
  if (kind === 'shipyard') { w = 15; d = 9.5; h = 5.2; }
  if (kind === 'harbour') { w = 7; d = 7; h = 8; }
  const wall = pickColor(st.walls, rng);
  const roof = kind === 'tavern' ? '#8a3a30' : pickColor(st.roofs, rng);
  b.add(BOX, x, y - 0.6, z, w, h + 0.6, d, rot, wall);
  const ridge = w >= d;
  const rh = kind === 'harbour' ? 3.6 : 2.4 + rng() * 0.8;
  if (kind === 'harbour') b.add(PYR, x, y + h, z, w + 1.2, rh, d + 1.2, rot, roof);
  else b.add(GABLE, x, y + h, z, ridge ? w + 1.2 : d + 1.2, rh, ridge ? d + 1.2 : w + 1.2, rot + (ridge ? 0 : Math.PI / 2), roof);
  // door
  const c = Math.cos(rot), s = Math.sin(rot);
  b.add(BOX, x + s * (d / 2 + 0.05), y, z + c * (d / 2 + 0.05), 1.4, 2.3, 0.3, rot, '#4a3426');
  // chimney
  if (kind !== 'harbour' && rng() < 0.7) {
    const cx = x + (c * -w * 0.25), cz = z + (-s * -w * 0.25);
    b.add(BOX, cx, y + h + 0.8, cz, 0.9, 2.6, 0.9, rot, '#6b5a50');
  }
  addWindows(gb, x, y, z, w, d, h, rot, kind === 'tavern' || kind === 'shipyard' ? 3 : 2, rng);
  if (halos) halos.push(x + s * (d / 2 + 2), y + h * 0.5, z + c * (d / 2 + 2));
  return { w, d, h };
}

function addMarket(b, gb, x, y, z, rot, st, rng, halos) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const cols = ['#c2402f', '#e8dcc0', '#2f6aa6', '#e8b030'];
  for (let i = -1; i <= 1; i++) {
    const lx = i * 5.2;
    const wx = x + lx * c, wz = z - lx * s;
    b.add(BOX, wx, y, wz, 4.2, 0.9, 2.4, rot, st.wood);
    for (const sx of [-1.9, 1.9]) {
      const px = wx + sx * c, pz = wz - sx * s;
      b.add(CYL5, px, y, pz, 0.22, 2.8, 0.22, 0, st.wood);
    }
    b.add(GABLE, wx, y + 2.7, wz, 4.8, 1.0, 3.2, rot + Math.PI / 2, cols[(i + 1 + (Math.floor(rng() * 2))) % 4]);
    b.add(BOX, wx, y + 0.9, wz, 3.0, 0.3, 1.5, rot, i === 0 ? '#c9d6dc' : '#c8a870');
  }
  // barrels and crates
  b.add(CYL8, x + 9 * c, y, z - 9 * s, 1.2, 1.4, 1.2, 0, '#7a5230');
  b.add(BOX, x - 9 * c, y, z + 9 * s, 1.6, 1.4, 1.6, rot, '#9a7a4a');
  halos && halos.push(x, y + 3.2, z);
}

function addShipyardExtras(b, x, y, z, rot, st) {
  const c = Math.cos(rot), s = Math.sin(rot);
  // crane
  const cx = x + c * -10, cz = z - s * -10;
  b.add(BOX, cx, y, cz, 1, 12, 1, rot, '#3d3a38');
  b.add(BOX, cx + s * 3, y + 11.5, cz + c * 3, 0.7, 0.7, 8, rot, '#3d3a38');
  b.add(BOX, cx + s * 6.6, y + 8.5, cz + c * 6.6, 0.15, 3, 0.15, rot, '#222');
  // hull on stocks
  const hx = x + s * 12, hz = z + c * 12;
  b.add(BOX, hx, y, hz, 3.4, 0.5, 9, rot, '#6d4a2c');
  b.add(GABLE, hx, y + 0.5, hz, 9, 1.6, 3.6, rot + Math.PI / 2, '#8f6a3c');
}

function addPier(b, gb, isl, halos) {
  const d = isl.town.dock;
  const sx = d.start.x, sz = d.start.z, ex = d.end.x, ez = d.end.z;
  const len = Math.hypot(ex - sx, ez - sz);
  const rot = Math.atan2(d.dx, d.dz);
  const mx = (sx + ex) / 2, mz = (sz + ez) / 2;
  const y = 1.25;
  b.add(BOX, mx, y - 0.25, mz, 3.4, 0.35, len, rot, '#8a6a46');
  const n = Math.floor(len / 5);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = sx + (ex - sx) * t, pz = sz + (ez - sz) * t;
    for (const side of [-1.5, 1.5]) {
      const ox = px - d.dz * side, oz = pz + d.dx * side;
      b.add(CYL5, ox, y - 5.5, oz, 0.45, 6.0, 0.45, 0, '#4a3826');
    }
  }
  // lamps along the pier
  for (const t of [0.25, 0.65, 1.0]) {
    const px = sx + (ex - sx) * t - d.dz * 1.9, pz = sz + (ez - sz) * t + d.dx * 1.9;
    b.add(CYL5, px, y, pz, 0.22, 3.4, 0.22, 0, '#2c2622');
    gb.add(BOX, px, y + 3.3, pz, 0.7, 0.7, 0.7, 0, '#ffffff');
    halos.push(px, y + 3.6, pz);
  }
  // mooring post + small boat-house crate at the root
  b.add(BOX, ex - d.dz * 1.2, y, ez + d.dx * 1.2, 1.0, 1.0, 1.0, rot, '#7a5a3a');
}

function addLighthouse(b, lanternGeo, x, y, z, scale = 1) {
  const bands = ['#f4efe4', '#b8372c', '#f4efe4', '#b8372c', '#f4efe4'];
  let yy = y - 1;
  const hts = [5, 5, 5, 4.5, 4];
  let r = 4.0 * scale;
  for (let i = 0; i < 5; i++) {
    const g = new THREE.CylinderGeometry(r * 0.88, r, hts[i] * scale, 10);
    b.add(g, x, yy + hts[i] * scale / 2, z, 1, 1, 1, 0, bands[i]);
    yy += hts[i] * scale; r *= 0.88;
  }
  b.add(CYL8, x, yy, z, r * 2.5, 0.6 * scale, r * 2.5, 0, '#2d2a28');
  lanternGeo.add(CYL8, x, yy + 0.6 * scale, z, r * 1.7, 2.6 * scale, r * 1.7, 0, '#ffffff');
  b.add(CONE6, x, yy + 3.2 * scale, z, r * 2.3, 2.6 * scale, r * 2.3, 0, '#2d2a28');
  return yy + 1.8 * scale;
}

// ---- public: build all decoration for an island --------------------------------------------------------
export function buildDecor(isl) {
  const rng = mulberry32(isl.seed * 7 + 13);
  const solid = new Batch();
  const glow = new Batch();   // windows + lamps (night-lit)
  const lantern = new Batch();
  const halos = [];
  const out = { objects: [], dispose: [], update: null };
  let beam = null;

  if (isl.kind === 'wild' || isl.kind === 'rock' && isl.R > 20) scatterNature(solid, isl, rng);
  if (isl.kind === 'stack') { /* bare rock */ }

  if (isl.town) {
    const t = isl.town;
    const st = STYLE[t.style] || STYLE.fishing;
    const dock = t.dock;
    const faceRot = Math.atan2(dock.dx, dock.dz);
    const slots = [];
    const keepClear = []; // {x,z,r} circles trees must avoid
    const dsx = dock.start.x, dsz = dock.start.z;
    if (t.style === 'lighthouse') {
      const cy = heightAt(isl.x, isl.z);
      const topY = addLighthouse(solid, lantern, isl.x, cy, isl.z, 1.5);
      const hx = isl.x + dock.dx * 38, hz = isl.z + dock.dz * 38;
      addHouse(solid, glow, hx, heightAt(hx, hz), hz, faceRot, 'house', st, rng, halos);
      out.lightTop = { x: isl.x, y: topY, z: isl.z };
      keepClear.push({ x: isl.x, z: isl.z, r: 14 }, { x: hx, z: hz, r: 12 });
    } else {
      // building slots on the plateau, nearest the dock first
      const taken = (x, z, r) => slots.some((s) => Math.hypot(s.x - x, s.z - z) < r);
      for (let tries = 0; tries < 900 && slots.length < 22; tries++) {
        const a = rng() * TAU, dd = Math.sqrt(rng()) * isl.R * 0.78;
        const x = isl.x + Math.cos(a) * dd, z = isl.z + Math.sin(a) * dd;
        const h = heightAt(x, z);
        if (h < 2.4 || h > 6.9) continue;
        if (Math.abs(heightAt(x + 7, z) - h) > 1.3 || Math.abs(heightAt(x, z + 7) - h) > 1.3) continue;
        const toStart = Math.hypot(x - dsx, z - dsz);
        if (toStart < 11) continue; // keep the pier approach clear
        if (taken(x, z, 15)) continue;
        slots.push({ x, z, h, dist: toStart });
      }
      slots.sort((a, b2) => a.dist - b2.dist);
      const specials = ['harbour', 'shipyard', 'market', 'tavern'];
      slots.forEach((s, i) => {
        const rot = Math.atan2(dsx - s.x, dsz - s.z) + (rng() - 0.5) * 0.7;
        const kind = i < specials.length ? specials[i] : 'house';
        if (kind === 'market') addMarket(solid, glow, s.x, s.h, s.z, rot, st, rng, halos);
        else {
          addHouse(solid, glow, s.x, s.h, s.z, rot, kind, st, rng, halos);
          if (kind === 'shipyard') addShipyardExtras(solid, s.x, s.h, s.z, rot, st);
        }
        keepClear.push({ x: s.x, z: s.z, r: kind === 'shipyard' ? 17 : 11 });
      });
      if (t.id === 'saltmere' || t.style === 'pale' || t.id === 'gullhaven') {
        // small lighthouse on the opposite headland
        const lx = isl.x - dock.dx * isl.R * 0.55, lz = isl.z - dock.dz * isl.R * 0.55;
        const lh = heightAt(lx, lz);
        if (lh > 1.5) {
          const topY = addLighthouse(solid, lantern, lx, lh, lz, 1.0);
          out.lightTop = { x: lx, y: topY, z: lz };
          keepClear.push({ x: lx, z: lz, r: 9 });
        }
      }
    }
    addPier(solid, glow, isl, halos);
    const avoid = (x, z) => {
      for (const c of keepClear) if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
      // pier approach corridor
      const px = x - dsx, pz = z - dsz;
      const along = px * dock.dx + pz * dock.dz;
      const across = Math.abs(-px * dock.dz + pz * dock.dx);
      return along > -14 && along < 60 && across < 12;
    };
    scatterNature(solid, { ...isl, P: isl.hill ? isl.P + 18 : isl.P + 4 }, rng, avoid, t.style === 'volcanic' ? 0.12 : 0.9);
    if (isl.hill) {
      // lava glow at the crater
      const hx = isl.x + isl.hill.dx * isl.R * 0.45, hz = isl.z + isl.hill.dz * isl.R * 0.45;
      out.volcano = { x: hx, y: isl.hill.h * 0.8, z: hz };
    }
  }

  const add = (geo, mat) => {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    out.objects.push(m);
    out.dispose.push(geo);
    return m;
  };
  const sg = solid.build();
  if (sg) { sg.computeBoundingSphere(); sg.boundingSphere.radius += 5; }
  add(sg, decorMat);
  const gg = glow.build();
  if (gg) { gg.computeBoundingSphere(); add(gg, windowMat); }

  const lg = lantern.build();
  let lanternMesh = null;
  if (lg) {
    lanternMesh = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x555555 }));
    out.objects.push(lanternMesh);
    out.dispose.push(lg);
  }

  if (out.lightTop) {
    beam = new THREE.Group();
    for (const dir of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(300, 9).rotateX(-Math.PI / 2).translate(150, 0, 0), beamMat);
      p.rotation.y = dir;
      beam.add(p);
    }
    beam.position.set(out.lightTop.x, out.lightTop.y, out.lightTop.z);
    beam.frustumCulled = false;
    out.objects.push(beam);
    if (lanternMesh) halos.push(out.lightTop.x, out.lightTop.y, out.lightTop.z);
  }
  if (out.volcano) halos.push(out.volcano.x, out.volcano.y, out.volcano.z);

  if (halos.length) {
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(halos, 3));
    pg.computeBoundingSphere();
    const pts = new THREE.Points(pg, haloMat);
    pts.frustumCulled = false;
    out.objects.push(pts);
    out.dispose.push(pg);
  }

  out.beam = beam;
  out.lanternMesh = lanternMesh;
  return out;
}
