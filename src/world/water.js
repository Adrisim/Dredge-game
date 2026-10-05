import * as THREE from 'three';
import { U, WAVE_GLSL } from './shared.js';

const SIZE = 1500;
const SEG = 200;
const CELL = SIZE / SEG;

const vertex = /* glsl */ `
uniform float uTime; uniform float uAmp;
varying vec3 vWorld; varying float vWave;
#include <fog_pars_vertex>
${WAVE_GLSL}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h = swellH(wp.xz, uTime, uAmp);
  wp.y += h;
  vWorld = wp.xyz; vWave = h;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const fragment = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform float uNight;
uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uHorizon;
uniform vec3 uSpecDir; uniform vec3 uSpecColor;
uniform vec3 uBoatPos; uniform vec2 uBoatDir; uniform float uLight; uniform float uCone; uniform float uRange;
varying vec3 vWorld; varying float vWave;
#include <fog_pars_fragment>
vec3 rippleNormal(vec2 p){
  float gx = 0.0, gz = 0.0;
  float c1 = cos(0.0982 * (0.86 * p.x + 0.5 * p.y) + 0.8 * uTime) * 0.20 * 0.0982 * uAmp;
  gx += c1 * 0.86; gz += c1 * 0.5;
  float c2 = cos(0.165 * (-0.45 * p.x + 0.89 * p.y) + 1.05 * uTime) * 0.12 * 0.165 * uAmp;
  gx += c2 * -0.45; gz += c2 * 0.89;
  // domain-warp the fine ripples so glints never line up into regular stripes
  vec2 q = p + vec2(3.2 * sin(p.y * 0.17 + uTime * 0.45) + 1.6 * sin(p.y * 0.41 - uTime * 0.3), 3.2 * cos(p.x * 0.15 - uTime * 0.35) + 1.6 * cos(p.x * 0.37 + uTime * 0.5));
  float c3 = cos(0.37 * (0.3 * q.x + 0.95 * q.y) + 1.9 * uTime) * 0.075; gx += c3 * 0.3; gz += c3 * 0.95;
  float c4 = cos(0.70 * (-0.8 * q.x + 0.6 * q.y) + 2.6 * uTime) * 0.05; gx += c4 * -0.8; gz += c4 * 0.6;
  float c5 = cos(1.26 * (0.6 * q.x + 0.8 * q.y) - 3.1 * uTime) * 0.035; gx += c5 * 0.6; gz += c5 * 0.8;
  float c6 = cos(2.1 * (q.x - 0.7 * q.y) + 4.3 * uTime) * 0.02; gx += c6; gz += c6 * -0.7;
  return normalize(vec3(-gx, 1.0, -gz));
}
void main(){
  vec3 n = rippleNormal(vWorld.xz);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(n, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 4.0) * 0.85 + 0.04;
  vec3 body = mix(uDeep, uShallow, 0.30 + 0.40 * smoothstep(-0.45, 0.45, vWave / max(uAmp, 0.3)));
  vec3 col = mix(body, uHorizon, fres);
  vec3 H = normalize(uSpecDir + V);
  float spec = pow(max(dot(n, H), 0.0), 260.0);
  col += uSpecColor * min(spec, 1.0) * 0.6;
  float foam = smoothstep(0.24, 0.32, vWave + 0.035 * sin(vWorld.x * 2.1 + vWorld.z * 1.7 + uTime * 2.0)) * (0.2 + 0.2 * uAmp);
  col = mix(col, vec3(0.9, 0.95, 1.0) * (0.45 + 0.55 * (1.0 - uNight)), clamp(foam, 0.0, 0.5));
  // boat lamp pool
  vec2 toP = vWorld.xz - uBoatPos.xz;
  float dist = length(toP);
  float cosA = dot(toP / max(dist, 0.001), uBoatDir);
  float glow = uLight * smoothstep(uCone, 0.985, cosA) * (1.0 - smoothstep(6.0, uRange, dist)) * smoothstep(0.5, 7.0, dist);
  col += vec3(1.0, 0.86, 0.55) * glow * 0.55;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Water {
  constructor() {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    });
    // bind shared uniforms by reference
    for (const k of ['uTime', 'uAmp', 'uNight', 'uDeep', 'uShallow', 'uHorizon', 'uSpecDir', 'uSpecColor',
      'uBoatPos', 'uBoatDir', 'uLight', 'uCone', 'uRange']) this.material.uniforms[k] = U[k];
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  follow(x, z) {
    this.mesh.position.set(Math.round(x / CELL) * CELL, 0, Math.round(z / CELL) * CELL);
  }
}
