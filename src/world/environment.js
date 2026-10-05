import * as THREE from 'three';
import { U } from './shared.js';
import { clamp, smoothstep, lerp } from '../util/math.js';
import { windowMat, haloMat, beamMat } from './decor.js';

const K = (h, o) => ({ h, ...o });
const KEYS = [
  K(0, { top: '#070c24', hor: '#121d3c', sun: '#ff9a5a', sunI: 0.0, moonI: 0.42, hemiSky: '#4a5f9c', hemiGnd: '#1a2038', hemiI: 0.95, deep: '#06192c', shallow: '#12405a', night: 1, tint: '#7d92c8' }),
  K(4.6, { top: '#070c24', hor: '#121d3c', sun: '#ff9a5a', sunI: 0.0, moonI: 0.42, hemiSky: '#4a5f9c', hemiGnd: '#1a2038', hemiI: 0.95, deep: '#06192c', shallow: '#12405a', night: 1, tint: '#7d92c8' }),
  K(6.1, { top: '#3b4c80', hor: '#f4a27c', sun: '#ffb27a', sunI: 0.75, moonI: 0.1, hemiSky: '#9aa0cc', hemiGnd: '#4a3a3a', hemiI: 0.95, deep: '#0e3858', shallow: '#3a8590', night: 0.3, tint: '#d8c0b8' }),
  K(7.4, { top: '#5aa2e4', hor: '#d2e2ee', sun: '#fff0d2', sunI: 1.15, moonI: 0, hemiSky: '#bcd6f2', hemiGnd: '#6c7a60', hemiI: 1.0, deep: '#0f5c84', shallow: '#38b2ba', night: 0, tint: '#ffffff' }),
  K(12, { top: '#3d8ee6', hor: '#c0e3f5', sun: '#fffaf0', sunI: 1.3, moonI: 0, hemiSky: '#cfe8ff', hemiGnd: '#7a8a6a', hemiI: 1.05, deep: '#0c6090', shallow: '#3cc4ca', night: 0, tint: '#ffffff' }),
  K(16.4, { top: '#4a96e2', hor: '#d0e5f0', sun: '#fff0d8', sunI: 1.2, moonI: 0, hemiSky: '#c4dcf4', hemiGnd: '#6c7a60', hemiI: 1.0, deep: '#0e5c86', shallow: '#38b4bc', night: 0, tint: '#ffffff' }),
  K(18.2, { top: '#4a5f9c', hor: '#f2a070', sun: '#ff9a5a', sunI: 0.85, moonI: 0.1, hemiSky: '#a094bc', hemiGnd: '#4a3a3a', hemiI: 0.95, deep: '#0e3454', shallow: '#356e86', night: 0.2, tint: '#e8c8b8' }),
  K(19.4, { top: '#2a3466', hor: '#b6587a', sun: '#e07a68', sunI: 0.4, moonI: 0.25, hemiSky: '#6c74b0', hemiGnd: '#2e2a40', hemiI: 0.9, deep: '#0a2440', shallow: '#244e68', night: 0.65, tint: '#a8a0c8' }),
  K(20.8, { top: '#0b1232', hor: '#1c2748', sun: '#7f93d0', sunI: 0.0, moonI: 0.42, hemiSky: '#4a5f9c', hemiGnd: '#1a2038', hemiI: 0.95, deep: '#06192c', shallow: '#12405a', night: 1, tint: '#7d92c8' }),
  K(24, { top: '#070c24', hor: '#121d3c', sun: '#ff9a5a', sunI: 0.0, moonI: 0.42, hemiSky: '#4a5f9c', hemiGnd: '#1a2038', hemiI: 0.95, deep: '#06192c', shallow: '#12405a', night: 1, tint: '#7d92c8' }),
];
for (const k of KEYS) for (const f of ['top', 'hor', 'sun', 'hemiSky', 'hemiGnd', 'deep', 'shallow', 'tint']) k[f] = new THREE.Color(k[f]);

