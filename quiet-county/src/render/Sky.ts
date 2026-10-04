import * as THREE from 'three';
import type { SkySample } from '../systems/TimeOfDay';

/** Gradient sky dome with a sun/moon glow and a star field that fades in at night. */
export class Sky {
  readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly stars: THREE.Points;
  private readonly starMat: THREE.PointsMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x667788) },
        uHorizon: { value: new THREE.Color(0xaabbcc) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(0xffffff) },
        uSunStrength: { value: 1 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunStrength;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
          float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(s, 64.0) * 0.9 + pow(s, 6.0) * 0.18) * uSunStrength;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), this.material);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    const n = 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 0.9 + 0.08;
      const r = 380;
      pos[i * 3] = Math.cos(u) * Math.cos(Math.asin(v)) * r;
      pos[i * 3 + 1] = v * r;
      pos[i * 3 + 2] = Math.sin(u) * Math.cos(Math.asin(v)) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(g, this.starMat);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  apply(sample: SkySample, sunDir: THREE.Vector3, cloudiness: number): void {
    const u = this.material.uniforms;
    (u.uTop.value as THREE.Color).setHex(sample.skyTop);
    (u.uHorizon.value as THREE.Color).setHex(sample.horizon);
    (u.uSunColor.value as THREE.Color).setHex(sample.sunColor);
    (u.uSunDir.value as THREE.Vector3).copy(sunDir);
    u.uSunStrength.value = (1 - cloudiness * 0.8) * (sample.darkness > 0.8 ? 0.35 : 1);
    this.starMat.opacity = Math.max(0, sample.darkness - 0.45) * 1.6 * (1 - cloudiness);
  }

  follow(pos: THREE.Vector3): void {
    this.group.position.copy(pos);
  }
}
