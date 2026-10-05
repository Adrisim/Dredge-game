import * as THREE from 'three';

/** Uniform objects shared by every custom shader (water, shallows, sky) – updated once per frame. */
export const U = {
  uTime: { value: 0 },
  uAmp: { value: 1 },
  uDeep: { value: new THREE.Color('#0c5f8f') },
  uShallow: { value: new THREE.Color('#3cc2c8') },
  uHorizon: { value: new THREE.Color('#bfe3f5') },
  uTop: { value: new THREE.Color('#3d8ee6') },
  uSpecDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
  uSpecColor: { value: new THREE.Color('#ffffff') },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
  uSunColor: { value: new THREE.Color('#fff4d8') },
  uNight: { value: 0 },
  uTint: { value: new THREE.Color('#ffffff') },
  uBoatPos: { value: new THREE.Vector3() },
  uBoatDir: { value: new THREE.Vector2(0, 1) },
  uLight: { value: 0 },
  uCone: { value: 0.85 },
  uRange: { value: 70 },
};

// Mirrors the two long swells used in the vertex shaders so the boat can bob in sync.
export function waveHeight(x, z, t, amp = U.uAmp.value) {
  return amp * (0.2 * Math.sin(0.0982 * (0.86 * x + 0.5 * z) + 0.8 * t) +
    0.12 * Math.sin(0.165 * (-0.45 * x + 0.89 * z) + 1.05 * t));
}

export const WAVE_GLSL = /* glsl */ `
float swellH(vec2 p, float t, float amp){
  return amp * (0.20 * sin(0.0982 * (0.86 * p.x + 0.5 * p.y) + 0.8 * t)
              + 0.12 * sin(0.165 * (-0.45 * p.x + 0.89 * p.y) + 1.05 * t));
}
`;
