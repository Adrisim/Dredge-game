import * as THREE from 'three';
import { heightAt } from '../world/worldgen.js';
import { U, waveHeight } from '../world/shared.js';
import { windowMat, glowTex } from '../world/decor.js';
import { clamp, angleDiff } from '../util/math.js';
import { BOAT_DRAFT, WORLD_RADIUS } from '../config.js';

const HULL_PAINT = ['#8a3a30', '#2f5f86', '#3b7048', '#6a4a8a', '#c0902c'];
const ROOF_PAINT = ['#b8503a', '#e0c070', '#d8d4c4', '#d8d4c4', '#2a2a30'];

function vcolorBox(w, h, d, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  const c = new THREE.Color(color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function buildHull() {
  const g = new THREE.BoxGeometry(3.1, 1.6, 8.4, 2, 4, 6);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const dark = new THREE.Color('#7a2e2a'), white = new THREE.Color('#efe9da');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const zn = z / 4.2;
    if (zn > 0) {
      x *= 1 - Math.pow(zn, 1.7) * 0.94;
      y += Math.pow(zn, 2) * 0.55;
    } else {
      x *= 1 + zn * 0.08; // slightly narrower transom
    }
    if (y < 0) x *= 0.64 + 0.36 * (1 + y / 0.8);
    p.setXYZ(i, x, y, z);
    const t = clamp((y + 0.2) / 0.5, 0, 1);
    c.copy(dark).lerp(white, t);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export class Boat {
  constructor(scene) {
    this.scene = scene;
    this.x = 0; this.z = 0; this.heading = 0; this.speed = 0;
    this.yawRate = 0; this.pitch = 0; this.roll = 0;
    this.hitCooldown = 0;
    this.edgePush = false;
    this.lightOn = false;
    this.lightPower = 0;      // 0..1 smoothed
    this.lightLevel = 1;
    this.time = 0;

    const group = new THREE.Group();
    this.group = group;
    const lam = (extra = {}) => new THREE.MeshLambertMaterial({ flatShading: true, ...extra });

    this.hullMat = lam({ vertexColors: true });
    this.hull = new THREE.Mesh(buildHull(), this.hullMat);
    this.hull.position.y = 0.35;
    group.add(this.hull);

    // deck
    const deck = new THREE.Mesh(vcolorBox(2.7, 0.12, 6.4, '#a08058'), lam({ vertexColors: true }));
    deck.position.set(0, 1.22, -0.5);
    group.add(deck);

    // cabin
    const cabin = new THREE.Mesh(vcolorBox(2.1, 1.7, 2.5, '#ebe6d8'), lam({ vertexColors: true }));
    cabin.position.set(0, 2.15, -1.2);
    group.add(cabin);
    this.roofMat = lam({ vertexColors: true });
    this.roof = new THREE.Mesh(vcolorBox(2.5, 0.16, 2.9, '#b8503a'), this.roofMat);
    this.roof.position.set(0, 3.08, -1.2);
    group.add(this.roof);
    // windows (glow at night via shared window material)
    const wg = new THREE.PlaneGeometry(0.9, 0.7);
    const wcol = new Float32Array(wg.attributes.position.count * 3).fill(1);
    wg.setAttribute('color', new THREE.BufferAttribute(wcol, 3));
    const wFront = new THREE.Mesh(wg, windowMat);
    wFront.position.set(0, 2.35, 0.07);
    wFront.rotation.y = 0;
    group.add(wFront);
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(wg, windowMat);
      w.position.set(sx * 1.07, 2.35, -1.2);
      w.rotation.y = sx * Math.PI / 2;
      group.add(w);
    }

    // mast + lantern
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 5), lam({ color: '#5a4a3a' }));
    mast.position.set(0, 4.5, -1.6);
    group.add(mast);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x666655 });
    this.lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), this.lampMat);
    this.lampMesh.position.set(0, 2.15, 2.8);
    group.add(this.lampMesh);
    const lampBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), lam({ color: '#33302c' }));
    lampBase.position.set(0, 1.95, 2.8);
    group.add(lampBase);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshLambertMaterial({ color: '#c2402f', side: THREE.DoubleSide }));
    flag.position.set(0.5, 5.8, -1.6);
    this.flag = flag;
    group.add(flag);

    // engine stacks (more with upgrades)
    this.stacks = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9 + i * 0.1, 6), lam({ color: '#2f2f33' }));
      s.position.set(-0.55 + i * 0.37, 3.3, -2.0);
      s.position.y = 3.6;
      s.visible = i < 1;
      group.add(s);
      this.stacks.push(s);
    }
    this.outboard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.6), lam({ color: '#2d3236' }));
    this.outboard.position.set(0, 0.9, -4.5);
    group.add(this.outboard);

    // fishing rod
    this.rodPivot = new THREE.Group();
    this.rodPivot.position.set(-1.0, 1.3, -3.0);
    this.rodPivot.rotation.set(-0.5, 0, 0.9);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 5, 5).translate(0, 2.5, 0), lam({ color: '#4a3a28' }));
    this.rodPivot.add(rod);
    this.rodTip = new THREE.Object3D();
    this.rodTip.position.set(0, 5, 0);
    this.rodPivot.add(this.rodTip);
    group.add(this.rodPivot);
    // crab pot rack (visual only)
    this.rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.0), lam({ color: '#6a5a40' }));
    this.rack.position.set(0.9, 1.7, -3.2);
    this.rack.visible = false;
    group.add(this.rack);

    // spotlight
    this.spot = new THREE.SpotLight(0xffe0aa, 0, 150, 0.55, 0.65, 1.1);
    this.spot.position.set(0, 2.4, 2.8);
    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(0, -1, 40);
    group.add(this.spot, this.spotTarget);
    this.spot.target = this.spotTarget;

    group.traverse((o) => { o.frustumCulled = false; });
    scene.add(group);

    // wake
    const N = 54;
    this.wakeN = N;
    this.wake = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }),
      N,
    );
    this.wake.frustumCulled = false;
    this.wakeData = Array.from({ length: N }, () => ({ x: 0, z: 0, age: 99, s: 1 }));
    this.wakeIdx = 0;
    this.wakeTimer = 0;
    this._m = new THREE.Matrix4();
    this._col = new THREE.Color();
    for (let i = 0; i < N; i++) { this.wake.setMatrixAt(i, this._m.makeScale(0, 0, 0)); this.wake.setColorAt(i, this._col.setRGB(0, 0, 0)); }
    scene.add(this.wake);

    this.setUpgrades({ hull: 1, engine: 1, light: 1, rack: 0 });
  }

  setUpgrades(u) {
    const lvl = clamp(u.hull - 1, 0, HULL_PAINT.length - 1);
    // recolour the dark hull band & cabin roof
    const p = this.hull.geometry.attributes.color;
    const dark = new THREE.Color(HULL_PAINT[lvl]);
    const white = new THREE.Color('#efe9da');
    const pos = this.hull.geometry.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = clamp((pos.getY(i) + 0.2) / 0.5, 0, 1);
      c.copy(dark).lerp(white, t);
      p.setXYZ(i, c.r, c.g, c.b);
    }
    p.needsUpdate = true;
    const rc = new THREE.Color(ROOF_PAINT[lvl]);
    const ra = this.roof.geometry.attributes.color;
    for (let i = 0; i < ra.count; i++) ra.setXYZ(i, rc.r, rc.g, rc.b);
    ra.needsUpdate = true;
    this.stacks.forEach((s, i) => { s.visible = i < clamp(Math.ceil(u.engine / 1.4), 1, 4); });
    this.lightLevel = u.light;
    this.spot.angle = 0.45 + u.light * 0.06;
    this.spot.distance = 90 + u.light * 30;
    this.rack.visible = (u.rack || 0) > 0;
  }

  teleport(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading; this.speed = 0;
    for (const w of this.wakeData) w.age = 99;
    this.syncTransform(0, true);
  }

  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  /** ctrl: {throttle, steer, anchored}; params: {maxSpeed, accel, turn}; hooks: {onHit(impact), onEdge()} */
  update(dt, ctrl, params, hooks = {}) {
    this.time += dt;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const maxV = params.maxSpeed;
    let target = ctrl.throttle >= 0 ? ctrl.throttle * maxV : ctrl.throttle * maxV * 0.4;
    if (ctrl.anchored) target = 0;
    const accel = ctrl.anchored ? 16 : (Math.abs(target) > Math.abs(this.speed) ? params.accel : 9);
    this.speed += clamp(target - this.speed, -accel * dt, accel * dt);

    const sf = 0.3 + 0.7 * Math.min(1, Math.abs(this.speed) / 6);
    const steer = ctrl.anchored ? 0 : ctrl.steer;
    const rate = params.turn * steer * sf * (this.speed < -0.5 ? -1 : 1);
    this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 5);
    this.heading -= this.yawRate * dt;
    this.heading = ((this.heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;

    this.collide(hooks);

    // world edge: a wall of storm turns you back
    const r = Math.hypot(this.x, this.z);
    this.edgePush = false;
    if (r > WORLD_RADIUS - 70) {
      this.edgePush = true;
      const inward = Math.atan2(-this.x, -this.z);
      const d = angleDiff(this.heading, inward);
      this.heading += clamp(d, -1, 1) * Math.min(1, dt * 2.2);
      this.speed *= 1 - Math.min(1, dt * 0.9);
      if (r > WORLD_RADIUS - 20) { this.x *= (WORLD_RADIUS - 20) / r; this.z *= (WORLD_RADIUS - 20) / r; }
      hooks.onEdge && hooks.onEdge();
    }

    // lamp
    this.lightPower += ((this.lightOn ? 1 : 0) - this.lightPower) * Math.min(1, dt * 6);
    this.spot.intensity = this.lightPower * (60 + this.lightLevel * 25);
    this.lampMat.color.setRGB(0.4 + 0.6 * this.lightPower, 0.4 + 0.48 * this.lightPower, 0.33 + 0.2 * this.lightPower);

    this.syncTransform(dt);
    this.updateWake(dt);

    // water lamp pool uniforms
    U.uBoatPos.value.set(this.x, 0, this.z);
    U.uBoatDir.value.set(fx, fz);
    U.uLight.value = this.lightPower;
    U.uCone.value = Math.cos(this.spot.angle * 0.95);
    U.uRange.value = this.spot.distance * 0.7;
  }

  collide(hooks) {
    const pts = [[0, 3.8], [0, -3.4], [1.35, 0.8], [-1.35, 0.8], [1.1, -2.2], [-1.1, -2.2]];
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -Math.cos(this.heading), rz = Math.sin(this.heading);
    for (let iter = 0; iter < 3; iter++) {
      let worst = null;
      for (const [lr, lf] of pts) {
        const px = this.x + fx * lf + rx * lr, pz = this.z + fz * lf + rz * lr;
        const h = heightAt(px, pz);
        if (h > BOAT_DRAFT && (!worst || h > worst.h)) worst = { px, pz, h };
      }
      if (!worst) return;
      const e = 1.2;
      const gx = (heightAt(worst.px + e, worst.pz) - heightAt(worst.px - e, worst.pz)) / (2 * e);
      const gz = (heightAt(worst.px, worst.pz + e) - heightAt(worst.px, worst.pz - e)) / (2 * e);
      let gl = Math.hypot(gx, gz);
      let nx, nz;
      if (gl < 0.02) { nx = this.x - worst.px; nz = this.z - worst.pz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; gl = 0.02; }
      else { nx = -gx / gl; nz = -gz / gl; }
      const push = clamp((worst.h - BOAT_DRAFT) / Math.max(gl, 0.08) + 0.25, 0.1, 5);
      this.x += nx * push; this.z += nz * push;
      // velocity component into the shore
      const vn = (fx * nx + fz * nz) * this.speed; // <0 when moving into land
      if (vn < 0) {
        const impact = -vn;
        // slide: keep tangential motion, bleed speed
        this.speed *= 0.45;
        if (impact > 5.5 && this.hitCooldown <= 0) {
          this.hitCooldown = 1.4;
          hooks.onHit && hooks.onHit(impact);
        } else if (impact > 1.5) hooks.onScrape && hooks.onScrape(impact);
      }
    }
  }

  syncTransform(dt, snap = false) {
    const t = U.uTime.value;
    const g = this.group;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -Math.cos(this.heading), rz = Math.sin(this.heading);
    const wy = (lf, lr) => waveHeight(this.x + fx * lf + rx * lr, this.z + fz * lf + rz * lr, t);
    const hB = wy(3.5, 0), hS = wy(-3.5, 0), hP = wy(0, -1.5), hSt = wy(0, 1.5);
    const targetPitch = -Math.atan2(hB - hS, 7) - clamp(this.speed * 0.004, 0, 0.06);
    const heel = this.yawRate * clamp(Math.abs(this.speed) / 8, 0, 1) * 0.22;
    const targetRoll = Math.atan2(hSt - hP, 3) * -1 + heel;
    const k = snap ? 1 : Math.min(1, dt * 6);
    this.pitch += (targetPitch - this.pitch) * k;
    this.roll += (targetRoll - this.roll) * k;
    g.position.set(this.x, (hB + hS + hP + hSt) / 4 - 0.05, this.z);
    g.rotation.set(this.pitch, this.heading, this.roll, 'YXZ');
    this.flag.rotation.y = Math.sin(t * 6) * 0.3;
  }

  updateWake(dt) {
    const N = this.wakeN;
    this.wakeTimer -= dt;
    const sp = Math.abs(this.speed);
    if (this.wakeTimer <= 0 && sp > 1.5) {
      this.wakeTimer = 0.07;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const w = this.wakeData[this.wakeIdx];
      this.wakeIdx = (this.wakeIdx + 1) % N;
      w.x = this.x - fx * 4.0 + (Math.random() - 0.5) * 1.6;
      w.z = this.z - fz * 4.0 + (Math.random() - 0.5) * 1.6;
      w.age = 0; w.s = 2.2 + Math.min(sp, 20) * 0.1;
    }
    const night = U.uNight.value;
    for (let i = 0; i < N; i++) {
      const w = this.wakeData[i];
      w.age += dt;
      const life = 2.6;
      if (w.age > life) { this._m.makeScale(0, 0, 0); this.wake.setMatrixAt(i, this._m); continue; }
      const t = w.age / life;
      const s = w.s * (1 + t * 2.6);
      this._m.makeScale(s, 1, s).setPosition(w.x, 0.34 + waveHeight(w.x, w.z, U.uTime.value) * 0.5, w.z);
      this.wake.setMatrixAt(i, this._m);
      const a = (1 - t) * (1 - t) * 0.5 * (1 - night * 0.65);
      this.wake.setColorAt(i, this._col.setRGB(a, a, a));
    }
    this.wake.instanceMatrix.needsUpdate = true;
    if (this.wake.instanceColor) this.wake.instanceColor.needsUpdate = true;
  }
}
