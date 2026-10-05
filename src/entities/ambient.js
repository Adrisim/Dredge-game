import * as THREE from 'three';
import { glowTex } from '../world/decor.js';
import { waveHeight, U } from '../world/shared.js';
import { islands } from '../world/worldgen.js';
import { clamp } from '../util/math.js';

// ---------------------------------------------------------------- Gulls
export class Gulls {
  constructor(scene, n = 9) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, 2.1, 0.1, 0, 0, 0, -0.5, 0, 0, 0.5, 2.1, 0.1, 0, 0, 0, -0.5].slice(0, 9), 3));
    const mat = new THREE.MeshBasicMaterial({ color: '#f5f5f5', side: THREE.DoubleSide });
    this.gulls = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 5).rotateX(Math.PI / 2), mat);
      const wl = new THREE.Mesh(wing, mat), wr = new THREE.Mesh(wing, mat);
      wr.scale.x = -1;
      g.add(body, wl, wr);
      this.group.add(g);
      this.gulls.push({ g, wl, wr, cx: 0, cz: 0, r: 30, a: Math.random() * 6.28, sp: 0.35 + Math.random() * 0.25, h: 16 + Math.random() * 14, ph: Math.random() * 6, need: true });
    }
  }
  update(dt, px, pz, night) {
    this.group.visible = night < 0.7;
    if (!this.group.visible) return;
    const t = U.uTime.value;
    for (const s of this.gulls) {
      if (s.need || Math.hypot(s.cx - px, s.cz - pz) > 520) {
        // pick a circling centre near a nearby island, else near the player
        const near = islands.filter((i) => i.kind !== 'reef' && Math.hypot(i.x - px, i.z - pz) < 650);
        if (near.length && Math.random() < 0.7) {
          const i = near[Math.floor(Math.random() * near.length)];
          s.cx = i.x + (Math.random() - 0.5) * i.R; s.cz = i.z + (Math.random() - 0.5) * i.R;
        } else { const a = Math.random() * 6.28, d = 120 + Math.random() * 280; s.cx = px + Math.cos(a) * d; s.cz = pz + Math.sin(a) * d; }
        s.need = false;
      }
      s.a += s.sp * dt * (30 / s.r);
      const x = s.cx + Math.cos(s.a) * s.r, z = s.cz + Math.sin(s.a) * s.r;
      s.g.position.set(x, s.h + Math.sin(t * 0.7 + s.ph) * 1.5, z);
      s.g.rotation.y = -s.a;
      s.g.rotation.z = -0.25;
      const f = Math.sin(t * 5 + s.ph) * 0.45;
      s.wl.rotation.z = f; s.wr.rotation.z = -f;
    }
  }
}