const WEATHER = {
  clear: { fog: 1, waves: 1, cloud: 0.15, dark: 0, rain: 0 },
  cloudy: { fog: 0.85, waves: 1.25, cloud: 0.6, dark: 0.1, rain: 0 },
  fog: { fog: 0.3, waves: 0.8, cloud: 0.5, dark: 0.08, rain: 0 },
  storm: { fog: 0.5, waves: 2.3, cloud: 1.0, dark: 0.38, rain: 1 },
};
const ZONE_WEATHER = {
  1: [['clear', 6], ['cloudy', 2], ['fog', 1], ['storm', 0]],
  2: [['clear', 4], ['cloudy', 3], ['fog', 2], ['storm', 1]],
  3: [['clear', 3], ['cloudy', 3], ['fog', 2], ['storm', 2]],
  4: [['clear', 1], ['cloudy', 3], ['fog', 4], ['storm', 3]],
};

const rainVertex = /* glsl */ `
attribute vec3 aOff; attribute float aEnd; uniform float uTime; uniform vec3 uCam;
void main(){
  vec3 p = aOff;
  p.y = mod(p.y - uTime * 34.0, 46.0);
  vec3 w = vec3(mod(p.x - uCam.x + 45.0, 90.0) + uCam.x - 45.0, uCam.y - 14.0 + p.y, mod(p.z - uCam.z + 45.0, 90.0) + uCam.z - 45.0);
  w += vec3(-0.35, 1.0, 0.1) * aEnd * 1.9;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const rainFragment = /* glsl */ `
