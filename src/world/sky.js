import * as THREE from 'three';
import { U } from './shared.js';

const vertex = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at far plane
}`;

const fragment = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uNight; uniform float uTime; uniform float uCloud;
varying vec3 vDir;
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.8, clamp(-d.y * 4.0, 0.0, 1.0));
  // sun
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 700.0) * 3.0 + pow(sd, 10.0) * 0.30 + pow(sd, 3.0) * 0.08) * (1.0 - uNight * 0.9);
  // moon
  vec3 md = -uSunDir;
  float mdot = dot(d, md);
  float moon = smoothstep(0.9985, 0.9992, mdot);
  col += vec3(0.85, 0.9, 1.0) * moon * uNight * 0.9;
  col += vec3(0.4, 0.5, 0.8) * pow(max(mdot, 0.0), 24.0) * 0.12 * uNight;
  // stars
  if (uNight > 0.01 && d.y > 0.0) {
    vec3 q = d * 150.0;
    vec3 g = floor(q);
    float s = hash3(g);
    vec3 off = vec3(hash3(g + 7.1), hash3(g + 13.7), hash3(g + 3.3)) * 0.6 + 0.2;
    float dist = length(fract(q) - off);
    float tw = 0.65 + 0.35 * sin(uTime * 2.0 + s * 60.0);
    float star = step(0.985, s) * smoothstep(0.17, 0.0, dist) * tw * smoothstep(0.02, 0.25, d.y);
    col += vec3(star) * uNight;
  }
  // soft clouds
  if (d.y > 0.02) {
    vec2 uv = d.xz / (d.y + 0.35) * 2.2 + vec2(uTime * 0.004, 0.0);
    float c = noise2(uv * 1.6) * 0.6 + noise2(uv * 3.7) * 0.3 + noise2(uv * 8.0) * 0.1;
    c = smoothstep(0.52 - uCloud * 0.2, 0.9, c) * smoothstep(0.02, 0.22, d.y);
    vec3 cc = mix(uHorizon, vec3(1.0), 0.65) * (1.0 - uNight * 0.8);
    col = mix(col, cc, c * (0.55 + 0.35 * uCloud));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor() {
    this.cloud = { value: 0.2 };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, depthWrite: false, depthTest: false, side: THREE.BackSide,
      uniforms: {
        uTop: U.uTop, uHorizon: U.uHorizon, uSunDir: U.uSunDir, uSunColor: U.uSunColor,
        uNight: U.uNight, uTime: U.uTime, uCloud: this.cloud,
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), this.material);
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
  }
  follow(pos) { this.mesh.position.copy(pos); }
}
