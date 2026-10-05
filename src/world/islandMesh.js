import * as THREE from 'three';
import { heightAt } from './worldgen.js';
import { U, WAVE_GLSL } from './shared.js';
import { clamp, vnoise, smoothstep } from '../util/math.js';

// ---- Materials (shared by all islands) -------------------------------------------------------
export const landMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
landMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aH;\nvarying float vH;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vH;')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vH < 0.0) discard;');
};

const shallowVertex = /* glsl */ `
attribute float aH; uniform float uTime; uniform float uAmp;
varying float vD; varying vec3 vW;
#include <fog_pars_vertex>
${WAVE_GLSL}
void main(){
  vec3 p = position;
  p.y = swellH(p.xz, uTime, uAmp) + 0.09;
  vD = -aH; vW = p;
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const shallowFragment = /* glsl */ `
uniform float uTime; uniform vec3 uShallow; uniform vec3 uTint; uniform float uNight;
varying float vD; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  float depth = vD;
  if (depth < -0.1) discard;
  float a = (1.0 - smoothstep(0.4, 9.0, depth)) * 0.88;
  vec3 near = vec3(0.66, 0.90, 0.80);
  vec3 col = mix(near, uShallow, smoothstep(0.0, 6.5, depth)) * uTint;
  float jitter = sin(uTime * 1.1 + vW.x * 0.31 + vW.z * 0.27);
  float foam = smoothstep(0.7, 0.0, depth + 0.22 * jitter);
  float line2 = smoothstep(0.16, 0.0, abs(depth - (2.0 + 0.9 * sin(uTime * 0.7 + vW.x * 0.11 + vW.z * 0.13)))) * 0.32;
  float sparkle = (sin(vW.x * 1.7 + uTime * 1.3) * sin(vW.z * 1.9 - uTime) * 0.5 + 0.5) * 0.1 * (1.0 - smoothstep(0.0, 4.0, depth));
  col = mix(col, vec3(0.95, 0.98, 1.0) * mix(vec3(1.0), uTint, 0.9), clamp(foam + line2 + sparkle, 0.0, 1.0));
  a = max(a, clamp(foam * 0.95 + line2, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
export const shallowMat = new THREE.ShaderMaterial({
  vertexShader: shallowVertex, fragmentShader: shallowFragment, transparent: true, depthWrite: false, fog: true,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
});
for (const k of ['uTime', 'uAmp', 'uShallow', 'uTint', 'uNight']) shallowMat.uniforms[k] = U[k];

// ---- Palettes ---------------------------------------------------------------------------------
const PAL = {
  default: { sand: '#e4d29c', grass: '#5f9b46', forest: '#3f7a3a', rock: '#8c867a', high: '#aaa6a0', snow: '#f1f4f8' },
  fishing: { sand: '#e8d6a2', grass: '#6aa84c', forest: '#4a8a3e', rock: '#8c867a', high: '#aaa6a0', snow: '#f1f4f8' },
  marsh: { sand: '#b9ab7c', grass: '#6c9150', forest: '#4e7440', rock: '#7d7a62', high: '#9a9680', snow: '#e8ece8' },
  volcanic: { sand: '#6d645e', grass: '#514b47', forest: '#403b39', rock: '#2f2c2c', high: '#252323', snow: '#ff5a1f' },
  pale: { sand: '#f0e8d2', grass: '#92b06c', forest: '#6f9060', rock: '#d9d5c9', high: '#ece9e0', snow: '#ffffff' },
  pine: { sand: '#d8c898', grass: '#44804a', forest: '#2f6540', rock: '#757068', high: '#a09c98', snow: '#f1f4f8' },
  lighthouse: { sand: '#d9cfae', grass: '#6a8c58', forest: '#4c7048', rock: '#807c76', high: '#a8a49e', snow: '#f1f4f8' },
  abyss: { sand: '#7c7488', grass: '#4c5a58', forest: '#363f44', rock: '#4a4552', high: '#6a6474', snow: '#b9b1d0' },
};
const _c = {};
const col = (hex) => (_c[hex] || (_c[hex] = new THREE.Color(hex)));
const tmp = new THREE.Color();

export function paletteFor(isl) {
  if (isl.town) return PAL[isl.town.style] || PAL.default;
  if (isl.zone === 4) return PAL.abyss;
  if (isl.zone === 3 && isl.seed % 3 === 0) return PAL.pine;
  if (isl.zone === 2 && isl.seed % 2 === 0) return PAL.marsh;
  return PAL.default;
}

function colorAt(pal, isl, h, x, z, out) {
  const v = (vnoise(x * 0.17, z * 0.17, isl.seed) - 0.5) * 0.14;
  if (isl.hill && h > isl.hill.h * 0.86) { out.copy(col('#ff6a24')); out.multiplyScalar(0.8 + v * 3); return; }
  if (h < 0.85) out.copy(col(pal.sand));
  else if (h < 1.5) out.copy(col(pal.sand)).lerp(col(pal.grass), smoothstep(0.85, 1.5, h));
  else if (h < 9) out.copy(col(pal.grass)).lerp(col(pal.forest), smoothstep(3, 9, h) * 0.8);
  else if (h < 17) out.copy(col(pal.forest)).lerp(col(pal.rock), smoothstep(9, 17, h));
  else if (h < 30) out.copy(col(pal.rock)).lerp(col(pal.high), smoothstep(17, 30, h));
  else out.copy(col(pal.high)).lerp(col(pal.snow), smoothstep(30, 38, h));
  if (isl.kind === 'rock' || isl.kind === 'stack') out.copy(col(pal.rock)).lerp(col(pal.high), clamp(h / 30, 0, 1));
  out.r = clamp(out.r + v, 0, 1); out.g = clamp(out.g + v, 0, 1); out.b = clamp(out.b + v, 0, 1);
}

/** Build the terrain (land + shallows) for one island. Returns { land, shallows, geometry }. */
export function buildTerrain(isl) {
  const R = isl.R;
  const half = R * 2.0;
  const cell = clamp(R / 22, 1.5, 11);
  const n = Math.floor((half * 2) / cell) + 1;
  const x0 = isl.x - half, z0 = isl.z - half;
  const pos = new Float32Array(n * n * 3);
  const colr = new Float32Array(n * n * 3);
  const hs = new Float32Array(n * n);
  const pal = paletteFor(isl);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + i * cell, z = z0 + j * cell;
      const h = heightAt(x, z);
      const idx = j * n + i;
      hs[idx] = h;
      pos[idx * 3] = x; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = z;
      colorAt(pal, isl, h, x, z, tmp);
      colr[idx * 3] = tmp.r; colr[idx * 3 + 1] = tmp.g; colr[idx * 3 + 2] = tmp.b;
    }
  }
  const landIdx = [], shallowIdx = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      const hmax = Math.max(hs[a], hs[b], hs[c], hs[d]);
      const hmin = Math.min(hs[a], hs[b], hs[c], hs[d]);
      const flip = (i + j) & 1;
      if (hmax > 0) {
        if (flip) landIdx.push(a, c, d, a, d, b); else landIdx.push(a, c, b, b, c, d);
      }
      if (hmin < 0.6 && hmax > -9.6) {
        if (flip) shallowIdx.push(a, c, d, a, d, b); else shallowIdx.push(a, c, b, b, c, d);
      }
    }
  }
  const geoLand = new THREE.BufferGeometry();
  geoLand.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoLand.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  geoLand.setAttribute('aH', new THREE.BufferAttribute(hs, 1));
  geoLand.setIndex(landIdx.length > 65000 ? new THREE.Uint32BufferAttribute(landIdx, 1) : new THREE.Uint16BufferAttribute(landIdx, 1));
  geoLand.computeBoundingSphere();
  // keep the culling sphere honest in height as well
  geoLand.boundingSphere.radius += 40;

  const geoShallow = new THREE.BufferGeometry();
  geoShallow.setAttribute('position', geoLand.getAttribute('position'));
  geoShallow.setAttribute('aH', geoLand.getAttribute('aH'));
  geoShallow.setIndex(shallowIdx.length > 65000 ? new THREE.Uint32BufferAttribute(shallowIdx, 1) : new THREE.Uint16BufferAttribute(shallowIdx, 1));
  geoShallow.boundingSphere = geoLand.boundingSphere.clone();

  const land = new THREE.Mesh(geoLand, landMat);
  const shallows = new THREE.Mesh(geoShallow, shallowMat);
  shallows.renderOrder = -5;
  return { land, shallows, geometries: [geoLand, geoShallow] };
}