// ---------------------------------------------------------------- Fishing bobber + line
export class Bobber {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshLambertMaterial({ color: '#e84a3a' })));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f6f2e8' }));
    top.position.y = 0.04;
    g.add(top);
    this.mesh = g;
    this.mesh.visible = false;
    scene.add(g);
    this.N = 14;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#f2f2f2', transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ripple.visible = false;
    scene.add(this.ripple);
    this.tx = 0; this.tz = 0; this.t = 0; this.active = false; this.bite = 0; this.reel = 0;
  }
  cast(x, z) { this.tx = x; this.tz = z; this.t = 0; this.active = true; this.reel = 0; this.mesh.visible = this.line.visible = this.ripple.visible = true; }
  retract() { this.reel = 0.0001; }
  hide() { this.active = false; this.mesh.visible = this.line.visible = this.ripple.visible = false; }
  setBite(b) { this.bite = b; }
  update(dt, tipWorld) {
    if (!this.active) return;
    this.t += dt;
    let px = this.tx, pz = this.tz;
    let arc = 0;
    if (this.t < 0.7) {
      // flight from the rod tip to the target
      const k = this.t / 0.7;
      px = tipWorld.x + (this.tx - tipWorld.x) * k; pz = tipWorld.z + (this.tz - tipWorld.z) * k;
      arc = Math.sin(k * Math.PI) * 6;
    }
    if (this.reel > 0) {
      this.reel += dt * 1.6;
      const k = clamp(this.reel, 0, 1);
      px = this.tx + (tipWorld.x - this.tx) * k; pz = this.tz + (tipWorld.z - this.tz) * k;
      arc = Math.sin(k * Math.PI) * 3;
      if (k >= 1) { this.hide(); return; }
    }
    const t = U.uTime.value;
    const bob = this.bite ? Math.sin(t * 22) * 0.18 - 0.2 : Math.sin(t * 2.6) * 0.06;
    const py = waveHeight(px, pz, t) + 0.15 + arc + bob;
    this.mesh.position.set(px, py, pz);
    this.ripple.position.set(px, waveHeight(px, pz, t) + 0.12, pz);
    const rs = 1.2 + ((t * 0.9) % 1) * (this.bite ? 3.5 : 1.8);
    this.ripple.scale.setScalar(rs);
    this.ripple.material.opacity = 0.55 * (1 - ((t * 0.9) % 1));
    const pos = this.line.geometry.attributes.position;
    for (let i = 0; i < this.N; i++) {
      const k = i / (this.N - 1);
      const x = tipWorld.x + (px - tipWorld.x) * k, z = tipWorld.z + (pz - tipWorld.z) * k;
      const sag = Math.sin(k * Math.PI) * -1.4 * (this.t > 0.7 && this.reel === 0 ? 1 : 0.3);
      const y = tipWorld.y + (py - tipWorld.y) * k + sag;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Dread ghosts
export class Ghosts {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.bodyGeo = new THREE.ConeGeometry(1.5, 5.2, 7, 1, true).translate(0, 2.6, 0);
    this.bodyMat = new THREE.MeshBasicMaterial({ color: '#1b1234', transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.eyeGeo = new THREE.SphereGeometry(0.22, 6, 4);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: '#ff4a6a' });
    this.haloMat = new THREE.PointsMaterial({ map: glowTex, color: '#a050ff', size: 12, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  }
  spawn(boat) {
    if (this.list.length >= 3) return;
    const a = boat.heading + (Math.random() - 0.5) * 2.4 + (Math.random() < 0.5 ? 0 : Math.PI * 0.6);
    const d = 70 + Math.random() * 30;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.bodyGeo, this.bodyMat));
    for (const sx of [-0.45, 0.45]) { const e = new THREE.Mesh(this.eyeGeo, this.eyeMat); e.position.set(sx, 4.0, 0.9); g.add(e); }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 3, 0]), 3));
    g.add(new THREE.Points(hg, this.haloMat));
    g.position.set(boat.x + Math.sin(a) * d, 0, boat.z + Math.cos(a) * d);
    g.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(g);
    this.list.push({ g, life: 34, hit: false });
  }
  update(dt, boat, onHit) {
    const t = U.uTime.value;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const gh = this.list[i];
      gh.life -= dt;
      const dx = boat.x - gh.g.position.x, dz = boat.z - gh.g.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = 7.5;
      gh.g.position.x += (dx / d) * sp * dt + Math.sin(t * 1.7 + i) * 2.5 * dt;
      gh.g.position.z += (dz / d) * sp * dt + Math.cos(t * 1.3 + i) * 2.5 * dt;
      gh.g.position.y = waveHeight(gh.g.position.x, gh.g.position.z, t) + Math.sin(t * 2 + i) * 0.5;
      gh.g.rotation.y = Math.atan2(dx, dz);
      if (d < 4.2 && !gh.hit) { gh.hit = true; onHit && onHit(); gh.life = 0; }
      if (gh.life <= 0 || d > 260) { this.scene.remove(gh.g); this.list.splice(i, 1); }
    }
  }
  clear() { for (const gh of this.list) this.scene.remove(gh.g); this.list = []; }
}