uniform float uRain; uniform float uNight;
void main(){ gl_FragColor = vec4(mix(vec3(0.8, 0.88, 0.95), vec3(0.35, 0.42, 0.6), uNight), 0.32 * uRain); }`;

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.fog = new THREE.Fog('#c0e3f5', 80, 700);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#7a8a6a', 1);
    this.sun = new THREE.DirectionalLight('#fff', 1);
    this.moon = new THREE.DirectionalLight('#9fb4ff', 0);
    this.sun.position.set(100, 100, 40);
    this.moon.position.set(-100, 100, -40);
    scene.add(this.hemi, this.sun, this.moon);

    this.night = 0;
    this.wKey = 'clear';
    this.w = { ...WEATHER.clear };
    this.wTarget = { ...WEATHER.clear };
    this.nextWeatherHour = 9;
    this.lastHour = 0;
    this._c1 = new THREE.Color();
    this._c2 = new THREE.Color();
    this.key = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), hemiSky: new THREE.Color(), hemiGnd: new THREE.Color(), deep: new THREE.Color(), shallow: new THREE.Color(), tint: new THREE.Color() };

    // rain streaks
    const N = 900;
    const off = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 90, y = Math.random() * 46, z = Math.random() * 90;
      for (let v = 0; v < 2; v++) { off.set([x, y, z], (i * 2 + v) * 3); end[i * 2 + v] = v; }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    rg.setAttribute('aOff', new THREE.BufferAttribute(off, 3));
    rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rainU = { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uNight: U.uNight };
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      vertexShader: rainVertex, fragmentShader: rainFragment, transparent: true, depthWrite: false, uniforms: this.rainU,
    }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  setWeather(name) { this.wKey = name; Object.assign(this.wTarget, WEATHER[name]); }

  pickWeather(zone) {
    const table = ZONE_WEATHER[zone] || ZONE_WEATHER[1];
    let tot = 0; for (const [, w] of table) tot += w;
    let r = Math.random() * tot;
    for (const [n, w] of table) { r -= w; if (r <= 0) return n; }
    return 'clear';
  }

  sample(hour) {
    let i = 0;
    while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
    const s = t * t * (3 - 2 * t);
    const k = this.key;
    for (const f of ['top', 'hor', 'sun', 'hemiSky', 'hemiGnd', 'deep', 'shallow', 'tint']) k[f].copy(a[f]).lerp(b[f], s);
    k.sunI = lerp(a.sunI, b.sunI, s); k.moonI = lerp(a.moonI, b.moonI, s);
    k.hemiI = lerp(a.hemiI, b.hemiI, s); k.night = lerp(a.night, b.night, s);
    return k;
  }

  update(dt, hour, camera, ctx) {
    const { zone, hoursPassed = 0, lanternLit = true } = ctx;
    // weather scheduling (in game hours)
    this.lastHour = hour;
    this.nextWeatherHour -= hoursPassed;
    if (this.nextWeatherHour <= 0) {
      this.setWeather(this.pickWeather(zone));
      this.nextWeatherHour = 2 + Math.random() * 4;
    }
    const wk = 1 - Math.exp(-dt * 0.35);
    for (const f of ['fog', 'waves', 'cloud', 'dark', 'rain']) this.w[f] += (this.wTarget[f] - this.w[f]) * wk;

    const k = this.sample(hour);
    const dark = this.w.dark;
    this.night = k.night;
    // sun position
    const e = ((hour - 6) / 12) * Math.PI;
    const s = Math.sin(e);
    const el = Math.asin(clamp(s * 0.9, -1, 1));
    const az = 0.9 + (hour / 24) * 0.8;
    const sd = U.uSunDir.value.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    this.sun.position.copy(sd).multiplyScalar(200);
    this.moon.position.copy(sd).multiplyScalar(-200);
    this.moon.position.y = Math.abs(this.moon.position.y) * 0.6 + 60;
    const sunVis = smoothstep(-0.05, 0.14, s);
    const moonVis = smoothstep(0.1, -0.12, s);
    this.sun.color.copy(k.sun);
    this.sun.intensity = k.sunI * sunVis * (1 - dark * 1.4);
    this.moon.intensity = k.moonI * moonVis * (1 - dark * 0.5) + 0.0;
    this.hemi.color.copy(k.hemiSky);
    this.hemi.groundColor.copy(k.hemiGnd);
    this.hemi.intensity = k.hemiI * (1 - dark * 0.55);

    // fog / sky
    const grey = this._c1.setRGB(0.5, 0.55, 0.6).multiplyScalar(0.5 + 0.5 * (1 - k.night));
    U.uHorizon.value.copy(k.hor).lerp(grey, clamp(dark * 1.4 + (1 - this.w.fog) * 0.35, 0, 0.7));
    U.uTop.value.copy(k.top).lerp(grey, clamp(dark * 1.6 + this.w.cloud * 0.18, 0, 0.75));
    U.uSunColor.value.copy(k.sun);
    this.fog.color.copy(U.uHorizon.value);
    const far = 700 * this.w.fog * (1 - 0.32 * k.night);
    this.fog.far = Math.max(140, far);
    this.fog.near = this.fog.far * 0.1;
    U.uNight.value = k.night;
    U.uAmp.value = this.w.waves;
    U.uDeep.value.copy(k.deep);
    U.uShallow.value.copy(k.shallow);
    U.uTint.value.copy(k.tint).multiplyScalar(1 - dark * 0.35);
    // specular follows whichever light dominates
    if (sunVis > 0.25) { U.uSpecDir.value.copy(sd); U.uSpecColor.value.copy(k.sun).multiplyScalar(sunVis * (1 - dark * 1.2)); }
    else { U.uSpecDir.value.copy(sd).negate(); U.uSpecColor.value.set('#9fb4ff').multiplyScalar(0.2 * moonVis * (1 - dark)); }
    U.uSpecDir.value.y = Math.max(U.uSpecDir.value.y, 0.12);
    U.uSpecDir.value.normalize();

    // night-lit things
    const nl = smoothstep(0.35, 0.9, k.night);
    windowMat.color.setRGB(0.3, 0.33, 0.36).lerp(this._c2.setRGB(1.0, 0.8, 0.42), nl);
    haloMat.opacity = nl * 0.8;
    beamMat.opacity = lanternLit ? nl * 0.28 : 0;
    this.nightLit = nl;

    // rain
    const raining = this.w.rain > 0.05;
    this.rain.visible = raining;
    this.rainU.uRain.value = this.w.rain;
    this.rainU.uCam.value.copy(camera.position);
    this.cloudAmount = this.w.cloud;
  }
}
