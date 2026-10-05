import * as THREE from 'three';
import { islands } from './worldgen.js';
import { buildTerrain } from './islandMesh.js';
import { buildDecor, beamMat } from './decor.js';

const LOAD_R = 1000;
const UNLOAD_R = 1400;

export class IslandManager {
  constructor(scene) {
    this.scene = scene;
    this.loaded = new Map(); // island -> view
    this.isLit = () => true;
  }

  build(isl) {
    const group = new THREE.Group();
    const terrain = buildTerrain(isl);
    group.add(terrain.land, terrain.shallows);
    const decor = buildDecor(isl);
    for (const o of decor.objects) group.add(o);
    this.scene.add(group);
    const view = { isl, group, terrain, decor };
    this.loaded.set(isl, view);
    return view;
  }

  unload(view) {
    this.scene.remove(view.group);
    for (const g of view.terrain.geometries) g.dispose();
    for (const g of view.decor.dispose) g.dispose();
    if (view.decor.lanternMesh) view.decor.lanternMesh.material.dispose();
    this.loaded.delete(view.isl);
  }

  /** Load everything nearby immediately (used at start / teleport). */
  preload(px, pz, radius = LOAD_R) {
    for (const isl of islands) {
      if (this.loaded.has(isl)) continue;
      if (Math.hypot(isl.x - px, isl.z - pz) - isl.R * 1.9 < radius) this.build(isl);
    }
  }

  update(px, pz) {
    for (const [isl, view] of this.loaded) {
      if (Math.hypot(isl.x - px, isl.z - pz) - isl.R * 1.9 > UNLOAD_R) this.unload(view);
    }
    // stream in at most one island per frame, nearest first
    let best = null, bd = Infinity;
    for (const isl of islands) {
      if (this.loaded.has(isl)) continue;
      const d = Math.hypot(isl.x - px, isl.z - pz) - isl.R * 1.9;
      if (d < LOAD_R && d < bd) { bd = d; best = isl; }
    }
    if (best) this.build(best);
  }

  animate(dt, env) {
    const t = performance.now() * 0.001;
    for (const [isl, view] of this.loaded) {
      const d = view.decor;
      if (d.beam) {
        const lit = this.isLit(isl);
        d.beam.visible = lit;
        d.beam.rotation.y = t * 0.55 + isl.seed;
      }
      if (d.lanternMesh) {
        const lit = this.isLit(isl);
        const on = lit ? 0.25 + 0.75 * env.nightLit : 0;
        d.lanternMesh.material.color.setRGB(0.25 + 0.75 * on, 0.22 + 0.62 * on, 0.15 + 0.2 * on);
      }
    }
    void beamMat;
  }
}
